### 목표
- FMP Stock News를 terminal 앱의 독립 뉴스 source로 추가한다.
- News Window에서 `FMP Stock` source filter를 선택할 수 있게 한다.
- News Window Update 메뉴에 `Recent FMP Stock`, `Custom FMP Stock` 버튼을 추가한다.
- News Window Full Text 메뉴에 `FMP Stock Only` 버튼을 추가해 `source_type='fmp_stock_news'`만 대상으로 fulltext update를 실행할 수 있게 한다.
- 동작 메커니즘은 기존 `FMP PR` 경로와 최대한 동일하게 유지하되, 수집 endpoint만 FMP stock news endpoint로 교체한다.

### 현재 레포 상태(중요, 확인됨)
- backend에는 이미 FMP 전용 수집 경로가 2개 있다.
  - `POST /api/news/pull-fmp-press-release`
  - `POST /api/news/pull-fmp-sec-filing`
- `FMP PR`는 `terminal/backend/src/services/fmpPressReleaseProvider.ts`에서 `https://financialmodelingprep.com/stable/news/press-releases?symbols=...`를 ticker별로 호출하고, `source_type='fmp_press_release'`로 저장한다.
- `FMP PR` recent/custom 동작은 `terminal/backend/src/server.ts`의 job orchestration에서 처리한다.
  - recent: ticker anchor + confirmed-empty skip
  - custom: 날짜 범위를 받아 전체 범위를 수집
- frontend `FinnhubNewsWindow.tsx`에는 이미 아래 FMP 전용 버튼이 있다.
  - `Recent FMP PR`
  - `Custom FMP PR`
  - `FMP PR` source filter
  - `FMP PR Only` fulltext update
- fulltext backend는 이미 generic하다.
  - `POST /api/news/fulltext/update`는 `sourceType` 문자열을 받아 missing-only extraction을 수행한다.
  - `terminal/backend/src/services/fulltextRepository.ts`의 `getUnextractedNewsIds()`는 특정 enum으로 hardcode하지 않고 전달된 `sourceType` 문자열을 그대로 필터링한다.
- FMP 공식 stable docs 확인 결과, stock news 관련 endpoint는 다음 2개가 존재한다.
  - latest feed: `https://financialmodelingprep.com/stable/news/stock-latest?page=0&limit=20`
  - symbol search: `https://financialmodelingprep.com/stable/news/stock?symbols=AAPL`
- 따라서 이번 작업은 새 provider + 새 pull endpoint + 새 source filter/UI 버튼을 넣는 작업이며, fulltext 경로는 공용 endpoint를 재사용하는 방향이 가장 단순하다.

