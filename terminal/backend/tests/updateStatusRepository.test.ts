import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let setLastSuccess: typeof import("../src/services/updateStatusRepository.js").setLastSuccess;
let getUpdateStatus: typeof import("../src/services/updateStatusRepository.js").getUpdateStatus;
let listUpdateStatuses: typeof import("../src/services/updateStatusRepository.js").listUpdateStatuses;
let getDb: typeof import("../src/db.js").getDb;

beforeAll(async () => {
  await setupTestDb();
  const repo = await import("../src/services/updateStatusRepository.js");
  setLastSuccess = repo.setLastSuccess;
  getUpdateStatus = repo.getUpdateStatus;
  listUpdateStatuses = repo.listUpdateStatuses;
  const dbMod = await import("../src/db.js");
  getDb = dbMod.getDb;
});

afterAll(teardownTestDb);

describe("updateStatusRepository", () => {
  describe("setLastSuccess + getUpdateStatus", () => {
    it("should store and retrieve a status with details", async () => {
      const ts = "2026-03-06T10:00:00.000Z";
      await setLastSuccess("ibkr_ohlc_1d", ts, { tickersUpdated: 100 });

      const result = await getUpdateStatus("ibkr_ohlc_1d");
      expect(result).not.toBeNull();
      expect(result!.sourceKey).toBe("ibkr_ohlc_1d");
      expect(result!.lastSuccessAt).toBe(ts);
      expect(result!.details).toEqual({ tickersUpdated: 100 });
      expect(result!.updatedAt).toBeTruthy();
    });

    it("should upsert (overwrite) on second call", async () => {
      const ts1 = "2026-03-05T10:00:00.000Z";
      const ts2 = "2026-03-06T12:00:00.000Z";
      await setLastSuccess("finhub_news", ts1, { mode: "7d" });
      await setLastSuccess("finhub_news", ts2, { mode: "backfill" });

      const result = await getUpdateStatus("finhub_news");
      expect(result!.lastSuccessAt).toBe(ts2);
      expect(result!.details).toEqual({ mode: "backfill" });
    });

    it("should default details to {} when omitted", async () => {
      await setLastSuccess("tickers_csv", "2026-03-01T00:00:00Z");
      const result = await getUpdateStatus("tickers_csv");
      expect(result!.details).toEqual({});
    });

    it("should return null for a key that was never set", async () => {
      const result = await getUpdateStatus("nonexistent_key");
      expect(result).toBeNull();
    });
  });

  describe("listUpdateStatuses", () => {
    it("should return all 4 known SOURCE_KEYS with values or null", async () => {
      const statuses = await listUpdateStatuses();
      expect(statuses).toHaveProperty("tickers_csv");
      expect(statuses).toHaveProperty("finhub_news");
      expect(statuses).toHaveProperty("ibkr_calendar");
      expect(statuses).toHaveProperty("ibkr_ohlc_1d");
    });

    it("should return null for known keys with no row", async () => {
      // ibkr_calendar was never set in this test suite
      const statuses = await listUpdateStatuses();
      expect(statuses.ibkr_calendar).toBeNull();
    });

    it("should include extra keys that exist in DB but not in SOURCE_KEYS", async () => {
      await setLastSuccess("news_change_custom", "2026-03-06T22:00:00Z", {
        lookbackDays: 21,
      });
      const statuses = await listUpdateStatuses();
      expect(statuses).toHaveProperty("news_change_custom");
      expect(statuses.news_change_custom!.details).toEqual({ lookbackDays: 21 });
    });
  });

  describe("malformed details_json", () => {
    it("should return empty {} when details_json is invalid JSON", async () => {
      // Directly insert a row with broken JSON
      const db = getDb();
      await db.run(
        `INSERT OR REPLACE INTO update_status (source_key, last_success_at, details_json, updated_at)
         VALUES ('broken_json', '2026-01-01T00:00:00Z', '{not valid json}', datetime('now'))`,
      );

      const result = await getUpdateStatus("broken_json");
      expect(result).not.toBeNull();
      expect(result!.details).toEqual({});
    });
  });

  describe("persistence across re-read (simulated restart)", () => {
    it("should return the same value on fresh import read", async () => {
      const ts = "2026-03-06T15:00:00.000Z";
      await setLastSuccess("ibkr_ohlc_1d", ts, { test: true });

      // Re-read from the same DB — simulates a fresh module read
      const result = await getUpdateStatus("ibkr_ohlc_1d");
      expect(result!.lastSuccessAt).toBe(ts);
      expect(result!.details).toEqual({ test: true });
    });
  });
});
