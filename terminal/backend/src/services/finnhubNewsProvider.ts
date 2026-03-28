import { config } from "../config.js";
import { getDb } from "../db.js";
import { getEtDateString, toEtNaiveIso } from "./timeUtils.js";
import { isFinnhubNewsRedirectUrl, resolveFinnhubNewsOriginUrl } from "./finnhubRedirectResolver.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const MARKET_NEWS_CATEGORY = "general";
const MARKET_NEWS_PAGE_DELAY_MS = 250;
const MARKET_NEWS_PAGE_BATCH_SIZE = 30;
const MARKET_NEWS_MAX_TOTAL_PAGES = 300;
const COMPANY_NEWS_ORIGIN_RESOLVE_CONCURRENCY = 20;
const COMPANY_NEWS_ORIGIN_RESOLVE_MAX_RETRIES = 10;
const COMPANY_NEWS_ORIGIN_RESOLVE_BASE_DELAY_MS = 100;
const COMPANY_NEWS_ORIGIN_RESOLVE_TIMEOUT_MS = 8000;

/**
 * Global token-bucket rate limiter for Finnhub API.
 * Paid plan: 300 req/min. We target 270/min (~4.5 req/sec) to leave headroom.
 * Each call to acquireToken() waits until a slot is available.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_TOKENS = 270;
const rateLimitTimestamps: number[] = [];

async function acquireToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    // Purge timestamps older than the window
    while (rateLimitTimestamps.length > 0 && rateLimitTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
      rateLimitTimestamps.shift();
    }
    if (rateLimitTimestamps.length < RATE_LIMIT_MAX_TOKENS) {
      rateLimitTimestamps.push(now);
      return;
    }
    // Wait until the oldest timestamp exits the window
    const waitMs = rateLimitTimestamps[0] - (now - RATE_LIMIT_WINDOW_MS) + 10;
    await sleep(waitMs);
  }
}

/**
 * Adaptive backfill cap threshold.
 * When a single request returns >= this many items, we assume the response
 * may be truncated and split the date range in half.
 */
const CAP_THRESHOLD = 190;

/**
 * Minimum window size (in days) before we stop splitting further.
 * Even if the window is still hitting the cap at 1 day, we cannot split further.
 */
const MIN_WINDOW_DAYS = 1;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Types ----------

export type FinnhubMappedItem = {
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  providerTickers: string[];
  tags: string[];
  publisher?: string;
  originUrl?: string;
  /** Raw HTML body from provider (RTPR article_body_html). Undefined for non-HTML sources. */
  bodyHtml?: string;
};

type CompanyNewsOriginResolveFailure = {
  symbol: string;
  url: string;
  title: string;
  attempts: number;
};

const COMPANY_NEWS_BLOCKED_PUBLISHERS = new Set(["SEEKINGALPHA"]);

const PUBLISHER_CANONICAL_MAP: Record<string, string> = {
  "YAHOO FINANCE": "YAHOO",
  "SEEKING ALPHA": "SEEKINGALPHA",
  "PR NEWSWIRE": "PRNEWSWIRE",
  "GLOBE NEWS WIRE": "GLOBENEWSWIRE",
};

