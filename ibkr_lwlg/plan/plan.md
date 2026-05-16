# IBKR LWLG 10초 데이터 수집 계획

### 목표

LWLG 주식 10초봉 한 달치와 2026년 6월 만기 call option 15 strike / 20 strike 데이터를 IBKR Gateway에서 수집하고, 10초 단위 model IV / model price 계산 grid를 만든 뒤, Unusual Whales의 interval flow처럼 볼 수 있는 독립 웹 프로그램을 구성한다.

### 현재 레포 상태(중요, 확인됨)

- 기존 `terminal/` 앱의 IBKR 연동은 일봉 OHLC와 calendar 중심이다.
- 옵션 tick-by-tick, option historical 10초봉, model price grid 코드는 기존 앱에 없다.
- 이번 작업은 `ibkr_lwlg/` 아래 독립 코드와 데이터로만 진행한다.
- IB Gateway `127.0.0.1:4001` 연결은 확인됐다.
- LWLG 2026년 6월 option expiry는 IBKR 기준 `20260618`이며, 20 strike call qualify가 확인됐다.

### 제약 / 비범위

- 기존 web terminal 앱의 backend/frontend 코드는 수정하지 않는다.
- IBKR market data subscription 부족으로 실시간 modelGreeks/model IV가 비어 있을 수 있다.
- IBKR historical endpoint는 option의 과거 model price/model IV를 직접 내려주지 않는다.
- 따라서 historical model price는 option bid/ask mid와 underlying price로 계산한 derived value로 다룬다.

### 읽는 방법(비개발자/일반인 기준)

- `README.md`: 실제 실행 명령과 데이터 의미를 확인한다.
- `fetch_lwlg_10s.py`: IBKR에서 주식/옵션 10초봉을 받는 코드다.
- `build_lwlg_model_grid.py`: 받은 데이터를 10초 단위로 합쳐 계산값을 만든다.
- `data/`: 실제 수집 CSV와 실행 summary가 저장된다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 변경 전: 대상 파일과 목적을 채팅에 알린다.
- 변경 후: 문법 검증과, 가능하면 Gateway probe 또는 짧은 데이터 수집으로 확인한다.
- 사용자 확인 전 상태는 `⏳`로 기록하고, 사용자가 확인한 뒤에만 `✅`로 바꾼다.

### 아키텍처(상위)

```text
IB Gateway/TWS API
  -> fetch_lwlg_10s.py
      -> data/lwlg_stock_10s_trades_*.csv
      -> data/lwlg_option_20260618_c15_10s_{bid,ask,trades}_*.csv
      -> data/lwlg_option_20260618_c20_10s_{bid,ask,trades}_*.csv
      -> data/run_summary_*.json
  -> build_lwlg_model_grid.py
      -> data/lwlg_option_model_grid_10s.csv
    -> make_interval_flow.py
      -> web/data/interval_flow.json
    -> web/index.html + web/app.js + web/styles.css
      -> 브라우저 interval flow UI
```

### 결정/선행조건(초기에 확정 필요)

| 결정 | 현재값 | 이유 |
|------|--------|------|
| Gateway 포트 | `4001` | 현재 연결 확인됨 |
| LWLG 6월 expiry | `20260618` | `20260619`는 IBKR chain에 없음 |
| strike | `15`, `20` | 사용자 요청 |
| bar size | `10 secs` | 사용자 요청 |
| 주식 데이터 | `TRADES` | 주가 10초봉 기준 |
| 옵션 데이터 | `BID`, `ASK`, `TRADES` | mid/last/model 계산용 |
| interval 단위 | 5분 | Unusual Whales interval flow 화면과 유사한 기본 단위 |

### 계획 중간 필수 확인

- Gateway가 `4001`에서 연결되는지 확인한다.
- `LWLG` stock contract와 `20260618 C15/C20` option contract가 qualify 되는지 확인한다.
- 1일치 smoke test로 10초봉 CSV가 생성되는지 확인한다.
- 한 달치 전체 수집은 사용자가 요청했으므로 실행한다. IBKR pacing 제한이 발생하면 `sleep-sec`를 늘려 재시도한다.

### 제안하는 구현 순서(이유)

먼저 독립 폴더와 문서를 만들고, 이후 수집 코드와 계산 코드를 분리한다. 수집과 계산을 분리하면 IBKR pacing/error가 있어도 이미 받은 CSV로 model grid를 재생성할 수 있다.

