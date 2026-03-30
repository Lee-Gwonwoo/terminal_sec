#### `🟧 Model_2_case analysis`

목적:

- 현재 들어오는 개별 뉴스 1건을 즉시 평가하는 것이 아니라, 일정 기간 전체를 훑어보며 주가에 강하게 영향을 준 이슈들을 유형별 case로 분류한다.
- case를 하나하나 수작업으로 나열하는 것이 아니라, 의미 있는 패턴이 보일 정도의 유형으로 묶는다.
- 기본 운영 모드는 `press_release only`로 둔다.
- 필요하면 `news`, `company_news`, `market_news`까지 확장할 수 있지만, source가 섞이면 해석 기준과 근거 표도 분리해서 남긴다.

Investing 데이터 확장 규칙:

- `Model_2`는 기본적으로 `press_release only`로 시작하지만, 필요하면 app DB에 적재된 Investing row도 분석 대상으로 확장할 수 있다.
- 현재 app DB에서 Investing 기사는 `news_items.source = 'INVESTING'` 계열로 저장되며, `[][][]source_type[][][]`은 최소 아래 둘을 구분해 해석한다.
  - `[][][]investing_stock_market_news[][][]`
  - `[][][]investing_cryptocurrency_news[][][]`
- Investing source를 분석할 때는 **title만 보고 분류하지 않는다.** 최소한 아래 3층 텍스트를 함께 본다.
  - `[][][]title[][][]`: headline
  - `[][][]body[][][]`: listing/summary 성격의 짧은 본문 또는 teaser
  - `[][][]full_text[][][]`: `news_fulltext.full_text`에 저장된 기사 본문
- 현재 코드 기준 `news_items.body`는 Investing category listing에서 긁어온 summary/description 성격일 수 있으므로, 이 값만으로 `case_type`을 확정하지 않는다.
- `news_fulltext.full_text`가 성공적으로 존재하는 Investing row는 반드시 같이 읽고, `body`와 `full_text` 해석이 다르면 `full_text`를 우선한다.
- `news_fulltext.full_text`가 없으면 `title + body(summary)`만으로 임시 분류할 수는 있지만, 이 경우 note/log에 `full_text 없음`을 남기고 신뢰도 제한을 적는다.
- Investing source는 issuer-driven press release보다 commentary/market wrap 비중이 높을 수 있으므로, `press_release` taxonomy를 그대로 덮어쓰지 말고 source를 분리한 note, 부록, 또는 별도 근거 표로 남기는 것을 기본값으로 둔다.
- `investing_stock_market_news`는 개별 기업 기사와 broader market/macro 기사가 섞일 수 있다. ticker 직접 매핑이 약하면 억지로 company-event case로 넣지 말고 `residual` 또는 별도 macro/theme case 후보로 보낸다.
- Investing 뉴스를 분석할 때는 **과거 간접 영향 사례 검색 단계**를 추가할 수 있다. 즉 현재 Investing 기사에서 보이는 사건/내러티브가 과거 `company_news` 기사들에서 여러 종목 주가에 실제로 반응을 만든 적이 있는지 app DB에서 검색한다.
- 이 검색의 목적은 Investing 기사 자체의 한 건 반응률을 보는 것이 아니라, **같은 경제 사건 또는 내러티브가 company_news에서 반복적으로 가격 영향 경로를 만들었는지**를 확인하는 데 있다.
- 검색 기본 대상은 `[][][]company_news[][][]`다. 필요하면 `news`까지 넓힐 수 있지만, 기본값은 `company_news only`로 둔다.
- 검색 키는 Investing 기사에서 추출한 핵심 사건 표현을 기준으로 잡는다. 예를 들어 정책 변화, 관세, AI capex, chip export restriction, OPEC, rate cut, FDA class-wide concern 같은 사건 문구를 `title`, `body`, `full_text`에서 뽑아 `company_news` headline/body/full_text에 대해 유사 사례를 찾는다.
- 이 단계에서는 ticker가 같은지보다 **내러티브가 같은지**를 먼저 본다. 즉 Investing macro/theme 기사와 직접 ticker가 겹치지 않아도, 과거 `company_news`에서 비슷한 사건이 어떤 산업/peer 종목들에 반응을 만들었는지 찾는 용도로 사용한다.
- 검색 결과는 최소한 아래 질문을 닫는 용도로 쓴다.
  - 과거 `company_news`에 같은 내러티브가 있었는가?
  - 그때 직접 또는 간접 영향이 나타난 ticker/industry 묶음이 있었는가?
  - 그 반응은 `intraday_only`였는가, `delayed_followthrough`였는가, `sustained_repricing`였는가?
  - 현재 Investing 기사도 같은 transmission path로 해석할 근거가 있는가?
- 과거 `company_news` 검색에서 유사 사례가 충분히 확인되면, 현재 Investing 기사는 `macro/theme reference`에 그치지 않고 **간접 영향 가능성이 검증된 case 후보**로 메모할 수 있다.
- 반대로 `company_news`에서 반복 사례가 거의 없거나 가격 반응이 약하면, Investing 기사의 서사는 남기되 `간접 영향 근거 약함`으로 명시한다.

기업 컨텍스트 참조 원칙:

