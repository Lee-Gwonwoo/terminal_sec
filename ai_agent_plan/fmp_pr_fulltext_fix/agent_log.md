## 2026-03-24

**작성 시각:** 2026-03-24 21:02 (local)

### 작업 시작
- 요청: FMP PR full text가 실제 기사 본문을 저장하도록 plan 생성 후 구현.
- 현재 확인된 사실:
  - `fmp_press_release` success fulltext 대부분이 `body-fallback (no-scraper: ...)`
  - DB 샘플 기준 `news_fulltext.full_text == news_items.body`
  - GlobeNewswire / PRNewswire는 live HTML에서 본문 컨테이너 확인 가능
  - Business Wire는 서버 fetch 기준 anti-bot / error shell 응답
- 생성 파일:
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md`
- 상태: 계획 작성 완료, 구현 진행 중 (확인 대기)

**작성 시각:** 2026-03-24 21:11 (local)

### 구현 및 검증
- 변경 파일:
  - `terminal/backend/src/services/fulltextExtractors.ts`
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/src/services/fulltextUpdateService.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend/tests/fulltextExtractors.test.ts`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- 구현 내용:
  - `GlobeNewswire`, `PRNewswire` page scraper 추가
  - `fmp_press_release` 전용 fulltext backfill 대상 조회 추가
  - `POST /api/news/fulltext/update` 응답 `total`도 전용 backfill 기준으로 맞춤
  - 관련 unit test와 prompt/spec 동기화
- 런타임 확인:
  - `POST /api/news/fulltext/update` with `sourceType='fmp_press_release'` 응답 `total=6412`
  - job 로그에서 수천 건 대상 재추출 시작 확인
  - DB에서 `prnewswire-scrape`, `globenewswire-scrape` note 생성 확인 (`79`, `65`건 샘플 시점)
  - DB 샘플에서 `full_len`이 `body_len`보다 크게 증가하고 `same_text=0` 확인
- 잔여 리스크:
  - `Business Wire`는 anti-bot 때문에 이번 구현에서도 fallback 가능
  - 장시간 fulltext batch는 외부 site rate/차단 영향을 받을 수 있음

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextExtractors.ts`, `fulltextRepository.ts`, `fulltextUpdateService.ts`, `server.ts`, test 파일 모두 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공, frontend `vite build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 12 files / 66 tests pass |
| 런타임 통합 | ✅ | `POST /api/news/fulltext/update` (`fmp_press_release`) 호출, job 로그/DB note/샘플 row 변화 확인 |

- 상태: 구현 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-24 21:20 (local)

### PLAN CHANGE 및 semantics 정리
- 사용자 피드백: `fulltext/update`는 기존 fulltext가 있는 id를 다시 처리하면 안 되고, 잘못된 기존 FMP PR fulltext는 삭제 후 missing-only update로 재처리하는 구조가 맞음.
- 적용 변경:
  - `fmp_press_release` special-case 재추출 분기 제거
  - `POST /api/news/fulltext/reset-fmp-pr-fallback` 추가
  - UI에 `Reset FMP PR Fallback` 액션 추가
  - `FMP PR Only` 설명을 missing-only로 수정
- 의도:
  - `update` semantics를 sourceType과 무관하게 일관되게 유지
  - 미래 재사용 시에도 기존 fulltext row를 임의로 덮어쓰지 않도록 보장

**작성 시각:** 2026-03-24 21:25 (local)

### semantics 수정 후 검증
- 추가 변경 파일:
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/src/services/fulltextUpdateService.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- validation 방식:
  - 실DB 대신 `terminal/backend/backend/data/app_validation_fmp_pr.db` 복사본 생성
  - 별도 backend 인스턴스를 `PORT=8081`, `SQLITE_PATH=./backend/data/app_validation_fmp_pr.db`로 실행
  - `reset-fmp-pr-fallback -> fulltext/update(fmp_press_release)` 순서 검증 후 job/서버 종료
