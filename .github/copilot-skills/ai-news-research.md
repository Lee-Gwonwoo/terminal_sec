# AI News Research

### 언제 쓰나
- 채팅에서 `ai research`, `AI research`, `ai news research`처럼 AI 리서치 관련 작업을 말했고, 뉴스/종목 영향 해석이나 사례 분류가 포함될 때.
- 뉴스 본문 또는 headline/summary를 읽고, 해당 뉴스가 개별 종목 주가에 미칠 가능성 있는 영향을 사람이 읽을 수 있는 형태로 정리해야 할 때.
- `Score`, `Score Evidence`, `Keywords` 같은 AI 후처리 컬럼의 생성 규칙을 고정해야 할 때.
- UI/DB/API에서 AI 뉴스 분석 결과를 같은 의미로 다뤄야 할 때.

### 목적
이 지침은 AI 뉴스 리서치/분석 작업을 아래 4개 모델로 나눠서 정의한다.

1. `🟦 Model_1_new news analysis`
2. `🟧 Model_2_case analysis`
3. `🟥 Model_3_single-news scoring analysis`
4. `🟩 Model_4_watchlists analysis`

기존에 문서에 있던 단일 뉴스 `Score / Score Evidence / Keywords` 생성 방식은 이제 `Model_3`로 분류한다.

추가로 `Model_1`에는 필요시 **간접 영향 전파 점검 단계**인 `model_1_2_investing`을 붙일 수 있다. 이는 별도 4번째 모델이 아니라, `Model_1`의 DB 기반 분석을 끝낸 뒤 Investing 웹사이트의 시황/정책/테마 기사를 추가 조사해 **ticker 직접 매핑이 약한 외부 이슈가 어떤 공개 ticker 바스켓과 watchlist 내부 종목에 readthrough를 만들 수 있는지 구조적으로 점검하는 규칙**이다. 상세 정의는 [ai-news-research_model1.md](ai-news-research_model1.md)에 둔다.

`Model_4_watchlists`는 `Model_1`과 같은 분석 프레임을 사용하되, **현재 뉴스 직접 분석 대상을 사용자가 지정한 watchlist ticker 집합으로 제한**하는 모델이다. 상세 정의는 [ai-news-research_model4_watchlists.md](ai-news-research_model4_watchlists.md)에 둔다.

### plan / log 문서 작성 예외

- 이 스킬이 적용되는 작업은 기본적으로 `ai_agent_plan/.../plan.md`, `agent_log.md` 작성 대상이 아니다.
- 즉, AI 뉴스 리서치/분석 자체를 수행할 때는 채팅에 세부 계획을 설명하더라도 별도의 `plan.md`, `agent_log.md` 파일을 만들거나 갱신할 필요가 없다.
- 예외는 사용자가 `plan.md`, `agent_log.md`, 작업 로그, 단계별 기록 파일 작성을 **명시적으로 요청한 경우**뿐이다.
- 이 예외는 AI 뉴스 리서치 결과 정리, 사례 분류, 근거 표 작성, 모델별 판단 규칙 정리 작업에 동일하게 적용한다.
- 이 예외는 `.github/copilot-instructions.md`의 일반적인 계획/단계별 log 규정보다 우선한다. 즉 AI 뉴스 리서치 작업에서는 채팅 안의 세부화된 계획과 검증 보고는 유지하되, 그것만으로 `plan.md`, `agent_log.md` 파일 작성 의무가 자동으로 생기지 않는다.
- 사용자가 page 본문, research note, evidence table, DB의 `research_pages.body` 같은 **분석 산출물 자체**를 갱신하라고 지시한 경우에도, 그 산출물 갱신은 연구 결과 저장으로 보며 `agent_log.md` 작성 트리거로 해석하지 않는다.
- 사용자가 `page id`를 주면서 분석을 요청하거나, 기존 research page / note를 문맥으로 명시하면, **기본 동작은 채팅에만 설명하는 것이 아니라 해당 page 본문(`research_pages.body`)을 갱신하는 것**으로 해석한다.
- 즉 `page id 기반 AI research 요청`에서는 특별한 반대 지시가 없는 한 `page 저장이 기본`, `채팅 응답은 요약/진행 보고가 기본`이다. 분석 전문은 우선 page 산출물에 남기고, 채팅에는 핵심 결론과 저장 여부를 짧게 알린다.
- 반대로 사용자가 `채팅으로만 설명`, `저장하지 말고 보여만 달라`, `draft만 먼저 보자`처럼 명시하면 그때만 page 저장을 보류한다.
- 반대로 사용자가 명시적으로 `plan.md` 작성, `agent_log.md` 기록, 단계별 작업 로그 보관, 사용자 확인 상태 추적을 요구하면 그 시점부터는 예외를 해제하고 일반 planning 규칙을 적용한다.

