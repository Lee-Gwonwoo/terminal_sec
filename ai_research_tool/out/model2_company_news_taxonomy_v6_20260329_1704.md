# Model 2 company_news taxonomy v7 (2025+)

## 분석 범위

- analysis_id: `a99f4a10-ff6d-4929-8ea2-5675af04b99f`
- source_type: `company_news`
- source_name: `FINNHUB`
- 기간: `2025-01-01 ~ 2026-03-29`
- 전체 분류 row: 542,816
- impact 계산 가능 row: 480,707
- impact 판정 row: 96,138
- `fallback rows (잡것들_* + unknown)`: 206,440
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
| <$300M or Unknown | 17.92 | 37.41 | 45.60 |
| $100B~300B | 8.14 | 14.85 | 20.17 |
| $10B~100B | 9.35 | 17.66 | 24.49 |
| $1B~10B | 13.41 | 25.16 | 34.59 |
| $300B~ | 7.68 | 14.58 | 19.56 |
| $300M~1B | 16.77 | 30.25 | 41.59 |

## case 요약

| top_level | case | total | impacted | max impact |
| --- | --- | ---: | ---: | ---: |
| residual | unknown | 166,132 | 27,041 | 1440.32 |
| long | 애널리스트 상향·커버리지 개시 | 31,440 | 5,216 | 976.58 |
| long | 실적 Beat·가이던스 상향 | 25,594 | 5,032 | 1114.55 |
| short | 애널리스트 하향·목표가 하향 | 23,679 | 3,454 | 1073.67 |
| long | 출시·상업화·확장 | 22,982 | 3,665 | 804.89 |
| long | 제휴·라이선스·협업 | 14,836 | 2,550 | 834.27 |
| residual | 투자 논점·알파 아이디어 | 12,387 | 1,960 | 1096.77 |
| residual | 매크로·시장 코멘터리 | 12,245 | 2,206 | 971.43 |
| residual | feature·투자아이디어 해설 | 11,864 | 2,058 | 742.74 |
| long | M&A·전략자산 거래 | 10,425 | 1,525 | 486.06 |
| residual | 실적 transcript·snapshot | 7,775 | 1,443 | 1760.66 |
| short | 소송·조사·회계 리스크 | 7,651 | 1,761 | 795.85 |
| short | peer 경쟁 심화 read-through | 7,470 | 1,164 | 1236.81 |
| short | 실적 Miss·가이던스 하향 | 7,284 | 1,273 | 1760.66 |
| long | 급등 해설·상승 이유 | 6,487 | 1,740 | 675.10 |
| residual | 실적 발표 전 기대 기사 | 6,348 | 1,079 | 1273.44 |
| short | 미디어 증폭·하락 해설 | 6,237 | 1,485 | 661.98 |
| residual | 가이던스·전망 업데이트 | 5,400 | 999 | 192.02 |
| residual | 주가 움직임 이유·해설 | 5,389 | 862 | 383.02 |
| long | 제품·기술 통합·AI 도입 | 4,608 | 892 | 168.68 |
| residual | 멀티종목 movers 기사 | 4,478 | 1,025 | 638.43 |
| residual | 암호화폐·디지털자산 이벤트 | 4,346 | 1,330 | 675.10 |
| residual | 실적 결과 보도(중립) | 4,267 | 914 | 1760.66 |
| long | 밸류에이션 discount 해소 | 3,999 | 512 | 222.06 |
| long | AI 인프라 투자·데이터센터 | 3,949 | 949 | 264.36 |
| long | 수요 급증·백로그 확대 | 3,637 | 581 | 189.53 |
| short | 희석성 자금조달 | 3,492 | 885 | 675.10 |
| residual | 실적 vs 추정치 비교 | 3,321 | 574 | 112.34 |
| residual | 잡것들_행사·인터뷰·홍보성 | 3,177 | 485 | 1109.86 |
| long | 대형 딜·인프라 투자 | 3,170 | 619 | 216.46 |
| residual | 잡것들_짐 크래머 언급·의견 | 3,142 | 563 | 182.82 |
| long | 미디어 증폭·상승 해설 | 3,088 | 1,180 | 648.56 |
| residual | 거래소·지수 편입/편출 | 2,927 | 431 | 187.55 |
| residual | 잡것들_수상·인증·랭킹 | 2,796 | 348 | 113.74 |
| residual | 잡것들_가상수익 계산 기사 | 2,754 | 332 | 606.40 |
| residual | 잡것들_자본수익률 필러 | 2,558 | 381 | 267.54 |
| residual | 잡것들_적정가치 DCF 필러 | 2,551 | 249 | 660.77 |
| residual | 잡것들_관련없는 종목 태그 | 2,413 | 423 | 139.68 |
| residual | 실적 요약·평가 기사 | 2,396 | 386 | 165.99 |
| residual | 섹터별 장중 movers 기사 | 2,353 | 1,119 | 1049.76 |
| residual | 잡것들_캐시우드 언급·매매 | 2,332 | 429 | 292.64 |
| short | 구조조정·생존성 악화 | 2,181 | 347 | 98.78 |
| long | 임상 데이터·중간결과 업데이트 | 2,102 | 526 | 648.56 |
| long | 애널리스트 코멘트 증폭(긍정) | 1,995 | 444 | 162.50 |
| long | 자사주 매입·주주환원 | 1,926 | 269 | 216.53 |
| long | 매출 성장·마일스톤 달성 | 1,919 | 323 | 93.78 |
| long | 애널리스트 투자의견 재확인(긍정) | 1,835 | 374 | 350.94 |
| residual | 인기종목·시장 잡담 | 1,814 | 395 | 183.81 |
| long | 신재생에너지 마일스톤 | 1,797 | 410 | 176.54 |
| long | 고객 채택·대형 고객 확보 | 1,793 | 296 | 120.08 |
| long | 양자컴퓨팅 이벤트 | 1,739 | 623 | 200.80 |
| residual | 관세·무역 분쟁 영향 | 1,721 | 386 | 216.53 |
| residual | Fed 금리 결정·FOMC | 1,692 | 255 | 122.37 |
| short | 급락 해설·하락 이유 | 1,523 | 409 | 1117.17 |
| residual | 잡것들_실적 일정·컨퍼런스콜 공지 | 1,382 | 227 | 257.42 |
| residual | 잡것들_Spotlight/Radar 자동 기사 | 1,313 | 184 | 197.86 |
| long | 숏커버·매수 유입 | 1,300 | 231 | 712.75 |
| short | 공급망 차질·원가 압박 | 1,293 | 494 | 780.14 |
| residual | 섹터 업데이트·코멘터리 | 1,280 | 267 | 350.94 |
| residual | 바이오 파이프라인·학회 발표 | 1,270 | 211 | 221.96 |
| residual | 잡것들_정치·지정학 노이즈(종목 무관) | 1,196 | 193 | 191.73 |
| residual | 잡것들_배당수익률·소극적 소득 필러 | 1,174 | 76 | 44.74 |
| residual | 잡것들_Best/Worst 리스트 기사 | 1,157 | 179 | 181.51 |
| residual | 종목 비교·vs 기사 | 1,019 | 114 | 83.57 |
| residual | 잡것들_사소한 인사·임원 선임 | 886 | 128 | 146.25 |
| residual | 잡것들_Unpopular Stocks 필러 | 858 | 94 | 89.45 |
| residual | 기술적 분석·차트 시그널 | 837 | 178 | 292.64 |
| long | 승인·임상 호재 | 821 | 126 | 648.56 |
| residual | 잡것들_Needham Hold 재확인(무변동) | 817 | 76 | 163.97 |
| residual | 잡것들_오늘의 종목·편집형 추천 | 816 | 143 | 235.86 |
| residual | 애널리스트 컨센서스·다수의견 | 792 | 109 | 135.38 |
| residual | 배당 정책 변경 | 792 | 43 | 76.65 |
| residual | 중국 무역·규제 이벤트 | 790 | 173 | 99.67 |
| residual | 공매도 비율·변동 | 780 | 107 | 145.89 |
| long | 경영진 보강·거버넌스 개선 | 779 | 141 | 350.94 |
| residual | 잡것들_배당 기준일 필러 | 775 | 47 | 70.48 |
| long | 원자력·SMR 이벤트 | 761 | 222 | 114.49 |
| residual | IPO·상장 이벤트 | 736 | 176 | 675.10 |
| residual | 잡것들_Zacks Trending 필러 | 728 | 100 | 83.76 |
| long | 의약품 지정·우선심사 | 727 | 147 | 160.28 |
| long | 배당 개시·특별배당 | 716 | 51 | 42.61 |
| residual | 이례적 옵션 활동 | 714 | 189 | 147.22 |
| long | 소송 합의·분쟁 해소 | 712 | 100 | 114.51 |
| residual | 잡것들_워런 버핏 언급 | 712 | 63 | 39.56 |
| residual | 잡것들_트럼프 SNS 포스트 노이즈 | 709 | 95 | 96.10 |
| residual | 잡것들_기관 보유·지분구조 필러 | 694 | 157 | 197.86 |
| residual | 잡것들_ChartMill 기술적 필러 | 679 | 51 | 201.98 |
| short | 내부자 매도·우려 시그널 | 667 | 88 | 93.35 |
| long | 유전자·세포치료 이벤트 | 656 | 197 | 547.41 |
| residual | 잡것들_리스트형 screener 노이즈 | 633 | 122 | 2267.06 |
| short | 밸류에이션 부담·과열 | 632 | 139 | 97.98 |
| long | 스핀오프·분사 이벤트 | 616 | 123 | 228.22 |
| short | 정책·법안 역풍 read-through | 583 | 124 | 64.58 |
| residual | 내부자 거래 공시(Form4) | 580 | 74 | 155.03 |
| long | 바이오 독점권·특허 연장 | 573 | 51 | 284.23 |
| residual | 잡것들_ETF·펀드 코멘터리 | 571 | 85 | 70.40 |
| long | 비만·GLP-1 관련 이벤트 | 566 | 115 | 127.12 |
| long | 정부·대형 계약 수주 | 554 | 145 | 1511.26 |
| long | 행동주의 투자자 이벤트 | 544 | 77 | 237.48 |
| residual | 잡것들_CSR·지역사회 활동 노이즈 | 540 | 69 | 66.72 |
| residual | 미국 정부 정책·행정명령 | 515 | 84 | 158.27 |
| long | 피인수·프리미엄 거래 | 502 | 81 | 66.90 |
| short | 바이오 투자자 소송·조사 | 490 | 140 | 238.21 |
| residual | 유가·에너지·원자재 영향 | 488 | 87 | 262.82 |
| residual | 실적 콜 요약 | 433 | 46 | 105.37 |
| residual | 실적 혼재·엇갈림 | 432 | 75 | 89.93 |
| residual | 지정학·전쟁·긴장 영향 | 424 | 39 | 55.15 |
| residual | 부동산·프롭테크 이벤트 | 422 | 39 | 170.33 |
| long | 희귀질환·오판약 이벤트 | 419 | 68 | 154.15 |
| long | 여신 확대·부채 관리 | 412 | 60 | 346.63 |
| long | AI 파트너십·딜 | 381 | 74 | 267.50 |
| residual | 잡것들_멀티종목 나열·언급만 | 374 | 50 | 84.25 |
| long | 원가 절감·마진 개선 | 372 | 71 | 78.65 |
| residual | 잡것들_백만장자 가능? 클릭베이트 | 369 | 44 | 145.89 |
| short | 거래정지·역분할·상장유지 스트레스 | 366 | 179 | 3646.27 |
| short | 규제·임상 악재 | 358 | 95 | 371.07 |
| long | 유통·판매 계약 | 346 | 77 | 111.40 |
| residual | 잡것들_NYSE 벨 행사 노이즈 | 328 | 81 | 262.82 |
| residual | 바이오 학회 데이터·포스터 발표 | 324 | 66 | 366.86 |
| long | 핵심광물·희소금속 이벤트 | 314 | 105 | 173.40 |
| residual | 잡것들_은퇴·개인자산 관리 기사 | 292 | 16 | 86.13 |
| residual | 잡것들_애널리스트 레이팅 종합 나열 | 288 | 33 | 105.30 |
| long | 내부자 매수·자신감 시그널 | 271 | 47 | 192.55 |
| residual | 잡것들_개인 재테크·돈 관리 노이즈 | 270 | 39 | 774.01 |
| long | 의약품 판매허가(비FDA) | 267 | 68 | 247.87 |
| long | 인프라 법안·지출 | 261 | 39 | 68.20 |
| residual | 기관 포트폴리오 변경(13F) | 259 | 31 | 113.74 |
| residual | 스트리밍·미디어 이벤트 | 254 | 45 | 66.13 |
| long | 수소·연료전지 이벤트 | 245 | 105 | 152.59 |
| residual | EV 인도·생산 실적 | 237 | 50 | 62.59 |
| long | 비상장화·바이아웃 | 228 | 40 | 57.63 |
| residual | 주식분할·병합 이벤트 | 225 | 52 | 219.08 |
| long | 광산·자원 업데이트 | 220 | 61 | 227.24 |
| short | 바이오 안전성 우려 | 218 | 59 | 211.80 |
| short | 차익실현·매도 수급 | 216 | 72 | 120.19 |
| long | FDA 절차 진행·수리 | 214 | 46 | 107.33 |
| short | 사이버보안 침해 이벤트 | 212 | 33 | 70.40 |
| residual | 소비자·브랜드 이벤트 | 210 | 15 | 42.72 |
| residual | 잡것들_공매도 보고서 공격 | 207 | 73 | 82.77 |
| long | 전력·유틸리티 인프라 이벤트 | 203 | 29 | 66.80 |
| residual | 잡것들_모멘텀·실적 뒤따르기 필러 | 199 | 28 | 60.91 |
| long | 정부 계약 수주 정보(flow) | 194 | 36 | 57.71 |
| residual | 잡것들_주주총회 투표 결과 | 186 | 27 | 675.10 |
| residual | 건자재·주택건설 이벤트 | 184 | 7 | 25.76 |
| residual | 일간 지수·시장 요약 | 163 | 65 | 648.56 |
| long | 임상시험 개시·첫 투약 | 154 | 46 | 250.53 |
| residual | 특허·IP 이벤트 | 141 | 25 | 62.54 |
| long | 위성·우주통신 이벤트 | 138 | 48 | 1236.81 |
| long | 드론·UAV 방산 이벤트 | 133 | 58 | 101.59 |
| long | 임상3상 긍정 결과 | 128 | 30 | 227.82 |
| residual | 광산 생산 실적·가이던스 | 127 | 35 | 59.71 |
| short | 애널리스트 코멘트 증폭(부정) | 124 | 29 | 661.98 |
| residual | 바이오 실사용 데이터·레지스트리 | 123 | 15 | 238.21 |
| long | 반도체 기술 진보 | 120 | 26 | 249.46 |
| long | 비FDA 규제기관 승인·조치 | 119 | 17 | 160.28 |
| long | 부채 관리·리파이낸싱 | 112 | 25 | 60.14 |
| residual | 잡것들_무관 자회사·타사 뉴스 태그 | 107 | 19 | 71.75 |
| long | 임상2상 긍정 결과 | 99 | 25 | 648.56 |
| long | EV·전기차 제품 이벤트 | 99 | 15 | 840.37 |
| residual | 잡것들_Top Gainers/Losers 목록 | 98 | 57 | 238.11 |
| long | 사이버보안 이벤트 | 95 | 23 | 31.97 |
| residual | ESG·지속가능성 이벤트 | 94 | 16 | 61.08 |
| residual | 서킷브레이커·일시정지 | 92 | 65 | 648.56 |
| residual | 프리마켓·애프터마켓 movers | 87 | 19 | 45.45 |
| residual | 보험·인슈어테크 이벤트 | 86 | 15 | 46.74 |
| short | 애널리스트 전망 하향 수정 | 82 | 15 | 1202.82 |
| short | 공급망 차질 이벤트 | 81 | 23 | 118.17 |
| residual | 혼합 선반등록·Shelf Filing | 81 | 21 | 166.10 |
| long | 애널리스트 전망 상향 수정 | 81 | 19 | 106.57 |
| residual | 잡것들_이벤트 일정·스케줄 공지 | 76 | 19 | 76.16 |
| long | 핀테크·결제 이벤트 | 71 | 17 | 139.46 |
| long | 바이오 등록·모집 마일스톤 | 70 | 25 | 182.77 |
| residual | 갭 상승/하락 종목 | 69 | 25 | 66.54 |
| long | 정책·법안 수혜 read-through | 60 | 19 | 63.77 |
| residual | 게임·엔터테인먼트 이벤트 | 57 | 17 | 41.40 |
| residual | 잡것들_SPY/QQQ 매크로 기사 태그 | 57 | 6 | 52.46 |
| residual | 잡것들_인덱스 재구성·펀드 리밸런스 | 49 | 5 | 139.70 |
| long | AI 모델·제품 출시 | 47 | 10 | 176.56 |
| long | 위성 스펙트럼·규제 인가 | 46 | 10 | 40.69 |
| residual | 패션·의류 산업 이벤트 | 46 | 6 | 57.14 |
| residual | 은행·여신 이벤트 | 45 | 11 | 72.25 |
| residual | 사업부 매각·자산 처분 | 45 | 9 | 35.08 |
| short | 약가 정책·CMS 모델 | 44 | 8 | 27.92 |
| long | SPAC 합병·디스팩 | 40 | 3 | 50.58 |
| residual | REIT·부동산 자산 이벤트 | 37 | 2 | 34.99 |
| long | 반도체 디자인윈 | 36 | 8 | 195.12 |
| long | 자비적 사용·확대접근 프로그램 | 35 | 5 | 29.32 |
| residual | 잡것들_Fintel 가격 목표 필러 | 30 | 5 | 36.54 |
| long | 우주·방산 발사 계약 | 29 | 10 | 94.43 |
| long | 광산 탐사·발견 | 28 | 9 | 246.67 |
| short | 경영진 이탈·거버넌스 충격 | 28 | 7 | 235.86 |
| long | peer 호조 read-through | 27 | 6 | 264.36 |
| long | 바이오 약물 상업화·매출 성장 | 25 | 6 | 120.85 |
| residual | 워런트 행사·전환 | 24 | 6 | 52.46 |
| long | 바이오 파이프라인 인수·라이선스인 | 23 | 5 | 660.77 |
| long | 기관 지분 공시·13D/13G | 22 | 3 | 29.40 |
| long | CIM·뉴로모픽 컴퓨팅 | 21 | 7 | 155.31 |
| short | 바이오 프로그램 중단 | 19 | 4 | 65.23 |
| long | 신규 자사주 매입 프로그램 | 16 | 0 | 24.61 |
| residual | 시장 영향 뉴스 다이제스트 | 15 | 11 | 156.35 |
| residual | 잡것들_섹터별 실적 시즌 회고 | 15 | 4 | 57.19 |
| long | 헬륨·특수가스 이벤트 | 10 | 0 | 14.88 |
| residual | 본사 이전·법인 전환 | 9 | 4 | 632.98 |
| long | 광산 정부 지원·도로 건설 | 5 | 5 | 407.18 |
| long | 공급망 완화·원가 개선 | 1 | 0 | 5.95 |

## 유형 정의

