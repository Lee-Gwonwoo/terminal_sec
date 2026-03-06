import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let deleteMockCalendarRows: typeof import("../src/services/calendarRepository.js").deleteMockCalendarRows;
let getDb: typeof import("../src/db.js").getDb;

beforeAll(async () => {
  await setupTestDb();
  const calRepo = await import("../src/services/calendarRepository.js");
  deleteMockCalendarRows = calRepo.deleteMockCalendarRows;
  const dbMod = await import("../src/db.js");
  getDb = dbMod.getDb;
});

afterAll(teardownTestDb);

async function insertCalendarEvent(
  id: string,
  source: string,
  eventType = "earnings",
  ticker = "AAPL",
) {
  await getDb().run(
    `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
     VALUES (?, ?, ?, ?, datetime('now'), '{}', ?, ?)`,
    [id, eventType, ticker, `Event ${id}`, source, `key_${id}`],
  );
}

async function countBySource(source: string): Promise<number> {
  const row = await getDb().get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM calendar_events WHERE source = ?`,
    [source],
  );
  return row?.cnt ?? 0;
}

describe("calendarRepository — deleteMockCalendarRows", () => {
  it("should delete mock_provider rows and return count", async () => {
    // Insert some mock rows
    await insertCalendarEvent("mock1", "mock_provider");
    await insertCalendarEvent("mock2", "mock_provider");
    await insertCalendarEvent("mock3", "mock_provider");

    expect(await countBySource("mock_provider")).toBe(3);

    const deleted = await deleteMockCalendarRows();
    expect(deleted).toBe(3);
    expect(await countBySource("mock_provider")).toBe(0);
  });

  it("should NOT delete rows from other sources", async () => {
    // Insert a real row and a mock row
    await insertCalendarEvent("real1", "ibkr", "earnings", "MSFT");
    await insertCalendarEvent("mock4", "mock_provider");

    const deleted = await deleteMockCalendarRows();
    expect(deleted).toBe(1);

    // Real row still exists
    expect(await countBySource("ibkr")).toBe(1);
  });

  it("should be idempotent — second call returns 0", async () => {
    // No mock_provider rows at this point (all cleaned above)
    const deleted = await deleteMockCalendarRows();
    expect(deleted).toBe(0);
  });

  it("should work with empty table", async () => {
    // Clear all rows
    await getDb().run("DELETE FROM calendar_events");
    const deleted = await deleteMockCalendarRows();
    expect(deleted).toBe(0);
  });
});
