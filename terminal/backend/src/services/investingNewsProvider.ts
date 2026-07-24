/**
 * investingNewsProvider.ts — Investing.com category page scraper
 *
 * Fetches article listings from Investing category pages (HTML parse).
 * Categories: stock-market-news, cryptocurrency-news
 */

import * as cheerio from "cheerio";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";
import { getInvestingBrowserContext, isCloudflareChallengeText, resetInvestingBrowserProfile, waitForChallengeClear } from "./investingBrowser.js";
import { toEtNaiveIso } from "./timeUtils.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const BROWSER_TIMEOUT_MS = 15_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";

export type InvestingCategory = "stock-market-news" | "cryptocurrency-news";

export interface InvestingFetchOptions {
  maxPages?: number;
  requestIntervalMs?: number;
  fromDate?: string;
  toDate?: string;
  /**
   * Incremental "recent" watermark (ET-naive ISO, e.g. "2026-07-23T15:00:00").
   * When set, the walk stops as soon as it reaches an article strictly older
   * than this timestamp — i.e. the newest article already stored in the DB —
   * so a daily recent pull only fetches what appeared since the last run.
   * Articles at or newer than the watermark are still collected (URL dedup at
   * insert time drops the boundary article we already have). Leave unset for
   * custom pulls, which must cover the whole requested date range regardless
   * of what is already stored (so interior gaps get filled).
   */
  sinceTimestamp?: string;
  onLog?: (message: string) => void;
  shouldCancel?: () => boolean;
}

let investingHtmlLoaderForTests: ((url: string) => Promise<string>) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429) {
        const backoffMs = Math.min(
          BASE_DELAY_MS * Math.pow(2, attempt - 1),
          MAX_BACKOFF_MS,
        );
        await sleep(backoffMs);
        continue;
      }
      return res;
    } catch (err: any) {
      const isRetryable =
        err instanceof TypeError ||
        /timeout|network|ECONNRESET/i.test(err?.message ?? "");
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err;
      }
      await sleep(
        Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS),
      );
    }
  }
  throw new Error(`fetchWithRetry: exhausted ${MAX_RETRIES} attempts for ${url}`);
}

export function investingCategoryToSourceType(
  category: InvestingCategory,
): string {
  return category === "stock-market-news"
    ? "investing_stock_market_news"
    : "investing_cryptocurrency_news";
}

// Investing articles reference US-listed companies as "(NASDAQ:AAPL)" / "(NYSE:BRK.A)".
const INVESTING_TICKER_EXCHANGES = new Set([
  "NYSE",
  "NASDAQ",
  "AMEX",
  "NYSEAMERICAN",
  "BATS",
  "CBOE",
]);
const INVESTING_TICKER_PATTERN = /\(\s*([A-Z]{2,13})\s*:\s*([A-Z][A-Z0-9.\-]{0,9})\s*\)/g;

/**
 * Extract US-exchange ticker symbols mentioned in Investing article text
 * (title, listing snippet, or extracted full text).
 */
export function extractInvestingTickers(text: string | null | undefined): string[] {
  if (!text) return [];
  const tickers = new Set<string>();
  for (const match of text.matchAll(INVESTING_TICKER_PATTERN)) {
    if (!INVESTING_TICKER_EXCHANGES.has(match[1])) continue;
    tickers.add(match[2]);
  }
  return Array.from(tickers);
}

function isCloudflareChallengeHtml(html: string): boolean {
  return isCloudflareChallengeText(html);
}

async function loadPageHtmlInBrowser(url: string): Promise<string> {
  if (investingHtmlLoaderForTests) {
    return investingHtmlLoaderForTests(url);
  }

  throw new Error("loadPageHtmlInBrowser should only be used with test loader");
}

/** Thrown when Cloudflare serves a bare 403 hard block (poisoned cf_clearance). */
class CloudflareHardBlockError extends Error {
  constructor() {
    super("Cloudflare hard block (HTTP 403) — poisoned clearance cookie");
    this.name = "CloudflareHardBlockError";
  }
}

/** Thrown when a managed challenge is shown but did not clear within the wait. */
class CloudflareChallengeError extends Error {
  constructor() {
    super("Cloudflare challenge did not clear within the wait window");
    this.name = "CloudflareChallengeError";
  }
}

