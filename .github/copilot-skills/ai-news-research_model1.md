### 모델 분류

#### `🟦 Model_1_new news analysis`

목적:

- 현재 분석 중인 뉴스 1건이 주가에 어떤 영향을 줄 가능성이 있는지, 과거의 유사 뉴스와 비교해 판단한다.
- 같은 ticker의 과거 유사 이슈뿐 아니라, 다른 ticker에서 발생했던 유사 뉴스/이슈도 함께 참조한다.

**Model_1 시작부 분석 데이터 기간 표기 규칙 (최우선)**

- 모든 `Model_1` 산출물은 제목 또는 날짜 헤더 바로 아래, **첫 실질 본문 줄**에 반드시 `분석 데이터 기간: YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm (timezone)`를 적는다.
- 이 줄은 상단 요약 표, 현재 뉴스 요약, `source check`, `primary/secondary/watch` 표보다 먼저 와야 한다.
- 사용자가 문서를 펼쳤을 때 **이번에 실제로 분석한 데이터의 날짜/시각 범위**를 즉시 알 수 있어야 하며, 날짜만 적거나 시각이 빠진 출력은 완료본으로 보지 않는다.

작업 절차 (3단계 구조):

`Model_1`은 아래 3단계를 순서대로 수행한다. 각 단계의 역할이 다르므로 단계를 건너뛰거나 합치지 않는다.

**Model_1 간접 영향 전파 기능: `model_1_2_investing` (필수 규칙 추가)**

- `model_1_2_investing`은 `Model_1`의 기본 3단계를 대체하는 별도 모델이 아니라, **DB 기반 Model_1 분석을 끝낸 뒤 마지막에 수행하는 간접 영향 전파 점검 단계**다.
- 즉 실행 순서는 아래처럼 고정한다.
  1. `Model_1` 기본 3단계로 `app.db` 중심 분석을 먼저 끝낸다.
  2. **기본 3단계가 완전히 끝난 후(오너쉽 가감점 반영 + 최종 등급 확정 + research page 저장까지 완료), 채팅에서 사용자에게 `investing 작업도 이어서 할까요?`라고 명시적으로 물어본다.**
  3. **사용자가 긍정 응답(예: "해", "응", "진행", "이어서 해" 등)을 한 뒤에만** `model_1_2_investing`으로 **Investing 웹사이트의 시황/정책/섹터 기사**를 추가 조사한다.
  4. 마지막에 DB 기반 결론과 Investing 조사 결과를 합쳐, `외부 이슈`, `ticker 비직접 기사`, `watchlist/readthrough 후보`가 있는지 재점검한다.
- **`model_1_2_investing` 사용자 확인 게이트 규칙:** 에이전트가 사용자 응답을 기다리지 않고 자동으로 investing 단계에 진입하면 안 된다. 기본 3단계 결과가 이미 research page에 저장된 상태에서 사용자가 원하면 이어서 하고, 원하지 않으면 기본 3단계 결과만으로 Model_1 산출물을 닫는다.
- 이 단계의 목적은 **DB에 직접 적재되지 않았거나 ticker에 직접 매핑되지 않아 놓치기 쉬운 외부 이슈가 어떤 공개 ticker 바스켓에 영향을 전파하는지 닫는 것**이다. 특히 아래 유형을 우선 대상으로 본다.
  - `macro / market structure / regulation / legislation`
  - `sector-wide risk-on / risk-off`
  - `theme 기사인데 개별 ticker가 headline에 직접 안 붙은 경우`
  - `한 ticker 기사로는 안 보이지만 여러 peer에 동시에 영향을 줄 수 있는 경우`
- `model_1_2_investing`은 기존 `same-ticker / other-ticker` 유사사례 비교를 덮어쓰지 않는다. 다만 **단순 보강 메모로 끝내지 않고, 외부 이슈 -> 영향 경로 -> impacted ticker -> 현재 분석 universe 안의 ripple candidate를 명시적으로 닫는 단계**로 사용한다.

**`model_1_2_investing` 운영 메커니즘 (필수)**

- `model_1_2_investing`은 아래 3층 구조를 강제로 남긴다.
  1. `external issue`: 기사에서 직접 다루는 외부 사건 또는 테마
  2. `transmission path`: 그 사건이 어떤 경제 경로로 공개 ticker에 영향을 줄 수 있는지
  3. `ripple candidate`: 현재 분석 universe 안에서 실제로 재점검해야 할 ticker
- 즉 이 단계는 `외부 기사 한 줄 소개`가 아니라, **외부 사건을 현재 ticker 판단 체계로 변환하는 메커니즘**이어야 한다.
- `transmission path`는 최소한 아래 중 하나로 설명해야 한다.
  - `revenue model linkage`
  - `peer repricing basket`
  - `supply chain / customer linkage`
  - `policy / regulation beneficiary or loser`
  - `valuation narrative transfer`
- `ripple candidate`를 적을 때는 반드시 `왜 이 ticker가 readthrough 후보인지`를 한 줄 이상 적는다. 단순 나열은 금지한다.
- 외부 이슈가 중요해 보여도 현재 분석 universe에 연결되는 공개 ticker 후보를 하나도 못 닫으면, `외부 이슈 확인됨 / 현재 universe 연결 약함`으로 적고 종료할 수 있다. 반대로 공개 ticker 연결이 닫히면 `supplement`가 아니라 **필수 재평가 대상**으로 취급한다.

**`model_1_2_investing` 조사 범위 규칙 (필수)**

- 조사 source는 기본적으로 **Investing 웹사이트**로 한정한다.
- 우선적으로 확인할 기사 범주는 아래를 기본값으로 둔다.
  - `Stock Markets`
  - `Company News`
  - `Cryptocurrency`
  - `Economy`
  - `Breaking News`
- 단, 모든 기사를 전수로 읽는 것이 아니라 **현재 분석 기간과 직접 연결될 가능성이 높은 시황/정책/섹터 기사**부터 본다.
- 우선 검색 키워드는 현재 날짜 이슈와 연결되는 **테마 단어**를 중심으로 잡는다. 예:
  - `stablecoin`, `crypto bill`, `Clarity Act`, `yield restriction`, `AI regulation`, `FDA sector readthrough`, `tariff`, `export control`
- `ticker 직접 언급`이 없는 기사라도 아래 중 하나를 만족하면 조사 대상으로 올린다.
  - 특정 산업/테마 바스켓 전체에 영향을 줄 수 있는 규제/법안/정책 기사
  - 동일 날짜에 여러 관련주가 함께 움직였는데, DB 기사만으로는 공통 원인이 설명되지 않는 경우
  - FMP `stock/general/press release`나 DB canonical source에는 없지만, 시장 내러티브를 실제로 형성한 것으로 보이는 기사
- 위 조건을 만족한 기사는 **직접 ticker 언급이 약하더라도 `external issue 후보`로 먼저 채택**하고, 그 다음 공개 ticker/readthrough 후보를 닫는 순서로 처리한다.

**`model_1_2_investing` 시간 / 시각 해석 규칙 (필수)**

- Investing 기사 페이지에 표시된 시각은 **timezone이 명시되지 않을 수 있으므로**, 그대로 절대시각으로 단정하지 않는다.
- 가능하면 아래 3개를 분리해서 기록한다.
  1. `page displayed time`: 원문 페이지에 보이는 발행 시각
  2. `rss / aggregator time`: Bing News RSS 등 외부 feed에서 확인한 시각
  3. `timezone status`: `명시됨`, `미확정`, `확인 필요`
- `page displayed time`과 `rss time`이 충돌하면, **절대시각 비교는 timezone이 명시된 값이 우선**이다.
- 단, RSS 시각도 `원문 최초 게시 시각`과 100% 동일하다고 단정하지 않는다. 따라서 최종 note에는 가능하면 `RSS 기준 earliest candidate`, `page displayed time (timezone unspecified)`처럼 **증거 레벨을 구분해 적는다.**

**`model_1_2_investing` 영향 전파 규칙 (필수)**

- Investing 기사에서 직접 ticker가 안 보여도, **경제 사건이 특정 테마/산업 바스켓에 영향을 줄 수 있으면 impacted ticker 후보를 명시적으로 적는다.**
- 이때 impacted ticker는 아래 3축으로 적는다.
  1. `directly mentioned ticker`
  2. `theme-linked ticker`
  3. `watch-only peer`
- 예:
  - `stablecoin regulation -> CRCL, COIN, HOOD`
  - `AI chip export control -> NVDA, AMD, SMCI, AI infra peers`
- 이 전파는 어디까지나 **해석 가능한 영향 경로를 설명하기 위한 것**이지, 기사에 없는 ticker를 임의로 추가 source처럼 꾸미는 용도로 사용하면 안 된다.
- 따라서 전파 결과를 적을 때는 반드시 `왜 이 ticker가 영향권이라고 보는지`를 짧게 남긴다. 예: `stablecoin 수익모델`, `exchange rewards exposure`, `peer repricing basket`.
- 이 단계에서 중요한 것은 `기사에 ticker가 직접 적혀 있느냐`가 아니라, **외부 사건이 공개 종목 valuation / 기대 / 자금 유입 논리에 전염될 수 있느냐**다.
- 예를 들어 `SpaceX IPO 기대`처럼 비상장 실체가 중심인 이슈도, 공개시장에서는 `direct exposure narrative`, `peer basket repricing`, `retail speculation transfer`를 통해 `TSLA`, `HOOD`, `우주/위성 관련 ticker`, `관련 인프라 ticker`의 readthrough 후보가 될 수 있다.
- 따라서 `비상장 entity 중심 이슈`, `정책/법안 이슈`, `거시 테마 이슈`는 **직접 ticker 부재만으로 탈락시키지 말고 먼저 영향 전파 가능성부터 판단**한다.

