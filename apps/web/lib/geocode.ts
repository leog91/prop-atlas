import { eq } from "@prop-atlas/db";
import { geocodeCache } from "@prop-atlas/db";
import { getDb } from "@/lib/db";

/**
 * Nominatim's usage policy caps clients at one request per second and requires a
 * User-Agent that identifies the application. Exceeding either gets the calling
 * IP blocked, so requests are serialized through a single chain and each save is
 * allowed only a handful of attempts.
 */
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAX_GEOCODE_ATTEMPTS = 4;

const NOMINATIM_CONTACT =
  process.env.NOMINATIM_CONTACT || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn` after every previously queued call, spacing each at least one second apart. */
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const result = requestChain.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });

  // Keep the chain alive regardless of this call's outcome.
  requestChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

function stripLocationLabel(value: string) {
  return value.replace(/^(urb\.?|barrio|distrito|área|area)\s+/i, "").trim();
}

function isAddressNoise(value: string) {
  return /^(ampliar mapa|ver mapa|mapa)$/i.test(value.trim());
}

function getAddressParts(address?: string) {
  return (address || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isAddressNoise(part));
}

function inferCity(addressParts: string[], city?: string) {
  if (city) return city;
  const ignored = /^(urb\.?|barrio|distrito|área|area)\b/i;
  const inferred = [...addressParts].reverse().find((part) => {
    return !ignored.test(part) && !/^\d{4,5}$/.test(part);
  });

  return inferred ? stripLocationLabel(inferred) : undefined;
}

function joinGeocodeQuery(parts: Array<string | undefined>, country?: string) {
  const cleanedParts = parts.filter((part): part is string => !!part && part.trim().length > 0);
  const hasSpecificPlace = cleanedParts.some((part) => part !== country);
  return hasSpecificPlace ? cleanedParts.join(", ") : "";
}

function getAddressGeocodeQueries(address?: string, city?: string, country?: string) {
  const parts = getAddressParts(address);
  const inferredCity = inferCity(parts, city);
  const postalCode = parts.find((part) => /^\d{4,5}$/.test(part));
  const street = parts[0];
  const urbanization = parts.find((part) => /^urb\.?\b/i.test(part));
  const neighborhood = parts.find((part) => /^barrio\b/i.test(part));
  const district = parts.find((part) => /^distrito\b/i.test(part));
  const cleanedArea = parts.find((part) => /^(área|area)\b/i.test(part));

  return [
    joinGeocodeQuery([street, postalCode, inferredCity, country], country),
    joinGeocodeQuery([street, inferredCity, country], country),
    joinGeocodeQuery([stripLocationLabel(urbanization || ""), inferredCity, country], country),
    joinGeocodeQuery([stripLocationLabel(neighborhood || ""), inferredCity, country], country),
    joinGeocodeQuery([stripLocationLabel(district || ""), inferredCity, country], country),
    joinGeocodeQuery([stripLocationLabel(cleanedArea || ""), country], country),
    joinGeocodeQuery([parts.join(", "), city, country], country),
    joinGeocodeQuery([inferredCity, country], country),
  ];
}

export function getGeocodeQueries(data: {
  address?: string;
  city?: string;
  country?: string;
  rawPayload?: Record<string, unknown>;
}) {
  const rawQueries = data.rawPayload?.geocodeQueries;
  const payloadQueries = Array.isArray(rawQueries)
    ? rawQueries.filter((query): query is string => typeof query === "string" && query.trim().length > 0)
    : [];

  const firstQueries: string[] = [];
  const fallbackQueries: string[] = [];

  // 1. Try the full raw location line FIRST (exactly as Zonaprop shows it)
  const rawLoc = data.rawPayload?.locationLine;
  if (typeof rawLoc === "string" && rawLoc.trim().length > 0) {
    const loc = rawLoc.trim();
    const country = data.country || "";
    firstQueries.push(`${loc}, ${country}`.trim().replace(/,$/, ""));
    if (data.country?.toLowerCase() === "argentina") {
      firstQueries.push(`${loc}, Buenos Aires, Argentina`);
      firstQueries.push(`${loc}, Provincia de Buenos Aires, Argentina`);
    }
  }

  // 2. Fallback: split address/city permutations
  fallbackQueries.push(...getAddressGeocodeQueries(data.address, data.city, data.country));

  // 3. Argentina-specific province hints
  if (data.country?.toLowerCase() === "argentina" && data.city) {
    if (data.address) {
      fallbackQueries.push(`${data.address}, ${data.city}, Buenos Aires, Argentina`);
      fallbackQueries.push(`${data.address}, ${data.city}, Provincia de Buenos Aires, Argentina`);
    }
    fallbackQueries.push(`${data.city}, Buenos Aires, Argentina`);
    fallbackQueries.push(`${data.city}, Provincia de Buenos Aires, Argentina`);
  }

  return Array.from(
    new Set([...payloadQueries, ...firstQueries, ...fallbackQueries].filter((query) => query.trim().length > 0))
  );
}

async function fetchFromNominatim(query: string): Promise<Coordinates | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await throttle(() =>
      fetch(url, {
        headers: {
          "User-Agent": `PropAtlas/1.0 (+${NOMINATIM_CONTACT})`,
        },
      })
    );
    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const latitude = parseFloat(results[0].lat);
    const longitude = parseFloat(results[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch (error) {
    console.error("[GEOCODE] Error:", error);
    return null;
  }
}

type CacheLookup = { cached: true; coordinates: Coordinates | null } | { cached: false };

async function readCache(query: string): Promise<CacheLookup> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(geocodeCache)
    .where(eq(geocodeCache.query, query))
    .limit(1);

  if (!row) return { cached: false };

  // Null coordinates are a recorded miss: Nominatim has already been asked.
  return {
    cached: true,
    coordinates:
      row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
  };
}

async function writeCache(query: string, coordinates: Coordinates | null) {
  const db = getDb();
  try {
    await db.insert(geocodeCache).values({
      query,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    });
  } catch (error) {
    // A concurrent save may have cached the same query first; that is harmless.
    console.error("[GEOCODE] Failed to cache:", error);
  }
}

export interface GeocodeResult extends Coordinates {
  query: string;
}

/**
 * Resolves coordinates for a listing, trying the most specific query first.
 *
 * Cached results — including recorded misses — are free and do not count toward
 * the attempt budget; only live Nominatim calls are limited.
 */
export async function geocodeListing(
  data: {
    address?: string;
    city?: string;
    country?: string;
    rawPayload?: Record<string, unknown>;
  },
  log: (...args: unknown[]) => void = () => {}
): Promise<GeocodeResult | null> {
  let attempts = 0;

  for (const query of getGeocodeQueries(data)) {
    const cache = await readCache(query);

    if (cache.cached) {
      if (cache.coordinates) {
        log("[GEOCODE] Cache hit:", query, cache.coordinates);
        return { ...cache.coordinates, query };
      }
      log("[GEOCODE] Cached miss, skipping:", query);
      continue;
    }

    if (attempts >= MAX_GEOCODE_ATTEMPTS) {
      log("[GEOCODE] Attempt budget exhausted, giving up");
      return null;
    }

    attempts++;
    log("[GEOCODE] Querying Nominatim:", query);
    const coordinates = await fetchFromNominatim(query);
    await writeCache(query, coordinates);

    if (coordinates) {
      log("[GEOCODE] Success:", query, coordinates);
      return { ...coordinates, query };
    }
  }

  return null;
}