/** Thrown when repeated blocks make clear the IP itself is flagged. */
class InvestingIpFlaggedError extends Error {
  constructor(resets: number) {
    super(
      `Investing.com is repeatedly challenging this connection (${resets} profile resets) — ` +
        `the IP appears rate-limited/flagged by Cloudflare. Stop for a while (or switch network) and retry later.`,
    );
    this.name = "InvestingIpFlaggedError";
  }
}

const BLOCK_RETRY_MAX = 6;
const BLOCK_RETRY_BASE_MS = 3_000;
// When blocks persist (rate-limiting, not a one-off poisoned cookie), backing
// off gives Cloudflare's rate window time to recover. Resetting the profile
// instead just fires MORE requests (a fresh challenge solve), which digs the
// hole deeper — so after the first reset we back off with growing delays.
const BLOCK_BACKOFF_STEP_MS = 20_000;
const BLOCK_BACKOFF_MAX_MS = 90_000;
// Each block also permanently slows the rest of the pull: the IP is getting
// sensitive, so widen the gap between page requests to stay under the limit.
const ADAPTIVE_SLOWDOWN_STEP_MS = 3_000;
const ADAPTIVE_SLOWDOWN_MAX_MS = 20_000;

/** Shared across one fetchInvestingCategory call: adaptive pacing + flag detection. */
interface BlockState {
  resets: number;
  maxResets: number;
  /** Extra delay added to every inter-page request after blocks appear. */
  extraDelayMs: number;
}

async function loadPageItemsInBrowser(
  category: InvestingCategory,
  url: string,
  blockState: BlockState,
  onLog?: (message: string) => void,
): Promise<FinnhubMappedItem[]> {
  // Cloudflare serves either a bare 403 (poisoned cf_clearance cookie) or a
  // managed challenge that didn't auto-solve. Recovery escalates: one fresh
  // profile (fixes a poisoned cookie); if the block PERSISTS it's rate-limiting,
  // so we stop resetting and back off with growing delays to let the IP cool.
  for (let attempt = 1; ; attempt++) {
    try {
      return await loadPageItemsInBrowserOnce(category, url);
    } catch (err) {
      const isBlock = err instanceof CloudflareHardBlockError || err instanceof CloudflareChallengeError;
      if (!isBlock || attempt >= BLOCK_RETRY_MAX) {
        throw err;
      }
      const kind = err instanceof CloudflareHardBlockError ? "Cloudflare 403" : "Cloudflare challenge";
      // Every block permanently slows the remaining walk.
      blockState.extraDelayMs = Math.min(blockState.extraDelayMs + ADAPTIVE_SLOWDOWN_STEP_MS, ADAPTIVE_SLOWDOWN_MAX_MS);

      // Attempt 1: a fresh profile in case the cookie is merely poisoned.
      // Attempt 2+: the block is persisting → rate-limit → back off, no reset.
      const shouldReset = attempt === 1;
      if (shouldReset) {
        blockState.resets += 1;
        if (blockState.resets > blockState.maxResets) {
          throw new InvestingIpFlaggedError(blockState.resets);
        }
        onLog?.(`${kind} on ${url} — resetting profile (attempt ${attempt}/${BLOCK_RETRY_MAX})`);
        await resetInvestingBrowserProfile();
        await sleep(BLOCK_RETRY_BASE_MS);
        continue;
      }

      const backoff = Math.min(BLOCK_BACKOFF_STEP_MS * (attempt - 1), BLOCK_BACKOFF_MAX_MS);
      onLog?.(`${kind} persists on ${url} — backing off ${Math.round(backoff / 1000)}s to let the IP cool (attempt ${attempt}/${BLOCK_RETRY_MAX})`);
      await sleep(backoff);
      continue;
    }
  }
}

