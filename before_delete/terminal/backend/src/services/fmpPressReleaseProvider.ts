import { config } from "../config.js";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_REQUEST_INTERVAL_MS = 25;

type FmpPressReleaseRawItem = {
  symbol?: string;
  title?: string;
  text?: string;
  publishedDate?: string;
  url?: string;
  publisher?: string;
  site?: string;
};

export interface FmpPressReleaseFetchOptions {
  fromDate?: string;
  toDate?: string;
  pageLimit?: number;
  maxPages?: number;
  requestIntervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpPressReleaseScheduler: Promise<void> = Promise.resolve();

async function acquireFmpPressReleaseSlot(intervalMs: number): Promise<void> {
  const prev = fmpPressReleaseScheduler;
  let release!: () => void;
  fmpPressReleaseScheduler = new Promise<void>((resolve) => {
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

async function fetchPage(symbol: string, page: number, pageLimit: number, requestIntervalMs: number): Promise<FmpPressReleaseRawItem[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP API key is not configured");
  }

  const url = `${FMP_BASE}/news/press-releases?symbols=${encodeURIComponent(symbol.toUpperCase())}&page=${page}&limit=${pageLimit}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpPressReleaseSlot(requestIntervalMs);
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
      return Array.isArray(data) ? (data as FmpPressReleaseRawItem[]) : [];
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

function mapRawItem(ticker: string, item: FmpPressReleaseRawItem): FinnhubMappedItem | null {
  const publishedAt = normalizePublishedAt(item.publishedDate);
  const title = String(item.title ?? "").trim();
  const url = String(item.url ?? "").trim();
  if (!title || !url) {
    return null;
  }

  const providerTicker = String(item.symbol ?? ticker).trim().toUpperCase() || ticker.toUpperCase();
  return {
    publishedAt,
    source: "FMP",
    sourceType: "fmp_press_release",
    title,
    body: String(item.text ?? "").trim(),
    url,
    providerTickers: [providerTicker],
    tags: [],
    publisher: String(item.publisher ?? item.site ?? "FMP").trim() || "FMP",
  };
}

export async function fetchFmpPressReleasesByTicker(
  ticker: string,
  options: FmpPressReleaseFetchOptions = {},
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