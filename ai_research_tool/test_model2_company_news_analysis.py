import argparse
import json
import sqlite3
import uuid
from collections import Counter, defaultdict
from contextlib import suppress
from datetime import datetime
from pathlib import Path

from model2_case_analysis import (
    cap_bucket,
    cap_bucket_label,
    direction_from_primary_metrics,
    first_ticker,
    format_float,
    immediate_reaction_score,
    load_company_context,
    medium_persistence_score,
    overall_impact_score,
    percentile,
    percentile_meta,
    reaction_tag,
    resolve_note_title,
    short_followthrough_score,
    slugify_note_title,
    update_research_page,
)


CASE_META: dict[str, dict[str, str]] = {
    "earnings_guidance_positive": {"label_ko": "실적 호조·가이던스 상향", "top_level": "long"},
    "earnings_guidance_negative": {"label_ko": "실적 부진·가이던스 하향", "top_level": "short"},
    "analyst_upgrade_positive": {"label_ko": "애널리스트 상향·목표가 상향", "top_level": "long"},
    "analyst_downgrade_negative": {"label_ko": "애널리스트 하향·목표가 하향", "top_level": "short"},
    "contract_partnership_positive": {"label_ko": "대형 계약·제휴·수주", "top_level": "long"},
    "product_growth_positive": {"label_ko": "제품·서비스 성장 기대", "top_level": "long"},
    "regulatory_clinical_positive": {"label_ko": "승인·임상 호재", "top_level": "long"},
    "regulatory_clinical_negative": {"label_ko": "규제·임상 악재", "top_level": "short"},
    "financing_dilution_negative": {"label_ko": "희석성 자금조달", "top_level": "short"},
    "litigation_regulatory_negative": {"label_ko": "소송·조사·회계 리스크", "top_level": "short"},
    "restructuring_distress_negative": {"label_ko": "구조조정·생존성 악화", "top_level": "short"},
    "mna_asset_value_positive": {"label_ko": "M&A·전략가치 재평가", "top_level": "long"},
    "macro_sector_readthrough": {"label_ko": "매크로·섹터 read-through", "top_level": "residual"},
    "meaningless_others": {"label_ko": "잡것들", "top_level": "residual"},
}

ORDERED_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "financing_dilution_negative",
        (
            "public offering",
            "stock offering",
            "share offering",
            "registered direct",
            "private placement",
            "dilution",
            "warrant",
            "convertible notes",
            "notes offering",
            "secondary offering",
        ),
    ),
    (
        "restructuring_distress_negative",
        (
            "chapter 11",
            "bankruptcy",
            "going concern",
            "delisting notice",
            "non-compliance",
            "strategic alternatives",
            "restructuring",
            "layoffs",
            "layoff",
            "liquidity concerns",
        ),
    ),
    (
        "litigation_regulatory_negative",
        (
            "lawsuit",
            "class action",
            "investigation",
            "sec probe",
            "doj",
            "restatement",
            "fraud",
            "subpoena",
        ),
    ),
    (
        "regulatory_clinical_negative",
        (
            "complete response letter",
            "crl",
            "failed to meet",
            "did not meet",
            "clinical hold",
            "trial failure",
            "phase 3 setback",
            "fda rejection",
            "missed endpoint",
        ),
    ),
    (
        "regulatory_clinical_positive",
        (
            "fda approval",
            "approved by the fda",
            "positive topline",
            "topline results",
            "phase 3 success",
            "phase 2 success",
            "pivotal data",
            "nda acceptance",
            "bla acceptance",
            "clinical win",
        ),
    ),
    (
        "earnings_guidance_negative",
        (
            "missed estimates",
            "misses estimates",
            "lowered guidance",
            "cuts guidance",
            "weak outlook",
            "revenue miss",
            "profit warning",
            "sales decline",
            "below expectations",
        ),
    ),
    (
        "earnings_guidance_positive",
        (
            "beat estimates",
            "beats estimates",
            "raises guidance",
            "strong outlook",
            "record revenue",
            "better-than-expected",
            "profit jumps",
            "earnings beat",
        ),
    ),
    (
        "analyst_downgrade_negative",
        (
            "downgrade",
            "downgraded",
            "cuts price target",
            "target cut",
            "price target cut",
            "underweight",
            "sell rating",
        ),
    ),
    (
        "analyst_upgrade_positive",
        (
            "upgrade",
            "upgraded",
            "raises price target",
            "target raised",
            "price target raised",
            "outperform",
            "buy rating",
        ),
    ),
    (
        "contract_partnership_positive",
        (
            "contract award",
            "wins contract",
            "secures contract",
            "partnership",
            "collaboration",
            "licensing deal",
            "license agreement",
            "supply agreement",
            "government contract",
            "grant award",
        ),
    ),
    (
        "mna_asset_value_positive",
        (
            "acquisition",
            "acquire",
            "merger",
            "takeover",
            "strategic investment",
            "asset sale",
            "stake sale",
            "buyout",
        ),
    ),
    (
        "product_growth_positive",
        (
            "launch",
            "product launch",
            "new service",
            "expansion",
            "production ramp",
            "capacity expansion",
            "demand surge",
            "strong demand",
            "growth catalyst",
        ),
    ),
    (
        "macro_sector_readthrough",
        (
            "tariff",
            "interest rates",
            "fed",
            "inflation",
            "recession",
            "sector slump",
            "sector weakness",
            "macro headwind",
            "economic slowdown",
            "geopolitical",
        ),
    ),
]