async function loadPageItemsInBrowserOnce(
  category: InvestingCategory,
  url: string,
): Promise<FinnhubMappedItem[]> {
  const context = await getInvestingBrowserContext();
  const page = await context.newPage();

  const sourceType = investingCategoryToSourceType(category);

  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    await waitForChallengeClear(page);
    if (response && response.status() === 403) {
      const html = await page.content().catch(() => "");
      // Cloudflare hard block serves a bare "403" body with no challenge to solve.
      if (html.length < 1000) {
        throw new CloudflareHardBlockError();
      }
    }
    // Wait only for the article anchors themselves — no networkidle (investing
    // streams background requests for minutes) and only a short settle after,
    // which is the biggest per-page speedup.
    await page.waitForSelector('a[data-test="article-title-link"], article[data-test="article-item"], ul[data-test="news-list"]', {
      timeout: 15_000,
    }).catch(() => undefined);
    await page.waitForTimeout(300).catch(() => undefined);

    const items = await page.evaluate(({ currentCategory, currentSourceType }) => {
      const anchors = Array.from(document.querySelectorAll(`a[data-test="article-title-link"][href*="/news/${currentCategory}/"]`));
      const seenUrls = new Set<string>();

      return anchors
        .map((anchor) => {
          const href = anchor.getAttribute("href") || "";
          const url = href.startsWith("http") ? href : `https://www.investing.com${href}`;
          const title = (anchor.textContent || "").trim();
          const container = anchor.closest('article[data-test="article-item"], article, li, div');
          const description = (container?.querySelector('[data-test="article-description"]')?.textContent || container?.querySelector("p")?.textContent || "").trim();
          const timeNode = container?.querySelector('[data-test="article-publish-date"], time');
          const rawTime = (timeNode?.getAttribute("datetime") || timeNode?.textContent || "").trim();
          const provider = (container?.querySelector('[data-test="news-provider-name"]')?.textContent || "INVESTING").trim();

          return {
            title,
            url,
            body: description,
            rawTime,
            provider,
            sourceType: currentSourceType,
            tags: [currentCategory],
          };
        })
        .filter((item) => {
          if (!item.title || !item.url) return false;
          if (!item.url.includes(`/news/${currentCategory}/`)) return false;
          if (seenUrls.has(item.url)) return false;
          seenUrls.add(item.url);
          return true;
        });
    }, { currentCategory: category, currentSourceType: sourceType });

    if (items.length === 0) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const pageTitle = await page.title().catch(() => "");
      if (isCloudflareChallengeText(`${pageTitle}\n${bodyText}`)) {
        throw new CloudflareChallengeError();
      }
    }

    return items.map((item) => ({
      publishedAt: normalizeInvestingDate(item.rawTime),
      source: "INVESTING",
      sourceType: item.sourceType,
      title: item.title,
      body: item.body,
      url: item.url,
      providerTickers: [],
      tags: item.tags,
      publisher: item.provider || "INVESTING",
    }));
  } finally {
    await page.close().catch(() => undefined);
  }
}

export function setInvestingHtmlLoaderForTests(loader: ((url: string) => Promise<string>) | null): void {
  investingHtmlLoaderForTests = loader;
}

/**
 * Parse a single Investing category listing page and extract article metadata.
 */
function parseListingPage(
  html: string,
  category: InvestingCategory,
): FinnhubMappedItem[] {
  const $ = cheerio.load(html);
  const items: FinnhubMappedItem[] = [];
  const sourceType = investingCategoryToSourceType(category);

  // Investing article cards are rendered as <article> elements or <div> with data-test attributes.
  // Multiple selector strategies to handle layout variations:
  const articleSelectors = [
    "article[data-test='article-item']",
    "article.js-article-item",
    "div[data-test='article-item']",
    "a.js-article-item",
    // Fallback: find all links inside a news list container
    ".largeTitle .articleItem",
    "#leftColumn article",
    "#__next article",
  ];

  // Also try collecting from generic <a> tags within known listing containers
  const linkElements: Array<{ title: string; url: string; time: string; summary: string }> = [];

  for (const selector of articleSelectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);
      // Try to extract title and URL
      const $titleLink =
        $el.find("a[data-test='article-title-link']").first() ||
        $el.find("a.title").first() ||
        $el.find("a").first();

      const href = $titleLink.attr("href") || "";
      const title = $titleLink.text().trim() || $el.find("a").first().text().trim();

      if (!title || !href) return;

      // Build absolute URL
      let fullUrl = href;
      if (href.startsWith("/")) {
        fullUrl = `https://www.investing.com${href}`;
      } else if (!href.startsWith("http")) {
        return; // skip ad/tracker links
      }

      // Extract publication time
      const timeEl =
        $el.find("time").first().attr("datetime") ||
        $el.find("[data-test='article-publish-date']").first().text().trim() ||
        $el.find(".date").first().text().trim() ||
        "";

      // Extract summary/snippet
      const summary =
        $el.find("[data-test='article-description']").first().text().trim() ||
        $el.find("p").first().text().trim() ||
        "";

      linkElements.push({ title, url: fullUrl, time: timeEl, summary });
    });

    if (linkElements.length > 0) break; // stop at first working selector
  }

  // Dedupe by URL
  const seenUrls = new Set<string>();
  for (const el of linkElements) {
    if (seenUrls.has(el.url)) continue;
    seenUrls.add(el.url);

    const publishedAt = normalizeInvestingDate(el.time);

    items.push({
      publishedAt,
      source: "INVESTING",
      sourceType,
      title: el.title,
      body: el.summary,
      url: el.url,
      providerTickers: [],
      tags: [category],
      publisher: "INVESTING",
    });
  }

  return items;
}

