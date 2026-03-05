# Step 0 — Data Availability Audit (Comprehensive)

## EN

> ⚠️ EN section may be outdated — KO section is the authoritative source.

### Probe date
2026-03-03

### Probe symbol
AAPL (primary), SPY/JPM (ETF/bank branch checks)

### Scripts used
- `terminal/backend/test_finnhub_probe.mjs` — original 3-endpoint probe
- `terminal/backend/test_finnhub_full_probe.mjs` — comprehensive 67-endpoint probe (created 2026-03-03)

### Raw JSON outputs
- `tmp/probes/finnhub_comprehensive_probe.json` — 63 endpoints (first run)
- `tmp/probes/finnhub_full_probe_results.json` — 67 endpoints (second run, added ETF Holdings/Sector, Earnings Call Live, Company Presentation, Historical ESG, Bank Branch)

---

## 1. Finnhub API — Comprehensive Endpoint Matrix

**Summary: 67 endpoints tested → 40 ✅ accessible, 1 ⚠️ empty, 26 ❌ denied (403)**

### 1.1 Stock Fundamentals

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 1 | Company Profile 2 | `/stock/profile2` | Free | 200 | ✅ DATA | `{country,currency,exchange,finnhubIndustry,logo,marketCapitalization,name,ticker,...}` |
| 2 | Company Profile (v1) | `/stock/profile` | Premium | 403 | ❌ DENIED | — |
| 3 | Company Executive | `/stock/executive` | Premium | 200 | ✅ DATA | `{executive[],symbol}` |
| 4 | Peers | `/stock/peers` | Free | 200 | ✅ DATA | `array[12]` of ticker strings |
| 5 | Basic Financials | `/stock/metric?metric=all` | Free | 200 | ✅ DATA | `{metric,metricType,series,symbol}` — 52-week high/low, PE, EPS, etc. |
| 6 | Ownership | `/stock/ownership` | Premium | 200 | ✅ DATA | `{ownership[],symbol}` |
| 7 | Fund Ownership | `/stock/fund-ownership` | Premium | 200 | ✅ DATA | `{ownership[],symbol}` |
| 8 | Institutional Profile | `/institutional/profile` | Premium | 200 | ✅ DATA | profile object |
| 9 | Insider Transactions | `/stock/insider-transactions` | Free | 200 | ✅ DATA | `{data[],symbol}` |
| 10 | Insider Sentiment | `/stock/insider-sentiment` | Free | 200 | ✅ DATA | `{data[],symbol}` |
| 11 | Financial Statements (bs) | `/stock/financials?statement=bs` | Premium | 200 | ✅ DATA | `{financials[],symbol}` |
| 12 | Financial Statements (ic) | `/stock/financials?statement=ic` | Premium | 200 | ✅ DATA | `{financials[],symbol}` |
| 13 | Financials As Reported | `/stock/financials-reported` | Free | 200 | ✅ DATA | `{cik,data[],symbol}` |
| 14 | Revenue Breakdown | `/stock/revenue-breakdown` | Premium | 200 | ✅ DATA | `{cik,data[],symbol}` |
| 15 | Revenue Breakdown & KPI | `/stock/revenue-breakdown2` | Premium/Enterprise | 403 | ❌ DENIED | — |
| 16 | SEC Filings | `/stock/filings` | Free | 200 | ✅ DATA | `array[78] {accessNumber,form,filedDate,reportUrl,...}` |
| 17 | SEC Sentiment Analysis | `/stock/filings-sentiment` | Premium | 200 | ✅ DATA | `{cik,symbol,accessNumber,sentiment}` |
| 18 | Similarity Index | `/stock/similarity-index` | Premium | 200 | ✅ DATA | `{cik,similarity[],symbol}` |
| 19 | IPO Calendar | `/calendar/ipo` | Free | 200 | ✅ DATA | `{ipoCalendar[]}` |
| 20 | Dividends | `/stock/dividend` | Premium | 200 | ✅ DATA | `array[4] {amount,date,payDate,...}` |
| 21 | Dividends 2 (Basic) | `/stock/dividend2` | Premium | 403 | ❌ DENIED | — |
| 22 | Splits | `/stock/split` | Premium | 403 | ❌ DENIED | — |
| 23 | Sector Metrics | `/sector/metrics` | Premium | 200 | ✅ DATA | `{data[],region}` |
| 24 | Price Metrics | `/stock/price-metric` | Premium | 200 | ✅ DATA | `{atDate,data[],symbol}` |
| 25 | Symbol Change | `/ca/symbol-change` | Premium | 200 | ✅ DATA | `{data[],fromDate,toDate}` |
| 26 | Historical Market Cap | `/stock/historical-market-cap` | Premium | 403 | ❌ DENIED | — |
| 27 | Historical Employee Count | `/stock/historical-employee-count` | Premium | 403 | ❌ DENIED | — |
| 28 | Market Status | `/stock/market-status` | Free | 200 | ✅ DATA | `{exchange,isOpen,session,t,timezone}` |
| 29 | Market Holiday | `/stock/market-holiday` | Free | 200 | ✅ DATA | `{data[],exchange,timezone}` |
| 30 | Symbol Lookup | `/search` | Free | 200 | ✅ DATA | `{count,result[]}` |
| 31 | Stock Symbols (US) | `/stock/symbol?exchange=US` | Free | 200 | ✅ DATA | `array[30107]` |

### 1.2 News & Press Releases

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 32 | Market News (general) | `/news?category=general` | Free | 200 | ✅ DATA | `array[100] {category,datetime,headline,id,image,source,summary,url}` |
| 33 | Company News | `/company-news` | Free | 200 | ✅ DATA | `array[249] {category,datetime,headline,id,image,related,source,summary,url}` |
| 34 | **Press Releases** | `/press-releases` | Premium | 200 | ✅ DATA | `{majorDevelopment[],symbol}` |
| 35 | News Sentiment | `/news-sentiment` | Premium | 200 | ✅ DATA | `{buzz,companyNewsScore,sectorAverageBullishPercent,sentiment,symbol}` |
| 36 | Newsroom | `/stock/newsroom` | Premium/Enterprise | 403 | ❌ DENIED | — |

### 1.3 Stock Estimates

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 37 | Recommendation Trends | `/stock/recommendation` | Free | 200 | ✅ DATA | `array[4] {buy,hold,period,sell,strongBuy,strongSell,symbol}` |
| 38 | Price Target | `/stock/price-target` | Premium | 403 | ❌ DENIED | — |
| 39 | Upgrade/Downgrade | `/stock/upgrade-downgrade` | Premium | 403 | ❌ DENIED | — |
| 40 | Revenue Estimates | `/stock/revenue-estimate` | Premium | 403 | ❌ DENIED | — |
| 41 | EPS Estimates | `/stock/eps-estimate` | Premium | 403 | ❌ DENIED | — |
| 42 | EBITDA Estimates | `/stock/ebitda-estimate` | Premium | 403 | ❌ DENIED | — |
| 43 | EBIT Estimates | `/stock/ebit-estimate` | Premium | 403 | ❌ DENIED | — |
| 44 | Earnings Surprises | `/stock/earnings` | Free | 200 | ✅ DATA | `array[4] {actual,estimate,period,surprise,surprisePercent,symbol}` |
| 45 | Earnings Calendar | `/calendar/earnings` | Free | 200 | ⚠️ EMPTY | `{earningsCalendar:[]}` — no upcoming in queried range |

### 1.4 Stock Price

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 46 | Quote | `/quote` | Free | 200 | ✅ DATA | `{c,d,dp,h,l,o,pc,t}` — current/open/high/low/prevClose |
| 47 | Stock Candles (OHLCV) | `/stock/candle` | Premium | 403 | ❌ DENIED | — |

### 1.5 ETFs & Indices

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 48 | Indices Constituents (^GSPC) | `/index/constituents` | Premium | 403 | ❌ DENIED | — |
| 49 | ETF Profile (SPY) | `/etf/profile` | Premium | 403 | ❌ DENIED | — |
| 50 | ETF Holdings (SPY) | `/etf/holdings` | Premium | 403 | ❌ DENIED | — |
| 51 | ETF Sector Exposure (SPY) | `/etf/sector` | Premium | 403 | ❌ DENIED | — |

### 1.6 Alternative Data

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 52 | Social Sentiment | `/stock/social-sentiment` | Premium | 200 | ✅ DATA | `{data[],symbol}` |
| 53 | Investment Themes | `/stock/investment-theme` | Premium | 200 | ✅ DATA | `{data[],theme}` |
| 54 | Congressional Trading | `/stock/congressional-trading` | Premium | 200 | ✅ DATA | `{data[],symbol}` |
| 55 | H1-B Visa Application | `/stock/visa-application` | Free | 200 | ✅ DATA | `{data[],symbol}` |
| 56 | Senate Lobbying | `/stock/lobbying` | Free | 200 | ✅ DATA | `{data[],symbol}` |
| 57 | USA Spending | `/stock/usa-spending` | Free | 200 | ✅ DATA | `{data[],symbol}` |
| 58 | USPTO Patents | `/stock/uspto-patent` | Free | 200 | ⚠️ EMPTY | `{data:[],symbol}` — AAPL returned empty |
| 59 | FDA Calendar | `/fda-advisory-committee-calendar` | Free | 200 | ✅ DATA | `array[580] {fromDate,toDate,eventDescription,url}` |
| 60 | Transcripts List | `/stock/transcripts/list` | Premium | 403 | ❌ DENIED | — |
| 61 | Earnings Call Live | `/stock/earnings-call-live` | Premium | 403 | ❌ DENIED | — |
| 62 | Company Presentation | `/stock/presentation` | Premium | 403 | ❌ DENIED | — |
| 63 | Supply Chain | `/stock/supply-chain` | Premium | 403 | ❌ DENIED | — |
| 64 | Company ESG Scores | `/stock/esg` | Premium | 403 | ❌ DENIED | — |
| 65 | Historical ESG Scores | `/stock/historical-esg` | Premium | 403 | ❌ DENIED | — |
| 66 | Earnings Quality Score | `/stock/earnings-quality-score` | Premium | 403 | ❌ DENIED | — |
| 67 | Newsroom | `/stock/newsroom` | Premium/Enterprise | 403 | ❌ DENIED | — |

### 1.7 Economic & Bank

| # | Endpoint | API Path | Tier | HTTP | Verdict | Response Shape |
|---|----------|----------|------|------|---------|----------------|
| 68 | Economic Calendar | `/calendar/economic` | Premium | 403 | ❌ DENIED | — |
| 69 | Country List | `/country` | Free | 200 | ✅ DATA | `array[249] {code2,code3,country,currency,...}` |
| 70 | Bank Branch (JPM) | `/bank-branch` | Premium | 200 | ✅ DATA | `{data[],symbol}` |