### 상세 조사 / 상세 설명 우선 원칙

- AI news research 작업에서는 **빠른 실행 / 최소 설명**보다 **정확한 조사 / 충분한 근거 설명 / 감사 가능한 서술**을 우선한다.
- 즉 이 스킬이 적용되는 작업에서는, 일반적인 짧은 답변 선호보다 **상세 모드**를 기본값으로 둔다.
- 사용자가 `자세히`, `근거`, `왜`, `독립적으로`, `날짜별`, `full model1`, `상세히 조사` 같은 표현을 쓰지 않았더라도, AI news research 자체는 기본적으로 **축약하지 않는 쪽**을 우선한다.
- 이 스킬이 적용되는 동안에는 “필요한 만큼만 설명”을 보수적으로 해석하지 않는다. 기본값은 **사람이 나중에 다시 읽어도 판단 경로를 추적할 수 있을 정도로 충분히 설명하는 것**이다.
- 단순 결론 요약만 먼저 내리고 핵심 근거를 생략하는 것을 금지한다. `High`, `Medium`, `watch`, `noise` 같은 결론 라벨만 적고 넘어가면 불완전한 결과물로 간주한다.
- 조사량이 부족하면 섣불리 짧게 마감하지 말고, 어떤 축에서 증거가 부족한지 명시한 뒤 same-ticker, other-ticker, peer, industry, counter-example 축을 더 확인한다.
- AI research 결과는 원칙적으로 아래 3가지를 동시에 만족해야 한다.
  1. **정확성**: 기사 내용, 기업 컨텍스트, 과거 유사사례, 가격 반응 해석이 서로 모순되지 않아야 한다.
  2. **충분성**: 결론에 이르기까지 필요한 근거가 빠지지 않아야 한다.
  3. **추적 가능성**: 사용자가 “왜 이런 결론이 나왔는가”를 되짚을 수 있어야 한다.
- 따라서 AI news research에서는 `짧지만 그럴듯한 요약`보다 `길더라도 방어 가능한 설명`을 우선한다.

### 축약 금지 / 미완료 판정 규칙

- 아래 중 하나라도 빠지면, 원칙적으로 `분석 완료`로 간주하지 않는다.
  - 현재 뉴스 사건의 핵심 경제적 성격 설명
  - 회사 핵심 사업과의 연결성 설명
  - same-ticker 유사사례 조사 결과
  - other-ticker 유사사례 조사 결과
  - 채택 사례의 포함 이유
  - 제외 사례 또는 반례의 의미
  - 최종 판단이 어떻게 바뀌었는지에 대한 사고흐름
  - 남은 한계 또는 불확실성
- same-ticker 또는 other-ticker 사례가 부족하면, 단순히 “없음”이라고 끝내지 말고 아래를 반드시 같이 적는다.
  - 실제 확보 건수
  - 어떤 키워드/peer/industry 축으로 찾았는지
  - 왜 더 못 찾았는지
- 사용자가 날짜별 분석을 요청하면, 날짜를 합쳐서 한 번에 뭉뚱그려 서술하지 않는다. 각 날짜를 **독립 섹션**으로 분리하고, 날짜별로 판단 근거와 결론을 따로 적는다.
- 사용자가 page id 기반 research note 갱신을 요청하면, 특별한 지시가 없는 한 page 본문도 **요약본이 아니라 검토 가능한 상세본**으로 작성한다.
- 사용자가 page id를 제공한 요청에서 agent가 분석을 끝냈다면, 특별한 금지 지시가 없는 한 **채팅 답변만 남기고 종료하면 미완료로 본다.** 최소 기준은 `research_pages.body` 반영 + 채팅에 저장 완료 요약까지다.

