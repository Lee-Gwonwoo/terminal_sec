# Plan — terminal_ui_ver6_fmp

> 이 문서는 2026-03-20 기준 `terminal_ui_ver6_fmp` 작업의 구현 계획서다. 현재 목표는 `FMP press release` 전용 흐름을 유지하면서, 기존 `Finnhub SEC filing` 데이터와 수집 경로를 안전하게 제거하는 것이다.

### PLAN CHANGE — 2026-03-20 20:26
- 사용자 결정에 따라 legacy `Finnhub SEC filing`은 유지하지 않고 제거한다.
- 이번 리비전의 제거 대상은 아래 둘이다.
  - DB의 `source='FINNHUB' AND source_type='sec_filing'` row 및 연결 companion row
  - backend `/api/news/pull-finhub-sec` + frontend SEC 필터/업데이트 진입점
- 중요한 점: 이번 작업은 `FMP SEC` 신규 구현이 아니다. 제거 후 상태는 `구 SEC 경로 없음 + FMP SEC 미구현`이다.

### PLAN CHANGE — 2026-03-21 00:50 (FMP SEC filing 신규 구현)
- 사용자 결정에 따라 기존 `비범위`였던 **FMP SEC filing** 을 신규 구현한다.
- FMP API 엔드포인트: `stable/sec-filings-financials`
  - symbol/cik 필터: **미동작** (글로벌 피드만 반환)
  - date 필터(`from`/`to`): **정상 동작**
  - 응답 shape: `{ symbol, cik, filingDate, acceptedDate, formType, hasFinancials, link, finalLink }` — title/body 없음
- 설계 결정:
  - `source_type='fmp_sec_filing'`, `source='FMP'`
  - 글로벌 피드 → 앱에서 universe ticker로 필터
  - title 자동 생성: `"{symbol}: {formType}"`, body: `"Filed {date}, accepted {date}. CIK: {cik}."`
  - `url = finalLink`, `published_at = acceptedDate`
  - accession number: `link` URL에서 regex 추출
  - `sec_filings` companion 테이블 재활용
  - publisher: `SEC/EDGAR`
- 추가된 파일/변경:
  - 신규: `terminal/backend/src/services/fmpSecFilingProvider.ts`
  - 수정: `newsRepository.ts` (`insertSecFilingCompanion` 추가)
  - 수정: `server.ts` (route `POST /api/news/pull-fmp-sec-filing` + Zod schema)
  - 수정: `FinnhubNewsWindow.tsx` (필터/업데이트/FT 메뉴 15곳 + FtSourceType 수정)

### PLAN CHANGE — 2026-03-23 08:28 (FMP SEC endpoint 재평가)
- live probe + FMP 공식 docs 재확인 결과, 현재 구현의 `stable/sec-filings-financials`는 문서상 유효한 endpoint이지만 RKLB `8-K`/`424B5` coverage를 보장하지 못했다.
- 동일 기간 live 비교 결과:
  - `stable/sec-filings-financials` → RKLB `0건`
  - `stable/sec-filings-search/symbol?symbol=RKLB` → `8-K`, `424B5` `2건`
  - `stable/sec-filings-search/form-type?formType=8-K` → RKLB `8-K` `1건`
  - `stable/sec-filings-8k` → RKLB `8-K` `1건`
- 따라서 FMP SEC 수집의 primary endpoint는 `sec-filings-financials`가 아니라 `sec-filings-search/symbol`로 재설계하는 것이 맞다.
- `8-K` 중심 이벤트 감시는 `sec-filings-8k` 또는 `sec-filings-search/form-type?formType=8-K`를 보강 sweep으로 추가하는 것이 안전하다.
- live payload 기준 `sec-filings-search/symbol` 응답 shape는 `{ symbol, cik, filingDate, acceptedDate, formType, link, finalLink }`이며, `title`, `summary`, `text`, `description`, `body`는 없다.
- 즉 FMP SEC UI/DB에서 제목/요약이 필요하면 앱이 직접 생성해야 한다.