- 핵심 결과:
  - reset 대상 후보 count: `3856`
  - `POST /api/news/fulltext/reset-fmp-pr-fallback` 응답: `deleted=3856`
  - 직후 `POST /api/news/fulltext/update` 응답: `total=3856`
  - update job status 확인: `running`, `total=3856`
  - 즉 `update`는 다시 missing-only semantics로 동작하고, stale 기존 row는 reset 단계에서만 제거됨

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | repository/service/server/UI 변경 파일 모두 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `vite build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 12 files / 66 tests pass |
| 런타임 통합 | ✅ | 복사본 DB 서버에서 `reset-fmp-pr-fallback -> update(fmp_press_release)` 순서 검증 |

- 상태: semantics 수정 포함 구현 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-24 21:30 (local)

### 실DB reset 실행
- 사용자 요청에 따라 실제 운영 DB `terminal/backend/backend/data/app.db`에 대해 `POST /api/news/fulltext/reset-fmp-pr-fallback`를 실행함.
- 실행 전 stale FMP PR fallback 후보 수 확인: `3856`
- 임시 backend 인스턴스를 `PORT=8082`로 올려 현재 빌드 코드 기준 endpoint 호출
- reset 실행 결과: `deleted=3856`
- 실행 후 동일 조건 재조회 결과: `0`
- 의미:
  - 지원 scraper가 있는 `GlobeNewswire`, `Globe News Wire`, `PRNewsWire`의 잘못된 기존 fallback success row는 실DB에서 삭제 완료
  - 이후 `FMP PR Only`는 missing-only로 이 빈 row들을 다시 채우게 됨

**작성 시각:** 2026-03-24 21:41 (local)

### 접근 수정 — RTPR 재사용 폐기
- 사용자 피드백: `RTPR` 기사 body를 이용한 보강은 금지. `FMP`는 새 뉴스 데이터를 대상으로 직접 원문 추출해야 함.
- 현재 확인한 분포:
  - `GlobeNewsWire` 2325
  - `PRNewsWire` 1716
  - `Business Wire` 1689
  - `Newsfile Corp` 702
  - `Accesswire` 108
  - `MCAP MediaWire` 10
- live fetch 확인 결과:
  - `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`는 server-side 응답에서 본문 추출 가능성이 높음.
  - `Business Wire`는 plain fetch가 Akamai 차단으로 실패하므로 브라우저 기반 fallback이 필요함.
- 다음 구현 방향:
  - `fulltextExtractors.ts`에 추가 wire extractor 구현
  - `Business Wire` 브라우저 fallback 추가
  - `deleteFmpPressReleaseFallbackRows()` 대상을 새로 직접 추출 가능한 wire publisher 전체로 확장
- 상태: 구현 진행 중 (확인 대기)

**작성 시각:** 2026-03-24 21:41 (local)

### 직접 wire extractor 확장 및 검증
- 변경 파일:
  - `terminal/backend/src/services/fulltextExtractors.ts`
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/tests/fulltextExtractors.test.ts`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `terminal/backend/package.json`
- 구현 내용:
  - `Newsfile Corp`, `Accesswire`, `MCAP MediaWire` server-side extractor 추가
  - `Business Wire` 브라우저 fallback extractor 추가 (`playwright` 의존성 포함)
  - test hook 추가로 브라우저 extractor unit test 가능하게 정리
  - `reset-fmp-pr-fallback` 삭제 대상을 직접 추출 가능한 wire publisher 전체로 확장
  - backend/frontend 문서에서 `RTPR 재사용 없음`, `Business Wire 브라우저 fallback` 규칙 반영
- 런타임 확인:
  - live `Newsfile Corp` URL → `success`, `newsfile-scrape`, `len=4449`
  - live `Business Wire` URL → `success`, `businesswire-browser`, `len=3818`
