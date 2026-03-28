# Investing News Window Plan

### 목표
- Investing 사이트 뉴스 전용 `Investing News Window`를 추가한다.
- 새 창의 기본 구조와 전반적 UI는 기존 `FinnhubNewsWindow`를 최대한 재사용한다.
- 다만 필터와 update 버튼은 Investing 수집 목적에 맞게 별도로 단순화한다.
- 1차 수집 대상 카테고리는 아래 2개로 고정한다.
  - `stock-market-news`
  - `cryptocurrency-news`
- backend는 Investing 카테고리 페이지/기사 페이지를 읽어 `news_items`와 `news_fulltext` 흐름에 연결할 수 있는 기반을 만든다.
- 구현은 내부/로컬 prototype 기준으로 설계하되, 운영 반영 전에는 Investing 데이터 이용 제한 문구를 별도 확인 대상으로 유지한다.

### 현재 레포 상태(중요, 확인됨)
- 프론트엔드 탭 시스템에는 현재 아래 window type만 있다.
  - `news`
  - `watchlist`
  - `calendar`
  - `finhub-news`
  - `default-ticker`
  - `data-control`
  - `case-research`
  - `evidence-table`
  - `case-description`
- 실제 메인 뉴스 창은 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`이며, 아래 기능을 이미 갖고 있다.
  - keyword/date/source filter
  - column visibility / ordering / resize
  - display mode
  - bookmark folder
  - saved search
  - background job log panel
  - full text modal
  - update menu / custom date modal / full text menu
- backend는 공용 뉴스 조회 endpoint `GET /api/news`와 source별 pull endpoint family를 이미 운영 중이다.
  - `POST /api/news/pull-finhub`
  - `POST /api/news/pull-rtpr`
  - `POST /api/news/pull-fmp-press-release`
  - `POST /api/news/pull-fmp-stock-news`
  - `POST /api/news/pull-fmp-sec-filing`
  - `POST /api/news/fulltext/update`
- 공용 뉴스 저장 구조는 이미 `news_items` + `news_fulltext` + job polling 흐름으로 정리돼 있으므로, Investing도 같은 저장 구조에 붙이는 편이 가장 단순하다.
- 현재 backend 코드에는 Investing 전용 provider/route가 없다.
- 기존 조사 결과, Investing 공개 HTML 경로는 확인됐다.
  - 검색: `/search/?q=...`
  - 카테고리 목록: `/news/<category>`
  - 페이지네이션: `/news/<category>/2`
  - 기사 상세: `/news/<category>/<slug>-<id>`
- 현재까지 공개 JSON API endpoint는 확인되지 않았고, 1차 구현은 HTML fetch + parse를 기준으로 설계해야 한다.
- 기존 조사에서 Investing footer에 데이터 사용 제한 문구가 노출됐다. 따라서 기술 구현과 운영 사용 허용 여부를 분리해서 다뤄야 한다.

### 제약 / 비범위
- 이번 plan은 `Investing News Window`와 그에 필요한 backend 수집 경로를 대상으로 한다.
- 1차 범위는 `stock-market-news`, `cryptocurrency-news` 두 카테고리만 포함한다.
- 검색창 기반 임의 query scraping, analysis 섹션, 다른 category 확장은 이번 범위가 아니다.
- anti-bot 우회, 로그인 session reverse engineering, private endpoint 추적은 이번 범위가 아니다.
- mock 데이터는 추가하지 않는다.
- production 배포 승인이나 약관 해석 결론 자체를 plan만으로 확정하지 않는다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`은 Investing 뉴스를 현재 DB 구조에 어떻게 저장할지 결정하는 단계다.
- `Step 2`는 실제 HTML 수집기와 pull endpoint를 만드는 단계다.
- `Step 3`은 기사 본문(full text)을 기존 구조에 붙이는 단계다.
- `Step 4`는 새 `Investing News Window`를 Finnhub 창과 비슷한 모양으로 추가하는 단계다.
- `Step 5`는 탭 등록, 문서 동기화, 검증 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 구현 전 결정이 바뀌면 `PLAN CHANGE` 메모를 추가한다.
- 각 Step이 끝나면 변경 파일, 검증 방법, 리스크를 채팅에 따로 보고한다.
- 사용자 확인 전에는 완료된 단계도 `⏳`로 유지한다.
- 사용자 확인 후에만 `✅`로 올린다.
- 이번 plan 문서 생성 시점에는 구현을 시작하지 않았으므로 세부 단계 상태는 기본적으로 `⬜`다.

