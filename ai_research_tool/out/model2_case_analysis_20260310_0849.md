# Model 2 Case Analysis (2024-01-01 ~ 2026-03-10)

- 생성 시각: 2026-03-10 08:49 (local)
- 전체 뉴스 수: 134,759
- change 기반 분석 가능 뉴스 수: 112,513

## 사고과정 로그

1. 범위는 `2024-01-01`부터 현재까지의 전체 뉴스(`press_release`, `news`, `company_news`, `market_news`, `IBKR`)로 확장했다.
2. 외부 링크는 다시 열지 않고 `news_items`, `news_fulltext`, `news_change_metrics`, `company_profiles.market_cap`만 사용했다.
3. 텍스트 분류는 `title/body/full_text` 순으로 사용했고, full text가 없는 source는 `title/body`만으로 case를 분류했다.
4. 영향 판정은 `change_pct`, `change_1d_pct`, `change_from_open_pct`의 절대값 최대치를 `impact_score`로 두고 진행했다.
5. 시총 기준은 `$300M-<$1B`, `$1B-<$100B`, `>= $100B` 3개를 주 버킷으로 두고, `<$300M or Unknown`은 보조 집단으로 따로 기록했다.
6. 각 시총 버킷 안에서 `impact_score`의 p80을 임계값으로 잡아 `영향 미침 / 영향 안 미침`을 분리했다.
7. 동일 case 안에서 `영향 미침 : 영향 안 미침` 비율과 Wilson lower bound를 같이 사용해 순위를 잡았다.

## 데이터 가용성

- IBKR: total=25, with_change=0, with_fulltext=0
- company_news: total=13,273, with_change=13,216, with_fulltext=0
- market_news: total=307, with_change=0, with_fulltext=0
- news: total=18,321, with_change=7,431, with_fulltext=0
- press_release: total=102,833, with_change=91,866, with_fulltext=59,585

## 영향 판정 기준

- 사용한 primary change 컬럼: `change_pct`, `change_1d_pct`, `change_from_open_pct`
- 사용한 보조 intraday 컬럼: `change_open_to_high_pct` (참고만, threshold 산정에는 미포함)
- `impact_score = max(abs(change_pct), abs(change_1d_pct), abs(change_from_open_pct))`
- 방향성은 절대값이 가장 큰 primary change 컬럼의 부호로 결정했다.
- 같은 이슈라도 시총이 크면 변동폭이 줄 수 있으므로, 버킷별 p80 임계값을 따로 사용했다.

## market cap bucket별 impact 기준

- $300M-<$1B: total=19,505, with_change=12,164, p50=5.16, p80=11.25, p90=17.03
- $1B-<$100B: total=84,296, with_change=82,433, p50=3.11, p80=7.09, p90=11.13
- >$=100B: total=14,896, with_change=13,294, p50=2.17, p80=3.89, p90=5.53
- <$300M or Unknown: total=16,062, with_change=4,622, p50=2.59, p80=6.11, p90=10.61

## 전체 유형 분류 결과

### 1. 임상·규제 실패
- 설명: 임상 실패, CRL, 주요 endpoint 미충족, hold·중단 등 바이오 규제/임상 악재
- 총 건수: 709
- 영향 미침: 241
- 영향 안 미침: 468
- 영향 비율: 0.340
- 보수적 순위 점수(Wilson LB): 0.306
- 방향 분해: positive 112 / negative 129
- median impact score: 4.28
- market cap breakdown: {"$1B-<$100B": {"total": 351, "impacted": 125}, "<$300M or Unknown": {"total": 202, "impacted": 78}, "$300M-<$1B": {"total": 68, "impacted": 26}, ">$=100B": {"total": 88, "impacted": 12}}
- source breakdown: {"news": {"total": 445, "impacted": 146}, "press_release": {"total": 240, "impacted": 88}, "company_news": {"total": 24, "impacted": 7}}
- 대표 사례:
  - 2025-12-11 07:00:00 | press_release | RZLT | Rezolute Announces Phase 3 sunRIZE Study Results in Congenital Hyperinsulinism | change=-87.2029 | change_1d=-83.5466 | intraday=13.8211 | cap=$300M-<$1B
  - 2024-03-08 07:00:00 | press_release | AMLX | Amylyx Pharmaceuticals Announces Topline Results From Global Phase 3 PHOENIX Trial of AMX0035 in ALS | change=-82.2878 | change_1d=-79.9684 | intraday=12.3746 | cap=$1B-<$100B
  - 2025-07-22 07:00:00 | press_release | REPL | Replimune Receives Complete Response Letter from FDA for RP1 Biologics License Application for the Treatment of Advanced Melanoma | change=-77.2101 | change_1d=-72.9927 | intraday=3.69 | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 2026-02-18T22:00:00.000Z | news | RNA | The New England Journal of Medicine Publishes Results from Phase 1/2 MARINA® Trial of Delpacibart Etedesiran (del-desiran) for Treatment of Myotonic Dystrophy Type 1 | change=-0.0412 | change_1d=0.0 | intraday=-0.0617 | cap=<$300M or Unknown
  - 2025-10-29 06:30:00 | press_release | GTLS | Chart Industries Reports Third Quarter 2025 Financial Results | change=0.0301 | change_1d=-0.1503 | intraday=0.1053 | cap=$1B-<$100B

