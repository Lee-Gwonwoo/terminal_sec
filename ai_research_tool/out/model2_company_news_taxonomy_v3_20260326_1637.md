# Model 2 company_news taxonomy v3 (2025+)

## 분석 범위

- analysis_id: `2b5ab4d1-a1dd-4906-8226-e21d8bd41465`
- source_type: `company_news`
- source_name: `FINNHUB`
- 기간: `2025-01-01 ~ 2026-03-26`
- 전체 분류 row: 599,681
- impact 계산 가능 row: 527,876
- impact 판정 row: 105,608
- `잡것들` row: 371,983
- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.

## taxonomy 설계 포인트

- direct event, indirect read-through, information-flow, true residual을 분리했다.
- 기존 `macro_sector_readthrough`와 `meaningless_others`에 섞여 있던 policy, peer, valuation, flow, media 패턴을 독립 case로 승격했다.
- `잡것들`은 진짜 저정보 residual만 남기는 것을 목표로 한다.

## bucket 기준

- `overall_impact_score = max(immediate, short, medium)`
- `immediate = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
- `short = max(abs(change_1d_pct), abs(change_3d_pct))`
- `medium = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`
- bucket별 `p80`을 impact threshold로 사용했다.

| bucket | p50 | p80 | p90 |
| --- | ---: | ---: | ---: |
| <$300M or Unknown | 17.92 | 36.93 | 45.60 |
| $100B~300B | 8.14 | 14.88 | 20.18 |
| $10B~100B | 9.42 | 17.84 | 24.79 |
| $1B~10B | 13.46 | 25.24 | 34.65 |
| $300B~ | 7.50 | 14.30 | 19.28 |
| $300M~1B | 16.72 | 30.14 | 41.41 |

## case 요약

| top_level | case | total | impacted | max impact |
| --- | --- | ---: | ---: | ---: |
| residual | 잡것들 | 371,983 | 64,575 | 3646.27 |
| long | 애널리스트 상향·커버리지 개시 | 30,672 | 5,075 | 976.58 |
| residual | 매크로·시장 코멘터리 | 25,451 | 4,066 | 1042.65 |
| long | 출시·상업화·확장 | 22,505 | 3,622 | 953.52 |
| short | 애널리스트 하향·목표가 하향 | 18,441 | 2,887 | 1073.67 |
| long | 제휴·라이선스·협업 | 15,789 | 2,767 | 1044.21 |
| residual | 실적 transcript·snapshot | 15,686 | 3,038 | 1760.66 |
| residual | feature·투자아이디어 해설 | 15,549 | 3,167 | 1002.62 |
| short | peer 투자·경쟁 심화 read-through | 13,505 | 1,846 | 221.06 |
| long | 실적 호조·가이던스 상향 | 11,894 | 2,396 | 1114.55 |
| long | M&A·전략자산 거래 | 11,849 | 1,711 | 486.06 |
| short | 소송·조사·회계 리스크 | 7,647 | 1,759 | 795.85 |
| long | 밸류에이션 discount 해소 narrative | 5,448 | 738 | 228.22 |
| short | 희석성 자금조달 | 3,434 | 881 | 675.10 |
| short | top mover·헤드라인 증폭·하락 해설 | 3,328 | 884 | 1117.17 |
| long | 수요 급증·백로그 확대 | 3,131 | 516 | 118.90 |
| long | top mover·헤드라인 증폭·상승 해설 | 2,937 | 1,138 | 648.56 |
| long | 자사주 매입·주주환원 | 2,552 | 341 | 216.53 |
| short | 구조조정·생존성 악화 | 2,312 | 366 | 133.56 |
| long | 고객 채택·대형 고객 확보 | 1,870 | 309 | 120.08 |
| residual | 멀티종목 movers·watchlist 기사 | 1,514 | 487 | 638.43 |
| long | 숏커버·포지셔닝 언와인드·매수 유입 | 1,475 | 266 | 712.75 |
| short | 공급망 차질·원가 압박 read-through | 1,401 | 536 | 258.71 |
| long | 승인·임상 호재 | 1,366 | 283 | 648.56 |
| short | 밸류에이션 부담·multiple compression narrative | 1,329 | 291 | 516.05 |
| residual | IPO·상장 이벤트 | 1,221 | 303 | 675.10 |
| residual | 실적 발표 전 기대 기사 | 1,145 | 247 | 183.81 |
| long | 애널리스트 코멘트 증폭·긍정 | 981 | 243 | 92.18 |
| short | 실적 부진·가이던스 하향 | 706 | 164 | 1760.66 |
| long | 정부·대형 계약 수주 | 584 | 157 | 1511.26 |
| short | 정책·법안 역풍 read-through | 520 | 104 | 64.58 |
| short | 규제·임상 악재 | 373 | 100 | 371.07 |
| short | 거래정지·역분할·상장유지 스트레스 | 354 | 173 | 3646.27 |
| short | 차익실현·디그로싱·매도 수급 | 248 | 81 | 120.19 |
| long | 경영진 보강·거버넌스 개선 | 209 | 35 | 93.87 |
| short | 애널리스트 코멘트 증폭·부정 | 117 | 22 | 182.82 |
| long | 정책·법안 수혜 read-through | 85 | 20 | 63.77 |
| long | peer 호조 read-through | 42 | 7 | 57.41 |
| short | 경영진 이탈·거버넌스 충격 | 25 | 7 | 235.86 |
| long | 공급망 완화·원가 개선 read-through | 3 | 0 | 11.51 |

## 유형 정의

### 잡것들 (`meaningless_others`)
- 상위 분류: `residual`
- 한 줄 정의: 위 유형으로 재현 가능하게 설명하기 어려운 저정보 잔여 기사다.
- 핵심 가치 경로: 직접 가치 경로가 약하거나 불명확하다.
- 포함 신호: generic promotion, ambiguous article
- 제외 신호: 명확한 earnings/analyst/contract/policy read-through 기사
- 빠른 판별 질문: 독립 유형으로 승격시킬 만큼 반복 패턴이 약한가?
- 집계: total=371,983, impacted=64,575, max impact=3646.27
- 대표 예시:
  - 2025-06-06T12:36:07 | NKTR | Nektar Therapeutics Increases Authorized Shares To 390 Million | score=3646.27 | tag=multi_window_impact
  - 2025-04-30T06:01:47 | RGC | Why Regencell Bioscience Holdings Limited (RGC) is Surging in 2025 | score=2267.06 | tag=multi_window_impact

### 애널리스트 상향·커버리지 개시 (`analyst_upgrade_positive`)
- 상위 분류: `long`
- 한 줄 정의: buy/outperform, coverage initiation, target raise가 핵심인 기사다.
- 핵심 가치 경로: sell-side 평가 상향이 수급 유입과 re-rating으로 이어진다.
- 포함 신호: initiates coverage, outperform, raises price target, buy rating
- 제외 신호: target cut, downgraded
- 빠른 판별 질문: formal analyst action인가? / 상향 메시지인가?
- 집계: total=30,672, impacted=5,075, max impact=976.58
- 대표 예시:
  - 2025-05-22T03:27:42 | RAPT | HC Wainwright & Co. Assumes RAPT Therapeutics at Buy, Announces Price Target of $6 | score=976.58 | tag=multi_window_impact
  - 2025-06-02T16:30:00 | MFI | Zacks Small-Cap Research Initiates Coverage on mF International Limited | score=484.20 | tag=multi_window_impact

### 매크로·시장 코멘터리 (`macro_market_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: 금리, Fed, 인플레이션, 지수 움직임처럼 광범위한 시장 설명 기사다.
- 핵심 가치 경로: 개별 기업보다 외부 환경 read-through를 다룬다.
- 포함 신호: stock market today, fed, inflation, nasdaq, s&p 500
- 제외 신호: single-company event, peer competition
- 빠른 판별 질문: 여러 종목 공통 설명인가?
- 집계: total=25,451, impacted=4,066, max impact=1042.65
- 대표 예시:
  - 2025-08-27T00:03:57 | LCID | Lucid (LCID): Buy, Sell, or Hold Post Q2 Earnings? | score=1042.65 | tag=multi_window_impact
  - 2025-03-13T05:52:29 | RGC | Nasdaq Down Over 100 Points; US Producer Inflation Stalls In February | score=971.43 | tag=multi_window_impact

