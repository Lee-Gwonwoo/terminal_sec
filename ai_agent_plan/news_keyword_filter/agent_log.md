# News Window Keyword Exclude Filter Agent Log

## 2026-04-22
**작성 시각:** 05:28 (local)

### Plan 작성
- 상태: 확인 대기
- 생성 파일:
  - `ai_agent_plan/news_keyword_filter/plan.md`
  - `ai_agent_plan/news_keyword_filter/agent_log.md`
- 확인한 현재 구현 지점:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `searchQuery -> fetchNews() -> newsData -> groupedNews` 경로
  - 기존 `Save` / `Load`는 component state 기반이고 localStorage persistence 없음
- 이번 plan에서 고정한 방향:
  - 키워드 제외 필터는 검색창과 별도 기능으로 둔다.
  - 구현 범위는 `FinnhubNewsWindow` 1곳으로 제한한다.
  - 저장은 frontend localStorage 프로필 목록 + 현재 active profile 방식으로 잡는다.
  - query 문법은 공백 AND, `OR`, quoted phrase, 괄호 그룹을 1차 범위로 둔다.
- 사용자 확인이 필요한 포인트:
  - 대상 window를 Finnhub News window로 고정하는지
  - profile 수정 기능을 1차에 넣을지, 생성+삭제만 할지
  - item counter를 `visible / fetched` 형식으로 보여줄지
- 다음 단계:
  - 사용자가 Step 0을 확인하면 Step 1 parser/helper 구현으로 진행

**작성 시각:** 05:35 (local)

### Step 0 확인 완료 / 구현 시작
- 상태: 사용자 확인 후 완료
- 사용자 확인 내용:
  - 대상 window: Finnhub News window로 진행 승인
  - profile 범위: 수정 기능까지 포함 승인
  - counter 표시는 별도 추가 질문 없이 구현자가 자연스럽게 처리
- 계획 보정:
  - profile 범위를 `생성 + 수정 + 삭제 + 적용`으로 확장
  - counter는 `shown / fetched`와 active profile summary를 함께 보여주는 방향으로 고정
- 다음 구현 순서:
  - `src/app/newsKeywordFilter.ts` helper 추가
  - `FinnhubNewsWindow.tsx`에 profile state/localStorage/UI/filter 적용

**작성 시각:** 06:02 (local)

### Step 1 ~ Step 3 구현 / 1차 검증
- 상태: 확인 대기
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/newsKeywordFilter.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- 구현 내용:
  - query parser / evaluator / match text helper를 별도 파일로 분리
  - localStorage 기반 keyword filter profile state와 `activeProfileId` 추가
  - `Keyword Filter` 버튼, dropdown, create/edit modal, apply/clear/delete 흐름 추가
  - client-side exclude filter와 `shown / fetched`, active profile summary, `Hidden` count 표시 추가
- 정적/빌드 검증:
  - `get_errors` 대상: `newsKeywordFilter.ts`, `FinnhubNewsWindow.tsx`
  - 결과: 0 errors
  - `npm.cmd run build` (cwd: `termina_web/figma_code/terminal_ui_ver2_finhub`) 통과
- 브라우저 검증:
  - Add Tab Modal에서 `News Feed: Finnhub API` 창 실행
  - `Keyword Filter` menu open 확인
  - `offering 제외` / `offering biotech` 생성 + 적용 확인
  - `희석 또는 shelf 제외` / `offering OR shelf`로 수정 + 적용 확인
  - `Clear` 후 OFF 상태 확인
  - 저장된 profile 재적용 후 ON 상태 확인
  - active profile 삭제 시 active 해제 + 목록 제거 확인
  - `persist check` / `offering OR shelf` 생성 후 새로고침 시 active profile 복원 확인
  - 검증 후 테스트 profile 삭제로 cleanup 완료
- 남은 제한:
  - 해당 시점 live list가 계속 `0 items / Loading...`라서 실제 기사 row 감소량과 `shown / fetched` 숫자 변화는 브라우저에서 끝까지 확인하지 못함
- 리스크 및 완화 방안:
  - 리스크 1: 실제 populated row에서 `AND` / `OR` 제외 결과가 기대와 다를 수 있음
    완화: `7d Update` 또는 populated date range 조회 후 동일 profile로 row 감소량을 재확인
  - 리스크 2: 현재 로딩 상태가 길어 count 검증을 가림
    완화: backend `/api/news` 응답 상태와 job 상태를 먼저 확인해 loading 원인을 분리
  - 리스크 3: 자동화 환경에서 dropdown 버튼 클릭 안정성이 낮을 수 있음
    완화: 브라우저 수동 확인을 우선하고, 자동화는 direct DOM click fallback을 사용
- 사용자 확인 요청:
  - 현재 구현/동작 검증 결과를 기준으로 Step 1~3을 완료로 볼지 확인 필요

**작성 시각:** 06:02 (local)

