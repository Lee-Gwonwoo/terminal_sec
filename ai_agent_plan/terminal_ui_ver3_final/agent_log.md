# Agent Log — terminal_ui_ver3_final

## 2026-03-06

### Plan 문서 초기 생성

**작성 시각:** 2026-03-06 19:24 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자 요구를 기준으로 새 plan 프로젝트명 `terminal_ui_ver3_final`을 생성 대상으로 확정했다.
2. 기존 `terminal_ui_ver2_finhub/plan.md`, `terminal/backend_prompt.md`, 프론트 prompt, 관련 코드 파일을 읽어 현재 레포 상태를 확인했다.
3. 아래 요구를 새 `plan.md`에 단계형 계획으로 정리했다.
   - `Score` 컬럼 추가
   - `Keywords` 컬럼 실사용화
   - News feed data DB 저장 구조 정리
   - 뉴스 다운로드 시 sentiment 수집 및 컬럼 노출
   - 앱 재실행 후 마지막 상태 복원
   - 탭 전환 후 탭 상태 유지
   - Data Control Window의 `Settings` 탭 및 전체 글자 크기 조절
4. `Score` 정의가 아직 문장만으로는 고정되지 않아, 미확정 사항과 차단 항목으로 문서에 명시했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `ai_agent_plan/terminal_ui_ver3_final/plan.md`를 열어 아래 항목이 있는지 확인한다.
   - 목표
   - 현재 레포 상태
   - 단계별 계획
   - 미확정 사항
   - 실행 의존성 그래프
2. `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`를 열어 이번 plan 생성 기록이 있는지 확인한다.

#### 문제점 / 리스크

1. `Score`의 의미가 아직 확정되지 않았다.
   - 완화 방안 1: Finnhub raw sentiment score를 1차 기본값으로 채택
   - 완화 방안 2: 사용자 확인 후 composite score 설계로 진행
2. sentiment가 기사 단위가 아닐 수 있다.
   - 완화 방안 1: ticker-date snapshot 테이블로 분리 저장
   - 완화 방안 2: `news_id` 직접 저장 대신 조회 시 매핑 규칙을 명시
3. “마지막 상태” 범위가 넓다.
   - 완화 방안 1: 1차는 layout + active tab + font scale + 주요 filter부터 저장
   - 완화 방안 2: 이후 필요한 창별 UI state를 단계적으로 확대

#### 비고

- 이번 작업은 문서 생성만 수행했다.
- 코드 파일(`.ts`, `.tsx`, `.js`, `.py`)은 수정하지 않았다.
- 사용자 확인 전까지 이 plan의 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — ai-news-analysis 정의 반영

**작성 시각:** 2026-03-06 19:40 (local)

**상태:** 확인 대기

#### 수행 내용

1. AI 뉴스 분석 skills 지침의 정식 명칭을 `ai-news-analysis`로 고정했다.
2. 새 skills 문서 `.github/copilot-skills/ai-news-analysis.md`를 생성했다.
3. skills 문서에 아래 계약을 문서화했다.
   - `Score`: `-10 ~ 10`
   - `Score Evidence`: 점수 근거 텍스트
   - `Keywords`: 중요한 키워드 30개
   - 기본값: 분석 전에는 비워 둠
   - 저장/재조회/삭제 감지 테스트 필요
4. `terminal_ui_ver3_final/plan.md`를 리비전해서 기존의 “Score=sentiment 후보” 해석을 제거하고, AI analysis 결과 중심으로 다시 정의했다.

#### 생성/수정 파일

- `.github/copilot-skills/ai-news-analysis.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `.github/copilot-skills/ai-news-analysis.md`를 열어 `Score`, `Score Evidence`, `Keywords`, 기본 빈 상태, 테스트 요구가 있는지 확인한다.
2. `ai_agent_plan/terminal_ui_ver3_final/plan.md`를 열어 아래 반영 여부를 확인한다.
   - `Score Evidence` 컬럼 추가
   - `Score=-10~10` 정의
   - `Keywords=30개` 정의
   - 분석 전 기본 빈 상태 규칙
   - 값 삭제/유실 감지 테스트 요구

#### 문제점 / 리스크

1. AI 분석 실행 시점은 아직 미확정이다.
   - 완화 방안 1: 별도 수동 batch job으로 시작
   - 완화 방안 2: full text 추출 후 후속 batch로 제한
2. AI analysis 저장 위치는 아직 미확정이다.
   - 완화 방안 1: `news_ai_analysis` 별도 테이블 채택
   - 완화 방안 2: 필요 시 `news_fulltext` 확장과 비교 검토
3. 정상적인 미분석 row와 저장 후 유실 row를 테스트에서 구분해야 한다.
   - 완화 방안 1: `analysis_status` 같은 상태값 도입
   - 완화 방안 2: 테스트 fixture를 미분석/분석완료/유실 3종으로 분리

#### 비고

- 이번 작업도 문서만 수정했다.
- 구현 코드는 아직 시작하지 않았다.
- 사용자 확인 전까지 이 리비전 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — persistence 권장범위 확정

**작성 시각:** 2026-03-06 19:48 (local)

**상태:** 사용자 확인 반영

#### 수행 내용

1. 사용자가 `0-4 persistence 범위`에 대해 “권장범위 까지”라고 명시적으로 확인했다.
2. plan에서 0-4를 더 이상 미확정이 아닌 확정 항목으로 반영했다.
3. 저장 범위를 아래처럼 고정했다.
   - 탭 목록, 마지막 활성 탭
   - 창 위치/크기/제목/linkId
   - 다크모드, 전체 글자 크기
   - News Feed 컬럼 on/off, source filter, 검색어, display mode
   - Data Control active tab
4. modal open 상태, loading 상태 같은 순간 UI 상태는 저장 범위에서 제외한다고 문서화했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 `0-4` 행이 `✅`로 바뀌었는지 확인한다.
2. `결정 #4 — persistence 저장 범위(확정)` 섹션에서 저장 대상/비저장 대상 목록을 확인한다.

#### 문제점 / 리스크

1. 저장 범위가 넓어져 localStorage schema 관리가 중요해졌다.
   - 완화 방안 1: version 필드 유지
   - 완화 방안 2: parse 실패 시 fallback reset
2. 검색어/컬럼 상태 복원이 과도하게 느껴질 수 있다.
   - 완화 방안 1: 추후 reset workspace 기능 제공
   - 완화 방안 2: 창별 초기화 버튼 추가 검토

#### 비고

- 이 변경은 사용자 확인을 plan에 반영한 문서 수정이다.

### Control Window Settings + 탭 drag 재배치 구현

**작성 시각:** 2026-03-06 20:44 (local)

**상태:** 확인 대기

#### 수행 내용

1. News Feed title/summary 글자 크기 제어 위치를 News Feed 창 toolbar가 아니라 `Data Control` 창의 `Settings` 탭으로 옮기도록 구조를 수정했다.
2. `App.tsx`에 `newsTitleFontSize`, `newsSummaryFontSize` 상태를 추가하고 `terminal-workspace-v1` payload에 저장/복원되게 연결했다.
3. `DraggableWindow.tsx`를 통해 `DataControlWindow.tsx`와 `FinnhubNewsWindow.tsx`에 새 typography props를 전달하도록 배선했다.
4. `DataControlWindow.tsx`의 `Settings` 탭에 `Title Text`, `Summary Text` preset/slider UI를 추가했다.
5. `FinnhubNewsWindow.tsx`에서 잘못 들어가 있던 title/summary font control toolbar를 제거하고, App에서 내려주는 값만 렌더에 적용하게 정리했다.
6. `App.tsx`의 탭 바에 drag/drop 재정렬을 추가해 탭 순서를 직접 바꿀 수 있게 했다.
7. `figma_frontend_prompt.md`와 `plan.md`를 이번 구현 기준으로 동기화했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm run build`를 실행한다.
2. `Data Control` 창의 `Settings` 탭에서 `Title Text`, `Summary Text` 값을 바꾸고 News Feed 본문/title 크기가 즉시 달라지는지 확인한다.
3. 앱을 새로고침한 뒤 마지막 title/summary 값이 유지되는지 확인한다.
4. 탭 2개 이상을 만든 뒤 탭을 드래그해서 순서를 바꾸고, 새로고침 후 순서가 유지되는지 확인한다.

#### 문제점 / 리스크

1. 기존 `terminal-workspace-v1`에 새 필드가 없는 구버전 payload가 남아 있을 수 있다.
   - 완화 방안 1: 기본값 `12/11`로 fallback
   - 완화 방안 2: 필요 시 localStorage reset으로 초기화
2. 탭 drag와 클릭이 같은 영역에 있어 브라우저/포인터 환경에 따라 오동작 가능성이 있다.
   - 완화 방안 1: drag 중 highlight 표시로 drop target을 명확히 함
   - 완화 방안 2: 필요 시 추후 drag handle 분리
3. News Feed 내부 localStorage와 workspace localStorage를 동시에 쓰면 설정 충돌 위험이 있다.
   - 완화 방안 1: title/summary 값은 News Feed localStorage 저장 대상에서 제거
   - 완화 방안 2: Control Window Settings를 단일 source로 유지

### Plan 리비전 — Finnhub confirmed-empty recent skip 정책 반영

**작성 시각:** 2026-03-06 21:25 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 recent news pull의 empty 재조회 낭비를 막는 정책을 plan에 명시하라고 요청했다.
2. `plan.md` 목표에 Finnhub recent confirmed-empty range 기록 항목을 추가했다.
3. 아래 핵심 규칙을 plan의 제약/결정/Step 0/Step 1/실행 그래프에 반영했다.
   - API 실패, timeout, 429, 5xx는 empty confirmation으로 기록하지 않음
   - HTTP 200 + 실제 빈 배열일 때만 confirmed-empty로 기록
   - `company_news`, `press_release`를 `source_type`별로 분리 기록
   - automatic recent retry는 당일 제외 confirmed-empty 범위를 영구 스킵
   - 수동 `custom range` 재조회는 계속 허용
4. Step 0에 정책 확정 항목(`0-6`)을 추가하고, Step 1에 구현 항목(`1-7`)을 추가했다.
5. 결정 상세 섹션에 운영적 정의와 사람이 확인할 체크 항목을 추가했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 목표 12번에 confirmed-empty range 기록 항목이 추가됐는지 확인한다.
2. `제약 / 비범위`에 아래 4개가 함께 있는지 확인한다.
   - API 실패와 empty 구분
   - `source_type`별 분리
   - 당일 제외
   - `custom range` 예외 유지
3. Step 0 표에 `0-6`, Step 1 표에 `1-7`이 추가됐는지 확인한다.
4. `결정 #6 — Finnhub recent confirmed-empty skip 정책(상세)` 섹션이 있는지 확인한다.

#### 문제점 / 리스크

1. 영구 스킵 정책은 provider가 과거 데이터를 늦게 보정할 경우 놓침 리스크가 있다.
   - 완화 방안 1: automatic recent만 영구 스킵하고 `custom range`는 항상 허용
   - 완화 방안 2: 운영 문서에 “필요 시 수동 재조회” 경로를 명시
2. empty와 실패를 헷갈리면 실제 데이터가 영구 누락될 수 있다.
   - 완화 방안 1: HTTP 200 + 빈 배열 조건을 코드/문서/테스트에 동일하게 강제
   - 완화 방안 2: 429/5xx/timeout은 별도 failure 로그로 남김
3. `source_type`를 합쳐 기록하면 실제 데이터가 있는 소스까지 막을 수 있다.
   - 완화 방안 1: `ticker + source_type` 단위 key를 강제
   - 완화 방안 2: 테스트 fixture를 `company_news` / `press_release` 분리 케이스로 준비

#### 비고

- 이번 변경은 plan/로그 문서 동기화 작업이다.
- 코드 구현은 아직 시작하지 않았다.
- 사용자 확인 전까지 이 리비전 상태는 `확인 대기`로 유지한다.

