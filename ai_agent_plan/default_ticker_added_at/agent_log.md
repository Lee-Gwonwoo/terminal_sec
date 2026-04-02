## 2026-03-30

**작성 시각:** 2026-03-30 08:35 (local)

### Default Ticker Added Date 구현

- 생성/수정 파일:
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - `getDefaultUniverseRows()`가 `ticker_universe_items.created_at`를 `addedAt`으로 내려주도록 backend 응답 shape를 수정했다.
  - custom CSV path row와 fallback row는 `addedAt = null`로 고정해 API shape를 일관되게 맞췄다.
  - `DefaultTickerWindow.tsx`에 `addedAt` 타입/normalizer를 추가하고 `Added Date` 컬럼을 새로 렌더링했다.
  - `최근 추가순` 토글과 현재 정렬 기준 문구를 추가해 방금 추가한 ticker를 쉽게 찾을 수 있게 했다.
- 검증 예정:
  - 정적 분석
  - frontend/backend build
  - 자동 테스트
  - `/api/tickers` runtime 응답 + Default Ticker UI 렌더링 코드 리뷰
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `DefaultTickerWindow.tsx` 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npx vite build` 모두 성공 |
| 자동 테스트 | ✅ | workspace backend `14 files / 88 tests` pass |
| 런타임 통합 | ✅ | 임시 backend(`PORT=8091`)로 `GET /api/tickers` 실호출 확인: sample row에 `addedAt: "2026-03-07 17:47:02"` 포함. frontend는 `Added Date` 컬럼/`Recent Added` 토글/정렬 기준 문구 렌더링 코드 리뷰 확인, 브라우저 시각 확인은 사용자 위임 |
- 상태:
  - Step 1-1 ~ 3-3 구현 완료, 사용자 확인 대기.

## 2026-03-31

**작성 시각:** 2026-03-31 18:41 (local)

### Default Ticker JSON 응답 회귀 수정

- 생성/수정 파일:
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - `getDefaultUniverseRows()`의 typed row 선언에 `insider_pct`, `insider_source`를 추가해 backend compile error를 제거했다.
  - `DefaultTickerWindow.tsx`에 `readJsonResponse()`를 추가해 빈 response body에서도 `Unexpected end of JSON input` 예외가 직접 노출되지 않도록 했다.
  - 잘못 끼어든 `setShowYahooLog(true)`를 `handleYahooHoldersUpdate()`로 되돌려 Yahoo job 시작 시에만 로그가 자동으로 열리게 복구했다.
  - job polling(`market cap`, `float`, `institutional`, `yahoo holders`)도 동일한 안전 JSON 파서를 사용하도록 맞췄다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `DefaultTickerWindow.tsx` 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 모두 성공 |
| 자동 테스트 | ✅ | backend `14 files / 90 tests` pass |
| 런타임 통합 | ✅ | `GET http://localhost:8080/api/tickers` 실호출에서 유효 JSON 응답 확인. 8080에는 이미 기존 backend 프로세스가 떠 있었고, 응답 row에 `insiderPct`, `insiderSource` 포함됨 |
- 상태:
  - 회귀 수정 반영 완료, 사용자 확인 대기.

## 2026-03-31

**작성 시각:** 2026-03-31 18:54 (local)

### Yahoo holders partial persist + source 충돌 수정

- 생성/수정 파일:
  - `terminal/backend/src/services/yahooOwnershipProvider.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend/src/services/companyProfileRepository.ts`
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - Yahoo batch worker에 `onResult` callback을 추가하고, ticker 1건을 받는 즉시 route가 DB에 저장하도록 변경했다.
  - cancel check를 per-ticker 저장 이후로 옮겨서, 사용자가 중간에 취소해도 이미 받은 ticker는 DB에 남도록 수정했다.
  - ownership canonical row가 `source='yahoo'` description row와 충돌하던 문제를 수정했다. 이제 같은 source row가 이미 있으면 그 row에 ownership를 merge하고, 다른 row의 `institutional_*` / `insider_*` 값은 비운다.
  - 최신 backend를 별도 포트 `8091`로 띄워 cancel 런타임을 검증한 뒤, live port `8080`도 최신 코드로 재기동했다.