### 2. 실적 호조·가이던스 상향
- 설명: beat, raises guidance, strong outlook, record revenue 등 실적성 호재
- 총 건수: 1,628
- 영향 미침: 484
- 영향 안 미침: 1,144
- 영향 비율: 0.297
- 보수적 순위 점수(Wilson LB): 0.276
- 방향 분해: positive 311 / negative 173
- median impact score: 3.71
- market cap breakdown: {"$1B-<$100B": {"total": 873, "impacted": 325}, "$300M-<$1B": {"total": 135, "impacted": 38}, "<$300M or Unknown": {"total": 325, "impacted": 58}, ">$=100B": {"total": 295, "impacted": 63}}
- source breakdown: {"news": {"total": 780, "impacted": 116}, "press_release": {"total": 264, "impacted": 136}, "company_news": {"total": 584, "impacted": 232}}
- 대표 사례:
  - 2026-02-28T23:59:00.000Z | company_news | AAOI | Applied Optoelectronics Rallies On Record Revenue For Q4-2025 | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
  - 2026-02-27T10:28:28.000Z | company_news | AAOI | Applied Optoelectronics shares are trading higher after the company reported better-than-expected Q4 financial results and issued Q1 sales guidance above estimates. Also, multiple firms raised their respective price targets on the stock. | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
  - 2026-02-27T13:13:27.000Z | company_news | AAOI | Applied Optoelectronics Rallies Over 40% On Q4 Beat, Q1 Outlook | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-15T14:00:02.000Z | news | ANTH | Dear Salesforce Stock Fans, Mark Your Calendars for February 25 | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-19T19:18:55.000Z | news | ANTH | Cathie Wood Is Selling Unity Software Stock Amid an ‘Apocalypse.’ Should You? | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 3. 희석성 자금조달·오퍼링
- 설명: public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈
- 총 건수: 5,694
- 영향 미침: 1,474
- 영향 안 미침: 4,220
- 영향 비율: 0.259
- 보수적 순위 점수(Wilson LB): 0.248
- 방향 분해: positive 714 / negative 760
- median impact score: 3.61
- market cap breakdown: {">$=100B": {"total": 375, "impacted": 68}, "$1B-<$100B": {"total": 4390, "impacted": 1131}, "$300M-<$1B": {"total": 695, "impacted": 222}, "<$300M or Unknown": {"total": 234, "impacted": 53}}
- source breakdown: {"press_release": {"total": 5274, "impacted": 1382}, "company_news": {"total": 127, "impacted": 28}, "news": {"total": 293, "impacted": 64}}
- 대표 사례:
  - 2025-06-13 09:00:00 | press_release | RAPT | RAPT Therapeutics Announces Effective Date for 1-for-8 Reverse Stock Split | change=-4.5872 | change_1d=655.9633 | intraday=-2.8037 | cap=$1B-<$100B
  - 2024-10-07 16:09:00 | press_release | SRRK | Scholar Rock Announces Proposed Public Offering of Common Stock and Pre-Funded Warrants | change=361.9946 | change_1d=297.4394 | intraday=30.1443 | cap=$1B-<$100B
  - 2025-09-24 16:06:00 | press_release | QURE | uniQure Announces $200 Million Proposed Public Offering | change=247.7306 | change_1d=285.4319 | intraday=20.6809 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2025-04-01 07:30:00 | press_release | WSO.B | Watsco Declares $3.00 Quarterly Dividend, Reflects 11% Increase to an Annual Rate of $12.00 Per Share | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=$1B-<$100B
  - 2025-10-01 07:30:00 | press_release | WSO.B | Watsco Declares $3.00 Quarterly Dividend | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=$1B-<$100B