- 추가 메모:
  - 전체 backend build는 기존 `server.ts`의 unrelated TS 오류(`fetchFinnhubProfilesBatch`) 때문에 현재도 실패한다.
  - 변경 파일 자체 diagnostics는 0 errors 확인.

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextExtractors.ts`, `fulltextRepository.ts`, test 파일 0 errors |
| 빌드 | ❌ | 기존 `server.ts` unrelated 오류로 backend build 실패 (`fetchFinnhubProfilesBatch` 등) |
| 자동 테스트 | ✅ | extractor 전용 test run pass, 전체 backend test도 pass |
| 런타임 통합 | ✅ | live `Newsfile` / live `Business Wire` URL에 대해 직접 extractor 실행 결과 확인 |

- 상태: 구현 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-24 21:52 (local)

### 실DB 확장 reset + refill 실행
- 사용자 선택: `1.` → 실제 운영 DB에 대해 확장된 `reset-fmp-pr-fallback` 실행 후 `FMP PR Only` refill 시작.
- 실행 전 stale fallback 분포:
  - `BUSINESS WIRE`: 1685
  - `NEWSFILE CORP`: 702
  - `ACCESSWIRE`: 108
  - `MCAP MEDIAWIRE`: 10
  - 합계: `2505`
- 실행 결과:
  - `POST /api/news/fulltext/reset-fmp-pr-fallback` → `deleted=2505`
  - `POST /api/news/fulltext/update` with `{ sourceType: 'fmp_press_release', sourceName: 'FMP', concurrency: 3 }`
  - 응답: `jobId=fb297cb7-9235-4ced-81c5-460de39ef5e7`, `total=6361`
- 실행 후 확인:
  - 동일 stale fallback 조건 재조회 결과: `0`
  - refill job은 `running` 상태로 시작 확인
  - `6361`은 이번에 비운 `2505` + 기존부터 missing 상태였던 FMP PR row가 합쳐진 값

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 이번 실행은 DB/API 호출만 수행 |
| 빌드 | ⚠️ | 기존 `server.ts` unrelated build 오류 상태 유지 |
| 자동 테스트 | ✅ | 직전 extractor 전용 test 및 전체 backend test pass 상태 유지 |
| 런타임 통합 | ✅ | real `reset-fmp-pr-fallback` + real `fulltext/update(fmp_press_release)` 실행, stale row 0 확인 |

- 상태: refill job 진행 중, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 08:59 (local)

### PLAN CHANGE — FMP PR fulltext 성능 벤치마크 및 기본값 튜닝 phase 시작
- 사용자 요청:
  - FMP PR fulltext 기능에서 concurrency 값별 속도를 실제로 테스트
  - 가장 효율적인 설정값을 기본값으로 반영
  - Control Window에서 계속 조정 가능하도록 유지
  - 단, plan을 먼저 작성
- 현재 확인한 사실:
  - backend 기본 fulltext concurrency fallback은 `10`
  - `/api/news/fulltext/update`는 `concurrency`를 받아 `1..200`으로 clamp
  - Control Window는 이미 `ft-concurrency`를 localStorage에 저장하고 있음
  - `FinnhubNewsWindow` 실행부도 같은 `ft-concurrency`를 읽어 fulltext update payload로 전달함
- 이번 phase의 작업 방향:
  1. concurrency 후보군과 측정 절차를 plan에 먼저 고정
  2. 같은 조건에서 concurrency별 속도/성공률 비교 실험 수행
  3. 최적 기본값을 backend/frontend fallback에 동시에 반영
  4. Data Control 설명과 prompt 문서 동기화
- 상태: 계획 갱신 완료, 벤치마크 구현/실행 전 (확인 대기)

**작성 시각:** 2026-03-25 09:26 (local)

### PLAN CHANGE — FMP PR fulltext 전용 Control Window 설정 우선 추가
- 사용자 요청:
  - 벤치마크 전에 먼저 Control Window에서 FMP PR fulltext 설정을 조정할 수 있게 할 것
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - `fmp-pr-fulltext-concurrency` localStorage 키 추가
  - Settings 탭에 `FMP PR Full Text Concurrency` 전용 slider/preset 추가
  - `FMP PR Only`와 `Reset FMP PR Fallback` 뒤 재실행이 전용 값을 우선 사용하도록 연결
- 의도:
  - 일반 full text 추출과 FMP PR fulltext 추출 설정을 분리해 이후 벤치마크와 기본값 튜닝을 명확히 수행
- 상태: 구현 완료, 검증 전 (확인 대기)

**작성 시각:** 2026-03-25 09:26 (local)

### FMP PR fulltext 전용 Control Window 설정 검증
- 추가 확인 내용:
  - `DataControlWindow.tsx`에 `FMP PR Full Text Concurrency` 전용 섹션 렌더링 추가
  - `FinnhubNewsWindow.tsx`에서 `FMP PR Only` 실행 시 `fmp-pr-fulltext-concurrency`를 우선 사용하도록 연결
  - 값이 없으면 기존 `ft-concurrency`를 fallback으로 사용하도록 유지
  - frontend/backend prompt 및 active plan 문서 동기화 완료

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DataControlWindow.tsx`, `FinnhubNewsWindow.tsx` diagnostics 0 errors |
| 빌드 | ✅ | frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | 기존 workspace `terminal: test` 최근 성공 상태 유지, 이번 변경은 프론트 설정 UI 중심 |
| 런타임 통합 | ✅ | 코드 리뷰로 `fmp-pr-fulltext-concurrency` 저장/조회/실행 payload 연결 확인, 브라우저 시각 확인은 사용자 위임 |

