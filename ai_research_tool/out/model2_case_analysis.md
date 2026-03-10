# Model 2 Case Analysis (2025-01-01 ~ today)

## 사고과정 로그

1. 이번 버전의 범위는 `press_release only`로 제한했다.
2. 외부 링크 재방문은 하지 않고 `news_items` + `news_fulltext` + `news_change_metrics` + `company_profiles.market_cap`만 사용했다.
3. `press_release` 중 full text + change%가 붙은 row만 분석 대상으로 삼았다.
4. `market_news`는 사용자 요청에 따라 이번 note에서는 일단 제외했다.
5. market cap bucket별로 impact score의 p80을 임계값으로 사용해 `영향 미침 / 영향 안 미침`을 나눴다.
6. 제목과 full text의 반복 패턴으로 case type을 분류하고, 유형별 `영향 미친 수 : 영향 안 미친 수`를 계산했다.

## 데이터 가용성

- press_release analyzable rows: 21,108
- market_news: 이번 버전 note에서는 제외

## market cap bucket별 impact 기준

- >$10B: count=5,166, p50=2.24, p80=4.78, p90=6.94
- $2B-$10B: count=3,624, p50=4.17, p80=9.00, p90=12.83
- $300M-$2B: count=12,090, p50=4.82, p80=10.67, p90=16.27
- Unknown: count=228, p50=3.00, p80=7.32, p90=9.97

## 유형 분류 결과

### 1. 임상·규제 실패
- 설명: 임상 실패, CRL, 주요 endpoint 미충족, hold·중단 등 바이오 규제/임상 악재
- 총 건수: 62
- 영향 미침: 26
- 영향 안 미침: 36
- 영향 비율: 0.419
- 보수적 순위 점수(Wilson LB): 0.305
- 방향 분해: positive 14 / negative 12
- median impact score: 6.87
- market cap breakdown: {"$300M-$2B": {"total": 43, "impacted": 22}, ">$10B": {"total": 12, "impacted": 2}, "$2B-$10B": {"total": 7, "impacted": 2}}
- 대표 사례:
  - 2025-12-11 07:00:00 | RZLT | Rezolute Announces Phase 3 sunRIZE Study Results in Congenital Hyperinsulinism | change=-87.2029 | change_1d=-83.5466 | cap=$300M-$2B
  - 2025-07-22 07:00:00 | REPL | Replimune Receives Complete Response Letter from FDA for RP1 Biologics License Application for the Treatment of Advanced Melanoma | change=-77.2101 | change_1d=-72.9927 | cap=$300M-$2B
  - 2025-04-03 08:00:00 | ALDX | Aldeyra Therapeutics Receives Complete Response Letter from the U.S. Food and Drug Administration for the Reproxalap New Drug Application for the Treatment of Signs and Symptoms of Dry Eye Disease | change=-73.3333 | change_1d=-64.507 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-10-02 09:00:00 | AMGN | LANDMARK PHASE 3 TRIAL (VESALIUS-CV) MEETS PRIMARY ENDPOINTS IN A CARDIOVASCULAR PRIMARY PREVENTION STUDY OF 12,000 PATIENTS | change=-0.3685 | change_1d=-0.2044 | cap=>$10B
  - 2025-10-30 06:00:00 | WLKP | Westlake Chemical Partners Announces Renewal of Ethylene Sales Agreement | change=0.0 | change_1d=-0.4749 | cap=$300M-$2B

### 2. 상장·직상장·자본시장 구조 이벤트
- 설명: direct listing, uplisting, Nasdaq listing, market debut 같은 상장 구조 이벤트
- 총 건수: 64
- 영향 미침: 25
- 영향 안 미침: 39
- 영향 비율: 0.391
- 보수적 순위 점수(Wilson LB): 0.281
- 방향 분해: positive 11 / negative 14
- median impact score: 6.69
- market cap breakdown: {"$300M-$2B": {"total": 36, "impacted": 13}, "$2B-$10B": {"total": 25, "impacted": 12}, ">$10B": {"total": 3, "impacted": 0}}
- 대표 사례:
  - 2025-10-21 17:45:00 | OWLS | D. Boral Capital Acted as Exclusive Financial Advisor to OBOOK Holdings Inc. (Nasdaq:OWLS) in Connection with its Direct Listing | change=-32.2917 | change_1d=-66.9444 | cap=$300M-$2B
  - 2025-10-14 11:01:00 | TMQ | Canadian Investment Regulatory Organization Trade Resumption - TMQ | change=61.5854 | change_1d=28.9634 | cap=$300M-$2B
  - 2025-10-14 10:57:00 | TMQ | Canadian Investment Regulatory Organization Trading Halt - TMQ | change=61.5854 | change_1d=28.9634 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-09-23 12:00:00 | CHE | Chemed Corporation to Present at the Jefferies 2025 Healthcare Services Conference | change=-0.4409 | change_1d=0.2347 | cap=$2B-$10B
  - 2025-07-01 08:05:00 | NDAQ | Nasdaq Welcomes 142 IPOs in the First Half of 2025 | change=-0.5368 | change_1d=0.1118 | cap=>$10B

