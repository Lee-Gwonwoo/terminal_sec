# IBKR LWLG 10초 데이터 수집 계획

### 목표

LWLG 주식 10초봉 한 달치와 2026년 6월 만기 call option 15 strike / 20 strike 데이터를 IBKR Gateway에서 수집하고, 10초 단위 model price 계산 grid를 만드는 독립 작업 폴더를 구성한다.

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

### 계획 중간 필수 확인

- Gateway가 `4001`에서 연결되는지 확인한다.
- `LWLG` stock contract와 `20260618 C15/C20` option contract가 qualify 되는지 확인한다.
- 1일치 smoke test로 10초봉 CSV가 생성되는지 확인한다.
- 한 달치 전체 수집은 IBKR pacing 제한 때문에 필요 시 별도 실행한다.

### 제안하는 구현 순서(이유)

먼저 독립 폴더와 문서를 만들고, 이후 수집 코드와 계산 코드를 분리한다. 수집과 계산을 분리하면 IBKR pacing/error가 있어도 이미 받은 CSV로 model grid를 재생성할 수 있다.

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

### 미확정 사항(명시 결정 필요)

| ID | 미확정 사항 | 선택지 | 차단 대상 Step |
|----|-------------|--------|----------------|
| D1 | 한 달치 전체 수집을 지금 실행할지 | A: 지금 실행, B: 1일 smoke test만 실행, C: 코드만 준비 | 전체 데이터 생성 |
| D2 | model price 계산 방식 | A: option mid IV 역산, B: 외부 IV 입력, C: 실시간 IBKR modelGreeks 저장 후 사용 | model grid 품질 |

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

전체 한 달치 데이터 생성
  🚫 D1 선택 필요: 지금 전체 실행 vs smoke test
```

병렬 트랙 요약: 문서 작성과 코드 작성은 같은 독립 폴더 안에서 병렬로 가능하지만, 실제 model grid 생성은 수집 CSV가 있어야 한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | 전체 한 달치 CSV 생성 | 지금 실행 / smoke test / 코드만 준비 |
| D2 | official model price에 가까운 계산 | mid IV / 외부 IV / 실시간 저장 IV |
