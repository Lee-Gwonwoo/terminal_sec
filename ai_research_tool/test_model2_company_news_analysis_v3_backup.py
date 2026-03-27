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
    resolve_note_title,
    short_followthrough_score,
    update_research_page,
)


CASE_META: dict[str, dict[str, object]] = {
    "earnings_beat_raise_positive": {"label_ko": "실적 호조·가이던스 상향", "top_level": "long", "definition": "실적 beat, 가이던스 상향, strong results가 핵심인 기사다.", "value_path": "추정치 상향과 multiple rerating으로 이어진다.", "include_signals": ["beat estimates", "raises guidance", "better-than-expected", "record revenue"], "exclude_signals": ["earnings preview", "earnings call transcript"], "quick_questions": ["실제 결과 기사인가?", "headline 중심이 beat/raise인가?"]},
    "earnings_miss_cut_negative": {"label_ko": "실적 부진·가이던스 하향", "top_level": "short", "definition": "실적 miss, weak outlook, guidance cut이 핵심인 기사다.", "value_path": "추정치 하향과 밸류에이션 압축으로 이어진다.", "include_signals": ["misses estimates", "cuts guidance", "weak outlook", "profit warning"], "exclude_signals": ["preview", "transcript"], "quick_questions": ["실제 결과 기사인가?", "miss/cut이 중심인가?"]},
    "earnings_preview_watch": {"label_ko": "실적 발표 전 기대 기사", "top_level": "residual", "definition": "실적 발표 전 기대치나 watch 포인트를 설명하는 기사다.", "value_path": "직접 이벤트보다 기대 형성 단계다.", "include_signals": ["ahead of earnings", "to report q1 results", "wall street expects"], "exclude_signals": ["beat estimates", "misses estimates"], "quick_questions": ["실제 결과가 아니라 preview인가?"]},
    "earnings_transcript_snapshot": {"label_ko": "실적 transcript·snapshot", "top_level": "residual", "definition": "earnings call transcript, snapshot, highlights 같은 요약 기사다.", "value_path": "원인 기사보다 후행 정리 기사다.", "include_signals": ["earnings call transcript", "earnings snapshot", "highlights"], "exclude_signals": ["beat estimates", "cuts guidance"], "quick_questions": ["새 사건보다 정리/전사본인가?"]},
    "analyst_upgrade_positive": {"label_ko": "애널리스트 상향·커버리지 개시", "top_level": "long", "definition": "buy/outperform, coverage initiation, target raise가 핵심인 기사다.", "value_path": "sell-side 평가 상향이 수급 유입과 re-rating으로 이어진다.", "include_signals": ["initiates coverage", "outperform", "raises price target", "buy rating"], "exclude_signals": ["target cut", "downgraded"], "quick_questions": ["formal analyst action인가?", "상향 메시지인가?"]},
    "analyst_downgrade_negative": {"label_ko": "애널리스트 하향·목표가 하향", "top_level": "short", "definition": "downgrade, underperform, target cut이 핵심인 기사다.", "value_path": "sell-side 평가 하향이 기대치 조정과 수급 이탈로 이어진다.", "include_signals": ["downgraded", "underperform", "lowers price target", "target cut"], "exclude_signals": ["initiates coverage", "raises price target"], "quick_questions": ["formal downgrade 또는 target cut인가?"]},
    "analyst_note_amplification_positive": {"label_ko": "애널리스트 코멘트 증폭·긍정", "top_level": "long", "definition": "formal upgrade는 아니지만 긍정 analyst note/mention이 가격 해설의 핵심인 기사다.", "value_path": "단일 note 증폭이 short-term sentiment와 flow 유입을 만든다.", "include_signals": ["analyst says", "citi says", "bofa says", "bullish note"], "exclude_signals": ["formal upgrade", "company contract award"], "quick_questions": ["rating action보다 note 증폭인가?", "긍정 논지인가?"]},
    "analyst_note_amplification_negative": {"label_ko": "애널리스트 코멘트 증폭·부정", "top_level": "short", "definition": "formal downgrade는 아니지만 target skepticism이나 cautious note가 핵심인 기사다.", "value_path": "보수적 note가 기대치와 단기 수급을 꺾는다.", "include_signals": ["analyst warns", "cautious note", "bearish note", "skeptical analyst"], "exclude_signals": ["formal downgrade", "earnings miss"], "quick_questions": ["정식 하향보다 note 증폭인가?", "부정 논지인가?"]},
    "government_contract_award_positive": {"label_ko": "정부·대형 계약 수주", "top_level": "long", "definition": "prime contractor, definitive contract, government award가 핵심인 기사다.", "value_path": "매출 가시성과 backlog 확대를 직접 시사한다.", "include_signals": ["contract award", "wins contract", "prime contractor", "government contract"], "exclude_signals": ["generic partnership", "grant commentary"], "quick_questions": ["실제 수주가 headline 핵심인가?"]},
    "partnership_license_positive": {"label_ko": "제휴·라이선스·협업", "top_level": "long", "definition": "partnership, collaboration, licensing deal이 핵심인 기사다.", "value_path": "외부 자원 결합과 channel 확대가 가치 상승 경로를 만든다.", "include_signals": ["partnership", "collaboration", "license agreement", "exclusive global license"], "exclude_signals": ["offering", "lawsuit"], "quick_questions": ["경제적 제휴인가?", "실질 협업이 핵심인가?"]},
    "commercial_launch_expansion_positive": {"label_ko": "출시·상업화·확장", "top_level": "long", "definition": "launch, rollout, expansion, commercialization이 핵심인 기사다.", "value_path": "제품/서비스 확대가 미래 매출과 채택 증가로 이어진다.", "include_signals": ["launches", "launch", "expands", "commercial launch"], "exclude_signals": ["event promotion", "generic preview"], "quick_questions": ["실제 상업화/확장 이벤트인가?"]},
    "demand_backlog_positive": {"label_ko": "수요 급증·백로그 확대", "top_level": "long", "definition": "strong demand, bookings, backlog growth가 핵심인 기사다.", "value_path": "수요 가시성이 매출 성장 지속성 기대를 만든다.", "include_signals": ["strong demand", "demand surge", "backlog", "bookings growth"], "exclude_signals": ["macro demand commentary", "general feature"], "quick_questions": ["수요/백로그가 직접 언급되는가?"]},
    "customer_adoption_positive": {"label_ko": "고객 채택·대형 고객 확보", "top_level": "long", "definition": "major customer win, adoption, deployment 확대가 핵심인 기사다.", "value_path": "고객 기반 확대가 매출과 credibility 상승으로 이어진다.", "include_signals": ["customer win", "adoption", "selected by", "deployment"], "exclude_signals": ["generic partnership", "watchlist article"], "quick_questions": ["고객 채택이 headline 중심인가?"]},
    "shareholder_return_positive": {"label_ko": "자사주 매입·주주환원", "top_level": "long", "definition": "share repurchase, buyback, dividend hike가 핵심인 기사다.", "value_path": "주주환원 강화가 수급과 자본배분 신뢰를 개선한다.", "include_signals": ["share repurchase", "buyback", "increases dividend", "returns capital"], "exclude_signals": ["capital raise", "reverse split"], "quick_questions": ["주주환원 강화가 핵심인가?"]},
    "mna_strategic_asset_positive": {"label_ko": "M&A·전략자산 거래", "top_level": "long", "definition": "acquisition, merger, buyout, strategic investment가 핵심인 기사다.", "value_path": "전략 자산 가치 재평가와 사업 재편 기대를 만든다.", "include_signals": ["acquisition", "merger", "buyout", "strategic investment"], "exclude_signals": ["distress sale", "capital raise"], "quick_questions": ["자산/회사 거래가 headline 핵심인가?"]},
    "regulatory_clinical_positive": {"label_ko": "승인·임상 호재", "top_level": "long", "definition": "FDA approval, positive topline, NDA/BLA acceptance가 핵심인 기사다.", "value_path": "핵심 자산 성공 확률 상승과 상업화 기대를 만든다.", "include_signals": ["fda approval", "positive topline", "nda acceptance", "pivotal data"], "exclude_signals": ["clinical hold", "failed endpoint"], "quick_questions": ["성공/승인이 headline 중심인가?"]},
    "regulatory_clinical_negative": {"label_ko": "규제·임상 악재", "top_level": "short", "definition": "CRL, endpoint failure, hold, rejection이 핵심인 기사다.", "value_path": "핵심 자산 가치 훼손과 일정 지연으로 이어진다.", "include_signals": ["complete response letter", "clinical hold", "failed to meet", "fda rejection"], "exclude_signals": ["positive topline", "approval"], "quick_questions": ["실패/보류가 중심인가?"]},
    "financing_dilution_negative": {"label_ko": "희석성 자금조달", "top_level": "short", "definition": "public offering, private placement, warrants, convertibles가 핵심인 기사다.", "value_path": "희석과 자본비용 상승 우려가 주가 하방으로 이어진다.", "include_signals": ["public offering", "private placement", "warrants", "convertible notes"], "exclude_signals": ["grant award", "non-dilutive funding"], "quick_questions": ["조달 자체가 headline 핵심인가?"]},
    "capital_structure_stress_negative": {"label_ko": "거래정지·역분할·상장유지 스트레스", "top_level": "short", "definition": "trading halt, reverse split, compliance pressure, authorized shares가 핵심인 기사다.", "value_path": "시장구조 스트레스와 희석/상장유지 우려가 반영된다.", "include_signals": ["trading halt", "reverse stock split", "minimum bid", "authorized shares"], "exclude_signals": ["ipo debut", "ordinary listing"], "quick_questions": ["사업보다 자본구조/상장스트레스가 중심인가?"]},
    "litigation_regulatory_negative": {"label_ko": "소송·조사·회계 리스크", "top_level": "short", "definition": "lawsuit, investigation, subpoena, fraud, restatement가 핵심인 기사다.", "value_path": "비용 증가와 신뢰 훼손이 valuation discount로 이어진다.", "include_signals": ["lawsuit", "investigation", "subpoena", "restatement"], "exclude_signals": ["settlement removes risk", "approval"], "quick_questions": ["조사/소송이 핵심인가?"]},
    "restructuring_distress_negative": {"label_ko": "구조조정·생존성 악화", "top_level": "short", "definition": "bankruptcy, going concern, layoffs, strategic alternatives가 핵심인 기사다.", "value_path": "생존성 우려와 사업 지속성 discount로 이어진다.", "include_signals": ["chapter 11", "bankruptcy", "going concern", "layoffs"], "exclude_signals": ["growth reorg", "ordinary cost cuts"], "quick_questions": ["성장보다 생존이 핵심인가?"]},
    "management_governance_positive": {"label_ko": "경영진 보강·거버넌스 개선", "top_level": "long", "definition": "experienced CEO/CFO 영입, activist 합의, governance 개선이 핵심인 기사다.", "value_path": "운영 신뢰 회복과 실행력 기대를 만든다.", "include_signals": ["appoints new ceo", "appoints veteran", "governance agreement", "board refresh"], "exclude_signals": ["executive departure", "probe"], "quick_questions": ["경영 보강이 긍정 이벤트인가?"]},
    "management_governance_negative": {"label_ko": "경영진 이탈·거버넌스 충격", "top_level": "short", "definition": "CEO/CFO resignation, board dispute, governance breakdown이 핵심인 기사다.", "value_path": "리더십 공백과 통제 약화 우려를 만든다.", "include_signals": ["ceo resigns", "cfo resigns", "board dispute", "executive departs"], "exclude_signals": ["planned succession", "new ceo appointed"], "quick_questions": ["경영 공백/혼란이 핵심인가?"]},
    "policy_regulatory_tailwind_positive": {"label_ko": "정책·법안 수혜 read-through", "top_level": "long", "definition": "법안, 정책, 규제 framework 변화가 사업모델에 우호적으로 작용하는 기사다.", "value_path": "외부 정책 변화가 TAM 확대나 규제완화 기대를 만든다.", "include_signals": ["tailwind from", "policy support", "regulatory clarity", "bill boosts"], "exclude_signals": ["company contract", "formal approval"], "quick_questions": ["직접 공시가 아니라 정책 수혜 read-through인가?"]},
    "policy_regulatory_headwind_negative": {"label_ko": "정책·법안 역풍 read-through", "top_level": "short", "definition": "법안, 규제, 정책 변화가 사업모델에 역풍을 주는 기사다.", "value_path": "규제 강화나 framework 변경이 수익경로 훼손 우려를 만든다.", "include_signals": ["ban", "bill", "act", "regulatory framework", "policy risk", "lawmakers"], "exclude_signals": ["fda rejection", "lawsuit"], "quick_questions": ["직접 회사 악재보다 정책 역풍이 핵심인가?"]},
    "peer_readthrough_positive": {"label_ko": "peer 호조 read-through", "top_level": "long", "definition": "peer strong earnings, peer momentum, sector leader strength가 동종 종목에 read-through되는 기사다.", "value_path": "peer 실적/수요 신호가 동종 밸류에이션 상승으로 번진다.", "include_signals": ["peer results", "sector leader", "read-through", "peer strength"], "exclude_signals": ["same company earnings", "macro only"], "quick_questions": ["타사 호조가 이 종목 논리의 핵심인가?"]},
    "peer_competition_negative": {"label_ko": "peer 투자·경쟁 심화 read-through", "top_level": "short", "definition": "rival launch, peer capex, substitute threat가 약세 이유인 기사다.", "value_path": "경쟁 심화와 share loss 우려가 valuation 압박으로 이어진다.", "include_signals": ["rival", "competitor", "investment push", "competitive pressure", "new product from"], "exclude_signals": ["same company launch", "macro risk-off"], "quick_questions": ["경쟁사 행동이 약세 이유의 중심인가?"]},
    "supply_chain_tailwind_positive": {"label_ko": "공급망 완화·원가 개선 read-through", "top_level": "long", "definition": "input cost easing, supply normalization, sourcing improvement가 핵심인 기사다.", "value_path": "원가 하락과 생산 정상화가 margin upside로 이어진다.", "include_signals": ["supply chain easing", "input costs fall", "sourcing improves", "cost relief"], "exclude_signals": ["company contract", "generic macro"], "quick_questions": ["공급망 개선이 핵심 논리인가?"]},
    "supply_chain_headwind_negative": {"label_ko": "공급망 차질·원가 압박 read-through", "top_level": "short", "definition": "tariff exposure, sourcing issues, component shortage, cost inflation이 핵심인 기사다.", "value_path": "원가 상승과 생산 차질이 margin 압박으로 이어진다.", "include_signals": ["tariff exposure", "rare earth", "shortage", "supply chain disruption", "cost inflation"], "exclude_signals": ["macro index move", "direct lawsuit"], "quick_questions": ["공급망/원가 압박이 중심인가?"]},
    "valuation_narrative_positive": {"label_ko": "밸류에이션 discount 해소 narrative", "top_level": "long", "definition": "too cheap, catch-up, rerating potential이 핵심인 기사다.", "value_path": "저평가 해소 기대가 multiple expansion으로 이어진다.", "include_signals": ["undervalued", "discount", "catch-up", "rerating potential"], "exclude_signals": ["generic best stock list", "formal analyst upgrade"], "quick_questions": ["핵심이 저평가 해소 narrative인가?"]},
    "valuation_narrative_negative": {"label_ko": "밸류에이션 부담·multiple compression narrative", "top_level": "short", "definition": "too expensive, stretched valuation, multiple compression 우려가 핵심인 기사다.", "value_path": "밸류에이션 부담이 추격 매수 축소와 de-rating으로 이어진다.", "include_signals": ["too expensive", "stretched valuation", "multiple compression", "overvalued"], "exclude_signals": ["formal downgrade", "earnings miss"], "quick_questions": ["펀더멘털보다 valuation 부담이 중심인가?"]},
    "positioning_flow_positive": {"label_ko": "숏커버·포지셔닝 언와인드·매수 유입", "top_level": "long", "definition": "short squeeze, positioning unwind, fund buying이 핵심인 기사다.", "value_path": "기계적 수급 유입이 가격 상승을 가속한다.", "include_signals": ["short squeeze", "fund buying", "position established", "covering"], "exclude_signals": ["buyback", "customer adoption"], "quick_questions": ["사업 사건보다 flow가 핵심인가?"]},
    "positioning_flow_negative": {"label_ko": "차익실현·디그로싱·매도 수급", "top_level": "short", "definition": "profit-taking, de-grossing, fund selling이 핵심인 기사다.", "value_path": "포지셔닝 축소가 단기 가격 하방을 만든다.", "include_signals": ["profit-taking", "taking profits", "de-grossing", "fund selling"], "exclude_signals": ["earnings miss", "policy risk"], "quick_questions": ["사업 악재보다 flow unwind가 중심인가?"]},
    "media_amplification_positive": {"label_ko": "top mover·헤드라인 증폭·상승 해설", "top_level": "long", "definition": "top mover, biggest gainer, shares jumped because 같은 상승 해설 기사다.", "value_path": "해설/노출 증폭이 추가 관심과 추격 수급을 만든다.", "include_signals": ["top mover", "biggest gainer", "surging today", "soaring today"], "exclude_signals": ["formal upgrade", "contract award"], "quick_questions": ["이미 오른 뒤 해설 기사인가?", "노출 증폭이 핵심인가?"]},
    "media_amplification_negative": {"label_ko": "top mover·헤드라인 증폭·하락 해설", "top_level": "short", "definition": "why stock is falling, tumbles, sell-off 같은 하락 해설 기사다.", "value_path": "약세 headline cascade가 공포와 추가 매도를 증폭한다.", "include_signals": ["trading lower today", "tumbles", "sell-off", "plunges"], "exclude_signals": ["formal downgrade", "public offering"], "quick_questions": ["이미 내린 뒤 해설 기사인가?", "headline cascade가 중심인가?"]},
    "macro_market_commentary": {"label_ko": "매크로·시장 코멘터리", "top_level": "residual", "definition": "금리, Fed, 인플레이션, 지수 움직임처럼 광범위한 시장 설명 기사다.", "value_path": "개별 기업보다 외부 환경 read-through를 다룬다.", "include_signals": ["stock market today", "fed", "inflation", "nasdaq", "s&p 500"], "exclude_signals": ["single-company event", "peer competition"], "quick_questions": ["여러 종목 공통 설명인가?"]},
    "market_movers_roundup": {"label_ko": "멀티종목 movers·watchlist 기사", "top_level": "residual", "definition": "여러 종목을 묶어 top movers 또는 radar로 나열하는 기사다.", "value_path": "개별 사건보다 스크리너/요약 기사에 가깝다.", "include_signals": ["other big stocks moving", "investors' radars", "most active stocks", "top stocks"], "exclude_signals": ["single-ticker explainer", "direct event"], "quick_questions": ["멀티종목 roundup인가?"]},
    "promotional_appearance_noise": {"label_ko": "행사·인터뷰·홍보성 appearance", "top_level": "residual", "definition": "conference participation, fireside chat, podcast, webinar, event appearance 같은 홍보성 노출 기사다.", "value_path": "직접 가격 설명보다 investor-relations 노출 성격이 강해 true residual에 가깝다.", "include_signals": ["participate in", "investor conference", "podcast featuring", "fireside chat"], "exclude_signals": ["실적발표", "계약수주", "정책 read-through"], "quick_questions": ["행사 참가/인터뷰 공지인가?", "직접 가치 경로보다 홍보성 노출이 중심인가?"]},
    "screener_listicle_noise": {"label_ko": "리스트형 screener·주간 요약 노이즈", "top_level": "residual", "definition": "Why these stocks, top meme stocks, penny stocks listicle, week-in-review 같은 리스트형 기사다.", "value_path": "개별 종목의 독립 원인보다 트래픽 유도형 큐레이션 성격이 강하다.", "include_signals": ["why these", "best meme stocks", "penny stocks", "what you need to know"], "exclude_signals": ["single-ticker explainer", "구체적 직접 사건"], "quick_questions": ["리스트형/큐레이션 기사인가?", "개별 원인 설명보다 모음집 구조인가?"]},
    "ipo_listing_event": {"label_ko": "IPO·상장 이벤트", "top_level": "residual", "definition": "IPO, debut, direct listing, goes public가 핵심인 기사다.", "value_path": "시장접근/유동성 이벤트지만 방향성은 케이스별로 다르다.", "include_signals": ["goes public", "ipo", "direct listing", "debut"], "exclude_signals": ["trading halt", "reverse split"], "quick_questions": ["상장 자체가 headline 핵심인가?"]},
    "generic_feature_commentary": {"label_ko": "feature·투자아이디어 해설", "top_level": "residual", "definition": "deep dive, feature, is it a buy, storytelling 성격의 기사다.", "value_path": "직접 이벤트보다 opinion/feature layer다.", "include_signals": ["is it a buy", "worth buying", "deep dive", "feature"], "exclude_signals": ["formal analyst action", "earnings beat"], "quick_questions": ["직접 사건보다 feature/opinion인가?"]},
    "meaningless_others": {"label_ko": "잡것들", "top_level": "residual", "definition": "위 유형으로 재현 가능하게 설명하기 어려운 저정보 잔여 기사다.", "value_path": "직접 가치 경로가 약하거나 불명확하다.", "include_signals": ["generic promotion", "ambiguous article"], "exclude_signals": ["명확한 earnings/analyst/contract/policy read-through 기사"], "quick_questions": ["독립 유형으로 승격시킬 만큼 반복 패턴이 약한가?"]},
}