### 상세 출력 최소 기준

- `Model_1`에서는 각 날짜 또는 각 핵심 ticker마다 최소한 아래 항목을 포함한다.
  1. 현재 뉴스 요약
  2. 기업 컨텍스트 (description / industry / market cap)
  3. 1단계 초기 판단
  4. same-ticker 조사
  5. other-ticker 조사
  6. 반례 또는 약화 요인
  7. 최종 재판단
  8. 남은 한계
- `Model_1`에서 same-ticker와 other-ticker는 **반드시 분리된 소제목 또는 문단**으로 적는다. 둘 중 하나라도 누락하면 축약으로 간주한다.
- `Model_1`에서 가능하면 각 축마다 **최소 3건 이상 확보를 시도**하고, 실제 확보 건수는 숫자로 적는다.
- `Model_1`에서 current ticker를 최종 후보로 올릴 때는 가능하면 아래 수치도 함께 적는다.
  - `market_cap`
  - `float %`
  - `institutional ownership %`
  - `insider ownership %`
  - `short interest %`
- 사용자가 **여러 날짜를 한 번에** 요청하면, `Model_1`의 기본 단위를 임의로 `날짜당 대표 뉴스 1건`으로 축소하지 않는다.
- 여러 날짜 요청에서는 먼저 **각 날짜의 current-news 집합 전체**를 훑고, 날짜별로 아래 중 무엇인지 명시해야 한다.
  - `primary`: 그 날짜의 핵심 분석 대상으로 남길 뉴스
  - `secondary`: 의미는 있지만 primary보다는 한 단계 낮은 뉴스
  - `watch`: 후속 확인 가치가 있지만 사건 본체로 보긴 어려운 뉴스
  - `noise`: law-firm, 일정 공지, generic promotion처럼 제외한 뉴스
- 여러 날짜 요청에서 `secondary`로 남긴 뉴스도, **최종 note에 남기는 이상 `primary`와 동일한 Model_1 상세 구조**를 적용한다.
  - 즉 `secondary`도 `현재 뉴스 요약 -> 기업 컨텍스트 -> 1단계 초기 판단 -> same-ticker -> other-ticker -> 반례/약화 요인 -> 최종 재판단 -> 남은 한계` 순서를 유지한다.
  - 차이는 중요도/최종 등급이 `primary`보다 한 단계 낮을 수 있다는 점이지, 조사 축을 생략해도 된다는 뜻이 아니다.
- 여러 날짜 요청에서 **한 날짜에 primary가 2건 이상**이면, 그 날짜는 primary 뉴스 각각에 대해 별도 `Model_1` 블록을 작성한다. 날짜당 1개만 남기기 위해 억지로 대표 anchor 1건으로 압축하지 않는다.
- 여러 날짜 요청에서 `secondary`가 남아 있으면, 그 날짜는 `secondary` 뉴스 각각에 대해서도 별도 `Model_1` 블록을 작성한다. 즉 본문 분석 대상을 `primary`까지만 자르고 `secondary`를 한 줄 메모로만 처리하지 않는다.
- 여러 날짜 요청에서 날짜별 결과물은 최소한 아래 2단 구조를 가져야 한다.
  1. `날짜별 current-news 전수 스크리닝 요약` : 그 날짜에 검토한 뉴스 목록과 `primary / secondary / watch / noise` 분류
  2. `날짜별 상세 Model_1 본문` : `primary`와 `secondary`로 남긴 뉴스 각각에 대한 same-ticker / other-ticker / 반례 / 최종 판단
- 여러 날짜 요청에서 `watch`는 상세 Model_1 본문까지 강제하지는 않더라도, **적어도 ticker와 headline 요약은 상단 표 또는 그 바로 아래 watch 보조 표에서 보이게** 남긴다.
  - 즉 `watch`를 단순히 "기타 몇 건"으로 뭉개지 말고, 최소한 `ticker / headline 요약 / watch로 둔 짧은 이유`는 사용자에게 보이게 한다.
