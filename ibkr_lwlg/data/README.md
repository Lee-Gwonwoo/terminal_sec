# ibkr_lwlg 데이터 폴더

이 폴더는 `fetch_lwlg_10s.py`와 `build_lwlg_model_grid.py`가 생성하는 CSV/JSON 산출물을 저장합니다.

이 폴더에 들어가는 파일은 실제 IBKR Gateway/TWS API 응답에서 생성되어야 합니다. mock 또는 임의 생성 데이터는 저장하지 않습니다.

대표 산출물:

| 파일 패턴 | 의미 |
|-----------|------|
| `lwlg_stock_10s_trades_*.csv` | LWLG 주식 10초봉 TRADES 데이터 |
| `lwlg_option_*_c15_10s_bid_*.csv` | 15 strike call 옵션 10초 BID bar |
| `lwlg_option_*_c15_10s_ask_*.csv` | 15 strike call 옵션 10초 ASK bar |
| `lwlg_option_*_c15_10s_trades_*.csv` | 15 strike call 옵션 10초 TRADES bar |
| `lwlg_option_*_c20_10s_bid_*.csv` | 20 strike call 옵션 10초 BID bar |
| `lwlg_option_*_c20_10s_ask_*.csv` | 20 strike call 옵션 10초 ASK bar |
| `lwlg_option_*_c20_10s_trades_*.csv` | 20 strike call 옵션 10초 TRADES bar |
| `lwlg_option_model_grid_10s.csv` | 주식 10초 grid에 옵션 quote/trade와 계산 IV/model price를 붙인 결과 |
| `run_summary_*.json` | 수집 실행 요약과 IBKR error code 기록 |
