import { NextResponse } from "next/server";
import { eq } from "@prop-atlas/db";
import { apiKeys } from "@prop-atlas/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { isDemoUser } from "@/lib/demo";
import { generateApiKey } from "@/lib/api-keys";
import crypto from "crypto";

/**
 * Issues a new API key, replacing any existing one. Only the hash is stored, so
 * the raw key in this response is the only time it is ever available.
 */
export async function POST() {
  const { session, error } = await requireAuth(undefined, { write: true });
  if (error) return error;

  const db = getDb();
  const { key, keyHash, keyPrefix } = generateApiKey();

  await db.delete(apiKeys).where(eq(apiKeys.userId, session.user.id));
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    keyHash,
    keyPrefix,
  });

  return NextResponse.json({ key, keyPrefix });
}

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;
  if (isDemoUser(session.user)) {
    return NextResponse.json({ keyPrefix: null, demo: true });
  }

  const db = getDb();

  const [existing] = await db
    .select({ keyPrefix: apiKeys.keyPrefix, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .limit(1);

  return NextResponse.json({
    keyPrefix: existing?.keyPrefix ?? null,
    createdAt: existing?.createdAt ?? null,
  });
}
