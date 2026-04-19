import express from "express";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { deleteBlockedFinnhubCompanyNews, getModel1News, getModel1NewsById, getNews, getNewsById, getNewsIdBySourceUrl, getTickerNewsCoverage, listNewsEarningsCandidates, type IsoDateRange } from "./services/newsRepository.js";
import { createSavedView, deleteSavedView, listSavedViews } from "./services/savedViewRepository.js";
import { createWatchlist, deleteWatchlist, listWatchlists, updateWatchlist, backfillWatchlistSecurityIds } from "./services/watchlistRepository.js";
import {
  exportCalendarEventsCsv,
  getCalendarEventById,
  getCalendarTypes,
  listCalendarEvents,
  upsertCalendarEvent,
  deleteMockCalendarRows,
  deleteCalendarEventsForSourceRange,
} from "./services/calendarRepository.js";
import { listAlertRules, upsertAlertRule } from "./services/alertsRepository.js";
import { StreamHub } from "./realtime/streamHub.js";
import { ensureSeedData } from "./seed.js";
import { pullIbkrCalendar, pullIbkrCalendarCustom, getCalendarDateRange } from "./services/calendarIngestion.js";
import type { CalendarUpdateMode } from "./services/calendarIngestion.js";
import { pullEodhdNews, pullEodhdNewsAll } from "./services/eodhdNewsProvider.js";
import { insertNewsItem, insertSecFilingCompanion, updateNewsBodyById } from "./services/newsRepository.js";
import { getUpdateStatus, listUpdateStatuses, setLastSuccess } from "./services/updateStatusRepository.js";
import { readTickersFromCsv, appendTickerToCsv, removeTickerFromCsv, readTickerRowsFromCsv, CsvServiceError } from "./services/tickerCsvService.js";
import {
  fetchCompanyNewsRaw,
  fetchPressReleasesRaw,
  pullMarketNewsWithMeta,
  pullMarketNewsBackfillWithMeta,
  pullCompanyNewsBackfill,
  pullPressReleasesBackfill,
  getTickersWithNews,
  getTickerAnchorMap,
  upsertSentimentSnapshot,
  recordConfirmedEmpty,
  getConfirmedEmptyRange,
} from "./services/finnhubNewsProvider.js";
import type { FinnhubMappedItem } from "./services/finnhubNewsProvider.js";
import { mergeChangeForNewItems, bulkUpdateRecentChange, bulkUpdateRecentMissingChange, bulkUpdateCustomChange, type FmpFallbackOptions } from "./services/newsChangeMerger.js";
import { createJob, getJob, getActiveJobs, updateProgress, appendLog, completeJob, failJob, cancelJob, isJobCancelled } from "./services/jobManager.js";
import { getFmpSecFulltextBackfillRows, getFulltext, getUnextractedNewsIds, deleteFailedFulltextRows, deleteFmpPressReleaseFallbackRows, deleteFmpStockNewsFallbackRows, deleteCompanyNewsFulltextRows, getFulltextStats, upsertProvidedFulltext } from "./services/fulltextRepository.js";
import { runFulltextUpdate, runFulltextUpdateForNewsIds, runFulltextPlainTextBackfill, runRtprBodyBackfill, runOriginUrlBackfill, runCompanyNewsOriginUrlBackfill, extractAndPersistFulltext } from "./services/fulltextUpdateService.js";
import { extractOriginUrl } from "./services/rtprOriginUrlExtractor.js";
import { htmlToPlainText } from "./services/fulltextExtractors.js";
import { backfillPublisher } from "./services/finnhubNewsProvider.js";
import { validateAnalysisCompleteness } from "./services/aiAnalysisRepository.js";
import {
  upsertSecurity,
  upsertUniverse,
  addUniverseItem,
  listUniverses,
  listUniverseItems,
  countSecurities,
  countUniverseItems,
  getSecurityByTicker,
  removeUniverseItemByTicker,
} from "./services/tickerUniverseRepository.js";
import { getDb } from "./db.js";
import {
  getOhlcDbPath,
  getOverallMaxDate,
  ensureDerivedColumns,
  upsertBars,
  getSymbolMaxDate,
  shouldExcludeCurrentEtDailyBar,
} from "./services/ohlcWatchlistRepository.js";
import { getDefaultDailyChangeHistory } from "./services/dailyChangeHistoryRepository.js";
import { fetchOhlcBars } from "./services/ibkrOhlc1dProvider.js";
import { computeDerivedForAffectedSymbols, computeMissingTurnoverForSymbol } from "./services/ohlcDerivedMetrics.js";
import { clampFmpOhlcConcurrency, clampFmpOhlcIntervalMs, fetchFmpOhlcBatch } from "./services/fmpOhlcProvider.js";
import type { NewsQuery } from "./types.js";
import {
  listResearchTabs,
  createResearchTab,
  renameResearchTab,
  deleteResearchTab,
  listTrashedResearchTabs,
  restoreResearchTab,
  listResearchPages,
  getResearchPage,
  createResearchPage,
  updateResearchPage,
  deleteResearchPage,
  listTrashedResearchPages,
  restoreResearchPage,
  reorderResearchPages,
  searchResearch,
  purgeExpiredResearchTrash,
} from "./services/researchRepository.js";
import {
  cleanupBlockedFinnhubCompanyNewsEvidence,
  deleteModel2AnalysisRun,
  getModel2AnalysisRun,
  listModel2Analyses,
  listModel2CaseSummaries,
  listModel2EvidenceRows,
} from "./services/model2AnalysisRepository.js";
import { fetchRtprArticles, fetchRtprArticlesByTicker } from "./services/ptprNewsProvider.js";
import { fetchFmpPressReleasesByTicker } from "./services/fmpPressReleaseProvider.js";
import { fetchFmpStockNewsByTicker } from "./services/fmpStockNewsProvider.js";
import { fetchFmpSecFilings } from "./services/fmpSecFilingProvider.js";
import { fetchFmpEarningsCalendarChunk } from "./services/fmpEarningsCalendarProvider.js";
import { fetchFmpFinancialSeries } from "./services/fmpFinancialSeriesProvider.js";
import { createFmpRequestScheduler } from "./services/fmpRequestScheduler.js";
import { getStoredCalendarFinancialSeries, replaceCalendarFinancialSeriesSnapshot } from "./services/calendarFinancialRepository.js";
import {
  fetchFmpIpoCalendarChunk,
  fetchFmpIpoDisclosureChunk,
  fetchFmpIpoProspectusChunk,
  type FmpIpoDisclosureItem,
  type FmpIpoProspectusItem,
} from "./services/fmpIpoCalendarProvider.js";
import { upsertIpoSecEnrichment } from "./services/ipoSecEnrichmentRepository.js";
import { downloadIpoSecInsights, fetchSecSicByCik, getTickerToCikMap, fetchSecEdgarSubmission } from "./services/ipoSecInsights.js";
import { generateSecFilingSummary } from "./services/secFilingSummary.js";
import { getEtDateString } from "./services/timeUtils.js";
import {
  fetchInvestingCategory,
  fetchAllInvestingCategories,
  investingCategoryToSourceType,
  type InvestingCategory,
} from "./services/investingNewsProvider.js";
import {
  clampFinnhubCompanyDataConcurrency,
  getFinnhubCompanyDataDefaults,
} from "./services/finnhubCompanyDataThrottle.js";
import { normalizeFmpSymbol } from "./utils/fmpSymbol.js";
import { runNewsEarningsContextUpdate } from "./services/newsEarningsContextService.js";

const app = express();
const streamHub = new StreamHub();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
const DEV_BACKEND_RESTART_ENABLED =
  process.env.npm_lifecycle_event === "dev" ||
  process.argv.some((arg) => arg.includes("tsx"));
const DEV_BACKEND_RESTART_TOUCH_PATH = fileURLToPath(import.meta.url);

const DEFAULT_FINNHUB_TICKER_CONCURRENCY = 5;
const DEFAULT_FINNHUB_REQUEST_INTERVAL_MS = 1000;
const DEFAULT_RTPR_TICKER_CONCURRENCY = 5;
const DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY = 25;
const DEFAULT_FINNHUB_COMPANY_DATA = getFinnhubCompanyDataDefaults();
const DEFAULT_FMP_CALENDAR_CHUNK_DAYS = 30;
const DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS = 250;

function buildBatchLevels(requestedConcurrency: number): number[] {
  const safeConcurrency = Math.max(1, Math.min(20, Math.floor(requestedConcurrency)));
  const middleConcurrency = Math.max(1, Math.ceil(safeConcurrency / 2));
  return [...new Set([safeConcurrency, middleConcurrency, 1])].sort((a, b) => b - a);
}

function createAsyncMutex() {
  let scheduler: Promise<void> = Promise.resolve();

  return async function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = scheduler;
    let release!: () => void;
    scheduler = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

type GapExecutionMode = "gap-only" | "fully-covered-skip" | "summary-only";

type TickerGapPlan = {
  ticker: string;
  coveredRanges: IsoDateRange[];
  missingRanges: IsoDateRange[];
  requestedDayCount: number;
  missingDayCount: number;
  fullyCovered: boolean;
  executionMode: GapExecutionMode;
};

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function countIsoDateRangeDays(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return 0;
  }
  return Math.floor((toMs - fromMs) / 86_400_000) + 1;
}

/**
 * Build missing ranges from the envelope (min~max) of covered data.
 * Given a single covered envelope [envFrom, envTo], the gaps are:
 *   - [from, envFrom - 1 day]  (if from < envFrom)
 *   - [envTo + 1 day, to]      (if envTo < to)
 * If there is no coverage at all, the entire [from, to] is missing.
 */
function buildMissingRangesFromEnvelope(from: string, to: string, coveredRanges: IsoDateRange[]): IsoDateRange[] {
  if (coveredRanges.length === 0) {
    return [{ from, to }];
  }
  // coveredRanges is always a single envelope [min_date, max_date]
  const envFrom = coveredRanges[0].from;
  const envTo = coveredRanges[coveredRanges.length - 1].to;
  const gaps: IsoDateRange[] = [];
  if (from < envFrom) {
    gaps.push({ from, to: addDaysToIsoDate(envFrom, -1) });
  }
  if (envTo < to) {
    gaps.push({ from: addDaysToIsoDate(envTo, 1), to });
  }
  return gaps;
}

function sumIsoDateRangeDays(ranges: IsoDateRange[]): number {
  return ranges.reduce((total, range) => total + countIsoDateRangeDays(range.from, range.to), 0);
}

function isIsoDateInRanges(isoDate: string, ranges: IsoDateRange[]): boolean {
  return ranges.some((range) => isoDate >= range.from && isoDate <= range.to);
}

async function buildTickerGapPlans(params: {
  tickers: string[];
  source: string;
  sourceType: string;
  from: string;
  to: string;
  executionMode: GapExecutionMode;
}): Promise<Map<string, TickerGapPlan>> {
  const coverageMap = await getTickerNewsCoverage({
    tickers: params.tickers,
    source: params.source,
    sourceType: params.sourceType,
    from: params.from,
    to: params.to,
  });
  const requestedDayCount = countIsoDateRangeDays(params.from, params.to);
  const plans = new Map<string, TickerGapPlan>();

  for (const ticker of params.tickers) {
    const coverage = coverageMap.get(ticker) ?? { coveredRanges: [] };
    const missingRanges = buildMissingRangesFromEnvelope(params.from, params.to, coverage.coveredRanges);
    plans.set(ticker, {
      ticker,
      coveredRanges: coverage.coveredRanges,
      missingRanges,
      requestedDayCount,
      missingDayCount: sumIsoDateRangeDays(missingRanges),
      fullyCovered: missingRanges.length === 0,
      executionMode: params.executionMode,
    });
  }

  return plans;
}

function summarizeTickerGapPlans(params: {
  source: string;
  sourceType: string;
  requestedRange: IsoDateRange;
  plans: Map<string, TickerGapPlan>;
  executionMode: GapExecutionMode;
}) {
  const plans = Array.from(params.plans.values());
  return {
    source: params.source,
    sourceType: params.sourceType,
    requestedRange: params.requestedRange,
    executionMode: params.executionMode,
    totalTickers: plans.length,
    fullyCoveredTickers: plans.filter((plan) => plan.fullyCovered).length,
    tickersWithMissingGaps: plans.filter((plan) => plan.missingRanges.length > 0).length,
    totalMissingRanges: plans.reduce((total, plan) => total + plan.missingRanges.length, 0),
    totalMissingDays: plans.reduce((total, plan) => total + plan.missingDayCount, 0),
    examples: plans
      .filter((plan) => plan.missingRanges.length > 0 || plan.fullyCovered)
      .slice(0, 10)
      .map((plan) => ({
        ticker: plan.ticker,
        coveredRanges: plan.coveredRanges,
        missingRanges: plan.missingRanges,
        missingDayCount: plan.missingDayCount,
        fullyCovered: plan.fullyCovered,
      })),
  };
}

// Track running pull-finhub jobs to prevent duplicate concurrent pulls
const activePullJobs = new Map<string, string>(); // sourceType → jobId

type TickerListRow = {
  ticker: string;
  exchange: string | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  addedAt: string | null;
  ipoDate: string | null;
  marketCap: number | null;
  floatPct: number | null;
  institutionalPct: number | null;
  insiderPct: number | null;
  marketCapSource: string | null;
  floatSource: string | null;
  institutionalSource: string | null;
  insiderSource: string | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseList(input: unknown): string[] | undefined {
  if (Array.isArray(input)) {
    const values = input
      .map((value) => (typeof value === "string" ? value : String(value ?? "")))
      .map((value) => value.trim())
      .filter(Boolean);
    return values.length > 0 ? values : undefined;
  }

  if (typeof input !== "string" || input.trim() === "") {
    return undefined;
  }

  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeCalendarFromParam(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return ISO_DATE_RE.test(value) ? `${value}T00:00:00.000Z` : value;
}

function normalizeCalendarToParam(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return ISO_DATE_RE.test(value) ? `${value}T23:59:59.999Z` : value;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCalendarDateChunks(from: string, to: string, chunkDays: number): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const end = shiftIsoDate(cursor, chunkDays - 1);
    const chunkTo = end < to ? end : to;
    chunks.push({ from: cursor, to: chunkTo });
    cursor = shiftIsoDate(chunkTo, 1);
  }
  return chunks;
}

function getDefaultFmpCalendarWindow(): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: shiftIsoDate(today, -180),
    to: shiftIsoDate(today, 180),
  };
}

function computeCalendarSurprisePct(actual: number | null, estimated: number | null): number | null {
  if (actual == null || estimated == null || estimated === 0) {
    return null;
  }
  return ((actual - estimated) / Math.abs(estimated)) * 100;
}

function normalizeCalendarDateOnly(value: string): string | null {
  return ISO_DATE_RE.test(value) ? value : null;
}

function normalizeUpperTicker(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function slugCalendarKeyPart(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "UNKNOWN";
}

function buildFmpIpoUniqueKey(params: {
  ipoDate: string;
  company: string | null;
  exchange: string | null;
  ticker: string | null;
}): string {
  const companyPart = slugCalendarKeyPart(params.company ?? params.ticker);
  const exchangePart = slugCalendarKeyPart(params.exchange);
  return `FMP:ipos:${params.ipoDate}:${companyPart}:${exchangePart}`;
}

function parseCalendarMetaJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizeDocumentDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return null;
}

function sortDateDesc(left: string | null | undefined, right: string | null | undefined): number {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  if (leftValue === rightValue) {
    return 0;
  }
  return leftValue < rightValue ? 1 : -1;
}

function pickBestIpoProspectus(items: FmpIpoProspectusItem[], ipoDate: string | null): FmpIpoProspectusItem | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const exactMatch = ipoDate
    ? items.find((item) => normalizeDocumentDate(item.ipoDate) === ipoDate)
    : undefined;
  if (exactMatch) {
    return exactMatch;
  }

  return [...items].sort((left, right) => sortDateDesc(left.acceptedDate ?? left.filingDate, right.acceptedDate ?? right.filingDate))[0];
}

function pickBestIpoDisclosure(items: FmpIpoDisclosureItem[]): FmpIpoDisclosureItem | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return [...items].sort((left, right) => sortDateDesc(left.acceptedDate ?? left.filingDate, right.acceptedDate ?? right.filingDate))[0];
}

type GenericSecFiling = Awaited<ReturnType<typeof fetchFmpSecFilings>>[number];

function isIpoRelatedSecForm(formType: string | null | undefined): boolean {
  if (!formType) {
    return false;
  }
  return /^(S-1|S-1\/A|F-1|F-1\/A|424B|424B1|424B3|424B4|424B5|FWP|EFFECT)/i.test(formType);
}

function pickBestGenericIpoSecFiling(items: GenericSecFiling[], ipoDate: string | null): GenericSecFiling | undefined {
  const filtered = items.filter((item) => isIpoRelatedSecForm(item.formType));
  if (filtered.length === 0) {
    return undefined;
  }

  const exactMatch = ipoDate
    ? filtered.find((item) => normalizeDocumentDate(item.filingDate) === ipoDate || normalizeDocumentDate(item.acceptedDate) === ipoDate)
    : undefined;
  if (exactMatch) {
    return exactMatch;
  }

  return [...filtered].sort((left, right) => sortDateDesc(left.acceptedDate ?? left.filingDate, right.acceptedDate ?? right.filingDate))[0];
}

async function syncIpoProfileMetadata(params: {
  tickers: string[];
  jobId?: string;
  shouldCancel?: () => boolean;
}): Promise<{
  requested: number;
  fmpFetched: number;
  yahooFetched: number;
}> {
  const uniqueTickers = Array.from(new Set(params.tickers.map((ticker) => normalizeUpperTicker(ticker)).filter((ticker): ticker is string => Boolean(ticker))));
  if (uniqueTickers.length === 0) {
    return {
      requested: 0,
      fmpFetched: 0,
      yahooFetched: 0,
    };
  }

  const log = (message: string) => {
    if (params.jobId) {
      appendLog(params.jobId, message);
    }
  };

  const { concurrency: fmpConcurrency, requestIntervalMs: fmpInterval } = getFmpDefaults();
  const fmpBatch = await fetchFmpProfilesBatch(uniqueTickers, {
    concurrency: fmpConcurrency,
    requestIntervalMs: fmpInterval,
    shouldCancel: params.shouldCancel,
  });

  if (fmpBatch.cancelled || params.shouldCancel?.()) {
    return {
      requested: uniqueTickers.length,
      fmpFetched: fmpBatch.results.size,
      yahooFetched: 0,
    };
  }

  for (const [ticker, profile] of fmpBatch.results) {
    const secId = await upsertSecurity(
      ticker,
      profile.exchangeShortName || null,
      profile.companyName || null,
      profile.sector || null,
      profile.industry || null,
    );
    await upsertCompanyProfile(
      secId,
      "fmp",
      profile.description || null,
      profile.ceo || null,
      profile.fullTimeEmployees ? parseInt(profile.fullTimeEmployees, 10) || null : null,
      profile.website || null,
      profile.ipoDate || null,
      profile.mktCap || null,
      JSON.stringify(profile.raw),
    );
  }

  const yahooTarget = uniqueTickers.filter((ticker) => !fmpBatch.results.has(ticker));
  let yahooFetched = 0;

  if (yahooTarget.length > 0 && !params.shouldCancel?.()) {
    const { concurrency: yahooConcurrency, requestIntervalMs: yahooInterval } = getYahooDefaults();
    const yahooBatch = await fetchYahooProfilesBatch(yahooTarget, {
      concurrency: yahooConcurrency,
      requestIntervalMs: yahooInterval,
      shouldCancel: params.shouldCancel,
    });

    if (!yahooBatch.cancelled && !params.shouldCancel?.()) {
      for (const [ticker, profile] of yahooBatch.results) {
        const secId = await upsertSecurity(
          ticker,
          null,
          null,
          profile.sector || null,
          profile.industry || null,
        );
        await upsertCompanyProfile(
          secId,
          "yahoo",
          profile.longBusinessSummary || null,
          null,
          null,
          profile.website || null,
          null,
          null,
          JSON.stringify(profile.raw),
        );
      }
      yahooFetched = yahooBatch.results.size;
    }
  }

  log(`IPO profile sync: requested=${uniqueTickers.length}, fmpFetched=${fmpBatch.results.size}, yahooFetched=${yahooFetched}`);

  return {
    requested: uniqueTickers.length,
    fmpFetched: fmpBatch.results.size,
    yahooFetched,
  };
}

type StoredIpoCalendarRow = {
  unique_key: string;
  ticker: string | null;
  meta_json: string;
  event_at: string;
};

async function listStoredIpoEventsForRange(from: string, to: string): Promise<Array<{
  uniqueKey: string;
  ticker: string | null;
  companyName: string | null;
  ipoDate: string | null;
}>> {
  const rows = await getDb().all<StoredIpoCalendarRow[]>(
    `SELECT unique_key, ticker, meta_json, event_at
     FROM calendar_events
     WHERE event_type = 'ipos'
       AND source = 'FMP'
       AND event_at >= ?
       AND event_at <= ?
     ORDER BY event_at ASC, id ASC`,
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );

  return rows.map((row) => {
    const meta = parseCalendarMetaJson(row.meta_json);
    return {
      uniqueKey: row.unique_key,
      ticker: normalizeUpperTicker(row.ticker),
      companyName: typeof meta.company_name === "string" && meta.company_name.trim() ? meta.company_name.trim() : null,
      ipoDate: typeof meta.ipo_date === "string" && ISO_DATE_RE.test(meta.ipo_date) ? meta.ipo_date : row.event_at.slice(0, 10),
    };
  });
}

function parseFiniteQueryNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNewsQuery(query: Record<string, unknown>): NewsQuery {
  const parsedLimit = typeof query.limit === "string" ? Number(query.limit) : undefined;
  const limit = Number.isFinite(parsedLimit as number) ? (parsedLimit as number) : undefined;

  // Support both `sources` (original) and `source_type` (Step 4-5 alias)
  const sourcesRaw = parseList(query.sources) ?? parseList(query.source_type);

  return {
    keyword: typeof query.keyword === "string" ? query.keyword : undefined,
    tickers: parseList(query.tickers),
    sources: sourcesRaw,
    sourceNames: parseList(query.source_names),
    tags: parseList(query.tags),
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    floatPctMin: parseFiniteQueryNumber(query.floatPctMin ?? query.float_pct_min),
    floatPctMax: parseFiniteQueryNumber(query.floatPctMax ?? query.float_pct_max),
    institutionalPctMin: parseFiniteQueryNumber(query.institutionalPctMin ?? query.institutional_pct_min),
    institutionalPctMax: parseFiniteQueryNumber(query.institutionalPctMax ?? query.institutional_pct_max),
    insiderPctMin: parseFiniteQueryNumber(query.insiderPctMin ?? query.insider_pct_min),
    insiderPctMax: parseFiniteQueryNumber(query.insiderPctMax ?? query.insider_pct_max),
    limit,
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    bookmarkFolderId: typeof query.bookmarkFolderId === "string" ? query.bookmarkFolderId : undefined,
  };
}

async function getNewsEarningsFreshnessError(): Promise<string | null> {
  const status = await getUpdateStatus("fmp_calendar_earnings");
  const todayEt = getEtDateString(new Date());
  if (!status?.lastSuccessAt || getEtDateString(status.lastSuccessAt) !== todayEt) {
    return "오늘 FMP Earnings Calendar Update가 아직 실행되지 않았습니다. Calendar Window에서 Update FMP Earnings Dates를 먼저 실행한 뒤 다시 시도하세요.";
  }
  return null;
}

function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

async function requestDevBackendRestart(): Promise<void> {
  const source = await fs.readFile(DEV_BACKEND_RESTART_TOUCH_PATH, "utf8");
  await fs.writeFile(DEV_BACKEND_RESTART_TOUCH_PATH, source, "utf8");
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    realtime: "sse",
    pollingFallbackSeconds: 10,
    demoUserId: DEMO_USER_ID
  });
});

app.post("/api/dev/restart-backend", (req, res) => {
  if (!DEV_BACKEND_RESTART_ENABLED) {
    res.status(409).json({
      error: "Backend restart is available only when the server runs via local dev watch mode.",
    });
    return;
  }

  if (!isLoopbackAddress(req.socket.remoteAddress ?? undefined)) {
    res.status(403).json({
      error: "Backend restart accepts localhost requests only.",
    });
    return;
  }

  res.json({
    ok: true,
    restartAccepted: true,
    mode: "tsx-watch-trigger",
    requiresReconnect: true,
    message: "Backend restart requested. Waiting for tsx watch to reload the server...",
  });

  res.on("finish", () => {
    setTimeout(() => {
      void requestDevBackendRestart().catch((error) => {
        console.error("[dev-control] failed to request backend restart", error);
      });
    }, 150);
  });
});

app.get("/api/updates/status", async (_req, res, next) => {
  try {
    const sources = await listUpdateStatuses();
    res.json({ sources });
  } catch (error) {
    next(error);
  }
});

