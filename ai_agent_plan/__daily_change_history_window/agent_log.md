## 2026-03-30

**작성 시각:** 2026-03-30 11:56 (local)

### Daily Change History Window plan 작성

- 생성/수정 파일:
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - 사용자 요청 기준으로 `Daily Change History Window` 신규 plan을 작성했다.
  - 데이터 source를 `default universe(app.db)` + `company_profiles.market_cap` + `OHLC_data/ohlc_1d_watchlist.sqlite` 조합으로 고정했다.
  - 날짜 선택, custom market cap filter, filtered dataset 기준 상승/하락/보합 집계, 별도 window 등록 흐름을 단계별로 정리했다.
  - backend read API, frontend window type 등록, UI state, summary/table 일관성, 문서 동기화, 검증 단계까지 포함했다.
- 검증 예정:
  - plan 문서 구조/세부 단계 확인
  - 사용자 요구사항 커버 여부 확인
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 생성 작업이라 코드 정적 분석 대상 없음 |
| 빌드 | ✅ | plan 작성 단계로 코드 변경 없음 |
| 자동 테스트 | ✅ | plan 작성 단계로 실행 대상 없음 |
| 런타임 통합 | ✅ | 구현 전 계획 문서 검토로 대체. 실제 런타임 검증은 각 구현 Step에서 수행 예정 |
- 상태:
  - plan 작성 완료, 구현 미착수.
  - 사용자 확인 대기.

**작성 시각:** 2026-03-30 12:11 (local)

### Daily Change History Window plan 결정 반영

- 생성/수정 파일:
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - 사용자 결정에 따라 `null` change row는 summary에서 숨기지 않고 `missingCount`로 별도 표기하도록 plan을 수정했다.
  - 날짜 선택 UI는 quick button 없이 단일 date picker 하나만 두는 방향으로 plan을 수정했다.
  - `미확정 사항`과 차단 요약을 정리해, 남은 미결정이 filter 반영 UX(`D2`)만 남도록 정리했다.
- 검증 예정:
  - plan 문서 내 summary 정의와 UI 정의가 사용자 결정과 일치하는지 확인
  - 남은 미확정 항목이 실제로 `D2`만 남았는지 확인
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정 작업이라 코드 정적 분석 대상 없음 |
| 빌드 | ✅ | plan 갱신 단계로 코드 변경 없음 |
| 자동 테스트 | ✅ | plan 갱신 단계로 실행 대상 없음 |
| 런타임 통합 | ✅ | 문서 결정 반영 확인으로 대체. 실제 기능 검증은 구현 단계에서 수행 예정 |
- 상태:
  - `missingCount` 표기와 단일 date picker 방향 확정.
  - 구현 미착수, 사용자 확인 대기.

**작성 시각:** 2026-03-30 12:23 (local)

### Daily Change History Window 구현

