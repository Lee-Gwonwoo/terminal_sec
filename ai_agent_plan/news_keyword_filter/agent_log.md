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