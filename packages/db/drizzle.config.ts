import type { Config } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const isLocal = url.startsWith("file:");

export default {
  schema: "./src/schema/all.ts",
  out: "./drizzle",
  dialect: isLocal ? "sqlite" : "turso",
  dbCredentials: isLocal
    ? { url }
    : {
        url,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      },
} satisfies Config;