- `Model_2`에서도 뉴스 텍스트와 change 데이터만 보지 않고, 각 ticker의 기업 컨텍스트를 **필수로** 함께 참조한다.
- 필수 참조 항목:
  - `[][][]description[][][]`: 회사의 핵심 사업과 수익 구조를 이해하기 위한 기본 설명
  - `[][][]peers[][][]`: 비교 가능한 peer ticker 목록
  - `[][][]ipo_date[][][]`: 상장일
  - `[][][]industry[][][]`: 산업 분류
- 현재 live app DB 기준 저장 위치는 아래처럼 해석한다.
  - `description`, `peers`, `ipo_date`, `market_cap`은 `company_profiles` 계열 데이터다.
  - `industry`는 `company_profiles` 컬럼이 아니라 `securities.industry` 또는 `industryLookup.ts` fallback에서 온다.
  - raw SQL 분석에서는 ticker를 `company_profiles`에서 직접 읽지 말고 `securities`와 JOIN해서 붙인다.
  - `/api/news` 응답을 재사용할 수 있으면, 여기서 이미 합쳐진 `companyDescription`, `peers`, `ipoDate`, `marketCap`, `industry`를 우선 사용한다.
- 활용 규칙:
  - `description`은 해당 뉴스 사건이 회사의 **핵심 사업과 직접 연결되는지**, 아니면 주변 사업/부수 이슈인지 판단할 때 사용한다.
  - `peers`와 `industry`는 case 유형을 설명할 때 같은 산업/비슷한 사업 모델 안에서 반복되는 패턴인지 점검하는 데 사용한다.
  - `ipo_date`는 상장 연차에 따른 변동성 차이, 초기 상장 기업과 성숙 기업의 반응 차이를 해석 보정하는 데 사용한다.
  - 동일한 headline 패턴이어도 `description`, `industry`, `ipo_date` 맥락이 다르면 같은 case_type 안에서도 반응 강도 차이가 날 수 있으므로, 대표 사례/반례 해석에 이를 함께 적는다.
- 데이터가 없거나 비어 있으면 해당 항목은 건너뛰되, 어떤 컨텍스트가 누락됐는지 note 또는 로그에 남긴다.

현재 app DB / API 해석 규칙:

- `news_items`는 `published_at`, `source`, `source_type`, `title`, `body`, `url`, `tickers_csv`, `publisher`, `origin_url`를 담는 기본 뉴스 메타 테이블이다.
- `news_fulltext`는 기사 full text canonical 저장소다. `Model_2`가 본문까지 읽어야 하는 경우, raw SQL에서는 `news_items`만 읽지 말고 `news_fulltext`를 함께 JOIN한다.
- `/api/news`는 `news_items`에 기업 컨텍스트(`companyDescription`, `peers`, `ipoDate`, `marketCap`, `industry`)와 change metric을 붙여 주지만, full text 본문 자체를 그대로 내리는 endpoint로 가정하면 안 된다.
- 따라서 `Model_2`가 full text까지 판단 근거로 써야 할 때는 `/api/news`의 enrichment는 활용하되, 실제 텍스트 판독은 `news_fulltext.full_text` 또는 이를 포함한 별도 query 기준으로 닫는다.
- `model2_analysis_runs`는 분석 실행 메타(`title`, `note_title`, `source_type`, `source_name`, `since`, `until`, `scope`, aggregate count`)를 저장한다.
- `model2_evidence_rows`는 기사 원문 보관소가 아니라, 분류 결과와 가격 반응, 기업 메타, `summary`, `body_preview`, denormalized 뉴스 필드를 저장하는 evidence cache다. full text 재판독이 필요하면 항상 `news_items`/`news_fulltext` 원본으로 돌아간다.
- `model2_case_summaries`는 analysis별 집계 cache다. 유형 count와 impacted count를 빠르게 재조회하기 위한 용도이며, taxonomy 정의의 source of truth 그 자체는 아니다.

핵심 방법:

1. 일정 기간 뉴스와 후행 주가 반응을 넓게 검토한다.
2. 먼저 뉴스의 언어적 방향성을 기준으로 `long / short / residual` 상위 분류를 정한다.
3. 같은 상위 분류 안에서 서로 유사한 이슈를 case 유형으로 묶는다.
4. 각 유형별로 실제로 주가에 영향을 준 비율을 계산하거나 추정한다.
5. 같은 상위 분류 내부에서 주가 영향력이 강한 순서대로 유형을 정리한다.

유형 분류 원칙:

- `Model_2`의 유형 체계는 `상위 분류(long / short / residual) -> 세부 case_type` 순서로 설계한다.
- 여기서 `long / short`은 **가격 결과를 보고 붙이는 사후 라벨이 아니라, 뉴스 문장 자체가 시사하는 경제적 방향**을 읽고 먼저 정하는 언어 기반 상위 분류다.
- `long`은 계약 수주, 규제 승인, 가이던스 상향, 대형 파트너십, 핵심 리스크 해소처럼 **언어적으로 기업가치 상승 경로를 직접 시사하는 뉴스**에 붙인다.
- `short`는 오퍼링 희석, 소송/회계 리스크, 규제 실패, 가이던스 하향, 수요 악화처럼 **언어적으로 기업가치 훼손 또는 주가 하방 압력을 직접 시사하는 뉴스**에 붙인다.
- `residual`은 방향성이 언어적으로 분명하지 않거나, 잡성 공지라서 long/short 어느 쪽에도 안정적으로 넣기 어려운 예외 버킷이다.
- `meaningless_others` 같은 잔여 유형은 보통 이 `residual` 상위 분류 아래에 둔다.
- `Model_2`의 `case_type`은 **언어적/맥락적 의미 분류**다. 즉 제목, 본문, full text가 말하는 사건의 성격을 기준으로 묶는다.
- `change_pct`, `change_1d_pct`, `overall_impact_score` 같은 등락률/영향 점수는 **유형을 나누는 기준이 아니다.** 이 값들은 유형이 정해진 뒤, 해당 유형이 실제로 가격에 얼마나 자주 영향을 미쳤는지 평가하는 데만 사용한다.
- `long / short` 역시 등락률 데이터로 정하지 않는다. 예를 들어 언어상 명백한 희석성 오퍼링이면 `short`로 두고, 실제 주가가 일시적으로 올랐더라도 상위 분류는 바꾸지 않는다.
- 혼합형 뉴스는 기사에서 **가장 중심적으로 전달하는 경제적 사건**을 먼저 잡아 상위 분류를 정한다.
- 예를 들어 긍정적 계약과 희석성 자금조달이 한 기사에 함께 있으면, headline과 lead 문장에서 무엇을 핵심 공지로 두는지 먼저 보고 `long` 또는 `short`를 정한다.
- 그래도 우열이 안 서면 억지로 방향을 정하지 말고 `residual`로 보낸다.
- 따라서 "주가가 크게 움직였으니 새로운 유형" 또는 "주가가 안 움직였으니 유형에서 제외"처럼 분류하지 않는다.
- 같은 `case_type` 안에는 가격에 큰 영향을 준 뉴스와 거의 영향을 주지 않은 뉴스가 함께 들어갈 수 있다. 영향 차이는 `reaction_tag`, bucket별 impact 비율, 대표 사례/반례에서 따로 설명한다.
- 유형 분류의 1차 질문은 "무슨 사건이 발생했는가?"이고, 영향 평가는 그 다음 질문인 "그 사건 유형이 실제로 가격에 영향을 주는가?"다.
- 유형 분류의 실제 순서는 아래처럼 본다.
  - 1차 질문: 이 뉴스는 언어적으로 `long`, `short`, `residual` 중 어디에 가까운가?
  - 2차 질문: 그 안에서 사건 성격은 어떤 `case_type`인가?
  - 3차 질문: 그 유형이 실제로 가격에 얼마나 자주 영향을 미쳤는가?

유형 설명 구체화 원칙:

- `Model_2`에서 각 `case_type`은 **이름만 적고 끝내면 안 된다.** 다음에 새 뉴스가 들어왔을 때 사람이 빠르게 재사용할 수 있도록, 유형마다 운영적 정의를 남겨야 한다.
- 좋은 유형 설명은 "이 유형은 대충 이런 느낌"이 아니라, **어떤 문장/표현/사건이면 넣고 어떤 경우는 빼는지**가 바로 보이는 설명이다.
- 각 `case_type` 설명에는 가능하면 아래 항목을 포함한다.
  - `한 줄 정의`: 이 유형이 포착하는 핵심 경제 사건을 1~2문장으로 요약
  - `핵심 가치 경로`: 왜 이 유형이 `long` 또는 `short`로 읽히는지
  - `포함 신호`: headline, lead, 본문에서 자주 나오는 핵심 표현 또는 사건 패턴
  - `제외 신호`: 이름은 비슷하지만 다른 유형으로 보내야 하는 표현 또는 상황
  - `경계 사례`: 헷갈리기 쉬운 인접 유형과의 차이
  - `대표 예시`: 실제 기사 제목 또는 요약 1~3개
  - `반례`: 같은 단어가 있어도 이 유형으로 분류하지 않는 예시 1~2개
  - `빠른 판별 질문`: 새 뉴스를 봤을 때 바로 던질 수 있는 yes/no 질문 1~3개
- 특히 `포함 신호`와 `제외 신호`는 다음 분석에서 재사용되는 실전 판별 장치이므로, 추상어보다 실제 기사 표현에 가깝게 적는다.
- 예를 들어 "긍정적 뉴스"처럼 쓰지 말고, "수주 체결`, `multi-year agreement`, `FDA approval`, `priced public offering`, `subpoena`, `guidance raised`처럼 분류에 직접 쓰이는 표현을 남긴다.
- 반대로 회사 홍보성 수식어만 있고 경제 사건이 불분명하면 `case_type` 설명에도 그 한계를 적고, 필요하면 `residual` 또는 `meaningless_others`로 보내는 조건을 분명히 남긴다.
- 유형 이름만 보고도 바로 분류되게 만드는 것이 아니라, **설명만 읽어도 새 뉴스를 빠르게 판별할 수 있게 만드는 것**이 목표다.

taxonomy 설계 원칙:

- `Model_2`의 case taxonomy는 **너무 적어도 안 되고, 너무 많아도 안 된다.** 실무 기본 범위는 `10 ~ 50`개로 둔다.
- `10`개 미만이면 서로 의미가 다른 사건들이 과도하게 합쳐져서 해석력이 떨어질 가능성이 크다.
- `50`개를 크게 넘기면 표본 수가 지나치게 잘게 쪼개져서 영향 비율과 대표 사례 해석이 불안정해질 가능성이 크다.
- 위 `10 ~ 50`개는 기본적으로 **세부 case_type 개수**를 의미한다. 상위 `long / short / residual` 분류는 이 개수와 별도로 먼저 둔다.
- 권장 구조는 `대분류 case_type + 필요시 하위 subtype 메모` 방식이다. 즉 note 본문 순위는 너무 잘게 쪼개지 말고, 세부 차이는 내부 로그나 근거 표 해설에서 보완한다.
- note를 작성할 때는 가능하면 먼저 `long`, `short`, `residual` 3개 큰 묶음으로 섹션을 나눈 뒤, 각 묶음 안에서 세부 유형을 영향력 순으로 정렬한다.
- 유형을 강제로 무한정 늘리기보다, 반복성이 낮고 의미가 약한 잡성 뉴스는 **잔여 유형(residual bucket)** 으로 모을 수 있어야 한다.
- 기본 잔여 유형 이름은 `meaningless_others` 또는 이에 준하는 명확한 이름으로 둔다.
- `meaningless_others`에는 아래 성격의 뉴스를 넣는다.
  - 언어적으로 공통 패턴을 안정적으로 묶기 어려운 뉴스
  - 투자/가격 영향 경로가 약하고 반복성이 낮은 뉴스
  - 행사 참가, 단순 등단, 형식적 공지, 정보량이 낮은 업데이트, 해석 가치가 낮은 잡성 PR
- 단, `meaningless_others`는 편의상 다 버리는 휴지통이 아니라, "명확한 독립 유형으로 분리할 정도의 반복성과 가격 설명력이 아직 확인되지 않은 잔여 집합"이라는 의미로 사용한다.
- 특정 잔여 유형 안의 뉴스가 누적되면서 반복 패턴과 가격 반응이 확인되면, 이후 별도 case type으로 승격할 수 있다.
- 독립 유형으로 분리할 때는 아래 조건을 함께 본다.
  - 언어 패턴이 반복되는가
  - 경제적 의미가 분명히 독립적인가
  - 다른 유형과 섞으면 해석이 왜곡되는가
- 위 조건을 충족하면 독립 `case_type`으로 분리한다.
- 표본이 너무 적거나, 경제적 의미가 사실상 같은데 표현만 다른 경우에는 기존 유형에 합친다.
- 독립 유형으로 남길 때는, 그 유형 설명만 읽고도 새 뉴스를 판별할 수 있을 정도로 정의가 구체적이어야 한다.
- 만약 어떤 유형이 설명을 길게 써도 포함/제외 경계가 계속 흐리면, 그 유형은 아직 설계가 덜 된 것이다. 이 경우에는 인접 유형과 합치거나, 반대로 더 좁은 독립 유형으로 다시 쪼갠다.
- 즉 유형 존치 기준은 단순 빈도뿐 아니라 **재현 가능한 판별 가능성**도 포함한다.

운영적 입력 정의:

- 기본 뉴스 입력:
  - `[][][]published_at[][][]`
  - `[][][]source_type[][][]`
  - `[][][]title[][][]`
  - `[][][]body[][][]` (`news_items.body`; source에 따라 summary/teaser일 수 있음)
  - `[][][]full_text[][][]` (`news_fulltext.full_text`가 있으면 사용)
  - `[][][]tickers_csv[][][]`
- source별 텍스트 해석 규칙:
  - `press_release`, `fmp_press_release`: `title + body + full_text`를 함께 본다.
  - `company_news`, `news`, `market_news`: `title + body`를 기본으로 보고, full text가 있으면 우선 반영한다.
  - `investing_stock_market_news`, `investing_cryptocurrency_news`: `title + body(summary) + full_text`를 모두 확인하는 것을 기본값으로 둔다. full text가 없으면 `body`를 summary로 명시하고 과신하지 않는다.
- 가격 반응 입력(`news_change_metrics`):
  - `[][][]change_pct[][][]`: 전일 종가 → 뉴스 기준일 종가
  - `[][][]change_1d_pct[][][]`: 전일 종가 → 1거래일 후 종가
  - `[][][]change_from_open_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 종가
  - `[][][]change_open_to_high_pct[][][]`: 뉴스 기준일 시가 → 뉴스 기준일 고가
  - `[][][]change_3d_pct[][][]`: 전일 종가 → 3거래일 후 종가
  - `[][][]change_7d_pct[][][]`: 전일 종가 → 7거래일 후 종가
  - `[][][]change_14d_pct[][][]`: 전일 종가 → 14거래일 후 종가
  - `[][][]change_30d_pct[][][]`: 전일 종가 → 30거래일 후 종가
- 시가총액 입력:
  - `[][][]market_cap[][][]` (`company_profiles.market_cap`의 최신값)

운영적 영향 점수 정의:

- `Model_2`에서 "이 뉴스가 가격에 영향을 미쳤는가" 판단은 기본적으로 **change 계열 데이터**를 기준으로 한다.
- 이 영향 점수는 `case_type`을 만드는 용도가 아니라, **이미 언어/맥락 기준으로 묶인 유형의 가격 영향 빈도와 강도**를 측정하는 용도다.
- 이 영향 점수는 `long / short` 상위 분류를 정하는 데도 사용하지 않는다.
- **당일 데이터 1~3개만으로 판단하지 않는다.** 뉴스 영향은 지연되거나 1주~1개월 동안 누적될 수 있으므로, 가능한 한 전체 change vector를 같이 본다.
- 기본 change vector:

  `V = [change_from_open_pct, change_open_to_high_pct, change_pct, change_1d_pct, change_3d_pct, change_7d_pct, change_14d_pct, change_30d_pct]`

- `Model_2`는 아래 3개 구간 점수를 따로 계산한 뒤, 마지막에 종합한다.

  - `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
  - `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`
  - `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`

- 최종 종합 점수는 아래처럼 둔다.

  `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`

- 실제 계산 순서는 아래와 같다.
  1. 뉴스 1건에 대해 `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`를 읽는다.
  2. 각 구간에서는 **부호를 잠시 무시하고 절대값**만 본다. 즉 `+12%`와 `-12%`는 둘 다 영향 강도 `12`로 취급한다.
  3. 당일 구간 점수는 아래 3개 절대값 중 최대값이다.

     `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`

  4. 1~3거래일 구간 점수는 아래 2개 절대값 중 최대값이다.

     `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`

  5. 7~30거래일 구간 점수는 아래 3개 절대값 중 최대값이다.

     `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`

  6. 마지막으로 위 3개 구간 점수 중 최대값을 `overall_impact_score`로 둔다.

     `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`

- 계산 예시:
  - 입력값:
    - `change_from_open_pct = 4`
    - `change_open_to_high_pct = 9`
    - `change_pct = -3`
    - `change_1d_pct = 12`
    - `change_3d_pct = -7`
    - `change_7d_pct = 5`
    - `change_14d_pct = 18`
    - `change_30d_pct = 10`
  - 계산:
    - `immediate_reaction_score = max(4, 9, 3) = 9`
    - `short_followthrough_score = max(12, 7) = 12`
    - `medium_persistence_score = max(5, 18, 10) = 18`
    - `overall_impact_score = max(9, 12, 18) = 18`
  - 해석:
    - 이 뉴스의 최종 영향 강도 점수는 `18`이다.
    - 이후 이 뉴스가 속한 market cap bucket의 `p80`과 비교해서 `영향 미침 / 영향 안 미침`을 판정한다.

- `None` 처리 규칙:
  - 특정 change 컬럼 값이 없으면 그 값은 해당 구간 최대값 계산에서 제외한다.
  - 한 구간의 값이 모두 비어 있으면 그 구간 점수는 `None`이다.
  - 3개 구간 점수가 모두 `None`이면 `overall_impact_score`도 `None`이고, 이 row는 `with_change`에 포함되지 않는다.

- 이 방식의 이유:
  - `immediate_reaction_score`는 뉴스가 당일 바로 반응했는지 본다.
  - `short_followthrough_score`는 다음 1~3거래일 동안 후속 추세가 붙는지 본다.
  - `medium_persistence_score`는 1~4주 동안 뉴스 효과가 지연 또는 누적으로 남는지 본다.
- 즉, `Model_2`는 "당일 크게 움직였는가"만이 아니라 "며칠 뒤 또는 몇 주 동안 실질적으로 반응이 이어졌는가"까지 포함해서 case를 평가한다.

영향 여부 판정 규칙:

- 같은 뉴스라도 시총이 크면 절대 변동폭이 작아질 수 있으므로, **전 뉴스 공통 절대값**으로 자르지 않는다.
- 같은 분석 기간 안에서 같은 시총 bucket에 속한 뉴스들만 모아 분포를 만든다.
- threshold는 `overall_impact_score` 하나만 보지 말고, 아래 3개 구간 점수에도 각각 둘 수 있다.
  - `immediate_reaction_score`
  - `short_followthrough_score`
  - `medium_persistence_score`
- 권장 기본값:
  - bucket별 `overall_impact_score`의 `p80` 이상이면 `영향 미침`
  - 단, 보조 판정으로 `short_followthrough_score` 또는 `medium_persistence_score`가 같은 bucket의 `p80`을 넘으면 **지연형/지속형 영향**으로 별도 태그를 붙인다.
- 더 보수적으로 보고 싶으면 `p90`, 더 넓게 잡고 싶으면 `p70` 또는 `p75`로 바꿀 수 있지만, 문서/로그에 반드시 명시한다.

- `p80`의 뜻:
  - 같은 market cap bucket 안에서 `overall_impact_score`를 작은 값부터 큰 값 순으로 정렬했을 때, 상위 20% 경계에 해당하는 값이다.
  - 따라서 `overall_impact_score >= p80`이면 그 bucket 기준으로는 "상대적으로 큰 반응"에 속한다고 본다.
  - 예를 들어 어떤 bucket의 `p80 = 20.23`이면, 최종 영향 점수가 `20.23` 이상인 뉴스만 `영향 미침`으로 분류한다.

- `with_change`의 뜻:
  - `with_change`는 `영향 미침` 개수가 아니다.
  - `with_change`는 8개 change 컬럼 중 적어도 일부 값이 있어서 `overall_impact_score`를 계산할 수 있었던 row 수다.
  - 즉 `total`은 전체 뉴스 수, `with_change`는 판정 가능 뉴스 수, 그중 `p80` 이상인 row들이 실제 `영향 미침` 뉴스다.

반응 타입 태깅 규칙:

- `intraday_only`: immediate는 강하지만 short/medium이 약함
- `delayed_followthrough`: immediate는 약하지만 short가 강함
- `sustained_repricing`: medium이 강해서 7d~30d까지 영향이 남음
- `one_day_spike_then_fade`: immediate만 강하고 이후 유지 실패
- `multi_window_impact`: immediate, short, medium 중 2개 이상이 함께 강함

이 태그는 case 유형 옆에 붙여서 같은 유형 안에서도 반응 구조가 다른지 확인하는 데 사용한다.

영향력 평가 기준:

- `비슷한 이슈지만 주가에 영향 미친 수 : 비슷한 이슈지만 주가에 영향 안 미친 수`
- 영향 안 미친 경우보다 미친 경우의 비율이 높을수록, 해당 유형의 가격 영향력이 강하다고 평가할 수 있다.
- 따라서 어떤 유형은 분명 언어적으로 존재하지만, 영향 비율이 낮아서 "가격 영향은 약한 유형"으로 남을 수 있다.
- 다시 말해 `Model_2`는 "영향 큰 유형만 남기는 모델"이 아니라, **언어적으로 식별 가능한 유형을 먼저 만들고 그 뒤 영향 강도를 서열화하는 모델**이다.

market cap 반영 원칙:

- 같은 이슈라도 `market cap`이 큰 종목은 주가 변동성이 작을 수 있으므로, 영향 강도 판정 기준을 더 보수적으로 둔다.
- 따라서 case 분석은 가능하면 market cap 구간별로 나눠서 보거나, 최소한 대형주/중소형주 차이를 함께 기록한다.
- 실무 기본 구간은 아래 5단계로 둔다.
  - `[][][]300M~1B[][][]`
  - `[][][]1B~10B[][][]`
  - `[][][]10B~100B[][][]`
  - `[][][]100B~300B[][][]`
  - `[][][]300B~[][][]`
- `300M 미만` 또는 `market cap unknown` row는 위 5개 버킷과 직접 섞지 말고, 별도 보조 집단으로 집계하거나 제외 사유를 로그에 남긴다.
- 5단계 분류 이유: 1B~100B를 하나로 묶으면 시총 10배 차이 종목이 같은 bucket에 들어가 변동성 기준이 왜곡된다. 10B를 경계로 나누면 mid-cap과 large-cap의 반응 차이를 구분할 수 있고, 100B 이상도 mega-cap(300B~)과 구분하면 AAPL/MSFT급과 일반 대형주의 해석이 분리된다.

`press_release only` 운영 모드:

- `Model_2` 기본 실행 모드는 `press_release only`로 둔다.
- 이유:
  - `press_release`는 issuer-driven 이벤트라서 case 유형과 가격 반응 연결이 상대적으로 직접적이다.
  - `company_news`나 `news`는 재서술 기사, commentary, analyst rewrite가 섞여 동일 규칙으로 분류하면 잡음이 커진다.
- 따라서 먼저 `press_release only + market cap bucket` 기준으로 case taxonomy를 만들고, 나중에 다른 source는 별도 부록 또는 별도 표로 붙인다.
- Investing source를 확장할 때도 위 기본값은 유지한다. 즉 `press_release` note를 먼저 만들고, Investing는 별도 run / 별도 note / 별도 evidence table로 분리하는 쪽을 우선한다.
- 특히 `investing_stock_market_news`는 market wrap, macro, sector 기사 비중이 있어서 회사 event taxonomy와 직접 섞으면 의미가 흐려질 수 있다.

사례 분류 절차:

1. 기간을 먼저 고정한다.
2. source 범위를 기본적으로 `press_release only`로 고정한다.
3. ticker를 정규화해 최신 `market_cap`과 bucket을 붙인다.
4. `title/body/full_text`를 읽고, **등락률을 보지 않은 상태에서** 뉴스의 언어적 방향성을 기준으로 1차 `long / short / residual` 상위 분류를 정한다.
5. 그 다음 사건의 언어적 의미와 맥락을 기준으로 2차 `case_type`을 정한다.
6. 반복성이 낮고 설명력이 약한 잡성 PR은 `meaningless_others` 같은 잔여 유형으로 보낸다.
7. 각 뉴스마다 immediate / short / medium 점수와 `overall_impact_score`를 계산한다.
8. 같은 case type 내부에서 시총 bucket별 `영향 미침 비율`과 반응 타입 비중을 계산한다.
9. 최종 note는 가능하면 `long -> short -> residual` 큰 순서로 정리하고, 각 묶음 안에서 영향력 순으로 세부 유형을 배치한다.
10. 전체 비율만 보지 말고, bucket별 반응 편차와 대표 사례/반례를 같이 남긴다.
11. Investing source를 분석할 때는 각 row마다 `title`, `body(summary)`, `full_text` 중 실제로 무엇을 읽고 분류했는지 누락 여부를 로그나 근거 표에 남긴다.
12. Investing source를 분석할 때 간접 영향 가능성이 핵심이면, 과거 `company_news`를 검색해 같은 내러티브의 유사 사례와 가격 반응 구조를 별도로 확인한다.

유형 설계와 잔여 유형 운영 규칙:

- 같은 분석 note 안에서는 case taxonomy의 총 개수를 `10 ~ 50` 범위에서 유지하는 것을 기본값으로 둔다.
- 처음에는 약간 넓게 묶고, 반복 뉴스 수와 대표 사례가 충분히 쌓일 때만 독립 유형으로 분리한다.
- 반대로 유형 하나가 지나치게 넓어서 내부 뉴스 의미가 너무 다르면, 하위 패턴을 다시 점검해 둘 이상으로 분리한다.
- `long / short` 상위 분류가 애매한 경우에도 먼저 등락률을 보지 말고, 기사 문장 자체가 말하는 가치 경로를 기준으로 판정한다.
- 방향이 혼재되거나 정보성 공지에 가까워 언어 기반 판정이 어려우면 `residual`로 보낸다.
- `meaningless_others` 비중이 지나치게 커지면 그 안을 재검토해, 새 독립 유형 후보가 있는지 확인한다.
- note에는 가능하면 `meaningless_others`의 비중도 함께 남겨, taxonomy가 너무 거칠게 설계됐는지 점검할 수 있게 한다.
- 각 유형 설명을 쓸 때는 "다음 뉴스가 들어왔을 때 분류자가 10~30초 안에 판단할 수 있는가?"를 기준으로 다시 본다.
- 판별이 느리거나 자꾸 재해석이 필요하면, 유형 정의에 `포함 신호`, `제외 신호`, `경계 사례`, `빠른 판별 질문`이 부족한 경우가 많으므로 그 항목을 보강한다.
- 새 뉴스를 빠르게 분류하기 위한 기본 질문은 아래 순서를 권장한다.
  1. 이 기사의 headline/lead에서 가장 중심 경제 사건은 무엇인가?
  2. 그 사건은 기업가치 상승 경로(`long`)인가, 훼손 경로(`short`)인가, 아니면 방향 불명(`residual`)인가?
  3. 이 사건이 기존 `case_type` 정의의 포함 신호와 직접 맞아떨어지는가?
  4. 만약 맞는다면, 인접 유형의 제외 신호에는 걸리지 않는가?
  5. 둘 다 애매하면 기존 유형을 억지로 고르지 말고 `residual`로 남긴 뒤 로그에 이유를 적는다.

근거 뉴스 표 파일 규칙:

- `Model_2` 결과를 낼 때는 분류 근거가 되는 뉴스들을 별도 표 파일로 남긴다.
- 기본 저장 위치: `C:\github_coding\terminal_sec\ai_research_tool\model_2_source`
- 기본 원칙: **분석 note 제목과 같은 base name**으로 근거 표 파일을 만든다.
- 예시:
  - note 제목이 `model 2 test gpt5.4`이면 표 파일명은 `model 2 test gpt5.4.md`로 둔다.
  - 같은 제목을 파일명으로 쓰기 어려운 문자가 있으면 Windows 파일명 금지 문자만 제거하고, 나머지 제목은 최대한 유지한다.
- note 본문에는 아래를 반드시 적는다.
  - `근거 표 파일 경로: C:\github_coding\terminal_sec\ai_research_tool\model_2_source\...`
  - 이 파일이 "유형 분류 근거가 된 전체 뉴스 표"라는 설명
- 이 파일에는 **유형 결정 근거가 된 모든 뉴스**를 행 단위로 적는다.
- 최소 컬럼:
  - `[][][]case_type[][][]`
  - `[][][]reaction_tag[][][]`
  - `[][][]news_id[][][]`
  - `[][][]published_at[][][]`
  - `[][][]ticker[][][]`
  - `[][][]market_cap[][][]`
  - `[][][]market_cap_bucket[][][]`
  - `[][][]title[][][]`
- 권장 추가 컬럼:
  - `[][][]source_type[][][]`
  - `[][][]source[][][]`
  - `[][][]has_full_text[][][]`
  - `[][][]change_pct[][][]`
  - `[][][]change_from_open_pct[][][]`
  - `[][][]change_open_to_high_pct[][][]`
  - `[][][]change_1d_pct[][][]`
  - `[][][]change_7d_pct[][][]`
  - `[][][]change_14d_pct[][][]`
  - `[][][]change_30d_pct[][][]`
  - `[][][]immediate_reaction_score[][][]`
  - `[][][]short_followthrough_score[][][]`
  - `[][][]medium_persistence_score[][][]`
  - `[][][]overall_impact_score[][][]`
- 이 표 파일은 "왜 이 case 유형을 만들었는가"를 사람이 역추적할 수 있게 하는 근거 registry다.
- 같은 note를 다시 돌려 업데이트하면, 기존 파일을 덮어쓰거나 같은 제목 기반 새 버전을 만들되, note 본문에 실제 최종 파일 경로를 다시 명시한다.

`Model_2` note 본문 필수 섹션:

- `## 분석 범위`
- `## 유형 분류 기준`
- `## 유형별 정의 요약`
- `## 영향 판정 기준`
- `## market cap bucket 기준`
- `## 내부 사고과정 로그(주요 판단 요약)`
- `## 근거 표 파일`

`## 유형별 정의 요약` 작성 규칙:

- 이 섹션은 각 `case_type`이 "무엇을 뜻하는지"를 빠르게 재사용할 수 있게 만드는 요약 섹션이다.
- 각 유형마다 가능하면 아래 형식을 따른다.
  - `유형명`
  - `상위 분류`: `long`, `short`, `residual` 중 하나
  - `한 줄 정의`
  - `핵심 가치 경로`
  - `포함 신호`
  - `제외 신호`
  - `경계 사례`
  - `빠른 판별 질문`
  - `대표 뉴스 id / ticker / title`
- 이 섹션의 목표는 미려한 설명문이 아니라, **다음 뉴스가 들어왔을 때 재빨리 같은 기준으로 분류할 수 있는 판별 카드**를 남기는 것이다.
- 같은 유형이더라도 표현이 매우 다양하면, `포함 신호`를 2~5개 정도의 대표 패턴으로 압축해 적는다.
- 인접 유형과 자주 헷갈리면 `경계 사례`를 반드시 적고, 어떤 문장이 나오면 다른 유형으로 보내는지 분명히 쓴다.
- `residual` 계열도 예외가 아니다. 왜 residual로 남겼는지, 어떤 조건이 충족되면 이후 독립 유형으로 승격할 수 있는지도 짧게 적는다.

`내부 사고과정 로그(주요 판단 요약)` 작성 규칙:

- 여기서 말하는 로그는 자유서술식 내부 추론 전문 전체를 복붙하는 것이 아니다.
- 대신, **실제로 분류 결과를 바꾼 주요 판단**을 재현 가능하게 구체적으로 적는다.
- 너무 짧게 `p80 사용`, `press_release만 사용`처럼 끝내지 말고, 아래 수준으로 남긴다.
  - 왜 `long / short / residual` 상위 분류를 그렇게 정했는지
  - 왜 특정 유형을 `long` 쪽 또는 `short` 쪽에 배치했는지
  - 왜 등락률이 아니라 언어/맥락 기준으로 유형을 먼저 나눴는지
  - 왜 taxonomy 크기를 현재 수준(예: 12개, 18개, 27개 등)으로 정했는지
  - 왜 일부 뉴스를 `meaningless_others` 같은 잔여 유형으로 보냈는지
  - 왜 `press_release only`로 제한했는지
  - 왜 특정 case를 독립 유형으로 분리했고, 왜 다른 표현들은 같은 유형으로 합쳤는지
  - 왜 특정 threshold를 선택했는지
  - 어떤 대표 사례/반례를 보고 규칙을 보정했는지
  - 어떤 row들을 제외했고, 그 제외가 결과에 어떤 영향을 주는지
  - Investing 기사에 대해 왜 과거 `company_news` 검색이 필요하다고 봤는지, 어떤 키워드/사건축으로 검색했는지
  - 그 검색 결과가 실제 분류나 간접 영향 판단을 어떻게 바꿨는지
- 각 로그 항목은 가능하면 아래 형식을 따른다.
  - `판단 대상`
  - `검토한 데이터/패턴`
  - `최종 결정`
  - `결정 이유`
  - `대표 근거 뉴스 id / ticker / title`
- 목표는 "나중에 note만 읽어도 왜 이런 taxonomy와 threshold가 나왔는지 추적 가능한 상태"이지, 비정형 내부 독백 전체 저장이 아니다.

로그에 반드시 남길 항목:

- 기간: `[][][]since[][][] ~ [][][]until[][][]`
- source 범위: 기본적으로 `[][][]press_release only[][][]`, 확장한 경우 다른 source를 명시
- Investing를 포함한 경우 `[][][]investing_stock_market_news[][][]`, `[][][]investing_cryptocurrency_news[][][]` 중 무엇을 포함했는지와 `title/body/full_text` 중 어떤 텍스트 레이어를 실제 사용했는지
- Investing를 포함하고 간접 영향 판단을 했으면, 과거 검색 대상이 `[][][]company_news[][][]`였는지, 어떤 검색 키/내러티브 축을 썼는지, 대표 유사 사례가 무엇이었는지
- `long / short / residual` 상위 분류 정의와 판정 기준
- taxonomy 크기: 이번 note에서 실제 사용한 `case_type` 개수와 그 이유
- 각 주요 `case_type`을 어떤 운영적 정의로 설명했는지, 그리고 그 정의가 새 뉴스 판별에 왜 유용한지
- 영향 점수 식과 사용한 전체 change 컬럼 목록
- `case_type`은 언어/맥락 기준으로 분류했고, change 계열은 영향 판정에만 사용했다는 점
- `long / short`도 언어 기준으로 분류했고, 등락률 데이터로 사후 결정하지 않았다는 점
- market cap bucket 정의
- bucket별 threshold (`p50`, `p80`, `p90` 등)
- immediate / short / medium / overall 점수 정의
- reaction tag 규칙
- `meaningless_others` 또는 잔여 유형 사용 여부와 그 포함 기준
- case 유형별 `영향 미침 / 영향 안 미침`
- 대표 사례와 반례
- 제외된 row 수와 제외 이유 (`market cap unknown`, `change 없음`, `text 없음` 등)
- `full_text 없음`인 Investing row를 어떻게 처리했는지
- 과거 `company_news` 검색 결과 간접 영향이 확인됐는지, 약했는지, 없었는지
- 근거 뉴스 표 파일 경로
- 근거 표 파일명과 note 제목의 매칭 관계
- `내부 사고과정 로그(주요 판단 요약)` 섹션에서 실제 분류 기준을 바꾼 핵심 판단들

이 모델은 개별 기사 판정용이 아니라, **기간 전체에서 반복되는 가격영향 패턴을 분류하는 메타 모델**이다.
