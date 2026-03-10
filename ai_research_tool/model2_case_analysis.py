import argparse
import json
import math
import re
import sqlite3
from contextlib import suppress
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from statistics import median


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * pct
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
      return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def wilson_lower_bound(successes: int, total: int, z: float = 1.96) -> float:
    if total == 0:
        return 0.0
    phat = successes / total
    denominator = 1 + z * z / total
    centre = phat + z * z / (2 * total)
    margin = z * math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total)
    return (centre - margin) / denominator


@dataclass(frozen=True)
class CategoryRule:
    name: str
    label_ko: str
    description_ko: str
    patterns: tuple[str, ...]


CATEGORY_RULES: tuple[CategoryRule, ...] = (
    CategoryRule(
        "clinical_regulatory_negative",
        "임상·규제 실패",
        "임상 실패, CRL, 주요 endpoint 미충족, hold·중단 등 바이오 규제/임상 악재",
        (
            r"\bcomplete response letter\b",
            r"\bcrl\b",
            r"\bfailed? to meet\b",
            r"\bdid not meet\b",
            r"\bmissed primary\b",
            r"\bclinical hold\b",
            r"\bdiscontinu(?:e|ed|ation)?\b",
            r"\bterminat(?:e|ed|ion)\b",
            r"\bnegative topline\b",
            r"\bsetback\b",
            r"\badverse\b",
        ),
    ),
    CategoryRule(
        "clinical_regulatory_positive",
        "임상·규제 성공",
        "positive topline, phase trial data, NDA/BLA acceptance, approval 같은 바이오 임상·규제 호재",
        (
            r"\bpositive topline\b",
            r"\btopline results\b",
            r"\bphase [1234]\b",
            r"\bphase i/ii\b",
            r"\bphase 2b\b",
            r"\bstudy\b",
            r"\btrial\b",
            r"\bfda acceptance\b",
            r"\bacceptance of nda\b",
            r"\bapproval\b",
            r"\bpivotal\b",
            r"\befficacy\b",
            r"\bclinical results\b",
        ),
    ),
    CategoryRule(
        "earnings_guidance_negative",
        "실적 부진·가이던스 하향",
        "miss, lower guidance, weak outlook, revenue decline 등 실적성 악재",
        (
            r"\bmiss(?:es|ed)?\b",
            r"\blower(?:ed|s)? guidance\b",
            r"\bcuts? guidance\b",
            r"\bweak outlook\b",
            r"\brevenue decline\b",
            r"\bprofit warning\b",
            r"\bloss widens\b",
            r"\bbelow expectations\b",
        ),
    ),
    CategoryRule(
        "earnings_guidance_positive",
        "실적 호조·가이던스 상향",
        "beat, raises guidance, strong outlook, record revenue 등 실적성 호재",
        (
            r"\bbeat(?:s|ing)?\b",
            r"\braises? guidance\b",
            r"\bstrong outlook\b",
            r"\brecord revenue\b",
            r"\bbetter-than-expected\b",
            r"\btop and bottom line beat\b",
            r"\bprofit increases?\b",
        ),
    ),
    CategoryRule(
        "strategic_review_restructuring",
        "전략대안·구조조정·생존성",
        "strategic alternatives, restructuring, going concern, layoffs 등 사업 지속성/재편 이슈",
        (
            r"\bstrategic alternatives\b",
            r"\brestructur(?:e|ing)\b",
            r"\bcost reduction\b",
            r"\bworkforce reduction\b",
            r"\blayoff\b",
            r"\bgoing concern\b",
            r"\bbankruptcy\b",
            r"\bchapter 11\b",
            r"\bdelist(?:ing)?\b",
            r"\bnon-?compliance\b",
            r"\bdefault\b",
        ),
    ),
    CategoryRule(
        "financing_offering",
        "희석성 자금조달·오퍼링",
        "public offering, private placement, warrants, notes, financing, refinancing 등 자본조달 이슈",
        (
            r"\bpublic offering\b",
            r"\bproposed public offering\b",
            r"\bpricing of .*offering\b",
            r"\bunderwritten offering\b",
            r"\bprivate placement\b",
            r"\bregistered direct\b",
            r"\bpre-funded warrant\b",
            r"\bcommon stock\b",
            r"\bnotes offering\b",
            r"\brefinancing\b",
            r"\bnon-dilutive funding\b",
            r"\bfinancing\b",
        ),
    ),
    CategoryRule(
        "litigation_investigation",
        "소송·조사·회계 이슈",
        "lawsuit, subpoena, investigation, restatement, fraud allegation 등 법률/회계 리스크",
        (
            r"\blawsuit\b",
            r"\bsubpoena\b",
            r"\binvestigation\b",
            r"\brestatement\b",
            r"\bsec probe\b",
            r"\bclass action\b",
            r"\bfraud\b",
            r"\bdoj\b",
        ),
    ),
    CategoryRule(
        "strategic_deal_policy",
        "전략 제휴·라이선스·정부지원·대형 계약",
        "partnership, collaboration, license, acquisition, government investment, permit, contract, award 등 외부 자원 연결 이슈",
        (
            r"\bpartnership\b",
            r"\bcollaboration\b",
            r"\bagreement\b",
            r"\blicense\b",
            r"\bexclusive global license\b",
            r"\bacquisition\b",
            r"\bmerger\b",
            r"\bstrategic investment\b",
            r"\bfederal government\b",
            r"\bgovernment\b",
            r"\bpermit\b",
            r"\baward\b",
            r"\bcontract\b",
            r"\bgrant\b",
        ),
    ),
    CategoryRule(
        "analyst_rating_target",
        "애널리스트 의견·목표가",
        "upgrade, downgrade, price target, initiated coverage 등 sell-side 의견 변화",
        (
            r"\bupgrade\b",
            r"\bdowngrade\b",
            r"\bprice target\b",
            r"\binitiated\b",
            r"\bcoverage\b",
            r"\bmaintains?\b",
            r"\btarget raised\b",
            r"\btarget cut\b",
        ),
    ),
    CategoryRule(
        "listing_capital_markets",
        "상장·직상장·자본시장 구조 이벤트",
        "direct listing, uplisting, Nasdaq listing, market debut 같은 상장 구조 이벤트",
        (
            r"\bdirect listing\b",
            r"\bsuccessful direct listing\b",
            r"\buplist(?:ing)?\b",
            r"\blisted on\b",
            r"\bmarket debut\b",
            r"\btrading halt\b",
            r"\btrade resumption\b",
        ),
    ),
    CategoryRule(
        "commercial_launch_expansion",
        "상업화·시설·사업 확장",
        "launch, facility, operations, expansion, production, commercialization 등 사업 확장성 이벤트",
        (
            r"\blaunch\b",
            r"\bfacility\b",
            r"\boperations\b",
            r"\bexpands\b",
            r"\bexpansion\b",
            r"\bcommercial\b",
            r"\bproduction\b",
            r"\bmanufacturing\b",
            r"\bgrowth\b",
        ),
    ),
    CategoryRule(
        "macro_policy_sector",
        "정책·관세·섹터 매크로",
        "tariff, policy, export control, inflation, rates 등 종목 외부 매크로/정책 이슈",
        (
            r"\btariff\b",
            r"\bpolicy\b",
            r"\bexport control\b",
            r"\binterest rates?\b",
            r"\binflation\b",
            r"\bfed\b",
            r"\bsanction\b",
            r"\bgeopolitical\b",
        ),
    ),
)


