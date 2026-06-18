import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { pageSnapshots } from "@prop-atlas/db";
import { eq, desc } from "@prop-atlas/db";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request);
  if (error) {
    error.headers.set("Access-Control-Allow-Origin", origin || "*");
    error.headers.set("Access-Control-Allow-Credentials", "true");
    return error;
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  const db = getDb();

  const query = db
    .select()
    .from(pageSnapshots)
    .where(eq(pageSnapshots.userId, session.user.id))
    .orderBy(desc(pageSnapshots.createdAt));

  // Note: drizzle-orm SQLite doesn't support dynamic where easily without conditions.
  // For simplicity, we filter in memory or use raw sql. Given small dataset, in-memory is fine.
  // A cleaner way is to use sql`${and(...)}` but let's keep it simple.
  const rows = await query;

  const filtered = provider
    ? rows.filter((r) => r.provider === provider)
    : rows;

  return NextResponse.json(
    { snapshots: filtered },
    { headers: corsHeaders(origin) }
  );
}