### unknown (`unknown`)
- 상위 분류: `residual`
- 한 줄 정의: 현재 taxonomy rule 어디에도 안정적으로 들어가지 않는 미분류 기사.
- 핵심 가치 경로: 사건성은 있을 수 있으나 rule 미정
- 포함 신호: 
- 제외 신호: 명확한 기존 case, 명백한 잡것들_ 노이즈 패턴
- 빠른 판별 질문: 현재 rule로는 안정 분류가 안 되는가?
- 집계: total=166,132, impacted=27,041, max impact=1440.32
- 대표 예시:
  - 2025-05-09T14:29:10 | NKTR | Q1 2025 Nektar Therapeutics Earnings Call | score=1440.32 | tag=sustained_repricing
  - 2025-08-22T11:15:00 | LCID | An SUV That Rides Like a Dream—for Audiophiles | score=999.52 | tag=sustained_repricing

### 애널리스트 상향·커버리지 개시 (`analyst_upgrade_positive`)
- 상위 분류: `long`
- 한 줄 정의: upgrade, coverage initiation, target raise 중심.
- 핵심 가치 경로: sell-side 상향→re-rating
- 포함 신호: initiates coverage, outperform, raises price target
- 제외 신호: target cut, downgraded
- 빠른 판별 질문: formal upgrade?
- 집계: total=31,440, impacted=5,216, max impact=976.58
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
- 집계: total=25,594, impacted=5,032, max impact=1114.55
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
- 집계: total=23,679, impacted=3,454, max impact=1073.67
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
- 집계: total=22,982, impacted=3,665, max impact=804.89
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
- 집계: total=14,836, impacted=2,550, max impact=834.27
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
- 집계: total=12,387, impacted=1,960, max impact=1096.77
- 대표 예시:
  - 2025-01-17T07:00:19 | GSAT | How Is The Market Feeling About Globalstar? | score=1096.77 | tag=sustained_repricing
  - 2025-08-27T00:03:57 | LCID | Lucid (LCID): Buy, Sell, or Hold Post Q2 Earnings? | score=1042.65 | tag=multi_window_impact

### 매크로·시장 코멘터리 (`macro_market_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: 금리, Fed, 인플레이션, 지수 움직임 광범위 설명.
- 핵심 가치 경로: 외부 환경 read-through
- 포함 신호: stock market today, fed, inflation, recession, economic slowdown
- 제외 신호: single-company event
- 빠른 판별 질문: 멀티종목 매크로?
- 집계: total=12,245, impacted=2,206, max impact=971.43
- 대표 예시:
  - 2025-03-13T05:52:29 | RGC | Nasdaq Down Over 100 Points; US Producer Inflation Stalls In February | score=971.43 | tag=multi_window_impact
  - 2025-06-05T16:04:50 | CRCL | Stock market today: Dow, S&P 500, Nasdaq slide as Tesla dives 14% on Trump-Musk escalation | score=675.10 | tag=multi_window_impact

### feature·투자아이디어 해설 (`generic_feature_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: deep dive, feature, opinion article.
- 핵심 가치 경로: opinion layer
- 포함 신호: is it a buy, deep dive, feature
- 제외 신호: formal analyst
- 빠른 판별 질문: feature/opinion?
- 집계: total=11,864, impacted=2,058, max impact=742.74
- 대표 예시:
  - 2025-08-14T11:08:26 | LCID | Why Lucid Stock Jumped 16.6% in July | score=742.74 | tag=sustained_repricing
  - 2025-10-08T02:14:26 | PRAX | Assessing Praxis Precision Medicines (PRAX) Valuation After Recent Share Price Momentum | score=254.40 | tag=sustained_repricing

### M&A·전략자산 거래 (`mna_strategic_asset_positive`)
- 상위 분류: `long`
- 한 줄 정의: acquisition, merger, buyout, strategic investment.
- 핵심 가치 경로: 전략 자산 재평가→premium 기대
- 포함 신호: acquisition, merger, buyout, strategic investment
- 제외 신호: distress sale
- 빠른 판별 질문: 자산 거래 핵심?
- 집계: total=10,425, impacted=1,525, max impact=486.06
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
- 집계: total=7,775, impacted=1,443, max impact=1760.66
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
- 집계: total=7,651, impacted=1,761, max impact=795.85
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
- 집계: total=7,470, impacted=1,164, max impact=1236.81
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
- 집계: total=7,284, impacted=1,273, max impact=1760.66
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
- 집계: total=6,487, impacted=1,740, max impact=675.10
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
- 집계: total=6,348, impacted=1,079, max impact=1273.44
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
- 집계: total=6,237, impacted=1,485, max impact=661.98
- 대표 예시:
  - 2025-08-06T15:58:19 | LCID | Why Lucid Group Stock Is Plummeting Today | score=661.98 | tag=sustained_repricing
  - 2025-08-06T09:19:22 | LCID | Why Lucid Group (LCID) Stock Is Plummeting Today | score=661.98 | tag=sustained_repricing

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

### 주가 움직임 이유·해설 (`stock_why_moving_explanation`)
- 상위 분류: `residual`
- 한 줄 정의: what's going on with X stock, here's why.
- 핵심 가치 경로: 이유 해설→정보 전달
- 포함 신호: what's going on with, here's why, what's behind, what's driving
- 제외 신호: 
- 빠른 판별 질문: 주가 움직임 이유 해설?
- 집계: total=5,389, impacted=862, max impact=383.02
- 대표 예시:
  - 2025-10-07T09:05:49 | GLTO | What's Going On With Nano-Cap Galecto Stock On Tuesday? | score=383.02 | tag=multi_window_impact
  - 2025-08-13T13:12:00 | OPEN | Here's Why Everyone Is Talking About Opendoor Technologies Stock | score=284.41 | tag=multi_window_impact

### 제품·기술 통합·AI 도입 (`product_technology_integration`)
- 상위 분류: `long`
- 한 줄 정의: tech integration, AI adoption, platform integration.
- 핵심 가치 경로: 기술 역량 강화→경쟁력
- 포함 신호: integrates, adopts.*ai, ai agent, platform integration
- 제외 신호: 
- 빠른 판별 질문: 기술 통합 이벤트?
- 집계: total=4,608, impacted=892, max impact=168.68
- 대표 예시:
  - 2025-01-30T04:16:04 | BBAI | BigBear.ai Awarded Prime IDIQ Contract for U.S. Department of Navy's SeaPort Next Generation (NxG) | score=168.68 | tag=multi_window_impact
  - 2025-08-21T08:00:00 | RZLV | Rezolve Ai to Participate in Citi’s 2025 Global TMT Conference | score=136.96 | tag=sustained_repricing

### 멀티종목 movers 기사 (`market_movers_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: 여러 종목 top movers 나열.
- 핵심 가치 경로: 스크리너/요약
- 포함 신호: other big stocks moving, most active stocks, top stocks
- 제외 신호: single-ticker
- 빠른 판별 질문: 멀티종목 roundup?
- 집계: total=4,478, impacted=1,025, max impact=638.43
- 대표 예시:
  - 2025-05-06T06:02:52 | RGC | FARO Technologies, Celanese, Avient, Aramark And Other Big Stocks Moving Higher On Tuesday | score=638.43 | tag=multi_window_impact
  - 2025-10-07T17:35:11 | GLTO | POET Technologies, Oracle, Nuburu, Galecto And TMC The Metals Company: Why These 5 Stocks Are On Investors' Radars Today | score=383.02 | tag=multi_window_impact

### 암호화폐·디지털자산 이벤트 (`crypto_digital_asset_event`)
- 상위 분류: `residual`
- 한 줄 정의: crypto, stablecoin, blockchain events.
- 핵심 가치 경로: 디지털자산 이벤트→재평가
- 포함 신호: bitcoin, stablecoin, cryptocurrency, blockchain, crypto exchange
- 제외 신호: 
- 빠른 판별 질문: 암호화폐 이벤트?
- 집계: total=4,346, impacted=1,330, max impact=675.10
- 대표 예시:
  - 2025-06-05T18:00:00 | CRCL | How stablecoins could shape the future of digital money | score=675.10 | tag=multi_window_impact
  - 2025-06-05T09:07:07 | CRCL | May jobs report, Broadcom earnings, Circle IPO: 3 Things | score=675.10 | tag=multi_window_impact

### 실적 결과 보도(중립) (`earnings_revenue_report_neutral`)
- 상위 분류: `residual`
- 한 줄 정의: beat/miss 프레이밍 없이 결과 보도.
- 핵심 가치 경로: 사실 보도
- 포함 신호: reports q4, reports financial results
- 제외 신호: beat, miss
- 빠른 판별 질문: 중립 보도?
- 집계: total=4,267, impacted=914, max impact=1760.66
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
- 집계: total=3,999, impacted=512, max impact=222.06
- 대표 예시:
  - 2025-05-12T06:50:00 | CTMX | CytomX Therapeutics Announces Pricing of $100 Million Underwritten Offering of Common Stock | score=222.06 | tag=multi_window_impact
  - 2026-01-06T15:38:40 | SNDK | 3 semiconductor stocks to play the AI supercycle, according to analysts | score=118.17 | tag=multi_window_impact

### AI 인프라 투자·데이터센터 (`ai_infrastructure_investment`)
- 상위 분류: `long`
- 한 줄 정의: AI cloud, hyperscaler capex, GPU cluster.
- 핵심 가치 경로: AI 인프라 TAM→매출 기대
- 포함 신호: ai infrastructure, hyperscal, gpu cluster, ai cloud, ai.*data center, ai.*capex
- 제외 신호: 
- 빠른 판별 질문: AI 인프라?
- 집계: total=3,949, impacted=949, max impact=264.36
- 대표 예시:
  - 2025-05-01T13:19:25 | CRWV | CoreWeave shares jump as hyperscalers boosts AI spend | score=264.36 | tag=multi_window_impact
  - 2025-05-15T08:30:00 | NVTS | Navitas Hosts “AI Tech Night” to Reveal Next Generation Platform for Hyperscale Data Centers | score=228.23 | tag=sustained_repricing

### 수요 급증·백로그 확대 (`demand_backlog_positive`)
- 상위 분류: `long`
- 한 줄 정의: strong demand, bookings, backlog growth.
- 핵심 가치 경로: 수요 가시성→매출 지속성
- 포함 신호: strong demand, backlog, bookings growth
- 제외 신호: macro commentary
- 빠른 판별 질문: 수요/백로그 직접 언급?
- 집계: total=3,637, impacted=581, max impact=189.53
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
- 집계: total=3,492, impacted=885, max impact=675.10
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
- 집계: total=3,321, impacted=574, max impact=112.34
- 대표 예시:
  - 2025-08-07T09:30:08 | AVAH | Aveanna (AVAH) Reports Q2 Earnings: What Key Metrics Have to Say | score=112.34 | tag=multi_window_impact
  - 2025-08-01T10:30:01 | SATS | Compared to Estimates, EchoStar (SATS) Q2 Earnings: A Look at Key Metrics | score=96.10 | tag=multi_window_impact

### 잡것들_행사·인터뷰·홍보성 (`잡것들_promotional_appearance_noise`)
- 상위 분류: `residual`
- 한 줄 정의: conference participation, podcast, fireside chat.
- 핵심 가치 경로: IR 노출
- 포함 신호: participate in, investor conference, fireside chat
- 제외 신호: 
- 빠른 판별 질문: 홍보 노출?
- 집계: total=3,177, impacted=485, max impact=1109.86
- 대표 예시:
  - 2025-05-13T17:00:00 | NKTR | Nektar Therapeutics to Participate in the H.C. Wainwright 3rd Annual BioConnect Investor Conference | score=1109.86 | tag=sustained_repricing
  - 2025-08-05T08:00:00 | LCID | Lucid Diagnostics to Participate in Upcoming Investor Conferences | score=663.90 | tag=sustained_repricing

### 대형 딜·인프라 투자 (`corporate_deal_billion_positive`)
- 상위 분류: `long`
- 한 줄 정의: multi-billion dollar deals, infrastructure.
- 핵심 가치 경로: 대형 매출·투자→가치 재평가
- 포함 신호: billion deal, multiyear deal, data center, infrastructure
- 제외 신호: 
- 빠른 판별 질문: 대형 계약/투자?
- 집계: total=3,170, impacted=619, max impact=216.46
- 대표 예시:
  - 2026-01-06T17:30:58 | VTYX | Ventyx Biosciences Launches On Rumored $1 Billion Eli Lilly Takeover | score=216.46 | tag=multi_window_impact
  - 2026-01-06T15:40:00 | VTYX | Eli Lilly Nears Deal for Biotech Ventyx | score=216.46 | tag=multi_window_impact

### 잡것들_짐 크래머 언급·의견 (`잡것들_jim_cramer_mention`)
- 상위 분류: `residual`
- 한 줄 정의: Jim Cramer says, likes, mentions 형태.
- 핵심 가치 경로: 미디어 인물 언급
- 포함 신호: jim cramer.*says, jim cramer.*on, jim cramer.*likes, cramer.*says.*skip, cramer.*bullish on
- 제외 신호: 
- 빠른 판별 질문: 짐 크래머?
- 집계: total=3,142, impacted=563, max impact=182.82
- 대표 예시:
  - 2025-04-22T18:52:00 | CRWV | Jim Cramer on CoreWeave (CRWV): “A Lot of It Is With OpenAI” | score=182.82 | tag=sustained_repricing
  - 2025-04-30T16:03:32 | CRWV | CoreWeave, Inc. (CRWV): Jim Cramer Likes It — But Can It Beat the GPU Depreciation Doubts? | score=180.71 | tag=multi_window_impact

### 미디어 증폭·상승 해설 (`media_amplification_positive`)
- 상위 분류: `long`
- 한 줄 정의: top mover, shares higher, soaring today.
- 핵심 가치 경로: 노출 증폭→추격 수급
- 포함 신호: soaring today, trading higher today, top mover, biggest gainer
- 제외 신호: formal upgrade
- 빠른 판별 질문: 이미 오른 뒤 해설?
- 집계: total=3,088, impacted=1,180, max impact=648.56
- 대표 예시:
  - 2025-07-08T03:32:21 | PROK | Market-Moving News for July 8th | score=648.56 | tag=multi_window_impact
  - 2025-11-19T07:22:07 | WSHP | WeShop Holdings shares are trading higher amid volatility following the stock's recent Nasdaq debut. | score=557.89 | tag=multi_window_impact

### 거래소·지수 편입/편출 (`exchange_listing_index_change`)
- 상위 분류: `residual`
- 한 줄 정의: Index inclusion, Russell reconstitution, S&P 500 add.
- 핵심 가치 경로: 수급 변화→포지셔닝
- 포함 신호: added to.*index, russell.*index, s&p 500.*add, index reconstitution, bloomberg.*index
- 제외 신호: 
- 빠른 판별 질문: 지수 편입/편출?
- 집계: total=2,927, impacted=431, max impact=187.55
- 대표 예시:
  - 2025-04-10T16:15:00 | BW | Babcock & Wilcox Enterprises Receives Continued Listing Standard Notice from NYSE | score=187.55 | tag=sustained_repricing
  - 2025-11-25T07:00:00 | CLYM | Climb Bio Reports Inducement Grant Under Nasdaq Listing Rule 5635(c)(4) | score=152.27 | tag=sustained_repricing

### 잡것들_수상·인증·랭킹 (`잡것들_company_award_recognition`)
- 상위 분류: `residual`
- 한 줄 정의: award, ranked, named one of.
- 핵심 가치 경로: 인지도 이벤트
- 포함 신호: named one of, award, ranked, top performing
- 제외 신호: 
- 빠른 판별 질문: 수상/랭킹?
- 집계: total=2,796, impacted=348, max impact=113.74
- 대표 예시:
  - 2026-02-17T17:13:49 | CRCL | Stripe-Owned Bridge Gains National Bank Trust Charter to Boost Stablecoin Offerings | score=113.74 | tag=sustained_repricing
  - 2025-12-19T02:31:51 | BW | Babcock & Wilcox Awarded $40M Contract To Supply Low-Pressure Wet Gas Scrubbing Technology For Canadian Petroleum Refinery, Expanding Prior $10M Order | score=96.47 | tag=sustained_repricing

### 잡것들_가상수익 계산 기사 (`잡것들_hypothetical_return_calculator`)
- 상위 분류: `residual`
- 한 줄 정의: $X invested Y years ago 유형의 역사적 수익 계산 기사.
- 핵심 가치 경로: 트래픽 유도
- 포함 신호: invested.*years ago, \$1000 invested, \$100 invested, \$10.*invested, worth this much today, if you.*invested.*you would
- 제외 신호: 
- 빠른 판별 질문: 가상수익 계산?
- 집계: total=2,754, impacted=332, max impact=606.40
- 대표 예시:
  - 2025-07-31T07:32:00 | LCID | If You'd Invested $1,000 in Lucid Stock 4 Years Ago, Here's How Much You'd Have Today | score=606.40 | tag=sustained_repricing
  - 2025-12-18T07:45:42 | UAMY | Here's How Much $1000 Invested In United States Antimony 5 Years Ago Would Be Worth Today | score=124.45 | tag=multi_window_impact

### 잡것들_자본수익률 필러 (`잡것들_returns_on_capital_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Returns on capital heading higher, ROIC analysis.
- 핵심 가치 경로: 자본수익률 분석
- 포함 신호: returns on capital.*heading higher, returns on capital.*are heading, investors should be encouraged
- 제외 신호: 
- 빠른 판별 질문: 자본수익률 필러?
- 집계: total=2,558, impacted=381, max impact=267.54
- 대표 예시:
  - 2025-05-22T16:54:58 | NVTS | Intel Scores Slot In Nvidia Data Center AI System | score=267.54 | tag=multi_window_impact
  - 2026-01-06T16:30:00 | SNDK | These Stocks Moved the Most Today: Sandisk, Nvidia, AMD, Palantir, OneStream, SoFi, Microchip, and More | score=118.17 | tag=multi_window_impact

### 잡것들_적정가치 DCF 필러 (`잡것들_fair_value_dcf_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Calculating fair value, DCF model estimate 유형 필러.
- 핵심 가치 경로: 자동 DCF 기사
- 포함 신호: calculating the fair value, estimating the fair value, fair value.*us\$, dcf.*model.*undervalued
- 제외 신호: 
- 빠른 판별 질문: DCF 필러?
- 집계: total=2,551, impacted=249, max impact=660.77
- 대표 예시:
  - 2025-06-25T08:53:01 | VOR | Estimating The Fair Value Of Vor Biopharma Inc. (NASDAQ:VOR) | score=660.77 | tag=multi_window_impact
  - 2025-08-11T06:51:36 | XFOR | X4 Pharmaceuticals Second Quarter 2025 Earnings: Beats Expectations | score=166.44 | tag=multi_window_impact

### 잡것들_관련없는 종목 태그 (`잡것들_unrelated_ticker_mention`)
- 상위 분류: `residual`
- 한 줄 정의: SPY/QQQ/NVDA/AMZN 등 mega-cap 뉴스가 무관한 소형주에 태그.
- 핵심 가치 경로: 잘못된 태깅
- 포함 신호: 
- 제외 신호: 
- 빠른 판별 질문: 종목 무관?
- 집계: total=2,413, impacted=423, max impact=139.68
- 대표 예시:
  - 2025-08-06T17:31:36 | OPEN | Opendoor's Q2 beat isn't enough: Here's what's holding them back | score=139.68 | tag=multi_window_impact
  - 2025-07-24T13:30:00 | OPEN | Meme stock rally: The bull case for Opendoor | score=98.25 | tag=sustained_repricing