### 출시·상업화·확장 (`commercial_launch_expansion_positive`)
- 상위 분류: `long`
- 한 줄 정의: launch, rollout, expansion, commercialization이 핵심인 기사다.
- 핵심 가치 경로: 제품/서비스 확대가 미래 매출과 채택 증가로 이어진다.
- 포함 신호: launches, launch, expands, commercial launch
- 제외 신호: event promotion, generic preview
- 빠른 판별 질문: 실제 상업화/확장 이벤트인가?
- 집계: total=22,505, impacted=3,622, max impact=953.52
- 대표 예시:
  - 2025-08-20T06:16:51 | LCID | XPeng Q2: A Cautious Buy In A Brutal Chinese EV Market | score=953.52 | tag=sustained_repricing
  - 2025-08-07T06:30:00 | LCID | Uber CEO Floats Major Robotaxi Expansion | score=787.41 | tag=sustained_repricing

### 애널리스트 하향·목표가 하향 (`analyst_downgrade_negative`)
- 상위 분류: `short`
- 한 줄 정의: downgrade, underperform, target cut이 핵심인 기사다.
- 핵심 가치 경로: sell-side 평가 하향이 기대치 조정과 수급 이탈로 이어진다.
- 포함 신호: downgraded, underperform, lowers price target, target cut
- 제외 신호: initiates coverage, raises price target
- 빠른 판별 질문: formal downgrade 또는 target cut인가?
- 집계: total=18,441, impacted=2,887, max impact=1073.67
- 대표 예시:
  - 2025-08-29T18:49:00 | LCID | Why Lucid Stock Skidded to a More Than 4% Loss Today | score=1073.67 | tag=multi_window_impact
  - 2025-05-22T04:55:18 | RAPT | UBS Maintains Neutral on RAPT Therapeutics, Lowers Price Target to $1 | score=976.58 | tag=multi_window_impact

### 제휴·라이선스·협업 (`partnership_license_positive`)
- 상위 분류: `long`
- 한 줄 정의: partnership, collaboration, licensing deal이 핵심인 기사다.
- 핵심 가치 경로: 외부 자원 결합과 channel 확대가 가치 상승 경로를 만든다.
- 포함 신호: partnership, collaboration, license agreement, exclusive global license
- 제외 신호: offering, lawsuit
- 빠른 판별 질문: 경제적 제휴인가? / 실질 협업이 핵심인가?
- 집계: total=15,789, impacted=2,767, max impact=1044.21
- 대표 예시:
  - 2025-01-24T03:23:22 | GSAT | Globalstar: Undervalued And Diversifying Into High Margin High-Growth Opportunities | score=1044.21 | tag=sustained_repricing
  - 2025-08-19T08:42:38 | LCID | Lucid: Partnerships And Midsize Platform Show Promise, Risks Remain | score=867.89 | tag=sustained_repricing

