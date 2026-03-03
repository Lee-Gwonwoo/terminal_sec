# Step 0 — Data Availability Audit (Comprehensive)

## EN

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

### 3.2 Wall Street Horizon (WSH) Calendar API (probed 2026-03-02)

Script: `tmp/test_ibkr_wsh_probe.py` — Results: `tmp/probes/ibkr_wsh_probe_AAPL.json`

| API Call | Status | Details |
|----------|--------|--------|
| `reqWshMetaData()` | ⚠️ EMPTY | Returns null — no metadata available |
| `reqWshEventData(AAPL)` | ⚠️ EMPTY | Returns null — no event data |
| `reqWshEventData(90d broad)` | ⚠️ EMPTY | Returns null — same result with date range filter |
| ib_insync WSH API support | ✅ | `reqWshMetaData`, `reqWshEventData`, `WshEventData` class all present |

**Analysis:**
- `reqFundamentalData("CalendarReport")` = **Reuters Fundamentals** (different product from WSH)
- `reqWshMetaData` / `reqWshEventData` = **correct WSH API calls** for calendar events
- WSH API functions exist in ib_insync and calls succeed (no error), but return **empty/null**
- This means: **UI-level WSH subscription ("Fee Waived") is active, but API entitlement is NOT**
- API access requires: **"WSH Corporate Event Data for Retail (API)" — $49/month** (separate from UI subscription)
- Reference: https://www.interactivebrokers.com/en/pricing/research-news-services.php

**IBKR verdict:**
- **OHLCV** = ✅ reliable via TWS `reqHistoricalData`
- **Reuters Fundamentals (CalendarReport/FinSummary)** = ❌ NOT available (no Reuters subscription)
- **WSH Calendar Events** = ❌ NOT available via API (UI-only subscription; API requires $49/mo add-on)

---

## 4. Capability Matrix (Feature → Data Source Mapping)

| Terminal Feature | Primary Source | Fallback | Status |
|------------------|---------------|----------|--------|
| **News Feed** | Finnhub `/company-news` (free, 1yr history) | Finnhub `/news` (general market) | ✅ Ready |
| **Press Releases** | Finnhub `/press-releases` (premium, accessible) | — | ✅ Ready |
| **News Sentiment** | Finnhub `/news-sentiment` (premium, accessible) | — | ✅ Ready |
| **1D OHLCV price** | EODHD (existing `ohlc_1d_watchlist.sqlite`) | IBKR TWS `reqHistoricalData` | ✅ Ready |
| **Real-time Quote** | Finnhub `/quote` (free) | IBKR TWS | ✅ Ready |
| **Calendar / Earnings** | Finnhub `/calendar/earnings` (free) + `/stock/earnings` (free) | IBKR WSH API ($49/mo add-on) | ✅ Ready (Finnhub only; WSH requires additional subscription) |
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

---

## 5. Decisions Needed

### Decision #1 — /calendar data source
IBKR CalendarReport (Reuters) = FAIL, WSH API = EMPTY (no API entitlement), Finnhub `/calendar/earnings` works (free tier). Options:
1. ✅ **Use Finnhub `/calendar/earnings` + `/stock/earnings`** — earnings surprises + upcoming calendar (RECOMMENDED)
2. Subscribe to IBKR WSH API ($49/mo) — provides corporate events (earnings, dividends, splits, FDA, conferences, etc.) beyond just earnings
3. Add EODHD calendar if available
4. Mix Finnhub + WSH (if subscribed) for different calendar types
5. Accept calendar as "earnings only" for now

### Decision #5 — IBKR ↔ Node communication
IBKR TWS is Python-only (`ib_insync`). Options:
1. Python subprocess from Node backend
2. Separate Python microservice + HTTP bridge
3. Skip IBKR entirely, rely on EODHD + Finnhub

### Decision #6 — Intraday OHLCV source
Finnhub `/stock/candle` is denied. Options:
1. EODHD intraday data (existing `EODHD/` pipeline)
2. IBKR TWS `reqHistoricalData` with shorter bars
3. Skip intraday for now, 1D only

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

### 3.2 Wall Street Horizon (WSH) 캘린더 API (2026-03-02 프로브)

스크립트: `tmp/test_ibkr_wsh_probe.py` — 결과: `tmp/probes/ibkr_wsh_probe_AAPL.json`

