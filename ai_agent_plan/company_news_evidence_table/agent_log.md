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

## 2026-03-26
**업데이트 시각:** 15:15 (local)

- 사용자 추가 요구 반영:
  - 각 유형이 어떤 기준으로 분류됐는지 설명 제공
  - `Evidence Table`의 유형 메뉴에서 우클릭 시 `description` 버튼 표시
  - `description` 클릭 시 새 창으로 분류 기준 설명 표시
  - plan 문서에도 해당 기능 반영
- 구현 내용:
  - `src/app/model2CaseDescriptions.ts`
    - case별 `description`, `definition`, `valuePath`, `includeSignals`, `excludeSignals`, `boundaryCase`, `quickQuestions` 정의 추가
  - `src/app/components/CaseDescriptionWindow.tsx`
    - 유형 설명 전용 새 창 컴포넌트 추가
  - `src/app/types.ts`
    - `case-description` window type 및 window data shape 추가
  - `src/app/App.tsx`
    - custom event(`open-case-description`)를 받아 현재 탭에 `Case Description` 창 생성
  - `src/app/components/DraggableWindow.tsx`
    - `case-description` 렌더링 분기 추가
  - `src/app/components/EvidenceTableWindow.tsx`
    - native select를 custom case dropdown으로 교체
    - case item 우클릭 context menu + `description` 버튼 추가
- 검증:
  - frontend `get_errors` 0건 확인
  - frontend `npm run build` 성공
  - backend `npm run test` 78/78 pass
  - 로컬 브라우저 페이지 오픈 확인 (`http://localhost:5173/`)

## 2026-03-26
**업데이트 시각:** 19:20 (local)

- 성능 진단:
  - `GET /api/model2/analyses` 약 15.8초
  - `GET /api/model2/analyses/:id/cases` 약 38.2초
  - `GET /api/model2/analyses/:id/evidence?limit=300` 약 21.5초
  - 결론: refresh 후 no-data처럼 보인 현상과 별개로, 실제 병목은 `model2_evidence_rows` 조회 시 `news_items JOIN` + 대용량 집계였다.
- 수정 내용:
  - `terminal/backend/src/db.ts`
    - `model2_evidence_rows`에 `published_at`, `source`, `publisher`, `source_type`, `title`, `body_preview`, `url` 비정규화 컬럼 추가
    - `model2_case_summaries` 캐시 테이블 추가
    - 기존 run에 대해 startup 시 backfill + summary cache 생성 migration 추가
  - `terminal/backend/src/services/model2AnalysisRepository.ts`
    - cases/evidence 조회를 `news_items JOIN` 없이 동작하도록 변경
  - `ai_research_tool/test_model2_company_news_analysis.py`
    - 새 evidence 컬럼과 case summary cache를 insert 시점에 함께 채우도록 변경
  - `EvidenceTableWindow.tsx`
    - cases/evidence fetch를 병렬화
- 상태:
  - backend rebuild / API 재측정 대기
  - 사용자 확인 대기

- 재검증 결과:
  - backend `GET /api/model2/analyses`: 약 `30 ms`
  - backend `GET /api/model2/analyses/:id/cases`: 약 `21 ms`
  - backend `GET /api/model2/analyses/:id/evidence?limit=300`: 약 `203 ms`
  - frontend proxy `GET /api/model2/analyses/:id/cases`: 약 `25 ms`
  - frontend proxy `GET /api/model2/analyses/:id/evidence?limit=300`: 약 `240 ms`

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `db.ts`, `model2AnalysisRepository.ts`, `EvidenceTableWindow.tsx` 에러 0건 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `78/78` pass |
| 런타임 통합 | ✅ | backend 직접 API + Vite proxy API 모두 실측 확인 |

## 2026-03-26
**업데이트 시각:** 19:40 (local)

- 추가 성능 보정:
  - `EvidenceTableWindow.tsx`
    - `cases` 재조회 조건을 `analysis 변경 시`로 한정
    - `keyword`, `ticker` 입력에 `250ms debounce` 적용
    - 기본 row limit을 `300 -> 100`으로 낮춤
    - stale request가 state를 덮지 않도록 `AbortController` 적용
  - `terminal/backend/src/services/model2AnalysisRepository.ts`
    - keyword/ticker filter가 없을 때 `total`을 `model2_analysis_runs` / `model2_case_summaries` 캐시에서 바로 읽도록 변경
    - evidence body preview 응답 길이를 축소해 payload 경량화
- 기대 효과:
  - 초기 진입 payload 감소
  - 검색 타이핑 중 불필요한 API 호출 감소
  - case dropdown 변경 없는 sort/limit 변경에서 `cases` 재조회 제거

- 재검증 결과:
  - backend `GET /api/model2/analyses/:id/evidence?limit=100`: 약 `40 ms`
  - frontend proxy `GET /api/model2/analyses/:id/evidence?limit=100`: 약 `39 ms`
  - `limit=1` evidence payload 길이: `1412 bytes`

## 2026-03-26
**업데이트 시각:** 19:55 (local)

- 추가 구조 최적화:
  - `src/app/components/DraggableWindow.tsx`
    - `NewsWindow`, `FinnhubNewsWindow`, `CaseResearchWindow`, `EvidenceTableWindow` 등 window 컴포넌트를 `React.lazy`로 code split
    - `Suspense` fallback 추가
- 목적:
  - 기능 변화 없이 초기 앱 진입 시 메인 번들 크기와 파싱 비용을 줄이기 위함

## 2026-03-26
**업데이트 시각:** 20:15 (local)

- 사용자 요구 재해석:
  - 최종 목적은 `company_news taxonomy + evidence UI` 자체가 아니라,
    `왜 종목이 올랐고 왜 떨어졌는가`를 설명하는 후속기사들을 읽고,
    **어떤 정보가 어떤 식으로 가격에 영향을 미치는지의 유형 체계**를 만드는 것임을 다시 명확히 함
  - direct issue 뿐 아니라 policy / sector / peer / valuation / positioning 같은 indirect read-through도 포함해야 함
- 실제 후속기사 corpus 1차 판독:
  - `test_model2_company_news_followup_probe.mjs`로 `why / tumbles / surges / sell-off` 성격의 `company_news` 샘플 25건 확인
  - 집계 결과:
    - `meaningless_others`: `18,489`
    - `macro_sector_readthrough`: `5,213`
    - 나머지 analyst/product/M&A 등은 상대적으로 소수
  - 샘플에서 확인한 misclassification 후보:
    - `Clarity Act ... crypto sell-off` -> 정책/법안 read-through 성격
    - `SK Hynix Plans Big Investment Push. Why Micron Stock Is Dropping.` -> peer competitive read-through 성격
    - `Why ServiceNow Stock Was Drifting Lower Today` -> adjacent product / sector shock 성격
    - `Corning Is Up 9%. Why It’s the Top Mover ...` -> sell-side mention / media amplification 성격
- plan 수정:
  - `plan.md`의 최종 목적을 `후속기사 판독 기반 direct + indirect price-impact taxonomy 구축`으로 재정의
  - residual bucket 축소 방향 명시
  - 최소 30개 이상 taxonomy 후보(실제는 48개 후보)를 초안으로 추가
- 상태:
  - taxonomy 재설계 방향 정리 완료
  - 사용자 확인 대기