### 4. 임상·규제 성공
- 설명: positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재
- 총 건수: 6,203
- 영향 미침: 1,535
- 영향 안 미침: 4,668
- 영향 비율: 0.247
- 보수적 순위 점수(Wilson LB): 0.237
- 방향 분해: positive 889 / negative 646
- median impact score: 3.50
- market cap breakdown: {">$=100B": {"total": 901, "impacted": 92}, "$1B-<$100B": {"total": 3977, "impacted": 1078}, "$300M-<$1B": {"total": 983, "impacted": 272}, "<$300M or Unknown": {"total": 342, "impacted": 93}}
- source breakdown: {"news": {"total": 765, "impacted": 154}, "press_release": {"total": 5149, "impacted": 1318}, "company_news": {"total": 289, "impacted": 63}}
- 대표 사례:
  - 2025-07-08 07:00:00 | press_release | PROK | ProKidney Reports Statistically and Clinically Significant Topline Results for the Phase 2 REGEN-007 Trial Evaluating Rilparencel in Patients with Chronic Kidney Disease and Diabetes | change=515.0041 | change_1d=615.5812 | intraday=193.7008 | cap=$300M-<$1B
  - 2025-12-03 07:20:00 | press_release | CAPR | Capricor Therapeutics Announces Positive Topline Results from Pivotal Phase 3 HOPE-3 Study of Deramiocel in Duchenne Muscular Dystrophy | change=371.0692 | change_1d=299.3711 | intraday=-0.1333 | cap=$1B-<$100B
  - 2024-10-07 07:00:00 | press_release | SRRK | Scholar Rock Reports Apitegromab Meets Primary Endpoint in Phase 3 SAPPHIRE Study in Patients with Spinal Muscular Atrophy (SMA) | change=361.9946 | change_1d=297.4394 | intraday=30.1443 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-16T15:47:13.000Z | news | ANTH | Brian Moynihan isn’t so worried about an AI jobs bloodbath, pointing to a 1960s theory that computers would end all management roles | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-20T18:37:38.000Z | news | ANTH | Market rises after Supreme Court delivers unsurprising decision on Trump tariffs | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 5. 애널리스트 의견·목표가
- 설명: upgrade, downgrade, price target, initiated coverage 등 sell-side 의견 변화
- 총 건수: 2,752
- 영향 미침: 651
- 영향 안 미침: 2,101
- 영향 비율: 0.237
- 보수적 순위 점수(Wilson LB): 0.221
- 방향 분해: positive 330 / negative 321
- median impact score: 3.27
- market cap breakdown: {"$1B-<$100B": {"total": 1854, "impacted": 468}, ">$=100B": {"total": 399, "impacted": 94}, "<$300M or Unknown": {"total": 319, "impacted": 51}, "$300M-<$1B": {"total": 180, "impacted": 38}}
- source breakdown: {"company_news": {"total": 1500, "impacted": 440}, "news": {"total": 627, "impacted": 101}, "press_release": {"total": 625, "impacted": 110}}
- 대표 사례:
  - 2026-02-27T06:48:06.000Z | company_news | AAOI | B. Riley Securities Upgrades Applied Optoelectronics to Neutral, Raises Price Target to $54 | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
  - 2026-02-27T16:10:48.000Z | company_news | AAOI | Rosenblatt Maintains Buy on Applied Optoelectronics, Raises Price Target to $125 | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
  - 2026-02-27T07:56:41.000Z | company_news | AAOI | Needham Maintains Buy on Applied Optoelectronics, Raises Price Target to $80 | change=56.8821 | change_1d=90.9294 | intraday=27.7567 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-20T21:30:41.000Z | news | ANTH | Why Varonis Systems (VRNS) Shares Are Falling Today | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-21T03:22:49.000Z | news | ANTH | Why the JFrog sell-off is “excessive” according to Raymond James | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 6. 전략대안·구조조정·생존성