### 1.8 Forex & Crypto (reference only)

| # | Endpoint | API Path | Tier | HTTP | Verdict |
|---|----------|----------|------|------|---------|
| 71 | Forex Exchanges | `/forex/exchange` | Free | 200 | ✅ DATA |
| 72 | Crypto Exchanges | `/crypto/exchange` | Free | 200 | ✅ DATA |

---

## 2. Summary by Tier & Status

### Accessible endpoints with data (40 total)

**Free tier accessible (23):**
| Endpoint | Key data |
|----------|----------|
| Company Profile 2 | name, industry, marketCap, logo, IPO date |
| Peers | array of peer tickers |
| Basic Financials | 52w high/low, PE, EPS, beta, dividend yield, etc. |
| Insider Transactions | insider buy/sell data |
| Insider Sentiment | insider sentiment scores |
| Financials As Reported | SEC filings financial data (as reported) |
| SEC Filings | filing list with URLs |
| IPO Calendar | upcoming IPOs |
| Market Status | exchange open/close status |
| Market Holiday | holiday schedule by exchange |
| Symbol Lookup | search symbols by query |
| Stock Symbols | full US symbol list (30K+) |
| Market News (general) | global market news feed |
| Company News | company-specific news (1yr free history) |
| Recommendation Trends | analyst buy/hold/sell consensus |
| Earnings Surprises | actual vs estimate (last 4 quarters) |
| Quote | real-time-ish price, open, high, low, prevClose |
| H1-B Visa Application | visa applications by company |
| Senate Lobbying | lobbying data |
| USA Spending | government contracts |
| FDA Calendar | FDA advisory committee calendar |
| Country List | country metadata |
| Forex/Crypto Exchanges | exchange lists (reference) |

**Premium tier accessible (17) — included in current subscription:**
| Endpoint | Key data |
|----------|----------|
| Company Executive | C-suite names, titles, compensation |
| Ownership | institutional ownership breakdown |
| Fund Ownership | mutual fund/ETF ownership |
| Institutional Profile | institutional investor profiles |
| Financial Statements (bs/ic) | standardized balance sheet & income statement |
| Revenue Breakdown | revenue by segment/geography |
| SEC Sentiment Analysis | sentiment analysis of SEC filings |
| Similarity Index | 10-K/10-Q text similarity year-over-year |
| Dividends | dividend history with dates/amounts |
| Sector Metrics | sector-level financial metrics |
| Price Metrics | price performance metrics |
| Symbol Change | corporate action symbol changes |
| **Press Releases** | **major development press releases** |
| News Sentiment | news sentiment scores + buzz metrics |
| Social Sentiment | Reddit/Twitter sentiment |
| Investment Themes | thematic investment data |
| Congressional Trading | congress member trades |
| Bank Branch | bank location data (JPM tested) |

### Empty / conditional (1)
| Endpoint | Notes |
|----------|-------|
| Earnings Calendar | `{earningsCalendar:[]}` — data depends on query date range; works when upcoming earnings exist |

### Denied — 403 Forbidden (26)
| Endpoint | Tier | Notes |
|----------|------|-------|
| Company Profile (v1) | Premium | v2 works, v1 requires higher tier |
| Revenue Breakdown & KPI | Enterprise | Enterprise-only |
| Dividends 2 (Basic) | Premium | regular `/stock/dividend` works |
| Splits | Premium | higher tier needed |
| Historical Market Cap | Premium | higher tier needed |
| Historical Employee Count | Premium | higher tier needed |
| Newsroom | Enterprise | Enterprise-only |
| Price Target | Premium | analyst price targets — higher tier |
| Upgrade/Downgrade | Premium | analyst upgrade/downgrades — higher tier |
| Revenue Estimates | Premium | consensus estimates — higher tier |
| EPS Estimates | Premium | consensus estimates — higher tier |
| EBITDA Estimates | Premium | consensus estimates — higher tier |
| EBIT Estimates | Premium | consensus estimates — higher tier |
| Stock Candles (OHLCV) | Premium | requires Stock Price add-on (separate from fundamentals) |
| Indices Constituents | Premium | requires different subscription |
| ETF Profile (SPY) | Premium | ETF add-on needed |
| ETF Holdings (SPY) | Premium | ETF add-on needed |
| ETF Sector Exposure (SPY) | Premium | ETF add-on needed |
| Transcripts List | Premium | earnings call transcripts — higher tier |
| Earnings Call Live | Premium | live earnings call — higher tier |
| Company Presentation | Premium | company presentations — higher tier |
| Supply Chain | Premium | supply chain relationships — higher tier |
| Company ESG Scores | Premium | ESG data — higher tier |
| Historical ESG Scores | Premium | ESG data — higher tier |
| Earnings Quality Score | Premium | higher tier |
| Economic Calendar | Premium | economic events — higher tier |

---

## 3. IBKR TWS Probe Results

### 3.1 Basic TWS API (probed earlier)

| Capability | Status | Details |
|------------|--------|--------|
| TWS Connect (port 4001) | ✅ PASS | `ib_insync` 0.9.86 |
| Historical 1D OHLCV | ✅ PASS | `reqHistoricalData` works for stocks |
| Contract Details | ✅ PASS | `reqContractDetails` returns exchange/type |
| CalendarReport (Reuters) | ❌ FAIL | `reqFundamentalData(reportType="CalendarReport")` → empty (Reuters Fundamentals subscription needed, NOT WSH) |
| FinSummary (Reuters) | ❌ FAIL | `reqFundamentalData(reportType="FinancialSummary")` → empty |

### 3.2 Wall Street Horizon (WSH) Calendar API

#### v1 probe (2026-03-02) — INCORRECT initial assessment

Script: `tmp/test_ibkr_wsh_probe.py` — Results: `tmp/probes/ibkr_wsh_probe_AAPL.json`

| API Call | Status | Details |
|----------|--------|--------|
| `reqWshMetaData()` | ⚠️ EMPTY | Returns null — used low-level async `req*` instead of blocking `get*` |
| `reqWshEventData(AAPL)` | ⚠️ EMPTY | Returns null — did not pass `conId` parameter |
| `reqWshEventData(90d broad)` | ⚠️ EMPTY | Returns null — same issue as above |

**v1 failure root cause:** Used `ib.reqWshMetaData()` (non-blocking, returns before data arrives) instead of `ib.getWshMetaData()` (blocking wrapper). Also did not provide `conId` for event data requests.

#### v2 probe (2026-03-02) — CORRECTED assessment ✅

Script: `tmp/test_ibkr_wsh_probe_v2.py` — Results: `tmp/probes/ibkr_wsh_probe_v2.json`

Used `ib.getWshMetaData()` / `ib.getWshEventData(WshEventData(conId=...))` (blocking wrappers with proper parameters).

| Test Case | Status | Items | Details |
|-----------|--------|-------|--------|
| Metadata (`getWshMetaData()`) | ✅ OK | 123,094 | Full event type schema, column definitions |
| A: conId only | ✅ OK | 265,309 | All historical AAPL WSH events (M&A, conferences, earnings calls, options) |
| B: conId + startDate/endDate (90d) | ✅ OK | 9,211 | Filtered recent events: "Apple Experience 2026" (IC), option expirations, etc. |
| C: conId + fillWatchlist | ✅ OK | 265,309 | Same as A |
| D: fillWatchlist + fillPortfolio (no conId) | ❌ Error | 0 | TWS error 10309: "Invalid WSH event data request" — conId is required |
| E: filter JSON (symbol) | ✅ OK | 2 | Works but limited result count |

**Discovered WSH event types (from metadata + event data):**

Script: `tmp/test_ibkr_wsh_fields.py` — Results: `tmp/probes/ibkr_wsh_fields_full.json`

Total **24 event types** in metadata, **15 types** observed for AAPL (481 events).

| Event Type | Count | Description | Key Data Fields |
|------------|-------|-------------|----------------|
| `wshe_eps` | 20 | **Earnings Report (EPS actual + estimate)** | `amount_oc` (actual EPS), `estimated_eps` (estimate), `change_amount`, `change_percent`, `currency`, `fiscal_year`, `quarter` |
| `wshe_ed` | 31 | **Earnings Date** | `earnings_date`, `time_of_day` (After Market/BMO), `wshe_earnings_date_status` (CONFIRMED/UNCONFIRMED), `filing_due_date` |
| `wshe_fq` | 19 | **Future Quarter (predicted earnings date)** | `earnings_date`, `confidence_indicator`, `wshe_earnings_date_status` (INFERRED) |
| `wshe_cc` | 29 | Conference Calls (earnings calls) | `fiscal_year`, `quarter`, `live_pwebsite`, `replay_pwebsite`, `transcript_url` |
| `wshe_div` | 29 | **Dividends** | `dividend_oc` (amount), `dividend_currency`, `ex_div_date`, `pay_date`, `frequency`, `change_percent` |
| `wshe_ic` | 31 | Investor Conferences / Business Updates | `event_desc`, `venue`, `wshe_ic_type`, `start_date` |
| `wshe_merg_acq` | 1 | M&A events | `action_type`, `acquirer/target`, `wshe_action_status` |
| `wshe_option` | 193 | Option Expirations | `expiration_date`, `expiration_frequency` (W1/W2/M), `option_type` |
| `wshe_qe` | 21 | Quarter End dates | `quarter_end_date`, `fiscal_year` |
| `wshe_sec` | 22 | SEC Filing Due dates | `filing_due_date` |
| `wshe_bybkmod` | 3 | Buyback Modifications | `news_references`, `external_notes` |
| `wshe_sh` | 5 | Shareholder Meetings | `shm_meeting_type`, `venue`, `virtual_meeting` |
| `wshe_splits` | 1 | Stock Splits | `ratio`, `split_type` |
| `wshe_movies` | 8 | Movie Releases | `release_title`, `distributor` |
| `wshe_videos` | 68 | Video/Streaming Releases | `release_title`, `distributor` (Apple TV+) |

**Additional event types in metadata (not observed for AAPL):** `wshe_bod` (Board of Directors), `wshe_bybk` (Buyback), `wshe_fda_adv_comm` (FDA Advisory), `wshe_idx` (Index Change), `wshe_interim_dates`, `wshe_ipo`, `wshe_secondary` (Secondary Offering), `wshe_spinoffs`, `wshe_divsr` (Dividend Suspend/Resume).

