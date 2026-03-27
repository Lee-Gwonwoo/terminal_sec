### 목표
- 최종 목적은 **`company_news` 후속기사들을 읽어, “왜 종목이 올랐고 왜 떨어졌는가”를 설명하는 정보 유형의 taxonomy를 만드는 것**이다.
- 이 taxonomy는 **개별 티커의 직접 이벤트**뿐 아니라, **정책·섹터·peer·수급·경쟁사·밸류에이션·포지셔닝 변화처럼 간접적으로 가격에 영향을 미치는 read-through 정보**도 포함해야 한다.
- `page id = 99a89607-d943-4a57-8a98-be8ba86f731b` 대상 research page 본문에는, 위 목적에 맞는 상세 taxonomy와 각 유형의 정의/경계/대표 예시를 저장한다.
- `evidence table`은 최종 목적 자체가 아니라, **taxonomy가 실제 후속기사에 어떻게 적용되는지 검증하는 도구**로 유지한다.
- 따라서 이번 plan의 중심은 `UI 구현`이 아니라, **후속기사 corpus 판독 -> 가격 영향 정보 유형 추출 -> 30개 이상 상세 taxonomy 설계 -> 그 taxonomy를 저장/검증 가능한 구조로 반영**이다.

### 현재 진행 상태(2026-03-26 업데이트)
- 완료:
  - backend DB schema에 `model2_analysis_runs`, `model2_evidence_rows` 추가
  - backend API 추가
    - `GET /api/model2/analyses`
    - `GET /api/model2/analyses/:analysisId`
    - `GET /api/model2/analyses/:analysisId/cases`
    - `GET /api/model2/analyses/:analysisId/evidence`
  - frontend에 새 window type `evidence-table` 및 `EvidenceTableWindow.tsx` 추가
  - 각 case가 어떤 기준으로 분류됐는지 보여주는 `Case Description` 창 및 description 데이터 추가
  - `Evidence Table`의 case 메뉴 항목 우클릭 시 `description` 버튼이 나타나고, 클릭 시 새 창을 열도록 구현
  - `2025-01-01+ company_news` 대상 1차 Model 2 분석 run 생성 및 page 저장 완료
  - `why stock moved` 성격의 `company_news` 후속기사 샘플 25건 1차 판독 완료
- 생성된 첫 analysis run:
  - `analysis_id = 6ec343f2-d7be-43e1-9297-90e5c35643ea`
  - 전체 row: `599,681`
  - analyzable row: `527,876`
  - impacted row: `105,608`
  - `잡것들`: `448,556`
- 후속기사 explanation-style 샘플 1차 점검 결과:
  - 현재 분류기에서 `why / tumbles / surges / sell-off` 성격 기사 중 `18,489`건이 `meaningless_others`로 분류됨
  - 같은 집합에서 `macro_sector_readthrough`는 `5,213`건으로, residual bucket이 가격 설명력 있는 기사까지 과도하게 삼키고 있음
  - 실제 샘플에는 아래처럼 `직접 공시`는 아니지만 가격 영향 설명력이 분명한 기사가 포함됨
    - `Clarity Act ... crypto sell-off` -> 정책/법안 read-through
    - `SK Hynix Plans Big Investment Push. Why Micron Stock Is Dropping.` -> peer capex / 경쟁 구도 read-through
    - `Corning Is Up 9%. Why It’s the Top Mover ...` -> sell-side single-line comment / 수급 반응
    - `Why ServiceNow Stock Was Drifting Lower Today` -> sector shock / adjacent product threat
- 남은 작업:
  - 후속기사 corpus를 더 넓게 읽고, 직접/간접 가격 영향 정보 유형을 30개 이상으로 재정의
  - `meaningless_others`를 진짜 저정보 기사로 축소하고, 영향 설명력이 있는 residual 기사들을 독립 유형으로 승격
  - 새 taxonomy 기준으로 case 정의, 포함/제외 신호, 경계 사례, 대표 예시를 다시 작성
  - 이후 필요하면 기존 analysis run을 재분류하고 evidence table을 새 taxonomy 검증 창으로 사용

### PLAN CHANGE (2026-03-26, taxonomy reset)
- 배경: 사용자의 최종 목적은 `개별 직접 이슈 분류기`가 아니라, **후속기사에 나타나는 가격 영향 정보의 유형 체계화**였다. 현재 plan은 이 목적보다 UI와 1차 rule implementation에 과도하게 치우쳐 있었다.
- 추가 배경: 실제 `company_news` 후속기사 샘플을 읽어보니, 정책/법안, peer 투자, 경쟁 구도 변화, analyst 한 줄 코멘트, valuation 부담, 섹터 read-through처럼 **직접 공시가 아니어도 가격 설명력이 있는 기사**가 다수 존재했다.
- 변경: plan의 최종 목적을 `후속기사 판독 기반 direct + indirect price-impact taxonomy 구축`으로 재정의하고, 최소 30개 이상의 상세 case taxonomy 후보를 먼저 설계하는 방향으로 수정한다.
- 영향: `meaningless_others`는 앞으로 `영향 설명력이 약한 저정보 기사`만 남기고, 현재 residual에 섞여 있던 설명형 기사들은 신규 case로 분리하는 것이 목표가 된다.

### PLAN CHANGE (2026-03-26)
- 배경: `cases` API가 약 38초, `evidence` API가 약 21초 수준으로 느려서 UI가 멈춘 것처럼 보였다.
- 변경: `model2_evidence_rows`에 table 렌더링용 뉴스 필드를 비정규화 저장하고, `model2_case_summaries` 캐시 테이블을 추가해 조회 시 `news_items JOIN`과 대규모 `GROUP BY`를 피한다.
- 영향: 기존 analysis run도 startup migration에서 backfill 대상이 되며, 이후 run부터는 insert 시점에 summary cache까지 즉시 채운다.

### PLAN CHANGE (2026-03-26, follow-up)
- 배경: SQL 병목 제거 후에도 frontend가 filter/sort 변경마다 `cases`를 다시 불러오고, 검색 입력 중 매 타이핑마다 즉시 요청을 날려 체감 지연이 남아 있었다.
- 변경: `cases` fetch를 analysis 변경 시에만 수행하고, `keyword/ticker`는 debounce 후 evidence만 재조회한다. 초기 `limit`도 `100`으로 낮춰 첫 paint payload를 줄인다.
- 영향: 초기 진입과 검색 타이핑 체감이 더 빨라지고, 서버의 불필요한 재요청 수가 줄어든다.

### PLAN CHANGE (2026-03-26, bundle split)
- 배경: API 속도는 충분히 빨라졌지만, frontend 메인 청크가 커서 앱 첫 진입 시 모든 window 컴포넌트가 한 번에 번들에 포함되고 있었다.
- 변경: `DraggableWindow`에서 window 컴포넌트들을 `React.lazy`로 분리해 실제 창을 열 때만 로드하도록 한다.
- 영향: 기능 변화 없이 초기 번들 다운로드/파싱 비용이 줄고, 자주 쓰지 않는 window는 필요할 때만 로드된다.

### PLAN CHANGE (2026-03-26, evidence table recovery)
- 배경: backend가 일시적으로 unavailable했다가 살아난 뒤에도, `EvidenceTableWindow`는 초기 `analyses` fetch 실패 상태를 그대로 유지해 `Failed to load analyses (HTTP 500)` 문구와 빈 선택창이 남을 수 있었다.
- 변경: `analyses` fetch 성공 시 stale error를 즉시 지우고, 초기 실패 후에는 자동 재시도하도록 frontend recovery 흐름을 추가한다.
- 영향: backend startup 지연이나 일시적 proxy 오류가 있어도 Evidence Table이 새로고침 없이 스스로 회복할 수 있다.

