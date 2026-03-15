# AI News Research

### 언제 쓰나
- 채팅에서 `ai research`, `AI research`, `ai news research`처럼 AI 리서치 관련 작업을 말했고, 뉴스/종목 영향 해석이나 사례 분류가 포함될 때.
- 뉴스 본문 또는 headline/summary를 읽고, 해당 뉴스가 개별 종목 주가에 미칠 가능성 있는 영향을 사람이 읽을 수 있는 형태로 정리해야 할 때.
- `Score`, `Score Evidence`, `Keywords` 같은 AI 후처리 컬럼의 생성 규칙을 고정해야 할 때.
- UI/DB/API에서 AI 뉴스 분석 결과를 같은 의미로 다뤄야 할 때.

### 목적
이 지침은 AI 뉴스 리서치/분석 작업을 아래 3개 모델로 나눠서 정의한다.

1. `🟦 Model_1_new news analysis`
2. `🟧 Model_2_case analysis`
3. `🟥 Model_3_single-news scoring analysis`

기존에 문서에 있던 단일 뉴스 `Score / Score Evidence / Keywords` 생성 방식은 이제 `Model_3`로 분류한다.

### plan / log 문서 작성 예외

- 이 스킬이 적용되는 작업은 기본적으로 `ai_agent_plan/.../plan.md`, `agent_log.md` 작성 대상이 아니다.
- 즉, AI 뉴스 리서치/분석 자체를 수행할 때는 채팅에 세부 계획을 설명하더라도 별도의 `plan.md`, `agent_log.md` 파일을 만들거나 갱신할 필요가 없다.
- 예외는 사용자가 `plan.md`, `agent_log.md`, 작업 로그, 단계별 기록 파일 작성을 **명시적으로 요청한 경우**뿐이다.
- 이 예외는 AI 뉴스 리서치 결과 정리, 사례 분류, 근거 표 작성, 모델별 판단 규칙 정리 작업에 동일하게 적용한다.
- 이 예외는 `.github/copilot-instructions.md`의 일반적인 계획/단계별 log 규정보다 우선한다. 즉 AI 뉴스 리서치 작업에서는 채팅 안의 세부화된 계획과 검증 보고는 유지하되, 그것만으로 `plan.md`, `agent_log.md` 파일 작성 의무가 자동으로 생기지 않는다.
- 사용자가 page 본문, research note, evidence table, DB의 `research_pages.body` 같은 **분석 산출물 자체**를 갱신하라고 지시한 경우에도, 그 산출물 갱신은 연구 결과 저장으로 보며 `agent_log.md` 작성 트리거로 해석하지 않는다.
- 반대로 사용자가 명시적으로 `plan.md` 작성, `agent_log.md` 기록, 단계별 작업 로그 보관, 사용자 확인 상태 추적을 요구하면 그 시점부터는 예외를 해제하고 일반 planning 규칙을 적용한다.

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
- `storage/`나 `tmp/` 아래 export를 source DB보다 더 최신이라고 가정하지 않는다.

### 모델 분류

#### `🟦 Model_1_new news analysis`

목적:

- 현재 분석 중인 뉴스 1건이 주가에 어떤 영향을 줄 가능성이 있는지, 과거의 유사 뉴스와 비교해 판단한다.
- 같은 ticker의 과거 유사 이슈뿐 아니라, 다른 ticker에서 발생했던 유사 뉴스/이슈도 함께 참조한다.

작업 절차 (3단계 구조):

`Model_1`은 아래 3단계를 순서대로 수행한다. 각 단계의 역할이 다르므로 단계를 건너뛰거나 합치지 않는다.

**Model_1 데이터 사용 가드레일 (필수)**

- `Model_1`에서는 **현재 분석 대상 기간에 속한 뉴스의 후행 change 데이터**를 보고 중요도를 정하면 안 된다.
- 즉 `2026-03-11 ~ 2026-03-12` 뉴스를 분석하는 중이라면, 그 기간 기사들의 `[][][]change_pct[][][]`, `[][][]change_from_open_pct[][][]`, `[][][]change_open_to_high_pct[][][]`, `[][][]change_1d_pct[][][]`, `[][][]change_3d_pct[][][]`, `[][][]change_7d_pct[][][]`, `[][][]change_14d_pct[][][]`, `[][][]change_30d_pct[][][]`는 **현재 기사 평가 근거로 사용 금지**다.
- `change` 계열 데이터는 오직 **현재 뉴스보다 과거에 발생한 유사사례**에 대해서만 사용할 수 있다.
- 다시 말해 `Model_1`에서 허용되는 가격 데이터는 항상 `현재 분석 중인 뉴스의 published_at 이전`에 나온 기사들의 historical reaction뿐이다.
- 따라서 현재 기사의 importance는 먼저 `headline / body / full_text / 기업 컨텍스트`로 1차 판단하고, 그 다음 `과거 유사사례의 change 분포`로만 보강한다.
- 이 원칙은 `change_from_open_pct`에도 동일하게 적용된다. intraday 반응 구조 해석은 과거 유사사례에 대해서만 가능하며, 현재 기사에 대해서는 같은 날 intraday move를 보고 importance를 올리거나 내리면 안 된다.