### 제약 / 비범위
- 이번 plan은 `FMP Stock News` 추가에만 한정한다.
- 기존 `Finnhub company_news`, `Finnhub press_release`, `FMP PR`, `FMP SEC Filing`, `RTPR` semantics는 바꾸지 않는다.
- 별도 mock 데이터는 추가하지 않는다.
- 별도 screener 기능이나 stock universe 편집 UI는 이번 범위가 아니다.
- fulltext extractor 품질 개선, source-specific reset endpoint 추가는 이번 1차 범위가 아니다. 필요하면 후속 plan으로 분리한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`: FMP stock endpoint의 실제 응답 필드와 내부 이름을 확정한다.
- `Step 2`: backend가 FMP stock 뉴스를 DB에 넣고 recent/custom job으로 돌 수 있게 만든다.
- `Step 3`: News Window에 새 filter와 새 버튼을 보이게 한다.
- `Step 4`: fulltext 버튼과 문서를 맞춘다.
- `Step 5`: build/test/API로 실제 동작을 검증한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- endpoint 파라미터나 내부 `source_type` 이름이 달라지면 `PLAN CHANGE` 메모를 추가한다.
- 각 Step 완료 후 변경 파일, 검증 방법, 리스크를 채팅과 `agent_log.md`에 기록한다.
- 사용자 확인 전에는 완료된 Step도 `⏳` 상태로 둔다.
- 사용자 확인 후에만 `✅`로 승격한다.

### 아키텍처(상위)
- 입력:
  - 사용자가 News Window에서 `Recent FMP Stock` 또는 `Custom FMP Stock`을 선택한다.
  - 사용자가 source filter에서 `FMP Stock`을 선택한다.
  - 사용자가 Full Text 메뉴에서 `FMP Stock Only`를 선택한다.
- backend pull 흐름:
  1. `server.ts` 신규 endpoint가 요청 body를 parse한다.
  2. default universe ticker 목록을 읽는다.
  3. ticker별 anchor/confirmed-empty 규칙으로 FMP stock endpoint를 호출한다.
  4. 응답을 `news_items`에 insert하고 `source='FMP'`, `source_type='fmp_stock_news'`로 저장한다.
  5. 새 row에 대해 `mergeChangeForNewItems()`를 호출한다.
- backend fulltext 흐름:
  1. 프론트가 `POST /api/news/fulltext/update`에 `sourceType='fmp_stock_news'`, `sourceName='FMP'`를 보낸다.
  2. 공용 fulltext job이 `news_fulltext` missing row만 추출한다.
- frontend 흐름:
  1. source filter union에 `fmp_stock_news` 추가
  2. Update 메뉴에 recent/custom 항목 추가
  3. Full Text 메뉴에 `FMP Stock Only` 추가
  4. active job polling/category는 기존 `news-update`, `news-fulltext`를 재사용

### 결정/선행조건(초기에 확정 필요)
- 결정 1: 내부 `source_type` 명칭
  - 제안: `fmp_stock_news`
  - 이유: 기존 `fmp_press_release`, `fmp_sec_filing`과 naming family를 맞추면서 의미가 가장 명확하다.
- 결정 2: recent/custom 수집 endpoint
  - 제안: 둘 다 `https://financialmodelingprep.com/stable/news/stock?symbols=...` 기반 per-ticker search를 사용한다.
  - 이유: `FMP PR`와 동일한 anchor/confirmed-empty/ticker-pool 구조를 그대로 재사용할 수 있다.
- 결정 3: latest endpoint 활용 방식
  - 제안: `news/stock-latest`는 1차 구현에서는 사용하지 않고, 필요 시 Step 1 probe용 보조 참고로만 쓴다.
  - 이유: latest feed는 per-ticker incremental semantics가 약해서 current architecture와 덜 맞는다.
- 결정 4: fulltext 경로
  - 제안: 신규 전용 fulltext backend endpoint는 만들지 않고 공용 `/api/news/fulltext/update`를 그대로 사용한다.
  - 이유: 현재 공용 경로가 이미 sourceType 기반 missing-only 처리 구조를 제공한다.

### 계획 중간 필수 확인
- FMP stock endpoint 응답에 실제로 title/body/snippet/url/published field가 어떤 이름으로 오는지 probe로 먼저 확인한다.
- 같은 기사 중복이 URL 기준으로 안정적으로 제거되는지 확인한다.
- multi-symbol 기사에서 `tickers` 매핑 규칙을 정해야 한다.
- FMP stock 뉴스가 fulltext extractor 대상 도메인을 실제로 제공하는지 샘플 기사 3건 이상으로 확인한다.

### 제안하는 구현 순서(이유)
1. 먼저 endpoint 응답을 확인해야 provider mapping을 잘못 설계하지 않는다.
2. backend ingest가 먼저 있어야 frontend 버튼을 눌렀을 때 실제 데이터가 쌓인다.
3. 그 다음 filter/update/fulltext UI를 연결해야 사용자 흐름이 완성된다.
4. 마지막으로 docs와 검증을 붙여 drift를 막는다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — FMP stock endpoint 규격 고정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | FMP stock endpoint의 실제 응답 필드와 날짜 포맷을 provider-safe mapping 기준으로 확정 | `terminal/backend/src/services/fmpStockNewsProvider.ts` 또는 provider 구현 파일 | mapper가 `title/text/content/url/publishedDate/date` 계열 필드를 수용하는지 확인 | ⏳ |
| 1-2 | 내부 `source_type`, job key, update status key 이름을 최종 확정 | `ai_agent_plan/fmp_stock_news_ui/plan.md` | plan 문서에 이름 명시 확인 | ⏳ |
| 1-3 | latest endpoint를 runtime에 쓰지 않을지 최종 결정 | `ai_agent_plan/fmp_stock_news_ui/plan.md` | 결정 문구 확인 | ⏳ |