### 실적 요약·평가 기사 (`earnings_summary_assessment`)
- 상위 분류: `residual`
- 한 줄 정의: earnings breakdown/assessment/insights 정리 기사.
- 핵심 가치 경로: 해설 정리
- 포함 신호: earnings breakdown, earnings assessment, earnings insights
- 제외 신호: 
- 빠른 판별 질문: 실적 정리?
- 집계: total=2,396, impacted=386, max impact=165.99
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
- 집계: total=2,353, impacted=1,119, max impact=1049.76
- 대표 예시:
  - 2025-06-13T13:05:57 | VOR | 12 Health Care Stocks Moving In Friday's After-Market Session | score=1049.76 | tag=sustained_repricing
  - 2025-05-23T09:06:46 | RAPT | 12 Health Care Stocks Moving In Friday's Intraday Session | score=1034.03 | tag=multi_window_impact

### 잡것들_캐시우드 언급·매매 (`잡것들_cathie_wood_mention`)
- 상위 분류: `residual`
- 한 줄 정의: Cathie Wood buys/sells, ARK fund activity.
- 핵심 가치 경로: 미디어 인물 언급
- 포함 신호: cathie wood.*buy, cathie wood.*sell, cathie wood.*dump, cathie wood.*bargain, ark.*fund
- 제외 신호: 
- 빠른 판별 질문: 캐시우드?
- 집계: total=2,332, impacted=429, max impact=292.64
- 대표 예시:
  - 2025-08-12T23:02:41 | OPEN | The Top 5 Analyst Questions From Opendoor’s Q2 Earnings Call | score=292.64 | tag=multi_window_impact
  - 2025-09-08T15:12:41 | PL | EchoStar-SpaceX spectrum deal, Planet Labs revenue outlook | score=138.90 | tag=multi_window_impact

### 구조조정·생존성 악화 (`restructuring_distress_negative`)
- 상위 분류: `short`
- 한 줄 정의: bankruptcy, going concern, layoffs.
- 핵심 가치 경로: 생존 우려→할인
- 포함 신호: chapter 11, bankruptcy, going concern, layoffs
- 제외 신호: growth reorg
- 빠른 판별 질문: 생존 모드?
- 집계: total=2,181, impacted=347, max impact=98.78
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
- 집계: total=2,102, impacted=526, max impact=648.56
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
- 집계: total=1,995, impacted=444, max impact=162.50
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
- 집계: total=1,926, impacted=269, max impact=216.53
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
- 집계: total=1,919, impacted=323, max impact=93.78
- 대표 예시:
  - 2025-06-20T09:33:40 | IREN | Roth MKM Remains Bullish on IREN Limited (IREN) | score=93.78 | tag=multi_window_impact
  - 2025-08-12T16:05:00 | WBTN | WEBTOON Entertainment Inc. Reports Second Quarter 2025 Financial Results | score=85.56 | tag=multi_window_impact

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

### 인기종목·시장 잡담 (`trending_stocks_chatter`)
- 상위 분류: `residual`
- 한 줄 정의: trending tickers, market chatter.
- 핵심 가치 경로: 트렌딩 소개
- 포함 신호: trending tickers, market chatter, stocks to watch
- 제외 신호: 
- 빠른 판별 질문: 인기종목 소개?
- 집계: total=1,814, impacted=395, max impact=183.81
- 대표 예시:
  - 2025-08-04T08:22:31 | OPEN | BYD, Opendoor and Figma: Trending Tickers | score=183.81 | tag=sustained_repricing
  - 2025-07-10T17:12:50 | MP | Stocks to Watch Recap: Delta, Kellogg, Nvidia, TSMC | score=142.06 | tag=multi_window_impact

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
- 집계: total=1,793, impacted=296, max impact=120.08
- 대표 예시:
  - 2025-07-30T08:00:00 | VSAT | Viasat Selected to Deliver Next-Generation Encryption for US Government Cloud Data Centers | score=120.08 | tag=multi_window_impact
  - 2025-08-21T08:00:00 | OKLO | Oklo Signs MOU with ABB and Commissions Monitoring Room to Advance Training for Aurora Powerhouse Deployment | score=114.29 | tag=sustained_repricing

### 양자컴퓨팅 이벤트 (`quantum_computing_event`)
- 상위 분류: `long`
- 한 줄 정의: Quantum computing milestones, installations.
- 핵심 가치 경로: 양자 기술 진전→시장 형성
- 포함 신호: quantum comput, quantum.*install, annealing quantum, quantum.*networking, quantum.*photon
- 제외 신호: 
- 빠른 판별 질문: 양자컴퓨팅?
- 집계: total=1,739, impacted=623, max impact=200.80
- 대표 예시:
  - 2025-04-23T07:00:00 | QBTS | D-Wave and Davidson Technologies Near Installation Completion of Alabama’s First On-Site Annealing Quantum Computer | score=200.80 | tag=sustained_repricing
  - 2025-09-05T09:00:02 | RGTI | Rigetti Computing Just Announced a New Quantum Deal. Should You Buy RGTI Stock Here? | score=190.41 | tag=sustained_repricing

### 관세·무역 분쟁 영향 (`tariff_trade_impact`)
- 상위 분류: `residual`
- 한 줄 정의: tariff 부과/해제, trade war, 관세 관련 영향.
- 핵심 가치 경로: 관세 변화→margin/수요 영향
- 포함 신호: tariff, trade war, strikes down.*tariff, customs
- 제외 신호: 
- 빠른 판별 질문: 관세/무역 충격?
- 집계: total=1,721, impacted=386, max impact=216.53
- 대표 예시:
  - 2025-06-06T07:27:55 | CRCL | Trending tickers: Tesla, Lululemon, Circle, Broadcom | score=216.53 | tag=multi_window_impact
  - 2025-08-07T13:35:37 | WULF | High Insider Ownership Growth Stocks To Watch In August 2025 | score=100.00 | tag=sustained_repricing

### Fed 금리 결정·FOMC (`fed_rate_decision`)
- 상위 분류: `residual`
- 한 줄 정의: Fed rate decision, FOMC meeting, rate cut expectations.
- 핵심 가치 경로: 금리 변화→시장 방향
- 포함 신호: fed rate, fomc, rate cut, rate decision, monetary policy, lowering rates
- 제외 신호: 
- 빠른 판별 질문: Fed 금리?
- 집계: total=1,692, impacted=255, max impact=122.37
- 대표 예시:
  - 2025-08-29T00:10:15 | OPEN | Inno Holdings Gains 2% In Pre-Market Following 254% Monday Rally Amid Fed Rate Cut Optimism | score=122.37 | tag=multi_window_impact
  - 2025-09-03T14:33:38 | QBTS | D-Wave Quantum (QBTS) Appoints Cybersecurity Veteran Stan Black As New CISO | score=106.31 | tag=sustained_repricing

### 급락 해설·하락 이유 (`stock_crash_explanation_negative`)
- 상위 분류: `short`
- 한 줄 정의: 주가 급락 사유 해설 (nosedives, crashes X%).
- 핵심 가치 경로: 급락 해설→공포 증폭
- 포함 신호: nosedives, crashes, stock falls.*%, tanks, tumbles.*%
- 제외 신호: 
- 빠른 판별 질문: 급락 사유 해설?
- 집계: total=1,523, impacted=409, max impact=1117.17
- 대표 예시:
  - 2025-09-02T13:33:52 | LCID | Why Lucid Group (LCID) Shares Are Sinking Today | score=1117.17 | tag=multi_window_impact
  - 2025-08-08T08:38:46 | OPEN | Why Opendoor Technologies Stock Crashed This Week | score=216.76 | tag=multi_window_impact

### 잡것들_실적 일정·컨퍼런스콜 공지 (`잡것들_conference_call_schedule`)
- 상위 분류: `residual`
- 한 줄 정의: Schedules Conference Call, sets earnings date.
- 핵심 가치 경로: 일정 안내
- 포함 신호: schedules.*conference call, to announce.*results on, sets.*conference call, to host.*webcast
- 제외 신호: 
- 빠른 판별 질문: 컨퍼런스콜 일정?
- 집계: total=1,382, impacted=227, max impact=257.42
- 대표 예시:
  - 2026-01-16T16:01:00 | CRVS | Corvus Pharmaceuticals to Announce Results from Cohort 4 of Placebo-Controlled Phase 1 Clinical Trial of Soquelitinib for Atopic Dermatitis | score=257.42 | tag=multi_window_impact
  - 2026-01-20T07:00:00 | CRVS | Corvus Pharmaceuticals Announces Positive Data from Cohort 4 Confirming Results for Placebo-Controlled Phase 1 Clinical Trial of Soquelitinib for Atopic Dermatitis | score=211.80 | tag=multi_window_impact

### 잡것들_Spotlight/Radar 자동 기사 (`잡것들_spotlight_stocks_radar`)
- 상위 분류: `residual`
- 한 줄 정의: 5 Stocks In The Spotlight, On Investors' Radars.
- 핵심 가치 경로: 자동 기사
- 포함 신호: stocks in the spotlight, on investors.*radars, stocks that may collapse, stocks that may keep you up
- 제외 신호: 
- 빠른 판별 질문: Spotlight 자동?
- 집계: total=1,313, impacted=184, max impact=197.86
- 대표 예시:
  - 2025-04-24T12:31:59 | CRWV | Dean of Valuation Damodaran on CoreWeave (CRWV): ‘Buzzwords’ AI and Nvidia ‘Aren’t Working Anymore’ | score=197.86 | tag=sustained_repricing
  - 2025-09-08T08:59:00 | OKLO | OKLO Gains Spotlight as AI Demand Fuels Energy Market Dreams | score=101.03 | tag=sustained_repricing

### 숏커버·매수 유입 (`positioning_flow_positive`)
- 상위 분류: `long`
- 한 줄 정의: short squeeze, fund buying, covering.
- 핵심 가치 경로: 수급 유입→가격 가속
- 포함 신호: short squeeze, fund buying, covering, takes stake
- 제외 신호: buyback
- 빠른 판별 질문: flow 유입 핵심?
- 집계: total=1,300, impacted=231, max impact=712.75
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
- 집계: total=1,293, impacted=494, max impact=780.14
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
- 집계: total=1,280, impacted=267, max impact=350.94
- 대표 예시:
  - 2025-06-26T15:55:52 | VOR | Sector Update: Health Care Stocks Edge Higher Late Afternoon | score=350.94 | tag=multi_window_impact
  - 2025-09-24T16:05:06 | QURE | Sector Update: Health Care Stocks Decline Late Afternoon | score=346.63 | tag=multi_window_impact

### 바이오 파이프라인·학회 발표 (`biotech_pipeline_presentation`)
- 상위 분류: `residual`
- 한 줄 정의: data presentation at medical conference.
- 핵심 가치 경로: 학회 발표→관심
- 포함 신호: present.*data at, present at.*meeting, upcoming presentation, poster presentation
- 제외 신호: 
- 빠른 판별 질문: 학회 발표 예정?
- 집계: total=1,270, impacted=211, max impact=221.96
- 대표 예시:
  - 2025-05-27T12:01:03 | URGN | UroGen Pharma to Present at TD Cowen: 6th Annual Oncology Innovation Summit | score=221.96 | tag=sustained_repricing
  - 2025-03-20T05:30:00 | NUTX | Nutex Health to Present at the EDPMA Solutions Summit 2025 | score=182.13 | tag=sustained_repricing

### 잡것들_정치·지정학 노이즈(종목 무관) (`잡것들_political_geopolitical_noise`)
- 상위 분류: `residual`
- 한 줄 정의: Greenland, Iran, Venezuela 등 정치 기사 태깅된 종목과 무관.
- 핵심 가치 경로: 정치 노이즈
- 포함 신호: greenland.*seizure, greenland.*security, iran.*briefing, venezuela.*oil
- 제외 신호: 
- 빠른 판별 질문: 정치 노이즈?
- 집계: total=1,196, impacted=193, max impact=191.73
- 대표 예시:
  - 2025-10-06T12:19:03 | CRML | AMD–OpenAI boosts TSMC, US gov't reportedly eyes Critical Metals | score=191.73 | tag=multi_window_impact
  - 2026-01-12T07:47:50 | HYMC | Hycroft Mining (HYMC) Stock Hits New 52-Week High As Fed Fight Lifts Gold | score=102.17 | tag=multi_window_impact

### 잡것들_배당수익률·소극적 소득 필러 (`잡것들_dividend_yield_filler`)
- 상위 분류: `residual`
- 한 줄 정의: 배당수익률 중심의 필러 기사.
- 핵심 가치 경로: 트래픽 유도
- 포함 신호: yearly dividends, dividend.*yield.*stock, passive income, reliable.*dividend, no-brainer.*dividend, dividend.*yield.*buy
- 제외 신호: 
- 빠른 판별 질문: 배당 필러?
- 집계: total=1,174, impacted=76, max impact=44.74
- 대표 예시:
  - 2025-05-08T04:36:27 | MCHP | Wall Street's Most Accurate Analysts Weigh In On 3 Tech Stocks Delivering High-Dividend Yields | score=44.74 | tag=multi_window_impact
  - 2025-04-09T16:19:55 | AVGO | Broadcom Inc. (AVGO): One of the High Growth Dividend Paying Stocks to Invest in | score=42.01 | tag=multi_window_impact

### 잡것들_Best/Worst 리스트 기사 (`잡것들_listicle_best_worst`)
- 상위 분류: `residual`
- 한 줄 정의: Best X stocks, Worst X stocks, Top picks 리스트형.
- 핵심 가치 경로: 큐레이션·트래픽
- 포함 신호: best.*stocks.*buy, worst.*stocks, top picks, top.*stocks.*buy, gems.*to buy, under \$50.*worth
- 제외 신호: 
- 빠른 판별 질문: 리스트형 Best/Worst?
- 집계: total=1,157, impacted=179, max impact=181.51
- 대표 예시:
  - 2025-03-21T07:08:42 | ALMS | Why Alumis Inc. (ALMS) Went Down On Thursday? | score=181.51 | tag=multi_window_impact
  - 2025-12-02T11:48:29 | HYMC | Top 100 Stocks to Buy: Par Pacific Holdings Looks Tempting, But Should You Bite? | score=138.36 | tag=sustained_repricing

### 종목 비교·vs 기사 (`stock_comparison_article`)
- 상위 분류: `residual`
- 한 줄 정의: A vs B: which stock is better.
- 핵심 가치 경로: 비교 분석
- 포함 신호: which stock is, better value option, vs.*which is
- 제외 신호: 
- 빠른 판별 질문: 종목 비교 기사?
- 집계: total=1,019, impacted=114, max impact=83.57
- 대표 예시:
  - 2025-12-18T11:40:04 | NOW | LDOS or NOW: Which Is the Better Value Stock Right Now? | score=83.57 | tag=multi_window_impact
  - 2026-01-29T11:40:02 | ODD | ODD or ADYEY: Which Is the Better Value Stock Right Now? | score=63.10 | tag=sustained_repricing

### 잡것들_사소한 인사·임원 선임 (`잡것들_hiring_appointment_minor`)
- 상위 분류: `residual`
- 한 줄 정의: Minor executive appointment, non-C-suite hires.
- 핵심 가치 경로: 사소한 인사
- 포함 신호: appoints.*to board of dir, appoints.*as senior vice, appoints.*as vp, appointed to.*board, appoints.*counsel
- 제외 신호: appoints new ceo, appoints veteran, appoints.*cfo
- 빠른 판별 질문: 사소한 인사?
- 집계: total=886, impacted=128, max impact=146.25
- 대표 예시:
  - 2026-01-02T16:05:00 | SNDK | Sandisk Appoints Alexander R. Bradley to its Board of Directors | score=146.25 | tag=multi_window_impact
  - 2025-10-02T16:05:00 | DYN | Dyne Therapeutics Appoints Brian Posner to its Board of Directors | score=92.88 | tag=sustained_repricing

### 잡것들_Unpopular Stocks 필러 (`잡것들_unpopular_stocks_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Unpopular stocks we steer clear/think twice.
- 핵심 가치 경로: 큐레이션 필러
- 포함 신호: unpopular stocks.*we, cash-producing stocks.*we, stocks.*facing headwinds, stocks.*open questions, stocks.*hot water, stocks with.*challenges
- 제외 신호: 
- 빠른 판별 질문: 비인기종목 필러?
- 집계: total=858, impacted=94, max impact=89.45
- 대표 예시:
  - 2025-09-22T00:37:19 | PLUG | 1 Unpopular Stock That Should Get More Attention and 2 Facing Headwinds | score=89.45 | tag=sustained_repricing
  - 2025-09-25T00:31:18 | VICR | 3 Russell 2000 Stocks We Think Twice About | score=70.42 | tag=sustained_repricing

### 기술적 분석·차트 시그널 (`technical_analysis_signal`)
- 상위 분류: `residual`
- 한 줄 정의: golden cross, moving average, technical pattern.
- 핵심 가치 경로: 기술적 신호→트레이더 관심
- 포함 신호: golden cross, 200-day, moving average, trend barrier, tests key
- 제외 신호: 
- 빠른 판별 질문: 기술적 분석?
- 집계: total=837, impacted=178, max impact=292.64
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

### 잡것들_Needham Hold 재확인(무변동) (`잡것들_needham_reiterate_hold`)
- 상위 분류: `residual`
- 한 줄 정의: Needham Reiterates Hold to Hold (실질 변동 없음).
- 핵심 가치 경로: 무변동 기사
- 포함 신호: reiterates hold.*to hold, reiterates.*holdto hold
- 제외 신호: 
- 빠른 판별 질문: Hold→Hold?
- 집계: total=817, impacted=76, max impact=163.97
- 대표 예시:
  - 2025-08-14T07:54:11 | STTK | Needham Reiterates Hold on Shattuck Labsto Hold | score=163.97 | tag=sustained_repricing
  - 2025-10-15T09:47:38 | OMER | Needham Reiterates Hold on Omerosto Hold | score=154.15 | tag=multi_window_impact

### 잡것들_오늘의 종목·편집형 추천 (`잡것들_stock_of_the_day_promotional`)
- 상위 분류: `residual`
- 한 줄 정의: Stock Of The Day, Reasons to Retain 형태의 편집형 추천.
- 핵심 가치 경로: 편집 추천·트래픽 유도
- 포함 신호: stock of the day, reasons to retain, reasons to add.*to your portfolio, reasons to buy.*right now
- 제외 신호: 
- 빠른 판별 질문: 편집형 추천?
- 집계: total=816, impacted=143, max impact=235.86
- 대표 예시:
  - 2025-08-15T13:59:50 | OPEN | Traders Squeeze Some Meme-Stock Juice Out of the Week's Final Session | score=235.86 | tag=sustained_repricing
  - 2025-10-09T12:00:02 | VTYX | Ventyx Biosciences, Inc. (VTYX) Is Up 20.81% in One Week: What You Should Know | score=141.25 | tag=sustained_repricing

### 애널리스트 컨센서스·다수의견 (`analyst_consensus_overview`)
- 상위 분류: `residual`
- 한 줄 정의: 다수 analyst 의견 종합 기사.
- 핵심 가치 경로: 컨센서스 소개
- 포함 신호: insights from.*analysts, analyst reviews
- 제외 신호: 
- 빠른 판별 질문: 다수 의견 종합?
- 집계: total=792, impacted=109, max impact=135.38
- 대표 예시:
  - 2025-05-09T10:00:52 | OUST | Demystifying Ouster: Insights From 4 Analyst Reviews | score=135.38 | tag=multi_window_impact
  - 2026-02-09T11:01:09 | FSLY | Assessing Fastly: Insights From 5 Financial Analysts | score=106.18 | tag=multi_window_impact

