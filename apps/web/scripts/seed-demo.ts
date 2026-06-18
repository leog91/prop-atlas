import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  properties,
  propertyImages,
  savedProperties,
  propertyPriceHistory,
  apiKeys,
  user,
} from "@prop-atlas/db";
import { eq } from "@prop-atlas/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DEMO_EMAIL = "demo@propatlas.com";
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME = "Demo User";

interface DemoProperty {
  provider: string;
  providerListingId: string;
  listingType: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  expenses?: number | null;
  expensesCurrency?: string | null;
  propertyType: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  areaUnit?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  url: string;
  listedAt?: string | null;
  views?: number | null;
  deposit?: number | null;
  depositCurrency?: string | null;
  floor?: string | null;
  hasElevator?: boolean | null;
  hasParking?: boolean | null;
  isFurnished?: boolean | null;
  images: string[];
  priceHistory: Array<{
    price: number;
    currency: string;
    recordedAt: string;
  }>;
  saved: {
    isFavorite: boolean;
    notes?: string | null;
    savedAt: string;
  };
}

interface DemoData {
  properties: DemoProperty[];
}

function generateApiKey() {
  return `pak_${crypto.randomBytes(32).toString("hex")}`;
}

export async function seedDemo() {
  const db = getDb();

  // Check if demo user already exists
  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL));

  if (existingUsers.length > 0) {
    console.log("Demo user already exists. Use db:reset:demo to reset.");
    return;
  }

  // Create demo user via Better Auth
  const signUpResult = await auth.api.signUpEmail({
    body: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
  });

  const demoUserId = signUpResult.user.id;
  console.log("Created demo user:", demoUserId);

  // Create an API key for the browser extension
  const apiKey = generateApiKey();
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: demoUserId,
    key: apiKey,
    name: "Demo Extension",
  });
  console.log("Created demo API key:", apiKey);

  const dataFilePath = path.join(__dirname, "demo-data.json");
  let demoData: DemoData | null = null;

  if (fs.existsSync(dataFilePath)) {
    try {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      demoData = JSON.parse(raw) as DemoData;
      console.log(`Loaded ${demoData.properties.length} properties from demo-data.json`);
    } catch (err) {
      console.error("Failed to load demo-data.json, using fallback data.", err);
    }
  }

  if (demoData && demoData.properties.length > 0) {
    await seedFromJson(db, demoUserId, demoData);
  } else {
    await seedFallback(db, demoUserId);
  }
}

