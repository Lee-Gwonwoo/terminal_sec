/**
 * finnhubOwnershipProvider.ts
 * Finnhub stock/ownership API에서 institutional holders 목록을 가져와
 * 합산 institutional ownership %를 계산한다.
 * Endpoint: https://finnhub.io/api/v1/stock/ownership?symbol={TICKER}&limit=100&token=KEY
 *
 * FMP shares-float의 outstandingShares를 분모로 사용하여 % 계산.
 */

import { config } from "../config.js";
import {
  acquireFinnhubCompanyDataSlot,
  clampFinnhubCompanyDataConcurrency,
  clampFinnhubCompanyDataIntervalMs,
} from "./finnhubCompanyDataThrottle.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

export interface FinnhubOwnershipResult {
  ticker: string;
  totalHolderShares: number;
  holderCount: number;
  institutionalPct: number | null; // null if outstandingShares not available
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
      if (attempt === MAX_RETRIES) throw error;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}

/**
 * Fetch ownership data for a single ticker.
 * @param outstandingShares — if provided, used as denominator for % calculation
 */
export async function fetchFinnhubOwnership(
  ticker: string,
  outstandingShares: number | null,
): Promise<FinnhubOwnershipResult | null> {
  const url = `${FINNHUB_BASE}/stock/ownership?symbol=${encodeURIComponent(ticker)}&limit=100&token=${config.finnhubApiKey}`;
  const data = await fetchWithRetry(url, clampFinnhubCompanyDataIntervalMs(undefined));
  if (!data || !Array.isArray(data.ownership)) return null;

  const holders = data.ownership as Array<{ share: number }>;
  const totalShares = holders.reduce((sum, h) => sum + (typeof h.share === "number" ? h.share : 0), 0);

  let pct: number | null = null;
  if (outstandingShares && outstandingShares > 0 && totalShares > 0) {
    pct = (totalShares / outstandingShares) * 100;
    // Cap at 100% to handle data inconsistencies
    if (pct > 100) pct = 100;
  }

  return {
    ticker: ticker.toUpperCase(),
    totalHolderShares: totalShares,
    holderCount: holders.length,
    institutionalPct: pct,
  };
}

export interface FinnhubOwnershipBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

/**
 * Fetch institutional ownership for multiple tickers.
 * @param outstandingSharesMap — ticker→outstandingShares lookup (from FMP shares-float or DB)
 */
export async function fetchFinnhubOwnershipBatch(
  tickers: string[],
  outstandingSharesMap: Map<string, number>,
  options: FinnhubOwnershipBatchOptions = {},
): Promise<{ results: Map<string, FinnhubOwnershipResult>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, FinnhubOwnershipResult>();
  const errors = new Map<string, string>();
  const effectiveConcurrency = clampFinnhubCompanyDataConcurrency(options.concurrency);

  if (tickers.length === 0) return { results, errors, cancelled: false };

  let doneCount = 0;
  let cancelled = false;
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const idx = nextIndex++;
      if (idx >= tickers.length) break;
      if (options.shouldCancel?.()) { cancelled = true; return; }
      const ticker = tickers[idx];
      try {
        const outstanding = outstandingSharesMap.get(ticker.toUpperCase()) ?? null;
        const result = await fetchFinnhubOwnership(ticker, outstanding);
        if (result) results.set(ticker.toUpperCase(), result);
      } catch (error) {
        errors.set(ticker.toUpperCase(), error instanceof Error ? error.message : String(error));
      }
      doneCount++;
      options.onProgress?.(doneCount, tickers.length);
    }
  };

  const workers = Array.from({ length: Math.min(effectiveConcurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
