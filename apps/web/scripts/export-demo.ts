import { getDb } from "@/lib/db";
import {
  properties,
  savedProperties,
  propertyImages,
  propertyPriceHistory,
  user,
} from "@prop-atlas/db";
import { eq, asc } from "@prop-atlas/db";
import fs from "fs";
import path from "path";

const DEMO_EMAIL = "demo@propatlas.com";

async function exportDemo() {
  const db = getDb();

  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL));

  if (existingUsers.length === 0) {
    console.error("Demo user not found. Run bun run db:seed:demo first.");
    process.exit(1);
  }

  const demoUserId = existingUsers[0].id;

  const saved = await db
    .select()
    .from(savedProperties)
    .where(eq(savedProperties.userId, demoUserId));

  if (saved.length === 0) {
    console.log("No saved properties for demo user. Nothing to export.");
    return;
  }

  const propertyIds = saved.map((s) => s.propertyId);

  // Drizzle `inArray` is cleaner; using loop for compatibility
  const propertyRows: (typeof properties.$inferSelect)[] = [];
  for (const id of propertyIds) {
    const rows = await db.select().from(properties).where(eq(properties.id, id));
    if (rows.length > 0) propertyRows.push(rows[0]);
  }

  const allImages: (typeof propertyImages.$inferSelect)[] = [];
  for (const id of propertyIds) {
    const rows = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, id))
      .orderBy(asc(propertyImages.sortOrder));
    allImages.push(...rows);
  }

  const allPriceHistory: (typeof propertyPriceHistory.$inferSelect)[] = [];
  for (const id of propertyIds) {
    const rows = await db
      .select()
      .from(propertyPriceHistory)
      .where(eq(propertyPriceHistory.propertyId, id))
      .orderBy(asc(propertyPriceHistory.recordedAt));
    allPriceHistory.push(...rows);
  }

  const imagesByProperty = new Map<string, string[]>();
  for (const img of allImages) {
    const list = imagesByProperty.get(img.propertyId) || [];
    list.push(img.url);
    imagesByProperty.set(img.propertyId, list);
  }

  const priceHistoryByProperty = new Map<string, typeof allPriceHistory>();
  for (const hist of allPriceHistory) {
    const list = priceHistoryByProperty.get(hist.propertyId) || [];
    list.push(hist);
    priceHistoryByProperty.set(hist.propertyId, list);
  }

  const savedByProperty = new Map(saved.map((s) => [s.propertyId, s]));

  const output = {
    properties: propertyRows.map((prop) => {
      const savedRow = savedByProperty.get(prop.id);
      return {
        provider: prop.provider,
        providerListingId: prop.providerListingId,
        listingType: prop.listingType,
        title: prop.title,
        description: prop.description,
        price: prop.price,
        currency: prop.currency,
        expenses: prop.expenses,
        expensesCurrency: prop.expensesCurrency,
        propertyType: prop.propertyType,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        area: prop.area,
        areaUnit: prop.areaUnit,
        address: prop.address,
        city: prop.city,
        country: prop.country,
        postalCode: prop.postalCode,
        latitude: prop.latitude,
        longitude: prop.longitude,
        url: prop.url,
        listedAt: prop.listedAt?.toISOString() ?? null,
        views: prop.views,
        deposit: prop.deposit,
        depositCurrency: prop.depositCurrency,
        floor: prop.floor,
        hasElevator: prop.hasElevator,
        hasParking: prop.hasParking,
        isFurnished: prop.isFurnished,
        images: imagesByProperty.get(prop.id) || [],
        priceHistory: (priceHistoryByProperty.get(prop.id) || []).map((h) => ({
          price: h.price,
          currency: h.currency,
          recordedAt: h.recordedAt.toISOString(),
        })),
        saved: {
          isFavorite: savedRow?.isFavorite ?? false,
          notes: savedRow?.notes ?? null,
          savedAt: savedRow?.savedAt.toISOString() ?? new Date().toISOString(),
        },
      };
    }),
  };

  const outputPath = path.join(__dirname, "demo-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`Exported ${output.properties.length} properties to ${outputPath}`);
}

exportDemo()
  .then(() => {
    console.log("Demo export complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Demo export failed:", err);
    process.exit(1);
  });
