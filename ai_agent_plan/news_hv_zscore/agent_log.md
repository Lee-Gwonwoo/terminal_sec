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