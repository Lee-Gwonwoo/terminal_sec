### 모델 분류

#### `🟪 Model_100_issue tier analysis`

목적:

- 특정 이슈(테마/촉매)를 중심으로 **동일 밸류체인 또는 동일 테마에 묶인 종목 바스켓**이 어떻게 형성·확산·분화되었는지를 시간순으로 분석한다.
- 개별 뉴스 1건이 아니라 **이슈 1개가 만들어낸 종목 바스켓 전체의 라이프사이클**을 대상으로 한다.

### 언제 쓰나

- 사용자가 `issue analysis`, `이슈 분석`, `tier 분석`, `바스켓 분석`, `순환매 분석`, `이슈 타임라인` 같은 표현을 쓸 때.
- 한 테마에 묶인 종목들의 첫 급등 → 확산 → 분화 → 소멸/지속 패턴을 정리할 때.
- AI research window 의 research page에 이슈 기반 분석 결과를 작성할 때.
- `Model_1`이 단일 뉴스 → 단일 종목 영향 분석이라면, `Model_100`은 **단일 이슈 → 종목 바스켓 영향 분석**이다.
- 사용자가 `관련주 확장`, `후보 더 넓혀`, `광통신 관련주 더 확장`, `빠진 관련주 있는지 더 보자`처럼 **기본 관련주 표 바깥의 후보 발굴까지 명시적으로 요구**할 때는, 아래 `관련주 확장` 추가 작업을 함께 적용한다.

### Model_100 과 다른 모델의 관계

- `Model_100`은 `Model_1`의 확장이 아니라 **별도 분석 프레임**이다.
- `Model_1`은 뉴스 1건 → 종목 영향을 분석하고, `Model_2`는 기간 내 뉴스를 case_type으로 분류한다.
- `Model_100`은 이슈 1개 → 관련 종목 바스켓 전체의 형성·확산·소멸을 시간축으로 분석한다.
- 단, `Model_1`의 same-ticker / other-ticker 조사, `Model_2`의 case_type 분류, DB 조회 방법은 `Model_100` 내에서도 도구로 활용할 수 있다.

### Model_100 추가 작업: `관련주 확장`

- `관련주 확장`은 **기본 Model_100의 필수 절차가 아니라**, 사용자가 명시적으로 요청했을 때만 수행하는 선택적 추가 작업이다.
- 기본 Model_100 요청에서는 기존 방식대로 `관련주 정리 -> 오너십 데이터 -> 핵심 분석이슈 -> 선행 이슈 -> 확산 타임라인 -> 최종 판정` 순서를 유지한다.
- 사용자가 `관련주 확장`을 붙여 요청하면, 기본 관련주 표를 만든 뒤 **후보군 discovery를 한 번 더 수행**해 빠진 종목이 없는지 점검하고, 새 후보의 `사업 유사도 등급`, `이슈 연결 방식`, `포함/제외 판단`을 별도 표로 남긴다.
- 즉 `관련주 정리`는 **현재 바스켓의 구조화**, `관련주 확장`은 **바스켓 바깥 후보의 추가 발굴과 누락 점검**이다.
- `관련주 확장`은 broad theme 아무 종목이나 늘어놓는 작업이 아니다. 반드시 `핵심 이슈 티커와의 사업 유사성`과 `실제 파동 동기화`를 함께 검증해야 한다.

---

## 이모지 마커 체계 (필수)

출력 문서에서 이벤트/이슈의 성격을 빠르게 구분하기 위해 아래 이모지를 **제목과 본문 모두**에서 일관되게 사용한다.

| 이모지 | 의미 | 사용 위치 |
| --- | --- | --- |
| 🔴 | **분석이슈 (메인 촉매)**: 바스켓 전체를 움직인 핵심 이벤트 | 메인 촉매 섹션 제목, 확산 타임라인 내 메인 이벤트 |
| 🟡 | **같은 티커 관련이슈**: 메인 촉매와 같은 티커에서 발생한 후속/선행 이벤트 | 선행 이슈·타임라인 내 same-ticker 항목 |
| 🔵 | **다른 티커 관련이슈**: 바스켓 내 다른 종목에서 발생한 연쇄/스필오버 이벤트 | 선행 이슈·타임라인 내 cross-ticker 항목 |
| 🟢 | **확산 타임라인 파동**: 바스켓 전체가 동시 반응한 파동 시점 | 확산 타임라인 내 바스켓-wide 파동 |
| ⚪ | **참고/배경**: 직접 주가 반응은 아니지만 맥락에 필요한 정보 | 산업 뉴스, 매크로 이벤트, 어닝 일정 등 |

**사용 규칙:**
- 모든 선행 이슈, 타임라인 항목, 관련이슈 기술 시 해당 이모지를 **줄 첫머리**에 붙인다.
- 하나의 이벤트가 여러 성격을 가질 수 있다 (예: 메인 촉매이면서 같은 티커). 이 경우 **가장 상위 성격의 이모지 1개만** 사용한다. 우선순위: 🔴 > 🟢 > 🔵 > 🟡 > ⚪.
- 확산 타임라인에서 "바스켓 전체 동시 급등"은 🟢, 그 안에서 개별 종목의 자체 촉매가 있으면 해당 종목 설명에 🟡 또는 🔵를 사용한다.

---

## 분석 절차 (5단계)

**작성 순서 고정 규칙 (필수):** 실제 조사 순서는 유연할 수 있어도, `research_pages.body` 작성 순서는 고정한다. 즉 `## 오너십 데이터` 바로 아래에는 반드시 **핵심 분석이슈(메인 촉매 / 메인 파동 anchor)** 를 먼저 배치하고, 그 다음에 선행/관련이슈를 배치한다. 오너십 아래에서 곧바로 선행 이슈부터 길게 전개하는 방식은 최신 Model_100 기준과 맞지 않는다.

### 1단계: 이슈 정의 및 관련주 정리

**목적:** 분석 대상 이슈의 핵심 내용을 확정하고, 그 이슈에 연결된 종목 바스켓을 정의한다.

필수 산출물:

1. **이슈 한줄 정의**: 어떤 이슈인지 1~2문장으로. 예: `AI 데이터센터 fiber-optic / optical component 밸류체인 이슈`.
2. **관련주 분류 테이블**: `사업 유사성 축`과 `이슈 연결 방식 축`을 **분리해서** 사용한다. Model_100에서 사용자가 말하는 `관련주`의 기본 뜻은 **핵심 이슈가 발생한 티커와 가장 유사한 사업을 하는 종목들**이다.

관련주 분류(사업 유사성 기준):

| 분류 | 설명 |
| --- | --- |
| 핵심 동종 peer | 핵심 이슈 티커와 **주요 제품, 주요 고객, 해결하는 전력/인프라 문제, capex budget 경쟁 상대**가 거의 같은 종목 |
| 인접 사업 peer | 정확히 같은 회사는 아니지만, **같은 고객의 같은 문제를 다른 기술/아키텍처로 푸는** 인접 경쟁 종목 |
| 약한 테마/read-through | 넓은 테마나 밸류체인은 겹치지만, 핵심 사업축이 달라 direct peer로 보기 어려운 종목 |

사업 유사도 등급 규칙:

| 등급 | 의미 | 운영적 정의 |
| --- | --- | --- |
| A | 매우 높음 | 핵심 이슈 티커와 **사실상 같은 사업을 비교**할 수 있는 종목. 같은 고객군, 같은 설치 레이어, 같은 예산 항목을 두고 경쟁하거나 대체될 수 있다. |
| B | 높음 | 완전한 동종은 아니지만, **같은 고객 문제를 직접 경쟁 기술로 해결**하는 인접 peer다. 같은 뉴스에서 read-through가 붙어도 이상하지 않다. |
| C | 보통 | 산업/테마는 겹치지만 핵심 사업축이 달라 **조건부 read-through** 정도로 보는 것이 맞다. |
| D | 낮음/참고 | sentiment gauge 또는 약한 테마 peer 수준이다. 같은 broad theme에 묶일 수는 있어도 `핵심 이슈 티커와 유사한 사업`으로 보긴 어렵다. |

이슈 연결 방식 태그:

| 태그 | 설명 |
| --- | --- |
| direct beneficiary | 이번 이벤트의 직접 수혜 당사자 |
| read-through | 같은 사업/인접 사업이라 sympathy가 번질 수 있는 종목 |
| validator / counterparty | 고객, utility, hyperscaler, 공급자, 계약 상대방처럼 **상업성 검증에는 중요하지만 같은 사업을 하지는 않는** 종목 |
| background | 매크로/정책/인프라 배경 설명용 |

- 각 관련주에 대해 `티커`, `관련주 분류`, `사업 유사도 등급`, `이슈 연결 방식`, `설명(왜 이 분류/등급인지)` 5개를 반드시 적는다.
- `관련주 분류`와 `사업 유사도 등급`은 **핵심 이슈 티커와의 사업 유사성**을 기준으로 판단한다. 계약 상대방인지, headline에 직접 등장했는지는 별도 축인 `이슈 연결 방식`에서 처리한다.
- `validator / counterparty`는 중요해도 **관련주 고등급의 근거가 아니다.** 예를 들어 `Oracle`, `AEP`처럼 이번 계약/검증에는 핵심이어도, 핵심 이슈 티커와 같은 사업을 하지 않으면 관련주 표에서 `A`나 `B`를 주지 않는다.
- `관련주`와 `검증자`를 섞지 않는다. 사용자가 `관련주`를 물으면 먼저 **동종/인접 사업 peer**를 정리하고, customer/utility/hyperscaler는 별도 `검증자 / counterparty` 표로 뺀다.
- `3개 이상 종목 동시 +5%` 같은 basket 확인 규칙도 **관련주 표에 들어간 same-business / adjacent-business basket** 기준으로만 계산한다. validator / counterparty는 이 분모에 넣지 않는다.
- 기본 예시:
   - `핵심 동종 peer + A + read-through`: BE 이슈에서 FCEL처럼 같은 데이터센터 onsite power / distributed generation 문제를 푸는 종목
   - `인접 사업 peer + B + read-through`: 같은 고객 예산을 놓고 다른 전력 아키텍처로 경쟁하는 엔진/터빈 계열
   - `약한 테마/read-through + C`: 수소/연료전지 broad theme는 겹치지만 핵심 사업축이 다른 종목
   - `validator / counterparty`: ORCL, AEP처럼 계약 검증에는 중요하지만 같은 사업을 하지는 않는 종목

#### `관련주 확장` 요청 시 추가 절차 (필수)

- 이 절차는 **사용자가 명시적으로 `관련주 확장`을 요청했을 때만** 수행한다. 기본 Model_100 요청에 자동으로 붙이지 않는다.
- `관련주 확장`의 목적은 이미 정한 바스켓을 옹호하는 것이 아니라, **하드코딩된 초기 바스켓 밖에 있던 후보가 빠졌는지 점검**하는 것이다.
- 최소 조사 축은 아래 4개를 모두 포함한다.
   1. `keyword 축`: 핵심 이슈를 설명하는 제품/기술/수요 키워드 묶음 작성
   2. `company description 축`: `company_profiles.description`, `securities.industry/sector` 확인
   3. `peer / graph 축`: `peers_json`, 기존 core ticker peer, 동일 파동일 동반 반응 종목 확인
   4. `price validation 축`: anchor day / front-wide breakout / 후속 파동일의 동기화 반응 확인
- `관련주 확장`에서는 **적어도 1개의 keyword 묶음만 쓰고 끝내면 안 된다.** 가능하면 아래처럼 3개 이상 묶는다.
   - 제품 키워드: `transceiver`, `optical engine`, `laser`, `modulator`, `DSP`, `coherent`
   - 아키텍처 키워드: `silicon photonics`, `CPO`, `1.6T`, `800G`, `InP`, `PIC`
   - 고객/수요 키워드: `AI data center`, `hyperscaler`, `fiber-optic`, `optical interconnect`
- 후보 편입 검토 큐에 넣는 최소 조건은 아래 중 하나 이상이다.
   1. `company_profiles.description`에 핵심 키워드/동의어가 2개 이상 직접 등장
   2. core ticker의 peer/source text에서 반복적으로 연결
   3. 같은 파동일에 비정상 반응이 관찰되고 사업 설명도 theme와 연결
   4. news/headline/fulltext에서 해당 이슈 키워드와 함께 반복 출현
- `관련주 확장` 결과는 반드시 별도 표나 섹션으로 남긴다. 권장 컬럼은 `티커 | 후보 발견 경로 | 관련주 분류 | 사업 유사도 등급 | 이슈 연결 방식 | 파동 반응 요약 | 포함/제외 판단 | 설명` 이다.
- 포함한 종목뿐 아니라 **검토했지만 제외한 대표 후보도 최소 몇 개는 보이게** 남긴다. 그렇지 않으면 누락 점검 흔적이 사라진다.

#### 누락 방지 가드레일 (필수)

- **하드코딩한 초기 basket만으로 `관련주 확장`을 끝내면 미완료**로 본다. 확장 요청이 있었다면 keyword/description/peer 축의 후보 발굴 흔적이 문서나 작업 산출물에 남아야 한다.
- `securities.industry`, `sector`, 외부 스크리너 업종 라벨은 후보 정렬에 참고할 수 있지만, **제외의 단독 근거로 쓰면 안 된다.** 사업 설명과 제품 키워드가 더 우선이다.
- 특히 업종 라벨이 비정상적이어도 `company_profiles.description`에 핵심 기술이 직접 적혀 있으면 자동 제외하지 않는다.
- 광통신 / photonics / silicon photonics 계열에서는 `LWLG` 같은 종목이 대표적인 예외 케이스다. 예를 들어 `Chemicals - Specialty`처럼 보이더라도 description에 `electro-optic polymer`, `modulator`, `polymer photonic integrated circuits`, `silicon photonics`가 있으면 **반드시 확장 후보 검토 표에 올려야 한다.**
- 따라서 photonics/CPO/optical interconnect 이슈에서 `LWLG`를 비롯한 **업종 라벨 불일치 후보**는 `업종 라벨이 어색하다`는 이유만으로 누락하지 말고, `후보 검토 -> 포함 또는 제외 사유 기록` 절차를 거쳐야 한다.
- 최종 관련주 표에 넣지 않더라도, semantic match가 강한 후보를 제외했다면 **왜 제외했는지**를 `관련주 확장` 섹션에 적는다. 강한 semantic match 후보가 문서 어디에도 안 보이면 누락으로 간주한다.

3. **검증자 / counterparty 표**: customer, utility, hyperscaler, 공급자, 핵심 계약 상대방처럼 **이슈의 진위와 사업성을 검증**해 주지만 같은 사업을 하는 것은 아닌 종목이 있으면, 관련주 표와 분리해서 적는다.

