# GUI scripts (PyQt) (skill)

## EN

### When to use
- When the user asks for a desktop GUI (file picker, buttons, progress, logs).
- When implementing a PyQt-based tool (PyQt6 preferred unless the repo already uses PyQt5).
- When creating a `*gui_vm*.py` pattern where the UI runs locally but computation runs on a VM via SSH.

- **GUI scripts (when the user requests a GUI)**
  - Use **PyQt only** (do not use Tkinter, Streamlit, NiceGUI, etc.). Prefer PyQt6 unless the repo/script already uses PyQt5.
  - Always allow text copy in GUI text areas, tables, and status labels.
  - GUI windows must be resizable, and layouts should auto-adjust child widgets (no fixed sizes that clip content).
  - Do not use fixed-size constraints like `setFixedSize(...)` / `MSWindowsFixedSizeDialogHint` unless the user explicitly requests a fixed-size window.
  - For long folder names / paths displayed in labels, enable wrapping so the window can shrink:
    - Use `QLabel.setWordWrap(True)` and (if needed) a shrink-friendly size policy like `QSizePolicy.Ignored`.
  - Always create a GUI activity log when a GUI is requested.
    - Default location: same folder as the script file.
    - If the script’s output files are written to another folder, create the GUI log in that output folder after running (so logs live next to outputs).
    - Recommended filename: `<script_stem>_gui.log`.
  - The GUI log should record user actions (button clicks, file selections, start/end of processing, progress milestones) and always record exceptions via `logger.exception(...)`.
  - **When asked to create a `*gui_vm*.py` file**
    - The GUI must run locally, but the actual computation/code + data access must run on the VM via SSH.
    - Results must always be written on the VM.
    - **SSH execution robustness (important)**
      - Do not rely on `cd <remote_root> && python <relative_script>`; in some VM/login-shell setups the working directory can behave unexpectedly and relative paths may resolve under `$HOME`.
      - Prefer executing the remote script via an **absolute path** derived from `remote_root`, e.g. `python3 "$remote_root/path/to/script.py" ...`.
      - On Windows/PowerShell, be careful with `$` expansion when constructing SSH commands. Prefer single-quoted remote command strings or escape `$` so expansion happens on the VM, not locally.
      - Prefer the VM repo virtualenv interpreter when available (e.g. `/mnt/python/.venv/bin/python`) to avoid `ModuleNotFoundError` due to missing packages in system `python3`.
      - Treat “remote script file not found” / bad `remote_root` as **non-retryable** configuration errors; fail fast with a clear message.
    - **Stop / Retry correctness (important)**
      - If the GUI supports retries, make `Stop` a **hard cancel**:
        - Set a `stop_requested` flag.
        - Stop any retry timers immediately.
        - Clear any pending work queues (e.g., multi-format runs).
        - On process `finished` callbacks, check `stop_requested` first and **do not** schedule retries or start the next queued run.
      - Avoid race conditions where a killed process triggers `finished` → “failure” → retry scheduling.
    - Syncing artifacts back to the local machine is **optional** and should be user-controllable in the GUI (checkbox/toggle).
      - Default: **do not** sync outputs back to local unless the user opts in.
      - If sync is disabled, the GUI must clearly indicate that outputs exist only on the VM and include the VM output path(s) in the final status/log.
    - **Sync default:** prefer `rsync` for VM → local (incremental, restartable). On Windows, prefer `wsl rsync` (WSL path style like `/mnt/c/...`). If `rsync` is unavailable, fall back to `scp`.
    - Assume local/VM folder structures are identical; if they are not, the GUI must detect the mismatch and stop with an error.

---

## KO

### 언제 쓰나
- 사용자가 데스크톱 GUI(파일 선택, 버튼, 진행률, 로그)를 요청할 때.
- PyQt 기반 툴을 구현할 때(PyQt6 우선, 기존에 PyQt5를 쓰고 있으면 유지).
- `*gui_vm*.py`처럼 UI는 로컬, 계산은 SSH로 VM에서 실행하는 구조가 필요할 때.