### 배당 정책 변경 (`dividend_policy_change`)
- 상위 분류: `residual`
- 한 줄 정의: Dividend increase/cut/suspend/initiate.
- 핵심 가치 경로: 배당 정책→수급 변화
- 포함 신호: dividend.*increase, dividend.*cut, special dividend
- 제외 신호: 
- 빠른 판별 질문: 배당 정책 변경?
- 집계: total=792, impacted=43, max impact=76.65
- 대표 예시:
  - 2025-06-20T13:37:38 | RGC | Regencell Bioscience Holdings (NasdaqCM:RGC) Announces 38:1 Stock Split Effective June 2025 | score=76.65 | tag=multi_window_impact
  - 2025-05-08T16:15:00 | MCHP | Microchip Technology Announces Quarterly Cash Dividend on Common Stock of 45.5 Cents Per Share | score=44.74 | tag=multi_window_impact

### 중국 무역·규제 이벤트 (`china_trade_event`)
- 상위 분류: `residual`
- 한 줄 정의: China trade talks, China export controls, H20 chip.
- 핵심 가치 경로: 중국 리스크→매출 영향
- 포함 신호: china.*trade, china.*tariff, china.*export, h20.*chip, china.*regulation
- 제외 신호: 
- 빠른 판별 질문: 중국 무역?
- 집계: total=790, impacted=173, max impact=99.67
- 대표 예시:
  - 2025-10-15T16:57:00 | SNDK | Sandisk (SNDK) Drops 5.4% on US-China Trade Tension Risks | score=99.67 | tag=multi_window_impact
  - 2025-04-21T13:22:49 | APLD | Applied Digital (NasdaqGS:APLD) Sees 26% Price Drop Over Last Week After Earnings | score=71.65 | tag=sustained_repricing

### 공매도 비율·변동 (`short_interest_update`)
- 상위 분류: `residual`
- 한 줄 정의: short interest changes, heavily shorted.
- 핵심 가치 경로: 공매도 데이터→포지셔닝 힌트
- 포함 신호: short interest, heavily shorted, days to cover
- 제외 신호: 
- 빠른 판별 질문: 공매도 데이터?
- 집계: total=780, impacted=107, max impact=145.89
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
- 집계: total=779, impacted=141, max impact=350.94
- 대표 예시:
  - 2025-06-26T14:21:21 | VOR | Update: Vor Biopharma Shares Rally After Naming New CEO, Licensing Autoimmune Drug From RemeGen | score=350.94 | tag=multi_window_impact
  - 2025-06-26T11:22:00 | VOR | Vor, with new CEO, changes course to target autoimmune disease | score=350.94 | tag=multi_window_impact

### 잡것들_배당 기준일 필러 (`잡것들_dividend_ex_date_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Going ex-dividend soon, increases quarterly dividend.
- 핵심 가치 경로: 배당 기준일
- 포함 신호: going ex-dividend, trade ex-dividend, about to trade ex-dividend, pays a.*dividend in
- 제외 신호: 
- 빠른 판별 질문: 배당 기준일?
- 집계: total=775, impacted=47, max impact=70.48
- 대표 예시:
  - 2025-07-25T18:03:34 | SATS | Be Sure To Check Out SATS Ltd. (SGX:S58) Before It Goes Ex-Dividend | score=70.48 | tag=sustained_repricing
  - 2025-05-22T03:20:31 | AAP | Advance Auto Parts, Inc. Declares Regular Cash Dividend, Payable June 25, 2025 | score=68.35 | tag=multi_window_impact

### 원자력·SMR 이벤트 (`nuclear_energy_event`)
- 상위 분류: `long`
- 한 줄 정의: Nuclear power, SMR, nuclear reactor.
- 핵심 가치 경로: 원자력→에너지 수요
- 포함 신호: nuclear.*power, small modular reactor, smr, nuclear.*construct
- 제외 신호: 
- 빠른 판별 질문: 원자력?
- 집계: total=761, impacted=222, max impact=114.49
- 대표 예시:
  - 2025-08-20T23:36:54 | OKLO | Jim Cramer Highlights Risks Behind Oklo’s Nuclear Plans | score=114.49 | tag=sustained_repricing
  - 2025-05-01T16:50:00 | OKLO | Oklo Announces Date for First Quarter 2025 Financial Results and Business Update Call | score=109.65 | tag=sustained_repricing

### IPO·상장 이벤트 (`ipo_listing_event`)
- 상위 분류: `residual`
- 한 줄 정의: IPO, direct listing, market debut.
- 핵심 가치 경로: 유동성 이벤트
- 포함 신호: goes public, ipo, direct listing, debut
- 제외 신호: trading halt
- 빠른 판별 질문: 상장 이벤트?
- 집계: total=736, impacted=176, max impact=675.10
- 대표 예시:
  - 2025-06-05T15:18:00 | CRCL | Crypto Firm Circle’s Shares Soar in Stock Market Debut | score=675.10 | tag=multi_window_impact
  - 2025-05-02T12:11:30 | CRWV | Why CoreWeave Stock Rose 11% in April | score=268.01 | tag=multi_window_impact

### 잡것들_Zacks Trending 필러 (`잡것들_zacks_trending_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Zacks Is a Trending Stock, facts to know 필러.
- 핵심 가치 경로: 필러
- 포함 신호: trending stock.*facts to know, facts to know before betting
- 제외 신호: 
- 빠른 판별 질문: Zacks 트렌딩?
- 집계: total=728, impacted=100, max impact=83.76
- 대표 예시:
  - 2025-11-12T12:00:03 | RZLT | All You Need to Know About Rezolute (RZLT) Rating Upgrade to Buy | score=83.76 | tag=sustained_repricing
  - 2025-01-08T12:00:10 | PEPG | All You Need to Know About PepGen (PEPG) Rating Upgrade to Buy | score=64.76 | tag=sustained_repricing

### 의약품 지정·우선심사 (`drug_designation_positive`)
- 상위 분류: `long`
- 한 줄 정의: QIDP, Fast Track, Breakthrough, Orphan Drug 지정.
- 핵심 가치 경로: 규제 경로 단축→상업화 가속
- 포함 신호: qidp designation, fast track, breakthrough therapy, orphan drug
- 제외 신호: 
- 빠른 판별 질문: 규제 지정 이벤트?
- 집계: total=727, impacted=147, max impact=160.28
- 대표 예시:
  - 2026-01-14T05:09:14 | IBRX | ImmunityBio shares are trading higher after the Saudi Food and Drug Authority granted accelerated approval of ANKTIVA for use in combination with immune checkpoint inhibitors for the treatment of adult patients with metastatic non-small cell lung cancer whose disease has progressed following standard-of-care therapy. | score=160.28 | tag=multi_window_impact
  - 2025-10-03T07:34:00 | ANRO | Alto Neuroscience Receives FDA Fast Track Designation for ALTO-101 for the Treatment of Cognitive Impairment Associated with Schizophrenia | score=154.65 | tag=multi_window_impact

### 배당 개시·특별배당 (`dividend_special_event`)
- 상위 분류: `long`
- 한 줄 정의: initiates dividend, special dividend.
- 핵심 가치 경로: 배당 정책 변화→income investor 유입
- 포함 신호: initiates.*dividend, special dividend, quarterly dividend
- 제외 신호: 
- 빠른 판별 질문: 배당 이벤트?
- 집계: total=716, impacted=51, max impact=42.61
- 대표 예시:
  - 2025-05-12T02:05:00 | CMCL | Caledonia approves quarterly dividend | score=42.61 | tag=sustained_repricing
  - 2026-01-26T17:30:00 | RRX | Regal Rexnord Corporation Declares Quarterly Dividend of $.35 per share | score=41.47 | tag=sustained_repricing

### 이례적 옵션 활동 (`unusual_options_activity`)
- 상위 분류: `residual`
- 한 줄 정의: unusual options activity, big options bets.
- 핵심 가치 경로: 옵션 시장 시그널→관심 증폭
- 포함 신호: unusual options, options activity, options alert, smart money.*options
- 제외 신호: 
- 빠른 판별 질문: 옵션 활동 중심?
- 집계: total=714, impacted=189, max impact=147.22
- 대표 예시:
  - 2025-09-29T10:27:43 | REPL | Replimune Group Option Alert: Oct 17 $6 Calls Sweep (16) Near The Ask: 1346 @ $0.25 Vs 129 OI | score=147.22 | tag=sustained_repricing
  - 2026-02-13T06:01:06 | CRCL | Circle Internet Group Unusual Options Activity | score=134.58 | tag=sustained_repricing

### 소송 합의·분쟁 해소 (`settlement_resolution_positive`)
- 상위 분류: `long`
- 한 줄 정의: settlement, end feud, dispute resolution.
- 핵심 가치 경로: 리스크 해소→할인 제거
- 포함 신호: settlement, end feud, resolves dispute, ends.*legal
- 제외 신호: 
- 빠른 판별 질문: 분쟁 해소?
- 집계: total=712, impacted=100, max impact=114.51
- 대표 예시:
  - 2026-02-05T02:10:34 | CRCL | Circle Internet Group Extends USDC Reach With Hecto Cross-Border Integration | score=114.51 | tag=sustained_repricing
  - 2025-11-14T08:08:00 | SGML | Sigma Lithium's 3Q 25 Results: Increase in Revenues and Cash Position | score=95.42 | tag=multi_window_impact

### 잡것들_워런 버핏 언급 (`잡것들_warren_buffett_mention`)
- 상위 분류: `residual`
- 한 줄 정의: Warren Buffett related, Berkshire mention.
- 핵심 가치 경로: 미디어 인물 언급
- 포함 신호: warren buffett, berkshire.*buy, berkshire.*sell, buffett.*portfolio
- 제외 신호: 
- 빠른 판별 질문: 워런 버핏?
- 집계: total=712, impacted=63, max impact=39.56
- 대표 예시:
  - 2025-04-07T07:00:00 | COHR | 27.5% of Stanley Druckenmiller's $3.7 Billion Portfolio Is Invested in These 3 Under-the-Radar AI Stocks | score=39.56 | tag=sustained_repricing
  - 2026-01-16T13:56:57 | DVA | Hedge Funds Are Shorting This Classic Warren Buffett Stock. Should You Sell Shares Now? | score=39.21 | tag=sustained_repricing

### 잡것들_트럼프 SNS 포스트 노이즈 (`잡것들_trump_social_post_noise`)
- 상위 분류: `residual`
- 한 줄 정의: Trump Posts On Truth Social (종목과 무관).
- 핵심 가치 경로: 정치 노이즈
- 포함 신호: trump posts on truth social, president trump posts
- 제외 신호: 
- 빠른 판별 질문: 트럼프 SNS?
- 집계: total=709, impacted=95, max impact=96.10
- 대표 예시:
  - 2025-08-01T07:37:52 | SATS | Stocks Fall Pre-Bell as Trump Announces New Tariffs; Traders Await Key Jobs Report | score=96.10 | tag=multi_window_impact
  - 2025-04-24T15:38:09 | TSLA | Trump Says He Expects to Reach Deal With Norway on Tariffs | score=44.73 | tag=multi_window_impact

### 잡것들_기관 보유·지분구조 필러 (`잡것들_ownership_institutional_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Retail investors account for X%, insiders have X riding.
- 핵심 가치 경로: 지분구조 소개
- 포함 신호: retail investors account for, institutional.*ownership, insiders have.*lot riding, ownership.*piqued.*interest
- 제외 신호: 
- 빠른 판별 질문: 지분구조 필러?
- 집계: total=694, impacted=157, max impact=197.86
- 대표 예시:
  - 2025-04-24T07:35:28 | CRWV | 3 Growth Companies With High Insider Ownership Achieving 70% Earnings Growth | score=197.86 | tag=sustained_repricing
  - 2025-09-15T08:35:52 | ALM | TSX Growth Companies With High Insider Ownership In September 2025 | score=117.26 | tag=sustained_repricing

### 잡것들_ChartMill 기술적 필러 (`잡것들_chartmill_technical_filler`)
- 상위 분류: `residual`
- 한 줄 정의: ChartMill SEPA, momentum, technical score 자동 게시.
- 핵심 가치 경로: 자동화 필러
- 포함 신호: minervini sepa, high.*technical.*score, high-growth momentum.*strong technical
- 제외 신호: 
- 빠른 판별 질문: ChartMill 필러?
- 집계: total=679, impacted=51, max impact=201.98
- 대표 예시:
  - 2026-02-05T08:42:01 | AAOI | APPLIED OPTOELECTRONICS INC (NASDAQ:AAOI) Aligns with the Minervini SEPA Strategy for Growth | score=201.98 | tag=sustained_repricing
  - 2026-02-10T15:00:00 | NKTR | Top stock movements in today's session. | score=97.60 | tag=multi_window_impact

### 내부자 매도·우려 시그널 (`insider_selling_concern`)
- 상위 분류: `short`
- 한 줄 정의: insider selling, executive sells shares.
- 핵심 가치 경로: 내부자 매도→우려
- 포함 신호: insider.*sell, insiders sell, executive.*sold
- 제외 신호: 
- 빠른 판별 질문: 내부자 매도?
- 집계: total=667, impacted=88, max impact=93.35
- 대표 예시:
  - 2025-05-08T07:00:09 | ORLY | Insiders At O'Reilly Automotive Sold US$64m In Stock, Alluding To Potential Weakness | score=93.35 | tag=sustained_repricing
  - 2025-04-10T13:50:04 | RUN | Sunrun Inc. (RUN): Among Stocks Insiders Sold in April After Trump’s Tariff Rollout | score=85.07 | tag=sustained_repricing

### 유전자·세포치료 이벤트 (`biotech_gene_cell_therapy`)
- 상위 분류: `long`
- 한 줄 정의: Gene therapy, cell therapy, CAR-T, iPSC, exosome.
- 핵심 가치 경로: 첨단치료 진전→차세대 의약
- 포함 신호: gene therapy, cell therapy, car-t, ipsc, exosome, sirna, morpholino
- 제외 신호: 
- 빠른 판별 질문: 유전자/세포치료?
- 집계: total=656, impacted=197, max impact=547.41
- 대표 예시:
  - 2025-11-25T18:18:15 | CAPR | Can Capricor Therapeutics' (CAPR) Exosome Advancement Shift the Conversation on Its Innovation Pipeline? | score=547.41 | tag=multi_window_impact
  - 2025-11-24T09:00:00 | CAPR | Capricor Therapeutics Presents New Data Demonstrating a Scalable Framework for Loading Therapeutic Oligonucleotides into Exosomes at AAEV 2025 | score=416.35 | tag=sustained_repricing

### 잡것들_리스트형 screener 노이즈 (`잡것들_screener_listicle_noise`)
- 상위 분류: `residual`
- 한 줄 정의: listicle, penny stocks, meme stocks.
- 핵심 가치 경로: 큐레이션/트래픽 유도
- 포함 신호: best meme stocks, penny stocks, what you need to know
- 제외 신호: 
- 빠른 판별 질문: 리스트형 기사?
- 집계: total=633, impacted=122, max impact=2267.06
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
- 집계: total=632, impacted=139, max impact=97.98
- 대표 예시:
  - 2025-09-10T15:12:00 | IREN | IREN Limited Jumps 208% Year to Date: Buy, Sell or Hold the Stock? | score=97.98 | tag=multi_window_impact
  - 2025-12-22T09:53:44 | BE | Bloom Energy (BE): Mixed Analyst Outlook Amid Growth and Valuation Concerns | score=57.19 | tag=sustained_repricing

### 스핀오프·분사 이벤트 (`spinoff_separation_event`)
- 상위 분류: `long`
- 한 줄 정의: Spin-off, corporate separation.
- 핵심 가치 경로: 기업가치 재평가→unlock
- 포함 신호: spin-off, spin off, separation, bear up into.*companies, split.*into.*companies
- 제외 신호: 
- 빠른 판별 질문: 스핀오프?
- 집계: total=616, impacted=123, max impact=228.22
- 대표 예시:
  - 2025-07-10T10:11:00 | OPEN | Title Resources Group Appoints Michael Campbell as Underwriting Counsel for Michigan | score=228.22 | tag=multi_window_impact
  - 2026-01-02T04:21:00 | SNDK | Zacks Investment Ideas feature highlights: Sandisk, Western Digital and Micron | score=146.25 | tag=multi_window_impact

### 정책·법안 역풍 read-through (`policy_regulatory_headwind_negative`)
- 상위 분류: `short`
- 한 줄 정의: 법안/규제 변화가 사업모델에 역풍.
- 핵심 가치 경로: 규제 강화→수익 제한
- 포함 신호: ban, policy risk, lawmakers, regulatory framework
- 제외 신호: fda rejection
- 빠른 판별 질문: 정책 역풍?
- 집계: total=583, impacted=124, max impact=64.58
- 대표 예시:
  - 2026-02-20T15:27:43 | CRCL | The SEC Just Opened the Door for Stablecoin Adoption | score=64.58 | tag=multi_window_impact
  - 2025-06-17T22:26:46 | COIN | Senate Passes GENIUS Act—Coinbase's Brian Armstrong Calls It 'Big Milestone,' Scott Bessent Says Passage Could Drive Stablecoins Into A $3.7 Trillion Market | score=58.13 | tag=sustained_repricing

### 내부자 거래 공시(Form4) (`insider_transaction_disclosure`)
- 상위 분류: `residual`
- 한 줄 정의: Form 4 insider buy/sell, 10b5-1 plan execution.
- 핵심 가치 경로: 내부자 포지셔닝 시그널
- 포함 신호: form 4, insider.*buy, insider.*sell, 10b5-1 plan
- 제외 신호: 
- 빠른 판별 질문: 내부자 거래 공시?
- 집계: total=580, impacted=74, max impact=155.03
- 대표 예시:
  - 2025-04-25T07:29:53 | OPAL | OPAL Fuels Insider Ups Holding By 18% During Year | score=155.03 | tag=sustained_repricing
  - 2026-01-09T12:44:02 | HYMC | Hycroft Insider Sells $318K in Stock As Gold and Silver Prices Buoy 1,200% Share Surge | score=89.42 | tag=multi_window_impact

### 바이오 독점권·특허 연장 (`biotech_exclusivity_patent_extension`)
- 상위 분류: `long`
- 한 줄 정의: NCE exclusivity, patent extension, Orange Book.
- 핵심 가치 경로: 독점 기간 연장→매출 보호
- 포함 신호: exclusivity, patent.*extend, orange book, nce.*exclusiv
- 제외 신호: 
- 빠른 판별 질문: 독점권 연장?
- 집계: total=573, impacted=51, max impact=284.23
- 대표 예시:
  - 2025-07-14T07:05:00 | CELC | Celcuity Announces Issuance of New Patent for Gedatolisib that Extends Patent Exclusivity into 2042 | score=284.23 | tag=sustained_repricing
  - 2025-07-14T03:10:05 | CELC | Celcuity Announces Issuance Of U.S. Patent Covering Clinical Dosing Regimen For Gedatolisib In ER+/HER2- Breast Cancer Patients, Extending Celcuity's Patent Exclusivity In U.S. Into 2042 | score=284.23 | tag=sustained_repricing