**★ CRITICAL FINDING: `wshe_eps` contains EPS financial values!**

Sample data (AAPL Q1 FY2026, latest):
- `amount_oc` = **2.84** (actual EPS)
- `estimated_eps` = **2.654** (consensus estimate)
- `change_amount` = 0.99, `change_percent` = 53.5%
- `currency` = USD

**Key fields per event:**
- `event_type` — event category
- `index_date` — event date (YYYYMMDD)
- `data.announce_date` — announcement date
- `data.event_desc` — description
- `data.company.contract` — ticker symbol
- `data.company.contract_description` — company name
- `data.wshe_event_status` — HELD / PENDING / COMPLETED
- `data.local_time_start` — event time
- `data.fiscal_year`, `data.fiscal_period` — for earnings calls
- `source` — always "WSHE"

**Correct API usage pattern:**
```python
from ib_insync import IB, Stock, WshEventData
ib = IB()
ib.connect("127.0.0.1", 4001, clientId=97)
# 1) Get conId first
details = ib.reqContractDetails(Stock("AAPL", "SMART", "USD"))
con_id = details[0].contract.conId
# 2) Metadata (blocking)
meta = ib.getWshMetaData()  # NOT reqWshMetaData
# 3) Events with conId (blocking)
events = ib.getWshEventData(WshEventData(conId=con_id, startDate="20260302", endDate="20260601"))
```

**Analysis (corrected after v2 + v3 field probe):**
- v1 probe used low-level `req*` calls → empty responses (incorrect conclusion)
- v2 probe used blocking `get*` wrappers with `conId` → **rich WSH data available**
- v3 field probe (`test_ibkr_wsh_fields.py`) → **24 event types discovered, `wshe_eps` contains EPS actual + estimate**
- **WSH API entitlement IS active** (not just UI-level subscription as previously assumed)
- 123K+ metadata items, 265K+ historical events for single symbol (AAPL)
- Conference calls, investor conferences, M&A, option expirations, **earnings reports (EPS), dividends** all available
- **Limitation**: `conId` is required for event data (fillWatchlist/fillPortfolio alone → error)
- **Limitation**: **Revenue is NOT in WSH** — no revenue actual/estimate/surprise fields in any event type

**IBKR verdict (REVISED AGAIN — v3 field probe):**
- **OHLCV** = ✅ reliable via TWS `reqHistoricalData`
- **Reuters Fundamentals (CalendarReport/FinSummary)** = ❌ NOT available (no Reuters subscription)
- **WSH Calendar Events** = ✅ **AVAILABLE** — conference calls, investor conferences, M&A, option expirations, shareholder meetings, splits, buybacks, etc.
- **WSH EPS (actual + estimate)** = ✅ **AVAILABLE** via `wshe_eps` — `amount_oc` (actual), `estimated_eps` (estimate), `change_amount`, `change_percent`
- **WSH Earnings Date** = ✅ **AVAILABLE** via `wshe_ed` — date, time_of_day, status (CONFIRMED/UNCONFIRMED)
- **WSH Dividend** = ✅ **AVAILABLE** via `wshe_div` — amount, currency, ex-date, pay-date, frequency
- **WSH Revenue** = ❌ **NOT AVAILABLE** — no revenue fields in any WSH event type. For revenue data, use Finnhub `/stock/earnings` or `/stock/financials`.

---

## 4. Capability Matrix (Feature → Data Source Mapping)

| Terminal Feature | Primary Source | Fallback | Status |
|------------------|---------------|----------|--------|
| **News Feed** | Finnhub `/company-news` (Free tier EP, ~5yr history w/ paid sub; oldest verified: 2021-03-29) | Finnhub `/news` (general market) | ✅ Ready |
| **Press Releases** | Finnhub `/press-releases` (premium, accessible) | — | ✅ Ready |
| **News Sentiment** | Finnhub `/news-sentiment` (premium, accessible) | — | ✅ Ready |
| **1D OHLCV price** | EODHD (existing `ohlc_1d_watchlist.sqlite`) | IBKR TWS `reqHistoricalData` | ✅ Ready |
| **Real-time Quote** | Finnhub `/quote` (free) | IBKR TWS | ✅ Ready |
| **Calendar / Earnings** | **IBKR WSH** `getWshEventData(conId=...)` — EPS actual+estimate (`wshe_eps`), earnings dates (`wshe_ed`), conference calls, dividends, M&A, options, etc. (24 event types) | Finnhub `/stock/earnings` (free) for **Revenue** values (not in WSH) | ✅ Ready (WSH = EPS + event dates/types, Finnhub = Revenue supplement) |
| **Company Profile** | Finnhub `/stock/profile2` (free) | — | ✅ Ready |
| **Financial Statements** | Finnhub `/stock/financials` (premium, bs/ic) | `/stock/financials-reported` (free) | ✅ Ready |
| **Analyst Recommendations** | Finnhub `/stock/recommendation` (free) | — | ✅ Ready |
| **Insider Activity** | Finnhub `/stock/insider-transactions` (free) | `/stock/insider-sentiment` (free) | ✅ Ready |
| **SEC Filings** | Finnhub `/stock/filings` (free) | — | ✅ Ready |
| **Ownership** | Finnhub `/stock/ownership` + `/stock/fund-ownership` (premium) | — | ✅ Ready |
| **Social Sentiment** | Finnhub `/stock/social-sentiment` (premium) | — | ✅ Ready |
| **OHLCV Candles (intraday)** | — | — | ❌ DENIED (Finnhub `/stock/candle` is 403; EODHD or IBKR needed) |
| **Price Target / Estimates** | — | — | ❌ DENIED (all estimate endpoints 403) |
| **ETF/Index data** | — | — | ❌ DENIED (all ETF endpoints 403) |
| **Earnings Transcripts** | — | — | ❌ DENIED |
| **ESG Scores** | — | — | ❌ DENIED |

### 4.1 `/news` (General Market News) vs `/company-news` (Ticker-Specific News)

**`/company-news`** (Primary Source — ticker-specific):
- Requires `symbol`, `from`, `to` params → returns news **for a specific ticker**
- `related` field = always populated with the ticker symbol (e.g., `"AAPL"`)
- Sources: Yahoo, Benzinga, CNBC, SeekingAlpha
- ~5yr history with paid subscription (oldest verified: 2021-03-29)
- ~250 articles per request (narrow date range for more granular results)

**`/news`** (Fallback — general market headlines):
- No ticker filter — returns **market-wide** top headlines
- `related` field = always **empty** (not linked to any specific ticker)
- Category filter: `general` (default), `forex`, `crypto`, `merger`
- Sources by category:
  - `general`: MarketWatch(70%), CNBC(19%), Bloomberg(11%)
  - `crypto`: Cointelegraph, CoinDesk
  - `merger`: GlobalNewswire, SeekingAlpha
  - `forex`: Forexlive (very sparse)
- Returns latest ~100 articles, spanning ~3 days (no date range param)
- Pagination via `minId` param (pass lowest `id` from previous batch to load older)
- Tested 2026-03-03: 100 articles, oldest = 2026-02-27

**Use case in terminal:** `/company-news` is the main per-ticker news source. `/news` serves as a general market context feed (e.g., homepage market headlines widget) when no specific ticker is selected.

### 4.2 `/press-releases` (Company Press Releases / Major Developments)

- **Tier:** Premium (accessible with current subscription)
- **Params:** `symbol` (required), `from`, `to` (date range)
- **Response structure:** `{ symbol, majorDevelopment[] }` — each item:
  - `symbol` — ticker
  - `datetime` — e.g., `"2026-03-02 09:00:00"`
  - `headline` — press release title
  - `description` — first ~300 chars of press release body
  - `url` — link to full text
  - `image` — thumbnail URL
- **Source & data pipeline:** all URLs point to `www.nasdaq.com/press-release/...`, but the **original content originates from newswire services**. Per the Finnhub API docs, this endpoint is "mostly press releases sourced from the exchanges, **BusinessWire, AccessWire, GlobeNewswire, Newsfile, and PRNewswire**." The data flow is:
  1. **Company → Wire service** (e.g., Business Wire): the company pays a wire service to distribute its official press release.
  2. **Wire service → Nasdaq.com**: Nasdaq republishes/aggregates wire-distributed press releases on its own platform (`nasdaq.com/press-release/...`).
  3. **Nasdaq.com → Finnhub**: Finnhub collects from the Nasdaq press-release pages and serves them via this API.
  - Evidence: the AAPL "iPhone 17e" press release body contains `CUPERTINO, Calif.--(BUSINESS WIRE)--` and the page footer links to `businesswire.com/news/home/20260302227994/en/` as the source version.
  - Therefore, "exclusively `www.nasdaq.com`" describes Finnhub's **collection path**, not the content's **origin**. The origin is the wire services.
- **Content type:** official company announcements — product launches, earnings results, executive appointments, manufacturing updates, partnerships, etc.
- **History depth:** ~4+ years (AAPL: oldest = 2021-11-17 with `from=2020-01-01`; 2018-2019 = 0 results)
- **Volume:** AAPL ~57/year, MSFT ~47/year (moderate — these are major press releases, not all news)
- **Max per request:** 200 items observed
- **Difference from `/company-news`:** `/press-releases` = official company-issued announcements distributed via wire services (BW, PRN, GNW, AW, Newsfile), aggregated through Nasdaq; `/company-news` = third-party media coverage (Yahoo, Benzinga, CNBC). Minimal overlap.

**Use case in terminal:** "Press Releases" tab or section within ticker detail — shows official company announcements separate from media coverage.

### 4.3 `/news-sentiment` (Company News Sentiment Scores)

- **Tier:** Premium (accessible with current subscription)
- **Params:** `symbol` (required) — no date range (returns current snapshot)
- **Response structure:**
  ```json
  {
    "buzz": {
      "articlesInLastWeek": 71,     // articles mentioning this ticker in past 7 days
      "buzz": 0.7634,               // ratio: articlesInLastWeek / weeklyAverage
      "weeklyAverage": 93           // historical average articles/week
    },
    "companyNewsScore": 0.9658,     // 0-1, relative media coverage vs sector (1 = highest)
    "sectorAverageBullishPercent": 0.5841,  // sector average bullish %
    "sectorAverageNewsScore": 0.5208,       // sector average news score
    "sentiment": {
      "bearishPercent": 0,           // % of articles classified bearish
      "bullishPercent": 1            // % of articles classified bullish
    },
    "symbol": "AAPL"
  }
  ```