- `1-1` 목적: provider 매핑을 단일 필드명 가정에 묶지 않고 안전하게 고정한다.
  설명: FMP stable docs direct fetch가 현재 404이므로, `title`, `text/content/snippet`, `publishedDate/date`, `symbol/symbols/tickers/site` 등 복수 후보 필드를 허용하는 mapper로 설계한다.
  완료 조건(눈으로 확인): provider mapper가 복수 필드 후보를 처리하도록 코드/계획에 반영돼 있다.
  사람 검증(비개발자): endpoint 이름과 샘플 필드 목록을 읽을 수 있다.
  흔한 문제/주의: press release와 달리 `text`가 아니라 `content`/`snippet`일 수 있고, ticker 필드도 `symbol` 단일값이 아닐 수 있다.
- `1-2` 목적: DB와 UI 전체에서 동일한 이름을 쓰게 한다.
  설명: `fmp_stock_news` 같은 내부 이름을 backend/frontend/docs에 일관 적용한다.
  완료 조건(눈으로 확인): plan에 제안 이름이 한 번이 아니라 여러 섹션에서 동일하게 보인다.
  사람 검증(비개발자): 새 source 이름이 한 종류로만 나타난다.
  흔한 문제/주의: `fmp_stock`와 `fmp_stock_news`가 혼용되면 조회/filter가 어긋난다.
- `1-3` 목적: current architecture와 안 맞는 endpoint를 섞지 않게 한다.
  설명: recent/custom는 per-symbol search 중심으로 고정하고 latest는 보조로만 둘지 결정한다.
  완료 조건(눈으로 확인): latest 사용 여부가 plan에 한 문장으로 적혀 있다.
  사람 검증(비개발자): 어떤 endpoint를 실제 수집에 쓸지 읽고 알 수 있다.
  흔한 문제/주의: latest는 전체 최신 feed라 anchor 기반 증분 수집과 충돌할 수 있다.