### PLAN CHANGE (2026-03-26, company_news blacklist cleanup)
- 배경: 사용자가 `링크 없음`, `SEEKINGALPHA`, `MOTLEY FOOL` company_news를 실DB에서 제거하고, 이후 FINNHUB company_news pull에서도 동일 조건을 저장하지 않도록 요청했다.
- 변경: `fetchCompanyNewsRaw()`에서 blank URL 및 블랙리스트 publisher(`SEEKINGALPHA`, `MOTLEY FOOL`)를 반환 단계에서 제거하고, backend startup에서 기존 `FINNHUB/company_news` 블랙리스트 row를 삭제하는 cleanup을 추가한다.
- 영향: 이후 수집분은 insert 전에 차단되고, 재기동 시 기존 누적 row도 함께 정리된다.

### PLAN CHANGE (2026-03-26, evidence cache blacklist filter)
- 배경: `news_items`에서는 블랙리스트 company_news가 제거됐더라도, Evidence Table은 denormalized cache인 `model2_evidence_rows`를 직접 읽기 때문에 `MOTLEY FOOL` 같은 orphan/legacy row가 계속 보일 수 있었다.
- 변경: `model2AnalysisRepository.ts`의 evidence/case summary 조회에서 blocked/orphaned `FINNHUB/company_news` row를 공통 WHERE로 제외하고, startup cleanup helper에서도 같은 조건의 evidence cache row를 제거하도록 확장한다.
- 영향: live Evidence Table은 블랙리스트 publisher/blank-link/orphan cache row를 더 이상 노출하지 않게 된다.

### 현재 레포 상태(중요, 확인됨)
- 대상 research page는 이미 존재한다.
  - `page id`: `99a89607-d943-4a57-8a98-be8ba86f731b`
  - 현재 title: `company news analysis prompt`
  - 현재 tab: `investing task logic`
- 현재 research note 저장은 `terminal/backend/backend/data/app.db`의 `research_tabs`, `research_pages` 테이블을 사용한다.
- 현재 프론트에는 `AI Research Window`(`case-research`)가 이미 존재하고, `CaseResearchWindow.tsx`가 `/api/research/*`를 사용해 page 본문을 편집/저장한다.
- 현재 window 시스템은 `src/app/types.ts`, `src/app/App.tsx`, `src/app/components/AddTabModal.tsx`, `src/app/components/DraggableWindow.tsx`에서 관리한다.
- 현재 뉴스 테이블의 실질적인 기준 구현은 `FinnhubNewsWindow.tsx`이다.
  - 서버사이드 검색, ticker 검색, source filter, sortable columns, column visibility, display mode, full text modal 등 이미 구현돼 있다.
  - 새 `evidence table` window는 이 창의 표 패턴과 상호작용을 최대한 재사용하는 쪽이 안전하다.
- 현재 `ai_research_tool/model2_case_analysis.py`가 이미 존재한다.
  - 이 스크립트는 현재 `press_release only`로 고정돼 있다.
  - `title/body/full_text`를 regex 기반 `CATEGORY_RULES`와 `CASE_TYPE_GUIDANCE`로 분류한다.
  - 즉, **현재 스크립트는 agent가 기사 하나하나를 직접 읽어 판단하는 방식이 아니라 규칙 기반 자동 분류기**다.
  - 또한 evidence markdown 파일 생성과 `research_pages.body` 업데이트 기능이 이미 있다.
- 따라서 사용자가 말한 `model 2 지침대로 분석`을 그대로 만족하려면, 단순히 기존 스크립트를 company_news에 돌리는 것만으로 충분한지 먼저 결정해야 한다.
  - 이유: 현재 스크립트는 `press_release`용 taxonomy/패턴을 전제로 설계되어 있고, company news는 재서술 기사/언론 기사/요약 기사 성격이 더 강하다.