- **Nature:** aggregated **snapshot** (not time-series) — reflects current week's sentiment
- **Tested 2026-03-03:**
  - AAPL: buzz=0.76 (71 articles, avg 93), 100% bullish, score=0.97
  - MSFT: buzz=0.93 (131 articles, avg 141), 93% bullish, score=0.90
  - TSLA: buzz=0.74 (63 articles, avg 85), 100% bullish, score=0.89
  - SPY: buzz=0.65 (345 articles, avg 7→abnormal), 59% bullish, score=0.50
- **No historical data:** each call returns current-week snapshot only. For historical sentiment tracking, cache results periodically.

**Use case in terminal:** sentiment badge/gauge on ticker detail page — shows bullish/bearish %, media buzz level, and how it compares to sector average.

### 4.4 `/stock/profile2` (Company Profile)

- **Tier:** Free
- **Params:** `symbol` (required)
- **Response structure:** single flat object with company overview:
  ```json
  {
    "country": "US",
    "currency": "USD",
    "estimateCurrency": "USD",
    "exchange": "NASDAQ NMS - GLOBAL MARKET",
    "finnhubIndustry": "Technology",
    "floatingShare": 14430.98,        // millions
    "ipo": "1980-12-12",
    "logo": "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png",
    "marketCapitalization": 3886391.18, // millions USD
    "name": "Apple Inc",
    "phone": "14089961010",
    "shareOutstanding": 14702.7,        // millions
    "ticker": "AAPL",
    "weburl": "https://www.apple.com/"
  }
  ```
- **Fields:** 14 fields — country, currency, exchange, industry classification, float shares, IPO date, logo URL, market cap, company name, phone, shares outstanding, ticker, website
- **Note:** `marketCapitalization` and `shareOutstanding` are in **millions**. `floatingShare` is also in millions.
- **Industry examples:** Technology (AAPL, MSFT), Automobiles (TSLA), Banking (JPM)
- **Logo URL:** hosted on Finnhub static CDN — usable as `<img>` source directly

**Use case in terminal:** company header/banner on ticker detail page — logo, name, exchange, industry, market cap, IPO date.

### 4.5 `/stock/financials` + `/stock/financials-reported` (Financial Statements)

Two separate endpoints for financial data:

**A) `/stock/financials` (Premium, accessible)**
- **Params:** `symbol`, `statement` (`bs`/`ic`/`cf`), `freq` (`annual`/`quarterly`)
- **Returns:** `{ symbol, financials[] }` — standardized/normalized financial items
- **Statement types:**
  - `bs` (Balance Sheet): 36 fields — `totalAssets`, `totalLiabilities`, `totalEquity`, `cash`, `longTermDebt`, `inventory`, `accountsReceivables`, `retainedEarnings`, `sharesOutstanding`, etc.
  - `ic` (Income Statement): 14 fields — `revenue`, `costOfGoodsSold`, `grossIncome`, `ebit`, `netIncome`, `dilutedEPS`, `researchDevelopment`, `sgaExpense`, etc.
  - `cf` (Cash Flow): 18 fields — `netOperatingCashFlow`, `capex`, `fcf`, `cashDividendsPaid`, `stockBasedCompensation`, `depreciationAmortization`, etc.
- **History depth:**
  - Annual: 10 years (AAPL: 2016–2025)
  - Quarterly: 40 quarters (~10 years, AAPL: 2016-Q2–2025-Q1)
- **Values:** in **millions** (e.g., AAPL revenue=416161 = $416.2B)

**B) `/stock/financials-reported` (Free)**
- **Params:** `symbol` (no statement/freq filter)
- **Returns:** `{ cik, symbol, data[] }` — raw SEC filing data (as-reported, not normalized)
- **Each item:** `form` (10-K/10-Q), `filedDate`, `startDate`, `endDate`, `year`, `quarter`, plus `report: { bs[], ic[], cf[] }`
- **Report items:** each is `{ concept, unit, label, value }` using XBRL concept names (e.g., `us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax`)
- **History:** 16 filings for AAPL (10-K only observed — 2010–2025)
- **Values:** in **raw units** (not millions — e.g., AAPL revenue=416161000000 = $416.2B)
- **Use case:** detailed SEC data when normalized `/stock/financials` is insufficient

**Comparison:**
| | `/stock/financials` (Premium) | `/stock/financials-reported` (Free) |
|---|---|---|
| Data source | Standardized/normalized | Raw SEC XBRL as-reported |
| Statement filter | `bs`/`ic`/`cf` separately | All 3 in one response |
| Frequency | `annual`/`quarterly` | Annual filings (10-K) observed |
| Value units | Millions | Raw (full numbers) |
| Field names | camelCase English | XBRL concept codes |
| Ease of use | ✅ Easy | Requires XBRL mapping |

**Use case in terminal:** Financial statements tab — use Premium endpoint for clean display (tables/charts). Free endpoint as fallback or for raw SEC data drill-down.

### 4.6 `/stock/ownership` + `/stock/fund-ownership` (Ownership Structure)

Two separate endpoints for institutional and fund holdings:

**A) `/stock/ownership` (Premium) — Institutional Holders**
- **Params:** `symbol`, optional `limit` (default: all)
- **Returns:** `{ symbol, ownership[] }` — each item:
  - `name` — institution name (e.g., "The Vanguard Group, Inc.")
  - `share` — number of shares held
  - `change` — share change from previous filing
  - `filingDate` — most recent filing date
- **Volume:** AAPL has **8,077** institutional holders (massive dataset)
- **Top 5 (AAPL, 2025-12-31):**
  1. Vanguard Group: 1.42B shares
  2. BlackRock: 735M shares
  3. State Street: 604M shares
  4. Geode Capital: 358M shares
  5. Fidelity: 280M shares
- **`limit` param:** use `limit=50` or similar to get top holders only (default returns all 8K+)
- **Note:** `percentage` field exists in schema but returns `undefined` — need to calculate manually from `share / sharesOutstanding`

**B) `/stock/fund-ownership` (Premium) — Fund/ETF Holders**
- **Params:** `symbol`, optional `limit`
- **Returns:** `{ symbol, ownership[] }` — each item:
  - `name` — fund name (e.g., "Vanguard Total Stock Market Index Fund")
  - `share` — shares held by this fund
  - `change` — share change
  - `portfolioPercent` — % of the **fund's** portfolio this stock represents
  - `filingDate` — filing date
- **Volume:** AAPL has **8,571** fund holders
- **Top 5 (AAPL):**
  1. Vanguard Total Stock Market: 467M shares (5.91% of fund)
  2. Vanguard 500 Index: 366M (6.64%)
  3. Fidelity 500 Index: 188M (6.62%)
  4. Norway Pension Fund (Statens Pensjonsfond): 187M (2.78%)
  5. iShares Core S&P 500 ETF: 182M (7.01%)

