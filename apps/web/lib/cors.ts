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

export function corsPreflightResponse(request: NextRequest, methods = "POST, OPTIONS") {
  const headers = corsHeaders(request.headers.get("origin"));
  if (!("Access-Control-Allow-Origin" in headers)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/** Copies the allowlisted CORS headers onto a response built elsewhere (e.g. an auth error). */
export function withCors<T extends Response>(response: T, origin: string | null): T {
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, value);
  }
  return response;
}
