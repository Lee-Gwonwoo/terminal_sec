# Config template files (TOML/INI/YAML) (skill)

### 언제 쓰나
- 터미널에서 스크립트를 실행하기 위한 설정 템플릿 파일을 새로 만들거나 수정할 때.
- `VALUES` / `EXPLANATIONS` 분리를 강제하고(특히 TOML) 템플릿이 파서로 읽힐 수 있게 유지해야 할 때.
- `EXPLANATIONS` 설명과 최소 실행 예시를 포함해야 할 때.

- **설정 템플릿 파일(TOML/INI/YAML) 규칙(중요)**
  - 터미널에서 스크립트를 실행하기 위한 *설정 템플릿 파일*을 만들거나 수정할 때는, 반드시 두 구간으로 분리해서 작성합니다:
    - `VALUES`: key/value 설정 값만(= CLI 옵션/플래그에 해당하는 값).
    - `EXPLANATIONS`: 사람이 읽는 설명/문서만(설정값 중복 금지).
  - **필수 항목을 위로(필수):** `EXPLANATIONS`의 맨 위에 짧은 “필수 체크리스트”를 두고 아래를 포함합니다:
    - 실행에 필요한 필수 CLI 옵션/플래그(예: `--config <path>`)
    - `VALUES`에서 반드시 채워야 하는 key들( REQUIRED / CONDITIONALLY REQUIRED 구분 포함 )
    - 최소 실행 가능한 CLI 예시 1개
  - **빈 문자열 placeholder("") 규칙:** 템플릿에 `foo = ""` 같은 빈 값이 있으면 `EXPLANATIONS`에서 반드시:
    - 사용자가 채워야 하는지 여부,
    - 언제 필수인지(예: “옵션 라벨 활성화일 때만”),
    - 구체 예시 값(최소 1개)
    를 명시합니다.
  - **config 동반 문서(동작이 복잡할 때):** merge/우선순위/입출력 의미가 복잡한 config는 같은 폴더에 동반 Markdown을 둡니다:
    - 가능하면 같은 base name 사용: `something_config.toml` ↔ `something_config.md`
    - TOML `EXPLANATIONS`: 간단(빠른 실행 + 필수 체크리스트)
    - MD: 더 자세하고 코드 구현과 1:1로 맞게 작성하며, config 동작 변경 시 함께 업데이트
  - **TOML 문법 안전장치(필수):** 설정 템플릿은 반드시 “유효한 TOML”이어야 합니다.
    - `.toml` 파일에서 `EXPLANATIONS` 구간의 모든 라인은 반드시 `#`로 시작하는 주석이어야 합니다(아니면 삭제하거나 별도 `.md`로 옮기기).
    - `.toml` 설정 템플릿을 만들/수정한 직후에는 간단히 파싱 확인을 수행합니다(권장):
      - `python -c "import tomllib, pathlib; tomllib.loads(pathlib.Path('path/to/config.toml').read_text(encoding='utf-8'))"`
      - Python 3.11 미만이면 `tomli` 사용.
  - `EXPLANATIONS` 구간은 **한국어 중심**으로 작성합니다:
    - CLI, config, path, log 같은 일반적인 영어 용어는 억지로 번역하지 않아도 됩니다.
    - 같은 내용을 영어/한국어 2중으로 반복하지 않습니다.
  - 용어: “인자(arguments)”보다는 “CLI 옵션/플래그(커맨드라인 옵션)” 표현을 우선 사용합니다(특히 `--epochs` 같은 형태).