### PLAN CHANGE — 2026-03-23 08:36 (FMP SEC provider 구현 전환)
- `terminal/backend/src/services/fmpSecFilingProvider.ts`의 primary endpoint를 `stable/sec-filings-financials`에서 `stable/sec-filings-search/symbol`로 실제 전환한다.
- 구현 방식은 default universe ticker를 순회하면서 `symbol + from/to + page + limit` 조합으로 요청하고, accession number로 전역 dedupe 한다.
- provider 응답의 `acceptedDate`를 기준으로 앱 내부 날짜 재검증을 한 번 더 수행해 provider filtering 오차를 줄인다.
- route public API는 유지한다.
  - `POST /api/news/pull-fmp-sec-filing`
  - request body: `mode`, `from`, `to`, `requestIntervalMs`, `maxPages`
- 이번 리비전에서는 `8-K` / `424B5` 추가 보강 sweep은 넣지 않고, primary endpoint 전환만 우선 반영한다.
- 남는 운영 리스크:
  - universe ticker 수가 많으면 호출 수가 증가한다.
  - 하지만 ticker coverage hole을 줄이는 것이 이번 변경의 우선 목표다.

### PLAN CHANGE — 2026-03-23 08:48 (Finnhub News 상단 툴바 재배치)
- 사용자 요청에 따라 `FinnhubNewsWindow.tsx` 상단 툴바를 가로 1줄 과밀 구조에서 `좌측 검색 블록 + 우측 제어 블록 + 하단 유틸리티 줄` 구조로 재배치한다.
- 핵심 목표는 아래 3개다.
  - 일반 검색창 가로 폭 확대
  - `From / To` 날짜 입력칸 확대
  - `Update / View Log / Full Text / Control / Save / Load` 같은 액션 버튼을 위아래 공간을 써서 정리
- 이번 리비전의 수정 파일은 아래 둘이다.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- backend API 계약은 변경하지 않고, frontend 레이아웃과 스펙 문서만 갱신한다.

### 목표
- 뉴스 상단 필터에 `fmp pr` 버튼을 추가한다.
- 업데이트 메뉴에 `recent fmp pr update`, `custom fmp pr update` 버튼을 추가한다.
- full text 메뉴에 `fmp pr full text` 버튼을 추가한다.
- 위 세 동작은 모두 `FMP press release` 수집/추출 경로로 연결한다.
- 기존 Finnhub `press_release`와 RTPR `press_release`는 유지하되, FMP PR는 새 `source_type='fmp_press_release'`로 분리한다.
- 기존 `Finnhub SEC filing` row와 route/UI 진입점은 안전하게 제거한다.

### 이번 작업의 확정 범위
- backend
  - FMP press release provider 추가
  - `recent/custom` FMP PR pull route 추가
  - fulltext update가 `source_type='fmp_press_release'`만 대상으로 돌 수 있게 확장
  - legacy `Finnhub SEC filing` pull route 제거
  - startup 시 기존 `FINNHUB + sec_filing` row purge
- frontend
  - `fmp pr` 필터 버튼 추가
  - `recent/custom fmp pr update` 메뉴 추가
  - `fmp pr full text` 메뉴 추가
  - 기존 job polling / log panel / modal UX 재사용
  - legacy SEC 필터 / update 메뉴 / modal 제거
- 문서
  - 본 `plan.md`
  - `agent_log.md`
  - `terminal/backend_prompt.md`

### 비범위
- Finnhub company news / market news 구조 개편
- RTPR 제거 또는 FMP로 완전 대체
- ~~FMP SEC 신규 구현~~ → PLAN CHANGE 2026-03-21에서 구현 완료
- mock 데이터 추가

