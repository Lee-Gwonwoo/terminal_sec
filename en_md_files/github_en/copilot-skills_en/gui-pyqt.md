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
