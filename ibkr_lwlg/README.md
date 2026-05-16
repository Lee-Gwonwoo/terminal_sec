# IBKR LWLG 10초 데이터 수집

## 목적

이 폴더는 기존 web terminal 작업과 분리된 독립 실험 폴더입니다. 목표는 IBKR Gateway/TWS API로 LWLG 주식 10초봉 한 달치와 2026년 6월 만기 call option 15 strike / 20 strike 데이터를 받아, 10초 단위 옵션 model price 계산용 grid를 만드는 것입니다.

## 현재 확인된 IBKR 조건

- IB Gateway `127.0.0.1:4001` 연결은 확인됐습니다.
- LWLG 2026년 6월 정규 만기는 IBKR chain 기준 `20260618`입니다. `20260619`는 Juneteenth 휴장으로 직접 expiry가 잡히지 않았습니다.
- `LWLG 260618C00020000` 20 strike call 계약 qualify는 확인됐습니다.
- historical `TRADES`와 `BID_ASK` tick 응답은 확인됐습니다.
- 실시간 option modelGreeks/model IV는 현재 market data subscription 오류가 나왔습니다. 따라서 한 달치 historical model price/model IV를 IBKR에서 직접 내려받는 방식은 현재 기준으로 불가능합니다.

## 핵심 결론

LWLG 주식 10초봉 한 달치는 IBKR historical bar를 날짜/시간 chunk로 나누면 받을 수 있습니다. 10초봉은 요청 크기 제한 때문에 하루 RTH를 4시간 chunk 두 개로 나누는 방식으로 구현했습니다.

15 strike / 20 strike option도 같은 방식으로 10초 `BID`, `ASK`, `TRADES` bar를 받을 수 있습니다. 다만 IBKR historical endpoint는 option의 과거 `modelGreeks`, `model IV`, `model price`를 10초 단위로 직접 제공하지 않습니다. 그래서 `build_lwlg_model_grid.py`는 option bid/ask mid와 주식 가격을 이용해 Black-Scholes 근사 implied volatility를 역산하고, 직전 IV를 다음 10초 underlying price에 적용하는 방식의 `derived model price`를 계산합니다.

이 값은 IBKR TWS 화면의 official model price가 아니라, 수집 가능한 historical quote/trade로 만든 재현 가능한 계산값입니다.

## 설치

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python -m pip install -r requirements.txt
```

## Gateway 확인

IB Gateway 또는 TWS에서 API socket이 켜져 있어야 합니다. 현재 확인된 Gateway 포트는 `4001`입니다.

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python fetch_lwlg_10s.py --probe-only --port 4001
```

## 한 달치 수집

아래 명령은 최근 31일 calendar window를 돌며 RTH 기준 10초봉을 수집합니다. IBKR pacing을 피하려면 `--sleep-sec`를 너무 낮게 두지 않는 편이 좋습니다.

```powershell
cd C:\github_coding\terminal_sec\ibkr_lwlg
python fetch_lwlg_10s.py --port 4001 --client-id 191 --days 31 --expiry 20260618 --strikes 15,20 --sleep-sec 1.0
```

특정 종료일 기준으로 수집하려면:

```powershell
python fetch_lwlg_10s.py --end-date 2026-05-15 --days 31 --expiry 20260618 --strikes 15,20
```

## model grid 생성

```powershell
python build_lwlg_model_grid.py --expiry 20260618 --strikes 15,20 --risk-free-rate 0.045 --dividend-yield 0
```

## 출력 컬럼

`fetch_lwlg_10s.py`의 bar CSV 공통 컬럼:

- `[][][]timestamp[][][]`: IBKR가 반환한 bar timestamp입니다.
- `[][][]symbol[][][]`: underlying symbol입니다.
- `[][][]sec_type[][][]`: `STK` 또는 `OPT`입니다.
- `[][][]expiry[][][]`: option expiry입니다. 주식 row는 빈 값입니다.
- `[][][]right[][][]`: option right입니다. 주식 row는 빈 값입니다.
- `[][][]strike[][][]`: option strike입니다. 주식 row는 빈 값입니다.
- `[][][]what_to_show[][][]`: `TRADES`, `BID`, `ASK` 중 하나입니다.
- `[][][]open[][][]`, `[][][]high[][][]`, `[][][]low[][][]`, `[][][]close[][][]`: 10초 bar 가격입니다.
- `[][][]volume[][][]`: 해당 bar의 volume입니다. quote-only bar에서는 비어 있을 수 있습니다.
- `[][][]bar_count[][][]`: IBKR bar count입니다.
- `[][][]wap[][][]`: IBKR weighted average price입니다.
- `[][][]contract_con_id[][][]`: IBKR contract id입니다.
- `[][][]local_symbol[][][]`: option local symbol입니다.

`build_lwlg_model_grid.py`의 출력 컬럼:

- `[][][]timestamp[][][]`: 10초 grid timestamp입니다.
- `[][][]underlying_close[][][]`: 같은 timestamp의 LWLG 주식 close입니다.
- `[][][]expiry[][][]`, `[][][]right[][][]`, `[][][]strike[][][]`: option 식별자입니다.
- `[][][]option_bid[][][]`, `[][][]option_ask[][][]`, `[][][]option_mid[][][]`: option quote 기반 가격입니다.
- `[][][]option_last[][][]`, `[][][]option_volume[][][]`: option trade 기반 가격/volume입니다.
- `[][][]seconds_to_expiry[][][]`: timestamp부터 expiry close까지 남은 초입니다.
- `[][][]iv_from_mid[][][]`: option mid와 underlying price로 역산한 Black-Scholes IV입니다.
- `[][][]model_price_from_mid_iv[][][]`: 같은 row의 `iv_from_mid`로 재계산한 call price입니다.
- `[][][]model_price_from_prev_iv[][][]`: 직전 유효 IV를 현재 underlying price에 적용한 10초 단위 derived model price입니다.
- `[][][]risk_free_rate[][][]`, `[][][]dividend_yield[][][]`: 계산 가정입니다.
- `[][][]source_flags[][][]`: 계산에 사용된 데이터 상태입니다.

## 용어

- `10초봉`: 10초 동안의 open/high/low/close/volume bar입니다.
- `BID bar`: 해당 10초 구간의 bid 가격 bar입니다.
- `ASK bar`: 해당 10초 구간의 ask 가격 bar입니다.
- `TRADES bar`: 실제 체결 가격 기준 10초 bar입니다.
- `option_mid`: `BID close`와 `ASK close`의 평균입니다.
- `iv_from_mid`: option_mid를 설명하는 Black-Scholes implied volatility입니다.
- `derived model price`: historical quote로 계산한 내부 이론가입니다. IBKR official model price와 동일하다고 가정하면 안 됩니다.

## 주의 사항

- IBKR market data 권한이 없으면 실시간 `modelGreeks`, `model IV`, `model price`는 비어 있거나 오류가 납니다.
- historical 10초 데이터 요청은 pacing 제한이 있습니다. 오류가 나면 `--sleep-sec`를 늘리고 다시 실행하세요.
- 한 달치 전체 option BID/ASK/TRADES를 15/20 strike 모두 받으면 요청 수가 많습니다. 첫 실행은 `--days 1`로 smoke test 후 늘리는 것을 권장합니다.