const CONTENT_PUBLISHER_HINTS: Array<{ publisher: string; patterns: RegExp[] }> = [
  {
    publisher: "YAHOO",
    patterns: [
      /yahoo finance(?:'s)?\s+(?:senior reporter|reporter|anchor|executive editor)/i,
      /joins?\s+opening bid host/i,
      /in this market minute/i,
      /good buy or goodbye/i,
      /yahoo finance polymarket hub/i,
      /to watch more expert insights and analysis on the latest market action/i,
      /yahoo finance's john hyland/i,
      /yahoo finance senior reporter/i,
    ],
  },
  { publisher: "REUTERS", patterns: [/\(reuters\)/i, /\breuters\s*-\s*/i, /\bby\s+[^\n]{1,120}\(reuters\)/i] },
  { publisher: "BENZINGA", patterns: [/\bbenzinga\b/i, /benzinga edge/i, /benzinga pro/i, /analyst stock ratings/i] },
  { publisher: "SEEKINGALPHA", patterns: [/\bseeking alpha\b/i] },
  { publisher: "TIPRANKS", patterns: [/\btipranks\b/i, /tipranks premium/i] },
  { publisher: "MARKETWATCH", patterns: [/\bmarketwatch\b/i] },
  { publisher: "CNBC", patterns: [/\bcnbc\b/i] },
  { publisher: "INVESTORPLACE", patterns: [/\binvestorplace\b/i] },
  { publisher: "MOTLEY FOOL", patterns: [/\bmotley fool\b/i] },
  { publisher: "ZACKS", patterns: [/\bzacks\b/i, /zacks rank/i] },
  { publisher: "GURUFOCUS", patterns: [/\bgurufocus\b/i] },
  { publisher: "THEFLY.COM", patterns: [/\bthe fly\b/i, /fly intel/i] },
  { publisher: "STOCK OPTIONS CHANNEL", patterns: [/stock options channel/i] },
  { publisher: "FINTEL", patterns: [/\bfintel\b/i] },
];

export interface MarketNewsBatchProgress {
  batchNumber: number;
  batchPagesFetched: number;
  totalPagesFetched: number;
  batchItemsInRange: number;
  totalItemsInRange: number;
  oldestPublishedAt?: string;
  nextMinId?: string;
  reason: "batch-complete" | "reached-from-date" | "source-exhausted" | "page-limit";
}

export interface MarketNewsPullResult {
  items: FinnhubMappedItem[];
  pagesFetched: number;
  batchesFetched: number;
  oldestPublishedAt?: string;
  nextMinId?: string;
  reachedFromDate: boolean;
  hitTotalPageLimit: boolean;
}

interface MarketNewsPullOptions {
  startMinId?: string;
  onBatch?: (progress: MarketNewsBatchProgress) => void;
}

// ---------- Helpers ----------

function toUtcIsoDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD → Date (UTC midnight) */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Add N days to a YYYY-MM-DD string, return YYYY-MM-DD */
function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

/** midpoint date between two YYYY-MM-DD strings */
function midDate(from: string, to: string): string {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  const mid = new Date(a + Math.floor((b - a) / 2));
  return formatDate(mid);
}

/** number of days in [from, to] inclusive */
function daySpan(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Acquire a rate-limit token before each attempt
    await acquireToken();
    try {
      const res = await fetch(url);

      // Rate limited — back off and retry
      if (res.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Finnhub rate limit (429) after ${MAX_RETRIES} retries`);
        }
        const retryAfter = Number(res.headers.get("retry-after") || "1");
        await sleep(Math.max(retryAfter * 1000, BASE_DELAY_MS * attempt));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Finnhub ${res.status}: ${text}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}

async function resolveCompanyNewsOrigins(
  symbol: string,
  items: FinnhubMappedItem[],
  options?: { onOriginResolveFinalFailure?: (failure: CompanyNewsOriginResolveFailure) => void | Promise<void> },
): Promise<FinnhubMappedItem[]> {
  const wrapperUrls = Array.from(
    new Set(items.map((item) => item.url).filter((url) => isFinnhubNewsRedirectUrl(url))),
  );

  if (wrapperUrls.length === 0) {
    return items.map((item) => ({
      ...item,
      originUrl: item.url,
      publisher: resolveBestPublisher({
        url: item.url,
        providerSource: item.publisher,
        title: item.title,
        body: item.body,
        originUrl: item.url,
      }),
    }));
  }

  const titleByUrl = new Map<string, string>();
  for (const item of items) {
    if (isFinnhubNewsRedirectUrl(item.url) && !titleByUrl.has(item.url)) {
      titleByUrl.set(item.url, item.title);
    }
  }

  let cursor = 0;
  const resolvedByUrl = new Map<string, string | null>();

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= wrapperUrls.length) {
        return;
      }

      const wrapperUrl = wrapperUrls[index];
      const resolvedOriginUrl = await resolveFinnhubNewsOriginUrl(wrapperUrl, {
        maxRetries: COMPANY_NEWS_ORIGIN_RESOLVE_MAX_RETRIES,
        baseDelayMs: COMPANY_NEWS_ORIGIN_RESOLVE_BASE_DELAY_MS,
        timeoutMs: COMPANY_NEWS_ORIGIN_RESOLVE_TIMEOUT_MS,
      });
      resolvedByUrl.set(wrapperUrl, resolvedOriginUrl);

      if (!resolvedOriginUrl && options?.onOriginResolveFinalFailure) {
        try {
          await options.onOriginResolveFinalFailure({
            symbol,
            url: wrapperUrl,
            title: titleByUrl.get(wrapperUrl) ?? "",
            attempts: COMPANY_NEWS_ORIGIN_RESOLVE_MAX_RETRIES,
          });
        } catch {
          // Do not fail news ingestion because logging failed.
        }
      }
    }
  }

  const workerCount = Math.min(COMPANY_NEWS_ORIGIN_RESOLVE_CONCURRENCY, wrapperUrls.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return items.map((item) => {
    const resolvedOriginUrl = isFinnhubNewsRedirectUrl(item.url)
      ? (resolvedByUrl.get(item.url) ?? "")
      : item.url;
    const publisher = resolveBestPublisher({
      url: item.url,
      providerSource: item.publisher,
      title: item.title,
      body: item.body,
      originUrl: resolvedOriginUrl,
    });

    return {
      ...item,
      originUrl: resolvedOriginUrl || undefined,
      publisher,
    };
  });
}

function compareNumericIds(a: string, b: string): number {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  } catch {
    return a.localeCompare(b);
  }
}

function isWithinDateRange(iso: string, from: string, to: string): boolean {
  return iso >= `${from}T00:00:00.000Z` && iso <= `${to}T23:59:59.999Z`;
}

function getOldestPublishedAt(items: FinnhubMappedItem[]): string | undefined {
  if (items.length === 0) return undefined;
  return items.reduce((oldest, item) => (item.publishedAt < oldest ? item.publishedAt : oldest), items[0].publishedAt);
}

function getMinRawId(items: any[]): string | undefined {
  let minId: string | undefined;
  for (const item of items) {
    const id = item?.id;
    if (id === undefined || id === null) continue;
    const idStr = String(id);
    if (!minId || compareNumericIds(idStr, minId) < 0) {
      minId = idStr;
    }
  }
  return minId;
}

// ---------- Incremental anchor ----------

async function getLastPublishedAt(sourceType: string): Promise<string | null> {
  const row = await getDb().get<{ max_pub: string | null }>(
    `SELECT MAX(published_at) AS max_pub FROM news_items WHERE source = 'FINNHUB' AND source_type = ?`,
    [sourceType],
  );
  return row?.max_pub ?? null;
}

function computeFromDate(lastPublished: string | null, lookbackDays: number): string {
  if (lastPublished) {
    // Start from the day of last published item (may re-fetch same day — deduped by INSERT OR IGNORE)
    return getEtDateString(lastPublished);
  }
  // First time: lookback N days
  return addDays(getEtDateString(new Date()), -lookbackDays);
}

// ---------- Raw fetch helpers (single request, no splitting) ----------

export async function fetchCompanyNewsRaw(
  symbol: string,
  from: string,
  to: string,
  options?: { onOriginResolveFinalFailure?: (failure: CompanyNewsOriginResolveFailure) => void | Promise<void> },
): Promise<FinnhubMappedItem[]> {
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);
  if (!Array.isArray(raw)) return [];

  const mapped = raw
    .map((item: any) => {
      const publisher = resolveBestPublisher({
        url: item.url ?? "",
        providerSource: item.source,
        title: item.headline ?? "",
        body: item.summary ?? "",
      });

      return {
        publishedAt: item.datetime ? toEtNaiveIso(item.datetime * 1000) : toEtNaiveIso(new Date()),
        source: "FINNHUB",
        sourceType: "company_news",
        title: item.headline ?? "(untitled)",
        body: item.summary ?? "",
        url: item.url ?? "",
        providerTickers: item.related
          ? item.related
              .split(",")
              .map((s: string) => s.trim().toUpperCase())
              .filter(Boolean)
          : [symbol.toUpperCase()],
        tags: item.category ? [item.category.toLowerCase()] : [],
        publisher,
      };
    })
    .filter((item) => {
      if (!item.url.trim()) {
        return false;
      }
      return !COMPANY_NEWS_BLOCKED_PUBLISHERS.has(item.publisher ?? "UNKNOWN");
    });

  return resolveCompanyNewsOrigins(symbol, mapped, options);
}

export async function fetchPressReleasesRaw(
  symbol: string,
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  const url = `${FINNHUB_BASE}/press-releases?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);

  const items: any[] = raw?.majorDevelopment ?? raw?.pressReleases ?? [];
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    publishedAt: item.datetime ?? new Date().toISOString(),
    source: "FINNHUB",
    sourceType: "press_release",
    title: item.headline ?? item.description ?? "(untitled)",
    body: item.description ?? item.headline ?? "",
    url: item.url ?? "",
    providerTickers: [symbol.toUpperCase()],
    tags: item.category ? [item.category.toLowerCase()] : ["press_release"],
    publisher: derivePublisher(item.url ?? ""),
  }));
}

