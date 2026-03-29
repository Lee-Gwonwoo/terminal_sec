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

# ═══════════════════════════════════════════════════════════════════════
# Taxonomy v7 — 211 case types (v6 101 → v7 211)
# 의미없는 정보 계열은 `잡것들_` prefix를 붙이고, 끝까지 분류되지 않으면 `unknown`으로 둔다.
# ═══════════════════════════════════════════════════════════════════════

CASE_META: dict[str, dict[str, object]] = {
    # ─── EARNINGS (10) ───────────────────────────────────────────────
    "earnings_beat_raise_positive": {"label_ko": "실적 Beat·가이던스 상향", "top_level": "long", "definition": "EPS/매출 beat 또는 가이던스 상향이 핵심 기사.", "value_path": "추정치 상향→멀티플 re-rating", "include_signals": ["beat estimates", "raises guidance", "record revenue"], "exclude_signals": ["preview", "transcript"], "quick_questions": ["실제 결과?", "beat/raise 중심?"]},
    "earnings_miss_cut_negative": {"label_ko": "실적 Miss·가이던스 하향", "top_level": "short", "definition": "EPS/매출 miss 또는 가이던스 하향이 핵심 기사.", "value_path": "추정치 하향→valuation 압축", "include_signals": ["misses estimates", "cuts guidance", "profit warning"], "exclude_signals": ["preview", "transcript"], "quick_questions": ["실제 결과?", "miss/cut 중심?"]},
    "earnings_result_mixed_neutral": {"label_ko": "실적 혼재·엇갈림", "top_level": "residual", "definition": "EPS beat+매출 miss 또는 반대. 방향 불명확.", "value_path": "방향 혼재→단기 변동 후 수렴", "include_signals": ["mixed results", "beat eps miss revenue"], "exclude_signals": [], "quick_questions": ["beat+miss 동시?"]},
    "earnings_guidance_update": {"label_ko": "가이던스·전망 업데이트", "top_level": "residual", "definition": "forward guidance/outlook 수치가 핵심. Sees FY/Q 포맷.", "value_path": "기대치 갱신→재평가", "include_signals": ["sees fy", "sees q1 sales"], "exclude_signals": [], "quick_questions": ["forward guidance 중심?"]},
    "earnings_preview_watch": {"label_ko": "실적 발표 전 기대 기사", "top_level": "residual", "definition": "발표 전 preview/expectations 안내 기사.", "value_path": "기대 형성 단계", "include_signals": ["ahead of earnings", "to report results", "wall street expects"], "exclude_signals": ["beat", "miss"], "quick_questions": ["발표 전 기사?"]},
    "earnings_transcript_snapshot": {"label_ko": "실적 transcript·snapshot", "top_level": "residual", "definition": "earnings call transcript/snapshot 후행 정리.", "value_path": "정리 기사", "include_signals": ["transcript", "snapshot", "highlights"], "exclude_signals": [], "quick_questions": ["전사본/요약 정리?"]},
    "earnings_summary_assessment": {"label_ko": "실적 요약·평가 기사", "top_level": "residual", "definition": "earnings breakdown/assessment/insights 정리 기사.", "value_path": "해설 정리", "include_signals": ["earnings breakdown", "earnings assessment", "earnings insights"], "exclude_signals": [], "quick_questions": ["실적 정리?"]},
    "earnings_call_summary": {"label_ko": "실적 콜 요약", "top_level": "residual", "definition": "Moby summary 등 earnings call summary.", "value_path": "콜 요약", "include_signals": ["earnings call summary", "moby summary"], "exclude_signals": [], "quick_questions": ["콜 요약?"]},
    "earnings_revenue_report_neutral": {"label_ko": "실적 결과 보도(중립)", "top_level": "residual", "definition": "beat/miss 프레이밍 없이 결과 보도.", "value_path": "사실 보도", "include_signals": ["reports q4", "reports financial results"], "exclude_signals": ["beat", "miss"], "quick_questions": ["중립 보도?"]},
    "earnings_estimate_comparison": {"label_ko": "실적 vs 추정치 비교", "top_level": "residual", "definition": "key metrics vs estimates 비교 기사.", "value_path": "추정치 대비 비교", "include_signals": ["compared to estimates", "key metrics"], "exclude_signals": [], "quick_questions": ["추정치 비교 기사?"]},
    # ─── ANALYST (8) ─────────────────────────────────────────────────
    "analyst_upgrade_positive": {"label_ko": "애널리스트 상향·커버리지 개시", "top_level": "long", "definition": "upgrade, coverage initiation, target raise 중심.", "value_path": "sell-side 상향→re-rating", "include_signals": ["initiates coverage", "outperform", "raises price target"], "exclude_signals": ["target cut", "downgraded"], "quick_questions": ["formal upgrade?"]},
    "analyst_downgrade_negative": {"label_ko": "애널리스트 하향·목표가 하향", "top_level": "short", "definition": "downgrade, underperform, target cut 중심.", "value_path": "sell-side 하향→de-rating", "include_signals": ["downgraded", "underperform", "target cut"], "exclude_signals": ["raises price target"], "quick_questions": ["formal downgrade?"]},
    "analyst_reiteration_positive": {"label_ko": "애널리스트 투자의견 재확인(긍정)", "top_level": "long", "definition": "Reiterates Buy/Outperform, maintains target.", "value_path": "기존 긍정뷰 유지 확인", "include_signals": ["reiterates buy", "maintains buy", "maintains price target"], "exclude_signals": ["downgraded"], "quick_questions": ["재확인(reiteration)?"]},
    "analyst_note_amplification_positive": {"label_ko": "애널리스트 코멘트 증폭(긍정)", "top_level": "long", "definition": "formal upgrade 아닌 bullish note 증폭.", "value_path": "note 증폭→sentiment 유입", "include_signals": ["analyst says", "bullish note", "benefiting from"], "exclude_signals": ["formal upgrade"], "quick_questions": ["note 증폭(긍정)?"]},
    "analyst_note_amplification_negative": {"label_ko": "애널리스트 코멘트 증폭(부정)", "top_level": "short", "definition": "formal downgrade 아닌 cautious/bearish note.", "value_path": "warning note→sentiment 이탈", "include_signals": ["analyst warns", "cautious note", "bearish"], "exclude_signals": ["formal downgrade"], "quick_questions": ["note 증폭(부정)?"]},
    "analyst_forecast_revision_positive": {"label_ko": "애널리스트 전망 상향 수정", "top_level": "long", "definition": "analysts boost/increase forecasts.", "value_path": "집합적 전망 상향", "include_signals": ["analysts boost", "forecasts after upbeat"], "exclude_signals": [], "quick_questions": ["집합적 전망 상향?"]},
    "analyst_forecast_revision_negative": {"label_ko": "애널리스트 전망 하향 수정", "top_level": "short", "definition": "analysts cut/lower forecasts.", "value_path": "집합적 전망 하향", "include_signals": ["analysts cut", "forecasts after weak"], "exclude_signals": [], "quick_questions": ["집합적 전망 하향?"]},
    "analyst_consensus_overview": {"label_ko": "애널리스트 컨센서스·다수의견", "top_level": "residual", "definition": "다수 analyst 의견 종합 기사.", "value_path": "컨센서스 소개", "include_signals": ["insights from.*analysts", "analyst reviews"], "exclude_signals": [], "quick_questions": ["다수 의견 종합?"]},
    # ─── CLINICAL / BIOTECH (6) ──────────────────────────────────────
    "regulatory_clinical_positive": {"label_ko": "승인·임상 호재", "top_level": "long", "definition": "FDA approval, positive topline, NDA acceptance.", "value_path": "자산 성공 확률 상승→상업화 기대", "include_signals": ["fda approval", "positive topline", "nda acceptance"], "exclude_signals": ["clinical hold", "failed"], "quick_questions": ["성공/승인 중심?"]},
    "regulatory_clinical_negative": {"label_ko": "규제·임상 악재", "top_level": "short", "definition": "CRL, endpoint failure, clinical hold.", "value_path": "자산 가치 훼손→지연/실패", "include_signals": ["complete response letter", "clinical hold", "failed to meet"], "exclude_signals": ["positive topline", "approval"], "quick_questions": ["실패/보류 중심?"]},
    "clinical_trial_initiation_positive": {"label_ko": "임상시험 개시·첫 투약", "top_level": "long", "definition": "first patient dosed, trial initiated.", "value_path": "파이프라인 진전→milstone 기대", "include_signals": ["first patient dosed", "trial initiated", "phase.*initiated"], "exclude_signals": [], "quick_questions": ["임상 개시 이벤트?"]},
    "clinical_trial_data_update": {"label_ko": "임상 데이터·중간결과 업데이트", "top_level": "long", "definition": "interim data, response rate, trial results 보고.", "value_path": "데이터 기반 자산 재평가", "include_signals": ["interim data", "response rate", "trial data", "efficacy"], "exclude_signals": [], "quick_questions": ["임상 데이터 중심?"]},
    "drug_designation_positive": {"label_ko": "의약품 지정·우선심사", "top_level": "long", "definition": "QIDP, Fast Track, Breakthrough, Orphan Drug 지정.", "value_path": "규제 경로 단축→상업화 가속", "include_signals": ["qidp designation", "fast track", "breakthrough therapy", "orphan drug"], "exclude_signals": [], "quick_questions": ["규제 지정 이벤트?"]},
    "fda_procedural_action": {"label_ko": "FDA 절차 진행·수리", "top_level": "long", "definition": "FDA accepts NDA, reverses decision, schedules review.", "value_path": "절차 진행→approval 기대", "include_signals": ["fda accepts", "fda reverses", "fda to review", "pdufa date", "supplemental new drug"], "exclude_signals": ["fda rejection"], "quick_questions": ["FDA 절차 진전?"]},
    "drug_marketing_authorization": {"label_ko": "의약품 판매허가(비FDA)", "top_level": "long", "definition": "EC/EMA marketing authorization, non-FDA 승인.", "value_path": "해외 시장 접근→매출 확대", "include_signals": ["marketing authorization", "european commission", "conditional approval"], "exclude_signals": [], "quick_questions": ["비FDA 판매허가?"]},
    # ─── CONTRACT / PARTNERSHIP / EXPANSION (4) ──────────────────────
    "government_contract_award_positive": {"label_ko": "정부·대형 계약 수주", "top_level": "long", "definition": "prime contractor, definitive contract, government award.", "value_path": "매출 가시성·backlog 확대", "include_signals": ["contract award", "wins contract", "government contract"], "exclude_signals": ["generic partnership"], "quick_questions": ["실제 수주 핵심?"]},
    "partnership_license_positive": {"label_ko": "제휴·라이선스·협업", "top_level": "long", "definition": "partnership, collaboration, licensing deal.", "value_path": "외부 자원 결합→channel 확대", "include_signals": ["partnership", "collaboration", "license agreement"], "exclude_signals": ["offering", "lawsuit"], "quick_questions": ["경제적 제휴?"]},
    "commercial_launch_expansion_positive": {"label_ko": "출시·상업화·확장", "top_level": "long", "definition": "launch, rollout, expansion, commercialization.", "value_path": "시장 확대→매출 성장", "include_signals": ["launches", "expands", "commercial launch", "expansion"], "exclude_signals": ["event promotion"], "quick_questions": ["상업화/확장 이벤트?"]},
    "demand_backlog_positive": {"label_ko": "수요 급증·백로그 확대", "top_level": "long", "definition": "strong demand, bookings, backlog growth.", "value_path": "수요 가시성→매출 지속성", "include_signals": ["strong demand", "backlog", "bookings growth"], "exclude_signals": ["macro commentary"], "quick_questions": ["수요/백로그 직접 언급?"]},
    # ─── M&A / DEALS (5) ─────────────────────────────────────────────
    "mna_strategic_asset_positive": {"label_ko": "M&A·전략자산 거래", "top_level": "long", "definition": "acquisition, merger, buyout, strategic investment.", "value_path": "전략 자산 재평가→premium 기대", "include_signals": ["acquisition", "merger", "buyout", "strategic investment"], "exclude_signals": ["distress sale"], "quick_questions": ["자산 거래 핵심?"]},
    "acquisition_target_premium_positive": {"label_ko": "피인수·프리미엄 거래", "top_level": "long", "definition": "company being acquired at premium per share.", "value_path": "프리미엄 실현→주주가치", "include_signals": ["acquire.*for.*share", "tender offer", "premium"], "exclude_signals": [], "quick_questions": ["피인수 이벤트?"]},
    "corporate_deal_billion_positive": {"label_ko": "대형 딜·인프라 투자", "top_level": "long", "definition": "multi-billion dollar deals, infrastructure.", "value_path": "대형 매출·투자→가치 재평가", "include_signals": ["billion deal", "multiyear deal", "data center", "infrastructure"], "exclude_signals": [], "quick_questions": ["대형 계약/투자?"]},
    "distribution_agreement_positive": {"label_ko": "유통·판매 계약", "top_level": "long", "definition": "distribution deal, sell drugs through, 유통 합의.", "value_path": "유통 채널 확보→매출 접근성", "include_signals": ["sell.*through", "distribution", "sell.*drugs.*platform"], "exclude_signals": [], "quick_questions": ["유통/판매 합의?"]},
    "divestiture_exit_neutral": {"label_ko": "사업부 매각·자산 처분", "top_level": "residual", "definition": "사업부 매각, 자산 처분, 시장 철수.", "value_path": "포트폴리오 재편→방향 혼재", "include_signals": ["divests", "sells business", "exits market"], "exclude_signals": [], "quick_questions": ["사업부 매각?"]},
    # ─── CUSTOMER / PRODUCT (4) ──────────────────────────────────────
    "customer_adoption_positive": {"label_ko": "고객 채택·대형 고객 확보", "top_level": "long", "definition": "major customer win, adoption, deployment.", "value_path": "고객 기반 확대→매출·credibility", "include_signals": ["customer win", "adoption", "selected by", "deployment"], "exclude_signals": ["generic partnership"], "quick_questions": ["고객 채택 중심?"]},
    "product_technology_integration": {"label_ko": "제품·기술 통합·AI 도입", "top_level": "long", "definition": "tech integration, AI adoption, platform integration.", "value_path": "기술 역량 강화→경쟁력", "include_signals": ["integrates", "adopts.*ai", "ai agent", "platform integration"], "exclude_signals": [], "quick_questions": ["기술 통합 이벤트?"]},
    "revenue_growth_milestone": {"label_ko": "매출 성장·마일스톤 달성", "top_level": "long", "definition": "record revenue, revenue growth milestone.", "value_path": "성장 증거→re-rating", "include_signals": ["record revenue", "revenue growth", "record sales", "revenue milestone"], "exclude_signals": [], "quick_questions": ["매출 기록/마일스톤?"]},
    "cost_margin_improvement": {"label_ko": "원가 절감·마진 개선", "top_level": "long", "definition": "cost reduction, margin improvement, efficiency.", "value_path": "수익성 개선→valuation support", "include_signals": ["margin improvement", "cost reduction", "operating leverage", "efficiency"], "exclude_signals": [], "quick_questions": ["마진 개선 중심?"]},
    # ─── FINANCIAL ACTIONS (8) ───────────────────────────────────────
    "shareholder_return_positive": {"label_ko": "자사주 매입·주주환원", "top_level": "long", "definition": "share repurchase, buyback, dividend hike.", "value_path": "주주환원→수급 개선", "include_signals": ["share repurchase", "buyback", "increases dividend"], "exclude_signals": ["capital raise"], "quick_questions": ["주주환원 핵심?"]},
    "dividend_special_event": {"label_ko": "배당 개시·특별배당", "top_level": "long", "definition": "initiates dividend, special dividend.", "value_path": "배당 정책 변화→income investor 유입", "include_signals": ["initiates.*dividend", "special dividend", "quarterly dividend"], "exclude_signals": [], "quick_questions": ["배당 이벤트?"]},
    "financing_dilution_negative": {"label_ko": "희석성 자금조달", "top_level": "short", "definition": "public offering, private placement, warrants.", "value_path": "희석→주가 하방", "include_signals": ["public offering", "private placement", "warrants", "convertible notes"], "exclude_signals": ["non-dilutive"], "quick_questions": ["희석 조달?"]},
    "capital_structure_stress_negative": {"label_ko": "거래정지·역분할·상장유지 스트레스", "top_level": "short", "definition": "trading halt, reverse split, compliance pressure.", "value_path": "구조 스트레스→할인", "include_signals": ["trading halt", "reverse stock split", "minimum bid"], "exclude_signals": ["ipo debut"], "quick_questions": ["자본구조 스트레스?"]},
    "insider_buying_positive": {"label_ko": "내부자 매수·자신감 시그널", "top_level": "long", "definition": "insider buying, director purchases.", "value_path": "내부자 확신→신뢰", "include_signals": ["insider buying", "director.*purchase", "ceo.*bought"], "exclude_signals": [], "quick_questions": ["내부자 매수?"]},
    "insider_selling_concern": {"label_ko": "내부자 매도·우려 시그널", "top_level": "short", "definition": "insider selling, executive sells shares.", "value_path": "내부자 매도→우려", "include_signals": ["insider.*sell", "insiders sell", "executive.*sold"], "exclude_signals": [], "quick_questions": ["내부자 매도?"]},
    "institutional_stake_disclosure": {"label_ko": "기관 지분 공시·13D/13G", "top_level": "long", "definition": "13D filing, stake disclosure, activist stake.", "value_path": "기관 관심→수급 기대", "include_signals": ["13d disclos", "13g", "stake in", "disclosed.*stake"], "exclude_signals": [], "quick_questions": ["지분 공시?"]},
    "credit_facility_update": {"label_ko": "여신 확대·부채 관리", "top_level": "long", "definition": "revolving credit expansion, debt management.", "value_path": "유동성 확보→재무 안정", "include_signals": ["revolving credit", "credit facility", "extends.*credit", "upsizes"], "exclude_signals": [], "quick_questions": ["여신/부채 이벤트?"]},
    # ─── LEGAL / GOVERNANCE (5) ──────────────────────────────────────
    "litigation_regulatory_negative": {"label_ko": "소송·조사·회계 리스크", "top_level": "short", "definition": "lawsuit, investigation, subpoena, restatement.", "value_path": "법률 비용·신뢰 훼손", "include_signals": ["lawsuit", "investigation", "subpoena", "restatement"], "exclude_signals": ["settlement removes risk"], "quick_questions": ["소송/조사 핵심?"]},
    "settlement_resolution_positive": {"label_ko": "소송 합의·분쟁 해소", "top_level": "long", "definition": "settlement, end feud, dispute resolution.", "value_path": "리스크 해소→할인 제거", "include_signals": ["settlement", "end feud", "resolves dispute", "ends.*legal"], "exclude_signals": [], "quick_questions": ["분쟁 해소?"]},
    "restructuring_distress_negative": {"label_ko": "구조조정·생존성 악화", "top_level": "short", "definition": "bankruptcy, going concern, layoffs.", "value_path": "생존 우려→할인", "include_signals": ["chapter 11", "bankruptcy", "going concern", "layoffs"], "exclude_signals": ["growth reorg"], "quick_questions": ["생존 모드?"]},
    "management_governance_positive": {"label_ko": "경영진 보강·거버넌스 개선", "top_level": "long", "definition": "experienced CEO/CFO 영입, governance agreement.", "value_path": "운영 신뢰→valuation support", "include_signals": ["appoints new ceo", "board refresh", "governance agreement"], "exclude_signals": ["executive departure"], "quick_questions": ["경영 보강?"]},
    "management_governance_negative": {"label_ko": "경영진 이탈·거버넌스 충격", "top_level": "short", "definition": "CEO/CFO resignation, board dispute.", "value_path": "리더십 공백→우려", "include_signals": ["ceo resigns", "cfo resigns", "board dispute"], "exclude_signals": ["new ceo appointed"], "quick_questions": ["경영 이탈?"]},
    # ─── POLICY / REGULATORY / GEOPOLITICAL (4) ──────────────────────
    "policy_regulatory_tailwind_positive": {"label_ko": "정책·법안 수혜 read-through", "top_level": "long", "definition": "법안/정책 변화가 사업모델에 수혜.", "value_path": "TAM 확대·규제완화", "include_signals": ["regulatory clarity", "policy support", "bill boosts"], "exclude_signals": ["company contract"], "quick_questions": ["정책 수혜?"]},
    "policy_regulatory_headwind_negative": {"label_ko": "정책·법안 역풍 read-through", "top_level": "short", "definition": "법안/규제 변화가 사업모델에 역풍.", "value_path": "규제 강화→수익 제한", "include_signals": ["ban", "policy risk", "lawmakers", "regulatory framework"], "exclude_signals": ["fda rejection"], "quick_questions": ["정책 역풍?"]},
    "tariff_trade_impact": {"label_ko": "관세·무역 분쟁 영향", "top_level": "residual", "definition": "tariff 부과/해제, trade war, 관세 관련 영향.", "value_path": "관세 변화→margin/수요 영향", "include_signals": ["tariff", "trade war", "strikes down.*tariff", "customs"], "exclude_signals": [], "quick_questions": ["관세/무역 충격?"]},
    "geopolitical_market_impact": {"label_ko": "지정학·전쟁·긴장 영향", "top_level": "residual", "definition": "war, geopolitical tensions, sanctions.", "value_path": "지정학 리스크→시장 변동", "include_signals": ["geopolitical", "middle east", "iran war", "sanctions", "escalating tensions"], "exclude_signals": [], "quick_questions": ["지정학 이벤트?"]},
    # ─── PEER / COMPETITIVE (2) ──────────────────────────────────────
    "peer_readthrough_positive": {"label_ko": "peer 호조 read-through", "top_level": "long", "definition": "peer strong earnings, sector leader validation.", "value_path": "peer 검증→동종 re-rating", "include_signals": ["read-through", "peer strength", "sector leader", "peer demand"], "exclude_signals": ["same company earnings"], "quick_questions": ["타사 호조 전이?"]},
    "peer_competition_negative": {"label_ko": "peer 경쟁 심화 read-through", "top_level": "short", "definition": "rival launch, peer capex, competitive pressure.", "value_path": "경쟁 심화→share loss 우려", "include_signals": ["rival", "competitor", "competitive pressure", "takes market share"], "exclude_signals": ["same company launch"], "quick_questions": ["경쟁사 행동이 약세 이유?"]},
    # ─── SUPPLY CHAIN (2) ────────────────────────────────────────────
    "supply_chain_tailwind_positive": {"label_ko": "공급망 완화·원가 개선", "top_level": "long", "definition": "supply easing, input cost decline.", "value_path": "원가 하락→margin upside", "include_signals": ["supply chain easing", "input costs fall", "cost relief"], "exclude_signals": ["company contract"], "quick_questions": ["공급망 개선?"]},
    "supply_chain_headwind_negative": {"label_ko": "공급망 차질·원가 압박", "top_level": "short", "definition": "tariff exposure, shortage, cost inflation.", "value_path": "원가 상승→margin 압박", "include_signals": ["tariff exposure", "shortage", "supply chain disruption", "cost inflation"], "exclude_signals": ["macro index move"], "quick_questions": ["공급망 압박?"]},
    # ─── VALUATION (2) ───────────────────────────────────────────────
    "valuation_narrative_positive": {"label_ko": "밸류에이션 discount 해소", "top_level": "long", "definition": "undervalued, discount, rerating potential.", "value_path": "저평가 해소→multiple expansion", "include_signals": ["undervalued", "discount", "catch-up", "rerating"], "exclude_signals": ["best stock list"], "quick_questions": ["저평가 해소 논리?"]},
    "valuation_narrative_negative": {"label_ko": "밸류에이션 부담·과열", "top_level": "short", "definition": "too expensive, stretched, overvalued.", "value_path": "과열→de-rating", "include_signals": ["too expensive", "stretched valuation", "overvalued"], "exclude_signals": ["formal downgrade"], "quick_questions": ["valuation 부담 중심?"]},
    # ─── POSITIONING / FLOW (4) ──────────────────────────────────────
    "positioning_flow_positive": {"label_ko": "숏커버·매수 유입", "top_level": "long", "definition": "short squeeze, fund buying, covering.", "value_path": "수급 유입→가격 가속", "include_signals": ["short squeeze", "fund buying", "covering", "takes stake"], "exclude_signals": ["buyback"], "quick_questions": ["flow 유입 핵심?"]},
    "positioning_flow_negative": {"label_ko": "차익실현·매도 수급", "top_level": "short", "definition": "profit-taking, de-grossing, fund selling.", "value_path": "포지셔닝 축소→하방", "include_signals": ["profit-taking", "de-grossing", "fund selling"], "exclude_signals": ["earnings miss"], "quick_questions": ["flow unwind 중심?"]},
    "unusual_options_activity": {"label_ko": "이례적 옵션 활동", "top_level": "residual", "definition": "unusual options activity, big options bets.", "value_path": "옵션 시장 시그널→관심 증폭", "include_signals": ["unusual options", "options activity", "options alert", "smart money.*options"], "exclude_signals": [], "quick_questions": ["옵션 활동 중심?"]},
    "short_interest_update": {"label_ko": "공매도 비율·변동", "top_level": "residual", "definition": "short interest changes, heavily shorted.", "value_path": "공매도 데이터→포지셔닝 힌트", "include_signals": ["short interest", "heavily shorted", "days to cover"], "exclude_signals": [], "quick_questions": ["공매도 데이터?"]},
    # ─── STOCK MOVEMENT EXPLANATION (4) ──────────────────────────────
    "stock_surge_explanation_positive": {"label_ko": "급등 해설·상승 이유", "top_level": "long", "definition": "주가 급등 사유 해설 (rallies X%, surges X%).", "value_path": "급등 해설→추가 관심", "include_signals": ["rallies over", "surges", "soars", "jumps.*%", "up.*%"], "exclude_signals": [], "quick_questions": ["급등 사유 해설?"]},
    "stock_crash_explanation_negative": {"label_ko": "급락 해설·하락 이유", "top_level": "short", "definition": "주가 급락 사유 해설 (nosedives, crashes X%).", "value_path": "급락 해설→공포 증폭", "include_signals": ["nosedives", "crashes", "stock falls.*%", "tanks", "tumbles.*%"], "exclude_signals": [], "quick_questions": ["급락 사유 해설?"]},
    "circuit_breaker_halt_event": {"label_ko": "서킷브레이커·일시정지", "top_level": "residual", "definition": "circuit breaker halt, trading halted/resumed.", "value_path": "급변 이벤트→변동성", "include_signals": ["circuit breaker", "halted on", "shares halted", "trading resumed"], "exclude_signals": [], "quick_questions": ["서킷브레이커?"]},
    "technical_analysis_signal": {"label_ko": "기술적 분석·차트 시그널", "top_level": "residual", "definition": "golden cross, moving average, technical pattern.", "value_path": "기술적 신호→트레이더 관심", "include_signals": ["golden cross", "200-day", "moving average", "trend barrier", "tests key"], "exclude_signals": [], "quick_questions": ["기술적 분석?"]},
    # ─── MEDIA / AMPLIFICATION (4) ───────────────────────────────────
    "media_amplification_positive": {"label_ko": "미디어 증폭·상승 해설", "top_level": "long", "definition": "top mover, shares higher, soaring today.", "value_path": "노출 증폭→추격 수급", "include_signals": ["soaring today", "trading higher today", "top mover", "biggest gainer"], "exclude_signals": ["formal upgrade"], "quick_questions": ["이미 오른 뒤 해설?"]},
    "media_amplification_negative": {"label_ko": "미디어 증폭·하락 해설", "top_level": "short", "definition": "shares lower, sell-off, tumbles.", "value_path": "약세 cascade→공포 증폭", "include_signals": ["trading lower today", "sell-off", "tumbles", "plunges"], "exclude_signals": ["formal downgrade"], "quick_questions": ["이미 내린 뒤 해설?"]},
    "stock_why_moving_explanation": {"label_ko": "주가 움직임 이유·해설", "top_level": "residual", "definition": "what's going on with X stock, here's why.", "value_path": "이유 해설→정보 전달", "include_signals": ["what's going on with", "here's why", "what's behind", "what's driving"], "exclude_signals": [], "quick_questions": ["주가 움직임 이유 해설?"]},
    "investment_thesis_article": {"label_ko": "투자 논점·알파 아이디어", "top_level": "residual", "definition": "should you buy, is it a buy, bull/bear case.", "value_path": "opinion/thesis→정보 전달", "include_signals": ["should you buy", "is it a buy", "worth buying", "bull case", "bear case", "moonshot", "better investment"], "exclude_signals": [], "quick_questions": ["투자 논점 기사?"]},
    # ─── MARKET COMMENTARY / ROUNDUP (10) ────────────────────────────
    "macro_market_commentary": {"label_ko": "매크로·시장 코멘터리", "top_level": "residual", "definition": "금리, Fed, 인플레이션, 지수 움직임 광범위 설명.", "value_path": "외부 환경 read-through", "include_signals": ["stock market today", "fed", "inflation", "recession", "economic slowdown"], "exclude_signals": ["single-company event"], "quick_questions": ["멀티종목 매크로?"]},
    "market_movers_roundup": {"label_ko": "멀티종목 movers 기사", "top_level": "residual", "definition": "여러 종목 top movers 나열.", "value_path": "스크리너/요약", "include_signals": ["other big stocks moving", "most active stocks", "top stocks"], "exclude_signals": ["single-ticker"], "quick_questions": ["멀티종목 roundup?"]},
    "sector_movers_session_roundup": {"label_ko": "섹터별 장중 movers 기사", "top_level": "residual", "definition": "12 Health Care Stocks Moving In 형태.", "value_path": "섹터 movers 목록", "include_signals": ["stocks moving in.*session", "stocks moving in.*pre-market", "stocks moving in.*intraday"], "exclude_signals": [], "quick_questions": ["섹터 movers 리스트?"]},
    "daily_market_index_summary": {"label_ko": "일간 지수·시장 요약", "top_level": "residual", "definition": "Dow Gains/Dips X Points; earnings.", "value_path": "시장 요약", "include_signals": ["dow dips", "dow gains", "dow rises", "dow falls", "nasdaq gains", "us stocks", "crude oil gains"], "exclude_signals": [], "quick_questions": ["일간 시장 요약?"]},
    "market_moving_news_digest": {"label_ko": "시장 영향 뉴스 다이제스트", "top_level": "residual", "definition": "Market-Moving News for [Date].", "value_path": "뉴스 다이제스트", "include_signals": ["market-moving news for", "market moving news"], "exclude_signals": [], "quick_questions": ["시장 뉴스 다이제스트?"]},
    "trending_stocks_chatter": {"label_ko": "인기종목·시장 잡담", "top_level": "residual", "definition": "trending tickers, market chatter.", "value_path": "트렌딩 소개", "include_signals": ["trending tickers", "market chatter", "stocks to watch"], "exclude_signals": [], "quick_questions": ["인기종목 소개?"]},
    "sector_update_commentary": {"label_ko": "섹터 업데이트·코멘터리", "top_level": "residual", "definition": "Sector Update: Health Care/Financial Stocks.", "value_path": "섹터 업데이트", "include_signals": ["sector update", "financial stocks", "health care stocks"], "exclude_signals": [], "quick_questions": ["섹터 업데이트?"]},
    "gapping_stocks_analysis": {"label_ko": "갭 상승/하락 종목", "top_level": "residual", "definition": "gapping stocks, gap-ups and gap-downs.", "value_path": "갭 분석", "include_signals": ["gapping stocks", "gap up", "gap down", "gap-ups"], "exclude_signals": [], "quick_questions": ["갭 종목 분석?"]},
    "premarket_afterhours_movers": {"label_ko": "프리마켓·애프터마켓 movers", "top_level": "residual", "definition": "pre-market/after-hours movers roundup.", "value_path": "장전/장후 movers", "include_signals": ["pre-market session", "after-market session", "after-hours session", "before the opening bell"], "exclude_signals": [], "quick_questions": ["장전/장후 movers?"]},
    "oil_energy_commodity_impact": {"label_ko": "유가·에너지·원자재 영향", "top_level": "residual", "definition": "oil price, commodity price moves.", "value_path": "원자재 가격 영향", "include_signals": ["oil tops", "oil jumps", "crude oil", "oil prices", "commodity"], "exclude_signals": [], "quick_questions": ["원자재 가격 충격?"]},
    # ─── SECTOR-SPECIFIC (4) ─────────────────────────────────────────
    "mining_resource_update": {"label_ko": "광산·자원 업데이트", "top_level": "long", "definition": "mineral resource estimate, drill program.", "value_path": "자원 가치 상향→재평가", "include_signals": ["mineral resource", "drill program", "resource estimate", "gold.*deposit", "silver.*deposit"], "exclude_signals": [], "quick_questions": ["자원 업데이트?"]},
    "crypto_digital_asset_event": {"label_ko": "암호화폐·디지털자산 이벤트", "top_level": "residual", "definition": "crypto, stablecoin, blockchain events.", "value_path": "디지털자산 이벤트→재평가", "include_signals": ["bitcoin", "stablecoin", "cryptocurrency", "blockchain", "crypto exchange"], "exclude_signals": [], "quick_questions": ["암호화폐 이벤트?"]},
    "renewable_energy_milestone": {"label_ko": "신재생에너지 마일스톤", "top_level": "long", "definition": "solar project, renewable energy milestone.", "value_path": "에너지전환 투자→성장", "include_signals": ["solar", "renewable energy", "clean energy", "wind farm"], "exclude_signals": [], "quick_questions": ["신재생에너지 이벤트?"]},
    "biotech_pipeline_presentation": {"label_ko": "바이오 파이프라인·학회 발표", "top_level": "residual", "definition": "data presentation at medical conference.", "value_path": "학회 발표→관심", "include_signals": ["present.*data at", "present at.*meeting", "upcoming presentation", "poster presentation"], "exclude_signals": [], "quick_questions": ["학회 발표 예정?"]},
    # ─── NOISE / RESIDUAL (6) ────────────────────────────────────────
    "잡것들_promotional_appearance_noise": {"label_ko": "잡것들_행사·인터뷰·홍보성", "top_level": "residual", "definition": "conference participation, podcast, fireside chat.", "value_path": "IR 노출", "include_signals": ["participate in", "investor conference", "fireside chat"], "exclude_signals": [], "quick_questions": ["홍보 노출?"]},
    "잡것들_screener_listicle_noise": {"label_ko": "잡것들_리스트형 screener 노이즈", "top_level": "residual", "definition": "listicle, penny stocks, meme stocks.", "value_path": "큐레이션/트래픽 유도", "include_signals": ["best meme stocks", "penny stocks", "what you need to know"], "exclude_signals": [], "quick_questions": ["리스트형 기사?"]},
    "ipo_listing_event": {"label_ko": "IPO·상장 이벤트", "top_level": "residual", "definition": "IPO, direct listing, market debut.", "value_path": "유동성 이벤트", "include_signals": ["goes public", "ipo", "direct listing", "debut"], "exclude_signals": ["trading halt"], "quick_questions": ["상장 이벤트?"]},
    "generic_feature_commentary": {"label_ko": "feature·투자아이디어 해설", "top_level": "residual", "definition": "deep dive, feature, opinion article.", "value_path": "opinion layer", "include_signals": ["is it a buy", "deep dive", "feature"], "exclude_signals": ["formal analyst"], "quick_questions": ["feature/opinion?"]},
    "잡것들_company_event_schedule_noise": {"label_ko": "잡것들_이벤트 일정·스케줄 공지", "top_level": "residual", "definition": "events schedule, calendar announcement.", "value_path": "일정 안내", "include_signals": ["events schedule", "schedules.*webcast", "sets.*schedule"], "exclude_signals": [], "quick_questions": ["일정 공지?"]},
    "잡것들_company_award_recognition": {"label_ko": "잡것들_수상·인증·랭킹", "top_level": "residual", "definition": "award, ranked, named one of.", "value_path": "인지도 이벤트", "include_signals": ["named one of", "award", "ranked", "top performing"], "exclude_signals": [], "quick_questions": ["수상/랭킹?"]},
    # ─── OTHER (5) ───────────────────────────────────────────────────
    "patent_ip_event": {"label_ko": "특허·IP 이벤트", "top_level": "residual", "definition": "patent win/loss, IP acquisition.", "value_path": "IP 가치 변화", "include_signals": ["patent", "intellectual property", "ip.*acqui"], "exclude_signals": [], "quick_questions": ["특허/IP 이벤트?"]},
    "activist_investor_event": {"label_ko": "행동주의 투자자 이벤트", "top_level": "long", "definition": "activist investor, activist stake, board fight.", "value_path": "거버넌스 변화→재평가", "include_signals": ["activist", "board fight", "proxy fight", "starboard"], "exclude_signals": [], "quick_questions": ["행동주의 투자자?"]},
    "institutional_portfolio_shift": {"label_ko": "기관 포트폴리오 변경(13F)", "top_level": "residual", "definition": "fund adds/exits, portfolio shift.", "value_path": "기관 수급 변화", "include_signals": ["portfolio shift", "adds.*position", "exits.*position", "q4 portfolio", "13f"], "exclude_signals": [], "quick_questions": ["기관 포트폴리오?"]},
    "stock_comparison_article": {"label_ko": "종목 비교·vs 기사", "top_level": "residual", "definition": "A vs B: which stock is better.", "value_path": "비교 분석", "include_signals": ["which stock is", "better value option", "vs.*which is"], "exclude_signals": [], "quick_questions": ["종목 비교 기사?"]},
    "debt_restructuring_event": {"label_ko": "부채 관리·리파이낸싱", "top_level": "long", "definition": "debt paydown, refinancing, maturity extension.", "value_path": "재무 건전성→안정", "include_signals": ["refinancing", "debt paydown", "maturity extension", "deleveraging"], "exclude_signals": [], "quick_questions": ["부채 관리 이벤트?"]},
    "pre_market_gap_move": {"label_ko": "프리마켓 갭 무브", "top_level": "residual", "definition": "프리마켓에서 갭 상승/하락 후 해설 기사.", "value_path": "갭 해설", "include_signals": ["gaps up", "gaps down", "pre-market gap"], "exclude_signals": [], "quick_questions": ["프리마켓 갭?"]},
    # ─── FALLBACK ────────────────────────────────────────────────────
    "unknown": {"label_ko": "unknown", "top_level": "residual", "definition": "현재 taxonomy rule 어디에도 안정적으로 들어가지 않는 미분류 기사.", "value_path": "사건성은 있을 수 있으나 rule 미정", "include_signals": [], "exclude_signals": ["명확한 기존 case", "명백한 잡것들_ 노이즈 패턴"], "quick_questions": ["현재 rule로는 안정 분류가 안 되는가?"]},
    "meaningless_others": {"label_ko": "잡것들(legacy)", "top_level": "residual", "definition": "legacy broad fallback bucket.", "value_path": "legacy fallback", "include_signals": [], "exclude_signals": [], "quick_questions": ["legacy run row인가?"]},
}