### 잡것들_ETF·펀드 코멘터리 (`잡것들_etf_fund_commentary`)
- 상위 분류: `residual`
- 한 줄 정의: ETF flow, fund spotlight, ETF comparison.
- 핵심 가치 경로: ETF 소개·트래픽
- 포함 신호: etf.*buy.*hold, etf.*league.*table, etf.*flow, simple etf, exchange-traded fund
- 제외 신호: 
- 빠른 판별 질문: ETF 코멘터리?
- 집계: total=571, impacted=85, max impact=70.40
- 대표 예시:
  - 2025-06-13T06:30:04 | COIN | What are the top holdings of Cathie Wood's ARK Innovation ETF? | score=70.40 | tag=multi_window_impact
  - 2025-11-19T06:17:50 | KDK | Kodiak AI (KDK) Valuation: Is the Market Overlooking Growth After Recent Share Pullback? | score=58.83 | tag=sustained_repricing

### 비만·GLP-1 관련 이벤트 (`biotech_obesity_glp1_event`)
- 상위 분류: `long`
- 한 줄 정의: GLP-1 trial, obesity drug, weight loss results.
- 핵심 가치 경로: 비만치료 시장→TAM 기대
- 포함 신호: glp-1, obesity.*trial, weight loss.*results, oral glp, nlrp3
- 제외 신호: 
- 빠른 판별 질문: 비만/GLP-1 관련?
- 집계: total=566, impacted=115, max impact=127.12
- 대표 예시:
  - 2025-04-17T10:18:26 | HIMS | Eli Lilly stock soars on positive weight-loss pill results | score=127.12 | tag=sustained_repricing
  - 2025-04-25T14:45:47 | HIMS | Novo Nordisk wins case to kick knockoff Ozempic off the market, but it may not last | score=89.55 | tag=sustained_repricing

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

### 잡것들_CSR·지역사회 활동 노이즈 (`잡것들_community_csr_noise`)
- 상위 분류: `residual`
- 한 줄 정의: CSR, charity, community support news.
- 핵심 가치 경로: CSR 노이즈
- 포함 신호: staffers help, community.*support, charity, holiday.*gift, wrapping gifts
- 제외 신호: 
- 빠른 판별 질문: CSR 노이즈?
- 집계: total=540, impacted=69, max impact=66.72
- 대표 예시:
  - 2025-10-27T08:00:00 | NTLA | Intellia pauses two CRISPR drug studies after safety scare | score=66.72 | tag=multi_window_impact
  - 2025-06-02T06:06:09 | KYMR | Transcript : Kymera Therapeutics, Inc. - Special Call | score=60.80 | tag=multi_window_impact

### 미국 정부 정책·행정명령 (`us_government_policy_executive`)
- 상위 분류: `residual`
- 한 줄 정의: Executive order, Trump policy, White House initiative.
- 핵심 가치 경로: 정책 방향→산업 영향
- 포함 신호: executive order, trump.*policy, white house.*initiative, president.*signs
- 제외 신호: 
- 빠른 판별 질문: 미 행정명령?
- 집계: total=515, impacted=84, max impact=158.27
- 대표 예시:
  - 2025-04-03T17:29:02 | TDUP | Here’s How the Demise of De Minimis Could Impact E-Commerce and Resale | score=158.27 | tag=sustained_repricing
  - 2025-08-01T12:21:07 | SATS | EchoStar (SATS) Stock Trades Down, Here Is Why | score=96.10 | tag=multi_window_impact

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

### 바이오 투자자 소송·조사 (`biotech_investor_lawsuit_negative`)
- 상위 분류: `short`
- 한 줄 정의: Investor lawsuit, shareholder investigation in pharma.
- 핵심 가치 경로: 법적 리스크→할인
- 포함 신호: investor.*urged to contact, law firm.*investigat, pomerantz.*investigat, hagens berman
- 제외 신호: 
- 빠른 판별 질문: 투자자 소송/조사?
- 집계: total=490, impacted=140, max impact=238.21
- 대표 예시:
  - 2025-06-02T08:01:04 | URGN | Deadline Approaching: UroGen Pharma Ltd. (URGN) Investors Who Lost Money Urged To Contact Law Offices of Howard G. Smith | score=238.21 | tag=sustained_repricing
  - 2025-05-29T09:46:05 | URGN | UroGen Pharma Ltd. (URGN) Shares Crash Again Amid FDA's ODAC Vote Against UGN-102, Company Facing Investor Scrutiny - Hagens Berman | score=221.48 | tag=sustained_repricing

### 유가·에너지·원자재 영향 (`oil_energy_commodity_impact`)
- 상위 분류: `residual`
- 한 줄 정의: oil price, commodity price moves.
- 핵심 가치 경로: 원자재 가격 영향
- 포함 신호: oil tops, oil jumps, crude oil, oil prices, commodity
- 제외 신호: 
- 빠른 판별 질문: 원자재 가격 충격?
- 집계: total=488, impacted=87, max impact=262.82
- 대표 예시:
  - 2025-07-28T08:05:27 | CELC | Crude Oil Gains 2%; CEA Industries Shares Spike Higher | score=262.82 | tag=multi_window_impact
  - 2025-10-16T08:31:12 | PRAX | Dow Dips Over 100 Points; US Crude Oil Inventories Surge | score=250.48 | tag=multi_window_impact

### 실적 콜 요약 (`earnings_call_summary`)
- 상위 분류: `residual`
- 한 줄 정의: Moby summary 등 earnings call summary.
- 핵심 가치 경로: 콜 요약
- 포함 신호: earnings call summary, moby summary
- 제외 신호: 
- 빠른 판별 질문: 콜 요약?
- 집계: total=433, impacted=46, max impact=105.37
- 대표 예시:
  - 2026-02-12T08:30:00 | FSLY | Fastly, Inc. Q4 2025 Earnings Call Summary | score=105.37 | tag=multi_window_impact
  - 2026-02-24T16:32:22 | IOVA | Iovance Biotherapeutics, Inc. Q4 2025 Earnings Call Summary | score=79.93 | tag=multi_window_impact

### 실적 혼재·엇갈림 (`earnings_result_mixed_neutral`)
- 상위 분류: `residual`
- 한 줄 정의: EPS beat+매출 miss 또는 반대. 방향 불명확.
- 핵심 가치 경로: 방향 혼재→단기 변동 후 수렴
- 포함 신호: mixed results, beat eps miss revenue
- 제외 신호: 
- 빠른 판별 질문: beat+miss 동시?
- 집계: total=432, impacted=75, max impact=89.93
- 대표 예시:
  - 2025-09-29T05:40:18 | MLTX | Moonlake shares crash on mixed study results for immune drug | score=89.93 | tag=multi_window_impact
  - 2026-02-10T05:56:36 | EVMN | Dow Surges Over 200 Points; Coca-Cola Posts Mixed Q4 Results | score=85.82 | tag=multi_window_impact

### 지정학·전쟁·긴장 영향 (`geopolitical_market_impact`)
- 상위 분류: `residual`
- 한 줄 정의: war, geopolitical tensions, sanctions.
- 핵심 가치 경로: 지정학 리스크→시장 변동
- 포함 신호: geopolitical, middle east, iran war, sanctions, escalating tensions
- 제외 신호: 
- 빠른 판별 질문: 지정학 이벤트?
- 집계: total=424, impacted=39, max impact=55.15
- 대표 예시:
  - 2025-04-08T09:24:15 | MSTR | Why Strategy Inc. (MSTR) Went Down On Monday? | score=55.15 | tag=sustained_repricing
  - 2025-05-19T12:45:00 | LAES | SEALSQ Announces Results of Its 2025 Annual General Meeting (“AGM”) of Shareholders Held on May 19, 2025 | score=53.10 | tag=multi_window_impact

### 부동산·프롭테크 이벤트 (`real_estate_platform_event`)
- 상위 분류: `residual`
- 한 줄 정의: Real estate marketplace, housing platform.
- 핵심 가치 경로: 부동산 플랫폼→시장 전개
- 포함 신호: real estate.*platform, housing market, ibuying, home.*market
- 제외 신호: 
- 빠른 판별 질문: 부동산 플랫폼?
- 집계: total=422, impacted=39, max impact=170.33
- 대표 예시:
  - 2025-08-05T17:05:00 | OPEN | Opendoor Stock Slumps. The Real Estate Market Is Stagnant. | score=170.33 | tag=sustained_repricing
  - 2025-08-06T18:15:00 | OPEN | Prediction: Here's What's Next for Opendoor Technologies, Based on Recent Earnings | score=139.68 | tag=multi_window_impact

### 희귀질환·오판약 이벤트 (`biotech_rare_disease_orphan`)
- 상위 분류: `long`
- 한 줄 정의: Rare disease treatment, orphan drug event.
- 핵심 가치 경로: 희귀질환→고마진 기대
- 포함 신호: rare disease, orphan.*drug, ultra-rare
- 제외 신호: 
- 빠른 판별 질문: 희귀질환?
- 집계: total=419, impacted=68, max impact=154.15
- 대표 예시:
  - 2025-10-15T10:52:10 | OMER | Novo wagers up to $2.1B on Omeros’ rare disease drug | score=154.15 | tag=multi_window_impact
  - 2025-12-11T15:10:55 | RZLT | Rezolute (RZLT): Assessing Valuation After a Year of Strong Share Price Gains | score=87.20 | tag=multi_window_impact

### 여신 확대·부채 관리 (`credit_facility_update`)
- 상위 분류: `long`
- 한 줄 정의: revolving credit expansion, debt management.
- 핵심 가치 경로: 유동성 확보→재무 안정
- 포함 신호: revolving credit, credit facility, extends.*credit, upsizes
- 제외 신호: 
- 빠른 판별 질문: 여신/부채 이벤트?
- 집계: total=412, impacted=60, max impact=346.63
- 대표 예시:
  - 2025-09-24T07:10:00 | QURE | uniQure Announces Refinancing of Existing $50 Million Debt and Securing Up to an Additional $125 Million in Non-Dilutive Funding | score=346.63 | tag=multi_window_impact
  - 2025-09-24T03:12:18 | QURE | uniQure Refinances $50M Debt And Gains Access To Additional $125M Non-Dilutive Funding From Hercules Capital | score=346.63 | tag=multi_window_impact

### AI 파트너십·딜 (`ai_partnership_deal`)
- 상위 분류: `long`
- 한 줄 정의: AI-specific partnership or investment deal.
- 핵심 가치 경로: AI 생태계 연결→가치 증대
- 포함 신호: nvidia.*invest, openai.*deal, ai.*partnership, nvidia.*select, nvidia.*collaborat
- 제외 신호: 
- 빠른 판별 질문: AI 파트너십?
- 집계: total=381, impacted=74, max impact=267.50
- 대표 예시:
  - 2025-05-21T16:17:00 | NVTS | NVIDIA Selects Navitas to Collaborate on Next Generation 800 V HVDC Architecture | score=267.50 | tag=multi_window_impact
  - 2025-05-21T12:16:06 | NVTS | Navitas Semiconductor : NVIDIA Selects Navitas to Collaborate on Next Generation 800 V HVDC Architecture | score=267.50 | tag=multi_window_impact

### 잡것들_멀티종목 나열·언급만 (`잡것들_multi_ticker_roundup_noise`)
- 상위 분류: `residual`
- 한 줄 정의: 여러 종목 나열 기사에서 해당 종목은 단순 언급.
- 핵심 가치 경로: 언급만
- 포함 신호: 5 things to know before, stocks making.*biggest moves, these stocks moved the most, making the biggest moves
- 제외 신호: 
- 빠른 판별 질문: 멀티종목 나열?
- 집계: total=374, impacted=50, max impact=84.25
- 대표 예시:
  - 2025-10-16T10:30:21 | SNDK | Sandisk (SNDK) Soars to All-Time High on Price Target Upgrades | score=84.25 | tag=sustained_repricing
  - 2025-05-22T22:01:09 | AAP | Why Advance Auto Parts, Inc. (AAP) Soared Today | score=68.35 | tag=multi_window_impact

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

### 잡것들_백만장자 가능? 클릭베이트 (`잡것들_millionaire_maker_clickbait`)
- 상위 분류: `residual`
- 한 줄 정의: Can this stock make you a millionaire 유형 클릭베이트.
- 핵심 가치 경로: 클릭베이트
- 포함 신호: millionaire-maker, set you up for life, millionaire.*stock, make you rich
- 제외 신호: 
- 빠른 판별 질문: 클릭베이트?
- 집계: total=369, impacted=44, max impact=145.89
- 대표 예시:
  - 2025-07-31T06:30:00 | OPEN | Is Opendoor Technologies a Millionaire-Maker Stock? | score=145.89 | tag=sustained_repricing
  - 2025-05-28T18:41:00 | ORLY | Could Investing $10,000 in O'Reilly Automotive Make You a Millionaire? | score=93.39 | tag=sustained_repricing

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

### 잡것들_NYSE 벨 행사 노이즈 (`잡것들_ring_bell_ceremony_noise`)
- 상위 분류: `residual`
- 한 줄 정의: NYSE bell ringing ceremony.
- 핵심 가치 경로: 행사 노이즈
- 포함 신호: rings.*nyse.*bell, nyse.*bell.*ringing, nyse content update
- 제외 신호: 
- 빠른 판별 질문: 벨 행사?
- 집계: total=328, impacted=81, max impact=262.82
- 대표 예시:
  - 2025-07-28T09:01:27 | CELC | Trade Outlook Buoys US Equity Futures Pre-Bell | score=262.82 | tag=multi_window_impact
  - 2025-10-23T09:13:27 | VTYX | Tesla Earnings Dent Investor Sentiment, Driving Narrow Premarket Losses for US Equity Futures | score=157.77 | tag=multi_window_impact

### 바이오 학회 데이터·포스터 발표 (`biotech_conference_data_poster`)
- 상위 분류: `residual`
- 한 줄 정의: Conference presentation, poster at ASCO/ASH/SABCS.
- 핵심 가치 경로: 학회 데이터→관심 환기
- 포함 신호: asco, ash.*meeting, sabcs, worldsymposium, idweek, aav.*meeting
- 제외 신호: 
- 빠른 판별 질문: 학회 발표?
- 집계: total=324, impacted=66, max impact=366.86
- 대표 예시:
  - 2025-10-22T07:12:15 | ARMP | Armata Pharma Reports Results From Its Recently Completed Phase 2a diSArm Study Of AP-SA02 As A Potential Treatment For Complicated Staphylococcus Aureus Bacteremia In A Late-Breaking Oral Presentation At IDWeek 2025 | score=366.86 | tag=multi_window_impact
  - 2025-09-03T09:00:00 | MNPR | Monopar Announces Abstract Accepted with Distinction for Oral and Poster Presentations at the Upcoming American Neurological Association 2025 Annual Meeting | score=192.93 | tag=sustained_repricing

### 핵심광물·희소금속 이벤트 (`mining_critical_minerals`)
- 상위 분류: `long`
- 한 줄 정의: Critical minerals, rare earth, antimony, cobalt.
- 핵심 가치 경로: 공급망 전략→가치 재평가
- 포함 신호: critical mineral, antimony, rare earth.*supply, cobalt supply, niobium
- 제외 신호: 
- 빠른 판별 질문: 핵심광물?
- 집계: total=314, impacted=105, max impact=173.40
- 대표 예시:
  - 2025-09-30T08:00:00 | UAMY | United States Antimony Corporation Receives First Delivery Order for ~$10 Million to Produce Antimony Metal Ingots for DoD's Defense Logistics Agency for Strategic Materials | score=173.40 | tag=sustained_repricing
  - 2025-09-30T04:06:25 | UAMY | United States Antimony Corporation Receives ~$10M Delivery Order To Produce Antimony Metal Ingots For DoD's Defense Logistics Agency | score=173.40 | tag=sustained_repricing

### 잡것들_은퇴·개인자산 관리 기사 (`잡것들_retirement_personal_finance`)
- 상위 분류: `residual`
- 한 줄 정의: 은퇴, 개인재무 관리, 401k 관련 기사.
- 핵심 가치 경로: 개인재무 콘텐츠
- 포함 신호: retirement.*portfolio, nest egg, retire.*stock, 401k, rmd.*portfolio, estate plan
- 제외 신호: 
- 빠른 판별 질문: 개인재무?
- 집계: total=292, impacted=16, max impact=86.13
- 대표 예시:
  - 2025-08-13T16:04:00 | DNTH | The Oncology Institute Announces Changes to Board of Directors | score=86.13 | tag=sustained_repricing
  - 2025-10-01T07:35:00 | PPTA | Perpetua Resources Announces Appointment of Mark Murchison to Succeed Jessica Largent as Chief Financial Officer | score=35.94 | tag=sustained_repricing

### 잡것들_애널리스트 레이팅 종합 나열 (`잡것들_analyst_ratings_roundup`)
- 상위 분류: `residual`
- 한 줄 정의: Here Are 10 Top Analyst Forecasts, 5 Analysts Have This To Say.
- 핵심 가치 경로: 나열형 기사
- 포함 신호: top analyst forecasts for, analysts have this to say, analyst forecasts for.*monday, analyst forecasts for.*tuesday, analyst forecasts for.*wednesday, analyst forecasts for.*thursday, analyst forecasts for.*friday
- 제외 신호: 
- 빠른 판별 질문: 레이팅 나열?
- 집계: total=288, impacted=33, max impact=105.30
- 대표 예시:
  - 2025-09-19T13:02:12 | FLNC | What 10 Analyst Ratings Have To Say About Fluence Energy | score=105.30 | tag=multi_window_impact
  - 2026-01-20T12:01:17 | SNDK | What 22 Analyst Ratings Have To Say About SanDisk | score=68.15 | tag=multi_window_impact

### 내부자 매수·자신감 시그널 (`insider_buying_positive`)
- 상위 분류: `long`
- 한 줄 정의: insider buying, director purchases.
- 핵심 가치 경로: 내부자 확신→신뢰
- 포함 신호: insider buying, director.*purchase, ceo.*bought
- 제외 신호: 
- 빠른 판별 질문: 내부자 매수?
- 집계: total=271, impacted=47, max impact=192.55
- 대표 예시:
  - 2025-12-09T09:45:10 | HYMC | Top Insider Purchases in December Signal Market Confidence | score=192.55 | tag=sustained_repricing
  - 2025-08-22T09:00:33 | RAPP | Positive Signs As Multiple Insiders Buy Rapport Therapeutics Stock | score=110.78 | tag=sustained_repricing

### 잡것들_개인 재테크·돈 관리 노이즈 (`잡것들_personal_finance_money_noise`)
- 상위 분류: `residual`
- 한 줄 정의: How to invest $10K, money tips, financial growth.
- 핵심 가치 경로: 개인 재테크
- 포함 신호: got.*extra.*\$10k, how to put it to work, financial growth, how much.*to invest, investment.*for.*growth
- 제외 신호: 
- 빠른 판별 질문: 개인 재테크?
- 집계: total=270, impacted=39, max impact=774.01
- 대표 예시:
  - 2025-08-13T13:24:00 | LCID | Could Buying Lucid Motors Stock Today Set You Up for Life? | score=774.01 | tag=sustained_repricing
  - 2026-01-07T15:04:55 | RDDT | How This Couple Grew Their Liquid Net Worth to $2.3 Million and Crafted Their FIRE Plan | score=44.16 | tag=sustained_repricing

