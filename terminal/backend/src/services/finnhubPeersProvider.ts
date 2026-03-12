import { config } from "../config.js";
import {
  acquireFinnhubCompanyDataSlot,
  clampFinnhubCompanyDataConcurrency,
  clampFinnhubCompanyDataIntervalMs,
} from "./finnhubCompanyDataThrottle.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPeersWithRetry(symbol: string, requestIntervalMs: number): Promise<string[]> {
  const url = `${FINNHUB_BASE}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${config.finnhubApiKey}`;

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
        throw new Error(`Finnhub peers ${symbol}: ${res.status} ${text || res.statusText}`);
      }
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return [];
      return data.filter((ticker): ticker is string => typeof ticker === "string");
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  return [];
}

export interface FinnhubPeersBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

/**
 * Fetch peers for a single ticker from Finnhub /stock/peers.
 * Returns an array of ticker strings (includes the queried ticker itself).
 */
export async function fetchFinnhubPeers(symbol: string): Promise<string[]> {
  return fetchPeersWithRetry(symbol, clampFinnhubCompanyDataIntervalMs(undefined));
}

/**
 * Batch-fetch peers for multiple tickers with rate-limit-aware delays.
 * Returns a Map of ticker → peers array.
 * Failures are collected but don't stop the batch.
 */
export async function fetchFinnhubPeersBatch(
  tickers: string[],
  options: FinnhubPeersBatchOptions = {},
): Promise<{ results: Map<string, string[]>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, string[]>();
  const errors = new Map<string, string>();
  const effectiveConcurrency = clampFinnhubCompanyDataConcurrency(options.concurrency);
  const effectiveIntervalMs = clampFinnhubCompanyDataIntervalMs(options.requestIntervalMs);
  let doneCount = 0;
  let cancelled = false;

  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const idx = nextIndex++;
      if (idx >= tickers.length) break;
      if (options.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const ticker = tickers[idx];
      try {
        const peers = await fetchPeersWithRetry(ticker, effectiveIntervalMs);
        results.set(ticker, peers);
      } catch (error) {
        errors.set(ticker, error instanceof Error ? error.message : String(error));
      }
      doneCount++;
      options.onProgress?.(doneCount, tickers.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(effectiveConcurrency, tickers.length || 1) }, () => worker()));

  return { results, errors, cancelled };
}
