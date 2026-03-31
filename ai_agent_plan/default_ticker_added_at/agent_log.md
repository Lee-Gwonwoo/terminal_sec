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