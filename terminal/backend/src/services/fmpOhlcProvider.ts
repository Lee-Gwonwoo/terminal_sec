import { config } from "../config.js";
import type { OhlcBar } from "./ohlcWatchlistRepository.js";
import { normalizeFmpSymbol } from "../utils/fmpSymbol.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_FMP_OHLC_CONCURRENCY = 5;
const MAX_FMP_OHLC_CONCURRENCY = 20;
const DEFAULT_FMP_OHLC_INTERVAL_MS = 250;
const MAX_FMP_OHLC_INTERVAL_MS = 5000;

type FmpOhlcRawRow = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export interface FmpOhlcBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  onLog?: (msg: string) => void;
  shouldCancel?: () => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clampFmpOhlcConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FMP_OHLC_CONCURRENCY;
  return Math.max(1, Math.min(MAX_FMP_OHLC_CONCURRENCY, Math.floor(value as number)));
}

export function clampFmpOhlcIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FMP_OHLC_INTERVAL_MS;
  return Math.max(0, Math.min(MAX_FMP_OHLC_INTERVAL_MS, Math.floor(value as number)));
}

let fmpOhlcScheduler: Promise<void> = Promise.resolve();

async function acquireFmpOhlcSlot(intervalMs: number): Promise<void> {
  const prev = fmpOhlcScheduler;
  let release!: () => void;
  fmpOhlcScheduler = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    if (intervalMs > 0) await sleep(intervalMs);
  } finally {
    release();
  }
}

function normalizeFmpBar(row: FmpOhlcRawRow): OhlcBar | null {
  const date = typeof row.date === "string" ? row.date.trim().slice(0, 10) : "";
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume ?? 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (![open, high, low, close, volume].every(Number.isFinite)) return null;
  return {
    Datetime: date,
    Open: open,
    High: high,
    Low: low,
    Close: close,
    Volume: volume,
  };
}

async function fetchFmpDailyOhlcWithRetry(
  ticker: string,
  from: string,
  to: string,
  intervalMs: number,
): Promise<OhlcBar[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP API key is not configured");
  }

  const providerSymbol = normalizeFmpSymbol(ticker);
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${encodeURIComponent(providerSymbol)}&from=${from}&to=${to}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpOhlcSlot(intervalMs);
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`FMP OHLC ${ticker}: HTTP ${resp.status}${text ? ` - ${text}` : ""}`);
      }
      const data = await resp.json() as unknown;
      if (!Array.isArray(data)) {
        return [];
      }
      return data
        .map((row) => normalizeFmpBar((row ?? {}) as FmpOhlcRawRow))
        .filter((row): row is OhlcBar => row !== null)
        .sort((left, right) => left.Datetime.localeCompare(right.Datetime));
    } catch (error) {
      const isTransient = error instanceof TypeError;
      if (!isTransient || attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  return [];
}

export async function fetchFmpOhlcBatch(
  tickers: string[],
  from: string,
  to: string,
  opts: FmpOhlcBatchOptions = {},
): Promise<{ results: Map<string, OhlcBar[]>; errors: Map<string, string>; cancelled: boolean }> {
  const concurrency = clampFmpOhlcConcurrency(opts.concurrency);
  const intervalMs = clampFmpOhlcIntervalMs(opts.requestIntervalMs);
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))];
  const results = new Map<string, OhlcBar[]>();
  const errors = new Map<string, string>();
  let idx = 0;
  let done = 0;
  let cancelled = false;
  const logInterval = Math.max(50, Math.floor(uniqueTickers.length / 10)); // log every ~10%

  const worker = async () => {
    while (!cancelled) {
      if (opts.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const myIdx = idx++;
      if (myIdx >= uniqueTickers.length) break;
      const ticker = uniqueTickers[myIdx];
      try {
        const bars = await fetchFmpDailyOhlcWithRetry(ticker, from, to, intervalMs);
        results.set(ticker, bars);
      } catch (error) {
        errors.set(ticker, error instanceof Error ? error.message : String(error));
      }
      done++;
      opts.onProgress?.(done, uniqueTickers.length);
      if (opts.onLog && (done % logInterval === 0 || done === uniqueTickers.length)) {
        opts.onLog(`[FMP fetch] ${done}/${uniqueTickers.length} tickers (${Math.round(done / uniqueTickers.length * 100)}%), errors=${errors.size}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueTickers.length) }, () => worker()));
  return { results, errors, cancelled };
}