DIRECT_SHORT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("capital_structure_stress_negative", ("trading halt", "quotation resumption", "halt news pending", "reverse stock split", "reverse-splitting", "reverse splitting", "minimum bid", "increase authorized shares", "increases authorized shares", "authorized shares", "authorized common stock", "non-compliance", "regain compliance")),
    ("financing_dilution_negative", ("public offering", "proposed public offering", "registered direct", "private placement", "warrants", "convertible notes", "convertible senior notes", "common stock offering", "secondary offering")),
    ("restructuring_distress_negative", ("chapter 11", "bankruptcy", "going concern", "strategic alternatives", "restructuring", "layoffs", "liquidity concerns", "delisting notice")),
    ("litigation_regulatory_negative", ("lawsuit", "class action", "investigation", "subpoena", "restatement", "fraud", "sec probe", "doj")),
    ("regulatory_clinical_negative", ("complete response letter", "clinical hold", "failed to meet", "did not meet", "fda rejection", "missed endpoint", "trial failure", "drug-induced liver injury")),
    ("earnings_miss_cut_negative", ("misses estimates", "misses estimate", "lags revenue estimates", "cuts guidance", "lowered guidance", "weak outlook", "profit warning", "below expectations", "loss wider than expected", "revenues fall y/y", "revenue fell", "drops production forecast")),
    ("analyst_downgrade_negative", ("downgrades", "downgraded", "underperform", "underweight", "lowers price target", "target cut", "price target cut", "sell rating", "holds neutral rating", "neutral rating", "slashed its price target", "analysts are cutting their estimates", "analysts are downgrading")),
    ("analyst_note_amplification_negative", ("analyst warns", "cautious note", "bearish note", "skeptical analyst", "analyst concern", "bears are raising a caution flag")),
    ("management_governance_negative", ("ceo resigns", "cfo resigns", "executive departs", "board dispute", "management turmoil")),
]

