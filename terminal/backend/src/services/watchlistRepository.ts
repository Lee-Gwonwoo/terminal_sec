import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export async function listWatchlists(userId: string) {
  const rows = await getDb().all<any[]>(
    `SELECT w.id, w.user_id, w.name, w.enable_alerts, w.created_at,
      COALESCE(GROUP_CONCAT(i.ticker), '') AS tickers_csv
     FROM watchlists w
     LEFT JOIN watchlist_items i ON i.watchlist_id = w.id
     WHERE w.user_id = ?
     GROUP BY w.id
     ORDER BY w.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    enable_alerts: Boolean(row.enable_alerts),
    created_at: row.created_at,
    tickers: row.tickers_csv
      .split(",")
      .map((ticker: string) => ticker.trim())
      .filter(Boolean)
  }));
}

export async function createWatchlist(userId: string, name: string, tickers: string[], enableAlerts: boolean) {
  const id = randomUUID();
  const db = getDb();
  await db.run("BEGIN");
  try {
    await db.run(
      `INSERT INTO watchlists (id, user_id, name, enable_alerts)
       VALUES (?, ?, ?, ?)`,
      [id, userId, name, enableAlerts ? 1 : 0]
    );

    for (const ticker of tickers) {
      await db.run(
        `INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)`,
        [id, ticker.toUpperCase()]
      );
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }

  return {
    id,
    user_id: userId,
    name,
    enable_alerts: enableAlerts,
    created_at: new Date().toISOString(),
    tickers: tickers.map((ticker) => ticker.toUpperCase())
  };
}

export async function deleteWatchlist(userId: string, watchlistId: string) {
  const result = await getDb().run(
    `DELETE FROM watchlists WHERE user_id = ? AND id = ?`,
    [userId, watchlistId]
  );
  return result.changes ?? 0;
}