- 설명: strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈
- 총 건수: 398
- 영향 미침: 100
- 영향 안 미침: 298
- 영향 비율: 0.251
- 보수적 순위 점수(Wilson LB): 0.211
- 방향 분해: positive 56 / negative 44
- median impact score: 3.45
- market cap breakdown: {"$1B-<$100B": {"total": 228, "impacted": 55}, "<$300M or Unknown": {"total": 89, "impacted": 25}, ">$=100B": {"total": 52, "impacted": 7}, "$300M-<$1B": {"total": 29, "impacted": 13}}
- source breakdown: {"news": {"total": 150, "impacted": 41}, "press_release": {"total": 212, "impacted": 56}, "company_news": {"total": 36, "impacted": 3}}
- 대표 사례:
  - 2025-05-08 08:30:00 | press_release | VOR | Vor Bio Announces Exploration of Strategic Alternatives to Maximize Shareholder Value | change=-70.1214 | change_1d=-71.746 | intraday=-43.4629 | cap=$300M-<$1B
  - 2026-02-16T11:39:30.000Z | news | CRSR | Exploring 3 Undervalued Small Caps With Insider Buying In Global Markets | change=48.2533 | change_1d=21.179 | intraday=4.784 | cap=$300M-<$1B
  - 2025-06-06 07:30:00 | press_release | FCEL | FuelCell Energy Reports Second Quarter of Fiscal 2025 Results | change=24.4231 | change_1d=43.6538 | intraday=18.4982 | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 2026-02-19T13:30:00.000Z | news | JA | Janus Henderson Launches AA-A CLO ETF (JA) | change=None | change_1d=None | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-18T16:48:47.000Z | news | ANTH | Bitcoin price will hit a new record as AI destroys jobs, Arthur Hayes says | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 7. 상업화·시설·사업 확장
- 설명: launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트
- 총 건수: 16,797
- 영향 미침: 3,630
- 영향 안 미침: 13,167
- 영향 비율: 0.216
- 보수적 순위 점수(Wilson LB): 0.210
- 방향 분해: positive 1,981 / negative 1,649
- median impact score: 3.29
- market cap breakdown: {"$1B-<$100B": {"total": 12581, "impacted": 2739}, "$300M-<$1B": {"total": 1778, "impacted": 356}, ">$=100B": {"total": 1861, "impacted": 438}, "<$300M or Unknown": {"total": 577, "impacted": 97}}
- source breakdown: {"press_release": {"total": 14296, "impacted": 3191}, "news": {"total": 800, "impacted": 131}, "company_news": {"total": 1701, "impacted": 308}}
- 대표 사례:
  - 2024-11-27 08:31:00 | press_release | UMAC | Donald Trump Jr. Joins Unusual Machines as an Advisor | change=84.5149 | change_1d=249.4403 | intraday=-2.6479 | cap=$300M-<$1B
  - 2024-08-06 16:01:00 | press_release | LUMN | Lumen Technologies reports second quarter 2024 results | change=93.0502 | change_1d=155.9846 | intraday=25.6281 | cap=$1B-<$100B
  - 2025-05-21 08:30:00 | press_release | NVTS | Navitas Launches Industry-Leading 12kW GaN & SiC Platform, Achieving 97.8% Efficiency for Hyperscale AI Data Centers | change=-4.5 | change_1d=152.5 | intraday=-3.5354 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-17T19:25:08.000Z | news | ANTH | Anthropic was supposed to be a ‘safe’ alternative to OpenAI, but CEO Dario Amodei admits his company struggles to balance safety with profits | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-19T05:39:53.000Z | news | CVLLY | Insider Activity Highlights 3 Undervalued European Small Caps | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 8. 상장·직상장·자본시장 구조 이벤트
