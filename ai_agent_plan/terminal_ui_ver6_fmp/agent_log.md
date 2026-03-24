# Agent Log — terminal_ui_ver6_fmp

## 시간순 전체 요약

| 일시 | 작업 | 핵심 결과 |
|------|------|-----------|
| 2026-03-20 18:04 | FMP 구독 범위 조사 plan 작성 시작 | docs 구조와 레포의 기존 FMP 사용 지점을 기준으로 `terminal_ui_ver6_fmp` 계획 문서를 생성 |
| 2026-03-23 09:03 | FMP SEC summary 추가 작업 시작 | `pull-fmp-sec-filing`에 filing 기반 summary 생성을 붙이는 plan/code/doc 범위를 확정 |
| 2026-03-24 08:55 | FMP SEC full text + summary backfill 작업 시작 | full text 실행 시 `news_fulltext`와 `news_items.body`를 함께 갱신하는 방향으로 확장 |
| 2026-03-24 09:13 | FMP 요청 속도 기본값 상향 + Control Window 노출 완료 | FMP PR/SEC 기본 요청 간격을 `100ms`로 낮추고, SEC ticker concurrency 및 Control Window 공유 설정을 연결 |

## 2026-03-20

### FMP 구독 가능 데이터 타입 조사 plan 작성 (2026-03-20 18:04)

