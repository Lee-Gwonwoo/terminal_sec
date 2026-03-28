/**
 * fulltextExtractors.ts — Domain-specific full text extractors (Step 10)
 *
 * - Nasdaq: HTTP GET + cheerio HTML parsing → article body
 * - TMX: URL newsid extraction → GraphQL API → story field
 * - finnhub.io / unknown: skip / unavailable
 */

import * as cheerio from "cheerio";
import { chromium, type Browser } from "playwright";
import { derivePublisher } from "./finnhubNewsProvider.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
const MIN_SEC_FULLTEXT_LEN = 200;
const BROWSER_TIMEOUT_MS = 15000;
const COMPANY_NEWS_SCRAPE_PUBLISHERS = new Set(["YAHOO", "BENZINGA"]);

/**
 * FMP stock news: only these publishers have dedicated scrapers that produce real fulltext.
 * All others fall through to body-fallback which only stores the FMP API summary snippet (not real articles).
 */
const FMP_STOCK_NEWS_SCRAPE_PUBLISHERS = new Set([
  "GLOBENEWSWIRE", "GLOBE NEWS WIRE",
  "PRNEWSWIRE",
  "BUSINESS WIRE",
  "NEWSFILE CORP",
  "ACCESSWIRE",
  "MCAP MEDIAWIRE",
  "THENEWSWIRE",
  "NASDAQ",
  "TMX",
  "SEC/EDGAR",
  // --- scrapers added 2026-03-27 ---
  "BENZINGA",
  "CNBC",
  "DEFENSE WORLD",
  "24/7 WALL STREET", "247 WALLST",
  "PROACTIVE INVESTORS", "PROACTIVE INVESTORS - FINANCE",
  "PYMNTS",
  "TECHCRUNCH",
  "SCHAEFFERS RESEARCH",
  "THE MOTLEY FOOL", "FOOL - INVESTING NEWS",
  // --- recheck batch 2026-03-27 ---
  "SEEKING ALPHA",
  "INVESTORPLACE", "INVESTOR PLACE",
  "DEADLINE",
  "CNET",
  "THE GUARDIAN",
  "NYTIMES",
  "FINBOLD",
  "FOX BUSINESS",
  "NEW YORK POST",
  "ETF TRENDS",
  "KITCO",
]);

// ─── Types ───

export interface ExtractionResult {
  fullText: string;
  extractionStatus: "success" | "failed" | "skipped" | "unavailable";
  extractionNote?: string;
  wordCount?: number;
  resolvedUrl?: string;
  resolvedPublisher?: string;
}

interface ExtractByDomainOptions {
  sourceType?: string;
  originUrl?: string | null;
}

// ─── Helpers ───

/** Minimum body length (chars) to accept Finnhub body as fallback full text */
const MIN_BODY_FALLBACK_LEN = 80;

let sharedBrowserPromise: Promise<Browser> | null = null;
let browserHtmlLoaderForTests: ((url: string) => Promise<string>) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert an HTML string to plain text using cheerio.
 * - Removes script, style, noscript, svg, iframe nodes
 * - Inserts newlines at block-level boundaries (p, div, br, h1-h6, li, tr, blockquote)
 * - Strips remaining tags
 * - Normalises whitespace (collapse runs, trim blank lines)
 */
export function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content nodes entirely
  $("script, style, noscript, svg, iframe").remove();

  // Insert newlines at block boundaries to preserve paragraph structure
  $("p, div, br, h1, h2, h3, h4, h5, h6, li, tr, blockquote, section, article, header, footer").each((_i, el) => {
    $(el).before("\n");
    $(el).after("\n");
  });

  // Extract text (cheerio strips tags)
  const raw = $.text();

  // Collapse multiple spaces on the same line, then collapse 3+ newlines into 2
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function cleanPlainText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clipAtMarker(text: string, marker: string): string {
  const index = text.indexOf(marker);
  return index >= 0 ? text.slice(0, index).trim() : text;
}

function extractBestTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const node = $(selector).first();
    if (!node.length) continue;
    const plainText = cleanPlainText(node.text());
    if (plainText.length >= 200) {
      return plainText;
    }
  }
  return "";
}