# ═══════════════════════════════════════════════════════════════════════
# RULE GROUPS — 패턴 matching 우선순위: direct_short → indirect_short
#   → direct_long → indirect_long → information_flow → true_residual
# ═══════════════════════════════════════════════════════════════════════

DIRECT_SHORT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("capital_structure_stress_negative", (
        "trading halt", "quotation resumption", "halt news pending",
        "reverse stock split", "reverse-splitting", "reverse splitting",
        "minimum bid", "increase authorized shares", "increases authorized shares",
        "authorized shares", "authorized common stock",
        "non-compliance", "regain compliance",
    )),
    ("financing_dilution_negative", (
        "public offering", "proposed public offering", "registered direct",
        "private placement", "warrants", "convertible notes",
        "convertible senior notes", "common stock offering", "secondary offering",
        "shelf registration", "at-the-market offering",
    )),
    ("restructuring_distress_negative", (
        "chapter 11", "bankruptcy", "going concern", "strategic alternatives",
        "restructuring", "layoffs", "liquidity concerns", "delisting notice",
        "winding down", "ceasing operations",
    )),
    ("litigation_regulatory_negative", (
        "lawsuit", "class action", "investigation", "subpoena",
        "restatement", "fraud", "sec probe", "doj",
        "warning letter", "securities fraud", "shareholder litigation",
    )),
    ("regulatory_clinical_negative", (
        "complete response letter", "clinical hold", "failed to meet",
        "did not meet", "fda rejection", "missed endpoint",
        "trial failure", "drug-induced liver injury", "failed treatment",
        "placebo study", "lacked proof",
    )),
    ("earnings_miss_cut_negative", (
        "misses.*estimate", "miss.*estimate", "lags.*estimate",
        "cuts guidance", "lowered guidance", "weak outlook", "profit warning",
        "below expectations", "loss wider than expected",
        "revenues fall y/y", "revenue fell", "drops production forecast",
        "soft.*guidance", "sees.*below.*est",
        "revenue.*decline.*y/y", "eps.*misses",
    )),
    ("analyst_downgrade_negative", (
        "downgrades", "downgraded", "underperform", "underweight",
        "lowers price target", "target cut", "price target cut",
        "sell rating", "slashed its price target",
        "price target decreased",
    )),
    ("analyst_note_amplification_negative", (
        "analyst warns", "cautious note", "bearish note",
        "skeptical analyst", "analyst concern",
        "bears are raising a caution flag", "pumping the brakes",
    )),
    ("management_governance_negative", (
        "ceo resigns", "cfo resigns", "executive departs",
        "board dispute", "management turmoil", "executive exits",
    )),
    ("insider_selling_concern", (
        "insiders sell", "insider.*selling", "insider.*sold",
        "insider.*offloaded", "executive.*sold shares",
        "insiders.*signalling caution",
    )),
]

