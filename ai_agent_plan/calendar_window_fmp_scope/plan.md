### 목표

- `calendar window` 관련 작업을 시작하기 전에 현재 레포 구조와 FMP 데이터 범위를 고정한다.
- FMP에서 받을 수 있는 데이터를 `현재 레포에 이미 연결된 데이터`와 `calendar window 후보 데이터`로 나눠 정리한다.
- 구현 우선순위를 `바로 붙일 수 있는 영역`과 `결정이 필요한 영역`으로 분리해 이후 작업의 드리프트를 줄인다.
- mock calendar UI를 실데이터 기반 구조로 옮길 때 필요한 차단 요소를 미리 문서화한다.

### PLAN CHANGE #1 — 2026-04-15 범위 확장

- 사용자 추가 요구를 반영해 이번 작업의 구현 범위를 다음으로 확장한다.
  - `CalendarWindow`에서 FMP earnings-date update 버튼을 제공한다.
  - update 대상은 CSV fallback이 아니라 DB의 `default universe` ticker 기준으로 고정한다.
  - earnings row에 대해 DB 기반 `industry`, `float_pct`, `institutional_pct`, `insider_pct`를 selectable column으로 노출한다.
  - 날짜 기간 필터는 mock local filter가 아니라 `/api/calendar/events` query 기준으로 동작시킨다.
  - FMP stable earnings source에는 신뢰 가능한 `time/session`이 없으므로, 해당 값은 추정하지 않고 비워 둔다.
- phase 1 구현 우선순위는 `earnings 실사용 전환`이다.
  - dividends/splits는 기존 generic query 체계를 유지하되, 이번 변경의 직접 목표는 earnings update + earnings grid 고도화다.

### PLAN CHANGE #2 — 2026-04-15 calendar 숫자 필터 추가

- 사용자 추가 요구를 반영해 `CalendarWindow` filtering 범위를 다음으로 확장한다.
  - `[][][]institutional_pct[][][]`(`Inst %`) min/max filter를 추가한다.
  - `[][][]float_pct[][][]`(`Float %`) min/max filter를 추가한다.
  - `[][][]market_cap[][][]`(`Market Cap`) min/max filter를 추가한다.
- 이번 phase에서는 현재 `CalendarWindow`가 fetch한 row 집합에 대해 즉시 적용되는 numeric range filter로 구현한다.
  - 기존 date range처럼 backend fetch 범위를 바꾸는 filter가 아니라, loaded row에 대해 local numeric filter를 적용한다.
- live DB 확인 기준, earnings row는 `2026-04-30`까지만 있는 상태가 아니다.
  - 현재 저장된 최신 earnings row는 `2027-01-27`(`DOW`)까지 확인됐다.

### PLAN CHANGE #3 — 2026-04-15 FMP earnings snapshot replace

- 사용자 확인 질문을 반영해 FMP earnings update semantics를 명확히 수정한다.
  - 현재 `unique_key = ticker + report_date` 방식만으로는 earnings date가 변경될 때 기존 row가 자동으로 사라지지 않는다.
  - 따라서 같은 update 범위에 대해서는 기존 `source='FMP'`, `event_type='earnings'` row를 먼저 치우고 새 snapshot으로 다시 채우는 방식이 필요하다.
- 이번 수정 목표
  - 같은 범위를 재실행했을 때 stale earnings date가 남지 않게 한다.
  - 사용자가 보는 CalendarWindow가 "누적 append"가 아니라 "현재 FMP snapshot"에 더 가깝게 보이게 한다.
- 확인된 현재 동작
  - `CalendarWindow` 자체는 데이터를 일부만 잘라서 가져오는 상태가 아니다.
  - live API 기준 date filter 없이 `378` rows가 로드되고, 최신 row는 `2027-01-27`까지 확인됐다.
  - 화면 상단에 `2026-04-21`부터 보이는 것은 기본 정렬이 빠른 날짜 우선(`asc`)이기 때문이다.

### PLAN CHANGE #4 — 2026-04-15 calendar 기본 정렬 전환

- 사용자 선택에 따라 `CalendarWindow`의 기본 날짜 정렬을 빠른 날짜 우선(`asc`)에서 늦은 날짜 우선(`desc`)으로 바꾼다.
- 적용 범위
  - 초기 진입 시 기본 정렬
  - 탭 전환 시 기본 정렬
  - Reset 실행 후 기본 정렬
  - backend fetch 기본 sort parameter
- 기대 효과
  - 사용자가 최신/가장 먼 earnings date를 화면 상단에서 바로 볼 수 있다.
  - `2026-04-21`만 보여서 뒤 날짜가 없는 것처럼 보이는 오해를 줄인다.

### PLAN CHANGE #5 — 2026-04-15 date range 미지정 시 lazy load

- 사용자 추가 요구를 반영해 `CalendarWindow`는 날짜 범위를 지정하기 전에는 events fetch를 실행하지 않도록 바꾼다.
- 적용 규칙
  - `from`과 `to`가 모두 지정되기 전에는 표 데이터를 불러오지 않는다.
  - 이 상태에서는 loading spinner 대신 날짜 지정 안내 메시지를 보여준다.
  - Reset 후에도 다시 "날짜 미지정" 대기 상태로 돌아간다.
- 기대 효과
  - 창을 열자마자 수천 row를 읽어오는 초기 렉을 줄인다.
  - 사용자가 의도한 범위만 조회하게 되어 client-side sort/filter 비용도 함께 줄어든다.

### PLAN CHANGE #6 — 2026-04-15 ticker 우클릭 Financial dialog 추가

- 사용자 추가 요구를 반영해 `CalendarWindow`의 ticker 셀 interaction 범위를 다음으로 확장한다.
  - ticker 좌클릭은 기존 `onTickerClick` linked-ticker 동작을 유지한다.
  - ticker 우클릭 시 작은 context menu를 띄우고 `Financial` 액션을 제공한다.
  - `Financial` 선택 시 annual / quarterly toggle이 있는 dialog를 열고, 과거 revenue / earnings / valuation 그래프를 표시한다.
- backend data source는 FMP stable financial statement 계열로 고정한다.
  - revenue / earnings: `/stable/income-statement`
  - valuation / market cap: `/stable/key-metrics`, `/stable/ratios`
- 이번 phase의 표시 범위
  - `Revenue` chart: revenue history
  - `Earnings` chart: net income + EPS history
  - `Valuation` chart: `P/E`, `P/S` history
- 구현 제약
  - dialog는 ticker가 있는 row에서만 열린다.
  - API 응답에서 valuation ratio가 비어 있으면, 가능한 경우 `marketCap / netIncome`, `marketCap / revenue`로 fallback 계산한다.
  - FMP stable income-statement 실제 응답은 `calendarYear`가 아니라 `fiscalYear`, `period` 중심이므로 label 생성 규칙을 별도로 둔다.

### PLAN CHANGE #7 — 2026-04-15 financial history sync 버튼 + estimate overlay 추가

- 사용자 추가 요구를 반영해 financial dialog 범위를 다음으로 확장한다.
  - `default universe` 전체를 대상으로 financial history/estimate snapshot을 당기는 batch sync 버튼을 `CalendarWindow`에 추가한다.
  - ticker dialog는 actual history만이 아니라 FMP stable `analyst-estimates`를 함께 읽어 revenue / EPS / net income estimate를 가능한 범위에서 같이 표시한다.
- backend 구현 방향
  - `GET /api/calendar/financials/:ticker`는 DB cache 우선, 없으면 live fetch fallback으로 유지한다.
  - 새 batch route는 `default universe` ticker들을 순회하며 financial actual + estimate snapshot을 DB cache table에 저장한다.