INDIRECT_SHORT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("policy_regulatory_headwind_negative", ("regulatory framework", "yield ban", "ban stablecoin", "policy risk", "lawmakers", "clarity act", "bill could", "act could", "federal tax credit", "lose the federal tax credit")),
    ("supply_chain_headwind_negative", ("tariff exposure", "rare earth", "component shortage", "supply chain disruption", "cost inflation", "input costs rise", "critical materials", "tariffs on gross margin")),
    ("peer_competition_negative", ("competitive pressure", "rival", "competitor", "investment push", "new product from", "competition intensifies", "substitute threat", "teamed up with spacex", "partnered with spacex", "starlink", "takes market share", "stiff competition")),
    ("positioning_flow_negative", ("profit-taking", "taking profits", "de-grossing", "fund selling", "positioning unwind")),
    ("valuation_narrative_negative", ("too expensive", "stretched valuation", "multiple compression", "overvalued", "valuation concern", "still a sell")),
]

DIRECT_LONG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("government_contract_award_positive", ("contract award", "wins contract", "secures contract", "prime contractor", "definitive contract", "government contract", "awarded a contract")),
    ("partnership_license_positive", ("partnership", "collaboration", "license agreement", "licensing deal", "exclusive global license", "supply agreement")),
    ("mna_strategic_asset_positive", ("acquisition", "acquires", "merger", "buyout", "strategic investment", "asset sale", "takeover")),
    ("regulatory_clinical_positive", ("fda approval", "approved by the fda", "positive topline", "topline results", "phase 3 success", "phase 2 success", "nda acceptance", "bla acceptance", "pivotal data", "slowed kidney function decline")),
    ("customer_adoption_positive", ("selected by", "customer win", "deployment", "customer adoption", "adopted by", "major customer")),
    ("demand_backlog_positive", ("strong demand", "demand surge", "backlog", "bookings growth", "order growth", "sales dramatically increase", "35% boost")),
    ("commercial_launch_expansion_positive", ("launches", "launch", "prepared to launch", "expands", "expansion", "platform expansion", "capacity expansion", "production ramp", "commercial launch", "unveils")),
    ("earnings_beat_raise_positive", ("better-than-expected", "beat estimates", "beats estimates", "raises guidance", "record revenue", "earnings beat", "above estimates", "strong results")),
    ("analyst_upgrade_positive", ("maintains buy", "initiates coverage", "assumes", "outperform", "raises price target", "market outperform", "overweight", "buy rating")),
    ("analyst_note_amplification_positive", ("analyst says", "citi says", "bofa says", "bullish note", "analyst comment helped")),
    ("shareholder_return_positive", ("share repurchase", "buyback", "repurchase program", "increases dividend", "returns capital")),
    ("management_governance_positive", ("appoints new ceo", "appoints veteran", "governance agreement", "board refresh", "new leadership")),
]