- 설명: direct listing, uplisting, Nasdaq listing, market debut 같은 상장 구조 이벤트
- 총 건수: 243
- 영향 미침: 63
- 영향 안 미침: 180
- 영향 비율: 0.259
- 보수적 순위 점수(Wilson LB): 0.208
- 방향 분해: positive 25 / negative 38
- median impact score: 3.90
- market cap breakdown: {"$1B-<$100B": {"total": 184, "impacted": 38}, "$300M-<$1B": {"total": 40, "impacted": 19}, "<$300M or Unknown": {"total": 9, "impacted": 3}, ">$=100B": {"total": 10, "impacted": 3}}
- source breakdown: {"press_release": {"total": 218, "impacted": 52}, "company_news": {"total": 14, "impacted": 8}, "news": {"total": 11, "impacted": 3}}
- 대표 사례:
  - 2025-10-21 17:45:00 | press_release | OWLS | D. Boral Capital Acted as Exclusive Financial Advisor to OBOOK Holdings Inc. (Nasdaq:OWLS) in Connection with its Direct Listing | change=-32.2917 | change_1d=-66.9444 | intraday=-31.4587 | cap=$300M-<$1B
  - 2026-03-06T09:40:04.000Z | company_news | DAWN | Trading Halt: Halt status updated at 8:40:00 AM ET: Quotation Resumption: News and Resumption Times | change=65.8842 | change_1d=None | intraday=0.3313 | cap=$1B-<$100B
  - 2026-03-06T09:25:04.000Z | company_news | DAWN | Trading Halt: Halted at 8:25:00 a.m. ET - Trading Halt: Halt News Pending | change=65.8842 | change_1d=None | intraday=0.3313 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-19T13:55:00.000Z | news | ANTH | NYSE Content Update: AI Behemoth Anthropic Valued at $380 Billion after Series G | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-18T20:37:00.000Z | news | TCKRF | Teck Announces Dividend | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 9. 일반 corporate PR
- 설명: conference, publication, appointment, facility update 등 일반 PR성 공지
- 총 건수: 59,242
- 영향 미침: 10,920
- 영향 안 미침: 48,322
- 영향 비율: 0.184
- 보수적 순위 점수(Wilson LB): 0.181
- 방향 분해: positive 5,983 / negative 4,937
- median impact score: 3.00
- market cap breakdown: {"$1B-<$100B": {"total": 44953, "impacted": 8176}, ">$=100B": {"total": 6611, "impacted": 1429}, "$300M-<$1B": {"total": 6517, "impacted": 1108}, "<$300M or Unknown": {"total": 1161, "impacted": 207}}
- source breakdown: {"press_release": {"total": 51074, "impacted": 8896}, "company_news": {"total": 7514, "impacted": 1903}, "news": {"total": 654, "impacted": 121}}
- 대표 사례:
  - 2024-11-12 17:00:00 | press_release | MVST | Microvast Reports Third Quarter 2024 Financial Results | change=-7.2858 | change_1d=307.9528 | intraday=-4.8947 | cap=$300M-<$1B
  - 2024-11-13 08:30:00 | press_release | QUBT | Quantum Computing, Inc. Secures First Order For TFLN Photonic Chip Foundry | change=92.7536 | change_1d=218.8406 | intraday=84.7222 | cap=$1B-<$100B
  - 2025-05-12 06:15:00 | press_release | CTMX | CytomX Therapeutics Announces First Quarter 2025 Financial Results and Provides Business Update | change=129.427 | change_1d=169.2805 | intraday=12.1053 | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 2026-02-17T21:56:11.000Z | news | SSRGF | SSR Mining: Q4 Earnings Snapshot | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2025-07-18 09:44:00 | press_release | WSO.B | Watsco Schedules Second Quarter Earnings Call on July 30, 2025 | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=$1B-<$100B

