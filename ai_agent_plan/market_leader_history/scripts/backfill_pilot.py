# -*- coding: utf-8 -*-
"""Yahoo 백필 파일럿: 접합부(seam) 일치 검증."""
import sys, sqlite3, pandas as pd, yfinance as yf
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"

trunc = ["AAPL","ABBV","NVDA","AMZN","MSFT","GOOGL","AMD","ACHR","ALAB"]  # 절단/최근IPO
nodata = ["ABEO","HYLN"]                                                   # OHLC 없음
con = sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True)

print(f"{'sym':>6} {'DB_min':>11} {'DB_close@seam':>13} {'YH_close@seam':>13} {'ratio':>6} {'YH_min':>11} {'YH_rows_pre':>11}")
for s in trunc:
    row = pd.read_sql("SELECT MIN(Datetime) mn FROM ohlc_1d WHERE Symbol=?", con, params=(s,))
    seam = row.mn.iloc[0]
    dbc = pd.read_sql("SELECT Close FROM ohlc_1d WHERE Symbol=? AND Datetime=?", con, params=(s, seam))
    dbclose = dbc.Close.iloc[0] if len(dbc) else None
    try:
        y = yf.download(s, start="2009-01-01", end="2026-05-06", progress=False, auto_adjust=False)
        if isinstance(y.columns, pd.MultiIndex): y.columns = y.columns.get_level_values(0)
        y.index = y.index.astype(str).str[:10]
        seam_date = seam[:10]
        yhc = y.loc[seam_date, "Close"] if seam_date in y.index else None
        ymin = y.index.min()
        pre = (y.index < seam_date).sum()
        ratio = (dbclose/yhc) if (yhc and dbclose) else None
        print(f"{s:>6} {seam[:10]:>11} {dbclose if dbclose else 0:>13.2f} {yhc if yhc else 0:>13.2f} "
              f"{ratio if ratio else 0:>6.3f} {ymin:>11} {pre:>11}")
    except Exception as e:
        print(f"{s:>6}  FAIL: {type(e).__name__} {str(e)[:60]}")

print("\n=== OHLC 없는 종목 (Yahoo 전체) ===")
for s in nodata:
    try:
        y = yf.download(s, start="2009-01-01", end="2026-05-06", progress=False, auto_adjust=False)
        if isinstance(y.columns, pd.MultiIndex): y.columns = y.columns.get_level_values(0)
        y.index = y.index.astype(str).str[:10]
        print(f"  {s:>6}: {len(y)}행, {y.index.min() if len(y) else '-'} ~ {y.index.max() if len(y) else '-'}")
    except Exception as e:
        print(f"  {s:>6}  FAIL: {type(e).__name__} {str(e)[:60]}")
