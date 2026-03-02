# Data Availability Audit — terminal_ui_ver2_finhub (Step 0)

## EN

### Purpose
This document defines what “data availability audit” means for this project:
- Which UI fields must be sourced from **IBKR** and **Finnhub**
- Which UI fields must be **computed from existing OHLC** (`OHLC_data/ohlc_1d_watchlist.sqlite`)
- Which UI fields are **not available** (and therefore must be removed/blanked or require a provider change)

This audit is a **fail-fast gate**: do not implement UI columns with fake placeholders.

### Scope (what we are auditing)
We audit fields implied by these UI surfaces:
1) **News Feed: finhub api** window
2) **/calendar** window (must be IBKR-only)
3) **Watchlist** window

### Providers and storage
- **Finnhub**
  - Used for: company news, company profile (market cap/industry), earnings date (if available)
  - Accessed by backend only (never from browser directly)
- **IBKR**
  - Used for: calendar events (IBKR-only requirement), 1D OHLCV (price data update)
  - Accessed by backend only
- **OHLC canonical store (already exists)**
  - `OHLC_data/ohlc_1d_watchlist.sqlite` (table `ohlc_1d`)
  - Used for computing “Changes %” fields (1D, from open, +7D/+14D/+30D)

### Non-negotiables
- Do not log secrets (API keys/tokens).
- Do not create mock/synthetic data to fill missing fields.
- If a required field is not available, record it as **Not available** and stop for a decision.

---

## Capability Matrix (CONFIRMED — 2026-03-02)
Each row filled with probe results. Status: ✅ Confirmed | ⚠️ Conditional | ❌ Not probed yet

### News Feed: finhub api
| UI Field | Required? | Source | Provider field(s) / Computation | Status | Probe evidence |
|---|---:|---|---|---|---|
| Date | Required | **Finnhub** | `datetime` (Unix epoch seconds) → NY date | ✅ Confirmed | `finnhub_company_news_AAPL.json`: `"datetime": 1772441102` (epoch sec) |
| Time | Required | **Finnhub** | `datetime` (Unix epoch seconds) → NY time | ✅ Confirmed | Same field as Date |
| Title | Required | **Finnhub** | `headline` | ✅ Confirmed | `"headline": "Broadcom, Target Earnings and Jobs Report..."` |
| Sources | Required | **Finnhub** | `source` | ✅ Confirmed | `"source": "Yahoo"` |
| Changes%: `Chg` | Required | **Computed (OHLC)** | $(Close_t/Close_{t-1}-1)\times 100$ | ✅ DB exists | `ohlc_1d_watchlist.sqlite` table `ohlc_1d` has Close column |
| Changes%: `fr.Open` | Required | **Computed (OHLC)** | $(Close_t/Open_t-1)\times 100$ | ✅ DB exists | `ohlc_1d` has Open + Close columns |
| Changes%: `+7D` | Required | **Computed (OHLC)** | $(Close_t/Close_{t-7}-1)\times 100$ (trading bars) | ✅ DB exists | Needs ≥7 prior bars; else render `-` |
| Changes%: `+14D` | Required | **Computed (OHLC)** | $(Close_t/Close_{t-14}-1)\times 100$ (trading bars) | ✅ DB exists | Needs ≥14 prior bars; else render `-` |
| Changes%: `+30D` | Required | **Computed (OHLC)** | $(Close_t/Close_{t-30}-1)\times 100$ (trading bars) | ✅ DB exists | Needs ≥30 prior bars; else render `-` |
| Earning: `<date>` line | Optional | **Finnhub** (conditional) | `/calendar/earnings` endpoint | ⚠️ Empty array | All 3 symbols returned `{"earningsCalendar": []}`. Likely no upcoming earnings at probe time, or free-tier limit. Render nothing when empty. |
| Market cap | Optional (filter) | **Finnhub** | `marketCapitalization` (millions USD) | ✅ Confirmed | AAPL: `3878463.65` (≈$3.88T), MSFT: `2916341.51` (≈$2.92T) |
| Industry | Optional (filter) | **Finnhub** | `finnhubIndustry` | ✅ Confirmed | AAPL: `"Technology"`, MSFT: `"Technology"` |

### /calendar (originally IBKR-only — DECISION NEEDED)

