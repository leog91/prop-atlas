import { z } from "zod";

export const PropertyType = {
  APARTMENT: "apartment",
  HOUSE: "house",
  STUDIO: "studio",
  ROOM: "room",
  COMMERCIAL: "commercial",
  LAND: "land",
  OTHER: "other",
} as const;

export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const ListingType = {
  RENT: "rent",
  BUY: "buy",
} as const;

export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const Provider = {
  DAFT: "daft",
  IDEALISTA: "idealista",
  KAMERNET: "kamernet",
  ZONAPROP: "zonaprop",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

export const propertySchema = z.object({
  provider: z.enum([
    Provider.DAFT,
    Provider.IDEALISTA,
    Provider.KAMERNET,
    Provider.ZONAPROP,
  ]),
  providerListingId: z.string().min(1),
  listingType: z.enum([ListingType.RENT, ListingType.BUY]),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().length(3).default("EUR"),
  propertyType: z.enum([
    PropertyType.APARTMENT,
    PropertyType.HOUSE,
    PropertyType.STUDIO,
    PropertyType.ROOM,
    PropertyType.COMMERCIAL,
    PropertyType.LAND,
    PropertyType.OTHER,
  ]),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  area: z.number().positive().optional(),
  areaUnit: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  images: z.array(z.string().url()).optional(),
  url: z.string().url(),
  listedAt: z.string().optional(),
  views: z.number().int().nonnegative().optional(),
  rawPayload: z.record(z.unknown()).optional(),
});

export type ParsedProperty = z.infer<typeof propertySchema>;

export interface ProviderParser {
  readonly name: Provider;
  canHandle(url: string): boolean;
  parse(document: Document): ParsedProperty | null;
}

export interface SavedProperty {
  id: string;
  userId: string;
  propertyId: string;
  notes: string | null;
  isFavorite: boolean;
  savedAt: Date;
  updatedAt: Date;
}

export interface PropertyPriceHistory {
  id: string;
  propertyId: string;
  price: number;
  currency: string;
  recordedAt: Date;
}
