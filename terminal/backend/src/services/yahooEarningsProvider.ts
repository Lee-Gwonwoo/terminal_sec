/**
 * yahooEarningsProvider.ts
 * Earning Calendar ver2 — Yahoo 기반 실적 일정/추정치 수집.
 *
 * 두 계층으로 나뉜다 (ai_agent_plan/earning_calendar_ver2/plan.md §2-1):
 *  - Date Fix      : quote() 배치 50종목/1회. 날짜 + 확정/추정 플래그만. 실측 2,283종목 ≈ 35~55초.
 *  - Precise Update: quoteSummary() 종목당 1회. EPS/매출 컨센, 애널리스트 수, 추정치 수정 건수. 326ms/종목.
 *
 * Date Fix가 주는 date/isEstimate 값은 Precise Update의 것과 동일하다. Precise가 추정치를 얹을 뿐이다.
 */

import YahooFinance from "yahoo-finance2";
import { toEtNaiveIso } from "./timeUtils.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const QUOTE_BATCH_SIZE = 50;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 400;
const MAX_BACKOFF_MS = 15_000;

const DEFAULT_PRECISE_CONCURRENCY = 4;
const MAX_PRECISE_CONCURRENCY = 20;
const DEFAULT_PRECISE_INTERVAL_MS = 120;

/** BMO/AMC 판정 경계 (ET 분 단위). plan §1-5: Yahoo는 08:30/16:00 두 값으로 정규화해서 준다. */
const BMO_CUTOFF_MINUTES = 9 * 60 + 30;
const AMC_CUTOFF_MINUTES = 16 * 60;

export interface YahooEarningsDate {
  ticker: string;
  /** ET 기준 YYYY-MM-DD */
  reportDate: string;
  /** 원본 UTC ISO */
  timestampUtc: string;
  /** true = Yahoo 추정 날짜, false = 회사 공시 확정 */
  isDateEstimate: boolean | null;
  /** BMO | AMC | null */
  timeOfDay: "BMO" | "AMC" | null;
  /** start !== end 이면 Yahoo가 구간으로만 아는 상태 */
  isDateRange: boolean;
  /** true = 이미 발표가 끝난 직전 실적. false = 다음 예정 실적. */
  isPastEvent: boolean;
}

export interface YahooEarningsEstimate {
  ticker: string;
  epsEst: number | null;
  epsEstLow: number | null;
  epsEstHigh: number | null;
  revenueEst: number | null;
  revenueEstLow: number | null;
  revenueEstHigh: number | null;
  analystCount: number | null;
  revenueAnalystCount: number | null;
  yearAgoEps: number | null;
  epsRevisionsUp30d: number | null;
  epsRevisionsDown30d: number | null;
  fiscalPeriodEnd: string | null;
}

export interface YahooEarningsBatchOptions {
  onProgress?: (done: number, total: number) => void;
  onLog?: (message: string) => void;
  shouldCancel?: () => boolean;
}

export interface YahooPreciseOptions extends YahooEarningsBatchOptions {
  concurrency?: number;
  requestIntervalMs?: number;
}

export function clampPreciseConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_PRECISE_CONCURRENCY;
  return Math.max(1, Math.min(MAX_PRECISE_CONCURRENCY, Math.floor(value as number)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    // Yahoo는 초 단위 epoch를 주는 경우가 있다.
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** ET wall-clock 기준 BMO/AMC 판정. 장중(09:30~16:00)은 판정하지 않고 null. */
function deriveTimeOfDay(date: Date): "BMO" | "AMC" | null {
  const etNaive = toEtNaiveIso(date);
  const [hourPart, minutePart] = etNaive.slice(11).split(":");
  const minutes = Number(hourPart) * 60 + Number(minutePart);
  if (!Number.isFinite(minutes)) return null;
  if (minutes <= BMO_CUTOFF_MINUTES) return "BMO";
  if (minutes >= AMC_CUTOFF_MINUTES) return "AMC";
  return null;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, onLog?: (m: string) => void): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // 심볼 자체가 없는 경우는 재시도해도 소용없다.
      if (/not found|No data found|Quote not found/i.test(message)) {
        throw error;
      }
      if (attempt === MAX_RETRIES) break;
      const backoff = Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** attempt);
      onLog?.(`[yahoo-earnings] ${label} 실패 (${attempt + 1}/${MAX_RETRIES}): ${message} — ${backoff}ms 후 재시도`);
      await sleep(backoff);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * A1 — Date Fix. quote() 배치로 전 유니버스의 실적일을 가져온다.
 *
 * Yahoo는 티커당 최대 두 개의 날짜를 준다:
 *   earningsTimestampStart/End = 다음 예정 실적
 *   earningsTimestamp          = 기준 시각. 직전에 발표가 끝났으면 그 날짜가 들어온다.
 * 예) ZETA(2026-08-05 기준): ts=2026-08-04(어제 발표 완료), start=2026-11-03(다음, 추정)
 *
 * 둘 중 미래 하나만 남기면 방금 끝난 실적이 영원히 기록되지 않는다.
 * 따라서 미래/과거를 각각 하나씩 최대 2건으로 내보내고, 범위 필터는 호출자가 한다.
 */
