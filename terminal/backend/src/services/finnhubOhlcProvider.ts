// finnhubOhlcProvider.ts — Finnhub /stock/candle daily OHLC provider

import { config } from "../config.js";
import type { OhlcBar } from "./ohlcWatchlistRepository.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubCandleResponse {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;   // "ok" | "no_data"
  t: number[];
  v: number[];
}

/**
 * Fetch daily OHLCV bars for a single symbol from Finnhub /stock/candle.
 * @param symbol  e.g. "AAPL"
 * @param from    "YYYY-MM-DD" inclusive
 * @param to      "YYYY-MM-DD" inclusive
 * @returns sorted OhlcBar[] (ascending by date). Empty array if no data.
 */
export async function fetchOhlcFromFinnhub(
  symbol: string,
  from: string,
  to: string,
): Promise<OhlcBar[]> {
  const fromUnix = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const toUnix = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);

  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromUnix}&to=${toUnix}&token=${config.finnhubApiKey}`;

  const res = await fetch(url);
  if (res.status === 429) {
    throw new Error(`Finnhub rate limit hit for ${symbol}`);
  }
  if (!res.ok) {
    throw new Error(`Finnhub candle ${symbol}: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as FinnhubCandleResponse;
  if (data.s !== "ok" || !data.t?.length) {
    return [];
  }

  const bars: OhlcBar[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const date = new Date(data.t[i] * 1000).toISOString().slice(0, 10);
    bars.push({
      Datetime: date,
      Open: data.o[i],
      High: data.h[i],
      Low: data.l[i],
      Close: data.c[i],
      Volume: data.v[i],
    });
  }

  bars.sort((a, b) => a.Datetime.localeCompare(b.Datetime));
  return bars;
}

/**
 * Batch-fetch daily OHLC for multiple symbols with rate-limit-aware delays.
 * Returns fetched bars per symbol. Failures are collected but don't stop the batch.
 */
export async function fetchOhlcFromFinnhubBatch(
  tickers: string[],
  from: string,
  to: string,
  delayMs = 150,
  onProgress?: (done: number, total: number) => void,
): Promise<{ results: Map<string, OhlcBar[]>; errors: Map<string, string> }> {
  const results = new Map<string, OhlcBar[]>();
  const errors = new Map<string, string>();

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      const bars = await fetchOhlcFromFinnhub(ticker, from, to);
      results.set(ticker, bars);
    } catch (err) {
      errors.set(ticker, err instanceof Error ? err.message : String(err));
    }
    onProgress?.(i + 1, tickers.length);
    if (i < tickers.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { results, errors };
}