def cap_bucket(market_cap: float | None) -> str:
    if market_cap is None:
        return "below_300m_or_unknown"
    if market_cap < 300_000_000:
        return "below_300m_or_unknown"
    if market_cap < 1_000_000_000:
        return "cap_300m_1b"
    if market_cap < 100_000_000_000:
        return "cap_1b_100b"
    return "cap_100b_plus"


def cap_bucket_label(bucket: str) -> str:
    return {
        "below_300m_or_unknown": "<$300M or Unknown",
        "cap_300m_1b": "$300M-<$1B",
        "cap_1b_100b": "$1B-<$100B",
        "cap_100b_plus": ">$=100B",
    }[bucket]


def first_ticker(tickers_csv: str | None) -> str | None:
    if not tickers_csv:
        return None
    parts = [part.strip().upper() for part in tickers_csv.split(",") if part.strip()]
    return parts[0] if parts else None


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def classify_case(title: str, body: str, full_text: str) -> str:
    text = normalize_text(title, body)
    if not text.strip():
        text = normalize_text(title, body, full_text)
    for rule in CATEGORY_RULES:
        if any(re.search(pattern, text) for pattern in rule.patterns):
            return rule.name
    return "general_corporate_pr"


def category_meta(name: str) -> tuple[str, str]:
    for rule in CATEGORY_RULES:
        if rule.name == name:
            return rule.label_ko, rule.description_ko
    return ("일반 corporate PR", "conference, publication, appointment, facility update 등 일반 PR성 공지")


def load_latest_market_caps(conn: sqlite3.Connection) -> dict[str, float]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    rows = cur.execute(
        """
        WITH latest_market_cap AS (
          SELECT s.ticker,
                 cp.market_cap,
                 ROW_NUMBER() OVER (PARTITION BY s.ticker ORDER BY cp.fetched_at DESC, cp.id DESC) AS rn
          FROM securities s
          JOIN company_profiles cp ON cp.security_id = s.id
          WHERE cp.market_cap IS NOT NULL
        )
        SELECT ticker, market_cap
        FROM latest_market_cap
        WHERE rn = 1
        """
    ).fetchall()
    return {str(row["ticker"]).upper(): float(row["market_cap"]) for row in rows}


