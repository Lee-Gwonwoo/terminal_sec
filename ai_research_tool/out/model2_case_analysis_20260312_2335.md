# model 2-claude opus 4.6 /version 3/description,ipo date, peers

- 생성 시각: 2026-03-12 23:35 (local)
- 분석 범위: `press_release only` / `2023-01-01 ~ 2025-12-31`
- 전체 뉴스 수: 137,037
- change 기반 분석 가능 뉴스 수: 114,522

## 분석 범위

- source 범위는 `press_release only`로 고정했다.
- 기간 내 `press_release` 전체를 1차 전수 스캔하고, 각 row에 ticker, market cap, industry(securities.industry), ipo_date(company_profiles.ipo_date), change vector를 붙였다.
- 외부 링크는 다시 열지 않고 `news_items`, `news_fulltext`, `news_change_metrics`, `company_profiles`, `securities` 테이블만 사용했다.
- industry 누락 row: 1631건
- `company_profiles.description`은 DB에 51건(3%)만 존재하여 이번 분석에서는 활용하지 못했다. 데이터 보강 후 재분석 시 반영 필요.

## 유형 분류 기준

- 먼저 `title/body/full_text`의 언어적 의미를 기준으로 `long / short / residual` 상위 분류를 정했다.
- 그 다음 반복되는 사건 패턴을 기준으로 세부 `case_type`을 묶었다.
- 의미가 크게 다른 바이오 positive / negative, financing, litigation, earnings, strategic deal 등은 분리했다.
- **industry 기반 분류 보정**: `clinical_regulatory_positive/negative`는 Biotech/Pharma/Medical Device 산업에서만 우선 적용한다.
  - 비(非)임상 산업(Tech, Industrial 등)에서 'approval', 'study', 'trial' 같은 범용 키워드가 잡히면 strong clinical signal(phase 1-4, NDA, BLA, topline, pivotal 등) 없이는 해당 유형으로 분류하지 않고, 차순위 매칭 또는 general_corporate_pr로 귀속시켰다.
- 애매한 표현은 대표 사례와 반례를 비교해 가장 설명력이 높은 유형으로 귀속했다.
- 가격 데이터는 유형 생성 기준이 아니라, 유형별 영향 빈도 평가에만 사용했다.

## 유형별 정의 요약

### long

#### 실적 호조·가이던스 상향 (`earnings_guidance_positive`)
- 상위 분류: `long`
- 한 줄 정의: 실적 호조, 수익성 개선, 가이던스 상향처럼 기업가치 상방 경로를 직접 시사하는 실적성 공지
- 핵심 가치 경로: 실적/전망 개선이 밸류에이션 상향과 추정치 상향으로 연결된다.
- 포함 신호: beat, raises guidance, record revenue, strong outlook
- 제외 신호: 단순 실적 발표이지만 miss 또는 guidance cut인 경우, 실적 언급 없이 일반 홍보만 있는 경우
- 경계 사례: 실적 발표와 계약 공지가 함께 있으면 headline/lead의 중심 사건이 실적인지 먼저 본다.
- 빠른 판별 질문: 실적 beat 또는 guidance raise가 핵심인가? / headline만 읽어도 숫자 개선이 메인 메시지인가?
- 대표 뉴스 id / ticker / title: 4beaa1d7-8d0a-4e73-91c7-4273aaec4243 / INOD / Innodata Reports Record First Quarter 2024 Results; Raises Guidance to at Least 40% Organic Revenue Growth in 2024
- 집계: impacted=113 / total=343, ratio=0.329

#### 임상·규제 성공 (`clinical_regulatory_positive`)
- 상위 분류: `long`
- 한 줄 정의: 임상 성공, 규제 승인, NDA/BLA acceptance처럼 바이오 가치 상방을 직접 시사하는 공지
- 핵심 가치 경로: 개발자산 성공 확률 상승과 상업화 기대 확대로 연결된다.
- 포함 신호: positive topline, approval, FDA acceptance, pivotal data
- 제외 신호: trial 언급이 있어도 실패/미충족인 경우, 연구 개시만 있고 결과가 없는 경우
- 경계 사례: trial/result 단어만으로 분류하지 말고 결과 방향이 positive인지 확인한다.
- 빠른 판별 질문: 결과가 성공/승인/수용인가? / 핵심 자산 가치가 올라가는 메시지인가?
- 대표 뉴스 id / ticker / title: ee57cecc-2dbb-401e-99ab-d5900234c105 / NKTR / Nektar Therapeutics Reports First Quarter 2025 Financial Results
- 집계: impacted=1,438 / total=5,096, ratio=0.282

#### 상업화·시설·사업 확장 (`commercial_launch_expansion`)
- 상위 분류: `long`
- 한 줄 정의: 제품 launch, 시설 확장, 생산/상업화 확대처럼 사업 확장 이벤트가 중심인 공지
- 핵심 가치 경로: 매출 기반 확장과 운영 레버리지 개선 기대에 연결된다.
- 포함 신호: launch, facility, expansion, commercial, production
- 제외 신호: 단순 행사 발표, 기술 소개 수준의 PR
- 경계 사례: 확장 표현이 있어도 실제 사업 확장인지, 홍보성 소개인지 구분한다.
- 빠른 판별 질문: 실제 상업화/생산/시설 확장이 핵심인가? / 운영 규모 확대가 직접 보이는가?
- 대표 뉴스 id / ticker / title: e7e1fd6f-b13f-4c14-87bf-bcdd448e5bc0 / LAES / SEALSQ Advances Toward 2025 Post-Quantum Chip Launch with Quantum-Resistant Platform Testing
- 집계: impacted=3,824 / total=17,745, ratio=0.215

#### 전략 제휴·라이선스·정부지원·대형 계약 (`strategic_deal_policy`)
- 상위 분류: `long`
- 한 줄 정의: 대형 계약, 제휴, 라이선스, 정부지원, 인수 등 외부 자원 결합으로 가치 상방을 시사하는 공지
- 핵심 가치 경로: 수주/파트너십/외부자금 유입이 매출 가시성과 전략 가치를 높인다.
- 포함 신호: partnership, collaboration, license, award, contract, grant
- 제외 신호: 형식적 MOU만 있고 경제 조건이 빈약한 경우, 희석성 financing이 핵심인 경우
- 경계 사례: agreement라는 단어만으로 분류하지 말고 실제 경제적 연결이 있는지 본다.
- 빠른 판별 질문: 외부 계약/제휴/지원이 실질 경제 이벤트인가? / 매출 또는 전략 자산 가치 증가 경로가 보이는가?
- 대표 뉴스 id / ticker / title: 643278e7-acbf-41db-94a5-fb2e34123528 / LAES / SEALSQ and Parent Company WISeKey Advance AI Integration
- 집계: impacted=3,033 / total=16,428, ratio=0.185

#### 상장·직상장·자본시장 구조 이벤트 (`listing_capital_markets`)
- 상위 분류: `long`
- 한 줄 정의: 상장, 업리스트, 거래 재개 등 자본시장 접근성 변화가 핵심인 공지
- 핵심 가치 경로: 유동성 확대와 투자자 접근성 개선으로 연결된다.
- 포함 신호: uplisting, listed on, market debut, trade resumption
- 제외 신호: 상장 유지 실패/비준수 공지, 자금조달 공지가 핵심인 경우
- 경계 사례: listing 관련 기사라도 non-compliance나 delisting risk면 short 쪽을 본다.
- 빠른 판별 질문: 핵심이 거래소 접근성 개선인가? / 자본시장 구조 변화가 중심 사건인가?
- 대표 뉴스 id / ticker / title: f33657f8-613b-4d70-8440-583e3f28ea6a / OWLS / OBOOK Holdings Inc. Announces Successful Direct Listing on Nasdaq
- 집계: impacted=53 / total=260, ratio=0.204

### short

#### 소송·조사·회계 이슈 (`litigation_investigation`)
- 상위 분류: `short`
- 한 줄 정의: 소송, 조사, 회계 문제, fraud allegation처럼 법률/신뢰 리스크를 직접 시사하는 공지
- 핵심 가치 경로: 규제/법률 비용 상승과 사업 불확실성 확대에 연결된다.
- 포함 신호: lawsuit, subpoena, investigation, restatement, fraud
- 제외 신호: 단순 합의 완료 또는 리스크 해소 공지, 일반 법무 업데이트
- 경계 사례: 리스크 해소 기사라면 long 가능성도 다시 본다.
- 빠른 판별 질문: 핵심 메시지가 법적/회계 리스크 발생인가? / 사업보다 조사/소송 자체가 메인인가?
- 대표 뉴스 id / ticker / title: f2966708-3e68-4c9d-8b33-52813819d0c3 / ASTS / SHAREHOLDER DEADLINE: AST SpaceMobile, Inc. (ASTS) Investors Are Reminded of Deadline in Securities Action
- 집계: impacted=315 / total=1,231, ratio=0.256