### 의약품 판매허가(비FDA) (`drug_marketing_authorization`)
- 상위 분류: `long`
- 한 줄 정의: EC/EMA marketing authorization, non-FDA 승인.
- 핵심 가치 경로: 해외 시장 접근→매출 확대
- 포함 신호: marketing authorization, european commission, conditional approval
- 제외 신호: 
- 빠른 판별 질문: 비FDA 판매허가?
- 집계: total=267, impacted=68, max impact=247.87
- 대표 예시:
  - 2025-12-18T03:14:38 | IBRX | Jefferies Lifts ImmunityBio Inc. (IBRX) Price Target Following Anktiva European Expansion | score=247.87 | tag=sustained_repricing
  - 2025-09-23T05:04:50 | GRAL | GRAIL To Present New Data Highlighting Galleri MCED Test Performance And Safety From Registrational PATHFINDER 2 Study At ESMO Congress 2025 | score=85.81 | tag=sustained_repricing

### 인프라 법안·지출 (`infrastructure_bill_spending`)
- 상위 분류: `long`
- 한 줄 정의: Infrastructure bill, government spending program.
- 핵심 가치 경로: 정부 지출→수혜 기업
- 포함 신호: infrastructure.*bill, chips act, iija, government.*spending
- 제외 신호: 
- 빠른 판별 질문: 인프라 법안?
- 집계: total=261, impacted=39, max impact=68.20
- 대표 예시:
  - 2025-09-16T13:36:10 | SEI | Solaris Energy Infrastructure, Inc. (SEI): A Bear Case Theory | score=68.20 | tag=sustained_repricing
  - 2025-07-30T18:55:00 | NBIS | This Company Could Be the Amazon of Artificial Intelligence (AI) Infrastructure | score=40.14 | tag=sustained_repricing

### 기관 포트폴리오 변경(13F) (`institutional_portfolio_shift`)
- 상위 분류: `residual`
- 한 줄 정의: fund adds/exits, portfolio shift.
- 핵심 가치 경로: 기관 수급 변화
- 포함 신호: portfolio shift, adds.*position, exits.*position, q4 portfolio, 13f
- 제외 신호: 
- 빠른 판별 질문: 기관 포트폴리오?
- 집계: total=259, impacted=31, max impact=113.74
- 대표 예시:
  - 2026-02-17T10:08:43 | CRCL | Tiger Global Management Increases Stake In Circle Internet Group By 300% To 500,000 Shares | score=113.74 | tag=sustained_repricing
  - 2026-02-18T09:43:52 | CRCL | SoftBank Adds TwentyOne Capital, Exits Nvidia in Q4 Portfolio Shift | score=104.53 | tag=sustained_repricing

### 스트리밍·미디어 이벤트 (`streaming_media_event`)
- 상위 분류: `residual`
- 한 줄 정의: Streaming platform, content deal, media merger.
- 핵심 가치 경로: 미디어 시장→경쟁
- 포함 신호: streaming.*platform, content deal, media.*merger, ad revenue.*surpass
- 제외 신호: 
- 빠른 판별 질문: 스트리밍/미디어?
- 집계: total=254, impacted=45, max impact=66.13
- 대표 예시:
  - 2025-08-11T14:52:39 | PSKY | Paramount Snatches $7.7B UFC Deal--Shakes Up Streaming's Fight for Subscribers | score=66.13 | tag=multi_window_impact
  - 2025-11-19T07:30:00 | SATS | Sling TV Celebrates Court Win With $1 Day Pass Offer, Vows to Continue Fight for Consumer Choice | score=56.12 | tag=sustained_repricing

### 수소·연료전지 이벤트 (`hydrogen_fuel_cell_event`)
- 상위 분류: `long`
- 한 줄 정의: Hydrogen fuel cell, green hydrogen.
- 핵심 가치 경로: 수소경제→TAM
- 포함 신호: hydrogen, fuel cell, green hydrogen, fuelcell
- 제외 신호: 
- 빠른 판별 질문: 수소/연료전지?
- 집계: total=245, impacted=105, max impact=152.59
- 대표 예시:
  - 2025-09-08T07:02:38 | FCEL | Insights into FuelCell Energy's Upcoming Earnings | score=152.59 | tag=multi_window_impact
  - 2025-09-09T08:32:50 | FCEL | FuelCell Energy Q3 FY2025 Earnings Call Transcript | score=134.12 | tag=multi_window_impact

### EV 인도·생산 실적 (`ev_delivery_production`)
- 상위 분류: `residual`
- 한 줄 정의: Quarterly delivery/production numbers for EV makers.
- 핵심 가치 경로: 분기 실적 확인
- 포함 신호: deliveries.*q, production.*q, units delivered
- 제외 신호: 
- 빠른 판별 질문: EV 인도/생산?
- 집계: total=237, impacted=50, max impact=62.59
- 대표 예시:
  - 2025-11-18T04:03:00 | POET | POET: Flush With Cash, POET Starts to Ship Production Orders in Q4 | score=62.59 | tag=sustained_repricing
  - 2025-08-13T19:21:00 | EQX | Equinox Gold Delivers Solid Second Quarter 2025 Financial and Operating Results | score=59.32 | tag=sustained_repricing

### 비상장화·바이아웃 (`go_private_buyout_event`)
- 상위 분류: `long`
- 한 줄 정의: Go-private deal, take-private, private equity buyout.
- 핵심 가치 경로: 비상장 프리미엄→주주가치
- 포함 신호: go private, take.*private, private equity.*buy, \$.*per.*share.*deal
- 제외 신호: 
- 빠른 판별 질문: 비상장화?
- 집계: total=228, impacted=40, max impact=57.63
- 대표 예시:
  - 2025-09-17T07:46:55 | MUX | McEwen (NYSE:MUX) Valuation in Focus After High-Grade Nevada Windfall Drilling Results and New Discovery | score=57.63 | tag=sustained_repricing
  - 2025-09-15T08:34:58 | INTC | Intel trims 2025 operating expenses outlook after Altera deconsolidation | score=54.28 | tag=multi_window_impact

### 주식분할·병합 이벤트 (`stock_split_event`)
- 상위 분류: `residual`
- 한 줄 정의: Stock split, forward split, reverse split (already separate).
- 핵심 가치 경로: 주식 구조 변경→유동성 변화
- 포함 신호: forward.*split, stock split, share consolidation, splitting.*shares
- 제외 신호: reverse stock split
- 빠른 판별 질문: 주식분할?
- 집계: total=225, impacted=52, max impact=219.08
- 대표 예시:
  - 2025-06-16T11:52:53 | RGC | What's Going On With Regencell Bioscience Stock Today? | score=219.08 | tag=multi_window_impact
  - 2025-06-16T11:00:49 | RGC | Regencell Bioscience Stock Skyrockets as 38-to-1 Split Takes Effect | score=219.08 | tag=multi_window_impact

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

### 바이오 안전성 우려 (`biotech_safety_concern_negative`)
- 상위 분류: `short`
- 한 줄 정의: Adverse events, safety signal, dose-limiting toxicity.
- 핵심 가치 경로: 안전성 리스크→개발 차질
- 포함 신호: adverse event, safety concern, toxicity, dose-limiting, liver injury
- 제외 신호: 
- 빠른 판별 질문: 안전성 이슈?
- 집계: total=218, impacted=59, max impact=211.80
- 대표 예시:
  - 2026-01-20T10:00:10 | CRVS | Corvus Stock Spikes On Heels Of Strong Eczema Study Results | score=211.80 | tag=multi_window_impact
  - 2025-10-21T16:05:00 | TERN | Terns Pharmaceuticals Reports Topline 12-week Data from its Phase 2 Trial Evaluating Oral GLP-1 Receptor Agonist TERN-601 in Obesity | score=202.90 | tag=sustained_repricing

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

### 사이버보안 침해 이벤트 (`cybersecurity_breach_event`)
- 상위 분류: `short`
- 한 줄 정의: Data breach, ransomware, security incident.
- 핵심 가치 경로: 보안 사고→비용/신뢰
- 포함 신호: data breach, ransomware, security incident
- 제외 신호: 
- 빠른 판별 질문: 보안 침해?
- 집계: total=212, impacted=33, max impact=70.40
- 대표 예시:
  - 2025-06-13T08:30:05 | COIN | Coinbase Sets Focus On Addressing Long-Running Account Restriction Issues After Data Breach Hit To User Trust | score=70.40 | tag=multi_window_impact
  - 2025-04-09T13:47:00 | ST | Sensata Technologies Reports Ransomware Incident, Interruption to Operations | score=56.42 | tag=sustained_repricing

### 소비자·브랜드 이벤트 (`consumer_brand_event`)
- 상위 분류: `residual`
- 한 줄 정의: Store opening, retail concept, brand campaign.
- 핵심 가치 경로: 브랜드 변화→매출 영향
- 포함 신호: new store, store opening, retail.*concept, brand.*campaign, luxury store
- 제외 신호: 
- 빠른 판별 질문: 소비자 브랜드?
- 집계: total=210, impacted=15, max impact=42.72
- 대표 예시:
  - 2025-04-11T15:36:47 | APP | Tech Stocks Soared This Week, but Uncertainty Persists | score=42.72 | tag=sustained_repricing
  - 2025-03-06T07:43:00 | KSS | Kohl's Gears Up for Q4 Earnings: Here's What You Should Understand | score=40.05 | tag=sustained_repricing

### 잡것들_공매도 보고서 공격 (`잡것들_short_report_attack`)
- 상위 분류: `residual`
- 한 줄 정의: Short seller report, short attack.
- 핵심 가치 경로: 공매도 공격
- 포함 신호: culper.*research.*short, short.*report, hindenburg.*short, citron.*short, muddy waters.*short, bear cave
- 제외 신호: 
- 빠른 판별 질문: 공매도 보고서?
- 집계: total=207, impacted=73, max impact=82.77
- 대표 예시:
  - 2025-01-15T12:58:00 | SMCI | Short Seller Hindenburg Research Closes Up Shop | score=82.77 | tag=sustained_repricing
  - 2025-09-05T08:48:10 | OPEN | Opendoor Attacked By Short Seller—Stock Pops Anyway | score=60.57 | tag=sustained_repricing

### 전력·유틸리티 인프라 이벤트 (`utility_infrastructure_event`)
- 상위 분류: `long`
- 한 줄 정의: Power grid, utility project, energy infrastructure.
- 핵심 가치 경로: 인프라 투자→매출 파이프라인
- 포함 신호: power grid, utility.*project, energy infrastructure, grid moderniz
- 제외 신호: 
- 빠른 판별 질문: 전력/유틸리티?
- 집계: total=203, impacted=29, max impact=66.80
- 대표 예시:
  - 2025-08-04T08:00:00 | RUN | Sunrun Dispatches a Record Amount of Energy to California’s Grid During a Historic Event | score=66.80 | tag=sustained_repricing
  - 2025-06-25T17:00:00 | RUN | Sunrun Dispatches More Than 340 Megawatts of Power in Single Evening to Support the Grid from Coast to Coast | score=54.86 | tag=sustained_repricing

### 잡것들_모멘텀·실적 뒤따르기 필러 (`잡것들_momentum_outpacing_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Outpacing peers, momentum stock, strong buy now.
- 핵심 가치 경로: 모멘텀 필러
- 포함 신호: outpacing.*peers, is.*stock.*outpacing, what makes.*strong momentum, strong momentum stock.*buy now
- 제외 신호: 
- 빠른 판별 질문: 모멘텀 필러?
- 집계: total=199, impacted=28, max impact=60.91
- 대표 예시:
  - 2025-01-08T20:00:00 | PLTR | Crypto Funds Are Beating All Others. It’s One Sign of Trump’s New Market. | score=60.91 | tag=sustained_repricing
  - 2025-08-27T11:03:06 | IONQ | IonQ (IONQ) Rallies as Fed Rate Cuts to Benefit Firm | score=57.69 | tag=sustained_repricing

### 정부 계약 수주 정보(flow) (`government_contract_award_info`)
- 상위 분류: `long`
- 한 줄 정의: Government/DOD contract award, federal procurement.
- 핵심 가치 경로: 계약 수주→backlog
- 포함 신호: government contract, dod contract, defense contract
- 제외 신호: 
- 빠른 판별 질문: 정부 계약?
- 집계: total=194, impacted=36, max impact=57.71
- 대표 예시:
  - 2025-09-15T09:00:00 | KOPN | Kopin Secures Transformative $15.4M Award to Revolutionize Color MicroLED Technology and Domestic Production for U.S. Army Ground Soldier Integrated Visual Augmented Reality Applications | score=57.71 | tag=sustained_repricing
  - 2025-09-15T04:14:23 | KOPN | Kopin Wins $15.4M Other Transaction Agreement From The Office Of The Secretary Of Defense Through U.S. Army Contracting Command Under Industrial Base Analysis And Sustainment Program | score=57.71 | tag=sustained_repricing

### 잡것들_주주총회 투표 결과 (`잡것들_agm_voting_result`)
- 상위 분류: `residual`
- 한 줄 정의: AGM results, annual meeting voting.
- 핵심 가치 경로: AGM 결과
- 포함 신호: results of annual general meeting, voting results, annual.*meeting.*results, shareholder.*meeting.*results
- 제외 신호: 
- 빠른 판별 질문: AGM 투표?
- 집계: total=186, impacted=27, max impact=675.10
- 대표 예시:
  - 2025-05-30T07:00:00 | MFI | mF International Limited Announces Results of Annual General Meeting | score=675.10 | tag=multi_window_impact
  - 2025-01-10T17:30:00 | NB | NioCorp’s Shifts 2024 Annual General Meeting Date to March 20, 2025 | score=62.58 | tag=sustained_repricing

### 건자재·주택건설 이벤트 (`home_construction_materials`)
- 상위 분류: `residual`
- 한 줄 정의: Home construction, building materials.
- 핵심 가치 경로: 건설 시장→매출 동향
- 포함 신호: home construction, building material, construction.*materials
- 제외 신호: 
- 빠른 판별 질문: 건자재?
- 집계: total=184, impacted=7, max impact=25.76
- 대표 예시:
  - 2025-05-29T23:34:56 | IBP | Q1 Earnings Roundup: Installed Building Products (NYSE:IBP) And The Rest Of The Home Builders Segment | score=25.76 | tag=sustained_repricing
  - 2026-01-21T16:30:00 | CSGP | Homes.com Report: 2025 Showed Continued National Home Price Appreciation But the First Year-Over-Year Improvement in Affordability Since 2020 | score=24.99 | tag=sustained_repricing

### 일간 지수·시장 요약 (`daily_market_index_summary`)
- 상위 분류: `residual`
- 한 줄 정의: Dow Gains/Dips X Points; earnings.
- 핵심 가치 경로: 시장 요약
- 포함 신호: dow dips, dow gains, dow rises, dow falls, nasdaq gains, us stocks, crude oil gains
- 제외 신호: 
- 빠른 판별 질문: 일간 시장 요약?
- 집계: total=163, impacted=65, max impact=648.56
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
- 집계: total=154, impacted=46, max impact=250.53
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
- 집계: total=141, impacted=25, max impact=62.54
- 대표 예시:
  - 2025-10-20T12:03:44 | VICR | Vicor Steps Up IP Licensing After U.S. Import Ban On Infringing Power Modules | score=62.54 | tag=multi_window_impact
  - 2026-01-06T17:34:00 | SLAB | Silicon Labs Appoints Ian N. Dawson as Chief Information Security Officer to Lead Enterprise Security Strategy | score=49.71 | tag=sustained_repricing

### 위성·우주통신 이벤트 (`satellite_space_communication`)
- 상위 분류: `long`
- 한 줄 정의: Satellite, space-based broadband, SPOT devices.
- 핵심 가치 경로: 우주통신→TAM 확대
- 포함 신호: satellite.*broadband, space-based.*cellular, spot.*device, satellite iot, leo.*satellite
- 제외 신호: 
- 빠른 판별 질문: 위성/우주통신?
- 집계: total=138, impacted=48, max impact=1236.81
- 대표 예시:
  - 2025-01-28T09:16:00 | GSAT | Globalstar Partner Global Telesat Communications Sees Massive 35% YoY Growth in SPOT and Satellite IoT Device Sales in 2024 | score=1236.81 | tag=sustained_repricing
  - 2025-01-28T05:21:04 | GSAT | Global Telesat Communications Has Seen Sales Of Globalstar SPOT And Satellite IoT Devices Dramatically Increase, A 35% Boost Compared To The Same Period In 2023 | score=1236.81 | tag=sustained_repricing

### 드론·UAV 방산 이벤트 (`drone_uav_defense`)
- 상위 분류: `long`
- 한 줄 정의: Drone defense, UAV contract, autonomous attack.
- 핵심 가치 경로: 드론 방산→수주
- 포함 신호: drone.*defense, uav.*contract, unmanned aircraft, autonomous.*attack, one-way attack
- 제외 신호: 
- 빠른 판별 질문: 드론/UAV?
- 집계: total=133, impacted=58, max impact=101.59
- 대표 예시:
  - 2025-05-08T05:15:00 | ONDS | Ondas Holdings Inc. Secures A $3.4 Million Order for Its Iron Drone Raider Counter-Uas System | score=101.59 | tag=sustained_repricing
  - 2025-12-16T16:07:29 | RCAT | Does Red Cat (RCAT) Seeking Blue UAS Cyber Clearance Reframe Its Defense-Grade Competitive Moat? | score=92.65 | tag=sustained_repricing

### 임상3상 긍정 결과 (`biotech_clinical_phase3_positive`)
- 상위 분류: `long`
- 한 줄 정의: Phase 3 trial meets primary endpoint.
- 핵심 가치 경로: NDA 가시성→상업화 기대
- 포함 신호: phase 3.*met primary, phase 3.*positive, pivotal trial.*success
- 제외 신호: 
- 빠른 판별 질문: Phase 3 성공?
- 집계: total=128, impacted=30, max impact=227.82
- 대표 예시:
  - 2025-11-18T05:00:41 | OLMA | Olema Pharmaceuticals Shares Trading Higher; Stock Reacts To Roche lidERA Phase 3 Results Demonstrating Superiority Over Aromatase Inhibitors In Early-Breast Cancer, De-Risking SERD Class Development | score=227.82 | tag=multi_window_impact
  - 2025-12-15T06:00:00 | GLSI | Greenwich LifeSciences Announces Preliminary Analysis Showing 80% Recurrence Rate Reduction in the Open Label Arm of FLAMINGO-01 | score=131.87 | tag=sustained_repricing

### 광산 생산 실적·가이던스 (`mining_production_results`)
- 상위 분류: `residual`
- 한 줄 정의: Quarterly production report, ounces produced.
- 핵심 가치 경로: 생산 실적 확인
- 포함 신호: ounces of gold, ounces.*produced, production.*results, development update
- 제외 신호: 
- 빠른 판별 질문: 광산 생산 실적?
- 집계: total=127, impacted=35, max impact=59.71
- 대표 예시:
  - 2026-01-22T03:19:43 | ASM | Avino Silver & Gold Mines Reports FY25 Production Results Of 1,157,828 Silver Oz, 7,621 Gold Oz And 5,667,996 Pounds Of Copper, For Total Of 2.6M Silver Equivalent 1 Oz | score=59.71 | tag=multi_window_impact
  - 2025-04-09T13:05:00 | CRS | First Majestic's Q1 Silver-Equivalent Production Jumps 49% Y/Y | score=43.23 | tag=multi_window_impact