### 3. 희석성 자금조달·오퍼링
- 설명: public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈
- 총 건수: 1,085
- 영향 미침: 319
- 영향 안 미침: 766
- 영향 비율: 0.294
- 보수적 순위 점수(Wilson LB): 0.268
- 방향 분해: positive 167 / negative 152
- median impact score: 5.16
- market cap breakdown: {"$300M-$2B": {"total": 662, "impacted": 213}, "$2B-$10B": {"total": 211, "impacted": 56}, ">$10B": {"total": 190, "impacted": 44}, "Unknown": {"total": 22, "impacted": 6}}
- 대표 사례:
  - 2025-09-24 16:06:00 | QURE | uniQure Announces $200 Million Proposed Public Offering | change=247.7306 | change_1d=285.4319 | cap=$300M-$2B
  - 2025-09-24 07:10:00 | QURE | uniQure Announces Refinancing of Existing $50 Million Debt and Securing Up to an Additional $125 Million in Non-Dilutive Funding | change=247.7306 | change_1d=285.4319 | cap=$300M-$2B
  - 2025-10-16 23:45:00 | PRAX | Praxis Precision Medicines, Inc. Announces Pricing of $525 Million Public Offering | change=183.714 | change_1d=231.2816 | cap=$2B-$10B
- 반례/영향 약한 사례:
  - 2025-07-01 07:30:00 | WSO.B | Watsco Declares $3.00 Quarterly Dividend | change=0.0 | change_1d=0.0 | cap=>$10B
  - 2026-02-18 08:11:00 | GEL | Genesis Energy, L.P. Announces Public Offering of Senior Notes | change=0.0566 | change_1d=-0.0566 | cap=$2B-$10B

### 4. 실적·가이던스
- 설명: quarter/full year financial results, revenue, guidance, backlog, outlook 등 실적성 이벤트
- 총 건수: 5,182
- 영향 미침: 1,403
- 영향 안 미침: 3,779
- 영향 비율: 0.271
- 보수적 순위 점수(Wilson LB): 0.259
- 방향 분해: positive 863 / negative 540
- median impact score: 4.91
- market cap breakdown: {"$300M-$2B": {"total": 3400, "impacted": 829}, "$2B-$10B": {"total": 905, "impacted": 266}, ">$10B": {"total": 823, "impacted": 291}, "Unknown": {"total": 54, "impacted": 17}}
- 대표 사례:
  - 2025-05-12 06:15:00 | CTMX | CytomX Therapeutics Announces First Quarter 2025 Financial Results and Provides Business Update | change=129.427 | change_1d=169.2805 | cap=$300M-$2B
  - 2025-10-20 08:00:00 | GSIT | GSI Technology to Announce Fiscal Second Quarter 2026 Results on October 30, 2025 | change=155.315 | change_1d=113.7795 | cap=$300M-$2B
  - 2025-08-11 09:02:00 | TLS | Telos Corporation Announces Second Quarter 2025 Earnings | change=62.605 | change_1d=120.1681 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-04-23 17:00:00 | GROY | Gold Royalty Announces First Quarter 2025 Preliminary Results | change=0.0 | change_1d=0.0 | cap=$300M-$2B
  - 2026-01-27 08:30:00 | CPS | Cooper Standard to Discuss Fourth Quarter and Full Year 2025 Results; Provides Details for Management Conference Call | change=0.0319 | change_1d=0.0 | cap=$300M-$2B

