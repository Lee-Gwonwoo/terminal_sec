# Model 2 company_news taxonomy v4 (2025+)

## 분석 범위

- analysis_id: `36a99839-1570-4b08-a364-121c453d1b98`
- source_type: `company_news`
- source_name: `FINNHUB`
- 기간: `2025-01-01 ~ 2026-03-27`
- 전체 분류 row: 541,970
- impact 계산 가능 row: 480,549
- impact 판정 row: 96,115
- `잡것들` row: 218,383
- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.

## taxonomy v4 설계 포인트

- 100개 유형으로 확장. 기존 v3의 ~40개에서 대폭 증가.
- BENZINGA EPS/guidance 포맷 regex 패턴 추가로 실적 기사 포착률 대폭 향상.
- 섹터 movers, 갭 분석, 장전/장후, 일간 요약 등 반복 패턴 독립 유형화.
- 고영향 잡것들 500건 분석 기반으로 패턴 설계.

## bucket 기준

- `overall_impact_score = max(immediate, short, medium)`
- `immediate = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
- `short = max(abs(change_1d_pct), abs(change_3d_pct))`
- `medium = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`
- bucket별 `p80`을 impact threshold로 사용했다.

| bucket | p50 | p80 | p90 |
| --- | ---: | ---: | ---: |
| <$300M or Unknown | 17.95 | 37.49 | 45.60 |
| $100B~300B | 8.13 | 14.82 | 20.17 |
| $10B~100B | 9.33 | 17.66 | 24.48 |
| $1B~10B | 13.41 | 25.17 | 34.59 |
| $300B~ | 7.68 | 14.58 | 19.56 |
| $300M~1B | 16.77 | 30.26 | 41.59 |

## case 요약

| top_level | case | total | impacted | max impact |
| --- | --- | ---: | ---: | ---: |
| residual | 잡것들 | 218,383 | 35,545 | 1440.32 |
| long | 애널리스트 상향·커버리지 개시 | 31,432 | 5,215 | 976.58 |
| long | 실적 Beat·가이던스 상향 | 25,591 | 5,033 | 1114.55 |
| short | 애널리스트 하향·목표가 하향 | 23,674 | 3,452 | 1073.67 |
| long | 출시·상업화·확장 | 22,964 | 3,663 | 804.89 |
| long | 제휴·라이선스·협업 | 14,825 | 2,552 | 834.27 |
| residual | 투자 논점·알파 아이디어 | 12,830 | 2,054 | 1096.77 |
| residual | feature·투자아이디어 해설 | 12,755 | 2,297 | 742.74 |
| residual | 매크로·시장 코멘터리 | 12,673 | 2,314 | 971.43 |
| long | M&A·전략자산 거래 | 10,421 | 1,527 | 486.06 |
| residual | 실적 transcript·snapshot | 7,897 | 1,467 | 1760.66 |
| short | 소송·조사·회계 리스크 | 7,647 | 1,760 | 795.85 |
| short | peer 경쟁 심화 read-through | 7,462 | 1,168 | 1236.81 |
| short | 실적 Miss·가이던스 하향 | 7,283 | 1,274 | 1760.66 |
| long | 급등 해설·상승 이유 | 6,852 | 1,866 | 675.10 |
| residual | 실적 발표 전 기대 기사 | 6,438 | 1,103 | 1273.44 |
| short | 미디어 증폭·하락 해설 | 6,357 | 1,529 | 661.98 |
| residual | 주가 움직임 이유·해설 | 5,437 | 879 | 383.02 |
| residual | 가이던스·전망 업데이트 | 5,400 | 999 | 192.02 |
| long | 제품·기술 통합·AI 도입 | 4,593 | 888 | 168.68 |
| residual | 암호화폐·디지털자산 이벤트 | 4,517 | 1,388 | 675.10 |
| residual | 멀티종목 movers 기사 | 4,511 | 1,039 | 638.43 |
| residual | 실적 결과 보도(중립) | 4,412 | 966 | 1760.66 |
| long | 밸류에이션 discount 해소 | 4,074 | 527 | 222.06 |
| long | 수요 급증·백로그 확대 | 3,624 | 582 | 189.53 |
| short | 희석성 자금조달 | 3,490 | 885 | 675.10 |
| residual | 실적 vs 추정치 비교 | 3,322 | 575 | 112.34 |
| residual | 행사·인터뷰·홍보성 | 3,291 | 520 | 1109.86 |
| long | 미디어 증폭·상승 해설 | 3,262 | 1,256 | 648.56 |
| long | 대형 딜·인프라 투자 | 3,164 | 620 | 216.46 |
| residual | 수상·인증·랭킹 | 3,068 | 411 | 152.27 |
| residual | 실적 요약·평가 기사 | 2,402 | 389 | 165.99 |
| residual | 섹터별 장중 movers 기사 | 2,354 | 1,120 | 1049.76 |
| short | 구조조정·생존성 악화 | 2,179 | 347 | 98.78 |
| long | 임상 데이터·중간결과 업데이트 | 2,123 | 533 | 648.56 |
| long | 애널리스트 코멘트 증폭(긍정) | 1,993 | 444 | 162.50 |
| long | 자사주 매입·주주환원 | 1,925 | 271 | 216.53 |
| long | 매출 성장·마일스톤 달성 | 1,917 | 324 | 93.78 |
| residual | 인기종목·시장 잡담 | 1,890 | 411 | 183.81 |
| long | 애널리스트 투자의견 재확인(긍정) | 1,835 | 374 | 350.94 |
| long | 신재생에너지 마일스톤 | 1,797 | 410 | 176.54 |
| long | 고객 채택·대형 고객 확보 | 1,794 | 298 | 120.08 |
| residual | 관세·무역 분쟁 영향 | 1,749 | 394 | 216.53 |
| short | 급락 해설·하락 이유 | 1,591 | 449 | 1117.17 |
| residual | 바이오 파이프라인·학회 발표 | 1,500 | 268 | 547.41 |
| long | 숏커버·매수 유입 | 1,351 | 237 | 712.75 |
| short | 공급망 차질·원가 압박 | 1,290 | 501 | 780.14 |
| residual | 섹터 업데이트·코멘터리 | 1,278 | 267 | 350.94 |
| residual | 종목 비교·vs 기사 | 1,022 | 117 | 83.57 |
| residual | 기술적 분석·차트 시그널 | 852 | 180 | 292.64 |
| long | 승인·임상 호재 | 821 | 126 | 648.56 |
| residual | 애널리스트 컨센서스·다수의견 | 794 | 109 | 135.38 |
| residual | IPO·상장 이벤트 | 783 | 193 | 675.10 |
| residual | 공매도 비율·변동 | 782 | 108 | 145.89 |
| long | 경영진 보강·거버넌스 개선 | 779 | 140 | 350.94 |
| long | 의약품 지정·우선심사 | 729 | 148 | 160.28 |
| residual | 이례적 옵션 활동 | 718 | 191 | 147.22 |
| long | 배당 개시·특별배당 | 715 | 53 | 42.61 |
| long | 소송 합의·분쟁 해소 | 714 | 100 | 114.51 |
| short | 내부자 매도·우려 시그널 | 667 | 89 | 93.35 |
| residual | 리스트형 screener 노이즈 | 652 | 130 | 2267.06 |
| short | 밸류에이션 부담·과열 | 631 | 139 | 97.98 |
| short | 정책·법안 역풍 read-through | 582 | 125 | 64.58 |
| long | 정부·대형 계약 수주 | 554 | 145 | 1511.26 |
| long | 행동주의 투자자 이벤트 | 544 | 77 | 237.48 |
| long | 피인수·프리미엄 거래 | 502 | 81 | 66.90 |
| residual | 유가·에너지·원자재 영향 | 489 | 84 | 262.82 |
| residual | 실적 혼재·엇갈림 | 446 | 79 | 89.93 |
| residual | 실적 콜 요약 | 434 | 46 | 105.37 |
| residual | 지정학·전쟁·긴장 영향 | 434 | 40 | 55.15 |
| long | 여신 확대·부채 관리 | 412 | 61 | 346.63 |
| long | 원가 절감·마진 개선 | 372 | 71 | 78.65 |
| short | 거래정지·역분할·상장유지 스트레스 | 366 | 179 | 3646.27 |
| short | 규제·임상 악재 | 358 | 95 | 371.07 |
| long | 유통·판매 계약 | 346 | 77 | 111.40 |
| long | 내부자 매수·자신감 시그널 | 270 | 46 | 192.55 |
| long | 의약품 판매허가(비FDA) | 268 | 68 | 247.87 |
| residual | 기관 포트폴리오 변경(13F) | 266 | 33 | 113.74 |
| long | 광산·자원 업데이트 | 220 | 61 | 227.24 |
| short | 차익실현·매도 수급 | 216 | 72 | 120.19 |
| long | FDA 절차 진행·수리 | 214 | 46 | 107.33 |
| residual | 일간 지수·시장 요약 | 164 | 65 | 648.56 |
| long | 임상시험 개시·첫 투약 | 155 | 46 | 250.53 |
| residual | 특허·IP 이벤트 | 146 | 27 | 95.49 |
| short | 애널리스트 코멘트 증폭(부정) | 123 | 29 | 661.98 |
| long | 부채 관리·리파이낸싱 | 112 | 25 | 60.14 |
| residual | 서킷브레이커·일시정지 | 92 | 65 | 648.56 |
| residual | 프리마켓·애프터마켓 movers | 88 | 20 | 45.45 |
| short | 애널리스트 전망 하향 수정 | 82 | 15 | 1202.82 |
| long | 애널리스트 전망 상향 수정 | 81 | 19 | 106.57 |
| residual | 이벤트 일정·스케줄 공지 | 76 | 19 | 76.16 |
| residual | 갭 상승/하락 종목 | 68 | 24 | 66.54 |
| long | 정책·법안 수혜 read-through | 64 | 20 | 63.77 |
| residual | 사업부 매각·자산 처분 | 45 | 9 | 35.08 |
| long | peer 호조 read-through | 30 | 7 | 264.36 |
| short | 경영진 이탈·거버넌스 충격 | 28 | 7 | 235.86 |
| residual | 시장 영향 뉴스 다이제스트 | 24 | 15 | 156.35 |
| long | 기관 지분 공시·13D/13G | 22 | 3 | 29.40 |
| long | 공급망 완화·원가 개선 | 1 | 0 | 5.95 |

## 유형 정의

### 잡것들 (`meaningless_others`)
- 상위 분류: `residual`
- 한 줄 정의: 위 유형으로 분류하기 어려운 저정보 잔여 기사.
- 핵심 가치 경로: 직접 가치 경로 불명확
- 포함 신호: 
- 제외 신호: 
- 빠른 판별 질문: 반복 패턴이 약한가?
- 집계: total=218,383, impacted=35,545, max impact=1440.32
- 대표 예시:
  - 2025-05-09T14:29:10 | NKTR | Q1 2025 Nektar Therapeutics Earnings Call | score=1440.32 | tag=sustained_repricing
  - 2025-01-28T09:16:00 | GSAT | Globalstar Partner Global Telesat Communications Sees Massive 35% YoY Growth in SPOT and Satellite IoT Device Sales in 2024 | score=1236.81 | tag=sustained_repricing

### 애널리스트 상향·커버리지 개시 (`analyst_upgrade_positive`)
- 상위 분류: `long`
- 한 줄 정의: upgrade, coverage initiation, target raise 중심.
- 핵심 가치 경로: sell-side 상향→re-rating
- 포함 신호: initiates coverage, outperform, raises price target
- 제외 신호: target cut, downgraded
- 빠른 판별 질문: formal upgrade?
- 집계: total=31,432, impacted=5,215, max impact=976.58
- 대표 예시:
  - 2025-05-22T03:27:42 | RAPT | HC Wainwright & Co. Assumes RAPT Therapeutics at Buy, Announces Price Target of $6 | score=976.58 | tag=multi_window_impact
  - 2025-05-16T12:00:08 | RAPT | Rapt Therapeutics (RAPT) Upgraded to Buy: Here's What You Should Know | score=817.18 | tag=sustained_repricing

### 실적 Beat·가이던스 상향 (`earnings_beat_raise_positive`)
- 상위 분류: `long`
- 한 줄 정의: EPS/매출 beat 또는 가이던스 상향이 핵심 기사.
- 핵심 가치 경로: 추정치 상향→멀티플 re-rating
- 포함 신호: beat estimates, raises guidance, record revenue
- 제외 신호: preview, transcript
- 빠른 판별 질문: 실제 결과? / beat/raise 중심?
- 집계: total=25,591, impacted=5,033, max impact=1114.55
- 대표 예시:
  - 2025-04-11T06:28:47 | RGC | Fastenal Posts Better-Than-Expected Sales, Joins Simulations Plus, Certara And Other Big Stocks Moving Higher On Friday | score=1114.55 | tag=multi_window_impact
  - 2025-04-04T06:05:19 | RGC | Simulations Plus Posts Better-Than-Expected Results, Joins Savers Value Village, MarketAxess Holdings And Other Big Stocks Moving Higher On Friday | score=681.85 | tag=multi_window_impact

### 애널리스트 하향·목표가 하향 (`analyst_downgrade_negative`)
- 상위 분류: `short`
- 한 줄 정의: downgrade, underperform, target cut 중심.
- 핵심 가치 경로: sell-side 하향→de-rating
- 포함 신호: downgraded, underperform, target cut
- 제외 신호: raises price target
- 빠른 판별 질문: formal downgrade?
- 집계: total=23,674, impacted=3,452, max impact=1073.67
- 대표 예시:
  - 2025-08-29T18:49:00 | LCID | Why Lucid Stock Skidded to a More Than 4% Loss Today | score=1073.67 | tag=multi_window_impact
  - 2025-05-22T04:55:18 | RAPT | UBS Maintains Neutral on RAPT Therapeutics, Lowers Price Target to $1 | score=976.58 | tag=multi_window_impact

### 출시·상업화·확장 (`commercial_launch_expansion_positive`)
- 상위 분류: `long`
- 한 줄 정의: launch, rollout, expansion, commercialization.
- 핵심 가치 경로: 시장 확대→매출 성장
- 포함 신호: launches, expands, commercial launch, expansion
- 제외 신호: event promotion
- 빠른 판별 질문: 상업화/확장 이벤트?
- 집계: total=22,964, impacted=3,663, max impact=804.89
- 대표 예시:
  - 2025-08-15T13:28:44 | LCID | Lucid Group (LCID) Unveils Adventurous Lucid Gravity X SUV With Off-Road Ready Design | score=804.89 | tag=sustained_repricing
  - 2025-08-07T06:30:00 | LCID | Uber CEO Floats Major Robotaxi Expansion | score=787.41 | tag=sustained_repricing

### 제휴·라이선스·협업 (`partnership_license_positive`)
- 상위 분류: `long`
- 한 줄 정의: partnership, collaboration, licensing deal.
- 핵심 가치 경로: 외부 자원 결합→channel 확대
- 포함 신호: partnership, collaboration, license agreement
- 제외 신호: offering, lawsuit
- 빠른 판별 질문: 경제적 제휴?
- 집계: total=14,825, impacted=2,552, max impact=834.27
- 대표 예시:
  - 2025-08-11T04:32:00 | LCID | Lucid-led coalition seeks to boost critical minerals sourcing | score=834.27 | tag=sustained_repricing
  - 2025-08-12T23:24:38 | LCID | LCID Q2 Deep Dive: Robotaxi Partnership, Supply Chain Progress, and Tariff Pressures | score=780.14 | tag=sustained_repricing

### 투자 논점·알파 아이디어 (`investment_thesis_article`)
- 상위 분류: `residual`
- 한 줄 정의: should you buy, is it a buy, bull/bear case.
- 핵심 가치 경로: opinion/thesis→정보 전달
- 포함 신호: should you buy, is it a buy, worth buying, bull case, bear case, moonshot, better investment
- 제외 신호: 
- 빠른 판별 질문: 투자 논점 기사?
- 집계: total=12,830, impacted=2,054, max impact=1096.77
- 대표 예시:
  - 2025-01-17T07:00:19 | GSAT | How Is The Market Feeling About Globalstar? | score=1096.77 | tag=sustained_repricing
  - 2025-08-27T00:03:57 | LCID | Lucid (LCID): Buy, Sell, or Hold Post Q2 Earnings? | score=1042.65 | tag=multi_window_impact

### feature·투자아이디어 해설 (`generic_feature_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: deep dive, feature, opinion article.
- 핵심 가치 경로: opinion layer
- 포함 신호: is it a buy, deep dive, feature
- 제외 신호: formal analyst
- 빠른 판별 질문: feature/opinion?
- 집계: total=12,755, impacted=2,297, max impact=742.74
- 대표 예시:
  - 2025-08-14T11:08:26 | LCID | Why Lucid Stock Jumped 16.6% in July | score=742.74 | tag=sustained_repricing
  - 2025-10-08T02:14:26 | PRAX | Assessing Praxis Precision Medicines (PRAX) Valuation After Recent Share Price Momentum | score=254.40 | tag=sustained_repricing

