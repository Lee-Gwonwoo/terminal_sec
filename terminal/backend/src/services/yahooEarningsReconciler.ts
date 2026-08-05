/**
 * yahooEarningsReconciler.ts
 * Earning Calendar ver2 — Yahoo 결과를 calendar_events에 반영한다.
 *
 * 설계 근거: ai_agent_plan/earning_calendar_ver2/plan.md §2-2
 *
 * 핵심 제약 — Yahoo는 "다음 1건"만 준다. FMP처럼 전체 스케줄 배열을 주지 않으므로
 * "가져온 집합 − 저장된 집합 = 삭제"라는 차집합 reconcile을 쓸 수 없다.
 * 따라서 자동 DELETE는 하지 않고, 설명되지 않는 기존 row는 stale 후보로 리포트만 한다.
 *
 * 기존 FMP row와의 중복을 막기 위해 source를 가리지 않고 대조한다.
 * 같은 티커의 가장 가까운 미래 row가 있으면 source 유지한 채 그 row를 갱신한다.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { getEtDateString } from "./timeUtils.js";
import type { YahooEarningsDate, YahooEarningsEstimate } from "./yahooEarningsProvider.js";
import type { NasdaqEarningsRow } from "./nasdaqEarningsCalendarProvider.js";

/** 같은 분기의 날짜 이동으로 인정할 최대 간격(일). plan §1-3 실측: 이동 47쌍 전부 ≤45일, 정상 분기쌍 6건 전부 >45일. */
const MOVE_WINDOW_DAYS = 45;

export interface ReconcileSummary {
  inserted: number;
  updated: number;
  moved: number;
  insertedAhead: number;
  staleFlagged: number;
  skippedEstimate: number;
  estimatesApplied: number;
  /** 이동 대상 날짜에 이미 같은 티커 row가 있어 합친 건수 (기존 유령 row 정리). */
  mergedDuplicates: number;
  /** 이미 발표가 끝난 실적일로 새로 만든 row 수. */
  pastInserted: number;
  /** 이미 발표가 끝난 실적일 row를 갱신한 수. */
  pastUpdated: number;
  errors: number;
  moves: Array<{ ticker: string; from: string; to: string }>;
  staleCandidates: Array<{ ticker: string; storedDate: string; yahooDate: string }>;
  merged: Array<{ ticker: string; removedDate: string; keptDate: string }>;
  errorSamples: Array<{ ticker: string; message: string }>;
}

/** `PREFIX:earnings:TICKER:YYYY-MM-DD` 의 날짜 부분만 새 날짜로 바꾼다. 원본 prefix를 보존한다. */
function rekeyUniqueKey(existingKey: string, ticker: string, nextDate: string): string {
  if (/:\d{4}-\d{2}-\d{2}$/.test(existingKey)) {
    return existingKey.replace(/:\d{4}-\d{2}-\d{2}$/, `:${nextDate}`);
  }
  return `${existingKey}:${nextDate}`;
}

interface StoredRow {
  id: string;
  ticker: string;
  event_at: string;
  meta_json: string;
  source: string;
  unique_key: string;
}

function emptySummary(): ReconcileSummary {
  return {
    inserted: 0,
    updated: 0,
    moved: 0,
    insertedAhead: 0,
    staleFlagged: 0,
    skippedEstimate: 0,
    estimatesApplied: 0,
    mergedDuplicates: 0,
    pastInserted: 0,
    pastUpdated: 0,
    errors: 0,
    moves: [],
    staleCandidates: [],
    merged: [],
    errorSamples: [],
  };
}

function hasReportedActual(meta: Record<string, unknown>): boolean {
  return (
    (typeof meta.eps_actual === "number" && Number.isFinite(meta.eps_actual)) ||
    (typeof meta.revenue_actual === "number" && Number.isFinite(meta.revenue_actual))
  );
}

function daysBetween(a: string, b: string): number {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((right - left) / 86_400_000));
}

