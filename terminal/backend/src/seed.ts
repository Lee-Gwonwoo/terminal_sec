import { getDb } from "./db.js";

export async function ensureSeedData(): Promise<void> {
  const db = getDb();
  await db.run(
    `INSERT OR IGNORE INTO users (id, email)
     VALUES (?, ?)`,
    ["11111111-1111-1111-1111-111111111111", "demo@local"]
  );
}