### 제약 / 비범위
- 이번 단계는 **taxonomy 설계와 준비 작업**이 중심이다. 즉시 전수 재분류까지 닫는 것은 후속 단계로 남을 수 있다.
- 하지만 taxonomy 설계는 반드시 **실제 후속기사 판독 결과**를 기반으로 해야 하며, 단순 키워드 브레인스토밍으로 끝내면 안 된다.
- direct / indirect 영향은 둘 다 포함한다. `간접이라서 residual`로 보내는 설계는 이번 목적과 맞지 않는다.
- mock 데이터는 사용하지 않는다.
- 기존 `FinnhubNewsWindow`의 운영 semantics를 함부로 바꾸지 않는다.
- 기존 `CaseResearchWindow`를 제거하거나 대체하지 않는다. `evidence table`은 별도 window로 추가한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 0`은 실제 후속기사들을 읽고, 현재 residual bucket이 무엇을 놓치고 있는지 파악하는 단계다.
- `Step 1`은 최종 목적을 `직접+간접 가격 영향 정보 분류`로 명확히 고정하는 단계다.
- `Step 2`는 최소 30개 이상의 상세 taxonomy를 초안으로 설계하는 단계다.
- `Step 3`은 각 유형의 포함/제외 신호와 경계 사례를 정리하는 단계다.
- `Step 4`는 그 taxonomy를 실제 evidence row와 page 본문에 어떻게 반영할지 설계하는 단계다.
- 이후 API/UI는 taxonomy 검증 수단으로 이어진다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- company news 분석 방식이 바뀌면 `PLAN CHANGE`로 기록한다.
- 각 Step 완료 후 다음 3가지를 같이 확인한다.
  - 무엇이 바뀌었는지
  - 사용자가 직접 확인할 수 있는 방법
  - 남은 리스크와 완화 방안
- 사용자 확인 전에는 완료 항목도 `⏳`로 유지한다.
- 사용자 확인 후에만 `✅`로 승격한다.

### 아키텍처(상위)
- 데이터 입력:
  - 기본 source: `news_items.source_type = 'company_news'`
  - 본문 보강: `news_fulltext.full_text`
  - 반응률: `news_change_metrics`
  - 기업 컨텍스트: `company_profiles`, `securities`
- 분석 산출물:
  - research page 본문: `왜 주가가 올랐고 내렸는가`를 설명하는 정보 유형 체계와 정의
  - evidence row dataset: 각 유형의 대표 근거 기사와 경계 사례 목록
- UI 출력:
  - 기존 `AI Research Window`: taxonomy note / 정의 / 경계 사례 확인
  - 새 `evidence table` window: 유형 선택 후 근거 기사 검증
- 권장 구현 방향:
  1. 실제 후속기사 corpus를 읽고 direct / indirect price-impact information을 먼저 추출
  2. 그 결과를 상세 taxonomy와 annotation guide로 정리
  3. 이후 backend / evidence row / UI는 taxonomy를 저장하고 검증하는 수단으로 사용

### 결정/선행조건(초기에 확정 필요)
- 결정 1: `분석`의 의미
  - 선택지 A: 기존 `model2_case_analysis.py`를 company news에 맞게 확장한 규칙 기반 분류를 사용한다.
  - 선택지 B: agent가 Model 2 지침에 따라 실제 뉴스들을 읽고 유형을 설계/보정한 뒤, 그 결과를 저장하는 반수동 분석을 한다.
  - 현재 권장: **B를 기준으로 taxonomy를 먼저 확정하고, 이후 반복 실행 가능한 부분만 A로 코드화**한다.
  - 이유: 기존 스크립트는 `press_release only` 전제이며, company news는 같은 규칙을 그대로 적용하면 오분류 가능성이 높다.
- 결정 2: evidence row 저장 위치
  - 선택지 A: markdown 파일만 생성하고 UI는 markdown을 파싱한다.
  - 선택지 B: backend가 DB 조회 + 분석 결과를 JSON row로 제공하고 UI는 JSON API를 사용한다.
  - 현재 권장: **B**
  - 이유: 정렬, 검색, 메뉴 필터, 컬럼 제어는 markdown 파싱보다 JSON API가 훨씬 안전하다.
- 결정 3: 새 window의 연결 방식
  - 선택지 A: `CaseResearchWindow` 내부 패널로 추가
  - 선택지 B: 별도 `WindowType`인 `evidence-table`로 추가
  - 현재 권장: **B**
  - 이유: 사용자가 명시적으로 “새로운 윈도우”를 요청했다.
- 결정 4: evidence dataset의 영속 방식
  - 선택지 A: 매번 page id 기준으로 동적 재계산
  - 선택지 B: page id 또는 note title 기준으로 evidence 결과를 별도 저장/캐시
  - 현재 권장: **1차는 B보다 A에 가깝게 단순화**, 즉 backend가 분석 산출 row를 API로 읽게 하되, 장기적으로 캐시 여부를 후속 결정
  - 이유: 먼저 기능을 닫고, 이후 성능 병목이 있으면 캐시/테이블을 추가하는 편이 낫다.

### 계획 중간 필수 확인
- 현재 `why stock moved` 기사들 중 어떤 비율이 `meaningless_others`로 빠지는지 계속 측정해야 한다.
- `간접 영향`이라고 해서 residual로 버리지 말고, 정책/섹터/peer/경쟁/수급/valuation/read-through 축으로 독립 유형을 만들 수 있는지 먼저 본다.
- company news 전수 범위를 정확히 고정해야 한다.
  - source 이름: `FINNHUB`인지, `FMP` company news도 함께 넣을지
  - source_type은 `company_news`만인지, `news`/`market_news`를 섞을지
- 기존 `model2_case_analysis.py`의 `press_release only` 가정이 어디까지 박혀 있는지 점검해야 한다.
- evidence table에 필요한 최소 컬럼을 확정해야 한다.
  - 유형
  - 뉴스 제목
  - publish/published_at
  - summary/body preview
  - ticker
  - source/source_type
  - reaction metrics
- research page 본문과 evidence row 사이의 연결 키를 확정해야 한다.
  - `page_id`
  - `case_type`
  - `news_id`

### 후속기사 corpus 1차 판독에서 확인한 것
- `Why ServiceNow Stock Was Drifting Lower Today`:
  - 핵심은 `Anthropic introduced a new product`라는 **adjacent product / competitive shock**다.
  - 이는 실적/계약이 아니지만 주가 설명력이 분명하므로 독립 유형 후보가 필요하다.
- `Clarity Act Deal Could Ban Stablecoin Yields; Circle Leads Crypto Sell-Off`:
  - 핵심은 **법안/정책 변화가 crypto business model에 미치는 간접 영향**이다.
  - 현재 rule에서는 residual로 빠지지만 실제로는 `policy / legislation read-through` 성격이다.
- `SK Hynix Plans Big Investment Push. Why Micron Stock Is Dropping.`:
  - 핵심은 **peer capex 확대 -> 경쟁 심화 우려 -> 상대 종목 약세**다.
  - 이는 `peer competitive read-through` 유형 후보다.
- `Corning Is Up 9%. Why It’s the Top Mover in the S&P 500.`:
  - 핵심은 sell-side 코멘트 또는 한 줄 mention이 수급 트리거가 된 경우다.
  - 이 역시 analyst formal upgrade와는 다른 독립 유형 후보다.
- `Super Micro Stock Drops. Why Citi Just Slashed Its Price Target.`:
  - 이는 기존 analyst downgrade로 충분히 설명 가능하다.
- 결론:
  - 현재 residual bucket에는 `저정보 잡기사`와 `간접 영향 설명 기사`가 섞여 있다.
  - 따라서 taxonomy 재설계의 1차 목적은 **residual 정리**가 아니라 **가격 설명력 있는 indirect 후속기사의 독립 유형화**다.

### 후속기사 corpus 2차 확장 판독에서 확인한 것
- explanation-style filter를 넓혀 `2025-01-01+ company_news`에서 **180건 샘플 / impacted 상위 80건**을 추가 판독했다.
- 집계 결과:
  - `meaningless_others`: `26,558`건 (`impacted_count = 5,101`)
  - `macro_sector_readthrough`: `5,855`건 (`impacted_count = 1,784`)
  - 그 외 analyst/product/earnings/M&A는 상대적으로 작지만 안정적 패턴을 보임
- publisher 분포:
  - `YAHOO` 비중이 압도적으로 높고, 그 안에 **진짜 후속 설명 기사**와 **Zacks/24-7WS/listicle형 저정보 기사**가 혼재한다.
  - `SEEKINGALPHA`, `BENZINGA`, `MARKETWATCH`는 상대적으로 설명 밀도가 높지만, opinion/commentary 기사도 많이 섞여 있다.
- 추가로 확인한 반복 패턴:
  - `formal analyst action`과 `analyst mention / single-line note`는 다른 유형으로 봐야 한다.
  - `peer strong capex / peer aggressive investment / peer product launch`는 개별 회사 직접 이벤트가 아니지만 가격 설명력이 반복된다.
  - `valuation skepticism`, `too expensive`, `buy the dip or fold`, `is it still a buy` 류는 단순 listicle과 달리 **valuation narrative** 자체가 핵심일 때가 있다.
  - `insider purchase`, `fund letter`, `position established`, `de-grossing`, `profit-taking` 류는 수급/포지셔닝 explanation으로 독립성이 있다.
  - `supply chain rule`, `rare earth sourcing`, `tariff exposure`, `yield ban`, `regulatory framework` 류는 policy / supply-chain read-through로 반복된다.
  - 반면 `top stock`, `worth buying`, `trending stock`, `portfolio for now`, `momentum stock` 류는 여전히 진짜 `low-information residual`에 가깝다.

### 넓게 읽은 뒤 정리한 우선 승격 후보 묶음
- 아래 묶음들은 `meaningless_others`에서 우선 분리해야 할 가능성이 높다.
1. 정책·법안·규제 framework read-through
2. peer capex / 경쟁사 투자 / 경쟁 심화 read-through
3. adjacent product / substitute threat read-through
4. sell-side formal action과 별개인 `analyst mention / analyst note amplification`
5. valuation skepticism / multiple compression narrative
6. insider buy / fund positioning / ownership-change explanation
7. supplier / customer / ecosystem dependency read-through
8. media amplification / headline cascade / top mover explanation
9. event-ahead speculation / breakout-failure / resistance-level narrative
10. low-information listicle / generic recommendation / trending-stock recap

### 예비 taxonomy 후보 (최소 30개)
아래 목록은 1차 corpus 판독 후 정리한 후보이며, 최종 taxonomy는 이 중 병합/분할을 거쳐 확정한다.

#### long direct
1. 실적 호조·가이던스 상향
2. 애널리스트 상향·목표가 상향
3. 대형 계약·수주 확보
4. 전략적 파트너십·유통 제휴
5. 신제품 출시·상업화 본격화
6. 수요 급증·백로그 확대
7. 승인·임상 호재
8. 규제 리스크 해소·소송 해소
9. 대형 고객 확보·채택 확대
10. 자산 매각 / 사업부 unlock / 전략가치 재평가
11. 인수합병 프리미엄·takeout 기대
12. 자사주 매입·주주환원 강화

#### short direct
13. 실적 부진·가이던스 하향
14. 애널리스트 하향·목표가 하향
15. 희석성 자금조달
16. 규제·임상 악재
17. 소송·조사·회계 리스크
18. 구조조정·생존성 악화
19. 핵심 계약 해지·고객 이탈
20. 제품 실패·리콜·출시 지연
21. 경영진 이탈·지배구조 충격
22. 배당 삭감·주주환원 후퇴

#### indirect / read-through long
23. 정책·법안 수혜 read-through
24. 금리·거시 완화 수혜 read-through
25. 섹터 심리 회복·risk-on read-through
26. peer strong earnings read-through
27. peer capex 확대 수혜 read-through
28. 공급망 병목 완화·원가 하락 수혜
29. 경쟁사 약화에 따른 share-gain 기대
30. 대형 테마/플랫폼 채택 확산 수혜
31. short squeeze / positioning unwind long
32. valuation catch-up / discount 해소

#### indirect / read-through short
33. 정책·법안 역풍 read-through
34. 금리·거시 악화 read-through
35. 섹터 전반 디레이팅·risk-off read-through
36. peer aggressive capex / 증설로 인한 경쟁 심화
37. 경쟁사 신제품/기술 shock
38. 공급망 차질·원가 상승 read-through
39. 고객 spend cut / end-market 둔화 read-through
40. valuation 부담 / multiple compression 기사
41. short report / thesis attack / skeptical commentary
42. positioning overcrowded / de-grossing / profit-taking explanation

#### residual but not meaningless
43. mixed-signal 기사 (호재·악재 혼재)
44. event-driven volatility explanation (earnings eve, lockup, rebalance 등)
45. single-line mention / media amplification / headline cascade

#### true meaningless residual
46. listicle / top stocks / watchlist roundup
47. generic portfolio advice / buy-now commentary
48. low-information recap / 홍보성 반복 기사

### taxonomy v2 초안 (실전 분류용 36개)
아래 36개는 넓게 읽은 후속기사 샘플을 바탕으로 **실제로 분류기에 반영할 수 있는 수준**으로 1차 압축한 구조다.

#### A. Direct Long (9)
1. 실적 호조·가이던스 상향
2. 애널리스트 상향·목표가 상향
3. 대형 계약·수주 확보
4. 전략적 파트너십·유통 제휴
5. 신제품 출시·상업화 진전
6. 수요 급증·백로그 확대
7. 승인·임상 호재
8. 자산 매각·전략가치 재평가·M&A 프리미엄
9. 주주환원 강화·자사주 매입

#### B. Direct Short (9)
10. 실적 부진·가이던스 하향
11. 애널리스트 하향·목표가 하향
12. 희석성 자금조달·reverse split 포함 생존형 금융공학
13. 규제·임상 악재
14. 소송·조사·회계 리스크
15. 구조조정·생존성 악화·상장유지 리스크
16. 핵심 계약 해지·고객 이탈
17. 제품 실패·리콜·출시 지연
18. 경영진 이탈·지배구조 충격

#### C. Indirect Long Read-through (8)
19. 정책·법안 수혜 read-through
20. 금리·거시 완화 수혜 read-through
21. 섹터 심리 회복·risk-on read-through
22. peer strong earnings / peer validation read-through
23. 공급망 완화·원가 하락 수혜
24. 경쟁사 약화에 따른 share-gain 기대
25. ecosystem / supplier / customer expansion 수혜
26. insider buy / ownership accumulation / positioning squeeze long

#### D. Indirect Short Read-through (8)
27. 정책·법안 역풍 read-through
28. 금리·거시 악화 read-through
29. 섹터 디레이팅·risk-off read-through
30. peer capex 확대 / 경쟁 심화 read-through
31. adjacent product / substitute threat read-through
32. 공급망 규제·원가 상승·소재 제약 read-through
33. customer spend cut / end-market 둔화 read-through
34. valuation 부담·multiple compression narrative

#### E. Information-Flow / Explanation Mechanics (5)
35. analyst mention / single-line note amplification
36. media amplification / top mover / headline cascade explanation
37. event-ahead speculation / breakout-failure / technical narrative
38. fund letter / portfolio rebalance / ownership-disclosure explanation
39. meme / retail-flow / squeeze / profit-taking explanation

#### F. True Residual / Low-Information (3)
40. listicle / top stocks / trending-stock roundup
41. generic portfolio advice / worth buying / hold-or-sell commentary
42. low-information recap / 홍보성 반복 / 사건 불명확 기사

### taxonomy v2 적용 원칙
- `A, B`는 **직접 사건 유형**이다. headline/lead만 읽어도 회사 내부 또는 회사에 직접 연결된 경제 사건이 보인다.
- `C, D`는 **간접 영향 read-through 유형**이다. 직접 공시는 아니지만 외부 사건이 현재 ticker의 가격 설명에 반복적으로 사용된다.
- `E`는 **정보 전달 메커니즘 자체가 가격 설명에 등장하는 유형**이다. analyst formal action과는 다르지만, note mention / top mover 기사 / ownership disclosure / squeeze narrative처럼 반복성이 있다.
- `F`만이 진짜 residual이다. 여기에는 사용자가 말한 `왜 올랐는가/왜 떨어졌는가` 설명력이 약한 기사만 남겨야 한다.

### 넓게 읽은 샘플에서 v2 taxonomy로 바로 매핑되는 대표 예시
- `Clarity Act Deal Could Ban Stablecoin Yields; Circle Leads Crypto Sell-Off`
  - 현재: `meaningless_others`
  - v2 후보: `27. 정책·법안 역풍 read-through`
- `Circle Internet Group Tumbles. Why the Clarity Act Is Crushing Crypto Stocks.`
  - 현재: `meaningless_others`
  - v2 후보: `27. 정책·법안 역풍 read-through`
- `SK Hynix Plans Big Investment Push. Why Micron Stock Is Dropping.`
  - 현재: `meaningless_others`
  - v2 후보: `30. peer capex 확대 / 경쟁 심화 read-through`
- `Why ServiceNow Stock Was Drifting Lower Today`
  - 현재: `macro_sector_readthrough`
  - v2 후보: `31. adjacent product / substitute threat read-through`
- `Corning Is Up 9%. Why It’s the Top Mover in the S&P 500.`
  - 현재: `meaningless_others`
  - v2 후보: `35. analyst mention / single-line note amplification` 또는 `36. media amplification / top mover explanation`
- `Why Grocery Outlet Stock Soared 11% Higher Today`
  - 현재: `macro_sector_readthrough`
  - v2 후보: `38. fund letter / ownership-disclosure explanation`과 인접, 또는 insider/flow 설명 축 추가 검토
- `Why Lucid (LCID) Stock Is Trading Lower Today`
  - 현재: `macro_sector_readthrough`
  - v2 후보: `12. 희석성 자금조달·reverse split 포함 생존형 금융공학` + `11. analyst 하향` 복합형

### taxonomy v2에서 추가 확인이 필요한 경계
- `formal analyst action`과 `analyst mention amplification`의 경계
- `macro_sector_readthrough`와 `policy/legislation read-through`의 경계
- `valuation narrative`와 `generic opinion commentary`의 경계
- `ownership/positioning explanation`과 `meme-flow explanation`의 경계
- `technical narrative`를 독립 유형으로 둘지, explanation mechanics 하위 subtype으로 둘지

### 제안하는 구현 순서(이유)
1. 먼저 실제 후속기사들을 더 읽고, direct / indirect / meaningless를 가르는 판별선을 분명히 해야 한다.
2. 그 다음 최소 30개 이상의 taxonomy 초안을 만든다.
3. explanation-style 기사만 따로 놓고 `진짜 low-information residual`과 `독립 승격 후보`를 먼저 분리한다.
4. 그 다음 각 case의 포함/제외 신호와 경계 사례를 작성한다.
5. 그 뒤에 그 taxonomy를 기존 analysis run과 evidence table에 어떻게 반영할지 결정한다.
6. 마지막에 재분류 구현과 page/evidence 갱신을 진행한다.

### 제안하는 구현 순서(이유)
1. 먼저 `분석`이 규칙 기반 자동 분류인지, agent 주도 taxonomy 설계인지 확정해야 한다.
2. 그 다음 company news용 case taxonomy와 evidence row schema를 정해야 한다.
3. 그 다음 page 본문과 evidence dataset을 생성해야 한다.
4. 그 뒤에 backend API를 만들어야 UI가 안정적으로 데이터를 받을 수 있다.
5. 마지막에 새 `evidence table` window를 붙여도 늦지 않다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⬜ Step 1 — company news Model 2 분석 방식 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 기존 `model2_case_analysis.py`가 현재 무엇을 자동으로 하는지, 무엇을 못 하는지 정리 | `ai_agent_plan/company_news_evidence_table/plan.md` | plan 문서에 규칙 기반 한계 명시 확인 | ⬜ |
| 1-2 | company news에 대해 agent 직접 분석이 필요한 범위와 자동화 가능한 범위를 분리 | `ai_agent_plan/company_news_evidence_table/plan.md` | plan 문서의 결정 섹션 확인 | ⬜ |
| 1-3 | 이번 작업의 1차 목표를 `company_news taxonomy + evidence row UI`로 고정 | `ai_agent_plan/company_news_evidence_table/plan.md` | 목표/비범위 섹션 확인 | ⬜ |

- `1-1` 목적: 기존 스크립트가 이미 무엇을 하는지 착각하지 않기 위함.
  설명: 현재 스크립트는 regex/rule 기반 자동 분류기이며, agent의 직접 해석과는 다르다는 점을 명시한다.
  완료 조건(눈으로 확인): plan에 “현재 스크립트는 규칙 기반” 문구가 있다.
  사람 검증(비개발자): 문서를 읽고 “지금은 AI가 직접 읽어 나누는 게 아니라 자동 룰이구나”를 알 수 있다.
  흔한 문제/주의: 기존 스크립트가 있으니 그대로 돌리면 된다고 오해하기 쉽다.
- `1-2` 목적: 이후 구현 범위를 과장하지 않기 위함.
  설명: taxonomy 설계는 agent/사용자 검토 중심, 반복 적용은 코드화 대상으로 분리한다.
  완료 조건(눈으로 확인): 결정 항목에 직접 분석 vs 자동 분류 구분이 적혀 있다.
  사람 검증(비개발자): 어떤 부분을 사람이 보고 확정하는지 문서에서 확인 가능하다.
  흔한 문제/주의: 이 구분이 없으면 “Model 2 지침대로 분석”과 “기존 규칙 스크립트 확장”이 뒤섞인다.
- `1-3` 목적: 1차 결과물을 명확히 한정하기 위함.
  설명: 이번 작업은 분석 note와 evidence table 기능을 연결하는 데 초점을 둔다.
  완료 조건(눈으로 확인): 목표와 제약에 1차 범위가 명확히 적혀 있다.
  사람 검증(비개발자): 지금 당장 뭘 만들고 뭘 안 만드는지 읽을 수 있다.
  흔한 문제/주의: score/keywords 같은 Model 3 영역까지 섞으면 범위가 커진다.

검증 훅:
```text
- plan.md의 현재 레포 상태 섹션에서 기존 model2 스크립트의 성격이 정확히 적혀 있는지 확인
- 결정/선행조건 섹션에서 직접 분석 vs 자동 분류 구분이 보이는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — company news용 taxonomy와 evidence row schema 설계
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | company news 전체를 어떤 source/source_type 범위로 볼지 확정 | `ai_agent_plan/company_news_evidence_table/plan.md` | 범위 정의 문구 확인 | ⬜ |