### 매크로·시장 코멘터리 (`macro_market_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: 금리, Fed, 인플레이션, 지수 움직임 광범위 설명.
- 핵심 가치 경로: 외부 환경 read-through
- 포함 신호: stock market today, fed, inflation, recession, economic slowdown
- 제외 신호: single-company event
- 빠른 판별 질문: 멀티종목 매크로?
- 집계: total=12,673, impacted=2,314, max impact=971.43
- 대표 예시:
  - 2025-03-13T05:52:29 | RGC | Nasdaq Down Over 100 Points; US Producer Inflation Stalls In February | score=971.43 | tag=multi_window_impact
  - 2025-06-05T16:04:50 | CRCL | Stock market today: Dow, S&P 500, Nasdaq slide as Tesla dives 14% on Trump-Musk escalation | score=675.10 | tag=multi_window_impact

### M&A·전략자산 거래 (`mna_strategic_asset_positive`)
- 상위 분류: `long`
- 한 줄 정의: acquisition, merger, buyout, strategic investment.
- 핵심 가치 경로: 전략 자산 재평가→premium 기대
- 포함 신호: acquisition, merger, buyout, strategic investment
- 제외 신호: distress sale
- 빠른 판별 질문: 자산 거래 핵심?
- 집계: total=10,421, impacted=1,527, max impact=486.06
- 대표 예시:
  - 2025-11-10T16:05:04 | GLTO | This Penny Stock Just Quadrupled. Should You Buy It Now? | score=486.06 | tag=multi_window_impact
  - 2025-11-10T07:42:26 | GLTO | Shares are trading higher after Galecto announced the completion of its acquisition of Damora Therapeutics. | score=486.06 | tag=multi_window_impact

### 실적 transcript·snapshot (`earnings_transcript_snapshot`)
- 상위 분류: `residual`
- 한 줄 정의: earnings call transcript/snapshot 후행 정리.
- 핵심 가치 경로: 정리 기사
- 포함 신호: transcript, snapshot, highlights
- 제외 신호: 
- 빠른 판별 질문: 전사본/요약 정리?
- 집계: total=7,897, impacted=1,467, max impact=1760.66
- 대표 예시:
  - 2025-05-08T17:19:02 | NKTR | Nektar: Q1 Earnings Snapshot | score=1760.66 | tag=sustained_repricing
  - 2025-05-09T03:46:16 | NKTR | Nektar Therapeutics (NKTR) Q1 2025 Earnings Call Highlights: Advancements in Immunology and ... | score=1440.32 | tag=sustained_repricing

### 소송·조사·회계 리스크 (`litigation_regulatory_negative`)
- 상위 분류: `short`
- 한 줄 정의: lawsuit, investigation, subpoena, restatement.
- 핵심 가치 경로: 법률 비용·신뢰 훼손
- 포함 신호: lawsuit, investigation, subpoena, restatement
- 제외 신호: settlement removes risk
- 빠른 판별 질문: 소송/조사 핵심?
- 집계: total=7,647, impacted=1,760, max impact=795.85
- 대표 예시:
  - 2025-08-08T08:00:00 | LCID | Quantum BioPharma Announces Very Promising Results from the Massachusetts General Hospital Scientists on the Novel Positron Emission Tomography (PET) Tracer Used to Detect and Monitor Demyelination in Multiple Sclerosis Patients | score=795.85 | tag=sustained_repricing
  - 2025-11-03T09:15:00 | CAPR | Capricor Therapeutics Publishes Peer-Reviewed Study in Biomedicines Describing the Mechanism of Action and Potency Assay for its Investigational Cell Therapy, Deramiocel | score=290.17 | tag=sustained_repricing

### peer 경쟁 심화 read-through (`peer_competition_negative`)
- 상위 분류: `short`
- 한 줄 정의: rival launch, peer capex, competitive pressure.
- 핵심 가치 경로: 경쟁 심화→share loss 우려
- 포함 신호: rival, competitor, competitive pressure, takes market share
- 제외 신호: same company launch
- 빠른 판별 질문: 경쟁사 행동이 약세 이유?
- 집계: total=7,462, impacted=1,168, max impact=1236.81
- 대표 예시:
  - 2025-01-28T19:53:57 | GSAT | Apple Surprises Users With Starlink Beta, Teams Up With Elon Musk's SpaceX And T-Mobile To Bring Satellite Texting For iPhone Users In iOS 18.3 | score=1236.81 | tag=sustained_repricing
  - 2025-01-29T11:08:52 | GSAT | Globalstar shares are trading lower following Apple's latest iPhone update, which supports SpaceX's Starlink service. | score=1002.62 | tag=sustained_repricing

### 실적 Miss·가이던스 하향 (`earnings_miss_cut_negative`)
- 상위 분류: `short`
- 한 줄 정의: EPS/매출 miss 또는 가이던스 하향이 핵심 기사.
- 핵심 가치 경로: 추정치 하향→valuation 압축
- 포함 신호: misses estimates, cuts guidance, profit warning
- 제외 신호: preview, transcript
- 빠른 판별 질문: 실제 결과? / miss/cut 중심?
- 집계: total=7,283, impacted=1,274, max impact=1760.66
- 대표 예시:
  - 2025-05-08T18:25:05 | NKTR | Nektar Therapeutics (NKTR) Reports Q1 Loss, Lags Revenue Estimates | score=1760.66 | tag=sustained_repricing
  - 2025-05-08T12:36:21 | NKTR | Nektar Therapeutics Q1 EPS $(0.24) Misses $(0.16) Estimate, Sales $10.46M Miss $15.36M Estimate | score=1760.66 | tag=sustained_repricing

### 급등 해설·상승 이유 (`stock_surge_explanation_positive`)
- 상위 분류: `long`
- 한 줄 정의: 주가 급등 사유 해설 (rallies X%, surges X%).
- 핵심 가치 경로: 급등 해설→추가 관심
- 포함 신호: rallies over, surges, soars, jumps.*%, up.*%
- 제외 신호: 
- 빠른 판별 질문: 급등 사유 해설?
- 집계: total=6,852, impacted=1,866, max impact=675.10
- 대표 예시:
  - 2025-06-05T16:15:09 | CRCL | Circle stock soars over 160% after IPO as stablecoin giant makes market debut | score=675.10 | tag=multi_window_impact
  - 2025-06-05T14:22:09 | CRCL | Circle Internet Group Soars 235% on IPO Debut | score=675.10 | tag=multi_window_impact