**Comparison:**
| | `/stock/ownership` | `/stock/fund-ownership` |
|---|---|---|
| Scope | Institutional investors (firms) | Individual funds/ETFs |
| Unique field | — | `portfolioPercent` (% of fund's portfolio) |
| Count (AAPL) | 8,077 | 8,571 |
| Filing dates | Latest: 2025-12-31 | Mixed: 2025-06–10 |

**Use case in terminal:** "Ownership" tab on ticker detail — top institutional holders table + top fund/ETF holders table. Use `limit=20-50` to avoid massive payloads.

---

### Decision #1 — /calendar data source ✅ DECIDED (2026-03-03)
IBKR WSH API is **AVAILABLE** ✅ with **EPS financial data**. WSH provides:
- ✅ EPS actual (`wshe_eps.amount_oc`) + estimate (`wshe_eps.estimated_eps`) + surprise (`change_amount`/`change_percent`)
- ✅ Earnings dates (`wshe_ed`) — date, time (BMO/AMC), status (CONFIRMED/UNCONFIRMED)
- ✅ Dividends (`wshe_div`) — amount, ex-date, pay-date
- ✅ Conference calls, investor conferences, M&A, option expirations, etc.
- ❌ **Revenue NOT in WSH** — no revenue actual/estimate/surprise fields

**→ CHOSEN: Option 1** — IBKR WSH as primary calendar+EPS source + Finnhub `/stock/earnings` for Revenue only.

**Note**: Revenue is the only major financial metric missing from WSH. Finnhub `/stock/earnings` provides `{actual, estimate, period, quarter, surprise, surprisePercent, symbol, year}` which includes revenue.

### Decision #5 — IBKR ↔ Node communication ✅ DECIDED (2026-03-03)
IBKR TWS is Python-only (`ib_insync`). WSH + OHLCV both confirmed working.

**→ CHOSEN: Option 1** — Python subprocess from Node backend (simplest).

### Decision #6 — Intraday OHLCV source ✅ DECIDED (2026-03-03)
Finnhub `/stock/candle` is denied.

**→ CHOSEN: Skip intraday for now (1D only).** When intraday is needed later, use IBKR TWS `reqHistoricalData`.

---

## 6. Finnhub Subscription Analysis

**Current subscription:** Includes fundamentals (Premium tier — partial access).

**Accessible Premium endpoints:** 17 out of ~44 Premium endpoints → suggests **Fundamental 1** ($50/mo) tier or similar.

**Key gaps (all 403):**
- All **Stock Estimates** (price target, EPS/revenue/EBITDA/EBIT estimates, upgrade/downgrade)
- **Stock Price** candle data
- **ETF/Index** data
- **Transcripts**, **ESG**, **Supply Chain**
- **Economic Calendar**

**If estimates/transcripts are needed:** requires upgrade to Fundamental 2 ($200/mo) or Stock Estimates add-on.

---
---

# Step 0 — 데이터 가용성 감사 (종합)

## KO

> ℹ️ KO 섹션이 최신 기준(authoritative source)입니다. EN 섹션 정합이 필요하면 KO를 기준으로 EN을 업데이트하세요.

### 프로브 날짜
2026-03-03

### 프로브 심볼
AAPL (기본), SPY/JPM (ETF/은행 지점 확인)

### 사용 스크립트
- `terminal/backend/test_finnhub_probe.mjs` — 최초 3개 엔드포인트 프로브
- `terminal/backend/test_finnhub_full_probe.mjs` — 종합 67개 엔드포인트 프로브 (2026-03-03 생성)

### Raw JSON 출력물
- `tmp/probes/finnhub_comprehensive_probe.json` — 63개 엔드포인트 (1차)
- `tmp/probes/finnhub_full_probe_results.json` — 67개 엔드포인트 (2차, ETF Holdings/Sector, Earnings Call Live, Company Presentation, Historical ESG, Bank Branch 추가)

---

## 1. Finnhub API — 종합 엔드포인트 매트릭스

**요약: 67개 EP 테스트 → 40 ✅ 접근 가능, 1 ⚠️ 빈 응답, 26 ❌ 거부(403)**

### 1.1 주식 펀더멘털

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 1 | 회사 프로필 2 | `/stock/profile2` | Free | 200 | ✅ 데이터 | `{country,currency,exchange,finnhubIndustry,logo,marketCapitalization,name,ticker,...}` |
| 2 | 회사 프로필 (v1) | `/stock/profile` | Premium | 403 | ❌ 거부 | — |
| 3 | 경영진 | `/stock/executive` | Premium | 200 | ✅ 데이터 | `{executive[],symbol}` |
| 4 | 동종업 | `/stock/peers` | Free | 200 | ✅ 데이터 | `array[12]` 종목 문자열 |
| 5 | 기본 재무 | `/stock/metric?metric=all` | Free | 200 | ✅ 데이터 | `{metric,metricType,series,symbol}` — 52주 고/저, PE, EPS 등 |
| 6 | 지분구조 | `/stock/ownership` | Premium | 200 | ✅ 데이터 | `{ownership[],symbol}` |
| 7 | 펀드 지분 | `/stock/fund-ownership` | Premium | 200 | ✅ 데이터 | `{ownership[],symbol}` |
| 8 | 기관 프로필 | `/institutional/profile` | Premium | 200 | ✅ 데이터 | profile 객체 |
| 9 | 내부자 거래 | `/stock/insider-transactions` | Free | 200 | ✅ 데이터 | `{data[],symbol}` |
| 10 | 내부자 심리 | `/stock/insider-sentiment` | Free | 200 | ✅ 데이터 | `{data[],symbol}` |
| 11 | 재무제표 (bs) | `/stock/financials?statement=bs` | Premium | 200 | ✅ 데이터 | `{financials[],symbol}` |
| 12 | 재무제표 (ic) | `/stock/financials?statement=ic` | Premium | 200 | ✅ 데이터 | `{financials[],symbol}` |
| 13 | 보고된 재무 | `/stock/financials-reported` | Free | 200 | ✅ 데이터 | `{cik,data[],symbol}` |
| 14 | 매출 구성 | `/stock/revenue-breakdown` | Premium | 200 | ✅ 데이터 | `{cik,data[],symbol}` |
| 15 | 매출 구성 & KPI | `/stock/revenue-breakdown2` | Premium/Enterprise | 403 | ❌ 거부 | — |
| 16 | SEC 공시 | `/stock/filings` | Free | 200 | ✅ 데이터 | `array[78] {accessNumber,form,filedDate,reportUrl,...}` |
| 17 | SEC 감성 분석 | `/stock/filings-sentiment` | Premium | 200 | ✅ 데이터 | `{cik,symbol,accessNumber,sentiment}` |
| 18 | 유사도 지수 | `/stock/similarity-index` | Premium | 200 | ✅ 데이터 | `{cik,similarity[],symbol}` |
| 19 | IPO 캘린더 | `/calendar/ipo` | Free | 200 | ✅ 데이터 | `{ipoCalendar[]}` |
| 20 | 배당금 | `/stock/dividend` | Premium | 200 | ✅ 데이터 | `array[4] {amount,date,payDate,...}` |
| 21 | 배당금 2 (기본) | `/stock/dividend2` | Premium | 403 | ❌ 거부 | — |
| 22 | 주식 분할 | `/stock/split` | Premium | 403 | ❌ 거부 | — |
| 23 | 섹터 지표 | `/sector/metrics` | Premium | 200 | ✅ 데이터 | `{data[],region}` |
| 24 | 가격 지표 | `/stock/price-metric` | Premium | 200 | ✅ 데이터 | `{atDate,data[],symbol}` |
| 25 | 심볼 변경 | `/ca/symbol-change` | Premium | 200 | ✅ 데이터 | `{data[],fromDate,toDate}` |
| 26 | 역사적 시가총액 | `/stock/historical-market-cap` | Premium | 403 | ❌ 거부 | — |
| 27 | 역사적 직원 수 | `/stock/historical-employee-count` | Premium | 403 | ❌ 거부 | — |
| 28 | 시장 상태 | `/stock/market-status` | Free | 200 | ✅ 데이터 | `{exchange,isOpen,session,t,timezone}` |
| 29 | 시장 휴일 | `/stock/market-holiday` | Free | 200 | ✅ 데이터 | `{data[],exchange,timezone}` |
| 30 | 심볼 검색 | `/search` | Free | 200 | ✅ 데이터 | `{count,result[]}` |
| 31 | 주식 심볼 (US) | `/stock/symbol?exchange=US` | Free | 200 | ✅ 데이터 | `array[30107]` |

### 1.2 뉴스 & 보도자료

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 32 | 시장 뉴스 (일반) | `/news?category=general` | Free | 200 | ✅ 데이터 | `array[100] {category,datetime,headline,id,image,source,summary,url}` |
| 33 | 기업 뉴스 | `/company-news` | Free | 200 | ✅ 데이터 | `array[249] {category,datetime,headline,id,image,related,source,summary,url}` |
| 34 | **보도자료** | `/press-releases` | Premium | 200 | ✅ 데이터 | `{majorDevelopment[],symbol}` |
| 35 | 뉴스 감성 | `/news-sentiment` | Premium | 200 | ✅ 데이터 | `{buzz,companyNewsScore,sectorAverageBullishPercent,sentiment,symbol}` |
| 36 | 뉴스룸 | `/stock/newsroom` | Premium/Enterprise | 403 | ❌ 거부 | — |

### 1.3 주식 추정치

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 37 | 추천 추세 | `/stock/recommendation` | Free | 200 | ✅ 데이터 | `array[4] {buy,hold,period,sell,strongBuy,strongSell,symbol}` |
| 38 | 목표 주가 | `/stock/price-target` | Premium | 403 | ❌ 거부 | — |
| 39 | 업/다운그레이드 | `/stock/upgrade-downgrade` | Premium | 403 | ❌ 거부 | — |
| 40 | 매출 추정치 | `/stock/revenue-estimate` | Premium | 403 | ❌ 거부 | — |
| 41 | EPS 추정치 | `/stock/eps-estimate` | Premium | 403 | ❌ 거부 | — |
| 42 | EBITDA 추정치 | `/stock/ebitda-estimate` | Premium | 403 | ❌ 거부 | — |
| 43 | EBIT 추정치 | `/stock/ebit-estimate` | Premium | 403 | ❌ 거부 | — |
| 44 | 어닝 서프라이즈 | `/stock/earnings` | Free | 200 | ✅ 데이터 | `array[4] {actual,estimate,period,surprise,surprisePercent,symbol}` |
| 45 | 어닝 캘린더 | `/calendar/earnings` | Free | 200 | ⚠️ 빈 응답 | `{earningsCalendar:[]}` — 조회 범위에 예정된 어닝 없음 |

### 1.4 주가

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 46 | 시세 | `/quote` | Free | 200 | ✅ 데이터 | `{c,d,dp,h,l,o,pc,t}` — 현재가/시가/고가/저가/전일종가 |
| 47 | 주가 캔들 (OHLCV) | `/stock/candle` | Premium | 403 | ❌ 거부 | — |

### 1.5 ETF & 지수

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 48 | 지수 구성종목 (^GSPC) | `/index/constituents` | Premium | 403 | ❌ 거부 | — |
| 49 | ETF 프로필 (SPY) | `/etf/profile` | Premium | 403 | ❌ 거부 | — |
| 50 | ETF 보유 (SPY) | `/etf/holdings` | Premium | 403 | ❌ 거부 | — |
| 51 | ETF 섹터 (SPY) | `/etf/sector` | Premium | 403 | ❌ 거부 | — |

### 1.6 대안 데이터

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 52 | 소셜 감성 | `/stock/social-sentiment` | Premium | 200 | ✅ 데이터 | `{data[],symbol}` |
| 53 | 투자 테마 | `/stock/investment-theme` | Premium | 200 | ✅ 데이터 | `{data[],theme}` |
| 54 | 의회 거래 | `/stock/congressional-trading` | Premium | 200 | ✅ 데이터 | `{data[],symbol}` |
| 55 | H1-B 비자 | `/stock/visa-application` | Free | 200 | ✅ 데이터 | `{data[],symbol}` |
| 56 | 상원 로비 | `/stock/lobbying` | Free | 200 | ✅ 데이터 | `{data[],symbol}` |
| 57 | 미국 정부 지출 | `/stock/usa-spending` | Free | 200 | ✅ 데이터 | `{data[],symbol}` |
| 58 | USPTO 특허 | `/stock/uspto-patent` | Free | 200 | ⚠️ 빈 응답 | `{data:[],symbol}` — AAPL은 빈 결과 |
| 59 | FDA 캘린더 | `/fda-advisory-committee-calendar` | Free | 200 | ✅ 데이터 | `array[580] {fromDate,toDate,eventDescription,url}` |
| 60 | 실적 발표 목록 | `/stock/transcripts/list` | Premium | 403 | ❌ 거부 | — |
| 61 | 실적 콜 라이브 | `/stock/earnings-call-live` | Premium | 403 | ❌ 거부 | — |
| 62 | 기업 발표자료 | `/stock/presentation` | Premium | 403 | ❌ 거부 | — |
| 63 | 공급망 | `/stock/supply-chain` | Premium | 403 | ❌ 거부 | — |
| 64 | ESG 점수 | `/stock/esg` | Premium | 403 | ❌ 거부 | — |
| 65 | 역사적 ESG | `/stock/historical-esg` | Premium | 403 | ❌ 거부 | — |
| 66 | 어닝 품질 점수 | `/stock/earnings-quality-score` | Premium | 403 | ❌ 거부 | — |
| 67 | 뉴스룸 | `/stock/newsroom` | Premium/Enterprise | 403 | ❌ 거부 | — |

### 1.7 경제 & 은행

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 | 응답 형태 |
|---|-----------|----------|------|------|------|----------|
| 68 | 경제 캘린더 | `/calendar/economic` | Premium | 403 | ❌ 거부 | — |
| 69 | 국가 목록 | `/country` | Free | 200 | ✅ 데이터 | `array[249] {code2,code3,country,currency,...}` |
| 70 | 은행 지점 (JPM) | `/bank-branch` | Premium | 200 | ✅ 데이터 | `{data[],symbol}` |

### 1.8 외환 & 암호화폐 (참고용)

| # | 엔드포인트 | API 경로 | 티어 | HTTP | 판정 |
|---|-----------|----------|------|------|------|
| 71 | 외환 거래소 | `/forex/exchange` | Free | 200 | ✅ 데이터 |
| 72 | 암호화폐 거래소 | `/crypto/exchange` | Free | 200 | ✅ 데이터 |

---

## 2. 티어 & 상태별 요약

### 데이터 접근 가능 엔드포인트 (총 40개)

**Free 티어 접근 가능 (23개):**
| 엔드포인트 | 핵심 데이터 |
|-----------|-----------|
| 회사 프로필 2 | 이름, 산업, 시가총액, 로고, IPO 날짜 |
| 동종업 | 동종업 종목 배열 |
| 기본 재무 | 52주 고/저, PE, EPS, 베타, 배당수익률 등 |
| 내부자 거래 | 내부자 매수/매도 데이터 |
| 내부자 심리 | 내부자 심리 점수 |
| 보고된 재무 | SEC 공시 재무 데이터 (보고 원본) |
| SEC 공시 | 공시 목록 + URL |
| IPO 캘린더 | 예정 IPO |
| 시장 상태 | 거래소 개장/폐장 상태 |
| 시장 휴일 | 거래소별 휴일 일정 |
| 심볼 검색 | 쿼리로 심볼 검색 |
| 주식 심볼 | 미국 전체 심볼 목록 (30K+) |
| 시장 뉴스 (일반) | 글로벌 시장 뉴스 피드 |
| 기업 뉴스 | 기업별 뉴스 (무료 1년 히스토리) |
| 추천 추세 | 애널리스트 매수/보유/매도 컨센서스 |
| 어닝 서프라이즈 | 실적 vs 추정치 (최근 4분기) |
| 시세 | 실시간급 가격, 시가, 고가, 저가, 전일종가 |
| H1-B 비자 | 기업별 비자 신청 |
| 상원 로비 | 로비 데이터 |
| 미국 정부 지출 | 정부 계약 |
| FDA 캘린더 | FDA 자문위원회 캘린더 |
| 국가 목록 | 국가 메타데이터 |
| 외환/암호화폐 거래소 | 거래소 목록 (참고) |

**Premium 티어 접근 가능 (17개) — 현재 구독에 포함:**
| 엔드포인트 | 핵심 데이터 |
|-----------|-----------|
| 경영진 | 임원 이름, 직함, 보수 |
| 지분구조 | 기관 보유 비중 |
| 펀드 지분 | 뮤추얼펀드/ETF 보유 |
| 기관 프로필 | 기관 투자자 프로필 |
| 재무제표 (bs/ic) | 표준화된 대차대조표 & 손익계산서 |
| 매출 구성 | 부문/지역별 매출 |
| SEC 감성 분석 | SEC 공시 감성 분석 |
| 유사도 지수 | 10-K/10-Q 전년 대비 텍스트 유사도 |
| 배당금 | 배당 이력 + 날짜/금액 |
| 섹터 지표 | 섹터 수준 재무 지표 |
| 가격 지표 | 가격 성과 지표 |
| 심볼 변경 | 기업 액션 심볼 변경 |
| **보도자료** | **주요 발전 보도자료** |
| 뉴스 감성 | 뉴스 감성 점수 + 버즈 지표 |
| 소셜 감성 | Reddit/Twitter 감성 |
| 투자 테마 | 테마별 투자 데이터 |
| 의회 거래 | 의회 의원 거래 |
| 은행 지점 | 은행 위치 데이터 (JPM 테스트) |

### 빈 응답 / 조건부 (1개)
| 엔드포인트 | 비고 |
|-----------|------|
| 어닝 캘린더 | `{earningsCalendar:[]}` — 조회 기간에 예정 어닝이 있을 때만 데이터 반환 |

### 거부됨 — 403 Forbidden (26개)
| 엔드포인트 | 티어 | 비고 |
|-----------|------|------|
| 회사 프로필 (v1) | Premium | v2는 동작, v1은 상위 티어 필요 |
| 매출 구성 & KPI | Enterprise | Enterprise 전용 |
| 배당금 2 (기본) | Premium | 일반 `/stock/dividend`는 동작 |
| 주식 분할 | Premium | 상위 티어 필요 |
| 역사적 시가총액 | Premium | 상위 티어 필요 |
| 역사적 직원 수 | Premium | 상위 티어 필요 |
| 뉴스룸 | Enterprise | Enterprise 전용 |
| 목표 주가 | Premium | 상위 티어 |
| 업/다운그레이드 | Premium | 상위 티어 |
| 매출 추정치 | Premium | 컨센서스 추정치 — 상위 티어 |
| EPS 추정치 | Premium | 컨센서스 추정치 — 상위 티어 |
| EBITDA 추정치 | Premium | 컨센서스 추정치 — 상위 티어 |
| EBIT 추정치 | Premium | 컨센서스 추정치 — 상위 티어 |
| 주가 캔들 (OHLCV) | Premium | Stock Price 애드온 필요 (펀더멘털과 별도) |
| 지수 구성종목 | Premium | 별도 구독 필요 |
| ETF 프로필 (SPY) | Premium | ETF 애드온 필요 |
| ETF 보유 (SPY) | Premium | ETF 애드온 필요 |
| ETF 섹터 (SPY) | Premium | ETF 애드온 필요 |
| 실적 발표 목록 | Premium | 실적 콜 트랜스크립트 — 상위 티어 |
| 실적 콜 라이브 | Premium | 라이브 실적 콜 — 상위 티어 |
| 기업 발표자료 | Premium | 상위 티어 |
| 공급망 | Premium | 공급망 관계 — 상위 티어 |
| ESG 점수 | Premium | ESG 데이터 — 상위 티어 |
| 역사적 ESG | Premium | ESG 데이터 — 상위 티어 |
| 어닝 품질 점수 | Premium | 상위 티어 |
| 경제 캘린더 | Premium | 경제 이벤트 — 상위 티어 |

---

## 3. IBKR TWS 프로브 결과

### 3.1 기본 TWS API (이전 프로브)

| 기능 | 상태 | 세부 사항 |
|------|------|--------|
| TWS 연결 (포트 4001) | ✅ 성공 | `ib_insync` 0.9.86 |
| 1일 OHLCV | ✅ 성공 | `reqHistoricalData` 주식 정상 동작 |
| 계약 상세 | ✅ 성공 | `reqContractDetails` 거래소/타입 반환 |
| CalendarReport (Reuters) | ❌ 실패 | `reqFundamentalData(reportType="CalendarReport")` → 빈 응답 (Reuters Fundamentals 구독 필요, WSH와 별개) |
| FinSummary (Reuters) | ❌ 실패 | `reqFundamentalData(reportType="FinancialSummary")` → 빈 응답 |

### 3.2 Wall Street Horizon (WSH) 캘린더 API

#### v1 프로브 (2026-03-02) — 잘못된 초기 판정

스크립트: `tmp/test_ibkr_wsh_probe.py` — 결과: `tmp/probes/ibkr_wsh_probe_AAPL.json`

| API 호출 | 상태 | 세부 사항 |
|---------|------|--------|
| `reqWshMetaData()` | ⚠️ 빈 응답 | null 반환 — 논블로킹 `req*` 사용 오류 |
| `reqWshEventData(AAPL)` | ⚠️ 빈 응답 | null 반환 — `conId` 미전달 |

**v1 실패 원인:** `ib.reqWshMetaData()` (논블로킹, 데이터 도착 전 반환) 대신 `ib.getWshMetaData()` (블로킹 래퍼) 사용해야 함. 또 이벤트 요청 시 `conId` 미제공.

#### v2 프로브 (2026-03-02) — 수정된 판정 ✅

스크립트: `tmp/test_ibkr_wsh_probe_v2.py` — 결과: `tmp/probes/ibkr_wsh_probe_v2.json`

| 테스트 | 상태 | 건수 | 세부 사항 |
|-------|------|-----|--------|
| 메타데이터 | ✅ OK | 123,094 | 전체 이벤트 타입 스키마, 컬럼 정의 |
| A: conId만 | ✅ OK | 265,309 | 전체 AAPL 히스토리 이벤트 |
| B: conId + 날짜 (90일) | ✅ OK | 9,211 | 필터링된 최근 이벤트 |
| D: conId 없이 | ❌ | 0 | 에러 10309 — conId 필수 |

#### v3 필드 프로브 (2026-03-03) — EPS 재무 수치 발견! ✅

스크립트: `tmp/test_ibkr_wsh_fields.py` — 결과: `tmp/probes/ibkr_wsh_fields_full.json`

메타데이터에 **24개 이벤트 타입**, AAPL 데이터에서 **15개 타입** (481건) 관측.

| 이벤트 타입 | 건수 | 설명 | 핵심 필드 |
|-----------|-----|------|----------|
| `wshe_eps` | 20 | **실적 보고서 (EPS actual + estimate)** | `amount_oc` (실제 EPS), `estimated_eps` (예상), `change_amount`, `change_percent` |
| `wshe_ed` | 31 | **실적 발표일** | `earnings_date`, `time_of_day` (AMC/BMO), `wshe_earnings_date_status` |
| `wshe_fq` | 19 | **미래 분기 예상일** | `earnings_date`, `confidence_indicator` |
| `wshe_cc` | 29 | 컨퍼런스콜 | `fiscal_year`, `quarter`, `transcript_url` |
| `wshe_div` | 29 | **배당** | `dividend_oc` (금액), `dividend_currency`, `ex_div_date`, `pay_date` |
| `wshe_ic` | 31 | 투자자 컨퍼런스 | `event_desc`, `venue`, `wshe_ic_type` |
| `wshe_option` | 193 | 옵션 만기 | `expiration_date`, `expiration_frequency` |
| 기타 | 78 | M&A, 분기종료, SEC공시, 자사주매입, 주주총회, 분할, 영화/비디오 출시 등 | — |

**★ 핵심 발견: `wshe_eps`에 EPS 재무 수치 포함!**

최신 AAPL 데이터 (Q1 FY2026):
- `amount_oc` = **2.84** (실제 EPS)
- `estimated_eps` = **2.654** (컨센서스 예상)
- `change_amount` = 0.99, `change_percent` = 53.5%
- `currency` = USD

**분석 (v3 필드 프로브 후 최종 수정):**
- WSH API 엔타이틀먼트 활성화 확인 (UI 전용이 아님)
- **EPS actual + estimate** = ✅ `wshe_eps`에서 이용 가능
- **Earnings Date** = ✅ `wshe_ed`에서 이용 가능 (날짜 + 시간대 + 확인 상태)
- **Dividend** = ✅ `wshe_div`에서 이용 가능 (금액 + 날짜)
- **Revenue** = ❌ WSH 어떤 이벤트 타입에도 매출 필드 없음
- `conId` 필수 (fillWatchlist/fillPortfolio 단독 → 에러)

**IBKR 판정 (v3 후 최종):**
- **OHLCV** = ✅ TWS `reqHistoricalData`로 신뢰할 수 있음
- **Reuters Fundamentals** = ❌ 이용 불가 (Reuters 구독 없음)
- **WSH 캘린더 이벤트** = ✅ 컨퍼런스콜, 투자자 컨퍼런스, M&A, 옵션 만기, 주주총회, 분할 등
- **WSH EPS (actual + estimate)** = ✅ `wshe_eps` — `amount_oc`(실제), `estimated_eps`(예상), `change_amount`/`change_percent`
- **WSH 실적 발표일** = ✅ `wshe_ed` — 날짜, 시간대, 확인 상태
- **WSH 배당** = ✅ `wshe_div` — 금액, 통화, 배당락일, 지급일
- **WSH Revenue** = ❌ WSH에 매출 필드 없음 → Finnhub `/stock/earnings` 또는 `/stock/financials`로 보충 필요

---

## 4. 기능 매트릭스 (기능 → 데이터 소스 매핑)

| 터미널 기능 | 기본 소스 | 대체 소스 | 상태 |
|------------|----------|----------|------|
| **뉴스 피드** | Finnhub `/company-news` (Free 티어 EP, 유료 구독 시 ~5년 히스토리; 확인된 최고(古) 데이터: 2021-03-29) | Finnhub `/news` (일반 시장) | ✅ 준비됨 |
| **보도자료** | Finnhub `/press-releases` (프리미엄, 접근 가능) | — | ✅ 준비됨 |
| **뉴스 감성** | Finnhub `/news-sentiment` (프리미엄, 접근 가능) | — | ✅ 준비됨 |
| **1일 OHLCV** | EODHD (기존 `ohlc_1d_watchlist.sqlite`) | IBKR TWS `reqHistoricalData` | ✅ 준비됨 |
| **실시간 시세** | Finnhub `/quote` (무료) | IBKR TWS | ✅ 준비됨 |
| **캘린더/어닝** | **IBKR WSH** `getWshEventData(conId=...)` — EPS actual+estimate (`wshe_eps`), 실적일(`wshe_ed`), 컨퍼런스콜, 배당, M&A, 옵션 등 (24개 이벤트 타입) | Finnhub `/stock/earnings` (무료) — **Revenue**(매출) 수치만 보충 (WSH에 없음) | ✅ 준비됨 (WSH=EPS+이벤트, Finnhub=매출 보충) |
| **회사 프로필** | Finnhub `/stock/profile2` (무료) | — | ✅ 준비됨 |
| **재무제표** | Finnhub `/stock/financials` (프리미엄, bs/ic) | `/stock/financials-reported` (무료) | ✅ 준비됨 |
| **애널리스트 추천** | Finnhub `/stock/recommendation` (무료) | — | ✅ 준비됨 |
| **내부자 활동** | Finnhub `/stock/insider-transactions` (무료) | `/stock/insider-sentiment` (무료) | ✅ 준비됨 |
| **SEC 공시** | Finnhub `/stock/filings` (무료) | — | ✅ 준비됨 |
| **지분구조** | Finnhub `/stock/ownership` + `/stock/fund-ownership` (프리미엄) | — | ✅ 준비됨 |
| **소셜 감성** | Finnhub `/stock/social-sentiment` (프리미엄) | — | ✅ 준비됨 |
| **OHLCV 캔들 (인트라데이)** | — | — | ❌ 거부 (Finnhub `/stock/candle` 403; EODHD 또는 IBKR 필요) |
| **목표 주가/추정치** | — | — | ❌ 거부 (모든 추정 EP 403) |
| **ETF/지수 데이터** | — | — | ❌ 거부 (모든 ETF EP 403) |
| **실적 트랜스크립트** | — | — | ❌ 거부 |
| **ESG 점수** | — | — | ❌ 거부 |

### 4.1 `/news` (일반 시장 뉴스) vs `/company-news` (종목별 뉴스) 비교

**`/company-news`** (기본 소스 — 종목 특정):
- `symbol`, `from`, `to` 파라미터 필수 → **특정 종목의 뉴스**만 반환
- `related` 필드 = 항상 해당 종목 심볼로 채워져 있음 (e.g., `"AAPL"`)
- 소스: Yahoo, Benzinga, CNBC, SeekingAlpha
- 유료 구독 시 ~5년 히스토리 (확인된 최고(古) 데이터: 2021-03-29)
- 요청당 최대 ~250건 (날짜 범위를 좁히면 더 정밀한 결과)

**`/news`** (대체 소스 — 일반 시장 헤드라인):
- 종목 필터 없음 → **시장 전체** 톱 헤드라인을 반환
- `related` 필드 = 항상 **비어 있음** (특정 종목과 연결되지 않음)
- 카테고리 필터: `general` (기본), `forex`, `crypto`, `merger`
- 카테고리별 소스:
  - `general`: MarketWatch(70%), CNBC(19%), Bloomberg(11%)
  - `crypto`: Cointelegraph, CoinDesk
  - `merger`: GlobalNewswire, SeekingAlpha
  - `forex`: Forexlive (매우 적음)
- 최신 ~100건 반환, 약 3일간 범위 (날짜 범위 파라미터 없음)
- `minId` 파라미터로 페이지네이션 (이전 배치의 최소 `id`를 전달하면 더 오래된 기사 로드)
- 2026-03-03 테스트: 100건, 가장 오래된 기사 = 2026-02-27

**터미널 활용:** `/company-news`가 종목별 뉴스의 주 소스. `/news`는 특정 종목을 선택하지 않았을 때 일반 시장 컨텍스트 피드로 사용 (예: 홈페이지 시장 헤드라인 위젯).

### 4.2 `/press-releases` (회사 보도자료 / 주요 발표)

- **티어:** Premium (현재 구독으로 접근 가능)
- **파라미터:** `symbol` (필수), `from`, `to` (날짜 범위)
- **응답 구조:** `{ symbol, majorDevelopment[] }` — 각 항목:
  - `symbol` — 종목 코드
  - `datetime` — 예: `"2026-03-02 09:00:00"`
  - `headline` — 보도자료 제목
  - `description` — 보도자료 본문 처음 ~300자
  - `url` — 전문 링크
  - `image` — 썸네일 URL
- **소스 & 데이터 파이프라인:** 모든 URL이 `www.nasdaq.com/press-release/...`를 가리키지만, **원본 콘텐츠의 출처는 뉴스와이어(wire) 서비스**다. Finnhub API 문서에 따르면 이 엔드포인트는 "mostly press releases sourced from the exchanges, **BusinessWire, AccessWire, GlobeNewswire, Newsfile, and PRNewswire**"로부터 수집된다. 데이터 흐름:
  1. **회사 → Wire 서비스** (예: Business Wire): 회사가 wire 서비스에 비용을 지불하고 공식 보도자료를 배포.
  2. **Wire 서비스 → Nasdaq.com**: Nasdaq이 wire 배포된 보도자료를 자사 플랫폼에 재게시/집계 (`nasdaq.com/press-release/...`).
  3. **Nasdaq.com → Finnhub**: Finnhub이 Nasdaq 보도자료 페이지를 수집하여 API로 제공.
  - 근거: AAPL "iPhone 17e" 보도자료 본문에 `CUPERTINO, Calif.--(BUSINESS WIRE)--` 태그라인이 포함되어 있고, 페이지 하단에 `businesswire.com/news/home/20260302227994/en/`이 원본 소스로 링크됨.
  - 따라서 "전량 `www.nasdaq.com`"은 Finnhub의 **수집 경로**를 나타내는 것이지, 콘텐츠의 **원래 출처**가 Nasdaq인 것은 아님. 원래 출처는 wire 서비스.
- **콘텐츠 유형:** 공식 회사 발표 — 제품 출시, 실적 발표, 임원 선임, 제조 업데이트, 파트너십 등
- **히스토리 깊이:** ~4년+ (AAPL: `from=2020-01-01`일 때 최고(古) = 2021-11-17; 2018-2019 = 0건)
- **물량:** AAPL ~57건/년, MSFT ~47건/년 (중간 — 주요 보도자료만, 모든 뉴스 아님)
- **요청당 최대:** 200건 관찰됨
- **`/company-news`와 차이:** `/press-releases` = wire 서비스(BW, PRN, GNW, AW, Newsfile)를 통해 배포된 공식 회사 발표를 Nasdaq 경유로 집계; `/company-news` = 외부 미디어 보도 (Yahoo, Benzinga, CNBC). 겹침 거의 없음.

**터미널 활용:** 종목 상세 페이지 내 "보도자료" 탭/섹션 — 미디어 보도와 분리된 공식 회사 발표를 표시.

### 4.3 `/news-sentiment` (회사 뉴스 감성 점수)

- **티어:** Premium (현재 구독으로 접근 가능)
- **파라미터:** `symbol` (필수) — 날짜 범위 없음 (현재 스냅샷 반환)
- **응답 구조:**
  ```json
  {
    "buzz": {
      "articlesInLastWeek": 71,     // 지난 7일간 이 종목을 언급한 기사 수
      "buzz": 0.7634,               // 비율: articlesInLastWeek / weeklyAverage
      "weeklyAverage": 93           // 주간 평균 기사 수 (역사적)
    },
    "companyNewsScore": 0.9658,     // 0-1, 섹터 대비 미디어 커버리지 (1 = 최고)
    "sectorAverageBullishPercent": 0.5841,  // 섹터 평균 강세 %
    "sectorAverageNewsScore": 0.5208,       // 섹터 평균 뉴스 점수
    "sentiment": {
      "bearishPercent": 0,           // 약세로 분류된 기사 %
      "bullishPercent": 1            // 강세로 분류된 기사 %
    },
    "symbol": "AAPL"
  }
  ```
- **성격:** 집계된 **스냅샷** (시계열 아님) — 현재 주간의 감성을 반영
- **2026-03-03 테스트:**
  - AAPL: buzz=0.76 (71건, 평균 93), 100% 강세, score=0.97
  - MSFT: buzz=0.93 (131건, 평균 141), 93% 강세, score=0.90
  - TSLA: buzz=0.74 (63건, 평균 85), 100% 강세, score=0.89
  - SPY: buzz=0.65 (345건, 평균 7→비정상), 59% 강세, score=0.50
- **히스토리 데이터 없음:** 매 호출 시 현재 주간 스냅샷만 반환. 과거 감성 추적이 필요하면 주기적으로 캐시 필요.

**터미널 활용:** 종목 상세 페이지의 감성 배지/게이지 — 강세/약세 %, 미디어 버즈 수준, 섹터 평균 대비 표시.

### 4.4 `/stock/profile2` (회사 프로필)

- **티어:** Free (무료)
- **파라미터:** `symbol` (필수)
- **응답 구조:** 회사 개요의 평면(flat) 객체:
  ```json
  {
    "country": "US",
    "currency": "USD",
    "estimateCurrency": "USD",
    "exchange": "NASDAQ NMS - GLOBAL MARKET",
    "finnhubIndustry": "Technology",
    "floatingShare": 14430.98,        // 백만 주
    "ipo": "1980-12-12",
    "logo": "https://static2.finnhub.io/...AAPL.png",
    "marketCapitalization": 3886391.18, // 백만 USD
    "name": "Apple Inc",
    "phone": "14089961010",
    "shareOutstanding": 14702.7,        // 백만 주
    "ticker": "AAPL",
    "weburl": "https://www.apple.com/"
  }
  ```
- **필드:** 14개 — 국가, 통화, 거래소, 업종 분류, 유통주수, IPO일, 로고 URL, 시가총액, 회사명, 전화번호, 발행주식수, 티커, 웹사이트
- **참고:** `marketCapitalization`과 `shareOutstanding`은 **백만(million)** 단위. `floatingShare`도 백만 단위.
- **업종 예시:** Technology (AAPL, MSFT), Automobiles (TSLA), Banking (JPM)
- **로고 URL:** Finnhub 정적 CDN — `<img>` 태그에 직접 사용 가능

**터미널 활용:** 종목 상세 페이지 헤더/배너 — 로고, 회사명, 거래소, 업종, 시가총액, IPO일 표시.

### 4.5 `/stock/financials` + `/stock/financials-reported` (재무제표)

재무 데이터용 두 개의 별도 엔드포인트:

**A) `/stock/financials` (Premium, 접근 가능)**
- **파라미터:** `symbol`, `statement` (`bs`/`ic`/`cf`), `freq` (`annual`/`quarterly`)
- **반환:** `{ symbol, financials[] }` — 표준화/정규화된 재무 항목
- **재무제표 종류:**
  - `bs` (대차대조표): 36개 필드 — `totalAssets`, `totalLiabilities`, `totalEquity`, `cash`, `longTermDebt`, `inventory`, `accountsReceivables`, `retainedEarnings`, `sharesOutstanding` 등
  - `ic` (손익계산서): 14개 필드 — `revenue`, `costOfGoodsSold`, `grossIncome`, `ebit`, `netIncome`, `dilutedEPS`, `researchDevelopment`, `sgaExpense` 등
  - `cf` (현금흐름표): 18개 필드 — `netOperatingCashFlow`, `capex`, `fcf`, `cashDividendsPaid`, `stockBasedCompensation`, `depreciationAmortization` 등