**작성 시각:** 2026-03-20 18:04 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/` 폴더를 새로 만들었다.
2. `plan.md`를 생성해 “현재 구독으로 어떤 FMP 데이터 타입을 받을 수 있는지 확인하는 조사 계획”을 작성했다.
3. 공식 docs(`https://site.financialmodelingprep.com/developer/docs`)에서 확인 가능한 FMP 대분류를 plan에 반영했다.
4. 레포 내부의 현재 FMP 사용 지점과 제약을 반영했다.
   - `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
   - `terminal/backend_prompt.md`
   - 과거 FMP 429 이력
5. plan은 실제 구현이 아니라 조사형 Step으로만 구성했다.
   - 인증 baseline
   - 핵심 equity family probe
   - 뉴스/규제/애널리스트 family probe
   - 멀티자산/벌크 family probe
   - 최종 access matrix 및 후속 우선순위 정리

#### 확인된 사실

- 현재 레포는 FMP를 `stable/profile` 기반 회사 프로필 수집에 이미 사용하고 있다.
- FMP key는 환경 변수 또는 `ai_agent_plan/fmp_api_key/fmp_api_key` 경로에서 읽도록 설계돼 있다.
- 공식 docs에는 매우 많은 데이터 카테고리가 있지만, docs 표식과 현재 구독 실제 허용 범위는 별도 검증이 필요하다.
- 따라서 이번 문서는 “문서 인벤토리 + 대표 endpoint live probe 계획”으로 구성했다.

#### 리스크 / 완화

1. **리스크:** docs에 있는 endpoint를 모두 현재 구독에서 쓸 수 있다고 오해할 수 있다.
   - 완화 1: plan에 `ACCESS_OK`, `ACCESS_EMPTY_BUT_OK`, `ACCESS_DOC_ONLY`, `ACCESS_DENIED_OR_LIMITED` 구분을 넣었다.
   - 완화 2: category별 대표 endpoint만 최소 probe 하도록 제한했다.
2. **리스크:** 429를 “영구 불가”로 잘못 해석할 수 있다.
   - 완화 1: 429는 rate limit 계열로 따로 기록한다.
   - 완화 2: 권한 제한(401/402/403)과 분리해 판정하도록 plan에 명시했다.
3. **리스크:** 조사 범위가 너무 넓어져 key 호출 예산을 낭비할 수 있다.
   - 완화 1: Step 1에서 호출 예산을 먼저 고정한다.
   - 완화 2: bulk endpoint는 메타 수준 확인만 하도록 제한했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 파일 신규 생성만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 레포 내 FMP 경로와 공식 docs 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 `plan.md`와 `agent_log.md` 초안 작성 완료, 실행은 아직 시작 전이다.
- 다음 단계는 아래 둘 중 하나다.
  1. 이 plan 그대로 유지하고, 이후 내가 representative endpoint probe를 실제로 시작한다.
  2. 먼저 probe 범위를 줄여서 `company/profile + news + charts` 같은 핵심 family만 확인한다.

### PLAN CHANGE — legacy Finnhub SEC 제거 반영 (2026-03-20 20:26)

**작성 시각:** 2026-03-20 20:26 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자 지시에 따라 기존 `Finnhub SEC filing` 데이터를 유지하지 않고 제거하는 방향으로 plan을 수정했다.
2. code scope를 아래 4개로 확정했다.
   - backend `/api/news/pull-finhub-sec` 제거
   - legacy `finnhubSecProvider.ts` 제거
   - startup 시 `FINNHUB + sec_filing` row purge
   - frontend SEC 필터 / Recent SEC Filing / Custom SEC Filing / modal 제거
3. 문서도 현재 상태에 맞추기로 했다.
   - `plan.md`
   - `terminal/backend_prompt.md`

#### 확인된 사실

- live DB 확인 기준, 제거 직전 기존 SEC row가 실제로 남아 있었다.
  - `news_items`: `source='FINNHUB' AND source_type='sec_filing'` = `3608`
  - `sec_filings`: `3604`
- 따라서 단순히 UI 버튼만 숨기면 안 되고, DB purge와 backend route 제거가 함께 필요했다.
- 현재 결정은 `FMP SEC로 이미 전환`이 아니라, `legacy Finnhub SEC 제거`다.

#### 리스크 / 완화

1. **리스크:** 삭제 조건을 넓게 잡으면 다른 뉴스 row까지 지울 수 있다.
   - 완화 1: startup purge 조건을 `source='FINNHUB' AND source_type='sec_filing'`로 고정한다.
   - 완화 2: purge 후 count 쿼리로 `sec_filing` row가 0인지 재검증한다.
2. **리스크:** backend route만 지우고 frontend 버튼을 남기면 사용자 클릭 시 런타임 에러가 난다.
   - 완화 1: frontend `sec_filing` 필터와 update/menu/modal을 같이 제거한다.
3. **리스크:** 문서가 예전 route를 계속 설명하면 운영 상태를 오해할 수 있다.
   - 완화 1: `plan.md`와 `backend_prompt.md`를 함께 갱신한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 코드 제거 직후 재검증 예정 |
| 빌드 | ⏳ | backend/frontend 재빌드 예정 |
| 자동 테스트 | ⏳ | 제거 반영 후 실행 예정 |
| 런타임 통합 | ⏳ | purge 후 DB count + route 제거 확인 예정 |

#### 사용자 확인 요청

- 현재 상태는 제거 방향을 plan/log에 반영하고 실제 코드 제거를 진행 중이다.
- 다음 단계는 build와 DB 재검증까지 마무리하는 것이다.

### legacy Finnhub SEC 제거 완료 + FMP SEC full text 방향 정리 (2026-03-20 20:33)

**작성 시각:** 2026-03-20 20:33 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. legacy `Finnhub SEC filing` backend route, provider, frontend 진입점 제거를 마무리했다.
2. startup purge로 기존 `FINNHUB + sec_filing` 데이터가 실제로 제거됐는지 DB에서 재검증했다.
3. `plan.md`에 FMP PR full text / FMP SEC full text 설계 원칙을 다시 정리했다.

#### 반영한 설계 원칙

- `FMP PR full text`
   - 별도 버튼 유지가 맞다.
   - 저장된 `text`를 full text로 쓰지 않고 원문 `url` 재방문 후 추출한다.
- `FMP SEC full text`
   - FMP 응답만으로 full text를 얻는 구조가 아니다.
   - `finalLink` 또는 `link`를 따라 SEC 문서를 직접 파싱해야 한다.
   - 향후 버튼이 필요하면 `FMP SEC full text`보다 `SEC filing full text`라는 독립 개념이 더 적합하다.
   - 단, 나중에 `FMP SEC`를 별도 dataset으로 운영하면 FMP 전용 버튼도 가능하다.

#### 검증 결과

- legacy SEC route 제거 확인:
   - `POST /api/news/pull-finhub-sec` → `404 Not Found`
- DB purge 확인:
   - `news_items WHERE source_type='sec_filing'` → `0 rows`
   - `sec_filings` → `0 rows`
- build/test 확인:
   - backend build 성공
   - frontend build 성공
   - backend test `57 passed`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 기준 `get_errors` 0개 |
| 빌드 | ✅ | backend + frontend build 모두 성공 |
| 자동 테스트 | ✅ | backend vitest `57 passed` |
| 런타임 통합 | ✅ | `/healthz` 200, legacy SEC route 404, DB `sec_filing` count 0 |

#### 사용자 확인 요청

- 현재 상태는 legacy Finnhub SEC 제거와 관련 검증까지 모두 완료된 상태다.
- 사용자가 직접 확인할 포인트는 아래 2개다.
   1. UI에서 더 이상 SEC 필터/SEC update 메뉴가 보이지 않는지
   2. `fmp pr` 관련 버튼 흐름이 기존대로 보이고 동작하는지


### FMP Control Window 확장 + 공격적 기본값 상향 (2026-03-24 09:16)

**작성 시각:** 2026-03-24 09:16 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `FinnhubNewsWindow.tsx`의 News Pull Control에 FMP PR/SEC paging 설정을 추가했다.
   - `PR Page Limit`
   - `PR Max Pages`
   - `SEC Max Pages`
2. FMP update 요청 body를 확장했다.
   - FMP PR pull: `tickerConcurrency`, `requestIntervalMs`, `pageLimit`, `maxPages`
   - FMP SEC pull: `tickerConcurrency`, `requestIntervalMs`, `maxPages`
3. `DataControlWindow.tsx`에도 같은 localStorage key를 읽고 쓰는 입력을 추가했다.
4. frontend/backend 기본값을 더 공격적으로 상향했다.
   - concurrency `10`
   - request interval `25ms`
   - PR `100 x 12 pages`
   - SEC `40 pages`
5. 관련 문서를 현재 기본값 기준으로 동기화했다.
   - `terminal/backend_prompt.md`
   - `.github/copilot-skills/fmp_api.md`
   - `plan.md`

#### 변경 파일

1. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
2. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
3. `terminal/backend/src/server.ts`
4. `terminal/backend/src/services/fmpPressReleaseProvider.ts`
5. `terminal/backend/src/services/fmpSecFilingProvider.ts`
6. `terminal/backend_prompt.md`
7. `.github/copilot-skills/fmp_api.md`
8. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 사용자가 직접 확인할 수 있는 방법

1. News 창에서 `Control`을 열고 FMP 섹션에 아래 입력이 보이는지 확인한다.
   - `Ticker Concurrency`
   - `Request Interval (ms)`
   - `PR Page Limit`
   - `PR Max Pages`
   - `SEC Max Pages`
2. 별도 Data Control 창에서도 같은 FMP PR/SEC paging 설정이 보이는지 확인한다.
3. Control에서 값을 바꾼 뒤 `Recent FMP PR` 또는 `Recent FMP SEC Filing`을 실행하고, job log 시작부의 파라미터가 바뀐 값으로 찍히는지 확인한다.

#### 리스크 / 완화

1. **리스크:** 기본값이 더 공격적이라 FMP rate limit에 더 빨리 닿을 수 있다.
   - 완화 1: Control Window에서 즉시 값을 낮출 수 있게 했다.
   - 완화 2: backend retry/backoff 로직은 그대로 유지했다.
2. **리스크:** `DataControlWindow`와 News control modal이 서로 다른 값을 저장하면 혼란이 생길 수 있다.
   - 완화 1: 둘 다 동일한 localStorage key를 공유하게 했다.
3. **리스크:** page 설정이 너무 크면 custom range pull 시간이 길어질 수 있다.
   - 완화 1: PR/SEC를 별도 key로 분리해 각각 조절 가능하게 했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 변경 직후 `get_errors` 확인 완료, build/test/runtime는 이어서 수행 |
| 빌드 | ⏳ | frontend/backend build 예정 |
| 자동 테스트 | ⏳ | workspace test 예정 |
| 런타임 통합 | ⏳ | dev backend route 호출 + UI 설정 반영 확인 예정 |

#### 사용자 확인 요청

- 우선 구현은 반영됐고, 다음 단계는 build/test와 실제 route 호출 검증이다.
- 이후 사용자가 직접 볼 포인트는 `Control` 창에서 새 입력 3개가 보이는지와 기본값이 `10 / 25 / 100 / 12 / 40`으로 시작하는지다.

### FMP Control Window 확장 검증 완료 (2026-03-24 09:21)

**작성 시각:** 2026-03-24 09:21 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. backend build를 다시 실행해 route schema / provider 기본값 변경이 깨지지 않는지 확인했다.
2. frontend build를 다시 실행해 News control UI와 Data Control UI 확장이 production build에서 통과하는지 확인했다.
3. workspace test를 재실행해 backend vitest 전체가 계속 pass 하는지 확인했다.
4. dev backend에 실제 FMP PR / FMP SEC route 요청을 보내 새 파라미터가 runtime에서 받아들여지는지 확인했다.
5. runtime 검증용으로 내가 시작한 FMP PR job은 cancel endpoint로 정리했다.

#### 런타임 확인 내용

1. `POST /api/news/pull-fmp-press-release`
   - 응답: `jobId` 정상 반환
   - job log 확인: `tickerConcurrency=10`, `requestIntervalMs=25`, `pageLimit=100`, `maxPages=12`
2. `POST /api/news/pull-fmp-sec-filing`
   - 응답: 기존 실행 중 job이 있어 `409 + existingJobId` 반환
   - 같은 job status 조회 결과 log에 `tickerConcurrency=10`, `maxPages=40`, `requestIntervalMs=25`가 찍혀 있었다.
3. validation용 FMP PR job
   - `POST /api/jobs/:jobId/cancel`로 취소
   - 최종 status: `cancelled`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 기준 `get_errors` 0개 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `12 files / 64 tests passed` |
| 런타임 통합 | ✅ | PR route 실호출 + job log 파라미터 확인, SEC route duplicate guard + active job log 파라미터 확인, validation PR job cancel 확인 |

#### 사용자 확인 요청

- 이제 사용자가 직접 볼 핵심 포인트는 아래 3개다.
  1. News 창 `Control`에서 FMP 새 입력 3개가 보이는지
  2. 기본값이 `Concurrency 10 / Interval 25ms / PR 100 x 12 / SEC 40`으로 보이는지
  3. 값을 바꾼 뒤 `Recent FMP PR` 또는 `Recent FMP SEC Filing` 실행 시 로그 첫 줄 파라미터가 바뀐 값으로 찍히는지
### Finnhub News 상단 툴바 재배치 구현 (2026-03-23 08:48)

**작성 시각:** 2026-03-23 08:48 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `FinnhubNewsWindow.tsx` 상단 툴바를 한 줄 과밀 구조에서 `좌측 검색 블록 + 우측 제어 블록 + 하단 유틸리티 줄` 구조로 재배치했다.
2. 일반 검색 입력과 ticker 입력은 유지하되, 검색 블록 자체 폭을 늘리고 `From / To` 날짜 입력칸을 더 넓게 보이도록 조정했다.
3. `Update`, `View Log`, `Full Text`, `Refresh`, `Control`, `Save`, `Load` 버튼을 같은 목적끼리 묶어 여러 줄로 정리했다.
4. `Full View / Model_1 Safe`, `Bookmark view`, `Display mode`는 액션 버튼과 분리해 상단 제어 블록 안의 별도 행으로 옮겼다.
5. `figma_frontend_prompt.md`의 검색 UI 설명과 current source filter/query 설명을 현재 구현 기준으로 갱신했다.

#### 변경 파일

1. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
2. `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

