# Repository context (optional)

## EN

### What this is
This document contains repository-specific context (overview, folder structure, data flow, and “how to run”).

### Why it is separated
`copilot-instructions.md` may be copied into other repositories. Repo-specific assumptions tend to become incorrect when copied, so repo context lives here as an **optional, replaceable** companion document.

### When to use
- When you need quick orientation before making changes (what the repo is, where code lives, how to run).
- When a task depends on the repo’s actual topology (frontend/backend split, data directories, build tooling).

### Maintenance rule
- If this repo changes meaningfully (new app entrypoint, new data flow, new run commands), update this file.
- If `copilot-instructions.md` is copied to another repository, either delete this file or rewrite it to match the new repo.

### Current repo notes (terminal_sec)
This workspace appears to be a mixed-codebase repo that includes:
- A Node/TypeScript “terminal” application under `terminal/` (with dev/build/test scripts).
- A Python-heavy research/data pipeline area (e.g., `EODHD/`, `original_data/`, `deep_learning_data/`) used by script-first workflows.

Use the task/target directory to decide which conventions apply (Node app vs Python scripts).

---

## KO

### 이 문서의 목적
이 문서는 레포에 종속적인 컨텍스트(개요, 폴더 구조, 데이터 흐름, 실행 방법)를 담습니다.

### 왜 분리했나
`copilot-instructions.md`는 다른 레포로 복사되어 재사용될 수 있습니다. 이때 레포 종속 가정(구조/실행/데이터 흐름)은 쉽게 틀어져 오히려 방해가 되므로, 레포 컨텍스트는 여기처럼 **옵션 + 교체 가능** 문서로 분리합니다.

### 언제 쓰나
- 변경 작업 전에 레포 구조를 빠르게 파악해야 할 때(어디에 코드가 있고, 무엇을 어떻게 실행하는지).
- 작업이 레포 토폴로지(프론트/백 분리, 데이터 디렉토리, 빌드 툴링)에 직접 의존할 때.

### 유지보수 규칙
- 레포가 의미 있게 바뀌면(엔트리포인트/데이터 흐름/실행 커맨드 변경) 이 파일을 업데이트합니다.
- `copilot-instructions.md`를 다른 레포로 복사할 때는 이 파일을 삭제하거나, 새 레포에 맞게 내용을 다시 작성하세요.

### 현재 레포(terminal_sec) 메모
이 workspace는 다음이 함께 있는 혼합 레포로 보입니다:
- `terminal/` 아래 Node/TypeScript 기반의 “terminal” 앱(dev/build/test 스크립트 포함)
- Python 중심의 스크립트 파이프라인 영역(예: `EODHD/`, `original_data/`, `deep_learning_data/`) — script-first 워크플로우에 사용

작업 대상/디렉토리(Node 앱 vs Python 스크립트)에 따라 적용할 관례를 선택하세요.