- **히스토리:**
  - 연간: 10년 (AAPL: 2016–2025)
  - 분기: 40분기 (~10년, AAPL: 2016-Q2–2025-Q1)
- **값 단위:** **백만(million)** (AAPL revenue=416161 = $4,161.6억 = $416.2B)

**B) `/stock/financials-reported` (Free, 무료)**
- **파라미터:** `symbol` (재무제표/빈도 필터 없음)
- **반환:** `{ cik, symbol, data[] }` — SEC 제출 원본 데이터 (정규화 안 됨)
- **각 항목:** `form` (10-K/10-Q), `filedDate`, `startDate`, `endDate`, `year`, `quarter`, + `report: { bs[], ic[], cf[] }`
- **보고서 항목:** `{ concept, unit, label, value }` — XBRL 컨셉 명 사용 (예: `us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax`)
- **히스토리:** AAPL 16건 (10-K만 관찰, 2010–2025)
- **값 단위:** **원래 단위** (백만 아님 — AAPL revenue=416161000000 = $416.2B)
- **용도:** 정규화된 `/stock/financials`로 부족할 때 SEC 원본 데이터 확인

**비교:**
| | `/stock/financials` (Premium) | `/stock/financials-reported` (Free) |
|---|---|---|
| 데이터 소스 | 표준화/정규화 | SEC XBRL 원본 (as-reported) |
| 제표 필터 | `bs`/`ic`/`cf` 별도 | 한 응답에 3개 모두 |
| 빈도 | `annual`/`quarterly` | 연간 공시(10-K) 관찰 |
| 값 단위 | 백만(million) | 원래 단위(전체 숫자) |
| 필드명 | camelCase 영어 | XBRL 컨셉 코드 |
| 사용 편의성 | ✅ 쉽음 | XBRL 매핑 필요 |