- 이 표에는 `티커`, `역할`, `왜 관련주가 아닌가`, `이번 이슈에서 왜 중요한가`를 적는다.
- 이 표의 종목은 page 설명에는 중요할 수 있지만, related-stock ranking이나 basket propagation count에는 넣지 않는다.

4. **오너십 데이터 테이블**: 각 종목의 시총, Float %, Institutional %, Insider % 를 포함한다.

오너십 데이터 조회 규칙:
- 출처: `GET /api/tickers` 또는 app DB의 `company_profiles` 테이블.
- 필수 컬럼: 시총(market_cap), Float %, Institutional %, Insider %.
- `institutional_pct`가 100% 초과할 수 있음 (중복 집계 특성). 이를 그대로 기록하고 `원래의 집계 특성 그대로`라고 주석 표기.
- 오너십 해석을 별도 문단으로 추가: 대형캡 vs 소형캡의 반응 차이, float 크기와 변동성 관계, insider 보유율이 시사하는 것 등.

오너십 데이터 바로 아래에 반드시 이어져야 하는 것:
- **핵심 분석이슈 고정 블록**을 먼저 쓴다. 여기서 `이슈 티어가 만들어진 날`, `event_date`, `published_at`, `change_anchor`, 대표 headline/structured catalyst, 핵심 가격 반응 테이블을 먼저 제시한다.
- 그 다음에야 `이전에 같은 이슈가 있었나`, 같은 티커/다른 티커 관련이슈, 배경 이벤트를 쓴다.
- 즉 독자가 page를 위에서 아래로 읽을 때, "지금 무엇이 핵심 anchor인가"를 먼저 이해한 뒤 관련이슈 비교로 내려가야 한다.

### 2단계: 핵심 분석이슈 고정

**목적:** 오너십 데이터 바로 아래에서 이번 page의 중심 anchor가 되는 분석이슈를 먼저 고정한다. 관련이슈/선행이슈는 이 anchor와의 비교 자료로 배치한다.

핵심 분석이슈 블록에 반드시 포함할 항목:

| 항목 | 설명 |
| --- | --- |
| 메인 축 날짜 | page 상단의 `축 1`, `축 2` 같은 canonical axis 날짜. **기본값은 `change_anchor`** 이며, 장후 PR/공시/earnings면 다음 거래일을 쓴다. `event_date`, `published_at`는 아래 날짜 3줄에서 따로 적는다. |
| 날짜 3줄 | `event_date:`, `published_at:`, `change_anchor:`를 별도 줄로 정확히 쓴다. |
| 대표 headline / structured catalyst | 원문 headline, earnings, SEC filing, PR 등 이번 anchor를 대표하는 핵심 사건 1~2개. |
| 핵심 가격 반응 표 | 최소 `same-day`, `from-open`, `next day`, `7d`, `14d`, `30d`에 대해 **change + HV + z-score 삼중항** 을 정확한 숫자로 적는다. 필요 시 `open_to_high`도 추가한다. |
| 메인 촉매 판정 이유 | 왜 이 이슈가 바스켓을 대표하는 anchor인지, 왜 다른 이벤트보다 우선인지 설명한다. |
| 직접성 / 간접성 | 메인 종목과 peer 종목이 direct benefit인지 read-through인지 구분한다. |

핵심 분석이슈 블록 작성 규칙:
- 이 블록은 `오너십 데이터` 다음에 바로 와야 한다.
- 선행 이슈를 장황하게 쓰기 전에, 독자가 **먼저 분석 대상 anchor를 정확히 이해**할 수 있어야 한다.
- page 전체의 판정(`1 tier`, `fail tier` 등)은 이 블록에서 고정한 anchor를 기준으로 후속 비교가 이루어져야 한다.
- 이 블록의 가격 반응은 **당일 change만이 아니라 change/HV/z-score 전 구간 삼중항** 을 기준으로 쓴다.
- 사용자가 축 날짜를 지정했더라도, 그 날짜에 direct headline / filing / PR이 없고 단순 pre-bid 또는 선행 관찰일에 불과하면 **그 날짜를 canonical `축 1`로 승격하지 않는다.** 이런 경우에는 `선행 axis`, `pre-bid 관찰일`로만 적고, 실제 `축 날짜`는 first hard catalyst의 `change_anchor`로 옮긴다.
- 예를 들어 `2024-11-14` 장후 PR이라면 summary/table의 `축 날짜`는 `2024-11-15`가 기본값이다. 단, 본문 3줄에는 `event_date: 2024-11-14`, `published_at: ...`, `change_anchor: 2024-11-15`를 모두 남긴다.
- validator / counterparty는 `핵심 분석이슈`의 상업성 검증 근거로는 활용하지만, related-stock basket confirmation이나 tier 분모에는 넣지 않는다.

### 3단계: 선행 이슈 조사

**목적:** 메인 촉매 이전에 같은 테마의 선행 신호가 있었는지 조사한다.

조사 범위:
- 메인 촉매 일자 기준 **최소 60일 이전**까지 소급.
- 1단계에서 정의한 관련주 전체 + 동일 산업 peer까지 포함.

조사 대상 DB/소스:
- `news_items` (company_news): headline, published_at, tickers_csv.
- `sec_filings` (fmp_sec): 8-K, 10-Q, 10-K, S-1 등.
- `news_fulltext` (fmp_pr): press release 전문.
- `calendar_events` (earnings): 어닝 발표일, eps_est, eps_actual.
- `ohlc_1d` (OHLC DB): 절대 가격 반응(change, turnover) 확인용.
- `news_change_metrics` 또는 `GET /api/news`, `GET /api/news/:id`: 뉴스 기준 파생 가격 반응, matching HV, z-score 확인용.

각 선행 이슈에 대해 반드시 기록할 항목:

| 항목 | 설명 |
| --- | --- |
| 날짜 | **event_date**(실제 이벤트 발생일)와 **published_at**(기사 게시일)를 구분 표기. 동일하면 한 번만 쓰고, 다르면 반드시 둘 다 표기한다. ISO 형식. 상세 규칙은 아래 「이벤트 날짜 vs 기사 날짜 구분 규칙」 참조. |
| 티커 | 해당 이슈의 주체 종목 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `investing`, `calendar_events` 중 어디서 왔는지 |
| headline/제목 | 원문 headline 또는 filing type |
| 가격 반응 (전체 change + HV + z-score) | 해당 뉴스의 첫 반응 거래일 기준 **모든 주요 change 컬럼**과 **대응 HV, z-score 컬럼**을 함께 기록한다. 장 후(16:00 이후) 발표면 다음 거래일 기준. `change만 있고 HV/z-score가 없는 표`는 미완료다. |
| 다음 거래일 반응 | 첫 반응 거래일 바로 다음 거래일의 동일 **change/HV/z-score 삼중항** 전체 |
| 직전 어닝 / 다음 어닝 | 해당 이벤트 시점 기준 **가장 최근 과거 어닝 날짜** + **가장 가까운 미래 어닝 날짜**를 함께 기록한다. (상세는 아래 "어닝 날짜 연동 규칙" 참고) |
| 해석 | 이 이슈가 바스켓 전체에 미친 영향, 스필오버 여부, 지속성. change는 절대 상승폭, z-score는 HV 대비 얼마나 비정상적으로 강했는지 판단한다. 7d/14d/30d change로 유지 기간을 보고, z-score로 고변동성 종목의 착시를 걸러낸다. Turnover 급등은 기관/대형 자금 유입 가능성을 시사. |

