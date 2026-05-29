import { config } from "../config.js";
import { normalizeFmpSymbol } from "../utils/fmpSymbol.js";
import { createFmpRequestScheduler, type FmpRequestScheduler } from "./fmpRequestScheduler.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_FMP_PEERS_CONCURRENCY = 5;
const MAX_FMP_PEERS_CONCURRENCY = 20;
const DEFAULT_FMP_PEERS_INTERVAL_MS = 250;
const MAX_FMP_PEERS_INTERVAL_MS = 5_000;

export interface FmpPeersBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export function clampFmpPeersConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FMP_PEERS_CONCURRENCY;
  }
  return Math.max(1, Math.min(MAX_FMP_PEERS_CONCURRENCY, Math.floor(value as number)));
}

export function clampFmpPeersIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FMP_PEERS_INTERVAL_MS;
  }
  return Math.max(0, Math.min(MAX_FMP_PEERS_INTERVAL_MS, Math.floor(value as number)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPeerSymbol(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim().toUpperCase();
    return trimmed || null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }
  const symbol = (item as Record<string, unknown>).symbol;
  if (typeof symbol !== "string") {
    return null;
  }
  const trimmed = symbol.trim().toUpperCase();
  return trimmed || null;
}

async function fetchFmpPeersWithRetry(ticker: string, requestIntervalMs: number, scheduler: FmpRequestScheduler): Promise<string[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP_API_KEY not configured");
  }

  const providerSymbol = normalizeFmpSymbol(ticker);
  const query = new URLSearchParams({
    symbol: providerSymbol,
    apikey: apiKey,
  });
  const url = `${FMP_BASE}/stock-peers?${query.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const release = await scheduler.acquire(requestIntervalMs);
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`FMP stock-peers ${ticker}: HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) {
        throw new Error(`FMP stock-peers ${ticker}: non-array payload`);
      }

      return Array.from(new Set(
        payload
          .map(getPeerSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ));
    } catch (error) {
      const isTransient = error instanceof TypeError;
      if (!isTransient || attempt === MAX_RETRIES) {
        throw error;
      }
      const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
      await sleep(backoff);
    } finally {
      release();
    }
  }

  throw new Error(`FMP stock-peers ${ticker}: exhausted retries`);
}

export async function fetchFmpPeersBatch(
  tickers: string[],
  options: FmpPeersBatchOptions = {},
): Promise<{ results: Map<string, string[]>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, string[]>();
  const errors = new Map<string, string>();
  const concurrency = clampFmpPeersConcurrency(options.concurrency);
  const requestIntervalMs = clampFmpPeersIntervalMs(options.requestIntervalMs);
  const scheduler = createFmpRequestScheduler({
    maxConcurrentRequests: concurrency,
    requestIntervalMs,
  });

  if (tickers.length === 0) {
    return { results, errors, cancelled: false };
  }

  let doneCount = 0;
  let cancelled = false;
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const index = nextIndex++;
      if (index >= tickers.length) {
        break;
      }
      if (options.shouldCancel?.()) {
        cancelled = true;
        break;
      }

      const ticker = tickers[index].toUpperCase();
      try {
        const peers = await fetchFmpPeersWithRetry(ticker, requestIntervalMs, scheduler);
        results.set(ticker, peers);
      } catch (error) {
        errors.set(ticker, error instanceof Error ? error.message : String(error));
      }
      doneCount++;
      options.onProgress?.(doneCount, tickers.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker()));
  return { results, errors, cancelled };
}