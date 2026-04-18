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

### Model_100 과 다른 모델의 관계

- `Model_100`은 `Model_1`의 확장이 아니라 **별도 분석 프레임**이다.
- `Model_1`은 뉴스 1건 → 종목 영향을 분석하고, `Model_2`는 기간 내 뉴스를 case_type으로 분류한다.
- `Model_100`은 이슈 1개 → 관련 종목 바스켓 전체의 형성·확산·소멸을 시간축으로 분석한다.
- 단, `Model_1`의 same-ticker / other-ticker 조사, `Model_2`의 case_type 분류, DB 조회 방법은 `Model_100` 내에서도 도구로 활용할 수 있다.

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

### 1단계: 이슈 정의 및 관련주 정리

**목적:** 분석 대상 이슈의 핵심 내용을 확정하고, 그 이슈에 연결된 종목 바스켓을 정의한다.

필수 산출물:

1. **이슈 한줄 정의**: 어떤 이슈인지 1~2문장으로. 예: `AI 데이터센터 fiber-optic / optical component 밸류체인 이슈`.
2. **관련주 분류 테이블**: 아래 분류 축으로 종목을 정리한다.

| 분류 | 설명 |
| --- | --- |
| 1차 직접 수혜 | 이슈의 직접 당사자 또는 핵심 밸류체인 상의 종목 |
| 2차 read-through | 직접 당사자는 아니지만 밸류체인/원재료/장비 등으로 간접 수혜 |
| 참고 peer | 같은 산업이지만 이번 이슈의 직접 수혜 경로가 약한 종목 |

- 각 종목에 대해 `티커`, `분류`, `설명(왜 이 분류인지)` 3개를 반드시 적는다.
- 분류 기준은 **이번 이슈와의 비즈니스 연결성**이지, 주가 반응 크기가 아니다.

3. **오너십 데이터 테이블**: 각 종목의 시총, Float %, Institutional %, Insider % 를 포함한다.

오너십 데이터 조회 규칙:
- 출처: `GET /api/tickers` 또는 app DB의 `company_profiles` 테이블.
- 필수 컬럼: 시총(market_cap), Float %, Institutional %, Insider %.
- `institutional_pct`가 100% 초과할 수 있음 (중복 집계 특성). 이를 그대로 기록하고 `원래의 집계 특성 그대로`라고 주석 표기.
- 오너십 해석을 별도 문단으로 추가: 대형캡 vs 소형캡의 반응 차이, float 크기와 변동성 관계, insider 보유율이 시사하는 것 등.

### 2단계: 선행 이슈 조사

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
| 날짜 | published_at 또는 event_at (ISO 형식) |
| 티커 | 해당 이슈의 주체 종목 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `investing`, `calendar_events` 중 어디서 왔는지 |
| headline/제목 | 원문 headline 또는 filing type |
| 가격 반응 (전체 change + z-score) | 해당 뉴스의 첫 반응 거래일 기준 **모든 change 컬럼**과 **대응 z-score 컬럼**을 함께 기록한다. 장 후(16:00 이후) 발표면 다음 거래일 기준. change는 절대 반응, z-score는 HV 대비 초과반응이다. 필요 시 대응 `hv_*`도 함께 적는다. |
| 다음 거래일 반응 | 첫 반응 거래일 바로 다음 거래일의 동일 change/z-score 컬럼 전체 |
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
- **해석 가이드**:
   - change는 **절대 반응 크기**를 보여준다.
   - z-score는 **HV 대비 초과반응**을 보여준다. 같은 +10%라도 고변동성 종목의 `zscore 0.8`과 저변동성 종목의 `zscore 2.4`는 질적으로 다르다.
   - `|zscore| < 1`: 대체로 평소 변동성 범위.
   - `1 <= |zscore| < 2`: 의미 있는 초과반응 가능.
   - `|zscore| >= 2`: 평소 변동성 대비 뚜렷한 비정상 반응.
   - 7d/14d/30d change는 이슈의 지속력, Turnover 급등은 기관 자금 유입 시그널로 해석한다.

**분석 원칙:** 바스켓 내 종목 간 비교에서는 change와 z-score를 항상 짝으로 본다. change가 큰데 z-score가 낮으면 원래 변동성이 큰 종목의 통상 범위일 수 있고, change가 상대적으로 작아도 z-score가 높으면 저변동성 종목에서 나온 강한 신호일 수 있다.

### 3단계: 메인 촉매 분석 및 정당성 판정

**목적:** 이슈 티어를 만든 핵심 촉매 이벤트를 식별하고, 그것이 주가를 움직일 만한 이슈였는지 판정한다.

