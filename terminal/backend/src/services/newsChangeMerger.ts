import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";
import { fetchFmpOhlcBatch } from "./fmpOhlcProvider.js";
import {
  buildOhlcHistory,
  computeVolatilityMetricValues,
  type ActualChangeMetricValues,
  type OhlcHistory,
  type VolatilityMetricValues,
  VOLATILITY_FIELD_SPECS,
  VOLATILITY_METRIC_KEYS,
} from "./newsVolatilityMetrics.js";
import { shouldExcludeCurrentEtDailyBar, upsertBars } from "./ohlcWatchlistRepository.js";

/** Options for FMP fallback when OHLC DB has no data for a ticker. */
export interface FmpFallbackOptions {
  enabled: boolean;
  concurrency: number; // max concurrent FMP requests (1-20)
  requestIntervalMs?: number;
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
  const currentEtDate = getCurrentEtParts().date;
  const excludeCurrentEt = shouldExcludeCurrentEtDailyBar(currentEtDate);
  const anchor = await getOhlcCloseOnOrBefore(symbol, date);
  if (!anchor) return null;
  if (excludeCurrentEt && anchor.Datetime === currentEtDate) return null;

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
     WHERE Symbol = ? AND Datetime > ? ${excludeCurrentEt ? "AND Datetime < ?" : ""}
     ORDER BY Datetime ASC
     LIMIT ?`,
    excludeCurrentEt
      ? [symbol, anchor.Datetime, currentEtDate, maxForward]
      : [symbol, anchor.Datetime, maxForward],
  );

  return { anchor, prev, forwards };
}

function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Number((((current - reference) / reference) * 100).toFixed(4));
}

const now = () => new Date().toISOString();

const ET_TIME_ZONE = "America/New_York";
const ET_MARKET_CLOSE_TIME = "16:00:00";
const ISO_WITH_TIMEZONE_RE = /(Z|[+-]\d{2}:\d{2})$/i;
const ISO_NAIVE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export type EtDateTimeParts = {
  date: string;
  time: string;
};

function formatEtParts(value: Date): EtDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(value);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${partValue("year")}-${partValue("month")}-${partValue("day")}`,
    time: `${partValue("hour")}:${partValue("minute")}:${partValue("second")}`,
  };
}

export function getCurrentEtParts(nowDate = new Date()): EtDateTimeParts {
  return formatEtParts(nowDate);
}

export function getPublishedAtEtParts(publishedAt: string): EtDateTimeParts {
  if (ISO_NAIVE_RE.test(publishedAt) && !ISO_WITH_TIMEZONE_RE.test(publishedAt)) {
    return {
      date: publishedAt.slice(0, 10),
      time: publishedAt.slice(11, 19),
    };
  }

  const parsed = new Date(publishedAt);
  if (!Number.isNaN(parsed.getTime())) {
    return formatEtParts(parsed);
  }

  return {
    date: publishedAt.slice(0, 10),
    time: publishedAt.length >= 19 ? publishedAt.slice(11, 19) : "00:00:00",
  };
}

export function shouldDeferSameDayChangeUntilMarketClose(
  publishedAt: string,
  nowDate = new Date(),
): boolean {
  const newsEt = getPublishedAtEtParts(publishedAt);
  const currentEt = getCurrentEtParts(nowDate);
  return newsEt.date === currentEt.date && currentEt.time < ET_MARKET_CLOSE_TIME;
}

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

const STANDARD_METRIC_KEYS = [
  "change_pct",
  "change_from_open_pct",
  "change_open_to_high_pct",
  "change_1d_pct",
  "change_3d_pct",
  "change_7d_pct",
  "change_14d_pct",
  "change_30d_pct",
] as const;

const ALL_CHANGE_METRIC_KEYS = [...STANDARD_METRIC_KEYS, ...VOLATILITY_METRIC_KEYS] as const;