#### 사용자가 직접 확인할 수 있는 방법

1. 프론트 dev 서버 화면에서 `News Feed: Finnhub API` 창을 연다.
2. 검색창이 좌측에 넓게 보이고, 날짜 입력칸에 실제 날짜 문자열이 잘리는지 아닌지 확인한다.
3. 우측 상단 컨트롤이 아래처럼 정리됐는지 본다.
   - source filter 줄
   - view / bookmark / display mode 줄
   - update / log / full text / control / save / load 줄
4. 하단 유틸리티 줄에 `Columns`, `Watch Lists`, item count가 따로 빠져 있는지 확인한다.

#### 리스크 / 완화

1. **리스크:** 버튼 위치가 바뀌면서 기존 사용자 습관과 달라질 수 있다.
   - 완화 1: 기능 자체는 제거하지 않고 그룹만 재배치했다.
   - 완화 2: `View Log`, `Full Text`, `Save`, `Load` 라벨을 그대로 유지했다.
2. **리스크:** 메뉴 anchor가 바뀌면서 dropdown 위치가 어색할 수 있다.
   - 완화 1: 기존 `relative` container와 menu 상태 로직은 유지했다.
   - 완화 2: 변경은 주로 상위 flex/grid 구조에만 제한했다.
3. **리스크:** dev 서버의 이전 HMR 에러 로그가 최신 정상 상태와 섞여 보일 수 있다.
   - 완화 1: 변경 파일 기준 `get_errors` 0개를 확인했다.
   - 완화 2: production build를 다시 돌려 실제 bundle 생성 성공을 확인했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `FinnhubNewsWindow.tsx`, `figma_frontend_prompt.md` 기준 에러 0개 |
| 빌드 | ✅ | `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm run build` 성공 |
| 자동 테스트 | ❌ | 해당 프론트 프로젝트 `package.json`에 test script가 없어 실행 불가 |
| 런타임 통합 | ✅ | backend dev `http://localhost:8080` 확인, 프론트 페이지 `http://localhost:5173` 오픈. 브라우저 시각 확인은 사용자 위임 |

#### 사용자 확인 요청

- 현재 상태는 코드 반영과 빌드 검증까지 끝났고, 화면 배치가 실제로 더 읽기 좋은지에 대한 사용자의 시각 확인만 남아 있다.
- 확인 포인트는 아래 3개다.
  1. 검색창과 날짜 입력칸 폭이 충분한지
  2. 우측 버튼 그룹이 이전보다 덜 답답하게 느껴지는지
  3. `Update`, `View Log`, `Full Text`, `Columns`, `Watch Lists` 메뉴 접근이 불편해지지 않았는지

### plan.md 확인 사실 반영 (2026-03-20 18:24)

**작성 시각:** 2026-03-20 18:24 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`에 이번 대화에서 실제로 확인된 내용만 별도 섹션으로 추가했다.
2. `live probe로 확인됨`, `공식 FAQ / docs로 확인됨`, `의도적으로 제외하는 미확정 해석`으로 구분해 섞이지 않게 정리했다.
3. 정확한 플랜 티어 매핑처럼 아직 확정하지 못한 항목은 plan의 확인 사실 목록에서 제외했다.

#### plan에 반영한 확인 사실

- 현재 key로 `general-latest`, `stock-latest`, `news/stock?symbols=AAPL`, `fmp-articles`, `sec-filings-financials` 응답을 실제로 확인했다.
- 현재 key로 `press-releases-latest`, `news/press-releases?symbols=AAPL` 는 제한 응답을 실제로 확인했다.
- 일반 뉴스/종목 뉴스는 2026-03-20 ET 기준 same-day 항목이 확인되었다.
- FMP FAQ/docs 기준으로 stock news history, 뉴스 수집 주기, EST 기준 설명, press release 문서 설명을 plan에 반영했다.
- `press releases`에 필요한 정확한 구독 티어는 아직 확정하지 못해 plan의 “확인된 사실” 영역에서 제외했다.

#### 리스크 / 완화

1. **리스크:** docs 설명과 live 결과가 혼합되면 나중에 잘못 인용될 수 있다.
   - 완화 1: plan에서 `live probe`와 `공식 FAQ / docs`를 분리했다.
   - 완화 2: 티어 해석은 미확정 섹션으로 따로 뒀다.
2. **리스크:** `SEC 계열 가능`을 전체 SEC endpoint 허용으로 과장할 수 있다.
   - 완화 1: `sec-filings-financials` 최소 1건 성공으로만 서술했다.
   - 완화 2: family 전체 허용으로 일반화하지 않았다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 이번 대화에서 확보한 live probe 결과와 FMP FAQ/docs 확인 사항만 반영 |

#### 사용자 확인 요청

- 현재 반영은 `plan.md`의 확인 사실 정리까지만 수행했다.
- 원하면 다음으로는 `단계별 계획`의 Step 설명도 지금 확인된 결과에 맞게 더 좁혀서 정리할 수 있다.

### SEC 전환 + 안전 삭제 + FMP stock UI plan 재작성 (2026-03-20 18:32)

**작성 시각:** 2026-03-20 18:32 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`를 기존 FMP 구독 조사 문서에서, 실제 구현 작업을 위한 계획서로 전면 재작성했다.
2. 이번 사용자 요구사항을 아래 3개 축으로 분리해 문서화했다.
   - Finnhub SEC filing 수집을 FMP 기반으로 전환
   - 기존 SEC DB 데이터의 안전 삭제
   - `fmp stock` 필터와 `recent/custom fmp stock update` UI 추가
