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
    compiled: tuple[re.Pattern, ...] = ()

    def __post_init__(self) -> None:
        if not self.compiled:
            object.__setattr__(self, "compiled", tuple(re.compile(p) for p in self.patterns))

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


# ── Industry context for classification refinement ──

CLINICAL_CORE_INDUSTRIES: frozenset[str] = frozenset({
    "Biotechnology",
    "Drug Manufacturers - General",
    "Drug Manufacturers - Specialty & Generic",
    "Pharmaceutical Retailers",
    "Medical Devices",
    "Medical Instruments & Supplies",
    "Diagnostics & Research",
    "Health Information Services",
    "Medical Care Facilities",
    "Medical Distribution",
})

STRONG_CLINICAL_PATTERNS: tuple[str, ...] = (
    r"\bphase [1234]\b",
    r"\bphase i(?:/ii|ii)?\b",
    r"\btopline\b",
    r"\bnda\b",
    r"\bbla\b",
    r"\bclinical hold\b",
    r"\bcrl\b",
    r"\bcomplete response letter\b",
    r"\bpivotal\b",
    r"\befficacy\b",
    r"\bprimary endpoint\b",
    r"\bclinical results?\b",
    r"\bclinical trial\b",
    r"\bnew drug\b",
)

STRONG_CLINICAL_COMPILED: tuple[re.Pattern, ...] = tuple(re.compile(p) for p in STRONG_CLINICAL_PATTERNS)

# Patterns to detect clinical/biotech focus from company description
DESC_CLINICAL_PATTERNS: tuple[str, ...] = (
    r"\bbiotechnolog",
    r"\bbiopharmaceutic",
    r"\bpharmaceutic",
    r"\bclinical[- ]stage\b",
    r"\bdrug discover",
    r"\bdrug develop",
    r"\btherapeutic",
    r"\boncolog",
    r"\bimmunolog",
    r"\bgene therap",
    r"\bcell therap",
    r"\bmedical device",
    r"\bdiagnostic",
    r"\bclinical trial",
    r"\bbiologic",
    r"\bnew drug application\b",
    r"\bfda[- ]approv",
)
DESC_CLINICAL_COMPILED: tuple[re.Pattern, ...] = tuple(re.compile(p) for p in DESC_CLINICAL_PATTERNS)


def industry_group(industry: str | None) -> str:
    if not industry:
        return "Unknown"
    if industry in CLINICAL_CORE_INDUSTRIES:
        return "Biotech/Pharma/MedDev"
    low = industry.lower()
    if "software" in low or "semiconductor" in low or "information" in low or "electronic" in low:
        return "Technology"
    if "capital market" in low or "bank" in low or "insurance" in low or "financial" in low:
        return "Financial"
    if "aerospace" in low or "defense" in low or "industrial" in low or "engineering" in low:
        return "Industrial"
    if "gold" in low or "oil" in low or "mining" in low or "energy" in low or "uranium" in low:
        return "Energy/Mining"
    if "utilities" in low or "electric" in low or "renewable" in low or "solar" in low:
        return "Utilities"
    if "chemical" in low or "auto" in low or "steel" in low:
        return "Materials/Auto"
    return "Other"


def company_age_years(ipo_date: str | None) -> float | None:
    if not ipo_date:
        return None
    with suppress(Exception):
        ipo = datetime.strptime(ipo_date[:10], "%Y-%m-%d")
        return round((datetime.now() - ipo).days / 365.25, 1)
    return None


ALL_BUCKETS = (
    "cap_300m_1b",
    "cap_1b_10b",
    "cap_10b_100b",
    "cap_100b_300b",
    "cap_300b_plus",
    "below_300m_or_unknown",
)
MAIN_BUCKETS = ALL_BUCKETS[:5]  # exclude below_300m_or_unknown


def cap_bucket(market_cap: float | None) -> str:
    if market_cap is None:
        return "below_300m_or_unknown"
    if market_cap < 300_000_000:
        return "below_300m_or_unknown"
    if market_cap < 1_000_000_000:
        return "cap_300m_1b"
    if market_cap < 10_000_000_000:
        return "cap_1b_10b"
    if market_cap < 100_000_000_000:
        return "cap_10b_100b"
    if market_cap < 300_000_000_000:
        return "cap_100b_300b"
    return "cap_300b_plus"


def cap_bucket_label(bucket: str) -> str:
    return {
        "below_300m_or_unknown": "<$300M or Unknown",
        "cap_300m_1b": "$300M~1B",
        "cap_1b_10b": "$1B~10B",
        "cap_10b_100b": "$10B~100B",
        "cap_100b_300b": "$100B~300B",
        "cap_300b_plus": "$300B~",
    }[bucket]


