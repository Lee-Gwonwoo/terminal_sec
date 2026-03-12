import { config } from "../config.js";
import {
  acquireFinnhubCompanyDataSlot,
  clampFinnhubCompanyDataConcurrency,
  clampFinnhubCompanyDataIntervalMs,
} from "./finnhubCompanyDataThrottle.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

export interface FinnhubProfile2 {
  ticker: string;
  name: string | null;
  exchange: string | null;
  finnhubIndustry: string | null;
  ipoDate: string | null;
  marketCapitalization: number | null;
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, requestIntervalMs: number): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFinnhubCompanyDataSlot(requestIntervalMs);
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
  const data = await fetchWithRetry(url, clampFinnhubCompanyDataIntervalMs(undefined));
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
    ipoDate: typeof obj.ipo === "string" && obj.ipo.trim() ? obj.ipo.trim() : null,
    marketCapitalization:
      typeof obj.marketCapitalization === "number" && Number.isFinite(obj.marketCapitalization)
        ? obj.marketCapitalization * 1_000_000
        : null,
    raw: obj,
  };
}

export interface FinnhubProfilesBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export async function fetchFinnhubProfilesBatch(
  tickers: string[],
  options: FinnhubProfilesBatchOptions = {},
): Promise<{ results: Map<string, FinnhubProfile2>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, FinnhubProfile2>();
  const errors = new Map<string, string>();
  const effectiveConcurrency = clampFinnhubCompanyDataConcurrency(options.concurrency);
  const effectiveIntervalMs = clampFinnhubCompanyDataIntervalMs(options.requestIntervalMs);

  if (tickers.length === 0) {
    return { results, errors, cancelled: false };
  }

  let doneCount = 0;
  let cancelled = false;

  const processTicker = async (ticker: string): Promise<void> => {
    if (cancelled || options.shouldCancel?.()) {
      cancelled = true;
      return;
    }
    if (cancelled || options.shouldCancel?.()) {
      cancelled = true;
      return;
    }
    try {
      const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${config.finnhubApiKey}`;
      const data = await fetchWithRetry(url, effectiveIntervalMs);
      const profile = !data || typeof data !== "object"
        ? null
        : {
            ticker: ticker.toUpperCase(),
            name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
            exchange: typeof data.exchange === "string" && data.exchange.trim() ? data.exchange.trim() : null,
            finnhubIndustry:
              typeof data.finnhubIndustry === "string" && data.finnhubIndustry.trim()
                ? data.finnhubIndustry.trim()
                : null,
            ipoDate: typeof data.ipo === "string" && data.ipo.trim() ? data.ipo.trim() : null,
            marketCapitalization:
              typeof data.marketCapitalization === "number" && Number.isFinite(data.marketCapitalization)
                ? data.marketCapitalization * 1_000_000
                : null,
            raw: data as Record<string, unknown>,
          } satisfies FinnhubProfile2 | null;
      if (profile) {
        results.set(ticker.toUpperCase(), profile);
      }
    } catch (error) {
      errors.set(ticker.toUpperCase(), error instanceof Error ? error.message : String(error));
    }
    doneCount++;
    options.onProgress?.(doneCount, tickers.length);
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

  const workers = Array.from({ length: Math.min(effectiveConcurrency, tickers.length) }, () => worker());
  await Promise.all(workers);

  return { results, errors, cancelled };
}