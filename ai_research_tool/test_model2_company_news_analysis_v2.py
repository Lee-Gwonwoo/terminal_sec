import argparse
import json
import re
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
    short_followthrough_score,
    update_research_page,
)


CASE_META: dict[str, dict[str, object]] = {
    "earnings_beat_raise_positive": {
        "label_ko": "실적 호조·가이던스 상향",
        "top_level": "long",
        "definition": "실적 beat, 가이던스 상향, strong results가 headline 중심인 기사",
        "value_path": "추정치 상향과 valuation rerating으로 연결된다.",
        "include_signals": ["better-than-expected", "beat estimates", "raises guidance", "record revenue"],
        "exclude_signals": ["to report results", "earnings call transcript"],
        "quick_questions": ["실제 실적 결과가 나왔는가?", "headline 중심이 beat/raise인가?"],
    },
    "earnings_miss_cut_negative": {
        "label_ko": "실적 부진·가이던스 하향",
        "top_level": "short",
        "definition": "loss, miss, lowered guidance가 headline 중심인 기사",
        "value_path": "추정치 하향과 multiple 압박으로 연결된다.",
        "include_signals": ["misses estimates", "lags revenue estimates", "q1 loss", "cuts guidance"],
        "exclude_signals": ["earnings preview", "call transcript"],
        "quick_questions": ["실제 결과 기사인가?", "headline 중심이 miss/cut인가?"],
    },
    "earnings_preview_watch": {
        "label_ko": "실적 발표 전 기대 기사",
        "top_level": "residual",
        "definition": "wall street expects, to report results처럼 실적 전 기대치 기사",
        "value_path": "직접 이벤트보다 기대 형성 단계다.",
        "include_signals": ["to report q1 results", "to report q2 results", "wall street expects", "ahead of earnings"],
        "exclude_signals": ["beat estimates", "misses estimates"],
        "quick_questions": ["실제 결과가 아니라 preview인가?"],
    },
    "earnings_transcript_snapshot": {
        "label_ko": "실적 transcript·snapshot·deep dive",
        "top_level": "residual",
        "definition": "call transcript, snapshot, highlights, deep dive 같은 해설형 실적 기사",
        "value_path": "원인 공시라기보다 후행 요약/해설 레이어다.",
        "include_signals": ["earnings call transcript", "earnings snapshot", "earnings call highlights", "deep dive"],
        "exclude_signals": ["better-than-expected", "misses estimates"],
        "quick_questions": ["원인 기사보다 정리/해설 기사인가?"],
    },
    "analyst_upgrade_positive": {
        "label_ko": "애널리스트 상향·커버리지 개시",
        "top_level": "long",
        "definition": "buy/outperform, initiates coverage, target raise가 중심인 sell-side 기사",
        "value_path": "추천/목표가 상향이 수급과 심리 개선으로 연결된다.",
        "include_signals": ["maintains buy", "initiates coverage", "assumes", "raises price target"],
        "exclude_signals": ["downgrades", "lowers price target"],
        "quick_questions": ["analyst note인가?", "긍정 rating/target인가?"],
    },
    "analyst_downgrade_negative": {
        "label_ko": "애널리스트 하향·목표가 하향",
        "top_level": "short",
        "definition": "downgrade, underperform, target cut이 중심인 sell-side 기사",
        "value_path": "외부 평가 하향이 기대치 조정으로 연결된다.",
        "include_signals": ["downgrades", "downgraded", "underperform", "lowers price target"],
        "exclude_signals": ["initiates coverage", "raises price target"],
        "quick_questions": ["downgrade 또는 target cut인가?"],
    },
    "partnership_license_positive": {
        "label_ko": "제휴·라이선스·협업",
        "top_level": "long",
        "definition": "partnership, collaboration, exclusive/global license가 중심인 기사",
        "value_path": "외부 자원 결합으로 사업가치 상승 경로를 시사한다.",
        "include_signals": ["partnership", "collaboration", "license agreement", "exclusive global license"],
        "exclude_signals": ["public offering", "private placement"],
        "quick_questions": ["수주보다 협업 구조가 중심인가?"],
    },
    "government_contract_award_positive": {
        "label_ko": "정부·대형 계약 수주",
        "top_level": "long",
        "definition": "prime contractor, definitive contract, contract award가 중심인 기사",
        "value_path": "매출 가시성과 backlog 확대를 직접 시사한다.",
        "include_signals": ["contract award", "prime contractor", "definitive contract", "government contract"],
        "exclude_signals": ["generic partnership", "commentary"],
        "quick_questions": ["실제 수주가 headline 핵심인가?"],
    },
    "commercial_launch_expansion_positive": {
        "label_ko": "출시·상업화·사업 확장",
        "top_level": "long",
        "definition": "launch, rollout, expansion, prepared to launch가 중심인 기사",
        "value_path": "제품/서비스 확장과 수요 확대 기대를 시사한다.",
        "include_signals": ["launches", "launch", "expands", "prepared to launch", "platform expansion"],
        "exclude_signals": ["earnings deep dive", "event promotion"],
        "quick_questions": ["실제 상업화/확장 이벤트인가?"],
    },
    "mna_strategic_asset_positive": {
        "label_ko": "M&A·전략자산 거래",
        "top_level": "long",
        "definition": "acquisition, merger, buyout, strategic investment가 중심인 기사",
        "value_path": "전략 자산 가치 재평가나 사업 재편을 시사한다.",
        "include_signals": ["acquisition", "acquires", "merger", "buyout", "strategic investment"],
        "exclude_signals": ["private placement only", "analyst commentary"],
        "quick_questions": ["기업/자산 거래가 headline 핵심인가?"],
    },
    "regulatory_clinical_positive": {
        "label_ko": "승인·임상 호재",
        "top_level": "long",
        "definition": "FDA approval, positive topline, NDA/BLA acceptance가 중심인 기사",
        "value_path": "개발자산 성공 확률 상승과 상업화 기대로 연결된다.",
        "include_signals": ["fda approval", "positive topline", "nda acceptance", "pivotal data"],
        "exclude_signals": ["clinical hold", "failed to meet"],
        "quick_questions": ["결과 방향이 명확한 호재인가?"],
    },
    "regulatory_clinical_negative": {
        "label_ko": "규제·임상 악재",
        "top_level": "short",
        "definition": "CRL, failed endpoint, clinical hold가 중심인 기사",
        "value_path": "핵심 자산 가치 훼손과 일정 지연으로 연결된다.",
        "include_signals": ["complete response letter", "failed to meet", "clinical hold", "fda rejection"],
        "exclude_signals": ["positive topline", "approval"],
        "quick_questions": ["개발 리스크 확대가 headline 핵심인가?"],
    },
    "financing_dilution_negative": {
        "label_ko": "희석성 자금조달",
        "top_level": "short",
        "definition": "public offering, private placement, warrants, convertible notes가 중심인 기사",
        "value_path": "주주 희석과 자본비용 증가 우려로 연결된다.",
        "include_signals": ["public offering", "private placement", "warrants", "convertible senior notes"],
        "exclude_signals": ["grant award", "contract payment"],
        "quick_questions": ["조달 자체가 headline 핵심인가?"],
    },
    "capital_structure_stress_negative": {
        "label_ko": "거래정지·역분할·상장유지 스트레스",
        "top_level": "short",
        "definition": "trading halt, reverse split, authorized share increase, compliance pressure가 중심인 기사",
        "value_path": "시장구조 스트레스와 희석/상장유지 우려를 시사한다.",
        "include_signals": ["trading halt", "quotation resumption", "reverse stock split", "increase authorized shares"],
        "exclude_signals": ["ipo pop", "listing debut"],
        "quick_questions": ["사업 본체보다 거래/자본구조 스트레스인가?"],
    },
    "litigation_regulatory_negative": {
        "label_ko": "소송·조사·회계 리스크",
        "top_level": "short",
        "definition": "lawsuit, investigation, subpoena, restatement가 중심인 기사",
        "value_path": "규제 비용과 신뢰 훼손으로 연결된다.",
        "include_signals": ["lawsuit", "investigation", "subpoena", "restatement", "fraud"],
        "exclude_signals": ["approval", "contract award"],
        "quick_questions": ["조사/소송이 headline 핵심인가?"],
    },
    "restructuring_distress_negative": {
        "label_ko": "구조조정·생존성 악화",
        "top_level": "short",
        "definition": "bankruptcy, going concern, layoffs, strategic alternatives가 중심인 기사",
        "value_path": "현금 압박과 사업 지속성 우려를 시사한다.",
        "include_signals": ["chapter 11", "bankruptcy", "going concern", "layoff", "strategic alternatives"],
        "exclude_signals": ["ordinary cost cuts", "growth reorg"],
        "quick_questions": ["성장보다 생존이 핵심인가?"],
    },
    "price_action_explainer_positive": {
        "label_ko": "주가 급등 해설 기사",
        "top_level": "residual",
        "definition": "Why is stock soaring/surging today류의 사후 가격해설 기사",
        "value_path": "직접 이벤트보다 후행 해설 기사다.",
        "include_signals": ["surging today", "soaring today", "trading higher today"],
        "exclude_signals": ["contract award", "public offering", "beat estimates"],
        "quick_questions": ["이미 오른 뒤 이유를 설명하는 기사인가?"],
    },
    "price_action_explainer_negative": {
        "label_ko": "주가 급락 해설 기사",
        "top_level": "residual",
        "definition": "Why is stock sinking/lower/plummeting today류의 사후 가격해설 기사",
        "value_path": "직접 이벤트보다 후행 해설 기사다.",
        "include_signals": ["sinking today", "trading lower today", "plummeting today", "sank this week"],
        "exclude_signals": ["downgrade", "misses estimates", "public offering"],
        "quick_questions": ["이미 내린 뒤 이유를 설명하는 기사인가?"],
    },
    "macro_market_commentary": {
        "label_ko": "매크로·시장 코멘터리",
        "top_level": "residual",
        "definition": "stock market today, Fed, inflation, tariff, macro headwind처럼 시장/정책 중심 기사",
        "value_path": "개별 기업보다 외부 환경 read-through를 설명한다.",
        "include_signals": ["stock market today", "nasdaq down", "inflation", "fed", "tariff"],
        "exclude_signals": ["single-company contract", "earnings beat"],
        "quick_questions": ["여러 ticker에 공통 적용 가능한 기사인가?"],
    },
    "market_movers_roundup": {
        "label_ko": "멀티종목 movers·watchlist 기사",
        "top_level": "residual",
        "definition": "other big stocks moving, investors' radars, most active stocks류의 멀티종목 roundup 기사",
        "value_path": "개별 사건보다 스크리너/묶음 기사에 가깝다.",
        "include_signals": ["other big stocks moving", "investors' radars", "most active stocks", "top stocks"],
        "exclude_signals": ["single-company event"],
        "quick_questions": ["여러 종목을 나열하는 기사인가?"],
    },
    "ipo_listing_event": {
        "label_ko": "IPO·상장 이벤트",
        "top_level": "residual",
        "definition": "IPO pop, debut, direct listing, goes public처럼 상장 구조 이벤트가 중심인 기사",
        "value_path": "유동성/시장접근성 이벤트지만 방향성은 케이스별로 다르다.",
        "include_signals": [" ipo ", "goes public", "direct listing", "market debut", "debut"],
        "exclude_signals": ["trading halt", "reverse split"],
        "quick_questions": ["상장 자체가 headline 핵심인가?"],
    },
    "management_governance_update": {
        "label_ko": "경영진·거버넌스 변경",
        "top_level": "residual",
        "definition": "names new CEO/CFO, appoints executive, board change 기사",
        "value_path": "직접 가치사건보다 인사/거버넌스 변화 해설에 가깝다.",
        "include_signals": ["names new ceo", "appoints", "new cfo", "board"],
        "exclude_signals": ["earnings beat", "contract award"],
        "quick_questions": ["핵심이 인사/거버넌스 변경인가?"],
    },
    "generic_feature_commentary": {
        "label_ko": "해설·feature·투자아이디어 기사",
        "top_level": "residual",
        "definition": "undervalued, cautious buy, deep dive, feature/storytelling 성격의 기사",
        "value_path": "직접 이벤트가 아니라 opinion/feature 레이어다.",
        "include_signals": ["undervalued", "cautious buy", "show promise", "deep dive"],
        "exclude_signals": ["maintains buy", "beat estimates", "contract award"],
        "quick_questions": ["직접 사건보다 opinion feature인가?"],
    },
    "meaningless_others": {
        "label_ko": "잡것들",
        "top_level": "residual",
        "definition": "위 독립 유형으로 분리하기 어려운 잔여 기사",
        "value_path": "반복 패턴이 약하거나 정보 밀도가 낮다.",
        "include_signals": ["generic promotion", "ambiguous article"],
        "exclude_signals": ["명확한 earnings/analyst/contract/financing event"],
        "quick_questions": ["독립 유형으로 재현 가능하게 설명하기 어려운가?"],
    },
}

