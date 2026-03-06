import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";

// ---------- OHLC DB location ----------

function resolveOhlcDbPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(current, "OHLC_data", "ohlc_1d_watchlist.sqlite");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("OHLC database (ohlc_1d_watchlist.sqlite) not found");
}

let ohlcDb: Database<sqlite3.Database, sqlite3.Statement> | null = null;

async function getOhlcDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (ohlcDb) return ohlcDb;
  const dbPath = resolveOhlcDbPath();
  ohlcDb = await open({ filename: dbPath, driver: sqlite3.Database });
  return ohlcDb;
}

// ---------- OHLC query ----------

type OhlcRow = {
  Symbol: string;
  Datetime: string;
  Open: number;
  Close: number;
};

async function getOhlcClose(symbol: string, date: string): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d WHERE Symbol = ? AND Datetime = ?`,
    [symbol, date],
  );
  return row ?? null;
}

/** Get the closest OHLC bar on or before `date` (for non-trading days). */
async function getOhlcCloseOnOrBefore(symbol: string, date: string): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime <= ?
     ORDER BY Datetime DESC
     LIMIT 1`,
    [symbol, date],
  );
  return row ?? null;
}

async function getOhlcCloseNDaysBack(
  symbol: string,
  baseDate: string,
  daysBack: number,
): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime < ?
     ORDER BY Datetime DESC
     LIMIT 1 OFFSET ?`,
    [symbol, baseDate, daysBack - 1],
  );
  return row ?? null;
}

function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Number((((current - reference) / reference) * 100).toFixed(4));
}

const now = () => new Date().toISOString();

// ---------- Upsert a single metric row into news_change_metrics ----------

async function upsertMetric(
  newsId: string,
  metricKey: string,
  valuePct: number | null,
  ohlcTicker: string,
  referenceDate: string,
  anchorDate: string,
  lookbackTradingDays: number | null,
): Promise<void> {
  await getDb().run(
    `INSERT INTO news_change_metrics
       (news_id, metric_key, value_pct, ohlc_ticker, reference_date, anchor_date, lookback_trading_days, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(news_id, metric_key) DO UPDATE SET
       value_pct = excluded.value_pct,
       ohlc_ticker = excluded.ohlc_ticker,
       reference_date = excluded.reference_date,
       anchor_date = excluded.anchor_date,
       lookback_trading_days = excluded.lookback_trading_days,
       computed_at = excluded.computed_at`,
    [newsId, metricKey, valuePct, ohlcTicker, referenceDate, anchorDate, lookbackTradingDays, now()],
  );
}

// ---------- Standard metrics for one news item ----------

/** Compute and upsert standard change metrics for a single news item.
 *  Returns true if at least one metric was written. */
export async function mergeChangeForNewsItem(
  newsId: string,
  ticker: string,
  publishedAt: string,
): Promise<boolean> {
  const newsDate = publishedAt.slice(0, 10);

  // Get OHLC for the news date (or nearest previous trading day)
  const dayRow = await getOhlcCloseOnOrBefore(ticker, newsDate);
  if (!dayRow) return false;

  const anchorDate = dayRow.Datetime;
  const close = dayRow.Close;
  const openPrice = dayRow.Open;

  // 1d: vs previous day close
  const prevDay = await getOhlcCloseNDaysBack(ticker, anchorDate, 1);
  const change1d = prevDay ? pctChange(close, prevDay.Close) : null;
  await upsertMetric(newsId, "change_1d_pct", change1d, ticker,
    prevDay ? prevDay.Datetime : anchorDate, anchorDate, 1);

  // from open
  const changeFromOpen = pctChange(close, openPrice);
  await upsertMetric(newsId, "change_from_open_pct", changeFromOpen, ticker,
    anchorDate, anchorDate, 0);

  // 7d (~5 trading days)
  const day7 = await getOhlcCloseNDaysBack(ticker, anchorDate, 5);
  const change7d = day7 ? pctChange(close, day7.Close) : null;
  await upsertMetric(newsId, "change_7d_pct", change7d, ticker,
    day7 ? day7.Datetime : anchorDate, anchorDate, 5);

  // 14d (~10 trading days)
  const day14 = await getOhlcCloseNDaysBack(ticker, anchorDate, 10);
  const change14d = day14 ? pctChange(close, day14.Close) : null;
  await upsertMetric(newsId, "change_14d_pct", change14d, ticker,
    day14 ? day14.Datetime : anchorDate, anchorDate, 10);

  // 30d (~22 trading days)
  const day30 = await getOhlcCloseNDaysBack(ticker, anchorDate, 22);
  const change30d = day30 ? pctChange(close, day30.Close) : null;
  await upsertMetric(newsId, "change_30d_pct", change30d, ticker,
    day30 ? day30.Datetime : anchorDate, anchorDate, 22);

  return true;
}

// ---------- Batch merge for newly inserted items ----------

export async function mergeChangeForNewItems(
  newsIds: Array<{ id: string; tickers: string[]; publishedAt: string }>,
): Promise<{ merged: number; skipped: number }> {
  let merged = 0;
  let skipped = 0;

  for (const item of newsIds) {
    const ticker = item.tickers[0];
    if (!ticker) {
      skipped++;
      continue;
    }
    const success = await mergeChangeForNewsItem(item.id, ticker, item.publishedAt);
    if (success) {
      merged++;
    } else {
      skipped++;
    }
  }

  return { merged, skipped };
}

// ---------- 7D Change Update (bulk) ----------

/** Recompute change_7d_pct for all news_items that have a ticker.
 *  Progress callback: (completed, total) */
export async function bulkUpdate7dChange(
  onProgress?: (completed: number, total: number) => void,
): Promise<{ updated: number; skipped: number }> {
  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items ORDER BY published_at DESC`,
  );
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; continue; }

    const newsDate = row.published_at.slice(0, 10);
    const dayRow = await getOhlcCloseOnOrBefore(ticker, newsDate);
    if (!dayRow) { skipped++; continue; }

    const day7 = await getOhlcCloseNDaysBack(ticker, dayRow.Datetime, 5);
    const change7d = day7 ? pctChange(dayRow.Close, day7.Close) : null;
    await upsertMetric(row.id, "change_7d_pct", change7d, ticker,
      day7 ? day7.Datetime : dayRow.Datetime, dayRow.Datetime, 5);
    updated++;
    if (onProgress && (i + 1) % 50 === 0) onProgress(i + 1, rows.length);
  }
  if (onProgress) onProgress(rows.length, rows.length);
  return { updated, skipped };
}

// ---------- Custom Change Update (bulk) ----------

/** Compute custom_{N}d_pct for all news_items. N = lookback trading days. */
export async function bulkUpdateCustomChange(
  lookbackTradingDays: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ updated: number; skipped: number }> {
  const metricKey = `custom_${lookbackTradingDays}d_pct`;
  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items ORDER BY published_at DESC`,
  );
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; continue; }

    const newsDate = row.published_at.slice(0, 10);
    const dayRow = await getOhlcCloseOnOrBefore(ticker, newsDate);
    if (!dayRow) { skipped++; continue; }

    const refRow = await getOhlcCloseNDaysBack(ticker, dayRow.Datetime, lookbackTradingDays);
    const changePct = refRow ? pctChange(dayRow.Close, refRow.Close) : null;
    await upsertMetric(row.id, metricKey, changePct, ticker,
      refRow ? refRow.Datetime : dayRow.Datetime, dayRow.Datetime, lookbackTradingDays);
    updated++;
    if (onProgress && (i + 1) % 50 === 0) onProgress(i + 1, rows.length);
  }
  if (onProgress) onProgress(rows.length, rows.length);
  return { updated, skipped };
}
