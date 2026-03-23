# FMP API (skill)

### 언제 쓰나
- FMP(Financial Modeling Prep) API를 새로 연동하거나 수정할 때.
- `stock-latest`, `general-latest`, `press-releases`, `fmp-articles`, `sec-filings-*`, `profile` 계열 중 무엇을 써야 할지 먼저 정리해야 할 때.
- FMP 데이터 타입의 성격, ticker 매핑 특성, full text 여부를 먼저 구분한 뒤 backend/UI에 붙여야 할 때.
- RTPR press release feed와 FMP press release를 비교해 대체 가능 범위를 판단해야 할 때.

### 키 / 기준 URL
- 기준 문서: `https://site.financialmodelingprep.com/developer/docs`
- stable base URL: `https://financialmodelingprep.com/stable`
- API key 읽기 경로:
  - 환경 변수 `FMP_API_KEY`
  - `ai_agent_plan/fmp_api_key/fmp_api_key`
- 키 값은 로그/문서/예시 출력에 노출하지 않는다.

### 레포에서 현재 확인된 FMP 사용 지점
- backend provider:
  - `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
  - `terminal/backend/src/services/fmpPressReleaseProvider.ts`
  - `terminal/backend/src/services/fmpSecFilingProvider.ts`
- backend route:
  - `POST /api/company-profiles/pull-fmp`
  - `POST /api/news/pull-fmp-press-release`
  - `POST /api/news/pull-fmp-sec-filing`
- 현재 레포에서 실제 구현된 FMP 저장 대상:
  - 회사 description/profile 계열 (`company_profiles`의 `source='fmp'`)
  - FMP press release (`news_items`의 `source='FMP' AND source_type='fmp_press_release'`)
  - FMP SEC filing (`news_items`의 `source='FMP' AND source_type='fmp_sec_filing'` + `sec_filings` companion)
- 현재 대화 기준 live probe로 접근 확인된 주요 뉴스/규제 계열:
  - `stable/news/general-latest`
  - `stable/news/stock-latest`
  - `stable/news/stock?symbols=AAPL`
  - `stable/news/press-releases-latest`
  - `stable/news/press-releases?symbols=AAPL`
  - `stable/fmp-articles`
  - `stable/sec-filings-financials`
  - `stable/sec-filings-search/symbol?symbol=AAPL`
  - `stable/sec-filings-search/form-type?formType=8-K`
  - `stable/sec-filings-8k`

### Glossary
- `data family`
  - endpoint 하나가 아니라, 같은 성격의 데이터군을 뜻한다. 예: `stock news`, `press release`, `company profile`.
- `ticker 매핑`
  - provider가 한 기사/보도자료에 어떤 종목 코드를 붙이는지에 대한 규칙을 뜻한다.
- `full text`
  - 원문 페이지의 전체 본문에 가까운 텍스트를 뜻한다. headline 또는 첫 문단 발췌와 구분한다.
- `stable endpoint`
  - FMP가 stable docs 기준으로 제공하는 endpoint 경로를 뜻한다.

### FMP 데이터 타입 family 요약

#### 1. Company Profile / Company Information
- 대표 endpoint:
  - `stable/profile?symbol={TICKER}`
- 현재 레포에서 실제 사용 중인 family다.
- 주요 특성:
  - 회사명, description, CEO, 직원수, website, IPO date, market cap, sector, industry 등 회사 메타데이터 중심이다.
  - row 수가 적고 symbol별 독립 요청 구조라 worker pool + throttle 방식이 잘 맞는다.
  - 현재 레포는 이 family를 `company_profiles`에 저장한다.
- 현재 provider에서 실제 쓰는 대표 필드:
  - `[][][]symbol[][][]`
  - `[][][]companyName[][][]`
  - `[][][]description[][][]`
  - `[][][]ceo[][][]`
  - `[][][]sector[][][]`
  - `[][][]industry[][][]`
  - `[][][]website[][][]`
  - `[][][]ipoDate[][][]`
  - `[][][]mktCap[][][]`
  - `[][][]fullTimeEmployees[][][]`
  - `[][][]exchangeShortName[][][]`

#### 2. Stock News
- 대표 endpoint:
  - `stable/news/stock-latest`
  - `stable/news/stock?symbols={TICKER}`
- 주요 특성:
  - 종목 뉴스 feed다.
  - 응답에 `[][][]text[][][]` 필드가 있지만, 이 값은 일반적으로 전체 원문 full text가 아니라 요약/발췌에 가깝다.
  - UI에서 종목 뉴스 섹션을 구성할 때 붙이기 쉽다.
  - 같은 symbol이라도 press release만이 아니라 기사/리포트/콜 transcript 링크 등 다양한 기사 성격이 섞일 수 있다.
- 실제 확인된 대표 필드:
  - `[][][]symbol[][][]`
  - `[][][]title[][][]`
  - `[][][]text[][][]`
  - `[][][]publishedDate[][][]`
  - `[][][]url[][][]`
  - `[][][]publisher[][][]`
  - `[][][]site[][][]`
  - `[][][]image[][][]`

#### 3. General News
- 대표 endpoint:
  - `stable/news/general-latest`
- 주요 특성:
  - ticker 고정이 아닌 일반 뉴스/시장 뉴스 feed에 가깝다.
  - 응답 shape는 stock news와 유사한 편이다.
  - UI에서 `market news`와 비슷한 독립 섹션으로 쓰기 쉽다.

#### 4. Press Releases
- 대표 endpoint:
  - `stable/news/press-releases-latest`
  - `stable/news/press-releases?symbols={TICKER}`
- 현재 구독 상태 기준으로 실제 접근 가능이 확인되었다.
- 주요 특성:
  - wire service 기반 press release feed다.
  - 응답 shape는 stock news와 유사하지만, content 성격은 보도자료다.
  - `[][][]text[][][]` 필드는 존재하지만 full text 전체가 아니라 첫 문단 중심의 발췌/요약에 가깝다.
  - 실제 원문 URL 도메인을 함께 준다.
    - 예: `businesswire.com`, `newsfilecorp.com`, `globenewswire.com`, `accessnewswire.com`, `prnewswire.com`
- 실제 확인된 대표 필드:
  - `[][][]symbol[][][]`
  - `[][][]title[][][]`
  - `[][][]text[][][]`
  - `[][][]publishedDate[][][]`
  - `[][][]url[][][]`
  - `[][][]publisher[][][]`
  - `[][][]site[][][]`
  - `[][][]image[][][]`
- 중요 주의:
  - 같은 press release 제목이어도 provider별 ticker 매핑이 달라질 수 있다.
  - 따라서 `symbols=RKLB` 같은 요청 결과를 “issuer 정답셋”이라고 가정하면 안 된다.

#### FMP PR 데이터 수집 구조 (provider 기준)
- 대표 조회 방식은 2개다.
  - latest feed: `stable/news/press-releases-latest?page=0&limit=20`
  - ticker search: `stable/news/press-releases?symbols=RKLB`
- 현재 대화 기준 live probe에서 실제 payload는 아래 구조였다.
  - `[][][]symbol[][][]`
  - `[][][]title[][][]`
  - `[][][]text[][][]`
  - `[][][]publishedDate[][][]`
  - `[][][]url[][][]`
  - `[][][]publisher[][][]`
  - `[][][]site[][][]`
  - `[][][]image[][][]`
- 운영적 의미:
  - FMP PR는 “제목 + 짧은 발췌 + 원문 링크”를 주는 feed다.
  - 본문 핵심은 `title`, `text`, `url` 조합이다.
  - `text`는 미리보기/요약 용도로는 충분하지만 full text 저장용으로는 불충분할 수 있다.

#### FMP PR 데이터 수집 구조 (현재 레포 구현 기준)
- 현재 레포는 ticker universe를 순회하면서 `stable/news/press-releases?symbols={TICKER}&page={N}&limit={M}` 형태로 수집한다.
- 저장 구조는 아래와 같다.
  - `source='FMP'`
  - `source_type='fmp_press_release'`
  - `title = FMP title`
  - `body = FMP text`
  - `url = 원문 URL`
  - `published_at = publishedDate`
  - `publisher = publisher 또는 site`
- 중요한 현재 구현 제약:
  - provider 호출 URL에는 아직 `from/to`를 직접 붙이지 않고, 받은 응답을 앱 안에서 날짜로 다시 자른다.
  - 즉 custom/recent는 “정확한 server-side 기간 검색”이 아니라 “latest/ticker search 응답 후 local filtering” 성격에 가깝다.
  - recent mode는 ticker별 anchor 이후만 보는 증분 수집이라, 과거 누락분을 자동 복구하지 못할 수 있다.

#### 5. FMP Articles
- 대표 endpoint:
  - `stable/fmp-articles`
- 주요 특성:
  - FMP 자체 기사/분석형 콘텐츠 feed에 가깝다.
  - `press release`/`stock news`와 달리 `[][][]content[][][]` 필드가 상대적으로 길고 본문형에 가깝다.
  - HTML list/markup가 일부 포함될 수 있다.
- 실제 확인된 대표 필드:
  - `[][][]author[][][]`
  - `[][][]content[][][]`
  - `[][][]date[][][]`
  - `[][][]image[][][]`
  - `[][][]link[][][]`
  - `[][][]site[][][]`
  - `[][][]tickers[][][]`
  - `[][][]title[][][]`

#### 6. SEC Filings
- 현재 live probe로 최소 접근 확인된 대표 endpoint:
  - `stable/sec-filings-financials`
- 현재 대화 기준으로 추가 확인된 SEC endpoint:
  - `stable/sec-filings-search/symbol?symbol=AAPL`
  - `stable/sec-filings-search/form-type?formType=8-K`
  - `stable/sec-filings-8k`
- 주요 특성:
  - SEC/재무 filing 계열 데이터 family로 보인다.
  - 다만 현재 레포의 기존 Finnhub `/stock/filings`와 정확히 같은 입력 파라미터와 응답 shape인지는 아직 별도 고정이 필요하다.
  - SEC migration 작업에 쓰기 전에는 accession/form/cik/date/url 필드가 실제로 어떻게 오는지 추가 probe가 필요하다.

#### FMP SEC 데이터 수집 구조 (provider 기준)
- FMP SEC family는 하나의 endpoint만 있는 게 아니라 목적별로 나뉘어 있다.
  - latest SEC feed: `stable/sec-filings-financials?from=...&to=...&page=...&limit=...`
  - symbol search: `stable/sec-filings-search/symbol?symbol=RKLB&from=...&to=...&page=...&limit=...`
  - form type search: `stable/sec-filings-search/form-type?formType=8-K&from=...&to=...&page=...&limit=...`
  - 8-K 전용 feed: `stable/sec-filings-8k?from=...&to=...&page=...&limit=...`
- 현재 대화 기준 live probe에서 `sec-filings-search/symbol` payload는 아래 7개 필드만 확인되었다.
  - `[][][]symbol[][][]`
  - `[][][]cik[][][]`
  - `[][][]filingDate[][][]`
  - `[][][]acceptedDate[][][]`
  - `[][][]formType[][][]`
  - `[][][]link[][][]`
  - `[][][]finalLink[][][]`
- 중요한 점:
  - FMP SEC payload에는 `[][][]title[][][]`, `[][][]summary[][][]`, `[][][]text[][][]`, `[][][]description[][][]`, `[][][]body[][][]`가 없다.
  - 즉 provider는 filing 메타데이터 + SEC 링크를 주고, 사람이 읽을 headline/summary는 주지 않는다.
  - filing 내용을 알고 싶으면 `finalLink` 또는 `link`를 따라 SEC 원문을 직접 읽어야 한다.

#### FMP SEC 데이터 수집 구조 (현재 레포 구현 기준)
- 현재 레포의 primary SEC endpoint는 `stable/sec-filings-search/symbol`이다.
- 동작 방식은 아래와 같다.
  1. route가 default universe ticker 목록을 만든다.
  2. provider가 ticker별로 `stable/sec-filings-search/symbol?symbol={TICKER}&from=...&to=...&page=...&limit=...`를 호출한다.
  3. page를 순회하면서 filing을 모은다.
  4. `acceptedDate`를 기준으로 앱에서 날짜 범위를 한 번 더 검증한다.
  5. accession number를 dedupe key로 사용한다.
  6. `news_items`와 `sec_filings` companion row를 함께 저장한다.
- 현재 저장 규칙:
  - `source='FMP'`
  - `source_type='fmp_sec_filing'`
  - `title = "{symbol}: {formType}"` 처럼 앱이 생성
  - `body = "Filed {date}, accepted {date}. CIK: {cik}."` 처럼 앱이 생성
  - `url = finalLink`
  - `published_at = acceptedDate`
  - `publisher = 'SEC/EDGAR'`
- 운영적 의미:
  - 현재 UI/DB에 보이는 제목/요약은 FMP 원문 필드가 아니라 앱이 만든 메타 요약이다.
  - richer summary가 필요하면 SEC 원문 파싱 또는 후처리 요약 단계가 추가로 필요하다.
  - ticker coverage는 이전 `sec-filings-financials` 단독 방식보다 개선됐지만, universe 규모만큼 API 호출 수는 증가한다.

#### FMP SEC endpoint 선택 가이드 (이번 대화에서 검증됨)
- `sec-filings-financials`는 문서상 유효한 latest feed지만, ticker coverage hole이 있을 수 있다.
- 실제 반례:
  - RKLB `2026-03-17 ~ 2026-03-18` offering 관련 filing은 `sec-filings-financials`에서는 `0건`이었다.
  - 같은 기간 `sec-filings-search/symbol?symbol=RKLB`는 `8-K`, `424B5`를 반환했다.
  - `sec-filings-search/form-type?formType=8-K`와 `sec-filings-8k`도 RKLB `8-K`를 반환했다.
- 따라서 “특정 ticker의 filing을 놓치지 않는 수집” 목적이면:
  - primary: `sec-filings-search/symbol`
  - secondary: `8-K` 전용 sweep (`form-type=8-K` 또는 `sec-filings-8k`)
  - 필요 시 `424B5`, `S-3`, `FWP` 등 offering 관련 form을 추가 감시
- 반대로 “시장 전체 recent SEC 흐름 overview” 목적이면 `sec-filings-financials`도 여전히 쓸 수 있다.

### FMP news / press release 계열의 공통 특성
- `title`, `publishedDate`, `publisher`, `site`, `url`, `image`, `text` 구조가 반복된다.
- `text`는 “기사/보도자료 전문 전체”가 아니라 앞부분 요약/발췌일 수 있다.
- ticker별 endpoint가 있다고 해서 ticker 매핑이 절대적으로 정확한 것은 아니다.
- `publisher`와 `site`는 실제 원문 배포 채널을 추적할 때 유용하다.
- latest 계열과 ticker 계열이 모두 존재하더라도 결과셋은 완전히 일치하지 않을 수 있다.

### FMP `text` vs full text
- 직접 확인 결과, press release/news 계열의 `[][][]text[][][]`는 full text 전체로 보기 어렵다.
- 실제 샘플 비교:
  - 제목: `Carlyle Commodities Announces Resignation of Vice President of Exploration`
  - FMP `text` 길이: `267자`
  - 같은 원문 페이지 추출 텍스트 길이: `8923자`
- 운영적 의미:
  - FMP `text`는 UI preview/summary 용도로는 충분할 수 있다.
  - 하지만 본문 검색, fulltext backfill, 원문 추출 품질이 중요한 기능에서는 원문 URL을 다시 fetch하는 단계가 필요할 수 있다.
- 예외적으로 `stable/fmp-articles`의 `[][][]content[][][]`는 훨씬 길고 본문형에 가깝다.

### FMP press release vs RTPR 차이

#### 공통점
- 둘 다 wire-service 기반 press release feed를 제공한다.
- 실제 최신 feed에서 상당수 제목이 겹친다.
- 공통으로 보인 배포 채널 계열:
  - Business Wire
  - Newsfile Corp
  - GlobeNewswire
  - Accesswire / ACCESSWIRE
  - PR Newswire

#### 차이점
1. **response shape 차이**
   - FMP press release:
     - `symbol`, `title`, `text`, `publishedDate`, `url`, `publisher`, `site`
   - RTPR:
     - `ticker`, `exchange`, `title`, `author`, `created`, `article_body`, `article_body_html`
2. **full text 성격 차이**
   - FMP press release의 `text`는 대체로 짧은 발췌에 가깝다.
   - RTPR는 `article_body`, `article_body_html`를 주므로 본문 저장 전략과 더 잘 맞는다.
3. **ticker 매핑 차이**
   - 같은 제목인데도 ticker가 다르게 붙는 사례가 실제로 확인되었다.
   - 예:
     - `Carlyle Commodities Announces Resignation of Vice President of Exploration`
       - FMP: `CG`
       - RTPR: `CCC`
     - `Defence Therapeutics Announces Warrant Terms Amendment`
       - FMP: `DTCFF`
       - RTPR: `DTC`
4. **ticker별 결과셋 차이**
   - 같은 최근 구간 + 같은 ticker라도 결과 수가 다를 수 있다.
   - 최근 7일 직접 비교:
     - `RKLB`
       - FMP `2건`
       - RTPR `1건`
       - 공통 제목 `1건`
     - `RCAT`
       - FMP `1건`
       - RTPR `0건`
5. **URL 정보 차이**
   - FMP press release는 원문 URL을 응답에 직접 준다.
   - RTPR live REST 응답에는 현재 확인 기준 직접 URL 필드가 없다.
   - 대신 `article_body_html`가 있다.

#### 가장 안전한 해석
- `RTPR`와 `FMP press release`는 **같은 카테고리의 feed**지만, **동일 데이터셋**은 아니다.
- latest feed는 일부 많이 겹칠 수 있다.
- 하지만 ticker 매핑, publisher 비중, ticker별 결과 수, full text 성격은 다를 수 있다.
- 따라서 “FMP press release가 열렸으니 RTPR를 그대로 1:1 대체 가능”이라고 가정하면 안 된다.

### 구현 판단 가이드

#### FMP를 우선 검토해도 되는 경우
- provider 수를 줄이고 싶을 때
- UI preview 중심으로 `title + text + url + publisher + publishedDate`면 충분할 때
- stock/general/press release를 한 provider family 안에서 묶고 싶을 때

#### RTPR를 유지하는 편이 나은 경우
- `article_body_html` 또는 더 긴 본문 저장이 필요할 때
- press release 전용 fulltext/backfill 전략이 중요할 때
- ticker별 press release coverage를 RTPR 기준으로 이미 운영 중일 때

#### 병행 운영이 나은 경우
- FMP는 broad feed / UI preview용
- RTPR는 press release fulltext/정교한 PR 처리용
- 두 feed의 중복/불일치를 비교하며 점진적으로 전략을 바꾸고 싶을 때

### 추천 구현 패턴
- company profile은 현재처럼 FMP provider를 별도 유지한다.
- stock/general news는 `source='FMP'`와 `source_type`을 분리해서 저장한다.
- press release는 아래 둘 중 하나를 명시적으로 고른다.
  1. `FMP only`: `text`를 summary로 저장하고 필요 시 URL fetch로 fulltext backfill
  2. `RTPR only`: press release 전용 본문 저장 유지
  3. `dual-source`: FMP와 RTPR를 별도 source로 저장하고 UI/분석 레이어에서 통합
- FMP PR를 앱에서 별도 데이터 타입으로 다루기로 결정했다면, `source='FMP'`, `source_type='fmp_press_release'`처럼 별도 source_type으로 승격하는 편이 query/filter/fulltext/job 구분에서 더 명확하다.
- 이미 `source='FMP' AND source_type='press_release'`로 저장된 row가 있다면, 새 타입으로 마이그레이션한 뒤 수집을 이어가야 `(source, url)` dedupe 충돌을 피할 수 있다.
- SEC migration 전에는 filing endpoint shape를 별도 probe해서 accession/form/date/url 필드를 먼저 고정한다.
- SEC를 news headline feed처럼 다루면 안 된다.
  - FMP SEC는 본질적으로 metadata + link feed다.
  - title/summary가 필요하면 앱 생성 또는 SEC 원문 후처리가 필요하다.
- 특정 ticker coverage가 중요하면 `sec-filings-financials`보다 `sec-filings-search/symbol`을 먼저 검토한다.

### 속도 / 운영 규칙
- symbol별 독립 요청은 `.github/copilot-skills/finhub_other_api.md`의 병렬화 원칙을 따른다.
- 현재 레포의 FMP profile provider는 아래 기본값을 사용한다.
  - concurrency 기본 `5`
  - request interval 기본 `250ms`
  - 429는 backoff 후 재시도
- 새 FMP provider를 추가할 때도 다음 원칙을 유지한다.
  - process-global throttle 또는 공통 rate limiter 사용
  - 429는 재시도, 401/403/명백한 입력 오류는 즉시 실패
  - 기존 DB max date/anchor가 있으면 증분 수집 우선

### 하지 말 것
- `text`가 있으니 full text가 확보된다고 가정하지 않는다.
- `symbols={ticker}` 결과를 issuer 정답셋으로 단정하지 않는다.
- FMP press release와 RTPR를 같은 데이터셋으로 간주해 dedup key를 섣불리 공유하지 않는다.
- `search-press-releases`처럼 현재 probe가 불안정한 endpoint를 검증 없이 구현 핵심 경로에 넣지 않는다.

### 검증 포인트
- 동일 ticker 최근 7일 결과를 FMP와 RTPR에서 각각 호출해 count/title 겹침을 본다.
- FMP `text` 길이와 원문 URL 텍스트 길이를 비교해 full text 여부를 확인한다.
- press release latest에서 `publisher/site/url` 분포를 보고 wire diversity를 확인한다.
- SEC endpoint를 쓸 때는 accession/form/date/url 존재 여부를 샘플 응답으로 먼저 확인한다.