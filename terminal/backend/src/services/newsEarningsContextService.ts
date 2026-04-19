import { getDb } from "../db.js";
import { upsertCalendarEvent } from "./calendarRepository.js";
import { fetchFmpEarningsCalendarChunk } from "./fmpEarningsCalendarProvider.js";
import type { NewsEarningsCandidate } from "./newsRepository.js";
import { getEtDateString } from "./timeUtils.js";
import { normalizeFmpSymbol } from "../utils/fmpSymbol.js";

const DEFAULT_FALLBACK_WINDOW_DAYS = 180;
const DEFAULT_WORKER_CONCURRENCY = 8;
const TICKER_BATCH_SIZE = 300;

type NewsEarningsUpdateMode = "custom" | "check-unconfirmed" | "full-scan";
type NewsEarningsLookupStatus = "resolved" | "partial" | "missing" | "error";
type NewsEarningsSource = "calendar" | "fmp" | "none";

type CalendarEarningsRow = {
  id: string;
  ticker: string;
  source: string;
  eventAt: string;
  reportDate: string;
  confirmed: boolean;
};

type ResolvedCalendarSide = {
  date: string;
  confirmed: boolean;
  calendarEventId: string;
  source: NewsEarningsSource;
};

type RuntimeCandidate = NewsEarningsCandidate & {
  anchorDate: string;
  contextTicker: string | null;
};

export interface NewsEarningsUpdateResult {
  mode: NewsEarningsUpdateMode;
  totalCandidates: number;
  targetedCandidates: number;
  skippedExisting: number;
  workerConcurrency: number;
  processed: number;
  resolved: number;
  partial: number;
  missing: number;
  fallbackTickers: number;
  fallbackFetchedRows: number;
  fallbackMatchedRows: number;
  fallbackUpsertedRows: number;
}

export function clampNewsEarningsWorkerConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  return Math.max(1, Math.min(32, Math.trunc(value as number)));
}

function createAsyncMutex() {
  let current = Promise.resolve();

  return async <T>(callback: () => Promise<T>): Promise<T> => {
    const previous = current;
    let releaseCurrent!: () => void;
    current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    await previous;
    try {
      return await callback();
    } finally {
      releaseCurrent();
    }
  };
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeTicker(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function chooseContextTicker(candidate: NewsEarningsCandidate): string | null {
  const ohlcTicker = normalizeTicker(candidate.ohlcTicker);
  if (ohlcTicker) {
    return ohlcTicker;
  }
  return normalizeTicker(candidate.tickers[0]);
}

function shouldProcessCandidate(candidate: NewsEarningsCandidate, mode: NewsEarningsUpdateMode): boolean {
  if (mode === "check-unconfirmed") {
    return candidate.existingRecentEarningsConfirmed === false || candidate.existingUpcomingEarningsConfirmed === false;
  }

  return !candidate.existingLookupStatus
    || candidate.existingLookupStatus === "partial"
    || candidate.existingLookupStatus === "error";
}

function preferCalendarRow(candidate: CalendarEarningsRow, current: CalendarEarningsRow): boolean {
  if (candidate.confirmed !== current.confirmed) {
    return candidate.confirmed;
  }

  const candidateFmp = candidate.source === "FMP";
  const currentFmp = current.source === "FMP";
  if (candidateFmp !== currentFmp) {
    return candidateFmp;
  }

  if (candidate.eventAt !== current.eventAt) {
    return candidate.eventAt > current.eventAt;
  }

  return candidate.id > current.id;
}

function normalizeCalendarSource(source: string | null | undefined): NewsEarningsSource {
  return source === "FMP" ? "fmp" : source ? "calendar" : "none";
}

function computeLookupStatus(
  recent: ResolvedCalendarSide | null,
  upcoming: ResolvedCalendarSide | null,
): NewsEarningsLookupStatus {
  if (recent && upcoming) {
    return "resolved";
  }
  if (recent || upcoming) {
    return "partial";
  }
  return "missing";
}

function resolveCalendarSides(
  rows: CalendarEarningsRow[],
  anchorDate: string,
): { recent: ResolvedCalendarSide | null; upcoming: ResolvedCalendarSide | null } {
  let recentRow: CalendarEarningsRow | null = null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.reportDate <= anchorDate) {
      recentRow = row;
      break;
    }
  }

  let upcomingRow: CalendarEarningsRow | null = null;
  for (const row of rows) {
    if (row.reportDate >= anchorDate) {
      upcomingRow = row;
      break;
    }
  }

  return {
    recent: recentRow
      ? {
        date: recentRow.reportDate,
        confirmed: recentRow.confirmed,
        calendarEventId: recentRow.id,
        source: normalizeCalendarSource(recentRow.source),
      }
      : null,
    upcoming: upcomingRow
      ? {
        date: upcomingRow.reportDate,
        confirmed: upcomingRow.confirmed,
        calendarEventId: upcomingRow.id,
        source: normalizeCalendarSource(upcomingRow.source),
      }
      : null,
  };
}