const UPSERT_SINGLE_METRIC_SQL = `INSERT INTO news_change_metrics
  (news_id, metric_key, value_pct, ohlc_ticker, reference_date, target_date, forward_trading_days, computed_at)
VALUES (?,?,?,?,?,?,?,?)
ON CONFLICT(news_id, metric_key) DO UPDATE SET
  value_pct = excluded.value_pct,
  ohlc_ticker = excluded.ohlc_ticker,
  reference_date = excluded.reference_date,
  target_date = excluded.target_date,
  forward_trading_days = excluded.forward_trading_days,
  computed_at = excluded.computed_at`;

type VolatilityMetricRow = {
  newsId: string;
  metricKey: (typeof VOLATILITY_METRIC_KEYS)[number];
  value: number | null;
  ticker: string;
  referenceDate: string;
  targetDate: string;
  forwardTradingDays: number;
};

type TickerHistoryCache = Map<string, Promise<OhlcHistory>>;

async function getTickerOhlcHistory(
  ticker: string,
  cache: TickerHistoryCache,
): Promise<OhlcHistory> {
  const cached = cache.get(ticker);
  if (cached) return cached;

  const pending = (async () => {
    const db = await getOhlcConn();
    const rows = await db.all<OhlcRow[]>(
      `SELECT Symbol, Datetime, Open, High, Close FROM ohlc_1d
       WHERE Symbol = ?
       ORDER BY Datetime ASC`,
      [ticker],
    );
    const currentEtDate = getCurrentEtParts().date;
    const excludeCurrentEt = shouldExcludeCurrentEtDailyBar(currentEtDate);
    const filtered = excludeCurrentEt
      ? rows.filter((row) => row.Datetime !== currentEtDate)
      : rows;
    return buildOhlcHistory(filtered);
  })();

  cache.set(ticker, pending);
  return pending;
}

function toActualChangeMetricValues(metrics: ComputedMetrics): ActualChangeMetricValues {
  return {
    changePct: metrics.changePct,
    changeFromOpen: metrics.changeFromOpen,
    changeOpenToHigh: metrics.changeOpenToHigh,
    change1d: metrics.change1d,
    change3d: metrics.change3d,
    change7d: metrics.change7d,
    change14d: metrics.change14d,
    change30d: metrics.change30d,
  };
}

function getMetricDateInfo(metrics: ComputedMetrics, actualField: keyof ActualChangeMetricValues): {
  referenceDate: string;
  targetDate: string;
} {
  switch (actualField) {
    case "changePct":
      return { referenceDate: metrics.prevDate, targetDate: metrics.anchorDate };
    case "changeFromOpen":
    case "changeOpenToHigh":
      return { referenceDate: metrics.anchorDate, targetDate: metrics.anchorDate };
    case "change1d":
      return { referenceDate: metrics.prevDate, targetDate: metrics.fwd1Date };
    case "change3d":
      return { referenceDate: metrics.prevDate, targetDate: metrics.fwd3Date };
    case "change7d":
      return { referenceDate: metrics.prevDate, targetDate: metrics.fwd5Date };
    case "change14d":
      return { referenceDate: metrics.prevDate, targetDate: metrics.fwd10Date };
    case "change30d":
      return { referenceDate: metrics.prevDate, targetDate: metrics.fwd22Date };
  }
}

function buildMissingVolatilityMetricRows(
  metrics: ComputedMetrics,
  values: VolatilityMetricValues,
  missingKeys: Set<string>,
): VolatilityMetricRow[] {
  const rows: VolatilityMetricRow[] = [];
  for (const spec of VOLATILITY_FIELD_SPECS) {
    const { referenceDate, targetDate } = getMetricDateInfo(metrics, spec.actualField);
    if (missingKeys.has(spec.hvKey)) {
      rows.push({
        newsId: metrics.newsId,
        metricKey: spec.hvKey,
        value: values[spec.hvField],
        ticker: metrics.ticker,
        referenceDate,
        targetDate,
        forwardTradingDays: spec.forwardTradingDays,
      });
    }
    if (missingKeys.has(spec.zscoreKey)) {
      rows.push({
        newsId: metrics.newsId,
        metricKey: spec.zscoreKey,
        value: values[spec.zscoreField],
        ticker: metrics.ticker,
        referenceDate,
        targetDate,
        forwardTradingDays: spec.forwardTradingDays,
      });
    }
  }
  return rows;
}