### 실적 transcript·snapshot (`earnings_transcript_snapshot`)
- 상위 분류: `residual`
- 한 줄 정의: earnings call transcript, snapshot, highlights 같은 요약 기사다.
- 핵심 가치 경로: 원인 기사보다 후행 정리 기사다.
- 포함 신호: earnings call transcript, earnings snapshot, highlights
- 제외 신호: beat estimates, cuts guidance
- 빠른 판별 질문: 새 사건보다 정리/전사본인가?
- 집계: total=15,686, impacted=3,038, max impact=1760.66
- 대표 예시:
  - 2025-05-08T18:08:57 | NKTR | Nektar Therapeutics (NKTR) Q1 2025 Earnings Call Transcript | score=1760.66 | tag=sustained_repricing
  - 2025-05-08T17:19:02 | NKTR | Nektar: Q1 Earnings Snapshot | score=1760.66 | tag=sustained_repricing

### feature·투자아이디어 해설 (`generic_feature_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: deep dive, feature, is it a buy, storytelling 성격의 기사다.
- 핵심 가치 경로: 직접 이벤트보다 opinion/feature layer다.
- 포함 신호: is it a buy, worth buying, deep dive, feature
- 제외 신호: formal analyst action, earnings beat
- 빠른 판별 질문: 직접 사건보다 feature/opinion인가?
- 집계: total=15,549, impacted=3,167, max impact=1002.62
- 대표 예시:
  - 2025-01-29T07:55:45 | GSAT | Why Globalstar Stock Is Tumbling Wednesday | score=1002.62 | tag=sustained_repricing
  - 2025-08-22T14:06:41 | LCID | Why Lucid Group Stock Died Today -- Then Got Better | score=999.52 | tag=sustained_repricing

### peer 투자·경쟁 심화 read-through (`peer_competition_negative`)
- 상위 분류: `short`
- 한 줄 정의: rival launch, peer capex, substitute threat가 약세 이유인 기사다.
- 핵심 가치 경로: 경쟁 심화와 share loss 우려가 valuation 압박으로 이어진다.
- 포함 신호: rival, competitor, investment push, competitive pressure, new product from
- 제외 신호: same company launch, macro risk-off
- 빠른 판별 질문: 경쟁사 행동이 약세 이유의 중심인가?
- 집계: total=13,505, impacted=1,846, max impact=221.06
- 대표 예시:
  - 2026-01-06T06:47:31 | ALMS | Alumis Skin Drug Shows Clear Benefits In Late Trials, Stock Soars | score=221.06 | tag=multi_window_impact
  - 2025-08-13T03:12:58 | MLYS | Mineralys Therapeutics Inc (MLYS) Q2 2025 Earnings Call Highlights: Pivotal Trial Success and ... | score=168.02 | tag=sustained_repricing

### 실적 호조·가이던스 상향 (`earnings_beat_raise_positive`)
- 상위 분류: `long`
- 한 줄 정의: 실적 beat, 가이던스 상향, strong results가 핵심인 기사다.
- 핵심 가치 경로: 추정치 상향과 multiple rerating으로 이어진다.
- 포함 신호: beat estimates, raises guidance, better-than-expected, record revenue
- 제외 신호: earnings preview, earnings call transcript
- 빠른 판별 질문: 실제 결과 기사인가? / headline 중심이 beat/raise인가?
- 집계: total=11,894, impacted=2,396, max impact=1114.55
- 대표 예시:
  - 2025-04-11T06:28:47 | RGC | Fastenal Posts Better-Than-Expected Sales, Joins Simulations Plus, Certara And Other Big Stocks Moving Higher On Friday | score=1114.55 | tag=multi_window_impact
  - 2025-04-04T06:05:19 | RGC | Simulations Plus Posts Better-Than-Expected Results, Joins Savers Value Village, MarketAxess Holdings And Other Big Stocks Moving Higher On Friday | score=681.85 | tag=multi_window_impact

### M&A·전략자산 거래 (`mna_strategic_asset_positive`)
- 상위 분류: `long`
- 한 줄 정의: acquisition, merger, buyout, strategic investment가 핵심인 기사다.
- 핵심 가치 경로: 전략 자산 가치 재평가와 사업 재편 기대를 만든다.
- 포함 신호: acquisition, merger, buyout, strategic investment
- 제외 신호: distress sale, capital raise
- 빠른 판별 질문: 자산/회사 거래가 headline 핵심인가?
- 집계: total=11,849, impacted=1,711, max impact=486.06
- 대표 예시:
  - 2025-11-10T16:05:04 | GLTO | This Penny Stock Just Quadrupled. Should You Buy It Now? | score=486.06 | tag=multi_window_impact
  - 2025-11-10T07:42:26 | GLTO | Shares are trading higher after Galecto announced the completion of its acquisition of Damora Therapeutics. | score=486.06 | tag=multi_window_impact

### 소송·조사·회계 리스크 (`litigation_regulatory_negative`)
- 상위 분류: `short`
- 한 줄 정의: lawsuit, investigation, subpoena, fraud, restatement가 핵심인 기사다.
- 핵심 가치 경로: 비용 증가와 신뢰 훼손이 valuation discount로 이어진다.
- 포함 신호: lawsuit, investigation, subpoena, restatement
- 제외 신호: settlement removes risk, approval
- 빠른 판별 질문: 조사/소송이 핵심인가?
- 집계: total=7,647, impacted=1,759, max impact=795.85
- 대표 예시:
  - 2025-08-08T08:00:00 | LCID | Quantum BioPharma Announces Very Promising Results from the Massachusetts General Hospital Scientists on the Novel Positron Emission Tomography (PET) Tracer Used to Detect and Monitor Demyelination in Multiple Sclerosis Patients | score=795.85 | tag=sustained_repricing
  - 2025-11-03T09:15:00 | CAPR | Capricor Therapeutics Publishes Peer-Reviewed Study in Biomedicines Describing the Mechanism of Action and Potency Assay for its Investigational Cell Therapy, Deramiocel | score=290.17 | tag=sustained_repricing