**`model_1_2_investing` 산출물 규칙 (필수)**

- `model_1_2_investing`을 수행했다면, 최종 note 또는 research page 본문에 최소한 아래 항목을 추가한다.
  1. `Investing 간접 영향 점검 여부`
  2. `조사한 핵심 기사 목록` (제목, source, time evidence)
  3. `external issue -> transmission path -> impacted ticker` 구조 요약
  4. `직접 ticker 언급이 없지만 영향 가능성이 있다고 본 ticker 바스켓`
  5. `기존 DB 분석 대비 추가로 발견한 내용`
  6. `시간 정보의 확실성 수준` (`확정`, `RSS 기준`, `timezone 미확정` 등)
- 이 섹션은 가능하면 `📰 model_1_2_investing` 같은 별도 소제목으로 분리한다.
- 최종 결론에는 아래 중 무엇이 바뀌었는지 명시해야 한다.
  - `기존 결론 유지`
  - `watch 후보 추가`
  - `primary/secondary 재검토 필요`
  - `시장 내러티브 설명력 보강`
- 가능하면 산출물 안에서 아래 3개 소제목을 분리한다.
  - `External Theme / Issue`
  - `Readthrough To Public Tickers`
  - `Universe Ripple Candidate Recheck`

**`model_1_2_investing` 가드레일 (필수)**

- Investing 확장 조사는 **DB canonical source를 대체하지 않는다.** 기본 source of truth는 여전히 `app.db`와 기존 `Model_1` 조사 결과다.
- Investing 기사만 보고 `same-ticker / other-ticker` 유사사례 조사 없이 강한 등급 상향을 하면 안 된다.
- Investing 기사에서 강한 내러티브가 보이더라도, 그것이 현재 뉴스 사건의 핵심 경제 성격과 다르면 무조건 버리는 것이 아니라 먼저 `readthrough candidate` 여부를 닫는다. 다만 연결 고리가 약하면 그때 `reference macro article`, `theme context`, `watch reason`으로만 남긴다.
- 한 날짜에 Investing 기사 수가 많더라도, **주가 영향 경로가 명확한 기사만 채택**한다. generic market wrap, 얕은 commentary, 정보량이 낮은 recap은 제외한다.
- `model_1_2_investing`까지 끝나야만 Model_1이 완료된다고 항상 강제하지는 않는다. 다만 사용자가 Investing 점검을 명시적으로 요청했거나, DB 기사만으로 공통 내러티브 설명이 비어 있거나, 외부 이슈의 간접 파급 가능성이 명백한 경우에는 **사실상 필수 단계**로 본다.
- 외부 이슈가 확인되었는데 `현재 분석 universe에 미칠 수 있는 공개 ticker 영향`을 점검하지 않고 넘어가면, `model_1_2_investing`을 수행했다고 볼 수 없다.

**Model_1 소스 커버리지 규칙 (필수)**

- DB 구조 변경 이후 `Model_1`에서 현재 뉴스와 관련 공시/보도자료를 볼 때는 **아래 3개 소스를 함께 확인하는 것**을 기본값으로 둔다.
  - `FMP PR`: `source='FMP'`, `source_type='fmp_press_release'`
  - `press release 데이터`: 현재 앱의 press release provider dataset (`RTPR`/`PTPR` 등 별도 press release source)
  - `FMP SEC`: `source='FMP'`, `source_type='fmp_sec_filing'`
- 즉 `Model_1`에서 보도자료 계열을 볼 때는 **FMP PR만 보고 끝내면 안 되고**, `press release` provider 데이터도 같이 확인해야 한다. 두 feed는 제목, ticker 매핑, 본문 길이, coverage가 완전히 같지 않을 수 있다.
- `FMP SEC`는 `Model_1`에서 **모든 form을 다 보는 것이 아니라 `8-K`만 확인**한다. 기본 해석 대상은 material event disclosure이며, `10-K`, `10-Q`, `S-3`, `424B5`, `FWP` 등 다른 form은 사용자가 명시적으로 요청하지 않는 한 `Model_1` 기본 조사 범위에 포함하지 않는다.
- 따라서 `Model_1`의 source check가 완료되었다고 쓰려면, 최소한 `FMP PR 확인`, `press release provider 확인`, `FMP SEC 8-K 확인`의 3개 체크가 모두 끝나 있어야 한다.
- 세 소스 중 일부가 비어 있거나 DB에 아직 적재되지 않았으면 이를 숨기지 말고 `소스 없음`, `결과 0건`, `적재 확인 필요`처럼 명시한다. 데이터 부재를 다른 소스가 자동 대체한다고 가정하지 않는다.

**Model_1 데이터 사용 가드레일 (필수)**

- `Model_1`에서는 **현재 분석 대상 기간에 속한 뉴스의 후행 change 데이터**를 보고 중요도를 정하면 안 된다.
- 즉 `2026-03-11 09:30 ~ 2026-03-12 16:00 (America/New_York)` 뉴스를 분석하는 중이라면, 그 기간 기사들의 `[][][]change_pct[][][]`, `[][][]change_from_open_pct[][][]`, `[][][]change_open_to_high_pct[][][]`, `[][][]change_1d_pct[][][]`, `[][][]change_3d_pct[][][]`, `[][][]change_7d_pct[][][]`, `[][][]change_14d_pct[][][]`, `[][][]change_30d_pct[][][]`는 **현재 기사 평가 근거로 사용 금지**다.
- `change` 계열 데이터는 오직 **현재 뉴스보다 과거에 발생한 유사사례**에 대해서만 사용할 수 있다.
- 다시 말해 `Model_1`에서 허용되는 가격 데이터는 항상 `현재 분석 중인 뉴스의 published_at 이전`에 나온 기사들의 historical reaction뿐이다.
- 따라서 현재 기사의 importance는 먼저 `headline / body / full_text / 기업 컨텍스트`로 1차 판단하고, 그 다음 `과거 유사사례의 change 분포`로만 보강한다.
- 이 원칙은 `change_from_open_pct`에도 동일하게 적용된다. intraday 반응 구조 해석은 과거 유사사례에 대해서만 가능하며, 현재 기사에 대해서는 같은 날 intraday move를 보고 importance를 올리거나 내리면 안 된다.
- 구현 레벨에서는 **current-news용 API와 일반 뉴스 API를 분리**하는 것을 기본값으로 둔다. 현재 레포 기준으로는 backend `[][][]/api/model1/news[][][]`, `[][][]/api/model1/news/:id[][][]`가 `[][][]model1_current_news_view[][][]`만 조회하는 Model_1 safe endpoint다.
- 위 Model_1 safe endpoint는 `news_items` / `news_fulltext` / `news_ai_analysis` 기반 projection만 반환하고, current-news용 응답 JSON에는 `[][][]change_*[][][]`, `[][][]ohlc_*[][][]` 필드를 포함하지 않는다.
- 따라서 **현재 뉴스 목록/상세를 Model_1로 읽는 UI나 agent는 공용 `[][][]/api/news[][][]`가 아니라 `[][][]/api/model1/news[][][]` 계열을 사용**해야 한다. 공용 `[][][]/api/news[][][]`는 일반 운영/모니터링용이며 change 필드를 계속 포함할 수 있다.

**Model_1 분석 데이터 기간 표기 규칙 (필수)**

- `Model_1` 산출물에서는 **분석한 기간을 날짜만 쓰지 말고, 시작 시각과 종료 시각까지 포함한 datetime range로 명시**해야 한다.
- 기본 표기 형식은 `분석 데이터 기간: YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm (timezone)` 으로 고정한다. 예: `분석 데이터 기간: 2026-03-11 09:30 ~ 2026-03-12 16:00 (America/New_York)`.
- 날짜 헤더가 이미 있더라도 그것만으로는 부족하다. 상단 요약, 최종 note, research page 중 사용자가 실제로 읽는 **첫 본문 시작 구간**에 `분석 데이터 기간:` 줄을 둔다. 이 줄은 가능하면 해당 블록의 첫 줄이어야 한다.
- 하루치만 분석해도 `2026-03-11`처럼 날짜만 적지 말고 `2026-03-11 09:30 ~ 2026-03-11 16:00`처럼 시각을 끝까지 적는다.
- 기간 경계는 가능하면 실제 스크리닝/조회에 사용한 `published_at` 필터의 시작·종료 시각과 정확히 일치해야 한다. 날짜만 반올림해서 쓰지 않는다.
- 타임존 변환이 들어가면, **최종 표시 타임존을 괄호로 명시**하고 필요하면 source 타임존도 짧게 메모한다. 타임존을 확정할 수 없으면 임의 추정하지 말고 `timezone 확인 필요`를 적는다.
- 여러 날짜를 묶은 note에서도 `2026-03-11 ~ 2026-03-12`처럼 뭉뚱그리지 말고, 실제 분석 범위를 `start datetime ~ end datetime`으로 한 줄에 닫는다.

