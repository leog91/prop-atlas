import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { propertySchema } from "@prop-atlas/types";
import { properties, propertyImages, savedProperties, propertyPriceHistory } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import crypto from "crypto";

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
  return null;
}

function getRawPayload(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function stripLocationLabel(value: string) {
  return value.replace(/^(urb\.?|barrio|distrito|área|area)\s+/i, "").trim();
}

function getAddressParts(address?: string) {
  return (address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferCity(addressParts: string[], city?: string) {
  if (city) return city;
  const ignored = /^(urb\.?|barrio|distrito|área|area)\b/i;
  const inferred = [...addressParts].reverse().find((part) => {
    return !ignored.test(part) && !/^\d{4,5}$/.test(part);
  });

  return inferred ? stripLocationLabel(inferred) : undefined;
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
    [street, postalCode, inferredCity, country],
    [street, inferredCity, country],
    [stripLocationLabel(urbanization || ""), inferredCity, country],
    [stripLocationLabel(neighborhood || ""), inferredCity, country],
    [stripLocationLabel(district || ""), inferredCity, country],
    [stripLocationLabel(cleanedArea || ""), country],
    [address, city, country],
    [inferredCity, country],
  ].map((queryParts) => queryParts.filter(Boolean).join(", "));
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

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request);
  if (error) {
    error.headers.set("Access-Control-Allow-Origin", origin || "*");
    error.headers.set("Access-Control-Allow-Credentials", "true");
    return error;
  }

  const body = await request.json();
  console.log("[SAVE] Received payload:", JSON.stringify(body, null, 2));
  const parsed = propertySchema.safeParse(body);

  if (!parsed.success) {
    console.log("[SAVE] Validation errors:", JSON.stringify(parsed.error.flatten(), null, 2));
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const data = parsed.data;
  const db = getDb();
  const incomingRawPayload = getRawPayload(data.rawPayload);
  const incomingApproximate =
    incomingRawPayload.isApproximateLocation === true ||
    incomingRawPayload.locationPrecision === "approximate";

  let latitude = data.latitude ?? null;
  let longitude = data.longitude ?? null;
  let isApproximateLocation = incomingApproximate;
  let geocodeQueryUsed: string | undefined;

  if (latitude == null || longitude == null) {
    console.log("[GEOCODE] No coordinates found, attempting geocoding...");
    console.log("[GEOCODE] Address:", data.address, "City:", data.city, "Country:", data.country);
    for (const query of getGeocodeQueries({ ...data, rawPayload: incomingRawPayload })) {
      console.log("[GEOCODE] Trying:", query);
      const geocoded = await geocodeQuery(query);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        isApproximateLocation = true;
        geocodeQueryUsed = query;
        console.log("[GEOCODE] ✓ Success:", { query, ...geocoded });
        break;
      }
    }
    if (latitude == null || longitude == null) {
      console.log("[GEOCODE] ✗ Failed to geocode");
    }
  } else {
    console.log("[GEOCODE] Using provided coordinates:", { latitude, longitude });
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

    if (existingProperty.price !== data.price) {
      await db.insert(propertyPriceHistory).values({
        id: crypto.randomUUID(),
        propertyId,
        price: data.price,
        currency: data.currency,
      });
    }

    await db
      .update(properties)
      .set({
        title: data.title,
        description: data.description ?? null,
        price: data.price,
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
      price: data.price,
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
      price: data.price,
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