**IBKR TWS Probe Result (2026-03-02):**
- TWS Socket API (port 4001) connected successfully ✅
- `reqFundamentalData("CalendarReport")` → `available: false` ❌
- `reqFundamentalData("ReportsFinSummary")` → `available: false` ❌
- TWS Socket API has NO direct calendar events endpoint
- Likely cause: no Fundamental Data subscription, or TWS Socket limitations

| UI Tab | UI Field | Required? | Source | Provider field(s) | Status | Probe evidence |
|---|---|---:|---|---|---|---|
| Earnings | Date Announcement | Required | ❌ IBKR unavailable | CalendarReport not returned | ❌ **FAIL** | `reqFundamentalData("CalendarReport")` → `available: false`. Need alternative source. |
| Earnings | Time | Required | ❌ IBKR unavailable | — | ❌ **FAIL** | Same as above |
| Earnings | Symbol | Required | ❌ IBKR unavailable | — | ❌ **FAIL** | Same as above |
| Earnings | Session | Required | ❌ IBKR unavailable | — | ❌ **FAIL** | Same as above |
| Earnings | Period | Optional | ❌ IBKR unavailable | — | ❌ **FAIL** | |
| Earnings | Confirmed | Optional | ❌ IBKR unavailable | — | ❌ **FAIL** | |
| Earnings | EPS / Est. EPS / Surprise % | Optional | ❌ IBKR unavailable | — | ❌ **FAIL** | No fundamental data subscription |
| Earnings | Revenue / Est. Revenue | Optional | ❌ IBKR unavailable | — | ❌ **FAIL** | No fundamental data subscription |
| Conference | Date/Time/Symbol/Session/Confirmed | Required | ❌ IBKR unavailable | No calendar endpoint in TWS Socket API | ❌ **FAIL** | TWS Socket has no calendar event concept |
| Dividend | Date/Time/Symbol/Session/Confirmed | Required | ❌ IBKR unavailable | — | ❌ **FAIL** | Same |
| Analyst Rating | All columns | Optional | ❌ IBKR unavailable | — | ❌ **FAIL** | TWS Socket has no analyst rating API |

**⚠️ Decision required:** All /calendar fields FAIL from IBKR TWS Socket API. See "Decision needed" section below.

### Watchlist
| UI Field | Required? | Source | Provider field(s) / Computation | Status | Probe evidence |
|---|---:|---|---|---|---|
| Ticker | Required | **CSV** | read from configured CSV | ✅ Confirmed | File exists: `tradigview_screener/original_data/watch lists2_2026-02-22.csv` |
| Name | Optional | **Finnhub** | `name` from `/stock/profile2` | ✅ Confirmed | AAPL: `"name": "Apple Inc"`, MSFT: `"name": "Microsoft Corp"` |
| Mkt Cap | Optional | **Finnhub** | `marketCapitalization` (millions USD) | ✅ Confirmed | Same as News Feed market cap field |
| Industry | Optional | **Finnhub** | `finnhubIndustry` | ✅ Confirmed | Same as News Feed industry field |
| Price | Required | **Computed (OHLC)** | latest Close | ✅ DB exists | `ohlc_1d` latest `Datetime` = 2026-02-20 |
| Change | Required | **Computed (OHLC)** | Close_t - Close_{t-1} | ✅ DB exists | Needs prior bar; else `-` |
| % | Required | **Computed (OHLC)** | (Close_t/Close_{t-1}-1)\times 100 | ✅ DB exists | Needs prior bar; else `-` |

---

## Finnhub Probe — Raw Field Reference (confirmed 2026-03-02)

Probe symbols: AAPL, MSFT, TSLA. Raw JSON saved to `tmp/probes/`.

### `/stock/profile2` — confirmed fields
```json
// Example: finnhub_profile2_AAPL.json
{
  "country": "US",
  "currency": "USD",
  "exchange": "NASDAQ NMS - GLOBAL MARKET",
  "finnhubIndustry": "Technology",      // ← Industry field
  "marketCapitalization": 3878463.6457,  // ← millions USD
  "name": "Apple Inc",                   // ← Company name
  "ticker": "AAPL",
  "shareOutstanding": 14702.7,
  "ipo": "1980-12-12",
  "weburl": "https://www.apple.com/"
}
```