INDIRECT_LONG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("policy_regulatory_tailwind_positive", ("regulatory clarity", "policy support", "bill boosts", "rule benefits", "tailwind from policy")),
    ("supply_chain_tailwind_positive", ("supply chain easing", "input costs fall", "sourcing improves", "cost relief", "normalization helps")),
    ("peer_readthrough_positive", ("read-through", "peer strength", "peer results", "sector leader", "peer demand signal", "spending massively on artificial intelligence", "earnings calls")),
    ("positioning_flow_positive", ("short squeeze", "fund buying", "position established", "covering", "squeeze higher", "surprise stake", "takes stake", "took a stake", "disclosed stake", "sends .* shares flying")),
    ("valuation_narrative_positive", ("undervalued", "discount", "catch-up", "rerating potential", "cheap stock")),
]

INFORMATION_FLOW_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("media_amplification_negative", ("trading lower today", "sinking today", "plummeting today", "stock sank", "shares are trading lower", "sell-off", "tumbles", "plunges", "drifting lower today", "crashed this week", "tumbling wednesday", "pumping the brakes")),
    ("media_amplification_positive", ("surging today", "soaring today", "trading higher today", "stock soared", "shares are trading higher", "top mover", "biggest gainer", "jumped today", "skyrocketing today", "popped today", "soaring this week")),
    ("market_movers_roundup", ("other big stocks moving", "investors' radars", "most active stocks", "top stocks", "watch these stocks", "wall street's favorite", "stocks trade up, what you need to know", "shares skyrocket, what you need to know")),
    ("generic_feature_commentary", ("is it a buy", "worth buying", "deep dive", "feature", "interesting analyst questions", "show promise", "buy, sell, or hold", "everyone is talking about", "how is the market feeling about")),
]