def first_ticker(tickers_csv: str | None) -> str | None:
    if not tickers_csv:
        return None
    parts = [part.strip().upper() for part in tickers_csv.split(",") if part.strip()]
    return parts[0] if parts else None


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def classify_case(title: str, body: str, full_text: str, industry: str | None = None, description: str | None = None) -> str:
    text = normalize_text(title, body)
    if not text.strip():
        text = normalize_text(title, body, full_text)
    candidate = None
    fallback = None
    for rule in CATEGORY_RULES:
        if any(pat.search(text) for pat in rule.compiled):
            if candidate is None:
                candidate = rule.name
            elif fallback is None:
                fallback = rule.name
                break
    if candidate is None:
        return "general_corporate_pr"
    # Industry + description-aware refinement for clinical_regulatory
    if candidate in ("clinical_regulatory_positive", "clinical_regulatory_negative"):
        is_clinical_industry = bool(industry and industry in CLINICAL_CORE_INDUSTRIES)
        is_clinical_desc = False
        if description:
            desc_lower = description.lower()
            is_clinical_desc = any(pat.search(desc_lower) for pat in DESC_CLINICAL_COMPILED)
        if not is_clinical_industry and not is_clinical_desc:
            # Neither industry nor description indicates clinical/biotech focus
            has_strong = any(pat.search(text) for pat in STRONG_CLINICAL_COMPILED)
            if not has_strong:
                return fallback or "general_corporate_pr"
    return candidate


def category_meta(name: str) -> tuple[str, str]:
    for rule in CATEGORY_RULES:
        if rule.name == name:
            return rule.label_ko, rule.description_ko
    return ("일반 corporate PR", "conference, publication, appointment, facility update 등 일반 PR성 공지")