### 현재 코드/데이터 구조(확인됨)
- 현재 뉴스 item은 `news_items`에 `source`, `source_type`을 분리해서 저장한다.
- legacy SEC 제거 전 기준으로 UI의 source type 필터에는 `sec_filing`이 있었고, update 메뉴도 `/api/news/pull-finhub-sec`를 직접 호출했다.
- 기존 구현 기준으로 FMP PR도 `source_type='press_release'`에 들어갔지만, 이번 리비전에서 FMP PR는 별도 `source_type='fmp_press_release'`로 승격한다.
- 현재 frontend news fetch는 `source_names=FINNHUB,RTPR`를 고정으로 보내고 있다.
  - 즉, FMP news row가 DB에 있어도 지금 상태로는 목록에 노출되지 않는다.
- 현재 fulltext update는 `sourceType`만 받는다.
  - 예외 provider 분기는 `rtpr`만 별도 route로 존재한다.
- 현재 RTPR는 provider 전용 route `/api/news/pull-rtpr`와 전용 fulltext 메뉴를 이미 갖고 있다.
- live DB 확인 결과, 제거 전에는 `FINNHUB + sec_filing` row가 실제로 남아 있었다.
  - `news_items`: 3608 rows
  - `sec_filings`: 3604 rows
- 따라서 이번 제거 작업은 단순 UI 숨김이 아니라 DB purge + route 제거를 함께 해야 한다.

### 최근 live probe로 추가 확인된 사실(2026-03-20 19:20)

#### FMP press release 접근 가능
- 현재 구독 상태에서 아래 endpoint는 실제 `200 OK`로 동작했다.
  - `stable/news/press-releases-latest`
  - `stable/news/press-releases?symbols=AAPL`

#### FMP PR 응답 shape
- 샘플 응답에 아래 필드가 실제로 있었다.
  - `symbol`
  - `title`
  - `text`
  - `publishedDate`
  - `url`
  - `publisher`
  - `site`
  - `image`

#### FMP PR `text`는 full text가 아님
- 직접 비교 결과, FMP press release의 `text`는 짧은 발췌/요약에 가깝다.
- 따라서 `fmp pr full text` 버튼은 저장된 `text`를 재활용하는 기능이 아니라, 기존 fulltext extractor 경로로 원문 URL을 다시 추출하는 기능이어야 한다.

#### `from/to/page/limit`는 구현 기준으로 신뢰하지 않음
- `press-releases?symbols=AAPL`에 `from/to`, `page`, `limit`를 달아 spot-check한 결과, 모두 `200 OK`는 반환했지만 첫 샘플이 동일하게 나왔다.
- 현재 확인 범위에서는 server-side date/window filtering을 신뢰하기 어렵다.
- 따라서 `custom fmp pr update`는 provider 응답을 받은 뒤 앱에서 날짜 범위를 다시 필터하는 방식으로 구현하는 것이 안전하다.

#### FMP SEC endpoint 재확인 (2026-03-23 08:28)
- 공식 docs에는 아래 SEC family가 별도 endpoint로 문서화돼 있다.
  - `stable/sec-filings-financials`
  - `stable/sec-filings-search/symbol?symbol=AAPL`
  - `stable/sec-filings-search/form-type?formType=8-K`
  - `stable/sec-filings-8k`
- docs 설명상 `sec-filings-financials`는 `8-K`, `10-K`, `10-Q` 등을 포함하는 “Latest SEC Filings” feed다.
- 하지만 live probe 기준 RKLB `2026-03-17 ~ 2026-03-18` offering 관련 filing은 `sec-filings-financials`에서 누락됐다.
- 같은 기간 `sec-filings-search/symbol?symbol=RKLB`는 아래 2건을 반환했다.
  - `8-K` / accession `0001628280-26-018789`
  - `424B5` / accession `0001628280-26-018770`
- 같은 기간 `sec-filings-search/form-type?formType=8-K`와 `sec-filings-8k`도 RKLB `8-K`를 반환했다.
- 따라서 “특정 ticker의 filing을 놓치지 않는 수집” 목적에는 `sec-filings-search/symbol`이 더 적합하다.
- live payload shape 확인 결과, `sec-filings-search/symbol`도 서술형 필드를 주지 않았다.
  - 실제 필드: `symbol`, `cik`, `filingDate`, `acceptedDate`, `formType`, `link`, `finalLink`
  - 없음: `title`, `summary`, `text`, `description`, `body`