ORDERED_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("capital_structure_stress_negative", ("trading halt", "quotation resumption", "halt news pending", "reverse stock split", "increase authorized shares", "authorized common stock", "minimum bid", "non-compliance")),
    ("financing_dilution_negative", ("public offering", "proposed public offering", "private placement", "registered direct", "warrants", "convertible senior notes", "convertible preferred stock", "common stock offering", "pricing of $")),
    ("restructuring_distress_negative", ("chapter 11", "bankruptcy", "going concern", "strategic alternatives", "restructuring", "layoffs", "layoff", "liquidity concerns", "delisting notice")),
    ("litigation_regulatory_negative", ("lawsuit", "class action", "investigation", "subpoena", "restatement", "fraud", "sec probe", "doj")),
    ("regulatory_clinical_negative", ("complete response letter", "crl", "failed to meet", "did not meet", "clinical hold", "fda rejection", "missed endpoint", "trial failure")),
    ("earnings_miss_cut_negative", ("misses estimates", "misses estimate", "lags revenue estimates", "reports q1 loss", "reports q2 loss", "q1 eps", "eps misses", "lowered guidance", "cuts guidance", "weak outlook", "profit warning", "sales decline")),
    ("analyst_downgrade_negative", ("downgrades", "downgraded", "underperform", "underweight", "lowers price target", "target cut", "price target cut", "rating downgrade")),
    ("government_contract_award_positive", ("contract award", "wins contract", "secures contract", "prime contractor", "definitive contract", "government contract", "grant award", "awarded a contract")),
    ("partnership_license_positive", ("partnership", "collaboration", "license agreement", "licensing deal", "exclusive global license", "supply agreement", "licenses", "license for")),
    ("mna_strategic_asset_positive", ("acquisition", "acquires", "merger", "buyout", "strategic investment", "asset sale", "takeover")),
    ("regulatory_clinical_positive", ("fda approval", "approved by the fda", "positive topline", "topline results", "phase 3 success", "phase 2 success", "nda acceptance", "bla acceptance", "pivotal data")),
    ("commercial_launch_expansion_positive", ("launches", "launch", "prepared to launch", "expands", "expansion", "platform expansion", "capacity expansion", "production ramp", "robotaxi expansion", "strong demand", "demand surge")),
    ("earnings_beat_raise_positive", ("better-than-expected", "beat estimates", "beats estimates", "raises guidance", "record revenue", "earnings beat", "above estimates", "strong results")),
    ("analyst_upgrade_positive", ("maintains buy", "initiates coverage", "assumes", "outperform", "raises price target", "announces price target", "market outperform", "overweight", "buy rating")),
    ("ipo_listing_event", (" ipo ", "goes public", "direct listing", "market debut", "debut", "listing")),
    ("management_governance_update", ("names new ceo", "appoints", "new cfo", "chief executive officer", "chief financial officer", "board")),
    ("earnings_transcript_snapshot", ("earnings call transcript", "earnings snapshot", "earnings call highlights", "deep dive", "q1 2025 earnings call", "q2 2025 earnings call", "q3 2025 earnings call", "q4 2025 earnings call")),
    ("earnings_preview_watch", ("to report q1 results", "to report q2 results", "to report q3 results", "to report q4 results", "wall street expects", "ahead of earnings")),
    ("market_movers_roundup", ("other big stocks moving", "investors' radars", "most active stocks", "top stocks", "stocks to buy", "watch these stocks", "wall street's favorite", "best ai stock")),
    ("macro_market_commentary", ("stock market today", "nasdaq down", "s&p 500", "interest rates", "fed", "inflation", "tariff", "recession", "macro headwind", "economic slowdown", "geopolitical")),
    ("generic_feature_commentary", ("undervalued", "cautious buy", "show promise", "risks remain", "interesting analyst questions", "revealing analyst questions")),
]

