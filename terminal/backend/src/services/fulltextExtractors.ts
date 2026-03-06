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

// ─── Types ───

export interface ExtractionResult {
  fullText: string;
  extractionStatus: "success" | "failed" | "skipped" | "unavailable";
  extractionNote?: string;
  wordCount?: number;
}

// ─── Helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(text: string): number {
  return text
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
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
      headers: { "User-Agent": UA },
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

    const wc = countWords(bodyHtml);
    return {
      fullText: bodyHtml.trim(),
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

    const wc = countWords(story);
    return {
      fullText: story.trim(),
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

// ─── Domain Dispatcher ───

export async function extractByDomain(
  url: string,
  publisher: string | null,
): Promise<ExtractionResult> {
  const pub = (publisher ?? "").toUpperCase();

  switch (pub) {
    case "NASDAQ":
      return extractNasdaq(url);

    case "TMX":
      return extractTmx(url);

    case "FINNHUB":
      return {
        fullText: "",
        extractionStatus: "skipped",
        extractionNote: "finnhub-no-external-page",
      };

    default:
      return {
        fullText: "",
        extractionStatus: "unavailable",
        extractionNote: `unknown-domain: ${pub || "(empty)"}`,
      };
  }
}
