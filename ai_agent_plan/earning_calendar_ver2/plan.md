# Earning Calendar ver2 — plan

작성일: 2026-08-05
대상 폴더: `ai_agent_plan/earning_calendar_ver2`
관련 기존 plan: `__calendar_window_fmp_scope`, `__news_earnings_dates`, `__custom_update_gap`

---

## 0. 요구사항 (사용자 원문 기준)

1. default ticker를 대상으로 earning 날짜 / forecast / estimate 정보를 받아오는 버튼을 만든다.
2. `custom update` 버전을 만든다 (사용자가 기간을 설정).
3. `next 3 month` 버전을 만든다 (앞으로 3개월).
4. 어닝콜 정보가 **중간에 변경되면**, update 시 기존 데이터를 **수정(update)** 해서 반영한다. (append 금지, stale 잔존 금지)

---

## 1. 현황 실측 (2026-08-05, 직접 호출/조회로 확인)

### 1-1. 기존 구현 (ver1)

| 항목 | 위치 |
|---|---|
| UI 버튼 | `CalendarWindow.tsx:1940` — `Update FMP Earnings Dates` 1개. `activeType==='earnings'`일 때만 노출 |
| 요청 body | `{ from: dateFrom, to: dateTo, concurrency }` — **화면 date filter를 그대로 재사용** |
| API | `server.ts:5577` `POST /api/fmp/calendar/earnings/update` |
| 기본 window | `server.ts:491` `getDefaultFmpCalendarWindow()` = today ±180d |
| 동기화 로직 | `server.ts:660~830` `syncFmpEarningsCalendarRange()` |
| 청크 | 14일 (`DEFAULT_FMP_EARNINGS_CALENDAR_CHUNK_DAYS=14`), 워커 병렬 |
| 쓰기 방식 | 청크 단위 `deleteCalendarEventsForSourceRange(type=earnings, source=FMP, 범위, universe tickers)` → `upsertCalendarEvent()` |
| unique key | `FMP:earnings:{TICKER}:{REPORT_DATE}` |
| upsert 병합 | `calendarRepository.ts:170` — earnings는 `time_of_day`/`session`을 `COALESCE`로 보존 |
| 대상 종목 | `getDefaultUniverseTickers()` (universe `default`) |

### 1-2. FMP 실측 — **range 엔드포인트가 사실상 무력화되어 있다**

현재 plan의 FMP 키로 직접 호출한 결과:

| 호출 | 결과 |
|---|---|
| `/stable/earnings-calendar?from=2026-08-01&to=2026-08-14` | **17행** (AMD, CPRX, CSCO, DIS, ET, ETSY, FUBO, LCID, PFE, PINS, PLTR, RIOT, RKT, ROKU, SHOP, SNAP, UBER) |
| 위 + `limit=10000` | 동일 17행 (limit 문제 아님) |
| `/stable/earnings-calendar?from=2026-08-06&to=2026-08-06` | **1행** (RKT) |
| `/stable/earnings-calendar?from=2026-02-01&...` | `Premium Query Parameter` 에러 — 과거 조회 차단 |
| `/api/v3/earning_calendar` (legacy) | `Legacy Endpoint` 에러 — 사용 불가 |
| **`/stable/earnings?symbol=AAPL`** | **정상.** 미래 `2026-10-29` + `epsEstimated 1.98` / `revenueEstimated 113.4B` + 과거 실적 이력 전부 |

비교 기준: Nasdaq 무료 API 기준 **2026-08-06 하루에만 566개사**가 실적 발표. FMP range는 그중 1개만 반환.

> ~~**결론: range는 쓸 수 없지만 per-symbol `earnings`는 제한이 없다.**~~
>
> **정정 (2026-08-05, ZETA 조사 중 발견) — per-symbol도 똑같이 막혀 있다.** 위 AAPL 성공은 AAPL이 화이트리스트에 있었기 때문이며, 그 한 종목만 보고 일반화한 것이 오류였다. 유니버스 티커 16개 재측정:
>
> ```
> 허용 5개  : AAPL MSFT NVDA TSLA AMD
> 차단 11개 : ZETA DOCS AVAV OII ASUR CARS PLTK MOBI WBTN CRDF ARTNA
>            → "Premium Query Parameter: 'symbol' is not available under your current subscription"
> ```
>
> **FMP는 두 엔드포인트 모두 메가캡 화이트리스트로 제한돼 있다.** 유니버스 2,283개 중 실사용 가능한 종목이 극소수이므로 FMP는 "강등"이 아니라 **사실상 폐기**다. DB의 FMP row가 2024년부터 잘 쌓여 있고 `last_updated`가 전부 2026-05-29 이전인 것으로 보아 **최근에 플랜이 제한된 것**으로 추정된다. ver2가 Yahoo 기반이어야 하는 근거가 더 강해졌다.

### 1-3. 프로덕션 DB 실측 (`terminal/backend/backend/data/app.db`, 21.4GB, read-only 조회)

| 지표 | 값 |
|---|---|
| default universe | **2,283 티커** |
| earnings row 총계 | FMP 23,818 + yahoo_hist 49,834 |
| FMP earnings 날짜 범위 | 2023-05-17 ~ 2027-01-27 |
| **미래(≥오늘) earnings row** | **768행 / 715 티커** → 유니버스의 **31%만 다음 실적일을 가짐** |
| 미래 row `time_of_day` 채움 | **41 / 768 (5.3%)** |
| 미래 row `eps_est` 채움 | 723 / 768 (94%) |
| 미래 row `revenue_est` 채움 | 613 / 768 (80%) |
| 미래 row `last_updated` | **656행이 2026-05-29** (2개월 이상 정지), 오늘 갱신된 건 5행 |
| **동일 티커 미래 중복 row** | 52 티커 / **47쌍이 간격 ≤45일** (= 분기 2개가 아니라 **날짜 이동 후 잔존한 유령 row**) |

유령 row 실제 예시:

```
AKTS 2026-08-10 / 2026-09-02  (23일)   ← 둘 다 source=FMP
ALH  2026-08-11 / 2026-09-02  (22일)
BBOT 2026-08-11 / 2026-09-02  (22일)
BNTC 2026-09-28 / 2026-09-30  ( 2일)
AVNW 2026-08-26 / 2026-09-09  (14일)
```

정상적인 "분기 2개"는 6쌍뿐 (예: BBW 2026-08-27 / 2026-11-23).

> **결론: 사용자가 지적한 "날짜가 바뀌면 수정되어야 한다"는 문제가 이미 프로덕션에 47건 실재한다.**

### 1-4. 유령 row가 생기는 구조적 원인

1. `unique_key`에 **report_date가 들어가 있다** (`FMP:earnings:TICKER:DATE`). 날짜가 바뀌면 다른 키 → **UPDATE가 아니라 INSERT**.
2. 이를 보정하는 유일한 장치가 "청크 범위 선삭제"인데, **이동한 날짜가 그 실행의 from~to 밖이면 옛 row가 안 지워진다.** (예: 8월만 업데이트하면 9월로 밀린 옛 row가 그대로 남음 — 위 AKTS/ALH/BBOT가 정확히 이 패턴)
3. 게다가 청크가 `FMP_EARNINGS_CALENDAR_CAP_WARNING_ROWS=4000`를 넘으면 **선삭제를 스킵**한다 (`server.ts:773`). 지금은 17행이라 발동 안 하지만, 플랜이 정상화되면 성수기에 발동 → **날짜가 가장 많이 바뀌는 시기에 정확히 삭제가 꺼진다.**
4. UI 버튼이 **화면 date filter를 그대로 요청 범위로 쓴다.** 사용자가 과거 구간을 보고 있으면 "업데이트" 버튼이 과거만 갱신하고 미래는 손도 안 댐 → 위 (2)를 상시 유발.

