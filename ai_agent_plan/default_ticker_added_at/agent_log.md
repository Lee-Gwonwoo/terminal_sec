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