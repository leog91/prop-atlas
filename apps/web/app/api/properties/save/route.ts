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
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        url: data.url,
        listedAt: parseListedDate(data.listedAt),
        views: data.views ?? null,
        rawPayload: data.rawPayload ?? null,
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
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      url: data.url,
      listedAt: parseListedDate(data.listedAt),
      views: data.views ?? null,
      rawPayload: data.rawPayload ?? null,
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
  }

  return NextResponse.json(
    { id: propertyId, status: existing.length > 0 ? "updated" : "created" },
    { headers: corsHeaders(origin) }
  );
}
