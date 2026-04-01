import YahooFinance from "yahoo-finance2";
import { clampYahooConcurrency, clampYahooIntervalMs } from "./yahooCompanyProfileProvider.js";

const yf = new YahooFinance();

const MAX_RETRIES = 8;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;

export interface YahooOwnershipResult {
  ticker: string;
  holderCount: number;
  institutionalPct: number | null;
  insiderPct: number | null;
  raw: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(ticker: string, intervalMs: number): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (intervalMs > 0) await sleep(intervalMs);
    try {
      // request major holders breakdown
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await yf.quoteSummary(ticker.toUpperCase(), { modules: ["majorHoldersBreakdown"] });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.includes("403") || msg.includes("Too Many");
      const isTransient = isRateLimit || err instanceof TypeError;
      if (isTransient && attempt < MAX_RETRIES) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function fetchYahooOwnership(
  ticker: string,
  // outstandingShares included for compatibility; may be unused depending on Yahoo response
  _outstandingShares: number | null,
  intervalMs: number,
): Promise<YahooOwnershipResult | null> {
  const data = await fetchWithRetry(ticker, intervalMs);
  if (!data) return null;
  // try to extract majorHoldersBreakdown
  // different Yahoo responses may use slightly different keys; be defensive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mh: any = data?.majorHoldersBreakdown ?? data?.majorHolders ?? null;
  if (!mh) return null;

  // Yahoo held-percent fields are ratio-like numeric values, even when they exceed 1.0.
  // For example 1.0067 means 100.67%, not 1.0067%.
  const institutions = mh?.institutionsPercentHeld ?? mh?.institutionsPercent ?? mh?.heldPercentInstitutions ?? null;
  const insiders = mh?.insidersPercentHeld ?? mh?.insidersPercent ?? mh?.heldPercentInsiders ?? null;

  const normalizeYahooHeldPercent = (v: unknown): number | null => {
    if (typeof v === "number") {
      if (!Number.isFinite(v) || v < 0) return null;
      return v <= 10 ? v * 100 : v;
    }
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const n = Number(trimmed.replace(/[^0-9.\-]/g, ""));
      if (Number.isNaN(n) || n < 0) return null;
      if (trimmed.includes("%")) return n;
      return n <= 10 ? n * 100 : n;
    }
    return null;
  };

  const instPct = normalizeYahooHeldPercent(institutions);
  const insPct = normalizeYahooHeldPercent(insiders);

  // try to infer holder count from any array-like field
  let holderCount = 0;
  const arr = mh?.majorHolders ?? mh?.majorHoldersBreakdown ?? mh?.owners ?? null;
  if (Array.isArray(arr)) holderCount = arr.length;

  return {
    ticker: ticker.toUpperCase(),
    holderCount,
    institutionalPct: instPct,
    insiderPct: insPct,
    raw: data,
  };
}

export interface YahooOwnershipBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  // Optional per-ticker log callback used by callers to surface download/progress messages
  onTickerLog?: (msg: string) => void;
  // Persist/process each successful ticker immediately so partial results survive cancellation.
  onResult?: (ticker: string, result: YahooOwnershipResult) => Promise<void> | void;
  shouldCancel?: () => boolean;
}

export async function fetchYahooOwnershipBatch(
  tickers: string[],
  outstandingSharesMap: Map<string, number>,
  opts: YahooOwnershipBatchOptions = {},
): Promise<{ results: Map<string, YahooOwnershipResult>; errors: Map<string, string>; cancelled: boolean }> {
  const concurrency = clampYahooConcurrency(opts.concurrency);
  const intervalMs = clampYahooIntervalMs(opts.requestIntervalMs);
  const { onProgress, shouldCancel, onTickerLog, onResult } = opts;

  const results = new Map<string, YahooOwnershipResult>();
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
      try {
        const outstanding = outstandingSharesMap.get(ticker.toUpperCase()) ?? null;
        onTickerLog?.(`${ticker}: requesting majorHoldersBreakdown from Yahoo`);
        const result = await fetchYahooOwnership(ticker, outstanding, intervalMs);
        if (result) {
          results.set(ticker.toUpperCase(), result);
          const inst = result.institutionalPct != null ? `${result.institutionalPct.toFixed(2)}%` : "N/A";
          const ins = result.insiderPct != null ? `${result.insiderPct.toFixed(2)}%` : "N/A";
          onTickerLog?.(`${ticker}: downloaded ownership payload — institutional ${inst}, insider ${ins}, holders=${result.holderCount}`);
          await onResult?.(ticker.toUpperCase(), result);
        } else {
          errors.set(ticker.toUpperCase(), "No ownership data returned from Yahoo");
          onTickerLog?.(`${ticker}: no ownership data returned from Yahoo`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.set(ticker.toUpperCase(), msg);
        onTickerLog?.(`${ticker}: error - ${msg}`);
      }
      done++;
      onProgress?.(done, tickers.length);
      if (shouldCancel?.()) { cancelled = true; break; }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