POSITIVE_EXPLAINERS = ("surging today", "soaring today", "trading higher today", "stock soared", "stock is soaring", "shares are trading higher", "soared 18.5% today", "just doubled")
NEGATIVE_EXPLAINERS = ("sinking today", "stock is trading lower today", "trading lower today", "plummeting today", "stock sank", "stock skidded", "shares are trading lower", "died today", "pumping the brakes")


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def contains_any(text: str, patterns: tuple[str, ...]) -> bool:
    return any(pattern in text for pattern in patterns)


def classify_company_news(title: str, body: str, publisher: str = "") -> str:
    title_text = (title or "").lower()
    body_text = (body or "").lower()
    text = normalize_text(title, body, publisher)
    if not text.strip():
        return "meaningless_others"
    for case_type, patterns in ORDERED_RULES:
        if contains_any(text, patterns):
            if case_type == "ipo_listing_event" and "trading halt" in text:
                continue
            return case_type
    if "why" in text or "shares are trading" in text:
        if contains_any(text, NEGATIVE_EXPLAINERS):
            return "price_action_explainer_negative"
        if contains_any(text, POSITIVE_EXPLAINERS):
            return "price_action_explainer_positive"
    if re.search(r"\bq[1-4]\b", title_text) and ("transcript" in title_text or "snapshot" in title_text):
        return "earnings_transcript_snapshot"
    if "why " in title_text and ("stock" in title_text or "shares" in title_text):
        return "generic_feature_commentary"
    return "meaningless_others"