**터미널 활용:** 재무제표 탭 — Premium EP로 깔끔하게 표시(테이블/차트). Free EP는 대체 또는 SEC 원본 드릴다운용.

### 4.6 `/stock/ownership` + `/stock/fund-ownership` (지분구조)

기관 보유 및 펀드 보유 데이터용 두 개의 별도 엔드포인트:

**A) `/stock/ownership` (Premium) — 기관 보유자**
- **파라미터:** `symbol`, 선택적 `limit` (기본: 전체)
- **반환:** `{ symbol, ownership[] }` — 각 항목:
  - `name` — 기관명 (예: "The Vanguard Group, Inc.")
  - `share` — 보유 주식 수
  - `change` — 이전 공시 대비 변동 수
  - `filingDate` — 최신 공시일
- **물량:** AAPL 기준 **8,077개** 기관 (대규모 데이터셋)
- **Top 5 (AAPL, 2025-12-31):**
  1. Vanguard Group: 14.2억 주
  2. BlackRock: 7.35억 주
  3. State Street: 6.04억 주
  4. Geode Capital: 3.58억 주
  5. Fidelity: 2.80억 주
- **`limit` 파라미터:** `limit=50` 등으로 상위 보유자만 가져오기 (기본값이면 8,000+건 전체 반환)
- **참고:** `percentage` 필드가 스키마에 있지만 `undefined` 반환 — `share / sharesOutstanding`으로 직접 계산 필요

