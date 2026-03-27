# 🎯 3/26~3/27

---

## 📌 분석 전제 / 가드레일

- 생성 시각: 2026-03-27 09:20 (local)
- 분석 요청 메모: `26일 16시 이후 부터 뉴스 분석`
- 실제 집계 구간: `datetime(published_at) >= 2026-03-26 16:00:00` and `< 2026-03-28 00:00:00`
- Model 2 기본 원칙에 맞춰 먼저 source 스크리닝을 했고, 그중 issuer-driven 사건 해석이 가능한 `fmp_press_release`만 1차 분석 대상으로 고정했다.
- `fmp_sec_filing`은 disclosure taxonomy가 별도로 필요하고, `fmp_stock_news`는 rewrite/commentary가 섞여 있어 이번 page의 1차 taxonomy 대상에서 제외했다.
- `fmp_press_release` 135건 모두 full text가 존재한다.
- 다만 `news_change_metrics`는 0건이라, 이번 note는 **언어 기반 case taxonomy note**가 중심이고 가격 영향 빈도 서열화는 아직 닫히지 않았다.

## 📋 source 스크리닝

| source_type | 건수 | 처리 | 이유 |
| --- | ---: | --- | --- |
| fmp_sec_filing | 765 | 제외 | filing은 공시 taxonomy가 PR taxonomy와 다르다. |
| fmp_stock_news | 376 | 제외 | 재서술 기사와 commentary가 섞여 규칙 해석이 흐려진다. |
| fmp_press_release | 135 | 포함 | issuer-driven event라 Model 2 case_type 정의에 직접적이다. |

## 🗂️ 빠른 요약

| 상위 분류 | 건수 | 비중 |
| --- | ---: | ---: |
| long | 30 | 0.222 |
| short | 64 | 0.474 |
| residual | 41 | 0.304 |

| 순위 | case_type | 한글 라벨 | 상위 분류 | 건수 | 비중 |
| --- | --- | --- | --- | ---: | ---: |
| 1 | general_corporate_pr | 일반 corporate PR | residual | 41 | 0.304 |
| 2 | litigation_investigation | 소송·조사·회계 이슈 | short | 41 | 0.304 |
| 3 | financing_offering | 희석성 자금조달·오퍼링 | short | 22 | 0.163 |
| 4 | commercial_launch_expansion | 상업화·시설·사업 확장 | long | 17 | 0.126 |
| 5 | strategic_deal_policy | 전략 제휴·라이선스·정부지원·대형 계약 | long | 7 | 0.052 |
| 6 | clinical_regulatory_positive | 임상·규제 성공 | long | 6 | 0.044 |
| 7 | strategic_review_restructuring | 전략대안·구조조정·생존성 | short | 1 | 0.007 |

## 🔎 1차 해석

- `short`가 64건으로 가장 많다. 가장 큰 이유는 `securities fraud lawsuit / shareholder alert / investigation` 계열 PR이 대량 유입됐기 때문이다.
- `residual` 41건 중 핵심은 `general_corporate_pr` 41건이다. earnings call 일정, 수상/선정, 일반 corporate update, 행사성 공지가 여기에 모였다.
- `long` 30건은 `commercial_launch_expansion` 17건, `strategic_deal_policy` 7건, `clinical_regulatory_positive` 6건이 중심이다.
- 이번 분포는 **언어 라벨 분포**이지, 가격 영향 빈도 분포가 아니다. Model 2 지침상 long/short는 우선 기사 의미로 먼저 정하고, 가격 데이터는 그 다음 단계에서 붙인다.
- 따라서 지금 시점에서 말할 수 있는 것은 `이 시간대 PR이 어떤 사건 언어로 쏠려 있었는가`이고, `어떤 사건이 실제 주가를 더 많이 움직였는가`는 아직 아니다.

## 🧱 관측된 case_type 상세