### 밸류에이션 discount 해소 narrative (`valuation_narrative_positive`)
- 상위 분류: `long`
- 한 줄 정의: too cheap, catch-up, rerating potential이 핵심인 기사다.
- 핵심 가치 경로: 저평가 해소 기대가 multiple expansion으로 이어진다.
- 포함 신호: undervalued, discount, catch-up, rerating potential
- 제외 신호: generic best stock list, formal analyst upgrade
- 빠른 판별 질문: 핵심이 저평가 해소 narrative인가?
- 집계: total=5,448, impacted=738, max impact=228.22
- 대표 예시:
  - 2025-07-10T04:48:11 | OPEN | The RMR Group: Stock Is Undervalued But Needs To Grow Revenues Into 2026 | score=228.22 | tag=multi_window_impact
  - 2025-05-12T06:50:00 | CTMX | CytomX Therapeutics Announces Pricing of $100 Million Underwritten Offering of Common Stock | score=222.06 | tag=multi_window_impact

### 희석성 자금조달 (`financing_dilution_negative`)
- 상위 분류: `short`
- 한 줄 정의: public offering, private placement, warrants, convertibles가 핵심인 기사다.
- 핵심 가치 경로: 희석과 자본비용 상승 우려가 주가 하방으로 이어진다.
- 포함 신호: public offering, private placement, warrants, convertible notes
- 제외 신호: grant award, non-dilutive funding
- 빠른 판별 질문: 조달 자체가 headline 핵심인가?
- 집계: total=3,434, impacted=881, max impact=675.10
- 대표 예시:
  - 2025-06-05T12:30:19 | CRCL | Circle IPO shows stablecoin could be the 'new payment system' | score=675.10 | tag=multi_window_impact
  - 2025-06-25T23:00:13 | VOR | Vor Bio And RemeGen Sign Global License Agreement For Autoimmune Asset Telitacicept, Securing $125M Payment And $175M Private Placement | score=660.77 | tag=multi_window_impact

### top mover·헤드라인 증폭·하락 해설 (`media_amplification_negative`)
- 상위 분류: `short`
- 한 줄 정의: why stock is falling, tumbles, sell-off 같은 하락 해설 기사다.
- 핵심 가치 경로: 약세 headline cascade가 공포와 추가 매도를 증폭한다.
- 포함 신호: trading lower today, tumbles, sell-off, plunges
- 제외 신호: formal downgrade, public offering
- 빠른 판별 질문: 이미 내린 뒤 해설 기사인가? / headline cascade가 중심인가?
- 집계: total=3,328, impacted=884, max impact=1117.17
- 대표 예시:
  - 2025-09-02T13:33:52 | LCID | Why Lucid Group (LCID) Shares Are Sinking Today | score=1117.17 | tag=multi_window_impact
  - 2025-01-29T11:08:52 | GSAT | Globalstar shares are trading lower following Apple's latest iPhone update, which supports SpaceX's Starlink service. | score=1002.62 | tag=sustained_repricing

### 수요 급증·백로그 확대 (`demand_backlog_positive`)
- 상위 분류: `long`
- 한 줄 정의: strong demand, bookings, backlog growth가 핵심인 기사다.
- 핵심 가치 경로: 수요 가시성이 매출 성장 지속성 기대를 만든다.
- 포함 신호: strong demand, demand surge, backlog, bookings growth
- 제외 신호: macro demand commentary, general feature
- 빠른 판별 질문: 수요/백로그가 직접 언급되는가?
- 집계: total=3,131, impacted=516, max impact=118.90
- 대표 예시:
  - 2025-08-12T03:07:43 | BW | Babcock & Wilcox Enterprises Inc (BW) Q2 2025 Earnings Call Highlights: Strong Backlog ... | score=118.90 | tag=sustained_repricing
  - 2025-06-09T13:47:40 | CRCL | Circle Soars Post-IPO as Investor Demand Surges | score=106.73 | tag=sustained_repricing

### top mover·헤드라인 증폭·상승 해설 (`media_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: top mover, biggest gainer, shares jumped because 같은 상승 해설 기사다.
- 핵심 가치 경로: 해설/노출 증폭이 추가 관심과 추격 수급을 만든다.
- 포함 신호: top mover, biggest gainer, surging today, soaring today
- 제외 신호: formal upgrade, contract award
- 빠른 판별 질문: 이미 오른 뒤 해설 기사인가? / 노출 증폭이 핵심인가?
- 집계: total=2,937, impacted=1,138, max impact=648.56
- 대표 예시:
  - 2025-07-08T03:32:21 | PROK | Market-Moving News for July 8th | score=648.56 | tag=multi_window_impact
  - 2025-11-19T07:22:07 | WSHP | WeShop Holdings shares are trading higher amid volatility following the stock's recent Nasdaq debut. | score=557.89 | tag=multi_window_impact

### 자사주 매입·주주환원 (`shareholder_return_positive`)
- 상위 분류: `long`
- 한 줄 정의: share repurchase, buyback, dividend hike가 핵심인 기사다.
- 핵심 가치 경로: 주주환원 강화가 수급과 자본배분 신뢰를 개선한다.
- 포함 신호: share repurchase, buyback, increases dividend, returns capital
- 제외 신호: capital raise, reverse split
- 빠른 판별 질문: 주주환원 강화가 핵심인가?
- 집계: total=2,552, impacted=341, max impact=216.53
- 대표 예시:
  - 2025-06-06T13:16:51 | CRCL | Trump Media, Docusign, Circle post-IPO: Trending Tickers | score=216.53 | tag=multi_window_impact
  - 2025-08-13T08:29:42 | BITF | JonesResearch reiterates buy on Bitfarms with 57% upside | score=95.28 | tag=sustained_repricing

