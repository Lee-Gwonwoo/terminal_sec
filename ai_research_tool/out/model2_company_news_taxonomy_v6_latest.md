# tmp-delete-check

## 분석 범위

- analysis_id: `a9b6c6b9-6dbc-408b-8fd6-85b95687400b`
- source_type: `company_news`
- source_name: `FINNHUB`
- 기간: `2025-01-01 ~ 2025-01-01`
- 전체 분류 row: 264
- impact 계산 가능 row: 0
- impact 판정 row: 0
- `fallback rows (잡것들_* + unknown)`: 149
- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.

## taxonomy v6 설계 포인트

- 100개+ 유형 구조를 유지하면서, 의미없는 정보 계열은 `잡것들_` prefix로, 끝까지 분류되지 않은 row는 `unknown`으로 분리했다.
- BENZINGA EPS/guidance 포맷 regex 패턴 추가로 실적 기사 포착률 대폭 향상.
- 섹터 movers, 갭 분석, 장전/장후, 일간 요약 등 반복 패턴 독립 유형화.
- 고영향 residual 샘플을 기준으로 노이즈와 미분류 fallback을 분리했다.

## bucket 기준

- `overall_impact_score = max(immediate, short, medium)`
- `immediate = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
- `short = max(abs(change_1d_pct), abs(change_3d_pct))`
- `medium = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`
- bucket별 `p80`을 impact threshold로 사용했다.

| bucket | p50 | p80 | p90 |
| --- | ---: | ---: | ---: |

## case 요약

| top_level | case | total | impacted | max impact |
| --- | --- | ---: | ---: | ---: |
| residual | unknown | 147 | 0 | n/a |
| residual | 투자 논점·알파 아이디어 | 25 | 0 | n/a |
| residual | 매크로·시장 코멘터리 | 13 | 0 | n/a |
| residual | 주가 움직임 이유·해설 | 12 | 0 | n/a |
| long | 실적 Beat·가이던스 상향 | 8 | 0 | n/a |
| long | 애널리스트 상향·커버리지 개시 | 6 | 0 | n/a |
| residual | 종목 비교·vs 기사 | 6 | 0 | n/a |
| long | 급등 해설·상승 이유 | 6 | 0 | n/a |
| residual | feature·투자아이디어 해설 | 5 | 0 | n/a |
| long | 밸류에이션 discount 해소 | 5 | 0 | n/a |
| short | 애널리스트 하향·목표가 하향 | 3 | 0 | n/a |
| long | 제품·기술 통합·AI 도입 | 3 | 0 | n/a |
| long | 출시·상업화·확장 | 2 | 0 | n/a |
| residual | 암호화폐·디지털자산 이벤트 | 2 | 0 | n/a |
| short | 내부자 매도·우려 시그널 | 2 | 0 | n/a |
| short | 소송·조사·회계 리스크 | 2 | 0 | n/a |
| long | 숏커버·매수 유입 | 2 | 0 | n/a |
| residual | 공매도 비율·변동 | 2 | 0 | n/a |
| residual | 잡것들_리스트형 screener 노이즈 | 2 | 0 | n/a |
| long | 행동주의 투자자 이벤트 | 1 | 0 | n/a |
| long | 애널리스트 코멘트 증폭(긍정) | 1 | 0 | n/a |
| long | 대형 딜·인프라 투자 | 1 | 0 | n/a |
| long | 수요 급증·백로그 확대 | 1 | 0 | n/a |
| residual | 실적 vs 추정치 비교 | 1 | 0 | n/a |
| residual | 실적 발표 전 기대 기사 | 1 | 0 | n/a |
| residual | 실적 요약·평가 기사 | 1 | 0 | n/a |
| residual | 멀티종목 movers 기사 | 1 | 0 | n/a |
| long | 미디어 증폭·상승 해설 | 1 | 0 | n/a |
| short | peer 경쟁 심화 read-through | 1 | 0 | n/a |
| residual | 기술적 분석·차트 시그널 | 1 | 0 | n/a |

## 유형 정의

### unknown (`unknown`)
- 상위 분류: `residual`
- 한 줄 정의: 현재 taxonomy rule 어디에도 안정적으로 들어가지 않는 미분류 기사.
- 핵심 가치 경로: 사건성은 있을 수 있으나 rule 미정
- 포함 신호: 
- 제외 신호: 명확한 기존 case, 명백한 잡것들_ 노이즈 패턴
- 빠른 판별 질문: 현재 rule로는 안정 분류가 안 되는가?
- 집계: total=147, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T23:27:00 | ACN | The Descent of an Army Vet Turned Corporate Consultant Named in the New Year’s Attack | score=n/a | tag=unclassified
  - 2025-01-01T23:14:06 | NVDA | Nvidia's market value gets $2 trillion boost in 2024 on AI rally | score=n/a | tag=unclassified

### 투자 논점·알파 아이디어 (`investment_thesis_article`)
- 상위 분류: `residual`
- 한 줄 정의: should you buy, is it a buy, bull/bear case.
- 핵심 가치 경로: opinion/thesis→정보 전달
- 포함 신호: should you buy, is it a buy, worth buying, bull case, bear case, moonshot, better investment
- 제외 신호: 
- 빠른 판별 질문: 투자 논점 기사?
- 집계: total=25, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T18:15:00 | NFLX | Should You Buy Netflix Stock Before Jan. 6? | score=n/a | tag=unclassified
  - 2025-01-01T13:27:30 | VKTX | Why Is Viking Therapeutics, Inc. (VKTX) Among the Best Multibagger Stocks to Buy Right Now? | score=n/a | tag=unclassified

### 매크로·시장 코멘터리 (`macro_market_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: 금리, Fed, 인플레이션, 지수 움직임 광범위 설명.
- 핵심 가치 경로: 외부 환경 read-through
- 포함 신호: stock market today, fed, inflation, recession, economic slowdown
- 제외 신호: single-company event
- 빠른 판별 질문: 멀티종목 매크로?
- 집계: total=13, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T22:57:08 | COMP | Stock market today: Asian shares mostly decline amid investor worries, and Tokyo stays closed | score=n/a | tag=unclassified
  - 2025-01-01T19:25:25 | T | Bank of America Lines up 2 Top Picks for 2025 | score=n/a | tag=unclassified