### 핵심 설계 원칙
1. **FMP PR는 별도 데이터 타입으로 승격한다**
  - DB 저장값은 `source='FMP'`, `source_type='fmp_press_release'`로 둔다.
  - 기존 FMP `press_release` row도 새 타입으로 마이그레이션한다.
2. **기존 PR 흐름을 깨지 않는다**
   - Finnhub `press_release`와 RTPR route는 그대로 둔다.
  - 새 FMP PR는 별도 버튼/route로 병행 추가한다.
3. **필터는 새 sourceType 기준으로 분리한다**
  - `fmp pr`는 목록 조회에서 `source_type='fmp_press_release'`로 직접 처리한다.
4. **full text는 원문 추출 경로를 재사용한다**
   - FMP `text`를 full text로 저장하지 않는다.
  - 기존 `extractByDomain` 기반 추출을 `fmp_press_release` 대상에만 돌리는 방식으로 확장한다.

### Full Text 전략 정리

#### FMP PR full text
- 현재처럼 `fmp pr full text` 버튼을 별도로 두는 설계가 맞다.
- 동작 원칙은 아래와 같다.
  - FMP 응답의 `text`는 preview/summary로만 취급한다.
  - full text는 저장된 원문 `url`을 다시 방문해 추출한다.
  - 즉 `fmp pr full text`는 `source_type='fmp_press_release'` row에 대해 원문 URL 재방문 + extractor 실행을 의미한다.

#### FMP SEC full text
- FMP SEC는 응답 payload만으로 full text를 얻는 구조가 아니다.
- live probe 기준 FMP SEC filing family는 메타데이터 + 링크를 주는 구조에 가깝다.
  - `finalLink`: 실제 SEC 문서 본문 링크
  - `link`: filing index 링크
- 따라서 FMP SEC full text가 필요하면 아래 경로를 따라야 한다.
  - `finalLink` 우선
  - 실패 시 `link` 보조
  - SEC 문서 HTML/XML/iXBRL 직접 파싱

#### 버튼 개념 정리
- 지금 당장 `FMP SEC full text` 버튼을 추가하는 것보다, 향후 별도 기능이 필요해질 때 `SEC filing full text`라는 독립 개념으로 설계하는 편이 더 자연스럽다.
- 이유는 SEC full text의 핵심 차이가 provider보다 문서 파싱 방식에 있기 때문이다.
- 단, 나중에 `FMP SEC`를 `Finnhub SEC`와 완전히 분리된 별도 데이터셋으로 운영하기로 결정하면 그때는 `FMP SEC full text` 전용 버튼도 가능하다.
- 현재 리비전에서는 legacy `Finnhub SEC filing`을 제거했고 `FMP SEC`는 아직 미구현이므로, SEC full text 버튼은 이번 범위 밖이다.

### Glossary
- `fmp pr`
  - UI에서 보이는 새 필터 이름이다. DB 내부에서는 `source='FMP' AND source_type='fmp_press_release'`를 뜻한다.
- `recent fmp pr update`
  - 기본 universe ticker별로 FMP press release endpoint를 호출한 뒤, 각 ticker의 마지막 `fmp_press_release` anchor 이후 row만 저장하는 동작이다.
- `custom fmp pr update`
  - 기본 universe ticker별로 FMP press release endpoint를 호출한 뒤, 응답 row를 앱에서 `from~to`로 다시 잘라 저장하는 동작이다.
- `fmp pr full text`
  - `source_type='fmp_press_release'`이고 아직 full text가 없는 row만 골라 기존 fulltext extractor를 돌리는 동작이다.

### 작업 전 확인 포인트
1. `fmp pr` 필터는 단순 UI 라벨 추가로 끝나지 않는다.
   - 현재 fetch query가 FMP를 아예 제외하고 있으므로 `source_names`도 같이 수정해야 한다.