- 생성/수정 파일:
  - `terminal/backend/src/services/dailyChangeHistoryRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/AddTabModal.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - backend에 `GET /api/default-tickers/daily-change-history` endpoint를 추가했다.
  - default universe + latest market cap + OHLC 일봉을 결합하는 `dailyChangeHistoryRepository`를 추가했다.
  - stored derived column이 비어도 동작하도록 `prev close`, `open`, `close` 기준으로 `dailyChangePct`, `closeFromOpenPct`를 query 시점에 직접 계산하게 했다.
  - market cap min/max filter, stable max date 기본값, `missing` summary 집계를 backend에서 함께 반환하도록 구현했다.
  - frontend에 `Daily Change History Window`를 추가하고 `WindowType`, `AddTabModal`, `App`, `DraggableWindow`에 연결했다.
  - 새 창에는 단일 date picker, market cap min/max input, `Apply`, `Reset`, `Refresh`, summary card, row table, error/empty state, localStorage persistence를 구현했다.
  - prompt 문서와 plan 상태를 현재 구현 기준으로 동기화했다.
- 검증 예정:
  - 브라우저 실제 시각 확인은 사용자 확인 대기
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경한 backend/frontend 파일 `get_errors` 0건 |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | workspace test: `14 files / 90 tests` pass |
| 런타임 통합 | ✅ | `GET /api/default-tickers/daily-change-history` 기본 호출 성공. filter 호출(`date=2026-03-27&marketCapMin=1000000000&marketCapMax=50000000000`)에서 `total=1131, gainers=29, losers=130, flat=3, missing=969` 확인. invalid filter(`marketCapMin > marketCapMax`)는 `400` 확인. UI는 코드 리뷰 + API 검증으로 대체, 브라우저 시각 확인은 사용자 위임 |
- 상태:
  - Step 0 ~ Step 4 구현 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 12:26 (local)

### Daily Change History Window turnover 확장 plan 반영

- 생성/수정 파일:
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - 사용자 요청에 따라 turnover 확장 요구를 plan에 추가했다.
  - turnover 정의를 `Volume × ((Open + Close) / 2)`의 일별 값으로 고정했다.
  - 이미 turnover 값이 있는 row는 skip하는 update 로직과 수동 계산 버튼 요구를 `Step 5`로 추가했다.
  - Daily Change History Window에 turnover min/max filter, selectable `Turnover` column, visible column 기준 정렬 요구를 plan에 추가했다.
  - turnover 저장 위치는 `ohlc_1d` 파생 컬럼, 계산 버튼 위치는 Data Control Window로 계획에 고정했다.
- 검증 예정:
  - plan 문서에 turnover 계산식, skip 규칙, filter/column/sort 요구가 모두 반영됐는지 확인
  - 새 `Step 5`와 Track E가 기존 plan 흐름과 충돌하지 않는지 확인
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정 작업이라 코드 정적 분석 대상 없음 |
| 빌드 | ✅ | plan revision 단계로 코드 변경 없음 |
| 자동 테스트 | ✅ | plan revision 단계로 실행 대상 없음 |
| 런타임 통합 | ✅ | 문서 revision 확인으로 대체. 실제 turnover 기능 검증은 구현 단계에서 수행 예정 |
- 상태:
  - turnover 확장 요구 plan 반영 완료.
  - 구현 미착수, 사용자 확인 대기.

**작성 시각:** 2026-03-30 12:37 (local)

### Daily Change History turnover 확장 구현

- 생성/수정 파일:
  - `terminal/backend/src/services/ohlcWatchlistRepository.ts`
  - `terminal/backend/src/services/ohlcDerivedMetrics.ts`
  - `terminal/backend/src/services/dailyChangeHistoryRepository.ts`
  - `terminal/backend/src/services/updateStatusRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/dataControlHowToUse.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - `ohlc_1d` 파생 컬럼에 `Turnover`를 추가하고, 기존 derived metric 계산 시 새 일봉의 turnover도 함께 채우도록 수정했다.
  - ticker별 `Turnover IS NULL` row만 계산하는 backend helper와 `POST /api/ibkr/ohlc1d/turnover/update` background job route를 추가했다.
  - Data Control Window에 `OHLC Turnover Update` 버튼과 how-to/use route를 추가했다.
  - `GET /api/default-tickers/daily-change-history`에 `turnoverMin`, `turnoverMax` filter와 `turnover` 응답 필드를 추가했다.
  - Daily Change History Window에 turnover min/max 입력, Turnover column visibility toggle, 모든 visible column asc/desc 정렬을 추가했다.
  - backend/frontend prompt와 plan 상태를 turnover 구현 기준으로 동기화했다.
- 검증 예정:
  - backend/frontend build
  - endpoint validation (`turnoverMin/turnoverMax`, turnover update job 생성)
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - turnover Step 5 구현 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 12:54 (local)

### FMP recent missing OHLC / change 보강 버튼 구현