/**
 * Normalize the various date formats that Investing.com uses.
 * Handles ISO datetime, relative strings like "5 hours ago", or formatted dates.
 */
function normalizeInvestingDate(raw: string): string {
  if (!raw || !raw.trim()) {
    return toEtNaiveIso(new Date());
  }
  const trimmed = raw.trim();

  // ISO 8601 with timezone
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    try {
      return toEtNaiveIso(trimmed);
    } catch {
      return trimmed.slice(0, 19);
    }
  }

  // "YYYY-MM-DD HH:MM:SS" format
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return toEtNaiveIso(`${trimmed.replace(" ", "T")}Z`);
  }

  // Relative time: "X hours ago", "X minutes ago", etc.
  const relMatch = trimmed.match(/^(\d+)\s+(minute|hour|day|week|month)s?\s+ago$/i);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const now = Date.now();
    let ms = 0;
    if (unit === "minute") ms = amount * 60_000;
    else if (unit === "hour") ms = amount * 3_600_000;
    else if (unit === "day") ms = amount * 86_400_000;
    else if (unit === "week") ms = amount * 7 * 86_400_000;
    else if (unit === "month") ms = amount * 30 * 86_400_000;
    return toEtNaiveIso(new Date(now - ms));
  }

  // Try generic Date parse
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return toEtNaiveIso(parsed);
  }

  return toEtNaiveIso(new Date());
}

// Date-jump search bounds: probing is only used to locate the page where the
// requested range STARTS; collection always walks pages sequentially from
// slightly before that page, so no article inside the range can be skipped.
const START_PAGE_SAFETY_MARGIN = 2;
const MAX_PROBE_PAGE = 5000;

/**
 * Locate the first listing page that reaches into the requested range
 * (i.e. contains an article dated <= toDate) using exponential probing
 * followed by a binary search. Listing pages are ordered newest-first, so
 * page dates decrease as the page number grows.
 *
 * Returns the page to START the sequential walk from (with a safety margin
 * subtracted). Falls back to page 1 on any probe failure.
 */