2. backend fulltext update는 현재 provider-aware filter가 없다.
  - `press_release` 전체가 아니라 `fmp_press_release`만 선택할 수 있게 확장해야 한다.
3. 기존 DB에 이미 저장된 `source='FMP' AND source_type='press_release'` row는 새 타입으로 보정해야 한다.
4. FMP PR custom/recent는 provider server-side date filtering을 신뢰하지 않고 앱에서 date cut을 다시 해야 한다.
5. FMP SEC full text는 단순 provider text 재사용이 아니라 SEC 문서 파싱 문제이므로, PR full text와 같은 버튼 개념으로 즉시 붙이지 않는다.
6. FMP SEC에서 ticker coverage를 우선해야 하면 `sec-filings-financials` 단독 사용을 피해야 한다.
  - primary: `sec-filings-search/symbol`
  - 보강 sweep: `sec-filings-search/form-type?formType=8-K`, 필요 시 `424B5`
7. FMP SEC payload에는 제목/요약 필드가 없으므로, UI/DB title/body는 앱이 직접 생성해야 한다.

### 단계별 계획(각 단계: 구현 → 검증 → 사용자 확인 요청)

#### ⬜ Step 1 — 문서/조회 경로를 FMP PR 기준으로 정리

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 1-1 | 현재 plan을 FMP PR 구현 범위로 재작성 | `ai_agent_plan/terminal_ui_ver6_fmp/plan.md` | 목표/범위/제약 반영 확인 | ✅ |
| 1-2 | 실측 제약(`from/to` 불확실, full text 아님)을 문서화 | 본 문서, `agent_log.md` | 이후 구현 방향과 일치 여부 확인 | ✅ |

- `1-1` 목적: 작업 대상을 SEC/FMP stock이 아니라 FMP PR로 고정하기 위함.
- `1-2` 목적: 구현 중 server-side filtering이나 `text=full text` 같은 잘못된 가정을 막기 위함.

검증 훅:
```powershell
Get-Content c:\github_coding\terminal_sec\ai_agent_plan\terminal_ui_ver6_fmp\plan.md
```
사용자 확인 필요: 예

#### ⬜ Step 2 — Backend FMP press release pull route 추가

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 2-1 | FMP PR provider 추가 | `terminal/backend/src/services/fmpPressReleaseProvider.ts` | 샘플 응답 매핑 확인 | ✅ |
| 2-2 | `recent/custom` route 추가 | `terminal/backend/src/server.ts` | job 시작/중복 guard 확인 | ✅ |
| 2-3 | anchor, date cut, change merge 연결 | `terminal/backend/src/server.ts` | recent 재실행 시 중복 폭주 없음 확인 | ✅ |
| 2-4 | 기존 FMP PR row를 `fmp_press_release`로 마이그레이션 | `terminal/backend/src/db.ts` | 기존 row 보정 여부 확인 | ✅ |

- `2-1` 목적: FMP fetch/mapping/retry 책임을 분리하기 위함.
  - 완료 조건: `source='FMP'`, `source_type='fmp_press_release'`로 저장 가능한 mapped item 함수가 생긴다.
  - 리스크: FMP가 ticker/date filtering을 엄밀히 보장하지 않을 수 있다.
  - 완화: 응답 후 앱에서 날짜 범위를 다시 필터한다.
- `2-2` 목적: frontend에서 별도 버튼으로 직접 호출할 수 있게 하기 위함.
  - 완료 조건: `/api/news/pull-fmp-press-release` 같은 전용 route가 생긴다.
  - 리스크: 기존 `press_release` job key와 충돌할 수 있다.
  - 완화: `fmp_press_release` 전용 active job key를 쓴다.
- `2-3` 목적: recent/custom semantics를 실제로 유지하기 위함.
  - 완료 조건: recent는 `getTickerAnchorMap('fmp_press_release', 'FMP')` 기준, custom은 앱 내 date cut 기준으로 동작한다.
  - 리스크: ticker별 응답이 noisy할 수 있다.
  - 완화: 새 source_type로 분리하고, 기존 row도 마이그레이션해 dedupe 충돌을 막는다.

