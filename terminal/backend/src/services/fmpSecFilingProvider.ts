import { config } from "../config.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_REQUEST_INTERVAL_MS = 300;

export type FmpSecFilingRawItem = {
  symbol?: string;
  cik?: string;
  filingDate?: string;
  acceptedDate?: string;
  formType?: string;
  hasFinancials?: boolean;
  link?: string;
  finalLink?: string;
};

export interface FmpSecFilingMapped {
  symbol: string;
  cik: string;
  formType: string;
  filingDate: string;
  acceptedDate: string;
  link: string;
  finalLink: string;
  accessionNumber: string;
  /** Constructed title, e.g. "AAPL: 10-K" */
  title: string;
  /** Constructed body, e.g. "Filed 2026-03-20, accepted 2026-03-20 17:27:48. CIK: 0000320193." */
  body: string;
}

export interface FmpSecFilingFetchOptions {
  fromDate: string;
  toDate: string;
  limit?: number;
  maxPages?: number;
  requestIntervalMs?: number;
  universeSymbols?: Set<string>;
}

function encodeDateRangeValue(value: string): string {
  return encodeURIComponent(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpSecScheduler: Promise<void> = Promise.resolve();

async function acquireSlot(intervalMs: number): Promise<void> {
  const prev = fmpSecScheduler;
  let release!: () => void;
  fmpSecScheduler = new Promise<void>((resolve) => {
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

/**
 * Extract the SEC accession number from a filing index URL.
 * e.g. ".../000110465924030026/0001104659-24-030026-index.htm" → "0001104659-24-030026"
 */
function extractAccessionNumber(link: string): string | null {
  const match = link.match(/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : null;
}

function normalizeDateTime(value: string | undefined | null): string {
  if (!value || !value.trim()) {
    return new Date().toISOString().slice(0, 19);
  }
  const trimmed = value.trim();
  // "2026-03-20 17:27:48" → "2026-03-20T17:27:48"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // "2026-03-20 00:00:00" date-only → "2026-03-20T00:00:00"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00`;
  }
  return trimmed;
}

function isDateWithinRange(value: string, fromDate: string, toDate: string): boolean {
  const dateOnly = value.slice(0, 10);
  return dateOnly >= fromDate && dateOnly <= toDate;
}

function mapRawItem(item: FmpSecFilingRawItem): FmpSecFilingMapped | null {
  const symbol = String(item.symbol ?? "").trim().toUpperCase();
  if (!symbol || symbol === "NONE") return null;

  const link = String(item.link ?? "").trim();
  const finalLink = String(item.finalLink ?? "").trim();
  if (!link) return null;

  const accessionNumber = extractAccessionNumber(link);
  if (!accessionNumber) return null;

  const cik = String(item.cik ?? "").trim();
  const formType = String(item.formType ?? "").trim();
  const filingDate = normalizeDateTime(item.filingDate);
  const acceptedDate = normalizeDateTime(item.acceptedDate);

  const title = `${symbol}: ${formType || "SEC Filing"}`;
  const filingDateShort = filingDate.slice(0, 10);
  const body = `Filed ${filingDateShort}, accepted ${acceptedDate.replace("T", " ")}. CIK: ${cik}.`;

  return {
    symbol,
    cik,
    formType,
    filingDate,
    acceptedDate,
    link,
    finalLink: finalLink || link,
    accessionNumber,
    title,
    body,
  };
}

async function fetchPage(
  symbol: string,
  fromDate: string,
  toDate: string,
  page: number,
  limit: number,
  requestIntervalMs: number,
): Promise<FmpSecFilingRawItem[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP API key is not configured");
  }

  const url = `${FMP_BASE}/sec-filings-search/symbol?symbol=${encodeURIComponent(symbol)}&from=${encodeDateRangeValue(fromDate)}&to=${encodeDateRangeValue(toDate)}&page=${page}&limit=${limit}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireSlot(requestIntervalMs);
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
      return Array.isArray(data) ? (data as FmpSecFilingRawItem[]) : [];
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

/**
 * Fetch FMP SEC filings for a date range by walking FMP's symbol-search
 * endpoint across the requested universe. Deduplicates by accession number.
 */
export async function fetchFmpSecFilings(
  options: FmpSecFilingFetchOptions,
): Promise<FmpSecFilingMapped[]> {
  const limit = Math.max(1, Math.min(Math.floor(options.limit ?? 100), 100));
  const maxPages = Math.max(1, Math.min(Math.floor(options.maxPages ?? 20), 100));
  const requestIntervalMs = Math.max(0, Math.min(Math.floor(options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS), 5_000));
  const symbols = Array.from(options.universeSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return [];
  }

  const items: FmpSecFilingMapped[] = [];
  const seenAccessions = new Set<string>();

  for (const symbol of symbols) {
    for (let page = 0; page < maxPages; page++) {
      const rawItems = await fetchPage(symbol, options.fromDate, options.toDate, page, limit, requestIntervalMs);
      if (rawItems.length === 0) break;

      for (const raw of rawItems) {
        const mapped = mapRawItem(raw);
        if (!mapped) continue;
        if (!isDateWithinRange(mapped.acceptedDate || mapped.filingDate, options.fromDate, options.toDate)) continue;
        if (seenAccessions.has(mapped.accessionNumber)) continue;
        seenAccessions.add(mapped.accessionNumber);
        items.push(mapped);
      }

      if (rawItems.length < limit) break;
    }
  }

  return items;
}
