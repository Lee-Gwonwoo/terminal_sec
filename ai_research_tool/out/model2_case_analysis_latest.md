# model 2 test gpt5.4

- 생성 시각: 2026-03-10 09:28 (local)
- 분석 범위: `press_release only` / `2024-01-01 ~ 2026-03-10`
- 전체 뉴스 수: 102,855
- change 기반 분석 가능 뉴스 수: 91,886

## 분석 범위

- source 범위는 `press_release only`로 고정했다.
- 기간 내 `press_release` 전체를 1차 전수 스캔하고, 각 row에 ticker, market cap, change vector를 붙였다.
- 외부 링크는 다시 열지 않고 `news_items`, `news_fulltext`, `news_change_metrics`, `company_profiles.market_cap`만 사용했다.

## 유형 분류 기준

- `title/body/full_text`에서 반복되는 표현을 기준으로 case 유형을 묶었다.
- 의미가 크게 다른 바이오 positive / negative, financing, litigation, earnings, strategic deal 등은 분리했다.
- 애매한 표현은 대표 사례와 반례를 비교해 가장 설명력이 높은 유형으로 귀속했다.

## 영향 판정 기준

- 사용한 전체 change vector: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`
- `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`
- `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`
- `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`
- 영향 여부는 같은 market cap bucket 안에서 `overall_impact_score >= p80` 인지로 판정했다.

## market cap bucket 기준

- 주 버킷: `300M~<1B`, `1B~<100B`, `100B~`
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
   - 최종 결정: `300M~<1B`, `1B~<100B`, `100B~`를 주 버킷으로 나눠 각 버킷별 `p80`을 threshold로 사용했다.
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

- 근거 표 파일 경로: `ai_research_tool\model_2_source\model 2 test gpt5.4.md`
- 이 파일은 현재 note와 같은 제목 기준으로 만든 전체 근거 뉴스 표다.
- 각 행에는 case_type, reaction_tag, news_id, ticker, market_cap, 전체 change window, 구간 점수, overall score를 기록했다.

## 데이터 가용성

- press_release: total=102,855, with_change=91,886, with_fulltext=59,585

## 영향 판정 기준

- 사용한 전체 change 컬럼: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`
- `overall_impact_score`는 immediate / short / medium 3개 구간 점수 중 최대값으로 계산했다.
- 방향성은 절대값이 가장 큰 change 컬럼의 부호로 결정했다.
- 같은 이슈라도 시총이 크면 변동폭이 줄 수 있으므로, 버킷별 p80 임계값을 따로 사용했다.

## market cap bucket별 impact 기준

- $300M-<$1B: total=18,567, with_change=11,232, p50=16.18, p80=29.93, p90=41.93
- $1B-<$100B: total=73,553, with_change=71,690, p50=10.34, p80=20.23, p90=28.74
- >$=100B: total=9,549, with_change=7,947, p50=7.02, p80=12.58, p90=16.47
- <$300M or Unknown: total=1,186, with_change=1,017, p50=10.96, p80=19.84, p90=27.82

## 전체 유형 분류 결과

### 1. 실적 호조·가이던스 상향
- 설명: beat, raises guidance, strong outlook, record revenue 등 실적성 호재
- 총 건수: 264
- 영향 미침: 87
- 영향 안 미침: 177
- 영향 비율: 0.330
- 보수적 순위 점수(Wilson LB): 0.276
- 방향 분해: positive 59 / negative 28
- median impact score: 13.48
- market cap breakdown: {"$1B-<$100B": {"total": 199, "impacted": 65}, ">$=100B": {"total": 36, "impacted": 11}, "$300M-<$1B": {"total": 29, "impacted": 11}}
- source breakdown: {"press_release": {"total": 264, "impacted": 87}}
- 대표 사례:
  - 4beaa1d7-8d0a-4e73-91c7-4273aaec4243 | 2024-05-07 16:20:00 | press_release | INOD | Innodata Reports Record First Quarter 2024 Results; Raises Guidance to at Least 40% Organic Revenue Growth in 2024 | change=0.0 | change_1d=55.3412 | change_3d=59.9407 | change_7d=63.7982 | intraday=-0.2959 | tag=multi_window_impact | cap=$1B-<$100B
  - b0d48140-0218-4576-b6a1-67f5eea66fd8 | 2024-03-26 16:15:00 | press_release | OUST | Ouster Announces Record Revenue for Fourth Quarter and Full Year 2023 | change=-0.2004 | change_1d=34.2685 | change_3d=97.5952 | change_7d=100.4008 | intraday=-1.581 | tag=multi_window_impact | cap=$1B-<$100B
  - 4ed00a0f-ee16-43d2-a85f-68b2f3b53ab4 | 2026-02-11 16:05:00 | press_release | FSLY | Fastly Announces Both Record Fourth Quarter and Full Year 2025 Financial Results | change=2.4202 | change_1d=76.4576 | change_3d=94.2794 | change_7d=98.7899 | intraday=0.1075 | tag=multi_window_impact | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 808d3738-3a14-4844-a0ff-3141a16b9794 | 2024-11-04 21:45:00 | press_release | GROY | GOLD ROYALTY REPORTS THIRD QUARTER 2024 RESULTS; RECORD REVENUE FOR THE FIRST NINE MONTHS OF 2024 | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=-1.3986 | tag=low_signal | cap=$300M-<$1B
  - b8907fda-4f58-42bd-b5fb-e3956403ae49 | 2025-02-05 16:30:00 | press_release | ORLY | O’Reilly Automotive, Inc. Reports Fourth Quarter and Full-Year 2024 Results | change=1.0531 | change_1d=-0.2586 | change_3d=-1.8116 | change_7d=-0.7413 | intraday=0.5099 | tag=low_signal | cap=$1B-<$100B