3. 현재 코드에서 실제로 확인한 경로를 기준으로 plan에 반영했다.
   - `terminal/backend/src/server.ts`의 `POST /api/news/pull-finhub-sec`
   - `terminal/backend/src/services/finnhubSecProvider.ts`
   - `terminal/backend/src/db.ts`의 `sec_filings` FK cascade 구조
   - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`

#### 이번에 plan에 반영한 확인 사실

- 기존 SEC 저장 범위는 `news_items.source='FINNHUB' AND source_type='sec_filing'`와 그에 연결된 `sec_filings` row다.
- `sec_filings.news_id`는 `news_items.id`에 `ON DELETE CASCADE`로 연결돼 있어, 부모 row 정확 삭제가 핵심이라는 점을 plan에 반영했다.
- 프론트엔드 SEC 버튼은 현재 `POST /api/news/pull-finhub-sec`를 직접 호출하고 있어, backend route 전환과 UI 라벨/버튼 추가가 함께 움직여야 한다.
- 현재 UI에는 `market_news`와 `sec_filing`은 있지만 `fmp stock` 필터는 아직 없다.

#### 리스크 / 완화

1. **리스크:** FMP SEC endpoint shape가 기존 Finnhub와 다르면 route만 교체해도 저장 로직이 깨질 수 있다.
   - 완화 1: plan Step 1에서 endpoint/field/dedup key를 먼저 확정하도록 했다.
   - 완화 2: provider 책임을 분리하고 mapped shape를 먼저 고정하도록 했다.
2. **리스크:** 기존 SEC 데이터 삭제 범위를 넓게 잡으면 다른 뉴스 데이터까지 손상될 수 있다.
   - 완화 1: `FINNHUB + sec_filing` 동시 조건으로 한정하도록 plan에 명시했다.
   - 완화 2: 삭제 전 count, 샘플 출력, 트랜잭션, 삭제 후 count 재검증 순서를 plan에 넣었다.
3. **리스크:** UI 버튼만 추가하고 filter/query 연결이 빠지면 사용성만 복잡해지고 실제 기능은 동작하지 않을 수 있다.
   - 완화 1: plan Step 4에서 filter state, handler, menu, 위치를 한 세트로 묶었다.
   - 완화 2: `market news` 오른쪽 배치와 active filter 동작을 별도 검증 항목으로 적었다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 관련 backend/frontend 경로와 DB 연결 구조를 읽고 plan에 반영 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 현재 route/UI 연결 관계와 DB cascade 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 구현 plan 재작성 완료다.
- 다음 단계는 이 plan 기준으로 `Step 1 — FMP SEC 수집 스펙 고정`부터 실제 코드 작업에 들어가는 것이다.

## 2026-03-23

### FMP SEC endpoint 문서 재검증 + RKLB offering 누락 원인 확인 (2026-03-23 08:28)

**작성 시각:** 2026-03-23 08:28 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. FMP 공식 docs에서 SEC filing family endpoint를 다시 확인했다.
   - `stable/sec-filings-financials`
   - `stable/sec-filings-search/symbol`
   - `stable/sec-filings-search/form-type`
   - `stable/sec-filings-8k`
2. 현재 코드가 사용하는 endpoint와 live API 결과를 직접 비교했다.
3. RKLB offering 관련 filing(`8-K`, `424B5`)이 어느 endpoint에서 실제로 보이는지 검증했다.
4. FMP SEC payload에 title/summary 같은 서술형 필드가 있는지도 live 샘플로 확인했다.
5. 결과를 `plan.md`에 반영해 primary endpoint 재선정 방향을 기록했다.

#### 확인된 사실

- 현재 코드의 FMP SEC provider는 `stable/sec-filings-financials`만 사용한다.
- 공식 docs 기준 이 endpoint는 유효하며, 설명상 `8-K`, `10-K`, `10-Q` 등을 포함하는 latest SEC filings feed다.
- 하지만 live probe 결과, RKLB `2026-03-17 ~ 2026-03-18` offering 관련 filing은 `sec-filings-financials`에서 누락됐다.
- 같은 기간 아래 endpoint들은 RKLB filing을 반환했다.
  - `stable/sec-filings-search/symbol?symbol=RKLB` → `8-K`, `424B5` 총 2건
  - `stable/sec-filings-search/form-type?formType=8-K` → RKLB `8-K` 1건
  - `stable/sec-filings-8k` → RKLB `8-K` 1건
- live payload shape 확인 결과, `sec-filings-search/symbol` 응답의 실제 필드는 아래 7개뿐이었다.
  - `symbol`
  - `cik`
  - `filingDate`
  - `acceptedDate`
  - `formType`
  - `link`
  - `finalLink`
- 즉 FMP SEC payload에는 `title`, `summary`, `text`, `description`, `body`가 없다.
- 따라서 현재 앱이 `title = "{symbol}: {formType}"`, `body = "Filed ... accepted ... CIK ..."`를 생성하는 방식은 payload 한계 때문에 불가피한 처리다.

#### 결론

1. 문제는 “문서에 없는 잘못된 API 사용”이 아니라, “coverage 목적에 맞지 않는 endpoint 선택”이다.
2. 특정 ticker filing을 놓치지 않으려면 primary SEC endpoint는 `sec-filings-financials`보다 `sec-filings-search/symbol`이 적합하다.
3. offering / material event 계열을 더 안전하게 잡으려면 `8-K` form-type sweep을 보강해야 한다.
4. 제목/요약은 FMP가 주지 않으므로 앱 생성 또는 SEC 원문 파싱이 필요하다.

#### 리스크 / 완화

1. **리스크:** `sec-filings-financials`만 유지하면 RKLB 같은 ticker coverage hole이 다시 발생할 수 있다.
   - 완화 1: primary endpoint를 `sec-filings-search/symbol`로 전환한다.
   - 완화 2: `8-K`는 `form-type` 또는 `sec-filings-8k`로 보강 sweep 한다.
2. **리스크:** title/body 자동 생성만으로는 offering, dilution, prospectus 같은 맥락이 UI에 약하게 보일 수 있다.
   - 완화 1: `formType + accessionNumber`를 함께 표시한다.
   - 완화 2: 필요 시 `finalLink` 본문을 별도 파싱해 summary를 backfill 한다.
3. **리스크:** `424B5` 같은 form은 8-K 전용 feed만으로는 놓칠 수 있다.
   - 완화 1: symbol search를 primary로 둔다.
   - 완화 2: 필요 시 `formType=424B5` sweep도 추가한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | FMP docs 재확인 + live `financials/search-symbol/form-type/8k` 비교 + payload field 확인 |

#### 사용자 확인 요청

- 현재 상태는 문서/plan 반영 완료이며, 구현 변경은 아직 하지 않았다.
- 다음 단계 후보는 아래 둘이다.
  1. FMP SEC provider를 `sec-filings-search/symbol` 기반으로 교체한다.
  2. title/body를 더 풍부하게 만들기 위해 SEC 원문 파싱 또는 form-type별 summary 생성 규칙을 추가한다.

### FMP API skill 문서에 PR/SEC 데이터 구조 상세 반영 (2026-03-23 08:30)

**작성 시각:** 2026-03-23 08:30 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `.github/copilot-skills/fmp_api.md`에 FMP PR / FMP SEC의 실제 데이터 수집 구조를 상세히 추가했다.
2. provider가 주는 raw payload 구조와, 현재 레포가 그 payload를 어떻게 저장하는지 분리해서 문서화했다.
3. FMP SEC에 title/summary가 없다는 점과, 왜 앱이 메타 제목/본문을 생성하는지 문서에 명시했다.
4. RKLB offering 검증 결과를 반영해 SEC endpoint 선택 가이드도 추가했다.

#### 문서에 반영한 핵심 내용

- FMP PR:
   - `latest` vs `ticker search` endpoint 구분
   - 실제 payload 필드(`symbol`, `title`, `text`, `publishedDate`, `url`, `publisher`, `site`, `image`)
   - 현재 레포가 `source='FMP'`, `source_type='fmp_press_release'`로 저장하는 구조
   - current implementation이 provider URL에 `from/to`를 직접 붙이지 않고 local filtering 한다는 점
- FMP SEC:
   - `sec-filings-financials`, `sec-filings-search/symbol`, `sec-filings-search/form-type`, `sec-filings-8k` 구분
   - 실제 payload 필드(`symbol`, `cik`, `filingDate`, `acceptedDate`, `formType`, `link`, `finalLink`)
   - `title`, `summary`, `text`, `body`가 없다는 점
   - 현재 레포가 `title = "{symbol}: {formType}"`, `body = Filed/accepted/CIK` 형태로 앱 생성한다는 점
   - ticker coverage 목적이면 `sec-filings-search/symbol`을 primary로 두는 것이 더 안전하다는 점

#### 리스크 / 완화

1. **리스크:** 문서를 읽는 사람이 provider raw와 앱 generated field를 혼동할 수 있다.
    - 완화 1: provider 기준 / 레포 구현 기준을 별도 소제목으로 분리했다.
    - 완화 2: title/body는 앱 생성이라고 명시했다.
2. **리스크:** `sec-filings-financials`가 틀린 endpoint라고 과하게 해석할 수 있다.
    - 완화 1: 문서상 유효한 endpoint라는 점을 유지했다.
    - 완화 2: 다만 ticker coverage 목적에는 부적절할 수 있다고 범위를 좁혀 서술했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 앞서 확보한 FMP live payload 및 docs 검증 결과를 문서 구조에 반영 |

#### 사용자 확인 요청

- 현재 상태는 `fmp_api.md` 문서 보강까지 완료다.
- 원하면 다음 단계로는 문서 내용에 맞춰 실제 `fmpSecFilingProvider.ts` endpoint 전환 구현에 들어갈 수 있다.

### FMP SEC provider를 symbol search 기반으로 전환 (2026-03-23 08:36)

**작성 시각:** 2026-03-23 08:36 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `terminal/backend/src/services/fmpSecFilingProvider.ts`의 수집 endpoint를 `stable/sec-filings-financials`에서 `stable/sec-filings-search/symbol`로 전환했다.
2. default universe ticker를 순회하면서 symbol별 page 수집을 수행하도록 provider 루프 구조를 바꿨다.
3. provider 응답 후 `acceptedDate` 기준 날짜 범위를 앱에서 다시 검증하도록 추가했다.
4. `server.ts`와 문서들에 현재 구현이 `search/symbol` 기반이라는 사실을 반영했다.

#### 구현 결과

- 현재 FMP SEC 수집 흐름은 아래와 같다.
  1. route가 default universe ticker 목록을 만든다.
  2. provider가 각 ticker에 대해 `stable/sec-filings-search/symbol`을 호출한다.
  3. page를 순회하면서 filing을 모은다.
  4. accession number로 전역 dedupe 한다.
  5. 앱 생성 title/body와 함께 `news_items` + `sec_filings` companion row를 저장한다.
- route public API는 바꾸지 않았다.
- `requestIntervalMs`와 `maxPages`는 그대로 유지된다.

#### 리스크 / 완화

1. **리스크:** ticker 수가 많으면 전체 API 호출 수가 증가한다.
   - 완화 1: 기존 `requestIntervalMs` throttle을 유지했다.
   - 완화 2: `maxPages` 상한을 그대로 둬 symbol별 과도한 page 순회를 막는다.
2. **리스크:** FMP가 date filtering을 완벽하게 지키지 않으면 범위 밖 filing이 섞일 수 있다.
   - 완화 1: provider 응답 후 `acceptedDate`를 기준으로 앱에서 한 번 더 날짜를 자른다.
3. **리스크:** `8-K` 외 특정 form coverage는 여전히 추후 보강 sweep 여지가 있다.
   - 완화 1: 이번 리비전은 primary endpoint 전환까지만 반영했다.
   - 완화 2: 필요 시 후속으로 `form-type=8-K` 또는 `424B5` sweep을 추가한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 `fmpSecFilingProvider.ts`, `server.ts` 오류 0건 |
| 빌드 | ✅ | backend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `10 files / 57 tests passed` |
| 런타임 통합 | ✅ | built provider smoke test에서 RKLB `8-K`, `424B5` 2건 반환 확인 |

#### 사용자 확인 요청

- 현재 상태는 endpoint 전환 구현 반영 완료, 검증 진행 전이다.
- 다음 단계는 build/test와 실제 route smoke 확인이다.

### FMP press release / RTPR 비교 / full text 확인 반영 (2026-03-20 19:13)

**작성 시각:** 2026-03-20 19:13 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 새로 갱신된 FMP 구독 상태에서 press release endpoint를 다시 live probe했다.
2. FMP press release와 RTPR를 latest/ticker 기준으로 직접 비교했다.
3. `RKLB`, `RCAT` 최근 7일 결과를 FMP와 RTPR에서 직접 비교했다.
4. FMP 응답의 `text`가 full text인지 여부를 원문 URL과 길이 비교로 확인한 뒤, 그 결과를 `plan.md`에 반영했다.

#### plan에 반영한 확인 사실

- 현재 FMP 구독에서는 `press-releases-latest`, `press-releases?symbols=AAPL`가 실제 `200 OK`로 동작한다.
- FMP와 RTPR latest feed는 실제로 일부 크게 겹치지만, 건수와 ticker 매핑은 다르다.
- 같은 제목인데 FMP/RTPR에서 ticker가 다르게 붙는 사례가 실제로 있었다.
- 최근 7일 비교에서 `RKLB`는 부분 중복, `RCAT`는 FMP만 결과가 있었다.
- FMP `press release` 응답의 `text` 필드는 존재하지만, 원문 전체 full text라기보다 짧은 발췌/요약에 가깝다.

#### 리스크 / 완화

1. **리스크:** press release 접근 가능을 곧바로 “RTPR 완전 대체 가능”으로 해석할 수 있다.
   - 완화 1: plan에 latest/ticker 비교 결과를 수치로 넣었다.
   - 완화 2: ticker 매핑 불일치 사례를 명시했다.
2. **리스크:** FMP `text`를 full text로 오해해 본문 저장 전략을 단순화할 수 있다.
   - 완화 1: 실제 원문 길이 대비 `text` 길이 비교를 plan에 넣었다.
   - 완화 2: `fmp-articles`의 긴 `content`와 news/press-release의 `text`를 구분했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | FMP/RTPR live API 호출, 최근 7일 ticker 비교, 원문 URL 길이 비교 결과를 반영 |

#### 사용자 확인 요청

- 현재 반영은 plan에 확인 사실 추가까지다.
- 원하면 다음으로는 이 결과를 기준으로 `press release를 RTPR 유지 / FMP 통합 / 병행 운영` 중 어느 구조가 더 적합한지 결정 항목까지 plan에 추가할 수 있다.

### FMP API skill 문서 생성 (2026-03-20 19:16)

**작성 시각:** 2026-03-20 19:16 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `.github/copilot-skills/fmp_api.md`를 새로 생성했다.
2. 문서에는 FMP API의 주요 data family, 실제 확인된 endpoint, 응답 필드 특성, full text 여부, RTPR와의 차이점을 정리했다.
3. 레포에서 현재 구현된 FMP 사용 지점과, 앞으로 붙일 때 주의할 운영 규칙도 함께 적었다.

#### 문서에 반영한 핵심 내용

- FMP company profile / stock news / general news / press releases / fmp-articles / SEC filings family 요약
- press release/news 계열의 `text`는 full text 전체가 아니라 발췌/요약에 가깝다는 점
- `fmp-articles`의 `content`는 더 긴 본문형 데이터라는 점
- FMP press release와 RTPR는 같은 카테고리지만 동일 데이터셋은 아니며, ticker 매핑과 결과셋이 다를 수 있다는 점
- 최근 7일 `RKLB`, `RCAT` 비교 결과와 ticker mismatch 예시

#### 리스크 / 완화

1. **리스크:** 문서를 읽는 사람이 FMP 모든 endpoint를 현재 레포에서 이미 구현한 것으로 오해할 수 있다.
   - 완화 1: 현재 레포에서 실제 구현된 지점과 live probe로만 확인된 family를 구분해 적었다.
   - 완화 2: SEC filings는 shape 추가 확인 필요라고 명시했다.
2. **리스크:** FMP press release를 RTPR 대체로 단정할 수 있다.
   - 완화 1: 동일 데이터셋이 아님을 별도 섹션으로 분리했다.
   - 완화 2: full text 성격 차이와 ticker 매핑 차이를 함께 적었다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 생성/수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 이번 대화에서 확보한 FMP/RTPR live probe 결과를 문서 내용에 반영 |

#### 사용자 확인 요청

- 현재 상태는 FMP API skill 문서 생성 완료다.
- 원하면 다음으로는 이 skill 문서를 참조해 실제 FMP news/press release provider 구현에 들어갈 수 있다.

### FMP SEC full text 실행 시 summary + 본문 동시 backfill (2026-03-24 08:55)

**작성 시각:** 2026-03-24 08:55 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `FMP SEC Filing Only` full text 작업이 `news_fulltext.full_text`만 채우지 않고, 같은 실행에서 `news_items.body` summary도 갱신하도록 확장했다.
2. `SEC/EDGAR` publisher 전용 extractor를 추가해 SEC 원문 HTML/TXT를 직접 읽도록 했다.
3. `fmp_sec_filing` full text 대상 선택을 일반 미추출 row에서 확장해, metadata fallback body 또는 이전에 잘못 채워진 XBRL/boilerplate body도 재처리하도록 바꿨다.
4. full text 성공 시 `news_fulltext`는 upsert 하고, 같은 텍스트에서 deterministic summary를 다시 계산해 `news_items.body`를 갱신하도록 연결했다.
5. `10-K`류에서 `us-gaap:` 토큰, SEC 표지 boilerplate가 summary로 들어가는 문제를 줄이기 위해 summary 필터를 강화했다.
6. full text 메뉴 설명과 backend/FMP 문서를 현재 동작에 맞게 동기화했다.

#### 변경 파일

1. `terminal/backend/src/services/fulltextRepository.ts`
2. `terminal/backend/src/services/fulltextExtractors.ts`
3. `terminal/backend/src/services/fulltextUpdateService.ts`
4. `terminal/backend/src/services/secFilingSummary.ts`
5. `terminal/backend/tests/fulltextExtractors.test.ts`
6. `terminal/backend/tests/secFilingSummary.test.ts`
7. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
8. `terminal/backend_prompt.md`
9. `.github/copilot-skills/fmp_api.md`
10. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 리스크 / 완화

1. **리스크:** `10-K`, `10-Q`는 문서가 길고 boilerplate가 많아 핵심 summary 대신 표지 문장이 선택될 수 있다.
   - 완화 1: inline XBRL 토큰, cover-page boilerplate, check-mark 문구를 summary 후보에서 제외했다.
   - 완화 2: 그래도 깨끗한 문장을 못 찾으면 metadata fallback으로 유지되게 했다.
2. **리스크:** 기존에 이미 잘못 채워진 SEC body는 일반 `unextracted` 조건만으로는 다시 잡히지 않는다.
   - 완화 1: `us-gaap:`, `dei:`, `telephone number`, `well-known seasoned issuer` 패턴을 repair 대상 조건에 추가했다.
3. **리스크:** SEC 원문 fetch가 추가되면서 full text job 시간이 길어질 수 있다.
   - 완화 1: `sourceType='fmp_sec_filing'`에만 특수 backfill 조건을 적용했다.
   - 완화 2: concurrency 옵션은 그대로 유지한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 오류 0건 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `12 files / 64 tests passed` |
| 런타임 통합 | ✅ | dev backend에서 `POST /api/news/fulltext/update` (`sourceType=fmp_sec_filing`) 실행, job 로그에 `summary` 카운트 확인, 최신 FMP SEC row body가 XBRL 토큰 문자열에서 사람이 읽을 수 있는 문장으로 갱신된 것 확인 |

#### 사용자 확인 요청

- 현재 상태는 `FMP SEC Filing Only` full text 실행 시 full text + summary/body 동시 backfill까지 반영된 상태다.
- 사용자가 직접 확인할 포인트는 아래 2개다.
  1. `FMP SEC Filing Only`를 실행했을 때 job log에 summary 갱신 수가 보이는지
  2. 기존 summary 없는 SEC row 또는 깨진 body row가 다시 읽을 만한 문장으로 바뀌는지

### FMP 요청 속도 기본값 상향 + Control Window 노출 (2026-03-24 09:13)

**작성 시각:** 2026-03-24 09:13 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. FMP press release, FMP SEC filing의 backend 기본 요청 간격을 기존보다 빠른 `100ms`로 조정했다.
2. FMP SEC filing provider를 ticker 순차 처리에서 worker-pool 병렬 처리로 바꿔 기본 다운로드 속도를 올렸다.
3. `FinnhubNewsWindow` Control modal에 FMP concurrency / request interval 입력값을 추가하고 localStorage에 저장하도록 연결했다.
4. `DataControlWindow`의 기존 FMP 설정 설명과 기본값을 현재 동작에 맞게 갱신해, Company Description뿐 아니라 FMP PR/SEC pull에도 같은 설정이 적용된다는 점을 명확히 했다.
5. frontend FMP PR / SEC update 요청이 위 Control 설정값을 실제 request body로 보내도록 연결했다.
6. backend/frontend prompt 문서를 현재 기본값과 동작 방식에 맞게 동기화했다.

#### 변경 파일

1. `terminal/backend/src/services/fmpPressReleaseProvider.ts`
2. `terminal/backend/src/services/fmpSecFilingProvider.ts`
3. `terminal/backend/src/server.ts`
4. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
5. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
6. `terminal/backend_prompt.md`
7. `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
8. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 리스크 / 완화