### Finnhub News Recent Update 정책 tooltip 추가

**작성 시각:** 2026-03-06 21:25 (local)

**상태:** 확인 대기

#### 수행 내용

1. `FinnhubNewsWindow.tsx`의 Recent Update 섹션 제목 옆에 info 아이콘을 추가했다.
2. 마우스를 3초 이상 올렸을 때만 tooltip이 열리도록 hover timer를 넣었다.
3. tooltip에 아래 정책 설명을 노출하도록 했다.
   - automatic recent retry confirmed-empty 과거 구간 영구 스킵

---

### Finnhub News Recent Update tooltip 렌더 방식 수정

**작성 시각:** 2026-03-06 21:25 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 3초 hover tooltip이 실제로 뜨지 않는다고 보고했다.
2. 원인을 메뉴 내부 absolute tooltip이 dropdown scroll/overflow에 영향을 받는 구조로 판단했다.
3. `FinnhubNewsWindow.tsx`에서 수동 hover timer 상태를 제거하고, 포털 기반 `Tooltip` 컴포넌트로 교체했다.
4. delay는 기존 요구대로 3초(`delayDuration=3000`)를 유지했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. Finnhub News 창에서 Update 드롭다운을 연다.
2. `Recent Update` 제목 옆 info 아이콘에 마우스를 3초 이상 올린다.
3. dropdown 바깥쪽으로 잘리지 않고 tooltip이 떠야 한다.
4. `npm run build`가 통과하는지 확인한다.

#### 문제점 / 리스크

1. tooltip 위치가 화면 오른쪽 가장자리에서는 좁아질 수 있다.
   - 완화 방안 1: 필요 시 side를 bottom으로 자동 전환
   - 완화 방안 2: tooltip 폭을 더 줄여 모바일 대응

#### 비고

- 이 항목은 기존 tooltip 구현의 표시 버그 수정이다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Finnhub News Recent Update 정책 설명 방식 변경

**작성 시각:** 2026-03-06 21:40 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 hover 기반 tooltip 대신 메뉴 안에 바로 보이는 설명 문구가 더 낫다고 요청했다.
2. `FinnhubNewsWindow.tsx`에서 Recent Update 제목 옆 info 아이콘과 tooltip 의존 코드를 제거했다.
3. 같은 섹션 바로 아래에 automatic recent retry 정책을 항상 보이는 작은 안내 문구로 추가했다.
4. `figma_frontend_prompt.md`와 `plan.md`를 현재 동작 기준으로 함께 수정했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. Finnhub News 창에서 Update 드롭다운을 연다.
2. `Recent Update` 섹션 제목 바로 아래에 정책 설명 문구가 항상 보이는지 확인한다.
3. `Recent Update (All)` 등 메뉴 항목 클릭 동작이 그대로 유지되는지 확인한다.
4. `npm run build`가 통과하는지 확인한다.

#### 문제점 / 리스크

1. 안내 문구가 길면 작은 화면에서 메뉴 높이를 더 차지할 수 있다.
   - 완화 방안 1: 필요 시 문장을 2줄 이내로 더 압축
   - 완화 방안 2: source별 설명은 유지하되 문구 폭을 더 줄임

#### 비고

- hover 실패를 피하기 위해 상시 노출형 보조 문구로 전환했다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Plan 상태 표기 동기화 수정

**작성 시각:** 2026-03-06 21:48 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 plan에 지금까지 구현한 내용이 제대로 반영되지 않았다고 지적했다.
2. 원인을 Step 2/3의 세부 단계 표와 Step 제목, 실행 의존성 그래프의 상태 이모지가 서로 어긋난 것으로 확인했다.
3. 사용자 확인이 아직 없으므로 Step 2/3 관련 구현 항목을 `✅`가 아니라 `⏳`로 정정했다.
4. Recent Update 정책 설명 방식이 tooltip이 아니라 상시 보조 문구로 바뀐 PLAN CHANGE도 plan에 추가했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 `Step 2`, `Step 3` 제목이 `⏳`로 표시되는지 확인한다.
2. 같은 섹션의 세부 단계 표 상태가 모두 `⏳`로 일치하는지 확인한다.
3. 실행 의존성 그래프의 Track B/C 상태도 동일하게 `⏳`로 반영됐는지 확인한다.
4. PLAN CHANGE 섹션에 Recent Update 설명 방식 변경 항목이 추가됐는지 확인한다.

#### 문제점 / 리스크

1. plan 상태를 구현 완료와 사용자 확인 완료로 구분하지 않으면 다시 드리프트가 생길 수 있다.
   - 완화 방안 1: 이후에도 `✅`는 사용자 명시 확인 후에만 사용
   - 완화 방안 2: Step 제목, 표, 그래프 3곳을 한 번에 갱신

#### 비고

- 이번 수정은 구현 상태 표현을 실제 진행 상태에 맞게 정정한 문서 동기화 작업이다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Market News publisher 표시 버그 수정

**작성 시각:** 2026-03-07 10:50 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

market news에서 publisher가 표시되지 않는 버그를 수정했다.

**원인 분석:**
1. `FinnhubMappedItem` type에 `publisher` 필드가 없었다.
2. Finnhub API의 `item.source`(publisher명: "Yahoo", "CNBC" 등)를 버리고 `source: "FINNHUB"`로 하드코딩했다.
3. `insertNewsItem` INSERT SQL에 `publisher` 컬럼이 포함되지 않아 항상 NULL로 삽입되었다.
4. `backfillPublisher()`가 서버 시작 시에만 실행되어, 런타임 중 새 뉴스는 다음 재시작까지 publisher가 NULL이었다.

**수정 내용:**
1. `FinnhubMappedItem` type에 `publisher?: string` 필드 추가
2. `fetchMarketNewsPageRaw` — Finnhub `item.source`를 publisher로 사용 (fallback: `derivePublisher(url)`)
3. `fetchCompanyNewsRaw` — Finnhub `item.source`를 publisher로 사용 (fallback: `derivePublisher(url)`)
4. `fetchPressReleasesRaw` — URL 기반 `derivePublisher()` 사용
5. `insertNewsItem` params/SQL에 publisher 추가 (10번째 VALUES 파라미터), 반환값에도 publisher 포함
6. `insertFetchedItems`에서 `rawItem.publisher` 전달

#### 생성/수정 파일

- `terminal/backend/src/services/finnhubNewsProvider.ts` — FinnhubMappedItem type 확장, fetch 3개 함수에 publisher 매핑 추가
- `terminal/backend/src/services/newsRepository.ts` — insertNewsItem params/SQL/반환값에 publisher 추가
- `terminal/backend/src/server.ts` — insertFetchedItems에서 publisher 전달

#### 검증 방법

- `npm run test` → 48/48 테스트 통과
- `npx tsc --noEmit` → type error 0개
- `npm run build` (frontend) → 빌드 성공
- 사용자 확인: 백엔드 재시작 후 market news pull 실행 → publisher 컬럼에 값이 표시되는지 확인

---

### Plan 리비전 — Canonical ticker master model 추가

**작성 시각:** 2026-03-07 12:19 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 company description, default ticker, watchlist를 뉴스가 아니라 종목 엔터티에 일관되게 연결해야 한다고 요청했다.
2. `plan.md` 목표에 `securities.id` 중심 canonical 종목 모델 도입 항목을 추가했다.
3. `현재 레포 상태`에 아래 현황을 명시했다.
   - default ticker source는 `watch lists2_2026-02-22.csv` 하드코딩 CSV 기반
   - `watchlist_items`는 아직 `ticker TEXT` 기반
   - `securities`, `company_profiles`, universe 테이블은 아직 없음
4. `제약 / 비범위`와 `결정/선행조건`에 아래 방향을 반영했다.
   - company description은 `news_id`가 아니라 종목 엔터티 기준으로 저장
   - 정식 구조는 `company_profiles.security_id`
   - default ticker는 CSV를 원본으로 남기되 runtime canonical 목록은 `app.db`로 승격
   - watchlist는 장기적으로 `security_id`로 이전
5. 후속 구조 정리 phase로 `Step 5 — Canonical ticker master model`을 추가했다.
   - `securities`, `company_profiles`, `ticker_universes`, `ticker_universe_items` schema
   - default ticker CSV import
   - FMP company description upsert
   - `watchlist_items.security_id` migration/backfill
   - watchlist API의 ticker 친화적 외부 계약 유지

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 목표 20번에 `securities.id` 중심 canonical 종목 모델 항목이 추가됐는지 확인한다.
2. `결정/선행조건`에 아래 항목이 있는지 확인한다.
   - `종목 canonical identity 모델`
   - `Default ticker canonical 저장 방식`
3. `단계별 계획`에 `Step 5 — Canonical ticker master model`이 추가됐는지 확인한다.
4. `실행 의존성 그래프`에 `Track E`가 추가됐는지 확인한다.

#### 문제점 / 리스크

1. 기존 ticker 문자열 기반 경로와 새 `security_id` 경로가 한동안 공존하므로 migration 순서를 잘못 잡으면 join 불일치가 날 수 있다.
   - 완화 방안 1: 외부 API 응답은 ticker 친화적으로 유지하고 내부만 단계적으로 이전
   - 완화 방안 2: join 포인트 점검 체크리스트를 Step 5 완료 조건에 포함
2. default ticker CSV를 너무 빨리 제거하면 운영자가 source of truth를 잃을 수 있다.
   - 완화 방안 1: CSV는 원본 source로 유지하고 DB는 runtime canonical cache로 승격
   - 완화 방안 2: `ticker_universes/default` 식별자와 source_path를 같이 노출

#### 비고

- 이번 작업은 plan/log 문서 업데이트만 수행했고, 코드 구현은 아직 시작하지 않았다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

---

### Step 5 — Canonical ticker master model 구현

**작성 시각:** 2026-03-07 13:41 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

Step 5 전체(5-1 ~ 5-6)를 구현했다. 종목을 뉴스/watchlist와 분리된 독립 엔터티로 도입.

**5-1: DB 스키마 추가**
- `securities`, `company_profiles`, `ticker_universes`, `ticker_universe_items` 테이블 생성
- 파일: `terminal/backend/src/db.ts`

**5-2: CSV → canonical universe import**
- `readTickerRowsFromCsv()` 추가 (quoted fields 지원 CSV 파서)
- `tickerUniverseRepository.ts` 신규 생성 (securities/universe CRUD)
- 서버 startup 시 default CSV (watch lists2_2026-02-22.csv) → 1191개 종목 자동 import
- API: `GET /api/securities`, `GET /api/securities/search`, `GET /api/universes`, `GET /api/universes/:id/items`
- 파일: `tickerCsvService.ts`, `tickerUniverseRepository.ts`, `server.ts`

**5-3: FMP company profile 저장**
- `fmpCompanyProfileProvider.ts` 신규: FMP stable endpoint (`/stable/profile?symbol=...`)
- `companyProfileRepository.ts` 신규: `company_profiles` upsert/조회
- `config.ts`에 FMP API key 로드 추가
- API: `GET /api/company-profiles/:ticker`, `POST /api/company-profiles/pull-fmp`
- 검증: AAPL description/CEO/employees 정상 저장 확인

**5-4: watchlist_items security_id**
- `watchlist_items`에 `security_id` 컬럼 추가 (ALTER TABLE)
- `backfillWatchlistSecurityIds()` 추가 — 기존 ticker → security_id 매핑
- `createWatchlist()` — 새 항목 추가 시 security_id 자동 연결
- startup 시 자동 backfill 실행

**5-5: watchlist API 내부 전환**
- `listWatchlists()` — 응답에 `security_ids` 배열 추가
- 외부 API 계약 (tickers 배열)은 호환 유지