### 2026-03-26 taxonomy v3 실행 반영 결과
- 실제 반영 파일:
  - `ai_research_tool/test_model2_company_news_analysis.py`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/model2CaseDescriptions.ts`
- 실행 결과:
  - 새 analysis id: `2b5ab4d1-a1dd-4906-8226-e21d8bd41465`
  - page id `99a89607-d943-4a57-8a98-be8ba86f731b` 본문 갱신 완료
  - scope: `company_news_2025_plus_taxonomy_v3`
- 핵심 변화:
  - 기존 broad residual이던 `macro_sector_readthrough`를 유지하지 않고 `macro_market_commentary`, `policy_regulatory_*`, `peer_competition_negative`, `supply_chain_*`, `valuation_narrative_*`, `media_amplification_*` 등으로 분리
  - UI case description registry를 taxonomy v3 기준으로 교체하고, old run 조회를 위해 legacy key도 호환 유지
- 1차 집계 비교:
  - old run `meaningless_rows = 448,556`
  - new run `meaningless_rows = 371,983`
  - 즉 `76,573` row가 residual broad bucket 밖의 독립 case로 이동
- API 확인 결과:
  - `/api/model2/analyses`에서 새 run 노출 확인
  - `/api/model2/analyses/2b5ab4d1-a1dd-4906-8226-e21d8bd41465/cases`에서 새 case key와 한글 라벨 노출 확인

### 이번 단계 검증 결과
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `test_model2_company_news_analysis.py`, `model2CaseDescriptions.ts` 에러 0개 |
| 빌드 | ✅ | frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | 변경 대상에 전용 테스트가 없어 분류 스크립트 실실행으로 대체 검증 |
| 런타임 통합 | ✅ | taxonomy v3 스크립트 실행 완료 + page 저장 + backend API raw 응답 확인 |
| 2-2 | company news용 case_type, top_level(long/short/residual), evidence row 최소 컬럼 설계 | `ai_agent_plan/company_news_evidence_table/plan.md` | 컬럼 목록 확인 | ⬜ |
| 2-3 | summary 필드 정의를 고정 | `ai_agent_plan/company_news_evidence_table/plan.md` | summary가 body인지 full_text preview인지 명시 확인 | ⬜ |
| 2-4 | 유형 메뉴와 표 필터에 필요한 key 구조 정의 | `ai_agent_plan/company_news_evidence_table/plan.md` | `case_type`, `top_level`, `news_id` 관계 확인 | ⬜ |

- `2-1` 목적: 어떤 뉴스가 evidence table에 들어가는지 애매함을 없애기 위함.
  설명: `company_news` 전체를 쓸지, source 이름까지 제한할지 먼저 정한다.
  완료 조건(눈으로 확인): source/source_type 범위가 문장으로 고정돼 있다.
  사람 검증(비개발자): 어떤 뉴스가 대상이고 아닌지 읽으면 안다.
  흔한 문제/주의: `company_news`와 `news`를 섞으면 유형 의미가 흔들릴 수 있다.
- `2-2` 목적: UI와 backend가 같은 데이터 구조를 보게 하기 위함.
  설명: evidence table의 최소 컬럼과 정렬 가능한 컬럼을 함께 정한다.
  완료 조건(눈으로 확인): 컬럼 목록이 plan에 있다.
  사람 검증(비개발자): 표에 어떤 열이 보일지 알 수 있다.
  흔한 문제/주의: `publish`와 `published_at` 이름 혼용을 피해야 한다.
- `2-3` 목적: 사용자가 말한 summary가 무엇을 뜻하는지 모호함을 없애기 위함.
  설명: body 요약, full_text preview, 또는 별도 summary 계산 중 무엇을 쓸지 정한다.
  완료 조건(눈으로 확인): summary 생성 규칙이 적혀 있다.
  사람 검증(비개발자): 표에서 보게 될 summary가 무엇인지 이해 가능하다.
  흔한 문제/주의: source마다 body 길이/품질이 달라 summary 표시가 들쭉날쭉할 수 있다.
- `2-4` 목적: 유형 메뉴와 표가 같은 key로 연결되게 하기 위함.
  설명: 메뉴 선택값과 row의 `case_type` 필드를 일치시킨다.
  완료 조건(눈으로 확인): 필터 key 구조가 적혀 있다.
  사람 검증(비개발자): 메뉴에서 유형 선택 시 어떤 데이터가 보여야 하는지 이해 가능하다.
  흔한 문제/주의: label과 내부 key를 다르게 두면 API/UI 매핑이 꼬일 수 있다.

검증 훅:
```text
- plan.md에 evidence table 최소 컬럼이 명시되어 있는지 확인
- 유형 메뉴 key와 row key가 동일 구조로 설명돼 있는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — Model 2 결과 생성 및 research page 반영
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | company news 전수 데이터를 읽어 유형별 분류 결과를 만든다 | `ai_research_tool/model2_case_analysis.py` 또는 후속 구현 파일 | 생성 결과 샘플 확인 | ⬜ |
| 3-2 | 대상 page id 본문에 유형 설명과 분류 결과를 저장 | `terminal/backend/backend/data/app.db`의 `research_pages` | page body 조회 확인 | ⬜ |
| 3-3 | evidence table용 row dataset을 함께 생성 | 후속 구현 파일 또는 API용 저장 구조 | row 수/샘플 확인 | ⬜ |

