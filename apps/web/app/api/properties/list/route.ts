import { NextResponse } from "next/server";
import { eq, and, desc, inArray, isNull, isNotNull } from "@prop-atlas/db";
import { properties, propertyImages, savedProperties } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(50, Math.max(1, requestedLimit))
    : 20;
  const offset = (page - 1) * limit;
  const favoritesOnly = searchParams.get("favorites") === "true";
  const showDeleted = searchParams.get("deleted") === "true";

  const db = getDb();

  const conditions = [eq(savedProperties.userId, session.user.id)];
  if (showDeleted) {
    conditions.push(isNotNull(savedProperties.deletedAt));
  } else {
    conditions.push(isNull(savedProperties.deletedAt));
  }
  if (favoritesOnly) {
    conditions.push(eq(savedProperties.isFavorite, true));
  }

  const results = await db
    .select({
      property: properties,
      saved: savedProperties,
    })
    .from(savedProperties)
    .innerJoin(properties, eq(properties.id, savedProperties.propertyId))
    .where(and(...conditions))
    .orderBy(desc(savedProperties.savedAt))
    .limit(limit)
    .offset(offset);

  const propertyIds = results.map((r) => r.property.id);
  const images = propertyIds.length
    ? await db
        .select()
        .from(propertyImages)
        .where(inArray(propertyImages.propertyId, propertyIds))
    : [];

  const imagesByProperty = new Map<string, typeof images>();
  for (const img of images) {
    const list = imagesByProperty.get(img.propertyId) || [];
    list.push(img);
    imagesByProperty.set(img.propertyId, list);
  }

  const data = results.map(({ property, saved }) => ({
    ...property,
    images: (imagesByProperty.get(property.id) || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.url),
    savedAt: saved.savedAt,
    savedUpdatedAt: saved.updatedAt,
    isFavorite: saved.isFavorite,
    notes: saved.notes,
  }));

  return NextResponse.json({ data, page, limit });
}
