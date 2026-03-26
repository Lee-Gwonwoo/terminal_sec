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

## 2026-03-26
**업데이트 시각:** 20:35 (local)

- 후속기사 확장 판독:
  - `test_model2_company_news_followup_wide_probe.mjs`로 explanation-style `company_news`를 더 넓게 추출
  - 결과 파일: `terminal/backend/out/model2_company_news_followup_wide_probe.json`
  - 범위: 샘플 `180건`, impacted 상위 `80건`
- 핵심 확인 사항:
  - `meaningless_others = 26,558`, `macro_sector_readthrough = 5,855`
  - `meaningless_others` 안에 실제 가격 설명력이 있는 기사 패턴이 대량으로 남아 있음
  - 반복적으로 보인 승격 후보 묶음:
    - 정책/법안/규제 framework read-through
    - peer capex / 경쟁 심화 read-through
    - adjacent product / substitute threat
    - analyst mention / note amplification
    - valuation skepticism / multiple compression
    - insider buy / fund positioning
    - supplier / customer / ecosystem dependency
    - media amplification / top mover explanation
    - event-ahead speculation / breakout-failure
    - low-information listicle / trending-stock recap
- plan 반영:
  - 넓게 읽은 결과를 바탕으로 `plan.md`에 corpus 2차 판독 결과와 우선 승격 후보 묶음을 추가

## 2026-03-26
**업데이트 시각:** 20:50 (local)

- taxonomy 정제 진행:
  - 1차 48개 후보를 실제 분류기 반영을 염두에 둔 `taxonomy v2 초안`으로 압축
  - 구조:
    - Direct Long 9
    - Direct Short 9
    - Indirect Long 8
    - Indirect Short 8
    - Information-Flow / Explanation Mechanics 5
    - True Residual 3
  - 총 42개로 정리
- 대표 매핑 예시를 plan에 추가:
  - `Clarity Act` -> `정책·법안 역풍 read-through`
  - `Micron vs SK Hynix capex` -> `peer capex 확대 / 경쟁 심화 read-through`
  - `ServiceNow vs Anthropic product` -> `adjacent product / substitute threat`
  - `Corning top mover` -> `analyst mention` 또는 `media amplification`
  - `Lucid reverse split + analyst cut` -> direct short 복합형
- 상태:
  - 실제 후속기사 기반 taxonomy 준비 단계 진행 중
  - 다음은 각 case에 포함 신호 / 제외 신호 / 경계 사례를 붙이는 작업

## 2026-03-26
**업데이트 시각:** 16:37 (local)