**Model_1 시가총액 범위 가드레일 (필수)**

- `Model_1`의 기본 분석 대상은 **시가총액 `100B` 미만 ticker**로 제한한다.
- 시가총액이 `100B` 이상인 ticker는 기본적으로 `최종 중요 뉴스 리스트`의 직접 분석 대상에서 제외한다.
- 이유는 `100B` 이상 대형주는 개별 기사 1건이 종목 전체 재평가로 이어지는 빈도와 크기가 중소형주와 구조적으로 다르기 때문이다.
- 단, `100B` 이상 ticker 뉴스가 **유사 경제 사건의 reference case**로 쓰이는 것은 허용한다. 예를 들어 대형 바이오의 FDA approval, 대형 플랫폼의 partnership, mega-cap의 capital return 뉴스는 분포 비교용 참고 사례로 사용할 수 있다.
- 따라서 `100B` 이상 ticker는 `other-ticker 유사사례`, 사건 강도 비교, 대형주 반응 상한선 점검에는 포함될 수 있지만, 특별한 사용자 지시가 없는 한 현재 기간 `핵심 분석 대상 ticker`로 승격하지 않는다.
- 사용자가 명시적으로 `100B 이상도 분석 대상에 포함`하라고 지시한 경우에만 이 제한을 해제한다.
- `Model_1` 최종 서술에서는 **현재 분석 대상 ticker의 시가총액을 숫자로 직접 명시**해야 한다. 가능하면 `Market Cap 4.64B`처럼 현재 기사 요약 바로 아래에 적고, 이 시총 구간이 왜 같은 사건이라도 반응 크기 해석에 중요한지 한 줄 설명한다.
- 현재 ticker의 `market_cap` 값이 없으면 추정하지 말고 `market_cap 데이터 없음`이라고 적고, 그래서 small-cap / mid-cap / large-cap 맥락 보정에 한계가 있다고 함께 적는다.

**Model_1 오너쉽 데이터 가감점 규칙 (필수)**

- `Model_1`에서는 `float %`, `institutional ownership %`, `insider ownership %`를 문서 안에서 편의상 **오너쉽 데이터**로 묶어 부른다. `short interest %`는 여기에 붙는 **포지셔닝 보조 지표**로 다룬다.
- 오너쉽 데이터는 **항상 app DB(Default Ticker Window / `company_profiles` 테이블) 값**을 사용한다. 외부 사이트(GuruFocus, Finnhub ownership API, Yahoo, SEC 등)에서 별도로 받아오거나 fallback 계산을 하지 않는다. DB에 해당 값이 없으면 `데이터 없음`으로 적고, 외부에서 보강하지 않는다.
- 여기서 DB 값은 `GET /api/tickers` default-universe row에 노출되는 `floatPct`, `institutionalPct`, `insiderPct`를 뜻한다.
- `Model_1`에서는 뉴스 사건 자체와 과거 유사사례 분포가 1차 판단 기준이고, 오너쉽 데이터는 그 뒤에 붙는 **가감점 보조 요소**로 사용한다.
- 오너쉽 데이터의 점수 방향은 아래처럼 고정한다.
  - `float %`가 **높을수록 +**, 낮을수록 **-**. 유동물량이 넓으면 뉴스 기반 반응성이 커질 수 있고, 좁으면 유동성 제약으로 반응 해석이 왜곡될 수 있다.
  - `institutional ownership %`가 **낮을수록 +**, 높을수록 **-**. 기관 포지셔닝이 덜 차 있으면 신규 유입 여지가 크고, 이미 높으면 추가 유입 여력이 작다.
  - `insider ownership %`가 **낮을수록 +**, 높을수록 **-**. insider 보유가 높으면 유통 물량이 잠기면서 유동성이 줄어들어 뉴스 반응 해석이 왜곡될 수 있고, 낮으면 유통 구조가 열린 상태다.
  - `short interest %`는 방향 가감점이 아니라 **반응 증폭 가능성 보조 지표**로만 해석한다. 높으면 squeeze 가능성을 적되, 동시에 시장의 강한 반대 베팅도 함께 적는다.
- **가산점 밴드 (+ 방향):**
  - `⭐⭐⭐ 강한 가산점 (+)`: `float % >= 80` 이면서 `institutional % <= 35` 이면서 `insider % <= 10`
  - `⭐⭐ 중간 가산점 (+)`: `float % >= 60` 이면서 `institutional % <= 50` 이면서 `insider % <= 20`
  - `⭐ 약한 가산점 (+)`: 위 조건 중 일부만 유리한 경우
- **감점 밴드 (- 방향):**
  - `🔻🔻🔻 강한 감점 (-)`: `float % < 30` 이거나 `institutional % >= 80` 이거나 `insider % >= 40`
  - `🔻🔻 중간 감점 (-)`: `float % < 45` 이면서 (`institutional % >= 65` 이거나 `insider % >= 30`)
  - `🔻 약한 감점 (-)`: 위 조건 중 일부만 불리한 경우
- **중립:** 가산점도 감점도 적용하기 어려운 중간 구간. `⚪ Neutral`로 표기한다.
- 최종 평가 반영 규칙:
  - `강한 가산점 (+)`: 사건·유사사례가 최소 `B+` 이상이면 **최종 등급을 최대 한 단계 상향**. 예: `B+ -> A-`. 동급 후보 사이에서 rank를 앞세우는 근거로도 쓴다.
  - `중간 가산점 (+)`: 동급 후보 사이에서 우선순위를 앞당기거나, 경계선 후보를 한 단계 올릴 수 있다.
  - `약한 가산점 (+)`: 동급 내 선호도 미세조정에 사용.
  - `강한 감점 (-)`: 사건·유사사례가 이미 `A-` 이하이면 **최종 등급을 최대 한 단계 하향**. 예: `A- -> B+`. 동급 후보 사이에서 rank를 뒤로 밀 수 있다.
  - `중간 감점 (-)`: 경계선 후보를 한 단계 내리거나 동급 후보 사이에서 후순위로 조정할 수 있다.
  - `약한 감점 (-)`: 본문에 리스크 메모를 적되, 등급 하향은 보수적으로 적용한다.
  - `중립`: 오너쉽 때문에 별도 상향/하향 근거를 주지 않는다.
- 오너쉽 가감점만으로 약한 사건을 억지 상향하거나, 강한 사건을 억지 하향하면 안 된다. 즉 **오너쉽 가감점은 이미 의미 있는 뉴스 후보의 최종 평가를 조정하는 보조 규칙**이다.
- 등급 조정은 항상 **인접 한 단계만** 허용한다. 오너쉽 데이터만으로 두 단계 이상 점프/강등시키지 않는다.
- `Model_1` 최종 서술에서는 해당 ticker의 `float %`, `institutional %`, `insider %`, `short interest %`를 **가능한 한 숫자로 명시**해야 한다. 예: `Float 82.7%`, `Institutional 24.1%`, `Insider 2.1%`, `Short Interest 23.8%`. 이 수치들이 왜 가산점/감점/중립으로 이어졌는지 짧게 설명한다.
- DB에 값이 없으면 `데이터 없음`으로 적고, 오너쉽 가감점 판단에 한계가 있다고 명시한다. 외부에서 보강하지 않는다.

**Model_1 상단 요약 표 오너쉽 데이터/등급 표기 규칙 (필수)**

- 날짜별 `Current-News 전수 스크리닝 요약` 또는 그에 준하는 **상단 요약 표**를 만들 때는, 가능하면 후보별로 아래 오너쉽 데이터 컬럼을 함께 넣는다.
  - `방향` 또는 `Direction`
  - `Float %`
  - `Institutional %` 또는 `Institutional Ownership Estimate %`
  - `Insider %`
  - `오너쉽 가감점`
  - `최종 등급`
- 즉 상단 표는 필요하면 기존 `Ticker / mcap / Industry / Headline / 분류 / 근거`만으로 끝내지 말고, 최소한 final 경쟁 후보들에 대해서는 `방향`, `float %`, `institutional %`, `insider %`, `가감점`, `최종 등급`이 보이도록 확장한다.
- `short interest %`는 표 폭이 너무 넓어지면 상단 표의 필수 컬럼으로 강제하지는 않지만, 자리가 허용되면 추가한다. 대신 본문 오너쉽 데이터/포지셔닝 섹션에는 계속 적는다.
- 상단 표에서 DB에 오너쉽 데이터가 없는 후보는 `N/A`로 적고 `provisional`로 명시한다. **최종 등급 칸을 비우거나 `보류`로 둔다.** 가감점 반영 전에는 `A+`, `A`, `A-` 같은 확정 등급을 닫지 않는다.
- `insider %`가 실제로 확보되지 않았으면 추정하지 말고 `N/A` 또는 `데이터 없음`으로 적는다. 빈 칸으로 숨기지 않는다.
- 표 안의 숫자는 가능하면 `%`까지 붙인 짧은 형식으로 적는다. 예: `82.7%`, `24.1%`, `N/A`.
- 상단 표는 raw Markdown에서도 한눈에 스캔되어야 하므로, 컬럼 수가 많아지면 headline/근거 문장을 짧게 줄이고 오너쉽/등급 컬럼을 유지하는 쪽을 우선한다.
- 여러 날짜 note에서는 **`primary`만 표에 넣고 `secondary`를 본문 아래로 숨기지 않는다.**
  - 권장 구조는 `primary 확정 표` + `secondary/watch 보조 표`의 2단 구성이다.
  - `secondary`는 가능하면 `방향`, `Float %`, `Institutional %`, `Insider %`, `오너쉽 가감점`, `최종 등급`까지 함께 적는다. 다만 DB에 오너쉽 데이터가 아직 확인되지 않았으면 `보류`, `provisional`, `❔ Pending`으로 표기한다.
  - `watch`는 상세 분석을 끝내지 않았더라도, 적어도 `Ticker`, `Headline (요약)`, `watch 사유`는 상단 표 또는 표 바로 아래 보조 표에 남겨 사용자가 어떤 이름들이 watch인지 즉시 볼 수 있게 한다.