JUNK_PATTERNS = (
    "most active stocks",
    "top stocks",
    "stocks to buy",
    "buy now",
    "should you buy",
    "worth buying",
    "wall street's favorite",
    "wall street favorite",
    "prediction",
    "forecast",
    "1 oversold",
    "2 oversold",
    "3 oversold",
    "zacks",
    "motley fool",
    "investorplace",
    "best ai stock",
    "best stocks",
    "watch these stocks",
)


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def classify_company_news(title: str, body: str) -> str:
    text = normalize_text(title, body)
    if not text.strip():
        return "meaningless_others"
    for pattern in JUNK_PATTERNS:
        if pattern in text:
            return "meaningless_others"
    for case_type, patterns in ORDERED_RULES:
        if any(pattern in text for pattern in patterns):
            return case_type
    if "why" in text and "stock" in text and ("today" in text or "this week" in text):
        return "macro_sector_readthrough"
    return "meaningless_others"


def meta_for_case(case_type: str) -> tuple[str, str]:
    meta = CASE_META.get(case_type, CASE_META["meaningless_others"])
    return meta["label_ko"], meta["top_level"]


def summary_text(row: dict) -> str:
    source = (row.get("body") or "").strip()
    if not source:
        return ""
    trimmed = " ".join(source.split())
    return trimmed[:400]