메인 촉매 식별 기준:
- 관련주 바스켓 전체가 **처음으로 동시에 의미 있는 반응**을 보인 날의 이벤트.
- "의미 있는 반응" = 바스켓 내 최소 3개 종목이 같은 방향으로 5% 이상 등락.

정당성 판정에서 반드시 답해야 하는 질문:

1. **이 이슈가 정말 주가를 올릴(내릴) 만한 이슈였나?**
   - 각 종목별로 `예/아니오/일부` + 근거를 적는다.
   - 근거는 `Model_1`의 가치 경로 설명과 동일한 수준으로 적는다:
     - 무엇이 바뀌었는가 (asset ownership, approval, commercial access, pricing power, spending commitment 등)
     - 왜 repricing으로 이어질 수 있는가 (매출/이익 귀속, 확률 상승, 멀티플 재평가, 후속 catalyst 기대, 리스크 감소)
     - 직접 성취인지 간접 수혜 기대인지

2. **왜 이 날이 메인 촉매인가?**
   - 선행 이슈와 비교하여 이 이벤트만의 차별점 설명.
   - 금액 규모, 계약 상대방, 구체성, 지속성, 밸류체인 파급 범위 등.

### 4단계: 확산 타임라인

**목적:** 메인 촉매 이후 이슈가 어떻게 확산·강화·분화되었는지를 시간순으로 정리한다.

각 타임라인 항목에 반드시 포함할 내용:

| 항목 | 설명 |
| --- | --- |
| 날짜/기간 | ISO 형식. 복수일이면 범위 표기 (예: `2026-02-03~2026-02-06`) |
| 촉매 이벤트 | 해당 시점의 핵심 뉴스/공시/어닝 내용 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `calendar_events` 등 |
| 가격 반응 (전체 change + z-score) | 바스켓 내 주요 종목의 당일 **전체 change 컬럼**과 **대응 z-score 컬럼** 테이블. change로 절대 반응을, z-score로 HV 대비 초과반응을 본다. 이전 파동 대비 7d/14d change와 z-score 수준이 어떻게 달라졌는지도 비교. 필요 시 `hv_*`를 같이 붙여 분모를 보여준다. |
| 의미 | 이 이벤트가 이슈 확산에서 어떤 역할을 했는지. Turnover 변화로 자금 유입/이탈을 판단하고, z-score로 "평소 변동성 대비 정말 강한 파동이었는지"를 판단한다. |

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

**그룹 구조 (필수):** 확산 타임라인도 선행 이슈와 동일하게 **분석이슈 → 관련이슈** 그룹 형태로 작성한다. 각 파동/이벤트를 먼저 쓰고, 바로 아래에 같은 티커 관련이슈 → 다른 티커 관련이슈를 들여쓰기로 묶는다.

예시 구조:
```
🔴 2026-01-27 GLW — Meta-Corning $6B fiber-optic 계약 발표
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: GLW Q4 earnings (1/28) — EPS beat
   → 🔵 다른 티커: LITE +11.49%, COHR +8.21%, AAOI +7.17% 스필오버
   → ⚪ 배경: Meta AI capex $65B 발표 동일 주

🟢 2026-02-06 파동 — LITE 어닝 beat → 바스켓 전체 2차 급등
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: LITE Q2 guidance raise, revenue $800M beat
   → 🔵 다른 티커: AXTI +17.77%, AAOI +16.18%, AEHR +14.74%
   → 🔵 다른 티커: FN +13.84% (AI photonics read-through)

🟡 2026-03-09 AAOI — 1.6T transceiver volume order
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🔵 다른 티커: AXTI +19.12%, LITE +14.73% 연쇄 반응
```

### 5단계: 티어 판정 및 최종 정리

**목적:** 이슈의 지속성·파급력을 기준으로 티어를 판정하고, 전체 분석을 정리한다.

#### 티어 분류 체계

| 티어 | 정의 | 판정 조건 |
| --- | --- | --- |
| **1 tier (지속형)** | 이슈가 2회 이상의 파동을 만들고, 바스켓 내 3개 이상 종목이 각 파동에서 5% 이상 동반 반응. 메인 촉매 이후 30일 이상 테마가 유지됨. | 확산 타임라인에서 2차 파동 이상 존재 + 개별 확인 이벤트 1건 이상 |
| **2 tier (보통형)** | 이슈가 1~2회 파동을 만들었으나 개별 확인 이벤트가 부족하거나 소멸 속도가 빠름. | 전면 부각은 있었으나 2차 파동이 약하거나 개별 확인 없음 |
| **3 tier (약형)** | 이슈가 뉴스에 등장했으나 바스켓 전체 동시 급등이 미약하거나 1일 내 되돌림. | 전면 부각 부재 또는 즉시 반납 |
| **fail tier (1일 스파이크)** | 촉매 당일만 반응하고 다음 거래일 즉시 반납 또는 역전. | 메인 촉매 당일 반응 후 다음 거래일 반대 방향 또는 0% 근처 |