### 주가 움직임 이유·해설 (`stock_why_moving_explanation`)
- 상위 분류: `residual`
- 한 줄 정의: what's going on with X stock, here's why.
- 핵심 가치 경로: 이유 해설→정보 전달
- 포함 신호: what's going on with, here's why, what's behind, what's driving
- 제외 신호: 
- 빠른 판별 질문: 주가 움직임 이유 해설?
- 집계: total=12, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T09:55:02 | PATH | Here's Why UiPath (PATH) Could be Great Choice for a Bottom Fisher | score=n/a | tag=unclassified
  - 2025-01-01T09:45:13 | ACM | Why This 1 Growth Stock Could Be a Great Addition to Your Portfolio | score=n/a | tag=unclassified

### 실적 Beat·가이던스 상향 (`earnings_beat_raise_positive`)
- 상위 분류: `long`
- 한 줄 정의: EPS/매출 beat 또는 가이던스 상향이 핵심 기사.
- 핵심 가치 경로: 추정치 상향→멀티플 re-rating
- 포함 신호: beat estimates, raises guidance, record revenue
- 제외 신호: preview, transcript
- 빠른 판별 질문: 실제 결과? / beat/raise 중심?
- 집계: total=8, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T12:10:16 | BSX | Why Boston Scientific (BSX) is Poised to Beat Earnings Estimates Again | score=n/a | tag=unclassified
  - 2025-01-01T12:10:16 | ISRG | Will Intuitive Surgical (ISRG) Beat Estimates Again in Its Next Earnings Report? | score=n/a | tag=unclassified

### 애널리스트 상향·커버리지 개시 (`analyst_upgrade_positive`)
- 상위 분류: `long`
- 한 줄 정의: upgrade, coverage initiation, target raise 중심.
- 핵심 가치 경로: sell-side 상향→re-rating
- 포함 신호: initiates coverage, outperform, raises price target
- 제외 신호: target cut, downgraded
- 빠른 판별 질문: formal upgrade?
- 집계: total=6, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T12:45:05 | FSS | Federal Signal (FSS) is an Incredible Growth Stock: 3 Reasons Why | score=n/a | tag=unclassified
  - 2025-01-01T12:00:11 | COR | Cencora (COR) Upgraded to Buy: Here's What You Should Know | score=n/a | tag=unclassified