검증 훅:
```powershell
rg -n "pull-fmp|press_release|getTickerAnchorMap\(|source: 'FMP'|source = 'FMP'" c:\github_coding\terminal_sec\terminal\backend\src
```
사용자 확인 필요: 예

#### ⬜ Step 3 — Full text update를 FMP PR 전용으로 확장

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 3-1 | unextracted 조회에 `sourceName` 필터 추가 | `terminal/backend/src/services/fulltextRepository.ts` | SQL 결과 범위 확인 | ✅ |
| 3-2 | fulltext update service/route에 FMP PR 타입 인자 추가 | `terminal/backend/src/services/fulltextUpdateService.ts`, `terminal/backend/src/server.ts` | `fmp_press_release`만 job 대상이 되는지 확인 | ✅ |
| 3-3 | 기존 `all/company_news/press_release/market_news/rtpr` 흐름 비회귀 확인 | 같은 파일 | 기존 버튼 동작 유지 확인 | ✅ |

- `3-1` 목적: `press_release` 전체가 아니라 `fmp_press_release`만 선택하기 위함.
- `3-2` 목적: `fmp pr full text` 버튼이 실제로 새 FMP PR 타입만 추출하게 하기 위함.
- `3-3` 목적: 기존 FT 메뉴의 동작을 깨지 않기 위함.

검증 훅:
```powershell
rg -n "getUnextractedNewsIds|fulltext/update|sourceName|RTPR|FMP" c:\github_coding\terminal_sec\terminal\backend\src
```
사용자 확인 필요: 예

#### ⬜ Step 4 — Frontend에 `fmp pr` 필터/update/fulltext 버튼 추가

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 4-1 | top filter에 `fmp pr` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 버튼 표시/active 상태 확인 | ✅ |
| 4-2 | 목록 fetch가 FMP를 포함하도록 수정 | 같은 파일 | FMP row 노출 확인 | ✅ |
| 4-3 | `recent/custom fmp pr update` 메뉴 추가 | 같은 파일 | job 시작 + modal 동작 확인 | ✅ |
| 4-4 | `fmp pr full text` 메뉴 추가 | 같은 파일 | FT job 시작 확인 | ✅ |

- `4-1` 목적: 사용자가 FMP PR만 바로 볼 수 있게 하기 위함.
  - 완료 조건: 필터 버튼이 생기고 `source_type='fmp_press_release'`로 조회된다.
- `4-2` 목적: FMP row가 기본 목록에서도 보이게 하기 위함.
  - 완료 조건: 기본 source_names에 `FMP`가 포함된다.
- `4-3` 목적: 별도 FMP PR 전용 수집 액션을 제공하기 위함.
  - 완료 조건: update 메뉴에서 recent/custom 버튼이 보이고 전용 backend route를 호출한다.
- `4-4` 목적: FMP PR만 대상인 full text 추출 액션을 제공하기 위함.
  - 완료 조건: FT 메뉴에서 `FMP PR` 항목이 보이고 `fmp_press_release` payload를 보낸다.

검증 훅:
```powershell
rg -n "source_names|fmp pr|pull-fmp-press-release|fulltext" c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub\src\app\components\FinnhubNewsWindow.tsx
```
사용자 확인 필요: 예

#### ⬜ Step 5 — 빌드 및 수동 검증

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 5-1 | backend/frontend 에러 확인 | 변경 파일 전체 | 타입/런타임 에러 확인 | ✅ |
| 5-2 | workspace build 실행 | `terminal` | build 성공 여부 확인 | ✅ |
| 5-3 | UI 수동 점검 포인트 정리 | 본 문서, `agent_log.md` | 사용자가 직접 볼 수 있는 점검 절차 정리 | ✅ |

검증 훅:
```powershell
npm.cmd run build
```
사용자 확인 필요: 예