- 여러 날짜 요청에서 사용자가 page 본문이나 research note를 요구하면, **왜 그 뉴스들을 남겼고 왜 다른 뉴스들을 뺐는지**를 날짜별로 적는다. 즉 최종 선정 뉴스만 적고 탈락 과정을 숨기면 불완전한 결과물로 간주한다.
- 여러 날짜 요청에서 마지막에 날짜별 `대표 뉴스`를 1개만 따로 요약하는 것은 허용하지만, 그것은 **요약용 보조 정보**일 뿐 본문 분석 대상을 1개로 제한하는 근거가 되어서는 안 된다.
- `Model_2`에서는 유형명만 적고 끝내지 않는다. 각 유형마다 `한 줄 정의`, `핵심 가치 경로`, `포함 신호`, `제외 신호`, `경계 사례`, `대표 예시`를 남긴다.
- `Model_3`에서는 점수만 적고 끝내지 않는다. `무엇이 발생했는가`와 `왜 가격 영향으로 이어지는가`를 분리해서 설명한다.

### 설명 강도 우선순위 규칙

- AI news research 작업에서 우선순위는 아래 순서를 기본값으로 둔다.
  1. 정확성
  2. 충분한 조사
  3. 설명의 추적 가능성
  4. 구조적 가독성
  5. 속도
  6. 길이 절약
- 즉 시간이 덜 들거나 답변이 짧아진다는 이유만으로 조사 단계나 설명 단계를 생략하지 않는다.
- 조사 시간이 길어지더라도, 근거가 빈약한 빠른 결론보다 **근거가 축적된 느린 결론**을 우선한다.
- 다만 끝없이 전수조사하라는 뜻은 아니다. 결론을 방어할 수 있을 정도의 근거가 모이면 그 시점에서 정리하되, 무엇을 확인했고 무엇이 아직 비어 있는지는 명시한다.

### 시각적 구분 규칙

- AI 뉴스 리서치 결과를 `research_pages.body`, research note, evidence note 형태로 저장할 때는 **시각적으로 빠르게 훑을 수 있는 구조**를 기본값으로 사용한다.
- 단순 장문 문단만 연속으로 쓰지 말고, 아래 요소를 적극적으로 조합한다.
  - 이모티콘이 붙은 섹션 헤더 예: `🎯`, `📌`, `🔎`, `🧪`, `✅`, `🚨`, `📊`
  - Markdown 구분선 `---`
  - 요약 표: 날짜별 anchor, hindsight 비교, miss 원인, 해결 규칙
  - 간단한 텍스트 그래프/막대 그래프: 실제 반응 강도 비교, 중요도 상대 크기 비교
- 기본 권장 구조:
  1. 상단 제목
  2. 분석 전제 / 가드레일
  3. 빠른 요약 표
  4. 본문 섹션
  5. 사후 점검 또는 hindsight 비교 표
  6. 다음번 해결 규칙
- 날짜별 분석처럼 반복되는 구조는 각 날짜마다 동일한 템플릿을 유지해 스캔 가능성을 높인다.
  - 예: `🗓️ 날짜 -> 🔎 1단계 -> 🧪 2단계 -> ✅ 3단계`
- 여러 날짜를 한 번에 다루는 경우에는 위 템플릿 앞에 `📋 날짜별 current-news 스크리닝 표` 또는 동등한 수준의 목록을 먼저 둔다. 사용자가 각 날짜에 어떤 뉴스가 있었는지 보지 못한 채 anchor만 읽게 만들지 않는다.
- 여러 날짜 분석에서 한 날짜 안에 primary 뉴스가 복수면, `🗓️ 날짜 -> 📋 전수 스크리닝 -> 🎯 primary A -> 🔎/🧪/✅ -> 🎯 primary B -> 🔎/🧪/✅`처럼 날짜 내부에서도 복수 블록 구조를 유지한다.
- 표와 그래프는 장식이 아니라 **판단 비교를 빠르게 만드는 목적**으로 넣는다. 즉 “내가 고른 anchor vs 실제 크게 움직인 ticker”, “예상 중요도 vs 실제 반응” 같은 비교형 표를 우선한다.
- 텍스트 그래프는 외부 렌더러 의존 없이 raw Markdown / DB preview 에서도 읽히는 형태를 사용한다.
  - 예: `RLMD | ██████████ 61.12`
