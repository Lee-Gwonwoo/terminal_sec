## 2026-04-18

**작성 시각:** 07:20 (local)

### 계획 초안 생성

- 생성 파일
  - `ai_agent_plan/news_hv_zscore/plan.md`
- 확인한 코드/문서 범위
  - `FinnhubNewsWindow.tsx`의 current `changes` 컬럼, column visibility, localStorage persistence, render cell, sort helper
  - `newsRepository.ts`의 `/api/news` metric join 구조
  - `types.ts`의 `NewsItem` field 범위
  - `db.ts`의 `news_change_metrics` schema
  - `newsChangeMerger.ts`의 standard metric 계산/UPSERT 구조
  - `terminal/backend_prompt.md`
  - 기존 sample plan `ai_agent_plan/daily_change_history_window/plan.md`
- 현재 결정
  - 이번 턴은 계획 문서만 작성하고 구현은 시작하지 않음
  - 기본 제안은 `news_change_metrics` 재사용, `HV`/`Z Score` quick toggle 버튼, 묶음 컬럼 2개 추가, lookback 20 sample
  - HV는 annualized 값이 아니라 z-score 분모로 직접 쓸 수 있는 비연율화 sigma로 정의
- 실행/검증 상태
  - 코드 수정: 없음
  - 서버 실행: 없음
  - 테스트/빌드: 없음
  - 문서 생성만 수행
- 상태
  - awaiting user confirmation

**작성 시각:** 07:31 (local)

### PLAN CHANGE 반영

- 사용자 결정 반영
  - 변동성 계산 lookback은 `60 completed samples`로 고정
- 문서 수정
  - `plan.md`의 lookback 기본값을 `20` → `60`으로 변경
  - `U1` 미확정 항목 제거
  - `묶음 컬럼 sort 기준` 설명을 본문에 추가
- 코드 변경
  - 없음
- 실행/검증 상태
  - 빌드/테스트/서버 실행 없음
  - plan/log 문서만 갱신
- 상태
  - awaiting user confirmation

**작성 시각:** 07:36 (local)

### 추가 사용자 결정 반영

- 사용자 결정 반영
  - 묶음 컬럼 sort 기준은 `Chg 기준`으로 고정
- 계획 판단 추가
  - `HV`/`Z Score` quick button은 source별(`Company News`, `FMP PR`, `FMP SEC`)로 분리하지 않음
  - source 구분은 기존 source filter / source별 update 버튼에서 처리하고, HV/Z Score는 전역 column toggle로 유지하는 방향으로 정리
- 문서 수정
  - `plan.md`에서 `U2` 미확정 항목 제거
  - `D9`, `D10` 결정 항목 갱신
  - source별 버튼 분리 비권장 이유 추가
- 코드 변경
  - 없음
- 실행/검증 상태
  - 빌드/테스트/서버 실행 없음
  - plan/log 문서만 갱신
- 상태
  - awaiting user confirmation

**작성 시각:** 07:44 (local)

### missing-only 계산 규칙 반영

- 사용자 결정 반영
  - HV/Z Score는 이미 값이 있는 row/metric을 다시 계산하지 않고, 값이 없는 항목만 계산해 반영하는 방향으로 고정
- 문서 수정
  - `plan.md` 목표 문구를 `missing-only fill` 기준으로 갱신
  - 경계 규칙과 결정표에 `값이 비어 있는 metric_key만 대상` 규칙 추가
  - Step 1 저장 경로 설명을 `skip existing` 기준으로 수정
  - Step 4를 recent/custom `missing-only HV/Z-score backfill` 기준으로 수정
  - `PLAN CHANGE` 섹션에 새 사용자 결정을 추가
- 코드 변경
  - 없음
- 실행/검증 상태
  - 빌드/테스트/서버 실행 없음
  - plan/log 문서만 갱신
- 상태
  - awaiting user confirmation

**작성 시각:** 08:07 (local)

### 구현 및 검증 진행

- 구현 파일
  - `terminal/backend/src/services/newsVolatilityMetrics.ts`
  - `terminal/backend/tests/newsVolatilityMetrics.test.ts`
  - `terminal/backend/src/services/newsChangeMerger.ts`
  - `terminal/backend/src/services/newsRepository.ts`
  - `terminal/backend/src/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/dataControlHowToUse.ts`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- 구현 내용
  - change metric과 동일한 정의의 historical series로 `HV` / `Z Score`를 계산하는 helper를 추가했다.
  - recent/new/custom change 흐름 뒤에 HV/Z Score missing-only fill 단계를 연결했다.
  - `/api/news`, `/api/news/:id` 응답에 HV/Z Score field를 추가했다.
  - Finnhub News window에 `HV`, `Z Score` 묶음 컬럼과 quick toggle 버튼을 추가했다.
  - `Model_1 Safe` 모드에서는 `changes`, `hv`, `zscore` 세 derived price reaction 컬럼을 함께 숨기도록 맞췄다.
  - Data Control / how-to / prompt 문서의 change update 설명을 `missing HV / Z Score fill` 기준으로 수정했다.
- 실행/검증 상태
  - `npm.cmd run build` in `terminal`: 통과
  - `npm.cmd run build` in `termina_web/figma_code/terminal_ui_ver2_finhub`: 통과
  - `npm.cmd run test` in `terminal`: `16 passed / 94 passed`
  - local API 확인: `GET http://localhost:8080/api/news?limit=1` 응답에서 `hv_change_pct`, `zscore_change_pct`, `hv_change_1d_pct`, `zscore_change_1d_pct` field 존재 확인
- 남은 확인
  - 실제 데이터에서 change update 실행 후 HV/Z Score가 missing row만 채워지는지 사용자가 화면 기준으로 확인 필요
- 상태
  - awaiting user confirmation