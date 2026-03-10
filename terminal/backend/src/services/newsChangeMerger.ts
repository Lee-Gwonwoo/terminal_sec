import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";
import { fetchOhlcBatch } from "./ibkrOhlcBatchProvider.js";
import { upsertBars } from "./ohlcWatchlistRepository.js";

/** Options for IBKR fallback when OHLC DB has no data for a ticker. */
export interface IbkrFallbackOptions {
  enabled: boolean;
  concurrency: number; // max concurrent IBKR requests (1-100)
  port?: number;       // TWS port, default 4001
  clientId?: number;   // default 85
}

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
  High: number;
  Close: number;
};

/** Get the closest OHLC bar on or before `date` (for non-trading days). */
async function getOhlcCloseOnOrBefore(symbol: string, date: string): Promise<OhlcRow | null> {
  const db = await getOhlcConn();
  const row = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, High, Close FROM ohlc_1d
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
): Promise<{ anchor: OhlcRow; prev: OhlcRow | null; forwards: OhlcRow[] } | null> {
  const anchor = await getOhlcCloseOnOrBefore(symbol, date);
  if (!anchor) return null;

  const db = await getOhlcConn();
  const prev = await db.get<OhlcRow>(
    `SELECT Symbol, Datetime, Open, High, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime < ?
     ORDER BY Datetime DESC
     LIMIT 1`,
    [symbol, anchor.Datetime],
  ) ?? null;

  const forwards = await db.all<OhlcRow[]>(
    `SELECT Symbol, Datetime, Open, High, Close FROM ohlc_1d
     WHERE Symbol = ? AND Datetime > ?
     ORDER BY Datetime ASC
     LIMIT ?`,
    [symbol, anchor.Datetime, maxForward],
  );

  return { anchor, prev, forwards };
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

// ---------- Multi-row upsert SQL for 8 standard metrics ----------

const UPSERT_METRICS_SQL = `INSERT INTO news_change_metrics
  (news_id, metric_key, value_pct, ohlc_ticker, reference_date, target_date, forward_trading_days, computed_at)
VALUES (?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?)
ON CONFLICT(news_id, metric_key) DO UPDATE SET
  value_pct = excluded.value_pct,
  ohlc_ticker = excluded.ohlc_ticker,
  reference_date = excluded.reference_date,
  target_date = excluded.target_date,
  forward_trading_days = excluded.forward_trading_days,
  computed_at = excluded.computed_at`;

// ---------- Standard metrics for one news item (forward-looking) ----------

/** Compute and upsert standard change metrics for a single news item.
 *  Reference price for forward metrics: previous trading day close.
 *  change_pct: prev close → news date close (Chg).
 *  change_from_open_pct: news date open → news date close (intraday).
 *  change_open_to_high_pct: news date open → news date high (intraday).
 *  OHLC reads: 3 queries per item; 8 upserts batched in 1 statement.
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
  prevDate: string;
  changePct: number | null;
  changeFromOpen: number | null;
  changeOpenToHigh: number | null;
  change1d: number | null;
  change3d: number | null;
  change7d: number | null;
  change14d: number | null;
  change30d: number | null;
  fwd1Date: string;
  fwd3Date: string;
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

  const { anchor, prev, forwards } = result;
  const anchorDate = anchor.Datetime;
  const prevClose = prev?.Close ?? null;
  const fwd1  = forwards[0]  ?? null;
  const fwd3  = forwards[2]  ?? null;
  const fwd5  = forwards[4]  ?? null;
  const fwd10 = forwards[9]  ?? null;
  const fwd22 = forwards[21] ?? null;

  return {
    newsId,
    ticker,
    anchorDate,
    prevDate: prev?.Datetime ?? anchorDate,
    changePct: prevClose !== null ? pctChange(anchor.Close, prevClose) : null,
    changeFromOpen: pctChange(anchor.Close, anchor.Open),
    changeOpenToHigh: pctChange(anchor.High, anchor.Open),
    change1d:  fwd1  && prevClose !== null ? pctChange(fwd1.Close,  prevClose) : null,
    change3d:  fwd3  && prevClose !== null ? pctChange(fwd3.Close,  prevClose) : null,
    change7d:  fwd5  && prevClose !== null ? pctChange(fwd5.Close,  prevClose) : null,
    change14d: fwd10 && prevClose !== null ? pctChange(fwd10.Close, prevClose) : null,
    change30d: fwd22 && prevClose !== null ? pctChange(fwd22.Close, prevClose) : null,
    fwd1Date:  fwd1?.Datetime  ?? anchorDate,
    fwd3Date:  fwd3?.Datetime  ?? anchorDate,
    fwd5Date:  fwd5?.Datetime  ?? anchorDate,
    fwd10Date: fwd10?.Datetime ?? anchorDate,
    fwd22Date: fwd22?.Datetime ?? anchorDate,
  };
}

const WRITE_CHUNK_SIZE = 1000;

/** Fetch OHLC from IBKR for missing tickers, upsert to DB, re-compute metrics.
 *  Returns newly computed metrics. */
async function ibkrFallbackFetch(
  missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }>,
  ibkr: IbkrFallbackOptions,
  onLog?: (msg: string) => void,
): Promise<ComputedMetrics[]> {
  if (missingItems.length === 0) return [];

  // Deduplicate tickers and find date range needed
  const tickerSet = new Set(missingItems.map(i => i.ticker));
  const uniqueTickers = [...tickerSet];

  // Find the earliest and latest dates needed (with 45 day margin for forward metrics)
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";
  for (const item of missingItems) {
    const d = item.publishedAt.slice(0, 10);
    if (d < minDate) minDate = d;
    if (d > maxDate) maxDate = d;
  }
  // Extend range: 30 days before minDate (for prev close) and 45 days after maxDate (for 30d forward)
  const startDt = new Date(minDate + "T00:00:00Z");
  startDt.setUTCDate(startDt.getUTCDate() - 30);
  const endDt = new Date(maxDate + "T00:00:00Z");
  endDt.setUTCDate(endDt.getUTCDate() + 45);
  const startDate = startDt.toISOString().slice(0, 10);
  const endDate = endDt.toISOString().slice(0, 10);

  onLog?.(`[IBKR fallback] fetching ${uniqueTickers.length} tickers (${startDate}~${endDate}), concurrency=${ibkr.concurrency}`);

  // Batch fetch from IBKR
  const results = await fetchOhlcBatch(
    uniqueTickers,
    startDate,
    endDate,
    ibkr.concurrency,
    ibkr.port ?? 4001,
    ibkr.clientId ?? 85,
  );

  // Upsert fetched bars to OHLC DB
  let totalUpserted = 0;
  let fetchOk = 0;
  let fetchFail = 0;
  for (const r of results) {
    if (r.error || r.bars.length === 0) {
      fetchFail++;
      continue;
    }
    fetchOk++;
    const n = await upsertBars(r.symbol, r.bars);
    totalUpserted += n;
  }
  onLog?.(`[IBKR fallback] fetched=${fetchOk}, failed=${fetchFail}, upserted=${totalUpserted} bars`);

  // Re-compute metrics for the missing items (now OHLC DB should have data)
  const recomputed: ComputedMetrics[] = [];
  for (const item of missingItems) {
    const m = await computeMetricsForItem(item.newsId, item.ticker, item.publishedAt);
    if (m) recomputed.push(m);
  }
  onLog?.(`[IBKR fallback] re-computed ${recomputed.length}/${missingItems.length} items`);
  return recomputed;
}

