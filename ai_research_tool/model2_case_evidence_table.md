# Model 2 Case Evidence Table

이 파일은 `Model_2_case analysis`에서 유형 분류의 근거가 된 뉴스들을 행 단위로 기록하는 표다.

기본 운영 규칙:

- source 범위: `press_release only`
- market cap bucket:
  - `300M~<1B`
  - `1B~<100B`
  - `100B~`
  - `<300M or Unknown` (보조 집단)
- reaction tag:
  - `intraday_only`
  - `delayed_followthrough`
  - `sustained_repricing`
  - `one_day_spike_then_fade`
  - `multi_window_impact`

필수 표 컬럼:

| case_type | reaction_tag | news_id | published_at | ticker | market_cap | market_cap_bucket | title |
|-----------|--------------|---------|--------------|--------|------------|-------------------|-------|

권장 확장 표 컬럼:

| case_type | reaction_tag | news_id | published_at | source_type | ticker | market_cap | market_cap_bucket | change_pct | change_1d_pct | change_3d_pct | change_7d_pct | change_14d_pct | change_30d_pct | overall_impact_score | title |
|-----------|--------------|---------|--------------|-------------|--------|------------|-------------------|------------|---------------|---------------|---------------|----------------|----------------|----------------------|-------|

작성 원칙:

- 각 행은 “이 뉴스가 특정 case 유형의 근거로 실제 사용되었다”는 의미다.
- 같은 뉴스가 여러 case 후보 검토에 등장했다면, 최종 채택된 case_type만 남긴다.
- 같은 ticker의 중복 기사/재전송 PR이 많으면 필요시 dedupe 여부를 별도 메모로 남긴다.
- `market_cap`은 가능한 최신 `company_profiles.market_cap` 기준으로 적고, 없으면 `Unknown`으로 둔다.