검증 훅:
```text
- FMP docs direct page가 404인 상태에서도 provider-safe field fallback 전략이 plan과 코드에 일치하는지 확인
- plan.md의 결정/선행조건 섹션에 source_type, endpoint 전략이 반영됐는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — backend FMP stock pull 경로 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `fmpStockNewsProvider.ts`를 추가하고 FMP stock 응답을 `FinnhubMappedItem` 계열로 매핑 | `terminal/backend/src/services/fmpStockNewsProvider.ts` | provider 단위 샘플 호출 또는 type-check | ⏳ |
| 2-2 | `server.ts`에 `POST /api/news/pull-fmp-stock-news` recent/custom endpoint 추가 | `terminal/backend/src/server.ts` | endpoint parse + 200 응답 확인 | ⏳ |
| 2-3 | anchor/confirmed-empty/update_status key를 `fmp_stock_news` 기준으로 연결 | `terminal/backend/src/server.ts`, 관련 repository 호출부 | recent 재실행 시 key 분리 확인 | ⏳ |
| 2-4 | 새 row insert 후 change merge를 FMP PR와 동일하게 수행 | `terminal/backend/src/server.ts` | job log에 change merge 기록 확인 | ⏳ |

- `2-1` 목적: FMP stock endpoint를 현재 뉴스 저장 구조에 맞춘다.
  설명: 응답을 `publishedAt`, `title`, `body`, `url`, `providerTickers`, `publisher`로 정규화한다.
  완료 조건(눈으로 확인): 새 provider 파일이 생기고 `sourceType='fmp_stock_news'`가 보인다.
  사람 검증(비개발자): 파일 이름과 endpoint 문자열을 열어 볼 수 있다.
  흔한 문제/주의: ticker 배열이 여러 개일 수 있어 `providerTickers` 매핑 규칙을 정해야 한다.
- `2-2` 목적: UI에서 누를 새 recent/custom 버튼의 backend 목표를 만든다.
  설명: body는 FMP PR와 유사하게 `mode`, `from`, `to`, `tickerConcurrency`, `requestIntervalMs`, 필요 시 paging 옵션을 받는다.
  완료 조건(눈으로 확인): `pull-fmp-stock-news` route가 생긴다.
  사람 검증(비개발자): endpoint 이름이 `server.ts`에 보인다.
  흔한 문제/주의: custom에서 `from` 누락 시 400을 명시적으로 반환해야 한다.
- `2-3` 목적: recent 증분 수집이 다른 source와 섞이지 않게 한다.
  설명: anchor와 confirmed-empty 키를 `fmp_press_release`와 분리해 독립 추적한다.
  완료 조건(눈으로 확인): `fmp_stock_news` key가 코드에 존재한다.
  사람 검증(비개발자): plan 또는 코드에서 독립 key 이름을 볼 수 있다.
  흔한 문제/주의: key를 재사용하면 FMP PR anchor가 잘못 섞인다.
- `2-4` 목적: 새 source도 기존 뉴스와 동일하게 change% 파생값을 얻는다.
  설명: insert된 새 item 배열을 `mergeChangeForNewItems()`에 전달한다.
  완료 조건(눈으로 확인): job log에 change merge 단계가 출력된다.
  사람 검증(비개발자): 완료 job 로그에 change merge 문구가 보인다.
  흔한 문제/주의: ticker 누락 row는 merge skip이 많아질 수 있다.

검증 훅:
```text
- POST /api/news/pull-fmp-stock-news { "mode": "recent" }
- POST /api/news/pull-fmp-stock-news { "mode": "custom", "from": "2026-03-01", "to": "2026-03-25" }
- GET /api/jobs/:jobId 로 inserted/skipped/changeMerged 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — News Window filter와 recent/custom 버튼 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `SourceTypeFilter`, `UpdateSourceType`, label/badge helper에 `fmp_stock_news` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | filter dropdown에 항목 표시 확인 | ⏳ |
| 3-2 | source filter query 조립 시 `fmp_stock_news`를 backend `/api/news` 조회 조건으로 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 해당 filter 선택 시 source_type query 확인 | ⏳ |
| 3-3 | Update 메뉴에 `Recent FMP Stock`, `Custom FMP Stock` 버튼 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 메뉴 항목 렌더링 확인 | ⏳ |
| 3-4 | `handleUpdate()`가 `fmp_stock_news`일 때 새 backend endpoint를 호출하도록 분기 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 버튼 클릭 시 새 endpoint payload 확인 | ⏳ |

- `3-1` 목적: 사용자가 새 source를 기존 source들과 같은 수준으로 선택할 수 있게 한다.
  설명: label, short label, badge color까지 함께 추가해 UI에서 구분 가능하게 만든다.
  완료 조건(눈으로 확인): filter 드롭다운에 `FMP Stock`이 보인다.
  사람 검증(비개발자): source filter 목록에 새 항목이 보인다.
  흔한 문제/주의: union type만 바꾸고 label helper를 안 바꾸면 화면 텍스트가 어색해진다.
- `3-2` 목적: filter가 실제 DB 조회까지 연결되게 한다.
  설명: `source_type=fmp_stock_news`가 쿼리스트링에 실리도록 fetch 로직을 조정한다.
  완료 조건(눈으로 확인): filter 선택 후 네트워크 요청에 source_type이 붙는다.
  사람 검증(비개발자): FMP Stock만 보이는 목록이 나온다.
  흔한 문제/주의: `source_names=FMP`만 설정하고 `source_type`을 빼면 FMP PR/SEC가 같이 섞인다.
- `3-3` 목적: 사용자 조작점에서 FMP PR와 동일한 진입점을 제공한다.
  설명: Update 메뉴의 Recent/Custom 섹션에 각각 한 줄씩 추가한다.
  완료 조건(눈으로 확인): 버튼 2개가 Update 메뉴에 보인다.
  사람 검증(비개발자): Update 메뉴를 열면 `Recent FMP Stock`, `Custom FMP Stock` 항목이 보인다.
  흔한 문제/주의: 버튼만 추가하고 pending source state를 연결하지 않으면 custom modal이 잘못된 source로 열린다.
