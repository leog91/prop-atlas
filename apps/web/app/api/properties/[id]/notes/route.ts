import { NextResponse } from "next/server";
import { eq, and } from "@prop-atlas/db";
import { savedProperties } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { demoReadOnlyResponse, isDemoUser } from "@/lib/demo";
import { z } from "zod";

const notesSchema = z.object({
  notes: z.string().max(2000).nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;
  if (isDemoUser(session.user)) return demoReadOnlyResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = notesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

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
    return NextResponse.json({ error: "Property not saved" }, { status: 404 });
  }

  const updated = await db
    .update(savedProperties)
    .set({
      notes: parsed.data.notes,
      updatedAt: new Date(),
    })
    .where(eq(savedProperties.id, existing[0].id))
    .returning();

  return NextResponse.json({ notes: updated[0].notes });
}