### 실적 발표 전 기대 기사 (`earnings_preview_watch`)
- 상위 분류: `residual`
- 한 줄 정의: 발표 전 preview/expectations 안내 기사.
- 핵심 가치 경로: 기대 형성 단계
- 포함 신호: ahead of earnings, to report results, wall street expects
- 제외 신호: beat, miss
- 빠른 판별 질문: 발표 전 기사?
- 집계: total=6,438, impacted=1,103, max impact=1273.44
- 대표 예시:
  - 2025-05-07T08:09:50 | NKTR | Nektar Therapeutics's Earnings: A Preview | score=1273.44 | tag=sustained_repricing
  - 2025-11-06T16:30:00 | GLTO | Galecto Reports Third Quarter 2025 Operating and Financial Results | score=368.69 | tag=multi_window_impact

### 미디어 증폭·하락 해설 (`media_amplification_negative`)
- 상위 분류: `short`
- 한 줄 정의: shares lower, sell-off, tumbles.
- 핵심 가치 경로: 약세 cascade→공포 증폭
- 포함 신호: trading lower today, sell-off, tumbles, plunges
- 제외 신호: formal downgrade
- 빠른 판별 질문: 이미 내린 뒤 해설?
- 집계: total=6,357, impacted=1,529, max impact=661.98
- 대표 예시:
  - 2025-08-06T15:58:19 | LCID | Why Lucid Group Stock Is Plummeting Today | score=661.98 | tag=sustained_repricing
  - 2025-08-06T09:19:22 | LCID | Why Lucid Group (LCID) Stock Is Plummeting Today | score=661.98 | tag=sustained_repricing

### 주가 움직임 이유·해설 (`stock_why_moving_explanation`)
- 상위 분류: `residual`
- 한 줄 정의: what's going on with X stock, here's why.
- 핵심 가치 경로: 이유 해설→정보 전달
- 포함 신호: what's going on with, here's why, what's behind, what's driving
- 제외 신호: 
- 빠른 판별 질문: 주가 움직임 이유 해설?
- 집계: total=5,437, impacted=879, max impact=383.02
- 대표 예시:
  - 2025-10-07T09:05:49 | GLTO | What's Going On With Nano-Cap Galecto Stock On Tuesday? | score=383.02 | tag=multi_window_impact
  - 2025-08-13T13:12:00 | OPEN | Here's Why Everyone Is Talking About Opendoor Technologies Stock | score=284.41 | tag=multi_window_impact

### 가이던스·전망 업데이트 (`earnings_guidance_update`)
- 상위 분류: `residual`
- 한 줄 정의: forward guidance/outlook 수치가 핵심. Sees FY/Q 포맷.
- 핵심 가치 경로: 기대치 갱신→재평가
- 포함 신호: sees fy, sees q1 sales
- 제외 신호: 
- 빠른 판별 질문: forward guidance 중심?
- 집계: total=5,400, impacted=999, max impact=192.02
- 대표 예시:
  - 2025-08-11T05:05:08 | TLS | Telos Sees Q3 Sales $44.000M-$47.000M vs $39.212M Est | score=192.02 | tag=multi_window_impact
  - 2025-02-05T12:07:55 | APPS | Digital Turbine Raises FY2025 Sales Guidance from $475.00M-485.00M to $485.00M-490.00M vs $477.04M Est | score=147.58 | tag=multi_window_impact

### 제품·기술 통합·AI 도입 (`product_technology_integration`)
- 상위 분류: `long`
- 한 줄 정의: tech integration, AI adoption, platform integration.
- 핵심 가치 경로: 기술 역량 강화→경쟁력
- 포함 신호: integrates, adopts.*ai, ai agent, platform integration
- 제외 신호: 
- 빠른 판별 질문: 기술 통합 이벤트?
- 집계: total=4,593, impacted=888, max impact=168.68
- 대표 예시:
  - 2025-01-30T04:16:04 | BBAI | BigBear.ai Awarded Prime IDIQ Contract for U.S. Department of Navy's SeaPort Next Generation (NxG) | score=168.68 | tag=multi_window_impact
  - 2025-08-21T08:00:00 | RZLV | Rezolve Ai to Participate in Citi’s 2025 Global TMT Conference | score=136.96 | tag=sustained_repricing

### 암호화폐·디지털자산 이벤트 (`crypto_digital_asset_event`)
- 상위 분류: `residual`
- 한 줄 정의: crypto, stablecoin, blockchain events.
- 핵심 가치 경로: 디지털자산 이벤트→재평가
- 포함 신호: bitcoin, stablecoin, cryptocurrency, blockchain, crypto exchange
- 제외 신호: 
- 빠른 판별 질문: 암호화폐 이벤트?
- 집계: total=4,517, impacted=1,388, max impact=675.10
- 대표 예시:
  - 2025-06-05T18:00:00 | CRCL | How stablecoins could shape the future of digital money | score=675.10 | tag=multi_window_impact
  - 2025-06-05T09:07:07 | CRCL | May jobs report, Broadcom earnings, Circle IPO: 3 Things | score=675.10 | tag=multi_window_impact

### 멀티종목 movers 기사 (`market_movers_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: 여러 종목 top movers 나열.
- 핵심 가치 경로: 스크리너/요약
- 포함 신호: other big stocks moving, most active stocks, top stocks
- 제외 신호: single-ticker
- 빠른 판별 질문: 멀티종목 roundup?
- 집계: total=4,511, impacted=1,039, max impact=638.43
- 대표 예시:
  - 2025-05-06T06:02:52 | RGC | FARO Technologies, Celanese, Avient, Aramark And Other Big Stocks Moving Higher On Tuesday | score=638.43 | tag=multi_window_impact
  - 2025-10-07T17:35:11 | GLTO | POET Technologies, Oracle, Nuburu, Galecto And TMC The Metals Company: Why These 5 Stocks Are On Investors' Radars Today | score=383.02 | tag=multi_window_impact

### 실적 결과 보도(중립) (`earnings_revenue_report_neutral`)
- 상위 분류: `residual`
- 한 줄 정의: beat/miss 프레이밍 없이 결과 보도.
- 핵심 가치 경로: 사실 보도
- 포함 신호: reports q4, reports financial results
- 제외 신호: beat, miss
- 빠른 판별 질문: 중립 보도?
- 집계: total=4,412, impacted=966, max impact=1760.66
- 대표 예시:
  - 2025-05-08T16:15:00 | NKTR | Nektar Therapeutics Reports First Quarter 2025 Financial Results | score=1760.66 | tag=sustained_repricing
  - 2026-01-15T04:35:17 | IBRX | ImmunityBio Reports Q4 Preliminary Net Product Revenue Of ~#38.3M, | score=182.78 | tag=multi_window_impact

### 밸류에이션 discount 해소 (`valuation_narrative_positive`)
- 상위 분류: `long`
- 한 줄 정의: undervalued, discount, rerating potential.
- 핵심 가치 경로: 저평가 해소→multiple expansion
- 포함 신호: undervalued, discount, catch-up, rerating
- 제외 신호: best stock list
- 빠른 판별 질문: 저평가 해소 논리?
- 집계: total=4,074, impacted=527, max impact=222.06
- 대표 예시:
  - 2025-05-12T06:50:00 | CTMX | CytomX Therapeutics Announces Pricing of $100 Million Underwritten Offering of Common Stock | score=222.06 | tag=multi_window_impact
  - 2026-01-06T15:38:40 | SNDK | 3 semiconductor stocks to play the AI supercycle, according to analysts | score=118.17 | tag=multi_window_impact

### 수요 급증·백로그 확대 (`demand_backlog_positive`)
- 상위 분류: `long`
- 한 줄 정의: strong demand, bookings, backlog growth.
- 핵심 가치 경로: 수요 가시성→매출 지속성
- 포함 신호: strong demand, backlog, bookings growth
- 제외 신호: macro commentary
- 빠른 판별 질문: 수요/백로그 직접 언급?
- 집계: total=3,624, impacted=582, max impact=189.53
- 대표 예시:
  - 2025-12-31T09:10:00 | SNDK | Micron Technology's NAND Revenues Reach $2.7B: Is It a Growth Lever? | score=189.53 | tag=multi_window_impact
  - 2026-01-15T08:43:56 | IBRX | ImmunityBio Clocks 700% Revenue Surge In 2025 From Lead Bladder Cancer Drug | score=182.78 | tag=multi_window_impact

### 희석성 자금조달 (`financing_dilution_negative`)
- 상위 분류: `short`
- 한 줄 정의: public offering, private placement, warrants.
- 핵심 가치 경로: 희석→주가 하방
- 포함 신호: public offering, private placement, warrants, convertible notes
- 제외 신호: non-dilutive
- 빠른 판별 질문: 희석 조달?
- 집계: total=3,490, impacted=885, max impact=675.10
- 대표 예시:
  - 2025-06-05T12:30:19 | CRCL | Circle IPO shows stablecoin could be the 'new payment system' | score=675.10 | tag=multi_window_impact
  - 2025-06-25T23:00:13 | VOR | Vor Bio And RemeGen Sign Global License Agreement For Autoimmune Asset Telitacicept, Securing $125M Payment And $175M Private Placement | score=660.77 | tag=multi_window_impact

### 실적 vs 추정치 비교 (`earnings_estimate_comparison`)
- 상위 분류: `residual`
- 한 줄 정의: key metrics vs estimates 비교 기사.
- 핵심 가치 경로: 추정치 대비 비교
- 포함 신호: compared to estimates, key metrics
- 제외 신호: 
- 빠른 판별 질문: 추정치 비교 기사?
- 집계: total=3,322, impacted=575, max impact=112.34
- 대표 예시:
  - 2025-08-07T09:30:08 | AVAH | Aveanna (AVAH) Reports Q2 Earnings: What Key Metrics Have to Say | score=112.34 | tag=multi_window_impact
  - 2025-08-01T10:30:01 | SATS | Compared to Estimates, EchoStar (SATS) Q2 Earnings: A Look at Key Metrics | score=96.10 | tag=multi_window_impact

### 행사·인터뷰·홍보성 (`promotional_appearance_noise`)
- 상위 분류: `residual`
- 한 줄 정의: conference participation, podcast, fireside chat.
- 핵심 가치 경로: IR 노출
- 포함 신호: participate in, investor conference, fireside chat
- 제외 신호: 
- 빠른 판별 질문: 홍보 노출?
- 집계: total=3,291, impacted=520, max impact=1109.86
- 대표 예시:
  - 2025-05-13T17:00:00 | NKTR | Nektar Therapeutics to Participate in the H.C. Wainwright 3rd Annual BioConnect Investor Conference | score=1109.86 | tag=sustained_repricing
  - 2025-08-05T08:00:00 | LCID | Lucid Diagnostics to Participate in Upcoming Investor Conferences | score=663.90 | tag=sustained_repricing

### 미디어 증폭·상승 해설 (`media_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: top mover, shares higher, soaring today.
- 핵심 가치 경로: 노출 증폭→추격 수급
- 포함 신호: soaring today, trading higher today, top mover, biggest gainer
- 제외 신호: formal upgrade
- 빠른 판별 질문: 이미 오른 뒤 해설?
- 집계: total=3,262, impacted=1,256, max impact=648.56
- 대표 예시:
  - 2025-07-08T03:32:21 | PROK | Market-Moving News for July 8th | score=648.56 | tag=multi_window_impact
  - 2025-11-19T07:22:07 | WSHP | WeShop Holdings shares are trading higher amid volatility following the stock's recent Nasdaq debut. | score=557.89 | tag=multi_window_impact

