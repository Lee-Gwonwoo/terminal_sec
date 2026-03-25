## 2026-03-25
**작성 시각:** 12:35 (local)

### 계획 초안 생성
- 새 plan 폴더 `ai_agent_plan/fmp_stock_news_ui/` 생성.
- 기존 `FMP PR` 구현(`server.ts`, `fmpPressReleaseProvider.ts`, `FinnhubNewsWindow.tsx`)을 기준으로 `FMP Stock News` 추가 계획을 문서화.
- FMP stable docs에서 stock news endpoint 존재 확인.
  - latest: `stable/news/stock-latest?page=0&limit=20`
  - search: `stable/news/stock?symbols=AAPL`
- 현재 상태: 계획 문서만 작성됨. 구현은 아직 시작하지 않음.
- 상태: 확인 대기(awaiting user confirmation)

## 2026-03-25
**작성 시각:** 13:10 (local)

### FMP Stock News 구현 + 검증
- 공용 `news_items` 구조를 유지한 채 새 source_type `fmp_stock_news`를 추가했다.
- backend에 신규 provider `terminal/backend/src/services/fmpStockNewsProvider.ts`를 추가했다.
  - endpoint: `stable/news/stock?symbols=...&page=...&limit=...`
  - mapper는 `title`, `text/content/snippet`, `publishedDate/publishedAt/date`, `symbol/symbols/ticker/tickers`, `url/link`, `publisher/site` 복수 후보 필드를 수용하도록 작성했다.
- backend `terminal/backend/src/server.ts`에 `POST /api/news/pull-fmp-stock-news` route를 추가했다.
  - recent/custom 둘 다 지원
  - `fmp_stock_news` anchor/confirmed-empty/update_status key를 독립 사용
  - 신규 insert row에 대해 change merge + inline fulltext extraction을 FMP PR 패턴으로 수행
- frontend `FinnhubNewsWindow.tsx`에 아래 항목을 추가했다.
  - source filter: `FMP Stock`
  - update menu: `Recent FMP Stock`, `Custom FMP Stock`
  - full text menu: `FMP Stock Only`
  - badge/short label/query param/payload branch 전체 연결
- 문서 동기화:
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `fmp_stock_news`와 새 pull/fulltext 흐름을 반영했다.

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 0 errors |
| 빌드 | ✅ | backend `npm run build` 성공, frontend `vite build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 13 files / 73 tests pass |
| 런타임 통합 | ✅ | `GET /api/news?source_names=FMP&source_type=fmp_stock_news&limit=1` 응답 확인, `POST /api/news/fulltext/update` with `fmp_stock_news` job 생성 확인, `POST /api/news/pull-fmp-stock-news` jobId 반환 + cancel 응답 확인, 브라우저 시각 확인은 사용자 위임 |

- 사용자가 직접 확인할 수 있는 검증 방법
  - backend route 확인
    - `Invoke-RestMethod http://localhost:8080/api/news?source_names=FMP&source_type=fmp_stock_news&limit=5`
  - fulltext route 확인
    - `Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/news/fulltext/update -ContentType 'application/json' -Body '{"sourceType":"fmp_stock_news","sourceName":"FMP","concurrency":1}'`
  - pull route 확인
    - `Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/news/pull-fmp-stock-news -ContentType 'application/json' -Body '{"mode":"recent","tickerConcurrency":1,"requestIntervalMs":25,"pageLimit":5,"maxPages":1}'`
  - UI 확인
    - News Window 상단 Source Filter에 `FMP Stock` 버튼이 보이는지 확인
    - Update 메뉴에 `Recent FMP Stock`, `Custom FMP Stock`이 보이는지 확인
    - Full Text 메뉴에 `FMP Stock Only`가 보이는지 확인

- 리스크 / 주의
  1. 현재 `news_items`의 중복 기준이 `UNIQUE (source, url)`라서, 동일 FMP URL이 `fmp_press_release`와 `fmp_stock_news`에 동시에 나타나면 한쪽 row가 skip될 수 있다.
  2. FMP stable stock news docs direct page가 현재 404라서 응답 필드 변경 가능성을 대비해 fallback mapper를 넓게 잡았다.
  3. 브라우저 시각 확인은 이번 로그 시점에 자동화하지 못했고, API 검증 + 코드 리뷰로 대체했다.

- 상태: 확인 대기(awaiting user confirmation)

## 2026-03-25
**작성 시각:** 13:12 (local)

### Data Control 문구 동기화
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - FMP concurrency / request interval 설명에 `FMP Stock News`를 추가했다.
  - `FMP PR Paging` 라벨을 `FMP PR / Stock Paging`으로 변경해 실제 shared setting과 맞췄다.
- 후속 검증
  - frontend `npm run build` 재실행 성공

- 상태: 확인 대기(awaiting user confirmation)