### 구조조정·생존성 악화 (`restructuring_distress_negative`)
- 상위 분류: `short`
- 한 줄 정의: bankruptcy, going concern, layoffs, strategic alternatives가 핵심인 기사다.
- 핵심 가치 경로: 생존성 우려와 사업 지속성 discount로 이어진다.
- 포함 신호: chapter 11, bankruptcy, going concern, layoffs
- 제외 신호: growth reorg, ordinary cost cuts
- 빠른 판별 질문: 성장보다 생존이 핵심인가?
- 집계: total=2,312, impacted=366, max impact=133.56
- 대표 예시:
  - 2025-08-20T04:05:04 | BW | Babcock & Wilcox: Getting On The Roller-Coaster | score=133.56 | tag=sustained_repricing
  - 2025-07-31T05:23:44 | SATS | EchoStar (ESTS) Touches New High as Bankruptcy Fears Subside | score=98.78 | tag=multi_window_impact

### 고객 채택·대형 고객 확보 (`customer_adoption_positive`)
- 상위 분류: `long`
- 한 줄 정의: major customer win, adoption, deployment 확대가 핵심인 기사다.
- 핵심 가치 경로: 고객 기반 확대가 매출과 credibility 상승으로 이어진다.
- 포함 신호: customer win, adoption, selected by, deployment
- 제외 신호: generic partnership, watchlist article
- 빠른 판별 질문: 고객 채택이 headline 중심인가?
- 집계: total=1,870, impacted=309, max impact=120.08
- 대표 예시:
  - 2025-07-30T08:00:00 | VSAT | Viasat Selected to Deliver Next-Generation Encryption for US Government Cloud Data Centers | score=120.08 | tag=multi_window_impact
  - 2025-08-21T08:00:00 | OKLO | Oklo Signs MOU with ABB and Commissions Monitoring Room to Advance Training for Aurora Powerhouse Deployment | score=114.29 | tag=sustained_repricing

### 멀티종목 movers·watchlist 기사 (`market_movers_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: 여러 종목을 묶어 top movers 또는 radar로 나열하는 기사다.
- 핵심 가치 경로: 개별 사건보다 스크리너/요약 기사에 가깝다.
- 포함 신호: other big stocks moving, investors' radars, most active stocks, top stocks
- 제외 신호: single-ticker explainer, direct event
- 빠른 판별 질문: 멀티종목 roundup인가?
- 집계: total=1,514, impacted=487, max impact=638.43
- 대표 예시:
  - 2025-05-06T06:02:52 | RGC | FARO Technologies, Celanese, Avient, Aramark And Other Big Stocks Moving Higher On Tuesday | score=638.43 | tag=multi_window_impact
  - 2025-10-07T17:35:11 | GLTO | POET Technologies, Oracle, Nuburu, Galecto And TMC The Metals Company: Why These 5 Stocks Are On Investors' Radars Today | score=383.02 | tag=multi_window_impact

### 숏커버·포지셔닝 언와인드·매수 유입 (`positioning_flow_positive`)
- 상위 분류: `long`
- 한 줄 정의: short squeeze, positioning unwind, fund buying이 핵심인 기사다.
- 핵심 가치 경로: 기계적 수급 유입이 가격 상승을 가속한다.
- 포함 신호: short squeeze, fund buying, position established, covering
- 제외 신호: buyback, customer adoption
- 빠른 판별 질문: 사업 사건보다 flow가 핵심인가?
- 집계: total=1,475, impacted=266, max impact=712.75
- 대표 예시:
  - 2025-06-04T16:05:00 | RAPT | RAPT Therapeutics to Participate in Upcoming Investor Conferences | score=712.75 | tag=sustained_repricing
  - 2025-05-12T07:00:00 | TNGX | Tango Therapeutics Reports First Quarter 2025 Financial Results and Provides Business Highlights | score=342.98 | tag=multi_window_impact

### 공급망 차질·원가 압박 read-through (`supply_chain_headwind_negative`)
- 상위 분류: `short`
- 한 줄 정의: tariff exposure, sourcing issues, component shortage, cost inflation이 핵심인 기사다.
- 핵심 가치 경로: 원가 상승과 생산 차질이 margin 압박으로 이어진다.
- 포함 신호: tariff exposure, rare earth, shortage, supply chain disruption, cost inflation
- 제외 신호: macro index move, direct lawsuit
- 빠른 판별 질문: 공급망/원가 압박이 중심인가?
- 집계: total=1,401, impacted=536, max impact=258.71
- 대표 예시:
  - 2025-09-29T15:00:00 | CRML | Critical Metals Corp Amends Agreement to Acquire a Controlling Interest in Tanbreez | score=258.71 | tag=sustained_repricing
  - 2025-10-06T08:47:06 | CRML | AMD soars on OpenAI deal, Tesla launch & Govt eyes Critical Metals | score=191.73 | tag=multi_window_impact

### 승인·임상 호재 (`regulatory_clinical_positive`)
- 상위 분류: `long`
- 한 줄 정의: FDA approval, positive topline, NDA/BLA acceptance가 핵심인 기사다.
- 핵심 가치 경로: 핵심 자산 성공 확률 상승과 상업화 기대를 만든다.
- 포함 신호: fda approval, positive topline, nda acceptance, pivotal data
- 제외 신호: clinical hold, failed endpoint
- 빠른 판별 질문: 성공/승인이 headline 중심인가?
- 집계: total=1,366, impacted=283, max impact=648.56
- 대표 예시:
  - 2025-07-08T07:00:00 | PROK | ProKidney Reports Statistically and Clinically Significant Topline Results for the Phase 2 REGEN-007 Trial Evaluating Rilparencel in Patients with Chronic Kidney Disease and Diabetes | score=648.56 | tag=multi_window_impact
  - 2025-07-08T03:11:35 | PROK | ProKidney shares are trading higher after the company reported statistically and clinically significant topline results from its Phase 2 REGEN-007 trial evaluating Rilparencel in patients with chronic kidney disease and diabetes. | score=648.56 | tag=multi_window_impact