### 대형 딜·인프라 투자 (`corporate_deal_billion_positive`)
- 상위 분류: `long`
- 한 줄 정의: multi-billion dollar deals, infrastructure.
- 핵심 가치 경로: 대형 매출·투자→가치 재평가
- 포함 신호: billion deal, multiyear deal, data center, infrastructure
- 제외 신호: 
- 빠른 판별 질문: 대형 계약/투자?
- 집계: total=3,164, impacted=620, max impact=216.46
- 대표 예시:
  - 2026-01-06T17:30:58 | VTYX | Ventyx Biosciences Launches On Rumored $1 Billion Eli Lilly Takeover | score=216.46 | tag=multi_window_impact
  - 2026-01-06T15:40:00 | VTYX | Eli Lilly Nears Deal for Biotech Ventyx | score=216.46 | tag=multi_window_impact

### 수상·인증·랭킹 (`company_award_recognition`)
- 상위 분류: `residual`
- 한 줄 정의: award, ranked, named one of.
- 핵심 가치 경로: 인지도 이벤트
- 포함 신호: named one of, award, ranked, top performing
- 제외 신호: 
- 빠른 판별 질문: 수상/랭킹?
- 집계: total=3,068, impacted=411, max impact=152.27
- 대표 예시:
  - 2025-11-25T07:00:00 | CLYM | Climb Bio Reports Inducement Grant Under Nasdaq Listing Rule 5635(c)(4) | score=152.27 | tag=sustained_repricing
  - 2026-02-17T17:13:49 | CRCL | Stripe-Owned Bridge Gains National Bank Trust Charter to Boost Stablecoin Offerings | score=113.74 | tag=sustained_repricing

### 실적 요약·평가 기사 (`earnings_summary_assessment`)
- 상위 분류: `residual`
- 한 줄 정의: earnings breakdown/assessment/insights 정리 기사.
- 핵심 가치 경로: 해설 정리
- 포함 신호: earnings breakdown, earnings assessment, earnings insights
- 제외 신호: 
- 빠른 판별 질문: 실적 정리?
- 집계: total=2,402, impacted=389, max impact=165.99
- 대표 예시:
  - 2025-08-08T10:05:09 | TLS | A Peek at Telos's Future Earnings | score=165.99 | tag=multi_window_impact
  - 2025-02-05T12:39:17 | APPS | Digital Turbine Earnings Report: Q3 Overview | score=147.58 | tag=multi_window_impact

### 섹터별 장중 movers 기사 (`sector_movers_session_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: 12 Health Care Stocks Moving In 형태.
- 핵심 가치 경로: 섹터 movers 목록
- 포함 신호: stocks moving in.*session, stocks moving in.*pre-market, stocks moving in.*intraday
- 제외 신호: 
- 빠른 판별 질문: 섹터 movers 리스트?
- 집계: total=2,354, impacted=1,120, max impact=1049.76
- 대표 예시:
  - 2025-06-13T13:05:57 | VOR | 12 Health Care Stocks Moving In Friday's After-Market Session | score=1049.76 | tag=sustained_repricing
  - 2025-05-23T09:06:46 | RAPT | 12 Health Care Stocks Moving In Friday's Intraday Session | score=1034.03 | tag=multi_window_impact

### 구조조정·생존성 악화 (`restructuring_distress_negative`)
- 상위 분류: `short`
- 한 줄 정의: bankruptcy, going concern, layoffs.
- 핵심 가치 경로: 생존 우려→할인
- 포함 신호: chapter 11, bankruptcy, going concern, layoffs
- 제외 신호: growth reorg
- 빠른 판별 질문: 생존 모드?
- 집계: total=2,179, impacted=347, max impact=98.78
- 대표 예시:
  - 2025-07-31T05:23:44 | SATS | EchoStar (ESTS) Touches New High as Bankruptcy Fears Subside | score=98.78 | tag=multi_window_impact
  - 2025-09-11T08:08:29 | FCEL | Why FuelCell Energy (FCEL) Is Up 41.8% After Quarterly Revenue Nearly Doubles on Global Deals | score=78.42 | tag=sustained_repricing

### 임상 데이터·중간결과 업데이트 (`clinical_trial_data_update`)
- 상위 분류: `long`
- 한 줄 정의: interim data, response rate, trial results 보고.
- 핵심 가치 경로: 데이터 기반 자산 재평가
- 포함 신호: interim data, response rate, trial data, efficacy
- 제외 신호: 
- 빠른 판별 질문: 임상 데이터 중심?
- 집계: total=2,123, impacted=533, max impact=648.56
- 대표 예시:
  - 2025-07-08T07:00:00 | PROK | ProKidney Reports Statistically and Clinically Significant Topline Results for the Phase 2 REGEN-007 Trial Evaluating Rilparencel in Patients with Chronic Kidney Disease and Diabetes | score=648.56 | tag=multi_window_impact
  - 2025-07-08T03:11:35 | PROK | ProKidney shares are trading higher after the company reported statistically and clinically significant topline results from its Phase 2 REGEN-007 trial evaluating Rilparencel in patients with chronic kidney disease and diabetes. | score=648.56 | tag=multi_window_impact

### 애널리스트 코멘트 증폭(긍정) (`analyst_note_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: formal upgrade 아닌 bullish note 증폭.
- 핵심 가치 경로: note 증폭→sentiment 유입
- 포함 신호: analyst says, bullish note, benefiting from
- 제외 신호: formal upgrade
- 빠른 판별 질문: note 증폭(긍정)?
- 집계: total=1,993, impacted=444, max impact=162.50
- 대표 예시:
  - 2025-09-09T08:00:00 | PLUG | Plug to Participate in HC Wainwright Conference | score=162.50 | tag=sustained_repricing
  - 2025-08-15T04:20:06 | PGEN | Precigen shares are trading higher after the company announced the FDA has approved PAPZIMEOS. HC Wainwright & Co. raised its price target on the stock from 6 to $8.5. | score=143.78 | tag=multi_window_impact

### 자사주 매입·주주환원 (`shareholder_return_positive`)
- 상위 분류: `long`
- 한 줄 정의: share repurchase, buyback, dividend hike.
- 핵심 가치 경로: 주주환원→수급 개선
- 포함 신호: share repurchase, buyback, increases dividend
- 제외 신호: capital raise
- 빠른 판별 질문: 주주환원 핵심?
- 집계: total=1,925, impacted=271, max impact=216.53
- 대표 예시:
  - 2025-06-06T13:16:51 | CRCL | Trump Media, Docusign, Circle post-IPO: Trending Tickers | score=216.53 | tag=multi_window_impact
  - 2025-08-27T02:32:30 | BW | Babcock & Wilcox Authorizes Buyback of Remaining 2026 Senior Notes Through Market and Private Deals | score=85.96 | tag=multi_window_impact

### 매출 성장·마일스톤 달성 (`revenue_growth_milestone`)
- 상위 분류: `long`
- 한 줄 정의: record revenue, revenue growth milestone.
- 핵심 가치 경로: 성장 증거→re-rating
- 포함 신호: record revenue, revenue growth, record sales, revenue milestone
- 제외 신호: 
- 빠른 판별 질문: 매출 기록/마일스톤?
- 집계: total=1,917, impacted=324, max impact=93.78
- 대표 예시:
  - 2025-06-20T09:33:40 | IREN | Roth MKM Remains Bullish on IREN Limited (IREN) | score=93.78 | tag=multi_window_impact
  - 2025-08-12T16:05:00 | WBTN | WEBTOON Entertainment Inc. Reports Second Quarter 2025 Financial Results | score=85.56 | tag=multi_window_impact

### 인기종목·시장 잡담 (`trending_stocks_chatter`)
- 상위 분류: `residual`
- 한 줄 정의: trending tickers, market chatter.
- 핵심 가치 경로: 트렌딩 소개
- 포함 신호: trending tickers, market chatter, stocks to watch
- 제외 신호: 
- 빠른 판별 질문: 인기종목 소개?
- 집계: total=1,890, impacted=411, max impact=183.81
- 대표 예시:
  - 2025-08-04T08:22:31 | OPEN | BYD, Opendoor and Figma: Trending Tickers | score=183.81 | tag=sustained_repricing
  - 2025-07-10T17:12:50 | MP | Stocks to Watch Recap: Delta, Kellogg, Nvidia, TSMC | score=142.06 | tag=multi_window_impact

### 애널리스트 투자의견 재확인(긍정) (`analyst_reiteration_positive`)
- 상위 분류: `long`
- 한 줄 정의: Reiterates Buy/Outperform, maintains target.
- 핵심 가치 경로: 기존 긍정뷰 유지 확인
- 포함 신호: reiterates buy, maintains buy, maintains price target
- 제외 신호: downgraded
- 빠른 판별 질문: 재확인(reiteration)?
- 집계: total=1,835, impacted=374, max impact=350.94
- 대표 예시:
  - 2025-06-26T05:42:14 | VOR | Wedbush Reiterates Neutral on Vor Biopharma, Maintains $0.4 Price Target | score=350.94 | tag=multi_window_impact
  - 2025-09-24T07:01:23 | QURE | HC Wainwright & Co. Reiterates Buy on uniQure, Maintains $70 Price Target | score=346.63 | tag=multi_window_impact

### 신재생에너지 마일스톤 (`renewable_energy_milestone`)
- 상위 분류: `long`
- 한 줄 정의: solar project, renewable energy milestone.
- 핵심 가치 경로: 에너지전환 투자→성장
- 포함 신호: solar, renewable energy, clean energy, wind farm
- 제외 신호: 
- 빠른 판별 질문: 신재생에너지 이벤트?
- 집계: total=1,797, impacted=410, max impact=176.54
- 대표 예시:
  - 2025-09-18T11:43:00 | ABAT | American Battery Technology Company Announces Fiscal 2025 Fourth Quarter and Full Year Financial Results, Again Nearly Triples Quarterly Revenue | score=176.54 | tag=multi_window_impact
  - 2025-11-21T02:08:22 | TE | T1 Energy Says CEO Dan Barcelo Discusses US Energy Dominance With Vice President JD Vance; Company Highlights The 2.1 GW G2_Austin Solar Cell Fab That Will Start This Year, A $400–$425M Project Targeting First Output In Q4 2026 | score=159.19 | tag=multi_window_impact

### 고객 채택·대형 고객 확보 (`customer_adoption_positive`)
- 상위 분류: `long`
- 한 줄 정의: major customer win, adoption, deployment.
- 핵심 가치 경로: 고객 기반 확대→매출·credibility
- 포함 신호: customer win, adoption, selected by, deployment
- 제외 신호: generic partnership
- 빠른 판별 질문: 고객 채택 중심?
- 집계: total=1,794, impacted=298, max impact=120.08
- 대표 예시:
  - 2025-07-30T08:00:00 | VSAT | Viasat Selected to Deliver Next-Generation Encryption for US Government Cloud Data Centers | score=120.08 | tag=multi_window_impact
  - 2025-08-21T08:00:00 | OKLO | Oklo Signs MOU with ABB and Commissions Monitoring Room to Advance Training for Aurora Powerhouse Deployment | score=114.29 | tag=sustained_repricing

### 관세·무역 분쟁 영향 (`tariff_trade_impact`)
- 상위 분류: `residual`
- 한 줄 정의: tariff 부과/해제, trade war, 관세 관련 영향.
- 핵심 가치 경로: 관세 변화→margin/수요 영향
- 포함 신호: tariff, trade war, strikes down.*tariff, customs
- 제외 신호: 
- 빠른 판별 질문: 관세/무역 충격?
- 집계: total=1,749, impacted=394, max impact=216.53
- 대표 예시:
  - 2025-06-06T07:27:55 | CRCL | Trending tickers: Tesla, Lululemon, Circle, Broadcom | score=216.53 | tag=multi_window_impact
  - 2025-08-07T13:35:37 | WULF | High Insider Ownership Growth Stocks To Watch In August 2025 | score=100.00 | tag=sustained_repricing

