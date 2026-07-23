import { createDb, account, and, eq, properties, propertyImages, propertyPriceHistory, savedProperties, user } from "@prop-atlas/db";

const sourceDb = createDb("file:../../packages/db/local.db");

const targetUrl = process.env.TARGET_TURSO_DATABASE_URL;
const targetToken = process.env.TARGET_TURSO_AUTH_TOKEN;

if (!targetUrl || !targetToken) {
  throw new Error("Set TARGET_TURSO_DATABASE_URL and TARGET_TURSO_AUTH_TOKEN.");
}

if (process.env.CONFIRM_IMPORT !== "production") {
  throw new Error("Set CONFIRM_IMPORT=production to import data.");
}

const targetDb = createDb(targetUrl, targetToken);

async function importLocalData() {
  const [sourceUsers, sourceAccounts, sourceProperties, sourceImages, sourceHistory, sourceSaves] = await Promise.all([
    sourceDb.select().from(user),
    sourceDb.select().from(account),
    sourceDb.select().from(properties),
    sourceDb.select().from(propertyImages),
    sourceDb.select().from(propertyPriceHistory),
    sourceDb.select().from(savedProperties),
  ]);

  const userIds = new Map<string, string>();
  const importedUserIds = new Set<string>();

  for (const sourceUser of sourceUsers) {
    const existing = await targetDb.select().from(user).where(eq(user.email, sourceUser.email)).limit(1);
    if (existing.length > 0) {
      userIds.set(sourceUser.id, existing[0].id);
      continue;
    }

    await targetDb.insert(user).values(sourceUser);
    userIds.set(sourceUser.id, sourceUser.id);
    importedUserIds.add(sourceUser.id);
  }

  for (const sourceAccount of sourceAccounts) {
    if (!importedUserIds.has(sourceAccount.userId)) continue;
    await targetDb.insert(account).values(sourceAccount).onConflictDoNothing();
  }

  const propertyIds = new Map<string, string>();
  const importedPropertyIds = new Set<string>();

  for (const sourceProperty of sourceProperties) {
    const existing = await targetDb
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.provider, sourceProperty.provider),
          eq(properties.providerListingId, sourceProperty.providerListingId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      propertyIds.set(sourceProperty.id, existing[0].id);
      continue;
    }

    await targetDb.insert(properties).values(sourceProperty);
    propertyIds.set(sourceProperty.id, sourceProperty.id);
    importedPropertyIds.add(sourceProperty.id);
  }

  for (const image of sourceImages) {
    if (!importedPropertyIds.has(image.propertyId)) continue;
    await targetDb.insert(propertyImages).values(image).onConflictDoNothing();
  }

  for (const history of sourceHistory) {
    if (!importedPropertyIds.has(history.propertyId)) continue;
    await targetDb.insert(propertyPriceHistory).values(history).onConflictDoNothing();
  }

  let importedSaves = 0;
  for (const sourceSave of sourceSaves) {
    const userId = userIds.get(sourceSave.userId);
    const propertyId = propertyIds.get(sourceSave.propertyId);
    if (!userId || !propertyId) continue;

    const existing = await targetDb
      .select()
      .from(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId)
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    await targetDb.insert(savedProperties).values({ ...sourceSave, userId, propertyId });
    importedSaves++;
  }

  console.log(
    JSON.stringify({
      importedUsers: importedUserIds.size,
      importedProperties: importedPropertyIds.size,
      importedImages: sourceImages.filter((image) => importedPropertyIds.has(image.propertyId)).length,
      importedPriceHistory: sourceHistory.filter((history) => importedPropertyIds.has(history.propertyId)).length,
      importedSaves,
      skipped: ["sessions", "apiKeys", "pageSnapshots", "verification"],
    })
  );
}

importLocalData().catch((error) => {
  console.error("Local data import failed:", error);
  process.exit(1);
});