### Step 4 문서 / 로그 동기화
- 상태: 확인 대기
- 변경 파일:
  - `ai_agent_plan/news_keyword_filter/plan.md`
  - `ai_agent_plan/news_keyword_filter/agent_log.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `terminal/backend_prompt.md`
- 반영 내용:
  - 프론트 문서에 `Keyword Filter` UI, localStorage key, query grammar, 서버 검색과의 분리를 추가
  - 백엔드 문서에 `GET /api/news`의 서버 검색과 프론트 client-side exclude filter 분리를 추가
  - plan / log에 현재 구현 진행 상태와 검증 한계를 기록
- 사용자 확인 요청:
  - 문서 동기화 수준이 충분한지 확인 필요

**작성 시각:** 06:24 (local)

### 추가 런타임 검증 / live data count 확인
- 상태: 확인 대기
- 검증 대상:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/newsKeywordFilter.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- 확인 내용:
  - broad `/api/news`는 느렸지만, `from=2026-04-21&to=2026-04-22&limit=5`를 붙인 narrow query는 빠르게 응답함
    - `/api/news`: `HTTP 200`, `TOTAL 0.026205`
    - `/api/model1/news`: `HTTP 200`, `TOTAL 0.014946`
  - 같은 프론트 parser/helper를 실 API 응답 5건에 직접 적용해 row 감소량을 검증함
    - query `"SEC/EDGAR" OR "conference call"` => `total 5 / hidden 3 / shown 2`
    - query `quality investing` => `total 5 / hidden 1 / shown 4`
- 관찰 메모:
  - 브라우저 자동화에서는 `From/To` 변경 중 넓은 요청이 abort된 뒤 `Loading...`이 남는 경로가 보였음
  - `fetchNews()`는 abort된 controller에서는 `setLoading(false)`를 건너뛰므로, 마지막 성공 요청이 즉시 이어지지 않으면 spinner가 남아 보일 수 있음
  - 현재 기능 작업 범위에서는 이 현상을 keyword filter 자체와 분리해서 기록함
- 리스크 및 완화 방안:
  - 리스크 1: 짧은 일반 단어(`sec` 등)는 substring match라 예상보다 넓게 걸릴 수 있음
    완화: phrase search(`"SEC/EDGAR"`)나 더 긴 토큰 사용을 문서/예시에서 우선 안내
  - 리스크 2: 브라우저 자동화에서 abort 후 loading state가 남아 populated list 검증을 가릴 수 있음
    완화: narrow date query를 먼저 고정하거나, 추후 별도 이슈로 fetch loading state를 분리 점검
  - 리스크 3: 현재 live count 검증은 API 응답 5건 기준 샘플 확인임
    완화: 사용자가 원하면 populated larger window로 수동 브라우저 확인을 한 번 더 진행
- 사용자 확인 요청:
  - 현재 추가 런타임 검증 결과를 기준으로 live data 기준 검증도 충분한지 확인 필요

**작성 시각:** 07:36 (local)

### 다중 active keyword filter 구현 / 브라우저 검증
- 상태: 확인 대기
- 변경 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `ai_agent_plan/news_keyword_filter/plan.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `terminal/backend_prompt.md`
  - `ai_agent_plan/news_keyword_filter/agent_log.md`
- 구현 내용:
  - 단일 `activeProfileId`를 다중 `activeProfileIds` 구조로 변경
  - legacy localStorage의 단일 active 값을 다중 배열로 migration
  - 저장 profile 여러 개를 동시에 active 가능하게 변경
  - active section, summary line, badge count, hidden count를 다중 active 기준으로 갱신
  - row 제외 규칙을 `활성 filter들 중 하나라도 match하면 hidden`으로 고정
- 정적/빌드 검증:
  - `get_errors` 대상: `FinnhubNewsWindow.tsx`
  - 결과: 0 errors
  - `npm.cmd run build` (cwd: `termina_web/figma_code/terminal_ui_ver2_finhub`) 통과
- 브라우저 검증:
  - `News Feed: Finnhub API` 창에서 `Keyword Filter` 메뉴를 열고 `sec-8k` / `8-K`, `sec-10q` / `10-Q` 두 profile을 순차적으로 생성 + 즉시 적용 확인
  - 첫 filter 적용 직후 `177 shown / 200 fetched`, `Hidden: 23`, 버튼 badge `1` 확인
  - 두 번째 filter 적용 직후 `175 shown / 200 fetched`, summary `Keyword Filter: sec-10q, sec-8k`, 버튼 badge `2`, `Hidden: 25` 확인
  - 메뉴 재오픈 시 `Active: 2 filters`, `sec-10q`, `sec-8k`, 각 항목의 `Remove / Edit / Delete`, 저장 목록의 `On` 상태 확인
  - 탭 전환 후 다시 `Tab 3`로 돌아왔을 때도 `Keyword Filter 2`와 summary `Keyword Filter: sec-10q, sec-8k`가 유지되는 것 확인
- 리스크 및 완화 방안:
  - 리스크 1: 브라우저 탭 전환 시 Finnhub 창이 다시 `0 items / Loading...` 상태로 보일 수 있음
    완화: 같은 탭에서 `Keyword Filter 2` badge와 summary 유지 여부로 persistence를 먼저 확인하고, 필요 시 `Refresh from DB`로 row list만 다시 채움
  - 리스크 2: 현재 브라우저 검증은 `8-K`, `10-Q`처럼 title token 기반 샘플 검증임
    완화: 사용자가 원하면 phrase / OR / 괄호 조합 filter로 한 번 더 populated 샘플 검증 진행
  - 리스크 3: background update job 진행 중에는 overlay/log 패널이 버튼 클릭을 가릴 수 있음
    완화: `View Log` 패널을 닫고 검증하거나, update job이 끝난 뒤 동일 시나리오를 재실행
- 사용자 확인 요청:
  - 현재 다중 active 동작과 검증 결과를 기준으로 이번 변경을 완료로 볼지 확인 필요