### `/company-news` — confirmed fields
```json
// Example: finnhub_company_news_AAPL.json (first item)
{
  "category": "company",
  "datetime": 1772441102,       // ← Unix epoch SECONDS (not ms)
  "headline": "Broadcom, Target Earnings...",  // ← Title
  "id": 139274820,              // ← Finnhub internal ID
  "image": "https://...",
  "related": "AAPL",            // ← Ticker (symbol)
  "source": "Yahoo",            // ← Source name
  "summary": "A heavy slate...",
  "url": "https://finnhub.io/api/news?id=..."
}
```

### `/calendar/earnings` — conditional
```json
// All 3 symbols returned empty:
{ "earningsCalendar": [] }
// Interpretation: no upcoming earnings at probe time, or free-tier limit.
// Action: treat as Optional — render nothing when empty.
```

---

## IBKR Probe — COMPLETED (TWS Socket API, port 4001, 2026-03-02)

Connection: TWS Socket API via `ib_insync` 0.9.86, port 4001, clientId=99
Probe script: `tmp/test_ibkr_tws_probe.py`

### Results Summary
| Capability | Status | Evidence |
|---|---|---|
| Connect to TWS | ✅ PASS | `ib.isConnected() = True` |
| Historical 1D OHLCV (AAPL) | ✅ PASS | 5 bars (2026-02-23~27), all OHLCV fields present. File: `ibkr_historical_1d_AAPL.json` |
| Contract Details (AAPL) | ✅ PASS | longName="APPLE INC", industry="Technology", category="Computers". File: `ibkr_contract_details_AAPL.json` |
| CalendarReport fundamental | ❌ FAIL | `reqFundamentalData("CalendarReport")` → `available: false` |
| FinSummary fundamental | ❌ FAIL | `reqFundamentalData("ReportsFinSummary")` → `available: false` |
| Calendar events endpoint | ❌ N/A | TWS Socket API has no dedicated calendar endpoint (Client Portal only) |

### Raw field reference: Historical 1D bars
```json
// ibkr_historical_1d_AAPL.json (sample)
{
  "date": "2026-02-27",
  "open": 272.77,
  "high": 272.81,
  "low": 262.89,
  "close": 264.18,
  "volume": 26235914
}
```

### Raw field reference: Contract Details
```json
// ibkr_contract_details_AAPL.json
{
  "longName": "APPLE INC",
  "industry": "Technology",
  "category": "Computers",
  "subcategory": "Computers",
  "marketName": "NMS",
  "stockType": "COMMON"
}
```

### Conclusion
- **IBKR OHLC 1D: ✅ PASS** — can fetch daily bars via `reqHistoricalData`
- **IBKR Contract Details: ✅ PASS** — name, industry available via `reqContractDetails`
- **IBKR Calendar/Fundamental: ❌ FAIL** — not available without Fundamental Data subscription or Client Portal Gateway

---

## Overall Audit Verdict (2026-03-02, UPDATED after IBKR probe)

### Finnhub: ✅ PASS (for News Feed + Watchlist)
- All required fields confirmed via raw JSON probes.
- Earnings calendar: empty but Optional → no blocker.

### IBKR OHLC 1D: ✅ PASS
- TWS Socket API (port 4001) connection confirmed.
- `reqHistoricalData` returns correct OHLCV bars (tested: AAPL, 5 bars).
- Can be used for Step 7 (IBKR 1D OHLC ingestion).

### IBKR Calendar/Fundamental: ❌ FAIL
- `reqFundamentalData("CalendarReport")` → not available
- `reqFundamentalData("ReportsFinSummary")` → not available
- TWS Socket API has no direct calendar events endpoint
- **All /calendar UI fields cannot be sourced from IBKR TWS Socket API**

### OHLC (existing DB): ✅ PASS
- `ohlc_1d_watchlist.sqlite` confirmed: table `ohlc_1d` with columns `Symbol, Datetime, Open, High, Low, Close, Volume`.
- Latest data: 2026-02-20.
- Sufficient for all "Changes %" computations.

### ⚠️ Decision needed: /calendar data source
The plan states "/calendar must use IBKR calendar data only" but IBKR TWS Socket API cannot provide this data.