- `3-1` 목적: 실제 company news 기반 Model 2 결과를 만든다.
  설명: 이 단계에서야 비로소 company news 전체를 유형별로 나눈다.
  완료 조건(눈으로 확인): 유형별 summary와 근거 row가 생성된다.
  사람 검증(비개발자): 대표 유형 몇 개와 샘플 뉴스가 정리돼 있음을 볼 수 있다.
  흔한 문제/주의: press_release용 규칙을 그대로 사용하면 company_news에서 오분류가 많아질 수 있다.
- `3-2` 목적: 사용자가 준 page id에 분석 결과를 실제로 저장한다.
  설명: 채팅 설명만이 아니라 page 본문이 업데이트되어야 한다.
  완료 조건(눈으로 확인): page body가 빈 값이 아니게 된다.
  사람 검증(비개발자): AI Research Window에서 해당 page 내용이 보인다.
  흔한 문제/주의: title은 유지하고 body만 갱신할지, title도 바꿀지 먼저 정해야 한다.
- `3-3` 목적: 이후 UI가 바로 읽을 수 있는 근거 데이터 집합을 만든다.
  설명: 유형 선택 시 표에 뿌릴 row 단위를 만든다.
  완료 조건(눈으로 확인): row 예시가 출력/저장된다.
  사람 검증(비개발자): 특정 유형을 선택하면 그 유형 뉴스 목록을 볼 수 있어야 한다.
  흔한 문제/주의: markdown 파일만 있으면 UI 정렬/검색이 불편해진다.

