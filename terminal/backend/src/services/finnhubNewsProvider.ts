import { config } from "../config.js";
import { getDb } from "../db.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

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
  }));
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
 * www.nasdaq.com → NASDAQ, money.tmx.com → TMX, finnhub.io → FINNHUB, else → UNKNOWN
 */
export function derivePublisher(url: string): string {
  if (!url) return "UNKNOWN";
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("nasdaq.com")) return "NASDAQ";
    if (hostname.includes("tmx.com")) return "TMX";
    if (hostname.includes("finnhub.io")) return "FINNHUB";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Backfill publisher column for all news_items where publisher IS NULL.
 * Returns the number of rows updated.
 */
export async function backfillPublisher(): Promise<number> {
  const rows = await getDb().all<{ id: string; url: string }[]>(
    `SELECT id, url FROM news_items WHERE publisher IS NULL`,
  );
  let updated = 0;
  for (const row of rows) {
    const publisher = derivePublisher(row.url);
    await getDb().run(`UPDATE news_items SET publisher = ? WHERE id = ?`, [publisher, row.id]);
    updated++;
  }
  return updated;
}