function removeNodes($: cheerio.CheerioAPI, selectors: string[]): void {
  if (selectors.length === 0) return;
  $(selectors.join(", ")).remove();
}

function clipAtMarkers(text: string, markers: string[]): string {
  let clipped = text;
  for (const marker of markers) {
    clipped = clipAtMarker(clipped, marker);
  }
  return cleanPlainText(clipped);
}

function unavailableResult(note: string): ExtractionResult {
  return {
    fullText: "",
    extractionStatus: "unavailable",
    extractionNote: note,
  };
}

function fallbackOrUnavailable(body: string | null, note: string, fallbackBody: boolean): ExtractionResult {
  return fallbackBody ? bodyFallback(body, note) : unavailableResult(note);
}

export function isFinnhubNewsRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === "finnhub.io"
      && parsed.pathname === "/api/news"
      && parsed.searchParams.has("id");
  } catch {
    return false;
  }
}

export async function resolveFinnhubNewsOriginUrl(url: string): Promise<string | null> {
  if (!isFinnhubNewsRedirectUrl(url)) {
    return null;
  }

  try {
    const res = await fetchWithRetry(url, {
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    const location = res.headers.get("location");
    return location ? new URL(location, url).toString() : null;
  } catch {
    return null;
  }
}

async function extractTextViaHttp(
  url: string,
  body: string | null,
  options: {
    notePrefix: string;
    selectors: string[];
    removeSelectors?: string[];
    clipMarkers?: string[];
    minLength?: number;
    fallbackBody?: boolean;
  },
): Promise<ExtractionResult> {
  const fallbackBody = options.fallbackBody ?? true;
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      return fallbackOrUnavailable(body, `${options.notePrefix}-http-${res.status}`, fallbackBody);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    removeNodes($, [
      "script",
      "style",
      "noscript",
      "svg",
      "iframe",
      ...(options.removeSelectors ?? []),
    ]);

    let plainText = extractBestTextFromSelectors($, options.selectors);
    if (!plainText) {
      return fallbackOrUnavailable(body, `${options.notePrefix}-no-body`, fallbackBody);
    }

    plainText = clipAtMarkers(plainText, options.clipMarkers ?? []);
    if (plainText.length < (options.minLength ?? 200)) {
      return fallbackOrUnavailable(body, `${options.notePrefix}-too-short`, fallbackBody);
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: `${options.notePrefix}-scrape`,
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return fallbackOrUnavailable(body, `${options.notePrefix}-${err.message?.slice(0, 200) ?? "fetch-failed"}`, fallbackBody);
  }
}

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = (async () => {
      try {
        return await chromium.launch({
          channel: "msedge",
          headless: true,
        });
      } catch {
        return chromium.launch({ headless: true });
      }
    })();
  }
  return sharedBrowserPromise;
}

async function loadPageHtmlInBrowser(url: string): Promise<string> {
  if (browserHtmlLoaderForTests) {
    return browserHtmlLoaderForTests(url);
  }

  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: `${UA} Safari/537.36`,
    locale: "en-US",
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    return await page.content();
  } finally {
    await page.close().catch(() => undefined);
  }
}

export function setBrowserHtmlLoaderForTests(loader: ((url: string) => Promise<string>) | null): void {
  browserHtmlLoaderForTests = loader;
}