def iter_company_news_rows(conn: sqlite3.Connection, since: str, until: str, chunk_size: int):
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT ni.id,
               ni.published_at,
               ni.source,
               ni.publisher,
               ni.source_type,
               ni.title,
               ni.body,
               ni.url,
               ni.tickers_csv,
               MAX(CASE WHEN m.metric_key='change_pct' THEN m.value_pct END) AS change_pct,
               MAX(CASE WHEN m.metric_key='change_1d_pct' THEN m.value_pct END) AS change_1d_pct,
               MAX(CASE WHEN m.metric_key='change_from_open_pct' THEN m.value_pct END) AS change_from_open_pct,
               MAX(CASE WHEN m.metric_key='change_open_to_high_pct' THEN m.value_pct END) AS change_open_to_high_pct,
               MAX(CASE WHEN m.metric_key='change_3d_pct' THEN m.value_pct END) AS change_3d_pct,
               MAX(CASE WHEN m.metric_key='change_7d_pct' THEN m.value_pct END) AS change_7d_pct,
               MAX(CASE WHEN m.metric_key='change_14d_pct' THEN m.value_pct END) AS change_14d_pct,
               MAX(CASE WHEN m.metric_key='change_30d_pct' THEN m.value_pct END) AS change_30d_pct
        FROM news_items ni
        LEFT JOIN news_change_metrics m ON m.news_id = ni.id
        WHERE ni.source_type = 'company_news'
          AND ni.published_at >= ?
          AND ni.published_at < datetime(?, '+1 day')
        GROUP BY ni.id
        ORDER BY ni.published_at ASC, ni.id ASC
        """,
        (since, until),
    )
    while True:
        rows = cursor.fetchmany(chunk_size)
        if not rows:
            break
        for row in rows:
            yield dict(row)


def prepare_row(base_row: dict, company_ctx: dict[str, dict], thresholds: dict[str, float]) -> dict:
    row = dict(base_row)
    ticker = first_ticker(row.get("tickers_csv"))
    context = company_ctx.get(ticker or "", {}) if ticker else {}
    row["ticker"] = ticker
    row["market_cap"] = context.get("market_cap")
    row["industry"] = context.get("industry") or ""
    row["ipo_date"] = context.get("ipo_date") or ""
    row["market_cap_bucket"] = cap_bucket(row.get("market_cap"))
    row["case_type"] = classify_company_news(row.get("title") or "", row.get("body") or "")
    case_label_ko, top_level = meta_for_case(row["case_type"])
    row["case_label_ko"] = case_label_ko
    row["top_level"] = top_level
    row["immediate_reaction_score"] = immediate_reaction_score(row)
    row["short_followthrough_score"] = short_followthrough_score(row)
    row["medium_persistence_score"] = medium_persistence_score(row)
    row["overall_impact_score"] = overall_impact_score(row)
    threshold = thresholds.get(row["market_cap_bucket"]) if row.get("overall_impact_score") is not None else None
    row["is_impacted"] = bool(threshold is not None and row["overall_impact_score"] is not None and row["overall_impact_score"] >= threshold)
    row["reaction_tag"] = reaction_tag(row, threshold)
    direction, direction_metric, direction_value = direction_from_primary_metrics(row)
    row["direction"] = direction
    row["direction_metric"] = direction_metric
    row["direction_value"] = direction_value
    row["summary"] = summary_text(row)
    return row


def compute_thresholds(conn: sqlite3.Connection, since: str, until: str, company_ctx: dict[str, dict], chunk_size: int) -> dict:
    bucket_scores: dict[str, list[float]] = defaultdict(list)
    total_rows = 0
    analyzable_rows = 0
    meaningless_rows = 0
    case_counts: Counter[str] = Counter()
    for raw_row in iter_company_news_rows(conn, since, until, chunk_size):
        total_rows += 1
        ticker = first_ticker(raw_row.get("tickers_csv"))
        context = company_ctx.get(ticker or "", {}) if ticker else {}
        raw_row["market_cap"] = context.get("market_cap")
        raw_row["market_cap_bucket"] = cap_bucket(raw_row.get("market_cap"))
        raw_row["case_type"] = classify_company_news(raw_row.get("title") or "", raw_row.get("body") or "")
        case_counts[raw_row["case_type"]] += 1
        if raw_row["case_type"] == "meaningless_others":
            meaningless_rows += 1
        raw_row["immediate_reaction_score"] = immediate_reaction_score(raw_row)
        raw_row["short_followthrough_score"] = short_followthrough_score(raw_row)
        raw_row["medium_persistence_score"] = medium_persistence_score(raw_row)
        raw_row["overall_impact_score"] = overall_impact_score(raw_row)
        if raw_row["overall_impact_score"] is not None:
            analyzable_rows += 1
            bucket_scores[raw_row["market_cap_bucket"]].append(raw_row["overall_impact_score"])

    all_scores = [score for values in bucket_scores.values() for score in values]
    global_p80 = percentile(all_scores, 0.80) or 0.0
    thresholds = {bucket: percentile(values, 0.80) or global_p80 for bucket, values in bucket_scores.items()}
    return {
        "thresholds": thresholds,
        "bucket_meta": {bucket: percentile_meta(values) for bucket, values in bucket_scores.items()},
        "global_p80": global_p80,
        "total_rows": total_rows,
        "analyzable_rows": analyzable_rows,
        "meaningless_rows": meaningless_rows,
        "case_counts": dict(case_counts),
    }


def insert_analysis_run(conn: sqlite3.Connection, run_id: str, page_id: str, title: str, note_title: str, since: str, until: str, summary: dict) -> None:
    conn.execute(
        """
        INSERT INTO model2_analysis_runs (
            id, page_id, title, note_title, source_type, source_name, since, until, scope,
            total_rows, analyzable_rows, impacted_rows, meaningless_rows
        ) VALUES (?, ?, ?, ?, 'company_news', 'FINNHUB', ?, ?, 'company_news_2025_plus', ?, ?, ?, ?)
        """,
        (
            run_id,
            page_id or None,
            title,
            note_title,
            since,
            until,
            summary["total_rows"],
            summary["analyzable_rows"],
            0,
            summary["meaningless_rows"],
        ),
    )


def flush_rows(conn: sqlite3.Connection, buffer: list[tuple]) -> None:
    if not buffer:
        return
    conn.executemany(
        """
        INSERT INTO model2_evidence_rows (
            analysis_id, news_id, case_type, case_label_ko, top_level, reaction_tag, is_impacted,
            ticker, market_cap, market_cap_bucket, industry, ipo_date,
            change_pct, change_from_open_pct, change_open_to_high_pct, change_1d_pct, change_3d_pct,
            change_7d_pct, change_14d_pct, change_30d_pct,
            immediate_reaction_score, short_followthrough_score, medium_persistence_score,
            overall_impact_score, summary, published_at, source, publisher, source_type, title, body_preview, url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        buffer,
    )
    buffer.clear()