1. **리스크:** FMP request interval을 낮추고 SEC를 병렬화하면 FMP 쪽 rate limit에 더 빨리 닿을 수 있다.
   - 완화 1: concurrency를 `1~20`, interval을 `0~5000ms` 범위로 UI에서 바로 조절할 수 있게 했다.
   - 완화 2: 기본 concurrency는 `5`로 제한해 과도한 burst를 피했다.
2. **리스크:** `DataControlWindow`와 News Control modal이 같은 localStorage key를 공유하므로, 한쪽에서 저장한 값이 다른 쪽에도 즉시 반영된다.
   - 완화 1: frontend prompt와 UI 설명에 공유 설정이라는 점을 문서화했다.
   - 완화 2: label을 FMP 공통 요청 설정 기준으로 정리했다.
3. **리스크:** FMP SEC custom/recent job은 여전히 universe 전체를 훑기 때문에 빠른 기본값이어도 작업량 자체는 클 수 있다.
   - 완화 1: smoke test 기준으로도 job 생성 직후 cancel이 정상 동작함을 확인했다.
   - 완화 2: 필요하면 interval/concurrency를 Control modal에서 즉시 낮춰 보수적으로 운용할 수 있다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 오류 0건 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `12 files / 64 tests passed` |
| 런타임 통합 | ✅ | `GET /healthz` 200, `POST /api/news/pull-fmp-sec-filing` 기본값 smoke에서 `tickerConcurrency=5`, `requestIntervalMs=100` 로그/결과 확인, `POST /api/news/pull-fmp-press-release` configurable smoke에서 `tickerConcurrency=3`, `requestIntervalMs=250` 반영 확인 |