- frontend 구현 방향
  - earnings 탭 툴바에 `Sync Financial History` 버튼을 추가한다.
  - financial dialog의 revenue / earnings chart에 estimate overlay를 추가하고, 요약 카드에도 estimate 값을 함께 노출한다.
- 확인된 원인
  - 현재 구현은 `income-statement`, `key-metrics`, `ratios`만 merge하므로 actual series만 존재한다.
  - estimate series는 아직 `stable/analyst-estimates`를 전혀 조회하지 않기 때문에 그래프에 표시될 데이터가 없다.

### PLAN CHANGE #8 — 2026-04-15 historical estimate 표시 보강

- 사용자의 추가 피드백을 반영해 annual financial series merge를 `date` 우선이 아니라 회계연도 기준으로 보정한다.
- 이미 cache에 들어간 annual duplicate point도 read path에서 접어 past actual + estimate가 같은 period에 함께 보이게 한다.
- earnings 화면에는 현재 범위의 `Confirmed / Pending` count를 노출해 confirmed-only 범위인지 즉시 알 수 있게 한다.
- financial dialog에는 과거 period의 actual-vs-estimate 비교표를 추가해 future-only estimate가 아니라 historical estimate도 바로 읽히게 한다.

### 현재 레포 상태(중요, 확인됨)

- backend에는 이미 일반형 calendar read API가 있다.
  - `GET /api/calendar/types`
  - `GET /api/calendar/events`
  - `GET /api/calendar/events/export.csv`
  - `GET /api/calendar/events/:id`
- backend의 실제 ingestion은 현재 IBKR 전용이다.
  - `POST /api/ibkr/calendar/update`
  - `POST /api/ibkr/calendar/update-custom`
  - `calendarIngestion.ts`는 Python bridge(`ibkr_wsh_calendar.py`)를 호출한다.
- `calendar_events` 테이블은 이미 범용 구조를 가지고 있다.
  - 핵심 컬럼: `[][][]event_type[][][]`, `[][][]ticker[][][]`, `[][][]title[][][]`, `[][][]event_at[][][]`, `[][][]meta_json[][][]`, `[][][]source[][][]`, `[][][]unique_key[][][]`
  - 현재 unique index는 `(event_type, unique_key)`이므로, FMP와 IBKR를 병행할 경우 `unique_key` 설계가 source-aware해야 한다.
- default universe / company data는 이미 DB에 있다.
  - `getDefaultUniverseRows()`는 `industry`, `marketCap`, `floatPct`, `institutionalPct`, `insiderPct`를 함께 반환한다.
  - 따라서 calendar column 확장은 새 external fetch가 아니라 기존 DB metadata enrich로 해결하는 편이 맞다.
- backend calendar type config는 다음 타입을 이미 지원한다.
  - `earnings`
  - `dividends`
  - `splits`
  - `analyst_ratings`
  - `sec_filings`
  - `economics`
- frontend `CalendarWindow`는 아직 backend contract와 맞지 않는다.
  - `mockCalendarData`를 직접 사용한다.
  - 탭 타입이 `earnings | conference | dividend | analyst_rating`로 고정되어 있다.
  - backend의 `dividends`, `splits`, `sec_filings`, `economics`와 naming/shape mismatch가 있다.
- frontend `CalendarWindow`의 ticker 셀은 아직 좌클릭만 지원한다.
  - 우클릭 context menu가 없고, financial chart dialog도 없다.
- backend에는 `CalendarWindow`에서 바로 쓸 수 있는 ticker financial-history read API가 아직 없다.
  - 현재 FMP provider는 profile, shares-float, OHLC, news, SEC filing, earnings calendar, IPO calendar까지만 구현돼 있다.
- mock 데이터 정책상, `calendar window` 작업에서는 새 mock을 추가하면 안 된다. 현재 남아 있는 mock calendar UI를 실데이터로 치환하는 방향이 맞다.

#### 현재 레포에 이미 연결된 FMP 데이터

| 데이터 | FMP endpoint | 현재 레포 구현 | 핵심 필드(확인됨) | 현재 용도 | calendar 연관성 |
|------|------|------|------|------|------|
| Company Profile | `/stable/profile?symbol=` | `fmpCompanyProfileProvider.ts` | `symbol`, `companyName`, `description`, `ceo`, `sector`, `industry`, `website`, `ipoDate`, `mktCap`, `fullTimeEmployees`, `exchangeShortName` | 기업 설명, 시총, IPO date, 섹터 | 직접 calendar는 아니지만 event row enrich에 재사용 가능 |
| Shares Float | `/stable/shares-float?symbol=` | `fmpSharesFloatProvider.ts` | `freeFloat`, `floatShares`, `outstandingShares` | float 관련 company data | calendar 직접 연관 낮음 |
| OHLC EOD | `/stable/historical-price-eod/full?symbol=&from=&to=` | `fmpOhlcProvider.ts` | `date`, `open`, `high`, `low`, `close`, `volume` | missing OHLC / change 보강 | calendar event 후속 반응 분석에는 유용 |
| Press Release | `/stable/news/press-releases?symbols=` | `fmpPressReleaseProvider.ts` | `symbol`, `title`, `text`, `publishedDate`, `url`, `publisher` | 뉴스 적재 | calendar 직접 source라기보다 부가 근거 |
| Stock News | `/stable/news/stock?symbols=` | `fmpStockNewsProvider.ts` | `symbols/tickers`, `title`, `text/content/snippet`, `publishedDate/date/publishedAt`, `url/link`, `publisher` | 뉴스 적재 | calendar 직접 source라기보다 부가 근거 |
| SEC Filings | `/stable/sec-filings-search/symbol?symbol=&from=&to=&page=&limit=` | `fmpSecFilingProvider.ts` | `symbol`, `cik`, `filingDate`, `acceptedDate`, `formType`, `link`, `finalLink` | filing 뉴스 적재 | `calendar`의 `sec_filings` 탭 후보로 재사용 가능 |

#### FMP 문서에서 확인된 calendar window 후보 데이터

| 타입 | FMP endpoint | 문서/샘플에서 확인한 필드 | 현재 `calendar_events` 적합성 | 우선순위 | 비고 |
|------|------|------|------|------|------|
| Earnings Calendar | `/stable/earnings-calendar` | `symbol`, `date`, `epsActual`, `epsEstimated`, `revenueActual`, `revenueEstimated`, `lastUpdated` | 높음 | 높음 | 문서 FAQ에 따르면 stable endpoint에서는 `time` 필드가 제거됨 |
| Dividends Calendar | `/stable/dividends-calendar` | `symbol`, `date`, `recordDate`, `paymentDate`, `declarationDate`, `adjDividend`, `dividend`, `yield`, `frequency` | 높음 | 높음 | FAQ 기준 `date`는 ex-dividend date |
| Splits Calendar | `/stable/splits-calendar` | `symbol`, `date`, `numerator`, `denominator` | 높음 | 높음 | `ratio`는 `numerator/denominator`로 파생 가능 |
| IPOs Calendar | `/stable/ipos-calendar` | `symbol`, `date`, `daa`, `company`, `exchange`, `actions`, `shares`, `priceRange`, `marketCap` | 중간 | 중간 | ticker 미정/null, action state, company-first event 처리 결정 필요 |
| Economic Calendar | `/stable/economic-calendar` | `date`, `country`, `event`, `currency`, `previous`, `estimate`, `actual`, `change`, `impact`, `changePercentage`, `unit` | 중간 | 중간 | ticker 없음, 국가/이벤트 중심이며 문서 FAQ상 UTC time |

### FMP IPO 데이터 상세 정리 (2026-04-15 docs 재확인)

- 기준 endpoint
  - `/stable/ipos-calendar`
- 확인된 query parameter
  - `from` (date, required)
  - `to` (date, required)
  - 문서 표기: `Max 90-day date range`
