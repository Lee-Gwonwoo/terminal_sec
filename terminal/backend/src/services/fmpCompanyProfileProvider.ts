/**
 * fmpCompanyProfileProvider.ts
 * Financial Modeling Prep (FMP) API에서 company profile/description을 가져온다.
 * Endpoint: https://financialmodelingprep.com/stable/profile?symbol={TICKER}&apikey=KEY
 *
 * 병렬 worker pool 구조로 빠르게 처리하되, 프로세스 전역 throttle로 429를 방지한다.
 */

import { config } from "../config.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;

const DEFAULT_FMP_CONCURRENCY = 5;
const MAX_FMP_CONCURRENCY = 20;
const DEFAULT_FMP_INTERVAL_MS = 250;
const MAX_FMP_INTERVAL_MS = 5000;

export interface FmpProfile {
  symbol: string;
  companyName: string;
  description: string;
  ceo: string;
  sector: string;
  industry: string;
  website: string;
  ipoDate: string;
  mktCap: number;
  fullTimeEmployees: string;
  exchangeShortName: string;
  // full raw JSON preserved
  raw: Record<string, unknown>;
}

export interface FmpBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export function clampFmpConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FMP_CONCURRENCY;
  return Math.max(1, Math.min(MAX_FMP_CONCURRENCY, Math.floor(value as number)));
}

export function clampFmpIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FMP_INTERVAL_MS;
  return Math.max(0, Math.min(MAX_FMP_INTERVAL_MS, Math.floor(value as number)));
}

export function getFmpDefaults(): { concurrency: number; requestIntervalMs: number } {
  return { concurrency: DEFAULT_FMP_CONCURRENCY, requestIntervalMs: DEFAULT_FMP_INTERVAL_MS };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Process-global FMP throttle ──────────────────────────────────── */
let fmpScheduler: Promise<void> = Promise.resolve();

async function acquireFmpSlot(intervalMs: number): Promise<void> {
  const prev = fmpScheduler;
  let release!: () => void;
  fmpScheduler = new Promise<void>((r) => { release = r; });
  await prev;
  try {
    if (intervalMs > 0) await sleep(intervalMs);
  } finally {
    release();
  }
}

/**
 * Fetch a single ticker's profile from FMP with retry + backoff.
 * Returns null if not found or API key missing.
 */
async function fetchFmpProfileWithRetry(ticker: string, intervalMs: number): Promise<FmpProfile | null> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    console.warn("[FMP] API key not configured, skipping fetchFmpProfile");
    return null;
  }

  const url = `${FMP_BASE}/profile?symbol=${encodeURIComponent(ticker.toUpperCase())}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpSlot(intervalMs);
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        console.warn(`[FMP] profile ${ticker}: 429 rate limited, retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      if (!resp.ok) {
        console.warn(`[FMP] profile ${ticker}: HTTP ${resp.status}`);
        return null;
      }
      const data = await resp.json() as Record<string, unknown>[];
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }
      const item = data[0];
      return {
        symbol: String(item.symbol ?? ticker),
        companyName: String(item.companyName ?? ""),
        description: String(item.description ?? ""),
        ceo: String(item.ceo ?? ""),
        sector: String(item.sector ?? ""),
        industry: String(item.industry ?? ""),
        website: String(item.website ?? ""),
        ipoDate: String(item.ipoDate ?? ""),
        mktCap: Number(item.mktCap ?? 0),
        fullTimeEmployees: String(item.fullTimeEmployees ?? ""),
        exchangeShortName: String(item.exchangeShortName ?? ""),
        raw: item,
      };
    } catch (err) {
      const isTransient = err instanceof TypeError; // network error
      if (!isTransient || attempt === MAX_RETRIES) {
        console.warn(`[FMP] profile ${ticker}: fetch failed after ${attempt} attempts:`, err);
        return null;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  console.warn(`[FMP] profile ${ticker}: rate-limited after ${MAX_RETRIES} retries`);
  return null;
}

/** Backwards-compatible single-ticker fetch. */
export async function fetchFmpProfile(ticker: string): Promise<FmpProfile | null> {
  return fetchFmpProfileWithRetry(ticker, DEFAULT_FMP_INTERVAL_MS);
}

/**
 * Fetch profiles for multiple tickers using a parallel worker pool.
 * All workers share the process-global FMP throttle.
 */
export async function fetchFmpProfilesBatch(
  tickers: string[],
  opts: FmpBatchOptions = {},
): Promise<{ results: Map<string, FmpProfile>; errors: Map<string, string>; cancelled: boolean }> {
  const concurrency = clampFmpConcurrency(opts.concurrency);
  const intervalMs = clampFmpIntervalMs(opts.requestIntervalMs);
  const { onProgress, shouldCancel } = opts;

  const results = new Map<string, FmpProfile>();
  const errors = new Map<string, string>();
  let cancelled = false;
  let done = 0;
  let idx = 0;

  const worker = async () => {
    while (!cancelled) {
      if (shouldCancel?.()) { cancelled = true; break; }
      const myIdx = idx++;
      if (myIdx >= tickers.length) break;
      const ticker = tickers[myIdx];

      const profile = await fetchFmpProfileWithRetry(ticker, intervalMs);
      if (shouldCancel?.()) { cancelled = true; break; }

      if (profile) {
        results.set(ticker.toUpperCase(), profile);
      } else {
        errors.set(ticker.toUpperCase(), "No profile returned from FMP");
      }
      done++;
      onProgress?.(done, tickers.length);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