### 2. 임상·규제 성공
- 설명: positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재
- 총 건수: 5,152
- 영향 미침: 1,364
- 영향 안 미침: 3,788
- 영향 비율: 0.265
- 보수적 순위 점수(Wilson LB): 0.253
- 방향 분해: positive 894 / negative 470
- median impact score: 12.55
- market cap breakdown: {"$1B-<$100B": {"total": 3557, "impacted": 996}, ">$=100B": {"total": 607, "impacted": 78}, "$300M-<$1B": {"total": 922, "impacted": 255}, "<$300M or Unknown": {"total": 66, "impacted": 35}}
- source breakdown: {"press_release": {"total": 5152, "impacted": 1364}}
- 대표 사례:
  - ee57cecc-2dbb-401e-99ab-d5900234c105 | 2025-05-08 16:15:00 | press_release | NKTR | Nektar Therapeutics Reports First Quarter 2025 Financial Results | change=1.6393 | change_1d=-3.2787 | change_3d=16.3934 | change_7d=11.4754 | intraday=1.6393 | tag=sustained_repricing | cap=$1B-<$100B
  - e8a5c278-fa47-417d-af32-64139a38e7dc | 2024-08-29 16:50:00 | press_release | ORKA | ARCA biopharma Announces Completion of Merger with Oruka Therapeutics and Implementation of Reverse Stock Split | change=-28.3668 | change_1d=-31.2321 | change_3d=702.0057 | change_7d=616.0458 | intraday=32.2751 | tag=multi_window_impact | cap=$1B-<$100B
  - 818127e9-574c-43b5-8ce1-4a53cce4326b | 2025-07-08 07:00:00 | press_release | PROK | ProKidney Reports Statistically and Clinically Significant Topline Results for the Phase 2 REGEN-007 Trial Evaluating Rilparencel in Patients with Chronic Kidney Disease and Diabetes | change=515.0041 | change_1d=615.5812 | change_3d=648.5573 | change_7d=455.6472 | intraday=193.7008 | tag=multi_window_impact | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - a0cdb70c-148d-43eb-9f3d-d7e03063084e | 2025-08-25 11:18:00 | press_release | TXNM | TXNM Energy Files Regulatory Applications | change=0.0529 | change_1d=-0.0529 | change_3d=-0.4054 | change_7d=0.0176 | intraday=-0.0704 | tag=low_signal | cap=$1B-<$100B
  - 93d2c787-4165-450c-928b-ece5dc3e905a | 2026-03-04 16:10:00 | press_release | EHAB | Enhabit Reports Fourth Quarter 2025 Financial Results | change=0.0735 | change_1d=0.0735 | change_3d=0.4412 | change_7d=None | intraday=0.1472 | tag=low_signal | cap=$300M-<$1B