### 5. 전략대안·구조조정·생존성
- 설명: strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈
- 총 건수: 42
- 영향 미침: 14
- 영향 안 미침: 28
- 영향 비율: 0.333
- 보수적 순위 점수(Wilson LB): 0.210
- 방향 분해: positive 6 / negative 8
- median impact score: 4.15
- market cap breakdown: {"$2B-$10B": {"total": 7, "impacted": 2}, "$300M-$2B": {"total": 23, "impacted": 9}, "Unknown": {"total": 2, "impacted": 0}, ">$10B": {"total": 10, "impacted": 3}}
- 대표 사례:
  - 2025-05-08 08:30:00 | VOR | Vor Bio Announces Exploration of Strategic Alternatives to Maximize Shareholder Value | change=-70.1214 | change_1d=-71.746 | cap=$300M-$2B
  - 2025-06-06 07:30:00 | FCEL | FuelCell Energy Reports Second Quarter of Fiscal 2025 Results | change=24.4231 | change_1d=43.6538 | cap=$300M-$2B
  - 2025-11-17 11:54:00 | SHMD | SCHMID Group N.V. Receives Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard | change=-21.1293 | change_1d=-31.5118 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-02-25 07:00:00 | SSNC | State Street and SS&C Technologies Restructure International Financial Data Services (IFDS) Joint Venture in Luxembourg and Ireland | change=-0.2256 | change_1d=-0.3497 | cap=Unknown
  - 2025-02-25 07:00:00 | SSNC | State Street and SS&C Technologies Restructure International Financial Data Services (IFDS) Joint Venture in Luxembourg and Ireland | change=-0.2256 | change_1d=-0.3497 | cap=Unknown

### 6. 임상·규제 성공
- 설명: positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재
- 총 건수: 1,446
- 영향 미침: 334
- 영향 안 미침: 1,112
- 영향 비율: 0.231
- 보수적 순위 점수(Wilson LB): 0.210
- 방향 분해: positive 231 / negative 103
- median impact score: 4.33
- market cap breakdown: {"$2B-$10B": {"total": 161, "impacted": 35}, "$300M-$2B": {"total": 994, "impacted": 258}, ">$10B": {"total": 275, "impacted": 35}, "Unknown": {"total": 16, "impacted": 6}}
- 대표 사례:
  - 2025-07-08 07:00:00 | PROK | ProKidney Reports Statistically and Clinically Significant Topline Results for the Phase 2 REGEN-007 Trial Evaluating Rilparencel in Patients with Chronic Kidney Disease and Diabetes | change=515.0041 | change_1d=615.5812 | cap=$300M-$2B
  - 2025-09-24 07:05:00 | QURE | uniQure Announces Positive Topline Results from Pivotal Phase I/II Study of AMT-130 in Patients with Huntington’s Disease | change=247.7306 | change_1d=285.4319 | cap=$300M-$2B
  - 2025-09-24 16:16:00 | PEPG | PepGen Announces Highest Mean Splicing Correction Reported in DM1 Patients | change=36.4103 | change_1d=201.5385 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2026-03-06 08:00:00 | HALO | U.S. FDA Approves TECVAYLI® in Combination with DARZALEX FASPRO® for Relapsed/Refractory Multiple Myeloma | change=0.0148 | change_1d=None | cap=$2B-$10B
  - 2026-03-04 16:10:00 | EHAB | Enhabit Reports Fourth Quarter 2025 Financial Results | change=0.0735 | change_1d=0.0735 | cap=$300M-$2B

### 7. 전략 제휴·라이선스·정부지원·대형 계약
- 설명: partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈
- 총 건수: 2,711
- 영향 미침: 536
- 영향 안 미침: 2,175
- 영향 비율: 0.198
- 보수적 순위 점수(Wilson LB): 0.183
- 방향 분해: positive 346 / negative 190
- median impact score: 3.74
- market cap breakdown: {"$300M-$2B": {"total": 1570, "impacted": 324}, ">$10B": {"total": 719, "impacted": 142}, "$2B-$10B": {"total": 401, "impacted": 67}, "Unknown": {"total": 21, "impacted": 3}}
- 대표 사례:
  - 2026-02-18 08:15:00 | RXT | Rackspace and Palantir Partner to Run Foundry and AIP in Production with Governed Managed Operations | change=226.969 | change_1d=192.3628 | cap=$300M-$2B
  - 2025-10-06 19:54:00 | TMQ | Trilogy Metals Applauds President Trump's Decision to Grant Permits for the Ambler Access Project to Enable the Development of Critical Minerals in Alaska | change=0.4808 | change_1d=212.5 | cap=$300M-$2B
  - 2025-10-06 17:03:00 | TMQ | Trilogy Metals Announces Strategic Investment by US Federal Government | change=0.4808 | change_1d=212.5 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2026-02-25 10:19:00 | FE | FirstEnergy Foundation Invests in First Responder Training with $10,000 Grant to Butler County Community College | change=0.0 | change_1d=0.0 | cap=>$10B
  - 2025-07-11 07:43:00 | BBOT | Helix Acquisition Corp. II and BridgeBio Oncology Therapeutics Announce Effectiveness of Registration Statement for Proposed Business Combination | change=0.0 | change_1d=0.0 | cap=$300M-$2B

