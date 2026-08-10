import { NextResponse } from "next/server";

/**
 * Reads a JSON request body without letting a malformed payload escape as an
 * unhandled 500. Callers get a ready-made 400 to return instead.
 */
export async function readJsonBody(
  request: Request
): Promise<{ body: unknown; error?: undefined } | { body?: undefined; error: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      ),
    };
  }
}