선행 이슈 분류 (이모지 마커 적용):
- 🟡 **같은 티커 관련이슈**: 메인 촉매 티커와 동일한 종목에서의 선행 이벤트.
- 🔵 **다른 티커 관련이슈**: 바스켓 내 다른 종목 또는 같은 테마이지만 직접 관련주가 아닌 종목에서의 이벤트.
- ⚪ **배경 이벤트**: 직접 주가 반응은 없지만 맥락상 필요한 산업/매크로 뉴스.

**그룹 구조 (필수):** 선행 이슈를 나열할 때, 각 **분석이슈(이벤트)를 먼저 쓰고**, 바로 아래에 그 이벤트의 관련이슈(같은 티커 → 다른 티커 순)를 들여쓰기로 묶는다. 이벤트가 끝나면 다음 분석이슈로 넘어간다.

예시 구조:
```
🟡 2026-01-15 GLW — Corning Q4 earnings beat
   → 🟡 같은 티커: GLW 어닝 후 analyst PT 상향 3건 (1/16~1/17)
   → 🔵 다른 티커: LITE +3.2% read-through 반응 (1/15)
   → ⚪ 배경: AI capex 전망 상향 보고서 (Goldman, 1/14)

🔵 2025-12-18 LITE — Lumentum data center revenue guidance raise
   → 🟡 같은 티커: LITE 8-K filing (12/18)
   → 🔵 다른 티커: AAOI +5.1% 스필오버 (12/19)
```

가격 반응 계산 규칙:
- OHLC DB (`ohlc_1d`)에서 해당 거래일의 **모든 파생 change 컬럼**을 함께 조회한다:
  - `Change_1d_Pct`: 전일 종가 대비 당일 종가 등락률.
  - `Change_From_Open_Pct`: 당일 시가 대비 종가 등락률 (장중 방향성).
  - `Change_7d_Pct`: 7 거래일 전 종가 대비 등락률 (1주 누적).
  - `Change_14d_Pct`: 14 거래일 전 종가 대비 등락률 (2주 누적).
  - `Change_30d_Pct`: 30 거래일 전 종가 대비 등락률 (1개월 누적).
  - `Turnover`: 당일 거래대금 (Close × Volume). 평소 대비 급등 여부를 함께 해석.
- HV / z-score는 `news_change_metrics` 또는 `/api/news` 응답에서 **해당 뉴스 row 기준**으로 조회한다:
   - `hv_*`: change metric과 정의가 같은 historical series의 최근 `60 completed samples` 표준편차. annualized volatility가 아니라 **현재 change와 직접 비교 가능한 비연율화 sigma(%)** 다.
   - `zscore_* = actual_change / hv_*`: unitless 값이며, 절대값이 클수록 평소 변동성 대비 더 큰 움직임이다.
- 뉴스 published_at 시각이 16:00 이후(장 마감 후)이면, 다음 거래일을 "첫 거래일 반응"으로 사용한다.
- 뉴스 published_at 시각이 16:00 이전이면, 당일을 "첫 거래일 반응"으로 사용한다.
- **최소 기재 세트 (필수):** 아래 window는 값이 있으면 반드시 숫자로 적는다.
  - same-day close: `change_pct`, `hv_change_pct`, `zscore_change_pct`
  - same-day from open: `change_from_open_pct`, `hv_change_from_open_pct`, `zscore_change_from_open_pct`
  - next trading day close: `change_1d_pct`, `hv_change_1d_pct`, `zscore_change_1d_pct`
  - 1 week: `change_7d_pct`, `hv_change_7d_pct`, `zscore_change_7d_pct`
  - 2 weeks: `change_14d_pct`, `hv_change_14d_pct`, `zscore_change_14d_pct`
  - 1 month: `change_30d_pct`, `hv_change_30d_pct`, `zscore_change_30d_pct`
- `change_open_to_high_pct`, `hv_change_open_to_high_pct`, `zscore_change_open_to_high_pct`는 intraday squeeze 해석이 중요할 때 추가한다. 장중 과열/되밀림이 핵심인 fail-tier 사례에서는 사실상 필수에 가깝다.
- 값이 DB/API에 없으면 `(DB/API 미제공)`으로 명시하고, 가능한 경우 `ohlc_1d`로 절대 change를 보완한다. 하지만 **change만 적고 HV/z-score를 묵시적으로 생략**하면 안 된다.
- **해석 가이드**:
   - change는 **절대 반응 크기**를 보여준다.
   - HV는 **그 change가 평소 어느 정도 흔한지의 분모**를 보여준다.
   - z-score는 **HV 대비 초과반응**을 보여준다. 같은 +10%라도 고변동성 종목의 `zscore 0.8`과 저변동성 종목의 `zscore 2.4`는 질적으로 다르다.
   - `|zscore| < 1`: 대체로 평소 변동성 범위.
   - `1 <= |zscore| < 2`: 의미 있는 초과반응 가능.
   - `|zscore| >= 2`: 평소 변동성 대비 뚜렷한 비정상 반응.
   - 7d/14d/30d change와 대응 HV/z-score는 이슈의 지속력과 fade 속도를 해석한다.
   - Turnover 급등은 기관 자금 유입 시그널로 해석한다.

**분석 원칙:** 바스켓 내 종목 간 비교에서는 change, HV, z-score를 항상 삼중항으로 본다. change가 큰데 HV도 크고 z-score가 낮으면 원래 변동성이 큰 종목의 통상 범위일 수 있고, change가 상대적으로 작아도 HV가 낮아 z-score가 높으면 저변동성 종목에서 나온 강한 신호일 수 있다. 숫자는 가능하면 반올림 규칙을 일관되게 적용하되, page 전체에서 같은 자릿수 체계를 유지한다.

---

### 이벤트 날짜 vs 기사 날짜 구분 규칙 (필수)

company_news 분석 시, **이벤트가 실제로 발생한 날짜(event_date)**와 **기사가 게시된 날짜(published_at)**가 다른 경우가 빈번하다. 후속 기사의 change를 이벤트 첫 반응으로 착각하면 분석이 왜곡되므로, 아래 규칙을 적용한다.

#### 핵심 용어

| 용어 | 정의 | 예시 |
|------|------|------|
| **event_date** | 이벤트가 실제 발생한 날짜 (어닝 발표, 계약 체결, SEC filing 등) | 4/12에 어닝 발표 |
| **published_at** | 해당 이벤트를 보도/분석한 기사의 게시 시각 (DB 저장 값) | 4/13에 후속 분석 기사 게시 |
| **first_public_at** | 시장이 해당 이벤트를 **처음** 인지한 시점 | 4/12 16:05 ET (어닝 발표 직후) |
| **change_anchor** | change 지표 계산 시 기준으로 삼는 첫 거래일 | first_public_at이 16:00 ET 이후면 다음 거래일 |

#### 운영 규칙

1. **change_anchor는 항상 first_public_at 기준이다.**
   - "시장이 언제 처음 알았는가"가 가격 반응의 기준점이다. 이벤트 발생일 자체가 아니다.
   - 예: 4/12 장 마감 후 어닝 발표 → first_public_at = 4/12 16:05 → change_anchor = 4/13 (다음 거래일).

