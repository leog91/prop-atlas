import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "@prop-atlas/db";
import { apiKeys } from "@prop-atlas/db";
import { user } from "@prop-atlas/db";
import { getDb } from "@/lib/db";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireAuth(request?: Request) {
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const db = getDb();
      
      const apiKey = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.key, token))
        .limit(1);

      if (apiKey.length > 0) {
        const userData = await db
          .select()
          .from(user)
          .where(eq(user.id, apiKey[0].userId))
          .limit(1);

        if (userData.length > 0) {
          await db
            .update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, apiKey[0].id));

          return { session: { user: userData[0] } };
        }
      }
    }
  }

  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}