#### 임상·규제 실패 (`clinical_regulatory_negative`)
- 상위 분류: `short`
- 한 줄 정의: 임상 실패, CRL, endpoint 미충족, 중단 등 바이오 가치 훼손을 직접 시사하는 공지
- 핵심 가치 경로: 핵심 자산 성공 확률 하락과 상업화 지연으로 연결된다.
- 포함 신호: CRL, failed to meet, did not meet, clinical hold, discontinued
- 제외 신호: trial 결과가 positive인 경우, 단순 등록/개시 announcement인 경우
- 경계 사례: 같은 trial 관련 기사라도 결과 방향이 negative일 때만 이 유형이다.
- 빠른 판별 질문: 핵심 endpoint 실패나 규제 setback인가? / 기사 핵심이 개발 리스크 확대인가?
- 대표 뉴스 id / ticker / title: 74789330-b56f-40f0-bdf8-9d9326ce6979 / AUPH / Aurinia Announces LUPKYNIS® (voclosporin) Patent Challenge Settlement Reached With Sun Pharmaceuticals
- 집계: impacted=49 / total=168, ratio=0.292

#### 희석성 자금조달·오퍼링 (`financing_offering`)
- 상위 분류: `short`
- 한 줄 정의: 희석성 자금조달, 공모/사모, warrants, notes offering 등 주주가치 희석 가능성이 큰 공지
- 핵심 가치 경로: 지분 희석 또는 자본비용 증가 우려로 연결된다.
- 포함 신호: public offering, private placement, registered direct, warrant, notes offering
- 제외 신호: 비희석성 grant/contract funding, 단순 refinancing 안내
- 경계 사례: 자금조달이라도 non-dilutive 성격이 강하면 strategic_deal_policy나 residual을 검토한다.
- 빠른 판별 질문: 주식/워런트/전환증권 발행이 핵심인가? / 기존 주주 희석 가능성이 직접 언급되는가?
- 대표 뉴스 id / ticker / title: 395eacf5-bc76-4c9d-87d6-877740cd3ae6 / PVLA / Pieris Pharmaceuticals Announces 1-for-80 Reverse Stock Split 
- 집계: impacted=1,339 / total=6,394, ratio=0.209

#### 실적 부진·가이던스 하향 (`earnings_guidance_negative`)
- 상위 분류: `short`
- 한 줄 정의: 실적 miss, 성장 둔화, 가이던스 하향처럼 펀더멘털 하방을 직접 시사하는 실적성 공지
- 핵심 가치 경로: 추정치 하향과 multiple 압박으로 연결된다.
- 포함 신호: missed, lowered guidance, cuts guidance, weak outlook
- 제외 신호: 실적 발표이지만 beat/record revenue인 경우, 일회성 PR인 경우
- 경계 사례: 실적 발표 자체가 아니라 내용의 방향이 하향인지 본다.
- 빠른 판별 질문: 가이던스 cut 또는 miss가 핵심인가? / 숫자/전망 악화가 headline에 드러나는가?
- 대표 뉴스 id / ticker / title: c4ab2eb9-0ee0-4131-9477-090f8b206a4f / SATS / Boost Mobile Debuts the Ultra-Powerful Celero5G TAB--Its First Boost Mobile-Exclusive Tablet Offering
- 집계: impacted=17 / total=62, ratio=0.274

#### 전략대안·구조조정·생존성 (`strategic_review_restructuring`)
- 상위 분류: `short`
- 한 줄 정의: 구조조정, 생존성 이슈, strategic alternatives, going concern처럼 사업 지속성 리스크를 시사하는 공지
- 핵심 가치 경로: 현금 압박, 생존성 우려, 구조조정 비용 확대에 연결된다.
- 포함 신호: strategic alternatives, restructuring, layoff, going concern, bankruptcy
- 제외 신호: 성장 투자 목적의 조직 개편, 일반 비용 관리 코멘트
- 경계 사례: 효율화 표현이 있어도 생존성 우려가 핵심인지 아닌지 구분한다.
- 빠른 판별 질문: 회사가 버티기/정리 모드에 들어갔다는 신호인가? / 핵심이 성장보다 생존인가?
- 대표 뉴스 id / ticker / title: 9fd33d75-e8d5-447d-879e-de11b266d783 / GSAT / Globalstar Announces Intention to Voluntarily Delist from NYSE American and Transfer to Nasdaq Upon Completion of Reverse Stock Split
- 집계: impacted=63 / total=286, ratio=0.220

### residual

#### 일반 corporate PR (`general_corporate_pr`)
- 상위 분류: `residual`
- 한 줄 정의: 일반 corporate PR, 홍보성 공지, 경계가 흐린 업데이트를 담는 잔여 유형
- 핵심 가치 경로: 직접 경제 이벤트가 약하거나 반복 패턴이 불안정해 residual로 남긴다.
- 포함 신호: appointment, conference participation, certification, general update
- 제외 신호: 실적/계약/오퍼링/임상처럼 명확한 경제 사건이 있는 경우
- 경계 사례: 같은 단어가 있어도 실질 계약, 승인, financing이면 해당 독립 유형으로 보낸다.
- 빠른 판별 질문: 핵심 경제 이벤트가 불분명한가? / 반복성은 있으나 독립 유형으로 설명력이 약한가?
- 대표 뉴스 id / ticker / title: 474c70de-d8fa-49ef-a036-ec57cc8de9a9 / PVLA / Pieris Pharmaceuticals Announces Strategy to Maximize Partnered Milestone and Royalty Potential
- 집계: impacted=12,467 / total=65,407, ratio=0.191

#### 애널리스트 의견·목표가 (`analyst_rating_target`)
- 상위 분류: `residual`
- 한 줄 정의: 애널리스트 rating/target 변화처럼 외부 해석이 중심인 기사
- 핵심 가치 경로: 직접 기업 이벤트보다는 해석/coverage 변화에 따른 수급 반응으로 연결된다.
- 포함 신호: upgrade, downgrade, price target, coverage initiated
- 제외 신호: 회사 자체 PR 본문이 중심인 경우, 실적/계약 등 직접 이벤트가 중심인 경우
- 경계 사례: 회사 이벤트를 인용하더라도 sell-side 의견 변화가 메인이면 이 유형이다.
- 빠른 판별 질문: 기사의 주체가 회사가 아니라 애널리스트인가? / 핵심이 rating/target 변화인가?
- 대표 뉴스 id / ticker / title: 7166e721-7457-4621-8eea-9c18cf7da118 / MFI / Zacks Small-Cap Research Initiates Coverage on mF International Limited
- 집계: impacted=154 / total=761, ratio=0.202

#### 정책·관세·섹터 매크로 (`macro_policy_sector`)
- 상위 분류: `residual`
- 한 줄 정의: 정책, 관세, 금리, 지정학 등 회사 고유 이벤트가 아닌 외부 매크로/섹터 기사
- 핵심 가치 경로: 기업 개별 이슈보다 외부 환경 변화에 따른 재평가로 연결된다.
- 포함 신호: tariff, policy, interest rates, inflation, sanction
- 제외 신호: 회사 개별 계약/실적/임상 공지, 기업 내부 이벤트가 중심인 경우
- 경계 사례: 정책 기사라도 특정 회사 계약/승인이 핵심이면 다른 유형으로 보낸다.
- 빠른 판별 질문: 회사 내부 사건보다 외부 정책/매크로가 중심인가? / 같은 문장을 여러 종목에 붙여도 의미가 통하는가?
- 대표 뉴스 id / ticker / title: 8da194a2-3e55-4870-b299-a2a738dd8ee7 / LEU / Centrus Reports First Quarter 2025 Results
- 집계: impacted=44 / total=341, ratio=0.129

## 영향 판정 기준

- 사용한 전체 change vector: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
- `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`
- `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`
- `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`
- 영향 여부는 같은 market cap bucket 안에서 `overall_impact_score >= p80` 인지로 판정했다.

## market cap bucket 기준

- 주 버킷: `300M~1B`, `1B~10B`, `10B~100B`, `100B~300B`, `300B~`
- 보조 집단: `<300M or Unknown`
- 소형주와 대형주를 같은 절대 변동폭 기준으로 자르면 과대/과소 판정이 생기므로 bucket별 threshold를 분리했다.

## 내부 사고과정 로그(주요 판단 요약)

1. 판단 대상: source 범위
   - 검토한 데이터/패턴: `press_release`, `news`, `company_news`, `market_news`를 섞으면 재서술 기사와 commentary가 늘어나 case 기준이 흐려진다.
   - 최종 결정: 이번 note는 `press_release only`로 고정했다.
   - 결정 이유: issuer-driven 이벤트 위주로 먼저 taxonomy를 만들면 유형별 가격 반응 연결이 더 직접적이다.
   - 대표 근거: 발행사 직접 공지 형식의 PR들이 동일 키워드 반복성과 후행 반응 측면에서 가장 일관적이었다.
2. 판단 대상: 영향 점수 정의
   - 검토한 데이터/패턴: 당일 반응만 보면 지연형 뉴스 효과를 놓치고, 7d~30d만 보면 intraday spike를 놓친다.
   - 최종 결정: immediate / short / medium 3구간 점수를 따로 만들고, 최종값은 `overall_impact_score`로 종합했다.
   - 결정 이유: 같은 PR이라도 당일 급등형, 1~3일 추세형, 1~4주 재평가형이 모두 존재했기 때문이다.
   - 대표 근거 뉴스: 상위 사례 표와 근거 표 파일의 각 row에서 3d, 7d, 14d, 30d 반응 차이를 추적했다.
