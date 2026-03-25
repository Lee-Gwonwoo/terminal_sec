import { config } from "../config.js";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_REQUEST_INTERVAL_MS = 25;

type FmpStockNewsRawItem = {
  symbol?: string;
  symbols?: string[] | string;
  ticker?: string;
  tickers?: string[] | string;
  title?: string;
  text?: string;
  content?: string;
  snippet?: string;
  publishedDate?: string;
  date?: string;
  publishedAt?: string;
  url?: string;
  link?: string;
  publisher?: string;
  site?: string;
};

export interface FmpStockNewsFetchOptions {
  fromDate?: string;
  toDate?: string;
  pageLimit?: number;
  maxPages?: number;
  requestIntervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpStockNewsScheduler: Promise<void> = Promise.resolve();

async function acquireFmpStockNewsSlot(intervalMs: number): Promise<void> {
  const prev = fmpStockNewsScheduler;
  let release!: () => void;
  fmpStockNewsScheduler = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    if (intervalMs > 0) {
      await sleep(intervalMs);
    }
  } finally {
    release();
  }
}

function normalizePublishedAt(value: string | undefined): string {
  if (!value || !value.trim()) {
    return new Date().toISOString().slice(0, 19);
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return parsed.toISOString().slice(0, 19);
}

function parseProviderTickers(ticker: string, item: FmpStockNewsRawItem): string[] {
  const rawValues = [item.symbols, item.tickers, item.symbol, item.ticker]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => String(value ?? "").split(/[|,\s]+/))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (rawValues.length === 0) {
    return [ticker.toUpperCase()];
  }

  return Array.from(new Set(rawValues));
}

async function fetchPage(symbol: string, page: number, pageLimit: number, requestIntervalMs: number): Promise<FmpStockNewsRawItem[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP API key is not configured");
  }

  const url = `${FMP_BASE}/news/stock?symbols=${encodeURIComponent(symbol.toUpperCase())}&page=${page}&limit=${pageLimit}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpStockNewsSlot(requestIntervalMs);
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const backoffMs = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoffMs);
        continue;
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`FMP ${resp.status}: ${body}`);
      }
      const data = await resp.json();
      return Array.isArray(data) ? (data as FmpStockNewsRawItem[]) : [];
    } catch (err: any) {
      const isRetryable = err instanceof TypeError || /429|timeout|network/i.test(err?.message ?? "");
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err;
      }
      await sleep(Math.min(BASE_DELAY_MS * attempt, MAX_BACKOFF_MS));
    }
  }

  return [];
}

function mapRawItem(ticker: string, item: FmpStockNewsRawItem): FinnhubMappedItem | null {
  const publishedAt = normalizePublishedAt(item.publishedDate ?? item.publishedAt ?? item.date);
  const title = String(item.title ?? "").trim();
  const url = String(item.url ?? item.link ?? "").trim();
  if (!title || !url) {
    return null;
  }

  return {
    publishedAt,
    source: "FMP",
    sourceType: "fmp_stock_news",
    title,
    body: String(item.text ?? item.content ?? item.snippet ?? "").trim(),
    url,
    providerTickers: parseProviderTickers(ticker, item),
    tags: [],
    publisher: String(item.publisher ?? item.site ?? "FMP").trim() || "FMP",
  };
}

export async function fetchFmpStockNewsByTicker(
  ticker: string,
  options: FmpStockNewsFetchOptions = {},
): Promise<FinnhubMappedItem[]> {
  const pageLimit = Math.max(1, Math.min(Math.floor(options.pageLimit ?? 100), 100));
  const maxPages = Math.max(1, Math.min(Math.floor(options.maxPages ?? 12), 50));
  const requestIntervalMs = Math.max(0, Math.min(Math.floor(options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS), 5_000));
  const fromDate = options.fromDate;
  const toDate = options.toDate;

  const items: FinnhubMappedItem[] = [];
  const seenUrls = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const rawItems = await fetchPage(ticker, page, pageLimit, requestIntervalMs);
    if (rawItems.length === 0) {
      break;
    }

    let oldestDateOnPage: string | null = null;
    for (const rawItem of rawItems) {
      const mapped = mapRawItem(ticker, rawItem);
      if (!mapped) {
        continue;
      }

      const publishedDate = mapped.publishedAt.slice(0, 10);
      if (!oldestDateOnPage || publishedDate < oldestDateOnPage) {
        oldestDateOnPage = publishedDate;
      }
      if (toDate && publishedDate > toDate) {
        continue;
      }
      if (fromDate && publishedDate < fromDate) {
        continue;
      }
      if (seenUrls.has(mapped.url)) {
        continue;
      }
      seenUrls.add(mapped.url);
      items.push(mapped);
    }

    if (rawItems.length < pageLimit) {
      break;
    }
    if (fromDate && oldestDateOnPage && oldestDateOnPage < fromDate) {
      break;
    }
  }

  return items;
}