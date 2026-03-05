# Web UI scripts (skill)

## EN

### When to use
- When the user asks for a browser-based UI served by a local/VM backend.
- When the server/UI may be accessed remotely (VM) and bind/port/security rules matter.
- When you need the “no external assets by default” and “debug visibility” policies for reliable debugging.

- **Web UI scripts (when the user requests a Web UI)**
  - **Typical topology (important):** the server may run on a VM, while the user opens the UI from a different computer.
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

---

## KO

### 언제 쓰나
- 사용자가 브라우저 기반 UI(Web UI)를 요청할 때.
- 서버가 VM에서 돌 수 있고 원격 접속(바인딩/포트/보안)이 중요한 상황일 때.
- 외부 에셋 금지/디버그 가시성 같은 “운영 규칙”을 일관되게 적용해야 할 때.

- **Web UI 스크립트(사용자가 Web UI 요청 시)**
  - **전형적인 토폴로지(중요):** 서버는 VM에서 실행되고, 사용자는 다른 컴퓨터(로컬 PC)에서 브라우저로 접속하는 경우가 많습니다.
    - 다른 컴퓨터에서 `http://127.0.0.1:8000/`로 접속된다고 가정하면 안 됩니다.
  - **바인딩(host/port) 정책(원격 접속 정확성 + 안전):**
    - 기본 바인딩은 외부 노출을 막기 위해 `127.0.0.1`(loopback)로 두세요.
    - 환경변수로 바인딩을 바꿀 수 있게 만드세요(예: `WEBUI_HOST`, `WEBUI_PORT`). 원격 접속이 필요할 때만 사용자가 명시적으로 `0.0.0.0`를 선택하도록.
    - 문서에 두 가지 접속 방식을 모두 안내하세요:
      - **권장:** SSH 포트포워딩(`ssh -L 8000:127.0.0.1:8000 <vm_host>`) 후 로컬에서 `http://127.0.0.1:8000` 접속.
      - **직접 공개:** `0.0.0.0`로 바인딩하고 VM 방화벽/클라우드 보안그룹에서 인바운드를 “내 IP만” 허용.
  - **기본은 외부 에셋 금지:** React/CDN/Babel 등 네트워크로 로드되는 JS/CSS에 기본적으로 의존하지 말고, 제한된 네트워크/오프라인에서도 렌더링되게 하세요.
  - **캐시 처리:** 루트 HTML(`GET /`)은 `no-store`로 해서 “수정했는데도 옛 UI가 계속 보이는” 문제를 방지하세요.
  - **브라우저/WebView 호환성(최신 JS 가정 금지):**
    - 구형/내장 WebView에서 파싱 단계에서 바로 죽는 JS 패턴을 피하세요:
      - 함수 호출 인자 목록에서 trailing comma 사용 금지.
      - `??`(nullish coalescing), `?.`(optional chaining) 사용 지양.
    - arrow function, async/await, rest/spread 등 최신 문법을 쓴다면, UI 내에 “시작 실패 패널”을 띄우고 “최신 브라우저로 열라”는 안내를 명확히 표시하세요.
  - **디버그 가시성(필수):**
    - 시작 플레이스홀더 + “preflight OK” 표시로 JS가 도는지 즉시 알 수 있게.
    - `window.onerror` / `unhandledrejection`를 잡아서 콘솔뿐 아니라 UI 화면에도 오류를 보여주세요.
    - 백엔드 생존 확인용 `GET /api/config` 또는 `GET /healthz` 같은 가벼운 엔드포인트를 제공하세요.
  - **잡음 감소:** `/favicon.ico`는 204 또는 작은 아이콘으로 응답해서 404 콘솔 스팸을 줄이세요.
  - **보안:** 시크릿은 절대 로그에 남기지 말고, 외부 공개 시 인바운드 제한을 강하게 권장하세요. 기본은 SSH 터널링을 선호.