INDIRECT_SHORT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("policy_regulatory_headwind_negative", (
        "regulatory framework", "yield ban", "ban stablecoin",
        "policy risk", "lawmakers", "clarity act",
        "bill could", "act could", "federal tax credit",
        "lose the federal tax credit", "crackdown on",
        "targets.*compounders", "warning letters over",
    )),
    ("supply_chain_headwind_negative", (
        "tariff exposure", "rare earth", "component shortage",
        "supply chain disruption", "cost inflation", "input costs rise",
        "critical materials", "tariffs on gross margin",
        "export permit delay",
    )),
    ("peer_competition_negative", (
        "competitive pressure", "rival", "competitor",
        "investment push", "new product from",
        "competition intensifies", "substitute threat",
        "teamed up with spacex", "partnered with spacex", "starlink",
        "takes market share", "stiff competition",
    )),
    ("positioning_flow_negative", (
        "profit-taking", "taking profits", "de-grossing",
        "fund selling", "positioning unwind",
    )),
    ("valuation_narrative_negative", (
        "too expensive", "stretched valuation", "multiple compression",
        "overvalued", "valuation concern", "still a sell",
    )),
]

DIRECT_LONG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("government_contract_award_positive", (
        "contract award", "wins contract", "secures contract",
        "prime contractor", "definitive contract",
        "government contract", "awarded a contract",
    )),
    ("acquisition_target_premium_positive", (
        "acquire.*for.*share.*in cash", "tender offer.*per share",
        "agreement to acquire.*for",
        "strikes agreement to acquire",
    )),
    ("corporate_deal_billion_positive", (
        "billion.*deal", "multiyear deal",
        "data center infrastructure", "\\$[0-9]+b.*deal",
        "deal.*\\$[0-9]+.*billion", "fiber-optic",
    )),
    ("distribution_agreement_positive", (
        "sell.*drugs.*together", "sell.*through.*platform",
        "distribute.*weight", "sell.*on.*platform",
        "distribution agreement", "distribution deal",
    )),
    ("partnership_license_positive", (
        "partnership", "collaboration", "license agreement",
        "licensing deal", "exclusive global license",
        "supply agreement", "inks deal",
    )),
    ("mna_strategic_asset_positive", (
        "acquisition", "acquires", "merger", "buyout",
        "strategic investment", "asset sale", "takeover",
        "agrees to buy", "agreement to acquire",
        "deal to buy", "deal valued",
    )),
    ("settlement_resolution_positive", (
        "settlement", "end feud", "ends feud",
        "resolves dispute", "ends.*legal",
        "truce", "settl.*legal dispute",
    )),
    ("drug_marketing_authorization", (
        "marketing authorization", "european commission.*auth",
        "ec grants", "conditional.*marketing",
        "ema.*approval",
    )),
    ("fda_procedural_action", (
        "fda accepts", "fda reverses", "fda to review",
        "pdufa date", "supplemental new drug",
        "fda makes u-turn", "fda.*walkback",
        "fda.*change.*mind", "accepted for fda review",
    )),
    ("drug_designation_positive", (
        "qidp designation", "fast track", "breakthrough therapy",
        "orphan drug", "priority review",
        "accelerated approval", "regenerative medicine",
    )),
    ("clinical_trial_initiation_positive", (
        "first patient dosed", "first patient enrolled",
        "trial initiated", "initiated phase",
        "doses first patient", "enrollment.*begins",
    )),
    ("clinical_trial_data_update", (
        "response rate", "interim data", "interim analysis",
        "trial data", "efficacy data", "phase.*data",
        "durable.*response", "complete response.*rate",
        "objective response", "topline results",
        "preliminary data", "pivotal.*results",
    )),
    ("regulatory_clinical_positive", (
        "fda approval", "approved by the fda", "positive topline",
        "phase 3 success", "phase 2 success",
        "nda acceptance", "bla acceptance", "pivotal data",
        "slowed kidney function decline",
        "fda approved",
    )),
    ("customer_adoption_positive", (
        "selected by", "customer win", "deployment",
        "customer adoption", "adopted by", "major customer",
    )),
    ("demand_backlog_positive", (
        "strong demand", "demand surge", "backlog",
        "bookings growth", "order growth",
        "sales dramatically increase", "rising.*demand",
        "optical demand",
    )),
    ("commercial_launch_expansion_positive", (
        "launches", "launch", "prepared to launch",
        "expands", "expansion", "platform expansion",
        "capacity expansion", "production ramp", "commercial launch",
        "unveils", "rollout", "commercialization",
        "opens.*facility", "scale.*production",
    )),
    ("product_technology_integration", (
        "integrates.*with", "adopts.*ai", "ai agent",
        "platform integration", "adopts anthropic",
        "brings ai", "wix.*bookings.*google",
        "ai-powered", "ai-driven",
    )),
    ("revenue_growth_milestone", (
        "record revenue", "record sales", "revenue.*record",
        "sales.*record", "fourfold revenue growth",
        "revenue growth of", "revenue.*milestone",
    )),
    ("cost_margin_improvement", (
        "margin improvement", "cost reduction", "operating leverage",
        "adjusted ebitda.*margin", "profitability.*inflection",
    )),
    ("mining_resource_update", (
        "mineral resource", "drill program", "resource estimate",
        "growth in measured", "gold.*deposit", "silver.*deposit",
        "resource upgrade", "meter drill",
    )),
    ("renewable_energy_milestone", (
        "solar.*project", "renewable energy", "clean energy",
        "wind farm", "battery technology", "energy storage",
    )),
    ("earnings_guidance_update", (
        "sees fy.*sales", "sees fy.*eps",
        "sees q[1-4].*sales", "sees q[1-4].*eps",
        "sees.*adj.*eps.*vs", "sees.*sales.*vs",
        "fy20.*vs.*est", "fy20.*guidance",
        "expected to be.*vs.*est",
        "expects.*revenue.*decline",
        "affirms.*guidance", "reiterates.*guidance",
        "raises.*guidance.*from",
        "targets.*annual growth",
        "fy2026.*expected",
    )),
    ("earnings_beat_raise_positive", (
        "beats.*estimate", "beat.*estimate",
        "better-than-expected", "raises guidance", "raised guidance",
        "record revenue", "earnings beat", "above estimates",
        "strong results", "strong.*quarter",
        "eps.*beats", "sales.*beat",
        "revenue.*beat", "adj.*eps.*beats",
        "surpasses.*earnings", "tops.*estimates",
        "tops revenue estimates", "earnings.*top",
    )),
    ("analyst_upgrade_positive", (
        "initiates coverage", "upgrades.*to",
        "upgraded.*to", "outperform",
        "raises price target", "market outperform",
        "overweight", "buy rating", "strong buy",
    )),
    ("analyst_reiteration_positive", (
        "reiterates buy", "reiterate buy",
        "reiterates.*outperform", "reiterates.*overweight",
        "maintains buy", "maintains.*price target",
        "reiterates.*buy", "maintains.*buy rating",
    )),
    ("analyst_note_amplification_positive", (
        "analyst says", "citi says", "bofa says",
        "bullish note", "analyst comment helped",
        "morgan stanley says", "jpmorgan says",
        "goldman says", "wells fargo says",
        "barclays says", "ubs says", "rbc says",
        "raymond james says", "evercore says",
        "needham.*upgrade", "keybanc.*note",
        "hc wainwright", "benefiting from",
        "seen benefiting",
    )),
    ("analyst_forecast_revision_positive", (
        "analysts boost their forecasts",
        "analysts.*boost.*forecast",
        "boost their forecasts after upbeat",
        "these analysts boost",
    )),
    ("shareholder_return_positive", (
        "share repurchase", "buyback", "repurchase program",
        "increases dividend", "returns capital",
        "buyback.*accelerated",
    )),
    ("dividend_special_event", (
        "initiates quarterly dividend", "initiates.*dividend",
        "special dividend", "quarterly dividend of",
        "increases.*quarterly dividend",
    )),
    ("management_governance_positive", (
        "appoints new ceo", "appoints veteran",
        "governance agreement", "board refresh", "new leadership",
        "joins.*as chief", "new ceo",
    )),
    ("insider_buying_positive", (
        "insider buying", "director.*purchased",
        "ceo.*bought shares", "insider.*purchase",
    )),
    ("credit_facility_update", (
        "revolving credit", "credit facility",
        "extends.*credit", "upsizes.*credit",
        "refinanc", "strengthening liquidity",
    )),
    ("debt_restructuring_event", (
        "debt paydown", "maturity extension",
        "deleveraging", "debt reduction",
    )),
    ("activist_investor_event", (
        "activist", "starboard.*stake", "proxy fight",
        "board fight", "activist.*stake",
    )),
]

