import { config } from "../config.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_FMP_REQUEST_INTERVAL_MS = 250;

export interface FmpEarningsCalendarItem {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  lastUpdated: string | null;
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpCalendarScheduler: Promise<void> = Promise.resolve();

async function acquireFmpCalendarSlot(intervalMs: number): Promise<void> {
  const previous = fmpCalendarScheduler;
  let release!: () => void;
  fmpCalendarScheduler = new Promise<void>((resolve) => {
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

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapFmpEarningsItem(item: Record<string, unknown>): FmpEarningsCalendarItem | null {
  const symbol = toNullableString(item.symbol)?.toUpperCase();
  const date = toNullableString(item.date);
  if (!symbol || !date) {
    return null;
  }
  return {
    symbol,
    date,
    epsActual: toNullableNumber(item.epsActual ?? item.eps_actual ?? item.actualEps),
    epsEstimated: toNullableNumber(item.epsEstimated ?? item.eps_estimated ?? item.estimatedEps),
    revenueActual: toNullableNumber(item.revenueActual ?? item.revenue_actual ?? item.actualRevenue),
    revenueEstimated: toNullableNumber(item.revenueEstimated ?? item.revenue_estimated ?? item.estimatedRevenue),
    lastUpdated: toNullableString(item.lastUpdated ?? item.updatedAt ?? item.updated_at),
    raw: item,
  };
}

export async function fetchFmpEarningsCalendarChunk(params: {
  from: string;
  to: string;
  requestIntervalMs?: number;
}): Promise<FmpEarningsCalendarItem[]> {
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
  const url = `${FMP_BASE}/earnings-calendar?${query.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpCalendarSlot(intervalMs);
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(`FMP earnings calendar HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) {
        throw new Error("FMP earnings calendar returned a non-array payload");
      }

      const items: FmpEarningsCalendarItem[] = [];
      for (const entry of payload) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const mapped = mapFmpEarningsItem(entry as Record<string, unknown>);
        if (mapped) {
          items.push(mapped);
        }
      }
      return items;
    } catch (error) {
      const isTransient = error instanceof TypeError;
      if (!isTransient || attempt === MAX_RETRIES) {
        throw error;
      }
      const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
      await sleep(backoff);
    }
  }

  throw new Error("FMP earnings calendar request exhausted retries");
}