3. 판단 대상: market cap threshold
   - 검토한 데이터/패턴: 소형주는 같은 PR에도 절대 변동폭이 크고, 대형주는 작은 변동으로도 의미가 생긴다.
   - 최종 결정: `300M~1B`, `1B~10B`, `10B~100B`, `100B~300B`, `300B~` 5단계 주 버킷으로 나눠 각 버킷별 `p80`을 threshold로 사용했다.
   - 결정 이유: 전 뉴스 공통 절대값 컷오프는 소형주 과대판정과 대형주 과소판정을 동시에 만든다.
   - 대표 근거 뉴스: 같은 유형이어도 cap bucket이 다르면 `overall_impact_score` 분포가 다르게 나타났다.
4. 판단 대상: case taxonomy 구성
   - 검토한 데이터/패턴: 임상/규제, financing, earnings, litigation, strategic deal, general PR가 반복적으로 출현했다.
   - 최종 결정: 방향성이 반대인 임상 positive/negative는 분리하고, 의미가 지나치게 넓은 일반 PR은 잔여 범주로 남겼다.
   - 결정 이유: positive/negative를 합치면 case ratio 해석이 왜곡되고, 너무 세분화하면 각 유형의 표본수가 깨진다.
   - 대표 근거 뉴스 id / ticker / title: 각 case의 대표 사례와 반례를 같이 비교해 경계선을 정했다.
5. 판단 대상: 제외 및 보조 집단 처리
   - 검토한 데이터/패턴: `market_cap`이 없거나 `$300M` 미만인 row, change metric이 없는 row가 일부 존재한다.
   - 최종 결정: `<300M or Unknown`은 보조 집단으로 분리하고, change metric이 없는 row는 비율 계산에서 제외했다.
   - 결정 이유: 동일 bucket 분포 기준이 무너지면 threshold와 ratio 해석이 불안정해진다.
   - 대표 근거: 데이터 가용성 표와 bucket별 threshold 표에서 보조 집단의 밀도 차이가 확인된다.

## 근거 표 파일

- 근거 표 파일 경로: `ai_research_tool\model_2_source\model 2-claude opus 4.6 version 3description,ipo date, peers.md`
- 이 파일은 현재 note와 같은 제목 기준으로 만든 전체 근거 뉴스 표다.
- 각 행에는 case_type, reaction_tag, news_id, ticker, market_cap, 전체 change window, 구간 점수, overall score를 기록했다.

## 데이터 가용성

- press_release: total=137,037, with_change=114,522, with_fulltext=53,688

## 영향 판정 기준

- 사용한 전체 change 컬럼: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- `overall_impact_score`는 immediate / short / medium 3개 구간 점수 중 최대값으로 계산했다.
- 방향성은 절대값이 가장 큰 change 컬럼의 부호로 결정했다.
- 같은 이슈라도 시총이 크면 변동폭이 줄 수 있으므로, 버킷별 p80 임계값을 따로 사용했다.

## market cap bucket별 impact 기준

- $300M~1B: total=24,404, with_change=9,734, p50=16.84, p80=30.85, p90=43.03
- $1B~10B: total=57,392, with_change=53,898, p50=12.27, p80=23.06, p90=32.60
- $10B~100B: total=40,152, with_change=39,867, p50=7.71, p80=14.56, p90=20.45
- $100B~300B: total=10,064, with_change=8,366, p50=6.62, p80=11.47, p90=15.03
- $300B~: total=3,383, with_change=1,385, p50=8.38, p80=15.37, p90=20.10
- <$300M or Unknown: total=1,642, with_change=1,272, p50=10.99, p80=20.59, p90=28.18

## 전체 유형 분류 결과

### long 그룹

#### long-1. 실적 호조·가이던스 상향
- 설명: beat, raises guidance, strong outlook, record revenue 등 실적성 호재
- 총 건수: 343
- 영향 미침: 113
- 영향 안 미침: 230
- 영향 비율: 0.329
- 보수적 순위 점수(Wilson LB): 0.282
- 방향 분해: positive 80 / negative 33
- median impact score: 13.23
- market cap breakdown: {"$1B~10B": {"total": 178, "impacted": 56}, "$10B~100B": {"total": 90, "impacted": 33}, "$100B~300B": {"total": 40, "impacted": 13}, "$300M~1B": {"total": 28, "impacted": 9}, "$300B~": {"total": 7, "impacted": 2}}
- source breakdown: {"press_release": {"total": 343, "impacted": 113}}
- industry group breakdown: {"Technology": {"total": 118, "impacted": 46}, "Industrial": {"total": 30, "impacted": 13}, "Other": {"total": 75, "impacted": 19}, "Utilities": {"total": 28, "impacted": 11}, "Energy/Mining": {"total": 25, "impacted": 8}, "Biotech/Pharma/MedDev": {"total": 41, "impacted": 12}, "Materials/Auto": {"total": 21, "impacted": 2}, "Financial": {"total": 5, "impacted": 2}}
- 대표 사례:
  - 4beaa1d7-8d0a-4e73-91c7-4273aaec4243 | 2024-05-07 16:20:00 | press_release | INOD | Information Technology Services | Innodata Reports Record First Quarter 2024 Results; Raises Guidance to at Least 40% Organic Revenue Growth in 2024 | change=0.0 | change_1d=55.3412 | change_3d=59.9407 | change_7d=63.7982 | intraday=-0.2959 | tag=multi_window_impact | cap=$1B~10B
  - b0d48140-0218-4576-b6a1-67f5eea66fd8 | 2024-03-26 16:15:00 | press_release | OUST | Electronic Components | Ouster Announces Record Revenue for Fourth Quarter and Full Year 2023 | change=-0.2004 | change_1d=34.2685 | change_3d=97.5952 | change_7d=100.4008 | intraday=-1.581 | tag=multi_window_impact | cap=$1B~10B
  - 5e90a3aa-cd55-4b23-aa71-c22a5603258b | 2023-05-03 16:03:00 | press_release | CFLT | Software - Infrastructure | Confluent Announces First Quarter 2023 Financial Results | change=-2.6341 | change_1d=13.1707 | change_3d=10.6341 | change_7d=12.9756 | intraday=-1.7233 | tag=sustained_repricing | cap=$10B~100B
- 반례/영향 약한 사례:
  - 2bfd497d-93f8-46ee-9d63-3f21abe87c0f | 2023-08-31 09:00:00 | press_release | ALRM | Software - Application | Arizona residents get paid to beat the heat | change=-0.3742 | change_1d=1.1567 | change_3d=-0.6974 | change_7d=-0.2892 | intraday=-0.2045 | tag=low_signal | cap=$1B~10B
  - 808d3738-3a14-4844-a0ff-3141a16b9794 | 2024-11-04 21:45:00 | press_release | GROY | Gold | GOLD ROYALTY REPORTS THIRD QUARTER 2024 RESULTS; RECORD REVENUE FOR THE FIRST NINE MONTHS OF 2024 | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=-1.3986 | tag=low_signal | cap=$300M~1B

#### long-2. 임상·규제 성공
- 설명: positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재
- 총 건수: 5,096
- 영향 미침: 1,438
- 영향 안 미침: 3,658
- 영향 비율: 0.282
- 보수적 순위 점수(Wilson LB): 0.270
- 방향 분해: positive 956 / negative 482
- median impact score: 13.30
- market cap breakdown: {"$10B~100B": {"total": 1011, "impacted": 249}, "$1B~10B": {"total": 2677, "impacted": 858}, "$300M~1B": {"total": 736, "impacted": 213}, "$100B~300B": {"total": 469, "impacted": 69}, "$300B~": {"total": 130, "impacted": 10}, "<$300M or Unknown": {"total": 73, "impacted": 39}}
- source breakdown: {"press_release": {"total": 5096, "impacted": 1438}}
- industry group breakdown: {"Biotech/Pharma/MedDev": {"total": 4723, "impacted": 1322}, "Technology": {"total": 105, "impacted": 23}, "Industrial": {"total": 58, "impacted": 18}, "Energy/Mining": {"total": 18, "impacted": 11}, "Other": {"total": 73, "impacted": 17}, "Unknown": {"total": 73, "impacted": 39}, "Materials/Auto": {"total": 12, "impacted": 0}, "Financial": {"total": 19, "impacted": 5}, "Utilities": {"total": 15, "impacted": 3}}
- 대표 사례:
  - ee57cecc-2dbb-401e-99ab-d5900234c105 | 2025-05-08 16:15:00 | press_release | NKTR | Biotechnology | Nektar Therapeutics Reports First Quarter 2025 Financial Results | change=1.6393 | change_1d=-3.2787 | change_3d=16.3934 | change_7d=11.4754 | intraday=1.6393 | tag=sustained_repricing | cap=$1B~10B
  - dbe91179-2c25-42ce-9775-1c6996cc78f3 | 2023-11-28 07:00:00 | press_release | PRAX | Biotechnology | Praxis Precision Medicines to Showcase Largest Pipeline of Precision Epilepsy Programs and Breadth of Commitment to Epilepsy Treatments at Upcoming Meetings | change=-9.0909 | change_1d=1340.4959 | change_3d=1351.2397 | change_7d=1361.157 | intraday=-5.9829 | tag=multi_window_impact | cap=$1B~10B
  - e8a5c278-fa47-417d-af32-64139a38e7dc | 2024-08-29 16:50:00 | press_release | ORKA | Biotechnology | ARCA biopharma Announces Completion of Merger with Oruka Therapeutics and Implementation of Reverse Stock Split | change=-28.3668 | change_1d=-31.2321 | change_3d=702.0057 | change_7d=616.0458 | intraday=32.2751 | tag=multi_window_impact | cap=$1B~10B
