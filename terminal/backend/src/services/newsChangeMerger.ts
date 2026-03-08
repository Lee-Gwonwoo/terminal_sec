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

// OHLC connection pool — one connection per concurrent worker for true parallel reads.
const OHLC_POOL_SIZE = 6;
let ohlcPool: Database<sqlite3.Database, sqlite3.Statement>[] = [];
let ohlcPoolIdx = 0;

async function getOhlcConn(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (ohlcPool.length === 0) {
    const dbPath = resolveOhlcDbPath();
    for (let i = 0; i < OHLC_POOL_SIZE; i++) {
      const conn = await open({ filename: dbPath, driver: sqlite3.Database });
      await conn.exec("PRAGMA journal_mode=WAL;");
      ohlcPool.push(conn);
    }
  }
  // Round-robin (safe — JS is single-threaded between awaits)
  return ohlcPool[ohlcPoolIdx++ % ohlcPool.length];
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
  const db = await getOhlcConn();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime <= ?
     ORDER BY Datetime DESC
     LIMIT 1`,
    [symbol, date],
  );
  return row ?? null;
}

/** Get anchor OHLC + up to maxForward trading days in 2 queries (instead of 5).
 *  Returns anchor row and an array of forward rows ordered ASC. */
async function getOhlcAnchorAndForwards(
  symbol: string,
  date: string,
  maxForward = 22,
): Promise<{ anchor: OhlcRow; forwards: OhlcRow[] } | null> {
  const anchor = await getOhlcCloseOnOrBefore(symbol, date);
  if (!anchor) return null;

  const db = await getOhlcConn();
  const forwards = await db.all<OhlcRow[]>(
    `SELECT Symbol, Datetime, Open, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime > ?
     ORDER BY Datetime ASC
     LIMIT ?`,
    [symbol, anchor.Datetime, maxForward],
  );

  return { anchor, forwards };
}

function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Number((((current - reference) / reference) * 100).toFixed(4));
}

const now = () => new Date().toISOString();

// ---------- Concurrency pool for parallel item processing ----------

export const DEFAULT_MERGE_CONCURRENCY = 6;

async function poolRun<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
  isCancelled?: () => boolean,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      if (isCancelled?.()) return;
      const idx = next++;
      if (idx >= items.length) return;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

// ---------- Multi-row upsert SQL for 5 standard metrics ----------

const UPSERT_5_METRICS_SQL = `INSERT INTO news_change_metrics
  (news_id, metric_key, value_pct, ohlc_ticker, reference_date, target_date, forward_trading_days, computed_at)
VALUES (?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?)
ON CONFLICT(news_id, metric_key) DO UPDATE SET
  value_pct = excluded.value_pct,
  ohlc_ticker = excluded.ohlc_ticker,
  reference_date = excluded.reference_date,
  target_date = excluded.target_date,
  forward_trading_days = excluded.forward_trading_days,
  computed_at = excluded.computed_at`;

// ---------- Standard metrics for one news item (forward-looking) ----------

/** Compute and upsert standard change metrics for a single news item.
 *  Direction: news date close → N trading days AFTER close.
 *  change_from_open_pct: news date open → news date close (intraday).
 *  OHLC reads reduced to 2 queries per item; 5 upserts batched in 1 statement.
 *  Returns true if at least one metric was written. */
export async function mergeChangeForNewsItem(
  newsId: string,
  ticker: string,
  publishedAt: string,
): Promise<boolean> {
  const m = await computeMetricsForItem(newsId, ticker, publishedAt);
  if (!m) return false;
  await batchWriteMetrics([m]);
  return true;
}

// ---------- Two-phase helpers: compute (read-only) → batch write ----------

type ComputedMetrics = {
  newsId: string;
  ticker: string;
  anchorDate: string;
  changeFromOpen: number | null;
  change1d: number | null;
  change7d: number | null;
  change14d: number | null;
  change30d: number | null;
  fwd1Date: string;
  fwd5Date: string;
  fwd10Date: string;
  fwd22Date: string;
};

async function computeMetricsForItem(
  newsId: string,
  ticker: string,
  publishedAt: string,
): Promise<ComputedMetrics | null> {
  const newsDate = publishedAt.slice(0, 10);
  const result = await getOhlcAnchorAndForwards(ticker, newsDate);
  if (!result) return null;

  const { anchor, forwards } = result;
  const anchorDate = anchor.Datetime;
  const fwd1  = forwards[0]  ?? null;
  const fwd5  = forwards[4]  ?? null;
  const fwd10 = forwards[9]  ?? null;
  const fwd22 = forwards[21] ?? null;

  return {
    newsId,
    ticker,
    anchorDate,
    changeFromOpen: pctChange(anchor.Close, anchor.Open),
    change1d:  fwd1  ? pctChange(fwd1.Close,  anchor.Close) : null,
    change7d:  fwd5  ? pctChange(fwd5.Close,  anchor.Close) : null,
    change14d: fwd10 ? pctChange(fwd10.Close, anchor.Close) : null,
    change30d: fwd22 ? pctChange(fwd22.Close, anchor.Close) : null,
    fwd1Date:  fwd1?.Datetime  ?? anchorDate,
    fwd5Date:  fwd5?.Datetime  ?? anchorDate,
    fwd10Date: fwd10?.Datetime ?? anchorDate,
    fwd22Date: fwd22?.Datetime ?? anchorDate,
  };
}

const WRITE_CHUNK_SIZE = 1000;

async function batchWriteMetrics(metrics: ComputedMetrics[]): Promise<void> {
  if (metrics.length === 0) return;
  const db = getDb();
  const ts = now();

  for (let start = 0; start < metrics.length; start += WRITE_CHUNK_SIZE) {
    const chunk = metrics.slice(start, start + WRITE_CHUNK_SIZE);
    await db.run("BEGIN IMMEDIATE");
    try {
      for (const m of chunk) {
        await db.run(UPSERT_5_METRICS_SQL, [
          m.newsId, "change_from_open_pct", m.changeFromOpen, m.ticker, m.anchorDate, m.anchorDate, 0, ts,
          m.newsId, "change_1d_pct",  m.change1d,  m.ticker, m.anchorDate, m.fwd1Date,  1,  ts,
          m.newsId, "change_7d_pct",  m.change7d,  m.ticker, m.anchorDate, m.fwd5Date,  5,  ts,
          m.newsId, "change_14d_pct", m.change14d, m.ticker, m.anchorDate, m.fwd10Date, 10, ts,
          m.newsId, "change_30d_pct", m.change30d, m.ticker, m.anchorDate, m.fwd22Date, 22, ts,
        ]);
      }
      await db.run("COMMIT");
    } catch (e) {
      await db.run("ROLLBACK");
      throw e;
    }
  }
}

// ---------- Batch merge for newly inserted items ----------

export async function mergeChangeForNewItems(
  newsIds: Array<{ id: string; tickers: string[]; publishedAt: string }>,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
): Promise<{ merged: number; skipped: number }> {
  const computed: ComputedMetrics[] = [];
  let skipped = 0;

  // Phase 1: parallel OHLC reads + compute
  await poolRun(newsIds, concurrency, async (item) => {
    const ticker = item.tickers[0];
    if (!ticker) { skipped++; return; }
    const m = await computeMetricsForItem(item.id, ticker, item.publishedAt);
    if (m) { computed.push(m); } else { skipped++; }
  }, isCancelled);

  if (isCancelled?.()) return { merged: computed.length, skipped };

  // Phase 2: batch write in chunked transactions
  await batchWriteMetrics(computed);

  return { merged: computed.length, skipped };
}

// ---------- Recent Change Update (all metrics, last 7 days of news) ----------

/** Compute ALL standard change metrics (open, 1d, 7d, 14d, 30d) for news
 *  published within the last 7 calendar days.
 *  Progress callback: (completed, total) */
export async function bulkUpdateRecentChange(
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
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

  const computed: ComputedMetrics[] = [];
  let skipped = 0;
  let completed = 0;

  // Phase 1: parallel reads
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else { skipped++; }
    }
    completed++;
    if (onProgress && completed % 50 === 0) onProgress(completed, rows.length);
  }, isCancelled);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 2: batch write
  await batchWriteMetrics(computed);

  if (onProgress) onProgress(rows.length, rows.length);
  return { updated: computed.length, skipped };
}

// ---------- Custom Change Update (date range, all metrics) ----------

/** Compute ALL standard change metrics for news published within [from, to].
 *  from/to are ISO date strings (YYYY-MM-DD). */
export async function bulkUpdateCustomChange(
  from: string,
  to: string,
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
): Promise<{ updated: number; skipped: number }> {
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items
     WHERE published_at >= ? AND published_at <= ?
     ORDER BY published_at DESC`,
    [fromIso, toIso],
  );

  const computed: ComputedMetrics[] = [];
  let skipped = 0;
  let completed = 0;

  // Phase 1: parallel reads
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else { skipped++; }
    }
    completed++;
    if (onProgress && completed % 50 === 0) onProgress(completed, rows.length);
  }, isCancelled);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 2: batch write
  await batchWriteMetrics(computed);

  if (onProgress) onProgress(rows.length, rows.length);
  return { updated: computed.length, skipped };
}