### 3. 임상·규제 실패
- 설명: 임상 실패, CRL, 주요 endpoint 미충족, hold·중단 등 바이오 규제/임상 악재
- 총 건수: 240
- 영향 미침: 65
- 영향 안 미침: 175
- 영향 비율: 0.271
- 보수적 순위 점수(Wilson LB): 0.219
- 방향 분해: positive 30 / negative 35
- median impact score: 13.35
- market cap breakdown: {"$1B-<$100B": {"total": 166, "impacted": 45}, "$300M-<$1B": {"total": 44, "impacted": 16}, ">$=100B": {"total": 27, "impacted": 4}, "<$300M or Unknown": {"total": 3, "impacted": 0}}
- source breakdown: {"press_release": {"total": 240, "impacted": 65}}
- 대표 사례:
  - af4c6ae5-5d95-45a8-9cc6-1e9793e883eb | 2025-05-14 16:01:00 | press_release | TMC | TMC Provides First Quarter 2025 Corporate Update | change=0.6734 | change_1d=11.1111 | change_3d=49.8316 | change_7d=47.8114 | intraday=2.3973 | tag=multi_window_impact | cap=$1B-<$100B
  - 52dd3226-e07d-4385-9a7b-a5ac77eac5d8 | 2025-12-11 07:00:00 | press_release | RZLT | Rezolute Announces Phase 3 sunRIZE Study Results in Congenital Hyperinsulinism | change=-87.2029 | change_1d=-83.5466 | change_3d=-81.5356 | change_7d=-83.0896 | intraday=13.8211 | tag=multi_window_impact | cap=$300M-<$1B
  - 9cadaa29-9c97-4ab8-b75c-18ac1dab9213 | 2024-03-08 07:00:00 | press_release | AMLX | Amylyx Pharmaceuticals Announces Topline Results From Global Phase 3 PHOENIX Trial of AMX0035 in ALS | change=-82.2878 | change_1d=-79.9684 | change_3d=-81.8661 | change_7d=-82.9204 | intraday=12.3746 | tag=multi_window_impact | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 529e6725-7aa4-4898-a68d-a44b187207fb | 2025-10-02 09:00:00 | press_release | AMGN | LANDMARK PHASE 3 TRIAL (VESALIUS-CV) MEETS PRIMARY ENDPOINTS IN A CARDIOVASCULAR PRIMARY PREVENTION STUDY OF 12,000 PATIENTS | change=-0.3685 | change_1d=-0.2044 | change_3d=-0.9916 | change_7d=-1.0285 | intraday=-0.3051 | tag=low_signal | cap=>$=100B
  - eb5e22db-940c-405c-a410-0831d20b2d0e | 2024-05-14 14:07:00 | press_release | AAON | AAON Leads the Industry with Early Adoption of A2L Refrigerant, R-454B | change=-0.1192 | change_1d=0.4371 | change_3d=-0.8081 | change_7d=1.7221 | intraday=-0.7895 | tag=low_signal | cap=$1B-<$100B

### 4. 희석성 자금조달·오퍼링
- 설명: public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈
- 총 건수: 5,275
- 영향 미침: 1,161
- 영향 안 미침: 4,114
- 영향 비율: 0.220
- 보수적 순위 점수(Wilson LB): 0.209
- 방향 분해: positive 748 / negative 413
- median impact score: 10.92
- market cap breakdown: {">$=100B": {"total": 307, "impacted": 72}, "$1B-<$100B": {"total": 4224, "impacted": 924}, "$300M-<$1B": {"total": 666, "impacted": 154}, "<$300M or Unknown": {"total": 78, "impacted": 11}}
- source breakdown: {"press_release": {"total": 5275, "impacted": 1161}}
- 대표 사례:
  - 395eacf5-bc76-4c9d-87d6-877740cd3ae6 | 2024-04-19 12:10:00 | press_release | PVLA | Pieris Pharmaceuticals Announces 1-for-80 Reverse Stock Split  | change=-6.4516 | change_1d=-5.8065 | change_3d=7596.7742 | change_7d=7461.2903 | intraday=-5.8442 | tag=multi_window_impact | cap=$1B-<$100B
  - f0ded51c-8101-48ec-8f18-81cc45fd5714 | 2024-08-28 09:00:00 | press_release | GLTO | Galecto Announces Reverse Stock Split | change=-6.6427 | change_1d=-12.9264 | change_3d=1892.8187 | change_7d=1963.5548 | intraday=1.7613 | tag=multi_window_impact | cap=$1B-<$100B
  - a28bcf12-190d-45c5-8620-ac43d660f1d5 | 2025-02-07 07:00:00 | press_release | GSAT | Globalstar Transfers to Nasdaq Global Select Market | change=-5.625 | change_1d=-2.5 | change_3d=1216.25 | change_7d=1316.25 | intraday=-5.625 | tag=multi_window_impact | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 70648be0-44a1-4b60-8fc8-f1c54bb09460 | 2025-12-10 18:01:00 | press_release | LMRI | Lumexa Imaging Announces Pricing of Initial Public Offering | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=0.0 | tag=low_signal | cap=$1B-<$100B
  - 841d3fc3-c346-4ed5-af83-ade17d856bc7 | 2024-09-12 19:11:00 | press_release | MBX | MBX Biosciences Announces Pricing of Initial Public Offering | change=None | change_1d=None | change_3d=None | change_7d=None | intraday=0.0 | tag=low_signal | cap=$1B-<$100B

