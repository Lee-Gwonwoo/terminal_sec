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

/** Get the N-th trading day AFTER baseDate (forward-looking).
 *  daysForward=1 → next trading day after baseDate.
 *  daysForward=5 → 5th trading day after baseDate (~7 calendar days). */
async function getOhlcCloseNDaysForward(
  symbol: string,
  baseDate: string,
  daysForward: number,
): Promise<OhlcRow | null> {
  const db = await getOhlcDb();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime > ?
     ORDER BY Datetime ASC
     LIMIT 1 OFFSET ?`,
    [symbol, baseDate, daysForward - 1],
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
  targetDate: string,
  forwardTradingDays: number | null,
): Promise<void> {
  await getDb().run(
    `INSERT INTO news_change_metrics
       (news_id, metric_key, value_pct, ohlc_ticker, reference_date, target_date, forward_trading_days, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(news_id, metric_key) DO UPDATE SET
       value_pct = excluded.value_pct,
       ohlc_ticker = excluded.ohlc_ticker,
       reference_date = excluded.reference_date,
       target_date = excluded.target_date,
       forward_trading_days = excluded.forward_trading_days,
       computed_at = excluded.computed_at`,
    [newsId, metricKey, valuePct, ohlcTicker, referenceDate, targetDate, forwardTradingDays, now()],
  );
}

// ---------- Standard metrics for one news item (forward-looking) ----------

/** Compute and upsert standard change metrics for a single news item.
 *  Direction: news date close → N trading days AFTER close.
 *  change_from_open_pct: news date open → news date close (intraday).
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
  const anchorClose = dayRow.Close;
  const anchorOpen = dayRow.Open;

  // from open: intraday (open → close on news day)
  const changeFromOpen = pctChange(anchorClose, anchorOpen);
  await upsertMetric(newsId, "change_from_open_pct", changeFromOpen, ticker,
    anchorDate, anchorDate, 0);

  // 1d: anchor close → 1 trading day AFTER close
  const fwd1 = await getOhlcCloseNDaysForward(ticker, anchorDate, 1);
  const change1d = fwd1 ? pctChange(fwd1.Close, anchorClose) : null;
  await upsertMetric(newsId, "change_1d_pct", change1d, ticker,
    anchorDate, fwd1 ? fwd1.Datetime : anchorDate, 1);

  // 7d: anchor close → 5 trading days AFTER close
  const fwd5 = await getOhlcCloseNDaysForward(ticker, anchorDate, 5);
  const change7d = fwd5 ? pctChange(fwd5.Close, anchorClose) : null;
  await upsertMetric(newsId, "change_7d_pct", change7d, ticker,
    anchorDate, fwd5 ? fwd5.Datetime : anchorDate, 5);

  // 14d: anchor close → 10 trading days AFTER close
  const fwd10 = await getOhlcCloseNDaysForward(ticker, anchorDate, 10);
  const change14d = fwd10 ? pctChange(fwd10.Close, anchorClose) : null;
  await upsertMetric(newsId, "change_14d_pct", change14d, ticker,
    anchorDate, fwd10 ? fwd10.Datetime : anchorDate, 10);

  // 30d: anchor close → 22 trading days AFTER close
  const fwd22 = await getOhlcCloseNDaysForward(ticker, anchorDate, 22);
  const change30d = fwd22 ? pctChange(fwd22.Close, anchorClose) : null;
  await upsertMetric(newsId, "change_30d_pct", change30d, ticker,
    anchorDate, fwd22 ? fwd22.Datetime : anchorDate, 22);

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

// ---------- Recent Change Update (all metrics, last 7 days of news) ----------

/** Compute ALL standard change metrics (open, 1d, 7d, 14d, 30d) for news
 *  published within the last 7 calendar days.
 *  Progress callback: (completed, total) */
export async function bulkUpdateRecentChange(
  onProgress?: (completed: number, total: number) => void,
): Promise<{ updated: number; skipped: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffIso = cutoff.toISOString();

  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items
     WHERE published_at >= ?
     ORDER BY published_at DESC`,
    [cutoffIso],
  );
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; continue; }

    const ok = await mergeChangeForNewsItem(row.id, ticker, row.published_at);
    if (ok) { updated++; } else { skipped++; }
    if (onProgress && (i + 1) % 50 === 0) onProgress(i + 1, rows.length);
  }
  if (onProgress) onProgress(rows.length, rows.length);
  return { updated, skipped };
}

// ---------- Custom Change Update (date range, all metrics) ----------

/** Compute ALL standard change metrics for news published within [from, to].
 *  from/to are ISO date strings (YYYY-MM-DD). */
export async function bulkUpdateCustomChange(
  from: string,
  to: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ updated: number; skipped: number }> {
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items
     WHERE published_at >= ? AND published_at <= ?
     ORDER BY published_at DESC`,
    [fromIso, toIso],
  );
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; continue; }

    const ok = await mergeChangeForNewsItem(row.id, ticker, row.published_at);
    if (ok) { updated++; } else { skipped++; }
    if (onProgress && (i + 1) % 50 === 0) onProgress(i + 1, rows.length);
  }
  if (onProgress) onProgress(rows.length, rows.length);
  return { updated, skipped };
}