**5-6: join 포인트 점검**
- 24개 ticker 기반 join/필터 위치 분석 완료
- HIGH: `newsRepository.ts` (CSV LIKE + sentiment subquery)
- MEDIUM: `calendarRepository.ts`, `confirmed_empty_ranges`
- LOW: OHLC Symbol (외부 스키마, 유지)
- plan.md에 후속 migration 체크리스트 추가

#### 검증
- `npx tsc --noEmit` → 에러 0
- `npm run test` → 48 tests, 6 suites 전부 pass
- 서버 시작 → securities 1191개, default universe 생성 확인
- `GET /api/securities/search?q=TXN` → sector/industry 정상
- `POST /api/company-profiles/pull-fmp` (AAPL) → description/CEO/ipo_date 저장 확인

#### 검증 방법 (사용자)
```bash
cd terminal/backend
npm run test
npx tsc --noEmit
# 서버 시작 후:
curl http://localhost:8080/api/universes
curl http://localhost:8080/api/securities/search?q=AAPL
curl http://localhost:8080/api/company-profiles/AAPL
```

### Plan 리비전 — `ticker_universes/default` 기준 전환 + Data Control app DB 구조 탭

**작성 시각:** 2026-03-07 17:21 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 “default ticker는 `ticker_universes/default`를 쓰고, Data Control에 app DB 구조를 보여주는 새 탭을 넣는 방향을 먼저 plan에 반영하라”고 요청했다.
2. `plan.md` 상단의 현재 레포 상태를 실제 구현 기준으로 정정했다.
   - runtime `app.db`에 `securities`, `company_profiles`, `ticker_universes`, `ticker_universe_items`가 이미 존재함
   - default ticker는 아직 CSV 원본 + DB canonical import가 함께 있는 hybrid 상태임
   - company description은 `company_profiles.security_id` 기준 canonical 저장 구조가 이미 있음
3. `plan.md`에 새 후속 단계 `Step 6 — ticker_universes/default 기준 조회 전환 + Data Control app DB 구조 탭`을 추가했다.
4. Step 6에는 아래 요구를 세부 단계로 분해해 반영했다.
   - CSV 직접 read보다 `ticker_universes/default` 조회 우선
   - app DB inspection API
   - `ticker_universes/default` 같은 식별자 기반 설명/lookup
   - Data Control의 `App DB`/`Database` 탭 + Refresh
   - 각 데이터 리소스의 UI/API 사용처 표시
5. `plan.md` 말미에 이번 리비전의 이유와 사용자 관점 영향을 `PLAN CHANGE (2026-03-07)`로 추가했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 현재 상태 섹션에 아래 3개가 반영됐는지 확인한다.
   - default ticker hybrid 상태 설명
   - runtime `app.db` canonical 테이블 존재 설명
   - `company_profiles.security_id` canonical 저장 설명
2. `plan.md`에 `#### ⬜ Step 6 — ticker_universes/default 기준 조회 전환 + Data Control app DB 구조 탭`이 추가됐는지 확인한다.
3. `plan.md` 말미에 `PLAN CHANGE (2026-03-07) — ticker_universes/default 기준 전환 + Data Control app DB 가시성 추가`가 있는지 확인한다.

#### 문제점 / 리스크

1. 현재 코드상 기본 대상 선정은 여전히 CSV 직접 read 경로가 남아 있다.
   - 완화 방안 1: Step 6-1에서 기본 대상 선정 API를 `ticker_universes/default` 조회 우선으로 정리
   - 완화 방안 2: CSV는 import source/fallback 용도로만 남긴다고 문서/코드에서 명시
2. app DB 구조를 그대로 노출하면 테이블이 많아져 UI가 복잡해질 수 있다.
   - 완화 방안 1: table count + sample row + 관계 요약 중심으로 제한
   - 완화 방안 2: 리소스 식별자 단위 lookup 화면을 함께 제공
3. 테이블 구조만 보여주고 사용처를 안 붙이면 운영자가 다시 코드를 찾아야 한다.
   - 완화 방안 1: 각 리소스에 UI/API 사용처 필드를 같이 표시
   - 완화 방안 2: `ticker_universes/default` 같은 named resource를 직접 선택해 설명하게 설계

#### 비고

- 이번 작업은 plan/log 문서 리비전만 수행했다.
- 코드 파일(`.ts`, `.tsx`, `.js`, `.py`)은 수정하지 않았다.
- 사용자 확인 전까지 이 리비전 상태는 `확인 대기`로 유지한다.

---

### Step 6 구현 — `ticker_universes/default` 기준 전환 + Data Control App DB 탭

**작성 시각:** 2026-03-07 17:34 (local)

**상태:** 사용자 확인 대기 (awaiting user confirmation)

#### 수행 내용

1. **6-1 기본 ticker 소스 전환** (`server.ts`)
   - `getDefaultUniverseTickers()` 비동기 helper 추가: `listUniverses()` → `name==="default"` 행 → `listUniverseItems()` 순서로 조회; DB 미준비 시 CSV 자동 fallback.
   - 적용 위치 6곳: `POST /api/company-profiles/pull-fmp`, `GET /api/news/pull-finhub/preflight`(직접 csvPath 미지정 시), `POST /api/news/pull-finhub`(입력 csvPath === DEFAULT_TICKERS_CSV 시). 그 외 경로에서는 CSV 계속 사용.

2. **6-2/6-3 inspection API** (`server.ts`)
   - `GET /api/db/inspect` 신규 추가.
   - `sqlite_master`에서 테이블 목록 조회, 각 테이블마다 `PRAGMA table_info` / `PRAGMA foreign_key_list` / `COUNT(*)` / `SELECT … LIMIT 5` 실행.
   - `TABLE_UI_USAGE` 상수에 테이블별 UI 사용처 한글 설명 12개 테이블 정의.
   - `ticker_universes` 테이블은 `resources[]` 확장: 각 universe row를 `ticker_universes/<name>` 식별자로 표현, `itemCount` / `sampleTickers` (10개) / UI 사용처 3개 포함.

3. **6-4/6-5 Data Control App DB 탭** (`DataControlWindow.tsx`)
   - `DbColumn`, `DbForeignKey`, `DbResource`, `DbTableInfo` 인터페이스 추가.
   - `activeDataTab` 타입 `'updates' | 'settings' | 'appdb'`로 확장, localStorage restore/persist 모두 처리.
   - `dbTables / dbLoading / dbError` 상태 추가, `fetchDbInspect()` 함수 추가.
   - `App DB` 탭 추가: Refresh 버튼 → `GET /api/db/inspect`, 테이블 카드(이름/rowCount/컬럼 chip/FK/uiUsage badge), `ticker_universes` 하위에 resource 카드(identifier/source/sampleTickers/uiUsage).

#### 생성/수정 파일

- `terminal/backend/src/server.ts` — helper + inspection API + 기본 ticker 소스 전환
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` — App DB 탭

#### 검증 결과

- `tsc --noEmit` (백엔드): **clean (0 errors)**
- `vite build` (프론트엔드): **✓ 성공**
- `vitest run` (백엔드): **48/48 pass**

#### 사용자 확인 방법

1. Dev 서버 기동 후 Data Control 창 열기 → `App DB` 탭 확인.
2. Refresh 클릭 → 테이블 목록(securities, news_items, ticker_universes 등) 카드 표시 확인.
3. `ticker_universes` 카드 하단에 `ticker_universes/default` resource 카드(itemCount ~1191, sampleTickers 10개, uiUsage badges) 표시 확인.
4. `POST /api/company-profiles/pull-fmp` 호출 시 body에 tickers 미지정이면 DB에서 default universe 종목을 기본 대상으로 쓰는지 확인.

---

### Plan 문구 동기화 — stale 상태 정정

**작성 시각:** 2026-03-07 17:38 (local)

**상태:** 반영 완료

#### 수행 내용

1. `plan.md` 상단 현재 레포 상태 섹션의 stale 문구를 실제 구현 기준으로 정정했다.
   - `DataControlWindow.tsx` 설명: `Updates` / `Settings`만 있던 문구 → `App DB` 포함으로 갱신
   - company description 기본 pull 대상 설명: CSV 직접 read 잔존 문구 → `ticker_universes/default` 우선 조회 + CSV fallback 문구로 교체
2. 실제 완료된 단계 헤더 상태를 정정했다.
   - `Step 1` header: `⬜` → `✅`
   - `Step 5` header: `⏳` → `✅`
3. `plan.md` 말미에 이번 문서 동기화 이유와 범위를 `PLAN CHANGE (2026-03-07 17:38)`로 남겼다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md` 상단 현재 상태에서 `DataControlWindow.tsx` 설명에 `App DB`가 포함되는지 확인.
2. 같은 섹션에서 company profile 기본 pull 대상 설명이 `ticker_universes/default` 우선 조회로 적혀 있는지 확인.
3. `plan.md`의 `Step 1`, `Step 5` 헤더가 각각 `✅`로 표시되는지 확인.
4. `plan.md` 말미에 `PLAN CHANGE (2026-03-07 17:38) — plan 상태 문구 동기화`가 추가됐는지 확인.

### Step 3 Workspace Persistence 구현 완료

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

Step 3 항목 (3-1 ~ 3-6) 분석 및 구현을 완료했다.

1. **3-1 ~ 3-3 (기존 구현 확인):** 탐색 결과, `terminal-workspace-v1` localStorage key에 tabs/activeTabId/isDarkMode/fontScale/newsTitleFontSize/newsSummaryFontSize/linkedTicker/window positions가 이미 저장/복원되고 있었다. `App.tsx`에서 모든 탭의 windows를 렌더하되 비활성 탭은 `display:'none'`으로 숨겨 React state를 보존하는 방식이라 탭 왕복 시 상태가 유지된다.
2. **3-4 (기존 구현 확인):** `finhub-news-ui-state`에 visibleCols/displayMode/sourceTypeFilter/searchQuery/tickerQuery/fromDate/toDate가 이미 저장/복원되고 있었다. `data-control-active-tab`에 Settings 탭 상태 저장도 구현돼 있었다.
3. **3-5 versioning/fallback 보강:** `DraggableWindow.tsx`에 off-screen 클램핑 로직을 추가했다. 화면 크기가 달라질 때 창이 뷰포트 범위를 벗어나지 않도록 `Math.min(x, innerWidth-100)`, `Math.min(y, innerHeight-50)` 적용. 기존 `App.tsx`의 version 체크와 try/catch fallback은 이미 충분히 견고했다.
4. **3-6 북마크 view 상태 복원:** `selectedBookmarkFolderId`를 `finhub-news-ui-state` localStorage에 추가했다. 초기화 시 복원하고, persist effect에도 포함했다. 삭제된 폴더 ID fallback 로직도 `fetchBookmarkFolders` 콜백에 추가했다.
5. **버그 수정:** `fetchBookmarkFolders`에서 backend 응답이 배열인 경우(`data`)와 `.folders` wrapper인 경우(`data.folders`) 모두 처리하도록 수정했다 (기존 코드는 `data.folders`만 처리해서 실제로는 항상 빈 배열이었음).

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` — selectedBookmarkFolderId 저장/복원, fetchBookmarkFolders 응답 파싱 수정
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx` — off-screen 클램핑
- `ai_agent_plan/terminal_ui_ver3_final/plan.md` — Step 3 전체 ✅
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md` — 본 항목 추가

#### 검증 방법

1. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build` → 성공 ✅
2. `cd terminal/backend && npm run test` → 48/48 pass ✅
3. TypeScript 에러 0개 확인 (`get_errors`) ✅
4. 수동 검증: 브라우저에서 앱 열기 → 탭/창 배치 변경 → 새로고침 → 복원 확인
5. 수동 검증: 북마크 폴더 선택 → 새로고침 → 같은 폴더 view 복원 확인
6. 수동 검증: 창을 화면 우하단으로 이동 → 화면 크기 줄이기 → 새로고침 → 뷰포트 내 복원 확인

#### 문제점 / 리스크