INDIRECT_LONG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("policy_regulatory_tailwind_positive", (
        "regulatory clarity", "policy support", "bill boosts",
        "rule benefits", "tailwind from policy",
        "cms.*reinstates", "medicare.*billing",
    )),
    ("supply_chain_tailwind_positive", (
        "supply chain easing", "input costs fall",
        "sourcing improves", "cost relief", "normalization helps",
    )),
    ("peer_readthrough_positive", (
        "read-through", "peer strength", "peer results",
        "sector leader", "peer demand signal",
        "spending massively on artificial intelligence",
    )),
    ("positioning_flow_positive", (
        "short squeeze", "fund buying", "position established",
        "covering", "squeeze higher",
        "surprise stake", "takes stake", "took a stake",
        "disclosed stake", "sends.*shares flying",
    )),
    ("valuation_narrative_positive", (
        "undervalued", "discount", "catch-up",
        "rerating potential", "cheap stock",
        "valuation opportunity", "attractively priced",
    )),
]

INFORMATION_FLOW_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("stock_crash_explanation_negative", (
        "stock.*crash", "stock.*nosedive", "stock.*tanks",
        "shares.*sink", "stock falls.*%",
        "why.*crash", "why.*fell", "why.*slipped",
        "drops.*%.*after", "sinks.*%",
        "plummets.*%", "plunges.*%",
    )),
    ("stock_surge_explanation_positive", (
        "stock.*soars", "stock.*surges", "stock.*rallies",
        "shares.*surge", "stock.*jumps",
        "rallies over.*%", "surges.*%",
        "soars.*%", "up.*%.*after",
        "explodes over", "catapults",
        "rocketed", "doubles.*on",
        "shares.*skyrocket",
    )),
    ("media_amplification_negative", (
        "trading lower today", "sinking today",
        "plummeting today", "stock sank",
        "shares are trading lower", "sell-off",
        "tumbles", "plunges", "drifting lower today",
        "crashed this week", "tumbling",
        "dips while market", "stock.*dip",
    )),
    ("media_amplification_positive", (
        "surging today", "soaring today",
        "trading higher today", "stock soared",
        "shares are trading higher", "top mover",
        "biggest gainer", "jumped today",
        "skyrocketing today", "popped today",
        "soaring this week", "climbing.*morning",
        "shares.*higher.*after",
    )),
    ("stock_why_moving_explanation", (
        "what's going on with", "here's why",
        "what's behind the jump", "what's behind the",
        "what's driving", "here is what you should know",
    )),
    ("analyst_forecast_revision_negative", (
        "analysts cut their forecasts",
        "analysts.*cut.*forecast",
        "these analysts cut",
        "cut their forecasts after",
        "analysts are cutting their estimates",
        "analysts are downgrading",
    )),
    ("unusual_options_activity", (
        "unusual options activity", "unusual options",
        "options activity", "option alert",
        "options market tells", "smart money.*options",
        "options.*betting big", "vol/oi ratio",
    )),
    ("short_interest_update", (
        "short interest", "heavily shorted",
        "days to cover", "short squeeze potential",
    )),
    ("technical_analysis_signal", (
        "golden cross", "200-day average", "200-day",
        "moving average", "trend barrier",
        "tests key", "key.*level",
    )),
    ("circuit_breaker_halt_event", (
        "circuit breaker", "halted on circuit",
        "shares halted", "trading resumed",
    )),
    ("institutional_stake_disclosure", (
        "13d disclos", "13d filing",
        "13g filing", "files 13d",
        "disclosing.*% stake",
    )),
    ("patent_ip_event", (
        "patent fight", "patent.*win", "patent.*loss",
        "intellectual property", "loses.*defense",
    )),
    ("investment_thesis_article", (
        "should.*buy", "worth buying",
        "is it a buy", "is.*stock.*buy",
        "buy, sell, or hold", "everyone is talking about",
        "how is the market feeling",
        "should investors", "can.*bounce back",
        "moonshot", "better investment",
        "afford to ignore", "can't afford",
        "could.*rally.*%", "explosive upside",
        "got \\$.*could be", "has the potential",
    )),
    ("stock_comparison_article", (
        "which stock is.*better",
        "better value option",
        "vs.*which is the better",
    )),
    ("analyst_consensus_overview", (
        "insights from.*analyst", "analyst reviews",
        "from.*financial analysts",
        "where.*stands with analysts",
        "do wall street analysts like",
        "demystifying.*insights",
    )),
    ("institutional_portfolio_shift", (
        "portfolio shift", "adds.*position",
        "exits.*position", "q4 portfolio",
        "13f.*filing", "new positions",
        "boosts.*stake", "trims.*holdings",
    )),
    ("market_movers_roundup", (
        "other big stocks moving", "investors' radars",
        "most active stocks", "top stocks",
        "watch these stocks", "wall street's favorite",
        "what you need to know",
        "stocks.*trade up.*what you need",
        "shares skyrocket.*what you need",
    )),
    ("generic_feature_commentary", (
        "deep dive", "feature",
        "interesting analyst questions",
        "show promise", "safe-and-steady",
        "is it too late", "has the pullback",
        "valuation after", "p/e ratio insights",
        "stock.*still a buy",
        "assessing.*valuation",
        "opened.*valuation opportunity",
    )),
]