### 급락 해설·하락 이유 (`stock_crash_explanation_negative`)
- 상위 분류: `short`
- 한 줄 정의: 주가 급락 사유 해설 (nosedives, crashes X%).
- 핵심 가치 경로: 급락 해설→공포 증폭
- 포함 신호: nosedives, crashes, stock falls.*%, tanks, tumbles.*%
- 제외 신호: 
- 빠른 판별 질문: 급락 사유 해설?
- 집계: total=1,591, impacted=449, max impact=1117.17
- 대표 예시:
  - 2025-09-02T13:33:52 | LCID | Why Lucid Group (LCID) Shares Are Sinking Today | score=1117.17 | tag=multi_window_impact
  - 2025-08-08T08:38:46 | OPEN | Why Opendoor Technologies Stock Crashed This Week | score=216.76 | tag=multi_window_impact

### 바이오 파이프라인·학회 발표 (`biotech_pipeline_presentation`)
- 상위 분류: `residual`
- 한 줄 정의: data presentation at medical conference.
- 핵심 가치 경로: 학회 발표→관심
- 포함 신호: present.*data at, present at.*meeting, upcoming presentation, poster presentation
- 제외 신호: 
- 빠른 판별 질문: 학회 발표 예정?
- 집계: total=1,500, impacted=268, max impact=547.41
- 대표 예시:
  - 2025-11-25T18:18:15 | CAPR | Can Capricor Therapeutics' (CAPR) Exosome Advancement Shift the Conversation on Its Innovation Pipeline? | score=547.41 | tag=multi_window_impact
  - 2025-10-31T09:15:00 | CAPR | Capricor Therapeutics to Present Third Quarter 2025 Financial Results and Recent Corporate Update on November 10 | score=382.45 | tag=sustained_repricing

### 숏커버·매수 유입 (`positioning_flow_positive`)
- 상위 분류: `long`
- 한 줄 정의: short squeeze, fund buying, covering.
- 핵심 가치 경로: 수급 유입→가격 가속
- 포함 신호: short squeeze, fund buying, covering, takes stake
- 제외 신호: buyback
- 빠른 판별 질문: flow 유입 핵심?
- 집계: total=1,351, impacted=237, max impact=712.75
- 대표 예시:
  - 2025-06-04T16:05:00 | RAPT | RAPT Therapeutics to Participate in Upcoming Investor Conferences | score=712.75 | tag=sustained_repricing
  - 2025-05-12T07:00:00 | TNGX | Tango Therapeutics Reports First Quarter 2025 Financial Results and Provides Business Highlights | score=342.98 | tag=multi_window_impact

### 공급망 차질·원가 압박 (`supply_chain_headwind_negative`)
- 상위 분류: `short`
- 한 줄 정의: tariff exposure, shortage, cost inflation.
- 핵심 가치 경로: 원가 상승→margin 압박
- 포함 신호: tariff exposure, shortage, supply chain disruption, cost inflation
- 제외 신호: macro index move
- 빠른 판별 질문: 공급망 압박?
- 집계: total=1,290, impacted=501, max impact=780.14
- 대표 예시:
  - 2025-08-12T23:40:56 | LCID | The 5 Most Interesting Analyst Questions From Lucid’s Q2 Earnings Call | score=780.14 | tag=sustained_repricing
  - 2025-09-29T15:00:00 | CRML | Critical Metals Corp Amends Agreement to Acquire a Controlling Interest in Tanbreez | score=258.71 | tag=sustained_repricing

### 섹터 업데이트·코멘터리 (`sector_update_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: Sector Update: Health Care/Financial Stocks.
- 핵심 가치 경로: 섹터 업데이트
- 포함 신호: sector update, financial stocks, health care stocks
- 제외 신호: 
- 빠른 판별 질문: 섹터 업데이트?
- 집계: total=1,278, impacted=267, max impact=350.94
- 대표 예시:
  - 2025-06-26T15:55:52 | VOR | Sector Update: Health Care Stocks Edge Higher Late Afternoon | score=350.94 | tag=multi_window_impact
  - 2025-09-24T16:05:06 | QURE | Sector Update: Health Care Stocks Decline Late Afternoon | score=346.63 | tag=multi_window_impact

### 종목 비교·vs 기사 (`stock_comparison_article`)
- 상위 분류: `residual`
- 한 줄 정의: A vs B: which stock is better.
- 핵심 가치 경로: 비교 분석
- 포함 신호: which stock is, better value option, vs.*which is
- 제외 신호: 
- 빠른 판별 질문: 종목 비교 기사?
- 집계: total=1,022, impacted=117, max impact=83.57
- 대표 예시:
  - 2025-12-18T11:40:04 | NOW | LDOS or NOW: Which Is the Better Value Stock Right Now? | score=83.57 | tag=multi_window_impact
  - 2026-01-29T11:40:02 | ODD | ODD or ADYEY: Which Is the Better Value Stock Right Now? | score=63.10 | tag=sustained_repricing

### 기술적 분석·차트 시그널 (`technical_analysis_signal`)
- 상위 분류: `residual`
- 한 줄 정의: golden cross, moving average, technical pattern.
- 핵심 가치 경로: 기술적 신호→트레이더 관심
- 포함 신호: golden cross, 200-day, moving average, trend barrier, tests key
- 제외 신호: 
- 빠른 판별 질문: 기술적 분석?
- 집계: total=852, impacted=180, max impact=292.64
- 대표 예시:
  - 2025-08-12T12:12:29 | OPEN | Opendoor's First Profit Since 2022 Fails To Calm Investor Criticism Of CEO | score=292.64 | tag=multi_window_impact
  - 2025-01-13T01:33:33 | NUTX | Nutex Health Opens Starkey Ranch ER & Hospital in Florida, Offering 24/7 Concierge-Level Care | score=118.13 | tag=sustained_repricing

### 승인·임상 호재 (`regulatory_clinical_positive`)
- 상위 분류: `long`
- 한 줄 정의: FDA approval, positive topline, NDA acceptance.
- 핵심 가치 경로: 자산 성공 확률 상승→상업화 기대
- 포함 신호: fda approval, positive topline, nda acceptance
- 제외 신호: clinical hold, failed
- 빠른 판별 질문: 성공/승인 중심?
- 집계: total=821, impacted=126, max impact=648.56
- 대표 예시:
  - 2025-07-08T05:05:47 | PROK | Why Is Penny Stock ProKidney Trading Higher On Tuesday? | score=648.56 | tag=multi_window_impact
  - 2025-12-03T21:08:45 | CAPR | Capricor Therapeutics (CAPR) Valuation After Positive Phase 3 HOPE-3 Results for DMD Therapy Deramiocel | score=371.07 | tag=multi_window_impact

### 애널리스트 컨센서스·다수의견 (`analyst_consensus_overview`)
- 상위 분류: `residual`
- 한 줄 정의: 다수 analyst 의견 종합 기사.
- 핵심 가치 경로: 컨센서스 소개
- 포함 신호: insights from.*analysts, analyst reviews
- 제외 신호: 
- 빠른 판별 질문: 다수 의견 종합?
- 집계: total=794, impacted=109, max impact=135.38
- 대표 예시:
  - 2025-05-09T10:00:52 | OUST | Demystifying Ouster: Insights From 4 Analyst Reviews | score=135.38 | tag=multi_window_impact
  - 2026-02-09T11:01:09 | FSLY | Assessing Fastly: Insights From 5 Financial Analysts | score=106.18 | tag=multi_window_impact

### IPO·상장 이벤트 (`ipo_listing_event`)
- 상위 분류: `residual`
- 한 줄 정의: IPO, direct listing, market debut.
- 핵심 가치 경로: 유동성 이벤트
- 포함 신호: goes public, ipo, direct listing, debut
- 제외 신호: trading halt
- 빠른 판별 질문: 상장 이벤트?
- 집계: total=783, impacted=193, max impact=675.10
- 대표 예시:
  - 2025-06-05T15:18:00 | CRCL | Crypto Firm Circle’s Shares Soar in Stock Market Debut | score=675.10 | tag=multi_window_impact
  - 2025-05-02T12:11:30 | CRWV | Why CoreWeave Stock Rose 11% in April | score=268.01 | tag=multi_window_impact

### 공매도 비율·변동 (`short_interest_update`)
- 상위 분류: `residual`
- 한 줄 정의: short interest changes, heavily shorted.
- 핵심 가치 경로: 공매도 데이터→포지셔닝 힌트
- 포함 신호: short interest, heavily shorted, days to cover
- 제외 신호: 
- 빠른 판별 질문: 공매도 데이터?
- 집계: total=782, impacted=108, max impact=145.89
- 대표 예시:
  - 2025-07-31T15:46:00 | OPEN | Heavily shorted stocks have been on a tear lately. Consider this before buying into the rally. | score=145.89 | tag=sustained_repricing
  - 2026-02-13T05:00:34 | AAOI | Looking Into Applied Optoelectronics Inc's Recent Short Interest | score=133.03 | tag=sustained_repricing

### 경영진 보강·거버넌스 개선 (`management_governance_positive`)
- 상위 분류: `long`
- 한 줄 정의: experienced CEO/CFO 영입, governance agreement.
- 핵심 가치 경로: 운영 신뢰→valuation support
- 포함 신호: appoints new ceo, board refresh, governance agreement
- 제외 신호: executive departure
- 빠른 판별 질문: 경영 보강?
- 집계: total=779, impacted=140, max impact=350.94
- 대표 예시:
  - 2025-06-26T14:21:21 | VOR | Update: Vor Biopharma Shares Rally After Naming New CEO, Licensing Autoimmune Drug From RemeGen | score=350.94 | tag=multi_window_impact
  - 2025-06-26T11:22:00 | VOR | Vor, with new CEO, changes course to target autoimmune disease | score=350.94 | tag=multi_window_impact

### 의약품 지정·우선심사 (`drug_designation_positive`)
- 상위 분류: `long`
- 한 줄 정의: QIDP, Fast Track, Breakthrough, Orphan Drug 지정.
- 핵심 가치 경로: 규제 경로 단축→상업화 가속
- 포함 신호: qidp designation, fast track, breakthrough therapy, orphan drug
- 제외 신호: 
- 빠른 판별 질문: 규제 지정 이벤트?
- 집계: total=729, impacted=148, max impact=160.28
- 대표 예시:
  - 2026-01-14T05:09:14 | IBRX | ImmunityBio shares are trading higher after the Saudi Food and Drug Authority granted accelerated approval of ANKTIVA for use in combination with immune checkpoint inhibitors for the treatment of adult patients with metastatic non-small cell lung cancer whose disease has progressed following standard-of-care therapy. | score=160.28 | tag=multi_window_impact
  - 2025-10-03T07:34:00 | ANRO | Alto Neuroscience Receives FDA Fast Track Designation for ALTO-101 for the Treatment of Cognitive Impairment Associated with Schizophrenia | score=154.65 | tag=multi_window_impact

### 이례적 옵션 활동 (`unusual_options_activity`)
- 상위 분류: `residual`
- 한 줄 정의: unusual options activity, big options bets.
- 핵심 가치 경로: 옵션 시장 시그널→관심 증폭
- 포함 신호: unusual options, options activity, options alert, smart money.*options
- 제외 신호: 
- 빠른 판별 질문: 옵션 활동 중심?
- 집계: total=718, impacted=191, max impact=147.22
- 대표 예시:
  - 2025-09-29T10:27:43 | REPL | Replimune Group Option Alert: Oct 17 $6 Calls Sweep (16) Near The Ask: 1346 @ $0.25 Vs 129 OI | score=147.22 | tag=sustained_repricing
  - 2026-02-13T06:01:06 | CRCL | Circle Internet Group Unusual Options Activity | score=134.58 | tag=sustained_repricing