2. **후속 기사의 change를 이벤트 첫 반응으로 사용하지 않는다.**
   - 4/12에 어닝이 발표되고 4/13에 분석 기사가 나온 경우:
     - 기사 row의 `news_change_metrics`는 **4/13 기준** change를 담고 있다 (4/12 종가 대비 4/13 종가 등).
     - 이것은 **후속 반응(2일차)**이지, 이벤트 첫 반응이 아니다.
   - 이벤트 첫 반응은 `ohlc_1d`에서 change_anchor 날짜의 change를 직접 조회해야 한다.

3. **분석 문서에 기록할 때 날짜를 구분해서 명시한다.**
   - `이벤트 날짜(event_date)`: 실제 이벤트 발생일.
   - `기사 날짜(published_at)`: DB에 저장된 기사 게시일.
   - `가격 기준일(change_anchor)`: change 계산에 사용할 첫 거래일.
   - 세 날짜가 동일하면 한 번만 쓰되, **다를 때는 반드시 구분 표기**한다.

4. **event_date 판별 방법 (우선순위):**
   - ① `calendar_events.event_at` (어닝, SEC filing 등 구조화 데이터)
   - ② 기사 본문/headline에 명시된 날짜 ("reported on April 12", "filed on 4/12")
   - ③ 같은 이벤트에 대한 가장 이른 기사의 published_at
   - ④ 판별 불가 시 `(event_date 미확인, published_at 기준 사용)` 태그 표기

#### 구체 예시

**예시 A — 어닝 후속 분석 기사:**
- 4/12(금) 16:05 ET: AAPL 어닝 발표 (event_date = 4/12)
- 4/13(토): 분석 기사 게시 (published_at = 4/13) → 주말이므로 change 의미 없음
- change_anchor = 4/14(월, 첫 거래일)
- ✅ 이벤트 반응 = ohlc_1d에서 4/14의 Change_1d_Pct 등
- ❌ 4/13 기사 row의 news_change_metrics를 "어닝 반응"으로 사용하면 안 됨

**예시 B — 당일 보도 (세 날짜 동일):**
- 4/15(화) 09:30 ET: 대형 계약 발표 (event_date = 4/15)
- 4/15(화) 10:15 ET: 기사 게시 (published_at = 4/15)
- change_anchor = 4/15 (세 날짜 동일)
- ✅ 기사 row의 news_change_metrics를 그대로 이벤트 반응으로 사용 가능

**예시 C — 전날 장 후 이벤트, 다음날 보도:**
- 4/12(월) 17:00 ET: CEO 사임 발표 (event_date = 4/12)
- 4/13(화) 06:30 ET: 기사 게시 (published_at = 4/13)
- first_public_at = 4/12 17:00, change_anchor = 4/13
- ✅ 기사 row의 news_change_metrics (4/13 기준)가 이벤트 첫 반응과 일치 → 사용 가능
- ⚠️ 단, change_from_open_pct로 장 시작 후 갭 반응과 장중 추가 반응을 별도 확인

---

### 4단계: 확산 타임라인

**목적:** 메인 촉매 이후 이슈가 어떻게 확산·강화·분화되었는지를 시간순으로 정리한다.

각 타임라인 항목에 반드시 포함할 내용:

| 항목 | 설명 |
| --- | --- |
| 날짜/기준일 | `event_date`, `published_at`, `change_anchor`를 구분 표기한다. 복수일이면 범위 표기 가능 (예: `2026-02-03~2026-02-06`), 단 기사 날짜와 가격 기준일이 다르면 반드시 별도 줄로 명시한다. |
| 촉매 이벤트 | 해당 시점의 핵심 뉴스/공시/어닝 내용 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `calendar_events` 등 |
| 가격 반응 (전체 change + HV + z-score) | 바스켓 내 주요 종목의 당일 **전체 change 컬럼**과 **대응 HV, z-score 컬럼** 테이블. `same-day`, `from-open`, `1d`, `7d`, `14d`, `30d`를 원칙적으로 모두 본다. |
| 의미 | 이 이벤트가 이슈 확산에서 어떤 역할을 했는지. Turnover 변화로 자금 유입/이탈을 판단하고, **change/HV/z-score 삼중항** 으로 평소 변동성 대비 정말 강한 파동이었는지 판단한다. |

어닝 날짜 연동 규칙:
- 각 타임라인 이벤트(및 선행 이슈)마다, 해당 시점에서 **직전 어닝**(가장 최근 과거)과 **다음 어닝**(가장 가까운 미래)을 **모두** 기록한다.
- 어닝 데이터는 `calendar_events` 테이블에서 `event_type='earnings'`으로 조회한다.
- **직전 어닝 조회**: `event_at <= ? ORDER BY event_at DESC LIMIT 1` — 해당 시점까지 가장 최근 발표된 어닝.
- **다음 어닝 조회**: `event_at > ? ORDER BY event_at ASC LIMIT 1` — 해당 시점 이후 가장 가까운 예정 어닝.
- 직전 어닝과의 거리(일수)는 "어닝 서프라이즈 모멘텀이 아직 살아있는지" 판단에 사용한다. 직전 어닝이 10일 이내이면 서프라이즈 연장 효과 가능.
- 다음 어닝까지의 거리(일수)가 짧으면 그것이 추가 촉매(어닝 기대감) 역할을 할 수 있으므로 명시한다.
- 형식:
  - `직전 어닝: {ticker} {date} ({N}일 전)` — 없으면 `(DB 미수록)` 표기.
  - `다음 어닝: {ticker} {date} ({N}일 후)` — 없으면 `(DB 미수록)` 표기.

확산 타임라인에서 식별해야 하는 핵심 시점 (이모지 마커 적용):
1. 🔴 **이슈 티어가 만들어진 날**: 메인 촉매가 터진 날.
2. 🟢 **전면 부각의 날**: 바스켓 전체가 처음으로 동시 급등한 날.
3. 🟢 **2차 파동**: 어닝/추가 딜/analyst 상향 등으로 두 번째 급등이 온 시점.
4. 🔵 **테마 확장**: 이슈 주제가 원래 범위에서 인접 테마로 확장된 시점.
5. 🟡 **개별 확인**: 소형캡 개별 종목이 자체 수주/어닝으로 테마를 확인한 시점.

**바스켓 판정 모수 규칙 (필수):**
- `바스켓 전체`, `3개 이상 동시 +5%`, `peer propagation` 같은 판정은 **1단계 관련주 표에 들어간 same-business / adjacent-business peer**만을 기준으로 계산한다.
- customer, utility, hyperscaler, 계약 상대방 같은 `validator / counterparty`는 설명에는 중요하지만, basket count를 올리거나 내리는 종목으로 세지 않는다.
- 따라서 ORCL, AEP처럼 `상업성 검증자`인 종목은 strong validator일 수 있어도, `관련주가 잘 움직였는가`를 판단하는 숫자 계산에는 넣지 않는다.

**그룹 구조 (필수):** 확산 타임라인도 선행 이슈와 동일하게 **분석이슈 → 관련이슈** 그룹 형태로 작성한다. 각 파동/이벤트를 먼저 쓰고, 바로 아래에 같은 티커 관련이슈 → 다른 티커 관련이슈를 들여쓰기로 묶는다.

**핵심 분석이슈 우선 규칙 (필수):** 확산 타임라인 이전에 이미 `오너십 데이터 -> 핵심 분석이슈 고정 블록`이 나와 있어야 한다. 즉 타임라인의 첫 🔴 항목은 page의 첫 메인 anchor와 연결되어야 하며, 독자가 이전 섹션에서 이미 그 anchor의 의미와 가격 반응을 이해한 상태여야 한다.