- `3-4` 목적: 버튼이 실제 backend route로 이어지게 한다.
  설명: `handleUpdate()`에서 sourceType별 분기 하나를 더 추가한다.
  완료 조건(눈으로 확인): 클릭 시 `pull-fmp-stock-news` 요청이 간다.
  사람 검증(비개발자): 버튼 클릭 뒤 job 로그가 뜬다.
  흔한 문제/주의: 기존 FMP PR branch 위/아래에 잘못 끼우면 FMP Stock이 Finnhub endpoint로 빠질 수 있다.

검증 훅:
```text
- News Window source filter에서 FMP Stock 선택
- Recent FMP Stock 클릭 후 job 생성 확인
- Custom FMP Stock 클릭 후 date modal -> job 생성 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — FMP stock fulltext 버튼 및 문서 동기화
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | Full Text source union과 button menu에 `fmp_stock_news` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | Full Text 메뉴 항목 확인 | ⏳ |
| 4-2 | `handleFulltextUpdate()` payload에 `sourceType='fmp_stock_news', sourceName='FMP'` 분기 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 네트워크 payload 확인 | ⏳ |
| 4-3 | backend/front spec 문서를 새 source 기준으로 업데이트 | `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⏳ |

- `4-1` 목적: fulltext도 source별 독립 실행이 가능하게 한다.
  설명: 기존 `FMP PR Only`, `FMP SEC Only`처럼 `FMP Stock Only`를 추가한다.
  완료 조건(눈으로 확인): Full Text 메뉴에 새 항목이 보인다.
  사람 검증(비개발자): 메뉴를 열면 `FMP Stock Only`가 보인다.
  흔한 문제/주의: FtSourceType union과 payload branch를 같이 바꾸지 않으면 타입 또는 runtime이 깨진다.
- `4-2` 목적: 공용 backend fulltext endpoint를 새 source에도 재사용한다.
  설명: 별도 backend route 없이 공용 route에 새 sourceType을 전달한다.
  완료 조건(눈으로 확인): 요청 body에 `fmp_stock_news`가 담긴다.
  사람 검증(비개발자): 버튼 클릭 후 fulltext job이 시작된다.
  흔한 문제/주의: `sourceName='FMP'`를 빼면 FMP 외 다른 future source와 섞일 여지가 생긴다.
- `4-3` 목적: 코드와 문서가 동시에 같은 기능을 설명하게 만든다.
  설명: backend prompt와 frontend prompt에 새 source filter, update 버튼, fulltext 버튼을 반영한다.
  완료 조건(눈으로 확인): 두 문서에 FMP Stock 항목이 적혀 있다.
  사람 검증(비개발자): 문서 검색 시 `FMP Stock`이 나온다.
  흔한 문제/주의: 코드만 바꾸고 문서를 안 바꾸면 다음 작업자가 FMP Stock 경로를 놓친다.