### 5. 소송·조사·회계 이슈
- 설명: lawsuit, subpoena, investigation, restatement, fraud allegation 등 법률/회계 리스크
- 총 건수: 1,342
- 영향 미침: 304
- 영향 안 미침: 1,038
- 영향 비율: 0.227
- 보수적 순위 점수(Wilson LB): 0.205
- 방향 분해: positive 178 / negative 126
- median impact score: 11.81
- market cap breakdown: {">$=100B": {"total": 46, "impacted": 14}, "$1B-<$100B": {"total": 1098, "impacted": 260}, "$300M-<$1B": {"total": 189, "impacted": 30}, "<$300M or Unknown": {"total": 9, "impacted": 0}}
- source breakdown: {"press_release": {"total": 1342, "impacted": 304}}
- 대표 사례:
  - f2966708-3e68-4c9d-8b33-52813819d0c3 | 2024-05-15 12:36:00 | press_release | ASTS | SHAREHOLDER DEADLINE: AST SpaceMobile, Inc. (ASTS) Investors Are Reminded of Deadline in Securities Action | change=-4.7809 | change_1d=60.5578 | change_3d=110.3586 | change_7d=85.4582 | intraday=-8.0769 | tag=multi_window_impact | cap=$1B-<$100B
  - ff49a9ff-9ab2-45ce-abd4-f1459426a007 | 2024-05-15 12:36:00 | press_release | ASTS | SHAREHOLDER DEADLINE: AST SpaceMobile, Inc. (ASTS) Investors Are Reminded of Deadline in Securities Action | change=-4.7809 | change_1d=60.5578 | change_3d=110.3586 | change_7d=85.4582 | intraday=-8.0769 | tag=multi_window_impact | cap=$1B-<$100B
  - 1b693bc7-700c-4de9-a6c9-3545251db6ab | 2024-05-13 09:37:00 | press_release | ASTS | ATTENTION AST SpaceMobile (ASTS) Shareholders: Securities Fraud Lawsuit Filed Against AST SpaceMobile (ASTS) | change=-0.885 | change_1d=11.0619 | change_3d=78.3186 | change_7d=133.6283 | intraday=-2.1834 | tag=multi_window_impact | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 81eef800-f3e8-40e3-b107-cd8c89f315aa | 2026-03-05 06:00:00 | press_release | EHAB | Shareholder Investigation Launched by Kaskela Law Firm into Fairness of Enhabit, Inc. (NYSE: EHAB) Buyout Price; EHAB Investors Encouraged to Contact the Firm  | change=0.0 | change_1d=0.0 | change_3d=None | change_7d=None | intraday=0.0735 | tag=low_signal | cap=$300M-<$1B
  - 565620ce-1022-46e7-bfca-e7b1ae749c40 | 2026-02-28 07:00:00 | press_release | CWAN | CWAN: Kaskela Law Firm Announces Investigation into Clearwater Analytics Holdings, Inc. Shareholder Buyout Proposal and Encourages Investors to Contact the Firm – CWAN | change=-0.2984 | change_1d=0.2984 | change_3d=0.341 | change_7d=-0.0426 | intraday=-0.0854 | tag=low_signal | cap=$1B-<$100B

### 6. 상업화·시설·사업 확장
- 설명: launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트
- 총 건수: 14,298
- 영향 미침: 2,961
- 영향 안 미침: 11,337
- 영향 비율: 0.207
- 보수적 순위 점수(Wilson LB): 0.201
- 방향 분해: positive 1,949 / negative 1,012
- median impact score: 10.95
- market cap breakdown: {"$1B-<$100B": {"total": 11271, "impacted": 2388}, "$300M-<$1B": {"total": 1710, "impacted": 315}, ">$=100B": {"total": 1159, "impacted": 230}, "<$300M or Unknown": {"total": 158, "impacted": 28}}
- source breakdown: {"press_release": {"total": 14298, "impacted": 2961}}
- 대표 사례:
  - e7e1fd6f-b13f-4c14-87bf-bcdd448e5bc0 | 2024-11-26 09:45:00 | press_release | LAES | SEALSQ Advances Toward 2025 Post-Quantum Chip Launch with Quantum-Resistant Platform Testing | change=-4.2553 | change_1d=-12.766 | change_3d=0.0 | change_7d=-17.0213 | intraday=-10.0 | tag=sustained_repricing | cap=$300M-<$1B
  - bbba9c18-b494-477c-97f9-974600e1ff8a | 2024-12-03 09:56:00 | press_release | LAES | SEALSQ Introduces INeS PKI: The Future-Proof IoT Security Solution with Quantum-Resistant Technology | change=-12.766 | change_1d=-17.0213 | change_3d=-14.8936 | change_7d=21.2766 | intraday=-10.8696 | tag=sustained_repricing | cap=$300M-<$1B
  - fa425c03-8797-4339-ac68-d251443f7e82 | 2024-12-05 09:15:00 | press_release | LAES | SEALSQ Unveils INeS Box to Simplify Digital Identity Provisioning in Manufacturing | change=0.0 | change_1d=2.5641 | change_3d=46.1538 | change_7d=374.359 | intraday=0.0 | tag=multi_window_impact | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - cb9f95f9-55e6-40a7-9165-38b5ced7cb55 | 2024-05-29 10:35:00 | press_release | WSO.B | Watsco to Present at William Blair’s 44th Annual Growth Stock Conference in Chicago on June 4, 2024 at 3:20 p.m. CDT | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$1B-<$100B
  - d0e826ae-3ffb-4012-be35-076cac41a14a | 2026-02-17 07:30:00 | press_release | WSO.B | Watsco Reports Record Full-Year Gross Margin, Meets Inventory Reduction Target and Generates Record 4th Quarter Cash Flow in Challenging Market Conditions | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=None | intraday=0.0 | tag=low_signal | cap=$1B-<$100B