- **GUI 스크립트(사용자가 GUI 요청 시)**
  - Tkinter/Streamlit 등 금지, **PyQt만 사용**. 기본은 PyQt6(이미 PyQt5를 쓰면 유지).
  - GUI의 텍스트 영역/테이블/상태 표시에서 복사 가능하도록 설정.
  - 창 크기는 항상 조정 가능해야 하며, 레이아웃은 내부 위젯이 자동으로 맞춰지게 구성(고정 크기 금지).
  - 사용자가 고정 크기를 명시적으로 요청하지 않는 한 `setFixedSize(...)`, `MSWindowsFixedSizeDialogHint` 같은 고정 크기 힌트/제약을 사용하지 마세요.
  - 폴더명/경로처럼 긴 문자열을 라벨로 표시할 때는 창이 가로로 과도하게 커지지 않도록 줄바꿈을 허용하세요:
    - `QLabel.setWordWrap(True)` 사용, 필요하면 `QSizePolicy.Ignored`처럼 축소에 유리한 size policy 적용.
  - GUI 사용 로그(`<script_stem>_gui.log`)를 항상 남기고, 예외는 `logger.exception(...)`으로 기록.
  - **`*gui_vm*.py` 파일 생성 요청 시**
    - GUI는 로컬에서 실행되어야 하며, 실제 코드 실행/데이터 접근은 SSH로 VM에서 수행해야 함.
    - 결과 산출물은 항상 VM에 저장.
    - **SSH 실행 견고성(중요)**
      - `cd <remote_root> && python <상대경로>` 방식에 의존하지 마세요. VM/login-shell 환경에 따라 작업 디렉토리가 예상과 다르게 동작하면서 상대경로가 `$HOME` 기준으로 풀릴 수 있습니다.
      - `remote_root`를 기준으로 **절대경로 스크립트**를 만들어 실행하는 방식을 우선 사용하세요. 예: `python3 "$remote_root/path/to/script.py" ...`
      - Windows/PowerShell에서 SSH 커맨드를 만들 때 `$`가 로컬에서 먼저 확장되지 않도록 주의하세요(원격 문자열은 single-quote 사용 또는 `$` 이스케이프 권장).
      - VM에 레포 venv가 있으면 그 파이썬을 우선 사용하세요(예: `/mnt/python/.venv/bin/python`). system `python3`는 패키지(`pandas` 등)가 없어서 `ModuleNotFoundError`가 날 수 있습니다.
      - “원격 스크립트 파일이 없음” / `remote_root` 불일치 같은 케이스는 **재시도 대상이 아닌 설정 오류**이므로 즉시 실패시키고 안내 메시지를 명확히 하세요.
    - **Stop / Retry 정확성(중요)**
      - GUI에 재시도 기능이 있다면 `Stop`은 **완전 중지**여야 합니다:
        - `stop_requested` 플래그를 세팅
        - 재시도 타이머 즉시 중지
        - 대기 중 작업 큐(예: 여러 포맷 순차 실행) 비우기
        - 프로세스 `finished` 콜백에서 먼저 `stop_requested`를 확인하고, 재시도 예약/다음 작업 실행을 절대 하지 않기
      - `kill()`로 종료된 뒤 `finished` → “실패 처리” → 재시도 예약이 걸리는 레이스를 방지하세요.
    - 로컬로 결과를 동기화하는 것은 **옵션**이며, GUI에서 사용자가 켜고 끌 수 있어야 함(체크박스/토글).
      - 기본값: 사용자가 켜지 않는 한 로컬로 동기화하지 않음.
      - 동기화를 끈 경우, GUI는 “결과는 VM에만 존재한다”를 명확히 표시하고 최종 상태/로그에 VM 출력 경로를 포함해야 함.
    - **동기화 기본:** VM → 로컬은 `rsync`를 우선 사용(증분 전송/재시도 유리). Windows에서는 `wsl rsync`를 우선 고려(WSL 경로 `/mnt/c/...` 사용). `rsync`가 없으면 `scp`로 폴백.
    - 로컬/VM 폴더 구조가 동일하다는 전제를 검증하고, 불일치 시 오류로 중단.