CASE_TYPE_GUIDANCE: dict[str, dict[str, object]] = {
    "earnings_guidance_positive": {
        "top_level": "long",
        "definition": "실적 호조, 수익성 개선, 가이던스 상향처럼 기업가치 상방 경로를 직접 시사하는 실적성 공지",
        "value_path": "실적/전망 개선이 밸류에이션 상향과 추정치 상향으로 연결된다.",
        "include_signals": ["beat", "raises guidance", "record revenue", "strong outlook"],
        "exclude_signals": ["단순 실적 발표이지만 miss 또는 guidance cut인 경우", "실적 언급 없이 일반 홍보만 있는 경우"],
        "boundary_case": "실적 발표와 계약 공지가 함께 있으면 headline/lead의 중심 사건이 실적인지 먼저 본다.",
        "quick_questions": ["실적 beat 또는 guidance raise가 핵심인가?", "headline만 읽어도 숫자 개선이 메인 메시지인가?"],
    },
    "clinical_regulatory_positive": {
        "top_level": "long",
        "definition": "임상 성공, 규제 승인, NDA/BLA acceptance처럼 바이오 가치 상방을 직접 시사하는 공지",
        "value_path": "개발자산 성공 확률 상승과 상업화 기대 확대로 연결된다.",
        "include_signals": ["positive topline", "approval", "FDA acceptance", "pivotal data"],
        "exclude_signals": ["trial 언급이 있어도 실패/미충족인 경우", "연구 개시만 있고 결과가 없는 경우"],
        "boundary_case": "trial/result 단어만으로 분류하지 말고 결과 방향이 positive인지 확인한다.",
        "quick_questions": ["결과가 성공/승인/수용인가?", "핵심 자산 가치가 올라가는 메시지인가?"],
    },
    "clinical_regulatory_negative": {
        "top_level": "short",
        "definition": "임상 실패, CRL, endpoint 미충족, 중단 등 바이오 가치 훼손을 직접 시사하는 공지",
        "value_path": "핵심 자산 성공 확률 하락과 상업화 지연으로 연결된다.",
        "include_signals": ["CRL", "failed to meet", "did not meet", "clinical hold", "discontinued"],
        "exclude_signals": ["trial 결과가 positive인 경우", "단순 등록/개시 announcement인 경우"],
        "boundary_case": "같은 trial 관련 기사라도 결과 방향이 negative일 때만 이 유형이다.",
        "quick_questions": ["핵심 endpoint 실패나 규제 setback인가?", "기사 핵심이 개발 리스크 확대인가?"],
    },
    "earnings_guidance_negative": {
        "top_level": "short",
        "definition": "실적 miss, 성장 둔화, 가이던스 하향처럼 펀더멘털 하방을 직접 시사하는 실적성 공지",
        "value_path": "추정치 하향과 multiple 압박으로 연결된다.",
        "include_signals": ["missed", "lowered guidance", "cuts guidance", "weak outlook"],
        "exclude_signals": ["실적 발표이지만 beat/record revenue인 경우", "일회성 PR인 경우"],
        "boundary_case": "실적 발표 자체가 아니라 내용의 방향이 하향인지 본다.",
        "quick_questions": ["가이던스 cut 또는 miss가 핵심인가?", "숫자/전망 악화가 headline에 드러나는가?"],
    },
    "financing_offering": {
        "top_level": "short",
        "definition": "희석성 자금조달, 공모/사모, warrants, notes offering 등 주주가치 희석 가능성이 큰 공지",
        "value_path": "지분 희석 또는 자본비용 증가 우려로 연결된다.",
        "include_signals": ["public offering", "private placement", "registered direct", "warrant", "notes offering"],
        "exclude_signals": ["비희석성 grant/contract funding", "단순 refinancing 안내"],
        "boundary_case": "자금조달이라도 non-dilutive 성격이 강하면 strategic_deal_policy나 residual을 검토한다.",
        "quick_questions": ["주식/워런트/전환증권 발행이 핵심인가?", "기존 주주 희석 가능성이 직접 언급되는가?"],
    },
    "litigation_investigation": {
        "top_level": "short",
        "definition": "소송, 조사, 회계 문제, fraud allegation처럼 법률/신뢰 리스크를 직접 시사하는 공지",
        "value_path": "규제/법률 비용 상승과 사업 불확실성 확대에 연결된다.",
        "include_signals": ["lawsuit", "subpoena", "investigation", "restatement", "fraud"],
        "exclude_signals": ["단순 합의 완료 또는 리스크 해소 공지", "일반 법무 업데이트"],
        "boundary_case": "리스크 해소 기사라면 long 가능성도 다시 본다.",
        "quick_questions": ["핵심 메시지가 법적/회계 리스크 발생인가?", "사업보다 조사/소송 자체가 메인인가?"],
    },
    "strategic_review_restructuring": {
        "top_level": "short",
        "definition": "구조조정, 생존성 이슈, strategic alternatives, going concern처럼 사업 지속성 리스크를 시사하는 공지",
        "value_path": "현금 압박, 생존성 우려, 구조조정 비용 확대에 연결된다.",
        "include_signals": ["strategic alternatives", "restructuring", "layoff", "going concern", "bankruptcy"],
        "exclude_signals": ["성장 투자 목적의 조직 개편", "일반 비용 관리 코멘트"],
        "boundary_case": "효율화 표현이 있어도 생존성 우려가 핵심인지 아닌지 구분한다.",
        "quick_questions": ["회사가 버티기/정리 모드에 들어갔다는 신호인가?", "핵심이 성장보다 생존인가?"],
    },
    "strategic_deal_policy": {
        "top_level": "long",
        "definition": "대형 계약, 제휴, 라이선스, 정부지원, 인수 등 외부 자원 결합으로 가치 상방을 시사하는 공지",
        "value_path": "수주/파트너십/외부자금 유입이 매출 가시성과 전략 가치를 높인다.",
        "include_signals": ["partnership", "collaboration", "license", "award", "contract", "grant"],
        "exclude_signals": ["형식적 MOU만 있고 경제 조건이 빈약한 경우", "희석성 financing이 핵심인 경우"],
        "boundary_case": "agreement라는 단어만으로 분류하지 말고 실제 경제적 연결이 있는지 본다.",
        "quick_questions": ["외부 계약/제휴/지원이 실질 경제 이벤트인가?", "매출 또는 전략 자산 가치 증가 경로가 보이는가?"],
    },
    "listing_capital_markets": {
        "top_level": "long",
        "definition": "상장, 업리스트, 거래 재개 등 자본시장 접근성 변화가 핵심인 공지",
        "value_path": "유동성 확대와 투자자 접근성 개선으로 연결된다.",
        "include_signals": ["uplisting", "listed on", "market debut", "trade resumption"],
        "exclude_signals": ["상장 유지 실패/비준수 공지", "자금조달 공지가 핵심인 경우"],
        "boundary_case": "listing 관련 기사라도 non-compliance나 delisting risk면 short 쪽을 본다.",
        "quick_questions": ["핵심이 거래소 접근성 개선인가?", "자본시장 구조 변화가 중심 사건인가?"],
    },
    "commercial_launch_expansion": {
        "top_level": "long",
        "definition": "제품 launch, 시설 확장, 생산/상업화 확대처럼 사업 확장 이벤트가 중심인 공지",
        "value_path": "매출 기반 확장과 운영 레버리지 개선 기대에 연결된다.",
        "include_signals": ["launch", "facility", "expansion", "commercial", "production"],
        "exclude_signals": ["단순 행사 발표", "기술 소개 수준의 PR"],
        "boundary_case": "확장 표현이 있어도 실제 사업 확장인지, 홍보성 소개인지 구분한다.",
        "quick_questions": ["실제 상업화/생산/시설 확장이 핵심인가?", "운영 규모 확대가 직접 보이는가?"],
    },
    "analyst_rating_target": {
        "top_level": "residual",
        "definition": "애널리스트 rating/target 변화처럼 외부 해석이 중심인 기사",
        "value_path": "직접 기업 이벤트보다는 해석/coverage 변화에 따른 수급 반응으로 연결된다.",
        "include_signals": ["upgrade", "downgrade", "price target", "coverage initiated"],
        "exclude_signals": ["회사 자체 PR 본문이 중심인 경우", "실적/계약 등 직접 이벤트가 중심인 경우"],
        "boundary_case": "회사 이벤트를 인용하더라도 sell-side 의견 변화가 메인이면 이 유형이다.",
        "quick_questions": ["기사의 주체가 회사가 아니라 애널리스트인가?", "핵심이 rating/target 변화인가?"],
    },
    "macro_policy_sector": {
        "top_level": "residual",
        "definition": "정책, 관세, 금리, 지정학 등 회사 고유 이벤트가 아닌 외부 매크로/섹터 기사",
        "value_path": "기업 개별 이슈보다 외부 환경 변화에 따른 재평가로 연결된다.",
        "include_signals": ["tariff", "policy", "interest rates", "inflation", "sanction"],
        "exclude_signals": ["회사 개별 계약/실적/임상 공지", "기업 내부 이벤트가 중심인 경우"],
        "boundary_case": "정책 기사라도 특정 회사 계약/승인이 핵심이면 다른 유형으로 보낸다.",
        "quick_questions": ["회사 내부 사건보다 외부 정책/매크로가 중심인가?", "같은 문장을 여러 종목에 붙여도 의미가 통하는가?"],
    },
    "general_corporate_pr": {
        "top_level": "residual",
        "definition": "일반 corporate PR, 홍보성 공지, 경계가 흐린 업데이트를 담는 잔여 유형",
        "value_path": "직접 경제 이벤트가 약하거나 반복 패턴이 불안정해 residual로 남긴다.",
        "include_signals": ["appointment", "conference participation", "certification", "general update"],
        "exclude_signals": ["실적/계약/오퍼링/임상처럼 명확한 경제 사건이 있는 경우"],
        "boundary_case": "같은 단어가 있어도 실질 계약, 승인, financing이면 해당 독립 유형으로 보낸다.",
        "quick_questions": ["핵심 경제 이벤트가 불분명한가?", "반복성은 있으나 독립 유형으로 설명력이 약한가?"],
    },
}