### 1-5. 전 소스 실측 비교 (2026-08-05~06 직접 호출)

미래 방향 기준. 커버리지는 실제 호출 결과를 센 값이다.

| 소스 | 하루 커버 | 최대 horizon | BMO/AMC | EPS est | Rev est | 애널 수 | **확정/추정 구분** | 키 | 성격 |
|---|---|---|---|---|---|---|---|---|---|
| **Yahoo** `quoteSummary(calendarEvents+earningsTrend)` | 티커 단위 **95%** | 다음 1회 | **100%** | 83% | **88%** | **88%** | **✅ 97%** | 불필요 | 비공식 |
| **Nasdaq** `api.nasdaq.com/api/calendar/earnings?date=` | **566행** | **D+14** | 79% | 81% | ❌ | **96%** | ❌ | 불필요 | 비공식 |
| **Investing.com** `getCalendarFilteredData` | **604행** | 무제한 | 76% | **90%** | **86%** | ❌ | ❌ | 불필요 | 스크래핑(ToS 위반) |
| **Alpha Vantage** `EARNINGS_CALENDAR&horizon=3month` | 4,005행/3개월 | 3개월 | 53% | EPS만 | ❌ | ❌ | ❌ | 무료 | 공식 |
| **Finnhub** `/calendar/earnings` | 1,500행/주 | 미래만 | 40% | ○ | ○ | ❌ | ❌ | 보유 | 공식 |
| **FMP** `/stable/earnings?symbol=` | 티커 단위 | 전체 | ❌ | ○ | ○ | ❌ | ❌ | 보유 | 공식 유료 |
| **FMP** `/stable/earnings-calendar` (range) | **1행** | — | — | — | — | — | — | 보유 | **사실상 사망** |
| **SEC EDGAR** `data.sec.gov/submissions` | — | **과거 전용** | 93%(정답지) | ❌ | ❌ | ❌ | 절대확정 | 불필요 | 공식 |

**Nasdaq horizon 절벽 (실측)** — `next 3 month`를 Nasdaq 단독으로는 물리적으로 못 채운다:

```
D+1  (2026-08-06) : 566행   (time 채움 448)
D+8  (2026-08-13) : 393행   (time 채움 124)
D+15 (2026-08-20) :  28행   ← 절벽
D+29 (2026-09-03) :  41행
```

또한 Nasdaq은 **날짜가 지나면 `time` 필드를 지운다** (2026-07-30 과거 조회 시 297행 중 292행 `time-not-supplied`). → 미래 시점 스냅샷으로만 확보 가능.

**Yahoo 실측 상세 (default universe 랜덤 150 티커)**

```
n=150 ok=150 err=0  elapsed=49.0s (326ms/종목) → 2,283 티커 전체 ≈ 12분 (직렬)
date=143 (95%)  isEarningsDateEstimate=146 (97%)  epsAvg=124 (83%)  revAvg=132 (88%)  nAnalysts=132 (88%)
CONFIRMED(회사 공시)=71  ESTIMATED(야후 추정)=75
시각 분포: 확정 {16:00 ET: 8, 08:30 ET: 8} / 추정 {16:00: 7, 08:30: 4}
```

- Yahoo는 미래 날짜에도 **세션(BMO/AMC)을 100% 제공**한다. 단 값이 정확히 `08:30`/`16:00` ET 두 개로 정규화돼 있으므로 **정확한 시각이 아니라 세션 라벨**로만 취급해야 한다.
- `isEstimate=true`인 행은 **날짜 자체가 추정**이다 (과거 패턴 기반). 세션도 함께 낮은 신뢰도로 마킹한다.

### 1-5-1. **왜 Nasdaq은 2주뿐인가 — 교차검증으로 확인한 메커니즘**

Nasdaq API의 기술적 한계가 아니다. **실적 발표일은 회사가 IR을 통해 대략 2~4주 전에 공시하고, Nasdaq 캘린더는 그 공시된 것만 싣기 때문**이다. D+15에 28행인 것은 Nasdaq이 못 보여주는 게 아니라 **아직 아무도 발표하지 않은 것**이다.

Yahoo `isEarningsDateEstimate`로 교차검증 (default universe 랜덤 150):

| 다음 실적일까지 | n | 확정 | 추정 | 확정비율 |
|---|---|---|---|---|
| 0~14일 | 38 | 25 | 13 | **66%** |
| 15~45일 | 11 | 4 | 7 | 36% |
| 46~90일 | 57 | 9 | 48 | **16%** |
| 90일+ | 4 | 0 | 4 | 0% |

Nasdaq 등재 종목을 역으로 Yahoo에 물어본 결과:

| Nasdaq 목록 | 표본 | Yahoo 확정 | 확정비율 |
|---|---|---|---|
| D+1 (08-06) | 60 | 51 | **85%** |
| D+8 (08-13) | 48 | 25 | 52% |
| D+15 (08-20) | 28 | 15 | 54% |

**두 소스가 서로를 검증한다.** Nasdaq 근미래 목록은 Yahoo 기준으로도 85%가 확정 → Nasdaq은 **짧지만 순도 높은** 소스다.

**따라서 "next 3 month"는 추정 없이는 물리적으로 채울 수 없다.** 46~90일 구간은 84%가 아직 미공시다. 즉 3개월 캘린더를 만들려면 추정 날짜를 넣을 수밖에 없고, **그렇다면 추정임을 반드시 표시해야 한다.** 이것이 `isEarningsDateEstimate`가 없는 소스(Nasdaq/Investing/AV/FMP)를 주 소스로 쓸 수 없는 근본 이유다.

### 1-5-2. Yahoo의 약점 (정직하게)

1. **다음 1건만 준다** → 차집합 reconcile 불가 (2-2에 반영).
2. **과거 날짜를 반환하는 경우가 있다 — 실측 35/145 = 24%.** 롤포워드가 안 된 상태로, 값은 "다음"이 아니라 "직전" 실적일이다. 이 중 91%가 `confirmed`로 표시되므로 **플래그만 믿으면 과거 날짜를 미래로 착각한다.** → `date <= today`면 무조건 폐기하는 가드가 필수.
3. **비공식 API** — 2,283 배치 연속 호출 시 429/차단 미검증 (P0).

**Investing.com 반려 사유** — 커버리지는 최고지만 채택하지 않는다:
- forecast 값이 클래스명 없는 위치 기반 셀 (`<td class="leftStrong">/&nbsp;&nbsp;3.07</td>`) → 레이아웃 변경 시 **조용히 깨진다**
- 식별자가 티커가 아니라 내부 `pair_id` (예: 941850) → universe 2,283과 별도 매핑 테이블 필요
- ToS상 스크래핑 금지, 확정/추정 구분 없음

**FMP 강등 사유** — per-symbol은 살아 있지만 Yahoo 대비 **추가로 주는 정보가 없다** (BMO/AMC ❌, 확정 플래그 ❌, 애널리스트 수 ❌). 유료인데 상위호환이 무료로 있음.

---

## 1-6. Yahoo vs Nasdaq — 소스 특성 정리 (확정판)

> 이 절이 두 소스에 대한 **단일 기준 문서**다. 위 1-5의 표는 후보 탐색 단계 기록이고,
> 실제 구현이 따르는 규칙은 여기다. 모든 수치는 2026-08-05~06 직접 호출 실측값.

### 1-6-1. 근본 차이 — 질의 축이 다르다

```
Yahoo   : "이 티커의 실적 이력은"          → 티커 축.  티커당 약 5건 (다음 1 + 과거 4분기)
Nasdaq  : "이 날 실적 발표하는 회사는 누구" → 날짜 축.  그 날 시장 전체
```