async function findRangeStartPage(
  loadPage: (page: number) => Promise<FinnhubMappedItem[]>,
  toDate: string,
  onLog?: (message: string) => void,
): Promise<number> {
  const pageOldestDate = async (page: number): Promise<string | null> => {
    const items = await loadPage(page);
    if (items.length === 0) return null; // beyond the end of the listing
    let oldest = "";
    for (const item of items) {
      const date = item.publishedAt.slice(0, 10);
      if (date && (!oldest || date < oldest)) oldest = date;
    }
    return oldest || null;
  };

  try {
    let oldest = await pageOldestDate(1);
    if (oldest === null || oldest <= toDate) {
      return 1;
    }

    // Exponential probing: 1 → 2 → 4 → 8 → ... until a page reaches the range.
    let lo = 1; // known: page lo is entirely newer than the range
    let hi = 2;
    for (;;) {
      oldest = await pageOldestDate(hi);
      onLog?.(`probe page ${hi}: oldest=${oldest ?? "empty"}`);
      if (oldest === null || oldest <= toDate) break;
      if (hi >= MAX_PROBE_PAGE) {
        onLog?.(`range start is deeper than page ${MAX_PROBE_PAGE}; walking from there`);
        return MAX_PROBE_PAGE;
      }
      lo = hi;
      hi = Math.min(hi * 2, MAX_PROBE_PAGE);
    }

    // Binary search the smallest page in (lo, hi] that reaches the range.
    while (lo + 1 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      oldest = await pageOldestDate(mid);
      onLog?.(`probe page ${mid}: oldest=${oldest ?? "empty"}`);
      if (oldest === null || oldest <= toDate) hi = mid;
      else lo = mid;
    }

    return Math.max(1, hi - START_PAGE_SAFETY_MARGIN);
  } catch (err: any) {
    if (err instanceof InvestingIpFlaggedError) throw err;
    onLog?.(`page probing failed (${err?.message ?? "unknown"}); falling back to sequential walk from page 1`);
    return 1;
  }
}

/**
 * Fetch articles from an Investing.com category across multiple pages.
 *
 * When a toDate is given, first locates the page where the range starts via
 * date-jump probing, then walks pages one by one (no skipping) until the
 * range is exhausted, so deep historical ranges are reachable without
 * fetching every page in between.
 */
