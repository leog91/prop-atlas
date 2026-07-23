import { NextResponse } from "next/server";
import { eq } from "@prop-atlas/db";
import { apiKeys } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { demoReadOnlyResponse, isDemoUser } from "@/lib/demo";
import crypto from "crypto";

export async function POST() {
  const { session, error } = await requireAuth();
  if (error) return error;
  if (isDemoUser(session.user)) return demoReadOnlyResponse();

  const db = getDb();

  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ key: existing[0].key });
  }

  const key = `pak_${crypto.randomBytes(32).toString("hex")}`;

  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    key,
  });

  return NextResponse.json({ key });
}

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  if (isDemoUser(session.user)) return NextResponse.json({ key: null, demo: true });

  const db = getDb();

  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ key: null });
  }

  return NextResponse.json({ key: existing[0].key });
}
