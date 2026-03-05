# Indicator calculators (deep_learning_data) (skill)

## EN

### When to use
- When implementing or updating scripts under `deep_learning_data/indicator_calculator/`.
- When adding features/indicators by appending columns to a pandas DataFrame (no row drops; warmup rows may be `NaN`).
- When you need consistent logging, error visibility (`logger.exception`), and periodic progress reporting for large inputs.

- **Indicator calculators (deep_learning_data)**
  - Functions operate on pandas DataFrames and append columns without dropping rows; early rows become `NaN` when history is insufficient (see `compute_indicators()` in `deep_learning_data/indicator_calculator/stock2_indicator_calculator.py`).
  - Logging pattern: file-based logger and a `logger.handlers` guard to avoid duplicate handlers.
    - If a script creates output files under an output directory, default the log file to that same directory (e.g., `out_dir / f"{Path(__file__).stem}.log"`).
    - If there is no output directory context, fall back to a module-adjacent log (`Path(__file__).with_suffix('.log')`).
    - When `log_errors=True`, any exception must be recorded with `logger.exception(...)` and then re-raised (so failures are visible both in console and in the log).
    - On success, write a final log line like `SUCCESS: wrote <paths>` (include output directory and key filenames).
  - Progress visibility:
    - For large inputs / loops, expose a `progress_every`-style knob (or similar) and emit periodic progress messages (to console and/or logger) rather than running silently.
  - Some scripts provide a CLI and write outputs relative to repo root using `Path(__file__).resolve().parents[2]` (see `_default_output_dir()` in `deep_learning_data/indicator_calculator/option1_1min_time_to_expiration_cumulative_volume_pc_ratio.py`).
  - CLI example (option features by year):
    - `python deep_learning_data\indicator_calculator\option1_1min_time_to_expiration_cumulative_volume_pc_ratio.py --input <file-or-dir> --symbol QQQ --overwrite`

---

## KO

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