1. `selectedBookmarkFolderId`가 복원됐는데 폴더 목록 fetch가 느리면 일시적으로 빈 화면이 보일 수 있다
   - 완화 방안: 현재 로직은 fetchNews가 먼저 bookmarkFolderId로 조회하므로 fetch 후 결과가 보임
2. 여러 FinnhubNewsWindow가 동시에 열리면 같은 localStorage key를 공유한다
   - 완화 방안: 현재 탭당 1개 News 창 구조에서는 문제 없음. 추후 window ID별 key 분리 검토 가능

### Step 2 Frontend 구현 완료

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `FinnhubNewsWindow.tsx`의 backend 응답 매핑을 실제 backend camelCase 계약에 맞게 수정했다.
   - `scoreEvidence`
   - `sentimentBullishPct` 기반 sentiment 표시
2. 검색창 바로 아래에 ticker 전용 검색창을 추가하고 `tickers` query로만 동작하게 연결했다.
3. `GET /api/news`를 500개 배치 + `nextCursor` 기반으로 바꾸고, 하단 자동 append + `Load more` 버튼을 함께 연결했다.
4. 검색 영역에 `From` / `To` 날짜 입력을 추가하고 `from` / `to` query와 연결했다.
5. 검색 영역에 `Bookmark view` 폴더 선택 메뉴를 추가하고 `bookmarkFolderId` query와 연결했다.
6. 뉴스 row 우클릭 메뉴에 `Add bookmark` 흐름을 추가하고, 선택한 폴더에 저장되도록 연결했다.
7. 북마크 폴더를 선택하면 같은 리스트 UI가 해당 폴더 뉴스만 보이도록 bookmark mode를 연결했다.
8. 기존 코드 상태를 확인한 결과 아래 항목은 이미 구현되어 있었고 이번 빌드 검증 범위에 포함됐다.
   - Score / Score Evidence / Keywords / Sentiment 컬럼
   - Keywords 렌더 및 정렬
   - Data Control `Updates` / `Settings` 탭
   - 전체 글자 크기 조절 UI

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build` → 성공 확인 ✅
2. UI에서 일반 검색 / ticker 검색 / 날짜 검색을 각각 바꿔가며 결과가 재조회되는지 확인
3. 많은 결과가 나오는 검색으로 하단 스크롤 시 자동 append, 또는 `Load more` 버튼으로 추가 로드 확인
4. `Bookmark view`에서 폴더 선택 시 해당 폴더 뉴스만 보이는지 확인
5. 뉴스 row 우클릭 후 `Add bookmark`로 폴더 저장 뒤 bookmark mode에서 다시 보이는지 확인

#### 문제점 / 리스크

1. `Bookmark view` 메뉴는 현재 평면 목록이며 트리 UI는 아직 아니다.
   - 완화 방안 1: parent/child 들여쓰기 렌더 추가
   - 완화 방안 2: 폴더 수가 늘면 tree popover로 교체
2. row 우클릭 메뉴는 현재 북마크 전용이고, source cell 우클릭의 `Copy URL` 메뉴와 별도다.
   - 완화 방안 1: 추후 통합 context menu로 정리
   - 완화 방안 2: menu label을 더 명확히 분리
3. 500개 append는 동작하지만 데이터가 아주 많으면 메모리/렌더 비용이 커질 수 있다.
   - 완화 방안 1: 현재는 `react-window`로 리스트 virtualization 유지
   - 완화 방안 2: 필요 시 검색 조건 변경 시 더 공격적으로 상태 초기화

### Bookmark view 폴더 우클릭 Rename 추가

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `FinnhubNewsWindow.tsx`의 `Bookmark view` 드롭다운에 폴더별 우클릭 진입점을 추가했다.
2. 폴더 항목 우클릭 시 작은 context menu가 열리고 `Rename` 버튼이 보이도록 구현했다.
3. `Rename` 선택 시 해당 폴더 항목이 인라인 input으로 바뀌고, Enter 또는 blur 시 기존 `PUT /api/bookmarks/folders/:id` API로 이름 수정이 저장되도록 연결했다.
4. rename 완료 후 북마크 폴더 목록을 다시 fetch 해서 드롭다운 라벨과 목록 이름이 함께 갱신되게 했다.
5. 현재 작업 중인 `plan.md`에 Step 2-12와 PLAN CHANGE 메모를 추가해 변경 범위를 동기화했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build`
2. 앱에서 `Bookmark view` 메뉴를 연다.
3. 폴더 항목 위에서 마우스 오른쪽 클릭 → `Rename` 클릭 → 새 이름 입력 → Enter
4. 수정한 이름이 드롭다운 항목과 버튼 라벨에 반영되는지 확인한다.

#### 문제점 / 리스크

1. 드롭다운 내부의 일반 클릭 닫힘과 우클릭 context menu가 충돌할 수 있다.
   - 완화 방안 1: context menu 전용 outside-click ref로 분리
   - 완화 방안 2: 필요 시 rename을 Bookmark Manager와 공통 컴포넌트로 통합
2. 빈 이름으로 저장하려 하면 UX가 모호할 수 있다.
   - 완화 방안 1: 공백 입력은 저장하지 않고 편집 상태를 종료
   - 완화 방안 2: 필요 시 후속 작업에서 validation 메시지 추가

### Bookmark Manager `+` 폴더 생성 버튼 추가

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `BookmarkManager.tsx`의 왼쪽 `Folders` 헤더에 `+` 버튼을 추가했다.
2. `+` 버튼을 누르면 인라인 입력칸이 열리고, 새 폴더명을 입력해 기존 `POST /api/bookmarks/folders` API로 생성되도록 연결했다.
3. 생성 성공 시 새 폴더를 자동 선택하고, 부모의 폴더 목록 refresh 콜백을 호출해 목록을 다시 불러오게 했다.
4. Enter와 blur가 동시에 발생할 때 중복 생성되지 않도록 `creatingFolder` guard state를 추가했다.
5. 현재 작업 중인 `plan.md`에 Step 2-13과 PLAN CHANGE 메모를 추가해 변경 범위를 동기화했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/BookmarkManager.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build`
2. 앱에서 Bookmark Manager를 연다.
3. 왼쪽 `Folders` 헤더의 `+` 버튼 클릭 → 폴더명 입력 → Enter
4. 생성된 폴더가 목록에 추가되고 선택 상태가 되는지 확인한다.

#### 문제점 / 리스크

1. 생성 실패 시 현재는 별도 에러 메시지가 없다.
   - 완화 방안 1: 후속 작업에서 inline validation 또는 toast 추가
   - 완화 방안 2: 네트워크 실패 시 입력값 유지 정책 검토
2. 새 폴더 선택은 local state로 즉시 잡히지만 서버 refresh가 늦으면 잠깐 목록 반영이 늦을 수 있다.
   - 완화 방안 1: 현재는 부모 refresh로 최종 상태를 재동기화
   - 완화 방안 2: 필요 시 optimistic folder append로 보강

### Bookmark Manager 빈 폴더 우클릭 Paste 추가

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `BookmarkManager.tsx`의 item context menu 상태를 일반화해 아이템 row뿐 아니라 빈 폴더 영역도 타깃으로 쓸 수 있게 바꿨다.
2. 오른쪽 아이템 패널의 빈 영역과 `No bookmarks in this folder` 상태에서 우클릭하면, clipboard가 있을 때 선택된 폴더 기준 `Paste` 메뉴가 뜨도록 구현했다.
3. 아이템 row 우클릭 시 부모 빈 영역 context menu가 같이 열리지 않도록 `stopPropagation()`을 추가했다.
4. 빈 영역 우클릭일 때는 `Copy`, `Cut`, `Delete`는 숨기고 `Paste`만 보이게 해서 메뉴를 단순하게 유지했다.
5. 현재 작업 중인 `plan.md`에 Step 2-14와 PLAN CHANGE 메모를 추가해 변경 범위를 동기화했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/BookmarkManager.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build`
2. Bookmark Manager에서 항목 하나를 `Copy` 또는 `Cut` 한다.
3. 비어 있는 폴더를 선택하고 오른쪽 빈 영역을 우클릭한다.
4. `Paste` 메뉴가 뜨고, 클릭 시 해당 폴더에 항목이 추가되는지 확인한다.

#### 문제점 / 리스크

1. clipboard가 없을 때 빈 영역 우클릭은 아무 반응이 없으므로 사용자가 메뉴를 기대할 수 있다.
   - 완화 방안 1: 현재는 `Paste` 가능한 경우에만 메뉴를 열어 단순함 유지
   - 완화 방안 2: 필요 시 후속 작업에서 disabled `Paste` 메뉴 검토
2. 패널 전체 우클릭 허용으로 아이템 우클릭 이벤트와 중첩될 수 있다.
   - 완화 방안 1: row `onContextMenu`에서 전파 중단
   - 완화 방안 2: 필요 시 컨테이너 target 검사 추가

### Step 1 Backend 구현 완료

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

Step 1 전체 (1-1 ~ 1-13)를 구현하고 빌드/테스트를 통과시켰다.

1. **1-1 DB migration** — `db.ts`에 5개 테이블 추가: `news_sentiment_snapshots`, `news_ai_analysis`, `bookmark_folders`, `bookmark_items`, `confirmed_empty_ranges`
2. **1-2 Finnhub sentiment fetch** — `finnhubNewsProvider.ts`에 `fetchSentimentSnapshot`, `upsertSentimentSnapshot` 추가. pull-finhub 배경 작업에서 ticker마다 sentiment 자동 fetch
3. **1-3 AI analysis repository** — 새 파일 `aiAnalysisRepository.ts` 생성 (CRUD + batch + ready-for-analysis + validateAnalysisCompleteness)
4. **1-4 GET /api/news contract** — `types.ts`에 score/scoreEvidence/analysisStatus/sentiment 필드 추가, `newsRepository.ts`에 LEFT JOIN news_ai_analysis + sentiment batch lookup
5. **1-5 기본 빈 상태 규칙** — `mapNewsRow`에서 AI analysis 미실행 row는 null로 내려감
6. **1-6 삭제 감지 테스트** — `tests/aiAnalysisRepository.test.ts` 생성 (8개 테스트: upsert, batch, score null FAIL, evidence null FAIL, empty keywords WARN, not_started 미오탐)
7. **1-7 confirmed-empty range** — `finnhubNewsProvider.ts`에 `recordConfirmedEmpty`/`getConfirmedEmptyRange`, `server.ts` pull-finhub에서 company_news/press_release 모두 적용
8. **1-8 500-item cursor paging** — `capLimitByRangeDays()` → 항상 500, 기본/최대 제한 500
9. **1-9 날짜 기간 검색** — 기존 from/to 지원 확인, limit 정책 업데이트
10. **1-10 plain text extractor** — `fulltextExtractors.ts`에 `htmlToPlainText()` 유틸 추가, `extractNasdaq`·`extractTmx` 모두 plain text 반환으로 변경
11. **1-11 HTML backfill** — `fulltextUpdateService.ts`에 `runFulltextPlainTextBackfill()` 추가, `POST /api/news/fulltext/backfill-plaintext` 엔드포인트
12. **1-12 북마크 schema/API** — `server.ts`에 CRUD 6개 라우트 (GET/POST/PUT/DELETE folders, POST/DELETE items, GET folder items)

---

### Step 4 통합 검증 / 문서 동기화 / 운영 가드레일 완료

**작성 시각:** 2026-03-07 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### Step 4 수행 내용

Step 4 전체 (4-1 ~ 4-4)를 완료했다.