function deriveSession(timeOfDay: string | null): string | null {
  if (timeOfDay === "BMO") return "pre-market";
  if (timeOfDay === "AMC") return "after-market";
  return null;
}

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Yahoo 날짜 정보를 meta에 병합. 기존 time_of_day는 Yahoo가 값을 줄 때만 덮어쓴다. */
function applyDateMeta(meta: Record<string, unknown>, date: YahooEarningsDate): Record<string, unknown> {
  const next = { ...meta };
  next.report_date = date.reportDate;
  next.date_confirmed = date.isDateEstimate == null ? null : !date.isDateEstimate;
  next.date_is_estimate = date.isDateEstimate;
  next.date_is_range = date.isDateRange;
  next.date_source = "yahoo";
  next.date_checked_at = new Date().toISOString();
  if (date.timeOfDay) {
    next.time_of_day = date.timeOfDay;
    next.session = deriveSession(date.timeOfDay);
    next.time_of_day_source = "yahoo";
  }
  return next;
}

function applyEstimateMeta(meta: Record<string, unknown>, est: YahooEarningsEstimate): Record<string, unknown> {
  const next = { ...meta };
  next.eps_est = est.epsEst;
  next.eps_est_low = est.epsEstLow;
  next.eps_est_high = est.epsEstHigh;
  next.revenue_est = est.revenueEst;
  next.revenue_est_low = est.revenueEstLow;
  next.revenue_est_high = est.revenueEstHigh;
  next.analyst_count = est.analystCount;
  next.revenue_analyst_count = est.revenueAnalystCount;
  next.year_ago_eps = est.yearAgoEps;
  next.eps_revisions_up_30d = est.epsRevisionsUp30d;
  next.eps_revisions_down_30d = est.epsRevisionsDown30d;
  next.fiscal_period_end = est.fiscalPeriodEnd;
  next.estimate_source = "yahoo";
  next.estimate_updated_at = new Date().toISOString();
  return next;
}

