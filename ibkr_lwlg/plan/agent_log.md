# IBKR LWLG 작업 로그

## 2026-05-16

**작성 시각:** 00:00 (local)

- `ibkr_lwlg/` 독립 폴더를 생성했다.
- `README.md`, `requirements.txt`, `config.example.json`, `data/README.md`를 추가했다.
- `fetch_lwlg_10s.py`를 추가해 IBKR Gateway/TWS에서 LWLG 주식/옵션 10초봉을 수집할 수 있게 했다.
- `build_lwlg_model_grid.py`를 추가해 option mid 기반 IV 역산과 derived model price 계산 grid를 만들 수 있게 했다.
- `plan/plan.md`를 추가해 이번 작업이 기존 web terminal 작업과 별개임을 명시했다.
- 상태: 확인 대기(awaiting user confirmation).

## 2026-05-16

**작성 시각:** 04:10 (local)

- `python -m py_compile fetch_lwlg_10s.py build_lwlg_model_grid.py` 검증을 통과했다.
- `python fetch_lwlg_10s.py --probe-only --port 4001 --client-id 192`로 Gateway 연결과 LWLG contract qualify를 확인했다.
- 확인 결과: LWLG stock conId `49462420`, selected expiry `20260618`, 15 strike conId `863931261`, 20 strike conId `872916649`, missing strikes 없음.
- `python fetch_lwlg_10s.py --port 4001 --client-id 193 --end-date 2026-05-15 --days 1 --expiry 20260618 --strikes 15,20 --sleep-sec 0.5`로 실제 IBKR 1일 smoke 데이터를 생성했다.
- 생성 row 수: stock TRADES 2,340행, C15 BID/ASK/TRADES 각 2,340행, C20 BID/ASK/TRADES 각 2,340행.
- `python build_lwlg_model_grid.py --expiry 20260618 --strikes 15,20 --risk-free-rate 0.045 --dividend-yield 0`로 `data/lwlg_option_model_grid_10s.csv` 4,680행을 생성했다.
- IB error code는 smoke 실행 중 보고되지 않았다.
- 상태: 확인 대기(awaiting user confirmation).
