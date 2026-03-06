# Indicator calculators (deep_learning_data) (skill)

### 언제 쓰나
- `deep_learning_data/indicator_calculator/` 아래 스크립트를 구현/수정할 때.
- pandas DataFrame에 지표/피처를 “컬럼 append” 방식으로 붙일 때(행 drop 금지, 초반 warmup은 `NaN` 가능).
- 큰 입력에서 로깅/에러 가시성(`logger.exception`)과 주기적 진행 출력 규칙을 통일해야 할 때.

- **Indicator calculators (deep_learning_data)**
  - pandas DataFrame에 컬럼을 추가하는 방식이며, row를 drop하지 않습니다(초반 구간은 히스토리 부족으로 `NaN` 가능).
  - 로깅 패턴: 파일 로거 + `logger.handlers` 가드(중복 핸들러 방지).
    - 출력 디렉토리가 있으면 log 파일도 그 디렉토리에 두는 것을 기본으로.
    - 출력 디렉토리 맥락이 없으면 스크립트 옆에 `.log`.
    - `log_errors=True`일 때 예외는 `logger.exception(...)`으로 기록 후 재-raise.
    - 성공 시 `SUCCESS: wrote <paths>` 같은 최종 로그 라인을 남김.
  - 큰 입력/루프는 `progress_every` 같은 노브를 제공해 주기적으로 진행 상황을 출력.
  - 일부 스크립트는 CLI 제공 + repo root 기준 상대 경로로 출력.