> **2026-08-05 정정** — 처음에 "Yahoo는 티커당 2건(다음/직전)"이라고 적었으나 틀렸다.
> 그건 `quote()` 배치 기준이고, `quoteSummary`는 아래 필드들로 **약 5건**을 준다.
>
> | 위치 | 주는 것 |
> |---|---|
> | `calendarEvents.earnings.earningsDate` | 다음 실적일 1건 |
> | `calendarEvents.earnings.earningsCallDate` | **직전 실적 콜 날짜** (처음에 놓쳤던 필드) |
> | `earnings.earningsChart.quarterly[].reportedDate` | **과거 4분기의 실제 발표 시각** |
>
> 그래도 **기간 열거는 불가능**하다. "티커를 알아야 물어볼 수 있고, 그 티커의 최근 5건만" 나오기 때문이다.
> 지정 기간에 발표하는 **종목 목록 자체**를 얻는 일은 여전히 날짜 축 소스(Nasdaq)만 할 수 있다.

이 한 줄이 나머지 모든 차이를 만든다. **기간을 채우는 일은 날짜 축 소스만 할 수 있고,
종목별 컨센서스를 채우는 일은 티커 축 소스만 할 수 있다.** 둘은 대체재가 아니라 보완재다.

### 1-6-2. Yahoo — 티커 축

**접근 방법 / 비용**

| 호출 | 단위 | 실측 비용 | 얻는 것 |
|---|---|---|---|
| `quote(batch 50)` | 50종목/요청 | 150종목 3요청 **2.3초** → 2,283종목 46요청 **약 35~55초** | 날짜 + 확정플래그 + 세션 |
| `quoteSummary(calendarEvents, earningsTrend)` | 1종목/요청 | **326ms/종목** → 2,283종목 약 **12분** | 위 + 컨센서스 전체 |

**제공 필드 (default universe 랜덤 150 샘플 기준 커버리지)**

| 필드 | 커버리지 | 비고 |
|---|---|---|
| 다음 실적일 `earningsTimestampStart/End` | 95% | Start≠End면 Yahoo가 구간으로만 아는 상태 |
| 직전 실적일 `earningsTimestamp` | — | **과거 값일 수 있다(24%)**. 방금 끝난 실적일이기도 하다 |
| **`isEarningsDateEstimate`** | **97%** | **회사 공시 vs Yahoo 추정 구분. 전 소스 통틀어 Yahoo만 제공** |
| 세션 BMO/AMC | 날짜 있는 행의 **100%** | 단 `08:30`/`16:00` ET 두 값으로 **정규화된 라벨**. 실제 시각 아님 |
| EPS 컨센 avg / low / high | 83% | 범위까지 주는 건 Yahoo뿐 |
| **매출 컨센 avg / low / high** | **88%** | **Nasdaq에 없는 필드** |
| 애널리스트 수 (EPS/매출 각각) | 88% | |
| 작년 동기 EPS | 88% | |
| 추정치 30일 상향/하향 건수 | 88% | 실적 전 심리 지표 |
| 회계기간 종료일 | 88% | 날짜 값이므로 ET 변환 금지(하루 밀림) |

**과거 4분기 — `earnings.earningsChart.quarterly` (2026-08-05 정정, 처음엔 "Yahoo는 실적값을 안 준다"고 잘못 적었음)**

`calendarEvents`만 보고 "Yahoo는 실적 실제값·서프라이즈를 안 준다"고 단정했으나 **틀렸다.** 다른 모듈에 다 있다.

| 필드 | 내용 |
|---|---|
| `actual` / `estimate` / `surprisePct` | 실제 EPS, 당시 컨센서스, 서프라이즈 % |
| **`reportedDate`** | **실제 발표 시각 (epoch, 분 단위 정밀도)** |
| `periodEndDate`, `fiscalQuarter` | 회계분기 |
| `earningsHistory.history` | 같은 4분기를 `epsDifference`/`surprisePercent`로 한 번 더 제공 (발표일 없음) |
| `earnings.financialsChart.quarterly` | 분기 **매출 + 순이익 + 이익률** 3~4개 |

```
AAPL 2Q2026  actual=2.02  est=1.89243  surprise=6.74%   reportedDate=2026-07-30 16:30 ET
JPM  2Q2026  actual=6.14  est=5.79998  surprise=5.86%   reportedDate=2026-07-14 06:30 ET
DOCS 1Q2026  actual=0.26  est=0.28238  surprise=-7.93%  reportedDate=2026-05-13 16:01 ET
```

**정확도 실측**

| 검증 | 결과 |
|---|---|
| `reportedDate` **날짜** vs Nasdaq 1년 스윕 (60티커 240분기) | **정확 일치 233 (97%)** / ±1일 4 (2%) / ±2~5일 1 / 불일치 2 |
| `reportedDate` **세션(BMO/AMC)** vs SEC EDGAR 8-K 2.02 (15티커 57분기) | **일치 50 (88%)** / 불일치 7 |

불일치 7건의 성격:
- **ZETA 3건** — Yahoo가 다음날 `08:00~08:01`을 찍는다(벤더 배치 타임스탬프). EDGAR 기준 전날 16:05 AMC인데 Yahoo는 BMO로 오분류. **이게 진짜 오류.**
- **AVAV 3건** — Yahoo `16:02~16:10`(AMC) vs EDGAR `MIDDAY`. 둘 다 "종가 무렵"을 가리키며 16:00 경계에서 버킷만 갈린 것. 실질 오류로 보기 어렵다.

→ **실오류율 약 5%.** `reportedDate` 시각이 `08:00±5분`이고 전날에 EDGAR 8-K가 있으면 배치 아티팩트로 의심할 것.

**제공하지 않는 것**

| 없는 것 | 실측 근거 |
|---|---|
| **기간 열거** | 날짜범위 API(`/v1/finance/visualization`, `entityIdType:earnings`)의 2026년 데이터가 비어 있음. 2026-08-04 **23건·전부 해외종목**, 08-05 **0건**, 06-01 **0건**. (2025-05-07은 250건 정상 → 아카이브가 2025 중반에서 멈춤) |
| **4분기보다 오래된 이력** | `earningsChart.quarterly`는 항상 4개 |
| 시가총액 (실적 맥락) | |
| 발표 예정 종목의 **목록** | 티커를 알아야 물어볼 수 있다 |

**함정**