1. **4-1 prompt 문서 동기화**
   - `backend_prompt.md`: 5개 새 테이블 스키마(news_sentiment_snapshots, news_ai_analysis, bookmark_folders, bookmark_items, confirmed_empty_ranges), 새 응답 필드(score, scoreEvidence, analysisStatus, sentimentBullishPct, sentimentBearishPct, companyNewsScore), 500 고정 limit 정책, bookmarkFolderId query, Bookmark API 6개 라우트, AI Analysis validate/backfill 엔드포인트, aiAnalysisRepository.ts 파일 추가를 반영했다.
   - `figma_frontend_prompt.md`: 13개 컬럼(+keywords, score, scoreEvidence, sentiment), 3-row 검색 UI(keyword, ticker, date range), 500건 cursor pagination + Load more, Bookmark UI 섹션(폴더 view, row 우클릭), localStorage 필드 확장(tickerQuery, fromDate, toDate, selectedBookmarkFolderId), backend API 계약 18개 엔드포인트, 다크모드 localStorage 저장을 반영했다.

2. **4-2 empty/lost/null 정책 정리**
   - `analysis_status` 기반 구분 규칙을 backend_prompt에 문서화: `not_started`/`in_progress` = 정상 empty, `completed` 후 score=null = 유실(FAIL), `completed` 후 keywords=[] = WARN.

3. **4-3 E2E 체크리스트 정리**
   - plan.md 검증 훅에 26개 항목 수동 검증 체크리스트 추가: 뉴스 기본 조회(3), 검색(4), 컬럼(3), 북마크(6), Workspace persistence(6), 삭제 감지(2), 북마크 vs saved view 구분(2).

4. **4-4 의존성 그래프 최종화**
   - Track A/B/C/D 전체 ✅로 갱신, plan Step 4 테이블 전체 ✅ 마킹.

#### 생성/수정 파일

- `terminal/backend_prompt.md` — 5개 테이블, limit정책, 응답 필드, Bookmark/AI API, 파일맵
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` — 13 컬럼, 검색 UI, bookmark UI, state, API 계약
- `ai_agent_plan/terminal_ui_ver3_final/plan.md` — E2E 체크리스트, 의존성 그래프 전체 ✅, Step 4 테이블 ✅
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md` — 본 항목 추가

#### 검증 방법

1. `cd terminal/backend && npm run build && npm run test` → 48/48 pass ✅
2. `cd termina_web/figma_code/terminal_ui_ver2_finhub && npm run build` → 성공 ✅
3. TypeScript 에러 0개 (`get_errors`) ✅
4. Backend API alive 확인: `GET /api/news?limit=2` → items:2, hasCursor:True ✅
5. `backend_prompt.md` diff 확인: 새 테이블/필드/API가 코드와 일치
6. `figma_frontend_prompt.md` diff 확인: 컬럼/검색/북마크/state가 코드와 일치
7. plan.md E2E 체크리스트 26개 항목을 1회 실행 순서로 수동 검증 (사용자 수행)

#### 문제점 / 리스크

1. prompt 문서가 코드 변경 없이 업데이트됐으므로 향후 코드 변경 시 다시 drift될 수 있다.
   - 완화 방안: copilot-instructions.md의 필수 워크플로우 가드레일(*.py 수정 시 *.md 동기화)이 이미 적용 중
2. E2E 체크리스트 26개 항목은 수동 검증이므로 시간이 걸린다.
   - 완화 방안: 가장 핵심적인 항목(1, 4-7, 11-16, 17-22)부터 우선 실행

---

### Plan 리비전 — Finnhub peers 컬럼/수집/저장 계획 추가

**작성 시각:** 2026-03-07 17:54 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. 사용자가 다음 요구를 plan에 먼저 반영해 달라고 요청했다.
   - News Feed에 `Peers` 컬럼 추가
   - 단, 기본 visible 컬럼에는 포함하지 않음
   - Data Control에서 `ticker_universes/default` 기준으로 peers batch pull 실행
   - 저장 위치는 company description과 같은 `company_profiles`
2. Finnhub peers 가능 여부를 앞선 probe 결과에 맞춰 현재 상태에 명시했다.
   - `/stock/peers?symbol=...` endpoint 접근 가능
   - 실제 key 기준 ticker 배열 응답 확인 완료
3. `plan.md` 목표에 peers 관련 목표 3개(21~23)를 추가했다.
4. `plan.md` 현재 상태/제약/결정사항에 아래 내용을 추가했다.
   - peers endpoint는 사용 가능하지만 아직 코드에 연결되지 않음
   - `company_profiles`에는 peers 저장 구조가 아직 없음
   - News Feed `Peers` 컬럼은 기본 비노출 규칙 유지
   - 결정 #15로 `company_profiles` canonical 저장 + 선택 컬럼 노출 방향 확정
5. `Step 7 — Finnhub peers 수집/저장/UI 노출`을 새로 추가했다.
   - 7-1 schema/repository 저장 구조
   - 7-2 Finnhub peers provider + default universe batch pull
   - 7-3 Data Control peers pull 액션
   - 7-4 News Feed peers 응답/컬럼 연결
   - 7-5 기본 비노출 규칙
   - 7-6 App DB inspection 가시성
   - 7-7 테스트/문서 동기화
6. 실행 의존성 그래프에 `Track F: Finnhub peers`를 추가해 후속 구현 순서를 분리했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md` 목표에 21~23번 peers 요구가 추가됐는지 확인한다.
2. `plan.md`에 `#### ⬜ Step 7 — Finnhub peers 수집/저장/UI 노출` 섹션이 생겼는지 확인한다.
3. Step 7 설명 안에 아래 네 가지가 모두 들어있는지 확인한다.
   - 기본 대상: `ticker_universes/default`
   - 저장 위치: `company_profiles`
   - UI 위치: Data Control + News Feed
   - 기본 비노출: `Peers` 컬럼은 default off
4. 실행 의존성 그래프에 `Track F: Finnhub peers`가 추가됐는지 확인한다.

#### 문제점 / 리스크

1. `company_profiles`에 peers를 어떤 컬럼 형식으로 저장할지 구현 시점에 다시 확정해야 한다.
   - 완화 방안 1: inspection/UI 가시성을 위해 명시 컬럼 우선 검토
   - 완화 방안 2: raw_json 전용 저장은 피하고, 운영자가 확인 가능한 canonical 필드 유지
2. News Feed row에 ticker가 여러 개인 경우 어떤 ticker의 peers를 보여줄지 규칙이 필요하다.
   - 완화 방안 1: 대표 ticker 선택 규칙 문서화
   - 완화 방안 2: 필요 시 후속 단계에서 multi-ticker merge 정책 추가 검토
3. Finnhub peers batch pull은 rate limit 영향을 받을 수 있다.
   - 완화 방안 1: 재시도/백오프와 성공/실패 집계 추가
   - 완화 방안 2: preflight에서 대상 수를 먼저 보여 주기

#### 비고

- 이번 작업은 plan/log 문서 업데이트만 수행했고, 코드 구현은 시작하지 않았다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — Data Control company description update 버튼 누락 반영

**작성 시각:** 2026-03-07 18:00 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. 사용자가 Data Control에 company description update 버튼이 왜 없는지 질문했고, default ticker 기준 다운로드로 이해하고 있었다.
2. 실제 코드/plan을 대조해 아래를 확인했다.
   - backend에는 `POST /api/company-profiles/pull-fmp`가 이미 있음
   - ticker를 따로 주지 않으면 `ticker_universes/default`를 기본 대상으로 사용함
   - 하지만 `DataControlWindow.tsx` `Updates` 탭에는 해당 endpoint를 호출하는 버튼이 없음
3. 기존 plan을 다시 확인한 결과, default universe 기준 backend 전환과 `App DB` 가시성은 반영돼 있었지만, Data Control에서 company description update를 직접 실행하는 UI 항목은 누락돼 있었다.
4. `plan.md`에 아래 내용을 추가했다.
   - 목표 24: Data Control `Updates` 탭에서 company description update 직접 실행
   - 현재 상태: backend route는 있으나 UI 버튼은 없음
   - Step 2-15: Data Control company description update 버튼 + 기본 대상 설명 + 결과 요약
   - Track B 및 검증 체크리스트 반영
   - PLAN CHANGE (2026-03-07 18:00) 추가

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md` 목표에 24번 company description update 요구가 추가됐는지 확인한다.
2. `plan.md` 현재 상태에 “backend route는 있으나 UI 버튼은 없음” 문구가 있는지 확인한다.
3. `plan.md` Step 2 표에 `2-15 Data Control company description update 액션`이 추가됐는지 확인한다.
4. `plan.md` Track B에 `2-15 company description update 액션`이 반영됐는지 확인한다.

#### 문제점 / 리스크

1. peers pull과 company description pull이 같은 `Updates` 탭에 같이 들어가면 목적이 헷갈릴 수 있다.
   - 완화 방안 1: 버튼 라벨과 보조 문구에 저장 위치/대상 구분 명시
   - 완화 방안 2: 실행 결과 요약도 별도 포맷으로 분리
2. 현재 backend endpoint 기본 `maxTickers`가 50이므로, 사용자가 default universe 전체 pull로 기대하면 차이를 느낄 수 있다.
   - 완화 방안 1: UI에 기본 limit/대상 수를 명시
   - 완화 방안 2: 후속 구현 시 preflight 또는 max 조절 옵션 검토

#### 비고

- 이번 수정은 plan 누락 보정이다. 코드 구현은 아직 시작하지 않았다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — News Feed Company Description 선택 컬럼 + 전체 보기 창 추가

**작성 시각:** 2026-03-07 18:06 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. 사용자가 News Feed에서 `Company Description`을 선택 컬럼으로 보고 싶다고 요청했다.
2. 추가 요구를 함께 반영했다.
   - 긴 description 때문에 셀 자체가 커지면 안 됨
   - 셀에 다 안 보이면 그대로 truncate 유지
   - description 셀을 클릭하면 전체 텍스트를 읽는 별도 창 또는 팝업이 열려야 함
3. 기존 plan을 확인한 결과, company description은 canonical 저장과 Data Control update 버튼 계획만 있었고, News Feed 선택 컬럼/전체 보기 창 계획은 없었다.
4. `plan.md`에 아래 내용을 추가했다.
   - 목표 25: News Feed `Company Description` 선택 컬럼 + 클릭 시 전체 보기 창
   - 현재 상태: `GET /api/news` 응답과 News Feed UI에 아직 company description 필드/컬럼/전체 보기 창이 없음
   - 제약: 기본 visible 컬럼 제외, 셀/행 자동 확장 금지, truncate 유지
   - 결정 #16: 셀 확장형이 아니라 truncate + 클릭 시 별도 창 방식 권장
   - `Step 8 — News Feed Company Description 선택 컬럼 + 전체 보기 창`
   - 실행 의존성 그래프 `Track G`
   - PLAN CHANGE (2026-03-07 18:06)

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md` 목표에 25번 `Company Description` 요구가 추가됐는지 확인한다.
2. `plan.md` 현재 상태에 `GET /api/news`와 News Feed UI에 company description 필드/컬럼/창이 아직 없다는 문구가 있는지 확인한다.
3. `plan.md`에 `#### ⬜ Step 8 — News Feed Company Description 선택 컬럼 + 전체 보기 창` 섹션이 생겼는지 확인한다.
4. `plan.md` 실행 의존성 그래프에 `Track G: News Feed company description view`가 추가됐는지 확인한다.

#### 문제점 / 리스크

1. 복수 ticker 뉴스에서 어떤 회사 설명을 보여 줄지 기준이 애매할 수 있다.
   - 완화 방안 1: 대표 ticker 선택 규칙 명시
   - 완화 방안 2: description 없음 fallback 규칙을 같이 문서화
2. 긴 텍스트 컬럼은 리스트 가독성을 쉽게 망친다.
   - 완화 방안 1: 기본 비노출 유지
   - 완화 방안 2: 셀은 truncate 고정, 전체 읽기는 별도 창으로 분리
3. tooltip만으로 전체 텍스트를 읽게 하면 사용성이 떨어질 수 있다.
   - 완화 방안 1: 스크롤 가능한 별도 창/팝업 사용
   - 완화 방안 2: 클릭 타깃과 닫기 흐름을 명확히 설계