async function batchWriteMetrics(metrics: ComputedMetrics[]): Promise<void> {
  if (metrics.length === 0) return;
  const db = getDb();
  const ts = now();

  for (let start = 0; start < metrics.length; start += WRITE_CHUNK_SIZE) {
    const chunk = metrics.slice(start, start + WRITE_CHUNK_SIZE);
    await db.run("BEGIN IMMEDIATE");
    try {
      for (const m of chunk) {
        await db.run(UPSERT_METRICS_SQL, [
          m.newsId, "change_pct",              m.changePct,        m.ticker, m.prevDate,   m.anchorDate, 0,  ts,
          m.newsId, "change_from_open_pct",    m.changeFromOpen,   m.ticker, m.anchorDate, m.anchorDate, 0,  ts,
          m.newsId, "change_open_to_high_pct", m.changeOpenToHigh, m.ticker, m.anchorDate, m.anchorDate, 0,  ts,
          m.newsId, "change_1d_pct",  m.change1d,  m.ticker, m.prevDate, m.fwd1Date,  1,  ts,
          m.newsId, "change_3d_pct",  m.change3d,  m.ticker, m.prevDate, m.fwd3Date,  3,  ts,
          m.newsId, "change_7d_pct",  m.change7d,  m.ticker, m.prevDate, m.fwd5Date,  5,  ts,
          m.newsId, "change_14d_pct", m.change14d, m.ticker, m.prevDate, m.fwd10Date, 10, ts,
          m.newsId, "change_30d_pct", m.change30d, m.ticker, m.prevDate, m.fwd22Date, 22, ts,
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
 *  If ibkrFallback is enabled, tickers missing from OHLC DB are batch-fetched
 *  from IBKR, upserted, then re-computed.
 *  Progress callback: (completed, total) */
export async function bulkUpdateRecentChange(
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  ibkrFallback?: IbkrFallbackOptions,
  onLog?: (msg: string) => void,
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
  const missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }> = [];
  let skipped = 0;
  let completed = 0;

  // Phase 1: parallel OHLC reads + compute from DB
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else {
        missingItems.push({ newsId: row.id, ticker, publishedAt: row.published_at });
      }
    }
    completed++;
    if (onProgress && completed % 50 === 0) onProgress(completed, rows.length);
  }, isCancelled);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 1.5: IBKR fallback for missing tickers
  if (ibkrFallback?.enabled && missingItems.length > 0) {
    onLog?.(`[change] ${missingItems.length} items missing OHLC, starting IBKR fallback...`);
    try {
      const fallbackMetrics = await ibkrFallbackFetch(missingItems, ibkrFallback, onLog);
      computed.push(...fallbackMetrics);
      skipped += missingItems.length - fallbackMetrics.length;
      onLog?.(`[change] IBKR fallback done: ${fallbackMetrics.length} computed, ${missingItems.length - fallbackMetrics.length} still missing`);
    } catch (err) {
      onLog?.(`[change] IBKR fallback error: ${err instanceof Error ? err.message : String(err)}`);
      skipped += missingItems.length;
    }
  } else {
    skipped += missingItems.length;
  }

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 2: batch write
  await batchWriteMetrics(computed);

  if (onProgress) onProgress(rows.length, rows.length);
  return { updated: computed.length, skipped };
}

// ---------- Custom Change Update (date range, all metrics) ----------

/** Compute ALL standard change metrics for news published within [from, to].
 *  from/to are ISO date strings (YYYY-MM-DD).
 *  If ibkrFallback is enabled, tickers missing from OHLC DB are batch-fetched. */
export async function bulkUpdateCustomChange(
  from: string,
  to: string,
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  ibkrFallback?: IbkrFallbackOptions,
  onLog?: (msg: string) => void,
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
  const missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }> = [];
  let skipped = 0;
  let completed = 0;

  // Phase 1: parallel OHLC reads + compute from DB
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else {
        missingItems.push({ newsId: row.id, ticker, publishedAt: row.published_at });
      }
    }
    completed++;
    if (onProgress && completed % 50 === 0) onProgress(completed, rows.length);
  }, isCancelled);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 1.5: IBKR fallback for missing tickers
  if (ibkrFallback?.enabled && missingItems.length > 0) {
    onLog?.(`[change] ${missingItems.length} items missing OHLC, starting IBKR fallback...`);
    try {
      const fallbackMetrics = await ibkrFallbackFetch(missingItems, ibkrFallback, onLog);
      computed.push(...fallbackMetrics);
      skipped += missingItems.length - fallbackMetrics.length;
      onLog?.(`[change] IBKR fallback done: ${fallbackMetrics.length} computed, ${missingItems.length - fallbackMetrics.length} still missing`);
    } catch (err) {
      onLog?.(`[change] IBKR fallback error: ${err instanceof Error ? err.message : String(err)}`);
      skipped += missingItems.length;
    }
  } else {
    skipped += missingItems.length;
  }

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 2: batch write
  await batchWriteMetrics(computed);

  if (onProgress) onProgress(rows.length, rows.length);
  return { updated: computed.length, skipped };
}