- 생성/수정 파일:
  - `terminal/backend/src/services/newsChangeMerger.ts`
  - `terminal/backend/src/services/updateStatusRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/dataControlHowToUse.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - recent 7일 뉴스 중 `change_pct`가 비어 있는 row만 다시 계산하는 `bulkUpdateRecentMissingChange` helper를 추가했다.
  - backend에 `POST /api/news/change/update-recent-fmp-missing` route를 추가해 FMP fallback 기반 missing-only recent change job을 실행하도록 연결했다.
  - backend에 `POST /api/fmp/ohlc1d/update-recent-missing` route를 추가해 default universe의 recent missing OHLC tail만 FMP로 보강하도록 구현했다.
  - OHLC recent fill은 ticker별 max date 다음 날부터만 요청하고, ET 장 마감 전 current ET day는 자동 제외하도록 고정했다.
  - `update_status` 기본 key 목록에 `fmp_ohlc_recent_missing`, `news_change_recent_fmp_missing`를 추가했다.
  - Data Control Window에 `FMP Recent OHLC Fill`, `FMP Recent Missing Change Fill` 섹션과 새 route 연결을 추가했다.
  - backend/frontend prompt와 plan을 새 운영 버튼 기준으로 동기화했다.
- 검증 예정:
  - backend build 성공 (`terminal npm run build`)
  - frontend build 성공 (`terminal_ui_ver2_finhub npm run build`)
  - live API route 검증 성공: `POST /api/news/change/update-recent-fmp-missing`, `POST /api/fmp/ohlc1d/update-recent-missing` 모두 `jobId` 반환
  - live job poll 확인:
    - recent missing change job은 `running`, progress 증가, FMP fallback log 확인
    - recent OHLC fill job은 `running`, ET current day exclusion log 확인
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - 구현 및 1차 검증 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 13:18 (local)

### Daily Change History Window custom change를 date-range popup + preflight로 변경

- 생성/수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - `Custom Change Update` 버튼을 즉시 실행 방식에서 date-range popup 방식으로 변경했다.
  - popup 안에서 `From`, `To`를 직접 선택할 수 있게 했고, `Calculate Scope`로 custom preflight 결과를 표시하도록 구현했다.
  - preflight는 범위 내 전체 뉴스 row 수, 기존 change 보유 row 수, 예상 update row 수를 보여준다.
  - `Start Custom Update`는 선택 기간 전체를 대상으로 기존 `/api/news/change/update-custom` route를 실행한다.
  - 실행 후에는 기존 창 내부 polling/auto-refresh 흐름을 그대로 사용한다.
- 검증 예정:
  - 정적 분석: `DailyChangeHistoryWindow.tsx` 에러 0건
  - frontend build 성공 (`terminal_ui_ver2_finhub npm run build`)
  - custom preflight 검증 성공: `from=2026-03-20`, `to=2026-03-27` 호출에서 `totalRowsInRange=15118`, `rowsExpectedToUpdate=5970` 확인
  - custom route 검증 성공: 같은 range로 `POST /api/news/change/update-custom` 호출 시 `jobId=90238e3b-b5a0-4e46-91e4-5846daa9bd8e` 반환
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - 구현 및 1차 검증 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 13:15 (local)

### Daily Change History Window custom change 버튼 + close-from-open 색상 규칙 추가

- 생성/수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - Daily Change History Window에 `Custom Change Update` 버튼을 추가했다.
  - 이 버튼은 현재 선택된 날짜를 `from/to`로 사용해 `POST /api/news/change/update-custom` route를 직접 호출한다.
  - 기존 창 내부 change action polling/auto-refresh 흐름에 custom job도 포함되도록 확장했다.
  - table의 `Close From Open %` cell을 값 부호 기준으로 `+` 초록, `-` 빨강, `null` amber tone으로 표시하도록 수정했다.
  - frontend prompt와 plan change 항목을 함께 동기화했다.
- 검증 예정:
  - 정적 분석: `DailyChangeHistoryWindow.tsx` 에러 0건
  - frontend build 성공 (`terminal_ui_ver2_finhub npm run build`)
  - custom route 검증 성공: `POST /api/news/change/update-custom`가 `jobId=f941f4f1-97d0-49a9-b7c0-21bbdb5c1bb1` 반환
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - 구현 및 1차 검증 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 13:23 (local)

### Daily Change History custom popup의 `fmpConcurrency` validation 에러 수정

- 생성/수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - 사용자 첨부 화면 기준으로 custom popup에서 `fmpConcurrency`가 `0`으로 전송돼 backend `min(1)` 검증에 걸리는 문제를 확인했다.
  - 원인은 `change-fmp-concurrency` localStorage 값이 invalid여도 Daily Change History Window가 그대로 payload에 실어 보내는 것이었다.
  - 프런트에 범위 보정 helper를 추가해 `change-fmp-concurrency`는 `1~20`, `fmp-request-interval-ms`는 `0~5000` 범위를 벗어나면 각각 기본값 `5`, `250`으로 fallback 하도록 수정했다.
  - `Recent Change Update`, `FMP Missing Change Fill`, `Custom Change Update`가 모두 같은 sanitized option helper를 재사용하도록 정리했다.
  - backend가 구조화된 validation error 배열을 내려줄 때 popup에 raw JSON 전체가 보이지 않도록, 첫 번째 핵심 메시지를 읽기 쉬운 문자열로 변환하는 에러 추출 로직을 추가했다.
- 사용자가 직접 확인할 수 있는 검증 방법:
  - Daily Change History Window에서 `Custom Change Update`를 다시 열고 `Calculate Scope`를 누른다.
  - 이전처럼 빨간 박스에 raw JSON 검증 배열이 뜨지 않고, 정상 preflight 수치가 보이는지 확인한다.
  - 필요하면 브라우저 개발자도구 Application > Local Storage에서 `change-fmp-concurrency=0` 같은 값이 남아 있어도 popup이 정상 동작하는지 확인한다.
- 문제점/리스크 + 완화 방안:
  - localStorage에 다른 invalid 값이 추가로 남아 있을 수 있다. 완화: 이번 helper가 두 핵심 옵션 모두 범위 보정한다.
  - 브라우저 시각 확인은 아직 사용자 확인이 필요하다. 완화: build + API 검증 완료 후 사용자에게 popup 재확인을 요청한다.
  - backend validation error 형식이 바뀌면 메시지 추출 규칙이 일부 제한적일 수 있다. 완화: 배열/문자열 외 형식은 `HTTP status`로 fallback 하게 유지했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DailyChangeHistoryWindow.tsx` `get_errors` 0건 |