// ── Ticker CSV endpoints ───────────────────────────────────
app.get("/api/tickers", async (req, res, next) => {
  try {
    const csvPath = typeof req.query.csvPath === "string" ? req.query.csvPath : "";
    const effectivePath = csvPath || DEFAULT_TICKERS_CSV;

    if (!csvPath || csvPath === DEFAULT_TICKERS_CSV) {
      // DB-primary: canonical universe first, CSV fallback handled inside helper
      const rows = await getDefaultUniverseRows();
      res.json({ csvPath: effectivePath, tickers: rows.map((row) => row.ticker), rows, source: "db" });
      return;
    }

    // Custom CSV path: direct CSV read
    const result = readTickerRowsFromCsv(csvPath);
    const rows = mapCsvTickerRowsToListRows(result.rows);
    res.json({ csvPath, tickers: rows.map((row) => row.ticker), rows, source: "csv" });
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/tickers/import-default", async (req, res, next) => {
  try {
    const { csvPath } = req.body ?? {};
    if (typeof csvPath !== "string" || !csvPath.trim()) {
      res.status(400).json({ error: "csvPath is required" });
      return;
    }

    const result = await mergeCsvIntoDefaultUniverse(csvPath.trim());
    await setLastSuccess("tickers_csv", new Date().toISOString(), {
      csvPath: result.resolvedPath,
      rowsRead: result.rowsRead,
      tickersAdded: result.tickersAdded,
      tickersSkipped: result.tickersSkipped,
      count: result.tickers.length,
      source: "db-merge",
    });

    res.json({
      csvPath: DEFAULT_TICKERS_CSV,
      importedFrom: result.resolvedPath,
      rowsRead: result.rowsRead,
      tickersAdded: result.tickersAdded,
      tickersSkipped: result.tickersSkipped,
      tickers: result.tickers,
      rows: await getDefaultUniverseRows(),
      source: "db",
    });
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/tickers/add", async (req, res, next) => {
  try {
    const { csvPath, ticker } = req.body ?? {};
    if (typeof ticker !== "string" || !ticker.trim()) {
      res.status(400).json({ error: "ticker is required" });
      return;
    }
    const normalizedTicker = ticker.trim().toUpperCase();
    const effectiveCsvPath = typeof csvPath === "string" && csvPath ? csvPath : DEFAULT_TICKERS_CSV;

    if (effectiveCsvPath === DEFAULT_TICKERS_CSV) {
      // DB-primary path
      const secId = await upsertSecurity(normalizedTicker, null, null, null, null);
      const universes = await listUniverses();
      const def = universes.find((u) => u.name === "default");
      if (!def) {
        res.status(500).json({ error: "Default universe not found in DB" });
        return;
      }
      const currentCount = await countUniverseItems(def.id);
      const inserted = await addUniverseItem(def.id, secId, currentCount + 1);
      if (!inserted) {
        res.status(409).json({ error: `Ticker "${normalizedTicker}" already exists in default universe` });
        return;
      }
      // Best-effort CSV backup (ignore if already exists)
      try { await appendTickerToCsv(effectiveCsvPath, normalizedTicker); } catch { /* already in CSV or file locked */ }
      const rows = await getDefaultUniverseRows();
      const tickers = rows.map((row) => row.ticker);
      await setLastSuccess("tickers_csv", new Date().toISOString(), {
        csvPath: effectiveCsvPath, tickerAdded: normalizedTicker, count: tickers.length, source: "db",
      });
      res.json({ csvPath: effectiveCsvPath, tickerAdded: normalizedTicker, tickers, rows, source: "db" });
    } else {
      // Custom CSV path: CSV-only (existing behaviour)
      if (typeof csvPath !== "string" || !csvPath) {
        res.status(400).json({ error: "csvPath is required" });
        return;
      }
      const result = await appendTickerToCsv(csvPath, normalizedTicker);
      const rows = mapCsvTickerRowsToListRows(readTickerRowsFromCsv(csvPath).rows);
      await setLastSuccess("tickers_csv", new Date().toISOString(), {
        csvPath, tickerAdded: result.tickerAdded, count: result.tickers.length,
      });
      res.json({ csvPath, tickerAdded: result.tickerAdded, tickers: result.tickers, rows, source: "csv" });
    }
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.delete("/api/tickers/remove", async (req, res, next) => {
  try {
    const { csvPath, ticker } = req.body ?? {};
    if (typeof ticker !== "string" || !ticker.trim()) {
      res.status(400).json({ error: "ticker is required" });
      return;
    }
    const normalizedTicker = ticker.trim().toUpperCase();
    const effectiveCsvPath = typeof csvPath === "string" && csvPath ? csvPath : DEFAULT_TICKERS_CSV;

    if (effectiveCsvPath === DEFAULT_TICKERS_CSV) {
      // DB-primary: remove from default universe
      const universes = await listUniverses();
      const def = universes.find((u) => u.name === "default");
      if (!def) {
        res.status(500).json({ error: "Default universe not found in DB" });
        return;
      }
      const removed = await removeUniverseItemByTicker(def.id, normalizedTicker);
      if (!removed) {
        res.status(404).json({ error: `Ticker "${normalizedTicker}" not found in default universe` });
        return;
      }
      // Best-effort CSV backup sync (ignore if not in CSV)
      try { await removeTickerFromCsv(effectiveCsvPath, normalizedTicker); } catch { /* not in CSV or file locked */ }
      const rows = await getDefaultUniverseRows();
      const tickers = rows.map((row) => row.ticker);
      res.json({ csvPath: effectiveCsvPath, tickerRemoved: normalizedTicker, tickers, rows, source: "db" });
    } else {
      // Custom CSV path: CSV-only
      if (typeof csvPath !== "string" || !csvPath) {
        res.status(400).json({ error: "csvPath is required" });
        return;
      }
      const result = await removeTickerFromCsv(csvPath, normalizedTicker);
      const rows = mapCsvTickerRowsToListRows(readTickerRowsFromCsv(csvPath).rows);
      res.json({ csvPath, tickerRemoved: result.tickerRemoved, tickers: result.tickers, rows, source: "csv" });
    }
  } catch (error) {
    if (error instanceof CsvServiceError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/default-tickers/daily-change-history", async (req, res, next) => {
  try {
    const parseShorthandNumber = (value: string): number => {
      const normalized = value.trim().replace(/,/g, "").replace(/\s+/g, "");
      const match = normalized.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([kmbt])?$/i);
      if (!match) {
        return Number.NaN;
      }
      const base = Number(match[1]);
      if (!Number.isFinite(base)) {
        return Number.NaN;
      }
      const suffix = (match[2] ?? "").toUpperCase();
      const multiplier = suffix === "K"
        ? 1_000
        : suffix === "M"
          ? 1_000_000
          : suffix === "B"
            ? 1_000_000_000
            : suffix === "T"
              ? 1_000_000_000_000
              : 1;
      return base * multiplier;
    };

    const date = typeof req.query.date === "string" && req.query.date.trim() ? req.query.date.trim() : undefined;
    const marketCapMinRaw = typeof req.query.marketCapMin === "string" ? req.query.marketCapMin.trim() : "";
    const marketCapMaxRaw = typeof req.query.marketCapMax === "string" ? req.query.marketCapMax.trim() : "";
    const turnoverMinRaw = typeof req.query.turnoverMin === "string" ? req.query.turnoverMin.trim() : "";
    const turnoverMaxRaw = typeof req.query.turnoverMax === "string" ? req.query.turnoverMax.trim() : "";

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }

    const marketCapMin = marketCapMinRaw ? parseShorthandNumber(marketCapMinRaw) : undefined;
    const marketCapMax = marketCapMaxRaw ? parseShorthandNumber(marketCapMaxRaw) : undefined;
    const turnoverMin = turnoverMinRaw ? parseShorthandNumber(turnoverMinRaw) : undefined;
    const turnoverMax = turnoverMaxRaw ? parseShorthandNumber(turnoverMaxRaw) : undefined;

    if (marketCapMinRaw && !Number.isFinite(marketCapMin)) {
      res.status(400).json({ error: "marketCapMin must be a valid number (examples: 1000000, 1M, 2.5B)" });
      return;
    }

    if (marketCapMaxRaw && !Number.isFinite(marketCapMax)) {
      res.status(400).json({ error: "marketCapMax must be a valid number (examples: 50000000000, 50B)" });
      return;
    }

    if (turnoverMinRaw && !Number.isFinite(turnoverMin)) {
      res.status(400).json({ error: "turnoverMin must be a valid number (examples: 100000000, 100M, 1.2B)" });
      return;
    }

    if (turnoverMaxRaw && !Number.isFinite(turnoverMax)) {
      res.status(400).json({ error: "turnoverMax must be a valid number (examples: 5000000000, 5B)" });
      return;
    }

    if (marketCapMin != null && marketCapMax != null && marketCapMin > marketCapMax) {
      res.status(400).json({ error: "marketCapMin must be less than or equal to marketCapMax" });
      return;
    }

    if (turnoverMin != null && turnoverMax != null && turnoverMin > turnoverMax) {
      res.status(400).json({ error: "turnoverMin must be less than or equal to turnoverMax" });
      return;
    }

    const result = await getDefaultDailyChangeHistory({
      selectedDate: date,
      marketCapMin,
      marketCapMax,
      turnoverMin,
      turnoverMax,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Finnhub News Pull ───────────────────────────────────
const DEFAULT_TICKERS_CSV = "tradigview_screener/original_data/watch lists2_2026-02-22.csv";

function mapCsvTickerRowsToListRows(rows: Array<{ ticker: string; name: string | null; industry: string | null; sector: string | null }>): TickerListRow[] {
  return rows.map((row) => ({
    ticker: row.ticker,
    exchange: null,
    name: row.name,
    sector: row.sector,
    industry: row.industry,
    addedAt: null,
    ipoDate: null,
    marketCap: null,
    floatPct: null,
    institutionalPct: null,
    insiderPct: null,
    marketCapSource: null,
    floatSource: null,
    institutionalSource: null,
    insiderSource: null,
  }));
}

/** canonical default universe에서 ticker 목록 조회. DB 미준비 시 CSV fallback. */
async function getDefaultUniverseTickers(): Promise<string[]> {
  try {
    const universes = await listUniverses();
    const def = universes.find((u) => u.name === "default");
    if (def) {
      const items = await listUniverseItems(def.id);
      if (items.length > 0) return items.map((s) => s.ticker);
    }
  } catch {
    // DB not ready yet
  }
  try {
    const { rows } = readTickerRowsFromCsv(DEFAULT_TICKERS_CSV);
    return rows.map((r) => r.ticker);
  } catch {
    return ["AAPL", "MSFT", "TSLA", "NVDA", "AMD"];
  }
}

async function getDefaultUniverseRows(): Promise<TickerListRow[]> {
  try {
    const universes = await listUniverses();
    const def = universes.find((u) => u.name === "default");
    if (def) {
      const rows = await getDb().all<Array<{
        ticker: string;
        exchange: string | null;
        name: string | null;
        sector: string | null;
        industry: string | null;
        added_at: string | null;
        ipo_date: string | null;
        market_cap: number | null;
        float_pct: number | null;
        institutional_pct: number | null;
        insider_pct: number | null;
        market_cap_source: string | null;
        float_source: string | null;
        institutional_source: string | null;
        insider_source: string | null;
      }>>(
        `SELECT s.ticker, s.exchange, s.name, s.sector, s.industry,
          ui.created_at AS added_at,
                (
                  SELECT cp.ipo_date
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.ipo_date IS NOT NULL AND cp.ipo_date != ''
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS ipo_date,
                (
                  SELECT cp.market_cap
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS market_cap,
                (
                  SELECT cp.float_pct
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.float_pct IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS float_pct,
                (
                  SELECT cp.institutional_pct
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS institutional_pct,
                (
                  SELECT cp.insider_pct
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.insider_pct IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS insider_pct,
                (
                  SELECT cp.market_cap_source
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS market_cap_source,
                (
                  SELECT cp.float_source
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.float_pct IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS float_source,
                (
                  SELECT cp.institutional_source
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS institutional_source,
                (
                  SELECT cp.insider_source
                  FROM company_profiles cp
                  WHERE cp.security_id = s.id AND cp.insider_pct IS NOT NULL
                  ORDER BY cp.fetched_at DESC
                  LIMIT 1
                ) AS insider_source
         FROM ticker_universe_items ui
         JOIN securities s ON s.id = ui.security_id
         WHERE ui.universe_id = ?
         ORDER BY ui.sort_order, s.ticker`,
        [def.id],
      );
      if (rows.length > 0) {
        return rows.map((row) => ({
          ticker: row.ticker,
          exchange: row.exchange ?? null,
          name: row.name ?? null,
          sector: row.sector ?? null,
          industry: row.industry ?? null,
          addedAt: row.added_at ?? null,
          ipoDate: row.ipo_date ?? null,
          marketCap: row.market_cap ?? null,
          floatPct: row.float_pct ?? null,
          institutionalPct: row.institutional_pct ?? null,
          insiderPct: row.insider_pct ?? null,
          marketCapSource: row.market_cap_source ?? null,
          floatSource: row.float_source ?? null,
          institutionalSource: row.institutional_source ?? null,
          insiderSource: row.insider_source ?? null,
        }));
      }
    }
  } catch {
    // DB not ready yet
  }

  try {
    const { rows } = readTickerRowsFromCsv(DEFAULT_TICKERS_CSV);
    return mapCsvTickerRowsToListRows(rows);
  } catch {
    return ["AAPL", "MSFT", "TSLA", "NVDA", "AMD"].map((ticker) => ({
      ticker,
      exchange: null,
      name: null,
      sector: null,
      industry: null,
      addedAt: null,
      ipoDate: null,
      marketCap: null,
      floatPct: null,
      institutionalPct: null,
      insiderPct: null,
      marketCapSource: null,
      floatSource: null,
      institutionalSource: null,
      insiderSource: null,
    }));
  }
}

async function ensureDefaultUniverse(): Promise<number> {
  const universes = await listUniverses();
  const existing = universes.find((u) => u.name === "default");
  if (existing) {
    return existing.id;
  }
  return upsertUniverse("default", "TradingView screener default watchlist", DEFAULT_TICKERS_CSV);
}

async function mergeCsvIntoDefaultUniverse(csvPath: string): Promise<{
  resolvedPath: string;
  rowsRead: number;
  tickersAdded: number;
  tickersSkipped: number;
  tickers: string[];
}> {
  const { rows, resolvedPath } = readTickerRowsFromCsv(csvPath);
  if (rows.length === 0) {
    throw new CsvServiceError("CSV file is empty");
  }

  const universeId = await ensureDefaultUniverse();
  const existingItems = await listUniverseItems(universeId);
  const existingTickers = new Set(existingItems.map((item) => item.ticker.toUpperCase()));

  let sortOrder = existingItems.length;
  let tickersAdded = 0;

  for (const row of rows) {
    const secId = await upsertSecurity(row.ticker, null, row.name, row.sector, row.industry);
    if (existingTickers.has(row.ticker)) {
      continue;
    }
    await addUniverseItem(universeId, secId, sortOrder++);
    existingTickers.add(row.ticker);
    tickersAdded++;

    try { await appendTickerToCsv(DEFAULT_TICKERS_CSV, row.ticker); } catch { /* already in CSV or file locked */ }
  }

  const tickers = await getDefaultUniverseTickers();
  return {
    resolvedPath,
    rowsRead: rows.length,
    tickersAdded,
    tickersSkipped: rows.length - tickersAdded,
    tickers,
  };
}

const pullFinnhubSchema = z.object({
  csvPath: z.string().optional().default(DEFAULT_TICKERS_CSV),
  /** 0 or omitted = all tickers in CSV (no cap) */
  maxTickers: z.number().int().min(0).optional().default(0),
  /** Starting per-chunk ticker concurrency. Failed chunks retry at lower derived levels. */
  tickerConcurrency: z.number().int().min(1).max(20).optional().default(DEFAULT_FINNHUB_TICKER_CONCURRENCY),
  /** Pause between concurrent ticker chunks in milliseconds. */
  requestIntervalMs: z.number().int().min(0).max(10_000).optional().default(DEFAULT_FINNHUB_REQUEST_INTERVAL_MS),
  /** Optional fulltext concurrency for automatic company_news chaining. */
  fulltextConcurrency: z.number().int().min(1).max(200).optional().default(200),
  mode: z.enum(["7d", "recent", "custom"]).optional().default("7d"),
  /** Which data types to pull. "market_news" = Finnhub /news general market headlines */
  sourceType: z.enum(["all", "company_news", "press_release", "market_news"]).optional().default("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Helper: insert fetched items into DB, track counts, push SSE */
async function insertFetchedItems(
  items: FinnhubMappedItem[],
  detailBucket: { fetched: number; inserted: number },
  newItems: Array<{ id: string; tickers: string[]; publishedAt: string }>,
  counters: { totalInserted: number; totalSkipped: number },
) {
  detailBucket.fetched += items.length;
  for (const rawItem of items) {
    const inserted = await insertNewsItem({
      publishedAt: rawItem.publishedAt,
      source: rawItem.source,
      sourceType: rawItem.sourceType,
      title: rawItem.title,
      body: rawItem.body,
      url: rawItem.url,
      originUrl: rawItem.originUrl,
      tickers: rawItem.providerTickers,
      tags: rawItem.tags,
      publisher: rawItem.publisher,
    });
    if (inserted) {
      counters.totalInserted++;
      detailBucket.inserted++;
      newItems.push({
        id: inserted.id,
        tickers: inserted.tickers,
        publishedAt: inserted.published_at,
      });
      streamHub.publishNews(inserted);
    } else {
      counters.totalSkipped++;
    }
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function persistProviderPlainTextFulltext(newsId: string | null, fullText: string, extractionNote: string): Promise<void> {
  const trimmed = fullText.trim();
  if (!newsId || !trimmed) return;
  await upsertProvidedFulltext(newsId, {
    fullText: trimmed,
    extractionNote,
    wordCount: countWords(trimmed),
  });
}

/**
 * Persist RTPR fulltext: prefer raw HTML (article_body_html), fallback to plain text body.
 * Also extracts origin_url from HTML footer and updates news_items.
 */
async function persistRtprFulltext(newsId: string | null, bodyHtml: string | undefined, bodyPlain: string, extractionNote: string): Promise<void> {
  if (!newsId) return;
  const content = bodyHtml?.trim() || bodyPlain.trim();
  if (!content) return;
  const note = bodyHtml?.trim() ? `${extractionNote}-html` : `${extractionNote}-plain`;
  await upsertProvidedFulltext(newsId, {
    fullText: content,
    extractionNote: note,
    wordCount: countWords(htmlToPlainText(content)),
  });
  // Extract and store origin_url from body (HTML preferred, plain text fallback)
  const originUrl = extractOriginUrl(content);
  if (originUrl) {
    await getDb().run(`UPDATE news_items SET origin_url = ? WHERE id = ?`, [originUrl, newsId]);
  }
}

async function runInlineFulltextExtraction(
  jobId: string,
  targets: Array<{ id: string; url: string; publisher: string | null; body: string | null; source_type: string }>,
  concurrency: number,
  label: string,
): Promise<{ success: number; skipped: number; failed: number }> {
  const fulltextResult = { success: 0, skipped: 0, failed: 0 };
  if (targets.length === 0 || isJobCancelled(jobId)) {
    return fulltextResult;
  }

  appendLog(jobId, `Extracting full text for ${targets.length} new ${label} items...`);
  const workerCount = Math.max(1, Math.min(concurrency, targets.length));
  let fulltextCursor = 0;
  let lastFulltextLogAt = 0;

  const processFulltextTarget = async (target: typeof targets[number]) => {
    const result = await extractAndPersistFulltext(target);
    if (result.extractionStatus === "success") fulltextResult.success++;
    else if (result.extractionStatus === "skipped") fulltextResult.skipped++;
    else fulltextResult.failed++;

    const completed = fulltextResult.success + fulltextResult.skipped + fulltextResult.failed;
    if (completed - lastFulltextLogAt >= 20 || completed === targets.length) {
      lastFulltextLogAt = completed;
      appendLog(jobId, `[fulltext ${completed}/${targets.length}] ${fulltextResult.success} ok, ${fulltextResult.skipped} skip, ${fulltextResult.failed} fail`);
    }
  };

  const fulltextWorker = async () => {
    while (!isJobCancelled(jobId)) {
      const currentIndex = fulltextCursor;
      fulltextCursor += 1;
      if (currentIndex >= targets.length) return;
      await processFulltextTarget(targets[currentIndex]);
    }
  };

  appendLog(jobId, `[fulltext] concurrency=${workerCount}`);
  await Promise.all(Array.from({ length: workerCount }, () => fulltextWorker()));
  appendLog(jobId, `Full text during pull: ${fulltextResult.success} success, ${fulltextResult.skipped} skipped, ${fulltextResult.failed} failed`);
  return fulltextResult;
}

// ── Preflight check for Recent Update ──
app.get("/api/news/pull-finhub/preflight", async (req, res, next) => {
  try {
    const sourceType = (req.query.sourceType as string) || "all";
    if (sourceType === "market_news") {
      res.json({ totalTickers: 0, fallbackCount: 0, fallbackTickers: [] });
      return;
    }
    const csvPath = req.query.csvPath as string | undefined;

    let tickerList: string[];
    if (!csvPath || csvPath === DEFAULT_TICKERS_CSV) {
      // Default: canonical DB universe first; CSV fallback handled inside helper
      tickerList = await getDefaultUniverseTickers();
    } else {
      try {
        const csvResult = readTickersFromCsv(csvPath);
        tickerList = csvResult.tickers;
      } catch {
        tickerList = await getDefaultUniverseTickers();
      }
    }

    const tickersWithNews = await getTickersWithNews(
      sourceType === "all" ? undefined : sourceType,
    );

    const fallbackTickers = tickerList.filter(
      (t) => !tickersWithNews.has(t.toUpperCase()),
    );

    res.json({
      totalTickers: tickerList.length,
      fallbackCount: fallbackTickers.length,
      fallbackTickers: fallbackTickers.slice(0, 50),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-finhub/preflight-custom", async (req, res, next) => {
  try {
    const input = pullFinnhubSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }

    const requestedRange = {
      from: input.from,
      to: input.to ?? new Date().toISOString().slice(0, 10),
    };

    let tickerList: string[];
    if (input.csvPath === DEFAULT_TICKERS_CSV) {
      tickerList = await getDefaultUniverseTickers();
    } else {
      try {
        const csvResult = readTickersFromCsv(input.csvPath);
        tickerList = csvResult.tickers;
      } catch {
        tickerList = await getDefaultUniverseTickers();
      }
    }
    if (input.maxTickers > 0) tickerList = tickerList.slice(0, input.maxTickers);

    if (input.sourceType === "market_news") {
      res.json({
        source: "FINNHUB",
        sourceType: input.sourceType,
        requestedRange,
        executionMode: "summary-only",
        supported: false,
        reason: "market_news custom mode does not support ticker gap planning",
      });
      return;
    }

    const summaries: Record<string, unknown> = {};
    if (input.sourceType === "all" || input.sourceType === "company_news") {
      const plans = await buildTickerGapPlans({
        tickers: tickerList,
        source: "FINNHUB",
        sourceType: "company_news",
        from: requestedRange.from,
        to: requestedRange.to,
        executionMode: "gap-only",
      });
      summaries.company_news = summarizeTickerGapPlans({
        source: "FINNHUB",
        sourceType: "company_news",
        requestedRange,
        plans,
        executionMode: "gap-only",
      });
    }
    if (input.sourceType === "all" || input.sourceType === "press_release") {
      const plans = await buildTickerGapPlans({
        tickers: tickerList,
        source: "FINNHUB",
        sourceType: "press_release",
        from: requestedRange.from,
        to: requestedRange.to,
        executionMode: "gap-only",
      });
      summaries.press_release = summarizeTickerGapPlans({
        source: "FINNHUB",
        sourceType: "press_release",
        requestedRange,
        plans,
        executionMode: "gap-only",
      });
    }

    if (input.sourceType === "all") {
      res.json({
        source: "FINNHUB",
        sourceType: input.sourceType,
        requestedRange,
        totalTickers: tickerList.length,
        bySourceType: summaries,
      });
      return;
    }

    res.json(summaries[input.sourceType]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-finhub", async (req, res, next) => {
  try {
    const input = pullFinnhubSchema.parse(req.body ?? {});
    const batchLevels = buildBatchLevels(input.tickerConcurrency);
    const isCustom = input.mode === "custom";
    const is7d = input.mode === "7d";
    const isRecent = input.mode === "recent";
    const pullCompany = input.sourceType === "all" || input.sourceType === "company_news";
    const pullPress = input.sourceType === "all" || input.sourceType === "press_release";
    const pullMarket = input.sourceType === "all" || input.sourceType === "market_news";

    // Compute effective date range
    let effectiveFrom = input.from;
    let effectiveTo = input.to ?? new Date().toISOString().slice(0, 10);

    if (is7d) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      effectiveFrom = d.toISOString().slice(0, 10);
      effectiveTo = new Date().toISOString().slice(0, 10);
    }

    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    // Load tickers — DB universe first when using default path; CSV for explicit overrides
    let tickerList: string[];
    if (input.csvPath === DEFAULT_TICKERS_CSV) {
      tickerList = await getDefaultUniverseTickers();
    } else {
      try {
        const csvResult = readTickersFromCsv(input.csvPath);
        tickerList = csvResult.tickers;
      } catch {
        tickerList = await getDefaultUniverseTickers();
      }
    }
    if (input.maxTickers > 0) tickerList = tickerList.slice(0, input.maxTickers);
    if (!pullCompany && !pullPress) {
      tickerList = [];
    }
    console.log(`[pull-finhub] mode=${input.mode} sourceType=${input.sourceType} maxTickers=${input.maxTickers} tickerConcurrency=${input.tickerConcurrency} requestIntervalMs=${input.requestIntervalMs} fulltextConcurrency=${input.fulltextConcurrency} batchLevels=${batchLevels.join(",")} → tickerList.length=${tickerList.length}`);

    const customRequestedRange = isCustom ? { from: effectiveFrom!, to: effectiveTo } : null;
    let companyCustomGapPlans: Map<string, TickerGapPlan> | undefined;
    let pressCustomGapPlans: Map<string, TickerGapPlan> | undefined;
    if (isCustom && pullCompany) {
      companyCustomGapPlans = await buildTickerGapPlans({
        tickers: tickerList,
        source: "FINNHUB",
        sourceType: "company_news",
        from: effectiveFrom!,
        to: effectiveTo,
        executionMode: "gap-only",
      });
    }
    if (isCustom && pullPress) {
      pressCustomGapPlans = await buildTickerGapPlans({
        tickers: tickerList,
        source: "FINNHUB",
        sourceType: "press_release",
        from: effectiveFrom!,
        to: effectiveTo,
        executionMode: "gap-only",
      });
    }

    // For recent mode, load per-ticker anchor maps
    let companyAnchorMap: Map<string, string> | undefined;
    let pressAnchorMap: Map<string, string> | undefined;
    if (isRecent) {
      if (pullCompany) companyAnchorMap = await getTickerAnchorMap("company_news");
      if (pullPress) pressAnchorMap = await getTickerAnchorMap("press_release");
    }

    // ── Duplicate job guard: reject if same sourceType is already running ──
    const existingJobId = activePullJobs.get(input.sourceType);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `A pull job for sourceType='${input.sourceType}' is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      // Previous job finished — allow new one
      activePullJobs.delete(input.sourceType);
    }

    // ── Create background job and return immediately ──
    const jobId = createJob(Math.max(tickerList.length + (pullMarket ? 1 : 0), 1), {
      category: "news-update",
      label: `Finnhub Pull (${input.sourceType})`,
    });
    activePullJobs.set(input.sourceType, jobId);
    appendLog(jobId, `Starting ${input.mode}/${input.sourceType} pull for ${tickerList.length} tickers`);
    appendLog(jobId, `[batch] requested tickerConcurrency=${input.tickerConcurrency}, requestIntervalMs=${input.requestIntervalMs}, fulltextConcurrency=${input.fulltextConcurrency}, levels=${batchLevels.join(" → ")}`);

    if (isRecent) {
      const fallbackCount = tickerList.filter((t) => {
        const upper = t.toUpperCase();
        return !(companyAnchorMap?.has(upper) || pressAnchorMap?.has(upper));
      }).length;
      if (fallbackCount > 0) {
        appendLog(jobId, `${fallbackCount} tickers have no prior data → 7d fallback`);
      }
    }

    res.json({ jobId });

    // ── Background job execution (fire-and-forget) ──
    const fallback7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0, fullyCoveredSkipped: 0, gapRangesFetched: 0 };
      const fetchedTickers = new Set<string>();
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const companyNewsNewItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const detailsPerType: Record<string, { fetched: number; inserted: number }> = {
        company_news: { fetched: 0, inserted: 0 },
        press_release: { fetched: 0, inserted: 0 },
        market_news: { fetched: 0, inserted: 0 },
      };

      try {
        if (isCustom && customRequestedRange) {
          if (companyCustomGapPlans) {
            const summary = summarizeTickerGapPlans({
              source: "FINNHUB",
              sourceType: "company_news",
              requestedRange: customRequestedRange,
              plans: companyCustomGapPlans,
              executionMode: "gap-only",
            });
            appendLog(jobId, `[custom preflight company_news] fullyCovered=${summary.fullyCoveredTickers}, missingTickers=${summary.tickersWithMissingGaps}, missingRanges=${summary.totalMissingRanges}`);
          }
          if (pressCustomGapPlans) {
            const summary = summarizeTickerGapPlans({
              source: "FINNHUB",
              sourceType: "press_release",
              requestedRange: customRequestedRange,
              plans: pressCustomGapPlans,
              executionMode: "gap-only",
            });
            appendLog(jobId, `[custom preflight press_release] fullyCovered=${summary.fullyCoveredTickers}, missingTickers=${summary.tickersWithMissingGaps}, missingRanges=${summary.totalMissingRanges}`);
          }
        }
        // ── Per-ticker processor: throws on rate-limit to signal adaptive batch runner ──
        const processOneTicker = async (ticker: string): Promise<void> => {
          const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          let hadRateLimitError = false;
          const companyPlan = companyCustomGapPlans?.get(ticker);
          const pressPlan = pressCustomGapPlans?.get(ticker);

          if (isCustom) {
            const companyNeedsFetch = pullCompany && (companyPlan?.missingRanges.length ?? 0) > 0;
            const pressNeedsFetch = pullPress && (pressPlan?.missingRanges.length ?? 0) > 0;
            if ((pullCompany || pullPress) && !companyNeedsFetch && !pressNeedsFetch) {
              counters.fullyCoveredSkipped += 1;
              appendLog(jobId, `  ${ticker}: fully covered, skip custom fetch`);
              return;
            }
          }

          // Company news
          if (pullCompany) {
            try {
              let items: FinnhubMappedItem[];
              if (isCustom) {
                items = [];
                const missingRanges = companyPlan?.missingRanges ?? [];
                let fetchedCount = 0;
                for (const gapRange of missingRanges) {
                  counters.gapRangesFetched += 1;
                  fetchedTickers.add(ticker);
                  const rangeItems = await pullCompanyNewsBackfill(ticker, gapRange.from, gapRange.to);
                  fetchedCount += rangeItems.length;
                  const companyNewsStart = newItems.length;
                  await insertFetchedItems(rangeItems, detailsPerType.company_news, newItems, counters);
                  if (newItems.length > companyNewsStart) {
                    companyNewsNewItems.push(...newItems.slice(companyNewsStart));
                  }
                }
                if (missingRanges.length > 0) {
                  appendLog(jobId, `  company_news ${ticker}: ${missingRanges.length} gap(s), ${fetchedCount} fetched`);
                }
              } else {
                let tickerFrom = effectiveFrom!;
                if (isRecent) {
                  const anchor = companyAnchorMap?.get(ticker.toUpperCase());
                  tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;

                  // Check confirmed-empty range — skip if the entire range is already confirmed empty (before today)
                  const emptyRange = await getConfirmedEmptyRange(ticker, "company_news");
                  if (emptyRange && tickerFrom >= emptyRange.rangeFrom && yesterday <= emptyRange.rangeTo) {
                    appendLog(jobId, `  company_news ${ticker}: confirmed-empty skip (${emptyRange.rangeFrom}~${emptyRange.rangeTo})`);
                    items = [];
                  } else {
                    items = await fetchCompanyNewsRaw(ticker, tickerFrom, effectiveTo, {
                      onOriginResolveFinalFailure: ({ symbol, url, title, attempts }) => {
                        appendLog(jobId, `  ⚠ company_news ${symbol}: origin_url unresolved after ${attempts} retries :: ${title || "(untitled)"} :: ${url}`);
                      },
                    });
                    // Record confirmed-empty if HTTP 200 + empty array (only for range before today)
                    if (items.length === 0 && tickerFrom <= yesterday) {
                      await recordConfirmedEmpty(ticker, "company_news", tickerFrom, yesterday);
                    }
                  }
                } else {
                  items = await fetchCompanyNewsRaw(ticker, tickerFrom, effectiveTo, {
                    onOriginResolveFinalFailure: ({ symbol, url, title, attempts }) => {
                      appendLog(jobId, `  ⚠ company_news ${symbol}: origin_url unresolved after ${attempts} retries :: ${title || "(untitled)"} :: ${url}`);
                    },
                  });
                }
              }
              if (!isCustom) {
                const companyNewsStart = newItems.length;
                await insertFetchedItems(items, detailsPerType.company_news, newItems, counters);
                if (newItems.length > companyNewsStart) {
                  companyNewsNewItems.push(...newItems.slice(companyNewsStart));
                }
              }
              if (!isCustom && items.length > 0) {
                appendLog(jobId, `  company_news ${ticker}: ${items.length} fetched`);
              }
            } catch (err: any) {
              console.error(`[pull-finhub] company_news ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ company_news ${ticker}: ${err.message}`);
              if (/429|rate.?limit/i.test(err.message ?? "")) hadRateLimitError = true;
            }
          }

          // Press releases
          if (pullPress) {
            try {
              let items: FinnhubMappedItem[];
              if (isCustom) {
                items = [];
                const missingRanges = pressPlan?.missingRanges ?? [];
                let fetchedCount = 0;
                for (const gapRange of missingRanges) {
                  counters.gapRangesFetched += 1;
                  fetchedTickers.add(ticker);
                  const rangeItems = await pullPressReleasesBackfill(ticker, gapRange.from, gapRange.to);
                  fetchedCount += rangeItems.length;
                  await insertFetchedItems(rangeItems, detailsPerType.press_release, newItems, counters);
                }
                if (missingRanges.length > 0) {
                  appendLog(jobId, `  press_release ${ticker}: ${missingRanges.length} gap(s), ${fetchedCount} fetched`);
                }
              } else {
                let tickerFrom = effectiveFrom!;
                if (isRecent) {
                  const anchor = pressAnchorMap?.get(ticker.toUpperCase());
                  tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;

                  // Check confirmed-empty range
                  const emptyRange = await getConfirmedEmptyRange(ticker, "press_release");
                  if (emptyRange && tickerFrom >= emptyRange.rangeFrom && yesterday <= emptyRange.rangeTo) {
                    appendLog(jobId, `  press_release ${ticker}: confirmed-empty skip (${emptyRange.rangeFrom}~${emptyRange.rangeTo})`);
                    items = [];
                  } else {
                    items = await fetchPressReleasesRaw(ticker, tickerFrom, effectiveTo);
                    if (items.length === 0 && tickerFrom <= yesterday) {
                      await recordConfirmedEmpty(ticker, "press_release", tickerFrom, yesterday);
                    }
                  }
                } else {
                  items = await fetchPressReleasesRaw(ticker, tickerFrom, effectiveTo);
                }
              }
              if (!isCustom) {
                await insertFetchedItems(items, detailsPerType.press_release, newItems, counters);
              }
              if (!isCustom && items.length > 0) {
                appendLog(jobId, `  press_release ${ticker}: ${items.length} fetched`);
              }
            } catch (err: any) {
              console.error(`[pull-finhub] press_release ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ press_release ${ticker}: ${err.message}`);
              if (/429|rate.?limit/i.test(err.message ?? "")) hadRateLimitError = true;
            }
          }

          // Re-throw on rate-limit so adaptive batch runner can reduce concurrency and retry
          if (hadRateLimitError) throw new Error(`Rate limit hit for ${ticker}`);
        };

        // ── Adaptive concurrent batch: requested → half → 1 ──
        // Runs tickers in parallel chunks of batchSize.
        // If any ticker hits a rate-limit error, it is collected and retried at the next smaller concurrency level.
        let processedCount = 0;
        let remainingTickers = [...tickerList];
        for (const batchSize of batchLevels) {
          if (remainingTickers.length === 0 || isJobCancelled(jobId)) break;
          appendLog(jobId, `[batch] concurrency=${batchSize}, remaining=${remainingTickers.length}`);
          const failedTickers: string[] = [];

          for (let i = 0; i < remainingTickers.length; i += batchSize) {
            if (isJobCancelled(jobId)) { appendLog(jobId, `🛑 Cancelled — stopping ticker processing`); break; }
            const chunk = remainingTickers.slice(i, i + batchSize);
            const results = await Promise.allSettled(chunk.map((t) => processOneTicker(t)));
            for (let j = 0; j < results.length; j++) {
              if (results[j].status === "rejected") {
                failedTickers.push(chunk[j]);
              } else {
                processedCount++;
                updateProgress(jobId, processedCount);
              }
            }
            // Inter-chunk pause — global rate limiter handles per-request throttle,
            // but a short pause between chunks prevents request stampedes.
            if (i + batchSize < remainingTickers.length && input.requestIntervalMs > 0) {
              await new Promise((r) => setTimeout(r, input.requestIntervalMs));
            }
          }

          if (failedTickers.length === 0) break;

          if (batchSize === batchLevels[batchLevels.length - 1]) {
            // Already at concurrency=1 — give up on remaining failed tickers
            appendLog(jobId, `⚠ ${failedTickers.length} tickers still failed at concurrency=1: ${failedTickers.join(", ")}`);
            processedCount += failedTickers.length;
            updateProgress(jobId, processedCount);
            break;
          }

          appendLog(jobId, `⚠ ${failedTickers.length} tickers hit rate limit — retrying at lower concurrency`);
          remainingTickers = failedTickers;
        }

        if (pullMarket && !isJobCancelled(jobId)) {
          appendLog(jobId, `[market] Processing market news...`);
          try {
            const marketResult = isRecent
              ? await pullMarketNewsWithMeta(undefined, undefined, {
                  onBatch: (batch) => {
                    appendLog(
                      jobId,
                      `  market batch ${batch.batchNumber}: pages=${batch.batchPagesFetched} total_pages=${batch.totalPagesFetched} in_range=${batch.batchItemsInRange} total_in_range=${batch.totalItemsInRange} oldest=${batch.oldestPublishedAt ?? "n/a"} reason=${batch.reason}`,
                    );
                  },
                })
              : await pullMarketNewsBackfillWithMeta(effectiveFrom!, effectiveTo, {
                  onBatch: (batch) => {
                    appendLog(
                      jobId,
                      `  market batch ${batch.batchNumber}: pages=${batch.batchPagesFetched} total_pages=${batch.totalPagesFetched} in_range=${batch.batchItemsInRange} total_in_range=${batch.totalItemsInRange} oldest=${batch.oldestPublishedAt ?? "n/a"} reason=${batch.reason}`,
                    );
                  },
                });
            await insertFetchedItems(marketResult.items, detailsPerType.market_news, newItems, counters);
            appendLog(jobId, `  market_news: ${marketResult.items.length} fetched, ${detailsPerType.market_news.inserted} inserted so far`);
            appendLog(jobId, `  market_news meta: pages=${marketResult.pagesFetched}, batches=${marketResult.batchesFetched}, oldest=${marketResult.oldestPublishedAt ?? "n/a"}, reached_from=${marketResult.reachedFromDate ? "yes" : "no"}`);
            if (marketResult.hitTotalPageLimit) {
              appendLog(jobId, `  ⚠ market_news page guard hit before reaching requested from=${effectiveFrom}; continue from nextMinId=${marketResult.nextMinId ?? "n/a"}`);
            }
          } catch (err: any) {
            console.error(`[pull-finhub] market_news: ${err.message}`);
            appendLog(jobId, `  ⚠ market_news: ${err.message}`);
          }
          updateProgress(jobId, tickerList.length + 1);
        }

        // Merge change% for newly inserted items (from existing OHLC DB)
        let changeMergeResult = { merged: 0, skipped: 0 };
        let autoFulltextJobId: string | null = null;
        if (newItems.length > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Merging change% for ${newItems.length} new items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems, undefined, () => isJobCancelled(jobId));
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-finhub] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        const shouldAutoRunCompanyNewsFulltext = !isJobCancelled(jobId)
          && input.sourceType === "company_news"
          && (isRecent || isCustom)
          && companyNewsNewItems.length > 0;

        if (shouldAutoRunCompanyNewsFulltext) {
          autoFulltextJobId = createJob(companyNewsNewItems.length, {
            category: "news-fulltext",
            label: "Full Text (company_news:auto)",
          });
          appendLog(jobId, `Auto-starting company_news fulltext for ${companyNewsNewItems.length} newly inserted rows (jobId=${autoFulltextJobId})`);
          runFulltextUpdateForNewsIds(
            autoFulltextJobId,
            companyNewsNewItems.map((item) => item.id),
            "company_news",
            "FINNHUB",
            input.fulltextConcurrency,
          ).catch((err) => {
            console.error(`[pull-finhub] auto company_news fulltext ${autoFulltextJobId}: ${err.message}`);
          });
        }

        // Update status
        await setLastSuccess("finhub_news", new Date().toISOString(), {
          mode: input.mode,
          sourceType: input.sourceType,
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          tickersFetched: fetchedTickers.size,
          changeMerged: changeMergeResult.merged,
          autoFulltextJobId,
          autoFulltextConcurrency: autoFulltextJobId ? input.fulltextConcurrency : null,
        });

        completeJob(jobId, {
          source: "FINNHUB",
          mode: input.mode,
          sourceType: input.sourceType,
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          tickersFetched: fetchedTickers.size,
          changeMerged: changeMergeResult.merged,
          autoFulltextJobId,
          autoFulltextConcurrency: autoFulltextJobId ? input.fulltextConcurrency : null,
          autoFulltextInserted: companyNewsNewItems.length,
          details: detailsPerType,
        });
        activePullJobs.delete(input.sourceType);
      } catch (err: any) {
        console.error(`[pull-finhub] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(input.sourceType);
      }
    })();
  } catch (error) {
    next(error);
  }
});

// ── RTPR press release pull endpoint ──
const pullRtprSchema = z.object({
  mode: z.enum(["recent", "custom"]).optional().default("recent"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tickerConcurrency: z.number().int().min(1).max(20).optional().default(DEFAULT_RTPR_TICKER_CONCURRENCY),
});

const pullFmpPressReleaseSchema = z.object({
  mode: z.enum(["recent", "custom", "custom-entire"]).optional().default("recent"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tickerConcurrency: z.number().int().min(1).max(20).optional().default(10),
  requestIntervalMs: z.number().int().min(0).max(5_000).optional().default(25),
  pageLimit: z.number().int().min(1).max(100).optional().default(100),
  maxPages: z.number().int().min(1).max(50).optional().default(12),
});

const FMP_PR_HEARTBEAT_LOG_INTERVAL_MS = 30_000;
const FMP_PR_CHECKPOINT_EVERY_TICKERS = 50;

const pullFmpStockNewsSchema = z.object({
  mode: z.enum(["recent", "custom"]).optional().default("recent"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tickerConcurrency: z.number().int().min(1).max(20).optional().default(10),
  fulltextConcurrency: z.number().int().min(1).max(200).optional().default(DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY),
  requestIntervalMs: z.number().int().min(0).max(5_000).optional().default(25),
  pageLimit: z.number().int().min(1).max(100).optional().default(100),
  maxPages: z.number().int().min(1).max(50).optional().default(12),
});

const pullFmpSecFilingSchema = z.object({
  mode: z.enum(["recent", "custom"]).optional().default("recent"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tickerConcurrency: z.number().int().min(1).max(20).optional().default(10),
  requestIntervalMs: z.number().int().min(0).max(5_000).optional().default(25),
  maxPages: z.number().int().min(1).max(100).optional().default(40),
});

app.post("/api/news/pull-rtpr/preflight-custom", async (req, res, next) => {
  try {
    const input = pullRtprSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }
    const requestedRange = {
      from: input.from,
      to: input.to ?? new Date().toISOString().slice(0, 10),
    };
    const tickerList = await getDefaultUniverseTickers();
    const plans = await buildTickerGapPlans({
      tickers: tickerList,
      source: "RTPR",
      sourceType: "press_release",
      from: requestedRange.from,
      to: requestedRange.to,
      executionMode: "fully-covered-skip",
    });
    res.json(summarizeTickerGapPlans({
      source: "RTPR",
      sourceType: "press_release",
      requestedRange,
      plans,
      executionMode: "fully-covered-skip",
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-fmp-press-release/preflight-custom", async (req, res, next) => {
  try {
    const input = pullFmpPressReleaseSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }
    const requestedRange = {
      from: input.from,
      to: input.to ?? getEtDateString(new Date()),
    };
    const tickerList = await getDefaultUniverseTickers();
    const plans = await buildTickerGapPlans({
      tickers: tickerList,
      source: "FMP",
      sourceType: "fmp_press_release",
      from: requestedRange.from,
      to: requestedRange.to,
      executionMode: "gap-only",
    });
    res.json(summarizeTickerGapPlans({
      source: "FMP",
      sourceType: "fmp_press_release",
      requestedRange,
      plans,
      executionMode: "gap-only",
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-fmp-stock-news/preflight-custom", async (req, res, next) => {
  try {
    const input = pullFmpStockNewsSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }
    const requestedRange = {
      from: input.from,
      to: input.to ?? getEtDateString(new Date()),
    };
    const tickerList = await getDefaultUniverseTickers();
    const plans = await buildTickerGapPlans({
      tickers: tickerList,
      source: "FMP",
      sourceType: "fmp_stock_news",
      from: requestedRange.from,
      to: requestedRange.to,
      executionMode: "gap-only",
    });
    res.json(summarizeTickerGapPlans({
      source: "FMP",
      sourceType: "fmp_stock_news",
      requestedRange,
      plans,
      executionMode: "gap-only",
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-fmp-sec-filing/preflight-custom", async (req, res, next) => {
  try {
    const input = pullFmpSecFilingSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }
    const requestedRange = {
      from: input.from,
      to: input.to ?? getEtDateString(new Date()),
    };
    const tickerList = await getDefaultUniverseTickers();
    const existing = await getDb().get<{ existingItemsInRange: number }>(
      `SELECT COUNT(*) AS existingItemsInRange
       FROM news_items
       WHERE source = 'FMP'
         AND source_type = 'fmp_sec_filing'
         AND published_at >= ?
         AND published_at <= ?`,
      [requestedRange.from, `${requestedRange.to}T23:59:59.999Z`],
    );
    res.json({
      source: "FMP",
      sourceType: "fmp_sec_filing",
      requestedRange,
      executionMode: "summary-only",
      totalTickers: tickerList.length,
      existingItemsInRange: existing?.existingItemsInRange ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-rtpr", async (req, res, next) => {
  try {
    if (!config.rtprApiKey) {
      res.status(400).json({ error: "RTPR API key is not configured" });
      return;
    }

    const input = pullRtprSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom";

    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    // Duplicate job guard
    const rtprJobKey = "rtpr_press_release";
    const existingJobId = activePullJobs.get(rtprJobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An RTPR pull job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(rtprJobKey);
    }

    // Both modes use per-ticker fetch from universe
    const tickerList = await getDefaultUniverseTickers();
    const customRequestedRange = isCustom
      ? { from: input.from!, to: input.to ?? new Date().toISOString().slice(0, 10) }
      : null;
    const customGapPlans = isCustom
      ? await buildTickerGapPlans({
        tickers: tickerList,
        source: "RTPR",
        sourceType: "press_release",
        from: customRequestedRange!.from,
        to: customRequestedRange!.to,
        executionMode: "fully-covered-skip",
      })
      : undefined;

    const jobId = createJob(tickerList.length, {
      category: "news-update",
      label: "RTPR Pull",
    });
    activePullJobs.set(rtprJobKey, jobId);
    appendLog(jobId, `Starting RTPR ${input.mode} pull — ${tickerList.length} tickers`);
    appendLog(jobId, `[batch] requested tickerConcurrency=${input.tickerConcurrency}`);

    // For recent mode, load RTPR-specific anchor map
    let rtprAnchorMap: Map<string, string> | undefined;
    if (!isCustom) {
      rtprAnchorMap = await getTickerAnchorMap("press_release", "RTPR");
    }

    res.json({ jobId });

    // Background job execution
    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0, fullyCoveredSkipped: 0, gapRangesFetched: 0 };
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const fallback7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      // Use 'rtpr_press_release' as confirmed-empty key to separate from Finnhub's 'press_release'
      const confirmedEmptyKey = "rtpr_press_release";
      const workerCount = Math.max(1, Math.min(input.tickerConcurrency, tickerList.length || 1));
      let completedTickers = 0;

      const finishOneTicker = () => {
        completedTickers += 1;
        updateProgress(jobId, completedTickers);
      };

      const runTickerPool = async (processTicker: (ticker: string) => Promise<void>) => {
        let nextIndex = 0;
        const worker = async () => {
          while (!isJobCancelled(jobId)) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= tickerList.length) {
              return;
            }
            const ticker = tickerList[currentIndex];
            await processTicker(ticker);
            finishOneTicker();
          }
        };

        appendLog(jobId, `[batch] concurrency=${workerCount}`);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
      };

      try {
        if (isCustom && customRequestedRange && customGapPlans) {
          const summary = summarizeTickerGapPlans({
            source: "RTPR",
            sourceType: "press_release",
            requestedRange: customRequestedRange,
            plans: customGapPlans,
            executionMode: "fully-covered-skip",
          });
          appendLog(jobId, `[custom preflight] fullyCovered=${summary.fullyCoveredTickers}, missingTickers=${summary.tickersWithMissingGaps}, missingRanges=${summary.totalMissingRanges}`);
        }
        if (!isCustom) {
          // ── Recent mode: per-ticker incremental with anchor + confirmed-empty skip ──
          const fallbackCount = tickerList.filter(
            (t) => !rtprAnchorMap!.has(t.toUpperCase()),
          ).length;
          if (fallbackCount > 0) {
            appendLog(jobId, `${fallbackCount} tickers have no prior RTPR data → 7d fallback`);
          }

          await runTickerPool(async (ticker) => {
            const anchor = rtprAnchorMap!.get(ticker.toUpperCase());
            const tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;

            // Check confirmed-empty range
            const emptyRange = await getConfirmedEmptyRange(ticker, confirmedEmptyKey);
            if (emptyRange && tickerFrom >= emptyRange.rangeFrom && yesterday <= emptyRange.rangeTo) {
              return; // silently skip — no log for clean output
            }

            try {
              const items = await fetchRtprArticlesByTicker(ticker, 100);

              // Record confirmed-empty if API returned 0 articles for this ticker
              if (items.length === 0 && tickerFrom <= yesterday) {
                await recordConfirmedEmpty(ticker, confirmedEmptyKey, tickerFrom, yesterday);
                return;
              }

              // Filter by anchor date — keep only items newer than anchor
              const filtered = items.filter(
                (item) => item.publishedAt.slice(0, 10) >= tickerFrom,
              );

              for (const rawItem of filtered) {
                const inserted = await insertNewsItem({
                  publishedAt: rawItem.publishedAt,
                  source: rawItem.source,
                  sourceType: rawItem.sourceType,
                  title: rawItem.title,
                  body: rawItem.body,
                  url: rawItem.url,
                  tickers: rawItem.providerTickers,
                  tags: rawItem.tags,
                  publisher: rawItem.publisher,
                });
                const newsId = inserted?.id ?? await getNewsIdBySourceUrl(rawItem.source, rawItem.sourceType, rawItem.url);
                await persistRtprFulltext(newsId, rawItem.bodyHtml, rawItem.body, "rtpr-ingest");
                if (inserted) {
                  counters.totalInserted++;
                  newItems.push({
                    id: inserted.id,
                    tickers: inserted.tickers,
                    publishedAt: inserted.published_at,
                  });
                  streamHub.publishNews(inserted);
                } else {
                  counters.totalSkipped++;
                }
              }
              if (filtered.length > 0) {
                appendLog(jobId, `  RTPR ${ticker}: ${filtered.length} new (${items.length} fetched)`);
              }
            } catch (err: any) {
              console.error(`[pull-rtpr] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ RTPR ${ticker}: ${err.message}`);
            }
          });
        } else {
          // ── Custom mode: per-ticker fetch with explicit date range filter ──
          const effectiveFrom = customRequestedRange!.from;
          const effectiveTo = customRequestedRange!.to;
          appendLog(jobId, `Custom mode: ${effectiveFrom} ~ ${effectiveTo}, ${tickerList.length} tickers`);

          await runTickerPool(async (ticker) => {
            try {
              const plan = customGapPlans?.get(ticker);
              if (!plan || plan.missingRanges.length === 0) {
                counters.fullyCoveredSkipped += 1;
                return;
              }
              counters.gapRangesFetched += plan.missingRanges.length;
              const items = await fetchRtprArticlesByTicker(ticker, 100);
              // Filter by date range
              const filtered = items.filter((item) => {
                const d = item.publishedAt.slice(0, 10);
                return d >= effectiveFrom && d <= effectiveTo && isIsoDateInRanges(d, plan.missingRanges);
              });

              for (const rawItem of filtered) {
                const inserted = await insertNewsItem({
                  publishedAt: rawItem.publishedAt,
                  source: rawItem.source,
                  sourceType: rawItem.sourceType,
                  title: rawItem.title,
                  body: rawItem.body,
                  url: rawItem.url,
                  tickers: rawItem.providerTickers,
                  tags: rawItem.tags,
                  publisher: rawItem.publisher,
                });
                const newsId = inserted?.id ?? await getNewsIdBySourceUrl(rawItem.source, rawItem.sourceType, rawItem.url);
                await persistRtprFulltext(newsId, rawItem.bodyHtml, rawItem.body, "rtpr-ingest");
                if (inserted) {
                  counters.totalInserted++;
                  newItems.push({
                    id: inserted.id,
                    tickers: inserted.tickers,
                    publishedAt: inserted.published_at,
                  });
                  streamHub.publishNews(inserted);
                } else {
                  counters.totalSkipped++;
                }
              }
              if (filtered.length > 0) {
                appendLog(jobId, `  RTPR ${ticker}: ${filtered.length} in range (${items.length} fetched)`);
              }
            } catch (err: any) {
              console.error(`[pull-rtpr] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ RTPR ${ticker}: ${err.message}`);
            }
          });
        }

        appendLog(jobId, `Total: inserted=${counters.totalInserted}, skipped=${counters.totalSkipped}`);

        // ── Merge change% for newly inserted items ──
        let changeMergeResult = { merged: 0, skipped: 0 };
        if (newItems.length > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Merging change% for ${newItems.length} new items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems, undefined, () => isJobCancelled(jobId));
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-rtpr] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        // ── Update status ──
        await setLastSuccess("rtpr_press_release", new Date().toISOString(), {
          mode: input.mode,
          tickerCount: tickerList.length,
          tickerConcurrency: input.tickerConcurrency,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
        });

        completeJob(jobId, {
          source: "RTPR",
          mode: input.mode,
          tickerCount: tickerList.length,
          tickerConcurrency: input.tickerConcurrency,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
        });
        activePullJobs.delete(rtprJobKey);
      } catch (err: any) {
        console.error(`[pull-rtpr] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(rtprJobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-fmp-press-release", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP API key is not configured" });
      return;
    }

    const input = pullFmpPressReleaseSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom" || input.mode === "custom-entire";
    const isCustomEntire = input.mode === "custom-entire";
    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    const jobKey = "fmp_press_release";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An FMP press release pull job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const tickerList = await getDefaultUniverseTickers();
    const todayEt = getEtDateString(new Date());
    const fallback7d = getEtDateString(new Date(Date.now() - 7 * 86_400_000));
    const effectiveTo = input.to ?? todayEt;
    const customRequestedRange = isCustom ? { from: input.from!, to: effectiveTo } : null;
    const customGapPlans = (isCustom && !isCustomEntire)
      ? await buildTickerGapPlans({
        tickers: tickerList,
        source: "FMP",
        sourceType: "fmp_press_release",
        from: customRequestedRange!.from,
        to: customRequestedRange!.to,
        executionMode: "gap-only",
      })
      : undefined;
    const jobId = createJob(tickerList.length, {
      category: "news-update",
      label: "FMP PR Pull",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting FMP press release ${input.mode} pull — ${tickerList.length} tickers`);
    appendLog(jobId, `[batch] tickerConcurrency=${input.tickerConcurrency}, requestIntervalMs=${input.requestIntervalMs}, pageLimit=${input.pageLimit}, maxPages=${input.maxPages}`);

    let anchorMap: Map<string, string> | undefined;
    if (!isCustom) {
      anchorMap = await getTickerAnchorMap("fmp_press_release", "FMP");
    }

    res.json({ jobId });

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0, fullyCoveredSkipped: 0, gapRangesFetched: 0 };
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const newFulltextTargets: Array<{ id: string; url: string; publisher: string | null; body: string | null; source_type: string }> = [];
      const confirmedEmptyKey = "fmp_press_release";
      const yesterday = getEtDateString(new Date(Date.now() - 86_400_000));
      let completedTickers = 0;
      const startedAtMs = Date.now();
      const activeTickers = new Set<string>();
      let tickerPhaseHeartbeat: NodeJS.Timeout | null = null;

      const emitTickerPhaseLog = (reason: "heartbeat" | "checkpoint" | "final" = "heartbeat") => {
        const elapsedSec = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
        const activePreview = Array.from(activeTickers).slice(0, 4);
        const activeSummary = activePreview.length > 0
          ? `${activePreview.join(", ")}${activeTickers.size > activePreview.length ? ` +${activeTickers.size - activePreview.length} more` : ""}`
          : "none";
        appendLog(
          jobId,
          `[${reason}] completed=${completedTickers}/${tickerList.length}, inserted=${counters.totalInserted}, skipped=${counters.totalSkipped}, active=${activeSummary}, elapsed=${elapsedSec}s`,
        );
      };

      const stopTickerHeartbeat = () => {
        if (!tickerPhaseHeartbeat) {
          return;
        }
        clearInterval(tickerPhaseHeartbeat);
        tickerPhaseHeartbeat = null;
      };

      const startTickerHeartbeat = () => {
        if (tickerPhaseHeartbeat) {
          return;
        }
        tickerPhaseHeartbeat = setInterval(() => {
          if (!isJobCancelled(jobId) && completedTickers < tickerList.length) {
            emitTickerPhaseLog("heartbeat");
          }
        }, FMP_PR_HEARTBEAT_LOG_INTERVAL_MS);
        tickerPhaseHeartbeat.unref?.();
      };

      const finishOneTicker = () => {
        completedTickers += 1;
        updateProgress(jobId, completedTickers);
        if (
          completedTickers === tickerList.length
          || completedTickers % FMP_PR_CHECKPOINT_EVERY_TICKERS === 0
        ) {
          emitTickerPhaseLog(completedTickers === tickerList.length ? "final" : "checkpoint");
        }
      };

      const runTickerPool = async (processTicker: (ticker: string) => Promise<void>) => {
        const workerCount = Math.max(1, Math.min(input.tickerConcurrency, tickerList.length || 1));
        let nextIndex = 0;
        const worker = async () => {
          while (!isJobCancelled(jobId)) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= tickerList.length) {
              return;
            }
            const ticker = tickerList[currentIndex];
            activeTickers.add(ticker);
            try {
              await processTicker(ticker);
              finishOneTicker();
            } finally {
              activeTickers.delete(ticker);
            }
          }
        };

        appendLog(jobId, `[batch] concurrency=${workerCount}`);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
      };

      try {
        startTickerHeartbeat();
        if (isCustom && customRequestedRange && customGapPlans) {
          const summary = summarizeTickerGapPlans({
            source: "FMP",
            sourceType: "fmp_press_release",
            requestedRange: customRequestedRange,
            plans: customGapPlans,
            executionMode: "gap-only",
          });
          appendLog(jobId, `[custom preflight] fullyCovered=${summary.fullyCoveredTickers}, missingTickers=${summary.tickersWithMissingGaps}, missingRanges=${summary.totalMissingRanges}`);
        }
        if (!isCustom) {
          const fallbackCount = tickerList.filter((ticker) => !anchorMap!.has(ticker.toUpperCase())).length;
          if (fallbackCount > 0) {
            appendLog(jobId, `${fallbackCount} tickers have no prior FMP PR data → 7d fallback`);
          }

          await runTickerPool(async (ticker) => {
            const anchor = anchorMap!.get(ticker.toUpperCase());
            const tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;
            const emptyRange = await getConfirmedEmptyRange(ticker, confirmedEmptyKey);
            if (emptyRange && tickerFrom >= emptyRange.rangeFrom && yesterday <= emptyRange.rangeTo) {
              return;
            }

            try {
              const items = await fetchFmpPressReleasesByTicker(ticker, {
                fromDate: tickerFrom,
                toDate: effectiveTo,
                pageLimit: input.pageLimit,
                maxPages: input.maxPages,
                requestIntervalMs: input.requestIntervalMs,
              });

              if (items.length === 0 && tickerFrom <= yesterday) {
                await recordConfirmedEmpty(ticker, confirmedEmptyKey, tickerFrom, yesterday);
                return;
              }

              for (const rawItem of items) {
                const inserted = await insertNewsItem({
                  publishedAt: rawItem.publishedAt,
                  source: rawItem.source,
                  sourceType: rawItem.sourceType,
                  title: rawItem.title,
                  body: rawItem.body,
                  url: rawItem.url,
                  tickers: rawItem.providerTickers,
                  tags: rawItem.tags,
                  publisher: rawItem.publisher,
                });
                if (inserted) {
                  counters.totalInserted++;
                  newItems.push({
                    id: inserted.id,
                    tickers: inserted.tickers,
                    publishedAt: inserted.published_at,
                  });
                  newFulltextTargets.push({
                    id: inserted.id,
                    url: rawItem.url,
                    publisher: rawItem.publisher ?? null,
                    body: rawItem.body,
                    source_type: rawItem.sourceType,
                  });
                  streamHub.publishNews(inserted);
                } else {
                  counters.totalSkipped++;
                }
              }

              if (items.length > 0) {
                appendLog(jobId, `  FMP PR ${ticker}: ${items.length} new`);
              }
            } catch (err: any) {
              console.error(`[pull-fmp-press-release] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ FMP PR ${ticker}: ${err.message}`);
            }
          });
        } else if (isCustomEntire) {
          // Custom-entire mode: fetch full date range per ticker (no gap planning)
          const effectiveFrom = customRequestedRange!.from;
          appendLog(jobId, `Custom-entire mode: ${effectiveFrom} ~ ${effectiveTo}, ${tickerList.length} tickers`);

          await runTickerPool(async (ticker) => {
            try {
              const items = await fetchFmpPressReleasesByTicker(ticker, {
                fromDate: effectiveFrom,
                toDate: effectiveTo,
                pageLimit: input.pageLimit,
                maxPages: input.maxPages,
                requestIntervalMs: input.requestIntervalMs,
              });

              for (const rawItem of items) {
                const inserted = await insertNewsItem({
                  publishedAt: rawItem.publishedAt,
                  source: rawItem.source,
                  sourceType: rawItem.sourceType,
                  title: rawItem.title,
                  body: rawItem.body,
                  url: rawItem.url,
                  tickers: rawItem.providerTickers,
                  tags: rawItem.tags,
                  publisher: rawItem.publisher,
                });
                if (inserted) {
                  counters.totalInserted++;
                  newItems.push({
                    id: inserted.id,
                    tickers: inserted.tickers,
                    publishedAt: inserted.published_at,
                  });
                  newFulltextTargets.push({
                    id: inserted.id,
                    url: rawItem.url,
                    publisher: rawItem.publisher ?? null,
                    body: rawItem.body,
                    source_type: rawItem.sourceType,
                  });
                  streamHub.publishNews(inserted);
                } else {
                  counters.totalSkipped++;
                }
              }

              if (items.length > 0) {
                appendLog(jobId, `  FMP PR ${ticker}: ${items.length} in range`);
              }
            } catch (err: any) {
              console.error(`[pull-fmp-press-release] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ FMP PR ${ticker}: ${err.message}`);
            }
          });
        } else {
          // Custom gap-only mode: fetch only missing ranges per ticker
          const effectiveFrom = customRequestedRange!.from;
          appendLog(jobId, `Custom mode: ${effectiveFrom} ~ ${effectiveTo}, ${tickerList.length} tickers`);

          await runTickerPool(async (ticker) => {
            try {
              const plan = customGapPlans?.get(ticker);
              if (!plan || plan.missingRanges.length === 0) {
                counters.fullyCoveredSkipped += 1;
                return;
              }

              let fetchedCount = 0;
              for (const gapRange of plan.missingRanges) {
                counters.gapRangesFetched += 1;
                const items = await fetchFmpPressReleasesByTicker(ticker, {
                  fromDate: gapRange.from,
                  toDate: gapRange.to,
                  pageLimit: input.pageLimit,
                  maxPages: input.maxPages,
                  requestIntervalMs: input.requestIntervalMs,
                });
                fetchedCount += items.length;

                for (const rawItem of items) {
                  const inserted = await insertNewsItem({
                    publishedAt: rawItem.publishedAt,
                    source: rawItem.source,
                    sourceType: rawItem.sourceType,
                    title: rawItem.title,
                    body: rawItem.body,
                    url: rawItem.url,
                    tickers: rawItem.providerTickers,
                    tags: rawItem.tags,
                    publisher: rawItem.publisher,
                  });
                  if (inserted) {
                    counters.totalInserted++;
                    newItems.push({
                      id: inserted.id,
                      tickers: inserted.tickers,
                      publishedAt: inserted.published_at,
                    });
                    newFulltextTargets.push({
                      id: inserted.id,
                      url: rawItem.url,
                      publisher: rawItem.publisher ?? null,
                      body: rawItem.body,
                      source_type: rawItem.sourceType,
                    });
                    streamHub.publishNews(inserted);
                  } else {
                    counters.totalSkipped++;
                  }
                }
              }

              if (fetchedCount > 0) {
                appendLog(jobId, `  FMP PR ${ticker}: ${plan.missingRanges.length} gap(s), ${fetchedCount} fetched`);
              }
            } catch (err: any) {
              console.error(`[pull-fmp-press-release] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ FMP PR ${ticker}: ${err.message}`);
            }
          });
        }

        stopTickerHeartbeat();

        appendLog(jobId, `Total: inserted=${counters.totalInserted}, skipped=${counters.totalSkipped}`);

        let changeMergeResult = { merged: 0, skipped: 0 };
        if (newItems.length > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Merging change% for ${newItems.length} new FMP PR items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems, undefined, () => isJobCancelled(jobId));
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-fmp-press-release] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        const fulltextResult = await runInlineFulltextExtraction(
          jobId,
          newFulltextTargets,
          input.tickerConcurrency,
          "FMP PR",
        );

        await setLastSuccess("fmp_press_release", new Date().toISOString(), {
          mode: input.mode,
          tickerCount: tickerList.length,
          tickerConcurrency: input.tickerConcurrency,
          requestIntervalMs: input.requestIntervalMs,
          pageLimit: input.pageLimit,
          maxPages: input.maxPages,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
          fulltextSuccess: fulltextResult.success,
          fulltextSkipped: fulltextResult.skipped,
          fulltextFailed: fulltextResult.failed,
        });

        completeJob(jobId, {
          source: "FMP",
          mode: input.mode,
          sourceType: "fmp_press_release",
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
          fulltextSuccess: fulltextResult.success,
          fulltextSkipped: fulltextResult.skipped,
          fulltextFailed: fulltextResult.failed,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        stopTickerHeartbeat();
        console.error(`[pull-fmp-press-release] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-fmp-stock-news", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP API key is not configured" });
      return;
    }

    const input = pullFmpStockNewsSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom";
    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    const jobKey = "fmp_stock_news";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An FMP stock news pull job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const tickerList = await getDefaultUniverseTickers();
    const todayEt = getEtDateString(new Date());
    const fallback7d = getEtDateString(new Date(Date.now() - 7 * 86_400_000));
    const effectiveTo = input.to ?? todayEt;
    const customRequestedRange = isCustom ? { from: input.from!, to: effectiveTo } : null;
    const customGapPlans = isCustom
      ? await buildTickerGapPlans({
        tickers: tickerList,
        source: "FMP",
        sourceType: "fmp_stock_news",
        from: customRequestedRange!.from,
        to: customRequestedRange!.to,
        executionMode: "gap-only",
      })
      : undefined;
    const jobId = createJob(tickerList.length, {
      category: "news-update",
      label: "FMP Stock Pull",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting FMP stock news ${input.mode} pull — ${tickerList.length} tickers`);
    appendLog(jobId, `[batch] tickerConcurrency=${input.tickerConcurrency}, fulltextConcurrency=${input.fulltextConcurrency}, requestIntervalMs=${input.requestIntervalMs}, pageLimit=${input.pageLimit}, maxPages=${input.maxPages}`);

    let anchorMap: Map<string, string> | undefined;
    if (!isCustom) {
      anchorMap = await getTickerAnchorMap("fmp_stock_news", "FMP");
    }

    res.json({ jobId });

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0, fullyCoveredSkipped: 0, gapRangesFetched: 0 };
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];
      const newFulltextTargets: Array<{ id: string; url: string; publisher: string | null; body: string | null; source_type: string }> = [];
      const confirmedEmptyKey = "fmp_stock_news";
      const yesterday = getEtDateString(new Date(Date.now() - 86_400_000));
      let completedTickers = 0;

      const finishOneTicker = () => {
        completedTickers += 1;
        updateProgress(jobId, completedTickers);
      };

      const runTickerPool = async (processTicker: (ticker: string) => Promise<void>) => {
        const workerCount = Math.max(1, Math.min(input.tickerConcurrency, tickerList.length || 1));
        let nextIndex = 0;
        const worker = async () => {
          while (!isJobCancelled(jobId)) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= tickerList.length) {
              return;
            }
            const ticker = tickerList[currentIndex];
            await processTicker(ticker);
            finishOneTicker();
          }
        };

        appendLog(jobId, `[batch] concurrency=${workerCount}`);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
      };

      try {
        if (isCustom && customRequestedRange && customGapPlans) {
          const summary = summarizeTickerGapPlans({
            source: "FMP",
            sourceType: "fmp_stock_news",
            requestedRange: customRequestedRange,
            plans: customGapPlans,
            executionMode: "gap-only",
          });
          appendLog(jobId, `[custom preflight] fullyCovered=${summary.fullyCoveredTickers}, missingTickers=${summary.tickersWithMissingGaps}, missingRanges=${summary.totalMissingRanges}`);
        }
        if (!isCustom) {
          const fallbackCount = tickerList.filter((ticker) => !anchorMap!.has(ticker.toUpperCase())).length;
          if (fallbackCount > 0) {
            appendLog(jobId, `${fallbackCount} tickers have no prior FMP stock news data → 7d fallback`);
          }

          await runTickerPool(async (ticker) => {
            const anchor = anchorMap!.get(ticker.toUpperCase());
            const tickerFrom = anchor ? anchor.slice(0, 10) : fallback7d;
            const emptyRange = await getConfirmedEmptyRange(ticker, confirmedEmptyKey);
            if (emptyRange && tickerFrom >= emptyRange.rangeFrom && yesterday <= emptyRange.rangeTo) {
              return;
            }

            try {
              const items = await fetchFmpStockNewsByTicker(ticker, {
                fromDate: tickerFrom,
                toDate: effectiveTo,
                pageLimit: input.pageLimit,
                maxPages: input.maxPages,
                requestIntervalMs: input.requestIntervalMs,
              });

              if (items.length === 0 && tickerFrom <= yesterday) {
                await recordConfirmedEmpty(ticker, confirmedEmptyKey, tickerFrom, yesterday);
                return;
              }

              for (const rawItem of items) {
                const inserted = await insertNewsItem({
                  publishedAt: rawItem.publishedAt,
                  source: rawItem.source,
                  sourceType: rawItem.sourceType,
                  title: rawItem.title,
                  body: rawItem.body,
                  url: rawItem.url,
                  tickers: rawItem.providerTickers,
                  tags: rawItem.tags,
                  publisher: rawItem.publisher,
                });
                if (inserted) {
                  counters.totalInserted++;
                  newItems.push({
                    id: inserted.id,
                    tickers: inserted.tickers,
                    publishedAt: inserted.published_at,
                  });
                  newFulltextTargets.push({
                    id: inserted.id,
                    url: rawItem.url,
                    publisher: rawItem.publisher ?? null,
                    body: rawItem.body,
                    source_type: rawItem.sourceType,
                  });
                  streamHub.publishNews(inserted);
                } else {
                  counters.totalSkipped++;
                }
              }

              if (items.length > 0) {
                appendLog(jobId, `  FMP Stock ${ticker}: ${items.length} new`);
              }
            } catch (err: any) {
              console.error(`[pull-fmp-stock-news] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ FMP Stock ${ticker}: ${err.message}`);
            }
          });
        } else {
          const effectiveFrom = customRequestedRange!.from;
          appendLog(jobId, `Custom mode: ${effectiveFrom} ~ ${effectiveTo}, ${tickerList.length} tickers`);

          await runTickerPool(async (ticker) => {
            try {
              const plan = customGapPlans?.get(ticker);
              if (!plan || plan.missingRanges.length === 0) {
                counters.fullyCoveredSkipped += 1;
                return;
              }

              let fetchedCount = 0;
              for (const gapRange of plan.missingRanges) {
                counters.gapRangesFetched += 1;
                const items = await fetchFmpStockNewsByTicker(ticker, {
                  fromDate: gapRange.from,
                  toDate: gapRange.to,
                  pageLimit: input.pageLimit,
                  maxPages: input.maxPages,
                  requestIntervalMs: input.requestIntervalMs,
                });
                fetchedCount += items.length;

                for (const rawItem of items) {
                  const inserted = await insertNewsItem({
                    publishedAt: rawItem.publishedAt,
                    source: rawItem.source,
                    sourceType: rawItem.sourceType,
                    title: rawItem.title,
                    body: rawItem.body,
                    url: rawItem.url,
                    tickers: rawItem.providerTickers,
                    tags: rawItem.tags,
                    publisher: rawItem.publisher,
                  });
                  if (inserted) {
                    counters.totalInserted++;
                    newItems.push({
                      id: inserted.id,
                      tickers: inserted.tickers,
                      publishedAt: inserted.published_at,
                    });
                    newFulltextTargets.push({
                      id: inserted.id,
                      url: rawItem.url,
                      publisher: rawItem.publisher ?? null,
                      body: rawItem.body,
                      source_type: rawItem.sourceType,
                    });
                    streamHub.publishNews(inserted);
                  } else {
                    counters.totalSkipped++;
                  }
                }
              }

              if (fetchedCount > 0) {
                appendLog(jobId, `  FMP Stock ${ticker}: ${plan.missingRanges.length} gap(s), ${fetchedCount} fetched`);
              }
            } catch (err: any) {
              console.error(`[pull-fmp-stock-news] ${ticker}: ${err.message}`);
              appendLog(jobId, `  ⚠ FMP Stock ${ticker}: ${err.message}`);
            }
          });
        }

        appendLog(jobId, `Total: inserted=${counters.totalInserted}, skipped=${counters.totalSkipped}`);

        let changeMergeResult = { merged: 0, skipped: 0 };
        if (newItems.length > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Merging change% for ${newItems.length} new FMP stock items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems, undefined, () => isJobCancelled(jobId));
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-fmp-stock-news] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        const fulltextResult = await runInlineFulltextExtraction(
          jobId,
          newFulltextTargets,
          input.fulltextConcurrency,
          "FMP stock",
        );

        await setLastSuccess("fmp_stock_news", new Date().toISOString(), {
          mode: input.mode,
          tickerCount: tickerList.length,
          tickerConcurrency: input.tickerConcurrency,
          fulltextConcurrency: input.fulltextConcurrency,
          requestIntervalMs: input.requestIntervalMs,
          pageLimit: input.pageLimit,
          maxPages: input.maxPages,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
          fulltextSuccess: fulltextResult.success,
          fulltextSkipped: fulltextResult.skipped,
          fulltextFailed: fulltextResult.failed,
        });

        completeJob(jobId, {
          source: "FMP",
          mode: input.mode,
          sourceType: "fmp_stock_news",
          tickerCount: tickerList.length,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fullyCoveredSkipped: counters.fullyCoveredSkipped,
          gapRangesFetched: counters.gapRangesFetched,
          changeMerged: changeMergeResult.merged,
          fulltextSuccess: fulltextResult.success,
          fulltextSkipped: fulltextResult.skipped,
          fulltextFailed: fulltextResult.failed,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        console.error(`[pull-fmp-stock-news] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

// ── FMP SEC Filing pull ──
app.post("/api/news/pull-fmp-sec-filing", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP API key is not configured" });
      return;
    }

    const input = pullFmpSecFilingSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom";
    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    const jobKey = "fmp_sec_filing";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An FMP SEC filing pull job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const tickerList = await getDefaultUniverseTickers();
    const universeSet = new Set(tickerList.map((t) => t.toUpperCase()));
    const todayEt = getEtDateString(new Date());
    const effectiveTo = input.to ?? todayEt;

    let effectiveFrom: string;
    if (isCustom) {
      effectiveFrom = input.from!;
    } else {
      // Recent mode: find latest accepted_at for fmp_sec_filing
      const anchor = await getDb().get<{ max_acc: string | null }>(
        `SELECT MAX(published_at) as max_acc FROM news_items WHERE source = 'FMP' AND source_type = 'fmp_sec_filing'`,
      );
      effectiveFrom = anchor?.max_acc?.slice(0, 10) ?? getEtDateString(new Date(Date.now() - 7 * 86_400_000));
    }

    const jobId = createJob(tickerList.length, {
      category: "news-update",
      label: "FMP SEC Pull",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting FMP SEC filing ${input.mode} pull — from=${effectiveFrom} to=${effectiveTo}`);
    appendLog(jobId, `Universe: ${tickerList.length} tickers, endpoint=sec-filings-search/symbol, tickerConcurrency=${input.tickerConcurrency}, maxPages=${input.maxPages}, requestIntervalMs=${input.requestIntervalMs}`);

    res.json({ jobId });

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0, companionInserted: 0, filingSummary: 0, metadataSummary: 0 };
      const newItems: Array<{ id: string; tickers: string[]; publishedAt: string }> = [];

      try {
        const filings = await fetchFmpSecFilings({
          fromDate: effectiveFrom,
          toDate: effectiveTo,
          concurrency: input.tickerConcurrency,
          maxPages: input.maxPages,
          requestIntervalMs: input.requestIntervalMs,
          universeSymbols: universeSet,
          onProgress: (done, total) => updateProgress(jobId, done, total),
          shouldCancel: () => isJobCancelled(jobId),
        });

        appendLog(jobId, `Fetched ${filings.length} filings matching universe`);
        if (filings.length > 0) {
          appendLog(jobId, `Processing ${filings.length} fetched filings...`);
          updateProgress(jobId, 0, filings.length);
        }

        let processedFilings = 0;

        for (const filing of filings) {
          if (isJobCancelled(jobId)) break;

          const inserted = await insertNewsItem({
            publishedAt: filing.acceptedDate,
            source: "FMP",
            sourceType: "fmp_sec_filing",
            title: filing.title,
            body: filing.body,
            url: filing.finalLink,
            tickers: [filing.symbol],
            tags: [filing.formType.toLowerCase()],
            publisher: "SEC/EDGAR",
          });

          if (inserted) {
            counters.totalInserted++;
            newItems.push({
              id: inserted.id,
              tickers: inserted.tickers,
              publishedAt: inserted.published_at,
            });

            const summaryResult = await generateSecFilingSummary({
              symbol: filing.symbol,
              cik: filing.cik,
              formType: filing.formType,
              filingDate: filing.filingDate,
              acceptedDate: filing.acceptedDate,
              link: filing.link,
              finalLink: filing.finalLink,
            });

            let publishedItem = inserted;
            if (summaryResult.summary !== inserted.body) {
              await updateNewsBodyById(inserted.id, summaryResult.summary);
              publishedItem = { ...inserted, body: summaryResult.summary };
            }

            if (summaryResult.source === "filing-text") {
              counters.filingSummary++;
            } else {
              counters.metadataSummary++;
            }

            await insertSecFilingCompanion({
              newsId: inserted.id,
              accessionNumber: filing.accessionNumber,
              cik: filing.cik,
              formType: filing.formType,
              filedAt: filing.filingDate,
              acceptedAt: filing.acceptedDate,
              reportUrl: filing.finalLink,
              filingUrl: filing.link,
            });
            counters.companionInserted++;

            streamHub.publishNews(publishedItem);
          } else {
            counters.totalSkipped++;
          }

          processedFilings += 1;
          updateProgress(jobId, processedFilings, filings.length);
        }

        appendLog(jobId, `Insert: ${counters.totalInserted} new, ${counters.totalSkipped} skipped, ${counters.companionInserted} companion rows`);
        appendLog(jobId, `SEC summary: ${counters.filingSummary} filing-text, ${counters.metadataSummary} metadata fallback`);

        let changeMergeResult = { merged: 0, skipped: 0 };
        if (newItems.length > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Merging change% for ${newItems.length} new SEC filing items...`);
          try {
            changeMergeResult = await mergeChangeForNewItems(newItems, undefined, () => isJobCancelled(jobId));
            appendLog(jobId, `Change merge: ${changeMergeResult.merged} merged, ${changeMergeResult.skipped} skipped`);
          } catch (err: any) {
            console.error(`[pull-fmp-sec-filing] change merger error: ${err.message}`);
            appendLog(jobId, `⚠ Change merge error: ${err.message}`);
          }
        }

        await setLastSuccess("fmp_sec_filing", new Date().toISOString(), {
          mode: input.mode,
          from: effectiveFrom,
          to: effectiveTo,
          tickerConcurrency: input.tickerConcurrency,
          requestIntervalMs: input.requestIntervalMs,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          companionInserted: counters.companionInserted,
          filingSummary: counters.filingSummary,
          metadataSummary: counters.metadataSummary,
          changeMerged: changeMergeResult.merged,
        });

        completeJob(jobId, {
          source: "FMP",
          mode: input.mode,
          sourceType: "fmp_sec_filing",
          tickerConcurrency: input.tickerConcurrency,
          requestIntervalMs: input.requestIntervalMs,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          companionInserted: counters.companionInserted,
          filingSummary: counters.filingSummary,
          metadataSummary: counters.metadataSummary,
          changeMerged: changeMergeResult.merged,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        console.error(`[pull-fmp-sec-filing] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

// ── Active jobs (for auto-reconnect after page refresh) ──

// ── Investing News pull ──
const pullInvestingSchema = z.object({
  mode: z.enum(["recent", "custom"]).optional().default("recent"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.enum(["all", "stock-market-news", "cryptocurrency-news"]).optional().default("all"),
  maxPages: z.number().int().min(1).max(50).optional().default(5),
  requestIntervalMs: z.number().int().min(0).max(10_000).optional().default(1000),
  fulltextConcurrency: z.number().int().min(1).max(200).optional().default(10),
});

app.post("/api/news/pull-investing/preflight-custom", async (req, res, next) => {
  try {
    const input = pullInvestingSchema.parse({ ...(req.body ?? {}), mode: "custom" });
    if (!input.from) {
      res.status(400).json({ error: "Custom preflight requires 'from' date" });
      return;
    }

    const requestedRange = {
      from: input.from,
      to: input.to ?? getEtDateString(new Date()),
    };
    const categories: InvestingCategory[] =
      input.category === "all"
        ? ["stock-market-news", "cryptocurrency-news"]
        : [input.category];
    const sourceTypes = categories.map((category) => investingCategoryToSourceType(category));
    const placeholders = categories.map(() => "?").join(",");
    const rows = await getDb().all<{ source_type: string; item_count: number }[]>(
      `SELECT source_type, COUNT(*) AS item_count
       FROM news_items
       WHERE source = 'INVESTING'
         AND source_type IN (${placeholders})
         AND published_at >= ?
         AND published_at <= ?
       GROUP BY source_type`,
      [...sourceTypes, requestedRange.from, `${requestedRange.to}T23:59:59.999Z`],
    );
    res.json({
      source: "INVESTING",
      sourceType: input.category,
      requestedRange,
      executionMode: "summary-only",
      categories: categories.map((category) => ({
        category,
        existingItemsInRange: rows.find((row) => row.source_type === investingCategoryToSourceType(category))?.item_count ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/pull-investing", async (req, res, next) => {
  try {
    const input = pullInvestingSchema.parse(req.body ?? {});
    const isCustom = input.mode === "custom";
    if (isCustom && !input.from) {
      res.status(400).json({ error: "Custom mode requires 'from' date" });
      return;
    }

    const jobKey = "investing_news";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An Investing news pull job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const categories: InvestingCategory[] =
      input.category === "all"
        ? ["stock-market-news", "cryptocurrency-news"]
        : [input.category];
    const todayEt = getEtDateString(new Date());
    const fallback7d = getEtDateString(new Date(Date.now() - 7 * 86_400_000));
    const effectiveFrom = isCustom ? input.from! : fallback7d;
    const effectiveTo = input.to ?? todayEt;
    let customSummary:
      | {
          route: string;
          requestedRange: { from: string; to: string };
          executionMode: string;
          categories: Array<{ category: InvestingCategory; existingItemsInRange: number }>;
        }
      | undefined;

    if (isCustom) {
      const sourceTypes = categories.map((category) => investingCategoryToSourceType(category));
      const placeholders = categories.map(() => "?").join(",");
      const rows = await getDb().all<{ source_type: string; item_count: number }[]>(
        `SELECT source_type, COUNT(*) AS item_count
         FROM news_items
         WHERE source = 'INVESTING'
           AND source_type IN (${placeholders})
           AND published_at >= ?
           AND published_at <= ?
         GROUP BY source_type`,
        [...sourceTypes, effectiveFrom, `${effectiveTo}T23:59:59.999Z`],
      );
      customSummary = {
        route: "/api/news/pull-investing",
        requestedRange: { from: effectiveFrom, to: effectiveTo },
        executionMode: "summary-only",
        categories: categories.map((category) => ({
          category,
          existingItemsInRange: rows.find((row) => row.source_type === investingCategoryToSourceType(category))?.item_count ?? 0,
        })),
      };
    }

    const jobId = createJob(categories.length, {
      category: "news-update",
      label: `Investing Pull (${input.category})`,
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting Investing ${input.mode} pull — categories: ${categories.join(", ")}, from=${effectiveFrom}, to=${effectiveTo}, maxPages=${input.maxPages}`);

    res.json({ jobId });

    (async () => {
      const counters = { totalInserted: 0, totalSkipped: 0 };
      const newFulltextTargets: Array<{ id: string; url: string; publisher: string | null; body: string | null; source_type: string }> = [];
      const perCategory = new Map<InvestingCategory, { existingItemsInRange: number; fetchedItems: number; inserted: number; skipped: number }>(
        categories.map((category) => [
          category,
          {
            existingItemsInRange: customSummary?.categories.find((item) => item.category === category)?.existingItemsInRange ?? 0,
            fetchedItems: 0,
            inserted: 0,
            skipped: 0,
          },
        ]),
      );

      try {
        for (const category of categories) {
          if (isJobCancelled(jobId)) break;

          appendLog(jobId, `Fetching ${category}...`);
          const items = await fetchInvestingCategory(category, {
            maxPages: input.maxPages,
            requestIntervalMs: input.requestIntervalMs,
            fromDate: effectiveFrom,
            toDate: effectiveTo,
          });

          appendLog(jobId, `  ${category}: ${items.length} articles found`);
          const categoryCounters = perCategory.get(category);
          if (categoryCounters) {
            categoryCounters.fetchedItems = items.length;
          }

          for (const rawItem of items) {
            const inserted = await insertNewsItem({
              publishedAt: rawItem.publishedAt,
              source: rawItem.source,
              sourceType: rawItem.sourceType,
              title: rawItem.title,
              body: rawItem.body,
              url: rawItem.url,
              tickers: rawItem.providerTickers,
              tags: rawItem.tags,
              publisher: rawItem.publisher,
            });
            if (inserted) {
              counters.totalInserted++;
              if (categoryCounters) {
                categoryCounters.inserted++;
              }
              newFulltextTargets.push({
                id: inserted.id,
                url: rawItem.url,
                publisher: rawItem.publisher ?? null,
                body: rawItem.body,
                source_type: rawItem.sourceType,
              });
              streamHub.publishNews(inserted);
            } else {
              counters.totalSkipped++;
              if (categoryCounters) {
                categoryCounters.skipped++;
              }
            }
          }

          updateProgress(jobId, categories.indexOf(category) + 1);
        }

        appendLog(jobId, `Total: inserted=${counters.totalInserted}, skipped=${counters.totalSkipped}`);

        const fulltextResult = await runInlineFulltextExtraction(
          jobId,
          newFulltextTargets,
          input.fulltextConcurrency,
          "Investing",
        );

        completeJob(jobId, {
          source: "INVESTING",
          route: customSummary?.route,
          mode: input.mode,
          category: input.category,
          requestedRange: customSummary?.requestedRange ?? { from: effectiveFrom, to: effectiveTo },
          executionMode: customSummary?.executionMode,
          categories: customSummary
            ? categories.map((category) => ({ category, ...perCategory.get(category)! }))
            : undefined,
          inserted: counters.totalInserted,
          skipped: counters.totalSkipped,
          fulltextSuccess: fulltextResult.success,
          fulltextSkipped: fulltextResult.skipped,
          fulltextFailed: fulltextResult.failed,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        console.error(`[pull-investing] job ${jobId} fatal error: ${err.message}`);
        failJob(jobId, err.message || "Unknown error");
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/active", (_req, res) => {
    const active = getActiveJobs().map((j) => ({
    id: j.id,
      category: j.category,
      label: j.label,
    scope: j.scope,
    status: j.status,
    progress: j.progress,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  }));
  res.json(active);
});

// ── Job status polling endpoint ──
app.get("/api/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    id: job.id,
    category: job.category,
    label: job.label,
    scope: job.scope,
    status: job.status,
    progress: job.progress,
    logs: job.logs,
    error: job.error,
    result: job.result,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

// ── Cancel a running job ──
app.post("/api/jobs/:jobId/cancel", (req, res) => {
  const ok = cancelJob(req.params.jobId);
  if (!ok) {
    res.status(404).json({ error: "Job not found or not running" });
    return;
  }
  res.json({ cancelled: true });
});

// ── Full Text Extraction endpoints (Step 10) ──

app.post("/api/news/fulltext/update", async (req, res, next) => {
  try {
    const sourceType: string | undefined = req.body?.sourceType; // 'all' | 'company_news' | 'press_release' | 'fmp_press_release' | 'fmp_stock_news'
    const sourceName: string | undefined = req.body?.sourceName;
    const concurrency: number = Math.max(1, Math.min(Number(req.body?.concurrency) || 200, 200));

    // backfill publisher for any rows missing it
    await backfillPublisher();

    const unextracted = sourceType === "fmp_sec_filing"
      ? await getFmpSecFulltextBackfillRows(sourceName)
      : await getUnextractedNewsIds(sourceType, sourceName);
    const total = unextracted.length;
    const jobId = createJob(total, {
      category: "news-fulltext",
      label: sourceType ? `Full Text (${sourceType})` : "Full Text (all)",
    });

    // Fire-and-forget background job
    runFulltextUpdate(jobId, sourceType, sourceName, concurrency).catch((err) => {
      console.error("[fulltext-update] unhandled:", err);
    });

    res.json({ jobId, total, concurrency, sourceName: sourceName ?? "all" });
  } catch (error) {
    next(error);
  }
});

// Backfill: convert existing HTML-based fulltext to plain text
app.post("/api/news/fulltext/backfill-plaintext", async (_req, res, next) => {
  try {
    const jobId = createJob(0, {
      category: "news-fulltext",
      label: "Full Text Plaintext Backfill",
    });
    runFulltextPlainTextBackfill(jobId).catch((err) => {
      console.error("[fulltext-backfill] unhandled:", err);
    });
    res.json({ jobId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/backfill-rtpr", async (req, res, next) => {
  try {
    const concurrency: number = Math.max(1, Math.min(Number(req.body?.concurrency) || 10, 200));
    const jobId = createJob(0, {
      category: "news-fulltext",
      label: "RTPR Full Text Backfill",
    });
    runRtprBodyBackfill(jobId, concurrency).catch((err) => {
      console.error("[fulltext-backfill-rtpr] unhandled:", err);
    });
    res.json({ jobId, concurrency });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/backfill-origin-url", async (req, res, next) => {
  try {
    const jobId = createJob(0);
    runOriginUrlBackfill(jobId).catch((err) => {
      console.error("[backfill-origin-url] unhandled:", err);
    });
    res.json({ jobId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/backfill-company-origin-url", async (req, res, next) => {
  try {
    const concurrency = Math.max(1, Math.min(Number(req.body?.concurrency) || 20, 100));
    const batchSize = Math.max(concurrency, Math.min(Number(req.body?.batchSize) || 500, 5000));
    const totalRow = await getDb().get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM news_items
       WHERE source = 'FINNHUB'
         AND source_type = 'company_news'
         AND (origin_url IS NULL OR TRIM(origin_url) = '')`,
    );
    const total = totalRow?.count ?? 0;

    const jobId = createJob(total, {
      category: "news-fulltext",
      label: "Company News Origin URL Backfill",
    });
    runCompanyNewsOriginUrlBackfill(jobId, concurrency, batchSize).catch((err) => {
      console.error("[backfill-company-origin-url] unhandled:", err);
    });
    res.json({ jobId, total, concurrency, batchSize });
  } catch (error) {
    next(error);
  }
});

// ── Full text: stats & reset failed ──
// NOTE: these must be before :newsId to avoid Express treating "stats" as a param

app.get("/api/news/fulltext/stats", async (_req, res, next) => {
  try {
    const rows = await getFulltextStats();
    res.json({ stats: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/reset-failed", async (_req, res, next) => {
  try {
    const deleted = await deleteFailedFulltextRows();
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/reset-fmp-pr-fallback", async (_req, res, next) => {
  try {
    const deleted = await deleteFmpPressReleaseFallbackRows();
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/reset-fmp-stock-fallback", async (_req, res, next) => {
  try {
    const deleted = await deleteFmpStockNewsFallbackRows();
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/fulltext/reset-company-news", async (_req, res, next) => {
  try {
    const deleted = await deleteCompanyNewsFulltextRows();
    res.json({ deleted });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/fulltext/:newsId", async (req, res, next) => {
  try {
    const row = await getFulltext(req.params.newsId);
    if (!row) {
      res.status(404).json({ error: "Full text not found" });
      return;
    }
    // If stored text contains HTML tags, convert to plain text for UI display
    const isHtml = /<[a-z][\s\S]*>/i.test(row.full_text);
    const displayText = isHtml ? htmlToPlainText(row.full_text) : row.full_text;
    res.json({
      newsId: row.news_id,
      fullText: displayText,
      extractionStatus: row.extraction_status,
      extractionNote: row.extraction_note,
      wordCount: row.word_count,
      extractedAt: row.extracted_at,
      keywords: JSON.parse(row.keywords_json || "[]"),
      keywordsStatus: row.keywords_status,
    });
  } catch (error) {
    next(error);
  }
});

// ── Change Metrics Update endpoints (5-20, 5-21) ──

app.post("/api/news/change/update-recent", async (req, res, next) => {
  try {
    const jobKey = "news_change_recent";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `A recent change update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }
    const concurrencyRaw = Number(req.body?.fmpConcurrency ?? req.body?.ibkrConcurrency);
    const intervalRaw = Number(req.body?.fmpRequestIntervalMs);
    const fmpFallback: FmpFallbackOptions = {
      enabled: true,
      concurrency: clampFmpConcurrency(Number.isFinite(concurrencyRaw) ? concurrencyRaw : 5),
      requestIntervalMs: clampFmpIntervalMs(Number.isFinite(intervalRaw) ? intervalRaw : 250),
    };
    const jobId = createJob(0, {
      category: "news-update",
      label: "News Change Update (Recent)",
      scope: "finnhub-news",
    }); // total unknown upfront
    activePullJobs.set(jobKey, jobId);
    (async () => {
      try {
        await bulkUpdateRecentChange((done, total) => {
          updateProgress(jobId, done, total);
        }, undefined, () => isJobCancelled(jobId), fmpFallback, (msg) => appendLog(jobId, msg));
        if (isJobCancelled(jobId)) { activePullJobs.delete(jobKey); return; }
        await setLastSuccess("news_change_recent", new Date().toISOString());
        completeJob(jobId);
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        failJob(jobId, err?.message ?? String(err));
        activePullJobs.delete(jobKey);
      }
    })();
    res.json({ jobId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/change/update-recent-fmp-missing", async (req, res, next) => {
  try {
    const jobKey = "news_change_recent_fmp_missing";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An FMP recent missing change update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const concurrencyRaw = Number(req.body?.fmpConcurrency ?? req.body?.ibkrConcurrency);
    const intervalRaw = Number(req.body?.fmpRequestIntervalMs);
    const fmpFallback: FmpFallbackOptions = {
      enabled: true,
      concurrency: clampFmpConcurrency(Number.isFinite(concurrencyRaw) ? concurrencyRaw : 5),
      requestIntervalMs: clampFmpIntervalMs(Number.isFinite(intervalRaw) ? intervalRaw : 250),
    };
    const jobId = createJob(0, {
      category: "news-update",
      label: "FMP Recent Change Fill",
      scope: "finnhub-news",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting FMP recent missing change update with concurrency=${fmpFallback.concurrency}, interval=${fmpFallback.requestIntervalMs ?? 250}ms`);
    res.json({ jobId });

    (async () => {
      try {
        const result = await bulkUpdateRecentMissingChange((done, total) => {
          updateProgress(jobId, done, total);
        }, undefined, () => isJobCancelled(jobId), fmpFallback, (msg) => appendLog(jobId, msg));
        if (isJobCancelled(jobId)) {
          activePullJobs.delete(jobKey);
          return;
        }
        await setLastSuccess(jobKey, new Date().toISOString(), {
          updated: result.updated,
          skipped: result.skipped,
          fmpConcurrencyUsed: fmpFallback.concurrency,
          fmpRequestIntervalMsUsed: fmpFallback.requestIntervalMs ?? 250,
        });
        completeJob(jobId, {
          updated: result.updated,
          skipped: result.skipped,
          fmpConcurrencyUsed: fmpFallback.concurrency,
          fmpRequestIntervalMsUsed: fmpFallback.requestIntervalMs ?? 250,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        failJob(jobId, err?.message ?? String(err));
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

const customChangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fmpConcurrency: z.number().int().min(1).max(20).optional(),
  fmpRequestIntervalMs: z.number().int().min(0).max(5000).optional(),
  ibkrConcurrency: z.number().int().min(1).max(100).optional(),
});

app.post("/api/news/change/update-custom/preflight", async (req, res, next) => {
  try {
    const { from, to } = customChangeSchema.parse(req.body);
    const counts = await getDb().get<{
      totalRowsInRange: number;
      rowsWithChangePct: number;
    }>(
      `SELECT COUNT(*) AS totalRowsInRange,
              SUM(CASE WHEN ncm.news_id IS NOT NULL THEN 1 ELSE 0 END) AS rowsWithChangePct
       FROM news_items ni
       LEFT JOIN news_change_metrics ncm
         ON ncm.news_id = ni.id AND ncm.metric_key = 'change_pct'
       WHERE ni.published_at >= ?
         AND ni.published_at <= ?`,
      [from, `${to}T23:59:59.999Z`],
    );
    const totalRowsInRange = counts?.totalRowsInRange ?? 0;
    const rowsWithChangePct = counts?.rowsWithChangePct ?? 0;
    res.json({
      route: "/api/news/change/update-custom",
      requestedRange: { from, to },
      executionMode: "summary-only",
      totalRowsInRange,
      rowsWithChangePct,
      rowsExpectedToUpdate: Math.max(0, totalRowsInRange - rowsWithChangePct),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/change/update-custom", async (req, res, next) => {
  try {
    const jobKey = "news_change_custom";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `A custom change update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }
    const { from, to, fmpConcurrency, fmpRequestIntervalMs, ibkrConcurrency } = customChangeSchema.parse(req.body);
    const counts = await getDb().get<{
      totalRowsInRange: number;
      rowsWithChangePct: number;
    }>(
      `SELECT COUNT(*) AS totalRowsInRange,
              SUM(CASE WHEN ncm.news_id IS NOT NULL THEN 1 ELSE 0 END) AS rowsWithChangePct
       FROM news_items ni
       LEFT JOIN news_change_metrics ncm
         ON ncm.news_id = ni.id AND ncm.metric_key = 'change_pct'
       WHERE ni.published_at >= ?
         AND ni.published_at <= ?`,
      [from, `${to}T23:59:59.999Z`],
    );
    const preflightSummary = {
      route: "/api/news/change/update-custom",
      requestedRange: { from, to },
      executionMode: "summary-only",
      totalRowsInRange: counts?.totalRowsInRange ?? 0,
      rowsWithChangePct: counts?.rowsWithChangePct ?? 0,
      rowsExpectedToUpdate: Math.max(0, (counts?.totalRowsInRange ?? 0) - (counts?.rowsWithChangePct ?? 0)),
    };
    const fmpFallback: FmpFallbackOptions = {
      enabled: true,
      concurrency: clampFmpConcurrency(fmpConcurrency ?? ibkrConcurrency ?? 5),
      requestIntervalMs: clampFmpIntervalMs(fmpRequestIntervalMs),
    };
    const jobId = createJob(0, {
      category: "news-update",
      label: "News Change Update (Custom)",
      scope: "finnhub-news",
    });
    activePullJobs.set(jobKey, jobId);
    (async () => {
      try {
        const result = await bulkUpdateCustomChange(from, to, (done, total) => {
          updateProgress(jobId, done, total);
        }, undefined, () => isJobCancelled(jobId), fmpFallback, (msg) => appendLog(jobId, msg));
        if (isJobCancelled(jobId)) { activePullJobs.delete(jobKey); return; }
        await setLastSuccess("news_change_custom", new Date().toISOString(), { from, to });
        completeJob(jobId, {
          ...preflightSummary,
          rowsUpdated: result.updated,
          rowsSkipped: result.skipped,
          fmpConcurrencyUsed: fmpFallback.concurrency,
        });
        activePullJobs.delete(jobKey);
      } catch (err: any) {
        failJob(jobId, err?.message ?? String(err));
        activePullJobs.delete(jobKey);
      }
    })();
    res.json({ jobId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/earnings/update-custom", async (req, res, next) => {
  try {
    const jobKey = "news_earnings_custom";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `A custom earnings date update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const filters = parseNewsQuery(req.body ?? {});
    if (!filters.from || !filters.to || !ISO_DATE_RE.test(filters.from) || !ISO_DATE_RE.test(filters.to)) {
      res.status(400).json({ error: "Custom earning date update requires from/to in YYYY-MM-DD format" });
      return;
    }
    if (filters.to < filters.from) {
      res.status(400).json({ error: "to must be greater than or equal to from" });
      return;
    }

    const freshnessError = await getNewsEarningsFreshnessError();
    if (freshnessError) {
      res.status(412).json({ error: freshnessError });
      return;
    }

    const candidates = await listNewsEarningsCandidates(filters);
    const jobId = createJob(candidates.length, {
      category: "news-update",
      label: "News Earnings Dates Update (Custom)",
      scope: "finnhub-news",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting custom earnings date update for ${filters.from}~${filters.to}`);
    appendLog(jobId, `Candidates=${candidates.length}`);
    res.json({ jobId, requestedRange: { from: filters.from, to: filters.to }, candidateCount: candidates.length });

    void (async () => {
      try {
        const result = await runNewsEarningsContextUpdate({
          candidates,
          mode: "custom",
          requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          shouldCancel: () => isJobCancelled(jobId),
          onProgress: (completed, total) => updateProgress(jobId, completed, total),
          onLog: (message) => appendLog(jobId, message),
        });
        if (isJobCancelled(jobId)) {
          activePullJobs.delete(jobKey);
          return;
        }

        await setLastSuccess("news_earnings_custom", new Date().toISOString(), {
          from: filters.from,
          to: filters.to,
          candidateCount: candidates.length,
        });
        completeJob(jobId, {
          requestedRange: { from: filters.from, to: filters.to },
          ...result,
        });
        activePullJobs.delete(jobKey);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/news/earnings/check-unconfirmed", async (req, res, next) => {
  try {
    const jobKey = "news_earnings_check_unconfirmed";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An unconfirmed earnings date check job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const freshnessError = await getNewsEarningsFreshnessError();
    if (freshnessError) {
      res.status(412).json({ error: freshnessError });
      return;
    }

    const filters = parseNewsQuery(req.body ?? {});
    const candidates = await listNewsEarningsCandidates(filters, { onlyUnconfirmed: true });
    const jobId = createJob(candidates.length, {
      category: "news-update",
      label: "Check Unconfirmed Earning Date",
      scope: "finnhub-news",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting unconfirmed earnings date check for ${candidates.length} candidates`);
    res.json({ jobId, candidateCount: candidates.length });

    void (async () => {
      try {
        const result = await runNewsEarningsContextUpdate({
          candidates,
          mode: "check-unconfirmed",
          requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          shouldCancel: () => isJobCancelled(jobId),
          onProgress: (completed, total) => updateProgress(jobId, completed, total),
          onLog: (message) => appendLog(jobId, message),
        });
        if (isJobCancelled(jobId)) {
          activePullJobs.delete(jobKey);
          return;
        }

        await setLastSuccess("news_earnings_check_unconfirmed", new Date().toISOString(), {
          candidateCount: candidates.length,
          from: filters.from ?? null,
          to: filters.to ?? null,
        });
        completeJob(jobId, { ...result });
        activePullJobs.delete(jobKey);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.get("/api/model1/news", async (req, res, next) => {
  try {
    const parsedQuery = parseNewsQuery(req.query as Record<string, unknown>);
    const result = await getModel1News(parsedQuery);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/model1/news/:id", async (req, res, next) => {
  try {
    const item = await getModel1NewsById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news", async (req, res, next) => {
  try {
    const parsedQuery = parseNewsQuery(req.query as Record<string, unknown>);
    const result = await getNews(parsedQuery);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/:id", async (req, res, next) => {
  try {
    const item = await getNewsById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const pullEodhdSchema = z
  .object({
    date: isoDateSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    symbol: z.string().optional().default("QQQ.US"),
    limit: z.number().int().min(1).max(200).optional().default(200),
    offset: z.number().int().min(0).optional().default(0),
    fetch_all: z.boolean().optional().default(false)
  })
  .refine(
    (value) => {
      const hasDate = typeof value.date === "string";
      const hasRange = typeof value.from === "string" && typeof value.to === "string";
      return hasDate !== hasRange; // exactly one mode
    },
    { message: "Provide either {date} or {from,to} (but not both)." }
  );

// One-shot import endpoint used for demos/backfills.
// Reads token from repo-root EODHD/API TOKEN and inserts items into SQLite with DB-level dedupe.
app.post("/api/news/pull-eodhd", async (req, res, next) => {
  try {
    const input = pullEodhdSchema.parse(req.body);

    const from = input.date ?? input.from!;
    const to = input.date ?? input.to!;

    const offset = input.offset;
    const providerResult = input.fetch_all
      ? await pullEodhdNewsAll({ symbol: input.symbol, from, to, pageSize: input.limit })
      : {
          items: await pullEodhdNews({ symbol: input.symbol, from, to, limit: input.limit, offset }),
          truncated: false
        };

    const providerItems = providerResult.items;

    let insertedCount = 0;
    for (const rawItem of providerItems) {
      const inserted = await insertNewsItem({
        publishedAt: rawItem.publishedAt,
        source: rawItem.source,
        sourceType: rawItem.sourceType,
        title: rawItem.title,
        body: rawItem.body,
        url: rawItem.url,
        tickers: rawItem.providerTickers,
        tags: rawItem.tags
      });
      if (inserted) {
        insertedCount += 1;
        streamHub.publishNews(inserted);
      }
    }

    const done = !input.fetch_all && providerItems.length < input.limit;
    const nextOffset = input.fetch_all ? undefined : done ? undefined : offset + providerItems.length;

    res.json({
      symbol: input.symbol,
      from,
      to,
      offset: input.fetch_all ? undefined : offset,
      nextOffset,
      done: input.fetch_all ? undefined : done,
      fetched: providerItems.length,
      inserted: insertedCount,
      truncated: providerResult.truncated
    });
  } catch (error) {
    next(error);
  }
});

const savedViewSchema = z.object({
  name: z.string().min(1),
  queryJson: z.record(z.any()),
  enableAlerts: z.boolean().default(false)
});

app.post("/api/news/saved-views", async (req, res, next) => {
  try {
    const input = savedViewSchema.parse(req.body);
    const row = await createSavedView(DEMO_USER_ID, input.name, input.queryJson, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/saved-views", async (_req, res, next) => {
  try {
    const rows = await listSavedViews(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/news/saved-views/:id", async (req, res, next) => {
  try {
    const deleted = await deleteSavedView(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Saved view not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const watchlistSchema = z.object({
  name: z.string().min(1),
  tickers: z.array(z.string()).default([]),
  enableAlerts: z.boolean().default(false)
});

app.get("/api/watchlists", async (_req, res, next) => {
  try {
    const rows = await listWatchlists(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/watchlists", async (req, res, next) => {
  try {
    const input = watchlistSchema.parse(req.body);
    const row = await createWatchlist(DEMO_USER_ID, input.name, input.tickers, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.put("/api/watchlists/:id", async (req, res, next) => {
  try {
    const input = watchlistSchema.parse(req.body);
    const row = await updateWatchlist(DEMO_USER_ID, req.params.id, input.name, input.tickers, input.enableAlerts);
    if (!row) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/watchlists/:id", async (req, res, next) => {
  try {
    const deleted = await deleteWatchlist(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/types", (_req, res) => {
  res.json(getCalendarTypes());
});

app.get("/api/calendar/events", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const from = typeof req.query.from === "string" ? normalizeCalendarFromParam(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? normalizeCalendarToParam(req.query.to) : undefined;
    const result = await listCalendarEvents({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from,
      to,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      userId: DEMO_USER_ID
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/export.csv", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const from = typeof req.query.from === "string" ? normalizeCalendarFromParam(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? normalizeCalendarToParam(req.query.to) : undefined;
    const csv = await exportCalendarEventsCsv({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from,
      to,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      userId: DEMO_USER_ID
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="calendar_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/:id", async (req, res, next) => {
  try {
    const event = await getCalendarEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    res.json(event);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/financials/:ticker", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP_API_KEY not configured" });
      return;
    }

    const ticker = normalizeUpperTicker(req.params.ticker);
    if (!ticker) {
      res.status(400).json({ error: "Ticker is required" });
      return;
    }

    const cached = await getStoredCalendarFinancialSeries(ticker);
    if (cached && (cached.annual.length > 0 || cached.quarterly.length > 0)) {
      res.json(cached);
      return;
    }

    const result = await fetchFmpFinancialSeries(ticker);
    if (result.annual.length === 0 && result.quarterly.length === 0) {
      res.status(404).json({ error: `No FMP financial history found for ${ticker}` });
      return;
    }

    await replaceCalendarFinancialSeriesSnapshot(result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/fmp/calendar/financials/update", async (_req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP_API_KEY not configured" });
      return;
    }

    const concurrency = clampFmpConcurrency(Number(_req.body?.concurrency));
    const requestIntervalMs = clampFmpIntervalMs(Number(_req.body?.requestIntervalMs));

    const tickers = Array.from(
      new Set((await getDefaultUniverseTickers())
        .map((ticker) => normalizeUpperTicker(ticker))
        .filter((ticker): ticker is string => Boolean(ticker)))
    );

    if (tickers.length === 0) {
      res.status(400).json({ error: "Default universe is empty" });
      return;
    }

    const jobId = createJob(tickers.length, {
      category: "other",
      label: "FMP Financial + Past Estimate Sync",
    });
    const workerCount = Math.max(1, Math.min(concurrency, tickers.length || 1));
    appendLog(jobId, `Starting FMP financial + past estimate sync for ${tickers.length} default-universe tickers`);
    appendLog(jobId, "Endpoints=stable/income-statement + stable/key-metrics + stable/ratios + stable/analyst-estimates");
    appendLog(jobId, "Quarterly analyst-estimates window is extended so past estimate periods can be merged into the stored quarterly history");
    appendLog(jobId, `[batch] concurrency=${workerCount}, requestIntervalMs=${requestIntervalMs}`);
    res.json({ jobId, requestedTickers: tickers.length });

    void (async () => {
      try {
        let syncedTickers = 0;
        let tickersFailed = 0;
        let annualRows = 0;
        let quarterlyRows = 0;
        let annualEstimateRows = 0;
        let quarterlyEstimateRows = 0;
        let nextIndex = 0;
        let completedTickers = 0;
        const runDbWrite = createAsyncMutex();
        const scheduler = createFmpRequestScheduler({
          maxConcurrentRequests: workerCount,
          requestIntervalMs,
        });

        const worker = async () => {
          while (true) {
            if (isJobCancelled(jobId)) {
              return;
            }

            const index = nextIndex;
            nextIndex += 1;
            if (index >= tickers.length) {
              return;
            }

            const ticker = tickers[index];
            try {
              const payload = await fetchFmpFinancialSeries(ticker, {
                requestIntervalMs,
                scheduler,
              });
              await runDbWrite(async () => {
                await replaceCalendarFinancialSeriesSnapshot(payload);
              });

              syncedTickers += 1;
              annualRows += payload.annual.length;
              quarterlyRows += payload.quarterly.length;
              annualEstimateRows += payload.annual.filter((point) => point.revenueEstimate != null || point.netIncomeEstimate != null || point.epsEstimate != null).length;
              quarterlyEstimateRows += payload.quarterly.filter((point) => point.revenueEstimate != null || point.netIncomeEstimate != null || point.epsEstimate != null).length;
            } catch (error) {
              tickersFailed += 1;
              appendLog(jobId, `${ticker}: FAILED — ${error instanceof Error ? error.message : String(error)}`);
            }

            completedTickers += 1;
            if (completedTickers % 25 === 0 || completedTickers === tickers.length) {
              appendLog(jobId, `[${completedTickers}/${tickers.length}] last=${ticker} (synced=${syncedTickers}, failed=${tickersFailed})`);
            }
            updateProgress(jobId, completedTickers, tickers.length);
          }
        };

        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        if (isJobCancelled(jobId)) {
          appendLog(jobId, "Cancelled by user");
          return;
        }

        await setLastSuccess("fmp_calendar_financials", new Date().toISOString(), {
          requestedTickers: tickers.length,
          concurrency: workerCount,
          requestIntervalMs,
          syncedTickers,
          tickersFailed,
          annualRows,
          quarterlyRows,
          annualEstimateRows,
          quarterlyEstimateRows,
        });

        completeJob(jobId, {
          requestedTickers: tickers.length,
          concurrency: workerCount,
          requestIntervalMs,
          syncedTickers,
          tickersFailed,
          annualRows,
          quarterlyRows,
          annualEstimateRows,
          quarterlyEstimateRows,
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/fmp/calendar/earnings/update", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP_API_KEY not configured" });
      return;
    }

    const defaultWindow = getDefaultFmpCalendarWindow();
    const from = typeof req.body?.from === "string" && req.body.from.trim()
      ? req.body.from.trim()
      : defaultWindow.from;
    const to = typeof req.body?.to === "string" && req.body.to.trim()
      ? req.body.to.trim()
      : defaultWindow.to;

    if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
      res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      return;
    }
    if (to < from) {
      res.status(400).json({ error: "to must be greater than or equal to from" });
      return;
    }

    const concurrency = clampFmpConcurrency(Number(req.body?.concurrency));
    const requestIntervalMs = clampFmpIntervalMs(Number(req.body?.requestIntervalMs));

    const tickers = await getDefaultUniverseTickers();
    const universeMap = new Map<string, string>();
    for (const ticker of tickers) {
      const normalized = normalizeFmpSymbol(ticker);
      if (normalized) {
        universeMap.set(normalized, ticker.toUpperCase());
      }
    }
    const universeTickers = Array.from(new Set(universeMap.values()));

    const chunks = buildCalendarDateChunks(from, to, DEFAULT_FMP_CALENDAR_CHUNK_DAYS);
    const jobId = createJob(chunks.length, {
      category: "other",
      label: "FMP Earnings Calendar Update",
    });
    const workerCount = Math.max(1, Math.min(concurrency, chunks.length || 1));
    appendLog(jobId, `Starting FMP earnings calendar update for ${tickers.length} default-universe tickers`);
    appendLog(jobId, `Range=${from}~${to}, chunks=${chunks.length}, endpoint=stable/earnings-calendar`);
    appendLog(jobId, `[batch] concurrency=${workerCount}, requestIntervalMs=${requestIntervalMs}`);
    res.json({ jobId, requestedRange: { from, to } });

    void (async () => {
      try {
        let fetchedRows = 0;
        let matchedRows = 0;
        let upsertedRows = 0;
        let deletedRows = 0;
        let skippedOutsideUniverse = 0;
        let skippedInvalidDate = 0;
        let nextIndex = 0;
        let completedChunks = 0;
        const runDbWrite = createAsyncMutex();
        const scheduler = createFmpRequestScheduler({
          maxConcurrentRequests: workerCount,
          requestIntervalMs,
        });

        const worker = async () => {
          while (true) {
            if (isJobCancelled(jobId)) {
              return;
            }

            const index = nextIndex;
            nextIndex += 1;
            if (index >= chunks.length) {
              return;
            }

            const chunk = chunks[index];
            const items = await fetchFmpEarningsCalendarChunk({
              from: chunk.from,
              to: chunk.to,
              requestIntervalMs,
              scheduler,
            });
            fetchedRows += items.length;

            const chunkUpserts: Array<{
              canonicalTicker: string;
              reportDate: string;
              confirmed: boolean;
              item: Awaited<ReturnType<typeof fetchFmpEarningsCalendarChunk>>[number];
            }> = [];
            let chunkSkippedOutsideUniverse = 0;
            let chunkSkippedInvalidDate = 0;

            for (const item of items) {
              const canonicalTicker = universeMap.get(normalizeFmpSymbol(item.symbol));
              if (!canonicalTicker) {
                skippedOutsideUniverse++;
                chunkSkippedOutsideUniverse++;
                continue;
              }

              const reportDate = normalizeCalendarDateOnly(item.date);
              if (!reportDate) {
                skippedInvalidDate++;
                chunkSkippedInvalidDate++;
                continue;
              }

              const confirmed = item.epsActual != null || item.revenueActual != null;
              chunkUpserts.push({
                canonicalTicker,
                reportDate,
                confirmed,
                item,
              });
            }

            if (isJobCancelled(jobId)) {
              return;
            }

            const fromEventTime = `${chunk.from}T00:00:00.000Z`;
            const toEventTime = `${chunk.to}T23:59:59.999Z`;
            let chunkDeletedRows = 0;
            await runDbWrite(async () => {
              const db = getDb();
              await db.run("BEGIN IMMEDIATE");
              try {
                chunkDeletedRows = await deleteCalendarEventsForSourceRange({
                  type: "earnings",
                  source: "FMP",
                  fromEventTime,
                  toEventTime,
                  tickers: universeTickers,
                });

                for (const entry of chunkUpserts) {
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
                      surprise_pct: computeCalendarSurprisePct(entry.item.epsActual, entry.item.epsEstimated),
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
            });

            matchedRows += chunkUpserts.length;
            upsertedRows += chunkUpserts.length;
            deletedRows += chunkDeletedRows;

            appendLog(
              jobId,
              `[chunk ${index + 1}/${chunks.length}] ${chunk.from}~${chunk.to}: fetched=${items.length}, matched=${chunkUpserts.length}, replaced=${chunkDeletedRows}, outsideUniverse=${chunkSkippedOutsideUniverse}, invalidDate=${chunkSkippedInvalidDate}`,
            );

            completedChunks += 1;
            updateProgress(jobId, completedChunks, chunks.length);
          }
        };

        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        if (isJobCancelled(jobId)) {
          appendLog(jobId, "🛑 Cancelled by user");
          return;
        }

        await setLastSuccess("fmp_calendar_earnings", new Date().toISOString(), {
          from,
          to,
          defaultUniverseTickers: tickers.length,
          chunks: chunks.length,
          concurrency: workerCount,
          requestIntervalMs,
          fetchedRows,
          matchedRows,
          upsertedRows,
          deletedRows,
          skippedOutsideUniverse,
          skippedInvalidDate,
        });

        completeJob(jobId, {
          source: "FMP",
          type: "earnings",
          from,
          to,
          defaultUniverseTickers: tickers.length,
          chunks: chunks.length,
          concurrency: workerCount,
          requestIntervalMs,
          fetchedRows,
          matchedRows,
          upsertedRows,
          deletedRows,
          skippedOutsideUniverse,
          skippedInvalidDate,
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/fmp/calendar/ipos/update", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP_API_KEY not configured" });
      return;
    }

    const defaultWindow = getDefaultFmpCalendarWindow();
    const from = typeof req.body?.from === "string" && req.body.from.trim()
      ? req.body.from.trim()
      : defaultWindow.from;
    const to = typeof req.body?.to === "string" && req.body.to.trim()
      ? req.body.to.trim()
      : defaultWindow.to;

    if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
      res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      return;
    }
    if (to < from) {
      res.status(400).json({ error: "to must be greater than or equal to from" });
      return;
    }

    const chunks = buildCalendarDateChunks(from, to, DEFAULT_FMP_CALENDAR_CHUNK_DAYS);
    const jobTotal = chunks.length + 1;
    const jobId = createJob(jobTotal, {
      category: "other",
      label: "FMP IPO Calendar Update",
    });
    appendLog(jobId, `Starting FMP IPO calendar update for ${from}~${to}`);
    appendLog(jobId, `Range=${from}~${to}, chunks=${chunks.length}, endpoint=stable/ipos-calendar`);
    res.json({ jobId, requestedRange: { from, to } });

    void (async () => {
      try {
        let fetchedRows = 0;
        let upsertedRows = 0;
        let deletedRows = 0;
        let skippedInvalidDate = 0;
        const profileTickers = new Set<string>();

        for (let index = 0; index < chunks.length; index++) {
          if (isJobCancelled(jobId)) {
            appendLog(jobId, "Cancelled by user");
            return;
          }

          const chunk = chunks[index];
          const items = await fetchFmpIpoCalendarChunk({
            from: chunk.from,
            to: chunk.to,
            requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          });
          fetchedRows += items.length;

          const validItems: Array<Awaited<ReturnType<typeof fetchFmpIpoCalendarChunk>>[number] & { ipoDate: string; ticker: string | null }> = [];
          for (const item of items) {
            const ipoDate = normalizeCalendarDateOnly(item.date);
            if (!ipoDate) {
              skippedInvalidDate++;
              continue;
            }
            validItems.push({
              ...item,
              ipoDate,
              ticker: normalizeUpperTicker(item.symbol),
            });
            if (item.symbol) {
              profileTickers.add(item.symbol.toUpperCase());
            }
          }

          const db = getDb();
          const fromEventTime = `${chunk.from}T00:00:00.000Z`;
          const toEventTime = `${chunk.to}T23:59:59.999Z`;
          let chunkDeletedRows = 0;

          await db.run("BEGIN IMMEDIATE");
          try {
            chunkDeletedRows = await deleteCalendarEventsForSourceRange({
              type: "ipos",
              source: "FMP",
              fromEventTime,
              toEventTime,
            });

            for (const item of validItems) {
              const companyName = item.company ?? item.ticker ?? "IPO";
              await upsertCalendarEvent({
                type: "ipos",
                eventTime: `${item.ipoDate}T12:00:00.000Z`,
                ticker: item.ticker ?? undefined,
                title: `${companyName} IPO`,
                fieldsJson: {
                  ipo_date: item.ipoDate,
                  company_name: item.company,
                  exchange: item.exchange,
                  status: item.action,
                  shares: item.shares,
                  price_range: item.priceRange,
                  offer_amount: item.marketCap,
                  daa: item.daa,
                },
                source: "FMP",
                uniqueKey: buildFmpIpoUniqueKey({
                  ipoDate: item.ipoDate,
                  company: item.company,
                  exchange: item.exchange,
                  ticker: item.ticker,
                }),
              });
            }

            await db.run("COMMIT");
          } catch (error) {
            await db.run("ROLLBACK");
            throw error;
          }

          upsertedRows += validItems.length;
          deletedRows += chunkDeletedRows;

          appendLog(
            jobId,
            `[chunk ${index + 1}/${chunks.length}] ${chunk.from}~${chunk.to}: fetched=${items.length}, upserted=${validItems.length}, replaced=${chunkDeletedRows}, invalidDate=${items.length - validItems.length}`,
          );
          updateProgress(jobId, index + 1, jobTotal);
        }

        const profileSync = await syncIpoProfileMetadata({
          tickers: Array.from(profileTickers),
          jobId,
          shouldCancel: () => isJobCancelled(jobId),
        });
        if (isJobCancelled(jobId)) {
          appendLog(jobId, "Cancelled by user");
          return;
        }
        updateProgress(jobId, jobTotal, jobTotal);

        await setLastSuccess("fmp_calendar_ipos", new Date().toISOString(), {
          from,
          to,
          chunks: chunks.length,
          fetchedRows,
          upsertedRows,
          deletedRows,
          skippedInvalidDate,
          profileSync,
        });

        completeJob(jobId, {
          source: "FMP",
          type: "ipos",
          from,
          to,
          chunks: chunks.length,
          fetchedRows,
          upsertedRows,
          deletedRows,
          skippedInvalidDate,
          profileSync,
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/fmp/calendar/ipos/sec-download", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP_API_KEY not configured" });
      return;
    }

    const defaultWindow = getDefaultFmpCalendarWindow();
    const from = typeof req.body?.from === "string" && req.body.from.trim()
      ? req.body.from.trim()
      : defaultWindow.from;
    const to = typeof req.body?.to === "string" && req.body.to.trim()
      ? req.body.to.trim()
      : defaultWindow.to;

    if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
      res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      return;
    }
    if (to < from) {
      res.status(400).json({ error: "to must be greater than or equal to from" });
      return;
    }

    const rows = await listStoredIpoEventsForRange(from, to);
    const jobId = createJob(rows.length, {
      category: "other",
      label: "IPO SEC Download",
    });
    appendLog(jobId, `Starting IPO SEC download for ${rows.length} IPO rows in ${from}~${to}`);
    res.json({ jobId, requestedRange: { from, to }, rows: rows.length });

    void (async () => {
      try {
        if (rows.length === 0) {
          appendLog(jobId, "No IPO rows found in the selected range");
          completeJob(jobId, {
            from,
            to,
            rows: 0,
            enrichedRows: 0,
            skippedNoTicker: 0,
            missingDocumentRows: 0,
            descriptionRows: 0,
            ownershipRows: 0,
          });
          return;
        }

        const secLookbackFrom = shiftIsoDate(from, -365);
        const chunks = buildCalendarDateChunks(secLookbackFrom, to, DEFAULT_FMP_CALENDAR_CHUNK_DAYS);
        const disclosures: FmpIpoDisclosureItem[] = [];
        const prospectuses: FmpIpoProspectusItem[] = [];
        appendLog(jobId, `SEC metadata lookback=${secLookbackFrom}~${to}`);

        for (const chunk of chunks) {
          disclosures.push(...await fetchFmpIpoDisclosureChunk({
            from: chunk.from,
            to: chunk.to,
            requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          }));
          prospectuses.push(...await fetchFmpIpoProspectusChunk({
            from: chunk.from,
            to: chunk.to,
            requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          }));
        }

        const secUniverse = new Set(rows.map((row) => row.ticker).filter((ticker): ticker is string => Boolean(ticker)));
        const genericFilings = await fetchFmpSecFilings({
          fromDate: secLookbackFrom,
          toDate: to,
          concurrency: Math.min(5, Math.max(1, secUniverse.size)),
          maxPages: 8,
          requestIntervalMs: DEFAULT_FMP_CALENDAR_REQUEST_INTERVAL_MS,
          universeSymbols: secUniverse,
        });

        const disclosureMap = new Map<string, FmpIpoDisclosureItem[]>();
        for (const item of disclosures) {
          const symbol = normalizeUpperTicker(item.symbol);
          if (!symbol) {
            continue;
          }
          const bucket = disclosureMap.get(symbol) ?? [];
          bucket.push(item);
          disclosureMap.set(symbol, bucket);
        }

        const prospectusMap = new Map<string, FmpIpoProspectusItem[]>();
        for (const item of prospectuses) {
          const symbol = normalizeUpperTicker(item.symbol);
          if (!symbol) {
            continue;
          }
          const bucket = prospectusMap.get(symbol) ?? [];
          bucket.push(item);
          prospectusMap.set(symbol, bucket);
        }

        const genericFilingMap = new Map<string, GenericSecFiling[]>();
        for (const item of genericFilings) {
          const symbol = normalizeUpperTicker(item.symbol);
          if (!symbol) {
            continue;
          }
          const bucket = genericFilingMap.get(symbol) ?? [];
          bucket.push(item);
          genericFilingMap.set(symbol, bucket);
        }

        let enrichedRows = 0;
        let skippedNoTicker = 0;
        let missingDocumentRows = 0;
        let descriptionRows = 0;
        let ownershipRows = 0;
        let secEdgarDirectRows = 0;

        // SEC EDGAR ticker→CIK map (for direct fallback when FMP has no match)
        const tickerCikMap = await getTickerToCikMap();
        appendLog(jobId, `SEC EDGAR ticker→CIK map loaded: ${tickerCikMap.size} entries`);

        for (let index = 0; index < rows.length; index++) {
          if (isJobCancelled(jobId)) {
            appendLog(jobId, "Cancelled by user");
            return;
          }

          const row = rows[index];
          if (!row.ticker) {
            skippedNoTicker++;
            appendLog(jobId, `[${index + 1}/${rows.length}] skipped ${row.companyName ?? row.uniqueKey}: missing ticker`);
            updateProgress(jobId, index + 1, rows.length);
            continue;
          }

          const prospectus = pickBestIpoProspectus(prospectusMap.get(row.ticker) ?? [], row.ipoDate);
          const disclosure = pickBestIpoDisclosure(disclosureMap.get(row.ticker) ?? []);
          const genericFiling = pickBestGenericIpoSecFiling(genericFilingMap.get(row.ticker) ?? [], row.ipoDate);

          if (!prospectus && !disclosure && !genericFiling) {
            // SEC EDGAR direct fallback: look up CIK from ticker, then get SIC + filing URLs
            const directCik = tickerCikMap.get(row.ticker);
            if (directCik) {
              const submission = await fetchSecEdgarSubmission(directCik);
              const filingUrls = submission.filings.slice(0, 3).map((f) => f.documentUrl);
              const bestFiling = submission.filings[0] ?? null;

              const directInsights = filingUrls.length > 0
                ? await downloadIpoSecInsights(filingUrls)
                : {
                    companyDescription: null,
                    ownershipTotalPct: null,
                    ownershipMaxPct: null,
                    ownershipHolderCount: null,
                    ownershipValues: [] as number[],
                    documentUrl: null,
                    sourceNote: "sec-edgar-no-ipo-filing",
                  };

              await upsertIpoSecEnrichment({
                eventUniqueKey: row.uniqueKey,
                ticker: row.ticker,
                ipoDate: row.ipoDate,
                cik: directCik,
                formType: bestFiling?.form ?? null,
                filingDate: bestFiling?.filingDate ?? null,
                acceptedDate: null,
                documentUrl: directInsights.documentUrl ?? bestFiling?.documentUrl ?? null,
                prospectusUrl: null,
                disclosureUrl: null,
                companyDescription: directInsights.companyDescription,
                ownershipTotalPct: directInsights.ownershipTotalPct,
                ownershipMaxPct: directInsights.ownershipMaxPct,
                ownershipHolderCount: directInsights.ownershipHolderCount,
                ownershipValuesJson: directInsights.ownershipValues.length > 0 ? JSON.stringify(directInsights.ownershipValues) : null,
                rawJson: JSON.stringify({ secEdgarDirect: true, filings: submission.filings.slice(0, 5) }),
                sourceNote: directInsights.sourceNote,
                sicCode: submission.sic.sicCode,
                sicDescription: submission.sic.sicDescription,
                secIndustry: submission.sic.secIndustry,
              });

              enrichedRows++;
              secEdgarDirectRows++;
              if (directInsights.companyDescription) {
                descriptionRows++;
              }
              if (directInsights.ownershipHolderCount != null) {
                ownershipRows++;
              }

              appendLog(
                jobId,
                `[${index + 1}/${rows.length}] ${row.ticker}: [SEC-DIRECT] description=${directInsights.companyDescription ? "yes" : "no"}, ownerCount=${directInsights.ownershipHolderCount ?? 0}, sic=${submission.sic.sicCode ?? "none"}, industry=${submission.sic.secIndustry ?? "none"}, filings=${submission.filings.length}`,
              );
              updateProgress(jobId, index + 1, rows.length);
              continue;
            }

            missingDocumentRows++;
            appendLog(jobId, `[${index + 1}/${rows.length}] ${row.ticker}: no FMP match and no SEC EDGAR CIK found`);
            updateProgress(jobId, index + 1, rows.length);
            continue;
          }

          const insights = await downloadIpoSecInsights([
            prospectus?.url,
            disclosure?.url,
            genericFiling?.finalLink,
            genericFiling?.link,
          ]);
          const primaryDocument = prospectus ?? disclosure ?? genericFiling;
          const primaryFormType = prospectus?.form ?? disclosure?.form ?? genericFiling?.formType ?? '-';
          const resolvedCik = prospectus?.cik ?? disclosure?.cik ?? genericFiling?.cik ?? null;

          // Phase 2: SEC EDGAR SIC industry lookup
          const sicInfo = await fetchSecSicByCik(resolvedCik);

          await upsertIpoSecEnrichment({
            eventUniqueKey: row.uniqueKey,
            ticker: row.ticker,
            ipoDate: row.ipoDate,
            cik: resolvedCik,
            formType: prospectus?.form ?? disclosure?.form ?? genericFiling?.formType ?? null,
            filingDate: prospectus?.filingDate ?? disclosure?.filingDate ?? genericFiling?.filingDate ?? null,
            acceptedDate: prospectus?.acceptedDate ?? disclosure?.acceptedDate ?? genericFiling?.acceptedDate ?? null,
            documentUrl: insights.documentUrl ?? prospectus?.url ?? disclosure?.url ?? genericFiling?.finalLink ?? genericFiling?.link ?? null,
            prospectusUrl: prospectus?.url ?? null,
            disclosureUrl: disclosure?.url ?? null,
            companyDescription: insights.companyDescription,
            ownershipTotalPct: insights.ownershipTotalPct,
            ownershipMaxPct: insights.ownershipMaxPct,
            ownershipHolderCount: insights.ownershipHolderCount,
            ownershipValuesJson: insights.ownershipValues.length > 0 ? JSON.stringify(insights.ownershipValues) : null,
            rawJson: JSON.stringify({
              prospectus: prospectus?.raw ?? null,
              disclosure: disclosure?.raw ?? null,
              genericFiling: genericFiling ?? null,
              ownershipValues: insights.ownershipValues,
            }),
            sourceNote: insights.sourceNote,
            sicCode: sicInfo.sicCode,
            sicDescription: sicInfo.sicDescription,
            secIndustry: sicInfo.secIndustry,
          });

          enrichedRows++;
          if (insights.companyDescription) {
            descriptionRows++;
          }
          if (insights.ownershipHolderCount != null) {
            ownershipRows++;
          }

          appendLog(
            jobId,
            `[${index + 1}/${rows.length}] ${row.ticker}: description=${insights.companyDescription ? "yes" : "no"}, ownerCount=${insights.ownershipHolderCount ?? 0}, sic=${sicInfo.sicCode ?? "none"}, industry=${sicInfo.secIndustry ?? "none"}, form=${primaryFormType}`,
          );
          updateProgress(jobId, index + 1, rows.length);
        }

        await setLastSuccess("fmp_calendar_ipos_sec", new Date().toISOString(), {
          from,
          to,
          secLookbackFrom,
          rows: rows.length,
          disclosures: disclosures.length,
          prospectuses: prospectuses.length,
          genericFilings: genericFilings.length,
          enrichedRows,
          secEdgarDirectRows,
          skippedNoTicker,
          missingDocumentRows,
          descriptionRows,
          ownershipRows,
        });

        completeJob(jobId, {
          from,
          to,
          secLookbackFrom,
          rows: rows.length,
          disclosures: disclosures.length,
          prospectuses: prospectuses.length,
          genericFilings: genericFilings.length,
          enrichedRows,
          secEdgarDirectRows,
          skippedNoTicker,
          missingDocumentRows,
          descriptionRows,
          ownershipRows,
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (error) {
    next(error);
  }
});

// Step 6-4/6-5/6-6 + Step 9-1/9-2: IBKR 캘린더 업데이트 엔드포인트
app.post("/api/ibkr/calendar/update", async (req, res, next) => {
  try {
    // 9-1: mode 파라미터 읽기 (backfill | refresh, 기본 backfill)
    const rawMode = req.body?.mode;
    const mode: CalendarUpdateMode = rawMode === "refresh" ? "refresh" : "backfill";
    const dateRange = getCalendarDateRange(mode);

    // 9-2: 대상 종목 — default universe
    const tickers = await getDefaultUniverseTickers();

    // 6-3: pullIbkrCalendar는 IBKR TWS 미연결 시 에러를 던짐 (Step 6-3 구현 전)
    const result = await pullIbkrCalendar(tickers, mode);

    // 6-4: 이벤트 upsert
    let upserted = 0;
    for (const ev of result.events) {
      await upsertCalendarEvent({
        type: ev.type,
        eventTime: ev.eventTime,
        ticker: ev.ticker,
        title: ev.title,
        fieldsJson: ev.fieldsJson,
        source: "IBKR",
        uniqueKey: ev.uniqueKey
      });
      upserted++;
    }

    // 6-5: 첫 성공 후 mock_provider rows 삭제
    const deletedMockRows = await deleteMockCalendarRows();
    if (deletedMockRows > 0) {
      console.log(`[ibkr-calendar] mock_provider rows 삭제: ${deletedMockRows}건`);
    }

    // 6-6: update_status 갱신
    await setLastSuccess("ibkr_calendar", new Date().toISOString(), {
      mode,
      dateRange,
      upserted,
      deletedMockRows
    });

    res.json({ mode, dateRange, upserted, deletedMockRows, source: "IBKR" });
  } catch (error) {
    next(error);
  }
});

// Custom calendar update: user-specified date range, default universe tickers
app.post("/api/ibkr/calendar/update-custom/preflight", async (req, res, next) => {
  try {
    const from = req.body?.from;
    const to = req.body?.to;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      return;
    }
    const tickers = await getDefaultUniverseTickers();
    const summary = await getDb().get<{ existingEventsInRange: number; existingEventDays: number }>(
      `SELECT COUNT(*) AS existingEventsInRange,
              COUNT(DISTINCT substr(event_at, 1, 10)) AS existingEventDays
       FROM calendar_events
       WHERE event_at >= ?
         AND event_at <= ?`,
      [from, `${to}T23:59:59.999Z`],
    );
    res.json({
      route: "/api/ibkr/calendar/update-custom",
      requestedRange: { from, to },
      executionMode: "summary-only",
      totalTickers: tickers.length,
      existingEventsInRange: summary?.existingEventsInRange ?? 0,
      existingEventDays: summary?.existingEventDays ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/ibkr/calendar/update-custom", async (req, res, next) => {
  try {
    const from = req.body?.from;
    const to = req.body?.to;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      return;
    }
    const tickers = await getDefaultUniverseTickers();
    const summary = await getDb().get<{ existingEventsInRange: number; existingEventDays: number }>(
      `SELECT COUNT(*) AS existingEventsInRange,
              COUNT(DISTINCT substr(event_at, 1, 10)) AS existingEventDays
       FROM calendar_events
       WHERE event_at >= ?
         AND event_at <= ?`,
      [from, `${to}T23:59:59.999Z`],
    );
    const preflightSummary = {
      route: "/api/ibkr/calendar/update-custom",
      requestedRange: { from, to },
      executionMode: "summary-only",
      totalTickers: tickers.length,
      existingEventsInRange: summary?.existingEventsInRange ?? 0,
      existingEventDays: summary?.existingEventDays ?? 0,
    };

    const jobId = createJob(0, {
      category: "news-update",
      label: "Calendar Update (Custom)",
    });

    res.json({ jobId });

    (async () => {
      try {
        const result = await pullIbkrCalendarCustom(tickers, from, to);

        let upserted = 0;
        for (const ev of result.events) {
          await upsertCalendarEvent({
            type: ev.type,
            eventTime: ev.eventTime,
            ticker: ev.ticker,
            title: ev.title,
            fieldsJson: ev.fieldsJson,
            source: "IBKR",
            uniqueKey: ev.uniqueKey,
          });
          upserted++;
        }

        const deletedMockRows = await deleteMockCalendarRows();
        if (deletedMockRows > 0) {
          console.log(`[ibkr-calendar-custom] mock_provider rows 삭제: ${deletedMockRows}건`);
        }

        await setLastSuccess("ibkr_calendar", new Date().toISOString(), {
          mode: "custom",
          dateRange: { from, to },
          upserted,
          deletedMockRows,
        });

        completeJob(jobId, {
          ...preflightSummary,
          source: "IBKR",
          fetchedEvents: result.events.length,
          upserted,
          deletedMockRows,
        });
      } catch (err: any) {
        failJob(jobId, err?.message ?? String(err));
      }
    })();
  } catch (error) {
    next(error);
  }
});

// Step 7-5: GET /api/ibkr/ohlc1d/status
app.get("/api/ibkr/ohlc1d/status", async (_req, res, next) => {
  try {
    const overallMaxDate = await getOverallMaxDate();
    const statuses = await listUpdateStatuses();
    const ibkrOhlcStatus = statuses["ibkr_ohlc_1d"];
    res.json({
      dbPath: "OHLC_data/ohlc_1d_watchlist.sqlite",
      overallMaxDate,
      lastSuccessAt: ibkrOhlcStatus?.lastSuccessAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

// Step 7-6: POST /api/ibkr/ohlc1d/update
app.post("/api/ibkr/ohlc1d/update", async (req, res, next) => {
  try {
    const jobId = createJob(0);
    res.json({ jobId });

    // Run in background
    (async () => {
      try {
        // 1. Read tickers from CSV
        const csvPath = req.body?.csvPath ?? "tradigview_screener/original_data/watch lists2_2026-02-22.csv";
        const csvResult = readTickersFromCsv(csvPath);
        const tickers = [...new Set(csvResult.tickers)];
        appendLog(jobId, `Loaded ${tickers.length} tickers from CSV`);
        updateProgress(jobId, 0, tickers.length);

        // 2. Get current max date
        const overallMaxDateBefore = await getOverallMaxDate();
        const today = new Date().toISOString().slice(0, 10);

        let totalRowsUpserted = 0;
        let tickersUpdated = 0;
        let tickersFailed = 0;
        const affectedSymbols = new Map<string, { minDate: string; maxDate: string }>();

        // 3. Fetch + upsert per symbol
        for (let i = 0; i < tickers.length; i++) {
          if (isJobCancelled(jobId)) { appendLog(jobId, '🛑 Cancelled by user'); break; }
          const symbol = tickers[i];
          try {
            const symbolMaxDate = await getSymbolMaxDate(symbol);
            const startDate = symbolMaxDate
              ? nextDay(symbolMaxDate)
              : "2020-01-01";

            if (startDate > today) {
              appendLog(jobId, `${symbol}: already up to date (max=${symbolMaxDate})`);
              updateProgress(jobId, i + 1, tickers.length);
              continue;
            }

            const result = await fetchOhlcBars(symbol, startDate, today);
            if (result.bars.length === 0) {
              appendLog(jobId, `${symbol}: no new bars`);
              updateProgress(jobId, i + 1, tickers.length);
              continue;
            }

            const upserted = await upsertBars(symbol, result.bars);
            totalRowsUpserted += upserted;
            tickersUpdated++;

            const dates = result.bars.map((b) => b.Datetime).sort();
            affectedSymbols.set(symbol, {
              minDate: dates[0],
              maxDate: dates[dates.length - 1],
            });

            appendLog(jobId, `${symbol}: ${upserted} bars upserted (${dates[0]}~${dates[dates.length - 1]})`);
          } catch (err) {
            tickersFailed++;
            appendLog(jobId, `${symbol}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
          }
          updateProgress(jobId, i + 1, tickers.length);

          // IBKR pacing: small delay between symbols
          if (i < tickers.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        // 4. Compute derived metrics
        if (affectedSymbols.size > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Computing derived metrics for ${affectedSymbols.size} symbols...`);
          const derived = await computeDerivedForAffectedSymbols(affectedSymbols);
          appendLog(jobId, `Derived metrics: ${derived.totalUpdated} rows updated`);
        }

        // 5. Standard change metric backfill (Step 7-8)
        if (affectedSymbols.size > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Backfilling news change metrics...`);
          const newsRows = await (await import("./db.js")).getDb().all<
            { id: string; tickers_csv: string; published_at: string }[]
          >(
            `SELECT id, tickers_csv, published_at FROM news_items
             WHERE tickers_csv != '' ORDER BY published_at DESC`,
          );
          const affectedTickers = new Set(affectedSymbols.keys());
          const toMerge = newsRows
            .filter((r) => {
              const t = r.tickers_csv.split(",").map((s) => s.trim()).filter(Boolean);
              return t.some((tk) => affectedTickers.has(tk));
            })
            .map((r) => ({
              id: r.id,
              tickers: r.tickers_csv.split(",").map((s) => s.trim()).filter(Boolean),
              publishedAt: r.published_at,
            }));
          if (toMerge.length > 0) {
            const cm = await mergeChangeForNewItems(toMerge);
            appendLog(jobId, `News change backfill: merged=${cm.merged} skipped=${cm.skipped}`);
          }
        }

        const overallMaxDateAfter = await getOverallMaxDate();

        if (isJobCancelled(jobId)) return;

        // 6. Update status
        await setLastSuccess("ibkr_ohlc_1d", new Date().toISOString(), {
          tickersRequested: tickers.length,
          tickersUpdated,
          tickersFailed,
          totalRowsUpserted,
          overallMaxDateBefore,
          overallMaxDateAfter,
        });

        completeJob(jobId, {
          tickersRequested: tickers.length,
          tickersUpdated,
          tickersFailed,
          totalRowsUpserted,
          overallMaxDateBefore,
          overallMaxDateAfter,
        });
      } catch (err) {
        failJob(jobId, err instanceof Error ? err.message : String(err));
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/fmp/ohlc1d/update-recent-missing", async (req, res, next) => {
  try {
    if (!config.fmpApiKey) {
      res.status(400).json({ error: "FMP API key is not configured" });
      return;
    }

    const jobKey = "fmp_ohlc_recent_missing";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An FMP recent missing OHLC update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const concurrency = clampFmpOhlcConcurrency(Number(req.body?.concurrency));
    const requestIntervalMs = clampFmpOhlcIntervalMs(Number(req.body?.requestIntervalMs));
    const tickers = await getDefaultUniverseTickers();
    const window = getRecentEligibleFmpOhlcWindow(7);
    const jobId = createJob(tickers.length, {
      category: "other",
      label: "FMP Recent OHLC Fill",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting FMP recent OHLC fill for ${tickers.length} default-universe tickers`);
    appendLog(jobId, `Window=${window.from}~${window.to}, concurrency=${concurrency}, interval=${requestIntervalMs}ms`);
    if (window.excludedToday) {
      appendLog(jobId, `ET current day is excluded before market close; latest allowed date is ${window.to}`);
    }
    res.json({ jobId });

    (async () => {
      try {
        const groupMap = new Map<string, string[]>();
        for (const ticker of tickers) {
          const symbolMaxDate = await getSymbolMaxDate(ticker);
          const startDate = symbolMaxDate ? nextDay(symbolMaxDate) : window.from;
          const effectiveStart = startDate > window.from ? startDate : window.from;
          if (effectiveStart > window.to) {
            continue;
          }
          const existing = groupMap.get(effectiveStart);
          if (existing) {
            existing.push(ticker);
          } else {
            groupMap.set(effectiveStart, [ticker]);
          }
        }

        const groups = [...groupMap.entries()].sort((left, right) => left[0].localeCompare(right[0]));
        const targetCount = groups.reduce((sum, [, symbols]) => sum + symbols.length, 0);
        updateProgress(jobId, 0, targetCount);

        let completedTickers = 0;
        let tickersFetched = 0;
        let tickersFailed = 0;
        let totalRowsUpserted = 0;
        const affectedSymbols = new Map<string, { minDate: string; maxDate: string }>();

        for (const [startDate, symbols] of groups) {
          if (isJobCancelled(jobId)) {
            appendLog(jobId, "🛑 Cancelled by user");
            break;
          }

          appendLog(jobId, `Fetching FMP OHLC batch start=${startDate}, end=${window.to}, tickers=${symbols.length}`);
          const batch = await fetchFmpOhlcBatch(symbols, startDate, window.to, {
            concurrency,
            requestIntervalMs,
            shouldCancel: () => isJobCancelled(jobId),
          });

          for (const symbol of symbols) {
            if (isJobCancelled(jobId)) {
              appendLog(jobId, "🛑 Cancelled by user");
              break;
            }

            const bars = batch.results.get(symbol) ?? [];
            if (bars.length > 0) {
              const upserted = await upsertBars(symbol, bars);
              totalRowsUpserted += upserted;
              tickersFetched += 1;
              const dates = bars.map((bar) => bar.Datetime).sort();
              affectedSymbols.set(symbol, {
                minDate: dates[0],
                maxDate: dates[dates.length - 1],
              });
              appendLog(jobId, `${symbol}: ${upserted} bars upserted (${dates[0]}~${dates[dates.length - 1]})`);
            } else {
              const message = batch.errors.get(symbol);
              if (message) {
                tickersFailed += 1;
                appendLog(jobId, `${symbol}: FAILED — ${message}`);
              } else {
                appendLog(jobId, `${symbol}: no missing recent bars`);
              }
            }

            completedTickers += 1;
            updateProgress(jobId, completedTickers, targetCount);
          }
        }

        if (affectedSymbols.size > 0 && !isJobCancelled(jobId)) {
          appendLog(jobId, `Computing derived metrics for ${affectedSymbols.size} symbols...`);
          const derived = await computeDerivedForAffectedSymbols(affectedSymbols);
          appendLog(jobId, `Derived metrics: ${derived.totalUpdated} rows updated`);
        }

        if (isJobCancelled(jobId)) {
          activePullJobs.delete(jobKey);
          return;
        }

        await setLastSuccess(jobKey, new Date().toISOString(), {
          tickersRequested: tickers.length,
          tickersFetched,
          tickersFailed,
          totalRowsUpserted,
          rangeFrom: window.from,
          rangeTo: window.to,
          excludedToday: window.excludedToday,
          concurrency,
          requestIntervalMs,
        });
        completeJob(jobId, {
          tickersRequested: tickers.length,
          tickersFetched,
          tickersFailed,
          totalRowsUpserted,
          rangeFrom: window.from,
          rangeTo: window.to,
          excludedToday: window.excludedToday,
          concurrency,
          requestIntervalMs,
        });
        activePullJobs.delete(jobKey);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

app.post("/api/ibkr/ohlc1d/turnover/update", async (_req, res, next) => {
  try {
    const jobKey = "ibkr_ohlc_turnover";
    const existingJobId = activePullJobs.get(jobKey);
    if (existingJobId) {
      const existingJob = getJob(existingJobId);
      if (existingJob && existingJob.status === "running") {
        res.status(409).json({
          error: `An OHLC turnover update job is already running (jobId=${existingJobId}). Wait for it to finish or cancel it first.`,
          existingJobId,
        });
        return;
      }
      activePullJobs.delete(jobKey);
    }

    const tickers = await getDefaultUniverseTickers();
    const jobId = createJob(tickers.length, {
      category: "other",
      label: "OHLC Turnover Update",
    });
    activePullJobs.set(jobKey, jobId);
    appendLog(jobId, `Starting OHLC turnover update for ${tickers.length} default-universe tickers`);
    appendLog(jobId, "Rule: only NULL Turnover rows with non-null Open/Close/Volume are updated");
    res.json({ jobId });

    (async () => {
      let tickersUpdated = 0;
      let totalRowsUpdated = 0;
      let totalExistingRows = 0;
      let totalUncomputableRows = 0;

      try {
        for (let index = 0; index < tickers.length; index++) {
          if (isJobCancelled(jobId)) {
            appendLog(jobId, "🛑 Cancelled by user");
            break;
          }

          const symbol = tickers[index];
          try {
            const summary = await computeMissingTurnoverForSymbol(symbol);
            totalRowsUpdated += summary.updated;
            totalExistingRows += summary.existing;
            totalUncomputableRows += summary.uncomputable;
            if (summary.updated > 0) {
              tickersUpdated += 1;
            }
            appendLog(jobId, `${symbol}: updated=${summary.updated}, existing=${summary.existing}, uncomputable=${summary.uncomputable}`);
          } catch (error) {
            appendLog(jobId, `${symbol}: FAILED — ${error instanceof Error ? error.message : String(error)}`);
          }
          updateProgress(jobId, index + 1, tickers.length);
        }

        if (isJobCancelled(jobId)) {
          activePullJobs.delete(jobKey);
          return;
        }

        await setLastSuccess("ibkr_ohlc_turnover", new Date().toISOString(), {
          tickersRequested: tickers.length,
          tickersUpdated,
          totalRowsUpdated,
          totalExistingRows,
          totalUncomputableRows,
        });

        completeJob(jobId, {
          tickersRequested: tickers.length,
          tickersUpdated,
          totalRowsUpdated,
          totalExistingRows,
          totalUncomputableRows,
        });
        activePullJobs.delete(jobKey);
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
        activePullJobs.delete(jobKey);
      }
    })();
  } catch (error) {
    next(error);
  }
});

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getRecentEligibleFmpOhlcWindow(days = 7): { from: string; to: string; excludedToday: boolean } {
  const todayEt = getEtDateString(new Date());
  const excludedToday = shouldExcludeCurrentEtDailyBar(todayEt);
  const to = excludedToday ? prevDay(todayEt) : todayEt;
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(1, days));
  return {
    from: fromDate.toISOString().slice(0, 10),
    to,
    excludedToday,
  };
}

const alertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  tool: z.enum(["news", "watchlists", "calendar"]),
  name: z.string().min(1),
  enabled: z.boolean(),
  methods: z.array(z.enum(["browser", "sound", "email"])),
  ruleJson: z.record(z.any())
});

app.get("/api/settings/alerts", async (_req, res, next) => {
  try {
    const rows = await listAlertRules(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/alerts", async (req, res, next) => {
  try {
    const input = alertRuleSchema.parse(req.body);
    const row = await upsertAlertRule({
      id: input.id,
      userId: DEMO_USER_ID,
      tool: input.tool,
      name: input.name,
      enabled: input.enabled,
      methods: input.methods,
      ruleJson: input.ruleJson
    });
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

// ── ver3: Bookmark folder CRUD ──

const bookmarkFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

app.get("/api/bookmarks/folders", async (_req, res, next) => {
  try {
    const rows = await getDb().all(
      `SELECT id, user_id, name, parent_id, sort_order, created_at
       FROM bookmark_folders WHERE user_id = ? ORDER BY sort_order, name`,
      [DEMO_USER_ID],
    );
    res.json(rows);
  } catch (error) { next(error); }
});

app.post("/api/bookmarks/folders", async (req, res, next) => {
  try {
    const input = bookmarkFolderSchema.parse(req.body);
    const id = randomUUID();
    await getDb().run(
      `INSERT INTO bookmark_folders (id, user_id, name, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [id, DEMO_USER_ID, input.name, input.parentId, input.sortOrder],
    );
    res.status(201).json({ id, name: input.name, parent_id: input.parentId, sort_order: input.sortOrder });
  } catch (error) { next(error); }
});

app.put("/api/bookmarks/folders/:id", async (req, res, next) => {
  try {
    const input = bookmarkFolderSchema.parse(req.body);
    const result = await getDb().run(
      `UPDATE bookmark_folders SET name = ?, parent_id = ?, sort_order = ? WHERE id = ? AND user_id = ?`,
      [input.name, input.parentId, input.sortOrder, req.params.id, DEMO_USER_ID],
    );
    if (!result.changes) { res.status(404).json({ error: "Folder not found" }); return; }
    res.json({ id: req.params.id, name: input.name, parent_id: input.parentId, sort_order: input.sortOrder });
  } catch (error) { next(error); }
});

app.delete("/api/bookmarks/folders/:id", async (req, res, next) => {
  try {
    const result = await getDb().run(
      `DELETE FROM bookmark_folders WHERE id = ? AND user_id = ?`,
      [req.params.id, DEMO_USER_ID],
    );
    if (!result.changes) { res.status(404).json({ error: "Folder not found" }); return; }
    res.status(204).send();
  } catch (error) { next(error); }
});

// ── ver3: Bookmark items ──

app.post("/api/bookmarks/items", async (req, res, next) => {
  try {
    const { folderId, newsId } = z.object({
      folderId: z.string().min(1),
      newsId: z.string().min(1),
    }).parse(req.body);
    await getDb().run(
      `INSERT OR IGNORE INTO bookmark_items (folder_id, news_id) VALUES (?, ?)`,
      [folderId, newsId],
    );
    res.status(201).json({ folderId, newsId });
  } catch (error) { next(error); }
});

app.delete("/api/bookmarks/items", async (req, res, next) => {
  try {
    const { folderId, newsId } = z.object({
      folderId: z.string().min(1),
      newsId: z.string().min(1),
    }).parse(req.body);
    await getDb().run(
      `DELETE FROM bookmark_items WHERE folder_id = ? AND news_id = ?`,
      [folderId, newsId],
    );
    res.status(204).send();
  } catch (error) { next(error); }
});

app.get("/api/bookmarks/folders/:folderId/items", async (req, res, next) => {
  try {
    const rows = await getDb().all(
      `SELECT bi.news_id, bi.created_at AS bookmarked_at,
              ni.title, ni.tickers_csv
       FROM bookmark_items bi
       LEFT JOIN news_items ni ON ni.id = bi.news_id
       WHERE bi.folder_id = ?
       ORDER BY bi.created_at DESC`,
      [req.params.folderId],
    );
    res.json(rows.map((r: any) => ({
      news_id: r.news_id,
      bookmarked_at: r.bookmarked_at,
      title: r.title ?? null,
      ticker: r.tickers_csv ? r.tickers_csv.split(',')[0]?.trim() || null : null,
    })));
  } catch (error) { next(error); }
});

app.patch("/api/bookmarks/items/move", async (req, res, next) => {
  try {
    const { newsId, fromFolderId, toFolderId } = z.object({
      newsId: z.string().min(1),
      fromFolderId: z.string().min(1),
      toFolderId: z.string().min(1),
    }).parse(req.body);
    await getDb().run(`DELETE FROM bookmark_items WHERE folder_id = ? AND news_id = ?`, [fromFolderId, newsId]);
    await getDb().run(`INSERT OR IGNORE INTO bookmark_items (folder_id, news_id) VALUES (?, ?)`, [toFolderId, newsId]);
    res.json({ newsId, fromFolderId, toFolderId });
  } catch (error) { next(error); }
});

// ── ver3: Sentiment snapshot trigger ──

app.post("/api/news/sentiment/update", async (req, res, next) => {
  try {
    const { tickers } = z.object({
      tickers: z.array(z.string().min(1)).min(1),
    }).parse(req.body);

    const jobId = createJob(tickers.length);
    res.json({ jobId });

    (async () => {
      let updated = 0;
      try {
        for (let i = 0; i < tickers.length; i++) {
          if (isJobCancelled(jobId)) { appendLog(jobId, '🛑 Cancelled by user'); break; }
          try {
            const wrote = await upsertSentimentSnapshot(tickers[i]);
            if (wrote) updated++;
            appendLog(jobId, `${tickers[i]}: ${wrote ? "updated" : "no data"}`);
          } catch (err: any) {
            appendLog(jobId, `${tickers[i]}: error — ${err.message}`);
          }
          updateProgress(jobId, i + 1);
          await new Promise((r) => setTimeout(r, 300));
        }
        if (isJobCancelled(jobId)) return;
        completeJob(jobId, { updated, total: tickers.length });
      } catch (err: any) {
        failJob(jobId, err.message);
      }
    })();
  } catch (error) { next(error); }
});

// ── ver3: AI analysis validation ──

app.get("/api/news/ai-analysis/validate", async (_req, res, next) => {
  try {
    const result = await validateAnalysisCompleteness();
    res.json(result);
  } catch (error) { next(error); }
});

// ── SSE news stream ──
app.get("/api/news/stream", (req, res) => {
  const filters = parseNewsQuery(req.query as Record<string, unknown>);
  const clientId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  streamHub.addClient({
    id: clientId,
    response: res,
    filters
  });

  req.on("close", () => {
    streamHub.removeClient(clientId);
  });
});

setInterval(() => {
  streamHub.heartbeat();
}, 20000);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(400).json({ error: message });
});

// ── Step 5-2: default ticker universe import ──

async function importDefaultTickerUniverse(): Promise<void> {
  const csvPath = DEFAULT_TICKERS_CSV;
  try {
    const { rows, resolvedPath } = readTickerRowsFromCsv(csvPath);
    if (rows.length === 0) {
      console.log("[startup] default ticker CSV is empty, skipping universe import");
      return;
    }

    const universeId = await upsertUniverse("default", "TradingView screener default watchlist", resolvedPath);

    let upserted = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const secId = await upsertSecurity(row.ticker, null, row.name, row.sector, row.industry);
      await addUniverseItem(universeId, secId, i);
      upserted++;
    }
    console.log(`[startup] upserted ${upserted} tickers into default universe (securities total: ${await countSecurities()})`);
  } catch (err) {
    console.warn(`[startup] failed to import default ticker universe: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Step 5-2: securities / universe API ──

app.get("/api/securities", async (_req, res) => {
  try {
    const rows = await getDb().all(
      "SELECT id, ticker, exchange, name, sector, industry FROM securities ORDER BY ticker LIMIT 2000"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/api/securities/search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").toUpperCase().trim();
    if (!q) { res.json([]); return; }
    const rows = await getDb().all(
      "SELECT id, ticker, exchange, name, sector, industry FROM securities WHERE ticker LIKE ? OR name LIKE ? ORDER BY ticker LIMIT 50",
      [`${q}%`, `%${q}%`],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/api/universes", async (_req, res) => {
  try {
    const universes = await listUniverses();
    res.json(universes);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/api/universes/:id/items", async (req, res) => {
  try {
    const universeId = parseInt(req.params.id, 10);
    if (isNaN(universeId)) { res.status(400).json({ error: "Invalid universe id" }); return; }
    const items = await listUniverseItems(universeId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Step 5-3: company profile API ──

import { fetchFmpProfile, fetchFmpProfilesBatch, clampFmpConcurrency, clampFmpIntervalMs, getFmpDefaults } from "./services/fmpCompanyProfileProvider.js";
import { fetchFinnhubProfilesBatch } from "./services/finnhubProfile2Provider.js";
import { fetchYahooProfilesBatch, clampYahooConcurrency, clampYahooIntervalMs, getYahooDefaults } from "./services/yahooCompanyProfileProvider.js";
import { upsertCompanyProfile, getCompanyProfileByTicker, countCompanyProfiles, upsertPeers, getPeersByTicker, getTickersWithFmpProfile, getTickersWithYahooProfile, getTickersWithExistingPeers, getTickersWithExistingIpoDate } from "./services/companyProfileRepository.js";
import { fetchFinnhubPeersBatch } from "./services/finnhubPeersProvider.js";

app.get("/api/company-profiles/:ticker", async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const profile = await getCompanyProfileByTicker(ticker);
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.post("/api/company-profiles/pull-fmp", async (req, res) => {
  try {
    const body = req.body as {
      tickers?: string[];
      maxTickers?: number;
      concurrency?: number;
      requestIntervalMs?: number;
      skipExisting?: boolean;
    };
    let tickers = body.tickers;

    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    let target = tickers.slice(0, max);

    const concurrency = clampFmpConcurrency(body.concurrency);
    const requestIntervalMs = clampFmpIntervalMs(body.requestIntervalMs);
    const skipExisting = body.skipExisting !== false; // default: true (skip)

    let skippedCount = 0;
    if (skipExisting) {
      const existingSet = await getTickersWithFmpProfile();
      const before = target.length;
      target = target.filter((t) => !existingSet.has(t.toUpperCase()));
      skippedCount = before - target.length;
    }

    const jobId = createJob(target.length);
    appendLog(jobId, `Starting FMP company description update for ${target.length} tickers (concurrency=${concurrency}, interval=${requestIntervalMs}ms, skipExisting=${skipExisting}, skipped=${skippedCount})`);
    res.json({ jobId });

    void (async () => {
      try {
        if (target.length === 0) {
          appendLog(jobId, "No tickers requested — nothing to do");
          await setLastSuccess("company_profiles", new Date().toISOString(), {
            source: "fmp",
            requested: 0,
            fetched: 0,
            updated: 0,
            errors: 0,
          });
          completeJob(jobId, { requested: 0, tickersUpdated: 0, tickersFailed: 0, totalRowsUpserted: 0 });
          return;
        }

        const { results, errors, cancelled } = await fetchFmpProfilesBatch(
          target,
          {
            concurrency,
            requestIntervalMs,
            onProgress: (done, total) => { updateProgress(jobId, done, total); },
            shouldCancel: () => isJobCancelled(jobId),
          },
        );

        if (cancelled || isJobCancelled(jobId)) {
          appendLog(jobId, `🛑 Cancelled — processed ${results.size + errors.size}/${target.length} tickers`);
          return;
        }

        let updated = 0;
        for (const [ticker, fmp] of results) {
          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [ticker.toUpperCase()],
          );
          let secId: number;
          if (existingSec) {
            secId = existingSec.id;
            const sets: string[] = [];
            const params: unknown[] = [];
            if (fmp.exchangeShortName) { sets.push("exchange = ?"); params.push(fmp.exchangeShortName); }
            if (fmp.companyName) { sets.push("name = ?"); params.push(fmp.companyName); }
            if (fmp.sector) { sets.push("sector = ?"); params.push(fmp.sector); }
            if (fmp.industry) { sets.push("industry = ?"); params.push(fmp.industry); }
            if (sets.length > 0) {
              params.push(secId);
              await getDb().run(`UPDATE securities SET ${sets.join(", ")} WHERE id = ?`, params);
            }
          } else {
            secId = await upsertSecurity(
              ticker,
              fmp.exchangeShortName || null,
              fmp.companyName || null,
              fmp.sector || null,
              fmp.industry || null,
            );
          }
          await upsertCompanyProfile(
            secId,
            "fmp",
            fmp.description || null,
            fmp.ceo || null,
            fmp.fullTimeEmployees ? parseInt(fmp.fullTimeEmployees, 10) || null : null,
            fmp.website || null,
            fmp.ipoDate || null,
            fmp.mktCap || null,
            JSON.stringify(fmp.raw),
          );
          updated++;
          appendLog(jobId, `${ticker}: description ${fmp.description ? `updated (${fmp.description.length} chars)` : "missing"}`);
        }

        for (const [ticker, message] of errors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        const totalProfiles = await countCompanyProfiles();
        await setLastSuccess("company_profiles", new Date().toISOString(), {
          source: "fmp",
          requested: target.length,
          fetched: results.size,
          updated,
          errors: errors.size,
          skippedExisting: skippedCount,
          totalProfiles,
        });

        completeJob(jobId, {
          requested: target.length,
          fetched: results.size,
          tickersUpdated: updated,
          tickersFailed: errors.size,
          totalRowsUpserted: updated,
          skippedExisting: skippedCount,
          totalProfiles,
          source: "fmp",
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull Yahoo Holders (institutional + insider) ───────────────────────────
app.post("/api/company-profiles/pull-holders-yahoo", async (req, res) => {
  try {
    const body = req.body as { tickers?: string[]; maxTickers?: number; tickerConcurrency?: number; skipExisting?: boolean };
    let tickers = body.tickers;
    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    let target = tickers.slice(0, max);
    // Use Yahoo-specific concurrency (default to 50 as requested)
    const tickerConcurrency = clampYahooConcurrency(body.tickerConcurrency ?? 50);
    const skipExisting = body.skipExisting !== false; // default: true

    let skippedCount = 0;
    if (skipExisting) {
      const { getTickersWithRecentInstitutional } = await import("./services/companyProfileRepository.js");
      const recentSet = await getTickersWithRecentInstitutional(24, "yahoo");
      const before = target.length;
      target = target.filter((t) => !recentSet.has(t.toUpperCase()));
      skippedCount = before - target.length;
    }

    const jobId = createJob(target.length);
    appendLog(jobId, `Starting Yahoo holders update: ${target.length} tickers (concurrency=${tickerConcurrency}, skipExisting=${skipExisting}, skipped=${skippedCount})`);
    res.json({ jobId });

    void (async () => {
      try {
        if (target.length === 0) {
          appendLog(jobId, "No tickers requested — nothing to do");
          await setLastSuccess("company_profiles_holders_yahoo", new Date().toISOString(), {
            source: "yahoo-holders",
            requested: 0,
            fetched: 0,
            updated: 0,
            errors: 0,
          });
          completeJob(jobId, { requested: 0, tickersUpdated: 0, tickersFailed: 0, totalRowsUpserted: 0 });
          return;
        }

        // Build outstanding shares map from existing DB data (FMP float rows)
        const outstandingMap = new Map<string, number>();
        for (const ticker of target) {
          const row = await getDb().get<{ outstanding_shares: number | null }>(
            `SELECT cp.outstanding_shares FROM company_profiles cp
             JOIN securities s ON s.id = cp.security_id
             WHERE s.ticker = ? AND cp.outstanding_shares IS NOT NULL
             ORDER BY cp.fetched_at DESC LIMIT 1`,
            [ticker.toUpperCase()],
          );
          if (row?.outstanding_shares) outstandingMap.set(ticker.toUpperCase(), row.outstanding_shares);
        }

        const missingOutstanding = target.filter((ticker) => !outstandingMap.has(ticker.toUpperCase()));
        if (missingOutstanding.length > 0) {
          appendLog(jobId, `Bootstrapping outstanding shares from FMP for ${missingOutstanding.length} tickers before Yahoo holders calc`);
          const { fetchFmpSharesFloatBatch } = await import("./services/fmpSharesFloatProvider.js");
          const { upsertFloat } = await import("./services/companyProfileRepository.js");
          const floatBootstrap = await fetchFmpSharesFloatBatch(missingOutstanding, {
            shouldCancel: () => isJobCancelled(jobId),
          });

          for (const [ticker, data] of floatBootstrap.results) {
            if (data.outstandingShares != null && data.outstandingShares > 0) {
              outstandingMap.set(ticker.toUpperCase(), data.outstandingShares);
            }
            const existingSec = await getDb().get<{ id: number }>(
              "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
              [ticker.toUpperCase()],
            );
            if (existingSec) {
              await upsertFloat(existingSec.id, "fmp", data.floatShares, data.freeFloat, data.outstandingShares, "fmp");
            }
          }

          for (const [ticker, message] of floatBootstrap.errors) {
            appendLog(jobId, `${ticker}: outstanding bootstrap error - ${message}`);
          }
        }

        const { fetchYahooOwnershipBatch } = await import("./services/yahooOwnershipProvider.js");
        const { upsertInstitutional, upsertInsider, upsertCompanyProfile } = await import("./services/companyProfileRepository.js");

        // Adaptive retry strategy:
        // - Start with `tickerConcurrency` (default 50)
        // - If some tickers fail, retry only failed tickers with half the concurrency
        // - Repeat up to 10 attempts, never reducing below 5
        const maxAttempts = 10;
        const minConcurrency = 5;
        let currentConcurrency = tickerConcurrency;
        let remaining = target.slice();
        const totalRequested = target.length;
        let overallFetched = 0;
        let updated = 0;
        let finalErrors = new Map<string, string>();
        const persistedTickers = new Set<string>();

        const persistYahooOwnershipResult = async (ticker: string, data: {
          holderCount: number;
          institutionalPct: number | null;
          insiderPct: number | null;
          raw: unknown;
        }) => {
          const tickerKey = ticker.toUpperCase();
          if (persistedTickers.has(tickerKey)) return;

          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [tickerKey],
          );
          if (!existingSec) return;

          try {
            await upsertCompanyProfile(existingSec.id, "yahoo", null, null, null, null, null, null, JSON.stringify(data.raw ?? {}));
          } catch {
            // raw payload persistence is best-effort only
          }

          if (data.institutionalPct == null) {
            appendLog(jobId, `${tickerKey}: institutional N/A (missing)`);
          } else {
            await upsertInstitutional(existingSec.id, "yahoo", data.institutionalPct, "yahoo");
            updated++;
            appendLog(jobId, `${tickerKey}: institutional ${data.institutionalPct.toFixed(2)}% (${data.holderCount} holders)`);
          }

          if (data.insiderPct != null) {
            try {
              await upsertInsider(existingSec.id, "yahoo", data.insiderPct, "yahoo");
              appendLog(jobId, `${tickerKey}: insider ${data.insiderPct.toFixed(2)}%`);
            } catch {
              // ignore insider-only persistence failures and continue
            }
          }

          persistedTickers.add(tickerKey);
          overallFetched++;
        };

        for (let attempt = 1; attempt <= maxAttempts && remaining.length > 0; attempt++) {
          appendLog(jobId, `Attempt ${attempt}/${maxAttempts}: fetching ${remaining.length} tickers (concurrency=${currentConcurrency})`);
          const attemptFetchedBase = overallFetched;

          const { results, errors, cancelled } = await fetchYahooOwnershipBatch(remaining, outstandingMap, {
            concurrency: currentConcurrency,
            onProgress: (done, total) => { updateProgress(jobId, attemptFetchedBase + done, totalRequested); },
            onTickerLog: (msg: string) => { appendLog(jobId, msg); },
            onResult: persistYahooOwnershipResult,
            shouldCancel: () => isJobCancelled(jobId),
          });

          if (cancelled) {
            appendLog(jobId, `Job cancelled after persisting ${overallFetched} tickers`);
            return;
          }

          if (errors.size === 0) {
            finalErrors = new Map();
            break;
          }

          // If not last attempt, retry failed tickers with lower concurrency
          if (attempt < maxAttempts) {
            const failedTickers = Array.from(errors.keys());
            const nextConcurrency = Math.max(minConcurrency, Math.floor(currentConcurrency / 2));
            if (nextConcurrency < currentConcurrency) {
              appendLog(jobId, `Retrying ${failedTickers.length} failed tickers with concurrency=${nextConcurrency}`);
              remaining = failedTickers;
              currentConcurrency = nextConcurrency;
              // loop continues
              continue;
            }
          }

          // No more retries — record final errors
          finalErrors = errors;
          for (const [ticker, message] of errors) {
            appendLog(jobId, `${ticker}: error - ${message}`);
          }
          break;
        }

        await setLastSuccess("company_profiles_holders_yahoo", new Date().toISOString(), {
          source: "yahoo-holders",
          requested: totalRequested,
          fetched: overallFetched,
          updated,
          errors: finalErrors.size,
          skippedExisting: skippedCount,
        });

        completeJob(jobId, { requested: totalRequested, fetched: overallFetched, tickersUpdated: updated, tickersFailed: finalErrors.size, totalRowsUpserted: updated, skippedExisting: skippedCount, source: "yahoo-holders" });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull Yahoo Company Description ─────────────────────────────────────────
app.post("/api/company-profiles/pull-yahoo", async (req, res) => {
  try {
    const body = req.body as {
      tickers?: string[];
      maxTickers?: number;
      concurrency?: number;
      requestIntervalMs?: number;
      skipExisting?: boolean;
    };
    let tickers = body.tickers;

    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    let target = tickers.slice(0, max);

    const concurrency = clampYahooConcurrency(body.concurrency);
    const requestIntervalMs = clampYahooIntervalMs(body.requestIntervalMs);
    const skipExisting = body.skipExisting !== false;

    let skippedCount = 0;
    if (skipExisting) {
      const existingSet = await getTickersWithYahooProfile();
      const before = target.length;
      target = target.filter((t) => !existingSet.has(t.toUpperCase()));
      skippedCount = before - target.length;
    }

    const jobId = createJob(target.length);
    appendLog(jobId, `Starting Yahoo company description update for ${target.length} tickers (concurrency=${concurrency}, interval=${requestIntervalMs}ms, skipExisting=${skipExisting}, skipped=${skippedCount})`);
    res.json({ jobId });

    void (async () => {
      try {
        if (target.length === 0) {
          appendLog(jobId, "No tickers requested — nothing to do");
          await setLastSuccess("company_profiles_yahoo", new Date().toISOString(), {
            source: "yahoo",
            requested: 0,
            fetched: 0,
            updated: 0,
            errors: 0,
          });
          completeJob(jobId, { requested: 0, tickersUpdated: 0, tickersFailed: 0, totalRowsUpserted: 0 });
          return;
        }

        const { results, errors, cancelled } = await fetchYahooProfilesBatch(
          target,
          {
            concurrency,
            requestIntervalMs,
            onProgress: (done, total) => { updateProgress(jobId, done, total); },
            shouldCancel: () => isJobCancelled(jobId),
          },
        );

        if (cancelled || isJobCancelled(jobId)) {
          appendLog(jobId, `🛑 Cancelled — processed ${results.size + errors.size}/${target.length} tickers`);
          return;
        }

        let updated = 0;
        for (const [ticker, yp] of results) {
          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [ticker.toUpperCase()],
          );
          let secId: number;
          if (existingSec) {
            secId = existingSec.id;
            const sets: string[] = [];
            const params: unknown[] = [];
            if (yp.sector) { sets.push("sector = ?"); params.push(yp.sector); }
            if (yp.industry) { sets.push("industry = ?"); params.push(yp.industry); }
            if (sets.length > 0) {
              params.push(secId);
              await getDb().run(`UPDATE securities SET ${sets.join(", ")} WHERE id = ?`, params);
            }
          } else {
            secId = await upsertSecurity(
              ticker,
              null,
              null,
              yp.sector || null,
              yp.industry || null,
            );
          }
          await upsertCompanyProfile(
            secId,
            "yahoo",
            yp.longBusinessSummary || null,
            null,
            null,
            yp.website || null,
            null,
            null,
            JSON.stringify(yp.raw),
          );
          updated++;
          appendLog(jobId, `${ticker}: description ${yp.longBusinessSummary ? `updated (${yp.longBusinessSummary.length} chars)` : "missing"}`);
        }

        for (const [ticker, message] of errors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        const totalProfiles = await countCompanyProfiles();
        await setLastSuccess("company_profiles_yahoo", new Date().toISOString(), {
          source: "yahoo",
          requested: target.length,
          fetched: results.size,
          updated,
          errors: errors.size,
          skippedExisting: skippedCount,
          totalProfiles,
        });

        completeJob(jobId, {
          requested: target.length,
          fetched: results.size,
          tickersUpdated: updated,
          tickersFailed: errors.size,
          totalRowsUpserted: updated,
          skippedExisting: skippedCount,
          totalProfiles,
          source: "yahoo",
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull Finnhub Peers ─────────────────────────────────────────────────────
app.post("/api/company-profiles/pull-peers", async (req, res) => {
  try {
    const body = req.body as {
      tickers?: string[];
      maxTickers?: number;
      tickerConcurrency?: number;
      skipExisting?: boolean;
    };
    let tickers = body.tickers;
    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    let target = tickers.slice(0, max);
    const tickerConcurrency = clampFinnhubCompanyDataConcurrency(body.tickerConcurrency);
    const skipExisting = body.skipExisting !== false; // default: true (skip)

    let skippedCount = 0;
    if (skipExisting) {
      const existingSet = await getTickersWithExistingPeers();
      const before = target.length;
      target = target.filter((t) => !existingSet.has(t.toUpperCase()));
      skippedCount = before - target.length;
    }

    const jobId = createJob(target.length);
  appendLog(jobId, `Starting Finnhub peers update for ${target.length} tickers (concurrency=${tickerConcurrency}, skipExisting=${skipExisting}, skipped=${skippedCount})`);
    res.json({ jobId });

    void (async () => {
      try {
        if (target.length === 0) {
          appendLog(jobId, "No tickers requested — nothing to do");
          await setLastSuccess("company_profiles", new Date().toISOString(), {
            source: "finnhub-peers",
            requested: 0,
            fetched: 0,
            updated: 0,
            errors: 0,
          });
          completeJob(jobId, { requested: 0, tickersUpdated: 0, tickersFailed: 0, totalRowsUpserted: 0 });
          return;
        }

        const { results, errors: fetchErrors, cancelled } = await fetchFinnhubPeersBatch(
          target,
          {
            concurrency: tickerConcurrency,
            onProgress: (done, total) => { updateProgress(jobId, done, total); },
            shouldCancel: () => isJobCancelled(jobId),
          },
        );

        if (cancelled || isJobCancelled(jobId)) {
          appendLog(jobId, `🛑 Cancelled — processed ${results.size + fetchErrors.size}/${target.length} tickers`);
          return;
        }

        let updated = 0;
        for (const [ticker, peers] of results) {
          const secId = await upsertSecurity(ticker, null, null, null, null);
          await upsertPeers(secId, "finnhub", JSON.stringify(peers));
          updated++;
          appendLog(jobId, `${ticker}: ${peers.length} peers saved`);
        }

        for (const [ticker, message] of fetchErrors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        await setLastSuccess("company_profiles", new Date().toISOString(), {
          source: "finnhub-peers",
          requested: target.length,
          fetched: results.size,
          updated,
          errors: fetchErrors.size,
          skippedExisting: skippedCount,
        });

        completeJob(jobId, {
          requested: target.length,
          fetched: results.size,
          tickersUpdated: updated,
          tickersFailed: fetchErrors.size,
          totalRowsUpserted: updated,
          skippedExisting: skippedCount,
          errors: fetchErrors.size,
          source: "finnhub-peers",
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull Finnhub Market Cap ────────────────────────────────────────────────
app.post("/api/company-profiles/pull-market-cap", async (req, res) => {
  try {
    const body = req.body as {
      tickers?: string[];
      maxTickers?: number;
      tickerConcurrency?: number;
    };
    let tickers = body.tickers;
    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    const target = tickers.slice(0, max);
    const tickerConcurrency = clampFmpConcurrency(body.tickerConcurrency);

    // Skip tickers that already have recent market_cap (within 24h)
    const { getTickersWithRecentMarketCap } = await import("./services/companyProfileRepository.js");
    const recentSet = await getTickersWithRecentMarketCap(24);
    const filtered = target.filter((t) => !recentSet.has(t.toUpperCase()));
    const skippedCount = target.length - filtered.length;

    const jobId = createJob(filtered.length);
  appendLog(jobId, `Starting FMP market cap update: ${filtered.length} tickers to fetch (${skippedCount} skipped — already have recent data, concurrency=${tickerConcurrency})`);
    res.json({ jobId });

    void (async () => {
      try {
        const { results, errors, cancelled } = await fetchFmpProfilesBatch(
          filtered,
          {
            concurrency: tickerConcurrency,
            onProgress: (done, total) => { updateProgress(jobId, done, total); },
            shouldCancel: () => isJobCancelled(jobId),
          },
        );

        if (cancelled) {
          appendLog(jobId, `Job cancelled by user after ${results.size} tickers`);
          return;
        }

        let updated = 0;
        for (const [ticker, profile] of results) {
          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [ticker.toUpperCase()],
          );
          let secId: number;
          if (existingSec) {
            secId = existingSec.id;
            const sets: string[] = [];
            const params: unknown[] = [];
            if (profile.exchangeShortName) { sets.push("exchange = ?"); params.push(profile.exchangeShortName); }
            if (profile.companyName) { sets.push("name = ?"); params.push(profile.companyName); }
            if (profile.sector) { sets.push("sector = ?"); params.push(profile.sector); }
            if (profile.industry) { sets.push("industry = ?"); params.push(profile.industry); }
            if (sets.length > 0) {
              params.push(secId);
              await getDb().run(`UPDATE securities SET ${sets.join(", ")} WHERE id = ?`, params);
            }
          } else {
            secId = await upsertSecurity(
              ticker,
              profile.exchangeShortName,
              profile.companyName,
              profile.sector,
              profile.industry,
            );
          }
          await upsertCompanyProfile(
            secId,
            "fmp",
            null,
            null,
            null,
            null,
            profile.ipoDate,
            profile.mktCap,
            JSON.stringify(profile.raw),
          );
          updated++;
          appendLog(jobId, `${ticker}: market cap ${profile.mktCap != null ? "updated" : "missing"}`);
        }

        for (const [ticker, message] of errors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        await setLastSuccess("company_profiles_market_cap", new Date().toISOString(), {
          requested: target.length,
          fetched: filtered.length,
          skippedRecent: skippedCount,
          updated,
          errors: errors.size,
          source: "fmp-profile",
        });

        completeJob(jobId, {
          updated,
          total: filtered.length,
          skippedRecent: skippedCount,
          errors: errors.size,
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull FMP Float Data ────────────────────────────────────────────────────
app.post("/api/company-profiles/pull-float", async (req, res) => {
  try {
    const body = req.body as { tickers?: string[]; maxTickers?: number };
    let tickers = body.tickers;
    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    const target = tickers.slice(0, max);

    const { getTickersWithRecentFloat } = await import("./services/companyProfileRepository.js");
    const recentSet = await getTickersWithRecentFloat(24);
    const filtered = target.filter((t) => !recentSet.has(t.toUpperCase()));
    const skippedCount = target.length - filtered.length;

    const jobId = createJob(filtered.length);
    appendLog(jobId, `Starting FMP float update: ${filtered.length} tickers to fetch (${skippedCount} skipped)`);
    res.json({ jobId });

    void (async () => {
      try {
        const { fetchFmpSharesFloatBatch } = await import("./services/fmpSharesFloatProvider.js");
        const { results, errors, cancelled } = await fetchFmpSharesFloatBatch(filtered, {
          onProgress: (done, total) => { updateProgress(jobId, done, total); },
          shouldCancel: () => isJobCancelled(jobId),
        });

        if (cancelled) { appendLog(jobId, `Job cancelled after ${results.size} tickers`); return; }

        let updated = 0;
        for (const [ticker, data] of results) {
          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [ticker.toUpperCase()],
          );
          if (!existingSec) continue;
          const { upsertFloat } = await import("./services/companyProfileRepository.js");
          await upsertFloat(existingSec.id, "fmp", data.floatShares, data.freeFloat, data.outstandingShares, "fmp");
          updated++;
          appendLog(jobId, `${ticker}: float ${data.freeFloat != null ? data.freeFloat.toFixed(2) + "%" : "N/A"}`);
        }

        for (const [ticker, message] of errors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        completeJob(jobId, { updated, total: filtered.length, skippedRecent: skippedCount, errors: errors.size });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Pull Finnhub Institutional Ownership ───────────────────────────────────
app.post("/api/company-profiles/pull-institutional", async (req, res) => {
  res.status(410).json({
    error: "Finnhub institutional ownership update has been removed. Use /api/company-profiles/pull-holders-yahoo instead.",
  });
});

// ── Pull Finnhub IPO Date ──────────────────────────────────────────────────
app.post("/api/company-profiles/pull-ipo-date", async (req, res) => {
  try {
    const body = req.body as {
      tickers?: string[];
      maxTickers?: number;
      tickerConcurrency?: number;
      skipExisting?: boolean;
    };
    let tickers = body.tickers;
    if (!tickers || tickers.length === 0) {
      tickers = await getDefaultUniverseTickers();
    }
    const max = body.maxTickers ?? tickers.length;
    let target = tickers.slice(0, max);
    const tickerConcurrency = clampFinnhubCompanyDataConcurrency(body.tickerConcurrency);
    const skipExisting = body.skipExisting !== false; // default: true (skip)

    let skippedCount = 0;
    if (skipExisting) {
      const existingSet = await getTickersWithExistingIpoDate();
      const before = target.length;
      target = target.filter((t) => !existingSet.has(t.toUpperCase()));
      skippedCount = before - target.length;
    }

    const jobId = createJob(target.length);
  appendLog(jobId, `Starting Finnhub IPO date update for ${target.length} tickers (concurrency=${tickerConcurrency}, skipExisting=${skipExisting}, skipped=${skippedCount})`);
    res.json({ jobId });

    void (async () => {
      try {
        if (target.length === 0) {
          appendLog(jobId, "No tickers requested — nothing to do");
          await setLastSuccess("company_profiles_ipo_date", new Date().toISOString(), {
            source: "finnhub-profile2-ipo",
            requested: 0,
            fetched: 0,
            updated: 0,
            errors: 0,
          });
          completeJob(jobId, { requested: 0, tickersUpdated: 0, tickersFailed: 0, totalRowsUpserted: 0, source: "finnhub-profile2-ipo" });
          return;
        }

        const { results, errors, cancelled } = await fetchFinnhubProfilesBatch(
          target,
          {
            concurrency: tickerConcurrency,
            onProgress: (done, total) => { updateProgress(jobId, done, total); },
            shouldCancel: () => isJobCancelled(jobId),
          },
        );

        if (cancelled || isJobCancelled(jobId)) {
          appendLog(jobId, `Job cancelled by user after ${results.size} tickers`);
          return;
        }

        let updated = 0;
        for (const [ticker, profile] of results) {
          const existingSec = await getDb().get<{ id: number }>(
            "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
            [ticker.toUpperCase()],
          );
          let secId: number;
          if (existingSec) {
            secId = existingSec.id;
            const sets: string[] = [];
            const params: unknown[] = [];
            if (profile.exchange) { sets.push("exchange = ?"); params.push(profile.exchange); }
            if (profile.name) { sets.push("name = ?"); params.push(profile.name); }
            if (profile.finnhubIndustry) { sets.push("industry = ?"); params.push(profile.finnhubIndustry); }
            if (sets.length > 0) {
              params.push(secId);
              await getDb().run(`UPDATE securities SET ${sets.join(", ")} WHERE id = ?`, params);
            }
          } else {
            secId = await upsertSecurity(
              ticker,
              profile.exchange,
              profile.name,
              null,
              profile.finnhubIndustry,
            );
          }

          await upsertCompanyProfile(
            secId,
            "finnhub",
            null,
            null,
            null,
            null,
            profile.ipoDate,
            null,
            JSON.stringify(profile.raw),
          );
          updated++;
          appendLog(jobId, `${ticker}: ipo date ${profile.ipoDate ? `updated (${profile.ipoDate})` : "missing"}`);
        }

        for (const [ticker, message] of errors) {
          appendLog(jobId, `${ticker}: error - ${message}`);
        }

        await setLastSuccess("company_profiles_ipo_date", new Date().toISOString(), {
          requested: target.length,
          fetched: results.size,
          updated,
          errors: errors.size,
          skippedExisting: skippedCount,
          source: "finnhub-profile2-ipo",
        });

        completeJob(jobId, {
          requested: target.length,
          fetched: results.size,
          tickersUpdated: updated,
          tickersFailed: errors.size,
          totalRowsUpserted: updated,
          skippedExisting: skippedCount,
          source: "finnhub-profile2-ipo",
        });
      } catch (error) {
        failJob(jobId, error instanceof Error ? error.message : String(error));
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── App DB Inspection ────────────────────────────────────────────────────────
const TABLE_UI_USAGE: Record<string, string[]> = {
  securities: [
    "Default Ticker Window — 종목 식별자 기준",
    "Watchlist join point (security_id)",
    "company_profiles · ticker_universe_items 연결 키",
  ],
  company_profiles: [
    "POST /api/company-profiles/pull-fmp (FMP 회사 설명 저장)",
    "POST /api/company-profiles/pull-peers (Finnhub peers 수집)",
    "POST /api/company-profiles/pull-market-cap (Finnhub market cap 수집)",
    "POST /api/company-profiles/pull-ipo-date (Finnhub IPO date 수집)",
    "GET /api/company-profiles/:ticker",
  ],
  ticker_universes: [
    "Default Ticker Window — default universe 조회",
    "POST /api/news/pull-finhub — default 대상 선택",
    "POST /api/company-profiles/pull-fmp — 기본 종목 목록",
  ],
  ticker_universe_items: [
    "ticker_universes ↔ securities 조인 테이블",
    "Default Ticker Window 종목 목록 소스",
  ],
  watchlists: ["Watchlist 창 — 사용자 관심 종목 그룹"],
  watchlist_items: [
    "Watchlist 창 종목 항목",
    "security_id 기준 securities 조인",
  ],
  news_items: [
    "News Feed — Finnhub 뉴스 표시",
    "GET /api/news (검색/필터/커서 페이징)",
    "SSE 스트림 — 실시간 push",
  ],
  news_fulltext: ["News Feed 본문 보기 — full text 추출 결과"],
  bookmarks: ["News Feed 북마크 폴더"],
  bookmark_items: ["News Feed 북마크 항목"],
  calendar_events: ["Calendar 창 — IBKR 이벤트"],
  ohlc_1d: ["Price 변화율 계산 (IBKR OHLC 1일봉)"],
  saved_views: ["News Feed 저장 필터 뷰"],
  alert_rules: ["Alert 규칙 관리"],
  update_status: ["Data Control Updates 탭 — 마지막 성공 시각 표시"],
  jobs: ["Data Control Update 진행 상황 (background job)"],
};

app.get("/api/db/inspect", async (_req, res, next) => {
  try {
    const db = getDb();
    const tables = await db.all<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );

    const result = await Promise.all(
      tables.map(async ({ name }) => {
        const columns = await db.all(`PRAGMA table_info("${name}")`);
        const fks = await db.all(`PRAGMA foreign_key_list("${name}")`);
        const countRow = await db.get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM "${name}"`);
        const sampleRows = await db.all(`SELECT * FROM "${name}" ORDER BY rowid DESC LIMIT 5`);

        const tableObj: Record<string, unknown> = {
          name,
          columns,
          foreignKeys: fks,
          rowCount: countRow?.cnt ?? 0,
          sampleRows,
          uiUsage: TABLE_UI_USAGE[name] ?? [],
        };

        // Resource expansion for ticker_universes — each row = one resource identifier
        if (name === "ticker_universes") {
          const universesData = await db.all<Array<{
            id: number; name: string; source_path: string | null; created_at: string; itemCount: number;
          }>>(
            `SELECT u.id, u.name, u.source_path, u.created_at,
                    COUNT(ui.security_id) as itemCount
             FROM ticker_universes u
             LEFT JOIN ticker_universe_items ui ON ui.universe_id = u.id
             GROUP BY u.id`,
          );
          const resources = await Promise.all(
            universesData.map(async (u) => {
              const sampleSecs = await db.all<Array<{ ticker: string }>>(
                `SELECT s.ticker FROM ticker_universe_items ui
                 JOIN securities s ON s.id = ui.security_id
                 WHERE ui.universe_id = ?
                 ORDER BY ui.sort_order LIMIT 10`,
                [u.id],
              );
              return {
                identifier: `ticker_universes/${u.name}`,
                label: u.name,
                sourcePath: u.source_path,
                itemCount: u.itemCount,
                sampleTickers: sampleSecs.map((s) => s.ticker),
                uiUsage: [
                  "Default Ticker Window — 종목 목록 표시",
                  "POST /api/company-profiles/pull-fmp — 기본 종목 대상",
                  "POST /api/news/pull-finhub — 기본 ticker 대상",
                ],
              };
            }),
          );
          tableObj.resources = resources;
        }

        return tableObj;
      }),
    );

    res.json({ tables: result });
  } catch (err) {
    next(err);
  }
});

// ── Case Research: tabs ──

async function runResearchMaintenance(): Promise<void> {
  await purgeExpiredResearchTrash();
}

app.get("/api/research/tabs", async (_req, res, next) => {
  try {
    await runResearchMaintenance();
    const tabs = await listResearchTabs(DEMO_USER_ID);
    res.json(tabs);
  } catch (err) { next(err); }
});

app.post("/api/research/tabs", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const tab = await createResearchTab(DEMO_USER_ID, req.body?.name);
    res.status(201).json(tab);
  } catch (err) { next(err); }
});

app.patch("/api/research/tabs/:id", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const tab = await renameResearchTab(req.params.id, req.body.name);
    if (!tab) { res.status(404).json({ error: "Tab not found" }); return; }
    res.json(tab);
  } catch (err) { next(err); }
});

app.delete("/api/research/tabs/:id", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    await deleteResearchTab(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/api/research/trash", async (_req, res, next) => {
  try {
    await runResearchMaintenance();
    const [tabs, pages] = await Promise.all([
      listTrashedResearchTabs(DEMO_USER_ID),
      listTrashedResearchPages(DEMO_USER_ID),
    ]);
    res.json({ tabs, pages });
  } catch (err) { next(err); }
});

app.post("/api/research/tabs/:id/restore", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const tab = await restoreResearchTab(req.params.id);
    if (!tab) { res.status(404).json({ error: "Tab not found" }); return; }
    res.json(tab);
  } catch (err) { next(err); }
});

// ── Case Research: pages ──

app.get("/api/research/tabs/:tabId/pages", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const pages = await listResearchPages(req.params.tabId);
    res.json(pages);
  } catch (err) { next(err); }
});

app.post("/api/research/tabs/:tabId/pages", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const page = await createResearchPage(req.params.tabId, req.body?.title);
    res.status(201).json(page);
  } catch (err) { next(err); }
});

app.post("/api/research/tabs/:tabId/pages/reorder", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const pageIds = Array.isArray(req.body?.pageIds)
      ? req.body.pageIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const pages = await reorderResearchPages(req.params.tabId, pageIds);
    res.json(pages);
  } catch (err) { next(err); }
});

app.get("/api/research/pages/:id", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const page = await getResearchPage(req.params.id);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(page);
  } catch (err) { next(err); }
});

app.patch("/api/research/pages/:id", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const page = await updateResearchPage(req.params.id, {
      title: req.body.title,
      body: req.body.body,
    });
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(page);
  } catch (err) { next(err); }
});

app.delete("/api/research/pages/:id", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    await deleteResearchPage(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/api/research/pages/:id/restore", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const page = await restoreResearchPage(req.params.id);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    res.json(page);
  } catch (err) {
    if (err instanceof Error && err.message === "PARENT_TAB_DELETED") {
      res.status(409).json({ error: "Parent tab is still deleted. Restore the tab first." });
      return;
    }
    next(err);
  }
});

// ── Case Research: search ──

app.get("/api/research/search", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) { res.json([]); return; }
    const results = await searchResearch(DEMO_USER_ID, q);
    res.json(results);
  } catch (err) { next(err); }
});

// ── Model 2 analysis / evidence ──

app.get("/api/model2/analyses", async (req, res, next) => {
  try {
    const pageId = typeof req.query.pageId === "string" && req.query.pageId.trim() ? req.query.pageId.trim() : undefined;
    const analyses = await listModel2Analyses(pageId);
    res.json(analyses);
  } catch (err) { next(err); }
});

app.get("/api/model2/analyses/:analysisId", async (req, res, next) => {
  try {
    const analysis = await getModel2AnalysisRun(req.params.analysisId);
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.json(analysis);
  } catch (err) { next(err); }
});

app.get("/api/model2/analyses/:analysisId/cases", async (req, res, next) => {
  try {
    const analysis = await getModel2AnalysisRun(req.params.analysisId);
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    const cases = await listModel2CaseSummaries(req.params.analysisId);
    res.json(cases);
  } catch (err) { next(err); }
});

app.get("/api/model2/analyses/:analysisId/evidence", async (req, res, next) => {
  try {
    const analysis = await getModel2AnalysisRun(req.params.analysisId);
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    const result = await listModel2EvidenceRows({
      analysisId: req.params.analysisId,
      caseType: typeof req.query.caseType === "string" ? req.query.caseType : undefined,
      keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined,
      ticker: typeof req.query.ticker === "string" ? req.query.ticker : undefined,
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
      sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
      sortDir: typeof req.query.sortDir === "string" ? req.query.sortDir : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      offset: typeof req.query.offset === "string" ? Number(req.query.offset) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
});

app.delete("/api/model2/analyses/:analysisId", async (req, res, next) => {
  try {
    await runResearchMaintenance();
    const result = await deleteModel2AnalysisRun(req.params.analysisId);
    if (!result.deleted) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

async function runStartupMaintenance(): Promise<void> {
  try {
    const enableHeavyStartupMaintenance = process.env.ENABLE_HEAVY_STARTUP_MAINTENANCE === "1";

    const deletedBlockedCompanyNews = await deleteBlockedFinnhubCompanyNews();
    if (deletedBlockedCompanyNews > 0) {
      console.log(`[startup] deleted blocked FINNHUB company_news rows: ${deletedBlockedCompanyNews}`);
    }

    if (enableHeavyStartupMaintenance) {
      const blockedEvidenceCleanup = await cleanupBlockedFinnhubCompanyNewsEvidence();
      if (blockedEvidenceCleanup.deletedEvidenceRows > 0) {
        console.log(`[startup] deleted blocked FINNHUB company_news evidence rows: ${blockedEvidenceCleanup.deletedEvidenceRows} (analyses=${blockedEvidenceCleanup.affectedAnalysisIds.join(",")})`);
      }

      const publisherBackfilled = await backfillPublisher();
      if (publisherBackfilled > 0) {
        console.log(`[startup] backfilled publisher for ${publisherBackfilled} news_items rows`);
      }
    } else {
      console.log("[startup] skipped heavy maintenance (set ENABLE_HEAVY_STARTUP_MAINTENANCE=1 to enable)");
    }

    const addedCols = await ensureDerivedColumns();
    if (addedCols.length > 0) {
      console.log(`[startup] added derived columns to ohlc_1d: ${addedCols.join(", ")}`);
    }

    await ensureSeedData();
    await importDefaultTickerUniverse();

    const wlBackfilled = await backfillWatchlistSecurityIds();
    if (wlBackfilled > 0) {
      console.log(`[startup] backfilled security_id for ${wlBackfilled} watchlist_items rows`);
    }

    console.log("[startup] maintenance complete");
  } catch (error) {
    console.error("[startup] maintenance failed", error);
  }
}

async function start(): Promise<void> {
  await initDb();
  await ensureSeedData();
  const runStartupMaintenanceOnBoot = process.env.RUN_STARTUP_MAINTENANCE === "1";

  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
    if (runStartupMaintenanceOnBoot) {
      void runStartupMaintenance();
    } else {
      console.log("[startup] automatic maintenance disabled (set RUN_STARTUP_MAINTENANCE=1 to enable)");
    }
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
