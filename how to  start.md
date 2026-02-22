# How to Start (terminal_sec)

## EN

### Quick Start (VS Code Tasks)

1) Install dependencies (first time only)

- Web UI:
  - Open a terminal in `termina_web/figma_code/terminal ui` and run:
    - `npm.cmd install`
- Backend API:
  - Open a terminal in `terminal/backend` and run:
    - `npm.cmd install`

2) Start dev servers

- Recommended (starts both in parallel):
  - Run VS Code task: `webui: dev (all)`
- Or start individually:
  - Run VS Code task: `backend: dev (npm.cmd)`
  - Run VS Code task: `webui: dev (npm.cmd)`

3) Open the app

- Web UI: http://localhost:5173/

### Expected Ports / Endpoints

- Backend listens on: http://localhost:8080
- Backend health check:
  - http://localhost:8080/healthz  → `{ "ok": true }`
- Through Vite proxy (from the Web UI dev server):
  - http://localhost:5173/api/config

### Troubleshooting

#### 1) Vite proxy error: `ECONNREFUSED` for `/api/...`

Cause: the Web UI is up, but the backend is not running (or not reachable).

Fix:
- Start the backend dev server.
- Confirm backend health:
  - `Invoke-WebRequest -UseBasicParsing http://localhost:8080/healthz | Select-Object -ExpandProperty Content`

#### 2) Backend dev fails: `'tsx' is not recognized as an internal or external command`

Cause: backend dependencies were not installed yet, so `node_modules/.bin/tsx` is missing.

Fix:
- In `terminal/backend` run:
  - `npm.cmd install`
- Then run:
  - `npm.cmd run dev`

#### 3) Still failing after installs

- Kill any old processes using ports 5173 / 8080.
- Re-run the tasks.
- If Windows firewall prompts appear, allow localhost traffic.

---

## KO

### 빠른 실행 (VS Code Task 기준)

1) 의존성 설치(최초 1회)

- Web UI:
  - `termina_web/figma_code/terminal ui` 폴더에서:
    - `npm.cmd install`
- Backend API:
  - `terminal/backend` 폴더에서:
    - `npm.cmd install`

2) 개발 서버 실행

- 권장(둘 다 병렬로 실행):
  - VS Code Task: `webui: dev (all)`
- 또는 각각 실행:
  - VS Code Task: `backend: dev (npm.cmd)`
  - VS Code Task: `webui: dev (npm.cmd)`

3) 브라우저에서 접속

- Web UI: http://localhost:5173/

### 기본 포트 / 확인용 엔드포인트

- Backend 기본 주소: http://localhost:8080
- Backend 헬스체크:
  - http://localhost:8080/healthz  → `{ "ok": true }`
- Web UI(Vite) 프록시 경유 확인:
  - http://localhost:5173/api/config

### 자주 겪는 문제 / 해결

#### 1) Vite 프록시 `ECONNREFUSED` (예: `/api/news...`)

원인: Web UI는 떠 있는데 Backend가 죽었거나 실행되지 않아서 프록시가 접속을 못합니다.

해결:
- Backend dev를 먼저 실행하세요.
- Backend가 살아있는지 확인:
  - `Invoke-WebRequest -UseBasicParsing http://localhost:8080/healthz | Select-Object -ExpandProperty Content`

#### 2) Backend dev 실행 시 `'tsx'은(는) ... 아닙니다` 에러

원인: `terminal/backend`에서 `npm install`이 안 되어 `tsx` 바이너리가 없을 때 발생합니다.

해결:
- `terminal/backend`에서:
  - `npm.cmd install`
- 이후:
  - `npm.cmd run dev`

#### 3) 설치했는데도 계속 실패할 때

- 5173/8080 포트를 점유한 이전 프로세스를 종료한 뒤 다시 실행하세요.
- Task를 재실행하세요.
- Windows 방화벽 팝업이 뜨면 localhost 통신을 허용하세요.