1. `earningsTimestamp`가 과거일 수 있다 → `Start` 우선 채택하되, **과거/미래를 각각 1건씩 분리**해야 방금 끝난 실적을 잃지 않는다 (설계 결함 #2).
2. `isEstimate=true`면 **날짜 자체가 추측**이다. 46~90일 구간은 84%가 추정 (§1-5-1).
3. 비공식 API. 2,283종목 연속 호출 시 429/차단 여부 **미검증**.

### 1-6-3. Nasdaq — 날짜 축

**접근 방법 / 비용**

```
GET https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD   (키 불필요, UA 헤더 필요)
1요청 = 1일. 주말 제외.  실측: 66영업일(3개월) 동시성 6 → 0.6초, 실패 0
```

**제공 필드**

| 필드 | 커버리지 | 비고 |
|---|---|---|
| 그 날 발표하는 **시장 전체** | D+1 **566개사** | 유니버스 필터는 우리가 건다 |
| 심볼 / 회사명 | 100% | |
| 시가총액 | **100%** | |
| **애널리스트 수 `noOfEsts`** | **96%** | **전 소스 중 최고** |
| EPS 예상치 `epsForecast` | 81% | |
| 회계분기 `fiscalQuarterEnding` | — | 예: `Jun/2026` |
| **실적 실제값 `eps`** | 과거 날짜에서 유지 | **Yahoo가 못 주는 것.** ZETA 8/4 `$0.03` |
| **서프라이즈 % `surprise`** | 과거 날짜에서 유지 | ZETA `+200%` |
| 작년 발표일 / 작년 EPS | — | |
| 세션 `time` | D+1 **79%** | pre-market / after-hours |

**제공하지 않는 것**

| 없는 것 | 실측 근거 |
|---|---|
| **매출 컨센서스** | 응답 필드에 아예 없음 |
| **확정/추정 구분** | 없음 |
| **과거 날짜의 세션** | 날짜가 지나면 `time`을 지운다. 2026-07-30 조회 시 297건 중 **292건이 `time-not-supplied`** |
| **2주 넘는 미래** | D+1 566 → D+8 393 → **D+15 28** → D+29 41. 회사가 IR로 2~4주 전에나 공시하기 때문 (§1-5-1) |

**커버리지 실측 (2026-06-01 ~ 2026-08-31)**

```
66영업일 스윕 → 시장 전체 4,746건
             → default universe 매칭 2,134건 / 2,099 티커  (유니버스 2,283의 92%)
             → 그중 실적 실제값 보유 932건, 세션 보유 780건
```

### 1-6-4. 한눈에 보는 상호 보완

| | Yahoo | Nasdaq |
|---|---|---|
| 질의 축 | 티커 (알고 있는 종목만) | 날짜 (그 날 전체) |
| **기간 전체 열거 / 종목 목록** | ❌ | ✅ |
| 미래 시야 | 다음 1건 (수개월 앞까지) | **2주** |
| 과거 시야 | **4분기** | 무제한 (일자별) |
| 확정/추정 구분 | ✅ **유일** | ❌ |
| 실적 실제값·서프라이즈 | ✅ 4분기 | ✅ 기간 전체 |
| **과거 발표 시각(분 단위)** | ✅ **유일** (날짜 97%, 세션 88%) | ❌ (지워짐) |
| 매출 컨센 | ✅ **유일**(무료 중) | ❌ |
| EPS 컨센 | ✅ 범위(low~high)까지 | ✅ 값만 |
| 분기 매출·순이익 실적 | ✅ 3~4분기 | ❌ |
| 애널리스트 수 | 88% | **96%** |
| 미래 세션 | 100%(08:30/16:00 라벨) | 79% |
| 시가총액 | ❌ | ✅ 100% |
| 비용 | 35초 ~ 12분 | 3개월 0.6초 / **1년 10.4초** |

### 1-6-5. 필드별 채택 우선순위 (구현 규칙)

| 필드 | 1순위 | 2순위 | 근거 |
|---|---|---|---|
| 발표일 — 과거 | **Nasdaq** | Yahoo 직전 1건 | 이미 일어난 사실. 기간 전체를 열거할 수 있는 유일한 소스 |
| 발표일 — 미래 ≤2주 | **Nasdaq** | Yahoo | Nasdaq 목록은 Yahoo 기준으로도 85%가 확정 (§1-5-1) |
| 발표일 — 미래 >2주 | **Yahoo** | — | Nasdaq 커버리지 없음 |
| 확정/추정 플래그 | **Yahoo** | — | 유일 |
| 세션 — 과거 **최근 4분기** | **Yahoo `reportedDate`** | SEC EDGAR | Yahoo가 분 단위 시각 제공(세션 88%). 이미 Precise 호출에 포함돼 추가 비용 0 |
| 세션 — 과거 **4분기 이전** | **SEC EDGAR** | PR-time 추론 | Yahoo 이력이 4개까지라 그 이전은 EDGAR만 |
| 세션 — 미래 | **Yahoo** | Nasdaq | Yahoo 100%(라벨) > Nasdaq 79% |
| EPS 컨센 (범위 포함) | **Yahoo** | Nasdaq `epsForecast` | |
| 매출 컨센 | **Yahoo** | — | Nasdaq 없음 |
| 애널리스트 수 | **Nasdaq** 96% | Yahoo 88% | |
| 실적 실제값 / 서프라이즈 — 최근 4분기 | **Yahoo** | Nasdaq | 값은 동일. Yahoo가 시각까지 같이 줌 |
| 실적 실제값 / 서프라이즈 — 그 이전 | **Nasdaq** | — | Yahoo 이력 한계 |
| 분기 매출·순이익 실적 | **Yahoo** `financialsChart` | — | |
| 시가총액 | **Nasdaq** | company_profiles | |

> **`reportedDate` 사용 시 가드**: 시각이 `08:00±5분`이면서 전날에 EDGAR 8-K(2.02)가 있으면
> 벤더 배치 타임스탬프일 가능성이 높다(ZETA 사례). 이 경우 EDGAR 값을 우선한다.

**쓰기 규칙**: `reconcileNasdaqEarnings()`는 **빈 칸만 채우고 기존 값을 덮지 않는다.**
따라서 Nasdaq 스윕을 먼저 돌리고 Yahoo를 나중에 얹으면, 겹치는 필드는 Yahoo 값이 살아남는다.
반대로 Nasdaq만 가진 필드(실적값·서프라이즈·시총)는 Yahoo 패스가 건드리지 않는다.

### 1-6-6. 실행 순서 (두 버튼 공통)

```
0단계  Nasdaq 일자별 스윕      지정 기간 전체 열거 + 실적값/서프라이즈/시총/애널수
1단계  Yahoo quote() 배치      다음 실적일 + 확정/추정 + 세션          (전 유니버스 35~55초)
2단계  Yahoo quoteSummary      EPS·매출 컨센 + 범위 + 추정치 수정건수  (Precise 버튼만, 범위 내 종목)
후속   SEC EDGAR 8-K 2.02      과거 세션 정답지                        ← 미구현
```

---

## 2. ver2 설계

### 2-1. 소스 계층 (역할 분리) — **REVISED 2026-08-05: 주 소스를 FMP → Yahoo로 교체**

| 계층 | 소스 | 담당 필드 | 호출량 |
|---|---|---|---|
| **A. 권위 (미래 날짜 + 확정여부 + estimate)** | **Yahoo** `quoteSummary(calendarEvents, earningsTrend)` | report_date, **is_date_estimate**, session(BMO/AMC), eps_est, revenue_est, **analyst_count** | 티커당 1회 (2,283) ≈ 12분 |
| **B. 세션/컨센서스 보강** | Nasdaq daily sweep (D~D+14) | time_of_day 교차검증, no_of_ests, market_cap, fiscal_quarter_ending | 일 15회 |
| **C. 광범위 누락 탐지** | Alpha Vantage 3month CSV | A가 놓친 티커 탐지, fiscal_date_ending | **1회** |
| **D. 과거 실제 발표 시각** | **SEC EDGAR** 8-K item 2.02 `acceptanceDateTime` | 과거 time_of_day 정답지 | 티커당 1회 (백필 시 1회성) |
| **E. 과거 실적 숫자 크로스체크** | FMP `/stable/earnings?symbol=` (강등) | eps_actual, revenue_actual 검증용 | 선택 |

**A계층은 2단으로 쪼갠다 (실측 기반, 비용 20배 차이)**

| Tier | 호출 | 실측 | 얻는 것 | 실행 빈도 |
|---|---|---|---|---|
| **A1 (싸다)** | `quote(batch 50)` | **150 티커 = 3요청 2.3초** → 2,283 티커 ≈ **46요청 35초** | `earningsTimestamp` 89%, `earningsTimestampStart/End`, **`isEarningsDateEstimate` 97%** | 매 버튼 + 매일 |
| **A2 (비싸다)** | `quoteSummary` 티커별 | **326ms/종목** → 2,283 ≈ 12분 | eps_est 83%, revenue_est 88%, analyst_count 88% | reconcile 범위에 드는 티커만 |

- A1로 **전 유니버스의 다음 날짜/확정여부**를 먼저 확정하고, A2는 그 결과 **범위 안에 드는 티커에만** 돌린다.

**A2 대상 비율 실측 (표본 150 → 2,283 환산)**

| reconcile 범위 | 대상 비율 | 대상 수 | A2 소요 |
|---|---|---|---|
| 0~14일 | 27% | ~609 | 3.3분 |
| 0~30일 | 30% | ~685 | 3.7분 |
| **0~90일 (next 3 month)** | **71%** | **~1,629** | **8.8분** |
| 0~180일 | 73% | ~1,674 | 9.1분 |

> **중요 — 3개월 창에서는 A1/A2 분리가 시간을 거의 못 줄인다.** 실적은 분기 단위이므로 90일 창에는 원칙적으로 전 종목이 한 번씩 들어온다. 71%에 그치는 건 순전히 1-5-2의 stale 과거 날짜(23%) 때문이고, 90일→180일로 넓혀도 71%→73%로 거의 안 늘어난다(= 이미 다 포함됨). 따라서 `Next 3 Months` 버튼의 실제 비용은 **35초 + 8.8분 ≈ 9분**이며, `Sync Universe`(12분)와 큰 차이가 없다.

**그럼에도 A1/A2를 분리하는 이유** (시간 절약이 아님):
1. **날짜 변경 감지를 35초에 전량 돌릴 수 있다.** 요구사항 4(변경 시 수정)의 핵심 루프가 A1만으로 완결된다 → 매일 자동 실행이 현실적.
2. 좁은 범위(2주 = 3.3분)에서는 실제로 크게 절약된다 → `Custom Update`의 주 사용 패턴.
3. 추정치 갱신(A2)을 날짜 갱신과 **다른 주기로** 돌릴 수 있다. 컨센서스는 날짜만큼 자주 안 바뀐다.
- 날짜 추출 주의: `earningsTimestamp`가 **과거 값일 수 있다** (실측 ASUR: ts=2026-07-30(과거) / start=2026-10-29(미래)). → `earningsTimestampStart`와 `earningsTimestamp`를 **미래 1건 / 과거 1건으로 분리**해 둘 다 내보낸다 (설계 결함 #2에서 수정).
- `earningsTimestampStart != End`이면 Yahoo가 **날짜 구간으로만 아는 상태** → `is_date_estimate`와 동일하게 잠정 처리.

**우선순위 규칙 → §1-6-5 표가 확정판이다.** 요약하면:
- **기간 전체 열거 = Nasdaq이 유일.** Yahoo는 티커당 2건뿐이라 기간을 채울 수 없다 (설계 결함 #3).
- **확정/추정 플래그 = Yahoo가 유일.**
- Nasdaq 스윕은 **빈 칸만 채우고 기존 값을 덮지 않는다.** 그래서 Nasdaq → Yahoo 순으로 실행하면 겹치는 필드는 Yahoo가 이기고, Nasdaq 전용 필드(실적값·서프라이즈·시총)는 보존된다.
- **FMP는 코드에서 제거한다.** range·per-symbol 모두 메가캡 화이트리스트로 막혀 있다 (§1-2 정정).

### 2-2. 아이덴티티 & 변경 반영 (요구사항 4의 핵심)

**per-ticker reconcile 방식으로 전환한다.**

범위 기반 선삭제를 버리고, 티커 단위로 "가져온 다음 날짜"와 "DB에 있는 날짜"를 대조한다.

> **주의 — Yahoo는 FMP와 달리 "다음 1회"만 준다.** FMP per-symbol은 전체 스케줄 배열을 주지만 Yahoo `calendarEvents`는 다음 실적일 1건이다. 따라서 "가져온 집합 − 저장된 집합 = 삭제"라는 단순 차집합을 쓸 수 없다. 아래처럼 **다음 1건만 권위로 인정**하고 그 이후 분기는 건드리지 않는다.

티커 T, reconcile 범위 R(=버튼별 from~to)에 대해:

```
next_yahoo = A1(quote batch)의 earningsTimestampStart  (미래 값 우선)
is_est     = isEarningsDateEstimate
stored_fut = SELECT ... WHERE ticker=T AND event_at >= today ORDER BY event_at

d0 = stored_fut의 첫 행 (가장 가까운 미래)

if d0 없음                        → INSERT (next_yahoo)
elif d0.date == next_yahoo        → UPDATE (estimate/analyst/세션 갱신, time_of_day 보존)
elif |d0.date - next_yahoo| <= 45 → MOVE  (d0 row 재사용, event_at/unique_key 재작성 + 변경 이력)
elif next_yahoo < d0.date         → INSERT (신규 분기가 앞에 생김) + d0는 유지
else                              → d0를 stale 후보로 마킹 (자동 삭제 금지, 리포트만)

stored_fut[1:] (그 이후 분기들)   → Yahoo가 확인해 주지 못하므로 verified=false 로만 표시, 삭제하지 않음
```

- **자동 DELETE는 하지 않는다.** Yahoo가 "다음 1건"만 주는 이상, 안 나온 행이 취소된 건지 Yahoo가 모르는 건지 구분 불가하기 때문. 기존 47쌍 유령 정리는 **P4 마이그레이션에서 1회성으로** 처리하고, 상시 운영에서는 `stale 후보` 리포트 → 사용자 확인 후 삭제.
- `is_est=true`인 날짜로는 **MOVE를 실행하지 않는다** (추정 날짜가 확정 날짜를 밀어내는 사고 방지). 리포트만.

**이동 후보 판정 규칙 (초안 — 검토 필요)**
- fetched에 없는 stored 날짜 s, stored에 없는 fetched 날짜 f에 대해 `|s - f| <= 45일`이고 그 구간에 다른 확정 row가 없으면 **같은 분기의 이동**으로 본다.
- 45일 근거: 1-3 실측에서 이동 47쌍이 전부 ≤45일, 정상 분기쌍 6건은 전부 >45일로 깨끗하게 갈렸다.
- 가능하면 AV `fiscalDateEnding` / Finnhub `quarter+year`를 join해 **분기 라벨로 확정**하고, 없을 때만 45일 휴리스틱으로 폴백.

**unique_key 변경**
- ver1: `FMP:earnings:{TICKER}:{DATE}` — 날짜가 키에 있어 이동 = 새 row.
- ver2: `FMPQ:earnings:{TICKER}:{FISCAL_PERIOD}` (예: `FMPQ:earnings:AAPL:2026Q3`). fiscal period를 못 구하면 `...:{ANCHOR_DATE}`로 두되 **이동 시 키를 재작성**한다.
- 기존 `FMP:` 키 row는 마이그레이션 스크립트로 재키잉 (아래 5-1).

**time_of_day 보존 (중요)**
- ver1의 delete→insert 경로는 `upsertCalendarEvent`의 COALESCE 보존을 **우회**한다. row 자체가 지워지므로 Yahoo/PR-time으로 채운 BMO/AMC가 날아간다.
- ver2는 **DELETE를 reconcile 잔여분에만** 쓰고, 나머지는 전부 UPDATE 경로 → 보존이 실제로 동작한다. MOVE 시에도 `time_of_day`/`session`은 **버린다** (날짜가 바뀌면 세션도 재확인 대상이므로 `time_of_day_source='stale_moved'`로 마킹 후 B/C 계층이 다시 채움).

### 2-3. 변경 이력

`calendar_events.meta_json`에 누적 기록:

```json
{
  "date_changed_at": "2026-08-05T09:00:00.000Z",
  "previous_report_date": "2026-08-10",
  "change_count": 2,
  "estimate_revised_at": "2026-08-05T09:00:00.000Z",
  "previous_eps_est": 0.15
}
```

- 별도 테이블 대신 meta에 최근 1건 + 카운트만 둔다 (21GB DB에 테이블 추가 부담 회피).
- CalendarWindow에 `Date Changed` 배지 / `Prev Date` 컬럼을 selectable column으로 노출.

### 2-4. 버튼 3종

**명칭 확정 (사용자 지정)** — A1/A2 대신 아래 이름을 쓴다.

| 내부 계층 | 정식 명칭 | 하는 일 |
|---|---|---|
| A1 | **Yahoo Just Earning Date Fix** | 날짜 + 확정/추정 플래그 + 세션만 |
| A2 | **Yahoo Earning Precise Update** | 위 전부 + EPS/매출 컨센, 애널리스트 수, 추정치 수정 건수 |

각각 `Next 3 Months` / `Custom` 두 scope를 가져 **총 4개 버튼**.

| # | 버튼 | scope 범위 | A1 실행 | A2 실행 | 예상 시간 |
|---|---|---|---|---|---|
| 1 | **Yahoo Date Fix · Next 3M** | today ~ +90d | 2,283 전체 (46요청) | — | **~35-55초** |
| 2 | **Yahoo Date Fix · Custom** | 필터의 from~to | 2,283 전체 (46요청) | — | ~35-55초 |
| 3 | **Yahoo Precise · Next 3M** | today ~ +90d | 2,283 전체 | 90일 내 (~1,629, **71%**) | 35초 + 8.8분 |
| 4 | **Yahoo Precise · Custom** | 필터의 from~to | 2,283 전체 | 범위 내 (2주면 ~609, 27%) | 35초 + 3.3분~ |

- **A1은 4개 버튼 모두에서 항상 전량 실행**한다. 35초밖에 안 걸리고, 날짜가 어디로 이동했는지 알려면 전량이 필요하다.
- scope 범위는 "무엇을 받아올지"가 아니라 **"A2를 어디까지 돌리고 어느 구간의 stale을 판정할지"** 를 정하는 값이다.
- `Custom`은 CalendarWindow 상단 날짜 필터(from/to)를 명시적으로 읽는다. `Next 3M`은 필터를 **참조하지 않는다** (1-4-(4) 결함 차단).

- 3개 버튼 모두 **같은 엔진**(per-ticker reconcile)을 쓰고 `scope`만 다르다.
- 버튼 2/3은 실행 후 자동으로 **B 계층(Nasdaq sweep)** 을 이어 돌려 BMO/AMC를 채운다 (옵션 토글).
- **버튼 2는 화면 date filter를 참조하지 않는다** (ver1의 1-4-(4) 결함 차단). 버튼 3만 명시적 입력을 받는다.

### 2-5. API 계약

**구현 완료 (2026-08-05)**

```
POST /api/yahoo/calendar/earnings/date-fix
POST /api/yahoo/calendar/earnings/precise-update
  body: { scope: "next3m" | "custom",
          from?: "YYYY-MM-DD", to?: "YYYY-MM-DD",   // custom 필수
          concurrency?: 1..20 }                      // precise-update만 사용
  res:  { jobId, scope, range: {from,to}, targetTickers }
```

job 결과 요약 필드: `fetchedFuture, droppedPastDate, failedTickers, inScope, inserted, updated, moved, insertedAhead, skippedEstimate, staleFlagged, estimatesApplied, moves[], staleCandidates[]`.

`update_status` 키: `yahoo_calendar_earnings_datefix`, `yahoo_calendar_earnings_precise` (기존 `fmp_calendar_earnings`와 분리).

**미구현 (후속)**

```
POST /api/yahoo/calendar/earnings/preflight     → 이동/신규 예상 건수만 (쓰기 없음)
POST /api/calendar/earnings/session-sweep       → Nasdaq D~D+14 스냅샷
```

### 2-6. UI (CalendarWindow, `activeType==='earnings'`)

**구현 완료 (2026-08-05)**

- 업데이트 버튼이 많고 이름이 길어 **`Update Tools` 토글로 접기/펼치기**를 넣었다.
  - 기본 접힘. 상태는 `localStorage['calendar-show-update-tools']`에 저장 → 창을 다시 열어도 유지.
  - 토글 대상: earnings 4종 + `Update FMP Earnings Dates` + `Sync Financial + Past Estimates` + `FMP Sync Settings` + IPO 2종 + `Update Yahoo Desc`.
  - 접혀 있어도 필터(검색/날짜/워치리스트/산업/Columns/Reset)는 항상 보인다.
- 버튼 색 구분: Date Fix = teal, Precise = violet, 기존 FMP = blue.
- `Custom` 버튼은 from/to가 비어 있으면 비활성 + 툴팁으로 안내.

**미구현 (후속)**

- 신규 컬럼: `Prev Date`, `Changed`, `# Analysts`, `Date Confirmed`, `EPS Est Range`, `Revisions ↓30d`.
- 실행 전 preflight 결과(이동 M / 신규 K)를 모달로 확인.
- stale 후보 리뷰 UI (자동 삭제를 안 하므로 사용자가 확인할 화면이 필요).

---

## 3. 구현 단계

| Phase | 내용 | 산출물 |
|---|---|---|
| **P0** | ~~FMP per-symbol 커버리지 측정~~ → **완료 (1-5). Yahoo 150 샘플 실측으로 대체됨.** 남은 확인: 전량 2,283 A1 배치 실행 시 Yahoo rate limit / 429 발생 여부 | `raw_data/yahoo_universe_a1.csv` |
| **P1** ✅ | `yahooEarningsProvider.ts` — A1(quote batch 50) + A2(quoteSummary) + 재시도/스로틀 | 완료 |
| **P2** ✅ | `yahooEarningsReconciler.ts` — 대조, MOVE 판정, 변경 이력 기록 | 완료 (단위 테스트 미작성) |
| **P3** ✅ | `date-fix` / `precise-update` 엔드포인트, job 요약 | 완료 (`server.ts`) |
| **P4** | 유령 row 47쌍 정리 마이그레이션 (dry-run 우선) | **부분 해소** — reconciler가 실행 중 자동 병합(`mergedDuplicates`). 일괄 스크립트는 미착수 |
| **P5** ✅ | CalendarWindow 버튼 4종 + `Update Tools` 접기 | 완료 (신규 컬럼은 미착수) |
| **P6** ✅ | **Nasdaq 기간 스윕** (`nasdaqEarningsCalendarProvider.ts` + `reconcileNasdaqEarnings`) | 완료. 두 엔드포인트의 0단계로 배선 |
| **P8** | **SEC EDGAR 8-K 2.02 세션 백필** — 과거 세션 37%밖에 안 참 | 미착수 (다음 작업) |
| **P7** | 검증 (아래 4) | **미착수 — 실 DB에 아직 한 번도 실행하지 않음** |

**P1~P3 검증 로그 (2026-08-05, DB 쓰기 없이 provider만)**

```
[date-fix] 8종목 1,379ms → 결과 7 / 과거폐기 0 / 실패 1(ZZZZNOTREAL, 존재하지 않는 티커)
  AAPL 2026-10-29 AMC confirmed=false     ← 추정 날짜
  JPM  2026-10-13 BMO confirmed=true      ← 회사 공시
  DOCS 2026-08-06 AMC confirmed=true
  ASUR 2026-10-29 AMC confirmed=false     ← 과거값(2026-07-30) 대신 Start 채택, 가드 정상 동작
[precise] 2종목 693ms
  DOCS: eps=0.30268 (0.28~0.33) rev=151,726,660 analysts=18 down30d=13 fq=2026-06-30
  AAPL: eps=1.97643 (1.93~2.04) rev=113,256,580,210 analysts=28 down30d=1 fq=2026-09-30
```

backend `tsc --noEmit` 통과, frontend `vite build` 통과.

**첫 실행 실패 → 버그 3건 수정 (2026-08-05)**

`Yahoo Earning Precise Update (2026-06-01~2026-08-31)` 최초 실행이 fetch 완료 후 reconcile 단계에서 실패:

```
SQLITE_CONSTRAINT: UNIQUE constraint failed: calendar_events.event_type, calendar_events.unique_key
```

원인과 수정:

| # | 버그 | 내용 | 수정 |
|---|---|---|---|
| 1 | **MOVE 목적지 충돌** | 1-3의 유령 47쌍이 그대로 원인. AKTS는 `08-10`·`09-02` 두 FMP row 보유 → Yahoo 확정일 `09-02`로 `08-10` row를 MOVE하려니 `FMP:earnings:AKTS:2026-09-02` 키가 이미 존재 | 목적지에 같은 티커 row가 있으면 **그 row로 병합**하고 d0는 삭제(실적 없을 때) 또는 stale 표시(실적 있을 때). `mergedDuplicates`로 집계 |
| 2 | **unique_key prefix 충돌** | 신규 INSERT가 `YAHOO:earnings:...`를 쓰는데 이는 **`yahoo_hist` 49,834행이 이미 쓰는 형식**. custom 범위가 2015~2023을 덮으면 ON CONFLICT로 과거 row를 덮어쓸 수 있었다 | ver2 전용 prefix `YAHOO2:` 로 분리. MOVE 시 키는 `rekeyUniqueKey()`로 **원본 prefix를 보존**하고 날짜만 교체 |
| 3 | **실적값 누출** (재현 테스트에서 발견) | 병합 시 d0의 `eps_actual`을 목적지로 복사 → 이미 발표가 끝난 08-11의 실적이 미래 09-02 row로 번짐 | d0에 실적이 있으면 "옮겨진 같은 이벤트"가 아니라 **별개의 완료 이벤트**로 보고 아무것도 복사하지 않음. 삭제도 안 함 |

추가 개선: reconcile 루프를 **티커 단위 try/catch**로 감쌌다. 이전에는 1건 실패로 트랜잭션 전체가 롤백돼 9분짜리 fetch 결과가 통째로 날아갔다. 이제 실패 건만 `errors`/`errorSamples`로 리포트하고 나머지는 커밋된다.

**데이터 영향 없음** — 실패한 실행은 단일 트랜잭션이라 전량 롤백됐다. 확인: `source='YAHOO'` 0건, `date_source='yahoo'` 0건, `stale_candidate` 0건.

**재현 테스트 (임시 DB, `SQLITE_PATH` 오버라이드)**

```
시나리오 5종 → inserted=1 moved=1 mergedDuplicates=1 staleFlagged=1 skippedEstimate=1 errors=0
 AKTS  08-10+09-02 유령쌍 → 08-10 삭제, 09-02 유지 (tod=AMC 승계, prev=2026-08-10)   ✅ 원래 실패 케이스
 MOVE1 08-20 → 08-27 단순 이동, key prefix 보존                                      ✅
 KEEP1 08-11(eps_actual=1.23) → 삭제 안 함 + stale 표시, 09-02로 실적 누출 없음        ✅
 NEW1  신규 INSERT, key=YAHOO2:earnings:NEW1:2026-09-10                              ✅
 EST1  Yahoo 추정일로는 이동하지 않음 (skippedEstimate)                                ✅
```

---

### 설계 결함 #2 — Custom 범위의 과거 구간이 무의미했다 (2026-08-05, ZETA 사례)

**증상**: 사용자가 `Yahoo Precise Update · Custom (2026-06-01 ~ 2026-08-31)`을 실행했는데, **2026-08-04에 발표한 ZETA가 들어오지 않았다.**

**사실 확인**
- ZETA는 실제로 2026-08-04 발표. Nasdaq: EPS 실적 `$0.03` vs 예상 `$0.01` (+200%). SEC EDGAR 8-K item 2.02 접수 `2026-08-04 16:05 ET` → AMC.
- DB의 ZETA 최신 row는 `2026-04-30`. 08-04 없음.

**원인 (2중)**
1. FMP가 ZETA를 아예 못 준다 (아래 §1-2 정정 참고) → 기존 인제스트 경로로는 애초에 못 들어옴.
2. **ver2 코드도 과거 날짜를 구조적으로 만들 수 없었다.** `fetchYahooEarningsDates`가 `earningsTimestampStart`와 `earningsTimestamp` 중 **더 미래인 값 하나만** 채택하고, 그마저 `< today`면 버렸다.
   ```
   ZETA: earningsTimestamp=2026-08-04(어제 발표 완료), earningsTimestampStart=2026-11-03(다음, 추정)
   기존 코드 → max 취해 11-03만 남기고 08-04 폐기
   ```
   즉 Custom이 `from`을 과거로 받고 로그에 `range=2026-06-01~2026-08-31`을 찍으면서, **오늘 이전 날짜는 절대 쓸 수 없는** 상태였다. 과거 구간 지정이 아무 의미가 없었다.

**수정**
- `fetchYahooEarningsDates`가 티커당 **최대 2건**을 반환한다: 가장 이른 미래(`isPastEvent=false`) + 가장 늦은 과거(`isPastEvent=true`). 범위 필터는 호출자가 하므로 `next3m`은 자동으로 미래만 남는다.
- 과거 이벤트(`isPastEvent`)는 reconciler에서 **별도 경로**로 처리: 그 날짜의 row만 생성/갱신하고 **MOVE·삭제·추정치 적용을 하지 않는다.** (컨센서스는 "다음 분기" 기준이라 지나간 분기 row에 붙이면 틀린 값이 된다.) `date_event_state='reported'` 표시.
- 과거 이벤트는 이미 일어난 사실이므로 `date_confirmed=true`로 고정한다. Yahoo의 `isEarningsDateEstimate`는 "다음" 날짜에 대한 값이라 쓰지 않는다.
- **연쇄 버그**: custom 범위가 과거를 포함하면 `stored[0]`이 과거 row일 수 있는데, 기존 코드는 그걸 `d0`(비교 기준)로 잡았다. 그러면 지나간 실적을 미래로 MOVE시킨다. → `futureRows = stored.filter(d >= today)` 로 분리해 `d0`를 잡도록 수정.

**검증 (임시 DB, 사용자가 실제 지정한 범위 그대로)**

```
Yahoo가 준 날짜:
  ZETA 2026-11-03 isPast=false confirmed=false    ← 다음 (추정)
  ZETA 2026-08-04 isPast=true  confirmed=true AMC ← 어제 발표 완료
범위 2026-06-01~2026-08-31 내 3건 → ZETA 08-04, AAPL 07-30, NVDA 08-26
결과: inserted=1 pastInserted=2 errors=0
  ZETA 2026-08-04 YAHOO tod=AMC state=reported confirmed=1   ← EDGAR 16:05 ET 실측과 일치
```

회귀 7종 전부 통과 (`inserted=2 moved=1 mergedDuplicates=1 pastUpdated=1 staleFlagged=1 skippedEstimate=1 errors=0`).
특히 `PASTX`(과거 row 보유 + 미래 row 없음) 케이스에서 과거 row를 `d0`로 오인하지 않고 미래 row를 별도 생성함을 확인.

---

### 설계 결함 #3 — 기간 열거를 Yahoo로 하려 한 것 자체가 틀렸다 (2026-08-05)

**지적**: "설정한 기간에 있는 어닝데이트 정보 **전부**를 받아야지 왜 가장 이른 미래만 받나."

맞는 지적이고, #2의 수정(미래1+과거1)으로도 부족하다. 근본 원인은 **기간 UI를 티커당 1~2건만 주는 소스 위에 올린 것**이다.

| Yahoo 경로 | 반환량 |
|---|---|
| `quote()` | 티커당 **2건** (다음 + 직전) |
| `quoteSummary(calendarEvents)` | 티커당 **1건** (다음) |
| 날짜범위 API (`/v1/finance/visualization`, `entityIdType:earnings`) | **2026년 데이터가 비어 있음** |

날짜범위 API 실측 (cookie+crumb 정상 획득, 쿼리 정상 응답):
```
2026-08-04 →  23건 (전부 해외: 0QAH.IL, 6MK.DE, 1MRKX.MI …). ZETA 없음
2026-08-05 →   0건
2026-06-01 →   0건
2025-05-07 → 250건 (옛 구간은 살아있음)
```
※ `includeFields`에 `epsestimate`/`epsactual`을 넣으면 500 `OpenSearch IOException`. 메모리에 기록된 3필드 세트만 동작.

**결론: Yahoo로는 기간 열거가 불가능하다. Nasdaq이 담당해야 한다.**
같은 2026-08-04에 Nasdaq은 355개사를 실적·서프라이즈까지 붙여 반환한다.

**수정 — 역할 재배치**

```
기간 열거 (모든 실적) : Nasdaq 일자별 스윕   ← 신규 nasdaqEarningsCalendarProvider.ts
다음 실적 확정/컨센서스 : Yahoo quote/quoteSummary  (기존 유지)
```

- `sweepNasdaqEarningsRange({from,to,universe})` — 주말 제외 일자 열거, 동시성 4~12, 유니버스 필터
- `reconcileNasdaqEarnings()` — **MOVE 판정 없음** (날짜가 이미 사실). 티커+날짜 row를 생성/갱신만, 삭제 없음. 기존 값은 덮지 않고 빈 칸만 채운다
- 두 Custom/Next3M 엔드포인트 모두 **0단계로 Nasdaq 스윕을 먼저 실행**한 뒤 Yahoo 패스를 얹는다

**검증 (실제 Nasdaq 호출, 사용자가 지정한 범위 그대로)**

```
2026-06-01 ~ 2026-08-31, 66영업일 스윕 = 0.6초, 실패일 0
  시장 전체 4,746건 → default universe 매칭 2,134건 / 2,099 티커 (유니버스의 92%)
  반영: inserted=2134 actualsFilled=932 sessionFilled=780 errors=0

ZETA 2026-08-04  eps=0.03  est=0.01  surprise=200%  analysts=4  fq=Jun/2026
```

Yahoo 보강까지 얹은 결합 결과:
```
 AAPL 2026-07-30 NASDAQ eps=1.91 est=1.88 sur=1.6  tod=AMC(yahoo) confirmed=1
 ZETA 2026-08-04 NASDAQ eps=0.03 est=0.01 sur=200  tod=AMC(yahoo) confirmed=1
 DOCS 2026-08-06 NASDAQ eps=-    est=0.16          tod=AMC(yahoo) confirmed=1
 NVDA 2026-08-26 NASDAQ eps=-    est=2.01          tod=AMC(yahoo) confirmed=1
```

**남은 공백**: 세션 보유율 2,134행 중 782행(37%). Nasdaq이 과거 날짜의 `time`을 지우고 Yahoo는 티커당 1~2건만 커버하기 때문. → **SEC EDGAR 8-K item 2.02 접수시각**이 과거 세션의 정답지 (§1-5 D계층, ZETA 16:05 ET 검증 완료). 다음 작업.

---

**(구) 남은 공백**: 과거 row는 **날짜·세션만** 채워진다. 실적 숫자(eps_actual/revenue_actual)는 아직 아무 소스도 안 붙였다.
Yahoo `earningsHistory`는 발표 직후엔 아직 갱신 전이고(ZETA는 2026-03-31 분기까지만 보유), Nasdaq 과거 날짜 조회에는 실적·서프라이즈가 남아 있다(ZETA 08-04 `$0.03`/+200% 확인). → **Nasdaq 과거 스윕이 다음 작업.**

**P0 → P1 사이에 게이트**: P0에서 per-symbol 커버리지가 낮게 나오면(예 <70%) 소스 전략을 AV/Nasdaq 우선으로 뒤집어야 하므로 그 전까지 P1 착수 금지.

---

## 4. 검증 기준 (완료 판정)

1. 유령 row: 미래 구간 "동일 티커 ≤45일 간격 중복쌍" **47 → 0**.
2. 커버리지: default universe 중 미래 earnings 날짜 보유 티커 **715 → 목표 1,800+** (P0 측정치에 따라 확정).
3. 멱등성: 같은 버튼 2회 연속 실행 → 2회차 `inserted=0, moved=0, deleted=0`, `updated`는 last_updated 변화분만.
4. 이동 반영: 임의 티커 1개의 stored 날짜를 인위적으로 +10일 틀어놓고 sync → `moved=1`, row 1개 유지, `previous_report_date` 기록됨.
5. 보존: sync 후 `time_of_day`가 이미 있던 row의 값이 **유실 0건**.
6. 실패 안전성: 네트워크 차단 상태로 sync → `deleted=0` (fetch 실패 티커는 절대 삭제하지 않음).

---

## 5. 마이그레이션 / 롤백

- P4 스크립트는 `--dry-run` 기본. 실행 전 `calendar_events` 중 `event_type='earnings' AND source LIKE 'FMP%'` 를 `raw_data/earnings_backup_YYYYMMDD.csv`로 덤프.
- 롤백: 덤프 CSV로 복원 + `DELETE FROM calendar_events WHERE source='FMPQ'`.
- `yahoo_hist` 49,834행은 **건드리지 않는다** (source 기준으로 완전 분리).

---

## 6. 미해결 / 결정 필요 (착수 전 확인)

1. ~~FMP 플랜 정상 여부~~ → **해소.** 주 소스를 Yahoo로 교체했으므로 FMP range 상태와 무관해짐. 단 FMP 구독을 유지할지(과거 크로스체크 용도만 남음) 비용 판단 필요.
2. ~~`confirmed` 정의~~ → **해소.** Yahoo `isEarningsDateEstimate`(실측 97% 커버)를 `date_confirmed` 필드로 그대로 채택. 기존 `confirmed`(=`epsActual != null`)는 **의미가 다르므로** `reported`로 이름을 바꾸고 두 필드를 분리한다.
3. **Yahoo rate limit / 차단** — 무공식 API이므로 2,283 배치 연속 호출 시 429·crumb 만료·IP 차단 가능성 미확인. **P0에서 반드시 측정.** 차단 시 폴백은 Nasdaq(D+14) + Alpha Vantage(3개월)이며, 이 조합은 확정/추정 구분을 잃는다는 점을 감수해야 한다.
3-1. **Yahoo는 다음 1건만 준다** — 2-2에 반영. 그 이후 분기 데이터는 어느 무료 소스도 티커 단위로 주지 않는다. 3개월 이후 구간은 Alpha Vantage(C)로만 부분 확인 가능.
4. **`event_at` 시각 표현** — 현재 전부 `T12:00:00.000Z` 고정. BMO/AMC를 알게 된 뒤에도 이 값을 유지할지, 실제 ET 시각으로 바꿀지 결정 필요 (바꾸면 기존 date filter/정렬/UI에 영향).
5. **신규 상장/티커 변경** — universe에 나중에 추가된 티커의 최초 pull 경로 (`__default_ticker_added_at` plan과 연계).
6. **상장폐지 티커** — per-symbol이 빈 배열을 반환할 때 "폐지"인지 "일시 오류"인지 구분 불가. 안전하게 **빈 응답 = 삭제 금지**로 두고 별도 리포트만.
7. **스케줄 자동화** — 버튼 수동 실행 외에 Nasdaq sweep을 매일 자동으로 돌릴지 (미래 시점에만 세션이 남으므로 자동화 가치가 큼).