**Model_1 상단 요약 표 방향 표기 규칙 (필수)**

- `primary`, `secondary`, `watch`, `noise`는 **중요도/우선순위 축**이고, `방향(Direction)`은 **price direction 축**이다. 둘을 같은 의미로 쓰면 안 된다.
- 따라서 상단 요약 표에는 가능하면 `분류`와 별도로 `방향` 컬럼을 둔다.
- 기본 방향 표기 형식은 아래처럼 고정한다.
  - `🟢 Long`: 뉴스의 경제적 성격과 과거 유사사례 분포를 볼 때 상승/positive repricing 쪽 해석이 우세한 경우
  - `🔴 Short`: 악재, 희석, 규제 거절, 부정적 deal term 등으로 하락/negative repricing 쪽 해석이 우세한 경우
  - `🟡 Mixed`: 사건은 중요하지만 상승/하락 해석이 섞이거나, positive headline 안에도 overhang/경쟁구도/valuation 부담이 같이 있는 경우
  - `⚪ Unclear`: 아직 방향성이 닫히지 않았거나, 데이터 부족/약한 사건/잡음에 가까워 long/short 어느 쪽도 강하게 주기 어려운 경우
- `Direction`은 **트레이딩 지시를 직접 내리는 컬럼이 아니라**, 현재 뉴스의 가격 반응 방향을 요약하는 해석 태그다.
- 즉 `primary` 안에도 `🟢 Long`과 `🔴 Short`가 모두 들어갈 수 있다. 중요한 악재도 `primary`가 될 수 있다.
- 방향 태그는 headline 인상만으로 닫지 말고, 가능하면 same-ticker / other-ticker 분포와 현재 사건 성격을 함께 보고 확정한다.
- 상단 표에서 `보류`, `임시 후보`, `watch`, `noise`처럼 아직 깊은 분석이 안 된 행은 `⚪ Unclear`를 기본값으로 둘 수 있다.

**Model_1 상단 요약 표 이모티콘/별점 규칙 (필수)**

- `오너쉽 가감점`은 텍스트만 적지 말고 **이모티콘 기반의 시각 점수**를 함께 적는다.
- 기본 표기 형식은 아래처럼 고정한다.
  - **가산점 (+):**
    - `⭐⭐⭐ Strong (+)`: 강한 가산점
    - `⭐⭐ Medium (+)`: 중간 가산점
    - `⭐ Light (+)`: 약한 가산점
  - **중립:**
    - `⚪ Neutral`: 가산점도 감점도 없음
  - **감점 (-):**
    - `🔻 Light (-)`: 약한 감점
    - `🔻🔻 Medium (-)`: 중간 감점
    - `🔻🔻🔻 Strong (-)`: 강한 감점
  - **데이터 부족:**
    - `❔ Pending`: DB에 오너쉽 데이터 없음
- 상단 표의 `오너쉽 가감점` 칸은 가능하면 `⭐⭐ Medium (+)`, `🔻🔻 Medium (-)`, `⚪ Neutral`처럼 **짧고 고정된 토큰**으로 유지한다. 긴 설명은 본문 오너쉽 데이터 섹션에서 푼다.
- 이 점수는 어디까지나 오너쉽 데이터 보조 가감점의 시각 요약이다. 사건 강도나 유사사례 분포를 덮어쓰는 독립 점수처럼 쓰면 안 된다.

**Model_1 최종 등급 표기 규칙 (필수)**

- final 경쟁 후보들에 대해서는 상단 표와 본문에서 **문자 등급(letter grade)** 을 함께 표기한다.
- 기본 등급 체계는 `A+`, `A`, `A-`, `B+`, `B`, `B-`, `C`, `보류`를 사용한다.
- `A+` / `A` / `A-`는 **해당 날짜의 핵심 경쟁 후보들 사이에서 오너쉽 가감점 반영 + same-ticker / other-ticker 조사 + 3단계 재판단까지 끝난 뒤**에만 확정한다.
- `A+`는 같은 날짜 후보 중에서도 사건 강도, 유사사례 분포, 시총 맥락, 오너쉽 가감점까지 종합했을 때 **가장 강한 확신의 top tier**에만 제한적으로 부여한다.
- `A`는 강한 후보지만 `A+`만큼 압도적이지 않거나, 반례/선반영/시총 왜곡 리스크가 일부 남는 경우에 사용한다.
- `A-`는 primary는 유지하지만 반례, 선반영, 추가 데이터 성격, 사례 부족, 오너쉽 데이터 한계 등으로 확신이 한 단계 낮은 경우에 사용한다.
- `강한 가산점(+)` 또는 `강한 감점(-)`이 확인된 후보는 final grading 단계에서 먼저 체크한다. 가산점이면 **최종 등급을 최대 한 단계 올리는 기본 옵션**, 감점이면 **최대 한 단계 내리는 기본 옵션**으로 검토한다. optional memo가 아니라 등급 확정 직전 필수 체크 항목이다.
- 등급 조정은 항상 **인접 한 단계만** 허용한다. 오너쉽 데이터만으로 두 단계 이상 점프/강등시키지 않는다.
- `중간 가산점(+)`은 동률 정리와 경계선 후보 상향에, `중간 감점(-)`은 경계선 후보 하향에 사용한다. `약한 가산점(+)` / `약한 감점(-)`은 rank 미세조정에 우선 사용한다.
- 오너쉽 데이터 또는 유사사례 조사가 아직 덜 끝난 상태에서는 `A+` 계열 등급 대신 `보류`, `임시 A군`, `provisional` 같은 표현만 허용한다.
- `Medium-High`, `Medium` 같은 서술형 강도 라벨을 계속 쓸 수는 있지만, 상단 요약 표에는 가능하면 이를 `A-`, `B+`처럼 **문자 등급으로 한 번 더 압축**해 같이 적는다.
- 본문 3단계 결론에도 가능하면 `최종 등급: A- (Primary)`처럼 **letter grade + importance 라벨**을 같이 적는다.
- `secondary`도 최종 note에 남기는 경우에는, 본문 3단계 결론에 `최종 등급: B+ (Secondary)`처럼 **letter grade + importance 라벨**을 같이 적는다.
- 즉 `secondary`는 요약 메모만 남기고 조사 축을 생략하는 카테고리가 아니다. 최종 산출물에 포함했다면 `primary`와 같은 구조로 설명하고, importance만 한 단계 낮게 닫는다.

**Model_1 상단 요약 표 권장 컬럼 예시**

- 날짜별 상단 표의 권장 컬럼 순서는 아래를 기본값으로 둔다.
  - `Ticker`
  - `mcap`
  - `방향`
  - `Industry`
  - `Headline (요약)`
  - `분류`
  - `Float %`
  - `Institutional %`
  - `Insider %`
  - `오너쉽 가감점`
  - `최종 등급`
  - `근거`
- 예시:

| Ticker | mcap | 방향 | Float % | Institutional % | Insider % | 오너쉽 가감점 | 최종 등급 | 근거 |
|--------|------|------|---------|------------------|-----------|--------------|-----------|------|
| ABCD | 2.4B | 🟢 Long | 82.7% | 24.1% | 2.1% | ⭐⭐⭐ Strong (+) | A | 후기 임상 positive + same-ticker 반응 우세 |
| EFGH | 5.8B | 🔴 Short | 61.3% | 47.8% | N/A | ⭐⭐ Medium (+) | A- | 희석성 financing으로 하방 해석 우세 |
| MNOP | 3.2B | 🟢 Long | 28.5% | 78.3% | 35.2% | 🔻🔻🔻 Strong (-) | B+ | 호재이나 유동성 제약으로 감점 반영 |
| IJKL | 1.1B | ⚪ Unclear | N/A | N/A | N/A | ❔ Pending | 보류 | DB 오너쉽 데이터 없음 |

- 사용자가 “처음 표”, “상단 요약 표”, “날짜별 스크리닝 표”를 빠르게 보고 판단하는 상황을 전제로, 이 표에서는 **방향 + 오너쉽 + 등급을 한 줄에 압축해서 보여주고**, 상세 계산 근거는 아래 개별 ticker 본문으로 내려보낸다.

**Model_1 ranking 확정 순서 규칙 (필수)**

- `Model_1`에서는 **1단계 스크리닝 직후에 final primary ranking을 확정하면 안 된다.** 1단계의 산출물은 어디까지나 `후보 리스트` 또는 `임시 상위 후보`여야 한다.
- 현재 기간 뉴스 중에서 `primary` 경쟁 후보가 2개 이상 보이기 시작하면, **final rank를 쓰기 전에** 최소한 아래 항목을 먼저 붙인다.
  - `market_cap`
  - `float %`
  - `institutional %`
  - 가능하면 `insider %`, `short interest %`
