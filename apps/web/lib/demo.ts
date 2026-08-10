import { NextResponse } from "next/server";

export const DEMO_EMAIL = "demo@propatlas.com";

export function isDemoUser(user: { email?: string | null }) {
  return user.email === DEMO_EMAIL;
}

export function demoReadOnlyResponse() {
  return NextResponse.json(
    { error: "The demo account is read-only." },
    { status: 403 }
  );
}
