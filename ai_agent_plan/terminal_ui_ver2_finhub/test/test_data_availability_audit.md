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

## Capability Matrix (template)
Fill every row with one of: `IBKR`, `Finnhub`, `Computed (OHLC)`, `Not available`.

### News Feed: finhub api
| UI Field | Required? | Source | Provider field(s) / Computation | Notes / Probe |
|---|---:|---|---|---|
| Date | Required | Finnhub | news datetime → formatted date | Confirm timezone + field name |
| Time | Required | Finnhub | news datetime → formatted time | Confirm timezone + field name |
| Title | Required | Finnhub | headline/title |  |
| Sources | Required | Finnhub | source/domain field | Confirm exact field name |
| Changes%: `Chg` | Required | Computed (OHLC) | $(Close_t/Close_{t-1}-1)\times 100$ | Needs prior bar; else render `-` |
| Changes%: `fr.Open` | Required | Computed (OHLC) | $(Close_t/Open_t-1)\times 100$ | Needs Open/Close; else `-` |
| Changes%: `+7D` | Required | Computed (OHLC) | $(Close_t/Close_{t-7}-1)\times 100$ (trading bars) | Needs 7 bars; else `-` |
| Changes%: `+14D` | Required | Computed (OHLC) | $(Close_t/Close_{t-14}-1)\times 100$ (trading bars) | Needs 14 bars; else `-` |
| Changes%: `+30D` | Required | Computed (OHLC) | $(Close_t/Close_{t-30}-1)\times 100$ (trading bars) | Needs 30 bars; else `-` |
| Earning: `<date>` line | Optional | Finnhub or Not available | Finnhub earnings date endpoint | If unavailable: render nothing |
| Market cap | Optional (filter) | Finnhub or Not available | company profile market cap field | Confirm units (USD) |
| Industry | Optional (filter) | Finnhub or Not available | company profile industry field | Confirm field name |

### /calendar (IBKR-only)
| UI Tab | UI Field | Required? | Source | Provider field(s) | Notes / Probe |
|---|---|---:|---|---|---|
| Earnings | Date Announcement | Required | IBKR |  | Confirm event time semantics |
| Earnings | Time | Required | IBKR |  |  |
| Earnings | Symbol | Required | IBKR |  |  |
| Earnings | Session | Required | IBKR |  | If IBKR lacks: decide mapping |
| Earnings | Period | Optional | IBKR or Not available |  |  |
| Earnings | Confirmed | Optional | IBKR or Not available |  |  |
| Earnings | EPS / Est. EPS / Surprise % | Optional | IBKR or Not available |  | High-risk: likely missing |
| Earnings | Revenue / Est. Revenue | Optional | IBKR or Not available |  | High-risk: likely missing |
| Conference | Date/Time/Symbol/Session/Confirmed | Required | IBKR |  | Confirm IBKR event types |
| Dividend | Date/Time/Symbol/Session/Confirmed | Required | IBKR |  |  |
| Analyst Rating | All columns | Optional | IBKR or Not available |  | Very high-risk: likely missing |

### Watchlist
| UI Field | Required? | Source | Provider field(s) / Computation | Notes / Probe |
|---|---:|---|---|---|
| Ticker | Required | CSV | read from configured CSV | CSV column rule must be defined |
| Name | Optional | Finnhub or Not available | company profile name | If missing, show `-` |
| Mkt Cap | Optional | Finnhub or Not available | company profile market cap |  |
| Industry | Optional | Finnhub or Not available | company profile industry |  |
| Price | Required | Computed (OHLC) | latest Close | Use per-symbol latest bar |
| Change | Required | Computed (OHLC) | Close_t - Close_{t-1} | Needs prior bar; else `-` |
| % | Required | Computed (OHLC) | (Close_t/Close_{t-1}-1)\times 100 | Needs prior bar; else `-` |

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

## Capability Matrix (템플릿)
각 행의 Source는 반드시 다음 중 하나로 채운다: `IBKR`, `Finnhub`, `Computed (OHLC)`, `Not available`.