### 종목 비교·vs 기사 (`stock_comparison_article`)
- 상위 분류: `residual`
- 한 줄 정의: A vs B: which stock is better.
- 핵심 가치 경로: 비교 분석
- 포함 신호: which stock is, better value option, vs.*which is
- 제외 신호: 
- 빠른 판별 질문: 종목 비교 기사?
- 집계: total=6, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T11:40:16 | BDX | BDX vs. MMSI: Which Stock Is the Better Value Option? | score=n/a | tag=unclassified
  - 2025-01-01T11:40:15 | NVST | NVST or LZAGY: Which Is the Better Value Stock Right Now? | score=n/a | tag=unclassified

### 급등 해설·상승 이유 (`stock_surge_explanation_positive`)
- 상위 분류: `long`
- 한 줄 정의: 주가 급등 사유 해설 (rallies X%, surges X%).
- 핵심 가치 경로: 급등 해설→추가 관심
- 포함 신호: rallies over, surges, soars, jumps.*%, up.*%
- 제외 신호: 
- 빠른 판별 질문: 급등 사유 해설?
- 집계: total=6, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T23:18:15 | NVDA | S&P 500 Surges 23% In 2024, But Greed Index Remains In 'Fear' Zone | score=n/a | tag=unclassified
  - 2025-01-01T09:35:43 | CRWD | Jim Cramer Refers To CrowdStrike Holdings, Inc. (CRWD) As ‘Cramer Favorite’, Shares Up 11% In November After Elections | score=n/a | tag=unclassified

### feature·투자아이디어 해설 (`generic_feature_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: deep dive, feature, opinion article.
- 핵심 가치 경로: opinion layer
- 포함 신호: is it a buy, deep dive, feature
- 제외 신호: formal analyst
- 빠른 판별 질문: feature/opinion?
- 집계: total=5, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T12:45:05 | FTNT | Looking for a Growth Stock? 3 Reasons Why Fortinet (FTNT) is a Solid Choice | score=n/a | tag=unclassified
  - 2025-01-01T11:55:34 | FFIV | Is It Too Late To Consider Buying F5, Inc. (NASDAQ:FFIV)? | score=n/a | tag=unclassified

### 밸류에이션 discount 해소 (`valuation_narrative_positive`)
- 상위 분류: `long`
- 한 줄 정의: undervalued, discount, rerating potential.
- 핵심 가치 경로: 저평가 해소→multiple expansion
- 포함 신호: undervalued, discount, catch-up, rerating
- 제외 신호: best stock list
- 빠른 판별 질문: 저평가 해소 논리?
- 집계: total=5, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T11:25:20 | CWK | Is Cushman & Wakefield plc (NYSE:CWK) Potentially Undervalued? | score=n/a | tag=unclassified
  - 2025-01-01T08:40:44 | PNW | An Intrinsic Calculation For Pinnacle West Capital Corporation (NYSE:PNW) Suggests It's 25% Undervalued | score=n/a | tag=unclassified

### 애널리스트 하향·목표가 하향 (`analyst_downgrade_negative`)
- 상위 분류: `short`
- 한 줄 정의: downgrade, underperform, target cut 중심.
- 핵심 가치 경로: sell-side 하향→de-rating
- 포함 신호: downgraded, underperform, target cut
- 제외 신호: raises price target
- 빠른 판별 질문: formal downgrade?
- 집계: total=3, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T09:37:00 | MCHP | The 5 worst performing stocks on the Nasdaq 100 in 2024 | score=n/a | tag=unclassified
  - 2025-01-01T08:01:14 | TSLA | Tesla, Inc. (TSLA): UBS Maintains Sell Rating with $226 Target Amid AI Optimism and EV Market Competition | score=n/a | tag=unclassified