### 아키텍처(상위)
- 수집 입력:
  - `https://www.investing.com/news/stock-market-news`
  - `https://www.investing.com/news/cryptocurrency-news`
  - 각 카테고리의 페이지네이션 URL
  - 각 기사 상세 URL
- backend 흐름:
  1. 새 endpoint가 카테고리 선택값과 recent/custom mode를 받는다.
  2. 카테고리 목록 페이지를 순회하며 기사 메타데이터를 파싱한다.
  3. 기사 URL 기준으로 중복을 제거하고 `news_items`에 `source='INVESTING'`로 저장한다.
  4. 기사 본문은 detail page extractor 또는 공용 full text update 경로로 `news_fulltext`에 저장한다.
  5. job manager를 통해 로그/상태를 프론트에 노출한다.
- frontend 흐름:
  1. 새 `InvestingNewsWindow`가 `FinnhubNewsWindow`의 리스트/컬럼/북마크/job panel 골격을 재사용한다.
  2. source filter 대신 `Investing category filter`를 사용한다.
  3. update 메뉴는 `stock-market-news`, `cryptocurrency-news`, `all investing` 중심으로 재구성한다.
  4. 데이터 조회는 기존 `GET /api/news`를 재사용하되 `source_names=INVESTING`와 Investing 전용 `source_type`을 사용한다.
- 저장 규칙 제안:
  - `source`: `INVESTING`
  - `source_type`: `investing_stock_market_news`, `investing_cryptocurrency_news`
  - `publisher`: `INVESTING`
  - `origin_url`: 기사 상세 URL
  - `url`: 기사 상세 URL 또는 동일 값
  - `body`: 목록 카드의 요약이 있으면 임시 저장, 본문은 `news_fulltext` canonical

### 결정/선행조건(초기에 확정 필요)
1. 저장 대상 범위
   - 제안: 메타데이터는 `news_items`, 본문은 `news_fulltext`로 분리 저장
   - 이유: 현재 terminal 앱의 canonical 구조를 그대로 재사용할 수 있다.
2. Investing category 내부 이름
   - 제안: `investing_stock_market_news`, `investing_cryptocurrency_news`
   - 이유: 외부 slug를 보존하면서도 source family를 명확히 구분할 수 있다.
3. update UI 모양
   - 제안: 단일 main button + dropdown menu 유지, 메뉴 항목만 Investing 전용으로 교체
   - 이유: Finnhub 창과 사용감은 비슷하게 유지하면서 변경 범위를 최소화할 수 있다.
4. full text 획득 방식
   - 제안: 기사 detail HTML extractor를 추가하고 기존 `/api/news/fulltext/update` 경로를 재사용
   - 이유: 새 전용 fulltext job family를 만들 필요가 없다.
5. rollout 모드
   - 제안: 1차는 내부 prototype 기준으로 구현, 운영/배포 전에는 권한/약관 확인을 별도 게이트로 둔다.
   - 이유: 기술 검증과 운영 사용 허용 여부를 혼동하지 않기 위해서다.

### 계획 중간 필수 확인
- 카테고리 목록 페이지에서 title/url/published time/summary가 안정적으로 파싱되는지 확인한다.
- 기사 detail page에서 실제 본문 영역만 안정적으로 추출되는지 확인한다.
- 같은 기사가 page 1과 page 2에 중복 노출될 때 URL dedupe가 충분한지 확인한다.
- Investing 기사 대부분이 ticker를 명시하지 않을 가능성이 있으므로 `tickers` 빈 배열 허용 정책을 확인한다.
- `GET /api/news`에서 ticker가 빈 배열이어도 현재 UI가 깨지지 않는지 확인한다.

### 제안하는 구현 순서(이유)
1. backend 저장 계약을 먼저 고정한다.
   - 프론트를 먼저 만들면 source_type, fulltext, dedupe 규칙이 계속 흔들린다.