- 문서 설명 기준으로 받을 수 있는 핵심 정보
  - 예정 IPO 날짜
  - 회사명
  - 상장 예정 거래소
  - 예상 가격대
  - 공모 주식 수(있을 때)
  - market information

#### 응답 필드별 의미

| 필드 | 타입(문서 샘플 기준) | 의미 | 운영 메모 |
|------|------|------|------|
| `[][][]symbol[][][]` | string | 예정 상장 종목 심볼 | pre-IPO 단계에서는 비어 있거나 나중에 바뀔 가능성을 열어 두는 편이 안전하다. 현재 문서 샘플은 `PEVC` |
| `[][][]date[][][]` | `YYYY-MM-DD` string | IPO 예정일 | calendar top-level `event_at`의 주 기준값으로 쓰기 가장 적합 |
| `[][][]daa[][][]` | ISO datetime string | 문서 샘플상 `date`와 같은 날의 timestamp 표현 | 정확한 business 의미는 문서에서 별도 정의하지 않으므로, phase 1에서는 raw 보존만 하고 정렬 기준은 `date`를 우선하는 편이 안전 |
| `[][][]company[][][]` | string | 회사명 | title 생성과 ticker 미존재 row의 대표 식별자에 적합 |
| `[][][]exchange[][][]` | string | 상장 예정 거래소 | NYSE, NASDAQ 같은 listing venue 표시용 |
| `[][][]actions[][][]` | string | 현재 IPO 상태/액션 | 문서 샘플은 `Expected`; 향후 `Priced`, `Withdrawn`, `Postponed` 같은 상태 가능성을 열어 두고 raw string 보존 권장 |
| `[][][]shares[][][]` | number or null | 공모 주식 수 | 문서 샘플에서는 `null`; nullable 전제로 처리 필요 |
| `[][][]priceRange[][][]` | string or null | 예상 공모가 범위 | 문서 샘플에서는 `null`; 숫자 2개가 아니라 string range일 가능성을 전제로 raw 보존 필요 |
| `[][][]marketCap[][][]` | number or null | 예상 시가총액 또는 문서상 market information | 문서 샘플에서는 `null`; 단위/통화는 live entitlement 응답으로 재확인 필요 |

#### 문서 샘플 응답 (확인된 shape)

```json
[
  {
    "symbol": "PEVC",
    "date": "2025-02-03",
    "daa": "2025-02-03T05:00:00.000Z",
    "company": "Pacer Funds Trust",
    "exchange": "NYSE",
    "actions": "Expected",
    "shares": null,
    "priceRange": null,
    "marketCap": null
  }
]
```

#### CalendarWindow 관점에서 바로 쓸 수 있는 값

- 표 기본 컬럼 후보
  - `IPO Date` ← `date`
  - `Symbol` ← `symbol`
  - `Company` ← `company`
  - `Exchange` ← `exchange`
  - `Status` ← `actions`
  - `Shares` ← `shares`
  - `Price Range` ← `priceRange`
  - `Market Cap` ← `marketCap`
- `meta_json` raw 보존 후보
  - `[][][]ipo_date[][][]` = `date`
  - `[][][]daa[][][]` = raw timestamp
  - `[][][]company[][][]`
  - `[][][]exchange[][][]`
  - `[][][]actions[][][]`
  - `[][][]shares[][][]`
  - `[][][]price_range[][][]`
  - `[][][]market_cap[][][]`

#### 구현 시 주의점

- `symbol`은 earnings/dividends처럼 안정적인 상장 ticker라고 가정하면 안 된다.
  - pre-IPO에서는 ticker가 없거나 변경될 수 있어 `company + exchange + date` 같은 fallback key 전략이 필요할 수 있다.
- `actions`는 사실상 상태값 역할을 하므로, 고정 enum으로 먼저 박기보다 raw string 저장이 안전하다.
- `shares`, `priceRange`, `marketCap`은 문서 샘플에서도 `null`이므로, 값이 없을 때 빈 문자열/0으로 대체하지 않는 편이 맞다.
- docs FAQ에는 exchange/company name filter가 가능하다고 적혀 있지만, 현재 stable docs parameter 표에는 `from/to`만 보인다.
  - 따라서 backend contract에 filter 파라미터를 바로 박기 전에는 live key로 실제 지원 여부를 다시 확인해야 한다.
- docs 설명상 IPO calendar는 upcoming IPO 중심이다.
  - earnings처럼 과거 확정 실적 history를 길게 보관하는 데이터와는 성격이 다르므로, snapshot성 데이터로 보는 편이 맞다.

#### FMP calendar 계열에서 지금 확정된 운영 제약

- Earnings/Dividends/Splits 문서에는 `Maximum 4000 records per request`, `Max 90-day date range` 제한이 표시된다.
- Economics 문서에도 `Max 90-day date range` 제한이 표시된다.
- 직접 endpoint 호출은 `demo` key 기준 401이어서, 실제 응답 전체 shape와 entitlement는 실제 FMP key로 한 번 더 확인해야 한다.
- 따라서 phase 1 구현에는 `90일 단위 chunking`, `재시도`, `실제 key entitlement 점검`이 기본 전제가 된다.

### 이번 구현 목표(확장본)

- `CalendarWindow`를 mock 기반에서 API 기반으로 전환한다.
- earnings 화면에서 아래 column을 선택적으로 추가할 수 있게 한다.
  - `[][][]industry[][][]`
  - `[][][]float_pct[][][]`
  - `[][][]institutional_pct[][][]`
  - `[][][]insider_pct[][][]`
- earnings/dividends/splits 화면에서 아래 숫자 필터를 사용할 수 있게 한다.
  - `[][][]market_cap[][][]` min/max
  - `[][][]float_pct[][][]` min/max
  - `[][][]institutional_pct[][][]` min/max
- earnings update는 `POST /api/fmp/calendar/earnings/update`(가칭) job 기반으로 제공한다.
- update route는 body에 `from/to`가 있으면 해당 범위를 사용하고, 없으면 기본 운영 범위를 사용한다.
- `session/time`은 FMP stable earnings source에 없으므로 UI에서 비어 있는 값으로 처리한다.
- ticker 우클릭 `Financial` action으로 annual / quarterly dialog를 열 수 있게 한다.
- dialog에는 아래 3개 chart group을 포함한다.
  - revenue history
  - earnings history (`net income`, `EPS`)
  - valuation history (`P/E`, `P/S`)

### 제약 / 비범위

- 이번 문서는 `plan 폴더 생성 + 범위 정리`가 목표이며, 아직 runtime 코드를 바꾸지 않는다.
- FMP key 값 자체는 로그, 문서, 응답 예시 어디에도 노출하지 않는다.
- 실제 endpoint live payload는 인증 없이 재현하지 못했으므로, 문서의 샘플 필드와 현재 레포 코드가 확인한 필드만 plan의 사실 근거로 사용한다.
- `analyst_ratings`에 대응하는 FMP source는 이번 조사 범위에서 확정하지 않았다.
- `conference` 타입은 현재 frontend legacy 탭 이름이며, backend canonical type이 아니다.
- phase 1에서는 `earnings/dividends/splits` 중심으로 설계하고, `IPO/economics`는 결정 후 확장하는 쪽이 안전하다.

### 읽는 방법(비개발자/일반인 기준)

