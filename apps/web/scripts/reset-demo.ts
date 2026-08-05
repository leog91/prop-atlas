import { getDb } from "@/lib/db";
import {
  properties,
  savedProperties,
  propertyImages,
  propertyPriceHistory,
  user,
  apiKeys,
  pageSnapshots,
  verification,
} from "@prop-atlas/db";
import { eq, inArray } from "@prop-atlas/db";
import { seedDemo } from "./seed-demo";

const DEMO_EMAIL = "demo@propatlas.com";

async function resetDemo() {
  const db = getDb();

  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL));

  const existingUser = existingUsers[0];

  if (!existingUser) {
    console.log("No demo user found. Running seed directly...");
    await seedDemo();
    return;
  }

  console.log("Resetting demo user:", existingUser.id);

  // Find properties linked to the demo user
  const saved = await db
    .select({ propertyId: savedProperties.propertyId })
    .from(savedProperties)
    .where(eq(savedProperties.userId, existingUser.id));

  const propertyIds = saved.map((s) => s.propertyId);
  const sharedPropertyIds = propertyIds.length > 0
    ? await db
        .select({
          propertyId: savedProperties.propertyId,
          userId: savedProperties.userId,
        })
        .from(savedProperties)
        .where(inArray(savedProperties.propertyId, propertyIds))
    : [];
  const sharedPropertyIdSet = new Set(
    sharedPropertyIds
      .filter(({ userId }) => userId !== existingUser.id)
      .map(({ propertyId }) => propertyId)
  );
  const demoOnlyPropertyIds = propertyIds.filter((id) => !sharedPropertyIdSet.has(id));

  // Delete user-related records
  await db.delete(apiKeys).where(eq(apiKeys.userId, existingUser.id));
  await db.delete(pageSnapshots).where(eq(pageSnapshots.userId, existingUser.id));
  await db.delete(verification).where(eq(verification.identifier, DEMO_EMAIL));
  // savedProperties, sessions, accounts will cascade when user is deleted
  await db.delete(user).where(eq(user.id, existingUser.id));

  // Preserve globally shared properties that another account has also saved.
  if (demoOnlyPropertyIds.length > 0) {
    await db.delete(propertyPriceHistory).where(inArray(propertyPriceHistory.propertyId, demoOnlyPropertyIds));
    await db.delete(propertyImages).where(inArray(propertyImages.propertyId, demoOnlyPropertyIds));
    await db.delete(properties).where(inArray(properties.id, demoOnlyPropertyIds));
  }

  console.log("Demo data cleared. Re-seeding...");
  await seedDemo();
}

resetDemo()
  .then(() => {
    console.log("Demo reset complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Demo reset failed:", err);
    process.exit(1);
  });
