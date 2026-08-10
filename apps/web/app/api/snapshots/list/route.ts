import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { corsHeaders, corsPreflightResponse, withCors } from "@/lib/cors";
import { pageSnapshots } from "@prop-atlas/db";
import { eq, and, desc } from "@prop-atlas/db";

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request, "GET, OPTIONS");
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request);
  if (error) return withCors(error, origin);

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  const db = getDb();

  const conditions = [eq(pageSnapshots.userId, session.user.id)];
  if (provider) {
    conditions.push(eq(pageSnapshots.provider, provider));
  }

  const snapshots = await db
    .select()
    .from(pageSnapshots)
    .where(and(...conditions))
    .orderBy(desc(pageSnapshots.createdAt));

  return NextResponse.json({ snapshots }, { headers: corsHeaders(origin) });
}
