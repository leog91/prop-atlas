import { NextResponse } from "next/server";
import { eq, and, isNotNull } from "@prop-atlas/db";
import { properties, savedProperties } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import {
  getLocationPrecision,
  parsePropertyFilters,
  propertyFilterCondition,
} from "@/lib/property-filters";

/**
 * Upper bound on markers returned in one response. Leaflet degrades well before
 * this many pins, and it keeps the payload predictable.
 */
const MAX_MARKERS = 1000;

/**
 * Markers for the dashboard map. Kept out of the initial page render because it
 * spans every listing matching the filters, not just the current page.
 */
export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const filters = parsePropertyFilters(searchParams);

  const db = getDb();

  const rows = await db
    .select({
      id: properties.id,
      title: properties.title,
      price: properties.price,
      currency: properties.currency,
      latitude: properties.latitude,
      longitude: properties.longitude,
      city: properties.city,
      listingType: properties.listingType,
      url: properties.url,
      rawPayload: properties.rawPayload,
    })
    .from(savedProperties)
    .innerJoin(properties, eq(properties.id, savedProperties.propertyId))
    .where(
      and(
        propertyFilterCondition(session.user.id, filters),
        isNotNull(properties.latitude),
        isNotNull(properties.longitude)
      )
    )
    .limit(MAX_MARKERS);

  // rawPayload can be a large provider blob; only the precision hints reach the client.
  const markers = rows.map(({ rawPayload, ...marker }) => ({
    ...marker,
    ...getLocationPrecision(rawPayload),
  }));

  return NextResponse.json({ markers });
}