def refresh_case_summaries(conn: sqlite3.Connection, run_id: str) -> None:
    conn.execute("DELETE FROM model2_case_summaries WHERE analysis_id = ?", (run_id,))
    conn.execute(
        """
        INSERT INTO model2_case_summaries (
            analysis_id, case_type, case_label_ko, top_level,
            total_count, impacted_count, latest_published_at, updated_at
        )
        SELECT analysis_id,
               case_type,
               MAX(case_label_ko) AS case_label_ko,
               MAX(top_level) AS top_level,
               COUNT(*) AS total_count,
               SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count,
               MAX(published_at) AS latest_published_at,
               datetime('now') AS updated_at
        FROM model2_evidence_rows
        WHERE analysis_id = ?
        GROUP BY analysis_id, case_type
        """,
        (run_id,),
    )


def populate_evidence_rows(conn: sqlite3.Connection, run_id: str, since: str, until: str, company_ctx: dict[str, dict], thresholds: dict[str, float], chunk_size: int, insert_batch: int) -> dict:
    buffer: list[tuple] = []
    impacted_rows = 0
    inserted_rows = 0
    case_impacted: Counter[str] = Counter()
    for raw_row in iter_company_news_rows(conn, since, until, chunk_size):
        row = prepare_row(raw_row, company_ctx, thresholds)
        if row["is_impacted"]:
            impacted_rows += 1
            case_impacted[row["case_type"]] += 1
        buffer.append(
            (
                run_id,
                row["id"],
                row["case_type"],
                row["case_label_ko"],
                row["top_level"],
                row["reaction_tag"],
                1 if row["is_impacted"] else 0,
                row.get("ticker"),
                row.get("market_cap"),
                row.get("market_cap_bucket"),
                row.get("industry"),
                row.get("ipo_date"),
                row.get("change_pct"),
                row.get("change_from_open_pct"),
                row.get("change_open_to_high_pct"),
                row.get("change_1d_pct"),
                row.get("change_3d_pct"),
                row.get("change_7d_pct"),
                row.get("change_14d_pct"),
                row.get("change_30d_pct"),
                row.get("immediate_reaction_score"),
                row.get("short_followthrough_score"),
                row.get("medium_persistence_score"),
                row.get("overall_impact_score"),
                row.get("summary"),
                row.get("published_at"),
                raw_row.get("source"),
                raw_row.get("publisher"),
                raw_row.get("source_type"),
                raw_row.get("title"),
                (raw_row.get("body") or "")[:600],
                raw_row.get("url"),
            )
        )
        inserted_rows += 1
        if len(buffer) >= insert_batch:
            flush_rows(conn, buffer)
    flush_rows(conn, buffer)
    refresh_case_summaries(conn, run_id)
    conn.execute(
        "UPDATE model2_analysis_runs SET impacted_rows = ?, updated_at = datetime('now') WHERE id = ?",
        (impacted_rows, run_id),
    )
    return {
        "impacted_rows": impacted_rows,
        "inserted_rows": inserted_rows,
        "case_impacted": dict(case_impacted),
    }