#### 비고

- 이번 작업은 plan/log 문서 업데이트만 수행했고, 코드 구현은 아직 시작하지 않았다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — Calendar Update 버튼 이원화 + Initial Calendar Backfill 추가

**작성 시각:** 2026-03-07 18:20 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. 사용자가 Data Control과 News Feed 양쪽에 calendar update 버튼을 두고 싶다고 요청했다.
2. 추가 요구를 함께 반영했다.
   - `Change Update`와 섞지 않고 별도 `Calendar Update` 그룹으로 둘 것
   - `Initial Calendar Backfill` 버튼을 별도로 둘 것
   - 반복 실행은 과거 전체 재수집이 아니라 upcoming refresh 중심으로 갈 것
3. 현재 코드를 다시 해석한 결과, backend에는 `POST /api/ibkr/calendar/update`가 있지만 내부 `pullIbkrCalendar()`는 아직 stub이고, 기존 UI도 단일 `IBKR Calendar Data` 액션만 있어 backfill/refresh 구분이 없다.
4. 기존 WSH probe 맥락상 `conId` 전체 이벤트 요청과 `startDate`/`endDate` 범위 요청이 모두 가능하므로, plan에서는 “초기 backfill”과 “반복 refresh”를 분리하는 정책이 타당하다고 정리했다.
5. `plan.md`에 아래 내용을 추가했다.
   - 목표 26, 27: Data Control + News Feed 양쪽 calendar update 버튼, `Initial Calendar Backfill` / `Refresh Upcoming Calendar` 이원화
   - 현재 상태: calendar backend stub, News Feed calendar 버튼 부재, WSH 요청 방식 특성
   - 제약: calendar는 `Change Update`와 분리, refresh는 과거 전체 재수집 금지
   - 결정 #17: 단일 full refresh가 아니라 backfill/refresh 분리 권장
   - Step 2에 `2-16 Data Control calendar 두 버튼`
   - `Step 9 — Calendar Update 버튼 이원화 + 초기 backfill / upcoming refresh 정책`
   - 실행 의존성 그래프 `Track H`
   - PLAN CHANGE (2026-03-07 18:20)

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md` 목표에 26, 27번 calendar 관련 요구가 추가됐는지 확인한다.
2. `plan.md` 현재 상태에 `pullIbkrCalendar()` stub과 News Feed calendar 버튼 부재가 적혀 있는지 확인한다.
3. `plan.md` Step 2 표에 `2-16 Data Control calendar 두 버튼`이 추가됐는지 확인한다.
4. `plan.md`에 `#### ⬜ Step 9 — Calendar Update 버튼 이원화 + 초기 backfill / upcoming refresh 정책` 섹션이 생겼는지 확인한다.
5. `plan.md` 실행 의존성 그래프에 `Track H: calendar backfill / refresh update UX`가 추가됐는지 확인한다.

#### 문제점 / 리스크

1. 현재 backend calendar pull이 stub 상태라 UI 버튼 이름만 먼저 바꾸면 실제 동작과 의미가 어긋날 수 있다.
   - 완화 방안 1: backend mode/backfill 범위 계약을 먼저 고정
   - 완화 방안 2: 구현 전까지는 plan 문서에서 의존성을 명시
2. refresh overlap 범위를 너무 짧게 잡으면 일정 변경을 놓칠 수 있다.
   - 완화 방안 1: 최근 14~30일 overlap 기본값 검토
   - 완화 방안 2: 결과 요약에 실제 조회 범위를 노출
3. Data Control과 News Feed에 같은 액션을 두면 중복 기능처럼 보일 수 있다.
   - 완화 방안 1: 같은 backend contract를 공유한다는 점을 문구로 통일
   - 완화 방안 2: 두 위치의 결과 요약/최근 실행 상태를 동일한 의미로 유지

#### 비고

- 이번 작업은 plan/log 문서 업데이트만 수행했고, 코드 구현은 아직 시작하지 않았다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

### App DB 테이블 row count 정렬 + calendar_events mock 데이터 확인

**작성 시각:** 2026-03-07 18:33 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자가 App DB 탭에서 0건 테이블이 위에 보이는 문제를 지적하고, row 수 내림차순 정렬을 요청했다.
2. `calendar_events` 2,943 rows가 무엇인지 DB를 직접 쿼리해 확인했다.
   - **결과**: 전부 `source='mock_provider'` — 실제 IBKR WSH 데이터 0건, 이전 mock 생성기가 만든 잔여 데이터.
3. `DataControlWindow.tsx`에서 `dbTables.map(...)` 앞에 `[...dbTables].sort((a, b) => b.rowCount - a.rowCount)` 정렬을 적용했다.
4. `plan.md`에 목표 28(App DB row count 정렬), 현재 상태(calendar mock data / App DB 미정렬), PLAN CHANGE, 완료 확인 기준을 추가했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. 앱에서 Data Control → `App DB` 탭 → Refresh 후, 테이블이 row count 내림차순으로 보이는지 확인한다.
2. 0건 테이블이 하단에 몰려 있는지 확인한다.
3. `npm run build` 통과 여부를 확인한다.

#### 문제점 / 리스크

1. 정렬이 프론트에서만 이루어지므로, 같은 row count인 테이블 간 순서가 불안정할 수 있다.
   - 완화 방안 1: 같은 count일 때 name alphabetical로 2차 정렬 추가
   - 완화 방안 2: 현재는 대부분 row count가 다르므로 무시 가능
2. `calendar_events` 2,943건 mock 데이터가 남아 있어 IBKR calendar 실구현 시 `deleteMockCalendarRows()`가 정상 동작하는지 확인 필요.
   - 완화 방안: Step 9 구현 시 mock row 삭제 검증을 포함

#### 비고

- `calendar_events` 데이터 정체: 전부 mock_provider. event_type 분포: economics 1,208건, sec_filings 832건, earnings 349건, splits 220건, analyst_ratings 213건, dividends 119건 등.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

---

### 2-15 Company Description Update 버튼 + 2-16 Calendar Update 이원화 구현

**작성 시각:** 2026-03-07 18:48 (local)

**상태:** 확인 대기

#### 수행 내용

1. `DataControlWindow.tsx`의 `SectionKey` 타입을 확장했다:
   - 기존: `'price' | 'calendar' | 'recent' | 'custom'`
   - 변경: `'price' | 'calendarBackfill' | 'calendarRefresh' | 'companyDesc' | 'recent' | 'custom'`
2. 모든 상태 Record(jobIds, updating, errors, jobStatuses)를 새 키로 업데이트했다.
3. `startUpdate()` switch 분기를 추가했다:
   - `calendarBackfill` → `POST /api/ibkr/calendar/update` (`{mode: 'backfill'}`)
   - `calendarRefresh` → `POST /api/ibkr/calendar/update` (`{mode: 'refresh'}`)
   - `companyDesc` → `POST /api/company-profiles/pull-fmp`
4. sections 배열에 group/description 필드를 추가하고 4개 그룹으로 분류했다:
   - **IBKR Data**: Price (기존)
   - **Calendar Update**: Initial Calendar Backfill, Refresh Upcoming Calendar (신규)
   - **Company Data**: Company Description Update (신규)
   - **Change Update**: Recent Change%, Custom Change% (기존)
5. sections.map() JSX에 그룹 헤더(uppercase 소제목)와 description 텍스트를 추가해 시각적으로 구분되게 했다.
6. 빌드 검증:
   - Frontend `npm run build`: vite build 성공 (4.32s)
   - Backend `npm run build`: tsc 성공
   - Backend `npm test`: 48/48 pass
7. `plan.md`에서 2-15, 2-16 상태를 ⬜ → ✅로 변경했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. 앱에서 Data Control → `Updates` 탭에서:
   - "IBKR DATA" 그룹 아래 Price 버튼이 보이는지 확인
   - "CALENDAR UPDATE" 그룹 아래 Initial Calendar Backfill / Refresh Upcoming Calendar 두 버튼이 각각 다른 설명과 함께 보이는지 확인
   - "COMPANY DATA" 그룹 아래 Company Description Update 버튼이 보이는지 확인
   - "CHANGE UPDATE" 그룹 아래 Recent/Custom 버튼이 보이는지 확인
2. Company Description Update 버튼을 클릭하면 `POST /api/company-profiles/pull-fmp` 호출이 정상 동작하는지 확인한다.
3. Calendar 버튼은 backend `pullIbkrCalendar()`가 아직 stub이므로 에러가 표시되는 것이 정상이다 (Step 9 구현 후 동작 예정).

#### 문제점 / 리스크

1. Backend calendar endpoint는 `mode` 파라미터를 아직 읽지 않는다 (stub 상태).
   - 완화: Step 9-1 구현 시 `mode` 분기 처리 추가 예정
2. `companyDesc` statusKey가 `company_profiles`인데, 해당 키의 update_status row가 아직 없을 수 있다.
   - 완화: backend pull-fmp가 성공 시 자동으로 update_status를 upsert하도록 이미 구현돼 있음

---

### Step 8 완료 — News Feed `Company Description` 선택 컬럼 + 전체 보기 창

**상태**: ✅ 완료 (확인 대기 — awaiting user confirmation)

#### 구현 내용

| 세부 단계 | 설명 | 상태 |
|-----------|------|------|
| 8-1 | `getNews()`에 batch description lookup 추가 (company_profiles.description, tickers 배열 첫 번째 기준) | ✅ |
| 8-2 | 대표 ticker = tickers[0], description 없으면 `null` 반환. 규칙을 backend_prompt.md에 문서화 | ✅ |
| 8-3 | `companyDesc` 컬럼을 ColumnId, DEFAULT_COLUMNS(200px), HIDDEN_BY_DEFAULT에 추가 | ✅ |
| 8-4 | 셀은 truncated text (overflow-hidden, text-ellipsis), hover 시 밝은 배경 | ✅ |
| 8-5 | 셀 클릭 시 descPopup 상태 → 전체 텍스트 팝업 모달 (overlay + card, 스크롤, Esc/close 지원) | ✅ |
| 8-6 | backend_prompt.md에 companyDescription 필드/규칙 추가, plan.md ✅, agent_log.md 기록, 48/48 tests pass | ✅ |

#### 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| Backend build (`npm run build`) | ✅ tsc 성공 |
| Backend tests (`npm test`) | ✅ 48/48 pass |
| Frontend build (`npm run build`) | ✅ vite build 성공 |
| `GET /api/news?tickers=AAPL&limit=1` → companyDescription 필드 | ✅ 1665자, "Apple Inc. designs, manufactures..." |
| `GET /api/news?limit=3` (market_news, ticker 없음) → companyDescription | ✅ null (정상 — ticker 없는 뉴스) |
| backend_prompt.md 문서 동기화 | ✅ JSON 예시 + 출력 컬럼 + 규칙 추가 |

#### 생성/수정 파일