**날짜 표기 규칙 (필수):** 각 타임라인 이벤트 블록 안에 아래 3줄을 기본으로 둔다.
- `event_date:` 실제 이벤트 발생일
- `published_at:` 기사 게시 시각 또는 공시 수집 시각
- `change_anchor:` 첫 가격 반응 기준 거래일
- 세 값이 모두 같으면 한 줄로 축약 가능하지만, 하나라도 다르면 반드시 분리 표기한다.

예시 구조:
```
🔴 2026-01-27 GLW — Meta-Corning $6B fiber-optic 계약 발표
   - event_date: 2026-01-27
   - published_at: 2026-01-27 02:30 ET
   - change_anchor: 2026-01-27
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: GLW Q4 earnings (1/28) — EPS beat
   → 🔵 다른 티커: LITE +11.49%, COHR +8.21%, AAOI +7.17% 스필오버
   → ⚪ 배경: Meta AI capex $65B 발표 동일 주

🟢 2026-02-06 파동 — LITE 어닝 beat → 바스켓 전체 2차 급등
   - event_date: 2026-02-03
   - published_at: 2026-02-03 16:03 ET
   - change_anchor: 2026-02-04
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: LITE Q2 guidance raise, revenue $800M beat
   → 🔵 다른 티커: AXTI +17.77%, AAOI +16.18%, AEHR +14.74%
   → 🔵 다른 티커: FN +13.84% (AI photonics read-through)

🟡 2026-03-09 AAOI — 1.6T transceiver volume order
   - event_date: 2026-03-09
   - published_at: 2026-03-09 07:00 ET
   - change_anchor: 2026-03-09
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🔵 다른 티커: AXTI +19.12%, LITE +14.73% 연쇄 반응
```

### 5단계: 티어 판정 및 최종 정리

**목적:** 이슈의 지속성·파급력을 기준으로 티어를 판정하고, 전체 분석을 정리한다.

#### 티어 분류 체계

| 티어 | 정의 | 판정 조건 |
| --- | --- | --- |
| **1 tier (지속형)** | 이슈가 2회 이상의 파동을 만들고, 바스켓 내 3개 이상 종목이 각 파동에서 5% 이상 동반 반응하며, **메인 anchor의 핵심 직접 수혜 티커**가 자신의 평소 변동성 대비도 강하게 반응한다. 또한 메인 anchor가 기존 thesis의 단순 반복/증액이 아니라 새로운 direct confirmation을 제공해야 한다. 메인 촉매 이후 30일 이상 테마가 유지됨. | 확산 타임라인에서 2차 파동 이상 존재 + 개별 확인 이벤트 1건 이상 + 핵심 티커 direct z-score 품질 충족 |
| **2 tier (보통형)** | 이슈가 1~2회 파동을 만들었거나, breadth는 있었지만 **핵심 티커 direct z-score가 약하거나 기존 이슈의 반복/확대 성격이 강한 경우**. | 전면 부각은 있었으나 2차 파동이 약하거나, 핵심 direct surprise quality가 1 tier에 못 미침 |
| **3 tier (약형)** | 이슈가 뉴스에 등장했으나 바스켓 전체 동시 급등이 미약하거나 1일 내 되돌림. | 전면 부각 부재 또는 즉시 반납 |
| **fail tier (1일 스파이크)** | 촉매 당일만 반응하고 다음 거래일 즉시 반납 또는 역전. | 메인 촉매 당일 반응 후 다음 거래일 반대 방향 또는 0% 근처 |

티어 판정 보조 기준:
- **핵심 티커 direct z-score 품질**: 메인 anchor의 직접 수혜 티커(또는 page의 핵심 티커)의 `same-day`, `from-open`, `1d`, `7d` z-score를 **최우선**으로 본다. 기본 가이드는 `same-day` 또는 `1d` 중 하나가 `|z| >= 2`에 근접하거나 이를 넘고, follow-through window(`1d`, `7d`, `14d`)에서도 추가 확인이 있어야 한다. sympathy peer의 z-score가 높아도 핵심 티커 direct z-score가 약하면 기본적으로 `2 tier` ceiling을 우선 검토한다.
- **파동 횟수**: 확산 타임라인에서 바스켓 3개 이상 종목이 동시 `Change_1d_Pct` 5% 이상 반응한 날의 횟수.
- **파동 지속력**: 각 파동일의 `Change_7d_Pct`/`Change_14d_Pct`가 양수를 유지하는지로 "되돌림 없는 진짜 파동"인지 판단.
- **HV 대비 초과반응**: 같은 파동이라도 `zscore_*`가 높은 종목이 자신의 평소 변동성 대비 더 강하게 반응한 것이다. 고변동성 소형주는 절대 change만 크고 z-score는 낮을 수 있으므로 반드시 함께 본다.
- **신규성 vs 반복성**: 메인 anchor가 이미 알려진 고객/계약/정책/테마의 단순 확대, 금액 상향, 반복 headline인지 확인한다. **기존 이슈의 반복/증액 성격이 강하면 breadth만으로 `1 tier`를 주지 않는다.** 이 경우 핵심 티커의 direct z-score가 아주 강하거나, 이전 precedent보다 명확히 강한 신규 counterparty / revenue attribution이 추가된 경우에만 `1 tier` 승격을 검토한다.
- **지속 기간**: 메인 촉매부터 마지막 의미 있는 파동까지의 캘린더 일수.
- **개별 확인 이벤트**: 소형캡 자체 수주/어닝/딜로 테마를 독립적으로 확인한 횟수.
- **테마 확장 여부**: 이슈 주제가 원래 범위에서 인접 테마로 옮겨간 사례 유무.
- **Turnover 추이**: 파동별 Turnover가 이전 파동 대비 증가/감소하는지로 자금 유입 지속성을 판단.

최종 정리 필수 산출물:

1. **한줄 결론**: 이슈 티어 판정 + 핵심 날짜 2개 (이슈 형성일 + 전면 부각일).
2. **최종 판정 문단**: `이슈 티어가 만들어진 날`, `전면 부각의 날`에 대한 근거 요약.
3. **선행 이슈 성격 정리**: 메인 촉매 이전 선행 이슈들의 공통 성격 (개별적, 단일 종목, 간접, 일회성 등).
4. **스코프 선언**: 이번 page가 `event-level` 판정인지 `issue-cycle-level` 판정인지 명시한다. anchor 날짜 page인데 cycle 누적 판정을 쓸 경우 제목/한줄 결론/최종 판정에서 그 스코프를 분명히 드러낸다.

---

## 출력 문서 구조 (research page body)

아래 섹션 순서와 제목을 기본 템플릿으로 사용한다. 사용자가 별도 구조를 요청하지 않으면 이 순서를 따른다.

`관련주 확장`을 명시적으로 요청받은 경우에는 `## 관련주 정리` 바로 아래에 `## 관련주 확장` 또는 동등한 보조 섹션을 추가해, **새 후보의 발견 경로 / 관련성 정도 / 포함 여부 / 제외 사유**를 남긴다. 기본 Model_100 요청에서는 이 섹션을 자동으로 추가하지 않는다.

