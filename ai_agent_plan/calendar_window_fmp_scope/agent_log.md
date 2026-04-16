# agent_log

## 2026-04-15
**작성 시각:** 2026-04-15 14:05 (local)

### 계획 폴더 생성 및 FMP 범위 조사

- 작업 목적
  - `calendar window` 관련 후속 작업을 위한 전용 plan 폴더 생성
  - FMP에서 받을 수 있는 데이터를 현재 레포 기준으로 정리
- 생성 파일
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 확인한 근거
  - backend calendar read/write 구조 확인
  - frontend `CalendarWindow`의 mock 데이터 의존 확인
  - 현재 레포의 FMP provider 코드 확인
  - FMP 문서에서 `earnings-calendar`, `dividends-calendar`, `splits-calendar`, `ipos-calendar`, `economic-calendar` endpoint와 샘플 필드 확인
- 핵심 관찰
  - backend는 이미 범용 `calendar_events` + `/api/calendar/events` 구조를 가지고 있다.
  - frontend calendar는 아직 `mockCalendarData`와 legacy 탭 타입에 의존한다.
  - 현재 레포에 이미 연결된 FMP 데이터는 profile, shares-float, OHLC, press release, stock news, SEC filing이다.
  - FMP calendar 후보 데이터는 earnings, dividends, splits, IPOs, economics다.
  - FMP stable earnings 문서 FAQ 기준 `time` 필드는 제거되어 있다.
  - direct endpoint는 `demo` key 기준 401이어서 실제 entitlement는 운영 key로 별도 확인이 필요하다.
- 현재 판단
  - phase 1 권장 범위는 `earnings/dividends/splits`다.
  - `IPO/economics`는 null ticker와 UI 계약 문제로 phase 2가 적절하다.
  - FMP와 IBKR를 함께 둘 경우 `unique_key`는 source-aware해야 한다.
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| plan 폴더 생성 | ✅ | `ai_agent_plan/calendar_window_fmp_scope` 생성 |
| plan 문서 작성 | ✅ | 목표, 현재 상태, FMP 데이터 범위, 단계별 계획 포함 |
| 조사 근거 확보 | ✅ | 코드 + FMP docs page 기준 |
| live API 샘플 호출 | ⚠️ 제한 확인 | `demo` key로 401, 실제 key entitlement는 후속 확인 필요 |

