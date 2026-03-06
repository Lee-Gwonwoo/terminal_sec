/**
 * Shared test helper: initializes a temp SQLite DB via the app's initDb().
 * Must be called in beforeAll() before importing any service that uses getDb().
 *
 * Usage:
 *   import { setupTestDb, teardownTestDb } from "./setupTestDb.js";
 *   beforeAll(setupTestDb);
 *   afterAll(teardownTestDb);
 */
import { vi } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const tmpDbPath = path.join(
  os.tmpdir(),
  `test_app_${crypto.randomUUID().slice(0, 8)}.db`,
);

// Override config before any service import resolves it
vi.mock("../src/config.js", () => ({
  config: {
    port: 8080,
    sqlitePath: tmpDbPath,
    frontendOrigin: "http://localhost:5174",
    finnhubApiKey: "TEST_KEY_DO_NOT_USE",
  },
}));

export async function setupTestDb() {
  const { initDb } = await import("../src/db.js");
  await initDb();
}

export async function teardownTestDb() {
  const { getDb } = await import("../src/db.js");
  try {
    const db = getDb();
    await db.close();
  } catch {
    // Already closed or not initialized
  }
  try {
    fs.unlinkSync(tmpDbPath);
  } catch {
    // File already deleted
  }
}