Options:
1. **Use Finnhub earnings calendar** as primary source for /calendar (relaxes IBKR-only requirement)
2. **Install Client Portal Gateway** separately (HTTP REST has `/iserver/account/pnl` and calendar endpoints, but requires separate auth flow)
3. **Subscribe to IBKR Fundamental Data** (enables `reqFundamentalData` CalendarReport in TWS)
4. **Scope reduction** — reduce /calendar UI to only what's available (OHLC-derived data only, no earnings/analyst)

---

## Probe Plan (what to run)
This section defines the minimal probes to confirm availability.

### Finnhub probes (backend-only)
Run for 2–3 symbols: `AAPL`, `MSFT`, `TSLA`.

Script (recommended)
- Use the repo probe script:
  - `node terminal/backend/test_finnhub_probe.mjs --symbols AAPL,MSFT,TSLA --days 30`
- Notes
  - The script prints request URLs with the `token` redacted.
  - Raw JSON is saved under `tmp/probes/` for manual inspection.

1) Company profile probe
- Goal: confirm market cap + industry field names and units.
- Output: raw JSON sample per symbol.

2) Company news probe
- Goal: confirm date/time field, title, source fields.
- Output: raw JSON sample (small page).

3) Earnings date/calendar probe (if used)
- Goal: confirm whether next earnings date is available.
- Output: raw JSON sample.

### IBKR probes (backend-only)
1) 1D OHLCV probe
- Goal: confirm we can fetch daily bars for a symbol and map to (Open/High/Low/Close/Volume) + date.
- Output: raw JSON sample and a mapped “bars” sample.

2) Calendar events probe
- Goal: confirm IBKR can return calendar events that match `/calendar` UI columns.
- Output: raw JSON sample.

---

## Audit Outputs (files to save)
To make results reproducible without leaking secrets:
- Save raw JSON under a short path (recommended):
  - `tmp/probes/finnhub_profile_AAPL.json`
  - `tmp/probes/finnhub_news_AAPL.json`
  - `tmp/probes/finnhub_earnings_AAPL.json`
  - `tmp/probes/ibkr_ohlc1d_AAPL.json`
  - `tmp/probes/ibkr_calendar_sample.json`

Concrete filenames produced by `test_finnhub_probe.mjs`
- `tmp/probes/finnhub_profile2_AAPL.json`
- `tmp/probes/finnhub_company_news_AAPL.json`
- `tmp/probes/finnhub_calendar_earnings_AAPL.json`

Do not store API keys inside these files.

---

## Pass/Fail Criteria
Pass
- Every UI column in the capability matrix has a finalized Source.
- For every provider-backed Source (IBKR/Finnhub), at least one raw JSON probe confirms the field exists.

Fail (stop for decision)
- `/calendar` required fields cannot be sourced from IBKR.
- News Feed required fields cannot be sourced from Finnhub or computed from OHLC.

### Current verdict (2026-03-02, UPDATED after IBKR TWS probe)
- **Finnhub (News Feed + Watchlist): ✅ PASS** — all required fields confirmed.
- **IBKR OHLC 1D: ✅ PASS** — `reqHistoricalData` confirmed via TWS Socket API (port 4001).
- **IBKR Calendar/Fundamental: ❌ FAIL** — CalendarReport/FinSummary unavailable. Decision needed.
- **OHLC DB (Changes %): ✅ PASS** — DB schema and data confirmed.

Probe files:
- `tmp/probes/ibkr_historical_1d_AAPL.json`
- `tmp/probes/ibkr_contract_details_AAPL.json`
- `tmp/probes/ibkr_probe_summary.json`


---

## KO

### 목적
이 문서는 이 프로젝트에서 말하는 “데이터 수집 가능 범위 점검(감사)”가 무엇인지 정의한다.
- UI 필드별로 **IBKR / Finnhub / OHLC 기반 계산 / 불가**를 확정한다.
- “구현 전에 가능한지 먼저 확인”하는 **fail-fast 게이트** 역할을 한다.

가짜 placeholder를 UI에 넣지 않는다.

### 범위(무엇을 점검하는가)
아래 UI 영역이 암시하는 필드들을 점검한다.
1) **News Feed: finhub api** 윈도우
2) **/calendar** 윈도우(IBKR-only)
3) **Watchlist** 윈도우