```
## 한줄 결론
## 관련주 정리
   [표: 티커 / 분류 / 관련성 정도 등급 / 설명]
## 관련주 확장 (사용자가 명시적으로 요청한 경우에만)
   [표: 티커 / 후보 발견 경로 / 분류 / 관련성 정도 등급 / 포함 여부 / 설명]
   - 사용한 keyword 묶음
   - 검토했지만 제외한 대표 후보와 제외 이유
## 오너십 데이터
## 🔴 핵심 분석이슈: {메인 촉매 날짜} {티커}
  - event_date: {실제 이벤트 날짜}
  - published_at: {기사/공시 시각}
  - change_anchor: {첫 가격 반응 기준일}
  - 대표 headline / structured catalyst
  [핵심 가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
  - 왜 이 이벤트가 이슈 티어를 만들었는가
  - 이 이슈가 정말 주가를 올릴 만한 이슈였나
## 🔴 {메인 촉매 날짜} 이전에 같은 이슈가 있었나
  (각 선행 이슈를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🟡 {날짜} {티커} — {이벤트 제목}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
     → ⚪ 배경
  🔵 {날짜} {티커} — {이벤트 제목}
     → ...
## 🟢 확산 타임라인
  (각 파동/이벤트를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🔴 {날짜} {티커} — {메인 촉매}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟢 {날짜} 파동 — {파동 설명}
     - event_date: {실제 이벤트 날짜 또는 기간}
     - published_at: {대표 기사/공시 시각}
     - change_anchor: {파동 기준 거래일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟡 {날짜} {티커} — {개별 확인 이벤트}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🔵 다른 티커 연쇄 반응
## 최종 판정
```

---

## DB / API 조회 규칙

### news_items (company_news)
- 조회: `SELECT * FROM news_items WHERE tickers_csv LIKE '%,{TICKER},%' AND published_at BETWEEN ? AND ? ORDER BY published_at`
- `tickers_csv`는 `,AAPL,MSFT,` 형식이므로 LIKE 패턴에 앞뒤 콤마 포함.
- `source` 컬럼으로 데이터 출처 확인 (finnhub, fmp 등).

### news_fulltext (fmp_pr)
- press release 전문. `news_id`로 `news_items`와 JOIN.
- PR 전문에서 계약 금액, 상대방, 제품 상세 등 추출.

### sec_filings (fmp_sec)
- `sec_filings` 테이블 자체에는 `ticker` 컬럼이 없다. ticker 기준으로 보려면 `news_items`와 `news_id`로 JOIN한다.
- 예시:
   ```sql
   SELECT sf.*, ni.tickers_csv, ni.title, ni.published_at
   FROM sec_filings sf
   JOIN news_items ni ON ni.id = sf.news_id
   WHERE ni.tickers_csv LIKE '%,{TICKER},%'
      AND sf.filed_at BETWEEN ? AND ?
   ORDER BY sf.filed_at
   ```
- filing type 컬럼명은 `filing_type`이 아니라 `form_type`이다. 값 예: `8-K`, `10-Q`, `10-K`, `S-1`.
- `accepted_at`과 `filed_at`이 다를 수 있으므로 장중/장후 판단이 중요하면 두 컬럼을 같이 본다.

### calendar_events (earnings)
- `SELECT * FROM calendar_events WHERE ticker=? AND event_type='earnings' ORDER BY event_at`
- `meta_json` 컬럼에 `eps_est`, `eps_actual`, `revenue_est`, `revenue_actual`, `confirmed`, `report_date` 포함.
- **다음 어닝 조회**: `event_at > ? ORDER BY event_at ASC LIMIT 1`.
- **직전 어닝 조회**: `event_at <= ? ORDER BY event_at DESC LIMIT 1`.
- 이벤트/촉매 분석 시 반드시 양방향(직전 + 다음)을 모두 조회하여 "직전 어닝 서프라이즈가 아직 유효한지"와 "다음 어닝 기대감이 추가 촉매인지"를 함께 판단한다.

### calendar_financial_series (실적 시계열)
- `SELECT * FROM calendar_financial_series WHERE ticker=? AND period_type='quarter' ORDER BY report_date DESC`
- 과거 실적 대비 서프라이즈 판단에 활용.

### news_change_metrics / `/api/news` (뉴스 파생 가격 반응, HV, z-score)
- 기본 저장소는 `news_change_metrics` 테이블이고, `GET /api/news`, `GET /api/news/:id`는 이를 JOIN한 snake_case field를 함께 반환한다.
- `reference_date`, `target_date`, `forward_trading_days`는 저장된 metric window를 검증하는 보조 필드다. `event_date ≠ published_at`인 경우, 이 값들과 `published_at`을 함께 보고 현재 row metric이 이벤트 첫 반응인지 후속 기사 반응인지 확인한다.
- page 작성 시에는 **가능한 한 change/HV/z-score를 같은 줄 또는 같은 표에서 나란히** 적는다. `change만 적고 HV/z-score는 본문 다른 곳에 흩어두는 방식`은 최신 기준과 맞지 않는다.
- base change metric key:
   - `change_pct`
   - `change_from_open_pct`
   - `change_open_to_high_pct`
   - `change_1d_pct`
   - `change_3d_pct`
   - `change_7d_pct`
   - `change_14d_pct`
   - `change_30d_pct`
- HV field / metric key:
   - `hv_change_pct`
   - `hv_change_from_open_pct`
   - `hv_change_open_to_high_pct`
   - `hv_change_1d_pct`
   - `hv_change_3d_pct`
   - `hv_change_7d_pct`
   - `hv_change_14d_pct`
   - `hv_change_30d_pct`
- Z-score field / metric key:
   - `zscore_change_pct`
   - `zscore_change_from_open_pct`
   - `zscore_change_open_to_high_pct`
   - `zscore_change_1d_pct`
   - `zscore_change_3d_pct`
   - `zscore_change_7d_pct`
   - `zscore_change_14d_pct`
   - `zscore_change_30d_pct`
- 직접 조회 예시:
   ```sql
   SELECT news_id, metric_key, value_pct
   FROM news_change_metrics
   WHERE news_id = ?
      AND metric_key IN ('change_pct', 'change_7d_pct', 'hv_change_pct', 'zscore_change_pct', 'zscore_change_7d_pct')
   ORDER BY metric_key
   ```
- 해석 규칙:
   - `change_*`: 절대 반응 크기.
   - `hv_*`: 해당 change 정의와 같은 historical series의 비연율화 sigma.
   - `zscore_* = actual_change / hv_*`: HV 대비 초과반응 강도. unitless.
   - 바스켓 종목 간 "누가 평소 변동성 대비 더 강했는가" 비교에는 `zscore_*`를 우선 참고한다.
   - 단, **최종 서술은 change/HV/z-score를 함께** 본다. `zscore만 높다`, `change만 컸다`처럼 하나만 떼어 결론내리지 않는다.

### ohlc_1d (OHLC DB - 별도 SQLite)
- 경로: `OHLC_data/ohlc_1d_watchlist.sqlite`
- **기본 조회 (전체 change 포함)**:
  ```sql
  SELECT Datetime, Open, High, Low, Close, Volume,
         Change_1d_Pct, Change_From_Open_Pct,
         Change_7d_Pct, Change_14d_Pct, Change_30d_Pct,
         Turnover
  FROM ohlc_1d
  WHERE Symbol = ? AND Datetime BETWEEN ? AND ?
  ORDER BY Datetime
  ```
- 각 컬럼 의미:
  - `Change_1d_Pct`: 전일 종가 대비 당일 종가 등락률 (%).
  - `Change_From_Open_Pct`: 당일 시가 대비 종가 등락률 (%). 양수면 장중 상승 마감.
  - `Change_7d_Pct`: 7 거래일 전 종가 대비 등락률 (%). 1주 누적.
  - `Change_14d_Pct`: 14 거래일 전 종가 대비 등락률 (%). 2주 누적.
  - `Change_30d_Pct`: 30 거래일 전 종가 대비 등락률 (%). 1개월 누적.
  - `Turnover`: 거래대금 (Close × Volume). 유동성/자금 유입 지표.