### 제품·기술 통합·AI 도입 (`product_technology_integration`)
- 상위 분류: `long`
- 한 줄 정의: tech integration, AI adoption, platform integration.
- 핵심 가치 경로: 기술 역량 강화→경쟁력
- 포함 신호: integrates, adopts.*ai, ai agent, platform integration
- 제외 신호: 
- 빠른 판별 질문: 기술 통합 이벤트?
- 집계: total=3, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T17:57:55 | AMZN | Will Amazon (NASDAQ:AMZN) Stock See Newer Highs in 2025? | score=n/a | tag=unclassified
  - 2025-01-01T08:17:28 | AAPL | Apple Inc. (AAPL): Wedbush Sets Street-High $325 Target, Citing AI-Driven iPhone Upgrade Cycle and New Revenue Streams | score=n/a | tag=unclassified

### 출시·상업화·확장 (`commercial_launch_expansion_positive`)
- 상위 분류: `long`
- 한 줄 정의: launch, rollout, expansion, commercialization.
- 핵심 가치 경로: 시장 확대→매출 성장
- 포함 신호: launches, expands, commercial launch, expansion
- 제외 신호: event promotion
- 빠른 판별 질문: 상업화/확장 이벤트?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T08:05:00 | NVDA | Wall Street Analyst Dan Ives Sees Tech Stocks Jumping Another 25% in 2025. Time to Buy? | score=n/a | tag=unclassified
  - 2025-01-01T04:52:00 | CRWD | 2 No-Brainer Growth Stocks to Buy With $5,000 During the S&P 500 Bull Market | score=n/a | tag=unclassified

### 암호화폐·디지털자산 이벤트 (`crypto_digital_asset_event`)
- 상위 분류: `residual`
- 한 줄 정의: crypto, stablecoin, blockchain events.
- 핵심 가치 경로: 디지털자산 이벤트→재평가
- 포함 신호: bitcoin, stablecoin, cryptocurrency, blockchain, crypto exchange
- 제외 신호: 
- 빠른 판별 질문: 암호화폐 이벤트?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T07:08:13 | MSTR | 'Pharma Bro' Martin Shkreli Predicts Liquidation Doom For MicroStrategy Amid Fall Below $300, Says Bitcoin Will Hit $250K Without Michael Saylor | score=n/a | tag=unclassified
  - 2025-01-01T05:00:00 | MSTR | This Is How Much Bigger MicroStrategy's Bitcoin Stash Is Than the Next-Largest Corporate Holding | score=n/a | tag=unclassified

### 내부자 매도·우려 시그널 (`insider_selling_concern`)
- 상위 분류: `short`
- 한 줄 정의: insider selling, executive sells shares.
- 핵심 가치 경로: 내부자 매도→우려
- 포함 신호: insider.*sell, insiders sell, executive.*sold
- 제외 신호: 
- 빠른 판별 질문: 내부자 매도?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T06:00:53 | AON | Insiders At Aon Sold US$26m In Stock, Alluding To Potential Weakness | score=n/a | tag=unclassified
  - 2025-01-01T06:00:50 | F | Ford Motor Insiders Sell US$1.3m Of Stock, Possibly Signalling Caution | score=n/a | tag=unclassified

### 소송·조사·회계 리스크 (`litigation_regulatory_negative`)
- 상위 분류: `short`
- 한 줄 정의: lawsuit, investigation, subpoena, restatement.
- 핵심 가치 경로: 법률 비용·신뢰 훼손
- 포함 신호: lawsuit, investigation, subpoena, restatement
- 제외 신호: settlement removes risk
- 빠른 판별 질문: 소송/조사 핵심?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T16:10:03 | NXT | NEXTRACKER SHAREHOLDER ALERT by Former Louisiana Attorney General: Kahn Swick & Foti, LLC Reminds Investors With Losses in Excess of $100,000 of Lead Plaintiff Deadline in Class Action Lawsuit Against Nextracker Inc. - NXT | score=n/a | tag=unclassified
  - 2025-01-01T06:01:05 | WOLF | WOLF CLASS ACTION FILED: Kessler Topaz Meltzer & Check, LLP Reminds Investors - A Securities Fraud Class Action Lawsuit Has Been Filed Against Wolfspeed, Inc. | score=n/a | tag=unclassified