**B) `/stock/fund-ownership` (Premium) — 펀드/ETF 보유자**
- **파라미터:** `symbol`, 선택적 `limit`
- **반환:** `{ symbol, ownership[] }` — 각 항목:
  - `name` — 펀드명 (예: "Vanguard Total Stock Market Index Fund")
  - `share` — 보유 주식 수
  - `change` — 변동 수
  - `portfolioPercent` — 해당 펀드 포트폴리오에서 이 종목이 차지하는 %
  - `filingDate` — 공시일
- **물량:** AAPL 기준 **8,571개** 펀드
- **Top 5 (AAPL):**
  1. Vanguard Total Stock Market: 4.67억 주 (펀드의 5.91%)
  2. Vanguard 500 Index: 3.66억 주 (6.64%)
  3. Fidelity 500 Index: 1.88억 주 (6.62%)
  4. 노르웨이 국부펀드: 1.87억 주 (2.78%)
  5. iShares Core S&P 500 ETF: 1.82억 주 (7.01%)

**비교:**
| | `/stock/ownership` | `/stock/fund-ownership` |
|---|---|---|
| 범위 | 기관 투자자 (회사) | 개별 펀드/ETF |
| 고유 필드 | — | `portfolioPercent` (펀드 포트폴리오 내 비중) |
| 건수 (AAPL) | 8,077 | 8,571 |
| 공시일 | 최신: 2025-12-31 | 혼재: 2025-06~10 |

**터미널 활용:** "지분구조" 탭 — 상위 기관 보유자 테이블 + 상위 펀드/ETF 보유자 테이블. 대량 페이로드 방지를 위해 `limit=20-50` 사용 권장.

---

## 5. 결정 필요 사항

### 결정 #1 — /calendar 데이터 소스 ✅ 결정됨 (2026-03-03)
IBKR WSH API가 **이용 가능** ✅ — **EPS 재무 수치까지 포함**. WSH 제공 범위:
- ✅ EPS actual (`wshe_eps.amount_oc`) + estimate (`wshe_eps.estimated_eps`) + surprise (`change_amount`/`change_percent`)
- ✅ 실적 발표일 (`wshe_ed`) — 날짜, 시간 (BMO/AMC), 상태 (CONFIRMED/UNCONFIRMED)
- ✅ 배당 (`wshe_div`) — 금액, 배당락일, 지급일
- ✅ 컨퍼런스콜, 투자자 컨퍼런스, M&A, 옵션 만기 등
- ❌ **Revenue(매출)는 WSH에 없음** — 어떤 이벤트 타입에도 매출 필드 없음

**→ 선택: 옵션 1** — IBKR WSH를 캘린더+EPS 주 소스로 사용 + Finnhub `/stock/earnings`로 Revenue만 보충.

**참고**: Revenue만이 WSH에서 빠진 주요 재무 지표. Finnhub `/stock/earnings`는 `{actual, estimate, period, quarter, surprise, surprisePercent, symbol, year}` 제공(Revenue 포함).

### 결정 #5 — IBKR ↔ Node 통신 ✅ 결정됨 (2026-03-03)
IBKR TWS는 Python 전용 (`ib_insync`). WSH + OHLCV 모두 동작 확인됨.

**→ 선택: 옵션 1** — Node 백엔드에서 Python 서브프로세스 호출 (가장 단순).

### 결정 #6 — 인트라데이 OHLCV 소스 ✅ 결정됨 (2026-03-03)
Finnhub `/stock/candle` 거부.

**→ 선택: 인트라데이 당장 불필요 (1일봉만).** 추후 인트라데이 필요 시 IBKR TWS `reqHistoricalData` 사용 예정.

---

## 6. Finnhub 구독 분석

**현재 구독:** 펀더멘털 포함 (Premium 티어 — 부분 접근).

**접근 가능 Premium EP:** 44개 중 17개 → **Fundamental 1** ($50/월) 티어 또는 유사 수준으로 추정.

**주요 공백 (모두 403):**
- 모든 **주식 추정치** (목표 주가, EPS/매출/EBITDA/EBIT 추정, 업/다운그레이드)
- **주가 캔들** 데이터
- **ETF/지수** 데이터
- **트랜스크립트**, **ESG**, **공급망**
- **경제 캘린더**

**추정치/트랜스크립트 필요 시:** Fundamental 2 ($200/월) 또는 Stock Estimates 애드온 업그레이드 필요.