### News Feed: finhub api
| UI 필드 | 필수? | Source | 공급자 필드 / 계산식 | 비고 / 프로브 |
|---|---:|---|---|---|
| Date | 필수 | Finnhub | 뉴스 datetime → 날짜 포맷 | timezone/필드명 확인 |
| Time | 필수 | Finnhub | 뉴스 datetime → 시간 포맷 | timezone/필드명 확인 |
| Title | 필수 | Finnhub | headline/title |  |
| Sources | 필수 | Finnhub | source/domain 필드 | 필드명 확인 |
| Changes%: `Chg` | 필수 | Computed (OHLC) | $(Close_t/Close_{t-1}-1)\times 100$ | 전일 bar 없으면 `-` |
| Changes%: `fr.Open` | 필수 | Computed (OHLC) | $(Close_t/Open_t-1)\times 100$ | Open/Close 없으면 `-` |
| Changes%: `+7D` | 필수 | Computed (OHLC) | $(Close_t/Close_{t-7}-1)\times 100$ (거래일 bar 기준) | 7 bar 없으면 `-` |
| Changes%: `+14D` | 필수 | Computed (OHLC) | $(Close_t/Close_{t-14}-1)\times 100$ (거래일 bar 기준) | 14 bar 없으면 `-` |
| Changes%: `+30D` | 필수 | Computed (OHLC) | $(Close_t/Close_{t-30}-1)\times 100$ (거래일 bar 기준) | 30 bar 없으면 `-` |
| Earning: `<date>` 라인 | 선택 | Finnhub 또는 Not available | Finnhub 실적일자 엔드포인트 | 불가하면 렌더하지 않음 |
| Market cap | 선택(필터) | Finnhub 또는 Not available | company profile 시총 필드 | 단위(USD) 확인 |
| Industry | 선택(필터) | Finnhub 또는 Not available | company profile 산업 필드 | 필드명 확인 |

### /calendar (IBKR-only)
| 탭 | UI 필드 | 필수? | Source | 공급자 필드 | 비고 / 프로브 |
|---|---|---:|---|---|---|
| Earnings | Date Announcement | 필수 | IBKR |  | 시간 의미 확인 |
| Earnings | Time | 필수 | IBKR |  |  |
| Earnings | Symbol | 필수 | IBKR |  |  |
| Earnings | Session | 필수 | IBKR |  | 없으면 매핑 결정 |
| Earnings | Period | 선택 | IBKR 또는 Not available |  |  |
| Earnings | Confirmed | 선택 | IBKR 또는 Not available |  |  |
| Earnings | EPS / Est. EPS / Surprise % | 선택 | IBKR 또는 Not available |  | 고리스크: 없을 가능성 큼 |
| Earnings | Revenue / Est. Revenue | 선택 | IBKR 또는 Not available |  | 고리스크: 없을 가능성 큼 |
| Conference | Date/Time/Symbol/Session/Confirmed | 필수 | IBKR |  | 이벤트 타입 확인 |
| Dividend | Date/Time/Symbol/Session/Confirmed | 필수 | IBKR |  |  |
| Analyst Rating | 모든 컬럼 | 선택 | IBKR 또는 Not available |  | 최고 리스크: 없을 가능성 큼 |

### Watchlist
| UI 필드 | 필수? | Source | 공급자 필드 / 계산식 | 비고 / 프로브 |
|---|---:|---|---|---|
| Ticker | 필수 | CSV | 설정된 CSV에서 읽기 | CSV 컬럼 규칙 확정 필요 |
| Name | 선택 | Finnhub 또는 Not available | company profile name | 없으면 `-` |
| Mkt Cap | 선택 | Finnhub 또는 Not available | company profile market cap |  |
| Industry | 선택 | Finnhub 또는 Not available | company profile industry |  |
| Price | 필수 | Computed (OHLC) | 최신 Close | 심볼별 latest bar |
| Change | 필수 | Computed (OHLC) | Close_t - Close_{t-1} | 전일 bar 없으면 `-` |
| % | 필수 | Computed (OHLC) | (Close_t/Close_{t-1}-1)\times 100 | 전일 bar 없으면 `-` |

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