### 숏커버·매수 유입 (`positioning_flow_positive`)
- 상위 분류: `long`
- 한 줄 정의: short squeeze, fund buying, covering.
- 핵심 가치 경로: 수급 유입→가격 가속
- 포함 신호: short squeeze, fund buying, covering, takes stake
- 제외 신호: buyback
- 빠른 판별 질문: flow 유입 핵심?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T08:00:17 | MELI | We Ran A Stock Scan For Earnings Growth And MercadoLibre (NASDAQ:MELI) Passed With Ease | score=n/a | tag=unclassified
  - 2025-01-01T05:14:47 | VRSN | We Ran A Stock Scan For Earnings Growth And VeriSign (NASDAQ:VRSN) Passed With Ease | score=n/a | tag=unclassified

### 공매도 비율·변동 (`short_interest_update`)
- 상위 분류: `residual`
- 한 줄 정의: short interest changes, heavily shorted.
- 핵심 가치 경로: 공매도 데이터→포지셔닝 힌트
- 포함 신호: short interest, heavily shorted, days to cover
- 제외 신호: 
- 빠른 판별 질문: 공매도 데이터?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T08:30:23 | WEC | Peering Into WEC Energy Group's Recent Short Interest | score=n/a | tag=unclassified
  - 2025-01-01T05:45:12 | GEN | Looking Into Gen Digital's Recent Short Interest | score=n/a | tag=unclassified

### 잡것들_리스트형 screener 노이즈 (`잡것들_screener_listicle_noise`)
- 상위 분류: `residual`
- 한 줄 정의: listicle, penny stocks, meme stocks.
- 핵심 가치 경로: 큐레이션/트래픽 유도
- 포함 신호: best meme stocks, penny stocks, what you need to know
- 제외 신호: 
- 빠른 판별 질문: 리스트형 기사?
- 집계: total=2, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T08:05:04 | FPH | 3 US Penny Stocks With Market Caps Over $100M | score=n/a | tag=unclassified
  - 2025-01-01T04:19:00 | NVDA | Better AI Stock: SoundHound AI vs. Kaltura | score=n/a | tag=unclassified

### 행동주의 투자자 이벤트 (`activist_investor_event`)
- 상위 분류: `long`
- 한 줄 정의: activist investor, activist stake, board fight.
- 핵심 가치 경로: 거버넌스 변화→재평가
- 포함 신호: activist, board fight, proxy fight, starboard
- 제외 신호: 
- 빠른 판별 질문: 행동주의 투자자?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T06:00:05 | COST | Column: Business leaders bow to anti-DEI activists  — except at Costco | score=n/a | tag=unclassified

### 애널리스트 코멘트 증폭(긍정) (`analyst_note_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: formal upgrade 아닌 bullish note 증폭.
- 핵심 가치 경로: note 증폭→sentiment 유입
- 포함 신호: analyst says, bullish note, benefiting from
- 제외 신호: formal upgrade
- 빠른 판별 질문: note 증폭(긍정)?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T01:15:41 | GLW | ‘Look Beyond AI’: JPMorgan Says These 2 Hardware Stocks Are Worth Watching in 2025 | score=n/a | tag=unclassified

### 대형 딜·인프라 투자 (`corporate_deal_billion_positive`)
- 상위 분류: `long`
- 한 줄 정의: multi-billion dollar deals, infrastructure.
- 핵심 가치 경로: 대형 매출·투자→가치 재평가
- 포함 신호: billion deal, multiyear deal, data center, infrastructure
- 제외 신호: 
- 빠른 판별 질문: 대형 계약/투자?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T05:20:00 | AVGO | 2 Top Artificial Intelligence Stocks to Buy in January | score=n/a | tag=unclassified

### 수요 급증·백로그 확대 (`demand_backlog_positive`)
- 상위 분류: `long`
- 한 줄 정의: strong demand, bookings, backlog growth.
- 핵심 가치 경로: 수요 가시성→매출 지속성
- 포함 신호: strong demand, backlog, bookings growth
- 제외 신호: macro commentary
- 빠른 판별 질문: 수요/백로그 직접 언급?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T09:12:00 | BA | The Ultimate Guide to Investing in Boeing for Maximum Returns | score=n/a | tag=unclassified

