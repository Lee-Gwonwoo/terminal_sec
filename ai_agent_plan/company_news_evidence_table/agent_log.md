## 2026-03-26
**작성 시각:** 14:35 (local)

- 초기 작업:
  - `ai_agent_plan/company_news_evidence_table/plan.md` 생성
  - 대상 page id `99a89607-d943-4a57-8a98-be8ba86f731b` 존재 확인
  - 기존 `ai_research_tool/model2_case_analysis.py`가 `press_release only` + 규칙 기반 자동 분류기라는 점 확인
- 사용자 요구 уточ정:
  - 대상 범위를 `2025-01-01 이후 company_news`로 우선 고정
  - company news 후속기사에서 “왜 티커가 오르고/하락하는지” 설명하는 이슈 유형 중심으로 Model 2 taxonomy를 만들 것
  - 의미 없는 기사들은 `잡것들` 유형으로 분리할 것
  - 분석 결과는 page id에 저장하고, 근거 뉴스는 별도 `evidence table` window에서 확인 가능하게 만들 것
- 상태:
  - Step 1~2 해석 확정 중
  - code 변경 직전

## 2026-03-26
**업데이트 시각:** 18:50 (local)

- 구현 완료:
  - `terminal/backend/src/db.ts`
    - `model2_analysis_runs`, `model2_evidence_rows` 테이블 및 index 추가
  - `terminal/backend/src/services/model2AnalysisRepository.ts`
    - analysis list / detail / case summary / evidence row 조회 로직 추가
  - `terminal/backend/src/server.ts`
    - `/api/model2/analyses*` endpoint 추가
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/EvidenceTableWindow.tsx`
    - analysis 선택, case 선택, keyword/ticker 검색, sort, limit UI 추가
  - `ai_research_tool/test_model2_company_news_analysis.py`
    - `2025-01-01+ company_news` 전수 분류 + evidence row 적재 + research page 갱신 스크립트 추가
- 실제 실행 결과:
  - `analysis_id = 6ec343f2-d7be-43e1-9297-90e5c35643ea`
  - total_rows=`599681`
  - analyzable_rows=`527876`
  - impacted_rows=`105608`
  - meaningless_rows=`448556`
  - updated_page=`99a89607-d943-4a57-8a98-be8ba86f731b`
- API 검증:
  - `/api/model2/analyses` 응답 확인
  - `/api/model2/analyses/6ec343f2-d7be-43e1-9297-90e5c35643ea/cases` 응답 확인
  - `/api/model2/analyses/6ec343f2-d7be-43e1-9297-90e5c35643ea/evidence?...` 응답 확인
- 리스크:
  - `잡것들` 비중이 매우 높아 taxonomy false positive / false negative 추가 보정이 필요할 수 있음
  - 현재 분류는 rule-based 1차 버전이라, 사용자가 evidence table에서 실제 row를 보고 type 경계를 더 조정할 여지가 큼