### 공급자 및 저장소
- **Finnhub**
  - 사용 용도: company news, company profile(시총/산업), (가능하면) 실적일자
  - 백엔드에서만 접근(브라우저 직접 호출 금지)
- **IBKR**
  - 사용 용도: 캘린더 이벤트(IBKR-only), 1D OHLCV(가격 업데이트)
  - 백엔드에서만 접근
- **OHLC canonical 저장소(기존)**
  - `OHLC_data/ohlc_1d_watchlist.sqlite` (테이블 `ohlc_1d`)
  - News Feed의 “Changes %” 파생값 계산에 사용

### 절대 조건(필수)
- 시크릿(API 키/토큰)을 로그/출력에 남기지 않는다.
- 없는 필드를 채우기 위해 mock/synthetic 데이터를 만들지 않는다.
- 필수 필드가 불가능하면 **Not available**로 기록하고 사용자 결정 전에는 진행하지 않는다.

---

## Capability Matrix (확정 — 2026-03-02)
각 행은 프로브 결과로 채움. 상태: ✅ 확인됨 | ⚠️ 조건부 | ❌ 미프로브

### News Feed: finhub api
| UI 필드 | 필수? | Source | 공급자 필드 / 계산식 | 상태 | 프로브 근거 |
|---|---:|---|---|---|---|
| Date | 필수 | **Finnhub** | `datetime` (Unix epoch 초단위) → NY 날짜 | ✅ 확인 | `finnhub_company_news_AAPL.json`: `"datetime": 1772441102` |
| Time | 필수 | **Finnhub** | `datetime` (Unix epoch 초단위) → NY 시간 | ✅ 확인 | Date와 동일 필드 |
| Title | 필수 | **Finnhub** | `headline` | ✅ 확인 | `"headline": "Broadcom, Target Earnings and Jobs Report..."` |
| Sources | 필수 | **Finnhub** | `source` | ✅ 확인 | `"source": "Yahoo"` |
| Changes%: `Chg` | 필수 | **Computed (OHLC)** | $(Close_t/Close_{t-1}-1)\times 100$ | ✅ DB 확인 | `ohlc_1d` 테이블에 Close 컬럼 존재 |
| Changes%: `fr.Open` | 필수 | **Computed (OHLC)** | $(Close_t/Open_t-1)\times 100$ | ✅ DB 확인 | Open + Close 컬럼 존재 |
| Changes%: `+7D` | 필수 | **Computed (OHLC)** | $(Close_t/Close_{t-7}-1)\times 100$ (거래일) | ✅ DB 확인 | ≥7 prior bars 필요; 없으면 `-` |
| Changes%: `+14D` | 필수 | **Computed (OHLC)** | $(Close_t/Close_{t-14}-1)\times 100$ (거래일) | ✅ DB 확인 | ≥14 prior bars 필요; 없으면 `-` |
| Changes%: `+30D` | 필수 | **Computed (OHLC)** | $(Close_t/Close_{t-30}-1)\times 100$ (거래일) | ✅ DB 확인 | ≥30 prior bars 필요; 없으면 `-` |
| Earning: `<date>` 라인 | 선택 | **Finnhub** (조건부) | `/calendar/earnings` 엔드포인트 | ⚠️ 빈 배열 | 3개 심볼 모두 `{"earningsCalendar": []}`. 빈 경우 표시하지 않음. |
| Market cap | 선택(필터) | **Finnhub** | `marketCapitalization` (백만 USD) | ✅ 확인 | AAPL: `3878463.65` (≈$3.88T) |
| Industry | 선택(필터) | **Finnhub** | `finnhubIndustry` | ✅ 확인 | AAPL: `"Technology"` |

### /calendar (원래 IBKR-only — 의사결정 필요)

**IBKR TWS 프로브 결과 (2026-03-02):**
- TWS Socket API (port 4001) 연결 성공 ✅
- `reqFundamentalData("CalendarReport")` → `available: false` ❌
- `reqFundamentalData("ReportsFinSummary")` → `available: false` ❌
- TWS Socket API에는 calendar events 엔드포인트 없음
- 원인 추정: Fundamental Data 구독 미보유 또는 TWS Socket 제한