def meta_for_case(case_type: str) -> tuple[str, str]:
    meta = CASE_META.get(case_type, CASE_META["meaningless_others"])
    return str(meta["label_ko"]), str(meta["top_level"])


def case_meta(case_type: str) -> dict[str, object]:
    return CASE_META.get(case_type, CASE_META["meaningless_others"])


def summary_text(row: dict) -> str:
    source = (row.get("body") or "").strip()
    if not source:
        return ""
    return " ".join(source.split())[:400]


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
    row["case_type"] = classify_company_news(row.get("title") or "", row.get("body") or "", row.get("publisher") or "")
    row["case_label_ko"], row["top_level"] = meta_for_case(row["case_type"])
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
        raw_row["case_type"] = classify_company_news(raw_row.get("title") or "", raw_row.get("body") or "", raw_row.get("publisher") or "")
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
        ) VALUES (?, ?, ?, ?, 'company_news', 'FINNHUB', ?, ?, 'company_news_2025_plus_detailed_v2', ?, ?, ?, ?)
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
            overall_impact_score, summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        buffer,
    )
    buffer.clear()


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
            )
        )
        inserted_rows += 1
        if len(buffer) >= insert_batch:
            flush_rows(conn, buffer)
    flush_rows(conn, buffer)
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
               ni.title,
               ni.published_at
        FROM model2_evidence_rows er
        JOIN news_items ni ON ni.id = er.news_id
        WHERE er.analysis_id = ? AND er.case_type = ?
        ORDER BY er.is_impacted DESC, er.overall_impact_score DESC, ni.published_at DESC
        LIMIT ?
        """,
        (run_id, case_type, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def make_markdown(conn: sqlite3.Connection, run_id: str, note_title: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict]) -> str:
    lines: list[str] = []
    lines.append(f"# {note_title}")
    lines.append("")
    lines.append("## 📌 분석 범위")
    lines.append("")
    lines.append(f"- analysis_id: `{run_id}`")
    lines.append(f"- source_type: `company_news`")
    lines.append(f"- source_name: `FINNHUB`")
    lines.append(f"- 기간: `{since} ~ {until}`")
    lines.append(f"- 전체 분류 row: {threshold_summary['total_rows']:,}")
    lines.append(f"- impact 계산 가능 row: {threshold_summary['analyzable_rows']:,}")
    lines.append(f"- impact 판정 row: {insert_summary['impacted_rows']:,}")
    lines.append(f"- `잡것들` row: {threshold_summary['meaningless_rows']:,}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🎯 taxonomy 설계 포인트")
    lines.append("")
    lines.append("- v2는 기존 1차 분류에서 `잡것들` 안에 섞여 있던 `trading halt`, `reverse split`, `earnings transcript`, `earnings preview`, `price-action explainer`, `market movers roundup`를 별도 유형으로 분리했다.")
    lines.append("- 분류 우선순위는 `거래/자본구조 스트레스 -> financing -> 생존성 -> 소송/규제 -> 실적 -> 애널리스트 -> 계약/제휴 -> 상업화 -> M&A -> 해설/roundup` 순서로 둔다.")
    lines.append("- headline과 body를 함께 읽되, 여러 신호가 섞이면 더 직접적인 경제 사건을 우선한다.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📊 bucket 기준")
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
        lines.append(f"| {cap_bucket_label(bucket)} | {format_float(meta.get('p50'))} | {format_float(meta.get('p80'))} | {format_float(meta.get('p90'))} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🗂️ case 요약")
    lines.append("")
    lines.append("| top_level | case | total | impacted | max impact |")
    lines.append("| --- | --- | ---: | ---: | ---: |")
    for item in case_summaries:
        lines.append(f"| {item['top_level']} | {item['case_label_ko']} | {item['total_count']:,} | {item['impacted_count']:,} | {format_float(item['max_impact_score'])} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🧭 유형 정의")
    lines.append("")
    for item in case_summaries:
        meta = case_meta(item["case_type"])
        examples = fetch_top_examples(conn, run_id, item["case_type"], 2)
        lines.append(f"### {meta['label_ko']} (`{item['case_type']}`)")
        lines.append(f"- 상위 분류: `{meta['top_level']}`")
        lines.append(f"- 한 줄 정의: {meta['definition']}")
        lines.append(f"- 핵심 가치 경로: {meta['value_path']}")
        lines.append(f"- 포함 신호: {', '.join(meta['include_signals'])}")
        lines.append(f"- 제외 신호: {', '.join(meta['exclude_signals'])}")
        lines.append(f"- 빠른 판별 질문: {' / '.join(meta['quick_questions'])}")
        lines.append(f"- 집계: total={item['total_count']:,}, impacted={item['impacted_count']:,}, max impact={format_float(item['max_impact_score'])}")
        if examples:
            lines.append("- 대표 예시:")
            for example in examples:
                lines.append(f"  - {example['published_at']} | {example['ticker'] or '-'} | {example['title']} | score={format_float(example['overall_impact_score'])} | tag={example['reaction_tag']}")
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🔎 해석")
    lines.append("")
    lines.append("- v2 taxonomy는 company_news의 후행 해설 기사와 직접 이벤트 기사를 더 분리해서 보도록 만든 구조다.")
    lines.append("- `capital_structure_stress_negative`, `earnings_transcript_snapshot`, `earnings_preview_watch`, `market_movers_roundup`, `price_action_explainer_*`가 새로 들어가면서 기존 `잡것들`이 줄어드는지 보는 것이 핵심 검증 포인트다.")
    lines.append("- 그래도 남는 `generic_feature_commentary`와 `meaningless_others`는 다음 보정 단계 후보군이다.")
    return "\n".join(lines)


def write_outputs(out_dir: Path, note_title: str, run_id: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict], markdown: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    stem = f"model2_company_news_analysis_v2_{stamp}"
    payload = {
        "analysis_id": run_id,
        "note_title": note_title,
        "since": since,
        "until": until,
        "scope": "company_news_2025_plus_detailed_v2",
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
                "scope=company_news_2025_plus_detailed_v2",
                f"total_rows={threshold_summary['total_rows']}",
                f"analyzable_rows={threshold_summary['analyzable_rows']}",
                f"impacted_rows={insert_summary['impacted_rows']}",
                f"meaningless_rows={threshold_summary['meaningless_rows']}",
            ]
        ),
        encoding="utf-8",
    )
    (out_dir / "model2_company_news_analysis_v2_latest.md").write_text(markdown, encoding="utf-8")
    (out_dir / "model2_company_news_analysis_v2_latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"terminal/backend/backend/data/app.db")
    parser.add_argument("--since", default="2025-01-01")
    parser.add_argument("--until", default="")
    parser.add_argument("--page-id", default="99a89607-d943-4a57-8a98-be8ba86f731b")
    parser.add_argument("--note-title", default="Model 2 company_news detailed taxonomy v2 (2025+)")
    parser.add_argument("--out-dir", default=r"ai_research_tool\out")
    parser.add_argument("--chunk-size", type=int, default=5000)
    parser.add_argument("--insert-batch", type=int, default=1000)
    args = parser.parse_args()

    db_path = Path(args.db)
    out_dir = Path(args.out_dir)
    until = args.until or datetime.now().strftime("%Y-%m-%d")
    conn = sqlite3.connect(db_path)
    note_title = args.note_title
    company_ctx = load_company_context(conn)
    threshold_summary = compute_thresholds(conn, args.since, until, company_ctx, args.chunk_size)
    run_id = str(uuid.uuid4())
    insert_analysis_run(conn, run_id, args.page_id, note_title, note_title, args.since, until, threshold_summary)
    insert_summary = populate_evidence_rows(conn, run_id, args.since, until, company_ctx, threshold_summary["thresholds"], args.chunk_size, args.insert_batch)
    case_summaries = fetch_case_summaries(conn, run_id)
    markdown = make_markdown(conn, run_id, note_title, args.since, until, threshold_summary, insert_summary, case_summaries)
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