PLAN CHANGE 2026-05-16: 사용자가 Unusual Whales interval flow 형태의 웹 프로그램 구현과 실제 데이터 수집을 요청했으므로 Step 4와 Step 5를 추가한다. 기존 `terminal/` web terminal 앱과는 계속 분리하고, `ibkr_lwlg/web/` 정적 웹 앱으로 구현한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — 폴더와 문서 구성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 독립 폴더와 data/plan 하위 폴더를 만든다 | `ibkr_lwlg/` | 폴더 존재 확인 | ⏳ |
| 1-2 | README와 plan을 작성한다 | `README.md`, `plan/plan.md` | 파일 내용 확인 | ⏳ |

1-1 목적: 기존 web terminal 작업과 분리된 작업 경계를 만든다. 완료 조건: `ibkr_lwlg` 폴더가 루트에 보인다. 사람 검증: VS Code 탐색기에서 폴더 확인. 흔한 문제/주의: 기존 앱 폴더에 섞이면 안 된다.

1-2 목적: 데이터 가능 범위와 사용법을 기록한다. 완료 조건: README에 실행 명령과 출력 컬럼이 있다. 사람 검증: README를 열어 확인. 흔한 문제/주의: historical model price가 IBKR 직접값처럼 쓰이면 안 된다.

검증 훅:

```powershell
Get-ChildItem .\ibkr_lwlg
Get-ChildItem .\ibkr_lwlg\plan
```

사용자 확인 필요: **예**

#### ⏳ Step 2 — IBKR 수집 코드 작성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | Gateway 연결, stock/option qualify, 10초봉 chunk 수집 코드를 작성한다 | `fetch_lwlg_10s.py` | `python -m py_compile fetch_lwlg_10s.py` | ⏳ |
| 2-2 | 실행 설정 예시와 requirements를 추가한다 | `config.example.json`, `requirements.txt` | 파일 존재 확인 | ⏳ |

2-1 목적: 주식과 옵션 데이터를 같은 규칙으로 받을 수 있게 한다. 완료 조건: stock/option CSV와 run summary를 생성할 수 있다. 사람 검증: `data` 폴더에 CSV가 생긴다. 흔한 문제/주의: IBKR pacing이 걸리면 sleep을 늘려야 한다.

2-2 목적: 반복 실행 가능한 환경 정보를 남긴다. 완료 조건: 포트/만기/strike 설정이 파일에 있다. 사람 검증: JSON을 열어 값 확인. 흔한 문제/주의: 계정번호/API secret은 파일에 넣지 않는다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python -m py_compile fetch_lwlg_10s.py
python fetch_lwlg_10s.py --probe-only --port 4001
```

사용자 확인 필요: **예**

#### ⏳ Step 3 — model grid 계산 코드 작성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | option mid 기반 IV 역산과 model price 계산 코드를 작성한다 | `build_lwlg_model_grid.py` | `python -m py_compile build_lwlg_model_grid.py` | ⏳ |
| 3-2 | 출력 컬럼과 계산 가정을 문서화한다 | `README.md` | 출력 컬럼 섹션 확인 | ⏳ |

3-1 목적: 수집 CSV를 10초 단위 분석 테이블로 변환한다. 완료 조건: `lwlg_option_model_grid_10s.csv`를 만들 수 있다. 사람 검증: CSV에 15/20 strike row가 보인다. 흔한 문제/주의: option quote가 비면 IV도 비게 된다.

3-2 목적: 계산값과 IBKR official model price를 구분한다. 완료 조건: README에 `derived model price` 설명이 있다. 사람 검증: README 용어 섹션 확인. 흔한 문제/주의: Black-Scholes 근사는 배당/미국식 조기행사 반영이 제한적이다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python -m py_compile build_lwlg_model_grid.py
```

사용자 확인 필요: **예**

#### ⬜ Step 4 — interval flow 데이터 생성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | 10초 model grid를 5분 interval flow row로 집계한다 | `make_interval_flow.py` | `python -m py_compile make_interval_flow.py` | ⬜ |
| 4-2 | 웹 UI가 읽을 JSON 산출물을 만든다 | `web/data/interval_flow.json` | JSON row 수와 summary 확인 | ⬜ |

4-1 목적: Unusual Whales식 interval row를 만들기 위한 중간 데이터를 생성한다. 완료 조건: interval, contract, strike, volume, premium, avg fill, model IV/model price 컬럼이 계산된다. 사람 검증: JSON 또는 웹 table에서 15/20 strike row가 보인다. 흔한 문제/주의: IBKR historical data에는 sweep/floor 여부가 없으므로 해당 컬럼은 계산하지 않는다.