- 반례/영향 약한 사례:
  - 68c0525c-bfbd-4aa9-beb0-c55e7cfba38d | 2025-10-06 16:15:00 | press_release | GTLS | Specialty Industrial Machinery | Chart Industries Selected to Supply Air-Cooled Heat Exchangers and Cold Boxes for Sempra Infrastructure’s Port Arthur LNG Phase 2 Project | change=-0.314 | change_1d=-0.2293 | change_3d=-0.1844 | change_7d=-0.2891 | intraday=-0.3538 | tag=low_signal | cap=$1B~10B
  - 24368d78-c612-4178-822a-1d1c572e2601 | 2024-09-24 16:00:00 | press_release | AMGN | Drug Manufacturers - General | TEPEZZA® (TEPROTUMUMAB) RECEIVES APPROVAL IN JAPAN FOR THE TREATMENT OF ACTIVE THYROID EYE DISEASE | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=-0.6694 | tag=low_signal | cap=$100B~300B

#### long-3. 상업화·시설·사업 확장
- 설명: launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트
- 총 건수: 17,745
- 영향 미침: 3,824
- 영향 안 미침: 13,921
- 영향 비율: 0.215
- 보수적 순위 점수(Wilson LB): 0.210
- 방향 분해: positive 2,545 / negative 1,279
- median impact score: 10.61
- market cap breakdown: {"$1B~10B": {"total": 8601, "impacted": 1826}, "$300M~1B": {"total": 1487, "impacted": 272}, "$10B~100B": {"total": 6037, "impacted": 1407}, "$100B~300B": {"total": 1204, "impacted": 233}, "<$300M or Unknown": {"total": 216, "impacted": 38}, "$300B~": {"total": 200, "impacted": 48}}
- source breakdown: {"press_release": {"total": 17745, "impacted": 3824}}
- industry group breakdown: {"Energy/Mining": {"total": 668, "impacted": 229}, "Other": {"total": 4076, "impacted": 854}, "Biotech/Pharma/MedDev": {"total": 3031, "impacted": 615}, "Technology": {"total": 4614, "impacted": 1050}, "Materials/Auto": {"total": 1138, "impacted": 191}, "Financial": {"total": 1052, "impacted": 230}, "Utilities": {"total": 921, "impacted": 158}, "Industrial": {"total": 2029, "impacted": 459}, "Unknown": {"total": 216, "impacted": 38}}
- 대표 사례:
  - e7e1fd6f-b13f-4c14-87bf-bcdd448e5bc0 | 2024-11-26 09:45:00 | press_release | LAES | Semiconductors | SEALSQ Advances Toward 2025 Post-Quantum Chip Launch with Quantum-Resistant Platform Testing | change=-4.2553 | change_1d=-12.766 | change_3d=0.0 | change_7d=-17.0213 | intraday=-10.0 | tag=sustained_repricing | cap=$300M~1B
  - bbba9c18-b494-477c-97f9-974600e1ff8a | 2024-12-03 09:56:00 | press_release | LAES | Semiconductors | SEALSQ Introduces INeS PKI: The Future-Proof IoT Security Solution with Quantum-Resistant Technology | change=-12.766 | change_1d=-17.0213 | change_3d=-14.8936 | change_7d=21.2766 | intraday=-10.8696 | tag=sustained_repricing | cap=$300M~1B
  - fa425c03-8797-4339-ac68-d251443f7e82 | 2024-12-05 09:15:00 | press_release | LAES | Semiconductors | SEALSQ Unveils INeS Box to Simplify Digital Identity Provisioning in Manufacturing | change=0.0 | change_1d=2.5641 | change_3d=46.1538 | change_7d=374.359 | intraday=0.0 | tag=multi_window_impact | cap=$300M~1B
- 반례/영향 약한 사례:
  - cb9f95f9-55e6-40a7-9165-38b5ced7cb55 | 2024-05-29 10:35:00 | press_release | WSO.B | Building products | Watsco to Present at William Blair’s 44th Annual Growth Stock Conference in Chicago on June 4, 2024 at 3:20 p.m. CDT | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$10B~100B
  - 6b860cd5-6628-447f-b696-7f0581affc60 | 2024-09-24 09:00:00 | press_release | ORCL | Software - Infrastructure | Community, Critical Access Hospitals Select Oracle Health CommunityWorks to Enhance Clinical and Financial Operations | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=0.0362 | tag=low_signal | cap=$300B~

#### long-4. 전략 제휴·라이선스·정부지원·대형 계약
- 설명: partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈
- 총 건수: 16,428
- 영향 미침: 3,033
- 영향 안 미침: 13,395
- 영향 비율: 0.185
- 보수적 순위 점수(Wilson LB): 0.179
- 방향 분해: positive 1,966 / negative 1,067
- median impact score: 9.46
- market cap breakdown: {"$1B~10B": {"total": 7272, "impacted": 1295}, "$300M~1B": {"total": 1226, "impacted": 259}, "$10B~100B": {"total": 6125, "impacted": 1130}, "$100B~300B": {"total": 1437, "impacted": 283}, "$300B~": {"total": 247, "impacted": 50}, "<$300M or Unknown": {"total": 121, "impacted": 16}}
- source breakdown: {"press_release": {"total": 16428, "impacted": 3033}}
- industry group breakdown: {"Industrial": {"total": 2273, "impacted": 499}, "Technology": {"total": 4887, "impacted": 917}, "Utilities": {"total": 1094, "impacted": 181}, "Materials/Auto": {"total": 904, "impacted": 134}, "Biotech/Pharma/MedDev": {"total": 2343, "impacted": 430}, "Other": {"total": 3477, "impacted": 604}, "Energy/Mining": {"total": 468, "impacted": 125}, "Financial": {"total": 861, "impacted": 127}, "Unknown": {"total": 121, "impacted": 16}}
- 대표 사례:
  - 643278e7-acbf-41db-94a5-fb2e34123528 | 2024-11-29 11:02:00 | press_release | LAES | Semiconductors | SEALSQ and Parent Company WISeKey Advance AI Integration | change=0.0 | change_1d=14.6341 | change_3d=-4.878 | change_7d=-2.439 | intraday=-4.6512 | tag=sustained_repricing | cap=$300M~1B
  - c671cf30-ff16-4aef-a7fa-a2536eddba15 | 2025-02-10 06:30:00 | press_release | GSAT | Telecom Services | MDA SPACE SIGNS $1.1B CONTRACT WITH GLOBALSTAR TO BUILD NEXT GENERATION LEO CONSTELLATION | change=3.3113 | change_1d=1511.2583 | change_3d=1363.5762 | change_7d=1376.1589 | intraday=1.2987 | tag=multi_window_impact | cap=$1B~10B
  - a7f0bb87-5226-48ed-b4dc-ecb6df1e6e0b | 2024-12-10 08:00:00 | press_release | LAES | Semiconductors | SEALSQ Joins Forces with IC’ALPS To Accelerate Secure ASICs Development | change=46.1538 | change_1d=194.8718 | change_3d=348.7179 | change_7d=664.1026 | intraday=39.0244 | tag=multi_window_impact | cap=$300M~1B
- 반례/영향 약한 사례:
  - 5c749a9a-f20c-4580-88af-2a5270bdc22e | 2025-10-22 10:33:00 | press_release | EA | Electronic Gaming & Multimedia | EA SPORTS and The NFL Expand Partnership to Power the Future of Interactive Football | change=0.0997 | change_1d=0.0349 | change_3d=-0.0249 | change_7d=-0.1745 | intraday=0.1447 | tag=low_signal | cap=$10B~100B
  - fffc19dd-471a-42f6-b3eb-3da3c7f2a50a | 2025-10-07 11:00:00 | press_release | EA | Electronic Gaming & Multimedia | EA SPORTS and The Athletic Team up to Engage Next Generation Sports Fans | change=-0.2195 | change_1d=-0.2245 | change_3d=-0.2195 | change_7d=-0.1297 | intraday=-0.1896 | tag=low_signal | cap=$10B~100B