### 실적 vs 추정치 비교 (`earnings_estimate_comparison`)
- 상위 분류: `residual`
- 한 줄 정의: key metrics vs estimates 비교 기사.
- 핵심 가치 경로: 추정치 대비 비교
- 포함 신호: compared to estimates, key metrics
- 제외 신호: 
- 빠른 판별 질문: 추정치 비교 기사?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T09:15:03 | RPM | Curious about RPM International (RPM) Q2 Performance? Explore Wall Street Estimates for Key Metrics | score=n/a | tag=unclassified

### 실적 발표 전 기대 기사 (`earnings_preview_watch`)
- 상위 분류: `residual`
- 한 줄 정의: 발표 전 preview/expectations 안내 기사.
- 핵심 가치 경로: 기대 형성 단계
- 포함 신호: ahead of earnings, to report results, wall street expects
- 제외 신호: beat, miss
- 빠른 판별 질문: 발표 전 기사?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T05:06:00 | COMP | 10 Stock Market Predictions for 2025 | score=n/a | tag=unclassified

### 실적 요약·평가 기사 (`earnings_summary_assessment`)
- 상위 분류: `residual`
- 한 줄 정의: earnings breakdown/assessment/insights 정리 기사.
- 핵심 가치 경로: 해설 정리
- 포함 신호: earnings breakdown, earnings assessment, earnings insights
- 제외 신호: 
- 빠른 판별 질문: 실적 정리?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T04:02:36 | YETI | Reflecting On Leisure Products Stocks’ Q3 Earnings: YETI (NYSE:YETI) | score=n/a | tag=unclassified

### 멀티종목 movers 기사 (`market_movers_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: 여러 종목 top movers 나열.
- 핵심 가치 경로: 스크리너/요약
- 포함 신호: other big stocks moving, most active stocks, top stocks
- 제외 신호: single-ticker
- 빠른 판별 질문: 멀티종목 roundup?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T09:00:13 | NEE | Investors Heavily Search NextEra Energy Partners, LP (NEP): Here is What You Need to Know | score=n/a | tag=unclassified

### 미디어 증폭·상승 해설 (`media_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: top mover, shares higher, soaring today.
- 핵심 가치 경로: 노출 증폭→추격 수급
- 포함 신호: soaring today, trading higher today, top mover, biggest gainer
- 제외 신호: formal upgrade
- 빠른 판별 질문: 이미 오른 뒤 해설?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T05:39:01 | DDOG | Jim Cramer Says Datadog, Inc. (DDOG) Is A ‘Fabulous’ Company, Stock Soared By 15.6% in November | score=n/a | tag=unclassified

### peer 경쟁 심화 read-through (`peer_competition_negative`)
- 상위 분류: `short`
- 한 줄 정의: rival launch, peer capex, competitive pressure.
- 핵심 가치 경로: 경쟁 심화→share loss 우려
- 포함 신호: rival, competitor, competitive pressure, takes market share
- 제외 신호: same company launch
- 빠른 판별 질문: 경쟁사 행동이 약세 이유?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T06:40:00 | INTC | Intel Has a Lot to Prove in 2025 | score=n/a | tag=unclassified

### 기술적 분석·차트 시그널 (`technical_analysis_signal`)
- 상위 분류: `residual`
- 한 줄 정의: golden cross, moving average, technical pattern.
- 핵심 가치 경로: 기술적 신호→트레이더 관심
- 포함 신호: golden cross, 200-day, moving average, trend barrier, tests key
- 제외 신호: 
- 빠른 판별 질문: 기술적 분석?
- 집계: total=1, impacted=0, max impact=n/a
- 대표 예시:
  - 2025-01-01T22:53:53 | NVDA | Monitor These Nvidia Stock Price Levels After Two Years of Massive Gains | score=n/a | tag=unclassified

## 해석

- v6 taxonomy는 의미없는 정보 계열을 `잡것들_*`로 명시하고, 진짜 미분류 row는 `unknown`으로 남긴다.
- `unknown`은 다음 tranche에서 새 case로 승격할 후보를 모으는 버킷이다.