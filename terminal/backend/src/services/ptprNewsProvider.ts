/**
 * ptprNewsProvider.ts — RTPR press release REST API provider
 *
 * - GET /articles?limit=N  (전체 최신)
 * - GET /articles/{ticker}?limit=N  (ticker별)
 * - 60 rpm rate limiter
 * - UTC → ET 시각 변환
 * - FinnhubMappedItem 호환 형식 반환
 */

import { config } from "../config.js";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";

const RTPR_BASE = "https://api.rtpr.io";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

// ─── Rate limiter: 60 rpm (use 55 to leave headroom) ───
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_TOKENS = 55;
const rateLimitTimestamps: number[] = [];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (rateLimitTimestamps.length > 0 && rateLimitTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
      rateLimitTimestamps.shift();
    }
    if (rateLimitTimestamps.length < RATE_LIMIT_MAX_TOKENS) {
      rateLimitTimestamps.push(now);
      return;
    }
    const waitMs = rateLimitTimestamps[0] - (now - RATE_LIMIT_WINDOW_MS) + 10;
    await sleep(waitMs);
  }
}

// ─── ET conversion (manual offset for America/New_York) ───

function toEtIso(utcIso: string): string {
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return utcIso;

  // Use Intl to get the correct ET offset (handles DST)
  const etStr = d.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etStr);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${etDate.getFullYear()}-${pad(etDate.getMonth() + 1)}-${pad(etDate.getDate())}T${pad(etDate.getHours())}:${pad(etDate.getMinutes())}:${pad(etDate.getSeconds())}`;
}

// ─── Types ───

interface RtprArticle {
  ticker: string;
  exchange: string;
  title: string;
  author: string;
  created: string;
  article_body: string;
  article_body_html?: string;
}

interface RtprResponse {
  count: number;
  articles: RtprArticle[];
}

// ─── Internal fetch with retry ───

async function rtprFetch(url: string): Promise<RtprResponse> {
  if (!config.rtprApiKey) {
    throw new Error("RTPR API key is not configured");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await acquireToken();

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.rtprApiKey}`,
          Accept: "application/json",
        },
      });

      if (res.status === 401) {
        throw new Error("RTPR: Authentication failed (401) — check API key");
      }
      if (res.status === 429) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[RTPR] 429 rate limit, retry ${attempt + 1}/${MAX_RETRIES} after ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        throw new Error(`RTPR: HTTP ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as RtprResponse;
      return data;
    } catch (err: any) {
      if (err.message?.includes("Authentication failed")) throw err;
      if (attempt === MAX_RETRIES - 1) throw err;
      const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[RTPR] fetch error (attempt ${attempt + 1}): ${err.message}, retrying after ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  throw new Error("RTPR: max retries exhausted");
}

// ─── Map RTPR article → FinnhubMappedItem ───

function mapArticle(article: RtprArticle): FinnhubMappedItem {
  const ticker = article.ticker?.toUpperCase() || "UNKNOWN";
  const createdIso = article.created || new Date().toISOString();
  const publishedAtEt = toEtIso(createdIso);

  // Synthetic URL for dedup: rtpr://{TICKER}/{created_iso}
  const syntheticUrl = `rtpr://${ticker}/${createdIso}`;

  return {
    publishedAt: publishedAtEt,
    source: "RTPR",
    sourceType: "press_release",
    title: article.title || "(no title)",
    body: article.article_body || "",
    url: syntheticUrl,
    providerTickers: ticker !== "UNKNOWN" ? [ticker] : [],
    tags: ["press_release"],
    publisher: article.author || undefined,
    bodyHtml: article.article_body_html || undefined,
  };
}

// ─── Public API ───

/**
 * Fetch latest articles across all tickers.
 * @param limit Max articles to fetch (1–100, default 100)
 */
export async function fetchRtprArticles(limit = 100): Promise<FinnhubMappedItem[]> {
  const clampedLimit = Math.min(100, Math.max(1, limit));
  const data = await rtprFetch(`${RTPR_BASE}/articles?limit=${clampedLimit}`);
  return data.articles.map(mapArticle);
}

/**
 * Fetch articles for a specific ticker.
 * @param ticker Symbol (e.g. "AAPL")
 * @param limit Max articles (1–100, default 100)
 */
export async function fetchRtprArticlesByTicker(ticker: string, limit = 100): Promise<FinnhubMappedItem[]> {
  const clampedLimit = Math.min(100, Math.max(1, limit));
  const safeTicker = encodeURIComponent(ticker.toUpperCase());
  const data = await rtprFetch(`${RTPR_BASE}/articles/${safeTicker}?limit=${clampedLimit}`);
  return data.articles.map(mapArticle);
}