| 탭 | UI 필드 | 필수? | Source | 공급자 필드 | 상태 | 프로브 근거 |
|---|---|---:|---|---|---|---|
| Earnings | Date Announcement | 필수 | ❌ IBKR 불가 | CalendarReport 미반환 | ❌ **FAIL** | `reqFundamentalData("CalendarReport")` → `available: false`. 대안 소스 필요. |
| Earnings | Time | 필수 | ❌ IBKR 불가 | — | ❌ **FAIL** | 동일 |
| Earnings | Symbol | 필수 | ❌ IBKR 불가 | — | ❌ **FAIL** | 동일 |
| Earnings | Session | 필수 | ❌ IBKR 불가 | — | ❌ **FAIL** | 동일 |
| Earnings | Period | 선택 | ❌ IBKR 불가 | — | ❌ **FAIL** | |
| Earnings | Confirmed | 선택 | ❌ IBKR 불가 | — | ❌ **FAIL** | |
| Earnings | EPS / Est. EPS / Surprise % | 선택 | ❌ IBKR 불가 | — | ❌ **FAIL** | Fundamental data 구독 없음 |
| Earnings | Revenue / Est. Revenue | 선택 | ❌ IBKR 불가 | — | ❌ **FAIL** | Fundamental data 구독 없음 |
| Conference | Date/Time/Symbol/Session/Confirmed | 필수 | ❌ IBKR 불가 | TWS Socket에 calendar endpoint 없음 | ❌ **FAIL** | TWS Socket에는 calendar 개념 없음 |
| Dividend | Date/Time/Symbol/Session/Confirmed | 필수 | ❌ IBKR 불가 | — | ❌ **FAIL** | 동일 |
| Analyst Rating | 모든 컴럼 | 선택 | ❌ IBKR 불가 | — | ❌ **FAIL** | TWS Socket에 analyst rating API 없음 |

**⚠️ 의사결정 필요:** /calendar 필드 전체가 IBKR TWS Socket API에서 FAIL. 아래 "의사결정 필요" 섹션 참조.

### Watchlist
| UI 필드 | 필수? | Source | 공급자 필드 / 계산식 | 상태 | 프로브 근거 |
|---|---:|---|---|---|---|
| Ticker | 필수 | **CSV** | 설정된 CSV에서 읽기 | ✅ 확인 | 파일 존재: `tradigview_screener/original_data/watch lists2_2026-02-22.csv` |
| Name | 선택 | **Finnhub** | `/stock/profile2` → `name` | ✅ 확인 | AAPL: `"Apple Inc"`, MSFT: `"Microsoft Corp"` |
| Mkt Cap | 선택 | **Finnhub** | `marketCapitalization` (백만 USD) | ✅ 확인 | News Feed market cap과 동일 |
| Industry | 선택 | **Finnhub** | `finnhubIndustry` | ✅ 확인 | News Feed industry와 동일 |
| Price | 필수 | **Computed (OHLC)** | 최신 Close | ✅ DB 확인 | `ohlc_1d` 최신 `Datetime` = 2026-02-20 |
| Change | 필수 | **Computed (OHLC)** | Close_t - Close_{t-1} | ✅ DB 확인 | 전일 bar 없으면 `-` |
| % | 필수 | **Computed (OHLC)** | (Close_t/Close_{t-1}-1)\times 100 | ✅ DB 확인 | 전일 bar 없으면 `-` |

---

## Finnhub 프로브 — 확인된 데이터 필드 레퍼런스 (2026-03-02)

프로브 심볼: AAPL, MSFT, TSLA. 원시 JSON은 `tmp/probes/`에 저장.

### `/stock/profile2` — 확인된 필드
```json
// 예시: finnhub_profile2_AAPL.json
{
  "country": "US",
  "currency": "USD",
  "exchange": "NASDAQ NMS - GLOBAL MARKET",
  "finnhubIndustry": "Technology",      // ← Industry
  "marketCapitalization": 3878463.6457,  // ← 백만 USD
  "name": "Apple Inc",                   // ← 회사명
  "ticker": "AAPL",
  "shareOutstanding": 14702.7,
  "ipo": "1980-12-12",
  "weburl": "https://www.apple.com/"
}
```