export async function fetchYahooEarningsDates(
  tickers: string[],
  options: YahooEarningsBatchOptions = {},
): Promise<{ results: YahooEarningsDate[]; failed: string[]; pastEvents: number }> {
  const results: YahooEarningsDate[] = [];
  const failed: string[] = [];
  let pastEvents = 0;
  let done = 0;

  const todayEt = toEtNaiveIso(new Date()).slice(0, 10);

  for (let index = 0; index < tickers.length; index += QUOTE_BATCH_SIZE) {
    if (options.shouldCancel?.()) break;

    const batch = tickers.slice(index, index + QUOTE_BATCH_SIZE);
    let quotes: any[] = [];
    try {
      const response = await withRetry(
        `quote batch ${index / QUOTE_BATCH_SIZE + 1}`,
        () => yf.quote(batch) as Promise<any>,
        options.onLog,
      );
      quotes = Array.isArray(response) ? response : [response];
    } catch (error) {
      failed.push(...batch);
      options.onLog?.(
        `[yahoo-earnings] quote 배치 실패 (${batch.length}종목): ${error instanceof Error ? error.message : String(error)}`,
      );
      done += batch.length;
      options.onProgress?.(done, tickers.length);
      continue;
    }

    const seen = new Set<string>();
    for (const quote of quotes) {
      const ticker = typeof quote?.symbol === "string" ? quote.symbol.toUpperCase() : null;
      if (!ticker) continue;
      seen.add(ticker);

      const start = toDate(quote.earningsTimestampStart);
      const end = toDate(quote.earningsTimestampEnd);
      const plain = toDate(quote.earningsTimestamp);
      const isRange = start != null && end != null && start.getTime() !== end.getTime();
      const yahooEstimateFlag = typeof quote.isEarningsDateEstimate === "boolean" ? quote.isEarningsDateEstimate : null;

      // 같은 날짜가 두 필드에 중복으로 오는 경우가 많으므로 날짜 기준으로 합친다.
      const byDate = new Map<string, Date>();
      for (const candidate of [start, plain]) {
        if (!candidate) continue;
        const key = toEtNaiveIso(candidate).slice(0, 10);
        if (!byDate.has(key)) byDate.set(key, candidate);
      }
      if (byDate.size === 0) continue;

      const entries = Array.from(byDate.entries());
      // 다음 실적 = 가장 이른 미래 날짜
      const nextUp = entries.filter(([date]) => date >= todayEt).sort((a, b) => (a[0] < b[0] ? -1 : 1))[0];
      // 직전 실적 = 가장 늦은 과거 날짜
      const lastDone = entries.filter(([date]) => date < todayEt).sort((a, b) => (a[0] > b[0] ? -1 : 1))[0];

      if (nextUp) {
        results.push({
          ticker,
          reportDate: nextUp[0],
          timestampUtc: nextUp[1].toISOString(),
          isDateEstimate: yahooEstimateFlag,
          timeOfDay: deriveTimeOfDay(nextUp[1]),
          isDateRange: isRange,
          isPastEvent: false,
        });
      }

      if (lastDone) {
        // 이미 일어난 일이므로 확정이다. Yahoo의 isEarningsDateEstimate는 "다음" 날짜에 대한 값이라 쓰지 않는다.
        results.push({
          ticker,
          reportDate: lastDone[0],
          timestampUtc: lastDone[1].toISOString(),
          isDateEstimate: false,
          timeOfDay: deriveTimeOfDay(lastDone[1]),
          isDateRange: false,
          isPastEvent: true,
        });
        pastEvents++;
      }
    }

    for (const ticker of batch) {
      if (!seen.has(ticker.toUpperCase())) failed.push(ticker.toUpperCase());
    }

    done += batch.length;
    options.onProgress?.(done, tickers.length);
  }

  return { results, failed, pastEvents };
}