### 애널리스트 코멘트 증폭(부정) (`analyst_note_amplification_negative`)
- 상위 분류: `short`
- 한 줄 정의: formal downgrade 아닌 cautious/bearish note.
- 핵심 가치 경로: warning note→sentiment 이탈
- 포함 신호: analyst warns, cautious note, bearish
- 제외 신호: formal downgrade
- 빠른 판별 질문: note 증폭(부정)?
- 집계: total=124, impacted=29, max impact=661.98
- 대표 예시:
  - 2025-08-06T10:32:27 | LCID | Why Lucid Stock Investors Are Pumping the Brakes Today | score=661.98 | tag=sustained_repricing
  - 2025-04-22T03:37:04 | CRWV | This American Water Works Analyst Begins Coverage On A Bearish Note; Here Are Top 5 Initiations For Tuesday | score=182.82 | tag=sustained_repricing

### 바이오 실사용 데이터·레지스트리 (`biotech_real_world_data`)
- 상위 분류: `residual`
- 한 줄 정의: Real-world data, registry study, post-marketing data.
- 핵심 가치 경로: 실사용 근거→확장 적응증
- 포함 신호: real-world, registry study, post-marketing, utract
- 제외 신호: 
- 빠른 판별 질문: 실사용 데이터?
- 집계: total=123, impacted=15, max impact=238.21
- 대표 예시:
  - 2025-06-02T11:00:00 | URGN | UroGen Presents uTRACT Registry at ASCO 2025 Annual Meeting Designed to Study Real-World Use of JELMYTO in Low-Grade Upper Tract Urothelial Cancer | score=238.21 | tag=sustained_repricing
  - 2025-07-23T08:00:00 | INDV | Indivior Real World Evidence Study Finds Medications for Opioid Use Disorder, Particularly Extended-Release Buprenorphine, Reduced Odds of Emergency Department Visits for Patients with Opioid Use Disorder | score=50.31 | tag=sustained_repricing

### 반도체 기술 진보 (`semiconductor_technology_advance`)
- 상위 분류: `long`
- 한 줄 정의: GaN, SiC, new fabrication process.
- 핵심 가치 경로: 기술 리더십→시장 침투
- 포함 신호: gan.*ic, sic mosfet, gan technology, silicon carbide, bi-directional gan
- 제외 신호: 
- 빠른 판별 질문: 반도체 기술 진보?
- 집계: total=120, impacted=26, max impact=249.46
- 대표 예시:
  - 2025-04-24T21:30:00 | NVTS | Navitas Semiconductor Announces Corporate Governance Enhancements | score=249.46 | tag=sustained_repricing
  - 2025-05-14T16:15:00 | NVTS | Navitas Semiconductor Appoints Cristiano Amoruso to Board of Directors | score=235.98 | tag=sustained_repricing

### 비FDA 규제기관 승인·조치 (`biotech_regulatory_international`)
- 상위 분류: `long`
- 한 줄 정의: Saudi FDA, MHRA, TGA, non-US approval.
- 핵심 가치 경로: 해외시장→매출 다각화
- 포함 신호: saudi food and drug, mhra, ema.*approve, health canada.*approve, sfda
- 제외 신호: 
- 빠른 판별 질문: 비FDA 승인?
- 집계: total=119, impacted=17, max impact=160.28
- 대표 예시:
  - 2026-01-14T04:33:40 | IBRX | ImmunityBio Granted Approval From Saudi Food And Drug Authority Of ANKTIVA Plus Bacillus Calmette-Guérin To Treat Adult Patients With BCG-Unresponsive Non-Muscle Invasive Bladder Cancer Carcinoma | score=160.28 | tag=multi_window_impact
  - 2026-02-17T05:16:11 | IBRX | ImmunityBio shares are trading higher after the company announced that it held discussions with the Saudi Food and Drug Authority in Riyadh. | score=94.28 | tag=multi_window_impact

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

### 잡것들_무관 자회사·타사 뉴스 태그 (`잡것들_unrelated_subsidiary_noise`)
- 상위 분류: `residual`
- 한 줄 정의: Subsidiary or unrelated company news tagged to parent.
- 핵심 가치 경로: 잘못된 태깅
- 포함 신호: title resources group, parcel plus, piper sandler.*circle, opendoor.*title resources
- 제외 신호: 
- 빠른 판별 질문: 무관 자회사?
- 집계: total=107, impacted=19, max impact=71.75
- 대표 예시:
  - 2025-05-08T07:10:18 | VOR | Vor Biopharma Terminates CFO Han Choi | score=71.75 | tag=multi_window_impact
  - 2025-05-08T04:39:47 | VOR | Vor Biopharma Board Approved Plan To Reduce ~95% Of Employee Base, Total Wind Down Costs ~$19.3M; Co. Terminates Employment Of Han Choi As CFO | score=71.75 | tag=multi_window_impact

### 임상2상 긍정 결과 (`biotech_clinical_phase2_positive`)
- 상위 분류: `long`
- 한 줄 정의: Phase 2 trial positive results.
- 핵심 가치 경로: Phase 3 진입 기대
- 포함 신호: phase 2.*results, phase 2b.*data
- 제외 신호: failed
- 빠른 판별 질문: Phase 2 긍정?
- 집계: total=99, impacted=25, max impact=648.56
- 대표 예시:
  - 2025-07-08T18:48:28 | PROK | ProKidney Stock Shoots Up Over 8% After Hours After Staggering 515% Rally On Wednesday | score=648.56 | tag=multi_window_impact
  - 2025-10-23T09:40:54 | VTYX | Ventyx Stock Is Rallying Thursday: What's Driving The Surge? | score=157.77 | tag=multi_window_impact

### EV·전기차 제품 이벤트 (`ev_vehicle_product_event`)
- 상위 분류: `long`
- 한 줄 정의: EV launch, electric vehicle production.
- 핵심 가치 경로: EV 제품→시장 기대
- 포함 신호: electric suv, ev.*production, ev.*launch, gravity.*suv, electric vehicle, ev charger
- 제외 신호: 
- 빠른 판별 질문: EV 제품?
- 집계: total=99, impacted=15, max impact=840.37
- 대표 예시:
  - 2025-08-18T07:15:00 | LCID | Is Lucid's Much-Hyped Gravity Electric SUV Already Failing? | score=840.37 | tag=sustained_repricing
  - 2025-08-12T13:18:01 | LCID | Lucid Sets Sights On Collectors And Connoisseurs At Monterey Car Week | score=780.14 | tag=sustained_repricing

### 잡것들_Top Gainers/Losers 목록 (`잡것들_top_midday_gainers_losers`)
- 상위 분류: `residual`
- 한 줄 정의: Top Midday Gainers, Top Midday Decliners.
- 핵심 가치 경로: 목록 기사
- 포함 신호: top midday gainers, top midday decliners, top midday losers
- 제외 신호: 
- 빠른 판별 질문: Gainers/Losers 목록?
- 집계: total=98, impacted=57, max impact=238.11
- 대표 예시:
  - 2025-08-29T13:55:37 | YDES | Top Midday Gainers | score=238.11 | tag=multi_window_impact
  - 2025-11-03T14:10:47 | TERN | Top Midday Gainers | score=228.45 | tag=multi_window_impact

### 사이버보안 이벤트 (`cybersecurity_event`)
- 상위 분류: `long`
- 한 줄 정의: Cybersecurity deal, security platform deployment.
- 핵심 가치 경로: 보안 수요→매출
- 포함 신호: cybersecurity, security.*platform, falcon.*platform, zero trust
- 제외 신호: 
- 빠른 판별 질문: 사이버보안?
- 집계: total=95, impacted=23, max impact=31.97
- 대표 예시:
  - 2026-01-28T08:00:00 | IT | Zero Networks Recognized with a Five Star Rating in the 2026 Gartner Peer Insights™ Voice of the Customer for Network Security Microsegmentation | score=31.97 | tag=sustained_repricing
  - 2026-01-27T03:01:00 | ZS | Zscaler 2026 AI Threat Report: 91% Year-over-Year Surge in AI Activity Creates Growing Oversight Gap for Global Enterprises | score=31.49 | tag=sustained_repricing

### ESG·지속가능성 이벤트 (`esg_sustainability_event`)
- 상위 분류: `residual`
- 한 줄 정의: ESG report, sustainability initiative, carbon reduction.
- 핵심 가치 경로: ESG 관심→평판
- 포함 신호: esg.*report, sustainability, carbon.*reduction, corporate responsibility
- 제외 신호: 
- 빠른 판별 질문: ESG/지속가능성?
- 집계: total=94, impacted=16, max impact=61.08
- 대표 예시:
  - 2025-05-08T07:00:00 | CDE | Coeur Publishes 2024 Responsibility Report | score=61.08 | tag=multi_window_impact
  - 2025-04-28T17:37:00 | SGML | SIGMA LITHIUM TO RELEASE FIRST QUARTER 2025 RESULTS ON MAY 14, 2025 | score=39.26 | tag=sustained_repricing

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
- 집계: total=87, impacted=19, max impact=45.45
- 대표 예시:
  - 2025-06-05T13:52:44 | RKLB | Rocket Lab, AST SpaceMobile, Virgin Galactic Shares Are Rising After Hours: What's Going On? | score=45.45 | tag=sustained_repricing
  - 2025-10-16T13:24:18 | HIMS | Eli Lilly, Novo Nordisk, Hims & Hers Health Shares Move Lower After Trump Calls Out 'Fat-Loss Drugs' | score=43.31 | tag=sustained_repricing

### 보험·인슈어테크 이벤트 (`insurance_event`)
- 상위 분류: `residual`
- 한 줄 정의: Insurance pricing, underwriting event.
- 핵심 가치 경로: 보험 시장→수익성
- 포함 신호: insurance.*pricing, underwriting, insurtech
- 제외 신호: 
- 빠른 판별 질문: 보험?
- 집계: total=86, impacted=15, max impact=46.74
- 대표 예시:
  - 2025-08-06T09:45:08 | OSCR | Oscar Health (NYSE:OSCR) Misses Q2 Sales Targets | score=46.74 | tag=sustained_repricing
  - 2025-04-01T20:00:00 | HIMS | Who Should Pay for Ozempic Is the Next Big Workplace Fight | score=38.14 | tag=sustained_repricing

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

### 공급망 차질 이벤트 (`supply_chain_disruption_event`)
- 상위 분류: `short`
- 한 줄 정의: Supply chain disruption, component shortage.
- 핵심 가치 경로: 공급 차질→생산 영향
- 포함 신호: supply chain disruption, component shortage
- 제외 신호: 
- 빠른 판별 질문: 공급망 차질?
- 집계: total=81, impacted=23, max impact=118.17
- 대표 예시:
  - 2026-01-06T08:08:23 | SNDK | Shares of memory and storage stocks are trading higher amid reports of chip shortages. | score=118.17 | tag=multi_window_impact
  - 2026-01-12T11:09:11 | SNDK | Shares of memory and storage stocks are trading higher. The sector has gained amid reports of chip shortages. | score=67.00 | tag=sustained_repricing

### 혼합 선반등록·Shelf Filing (`shelf_registration_filing`)
- 상위 분류: `residual`
- 한 줄 정의: Mixed shelf filing without immediate offering.
- 핵심 가치 경로: 향후 조달 가능성
- 포함 신호: mixed shelf, shelf.*registration, shelf of up to
- 제외 신호: public offering, common stock offering
- 빠른 판별 질문: 선반등록?
- 집계: total=81, impacted=21, max impact=166.10
- 대표 예시:
  - 2025-11-07T12:54:17 | COGT | Cogent Biosciences Files For Mixed Shelf Offering, Size Not Disclosed | score=166.10 | tag=multi_window_impact
  - 2025-05-02T12:09:15 | OUST | Ouster Files For Mixed Shelf Offering Of Up To $200M | score=84.30 | tag=sustained_repricing

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

### 잡것들_이벤트 일정·스케줄 공지 (`잡것들_company_event_schedule_noise`)
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

### 핀테크·결제 이벤트 (`fintech_payment_event`)
- 상위 분류: `long`
- 한 줄 정의: Payment platform, BNPL, fintech growth.
- 핵심 가치 경로: 핀테크→시장 침투
- 포함 신호: buy now.*pay later, bnpl, payment.*platform, fintech.*growth
- 제외 신호: 
- 빠른 판별 질문: 핀테크/결제?
- 집계: total=71, impacted=17, max impact=139.46
- 대표 예시:
  - 2025-05-07T16:10:00 | SEZL | Sezzle Reports First Quarter 2025 Results | score=139.46 | tag=multi_window_impact
  - 2025-06-02T16:53:00 | SATS | EchoStar Misses Second Interest Payment Amid FCC Review | score=76.88 | tag=sustained_repricing

### 바이오 등록·모집 마일스톤 (`biotech_enrollment_milestone`)
- 상위 분류: `long`
- 한 줄 정의: Enrollment completion, screening milestone.
- 핵심 가치 경로: 임상 진행 가시성
- 포함 신호: completes enrollment, enrollment completed, screening over
- 제외 신호: 
- 빠른 판별 질문: 등록 완료?
- 집계: total=70, impacted=25, max impact=182.77
- 대표 예시:
  - 2025-12-08T02:04:33 | GLSI | Greenwich Lifesciences Completed Enrollment In Open-Label HLA-A*02 Arm of FLAMINGO-01 Phase 3 Trial Of GLSI-100, An Immunotherapy To Prevent Breast Cancer Recurrences | score=182.77 | tag=sustained_repricing
  - 2025-12-03T06:00:00 | GLSI | Greenwich LifeSciences Provides Global Update on FLAMINGO-01, Screening Over 1,000 Patients to Date | score=156.62 | tag=sustained_repricing

### 갭 상승/하락 종목 (`gapping_stocks_analysis`)
- 상위 분류: `residual`
- 한 줄 정의: gapping stocks, gap-ups and gap-downs.
- 핵심 가치 경로: 갭 분석
- 포함 신호: gapping stocks, gap up, gap down, gap-ups
- 제외 신호: 
- 빠른 판별 질문: 갭 종목 분석?
- 집계: total=69, impacted=25, max impact=66.54
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
- 집계: total=60, impacted=19, max impact=63.77
- 대표 예시:
  - 2026-01-08T08:00:00 | MLTX | MoonLake Immunotherapeutics Announces Positive Outcome from Type B Meeting with U.S. FDA and Announces Investor Day | score=63.77 | tag=multi_window_impact
  - 2025-06-18T12:36:42 | COIN | Circle Internet, Coinbase jump as Senate clears stablecoin bill | score=59.32 | tag=multi_window_impact

### 게임·엔터테인먼트 이벤트 (`gaming_entertainment_event`)
- 상위 분류: `residual`
- 한 줄 정의: Gaming industry, video game release, GTA 6.
- 핵심 가치 경로: 게임 시장→매출 기대
- 포함 신호: gta 6, gaming.*company, video game, game.*release, bookings.*climb, gaming stock
- 제외 신호: 
- 빠른 판별 질문: 게임/엔터?
- 집계: total=57, impacted=17, max impact=41.40
- 대표 예시:
  - 2025-05-08T06:23:30 | CRSR | Corsair Gaming First Quarter 2025 Earnings: US$0.096 loss per share (vs US$0.12 loss in 1Q 2024) | score=41.40 | tag=sustained_repricing
  - 2025-04-30T12:11:40 | APP | Snap withholds guidance, Applovin gaming, Etsy's Q1 revenue | score=39.13 | tag=sustained_repricing

### 잡것들_SPY/QQQ 매크로 기사 태그 (`잡것들_spy_qqq_macro_tag`)
- 상위 분류: `residual`
- 한 줄 정의: SPY/QQQ로 태그된 범용 매크로 기사.
- 핵심 가치 경로: 범용 매크로
- 포함 신호: s&p.*call.*for december, macro.*etf, spy vs.*iwm
- 제외 신호: 
- 빠른 판별 질문: SPY/QQQ 매크로?
- 집계: total=57, impacted=6, max impact=52.46
- 대표 예시:
  - 2025-09-04T07:02:28 | INTC | Watching Krispy Kreme, Intel; Shares See Volume To Upside, Traders Circulate Rep. Tim Moore Representing NC-14, Latest Financial Disclosures Revealing A Mix Of Healthcare, Tech, And ETF Trades | score=52.46 | tag=sustained_repricing
  - 2025-08-08T10:00:00 | RUN | 5 Stocks in QQQ ETF That Drove Nasdaq's Record Closing High | score=35.00 | tag=sustained_repricing

### 잡것들_인덱스 재구성·펀드 리밸런스 (`잡것들_index_fund_reconstitution`)
- 상위 분류: `residual`
- 한 줄 정의: Russell reconstitution, index add/remove automated.
- 핵심 가치 경로: 자동 게시
- 포함 신호: added to russell, reconstitution, semi-annual.*reconstitution
- 제외 신호: 
- 빠른 판별 질문: 인덱스 재구성?
- 집계: total=49, impacted=5, max impact=139.70
- 대표 예시:
  - 2025-08-27T16:32:00 | SNDK | Bloomberg 500 (B500) Index Adds Sixteen Securities Following Semi-Annual Reconstitution | score=139.70 | tag=sustained_repricing
  - 2026-01-29T03:09:57 | LZ | LegalZoom Index Addition Tests Belief In Online Legal Growth Story | score=28.54 | tag=sustained_repricing

### AI 모델·제품 출시 (`ai_model_product_launch`)
- 상위 분류: `long`
- 한 줄 정의: AI model release, foundation model, LLM update.
- 핵심 가치 경로: AI 역량→시장 관심
- 포함 신호: foundation model, llm.*launch, ai.*agent.*launch, genai.*capabilities
- 제외 신호: 
- 빠른 판별 질문: AI 제품 출시?
- 집계: total=47, impacted=10, max impact=176.56
- 대표 예시:
  - 2025-01-14T03:33:04 | TEM | Tempus One Introduces New GenAI Capabilities to Query Millions of Unstructured Documents for Research and Clinical Care | score=176.56 | tag=sustained_repricing
  - 2025-09-03T10:00:00 | SNPS | Synopsys Announces Expanding AI Capabilities for its Leading EDA Solutions | score=34.50 | tag=sustained_repricing

### 위성 스펙트럼·규제 인가 (`satellite_spectrum_regulatory`)
- 상위 분류: `long`
- 한 줄 정의: FCC spectrum allocation, satellite license, orbital coordination.
- 핵심 가치 경로: 규제 인가→상업화 경로
- 포함 신호: spectrum allocation, fcc approval, satellite license
- 제외 신호: 
- 빠른 판별 질문: 스펙트럼 인가?
- 집계: total=46, impacted=10, max impact=40.69
- 대표 예시:
  - 2025-01-13T07:30:00 | ATEX | Lower Colorado River Authority Widens Wireless Communications Capabilities with Additional Spectrum Licenses from Anterix | score=40.69 | tag=sustained_repricing
  - 2025-11-06T06:41:27 | SATS | EchoStar to sell more spectrum licenses to SpaceX for $2.6 billion | score=29.34 | tag=sustained_repricing

