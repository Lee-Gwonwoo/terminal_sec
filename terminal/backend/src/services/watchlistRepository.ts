import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { getIndustry } from "./industryLookup.js";
import { upsertSecurity } from "./tickerUniverseRepository.js";

type WatchlistItemWithMeta = {
  ticker: string;
  security_id: number | null;
  name: string | null;
  industry: string | null;
  marketCap: number | null;
};

export async function listWatchlists(userId: string) {
  const db = getDb();

  // Get watchlist headers
  const headers = await db.all<any[]>(
    `SELECT id, user_id, name, enable_alerts, created_at
     FROM watchlists WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  const result = [];
  for (const h of headers) {
    const items = await db.all<{
      ticker: string;
      security_id: number | null;
      security_name: string | null;
      security_industry: string | null;
      market_cap: number | null;
    }[]>(
      `SELECT wi.ticker,
              wi.security_id,
              s.name AS security_name,
              s.industry AS security_industry,
              (
                SELECT cp.market_cap
                FROM company_profiles cp
                WHERE cp.security_id = wi.security_id AND cp.market_cap IS NOT NULL
                ORDER BY cp.fetched_at DESC, cp.id DESC
                LIMIT 1
              ) AS market_cap
         FROM watchlist_items wi
         LEFT JOIN securities s ON s.id = wi.security_id
         WHERE wi.watchlist_id = ?
         ORDER BY wi.rowid ASC`,
      [h.id]
    );
    const enrichedItems: WatchlistItemWithMeta[] = items.map((item) => ({
      ticker: item.ticker,
      security_id: item.security_id,
      name: item.security_name ?? item.ticker,
      industry: item.security_industry ?? getIndustry(item.ticker),
      marketCap: item.market_cap ?? null,
    }));
    result.push({
      id: h.id,
      user_id: h.user_id,
      name: h.name,
      enable_alerts: Boolean(h.enable_alerts),
      created_at: h.created_at,
      tickers: enrichedItems.map((item) => item.ticker).filter(Boolean),
      security_ids: enrichedItems.map((item) => item.security_id).filter((id): id is number => id != null),
      items: enrichedItems,
    });
  }

  return result;
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
      const normalizedTicker = ticker.toUpperCase();
      // Step 5-4: also resolve security_id for new items
      const securityId = await upsertSecurity(normalizedTicker, null, null, null, null);
      await db.run(
        `INSERT INTO watchlist_items (watchlist_id, ticker, security_id) VALUES (?, ?, ?)`,
        [id, normalizedTicker, securityId]
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

export async function updateWatchlist(
  userId: string,
  watchlistId: string,
  name: string,
  tickers: string[],
  enableAlerts: boolean,
) {
  const db = getDb();
  await db.run("BEGIN");
  try {
    const existing = await db.get<{ id: string; created_at: string }>(
      `SELECT id, created_at FROM watchlists WHERE user_id = ? AND id = ?`,
      [userId, watchlistId],
    );

    if (!existing) {
      await db.run("ROLLBACK");
      return null;
    }

    await db.run(
      `UPDATE watchlists
       SET name = ?, enable_alerts = ?
       WHERE user_id = ? AND id = ?`,
      [name, enableAlerts ? 1 : 0, userId, watchlistId],
    );

    await db.run(`DELETE FROM watchlist_items WHERE watchlist_id = ?`, [watchlistId]);

    for (const ticker of tickers) {
      const normalizedTicker = ticker.toUpperCase();
      const securityId = await upsertSecurity(normalizedTicker, null, null, null, null);
      await db.run(
        `INSERT INTO watchlist_items (watchlist_id, ticker, security_id) VALUES (?, ?, ?)`,
        [watchlistId, normalizedTicker, securityId],
      );
    }

    await db.run("COMMIT");

    return {
      id: watchlistId,
      user_id: userId,
      name,
      enable_alerts: enableAlerts,
      created_at: existing.created_at,
      tickers: tickers.map((ticker) => ticker.toUpperCase()),
    };
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

export async function deleteWatchlist(userId: string, watchlistId: string) {
  const result = await getDb().run(
    `DELETE FROM watchlists WHERE user_id = ? AND id = ?`,
    [userId, watchlistId]
  );
  return result.changes ?? 0;
}

/**
 * Step 5-4: Backfill security_id for existing watchlist_items that have ticker but no security_id.
 * Returns number of rows updated.
 */
export async function backfillWatchlistSecurityIds(): Promise<number> {
  const db = getDb();
  const rows = await db.all<{ watchlist_id: string; ticker: string }[]>(
    "SELECT watchlist_id, ticker FROM watchlist_items WHERE security_id IS NULL AND ticker != ''"
  );

  let updated = 0;
  for (const row of rows) {
    const securityId = await upsertSecurity(row.ticker, null, null, null, null);
    await db.run(
      "UPDATE watchlist_items SET security_id = ? WHERE watchlist_id = ? AND ticker = ?",
      [securityId, row.watchlist_id, row.ticker]
    );
    updated++;
  }
  return updated;
}