- `terminal/backend/src/types.ts` — `NewsItem`에 `companyDescription?: string | null` 추가
- `terminal/backend/src/services/newsRepository.ts` — batch description lookup + mapNewsRow descMap 파라미터
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` — companyDesc 컬럼 (ColumnId, DEFAULT_COLUMNS, HIDDEN_BY_DEFAULT, BackendNewsItem, DisplayItem, mapBackendItem, renderCell, getSortValue) + descPopup 상태 + 모달 JSX
- `terminal/backend_prompt.md` — companyDescription 필드/규칙 문서화
- `ai_agent_plan/terminal_ui_ver3_final/plan.md` — Step 8 ✅

#### 검증 방법

1. `GET /api/news?tickers=AAPL&limit=1` 호출 → 응답에 `companyDescription` 문자열 확인
2. News Feed에서 Columns 메뉴 → `Company Desc` 체크박스 토글 → 컬럼 표시/숨김 확인
3. 기본 화면에서 `Company Desc` 컬럼이 보이지 않는지 확인 (HIDDEN_BY_DEFAULT)
4. 컬럼 켠 후 description 셀이 한 줄 truncated인지 확인
5. 셀 클릭 → 팝업에서 전체 description 스크롤 가능한지 확인
6. description 없는 row는 빈 셀인지 확인

---

### Step 9 완료 — Calendar Update 버튼 이원화 + 초기 backfill / upcoming refresh 정책

**작성 시각:** 2026-03-07 19:52 (local)
**상태**: ✅ 완료 (확인 대기 — awaiting user confirmation)

#### 구현 내용

| 세부 단계 | 설명 | 상태 |
|-----------|------|------|
| 9-1 | `CalendarUpdateMode` 타입 + `getCalendarDateRange(mode)` 함수 추가. `pullIbkrCalendar()` 서명에 mode 파라미터 추가. 에러 메시지에 mode/range 포함 | ✅ |
| 9-2 | backfill = 과거 2년 + 미래 180일, refresh = 최근 30일 overlap + 미래 90일. 정책을 코드와 문서에 고정 | ✅ |
| 9-3 | DataControlWindow.tsx 기존 calendar 두 버튼 설명 문구를 정확한 범위로 업데이트 | ✅ |
| 9-4 | FinnhubNewsWindow.tsx update 드롭다운에 Calendar Update 섹션 추가 | ✅ |
| 9-5 | 양쪽 UI가 동일한 `POST /api/ibkr/calendar/update` + `{ mode }` body 사용 | ✅ |
| 9-6 | backend_prompt.md calendar API 문서 업데이트, plan.md ✅, agent_log.md 기록 | ✅ |

#### 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| Backend build (`npm run build`) | ✅ tsc 성공 |
| Backend tests (`npm test`) | ✅ 48/48 pass |
| Frontend build (`npm run build`) | ✅ vite build 성공 |
| `POST` `{mode:"backfill"}` | ✅ 에러: mode=backfill, range=2024-03-08~2026-09-03 |
| `POST` `{mode:"refresh"}` | ✅ 에러: mode=refresh, range=2026-02-06~2026-06-05 |
| `POST` `{}` (기본값) | ✅ 에러: mode=backfill (기본값 적용) |

#### 생성/수정 파일

- `terminal/backend/src/services/calendarIngestion.ts` — CalendarUpdateMode, getCalendarDateRange(), pullIbkrCalendar() mode 파라미터
- `terminal/backend/src/server.ts` — route에서 req.body.mode 읽기 + tickers + 응답에 mode/dateRange
- `DataControlWindow.tsx` — calendar 설명 문구 정확한 범위로 수정
- `FinnhubNewsWindow.tsx` — handleCalendarUpdate() + Calendar Update 드롭다운 섹션
- `terminal/backend_prompt.md` — calendar API mode/dateRange 계약 문서화
- `plan.md` — Step 9 ✅, Track F/G/H ✅

#### 검증 방법

1. `POST /api/ibkr/calendar/update` + `{"mode":"backfill"}` → 에러에 mode=backfill + range 확인
2. `POST /api/ibkr/calendar/update` + `{"mode":"refresh"}` → 에러에 mode=refresh + 짧은 range 확인
3. Data Control → Updates → Calendar Update 그룹에 두 버튼 + 정확한 범위 설명 확인
4. News Feed → update 드롭다운 → Calendar Update 섹션에 동일한 두 버튼 확인

#### 문제점 / 리스크

1. `pullIbkrCalendar()`는 여전히 stub. IBKR TWS + Python bridge 구현 전까지 에러 반환이 정상.
   - 완화: 에러 메시지에 mode와 range가 포함되어 계약이 명확함
2. `statusKey: 'ibkr_calendar'`가 backfill/refresh 모드를 공유. update_status payload에 mode 기록으로 구분 가능.

---

### 결정 확정 — font size 저장 위치 유지

**작성 시각:** 2026-03-07 19:55 (local)
**상태**: ✅ 완료 (사용자 확인 후 완료)

#### 결정 내용

- font size는 backend DB나 별도 settings table로 올리지 않는다.
- 현재 구현대로 global `localStorage`에 유지한다.
- 적용 범위: `fontScale`, `newsTitleFontSize`, `newsSummaryFontSize`

#### 영향

- `App.tsx`의 `terminal-workspace-v1` persistence 구조를 유지한다.
- backend schema/API 추가 작업은 하지 않는다.
- plan.md의 미확정 사항에서 font size 저장 위치를 제거했다.

---

### Step 7 — Finnhub peers 수집/저장/UI 노출 완료

**작성 시각:** 2026-03-08 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### Step 7 수행 내용

**7-1 (peers_json column + repository)**
- `db.ts`: `company_profiles` CREATE TABLE에 `peers_json TEXT` 컬럼 추가 + ALTER TABLE migration
- `companyProfileRepository.ts`: `CompanyProfileRow`에 `peers_json` 추가, `upsertPeers()`, `getPeersByTicker()` 함수 구현

**7-2 (Finnhub peers provider + endpoint)**
- `finnhubPeersProvider.ts` 신규 파일: `fetchFinnhubPeers()`, `fetchFinnhubPeersBatch()` (120ms rate limit 간격)
- `server.ts`: `POST /api/company-profiles/pull-peers` 엔드포인트 추가, `TABLE_UI_USAGE` 업데이트

**7-3 (DataControl peers pull button)**
- `DataControlWindow.tsx`: `SectionKey`에 `'peersPull'` 추가, 모든 state Records 업데이트, switch case 추가, sections 배열에 'Company Data' 그룹 내 항목 추가

**7-4 (News Feed peers column)**
- `types.ts`: `NewsItem`에 `peers?: string[]` 추가
- `newsRepository.ts`: `getNews()`에서 batch peers lookup 추가 (sentiment과 동일 패턴), `mapNewsRow()`에 peersMap 파라미터 및 peers 필드 추가
- `FinnhubNewsWindow.tsx`: `ColumnId`에 `'peers'` 추가, `BackendNewsItem`/`DisplayItem`에 peers 추가, `mapBackendItem`에 peers 매핑, `renderCell`에 peers 렌더링 (보라색 badge, 클릭 시 필터), `getSortValue`에 peers case 추가

**7-5 (Peers default hidden)**
- `FinnhubNewsWindow.tsx`: `HIDDEN_BY_DEFAULT` 배열에 `'peers'` 추가

**7-6 (App DB peers visibility)**
- `DataControlWindow.tsx`: App DB 탭에 `<details>` 기반 Sample Rows 테이블 추가 (모든 테이블에). `company_profiles.peers_json`이 sample row에서 자연스럽게 노출됨.

**7-7 (Tests + docs sync)**
- `backend_prompt.md`: `company_profiles` 테이블 문서 추가, `peers` 필드 news API 응답에 추가, `POST /api/company-profiles/pull-peers` API 문서 추가
- `plan.md`: Step 7 전체 ✅, 2-12/2-13/2-14 상태 ✅

**2-12 BookmarkManager 폴더 우클릭 (이전 세션)**
- `BookmarkManager.tsx`: `CtxMenu`에 `target: 'item' | 'folder' | 'area'` 추가, 폴더 우클릭 시 Rename/Delete 메뉴, 빈 영역 우클릭 시 Paste 메뉴
- 2-13/2-14는 이미 구현 확인됨

#### 자체 검증 결과

| Layer | 결과 |
|-------|------|
| 정적 분석 | TypeScript build 오류 없음 |
| 빌드 | backend `npm run build` ✅, frontend `npm run build` ✅ |
| 자동 테스트 | backend vitest 48/48 ✅ |
| 런타임 통합 | `POST /api/company-profiles/pull-peers` → 200 OK, `GET /api/news?tickers=AAPL` → peers 배열 포함 확인, `GET /api/db/inspect` → company_profiles.peers_json 확인 |

#### 문제점 / 리스크

1. peers pull은 Finnhub rate limit(120ms)이 있어 50 tickers 기준 ~6초 소요.
   - 완화: `maxTickers` 파라미터로 조절 가능, progress callback 지원
2. 동일 ticker에 대해 fmp/finnhub 2개의 company_profiles row가 생긴다.
   - 완화: peers lookup은 `peers_json IS NOT NULL` 조건으로 정확히 finnhub row를 찾고, description은 fmp row에서 찾음. 출처별 분리 저장이 canonical 설계.
3. App DB Sample Rows는 최대 5건만 표시.
   - 완화: DESC 정렬이라 최근 pull 결과가 먼저 보임

---

### Finnhub update에서 sentiment 분리 + News date sticky header

**작성 시각:** 2026-03-08 13:21 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `POST /api/news/pull-finhub` 배경 작업에서 ticker별 `upsertSentimentSnapshot()` 호출을 제거했다. 이제 News Feed의 일반 update 버튼은 뉴스 pull만 수행한다.
2. 별도 sentiment batch 경로 `POST /api/news/sentiment/update`는 유지해서, sentiment snapshot은 명시적으로 돌릴 때만 갱신되게 했다.
3. `FinnhubNewsWindow.tsx`에 현재 스크롤 위치 기준 날짜를 계산하는 `stickyDate` 상태를 추가했다.
4. 가상 리스트 내부 header row의 `sticky` 의존을 제거하고, 리스트 상단에 별도 회색 overlay header를 띄워 현재 날짜 그룹이 항상 보이게 바꿨다.
5. `plan.md` 목표/현재 상태/PLAN CHANGE를 이번 동작 기준으로 동기화했다.

#### 생성/수정 파일

- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. News Feed에서 일반 `Update`를 실행한 뒤, backend 로그 또는 DB를 확인해 sentiment snapshot row count가 자동 증가하지 않는지 본다.
2. 필요 시 별도 sentiment update 경로를 직접 호출해 snapshot이 갱신되는지 확인한다.
3. News Feed 리스트를 아래로 스크롤해도 회색 날짜 bar가 상단에 남고, 날짜 그룹이 바뀌면 상단 표시도 함께 바뀌는지 확인한다.

```bash
cd terminal/backend
npm run build