| 빌드 | ✅ | frontend `npm.cmd run build`, backend 기존 build 상태 유지 |
| 자동 테스트 | ✅ | 이번 수정 범위는 프런트 payload/에러 처리라 기존 테스트 추가 없음, 기존 실패 신호 없음 |
| 런타임 통합 | ✅ | `POST /api/news/change/update-custom/preflight`를 `from/to`만 포함한 payload로 호출해 정상 summary 응답 확인. UI는 코드 리뷰 + API 검증으로 대체, 브라우저 시각 확인은 사용자 위임 |
- 상태:
  - 수정 및 1차 검증 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 13:07 (local)

### Daily Change History Window에 change update 버튼 직접 노출

- 생성/수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - Daily Change History Window 헤더에 `Recent Change Update`, `FMP Missing Change Fill` 버튼을 추가했다.
  - 두 버튼은 Data Control과 같은 backend route를 직접 호출하도록 연결했다.
  - 창 내부에서 간단한 job 상태 문구를 polling으로 보여주고, job 완료 시 현재 filter 기준으로 자동 refresh 되게 했다.
  - 관련 frontend prompt와 plan change 항목을 함께 갱신했다.
- 검증 예정:
  - 정적 분석: `DailyChangeHistoryWindow.tsx` 에러 0건
  - frontend build 성공 (`terminal_ui_ver2_finhub npm run build`)
  - route target 검증 성공: `POST /api/news/change/update-recent-fmp-missing`가 `jobId=60929484-1ece-4dc6-bf59-7c9da7cb4357` 반환
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - 구현 및 1차 검증 완료, 사용자 확인 대기.

**작성 시각:** 2026-03-30 13:01 (local)

### Daily Change History filter shorthand + apply 계산 + dual summary 확장

- 생성/수정 파일:
  - `terminal/backend/src/services/dailyChangeHistoryRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/daily_change_history_window/plan.md`
  - `ai_agent_plan/daily_change_history_window/agent_log.md`
- 수행 내용:
  - Daily Change History API가 `marketCapMin`, `marketCapMax`, `turnoverMin`, `turnoverMax`에 대해 `1M`, `2.5B` 같은 shorthand number를 허용하도록 수정했다.
  - backend는 stored derived value가 있으면 우선 사용하고, 없으면 `Apply` 시점 조회에서 `dailyChangePct`, `closeFromOpenPct`, `turnover`를 즉시 계산하도록 보강했다.
  - summary 응답 shape를 `dailyChange` 세트와 `closeFromOpen` 세트의 2벌로 확장했다.
  - frontend Daily Change History Window의 filter input을 text 기반으로 바꾸고 shorthand 예시를 표시했다.
  - frontend summary 영역을 `Daily Change %`, `Close From Open %` 두 섹션으로 분리했다.
- 검증 예정:
  - backend build 성공 (`terminal npm run build`)
  - frontend build 성공 (`terminal_ui_ver2_finhub npm run build`)
  - shorthand query 검증 성공: `marketCapMin=1B&turnoverMin=100M` 호출에서 정상 응답 확인
  - invalid suffix 검증 성공: `marketCapMin=abcQ` 호출에서 `400` 확인
  - dual summary 검증 성공: `dailyChange.gainers=11`, `closeFromOpen.gainers=12` 확인
  - 분리 분류 예시 확인: `VC`가 `dailyChangePct < 0`, `closeFromOpenPct > 0`로 반환됨
  - 브라우저 시각 확인은 사용자 확인 대기
- 상태:
  - 구현 및 1차 검증 완료, 사용자 확인 대기.