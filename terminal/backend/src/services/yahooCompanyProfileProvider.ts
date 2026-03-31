/**
 * yahooCompanyProfileProvider.ts
 * yahoo-finance2 wrapper를 통해 company profile/description을 가져온다.
 * Endpoint: quoteSummary(symbol, { modules: ["assetProfile"] })
 *
 * FMP provider와 동일한 병렬 worker pool + 프로세스 전역 throttle 구조.
 */

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;

const DEFAULT_YAHOO_CONCURRENCY = 5;
// Allow up to 50 parallel Yahoo requests when requested (subject to caller choice).
const MAX_YAHOO_CONCURRENCY = 50;
const DEFAULT_YAHOO_INTERVAL_MS = 200;
const MAX_YAHOO_INTERVAL_MS = 5000;

export interface YahooProfile {
  symbol: string;
  longBusinessSummary: string;
  sector: string;
  industry: string;
  website: string;
  raw: Record<string, unknown>;
}

export interface YahooBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export function clampYahooConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_YAHOO_CONCURRENCY;
  return Math.max(1, Math.min(MAX_YAHOO_CONCURRENCY, Math.floor(value as number)));
}

export function clampYahooIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_YAHOO_INTERVAL_MS;
  return Math.max(0, Math.min(MAX_YAHOO_INTERVAL_MS, Math.floor(value as number)));
}

export function getYahooDefaults(): { concurrency: number; requestIntervalMs: number } {
  return { concurrency: DEFAULT_YAHOO_CONCURRENCY, requestIntervalMs: DEFAULT_YAHOO_INTERVAL_MS };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Process-global Yahoo throttle ──────────────────────────────── */
let yahooScheduler: Promise<void> = Promise.resolve();

async function acquireYahooSlot(intervalMs: number): Promise<void> {
  const prev = yahooScheduler;
  let release!: () => void;
  yahooScheduler = new Promise<void>((r) => { release = r; });
  await prev;
  try {
    if (intervalMs > 0) await sleep(intervalMs);
  } finally {
    release();
  }
}

/**
 * Fetch a single ticker's profile from Yahoo with retry + backoff.
 */
async function fetchYahooProfileWithRetry(ticker: string, intervalMs: number): Promise<YahooProfile | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireYahooSlot(intervalMs);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await yf.quoteSummary(ticker.toUpperCase(), {
        modules: ["assetProfile"],
      });
      const ap = result?.assetProfile;
      if (!ap) return null;

      return {
        symbol: ticker.toUpperCase(),
        longBusinessSummary: String(ap.longBusinessSummary ?? ""),
        sector: String(ap.sector ?? ""),
        industry: String(ap.industry ?? ""),
        website: String(ap.website ?? ""),
        raw: ap as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // 429/403 → backoff retry
      const isRateLimit = msg.includes("429") || msg.includes("403") || msg.includes("Too Many");
      const isTransient = isRateLimit || err instanceof TypeError;
      if (isTransient && attempt < MAX_RETRIES) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        console.warn(`[Yahoo] profile ${ticker}: ${isRateLimit ? "rate limited" : "transient error"}, retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      console.warn(`[Yahoo] profile ${ticker}: fetch failed after ${attempt} attempts:`, msg);
      return null;
    }
  }
  console.warn(`[Yahoo] profile ${ticker}: exhausted ${MAX_RETRIES} retries`);
  return null;
}

/**
 * Fetch profiles for multiple tickers using a parallel worker pool.
 */
export async function fetchYahooProfilesBatch(
  tickers: string[],
  opts: YahooBatchOptions = {},
): Promise<{ results: Map<string, YahooProfile>; errors: Map<string, string>; cancelled: boolean }> {
  const concurrency = clampYahooConcurrency(opts.concurrency);
  const intervalMs = clampYahooIntervalMs(opts.requestIntervalMs);
  const { onProgress, shouldCancel } = opts;

  const results = new Map<string, YahooProfile>();
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

      const profile = await fetchYahooProfileWithRetry(ticker, intervalMs);
      if (shouldCancel?.()) { cancelled = true; break; }

      if (profile) {
        results.set(ticker.toUpperCase(), profile);
      } else {
        errors.set(ticker.toUpperCase(), "No profile returned from Yahoo");
      }
      done++;
      onProgress?.(done, tickers.length);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