TRUE_RESIDUAL_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("잡것들_promotional_appearance_noise", (
        "participate in the", "investor conference",
        "podcast featuring", "webcasting its participation",
        "fireside chat", "panel discussion",
        "conference presentation",
    )),
    ("잡것들_company_event_schedule_noise", (
        "events schedule", "schedules.*webcast",
        "sets.*schedule", "sets.*events",
    )),
    ("잡것들_company_award_recognition", (
        "named one of", "named to.*list",
        "award", "top performing companies",
        "ranks.*on.*list",
    )),
    ("잡것들_screener_listicle_noise", (
        "why these", "healthcare stocks are surging",
        "penny stocks with market caps", "best meme stocks",
        "wall street but", "promising penny stocks",
        "stocks are surging in",
        "new stocks.*betting big",
        "reasons.*upside",
        "stocks.*underwhelm",
    )),
    ("biotech_pipeline_presentation", (
        "present.*data at", "present at.*meeting",
        "upcoming presentation", "poster presentation",
        "to present.*at", "multiple upcoming presentations",
    )),
    ("macro_market_commentary", (
        "stock market today", "nasdaq down", "s&p 500",
        "interest rates", "inflation",
        "recession", "macro headwind", "economic slowdown",
        "geopolitical", "producer inflation",
        "crude oil stocks fall", "consumer price index",
        "equity markets", "pre-markets down",
        "equities bounce", "markets end higher",
    )),
    ("geopolitical_market_impact", (
        "middle east tensions", "iran war",
        "escalating.*tensions", "war.*resolution",
        "sanctions",
    )),
    ("tariff_trade_impact", (
        "strikes down.*tariff", "trump tariff",
        "trade war", "tariff.*impact",
    )),
    ("oil_energy_commodity_impact", (
        "oil tops", "oil jumps", "oil prices",
        "crude oil", "commodity price",
        "oil.*barrel",
    )),
    ("ipo_listing_event", (
        "goes public", "direct listing", "market debut",
        "stock debut", "initial public offering", " ipo ",
    )),
    ("crypto_digital_asset_event", (
        "bitcoin", "stablecoin", "cryptocurrency",
        "blockchain", "crypto exchange",
        "digital asset",
    )),
    ("divestiture_exit_neutral", (
        "divests", "sells business", "exits market",
        "exits.*uk", "exits.*eu", "liquidation of",
    )),
    ("earnings_call_summary", (
        "earnings call summary", "moby summary",
    )),
    ("earnings_transcript_snapshot", (
        "earnings call transcript", "earnings snapshot",
        "earnings call highlights", "conference call transcript",
        "q[1-4] 20[0-9]{2} earnings call",
    )),
    ("earnings_summary_assessment", (
        "earnings breakdown", "earnings assessment",
        "earnings insights", "earnings.*key takeaways",
        "insights into.*q[1-4]", "a peek at.*earnings",
        "a glimpse of.*earnings", "a glimpse of.*potential",
        "earnings report:.*overview", "earnings report.*overview",
        "earnings review", "q[1-4] summary",
        "q[1-4] earnings insights", "q[1-4] earnings assessment",
        "examining the future",
        "q[1-4].*earnings.*summary", "a preview of.*earnings",
    )),
    ("earnings_preview_watch", (
        "to report q[1-4] results", "to report.*quarter",
        "wall street expects", "ahead of earnings",
        "earnings: a preview", "earnings preview",
        "what to expect", "what to look for",
        "earnings: what to", "to report earnings",
        "q[1-4] earnings preview",
        "earnings outlook", "in focus before.*earnings",
    )),
    ("earnings_guidance_update", (
        "sees fy.*sales", "sees fy.*eps",
        "sees q[1-4].*sales", "sees q[1-4].*eps",
        "sees.*adj.*eps.*vs", "sees.*sales.*vs",
        "fy20.*vs.*est", "fy20.*guidance",
        "expected to be.*vs.*est",
        "expects.*revenue.*decline",
        "affirms.*guidance", "reiterates.*guidance",
        "raises.*guidance.*from",
        "targets.*annual growth",
        "fy2026.*expected",
    )),
    ("earnings_result_mixed_neutral", (
        "mixed.*results", "mixed.*quarter",
        "reports mixed",
        "beat.*miss", "eps.*beats.*sales.*miss",
    )),
    ("earnings_revenue_report_neutral", (
        "reports q[1-4].*revenue", "reports fourth quarter",
        "reports.*financial results",
        "reports q[1-4].*loss.*tops revenue",
        "q[1-4].*results.*revenue",
        "announces.*quarter.*results",
        "achieved.*operating margins",
    )),
    ("earnings_estimate_comparison", (
        "compared to estimates", "key metrics",
        "wall street projections for key",
        "gear up for.*q[1-4]",
        "a look at.*key metrics",
    )),
    ("sector_movers_session_roundup", (
        "stocks moving in.*session",
        "stocks moving in.*pre-market",
        "stocks moving in.*intraday",
        "stocks moving in.*after-market",
        "[0-9]+ health care stocks moving",
        "[0-9]+ industrials stocks moving",
        "[0-9]+ information technology stocks moving",
        "[0-9]+ consumer discretionary stocks moving",
        "[0-9]+ communication services stocks moving",
        "[0-9]+.*stocks moving in",
        "pre-market session",
    )),
    ("premarket_afterhours_movers", (
        "after-hours session", "after hours session",
        "before the opening bell",
        "pre-market.*gainers", "after-market.*movers",
        "what is happening.*markets before",
    )),
    ("daily_market_index_summary", (
        "dow dips", "dow gains", "dow rises", "dow falls",
        "nasdaq gains over", "us stocks mixed",
        "us stocks traded", "crude oil gains over",
    )),
    ("market_moving_news_digest", (
        "market-moving news for", "market moving news",
    )),
    ("trending_stocks_chatter", (
        "trending tickers", "market chatter",
        "stocks to watch",
    )),
    ("sector_update_commentary", (
        "sector update", "financial stocks.*decline",
        "financial stocks.*fall", "financial stocks.*advance",
        "health care stocks.*decline", "health care stocks.*rise",
    )),
    ("gapping_stocks_analysis", (
        "gapping stocks", "gap up", "gap down",
        "gap-ups", "gap-downs",
        "notable gaps", "gap.*session",
    )),
    ("pre_market_gap_move", (
        "gaps up in pre", "gaps down in pre",
        "pre-market gap", "gaps up on",
        "gaps down on",
    )),
    ("debt_restructuring_event", (
        "debt paydown", "maturity extension",
        "deleveraging", "debt reduction",
    )),
]