검증 훅:
```text
- Full Text 메뉴에서 FMP Stock Only 표시 확인
- POST /api/news/fulltext/update { "sourceType": "fmp_stock_news", "sourceName": "FMP" }
- backend_prompt.md / figma_frontend_prompt.md 에 새 source 설명 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 정적 분석 확인 | 관련 변경 파일 전체 | `get_errors` | ⏳ |
| 5-2 | build 검증 | `terminal`, frontend workspace | `npm.cmd run build` | ⏳ |
| 5-3 | 자동 테스트 검증 | `terminal` | `npm.cmd run test` | ⏳ |
| 5-4 | 런타임 통합 검증 | backend API + frontend dev | recent/custom/fulltext 실제 요청 확인 | ⏳ |

- `5-1` 목적: 타입/문법 오류를 먼저 제거한다.
  설명: 변경 파일 기준 IDE/TypeScript 에러가 0이어야 한다.
  완료 조건(눈으로 확인): errors 0개.
  사람 검증(비개발자): Problems 패널에 새 에러가 없다.
  흔한 문제/주의: union type 추가 후 빠진 branch가 자주 발생한다.
- `5-2` 목적: 실제 배포 가능한 상태인지 본다.
  설명: backend/frontend build가 모두 성공해야 한다.
  완료 조건(눈으로 확인): 두 build 모두 exit code 0.
  사람 검증(비개발자): build 성공 메시지를 확인할 수 있다.
  흔한 문제/주의: frontend는 string literal union 누락으로 build가 잘 깨진다.
- `5-3` 목적: 기존 동작을 깨뜨리지 않았는지 확인한다.
  설명: workspace test를 돌려 회귀 여부를 본다.
  완료 조건(눈으로 확인): test pass.
  사람 검증(비개발자): 실패한 테스트가 없다는 보고를 보면 된다.
  흔한 문제/주의: 기존 flaky test가 있으면 새 변경과 무관한 실패를 구분해야 한다.
- `5-4` 목적: 버튼 클릭에서 job 완료까지 end-to-end로 확인한다.
  설명: API 응답, job polling, 필터 조회, fulltext 실행까지 실제 흐름을 확인한다.
  완료 조건(눈으로 확인): 새 뉴스가 DB/UI에 반영되고 해당 source만 필터링된다.
  사람 검증(비개발자): FMP Stock 버튼을 눌러 job이 뜨고 목록 필터가 동작하는지 보면 된다.
  흔한 문제/주의: backend는 되는데 프론트 filter query가 누락되면 목록이 섞여 보일 수 있다.

검증 훅:
```text
- get_errors(변경 파일)
- terminal build
- terminal test
- backend dev + webui dev 상태에서 Recent FMP Stock / Custom FMP Stock / FMP Stock Only 실행
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | 내부 source_type 최종명 | `fmp_stock_news` 권장 / `fmp_stock` 대안 | Step 2, 3, 4 |
| D2 | stock endpoint body 필드명 | provider-safe fallback map으로 흡수 | Step 2 |
| D3 | paging 옵션 필요 여부 | FMP PR처럼 `pageLimit`, `maxPages` 사용 / 단순 기본값 고정 | Step 2 |
| D4 | latest endpoint 보조 사용 여부 | 미사용 권장 / fallback probe only | Step 1, 2 |

### 실행 의존성 그래프
Legend: `✅` 구현+사용자확인 완료 / `⏳` 구현완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 선행조건 미충족

```text
Track A — endpoint 규격/수집 backend
⏳ Step 1 — FMP stock endpoint 규격 고정
  ⏳ 1-1 provider-safe field mapping 확정
  ⏳ 1-2 source_type / key 이름 확정
  ⏳ 1-3 latest endpoint 사용 여부 결정
      |
      v
⏳ Step 2 — backend FMP stock pull 경로 추가
  ⏳ 2-1 provider 추가
  ⏳ 2-2 /api/news/pull-fmp-stock-news 추가
  ⏳ 2-3 anchor/confirmed-empty/update_status 연결
  ⏳ 2-4 change merge 연결

Track B — frontend filter / update / fulltext UI
⏳ Step 3 — News Window filter와 recent/custom 버튼 추가
  ⏳ 3-1 source filter union/helper 추가
  ⏳ 3-2 query 조립 연결
  ⏳ 3-3 Recent/Custom FMP Stock 버튼 추가
  ⏳ 3-4 새 backend endpoint 호출 연결
      |
      v
⏳ Step 4 — FMP stock fulltext 버튼 및 문서 동기화
  ⏳ 4-1 fulltext union/menu 추가
  ⏳ 4-2 fulltext payload branch 추가
  ⏳ 4-3 backend/front prompt 문서 동기화

Track C — 검증
⏳ Step 5 — 전체 검증
  ⏳ 5-1 정적 분석
  ⏳ 5-2 build
  ⏳ 5-3 자동 테스트
  ⏳ 5-4 런타임 통합 검증

[AWAITING USER CONFIRMATION]
Step 1~5는 구현과 자체 검증까지 끝났고, 현재 상태 이모지는 모두 사용자 확인 대기를 의미하는 `⏳`다.
```

병렬 트랙 요약
- Track A와 Track B는 완전 병렬이 아니다. Track B는 최소한 Step 1의 naming/endpoint 결정과 Step 2의 route path가 정해져야 안전하다.
- Track C는 모든 구현이 끝난 뒤 실행한다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 source_type 명칭 | Step 2, 3, 4 | `fmp_stock_news` 권장 / `fmp_stock` 대안 |
| D2 응답 필드명 | Step 2 | probe 후 확정 |
| D3 paging 옵션 | Step 2 | PR 복제 / 단순화 |
| D4 latest endpoint 사용 여부 | Step 1, 2 | 미사용 권장 / 보조 fallback |