### 10. 소송·조사·회계 이슈
- 설명: lawsuit, subpoena, investigation, restatement, fraud allegation 등 법률/회계 리스크
- 총 건수: 1,648
- 영향 미침: 321
- 영향 안 미침: 1,327
- 영향 비율: 0.195
- 보수적 순위 점수(Wilson LB): 0.176
- 방향 분해: positive 185 / negative 136
- median impact score: 3.37
- market cap breakdown: {">$=100B": {"total": 101, "impacted": 15}, "<$300M or Unknown": {"total": 103, "impacted": 22}, "$1B-<$100B": {"total": 1238, "impacted": 257}, "$300M-<$1B": {"total": 206, "impacted": 27}}
- source breakdown: {"news": {"total": 221, "impacted": 40}, "press_release": {"total": 1340, "impacted": 262}, "company_news": {"total": 87, "impacted": 19}}
- 대표 사례:
  - 2024-09-30 09:00:00 | press_release | SMCI | Super Micro Computer Investors: October 29, 2024 Filing Deadline in Securities Class Action – Contact Lieff Cabraser | change=-0.7957 | change_1d=-90.3393 | intraday=0.7038 | cap=$1B-<$100B
  - 2024-10-01 00:00:00 | press_release | SMCI | Super Micro Computer Investors: October 29, 2024 Filing Deadline in Securities Class Action – Contact Lieff Cabraser | change=-90.2618 | change_1d=-89.9135 | intraday=-2.8743 | cap=$1B-<$100B
  - 2025-11-19 16:30:00 | press_release | PACS | PACS Group, Inc. Reports Third Quarter 2025 Results | change=16.632 | change_1d=81.1504 | intraday=17.119 | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 2026-02-21T22:09:00.000Z | news | SDM | SDM DEADLINE NOTICE: ROSEN, TRUSTED INVESTOR COUNSEL, Encourages Smart Digital Group Ltd. Investors with Losses in Excess of $100K to Secure Counsel Before Important Deadline in Securities Class Action - SDM | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-16T00:49:00.000Z | news | SDM | ROSEN, A TRUSTED AND LEADING LAW FIRM, Encourages Smart Digital Group Ltd. Investors to Secure Counsel Before Important Deadline in Securities Class Action - SDM | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 11. 실적 부진·가이던스 하향
- 설명: miss, lower guidance, weak outlook, revenue decline 등 실적성 악재
- 총 건수: 1,947
- 영향 미침: 369
- 영향 안 미침: 1,578
- 영향 비율: 0.190
- 보수적 순위 점수(Wilson LB): 0.173
- 방향 분해: positive 174 / negative 195
- median impact score: 2.73
- market cap breakdown: {">$=100B": {"total": 563, "impacted": 36}, "<$300M or Unknown": {"total": 619, "impacted": 126}, "$1B-<$100B": {"total": 688, "impacted": 174}, "$300M-<$1B": {"total": 77, "impacted": 33}}
- source breakdown: {"news": {"total": 1684, "impacted": 285}, "company_news": {"total": 217, "impacted": 77}, "press_release": {"total": 46, "impacted": 7}}
- 대표 사례:
  - 2026-03-04T07:35:49.000Z | company_news | BW | Babcock & Wilcox Q4 EPS $(0.05) Misses $0.00 Estimate, Sales $161.000M Miss $173.867M Estimate | change=45.679 | change_1d=64.0741 | intraday=21.2744 | cap=$1B-<$100B
  - 2026-03-04T17:09:44.000Z | company_news | ALTO | Alto Ingredients Q4 EPS $0.28 Beats $(0.02) Estimate, Sales $231.965M Miss $234.830M Estimate | change=0.0 | change_1d=54.6154 | intraday=-2.2556 | cap=$300M-<$1B
  - 2026-02-19T17:31:54.000Z | news | ALIT | Alight, Inc. Q4 2025 Earnings Call Summary | change=-38.2061 | change_1d=-42.4504 | intraday=-7.5069 | cap=<$300M or Unknown
- 반례/영향 약한 사례:
  - 2026-02-18T16:20:00.000Z | news | ANTH | Wall Street Analysts Tom Lee and Dan Ives Disagree on Software "Armageddon": One Says "Buy" While the Other Says "Layoffs Are Coming." Who Is Right? | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown
  - 2026-02-15T10:54:00.000Z | news | ANTH | Prediction: Artificial Intelligence (AI) Will Drive the Next Wave of Tech Leadership, and This Stock Stands to Win | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