- `현재 레포 상태`를 먼저 보면 지금 무엇이 이미 있고 무엇이 어긋나 있는지 알 수 있다.
- `FMP 문서에서 확인된 calendar window 후보 데이터` 표를 보면 어떤 데이터를 FMP에서 바로 받을 수 있는지 빠르게 확인할 수 있다.
- `결정/선행조건`은 실제 구현 전에 꼭 고정해야 하는 선택지다.
- `단계별 계획`은 나중에 실제 구현을 시작할 때 어떤 순서로 움직일지 보여준다.
- `실행 의존성 그래프`는 어떤 단계가 병렬 가능하고, 무엇이 막혀 있는지 보여준다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전에는 이 문서의 범위와 결정 사항을 먼저 고정한다.
- 실제 코드 변경이 생기면 같은 폴더의 `agent_log.md`에 append 방식으로 기록한다.
- 각 Step은 `구현 -> 검증 -> 사용자 확인` 순서로 진행한다.
- 사용자 확인 전 상태는 `⏳`, 사용자 확인 후만 `✅`로 바꾼다.
- 중간에 범위가 바뀌면 기존 내용을 지우지 말고 `PLAN CHANGE` 항목을 추가한다.

### 아키텍처(상위)

- 현재 기준 data flow
  1. FMP 또는 IBKR에서 event data를 수집한다.
  2. provider별 raw field를 backend adapter가 공통 `calendar_events` 구조로 정규화한다.
  3. `calendar_events`의 `[][][]meta_json[][][]` 안에 타입별 세부 필드를 저장한다.
  4. 기존 `GET /api/calendar/events`가 이 데이터를 읽어 frontend에 전달한다.
  5. frontend `CalendarWindow`는 mock이 아니라 API response를 기준으로 탭/필터/컬럼을 렌더링한다.

#### calendar 정규화 후보 필드

- 공통 top-level
  - `[][][]event_type[][][]`
  - `[][][]ticker[][][]`
  - `[][][]title[][][]`
  - `[][][]event_at[][][]`
  - `[][][]source[][][]`
  - `[][][]unique_key[][][]`
- `earnings`용 `[][][]meta_json[][][]` 후보
  - `[][][]company_name[][][]`
  - `[][][]report_date[][][]`
  - `[][][]eps_est[][][]`
  - `[][][]eps_actual[][][]`
  - `[][][]revenue_est[][][]`
  - `[][][]revenue_actual[][][]`
  - `[][][]last_updated[][][]`
  - `[][][]time_of_day[][][]` = `null` 허용 또는 별도 추정 금지
- `dividends`용 `[][][]meta_json[][][]` 후보
  - `[][][]ex_date[][][]`
  - `[][][]record_date[][][]`
  - `[][][]payment_date[][][]`
  - `[][][]declaration_date[][][]`
  - `[][][]adj_dividend[][][]`
  - `[][][]dividend[][][]`
  - `[][][]yield[][][]`
  - `[][][]frequency[][][]`
- `splits`용 `[][][]meta_json[][][]` 후보
  - `[][][]split_date[][][]`
  - `[][][]numerator[][][]`
  - `[][][]denominator[][][]`
  - `[][][]ratio[][][]`
- `ipos`용 `[][][]meta_json[][][]` 후보
  - `[][][]company[][][]`
  - `[][][]exchange[][][]`
  - `[][][]actions[][][]`
  - `[][][]shares[][][]`
  - `[][][]price_range[][][]`
  - `[][][]market_cap[][][]`
  - `[][][]daa[][][]`
- `economics`용 `[][][]meta_json[][][]` 후보
  - `[][][]country[][][]`
  - `[][][]event_name[][][]`
  - `[][][]currency[][][]`
  - `[][][]previous[][][]`
  - `[][][]estimate[][][]`
  - `[][][]actual[][][]`
  - `[][][]change[][][]`
  - `[][][]impact[][][]`
  - `[][][]change_percentage[][][]`
  - `[][][]unit[][][]`

### Glossary

- `phase 1`
  - 가장 먼저 붙일 구현 범위.
  - 기본 제안은 `earnings`, `dividends`, `splits` 3종이다.
- `source-aware unique key`
  - 같은 `event_type`라도 FMP와 IBKR row가 충돌하지 않도록 `source` 의미를 포함한 unique key.
  - 예: `FMP:earnings:AAPL:2026-04-25`.
- `ticker-centric event`
  - 특정 종목 심볼에 자연스럽게 연결되는 이벤트.
  - 예: earnings, dividends, splits, 일부 IPO.
- `tickerless event`
  - 종목보다 국가/거시 이벤트가 중심이어서 `ticker`가 비어 있을 수 있는 이벤트.
  - 예: economic releases.

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | FMP를 IBKR 대체가 아니라 추가 source로 볼지 | 추가 source | 현재 운영 중인 IBKR 흐름을 바로 깨지 않는 편이 안전하기 때문 |
| D2 | phase 1 범위 | `earnings + dividends + splits` | 현재 `calendar_events` 구조와 가장 잘 맞고 ticker 중심이기 때문 |
| D3 | `IPO/economics` 처리 | phase 2로 분리 | null ticker / region 중심 로직이 추가 설계를 요구하기 때문 |
| D4 | frontend 탭 기준 | backend canonical type에 맞춰 재정렬 | 현재 `conference/dividend/analyst_rating` legacy 탭이 backend와 불일치하기 때문 |
| D5 | earnings time 필드 처리 | 추정하지 않고 `null` 유지 | FMP stable docs FAQ에서 time 제거를 명시했기 때문 |
| D6 | date range fetch 전략 | 90일 chunking | FMP 문서에 max 90-day date range 제한이 표시되기 때문 |
| D7 | provider coexist dedupe | `unique_key`에 source prefix 포함 | 현재 unique index가 `(event_type, unique_key)`라 source 충돌 위험이 있기 때문 |
| D8 | calendar route 설계 | IBKR route와 분리된 FMP route 추가 | provider별 실패/재시도/로그를 분리하는 편이 운영상 명확하기 때문 |
| D9 | financial dialog data source | `income-statement + key-metrics + ratios` | revenue/earnings/valuation을 가장 적은 endpoint 수로 함께 만들 수 있기 때문 |

### 계획 중간 필수 확인

- 실제 FMP key로 `earnings/dividends/splits/ipos/economics` entitlement가 모두 열려 있는지 확인해야 한다.
- `earnings-calendar`의 stable endpoint에는 time이 없으므로, UI가 time 컬럼 필수 전제로 짜여 있지 않은지 확인해야 한다.
- `calendar_events`의 unique key 충돌을 막기 위해 provider별 key 규칙을 먼저 고정해야 한다.
- `IPO/economics`처럼 ticker가 비거나 없는 데이터가 현재 검색/정렬/CSV export와 충돌하지 않는지 확인해야 한다.
- frontend `CalendarWindow`가 아직 mock type을 쓰므로, backend API에 붙일 때 탭/컬럼/필터 이름을 동시에 정리해야 한다.
- `sec_filings`는 이미 FMP data source가 있지만 현재는 news pipeline에 연결돼 있으므로, calendar reuse 전략을 별도로 정해야 한다.

### 제안하는 구현 순서(이유)

1. `calendar window`의 canonical type과 provider 전략을 먼저 고정한다.
   - source 충돌과 UI mismatch를 초기에 정리해야 이후 구현이 흔들리지 않는다.
2. FMP phase 1 이벤트(`earnings/dividends/splits`)용 adapter를 먼저 만든다.
   - 현재 스키마에 가장 자연스럽게 들어가는 이벤트부터 붙이는 것이 위험이 낮다.
3. calendar ingestion route와 job/status를 provider별로 분리한다.
   - 운영 중 로그, cancel, 재시도 원인을 명확히 관리할 수 있다.
4. frontend `CalendarWindow`의 mock 의존을 제거하고 backend type에 맞춘다.
   - 이 시점부터 실데이터 검증이 가능해진다.
5. `IPO/economics`는 phase 1 검증 후 확장한다.
   - tickerless event를 너무 일찍 섞으면 UI contract가 복잡해진다.

### 단계별 계획(각 단계: 구현 -> 검증)