### 1. 일반 corporate PR (`general_corporate_pr`)
- 상위 분류: `residual`
- 한 줄 정의: 일반 corporate PR, 홍보성 공지, 경계가 흐린 업데이트를 담는 잔여 유형
- 핵심 가치 경로: 직접 경제 이벤트가 약하거나 반복 패턴이 불안정해 residual로 남긴다.
- 포함 신호: appointment, conference participation, certification, general update
- 제외 신호: 실적/계약/오퍼링/임상처럼 명확한 경제 사건이 있는 경우
- 경계 사례: 같은 단어가 있어도 실질 계약, 승인, financing이면 해당 독립 유형으로 보낸다.
- 빠른 판별 질문: 핵심 경제 이벤트가 불분명한가? / 반복성은 있으나 독립 유형으로 설명력이 약한가?
- 현재 구간 집계: 41건
- 현재 분류 설명: conference, publication, appointment, facility update 등 일반 PR성 공지
- 대표 예시:
  - 2026-03-26T16:00:00 | SWK | PRNewsWire | Stanley Black & Decker Announces Release Date for First Quarter 2026 Earnings
  - 2026-03-26T16:05:00 | PAYC | Business Wire | Paycom Named 2026 Platinum Employer on Where You Work Matters List
  - 2026-03-26T16:05:00 | CRNX | GlobeNewsWire | Crinetics Pharmaceuticals Announces Submission of Marketing Authorization Application in Brazil for Palsonify™ (Paltusotine) in Acromegaly

### 2. 소송·조사·회계 이슈 (`litigation_investigation`)
- 상위 분류: `short`
- 한 줄 정의: 소송, 조사, 회계 문제, fraud allegation처럼 법률/신뢰 리스크를 직접 시사하는 공지
- 핵심 가치 경로: 규제/법률 비용 상승과 사업 불확실성 확대에 연결된다.
- 포함 신호: lawsuit, subpoena, investigation, restatement, fraud
- 제외 신호: 단순 합의 완료 또는 리스크 해소 공지, 일반 법무 업데이트
- 경계 사례: 리스크 해소 기사라면 long 가능성도 다시 본다.
- 빠른 판별 질문: 핵심 메시지가 법적/회계 리스크 발생인가? / 사업보다 조사/소송 자체가 메인인가?
- 현재 구간 집계: 41건
- 현재 분류 설명: lawsuit, subpoena, investigation, restatement, fraud allegation 등 법률/회계 리스크
- 대표 예시:
  - 2026-03-26T16:17:00 | ENPH | PRNewsWire | ENPH Investors Have Opportunity to Lead Enphase Energy, Inc. Securities Fraud Lawsuit
  - 2026-03-26T16:25:00 | ENPH | PRNewsWire | ENPH Investors Have Opportunity to Lead Enphase Energy, Inc. Securities Fraud Lawsuit
  - 2026-03-26T16:37:00 | QURE | PRNewsWire | QURE SHAREHOLDER ALERT: Hagens Berman Updates uniQure (QURE) Investigation Following Public FDA Rebukes and Allegations of "Distorted" Data

### 3. 희석성 자금조달·오퍼링 (`financing_offering`)
- 상위 분류: `short`
- 한 줄 정의: 희석성 자금조달, 공모/사모, warrants, notes offering 등 주주가치 희석 가능성이 큰 공지
- 핵심 가치 경로: 지분 희석 또는 자본비용 증가 우려로 연결된다.
- 포함 신호: public offering, private placement, registered direct, warrant, notes offering
- 제외 신호: 비희석성 grant/contract funding, 단순 refinancing 안내
- 경계 사례: 자금조달이라도 non-dilutive 성격이 강하면 strategic_deal_policy나 residual을 검토한다.
- 빠른 판별 질문: 주식/워런트/전환증권 발행이 핵심인가? / 기존 주주 희석 가능성이 직접 언급되는가?
- 현재 구간 집계: 22건
- 현재 분류 설명: public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈
- 대표 예시:
  - 2026-03-26T16:01:00 | ZBIO | GlobeNewsWire | Zenas BioPharma Announces Proposed Concurrent Public Offerings of Convertible Senior Notes Due 2032 and Common Stock
  - 2026-03-26T16:01:00 | SIGA | GlobeNewsWire | SIGA Declares Special Cash Dividend of $0.60 Per Share
  - 2026-03-26T16:01:00 | APGE | GlobeNewsWire | Apogee Therapeutics, Inc. Announces Closing of Public Offering and Full Exercise of the Underwriters' Option to Purchase Additional Shares for Gross Proceeds of $403 Million