TRUE_RESIDUAL_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("promotional_appearance_noise", ("participate in the", "investor conference", "podcast featuring", "webcasting its participation", "fireside chat", "panel discussion", "conference presentation")),
    ("screener_listicle_noise", ("why these", "healthcare stocks are surging", "penny stocks with market caps", "best meme stocks", "wall street but", "what you need to know", "stocks are surging in", "promising penny stocks")),
    ("macro_market_commentary", ("stock market today", "nasdaq down", "s&p 500", "interest rates", "fed", "inflation", "recession", "macro headwind", "economic slowdown", "geopolitical", "producer inflation stalls", "crude oil stocks fall", "consumer price index")),
    ("ipo_listing_event", ("goes public", "direct listing", "market debut", "stock debut", "initial public offering", " ipo ")),
    ("earnings_transcript_snapshot", ("earnings call transcript", "earnings snapshot", "earnings call highlights", "conference call transcript", "q1 2025 earnings call")),
    ("earnings_preview_watch", ("to report q1 results", "to report q2 results", "to report q3 results", "to report q4 results", "wall street expects", "ahead of earnings", "earnings: a preview")),
]

CASE_RULE_GROUPS: list[tuple[str, list[tuple[str, tuple[str, ...]]]]] = [
    ("direct_short", DIRECT_SHORT_RULES),
    ("indirect_short", INDIRECT_SHORT_RULES),
    ("direct_long", DIRECT_LONG_RULES),
    ("indirect_long", INDIRECT_LONG_RULES),
    ("information_flow", INFORMATION_FLOW_RULES),
    ("true_residual", TRUE_RESIDUAL_RULES),
]