#### ⏳ Step 0 — 초기 감사와 범위 고정

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | backend calendar 구조와 현재 route를 확인한다 | ⏳ |
| 0-2 | frontend `CalendarWindow`가 아직 mock + legacy type인지 확인한다 | ⏳ |
| 0-3 | FMP 문서와 현재 provider 코드를 대조해 사용 가능한 데이터 범위를 정리한다 | ⏳ |

0-1 목적: 이미 있는 backend 자산을 재사용할 수 있는지 확인하기 위함.
설명: `calendar_events`, `CALENDAR_TYPE_CONFIG`, `/api/calendar/events`를 기준 구조로 본다.
완료 조건(눈으로 확인): 새 calendar read API를 다시 만들지 않고 기존 route를 확장/재사용할 수 있다는 판단이 선다.
사람 검증(비개발자): 캘린더 조회 API는 이미 있고, 수집 source만 추가하면 된다는 점을 이해할 수 있다.
흔한 문제/주의: source별 row가 같은 unique key를 쓰면 덮어쓰기 충돌이 발생한다.

0-2 목적: frontend 변경 범위를 과소평가하지 않기 위함.
설명: 현재 UI가 mock data와 backend 불일치 타입에 의존하고 있음을 명시한다.
완료 조건(눈으로 확인): `mockCalendarData` 제거가 필수라는 점이 plan에 적혀 있다.
사람 검증(비개발자): 현재 화면이 실데이터가 아니라 임시 데이터 기반이라는 점을 알 수 있다.
흔한 문제/주의: 탭 이름만 바꾸고 column mapping을 안 바꾸면 UI가 바로 깨질 수 있다.

0-3 목적: FMP 범위를 막연한 추정이 아니라 문서/코드 기준으로 고정하기 위함.
설명: 현재 구현된 FMP 데이터와 calendar 후보 endpoint를 분리해 적는다.
완료 조건(눈으로 확인): 어떤 데이터는 이미 코드에 있고, 어떤 데이터는 새 구현이 필요한지 한눈에 구분된다.
사람 검증(비개발자): FMP에서 받을 수 있는 데이터 목록이 표로 정리돼 있다.
흔한 문제/주의: demo key 401을 실제 미지원으로 오해하면 안 된다. 이는 인증 부재일 뿐이다.

검증 훅:
```text
- terminal/backend/src/services/calendarRepository.ts 구조 확인
- termina_web/.../CalendarWindow.tsx 의 mockCalendarData 사용 여부 확인
- FMP docs page의 endpoint/샘플 필드 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — canonical schema와 결정 사항 고정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | phase 1 event type을 `earnings/dividends/splits`로 고정할지 결정 | `ai_agent_plan/calendar_window_fmp_scope/plan.md` | 결정표 업데이트 확인 | ⏳ |
| 1-2 | source-aware `unique_key` 규칙을 정의 | `terminal/backend/src/services/calendarRepository.ts`, `ai_agent_plan/calendar_window_fmp_scope/plan.md` | 중복 row 시나리오 리뷰 | ⏳ |
| 1-3 | type별 `meta_json` 표준 필드 이름을 확정 | `ai_agent_plan/calendar_window_fmp_scope/plan.md` | 컬럼/필드 표 확인 | ⏳ |
| 1-4 | `IPO/economics`를 phase 2로 둘지, null ticker를 허용할지 결정 | `ai_agent_plan/calendar_window_fmp_scope/plan.md` | 차단 해제 여부 확인 | ⬜ |

1-1 목적: 첫 구현 범위를 작고 명확하게 유지하기 위함.
설명: phase 1은 ticker 중심 이벤트만 먼저 붙이는 기본값을 고정한다.
완료 조건(눈으로 확인): 어떤 탭이 1차 구현 대상인지 문서에 명확히 적혀 있다.
사람 검증(비개발자): 무엇이 먼저 나오고 무엇이 뒤로 밀리는지 이해할 수 있다.
흔한 문제/주의: 너무 많은 타입을 한 번에 넣으면 mock 제거와 provider 연결이 동시에 꼬인다.

1-2 목적: IBKR와 FMP를 함께 둘 때 row 충돌을 방지하기 위함.
설명: unique key는 provider를 식별할 수 있게 설계한다.
완료 조건(눈으로 확인): `FMP:` prefix 같은 구체 예시가 있다.
사람 검증(비개발자): 서로 다른 source 데이터가 서로 덮어쓰지 않는다는 점을 이해할 수 있다.
흔한 문제/주의: DB unique index는 source 컬럼을 보지 않는다.

1-3 목적: backend/frontend가 같은 필드 이름을 쓰게 하기 위함.
설명: type별 표준 필드 집합을 문서에 고정한다.
완료 조건(눈으로 확인): 각 타입별 `[][][]field_name[][][]` 목록이 있다.
사람 검증(비개발자): 어떤 값이 각 탭에서 보일지 미리 알 수 있다.
흔한 문제/주의: FMP raw key를 그대로 노출하면 provider 종속성이 커진다.

1-4 목적: `IPO/economics`를 성급히 섞는 것을 방지하기 위함.
설명: null ticker 허용 여부와 phase 분리를 결정한다.
완료 조건(눈으로 확인): 차단 여부가 해소되거나 유지 사유가 명확하다.
사람 검증(비개발자): 왜 일부 탭이 뒤로 밀리는지 납득할 수 있다.
흔한 문제/주의: economics는 ticker search UX와 바로 안 맞는다.

검증 훅:
```text
- phase 1 type 목록 확정
- unique_key 예시 3건 수기 리뷰
- meta_json 표준 필드 표 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — backend FMP earnings ingestion + default-universe update 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | FMP stable earnings-calendar provider/service 추가 | `terminal/backend/src/services/*` | 타입 검사 + 샘플 호출 | ⏳ |
| 2-2 | date range chunking + retry + cancel-aware fetch 구현 | `terminal/backend/src/services/*` | 범위 쪼개기 로그 확인 | ⏳ |
| 2-3 | `calendar_events` upsert와 `source='FMP'` 저장 구현 | `terminal/backend/src/services/calendarRepository.ts` | DB row 확인 | ⏳ |
| 2-4 | default universe 기준 FMP earnings update route/job/status 추가 | `terminal/backend/src/server.ts` | endpoint 200/에러 응답 확인 | ⏳ |
| 2-5 | 같은 update 범위의 기존 FMP earnings rows를 snapshot replace하도록 정리 | `terminal/backend/src/services/calendarRepository.ts`, `terminal/backend/src/server.ts` | 같은 범위 재실행 후 stale row 미잔존 확인 | ⏳ |

2-1 목적: FMP earnings date를 실제로 받아올 수 있게 하기 위함.
설명: stable earnings-calendar response를 공통 event shape로 매핑한다.
완료 조건(눈으로 확인): FMP용 fetch 함수와 mapper가 생긴다.
사람 검증(비개발자): FMP에서 캘린더 데이터를 읽는 코드가 생긴다.
흔한 문제/주의: earnings stable endpoint에는 time이 없다.

2-2 목적: FMP 문서의 range 제한을 지키면서 안정적으로 수집하기 위함.
설명: 긴 기간은 다중 chunk로 나누고 재시도/백오프를 건다.
완료 조건(눈으로 확인): range chunking 규칙이 코드와 로그에 드러난다.
사람 검증(비개발자): 긴 기간을 한 번에 무리하게 호출하지 않는다는 점을 알 수 있다.
흔한 문제/주의: chunk 경계에서 중복 row가 생기면 unique key가 이를 흡수해야 한다.

2-3 목적: 기존 calendar read API가 그대로 새 데이터를 읽게 하기 위함.
설명: 저장 대상은 새 테이블이 아니라 기존 `calendar_events`다.
완료 조건(눈으로 확인): `source='FMP'` row가 `calendar_events`에 들어간다.
사람 검증(비개발자): 저장 위치가 하나로 유지된다는 점을 이해할 수 있다.
흔한 문제/주의: IBKR row와 FMP row가 같은 type에서 충돌하면 안 된다.

