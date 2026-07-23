import { NextRequest, NextResponse } from "next/server";

function allowedOrigins() {
  return new Set(
    (process.env.ALLOWED_CORS_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Expose-Headers": "Content-Length",
    Vary: "Origin",
  };
}

export function corsPreflightResponse(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  if (!("Access-Control-Allow-Origin" in headers)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