- `Change_1d_Pct`가 NULL인 경우 수동 계산: `(Close / prev_Close - 1) * 100`.
- **분석 시 반드시 전체 change 컬럼을 사용한다.** `Change_1d_Pct`만 단독으로 사용하는 것은 불충분하다.
- `ohlc_1d` 자체에는 `hv_*`, `zscore_*` 컬럼이 없다. HV / z-score는 `news_change_metrics` 또는 `/api/news` 응답에서 가져온다.

### company_profiles (기업 컨텍스트)
- `company_profiles` 테이블 자체에는 `ticker` 컬럼이 없다. `securities`와 `security_id`로 JOIN해서 조회한다.
- 예시:
   ```sql
   SELECT cp.*, s.ticker, s.industry, s.sector
   FROM company_profiles cp
   JOIN securities s ON s.id = cp.security_id
   WHERE s.ticker = ?
   ORDER BY cp.fetched_at DESC, cp.id DESC
   ```
- 시총, float, institutional_pct, insider_pct, description, industry, sector, ipo_date를 본다.
- `company_profiles`는 source별 다중 row이며 컬럼이 sparse할 수 있으므로, ownership table 작성 시에는 **필드별 latest non-null merge**가 필요할 수 있다.
- `GET /api/tickers` 엔드포인트로도 조회 가능하다.

---

## 순환매(로테이션) 분석 규칙

- 확산 타임라인 내에서 **어떤 종목이 먼저 반응하고, 어떤 종목이 나중에 따라가는지** 패턴을 식별한다.
- 일반적 순환매 패턴:
  1. **대형캡 선도**: 이슈 직접 당사자(대형캡)가 먼저 반응 → 소형캡이 read-through로 따라감.
  2. **소형캡 선도**: 소형캡이 speculative 선반응 → 대형캡이 어닝/딜로 확인.
  3. **동시 반응**: 바스켓 전체가 같은 날 동시 급등.
- 각 파동에서 **선도 종목**과 **추종 종목**을 명시하고, 그 순서가 시총/유동성/직접성과 어떻게 관련되는지 설명한다.

---

## 비교 가능 사례 (comparable) 분석 규칙

### 동일 티커 비교 (same-ticker comparable)
- 같은 종목이 과거에 유사한 이슈로 급등/급락한 사례를 조사한다.
- 조사 범위: 최소 1년 소급.
- 비교 항목: 촉매 성격, **전체 change 컬럼** (`1d`, `From_Open`, `7d`, `14d`, `30d`, `Turnover`), **대응 z-score**, 지속 기간, 후속 어닝에서의 확인 여부.
- 7d/14d/30d 비교를 통해 "과거 사례는 1주 만에 되돌렸지만 이번에는 30d까지 유지" 같은 지속성 비교가 가능하고, z-score 비교를 통해 "이번 반응이 과거보다 HV 대비 더 강했는지"를 판단할 수 있다.

### 교차 티커 비교 (cross-ticker comparable)
- 다른 이슈 티어에서 유사한 패턴(대형 계약 발표 → 밸류체인 확산 등)을 보인 사례를 조사한다.
- 비교 항목: 이슈 성격, 바스켓 크기, 확산 속도, 티어 판정 결과, **전체 change 컬럼 비교**, **z-score 비교** (특히 어느 종목/파동이 HV 대비 더 비정상적이었는지).

---

## 데이터 소스 귀속 (attribution) 규칙 (필수)

- 모든 팩트(날짜, headline, 등락률, 어닝 수치)에는 **데이터 소스를 명시**한다.
- 허용되는 소스 태그: `company_news`, `fmp_pr`, `fmp_sec`, `calendar_events`, `ohlc_1d`, `news_change_metrics`, `investing`, `company_profiles`.
- 소스가 불명확한 정보는 `(출처 미확인)` 태그를 붙이고, 가능하면 DB 쿼리로 검증한다.
- headline은 DB에서 읽은 원문 그대로 적는다. 요약/의역하지 않는다.

---

## 금지 규칙

1. **가격 반응 없이 정당성 판정 금지**: change/HV/z-score 데이터 없이 "주가 영향이 있었다/없었다"를 판단하지 않는다.
2. **선행 이슈 생략 금지**: 메인 촉매 이전의 선행 이슈를 조사하지 않고 바로 메인 촉매부터 시작하지 않는다.
3. **바스켓 종목 임의 추가/제거 금지**: 1단계에서 확정한 관련주를 분석 도중에 설명 없이 바꾸지 않는다. 추가/제거 시 근거를 명시한다.
4. **어닝 날짜 누락 금지**: 확산 타임라인의 각 이벤트에서 직전 어닝과 다음 어닝 날짜를 모두 조회하지 않으면 미완료로 간주한다.
5. **티어 판정 근거 생략 금지**: 티어를 부여할 때 판정 조건(파동 횟수, 지속 기간, 개별 확인 이벤트)을 명시하지 않으면 미완료로 간주한다.
6. **축약 금지**: `Model_100`은 `ai-news-research.md`의 축약 금지 / 미완료 판정 규칙을 동일하게 적용한다.
7. **이벤트 날짜 / 기사 날짜 혼동 금지**: 후속 기사의 published_at 기준 change를 이벤트 첫 반응으로 기록하지 않는다. event_date ≠ published_at인 경우 반드시 event_date, published_at, change_anchor를 구분 표기한다. 날짜를 1개만 쓰면서 "이 날 +8% 반응"처럼 적으면, 그것이 이벤트 반응인지 후속 기사 반응인지 알 수 없으므로 미완료로 간주한다.
8. **오너십 아래에서 선행 이슈부터 시작 금지**: `## 오너십 데이터` 아래에 핵심 분석이슈 anchor를 먼저 고정하지 않고 곧바로 관련이슈/선행이슈부터 길게 전개하면 최신 Model_100 기준과 맞지 않는다.
9. **당일 change만으로 파동 판정 금지**: `change_pct` 또는 장중 등락만 보고 파동/실패/지속형을 판단하지 않는다. 최소 `same-day`, `from-open`, `1d`, `7d`, `14d`, `30d`의 change/HV/z-score를 함께 보고, 값이 없으면 그 부재를 명시해야 한다.
10. **관련성 정도 등급 누락 금지**: `## 관련주 정리`에서 각 티커의 `관련성 정도 등급`을 적지 않으면 미완료로 간주한다. 단순히 `직접 수혜/간접 수혜/peer`만 적고 끝내면 최신 Model_100 기준과 맞지 않는다.
11. **스코프 혼동 금지**: anchor 날짜 page인데 실제로는 issue-cycle 누적 강도를 쓰고 있다면, 이를 숨긴 채 `단일 이벤트 자체가 1 tier`처럼 서술하지 않는다. 스코프를 명시하지 못하면 기본적으로 anchor event의 direct surprise quality 기준으로 보수 판정한다.
12. **기존 이슈 반복 과대평가 금지**: 이미 알려진 고객 관계, 기존 계약의 증액/확대, 반복 headline만으로 breadth가 생겼다고 해서 자동으로 `1 tier`를 주지 않는다. 핵심 티커 direct z-score와 신규성 확인이 약하면 `2 tier` 우선 검토가 기본이다.
