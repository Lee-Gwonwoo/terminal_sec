# Momentum — Wrapper + base pattern (skill)

### 언제 쓰나
- `momentum/` 아래에서 wrapper/base 구조를 따르는 스크립트를 만들거나 수정할 때.
- 코어 로직(base)과 설정/경로(wrapper)를 분리하는 리팩터링을 할 때.
- 출력(raw CSV, 선택적 Parquet, 안전한 Excel 저장)과 진행/상태 로그를 표준화할 때.

- **Wrapper + base 패턴 (momentum)**
  - Base 모듈은 `Config` + `run_analysis` 형태로 코어 로직을 제공합니다.
  - Wrapper는 base를 import하고 상수/경로 설정 + `main()` 정도만 둡니다.
  - 출력 규칙:
    - “raw” CSV는 항상 쓰고, Parquet는 가능하면 쓰되(`pyarrow/fastparquet` 없으면 graceful skip).
    - Excel은 임시 파일에 쓴 뒤 `os.replace`로 교체(부분 파일로 깨지는 것 방지).
  - 진행/상태 출력:
    - 오래 걸리는 작업은 콘솔에 진행 상황을 출력합니다.
    - 성공 시 주요 출력 경로를 포함한 성공 메시지를 출력합니다.
