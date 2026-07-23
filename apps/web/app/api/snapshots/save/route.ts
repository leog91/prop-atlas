import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { corsHeaders, corsPreflightResponse } from "@/lib/cors";
import { demoReadOnlyResponse, isDemoUser } from "@/lib/demo";
import { pageSnapshots } from "@prop-atlas/db";
import { z } from "zod";
import crypto from "crypto";

const isDevelopment = process.env.NODE_ENV === "development";

function debugLog(...args: Parameters<typeof console.log>) {
  if (isDevelopment) {
    console.log(...args);
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request);
}

const snapshotSchema = z.object({
  provider: z.string().min(1),
  url: z.string().url(),
  snapshot: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const { session, error } = await requireAuth(request);
  if (error) {
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => error.headers.set(key, value));
    return error;
  }
  if (isDemoUser(session.user)) return demoReadOnlyResponse();

  const body = await request.json();
  debugLog("[SNAPSHOT SAVE] Received payload:", JSON.stringify(body, null, 2));

  const parsed = snapshotSchema.safeParse(body);
  if (!parsed.success) {
    debugLog("[SNAPSHOT SAVE] Validation errors:", JSON.stringify(parsed.error.flatten(), null, 2));
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const data = parsed.data;
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(pageSnapshots).values({
    id,
    userId: session.user.id,
    provider: data.provider,
    url: data.url,
    snapshot: data.snapshot,
  });

  debugLog("[SNAPSHOT SAVE] Saved snapshot:", id);
  return NextResponse.json(
    { id, status: "created" },
    { headers: corsHeaders(origin) }
  );
}
