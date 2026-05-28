import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { propertySchema } from "@prop-atlas/types";
import { properties, propertyImages, savedProperties, propertyPriceHistory } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import crypto from "crypto";

const isDevelopment = process.env.NODE_ENV === "development";

function debugLog(...args: Parameters<typeof console.log>) {
  if (isDevelopment) {
    console.log(...args);
  }
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function parseListedDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  const spanishMatch = value.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);
  if (spanishMatch) {
    const [, day, monthName] = spanishMatch;
    const month = parseSpanishMonth(monthName);
    if (month == null) return null;

    const now = new Date();
    const year = now.getFullYear();
    const parsed = new Date(year, month, parseInt(day, 10), 12);
    if (parsed.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
      parsed.setFullYear(year - 1);
    }

    return parsed;
  }
  return null;
}

function parseSpanishMonth(month: string): number | undefined {
  const months: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  return months[month.toLowerCase()];
}

function getRawPayload(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
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

function getGeocodeQueries(data: {
  address?: string;
  city?: string;
  country?: string;
  rawPayload?: Record<string, unknown>;
}) {
  const rawQueries = data.rawPayload?.geocodeQueries;
  const payloadQueries = Array.isArray(rawQueries)
    ? rawQueries.filter((query): query is string => typeof query === "string" && query.trim().length > 0)
    : [];
  const fallbackQueries = getAddressGeocodeQueries(data.address, data.city, data.country);

  return Array.from(new Set([...payloadQueries, ...fallbackQueries].filter((query) => query.trim().length > 0)));
}

async function geocodeQuery(query: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PropAtlas/1.0",
      },
    });
    if (!response.ok) return null;
    const results = await response.json();
    if (results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error("[GEOCODE] Error:", error);
    return null;
  }
}

function normalizeIncomingPrice(data: { provider: string; price: number }) {
  if (data.provider === "idealista" && data.price > 0 && data.price < 100 && !Number.isInteger(data.price)) {
    return Math.round(data.price * 1000);
  }

  return data.price;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request);
  if (error) {
    error.headers.set("Access-Control-Allow-Origin", origin || "*");
    error.headers.set("Access-Control-Allow-Credentials", "true");
    return error;
  }

  const body = await request.json();
  debugLog("[SAVE] Received payload:", JSON.stringify(body, null, 2));
  const parsed = propertySchema.safeParse(body);

  if (!parsed.success) {
    debugLog("[SAVE] Validation errors:", JSON.stringify(parsed.error.flatten(), null, 2));
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const data = parsed.data;
  const db = getDb();
  const price = normalizeIncomingPrice(data);
  const incomingRawPayload = getRawPayload(data.rawPayload);
  const incomingApproximate =
    incomingRawPayload.isApproximateLocation === true ||
    incomingRawPayload.locationPrecision === "approximate";

  let latitude = data.latitude ?? null;
  let longitude = data.longitude ?? null;
  let isApproximateLocation = incomingApproximate;
  let geocodeQueryUsed: string | undefined;

  if (latitude == null || longitude == null) {
    debugLog("[GEOCODE] No coordinates found, attempting geocoding...");
    debugLog("[GEOCODE] Address:", data.address, "City:", data.city, "Country:", data.country);
    for (const query of getGeocodeQueries({ ...data, rawPayload: incomingRawPayload })) {
      debugLog("[GEOCODE] Trying:", query);
      const geocoded = await geocodeQuery(query);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        isApproximateLocation = true;
        geocodeQueryUsed = query;
        debugLog("[GEOCODE] Success:", { query, ...geocoded });
        break;
      }
    }
    if (latitude == null || longitude == null) {
      debugLog("[GEOCODE] Failed to geocode");
    }
  } else {
    debugLog("[GEOCODE] Using provided coordinates:", { latitude, longitude });
  }

  const rawPayload = {
    ...incomingRawPayload,
    isApproximateLocation,
    locationPrecision: isApproximateLocation ? "approximate" : incomingRawPayload.locationPrecision,
    geocodeQueryUsed,
  };

  const existing = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.provider, data.provider),
        eq(properties.providerListingId, data.providerListingId)
      )
    )
    .limit(1);

  let propertyId: string;

  if (existing.length > 0) {
    const existingProperty = existing[0];
    propertyId = existingProperty.id;

    if (existingProperty.price !== price) {
      await db.insert(propertyPriceHistory).values({
        id: crypto.randomUUID(),
        propertyId,
        price,
        currency: data.currency,
      });
    }

    await db
      .update(properties)
      .set({
        title: data.title,
        description: data.description ?? null,
        price,
        currency: data.currency,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        area: data.area ?? null,
        areaUnit: data.areaUnit ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
        postalCode: data.postalCode ?? null,
        latitude,
        longitude,
        url: data.url,
        listedAt: parseListedDate(data.listedAt),
        views: data.views ?? null,
        rawPayload,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    if (data.images?.length) {
      await db.delete(propertyImages).where(eq(propertyImages.propertyId, propertyId));
      await db.insert(propertyImages).values(
        data.images.map((url, i) => ({
          id: crypto.randomUUID(),
          propertyId,
          url,
          sortOrder: i,
        }))
      );
    }
  } else {
    propertyId = crypto.randomUUID();

    await db.insert(properties).values({
      id: propertyId,
      provider: data.provider,
      providerListingId: data.providerListingId,
      listingType: data.listingType,
      title: data.title,
      description: data.description ?? null,
      price,
      currency: data.currency,
      propertyType: data.propertyType,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      area: data.area ?? null,
      areaUnit: data.areaUnit ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      postalCode: data.postalCode ?? null,
      latitude,
      longitude,
      url: data.url,
      listedAt: parseListedDate(data.listedAt),
      views: data.views ?? null,
      rawPayload,
    });

    if (data.images?.length) {
      await db.insert(propertyImages).values(
        data.images.map((url, i) => ({
          id: crypto.randomUUID(),
          propertyId,
          url,
          sortOrder: i,
        }))
      );
    }

    await db.insert(propertyPriceHistory).values({
      id: crypto.randomUUID(),
      propertyId,
      price,
      currency: data.currency,
    });
  }

  const existingSave = await db
    .select()
    .from(savedProperties)
    .where(
      and(
        eq(savedProperties.userId, session.user.id),
        eq(savedProperties.propertyId, propertyId)
      )
    )
    .limit(1);

  if (existingSave.length === 0) {
    await db.insert(savedProperties).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      propertyId,
    });
  } else if (existingSave[0].deletedAt != null) {
    await db
      .update(savedProperties)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(savedProperties.id, existingSave[0].id));
  }

  return NextResponse.json(
    { id: propertyId, status: existing.length > 0 ? "updated" : "created" },
    { headers: corsHeaders(origin) }
  );
}
