import { NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { savedProperties } from "@prop-atlas/db";
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