async function extractTextViaBrowser(
  url: string,
  body: string | null,
  options: {
    notePrefix: string;
    selectors: string[];
    removeSelectors?: string[];
    clipMarkers?: string[];
    minLength?: number;
    fallbackBody?: boolean;
  },
): Promise<ExtractionResult> {
  const fallbackBody = options.fallbackBody ?? true;
  try {
    const html = await loadPageHtmlInBrowser(url);
    const $ = cheerio.load(html);
    removeNodes($, [
      "script",
      "style",
      "noscript",
      "svg",
      "iframe",
      ...(options.removeSelectors ?? []),
    ]);

    let plainText = extractBestTextFromSelectors($, options.selectors);
    if (!plainText) {
      return fallbackOrUnavailable(body, `${options.notePrefix}-no-body`, fallbackBody);
    }

    plainText = clipAtMarkers(plainText, options.clipMarkers ?? []);
    if (plainText.length < (options.minLength ?? 200)) {
      return fallbackOrUnavailable(body, `${options.notePrefix}-too-short`, fallbackBody);
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: `${options.notePrefix}-browser`,
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return fallbackOrUnavailable(body, `${options.notePrefix}-${err.message?.slice(0, 200) ?? "browser-failed"}`, fallbackBody);
  }
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Rate limited (429) after ${MAX_RETRIES} retries`);
        }
        await sleep(BASE_DELAY_MS * attempt * 2);
        continue;
      }

      if (res.status >= 500) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Server error (${res.status}) after ${MAX_RETRIES} retries`);
        }
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }

      return res;
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

// ─── Nasdaq Extractor ───

export async function extractNasdaq(url: string): Promise<ExtractionResult> {
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!res.ok) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Primary selector: div.body__content
    let bodyHtml = $("div.body__content").html();

    // Fallback selectors
    if (!bodyHtml) {
      bodyHtml = $("article").html() || $(".article-body").html() || $(".press-release-body").html();
    }

    if (!bodyHtml || bodyHtml.trim().length < 20) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: "page-has-no-article-body",
      };
    }

    const plainText = htmlToPlainText(bodyHtml);
    if (plainText.length < 20) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: "article-body-empty-after-html-strip",
      };
    }

    const wc = countWords(plainText);
    return {
      fullText: plainText,
      extractionStatus: "success",
      wordCount: wc,
    };
  } catch (err: any) {
    return {
      fullText: "",
      extractionStatus: "failed",
      extractionNote: `fetch-error: ${err.message?.slice(0, 200)}`,
    };
  }
}

// ─── TMX Extractor ───

const TMX_GRAPHQL = "https://app-money.tmx.com/graphql";

function extractTmxNewsId(url: string): string | null {
  // URL pattern: https://money.tmx.com/en/quote/SYMBOL/news/NEWSID
  const match = url.match(/\/news\/(\d+)/);
  return match ? match[1] : null;
}

export async function extractTmx(url: string): Promise<ExtractionResult> {
  const newsid = extractTmxNewsId(url);
  if (!newsid) {
    return {
      fullText: "",
      extractionStatus: "failed",
      extractionNote: "newsid-parse-failed",
    };
  }

  try {
    const res = await fetchWithRetry(TMX_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Origin": "https://money.tmx.com",
        "Referer": "https://money.tmx.com/",
      },
      body: JSON.stringify({
        operationName: "getNewsStoryById",
        variables: { newsid },
        query: `query getNewsStoryById($newsid: String!) {
          getNewsStoryById(newsid: $newsid) {
            headline
            story
          }
        }`,
      }),
    });

    if (!res.ok) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: `graphql-http-${res.status}`,
      };
    }

    const json = (await res.json()) as {
      data?: { getNewsStoryById?: { headline?: string; story?: string } };
      errors?: unknown[];
    };

    const story = json?.data?.getNewsStoryById?.story;
    if (!story || story.trim().length < 20) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: "empty-story-field",
      };
    }

    // Convert potential HTML in story field to plain text
    const plainText = /<[a-z][\s\S]*>/i.test(story) ? htmlToPlainText(story) : story.trim();
    if (plainText.length < 20) {
      return {
        fullText: "",
        extractionStatus: "failed",
        extractionNote: "story-empty-after-html-strip",
      };
    }

    const wc = countWords(plainText);
    return {
      fullText: plainText,
      extractionStatus: "success",
      wordCount: wc,
    };
  } catch (err: any) {
    return {
      fullText: "",
      extractionStatus: "failed",
      extractionNote: `fetch-error: ${err.message?.slice(0, 200)}`,
    };
  }
}

export async function extractGlobeNewswire(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "globenewswire",
    selectors: [
      "#main-body-container",
      ".main-body-container.article-body",
      ".main-scroll-container",
      "article",
      "main",
    ],
    removeSelectors: [
      ".recommended-reading",
      ".explore",
      ".additional-links",
      ".cookie-banner",
    ],
    clipMarkers: ["Company Profile", "Press Release Actions", "Recommended Reading", "Explore"],
  });
}

