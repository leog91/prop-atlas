import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { propertySchema } from "@prop-atlas/types";
import { properties, propertyImages, savedProperties, propertyPriceHistory } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { corsHeaders, corsPreflightResponse, withCors } from "@/lib/cors";
import { geocodeListing } from "@/lib/geocode";
import { readJsonBody } from "@/lib/http";
import crypto from "crypto";

const isDevelopment = process.env.NODE_ENV === "development";

function debugLog(...args: Parameters<typeof console.log>) {
  if (isDevelopment) {
    console.log(...args);
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request);
}

function parseListedDate(value?: string | null): Date | null {
  if (!value) return null;

  // Providers (Daft, Idealista, Kamernet, Zonaprop) use dd/mm/yyyy.
  // Parse this format explicitly before falling back to the Date constructor,
  // because new Date("11/05/2026") would interpret it as mm/dd/yyyy.
  const slashMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;

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

function normalizeIncomingPrice(data: { provider: string; price?: number }) {
  if (data.price == null) return undefined;
  if (data.provider === "idealista" && data.price > 0 && data.price < 100 && !Number.isInteger(data.price)) {
    return Math.round(data.price * 1000);
  }

  return data.price;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request, { write: true });
  if (error) return withCors(error, origin);

  const { body, error: bodyError } = await readJsonBody(request);
  if (bodyError) return withCors(bodyError, origin);

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
  const price = normalizeIncomingPrice(data) ?? 0;
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

    const geocoded = await geocodeListing(
      { ...data, rawPayload: incomingRawPayload },
      debugLog
    );

    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      isApproximateLocation = true;
      geocodeQueryUsed = geocoded.query;
    } else {
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
        expenses: data.expenses ?? null,
        expensesCurrency: data.expensesCurrency ?? null,
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
        deposit: data.deposit ?? null,
        depositCurrency: data.depositCurrency ?? null,
        floor: data.floor ?? null,
        hasElevator: data.hasElevator ?? null,
        hasParking: data.hasParking ?? null,
        isFurnished: data.isFurnished ?? null,
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
      expenses: data.expenses ?? null,
      expensesCurrency: data.expensesCurrency ?? null,
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
      deposit: data.deposit ?? null,
      depositCurrency: data.depositCurrency ?? null,
      floor: data.floor ?? null,
      hasElevator: data.hasElevator ?? null,
      hasParking: data.hasParking ?? null,
      isFurnished: data.isFurnished ?? null,
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
  } else {
    const updates: { deletedAt?: null; updatedAt: Date } = { updatedAt: new Date() };
    if (existingSave[0].deletedAt != null) {
      updates.deletedAt = null;
    }
    await db
      .update(savedProperties)
      .set(updates)
      .where(eq(savedProperties.id, existingSave[0].id));
  }

  return NextResponse.json(
    { id: propertyId, status: existing.length > 0 ? "updated" : "created" },
    { headers: corsHeaders(origin) }
  );
}