2. HTML 목록/상세 수집기를 만든다.
   - 카테고리 2개만 우선 안정화하면 update 버튼 의미가 바로 생긴다.
3. full text extractor를 붙인다.
   - window 구조를 Finnhub와 비슷하게 가져가려면 full text modal이 동작해야 한다.
4. 새 window를 추가하고 탭 시스템에 연결한다.
   - backend가 준비된 상태에서 프론트를 붙이면 검증이 단순하다.
5. 문서와 검증을 마지막에 묶는다.
   - prompt/spec drift를 줄인다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — Investing 저장 계약과 API contract 고정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | Investing source/source_type/publisher/origin_url 저장 규칙을 확정 | `ai_agent_plan/investing_news_window/plan.md` | 문서 결정 섹션 확인 | ⬜ |
| 1-2 | `GET /api/news` 재사용 방식과 query 조합을 확정 | `ai_agent_plan/investing_news_window/plan.md` | source_names/source_type 규칙 확인 | ⬜ |
| 1-3 | category filter와 update menu 기본 UX를 문서로 고정 | `ai_agent_plan/investing_news_window/plan.md` | Step 설명과 결정 항목 일치 확인 | ⬜ |

- `1-1` 목적: backend와 frontend가 같은 source 이름을 쓰게 만든다.
  설명: `INVESTING` / `investing_stock_market_news` / `investing_cryptocurrency_news`를 공통 기준으로 고정한다.
  완료 조건(눈으로 확인): plan 문서 여러 섹션에서 동일한 이름이 반복된다.
  사람 검증(비개발자): 새 source 이름이 한 종류로만 보인다.
  흔한 문제/주의: `investing_stock_news`처럼 줄인 이름과 slug 기반 이름이 혼용되면 query/filter가 엇갈린다.
- `1-2` 목적: 새 조회 endpoint를 불필요하게 늘리지 않는다.
  설명: 기존 `GET /api/news`에 `source_names=INVESTING`와 `source_type=...`를 조합하는 방식으로 통일한다.
  완료 조건(눈으로 확인): plan에 별도 list endpoint를 만들지 않는다고 적혀 있다.
  사람 검증(비개발자): 기존 뉴스 조회 API를 재사용한다는 문장을 읽을 수 있다.
  흔한 문제/주의: 새 list endpoint를 만들면 Finnhub/Investing 창 동작이 갈라져 유지보수가 커진다.
- `1-3` 목적: UI 변경 범위를 미리 고정한다.
  설명: keyword/date/columns/bookmark는 유지하고, filter/update 메뉴만 Investing 전용으로 바꾸는 방향을 확정한다.
  완료 조건(눈으로 확인): 어떤 UI를 유지하고 무엇을 교체하는지 plan에 적혀 있다.
  사람 검증(비개발자): Finnhub와 비슷하지만 category/update만 다르다는 설명이 보인다.
  흔한 문제/주의: change update, calendar update 같은 Finnhub 전용 버튼이 남으면 사용자 혼동이 생긴다.

검증 훅:
```text
- plan.md의 결정/선행조건과 아키텍처(상위) 섹션에서 source/source_type/query 규칙이 일치하는지 확인
- UI 유지 항목과 교체 항목이 명시적으로 분리돼 있는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — backend Investing category 수집기와 pull endpoint 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | category list HTML parser와 detail URL normalizer를 구현 | `terminal/backend/src/services/investingNewsProvider.ts` | 샘플 HTML에서 기사 목록 파싱 확인 | ⬜ |
| 2-2 | recent/custom/category 입력을 받는 `POST /api/news/pull-investing` route 추가 | `terminal/backend/src/server.ts` | endpoint 200 또는 validation 400 확인 | ⬜ |
| 2-3 | page 순회, dedupe, retry, maxPages 정책을 job runner에 반영 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/investingNewsProvider.ts` | job log에서 page/category 진행 확인 | ⬜ |
| 2-4 | `news_items` insert를 `source='INVESTING'` 규칙으로 연결 | `terminal/backend/src/server.ts` | `GET /api/news?source_names=INVESTING` 조회 확인 | ⬜ |

