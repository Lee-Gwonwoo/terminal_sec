import { config } from "../config.js";
import { getDb } from "../db.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const MARKET_NEWS_CATEGORY = "general";
const MARKET_NEWS_PAGE_DELAY_MS = 250;
const MARKET_NEWS_MAX_PAGES = 30;

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
};

// ---------- Helpers ----------

function toIsoDate(epoch: number): string {
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
    const d = new Date(lastPublished);
    return formatDate(d);
  }
  // First time: lookback N days
  const d = new Date();
  d.setDate(d.getDate() - lookbackDays);
  return formatDate(d);
}

// ---------- Raw fetch helpers (single request, no splitting) ----------

export async function fetchCompanyNewsRaw(
  symbol: string,
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);
  if (!Array.isArray(raw)) return [];

  return raw.map((item: any) => ({
    publishedAt: item.datetime ? toIsoDate(item.datetime) : new Date().toISOString(),
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
    publisher: item.source ? String(item.source).toUpperCase() : derivePublisher(item.url ?? ""),
  }));
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
    publishedAt: item.datetime ? toIsoDate(item.datetime) : new Date().toISOString(),
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
    publisher: item.source ? String(item.source).toUpperCase() : derivePublisher(item.url ?? ""),
  }));

  return {
    items: mapped,
    nextMinId: getMinRawId(raw),
    oldestPublishedAt: getOldestPublishedAt(mapped),
  };
}

async function pullMarketNewsPaged(from: string, to: string): Promise<FinnhubMappedItem[]> {
  const results: FinnhubMappedItem[] = [];
  const seenUrls = new Set<string>();
  const seenMinIds = new Set<string>();
  let minId: string | undefined;

  for (let page = 0; page < MARKET_NEWS_MAX_PAGES; page++) {
    const pageResult = await fetchMarketNewsPageRaw(MARKET_NEWS_CATEGORY, minId);
    if (pageResult.items.length === 0) {
      break;
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
    }

    if (!pageResult.nextMinId || seenMinIds.has(pageResult.nextMinId)) {
      break;
    }
    if (pageResult.oldestPublishedAt && pageResult.oldestPublishedAt < `${from}T00:00:00.000Z`) {
      break;
    }

    seenMinIds.add(pageResult.nextMinId);
    minId = pageResult.nextMinId;
    await sleep(MARKET_NEWS_PAGE_DELAY_MS);
  }

  return results;
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
  const to = toOverride ?? formatDate(new Date());

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
  return pullMarketNewsPaged(from, to);
}

export async function pullMarketNewsBackfill(
  from: string,
  to: string,
): Promise<FinnhubMappedItem[]> {
  return pullMarketNewsPaged(from, to);
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
 */
export async function getTickerAnchorMap(
  sourceType: string,
): Promise<Map<string, string>> {
  const rows = await getDb().all<{ tickers_csv: string; max_pub: string }[]>(
    `SELECT tickers_csv, MAX(published_at) as max_pub
     FROM news_items
     WHERE source = 'FINNHUB' AND source_type = ?
     GROUP BY tickers_csv`,
    [sourceType],
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
      if (test(hostname)) return label;
    }
    // Fallback: strip "www." and return hostname as-is
    return hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Backfill publisher column for all news_items where publisher IS NULL or 'UNKNOWN'.
 * Returns the number of rows updated.
 */
export async function backfillPublisher(): Promise<number> {
  const rows = await getDb().all<{ id: string; url: string }[]>(
    `SELECT id, url FROM news_items WHERE publisher IS NULL OR publisher = 'UNKNOWN'`,
  );
  let updated = 0;
  for (const row of rows) {
    const publisher = derivePublisher(row.url);
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
