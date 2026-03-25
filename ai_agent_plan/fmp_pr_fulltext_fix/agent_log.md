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