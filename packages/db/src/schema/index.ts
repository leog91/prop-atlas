import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const properties = sqliteTable(
  "properties",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerListingId: text("provider_listing_id").notNull(),
    listingType: text("listing_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    price: real("price").notNull(),
    currency: text("currency").notNull().default("EUR"),
    propertyType: text("property_type").notNull(),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    area: real("area"),
    areaUnit: text("area_unit"),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    postalCode: text("postal_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    url: text("url").notNull(),
    listedAt: integer("listed_at", { mode: "timestamp" }),
    views: integer("views"),
    rawPayload: text("raw_payload", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("properties_provider_listing_idx").on(
      table.provider,
      table.providerListingId
    ),
    index("properties_listing_type_idx").on(table.listingType),
    index("properties_city_idx").on(table.city),
    index("properties_country_idx").on(table.country),
    index("properties_price_idx").on(table.price),
    index("properties_property_type_idx").on(table.propertyType),
    index("properties_created_at_idx").on(table.createdAt),
  ]
);

export const propertyImages = sqliteTable(
  "property_images",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("property_images_property_id_idx").on(table.propertyId),
  ]
);

export const savedProperties = sqliteTable(
  "saved_properties",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    notes: text("notes"),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    savedAt: integer("saved_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("saved_properties_user_property_idx").on(
      table.userId,
      table.propertyId
    ),
    index("saved_properties_user_id_idx").on(table.userId),
    index("saved_properties_is_favorite_idx").on(table.isFavorite),
  ]
);

export const propertyPriceHistory = sqliteTable(
  "property_price_history",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    price: real("price").notNull(),
    currency: text("currency").notNull().default("EUR"),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("property_price_history_property_id_idx").on(table.propertyId),
    index("property_price_history_recorded_at_idx").on(table.recordedAt),
  ]
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    name: text("name").notNull().default("Extension"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_key_idx").on(table.key),
  ]
);