async function getMissingVolatilityMetricKeysByNewsId(newsIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  for (const newsId of newsIds) {
    result.set(newsId, new Set<string>(VOLATILITY_METRIC_KEYS));
  }
  if (newsIds.length === 0) return result;

  const db = getDb();
  const NEWS_CHUNK_SIZE = 200;
  const metricPlaceholders = VOLATILITY_METRIC_KEYS.map(() => "?").join(",");

  for (let start = 0; start < newsIds.length; start += NEWS_CHUNK_SIZE) {
    const chunk = newsIds.slice(start, start + NEWS_CHUNK_SIZE);
    const newsPlaceholders = chunk.map(() => "?").join(",");
    const rows = await db.all<{ news_id: string; metric_key: string; value_pct: number | null }[]>(
      `SELECT news_id, metric_key, value_pct
       FROM news_change_metrics
       WHERE news_id IN (${newsPlaceholders})
         AND metric_key IN (${metricPlaceholders})`,
      [...chunk, ...VOLATILITY_METRIC_KEYS],
    );

    for (const row of rows) {
      if (row.value_pct === null || row.value_pct === undefined) continue;
      result.get(row.news_id)?.delete(row.metric_key);
    }
  }

  return result;
}

async function computeMissingVolatilityRows(
  metrics: ComputedMetrics[],
  missingKeysByNewsId: Map<string, Set<string>>,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
): Promise<VolatilityMetricRow[]> {
  if (metrics.length === 0) return [];

  const historyCache: TickerHistoryCache = new Map();
  const rows: VolatilityMetricRow[] = [];

  await poolRun(metrics, concurrency, async (metric) => {
    const missingKeys = missingKeysByNewsId.get(metric.newsId);
    if (!missingKeys || missingKeys.size === 0) return;

    const history = await getTickerOhlcHistory(metric.ticker, historyCache);
    const values = computeVolatilityMetricValues(history, metric.anchorDate, toActualChangeMetricValues(metric));
    rows.push(...buildMissingVolatilityMetricRows(metric, values, missingKeys));
  }, isCancelled);

  return rows;
}

async function batchWriteVolatilityMetricRows(
  rows: VolatilityMetricRow[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (rows.length === 0) {
    onProgress?.(0, 0);
    return;
  }

  const db = getDb();
  const ts = now();
  let written = 0;

  for (let start = 0; start < rows.length; start += WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + WRITE_CHUNK_SIZE);
    await db.run("BEGIN IMMEDIATE");
    try {
      for (const row of chunk) {
        await db.run(UPSERT_SINGLE_METRIC_SQL, [
          row.newsId,
          row.metricKey,
          row.value,
          row.ticker,
          row.referenceDate,
          row.targetDate,
          row.forwardTradingDays,
          ts,
        ]);
        written += 1;
        onProgress?.(written, rows.length);
      }
      await db.run("COMMIT");
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    }
  }
}

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
  const missingKeysByNewsId = new Map<string, Set<string>>([
    [newsId, new Set<string>(VOLATILITY_METRIC_KEYS)],
  ]);
  await fillMissingVolatilityMetrics([m], undefined, undefined, undefined, undefined, missingKeysByNewsId);
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
  const { date: newsDate } = getPublishedAtEtParts(publishedAt);
  const result = await getOhlcAnchorAndForwards(ticker, newsDate);
  if (!result) return null;

  const { anchor, prev, forwards } = result;
  const anchorDate = anchor.Datetime;

  // 6-5 same-day gating: only store change when OHLC bar date matches news date.
  // If anchor is from a past date (e.g. weekend/holiday news, or today's bar not yet available),
  // return null so no misleading change data is written.
  if (anchorDate !== newsDate) return null;

  // Same-day metrics remain empty until the ET market close has passed.
  if (shouldDeferSameDayChangeUntilMarketClose(publishedAt)) return null;

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