export async function fetchMarketNewsPageRaw(
  category: string = MARKET_NEWS_CATEGORY,
  minId?: string,
): Promise<{ items: FinnhubMappedItem[]; nextMinId?: string; oldestPublishedAt?: string }> {
  const minIdQuery = minId ? `&minId=${encodeURIComponent(minId)}` : "";
  const url = `${FINNHUB_BASE}/news?category=${encodeURIComponent(category)}${minIdQuery}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);
  if (!Array.isArray(raw)) {
    return { items: [] };
  }

  const mapped = raw.map((item: any) => ({
    publishedAt: item.datetime ? toUtcIsoDate(item.datetime) : new Date().toISOString(),
    source: "FINNHUB",
    sourceType: "market_news",
    title: item.headline ?? "(untitled)",
    body: item.summary ?? "",
    url: item.url ?? "",
    providerTickers: item.related
      ? String(item.related)
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .filter(Boolean)
      : [],
    tags: item.category ? [String(item.category).toLowerCase()] : [MARKET_NEWS_CATEGORY],
    publisher: item.source ? canonicalizePublisherLabel(String(item.source)) : derivePublisher(item.url ?? ""),
  }));

  return {
    items: mapped,
    nextMinId: getMinRawId(raw),
    oldestPublishedAt: getOldestPublishedAt(mapped),
  };
}

async function pullMarketNewsPaged(
  from: string,
  to: string,
  options: MarketNewsPullOptions = {},
): Promise<MarketNewsPullResult> {
  const results: FinnhubMappedItem[] = [];
  const seenUrls = new Set<string>();
  const seenMinIds = new Set<string>();
  let minId = options.startMinId;
  let pagesFetched = 0;
  let batchesFetched = 0;
  let batchPagesFetched = 0;
  let batchItemsInRange = 0;
  let totalItemsInRange = 0;
  let oldestPublishedAt: string | undefined;
  let reachedFromDate = false;
  let nextMinId: string | undefined;
  let hitTotalPageLimit = false;

  const flushBatch = (
    reason: MarketNewsBatchProgress["reason"],
    overrideNextMinId?: string,
  ) => {
    if (batchPagesFetched === 0) {
      return;
    }
    batchesFetched += 1;
    options.onBatch?.({
      batchNumber: batchesFetched,
      batchPagesFetched,
      totalPagesFetched: pagesFetched,
      batchItemsInRange,
      totalItemsInRange,
      oldestPublishedAt,
      nextMinId: overrideNextMinId ?? nextMinId,
      reason,
    });
    batchPagesFetched = 0;
    batchItemsInRange = 0;
  };

  while (pagesFetched < MARKET_NEWS_MAX_TOTAL_PAGES) {
    const pageResult = await fetchMarketNewsPageRaw(MARKET_NEWS_CATEGORY, minId);
    if (pageResult.items.length === 0) {
      flushBatch("source-exhausted", undefined);
      nextMinId = undefined;
      break;
    }

    pagesFetched += 1;
    batchPagesFetched += 1;
    if (pageResult.oldestPublishedAt && (!oldestPublishedAt || pageResult.oldestPublishedAt < oldestPublishedAt)) {
      oldestPublishedAt = pageResult.oldestPublishedAt;
    }

    for (const item of pageResult.items) {
      if (!isWithinDateRange(item.publishedAt, from, to)) {
        continue;
      }
      const dedupeKey = item.url || `${item.title}|${item.publishedAt}`;
      if (seenUrls.has(dedupeKey)) {
        continue;
      }
      seenUrls.add(dedupeKey);
      results.push(item);
      batchItemsInRange += 1;
      totalItemsInRange += 1;
    }

    if (!pageResult.nextMinId || seenMinIds.has(pageResult.nextMinId)) {
      nextMinId = undefined;
      flushBatch("source-exhausted", undefined);
      break;
    }
    if (pageResult.oldestPublishedAt && pageResult.oldestPublishedAt < `${from}T00:00:00.000Z`) {
      reachedFromDate = true;
      nextMinId = undefined;
      flushBatch("reached-from-date", undefined);
      break;
    }

    seenMinIds.add(pageResult.nextMinId);
    minId = pageResult.nextMinId;
    nextMinId = pageResult.nextMinId;

    if (batchPagesFetched >= MARKET_NEWS_PAGE_BATCH_SIZE) {
      flushBatch("batch-complete", nextMinId);
    }

    await sleep(MARKET_NEWS_PAGE_DELAY_MS);
  }

  if (pagesFetched >= MARKET_NEWS_MAX_TOTAL_PAGES && !reachedFromDate && nextMinId) {
    hitTotalPageLimit = true;
    flushBatch("page-limit", nextMinId);
  }

  return {
    items: results,
    pagesFetched,
    batchesFetched,
    oldestPublishedAt,
    nextMinId,
    reachedFromDate,
    hitTotalPageLimit,
  };
}

// ---------- Adaptive date-splitting backfill ----------

/**
 * Generic adaptive backfill: calls `fetcher(symbol, from, to)` and if the
 * result count >= CAP_THRESHOLD, splits [from, to] in half and recurses.
 * This ensures we collect all data even when the API truncates large responses.
 */
async function adaptiveBackfill(
  symbol: string,
  from: string,
  to: string,
  fetcher: (sym: string, f: string, t: string) => Promise<FinnhubMappedItem[]>,
  label: string,
): Promise<FinnhubMappedItem[]> {
  const span = daySpan(from, to);
  if (span <= 0) return [];

  const items = await fetcher(symbol, from, to);

  // If under cap or window is already minimum, return as-is
  if (items.length < CAP_THRESHOLD || span <= MIN_WINDOW_DAYS) {
    if (items.length >= CAP_THRESHOLD && span <= MIN_WINDOW_DAYS) {
      console.warn(
        `[backfill] ${label} ${symbol} window ${from}~${to} hit cap (${items.length}) at minimum window — cannot split further`,
      );
    }
    return items;
  }

  // Result might be truncated — split the range in half and recurse
  console.log(
    `[backfill] ${label} ${symbol} ${from}~${to} returned ${items.length} items (>=cap ${CAP_THRESHOLD}), splitting…`,
  );

  const mid = midDate(from, to);
  // Small delay between split requests to respect rate limits
  await sleep(300);

  const leftItems = await adaptiveBackfill(symbol, from, mid, fetcher, label);
  await sleep(300);
  const rightItems = await adaptiveBackfill(symbol, addDays(mid, 1), to, fetcher, label);

  return [...leftItems, ...rightItems];
}

// ---------- Company News (/company-news) ----------

export async function pullCompanyNews(
  symbol: string,
  fromOverride?: string,
  toOverride?: string,
): Promise<FinnhubMappedItem[]> {
  const lastPub = await getLastPublishedAt("company_news");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? getEtDateString(new Date());

  return fetchCompanyNewsRaw(symbol, from, to);
}

/**
 * Backfill variant: adaptively splits date ranges to avoid API truncation.
 * Use this for "entire" mode to guarantee completeness.
 */
export async function pullCompanyNewsBackfill(
  symbol: string,
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  return adaptiveBackfill(symbol, from, to, fetchCompanyNewsRaw, "company_news");
}

// ---------- Press Releases (/press-releases) ----------

export async function pullPressReleases(
  symbol: string,
  fromOverride?: string,
  toOverride?: string,
): Promise<FinnhubMappedItem[]> {
  const lastPub = await getLastPublishedAt("press_release");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? formatDate(new Date());

  return fetchPressReleasesRaw(symbol, from, to);
}

/**
 * Backfill variant: adaptively splits date ranges to avoid API truncation.
 * Use this for "entire" mode to guarantee completeness.
 */
export async function pullPressReleasesBackfill(
  symbol: string,
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  return adaptiveBackfill(symbol, from, to, fetchPressReleasesRaw, "press_release");
}

export async function pullMarketNews(
  fromOverride?: string,
  toOverride?: string,
): Promise<FinnhubMappedItem[]> {
  const lastPub = await getLastPublishedAt("market_news");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? formatDate(new Date());
  const result = await pullMarketNewsPaged(from, to);
  return result.items;
}

export async function pullMarketNewsBackfill(
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  const result = await pullMarketNewsPaged(from, to);
  return result.items;
}

export async function pullMarketNewsWithMeta(
  fromOverride?: string,
  toOverride?: string,
  options?: MarketNewsPullOptions,
): Promise<MarketNewsPullResult> {
  const lastPub = await getLastPublishedAt("market_news");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? formatDate(new Date());
  return pullMarketNewsPaged(from, to, options);
}

export async function pullMarketNewsBackfillWithMeta(
  from: string,
  to: string,
  options?: MarketNewsPullOptions,
): Promise<MarketNewsPullResult> {
  return pullMarketNewsPaged(from, to, options);
}

// ---------- Preflight / per-ticker anchor helpers ----------

/**
 * Returns a Set of tickers that already have at least one FINNHUB news item.
 * If sourceType is provided, filters by that source_type.
 */
export async function getTickersWithNews(sourceType?: string): Promise<Set<string>> {
  const condition = sourceType
    ? `WHERE source = 'FINNHUB' AND source_type = ?`
    : `WHERE source = 'FINNHUB'`;
  const params = sourceType ? [sourceType] : [];

  const rows = await getDb().all<{ tickers_csv: string }[]>(
    `SELECT DISTINCT tickers_csv FROM news_items ${condition}`,
    params,
  );

  const tickerSet = new Set<string>();
  for (const row of rows) {
    const tickers = row.tickers_csv
      .split(",")
      .map((s: string) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const t of tickers) tickerSet.add(t);
  }
  return tickerSet;
}

/**
 * Returns a Map of ticker → most recent published_at for that ticker+sourceType.
 * Used for per-ticker incremental (recent) updates.
 * @param source  Defaults to 'FINNHUB'; pass 'RTPR' for RTPR anchor map.
 */
export async function getTickerAnchorMap(
  sourceType: string,
  source: string = "FINNHUB",
): Promise<Map<string, string>> {
  const rows = await getDb().all<{ tickers_csv: string; max_pub: string }[]>(
    `SELECT tickers_csv, MAX(published_at) as max_pub
     FROM news_items
     WHERE source = ? AND source_type = ?
     GROUP BY tickers_csv`,
    [source, sourceType],
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    const tickers = row.tickers_csv
      .split(",")
      .map((s: string) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const t of tickers) {
      const existing = map.get(t);
      if (!existing || row.max_pub > existing) {
        map.set(t, row.max_pub);
      }
    }
  }
  return map;
}

// ---------- Publisher helpers (Step 10) ----------

/**
 * Extract publisher label from a news URL.
 * Known domains are mapped to short labels; unknown domains fall back to
 * the hostname with "www." stripped (e.g. "example.com").
 */
const PUBLISHER_MAP: [test: (h: string) => boolean, label: string][] = [
  [(h) => h.includes("yahoo.com"), "YAHOO FINANCE"],
  [(h) => h.includes("nasdaq.com"), "NASDAQ"],
  [(h) => h.includes("globenewswire.com"), "GLOBENEWSWIRE"],
  [(h) => h.includes("seekingalpha.com"), "SEEKING ALPHA"],
  [(h) => h.includes("fxstreet.com"), "FXSTREET"],
  [(h) => h.includes("u.today"), "U.TODAY"],
  [(h) => h.includes("news.google.com"), "GOOGLE NEWS"],
  [(h) => h.includes("finnhub.io"), "FINNHUB"],
  [(h) => h.includes("tmx.com"), "TMX"],
  [(h) => h.includes("cnbc.com"), "CNBC"],
  [(h) => h.includes("thecurrencyanalytics.com"), "CURRENCY ANALYTICS"],
  [(h) => h.includes("dailyhodl.com"), "DAILY HODL"],
  [(h) => h.includes("bloomberg.com"), "BLOOMBERG"],
  [(h) => h.includes("investorplace.com"), "INVESTORPLACE"],
  [(h) => h.includes("reuters.com"), "REUTERS"],
  [(h) => h.includes("barrons.com"), "BARRONS"],
  [(h) => h.includes("marketwatch.com"), "MARKETWATCH"],
  [(h) => h.includes("wsj.com"), "WSJ"],
  [(h) => h.includes("fool.com"), "MOTLEY FOOL"],
  [(h) => h.includes("businesswire.com"), "BUSINESS WIRE"],
  [(h) => h.includes("prnewswire.com"), "PR NEWSWIRE"],
  [(h) => h.includes("accesswire.com"), "ACCESSWIRE"],
  [(h) => h.includes("benzinga.com"), "BENZINGA"],
  [(h) => h.includes("zacks.com"), "ZACKS"],
  [(h) => h.includes("thestreet.com"), "THE STREET"],
  [(h) => h.includes("investopedia.com"), "INVESTOPEDIA"],
];

export function derivePublisher(url: string): string {
  if (!url) return "UNKNOWN";
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [test, label] of PUBLISHER_MAP) {
      if (test(hostname)) return canonicalizePublisherLabel(label);
    }
    // Fallback: strip "www." and return hostname as-is
    return canonicalizePublisherLabel(hostname.replace(/^www\./, "").toUpperCase());
  } catch {
    return "UNKNOWN";
  }
}

export function canonicalizePublisherLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized) return "UNKNOWN";
  return PUBLISHER_CANONICAL_MAP[normalized] ?? normalized;
}

function inferPublisherFromContent(title: string | null | undefined, body: string | null | undefined): string | null {
  const text = [title, body]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
  if (!text) {
    return null;
  }
  for (const hint of CONTENT_PUBLISHER_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(text))) {
      return hint.publisher;
    }
  }
  return null;
}

function resolveBestPublisher(params: {
  url: string;
  providerSource?: string | null;
  title?: string | null;
  body?: string | null;
  originUrl?: string | null;
}): string {
  const originPublisher = params.originUrl ? derivePublisher(params.originUrl) : "UNKNOWN";
  if (originPublisher !== "UNKNOWN" && originPublisher !== "FINNHUB") {
    return originPublisher;
  }

  const providerPublisher = canonicalizePublisherLabel(params.providerSource);
  if (providerPublisher !== "UNKNOWN" && providerPublisher !== "FINNHUB") {
    return providerPublisher;
  }

  const inferredPublisher = inferPublisherFromContent(params.title, params.body);
  if (inferredPublisher) {
    return inferredPublisher;
  }

  const urlPublisher = derivePublisher(params.url);
  if (urlPublisher !== "UNKNOWN" && urlPublisher !== "FINNHUB") {
    return urlPublisher;
  }

  if (providerPublisher !== "UNKNOWN") {
    return providerPublisher;
  }
  return urlPublisher;
}

/**
 * Backfill publisher column for all news_items where publisher IS NULL or 'UNKNOWN'.
 * Returns the number of rows updated.
 */
export async function backfillPublisher(): Promise<number> {
  const rows = await getDb().all<{ id: string; url: string; origin_url: string | null; publisher: string | null; title: string | null; body: string | null; source_type: string | null }[]>(
    `SELECT id, url, origin_url, publisher, title, body, source_type
       FROM news_items
      WHERE publisher IS NULL
         OR publisher = 'UNKNOWN'
         OR (publisher = 'FINNHUB' AND (
              (origin_url IS NOT NULL AND TRIM(origin_url) <> '')
              OR source_type = 'company_news'
            ))`,
  );
  let updated = 0;
  for (const row of rows) {
    const publisher = resolveBestPublisher({
      url: row.url,
      providerSource: row.publisher,
      title: row.title,
      body: row.body,
      originUrl: row.origin_url,
    });
    const currentPublisher = canonicalizePublisherLabel(row.publisher);
    if (publisher === currentPublisher) {
      continue;
    }
    await getDb().run(`UPDATE news_items SET publisher = ? WHERE id = ?`, [publisher, row.id]);
    updated++;
  }
  return updated;
}

// ---------- Finnhub news-sentiment (symbol-level aggregate) ----------

export type SentimentSnapshot = {
  ticker: string;
  asofDate: string;
  buzzArticlesInLastWeek: number | null;
  buzzWeeklyAverage: number | null;
  buzz: number | null;
  companyNewsScore: number | null;
  sectorAvgBullishPct: number | null;
  sectorAvgNewsScore: number | null;
  sentimentBullishPct: number | null;
  sentimentBearishPct: number | null;
};

/**
 * Fetch symbol-level sentiment from Finnhub `news-sentiment` endpoint.
 * Returns null if the response is empty or the ticker has no data.
 */
export async function fetchSentimentSnapshot(symbol: string): Promise<SentimentSnapshot | null> {
  const url = `${FINNHUB_BASE}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);

  if (!raw || !raw.symbol) return null;

  const today = new Date().toISOString().slice(0, 10);
  return {
    ticker: raw.symbol?.toUpperCase() ?? symbol.toUpperCase(),
    asofDate: today,
    buzzArticlesInLastWeek: raw.buzz?.articlesInLastWeek ?? null,
    buzzWeeklyAverage: raw.buzz?.weeklyAverage ?? null,
    buzz: raw.buzz?.buzz ?? null,
    companyNewsScore: raw.companyNewsScore ?? null,
    sectorAvgBullishPct: raw.sectorAverageBullishPercent ?? null,
    sectorAvgNewsScore: raw.sectorAverageNewsScore ?? null,
    sentimentBullishPct: raw.sentiment?.bullishPercent ?? null,
    sentimentBearishPct: raw.sentiment?.bearishPercent ?? null,
  };
}