export async function fetchInvestingCategory(
  category: InvestingCategory,
  options: InvestingFetchOptions = {},
): Promise<FinnhubMappedItem[]> {
  const maxPages = Math.max(1, Math.min(Math.floor(options.maxPages ?? 5), 1000));
  const requestIntervalMs = Math.max(
    0,
    Math.min(Math.floor(options.requestIntervalMs ?? 1000), 10_000),
  );
  const fromDate = options.fromDate?.trim() || "";
  const toDate = options.toDate?.trim() || "";
  const sinceTimestamp = options.sinceTimestamp?.trim() || "";
  const onLog = options.onLog;
  const shouldCancel = options.shouldCancel ?? (() => false);

  const pageCache = new Map<number, FinnhubMappedItem[]>();
  let useBrowser = false;
  let requestCount = 0;
  const blockState: BlockState = { resets: 0, maxResets: 6, extraDelayMs: 0 };

  const loadPage = async (page: number): Promise<FinnhubMappedItem[]> => {
    const cached = pageCache.get(page);
    if (cached) return cached;

    if (requestCount > 0) {
      // Base interval + adaptive slowdown that grows as blocks appear, plus
      // jitter (perfectly regular timing is itself a bot signal). Slowing down
      // is what keeps a long custom pull under Cloudflare's rate limit.
      const base = requestIntervalMs + blockState.extraDelayMs;
      if (base > 0) {
        await sleep(base + Math.floor(Math.random() * requestIntervalMs * 0.5));
      }
    }
    requestCount++;

    const pageUrl =
      page === 1
        ? `https://www.investing.com/news/${category}`
        : `https://www.investing.com/news/${category}/${page}`;

    let html = "";
    let pageItems: FinnhubMappedItem[] = [];
    if (useBrowser) {
      if (investingHtmlLoaderForTests) {
        html = await loadPageHtmlInBrowser(pageUrl);
        pageItems = parseListingPage(html, category);
      } else {
        pageItems = await loadPageItemsInBrowser(category, pageUrl, blockState, onLog);
      }
    } else {
      const res = await fetchWithRetry(pageUrl, {
        headers: {
          "User-Agent": UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (!res.ok && res.status !== 403 && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }

      const candidateHtml = await res.text();
      if (!res.ok || isCloudflareChallengeHtml(candidateHtml)) {
        useBrowser = true;
        if (investingHtmlLoaderForTests) {
          html = await loadPageHtmlInBrowser(pageUrl);
          pageItems = parseListingPage(html, category);
        } else {
          pageItems = await loadPageItemsInBrowser(category, pageUrl, blockState, onLog);
        }
      } else {
        html = candidateHtml;
        pageItems = parseListingPage(html, category);
      }
    }

    if (html && isCloudflareChallengeHtml(html)) {
      throw new Error("Cloudflare challenge page returned even after browser fallback");
    }

    pageCache.set(page, pageItems);
    return pageItems;
  };

  const allItems: FinnhubMappedItem[] = [];
  const seenUrls = new Set<string>();
  let consecutiveEmptyPages = 0;
  let reachedOlderThanFrom = false;
  let reachedWatermark = false;

  let startPage = 1;
  if (toDate) {
    if (shouldCancel()) return allItems;
    try {
      startPage = await findRangeStartPage(loadPage, toDate, onLog);
    } catch (err: any) {
      // Flagged IP during date-jump probing — keep whatever we already have.
      if (err instanceof InvestingIpFlaggedError) {
        onLog?.(`${err.message} (stopped during probing with ${allItems.length} items)`);
        return allItems;
      }
      throw err;
    }
    if (startPage > 1) {
      onLog?.(`date-jump: starting walk at page ${startPage} for to=${toDate}`);
    }
  }

  for (let offset = 0; offset < maxPages; offset++) {
    if (shouldCancel()) {
      onLog?.("cancelled — stopping page walk");
      break;
    }
    const page = startPage + offset;

    let pageItems: FinnhubMappedItem[];
    try {
      pageItems = await loadPage(page);
    } catch (err: any) {
      // A flagged IP won't recover within this run — stop, but KEEP what we
      // already collected (don't fail the whole job) and log the reason so the
      // user knows to switch network / retry later.
      if (err instanceof InvestingIpFlaggedError) {
        onLog?.(`${err.message} (kept ${allItems.length} items collected before stopping)`);
        break;
      }
      console.error(
        `[investing] ${category} page ${page}: ${err.message}`,
      );
      break;
    }

    const filteredPageItems: FinnhubMappedItem[] = [];
    let newerThanRangeCount = 0;

    for (const item of pageItems) {
      const publishedDate = item.publishedAt.slice(0, 10);
      if (!publishedDate) {
        continue;
      }
      if (fromDate && publishedDate < fromDate) {
        reachedOlderThanFrom = true;
        continue;
      }
      if (toDate && publishedDate > toDate) {
        newerThanRangeCount++;
        continue;
      }
      if (sinceTimestamp && item.publishedAt < sinceTimestamp) {
        // Incremental (recent) stop: this article is older than the newest one
        // already stored, so everything below it is already in the DB. Collect
        // the newer items on this page, then stop the walk after the page.
        reachedWatermark = true;
        continue;
      }
      filteredPageItems.push(item);
    }

    if (filteredPageItems.length === 0) {
      if (reachedWatermark) {
        onLog?.(`already up to date — reached stored articles (<= ${sinceTimestamp})`);
        break;
      }
      if (reachedOlderThanFrom) {
        break;
      }
      if (newerThanRangeCount > 0) {
        // Page only holds articles newer than the requested range — keep
        // paging deeper until we reach the range instead of treating this
        // as an empty page (fixes custom updates for past date ranges).
        consecutiveEmptyPages = 0;
        continue;
      }
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= 2) {
        break; // stop after 2 consecutive empty pages
      }
      continue;
    }

    consecutiveEmptyPages = 0;

    for (const item of filteredPageItems) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }

    // Progress log so a long walk is observable (successful pages are otherwise
    // silent until the whole category finishes).
    const oldestOnPage = filteredPageItems[filteredPageItems.length - 1]?.publishedAt.slice(0, 10) ?? "";
    onLog?.(`page ${page}: +${filteredPageItems.length} in range (down to ${oldestOnPage}), ${allItems.length} total`);

    if (reachedWatermark) {
      onLog?.(`reached stored articles (<= ${sinceTimestamp}) — stopping incremental walk`);
      break;
    }
    if (reachedOlderThanFrom) {
      break;
    }
  }

  return allItems;
}

/**
 * Fetch all Investing categories and return combined results.
 */
export async function fetchAllInvestingCategories(
  categories: InvestingCategory[],
  options: InvestingFetchOptions = {},
): Promise<FinnhubMappedItem[]> {
  const allItems: FinnhubMappedItem[] = [];
  for (const category of categories) {
    const items = await fetchInvestingCategory(category, options);
    allItems.push(...items);
  }
  return allItems;
}