CASE_RULE_GROUPS: list[tuple[str, list[tuple[str, tuple[str, ...]]]]] = [
    ("direct_short", DIRECT_SHORT_RULES),
    ("indirect_short", INDIRECT_SHORT_RULES),
    ("direct_long", DIRECT_LONG_RULES),
    ("indirect_long", INDIRECT_LONG_RULES),
    ("information_flow", INFORMATION_FLOW_RULES),
    ("true_residual", TRUE_RESIDUAL_RULES),
]

POSITIVE_EXPLAINERS = (
    "surging today", "soaring today", "trading higher today",
    "stock soared", "shares are trading higher",
    "top mover", "biggest gainer",
    "jumping", "rocketed", "catapults", "doubles",
)
NEGATIVE_EXPLAINERS = (
    "trading lower today", "sinking today", "plummeting today",
    "stock sank", "shares are trading lower",
    "sell-off", "tumbles", "plunges", "drifting lower today",
    "nosedives", "crashes", "tanks",
)


def normalize_text(*parts: str | None) -> str:
    return "\n".join(part for part in parts if part).lower()


def contains_any(text: str, patterns: tuple[str, ...]) -> bool:
    for pattern in patterns:
        if ".*" in pattern or "[" in pattern or "\\" in pattern:
            if re.search(pattern, text):
                return True
            continue
        if pattern in text:
            return True
    return False


