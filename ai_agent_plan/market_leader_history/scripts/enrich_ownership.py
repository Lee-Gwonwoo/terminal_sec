# -*- coding: utf-8 -*-
"""세 리더 CSV의 고유 티커에 대해 Yahoo 소유구조(inst%/float%/insider%) 수집 → ownership_yahoo.csv.
   현재 스냅샷 값이다(과거 이벤트에도 오늘 값). 재실행 시 이미 받은 티커는 건너뜀(캐시)."""
import os, sys, glob, pandas as pd, yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
RAW = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data"
OUT = os.path.join(RAW, "ownership_yahoo.csv")

tk = set()
for f in ["market_leader_monthly.csv", "market_leader_monthly_cohortscaled.csv",
          "market_leader_bigmovers_4w.csv"]:
    p = os.path.join(RAW, f)
    if os.path.exists(p): tk |= set(pd.read_csv(p).ticker.astype(str).unique())

done = {}
if os.path.exists(OUT):
    prev = pd.read_csv(OUT)
    done = {r.ticker: r for _, r in prev.iterrows()}
todo = sorted(tk - set(done))
print(f"고유 티커 {len(tk)} | 이미 받음 {len(done)} | 신규 수집 {len(todo)}")

def fetch(t):
    try:
        i = yf.Ticker(t).info
        inst = i.get("heldPercentInstitutions")
        insid = i.get("heldPercentInsiders")
        fl = i.get("floatShares"); so = i.get("sharesOutstanding")
        floatpct = (fl / so * 100) if (fl and so) else None
        return t, (inst*100 if inst is not None else None), (insid*100 if insid is not None else None), floatpct
    except Exception:
        return t, None, None, None

rows = []
if todo:
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fetch, t): t for t in todo}
        for n, fu in enumerate(as_completed(futs), 1):
            rows.append(fu.result())
            if n % 50 == 0: print(f"  {n}/{len(todo)}")

new = pd.DataFrame(rows, columns=["ticker", "inst_pct", "insider_pct", "float_pct"])
allrows = pd.concat([pd.DataFrame(list(done.values())), new], ignore_index=True) if done else new
allrows = allrows.drop_duplicates("ticker", keep="last")
for c in ["inst_pct", "insider_pct", "float_pct"]:
    allrows[c] = pd.to_numeric(allrows[c], errors="coerce").round(2)
allrows = allrows.sort_values("ticker")
allrows.to_csv(OUT, index=False, encoding="utf-8-sig")
cov = allrows[["inst_pct", "float_pct"]].notna().sum()
print(f"저장: {OUT} | 총 {len(allrows)}티커 | inst% 확보 {cov.inst_pct} · float% 확보 {cov.float_pct}")