### `/company-news` — 확인된 필드
```json
// 예시: finnhub_company_news_AAPL.json (첫 항목)
{
  "category": "company",
  "datetime": 1772441102,       // ← Unix epoch 초(ms 아님)
  "headline": "Broadcom, Target Earnings...",  // ← 제목
  "id": 139274820,              // ← Finnhub 내부 ID
  "image": "https://...",
  "related": "AAPL",            // ← 티커(심볼)
  "source": "Yahoo",            // ← 출처
  "summary": "A heavy slate...",
  "url": "https://finnhub.io/api/news?id=..."
}
```

### `/calendar/earnings` — 조건부
```json
// 3개 심볼 모두 빈 배열:
{ "earningsCalendar": [] }
// 해석: 프로브 시점에 예정 실적 없음, 또는 무료 등급 제한.
// 처리: Optional → 빈 경우 표시하지 않음.
```

---

## IBKR 프로브 — 완료 (TWS Socket API, port 4001, 2026-03-02)

연결: TWS Socket API, `ib_insync` 0.9.86, port 4001, clientId=99
프로브 스크립트: `tmp/test_ibkr_tws_probe.py`

### 결과 요약
| 기능 | 상태 | 근거 |
|---|---|---|
| TWS 연결 | ✅ PASS | `ib.isConnected() = True` |
| Historical 1D OHLCV (AAPL) | ✅ PASS | 5 bars (2026-02-23~27), OHLCV 전체 필드. 파일: `ibkr_historical_1d_AAPL.json` |
| Contract Details (AAPL) | ✅ PASS | longName="APPLE INC", industry="Technology". 파일: `ibkr_contract_details_AAPL.json` |
| CalendarReport fundamental | ❌ FAIL | `reqFundamentalData("CalendarReport")` → `available: false` |
| FinSummary fundamental | ❌ FAIL | `reqFundamentalData("ReportsFinSummary")` → `available: false` |
| Calendar events endpoint | ❌ N/A | TWS Socket API에는 calendar endpoint 없음 (Client Portal만 가능) |

### 원시 필드 레퍼런스: Historical 1D bars
```json
// ibkr_historical_1d_AAPL.json (샘플)
{
  "date": "2026-02-27",
  "open": 272.77,
  "high": 272.81,
  "low": 262.89,
  "close": 264.18,
  "volume": 26235914
}
```

### 원시 필드 레퍼런스: Contract Details
```json
// ibkr_contract_details_AAPL.json
{
  "longName": "APPLE INC",
  "industry": "Technology",
  "category": "Computers",
  "subcategory": "Computers",
  "marketName": "NMS",
  "stockType": "COMMON"
}
```

### 결론
- **IBKR OHLC 1D: ✅ PASS** — `reqHistoricalData`로 일봉 수신 가능
- **IBKR Contract Details: ✅ PASS** — 회사명, 산업 취득 가능
- **IBKR Calendar/Fundamental: ❌ FAIL** — Fundamental Data 구독 또는 Client Portal Gateway 없이는 불가

---

## 전체 감사 결론 (2026-03-02, IBKR 프로브 후 업데이트)

### Finnhub: ✅ PASS (News Feed + Watchlist)
- 필수 필드 모두 원시 JSON 프로브로 확인됨.
- Earnings calendar: 빈 배열이지만 Optional → 블로커 아님.

### IBKR OHLC 1D: ✅ PASS
- TWS Socket API (port 4001) 연결 확인.
- `reqHistoricalData` 정상 OHLCV bars 반환 (테스트: AAPL, 5 bars).
- Step 7 (IBKR 1D OHLC 인제스트)에 사용 가능.

### IBKR Calendar/Fundamental: ❌ FAIL
- `reqFundamentalData("CalendarReport")` → 불가
- `reqFundamentalData("ReportsFinSummary")` → 불가
- TWS Socket API에 calendar events 엔드포인트 없음
- **/calendar UI 필드 전체를 IBKR TWS Socket API에서 가져올 수 없음**

### OHLC (기존 DB): ✅ PASS
- `ohlc_1d_watchlist.sqlite` 확인: 테이블 `ohlc_1d`, 컴럼 `Symbol, Datetime, Open, High, Low, Close, Volume`.
- 최신 데이터: 2026-02-20.
- "Changes %" 계산에 충분.

### ⚠️ 의사결정 필요: /calendar 데이터 소스
plan.md에서 "/calendar은 IBKR 데이터만 사용"이라 했는데, IBKR TWS Socket API로는 이 데이터를 가져올 수 없음.

