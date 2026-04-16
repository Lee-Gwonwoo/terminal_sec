import { config } from "../config.js";
import { normalizeFmpSymbol } from "../utils/fmpSymbol.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 300;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_FMP_REQUEST_INTERVAL_MS = 250;
const DEFAULT_ANNUAL_LIMIT = 6;
const DEFAULT_QUARTERLY_LIMIT = 8;

type FinancialPeriodMode = "annual" | "quarter";

export interface FmpFinancialSeriesPoint {
  date: string;
  fiscalYear: string | null;
  period: string | null;
  label: string;
  revenue: number | null;
  revenueEstimate: number | null;
  netIncome: number | null;
  netIncomeEstimate: number | null;
  eps: number | null;
  epsEstimate: number | null;
  marketCap: number | null;
  peRatio: number | null;
  psRatio: number | null;
  numAnalystsRevenue: number | null;
  numAnalystsEps: number | null;
}

export interface FmpFinancialSeriesResponse {
  ticker: string;
  source: "FMP";
  annual: FmpFinancialSeriesPoint[];
  quarterly: FmpFinancialSeriesPoint[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let fmpFinancialScheduler: Promise<void> = Promise.resolve();

async function acquireFmpFinancialSlot(intervalMs: number): Promise<void> {
  const previous = fmpFinancialScheduler;
  let release!: () => void;
  fmpFinancialScheduler = new Promise<void>((resolve) => {
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

function toNullableInteger(value: unknown): number | null {
  const numeric = toNullableNumber(value);
  if (numeric == null) {
    return null;
  }
  const rounded = Math.round(numeric);
  return Number.isFinite(rounded) ? rounded : null;
}

function deriveAnnualFiscalYear(item: Record<string, unknown>): string | null {
  const fiscalYear = toNullableString(item.fiscalYear ?? item.calendarYear);
  if (fiscalYear) {
    return fiscalYear;
  }
  const date = toNullableString(item.date);
  if (!date || date.length < 4) {
    return null;
  }
  return date.slice(0, 4);
}

function getSeriesKey(item: Record<string, unknown>, mode: FinancialPeriodMode): string | null {
  const date = toNullableString(item.date);

  if (mode === "annual") {
    return deriveAnnualFiscalYear(item) ?? date;
  }

  const fiscalYear = toNullableString(item.fiscalYear ?? item.calendarYear);
  const period = toNullableString(item.period);
  if (fiscalYear && period) {
    return `${fiscalYear}:${period.toUpperCase()}`;
  }
  return date;
}

function buildSeriesLabel(date: string, fiscalYear: string | null, period: string | null, mode: FinancialPeriodMode): string {
  const normalizedPeriod = period?.toUpperCase() ?? null;
  if (mode === "annual" || normalizedPeriod === "FY") {
    return fiscalYear ?? date.slice(0, 4);
  }
  if (normalizedPeriod && /^Q[1-4]$/.test(normalizedPeriod)) {
    if (fiscalYear && fiscalYear.length >= 2) {
      return `${normalizedPeriod} '${fiscalYear.slice(-2)}`;
    }
    return normalizedPeriod;
  }
  if (fiscalYear && normalizedPeriod) {
    return `${normalizedPeriod} '${fiscalYear.slice(-2)}`;
  }
  return date.slice(0, 10);
}

function periodSortValue(period: string | null): number {
  switch ((period ?? "").toUpperCase()) {
    case "Q1":
      return 1;
    case "Q2":
      return 2;
    case "Q3":
      return 3;
    case "Q4":
      return 4;
    case "FY":
      return 5;
    default:
      return 99;
  }
}

async function fetchStableSymbolArray(params: {
  endpoint: string;
  ticker: string;
  period: FinancialPeriodMode;
  limit: number;
  requestIntervalMs?: number;
}): Promise<Record<string, unknown>[]> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    throw new Error("FMP_API_KEY not configured");
  }

  const providerSymbol = normalizeFmpSymbol(params.ticker);
  const intervalMs = Number.isFinite(params.requestIntervalMs)
    ? Math.max(0, Math.min(5_000, Math.round(params.requestIntervalMs as number)))
    : DEFAULT_FMP_REQUEST_INTERVAL_MS;

  const query = new URLSearchParams({
    symbol: providerSymbol,
    period: params.period,
    limit: String(params.limit),
    apikey: apiKey,
  });
  const url = `${FMP_BASE}/${params.endpoint}?${query.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireFmpFinancialSlot(intervalMs);
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

async function fetchPeriodSeries(
  ticker: string,
  mode: FinancialPeriodMode,
  limit: number,
  requestIntervalMs?: number,
): Promise<FmpFinancialSeriesPoint[]> {
  const [incomeStatement, keyMetrics, ratios, analystEstimates] = await Promise.all([
    fetchStableSymbolArray({
      endpoint: "income-statement",
      ticker,
      period: mode,
      limit,
      requestIntervalMs,
    }),
    fetchStableSymbolArray({
      endpoint: "key-metrics",
      ticker,
      period: mode,
      limit,
      requestIntervalMs,
    }),
    fetchStableSymbolArray({
      endpoint: "ratios",
      ticker,
      period: mode,
      limit,
      requestIntervalMs,
    }),
    fetchStableSymbolArray({
      endpoint: "analyst-estimates",
      ticker,
      period: mode,
      limit,
      requestIntervalMs,
    }).catch(() => []),
  ]);

  const points = new Map<string, FmpFinancialSeriesPoint>();

  const ensurePoint = (item: Record<string, unknown>) => {
    const key = getSeriesKey(item, mode);
    if (!key) {
      return null;
    }
    const existing = points.get(key);
    if (existing) {
      return existing;
    }
    const date = toNullableString(item.date) ?? key;
    const fiscalYear = mode === "annual"
      ? deriveAnnualFiscalYear(item)
      : toNullableString(item.fiscalYear ?? item.calendarYear);
    const period = toNullableString(item.period);
    const created: FmpFinancialSeriesPoint = {
      date,
      fiscalYear,
      period,
      label: buildSeriesLabel(date, fiscalYear, period, mode),
      revenue: null,
      revenueEstimate: null,
      netIncome: null,
      netIncomeEstimate: null,
      eps: null,
      epsEstimate: null,
      marketCap: null,
      peRatio: null,
      psRatio: null,
      numAnalystsRevenue: null,
      numAnalystsEps: null,
    };
    points.set(key, created);
    return created;
  };

  for (const item of incomeStatement) {
    const point = ensurePoint(item);
    if (!point) {
      continue;
    }
    point.revenue = toNullableNumber(item.revenue);
    point.netIncome = toNullableNumber(item.netIncome ?? item.bottomLineNetIncome);
    point.eps = toNullableNumber(item.eps ?? item.epsDiluted);
  }

  for (const item of keyMetrics) {
    const point = ensurePoint(item);
    if (!point) {
      continue;
    }
    point.marketCap = toNullableNumber(item.marketCap);
  }

  for (const item of ratios) {
    const point = ensurePoint(item);
    if (!point) {
      continue;
    }
    point.peRatio = toNullableNumber(item.priceToEarningsRatio ?? item.peRatio);
    point.psRatio = toNullableNumber(item.priceToSalesRatio);
  }

  for (const item of analystEstimates) {
    const point = ensurePoint(item);
    if (!point) {
      continue;
    }
    point.revenueEstimate = toNullableNumber(item.revenueAvg ?? item.revenueEstimate ?? item.revenueEstimated);
    point.netIncomeEstimate = toNullableNumber(item.netIncomeAvg ?? item.netIncomeEstimate ?? item.netIncomeEstimated);
    point.epsEstimate = toNullableNumber(item.epsAvg ?? item.epsEstimate ?? item.epsEstimated);
    point.numAnalystsRevenue = toNullableInteger(item.numAnalystsRevenue);
    point.numAnalystsEps = toNullableInteger(item.numAnalystsEps);
  }

  const merged = Array.from(points.values())
    .map((point) => {
      if (point.peRatio == null && point.marketCap != null && point.netIncome != null && point.netIncome !== 0) {
        point.peRatio = point.marketCap / point.netIncome;
      }
      if (point.psRatio == null && point.marketCap != null && point.revenue != null && point.revenue !== 0) {
        point.psRatio = point.marketCap / point.revenue;
      }
      return point;
    })
    .filter((point) => (
      point.revenue != null ||
      point.revenueEstimate != null ||
      point.netIncome != null ||
      point.netIncomeEstimate != null ||
      point.eps != null ||
      point.epsEstimate != null ||
      point.marketCap != null ||
      point.peRatio != null ||
      point.psRatio != null
    ))
    .sort((left, right) => {
      const dateCompare = left.date.localeCompare(right.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      const fiscalCompare = (left.fiscalYear ?? "").localeCompare(right.fiscalYear ?? "");
      if (fiscalCompare !== 0) {
        return fiscalCompare;
      }
      return periodSortValue(left.period) - periodSortValue(right.period);
    });

  return merged;
}

export async function fetchFmpFinancialSeries(
  ticker: string,
  params: {
    annualLimit?: number;
    quarterlyLimit?: number;
    requestIntervalMs?: number;
  } = {},
): Promise<FmpFinancialSeriesResponse> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error("Ticker is required");
  }

  const annualLimit = Number.isFinite(params.annualLimit)
    ? Math.max(1, Math.min(20, Math.round(params.annualLimit as number)))
    : DEFAULT_ANNUAL_LIMIT;
  const quarterlyLimit = Number.isFinite(params.quarterlyLimit)
    ? Math.max(1, Math.min(24, Math.round(params.quarterlyLimit as number)))
    : DEFAULT_QUARTERLY_LIMIT;

  const [annual, quarterly] = await Promise.all([
    fetchPeriodSeries(normalizedTicker, "annual", annualLimit, params.requestIntervalMs),
    fetchPeriodSeries(normalizedTicker, "quarter", quarterlyLimit, params.requestIntervalMs),
  ]);

  return {
    ticker: normalizedTicker,
    source: "FMP",
    annual,
    quarterly,
  };
}