- 이모티콘은 과하게 남발하지 말고, 섹션 경계와 의미 구분이 필요한 곳에만 반복적으로 사용한다.
- 사용자가 별도 스타일을 요구하지 않았다면, 최소한 **헤더 + 구분선 + 1개 이상 요약 표**는 포함하는 쪽을 기본값으로 둔다.

### AI News Research에 사용 가능한 DB / 저장소 정리

AI news research 작업에서는 모든 저장소를 동일하게 취급하면 안 된다. 아래처럼 **source of truth**, **보조 DB**, **비정규 산출물**을 구분해서 사용한다.

#### 1. 1차 source of truth: 앱 런타임 DB

- 경로: `terminal/backend/backend/data/app.db`
- 역할: AI news research에서 가장 먼저 확인해야 하는 기본 DB다.
- 이 DB에서 직접 읽을 수 있는 핵심 데이터:
  - `[][][]news_items[][][]`: 뉴스 메타데이터, `published_at`, `source_type`, `title`, `body`, `url`, `tickers_csv`, `publisher`, `origin_url`
  - `[][][]news_fulltext[][][]`: full text, extraction 상태, keyword 후처리 결과
  - `[][][]news_change_metrics[][][]`: 8개 change metric의 canonical 저장소
  - `[][][]news_ai_analysis[][][]`: `Model_3` 저장 대상 테이블. 다만 2026-03-12 live DB 기준 현재 0 rows다.
  - `[][][]news_sentiment_snapshots[][][]`: ticker 단위 sentiment snapshot
  - `[][][]company_profiles[][][]`: description, peers, ipo_date, market_cap
  - `[][][]securities[][][]`: ticker, sector, industry. 특히 `industry` 해석에 중요하다.
  - `[][][]research_tabs[][][]`, `[][][]research_pages[][][]`: AI research note / page 관리용 메타데이터
- 사용 우선순위:
  - `Model_1`: `news_items` + `news_fulltext` + `news_change_metrics` + `company_profiles` + `securities`
  - `Model_2`: `news_items` + `news_fulltext` + `news_change_metrics` + `company_profiles` + `securities` + 필요시 `research_pages`
  - `Model_3`: `news_items` + `news_fulltext` + `company_profiles` + `securities` + 저장 결과는 `news_ai_analysis`
- 해석 주의:
  - `company_profiles`는 ticker당 단일 row가 아니라 source별 다중 row다. raw SQL에서는 `securities` JOIN과 대표 row 선택 규칙이 필요하다.
  - `industry`는 `company_profiles` 컬럼이 아니라 `securities.industry` 또는 CSV fallback에서 온다.
  - `change` 계열은 `news_items`의 legacy inline 컬럼보다 `news_change_metrics`를 우선 사용한다.
  - Investing 기사는 현재 `news_items.source = 'INVESTING'`, `source_type = investing_stock_market_news|investing_cryptocurrency_news` 계열로 저장될 수 있다.
  - Investing row의 `news_items.body`는 listing summary/teaser 성격일 수 있으므로, 기사 본문까지 판단해야 하는 작업에서는 `news_fulltext.full_text`를 함께 본다.
  - `/api/news`는 기업 컨텍스트와 change metric enrich에는 유용하지만 full text canonical source로 가정하지 않는다.

#### 2. 2차 보조 DB: OHLC canonical price DB

- 경로: `OHLC_data/ohlc_1d_watchlist.sqlite`
- 역할: 뉴스 반응률을 재계산하거나 검증할 때 쓰는 가격 DB다.
- 핵심 테이블:
  - `[][][]ohlc_1d[][][]`: 일봉 OHLCV + 일부 파생 change 컬럼
  - `[][][]symbols[][][]`: Symbol, Industry
- 언제 쓰나:
  - `news_change_metrics` 값 검증이 필요할 때
  - `Model_1`, `Model_2`에서 change metric을 다시 계산하거나 누락 row를 점검할 때
  - 특정 뉴스의 target date / follow-through 구조를 수동 검산할 때