### 4. 상업화·시설·사업 확장 (`commercial_launch_expansion`)
- 상위 분류: `long`
- 한 줄 정의: 제품 launch, 시설 확장, 생산/상업화 확대처럼 사업 확장 이벤트가 중심인 공지
- 핵심 가치 경로: 매출 기반 확장과 운영 레버리지 개선 기대에 연결된다.
- 포함 신호: launch, facility, expansion, commercial, production
- 제외 신호: 단순 행사 발표, 기술 소개 수준의 PR
- 경계 사례: 확장 표현이 있어도 실제 사업 확장인지, 홍보성 소개인지 구분한다.
- 빠른 판별 질문: 실제 상업화/생산/시설 확장이 핵심인가? / 운영 규모 확대가 직접 보이는가?
- 현재 구간 집계: 17건
- 현재 분류 설명: launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트
- 대표 예시:
  - 2026-03-26T16:02:00 | KYTX | GlobeNewsWire | Kyverna Therapeutics Provides Business Update and Reports Fourth Quarter and Full Year 2025 Financial Results
  - 2026-03-26T16:05:00 | U | Business Wire | Unity Releases Preliminary First Quarter Results Exceeding Guidance; Will Enhance Growth and Profitability by Exiting Non-Strategic Ad Businesses
  - 2026-03-26T16:15:00 | ENS | Business Wire | EnerSys to Host 2026 Investor Day

### 5. 전략 제휴·라이선스·정부지원·대형 계약 (`strategic_deal_policy`)
- 상위 분류: `long`
- 한 줄 정의: 대형 계약, 제휴, 라이선스, 정부지원, 인수 등 외부 자원 결합으로 가치 상방을 시사하는 공지
- 핵심 가치 경로: 수주/파트너십/외부자금 유입이 매출 가시성과 전략 가치를 높인다.
- 포함 신호: partnership, collaboration, license, award, contract, grant
- 제외 신호: 형식적 MOU만 있고 경제 조건이 빈약한 경우, 희석성 financing이 핵심인 경우
- 경계 사례: agreement라는 단어만으로 분류하지 말고 실제 경제적 연결이 있는지 본다.
- 빠른 판별 질문: 외부 계약/제휴/지원이 실질 경제 이벤트인가? / 매출 또는 전략 자산 가치 증가 경로가 보이는가?
- 현재 구간 집계: 7건
- 현재 분류 설명: partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈
- 대표 예시:
  - 2026-03-26T16:05:00 | RPD | GlobeNewsWire | Rapid7 Acquires Kenzo Security to Accelerate Preemptive, AI-Powered Security Operations
  - 2026-03-26T16:30:00 | MD | Business Wire | Pediatrix Expands Maternal Health Services in Tennessee in Partnership with Tennessee Maternal-Fetal Medicine
  - 2026-03-26T16:53:00 | F | GlobeNewsWire | OFL: Ontario's Budget 2026 does more to Protect the Ford Government, than it does Ontarians and our Economy

### 6. 임상·규제 성공 (`clinical_regulatory_positive`)
- 상위 분류: `long`
- 한 줄 정의: 임상 성공, 규제 승인, NDA/BLA acceptance처럼 바이오 가치 상방을 직접 시사하는 공지
- 핵심 가치 경로: 개발자산 성공 확률 상승과 상업화 기대 확대로 연결된다.
- 포함 신호: positive topline, approval, FDA acceptance, pivotal data
- 제외 신호: trial 언급이 있어도 실패/미충족인 경우, 연구 개시만 있고 결과가 없는 경우
- 경계 사례: trial/result 단어만으로 분류하지 말고 결과 방향이 positive인지 확인한다.
- 빠른 판별 질문: 결과가 성공/승인/수용인가? / 핵심 자산 가치가 올라가는 메시지인가?
- 현재 구간 집계: 6건
- 현재 분류 설명: positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재
- 대표 예시:
  - 2026-03-26T16:05:00 | LBRX | GlobeNewsWire | LB Pharmaceuticals Reports Fourth Quarter and Full Year 2025 Financial Results and Provides Corporate Update
  - 2026-03-26T16:30:00 | IRON | GlobeNewsWire | Disc Medicine Announces Completion of Enrollment of Phase 3 APOLLO Trial of Bitopertin in Erythropoietic Protoporphyria
  - 2026-03-26T18:39:00 | RGNX | GlobeNewsWire | ROSEN, NATIONAL TRIAL LAWYERS, Encourages REGENXBIO, Inc. Investors to Secure Counsel Before Important Deadline in Securities Class Action - RGNX

