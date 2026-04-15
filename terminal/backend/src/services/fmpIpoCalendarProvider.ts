import { config } from "../config.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_FMP_REQUEST_INTERVAL_MS = 250;

export interface FmpIpoCalendarItem {
  symbol: string | null;
  date: string;
  daa: string | null;
  company: string | null;
  exchange: string | null;
  action: string | null;
  shares: number | null;
  priceRange: string | null;
  marketCap: number | null;
  raw: Record<string, unknown>;
}

export interface FmpIpoDisclosureItem {
  symbol: string | null;
  filingDate: string | null;
  acceptedDate: string | null;
  effectivenessDate: string | null;
  cik: string | null;
  form: string | null;
  url: string | null;
  raw: Record<string, unknown>;
}

export interface FmpIpoProspectusItem {
  symbol: string | null;
  filingDate: string | null;
  acceptedDate: string | null;
  ipoDate: string | null;
  cik: string | null;
  form: string | null;
  url: string | null;
  pricePublicPerShare: number | null;
  pricePublicTotal: number | null;
  proceedsBeforeExpensesTotal: number | null;
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpIpoScheduler: Promise<void> = Promise.resolve();

async function acquireFmpIpoSlot(intervalMs: number): Promise<void> {
  const previous = fmpIpoScheduler;
  let release!: () => void;
  fmpIpoScheduler = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    if (intervalMs > 0) {
      await sleep(intervalMs);
    }
  } finally {
    release();
  }
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchFmpStableArray(params: {
  endpoint: string;
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<Record<string, unknown>[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP_API_KEY not configured");
  }

  const intervalMs = Number.isFinite(params.requestIntervalMs)
    ? Math.max(0, Math.min(5_000, Math.round(params.requestIntervalMs as number)))
    : DEFAULT_FMP_REQUEST_INTERVAL_MS;

  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    apikey: apiKey,
  });
  const url = `${FMP_BASE}/${params.endpoint}?${query.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpIpoSlot(intervalMs);
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`FMP ${params.endpoint} HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) {
        throw new Error(`FMP ${params.endpoint} returned a non-array payload`);
      }
      return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
    } catch (error) {
      const isTransient = error instanceof TypeError;
      if (!isTransient || attempt === MAX_RETRIES) {
        throw error;
      }
      const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
      await sleep(backoff);
    }
  }

  throw new Error(`FMP ${params.endpoint} request exhausted retries`);
}

function mapFmpIpoCalendarItem(item: Record<string, unknown>): FmpIpoCalendarItem | null {
  const date = toNullableString(item.date);
  if (!date) {
    return null;
  }

  return {
    symbol: toNullableString(item.symbol)?.toUpperCase() ?? null,
    date,
    daa: toNullableString(item.daa),
    company: toNullableString(item.company),
    exchange: toNullableString(item.exchange),
    action: toNullableString(item.actions ?? item.action),
    shares: toNullableNumber(item.shares),
    priceRange: toNullableString(item.priceRange ?? item.price_range),
    marketCap: toNullableNumber(item.marketCap ?? item.market_cap),
    raw: item,
  };
}

function mapFmpIpoDisclosureItem(item: Record<string, unknown>): FmpIpoDisclosureItem | null {
  const filingDate = toNullableString(item.filingDate ?? item.date);
  const acceptedDate = toNullableString(item.acceptedDate);
  const url = toNullableString(item.url);
  if (!filingDate && !acceptedDate && !url) {
    return null;
  }

  return {
    symbol: toNullableString(item.symbol)?.toUpperCase() ?? null,
    filingDate,
    acceptedDate,
    effectivenessDate: toNullableString(item.effectivenessDate),
    cik: toNullableString(item.cik),
    form: toNullableString(item.form),
    url,
    raw: item,
  };
}

function mapFmpIpoProspectusItem(item: Record<string, unknown>): FmpIpoProspectusItem | null {
  const filingDate = toNullableString(item.filingDate);
  const acceptedDate = toNullableString(item.acceptedDate);
  const ipoDate = toNullableString(item.ipoDate ?? item.date);
  const url = toNullableString(item.url);
  if (!filingDate && !acceptedDate && !ipoDate && !url) {
    return null;
  }

  return {
    symbol: toNullableString(item.symbol)?.toUpperCase() ?? null,
    filingDate,
    acceptedDate,
    ipoDate,
    cik: toNullableString(item.cik),
    form: toNullableString(item.form),
    url,
    pricePublicPerShare: toNullableNumber(item.pricePublicPerShare),
    pricePublicTotal: toNullableNumber(item.pricePublicTotal),
    proceedsBeforeExpensesTotal: toNullableNumber(item.proceedsBeforeExpensesTotal),
    raw: item,
  };
}

export async function fetchFmpIpoCalendarChunk(params: {
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<FmpIpoCalendarItem[]> {
  const payload = await fetchFmpStableArray({
    endpoint: "ipos-calendar",
    from: params.from,
    to: params.to,
    requestIntervalMs: params.requestIntervalMs,
  });

  return payload
    .map(mapFmpIpoCalendarItem)
    .filter((item): item is FmpIpoCalendarItem => Boolean(item));
}

export async function fetchFmpIpoDisclosureChunk(params: {
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<FmpIpoDisclosureItem[]> {
  const payload = await fetchFmpStableArray({
    endpoint: "ipos-disclosure",
    from: params.from,
    to: params.to,
    requestIntervalMs: params.requestIntervalMs,
  });

  return payload
    .map(mapFmpIpoDisclosureItem)
    .filter((item): item is FmpIpoDisclosureItem => Boolean(item));
}

export async function fetchFmpIpoProspectusChunk(params: {
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<FmpIpoProspectusItem[]> {
  const payload = await fetchFmpStableArray({
    endpoint: "ipos-prospectus",
    from: params.from,
    to: params.to,
    requestIntervalMs: params.requestIntervalMs,
  });

  return payload
    .map(mapFmpIpoProspectusItem)
    .filter((item): item is FmpIpoProspectusItem => Boolean(item));
}