def fetch_news_rows(conn: sqlite3.Connection, since: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT ni.id,
               ni.published_at,
               ni.source_type,
               ni.title,
               ni.body,
               ni.tickers_csv,
               nf.full_text,
               MAX(CASE WHEN m.metric_key='change_pct' THEN m.value_pct END) AS change_pct,
               MAX(CASE WHEN m.metric_key='change_1d_pct' THEN m.value_pct END) AS change_1d_pct,
               MAX(CASE WHEN m.metric_key='change_from_open_pct' THEN m.value_pct END) AS change_from_open_pct,
               MAX(CASE WHEN m.metric_key='change_open_to_high_pct' THEN m.value_pct END) AS change_open_to_high_pct,
               MAX(CASE WHEN m.metric_key='change_3d_pct' THEN m.value_pct END) AS change_3d_pct,
               MAX(CASE WHEN m.metric_key='change_7d_pct' THEN m.value_pct END) AS change_7d_pct,
               MAX(CASE WHEN m.metric_key='change_14d_pct' THEN m.value_pct END) AS change_14d_pct,
               MAX(CASE WHEN m.metric_key='change_30d_pct' THEN m.value_pct END) AS change_30d_pct
        FROM news_items ni
        LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
        LEFT JOIN news_change_metrics m ON m.news_id = ni.id
        WHERE ni.published_at >= ?
          AND ni.source_type = 'press_release'
        GROUP BY ni.id
        """,
        (since,),
    ).fetchall()
    return [dict(row) for row in rows]


def score_from_values(values: tuple[float | None, ...]) -> float | None:
    candidates = [abs(value) for value in values if isinstance(value, (int, float))]
    return max(candidates) if candidates else None


def immediate_reaction_score(row: dict) -> float | None:
    return score_from_values(
        (
            row.get("change_from_open_pct"),
            row.get("change_open_to_high_pct"),
            row.get("change_pct"),
        )
    )


def short_followthrough_score(row: dict) -> float | None:
    return score_from_values((row.get("change_1d_pct"), row.get("change_3d_pct")))


def medium_persistence_score(row: dict) -> float | None:
    return score_from_values((row.get("change_7d_pct"), row.get("change_14d_pct"), row.get("change_30d_pct")))


def overall_impact_score(row: dict) -> float | None:
    return score_from_values(
        (
            row.get("immediate_reaction_score"),
            row.get("short_followthrough_score"),
            row.get("medium_persistence_score"),
        )
    )


def reaction_tag(row: dict, threshold: float | None) -> str:
    immediate = row.get("immediate_reaction_score") or 0.0
    short = row.get("short_followthrough_score") or 0.0
    medium = row.get("medium_persistence_score") or 0.0
    if threshold is None:
        return "unclassified"
    immediate_strong = immediate >= threshold
    short_strong = short >= threshold
    medium_strong = medium >= threshold
    strong_count = sum((immediate_strong, short_strong, medium_strong))
    if strong_count >= 2:
        return "multi_window_impact"
    if immediate_strong and not short_strong and not medium_strong:
        return "intraday_only"
    if short_strong and not immediate_strong and not medium_strong:
        return "delayed_followthrough"
    if medium_strong and not immediate_strong and not short_strong:
        return "sustained_repricing"
    if immediate_strong and not short_strong and medium < threshold:
        return "one_day_spike_then_fade"
    return "low_signal"


def direction_from_primary_metrics(row: dict) -> tuple[str, str | None, float | None]:
    candidates = [
        ("change_30d_pct", row.get("change_30d_pct")),
        ("change_14d_pct", row.get("change_14d_pct")),
        ("change_7d_pct", row.get("change_7d_pct")),
        ("change_3d_pct", row.get("change_3d_pct")),
        ("change_1d_pct", row.get("change_1d_pct")),
        ("change_pct", row.get("change_pct")),
        ("change_from_open_pct", row.get("change_from_open_pct")),
        ("change_open_to_high_pct", row.get("change_open_to_high_pct")),
    ]
    valid = [(name, value) for name, value in candidates if isinstance(value, (int, float))]
    if not valid:
        return ("unknown", None, None)
    metric_name, metric_value = max(valid, key=lambda item: abs(item[1]))
    if metric_value > 0:
        return ("up", metric_name, metric_value)
    if metric_value < 0:
        return ("down", metric_name, metric_value)
    return ("flat", metric_name, metric_value)


def percentile_meta(values: list[float]) -> dict[str, float | None]:
    return {
        "count": len(values),
        "p50": percentile(values, 0.50),
        "p80": percentile(values, 0.80),
        "p90": percentile(values, 0.90),
        "p95": percentile(values, 0.95),
    }


def summarize_cases(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["case_type"]].append(row)

    case_summaries = []
    for case_type, items in grouped.items():
        total = len(items)
        impacted_items = [item for item in items if item.get("is_impacted")]
        impacted = len(impacted_items)
        positive = sum(1 for item in impacted_items if item["direction"] == "up")
        negative = sum(1 for item in impacted_items if item["direction"] == "down")
        label_ko, description_ko = category_meta(case_type)
        bucket_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
        source_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
        for item in items:
            bucket_breakdown[item["market_cap_bucket"]]["total"] += 1
            source_breakdown[item["source_type"]]["total"] += 1
            if item.get("is_impacted"):
                bucket_breakdown[item["market_cap_bucket"]]["impacted"] += 1
                source_breakdown[item["source_type"]]["impacted"] += 1

        top_examples = sorted(
            items,
            key=lambda item: item["impact_score"] if item["impact_score"] is not None else -1,
            reverse=True,
        )[:5]
        neutral_examples = sorted(
            [item for item in items if not item.get("is_impacted")],
            key=lambda item: item["impact_score"] if item["impact_score"] is not None else 10**9,
        )[:3]
        case_summaries.append(
            {
                "case_type": case_type,
                "label_ko": label_ko,
                "description_ko": description_ko,
                "total": total,
                "impacted": impacted,
                "not_impacted": total - impacted,
                "impact_ratio": impacted / total if total else 0.0,
                "impact_ratio_wilson_lb": wilson_lower_bound(impacted, total),
                "positive_impacted": positive,
                "negative_impacted": negative,
                "median_impact_score": median([item["impact_score"] for item in items if item["impact_score"] is not None]),
                "bucket_breakdown": {
                    cap_bucket_label(bucket): values for bucket, values in bucket_breakdown.items()
                },
                "source_breakdown": dict(source_breakdown),
                "top_examples": [
                    {
                        "news_id": item["id"],
                        "date": item["published_at"],
                        "ticker": item["ticker"],
                        "source_type": item["source_type"],
                        "title": item["title"],
                        "change_pct": item["change_pct"],
                        "change_3d_pct": item["change_3d_pct"],
                        "change_7d_pct": item["change_7d_pct"],
                        "change_1d_pct": item["change_1d_pct"],
                        "change_from_open_pct": item["change_from_open_pct"],
                        "reaction_tag": item["reaction_tag"],
                        "market_cap_bucket": cap_bucket_label(item["market_cap_bucket"]),
                    }
                    for item in top_examples
                ],
                "counter_examples": [
                    {
                        "news_id": item["id"],
                        "date": item["published_at"],
                        "ticker": item["ticker"],
                        "source_type": item["source_type"],
                        "title": item["title"],
                        "change_pct": item["change_pct"],
                        "change_3d_pct": item["change_3d_pct"],
                        "change_7d_pct": item["change_7d_pct"],
                        "change_1d_pct": item["change_1d_pct"],
                        "change_from_open_pct": item["change_from_open_pct"],
                        "reaction_tag": item["reaction_tag"],
                        "market_cap_bucket": cap_bucket_label(item["market_cap_bucket"]),
                    }
                    for item in neutral_examples
                ],
            }
        )

    case_summaries.sort(
        key=lambda item: (item["impact_ratio_wilson_lb"], item["impacted"], item["total"]),
        reverse=True,
    )
    return case_summaries


def estimate_tokens(rows: list[dict]) -> dict:
    total_chars = 0
    for row in rows:
        total_chars += len((row.get("title") or ""))
        total_chars += len((row.get("body") or ""))
        total_chars += len((row.get("full_text") or ""))
    raw_input_tokens = round(total_chars / 4)
    article_count = len(rows)
    prompt_overhead_per_article = 180
    output_per_article = 120
    estimated_total_tokens = raw_input_tokens + article_count * (prompt_overhead_per_article + output_per_article)
    return {
        "article_count": article_count,
        "total_chars": total_chars,
        "raw_input_tokens_estimate": raw_input_tokens,
        "assumed_prompt_overhead_per_article": prompt_overhead_per_article,
        "assumed_output_tokens_per_article": output_per_article,
        "estimated_total_tokens_naive_article_by_article": estimated_total_tokens,
    }


def build_analysis(rows: list[dict], market_caps: dict[str, float]) -> dict:
    analyzable = []
    scores_by_bucket: dict[str, list[float]] = defaultdict(list)
    source_counts = Counter()
    source_with_change = Counter()
    bucket_counts = Counter()
    bucket_with_change = Counter()
    source_with_fulltext = Counter()

    for row in rows:
        ticker = first_ticker(row.get("tickers_csv"))
        row["ticker"] = ticker
        row["market_cap"] = market_caps.get(ticker) if ticker else None
        row["market_cap_bucket"] = cap_bucket(row.get("market_cap"))
        row["immediate_reaction_score"] = immediate_reaction_score(row)
        row["short_followthrough_score"] = short_followthrough_score(row)
        row["medium_persistence_score"] = medium_persistence_score(row)
        row["impact_score"] = overall_impact_score(row)
        direction, direction_metric, direction_value = direction_from_primary_metrics(row)
        row["direction"] = direction
        row["direction_metric"] = direction_metric
        row["direction_value"] = direction_value
        row["case_type"] = classify_case(row.get("title") or "", row.get("body") or "", row.get("full_text") or "")
        row["has_fulltext"] = bool(row.get("full_text"))

        source_counts[row["source_type"]] += 1
        bucket_counts[row["market_cap_bucket"]] += 1
        if row["has_fulltext"]:
            source_with_fulltext[row["source_type"]] += 1
        if row["impact_score"] is not None:
            scores_by_bucket[row["market_cap_bucket"]].append(row["impact_score"])
            analyzable.append(row)
            source_with_change[row["source_type"]] += 1
            bucket_with_change[row["market_cap_bucket"]] += 1

    thresholds = {}
    for bucket, values in scores_by_bucket.items():
        thresholds[bucket] = percentile_meta(values)

    overall_p80 = percentile([row["impact_score"] for row in analyzable if row["impact_score"] is not None], 0.80) or 0.0

    for row in analyzable:
        bucket = row["market_cap_bucket"]
        threshold = thresholds.get(bucket, {}).get("p80") or overall_p80
        row["impact_threshold"] = threshold
        row["is_impacted"] = bool(row["impact_score"] is not None and row["impact_score"] >= threshold)
        row["reaction_tag"] = reaction_tag(row, threshold)

    case_summaries = summarize_cases(analyzable)
    bucket_summaries = {
        bucket: summarize_cases([row for row in analyzable if row["market_cap_bucket"] == bucket])
        for bucket in ("cap_300m_1b", "cap_1b_100b", "cap_100b_plus", "below_300m_or_unknown")
    }

    source_summary = []
    for source_type, total in sorted(source_counts.items()):
        source_summary.append(
            {
                "source_type": source_type,
                "total": total,
                "with_change": source_with_change.get(source_type, 0),
                "with_fulltext": source_with_fulltext.get(source_type, 0),
            }
        )

    bucket_summary = []
    for bucket in ("cap_300m_1b", "cap_1b_100b", "cap_100b_plus", "below_300m_or_unknown"):
        bucket_summary.append(
            {
                "bucket": bucket,
                "label": cap_bucket_label(bucket),
                "total": bucket_counts.get(bucket, 0),
                "with_change": bucket_with_change.get(bucket, 0),
                "thresholds": thresholds.get(bucket),
            }
        )

    return {
        "thresholds": thresholds,
        "analyzable_rows": len(analyzable),
        "total_rows": len(rows),
        "source_summary": source_summary,
        "bucket_summary": bucket_summary,
        "case_summaries": case_summaries,
        "bucket_case_summaries": bucket_summaries,
        "token_estimate": estimate_tokens(rows),
    }


def format_float(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2f}"


def slugify_note_title(title: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "", title).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "model_2_case_analysis"


def resolve_note_title(conn: sqlite3.Connection, page_id: str, override_title: str) -> str:
    if override_title:
        return override_title
    if not page_id:
        return "Model 2 press_release case analysis"
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT title FROM research_pages WHERE id = ?", (page_id,)).fetchone()
    if row and row["title"]:
        return str(row["title"])
    return "Model 2 press_release case analysis"


def write_evidence_markdown(evidence_path: Path, rows: list[dict]) -> None:
    lines = [
        "# Model 2 Case Evidence Table",
        "",
        "이 파일은 해당 Model 2 note와 같은 제목 기준으로 생성된 근거 표다.",
        "",
        "- source 범위: `press_release only`",
        "- 각 행은 유형 분류 또는 대표/반례 판단의 근거로 사용된 뉴스 1건이다.",
        "- 같은 note 제목 기준 파일이며, note 본문에서 이 경로를 그대로 참조해야 한다.",
        "",
        "| case_type | reaction_tag | news_id | published_at | source_type | ticker | market_cap | market_cap_bucket | change_pct | change_from_open_pct | change_open_to_high_pct | change_1d_pct | change_3d_pct | change_7d_pct | change_14d_pct | change_30d_pct | immediate_reaction_score | short_followthrough_score | medium_persistence_score | overall_impact_score | title |",
        "|-----------|--------------|---------|--------------|-------------|--------|------------|-------------------|------------|----------------------|--------------------------|---------------|---------------|---------------|----------------|----------------|--------------------------|---------------------------|--------------------------|----------------------|-------|",
    ]
    for row in rows:
        title = (row.get("title") or "").replace("|", "\\|").replace("\n", " ")
        market_cap = row.get("market_cap")
        lines.append(
            "| {case_type} | {reaction_tag} | {news_id} | {published_at} | {source_type} | {ticker} | {market_cap} | {market_cap_bucket} | {change_pct} | {change_from_open_pct} | {change_open_to_high_pct} | {change_1d_pct} | {change_3d_pct} | {change_7d_pct} | {change_14d_pct} | {change_30d_pct} | {immediate_reaction_score} | {short_followthrough_score} | {medium_persistence_score} | {impact_score} | {title} |".format(
                case_type=row.get("case_type") or "",
                reaction_tag=row.get("reaction_tag") or "",
                news_id=row.get("id") or "",
                published_at=row.get("published_at") or "",
                source_type=row.get("source_type") or "",
                ticker=row.get("ticker") or "",
                market_cap=format_float(market_cap) if isinstance(market_cap, (int, float)) else "Unknown",
                market_cap_bucket=cap_bucket_label(row.get("market_cap_bucket") or "below_300m_or_unknown"),
                change_pct=format_float(row.get("change_pct")),
                change_from_open_pct=format_float(row.get("change_from_open_pct")),
                change_open_to_high_pct=format_float(row.get("change_open_to_high_pct")),
                change_1d_pct=format_float(row.get("change_1d_pct")),
                change_3d_pct=format_float(row.get("change_3d_pct")),
                change_7d_pct=format_float(row.get("change_7d_pct")),
                change_14d_pct=format_float(row.get("change_14d_pct")),
                change_30d_pct=format_float(row.get("change_30d_pct")),
                immediate_reaction_score=format_float(row.get("immediate_reaction_score")),
                short_followthrough_score=format_float(row.get("short_followthrough_score")),
                medium_persistence_score=format_float(row.get("medium_persistence_score")),
                impact_score=format_float(row.get("impact_score")),
                title=title,
            )
        )
    evidence_path.write_text("\n".join(lines), encoding="utf-8")


def make_markdown(since: str, until: str, analysis: dict, evidence_path: Path, note_title: str) -> str:
    lines: list[str] = []
    lines.append(f"# {note_title}")
    lines.append("")
    lines.append(f"- 생성 시각: {datetime.now().strftime('%Y-%m-%d %H:%M')} (local)")
    lines.append(f"- 분석 범위: `press_release only` / `{since} ~ {until}`")
    lines.append(f"- 전체 뉴스 수: {analysis['total_rows']:,}")
    lines.append(f"- change 기반 분석 가능 뉴스 수: {analysis['analyzable_rows']:,}")
    lines.append("")
    lines.append("## 분석 범위")
    lines.append("")
    lines.append("- source 범위는 `press_release only`로 고정했다.")
    lines.append("- 기간 내 `press_release` 전체를 1차 전수 스캔하고, 각 row에 ticker, market cap, change vector를 붙였다.")
    lines.append("- 외부 링크는 다시 열지 않고 `news_items`, `news_fulltext`, `news_change_metrics`, `company_profiles.market_cap`만 사용했다.")
    lines.append("")
    lines.append("## 유형 분류 기준")
    lines.append("")
    lines.append("- `title/body/full_text`에서 반복되는 표현을 기준으로 case 유형을 묶었다.")
    lines.append("- 의미가 크게 다른 바이오 positive / negative, financing, litigation, earnings, strategic deal 등은 분리했다.")
    lines.append("- 애매한 표현은 대표 사례와 반례를 비교해 가장 설명력이 높은 유형으로 귀속했다.")
    lines.append("")
    lines.append("## 영향 판정 기준")
    lines.append("")
    lines.append("- 사용한 전체 change vector: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`")
    lines.append("- `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`")
    lines.append("- `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`")
    lines.append("- `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`")
    lines.append("- `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`")
    lines.append("- 영향 여부는 같은 market cap bucket 안에서 `overall_impact_score >= p80` 인지로 판정했다.")
    lines.append("")
    lines.append("## market cap bucket 기준")
    lines.append("")
    lines.append("- 주 버킷: `300M~<1B`, `1B~<100B`, `100B~`")
    lines.append("- 보조 집단: `<300M or Unknown`")
    lines.append("- 소형주와 대형주를 같은 절대 변동폭 기준으로 자르면 과대/과소 판정이 생기므로 bucket별 threshold를 분리했다.")
    lines.append("")
    lines.append("## 내부 사고과정 로그(주요 판단 요약)")
    lines.append("")
    lines.append("1. 판단 대상: source 범위")
    lines.append("   - 검토한 데이터/패턴: `press_release`, `news`, `company_news`, `market_news`를 섞으면 재서술 기사와 commentary가 늘어나 case 기준이 흐려진다.")
    lines.append("   - 최종 결정: 이번 note는 `press_release only`로 고정했다.")
    lines.append("   - 결정 이유: issuer-driven 이벤트 위주로 먼저 taxonomy를 만들면 유형별 가격 반응 연결이 더 직접적이다.")
    lines.append("   - 대표 근거: 발행사 직접 공지 형식의 PR들이 동일 키워드 반복성과 후행 반응 측면에서 가장 일관적이었다.")
    lines.append("2. 판단 대상: 영향 점수 정의")
    lines.append("   - 검토한 데이터/패턴: 당일 반응만 보면 지연형 뉴스 효과를 놓치고, 7d~30d만 보면 intraday spike를 놓친다.")
    lines.append("   - 최종 결정: immediate / short / medium 3구간 점수를 따로 만들고, 최종값은 `overall_impact_score`로 종합했다.")
    lines.append("   - 결정 이유: 같은 PR이라도 당일 급등형, 1~3일 추세형, 1~4주 재평가형이 모두 존재했기 때문이다.")
    lines.append("   - 대표 근거 뉴스: 상위 사례 표와 근거 표 파일의 각 row에서 3d, 7d, 14d, 30d 반응 차이를 추적했다.")
    lines.append("3. 판단 대상: market cap threshold")
    lines.append("   - 검토한 데이터/패턴: 소형주는 같은 PR에도 절대 변동폭이 크고, 대형주는 작은 변동으로도 의미가 생긴다.")
    lines.append("   - 최종 결정: `300M~<1B`, `1B~<100B`, `100B~`를 주 버킷으로 나눠 각 버킷별 `p80`을 threshold로 사용했다.")
    lines.append("   - 결정 이유: 전 뉴스 공통 절대값 컷오프는 소형주 과대판정과 대형주 과소판정을 동시에 만든다.")
    lines.append("   - 대표 근거 뉴스: 같은 유형이어도 cap bucket이 다르면 `overall_impact_score` 분포가 다르게 나타났다.")
    lines.append("4. 판단 대상: case taxonomy 구성")
    lines.append("   - 검토한 데이터/패턴: 임상/규제, financing, earnings, litigation, strategic deal, general PR가 반복적으로 출현했다.")
    lines.append("   - 최종 결정: 방향성이 반대인 임상 positive/negative는 분리하고, 의미가 지나치게 넓은 일반 PR은 잔여 범주로 남겼다.")
    lines.append("   - 결정 이유: positive/negative를 합치면 case ratio 해석이 왜곡되고, 너무 세분화하면 각 유형의 표본수가 깨진다.")
    lines.append("   - 대표 근거 뉴스 id / ticker / title: 각 case의 대표 사례와 반례를 같이 비교해 경계선을 정했다.")
    lines.append("5. 판단 대상: 제외 및 보조 집단 처리")
    lines.append("   - 검토한 데이터/패턴: `market_cap`이 없거나 `$300M` 미만인 row, change metric이 없는 row가 일부 존재한다.")
    lines.append("   - 최종 결정: `<300M or Unknown`은 보조 집단으로 분리하고, change metric이 없는 row는 비율 계산에서 제외했다.")
    lines.append("   - 결정 이유: 동일 bucket 분포 기준이 무너지면 threshold와 ratio 해석이 불안정해진다.")
    lines.append("   - 대표 근거: 데이터 가용성 표와 bucket별 threshold 표에서 보조 집단의 밀도 차이가 확인된다.")
    lines.append("")
    lines.append("## 근거 표 파일")
    lines.append("")
    lines.append(f"- 근거 표 파일 경로: `{evidence_path}`")
    lines.append("- 이 파일은 현재 note와 같은 제목 기준으로 만든 전체 근거 뉴스 표다.")
    lines.append("- 각 행에는 case_type, reaction_tag, news_id, ticker, market_cap, 전체 change window, 구간 점수, overall score를 기록했다.")
    lines.append("")
    lines.append("## 데이터 가용성")
    lines.append("")
    for source in analysis["source_summary"]:
        lines.append(
            f"- {source['source_type']}: total={source['total']:,}, with_change={source['with_change']:,}, with_fulltext={source['with_fulltext']:,}"
        )
    lines.append("")
    lines.append("## 영향 판정 기준")
    lines.append("")
    lines.append("- 사용한 전체 change 컬럼: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`")
    lines.append("- `overall_impact_score`는 immediate / short / medium 3개 구간 점수 중 최대값으로 계산했다.")
    lines.append("- 방향성은 절대값이 가장 큰 change 컬럼의 부호로 결정했다.")
    lines.append("- 같은 이슈라도 시총이 크면 변동폭이 줄 수 있으므로, 버킷별 p80 임계값을 따로 사용했다.")
    lines.append("")
    lines.append("## market cap bucket별 impact 기준")
    lines.append("")
    for item in analysis["bucket_summary"]:
        meta = item.get("thresholds")
        lines.append(
            f"- {item['label']}: total={item['total']:,}, with_change={item['with_change']:,}, p50={format_float(meta['p50']) if meta else 'n/a'}, p80={format_float(meta['p80']) if meta else 'n/a'}, p90={format_float(meta['p90']) if meta else 'n/a'}"
        )
    lines.append("")
    lines.append("## 전체 유형 분류 결과")
    lines.append("")
    for index, summary in enumerate(analysis["case_summaries"][:12], start=1):
        lines.append(f"### {index}. {summary['label_ko']}")
        lines.append(f"- 설명: {summary['description_ko']}")
        lines.append(f"- 총 건수: {summary['total']:,}")
        lines.append(f"- 영향 미침: {summary['impacted']:,}")
        lines.append(f"- 영향 안 미침: {summary['not_impacted']:,}")
        lines.append(f"- 영향 비율: {summary['impact_ratio']:.3f}")
        lines.append(f"- 보수적 순위 점수(Wilson LB): {summary['impact_ratio_wilson_lb']:.3f}")
        lines.append(f"- 방향 분해: positive {summary['positive_impacted']:,} / negative {summary['negative_impacted']:,}")
        lines.append(f"- median impact score: {summary['median_impact_score']:.2f}")
        lines.append(f"- market cap breakdown: {json.dumps(summary['bucket_breakdown'], ensure_ascii=False)}")
        lines.append(f"- source breakdown: {json.dumps(summary['source_breakdown'], ensure_ascii=False)}")
        lines.append("- 대표 사례:")
        for example in summary["top_examples"][:3]:
            lines.append(
                f"  - {example['news_id']} | {example['date']} | {example['source_type']} | {example['ticker']} | {example['title']} | change={example['change_pct']} | change_1d={example['change_1d_pct']} | change_3d={example['change_3d_pct']} | change_7d={example['change_7d_pct']} | intraday={example['change_from_open_pct']} | tag={example['reaction_tag']} | cap={example['market_cap_bucket']}"
            )
        if summary["counter_examples"]:
            lines.append("- 반례/영향 약한 사례:")
            for example in summary["counter_examples"][:2]:
                lines.append(
                    f"  - {example['news_id']} | {example['date']} | {example['source_type']} | {example['ticker']} | {example['title']} | change={example['change_pct']} | change_1d={example['change_1d_pct']} | change_3d={example['change_3d_pct']} | change_7d={example['change_7d_pct']} | intraday={example['change_from_open_pct']} | tag={example['reaction_tag']} | cap={example['market_cap_bucket']}"
                )
        lines.append("")
    for bucket in ("cap_300m_1b", "cap_1b_100b", "cap_100b_plus"):
        summaries = analysis["bucket_case_summaries"].get(bucket) or []
        lines.append(f"## {cap_bucket_label(bucket)} 상위 case")
        lines.append("")
        for index, summary in enumerate(summaries[:5], start=1):
            lines.append(
                f"- {index}. {summary['label_ko']}: impacted={summary['impacted']:,} / total={summary['total']:,}, ratio={summary['impact_ratio']:.3f}, Wilson={summary['impact_ratio_wilson_lb']:.3f}"
            )
        lines.append("")
    token = analysis["token_estimate"]
    lines.append("## 토큰 비용 추정")
    lines.append("")
    lines.append("- 가정: 영어 기사 기준 `1 token ~= 4 chars`, 기사별 프롬프트 오버헤드 180 tokens, 출력 120 tokens")
    lines.append(f"- 전체 문자 수: {token['total_chars']:,}")
    lines.append(f"- raw input tokens 추정: {token['raw_input_tokens_estimate']:,}")
    lines.append(f"- naive article-by-article total tokens 추정: {token['estimated_total_tokens_naive_article_by_article']:,}")
    lines.append("")
    lines.append("## 해석")
    lines.append("")
    lines.append("- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 반대일 수 있다.")
    lines.append("- 이번 note는 `press_release only` 기준이라, 동일 taxonomy를 다른 source에 그대로 적용하면 비율이 달라질 수 있다.")
    lines.append("- `300M~<1B` 버킷은 동일한 뉴스 유형에서도 절대 변동폭이 더 크게 나오기 쉬우므로, 대형주와 같은 기준으로 자르면 과대판정되기 쉽다.")
    lines.append("- `<$300M or Unknown` 집단은 전체 데이터에서 비중이 아직 크므로, 다음 단계에서는 market cap 보강이 되면 3개 주 버킷 비교가 더 안정된다.")
    lines.append("- 이 note의 내부 사고과정 로그는 내부 독백 전문이 아니라, taxonomy와 threshold를 바꾼 주요 판단을 재현 가능하게 적은 운영 로그다.")
    return "\n".join(lines)


def update_research_page(conn: sqlite3.Connection, page_id: str, title: str, body: str) -> None:
    conn.execute(
        "UPDATE research_pages SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?",
        (title, body, page_id),
    )
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"terminal/backend/backend/data/app.db")
    parser.add_argument("--since", default="2024-01-01")
    parser.add_argument("--out-dir", default=r"ai_research_tool\out")
    parser.add_argument("--source-dir", default=r"ai_research_tool\model_2_source")
    parser.add_argument("--page-id", default="")
    parser.add_argument("--note-title", default="")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    source_dir = Path(args.source_dir)
    source_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(args.db)
    note_title = resolve_note_title(conn, args.page_id, args.note_title)
    market_caps = load_latest_market_caps(conn)
    news_rows = fetch_news_rows(conn, args.since)
    analysis = build_analysis(news_rows, market_caps)
    until = datetime.now().strftime("%Y-%m-%d")
    evidence_path = source_dir / f"{slugify_note_title(note_title)}.md"
    analyzable_rows = []
    for case_summary in analysis["case_summaries"]:
        del case_summary
    for row in news_rows:
        if row.get("impact_score") is not None:
            analyzable_rows.append(row)
    analyzable_rows.sort(key=lambda row: ((row.get("case_type") or ""), (row.get("published_at") or ""), (row.get("id") or "")))
    write_evidence_markdown(evidence_path, analyzable_rows)
    markdown = make_markdown(args.since, until, analysis, evidence_path, note_title)

    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    json_path = out_dir / f"model2_case_analysis_{stamp}.json"
    md_path = out_dir / f"model2_case_analysis_{stamp}.md"
    log_path = out_dir / f"model2_case_analysis_log_{stamp}.txt"

    json_path.write_text(
        json.dumps(
            {
                "since": args.since,
                "until": until,
                "scope": "press_release_only",
                "note_title": note_title,
                "evidence_path": str(evidence_path),
                "analysis": analysis,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    md_path.write_text(markdown, encoding="utf-8")
    log_path.write_text(
        "\n".join(
            [
                f"since={args.since}",
                f"until={until}",
                "scope=press_release_only",
                f"note_title={note_title}",
                f"evidence_path={evidence_path}",
                "impact_formula=overall=max(immediate,short,medium)",
                "immediate=max(abs(change_from_open_pct),abs(change_open_to_high_pct),abs(change_pct))",
                "short=max(abs(change_1d_pct),abs(change_3d_pct))",
                "medium=max(abs(change_7d_pct),abs(change_14d_pct),abs(change_30d_pct))",
                "market_cap_buckets=$300M-<$1B|$1B-<$100B|>=100B|<$300M or Unknown",
                f"total_rows={len(news_rows)}",
                f"analyzable_rows={analysis['analyzable_rows']}",
                f"top_case_types={[item['case_type'] for item in analysis['case_summaries'][:10]]}",
            ]
        ),
        encoding="utf-8",
    )

    latest_md_path = out_dir / "model2_case_analysis_latest.md"
    latest_json_path = out_dir / "model2_case_analysis_latest.json"
    latest_log_path = out_dir / "model2_case_analysis_latest.txt"
    latest_md_path.write_text(markdown, encoding="utf-8")
    latest_json_path.write_text(json_path.read_text(encoding="utf-8"), encoding="utf-8")
    latest_log_path.write_text(log_path.read_text(encoding="utf-8"), encoding="utf-8")

    if args.page_id:
        update_research_page(conn, args.page_id, note_title, markdown)

    with suppress(Exception):
        conn.close()

    print(md_path)
    print(json_path)
    print(log_path)
    print(evidence_path)
    if args.page_id:
        print(f"updated_page={args.page_id}")

    conn.close()


if __name__ == "__main__":
    main()