**Model_1 시가총액 범위 가드레일 (필수)**

- `Model_1`의 기본 분석 대상은 **시가총액 `100B` 미만 ticker**로 제한한다.
- 시가총액이 `100B` 이상인 ticker는 기본적으로 `최종 중요 뉴스 리스트`의 직접 분석 대상에서 제외한다.
- 이유는 `100B` 이상 대형주는 개별 기사 1건이 종목 전체 재평가로 이어지는 빈도와 크기가 중소형주와 구조적으로 다르기 때문이다.
- 단, `100B` 이상 ticker 뉴스가 **유사 경제 사건의 reference case**로 쓰이는 것은 허용한다. 예를 들어 대형 바이오의 FDA approval, 대형 플랫폼의 partnership, mega-cap의 capital return 뉴스는 분포 비교용 참고 사례로 사용할 수 있다.
- 따라서 `100B` 이상 ticker는 `other-ticker 유사사례`, 사건 강도 비교, 대형주 반응 상한선 점검에는 포함될 수 있지만, 특별한 사용자 지시가 없는 한 현재 기간 `핵심 분석 대상 ticker`로 승격하지 않는다.
- 사용자가 명시적으로 `100B 이상도 분석 대상에 포함`하라고 지시한 경우에만 이 제한을 해제한다.
- `Model_1` 최종 서술에서는 **현재 분석 대상 ticker의 시가총액을 숫자로 직접 명시**해야 한다. 가능하면 `Market Cap 4.64B`처럼 현재 기사 요약 바로 아래에 적고, 이 시총 구간이 왜 같은 사건이라도 반응 크기 해석에 중요한지 한 줄 설명한다.
- 현재 ticker의 `market_cap` 값이 없으면 추정하지 말고 `market_cap 데이터 없음`이라고 적고, 그래서 small-cap / mid-cap / large-cap 맥락 보정에 한계가 있다고 함께 적는다.

**Model_1 수급 구조 보조 가산점 규칙 (필수)**

- `Model_1`에서는 뉴스 사건 자체와 과거 유사사례 분포가 1차 판단 기준이고, **기관보유비중(`institutional ownership %`)이 낮고 유동물량 비중(`float %`)이 높은 구조**는 그 뒤에 붙는 **보조 가산점**으로 사용한다.
- 기본 해석 방향은 아래처럼 둔다.
  - `float %`가 높을수록 실제 거래 가능한 물량이 넓게 풀려 있다고 보고, 테마 자금 유입이나 뉴스 기반 추종 매매가 붙을 때 반응성이 커질 수 있는 쪽으로 해석한다.
  - `institutional ownership %`가 낮을수록 기관 포지셔닝이 덜 차 있는 상태로 보고, 뉴스 이후 신규 기관 유입 여지가 상대적으로 큰 쪽으로 해석한다.
- 실무 기본 밴드는 아래처럼 사용한다.
  - `강한 가산점`: `float % >= 80` 이면서 `institutional ownership % <= 35`
  - `중간 가산점`: `float % >= 60` 이면서 `institutional ownership % <= 50`
  - `약한 가산점`: 위 둘 중 하나만 분명하게 유리한 경우
  - `가산점 없음`: `float % < 40` 이거나 `institutional ownership % >= 80` 이라서 수급상 추가 우위를 주장하기 어려운 경우
- 이 가산점은 어디까지나 **동일하거나 비슷한 뉴스 강도 후보 사이의 우선순위를 조정하는 보조 규칙**이다. 약한 사건이나 부정적 유사사례 분포를 `float/inst`만으로 억지 상향하면 안 된다.
- `Model_1` 최종 서술에서는 해당 ticker의 `float %`와 `institutional ownership %`를 **숫자로 명시**해야 한다. 가능하면 `Float 82.7%`, `Institutional Ownership 24.1%`처럼 본문 또는 표에 바로 적고, 이 수치가 왜 가산점 또는 비가산점으로 이어졌는지 짧게 설명한다.
- `float %` 또는 `institutional ownership %`가 없으면 값을 추정하지 말고 `데이터 없음`으로 적은 뒤, 그 때문에 수급 보조 가산점을 판단하지 못했다고 명시한다.
- 이 두 수치는 현재 `app.db`의 canonical 뉴스 테이블에 항상 들어 있다고 가정하지 않는다. 별도 검증된 보조 source를 사용했다면, 최종 note에 그 source를 함께 적는다.

**1단계: 넓은 스크리닝 (후보 선별)**

