# Model 2 company_news issue analysis (2025+)

## 분석 범위

- analysis_id: `6ec343f2-d7be-43e1-9297-90e5c35643ea`
- source_type: `company_news`
- source_name: `FINNHUB`
- 기간: `2025-01-01 ~ 2026-03-26`
- 전체 분류 row: 599,681
- impact 계산 가능 row: 527,876
- impact 판정 row: 105,608
- `잡것들` row: 448,556
- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.

## 분류 원칙

- 이 분류는 `company news`에서 자주 반복되는 "왜 올랐는지 / 왜 내렸는지" 설명 패턴을 기준으로 만든 rule-based taxonomy다.
- 실적, 애널리스트 리포트, 계약/제휴, 승인/임상, 자금조달, 소송/조사, 구조조정, M&A, 매크로 read-through를 우선 분리했다.
- 제목/요약에 근거 패턴이 거의 없거나 listicle/commentary 성격이 강한 row는 `잡것들`로 묶었다.
- 가격 영향은 분류 기준이 아니라 evidence 우선순위와 reaction tag 계산에만 사용했다.

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
| residual | 잡것들 | 448,556 | 78,094 | 3646.27 |
| long | 애널리스트 상향·목표가 상향 | 36,670 | 6,101 | 976.58 |
| residual | 매크로·섹터 read-through | 30,000 | 5,841 | 1117.17 |
| long | 제품·서비스 성장 기대 | 19,606 | 3,224 | 953.52 |
| long | 대형 계약·제휴·수주 | 15,198 | 2,729 | 1044.21 |
| long | M&A·전략가치 재평가 | 14,351 | 2,233 | 486.06 |
| long | 실적 호조·가이던스 상향 | 11,090 | 2,236 | 1114.55 |
| short | 소송·조사·회계 리스크 | 7,521 | 1,737 | 795.85 |
| short | 애널리스트 하향·목표가 하향 | 7,042 | 1,334 | 1073.67 |
| short | 희석성 자금조달 | 4,268 | 1,054 | 675.10 |
| short | 구조조정·생존성 악화 | 2,287 | 365 | 187.55 |
| long | 승인·임상 호재 | 1,385 | 292 | 648.56 |
| short | 실적 부진·가이던스 하향 | 1,334 | 270 | 787.41 |
| short | 규제·임상 악재 | 373 | 98 | 371.07 |

## 해석

- `잡것들` 비중이 높다는 것은 company_news 원천에 listicle, generic commentary, broad watchlist-style 기사 비중이 높다는 뜻이다.
- 실적/애널리스트/자금조달/구조조정은 비교적 직접적인 원인 기사라 case 분리가 안정적이다.
- `macro_sector_readthrough`는 개별 기업 이벤트가 약하고 섹터/정책/시장 설명이 중심인 기사다.
- 더 정교한 분류가 필요하면 다음 단계에서 case별 false positive를 보고 규칙을 세분화하면 된다.