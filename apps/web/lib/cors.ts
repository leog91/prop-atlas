import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "chrome-extension://",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some(
    (allowed) => origin.startsWith(allowed)
  );
}

export function withCors(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = await handler(req);

    if (isAllowedOrigin(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin || "*");
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Expose-Headers", "Content-Length");
    }

    return response;
  };
}