- 즉 실무 순서는 기본적으로 아래처럼 고정한다.
  1. `1단계`: 사건 강도 기준으로 후보를 넓게 통과시킨다.
  2. `오너쉽 데이터/시총 확인`: final 경쟁 후보들에 대해 DB에서 `market_cap`, `float %`, `institutional %`를 확인한다.
  3. `임시 순위`: 필요하면 `오너쉽 미반영 임시 상위 후보`까지는 적을 수 있다.
  4. `2단계`: same-ticker / other-ticker 유사사례를 충분히 모은다.
  5. `3단계`: 유사사례 분포 + 시총 맥락 + 오너쉽 가감점을 함께 보고 final importance / final ranking을 확정한다.
- 따라서 문서나 research page에서 `Primary 1`, `Primary 2`, `Top pick`, `최종 rank 1`처럼 **확정형 표현**을 쓰려면, 적어도 해당 경쟁 후보들 사이에서는 `float %`와 `institutional %`가 이미 반영돼 있어야 한다.
- 반대로 이 수치들이 아직 없는 상태에서는 `스크리닝 통과 후보`, `임시 상위 후보`, `오너쉽 미반영 provisional rank`처럼 **임시 라벨**만 허용한다. 이를 final ranking처럼 쓰면 안 된다.
- `secondary`도 같은 원칙을 따른다. 즉 `secondary 1`, `secondary top`, `차점 확정`처럼 닫으려면 최소한 해당 후보에도 `market_cap`, `float %`, `institutional %`가 먼저 반영돼 있어야 한다.
- 오너쉽 가감점은 사건 자체를 뒤집는 1차 기준은 아니지만, `강한 가산점(+)` / `강한 감점(-)` / `중간 가산점(+)` / `중간 감점(-)`은 **final ranking 재정렬 요소**로 취급한다. 즉 비슷한 뉴스 강도의 후보 사이 순서를 닫는 tie-breaker를 넘어서, 경계선 등급과 최종 순서를 실제로 조정하는 단계로 final ranking 직전에 반드시 반영한다.
- DB에 `float %` 또는 `institutional %`가 없다면, `final ranking` 대신 `보수적 provisional ranking`으로 남기고, `데이터 없음`으로 적는다.

**1단계: 넓은 스크리닝 (후보 선별)**

- 목적: 잠재적으로 중요한 뉴스를 **놓치지 않고** 넓게 픽한다.
- 허들: **낮음**. 약간이라도 주가에 의미 있을 가능성이 있으면 일단 통과시킨다.
- 이 단계에서는 과거 유사사례를 깊이 조사하지 않는다. headline/lead/본문의 언어적 성격만 보고 빠르게 판단한다.
- 이 단계의 현재 기사 확인에서는, 가능하면 `FMP PR`, `press release provider`, `FMP SEC 8-K`를 먼저 훑어 **같은 경제 사건이 보도자료/8-K에도 걸려 있는지**를 같이 본다. 단, `FMP SEC`는 여기서도 `8-K` 이외 form으로 범위를 넓히지 않는다.
- 이 단계에서도 **사고과정을 숨기지 않는다.** 왜 통과시켰는지, 왜 제외했는지, 어떤 경제 사건으로 읽었는지를 짧게라도 드러낸다.
- 판단 기준:
  - 사건의 경제적 성격이 명확한가 (계약, 승인, 실적, 오퍼링, 소송 등)
  - 가격 영향 경로가 최소한 하나라도 보이는가
  - 단순 홍보성, 정보량이 낮은 형식적 공지, 법무법인 소송 알림 같은 잡음은 제외
  - 기본 분석 대상 ticker가 `100B` 미만인가 (`100B` 이상이면 기본적으로 reference 후보로만 남긴다)
- 산출물: **후보 리스트** (예: 뉴스 30~50건, 또는 전체 뉴스 대비 상위 10~30% 수준)
- 핵심 원칙: 이 단계에서 엄격하게 자르면, 2단계에서 유사사례를 조사해볼 기회 자체가 사라진다. 따라서 **false negative를 줄이는 것**이 1단계의 최우선 목표다.
- 이 단계에서는 `final primary`, `최종 rank 1`, `확정 top pick`처럼 **확정형 ranking 표현을 쓰지 않는다.** 필요하면 `임시 상위 후보`까지만 적는다.

**1단계 사고과정 기록 규칙 (필수)**

- 각 후보/제외 기사마다 가능하면 아래 3가지를 남긴다.
  1. `핵심 사건 인식`: 이 기사를 무엇으로 읽었는가 (예: 후기 임상 positive, 희석성 notes offering, 단순 홍보성 launch)
  2. `1차 통과/제외 이유`: 왜 일단 후보로 올렸는지, 또는 왜 여기서 잘랐는지
  3. `불확실성 메모`: 어떤 점이 애매해서 2단계 확인이 필요한지
- 즉, 1단계 결과는 단순한 ticker 목록이 아니라 **초기 가설 목록**이어야 한다.

**1단계 완료 시 중간 저장 및 오너쉽 조회 의무 (필수)**

- 1단계(넓은 스크리닝)를 끝낸 직후, **2단계로 넘어가기 전에** 아래 두 가지를 반드시 수행한다.
  1. **1단계 후보 목록을 research page에 중간 저장한다.** 이렇게 하면 작업이 중단되거나 대화가 끊어져도 후보 리스트가 남아 있어, 이후 오너쉽 반영이나 2/3단계를 이어서 할 수 있다.
     - 중간 저장 시점에서는 상단 요약 표의 Float%/Inst%/Insider% 칸이 비어 있어도 된다. 다만 `❔ Pending`으로 표기하고, 등급 칸은 `보류`로 둔다.
     - 저장 형식은 최종 산출물과 같은 Markdown 테이블 형식을 사용한다. 나중에 오너쉽 반영 시 테이블 행을 직접 교체할 수 있도록 **ticker / mcap / 방향 / Float% / Inst% / Insider% / 오너쉽 가감점 / 최종 등급 / Headline** 컬럼 구조를 처음부터 갖춘다.
  2. **`GET /api/tickers`를 호출해 1단계 후보 전체(primary, secondary, watch 포함)의 오너쉽 데이터를 조회한다.**
     - 조회 결과를 채팅에 표로 보고하고, DB에 값이 있는 ticker는 **상단 요약 표의 Float%/Inst%/Insider% 칸을 바로 채운 뒤** research page를 다시 저장한다.
     - DB에 값이 없는 ticker는 `데이터 없음`으로 적는다.
     - 이 시점에서 오너쉽 가감점 스코어링(⭐/🔻/⚪)은 아직 확정하지 않아도 된다. 다만 **수치 자체는 반드시 채워 넣는다.** 스코어링은 3단계에서 확정한다.
- 이 규칙의 목적: 이전에 오너쉽 조회를 "나중에 하겠다"고 placeholder(N/A/Pending)만 남기고 저장한 뒤, 실제로는 조회하지 않고 넘어가는 실수를 원천 차단한다. 1단계 → 오너쉽 수치 채움 → 중간 저장 → 2단계 진입이 고정 순서다.
- 이 중간 저장은 "최종 완료 저장"이 아니다. 제목에 `(1단계 완료, 오너쉽 수치 반영)` 같은 상태 태그를 붙여 진행 중임을 표시한다.

**2단계: 유사사례 조사 (증거 수집)**

- 목적: 1단계에서 선별된 각 후보에 대해 과거 유사사례를 수집한다.
- 이 단계는 **판단이 아니라 증거 수집**이다. 결론을 내리지 않고 데이터만 모은다.
- 판단과 증거 수집을 분리해야 확증 편향(1단계에서 "별로"라고 생각한 건 사례도 대충 보는 문제)을 줄일 수 있다.
- 이 단계의 핵심은 **대표 사례 몇 개를 예쁘게 고르는 것**이 아니라, 3단계에서 실제로 재판단할 수 있을 만큼 **분포를 볼 수 있는 증거 집합**을 확보하는 것이다.
- 수행 내용:
  1. 현재 뉴스에서 핵심 키워드를 선별한다.
  2. 현재 사건과 직접 연결되는 source coverage를 먼저 점검한다. 기본 체크는 `FMP PR`, `press release provider`, `FMP SEC 8-K`의 3개다.
  3. 그 키워드로 과거 뉴스 검색 범위를 좁힌다.
  4. 해당 ticker의 유사 뉴스가 있었는지 확인한다 (same-ticker).
  5. 다른 ticker에서도 비슷한 뉴스/이슈가 있었는지 확인한다 (other-ticker).
  6. 필요하면 `industry`가 비슷한 종목으로 범위를 넓혀 유사 사례를 추가로 찾는다.
  7. 각 유사사례에 대해 **change 데이터 전체**(8개 metric)를 수집한다.
  8. final 경쟁 후보들에 대해서는 유사사례 조사와 병행해 DB에서 `market_cap`, `float %`, `institutional %`를 확인해 둔다.