async function loadCalendarEarningsRows(params: {
  tickers: string[];
  from: string;
  to: string;
}): Promise<Map<string, CalendarEarningsRow[]>> {
  const normalizedTickers = Array.from(new Set(params.tickers.map((ticker) => normalizeTicker(ticker)).filter((ticker): ticker is string => Boolean(ticker))));
  const grouped = new Map<string, Map<string, CalendarEarningsRow>>();

  if (normalizedTickers.length === 0) {
    return new Map();
  }

  for (let offset = 0; offset < normalizedTickers.length; offset += TICKER_BATCH_SIZE) {
    const batch = normalizedTickers.slice(offset, offset + TICKER_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const rows = await getDb().all<any[]>(
      `SELECT id,
              ticker,
              source,
              event_at,
              COALESCE(json_extract(meta_json, '$.report_date'), substr(event_at, 1, 10)) AS report_date,
              CASE
                WHEN json_type(meta_json, '$.confirmed') IS NOT NULL THEN
                  CASE
                    WHEN LOWER(CAST(json_extract(meta_json, '$.confirmed') AS TEXT)) IN ('1', 'true') THEN 1
                    ELSE 0
                  END
                WHEN json_extract(meta_json, '$.eps_actual') IS NOT NULL OR json_extract(meta_json, '$.revenue_actual') IS NOT NULL THEN 1
                ELSE 0
              END AS confirmed
       FROM calendar_events
       WHERE event_type = 'earnings'
         AND ticker IN (${placeholders})
         AND COALESCE(json_extract(meta_json, '$.report_date'), substr(event_at, 1, 10)) >= ?
         AND COALESCE(json_extract(meta_json, '$.report_date'), substr(event_at, 1, 10)) <= ?`,
      [...batch, params.from, params.to],
    );

    for (const row of rows) {
      const ticker = normalizeTicker(row.ticker);
      const reportDate = typeof row.report_date === "string" ? row.report_date : null;
      if (!ticker || !reportDate) {
        continue;
      }

      const nextRow: CalendarEarningsRow = {
        id: row.id,
        ticker,
        source: row.source ?? "",
        eventAt: row.event_at,
        reportDate,
        confirmed: row.confirmed === 1,
      };

      let tickerRows = grouped.get(ticker);
      if (!tickerRows) {
        tickerRows = new Map();
        grouped.set(ticker, tickerRows);
      }
      const current = tickerRows.get(reportDate);
      if (!current || preferCalendarRow(nextRow, current)) {
        tickerRows.set(reportDate, nextRow);
      }
    }
  }

  const result = new Map<string, CalendarEarningsRow[]>();
  for (const [ticker, rowsByDate] of grouped) {
    const rows = Array.from(rowsByDate.values()).sort((left, right) => left.reportDate.localeCompare(right.reportDate));
    result.set(ticker, rows);
  }
  return result;
}

async function upsertNewsEarningsContext(params: {
  newsId: string;
  contextTicker: string | null;
  anchorPublishedAt: string;
  recent: ResolvedCalendarSide | null;
  upcoming: ResolvedCalendarSide | null;
  lookupStatus: NewsEarningsLookupStatus;
  fmpFallbackUsed: boolean;
}): Promise<void> {
  await getDb().run(
    `INSERT INTO news_earnings_context (
       news_id,
       context_ticker,
       anchor_published_at,
       recent_earnings_date,
       recent_earnings_confirmed,
       upcoming_earnings_date,
       upcoming_earnings_confirmed,
       recent_calendar_event_id,
       upcoming_calendar_event_id,
       recent_source,
       upcoming_source,
       lookup_status,
       fmp_fallback_used,
       last_checked_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(news_id) DO UPDATE SET
       context_ticker = excluded.context_ticker,
       anchor_published_at = excluded.anchor_published_at,
       recent_earnings_date = excluded.recent_earnings_date,
       recent_earnings_confirmed = excluded.recent_earnings_confirmed,
       upcoming_earnings_date = excluded.upcoming_earnings_date,
       upcoming_earnings_confirmed = excluded.upcoming_earnings_confirmed,
       recent_calendar_event_id = excluded.recent_calendar_event_id,
       upcoming_calendar_event_id = excluded.upcoming_calendar_event_id,
       recent_source = excluded.recent_source,
       upcoming_source = excluded.upcoming_source,
       lookup_status = excluded.lookup_status,
       fmp_fallback_used = excluded.fmp_fallback_used,
       last_checked_at = datetime('now')`,
    [
      params.newsId,
      params.contextTicker,
      params.anchorPublishedAt,
      params.recent?.date ?? null,
      params.recent ? (params.recent.confirmed ? 1 : 0) : null,
      params.upcoming?.date ?? null,
      params.upcoming ? (params.upcoming.confirmed ? 1 : 0) : null,
      params.recent?.calendarEventId ?? null,
      params.upcoming?.calendarEventId ?? null,
      params.recent?.source ?? "none",
      params.upcoming?.source ?? "none",
      params.lookupStatus,
      params.fmpFallbackUsed ? 1 : 0,
    ],
  );
}

async function batchUpsertFallbackRows(params: {
  tickers: Set<string>;
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<{ fetchedRows: number; matchedRows: number; upsertedRows: number }> {
  if (params.tickers.size === 0) {
    return { fetchedRows: 0, matchedRows: 0, upsertedRows: 0 };
  }

  const canonicalTickerByNormalized = new Map<string, string>();
  for (const ticker of params.tickers) {
    const canonicalTicker = normalizeTicker(ticker);
    if (!canonicalTicker) {
      continue;
    }
    canonicalTickerByNormalized.set(normalizeFmpSymbol(canonicalTicker) ?? canonicalTicker, canonicalTicker);
  }

  const fetched = await fetchFmpEarningsCalendarChunk({
    from: params.from,
    to: params.to,
    requestIntervalMs: params.requestIntervalMs,
  });

  const matchedByKey = new Map<string, { canonicalTicker: string; reportDate: string; confirmed: boolean; item: Awaited<ReturnType<typeof fetchFmpEarningsCalendarChunk>>[number] }>();
  for (const item of fetched) {
    const normalizedSymbol = normalizeFmpSymbol(item.symbol) ?? item.symbol;
    const canonicalTicker = canonicalTickerByNormalized.get(normalizedSymbol);
    if (!canonicalTicker) {
      continue;
    }

    const reportDate = item.date.slice(0, 10);
    const confirmed = item.epsActual != null || item.revenueActual != null;
    const key = `${canonicalTicker}|${reportDate}`;
    const current = matchedByKey.get(key);
    if (!current || (confirmed && !current.confirmed)) {
      matchedByKey.set(key, {
        canonicalTicker,
        reportDate,
        confirmed,
        item,
      });
    }
  }

  if (matchedByKey.size === 0) {
    return {
      fetchedRows: fetched.length,
      matchedRows: 0,
      upsertedRows: 0,
    };
  }

  const db = getDb();
  await db.run("BEGIN IMMEDIATE");
  try {
    for (const entry of matchedByKey.values()) {
      await upsertCalendarEvent({
        type: "earnings",
        eventTime: `${entry.reportDate}T12:00:00.000Z`,
        ticker: entry.canonicalTicker,
        title: `${entry.canonicalTicker} earnings`,
        fieldsJson: {
          company_name: null,
          report_date: entry.reportDate,
          time_of_day: null,
          session: null,
          confirmed: entry.confirmed,
          eps_est: entry.item.epsEstimated,
          eps_actual: entry.item.epsActual,
          revenue_est: entry.item.revenueEstimated,
          revenue_actual: entry.item.revenueActual,
          surprise_pct: null,
          last_updated: entry.item.lastUpdated,
        },
        source: "FMP",
        uniqueKey: `FMP:earnings:${entry.canonicalTicker}:${entry.reportDate}`,
      });
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }

  return {
    fetchedRows: fetched.length,
    matchedRows: matchedByKey.size,
    upsertedRows: matchedByKey.size,
  };
}

export async function runNewsEarningsContextUpdate(params: {
  candidates: NewsEarningsCandidate[];
  mode: NewsEarningsUpdateMode;
  fallbackWindowDays?: number;
  workerConcurrency?: number;
  requestIntervalMs?: number;
  shouldCancel?: () => boolean;
  onProgress?: (completed: number, total: number) => void;
  onLog?: (message: string) => void;
}): Promise<NewsEarningsUpdateResult> {
  const fallbackWindowDays = Number.isFinite(params.fallbackWindowDays)
    ? Math.max(30, Math.min(365, Math.trunc(params.fallbackWindowDays as number)))
    : DEFAULT_FALLBACK_WINDOW_DAYS;
  const workerConcurrency = clampNewsEarningsWorkerConcurrency(params.workerConcurrency);
  const log = (message: string) => params.onLog?.(message);
  const progress = (completed: number, total: number) => params.onProgress?.(completed, total);

  const runtimeCandidates: RuntimeCandidate[] = params.candidates
    .filter((candidate) => shouldProcessCandidate(candidate, params.mode))
    .map((candidate) => ({
      ...candidate,
      anchorDate: getEtDateString(candidate.publishedAt),
      contextTicker: chooseContextTicker(candidate),
    }));

  const skippedExisting = params.candidates.length - runtimeCandidates.length;
  const result: NewsEarningsUpdateResult = {
    mode: params.mode,
    totalCandidates: params.candidates.length,
    targetedCandidates: runtimeCandidates.length,
    skippedExisting,
    workerConcurrency,
    processed: 0,
    resolved: 0,
    partial: 0,
    missing: 0,
    fallbackTickers: 0,
    fallbackFetchedRows: 0,
    fallbackMatchedRows: 0,
    fallbackUpsertedRows: 0,
  };

  progress(0, runtimeCandidates.length);
  log(`mode=${params.mode}, totalCandidates=${params.candidates.length}, targeted=${runtimeCandidates.length}, skippedExisting=${skippedExisting}`);
  log(`workerConcurrency=${workerConcurrency}`);

  if (runtimeCandidates.length === 0 || params.shouldCancel?.()) {
    return result;
  }

  const tickers = Array.from(new Set(runtimeCandidates.map((candidate) => candidate.contextTicker).filter((ticker): ticker is string => Boolean(ticker))));
  const anchorDates = runtimeCandidates.map((candidate) => candidate.anchorDate).sort();
  const rangeFrom = shiftIsoDate(anchorDates[0], -fallbackWindowDays);
  const rangeTo = shiftIsoDate(anchorDates[anchorDates.length - 1], fallbackWindowDays);

  let calendarRowsByTicker = await loadCalendarEarningsRows({
    tickers,
    from: rangeFrom,
    to: rangeTo,
  });

  const fallbackTickers = new Set<string>();
  for (const candidate of runtimeCandidates) {
    if (!candidate.contextTicker) {
      continue;
    }
    const sides = resolveCalendarSides(calendarRowsByTicker.get(candidate.contextTicker) ?? [], candidate.anchorDate);
    if (!sides.recent || !sides.upcoming) {
      fallbackTickers.add(candidate.contextTicker);
    }
  }

  if (fallbackTickers.size > 0 && !params.shouldCancel?.()) {
    result.fallbackTickers = fallbackTickers.size;
    log(`calendar-first pass left ${fallbackTickers.size} tickers unresolved; fetching FMP fallback for ${rangeFrom}~${rangeTo}`);
    const fallbackResult = await batchUpsertFallbackRows({
      tickers: fallbackTickers,
      from: rangeFrom,
      to: rangeTo,
      requestIntervalMs: params.requestIntervalMs,
    });
    result.fallbackFetchedRows = fallbackResult.fetchedRows;
    result.fallbackMatchedRows = fallbackResult.matchedRows;
    result.fallbackUpsertedRows = fallbackResult.upsertedRows;
    log(`fmp fallback: fetched=${fallbackResult.fetchedRows}, matched=${fallbackResult.matchedRows}, upserted=${fallbackResult.upsertedRows}`);
    calendarRowsByTicker = await loadCalendarEarningsRows({
      tickers,
      from: rangeFrom,
      to: rangeTo,
    });
  }

  const withWriteLock = createAsyncMutex();
  const effectiveWorkerCount = Math.min(workerConcurrency, runtimeCandidates.length);
  let nextCandidateIndex = 0;

  const runWorker = async () => {
    while (!params.shouldCancel?.()) {
      const currentIndex = nextCandidateIndex;
      nextCandidateIndex += 1;
      if (currentIndex >= runtimeCandidates.length) {
        return;
      }

      const candidate = runtimeCandidates[currentIndex];
      const rows = candidate.contextTicker
        ? calendarRowsByTicker.get(candidate.contextTicker) ?? []
        : [];
      const sides = resolveCalendarSides(rows, candidate.anchorDate);
      const lookupStatus = computeLookupStatus(sides.recent, sides.upcoming);

      await withWriteLock(() => upsertNewsEarningsContext({
        newsId: candidate.id,
        contextTicker: candidate.contextTicker,
        anchorPublishedAt: candidate.publishedAt,
        recent: sides.recent,
        upcoming: sides.upcoming,
        lookupStatus,
        fmpFallbackUsed: Boolean(candidate.contextTicker && fallbackTickers.has(candidate.contextTicker)),
      }));

      result.processed += 1;
      if (lookupStatus === "resolved") {
        result.resolved += 1;
      } else if (lookupStatus === "partial") {
        result.partial += 1;
      } else {
        result.missing += 1;
      }
      progress(result.processed, runtimeCandidates.length);
    }
  };

  await Promise.all(Array.from({ length: effectiveWorkerCount }, () => runWorker()));

  return result;
}