/** Fetch OHLC from FMP for missing tickers, upsert to DB, re-compute metrics.
 *  Returns newly computed metrics. */
async function fmpFallbackFetch(
  missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }>,
  fmp: FmpFallbackOptions,
  onLog?: (msg: string) => void,
  onProgress?: (completed: number, total: number) => void,
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

  onLog?.(`[FMP fallback] fetching ${uniqueTickers.length} tickers (${startDate}~${endDate}), concurrency=${fmp.concurrency}, interval=${fmp.requestIntervalMs ?? 250}ms`);

  const batch = await fetchFmpOhlcBatch(
    uniqueTickers,
    startDate,
    endDate,
    {
      concurrency: fmp.concurrency,
      requestIntervalMs: fmp.requestIntervalMs,
      onProgress,
      onLog,
    },
  );

  let totalUpserted = 0;
  let fetchOk = 0;
  let fetchFail = 0;
  for (const ticker of uniqueTickers) {
    const bars = batch.results.get(ticker) ?? [];
    if (bars.length === 0) {
      fetchFail++;
      continue;
    }
    fetchOk++;
    const n = await upsertBars(ticker, bars);
    totalUpserted += n;
  }
  for (const [ticker, message] of batch.errors) {
    onLog?.(`[FMP fallback] ${ticker}: ${message}`);
  }
  onLog?.(`[FMP fallback] fetched=${fetchOk}, failed=${fetchFail}, upserted=${totalUpserted} bars`);

  // Re-compute metrics for the missing items (now OHLC DB should have data)
  const recomputed: ComputedMetrics[] = [];
  let recomputedCount = 0;
  for (const item of missingItems) {
    const m = await computeMetricsForItem(item.newsId, item.ticker, item.publishedAt);
    if (m) recomputed.push(m);
    recomputedCount++;
    onProgress?.(recomputedCount, missingItems.length);
  }
  onLog?.(`[FMP fallback] re-computed ${recomputed.length}/${missingItems.length} items`);
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

async function deleteMetricsForNewsIds(
  newsIds: string[],
  metricKeys: readonly string[] = STANDARD_METRIC_KEYS,
): Promise<void> {
  if (newsIds.length === 0) return;

  const db = getDb();
  const NEWS_CHUNK_SIZE = 200;
  const metricPlaceholders = metricKeys.map(() => "?").join(",");

  for (let start = 0; start < newsIds.length; start += NEWS_CHUNK_SIZE) {
    const chunk = newsIds.slice(start, start + NEWS_CHUNK_SIZE);
    const newsPlaceholders = chunk.map(() => "?").join(",");
    await db.run(
      `DELETE FROM news_change_metrics
       WHERE news_id IN (${newsPlaceholders})
         AND metric_key IN (${metricPlaceholders})`,
      [...chunk, ...metricKeys],
    );
  }
}

async function batchWriteMetricsWithProgress(
  metrics: ComputedMetrics[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (metrics.length === 0) {
    onProgress?.(0, 0);
    return;
  }

  const db = getDb();
  const ts = now();
  let written = 0;

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
        written += 1;
        onProgress?.(written, metrics.length);
      }
      await db.run("COMMIT");
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    }
  }
}

