## 2026-03-24

**작성 시각:** 20:34 (local)

### 변경 요약
- `terminal/backend/src/services/fmpOhlcProvider.ts` 신규 추가
  - FMP `historical-price-eod/full` 기반 일봉 OHLC fetch + retry/backoff + 전역 throttle 구현
- `terminal/backend/src/services/newsChangeMerger.ts` 수정
  - change update의 Phase 1.5를 `IBKR fallback`에서 `FMP fallback`으로 교체
  - OHLC DB에 없는 ticker를 FMP로 받아 upsert 후 재계산하도록 변경
- `terminal/backend/src/server.ts` 수정
  - `POST /api/news/change/update-recent`
  - `POST /api/news/change/update-custom`
  - 위 두 route가 `fmpConcurrency`, `fmpRequestIntervalMs`를 받도록 변경
  - 하위 호환용 `ibkrConcurrency`는 FMP concurrency alias로만 잠시 허용
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` 수정
  - change update 설정 라벨을 IBKR 기준에서 FMP 기준으로 변경
  - change update 요청 body를 `fmpConcurrency`로 전송하도록 변경
- 문서 동기화
  - `ai_agent_plan/fmp_ohlc_change_update/plan.md`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

### 결정
- 사용자 요청에 따라 change update용 IBKR fallback은 사용하지 않도록 결정했다.
- 현재 source 정책:
  - 1차: 로컬 OHLC DB
  - 2차: FMP 일봉 OHLC
  - change update용 IBKR fallback: 비활성

### 런타임 검증 메모
- FMP 실응답 probe
  - `historical-price-eod/full?symbol=AAPL&from=2026-03-01&to=2026-03-24` → HTTP 200
  - `historical-chart/1hour?symbol=AAPL&from=2026-03-20&to=2026-03-24` → HTTP 200
- 실제 change update endpoint 검증
  - `POST /api/news/change/update-custom`
  - body: `{ "from": "2026-03-24", "to": "2026-03-24", "fmpConcurrency": 3, "fmpRequestIntervalMs": 100 }`
  - job log 핵심 결과:
    - `[change] 1253 items missing OHLC, starting FMP fallback...`
    - `[FMP fallback] fetching 409 tickers (2026-02-22~2026-05-08), concurrency=3, interval=100ms`
    - `[FMP fallback] fetched=408, failed=1, upserted=8972 bars`
    - `[FMP fallback] re-computed 1252/1253 items`
    - `[change] FMP fallback done: 1252 computed, 1 still missing`

### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 12 files / 64 tests pass |
| 런타임 통합 | ✅ | `POST /api/news/change/update-custom` 실호출로 FMP fallback log + OHLC upsert 확인 |

### 사용자 확인 상태
- Step 1: 구현 완료, 사용자 확인 대기
- Step 2: 구현 완료, 사용자 확인 대기

상태: awaiting user confirmation