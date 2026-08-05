/**
 * nasdaqEarningsCalendarProvider.ts
 * Earning Calendar ver2 — 날짜 범위 열거 담당.
 *
 * 배경: Yahoo는 티커당 "다음 1건 + 직전 1건"만 준다. 날짜 범위 아카이브(visualization API)는
 * 2025년 중반 이후 비어 있음이 실측으로 확인됐다 (2026-08-04 조회 시 23건, 전부 해외종목).
 * 따라서 "지정 기간의 모든 실적"은 Nasdaq 일자별 조회로 열거한다.
 *
 * Endpoint: GET https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD  (키 불필요)
 *   미래 날짜 → time(pre/after), epsForecast, noOfEsts, marketCap, fiscalQuarterEnding
 *   과거 날짜 → eps(실적), surprise(%), epsForecast, noOfEsts, marketCap  ※ time은 지워진다
 */

const NASDAQ_BASE = "https://api.nasdaq.com/api/calendar/earnings";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 25_000;

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 12;

export interface NasdaqEarningsRow {
  ticker: string;
  /** 발표일 (YYYY-MM-DD) */
  reportDate: string;
  companyName: string | null;
  timeOfDay: "BMO" | "AMC" | null;
  epsActual: number | null;
  epsForecast: number | null;
  surprisePct: number | null;
  analystCount: number | null;
  marketCap: number | null;
  /** 예: "Jun/2026" */
  fiscalQuarterEnding: string | null;
}

export interface NasdaqSweepOptions {
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  onLog?: (message: string) => void;
  shouldCancel?: () => boolean;
}

export function clampNasdaqConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value as number)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "$1.23", "($0.45)", "1,234", "N/A" 등을 숫자로. 괄호는 음수. */
function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "N/A" || trimmed === "-" || trimmed === "--") return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()$,%\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function parseTimeOfDay(value: unknown): "BMO" | "AMC" | null {
  if (typeof value !== "string") return null;
  if (value === "time-pre-market") return "BMO";
  if (value === "time-after-hours") return "AMC";
  return null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "N/A" ? trimmed : null;
}

/** 하루치 조회. 주말/휴장일은 빈 배열. */
async function fetchNasdaqDay(date: string, onLog?: (m: string) => void): Promise<NasdaqEarningsRow[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let payload: any;
      try {
        const response = await fetch(`${NASDAQ_BASE}?date=${date}`, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        payload = await response.json();
      } finally {
        clearTimeout(timer);
      }

      // 휴장일에는 data가 null이거나 rows가 없다.
      const rows: any[] = payload?.data?.rows ?? [];
      const results: NasdaqEarningsRow[] = [];
      for (const row of rows) {
        const ticker = toNullableString(row?.symbol)?.toUpperCase();
        if (!ticker) continue;
        results.push({
          ticker,
          reportDate: date,
          companyName: toNullableString(row?.name),
          timeOfDay: parseTimeOfDay(row?.time),
          epsActual: parseMoney(row?.eps),
          epsForecast: parseMoney(row?.epsForecast),
          surprisePct: parseMoney(row?.surprise),
          analystCount: parseMoney(row?.noOfEsts),
          marketCap: parseMoney(row?.marketCap),
          fiscalQuarterEnding: toNullableString(row?.fiscalQuarterEnding),
        });
      }
      return results;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }

  onLog?.(`[nasdaq-earnings] ${date} 조회 실패: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(cursor) || !Number.isFinite(end)) return dates;

  while (cursor <= end) {
    const iso = new Date(cursor).toISOString().slice(0, 10);
    const weekday = new Date(cursor).getUTCDay();
    // 주말은 실적 발표가 없다. 요청 수를 30% 가까이 줄인다.
    if (weekday !== 0 && weekday !== 6) {
      dates.push(iso);
    }
    cursor += 86_400_000;
  }
  return dates;
}

/**
 * 지정 기간의 모든 실적 이벤트를 일자별로 열거한다.
 * universe가 주어지면 그 티커만 남긴다.
 */
export async function sweepNasdaqEarningsRange(params: {
  from: string;
  to: string;
  universe?: Set<string>;
  options?: NasdaqSweepOptions;
}): Promise<{
  rows: NasdaqEarningsRow[];
  scannedDays: number;
  failedDays: string[];
  totalRowsSeen: number;
}> {
  const options = params.options ?? {};
  const dates = enumerateDates(params.from, params.to);
  const concurrency = clampNasdaqConcurrency(options.concurrency);
  const rows: NasdaqEarningsRow[] = [];
  const failedDays: string[] = [];
  let totalRowsSeen = 0;
  let done = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      if (options.shouldCancel?.()) return;
      const index = nextIndex++;
      if (index >= dates.length) return;
      const date = dates[index];

      try {
        const dayRows = await fetchNasdaqDay(date, options.onLog);
        totalRowsSeen += dayRows.length;
        for (const row of dayRows) {
          if (params.universe && !params.universe.has(row.ticker)) continue;
          rows.push(row);
        }
      } catch {
        failedDays.push(date);
      } finally {
        done++;
        options.onProgress?.(done, dates.length);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(dates.length, 1)) }, () => worker()));

  return { rows, scannedDays: dates.length, failedDays, totalRowsSeen };
}