- 상태
  - `plan.md` 작성 완료
  - 사용자 확인 대기(`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 14:28 (local)

### PLAN CHANGE — calendar window 실구현 범위 확장

- 사용자 추가 요구 반영
  - `CalendarWindow`에 DB 기반 ownership/industry column selector 추가
  - FMP earnings-date update 버튼 추가
  - 날짜 기간 필터를 실제 API query 기준으로 동작하게 변경
  - update 대상 ticker를 DB `default universe`로 고정
- 구현 결정
  - FMP stable earnings는 `time/session`을 신뢰 가능하게 제공하지 않으므로 값 추정은 하지 않는다.
  - ownership/industry는 새 외부 fetch가 아니라 existing DB metadata enrich로 해결한다.
  - update는 background job + `/api/jobs/:jobId` polling 계약으로 맞춘다.
- 다음 구현 범위
  - backend: FMP earnings route/provider + calendar query enrich
  - frontend: mock 제거 + API fetch + column selector + update button
- 상태
  - 구현 진행 중 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 14:46 (local)

### calendar window 실구현 + 검증

- 변경 파일
  - `terminal/backend/src/services/fmpEarningsCalendarProvider.ts`
  - `terminal/backend/src/services/calendarRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 구현 내용
  - FMP stable earnings-calendar provider 추가
  - `POST /api/fmp/calendar/earnings/update` background job 추가
  - update 대상 ticker를 DB `default universe`로 고정
  - `GET /api/calendar/events`의 date-only `from/to`를 inclusive range로 정규화
  - earnings row에 DB 기반 `industry`, `market_cap`, `float_pct`, `institutional_pct`, `insider_pct` enrich 추가
  - `CalendarWindow`를 mock에서 API 기반으로 교체
  - earnings 탭에 FMP update 버튼, job polling, date filter, column selector 추가
  - FMP stable source의 `time/session` 부재를 UI 안내문으로 명시
- 런타임 확인
  - `POST /api/fmp/calendar/earnings/update`를 `2026-04-01 ~ 2026-04-30` 범위로 실행해 `jobId` 반환 확인
  - job 완료 결과: `fetchedRows=4000`, `matchedRows=369`, `upsertedRows=369`
  - `GET /api/calendar/events?type=earnings&from=2026-04-01&to=2026-04-30`에서 DB metadata enrich field 확인
  - 브라우저에서 Calendar 창 렌더링 확인
  - Playwright로 table row count(`368`)와 ownership column label 존재 확인

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 `get_errors` 0 errors, repo-wide로는 `before_delete/terminal/backend/tsconfig.json`의 unrelated type-definition error 잔존 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | calendar types/events API, FMP earnings update job, 브라우저 Calendar 창 렌더링 확인 |

- 상태
  - 구현/검증 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 15:04 (local)

### calendar 숫자 필터 추가 + earnings 최신 날짜 재확인

- 변경 파일
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 구현 내용
  - `CalendarWindow`에 `Inst %`, `Float %`, `Market Cap(B$)` min/max 숫자 필터 추가
  - earnings에서는 세 필터를 모두 노출하고, dividends / splits에서는 `Market Cap(B$)` 필터를 노출
  - 숫자 필터는 현재 fetch된 row 집합에 대해 client-side로 즉시 적용되도록 구현
  - reset 버튼이 날짜/search와 함께 숫자 필터도 초기화하도록 수정
  - frontend prompt 문서에 숫자 필터 동작과 단위(`B$`)를 반영
- live 데이터 재확인
  - `GET /api/calendar/events?type=earnings&sort=event_time:desc&limit=1` 기준 최신 earnings row는 `2027-01-27`(`DOW`)였다.
  - 따라서 현재 DB 기준 earnings 데이터가 `2026-04-30`까지만 있는 상태는 아니다.
- 런타임 확인
  - 브라우저에서 숫자 필터 입력 UI(`Inst %`, `Float %`, `Market Cap`) 노출 확인
  - row count 변화 확인
    - 기본: `378`
    - `Inst % >= 70`: `313`
    - `Float % >= 95`: `225`
    - `Market Cap >= 100B`: `44`

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `CalendarWindow.tsx` `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | 브라우저에서 숫자 필터 입력 노출 + row count 변화 확인, 최신 earnings row API 재확인 |

- 상태
  - 숫자 필터 구현/검증 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 15:12 (local)

### FMP earnings snapshot replace 적용 + 누락/덮어쓰기 동작 정리

- 변경 파일
  - `terminal/backend/src/services/calendarRepository.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 확인한 원인
  - `CalendarWindow`가 일부만 잘라서 가져오는 구조는 아니었다.
  - 브라우저 기준 date filter 없이 row가 로드되고 있었고, 상단에 `2026-04-21`부터 보인 것은 기본 정렬이 빠른 날짜 우선(`asc`)이기 때문이었다.
  - 다만 backend 저장 semantics는 `unique_key = FMP:earnings:TICKER:DATE` upsert만 사용하고 있어서, earnings date가 변경되면 기존 row가 자동 삭제되지 않는 문제가 있었다.
  - 실제 검증에서도 `2026-04-21` 하루 기준 기존 row count가 `9`였지만, 같은 날짜를 다시 FMP에서 당기자 current snapshot은 `20`건이었다.
- 구현 내용
  - `deleteCalendarEventsForSourceRange(...)` helper 추가
  - `POST /api/fmp/calendar/earnings/update`가 각 chunk마다 transaction 안에서 기존 `source='FMP'`, `type='earnings'` row를 먼저 삭제하고 현재 snapshot을 다시 채우도록 수정
  - job result에 `deletedRows` 포함
  - backend/frontend prompt 문서에 snapshot replace semantics 반영
- 런타임 확인
  - `GET /api/calendar/events?type=earnings&sort=event_time:desc&limit=5` 기준 최신 row는 여전히 `2027-01-27 (DOW)`까지 확인됨
  - `2026-04-21` 하루 재실행 결과
    - 재실행 전 count: `9`
    - job result: `matchedRows=20`, `deletedRows=9`
    - 재실행 후 count: `20`
  - 기본 범위 전체 재동기화 실행
    - range: `2025-10-17 ~ 2026-10-12`
    - result: `matchedRows=2652`, `upsertedRows=2652`, `deletedRows=382`
    - chunk log 예시: `2026-04-15~2026-05-14`에서 `replaced=379`

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `calendarRepository.ts`, `server.ts` `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | one-day refresh(`2026-04-21`)로 `deletedRows`/count 변화 확인, default full refresh job 완료 확인 |

- 상태
  - FMP earnings update가 append 누적이 아니라 범위별 snapshot replace로 동작하도록 수정 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 15:18 (local)

### Calendar 기본 날짜 정렬을 늦은 날짜 우선으로 전환

- 변경 파일
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 구현 내용
  - `fetchCalendarEvents(...)`의 기본 sort parameter를 `event_time:desc`로 변경
  - `CalendarWindow` 초기 `sortDirection`을 `desc`로 변경
  - 탭 전환 시 기본 정렬을 `desc`로 유지하도록 수정
  - Reset 실행 시 active tab에 맞는 date field를 유지하면서 기본 정렬을 `desc`로 복원하도록 수정
  - frontend prompt 문서에 기본 날짜 정렬이 늦은 날짜 우선이라는 점을 반영
- 런타임 확인
  - 브라우저 reload 후 earnings 첫 row가 `2027-01-27 / DOW`로 표시됨을 확인
  - 하단 summary는 `Showing 2643 of 2643 events`로 확인됨
  - 따라서 더 늦은 earnings date가 화면 상단에 먼저 보이도록 변경이 반영됨

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `CalendarWindow.tsx` `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | 브라우저 reload 후 earnings 첫 row `2027-01-27 / DOW` 확인 |

- 상태
  - calendar 기본 날짜 정렬 전환 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 15:37 (local)

### Calendar 초기 lazy load 적용 — 날짜 지정 전 events 미표시

- 변경 파일
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 구현 내용
  - `CalendarWindow`에 `hasRequiredDateRange = Boolean(dateFrom && dateTo)` gate 추가
  - `from/to`가 둘 다 채워지기 전에는 `GET /api/calendar/events` fetch를 실행하지 않도록 수정
  - 이 상태에서는 loading spinner 대신 `Select both start and end dates to load calendar events.` 안내 메시지를 렌더링
  - footer도 `Select a start and end date to load events` 안내로 바뀌도록 수정
  - Reset 후에도 다시 날짜 미지정 대기 상태로 돌아가도록 유지
  - frontend prompt 문서와 plan 문서에 date-required lazy load 동작 반영
- 런타임 확인
  - 브라우저 reload 직후
    - 안내 문구 표시 확인
    - row count `0` 확인
  - 같은 화면에서 `2026-04-15 ~ 2026-05-14` 입력 후
    - browser row count `493` 확인
    - 안내 문구 사라짐 확인
  - 같은 범위의 live API도 `count=493`, 첫 날짜 `2026-05-14`로 확인

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `CalendarWindow.tsx` `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` pass |
| 런타임 통합 | ✅ | 브라우저 초기 무조회 상태 + 날짜 지정 후 row `493` 로드 확인 |

- 상태
  - 날짜 미지정 lazy load 적용 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 20:25 (local)

### FMP IPO calendar 데이터 범위 재정리

- 작업 목적
  - 사용자의 추가 질문에 맞춰 FMP IPO endpoint에서 실제로 받을 수 있는 데이터 shape를 별도 정리
  - 기존 `plan.md`의 IPO 1줄 요약을 응답 필드 단위 설명으로 보강
- 확인 근거
  - FMP stable docs `IPOs Calendar API`
  - 문서의 parameter 표 및 sample response 재확인
- 정리한 핵심 내용
  - endpoint는 `/stable/ipos-calendar`
  - 확인된 기본 parameter는 `from`, `to`이며 문서상 `Max 90-day date range`
  - 문서 sample response 기준 필드는 `symbol`, `date`, `daa`, `company`, `exchange`, `actions`, `shares`, `priceRange`, `marketCap`
  - `shares`, `priceRange`, `marketCap`은 nullable로 봐야 한다.
  - `actions`는 상태 string으로 취급하는 편이 맞고, `daa`는 raw timestamp로만 우선 보존하는 편이 안전하다.
  - docs FAQ에는 exchange/company filter 가능성이 언급되지만, 현재 parameter 표에는 보이지 않아 live entitlement 재확인이 필요하다.
- 변경 파일
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| FMP IPO docs 재확인 | ✅ | parameter 표 + sample response 확인 |
| plan 문서 반영 | ✅ | 필드별 의미, nullable, 구현 주의점 추가 |
| live endpoint 호출 | 미실시 | 이번 작업은 docs 정리만 수행, entitlement probe는 별도 후속 작업 |

- 상태
  - IPO 데이터 범위 정리 완료, 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 17:39 (local)

### PLAN CHANGE — Calendar ticker 우클릭 Financial dialog 범위 추가

- 작업 목적
  - 사용자의 새 요구를 반영해 `CalendarWindow` ticker 우클릭에서 재무 차트 dialog를 여는 범위를 plan에 먼저 반영
  - backend / frontend 구현 경로를 FMP stable endpoint 기준으로 고정
- 변경 파일
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 이번 변경에서 고정한 구현 방향
  - ticker 좌클릭은 기존 linked-ticker 동작 유지
  - ticker 우클릭 menu에 `Financial` 액션 추가
  - dialog에는 annual / quarterly toggle과 함께 `Revenue`, `Earnings`, `Valuation(P/E, P/S)` 차트를 표시
  - backend data source는 `income-statement`, `key-metrics`, `ratios`를 묶는 read-only API로 구성
- 확인 근거
  - 현재 `CalendarWindow.tsx`는 ticker 좌클릭만 있고 우클릭 menu / financial dialog가 없음
  - 현재 backend에는 ticker financial-history를 내려주는 API가 없음
  - FMP stable docs 기준 endpoint 후보는 `/stable/income-statement`, `/stable/key-metrics`, `/stable/ratios`
  - live sample 확인 기준
    - income-statement: `revenue`, `netIncome`, `eps`, `fiscalYear`, `period`
    - key-metrics: `marketCap`
    - ratios: `priceToSalesRatio`, `priceToEarningsRatio`, `enterpriseValueMultiple`
- 상태
  - plan 범위 확장 반영 완료, 구현 진행 중 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 18:01 (local)

### Calendar ticker 우클릭 Financial dialog 구현 + 검증 완료

- 변경 파일
  - `terminal/backend/src/services/fmpFinancialSeriesProvider.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend/src/services/calendarRepository.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/ui/dialog.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- 구현 내용
  - `GET /api/calendar/financials/:ticker` read-only endpoint 추가
  - FMP stable `income-statement`, `key-metrics`, `ratios`를 합쳐 annual / quarterly financial series를 생성
  - ratio 값이 비어 있으면 `marketCap / netIncome`, `marketCap / revenue` fallback으로 `P/E`, `P/S`를 계산
  - `CalendarWindow` ticker cell 우클릭 menu에 `Financial` 액션 추가
  - 새 `CalendarFinancialDialog`에서 `Revenue`, `Earnings`, `Valuation` 차트와 annual / quarterly toggle 렌더링
  - dialog wrapper를 `forwardRef` 기반으로 정리해 Radix ref warning 없이 열리도록 수정
  - backend test 재실행 과정에서 드러난 `calendarRepository.ts` stray fragment를 제거해 구문 오류 해소
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| backend 정적 분석 | ✅ | `fmpFinancialSeriesProvider.ts`, `server.ts`, `calendarRepository.ts` error 없음 |
| frontend 정적 분석 | ✅ | `CalendarFinancialDialog.tsx`, `CalendarWindow.tsx`, `dialog.tsx` error 없음 |
| backend build | ✅ | `terminal/backend`에서 `npm run build` 성공 |
| backend tests | ✅ | vitest `15 files / 91 tests` 통과 |
| live financial API | ✅ | `GET /api/calendar/financials/AAPL` 응답에서 `annualCount=6`, `quarterlyCount=8` 확인 |
| browser runtime | ✅ | `KMX` 우클릭 menu 표시, `Financial` 클릭, dialog open, annual / quarterly toggle, summary/차트 렌더링 확인 |

- 런타임 확인 메모
  - annual 첫 sample: `2020`, `revenue=274.52B`, `netIncome=57.41B`, `P/E=33.94x`, `P/S=7.10x`
  - quarterly 첫 sample: `Q2 '24`, `revenue=90.75B`, `netIncome=23.64B`, `P/E=27.94x`, `P/S=29.11x`
  - browser에서 `KMX` dialog 요약 카드와 quarterly 전환 후 값 변경을 직접 확인함

- 상태
  - 구현 + build/test + live API + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 22:20 (local)

### default ticker financial history sync + estimate overlay 구현 완료

- 변경 파일
  - `terminal/backend/src/db.ts`
  - `terminal/backend/src/services/calendarFinancialRepository.ts`
  - `terminal/backend/src/services/fmpFinancialSeriesProvider.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 원인 확인
  - estimate가 그래프에 안 보인 이유는 UI 문제가 아니라 backend/provider가 처음부터 `stable/analyst-estimates`를 읽지 않았기 때문이다.
  - 기존 financial dialog는 `income-statement`, `key-metrics`, `ratios` actual series만 받아 actual-only chart를 그리고 있었다.
- 구현 내용
  - `calendar_financial_series` cache table 추가
  - ticker별 annual / quarterly financial snapshot replace 저장용 repository 추가
  - `GET /api/calendar/financials/:ticker`를 DB cache first + live fallback 구조로 변경
  - `stable/analyst-estimates`를 annual / quarterly series에 merge해 `revenueEstimate`, `netIncomeEstimate`, `epsEstimate`, analyst coverage count를 함께 반환
  - `POST /api/fmp/calendar/financials/update` background job 추가
    - 대상은 항상 default universe ticker 전체
    - job label: `FMP Financial History Sync`
  - Calendar earnings toolbar에 `Sync Financial History` 버튼 추가
  - `CalendarFinancialDialog`에 revenue / earnings estimate overlay legend와 dashed line, summary estimate 텍스트 추가
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| backend 정적 분석 | ✅ | `db.ts`, `calendarFinancialRepository.ts`, `fmpFinancialSeriesProvider.ts`, `server.ts` error 없음 |
| frontend 정적 분석 | ✅ | `CalendarFinancialDialog.tsx`, `CalendarWindow.tsx` error 없음 |
| backend build | ✅ | `terminal/backend`에서 `npm run build` 성공 |
| backend tests | ✅ | vitest `15 files / 91 tests` 통과 |
| frontend build | ✅ | `terminal_ui_ver2_finhub`에서 `npm run build` 성공 |
| live financial API | ✅ | `GET /api/calendar/financials/AAPL` 응답에서 latest annual/quarterly point에 estimate 필드와 analyst count 확인 |
| live sync job API | ✅ | `POST /api/fmp/calendar/financials/update`가 `{ jobId, requestedTickers=1699 }` 반환, 직후 job status `running` 확인 |
| browser runtime | ✅ | earnings toolbar의 `Sync Financial History` 버튼 표시/실행, `FMP financial history sync: running` 상태 표시, financial dialog legend/estimate note 확인 |

- 런타임 확인 메모
  - `GET /api/calendar/financials/AAPL` latest annual sample: `date=2030-09-27`, `revenueEstimate=627849333333`, `netIncomeEstimate=196161355444`, `epsEstimate=13.07333`, `numAnalystsRevenue=16`, `numAnalystsEps=7`
  - same endpoint latest quarterly sample: `date=2028-09-27`, `revenueEstimate=123401826658`, `epsEstimate=2.40481`
  - browser에서 `Revenue Estimate`, `Net Income Estimate`, `EPS Estimate` legend text와 sync progress text를 직접 확인함

- 상태
  - 구현 + build/test + live API + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)