- 추가 수행 규칙:
  1. 현재 기사 해석 메모에는 `FMP PR 확인 여부`, `press release provider 확인 여부`, `FMP SEC 8-K 확인 여부`를 가능하면 짧게 같이 남긴다. 예: `source check: FMP PR 있음 / RTPR 없음 / FMP SEC 8-K 없음`.
  7. **확증 사례와 반례를 함께 수집한다.** 현재 뉴스를 bullish/bearish로 보고 싶더라도, 그 방향과 반대였던 유사사례를 의도적으로 같이 모은다.
  8. **시가총액 구간을 같이 기록한다.** other-ticker 사례를 쓸 때는 small-cap 사례만 잔뜩 모아 놓고 large-cap 현재 뉴스에 그대로 대입하지 않는다.
  9. **선반영 가능성을 같이 점검한다.** 가능하면 현재 ticker의 뉴스 직전 `1d / 3d / 5d / 20d` 가격 흐름을 확인해, 이미 유사 재료로 먼저 오른 상태인지 본다.
  10. **사례 수가 부족하면 더 조사한다.** same-ticker 또는 other-ticker가 1~2건만 잡혔다고 바로 3단계로 넘기지 말고, 키워드/peer/industry 축을 바꿔 추가 탐색한다.
  11. 현재 분석 대상 기간의 기사에는 `change` 계열 데이터를 붙여서 판단하지 않는다. 현재 기사에 대한 price move를 보고 importance를 정하는 대신, 반드시 `현재 기사 이전`에 나온 유사사례의 반응만 수집한다.
  12. `FMP SEC`를 확인할 때는 `8-K`만 대상으로 삼는다. symbol search 결과에 다른 form이 함께 섞여 있어도 `Model_1` 기본 조사 로그에는 `8-K`만 채택하고, 나머지는 `비대상 form`으로 분리한다.
- 사례 수 목표는 **same-ticker 3건 이상, other-ticker 3건 이상을 각각 따로 확보하려고 시도하는 것**을 최소 기준으로 둔다.
- 실무 기본 권장치는 **same-ticker 약 5건, other-ticker 약 5건**이다. 즉 일반적으로는 각 축에서 5건 안팎이면 분포를 보기 더 좋다고 본다.
- 다만 항상 5건을 강제하지는 않는다. 핵심은 `각 축에서 최소 3건 이상을 확보하려고 충분히 시도했는가`이며, 3건 미만이면 더 찾으려고 한 검색 시도와 한계를 같이 남긴다.
- other-ticker 사례를 모을 때는 각 비교 ticker의 `market_cap`을 같이 적고, **현재 ticker와 비교 ticker의 시총 차이**가 반응 크기 해석에 어떤 왜곡을 만들 수 있는지 함께 메모한다.
- 산출물: 후보별 **유사사례 데이터 테이블** (same-ticker + other-ticker, 각 사례의 change 벡터 포함)
- 검색 효율을 위해 모든 뉴스를 읽지 말고, 키워드 검색으로 좁혀진 뉴스만 우선 읽는다.
- same-ticker와 other-ticker는 **둘 다 별도 소제목 또는 별도 문단으로 반드시 설명**한다. 각 축마다 우선 `3건 이상` 찾으려고 시도하고, 일반적으로는 `5건 안팎` 확보를 목표로 한다. 한쪽 사례가 실제로 없거나 3건 미만이면 그 사실을 숨기지 말고 `same-ticker 0건`, `same-ticker 2건`, `other-ticker 1건`처럼 **실제 확보 건수**를 적은 뒤, 어떤 키워드/peer/industry 축으로 찾았는지와 왜 더 못 찾았는지를 함께 남긴다.

**2단계 사고과정 기록 규칙 (필수)**

- 2단계에서는 아래를 사용자에게 추적 가능하게 남긴다.
  1. `검색 시작 가설`: 어떤 키워드/사건 정의로 검색을 시작했는가
  2. `포함 이유`: 왜 특정 과거 기사를 현재 뉴스의 유사사례로 채택했는가
  3. `제외 이유`: 비슷해 보였지만 왜 제외했는가
  4. `반례 의미`: 현재 뉴스와 같은 유형인데 반대 반응을 보인 사례가 무엇을 시사하는가
  5. `분포 요약`: same-ticker / other-ticker에서 대략 어떤 패턴이 보였는가
- 즉, 2단계는 단순 사례 나열이 아니라 **검색 경로와 채택/제외 판단이 보이는 조사 로그**여야 한다.

**2단계 증거 충분성 체크 (필수)**

- 3단계로 넘어가기 전에 아래를 먼저 확인한다.
  1. same-ticker 사례가 몇 건인지, other-ticker 사례가 몇 건인지 **숫자로 셌는가**
  2. 상승 / 하락 / 반응 미약 / 선반영 후 무반응 사례가 각각 얼마나 있는지 **대략적인 분포를 봤는가**
  3. other-ticker 사례가 특정 small-cap 구간에만 몰려 있지 않은지 확인했는가
  4. 현재 뉴스와 경제적 사건 성격이 실제로 같은지 확인했는가
  5. 현재 ticker의 직전 가격 흐름을 보고 선반영 가능성을 점검했는가
  6. same-ticker와 other-ticker를 각각 **독립적으로 설명할 준비가 되었는가**. 즉 둘 중 하나를 누락한 채 `유사사례 비교 완료`라고 쓰지 않는가
  7. same-ticker와 other-ticker 각각에 대해 **최소 3건 이상 확보를 시도했는가**, 그리고 가능하면 각 축에서 **5건 안팎 확보**를 목표로 했는가
- 위 항목 중 하나라도 빠지면, 2단계가 아직 끝난 것이 아니다.
- 최종 note에는 대표 사례만 일부 적을 수 있지만, **내부 판단 자체는 대표 사례 몇 개가 아니라 조사된 전체 분포**를 기준으로 해야 한다.

**3단계: 최종 중요도 재분류 (증거 기반 재판단)**

- 목적: 1단계 판단 + 2단계 증거를 종합해서 **최종 등급**을 확정한다.
- 허들: **높음**. 증거 기반으로만 판단한다.
- 이 단계에서는 **대표 사례 중심 수동 인상비평**으로 끝내면 안 된다. 최소한 `same-ticker 분포`, `other-ticker 분포`, `시총 맥락`, `선반영 여부`를 함께 보고 재판단해야 한다.
- 이 단계에서만 `Primary 1/2/3`, `Top pick`, `최종 importance 순서` 같은 **확정형 ranking**을 닫는다. 1단계나 2단계 중간 메모에서 이미 확정 순서를 적어두고, 나중에 오너쉽 가감점을 덧붙이는 방식은 지양한다.
- 이 단계에서 할 수 있는 것:
  - 1단계에서 "중요"로 뽑았는데, 과거 유사사례가 전부 무반응이면 → **중요도 하향**
  - 1단계에서 "경계선"으로 애매했는데, 과거 유사사례에서 같은 market cap 구간에서 큰 움직임이 반복됐으면 → **중요도 상향**
  - 과거 사례가 극단적으로 방향이 갈리면 (예: 7↑ 5↓) → 등급은 유지하되 **"high variance" 태그** 부여
- 재분류 질문:
  - same-ticker에서 비슷한 이슈가 과거에 **주로 올랐는가, 안 올랐는가, 반응이 섞였는가**
  - other-ticker에서 비슷한 이슈가 **어떤 시총 구간에서 더 잘 먹혔는가**
  - 현재 뉴스는 과거 사례 중 **어느 쪽에 더 가까운가**
  - 그래서 현재 뉴스의 가격 영향 가능성을 볼 때 **확신을 높여야 하는지, 낮춰야 하는지**
- 이때 현재 ticker 자신의 `market_cap`과 other-ticker 사례들의 `market_cap`이 서로 얼마나 차이 나는지도 함께 설명한다. 단순히 숫자만 나열하지 말고, `현재는 4B급인데 비교 사례는 400M급이라 반응 크기를 그대로 이식하면 과대해석 위험이 있다`처럼 해석을 붙인다.
- 산출물: **최종 중요 뉴스 리스트 + 등급 + 근거**
- 핵심 원칙:
  - 1단계에서 넓게 잡아서 줄인 false negative를, 3단계에서 증거 기반으로 false positive를 제거한다.
  - "왜 이 뉴스가 최종 중요로 올라갔는지/내려갔는지"의 **감사 추적(audit trail)** 이 자연스럽게 남아야 한다.

**3단계 사고과정 기록 규칙 (필수)**

- 3단계 최종 설명에는 최소한 아래 사고흐름이 드러나야 한다.
  1. `1단계 초기 판단`: 처음에는 왜 중요/경계선/제외 후보로 봤는가
  2. `2단계 증거 변화`: 유사사례를 모으고 나서 어떤 점이 강화되었고 어떤 점이 약화되었는가
  3. `최종 재판단`: 그래서 importance를 유지/상향/하향한 이유가 무엇인가
  4. `남은 한계`: 시총 차이, 선반영 가능성, 기술적 데이터 부재 등으로 아직 불확실한 부분은 무엇인가
- 최종 문장은 반드시 **결론만 말하지 말고 결론에 이르는 사고과정**을 요약해야 한다.
- 즉 `High` 또는 `보류`라고만 쓰지 말고, **왜 그런 결론으로 이동했는지**가 보이도록 작성한다.

**3단계 재판단 강제 규칙 (필수)**