### 밸류에이션 부담·multiple compression narrative (`valuation_narrative_negative`)
- 상위 분류: `short`
- 한 줄 정의: too expensive, stretched valuation, multiple compression 우려가 핵심인 기사다.
- 핵심 가치 경로: 밸류에이션 부담이 추격 매수 축소와 de-rating으로 이어진다.
- 포함 신호: too expensive, stretched valuation, multiple compression, overvalued
- 제외 신호: formal downgrade, earnings miss
- 빠른 판별 질문: 펀더멘털보다 valuation 부담이 중심인가?
- 집계: total=1,329, impacted=291, max impact=516.05
- 대표 예시:
  - 2025-06-05T06:58:01 | NNNN | Anbio Biotechnology: Risky Valuation Concerns As COVID-Related Sales Decline | score=516.05 | tag=sustained_repricing
  - 2025-01-14T00:24:23 | EXOD | Exodus Movement: Overvalued And Lacks A Moat | score=165.93 | tag=sustained_repricing

### IPO·상장 이벤트 (`ipo_listing_event`)
- 상위 분류: `residual`
- 한 줄 정의: IPO, debut, direct listing, goes public가 핵심인 기사다.
- 핵심 가치 경로: 시장접근/유동성 이벤트지만 방향성은 케이스별로 다르다.
- 포함 신호: goes public, ipo, direct listing, debut
- 제외 신호: trading halt, reverse split
- 빠른 판별 질문: 상장 자체가 headline 핵심인가?
- 집계: total=1,221, impacted=303, max impact=675.10
- 대표 예시:
  - 2025-06-05T16:15:09 | CRCL | Circle stock soars over 160% after IPO as stablecoin giant makes market debut | score=675.10 | tag=multi_window_impact
  - 2025-06-05T15:18:00 | CRCL | Crypto Firm Circle’s Shares Soar in Stock Market Debut | score=675.10 | tag=multi_window_impact

### 실적 발표 전 기대 기사 (`earnings_preview_watch`)
- 상위 분류: `residual`
- 한 줄 정의: 실적 발표 전 기대치나 watch 포인트를 설명하는 기사다.
- 핵심 가치 경로: 직접 이벤트보다 기대 형성 단계다.
- 포함 신호: ahead of earnings, to report q1 results, wall street expects
- 제외 신호: beat estimates, misses estimates
- 빠른 판별 질문: 실제 결과가 아니라 preview인가?
- 집계: total=1,145, impacted=247, max impact=183.81
- 대표 예시:
  - 2025-08-04T12:10:42 | OPEN | Opendoor Becomes Meme Stock Royalty Ahead Of Earnings, These ETFs Hold The Keys (CORRECTED) | score=183.81 | tag=sustained_repricing
  - 2025-07-15T14:16:37 | ALAB | Astera Labs (ALAB) Falls Ahead of Earnings | score=111.13 | tag=sustained_repricing

### 애널리스트 코멘트 증폭·긍정 (`analyst_note_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: formal upgrade는 아니지만 긍정 analyst note/mention이 가격 해설의 핵심인 기사다.
- 핵심 가치 경로: 단일 note 증폭이 short-term sentiment와 flow 유입을 만든다.
- 포함 신호: analyst says, citi says, bofa says, bullish note
- 제외 신호: formal upgrade, company contract award
- 빠른 판별 질문: rating action보다 note 증폭인가? / 긍정 논지인가?
- 집계: total=981, impacted=243, max impact=92.18
- 대표 예시:
  - 2025-03-21T05:10:53 | UAMY | This ACNB Analyst Begins Coverage On A Bullish Note; Here Are Top 4 Initiations For Friday | score=92.18 | tag=multi_window_impact
  - 2025-12-15T09:00:18 | NOW | ServiceNow Faces Potential Microsoft Challenge To Its AI Orchestration Lead In 2026, Analyst Says | score=85.28 | tag=multi_window_impact

### 실적 부진·가이던스 하향 (`earnings_miss_cut_negative`)
- 상위 분류: `short`
- 한 줄 정의: 실적 miss, weak outlook, guidance cut이 핵심인 기사다.
- 핵심 가치 경로: 추정치 하향과 밸류에이션 압축으로 이어진다.
- 포함 신호: misses estimates, cuts guidance, weak outlook, profit warning
- 제외 신호: preview, transcript
- 빠른 판별 질문: 실제 결과 기사인가? / miss/cut이 중심인가?
- 집계: total=706, impacted=164, max impact=1760.66
- 대표 예시:
  - 2025-05-08T18:25:05 | NKTR | Nektar Therapeutics (NKTR) Reports Q1 Loss, Lags Revenue Estimates | score=1760.66 | tag=sustained_repricing
  - 2025-04-30T08:15:06 | ADCT | AC Immune (ACIU) Reports Q1 Loss, Lags Revenue Estimates | score=147.18 | tag=sustained_repricing

