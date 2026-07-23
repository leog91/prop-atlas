import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { demoReadOnlyResponse, isDemoUser } from "@/lib/demo";
import { pageSnapshots } from "@prop-atlas/db";
import { eq, and } from "@prop-atlas/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { session, error } = await requireAuth(request);
  if (error) return error;
  if (isDemoUser(session.user)) return demoReadOnlyResponse();

  const { id } = await params;
  const db = getDb();

  const existing = await db
    .select()
    .from(pageSnapshots)
    .where(
      and(
        eq(pageSnapshots.id, id),
        eq(pageSnapshots.userId, session.user.id)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .delete(pageSnapshots)
    .where(eq(pageSnapshots.id, id));

  return NextResponse.json({ deleted: true });
}
