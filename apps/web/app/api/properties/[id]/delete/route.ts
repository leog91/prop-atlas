import { NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { savedProperties, properties, propertyImages, propertyPriceHistory } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const db = getDb();

  const existing = await db
    .select()
    .from(savedProperties)
    .where(
      and(
        eq(savedProperties.userId, session.user.id),
        eq(savedProperties.propertyId, id)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = existing[0];
  const isDeleted = current.deletedAt != null;

  await db
    .update(savedProperties)
    .set({
      deletedAt: isDeleted ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(savedProperties.id, current.id));

  return NextResponse.json({ deleted: !isDeleted });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const db = getDb();

  // Delete the saved_properties record for this user
  await db
    .delete(savedProperties)
    .where(
      and(
        eq(savedProperties.userId, session.user.id),
        eq(savedProperties.propertyId, id)
      )
    );

  // Check if any other users have this property saved
  const otherSaves = await db
    .select()
    .from(savedProperties)
    .where(eq(savedProperties.propertyId, id))
    .limit(1);

  // If no other users have it, delete the property and related data
  if (otherSaves.length === 0) {
    await db.delete(propertyImages).where(eq(propertyImages.propertyId, id));
    await db.delete(propertyPriceHistory).where(eq(propertyPriceHistory.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  return NextResponse.json({ deleted: true });
}
