import { config } from "../config.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

/**
 * Fetch peers for a single ticker from Finnhub /stock/peers.
 * Returns an array of ticker strings (includes the queried ticker itself).
 */
export async function fetchFinnhubPeers(symbol: string): Promise<string[]> {
  const url = `${FINNHUB_BASE}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${config.finnhubApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub peers ${symbol}: ${res.status} ${res.statusText}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((t): t is string => typeof t === "string");
}

/**
 * Batch-fetch peers for multiple tickers with rate-limit-aware delays.
 * Returns a Map of ticker → peers array.
 * Failures are collected but don't stop the batch.
 */
export async function fetchFinnhubPeersBatch(
  tickers: string[],
  delayMs = 120,
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean,
): Promise<{ results: Map<string, string[]>; errors: Map<string, string>; cancelled: boolean }> {
  const results = new Map<string, string[]>();
  const errors = new Map<string, string>();
  let cancelled = false;

  for (let i = 0; i < tickers.length; i++) {
    if (shouldCancel?.()) {
      cancelled = true;
      break;
    }
    const ticker = tickers[i];
    try {
      const peers = await fetchFinnhubPeers(ticker);
      results.set(ticker, peers);
    } catch (err) {
      errors.set(ticker, err instanceof Error ? err.message : String(err));
    }
    onProgress?.(i + 1, tickers.length);
    if (i < tickers.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { results, errors, cancelled };
}