### 배당 개시·특별배당 (`dividend_special_event`)
- 상위 분류: `long`
- 한 줄 정의: initiates dividend, special dividend.
- 핵심 가치 경로: 배당 정책 변화→income investor 유입
- 포함 신호: initiates.*dividend, special dividend, quarterly dividend
- 제외 신호: 
- 빠른 판별 질문: 배당 이벤트?
- 집계: total=715, impacted=53, max impact=42.61
- 대표 예시:
  - 2025-05-12T02:05:00 | CMCL | Caledonia approves quarterly dividend | score=42.61 | tag=sustained_repricing
  - 2026-01-26T17:30:00 | RRX | Regal Rexnord Corporation Declares Quarterly Dividend of $.35 per share | score=41.47 | tag=sustained_repricing

### 소송 합의·분쟁 해소 (`settlement_resolution_positive`)
- 상위 분류: `long`
- 한 줄 정의: settlement, end feud, dispute resolution.
- 핵심 가치 경로: 리스크 해소→할인 제거
- 포함 신호: settlement, end feud, resolves dispute, ends.*legal
- 제외 신호: 
- 빠른 판별 질문: 분쟁 해소?
- 집계: total=714, impacted=100, max impact=114.51
- 대표 예시:
  - 2026-02-05T02:10:34 | CRCL | Circle Internet Group Extends USDC Reach With Hecto Cross-Border Integration | score=114.51 | tag=sustained_repricing
  - 2025-11-14T08:08:00 | SGML | Sigma Lithium's 3Q 25 Results: Increase in Revenues and Cash Position | score=95.42 | tag=multi_window_impact

### 내부자 매도·우려 시그널 (`insider_selling_concern`)
- 상위 분류: `short`
- 한 줄 정의: insider selling, executive sells shares.
- 핵심 가치 경로: 내부자 매도→우려
- 포함 신호: insider.*sell, insiders sell, executive.*sold
- 제외 신호: 
- 빠른 판별 질문: 내부자 매도?
- 집계: total=667, impacted=89, max impact=93.35
- 대표 예시:
  - 2025-05-08T07:00:09 | ORLY | Insiders At O'Reilly Automotive Sold US$64m In Stock, Alluding To Potential Weakness | score=93.35 | tag=sustained_repricing
  - 2025-04-10T13:50:04 | RUN | Sunrun Inc. (RUN): Among Stocks Insiders Sold in April After Trump’s Tariff Rollout | score=85.07 | tag=sustained_repricing

### 리스트형 screener 노이즈 (`screener_listicle_noise`)
- 상위 분류: `residual`
- 한 줄 정의: listicle, penny stocks, meme stocks.
- 핵심 가치 경로: 큐레이션/트래픽 유도
- 포함 신호: best meme stocks, penny stocks, what you need to know
- 제외 신호: 
- 빠른 판별 질문: 리스트형 기사?
- 집계: total=652, impacted=130, max impact=2267.06
- 대표 예시:
  - 2025-04-30T06:01:47 | RGC | Why Regencell Bioscience Holdings Limited (RGC) is Surging in 2025 | score=2267.06 | tag=multi_window_impact
  - 2025-08-29T07:27:47 | LCID | Cantor Holds Neutral Rating on Lucid (LCID) with Q2 Report on the Horizon | score=1073.67 | tag=multi_window_impact

### 밸류에이션 부담·과열 (`valuation_narrative_negative`)
- 상위 분류: `short`
- 한 줄 정의: too expensive, stretched, overvalued.
- 핵심 가치 경로: 과열→de-rating
- 포함 신호: too expensive, stretched valuation, overvalued
- 제외 신호: formal downgrade
- 빠른 판별 질문: valuation 부담 중심?
- 집계: total=631, impacted=139, max impact=97.98
- 대표 예시:
  - 2025-09-10T15:12:00 | IREN | IREN Limited Jumps 208% Year to Date: Buy, Sell or Hold the Stock? | score=97.98 | tag=multi_window_impact
  - 2025-12-22T09:53:44 | BE | Bloom Energy (BE): Mixed Analyst Outlook Amid Growth and Valuation Concerns | score=57.19 | tag=sustained_repricing

### 정책·법안 역풍 read-through (`policy_regulatory_headwind_negative`)
- 상위 분류: `short`
- 한 줄 정의: 법안/규제 변화가 사업모델에 역풍.
- 핵심 가치 경로: 규제 강화→수익 제한
- 포함 신호: ban, policy risk, lawmakers, regulatory framework
- 제외 신호: fda rejection
- 빠른 판별 질문: 정책 역풍?
- 집계: total=582, impacted=125, max impact=64.58
- 대표 예시:
  - 2026-02-20T15:27:43 | CRCL | The SEC Just Opened the Door for Stablecoin Adoption | score=64.58 | tag=multi_window_impact
  - 2025-06-17T22:26:46 | COIN | Senate Passes GENIUS Act—Coinbase's Brian Armstrong Calls It 'Big Milestone,' Scott Bessent Says Passage Could Drive Stablecoins Into A $3.7 Trillion Market | score=58.13 | tag=sustained_repricing

### 정부·대형 계약 수주 (`government_contract_award_positive`)
- 상위 분류: `long`
- 한 줄 정의: prime contractor, definitive contract, government award.
- 핵심 가치 경로: 매출 가시성·backlog 확대
- 포함 신호: contract award, wins contract, government contract
- 제외 신호: generic partnership
- 빠른 판별 질문: 실제 수주 핵심?
- 집계: total=554, impacted=145, max impact=1511.26
- 대표 예시:
  - 2025-02-10T06:21:02 | GSAT | Globalstar shares are trading higher after MDA Space signed a definitive contract with the company to be the prime contractor for the satellite operator's next generation low Earth orbit constellation. | score=1511.26 | tag=multi_window_impact
  - 2025-02-10T02:32:43 | GSAT | MDA Space Has Signed A Definitive Contract With Globalstar To Be The Prime Contractor For The Satellite Operator's Next-Generation Low Earth Orbit Constellation, With A Total Contract Value Of Approximately $1.1B | score=1511.26 | tag=multi_window_impact

### 행동주의 투자자 이벤트 (`activist_investor_event`)
- 상위 분류: `long`
- 한 줄 정의: activist investor, activist stake, board fight.
- 핵심 가치 경로: 거버넌스 변화→재평가
- 포함 신호: activist, board fight, proxy fight, starboard
- 제외 신호: 
- 빠른 판별 질문: 행동주의 투자자?
- 집계: total=544, impacted=77, max impact=237.48
- 대표 예시:
  - 2025-07-15T18:28:29 | OPEN | Activist interest lifts Opendoor shares as Eric Jackson eyes turnaround | score=237.48 | tag=multi_window_impact
  - 2025-08-15T10:20:16 | OPEN | Opendoor stock jumps after CEO exit, retail activists claim win | score=235.86 | tag=sustained_repricing

### 피인수·프리미엄 거래 (`acquisition_target_premium_positive`)
- 상위 분류: `long`
- 한 줄 정의: company being acquired at premium per share.
- 핵심 가치 경로: 프리미엄 실현→주주가치
- 포함 신호: acquire.*for.*share, tender offer, premium
- 제외 신호: 
- 빠른 판별 질문: 피인수 이벤트?
- 집계: total=502, impacted=81, max impact=66.90
- 대표 예시:
  - 2026-03-06T04:37:19 | DAWN | Servier Strikes Agreement To Acquire Day One Biopharmaceuticals For $21.50/Share In Cash | score=66.90 | tag=multi_window_impact
  - 2026-01-20T14:13:00 | RAPT | Forbion Announces Second Exit from Forbion Growth Fund III Following $2.2 Billion Acquisition of RAPT Therapeutics by GSK | score=65.01 | tag=multi_window_impact

### 유가·에너지·원자재 영향 (`oil_energy_commodity_impact`)
- 상위 분류: `residual`
- 한 줄 정의: oil price, commodity price moves.
- 핵심 가치 경로: 원자재 가격 영향
- 포함 신호: oil tops, oil jumps, crude oil, oil prices, commodity
- 제외 신호: 
- 빠른 판별 질문: 원자재 가격 충격?
- 집계: total=489, impacted=84, max impact=262.82
- 대표 예시:
  - 2025-07-28T08:05:27 | CELC | Crude Oil Gains 2%; CEA Industries Shares Spike Higher | score=262.82 | tag=multi_window_impact
  - 2025-10-16T08:31:12 | PRAX | Dow Dips Over 100 Points; US Crude Oil Inventories Surge | score=250.48 | tag=multi_window_impact

### 실적 혼재·엇갈림 (`earnings_result_mixed_neutral`)
- 상위 분류: `residual`
- 한 줄 정의: EPS beat+매출 miss 또는 반대. 방향 불명확.
- 핵심 가치 경로: 방향 혼재→단기 변동 후 수렴
- 포함 신호: mixed results, beat eps miss revenue
- 제외 신호: 
- 빠른 판별 질문: beat+miss 동시?
- 집계: total=446, impacted=79, max impact=89.93
- 대표 예시:
  - 2025-09-29T05:40:18 | MLTX | Moonlake shares crash on mixed study results for immune drug | score=89.93 | tag=multi_window_impact
  - 2026-02-10T05:56:36 | EVMN | Dow Surges Over 200 Points; Coca-Cola Posts Mixed Q4 Results | score=85.82 | tag=multi_window_impact

### 실적 콜 요약 (`earnings_call_summary`)
- 상위 분류: `residual`
- 한 줄 정의: Moby summary 등 earnings call summary.
- 핵심 가치 경로: 콜 요약
- 포함 신호: earnings call summary, moby summary
- 제외 신호: 
- 빠른 판별 질문: 콜 요약?
- 집계: total=434, impacted=46, max impact=105.37
- 대표 예시:
  - 2026-02-12T08:30:00 | FSLY | Fastly, Inc. Q4 2025 Earnings Call Summary | score=105.37 | tag=multi_window_impact
  - 2026-02-24T16:32:22 | IOVA | Iovance Biotherapeutics, Inc. Q4 2025 Earnings Call Summary | score=79.93 | tag=multi_window_impact

### 지정학·전쟁·긴장 영향 (`geopolitical_market_impact`)
- 상위 분류: `residual`
- 한 줄 정의: war, geopolitical tensions, sanctions.
- 핵심 가치 경로: 지정학 리스크→시장 변동
- 포함 신호: geopolitical, middle east, iran war, sanctions, escalating tensions
- 제외 신호: 
- 빠른 판별 질문: 지정학 이벤트?
- 집계: total=434, impacted=40, max impact=55.15
- 대표 예시:
  - 2025-04-08T09:24:15 | MSTR | Why Strategy Inc. (MSTR) Went Down On Monday? | score=55.15 | tag=sustained_repricing
  - 2025-05-19T12:45:00 | LAES | SEALSQ Announces Results of Its 2025 Annual General Meeting (“AGM”) of Shareholders Held on May 19, 2025 | score=53.10 | tag=multi_window_impact

### 여신 확대·부채 관리 (`credit_facility_update`)
- 상위 분류: `long`
- 한 줄 정의: revolving credit expansion, debt management.
- 핵심 가치 경로: 유동성 확보→재무 안정
- 포함 신호: revolving credit, credit facility, extends.*credit, upsizes
- 제외 신호: 
- 빠른 판별 질문: 여신/부채 이벤트?
- 집계: total=412, impacted=61, max impact=346.63
- 대표 예시:
  - 2025-09-24T07:10:00 | QURE | uniQure Announces Refinancing of Existing $50 Million Debt and Securing Up to an Additional $125 Million in Non-Dilutive Funding | score=346.63 | tag=multi_window_impact
  - 2025-09-24T03:12:18 | QURE | uniQure Refinances $50M Debt And Gains Access To Additional $125M Non-Dilutive Funding From Hercules Capital | score=346.63 | tag=multi_window_impact