- 런타임 검증 핵심 결과:
  - `8091`에서 20 ticker Yahoo holders job을 시작하고 4초 후 cancel했다.
  - job status는 `cancelled`, progress는 `10/20`으로 멈췄지만, 로그에는 cancel 이후에도 완료된 in-flight ticker들이 `institutional`/`insider` 저장 로그를 남겼다.
  - 같은 ticker 20개를 DB로 재확인한 결과, cancel 후에도 `19`개 ticker에 `institutional_source='yahoo'` 또는 `insider_source='yahoo'`가 실제 저장돼 있었다.
  - 마지막으로 `8080 /healthz` 실호출 `200 {"ok":true}` 확인 후 live backend를 최신 코드로 교체했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `yahooOwnershipProvider.ts`, `companyProfileRepository.ts` 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `14 files / 90 tests` pass |
| 런타임 통합 | ✅ | `8091`에서 cancel 시나리오 검증: 20개 중 19개 Yahoo ownership 저장 확인. `8080 /healthz` 200 확인 후 live backend 재기동 |
- 상태:
  - partial persist 수정 반영 완료, 사용자 확인 대기.

## 2026-03-31

**작성 시각:** 2026-03-31 19:06 (local)

### DB 구조 / backend / frontend 문서 동기화

- 생성/수정 파일:
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `.github/copilot-skills/repo-context.md`
  - `terminal/backend/DB_SCHEMA.md`
  - `terminal/backend/CODE_STRUCTURE.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/FRONTEND_CODE_STRUCTURE.md`
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - backend prompt 문서에 `company_profiles` ownership/insider 필드, `GET /api/tickers` default-universe row shape, `POST /api/company-profiles/pull-holders-yahoo`, `company_profiles_holders_yahoo` update_status key를 현재 코드 기준으로 반영했다.
  - frontend prompt 문서에 Default Ticker의 `Yahoo Holders` 버튼, `Added Date`, `Insider %`, `GET /api/jobs/:jobId` polling, source badge 사용 방식을 반영했다.
  - repo-context 문서에 현재 app DB 구조, `company_profiles` representative ownership row 규칙, Default Ticker 반환 필드, 관련 route 목록을 반영했다.
  - 빠른 참조용으로 backend DB 요약/백엔드 구조/프론트 구조 문서를 새로 추가했다.
- 확인한 핵심 포인트:
  - 새 구조 문서 3개가 실제 경로에 생성되어 있다.
  - 기존 프롬프트 문서와 repo-context 문서에서 `pull-holders-yahoo`, `insiderPct`, `insiderSource`, `company_profiles_holders_yahoo`, `Added Date`, `GET /api/jobs/:jobId` 키워드가 현재 구현과 맞게 반영된 것을 확인했다.
  - `8080`은 실제 listen 중이며, `GET /api/model2/analyses` 응답도 정상 반환돼 문서가 가리키는 live backend가 동작 중임을 재확인했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `backend_prompt.md`, `figma_frontend_prompt.md`, `repo-context.md`, 새 구조 문서 3개 모두 diagnostics 0 |
| 빌드 | ✅ | 문서-only 변경으로 빌드 대상 코드 diff 없음 |
| 자동 테스트 | ✅ | 문서-only 변경으로 테스트 대상 코드 diff 없음 |
| 런타임 통합 | ✅ | `8080` listener 확인 + `GET /api/model2/analyses` 정상 JSON 응답 확인 |
- 상태:
  - 문서 동기화 반영 완료, 사용자 확인 대기.

## 2026-04-01

**작성 시각:** 2026-04-01 06:15 (local)

### Yahoo-only institutional 전환 + Finnhub institutional 제거