export async function extractPrNewswire(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "prnewswire",
    selectors: [
      "section.release-body",
      "article.news-release",
      "#main article.news-release",
      "#main",
    ],
    removeSelectors: [
      ".main-footer",
      ".navigation-menu",
      ".related-links",
      ".contact-prn-container",
    ],
    clipMarkers: ["SOURCE ", "Modal title", "Contact PR Newswire"],
  });
}

export async function extractNewsfile(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "newsfile",
    selectors: [
      "main",
      "article",
      ".content",
      ".news-release-content",
    ],
    removeSelectors: [
      ".cookie-banner",
      ".additional-links",
      ".share-icons",
      ".signup-box",
      "footer",
    ],
    clipMarkers: ["Ready to Announce with Confidence?", "Additional Links", "Cookie Settings"],
  });
}

export async function extractAccesswire(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "accesswire",
    selectors: [
      "main",
      "article",
      ".newsroom-article",
      ".article-content",
    ],
    removeSelectors: [
      ".cookie-banner",
      "footer",
      ".newsroom-sidebar",
      ".social-share",
      ".faq-section",
    ],
    clipMarkers: ["Solutions", "Public Relations Products", "Investor Relations Products", "Resources", "FAQs", "About Us", "Our Brands", "Contact Us", "Cookie Notice"],
  });
}

export async function extractMcapMediaWire(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "mcap-mediawire",
    selectors: [
      "article",
      "main",
      ".elementor-widget-theme-post-content",
      ".entry-content",
    ],
    removeSelectors: [
      ".elementor-location-header",
      ".elementor-location-footer",
      ".comments-area",
      ".post-navigation",
      ".share-buttons",
    ],
    clipMarkers: ["Search", "Categories", "Subscribe to notifications", "PRISM MediaWire - Press Release Service - Press Release Distribution"],
  });
}

export async function extractBusinessWire(url: string, body?: string | null): Promise<ExtractionResult> {
  try {
    const html = await loadPageHtmlInBrowser(url);
    const $ = cheerio.load(html);
    removeNodes($, [
      "script",
      "style",
      "noscript",
      "svg",
      "iframe",
      "header",
      "footer",
      ".cookie-banner",
      ".related-news",
      ".bw-release-toolbar",
      ".bw-release-contacts",
    ]);

    const accessDeniedText = cleanPlainText($.text()).slice(0, 1000);
    if (/access denied|powered and protected by|errors\.edgesuite\.net/i.test(accessDeniedText)) {
      return bodyFallback(body ?? null, "businesswire-browser-blocked");
    }

    let plainText = extractBestTextFromSelectors($, [
      "main",
      "article",
      ".bw-release-story",
      ".bw-release-body",
      "[data-testid='bw-release-story']",
    ]);
    if (!plainText) {
      return bodyFallback(body ?? null, "businesswire-no-body");
    }

    plainText = clipAtMarkers(plainText, [
      "View source version on businesswire.com",
      "Contacts",
      "SOURCE:",
      "Related News",
    ]);

    if (plainText.length < 200) {
      return bodyFallback(body ?? null, "businesswire-too-short");
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: "businesswire-browser",
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return bodyFallback(body ?? null, `businesswire-${err.message?.slice(0, 200) ?? "browser-failed"}`);
  }
}

export async function extractYahooFinance(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaBrowser(url, body ?? null, {
    notePrefix: "yahoo-finance",
    selectors: [
      '[data-testid="articleBody"]',
      '[data-module="ArticleBody"]',
      '[class*="caas-body"]',
      '[class*="article-body"]',
      "article",
      "main",
    ],
    removeSelectors: [
      "header",
      "footer",
      "nav",
      "aside",
      '[data-testid="ad"]',
      '[class*="advertisement"]',
      '[class*="ad-"]',
    ],
    clipMarkers: [
      "Recommended Stories",
      "View comments",
      "Terms and Privacy Policy",
    ],
    minLength: 250,
    fallbackBody: false,
  });
}

export async function extractBenzinga(url: string, body?: string | null): Promise<ExtractionResult> {
  return extractTextViaHttp(url, body ?? null, {
    notePrefix: "benzinga",
    selectors: [
      '[itemprop="articleBody"]',
      ".article-content-body-only",
      ".article-content-body",
      '[class*="article-content-body"]',
    ],
    removeSelectors: [
      "header",
      "footer",
      "aside",
      '[class*="advertisement"]',
      '[class*="paywall"]',
    ],
    clipMarkers: [
      "Benzinga simplifies the market",
      "Trade confidently",
    ],
    minLength: 150,
    fallbackBody: false,
  });
}

// ─── Body Fallback Helper ───

function bodyFallback(body: string | null, note: string): ExtractionResult {
  if (body && body.length >= MIN_BODY_FALLBACK_LEN) {
    // Strip potential HTML in the body field
    const plain = /<[a-z][\s\S]*>/i.test(body) ? htmlToPlainText(body) : body.trim();
    if (plain.length >= MIN_BODY_FALLBACK_LEN) {
      return {
        fullText: plain,
        extractionStatus: "success",
        extractionNote: `body-fallback (${note})`,
        wordCount: countWords(plain),
      };
    }
  }
  return {
    fullText: "",
    extractionStatus: "unavailable",
    extractionNote: note,
  };
}

export async function extractSecEdgar(url: string, body?: string | null): Promise<ExtractionResult> {
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      return bodyFallback(body ?? null, `sec-edgar-http-${res.status}`);
    }

    const raw = await res.text();
    const plainText = /<[a-z][\s\S]*>/i.test(raw) ? htmlToPlainText(raw) : raw.trim();
    if (plainText.length < MIN_SEC_FULLTEXT_LEN) {
      return bodyFallback(body ?? null, "sec-edgar-too-short");
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: "sec-edgar-fetch",
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return bodyFallback(body ?? null, `sec-edgar-${err.message?.slice(0, 200) ?? "fetch-failed"}`);
  }
}