### 7. 전략대안·구조조정·생존성 (`strategic_review_restructuring`)
- 상위 분류: `short`
- 한 줄 정의: 구조조정, 생존성 이슈, strategic alternatives, going concern처럼 사업 지속성 리스크를 시사하는 공지
- 핵심 가치 경로: 현금 압박, 생존성 우려, 구조조정 비용 확대에 연결된다.
- 포함 신호: strategic alternatives, restructuring, layoff, going concern, bankruptcy
- 제외 신호: 성장 투자 목적의 조직 개편, 일반 비용 관리 코멘트
- 경계 사례: 효율화 표현이 있어도 생존성 우려가 핵심인지 아닌지 구분한다.
- 빠른 판별 질문: 회사가 버티기/정리 모드에 들어갔다는 신호인가? / 핵심이 성장보다 생존인가?
- 현재 구간 집계: 1건
- 현재 분류 설명: strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈
- 대표 예시:
  - 2026-03-26T16:00:00 | HCA | Business Wire | HCA Healthcare, Inc. 1st Quarter 2026 Earnings Conference Call

## 🏷️ publisher 분포

| publisher | 건수 | 비중 |
| --- | ---: | ---: |
| GlobeNewsWire | 56 | 0.415 |
| Business Wire | 37 | 0.274 |
| PRNewsWire | 29 | 0.215 |
| Newsfile Corp | 12 | 0.089 |
| Accesswire | 1 | 0.007 |

- `GlobeNewsWire`, `Business Wire`, `PRNewsWire` 3개 배포망이 대부분을 차지한다.
- law-firm alert가 많이 실린 배포망 비중이 높아 `litigation_investigation`의 절대 건수가 커졌다.

## 🧪 규칙 감사: 현재 자동 분류가 흔들리는 지점

아래는 이번 135건에서 바로 보이는 대표 오분류/경계 사례다.

| headline | 현재 분류 | 더 자연스러운 해석 |
| --- | --- | --- |
| HCA Healthcare, Inc. 1st Quarter 2026 Earnings Conference Call | strategic_review_restructuring | residual / earnings schedule 성격에 더 가깝다. |
| SIGA Declares Special Cash Dividend of $0.60 Per Share | financing_offering | 주주환원·special dividend 유형이 더 적절하다. |
| Crinetics Pharmaceuticals Announces Submission of Marketing Authorization Application in Brazil for Palsonify™ (Paltusotine) in Acromegaly | general_corporate_pr | 바이오/규제 진전 성격이라 clinical_regulatory_positive 후보가 더 자연스럽다. |
| Eisai and Nuvation Bio Announce Marketing Authorisation Application ... Validated by the European Medicines Agency | general_corporate_pr | 해외 규제 절차 진전으로 봐야 한다. |
| EnerSys to Host 2026 Investor Day | commercial_launch_expansion | IR event 공지라 general_corporate_pr 쪽이 더 자연스럽다. |

- 즉 현재 rule set은 `lawsuit/alert` 탐지는 강하지만, `dividend`, `regulatory submission`, `IR event`, `earnings schedule`처럼 사건 성격이 다른 headline을 충분히 세분화하지 못한다.
- 이 때문에 지금 저장한 note는 **Model 2의 분류 원칙에는 맞지만, taxonomy calibration은 아직 1차 상태**로 보는 것이 정확하다.

## 🚨 아직 닫히지 않은 것

- `news_change_metrics`가 0건이라 `overall_impact_score`, bucket별 p80, impact ratio, Wilson LB를 계산할 수 없다.
- 따라서 이번 page는 `무슨 유형의 사건이 있었는가`까지는 답하지만, `어떤 유형이 실제로 더 잘 움직였는가`는 아직 답하지 못한다.
- Model 2 지침을 완전히 닫으려면 같은 135건에 change metric이 백필된 뒤, 동일 case_type 집합으로 impact ranking을 다시 계산해야 한다.

## 📎 근거 표

- 경로: `ai_research_tool/model_2_source/326~327_fmp_pr_20260326_1600.md`
- 이 파일에는 135건 전체가 들어 있고, 각 row에 현재 case_type과 pending 상태의 reaction_tag가 기록돼 있다.