- `2-1` 목적: Investing 카테고리 페이지를 앱이 읽을 수 있게 만든다.
  설명: 목록 페이지에서 기사 제목, URL, 발행 시각, 요약, category slug를 추출하는 parser를 만든다.
  완료 조건(눈으로 확인): provider 파일에 category slug와 selector/regex 기반 파서가 존재한다.
  사람 검증(비개발자): provider 파일에서 Investing URL과 category 이름을 볼 수 있다.
  흔한 문제/주의: Investing HTML은 class name 변동 가능성이 있어 selector 한 가지에만 의존하면 깨질 수 있다.
- `2-2` 목적: 프론트 update 버튼이 호출할 backend 진입점을 만든다.
  설명: `mode`, `category`, `from`, `to`, `maxPages`, `requestIntervalMs`를 받는 route를 추가한다.
  완료 조건(눈으로 확인): `pull-investing` route가 `server.ts`에 생긴다.
  사람 검증(비개발자): endpoint 이름이 코드에 적혀 있다.
  흔한 문제/주의: custom mode에서 `from`이 없을 때 400을 명시적으로 반환해야 한다.
- `2-3` 목적: 지나친 중복 수집과 무한 페이지 탐색을 막는다.
  설명: page 순회 상한, 연속 empty page 중단, URL dedupe, 실패 재시도를 추가한다.
  완료 조건(눈으로 확인): provider/route에 `maxPages`와 dedupe 기준이 보인다.
  사람 검증(비개발자): plan 설명에서 page 제한 규칙을 읽을 수 있다.
  흔한 문제/주의: page 1/2 중복 기사, 광고 카드, sponsored card가 뉴스로 섞일 수 있다.
- `2-4` 목적: 현재 앱의 공용 뉴스 조회 구조에 바로 얹는다.
  설명: insert 후 `GET /api/news`에서 Investing source만 필터링해서 읽을 수 있게 한다.
  완료 조건(눈으로 확인): source=`INVESTING` row가 조회된다.
  사람 검증(비개발자): API 호출 시 Investing 기사 목록이 내려온다.
  흔한 문제/주의: URL 기준 dedupe를 안 하면 recent update마다 같은 기사 반복 insert가 생길 수 있다.

검증 훅:
```text
- POST /api/news/pull-investing { "mode": "recent", "category": "all" }
- POST /api/news/pull-investing { "mode": "custom", "category": "stock-market-news", "from": "2026-03-20", "to": "2026-03-28" }
- GET /api/news?source_names=INVESTING&limit=20
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — Investing 기사 full text 경로 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | Investing article detail extractor를 `fulltextExtractors.ts`에 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | 샘플 기사 본문 추출 확인 | ⬜ |
| 3-2 | Investing source_type 대상 full text update payload를 정의 | `ai_agent_plan/investing_news_window/plan.md` | sourceType/sourceName 규칙 확인 | ⬜ |
| 3-3 | `POST /api/news/fulltext/update` 재사용으로 본문 저장 흐름을 확정 | `terminal/backend/src/server.ts` 또는 기존 공용 route 호출부 영향 확인 | investing row 대상 fulltext job 동작 확인 | ⬜ |

- `3-1` 목적: Finnhub 창과 비슷한 full text modal 경험을 유지한다.
  설명: Investing 기사 상세 페이지에서 headline/footer/ad를 제외한 본문 영역을 추출한다.
  완료 조건(눈으로 확인): extractor에 Investing 도메인 분기가 추가된다.
  사람 검증(비개발자): 샘플 기사에서 본문 문단이 여러 개 추출된다.
  흔한 문제/주의: footer 고지나 related links가 본문 뒤에 붙을 수 있어 clipping 규칙이 필요하다.
- `3-2` 목적: 프론트 full text 버튼이 어떤 source를 호출할지 고정한다.
  설명: `investing_stock_market_news`, `investing_cryptocurrency_news`, `all-investing` payload 규칙을 문서로 정한다.
  완료 조건(눈으로 확인): plan에 sourceType payload 표기가 있다.
  사람 검증(비개발자): full text가 Investing 전용 source만 대상으로 실행된다는 설명을 읽을 수 있다.
  흔한 문제/주의: source_name/source_type 조합이 모호하면 다른 source row까지 섞여 처리될 수 있다.
- `3-3` 목적: 새 full text 전용 API를 불필요하게 만들지 않는다.
  설명: 기존 `/api/news/fulltext/update` 경로를 그대로 사용하고 extractor만 확장한다.
  완료 조건(눈으로 확인): plan에서 공용 fulltext route 재사용이 명시된다.
  사람 검증(비개발자): 새 API 없이도 본문 추출이 된다는 설명을 볼 수 있다.
  흔한 문제/주의: extractor만 추가하고 source filter가 없으면 전체 뉴스 reprocess가 발생할 수 있다.

검증 훅:
```text
- POST /api/news/fulltext/update { "sourceType": "investing_stock_market_news", "sourceName": "INVESTING", "concurrency": 5 }
- GET /api/news/fulltext/:newsId
- Investing 기사 샘플 3건에서 본문 길이/상태 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — Investing News Window 프론트 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `FinnhubNewsWindow`를 기준으로 `InvestingNewsWindow` 컴포넌트 초안을 만든다 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/InvestingNewsWindow.tsx` | 컴포넌트 렌더링 확인 | ⬜ |
| 4-2 | source filter를 category filter(`all`, `stock-market-news`, `cryptocurrency-news`)로 교체 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/InvestingNewsWindow.tsx` | filter 메뉴 표시 확인 | ⬜ |
| 4-3 | update 메뉴를 Investing 전용 항목으로 교체 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/InvestingNewsWindow.tsx` | update 메뉴 항목 확인 | ⬜ |
| 4-4 | `GET /api/news`와 full text job 연동을 Investing source 기준으로 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/InvestingNewsWindow.tsx` | 목록/본문 modal 동작 확인 | ⬜ |

