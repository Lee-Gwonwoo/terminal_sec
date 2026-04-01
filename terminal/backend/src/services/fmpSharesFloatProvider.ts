/**
 * fmpSharesFloatProvider.ts
 * FMP shares-float API에서 freeFloat%, floatShares, outstandingShares를 가져온다.
 * Endpoint: https://financialmodelingprep.com/stable/shares-float?symbol={TICKER}&apikey=KEY
 *
 * fmpCompanyProfileProvider와 동일한 throttle 패턴 사용.
 */

import { config } from "../config.js";
import { normalizeFmpSymbol } from "../utils/fmpSymbol.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_INTERVAL_MS = 250;

export interface FmpSharesFloat {
  symbol: string;
  freeFloat: number | null;
  floatShares: number | null;
  outstandingShares: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Process-global FMP throttle (shared sequencer) ───────────── */
let scheduler: Promise<void> = Promise.resolve();

async function acquireSlot(intervalMs: number): Promise<void> {
  const prev = scheduler;
  let release!: () => void;
  scheduler = new Promise<void>((r) => { release = r; });
  await prev;
  try {
    if (intervalMs > 0) await sleep(intervalMs);
  } finally {
    release();
  }
}

async function fetchOne(ticker: string, intervalMs: number): Promise<FmpSharesFloat | null> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) return null;

  const providerSymbol = normalizeFmpSymbol(ticker);
  const url = `${FMP_BASE}/shares-float?symbol=${encodeURIComponent(providerSymbol)}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireSlot(intervalMs);
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || typeof data !== "object") return null;
      // API can return array or single object
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return null;
      return {
        symbol: ticker.toUpperCase(),
        freeFloat: typeof item.freeFloat === "number" && Number.isFinite(item.freeFloat) ? item.freeFloat : null,
        floatShares: typeof item.floatShares === "number" && Number.isFinite(item.floatShares) ? item.floatShares : null,
        outstandingShares: typeof item.outstandingShares === "number" && Number.isFinite(item.outstandingShares) ? item.outstandingShares : null,
      };
    } catch {
      if (attempt === MAX_RETRIES) return null;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  return null;
}

export interface FmpSharesFloatBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export async function fetchFmpSharesFloatBatch(
  tickers: string[],
  options: FmpSharesFloatBatchOptions = {},
): Promise<{ results: Map<string, FmpSharesFloat>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, FmpSharesFloat>();
  const errors = new Map<string, string>();
  const concurrency = Math.max(1, Math.min(20, options.concurrency ?? DEFAULT_CONCURRENCY));
  const intervalMs = Math.max(0, options.requestIntervalMs ?? DEFAULT_INTERVAL_MS);

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
        const data = await fetchOne(ticker, intervalMs);
        if (data) results.set(ticker.toUpperCase(), data);
      } catch (error) {
        errors.set(ticker.toUpperCase(), error instanceof Error ? error.message : String(error));
      }
      doneCount++;
      options.onProgress?.(doneCount, tickers.length);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