/**
 * Fetch and upsert sentiment snapshot for a single ticker.
 * Returns true if a row was written, false if no data.
 */
export async function upsertSentimentSnapshot(symbol: string): Promise<boolean> {
  const snapshot = await fetchSentimentSnapshot(symbol);
  if (!snapshot) return false;

  await getDb().run(
    `INSERT INTO news_sentiment_snapshots
       (ticker, asof_date, buzz_articles_in_last_week, buzz_weekly_average, buzz,
        company_news_score, sector_avg_bullish_pct, sector_avg_news_score,
        sentiment_bullish_pct, sentiment_bearish_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker, asof_date) DO UPDATE SET
       buzz_articles_in_last_week = excluded.buzz_articles_in_last_week,
       buzz_weekly_average = excluded.buzz_weekly_average,
       buzz = excluded.buzz,
       company_news_score = excluded.company_news_score,
       sector_avg_bullish_pct = excluded.sector_avg_bullish_pct,
       sector_avg_news_score = excluded.sector_avg_news_score,
       sentiment_bullish_pct = excluded.sentiment_bullish_pct,
       sentiment_bearish_pct = excluded.sentiment_bearish_pct,
       fetched_at = datetime('now')`,
    [
      snapshot.ticker,
      snapshot.asofDate,
      snapshot.buzzArticlesInLastWeek,
      snapshot.buzzWeeklyAverage,
      snapshot.buzz,
      snapshot.companyNewsScore,
      snapshot.sectorAvgBullishPct,
      snapshot.sectorAvgNewsScore,
      snapshot.sentimentBullishPct,
      snapshot.sentimentBearishPct,
    ],
  );
  return true;
}