### 정부·대형 계약 수주 (`government_contract_award_positive`)
- 상위 분류: `long`
- 한 줄 정의: prime contractor, definitive contract, government award가 핵심인 기사다.
- 핵심 가치 경로: 매출 가시성과 backlog 확대를 직접 시사한다.
- 포함 신호: contract award, wins contract, prime contractor, government contract
- 제외 신호: generic partnership, grant commentary
- 빠른 판별 질문: 실제 수주가 headline 핵심인가?
- 집계: total=584, impacted=157, max impact=1511.26
- 대표 예시:
  - 2025-02-10T06:21:02 | GSAT | Globalstar shares are trading higher after MDA Space signed a definitive contract with the company to be the prime contractor for the satellite operator's next generation low Earth orbit constellation. | score=1511.26 | tag=multi_window_impact
  - 2025-02-10T02:32:43 | GSAT | MDA Space Has Signed A Definitive Contract With Globalstar To Be The Prime Contractor For The Satellite Operator's Next-Generation Low Earth Orbit Constellation, With A Total Contract Value Of Approximately $1.1B | score=1511.26 | tag=multi_window_impact

### 정책·법안 역풍 read-through (`policy_regulatory_headwind_negative`)
- 상위 분류: `short`
- 한 줄 정의: 법안, 규제, 정책 변화가 사업모델에 역풍을 주는 기사다.
- 핵심 가치 경로: 규제 강화나 framework 변경이 수익경로 훼손 우려를 만든다.
- 포함 신호: ban, bill, act, regulatory framework, policy risk, lawmakers
- 제외 신호: fda rejection, lawsuit
- 빠른 판별 질문: 직접 회사 악재보다 정책 역풍이 핵심인가?
- 집계: total=520, impacted=104, max impact=64.58
- 대표 예시:
  - 2026-02-20T15:27:43 | CRCL | The SEC Just Opened the Door for Stablecoin Adoption | score=64.58 | tag=multi_window_impact
  - 2025-06-17T22:26:46 | COIN | Senate Passes GENIUS Act—Coinbase's Brian Armstrong Calls It 'Big Milestone,' Scott Bessent Says Passage Could Drive Stablecoins Into A $3.7 Trillion Market | score=58.13 | tag=sustained_repricing

### 규제·임상 악재 (`regulatory_clinical_negative`)
- 상위 분류: `short`
- 한 줄 정의: CRL, endpoint failure, hold, rejection이 핵심인 기사다.
- 핵심 가치 경로: 핵심 자산 가치 훼손과 일정 지연으로 이어진다.
- 포함 신호: complete response letter, clinical hold, failed to meet, fda rejection
- 제외 신호: positive topline, approval
- 빠른 판별 질문: 실패/보류가 중심인가?
- 집계: total=373, impacted=100, max impact=371.07
- 대표 예시:
  - 2025-12-03T06:10:54 | CAPR | Capricor soars on positive results for Duchenne cell therapy | score=371.07 | tag=multi_window_impact
  - 2025-10-21T12:27:53 | TERN | Terns Pharmaceuticals shares are trading lower after CEO Amy Burroughs said that the Phase 2 topline 12-week results for TERN-601 did not meet the threshold for a truly differentiated oral GLP-1RA therapy and will likely preclude further development. | score=202.90 | tag=sustained_repricing

### 거래정지·역분할·상장유지 스트레스 (`capital_structure_stress_negative`)
- 상위 분류: `short`
- 한 줄 정의: trading halt, reverse split, compliance pressure, authorized shares가 핵심인 기사다.
- 핵심 가치 경로: 시장구조 스트레스와 희석/상장유지 우려가 반영된다.
- 포함 신호: trading halt, reverse stock split, minimum bid, authorized shares
- 제외 신호: ipo debut, ordinary listing
- 빠른 판별 질문: 사업보다 자본구조/상장스트레스가 중심인가?
- 집계: total=354, impacted=173, max impact=3646.27
- 대표 예시:
  - 2025-06-06T15:50:05 | NKTR | Trading Halt: Halted at 7:50:00 p.m. ET - Trading Halt: Halt News Pending | score=3646.27 | tag=multi_window_impact
  - 2025-06-06T12:39:04 | NKTR | Nektar Therapeutics Files Amendments To Increase Authorized Common Stock From 300M To 390M Shares And Implement 1-For-15 Reverse Stock Split Effective June 8, 2025; Split-Adjusted Trading To Begin June 9, 2025 | score=3646.27 | tag=multi_window_impact

### 차익실현·디그로싱·매도 수급 (`positioning_flow_negative`)
- 상위 분류: `short`
- 한 줄 정의: profit-taking, de-grossing, fund selling이 핵심인 기사다.
- 핵심 가치 경로: 포지셔닝 축소가 단기 가격 하방을 만든다.
- 포함 신호: profit-taking, taking profits, de-grossing, fund selling
- 제외 신호: earnings miss, policy risk
- 빠른 판별 질문: 사업 악재보다 flow unwind가 중심인가?
- 집계: total=248, impacted=81, max impact=120.19
- 대표 예시:
  - 2025-08-21T10:44:22 | OPEN | Opendoor (OPEN) Ends “Meme Rally” on Profit-Taking, Shares Up 75% Month-to-Date | score=120.19 | tag=multi_window_impact
  - 2026-01-29T22:46:45 | AAOI | Applied Optoelectronics (AAOI) Falls 12.5% After 8-Year High | score=110.79 | tag=sustained_repricing

### 경영진 보강·거버넌스 개선 (`management_governance_positive`)
- 상위 분류: `long`
- 한 줄 정의: experienced CEO/CFO 영입, activist 합의, governance 개선이 핵심인 기사다.
- 핵심 가치 경로: 운영 신뢰 회복과 실행력 기대를 만든다.
- 포함 신호: appoints new ceo, appoints veteran, governance agreement, board refresh
- 제외 신호: executive departure, probe
- 빠른 판별 질문: 경영 보강이 긍정 이벤트인가?
- 집계: total=209, impacted=35, max impact=93.87
- 대표 예시:
  - 2025-04-07T08:00:00 | MBX | MBX Biosciences Appoints Veteran Pharmaceutical Executive Steve Hoerter to Board of Directors | score=93.87 | tag=sustained_repricing
  - 2025-11-26T16:05:00 | VERA | Vera Therapeutics Appoints Veteran Biotech Executive James R. Meyers to its Board of Directors | score=73.87 | tag=multi_window_impact