async function loadFutureRows(tickers: string[], fromDate: string): Promise<Map<string, StoredRow[]>> {
  const db = getDb();
  const map = new Map<string, StoredRow[]>();
  const CHUNK = 400;

  for (let index = 0; index < tickers.length; index += CHUNK) {
    const chunk = tickers.slice(index, index + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db.all<StoredRow[]>(
      `SELECT id, ticker, event_at, meta_json, source, unique_key
         FROM calendar_events
        WHERE event_type = 'earnings'
          AND ticker IN (${placeholders})
          AND event_at >= ?
        ORDER BY ticker, event_at ASC`,
      [...chunk, `${fromDate}T00:00:00.000Z`],
    );
    for (const row of rows) {
      const key = row.ticker.toUpperCase();
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
  }

  return map;
}

export interface NasdaqReconcileSummary {
  inserted: number;
  updated: number;
  actualsFilled: number;
  sessionFilled: number;
  errors: number;
  errorSamples: Array<{ ticker: string; message: string }>;
}

/**
 * Nasdaq 일자별 스윕 결과를 반영한다.
 *
 * Yahoo 경로와 달리 **날짜가 이미 확정된 사실**이므로 MOVE 판정을 하지 않는다.
 * 해당 티커+날짜 row를 그대로 만들거나 갱신한다. 삭제도 하지 않는다.
 */
export async function reconcileNasdaqEarnings(params: {
  rows: NasdaqEarningsRow[];
  onLog?: (message: string) => void;
}): Promise<NasdaqReconcileSummary> {
  const summary: NasdaqReconcileSummary = {
    inserted: 0, updated: 0, actualsFilled: 0, sessionFilled: 0, errors: 0, errorSamples: [],
  };
  const db = getDb();
  if (params.rows.length === 0) return summary;

  const nowIso = new Date().toISOString();
  // (ticker, date) → 기존 row. 같은 날짜에 여러 source가 있으면 가장 먼저 만들어진 것을 쓴다.
  const existing = new Map<string, StoredRow>();
  const tickers = Array.from(new Set(params.rows.map((r) => r.ticker)));
  const CHUNK = 400;
  for (let index = 0; index < tickers.length; index += CHUNK) {
    const chunk = tickers.slice(index, index + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const found = await db.all<StoredRow[]>(
      `SELECT id, ticker, event_at, meta_json, source, unique_key
         FROM calendar_events
        WHERE event_type = 'earnings' AND ticker IN (${placeholders})`,
      chunk,
    );
    for (const row of found) {
      const key = `${row.ticker.toUpperCase()}|${row.event_at.slice(0, 10)}`;
      if (!existing.has(key)) existing.set(key, row);
    }
  }

  await db.run("BEGIN IMMEDIATE");
  try {
    for (const row of params.rows) {
      try {
        const key = `${row.ticker}|${row.reportDate}`;
        const found = existing.get(key);
        const meta: Record<string, unknown> = found ? parseMeta(found.meta_json) : { company_name: null };

        if (row.companyName && meta.company_name == null) meta.company_name = row.companyName;
        meta.report_date = row.reportDate;
        meta.nasdaq_checked_at = nowIso;

        // Nasdaq은 과거 날짜에서 time을 지운다. 값이 있을 때만 채우고 기존 값을 지우지 않는다.
        if (row.timeOfDay && meta.time_of_day == null) {
          meta.time_of_day = row.timeOfDay;
          meta.session = deriveSession(row.timeOfDay);
          meta.time_of_day_source = "nasdaq";
          summary.sessionFilled++;
        }

        // 실적 숫자는 Nasdaq이 과거 날짜에도 유지한다. 이게 이 경로의 핵심 가치다.
        if (row.epsActual != null && meta.eps_actual == null) {
          meta.eps_actual = row.epsActual;
          meta.confirmed = true;
          meta.date_event_state = "reported";
          summary.actualsFilled++;
        }
        if (row.epsForecast != null && meta.eps_est == null) meta.eps_est = row.epsForecast;
        if (row.surprisePct != null && meta.surprise_pct == null) meta.surprise_pct = row.surprisePct;
        if (row.analystCount != null && meta.analyst_count == null) meta.analyst_count = row.analystCount;
        if (row.fiscalQuarterEnding && meta.fiscal_quarter_ending == null) {
          meta.fiscal_quarter_ending = row.fiscalQuarterEnding;
        }

        if (found) {
          await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [JSON.stringify(meta), found.id]);
          summary.updated++;
        } else {
          meta.date_source = "nasdaq";
          await db.run(
            `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
             VALUES (?, 'earnings', ?, ?, ?, ?, 'NASDAQ', ?)
             ON CONFLICT(event_type, unique_key) DO UPDATE SET
               event_at = excluded.event_at,
               meta_json = excluded.meta_json`,
            [
              randomUUID(),
              row.ticker,
              `${row.ticker} earnings`,
              `${row.reportDate}T12:00:00.000Z`,
              JSON.stringify(meta),
              `NASDAQ:earnings:${row.ticker}:${row.reportDate}`,
            ],
          );
          summary.inserted++;
        }
      } catch (error) {
        summary.errors++;
        const message = error instanceof Error ? error.message : String(error);
        if (summary.errorSamples.length < 20) summary.errorSamples.push({ ticker: row.ticker, message });
        params.onLog?.(`[nasdaq-reconcile] ${row.ticker} ${row.reportDate} 실패: ${message}`);
      }
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }

  return summary;
}

/**
 * Yahoo 날짜 결과를 반영한다.
 *
 * @param dates       A1/A2가 가져온 티커별 다음 실적일
 * @param estimates   Precise Update일 때만 채워진 추정치 (없으면 날짜만 갱신)
 * @param scopeFrom   reconcile 시작일 (YYYY-MM-DD)
 * @param scopeTo     reconcile 종료일 (YYYY-MM-DD). 이 범위 밖 날짜는 저장하되 stale 판정 대상에서 제외한다.
 */
export async function reconcileYahooEarnings(params: {
  dates: YahooEarningsDate[];
  estimates?: Map<string, YahooEarningsEstimate>;
  scopeFrom: string;
  scopeTo: string;
  onLog?: (message: string) => void;
}): Promise<ReconcileSummary> {
  const summary = emptySummary();
  const db = getDb();
  const tickers = Array.from(new Set(params.dates.map((d) => d.ticker.toUpperCase())));
  if (tickers.length === 0) return summary;

  const storedMap = await loadFutureRows(tickers, params.scopeFrom);
  const nowIso = new Date().toISOString();
  const todayEt = getEtDateString(new Date());

  await db.run("BEGIN IMMEDIATE");
  try {
    for (const date of params.dates) {
      // 티커 단위로 오류를 가둔다. 한 건 실패로 전체 트랜잭션을 롤백하면
      // 9분짜리 fetch 결과가 통째로 날아간다.
      try {
      const ticker = date.ticker.toUpperCase();
      const stored = storedMap.get(ticker) ?? [];
      const estimate = params.estimates?.get(ticker);

      // ── 이미 발표가 끝난 이벤트 ────────────────────────────────────
      // 그 날짜의 row만 만들거나 갱신한다. MOVE/삭제/추정치 적용을 하지 않는다.
      // (컨센서스는 "다음 분기" 기준이라 지나간 분기 row에 붙이면 틀린 값이 된다.)
      if (date.isPastEvent) {
        const exact = stored.find((row) => row.event_at.slice(0, 10) === date.reportDate);
        if (exact) {
          const exactMeta = applyDateMeta(parseMeta(exact.meta_json), date);
          exactMeta.date_event_state = "reported";
          await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [
            JSON.stringify(exactMeta),
            exact.id,
          ]);
          summary.pastUpdated++;
        } else {
          const newMeta = applyDateMeta({ company_name: null, confirmed: false }, date);
          newMeta.date_event_state = "reported";
          await db.run(
            `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
             VALUES (?, 'earnings', ?, ?, ?, ?, 'YAHOO', ?)
             ON CONFLICT(event_type, unique_key) DO UPDATE SET
               event_at = excluded.event_at,
               meta_json = excluded.meta_json`,
            [
              randomUUID(),
              ticker,
              `${ticker} earnings`,
              `${date.reportDate}T12:00:00.000Z`,
              JSON.stringify(newMeta),
              `YAHOO2:earnings:${ticker}:${date.reportDate}`,
            ],
          );
          summary.pastInserted++;
        }
        continue;
      }

      // ── 다음 예정 실적 ─────────────────────────────────────────────
      // 비교 대상은 "오늘 이후" row만이다. custom 범위가 과거를 포함하면
      // stored[0]이 과거 row일 수 있고, 그걸 d0로 잡으면 지나간 실적을 미래로 끌어당긴다.
      const futureRows = stored.filter((row) => row.event_at.slice(0, 10) >= todayEt);
      const d0 = futureRows[0];
      const storedDate = d0 ? d0.event_at.slice(0, 10) : null;

      // ── 신규 INSERT ────────────────────────────────────────────────
      if (!d0) {
        let meta = applyDateMeta({ company_name: null, confirmed: false }, date);
        if (estimate) {
          meta = applyEstimateMeta(meta, estimate);
          summary.estimatesApplied++;
        }
        await db.run(
          `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
           VALUES (?, 'earnings', ?, ?, ?, ?, 'YAHOO', ?)
           ON CONFLICT(event_type, unique_key) DO UPDATE SET
             event_at = excluded.event_at,
             meta_json = excluded.meta_json`,
          [
            randomUUID(),
            ticker,
            `${ticker} earnings`,
            `${date.reportDate}T12:00:00.000Z`,
            JSON.stringify(meta),
            `YAHOO2:earnings:${ticker}:${date.reportDate}`,
          ],
        );
        summary.inserted++;
        continue;
      }

      const gap = storedDate ? daysBetween(storedDate, date.reportDate) : Number.POSITIVE_INFINITY;
      let meta = parseMeta(d0.meta_json);

      // ── 날짜 동일 → UPDATE ────────────────────────────────────────
      if (storedDate === date.reportDate) {
        meta = applyDateMeta(meta, date);
        if (estimate) {
          meta = applyEstimateMeta(meta, estimate);
          summary.estimatesApplied++;
        }
        await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [JSON.stringify(meta), d0.id]);
        summary.updated++;
        continue;
      }

      // ── 추정 날짜로는 이동시키지 않는다 (확정 날짜를 밀어내는 사고 방지) ──
      if (date.isDateEstimate === true) {
        summary.skippedEstimate++;
        continue;
      }

      // ── 같은 분기의 이동 → MOVE (row 재사용) ───────────────────────
      if (gap <= MOVE_WINDOW_DAYS) {
        // 이동 목적지에 이미 같은 티커 row가 있으면 unique_key가 충돌한다.
        // (= 예전에 날짜가 바뀌면서 남은 유령 row.) 이 경우 목적지 row로 합친다.
        const collision = futureRows.find(
          (row) => row.id !== d0.id && row.event_at.slice(0, 10) === date.reportDate,
        );

        if (collision) {
          // d0에 이미 보고된 실적(eps_actual/revenue_actual)이 있으면 그건 "옮겨진 같은 이벤트"가 아니라
          // 이미 발표가 끝난 별개 이벤트다. 지우지도, 그 값을 목적지로 옮기지도 않는다.
          const d0Reported = hasReportedActual(meta);

          let targetMeta = applyDateMeta(parseMeta(collision.meta_json), date);
          if (!d0Reported) {
            // 같은 분기가 옮겨온 것이므로 세션 값만 승계한다 (Yahoo가 안 줬을 때의 폴백).
            if (targetMeta.time_of_day == null && meta.time_of_day != null) {
              targetMeta.time_of_day = meta.time_of_day;
              targetMeta.session = meta.session;
            }
            targetMeta.previous_report_date = storedDate;
            targetMeta.date_changed_at = nowIso;
            targetMeta.change_count = (typeof targetMeta.change_count === "number" ? targetMeta.change_count : 0) + 1;
            targetMeta.merged_from_date = storedDate;
          }
          if (estimate) {
            targetMeta = applyEstimateMeta(targetMeta, estimate);
            summary.estimatesApplied++;
          }
          await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [
            JSON.stringify(targetMeta),
            collision.id,
          ]);

          if (d0Reported) {
            meta.stale_candidate = true;
            meta.stale_flagged_at = nowIso;
            meta.yahoo_next_date = date.reportDate;
            await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [JSON.stringify(meta), d0.id]);
            summary.staleFlagged++;
            summary.staleCandidates.push({ ticker, storedDate: storedDate!, yahooDate: date.reportDate });
          } else {
            await db.run(`DELETE FROM calendar_events WHERE id = ?`, [d0.id]);
            summary.mergedDuplicates++;
            summary.merged.push({ ticker, removedDate: storedDate!, keptDate: date.reportDate });
          }
          continue;
        }

        meta = applyDateMeta(meta, date);
        meta.previous_report_date = storedDate;
        meta.date_changed_at = nowIso;
        meta.change_count = (typeof meta.change_count === "number" ? meta.change_count : 0) + 1;
        // 날짜가 바뀌면 기존 세션 값은 재확인 대상이다. Yahoo가 새 값을 안 주면 비운다.
        if (!date.timeOfDay) {
          meta.time_of_day = null;
          meta.session = null;
          meta.time_of_day_source = "stale_moved";
        }
        if (estimate) {
          meta = applyEstimateMeta(meta, estimate);
          summary.estimatesApplied++;
        }
        await db.run(`UPDATE calendar_events SET event_at = ?, unique_key = ?, meta_json = ? WHERE id = ?`, [
          `${date.reportDate}T12:00:00.000Z`,
          rekeyUniqueKey(d0.unique_key, ticker, date.reportDate),
          JSON.stringify(meta),
          d0.id,
        ]);
        summary.moved++;
        summary.moves.push({ ticker, from: storedDate!, to: date.reportDate });
        continue;
      }

      // ── Yahoo 날짜가 저장된 것보다 앞 → 새 분기가 생긴 것으로 보고 INSERT ──
      if (date.reportDate < storedDate!) {
        let newMeta = applyDateMeta({ company_name: null, confirmed: false }, date);
        if (estimate) {
          newMeta = applyEstimateMeta(newMeta, estimate);
          summary.estimatesApplied++;
        }
        await db.run(
          `INSERT INTO calendar_events (id, event_type, ticker, title, event_at, meta_json, source, unique_key)
           VALUES (?, 'earnings', ?, ?, ?, ?, 'YAHOO', ?)
           ON CONFLICT(event_type, unique_key) DO UPDATE SET
             event_at = excluded.event_at,
             meta_json = excluded.meta_json`,
          [
            randomUUID(),
            ticker,
            `${ticker} earnings`,
            `${date.reportDate}T12:00:00.000Z`,
            JSON.stringify(newMeta),
            `YAHOO2:earnings:${ticker}:${date.reportDate}`,
          ],
        );
        summary.insertedAhead++;
        continue;
      }

      // ── 설명 불가: 자동 삭제하지 않고 stale 후보로만 표시 ──────────
      meta.stale_candidate = true;
      meta.stale_flagged_at = nowIso;
      meta.yahoo_next_date = date.reportDate;
      await db.run(`UPDATE calendar_events SET meta_json = ? WHERE id = ?`, [JSON.stringify(meta), d0.id]);
      summary.staleFlagged++;
      summary.staleCandidates.push({ ticker, storedDate: storedDate!, yahooDate: date.reportDate });
      } catch (error) {
        summary.errors++;
        const message = error instanceof Error ? error.message : String(error);
        if (summary.errorSamples.length < 20) {
          summary.errorSamples.push({ ticker: date.ticker.toUpperCase(), message });
        }
        params.onLog?.(`[reconcile] ${date.ticker.toUpperCase()} 처리 실패: ${message}`);
      }
    }

    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }

  return summary;
}