#### ⏳ Step 6 — Finnhub News 상단 툴바 레이아웃 정리

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 6-1 | 검색 블록 폭 확대 + 날짜 입력 가독성 개선 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | `get_errors` 0개, 프론트 build 성공 | ⏳ |
| 6-2 | 상단 액션 버튼을 목적별 그룹으로 재배치 | 같은 파일 | JSX 구조/메뉴 동작 코드 리뷰 | ⏳ |
| 6-3 | 프론트 스펙 문서를 현재 레이아웃과 동기화 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 검색 UI 섹션 확인 | ⏳ |

- `6-1` 목적: 긴 검색어와 날짜 값이 한눈에 읽히게 하기 위함.
  - 완료 조건: 좌측 검색 블록이 독립된 카드로 분리되고, 날짜 입력칸이 기존보다 넓어진다.
- `6-2` 목적: 상단 버튼이 한 줄에 몰려 검색 영역을 압박하지 않게 하기 위함.
  - 완료 조건: source filter, view context, action buttons가 서로 다른 줄/그룹으로 정리된다.
- `6-3` 목적: 코드와 프론트 스펙 문서의 레이아웃 설명이 어긋나지 않게 하기 위함.
  - 완료 조건: prompt 문서의 검색 UI 설명이 새 3영역 구조를 반영한다.

검증 훅:
```powershell
Get-Content c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub\src\app\components\FinnhubNewsWindow.tsx | Select-String -Pattern "Search|Source Filter|Columns|Watch Lists"
Set-Location c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub
npm.cmd run build
```
사용자 확인 필요: 예

### 구현 순서 제안
1. Step 1로 plan/log를 먼저 FMP PR 기준으로 고정한다.
2. Step 2에서 backend FMP PR pull route를 추가한다.
3. Step 3에서 fulltext provider filter를 확장한다.
4. Step 4에서 frontend 버튼/필터를 붙인다.
5. Step 5에서 build와 수동 검증을 한다.

### 사용자가 직접 확인할 핵심 포인트
1. `fmp pr` 버튼을 누르면 FMP press release만 보이는지
2. `recent fmp pr update`가 별도 job으로 시작되는지
3. `custom fmp pr update`에서 날짜 범위 선택 후 job이 시작되는지
4. `fmp pr full text`가 `fmp_press_release`만 대상으로 도는지
5. 기존 `Recent Press Release`, `Custom Press Release`, `RTPR Body Backfill`이 그대로 유지되는지

### 현재 상태
- FMP PR provider, pull route, 기존 row 마이그레이션, fulltext filter, frontend 필터/버튼, `gui-pyqt.md` 표현 규칙 수정까지 반영했다.
- 이번 리비전에서 legacy `Finnhub SEC filing` route/UI/DB row 제거를 추가 반영했다.
- PLAN CHANGE 2026-03-21: **FMP SEC filing 신규 구현 완료.**
  - provider, route, companion insert, frontend 필터/업데이트/FT 메뉴 전부 추가.
  - 런타임 검증: 12건 삽입 확인 (`news_items` + `sec_filings` companion).
- 검증 결과:
  - 정적 분석: 변경 파일 기준 에러 0개
  - backend build: 성공
  - frontend build: 성공
  - backend test: `57 passed`
  - backend health: `200 {"ok":true}`
  - legacy route: `POST /api/news/pull-finhub-sec` → `404 Not Found`
  - DB purge: `source_type='sec_filing'` row `0`, `sec_filings` row `0`
  - FMP SEC: `source_type='fmp_sec_filing'` → 12건, `sec_filings` companion → 12건
- 이번 리비전 추가:
  - Finnhub News 상단 툴바를 `검색 블록 / 제어 블록 / 유틸리티 줄` 구조로 재배치했다.
  - 검색창과 날짜 입력칸이 넓어졌고, action 버튼은 여러 줄로 그룹화됐다.
- 남은 것은 사용자가 UI에서 `fmp pr` / `fmp sec` 관련 버튼 흐름을 직접 확인하는 수동 점검이다.