### 8. 상업화·시설·사업 확장
- 설명: launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트
- 총 건수: 2,177
- 영향 미침: 344
- 영향 안 미침: 1,833
- 영향 비율: 0.158
- 보수적 순위 점수(Wilson LB): 0.143
- 방향 분해: positive 216 / negative 128
- median impact score: 3.57
- market cap breakdown: {"$2B-$10B": {"total": 375, "impacted": 66}, "$300M-$2B": {"total": 1225, "impacted": 171}, ">$10B": {"total": 549, "impacted": 103}, "Unknown": {"total": 28, "impacted": 4}}
- 대표 사례:
  - 2025-08-25 12:26:00 | USAS | Silver Mining Sector Emerges as Clear Winner Amid Production Expansion Wave | change=-3.9216 | change_1d=138.2353 | cap=$2B-$10B
  - 2025-08-25 12:26:00 | USAS | Silver Mining Sector Emerges as Clear Winner Amid Production Expansion Wave | change=-3.9216 | change_1d=138.2353 | cap=$2B-$10B
  - 2025-10-13 08:27:00 | ABAT | American Battery Technology Company Completes All Required NEPA Baseline Studies for its Tonopah Flats Lithium Project, One of the Largest Critical Mineral Lithium Projects in the U.S. | change=36.5926 | change_1d=67.8519 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-03-06 08:05:00 | SVRA | Savara Announces U.S. Launch of the aPAP ClearPath™ Dried Blood Spot Test to Detect Autoimmune Pulmonary Alveolar Proteinosis (aPAP) | change=0.0 | change_1d=0.0 | cap=$300M-$2B
  - 2025-08-26 12:00:00 | WMT | Walmart Unveils New Seller Capabilities and Tools, Growth Initiatives and Next-Level Omnichannel Opportunities at Marketplace Seller Summit | change=-0.0208 | change_1d=0.0104 | cap=>$10B

### 9. 일반 corporate PR
- 설명: conference, publication, appointment, facility update 등 일반 PR성 공지
- 총 건수: 8,339
- 영향 미침: 1,222
- 영향 안 미침: 7,117
- 영향 비율: 0.147
- 보수적 순위 점수(Wilson LB): 0.139
- 방향 분해: positive 729 / negative 493
- median impact score: 3.27
- market cap breakdown: {"$300M-$2B": {"total": 4137, "impacted": 579}, "$2B-$10B": {"total": 1532, "impacted": 219}, ">$10B": {"total": 2585, "impacted": 414}, "Unknown": {"total": 85, "impacted": 10}}
- 대표 사례:
  - 2025-01-08 16:05:00 | SANA | Sana Biotechnology to Present at the 43rd Annual J.P. Morgan Healthcare Conference | change=160.6061 | change_1d=121.8182 | cap=$300M-$2B
  - 2025-10-20 09:00:00 | GSIT | Compute-In-Memory APU Achieves GPU-Class AI Performance at a Fraction of the Energy Cost | change=155.315 | change_1d=113.7795 | cap=$300M-$2B
  - 2025-09-24 07:00:00 | LAC | Lithium Americas Comments on Share Price Movement | change=95.7655 | change_1d=140.0651 | cap=$300M-$2B
- 반례/영향 약한 사례:
  - 2025-10-31 16:30:00 | RBBN | Ribbon Communications Announces Inducement Equity Grants to Steve McCaffery and Don Toft Under Nasdaq Listing Rule 5635(c)(4) | change=0.0 | change_1d=0.0 | cap=$300M-$2B
  - 2025-04-23 06:00:00 | GROY | GoldMining Inc. Identifies Significant Antimony Mineralization Including 2.79 g/t AuEq (0.71 g/t Au and 0.59% Sb) over 79 metres and 1.91 g/t AuEq (1.56 g/t Au and 0.10% Sb) over 128 metres at its 100% Owned Crucero Project | change=0.0 | change_1d=0.0 | cap=$300M-$2B

## 해석

- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 정반대다.
- 자금조달/오퍼링은 표면적으로는 악재형 이벤트가 많지만, 데이터/파트너십 같은 강한 호재와 동반 공시되면 예외적으로 강한 상승 사례가 같이 나온다.
- market cap이 작을수록 같은 이슈에서도 impact score가 훨씬 크게 튀므로, 영향 판정은 절대 change% 하나로 보면 왜곡된다.
- market_news는 이번 버전에서 사용자 요청으로 제외했다. 나중에 다시 포함하려면 press_release와 별도 기준으로 분석하는 편이 맞다.