### 7. 일반 corporate PR
- 설명: conference, publication, appointment, facility update 등 일반 PR성 공지
- 총 건수: 51,083
- 영향 미침: 9,740
- 영향 안 미침: 41,343
- 영향 비율: 0.191
- 보수적 순위 점수(Wilson LB): 0.187
- 방향 분해: positive 6,256 / negative 3,484
- median impact score: 10.33
- market cap breakdown: {"$1B-<$100B": {"total": 40142, "impacted": 7627}, ">$=100B": {"total": 4236, "impacted": 861}, "$300M-<$1B": {"total": 6111, "impacted": 1137}, "<$300M or Unknown": {"total": 594, "impacted": 115}}
- source breakdown: {"press_release": {"total": 51083, "impacted": 9740}}
- 대표 사례:
  - 474c70de-d8fa-49ef-a036-ec57cc8de9a9 | 2024-03-27 08:00:00 | press_release | PVLA | Pieris Pharmaceuticals Announces Strategy to Maximize Partnered Milestone and Royalty Potential | change=3.1915 | change_1d=-2.6596 | change_3d=-5.3191 | change_7d=-8.5106 | intraday=2.1053 | tag=sustained_repricing | cap=$1B-<$100B
  - b20bafca-71d1-4b09-aee2-9ab26f10e064 | 2024-11-25 09:05:00 | press_release | LAES | SEALSQ Post-Quantum Chips: Ideal for Securing Critical Infrastructures Against Quantum Attacks | change=4.4444 | change_1d=0.0 | change_3d=-8.8889 | change_7d=-8.8889 | intraday=-6.0 | tag=multi_window_impact | cap=$300M-<$1B
  - e735efd5-5892-458c-8dad-8a57afaf505f | 2025-05-13 17:00:00 | press_release | NKTR | Nektar Therapeutics to Participate in the H.C. Wainwright 3rd Annual BioConnect Investor Conference | change=0.0 | change_1d=1.4085 | change_3d=-2.8169 | change_7d=-2.8169 | intraday=0.0 | tag=sustained_repricing | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 4195dc85-058e-4b53-846e-12c02a9da7d0 | 2024-02-06 07:30:00 | press_release | WSO.B | Watsco to Host 2023 Earnings Call February 13, 2024 | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$1B-<$100B
  - 5deec580-83dc-4d07-9745-2cea55ae7beb | 2024-02-13 07:00:00 | press_release | WSO.B | Watsco Reports Strong 2023 Performance Gaining Share in a Soft Market Boosts Annual Dividend 10% to $10.80 Per Share | change=0.0 | change_1d=0.0 | change_3d=0.0 | change_7d=0.0 | intraday=0.0 | tag=low_signal | cap=$1B-<$100B

### 8. 전략 제휴·라이선스·정부지원·대형 계약
- 설명: partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈
- 총 건수: 12,901
- 영향 미침: 2,450
- 영향 안 미침: 10,451
- 영향 비율: 0.190
- 보수적 순위 점수(Wilson LB): 0.183
- 방향 분해: positive 1,551 / negative 899
- median impact score: 10.05
- market cap breakdown: {"$1B-<$100B": {"total": 10018, "impacted": 1844}, "$300M-<$1B": {"total": 1400, "impacted": 296}, ">$=100B": {"total": 1383, "impacted": 297}, "<$300M or Unknown": {"total": 100, "impacted": 13}}
- source breakdown: {"press_release": {"total": 12901, "impacted": 2450}}
- 대표 사례:
  - 643278e7-acbf-41db-94a5-fb2e34123528 | 2024-11-29 11:02:00 | press_release | LAES | SEALSQ and Parent Company WISeKey Advance AI Integration | change=0.0 | change_1d=14.6341 | change_3d=-4.878 | change_7d=-2.439 | intraday=-4.6512 | tag=sustained_repricing | cap=$300M-<$1B
  - c671cf30-ff16-4aef-a7fa-a2536eddba15 | 2025-02-10 06:30:00 | press_release | GSAT | MDA SPACE SIGNS $1.1B CONTRACT WITH GLOBALSTAR TO BUILD NEXT GENERATION LEO CONSTELLATION | change=3.3113 | change_1d=1511.2583 | change_3d=1363.5762 | change_7d=1376.1589 | intraday=1.2987 | tag=multi_window_impact | cap=$1B-<$100B
  - a7f0bb87-5226-48ed-b4dc-ecb6df1e6e0b | 2024-12-10 08:00:00 | press_release | LAES | SEALSQ Joins Forces with IC’ALPS To Accelerate Secure ASICs Development | change=46.1538 | change_1d=194.8718 | change_3d=348.7179 | change_7d=664.1026 | intraday=39.0244 | tag=multi_window_impact | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 0a3facff-a668-451d-996b-18f6f026af7a | 2026-02-20 16:05:00 | press_release | EXAS | Exact Sciences Stockholders Approve Acquisition by Abbott | change=0.1355 | change_1d=0.0968 | change_3d=-0.0194 | change_7d=0.0871 | intraday=0.1258 | tag=low_signal | cap=$1B-<$100B
  - 5c749a9a-f20c-4580-88af-2a5270bdc22e | 2025-10-22 10:33:00 | press_release | EA | EA SPORTS and The NFL Expand Partnership to Power the Future of Interactive Football | change=0.0997 | change_1d=0.0349 | change_3d=-0.0249 | change_7d=-0.1745 | intraday=0.1447 | tag=low_signal | cap=$1B-<$100B