- `4-1` 목적: 기존 창과 사용감이 비슷한 새 창을 빠르게 만든다.
  설명: column/bookmark/job panel/full text modal/display mode 골격은 최대한 그대로 복사하고 Investing 전용 상태만 남긴다.
  완료 조건(눈으로 확인): 새 window 파일이 생기고 기본 레이아웃이 렌더링된다.
  사람 검증(비개발자): Finnhub와 비슷한 레이아웃의 새 창이 열린다.
  흔한 문제/주의: Finnhub 전용 state가 남으면 불필요한 버튼과 localStorage key가 같이 따라올 수 있다.
- `4-2` 목적: 사용자에게 Investing category만 노출한다.
  설명: source type 대신 category filter만 보여주고 대상 카테고리 2개만 선택 가능하게 만든다.
  완료 조건(눈으로 확인): filter 메뉴에 3개 항목만 보인다.
  사람 검증(비개발자): `All Investing`, `Stock Market News`, `Cryptocurrency News` 정도의 항목을 볼 수 있다.
  흔한 문제/주의: source_names와 source_type query를 동시에 안 맞추면 다른 source 뉴스가 섞일 수 있다.
- `4-3` 목적: update 버튼 의미를 Investing 수집 목적과 맞춘다.
  설명: `Recent All`, `Recent Stock Market`, `Recent Crypto`, `Custom All`, `Custom Stock Market`, `Custom Crypto` 같이 재구성한다.
  완료 조건(눈으로 확인): Finnhub/FMP/PTPR 관련 update 항목이 사라진다.
  사람 검증(비개발자): update 메뉴가 Investing category 중심으로 보인다.
  흔한 문제/주의: custom modal 재사용 시 어떤 category로 실행되는지 pending state를 별도로 유지해야 한다.
- `4-4` 목적: 새 창이 backend와 end-to-end로 연결되게 한다.
  설명: 데이터 fetch, update, full text, job log polling을 Investing source 기준으로 맞춘다.
  완료 조건(눈으로 확인): update 후 리스트가 다시 로드되고 full text가 열린다.
  사람 검증(비개발자): 버튼 클릭 후 job이 뜨고 목록이 갱신된다.
  흔한 문제/주의: Investing 기사에 ticker가 비어 있어도 row renderer가 깨지지 않도록 확인해야 한다.

