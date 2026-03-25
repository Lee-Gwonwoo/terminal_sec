import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let listWatchlists: typeof import("../src/services/watchlistRepository.js").listWatchlists;
let createWatchlist: typeof import("../src/services/watchlistRepository.js").createWatchlist;
let updateWatchlist: typeof import("../src/services/watchlistRepository.js").updateWatchlist;
let deleteWatchlist: typeof import("../src/services/watchlistRepository.js").deleteWatchlist;
let getDb: typeof import("../src/db.js").getDb;

const USER_ID = "11111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  await setupTestDb();
  const repo = await import("../src/services/watchlistRepository.js");
  listWatchlists = repo.listWatchlists;
  createWatchlist = repo.createWatchlist;
  updateWatchlist = repo.updateWatchlist;
  deleteWatchlist = repo.deleteWatchlist;
  const dbMod = await import("../src/db.js");
  getDb = dbMod.getDb;
  await getDb().run(
    `INSERT INTO users (id, email) VALUES (?, ?)`,
    [USER_ID, "watchlist-test@example.com"],
  );
});

afterAll(teardownTestDb);

describe("watchlistRepository", () => {
  it("creates and lists a persisted watchlist", async () => {
    const created = await createWatchlist(USER_ID, "Growth", ["aapl", "msft"], false);
    expect(created.name).toBe("Growth");
    expect(created.tickers).toEqual(["AAPL", "MSFT"]);

    const rows = await listWatchlists(USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Growth");
    expect(rows[0].tickers).toEqual(["AAPL", "MSFT"]);
    expect(rows[0].security_ids).toHaveLength(2);
  });

  it("updates name and ticker composition", async () => {
    const rows = await listWatchlists(USER_ID);
    const updated = await updateWatchlist(USER_ID, rows[0].id, "Growth Updated", ["nvda"], false);

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Growth Updated");
    expect(updated!.tickers).toEqual(["NVDA"]);

    const refreshed = await listWatchlists(USER_ID);
    expect(refreshed[0].name).toBe("Growth Updated");
    expect(refreshed[0].tickers).toEqual(["NVDA"]);
    expect(refreshed[0].security_ids).toHaveLength(1);
  });

  it("deletes the watchlist and cascades items", async () => {
    const rows = await listWatchlists(USER_ID);
    const deleted = await deleteWatchlist(USER_ID, rows[0].id);
    expect(deleted).toBe(1);

    const refreshed = await listWatchlists(USER_ID);
    expect(refreshed).toHaveLength(0);

    const db = getDb();
    const count = await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM watchlist_items");
    expect(count?.count).toBe(0);
  });
});