- 목적: 잠재적으로 중요한 뉴스를 **놓치지 않고** 넓게 픽한다.
- 허들: **낮음**. 약간이라도 주가에 의미 있을 가능성이 있으면 일단 통과시킨다.
- 이 단계에서는 과거 유사사례를 깊이 조사하지 않는다. headline/lead/본문의 언어적 성격만 보고 빠르게 판단한다.
- 이 단계에서도 **사고과정을 숨기지 않는다.** 왜 통과시켰는지, 왜 제외했는지, 어떤 경제 사건으로 읽었는지를 짧게라도 드러낸다.
- 판단 기준:
  - 사건의 경제적 성격이 명확한가 (계약, 승인, 실적, 오퍼링, 소송 등)
  - 가격 영향 경로가 최소한 하나라도 보이는가
  - 단순 홍보성, 정보량이 낮은 형식적 공지, 법무법인 소송 알림 같은 잡음은 제외
  - 기본 분석 대상 ticker가 `100B` 미만인가 (`100B` 이상이면 기본적으로 reference 후보로만 남긴다)
- 산출물: **후보 리스트** (예: 뉴스 30~50건, 또는 전체 뉴스 대비 상위 10~30% 수준)
- 핵심 원칙: 이 단계에서 엄격하게 자르면, 2단계에서 유사사례를 조사해볼 기회 자체가 사라진다. 따라서 **false negative를 줄이는 것**이 1단계의 최우선 목표다.

**1단계 사고과정 기록 규칙 (필수)**

- 각 후보/제외 기사마다 가능하면 아래 3가지를 남긴다.
  1. `핵심 사건 인식`: 이 기사를 무엇으로 읽었는가 (예: 후기 임상 positive, 희석성 notes offering, 단순 홍보성 launch)
  2. `1차 통과/제외 이유`: 왜 일단 후보로 올렸는지, 또는 왜 여기서 잘랐는지
  3. `불확실성 메모`: 어떤 점이 애매해서 2단계 확인이 필요한지
- 즉, 1단계 결과는 단순한 ticker 목록이 아니라 **초기 가설 목록**이어야 한다.

**2단계: 유사사례 조사 (증거 수집)**

- 목적: 1단계에서 선별된 각 후보에 대해 과거 유사사례를 수집한다.
- 이 단계는 **판단이 아니라 증거 수집**이다. 결론을 내리지 않고 데이터만 모은다.
- 판단과 증거 수집을 분리해야 확증 편향(1단계에서 "별로"라고 생각한 건 사례도 대충 보는 문제)을 줄일 수 있다.
- 이 단계의 핵심은 **대표 사례 몇 개를 예쁘게 고르는 것**이 아니라, 3단계에서 실제로 재판단할 수 있을 만큼 **분포를 볼 수 있는 증거 집합**을 확보하는 것이다.
- 수행 내용:
  1. 현재 뉴스에서 핵심 키워드를 선별한다.
  2. 그 키워드로 과거 뉴스 검색 범위를 좁힌다.
  3. 해당 ticker의 유사 뉴스가 있었는지 확인한다 (same-ticker).
  4. 다른 ticker에서도 비슷한 뉴스/이슈가 있었는지 확인한다 (other-ticker).
  5. 필요하면 `industry`가 비슷한 종목으로 범위를 넓혀 유사 사례를 추가로 찾는다.
  6. 각 유사사례에 대해 **change 데이터 전체**(8개 metric)를 수집한다.
- 추가 수행 규칙:
  7. **확증 사례와 반례를 함께 수집한다.** 현재 뉴스를 bullish/bearish로 보고 싶더라도, 그 방향과 반대였던 유사사례를 의도적으로 같이 모은다.
  8. **시가총액 구간을 같이 기록한다.** other-ticker 사례를 쓸 때는 small-cap 사례만 잔뜩 모아 놓고 large-cap 현재 뉴스에 그대로 대입하지 않는다.
  9. **선반영 가능성을 같이 점검한다.** 가능하면 현재 ticker의 뉴스 직전 `1d / 3d / 5d / 20d` 가격 흐름을 확인해, 이미 유사 재료로 먼저 오른 상태인지 본다.
  10. **사례 수가 부족하면 더 조사한다.** same-ticker 또는 other-ticker가 1~2건만 잡혔다고 바로 3단계로 넘기지 말고, 키워드/peer/industry 축을 바꿔 추가 탐색한다.
  11. 현재 분석 대상 기간의 기사에는 `change` 계열 데이터를 붙여서 판단하지 않는다. 현재 기사에 대한 price move를 보고 importance를 정하는 대신, 반드시 `현재 기사 이전`에 나온 유사사례의 반응만 수집한다.
