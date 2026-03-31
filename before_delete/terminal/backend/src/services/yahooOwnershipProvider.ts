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

  // typical fields: insidersPercentHeld, institutionsPercentHeld
  let institutions = mh?.institutionsPercentHeld ?? mh?.institutionsPercent ?? mh?.heldPercentInstitutions ?? null;
  let insiders = mh?.insidersPercentHeld ?? mh?.insidersPercent ?? mh?.heldPercentInsiders ?? null;

  const normalizePct = (v: unknown): number | null => {
    if (typeof v === "number") {
      if (v > 0 && v <= 1) return v * 100;
      if (v > 1 && v <= 100) return v;
    }
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.\-]/g, ""));
      if (!Number.isNaN(n)) {
        if (n > 0 && n <= 1) return n * 100;
        if (n > 1 && n <= 100) return n;
      }
    }
    return null;
  };

  const instPct = normalizePct(institutions);
  const insPct = normalizePct(insiders);

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
  shouldCancel?: () => boolean;
}

export async function fetchYahooOwnershipBatch(
  tickers: string[],
  outstandingSharesMap: Map<string, number>,
  opts: YahooOwnershipBatchOptions = {},
): Promise<{ results: Map<string, YahooOwnershipResult>; errors: Map<string, string>; cancelled: boolean }> {
  const concurrency = clampYahooConcurrency(opts.concurrency);
  const intervalMs = clampYahooIntervalMs(opts.requestIntervalMs);
  const { onProgress, shouldCancel } = opts;

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
        const result = await fetchYahooOwnership(ticker, outstanding, intervalMs);
        if (shouldCancel?.()) { cancelled = true; break; }
        if (result) results.set(ticker.toUpperCase(), result);
        else errors.set(ticker.toUpperCase(), "No ownership data returned from Yahoo");
      } catch (err) {
        errors.set(ticker.toUpperCase(), err instanceof Error ? err.message : String(err));
      }
      done++;
      onProgress?.(done, tickers.length);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker());
  await Promise.all(workers);
  return { results, errors, cancelled };
}
