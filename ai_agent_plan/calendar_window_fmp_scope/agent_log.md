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

## 2026-04-29
**작성 시각:** 2026-04-29 07:06 (local)

### Calendar earnings confirmed 가시성 회귀 수정

- 변경 파일
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 확인한 원인
  - 현재 Calendar earnings 화면에는 예전 구현에 있던 `Confirmed / Unconfirmed` quick filter가 빠져 있었다.
  - `2026-04-01 ~ 2026-05-31` 범위 기준으로 earnings row는 `1170`건이고, 이 중 `confirmed=135`, `pending=1035`였다.
  - 기본 정렬이 최신 날짜 우선이라 pending future row가 상단을 대부분 차지해, confirmed row가 실제로는 존재해도 화면상에서 바로 보이지 않는 상태였다.
- 구현 내용
  - `CalendarWindow`에 `confirmedFilter` state 추가
  - search / 숫자 필터 이후의 base filtered row 집합과 confirmed filter 적용 단계를 분리
  - earnings summary를 `Status` 필터 바로가기 형태로 바꿔 `All / Confirmed / Pending` 버튼을 추가
  - summary count는 confirmed filter 적용 전 기준으로 유지해 현재 범위 분포를 바로 볼 수 있게 수정
  - Reset 버튼이 confirmed filter도 함께 초기화하도록 수정
- 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `CalendarWindow.tsx` `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `16 files / 96 tests` 통과 |
| 런타임 통합 | ✅ | 브라우저에서 `2026-04-01 ~ 2026-05-31` 범위 로드 후 `Status / All 1170 / Confirmed 135 / Pending 1035` 노출 확인, `Confirmed 135` 클릭 시 첫 row가 `2026-04-24 HCA Confirmed`로 필터링됨 |

- 상태
  - 구현 + build/test + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-29
**작성 시각:** 2026-04-29 07:52 (local)

### Calendar watchlist/date preset/column drag 추가

- 변경 파일
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 구현 내용
  - `CalendarWindow`에 watchlist dropdown 추가
  - `GET /api/watchlists`로 목록을 읽고, economics를 제외한 탭에서만 표시하도록 구성
  - watchlist 선택 시 `GET /api/calendar/events`에 `watchlist_id`를 붙여 server-side filter로 다시 fetch하도록 수정
  - `Quick Range` 버튼(`This Week`, `Next 5 Days`, `Next 2 Weeks`, `This Month`, `Next Month`) 추가
  - preset 클릭 시 `dateFrom/dateTo`를 즉시 채우고, date input을 수동 수정하면 preset active 상태가 해제되도록 수정
  - table header에 drag handle을 추가하고 visible column 순서를 drag-and-drop으로 재배치할 수 있게 수정
  - footer summary에 watchlist 적용 중일 때 현재 watchlist 이름이 보이도록 보강
- 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `CalendarWindow.tsx` `get_errors` 0 errors |
| 빌드 | ✅ | frontend `npm run build` 성공 |
| 브라우저 런타임 | ✅ | `Next 5 Days` 클릭 시 `2026-04-29 ~ 2026-05-03` 자동 입력 및 row 로드 확인 |
| 브라우저 런타임 | ✅ | `market leader 1` watchlist 선택 시 footer가 `Showing 0 of 0 events · Watchlist: market leader 1`로 바뀌고 결과 집합이 재조회됨을 확인 |
| 브라우저 런타임 | ✅ | `Symbol` header를 `Date` 앞으로 드래그했을 때 header 순서가 `Symbol / Date / ...`로 바뀌는 것 확인 |

- 상태
  - 구현 + build + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-16
**작성 시각:** 2026-04-16 08:31 (local)

### CalendarWindow FMP Sync Settings 추가 + calendar concurrency 안전화

- 변경 파일
  - `terminal/backend/src/services/fmpRequestScheduler.ts`
  - `terminal/backend/src/services/fmpEarningsCalendarProvider.ts`
  - `terminal/backend/src/services/fmpFinancialSeriesProvider.ts`
  - `terminal/backend/src/services/calendarFinancialRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 사용자 요구
  - earnings 탭의 `Update FMP Earnings Dates`, `Sync Financial + Past Estimates` 두 버튼에 대해 window 안에서 병렬 처리 수치를 수정할 수 있게 해 달라는 요청.
- 구현 내용
  - earnings 탭 툴바에 `FMP Sync Settings` 버튼 추가
  - settings panel 안에 `Earnings Update`, `Financial Sync` concurrency spinbutton 추가
  - 값은 localStorage `calendar-fmp-earnings-concurrency`, `calendar-fmp-financial-concurrency`에 저장되도록 구현
  - `POST /api/fmp/calendar/earnings/update`, `POST /api/fmp/calendar/financials/update`가 body `concurrency`, `requestIntervalMs`를 읽어 worker pool + shared FMP request scheduler에 반영하도록 수정
  - FMP request는 병렬화하되 SQLite transaction write는 route 내부 mutex로 직렬화해 concurrent `BEGIN IMMEDIATE` 충돌을 방지
  - annual financial snapshot은 fiscal year 기반 canonical date를 사용하고 insert 전 same-date guard merge를 적용해 `LOW`처럼 actual FY2025와 next-FY estimate가 같은 raw date를 공유할 때의 unique collision을 제거