- 생성/수정 파일:
  - `terminal/backend/src/services/yahooOwnershipProvider.ts`
  - `terminal/backend/src/services/companyProfileRepository.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `.github/copilot-skills/repo-context.md`
  - `terminal/backend/DB_SCHEMA.md`
  - `terminal/backend/CODE_STRUCTURE.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/FRONTEND_CODE_STRUCTURE.md`
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - Yahoo held-percent 정규화를 수정했다. `institutionsPercentHeld` / `insidersPercentHeld`가 `1.0067`처럼 1보다 큰 ratio로 와도 `100.67%`로 저장되도록 변경했다.
  - `GET /api/tickers`의 default-universe row는 이제 `institutionalPct`를 Yahoo ownership row만 기준으로 재노출한다. legacy Finnhub institutional 값은 UI source에서 제외된다.
  - `POST /api/company-profiles/pull-institutional`은 제거하고 `410 Gone` + `pull-holders-yahoo` 사용 안내를 반환하게 바꿨다.
  - Default Ticker에서 Finnhub `Inst` 버튼, 관련 polling, log panel을 제거하고 ownership 갱신 경로를 Yahoo Holders 하나로 정리했다.
  - 현재 runtime DB에 대해 one-off 백필을 실행했다. Yahoo row `445`건을 raw payload 기준으로 재계산했고, Finnhub institutional row `24`건은 null 처리했다.
- 런타임 확인 핵심 결과:
  - `GET /api/tickers` 실응답에서 `APLS.institutionalPct = 100.67401`, `institutionalSource = 'yahoo'`로 확인됐다.
  - 샘플 `AAPL`, `TSLA`, `NVDA`, `SMCI`도 모두 `institutionalSource = 'yahoo'`로만 반환됐다.
  - 백필 후 DB 집계는 `institutional_source='yahoo'`만 남았고, `institutional_pct > 100` row가 `439`건 존재했다. 이는 더 이상 잘리지 않고 그대로 유지된다.
  - removed route 검증 결과 `POST /api/company-profiles/pull-institutional`은 실제로 `410`을 반환했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 코드 4개 + 문서 diagnostics 0 |
| 빌드 | ✅ | backend `npm.cmd run build`, webui `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `14 files / 90 tests` pass |
| 런타임 통합 | ✅ | `GET /api/tickers` 실응답에서 Yahoo-only institutional 확인, removed route `410` 확인 |
- 상태:
  - Yahoo-only institutional 전환 및 DB 보정 반영 완료, 사용자 확인 대기.

## 2026-04-01

**작성 시각:** 2026-04-01 06:15 (local)

### 요약 문서 3개 제거 + canonical 문서 일원화

- 생성/수정 파일:
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `.github/copilot-skills/repo-context.md`
  - `terminal/backend/CODE_STRUCTURE.md` 삭제
  - `terminal/backend/DB_SCHEMA.md` 삭제
  - `termina_web/figma_code/terminal_ui_ver2_finhub/FRONTEND_CODE_STRUCTURE.md` 삭제
  - `ai_agent_plan/default_ticker_added_at/plan.md`
  - `ai_agent_plan/default_ticker_added_at/agent_log.md`
- 수행 내용:
  - 별도 quick reference 용도로 추가했던 구조/DB 요약 문서 3개는 유지 필요성이 낮고 drift 위험만 늘리므로 제거했다.
  - 현재 구조 설명의 source of truth는 기존 문서 세 곳으로 일원화했다: `terminal/backend_prompt.md`, `figma_frontend_prompt.md`, `.github/copilot-skills/repo-context.md`.
  - canonical 문서 쪽은 이미 최신 구조가 반영돼 있음을 재확인했고, 삭제 후 깨지는 직접 참조가 없도록 함께 점검했다.
- 검증 표:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | canonical 문서와 plan/log diagnostics 0 |
| 빌드 | ✅ | 삭제 대상은 문서-only 파일이며 최신 backend/frontend build 성공 상태 유지 |
| 자동 테스트 | ✅ | 최신 backend test 14 files / 90 tests pass 상태 유지 |
| 런타임 통합 | ✅ | 삭제 전후 runtime source는 동일하며 canonical 문서 기준 API 확인 상태 유지 |
- 상태:
  - 요약 문서 제거 및 canonical 문서 일원화 완료, 사용자 확인 대기.