POSITIVE_EXPLAINERS = ("surging today", "soaring today", "trading higher today", "stock soared", "shares are trading higher", "top mover", "biggest gainer")
NEGATIVE_EXPLAINERS = ("trading lower today", "sinking today", "plummeting today", "stock sank", "shares are trading lower", "sell-off", "tumbles", "plunges", "drifting lower today")


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def contains_any(text: str, patterns: tuple[str, ...]) -> bool:
    for pattern in patterns:
        if ".*" in pattern:
            if re.search(pattern, text):
                return True
            continue
        if pattern in text:
            return True
    return False


def classify_company_news(title: str, body: str, full_text: str = "", publisher: str = "") -> str:
    title_text = (title or "").lower()
    text = normalize_text(title, body, full_text, publisher)
    if not text.strip():
        return "meaningless_others"
    for _, rules in CASE_RULE_GROUPS:
        for case_type, patterns in rules:
            if contains_any(text, patterns):
                if case_type == "ipo_listing_event" and "trading halt" in text:
                    continue
                return case_type
    if "why" in text or "shares are trading" in text:
        if contains_any(text, NEGATIVE_EXPLAINERS):
            return "media_amplification_negative"
        if contains_any(text, POSITIVE_EXPLAINERS):
            return "media_amplification_positive"
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
    source = (row.get("full_text") or row.get("body") or "").strip()
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
             nf.full_text,
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
        LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
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
    row["case_type"] = classify_company_news(row.get("title") or "", row.get("body") or "", row.get("full_text") or "", row.get("publisher") or "")
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
        raw_row["case_type"] = classify_company_news(raw_row.get("title") or "", raw_row.get("body") or "", raw_row.get("full_text") or "", raw_row.get("publisher") or "")
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
        ) VALUES (?, ?, ?, ?, 'company_news', 'FINNHUB', ?, ?, 'company_news_2025_plus_taxonomy_v3', ?, ?, ?, ?)
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
                (raw_row.get("full_text") or raw_row.get("body") or "")[:600],
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