검증 훅:
```text
- research_pages.body가 page id 기준으로 업데이트됐는지 확인
- evidence row 샘플 10건에서 case_type, title, published_at, summary, ticker가 채워지는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — evidence table backend API 설계 및 구현
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | evidence table row 조회 endpoint 추가 | `terminal/backend/src/server.ts` | endpoint 응답 확인 | ⬜ |
| 4-2 | page id / case_type / keyword / ticker / sort 조건 처리 로직 추가 | `terminal/backend/src/services/*` 후속 파일 | 필터 응답 확인 | ⬜ |
| 4-3 | summary/title/published/source/change 필드를 UI 친화적으로 내려주도록 응답 shape 고정 | `terminal/backend/src/types.ts`, 후속 service 파일 | JSON shape 확인 | ⬜ |

- `4-1` 목적: UI가 근거 데이터를 정식 API로 읽게 하기 위함.
  설명: page id 기준 evidence rows를 반환하는 endpoint를 만든다.
  완료 조건(눈으로 확인): `/api/...` endpoint가 생긴다.
  사람 검증(비개발자): API 호출 시 JSON 목록이 나온다.
  흔한 문제/주의: research page 본문과 row dataset을 다른 key로 저장하면 lookup이 안 될 수 있다.
- `4-2` 목적: evidence table window의 검색/정렬/유형 메뉴를 backend에서 처리하기 위함.
  설명: `case_type`, `keyword`, `ticker`, `sortBy`, `sortDir` 등을 받는다.
  완료 조건(눈으로 확인): 필터 query params가 정의된다.
  사람 검증(비개발자): 특정 티커나 키워드를 넣었을 때 결과가 줄어드는지 보면 된다.
  흔한 문제/주의: 프론트 필터와 백엔드 필터 명칭을 다르게 두면 디버깅이 힘들다.
- `4-3` 목적: 프론트에서 추가 변환 없이 바로 표를 그리게 하기 위함.
  설명: published time, summary preview, source label 등을 정돈해서 내려준다.
  완료 조건(눈으로 확인): 응답 필드가 문서화돼 있다.
  사람 검증(비개발자): API 결과를 봤을 때 표 열과 대응됨을 알 수 있다.
  흔한 문제/주의: 긴 full_text를 그대로 내려주면 payload가 과해질 수 있다.

검증 훅:
```text
- page id 기준 evidence row API 응답 200 확인
- case_type, ticker, keyword 조합 필터가 각각 동작하는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — 새 `evidence table` window 구현
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | `WindowType`에 `evidence-table` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | 타입 빌드 확인 | ⬜ |
| 5-2 | `AddTabModal`, `App`, `DraggableWindow`에 새 window 연결 | 관련 3개 프론트 파일 | 새 창 메뉴 표시 확인 | ⬜ |
| 5-3 | `EvidenceTableWindow.tsx` 생성 | 새 컴포넌트 파일 | 컴포넌트 렌더링 확인 | ⬜ |
| 5-4 | 유형 메뉴, 표, 정렬, 키워드 검색, ticker 검색, summary/title/publish 컬럼 구현 | `EvidenceTableWindow.tsx` | UI 상호작용 확인 | ⬜ |
| 5-5 | 표 표현을 `FinnhubNewsWindow`와 유사한 스타일로 맞춤 | `EvidenceTableWindow.tsx` | 행/컬럼 스타일 확인 | ⬜ |
| 5-6 | 유형 메뉴 항목 우클릭 시 `description` 컨텍스트 메뉴 표시 | `EvidenceTableWindow.tsx` | 우클릭 메뉴 표시 확인 | ⬜ |
| 5-7 | `description` 버튼 클릭 시 `Case Description` 새 창에서 분류 기준 설명 표시 | `src/app/App.tsx`, `src/app/components/CaseDescriptionWindow.tsx`, `src/app/model2CaseDescriptions.ts` | 새 창 렌더링 확인 | ⬜ |

- `5-1` 목적: window 시스템에 새 타입을 정식 등록하기 위함.
  설명: 기존 `case-research`와 별도인 새 타입을 만든다.
  완료 조건(눈으로 확인): `evidence-table` 타입이 추가된다.
  사람 검증(비개발자): 새 창 이름이 시스템에 보인다.
  흔한 문제/주의: type만 추가하고 렌더 분기를 빼먹기 쉽다.
- `5-2` 목적: 사용자가 실제로 창을 열 수 있게 하기 위함.
  설명: Add Tab 목록과 기본 창 제목에 반영한다.
  완료 조건(눈으로 확인): `evidence table` 항목이 Add Tab에 보인다.
  사람 검증(비개발자): 체크해서 새 탭을 열 수 있다.
  흔한 문제/주의: title은 보이는데 컴포넌트 렌더가 빠지면 빈 창이 열린다.
- `5-3` 목적: evidence row 전용 표 창을 만든다.
  설명: page id와 filters를 갖는 독립 컴포넌트를 만든다.
  완료 조건(눈으로 확인): 새 컴포넌트 파일이 생긴다.
  사람 검증(비개발자): 창을 열었을 때 빈 박스가 아니라 표 구조가 보인다.
  흔한 문제/주의: page id를 어디서 받을지 명확히 해야 한다.
- `5-4` 목적: 사용자가 요청한 핵심 기능을 구현한다.
  설명: 유형 메뉴 선택, 정렬, 키워드 검색, ticker 검색, summary/title/publish 표시를 넣는다.
  완료 조건(눈으로 확인): 메뉴와 검색창과 표가 모두 있다.
  사람 검증(비개발자): 특정 유형 선택 후 검색하면 결과가 바뀐다.
  흔한 문제/주의: 정렬을 프론트/백 중 어디서 하는지 일관되게 정해야 한다.
- `5-5` 목적: 기존 뉴스 창과 사용감 차이를 줄이기 위함.
  설명: 표 컬럼 스타일, truncation, sortable header 등을 기존 뉴스 창 패턴에 맞춘다.
  완료 조건(눈으로 확인): 기존 news window와 비슷한 밀도와 상호작용을 가진다.
  사람 검증(비개발자): 새 창도 뉴스 창처럼 읽을 수 있다고 느낀다.
  흔한 문제/주의: 기존 창의 모든 기능을 복사하려 하면 범위가 과하게 커진다.
- `5-6` 목적: 사용자가 유형 메뉴 안에서 바로 분류 기준 설명에 접근하게 하기 위함.
  설명: native select 대신 custom case dropdown을 사용해 case item 우클릭 시 context menu를 연다.
  완료 조건(눈으로 확인): case 목록 항목을 우클릭하면 `description` 버튼이 보인다.
  사람 검증(비개발자): case를 오른쪽 클릭했을 때 작은 메뉴가 뜨는지 보면 된다.
  흔한 문제/주의: 브라우저 기본 context menu가 먼저 뜨면 custom 이벤트 처리 누락일 수 있다.
- `5-7` 목적: 분류 유형이 어떤 기준으로 나뉘는지 새 창에서 상세히 읽게 하기 위함.
  설명: `Case Description` 창은 `한 줄 정의`, `핵심 가치 경로`, `포함 신호`, `제외 신호`, `경계 사례`, `빠른 판별 질문`을 보여준다.
  완료 조건(눈으로 확인): description 버튼 클릭 후 새 창에 case 설명 섹션이 렌더링된다.
  사람 검증(비개발자): `잡것들`이나 `애널리스트 상향` 등을 눌렀을 때 설명 문구가 구체적으로 보이면 된다.
  흔한 문제/주의: case label은 바뀌는데 내부 설명이 기본값으로만 뜨면 mapping 누락일 수 있다.

검증 훅:
```text
- Add Tab에서 evidence table 선택 가능 여부 확인
- 새 창에서 유형 선택, 키워드 검색, ticker 검색, 정렬이 각각 동작하는지 확인
- case 메뉴 우클릭 -> description 버튼 -> Case Description 창 렌더링 확인
```
사용자 확인 필요: **예**

### PLAN CHANGE — 2026-03-26 21:10

- Step 5-6 / 5-7 보강:
  - 우클릭 context menu가 `description` 클릭 전에 닫히는 pointer-down 충돌을 수정한다.
  - `Case Description` 창에 `분류 기준`과 `분류 키워드` 섹션을 추가해, 어떤 keyword/signal을 기준으로 분류했는지 바로 읽을 수 있게 한다.
  - taxonomy registry key가 없는 경우에도 fallback 설명은 유지하되, 기본 분류 기준 문구는 포함/제외 신호에서 자동 생성한다.

### PLAN CHANGE — 2026-03-26 21:35

- 최종 목적 정렬:
  - `company_news` taxonomy를 headline/body 표면 분류기 수준에서 멈추지 않고, `title + body + full_text`를 함께 읽는 후속기사 분류기로 올린다.
  - rule set도 flat keyword 나열에서 `direct short -> indirect short -> direct long -> indirect long -> information-flow -> true residual` 순의 상위 그룹 구조로 재배치한다.
- residual 축소 방향:
  - `행사/appearance`와 `listicle/screener`를 `meaningless_others`에서 분리해 true residual을 더 투명하게 만든다.
  - `generic feature`는 buy/sell/hold, everyone is talking about 같은 decision-framework 기사만 남기고, 구체 원인이 읽히는 기사는 direct/indirect case로 먼저 보내도록 한다.
- 검증 목표:
  - 새 run에서 `meaningless_others` 비중이 더 줄어드는지 확인한다.
  - evidence table에서 새 residual case(`행사·인터뷰·홍보성 appearance`, `리스트형 screener·주간 요약 노이즈`)가 독립적으로 보이는지 확인한다.

### PLAN CHANGE — 2026-03-26 17:52

- publisher 선정 순서 보정:
  - taxonomy 확장 전에 `company_news` publisher 축부터 바로잡는다.
  - 실제 기사 출처가 `SEEKINGALPHA`, `BENZINGA`, `REUTERS`, `TIPRANKS` 등인데 `FINNHUB`로 남아 있는 legacy row를 우선 교정한다.
- 적용 규칙:
  - `origin_url`이 있으면 도메인 기준 publisher를 최우선으로 복원한다.
  - `origin_url`이 없는 wrapper row는 `title/body` 안의 명시적 출처 신호(`Seeking Alpha`, `Benzinga`, `(Reuters)` 등)로 publisher를 재분류한다.
  - 위 두 정보가 모두 없을 때만 기존 provider source/url domain fallback을 유지한다.
- 기대 효과:
  - evidence table과 taxonomy 분석에서 publisher 축 신뢰도를 먼저 회복한다.
  - residual 샘플 조사 시 실제 media/source 기준으로 묶음을 다시 볼 수 있다.

### PLAN CHANGE — 2026-03-26 18:02

- Yahoo branded 기사 보강:
  - `Yahoo Finance` 문자열 자체만으로는 타사 기사의 citation과 구분이 안 되므로, Yahoo branded show/transcript 패턴만 별도로 승격한다.
  - `Yahoo Finance Senior Reporter`, `Opening Bid`, `Market Minute`, `Good Buy or Goodbye` 같은 강한 신호가 있을 때만 `YAHOO`로 분류한다.
- 목적:
  - `according to Yahoo Finance` 같은 일반 인용문 오분류는 피하고, 실제 Yahoo 콘텐츠만 `FINNHUB -> YAHOO`로 교정한다.

### PLAN CHANGE — 2026-03-26 18:10

- 로딩 오류 대응:
  - `Evidence Table` 로딩 실패의 직접 원인은 `api/model2/analyses` 자체가 아니라 backend dev 서버 startup 실패였다.
  - 로그상 `SQLITE_BUSY: database is locked`가 발생해 backend가 listen 전에 종료되고, frontend는 proxy `ECONNREFUSED`를 연쇄적으로 내고 있었다.
- 변경:
  - SQLite open 직후 `journal_mode=WAL`, `busy_timeout=10000`을 적용해 일시적 잠금에 즉시 실패하지 않도록 보강한다.
- 기대 효과:
  - startup 시 publisher backfill 또는 다른 짧은 DB 접근과 겹쳐도 backend가 바로 죽지 않고 대기 후 정상 기동할 가능성을 높인다.

#### ⬜ Step 6 — 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | 정적 분석 확인 | 관련 변경 파일 전체 | `get_errors` | ⬜ |
| 6-2 | build 검증 | `terminal`, 프론트 workspace | `npm run build` | ⬜ |
| 6-3 | 자동 테스트 검증 | `terminal` | `npm run test` | ⬜ |
| 6-4 | 런타임 통합 검증 | backend dev + frontend dev | page/API/UI 실제 동작 확인 | ⬜ |

- `6-1` 목적: 타입/문법 오류를 제거한다.
  설명: 변경 파일 기준 문제 패널 0개를 목표로 한다.
  완료 조건(눈으로 확인): 에러가 없다.
  사람 검증(비개발자): Problems 패널에 새 오류가 없다.
  흔한 문제/주의: 새 window type 추가 후 switch branch 누락이 잦다.
- `6-2` 목적: 배포 가능한 상태인지 확인한다.
  설명: frontend/backend build가 모두 성공해야 한다.
  완료 조건(눈으로 확인): build 성공.
  사람 검증(비개발자): 빌드 성공 보고를 보면 된다.
  흔한 문제/주의: 프론트 타입과 API 응답 shape 불일치가 자주 난다.
- `6-3` 목적: 기존 기능 회귀를 확인한다.
  설명: 기존 테스트가 깨지지 않아야 한다.
  완료 조건(눈으로 확인): 테스트 통과.
  사람 검증(비개발자): 실패 테스트가 없다는 결과를 보면 된다.
  흔한 문제/주의: 기존 flaky test는 별도 구분 필요.
- `6-4` 목적: 사용자가 실제로 요구한 흐름이 닫히는지 확인한다.
  설명: page 저장, evidence API, 새 window, 검색/정렬/메뉴를 실제로 확인한다.
  완료 조건(눈으로 확인): page와 evidence window가 함께 동작한다.
  사람 검증(비개발자): AI Research Window와 evidence table window를 직접 열어보면 된다.
  흔한 문제/주의: page는 갱신됐는데 window가 옛 데이터를 보는 캐시 문제가 생길 수 있다.

검증 훅:
```text
- 대상 page id 본문 갱신 확인
- evidence API 응답 확인
- evidence table window에서 유형별 표 조회/정렬/검색 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 결정 ID: D1
   - 내용: company news 분석을 기존 rule-based script 확장으로 할지, agent 직접 taxonomy 설계를 우선할지
   - 선택지: `rule-based 우선` / `agent taxonomy 우선`
   - 차단 대상 Step: Step 3
2. 결정 ID: D2
   - 내용: evidence row를 어디에 저장/조회할지
   - 선택지: `동적 API 계산` / `별도 저장 구조 추가`
   - 차단 대상 Step: Step 4
3. 결정 ID: D3
   - 내용: summary 정의
   - 선택지: `body preview` / `full_text preview` / `별도 요약 생성`
   - 차단 대상 Step: Step 2, Step 5
4. 결정 ID: D4
   - 내용: page title을 유지할지 변경할지
   - 선택지: `현재 title 유지` / `company news model 2 evidence analysis 등으로 변경`
   - 차단 대상 Step: Step 3

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 후 완료` / `⏳ 구현 완료, 사용자 확인 대기` / `⬜ 미착수` / `🚫 차단`

```text
Track A — 분석 설계/산출물

⬜ Step 1 company news Model 2 분석 방식 확정
  ⬜ 1-1 기존 model2 script 성격/한계 정리
  ⬜ 1-2 직접 분석 vs 자동 분류 범위 분리
  ⬜ 1-3 1차 목표 고정
        |
        v
⬜ Step 2 taxonomy + evidence row schema 설계
  ⬜ 2-1 source/source_type 범위 확정
  ⬜ 2-2 case_type/top_level/컬럼 설계
  ⬜ 2-3 summary 정의 고정
  ⬜ 2-4 메뉴 key 구조 정의
        |
        v
🚫 Step 3 Model 2 결과 생성 및 page 반영
  ⬜ 3-1 company news 전수 분류 실행
  ⬜ 3-2 대상 page 본문 저장
  ⬜ 3-3 evidence row dataset 생성


Track B — 서비스/API/UI

🚫 Step 4 evidence backend API
  ⬜ 4-1 evidence row endpoint
  ⬜ 4-2 case_type/keyword/ticker/sort 필터
  ⬜ 4-3 UI 친화 응답 shape
        |
        v
🚫 Step 5 evidence table window
  ⬜ 5-1 WindowType 추가
  ⬜ 5-2 AddTab/App/DraggableWindow 연결
  ⬜ 5-3 EvidenceTableWindow 생성
  ⬜ 5-4 유형 메뉴/표/검색/정렬 구현
  ⬜ 5-5 NewsWindow와 유사한 표현 정리
        |
        v
⬜ Step 6 전체 검증
  ⬜ 6-1 정적 분석
  ⬜ 6-2 build
  ⬜ 6-3 test
  ⬜ 6-4 런타임 통합


==================== BLOCKED ====================
Step 3는 D1, D3, D4가 정리되어야 안정적으로 시작 가능
Step 4는 Step 3에서 evidence row shape가 정리되어야 안전하게 시작 가능
Step 5는 Step 4 API shape가 정리되어야 안전하게 시작 가능
=================================================
```

병렬 트랙 요약
- Track A는 분석 기준과 산출물을 정하는 축이다.
- Track B는 API와 UI를 붙이는 축이다.
- 실제 착수는 Track A가 선행되어야 하며, Track B는 Track A의 산출 schema가 확정된 뒤 병행 가능하다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | Step 3 | `rule-based 우선` / `agent taxonomy 우선` |
| D2 | Step 4 | `동적 API 계산` / `별도 저장 구조 추가` |
| D3 | Step 2, Step 5 | `body preview` / `full_text preview` / `별도 요약 생성` |
| D4 | Step 3 | `현재 title 유지` / `title 변경` |