2-4 목적: 사용자가 CalendarWindow 안에서 FMP earnings update를 실행할 수 있게 하기 위함.
설명: route는 IBKR와 분리하고, 대상 ticker는 DB default universe로 고정한다.
완료 조건(눈으로 확인): 새 FMP calendar update API가 생긴다.
사람 검증(비개발자): 어떤 버튼이 IBKR이고 어떤 버튼이 FMP인지 구분할 수 있다.
흔한 문제/주의: FMP key 미설정 시 400/명확한 오류를 줘야 한다.

2-5 목적: earnings date가 바뀌었을 때 이전 날짜 row가 화면에 남지 않게 하기 위함.
설명: 같은 범위 update는 append가 아니라 snapshot replace로 처리한다.
완료 조건(눈으로 확인): 같은 범위를 재실행해도 이전 FMP date row가 누적되지 않는다.
사람 검증(비개발자): 날짜가 변경되면 새 날짜만 남고 예전 날짜는 사라진다.
흔한 문제/주의: 너무 좁은 custom range만 갱신하면 경계 밖으로 이동한 새 날짜는 그 범위에서 안 보일 수 있다.

검증 훅:
```text
- POST /api/fmp/calendar/update (가칭) 실행
- app.db calendar_events 에 source='FMP' row 존재 확인
- 같은 범위 재실행 시 중복 row가 증가하지 않는지 확인
- 같은 범위 재실행 시 stale date row가 남지 않는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — query layer enrich, financial detail API, date filter 정렬

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | earnings row에 DB metadata(`industry`, ownership, company name)를 enrich | `terminal/backend/src/services/calendarRepository.ts` | `/api/calendar/events` 응답 확인 | ⏳ |
| 3-2 | date-only `from/to` query를 inclusive day range로 정규화 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/calendarRepository.ts` | query 조합 확인 | ⏳ |
| 3-3 | CSV export와 type config가 새 필드 구조를 반영하도록 조정 | `terminal/backend/src/services/calendarRepository.ts` | export.csv 확인 | ⏳ |
| 3-4 | ticker별 revenue / earnings / valuation + estimate series를 내려주는 read-only API 추가 | `terminal/backend/src/services/*`, `terminal/backend/src/server.ts` | `/api/calendar/financials/:ticker` 응답 확인 | ⏳ |
| 3-5 | default universe 대상 financial history/estimate snapshot sync job + DB cache 추가 | `terminal/backend/src/db.ts`, `terminal/backend/src/services/*`, `terminal/backend/src/server.ts` | `/api/fmp/calendar/financials/update` 실행 후 DB/API 확인 | ⏳ |

3-1 목적: calendar row가 별도 external fetch 없이 DB metadata를 함께 보여주게 하기 위함.
설명: `industry`, `float_pct`, `institutional_pct`, `insider_pct`를 existing DB에서 붙인다.
완료 조건(눈으로 확인): `/api/calendar/events?type=earnings` 응답에 ownership/industry field가 포함된다.
사람 검증(비개발자): column selector에 넣을 값이 이미 API에 내려온다.
흔한 문제/주의: ticker normalize가 틀리면 FMP row와 securities join이 어긋날 수 있다.

3-2 목적: 날짜 필터가 사용자가 기대하는 inclusive range로 동작하게 하기 위함.
설명: `YYYY-MM-DD` 입력은 시작일 00:00 / 종료일 23:59:59.999로 정규화한다.
완료 조건(눈으로 확인): 종료일 하루치 row가 누락되지 않는다.
사람 검증(비개발자): 같은 날짜를 From/To로 주면 그 날짜 이벤트가 정상 조회된다.
흔한 문제/주의: date-only string을 그대로 `event_at <= to`에 넣으면 당일 event가 빠질 수 있다.

3-3 목적: 실사용 export가 UI와 다른 데이터를 뱉지 않게 하기 위함.
설명: export header는 현재 type별 canonical columns와 동기화한다.
완료 조건(눈으로 확인): export CSV header가 새 탭 구조와 맞다.
사람 검증(비개발자): 화면과 CSV가 같은 의미의 컬럼을 가진다.
흔한 문제/주의: `meta_json` key rename 후 export를 놓치기 쉽다.

3-4 목적: CalendarWindow ticker 우클릭 dialog가 필요한 재무 시계열과 estimate를 바로 읽게 하기 위함.
설명: FMP stable `income-statement`, `key-metrics`, `ratios`, `analyst-estimates`를 묶어 annual / quarterly series를 반환하는 read-only endpoint를 만든다.
완료 조건(눈으로 확인): 특정 ticker에 대해 actual revenue / net income / EPS / P/E / P/S와 estimate revenue / net income / EPS가 하나의 API payload로 내려온다.
사람 검증(비개발자): ticker 하나를 지정했을 때 dialog에 그릴 actual + estimate 데이터가 API에서 함께 보인다.
흔한 문제/주의: `analyst-estimates`는 `date` 기반 response라 actual `fiscalYear/period` series와 merge key 규칙을 명확히 두어야 한다.

3-5 목적: default ticker 전체에 대한 financial history/estimate를 미리 받아 둘 수 있게 하기 위함.
설명: batch sync job이 `default universe` ticker를 순회하며 financial snapshot cache를 DB에 replace 저장한다.
완료 조건(눈으로 확인): sync job 완료 후 여러 ticker가 live fetch 없이도 DB cache에서 financial dialog 데이터를 읽는다.
사람 검증(비개발자): 캘린더 화면의 sync 버튼을 누르면 진행률이 보이고, 이후 ticker dialog가 미리 받아둔 데이터를 사용한다.
흔한 문제/주의: stale row가 남지 않도록 ticker별 snapshot replace가 필요하고, default universe가 비어 있을 때는 명확한 에러가 필요하다.

검증 훅:
```text
- GET /api/calendar/types
- GET /api/calendar/events?type=earnings
- GET /api/calendar/events/export.csv?type=earnings
- GET /api/calendar/financials/AAPL
- POST /api/fmp/calendar/financials/update
- sync 후 GET /api/calendar/financials/AAPL 재확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — frontend CalendarWindow를 mock에서 실데이터로 전환

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `mockCalendarData` 의존 제거, `/api/calendar/events` fetch 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | dev 화면 확인 | ⏳ |
| 4-2 | industry / ownership column selector와 table rendering 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | 탭/컬럼 렌더링 확인 | ⏳ |
| 4-3 | date filter, search, sort, empty state, FMP earnings update button + job polling 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | 브라우저 + API 확인 | ⏳ |
| 4-4 | `Inst %`, `Float %`, `Market Cap` min/max 숫자 필터 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | 브라우저에서 숫자 범위 입력 후 row 변화 확인 | ⏳ |
| 4-5 | calendar 기본 날짜 정렬을 늦은 날짜 우선으로 전환 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | 브라우저 첫 row 날짜 확인 | ⏳ |
| 4-6 | 날짜 범위 미지정 시 events fetch를 막고 안내 상태를 표시 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx` | 브라우저 초기 진입/Reset 후 빈 상태 확인 | ⏳ |
| 4-7 | ticker 우클릭 context menu와 Financial dialog 차트 UI 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx` | 브라우저에서 우클릭 menu + dialog 확인 | ⏳ |
| 4-8 | earnings 탭에 default ticker financial history sync 버튼과 estimate overlay UI 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarFinancialDialog.tsx` | 브라우저에서 sync 버튼 + estimate line/card 확인 | ⏳ |