async function seedFromJson(
  db: ReturnType<typeof getDb>,
  userId: string,
  data: DemoData
) {
  const now = new Date();

  for (const prop of data.properties) {
    const propertyId = crypto.randomUUID();

    await db.insert(properties).values({
      id: propertyId,
      provider: prop.provider,
      providerListingId: prop.providerListingId,
      listingType: prop.listingType,
      title: prop.title,
      description: prop.description ?? null,
      price: prop.price,
      currency: prop.currency ?? "EUR",
      expenses: prop.expenses ?? null,
      expensesCurrency: prop.expensesCurrency ?? null,
      propertyType: prop.propertyType,
      bedrooms: prop.bedrooms ?? null,
      bathrooms: prop.bathrooms ?? null,
      area: prop.area ?? null,
      areaUnit: prop.areaUnit ?? null,
      address: prop.address ?? null,
      city: prop.city ?? null,
      country: prop.country ?? null,
      postalCode: prop.postalCode ?? null,
      latitude: prop.latitude ?? null,
      longitude: prop.longitude ?? null,
      url: prop.url,
      listedAt: prop.listedAt ? new Date(prop.listedAt) : null,
      views: prop.views ?? null,
      deposit: prop.deposit ?? null,
      depositCurrency: prop.depositCurrency ?? null,
      floor: prop.floor ?? null,
      hasElevator: prop.hasElevator ?? null,
      hasParking: prop.hasParking ?? null,
      isFurnished: prop.isFurnished ?? null,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < prop.images.length; i++) {
      await db.insert(propertyImages).values({
        id: crypto.randomUUID(),
        propertyId,
        url: prop.images[i],
        sortOrder: i,
        createdAt: now,
      });
    }

    for (const hist of prop.priceHistory) {
      await db.insert(propertyPriceHistory).values({
        id: crypto.randomUUID(),
        propertyId,
        price: hist.price,
        currency: hist.currency,
        recordedAt: new Date(hist.recordedAt),
      });
    }

    await db.insert(savedProperties).values({
      id: crypto.randomUUID(),
      userId,
      propertyId,
      isFavorite: prop.saved.isFavorite,
      notes: prop.saved.notes ?? null,
      savedAt: new Date(prop.saved.savedAt),
      updatedAt: now,
    });
  }

  console.log(`Seeded ${data.properties.length} demo properties from demo-data.json.`);
}

async function seedFallback(db: ReturnType<typeof getDb>, userId: string) {
  const now = new Date();

  const demoProperties = [
    {
      id: crypto.randomUUID(),
      provider: "idealista" as const,
      providerListingId: "demo-idealista-1",
      listingType: "rent" as const,
      title: "Bright apartment in Madrid city center",
      description: "Spacious 2-bedroom apartment with balcony, close to public transport and shops.",
      price: 1350,
      currency: "EUR",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 1,
      area: 75,
      areaUnit: "m²",
      address: "Calle de Fuencarral 123",
      city: "Madrid",
      country: "Spain",
      postalCode: "28004",
      latitude: 40.4168,
      longitude: -3.7038,
      url: "https://www.idealista.com/en/inmueble/demo-1",
      listedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
    },
    {
      id: crypto.randomUUID(),
      provider: "daft" as const,
      providerListingId: "demo-daft-1",
      listingType: "rent" as const,
      title: "Modern flat near St. Stephen's Green",
      description: "Recently renovated 1-bedroom flat with high ceilings and modern kitchen.",
      price: 2200,
      currency: "EUR",
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      area: 55,
      areaUnit: "m²",
      address: "Dublin 2",
      city: "Dublin",
      country: "Ireland",
      latitude: 53.3498,
      longitude: -6.2603,
      url: "https://www.daft.ie/property/demo-1",
      listedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
    },
    {
      id: crypto.randomUUID(),
      provider: "kamernet" as const,
      providerListingId: "demo-kamernet-1",
      listingType: "rent" as const,
      title: "Cozy room in shared house, Amsterdam West",
      description: "Furnished room in a quiet neighborhood, shared kitchen and bathroom.",
      price: 750,
      currency: "EUR",
      propertyType: "room",
      bedrooms: 1,
      bathrooms: 1,
      area: 18,
      areaUnit: "m²",
      address: "Bos en Lommerplein 10",
      city: "Amsterdam",
      country: "Netherlands",
      postalCode: "1055",
      latitude: 52.3676,
      longitude: 4.9041,
      url: "https://kamernet.nl/huren/kamer/demo-1",
      listedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7),
    },
    {
      id: crypto.randomUUID(),
      provider: "zonaprop" as const,
      providerListingId: "demo-zonaprop-1",
      listingType: "buy" as const,
      title: "Sunny 2-bedroom apartment in Palermo",
      description: "Great location with lots of natural light, ideal for investment or first home.",
      price: 185000,
      currency: "USD",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 1,
      area: 68,
      areaUnit: "m²",
      address: "Thames 2300",
      city: "Buenos Aires",
      country: "Argentina",
      postalCode: "C1425",
      latitude: -34.5889,
      longitude: -58.4303,
      url: "https://www.zonaprop.com.ar/propiedades/demo-1",
      listedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
    },
    {
      id: crypto.randomUUID(),
      provider: "idealista" as const,
      providerListingId: "demo-idealista-2",
      listingType: "buy" as const,
      title: "Penthouse with terrace in Barcelona",
      description: "Stunning penthouse with private terrace and sea views in a modern building.",
      price: 450000,
      currency: "EUR",
      propertyType: "penthouse",
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
      areaUnit: "m²",
      address: "Carrer de Mallorca 456",
      city: "Barcelona",
      country: "Spain",
      postalCode: "08037",
      latitude: 41.3851,
      longitude: 2.1734,
      url: "https://www.idealista.com/en/inmueble/demo-2",
      listedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
    },
  ];

  for (const prop of demoProperties) {
    await db.insert(properties).values({
      ...prop,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(savedProperties).values({
      id: crypto.randomUUID(),
      userId,
      propertyId: prop.id,
      isFavorite: prop.title.includes("Madrid") || prop.title.includes("Palermo"),
      notes: prop.title.includes("Madrid") ? "Close to metro, need to schedule a viewing." : null,
      savedAt: now,
      updatedAt: now,
    });
  }

  const propertyImagesData = [
    { propertyIndex: 0, urls: ["https://picsum.photos/id/1015/800/600", "https://picsum.photos/id/1016/800/600"] },
    { propertyIndex: 1, urls: ["https://picsum.photos/id/1021/800/600", "https://picsum.photos/id/1022/800/600"] },
    { propertyIndex: 2, urls: ["https://picsum.photos/id/1031/800/600"] },
    { propertyIndex: 3, urls: ["https://picsum.photos/id/1040/800/600", "https://picsum.photos/id/1041/800/600"] },
    { propertyIndex: 4, urls: ["https://picsum.photos/id/1050/800/600", "https://picsum.photos/id/1051/800/600", "https://picsum.photos/id/1052/800/600"] },
  ];

  for (const { propertyIndex, urls } of propertyImagesData) {
    const propertyId = demoProperties[propertyIndex].id;
    for (let i = 0; i < urls.length; i++) {
      await db.insert(propertyImages).values({
        id: crypto.randomUUID(),
        propertyId,
        url: urls[i],
        sortOrder: i,
        createdAt: now,
      });
    }
  }

  await db.insert(propertyPriceHistory).values([
    {
      id: crypto.randomUUID(),
      propertyId: demoProperties[3].id,
      price: 195000,
      currency: "USD",
      recordedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30),
    },
    {
      id: crypto.randomUUID(),
      propertyId: demoProperties[3].id,
      price: 185000,
      currency: "USD",
      recordedAt: now,
    },
    {
      id: crypto.randomUUID(),
      propertyId: demoProperties[4].id,
      price: 475000,
      currency: "EUR",
      recordedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 20),
    },
    {
      id: crypto.randomUUID(),
      propertyId: demoProperties[4].id,
      price: 450000,
      currency: "EUR",
      recordedAt: now,
    },
  ]);

  console.log(`Seeded ${demoProperties.length} fallback demo properties.`);
}

if ((import.meta as unknown as { main?: boolean }).main) {
  seedDemo()
    .then(() => {
      console.log("Demo seed complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Demo seed failed:", err);
      process.exit(1);
    });
}