#### long-5. 상장·직상장·자본시장 구조 이벤트
- 설명: direct listing, uplisting, Nasdaq listing, market debut 같은 상장 구조 이벤트
- 총 건수: 260
- 영향 미침: 53
- 영향 안 미침: 207
- 영향 비율: 0.204
- 보수적 순위 점수(Wilson LB): 0.159
- 방향 분해: positive 35 / negative 18
- median impact score: 8.77
- market cap breakdown: {"$10B~100B": {"total": 95, "impacted": 18}, "$300M~1B": {"total": 32, "impacted": 8}, "$1B~10B": {"total": 120, "impacted": 21}, "$100B~300B": {"total": 13, "impacted": 6}}
- source breakdown: {"press_release": {"total": 260, "impacted": 53}}
- industry group breakdown: {"Financial": {"total": 30, "impacted": 1}, "Other": {"total": 50, "impacted": 11}, "Industrial": {"total": 80, "impacted": 22}, "Energy/Mining": {"total": 30, "impacted": 13}, "Technology": {"total": 28, "impacted": 6}, "Biotech/Pharma/MedDev": {"total": 33, "impacted": 0}, "Materials/Auto": {"total": 2, "impacted": 0}, "Utilities": {"total": 7, "impacted": 0}}
- 대표 사례:
  - f33657f8-613b-4d70-8440-583e3f28ea6a | 2025-10-17 08:59:00 | press_release | OWLS | Software - Infrastructure | OBOOK Holdings Inc. Announces Successful Direct Listing on Nasdaq | change=-28.8929 | change_1d=-48.1548 | change_3d=-82.8623 | change_7d=-77.3177 | intraday=12.8571 | tag=multi_window_impact | cap=$300M~1B
  - a537cb48-2782-4511-b0b2-d9f098c70d9b | 2025-10-21 17:45:00 | press_release | OWLS | Software - Infrastructure | D. Boral Capital Acted as Exclusive Financial Advisor to OBOOK Holdings Inc. (Nasdaq:OWLS) in Connection with its Direct Listing | change=-32.2917 | change_1d=-66.9444 | change_3d=-56.25 | change_7d=-61.4931 | intraday=-31.4587 | tag=multi_window_impact | cap=$300M~1B
  - 0dc3b3d4-f7f4-4e15-aa71-b3952990b164 | 2025-10-14 11:01:00 | press_release | TMQ | Other Industrial Metals & Mining | Canadian Investment Regulatory Organization Trade Resumption - TMQ | change=61.5854 | change_1d=28.9634 | change_3d=-1.5244 | change_7d=-15.2439 | intraday=32.5 | tag=multi_window_impact | cap=$300M~1B
- 반례/영향 약한 사례:
  - 1273b893-595a-4958-8417-89641c138d48 | 2025-09-03 07:59:00 | press_release | ARIS | Gold | Canadian Investment Regulatory Organization Trading Halt - ARIS | change=-1.0399 | change_1d=-0.0416 | change_3d=-1.0399 | change_7d=0.3744 | intraday=-0.875 | tag=low_signal | cap=$1B~10B
  - 443b760b-5bc7-459e-bce3-a8ca175ef75f | 2025-09-03 08:48:00 | press_release | ARIS | Gold | Canadian Investment Regulatory Organization Trade Resumption - ARIS | change=-1.0399 | change_1d=-0.0416 | change_3d=-1.0399 | change_7d=0.3744 | intraday=-0.875 | tag=low_signal | cap=$1B~10B

### short 그룹

#### short-1. 소송·조사·회계 이슈
- 설명: lawsuit, subpoena, investigation, restatement, fraud allegation 등 법률/회계 리스크
- 총 건수: 1,231
- 영향 미침: 315
- 영향 안 미침: 916
- 영향 비율: 0.256
- 보수적 순위 점수(Wilson LB): 0.232
- 방향 분해: positive 195 / negative 120
- median impact score: 12.05
- market cap breakdown: {"$100B~300B": {"total": 37, "impacted": 8}, "$10B~100B": {"total": 384, "impacted": 128}, "$300M~1B": {"total": 155, "impacted": 25}, "$1B~10B": {"total": 636, "impacted": 150}, "<$300M or Unknown": {"total": 8, "impacted": 0}, "$300B~": {"total": 11, "impacted": 4}}
- source breakdown: {"press_release": {"total": 1231, "impacted": 315}}
- industry group breakdown: {"Technology": {"total": 368, "impacted": 69}, "Biotech/Pharma/MedDev": {"total": 377, "impacted": 84}, "Other": {"total": 218, "impacted": 103}, "Energy/Mining": {"total": 23, "impacted": 3}, "Industrial": {"total": 68, "impacted": 22}, "Materials/Auto": {"total": 70, "impacted": 9}, "Unknown": {"total": 8, "impacted": 0}, "Financial": {"total": 41, "impacted": 20}, "Utilities": {"total": 58, "impacted": 5}}
- 대표 사례:
  - f2966708-3e68-4c9d-8b33-52813819d0c3 | 2024-05-15 12:36:00 | press_release | ASTS | Communication Equipment | SHAREHOLDER DEADLINE: AST SpaceMobile, Inc. (ASTS) Investors Are Reminded of Deadline in Securities Action | change=-4.7809 | change_1d=60.5578 | change_3d=110.3586 | change_7d=85.4582 | intraday=-8.0769 | tag=multi_window_impact | cap=$10B~100B
  - ff49a9ff-9ab2-45ce-abd4-f1459426a007 | 2024-05-15 12:36:00 | press_release | ASTS | Communication Equipment | SHAREHOLDER DEADLINE: AST SpaceMobile, Inc. (ASTS) Investors Are Reminded of Deadline in Securities Action | change=-4.7809 | change_1d=60.5578 | change_3d=110.3586 | change_7d=85.4582 | intraday=-8.0769 | tag=multi_window_impact | cap=$10B~100B
  - 1b693bc7-700c-4de9-a6c9-3545251db6ab | 2024-05-13 09:37:00 | press_release | ASTS | Communication Equipment | ATTENTION AST SpaceMobile (ASTS) Shareholders: Securities Fraud Lawsuit Filed Against AST SpaceMobile (ASTS) | change=-0.885 | change_1d=11.0619 | change_3d=78.3186 | change_7d=133.6283 | intraday=-2.1834 | tag=multi_window_impact | cap=$10B~100B
- 반례/영향 약한 사례:
  - 45f88636-11f1-48b5-a413-e06f0bb30990 | 2025-06-17 08:00:00 | press_release | FIS | Information Technology Services | FIS Recognized as Top Provider for Chargeback Management Capabilities by Juniper Research | change=-0.6177 | change_1d=-0.6177 | change_3d=-0.5436 | change_7d=-0.2595 | intraday=-0.4209 | tag=low_signal | cap=$10B~100B
  - 762b4407-7f66-4003-8ce6-cb41821c4545 | 2023-06-12 09:20:00 | press_release | NEE | Utilities - Regulated Electric | NextEra Energy Shareholders: 7/25/2023 Plaintiff Filing Deadline in Securities Class Action – Contact Lieff Cabraser | change=-0.1215 | change_1d=0.378 | change_3d=0.3915 | change_7d=0.9316 | intraday=-0.5779 | tag=low_signal | cap=$100B~300B

#### short-2. 임상·규제 실패
- 설명: 임상 실패, CRL, 주요 endpoint 미충족, hold·중단 등 바이오 규제/임상 악재
- 총 건수: 168
- 영향 미침: 49
- 영향 안 미침: 119
- 영향 비율: 0.292
- 보수적 순위 점수(Wilson LB): 0.228
- 방향 분해: positive 19 / negative 30
- median impact score: 14.33
- market cap breakdown: {"$1B~10B": {"total": 71, "impacted": 29}, "$300M~1B": {"total": 30, "impacted": 11}, "$100B~300B": {"total": 24, "impacted": 3}, "$10B~100B": {"total": 36, "impacted": 5}, "$300B~": {"total": 3, "impacted": 1}, "<$300M or Unknown": {"total": 4, "impacted": 0}}
- source breakdown: {"press_release": {"total": 168, "impacted": 49}}
- industry group breakdown: {"Biotech/Pharma/MedDev": {"total": 162, "impacted": 49}, "Unknown": {"total": 4, "impacted": 0}, "Other": {"total": 1, "impacted": 0}, "Utilities": {"total": 1, "impacted": 0}}
- 대표 사례:
  - 74789330-b56f-40f0-bdf8-9d9326ce6979 | 2023-01-03 09:12:00 | press_release | AUPH | Biotechnology | Aurinia Announces LUPKYNIS® (voclosporin) Patent Challenge Settlement Reached With Sun Pharmaceuticals | change=37.5 | change_1d=55.5556 | change_3d=74.7685 | change_7d=79.1667 | intraday=5.3191 | tag=multi_window_impact | cap=$1B~10B
  - 52dd3226-e07d-4385-9a7b-a5ac77eac5d8 | 2025-12-11 07:00:00 | press_release | RZLT | Biotechnology | Rezolute Announces Phase 3 sunRIZE Study Results in Congenital Hyperinsulinism | change=-87.2029 | change_1d=-83.5466 | change_3d=-81.5356 | change_7d=-83.0896 | intraday=13.8211 | tag=multi_window_impact | cap=$300M~1B
  - 9cadaa29-9c97-4ab8-b75c-18ac1dab9213 | 2024-03-08 07:00:00 | press_release | AMLX | Drug Manufacturers - Specialty & Generic | Amylyx Pharmaceuticals Announces Topline Results From Global Phase 3 PHOENIX Trial of AMX0035 in ALS | change=-82.2878 | change_1d=-79.9684 | change_3d=-81.8661 | change_7d=-82.9204 | intraday=12.3746 | tag=multi_window_impact | cap=$1B~10B
- 반례/영향 약한 사례:
  - 529e6725-7aa4-4898-a68d-a44b187207fb | 2025-10-02 09:00:00 | press_release | AMGN | Drug Manufacturers - General | LANDMARK PHASE 3 TRIAL (VESALIUS-CV) MEETS PRIMARY ENDPOINTS IN A CARDIOVASCULAR PRIMARY PREVENTION STUDY OF 12,000 PATIENTS | change=-0.3685 | change_1d=-0.2044 | change_3d=-0.9916 | change_7d=-1.0285 | intraday=-0.3051 | tag=low_signal | cap=$100B~300B
  - 10376199-d0ec-4e44-a719-d8eb4d65ccd8 | 2023-08-21 08:30:00 | press_release | GILD | Drug Manufacturers - General | Gilead Announces Partial Clinical Hold for Magrolimab Studies in AML | change=0.0791 | change_1d=0.6194 | change_3d=0.593 | change_7d=1.5287 | intraday=0.3568 | tag=low_signal | cap=$100B~300B