### 원가 절감·마진 개선 (`cost_margin_improvement`)
- 상위 분류: `long`
- 한 줄 정의: cost reduction, margin improvement, efficiency.
- 핵심 가치 경로: 수익성 개선→valuation support
- 포함 신호: margin improvement, cost reduction, operating leverage, efficiency
- 제외 신호: 
- 빠른 판별 질문: 마진 개선 중심?
- 집계: total=372, impacted=71, max impact=78.65
- 대표 예시:
  - 2025-08-12T23:23:21 | BE | BE Q2 Deep Dive: Data Center Demand and Product Innovation Drive Margin Improvement | score=78.65 | tag=multi_window_impact
  - 2025-05-01T16:30:00 | CPS | Cooper Standard Reports Robust Operating Performance and Significant Margin Improvement in the First Quarter of 2025 | score=76.55 | tag=multi_window_impact

### 거래정지·역분할·상장유지 스트레스 (`capital_structure_stress_negative`)
- 상위 분류: `short`
- 한 줄 정의: trading halt, reverse split, compliance pressure.
- 핵심 가치 경로: 구조 스트레스→할인
- 포함 신호: trading halt, reverse stock split, minimum bid
- 제외 신호: ipo debut
- 빠른 판별 질문: 자본구조 스트레스?
- 집계: total=366, impacted=179, max impact=3646.27
- 대표 예시:
  - 2025-06-06T15:50:05 | NKTR | Trading Halt: Halted at 7:50:00 p.m. ET - Trading Halt: Halt News Pending | score=3646.27 | tag=multi_window_impact
  - 2025-06-06T12:39:04 | NKTR | Nektar Therapeutics Files Amendments To Increase Authorized Common Stock From 300M To 390M Shares And Implement 1-For-15 Reverse Stock Split Effective June 8, 2025; Split-Adjusted Trading To Begin June 9, 2025 | score=3646.27 | tag=multi_window_impact

### 규제·임상 악재 (`regulatory_clinical_negative`)
- 상위 분류: `short`
- 한 줄 정의: CRL, endpoint failure, clinical hold.
- 핵심 가치 경로: 자산 가치 훼손→지연/실패
- 포함 신호: complete response letter, clinical hold, failed to meet
- 제외 신호: positive topline, approval
- 빠른 판별 질문: 실패/보류 중심?
- 집계: total=358, impacted=95, max impact=371.07
- 대표 예시:
  - 2025-12-03T06:10:54 | CAPR | Capricor soars on positive results for Duchenne cell therapy | score=371.07 | tag=multi_window_impact
  - 2025-10-22T10:43:39 | TERN | Why Is Terns Pharmaceuticals Stock Trading Lower After Obesity Trial Data? | score=224.08 | tag=sustained_repricing

### 유통·판매 계약 (`distribution_agreement_positive`)
- 상위 분류: `long`
- 한 줄 정의: distribution deal, sell drugs through, 유통 합의.
- 핵심 가치 경로: 유통 채널 확보→매출 접근성
- 포함 신호: sell.*through, distribution, sell.*drugs.*platform
- 제외 신호: 
- 빠른 판별 질문: 유통/판매 합의?
- 집계: total=346, impacted=77, max impact=111.40
- 대표 예시:
  - 2025-04-15T08:00:00 | RZLV | Rezolve Ai Secures $9.8 Million Annual Contract with Liverpool Mexico | score=111.40 | tag=multi_window_impact
  - 2025-10-01T09:20:00 | LAES | SEALSQ and SEALCOIN AG Unite to Future-Proof AI Agents with Post-Quantum Security | score=100.27 | tag=multi_window_impact

### 내부자 매수·자신감 시그널 (`insider_buying_positive`)
- 상위 분류: `long`
- 한 줄 정의: insider buying, director purchases.
- 핵심 가치 경로: 내부자 확신→신뢰
- 포함 신호: insider buying, director.*purchase, ceo.*bought
- 제외 신호: 
- 빠른 판별 질문: 내부자 매수?
- 집계: total=270, impacted=46, max impact=192.55
- 대표 예시:
  - 2025-12-09T09:45:10 | HYMC | Top Insider Purchases in December Signal Market Confidence | score=192.55 | tag=sustained_repricing
  - 2025-08-22T09:00:33 | RAPP | Positive Signs As Multiple Insiders Buy Rapport Therapeutics Stock | score=110.78 | tag=sustained_repricing

### 의약품 판매허가(비FDA) (`drug_marketing_authorization`)
- 상위 분류: `long`
- 한 줄 정의: EC/EMA marketing authorization, non-FDA 승인.
- 핵심 가치 경로: 해외 시장 접근→매출 확대
- 포함 신호: marketing authorization, european commission, conditional approval
- 제외 신호: 
- 빠른 판별 질문: 비FDA 판매허가?
- 집계: total=268, impacted=68, max impact=247.87
- 대표 예시:
  - 2025-12-18T03:14:38 | IBRX | Jefferies Lifts ImmunityBio Inc. (IBRX) Price Target Following Anktiva European Expansion | score=247.87 | tag=sustained_repricing
  - 2025-09-23T05:04:50 | GRAL | GRAIL To Present New Data Highlighting Galleri MCED Test Performance And Safety From Registrational PATHFINDER 2 Study At ESMO Congress 2025 | score=85.81 | tag=sustained_repricing

### 기관 포트폴리오 변경(13F) (`institutional_portfolio_shift`)
- 상위 분류: `residual`
- 한 줄 정의: fund adds/exits, portfolio shift.
- 핵심 가치 경로: 기관 수급 변화
- 포함 신호: portfolio shift, adds.*position, exits.*position, q4 portfolio, 13f
- 제외 신호: 
- 빠른 판별 질문: 기관 포트폴리오?
- 집계: total=266, impacted=33, max impact=113.74
- 대표 예시:
  - 2026-02-17T10:08:43 | CRCL | Tiger Global Management Increases Stake In Circle Internet Group By 300% To 500,000 Shares | score=113.74 | tag=sustained_repricing
  - 2026-02-18T09:43:52 | CRCL | SoftBank Adds TwentyOne Capital, Exits Nvidia in Q4 Portfolio Shift | score=104.53 | tag=sustained_repricing

### 광산·자원 업데이트 (`mining_resource_update`)
- 상위 분류: `long`
- 한 줄 정의: mineral resource estimate, drill program.
- 핵심 가치 경로: 자원 가치 상향→재평가
- 포함 신호: mineral resource, drill program, resource estimate, gold.*deposit, silver.*deposit
- 제외 신호: 
- 빠른 판별 질문: 자원 업데이트?
- 집계: total=220, impacted=61, max impact=227.24
- 대표 예시:
  - 2025-12-16T09:09:34 | HYMC | Why Hycroft Mining (HYMC) Is Up 11.9% After Expanding High-Grade Vortex Silver Zone Potential | score=227.24 | tag=multi_window_impact
  - 2025-12-22T08:30:00 | HYMC | Hycroft Reports Higher Grade in Vortex Silver System | score=202.01 | tag=multi_window_impact

### 차익실현·매도 수급 (`positioning_flow_negative`)
- 상위 분류: `short`
- 한 줄 정의: profit-taking, de-grossing, fund selling.
- 핵심 가치 경로: 포지셔닝 축소→하방
- 포함 신호: profit-taking, de-grossing, fund selling
- 제외 신호: earnings miss
- 빠른 판별 질문: flow unwind 중심?
- 집계: total=216, impacted=72, max impact=120.19
- 대표 예시:
  - 2025-08-21T10:44:22 | OPEN | Opendoor (OPEN) Ends “Meme Rally” on Profit-Taking, Shares Up 75% Month-to-Date | score=120.19 | tag=multi_window_impact
  - 2026-01-29T22:46:45 | AAOI | Applied Optoelectronics (AAOI) Falls 12.5% After 8-Year High | score=110.79 | tag=sustained_repricing

### FDA 절차 진행·수리 (`fda_procedural_action`)
- 상위 분류: `long`
- 한 줄 정의: FDA accepts NDA, reverses decision, schedules review.
- 핵심 가치 경로: 절차 진행→approval 기대
- 포함 신호: fda accepts, fda reverses, fda to review, pdufa date, supplemental new drug
- 제외 신호: fda rejection
- 빠른 판별 질문: FDA 절차 진전?
- 집계: total=214, impacted=46, max impact=107.33
- 대표 예시:
  - 2025-10-20T04:55:48 | REPL | Replimune shares are trading higher after the FDA accepted the company's resubmission of the Biologics License Application for RP1 in combination with nivolumab for advanced melanoma, with a PDUFA date of April 10, 2026. | score=107.33 | tag=multi_window_impact
  - 2025-10-20T03:36:19 | REPL | Market-Moving News for October 20th | score=107.33 | tag=multi_window_impact

### 일간 지수·시장 요약 (`daily_market_index_summary`)
- 상위 분류: `residual`
- 한 줄 정의: Dow Gains/Dips X Points; earnings.
- 핵심 가치 경로: 시장 요약
- 포함 신호: dow dips, dow gains, dow rises, dow falls, nasdaq gains, us stocks, crude oil gains
- 제외 신호: 
- 빠른 판별 질문: 일간 시장 요약?
- 집계: total=164, impacted=65, max impact=648.56
- 대표 예시:
  - 2025-07-08T06:16:25 | PROK | US Stocks Mixed; Small Business Sentiment Falls In June | score=648.56 | tag=multi_window_impact
  - 2025-12-03T06:03:25 | CAPR | US Stocks Mixed; Dollar Tree Posts Upbeat Earnings | score=371.07 | tag=multi_window_impact

### 임상시험 개시·첫 투약 (`clinical_trial_initiation_positive`)
- 상위 분류: `long`
- 한 줄 정의: first patient dosed, trial initiated.
- 핵심 가치 경로: 파이프라인 진전→milstone 기대
- 포함 신호: first patient dosed, trial initiated, phase.*initiated
- 제외 신호: 
- 빠른 판별 질문: 임상 개시 이벤트?
- 집계: total=155, impacted=46, max impact=250.53
- 대표 예시:
  - 2025-07-24T12:02:25 | CELC | Celcuity Doses First Patient In Phase 3 VIKTORIA-2 Clinical Trial Of Gedatolisib As First-Line Treatment For HR+/HER2- Advanced Breast Cancer | score=250.53 | tag=multi_window_impact
  - 2025-05-21T07:00:00 | TNGX | Tango Therapeutics Announces First Patient Dosed in TNG456 Phase 1/2 Trial in Patients With MTAP-deleted Glioblastomas and Other Solid Tumors | score=158.94 | tag=sustained_repricing

### 특허·IP 이벤트 (`patent_ip_event`)
- 상위 분류: `residual`
- 한 줄 정의: patent win/loss, IP acquisition.
- 핵심 가치 경로: IP 가치 변화
- 포함 신호: patent, intellectual property, ip.*acqui
- 제외 신호: 
- 빠른 판별 질문: 특허/IP 이벤트?
- 집계: total=146, impacted=27, max impact=95.49
- 대표 예시:
  - 2025-08-20T07:05:00 | IONQ | IonQ Fortifies Quantum Leadership with Groundbreaking Patents, Surpassing 1,000 Total IP Assets | score=95.49 | tag=sustained_repricing
  - 2025-10-20T12:03:44 | VICR | Vicor Steps Up IP Licensing After U.S. Import Ban On Infringing Power Modules | score=62.54 | tag=multi_window_impact

### 애널리스트 코멘트 증폭(부정) (`analyst_note_amplification_negative`)
- 상위 분류: `short`
- 한 줄 정의: formal downgrade 아닌 cautious/bearish note.
- 핵심 가치 경로: warning note→sentiment 이탈
- 포함 신호: analyst warns, cautious note, bearish
- 제외 신호: formal downgrade
- 빠른 판별 질문: note 증폭(부정)?
- 집계: total=123, impacted=29, max impact=661.98
- 대표 예시:
  - 2025-08-06T10:32:27 | LCID | Why Lucid Stock Investors Are Pumping the Brakes Today | score=661.98 | tag=sustained_repricing
  - 2025-04-22T03:37:04 | CRWV | This American Water Works Analyst Begins Coverage On A Bearish Note; Here Are Top 5 Initiations For Tuesday | score=182.82 | tag=sustained_repricing