def case_type_guidance(case_type: str) -> dict[str, object]:
    return CASE_TYPE_GUIDANCE.get(case_type, CASE_TYPE_GUIDANCE["general_corporate_pr"])


def top_level_group_for_case(case_type: str) -> str:
    return str(case_type_guidance(case_type).get("top_level") or "residual")


def load_company_context(conn: sqlite3.Connection) -> dict[str, dict]:
    """Load market_cap, industry, ipo_date, description for each ticker.

    description priority: yahoo > fmp > finnhub (finnhub has 0 descriptions).
    market_cap/ipo_date: latest fetched_at across all sources.
    industry: from securities table (not company_profiles).
    """
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    rows = cur.execute(
        """
        WITH cap_profile AS (
          SELECT s.ticker,
                 cp.market_cap,
                 cp.ipo_date,
                 ROW_NUMBER() OVER (PARTITION BY s.ticker ORDER BY cp.fetched_at DESC, cp.id DESC) AS rn
          FROM securities s
          JOIN company_profiles cp ON cp.security_id = s.id
          WHERE cp.market_cap IS NOT NULL
        ),
        desc_profile AS (
          SELECT s.ticker,
                 cp.description,
                 ROW_NUMBER() OVER (
                   PARTITION BY s.ticker
                   ORDER BY CASE cp.source WHEN 'yahoo' THEN 1 WHEN 'fmp' THEN 2 ELSE 3 END,
                            cp.fetched_at DESC, cp.id DESC
                 ) AS rn
          FROM securities s
          JOIN company_profiles cp ON cp.security_id = s.id
          WHERE cp.description IS NOT NULL AND cp.description != ''
        )
        SELECT cp2.ticker, cp2.market_cap, cp2.ipo_date, s.industry, dp.description
        FROM cap_profile cp2
        JOIN securities s ON s.ticker = cp2.ticker
        LEFT JOIN desc_profile dp ON dp.ticker = cp2.ticker AND dp.rn = 1
        WHERE cp2.rn = 1
        """
    ).fetchall()
    result: dict[str, dict] = {}
    for row in rows:
        ticker = str(row["ticker"]).upper()
        result[ticker] = {
            "market_cap": float(row["market_cap"]) if row["market_cap"] is not None else None,
            "industry": row["industry"] or "",
            "ipo_date": row["ipo_date"] or "",
            "description": row["description"] or "",
        }
    return result