### 9. 상장·직상장·자본시장 구조 이벤트
- 설명: direct listing, uplisting, Nasdaq listing, market debut 같은 상장 구조 이벤트
- 총 건수: 218
- 영향 미침: 48
- 영향 안 미침: 170
- 영향 비율: 0.220
- 보수적 순위 점수(Wilson LB): 0.170
- 방향 분해: positive 33 / negative 15
- median impact score: 10.03
- market cap breakdown: {"$1B-<$100B": {"total": 176, "impacted": 36}, "$300M-<$1B": {"total": 34, "impacted": 8}, ">$=100B": {"total": 8, "impacted": 4}}
- source breakdown: {"press_release": {"total": 218, "impacted": 48}}
- 대표 사례:
  - f33657f8-613b-4d70-8440-583e3f28ea6a | 2025-10-17 08:59:00 | press_release | OWLS | OBOOK Holdings Inc. Announces Successful Direct Listing on Nasdaq | change=-28.8929 | change_1d=-48.1548 | change_3d=-82.8623 | change_7d=-77.3177 | intraday=12.8571 | tag=multi_window_impact | cap=$300M-<$1B
  - a537cb48-2782-4511-b0b2-d9f098c70d9b | 2025-10-21 17:45:00 | press_release | OWLS | D. Boral Capital Acted as Exclusive Financial Advisor to OBOOK Holdings Inc. (Nasdaq:OWLS) in Connection with its Direct Listing | change=-32.2917 | change_1d=-66.9444 | change_3d=-56.25 | change_7d=-61.4931 | intraday=-31.4587 | tag=multi_window_impact | cap=$300M-<$1B
  - 0dc3b3d4-f7f4-4e15-aa71-b3952990b164 | 2025-10-14 11:01:00 | press_release | TMQ | Canadian Investment Regulatory Organization Trade Resumption - TMQ | change=61.5854 | change_1d=28.9634 | change_3d=-1.5244 | change_7d=-15.2439 | intraday=32.5 | tag=multi_window_impact | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - 1273b893-595a-4958-8417-89641c138d48 | 2025-09-03 07:59:00 | press_release | ARIS | Canadian Investment Regulatory Organization Trading Halt - ARIS | change=-1.0399 | change_1d=-0.0416 | change_3d=-1.0399 | change_7d=0.3744 | intraday=-0.875 | tag=low_signal | cap=$1B-<$100B
  - 443b760b-5bc7-459e-bce3-a8ca175ef75f | 2025-09-03 08:48:00 | press_release | ARIS | Canadian Investment Regulatory Organization Trade Resumption - ARIS | change=-1.0399 | change_1d=-0.0416 | change_3d=-1.0399 | change_7d=0.3744 | intraday=-0.875 | tag=low_signal | cap=$1B-<$100B

### 10. 애널리스트 의견·목표가
- 설명: upgrade, downgrade, price target, initiated coverage 등 sell-side 의견 변화
- 총 건수: 625
- 영향 미침: 118
- 영향 안 미침: 507
- 영향 비율: 0.189
- 보수적 순위 점수(Wilson LB): 0.160
- 방향 분해: positive 65 / negative 53
- median impact score: 10.24
- market cap breakdown: {"$1B-<$100B": {"total": 484, "impacted": 93}, "$300M-<$1B": {"total": 81, "impacted": 12}, ">$=100B": {"total": 58, "impacted": 13}, "<$300M or Unknown": {"total": 2, "impacted": 0}}
- source breakdown: {"press_release": {"total": 625, "impacted": 118}}
- 대표 사례:
  - 7166e721-7457-4621-8eea-9c18cf7da118 | 2025-06-02 16:30:00 | press_release | MFI | Zacks Small-Cap Research Initiates Coverage on mF International Limited | change=35.8885 | change_1d=39.3728 | change_3d=185.7143 | change_7d=207.7816 | intraday=14.7059 | tag=multi_window_impact | cap=$300M-<$1B
  - cda14bd6-7bf6-40e5-9f98-aeeac1798a0b | 2026-01-15 08:00:00 | press_release | FSLY | Fastly to Announce Fourth Quarter and Full Year 2025 Financial Results | change=-0.3802 | change_1d=-1.9011 | change_3d=-3.0961 | change_7d=0.9234 | intraday=-0.4343 | tag=sustained_repricing | cap=$1B-<$100B
  - 2e748bd3-fd3b-49a1-a033-e7c36c7caa98 | 2025-03-27 16:01:00 | press_release | TMC | The Metals Company to Apply for Permits under Existing U.S. Mining Code for Deep-Sea Minerals in the High Seas in Second Quarter of 2025 | change=2.4096 | change_1d=3.6145 | change_3d=0.0 | change_7d=17.4699 | intraday=0.5917 | tag=sustained_repricing | cap=$1B-<$100B
