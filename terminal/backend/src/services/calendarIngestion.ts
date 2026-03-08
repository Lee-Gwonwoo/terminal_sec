// calendarIngestion.ts — IBKR 캘린더 인제션
// Step 6-1 (2026-03-06): mock_provider 생성기 코드 전면 제거.
//   이전의 mock worker 함수(runEarningsWorker 등)와 startCalendarIngestionWorkers()는 삭제됨.
// Step 6-3: pullIbkrCalendar() stub 추가.
//   BLOCKED — IBKR TWS 실행 + Python child_process bridge 구현 후 정상 동작.
// Step 9-1/9-2: mode 기반 날짜 범위 계약 추가 (backfill / refresh).

/** IBKR WSH API에서 가져온 캘린더 이벤트 (정규화 후) */
export interface IbkrCalendarEvent {
  type: string;        // earnings | dividends | splits | analyst_ratings | sec_filings | economics
  eventTime: string;   // ISO 8601
  ticker?: string;
  title: string;
  fieldsJson: Record<string, unknown>;
  uniqueKey: string;   // 중복 방지용 결정적 키
}

export interface IbkrCalendarResult {
  events: IbkrCalendarEvent[];
  source: "IBKR";
  mode: CalendarUpdateMode;
  dateRange: { from: string; to: string };
}

/** Calendar update 모드 */
export type CalendarUpdateMode = "backfill" | "refresh";

/** 모드별 기본 날짜 범위 계산 (ISO date string, YYYY-MM-DD) */
export function getCalendarDateRange(mode: CalendarUpdateMode): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (mode === "backfill") {
    // 과거 2년 + 미래 180일
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - 2);
    const to = new Date(now);
    to.setDate(to.getDate() + 180);
    return { from: fmt(from), to: fmt(to) };
  }
  // refresh: 최근 30일 overlap + 앞으로 90일
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const to = new Date(now);
  to.setDate(to.getDate() + 90);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * IBKR WSH API에서 캘린더 이벤트를 수집한다.
 * Python child_process 브리지를 통해 IBKR TWS 소켓 API에 접속한다 (결정 #6, 옵션 B).
 *
 * @param tickers 대상 종목 배열
 * @param mode "backfill" = 초기 적재 (과거 2년 + 미래 180일), "refresh" = 반복 갱신 (최근 30일 overlap + 미래 90일)
 *
 * BLOCKED: IBKR TWS가 실행 중이고 Python bridge script가 구현된 후에만 정상 동작.
 * 현재는 Step 6-3 구현 미착수 상태이므로 에러를 던진다.
 */
export async function pullIbkrCalendar(
  _tickers: string[],
  _mode: CalendarUpdateMode = "backfill"
): Promise<IbkrCalendarResult> {
  const dateRange = getCalendarDateRange(_mode);
  // TODO (Step 6-3 + 결정 #6 Python child_process bridge):
  //   1. _tickers.length > 0 검증
  //   2. Python 스크립트 실행: python ibkr_wsh_pull.py --tickers AAPL,MSFT,... --from {dateRange.from} --to {dateRange.to}
  //      (ib_insync reqWshEventData 기반, conId → ticker 매핑 포함)
  //   3. stdout JSON 파싱 → IbkrCalendarEvent[]
  //   4. return { events, source: "IBKR", mode: _mode, dateRange }
  throw new Error(
    `IBKR 캘린더 미구현 (mode=${_mode}, range=${dateRange.from}~${dateRange.to}): TWS 실행 상태 + Python bridge 스크립트가 필요합니다 (Step 6-3).`
  );
}
