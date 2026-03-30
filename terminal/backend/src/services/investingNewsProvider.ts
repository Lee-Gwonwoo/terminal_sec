/**
 * investingNewsProvider.ts — Investing.com category page scraper
 *
 * Fetches article listings from Investing category pages (HTML parse).
 * Categories: stock-market-news, cryptocurrency-news
 */

import * as cheerio from "cheerio";
import fs from "node:fs";
import { chromium, type Browser } from "playwright";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";
import { toEtNaiveIso } from "./timeUtils.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const BROWSER_TIMEOUT_MS = 15_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";

const BROWSER_CANDIDATE_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export type InvestingCategory = "stock-market-news" | "cryptocurrency-news";

export interface InvestingFetchOptions {
  maxPages?: number;
  requestIntervalMs?: number;
  fromDate?: string;
  toDate?: string;
}

let sharedBrowserPromise: Promise<Browser> | null = null;
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

function findBrowserExecutable(): string | undefined {
  return BROWSER_CANDIDATE_PATHS.find((candidate) => fs.existsSync(candidate));
}

function isCloudflareChallengeHtml(html: string): boolean {
  const markers = [
    "Enable JavaScript and cookies to continue",
    "challenge-error-text",
    "cf_chl_opt",
    "cdn-cgi/challenge-platform",
    "Just a moment...",
  ];
  return markers.some((marker) => html.includes(marker));
}

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = (async () => {
      const executablePath = findBrowserExecutable();
      if (executablePath) {
        return chromium.launch({
          executablePath,
          headless: true,
        });
      }
      try {
        return await chromium.launch({ channel: "chrome", headless: true });
      } catch {
        try {
          return await chromium.launch({ channel: "msedge", headless: true });
        } catch {
          return chromium.launch({ headless: true });
        }
      }
    })();
  }
  return sharedBrowserPromise;
}

async function loadPageHtmlInBrowser(url: string): Promise<string> {
  if (investingHtmlLoaderForTests) {
    return investingHtmlLoaderForTests(url);
  }

  throw new Error("loadPageHtmlInBrowser should only be used with test loader");
}

async function loadPageItemsInBrowser(
  category: InvestingCategory,
  url: string,
): Promise<FinnhubMappedItem[]> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: `${UA} Safari/537.36`,
    locale: "en-US",
  });

  const sourceType = investingCategoryToSourceType(category);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    await page.waitForURL((currentUrl) => !currentUrl.toString().includes("__cf_chl"), {
      timeout: 15_000,
    }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    await page.waitForSelector('a[data-test="article-title-link"], article[data-test="article-item"], ul[data-test="news-list"]', {
      timeout: 15_000,
    }).catch(() => undefined);
    await page.waitForTimeout(1500).catch(() => undefined);

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
      if (isCloudflareChallengeHtml(bodyText)) {
        throw new Error("Cloudflare challenge page returned even after browser fallback");
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

/**
 * Fetch articles from an Investing.com category across multiple pages.
 */
export async function fetchInvestingCategory(
  category: InvestingCategory,
  options: InvestingFetchOptions = {},
): Promise<FinnhubMappedItem[]> {
  const maxPages = Math.max(1, Math.min(Math.floor(options.maxPages ?? 5), 50));
  const requestIntervalMs = Math.max(
    0,
    Math.min(Math.floor(options.requestIntervalMs ?? 1000), 10_000),
  );
  const fromDate = options.fromDate?.trim() || "";
  const toDate = options.toDate?.trim() || "";

  const allItems: FinnhubMappedItem[] = [];
  const seenUrls = new Set<string>();
  let consecutiveEmptyPages = 0;
  let reachedOlderThanFrom = false;
  let useBrowser = false;

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl =
      page === 1
        ? `https://www.investing.com/news/${category}`
        : `https://www.investing.com/news/${category}/${page}`;

    if (page > 1 && requestIntervalMs > 0) {
      await sleep(requestIntervalMs);
    }

    try {
      let html = "";
      let pageItems: FinnhubMappedItem[] = [];
      if (useBrowser) {
        if (investingHtmlLoaderForTests) {
          html = await loadPageHtmlInBrowser(pageUrl);
          pageItems = parseListingPage(html, category);
        } else {
          pageItems = await loadPageItemsInBrowser(category, pageUrl);
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
          console.error(
            `[investing] ${category} page ${page}: HTTP ${res.status}`,
          );
          break;
        }

        const candidateHtml = await res.text();
        if (!res.ok || isCloudflareChallengeHtml(candidateHtml)) {
          useBrowser = true;
          if (investingHtmlLoaderForTests) {
            html = await loadPageHtmlInBrowser(pageUrl);
            pageItems = parseListingPage(html, category);
          } else {
            pageItems = await loadPageItemsInBrowser(category, pageUrl);
          }
        } else {
          html = candidateHtml;
          pageItems = parseListingPage(html, category);
        }
      }

      if (html && isCloudflareChallengeHtml(html)) {
        throw new Error("Cloudflare challenge page returned even after browser fallback");
      }
      const filteredPageItems: FinnhubMappedItem[] = [];

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
          continue;
        }
        filteredPageItems.push(item);
      }

      if (filteredPageItems.length === 0) {
        consecutiveEmptyPages++;
        if (reachedOlderThanFrom || consecutiveEmptyPages >= 2) {
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

      if (reachedOlderThanFrom) {
        break;
      }
    } catch (err: any) {
      console.error(
        `[investing] ${category} page ${page}: ${err.message}`,
      );
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
