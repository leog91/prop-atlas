import { eq, and, like, isNull, isNotNull } from "@prop-atlas/db";
import { properties, savedProperties } from "@prop-atlas/db";

export interface PropertyFilters {
  favoritesOnly: boolean;
  showDeleted: boolean;
  search: string;
  listingType: string;
  provider: string;
}

type ParamSource = URLSearchParams | Record<string, string | undefined>;

function read(params: ParamSource, key: string) {
  return (params instanceof URLSearchParams ? params.get(key) : params[key]) || "";
}

export function parsePropertyFilters(params: ParamSource): PropertyFilters {
  return {
    favoritesOnly: read(params, "favorites") === "true",
    showDeleted: read(params, "deleted") === "true",
    search: read(params, "search"),
    listingType: read(params, "listingType"),
    provider: read(params, "provider"),
  };
}

/**
 * Builds the WHERE clause shared by the dashboard, its map, and any other view
 * of a user's saved properties, so the filters cannot drift between them.
 */
export function propertyFilterCondition(userId: string, filters: PropertyFilters) {
  const conditions = [
    eq(savedProperties.userId, userId),
    filters.showDeleted
      ? isNotNull(savedProperties.deletedAt)
      : isNull(savedProperties.deletedAt),
  ];

  if (filters.favoritesOnly) {
    conditions.push(eq(savedProperties.isFavorite, true));
  }
  if (filters.search) {
    conditions.push(like(properties.title, `%${filters.search}%`));
  }
  if (filters.listingType) {
    conditions.push(eq(properties.listingType, filters.listingType));
  }
  if (filters.provider) {
    conditions.push(eq(properties.provider, filters.provider));
  }

  return and(...conditions);
}

/** Fields MapView derives from a listing's raw provider payload. */
export function getLocationPrecision(rawPayload: unknown) {
  const payload = rawPayload as Record<string, unknown> | null | undefined;
  const radius = Number(payload?.locationRadiusMeters);

  return {
    isApproximate:
      payload?.isApproximateLocation === true ||
      payload?.locationPrecision === "approximate",
    radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : null,
  };
}