#### short-3. 희석성 자금조달·오퍼링
- 설명: public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈
- 총 건수: 6,394
- 영향 미침: 1,339
- 영향 안 미침: 5,055
- 영향 비율: 0.209
- 보수적 순위 점수(Wilson LB): 0.200
- 방향 분해: positive 880 / negative 459
- median impact score: 10.48
- market cap breakdown: {"$100B~300B": {"total": 341, "impacted": 81}, "$1B~10B": {"total": 3465, "impacted": 745}, "$300M~1B": {"total": 580, "impacted": 133}, "$10B~100B": {"total": 1888, "impacted": 364}, "<$300M or Unknown": {"total": 83, "impacted": 11}, "$300B~": {"total": 37, "impacted": 5}}
- source breakdown: {"press_release": {"total": 6394, "impacted": 1339}}
- industry group breakdown: {"Industrial": {"total": 694, "impacted": 156}, "Materials/Auto": {"total": 445, "impacted": 50}, "Biotech/Pharma/MedDev": {"total": 1944, "impacted": 477}, "Other": {"total": 1243, "impacted": 220}, "Technology": {"total": 781, "impacted": 193}, "Financial": {"total": 277, "impacted": 56}, "Energy/Mining": {"total": 239, "impacted": 78}, "Utilities": {"total": 688, "impacted": 98}, "Unknown": {"total": 83, "impacted": 11}}
- 대표 사례:
  - 395eacf5-bc76-4c9d-87d6-877740cd3ae6 | 2024-04-19 12:10:00 | press_release | PVLA | Biotechnology | Pieris Pharmaceuticals Announces 1-for-80 Reverse Stock Split  | change=-6.4516 | change_1d=-5.8065 | change_3d=7596.7742 | change_7d=7461.2903 | intraday=-5.8442 | tag=multi_window_impact | cap=$1B~10B
  - 5ac30f25-eea9-49b1-9cee-3f6714ad0a34 | 2023-05-03 13:06:00 | press_release | WGS | Diagnostics & Research | GeneDx Announces Clarification Regarding CUSIP Number for Public Warrant Holders | change=0.0 | change_1d=3054.4715 | change_3d=3497.561 | change_7d=3213.0081 | intraday=0.0 | tag=multi_window_impact | cap=$1B~10B
  - f0ded51c-8101-48ec-8f18-81cc45fd5714 | 2024-08-28 09:00:00 | press_release | GLTO | Biotechnology | Galecto Announces Reverse Stock Split | change=-6.6427 | change_1d=-12.9264 | change_3d=1892.8187 | change_7d=1963.5548 | intraday=1.7613 | tag=multi_window_impact | cap=$1B~10B
- 반례/영향 약한 사례:
  - 4e48048b-cbf4-4775-b5f8-6d1c7f045d8c | 2023-09-18 18:09:00 | press_release | CART | Internet Retail | Instacart Announces Pricing of Initial Public Offering | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=0.0 | tag=low_signal | cap=$1B~10B
  - 70648be0-44a1-4b60-8fc8-f1c54bb09460 | 2025-12-10 18:01:00 | press_release | LMRI | Medical Devices | Lumexa Imaging Announces Pricing of Initial Public Offering | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=0.0 | tag=low_signal | cap=$1B~10B

#### short-4. 실적 부진·가이던스 하향
- 설명: miss, lower guidance, weak outlook, revenue decline 등 실적성 악재
- 총 건수: 62
- 영향 미침: 17
- 영향 안 미침: 45
- 영향 비율: 0.274
- 보수적 순위 점수(Wilson LB): 0.179
- 방향 분해: positive 13 / negative 4
- median impact score: 8.13
- market cap breakdown: {"$10B~100B": {"total": 33, "impacted": 8}, "$1B~10B": {"total": 16, "impacted": 5}, "$100B~300B": {"total": 8, "impacted": 2}, "$300M~1B": {"total": 3, "impacted": 1}, "$300B~": {"total": 2, "impacted": 1}}
- source breakdown: {"press_release": {"total": 62, "impacted": 17}}
- industry group breakdown: {"Financial": {"total": 5, "impacted": 0}, "Other": {"total": 24, "impacted": 8}, "Technology": {"total": 13, "impacted": 5}, "Biotech/Pharma/MedDev": {"total": 7, "impacted": 0}, "Industrial": {"total": 9, "impacted": 3}, "Materials/Auto": {"total": 3, "impacted": 1}, "Utilities": {"total": 1, "impacted": 0}}
- 대표 사례:
  - c4ab2eb9-0ee0-4131-9477-090f8b206a4f | 2025-06-04 08:05:00 | press_release | SATS | Telecom Services | Boost Mobile Debuts the Ultra-Powerful Celero5G TAB--Its First Boost Mobile-Exclusive Tablet Offering | change=0.3096 | change_1d=17.8328 | change_3d=-0.9907 | change_7d=6.935 | intraday=0.434 | tag=multi_window_impact | cap=$10B~100B
  - 707e2d24-94eb-4c49-a35b-0959b4f9cd81 | 2023-07-27 17:45:00 | press_release | NEXA | Other Industrial Metals & Mining | Nexa Reports Second Quarter 2023 Results including Adjusted EBITDA of US$72 Million | change=7.2261 | change_1d=12.5874 | change_3d=15.1515 | change_7d=17.2494 | intraday=6.9767 | tag=sustained_repricing | cap=$1B~10B
  - 4f2578a3-36a6-4352-b831-13ef68048f33 | 2024-10-30 08:45:00 | press_release | TSLA | Auto Manufacturers | What Opportunities Could The Disruptive Pace Of Technology Today Present? Hear From Cathie Wood At Crossroads Summit On Cutting Through The Chaos | change=-0.7591 | change_1d=-3.7261 | change_3d=-6.4273 | change_7d=11.1783 | intraday=-0.1667 | tag=sustained_repricing | cap=$300B~
- 반례/영향 약한 사례:
  - e0e252f6-4e26-49a9-9b3a-bc1cfd9ac3f2 | 2025-10-06 11:40:00 | press_release | EA | Electronic Gaming & Multimedia | EA SPORTS™ NHL® 26 and Prime Video Collaborate to Deliver Special Season-Launch Content | change=-0.1146 | change_1d=-0.3338 | change_3d=-0.3189 | change_7d=-0.1993 | intraday=-0.1046 | tag=low_signal | cap=$10B~100B
  - 9685abbe-a128-45be-833e-b536deae0a74 | 2024-03-20 16:30:00 | press_release | EPAC | Specialty Industrial Machinery | Enerpac Tool Group Reports Second Quarter Fiscal 2024 Results and Affirms Full-Year Guidance | change=1.2399 | change_1d=0.2595 | change_3d=1.6436 | change_7d=2.3356 | intraday=1.036 | tag=low_signal | cap=$1B~10B

#### short-5. 전략대안·구조조정·생존성
- 설명: strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈
- 총 건수: 286
- 영향 미침: 63
- 영향 안 미침: 223
- 영향 비율: 0.220
- 보수적 순위 점수(Wilson LB): 0.176
- 방향 분해: positive 48 / negative 15
- median impact score: 10.62
- market cap breakdown: {"$1B~10B": {"total": 126, "impacted": 28}, "$10B~100B": {"total": 110, "impacted": 18}, "$100B~300B": {"total": 22, "impacted": 7}, "$300M~1B": {"total": 23, "impacted": 9}, "<$300M or Unknown": {"total": 4, "impacted": 1}, "$300B~": {"total": 1, "impacted": 0}}
- source breakdown: {"press_release": {"total": 286, "impacted": 63}}
- industry group breakdown: {"Biotech/Pharma/MedDev": {"total": 37, "impacted": 11}, "Financial": {"total": 61, "impacted": 10}, "Materials/Auto": {"total": 29, "impacted": 3}, "Technology": {"total": 43, "impacted": 10}, "Industrial": {"total": 24, "impacted": 8}, "Other": {"total": 72, "impacted": 15}, "Unknown": {"total": 4, "impacted": 1}, "Utilities": {"total": 10, "impacted": 2}, "Energy/Mining": {"total": 6, "impacted": 3}}
- 대표 사례:
  - 9fd33d75-e8d5-447d-879e-de11b266d783 | 2025-01-21 17:50:00 | press_release | GSAT | Telecom Services | Globalstar Announces Intention to Voluntarily Delist from NYSE American and Transfer to Nasdaq Upon Completion of Reverse Stock Split | change=4.2328 | change_1d=2.6455 | change_3d=4.7619 | change_7d=1.0582 | intraday=3.6842 | tag=sustained_repricing | cap=$1B~10B
  - 975c4eca-5a5b-4fa0-ad27-1d438bb9ab7d | 2024-08-01 16:15:00 | press_release | ORKA | Biotechnology | ARCA biopharma Announces Second Quarter 2024 Financial Results and Provides Corporate Update | change=-1.3333 | change_1d=3.6667 | change_3d=-4.0 | change_7d=-1.6667 | intraday=0.339 | tag=sustained_repricing | cap=$1B~10B
  - 653cf8f5-c3ca-4be5-9822-0c3462d79830 | 2024-11-19 09:45:00 | press_release | LAES | Semiconductors | SEALSQ Updates on Minimum Bid Price Non-Compliance | change=-9.8039 | change_1d=-1.9608 | change_3d=-11.7647 | change_7d=-11.7647 | intraday=-6.1224 | tag=sustained_repricing | cap=$300M~1B