- 중간에 발견한 문제와 수정
  - 첫 multi-chunk earnings concurrency 검증에서 `SQLITE_ERROR: cannot start a transaction within a transaction` 발생
    - 원인: chunk worker들이 shared SQLite connection에서 동시에 `BEGIN IMMEDIATE` 실행
    - 조치: chunk fetch는 병렬 유지, DB write transaction만 mutex로 직렬화
  - 첫 financial concurrency 검증에서 `LOW` ticker에 `UNIQUE constraint failed: calendar_financial_series.ticker, period_type, report_date` 발생
    - 원인: annual actual(`FY2025`)과 annual estimate(`FY2026`)가 upstream raw `2026-01-30`을 함께 사용
    - 조치: annual canonical date를 fiscal-year-end로 정규화하고 snapshot insert 전 same-date merge guard 추가
- 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fmpRequestScheduler.ts`, `fmpEarningsCalendarProvider.ts`, `fmpFinancialSeriesProvider.ts`, `calendarFinancialRepository.ts`, `server.ts`, `CalendarWindow.tsx` error 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` 통과 |
| 런타임 통합 | ✅ | `POST /api/fmp/calendar/earnings/update` (`2026-01-01~2026-04-30`, `concurrency=3`) 완료 + job result에 `concurrency=3` 확인, `POST /api/fmp/calendar/financials/update` (`concurrency=4`) running/log 확인 후 cancel, `LOW` direct snapshot fetch+store 성공, browser에서 `FMP Sync Settings` 버튼과 두 concurrency spinbutton 노출 확인 |

- 런타임 확인 메모
  - earnings verification job `aa84cdb3-1fac-4130-85b9-c741752d6fe7`
    - 완료 상태: `done`
    - logs: `[batch] concurrency=3, requestIntervalMs=250`
    - result: `chunks=4`, `concurrency=3`, `matchedRows=1382`
  - financial verification job `0cb9c085-9f57-4537-bf71-81b6964334c2`
    - running 중 log: `[batch] concurrency=4, requestIntervalMs=250`
    - cancel 직전 progress: `25/1699`, `synced=25`, `failed=0`
    - 이후 verification 목적상 cancel 완료
  - browser snapshot 기준 earnings toolbar에 `FMP Sync Settings` 버튼 표시, panel 안에 `Earnings Update=1`, `Financial Sync=1` spinbutton 확인

- 상태
  - 구현 + build/test + live API + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 21:48 (local)

### full sync 실패 내성 보강 + 실제 과거 데이터 다운로드 재시작

- 변경 파일
  - `terminal/backend/src/server.ts`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 사용자 보고 이슈
  - 실제 `Sync Financial + Past Estimates` 실행 시 job 실패를 경험함.
- 확인한 원인
  - route가 ticker 단위 예외를 잡지 않고 전체 `void(async () => ...)` 바깥 catch로만 처리하고 있어서, 특정 ticker의 FMP fetch/store 실패가 전체 default-universe job abort로 이어질 수 있었다.
- 구현 내용
  - `POST /api/fmp/calendar/financials/update` loop를 per-ticker `try/catch`로 변경
  - 실패 ticker는 `${ticker}: FAILED — ...` log와 `tickersFailed` count로 누적
  - 성공 ticker는 계속 저장하고, periodic progress log는 `synced/failed` count를 함께 기록
  - job result / `setLastSuccess()` payload에 `tickersFailed` 추가
- 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts` error 0 |
| 빌드 | ✅ | backend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `15 files / 91 tests` 통과 |
| 런타임 통합 | ✅ | `POST /api/fmp/calendar/financials/update` 재실행 후 job `2bd92890-ddfe-44db-bca7-474c85b2b236`가 immediate failure 없이 `running`, progress `6 / 1699` 확인 |

- 런타임 확인 메모
  - active jobs 사전 확인 결과 없음
  - full sync restart job: `2bd92890-ddfe-44db-bca7-474c85b2b236`
  - 확인 시점 상태: `running`
  - 확인 시점 progress: `completed=6`, `total=1699`

- 상태
  - 구현 + build/test + live API 검증 완료
  - full default-universe past-data sync는 현재 background에서 실행 중
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 21:42 (local)

### default universe financial sync에 past quarterly estimate 포함

- 변경 파일
  - `terminal/backend/src/services/fmpFinancialSeriesProvider.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 확인한 원인
  - FMP `stable/analyst-estimates?period=quarter`는 가까운 과거부터가 아니라 더 먼 미래 quarter부터 내려오는 경우가 있었다.
  - 기존 구현은 quarterly `limit=8`을 statement와 estimate에 동일 적용해서 `2025 Q1~2026 Q1` 같은 past estimate가 fetch window 밖으로 잘렸다.
  - 추가로 quarterly actual은 `fiscalYear + period`, estimate는 `date` 기준으로 point가 갈라질 수 있어 same-date merge가 보장되지 않았다.