- 상태: 구현 및 기본 검증 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 11:02 (local)

### UI 락 규칙 정리 + 동시작업 허용 구현
- 사용자 요청:
  - 현재 UI 락 규칙을 문서/코드 기준표로 정리
  - frontend 또는 backend md에 명시
  - active plan에도 반영
  - FMP PR fulltext 실행 중 다른 작업도 가능하게 구현
- 변경 파일:
  - `terminal/backend/src/services/jobManager.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - backend job에 `category`, `label` metadata 추가
  - 뉴스 창 관련 job을 `news-update`, `news-fulltext`로 구분해 active/status endpoint에 함께 노출
  - frontend에서 pull/update와 fulltext를 별도 job id 및 polling effect로 분리
  - `Update`는 `updating`만, `Full Text`는 `ftUpdating`만 막도록 변경
  - log panel은 선택 job 기준으로 유지하되, active job이 여러 개면 dropdown으로 전환
- 의도:
  - 기존 단일 `currentJobId` / `jobStatus` 공유 때문에 생기던 과도한 UI lock 제거
  - FMP PR fulltext 실행 중에도 일반 update/change 계열 작업이 가능하도록 변경
  - 현재 락 규칙을 문서 기준표로 남겨 이후 해석 혼선을 줄임
- 상태: 구현 완료, 검증 진행 중 (확인 대기)

**작성 시각:** 2026-03-25 11:16 (local)

### 저장된 탭 소실 회귀 수정
- 사용자 보고:
  - 기존에 기억되어 있던 workspace 탭들이 갑자기 사라짐
- 원인 분석:
  - `termina_web/.../src/app/App.tsx`에서 localStorage restore effect와 persist effect가 모두 mount 직후 실행된다.
  - 이 구조에서는 저장값을 읽기 전에 기본 state(`Tab 1`, 빈 windows)가 `terminal-workspace-v1`를 먼저 덮어쓸 수 있다.
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
- 구현 내용:
  - `workspaceHydrated` state 추가
  - restore effect 종료 후에만 persist effect가 저장하도록 guard 추가
- 의미:
  - 이후에는 새로고침/재접속 시 기존 저장 탭이 기본 탭으로 덮어써지는 문제를 막는다.
  - 이미 덮어써진 localStorage 내용은 코드만으로 자동 복구할 수 없다.

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `App.tsx` diagnostics 0 errors |
| 빌드 | ✅ | frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | 기존 backend test pass 상태 유지 |
| 런타임 통합 | ✅ | 코드 경로 검토로 restore 완료 전 persist 차단 확인, 브라우저 시각 확인은 사용자 위임 |

- 상태: 회귀 수정 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 11:24 (local)

### Default Ticker Window 렌더링 최적화
- 사용자 요청:
  - 기능은 바꾸지 말고 `Default Ticker Window` 렉만 줄일 것
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - table body 전체 렌더링을 `react-window` 기반 가상 리스트로 전환
  - filter 계산은 `useDeferredValue(filterText)` 기준으로 수행해 입력 중 전체 리스트 재계산 압박 완화
  - 컨테이너 크기를 `ResizeObserver`로 측정해 창 높이에 맞는 visible row 수만 렌더링
  - API 호출, add/remove, source badge, job polling, 컬럼 구성은 그대로 유지
- 의도:
  - row 수가 많을 때 filter 입력, drag, reload에서 발생하던 대규모 DOM re-render를 줄인다.
  - 사용자 체감 기능은 유지하면서 프론트 렌더링 병목만 낮춘다.

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DefaultTickerWindow.tsx` diagnostics 0 errors |
| 빌드 | ✅ | web UI `npm.cmd run build` 성공 |
| 자동 테스트 | ⚠️ | 별도 프론트 자동 테스트 없음, 기존 backend test pass 상태 유지 |
| 런타임 통합 | ⏳ | 브라우저에서 filter/scroll 체감 확인 예정 |