4-2 목적: 브라우저에서 backend 없이 바로 읽을 수 있는 데이터 파일을 만든다. 완료 조건: `web/data/interval_flow.json`이 생성된다. 사람 검증: 파일을 열어 `rows` 배열이 보인다. 흔한 문제/주의: 너무 큰 CSV를 브라우저가 직접 파싱하게 만들지 않는다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python -m py_compile make_interval_flow.py
python make_interval_flow.py --interval-minutes 5
```

사용자 확인 필요: **예**

#### ⬜ Step 5 — interval flow 웹 프로그램 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 정적 웹 UI 레이아웃과 스타일을 만든다 | `web/index.html`, `web/styles.css` | 브라우저 화면 확인 | ⬜ |
| 5-2 | 필터, 정렬, summary, table 렌더링 로직을 만든다 | `web/app.js` | local server에서 동작 확인 | ⬜ |
| 5-3 | local static server helper를 만든다 | `serve_web.py` | `python serve_web.py --port 8765` | ⬜ |

5-1 목적: screenshot처럼 dense한 interval flow UI를 제공한다. 완료 조건: 좌측 필터, 상단 summary, table이 한 화면에 표시된다. 사람 검증: 브라우저에서 페이지를 열어 확인. 흔한 문제/주의: 장식보다 데이터 밀도를 우선한다.

5-2 목적: strike/contract/date/interval 필터와 정렬을 제공한다. 완료 조건: 필터를 바꾸면 table과 summary가 바뀐다. 사람 검증: strike 15/20 체크를 바꿔본다. 흔한 문제/주의: 숫자 정렬이 문자열 정렬이 되면 안 된다.

5-3 목적: 파일 직접 열기 대신 로컬 HTTP로 JSON을 안정적으로 불러온다. 완료 조건: `http://localhost:8765/`에서 UI가 열린다. 사람 검증: URL 접속. 흔한 문제/주의: 포트 충돌 시 다른 포트를 사용한다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python -m py_compile serve_web.py
python serve_web.py --port 8765
```

사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 미확정 사항 | 선택지 | 차단 대상 Step |
|----|-------------|--------|----------------|
| D1 | 한 달치 전체 수집을 지금 실행할지 | A: 지금 실행, B: 1일 smoke test만 실행, C: 코드만 준비 | 전체 데이터 생성 |
| D2 | model price 계산 방식 | A: option mid IV 역산, B: 외부 IV 입력, C: 실시간 IBKR modelGreeks 저장 후 사용 | model grid 품질 |
| D3 | 웹 UI interval 기본값 | A: 5분, B: 1분, C: 10분 | interval flow row 밀도 |

### 실행 의존성 그래프

범례: `✅` 사용자확인 완료, `⏳` 구현완료/확인 대기, `⬜` 미착수, `🚫` 차단

```text
Step 1 폴더와 문서
  ⏳ 1-1 독립 폴더 생성
  ⏳ 1-2 README/plan 작성
    |
    v
Step 2 IBKR 수집 코드
  ⏳ 2-1 fetch_lwlg_10s.py 작성
  ⏳ 2-2 config/requirements 작성
    |
    v
Step 3 model grid 계산 코드
  ⏳ 3-1 build_lwlg_model_grid.py 작성
  ⏳ 3-2 계산 가정 문서화
    |
    v
Step 4 interval flow 데이터 생성
  ⬜ 4-1 make_interval_flow.py 작성
  ⬜ 4-2 web/data/interval_flow.json 생성
    |
    v
Step 5 interval flow 웹 프로그램
  ⬜ 5-1 web/index.html + styles.css 작성
  ⬜ 5-2 web/app.js 작성
  ⬜ 5-3 serve_web.py 작성

전체 한 달치 데이터 생성
  ⏳ D1 사용자 요청으로 지금 실행
```

병렬 트랙 요약: 웹 UI shell은 데이터 수집과 병렬로 작성 가능하다. 다만 실제 summary와 table 검증은 `interval_flow.json`이 생성된 뒤 진행한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | 전체 한 달치 CSV 생성 | 지금 실행 |
| D2 | official model price에 가까운 계산 | mid IV / 외부 IV / 실시간 저장 IV |
| D3 | interval flow 기본 집계 | 5분 기본, 필요 시 CLI에서 변경 |
