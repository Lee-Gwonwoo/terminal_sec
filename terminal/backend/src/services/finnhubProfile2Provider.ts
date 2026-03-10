import { config } from "../config.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

export interface FinnhubProfile2 {
  ticker: string;
  name: string | null;
  exchange: string | null;
  finnhubIndustry: string | null;
  marketCapitalization: number | null;
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
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
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}

export async function fetchFinnhubProfile2(symbol: string): Promise<FinnhubProfile2 | null> {
  const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${config.finnhubApiKey}`;
  const data = await fetchWithRetry(url);
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;
  return {
    ticker: symbol.toUpperCase(),
    name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : null,
    exchange: typeof obj.exchange === "string" && obj.exchange.trim() ? obj.exchange.trim() : null,
    finnhubIndustry:
      typeof obj.finnhubIndustry === "string" && obj.finnhubIndustry.trim()
        ? obj.finnhubIndustry.trim()
        : null,
    marketCapitalization:
      typeof obj.marketCapitalization === "number" && Number.isFinite(obj.marketCapitalization)
        ? obj.marketCapitalization * 1_000_000
        : null,
    raw: obj,
  };
}

/**
 * Simple token-bucket rate limiter.
 * Allows `maxTokens` requests per `intervalMs` window.
 */
class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly intervalMs: number;
  private lastRefill: number;

  constructor(maxTokens: number, intervalMs: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.intervalMs = intervalMs;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      if (elapsed >= this.intervalMs) {
        this.tokens = this.maxTokens;
        this.lastRefill = now;
      } else {
        const partial = Math.floor((elapsed / this.intervalMs) * this.maxTokens);
        this.tokens = Math.min(this.maxTokens, partial);
      }
      if (this.tokens > 0) {
        this.tokens--;
        return;
      }
      // Wait until next token available
      const waitMs = Math.ceil(this.intervalMs / this.maxTokens);
      await sleep(waitMs);
    }
  }
}

/** Concurrency for parallel market-cap fetching (Finnhub free tier ≈ 60/min) */
const PROFILE_CONCURRENCY = 3;
const PROFILE_RATE_LIMIT = 55; // requests per minute (margin below 60)

export async function fetchFinnhubProfilesBatch(
  tickers: string[],
  _delayMs = 1050, // kept for API compat, ignored — rate limiter controls pacing
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean,
): Promise<{ results: Map<string, FinnhubProfile2>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, FinnhubProfile2>();
  const errors = new Map<string, string>();

  if (tickers.length === 0) {
    return { results, errors, cancelled: false };
  }

  const limiter = new RateLimiter(PROFILE_RATE_LIMIT, 60_000);
  let doneCount = 0;
  let cancelled = false;

  const processTicker = async (ticker: string): Promise<void> => {
    if (cancelled || shouldCancel?.()) {
      cancelled = true;
      return;
    }
    await limiter.acquire();
    if (cancelled || shouldCancel?.()) {
      cancelled = true;
      return;
    }
    try {
      const profile = await fetchFinnhubProfile2(ticker);
      if (profile) {
        results.set(ticker.toUpperCase(), profile);
      }
    } catch (error) {
      errors.set(ticker.toUpperCase(), error instanceof Error ? error.message : String(error));
    }
    doneCount++;
    onProgress?.(doneCount, tickers.length);
  };

  // Worker pool: N concurrent workers pulling from a shared queue
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const idx = nextIndex++;
      if (idx >= tickers.length) break;
      await processTicker(tickers[idx]);
    }
  };

  const workers = Array.from({ length: Math.min(PROFILE_CONCURRENCY, tickers.length) }, () => worker());
  await Promise.all(workers);

  return { results, errors, cancelled };
}