# Deep learning trainers (skill)

### 언제 쓰나
- 딥러닝 학습/라벨링 파이프라인(특히 multi-head / multi-case trainer)을 만들거나 리팩터링할 때.
- 비용이 큰 공통 중간 결과를 dedup해서 중복 계산을 없애야 할 때.
- `active_cases` 같은 프리셋 선택, 하위호환, 문서 설명 규칙을 함께 정리해야 할 때.

- **딥러닝 트레이너(dedup + 프리셋 + 문서 설명)**
  - **공통 중간 결과 dedup(필수):** 멀티 head / 멀티 case trainer에서는 비용 큰 공통 중간 결과를 먼저 1회 계산하고 여러 head가 재사용하도록 구성합니다.
    - 예시: 주식 `close/high/low` 배열 + horizon별 `r_end/r_max/r_min`; 옵션 `options_groups`(스냅샷 인덱스); (i,h,delta,right) 계약 선택 + horizon 종료 가격 매칭 + profit%.
    - `label_targets` hit 판정 같은 의미 루프는 명시적으로 유지하되, 그 안에서 group/pick/match 같은 비싼 작업을 반복하지 않습니다.
  - **“중복계산/계산낭비” 정의(중요):** **입력 + config/옵션/플래그(랜덤 시드 포함)** 조건이 동일할 때 **결과가 동일한데도** 같은 계산을 반복하는 경우만 중복/낭비로 봅니다. 계산을 바꾸면 결과가 달라지는 경우는 중복/낭비가 아니라 “동작 변경”이므로 별도로 취급합니다.
  - **case preset / multi-case 설계:** `active_cases` 같은 multi-select 프리셋을 지원할 때:
    - `enable_*` 플래그 merge 규칙을 명확히 둡니다(보통 OR).
    - 충돌 가능성이 큰 공통 파라미터(`label_horizons`, `label_deltas`, `label_targets`)는 case 내부가 아니라 루트 VALUES에 둡니다.
    - 주식+옵션 라벨을 같이 켤 수 있다면 혼합 모드(예: `Model_SO`)를 명시적으로 지원하거나, 아니면 명확한 에러로 즉시 차단합니다.
    - 하위호환 규칙(`active_cases`가 없거나 비어 있으면 legacy `active_case`)을 코드/문서에 함께 명시합니다.
  - **문서 설명 규칙:** 관련 `*.md`는 한국어 기준으로 유지하고, “중복 제거 vs 반복”을 구분해 설명합니다.
  - **리팩터링 후 정리(레거시 격리):** 리팩터링으로 기존 경로가 더 이상 사용되지 않으면 삭제하거나, `LEGACY/UNUSED` 섹션으로 격리하고 간단한 이유를 적습니다.
