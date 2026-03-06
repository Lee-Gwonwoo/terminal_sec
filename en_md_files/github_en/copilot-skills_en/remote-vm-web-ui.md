# Remote VM Web UI operations (skill)

## EN

### When to use
- When the user is building or operating a browser UI that is served from a remote VM or another machine.
- When remote access, bind host/port, SSH tunneling, firewall rules, or public exposure decisions matter.
- When you need reliability rules for remote browser debugging, cache visibility, and in-page crash reporting.

### When not to use
- Do not treat this as a default skill for ordinary local frontend work such as Vite/React/Next development on the same machine.
- If the task is only about local UI layout, components, styling, state, or API wiring, this skill is usually unnecessary.
- Only pull this skill in for local work when the task explicitly involves host binding, remote browser access, stale-cache problems, or WebView compatibility constraints.

- **Remote VM Web UI operations (when the user requests remote-hosted Web UI behavior)**
  - **Typical topology (important):** the server may run on Azure VM/other VM, while the user opens the UI from a different computer.
    - Do not assume `http://127.0.0.1:8000/` is reachable from another machine.
  - **Bind host/port policy (remote access correctness + safety):**
    - Default bind should be loopback only (`127.0.0.1`) to avoid accidentally exposing the UI to the Internet.
    - Make bind host/port configurable via env vars (example: `WEBUI_HOST`, `WEBUI_PORT`) so users can explicitly opt into remote access (`0.0.0.0`).
    - Document both access modes:
      - **Recommended:** SSH port-forwarding (`ssh -L 8000:127.0.0.1:8000 <vm_host>`) + open `http://127.0.0.1:8000` locally.
      - **Direct exposure:** bind to `0.0.0.0` and require firewall/security-group rules that restrict inbound to the user’s IP.
  - **No external assets by default:** avoid React/CDN/Babel or any network-fetched JS/CSS for the core UI. The UI should render in restricted/offline environments.
  - **Cache behavior:** the root HTML (`GET /`) should be `no-store` to prevent “stuck on old UI” after edits.
  - **Browser/WebView compatibility (don’t assume modern JS):**
    - Avoid JS footguns that can hard-fail parsing in older embedded WebViews:
      - No trailing commas in function call argument lists.
      - Avoid `??` (nullish coalescing) and `?.` (optional chaining).
    - If you use modern JS features (arrow functions, async/await, rest/spread), add a visible startup crash panel and a clear message telling users to open in a modern browser.
  - **Debug visibility (must-have):**
    - Show a startup placeholder + “preflight OK” marker so it’s obvious whether JS is running.
    - Catch `window.onerror` / `unhandledrejection` and render the error message in-page (not only in console).
    - Provide a lightweight `GET /api/config` or `GET /healthz` endpoint to confirm the backend is alive.
  - **Noise reduction:** optionally serve `/favicon.ico` (204 or small icon) to avoid repeated 404 console spam.
  - **Security:** never log secrets; if exposing the server externally, warn users to restrict inbound rules. Prefer SSH tunneling.