async function fillMissingVolatilityMetrics(
  metrics: ComputedMetrics[],
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  onProgress?: (completed: number, total: number) => void,
  onLog?: (msg: string) => void,
  missingKeysByNewsId?: Map<string, Set<string>>,
): Promise<{ written: number; targetedNewsRows: number }> {
  if (metrics.length === 0) {
    onProgress?.(0, 0);
    return { written: 0, targetedNewsRows: 0 };
  }

  const effectiveMissingKeys = missingKeysByNewsId ?? await getMissingVolatilityMetricKeysByNewsId(metrics.map((metric) => metric.newsId));
  const targetedMetrics = metrics.filter((metric) => (effectiveMissingKeys.get(metric.newsId)?.size ?? 0) > 0);

  if (targetedMetrics.length === 0) {
    onLog?.("[change] no missing HV/Z-score metrics to fill");
    onProgress?.(0, 0);
    return { written: 0, targetedNewsRows: 0 };
  }

  const rows = await computeMissingVolatilityRows(targetedMetrics, effectiveMissingKeys, concurrency, isCancelled);
  if (isCancelled?.()) {
    return { written: 0, targetedNewsRows: targetedMetrics.length };
  }

  await batchWriteVolatilityMetricRows(rows, onProgress);
  onLog?.(`[change] wrote ${rows.length} HV/Z-score metric rows for ${targetedMetrics.length} news rows`);
  return { written: rows.length, targetedNewsRows: targetedMetrics.length };
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
  const missingKeysByNewsId = new Map<string, Set<string>>(
    computed.map((metric) => [metric.newsId, new Set<string>(VOLATILITY_METRIC_KEYS)]),
  );
  await fillMissingVolatilityMetrics(computed, concurrency, isCancelled, undefined, undefined, missingKeysByNewsId);

  return { merged: computed.length, skipped };
}

// ---------- Recent Change Update (all metrics, last 7 days of news) ----------

/** Compute ALL standard change metrics (open, 1d, 7d, 14d, 30d) for news
 *  published within the last 7 calendar days.
 *  If fmpFallback is enabled, tickers missing from OHLC DB are batch-fetched
 *  from FMP, upserted, then re-computed.
 *  Progress callback: (completed, total) */