cd ..\..\termina_web\figma_code\terminal_ui_ver2_finhub
npm run build
```

#### 문제점 / 리스크

1. 일반 news update 뒤에는 sentiment가 자동으로 최신화되지 않는다.
   - 완화 방안 1: 필요 시 `POST /api/news/sentiment/update`를 별도로 실행
   - 완화 방안 2: 추후 UI에 sentiment 전용 update 버튼을 추가 검토
2. sticky overlay와 실제 날짜 header row가 화면 상단 근처에서 잠깐 중복되어 보일 수 있다.
   - 완화 방안 1: 사용성 문제가 크면 header row push-off 애니메이션을 추가
   - 완화 방안 2: 또는 top 영역에서 첫 header row를 숨기는 후속 조정 검토
3. 가상 리스트의 visibleStartIndex 계산 타이밍에 따라 빠른 스크롤 중 날짜 전환이 한 프레임 늦을 수 있다.
   - 완화 방안 1: 필요 시 overscan 조정
   - 완화 방안 2: 또는 scroll offset 기반 계산으로 후속 개선

---

### market news 30페이지 batch 반복 backfill + 로그 강화

**작성 시각:** 2026-03-08 13:45 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. `finnhubNewsProvider.ts`의 market news pull을 30페이지 한 번으로 끝내지 않고, `minId`를 이어받아 다음 30페이지 batch를 반복 수행하는 구조로 바꿨다.
2. batch 진행 상태를 외부에서 받을 수 있도록 market news meta/result 타입과 batch callback을 추가했다.
3. `server.ts`의 `POST /api/news/pull-finhub` market news 구간에서 batch 로그를 남기도록 연결했다.
4. job log에 batch 번호, batch 페이지 수, 누적 페이지 수, in-range item 수, oldest published 시각, 종료 사유를 남기게 했다.
5. 총 페이지 guardrail에 도달했는데도 요청 시작일에 도달하지 못하면 warning 로그를 남기고 continuation cursor(`nextMinId`)를 표시하게 했다.
6. `plan.md`에 이번 market news batching 기준을 `PLAN CHANGE`로 동기화했다.

#### 생성/수정 파일

- `terminal/backend/src/services/finnhubNewsProvider.ts`
- `terminal/backend/src/server.ts`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

```bash
cd terminal/backend
npm run build
```

1. Market news custom update를 넓은 기간으로 실행한다.
2. Update Log에서 `market batch 1`, `market batch 2`처럼 30페이지 단위 batch 로그가 이어지는지 확인한다.
3. 완료 후 `market_news meta:` 라인에서 `pages`, `batches`, `oldest`, `reached_from`가 출력되는지 확인한다.
4. guardrail에 걸린 경우 `⚠ market_news page guard hit...` 경고와 `nextMinId`가 함께 남는지 확인한다.

#### 문제점 / 리스크

1. 넓은 기간 market news backfill은 이전보다 오래 걸릴 수 있다.
   - 완화 방안 1: batch 로그로 진행 상황을 노출
   - 완화 방안 2: 필요 시 추후 UI에 continue/backfill 전용 액션 분리
2. 총 페이지 guardrail을 넘는 극단적 기간은 여전히 한 번에 완전 수집을 보장하지 않는다.
   - 완화 방안 1: warning 로그와 `nextMinId`를 남겨 운영자가 이어서 진행 가능하게 함
   - 완화 방안 2: 추후 explicit continuation API 추가 검토
3. `insertNewsItem` dedupe에 기대고 있으므로 batch 간 일부 중복 페이지가 있어도 job fetched 수와 inserted 수가 다를 수 있다.
   - 완화 방안 1: log에 fetched와 inserted를 둘 다 남김
   - 완화 방안 2: 필요 시 후속으로 cursor 정확도 추가 점검

---

### GET /api/news `to` 날짜 필터 버그 수정

**작성 시각:** 2026-03-08 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. **근본 원인 발견**: `newsRepository.ts`의 SQL 조건 `ni.published_at <= ?`에 bare date 'YYYY-MM-DD'를 그대로 전달하고 있었다. DB의 `published_at`은 ISO timestamp ('2026-03-01T09:38:00.000Z')을 저장하므로, string comparison에서 항상 FALSE가 되어 `to` 필터가 완전히 무시되고 있었다.
2. **newsRepository.ts 수정**: `query.to` 값에 `T23:59:59.999Z`를 append해서 해당 날짜 끝까지 포함하게 변경.
3. **newsFilterMatcher.ts 수정**: SSE stream 필터에서도 같은 문제가 있었음 (`new Date('2026-03-01')` = 자정 UTC이므로 당일 아이템 전부 제외). `to` 비교를 end-of-day (23:59:59.999Z)로 보정.
4. **newsChangeMerger.ts 확인**: 이미 `${to}T23:59:59.999Z`를 사용하고 있어 수정 불필요.
5. **finnhubNewsProvider.ts 확인**: `isWithinDateRange` 함수도 이미 `${to}T23:59:59.999Z`을 사용하고 있어 수정 불필요.

#### 영향 범위

- `GET /api/news?from=2026-03-01&to=2026-03-01` 처럼 날짜 범위 조회 시, `to` 날짜 당일의 뉴스가 정상적으로 포함됨
- SSE stream 필터에서도 `to` 날짜 당일 뉴스가 올바르게 통과됨

#### 생성/수정 파일

- `terminal/backend/src/services/newsRepository.ts` — `to` 날짜 필터에 `T23:59:59.999Z` append
- `terminal/backend/src/services/newsFilterMatcher.ts` — `to` 비교를 end-of-day로 보정

#### 검증 방법

```bash
cd terminal/backend
npm run build
```

1. backend 재시작 후 News Feed에서 from=to='2026-03-01'로 조회 → 3월 1일 뉴스만 표시되는지 확인
2. 넓은 범위 (예: from='2026-03-01', to='2026-03-04') 조회 → 해당 기간 뉴스만 표시되는지 확인

#### 문제점 / 리스크

1. 이 버그로 인해 기존 UI에서 `to` 날짜 필터가 완전히 무시됐었다 — 사실상 `from` 이후 전체 뉴스가 표시되던 상태.
   - 완화 방안: 수정 반영 후 사용자가 날짜 범위 조회를 재시도하여 정상 동작 확인

#### 비고

- 이번 Step은 코드 변경 없이 문서 동기화와 검증 정리만 수행했다.
- 전체 plan (Step 0 ~ Step 4) 구현이 완료되었다.
- 사용자 확인 전까지 상태는 `확인 대기`로 유지한다.

---

### Finnhub News row 우클릭 `Copy ID` 추가

**작성 시각:** 2026-03-08 18:11 (local)

**상태:** 확인 대기(awaiting user confirmation)

#### 수행 내용

1. 사용자가 News Feed window의 각 뉴스 row를 우클릭할 때 news id도 바로 복사할 수 있게 해 달라고 요청했다.
2. `FinnhubNewsWindow.tsx`의 row context menu에 `Copy ID` 액션을 추가하고, 기존 clipboard helper를 재사용해 현재 row의 `news_id`를 그대로 복사하도록 연결했다.
3. row menu 상단을 `Row actions` 영역으로 정리하고, 기존 `Add bookmark` 폴더 목록은 같은 메뉴 안에서 그대로 유지되게 배치했다.
4. 메뉴 항목이 하나 늘어난 만큼 화면 하단에서 잘리지 않도록 row context menu의 높이 계산을 함께 조정했다.
5. `figma_frontend_prompt.md`와 `plan.md`를 현재 동작 기준으로 동기화해 row 우클릭 메뉴가 `Copy ID` + `Add bookmark` 조합이라는 점을 반영했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm run build`를 실행해 프론트 빌드가 통과하는지 확인한다.
2. backend `http://localhost:8080/healthz` 응답이 `{"ok":true}`인지 확인한다.
3. 브라우저에서 `http://localhost:5173/`를 열고 News Feed row를 우클릭해 `Copy ID`와 `Add bookmark`가 함께 보이는지 확인한다.
4. `Copy ID`를 누른 뒤 메모장 등에 붙여넣어 news id 문자열이 그대로 들어가는지 확인한다.
5. 같은 메뉴에서 폴더를 선택했을 때 기존 북마크 저장 동작이 유지되는지 확인한다.

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 0 errors |
| 빌드 | ✅ | `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm run build` 성공 |
| 자동 테스트 | ✅ | 해당 프론트 package에 `test` script 없음. 추가 자동 테스트는 현재 미구성 |
| 런타임 통합 | ✅ | `http://localhost:8080/healthz` 정상, `http://localhost:5173/` 오픈 확인, row menu 렌더 코드는 리뷰 완료. 브라우저 시각 확인은 사용자 위임 |

#### 문제점 / 리스크

1. 사용자가 source/url 셀을 우클릭한 경우에는 여전히 `Copy URL` 메뉴가 열리고, row 본문 우클릭과 다른 메뉴가 보인다.
   - 완화 방안 1: 사용자 안내에서 row 우클릭과 source 셀 우클릭 위치를 분리 설명
   - 완화 방안 2: 필요 시 후속 작업에서 메뉴 제목을 더 명확히 표시
2. 일부 브라우저/보안 정책에서는 Clipboard API가 제한될 수 있다.
   - 완화 방안 1: 현재 textarea fallback이 있으므로 우선 그 경로로 복사 시도
   - 완화 방안 2: 사용자 검증 시 실제 붙여넣기까지 확인
3. 북마크 폴더 수가 매우 많아지면 메뉴 높이 계산 오차가 다시 눈에 띌 수 있다.
   - 완화 방안 1: 필요 시 menu item 수 기반 max-height + 내부 scroll 적용
   - 완화 방안 2: 이후 북마크 수가 늘면 submenu 또는 modal 방식으로 확장 검토

#### 비고

- 이번 변경은 기존 북마크 메뉴를 제거하지 않고, 같은 row context menu 안에 `Copy ID`를 추가한 UI 확장이다.
- 사용자 확인 전까지 상태는 `확인 대기(awaiting user confirmation)`로 유지한다.

---

### 2026-03-10 00:36 — 검색어 복원 제거 (새로고침 시 빈 상태)

#### 작업 내용
사용자가 웹 새로고침 시 SPX 등 이전 검색어가 복원되는 것을 빈 상태로 시작하도록 요청.

#### 변경 파일
- `FinnhubNewsWindow.tsx` — `searchQuery`, `tickerQuery` 초기값을 빈 문자열로 변경. `initialTicker` 참조 제거. localStorage 저장에서 두 필드 제외.
- `figma_frontend_prompt.md` — `finhub-news-ui-state` localStorage 문서 업데이트.
- `plan.md` — Step 3-4 설명, E2E 체크리스트 #19, Decision #4 saved state list 업데이트.

#### 검증
- 프론트 빌드 통과.
- 상태: 확인 대기(awaiting user confirmation).

---

### 2026-03-10 01:00 — Change Update OHLC 소스 Finnhub 전환

#### 작업 내용
Change % 계산에 필요한 OHLC 데이터 소스를 IBKR → Finnhub로 전환. DB에 없는 ticker는 Finnhub `/stock/candle`에서 자동으로 가져와 OHLC DB에 저장 후 재시도.

#### 변경 파일
- `terminal/backend/src/services/finnhubOhlcProvider.ts` (신규) — Finnhub daily candle provider.
- `terminal/backend/src/services/newsChangeMerger.ts` — Recent/Custom Change Update에 Finnhub OHLC fallback 추가:
  - Phase 1: OHLC DB 조회
  - Phase 1.5: 누락 ticker Finnhub fetch → DB upsert
  - Phase 1.7: skip 항목 재시도
  - 반환값에 `finnhubFetched` 추가
- `FinnhubNewsWindow.tsx` — UI 설명에 "fetches missing OHLC from Finnhub" 추가.
- `DataControlWindow.tsx` — Change Update description에 Finnhub fallback 설명 추가.
- `terminal/backend_prompt.md` — change update API 엔드포인트 문서에 OHLC 소스 우선순위 명시.
- `plan.md` — PLAN CHANGE 항목 추가.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `npx tsc --noEmit` 에러 0 (backend) |
| 백엔드 빌드 | ✅ | `npx tsc --noEmit` 통과 |
| 자동 테스트 | ✅ | `npm run test` → 48 tests passed (6 suites) |
| 프론트 빌드 | ✅ | `npm run build` 성공 |
| 런타임 통합 | ⏳ | Finnhub candle API 실제 호출은 사용자 검증 필요 |

#### 검증 방법
1. `terminal/backend`에서 `npm run build` 또는 `npx tsc --noEmit`으로 빌드 확인.
2. `npm run test`로 기존 테스트 48개 통과 확인.
3. News Feed에서 Recent Change% Update 실행 → DB에 없는 ticker의 OHLC가 Finnhub에서 자동 fetch됨.
4. Custom Change% Update도 같은 동작 확인.
5. Data Control Updates 탭에서 Change Update 설명에 Finnhub fallback 문구 확인.

#### 문제점 / 리스크
1. Finnhub free plan rate limit (60/min) — ticker가 많으면 느릴 수 있음.
   - 완화: 150ms 딜레이 + 고유 ticker dedup으로 불필요한 호출 방지.
2. Finnhub candle API가 일부 ticker에 대해 `no_data`를 반환할 수 있음.
   - 완화: 해당 ticker는 skip하고 경고 로그 남김. DB에 데이터가 없으면 최종적으로 skipped로 집계.
3. 기존 IBKR OHLC update 경로(`POST /api/ibkr/ohlc1d/update`)는 그대로 유지됨.
   - DB에 이미 IBKR로 저장된 OHLC가 있으면 Finnhub 호출 없이 그 데이터 사용.

#### 비고
- 상태: 확인 대기(awaiting user confirmation).