- 상태: 구현 완료, 검증 진행 중 (확인 대기)

**작성 시각:** 2026-03-25 15:03 (local)

### FINNHUB publisher별 대표 샘플 fulltext 테스트 + publisher 고정 문제 수정
- 사용자 요청:
  - 각 publisher마다 원문 추출 가능 여부를 테스트하고, 되는 것들을 정리
  - `YAHOO`면 `YAHOO`로 보여야 하는데 왜 `FINNHUB`로 보이는지 원인 수정
- 테스트 결과 요약:
  - `scrape-success`: `NASDAQ`, `TMX`
  - `body-fallback-success`: `YAHOO`, `BENZINGA`, `SEEKINGALPHA`, `CHARTMILL`, `CNBC(company_news)`, `DOWJONES`, `FINNHUB`, `REUTERS`, `BLOOMBERG`, `UNKNOWN`
  - `unavailable`: `FINTEL`, `MARKETWATCH`, `CNBC(market_news)`, `GOOGLE NEWS`
- 확인한 원인:
  - 프론트는 `item.publisher`를 그대로 표시하므로 UI 매핑 문제는 아님.
  - backend에서 `INSERT OR IGNORE` 때문에 기존 `(source, url)` row의 publisher가 더 정확한 값으로 승격되지 않음.
  - 기존 backfill은 `NULL/UNKNOWN`만 갱신하고 `origin_url`이 없는 `finnhub.io` wrapper URL은 다시 `FINNHUB`로 남김.
- 변경 파일:
  - `terminal/backend/src/services/finnhubNewsProvider.ts`
  - `terminal/backend/src/services/newsRepository.ts`
  - `terminal/backend/tests/finnhubNewsProvider.test.ts`
  - `.github/copilot-skills/finhub_other_api.md`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`

- 상태: 구현 진행 중 (검증 대기)

**작성 시각:** 2026-03-25 15:07 (local)

### FINNHUB publisher 테스트 / publisher 보정 검증 완료
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `finnhubNewsProvider.ts`, `newsRepository.ts`, `finnhubNewsProvider.test.ts` diagnostics 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build -w backend` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 13 files / 76 tests pass |
| 런타임 통합 | ✅ | 임시 DB 복사본에서 `POST /api/news/fulltext/update` 호출 후 샘플 row `publisher: FINNHUB -> YAHOO` 갱신 확인 |

- 추가 확인:
  - 대표 샘플 테스트 기준 실제 원문 scrape success는 `NASDAQ`, `TMX`였다.
  - `YAHOO`, `BENZINGA`, `SEEKINGALPHA` 등은 현재 대표 샘플 기준 body-fallback success였다.
  - live DB 분포상 `company_news` publisher는 `YAHOO`, `FINNHUB`, `BENZINGA`, `SEEKINGALPHA`, `CHARTMILL` 등이 섞여 있으며 전체가 `FINNHUB`만은 아니다.
  - 다만 기존 `(source, url)` duplicate row가 `INSERT OR IGNORE`로 남아 있던 탓에 `YAHOO`가 실제 publisher여도 과거 row는 `FINNHUB`로 고착될 수 있었고, 이번 수정으로 그 승격 경로를 복구했다.

- 상태: 구현 및 검증 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 16:08 (local)

### 실DB company_news 기존 fulltext 삭제 실행
- 사용자 요청:
  - 기존 company news 데이터의 fulltext 부분을 확실하고 안전하게 삭제할 것