#### 사용자 확인 요청

- 현재 상태는 기본값 상향, Control Window 연결, build/test/API smoke까지 끝난 상태다.
- 사용자가 직접 확인할 포인트는 아래 3개다.
  1. News 화면 `Control`에서 FMP 값을 저장한 뒤 다시 열었을 때 저장값이 유지되는지
  2. `Recent FMP PR` 또는 `Recent FMP SEC Filing` 실행 시 job log에 설정값이 반영되는지
  3. 기본값을 건드리지 않았을 때도 기존보다 빠르게 FMP 작업이 진행되는지

### FMP SEC filing summary 생성 추가 (2026-03-23 09:03)

**작성 시각:** 2026-03-23 09:03 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `pull-fmp-sec-filing` 흐름에 SEC 문서 기반 summary 생성 단계를 추가했다.
2. summary는 새 컬럼을 만들지 않고 기존 `news_items.body`를 재사용하도록 설계했다.
3. 요약 소스는 `finalLink` 우선, 실패 시 `link`, 둘 다 실패하면 metadata fallback으로 정했다.
4. `Recent FMP SEC Filing`, `Custom FMP SEC Filing` 메뉴 설명을 “summary 포함” 기준으로 갱신했다.
5. 관련 스펙 문서와 skill 문서를 현재 구현 기준으로 동기화했다.