- 반례/영향 약한 사례:
  - 6bdf9539-d793-4e88-9f06-c74a482b764b | 2025-12-23 13:29:00 | press_release | CWAN | CWAN Alert: Monsey Firm of Wohl & Fruchter Investigating Fairness of the Sale of Clearwater Analytics to Permira and Other Investors | change=0.1663 | change_1d=0.5403 | change_3d=0.1663 | change_7d=0.2494 | intraday=0.0415 | tag=low_signal | cap=$1B-<$100B
  - fb352f04-26cb-45df-b156-95f59e4fcc30 | 2024-05-08 07:16:00 | press_release | WTW | WTW boosts global cyber facility with increased capacity and broader coverage options | change=-0.7455 | change_1d=0.2943 | change_3d=-0.463 | change_7d=0.3021 | intraday=-0.7494 | tag=low_signal | cap=$1B-<$100B

### 11. 전략대안·구조조정·생존성
- 설명: strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈
- 총 건수: 212
- 영향 미침: 41
- 영향 안 미침: 171
- 영향 비율: 0.193
- 보수적 순위 점수(Wilson LB): 0.146
- 방향 분해: positive 31 / negative 10
- median impact score: 10.51
- market cap breakdown: {"$1B-<$100B": {"total": 165, "impacted": 28}, "$300M-<$1B": {"total": 26, "impacted": 9}, ">$=100B": {"total": 18, "impacted": 3}, "<$300M or Unknown": {"total": 3, "impacted": 1}}
- source breakdown: {"press_release": {"total": 212, "impacted": 41}}
- 대표 사례:
  - 9fd33d75-e8d5-447d-879e-de11b266d783 | 2025-01-21 17:50:00 | press_release | GSAT | Globalstar Announces Intention to Voluntarily Delist from NYSE American and Transfer to Nasdaq Upon Completion of Reverse Stock Split | change=4.2328 | change_1d=2.6455 | change_3d=4.7619 | change_7d=1.0582 | intraday=3.6842 | tag=sustained_repricing | cap=$1B-<$100B
  - 975c4eca-5a5b-4fa0-ad27-1d438bb9ab7d | 2024-08-01 16:15:00 | press_release | ORKA | ARCA biopharma Announces Second Quarter 2024 Financial Results and Provides Corporate Update | change=-1.3333 | change_1d=3.6667 | change_3d=-4.0 | change_7d=-1.6667 | intraday=0.339 | tag=sustained_repricing | cap=$1B-<$100B
  - 653cf8f5-c3ca-4be5-9822-0c3462d79830 | 2024-11-19 09:45:00 | press_release | LAES | SEALSQ Updates on Minimum Bid Price Non-Compliance | change=-9.8039 | change_1d=-1.9608 | change_3d=-11.7647 | change_7d=-11.7647 | intraday=-6.1224 | tag=sustained_repricing | cap=$300M-<$1B
- 반례/영향 약한 사례:
  - ec7f3ad0-4ee6-42e6-8d97-1f7636ef6826 | 2024-05-31 16:05:00 | press_release | NDAQ | Delisting of Securities of RiskOn International, Inc.; Graphjet Technology; Agile Therapeutics, Inc.; NextPlay Technologies, Inc.; Relativity Acquisition Corp.; iSun, Inc.; Ace Global Business Acquisition Limited; and Marpai, Inc. from The Nasdaq Stoc... | change=-0.0339 | change_1d=-0.525 | change_3d=1.1177 | change_7d=-0.4572 | intraday=-0.3545 | tag=low_signal | cap=$1B-<$100B
  - 4fe2e875-f302-4bd3-a8b4-ece64f2d7790 | 2025-12-01 16:30:00 | press_release | IBP | Installed Building Products Announces New Rating From Fitch of ‘BB+’ | change=-0.7238 | change_1d=-1.7946 | change_3d=0.0634 | change_7d=-0.1567 | intraday=0.5974 | tag=low_signal | cap=$1B-<$100B

