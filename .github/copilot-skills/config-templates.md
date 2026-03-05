# Config template files (TOML/INI/YAML) (skill)

## EN

### When to use
- When creating or editing config templates used to run scripts from the terminal.
- When you need to enforce the `VALUES` vs `EXPLANATIONS` split and keep the template machine-parseable (especially for TOML).
- When you need bilingual `EXPLANATIONS` blocks (EN then `---` then KO) and a minimal runnable example.

- **Config template files (TOML/INI/YAML) (important)**
  - When creating or updating a *config template file* for running a script from the terminal, split it into two clearly labeled sections:
    - `VALUES`: key/value settings only (equivalent to CLI options/flags).
    - `EXPLANATIONS`: all human-readable documentation (no duplicate settings).
  - **Put required items first (must):** at the very top of `EXPLANATIONS` (inside each language block), add a short “REQUIRED checklist” that includes:
    - required CLI options/flags to run (e.g., `--config <path>`),
    - which `VALUES` keys must be filled (and whether they are REQUIRED vs CONDITIONALLY REQUIRED),
    - one minimal runnable CLI example.
  - **Empty-string placeholders policy:** if the template contains empty strings like `foo = ""`, `EXPLANATIONS` must explicitly say:
    - whether the user must fill it,
    - when it is required (e.g., “only when option labels enabled”),
    - at least one concrete example value.
  - **Companion config docs (when behavior is non-trivial):** if a config has merge rules, precedence rules, or complex I/O semantics, keep a companion Markdown next to it:
    - Prefer same-basename: `something_config.toml` ↔ `something_config.md`
    - TOML `EXPLANATIONS`: concise (quick-start + required checklist)
    - MD: more detailed and implementation-accurate, and kept in sync when config behavior changes.
  - **TOML validity guardrail (must):** config templates must remain valid TOML.
    - In `.toml` files, every line in `EXPLANATIONS` must be a comment line starting with `#` (or be removed/moved to a separate `.md`).
    - After writing/editing a `.toml` config template, run a quick parse sanity-check (preferred):
      - `python -c "import tomllib, pathlib; tomllib.loads(pathlib.Path('path/to/config.toml').read_text(encoding='utf-8'))"`
      - If Python < 3.11, use `tomli`.
  - The `EXPLANATIONS` section must be bilingual *(Override: Claude agents write Korean only — see Agent-specific language override)*:
    - English first, then a separator line `---`, then Korean.
    - Keep the two language blocks strictly separated and content-matched (same headings, same options, same defaults).
  - Terminology: prefer “CLI options/flags (command-line options)” rather than “arguments” unless you specifically mean positional arguments.

---

## KO

### 언제 쓰나
- 터미널에서 스크립트를 실행하기 위한 설정 템플릿 파일을 새로 만들거나 수정할 때.
- `VALUES` / `EXPLANATIONS` 분리를 강제하고(특히 TOML) 템플릿이 파서로 읽힐 수 있게 유지해야 할 때.
- `EXPLANATIONS` 한/영 병기(EN → `---` → KO)와 최소 실행 예시를 포함해야 할 때.

- **설정 템플릿 파일(TOML/INI/YAML) 규칙(중요)**
  - 터미널에서 스크립트를 실행하기 위한 *설정 템플릿 파일*을 만들거나 수정할 때는, 반드시 두 구간으로 분리해서 작성합니다:
    - `VALUES`: key/value 설정 값만(= CLI 옵션/플래그에 해당하는 값).
    - `EXPLANATIONS`: 사람이 읽는 설명/문서만(설정값 중복 금지).
  - **필수 항목을 위로(필수):** `EXPLANATIONS`의 맨 위(각 언어 블록의 시작)에 짧은 “필수 체크리스트”를 두고 아래를 포함합니다:
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
  - `EXPLANATIONS` 구간은 한/영 2개 블록으로 작성합니다 *(오버라이드: Claude는 한국어 단독 — 에이전트별 언어 오버라이드 참고)*:
    - 영어를 먼저 쓰고, 구분선 `---` 뒤에 한국어를 씁니다.
    - 두 언어 블록은 섞지 말고, 내용은 반드시 동일하게 맞춥니다(제목/옵션/기본값/예시 커맨드 동일).
  - 용어: “인자(arguments)”보다는 “CLI 옵션/플래그(커맨드라인 옵션)” 표현을 우선 사용합니다(특히 `--epochs` 같은 형태).