- taxonomy v3 코드 반영:
  - `ai_research_tool/test_model2_company_news_analysis.py`
    - company_news classifier를 taxonomy v3 기준으로 교체
    - `macro_sector_readthrough` broad bucket을 유지하지 않고 policy / peer / supply-chain / valuation / flow / media / transcript / feature 계열로 세분화
    - markdown note에 각 case별 정의, 가치 경로, 포함/제외 신호, 빠른 판별 질문, 대표 예시를 출력하도록 확장
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/model2CaseDescriptions.ts`
    - evidence table 우클릭 description 창이 taxonomy v3 case key를 읽을 수 있게 교체
    - 기존 run을 위해 legacy key alias도 유지
- taxonomy v3 재실행:
  - 실행 명령:
    - `C:/Users/home/AppData/Local/Programs/Python/Python313/python.exe ai_research_tool/test_model2_company_news_analysis.py --page-id 99a89607-d943-4a57-8a98-be8ba86f731b`
  - 결과:
    - `analysis_id = 2b5ab4d1-a1dd-4906-8226-e21d8bd41465`
    - `total_rows = 599681`
    - `analyzable_rows = 527876`
    - `impacted_rows = 105608`
    - `meaningless_rows = 371983`
    - target page 갱신 완료
- 비교 확인:
  - old run `meaningless_rows = 448556`
  - new run `meaningless_rows = 371983`
  - residual broad bucket에서 `76573` row가 독립 case로 이동
- 대표 top case 확인:
  - `analyst_upgrade_positive = 30672`
  - `macro_market_commentary = 25451`
  - `commercial_launch_expansion_positive = 22505`
  - `peer_competition_negative = 13505`
- 검증:
  - frontend `npm.cmd run build` 성공
  - backend API raw 확인:
    - `GET /api/model2/analyses` -> 새 run 노출 확인
    - `GET /api/model2/analyses/2b5ab4d1-a1dd-4906-8226-e21d8bd41465/cases` -> 새 taxonomy case label 노출 확인
- 상태:
  - taxonomy v3가 code -> DB run -> page -> API까지 반영됨
  - 브라우저 시각 확인은 사용자 확인 대기

## 2026-03-26
**업데이트 시각:** 21:10 (local)

- 사용자 버그 리포트 반영:
  - evidence table 유형 메뉴에서 우클릭 후 `description` 클릭 시 설명 창이 안 열린다는 문제 확인
  - 추가 요구: description 안에 어떤 키워드/신호를 기준으로 분류했는지도 보여주기
- 원인 확인:
  - context menu가 dropdown 바깥의 fixed layer에 렌더링되는데, 외부 클릭 감지가 해당 메뉴 클릭까지 바깥 클릭으로 처리해서 `mousedown` 시점에 먼저 닫히고 있었음
  - 따라서 `description` 버튼 `onClick`이 실제로 실행되지 못하는 구조였음
- 수정 내용:
  - `EvidenceTableWindow.tsx`
    - context menu ref를 추가하고 outside-click 판정에서 context menu 내부 클릭을 예외 처리
  - `src/app/types.ts`, `src/app/model2CaseDescriptions.ts`
    - `classificationBasis`, `keywordSignals` 필드 추가
    - include/exclude signals 기준으로 기본 분류 기준 문구를 자동 생성하도록 보강
  - `src/app/components/CaseDescriptionWindow.tsx`
    - `분류 기준`, `분류 키워드` 섹션 추가
- 검증 예정:
  - frontend 정적 오류 확인
  - frontend build 확인
  - 우클릭 `description` -> `Case Description` 창 오픈 수동 확인

## 2026-03-26
**업데이트 시각:** 21:35 (local)

- 사용자 지시 반영:
  - 현재 taxonomy를 더 체계화하고, plan의 최종 목적(후속기사의 direct + indirect 가격 영향 정보 유형화)에 맞춰 다시 정렬하라는 요청 반영
- 샘플 재점검 결과:
  - `meaningless_others` 상위 샘플에 `authorized shares`, `analyst estimate cut`, `conference participation` 같은 반복 패턴이 남아 있었음
  - `generic_feature_commentary` 상위 샘플에 `Apple/SpaceX -> Globalstar`, `surprise stake`, `buy/sell/hold`, `interesting analyst questions`처럼 direct/indirect/decision-framework가 뒤섞여 있었음
  - 특히 기존 분류기는 `full_text`를 읽지 않고 `title/body` 위주로 분류해서, 기사 안의 실제 가격 영향 설명 문장을 놓치는 구조였음
- 구조 수정:
  - `test_model2_company_news_analysis.py`
    - 분류 입력을 `title + body + full_text + publisher`로 확장
    - rule set을 `direct short -> indirect short -> direct long -> indirect long -> information-flow -> true residual` 상위 그룹 구조로 재배치
    - `promotional_appearance_noise`, `screener_listicle_noise` residual case 추가
    - `capital_structure_stress_negative`, `peer_competition_negative`, `positioning_flow_positive`, `generic_feature_commentary` 등 패턴 확장
    - evidence preview도 `full_text` 우선으로 저장하게 보강
  - `model2CaseDescriptions.ts`
    - 새 residual case 2개 설명 추가
    - `generic_feature_commentary` 설명을 decision-framework 중심으로 보강
- 검증 예정:
  - Python 문법 오류 확인
  - frontend 정적 오류 + build 확인
  - company_news taxonomy v4 재실행 후 새 analysis 수치 확인

## 2026-03-26
**업데이트 시각:** 21:48 (local)

- 재검증 결과:
  - Python `py_compile` 통과
  - frontend `get_errors` 0건
  - frontend `npm.cmd run build` 성공
  - taxonomy 재실행 완료:
    - `analysis_id = da7d8093-b878-48c9-8055-1851ab9d041a`
    - `total_rows = 599681`
    - `analyzable_rows = 527876`
    - `impacted_rows = 105608`
    - `meaningless_rows = 359680`
  - 비교:
    - 직전 run `meaningless_rows = 371983`
    - 이번 run `meaningless_rows = 359680`
    - 추가로 `12303` row가 `잡것들` 밖의 독립 case로 이동
- API 확인:
  - 최신 run `cases` 응답에서 새 residual case 노출 확인
    - `promotional_appearance_noise = 3512`
    - `screener_listicle_noise = 3975`
  - `generic_feature_commentary = 16440`, `meaningless_others = 359680` 확인
- 해석:
  - 이번 수정으로 taxonomy가 `flat keyword residual 분류기`에서 `full_text 기반 + 상위 그룹 구조` 분류기로 한 단계 올라감
  - 다만 `meaningless_others`가 여전히 절대 규모가 커서, 다음 보정은 남은 residual 샘플을 다시 읽어 `decision-framework`, `ecosystem substitution`, `estimate-reset` 같은 반복 패턴을 더 독립화하는 쪽이 필요함

## 2026-03-26
**업데이트 시각:** 21:55 (local)

- 추가 회귀 검증:
  - backend `npm run build` 성공
  - backend `npm run test` 성공 (`13 files / 78 tests`)
- 최종 상태:
  - frontend description 변경, Python taxonomy 재설계, analysis 재실행, backend 회귀 검증까지 마침
  - 브라우저 시각 확인은 사용자 확인 대기

## 2026-03-26
**업데이트 시각:** 17:52 (local)

- 사용자 추가 요구 반영:
  - taxonomy 확장 전에 `company_news` publisher 분류부터 바로잡아 달라는 요청 반영
  - 실제 기사 출처가 `SEEKINGALPHA` 등인데 `FINNHUB`로 보이는 문제를 우선 해결 대상으로 전환
- 원인 확인:
  - `fetchCompanyNewsRaw()`가 Finnhub payload의 `item.source`를 우선 신뢰해 publisher를 저장하고 있었고, 이 값이 `FINNHUB`인 경우 wrapper row가 그대로 `FINNHUB`로 남았음
  - startup `backfillPublisher()`는 `origin_url`이 있는 일부 `FINNHUB` row만 교정해서, `origin_url` 없는 legacy `company_news` wrapper row는 계속 `FINNHUB`에 묶여 있었음
  - 실DB 확인 결과 `source='FINNHUB' AND source_type='company_news' AND publisher='FINNHUB'` row가 `88,596`건 존재했고, 샘플 row도 `origin_url = NULL` 상태였음
  - 추가 샘플 확인에서 body/title에 `Seeking Alpha`, `Benzinga`, `(Reuters)`, `TipRanks` 같은 명시적 출처 단서가 반복적으로 남아 있음을 확인
- 수정 내용:
  - `terminal/backend/src/services/finnhubNewsProvider.ts`
    - `title/body` 내 명시적 publisher 신호를 읽는 content-based inference helper 추가
    - 새 `company_news` 수집 시 `FINNHUB`를 그대로 저장하지 않고 `origin_url -> provider source -> content hint -> url domain` 우선순위로 publisher를 결정하도록 변경
    - `backfillPublisher()`가 `publisher='FINNHUB' AND source_type='company_news'` legacy row까지 대상으로 삼고, `title/body/origin_url` 기반으로 publisher를 재분류하도록 확장
- 검증 예정:
  - backend 정적 오류 확인
  - backend `npm run build`
  - backend `npm run test`
  - 실DB에서 `publisher='FINNHUB'` 건수 감소와 샘플 row 교정 여부 확인
  - `/api/news` 또는 model2 cases/evidence에서 publisher 표기 확인

## 2026-03-26
**업데이트 시각:** 17:55 (local)

- 검증 완료:
  - backend 정적 오류 0건 확인
  - backend `npm run build` 성공
  - backend `npm run test` 성공 (`13 files / 78 tests`)
  - `terminal/backend/tests/finnhubNewsProvider.test.ts`에 content-based publisher inference / backfill 테스트 2건 추가
- 런타임 통합 확인:
  - running backend API에서 `keyword=Seeking Alpha` 조회 시 sample row `4d57f8cf-de14-47ed-b3d3-02e3c0a87a9b`의 publisher가 `SEEKINGALPHA`로 노출됨 확인
  - 실DB 확인 결과 `source='FINNHUB' AND source_type='company_news' AND publisher='FINNHUB'` 건수는 `88,596 -> 88,264`로 감소
  - 대표 교정 샘플 확인:
    - `4d57f8cf-de14-47ed-b3d3-02e3c0a87a9b` -> `SEEKINGALPHA`
    - `d4ac22ec-0a36-4652-91a3-1791ee6fd65c` -> `BENZINGA`
    - `f77c2765-df46-4155-bef9-be32ccb523c8` -> `REUTERS`
- 상태:
  - 새 수집 + startup backfill 모두 publisher 보정 로직이 반영됨
  - 아직 `FINNHUB`로 남는 row는 명시적 출처 단서가 부족한 케이스라, 필요하면 다음 단계에서 wrapper HTML 파싱 또는 추가 content heuristic로 더 줄일 수 있음

## 2026-03-26
**업데이트 시각:** 18:02 (local)

- 추가 확인:
  - `publisher='FINNHUB'`이면서 body/title에 `Yahoo Finance`가 보이는 row를 따로 확인해 보니, 두 종류가 섞여 있었음
  - 하나는 실제 Yahoo branded transcript/video 기사(`Yahoo Finance Senior Reporter`, `Opening Bid`, `Market Minute`, `Good Buy or Goodbye`)였고, 다른 하나는 단순 citation(`according to Yahoo Finance`)이었음
- 수정 내용:
  - `terminal/backend/src/services/finnhubNewsProvider.ts`
    - Yahoo 전용 content hint를 추가하되, 단순 `Yahoo Finance` 문자열이 아니라 branded show/transcript 패턴만 `YAHOO`로 승격하도록 제한
  - `terminal/backend/tests/finnhubNewsProvider.test.ts`
    - Yahoo branded transcript 패턴을 `YAHOO`로 인식하는 테스트 추가
    - generic citation 오분류를 피하기 위한 전제 아래 backfill 테스트 추가
- 검증 예정:
  - backend 정적 오류 확인
  - backend `npm run build`
  - backend `npm run test`
  - 실DB에서 Yahoo branded sample row 교정 여부 확인

## 2026-03-26
**업데이트 시각:** 18:02 (local)

- 검증 완료:
  - backend 정적 오류 0건 확인
  - backend `npm run build` 성공
  - backend `npm run test` 성공 (`13 files / 80 tests`)
- 런타임 통합 확인:
  - 실DB에서 Yahoo branded sample row 4건 확인:
    - `d99d7c2f-d9b7-4926-a771-721c3c059875` -> `YAHOO`
    - `c2d868d3-e03d-454e-ac87-b856c8b538b6` -> `YAHOO`
    - `19c77389-4926-4e43-b540-1d9b6608bf78` -> `YAHOO`
    - `42a006b1-99a8-49c4-a9a8-c8ebfe8ab5ba` -> `YAHOO`
  - running backend API에서 `keyword=Opening Bid` 조회 시 Yahoo branded row들이 `publisher='YAHOO'`로 노출됨 확인
  - 실DB 집계 기준 `source='FINNHUB' AND source_type='company_news'`에서
    - `publisher='YAHOO'`: `686205`
    - `publisher='FINNHUB'`: `88239`
- 상태:
  - Yahoo branded transcript/video 기사까지 `FINNHUB -> YAHOO` 교정 로직이 반영됨
  - 남은 `FINNHUB` row는 Yahoo 단순 citation 또는 출처 단서 부족 케이스가 중심이라, 필요하면 다음 단계에서 wrapper HTML 파싱으로 더 줄일 수 있음