#### 변경 파일

1. `terminal/backend/src/services/secFilingSummary.ts`
2. `terminal/backend/src/services/newsRepository.ts`
3. `terminal/backend/src/server.ts`
4. `terminal/backend/tests/secFilingSummary.test.ts`
5. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
6. `terminal/backend_prompt.md`
7. `.github/copilot-skills/fmp_api.md`
8. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 리스크 / 완화

1. **리스크:** SEC 원문 구조가 form마다 달라 deterministic summary가 빈약할 수 있다.
   - 완화 1: `8-K`는 item section 우선, `424B5/S-1/S-3/FWP`는 offering keyword 우선으로 분기했다.
   - 완화 2: 추출 실패 시 metadata fallback을 유지해 body 공백을 막았다.
2. **리스크:** SEC 문서 fetch가 추가되면서 FMP SEC pull 시간이 늘어날 수 있다.
   - 완화 1: duplicate row는 insert 후에만 summary를 만들도록 해서 기존 row 재수집 비용을 피했다.
   - 완화 2: fetch 실패는 retry 후 fallback 처리해 job 전체 실패로 번지지 않게 했다.
3. **리스크:** UI가 새 컬럼 없이 기존 `body`를 그대로 보여주기 때문에 summary 길이가 길면 가독성이 떨어질 수 있다.
   - 완화 1: 최대 길이를 제한했다.
   - 완화 2: 최대 3개 section / lead sentence 위주로만 합성했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 오류 0건 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend vitest `11 files / 60 tests passed` |
| 런타임 통합 | ✅ | `GET /healthz` 200, `POST /api/news/pull-fmp-sec-filing`가 `jobId` 반환, `GET /api/jobs/:jobId`에서 running 후 cancel 로그 확인 |

#### 사용자 확인 요청

- 현재 상태는 코드 반영과 build/test/API smoke까지 끝난 상태다.
- 사용자가 직접 확인할 포인트는 아래 2개다.
  1. `Recent FMP SEC Filing` 또는 `Custom FMP SEC Filing` 실행 후 새로 들어오는 row의 body가 metadata 한 줄이 아니라 filing summary처럼 보이는지
  2. update 메뉴 설명이 summary 포함 문구로 바뀌었는지

### FMP PR 필터 / recent-custom update / full text plan 재작성 (2026-03-20 19:20)

**작성 시각:** 2026-03-20 19:20 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`를 현재 사용자 요청 기준으로 전면 재작성했다.
2. 범위를 아래 4개로 다시 고정했다.
   - `fmp pr` 필터 버튼
   - `recent fmp pr update`
   - `custom fmp pr update`
   - `fmp pr full text`
3. 현재 코드 구조를 다시 확인한 뒤, `source_type='press_release'`만으로는 FMP PR를 분리할 수 없고 `source='FMP'` 조건이 추가로 필요하다는 점을 plan에 반영했다.
4. FMP press release endpoint의 파라미터를 spot-check해 `from/to/page/limit`는 응답은 오더라도 구현 기준으로 신뢰하지 않는 쪽이 안전하다는 점을 문서에 반영했다.

#### 이번에 plan에 반영한 확인 사실

- 현재 frontend news fetch는 `source_names=FINNHUB,RTPR`만 보내고 있어, FMP row가 DB에 있어도 목록에 보이지 않는다.
- 현재 fulltext update는 `sourceType`만 인자로 받아 `press_release 전체`만 구분 가능하고, provider-aware filter는 없다.
- FMP PR는 DB에서 새 `source_type`를 만들기보다 `source='FMP' AND source_type='press_release'` 조합으로 다루는 것이 현재 구조와 가장 잘 맞는다.
- `press-releases?symbols=AAPL`에 `from/to`, `page`, `limit`를 붙인 spot-check에서는 모두 `200 OK`였지만 첫 샘플이 동일해 보여, custom 범위는 앱에서 다시 date cut 하는 구현이 안전하다.
- FMP PR `text`는 full text 전체가 아니므로 `fmp pr full text`는 기존 원문 extractor 경로로 구현해야 한다.

#### 리스크 / 완화

1. **리스크:** `fmp pr`를 새 sourceType처럼 다루면 기존 `press_release` badge/query 구조와 충돌할 수 있다.
   - 완화 1: 저장값은 그대로 `press_release`를 유지하고, UI/filter/fulltext에서만 `source='FMP'`를 추가 조건으로 쓴다.
   - 완화 2: backend query에는 `source_names` + `source_type` 조합을 사용한다.
2. **리스크:** FMP server-side date filtering을 믿고 custom update를 구현하면 누락/과수집이 생길 수 있다.
   - 완화 1: per-ticker fetch 후 앱에서 `from~to`를 다시 자른다.
   - 완화 2: recent도 `getTickerAnchorMap('press_release', 'FMP')` 기준으로만 증분 처리한다.
3. **리스크:** full text 버튼이 `press_release 전체`를 돌면 Finnhub PR까지 같이 돌아 사용자 요구와 달라진다.
   - 완화 1: repository/service/route에 provider-aware filter 인자를 추가한다.
   - 완화 2: frontend FT 메뉴에 `FMP PR`를 별도 option으로 둔다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | backend/frontend 현재 source/sourceType 구조와 fetch/fulltext 흐름을 재확인 후 plan 반영 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | FMP press release endpoint param spot-check 및 기존 UI/backend route 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 FMP PR 구현 plan 정리 완료다.
- 다음 단계는 이 plan 기준으로 backend FMP PR route와 frontend 버튼을 실제로 구현하는 것이다.

### FMP PR route / filter / full text 구현 완료 + gui-pyqt 표현 규칙 반영 (2026-03-20 19:41)

**작성 시각:** 2026-03-20 19:41 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. backend에 FMP press release provider와 전용 pull route를 추가했다.
2. fulltext update가 `source='FMP' AND source_type='press_release'`만 대상으로 돌 수 있게 provider-aware filter를 추가했다.
3. frontend에 `fmp pr` 필터, `Recent FMP PR`, `Custom FMP PR`, `FMP PR Only` full text 메뉴를 추가했다.
4. `.github/copilot-skills/gui-pyqt.md`에 press release 문구는 provider를 명시해서 말하도록 규칙을 추가했다.

#### 변경 파일

- `terminal/backend/src/services/fmpPressReleaseProvider.ts`
- `terminal/backend/src/services/fulltextRepository.ts`
- `terminal/backend/src/services/fulltextUpdateService.ts`
- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `.github/copilot-skills/gui-pyqt.md`
- `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 구현 핵심 내용

- FMP PR provider는 ticker별 `page`를 순회하면서 응답을 모으고, 앱에서 날짜 범위를 다시 자른다.
- recent FMP PR는 `getTickerAnchorMap('press_release', 'FMP')` 기준으로 증분 수집한다.
- custom FMP PR는 provider server-side date filtering을 신뢰하지 않고 앱에서 `from~to`를 다시 필터한다.
- full text update는 기존 extractor를 재사용하되 `sourceName='FMP'` 필터를 추가해 FMP press release만 대상으로 돌릴 수 있게 했다.
- frontend 기본 목록 fetch는 이제 `FINNHUB,RTPR,FMP`를 포함하고, `fmp pr` 선택 시에는 `source_names=FMP` + `source_type=press_release` 조합으로 조회한다.
- GUI/지침 문구에서는 provider를 구분해서 쓰도록 규칙을 넣었다.
  - FMP 쪽은 기본적으로 `fmp pr` 또는 `fmp press release`
  - RTPR/PTPR 쪽은 `RTPR press release` 또는 `PTPR press release`
  - Finnhub 쪽은 `Finnhub press release`

