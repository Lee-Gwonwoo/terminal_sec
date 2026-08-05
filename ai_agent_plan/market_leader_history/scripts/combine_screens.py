# -*- coding: utf-8 -*-
"""cohort 스케일 2주 z-리더 + cohort 스케일 4주 대상승(+60%) 을 하나로 결합.
   월×티커 중복 없음(둘 다 걸리면 1행, screens='both'), inst≥90 제외.
   입력: market_leader_monthly_cohortscaled.csv, market_leader_bigmovers_4w_cohortscaled.csv"""
import os, sys, pandas as pd
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
RAW = r"C:\github_coding\terminal_sec\ai_agent_plan\market_leader_history\raw_data"

a = pd.read_csv(os.path.join(RAW, "market_leader_monthly_cohortscaled.csv"))    # 2주 z-리더
b = pd.read_csv(os.path.join(RAW, "market_leader_bigmovers_4w_cohortscaled.csv"))# 4주 대상승
a = a.assign(in_z2w=True)[["month","ticker","z_win","ret_2w_pct","window_start","window_end",
    "mcap_at_start","turnover_min","mcap_bucket","sector","industry","inst_pct","float_pct",
    "market_cap_now","in_z2w"]].rename(columns={"window_start":"w2_start","window_end":"w2_end"})
b = b.assign(in_big4w=True)[["month","ticker","ret_4w_pct","window_start","window_end",
    "mcap_at_start","turnover_min","mcap_bucket","sector","industry","inst_pct","float_pct",
    "market_cap_now","in_big4w"]].rename(columns={"window_start":"w4_start","window_end":"w4_end"})

m = pd.merge(a, b, on=["month","ticker"], how="outer", suffixes=("_2w","_4w"))
m["in_z2w"] = m.in_z2w.fillna(False).astype(bool); m["in_big4w"] = m.in_big4w.fillna(False).astype(bool)
m["screens"] = m.apply(lambda r: "both" if (r.in_z2w and r.in_big4w)
                       else ("z2w" if r.in_z2w else "big4w"), axis=1)
# 공유(티커/윈도우 무관) 컬럼은 2주 우선, 없으면 4주로 coalesce
for c in ["mcap_at_start","turnover_min","mcap_bucket","sector","industry",
          "inst_pct","float_pct","market_cap_now"]:
    m[c] = m[c+"_2w"].where(m[c+"_2w"].notna(), m[c+"_4w"])

cols = ["month","ticker","screens","z_win","ret_2w_pct","ret_4w_pct",
        "mcap_at_start","mcap_bucket","turnover_min","inst_pct","float_pct",
        "sector","industry","w2_start","w2_end","w4_start","w4_end","market_cap_now"]
comb = m[cols].sort_values(["month","ret_4w_pct","z_win"],
                           ascending=[False,False,False], na_position="last").reset_index(drop=True)

full = os.path.join(RAW, "market_leader_cohort_combined.csv")
comb.to_csv(full, index=False, encoding="utf-8-sig")
lt90 = comb[~(comb.inst_pct >= 90)]        # inst>=90 제외 (결측 유지)
p90 = os.path.join(RAW, "market_leader_cohort_combined_inst_lt90.csv")
lt90.to_csv(p90, index=False, encoding="utf-8-sig")

def stat(d, name):
    sc = d.screens.value_counts().to_dict()
    print(f"  {name}: {len(d)}행 | 유니크티커 {d.ticker.nunique()} | screens {sc}")
print(f"입력: 2주 {len(a)}행 + 4주 {len(b)}행")
stat(comb, "결합(full)      ")
stat(lt90, "결합 inst<90     ")
print(f"저장: {os.path.basename(full)} , {os.path.basename(p90)}")
print("\n=== inst<90 최근월 상위 예시 ===")
print(lt90[lt90.month>='2026-01'].head(10)[["month","ticker","screens","z_win","ret_2w_pct","ret_4w_pct","inst_pct","float_pct"]].to_string(index=False))