### 애널리스트 코멘트 증폭·부정 (`analyst_note_amplification_negative`)
- 상위 분류: `short`
- 한 줄 정의: formal downgrade는 아니지만 target skepticism이나 cautious note가 핵심인 기사다.
- 핵심 가치 경로: 보수적 note가 기대치와 단기 수급을 꺾는다.
- 포함 신호: analyst warns, cautious note, bearish note, skeptical analyst
- 제외 신호: formal downgrade, earnings miss
- 빠른 판별 질문: 정식 하향보다 note 증폭인가? / 부정 논지인가?
- 집계: total=117, impacted=22, max impact=182.82
- 대표 예시:
  - 2025-04-22T03:37:04 | CRWV | This American Water Works Analyst Begins Coverage On A Bearish Note; Here Are Top 5 Initiations For Tuesday | score=182.82 | tag=sustained_repricing
  - 2025-04-23T05:19:39 | OKLO | This PayPal Analyst Begins Coverage On A Bearish Note; Here Are Top 5 Initiations For Wednesday | score=126.99 | tag=sustained_repricing

### 정책·법안 수혜 read-through (`policy_regulatory_tailwind_positive`)
- 상위 분류: `long`
- 한 줄 정의: 법안, 정책, 규제 framework 변화가 사업모델에 우호적으로 작용하는 기사다.
- 핵심 가치 경로: 외부 정책 변화가 TAM 확대나 규제완화 기대를 만든다.
- 포함 신호: tailwind from, policy support, regulatory clarity, bill boosts
- 제외 신호: company contract, formal approval
- 빠른 판별 질문: 직접 공시가 아니라 정책 수혜 read-through인가?
- 집계: total=85, impacted=20, max impact=63.77
- 대표 예시:
  - 2026-01-08T08:00:00 | MLTX | MoonLake Immunotherapeutics Announces Positive Outcome from Type B Meeting with U.S. FDA and Announces Investor Day | score=63.77 | tag=multi_window_impact
  - 2025-06-18T12:36:42 | COIN | Circle Internet, Coinbase jump as Senate clears stablecoin bill | score=59.32 | tag=multi_window_impact

### peer 호조 read-through (`peer_readthrough_positive`)
- 상위 분류: `long`
- 한 줄 정의: peer strong earnings, peer momentum, sector leader strength가 동종 종목에 read-through되는 기사다.
- 핵심 가치 경로: peer 실적/수요 신호가 동종 밸류에이션 상승으로 번진다.
- 포함 신호: peer results, sector leader, read-through, peer strength
- 제외 신호: same company earnings, macro only
- 빠른 판별 질문: 타사 호조가 이 종목 논리의 핵심인가?
- 집계: total=42, impacted=7, max impact=57.41
- 대표 예시:
  - 2025-11-26T08:41:07 | VOR | Vor Bio assumed with a Neutral at Wedbush | score=57.41 | tag=sustained_repricing
  - 2025-07-10T08:10:00 | NBIS | Nebius Group 2024 Sustainability Report highlights importance of sustainability to long-term value creation in AI infrastructure | score=52.53 | tag=sustained_repricing

### 경영진 이탈·거버넌스 충격 (`management_governance_negative`)
- 상위 분류: `short`
- 한 줄 정의: CEO/CFO resignation, board dispute, governance breakdown이 핵심인 기사다.
- 핵심 가치 경로: 리더십 공백과 통제 약화 우려를 만든다.
- 포함 신호: ceo resigns, cfo resigns, board dispute, executive departs
- 제외 신호: planned succession, new ceo appointed
- 빠른 판별 질문: 경영 공백/혼란이 핵심인가?
- 집계: total=25, impacted=7, max impact=235.86
- 대표 예시:
  - 2025-08-15T10:37:00 | OPEN | Opendoor CEO Resigns. The Meme Stock Is Getting New Leadership. | score=235.86 | tag=sustained_repricing
  - 2025-08-18T17:25:16 | OPEN | Opendoor CEO Resigns After Investor Pressure; Stock Rallies | score=213.56 | tag=sustained_repricing

### 공급망 완화·원가 개선 read-through (`supply_chain_tailwind_positive`)
- 상위 분류: `long`
- 한 줄 정의: input cost easing, supply normalization, sourcing improvement가 핵심인 기사다.
- 핵심 가치 경로: 원가 하락과 생산 정상화가 margin upside로 이어진다.
- 포함 신호: supply chain easing, input costs fall, sourcing improves, cost relief
- 제외 신호: company contract, generic macro
- 빠른 판별 질문: 공급망 개선이 핵심 논리인가?
- 집계: total=3, impacted=0, max impact=11.51
- 대표 예시:
  - 2025-12-17T05:58:03 | KN | Knowles: Margin Recovery Is Real, But The Market Still Wants Proof | score=11.51 | tag=low_signal
  - 2025-06-11T07:53:00 | AEM | EQX's AISC Spike Signals Pressure, But H2 Offers Path to Cost Relief | score=5.95 | tag=low_signal

## 해석

- 핵심 검증 포인트는 `정책·법안`, `peer 경쟁`, `valuation`, `flow`, `media amplification`이 실제로 독립 case로 분리되면서 old residual bucket이 줄어드는지다.
- 남는 `generic_feature_commentary`와 `meaningless_others`는 다음 보정 단계의 residual 정제 후보군이다.