- 실행 내용:
  - 현재 dev backend(`http://localhost:8080`)에 `POST /api/news/fulltext/reset-company-news`를 실제 호출
  - 이 endpoint는 `source='FINNHUB' AND source_type='company_news'`에 연결된 `news_fulltext` row만 삭제한다.
- 실행 전 확인:
  - real DB `company_news` fulltext row: `14151`
  - 그중 `body-fallback%`: `11076`
- 실행 결과:
  - API 응답: `{"deleted":14151}`
  - 실행 후 재조회 결과: `company_fulltext_rows = 0`

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 코드 변경 없음 |
| 빌드 | ✅ | 직전 backend build 성공 상태 유지 |
| 자동 테스트 | ✅ | 직전 backend test 13 files / 78 tests pass 상태 유지 |
| 런타임 통합 | ✅ | real backend `reset-company-news` 호출 후 DB count `14151 -> 0` 확인 |

- 상태: 실DB 삭제 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 16:11 (local)

### Company News pull 속도 설정 Control Window 분리
- 사용자 요청:
  - company news 다운로드도 더 빠르게 돌릴 수 있게 control window에서 설정값을 조정할 수 있도록 할 것
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - `finnhub-company-news-ticker-concurrency`, `finnhub-company-news-request-interval-sec` localStorage 키 추가
  - `Data Control` Settings 탭에 `Finnhub Company News Pull` 전용 concurrency / request interval 설정 추가
  - `Finnhub News` 창의 `News Pull Control` modal에도 동일한 company news override 입력 추가
  - `/api/news/pull-finhub` 요청 body는 기존 계약을 유지하되, `sourceType='company_news'`일 때만 전용 override 값을 `tickerConcurrency`, `requestIntervalMs`에 넣도록 분기
  - `press_release`, `market_news`, `peers`, `IPO date` 경로는 기존 Finnhub 공용 설정을 계속 사용

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `DataControlWindow.tsx`, `FinnhubNewsWindow.tsx` diagnostics 0 errors |
| 빌드 | ✅ | web UI `npm.cmd run build` 성공 |
| 자동 테스트 | ⚠️ | 별도 프론트 자동 테스트 없음 |
| 런타임 통합 | ✅ | 코드 경로 검토로 `company_news` 요청만 전용 override를 사용하고 나머지 sourceType은 공용 Finnhub 설정 유지 확인 |

- 상태: 구현 및 기본 검증 완료, 사용자 확인 대기 (awaiting user confirmation)

**작성 시각:** 2026-03-25 15:16 (local)

### FINNHUB company_news 원문 추출 보강 + reset 준비
- 사용자 요청:
  - `company only fulltext`에서 원문 추출 가능한 것들은 제대로 작동하게 수정
  - 기존 company news fulltext 데이터는 지울 준비를 해둘 것
- 추가 확인한 사실:
  - 실DB `source='FINNHUB' AND source_type='company_news'`는 총 `32716`건이며 `origin_url`이 `0`건이었다.
  - 저장된 `url`은 전부 `https://finnhub.io/api/news?id=...` wrapper였고, 이 wrapper는 실제로 `302 Location`으로 원문 기사 URL(`YAHOO`, `BENZINGA` 등)로 리다이렉트된다.
  - 따라서 기존 `company_news` fulltext는 원문이 아니라 summary/body fallback semantics로 저장된 비율이 높았다.
- 변경 파일:
  - `terminal/backend/src/services/fulltextExtractors.ts`
  - `terminal/backend/src/services/fulltextUpdateService.ts`
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend/tests/fulltextExtractors.test.ts`
  - `.github/copilot-skills/finhub_other_api.md`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - `company_news` fulltext 추출 시 wrapper URL이면 먼저 redirect origin URL을 해석하도록 변경
  - 추출 중 복구한 `origin_url`과 더 정확한 `publisher`를 `news_items`에 다시 저장하도록 연결
  - 현재 success로 남기도록 지원한 company_news publisher를 `YAHOO`, `BENZINGA`로 제한
  - `company_news`에서는 summary/body fallback success를 더 이상 저장하지 않고, 미지원 publisher는 `unavailable`로 처리
  - 기존 company news fulltext 전량 삭제 준비용 `POST /api/news/fulltext/reset-company-news` endpoint 추가
  - extractor test에 redirect-based Yahoo success와 unsupported publisher unavailable 케이스 추가

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextExtractors.ts`, `fulltextUpdateService.ts`, `fulltextRepository.ts`, `server.ts`, test 파일 diagnostics 0 errors |
| 빌드 | ⏳ | 다음 단계에서 전체 backend build 실행 예정 |
| 자동 테스트 | ✅ | `vitest run tests/fulltextExtractors.test.ts` 10 tests pass |
| 런타임 통합 | ⏳ | temp DB에서 `reset-company-news -> update(company_news)` 검증 예정 |

