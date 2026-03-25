/**
 * fulltextExtractors.ts — Domain-specific full text extractors (Step 10)
 *
 * - Nasdaq: HTTP GET + cheerio HTML parsing → article body
 * - TMX: URL newsid extraction → GraphQL API → story field
 * - finnhub.io / unknown: skip / unavailable
 */

import * as cheerio from "cheerio";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
const MIN_SEC_FULLTEXT_LEN = 200;

// ─── Types ───

export interface ExtractionResult {
  fullText: string;
  extractionStatus: "success" | "failed" | "skipped" | "unavailable";
  extractionNote?: string;
  wordCount?: number;
}

// ─── Helpers ───

/** Minimum body length (chars) to accept Finnhub body as fallback full text */
const MIN_BODY_FALLBACK_LEN = 80;

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
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      return bodyFallback(body ?? null, `globenewswire-http-${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe, .recommended-reading, .explore, .additional-links, .cookie-banner").remove();

    let plainText = extractBestTextFromSelectors($, [
      "#main-body-container",
      ".main-body-container.article-body",
      ".main-scroll-container",
      "article",
      "main",
    ]);

    if (!plainText) {
      return bodyFallback(body ?? null, "globenewswire-no-body");
    }

    plainText = clipAtMarker(plainText, "Company Profile");
    plainText = clipAtMarker(plainText, "Press Release Actions");
    plainText = clipAtMarker(plainText, "Recommended Reading");
    plainText = clipAtMarker(plainText, "Explore");
    plainText = cleanPlainText(plainText);

    if (plainText.length < 200) {
      return bodyFallback(body ?? null, "globenewswire-too-short");
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: "globenewswire-scrape",
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return bodyFallback(body ?? null, `globenewswire-${err.message?.slice(0, 200) ?? "fetch-failed"}`);
  }
}

export async function extractPrNewswire(url: string, body?: string | null): Promise<ExtractionResult> {
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      return bodyFallback(body ?? null, `prnewswire-http-${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe, .main-footer, .navigation-menu, .related-links, .contact-prn-container").remove();

    let plainText = extractBestTextFromSelectors($, [
      "section.release-body",
      "article.news-release",
      "#main article.news-release",
      "#main",
    ]);

    if (!plainText) {
      return bodyFallback(body ?? null, "prnewswire-no-body");
    }

    plainText = clipAtMarker(plainText, "SOURCE ");
    plainText = clipAtMarker(plainText, "Modal title");
    plainText = clipAtMarker(plainText, "Contact PR Newswire");
    plainText = cleanPlainText(plainText);

    if (plainText.length < 200) {
      return bodyFallback(body ?? null, "prnewswire-too-short");
    }

    return {
      fullText: plainText,
      extractionStatus: "success",
      extractionNote: "prnewswire-scrape",
      wordCount: countWords(plainText),
    };
  } catch (err: any) {
    return bodyFallback(body ?? null, `prnewswire-${err.message?.slice(0, 200) ?? "fetch-failed"}`);
  }
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
): Promise<ExtractionResult> {
  const pub = (publisher ?? "").replace(/\s+/g, " ").trim().toUpperCase();

  switch (pub) {
    case "NASDAQ": {
      const result = await extractNasdaq(url);
      // If scraping failed (e.g. Akamai 403), fall back to body text
      if (result.extractionStatus !== "success") {
        return bodyFallback(body ?? null, `nasdaq-scrape-${result.extractionNote ?? "failed"}`);
      }
      return result;
    }

    case "TMX": {
      const result = await extractTmx(url);
      if (result.extractionStatus !== "success") {
        return bodyFallback(body ?? null, `tmx-${result.extractionNote ?? "failed"}`);
      }
      return result;
    }

    case "GLOBENEWSWIRE":
    case "GLOBE NEWS WIRE":
      return extractGlobeNewswire(url, body ?? null);

    case "PRNEWSWIRE":
      return extractPrNewswire(url, body ?? null);

    case "FINNHUB":
      return bodyFallback(body ?? null, "finnhub-no-external-page");

    case "SEC/EDGAR":
      return extractSecEdgar(url, body ?? null);

    default:
      return bodyFallback(body ?? null, `no-scraper: ${pub || "(empty)"}`);
  }
}