- other-ticker 사례를 모을 때는 각 비교 ticker의 `market_cap`을 같이 적고, **현재 ticker와 비교 ticker의 시총 차이**가 반응 크기 해석에 어떤 왜곡을 만들 수 있는지 함께 메모한다.
- 산출물: 후보별 **유사사례 데이터 테이블** (same-ticker + other-ticker, 각 사례의 change 벡터 포함)
- 검색 효율을 위해 모든 뉴스를 읽지 말고, 키워드 검색으로 좁혀진 뉴스만 우선 읽는다.
- same-ticker와 other-ticker는 **둘 다 별도 소제목 또는 별도 문단으로 반드시 설명**한다. 한쪽 사례가 실제로 없으면 그 사실을 숨기지 말고 `same-ticker 0건` 또는 `other-ticker 0건`이라고 적은 뒤, 어떤 키워드/peer/industry 축으로 찾았는지와 왜 못 찾았는지를 함께 남긴다.

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
- 위 항목 중 하나라도 빠지면, 2단계가 아직 끝난 것이 아니다.
- 최종 note에는 대표 사례만 일부 적을 수 있지만, **내부 판단 자체는 대표 사례 몇 개가 아니라 조사된 전체 분포**를 기준으로 해야 한다.

**3단계: 최종 중요도 재분류 (증거 기반 재판단)**

- 목적: 1단계 판단 + 2단계 증거를 종합해서 **최종 등급**을 확정한다.
- 허들: **높음**. 증거 기반으로만 판단한다.
- 이 단계에서는 **대표 사례 중심 수동 인상비평**으로 끝내면 안 된다. 최소한 `same-ticker 분포`, `other-ticker 분포`, `시총 맥락`, `선반영 여부`를 함께 보고 재판단해야 한다.
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
- 기술적/수급 데이터가 없어서 선반영 판단을 충분히 못 하는 경우에도, 그 한계를 note에 명시하고 confidence를 한 단계 낮춘다.

기업 컨텍스트 참조 원칙 (전 단계 공통):

- `Model_1`의 **모든 단계**(1단계 스크리닝, 2단계 유사사례 조사, 3단계 재분류)에서 뉴스 headline/본문만 보지 않고, 해당 ticker의 **기업 컨텍스트**를 함께 참조한다.
- 현재 live app DB 기준으로 참조 경로를 아래처럼 구분한다.
  - `[][][]description[][][]`, `[][][]peers[][][]`, `[][][]ipo_date[][][]`, `[][][]market_cap[][][]`는 기본적으로 `company_profiles`에서 온다.
  - 단, `company_profiles`는 ticker당 단일 row가 아니라 `security_id + source` 기준 다중 row 구조이므로, raw DB를 직접 읽을 때는 대표 row 선택 규칙을 먼저 정해야 한다.
  - `[][][]industry[][][]`는 `company_profiles` 컬럼이 아니라 주로 `securities.industry` 또는 `industryLookup.ts`의 CSV cache fallback에서 온다.
  - API 응답을 사용할 때는 `/api/news`가 내려주는 `[][][]companyDescription[][][]`, `[][][]peers[][][]`, `[][][]ipoDate[][][]`, `[][][]marketCap[][][]`, `[][][]industry[][][]`를 우선 source of truth로 본다.
  - `[][][]float %[][][]`, `[][][]institutional ownership %[][][]`는 `Model_1` 수급 보조 가산점용 보조 지표로 취급한다. canonical app DB에 항상 있다고 가정하지 말고, 별도 source를 썼다면 값과 source를 함께 적는다.
- 단계별 활용 방식:
  - **1단계 (스크리닝)**: description을 보고 뉴스가 기업의 핵심 사업과 직접 연결되는지 빠르게 판단한다. 핵심 사업과 직접 연결되는 뉴스는 허들을 더 낮게, 부수적 사업 관련이면 좀 더 보수적으로 판단할 수 있다.
  - **2단계 (유사사례 조사)**: peers 목록과 industry를 활용해 other-ticker 검색 범위를 효율적으로 좁힌다. ipo_date를 확인해 유사사례의 상장 연차가 현재 ticker와 비슷한지도 기록한다. same-ticker와 other-ticker를 각각 따로 정리할 수 있을 정도로 증거를 모은다.
  - **3단계 (재분류)**: 과거 유사사례의 반응을 해석할 때, industry 특성(예: 바이오는 임상 결과에 극단 반응, 유틸리티는 규제 뉴스에 둔감)과 ipo_date 기반 성숙도 차이를 보정 요인으로 반영한다. 이때 `float %`, `institutional ownership %`를 보조 가산점 항목으로 함께 적되, 사건 자체나 유사사례 분포를 덮어쓰는 주근거로 사용하지 않는다.
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
- 또한 `Model_1` 최종 주요 이슈 리스트는 기본적으로 **시가총액 `100B` 미만 ticker만 직접 분석 대상**으로 삼는다. `100B` 이상 ticker는 필요하면 reference case 또는 보류 메모로만 적는다.
- 최종 답변이나 research note에서 same-ticker 또는 other-ticker 중 한 축이라도 빠져 있으면, 원칙적으로 `Model_1 분석 완료`로 보지 않는다. 한쪽 사례가 0건이면 그 사실과 검색 시도 내역을 적는 방식으로라도 **반드시 섹션을 남긴다.**
- 최종 답변에는 최소한 아래 2개 비교 축을 **동시에** 포함한다.
  1. `same-ticker 유사사례`: 현재 분석 중인 ticker에서 과거 비슷한 이슈가 있었는지, 그때 주가가 어떻게 반응했는지
  2. `other-ticker 유사사례`: 다른 ticker에서 비슷한 이슈가 있었는지, 그때 주가가 어떻게 반응했는지