4-1 목적: 현재 calendar 화면을 실데이터 기반으로 바꾸기 위함.
설명: mock array 대신 backend response를 state source of truth로 삼는다.
완료 조건(눈으로 확인): 페이지 새로고침 후에도 API 데이터가 뜬다.
사람 검증(비개발자): 데이터가 고정 mock이 아니라 실제 update 결과에 따라 바뀐다.
흔한 문제/주의: loading/error/empty 상태를 같이 넣지 않으면 화면이 멈춘 것처럼 보인다.

4-2 목적: 사용자가 DB 기반 company metadata를 column으로 꺼내 볼 수 있게 하기 위함.
설명: `industry`, `float`, `institutional`, `insider`를 selectable column으로 넣는다.
완료 조건(눈으로 확인): column menu에서 ownership/industry를 켜고 끌 수 있다.
사람 검증(비개발자): 기본 화면은 간단하지만 필요할 때 ownership column을 열 수 있다.
흔한 문제/주의: 기존 `CalendarEvent` TS type이 새 API shape를 막을 수 있다.

4-3 목적: 실사용 가능한 earnings calendar 창으로 마무리하기 위함.
설명: date range, text search, sort, empty state와 FMP earnings update button을 새 contract에 맞춘다.
완료 조건(눈으로 확인): 필터 변경 시 결과가 정상적으로 갱신된다.
사람 검증(비개발자): 날짜를 바꾸면 실제 결과가 달라지고, 결과가 없으면 이유를 알 수 있다.
흔한 문제/주의: FMP stable source에는 session/time이 없으므로, 해당 column은 비어 있는 값으로 보일 수 있다.

4-4 목적: ownership / float / market cap 기준으로 earnings 후보를 빠르게 좁히기 위함.
설명: min/max 숫자 입력을 추가하고, 값이 없는 row 처리 규칙을 일관되게 둔다.
완료 조건(눈으로 확인): 숫자 필터를 입력하면 row count와 visible row가 즉시 달라진다.
사람 검증(비개발자): 예를 들어 `Inst % >= 70` 같은 조건을 넣으면 기관보유율이 높은 종목만 남는다.
흔한 문제/주의: 값이 `null`인 row를 어떻게 취급할지 명확해야 하며, 숫자 입력이 빈 문자열일 때는 필터가 꺼져야 한다.

4-5 목적: 최신/먼 미래 earnings date가 화면 상단에 바로 보이게 하기 위함.
설명: 기본 sort direction과 reset/tab 전환 시 초기화를 모두 `desc`로 맞춘다.
완료 조건(눈으로 확인): earnings 탭 첫 row가 `2026-04-21` 같은 가까운 날짜가 아니라 더 늦은 날짜로 시작한다.
사람 검증(비개발자): 화면을 열자마자 가장 늦은 날짜가 먼저 보여 뒤쪽 데이터가 없는 것처럼 느껴지지 않는다.
흔한 문제/주의: fetch 단계와 client sort 단계의 기본값이 엇갈리면 깜빡임이나 예상 밖 정렬이 생길 수 있다.

4-6 목적: 초기 대량 fetch로 인한 렉을 줄이기 위함.
설명: `from/to`가 둘 다 채워지기 전에는 API 호출을 하지 않고 date-range required 상태를 렌더링한다.
완료 조건(눈으로 확인): 창을 열자마자 row가 뜨지 않고 날짜를 넣은 뒤에만 결과가 로드된다.
사람 검증(비개발자): 날짜를 넣기 전에는 표가 비어 있고 안내 문구가 보인다.
흔한 문제/주의: loading/empty/no-date 상태가 섞이면 사용자가 오류인지 대기 상태인지 구분하기 어렵다.

4-7 목적: CalendarWindow 안에서 ticker별 재무 history를 바로 보게 하기 위함.
설명: ticker 셀 우클릭으로 `Financial` menu를 띄우고, 선택 시 annual / quarterly toggle이 있는 dialog에서 revenue / earnings / valuation charts를 렌더링한다.
완료 조건(눈으로 확인): ticker를 우클릭하면 menu가 뜨고, `Financial`을 누르면 dialog 안에 3개 chart group이 보인다.
사람 검증(비개발자): 같은 캘린더 창에서 종목 재무 흐름을 추가 창 없이 바로 열어볼 수 있다.
흔한 문제/주의: 좌클릭 linked-ticker 동작을 깨뜨리면 기존 window linkage UX가 회귀한다.

4-8 목적: 사용자가 default ticker 전체 financial history를 batch로 받아 두고, dialog에서 estimate까지 함께 보게 하기 위함.
설명: earnings 탭 툴바에 sync 버튼을 추가하고, dialog chart/card에 revenue / earnings estimate overlay를 렌더링한다.
완료 조건(눈으로 확인): sync 버튼을 누르면 job progress가 보이고, dialog 차트에 estimate 선/값이 actual과 함께 표시된다.
사람 검증(비개발자): earnings 화면에서 한 번 버튼을 누른 뒤 ticker dialog를 열면 estimate가 같이 보인다.
흔한 문제/주의: actual 전용 차트 config를 그대로 두면 estimate series가 API에 있어도 화면에는 안 나타난다.

검증 훅:
```text
- backend dev + webui dev 실행
- Calendar 창 열기
- 탭 전환, 날짜 필터, 숫자 필터, 정렬, empty state 확인
- /api/calendar/events 호출 결과와 화면 row 일치 확인
- 기본 진입/Reset 후 첫 row 날짜가 늦은 날짜 우선인지 확인
- 기본 진입/Reset 후 날짜 안내 상태이고 row가 비어 있는지 확인
- ticker 우클릭 -> Financial menu -> dialog open -> annual/quarterly toggle 확인
- earnings 탭 `Sync Financial History` 버튼 -> job progress -> 완료 후 dialog estimate 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 문서 동기화와 최종 검증

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | backend spec 문서 동기화 | `terminal/backend_prompt.md` | 문서 diff 확인 | ⏳ |
| 5-2 | frontend spec 문서 동기화 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⏳ |
| 5-3 | 정적 분석, 빌드, 테스트, runtime API/UI 검증 | 코드 전체 | `get_errors`, build, test, dev 확인 | ⏳ |

5-1 목적: backend contract 변경이 문서와 어긋나지 않게 하기 위함.
설명: 새 route, calendar type, field mapping을 문서에 반영한다.
완료 조건(눈으로 확인): backend_prompt에 새 calendar source와 API가 적혀 있다.
사람 검증(비개발자): 어떤 버튼/route가 무엇을 하는지 문서로 따라갈 수 있다.
흔한 문제/주의: code만 바꾸고 prompt/spec를 안 고치면 다음 작업에서 다시 혼란이 난다.

5-2 목적: frontend 동작과 설명 문서를 맞추기 위함.
설명: mock 제거, 탭 구조, filter 동작을 문서화한다.
완료 조건(눈으로 확인): figma_frontend_prompt가 실제 UI 구조와 맞다.
사람 검증(비개발자): UI를 열지 않아도 어떤 탭과 필터가 있는지 문서로 알 수 있다.
흔한 문제/주의: column 이름과 API field 설명이 틀어지기 쉽다.

5-3 목적: calendar 작업을 문서만이 아니라 실제 동작까지 확인하기 위함.
설명: 정적 분석, build, test, dev API/UI를 순서대로 검증한다.
완료 조건(눈으로 확인): 에러 0, build 성공, test pass, UI/API 실제 동작이 확인된다.
사람 검증(비개발자): 화면에서 캘린더 데이터가 보이고 필터가 동작한다.
흔한 문제/주의: build만 통과하고 dev runtime이 깨지는 경우가 많다.

검증 훅:
```text
- get_errors
- terminal: build
- terminal: test
- backend dev + webui dev + /api/calendar/events + 브라우저 시각 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 6 — IPO / Economics 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | `IPO`의 null/미정 ticker 처리 방식 확정 | `ai_agent_plan/calendar_window_fmp_scope/plan.md`, backend/frontend 관련 파일 | 결정 후 API 샘플 리뷰 | 🚫 |
| 6-2 | `economics`의 country/event 중심 UI 설계 | backend/frontend 관련 파일 | region filter + UTC time 확인 | 🚫 |
| 6-3 | non-ticker event를 search/export/UI에 연결 | backend/frontend 관련 파일 | UI/API/export 일치 확인 | 🚫 |