- 구현 내용
  - quarterly analyst-estimates fetch window를 기본 `24`로 확장
  - quarterly merge key를 `report_date` 우선으로 수정하고, actual row의 explicit fiscal metadata가 들어오면 label/fiscalYear/period를 그 값으로 보정
  - quarterly 응답은 `실적이 있는 history window + 가까운 미래 4개 estimate quarter`만 남기도록 trim
  - earnings toolbar 버튼 라벨/Job label을 `Sync Financial + Past Estimates` / `FMP Financial + Past Estimate Sync`로 변경
  - financial dialog summary card는 future-only last point 대신 최신 reported actual period를 우선 사용
  - `Historical Actual vs Estimate` 표는 future-only row보다 historical actual window를 우선 표시
- 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | changed TS/MD files error 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | `15 files / 91 tests` 통과 |
| 런타임 통합 | ✅ | provider direct call에서 `SNPS` quarterly `Q1 '25 ~ Q1 '26` actual + estimate merge 확인, `POST /api/fmp/calendar/financials/update`가 immediate failure 없이 job 생성 후 cancel 확인, browser toolbar에서 `Sync Financial + Past Estimates` 버튼 표시 확인 |

- 런타임 확인 메모
  - provider direct sample (`SNPS`)
    - `Q1 '25`: `revenue=1.455B`, `revenueEstimate=1.451B`, `eps=1.91`, `epsEstimate=2.79054`
    - `Q4 '25`: `revenue=2.255B`, `revenueEstimate=2.247B`
    - `Q1 '26`: `revenue=2.409B`, `revenueEstimate=2.390B`
  - sync endpoint verification
    - verification job `ec1f0968-0178-4c71-9c98-a698a3dcf1a3` 생성 성공
    - 상태 `running` 확인 후 API quota 낭비를 막기 위해 즉시 cancel
  - 이전 검증 중 발견한 duplicate insert 오류(`UNIQUE constraint failed: calendar_financial_series.ticker, period_type, report_date`)는 quarterly merge key를 `date` 우선으로 바꾼 뒤 재현되지 않음

- 상태
  - 구현 + build/test + live API + browser 검증 완료
  - 사용자 확인 대기 (`awaiting user confirmation`)

## 2026-04-15
**작성 시각:** 2026-04-15 21:26 (local)

### confirmed-only 범위 안내 + historical estimate 가시성 보강

- 변경 파일
  - `terminal/backend/src/services/fmpFinancialSeriesProvider.ts`
  - `terminal/backend/src/services/calendarFinancialRepository.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/calendar_window_fmp_scope/plan.md`
  - `ai_agent_plan/calendar_window_fmp_scope/agent_log.md`
- 확인한 원인
  - `confirmed만 보인다`는 현재 선택 범위(`2026-04-14 ~ 2026-04-30`)에 실제로 confirmed row만 있기 때문이었다.
  - 같은 earnings API를 `2026-05-31`까지 넓히면 `Pending=False`가 아니라 `confirmed=false` pending row가 47건 확인됐다.
  - financial dialog의 과거 estimate는 데이터가 없던 것이 아니라, annual에서 estimate row와 actual row가 exact `date` 차이로 두 point로 갈라져 가시성이 떨어졌다.
- 구현 내용
  - annual financial series merge key를 회계연도 기준으로 보정
  - 기존 cache에 저장된 annual duplicate row도 read path에서 접어 같은 회계연도 actual + estimate를 하나의 point로 반환
  - earnings 화면에 현재 결과 범위의 `Confirmed / Pending` count와 confirmed-only 안내 추가
  - financial dialog에 `Historical Actual vs Estimate` 비교표 추가
- 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| backend 정적 분석 | ✅ | `fmpFinancialSeriesProvider.ts`, `calendarFinancialRepository.ts` error 없음 |
| frontend 정적 분석 | ✅ | `CalendarFinancialDialog.tsx`, `CalendarWindow.tsx` error 없음 |
| backend build | ✅ | `terminal/backend`에서 `npm run build` 성공 |
| backend tests | ✅ | vitest `15 files / 91 tests` 통과 |
| frontend build | ✅ | `terminal_ui_ver2_finhub`에서 `npm run build` 성공 |
| live financial API | ✅ | `GET /api/calendar/financials/KMX`에서 annual `2024` row가 actual + estimate로 합쳐져 반환됨 |
| live earnings API | ✅ | `GET /api/calendar/events?type=earnings&from=2026-04-15&to=2026-06-15`에서 pending sample 확인 |
| browser runtime | ✅ | earnings 화면의 `Confirmed 3 / Pending 0` 안내 표시, KMX dialog의 `Historical Actual vs Estimate` 표에서 2024/2025/2026 actual + estimate 동시 표시 확인 |

- 런타임 확인 메모
  - current range `2026-04-14 ~ 2026-04-30`는 confirmed 3 / pending 0
  - widened range `2026-04-15 ~ 2026-06-15` sample first rows는 `2026-05-07` pending earnings (`ARDX`, `FROG`, `BIIB` 등)
  - KMX annual sample: `2024 revenue=28.21B / revenueEstimate=27.69B`, `eps=3.03 / epsEstimate=2.55`

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