선택지:
1. **Finnhub earnings calendar 대체** — /calendar의 기본 데이터 소스를 Finnhub로 (IBKR-only 요구사항 완화)
2. **Client Portal Gateway 추가 설치** — HTTP REST calendar endpoint 사용 (별도 인증/설치 필요)
3. **IBKR Fundamental Data 구독** — TWS에서 CalendarReport 활성화
4. **스코프 축소** — 가능한 필드만으로 /calendar UI 제한 (OHLC 파생 데이터만)

---

## 프로브 계획(무엇을 실행하는가)
필드 존재 여부를 확인하기 위한 최소 프로브를 정의한다.

### Finnhub 프로브(백엔드에서만)
2–3개 심볼: `AAPL`, `MSFT`, `TSLA`.

스크립트(권장)
- 레포의 프로브 스크립트를 사용한다:
  - `node terminal/backend/test_finnhub_probe.mjs --symbols AAPL,MSFT,TSLA --days 30`
- 참고
  - 스크립트는 URL에 포함된 `token`을 로그에 출력할 때 `REDACTED`로 마스킹한다.
  - 원시 JSON은 수동 점검을 위해 `tmp/probes/` 아래에 저장된다.

1) Company profile 프로브
- 목적: market cap/industry 필드명과 단위 확인
- 출력: 심볼별 원시 JSON

2) Company news 프로브
- 목적: 날짜/시간/제목/소스 필드 확인
- 출력: 원시 JSON(작은 페이지)

3) Earnings date/calendar 프로브(사용할 경우)
- 목적: 다음 실적일자 제공 여부 확인
- 출력: 원시 JSON

### IBKR 프로브(백엔드에서만)
1) 1D OHLCV 프로브
- 목적: 일봉 데이터(OHLCV)를 가져와 날짜+값 매핑이 가능한지 확인
- 출력: 원시 JSON + 매핑된 bars 샘플

2) 캘린더 이벤트 프로브
- 목적: `/calendar` UI 컬럼에 맞는 이벤트/필드 제공 여부 확인
- 출력: 원시 JSON

---

## 감사 산출물(저장 파일)
재현 가능하게 하기 위해(시크릿 없이) 원시 JSON을 짧은 경로로 저장한다.
- 권장:
  - `tmp/probes/finnhub_profile_AAPL.json`
  - `tmp/probes/finnhub_news_AAPL.json`
  - `tmp/probes/finnhub_earnings_AAPL.json`
  - `tmp/probes/ibkr_ohlc1d_AAPL.json`
  - `tmp/probes/ibkr_calendar_sample.json`

`test_finnhub_probe.mjs`가 생성하는 실제 파일명
- `tmp/probes/finnhub_profile2_AAPL.json`
- `tmp/probes/finnhub_company_news_AAPL.json`
- `tmp/probes/finnhub_calendar_earnings_AAPL.json`

API 키를 이 파일들에 포함시키지 않는다.

---

## 통과/실패 기준
통과
- capability matrix의 모든 UI 컬럼에 Source가 확정되어 있다.
- IBKR/Finnhub로부터 온다고 표시된 필드는 원시 JSON 프로브로 최소 1회 이상 존재가 확인된다.

실패(의사결정 전까지 중단)
- `/calendar`의 필수 필드를 IBKR에서 소싱할 수 없다.
- News Feed의 필수 필드를 Finnhub에서 소싱할 수 없고, OHLC로도 계산 불가능하다.

### 현재 결론 (2026-03-02, IBKR TWS 프로브 후 업데이트)
- **Finnhub (News Feed + Watchlist): ✅ PASS** — 필수 필드 전부 확인됨.
- **IBKR OHLC 1D: ✅ PASS** — TWS Socket API (port 4001)로 `reqHistoricalData` 확인.
- **IBKR Calendar/Fundamental: ❌ FAIL** — CalendarReport/FinSummary 불가. 의사결정 필요.
- **OHLC DB (Changes %): ✅ PASS** — DB 스키마 및 데이터 확인됨.

프로브 파일:
- `tmp/probes/ibkr_historical_1d_AAPL.json`
- `tmp/probes/ibkr_contract_details_AAPL.json`
- `tmp/probes/ibkr_probe_summary.json`