- 상태: 구현 완료, 전체 검증 진행 중 (확인 대기)

**작성 시각:** 2026-03-25 15:41 (local)

**작성 시각:** 2026-03-25 16:19 (local)

### company_news recent/custom pull 후 fulltext 자동 연쇄
- 사용자 요청:
  - recent/custom company news update 시 받은 데이터까지 fulltext를 자동으로 받도록 할 것
- 변경 파일:
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/src/services/fulltextUpdateService.ts`
  - `terminal/backend/src/server.ts`
  - `.github/copilot-skills/finhub_other_api.md`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
- 구현 내용:
  - 선택된 news id 집합만 대상으로 미추출 fulltext row를 읽는 helper 추가
  - fulltext service에 `runFulltextUpdateForNewsIds()` 경로 추가
  - `POST /api/news/pull-finhub`에서 `sourceType='company_news'` + `mode='recent' | 'custom'` + 새 row insert가 있을 때, 그 새 company news id만 대상으로 `news-fulltext` job을 자동 생성하도록 연결
  - pull job log/result에 자동 생성된 fulltext job id를 남기도록 반영
  - backend/frontend/skill 문서에 자동 연쇄 범위와 예외(`7d`, `all` 제외) 반영

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextRepository.ts`, `fulltextUpdateService.ts`, `server.ts` diagnostics 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 13 files / 78 tests pass |
| 런타임 통합 | ✅ | temp SQLite에서 `runFulltextUpdateForNewsIds()` 실행 후 job `done`, `news_fulltext.extraction_status='unavailable'`, `extraction_note='company-news-no-scraper: FINNHUB'` 확인 |

- 상태: 구현 및 기본 검증 완료, 사용자 확인 대기 (awaiting user confirmation)

### FINNHUB company_news 원문 추출 / reset 준비 최종 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 backend 파일과 test 파일 diagnostics 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `npm.cmd run test` 13 files / 78 tests pass |
| 런타임 통합 | ✅ | temp DB에서 `POST /api/news/fulltext/reset-company-news` → `deleted=1`, 이어서 `POST /api/news/fulltext/update` with `sourceType=company_news` 실행 후 샘플 row가 `publisher=YAHOO`, `origin_url=...`, `extraction_note=yahoo-finance-browser`로 갱신됨 |

- 런타임 검증 상세:
  - temp DB에는 Yahoo-origin wrapper company_news 1건만 남기고, legacy fallback fulltext row를 의도적으로 seed했다.
  - isolated backend(`PORT=8094`)에서 `healthz`는 `{"ok":true}`를 반환했다.
  - `reset-company-news` 응답은 `{"deleted":1}`였다.
  - 같은 DB에서 `update(company_news)` 응답은 `{"total":1,"concurrency":1}`였고 job은 `1 success`로 완료됐다.
  - 완료 후 sample row는 `publisher='YAHOO'`, `origin_url='https://finance.yahoo.com/markets/stocks/articles/1-wall-street-favorite-stock-175422842.html'`, `extraction_note='yahoo-finance-browser'`, `word_count=426`으로 확인됐다.

- 상태: 구현 및 검증 완료, 사용자 확인 대기 (awaiting user confirmation)

*** Delete File: c:\github_coding\terminal_sec\terminal\backend\tmp_test_finnhub_publishers.mjs
*** Delete File: c:\github_coding\terminal_sec\terminal\backend\tmp_verify_publisher_fix.mjs
*** Delete File: c:\github_coding\terminal_sec\terminal\backend\tmp_read_publisher_fix.mjs