import { NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { savedProperties, properties, propertyImages, propertyPriceHistory } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth(undefined, { write: true });
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth(undefined, { write: true });
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

  if (existing[0].deletedAt == null) {
    return NextResponse.json(
      { error: "Property must be in trash before permanent deletion" },
      { status: 409 }
    );
  }

  await db
    .delete(savedProperties)
    .where(eq(savedProperties.id, existing[0].id));

  const otherSaves = await db
    .select()
    .from(savedProperties)
    .where(eq(savedProperties.propertyId, id))
    .limit(1);

  if (otherSaves.length === 0) {
    await db.delete(propertyImages).where(eq(propertyImages.propertyId, id));
    await db.delete(propertyPriceHistory).where(eq(propertyPriceHistory.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  return NextResponse.json({ deleted: true });
}