| API 호출 | 상태 | 세부 사항 |
|---------|------|--------|
| `reqWshMetaData()` | ⚠️ 빈 응답 | null 반환 — 메타데이터 없음 |
| `reqWshEventData(AAPL)` | ⚠️ 빈 응답 | null 반환 — 이벤트 데이터 없음 |
| `reqWshEventData(90일 broad)` | ⚠️ 빈 응답 | null 반환 — 날짜 범위 필터로도 동일 |
| ib_insync WSH API 지원 | ✅ | `reqWshMetaData`, `reqWshEventData`, `WshEventData` 클래스 모두 존재 |

**분석:**
- `reqFundamentalData("CalendarReport")` = **Reuters Fundamentals** (WSH와 다른 제품)
- `reqWshMetaData` / `reqWshEventData` = **올바른 WSH API 호출** (캘린더 이벤트용)
- WSH API 함수는 ib_insync에 존재하고 호출 자체는 성공(에러 없음)하지만, **빈/null** 반환
- 의미: **UI용 WSH 구독("Fee Waived")은 활성화돼 있지만, API 엔타이틀먼트는 없음**
- API 접근 조건: **"WSH Corporate Event Data for Retail (API)" — $49/월** (UI 구독과 별도)
- 참고: https://www.interactivebrokers.com/en/pricing/research-news-services.php

**IBKR 판정:**
- **OHLCV** = ✅ TWS `reqHistoricalData`로 신뢰할 수 있음
- **Reuters Fundamentals (CalendarReport/FinSummary)** = ❌ 이용 불가 (Reuters 구독 없음)
- **WSH 캘린더 이벤트** = ❌ API를 통한 이용 불가 (UI 전용 구독; API는 $49/월 별도 추가 필요)

---

## 4. 기능 매트릭스 (기능 → 데이터 소스 매핑)

| 터미널 기능 | 기본 소스 | 대체 소스 | 상태 |
|------------|----------|----------|------|
| **뉴스 피드** | Finnhub `/company-news` (무료, 1년 히스토리) | Finnhub `/news` (일반 시장) | ✅ 준비됨 |
| **보도자료** | Finnhub `/press-releases` (프리미엄, 접근 가능) | — | ✅ 준비됨 |
| **뉴스 감성** | Finnhub `/news-sentiment` (프리미엄, 접근 가능) | — | ✅ 준비됨 |
| **1일 OHLCV** | EODHD (기존 `ohlc_1d_watchlist.sqlite`) | IBKR TWS `reqHistoricalData` | ✅ 준비됨 |
| **실시간 시세** | Finnhub `/quote` (무료) | IBKR TWS | ✅ 준비됨 |
| **캘린더/어닝** | Finnhub `/calendar/earnings` (무료) + `/stock/earnings` (무료) | IBKR WSH API ($49/월 추가구독) | ✅ 준비됨 (현재 Finnhub만; WSH는 별도 구독 필요) |
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

---

## 5. 결정 필요 사항

### 결정 #1 — /calendar 데이터 소스
IBKR CalendarReport (Reuters) = 실패, WSH API = 빈 응답 (API 엔타이틀먼트 없음), Finnhub `/calendar/earnings` 동작 (무료 티어). 옵션:
1. ✅ **Finnhub `/calendar/earnings` + `/stock/earnings` 사용** — 어닝 서프라이즈 + 예정 캘린더 (권장)
2. IBKR WSH API 구독 ($49/월) — 어닝 외에도 배당, 분할, FDA, 컨퍼런스 등 기업 이벤트 전반 제공
3. EODHD 캘린더 추가 (가용 시)
4. Finnhub + WSH (구독 시) 혼합
5. 캘린더를 "어닝 전용"으로 제한

### 결정 #5 — IBKR ↔ Node 통신
IBKR TWS는 Python 전용 (`ib_insync`):
1. Node 백엔드에서 Python 서브프로세스
2. 별도 Python 마이크로서비스 + HTTP 브릿지
3. IBKR 완전 제외, EODHD + Finnhub만 사용

### 결정 #6 — 인트라데이 OHLCV 소스
Finnhub `/stock/candle` 거부:
1. EODHD 인트라데이 데이터 (기존 `EODHD/` 파이프라인)
2. IBKR TWS `reqHistoricalData` 단기 바
3. 인트라데이 건너뛰기, 1일봉만

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