### 12. 실적 부진·가이던스 하향
- 설명: miss, lower guidance, weak outlook, revenue decline 등 실적성 악재
- 총 건수: 46
- 영향 미침: 9
- 영향 안 미침: 37
- 영향 비율: 0.196
- 보수적 순위 점수(Wilson LB): 0.107
- 방향 분해: positive 6 / negative 3
- median impact score: 9.55
- market cap breakdown: {"$1B-<$100B": {"total": 37, "impacted": 7}, ">$=100B": {"total": 6, "impacted": 1}, "$300M-<$1B": {"total": 3, "impacted": 1}}
- source breakdown: {"press_release": {"total": 46, "impacted": 9}}
- 대표 사례:
  - c4ab2eb9-0ee0-4131-9477-090f8b206a4f | 2025-06-04 08:05:00 | press_release | SATS | Boost Mobile Debuts the Ultra-Powerful Celero5G TAB--Its First Boost Mobile-Exclusive Tablet Offering | change=0.3096 | change_1d=17.8328 | change_3d=-0.9907 | change_7d=6.935 | intraday=0.434 | tag=sustained_repricing | cap=$1B-<$100B
  - 6eaf9c61-2fd0-4593-bcdd-bb50bff1f36e | 2026-02-25 10:00:00 | press_release | ZD | RetailMeNot Expands Savings Commitment with New Guaranteed Cash Back at Over 4,000 Retailers | change=1.2448 | change_1d=4.3003 | change_3d=5.6582 | change_7d=62.1275 | intraday=1.5513 | tag=sustained_repricing | cap=$1B-<$100B
  - 4f2578a3-36a6-4352-b831-13ef68048f33 | 2024-10-30 08:45:00 | press_release | TSLA | What Opportunities Could The Disruptive Pace Of Technology Today Present? Hear From Cathie Wood At Crossroads Summit On Cutting Through The Chaos | change=-0.7591 | change_1d=-3.7261 | change_3d=-6.4273 | change_7d=11.1783 | intraday=-0.1667 | tag=sustained_repricing | cap=>$=100B
- 반례/영향 약한 사례:
  - e0e252f6-4e26-49a9-9b3a-bc1cfd9ac3f2 | 2025-10-06 11:40:00 | press_release | EA | EA SPORTS™ NHL® 26 and Prime Video Collaborate to Deliver Special Season-Launch Content | change=-0.1146 | change_1d=-0.3338 | change_3d=-0.3189 | change_7d=-0.1993 | intraday=-0.1046 | tag=low_signal | cap=$1B-<$100B
  - 73939681-75b5-45df-98c4-4130cf110cb0 | 2026-02-26 15:29:00 | press_release | AWK | Stay Informed: Never Miss a Notification from American Water | change=0.0745 | change_1d=1.3485 | change_3d=1.1846 | change_7d=0.3055 | intraday=-0.2525 | tag=low_signal | cap=$1B-<$100B

## $300M-<$1B 상위 case

- 1. 임상·규제 성공: impacted=255 / total=922, ratio=0.277, Wilson=0.249
- 2. 임상·규제 실패: impacted=16 / total=44, ratio=0.364, Wilson=0.238
- 3. 실적 호조·가이던스 상향: impacted=11 / total=29, ratio=0.379, Wilson=0.227
- 4. 희석성 자금조달·오퍼링: impacted=154 / total=666, ratio=0.231, Wilson=0.201
- 5. 전략대안·구조조정·생존성: impacted=9 / total=26, ratio=0.346, Wilson=0.194

## $1B-<$100B 상위 case

- 1. 임상·규제 성공: impacted=996 / total=3,557, ratio=0.280, Wilson=0.265
- 2. 실적 호조·가이던스 상향: impacted=65 / total=199, ratio=0.327, Wilson=0.265
- 3. 소송·조사·회계 이슈: impacted=260 / total=1,098, ratio=0.237, Wilson=0.213
- 4. 임상·규제 실패: impacted=45 / total=166, ratio=0.271, Wilson=0.209
- 5. 희석성 자금조달·오퍼링: impacted=924 / total=4,224, ratio=0.219, Wilson=0.207

## >$=100B 상위 case

- 1. 상장·직상장·자본시장 구조 이벤트: impacted=4 / total=8, ratio=0.500, Wilson=0.215
- 2. 전략 제휴·라이선스·정부지원·대형 계약: impacted=297 / total=1,383, ratio=0.215, Wilson=0.194
- 3. 일반 corporate PR: impacted=861 / total=4,236, ratio=0.203, Wilson=0.191
- 4. 소송·조사·회계 이슈: impacted=14 / total=46, ratio=0.304, Wilson=0.191
- 5. 희석성 자금조달·오퍼링: impacted=72 / total=307, ratio=0.235, Wilson=0.191

## 토큰 비용 추정

- 가정: 영어 기사 기준 `1 token ~= 4 chars`, 기사별 프롬프트 오버헤드 180 tokens, 출력 120 tokens
- 전체 문자 수: 537,063,027
- raw input tokens 추정: 134,265,757
- naive article-by-article total tokens 추정: 165,122,257

## 해석

- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 반대일 수 있다.
- 이번 note는 `press_release only` 기준이라, 동일 taxonomy를 다른 source에 그대로 적용하면 비율이 달라질 수 있다.
- `300M~<1B` 버킷은 동일한 뉴스 유형에서도 절대 변동폭이 더 크게 나오기 쉬우므로, 대형주와 같은 기준으로 자르면 과대판정되기 쉽다.
- `<$300M or Unknown` 집단은 전체 데이터에서 비중이 아직 크므로, 다음 단계에서는 market cap 보강이 되면 3개 주 버킷 비교가 더 안정된다.
- 이 note의 내부 사고과정 로그는 내부 독백 전문이 아니라, taxonomy와 threshold를 바꾼 주요 판단을 재현 가능하게 적은 운영 로그다.