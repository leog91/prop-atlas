import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "@prop-atlas/db";
import { apiKeys } from "@prop-atlas/db";
import { user } from "@prop-atlas/db";
import { getDb } from "@/lib/db";
import { demoReadOnlyResponse, isDemoUser } from "@/lib/demo";
import { hashApiKey } from "@/lib/api-keys";

/** How stale `lastUsedAt` may get before it is rewritten, to avoid a write per request. */
const LAST_USED_REFRESH_MS = 60 * 60 * 1000;

type AuthUser = typeof user.$inferSelect;

type AuthOutcome =
  | { session: { user: AuthUser }; error?: undefined }
  | { session?: undefined; error: NextResponse };

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function authenticateApiKey(token: string): Promise<AuthUser | null> {
  const db = getDb();

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(token)))
    .limit(1);

  if (!apiKey) return null;

  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, apiKey.userId))
    .limit(1);

  if (!userData) return null;

  const lastUsedAt = apiKey.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - lastUsedAt > LAST_USED_REFRESH_MS) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));
  }

  return userData;
}

/**
 * Authenticates a request via API key or web session.
 *
 * A Bearer token is authoritative: if one is present it decides the request
 * outright, rather than falling through to a cookie session when it is invalid.
 *
 * Pass `write: true` on any route that mutates data. The shared demo account is
 * rejected there by default, so a new mutating route is read-only-safe even if
 * its author forgets about the demo.
 */
export async function requireAuth(
  request?: Request,
  { write = false }: { write?: boolean } = {}
): Promise<AuthOutcome> {
  const authHeader = request?.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const authUser = await authenticateApiKey(authHeader.slice(7));
    if (!authUser) return { error: unauthorized() };
    if (write && isDemoUser(authUser)) return { error: demoReadOnlyResponse() };
    return { session: { user: authUser } };
  }

  const session = await getSession();
  if (!session) return { error: unauthorized() };
  if (write && isDemoUser(session.user)) return { error: demoReadOnlyResponse() };

  return { session: { user: session.user as AuthUser } };
}