def fetch_news_rows(conn: sqlite3.Connection, since: str, until: str) -> list[dict]:
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
                    AND ni.published_at < datetime(?, '+1 day')
          AND ni.source_type = 'press_release'
        GROUP BY ni.id
        """,
                (since, until),
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
        guidance = case_type_guidance(case_type)
        bucket_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
        source_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
        ind_group_breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
        for item in items:
            bucket_breakdown[item["market_cap_bucket"]]["total"] += 1
            source_breakdown[item["source_type"]]["total"] += 1
            ig = item.get("industry_group") or "Unknown"
            ind_group_breakdown[ig]["total"] += 1
            if item.get("is_impacted"):
                bucket_breakdown[item["market_cap_bucket"]]["impacted"] += 1
                source_breakdown[item["source_type"]]["impacted"] += 1
                ind_group_breakdown[ig]["impacted"] += 1

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
                "top_level": top_level_group_for_case(case_type),
                "label_ko": label_ko,
                "description_ko": description_ko,
                "definition": guidance.get("definition"),
                "value_path": guidance.get("value_path"),
                "include_signals": guidance.get("include_signals"),
                "exclude_signals": guidance.get("exclude_signals"),
                "boundary_case": guidance.get("boundary_case"),
                "quick_questions": guidance.get("quick_questions"),
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
                "industry_group_breakdown": dict(ind_group_breakdown),
                "top_examples": [
                    {
                        "news_id": item["id"],
                        "date": item["published_at"],
                        "ticker": item["ticker"],
                        "source_type": item["source_type"],
                        "title": item["title"],
                        "industry": item.get("industry") or "",
                        "industry_group": item.get("industry_group") or "Unknown",
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
                        "industry": item.get("industry") or "",
                        "industry_group": item.get("industry_group") or "Unknown",
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


def build_analysis(rows: list[dict], company_ctx: dict[str, dict]) -> dict:
    analyzable = []
    scores_by_bucket: dict[str, list[float]] = defaultdict(list)
    source_counts = Counter()
    source_with_change = Counter()
    bucket_counts = Counter()
    bucket_with_change = Counter()
    source_with_fulltext = Counter()
    industry_missing_count = 0

    for row in rows:
        ticker = first_ticker(row.get("tickers_csv"))
        row["ticker"] = ticker
        ctx = (company_ctx.get(ticker) if ticker else None) or {}
        row["market_cap"] = ctx.get("market_cap")
        row["industry"] = ctx.get("industry") or ""
        row["ipo_date"] = ctx.get("ipo_date") or ""
        row["description"] = ctx.get("description") or ""
        row["industry_group"] = industry_group(row["industry"])
        row["company_age_years"] = company_age_years(row["ipo_date"])
        if not row["industry"]:
            industry_missing_count += 1
        row["market_cap_bucket"] = cap_bucket(row.get("market_cap"))
        row["immediate_reaction_score"] = immediate_reaction_score(row)
        row["short_followthrough_score"] = short_followthrough_score(row)
        row["medium_persistence_score"] = medium_persistence_score(row)
        row["impact_score"] = overall_impact_score(row)
        direction, direction_metric, direction_value = direction_from_primary_metrics(row)
        row["direction"] = direction
        row["direction_metric"] = direction_metric
        row["direction_value"] = direction_value
        row["case_type"] = classify_case(row.get("title") or "", row.get("body") or "", row.get("full_text") or "", industry=row.get("industry"), description=row.get("description"))
        row["top_level"] = top_level_group_for_case(row["case_type"])
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
        for bucket in ALL_BUCKETS
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
    for bucket in ALL_BUCKETS:
        bucket_summary.append(
            {
                "bucket": bucket,
                "label": cap_bucket_label(bucket),
                "total": bucket_counts.get(bucket, 0),
                "with_change": bucket_with_change.get(bucket, 0),
                "thresholds": thresholds.get(bucket),
            }
        )

    # Industry-group level summary across all analyzable rows
    ig_summary: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "impacted": 0})
    for row in analyzable:
        ig = row.get("industry_group") or "Unknown"
        ig_summary[ig]["total"] += 1
        if row.get("is_impacted"):
            ig_summary[ig]["impacted"] += 1

    return {
        "thresholds": thresholds,
        "analyzable_rows": len(analyzable),
        "total_rows": len(rows),
        "industry_missing_count": industry_missing_count,
        "industry_group_summary": dict(ig_summary),
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
        "| top_level | case_type | reaction_tag | news_id | published_at | source_type | ticker | industry | industry_group | ipo_date | market_cap | market_cap_bucket | change_pct | change_from_open_pct | change_open_to_high_pct | change_1d_pct | change_3d_pct | change_7d_pct | change_14d_pct | change_30d_pct | immediate_reaction_score | short_followthrough_score | medium_persistence_score | overall_impact_score | title |",
        "|-----------|-----------|--------------|---------|--------------|-------------|--------|----------|----------------|----------|------------|-------------------|------------|----------------------|--------------------------|---------------|---------------|---------------|----------------|----------------|--------------------------|---------------------------|--------------------------|----------------------|-------|",
    ]
    for row in rows:
        title = (row.get("title") or "").replace("|", "\\|").replace("\n", " ")
        market_cap = row.get("market_cap")
        lines.append(
            "| {top_level} | {case_type} | {reaction_tag} | {news_id} | {published_at} | {source_type} | {ticker} | {industry} | {industry_group} | {ipo_date} | {market_cap} | {market_cap_bucket} | {change_pct} | {change_from_open_pct} | {change_open_to_high_pct} | {change_1d_pct} | {change_3d_pct} | {change_7d_pct} | {change_14d_pct} | {change_30d_pct} | {immediate_reaction_score} | {short_followthrough_score} | {medium_persistence_score} | {impact_score} | {title} |".format(
                top_level=row.get("top_level") or "residual",
                case_type=row.get("case_type") or "",
                reaction_tag=row.get("reaction_tag") or "",
                news_id=row.get("id") or "",
                published_at=row.get("published_at") or "",
                source_type=row.get("source_type") or "",
                ticker=row.get("ticker") or "",
                industry=(row.get("industry") or "").replace("|", "/"),
                industry_group=row.get("industry_group") or "Unknown",
                ipo_date=row.get("ipo_date") or "",
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
    grouped_summaries: dict[str, list[dict]] = {"long": [], "short": [], "residual": []}
    top_level_titles = {
        "long": "🟢 long",
        "short": "🔴 short",
        "residual": "⚪ residual",
    }
    for summary in analysis["case_summaries"]:
        grouped_summaries.setdefault(summary.get("top_level") or "residual", []).append(summary)

    lines.append(f"# 🎯 {note_title}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📌 분석 전제")
    lines.append("")
    lines.append(f"- 생성 시각: {datetime.now().strftime('%Y-%m-%d %H:%M')} (local)")
    lines.append(f"- 분석 범위: `press_release only` / `{since} ~ {until}`")
    lines.append(f"- 전체 뉴스 수: {analysis['total_rows']:,}")
    lines.append(f"- change 기반 분석 가능 뉴스 수: {analysis['analyzable_rows']:,}")
    lines.append("- source 범위는 `press_release only`로 고정했다.")
    lines.append("- 기간 내 `press_release` 전체를 1차 전수 스캔하고, 각 row에 ticker, market cap, industry(securities.industry), ipo_date(company_profiles.ipo_date), change vector를 붙였다.")
    lines.append("- 외부 링크는 다시 열지 않고 `news_items`, `news_fulltext`, `news_change_metrics`, `company_profiles`, `securities` 테이블만 사용했다.")
    lines.append(f"- industry 누락 row: {analysis.get('industry_missing_count', 'n/a')}건")
    lines.append("- `company_profiles.description`은 yahoo 우선 기준으로 1683/1698 ticker에서 확보되며, 이번 분석에서는 industry 보정의 2차 컨텍스트로 사용했다.")
    lines.append("")
    lines.append("## 🗂️ 빠른 요약 표")
    lines.append("")
    lines.append("| 상위 분류 | 순위 | case_type | 총 건수 | 영향 미침 | 영향 비율 | Wilson LB |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for top_level in ("long", "short", "residual"):
        summaries = grouped_summaries.get(top_level) or []
        for index, summary in enumerate(summaries, start=1):
            lines.append(
                f"| {top_level_titles.get(top_level, top_level)} | {index} | {summary['label_ko']} | {summary['total']:,} | {summary['impacted']:,} | {summary['impact_ratio']:.3f} | {summary['impact_ratio_wilson_lb']:.3f} |"
            )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🧭 유형 분류 기준")
    lines.append("")
    lines.append("- 먼저 `title/body/full_text`의 언어적 의미를 기준으로 `long / short / residual` 상위 분류를 정했다.")
    lines.append("- 그 다음 반복되는 사건 패턴을 기준으로 세부 `case_type`을 묶었다.")
    lines.append("- 의미가 크게 다른 바이오 positive / negative, financing, litigation, earnings, strategic deal 등은 분리했다.")
    lines.append("- **industry 기반 분류 보정**: `clinical_regulatory_positive/negative`는 Biotech/Pharma/Medical Device 산업에서만 우선 적용한다.")
    lines.append("  - 비(非)임상 산업(Tech, Industrial 등)에서 'approval', 'study', 'trial' 같은 범용 키워드가 잡히면 strong clinical signal(phase 1-4, NDA, BLA, topline, pivotal 등) 없이는 해당 유형으로 분류하지 않고, 차순위 매칭 또는 general_corporate_pr로 귀속시켰다.")
    lines.append("- 애매한 표현은 대표 사례와 반례를 비교해 가장 설명력이 높은 유형으로 귀속했다.")
    lines.append("- 가격 데이터는 유형 생성 기준이 아니라, 유형별 영향 빈도 평가에만 사용했다.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🧱 유형별 정의 요약")
    lines.append("")
    for top_level in ("long", "short", "residual"):
        summaries = grouped_summaries.get(top_level) or []
        lines.append(f"### {top_level_titles.get(top_level, top_level)}")
        lines.append("")
        if not summaries:
            lines.append("- 해당 상위 분류에 집계된 유형이 없다.")
            lines.append("")
            continue
        for index, summary in enumerate(summaries, start=1):
            lines.append(f"#### {top_level}-{index}. {summary['label_ko']} (`{summary['case_type']}`)")
            lines.append(f"- 상위 분류: `{summary['top_level']}`")
            lines.append(f"- 한 줄 정의: {summary['definition']}")
            lines.append(f"- 핵심 가치 경로: {summary['value_path']}")
            lines.append(f"- 포함 신호: {', '.join(summary['include_signals'])}")
            lines.append(f"- 제외 신호: {', '.join(summary['exclude_signals'])}")
            lines.append(f"- 경계 사례: {summary['boundary_case']}")
            lines.append(f"- 빠른 판별 질문: {' / '.join(summary['quick_questions'])}")
            if summary["top_examples"]:
                example = summary["top_examples"][0]
                lines.append(f"- 대표 뉴스 id / ticker / title: {example['news_id']} / {example['ticker']} / {example['title']}")
            lines.append(f"- 집계: impacted={summary['impacted']:,} / total={summary['total']:,}, ratio={summary['impact_ratio']:.3f}")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 📐 영향 판정 기준")
    lines.append("")
    lines.append("- 사용한 전체 change vector: `change_from_open_pct`, `change_open_to_high_pct`, `change_pct`, `change_1d_pct`, `change_3d_pct`, `change_7d_pct`, `change_14d_pct`, `change_30d_pct`")
    lines.append("- `immediate_reaction_score = max(abs(change_from_open_pct), abs(change_open_to_high_pct), abs(change_pct))`")
    lines.append("- `short_followthrough_score = max(abs(change_1d_pct), abs(change_3d_pct))`")
    lines.append("- `medium_persistence_score = max(abs(change_7d_pct), abs(change_14d_pct), abs(change_30d_pct))`")
    lines.append("- `overall_impact_score = max(immediate_reaction_score, short_followthrough_score, medium_persistence_score)`")
    lines.append("- 영향 여부는 같은 market cap bucket 안에서 `overall_impact_score >= p80` 인지로 판정했다.")
    lines.append("")
    lines.append("## 🪜 market cap bucket 기준")
    lines.append("")
    lines.append("- 주 버킷: `300M~1B`, `1B~10B`, `10B~100B`, `100B~300B`, `300B~`")
    lines.append("- 보조 집단: `<300M or Unknown`")
    lines.append("- 소형주와 대형주를 같은 절대 변동폭 기준으로 자르면 과대/과소 판정이 생기므로 bucket별 threshold를 분리했다.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🧠 내부 사고과정 로그(주요 판단 요약)")
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
    lines.append("   - 최종 결정: `300M~1B`, `1B~10B`, `10B~100B`, `100B~300B`, `300B~` 5단계 주 버킷으로 나눠 각 버킷별 `p80`을 threshold로 사용했다.")
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
    lines.append("---")
    lines.append("")
    lines.append("## 📎 근거 표 파일")
    lines.append("")
    lines.append(f"- 근거 표 파일 경로: `{evidence_path}`")
    lines.append("- 이 파일은 현재 note와 같은 제목 기준으로 만든 전체 근거 뉴스 표다.")
    lines.append("- 각 행에는 case_type, reaction_tag, news_id, ticker, market_cap, 전체 change window, 구간 점수, overall score를 기록했다.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📦 데이터 가용성")
    lines.append("")
    lines.append("| source_type | total | with_change | with_fulltext |")
    lines.append("| --- | ---: | ---: | ---: |")
    for source in analysis["source_summary"]:
        lines.append(f"| {source['source_type']} | {source['total']:,} | {source['with_change']:,} | {source['with_fulltext']:,} |")
    lines.append("")
    lines.append("## 📊 market cap bucket별 impact 기준")
    lines.append("")
    lines.append("| bucket | total | with_change | p50 | p80 | p90 |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for item in analysis["bucket_summary"]:
        meta = item.get("thresholds")
        lines.append(
            f"| {item['label']} | {item['total']:,} | {item['with_change']:,} | {format_float(meta['p50']) if meta else 'n/a'} | {format_float(meta['p80']) if meta else 'n/a'} | {format_float(meta['p90']) if meta else 'n/a'} |"
        )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📚 전체 유형 분류 결과")
    lines.append("")
    for top_level in ("long", "short", "residual"):
        summaries = grouped_summaries.get(top_level) or []
        if not summaries:
            continue
        lines.append(f"### {top_level_titles.get(top_level, top_level)} 그룹")
        lines.append("")
        for index, summary in enumerate(summaries, start=1):
            lines.append("---")
            lines.append("")
            lines.append(f"#### {top_level}-{index}. {summary['label_ko']}")
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
            lines.append(f"- industry group breakdown: {json.dumps(summary.get('industry_group_breakdown', {}), ensure_ascii=False)}")
            lines.append("- 대표 사례:")
            for example in summary["top_examples"][:3]:
                lines.append(
                    f"  - {example['news_id']} | {example['date']} | {example['source_type']} | {example['ticker']} | {example.get('industry', '')} | {example['title']} | change={example['change_pct']} | change_1d={example['change_1d_pct']} | change_3d={example['change_3d_pct']} | change_7d={example['change_7d_pct']} | intraday={example['change_from_open_pct']} | tag={example['reaction_tag']} | cap={example['market_cap_bucket']}"
                )
            if summary["counter_examples"]:
                lines.append("- 반례/영향 약한 사례:")
                for example in summary["counter_examples"][:2]:
                    lines.append(
                        f"  - {example['news_id']} | {example['date']} | {example['source_type']} | {example['ticker']} | {example.get('industry', '')} | {example['title']} | change={example['change_pct']} | change_1d={example['change_1d_pct']} | change_3d={example['change_3d_pct']} | change_7d={example['change_7d_pct']} | intraday={example['change_from_open_pct']} | tag={example['reaction_tag']} | cap={example['market_cap_bucket']}"
                    )
            lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🥇 버킷별 상위 case")
    lines.append("")
    for bucket in MAIN_BUCKETS:
        summaries = analysis["bucket_case_summaries"].get(bucket) or []
        lines.append(f"### {cap_bucket_label(bucket)} 상위 case")
        lines.append("")
        for index, summary in enumerate(summaries[:5], start=1):
            lines.append(
                f"- {index}. {summary['label_ko']}: impacted={summary['impacted']:,} / total={summary['total']:,}, ratio={summary['impact_ratio']:.3f}, Wilson={summary['impact_ratio_wilson_lb']:.3f}"
            )
        lines.append("")
    # Industry group summary section
    ig_summary = analysis.get("industry_group_summary", {})
    if ig_summary:
        lines.append("---")
        lines.append("")
        lines.append("## 🏭 산업 그룹별 분석")
        lines.append("")
        lines.append("- `securities.industry`를 7개 그룹(Biotech/Pharma/MedDev, Technology, Financial, Industrial, Energy/Mining, Utilities, Materials/Auto, Other, Unknown)으로 묶어 집계했다.")
        lines.append("- 유형 분류 시 `clinical_regulatory_positive/negative`는 Biotech/Pharma/MedDev 그룹에서만 우선 적용하고, 비임상 산업에서는 strong clinical signal이 없으면 차순위 매칭 또는 general_corporate_pr로 귀속했다.")
        lines.append("")
        lines.append("| industry_group | total | impacted | impact_ratio |")
        lines.append("|----------------|-------|----------|-------------|")
        for ig_name, ig_vals in sorted(ig_summary.items(), key=lambda x: x[1]["total"], reverse=True):
            ig_total = ig_vals["total"]
            ig_impacted = ig_vals["impacted"]
            ig_ratio = ig_impacted / ig_total if ig_total else 0.0
            lines.append(f"| {ig_name} | {ig_total:,} | {ig_impacted:,} | {ig_ratio:.3f} |")
        lines.append("")
        lines.append("- 같은 case_type이라도 산업 그룹에 따라 impact_ratio가 다를 수 있으며, 각 case_type별 industry_group_breakdown은 '전체 유형 분류 결과' 섹션에서 확인 가능하다.")
        lines.append("")

    # Company context limitation note
    lines.append("---")
    lines.append("")
    lines.append("## 🧾 기업 컨텍스트 데이터 활용 현황")
    lines.append("")
    lines.append("- `industry` (securities.industry): 1695/1698 ticker 보유 (99.8%). clinical_regulatory 유형 분류 보정에 활용 중.")
    lines.append("- `description` (company_profiles.description, yahoo 우선): 1683/1698 ticker 보유 (99.1%). clinical/biotech 여부 판단의 2차 보정 레이어로 활용 중.")
    lines.append("  - industry가 CLINICAL_CORE_INDUSTRIES에 없더라도, description에서 biotech/pharma/therapeutic 등 핵심 키워드가 감지되면 clinical_regulatory 분류를 유지한다.")
    lines.append("  - description source 우선순위: yahoo(1683건) > fmp(51건) > finnhub(0건).")
    lines.append("- `ipo_date` (company_profiles.ipo_date): 1690/1698 ticker 보유 (99.5%). 증거 표에 기록했으나 분류 보정에는 아직 미반영.")
    lines.append("- `peers_json` (company_profiles.peers_json): 1656/1698 ticker 보유 (97.5%). 유사사례 탐색에 활용 가능하나 이번 전수 집계에서는 미사용.")
    lines.append("")

    token = analysis["token_estimate"]
    lines.append("---")
    lines.append("")
    lines.append("## 💰 토큰 비용 추정")
    lines.append("")
    lines.append("- 가정: 영어 기사 기준 `1 token ~= 4 chars`, 기사별 프롬프트 오버헤드 180 tokens, 출력 120 tokens")
    lines.append(f"- 전체 문자 수: {token['total_chars']:,}")
    lines.append(f"- raw input tokens 추정: {token['raw_input_tokens_estimate']:,}")
    lines.append(f"- naive article-by-article total tokens 추정: {token['estimated_total_tokens_naive_article_by_article']:,}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🔎 해석")
    lines.append("")
    lines.append("- 바이오 임상·규제는 positive/negative를 분리해야 한다. 같은 `trial`/`topline` 키워드라도 결과 방향에 따라 주가 반응이 반대일 수 있다.")
    lines.append("- **industry + description 기반 분류 보정**: 비(非)임상 산업에서 'approval', 'study' 같은 범용 키워드가 잡히면 clinical_regulatory로 오분류될 수 있으므로, industry가 Biotech/Pharma/MedDev가 아니고 description에서도 임상/바이오 핵심 키워드가 없는 경우 strong clinical signal 유무로 필터링했다.")
    lines.append("- 이번 note는 `press_release only` 기준이라, 동일 taxonomy를 다른 source에 그대로 적용하면 비율이 달라질 수 있다.")
    lines.append("- `300M~1B` 버킷은 동일한 뉴스 유형에서도 절대 변동폭이 더 크게 나오기 쉬우므로, 대형주와 같은 기준으로 자르면 과대판정되기 쉽다.")
    lines.append("- `<$300M or Unknown` 집단은 전체 데이터에서 비중이 아직 크므로, 다음 단계에서는 market cap 보강이 되면 5개 주 버킷 비교가 더 안정된다.")
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
    parser.add_argument("--until", default="")
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
    company_ctx = load_company_context(conn)
    until = args.until or datetime.now().strftime("%Y-%m-%d")
    news_rows = fetch_news_rows(conn, args.since, until)
    analysis = build_analysis(news_rows, company_ctx)
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
                "market_cap_buckets=$300M~1B|$1B~10B|$10B~100B|$100B~300B|$300B~|<$300M or Unknown",
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