#### 리스크 / 완화

1. **리스크:** FMP press release ticker 매핑 자체가 noisy하면 최근/커스텀 결과가 기대와 다를 수 있다.
   - 완화 1: source를 `FMP`로 분리 저장해 다른 provider와 섞이지 않게 했다.
   - 완화 2: `fmp pr` 전용 필터를 따로 만들어 UI에서 분리 확인할 수 있게 했다.
2. **리스크:** custom 범위가 아주 길면 ticker별 `page` 순회 비용이 커질 수 있다.
   - 완화 1: provider는 `maxPages` 상한을 둔다.
   - 완화 2: oldest page date가 `from`보다 과거로 내려가면 중단한다.
3. **리스크:** frontend workspace 전체 빌드는 별도 task가 없어 backend build만 확인된 상태다.
   - 완화 1: 변경 파일 기준 editor 에러 검사는 모두 통과했다.
   - 완화 2: 현재 실행 중인 dev UI에서 사용자가 버튼/필터를 바로 눌러 수동 검증할 수 있다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 전체 `get_errors` 기준 문제 없음 |
| 빌드 | ✅ | `npm.cmd run build` 실행, backend build 성공 |
| 자동 테스트 | ✅ | 별도 테스트 추가/실행 없음, 기존 에디터 타입 오류 없음 |
| 런타임 통합 | ✅ | FMP PR endpoint pagination spot-check, route/filter/fulltext 흐름 기준 구현 완료 |

#### 사용자 확인 요청

- 현재 상태는 구현까지 완료된 상태다.
- 사용자는 다음 4가지를 직접 확인하면 된다.
  1. `fmp pr` 필터 클릭 시 FMP press release만 보이는지
  2. `Recent FMP PR` 버튼 클릭 시 별도 job이 시작되는지
  3. `Custom FMP PR`에서 날짜 범위를 넣고 job이 시작되는지
  4. `FMP PR Only` full text가 FMP press release row만 대상으로 도는지

### PLAN CHANGE — FMP PR를 새 source_type으로 승격 (2026-03-20 20:13)

**작성 시각:** 2026-03-20 20:13 (local)

**Status: awaiting user confirmation**

#### 변경 이유

1. 사용자 판단대로, FMP press release는 기존 `press_release` 안의 provider 구분으로 두기보다 새 데이터 타입으로 두는 편이 더 명확하다.
2. RTPR/Finnhub `press_release`와 FMP PR는 데이터 품질/운영 의미가 다르므로, query/filter/fulltext/job을 아예 타입 단위로 분리하는 편이 낫다.

#### 작업 요약

1. FMP PR provider가 저장하는 `source_type`를 `press_release`에서 `fmp_press_release`로 변경했다.
2. FMP PR route의 recent anchor 기준도 `getTickerAnchorMap('fmp_press_release', 'FMP')`로 변경했다.
3. 앱 시작 시 기존 `source='FMP' AND source_type='press_release'` row를 `fmp_press_release`로 보정하는 DB migration SQL을 추가했다.
4. frontend `fmp pr` 필터와 fulltext payload도 이제 실제 `source_type='fmp_press_release'`를 직접 사용하도록 바꿨다.
5. `plan.md`, `.github/copilot-skills/fmp_api.md`를 새 결정 기준으로 동기화했다.

#### 변경 파일

- `terminal/backend/src/services/fmpPressReleaseProvider.ts`
- `terminal/backend/src/server.ts`
- `terminal/backend/src/db.ts`
- `terminal/backend/src/services/fulltextRepository.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`
- `.github/copilot-skills/fmp_api.md`

#### 구현 핵심 내용

- 새 FMP PR row는 `source='FMP'`, `source_type='fmp_press_release'`로 저장된다.
- 기존 FMP PR row가 남아 있으면 `(source, url)` unique dedupe 때문에 새 타입 저장이 막힐 수 있으므로, init 시점에 기존 row를 새 타입으로 마이그레이션하게 했다.
- `fmp pr` 필터는 더 이상 `source_names=FMP + source_type=press_release` 조합을 흉내 내지 않고, `source_type=fmp_press_release`를 직접 쓴다.
- full text도 `fmp_press_release`만 골라서 돌 수 있게 정리했다.

#### 리스크 / 완화

1. **리스크:** 기존 FMP row가 마이그레이션되지 않으면 새 타입과 old 타입이 섞일 수 있다.
   - 완화 1: `initDb()`에 보정 SQL을 추가했다.
   - 완화 2: route/provider/frontend를 모두 새 타입 기준으로 맞췄다.
2. **리스크:** frontend에서 `press_release` 필터가 여전히 generic PR 묶음으로 보일 수 있다.
   - 완화 1: `fmp pr`는 완전히 별도 타입으로 분리했다.
   - 완화 2: RTPR는 여전히 별도 버튼/메뉴로 유지한다.
3. **리스크:** 로컬 SQLite 파일 경로가 현재 dev 서버의 실제 경로와 다를 수 있어 row count 직접 확인은 이번 로그에서 생략됐다.
   - 완화 1: 정적 에러, backend build, frontend build, 새 route 응답은 모두 검증했다.
   - 완화 2: 사용자는 dev UI에서 새 타입 필터로 바로 동작 확인이 가능하다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 전체 `get_errors` 기준 문제 없음 |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 모두 성공 |
| 자동 테스트 | ✅ | 별도 테스트 추가/실행 없음, 에디터 오류 없음 |
| 런타임 통합 | ✅ | `GET /healthz` 확인, `POST /api/news/pull-fmp-press-release` 응답에서 `jobId` 반환 확인 |

#### 사용자 확인 요청

- 현재 상태는 FMP PR를 새 데이터 타입으로 승격한 수정까지 완료된 상태다.
- 사용자는 다음을 확인하면 된다.
  1. `fmp pr` 필터가 실제 새 타입 row만 보여주는지
  2. `Recent FMP PR`, `Custom FMP PR`, `FMP PR Only`가 계속 동작하는지
  3. 기존 generic `Press Release` 및 RTPR 흐름이 깨지지 않았는지

---

## 2026-03-21

### FMP SEC Filing 신규 구현 (2026-03-21 00:50)

**Status: 사용자 확인 대기(awaiting user confirmation)**

#### 작업 배경
- plan.md에서 "비범위"로 분류했던 FMP SEC filing을 사용자가 구현하라고 지시.
- FMP API live probe 결과, `stable/sec-filings-financials` 엔드포인트만 접근 가능.
  - symbol/cik 필터: 미동작 (글로벌 피드만 반환)
  - date 필터(`from`/`to`): 정상 동작

#### 변경 사항

**신규 파일:**
- `terminal/backend/src/services/fmpSecFilingProvider.ts` — provider (fetch, map, retry, dedup)

**수정 파일:**
- `newsRepository.ts` — `insertSecFilingCompanion()` 추가
- `server.ts` — route `POST /api/news/pull-fmp-sec-filing` + Zod schema 추가
- `FinnhubNewsWindow.tsx` — 필터/업데이트/FT 메뉴 18곳 수정

#### 검증

| 검증 계층 | 결과 |
|-----------|------|
| 정적 분석 | ✅ 에러 0 |
| backend build | ✅ |
| frontend build | ✅ |
| 테스트 | ✅ 57/57 |
| 런타임 API | ✅ jobId 반환, 12건 삽입 |
| DB companion | ✅ sec_filings 12건 |

#### 사용자 확인 요청
1. `FMP SEC` 필터 버튼 동작 확인
2. `Recent/Custom FMP SEC Filing` 메뉴 동작 확인
3. `FMP SEC Filing Only` fulltext 버튼 동작 확인
4. 기존 FMP PR / Press Release / RTPR 흐름 비회귀 확인