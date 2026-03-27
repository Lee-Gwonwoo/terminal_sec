"""Validate v4 classifier: count types, check rules completeness, test sample classification."""
import sys, re

# Parse the v4 file to extract code up to iter_company_news_rows
with open("ai_research_tool/test_model2_company_news_analysis_v4.py", encoding="utf-8") as f:
    source = f.read()

# Extract just the CASE_META and rule definitions
code_block = source.split("def iter_company_news_rows")[0]
# Remove model2_case_analysis import (not needed for validation)
code_block = re.sub(r"from model2_case_analysis.*?\)", "", code_block, flags=re.DOTALL)
exec(compile(code_block, "<v4>", "exec"))

print(f"CASE_META types: {len(CASE_META)}")
print("Types:")
for i, k in enumerate(CASE_META.keys()):
    print(f"  {i+1}. {k}")

print(f"\nRule types in groups:")
types_in_rules = set()
for _, rules in CASE_RULE_GROUPS:
    for case_type, _ in rules:
        types_in_rules.add(case_type)
print(f"  unique types in rules: {len(types_in_rules)}")

missing = set(CASE_META.keys()) - types_in_rules - {"meaningless_others"}
print(f"  missing from rules: {missing or 'none'}")

extra = types_in_rules - set(CASE_META.keys())
print(f"  in rules but not in CASE_META: {extra or 'none'}")

# Test sample classifications
test_cases = [
    ("Applied Optoelectronics Q4 Adj. EPS $(0.01) Beats $(0.11) Estimate, Sales $134.274M Beat $134.120M Estimate", "", "BENZINGA"),
    ("Eos Energy Enterprises Sees FY2026 Sales $300.000M-$400.000M vs $479.283M Est", "", "BENZINGA"),
    ("Earnings Breakdown: Corning Q4 2024", "", "BENZINGA"),
    ("12 Health Care Stocks Moving In Monday's Pre-Market Session", "", "BENZINGA"),
    ("WK Kellogg Rallies Over 40% On Q4 Beat, Guidance Raise", "", "BENZINGA"),
    ("HC Wainwright Reiterates Buy on Applied Optoelectronics, Maintains $15 Price Target", "", "BENZINGA"),
    ("These Analysts Cut Their Forecasts On HIMS After Q4 Results", "", "BENZINGA"),
    ("What's Going On With Lucid Stock Today?", "", "BENZINGA"),
    ("Looking At Applied Optoelectronics' Recent Unusual Options Activity", "", "BENZINGA"),
    ("LITE had a Circuit Breaker To The Upside, Stock Now Up 67%", "", "CHARTMILL"),
    ("Corning And Meta Announce Up To $6B Multiyear Deal To Expand U.S. Data Center Infrastructure For AI", "", "Benzinga"),
    ("Dow Dips Over 150 Points; Earnings In Focus", "", "BENZINGA"),
    ("Market-Moving News for January 15", "", "BENZINGA"),
    ("Sector Update: Health Care Stocks Fall Monday Afternoon", "", "BENZINGA"),
    ("Morgan Stanley Says AI Build Still Underappreciated", "body text", "BENZINGA"),
    ("Hims & Hers Will Sell Novo Nordisk's Weight Loss Drugs On Its Platform", "", "BENZINGA"),
]

print("\n--- Sample Classifications ---")
for title, body, publisher in test_cases:
    result = classify_company_news(title, body, publisher=publisher)
    label_ko = CASE_META.get(result, {}).get("label_ko", "?")
    print(f"  [{result}] ({label_ko})")
    print(f"    title: {title[:80]}")