### 12. 전략 제휴·라이선스·정부지원·대형 계약
- 설명: partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈
- 총 건수: 14,670
- 영향 미침: 2,609
- 영향 안 미침: 12,061
- 영향 비율: 0.178
- 보수적 순위 점수(Wilson LB): 0.172
- 방향 분해: positive 1,499 / negative 1,110
- median impact score: 2.79
- market cap breakdown: {"$1B-<$100B": {"total": 10824, "impacted": 1861}, "$300M-<$1B": {"total": 1434, "impacted": 280}, ">$=100B": {"total": 1852, "impacted": 361}, "<$300M or Unknown": {"total": 560, "impacted": 107}}
- source breakdown: {"press_release": {"total": 12898, "impacted": 2235}, "company_news": {"total": 843, "impacted": 197}, "news": {"total": 929, "impacted": 177}}
- 대표 사례:
  - 2025-02-10 06:30:00 | press_release | GSAT | MDA SPACE SIGNS $1.1B CONTRACT WITH GLOBALSTAR TO BUILD NEXT GENERATION LEO CONSTELLATION | change=3.3113 | change_1d=1511.2583 | intraday=1.2987 | cap=$1B-<$100B
  - 2025-11-10 07:00:00 | press_release | GLTO | Galecto Announces Acquisition of Damora Therapeutics | change=248.4848 | change_1d=376.3636 | intraday=-19.5429 | cap=$1B-<$100B
  - 2026-02-18 08:15:00 | press_release | RXT | Rackspace and Palantir Partner to Run Foundry and AIP in Production with Governed Managed Operations | change=226.969 | change_1d=192.3628 | intraday=37.4122 | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 2024-11-26 17:00:00 | press_release | USAS | Americas Gold and Silver Provides an Update on Filing and Mailing of Meeting Materials in Connection With the Proposed Acquisition of the Remaining 40% Interest in the Galena Complex | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=$1B-<$100B
  - 2026-02-19T09:01:00.000Z | news | ITCFY | Form 8.5 (EPT/RI)-NCC Group plc | change=0.0 | change_1d=0.0 | intraday=0.0 | cap=<$300M or Unknown

## $300M-<$1B 상위 case

- 1. 상장·직상장·자본시장 구조 이벤트: impacted=19 / total=40, ratio=0.475, Wilson=0.329
- 2. 실적 부진·가이던스 하향: impacted=33 / total=77, ratio=0.429, Wilson=0.324
- 3. 희석성 자금조달·오퍼링: impacted=222 / total=695, ratio=0.319, Wilson=0.286
- 4. 전략대안·구조조정·생존성: impacted=13 / total=29, ratio=0.448, Wilson=0.284
- 5. 임상·규제 실패: impacted=26 / total=68, ratio=0.382, Wilson=0.276

## $1B-<$100B 상위 case

- 1. 실적 호조·가이던스 상향: impacted=325 / total=873, ratio=0.372, Wilson=0.341
- 2. 임상·규제 실패: impacted=125 / total=351, ratio=0.356, Wilson=0.308
- 3. 임상·규제 성공: impacted=1,078 / total=3,977, ratio=0.271, Wilson=0.257
- 4. 희석성 자금조달·오퍼링: impacted=1,131 / total=4,390, ratio=0.258, Wilson=0.245
- 5. 애널리스트 의견·목표가: impacted=468 / total=1,854, ratio=0.252, Wilson=0.233

## >$=100B 상위 case

- 1. 상업화·시설·사업 확장: impacted=438 / total=1,861, ratio=0.235, Wilson=0.217
- 2. 일반 corporate PR: impacted=1,429 / total=6,611, ratio=0.216, Wilson=0.206
- 3. 애널리스트 의견·목표가: impacted=94 / total=399, ratio=0.236, Wilson=0.197
- 4. 전략 제휴·라이선스·정부지원·대형 계약: impacted=361 / total=1,852, ratio=0.195, Wilson=0.178
- 5. 실적 호조·가이던스 상향: impacted=63 / total=295, ratio=0.214, Wilson=0.171

## 토큰 비용 추정

- 가정: 영어 기사 기준 `1 token ~= 4 chars`, 기사별 프롬프트 오버헤드 180 tokens, 출력 120 tokens
- 전체 문자 수: 639,244,846
- raw input tokens 추정: 159,811,212
- naive article-by-article total tokens 추정: 200,238,912

## 해석

- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 반대일 수 있다.
- 실적/가이던스, 자금조달, 전략 제휴는 source type이 달라도 반복적으로 나타나는 상위 case다.
- `300M~<1B` 버킷은 동일한 뉴스 유형에서도 절대 변동폭이 더 크게 나오기 쉬우므로, 대형주와 같은 기준으로 자르면 과대판정되기 쉽다.
- `<$300M or Unknown` 집단은 전체 데이터에서 비중이 아직 크므로, 다음 단계에서는 market cap 보강이 되면 3개 주 버킷 비교가 더 안정된다.
- 이 note의 사고과정 로그는 절차/기준 로그이며, 내부 추론 전체를 그대로 저장한 것은 아니다.