검증 훅:
```text
- Investing News Window 열기
- category filter 변경 후 목록 재조회
- Recent Stock Market / Recent Crypto / Custom All 실행
- 기사 row 클릭 후 full text modal 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 탭 시스템 연결, 문서 동기화, 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 새 `WindowType`와 Add Tab/App title/DraggableWindow lazy import를 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/AddTabModal.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx` | 새 탭 생성 확인 | ⬜ |
| 5-2 | frontend/backend prompt 문서에 새 창과 Investing pull 흐름을 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`, `terminal/backend_prompt.md` | 문서 검색 확인 | ⬜ |
| 5-3 | 정적 분석/build/test/runtime 검증을 수행 | 관련 변경 파일 전체 | `get_errors`, build, test, dev runtime 확인 | ⬜ |

- `5-1` 목적: 사용자가 실제로 새 창을 열 수 있게 만든다.
  설명: 탭 생성 모달, app 제목, lazy import, window switch를 한 번에 연결한다.
  완료 조건(눈으로 확인): Add Tab 목록에 Investing 창이 보이고 실제 열린다.
  사람 검증(비개발자): 체크박스로 Investing 창을 선택해 새 탭을 만들 수 있다.
  흔한 문제/주의: title만 추가하고 `WindowType` union을 빼먹으면 build가 깨진다.
- `5-2` 목적: 코드와 스펙 문서의 드리프트를 막는다.
  설명: frontend prompt와 backend prompt에 Investing 창, category filter, update route를 기록한다.
  완료 조건(눈으로 확인): 문서에서 `Investing News Window`와 `pull-investing`이 검색된다.
  사람 검증(비개발자): 문서를 열면 새 창 설명이 있다.
  흔한 문제/주의: 코드만 바꾸고 문서를 안 바꾸면 다음 작업자가 구조를 오해한다.
- `5-3` 목적: 구현을 끝까지 검증한다.
  설명: 정적 분석, build, test, dev runtime, API 호출, UI 렌더링을 모두 확인한다.
  완료 조건(눈으로 확인): 에러 0, build 성공, test 통과, runtime에서 새 창 동작 확인.
  사람 검증(비개발자): 새 창을 열고 update/filter/full text가 실제로 동작하는지 보면 된다.
  흔한 문제/주의: 브라우저 시각 확인이 어려우면 API 검증과 코드 리뷰로 대체하되 사용자 확인을 받아야 한다.

검증 훅:
```text
- get_errors (변경 파일 기준)
- terminal: build
- terminal: test
- backend dev + webui dev 상태에서 Investing 창 열기
- POST /api/news/pull-investing 호출 후 GET /api/news?source_names=INVESTING 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. `결정 #1` 운영 허용 범위
   - 선택지: `내부 prototype만` / `개인 로컬 사용` / `운영 반영 전 권한 확인 필수`
   - 차단 대상 Step: Step 5 배포/운영 결론
2. `결정 #2` update 메뉴 기본 구성
   - 선택지: `All/Stock/Crypto 3계층` / `Stock,Crypto 2버튼 고정` / `main button + submenu`
   - 차단 대상 Step: Step 4-3
3. `결정 #3` ticker 없는 기사 표시 방식
   - 선택지: `빈 ticker 허용` / `category badge로 대체` / `article metadata 추가 컬럼 표시`
   - 차단 대상 Step: Step 4-4
4. `결정 #4` detail 본문 수집 시점
   - 선택지: `pull 시 즉시 fetch` / `full text job에서 fetch` / `row open 시 lazy fetch`
   - 차단 대상 Step: Step 3

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 완료` / `⏳ 구현 완료, 사용자 확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — 계약/설계
- ⏳ 1-1 source/source_type 저장 규칙 고정
- ⏳ 1-2 `GET /api/news` query 규칙 고정
- ⏳ 1-3 category filter + update UX 고정

Track B — backend 수집
- ⏳ 2-1 category list parser + URL normalizer
- ⏳ 2-2 `POST /api/news/pull-investing` route
- ⏳ 2-3 paging/dedupe/retry/job 정책
- ⏳ 2-4 `news_items` insert + Investing 조회 확인