def fetch_case_summaries(conn: sqlite3.Connection, run_id: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT case_type,
               case_label_ko,
               top_level,
               COUNT(*) AS total_count,
               SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count,
               MAX(overall_impact_score) AS max_impact_score
        FROM model2_evidence_rows
        WHERE analysis_id = ?
        GROUP BY case_type, case_label_ko, top_level
        ORDER BY total_count DESC, impacted_count DESC, case_type ASC
        """,
        (run_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_top_examples(conn: sqlite3.Connection, run_id: str, case_type: str, limit: int) -> list[dict]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT er.news_id,
               er.ticker,
               er.reaction_tag,
               er.overall_impact_score,
               er.summary,
             er.title,
             er.published_at
         FROM model2_evidence_rows er
        WHERE er.analysis_id = ?
          AND er.case_type = ?
         ORDER BY er.is_impacted DESC, er.overall_impact_score DESC, er.published_at DESC
        LIMIT ?
        """,
        (run_id, case_type, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def make_markdown(run_id: str, note_title: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict]) -> str:
    lines: list[str] = []
    lines.append(f"# {note_title}")
    lines.append("")
    lines.append("## 분석 범위")
    lines.append("")
    lines.append(f"- analysis_id: `{run_id}`")
    lines.append(f"- source_type: `company_news`")
    lines.append(f"- source_name: `FINNHUB`")
    lines.append(f"- 기간: `{since} ~ {until}`")
    lines.append(f"- 전체 분류 row: {threshold_summary['total_rows']:,}")
    lines.append(f"- impact 계산 가능 row: {threshold_summary['analyzable_rows']:,}")
    lines.append(f"- impact 판정 row: {insert_summary['impacted_rows']:,}")
    lines.append(f"- `잡것들` row: {threshold_summary['meaningless_rows']:,}")
    lines.append("- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.")
    lines.append("")
    lines.append("## 분류 원칙")
    lines.append("")
    lines.append("- 이 분류는 `company news`에서 자주 반복되는 \"왜 올랐는지 / 왜 내렸는지\" 설명 패턴을 기준으로 만든 rule-based taxonomy다.")
    lines.append("- 실적, 애널리스트 리포트, 계약/제휴, 승인/임상, 자금조달, 소송/조사, 구조조정, M&A, 매크로 read-through를 우선 분리했다.")
    lines.append("- 제목/요약에 근거 패턴이 거의 없거나 listicle/commentary 성격이 강한 row는 `잡것들`로 묶었다.")
    lines.append("- 가격 영향은 분류 기준이 아니라 evidence 우선순위와 reaction tag 계산에만 사용했다.")
    lines.append("")
    lines.append("## bucket 기준")
    lines.append("")
    lines.append("- `overall_impact_score = max(immediate, short, medium)`")
    lines.append("- `immediate = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`")
    lines.append("- `short = max(abs(change_1d_pct), abs(change_3d_pct))`")
    lines.append("- `medium = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`")
    lines.append("- bucket별 `p80`을 impact threshold로 사용했다.")
    lines.append("")
    lines.append("| bucket | p50 | p80 | p90 |")
    lines.append("| --- | ---: | ---: | ---: |")
    for bucket, meta in sorted(threshold_summary["bucket_meta"].items()):
        lines.append(
            f"| {cap_bucket_label(bucket)} | {format_float(meta.get('p50'))} | {format_float(meta.get('p80'))} | {format_float(meta.get('p90'))} |"
        )
    lines.append("")
    lines.append("## case 요약")
    lines.append("")
    lines.append("| top_level | case | total | impacted | max impact |")
    lines.append("| --- | --- | ---: | ---: | ---: |")
    for item in case_summaries:
        lines.append(
            f"| {item['top_level']} | {item['case_label_ko']} | {item['total_count']:,} | {item['impacted_count']:,} | {format_float(item['max_impact_score'])} |"
        )
    lines.append("")
    lines.append("## 해석")
    lines.append("")
    lines.append("- `잡것들` 비중이 높다는 것은 company_news 원천에 listicle, generic commentary, broad watchlist-style 기사 비중이 높다는 뜻이다.")
    lines.append("- 실적/애널리스트/자금조달/구조조정은 비교적 직접적인 원인 기사라 case 분리가 안정적이다.")
    lines.append("- `macro_sector_readthrough`는 개별 기업 이벤트가 약하고 섹터/정책/시장 설명이 중심인 기사다.")
    lines.append("- 더 정교한 분류가 필요하면 다음 단계에서 case별 false positive를 보고 규칙을 세분화하면 된다.")
    return "\n".join(lines)


def write_outputs(out_dir: Path, note_title: str, run_id: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict], markdown: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    stem = f"model2_company_news_analysis_{stamp}"
    payload = {
        "analysis_id": run_id,
        "note_title": note_title,
        "since": since,
        "until": until,
        "scope": "company_news_2025_plus",
        "threshold_summary": threshold_summary,
        "insert_summary": insert_summary,
        "case_summaries": case_summaries,
    }
    (out_dir / f"{stem}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / f"{stem}.md").write_text(markdown, encoding="utf-8")
    (out_dir / f"{stem}.txt").write_text(
        "\n".join(
            [
                f"analysis_id={run_id}",
                f"since={since}",
                f"until={until}",
                "scope=company_news_2025_plus",
                f"total_rows={threshold_summary['total_rows']}",
                f"analyzable_rows={threshold_summary['analyzable_rows']}",
                f"impacted_rows={insert_summary['impacted_rows']}",
                f"meaningless_rows={threshold_summary['meaningless_rows']}",
            ]
        ),
        encoding="utf-8",
    )
    (out_dir / "model2_company_news_analysis_latest.md").write_text(markdown, encoding="utf-8")
    (out_dir / "model2_company_news_analysis_latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"terminal/backend/backend/data/app.db")
    parser.add_argument("--since", default="2025-01-01")
    parser.add_argument("--until", default="")
    parser.add_argument("--page-id", default="99a89607-d943-4a57-8a98-be8ba86f731b")
    parser.add_argument("--note-title", default="Model 2 company_news issue analysis (2025+)")
    parser.add_argument("--out-dir", default=r"ai_research_tool\out")
    parser.add_argument("--chunk-size", type=int, default=5000)
    parser.add_argument("--insert-batch", type=int, default=1000)
    args = parser.parse_args()

    db_path = Path(args.db)
    out_dir = Path(args.out_dir)
    until = args.until or datetime.now().strftime("%Y-%m-%d")
    conn = sqlite3.connect(db_path)
    note_title = args.note_title or resolve_note_title(conn, args.page_id, args.note_title)
    company_ctx = load_company_context(conn)
    threshold_summary = compute_thresholds(conn, args.since, until, company_ctx, args.chunk_size)
    run_id = str(uuid.uuid4())
    insert_analysis_run(conn, run_id, args.page_id, note_title, note_title, args.since, until, threshold_summary)
    insert_summary = populate_evidence_rows(
        conn,
        run_id,
        args.since,
        until,
        company_ctx,
        threshold_summary["thresholds"],
        args.chunk_size,
        args.insert_batch,
    )
    case_summaries = fetch_case_summaries(conn, run_id)
    markdown = make_markdown(run_id, note_title, args.since, until, threshold_summary, insert_summary, case_summaries)
    write_outputs(out_dir, note_title, run_id, args.since, until, threshold_summary, insert_summary, case_summaries, markdown)
    if args.page_id:
        update_research_page(conn, args.page_id, note_title, markdown)
    conn.commit()
    print(f"analysis_id={run_id}")
    print(f"total_rows={threshold_summary['total_rows']}")
    print(f"analyzable_rows={threshold_summary['analyzable_rows']}")
    print(f"impacted_rows={insert_summary['impacted_rows']}")
    print(f"meaningless_rows={threshold_summary['meaningless_rows']}")
    if args.page_id:
        print(f"updated_page={args.page_id}")
    with suppress(Exception):
        conn.close()


if __name__ == "__main__":
    main()