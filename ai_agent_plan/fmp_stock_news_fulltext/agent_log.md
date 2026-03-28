## 2026-03-27

**작성 시각:** 22:13 (local)

### 작업 항목

- FMP stock news pull의 inline fulltext worker를 ticker worker와 분리하도록 backend payload에 `[][][]fulltextConcurrency[][][]`를 추가했다.
- `FinnhubNewsWindow`의 `Control` modal과 `DataControlWindow` Settings 탭에 `fmp-stock-fulltext-concurrency` 기반 설정 UI를 추가했다.
- manual `FMP Stock Only` fulltext와 `Recent/Custom FMP Stock` pull의 auto fulltext가 같은 전용 설정값을 공유하도록 정렬했다.
- `plan.md`, `terminal/backend_prompt.md`, `figma_frontend_prompt.md`를 현재 동작에 맞게 갱신했다.

### 변경 파일

- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `terminal/backend_prompt.md`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/fmp_stock_news_fulltext/plan.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 파일 3개 `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend: `npm.cmd run build` (`terminal/`) 성공, frontend: `npm.cmd run build` (`termina_web/figma_code/terminal_ui_ver2_finhub/`) 성공 |
| 자동 테스트 | ⚠️ 기존 실패 2건 | `npm.cmd run test` 실행. `tests/finnhubNewsProvider.test.ts`의 기존 실패 2건(`should handle missing fields with defaults`, `should infer publisher from content when Finnhub source stays FINNHUB`)로 전체 suite 실패 |
| 런타임 통합 | ✅ | `POST /api/news/pull-fmp-stock-news`에 `fulltextConcurrency=7`로 최소 payload 전송 후 job log에서 `[batch] tickerConcurrency=2, fulltextConcurrency=7` 확인, 이어서 cancel 처리 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 사용자가 확인하면 이 항목을 `user-confirmed`로 갱신한다.

### 리스크 / 메모

- `FMP Stock Full Text Concurrency`를 너무 높이면 publisher origin 사이트 차단 가능성이 있다. 기본값은 25로 두고, 사용자가 필요 시 올리도록 했다.
- `POST /api/news/pull-fmp-press-release`는 이번 변경 범위 밖이므로 여전히 auto fulltext에 `tickerConcurrency`를 사용한다.
- backend test suite에는 이번 변경 전부터 `finnhubNewsProvider` 관련 실패 2건이 남아 있어 전체 green 상태는 아니다.
- frontend 시각 확인은 별도 브라우저 상호작용까지 자동화하지 않았으므로, 실제 UI 배치/문구 확인은 사용자 화면에서 한 번 보는 것이 가장 빠르다.