// ─── Domain Dispatcher ───

export async function extractByDomain(
  url: string,
  publisher: string | null,
  body?: string | null,
  options?: ExtractByDomainOptions,
): Promise<ExtractionResult> {
  const pub = (publisher ?? "").replace(/\s+/g, " ").trim().toUpperCase();

  let resolvedUrl = options?.originUrl?.trim() || "";
  if (!resolvedUrl && options?.sourceType === "company_news") {
    resolvedUrl = (await resolveFinnhubNewsOriginUrl(url)) ?? "";
  }

  const effectiveUrl = resolvedUrl || url;
  const effectivePub = resolvedUrl ? derivePublisher(resolvedUrl) : pub;

  if (options?.sourceType === "company_news") {
    let companyResult: ExtractionResult;

    if (!resolvedUrl && isFinnhubNewsRedirectUrl(url)) {
      companyResult = unavailableResult("company-news-no-origin-url");
    } else if (!COMPANY_NEWS_SCRAPE_PUBLISHERS.has(effectivePub)) {
      companyResult = unavailableResult(`company-news-no-scraper: ${effectivePub || "(empty)"}`);
    } else if (effectivePub === "YAHOO") {
      companyResult = await extractYahooFinance(effectiveUrl, body ?? null);
    } else {
      companyResult = await extractBenzinga(effectiveUrl, body ?? null);
    }

    return {
      ...companyResult,
      resolvedUrl: resolvedUrl || undefined,
      resolvedPublisher: effectivePub && effectivePub !== pub ? effectivePub : undefined,
    };
  }

  // FMP stock news gate: only attempt extraction for publishers with real scrapers
  if (options?.sourceType === "fmp_stock_news" && !FMP_STOCK_NEWS_SCRAPE_PUBLISHERS.has(effectivePub)) {
    return unavailableResult(`fmp-stock-no-scraper: ${effectivePub || "(empty)"}`);
  }

  switch (effectivePub) {
    case "NASDAQ": {
      const result = await extractNasdaq(effectiveUrl);
      // If scraping failed (e.g. Akamai 403), fall back to body text
      if (result.extractionStatus !== "success") {
        return bodyFallback(body ?? null, `nasdaq-scrape-${result.extractionNote ?? "failed"}`);
      }
      return result;
    }

    case "TMX": {
      const result = await extractTmx(effectiveUrl);
      if (result.extractionStatus !== "success") {
        return bodyFallback(body ?? null, `tmx-${result.extractionNote ?? "failed"}`);
      }
      return result;
    }

    case "GLOBENEWSWIRE":
    case "GLOBE NEWS WIRE":
      return extractGlobeNewswire(effectiveUrl, body ?? null);

    case "PRNEWSWIRE":
      return extractPrNewswire(effectiveUrl, body ?? null);

    case "BUSINESS WIRE":
      return extractBusinessWire(effectiveUrl, body ?? null);

    case "NEWSFILE CORP":
      return extractNewsfile(effectiveUrl, body ?? null);

    case "ACCESSWIRE":
      return extractAccesswire(effectiveUrl, body ?? null);

    case "MCAP MEDIAWIRE":
      return extractMcapMediaWire(effectiveUrl, body ?? null);

    case "BENZINGA":
      return extractBenzinga(effectiveUrl, body ?? null);

    case "CNBC":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "cnbc",
        selectors: [
          ".ArticleBody-articleBody",
          '[class*="articleBody"]',
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="Ad-"]', '[class*="newsletter"]',
        ],
        clipMarkers: ["Get In Touch", "WATCH:", "Don't miss these insights"],
        fallbackBody: false,
      });

    case "DEFENSE WORLD":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "defenseworld",
        selectors: [
          "article",
          '[class*="entry"]',
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside", ".sidebar",
          ".share-buttons", ".related-posts",
        ],
        clipMarkers: [
          "Receive News & Ratings",
          "Related News", "More Posts", "About Defense World",
          "About the author",
        ],
        fallbackBody: false,
      });

    case "24/7 WALL STREET":
    case "247 WALLST":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "247wallst",
        selectors: [
          "article",
          ".entry-content",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          ".sidebar", ".share-buttons", ".related-posts",
          '[class*="ad-"]', '[class*="newsletter"]',
        ],
        clipMarkers: [
          "Sponsored:", "Take This Retirement Quiz",
          "Get Ready To Retire", "The Average American",
        ],
        fallbackBody: false,
      });

    case "PROACTIVE INVESTORS":
    case "PROACTIVE INVESTORS - FINANCE":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "proactive",
        selectors: [
          '[itemprop="articleBody"]',
          ".article-content",
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          ".share-buttons", ".related-articles",
        ],
        clipMarkers: ["Contact the author", "Proactive Investors"],
        fallbackBody: false,
      });

    case "PYMNTS":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "pymnts",
        selectors: [
          "article",
          ".entry-content",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          ".share-buttons", '[class*="newsletter"]',
        ],
        clipMarkers: ["See also:", "For all PYMNTS"],
        fallbackBody: false,
      });

    case "TECHCRUNCH":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "techcrunch",
        selectors: [
          ".entry-content",
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="newsletter"]', '[class*="ad-"]',
        ],
        clipMarkers: ["Read more on TechCrunch"],
        fallbackBody: false,
      });

    case "THENEWSWIRE":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "thenewswire",
        selectors: [
          ".press-release",
          '[class*="release"]',
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav",
        ],
        clipMarkers: ["About TheNewswire"],
        fallbackBody: false,
      });

    case "SCHAEFFERS RESEARCH":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "schaeffers",
        selectors: [
          '[class*="body"]',
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          ".sidebar", '[class*="ad"]',
        ],
        clipMarkers: ["More From Schaeffers"],
        fallbackBody: false,
      });

    case "THE MOTLEY FOOL":
    case "FOOL - INVESTING NEWS":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "motleyfool",
        selectors: [
          ".article-body",
          '[class*="article-body"]',
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="pitch"]',
          '[class*="newsletter"]', '[class*="promo"]',
        ],
        clipMarkers: [
          "The Motley Fool has a",
          "Suzanne Frey",
          "John Mackey",
          "*Stock Advisor",
        ],
        fallbackBody: false,
      });

    case "SEEKING ALPHA":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "seekingalpha",
        selectors: [
          '[class*="body"]',
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="paywall"]',
          '[class*="comment"]',
        ],
        clipMarkers: [
          "This article was written by",
          "Analyst's Disclosure",
          "Seeking Alpha's Disclosure",
          "Editor's Note",
        ],
        fallbackBody: false,
      });

    case "INVESTORPLACE":
    case "INVESTOR PLACE":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "investorplace",
        selectors: [
          "article",
          ".entry-content",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="newsletter"]',
          '[class*="sidebar"]',
        ],
        clipMarkers: [
          "On the date of publication",
          "More From InvestorPlace",
        ],
        fallbackBody: false,
      });

    case "DEADLINE":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "deadline",
        selectors: [
          ".entry-content",
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="related"]',
        ],
        clipMarkers: [
          "Best of Deadline",
          "Must Read Stories",
        ],
        fallbackBody: false,
      });

    case "CNET":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "cnet",
        selectors: [
          "article",
          "main",
          '[class*="article-body"]',
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="newsletter"]',
        ],
        clipMarkers: ["Editors' note", "More stories"],
        fallbackBody: false,
      });

    case "THE GUARDIAN":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "guardian",
        selectors: [
          '[itemprop="articleBody"]',
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="newsletter"]',
        ],
        clipMarkers: [
          "Explore more on these topics",
          "Most viewed",
        ],
        fallbackBody: false,
      });

    case "NYTIMES":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "nytimes",
        selectors: [
          "article",
          "main",
          '[class*="body"]',
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad"]', '[class*="newsletter"]',
        ],
        clipMarkers: [
          "A version of this article appears in print",
          "More on",
        ],
        fallbackBody: false,
      });

    case "FINBOLD":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "finbold",
        selectors: [
          "article",
          ".entry-content",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="newsletter"]',
        ],
        clipMarkers: ["Disclaimer:"],
        fallbackBody: false,
      });

    case "FOX BUSINESS":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "foxbusiness",
        selectors: [
          "article",
          "main",
          '[class*="article-body"]',
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="video"]',
        ],
        clipMarkers: [
          "GET FOX BUSINESS",
          "CLICK HERE",
        ],
        fallbackBody: false,
      });

    case "NEW YORK POST":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "nypost",
        selectors: [
          "article",
          ".entry-content",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="newsletter"]',
          '[class*="related"]',
        ],
        clipMarkers: ["Filed under"],
        fallbackBody: false,
      });

    case "ETF TRENDS":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "etftrends",
        selectors: [
          ".post-content",
          ".entry-content",
          "article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
        ],
        clipMarkers: [
          "For more news",
          "POPULAR ARTICLES",
        ],
        fallbackBody: false,
      });

    case "KITCO":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "kitco",
        selectors: [
          "article",
          "main",
          '[class*="article"]',
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]',
        ],
        clipMarkers: ["Disclaimer:"],
        fallbackBody: false,
      });

    case "FINNHUB":
      return bodyFallback(body ?? null, "finnhub-no-external-page");

    case "SEC/EDGAR":
      return extractSecEdgar(effectiveUrl, body ?? null);

    case "INVESTING":
      return extractTextViaHttp(effectiveUrl, body ?? null, {
        notePrefix: "investing",
        selectors: [
          '[data-test="article-body"]',
          ".articlePage",
          ".WYSIWYG.articlePage",
          "article",
          "#__next article",
          "main",
        ],
        removeSelectors: [
          "header", "footer", "nav", "aside",
          '[class*="ad-"]', '[class*="Ad-"]',
          '[class*="newsletter"]', '[class*="related"]',
          '[class*="comment"]', '[class*="social"]',
          ".relatedArticles", ".articleFooter",
        ],
        clipMarkers: [
          "Related Articles",
          "Continue Reading on",
          "This article was written by",
          "Sign up for our free newsletter",
        ],
        fallbackBody: false,
      });

    default:
      return bodyFallback(body ?? null, `no-scraper: ${effectivePub || "(empty)"}`);
  }
}