### 부채 관리·리파이낸싱 (`debt_restructuring_event`)
- 상위 분류: `long`
- 한 줄 정의: debt paydown, refinancing, maturity extension.
- 핵심 가치 경로: 재무 건전성→안정
- 포함 신호: refinancing, debt paydown, maturity extension, deleveraging
- 제외 신호: 
- 빠른 판별 질문: 부채 관리 이벤트?
- 집계: total=112, impacted=25, max impact=60.14
- 대표 예시:
  - 2025-09-16T10:09:00 | SNDK | WDC Surges 129% in 6 Months: How Should Investors Play the Stock? | score=60.14 | tag=sustained_repricing
  - 2025-05-02T03:20:10 | CABO | Cable One Inc (CABO) Q1 2025 Earnings Call Highlights: Navigating Revenue Declines and ... | score=44.49 | tag=multi_window_impact

### 서킷브레이커·일시정지 (`circuit_breaker_halt_event`)
- 상위 분류: `residual`
- 한 줄 정의: circuit breaker halt, trading halted/resumed.
- 핵심 가치 경로: 급변 이벤트→변동성
- 포함 신호: circuit breaker, halted on, shares halted, trading resumed
- 제외 신호: 
- 빠른 판별 질문: 서킷브레이커?
- 집계: total=92, impacted=65, max impact=648.56
- 대표 예시:
  - 2025-07-08T10:46:53 | PROK | ProKidney Corp. Shares Halted On Circuit Breaker To The Upside, Stock Now Up 661.8% | score=648.56 | tag=multi_window_impact
  - 2025-07-08T07:47:36 | PROK | ProKidney Corp. Shares Halted On Circuit Breaker To The Upside, Stock Now Up 422.7% | score=648.56 | tag=multi_window_impact

### 프리마켓·애프터마켓 movers (`premarket_afterhours_movers`)
- 상위 분류: `residual`
- 한 줄 정의: pre-market/after-hours movers roundup.
- 핵심 가치 경로: 장전/장후 movers
- 포함 신호: pre-market session, after-market session, after-hours session, before the opening bell
- 제외 신호: 
- 빠른 판별 질문: 장전/장후 movers?
- 집계: total=88, impacted=20, max impact=45.45
- 대표 예시:
  - 2025-06-05T13:52:44 | RKLB | Rocket Lab, AST SpaceMobile, Virgin Galactic Shares Are Rising After Hours: What's Going On? | score=45.45 | tag=sustained_repricing
  - 2025-10-16T13:24:18 | HIMS | Eli Lilly, Novo Nordisk, Hims & Hers Health Shares Move Lower After Trump Calls Out 'Fat-Loss Drugs' | score=43.31 | tag=sustained_repricing

### 애널리스트 전망 하향 수정 (`analyst_forecast_revision_negative`)
- 상위 분류: `short`
- 한 줄 정의: analysts cut/lower forecasts.
- 핵심 가치 경로: 집합적 전망 하향
- 포함 신호: analysts cut, forecasts after weak
- 제외 신호: 
- 빠른 판별 질문: 집합적 전망 하향?
- 집계: total=82, impacted=15, max impact=1202.82
- 대표 예시:
  - 2025-05-14T08:04:07 | NKTR | Nektar Therapeutics (NASDAQ:NKTR) Analysts Are Cutting Their Estimates: Here's What You Need To Know | score=1202.82 | tag=sustained_repricing
  - 2025-05-13T07:12:53 | NKTR | Time To Worry? Analysts Are Downgrading Their Nektar Therapeutics (NASDAQ:NKTR) Outlook | score=1109.86 | tag=sustained_repricing

### 애널리스트 전망 상향 수정 (`analyst_forecast_revision_positive`)
- 상위 분류: `long`
- 한 줄 정의: analysts boost/increase forecasts.
- 핵심 가치 경로: 집합적 전망 상향
- 포함 신호: analysts boost, forecasts after upbeat
- 제외 신호: 
- 빠른 판별 질문: 집합적 전망 상향?
- 집계: total=81, impacted=19, max impact=106.57
- 대표 예시:
  - 2025-12-11T08:51:36 | PL | These Analysts Boost Their Forecasts On Planet Labs After Q3 Results | score=106.57 | tag=multi_window_impact
  - 2025-11-26T07:57:38 | FLNC | Fluence Energy Analysts Boost Their Forecasts Following Q4 Earnings | score=53.79 | tag=sustained_repricing

### 이벤트 일정·스케줄 공지 (`company_event_schedule_noise`)
- 상위 분류: `residual`
- 한 줄 정의: events schedule, calendar announcement.
- 핵심 가치 경로: 일정 안내
- 포함 신호: events schedule, schedules.*webcast, sets.*schedule
- 제외 신호: 
- 빠른 판별 질문: 일정 공지?
- 집계: total=76, impacted=19, max impact=76.16
- 대표 예시:
  - 2025-09-02T09:30:00 | AMPX | Amprius Sets September 2025 Events Schedule | score=76.16 | tag=sustained_repricing
  - 2025-06-02T08:30:00 | AMPX | Amprius Sets June 2025 Events Schedule | score=73.98 | tag=sustained_repricing

### 갭 상승/하락 종목 (`gapping_stocks_analysis`)
- 상위 분류: `residual`
- 한 줄 정의: gapping stocks, gap-ups and gap-downs.
- 핵심 가치 경로: 갭 분석
- 포함 신호: gapping stocks, gap up, gap down, gap-ups
- 제외 신호: 
- 빠른 판별 질문: 갭 종목 분석?
- 집계: total=68, impacted=24, max impact=66.54
- 대표 예시:
  - 2026-03-04T10:30:00 | BW | Gapping stocks in Wednesday's session | score=66.54 | tag=multi_window_impact
  - 2026-03-09T11:30:00 | HIMS | Gapping stocks in Monday's session | score=49.11 | tag=multi_window_impact

### 정책·법안 수혜 read-through (`policy_regulatory_tailwind_positive`)
- 상위 분류: `long`
- 한 줄 정의: 법안/정책 변화가 사업모델에 수혜.
- 핵심 가치 경로: TAM 확대·규제완화
- 포함 신호: regulatory clarity, policy support, bill boosts
- 제외 신호: company contract
- 빠른 판별 질문: 정책 수혜?
- 집계: total=64, impacted=20, max impact=63.77
- 대표 예시:
  - 2026-01-08T08:00:00 | MLTX | MoonLake Immunotherapeutics Announces Positive Outcome from Type B Meeting with U.S. FDA and Announces Investor Day | score=63.77 | tag=multi_window_impact
  - 2025-06-18T12:36:42 | COIN | Circle Internet, Coinbase jump as Senate clears stablecoin bill | score=59.32 | tag=multi_window_impact

### 사업부 매각·자산 처분 (`divestiture_exit_neutral`)
- 상위 분류: `residual`
- 한 줄 정의: 사업부 매각, 자산 처분, 시장 철수.
- 핵심 가치 경로: 포트폴리오 재편→방향 혼재
- 포함 신호: divests, sells business, exits market
- 제외 신호: 
- 빠른 판별 질문: 사업부 매각?
- 집계: total=45, impacted=9, max impact=35.08
- 대표 예시:
  - 2025-10-28T16:06:00 | FLS | Flowserve Divests Legacy Asbestos Liabilities | score=35.08 | tag=multi_window_impact
  - 2025-04-14T08:49:00 | CRS | FSM Divests San Jose Mine, Signs Agreement to Sell Yaramoko Mine | score=34.85 | tag=sustained_repricing

### peer 호조 read-through (`peer_readthrough_positive`)
- 상위 분류: `long`
- 한 줄 정의: peer strong earnings, sector leader validation.
- 핵심 가치 경로: peer 검증→동종 re-rating
- 포함 신호: read-through, peer strength, sector leader, peer demand
- 제외 신호: same company earnings
- 빠른 판별 질문: 타사 호조 전이?
- 집계: total=30, impacted=7, max impact=264.36
- 대표 예시:
  - 2025-05-01T13:59:12 | CRWV | Why CoreWeave Stock Is Skyrocketing Today | score=264.36 | tag=multi_window_impact
  - 2025-11-26T08:41:07 | VOR | Vor Bio assumed with a Neutral at Wedbush | score=57.41 | tag=sustained_repricing

### 경영진 이탈·거버넌스 충격 (`management_governance_negative`)
- 상위 분류: `short`
- 한 줄 정의: CEO/CFO resignation, board dispute.
- 핵심 가치 경로: 리더십 공백→우려
- 포함 신호: ceo resigns, cfo resigns, board dispute
- 제외 신호: new ceo appointed
- 빠른 판별 질문: 경영 이탈?
- 집계: total=28, impacted=7, max impact=235.86
- 대표 예시:
  - 2025-08-15T10:37:00 | OPEN | Opendoor CEO Resigns. The Meme Stock Is Getting New Leadership. | score=235.86 | tag=sustained_repricing
  - 2025-08-18T17:25:16 | OPEN | Opendoor CEO Resigns After Investor Pressure; Stock Rallies | score=213.56 | tag=sustained_repricing

### 시장 영향 뉴스 다이제스트 (`market_moving_news_digest`)
- 상위 분류: `residual`
- 한 줄 정의: Market-Moving News for [Date].
- 핵심 가치 경로: 뉴스 다이제스트
- 포함 신호: market-moving news for, market moving news
- 제외 신호: 
- 빠른 판별 질문: 시장 뉴스 다이제스트?
- 집계: total=24, impacted=15, max impact=156.35
- 대표 예시:
  - 2025-09-24T03:17:32 | LAC | Market-Moving News for September 24th | score=156.35 | tag=multi_window_impact
  - 2025-12-17T03:24:58 | HUT | Market-Moving News for December 17th | score=59.95 | tag=multi_window_impact

### 기관 지분 공시·13D/13G (`institutional_stake_disclosure`)
- 상위 분류: `long`
- 한 줄 정의: 13D filing, stake disclosure, activist stake.
- 핵심 가치 경로: 기관 관심→수급 기대
- 포함 신호: 13d disclos, 13g, stake in, disclosed.*stake
- 제외 신호: 
- 빠른 판별 질문: 지분 공시?
- 집계: total=22, impacted=3, max impact=29.40
- 대표 예시:
  - 2026-01-14T20:06:59 | CHWY | How Investors May Respond To Chewy (CHWY) After Viking Global Boosts Stake In Autoship Model | score=28.79 | tag=sustained_repricing
  - 2025-09-08T09:40:28 | UEC | Uranium Energy 13G Filing Shows T. Rowe Price Associates, Inc. Reported A 12.8% Stake In The Co As Of August 31, 2025 | score=25.34 | tag=sustained_repricing

### 공급망 완화·원가 개선 (`supply_chain_tailwind_positive`)
- 상위 분류: `long`
- 한 줄 정의: supply easing, input cost decline.
- 핵심 가치 경로: 원가 하락→margin upside
- 포함 신호: supply chain easing, input costs fall, cost relief
- 제외 신호: company contract
- 빠른 판별 질문: 공급망 개선?
- 집계: total=1, impacted=0, max impact=5.95
- 대표 예시:
  - 2025-06-11T07:53:00 | AEM | EQX's AISC Spike Signals Pressure, But H2 Offers Path to Cost Relief | score=5.95 | tag=low_signal

## 해석

- v4 taxonomy는 100개 유형으로 잡것들을 대폭 축소하는 것을 목표로 한다.
- 남은 `meaningless_others`는 패턴 반복이 약하거나 분류 가치가 낮은 진짜 잔여 기사다.