def make_markdown(run_id: str, note_title: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict], conn: sqlite3.Connection) -> str:
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
    lines.append("## taxonomy 설계 포인트")
    lines.append("")
    lines.append("- direct event, indirect read-through, information-flow, true residual을 분리했다.")
    lines.append("- 기존 `macro_sector_readthrough`와 `meaningless_others`에 섞여 있던 policy, peer, valuation, flow, media 패턴을 독립 case로 승격했다.")
    lines.append("- `잡것들`은 진짜 저정보 residual만 남기는 것을 목표로 한다.")
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
    lines.append("## 유형 정의")
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
                lines.append(
                    f"  - {example['published_at']} | {example['ticker'] or '-'} | {example['title']} | score={format_float(example['overall_impact_score'])} | tag={example['reaction_tag']}"
                )
        lines.append("")
    lines.append("## 해석")
    lines.append("")
    lines.append("- 핵심 검증 포인트는 `정책·법안`, `peer 경쟁`, `valuation`, `flow`, `media amplification`이 실제로 독립 case로 분리되면서 old residual bucket이 줄어드는지다.")
    lines.append("- 남는 `generic_feature_commentary`와 `meaningless_others`는 다음 보정 단계의 residual 정제 후보군이다.")
    return "\n".join(lines)


def write_outputs(out_dir: Path, note_title: str, run_id: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict], markdown: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    stem = f"model2_company_news_taxonomy_v3_{stamp}"
    payload = {
        "analysis_id": run_id,
        "note_title": note_title,
        "since": since,
        "until": until,
        "scope": "company_news_2025_plus_taxonomy_v3",
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
                "scope=company_news_2025_plus_taxonomy_v3",
                f"total_rows={threshold_summary['total_rows']}",
                f"analyzable_rows={threshold_summary['analyzable_rows']}",
                f"impacted_rows={insert_summary['impacted_rows']}",
                f"meaningless_rows={threshold_summary['meaningless_rows']}",
            ]
        ),
        encoding="utf-8",
    )
    (out_dir / "model2_company_news_taxonomy_v3_latest.md").write_text(markdown, encoding="utf-8")
    (out_dir / "model2_company_news_taxonomy_v3_latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"terminal/backend/backend/data/app.db")
    parser.add_argument("--since", default="2025-01-01")
    parser.add_argument("--until", default="")
    parser.add_argument("--page-id", default="99a89607-d943-4a57-8a98-be8ba86f731b")
    parser.add_argument("--note-title", default="Model 2 company_news taxonomy v3 (2025+)")
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
    markdown = make_markdown(run_id, note_title, args.since, until, threshold_summary, insert_summary, case_summaries, conn)
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