6-1 목적: IPO 이벤트를 ticker-centric UI에 무리 없이 연결하기 위함.
설명: symbol 부재 또는 company-first row를 어떻게 보여줄지 먼저 정한다.
완료 조건(눈으로 확인): null ticker 허용 규칙이 있다.
사람 검증(비개발자): symbol이 비어도 왜 row가 보이는지 이해할 수 있다.
흔한 문제/주의: ticker click UX가 깨질 수 있다.

6-2 목적: economics를 억지로 종목 달력처럼 보이지 않게 하기 위함.
설명: country, event, impact, UTC time 중심 UI를 별도로 고려한다.
완료 조건(눈으로 확인): economics용 column/filter가 분리 정의된다.
사람 검증(비개발자): 거시 이벤트가 특정 종목 이벤트와 다르게 보여도 이해할 수 있다.
흔한 문제/주의: timezone을 local time으로 조용히 바꾸면 일정이 어긋난다.

6-3 목적: 확장 타입도 export/search와 일관되게 동작하게 하기 위함.
설명: tickerless row를 기존 기능과 함께 다룰 수 있게 만든다.
완료 조건(눈으로 확인): non-ticker row가 화면/API/export에서 같은 의미를 가진다.
사람 검증(비개발자): 종목 없는 이벤트도 검색하고 내보낼 수 있다.
흔한 문제/주의: `ticker`를 필수 문자열로 가정한 기존 타입이 많을 수 있다.

검증 훅:
```text
- IPO/economics sample row 기준 UI 설계 리뷰
- region filter, export, sort 동작 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| 결정 | 내용 | 선택지 | 차단 대상 Step |
|------|------|--------|----------------|
| U1 | FMP를 IBKR와 병행할지, 일부 타입만 대체할지 | 병행 / 부분 대체 / 완전 대체 | Step 1, Step 2 |
| U2 | phase 1에 `sec_filings`를 calendar source로 같이 넣을지 | 제외 / 포함 | Step 2, Step 3 |
| U3 | `IPO/economics`를 같은 창의 탭으로 넣을지 별도 탭/별도 창으로 둘지 | 같은 창 / 별도 탭군 / 별도 창 | Step 4, Step 6 |
| U4 | `earnings time/session` 부재를 UI에서 어떻게 표시할지 | 빈값 / Unknown / 컬럼 숨김 | Step 1, Step 4 |

### 실행 의존성 그래프

Legend:
- `✅` 구현 + 사용자 확인 완료
- `⏳` 구현 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족으로 차단

트랙 A — ticker 중심 phase 1 (`earnings/dividends/splits`)

```text
⏳ 0-1 backend calendar 구조 확인
  -> ⏳ 0-2 frontend mock/legacy type 확인
  -> ⏳ 0-3 FMP 범위 조사 정리
  -> ⏳ 1-1 phase 1 type 확정
  -> ⏳ 1-2 source-aware unique_key 규칙 확정
  -> ⏳ 1-3 meta_json 표준 필드 확정
  -> ⏳ 2-1 FMP provider/service 추가
  -> ⏳ 2-2 90일 chunking + retry 구현
  -> ⏳ 2-3 calendar_events upsert 구현
  -> ⏳ 2-4 FMP calendar update route 추가
  -> ⏳ 2-5 FMP earnings snapshot replace 적용
  -> ⏳ 3-1 earnings row metadata enrich
  -> ⏳ 3-2 inclusive day range query 정규화
  -> ⏳ 3-3 export 동기화
  -> ⏳ 3-4 ticker financial detail read API 추가
  -> ⏳ 3-5 financial snapshot sync job + DB cache
  -> ⏳ 4-1 mock 제거 + API fetch 연결
  -> ⏳ 4-2 탭/컬럼 backend canonical 정렬
  -> ⏳ 4-3 filter/sort/empty state 정리
  -> ⏳ 4-4 숫자 필터 추가
  -> ⏳ 4-5 기본 날짜 desc 정렬
  -> ⏳ 4-6 날짜 미지정 lazy load
  -> ⏳ 4-7 ticker context menu + Financial dialog
  -> ⏳ 4-8 financial sync 버튼 + estimate overlay
  -> ⏳ 5-1 backend 문서 동기화
  -> ⏳ 5-2 frontend 문서 동기화
  -> ⏳ 5-3 정적분석/빌드/테스트/runtime 검증
```

트랙 B — non-ticker 확장 (`IPO/economics`)

```text
⏳ 0-3 FMP 범위 조사 정리
  -> ⬜ 1-4 IPO/economics 처리 결정
  -> 🚫 6-1 IPO null ticker 처리 확정
  -> 🚫 6-2 economics country/event UI 설계
  -> 🚫 6-3 non-ticker row export/search/UI 연결
```

==================== BLOCKED ====================
`IPO/economics`는 `U3`, `U4`, null ticker 정책이 고정되기 전까지 시작하지 않는다.
=================================================

병렬 트랙 요약

- 트랙 A는 현재 레포 구조에 가장 잘 맞는 phase 1 구현이다.
- 트랙 B는 트랙 A 완료 전 병행 조사까지만 가능하고, 실제 구현은 결정 해소 후 시작한다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| U1 | Step 2 | 병행 / 부분 대체 / 완전 대체 |
| U3 | Step 4, Step 6 | 같은 창 / 별도 탭군 / 별도 창 |
| U4 | Step 1, Step 4 | 빈값 / Unknown / 컬럼 숨김 |

### 결정 #1 — phase 1 범위(상세)

- 권장안: `earnings`, `dividends`, `splits`만 먼저 연결한다.
- 이유:
  - 모두 ticker 중심이며 현재 `calendar_events` 구조에 자연스럽다.
  - 샘플 응답 필드가 비교적 단순하고, column 정의가 쉽다.
  - frontend mock 제거와 backend provider 추가를 동시에 해도 복잡도가 관리 가능하다.
- 제외 이유:
  - `IPO`는 ticker/company/action 상태를 함께 다뤄야 한다.
  - `economics`는 tickerless event라 UI 계약이 달라진다.

### 결정 #2 — non-ticker event 저장 방식(상세)

- 권장안: phase 1에서는 `ticker`를 자연스럽게 채울 수 있는 타입만 넣고, non-ticker event는 phase 2에서 `ticker nullable`을 명시적으로 허용한다.
- 이유:
  - 현재 frontend `CalendarEvent` 타입은 ticker string 전제를 많이 갖고 있다.
  - search, export, ticker click UX가 모두 종목 중심이다.
  - economics는 문서상 UTC time이므로 timezone 설명도 별도로 필요하다.

### PLAN CHANGE

- 2026-04-15 최초 작성:
  - `calendar window` 작업 전용 plan 폴더를 새로 생성했다.
  - FMP 데이터 범위를 `현재 구현됨`과 `calendar 후보`로 분리했다.
  - phase 1 기본 권장안을 `earnings/dividends/splits`로 두고, `IPO/economics`는 차단된 확장 단계로 분리했다.
- 2026-04-15 ticker Financial dialog 범위 추가:
  - `CalendarWindow` ticker 셀에 우클릭 context menu를 추가하고 `Financial` 액션을 연다.
  - `Financial` dialog는 annual / quarterly toggle과 함께 revenue / earnings / valuation chart를 표시한다.
  - backend에는 FMP stable `income-statement`, `key-metrics`, `ratios`를 묶는 read-only financial detail API가 추가 대상이다.