- 반례/영향 약한 사례:
  - bdd474e8-fc49-4302-80ba-9fca75943d2c | 2023-05-18 09:00:00 | press_release | VOYA | Financial Conglomerates | New Voya behavioral finance research finds employers can boost ‘default escalators’ in 401(k) plans without decreasing participation | change=0.8513 | change_1d=0.0142 | change_3d=-1.3337 | change_7d=-1.6884 | intraday=1.3835 | tag=low_signal | cap=$1B~10B
  - ec7f3ad0-4ee6-42e6-8d97-1f7636ef6826 | 2024-05-31 16:05:00 | press_release | NDAQ | Financial Data & Stock Exchanges | Delisting of Securities of RiskOn International, Inc.; Graphjet Technology; Agile Therapeutics, Inc.; NextPlay Technologies, Inc.; Relativity Acquisition Corp.; iSun, Inc.; Ace Global Business Acquisition Limited; and Marpai, Inc. from The Nasdaq Stoc... | change=-0.0339 | change_1d=-0.525 | change_3d=1.1177 | change_7d=-0.4572 | intraday=-0.3545 | tag=low_signal | cap=$10B~100B

### residual 그룹

#### residual-1. 일반 corporate PR
- 설명: conference, publication, appointment, facility update 등 일반 PR성 공지
- 총 건수: 65,407
- 영향 미침: 12,467
- 영향 안 미침: 52,940
- 영향 비율: 0.191
- 보수적 순위 점수(Wilson LB): 0.188
- 방향 분해: positive 8,180 / negative 4,287
- median impact score: 9.94
- market cap breakdown: {"$100B~300B": {"total": 4625, "impacted": 947}, "$1B~10B": {"total": 30351, "impacted": 5686}, "$10B~100B": {"total": 23594, "impacted": 4536}, "$300M~1B": {"total": 5347, "impacted": 994}, "<$300M or Unknown": {"total": 754, "impacted": 149}, "$300B~": {"total": 736, "impacted": 155}}
- source breakdown: {"press_release": {"total": 65407, "impacted": 12467}}
- industry group breakdown: {"Energy/Mining": {"total": 2857, "impacted": 795}, "Utilities": {"total": 4540, "impacted": 533}, "Technology": {"total": 15831, "impacted": 3178}, "Financial": {"total": 3466, "impacted": 499}, "Industrial": {"total": 5403, "impacted": 1111}, "Biotech/Pharma/MedDev": {"total": 14398, "impacted": 3107}, "Other": {"total": 14424, "impacted": 2550}, "Materials/Auto": {"total": 3734, "impacted": 545}, "Unknown": {"total": 754, "impacted": 149}}
- 대표 사례:
  - 474c70de-d8fa-49ef-a036-ec57cc8de9a9 | 2024-03-27 08:00:00 | press_release | PVLA | Biotechnology | Pieris Pharmaceuticals Announces Strategy to Maximize Partnered Milestone and Royalty Potential | change=3.1915 | change_1d=-2.6596 | change_3d=-5.3191 | change_7d=-8.5106 | intraday=2.1053 | tag=sustained_repricing | cap=$1B~10B
  - ab125051-5bab-417e-a4c7-48e50b957b95 | 2023-05-04 07:00:00 | press_release | WGS | Diagnostics & Research | GeneDx Adds Buccal Swab as Non-Invasive Whole Genome Sequencing Sample Collection Option | change=3054.4715 | change_1d=3375.6098 | change_3d=3294.3089 | change_7d=2920.3252 | intraday=-2.5126 | tag=multi_window_impact | cap=$1B~10B
  - 0ae6cd07-b1f6-4eb5-94cf-41c987d7452b | 2023-04-03 08:30:00 | press_release | WGS | Diagnostics & Research | GeneDx Appoints Devin K. Schaffer, J.D., M.B.A, as General Counsel | change=-4.6575 | change_1d=-9.589 | change_3d=-10.137 | change_7d=-15.8904 | intraday=-0.5714 | tag=sustained_repricing | cap=$1B~10B
- 반례/영향 약한 사례:
  - 3b7cd627-45a6-44da-9adb-926bbe3d4f9f | 2023-08-01 07:30:00 | press_release | WSO.B | Building products | Watsco Reports Strong Second Quarter Results | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$10B~100B
  - 4195dc85-058e-4b53-846e-12c02a9da7d0 | 2024-02-06 07:30:00 | press_release | WSO.B | Building products | Watsco to Host 2023 Earnings Call February 13, 2024 | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$10B~100B

#### residual-2. 애널리스트 의견·목표가
- 설명: upgrade, downgrade, price target, initiated coverage 등 sell-side 의견 변화
- 총 건수: 761
- 영향 미침: 154
- 영향 안 미침: 607
- 영향 비율: 0.202
- 보수적 순위 점수(Wilson LB): 0.175
- 방향 분해: positive 92 / negative 62
- median impact score: 9.61
- market cap breakdown: {"$10B~100B": {"total": 341, "impacted": 63}, "$1B~10B": {"total": 272, "impacted": 64}, "$300M~1B": {"total": 71, "impacted": 10}, "$100B~300B": {"total": 64, "impacted": 15}, "$300B~": {"total": 9, "impacted": 2}, "<$300M or Unknown": {"total": 4, "impacted": 0}}
- source breakdown: {"press_release": {"total": 761, "impacted": 154}}
- industry group breakdown: {"Technology": {"total": 151, "impacted": 37}, "Other": {"total": 209, "impacted": 44}, "Industrial": {"total": 76, "impacted": 13}, "Financial": {"total": 71, "impacted": 9}, "Utilities": {"total": 73, "impacted": 4}, "Biotech/Pharma/MedDev": {"total": 118, "impacted": 34}, "Energy/Mining": {"total": 21, "impacted": 7}, "Materials/Auto": {"total": 38, "impacted": 6}, "Unknown": {"total": 4, "impacted": 0}}
- 대표 사례:
  - 7166e721-7457-4621-8eea-9c18cf7da118 | 2025-06-02 16:30:00 | press_release | MFI | Software - Application | Zacks Small-Cap Research Initiates Coverage on mF International Limited | change=35.8885 | change_1d=39.3728 | change_3d=185.7143 | change_7d=207.7816 | intraday=14.7059 | tag=multi_window_impact | cap=$300M~1B
  - 6a072f5a-3672-443c-8b63-c11026fa6125 | 2023-11-13 08:30:00 | press_release | ONDS | Communication Equipment | Ondas Holdings' Airobotics Accelerates Development of its Defensive Counter-UAS System, the Iron Drone Raider, to Meet Israel Defense Forces Requirements | change=7.2727 | change_1d=2.8099 | change_3d=29.7521 | change_7d=86.7769 | intraday=6.3934 | tag=multi_window_impact | cap=$1B~10B
  - abbc5ac0-3ce4-4070-a6ab-1434e2d61d2a | 2023-03-14 13:04:00 | press_release | WULF | Capital Markets | TeraWulf Addresses U.S. Bank Closures | change=-4.6875 | change_1d=-12.5 | change_3d=-4.6875 | change_7d=15.625 | intraday=-6.1538 | tag=sustained_repricing | cap=$1B~10B
- 반례/영향 약한 사례:
  - 6bdf9539-d793-4e88-9f06-c74a482b764b | 2025-12-23 13:29:00 | press_release | CWAN | Software - Application | CWAN Alert: Monsey Firm of Wohl & Fruchter Investigating Fairness of the Sale of Clearwater Analytics to Permira and Other Investors | change=0.1663 | change_1d=0.5403 | change_3d=0.1663 | change_7d=0.2494 | intraday=0.0415 | tag=low_signal | cap=$1B~10B
  - fb352f04-26cb-45df-b156-95f59e4fcc30 | 2024-05-08 07:16:00 | press_release | WTW | Insurance Brokers | WTW boosts global cyber facility with increased capacity and broader coverage options | change=-0.7455 | change_1d=0.2943 | change_3d=-0.463 | change_7d=0.3021 | intraday=-0.7494 | tag=low_signal | cap=$10B~100B