def is_fallback_case(case_type: str) -> bool:
    return case_type == "unknown" or case_type == "meaningless_others" or case_type.startswith("잡것들_")


def classify_company_news(title: str, body: str, full_text: str = "", publisher: str = "") -> str:
    title_text = (title or "").lower()
    text = normalize_text(title, body, full_text, publisher)
    if not text.strip():
        return "unknown"
    for _, rules in CASE_RULE_GROUPS:
        for case_type, patterns in rules:
            if contains_any(text, patterns):
                if case_type == "ipo_listing_event" and "trading halt" in text:
                    continue
                return case_type
    # fallback: media explainer
    if "why" in text or "shares are trading" in text:
        if contains_any(text, NEGATIVE_EXPLAINERS):
            return "media_amplification_negative"
        if contains_any(text, POSITIVE_EXPLAINERS):
            return "media_amplification_positive"
    # fallback: transcript in title
    if re.search(r"\bq[1-4]\b", title_text) and ("transcript" in title_text or "snapshot" in title_text):
        return "earnings_transcript_snapshot"
    # fallback: "why stock"
    if "why " in title_text and ("stock" in title_text or "shares" in title_text):
        return "generic_feature_commentary"
    return "unknown"


def meta_for_case(case_type: str) -> tuple[str, str]:
    meta = CASE_META.get(case_type, CASE_META["unknown"])
    return str(meta["label_ko"]), str(meta["top_level"])