export async function bulkUpdateRecentChange(
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  fmpFallback?: FmpFallbackOptions,
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
  const invalidMetricNewsIds = new Set<string>();
  let skipped = 0;
  let completed = 0;
  const totalUnits = Math.max(rows.length * 4, 1);
  const scanPhaseUnits = rows.length;
  const fallbackPhaseBase = scanPhaseUnits;
  const writePhaseBase = scanPhaseUnits * 2;
  const writeVolatilityPhaseBase = scanPhaseUnits * 3;

  onLog?.(`[change] Phase 1/4: scanning ${rows.length} recent news items for OHLC...`);
  // Phase 1: parallel OHLC reads + compute from DB
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; invalidMetricNewsIds.add(row.id); } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else {
        invalidMetricNewsIds.add(row.id);
        missingItems.push({ newsId: row.id, ticker, publishedAt: row.published_at });
      }
    }
    completed++;
    if (onProgress && (completed % 50 === 0 || completed === rows.length)) {
      onProgress(completed, totalUnits);
    }
  }, isCancelled);
  onLog?.(`[change] Phase 1 done: ${computed.length} computed, ${missingItems.length} missing OHLC, ${skipped} skipped`);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 1.5: FMP fallback for missing tickers
  if (fmpFallback?.enabled && missingItems.length > 0) {
    onProgress?.(fallbackPhaseBase, totalUnits);
    onLog?.(`[change] Phase 1.5/4: FMP fallback for ${missingItems.length} items...`);
    try {
      const fallbackMetrics = await fmpFallbackFetch(missingItems, fmpFallback, onLog, (fallbackDone, fallbackTotal) => {
        const phaseProgress = fallbackTotal > 0
          ? Math.floor((fallbackDone / fallbackTotal) * scanPhaseUnits)
          : scanPhaseUnits;
        onProgress?.(fallbackPhaseBase + phaseProgress, totalUnits);
      });
      computed.push(...fallbackMetrics);
      for (const metric of fallbackMetrics) {
        invalidMetricNewsIds.delete(metric.newsId);
      }
      skipped += missingItems.length - fallbackMetrics.length;
      onLog?.(`[change] FMP fallback done: ${fallbackMetrics.length} computed, ${missingItems.length - fallbackMetrics.length} still missing`);
    } catch (err) {
      onLog?.(`[change] FMP fallback error: ${err instanceof Error ? err.message : String(err)}`);
      skipped += missingItems.length;
    }
  } else {
    skipped += missingItems.length;
  }

  onProgress?.(writePhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  await deleteMetricsForNewsIds([...invalidMetricNewsIds], ALL_CHANGE_METRIC_KEYS);

  // Phase 2: batch write
  onLog?.(`[change] Phase 2/4: writing ${computed.length} change metrics...`);
  await batchWriteMetricsWithProgress(computed, (written, total) => {
    const phaseProgress = total > 0
      ? Math.floor((written / total) * scanPhaseUnits)
      : scanPhaseUnits;
    onProgress?.(writePhaseBase + phaseProgress, totalUnits);
  });
  onLog?.(`[change] Phase 2 done: ${computed.length} metrics written`);

  onProgress?.(writeVolatilityPhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  onLog?.(`[change] Phase 3/4: filling missing HV / Z-score...`);
  await fillMissingVolatilityMetrics(
    computed,
    concurrency,
    isCancelled,
    (written, total) => {
      const phaseProgress = total > 0
        ? Math.floor((written / total) * scanPhaseUnits)
        : scanPhaseUnits;
      onProgress?.(writeVolatilityPhaseBase + phaseProgress, totalUnits);
    },
    onLog,
  );

  onProgress?.(totalUnits, totalUnits);
  onLog?.(`[change] Done: updated=${computed.length}, skipped=${skipped}`);
  return { updated: computed.length, skipped };
}

/** Compute standard change metrics only for recent news rows that currently do not have change_pct.
 *  Scope: last 7 calendar days of news, missing metrics only.
 *  If FMP fallback is enabled, missing OHLC is pulled from FMP before recompute. */
export async function bulkUpdateRecentMissingChange(
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  fmpFallback?: FmpFallbackOptions,
  onLog?: (msg: string) => void,
): Promise<{ updated: number; skipped: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffIso = cutoff.toISOString();

  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT ni.id, ni.tickers_csv, ni.published_at
     FROM news_items ni
     LEFT JOIN news_change_metrics ncm
       ON ncm.news_id = ni.id AND ncm.metric_key = 'change_pct'
     WHERE ni.published_at >= ?
       AND ncm.news_id IS NULL
     ORDER BY ni.published_at DESC`,
    [cutoffIso],
  );

  const computed: ComputedMetrics[] = [];
  const missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }> = [];
  const invalidMetricNewsIds = new Set<string>();
  let skipped = 0;
  let completed = 0;
  const totalUnits = Math.max(rows.length * 4, 1);
  const scanPhaseUnits = rows.length;
  const fallbackPhaseBase = scanPhaseUnits;
  const writePhaseBase = scanPhaseUnits * 2;
  const writeVolatilityPhaseBase = scanPhaseUnits * 3;

  onLog?.(`[change] Phase 1/4: scanning ${rows.length} missing news items for OHLC...`);
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map((ticker) => ticker.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) {
      skipped++;
      invalidMetricNewsIds.add(row.id);
    } else {
      const metric = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (metric) {
        computed.push(metric);
      } else {
        invalidMetricNewsIds.add(row.id);
        missingItems.push({ newsId: row.id, ticker, publishedAt: row.published_at });
      }
    }
    completed++;
    if (onProgress && (completed % 50 === 0 || completed === rows.length)) {
      onProgress(completed, totalUnits);
    }
  }, isCancelled);
  onLog?.(`[change] Phase 1 done: ${computed.length} computed, ${missingItems.length} missing OHLC, ${skipped} skipped`);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  if (fmpFallback?.enabled && missingItems.length > 0) {
    onProgress?.(fallbackPhaseBase, totalUnits);
    onLog?.(`[change] Phase 1.5/4: FMP fallback for ${missingItems.length} missing items...`);
    try {
      const fallbackMetrics = await fmpFallbackFetch(missingItems, fmpFallback, onLog, (fallbackDone, fallbackTotal) => {
        const phaseProgress = fallbackTotal > 0
          ? Math.floor((fallbackDone / fallbackTotal) * scanPhaseUnits)
          : scanPhaseUnits;
        onProgress?.(fallbackPhaseBase + phaseProgress, totalUnits);
      });
      computed.push(...fallbackMetrics);
      for (const metric of fallbackMetrics) {
        invalidMetricNewsIds.delete(metric.newsId);
      }
      skipped += missingItems.length - fallbackMetrics.length;
      onLog?.(`[change] FMP fallback done: ${fallbackMetrics.length} computed, ${missingItems.length - fallbackMetrics.length} still missing`);
    } catch (error) {
      onLog?.(`[change] FMP fallback error: ${error instanceof Error ? error.message : String(error)}`);
      skipped += missingItems.length;
    }
  } else {
    skipped += missingItems.length;
  }

  onProgress?.(writePhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  await deleteMetricsForNewsIds([...invalidMetricNewsIds], ALL_CHANGE_METRIC_KEYS);
  onLog?.(`[change] Phase 2/4: writing ${computed.length} change metrics...`);
  await batchWriteMetricsWithProgress(computed, (written, total) => {
    const phaseProgress = total > 0
      ? Math.floor((written / total) * scanPhaseUnits)
      : scanPhaseUnits;
    onProgress?.(writePhaseBase + phaseProgress, totalUnits);
  });
  onLog?.(`[change] Phase 2 done: ${computed.length} metrics written`);

  onProgress?.(writeVolatilityPhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  onLog?.(`[change] Phase 3/4: filling missing HV / Z-score...`);
  await fillMissingVolatilityMetrics(
    computed,
    concurrency,
    isCancelled,
    (written, total) => {
      const phaseProgress = total > 0
        ? Math.floor((written / total) * scanPhaseUnits)
        : scanPhaseUnits;
      onProgress?.(writeVolatilityPhaseBase + phaseProgress, totalUnits);
    },
    onLog,
  );

  onProgress?.(totalUnits, totalUnits);
  onLog?.(`[change] Done: updated=${computed.length}, skipped=${skipped}`);
  return { updated: computed.length, skipped };
}

// ---------- Custom Change Update (date range, all metrics) ----------

/** Compute ALL standard change metrics for news published within [from, to].
 *  from/to are ISO date strings (YYYY-MM-DD).
 *  If fmpFallback is enabled, tickers missing from OHLC DB are batch-fetched. */
export async function bulkUpdateCustomChange(
  from: string,
  to: string,
  onProgress?: (completed: number, total: number) => void,
  concurrency = DEFAULT_MERGE_CONCURRENCY,
  isCancelled?: () => boolean,
  fmpFallback?: FmpFallbackOptions,
  onLog?: (msg: string) => void,
): Promise<{ updated: number; skipped: number }> {
  const rows = await getDb().all<{ id: string; tickers_csv: string; published_at: string }[]>(
    `SELECT id, tickers_csv, published_at FROM news_items
     WHERE substr(published_at, 1, 10) >= ? AND substr(published_at, 1, 10) <= ?
     ORDER BY published_at DESC`,
    [from, to],
  );

  const computed: ComputedMetrics[] = [];
  const missingItems: Array<{ newsId: string; ticker: string; publishedAt: string }> = [];
  const invalidMetricNewsIds = new Set<string>();
  let skipped = 0;
  let completed = 0;
  const totalUnits = Math.max(rows.length * 4, 1);
  const scanPhaseUnits = rows.length;
  const fallbackPhaseBase = scanPhaseUnits;
  const writePhaseBase = scanPhaseUnits * 2;
  const writeVolatilityPhaseBase = scanPhaseUnits * 3;

  onLog?.(`[change] Phase 1/4: scanning ${rows.length} news items (${from}~${to}) for OHLC...`);
  // Phase 1: parallel OHLC reads + compute from DB
  await poolRun(rows, concurrency, async (row) => {
    const tickers = row.tickers_csv.split(",").map(t => t.trim()).filter(Boolean);
    const ticker = tickers[0];
    if (!ticker) { skipped++; invalidMetricNewsIds.add(row.id); } else {
      const m = await computeMetricsForItem(row.id, ticker, row.published_at);
      if (m) { computed.push(m); } else {
        invalidMetricNewsIds.add(row.id);
        missingItems.push({ newsId: row.id, ticker, publishedAt: row.published_at });
      }
    }
    completed++;
    if (onProgress && (completed % 50 === 0 || completed === rows.length)) {
      onProgress(completed, totalUnits);
    }
  }, isCancelled);
  onLog?.(`[change] Phase 1 done: ${computed.length} computed, ${missingItems.length} missing OHLC, ${skipped} skipped`);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  // Phase 1.5: FMP fallback for missing tickers
  if (fmpFallback?.enabled && missingItems.length > 0) {
    onProgress?.(fallbackPhaseBase, totalUnits);
    onLog?.(`[change] Phase 1.5/4: FMP fallback for ${missingItems.length} items...`);
    try {
      const fallbackMetrics = await fmpFallbackFetch(missingItems, fmpFallback, onLog, (fallbackDone, fallbackTotal) => {
        const phaseProgress = fallbackTotal > 0
          ? Math.floor((fallbackDone / fallbackTotal) * scanPhaseUnits)
          : scanPhaseUnits;
        onProgress?.(fallbackPhaseBase + phaseProgress, totalUnits);
      });
      computed.push(...fallbackMetrics);
      for (const metric of fallbackMetrics) {
        invalidMetricNewsIds.delete(metric.newsId);
      }
      skipped += missingItems.length - fallbackMetrics.length;
      onLog?.(`[change] FMP fallback done: ${fallbackMetrics.length} computed, ${missingItems.length - fallbackMetrics.length} still missing`);
    } catch (err) {
      onLog?.(`[change] FMP fallback error: ${err instanceof Error ? err.message : String(err)}`);
      skipped += missingItems.length;
    }
  } else {
    skipped += missingItems.length;
  }

  onProgress?.(writePhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  await deleteMetricsForNewsIds([...invalidMetricNewsIds], ALL_CHANGE_METRIC_KEYS);

  // Phase 2: batch write
  onLog?.(`[change] Phase 2/4: writing ${computed.length} change metrics...`);
  await batchWriteMetricsWithProgress(computed, (written, total) => {
    const phaseProgress = total > 0
      ? Math.floor((written / total) * scanPhaseUnits)
      : scanPhaseUnits;
    onProgress?.(writePhaseBase + phaseProgress, totalUnits);
  });
  onLog?.(`[change] Phase 2 done: ${computed.length} metrics written`);

  onProgress?.(writeVolatilityPhaseBase, totalUnits);

  if (isCancelled?.()) return { updated: computed.length, skipped };

  onLog?.(`[change] Phase 3/4: filling missing HV / Z-score...`);
  await fillMissingVolatilityMetrics(
    computed,
    concurrency,
    isCancelled,
    (written, total) => {
      const phaseProgress = total > 0
        ? Math.floor((written / total) * scanPhaseUnits)
        : scanPhaseUnits;
      onProgress?.(writeVolatilityPhaseBase + phaseProgress, totalUnits);
    },
    onLog,
  );

  onProgress?.(totalUnits, totalUnits);
  onLog?.(`[change] Done: updated=${computed.length}, skipped=${skipped}`);
  return { updated: computed.length, skipped };
}