/**
 * A2 — Precise Update. quoteSummary()로 종목별 컨센서스를 가져온다.
 * Date Fix가 이미 확정한 날짜 범위 안의 종목에만 돌리는 것을 전제로 한다.
 */
export async function fetchYahooEarningsEstimates(
  tickers: string[],
  options: YahooPreciseOptions = {},
): Promise<{ results: Map<string, YahooEarningsEstimate>; dates: Map<string, YahooEarningsDate>; failed: string[] }> {
  const results = new Map<string, YahooEarningsEstimate>();
  const dates = new Map<string, YahooEarningsDate>();
  const failed: string[] = [];
  const concurrency = clampPreciseConcurrency(options.concurrency);
  const intervalMs = Number.isFinite(options.requestIntervalMs)
    ? Math.max(0, options.requestIntervalMs as number)
    : DEFAULT_PRECISE_INTERVAL_MS;

  const todayEt = toEtNaiveIso(new Date()).slice(0, 10);
  let nextIndex = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      if (options.shouldCancel?.()) return;
      const index = nextIndex++;
      if (index >= tickers.length) return;
      const ticker = tickers[index].toUpperCase();

      if (intervalMs > 0) await sleep(intervalMs);

      try {
        const summary: any = await withRetry(
          `quoteSummary ${ticker}`,
          () => yf.quoteSummary(ticker, { modules: ["calendarEvents", "earningsTrend"] }) as Promise<any>,
          options.onLog,
        );

        const earnings = summary?.calendarEvents?.earnings ?? {};
        const trend = (summary?.earningsTrend?.trend ?? []).find((entry: any) => entry?.period === "0q");

        results.set(ticker, {
          ticker,
          epsEst: toNullableNumber(earnings.earningsAverage ?? trend?.earningsEstimate?.avg),
          epsEstLow: toNullableNumber(earnings.earningsLow ?? trend?.earningsEstimate?.low),
          epsEstHigh: toNullableNumber(earnings.earningsHigh ?? trend?.earningsEstimate?.high),
          revenueEst: toNullableNumber(earnings.revenueAverage ?? trend?.revenueEstimate?.avg),
          revenueEstLow: toNullableNumber(earnings.revenueLow ?? trend?.revenueEstimate?.low),
          revenueEstHigh: toNullableNumber(earnings.revenueHigh ?? trend?.revenueEstimate?.high),
          analystCount: toNullableNumber(trend?.earningsEstimate?.numberOfAnalysts),
          revenueAnalystCount: toNullableNumber(trend?.revenueEstimate?.numberOfAnalysts),
          yearAgoEps: toNullableNumber(trend?.earningsEstimate?.yearAgoEps),
          epsRevisionsUp30d: toNullableNumber(trend?.epsRevisions?.upLast30days),
          epsRevisionsDown30d: toNullableNumber(trend?.epsRevisions?.downLast30days),
          // 회계기간 종료일은 시각 없는 날짜다. ET로 변환하면 하루 밀리므로 UTC 그대로 자른다.
          fiscalPeriodEnd: toDate(trend?.endDate)?.toISOString().slice(0, 10) ?? null,
        });

        // quoteSummary는 "다음 실적" 1건만 준다. 과거 이벤트는 A1(quote 배치)이 담당한다.
        const rawDate = Array.isArray(earnings.earningsDate) ? earnings.earningsDate[0] : earnings.earningsDate;
        const parsed = toDate(rawDate);
        if (parsed) {
          const reportDate = toEtNaiveIso(parsed).slice(0, 10);
          if (reportDate >= todayEt) {
            dates.set(ticker, {
              ticker,
              reportDate,
              timestampUtc: parsed.toISOString(),
              isDateEstimate:
                typeof earnings.isEarningsDateEstimate === "boolean" ? earnings.isEarningsDateEstimate : null,
              timeOfDay: deriveTimeOfDay(parsed),
              isDateRange: Array.isArray(earnings.earningsDate) && earnings.earningsDate.length > 1,
              isPastEvent: false,
            });
          }
        }
      } catch (error) {
        failed.push(ticker);
        options.onLog?.(
          `[yahoo-earnings] ${ticker} quoteSummary 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        done++;
        options.onProgress?.(done, tickers.length);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(tickers.length, 1)) }, () => worker()));

  return { results, dates, failed };
}