def case_meta(case_type: str) -> dict[str, object]:
    return CASE_META.get(case_type, CASE_META["unknown"])


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
        if is_fallback_case(raw_row["case_type"]):
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
        ) VALUES (?, ?, ?, ?, 'company_news', 'FINNHUB', ?, ?, 'company_news_2025_plus_taxonomy_v6', ?, ?, ?, ?)
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
    lines.append(f"- `fallback rows (잡것들_* + unknown)`: {threshold_summary['meaningless_rows']:,}")
    lines.append("- evidence table window에서 analysis를 선택한 뒤 case별 근거 row를 정렬/검색할 수 있다.")
    lines.append("")
    lines.append("## taxonomy v6 설계 포인트")
    lines.append("")
    lines.append("- 100개+ 유형 구조를 유지하면서, 의미없는 정보 계열은 `잡것들_` prefix로, 끝까지 분류되지 않은 row는 `unknown`으로 분리했다.")
    lines.append("- BENZINGA EPS/guidance 포맷 regex 패턴 추가로 실적 기사 포착률 대폭 향상.")
    lines.append("- 섹터 movers, 갭 분석, 장전/장후, 일간 요약 등 반복 패턴 독립 유형화.")
    lines.append("- 고영향 residual 샘플을 기준으로 노이즈와 미분류 fallback을 분리했다.")
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
    lines.append("- v6 taxonomy는 의미없는 정보 계열을 `잡것들_*`로 명시하고, 진짜 미분류 row는 `unknown`으로 남긴다.")
    lines.append("- `unknown`은 다음 tranche에서 새 case로 승격할 후보를 모으는 버킷이다.")
    return "\n".join(lines)


def write_outputs(out_dir: Path, note_title: str, run_id: str, since: str, until: str, threshold_summary: dict, insert_summary: dict, case_summaries: list[dict], markdown: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    stem = f"model2_company_news_taxonomy_v6_{stamp}"
    payload = {
        "analysis_id": run_id,
        "note_title": note_title,
        "since": since,
        "until": until,
        "scope": "company_news_2025_plus_taxonomy_v6",
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
                "scope=company_news_2025_plus_taxonomy_v6",
                f"total_rows={threshold_summary['total_rows']}",
                f"analyzable_rows={threshold_summary['analyzable_rows']}",
                f"impacted_rows={insert_summary['impacted_rows']}",
                f"meaningless_rows={threshold_summary['meaningless_rows']}",
            ]
        ),
        encoding="utf-8",
    )
    (out_dir / "model2_company_news_taxonomy_v6_latest.md").write_text(markdown, encoding="utf-8")
    (out_dir / "model2_company_news_taxonomy_v6_latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"terminal/backend/backend/data/app.db")
    parser.add_argument("--since", default="2025-01-01")
    parser.add_argument("--until", default="")
    parser.add_argument("--page-id", default="99a89607-d943-4a57-8a98-be8ba86f731b")
    parser.add_argument("--note-title", default="Model 2 company_news taxonomy v6 (2025+)")
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
    print(f"case_type_count={len(CASE_META)}")
    if args.page_id:
        print(f"updated_page={args.page_id}")
    with suppress(Exception):
        conn.close()


if __name__ == "__main__":
    main()