- 또한 현재 분석 대상 ticker의 `[][][]market_cap[][][]`를 현재 뉴스 요약 섹션에서 반드시 적고, 다른 사례와 비교할 때 기준 cap으로 삼는다.
- 또한 각 ticker마다 `[][][]float %[][][]`와 `[][][]institutional ownership %[][][]`를 함께 적고, 그 조합이 왜 `가산점`, `중립`, `가산점 없음`인지 한 줄 설명을 붙인다.
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

이 모델은 현재 뉴스를 해석할 때 참고하는 **유사사례 비교 모델**이다.

#### `🟧 Model_2_case analysis`

목적:

- 현재 들어오는 개별 뉴스 1건을 즉시 평가하는 것이 아니라, 일정 기간 전체를 훑어보며 주가에 강하게 영향을 준 이슈들을 유형별 case로 분류한다.
- case를 하나하나 수작업으로 나열하는 것이 아니라, 의미 있는 패턴이 보일 정도의 유형으로 묶는다.
- 기본 운영 모드는 `press_release only`로 둔다.
- 필요하면 `news`, `company_news`, `market_news`까지 확장할 수 있지만, source가 섞이면 해석 기준과 근거 표도 분리해서 남긴다.

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
- 따라서 “주가가 크게 움직였으니 새로운 유형” 또는 “주가가 안 움직였으니 유형에서 제외”처럼 분류하지 않는다.
- 같은 `case_type` 안에는 가격에 큰 영향을 준 뉴스와 거의 영향을 주지 않은 뉴스가 함께 들어갈 수 있다. 영향 차이는 `reaction_tag`, bucket별 impact 비율, 대표 사례/반례에서 따로 설명한다.
- 유형 분류의 1차 질문은 “무슨 사건이 발생했는가?”이고, 영향 평가는 그 다음 질문인 “그 사건 유형이 실제로 가격에 영향을 주는가?”다.
- 유형 분류의 실제 순서는 아래처럼 본다.
  - 1차 질문: 이 뉴스는 언어적으로 `long`, `short`, `residual` 중 어디에 가까운가?
  - 2차 질문: 그 안에서 사건 성격은 어떤 `case_type`인가?
  - 3차 질문: 그 유형이 실제로 가격에 얼마나 자주 영향을 미쳤는가?

유형 설명 구체화 원칙:

- `Model_2`에서 각 `case_type`은 **이름만 적고 끝내면 안 된다.** 다음에 새 뉴스가 들어왔을 때 사람이 빠르게 재사용할 수 있도록, 유형마다 운영적 정의를 남겨야 한다.
- 좋은 유형 설명은 “이 유형은 대충 이런 느낌”이 아니라, **어떤 문장/표현/사건이면 넣고 어떤 경우는 빼는지**가 바로 보이는 설명이다.
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
- 예를 들어 “긍정적 뉴스”처럼 쓰지 말고, “수주 체결`, `multi-year agreement`, `FDA approval`, `priced public offering`, `subpoena`, `guidance raised`처럼 분류에 직접 쓰이는 표현을 남긴다.
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
- 단, `meaningless_others`는 편의상 다 버리는 휴지통이 아니라, “명확한 독립 유형으로 분리할 정도의 반복성과 가격 설명력이 아직 확인되지 않은 잔여 집합”이라는 의미로 사용한다.
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
  - `[][][]body[][][]`
  - `[][][]full_text[][][]` (`news_fulltext.full_text`가 있으면 사용)
  - `[][][]tickers_csv[][][]`
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

- `Model_2`에서 “이 뉴스가 가격에 영향을 미쳤는가” 판단은 기본적으로 **change 계열 데이터**를 기준으로 한다.
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
- 즉, `Model_2`는 “당일 크게 움직였는가”만이 아니라 “며칠 뒤 또는 몇 주 동안 실질적으로 반응이 이어졌는가”까지 포함해서 case를 평가한다.

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
  - 따라서 `overall_impact_score >= p80`이면 그 bucket 기준으로는 “상대적으로 큰 반응”에 속한다고 본다.
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
- 따라서 어떤 유형은 분명 언어적으로 존재하지만, 영향 비율이 낮아서 “가격 영향은 약한 유형”으로 남을 수 있다.
- 다시 말해 `Model_2`는 “영향 큰 유형만 남기는 모델”이 아니라, **언어적으로 식별 가능한 유형을 먼저 만들고 그 뒤 영향 강도를 서열화하는 모델**이다.

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

유형 설계와 잔여 유형 운영 규칙:

- 같은 분석 note 안에서는 case taxonomy의 총 개수를 `10 ~ 50` 범위에서 유지하는 것을 기본값으로 둔다.
- 처음에는 약간 넓게 묶고, 반복 뉴스 수와 대표 사례가 충분히 쌓일 때만 독립 유형으로 분리한다.
- 반대로 유형 하나가 지나치게 넓어서 내부 뉴스 의미가 너무 다르면, 하위 패턴을 다시 점검해 둘 이상으로 분리한다.
- `long / short` 상위 분류가 애매한 경우에도 먼저 등락률을 보지 말고, 기사 문장 자체가 말하는 가치 경로를 기준으로 판정한다.
- 방향이 혼재되거나 정보성 공지에 가까워 언어 기반 판정이 어려우면 `residual`로 보낸다.
- `meaningless_others` 비중이 지나치게 커지면 그 안을 재검토해, 새 독립 유형 후보가 있는지 확인한다.
- note에는 가능하면 `meaningless_others`의 비중도 함께 남겨, taxonomy가 너무 거칠게 설계됐는지 점검할 수 있게 한다.
- 각 유형 설명을 쓸 때는 “다음 뉴스가 들어왔을 때 분류자가 10~30초 안에 판단할 수 있는가?”를 기준으로 다시 본다.
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
  - 이 파일이 “유형 분류 근거가 된 전체 뉴스 표”라는 설명
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
  - `[][][]change_pct[][][]`
  - `[][][]change_from_open_pct[][][]`
  - `[][][]change_open_to_high_pct[][][]`
  - `[][][]change_1d_pct[][][]`
  - `[][][]change_3d_pct[][][]`
  - `[][][]change_7d_pct[][][]`
  - `[][][]change_14d_pct[][][]`
  - `[][][]change_30d_pct[][][]`
  - `[][][]immediate_reaction_score[][][]`
  - `[][][]short_followthrough_score[][][]`
  - `[][][]medium_persistence_score[][][]`
  - `[][][]overall_impact_score[][][]`
- 이 표 파일은 “왜 이 case 유형을 만들었는가”를 사람이 역추적할 수 있게 하는 근거 registry다.
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

- 이 섹션은 각 `case_type`이 “무엇을 뜻하는지”를 빠르게 재사용할 수 있게 만드는 요약 섹션이다.
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
- 각 로그 항목은 가능하면 아래 형식을 따른다.
  - `판단 대상`
  - `검토한 데이터/패턴`
  - `최종 결정`
  - `결정 이유`
  - `대표 근거 뉴스 id / ticker / title`
- 목표는 “나중에 note만 읽어도 왜 이런 taxonomy와 threshold가 나왔는지 추적 가능한 상태”이지, 비정형 내부 독백 전체 저장이 아니다.

로그에 반드시 남길 항목:

- 기간: `[][][]since[][][] ~ [][][]until[][][]`
- source 범위: 기본적으로 `[][][]press_release only[][][]`, 확장한 경우 다른 source를 명시
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
- 근거 뉴스 표 파일 경로
- 근거 표 파일명과 note 제목의 매칭 관계
- `내부 사고과정 로그(주요 판단 요약)` 섹션에서 실제 분류 기준을 바꾼 핵심 판단들

이 모델은 개별 기사 판정용이 아니라, **기간 전체에서 반복되는 가격영향 패턴을 분류하는 메타 모델**이다.

#### `🟥 Model_3_single-news scoring analysis`

목적:

- 뉴스 한 건을 분석해서 아래 3개 결과를 만든다.

1. `Score`
2. `Score Evidence`
3. `Keywords`

이 3개는 **AI 뉴스 분석 결과**이며, provider가 주는 raw sentiment와는 다른 계층이다.
문서의 나머지 `출력 계약`, `기본값 규칙`, `금지 규칙`, `테스트 / 품질 보증`은 기본적으로 `Model_3`에 직접 적용한다.

### 🟥 Model_3 출력 계약

#### `[][][]Score[][][]`
- 범위: `-10` ~ `10`
- 의미:
  - `10`에 가까울수록 해당 뉴스가 **주가 상승에 매우 강한 영향**을 줄 가능성이 높다고 판단
  - `-10`에 가까울수록 해당 뉴스가 **주가 하락에 매우 강한 영향**을 줄 가능성이 높다고 판단
  - `0` 부근이면 방향성이 약하거나, 상쇄 요인이 많거나, 가격 영향 확신이 낮다고 판단
- 기본 원칙:
  - 점수는 **뉴스 내용 자체가 시사하는 가격 영향**을 기준으로 매긴다.
  - 단순 감정 문장보다 **실제 가격 반응 가능성**을 본다.
  - 수치는 소수 허용 가능하나, UI 요구가 없으면 정수 또는 소수점 첫째 자리까지만 사용한다.

운영적 해석 예시:
- `+8` ~ `+10`: 대형 수주, 규제 승인, 실적/가이던스의 강한 상향, 대규모 자사주 매입, 핵심 리스크 해소
- `+4` ~ `+7`: 긍정적 계약, 시장 확대, 기대 상회지만 파급력이 아주 압도적이지는 않은 경우
- `-3` ~ `+3`: 영향이 제한적이거나 혼재된 경우, 정보성 업데이트, 가격 영향 방향이 약한 경우
- `-4` ~ `-7`: 실적 miss, 수요 둔화, 규제 조사, 자금조달 부담, 가이던스 하향
- `-8` ~ `-10`: 회계 문제, 상장폐지 리스크, 중대한 소송 패소, 핵심 제품 실패, 대규모 리콜/사기/파산 수준 악재

#### `[][][]Score Evidence[][][]`
- 의미: 왜 그 점수를 줬는지 설명하는 근거 텍스트
- 필수 규칙:
  - 뉴스의 핵심 팩트를 요약해야 한다.
  - 그 팩트가 왜 주가에 상승/하락 압력으로 연결되는지 설명해야 한다.
  - 가능하면 **수요, 매출, 비용, 규제, 공급망, 제품, 소송, 재무건전성** 중 어떤 경로로 영향을 주는지 명시한다.
  - 너무 짧은 한 단어 답변 금지
  - 기사 원문을 길게 복붙하지 말고, **근거 요약**으로 작성한다.

권장 형식:
- 2~5문장
- 300자 내외 권장
- 아래 2요소를 모두 포함
  - 무엇이 발생했는가
  - 왜 주가 영향으로 이어지는가

#### `[][][]Keywords[][][]`
- 의미: 뉴스를 읽고 중요하다고 판단한 키워드 목록
- 개수: **정확히 30개를 목표**로 정리
- 성격:
  - 핵심 기업명, 제품명, 규제기관, 산업 키워드, 재무/실적 키워드, 이벤트 키워드 등을 포함할 수 있다.
  - 의미 없는 stopword, 조사, 일반 접속사는 제외한다.
  - 같은 의미의 중복 키워드는 피한다.
- 저장 형태:
  - 내부 저장은 배열(JSON) 권장
  - UI에는 chip/list 형태로 표시 가능

키워드 선정 기준:
- 기사에서 가격 영향 판단에 직접 연결되는 단어 우선
- 회사/산업/이벤트/리스크/기회 신호를 우선
- 단순 빈도보다 중요도를 우선

### Model_3 기본값 규칙
- `Score`, `Score Evidence`, `Keywords`는 **기본적으로 비워 둔다.**
- 뉴스 pull 직후 자동으로 임의 값이나 placeholder를 넣지 않는다.
- AI 분석이 아직 돌지 않은 row는 아래처럼 취급한다.
  - `Score = null`
  - `Score Evidence = null` 또는 빈 문자열
  - `Keywords = []` 또는 비어 있는 상태
- UI에서 비분석 상태를 보여줄 때는 `-`, `Empty`, `Not analyzed` 같은 표시를 쓰되, DB에는 fake 값을 넣지 않는다.

### Model_3 분석 원칙
- 뉴스의 **주가 영향 가능성**을 평가한다. 뉴스의 문체나 감정 표현만 평가하지 않는다.
- 시장 전체 macro 뉴스라면, 해당 종목에 직접 연결되는 경로가 약한 경우 보수적으로 점수화한다.
- 오래된 반복 기사, 사소한 IR 공지, 정보량이 매우 낮은 기사라면 점수를 과장하지 않는다.
- headline만으로 확정적 판단이 어려우면 body/full text를 함께 본다.
- 근거가 약하면 `0` 근처로 둔다. 확신이 낮은데 큰 절대값을 주지 않는다.

기업 컨텍스트 참조 원칙:

- `Model_3`에서도 단일 뉴스 headline/body만으로 점수를 매기지 않고, 아래 기업 컨텍스트를 **필수로** 함께 본다.
  - `[][][]description[][][]`
  - `[][][]peers[][][]`
  - `[][][]ipo_date[][][]`
  - `[][][]industry[][][]`
- 현재 DB 기준으로는 `description`, `peers`, `ipo_date`, `market_cap`은 `company_profiles`, `industry`는 `securities.industry` 또는 CSV fallback에서 온다.
- 따라서 raw DB를 직접 조회해 `Model_3`용 컨텍스트를 만들 때는 `company_profiles` 단독 조회가 아니라 `securities` JOIN 또는 `/api/news` enrich 결과를 우선 사용한다.
- 활용 규칙:
  - `description`은 현재 뉴스 사건이 회사의 핵심 사업과 직접 연결되는지 확인하는 데 사용한다. 핵심 사업과 직접 연결되면 점수 근거를 더 강하게 둘 수 있고, 주변 사업이면 과대평가를 피한다.
  - `peers`는 같은 유형 뉴스가 유사 기업군에서 어떤 반응을 보였는지 빠르게 참조하는 보조 근거로 사용한다.
  - `ipo_date`는 최근 IPO 종목 특유의 과민 반응 가능성, 오래된 상장사의 상대적 둔감함을 해석 보정하는 데 사용한다.
  - `industry`는 같은 뉴스라도 산업별로 가격 영향 경로가 다를 수 있으므로, 점수와 `Score Evidence` 서술을 보정하는 데 사용한다.
- 따라서 `Score Evidence`에는 가능하면 뉴스 사실만이 아니라, 이 뉴스가 왜 **이 회사/이 산업/이 상장 연차 구조**에서 더 중요하거나 덜 중요한지까지 반영한다.
- 데이터가 없거나 비어 있으면 해당 항목은 건너뛰되, 점수 확신도를 보수적으로 둔다.

추가 원칙:

- `Model_1`에서 찾은 유사 사례는 `Model_3` 점수 판단의 참고 근거로 사용할 수 있다.
- 다만 과거 유사 사례의 존재만으로 점수를 기계적으로 크게 주지 않는다.
- `Model_2`의 case 유형 분류가 충분히 축적되면, `Model_3`에서 어떤 유형에 속하는지 참고해 점수 일관성을 높일 수 있다.

### Model_3 금지 규칙
- 근거 없이 극단 점수 남발 금지
- 기사와 무관한 외부 추정 서사 추가 금지
- 근거 문구를 뉴스 원문에서 무단 장문 복사 금지
- `Keywords`에 stopword, 조사, 숫자 잡음, 중복 토큰 채우기 금지
- 분석 실패를 `0점`으로 대체 금지

### Model_3 테스트 / 품질 보증
이 분석 결과는 자주 지워질 수 있으므로, 저장/복원/재조회 테스트를 기본으로 둔다.

필수 테스트 축:
1. **저장 테스트**
   - AI 분석 후 `Score`, `Score Evidence`, `Keywords`가 DB에 실제 저장되는지 확인
2. **재조회 테스트**
   - `GET /api/news` 또는 상세 조회 응답에 같은 값이 그대로 나오는지 확인
3. **삭제 감지 테스트**
   - `Score Evidence` 또는 `Score`가 빈 값으로 바뀌었을 때 테스트가 실패하도록 확인
4. **빈 기본값 테스트**
   - 분석 전 row는 실제로 비어 있어야 하며, fake 기본값이 없어야 함
5. **Keywords 개수 테스트**
   - 정상 분석 결과가 30개를 목표로 생성되는지 확인
   - 30개 미만/초과일 때 허용 규칙이 있다면 테스트에 명시

권장 테스트 시나리오:
- 케이스 1: 강한 호재 뉴스 → 양수 고점수와 근거 문구 저장
- 케이스 2: 강한 악재 뉴스 → 음수 고절대값 점수와 근거 문구 저장
- 케이스 3: 영향이 약한 정보성 뉴스 → 0 근처 점수
- 케이스 4: AI 분석 미실행 뉴스 → 모든 컬럼 비어 있음
- 케이스 5: 저장 후 임의로 `score_evidence`를 지운 뒤 API 조회 → 테스트 실패

### 저장 원칙
- canonical 저장소는 우선 `terminal/backend/backend/data/app.db`
- `Keywords`는 기존 `news_fulltext` 계열과 인접한 저장 구조를 우선 검토할 수 있다.
- `Score`와 `Score Evidence`는 AI 분석 결과이므로, provider sentiment와 분리된 별도 컬럼/테이블로 관리하는 쪽을 우선 검토한다.
- 2026-03-12 live DB 기준 `news_ai_analysis`는 아직 0 rows다. 즉 이 섹션은 **현재 적재 완료 상태 설명이 아니라 저장 계약/목표 상태**로 읽어야 한다.

모델별 저장 해석:

- `Model_1`: 유사사례 탐색 결과와 비교 근거를 별도 research note 또는 분석 로그로 남길 수 있다.
- `Model_2`: case 유형 정의, 유형별 사례 수, 영향 비율, market cap 구간별 메모를 별도 문서/테이블로 관리하는 편이 적합하다.
- `Model_3`: 현재 문서의 `Score`, `Score Evidence`, `Keywords` 저장 계약을 그대로 따른다.

### 문서화 규칙
- 문서/plan/API prompt에서 `Score`를 설명할 때는 반드시 `-10 ~ 10` 범위를 명시한다.
- `Score Evidence`는 “왜 이 점수인지”를 설명하는 컬럼이라는 점을 반복해서 명시한다.
- `Keywords`는 “중요 키워드 30개”라는 목표를 명확히 적는다.