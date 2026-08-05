# -*- coding: utf-8 -*-
"""
Yahoo 백필: default ≥300M 티커 중 과거(pre-2021) 없는 것들을 채운다.
- 대상: OHLC 없음 OR DB 시작 >= 2021-12-01 (절단 + 데이터없음)
- 비파괴: 별도 sqlite(raw_data/ohlc_backfill.sqlite)에 저장. 기존 DB의 최소일보다
  이른 행만 저장(중복 방지). 접합부 종가비율로 조정기준 일치 확인/보정.
"""
import os, sys, sqlite3, time, numpy as np, pandas as pd, yfinance as yf
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

OHLC = r"C:\github_coding\terminal_sec\OHLC_data\ohlc_1d_watchlist.sqlite"
MCAP_CSV = r"C:\github_coding\terminal_sec\watch lists2_2026-05-11_914fc.csv"
OUT = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data\ohlc_backfill.sqlite"
START, ENDX = "2009-01-01", "2026-05-06"     # DB max=2026-05-05

# ---- 대상 산출
con = sqlite3.connect(f"file:{OHLC}?mode=ro", uri=True)
dbmin = pd.read_sql("SELECT Symbol, MIN(Datetime) mn FROM ohlc_1d GROUP BY Symbol", con)
minmap = dict(zip(dbmin.Symbol, dbmin.mn.str[:10]))
mc = pd.read_csv(MCAP_CSV)
mc = mc[mc["Market capitalization"] >= 300e6]
default300 = mc.Symbol.astype(str).tolist()
# 대상: OHLC 없음 OR DB 시작 > 2015-01-02 (절단 + 중간시작 + 데이터없음)
# 2015+ 연구창을 온전히 덮기 위해, 2015년 이후 시작하는 모든 종목을 백필 시도(진짜 IPO는 자동 무보완).
targets = [s for s in default300 if (s not in minmap) or (minmap[s] > "2015-01-02")]
print(f"default ≥300M: {len(default300)} | 백필 대상(2015+ 시작/없음): {len(targets)}")

# ---- 청크 다운로드
def fetch_chunk(syms):
    y = yf.download(syms, start=START, end=ENDX, progress=False,
                    auto_adjust=False, group_by="ticker", threads=True)
    return y

rows = []          # (Symbol, Datetime, Open, High, Low, Close, Volume)
stats = {"filled": 0, "no_pre": 0, "fail": 0, "seam_off": []}
CH = 80
for i in range(0, len(targets), CH):
    chunk = targets[i:i+CH]
    try:
        y = fetch_chunk(chunk)
    except Exception as e:
        print(f"  chunk {i} FAIL: {type(e).__name__}"); stats["fail"] += len(chunk); continue
    for s in chunk:
        try:
            d = y[s] if isinstance(y.columns, pd.MultiIndex) else y
            d = d.dropna(subset=["Close"])
            if len(d) == 0: stats["fail"] += 1; continue
            d = d.copy(); d.index = d.index.astype(str).str[:10]
            seam = minmap.get(s)          # 기존 DB 최소일 (없으면 None)
            if seam is not None:
                pre = d[d.index < seam]
                if len(pre) == 0: stats["no_pre"] += 1; continue   # 신규상장 등
                # 접합부 조정기준 보정
                ratio = 1.0
                if seam in d.index and d.loc[seam, "Close"] > 0:
                    ratio = float(pd.read_sql("SELECT Close FROM ohlc_1d WHERE Symbol=? AND Datetime LIKE ?",
                                  con, params=(s, seam+"%")).Close.iloc[0]) / float(d.loc[seam, "Close"])
                if abs(ratio - 1) > 0.03:
                    stats["seam_off"].append((s, round(ratio, 3)))
                    pre = pre.copy()
                    for c in ["Open","High","Low","Close"]: pre[c] = pre[c] * ratio
                    pre["Volume"] = pre["Volume"] / ratio
                add = pre
            else:
                add = d                    # DB에 아예 없음 → 전체
            for dt, r in add.iterrows():
                rows.append((s, dt, float(r.Open), float(r.High), float(r.Low),
                             float(r.Close), float(r.Volume)))
            stats["filled"] += 1
        except Exception:
            stats["fail"] += 1
    print(f"  {min(i+CH,len(targets))}/{len(targets)} 처리 | 누적행 {len(rows):,}")

# ---- 저장
os.makedirs(os.path.dirname(OUT), exist_ok=True)
if os.path.exists(OUT): os.remove(OUT)
w = sqlite3.connect(OUT)
w.execute("CREATE TABLE ohlc_1d (Symbol TEXT, Datetime TEXT, Open REAL, High REAL, Low REAL, Close REAL, Volume REAL)")
w.executemany("INSERT INTO ohlc_1d VALUES (?,?,?,?,?,?,?)", rows)
w.execute("CREATE INDEX ix ON ohlc_1d(Symbol, Datetime)")
w.commit()
nsym = w.execute("SELECT COUNT(DISTINCT Symbol) FROM ohlc_1d").fetchone()[0]
mn, mx = w.execute("SELECT MIN(Datetime), MAX(Datetime) FROM ohlc_1d").fetchone()
w.close()
print(f"\n=== 완료 ===")
print(f"  백필 종목: {stats['filled']} | 신규상장(과거없음): {stats['no_pre']} | 실패/미상장: {stats['fail']}")
print(f"  저장: {OUT}  | {len(rows):,}행, {nsym}종목, {mn[:10]}~{mx[:10]}")
if stats["seam_off"]:
    print(f"  ⚠ 접합비율 보정된 종목({len(stats['seam_off'])}): {stats['seam_off'][:20]}")