- 주의:
  - AI news research의 기본 뉴스 source DB는 아니다.
  - 먼저 `app.db`의 `news_change_metrics`를 보고, 부족하거나 의심될 때만 이 DB로 내려간다.
  - 장중에는 current ET date 일봉을 canonical로 보지 않는 운영 규칙을 감안해야 한다.

#### 3. Research note용 메타데이터 저장 위치

- 경로: `terminal/backend/backend/data/app.db`
- 관련 테이블:
  - `[][][]research_tabs[][][]`
  - `[][][]research_pages[][][]`
- 역할:
  - page id 기반 분석 요청이 들어올 때, 어떤 note/page가 현재 살아 있는지 확인한다.
  - `Model_2` 결과 note와 page title, soft delete 여부를 확인할 때 사용한다.
- 주의:
  - 이 테이블은 뉴스 본문 source가 아니라 research 문서/탭 메타데이터다.
  - 기사 분류 근거 자체는 여전히 `news_items`, `news_fulltext`, `news_change_metrics` 쪽에서 읽는다.

#### 4. 비정규 산출물: 참고만 하고 canonical로 간주하지 않는 저장소

- 대표 경로:
  - `storage/`
  - `tmp/`
  - `tmp/probes/`
  - `ai_research_tool/out/`
  - `ai_research_tool/model_2_source/`
- 역할:
  - 실험 export, 임시 검증, note 산출물, 근거 표 파일 저장
- 사용 규칙:
  - 사람이 읽는 근거 note나 evidence table로는 쓸 수 있다.
  - 하지만 원천 뉴스/가격/source-of-truth DB로 간주하면 안 된다.
  - DB와 충돌하면 항상 `app.db`와 `ohlc_1d_watchlist.sqlite`를 우선한다.

#### 5. DB 선택 순서 (실무 기본값)

- 뉴스 텍스트/메타데이터가 필요하면 먼저 `app.db -> news_items`, 필요시 `news_fulltext`
- 기업 컨텍스트가 필요하면 `app.db -> company_profiles + securities`
- 산업 분류가 필요하면 `company_profiles`가 아니라 `securities.industry`를 우선 확인
- 주가 반응률이 필요하면 먼저 `app.db -> news_change_metrics`, 검산이 필요할 때만 `OHLC_data/ohlc_1d_watchlist.sqlite`
- note/page ID 확인은 `app.db -> research_pages`, `research_tabs`
- 실험 파일/Markdown 산출물은 근거 참고용이지 canonical DB가 아니다.

#### 6. 쿼리/해석 실수 방지 규칙

- `company_profiles` 단독 조회 결과를 “회사당 1개 프로필”로 해석하지 않는다.
- `industry`를 `company_profiles`에서 찾지 않는다.
- `news_ai_analysis` 테이블이 존재한다고 해서 실제 AI scoring 데이터가 쌓여 있다고 가정하지 않는다.
- `news_items`의 일부 legacy change 컬럼만 보고 `Model_1`/`Model_2` 반응률을 판단하지 않는다.
- Investing 기사에서 `title` 또는 `body` summary만 보고 full text가 있는지 확인하지 않은 채 본문 의미를 단정하지 않는다.
- `storage/`나 `tmp/` 아래 export를 source DB보다 더 최신이라고 가정하지 않는다.

### 모델 분류

각 모델의 상세 규칙은 아래 별도 파일에 정의되어 있다. 공통 규칙(이 파일의 위 섹션들)은 모든 모델에 동일하게 적용된다.

- 🟦 **Model_1** (유사사례 비교 모델): [ai-news-research_model1.md](ai-news-research_model1.md)
- `Model_1` 간접 영향 전파 점검: `model_1_2_investing` (DB 기반 분석 후 Investing 웹 기사로 외부 이슈 -> 공개 ticker 바스켓 -> watchlist/readthrough 후보를 점검)
- 🟧 **Model_2** (기간 전체 case 분류 메타 모델): [ai-news-research_model2.md](ai-news-research_model2.md)
- 🟥 **Model_3** (단일 뉴스 Score/Evidence/Keywords 생성): [ai-news-research_model3.md](ai-news-research_model3.md)