티어 판정 보조 기준:
- **파동 횟수**: 확산 타임라인에서 바스켓 3개 이상 종목이 동시 `Change_1d_Pct` 5% 이상 반응한 날의 횟수.
- **파동 지속력**: 각 파동일의 `Change_7d_Pct`/`Change_14d_Pct`가 양수를 유지하는지로 "되돌림 없는 진짜 파동"인지 판단.
- **HV 대비 초과반응**: 같은 파동이라도 `zscore_*`가 높은 종목이 자신의 평소 변동성 대비 더 강하게 반응한 것이다. 고변동성 소형주는 절대 change만 크고 z-score는 낮을 수 있으므로 반드시 함께 본다.
- **지속 기간**: 메인 촉매부터 마지막 의미 있는 파동까지의 캘린더 일수.
- **개별 확인 이벤트**: 소형캡 자체 수주/어닝/딜로 테마를 독립적으로 확인한 횟수.
- **테마 확장 여부**: 이슈 주제가 원래 범위에서 인접 테마로 옮겨간 사례 유무.
- **Turnover 추이**: 파동별 Turnover가 이전 파동 대비 증가/감소하는지로 자금 유입 지속성을 판단.

최종 정리 필수 산출물:

1. **한줄 결론**: 이슈 티어 판정 + 핵심 날짜 2개 (이슈 형성일 + 전면 부각일).
2. **최종 판정 문단**: `이슈 티어가 만들어진 날`, `전면 부각의 날`에 대한 근거 요약.
3. **선행 이슈 성격 정리**: 메인 촉매 이전 선행 이슈들의 공통 성격 (개별적, 단일 종목, 간접, 일회성 등).

---

## 출력 문서 구조 (research page body)

아래 섹션 순서와 제목을 기본 템플릿으로 사용한다. 사용자가 별도 구조를 요청하지 않으면 이 순서를 따른다.

```
## 한줄 결론
## 관련주 정리
## 오너십 데이터
## 🔴 {메인 촉매 날짜} 이전에 같은 이슈가 있었나
  (각 선행 이슈를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🟡 {날짜} {티커} — {이벤트 제목}
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
     → ⚪ 배경
  🔵 {날짜} {티커} — {이벤트 제목}
     → ...
## 🔴 왜 {메인 촉매 날짜} {티커}가 첫 메인 촉매인가
## 이 이슈가 정말 주가를 올릴 만한 이슈였나
## 🟢 확산 타임라인
  (각 파동/이벤트를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🔴 {날짜} {티커} — {메인 촉매}
     [가격 반응 테이블: change + z-score (+ 필요시 hv)]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟢 {날짜} 파동 — {파동 설명}
     [가격 반응 테이블: change + z-score (+ 필요시 hv)]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟡 {날짜} {티커} — {개별 확인 이벤트}
     [가격 반응 테이블: change + z-score (+ 필요시 hv)]
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
- `SELECT * FROM sec_filings WHERE ticker=? AND filed_at BETWEEN ? AND ?`
- `filing_type`: 8-K, 10-Q, 10-K, S-1 등.
- 어닝 전후 SEC filing은 실적 공시의 근거.

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
- `SELECT * FROM company_profiles WHERE ticker=?`
- 시총, float, institutional_pct, insider_pct, description, industry, sector, ipo_date.
- `GET /api/tickers` 엔드포인트로도 조회 가능.

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

1. **가격 반응 없이 정당성 판정 금지**: change/z-score 데이터 없이 "주가 영향이 있었다/없었다"를 판단하지 않는다.
2. **선행 이슈 생략 금지**: 메인 촉매 이전의 선행 이슈를 조사하지 않고 바로 메인 촉매부터 시작하지 않는다.
3. **바스켓 종목 임의 추가/제거 금지**: 1단계에서 확정한 관련주를 분석 도중에 설명 없이 바꾸지 않는다. 추가/제거 시 근거를 명시한다.
4. **어닝 날짜 누락 금지**: 확산 타임라인의 각 이벤트에서 직전 어닝과 다음 어닝 날짜를 모두 조회하지 않으면 미완료로 간주한다.
5. **티어 판정 근거 생략 금지**: 티어를 부여할 때 판정 조건(파동 횟수, 지속 기간, 개별 확인 이벤트)을 명시하지 않으면 미완료로 간주한다.
6. **축약 금지**: `Model_100`은 `ai-news-research.md`의 축약 금지 / 미완료 판정 규칙을 동일하게 적용한다.
