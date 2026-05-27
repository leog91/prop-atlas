import { createDb } from "@prop-atlas/db";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb(
      process.env.TURSO_DATABASE_URL!,
      process.env.TURSO_AUTH_TOKEN
    );
  }
  return db;
}