#### residual-3. 정책·관세·섹터 매크로
- 설명: tariff, policy, export control, inflation, rates 등 종목 외부 매크로/정책 이슈
- 총 건수: 341
- 영향 미침: 44
- 영향 안 미침: 297
- 영향 비율: 0.129
- 보수적 순위 점수(Wilson LB): 0.098
- 방향 분해: positive 32 / negative 12
- median impact score: 7.08
- market cap breakdown: {"$1B~10B": {"total": 113, "impacted": 18}, "$100B~300B": {"total": 82, "impacted": 7}, "$10B~100B": {"total": 123, "impacted": 15}, "$300M~1B": {"total": 16, "impacted": 3}, "<$300M or Unknown": {"total": 5, "impacted": 1}, "$300B~": {"total": 2, "impacted": 0}}
- source breakdown: {"press_release": {"total": 341, "impacted": 44}}
- industry group breakdown: {"Financial": {"total": 118, "impacted": 6}, "Utilities": {"total": 36, "impacted": 2}, "Technology": {"total": 69, "impacted": 9}, "Biotech/Pharma/MedDev": {"total": 21, "impacted": 5}, "Industrial": {"total": 17, "impacted": 6}, "Other": {"total": 43, "impacted": 7}, "Energy/Mining": {"total": 11, "impacted": 4}, "Materials/Auto": {"total": 21, "impacted": 4}, "Unknown": {"total": 5, "impacted": 1}}
- 대표 사례:
  - 8da194a2-3e55-4870-b299-a2a738dd8ee7 | 2025-05-07 17:16:00 | press_release | LEU | Uranium | Centrus Reports First Quarter 2025 Results | change=-2.6323 | change_1d=18.802 | change_3d=27.1958 | change_7d=30.1638 | intraday=-4.6053 | tag=multi_window_impact | cap=$1B~10B
  - 22c5b1df-3354-465c-aa14-2447b291a7c8 | 2024-05-16 06:00:00 | press_release | HIMS | Drug Manufacturers - Specialty & Generic | Hims & Hers Welcomes Anja Manuel, Foreign Policy Expert, Domestic Regulations Advisor, and Former Diplomat to its Board of Directors | change=1.4451 | change_1d=5.2746 | change_3d=26.8786 | change_7d=14.3786 | intraday=1.5184 | tag=multi_window_impact | cap=$1B~10B
  - b244a1d3-db60-4554-aed4-f3b85110a480 | 2025-09-18 08:00:00 | press_release | LTBR | Electrical Equipment & Parts | Lightbridge CEO Seth Grae to Participate at the Atlantic Council Nuclear Energy Policy Summit 2025 in New York City | change=2.5051 | change_1d=23.629 | change_3d=41.1645 | change_7d=31.6181 | intraday=0.5312 | tag=multi_window_impact | cap=$300M~1B
- 반례/영향 약한 사례:
  - c299ac37-9ee2-4d39-9f7b-ef0ac8401c4b | 2024-05-09 15:00:00 | press_release | DUK | Utilities - Regulated Electric | Duke Energy advances energy transition and positions company for long-term success, CEO tells shareholders at annual meeting | change=0.6251 | change_1d=0.2833 | change_3d=-0.0684 | change_7d=0.4493 | intraday=0.7531 | tag=low_signal | cap=$100B~300B
  - bfb3687c-28ea-42fc-9be5-ff640f707e9a | 2024-07-01 09:00:00 | press_release | CME | Financial Data & Stock Exchanges | CME Group Launches €STRWatch to Help Clients Manage Risk Around ECB Policy Decisions | change=-0.5595 | change_1d=0.2442 | change_3d=-0.1017 | change_7d=-1.0071 | intraday=-1.0728 | tag=low_signal | cap=$100B~300B

## $300M~1B 상위 case

- 1. 임상·규제 성공: impacted=213 / total=736, ratio=0.289, Wilson=0.258
- 2. 전략대안·구조조정·생존성: impacted=9 / total=23, ratio=0.391, Wilson=0.222
- 3. 임상·규제 실패: impacted=11 / total=30, ratio=0.367, Wilson=0.219
- 4. 희석성 자금조달·오퍼링: impacted=133 / total=580, ratio=0.229, Wilson=0.197
- 5. 전략 제휴·라이선스·정부지원·대형 계약: impacted=259 / total=1,226, ratio=0.211, Wilson=0.189

## $1B~10B 상위 case

- 1. 임상·규제 성공: impacted=858 / total=2,677, ratio=0.321, Wilson=0.303
- 2. 임상·규제 실패: impacted=29 / total=71, ratio=0.408, Wilson=0.302
- 3. 실적 호조·가이던스 상향: impacted=56 / total=178, ratio=0.315, Wilson=0.251
- 4. 소송·조사·회계 이슈: impacted=150 / total=636, ratio=0.236, Wilson=0.205
- 5. 상업화·시설·사업 확장: impacted=1,826 / total=8,601, ratio=0.212, Wilson=0.204

## $10B~100B 상위 case

- 1. 소송·조사·회계 이슈: impacted=128 / total=384, ratio=0.333, Wilson=0.288
- 2. 실적 호조·가이던스 상향: impacted=33 / total=90, ratio=0.367, Wilson=0.274
- 3. 상업화·시설·사업 확장: impacted=1,407 / total=6,037, ratio=0.233, Wilson=0.223
- 4. 임상·규제 성공: impacted=249 / total=1,011, ratio=0.246, Wilson=0.221
- 5. 일반 corporate PR: impacted=4,536 / total=23,594, ratio=0.192, Wilson=0.187

## $100B~300B 상위 case

- 1. 상장·직상장·자본시장 구조 이벤트: impacted=6 / total=13, ratio=0.462, Wilson=0.232
- 2. 실적 호조·가이던스 상향: impacted=13 / total=40, ratio=0.325, Wilson=0.201
- 3. 희석성 자금조달·오퍼링: impacted=81 / total=341, ratio=0.238, Wilson=0.195
- 4. 일반 corporate PR: impacted=947 / total=4,625, ratio=0.205, Wilson=0.193
- 5. 전략 제휴·라이선스·정부지원·대형 계약: impacted=283 / total=1,437, ratio=0.197, Wilson=0.177

## $300B~ 상위 case

- 1. 상업화·시설·사업 확장: impacted=48 / total=200, ratio=0.240, Wilson=0.186
- 2. 일반 corporate PR: impacted=155 / total=736, ratio=0.211, Wilson=0.183
- 3. 전략 제휴·라이선스·정부지원·대형 계약: impacted=50 / total=247, ratio=0.202, Wilson=0.157
- 4. 소송·조사·회계 이슈: impacted=4 / total=11, ratio=0.364, Wilson=0.152
- 5. 실적 부진·가이던스 하향: impacted=1 / total=2, ratio=0.500, Wilson=0.095

## 산업 그룹별 분석

- `securities.industry`를 7개 그룹(Biotech/Pharma/MedDev, Technology, Financial, Industrial, Energy/Mining, Utilities, Materials/Auto, Other, Unknown)으로 묶어 집계했다.
- 유형 분류 시 `clinical_regulatory_positive/negative`는 Biotech/Pharma/MedDev 그룹에서만 우선 적용하고, 비임상 산업에서는 strong clinical signal이 없으면 차순위 매칭 또는 general_corporate_pr로 귀속했다.

| industry_group | total | impacted | impact_ratio |
|----------------|-------|----------|-------------|
| Biotech/Pharma/MedDev | 27,235 | 6,146 | 0.226 |
| Technology | 27,008 | 5,543 | 0.205 |
| Other | 23,985 | 4,452 | 0.186 |
| Industrial | 10,761 | 2,330 | 0.217 |
| Utilities | 7,472 | 997 | 0.133 |
| Materials/Auto | 6,417 | 945 | 0.147 |
| Financial | 6,006 | 965 | 0.161 |
| Energy/Mining | 4,366 | 1,276 | 0.292 |
| Unknown | 1,272 | 255 | 0.200 |

- 같은 case_type이라도 산업 그룹에 따라 impact_ratio가 다를 수 있으며, 각 case_type별 industry_group_breakdown은 '전체 유형 분류 결과' 섹션에서 확인 가능하다.

## 기업 컨텍스트 데이터 한계

- `industry` (securities.industry): 1695/1698 ticker 보유 (99.8%). 유형 분류 보정에 활용했다.
- `ipo_date` (company_profiles.ipo_date): 1690/1698 ticker 보유 (99.5%). 증거 표에 기록했으나 분류 보정에는 아직 미반영.
- `description` (company_profiles.description 또는 raw_json): 51/1698 ticker만 보유 (3%). 데이터 부족으로 이번 분석에서 미활용.
- `peers_json` (company_profiles.peers_json): 1656/1698 ticker 보유 (97.5%). 유사사례 탐색에 활용 가능하나 이번 전수 집계에서는 미사용.
- 향후 description 데이터 보강 시, 뉴스 사건이 핵심 사업과 직접 연결되는지 판단하는 보정 레이어 추가 필요.

## 토큰 비용 추정

- 가정: 영어 기사 기준 `1 token ~= 4 chars`, 기사별 프롬프트 오버헤드 180 tokens, 출력 120 tokens
- 전체 문자 수: 462,723,023
- raw input tokens 추정: 115,680,756
- naive article-by-article total tokens 추정: 156,791,856

## 해석

- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 반대일 수 있다.
- **industry 기반 분류 보정**: 비(非)임상 산업에서 'approval', 'study' 같은 범용 키워드가 잡히면 clinical_regulatory로 오분류될 수 있으므로, industry가 Biotech/Pharma/MedDev가 아닌 경우 strong clinical signal 유무로 필터링했다.
- 이번 note는 `press_release only` 기준이라, 동일 taxonomy를 다른 source에 그대로 적용하면 비율이 달라질 수 있다.
- `300M~1B` 버킷은 동일한 뉴스 유형에서도 절대 변동폭이 더 크게 나오기 쉬우므로, 대형주와 같은 기준으로 자르면 과대판정되기 쉽다.
- `<$300M or Unknown` 집단은 전체 데이터에서 비중이 아직 크므로, 다음 단계에서는 market cap 보강이 되면 5개 주 버킷 비교가 더 안정된다.
- 이 note의 내부 사고과정 로그는 내부 독백 전문이 아니라, taxonomy와 threshold를 바꾼 주요 판단을 재현 가능하게 적은 운영 로그다.