Track C — full text
- ⏳ 3-1 Investing detail extractor
- ⏳ 3-2 Investing fulltext payload 규칙
- ⏳ 3-3 공용 fulltext route 재사용 확인

Track D — frontend window
- ⏳ 4-1 `InvestingNewsWindow` 초안 생성
- ⏳ 4-2 category filter 교체
- ⏳ 4-3 update 메뉴 교체
- ⏳ 4-4 목록/full text/job 연동

Track E — integration / docs
- ⏳ 5-1 WindowType/AddTab/App/DraggableWindow 연결
- ⏳ 5-2 prompt/spec 문서 동기화
- ⏳ 5-3 정적 분석/build/test/runtime 검증

┌─ 차단 구간 ─┐
운영 사용 허용 여부는 별도 확인이 필요하다. 다만 내부 prototype 구현 자체는 진행 가능하도록 설계한다.
└──────────────┘

병렬 트랙 요약
- Step 1이 끝나야 Step 2, Step 4 설계가 흔들리지 않는다.
- Step 2와 Step 3은 일부 병렬 가능하지만, detail URL/저장 규칙은 Step 2 기준을 공유해야 한다.
- Step 4는 Step 2의 list API 계약이 고정된 뒤 진행하는 것이 안전하다.
- Step 5는 Step 2~4가 끝난 뒤에만 의미가 있다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 운영 허용 범위 | Step 5 운영 결론 | 내부 prototype만 / 개인 로컬 사용 / 권한 확인 후 운영 |
| update 메뉴 모양 | Step 4-3 | 3계층 / 2버튼 / submenu |
| ticker 없는 기사 표시 | Step 4-4 | 빈 ticker 허용 / category badge / metadata column |
| detail 본문 수집 시점 | Step 3 | pull 시 즉시 / fulltext job / row open 시 lazy |

### 결정 #1 — 저장 모델(상세)
- 권장안: `news_items` + `news_fulltext` 재사용
- 이유:
  - 현재 앱이 이미 이 구조를 중심으로 bookmark, full text modal, generic list API를 묶고 있다.
  - Investing 전용 테이블을 따로 만들면 새 window만 별도 API/쿼리/저장 규칙을 강제하게 된다.
- trade-off:
  - Investing 기사에 ticker가 없는 경우 기존 뉴스 스키마가 다소 빈 컬럼을 갖게 된다.
  - 하지만 이는 새 전용 schema를 만드는 비용보다 작다.

### 결정 #2 — frontend 구현 전략(상세)
- 권장안: `FinnhubNewsWindow`를 복사해 `InvestingNewsWindow`로 분기
- 이유:
  - 사용자가 요청한 "구조는 같다" 요구를 가장 빠르게 만족한다.
  - column/bookmark/log panel/full text modal을 새로 설계할 필요가 없다.
- trade-off:
  - 1차에는 코드 중복이 생긴다.
  - 후속 리팩터링에서 공용 hook 또는 shared view model로 정리할 수 있다.

### 결정 #3 — update 범위(상세)
- 권장안: `Recent All`, `Recent Stock Market`, `Recent Crypto`, `Custom All`, `Custom Stock Market`, `Custom Crypto`
- 이유:
  - 사용자가 명시한 두 카테고리를 그대로 버튼 의미에 반영할 수 있다.
  - 단일 category만 재수집하고 싶을 때도 버튼 의미가 분명하다.
- trade-off:
  - 메뉴 항목 수가 조금 늘어난다.
  - 하지만 Finnhub 창도 이미 menu 기반이므로 UX 패턴은 크게 다르지 않다.

### 결정 #4 — 운영 리스크 처리(상세)
- 권장안: 구현은 내부 prototype 기준으로 진행하되, 문서와 최종 보고에서 Investing footer 사용 제한 문구를 명시한다.
- 이유:
  - 기술 검증은 계속 전진시킬 수 있다.
  - 동시에 운영 반영/배포 결론은 별도 게이트로 남겨 과장 없이 정리할 수 있다.
- trade-off:
  - 사용자가 바로 production-ready로 오해하지 않도록 매 단계에서 다시 명시해야 한다.