// ---------- Confirmed-empty range helpers ----------

/**
 * Record that a ticker + source_type returned HTTP 200 + empty array
 * for a date range. Only call this when you're sure the response was valid.
 */
export async function recordConfirmedEmpty(
  ticker: string,
  sourceType: string,
  rangeFrom: string,
  rangeTo: string,
): Promise<void> {
  await getDb().run(
    `INSERT INTO confirmed_empty_ranges (ticker, source_type, range_from, range_to)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(ticker, source_type) DO UPDATE SET
       range_from = CASE WHEN excluded.range_from < confirmed_empty_ranges.range_from
                         THEN excluded.range_from ELSE confirmed_empty_ranges.range_from END,
       range_to = CASE WHEN excluded.range_to > confirmed_empty_ranges.range_to
                       THEN excluded.range_to ELSE confirmed_empty_ranges.range_to END,
       confirmed_at = datetime('now')`,
    [ticker.toUpperCase(), sourceType, rangeFrom, rangeTo],
  );
}

/**
 * Get confirmed-empty range for a ticker + source_type.
 * Returns null if no confirmed-empty record exists.
 */
export async function getConfirmedEmptyRange(
  ticker: string,
  sourceType: string,
): Promise<{ rangeFrom: string; rangeTo: string } | null> {
  const row = await getDb().get<{ range_from: string; range_to: string }>(
    `SELECT range_from, range_to FROM confirmed_empty_ranges
     WHERE ticker = ? AND source_type = ?`,
    [ticker.toUpperCase(), sourceType],
  );
  return row ? { rangeFrom: row.range_from, rangeTo: row.range_to } : null;
}
