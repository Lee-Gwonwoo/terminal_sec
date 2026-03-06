// calendarIngestion.ts — IBKR 캘린더 인제션
// Step 6-1 (2026-03-06): mock_provider 생성기 코드 전면 제거.
//   이전의 mock worker 함수(runEarningsWorker 등)와 startCalendarIngestionWorkers()는 삭제됨.
// Step 6-3: pullIbkrCalendar() stub 추가.
//   BLOCKED — IBKR TWS 실행 + Python child_process bridge 구현 후 정상 동작.

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
}

/**
 * IBKR WSH API에서 캘린더 이벤트를 수집한다.
 * Python child_process 브리지를 통해 IBKR TWS 소켓 API에 접속한다 (결정 #6, 옵션 B).
 *
 * BLOCKED: IBKR TWS가 실행 중이고 Python bridge script가 구현된 후에만 정상 동작.
 * 현재는 Step 6-3 구현 미착수 상태이므로 에러를 던진다.
 */
export async function pullIbkrCalendar(_tickers: string[]): Promise<IbkrCalendarResult> {
  // TODO (Step 6-3 + 결정 #6 Python child_process bridge):
  //   1. _tickers.length > 0 검증
  //   2. Python 스크립트 실행: python ibkr_wsh_pull.py --tickers AAPL,MSFT,...
  //      (ib_insync reqWshEventData 기반, conId → ticker 매핑 포함)
  //   3. stdout JSON 파싱 → IbkrCalendarEvent[]
  //   4. return { events, source: "IBKR" }
  throw new Error(
    "IBKR 캘린더 미구현: TWS 실행 상태 + Python bridge 스크립트가 필요합니다 (Step 6-3)."
  );
}