- 아래 조건을 만족하기 전에는 `High`, `Medium-High` 같은 강한 importance를 확정하지 않는다.
  1. same-ticker 사례가 충분히 있는 경우: 그 분포를 먼저 우선 사용한다.
  2. same-ticker가 적은 경우: other-ticker를 industry / market cap이 비슷한 집단으로 넓혀 충분히 보강한다.
  3. 현재 뉴스 직전 가격 흐름을 보고 선반영 가능성을 따로 적는다.
  4. large-cap 현재 뉴스를 평가할 때는 small-cap 급등 사례만으로 importance를 높이지 않는다.
  5. 반례 비중이 높으면 importance를 낮추거나 `high variance`, `선반영 가능`, `증거 부족` 태그를 붙인다.
  6. 현재 기사 자체의 당일/후행 change 데이터가 이미 보이더라도, 그것을 근거로 importance를 확정하지 않는다. `Model_1` 재판단은 과거 유사사례 분포만으로 방어 가능해야 한다.
  7. 시가총액 `100B` 이상 ticker는 특별한 사용자 지시가 없는 한 최종 직접 분석 대상에서 제외하고, 필요하면 reference case로만 남긴다.
- 다시 말해, **대표 사례 2~3개가 강하다고 해서 바로 중요도를 높이지 않는다.** 조사된 사례들의 전체 분포가 정말 그 결론을 지지하는지 먼저 확인한다.
- 조사 후에도 사례 수가 너무 적거나, 시총/산업/선반영 조건이 현재 뉴스와 너무 다르면 `정확한 판단 불가`, `보수적 분류`, `추가 조사 필요` 중 하나로 남긴다. 억지로 강한 결론을 내리지 않는다.
- 기술적/오너쉽 데이터가 없어서 선반영 판단을 충분히 못 하는 경우에도, 그 한계를 note에 명시하고 confidence를 한 단계 낮춘다.

기업 컨텍스트 참조 원칙 (전 단계 공통):

- `Model_1`의 **모든 단계**(1단계 스크리닝, 2단계 유사사례 조사, 3단계 재분류)에서 뉴스 headline/본문만 보지 않고, 해당 ticker의 **기업 컨텍스트**를 함께 참조한다.
- 현재 live app DB 기준으로 참조 경로를 아래처럼 구분한다.
  - `Model_1`에서 사용하는 **시가총액/오너쉽 데이터의 기본 source of truth는 repo의 live app DB**다. 즉 기본적으로 `terminal/backend/backend/data/app.db`에 적재된 `company_profiles` 계열 값을 먼저 사용하고, 이미 DB에 있는 값을 두고 매번 외부 API를 다시 조회하는 방식은 기본 플로우로 삼지 않는다.
  - 특히 default universe 안의 ticker는 먼저 **Default Ticker Window에 실제 표시되는 값**을 본다. 즉 `GET /api/tickers` default-universe row의 `marketCap`, `floatPct`, `institutionalPct`, `insiderPct`와 각 source badge를 1차 참조값으로 사용한다. 이 값들은 backend가 `company_profiles` 대표값을 재노출한 것이므로, note 숫자와 사용자가 보는 UI 숫자를 맞추는 기준이다.
  - 특히 현재 레포 기준으로 `market_cap`, `float_pct`, `institutional_pct`, `insider_pct`와 각 source 컬럼(`market_cap_source`, `float_source`, `institutional_source`, `insider_source`)은 같은 `company_profiles` family에 저장된다. 따라서 `Model_1` note에서는 가능하면 **DB에 저장된 최신 값 + source 정보**를 함께 읽어 사용한다.
  - raw DB를 직접 읽을 때는 `company_profiles`가 ticker당 단일 row가 아니라 source별 다중 row 구조라는 점을 전제로, `securities`와 JOIN한 뒤 **필드별 최신 non-null 대표값**을 고르는 규칙 또는 `fetched_at DESC` 대표 row 규칙을 먼저 정하고 읽는다.
  - window/source 정책은 DB 저장 값 기준이다. `Model_1`에서 수치를 인용할 때는 가능하면 `DB stored value (source=...)` 형식으로 출처를 같이 남긴다.
  - DB에 값이 없으면 `데이터 없음`으로 적고, 외부에서 보강하지 않는다.
  - `[][][]description[][][]`, `[][][]peers[][][]`, `[][][]ipo_date[][][]`, `[][][]market_cap[][][]`는 기본적으로 `company_profiles`에서 온다.
  - 단, `company_profiles`는 ticker당 단일 row가 아니라 `security_id + source` 기준 다중 row 구조이므로, raw DB를 직접 읽을 때는 대표 row 선택 규칙을 먼저 정해야 한다.
  - `[][][]industry[][][]`는 `company_profiles` 컬럼이 아니라 주로 `securities.industry` 또는 `industryLookup.ts`의 CSV cache fallback에서 온다.
  - API 응답을 사용할 때는 `/api/news`가 내려주는 `[][][]companyDescription[][][]`, `[][][]peers[][][]`, `[][][]ipoDate[][][]`, `[][][]marketCap[][][]`, `[][][]industry[][][]`를 우선 source of truth로 본다.
  - `[][][]float %[][][]`, `[][][]institutional ownership %[][][]`, `[][][]insider ownership %[][][]`, `[][][]short interest %[][][]`는 `Model_1` 오너쉽 데이터 가감점 + 포지셔닝 메모용 보조 지표로 취급한다.
  - `[][][]float %[][][]`, `[][][]institutional ownership %[][][]`, `[][][]insider ownership %[][][]`는 모두 **app DB(company_profiles) 저장 값**만 사용한다. DB에 값이 없으면 `데이터 없음`으로 적고, 외부 API/웹에서 별도로 조달하지 않는다.
- 단계별 활용 방식:
  - **1단계 (스크리닝)**: description을 보고 뉴스가 기업의 핵심 사업과 직접 연결되는지 빠르게 판단한다. 핵심 사업과 직접 연결되는 뉴스는 허들을 더 낮게, 부수적 사업 관련이면 좀 더 보수적으로 판단할 수 있다.
  - **2단계 (유사사례 조사)**: peers 목록과 industry를 활용해 other-ticker 검색 범위를 효율적으로 좁힌다. ipo_date를 확인해 유사사례의 상장 연차가 현재 ticker와 비슷한지도 기록한다. same-ticker와 other-ticker를 각각 따로 정리할 수 있을 정도로 증거를 모은다.
  - **3단계 (재분류)**: 과거 유사사례의 반응을 해석할 때, industry 특성(예: 바이오는 임상 결과에 극단 반응, 유틸리티는 규제 뉴스에 둔감)과 ipo_date 기반 성숙도 차이를 보정 요인으로 반영한다. 이때 `float %`, `institutional ownership %`, `insider ownership %`, `short interest %`를 보조 오너쉽/포지셔닝 항목으로 함께 적되, 사건 자체나 유사사례 분포를 덮어쓰는 주근거로 사용하지 않는다.
- 이 데이터가 DB에 없거나 비어 있을 수 있다. 그 경우 해당 항목은 건너뛰되, 어떤 컨텍스트가 누락됐는지 로그에 남긴다.

운영 원칙:

- 과거 유사 뉴스가 있었다고 해서 그 뉴스가 주가를 움직였다고 바로 단정하지 않는다.
- 비슷한 이슈에서도 오른 경우와 안 오른 경우가 같이 있을 수 있다.
- 유사 이슈에서 **주가가 오른 사례 비율** 또는 **주가가 하락한 사례 비율**이 높을수록, 그 이슈가 가격에 영향을 미칠 가능성이 강하다고 본다.
- 검색 효율을 위해 모든 뉴스를 읽지 말고, 키워드 검색으로 좁혀진 뉴스만 우선 읽는다.
- 단, 최종 판단은 `대표 사례 인용`이 아니라 **조사된 전체 사례 분포**를 기준으로 해야 한다.
- `정확하게 판단 가능할 때까지 충분히 조사한다`는 뜻은 무한정 전수조사하라는 뜻이 아니라, 적어도 **반례·시총·선반영 여부를 포함해 결론을 방어할 수 있을 정도**로 사례를 모으라는 뜻이다.
- 그 기준에 못 미치면 결론 강도를 낮추고, 문서에 `증거 부족`을 명시한다.
- 또한 각 단계의 출력은 **무엇을 결론냈는지**뿐 아니라 **왜 그렇게 생각했는지**가 추적 가능해야 한다. 사용자가 1단계, 2단계, 3단계 사고흐름을 따라갈 수 없는 결과물은 불완전한 결과물로 본다.

분석 근거에 같이 남길 수 있는 항목:

- 유사 뉴스의 `[][][]date[][][]`
- 유사 뉴스의 `[][][]title[][][]`
- 유사 뉴스의 `[][][]summary[][][]`
- 유사 뉴스 당시의 `[][][]change%[][][]`

최종 주요 이슈 / ticker 분석 출력 규칙:

- `Model_1`로 최종 주요 이슈와 ticker를 분석할 때는, **현재 뉴스 1건만 요약하고 끝내면 안 된다.** 반드시 과거 유사사례 비교 결과를 같이 적는다.
- `primary`뿐 아니라 `secondary`로 최종 note에 남긴 ticker도 동일하다. 즉 `secondary`도 현재 뉴스 요약만 적고 끝내지 말고, same-ticker / other-ticker 비교 결과를 함께 적는다.
- 최종 답변, research note, 날짜별 스크리닝 note의 시작 부분에는 **`분석 데이터 기간: YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm (timezone)`** 줄을 반드시 넣는다. 이 줄은 가능하면 제목 바로 아래 첫 본문 줄에 둔다. 날짜 제목만 있고 시각이 없는 출력은 완료본으로 보지 않는다.
- 최종 현재 뉴스 요약에는 가능하면 `source check`를 함께 적는다. 기본 형식은 `FMP PR / press release / FMP SEC 8-K` 3축이며, 예: `source check: FMP PR 있음, RTPR press release 있음, FMP SEC 8-K 없음`.
- 또한 `Model_1` 최종 주요 이슈 리스트는 기본적으로 **시가총액 `100B` 미만 ticker만 직접 분석 대상**으로 삼는다. `100B` 이상 ticker는 필요하면 reference case 또는 보류 메모로만 적는다.
- 최종 답변이나 research note에서 same-ticker 또는 other-ticker 중 한 축이라도 빠져 있으면, 원칙적으로 `Model_1 분석 완료`로 보지 않는다. 각 축에서 우선 `3건 이상` 찾으려고 시도해야 하며, 일반적으로는 `5건 안팎`이면 더 좋다. 한쪽 사례가 0건이거나 3건 미만이면 그 실제 확보 건수와 검색 시도 내역을 적는 방식으로라도 **반드시 섹션을 남긴다.**
- `watch`는 상세 Model_1 완료 대상으로 보지 않더라도, 최소한 `ticker`, `headline 요약`, `watch로 둔 이유`는 상단 스크리닝 표 또는 바로 아래 watch 보조 표에서 반드시 보이게 남긴다.
- 최종 답변에는 최소한 아래 2개 비교 축을 **동시에** 포함한다.
  1. `same-ticker 유사사례`: 현재 분석 중인 ticker에서 과거 비슷한 이슈가 있었는지, 그때 주가가 어떻게 반응했는지
  2. `other-ticker 유사사례`: 다른 ticker에서 비슷한 이슈가 있었는지, 그때 주가가 어떻게 반응했는지
- 또한 현재 분석 대상 ticker의 `[][][]market_cap[][][]`를 현재 뉴스 요약 섹션에서 반드시 적고, 다른 사례와 비교할 때 기준 cap으로 삼는다.
- 또한 각 ticker마다 `[][][]float %[][][]`, `[][][]institutional ownership %[][][]`, `[][][]insider ownership %[][][]`, `[][][]short interest %[][][]`를 함께 적고, 그 조합이 왜 `가산점`, `중립`, `가산점 없음`, `squeeze 가능`, `유동성 왜곡 주의` 중 무엇으로 이어지는지 한 줄 설명을 붙인다.
- 이때 `[][][]float %[][][]`와 `[][][]institutional ownership %[][][]`는 DB source badge까지 같이 적는다. 예: `Float 82.7% (source=FMP)`, `Institutional 24.1% (source=Finnhub)`.
- 여러 ticker를 같은 날짜 구간 안에서 서로 비교해 `Primary 1`, `Primary 2`처럼 순서를 매길 때는, **해당 경쟁 ticker들에 대한 오너쉽 가감점 반영이 끝난 뒤에만** 최종 순서를 쓴다. 오너쉽 가감점이 사후에 확인됐다면 기존 ranking을 그대로 두지 말고 순서를 다시 검토한다.
- `same-ticker 유사사례`를 적을 때는 가능하면 아래 항목을 함께 남긴다.
  - 유사 뉴스의 `[][][]date[][][]`
  - 유사 뉴스의 `[][][]title[][][]`
  - 유사 뉴스의 change 데이터 **전체** (8개 metric 모두 기록, 값이 없으면 `None`으로 표기):
    - `[][][]change_pct[][][]`: 전일 종가 → 뉴스 기준일 종가
    - `[][][]change_from_open_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 종가
    - `[][][]change_open_to_high_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 고가
    - `[][][]change_1d_pct[][][]`: 전일 종가 → 1거래일 후 종가
    - `[][][]change_3d_pct[][][]`: 전일 종가 → 3거래일 후 종가
    - `[][][]change_7d_pct[][][]`: 전일 종가 → 7거래일 후 종가
    - `[][][]change_14d_pct[][][]`: 전일 종가 → 14거래일 후 종가
    - `[][][]change_30d_pct[][][]`: 전일 종가 → 30거래일 후 종가
  - 그 사례를 현재 뉴스와 비슷하다고 본 이유에 대한 짧은 설명
  - 그 사례가 실제로 `상승`, `하락`, `초기 약세 후 지연 상승`, `반응 미약` 중 어디에 가까웠는지에 대한 해석
  - 반응 구조 태그 (해당되면): `intraday_only`, `delayed_followthrough`, `sustained_repricing`, `one_day_spike_then_fade`, `multi_window_impact`
- `other-ticker 유사사례`를 적을 때는 가능하면 아래 항목을 함께 남긴다.
  - 다른 ticker의 `[][][]ticker[][][]`
  - 다른 ticker의 `[][][]market_cap[][][]`
  - 현재 분석 대상 ticker의 `[][][]market_cap[][][]` 대비 얼마나 크거나 작은지에 대한 짧은 비교 메모
  - 유사 뉴스의 `[][][]date[][][]`
  - 유사 뉴스의 `[][][]title[][][]`
  - 해당 사례의 change 데이터 **전체** (8개 metric 모두 기록, 값이 없으면 `None`으로 표기):
    - `[][][]change_pct[][][]`: 전일 종가 → 뉴스 기준일 종가
    - `[][][]change_from_open_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 종가
    - `[][][]change_open_to_high_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 고가
    - `[][][]change_1d_pct[][][]`: 전일 종가 → 1거래일 후 종가
    - `[][][]change_3d_pct[][][]`: 전일 종가 → 3거래일 후 종가
    - `[][][]change_7d_pct[][][]`: 전일 종가 → 7거래일 후 종가
    - `[][][]change_14d_pct[][][]`: 전일 종가 → 14거래일 후 종가
    - `[][][]change_30d_pct[][][]`: 전일 종가 → 30거래일 후 종가
  - 왜 이 사례를 현재 뉴스와 유사하다고 봤는지에 대한 설명
  - 반응 구조 태그 (해당되면): `intraday_only`, `delayed_followthrough`, `sustained_repricing`, `one_day_spike_then_fade`, `multi_window_impact`
  - 시가총액 차이 때문에 반응 크기를 어떻게 보정해서 해석해야 하는지에 대한 짧은 메모
- `other-ticker` 비교는 단순히 headline에 같은 단어가 들어갔다고 고르면 안 되고, **핵심 경제 사건이 실제로 비슷한지**를 설명해야 한다.
  - 예: `development agreement`, `commercial partnership`, `FDA approval`, `priced public offering`, `record results with raised guidance`처럼 사건 성격이 같아야 한다.
  - 예: 단순히 `AI`, `partnership`, `data` 같은 공통 단어만 겹치는 경우는 유사사례로 채택하지 않는다.
- 최종 설명에서는 과거 유사사례를 단순 나열하지 말고, 아래 질문에 답하는 방식으로 정리한다.
  - 같은 ticker에서는 비슷한 이슈가 과거에 **주로 올랐는가, 안 올랐는가, 반응이 섞였는가**
  - 다른 ticker에서는 비슷한 이슈가 **어떤 시총 구간에서 더 잘 먹혔는가**
  - 현재 뉴스는 과거 사례 중 **어느 쪽에 더 가까운가**
  - 그래서 현재 뉴스의 상승 가능성을 볼 때 **확신을 높여야 하는지, 낮춰야 하는지**
- 가능하면 최종 문장에는 아래 수준의 종합 해석을 남긴다.
  - `same-ticker에서는 과거 7건 중 5건이 7거래일 내 상승했지만, other-ticker 비교에서는 대형주보다 중소형주에서 반응이 더 컸다. 따라서 이번 건은 방향은 positive지만, 강한 재평가를 기대하려면 추가 상업화 확인이 필요하다.`
- 즉 `Model_1` 최종 출력은 **현재 뉴스 요약 + 현재 ticker market cap + same-ticker 과거 반응 + other-ticker 유사사례 + 비교 ticker market cap 설명 + market cap 맥락 + 종합 해석**까지 포함해야 완료로 본다.
- 여러 날짜 산출물에서는 이를 아래처럼 적용한다.
  - `primary`: 위 전체 구조를 모두 수행하고, 상단 확정 표 + 상세 본문에 모두 포함한다.
  - `secondary`: 위 전체 구조를 동일하게 수행하고, 상단 보조 표 + 상세 본문에 모두 포함한다.
  - `watch`: 상세 본문은 선택 사항이지만, `ticker / headline 요약 / watch 이유`는 반드시 사용자에게 보이게 남긴다.

`model_1_2_investing`을 수행한 경우에는 위 최종 출력 뒤에 별도 간접 영향 점검 섹션을 덧붙여, `DB source에는 없지만 Investing에서 확인된 external issue`, `그 이슈의 transmission path`, `영향 가능 ticker 바스켓`, `현재 universe 안의 ripple candidate`, `시간 정보 확실성 수준`을 함께 남긴다. 이 섹션은 `Model_1`의 기본 구조를 대체하지 않지만, 단순 보강 메모가 아니라 **외부 이슈를 현재 ticker 판단으로 변환하는 메커니즘 설명**이어야 한다.

이 모델은 현재 뉴스를 해석할 때 참고하는 **유사사례 비교 모델**이다.