### 패션·의류 산업 이벤트 (`fashion_apparel_event`)
- 상위 분류: `residual`
- 한 줄 정의: Fashion industry, apparel tariff, resale.
- 핵심 가치 경로: 패션 시장→매출 동향
- 포함 신호: fashion industry, apparel.*tariff, resale.*market, de minimis
- 제외 신호: 
- 빠른 판별 질문: 패션/의류?
- 집계: total=46, impacted=6, max impact=57.14
- 대표 예시:
  - 2025-03-20T08:02:44 | TDUP | Resale’s popularity in the US could offer hedge against tariffs | score=57.14 | tag=sustained_repricing
  - 2025-03-19T06:00:00 | TDUP | ThredUp’s 13th Resale Report Shows Online Resale Saw Accelerated Growth in 2024 and Is Expected to Reach $40 Billion by 2029 | score=49.78 | tag=sustained_repricing

### 은행·여신 이벤트 (`banking_credit_event`)
- 상위 분류: `residual`
- 한 줄 정의: Bank earnings, credit quality, NIM.
- 핵심 가치 경로: 은행 실적→금융 환경
- 포함 신호: net interest margin, credit quality, bank.*quarter
- 제외 신호: 
- 빠른 판별 질문: 은행/여신?
- 집계: total=45, impacted=11, max impact=72.25
- 대표 예시:
  - 2025-06-03T12:21:00 | IBKR | Interactive Brokers Reports Y/Y Increase in May Client DARTs | score=72.25 | tag=sustained_repricing
  - 2025-06-03T07:00:00 | USAS | Americas Gold and Silver Announces Transformational US$100 Million Debt Financing and Secures Multi-Metal Offtake Agreement for Galena Concentrates | score=45.31 | tag=multi_window_impact

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

### 약가 정책·CMS 모델 (`drug_pricing_policy`)
- 상위 분류: `short`
- 한 줄 정의: Drug pricing order, Medicare model, IRA drug pricing.
- 핵심 가치 경로: 약가 압박→바이오 마진
- 포함 신호: drug pric, cms.*model, medicare.*drug, ira.*drug pricing
- 제외 신호: 
- 빠른 판별 질문: 약가 정책?
- 집계: total=44, impacted=8, max impact=27.92
- 대표 예시:
  - 2025-05-12T12:46:17 | UNH | Trump's drug pricing order delivers blow to pharmacy benefit managers | score=27.92 | tag=multi_window_impact
  - 2026-02-27T06:36:50 | PSKY | The Week in Numbers: 94% sales hike, multibillion-dollar deals | score=24.67 | tag=multi_window_impact

### SPAC 합병·디스팩 (`spac_merger_event`)
- 상위 분류: `long`
- 한 줄 정의: SPAC merger, de-SPAC, business combination vote.
- 핵심 가치 경로: 상장 경로→재평가
- 포함 신호: spac.*merger, de-spac, business combination
- 제외 신호: 
- 빠른 판별 질문: SPAC 합병?
- 집계: total=40, impacted=3, max impact=50.58
- 대표 예시:
  - 2025-12-15T10:39:00 | UUUU | Cavalry Capital Corp. Announces Conditional TSXV Acceptance and Filing of Filing Statement for Qualifying Transaction | score=50.58 | tag=sustained_repricing
  - 2025-04-24T18:14:46 | MSTR | Another Bitcoin Treasury Is Coming To Wall Street | score=19.86 | tag=sustained_repricing

### REIT·부동산 자산 이벤트 (`reit_property_event`)
- 상위 분류: `residual`
- 한 줄 정의: REIT acquisition, property deal.
- 핵심 가치 경로: 부동산 자산→임대수익
- 포함 신호: reit.*acqui, property.*deal, reit.*merger
- 제외 신호: 
- 빠른 판별 질문: REIT 이벤트?
- 집계: total=37, impacted=2, max impact=34.99
- 대표 예시:
  - 2025-09-03T08:05:00 | M | Macy’s Raises Full-Year View as Same-Store Sales Return to Growth | score=34.99 | tag=multi_window_impact
  - 2025-03-06T10:01:47 | BBY | Macy's misses the mark on sales growth and warns on profits as its challenges grow with tariffs | score=18.93 | tag=sustained_repricing

### 반도체 디자인윈 (`semiconductor_design_win`)
- 상위 분류: `long`
- 한 줄 정의: Chip design win, GPU selection, SoC qualification.
- 핵심 가치 경로: 디자인윈→장기 매출
- 포함 신호: design win, selected.*chip, qualified.*soc, automotive.*qualified, aec-plus
- 제외 신호: 
- 빠른 판별 질문: 반도체 디자인윈?
- 집계: total=36, impacted=8, max impact=195.12
- 대표 예시:
  - 2025-05-05T08:30:00 | NVTS | Navitas Redefines Reliability with Industry’s First Automotive ‘AEC-Plus’ Qualified SiC MOSFETs in HV-T2Pak Top-Side Cooled Package | score=195.12 | tag=sustained_repricing
  - 2025-04-02T11:00:00 | VSH | Vishay Intertechnology Releases AEC-Q100 Qualified RGBIR Color Sensor in Compact 2.67 mm x 2.45 mm x 0.6 mm Package | score=30.26 | tag=multi_window_impact

### 자비적 사용·확대접근 프로그램 (`biotech_compassionate_access`)
- 상위 분류: `long`
- 한 줄 정의: Expanded access, compassionate use.
- 핵심 가치 경로: 환자 접근→상업화 전 매출
- 포함 신호: expanded access, compassionate use, named patient
- 제외 신호: 
- 빠른 판별 질문: 확대접근?
- 집계: total=35, impacted=5, max impact=29.32
- 대표 예시:
  - 2025-06-02T09:00:00 | IBRX | ImmunityBio Receives FDA Expanded Access Authorization for Landmark Treatment of Lymphopenia With ANKTIVA®, the Cancer BioShield™ Platform, in Patients With Solid Tumors | score=29.32 | tag=sustained_repricing
  - 2025-06-02T06:20:41 | IBRX | Immunitybio, Inc. Receives Fda Expanded Access Authorization for Landmark Treatment of Lymphopenia with Anktiva, the Cancer Bioshield? Platform, in Patients with Solid Tumors | score=29.32 | tag=sustained_repricing

### 잡것들_Fintel 가격 목표 필러 (`잡것들_fintel_price_target_filler`)
- 상위 분류: `residual`
- 한 줄 정의: Fintel Price Target Increased/Decreased 자동 게시물.
- 핵심 가치 경로: 자동화 필러
- 포함 신호: price target increased by.*%.*to, price target decreased by.*%.*to
- 제외 신호: 
- 빠른 판별 질문: Fintel 필러?
- 집계: total=30, impacted=5, max impact=36.54
- 대표 예시:
  - 2025-05-16T10:15:10 | IBTA | Ibotta price target raised to $57 from $48 at BofA | score=36.54 | tag=sustained_repricing
  - 2025-07-07T18:00:00 | PLTR | 2 Hot AI Stocks to Sell Before They Fall 25%, According to Wall Street Analysts | score=33.63 | tag=sustained_repricing

### 우주·방산 발사 계약 (`space_defense_launch_contract`)
- 상위 분류: `long`
- 한 줄 정의: Rocket launch contract, hypersonic, defense satellite.
- 핵심 가치 경로: 방산/우주 backlog
- 포함 신호: launch contract, hypersonic.*launch, haste.*launch, defense.*satellite, neutron.*progress
- 제외 신호: 
- 빠른 판별 질문: 우주/방산 발사?
- 집계: total=29, impacted=10, max impact=94.43
- 대표 예시:
  - 2025-06-13T11:40:30 | RKLB | Mixed options sentiment in Rocket Lab USA with shares down 2.12% | score=94.43 | tag=sustained_repricing
  - 2025-12-19T12:18:51 | RKLB | Rocket Lab shares are trading higher after the company announced it secured a $816 million prime contract to build a missile-defense satellite for the US Space Force. | score=48.36 | tag=multi_window_impact

### 광산 탐사·발견 (`mining_exploration_discovery`)
- 상위 분류: `long`
- 한 줄 정의: Drill results, high-grade discovery, vein extension.
- 핵심 가치 경로: 탐사 성과→자원 가치 상향
- 포함 신호: high-grade, vein extension, airborne survey, drill.*intersect, g/t silver, magnetic anomaly
- 제외 신호: 
- 빠른 판별 질문: 탐사 발견?
- 집계: total=28, impacted=9, max impact=246.67
- 대표 예시:
  - 2025-08-22T06:30:00 | USAS | Americas Gold and Silver Reports High-Grade 149 Vein Extension Including 24,913 g/t Silver and 16.9% Copper at Galena Complex and Effective Date of Share Consolidation | score=246.67 | tag=multi_window_impact
  - 2025-10-02T08:00:00 | CRML | Quantum Completes Second Airborne Survey at NMX East Project in Qubec - Initial Airborne Survey Confirms Magnetic Anomaly Similar to Nisk Deposit | score=173.91 | tag=multi_window_impact

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

### peer 호조 read-through (`peer_readthrough_positive`)
- 상위 분류: `long`
- 한 줄 정의: peer strong earnings, sector leader validation.
- 핵심 가치 경로: peer 검증→동종 re-rating
- 포함 신호: read-through, peer strength, sector leader, peer demand
- 제외 신호: same company earnings
- 빠른 판별 질문: 타사 호조 전이?
- 집계: total=27, impacted=6, max impact=264.36
- 대표 예시:
  - 2025-05-01T13:59:12 | CRWV | Why CoreWeave Stock Is Skyrocketing Today | score=264.36 | tag=multi_window_impact
  - 2025-11-26T08:41:07 | VOR | Vor Bio assumed with a Neutral at Wedbush | score=57.41 | tag=sustained_repricing

### 바이오 약물 상업화·매출 성장 (`biotech_drug_commercialization`)
- 상위 분류: `long`
- 한 줄 정의: Drug sales milestone, commercial traction.
- 핵심 가치 경로: 상업화 진전→매출
- 포함 신호: drug sales, commercial traction, prescription growth
- 제외 신호: 
- 빠른 판별 질문: 약물 상업화?
- 집계: total=25, impacted=6, max impact=120.85
- 대표 예시:
  - 2025-09-16T10:48:00 | QBTS | QUBT Gains Commercial Traction With Quantum AI and Cybersecurity Deals (Revised) | score=120.85 | tag=multi_window_impact
  - 2025-09-10T10:37:00 | QBTS | QUBT Gains Commercial Traction With Quantum AI and Cybersecurity Deals | score=104.46 | tag=sustained_repricing

### 워런트 행사·전환 (`warrant_exercise_conversion`)
- 상위 분류: `residual`
- 한 줄 정의: Warrant exercise, note conversion, cashless exercise.
- 핵심 가치 경로: 희석/자본 변화
- 포함 신호: warrant.*exercise, note conversion
- 제외 신호: 
- 빠른 판별 질문: 워런트/전환?
- 집계: total=24, impacted=6, max impact=52.46
- 대표 예시:
  - 2025-09-04T08:29:37 | INTC | Sen. Warren in a letter to Sec. Lutnick: Trump’s Intel deal fails taxpayers | score=52.46 | tag=sustained_repricing
  - 2025-03-13T18:00:00 | OPAL | OPAL Fuels Reports Fourth Quarter and Full Year 2024 Results | score=44.44 | tag=sustained_repricing

### 바이오 파이프라인 인수·라이선스인 (`biotech_pipeline_acquisition`)
- 상위 분류: `long`
- 한 줄 정의: License-in deal, pipeline acquisition, milestone deal.
- 핵심 가치 경로: 파이프라인 확장→portfolio value
- 포함 신호: license.*rights, milestone.*deal, pipeline.*acquisition, \$.*billion.*deal.*pharma
- 제외 신호: 
- 빠른 판별 질문: 파이프라인 인수/라이선스?
- 집계: total=23, impacted=5, max impact=660.77
- 대표 예시:
  - 2025-06-25T12:46:21 | VOR | Vor Bio Licenses Ex-Greater China Rights To Telitacicept From RemeGen In $125M Deal With Milestones Over $4B; Appoints Jean-Paul Kress As CEO And Chairman | score=660.77 | tag=multi_window_impact
  - 2025-05-08T06:30:00 | ESPR | HLS Therapeutics partners with Esperion Therapeutics to commercialize NEXLETOL® and NEXLIZET® in Canada | score=40.09 | tag=sustained_repricing

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

### CIM·뉴로모픽 컴퓨팅 (`compute_in_memory_chip`)
- 상위 분류: `long`
- 한 줄 정의: Compute-in-memory, neuromorphic, APU AI.
- 핵심 가치 경로: 차세대 컴퓨팅→시장 형성
- 포함 신호: compute-in-memory, neuromorphic, apu.*ai
- 제외 신호: 
- 빠른 판별 질문: CIM/뉴로모픽?
- 집계: total=21, impacted=7, max impact=155.31
- 대표 예시:
  - 2025-10-20T09:00:00 | GSIT | Compute-In-Memory APU Achieves GPU-Class AI Performance at a Fraction of the Energy Cost | score=155.31 | tag=multi_window_impact
  - 2025-10-20T07:06:35 | GSIT | GSI Technology shares are trading higher after the company announced research showing its APU Compute-In-Memory architecture can match GPU-level performance for large-scale AI applications while reducing energy consumption. | score=155.31 | tag=multi_window_impact

### 바이오 프로그램 중단 (`biotech_program_discontinuation`)
- 상위 분류: `short`
- 한 줄 정의: Halts development, discontinues program.
- 핵심 가치 경로: 자산 가치 상실
- 포함 신호: halts development, discontinues, suspends.*program, deprioritiz
- 제외 신호: 
- 빠른 판별 질문: 개발 중단?
- 집계: total=19, impacted=4, max impact=65.23
- 대표 예시:
  - 2025-02-18T04:10:33 | SEPN | Septerna Discontinues Phase 1 Trial Of SEP-786 Due To Severe Bilirubin Events, Plans To Select New PTH1R Agonist Candidate For Hypoparathyroidism Program | score=65.23 | tag=multi_window_impact
  - 2025-03-07T12:45:00 | NMRA | JNJ Halts Development of Depression Drug Over Efficacy Concerns | score=52.39 | tag=sustained_repricing

### 신규 자사주 매입 프로그램 (`share_repurchase_program_new`)
- 상위 분류: `long`
- 한 줄 정의: New buyback program authorization.
- 핵심 가치 경로: 주주환원 의지→수급 지지
- 포함 신호: repurchase program, share reprchase, new buyback
- 제외 신호: 
- 빠른 판별 질문: 신규 자사주 프로그램?
- 집계: total=16, impacted=0, max impact=24.61
- 대표 예시:
  - 2025-09-17T12:33:10 | ARVN | Arvinas Says Additional Cost Optimization Measures Expected To Realize Total Annual Savings Of More Than $100M Compared To FY24; Board Authorizes $100M Stock Repurchase | score=24.61 | tag=low_signal
  - 2025-08-18T02:56:01 | RSKD | Riskified Board Authorizes Repurchase Of Up To $75M Of Its Class A Ordinary Shares | score=17.30 | tag=low_signal

### 시장 영향 뉴스 다이제스트 (`market_moving_news_digest`)
- 상위 분류: `residual`
- 한 줄 정의: Market-Moving News for [Date].
- 핵심 가치 경로: 뉴스 다이제스트
- 포함 신호: market-moving news for, market moving news
- 제외 신호: 
- 빠른 판별 질문: 시장 뉴스 다이제스트?
- 집계: total=15, impacted=11, max impact=156.35
- 대표 예시:
  - 2025-09-24T03:17:32 | LAC | Market-Moving News for September 24th | score=156.35 | tag=multi_window_impact
  - 2025-12-08T03:34:25 | KYMR | Market-Moving News for December 8th | score=41.55 | tag=multi_window_impact

### 잡것들_섹터별 실적 시즌 회고 (`잡것들_sector_earnings_recap`)
- 상위 분류: `residual`
- 한 줄 정의: Q4 Recap Benchmarking X vs peers, sector recap.
- 핵심 가치 경로: 섹터 회고
- 포함 신호: stocks q[1-4] recap, benchmarking.*vs.*rest, q[1-4].*best and worst, recap.*benchmarking
- 제외 신호: 
- 빠른 판별 질문: 섹터 회고?
- 집계: total=15, impacted=4, max impact=57.19
- 대표 예시:
  - 2025-09-24T07:27:06 | AMD | Are AMD Shares Still Worth the Price After Fresh China Trade Probe? | score=57.19 | tag=sustained_repricing
  - 2025-06-10T09:15:31 | FTV | Fortive price target raised to $79 from $78 at RBC Capital | score=28.72 | tag=sustained_repricing

### 헬륨·특수가스 이벤트 (`helium_specialty_gas_event`)
- 상위 분류: `long`
- 한 줄 정의: Helium recovery, specialty gas, CO2 capture.
- 핵심 가치 경로: 특수가스→희소 자원
- 포함 신호: helium.*recovery, helium.*production, specialty gas, co2 capture
- 제외 신호: 
- 빠른 판별 질문: 헬륨/특수가스?
- 집계: total=10, impacted=0, max impact=14.88
- 대표 예시:
  - 2025-11-06T08:00:00 | ESI | EFC Gases & Advanced Materials Announces Agreement to Join Element Solutions Inc. | score=14.88 | tag=low_signal
  - 2025-11-06T04:23:26 | ESI | EFC Gases & Advanced Materials Announces It Will Acquired By Element Solutions Under A Definitive Agreement; Financial Terms Not Disclosed | score=14.88 | tag=low_signal

### 본사 이전·법인 전환 (`domestication_reincorporation`)
- 상위 분류: `residual`
- 한 줄 정의: Domestication from Cayman to Delaware, reincorporation.
- 핵심 가치 경로: 거버넌스 변화
- 포함 신호: domestication, reincorporation, cayman.*delaware
- 제외 신호: 
- 빠른 판별 질문: 법인 전환?
- 집계: total=9, impacted=4, max impact=632.98
- 대표 예시:
  - 2025-07-01T12:43:00 | PROK | ProKidney Corp. Completes Domestication from the Cayman Islands to Delaware | score=632.98 | tag=sustained_repricing
  - 2025-04-14T06:11:11 | TSLA | Reincorporating A Delaware Entity Elsewhere: Could This Be The Next Great DExodus? | score=35.87 | tag=sustained_repricing

### 광산 정부 지원·도로 건설 (`mining_government_support`)
- 상위 분류: `long`
- 한 줄 정의: Government road access, mining district support.
- 핵심 가치 경로: 정부 지원→개발 가속
- 포함 신호: ambler road, mining district, government.*mining, dod.*delivery order
- 제외 신호: 
- 빠른 판별 질문: 정부 광산 지원?
- 집계: total=5, impacted=5, max impact=407.18
- 대표 예시:
  - 2025-10-07T03:04:33 | TMQ | Trump Reverses Biden-Era Decision, Reopens Path To Alaska's 'Economic Gold Mine' | score=407.18 | tag=multi_window_impact
  - 2025-10-06T22:44:39 | TMQ | Reported Earlier, Trilogy Metals Supports Trump Administration's Greenlight For Ambler Road, Unlocking One Of America's Richest Copper-Dominant Mining Districts | score=215.38 | tag=multi_window_impact

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

- v6 taxonomy는 의미없는 정보 계열을 `잡것들_*`로 명시하고, 진짜 미분류 row는 `unknown`으로 남긴다.
- `unknown`은 다음 tranche에서 새 case로 승격할 후보를 모으는 버킷이다.