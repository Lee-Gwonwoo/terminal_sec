# Plan — terminal_ui_ver3_final

## KO

> ℹ️ 이 문서가 현재 작업 기준 문서이다.

### 목표
`terminal_ui_ver3_final`에서 아래 요구를 구현하기 위한 계획을 정의한다.

1. News Feed Window에 `Score` 컬럼을 추가한다.
2. News Feed Window에 `Score Evidence` 컬럼을 추가한다.
3. News Feed Window에 `Keywords` 컬럼을 실제 표시 가능한 컬럼으로 추가한다.
4. News feed 데이터를 runtime DB에 canonical 형태로 저장한다.
5. News feed 다운로드 시 Finnhub `news-sentiment`도 함께 수집하고, sentiment 결과를 컬럼 선택 목록에 추가한다.
6. `ai-news-analysis` 기준으로 `Score`, `Score Evidence`, `Keywords`를 생성/저장한다.
7. Terminal UI를 껐다 켜도 마지막 작업 상태(탭, 창, 배치, 선택 상태, 테마, 설정)를 복원한다.
8. 다른 탭으로 갔다가 다시 돌아와도 탭별 상태가 유지되게 한다.
9. Data Control Window 안에 `Settings` 탭을 추가하고, 전체 글자 크기를 조절 가능하게 한다.
10. Data Control Window `Settings`에서 News Feed title/summary 글자 크기를 각각 따로 조절 가능하게 한다.
11. 탭 바에서 탭 순서를 drag 해서 바꿀 수 있게 한다.
12. Finnhub recent 뉴스 pull에서 당일 제외 confirmed-empty 범위를 `source_type`별로 기록해 자동 재조회 낭비를 줄인다.
13. News Feed Window 일반 검색창 바로 아래에 ticker 전용 검색창을 추가해 ticker만 정확히 필터링할 수 있게 한다.
14. News Feed 검색 결과는 DB 전체를 server-side로 검색하되, 최초 500개 로드 후 cursor 기반으로 하단 스크롤 시 자동으로 500개씩 이어서 추가 로드되고, 동시에 리스트 하단에 `Load more` 버튼으로도 같은 추가 로드를 할 수 있게 한다.
15. News Feed 검색에 날짜 기간(`from`/`to`) 필터를 추가하고, 날짜가 비어 있으면 전체 기간 검색이 되게 한다.
16. `news_fulltext.full_text`는 HTML fragment가 아니라 plain text 본문만 canonical하게 저장하고, 기존 HTML 기반 row는 삭제 또는 재생성으로 정리한다.
17. News Feed에 크롬 북마크처럼 폴더형 북마크 구조를 추가하고, 북마크 폴더를 생성/선택할 수 있게 한다.
18. News row를 우클릭했을 때 `Add bookmark`를 표시하고, 이미 만든 북마크 폴더 중 어디에 저장할지 선택해서 저장할 수 있게 한다.
19. 검색창 근처에 `Bookmark view`를 두고, 북마크 폴더를 선택하면 그 폴더에 저장된 뉴스 row만 UI에 보이게 한다.

### 현재 레포 상태(중요, 확인됨)
- 백엔드 runtime DB는 `terminal/backend/backend/data/app.db` 이다.
- 백엔드에는 이미 `news_items`, `news_change_metrics`, `news_fulltext`, `update_status` 테이블이 존재한다.
- `GET /api/news`는 현재 `news_items`만 읽지 않고, `news_fulltext.keywords_json`과 `news_change_metrics`를 join해서 응답한다.
- `news_fulltext`에는 이미 `[][][]keywords_json[][][]`, `[][][]keywords_status[][][]`, `[][][]keywords_updated_at[][][]` 컬럼이 있다.
- `fulltextRepository.updateKeywords()`가 이미 존재하므로 keywords 저장 파이프라인의 일부는 구현되어 있다.
- 현재 full text extractor는 일부 도메인에서 기사 body HTML 조각을 `news_fulltext.full_text`에 그대로 저장하므로, plain text canonical 상태가 아니다.
- backend에는 `news_saved_views` 테이블과 `/api/news/saved-views` API가 이미 있으나, 이는 검색 조건 저장용 평면 리스트이고 뉴스 단건 북마크/폴더 트리 구조는 아니다.
- 현재 코드에는 `Score`, `Score Evidence`를 canonical하게 저장/조회하는 구조가 없다.
- `FinnhubNewsWindow.tsx`에는 `keywords` 컬럼 타입/렌더링 코드가 이미 있으나, `DEFAULT_COLUMNS`에 빠져 있어 기본 컬럼 세트/컬럼 선택 메뉴에서 실사용 상태가 아니다.
- 현재 `FinnhubNewsWindow.tsx`에는 `Score Evidence` 컬럼 정의가 없다.
- 현재 `FinnhubNewsWindow.tsx` 검색창은 backend `keyword` query만 사용하며, ticker 전용 입력창이나 `tickers` query를 보내는 UI는 없다.
- 현재 Finnhub News UI에는 검색용 날짜 기간 입력이 없고, `GET /api/news`의 `from`/`to` query를 검색 UX에 연결하지 않는다.
- 현재 Finnhub News 검색은 DB 전체를 server-side로 조회하지만, 한 번의 응답은 최대 200개로 제한되어 있고 프론트는 그 결과를 append 하지 않고 통째로 교체한다.
- backend `GET /api/news`는 `cursor`/`nextCursor` pagination 구조를 이미 갖고 있지만, 현재 Finnhub News UI는 이를 사용하지 않는다.
- `FinnhubNewsWindow.tsx`는 `finnhub-last-update-config`와 `finnhub-news-ui-state`를 사용해 update/search/filter/display/column 상태를 localStorage에 저장한다.
- 현재 `FinnhubNewsWindow.tsx`에는 source/url cell 우클릭 메뉴가 있으나 기능은 URL 복사 중심이며, 뉴스 row를 북마크 폴더에 넣는 메뉴는 없다.
- 현재 Finnhub News UI에는 검색창 근처의 `Bookmark view` 또는 북마크 폴더 선택 UI가 없다.
- `App.tsx`는 `terminal-workspace-v1`를 사용해 tabs, activeTabId, theme, linkedTicker, fontScale, News Feed title/summary font size를 저장/복원한다.
- `DataControlWindow.tsx`는 `Updates` / `Settings` 탭 구조와 전역 font scale, News Feed title/summary 글자 크기 제어 UI를 가진다.
- 탭 바는 drag/drop으로 순서를 재배치할 수 있다.
- 현재 Finnhub recent pull은 ticker별 기존 뉴스 anchor가 없으면 7일 fallback으로 다시 조회한다.
- 현재는 “이미 조회했지만 뉴스가 없었다”는 confirmed-empty 기록 저장소가 없어서, 뉴스가 한 번도 없던 ticker는 recent update 때 같은 구간을 반복 조회할 수 있다.
- `FinnhubNewsWindow.tsx`의 Recent Update 메뉴는 automatic recent retry 정책을 작은 보조 설명 문구로 항상 표시한다.
- Finnhub comprehensive probe 기록상 `news-sentiment` 엔드포인트는 접근 가능하다. 다만 현재 backend 수집/저장 흐름에는 아직 연결되어 있지 않다.
- 2026-03-07 실제 probe 결과 `news-sentiment?symbol=AAPL` 응답은 `buzz`, `companyNewsScore`, `sectorAverageBullishPercent`, `sectorAverageNewsScore`, `sentiment`, `symbol` top-level object이며, 기사 `id` 배열이나 기사별 sentiment row를 반환하지 않는다.
- AI 뉴스 분석 skills 지침 명칭은 `ai-news-analysis`로 고정한다.
- 현재 프론트 문서 기준으로 `Finnhub News`, `Default Ticker`, `Data Control`은 실제 API 연동이 있고, `Watchlist`, `Calendar`는 일부 mock/stub 흔적이 남아 있다.

### 제약 / 비범위
- 이번 plan은 구현 계획 문서 작성이 목적이다. 아직 코드 변경/테스트 실행을 전제로 하지 않는다.
- mock sentiment, mock score, 임의 점수 생성 로직은 추가하지 않는다.
- Finnhub가 주지 않는 값을 UI 편의를 위해 추정 숫자로 채우지 않는다.
- `Score`, `Score Evidence`, `Keywords`는 기본적으로 비워 둔다. AI 분석이 아직 실행되지 않은 row에 placeholder 값을 넣지 않는다.
- `Score`는 Finnhub raw sentiment가 아니라, `ai-news-analysis` 규칙으로 계산하는 AI 결과다.
- `Score Evidence` 또는 `Score`가 저장 후 직접 지워져도 통과해 버리는 구조를 허용하지 않는다. 삭제/유실 감지 테스트를 포함해야 한다.
- `analysis_status=completed`인 row에서 `score` 또는 `scoreEvidence`가 비면 테스트 실패로 본다.
- `analysis_status=completed`인 row에서 `keywords=[]`이면 최소 warning 대상으로 기록하고, stricter 삭제 감지 테스트에서는 실패로 승격할 수 있다.
- `analysis_status!=completed` row는 기본 빈 상태를 허용하며 삭제/유실 실패 대상으로 보지 않는다.
- Finnhub recent no-news 기록은 API 실패와 구분해야 한다. HTTP 200 + 실제 빈 배열일 때만 confirmed-empty로 기록한다.
- Finnhub recent no-news 기록은 `source_type`별로 분리한다. `company_news`와 `press_release`를 한 덩어리로 기록하지 않는다.
- 당일 범위는 보수적으로 취급한다. 자동 recent skip 대상은 당일 이전 confirmed-empty 범위까지만 허용한다.
- 자동 recent retry는 confirmed-empty 범위에 대해 영구 스킵하되, 수동 `custom range` 재조회 경로는 유지한다.
- `news_fulltext.full_text`에는 HTML 태그/스크립트 조각이 섞인 원문을 canonical로 남기지 않는다. 최종 저장값은 plain text 본문만 허용한다.
- 기존 HTML 기반 `news_fulltext` row는 새 정책 도입 시 그대로 방치하지 않는다. 삭제 후 재추출하거나, 동등한 결과의 재정제 backfill로 plain text 상태로 맞춘다.
- 북마크 기능은 검색 조건 저장용 `saved view`를 이름만 바꿔 재사용하는 방식으로 땜질하지 않는다. 뉴스 단건 북마크와 폴더 계층은 별도 canonical 구조로 설계한다.
- 전체 글자 크기 조절은 우선 `terminal_ui_ver3_final` 앱 범위의 UI scale/font scale을 뜻한다. OS 전체 폰트나 브라우저 줌 제어는 비범위다.
- 서버 재시작 후 background job 상태 복구까지 이번 범위에 포함할지 여부는 미확정 사항으로 둔다.

### 읽는 방법(비개발자/일반인 기준)
이 문서는 “무엇을 어디까지 바꿔야 하는지”를 단계별로 보여주는 작업 계획서다.

읽는 순서:
1. `목표`에서 최종적으로 보이게 될 기능을 본다.
2. `현재 레포 상태`에서 이미 있는 것과 없는 것을 구분한다.
3. `결정/선행조건`과 `미확정 사항`에서 먼저 정해야 하는 부분을 본다.
4. `단계별 계획`에서 각 Step의 작업, 파일, 검증 방법을 본다.

완료를 눈으로 확인하는 기준:
- News Feed 컬럼 메뉴에서 `Score`, `Score Evidence`, `Keywords`, `Sentiment`를 직접 on/off 할 수 있다.
- 앱을 닫았다 다시 열면 직전 탭/창 배치와 활성 탭이 복원된다.
- 탭 A에서 창을 이동해 두고 탭 B로 갔다가 다시 오면 탭 A 레이아웃이 그대로 남는다.
- Data Control Window 안에 `Settings` 탭이 생기고, 글자 크기 슬라이더나 preset을 바꾸면 전체 창에 반영된다.
- News Feed 일반 검색창 아래에 ticker 전용 검색창이 따로 보이고, ticker 입력 시 title/summary가 아니라 ticker 분류 기준으로만 결과가 줄어든다.
- News Feed는 검색 시 DB 전체를 대상으로 조건에 맞는 최신 결과를 가져오고, 최초 500개 이후에는 하단 스크롤 시 자동으로 500개씩 이어서 더 불러오며, 같은 위치에서 `Load more` 버튼으로도 수동 추가 로드가 가능하다.
- News Feed 검색에 날짜 From/To가 있고, 둘 다 비어 있으면 전체 기간 검색, 한쪽 또는 양쪽이 채워지면 해당 기간 안의 뉴스만 대상으로 검색된다.
- News row를 우클릭하면 `Add bookmark`가 뜨고, 원하는 북마크 폴더를 골라 저장할 수 있다.
- 검색창 근처의 `Bookmark view`를 누르면 폴더 목록이 보이고, 특정 폴더를 선택하면 그 폴더 안의 북마크 뉴스만 리스트에 보인다.
- 분석 전 뉴스 row는 `Score`, `Score Evidence`, `Keywords`가 비어 있고, 분석 후에만 채워진다.
- 테스트에서 `Score` 또는 `Score Evidence`가 지워진 경우 실패로 잡힌다.

용어(Glossary):
- `workspace state`: 앱 전체의 탭/창/활성 탭/테마/폰트 크기 같은 복원 대상 상태
- `tab state`: 특정 탭 안의 창 목록, 창 위치/크기, 탭 이름, 탭별 선택 상태
- `news sentiment`: Finnhub `news-sentiment` 응답에서 얻는 종목 단위 sentiment 데이터
- `score`: AI가 뉴스의 주가 영향 가능성을 평가해 매긴 `-10 ~ 10` 범위 점수
- `score evidence`: 왜 그 점수를 줬는지 설명하는 근거 텍스트
- `keywords`: AI가 뉴스에서 중요하다고 본 키워드 30개
- `canonical DB`: 앱이 실제로 조회하는 단일 source of truth 저장소. 현재 기본 후보는 `terminal/backend/backend/data/app.db`
- `confirmed-empty range`: 특정 ticker + `source_type` 조합에 대해 “당일 이전 구간은 정상 응답 200으로 확인했지만 뉴스가 없었다”고 확정된 자동 스킵 범위

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
plan 진행 중 요구가 바뀌면 아래 형식으로 리비전 노트를 추가한다.

```text
PLAN CHANGE (YYYY-MM-DD)
- 왜: <사유>
- 무엇이 바뀌었나: <추가/삭제/순서 변경>
- 영향: <범위/리스크/검증 영향>
```

각 Step 완료 시 채팅/로그 기준 템플릿:

```text
Step N — <제목>
- 변경 내용: <변경 파일/영역>
- 검증 방법: <정확한 명령어 또는 눈으로 볼 체크포인트>
- 문제점/리스크: <문제> → 완화 방안: (1) ... (2) ... (3) ...
- 사용자 확인 필요?: Yes
```

### PLAN CHANGE (2026-03-06)

### PLAN CHANGE (2026-03-06)
- 왜: 사용자가 News Feed title/summary 글자 크기 조절 위치를 Control Window `Settings` 탭으로 고정했고, 탭 순서 drag 이동도 추가로 요구했다.
- 무엇이 바뀌었나: Step 2의 Settings 범위를 전역 font scale + News Feed title/summary typography control까지 확장했고, Step 3의 persistence 범위에 두 typography 값과 탭 순서 저장을 반영했다.
- 영향: `App.tsx`, `DataControlWindow.tsx`, `DraggableWindow.tsx`, `FinnhubNewsWindow.tsx` 배선과 workspace payload 검증 항목이 함께 바뀐다.

### PLAN CHANGE (2026-03-06)
- 왜: 사용자가 Finnhub recent update에서 뉴스가 없던 ticker를 같은 7일 범위로 반복 조회하는 API 낭비를 막고, 영구 스킵 규칙과 예외 조건을 문서에 명시하길 요구했다.
- 무엇이 바뀌었나: 목표에 confirmed-empty range 기록을 추가했고, Step 0/1에 “API 실패와 빈 결과 구분, `source_type`별 분리, 당일 제외, 자동 recent 영구 스킵 + 수동 custom range 허용” 규칙을 반영했다.
- 영향: `finnhubNewsProvider.ts`, recent pull anchor/skip 저장 구조, backend prompt/spec, 테스트 시나리오가 함께 바뀐다.

### PLAN CHANGE (2026-03-06)
- 왜: Recent Update 정책 설명을 hover tooltip으로 두는 방식이 실제 사용에서 잘 보이지 않아, 사용자가 메뉴 내부 상시 노출 문구로 바꾸길 요청했다.
- 무엇이 바뀌었나: Recent Update 정책 안내를 info 아이콘 + hover tooltip에서 메뉴 본문 아래의 작은 보조 설명 문구로 변경했다.
- 영향: `FinnhubNewsWindow.tsx`의 메뉴 UX와 `figma_frontend_prompt.md`, 현재 레포 상태 문구가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 News Feed에서 일반 텍스트 검색과 ticker 검색을 분리하고, 일반 검색창 바로 아래에 ticker 전용 검색창을 두길 요청했다.
- 무엇이 바뀌었나: 목표에 ticker 전용 검색창을 추가했고, Step 2에 ticker-only 검색 UI 및 API wiring을 추가했으며, Step 3 persistence 범위에도 ticker 검색 상태 저장을 반영했다.
- 영향: `FinnhubNewsWindow.tsx` 검색 UX, `GET /api/news` query 조합(`keyword` vs `tickers`), localStorage payload 예시가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 현재 검색이 DB 전체 대상인지, 200개만 대상인지 구분을 명확히 적고, 검색 결과를 cursor 기반으로 500개씩 이어서 계속 볼 수 있게 하는 방향을 plan에 추가하길 요청했다.
- 무엇이 바뀌었나: 현재 검색 동작을 “DB 전체 server-side 검색 + 현재는 최대 200개 단건 반환”으로 명시했고, 목표/결정사항/Step 1/Step 2에 `cursor` 기반 500개 배치 append 로딩을 추가했다.
- 영향: `newsRepository.ts` limit 정책, `/api/news` 응답 계약(`nextCursor`), `FinnhubNewsWindow.tsx` 하단 스크롤 로딩 UX와 loading guard가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 날짜 기간을 지정해 그 기간 안에서만 검색하고, 날짜가 비어 있으면 전체 검색되도록 기본 동작을 명시하길 요청했다.
- 무엇이 바뀌었나: 목표에 검색용 날짜 필터를 추가했고, 현재 상태/결정사항/Step 2/Step 3에 `from`/`to` 기반 검색 UX와 빈 기본값 규칙을 반영했다.
- 영향: `FinnhubNewsWindow.tsx` 검색 바 구성, `/api/news` query 조합(`keyword`/`tickers`/`from`/`to`), localStorage의 검색 상태 payload가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 500개 cursor paging 방향을 “무한 스크롤만”이 아니라 하단 자동 로드와 `Load more` 버튼을 함께 제공하는 방식으로 확정하길 요청했다.
- 무엇이 바뀌었나: 검색 paging 방향을 “하단 자동 append + 하단 `Load more` 버튼 병행”으로 구체화했고, Step 2/검증 훅/리스크 문구를 두 동작을 모두 확인하는 기준으로 갱신했다.
- 영향: `FinnhubNewsWindow.tsx` 하단 sentinel 감지, 중복 로드 guard, `Load more` 버튼 노출/비활성화 규칙이 함께 정의된다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 현재 full text가 HTML 조각까지 섞여 저장되는 상태를 문제로 보고, 기존 값을 지운 뒤 plain text 본문만 canonical하게 저장하는 방향을 plan에 반영하길 요청했다.
- 무엇이 바뀌었나: 목표에 plain text canonical 저장을 추가했고, 현재 상태/제약/Step 1/결정 상세에 “extractor plain text 정규화 + 기존 `news_fulltext` row 삭제 또는 재생성” 계획을 반영했다.
- 영향: `fulltextExtractors.ts`, `fulltextUpdateService.ts`, `news_fulltext` 재처리 절차, keyword/AI analysis 입력 품질, 운영 검증 체크리스트가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 크롬 북마크처럼 폴더형 북마크를 만들고, 뉴스 row 우클릭 `Add bookmark`, 검색창 근처 `Bookmark view`, 폴더별 북마크 뉴스 조회 기능을 요구했다.
- 무엇이 바뀌었나: 목표에 북마크 폴더/단건 북마크/Bookmark view를 추가했고, 현재 상태/제약/결정사항/Step 1~3/결정 상세에 북마크 전용 데이터 모델과 UI 흐름을 반영했다.
- 영향: bookmark schema/API, `FinnhubNewsWindow.tsx` 우클릭 메뉴/Bookmark view UX, workspace persistence payload, backend/frontend prompt 문서가 함께 바뀐다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 Track A 권장안을 그대로 확정하라고 요청했고, 실제 Finnhub `news-sentiment` probe 결과도 함께 확인했다.
- 무엇이 바뀌었나: AI 분석 실행 시점, sentiment 저장 단위, AI analysis 저장 위치, 북마크 데이터 모델을 사용자 확정 상태로 승격했고, `news-sentiment`를 기사별이 아닌 symbol-level snapshot으로 문서에 명시했다.
- 영향: Step 0의 일부 차단이 해소되고, Step 1 schema/API 설계가 `news_sentiment_snapshots`, `news_ai_analysis`, `bookmark_folders`, `bookmark_items` 기준으로 고정된다.

### PLAN CHANGE (2026-03-07)
- 왜: 사용자가 삭제/유실 감지 테스트 기준을 `analysis_status=completed` 예외 규칙까지 포함해 구체적으로 확정했다.
- 무엇이 바뀌었나: Step 0-5, Step 1-6, Step 4 검증 기준과 차단 상태를 status 기반 규칙으로 갱신했다.
- 영향: Track A 차단이 해소되고, backend 삭제 감지 테스트와 운영 로그 정책을 같은 기준으로 맞출 수 있다.

권장 저장 구조:
- 뉴스 원본 메타: `[][][]news_items[][][]`
- 뉴스 full text / keywords: `[][][]news_fulltext[][][]`
- 뉴스 sentiment: 별도 `[][][]news_sentiment_snapshots[][][]` 테이블 권장
- AI analysis result: `[][][]news_ai_analysis[][][]` 같은 별도 테이블 권장 (`score`, `score_evidence`, `keywords_json`, `analysis_status`, `analyzed_at`)
- 앱 상태: 1차는 프론트 `localStorage`, 2차 확장 시 backend saved view/API로 승격 가능

### 결정/선행조건(초기에 확정 필요)
1. AI 분석 실행 시점
   - 선택지 A: 뉴스 pull 직후 자동 enqueue
   - 선택지 B: 별도 `AI Analysis Update` job으로 수동 실행
   - 선택지 C: full text 추출 성공한 row만 후속 배치 실행
   - 사용자 확정: C. plain text canonical로 정리된 full text 추출 성공 row만 후속 batch 대상으로 본다.

2. sentiment 저장 위치
   - 선택지 A: `news_items` 직접 컬럼 추가
   - 선택지 B: `news_id` 또는 `(ticker, asof_date)` 기준 별도 테이블
   - 사용자 확정: B 중에서도 `(ticker, asof_date)` 기준 `news_sentiment_snapshots` 별도 테이블로 고정한다. 2026-03-07 probe 결과 `news-sentiment`는 기사별 row가 아니라 symbol-level aggregate object이므로 `news_id` 1:1 매핑을 전제하지 않는다.

3. AI analysis 저장 위치
   - 선택지 A: `news_fulltext` 확장
   - 선택지 B: `news_ai_analysis` 별도 테이블
   - 사용자 확정: B. `Score`/`Score Evidence`/`Keywords`는 `news_ai_analysis` 별도 테이블에 저장한다.

4. workspace persistence 저장소
   - 선택지 A: 프론트 `localStorage`만 사용
   - 선택지 B: backend DB에도 저장해 브라우저/기기 간 동기화까지 고려
   - 현재 권장: A. 이번 범위에서 가장 빠르고 리스크가 낮다.

5. 탭 상태 기억 범위
   - 선택지 A: 창 배치와 활성 탭만 저장
   - 선택지 B: 창 내부 필터/컬럼/검색어까지 저장
   - 현재 권장: B. 사용자가 말한 “마지막 상태”에 더 가깝다.

6. Finnhub recent no-news 재조회 정책
   - 선택지 A: 기존처럼 anchor가 없는 ticker는 매번 7일 fallback 반복
   - 선택지 B: `source_type`별 confirmed-empty range를 저장하고 automatic recent retry에서는 영구 스킵
   - 현재 권장: B. 다만 당일은 제외하고, 수동 `custom range` 재조회는 계속 허용한다.

7. News Feed 검색 입력 분리 방식
   - 선택지 A: 기존 단일 검색창을 유지하고 검색 문법(`ticker:ASTS`)으로만 분리
   - 선택지 B: 일반 검색창 + ticker 전용 검색창을 별도 입력으로 분리
   - 현재 권장: B. 사용자가 원하는 동작이 더 직접적이고, 일반 텍스트 검색과 ticker-only 검색의 의미를 UI에서 명확히 구분할 수 있다.

8. News Feed 검색 결과 paging 방식
   - 선택지 A: 현재처럼 검색 시 최대 200개만 단건 반환
   - 선택지 B: 최초 500개 로드 후 `nextCursor` 기반으로 하단 스크롤 시 자동 append + 하단 `Load more` 버튼 병행
   - 현재 권장: B. 검색 대상은 DB 전체로 유지하되, 자동 로드가 실패하거나 사용자가 더 명시적으로 제어하고 싶을 때를 위해 버튼 fallback도 함께 제공한다.

9. News Feed 날짜 기간 검색 방식
   - 선택지 A: 날짜 필터 없이 항상 전체 기간 검색
   - 선택지 B: `from`/`to` 입력을 두되, 기본값은 비워 두고 비어 있으면 전체 검색, 값이 있으면 기간 검색
   - 현재 권장: B. 기본 사용성은 유지하면서 필요할 때만 기간을 좁힐 수 있어야 한다.

10. 북마크 데이터 모델
   - 선택지 A: 기존 `news_saved_views`를 북마크 용도로 확장
   - 선택지 B: 북마크 폴더/북마크 아이템을 별도 테이블로 분리
   - 사용자 확정: B. saved view는 검색 조건 저장으로 유지하고, 북마크는 `bookmark_folders` + `bookmark_items` 별도 구조로 분리한다.

11. 북마크 폴더 계층 방식
   - 선택지 A: 1단계 폴더만 허용
   - 선택지 B: `parent_id` 기반 트리로 크롬 북마크처럼 중첩 허용
   - 현재 권장: B. 사용자가 “북마크 폴더 같은 것”을 원하므로 트리 구조를 먼저 열어 두는 편이 안전하다.

12. Bookmark view 동작 방식
   - 선택지 A: 기존 검색 결과 위에 북마크 필터만 얹기
   - 선택지 B: 선택된 폴더 기준 북마크 전용 결과 모드로 전환
   - 현재 권장: B. 사용자가 “그 북마크 폴더 안에 북마크된 뉴스 데이터들이 보이게”를 원하므로 폴더 선택 시 명확한 북마크 전용 view가 맞다.

### 계획 중간 필수 확인
중간 구현 전에 반드시 아래를 확인한다.

1. Finnhub `news-sentiment` 응답 필드 단위 확인 완료
   - 2026-03-07 실제 probe 결과, `news-sentiment`는 기사 배열이 아니라 `symbol` 기준 object 응답이다.
   - 확인된 top-level key: `buzz`, `companyNewsScore`, `sectorAverageBullishPercent`, `sectorAverageNewsScore`, `sentiment`, `symbol`
   - 따라서 동일 뉴스 row에 `news_id` 1:1로 직접 매핑하지 않고, `(ticker, asof_date)` 기준 snapshot으로 저장한다.

2. `ai-news-analysis` 결과 저장 형태 확인 완료
   - `Score`, `Score Evidence`, `Keywords`는 `news_id` 기준 `news_ai_analysis` 별도 테이블에 저장한다.
   - 기본 빈 상태와 분석 완료 상태를 구분하는 status 필드는 Step 1 설계 시 포함한다.

3. workspace state 직렬화 범위 확인
   - 창 내부 상태를 어디까지 저장할지 명시
   - localStorage key versioning 필요 여부 확인

4. 삭제/유실 테스트 범위 확인 완료
   - `analysis_status=completed` row에서 `score` 또는 `scoreEvidence`가 비면 실패로 본다.
   - `analysis_status=completed` row에서 `keywords=[]`는 최소 warning 대상으로 기록하고, stricter 삭제 감지 테스트에서는 실패로 승격할 수 있다.
   - `analysis_status!=completed` row는 기본 빈 상태를 허용하고 삭제/유실 실패 대상으로 보지 않는다.

5. Finnhub confirmed-empty 기록 조건 확인
   - HTTP 200 + 실제 빈 배열일 때만 기록하는지
   - `company_news`, `press_release`를 분리 저장하는지
   - 당일 이전 범위만 자동 skip 대상으로 확정하는지

6. News Feed 검색 paging contract 확인
   - 검색은 이미 로드된 클라이언트 500개가 아니라 DB 전체를 대상으로 유지하는지
   - 첫 페이지 500개, 다음 페이지도 500개 append로 고정할지
   - 정렬/필터 변경 시 cursor와 누적 목록을 초기화하는지
   - 하단 자동 로드와 `Load more` 버튼이 같은 `nextCursor` 계약을 공유하는지

7. News Feed 날짜 검색 contract 확인
   - `from`/`to`가 모두 비어 있으면 DB 전체 기간 검색으로 남는지
   - `from` 또는 `to`가 채워지면 해당 경계 조건으로 검색 범위가 줄어드는지
   - 날짜 조건이 바뀌면 cursor와 누적 결과를 초기화하는지

8. Full text plain text contract 확인
   - `news_fulltext.full_text`에 HTML tag/script/style 조각이 남지 않도록 저장 규칙을 고정하는지
   - 기존 HTML 기반 row를 삭제 후 재추출할지, 동일 결과 보장의 backfill로 교체할지 실행 절차를 문서화하는지
   - keyword/AI analysis는 plain text로 정리된 row만 입력으로 쓰는지 확인하는지

9. 북마크 contract 확인
   - 북마크 폴더와 북마크 아이템의 canonical 저장소를 별도 테이블로 둘지 확정하는지
   - 뉴스 row 우클릭 시 `Add bookmark` 메뉴가 뜨고, 폴더 선택 다이얼로그 또는 서브메뉴 흐름을 어떤 방식으로 둘지 고정하는지
   - `Bookmark view`에서 폴더 선택 시 해당 폴더에 속한 뉴스 row 집합만 보여주는지 확인하는지
   - 같은 news_id를 같은 폴더에 중복 저장할 때의 정책을 정하는지

### 제안하는 구현 순서(이유)
1. Step 0에서 `Score`/sentiment 매핑과 저장 모델을 먼저 고정한다.
   - 이유: 이 결정이 DB/API/UI 전체를 바꾼다.
2. Step 1에서 backend DB/API와 AI analysis 저장 구조를 먼저 맞춘다.
   - 이유: 프론트 컬럼 추가보다 데이터 contract가 선행되어야 한다.
3. Step 2에서 News Feed 컬럼, ticker 전용 검색 UX, 500개 cursor 자동 append + `Load more` 버튼, Data Control Settings UI를 붙인다.
   - 이유: backend 응답이 확정된 뒤 UI wiring이 단순해진다.
4. Step 3에서 workspace persistence를 구현한다.
   - 이유: 앱 셸과 각 창 상태 저장을 한 번에 묶어야 중복 수정이 줄어든다.
5. Step 4에서 AI analysis 테스트, 삭제 감지 테스트, 문서 동기화를 한다.

추가 선행 작업:
- Step 1 안에서 full text canonical 형식을 먼저 plain text로 고정하고, 기존 HTML 기반 row를 정리한 뒤 keyword/AI analysis 후속 단계를 진행한다.
- 북마크 기능은 Step 1에서 폴더/아이템 데이터 모델을 먼저 고정한 뒤 Step 2에서 우클릭 메뉴와 Bookmark view를 붙인다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ✅ Step 0 — 요구 해석과 데이터 계약 확정

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | Finnhub `news-sentiment` 응답 구조를 확인하고 symbol-level snapshot 저장으로 확정 | ✅ |
| 0-2 | `ai-news-analysis` 기준으로 `Score(-10~10)`, `Score Evidence`, `Keywords(30개)` 정의를 문서에 고정 | ✅ |
| 0-3 | sentiment와 AI analysis 저장 위치를 `app.db` 내 별도 테이블 기준으로 확정 | ✅ |
| 0-4 | workspace persistence 범위를 권장범위로 확정한다 | ✅ |
| 0-5 | `Score`/`Score Evidence`/`Keywords` 삭제·유실 감지 테스트 요구를 status 기반 규칙으로 고정 | ✅ |
| 0-6 | Finnhub recent confirmed-empty 기록 규칙(실패 구분, `source_type` 분리, 당일 제외, custom range 예외)을 고정 | ✅ |

0-1 목적: sentiment가 뉴스 기사와 1:1인지, ticker snapshot인지 확인한다.
0-1 설명: 2026-03-07 실제 probe 결과 `news-sentiment`는 기사 배열이 아니라 symbol-level aggregate object이므로 `(ticker, asof_date)` snapshot으로 저장하기로 확정했다.
0-1 완료 조건(눈으로 확인): 문서에 `buzz`, `companyNewsScore`, `sentiment`, `symbol` 같은 실제 응답 key와 저장 key 규칙이 함께 적혀 있다.
0-1 사람 검증(비개발자): 문서만 봐도 “기사 한 건에 붙는 값”이 아니라 “종목 시점 요약값”이라는 점을 이해할 수 있다.
0-1 흔한 문제/주의: ticker-day aggregate를 기사 score처럼 오해하면 잘못 저장된다.

0-2 목적: AI 뉴스 분석 출력 계약을 UI/DB 모두에서 한 가지로 통일한다.
0-2 설명: `Score`, `Score Evidence`, `Keywords`가 각각 무엇을 뜻하는지 고정한다.
0-2 완료 조건(눈으로 확인): 문서에 `Score=-10~10`, `Score Evidence=근거 텍스트`, `Keywords=중요 단어 30개`가 명시된다.
0-2 사람 검증(비개발자): “왜 이 점수인지”, “키워드는 몇 개인지”를 문서만 보고 바로 알 수 있다.
0-2 흔한 문제/주의: sentiment와 AI score를 같은 값으로 오해하면 컬럼 의미가 붕괴한다.

0-3 목적: sentiment와 AI analysis의 canonical 저장소를 고정한다.
0-3 설명: sentiment는 `news_sentiment_snapshots`, AI 결과는 `news_ai_analysis`, 북마크는 `bookmark_folders` + `bookmark_items`로 분리해 runtime 조회 대상이 `app.db` 하나로 수렴되게 한다.
0-3 완료 조건(눈으로 확인): 테이블 이름/주요 컬럼/PK가 plan에 나온다.
0-3 사람 검증(비개발자): 어느 DB 파일을 보면 되는지 하나만 확인하면 된다.
0-3 흔한 문제/주의: `news_items`에 직접 붙이면 migration 부담이 커질 수 있다.

0-4 목적: “마지막 상태 기억” 범위를 애매하지 않게 만든다.
0-4 설명: 저장/복원 대상 state를 권장범위로 목록화하고 고정한다.
0-4 완료 조건(눈으로 확인): localStorage payload 예시가 문서에 적힌다.
0-4 사람 검증(비개발자): 앱 종료 후 어떤 것이 복원되는지 목록으로 확인 가능하다.
0-4 흔한 문제/주의: 너무 많이 저장하면 schema drift가 자주 난다.

0-4 확정 범위(사용자 확인 완료):
- 저장 대상: 탭 목록, 마지막 활성 탭, 창 위치/크기/제목/linkId, 다크모드, 전체 글자 크기
- 창 내부 상태: News Feed 컬럼 on/off, source filter, 검색어, display mode, Data Control의 active tab
- 비저장 대상: 순간적인 modal open 상태, 일회성 loading 상태, 임시 hover/selection UI

0-5 목적: 분석 결과 유실을 놓치지 않게 한다.
0-5 설명: `analysis_status=completed` row에서 `score` 또는 `scoreEvidence`가 비면 실패, `keywords=[]`는 최소 warning(필요 시 stricter 실패)으로 보고, `analysis_status!=completed` row는 예외로 두는 테스트 기준을 고정한다.
0-5 완료 조건(눈으로 확인): 삭제 감지 테스트 시나리오에 completed row와 non-completed row의 성공/실패 기준이 함께 적혀 있다.
0-5 사람 검증(비개발자): 분석 완료 뉴스에서 점수나 근거를 지우면 실패지만, 아직 분석 전 뉴스가 빈 값인 것은 실패가 아니라는 점을 이해할 수 있다.
0-5 흔한 문제/주의: null 기본값과 저장 후 유실 상태를 같은 것으로 취급하면 안 된다.

0-6 목적: 뉴스가 없는 ticker를 같은 기간으로 반복 조회하는 낭비를 막되, 실패 응답을 잘못된 empty로 저장하지 않게 한다.
0-6 설명: automatic recent retry에는 confirmed-empty range 영구 스킵을 적용하고, 수동 `custom range`는 예외로 남긴다.
0-6 완료 조건(눈으로 확인): 문서에 “HTTP 200 + 빈 배열만 기록”, “`source_type`별 분리”, “당일 제외”, “custom range 허용”이 함께 적혀 있다.
0-6 사람 검증(비개발자): 이미 뉴스가 없다고 확인된 ticker가 다음 recent update에서 또 같은 과거 범위를 긁지 않는다는 설명을 문서만 보고 이해할 수 있다.
0-6 흔한 문제/주의: timeout/429/5xx를 empty로 착각해 영구 스킵하면 실제 뉴스를 영영 놓칠 수 있다.

검증 훅:
```text
- Finnhub sentiment sample 응답을 문서에 정리
- `ai-news-analysis` 출력 계약을 예시 2개와 함께 문서에 기재
- persistence 저장 범위를 체크리스트로 확정
- 삭제 감지 테스트 시나리오를 문서에 기재
- Finnhub confirmed-empty 기록 규칙을 예시 2개와 함께 문서에 기재

사용자 확인 필요: 예
```

#### ⬜ Step 1 — Backend schema / repository / API 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | sentiment 저장 구조와 AI analysis 저장 구조 migration 추가 | `terminal/backend/src/db.ts` | 서버 시작 후 테이블 생성 확인 | ✅ |
| 1-2 | Finnhub sentiment fetch + retry + mapping 로직 추가 | `terminal/backend/src/services/finnhubNewsProvider.ts` | sentiment fetch probe 통과 | ✅ |
| 1-3 | `ai-news-analysis` 결과 저장/retrieve repository 추가 | `terminal/backend/src/services/aiAnalysisRepository.ts` | TypeScript build 통과 | ✅ |
| 1-4 | `GET /api/news` 응답에 score/scoreEvidence/sentiment/keywords 계약 반영 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/server.ts`, `terminal/backend/src/types.ts` | `/api/news` JSON 필드 확인 | ✅ |
| 1-5 | AI analysis 미실행 row는 기본 빈 상태로 내려가도록 null/empty 규칙 고정 | 같은 영역 | API 응답 null/empty 확인 | ✅ |
| 1-6 | 분석 결과 유실 감지용 backend 테스트 추가 | `terminal/backend/tests/aiAnalysisRepository.test.ts` | 테스트 실패/성공 확인 | ✅ |
| 1-7 | Finnhub recent confirmed-empty range 저장/skip 로직 추가 | `terminal/backend/src/services/finnhubNewsProvider.ts`, `terminal/backend/src/db.ts`, `terminal/backend/src/server.ts` | repeated recent pull 비교 확인 | ✅ |
| 1-8 | `GET /api/news` 검색 paging 정책을 500개 배치 + `nextCursor` append 계약으로 고정 | `terminal/backend/src/services/newsRepository.ts` | 첫 페이지/다음 페이지 cursor 응답 확인 | ✅ |
| 1-9 | `GET /api/news` 검색 contract에 `from`/`to` 기간 조건과 빈 기본값(전체 검색) 규칙을 명시 | `terminal/backend/src/services/newsRepository.ts` | 날짜 조건별 API 응답 확인 | ✅ |
| 1-10 | full text extractor를 HTML fragment 저장에서 plain text canonical 저장으로 변경 | `terminal/backend/src/services/fulltextExtractors.ts` | extractor 결과 샘플 확인 | ✅ |
| 1-11 | 기존 HTML 기반 `news_fulltext` row를 삭제 또는 재생성해 plain text로 backfill | `terminal/backend/src/services/fulltextUpdateService.ts`, `terminal/backend/src/server.ts` (`POST /api/news/fulltext/backfill-plaintext`) | 재추출 후 DB 샘플 확인 | ✅ |
| 1-12 | 북마크 폴더/북마크 아이템 schema 및 repository/API 추가 | `terminal/backend/src/db.ts`, `terminal/backend/src/server.ts` | 폴더 생성/북마크 추가 API 확인 | ✅ |
| 1-13 | 북마크 폴더 선택 기준 북마크 뉴스 조회 API 추가 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/server.ts`, `terminal/backend/src/types.ts` | 폴더별 뉴스 응답 확인 | ✅ |

1-1 목적: runtime DB가 sentiment와 AI analysis 결과를 영속 저장할 수 있게 만든다.
1-1 설명: 테이블 생성과 기존 DB migration을 안전하게 처리한다.
1-1 완료 조건(눈으로 확인): `app.db`에 새 테이블/컬럼이 보인다.
1-1 사람 검증(비개발자): DB 점검 스크립트 출력에서 새 이름이 보인다.
1-1 흔한 문제/주의: 기존 `news_items`와 중복 저장 구조를 만들지 않도록 주의한다.

1-2 목적: Finnhub sentiment 데이터를 실제로 가져오게 한다.
1-2 설명: 재시도/백오프 규칙을 지키고, rate limit 실패를 로그에 남긴다.
1-2 완료 조건(눈으로 확인): pull job 로그에 sentiment fetch 단계가 보인다.
1-2 사람 검증(비개발자): 같은 티커 뉴스를 업데이트한 뒤 sentiment 값이 비어 있지 않다.
1-2 흔한 문제/주의: 기사 단위 매핑이 불가능하면 ticker/date snapshot 방식으로 우회해야 한다.

1-3 목적: `Score`, `Score Evidence`, `Keywords`를 AI enrichment 계층으로 분리 저장한다.
1-3 설명: `news_id` 기준 upsert와 분석 상태를 분명히 한다.
1-3 완료 조건(눈으로 확인): repository 함수 이름과 PK 기준이 문서/코드에 있다.
1-3 사람 검증(비개발자): 같은 분석을 두 번 돌려도 row가 무한히 늘지 않는다.
1-3 흔한 문제/주의: `Keywords`를 30개 배열 대신 자유문으로 저장하면 UI 계약이 흔들린다.

1-4 목적: 프론트가 필요한 필드를 한 번에 받을 수 있게 한다.
1-4 설명: null 허용 규칙과 컬럼명을 고정한다.
1-4 완료 조건(눈으로 확인): API 응답 예시에 `score`, `scoreEvidence`, `sentiment`, `keywords`가 보인다.
1-4 사람 검증(비개발자): 브라우저 network 응답에서 새 필드가 보인다.
1-4 흔한 문제/주의: 이름을 바꾸면 프론트 매핑이 바로 깨진다.

1-5 목적: 분석 전 상태와 분석 후 상태를 명확히 분리한다.
1-5 설명: 기본값은 빈 상태이고, 분석 완료 후에만 값이 채워진다.
1-5 완료 조건(눈으로 확인): 미분석 row는 비어 있고, 분석 row만 값이 있다.
1-5 사람 검증(비개발자): 같은 목록에서 어떤 row는 비어 있고 어떤 row는 채워져도 이상하지 않다.
1-5 흔한 문제/주의: 빈 기본값과 데이터 유실을 동일하게 취급하면 안 된다.

1-6 목적: 값이 직접 지워지는 문제를 테스트에서 잡는다.
1-6 설명: `analysis_status=completed` row에서 `score`/`score_evidence` 삭제 시 실패하고, `keywords=[]`는 최소 warning 또는 stricter 실패로 잡히는 테스트를 넣는다.
1-6 완료 조건(눈으로 확인): 관련 테스트가 red/green으로 동작한다.
1-6 사람 검증(비개발자): 값을 지우면 테스트 실패 메시지가 나온다.
1-6 흔한 문제/주의: 정상적인 미분석 row까지 실패시키면 운영이 불편해진다.

1-7 목적: 뉴스가 한 번도 없던 ticker가 같은 과거 7일 구간을 반복 조회하지 않게 만든다.
1-7 설명: `source_type`별 confirmed-empty range를 저장하고, automatic recent retry에서는 당일 이전 확정 구간을 영구 스킵한다.
1-7 완료 조건(눈으로 확인): 같은 ticker로 recent update를 연속 실행해도 confirmed-empty 과거 구간 재조회 로그가 줄어든다.
1-7 사람 검증(비개발자): 뉴스가 없던 ticker는 다시 recent를 눌렀을 때 “이미 빈 구간으로 확인됨”에 해당하는 스킵 효과가 보인다.
1-7 흔한 문제/주의: HTTP 실패를 empty로 잘못 저장하거나 `company_news`와 `press_release`를 합쳐 저장하면 실제 데이터가 있는 소스까지 막을 수 있다.

1-8 목적: 검색 결과를 200개 고정이 아니라 500개 단위 cursor pagination으로 이어서 볼 수 있게 만든다.
1-8 설명: 첫 요청은 최신 500개를 주고, 이후 요청은 `nextCursor`로 다음 500개를 반환하도록 하며, 하단 자동 로드와 `Load more` 버튼이 같은 cursor 계약을 사용하게 고정한다.
1-8 완료 조건(눈으로 확인): `/api/news` 첫 응답에 `items<=500`과 `nextCursor`가 보이고, 다음 cursor 요청에서 이어지는 다음 500개가 반환된다.
1-8 사람 검증(비개발자): 첫 500개 아래의 더 오래된 결과를 같은 검색 상태에서 계속 이어서 볼 수 있다.
1-8 흔한 문제/주의: 정렬/검색 조건이 바뀌었는데 이전 cursor를 재사용하면 중복/누락이 생길 수 있다.

1-9 목적: 날짜 기간 검색이 전체 검색의 기본 동작을 깨지 않으면서 선택적으로만 범위를 좁히게 만든다.
1-9 설명: `from`/`to`를 안 보내면 전체 기간 검색, 하나 이상 보내면 해당 경계로 검색 범위를 제한하는 API 계약을 문서와 코드에 고정한다.
1-9 완료 조건(눈으로 확인): 날짜를 비우면 전체 결과가 나오고, 날짜를 넣으면 그 기간 안의 결과만 나온다.
1-9 사람 검증(비개발자): 같은 검색어라도 날짜를 좁히면 결과 수가 줄고, 날짜를 지우면 다시 전체 기간 결과로 돌아온다.
1-9 흔한 문제/주의: UI에서 날짜를 지웠는데 이전 `from`/`to`가 계속 남아 있으면 사용자는 전체 검색이라고 생각해도 실제로는 기간 필터가 남아 버린다.

1-10 목적: `news_fulltext.full_text`를 HTML 조각이 아닌 plain text canonical 본문으로 고정한다.
1-10 설명: extractor에서 article body를 찾은 뒤 태그 제거, 불필요한 노드 제거, 줄바꿈/공백 정규화를 거쳐 텍스트만 저장하도록 바꾼다.
1-10 완료 조건(눈으로 확인): 새로 추출된 `full_text` 샘플에 `<div>`, `<p>`, `<script>` 같은 태그가 남아 있지 않다.
1-10 사람 검증(비개발자): DB나 API에서 본문을 봤을 때 웹페이지 코드가 아니라 읽을 수 있는 문장만 보인다.
1-10 흔한 문제/주의: 태그만 지우고 문단 경계를 잃으면 문장이 한 줄로 뭉개질 수 있고, 반대로 script/style 제거가 빠지면 코드 조각이 다시 섞일 수 있다.

1-11 목적: 이미 저장된 HTML 기반 `news_fulltext`를 plain text 상태로 정리해 old/new 데이터가 섞이지 않게 한다.
1-11 설명: 기존 row를 삭제 후 재추출하거나, 동등한 plain text 결과를 보장하는 재정제 backfill을 수행한다. 최종 목표는 canonical DB에 HTML 기반 row가 남지 않는 것이다.
1-11 완료 조건(눈으로 확인): 기존 문제 row를 다시 조회했을 때 plain text만 남고 HTML 태그가 사라진다.
1-11 사람 검증(비개발자): 예전에는 코드처럼 보이던 뉴스 본문이 재처리 후 일반 문장으로만 보인다.
1-11 흔한 문제/주의: 기존 row를 그대로 둔 채 새 정책만 적용하면 old row와 new row 포맷이 섞여 keyword/AI analysis 품질이 불안정해질 수 있다.

1-12 목적: 북마크 기능의 canonical 저장 구조를 고정한다.
1-12 설명: `bookmark_folders`, `bookmark_items` 같은 별도 테이블과 CRUD API를 추가해 폴더 생성, 폴더 트리 조회, 뉴스 북마크 추가/삭제를 지원한다.
1-12 완료 조건(눈으로 확인): 북마크 폴더 생성 API와 `Add bookmark` API가 존재하고 DB에 row가 생긴다.
1-12 사람 검증(비개발자): 폴더를 하나 만들고 뉴스 하나를 넣었을 때 DB 점검이나 API 응답에서 둘 다 보인다.
1-12 흔한 문제/주의: saved view 테이블에 억지로 합치면 검색 조건 저장과 뉴스 단건 저장이 섞여 나중에 UI 의미가 붕괴할 수 있다.

1-13 목적: 선택한 북마크 폴더 안의 뉴스만 다시 보여줄 수 있게 한다.
1-13 설명: 폴더 id를 받아 그 폴더에 속한 news_id 집합을 최신 정렬로 조회하는 API를 만들고, 필요하면 하위 폴더 포함 여부도 옵션으로 둔다.
1-13 완료 조건(눈으로 확인): 특정 폴더 id로 요청했을 때 그 폴더에 북마크된 뉴스 row만 반환된다.
1-13 사람 검증(비개발자): 폴더 A와 폴더 B에 다른 뉴스를 넣어 두고 조회하면 서로 다른 목록이 나온다.
1-13 흔한 문제/주의: 폴더 선택 이후에도 기존 검색 cursor를 재사용하면 북마크 모드와 일반 검색 결과가 섞일 수 있다.

검증 훅:
```bash
cd terminal/backend
npm run build
node test_check_news_db.mjs
```

```text
추가 확인:
- GET /api/news?source_names=FINNHUB&limit=5 응답에 score/scoreEvidence/sentiment/keywords 포함 여부 확인
- GET /api/news 검색 응답이 첫 페이지 최대 500개 + `nextCursor`를 반환하는지 확인
- 같은 검색 조건으로 cursor 후속 호출 시 다음 500개가 이어지는지 확인
- 자동 하단 로드와 `Load more` 버튼이 같은 다음 페이지를 중복 없이 가져오는지 확인
- 날짜 비움 상태에서 전체 기간 검색이 되는지 확인
- 날짜 지정 상태에서 해당 기간 뉴스만 반환되는지 확인
- AI analysis 저장 테이블 row count 확인
- 저장 후 `score_evidence`를 지웠을 때 테스트가 실패하는지 확인
- 동일 ticker에 대해 recent update를 두 번 실행했을 때 confirmed-empty 과거 구간 재조회가 줄어드는지 확인
- 새로 추출한 `news_fulltext.full_text` 샘플에 HTML tag/script/style 조각이 남지 않는지 확인
- 기존 HTML 기반 row를 삭제 또는 재생성한 뒤 같은 news_id 샘플이 plain text로 바뀌었는지 확인
- 북마크 폴더 생성 API로 폴더를 만든 뒤 뉴스 row를 해당 폴더에 추가할 수 있는지 확인
- 폴더별 북마크 뉴스 조회 API가 같은 폴더 내 뉴스만 반환하는지 확인

사용자 확인 필요: 예
```

#### ⏳ Step 2 — News Feed / Data Control UI 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | News Feed 컬럼 정의에 `Score`, `Score Evidence`, `Keywords`, `Sentiment`를 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | UI 컬럼 메뉴 확인 | ✅ |
| 2-2 | `Keywords`를 30개 기준 default/선택 컬럼 동작으로 정상 연결 | 같은 파일 | 컬럼 토글 및 렌더 확인 | ✅ |
| 2-3 | score/score evidence/sentiment 셀 렌더, 정렬, null 표시 규칙 추가 | 같은 파일 | 정렬/표시 확인 | ✅ |
| 2-4 | Data Control Window에 `Updates` / `Settings` 탭 구조 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | 탭 전환 확인 | ✅ |
| 2-5 | Settings 탭에 전체 글자 크기 조절 UI 추가 | 같은 파일 및 app shell styling | 슬라이더/프리셋 반영 확인 | ✅ |
| 2-6 | 일반 검색창 바로 아래에 ticker 전용 검색창을 추가하고 `tickers` query로만 동작하도록 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | ticker-only 검색 결과 확인 | ✅ |
| 2-7 | 검색 결과를 최초 500개 로드 후 하단 스크롤 시 자동으로 `nextCursor` 500개 append 하고, 동시에 하단 `Load more` 버튼으로도 같은 추가 로드를 가능하게 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 자동 로드/버튼 로드 확인 | ✅ |
| 2-8 | 검색창 영역에 날짜 From/To 입력을 추가하고 비어 있으면 전체 검색, 값이 있으면 기간 검색으로 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 날짜 조건 검색 확인 | ✅ |
| 2-9 | 검색창 근처에 `Bookmark view` UI와 북마크 폴더 선택 메뉴 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 폴더 선택 UI 확인 | ✅ |
| 2-10 | News row 우클릭 메뉴에 `Add bookmark`와 폴더 선택 흐름 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 우클릭 북마크 저장 확인 | ✅ |
| 2-11 | 선택한 북마크 폴더 안의 뉴스만 리스트에 표시하는 bookmark mode 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 북마크 폴더별 결과 확인 | ✅ |

2-1 목적: 사용자가 필요한 4개 컬럼을 실제로 보이게 만든다.
2-1 설명: 단순 타입 선언이 아니라 메뉴/헤더/행 렌더까지 연결한다.
2-1 완료 조건(눈으로 확인): Columns 메뉴에 새 4개 항목이 모두 나온다.
2-1 사람 검증(비개발자): 체크박스로 끄고 켤 수 있다.
2-1 흔한 문제/주의: 타입만 있고 `DEFAULT_COLUMNS`에 빠지면 다시 반쪽 구현이 된다.

2-2 목적: 기존 keywords 파이프라인을 UI에 완성한다.
2-2 설명: AI 분석 결과로 내려오는 30개 키워드를 실제 컬럼으로 사용한다.
2-2 완료 조건(눈으로 확인): keyword chip 또는 placeholder가 행마다 보인다.
2-2 사람 검증(비개발자): keywords가 있는 뉴스와 없는 뉴스의 차이가 보인다.
2-2 흔한 문제/주의: 30개 목표인데 잘린 수와 전체 수를 UI에서 구분 못 하면 혼동된다.

2-3 목적: score/score evidence/sentiment를 읽기 쉬운 형태로 표시한다.
2-3 설명: 숫자 포맷, 색상, tooltip, 정렬키, evidence 말줄임 규칙을 정한다.
2-3 완료 조건(눈으로 확인): score 열 정렬이 기대대로 동작한다.
2-3 사람 검증(비개발자): 높은 score가 위로, null은 아래로 정렬되고 evidence가 보인다.
2-3 흔한 문제/주의: 문자열 정렬로 처리하면 숫자 순서가 깨진다.

2-4 목적: Data Control을 운영용 탭과 환경설정 탭으로 분리한다.
2-4 설명: 기존 update 섹션은 `Updates` 탭으로 유지하고 새 `Settings` 탭을 추가한다.
2-4 완료 조건(눈으로 확인): Data Control 상단에 탭이 보인다.
2-4 사람 검증(비개발자): Updates와 Settings를 번갈아 눌러도 내용이 유지된다.
2-4 흔한 문제/주의: active tab 상태를 저장하지 않으면 다시 열 때 기본 탭으로만 돌아간다.

2-5 목적: 전역 글자 크기 조절을 UI에서 제어한다.
2-5 설명: CSS variable 기반 font scale을 앱 전체에 적용한다.
2-5 완료 조건(눈으로 확인): 슬라이더를 움직이면 여러 창의 글자가 함께 커지거나 작아진다.
2-5 사람 검증(비개발자): News/Data Control/Tab bar 텍스트가 같이 바뀐다.
2-5 흔한 문제/주의: 일부 컴포넌트가 px 고정이면 전체 일관성이 깨진다.

2-6 목적: 일반 텍스트 검색과 ticker-only 검색을 UI에서 분리해 오해 없는 검색 동작을 만든다.
2-6 설명: 첫 번째 입력창은 기존 `keyword` 검색(title/summary 계열), 두 번째 입력창은 `tickers` query만 보내는 전용 검색으로 분리한다.
2-6 완료 조건(눈으로 확인): 일반 검색창 아래에 ticker 입력창이 보이고, ASTS 입력 시 ticker 분류가 ASTS인 행만 남는다.
2-6 사람 검증(비개발자): title에 ASTS가 없어도 ticker가 ASTS면 나오고, title에 ASTS가 있어도 ticker가 다르면 ticker 전용 검색에서는 제외된다.
2-6 흔한 문제/주의: 두 검색창 값을 모두 `keyword`로 보내면 분리 UI를 만들어도 실제 동작은 그대로라 의미가 없다.

2-7 목적: 검색 결과가 500개에서 끊기지 않고 같은 리스트 아래로 자연스럽게 이어지게 만들되, 자동 로드 실패 시에도 사용자가 수동으로 계속 볼 수 있게 한다.
2-7 설명: 초기 검색 시 첫 500개를 로드하고, 리스트 하단 접근 시 `nextCursor`를 사용해 자동으로 다음 500개를 append 한다. 동시에 리스트 하단에 `Load more` 버튼을 두어 같은 cursor 기반 추가 로드를 수동으로도 실행할 수 있게 한다.
2-7 완료 조건(눈으로 확인): 검색 후 리스트 하단까지 내리면 자동 로딩 뒤 뉴스가 더 이어 붙고, 같은 위치에 `Load more` 버튼도 보여 수동 로드가 가능하다.
2-7 사람 검증(비개발자): 자동으로 더 불러오지 못하는 상황이어도 버튼을 눌러 다음 500개를 계속 볼 수 있다.
2-7 흔한 문제/주의: 하단 도달 이벤트와 버튼 클릭이 동시에 발생하면 같은 페이지를 중복 append 할 수 있으므로 loading guard와 cursor 소비 잠금이 필요하다.

2-8 목적: 사용자가 특정 날짜 기간 안의 뉴스만 좁혀서 검색할 수 있게 만든다.
2-8 설명: 검색 바에 `From`/`To` 입력을 두고, 기본값은 둘 다 비워 둔다. 둘 다 비어 있으면 전체 검색, 하나 이상 값이 있으면 해당 기간 조건으로 `from`/`to` query를 보낸다.
2-8 완료 조건(눈으로 확인): 날짜 입력이 비어 있으면 전체 검색 상태이고, 날짜를 지정하면 그 기간 뉴스만 표시된다.
2-8 사람 검증(비개발자): 검색어는 그대로 둔 채 날짜만 바꿔도 결과 기간이 달라지고, 날짜를 지우면 다시 전체 기간 결과가 나온다.
2-8 흔한 문제/주의: 날짜만 바뀌어도 기존 cursor 누적 목록을 유지하면 이전 기간 결과와 섞일 수 있으므로 결과를 초기화해야 한다.

2-9 목적: 검색/필터 근처에서 북마크 폴더를 빠르게 고를 수 있게 한다.
2-9 설명: 검색창 근처에 `Bookmark view` 버튼 또는 드롭다운을 두고, 북마크 폴더 트리를 선택할 수 있게 한다.
2-9 완료 조건(눈으로 확인): 검색창 근처에 `Bookmark view`가 보이고, 누르면 북마크 폴더 목록이 열린다.
2-9 사람 검증(비개발자): 폴더를 몇 개 만들어 두면 메뉴에서 각 폴더 이름을 직접 고를 수 있다.
2-9 흔한 문제/주의: 폴더가 많아질 때 단순 평면 리스트만 보여주면 크롬 북마크 같은 구조라는 요구와 어긋날 수 있다.

2-10 목적: 뉴스 리스트에서 곧바로 북마크할 수 있게 한다.
2-10 설명: row 우클릭 시 `Add bookmark`를 띄우고, 클릭하면 기존 북마크 폴더 목록 중 어디에 저장할지 선택하게 한다.
2-10 완료 조건(눈으로 확인): 뉴스 row 우클릭 메뉴에 `Add bookmark`가 보이고, 폴더 선택 뒤 저장된다.
2-10 사람 검증(비개발자): 뉴스 하나를 우클릭해 폴더를 고르면 그 뉴스가 북마크 폴더에 들어간다.
2-10 흔한 문제/주의: 현재 URL 복사 메뉴와 북마크 메뉴가 충돌하지 않도록 row 기준 메뉴와 source/url cell 기준 메뉴를 분리할 필요가 있다.

2-11 목적: 선택한 북마크 폴더를 뉴스 뷰 자체로 볼 수 있게 한다.
2-11 설명: `Bookmark view`에서 폴더를 선택하면 일반 검색 결과 대신 해당 폴더에 저장된 뉴스 데이터 집합을 같은 리스트 UI에 렌더한다.
2-11 완료 조건(눈으로 확인): 폴더를 바꾸면 리스트가 그 폴더 뉴스로 교체되고, 폴더마다 다른 결과가 나온다.
2-11 사람 검증(비개발자): 폴더 A에 넣은 뉴스는 폴더 A에서만 보이고, 폴더 B에 넣은 뉴스는 폴더 B에서만 보인다.
2-11 흔한 문제/주의: bookmark mode와 일반 search mode의 상태를 분리하지 않으면 사용자가 일반 검색으로 돌아왔을 때 이전 검색 조건이 사라지거나 섞일 수 있다.

검증 훅:
```bash
cd termina_web/figma_code/terminal_ui_ver2_finhub
npm run build
```

```text
추가 확인:
- News Feed 컬럼 메뉴에서 Score/Score Evidence/Keywords/Sentiment 토글 가능
- 일반 검색창 아래에 ticker 전용 검색창 표시
- ticker 입력 시 ticker-only 필터가 동작하고 일반 keyword 검색과 결과 차이가 구분되는지 확인
- 검색 직후 첫 결과가 최대 500개인지 확인
- 하단 스크롤 시 다음 500개가 자동 append 되고 기존 목록이 유지되는지 확인
- 리스트 하단의 `Load more` 버튼으로도 다음 500개가 추가 로드되는지 확인
- 날짜 From/To가 비어 있을 때 전체 기간 검색이 되는지 확인
- 날짜 기간 지정 시 해당 기간 안의 결과만 검색되는지 확인
- 검색창 근처에 `Bookmark view`가 보이고 폴더 선택이 가능한지 확인
- 뉴스 row 우클릭 시 `Add bookmark`가 보이고, 폴더 선택 후 북마크 저장이 되는지 확인
- 특정 북마크 폴더 선택 시 그 폴더 안 뉴스만 표시되는지 확인
- Data Control에서 Settings 탭 표시
- 글자 크기 변경 시 앱 전반 반영
- 미분석 row는 빈 상태로 표시되는지 확인

사용자 확인 필요: 예
```

#### ⏳ Step 3 — Workspace state persistence 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 앱 셸의 tabs/activeTab/theme/linkedTicker 저장 구조 설계 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx` | 새 localStorage payload 확인 | ⏳ |
| 3-2 | 창 배치(position/size/title/type/linkId) 저장/복원 구현 | `App.tsx`, `DraggableWindow.tsx` 관련 파일 | 재실행 후 복원 확인 | ⏳ |
| 3-3 | 탭 전환 후 탭별 window state 유지 확인 및 보강 | `App.tsx` 및 창 컴포넌트 state wiring | 탭 왕복 테스트 | ⏳ |
| 3-4 | 창별 중요 UI state(컬럼/필터/검색/active Settings tab) 저장 범위 반영 | `FinnhubNewsWindow.tsx`, `DataControlWindow.tsx` 등 | 창 재오픈 후 상태 복원 확인 | ⏳ |
| 3-5 | storage versioning / fallback reset 로직 추가 | app shell 공용 유틸 | 깨진 payload 복구 확인 | ⏳ |
| 3-6 | 북마크 view 상태와 마지막 선택 북마크 폴더 복원 범위 반영 | `App.tsx`, `FinnhubNewsWindow.tsx` | 재실행 후 북마크 뷰 상태 확인 | ⬜ |

3-1 목적: 앱 전체 복원의 기준 payload를 만든다.
3-1 설명: localStorage key, version, schema를 정한다.
3-1 완료 조건(눈으로 확인): 브라우저 localStorage에 workspace state가 저장된다.
3-1 사람 검증(비개발자): 개발자도구 Application 탭에서 key를 볼 수 있다.
3-1 흔한 문제/주의: key 이름을 임시로 만들면 추후 migration이 어렵다.

3-2 목적: 창 레이아웃을 재실행 후에도 그대로 복원한다.
3-2 설명: 탭별 windows 배열과 geometry를 직렬화한다.
3-2 완료 조건(눈으로 확인): 앱 종료 후 다시 켜도 같은 위치에 창이 보인다.
3-2 사람 검증(비개발자): 창을 옮기고 닫았다 다시 열면 그대로다.
3-2 흔한 문제/주의: 화면 크기가 달라지면 off-screen 복원이 생길 수 있다.

3-3 목적: 탭을 이동해도 상태가 휘발되지 않게 한다.
3-3 설명: active tab만 바뀌고, 비활성 탭 상태는 유지한다.
3-3 완료 조건(눈으로 확인): 탭 A의 창 배치를 유지한 채 탭 B에서 작업 가능하다.
3-3 사람 검증(비개발자): 탭 A → 탭 B → 탭 A 왕복 시 이전 모습 유지.
3-3 흔한 문제/주의: 렌더 재생성 시 key가 바뀌면 내부 state가 리셋된다.

3-4 목적: 사용자가 말한 “마지막 상태”를 창 내부까지 확장한다.
3-4 설명: 최소한 컬럼 가시성, source filter, 일반 검색어, ticker 검색어, 날짜 `from`/`to`, display mode, Settings active tab, font size는 저장한다. 다만 `nextCursor`, 현재까지 누적 로드된 페이지, in-flight loading 상태는 저장하지 않는다.
3-4 완료 조건(눈으로 확인): News Feed 일반 검색/티커 검색/날짜 기간/컬럼 상태가 재실행 후 남아 있다.
3-4 사람 검증(비개발자): 컬럼을 끄고 앱 재시작 후 그대로 꺼져 있다.
3-4 흔한 문제/주의: 모든 transient state를 저장하면 오히려 버그가 늘 수 있다.

3-5 목적: 손상된 저장값이 있어도 앱이 죽지 않게 한다.
3-5 설명: parse 실패 시 안전한 초기 상태로 fallback 한다.
3-5 완료 조건(눈으로 확인): 잘못된 JSON을 넣어도 앱이 기본 상태로 뜬다.
3-5 사람 검증(비개발자): localStorage를 지워도 앱이 정상 시작한다.
3-5 흔한 문제/주의: versioning이 없으면 나중 schema 변경 때 복원이 깨진다.

3-6 목적: 사용자가 보던 북마크 폴더 view를 다시 열었을 때 그대로 이어 보게 한다.
3-6 설명: News Feed uiState에 bookmark mode on/off와 마지막 선택 folder id를 저장하되, 임시 북마크 메뉴 open 상태는 저장하지 않는다.
3-6 완료 조건(눈으로 확인): 앱 재실행 후에도 직전에 보던 북마크 폴더 view가 다시 열린다.
3-6 사람 검증(비개발자): 특정 북마크 폴더를 보고 앱을 껐다 켜면 같은 폴더 뉴스가 다시 보인다.
3-6 흔한 문제/주의: 존재하지 않는 folder id를 복원하면 빈 화면처럼 보일 수 있으므로 삭제된 폴더에 대한 fallback이 필요하다.

검증 훅:
```text
수동 검증:
1. 탭 2개 생성
2. 각 탭의 창 위치/크기/필터를 다르게 설정
3. 앱 새로고침 또는 재실행
4. 마지막 활성 탭과 탭별 상태가 복원되는지 확인

사용자 확인 필요: 예
```

#### ⬜ Step 4 — 통합 검증 / 문서 동기화 / 운영 가드레일

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend/frontend prompt 문서를 실제 구현과 동기화 | `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⬜ |
| 4-2 | score/score evidence/keywords 기본 빈 상태와 실패 로그 정책 정리 | 관련 prompt 및 plan 리비전 | 실패 케이스 확인 | ⬜ |
| 4-3 | AI analysis 삭제 감지 테스트와 end-to-end 수동 검증 체크리스트 정리 | plan 또는 test 문서 | 체크리스트 실행 | ⬜ |
| 4-4 | 북마크 폴더/우클릭 저장/Bookmark view 흐름 문서화와 E2E 체크리스트 추가 | 관련 prompt 및 plan 리비전 | 북마크 시나리오 점검 | ⬜ |

4-1 목적: 코드와 문서가 다시 벌어지지 않게 한다.
4-1 설명: 구현 후 prompt/spec 문서를 최신화한다.
4-1 완료 조건(눈으로 확인): 새 컬럼과 persistence 동작이 문서에 반영된다.
4-1 사람 검증(비개발자): 문서를 읽고 UI 동작을 그대로 재현할 수 있다.
4-1 흔한 문제/주의: plan만 바뀌고 prompt가 안 바뀌면 다음 작업에서 혼선이 생긴다.

4-2 목적: 기본 빈 상태와 유실 상태를 운영자가 구분할 수 있게 만든다.
4-2 설명: `analysis_status!=completed`의 정상 empty와 `analysis_status=completed` 이후 유실된 empty를 문서/로그에서 구분한다.
4-2 완료 조건(눈으로 확인): 로그/문서에 empty vs lost 기준이 적힌다.
4-2 사람 검증(비개발자): 에러 메시지가 “아직 분석 안 됨”과 “지워짐”을 구분한다.
4-2 흔한 문제/주의: null과 0을 혼동하면 잘못된 score로 보인다.

4-3 목적: 실제 사용 시나리오와 유실 감지까지 최종 확인을 준비한다.
4-3 설명: update → AI analysis(`completed`) → 조회 → 값 삭제 → 테스트 실패 → non-completed row 예외 확인 → 탭 전환 → 재실행 흐름을 검증한다.
4-3 완료 조건(눈으로 확인): 체크리스트가 1회 실행 가능한 순서로 정리된다.
4-3 사람 검증(비개발자): 체크리스트 순서대로 따라 하면 핵심 기능을 다 볼 수 있다.
4-3 흔한 문제/주의: backend/frontend를 따로만 확인하면 persistence 버그나 자동 로드/`Load more` 간 cursor append 중복·누락 버그를 놓칠 수 있다.

4-4 목적: 북마크 기능이 나중 작업에서 saved view와 혼동되지 않게 문서 기준을 고정한다.
4-4 설명: 폴더 생성, 뉴스 북마크 추가, Bookmark view 조회, 일반 검색 복귀 흐름을 prompt/spec와 체크리스트에 반영한다.
4-4 완료 조건(눈으로 확인): 문서에 북마크 폴더와 saved view의 차이가 분명히 적혀 있다.
4-4 사람 검증(비개발자): 문서만 보고도 폴더 생성 → 우클릭 북마크 → Bookmark view 조회 흐름을 따라 할 수 있다.
4-4 흔한 문제/주의: saved view와 bookmark 용어를 섞어 쓰면 UI 요구가 다시 흐려질 수 있다.

검증 훅:
```bash
cd terminal
npm run build
npm run test
```

```text
수동 확인:
- News 업데이트 후 AI analysis 전/후의 Score/Score Evidence/Keywords/Sentiment 컬럼 확인
- 검색 시 DB 전체 대상 결과가 첫 500개 로드 후 하단 스크롤 자동 로드 또는 `Load more` 버튼으로 다음 500개씩 이어지는지 확인
- 날짜를 비운 기본 상태에서 전체 검색되는지 확인
- 날짜를 지정했을 때 기간 안의 결과만 나오는지 확인
- 저장 후 `Score` 또는 `Score Evidence`를 지웠을 때 테스트 실패 확인
- 앱 종료/재실행 후 상태 복원 확인
- Data Control Settings에서 글자 크기 반영 확인
- 북마크 폴더 생성 → 뉴스 우클릭 `Add bookmark` → `Bookmark view`에서 폴더 선택 → 해당 뉴스 표시 흐름 확인

사용자 확인 필요: 예
```

### 미확정 사항(명시 결정 필요)
1. 결정 #5 — font size 저장 위치
   - 선택지: global localStorage / tab별 저장 / backend saved settings
   - 차단 대상 Step: 2, 3

### 실행 의존성 그래프

Legend
- ✅ 구현 + 사용자확인 완료
- ⏳ 구현완료, 사용자확인 대기
- ⬜ 미착수
- 🚫 선행조건 미충족(차단)

```text
[Track A: 데이터 계약 / 백엔드]
✅ 0-1 sentiment 응답 구조 확정(symbol-level snapshot)
✅ 0-2 ai-news-analysis 출력 기준 정리
✅ 0-3 저장 위치 확정
✅ 0-5 삭제 감지 테스트 규칙 확정
✅ 0-6 confirmed-empty recent skip 규칙 확정
   |
   v
✅ 1-1 DB migration
✅ 1-2 Finnhub sentiment fetch
✅ 1-3 AI analysis repository
✅ 1-4 GET /api/news contract 확장
✅ 1-5 기본 빈 상태 규칙
✅ 1-6 삭제 감지 backend 테스트
✅ 1-7 confirmed-empty range 저장/skip
✅ 1-8 GET /api/news 500개 cursor paging 계약
✅ 1-9 GET /api/news 날짜 기간 검색 계약
✅ 1-10 full text plain text extractor
✅ 1-11 기존 HTML full_text 정리/backfill
✅ 1-12 북마크 schema/repository/API
✅ 1-13 북마크 폴더별 뉴스 조회 API

[Track B: 프론트 컬럼 / 운영 UI]
✅ 0-2 ai-news-analysis 출력 기준 정리
✅ 0-4 persistence 범위 확정
   |
   +--> ✅ 2-1 Score/Score Evidence/Keywords/Sentiment 컬럼 반영
   +--> ✅ 2-2 Keywords 컬럼 활성화
   +--> ✅ 2-3 score/evidence/sentiment 정렬/렌더
   +--> ✅ 2-6 ticker 전용 검색창 + tickers query 연결
   +--> ✅ 2-7 500개 cursor 자동 append + Load more 버튼
   +--> ✅ 2-8 날짜 기간 검색 UI + from/to query 연결
   +--> ✅ 2-9 Bookmark view 폴더 선택 UI
   +--> ✅ 2-10 row 우클릭 Add bookmark
   +--> ✅ 2-11 폴더별 bookmark mode 결과 표시
   +--> ✅ 2-4 Data Control Settings 탭 추가
   +--> ✅ 2-5 전체 글자 크기 조절 UI

[Track C: workspace persistence]
✅ 0-4 persistence 범위 확정
   |
   v
⏳ 3-1 workspace state schema
⏳ 3-2 창 배치 저장/복원
⏳ 3-3 탭 왕복 상태 유지
⏳ 3-4 창 내부 UI state 저장
⏳ 3-5 storage version/fallback
⬜ 3-6 bookmark view 상태 복원

[Track D: 마감]
⬜ 4-1 prompt 문서 동기화
⬜ 4-2 empty/lost/null 정책 정리
⬜ 4-3 삭제 감지 + E2E 체크리스트 정리
⬜ 4-4 bookmark 문서/체크리스트 정리

================ BLOCKER ================
Track A의 선행 결정 차단은 해소되었다.
이제 backend schema/API 설계와 삭제 감지 테스트 구현은 같은 status 기반 규칙으로 진행 가능하다.
남은 미확정 사항은 font size 저장 위치처럼 Track B/C 영역에 가깝다.
=========================================
```

병렬 트랙 요약:
- Track A의 핵심 결정(#1, #2, #3, #8, 0-5)은 확정되었으므로 Step 1 backend 작업 전체를 진행 가능하다.
- Track B와 Track C는 서로 독립 작업이 많지만, font size 저장 위치와 app state schema는 공유한다.
- Track D는 A/B/C가 끝난 뒤 마감 단계로 수행한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 검색 paging 방식 | Step 1, Step 2 | 200 고정 / 500 cursor 자동 append + Load more 버튼 |
| 검색 날짜 기간 방식 | Step 1, Step 2 | 날짜 없음 / 비워두면 전체 + 값 있으면 기간 검색 |
| font size 저장 위치 | Step 2, Step 3 | global localStorage / tab scoped / backend |

### 결정 #1 — AI 뉴스 분석 출력 계약(상세, 사용자 확인 완료)
권장 기준:
- `Score`는 AI가 뉴스의 주가 영향 가능성을 판단한 값이어야 한다.
- 이미 `Sentiment` 컬럼을 별도로 노출할 예정이므로, `Score`는 provider raw sentiment와 완전히 같은 의미가 아니어야 한다.
- `Score Evidence`는 왜 이 점수를 줬는지 설명해야 하며, 분석 전에는 비워 둔다.
- `Keywords`는 중요한 단어 30개를 목표로 배열 형태로 관리한다.

권장안:
- `Score`: `-10 ~ 10`
- `Score Evidence`: 2~5문장 근거 요약
- `Keywords`: 중요한 키워드 30개
- 기본값: 분석 전에는 모두 비움

예시:
- 예시 1: 대형 수주/가이던스 상향 뉴스면 `Score=+8` 수준, Evidence에는 왜 매출/수요 기대를 높이는지 설명.
- 예시 2: 중대한 규제 조사/소송 악재면 `Score=-7` 수준, Evidence에는 왜 비용/밸류에이션/신뢰 훼손으로 이어지는지 설명.
- 예시 3: 아직 AI 분석 미실행이면 `Score=null`, `Score Evidence=null`, `Keywords=[]`로 유지.

### 결정 #4 — persistence 저장 범위(확정)
사용자 확인 결과: **권장범위까지 저장**으로 확정.

확정된 저장 대상:
- 탭 목록
- 마지막 활성 탭
- 각 창의 위치, 크기, 제목, 타입, linkId
- 다크모드 여부
- 전체 글자 크기(`fontScale`)
- News Feed 컬럼 on/off 상태
- News Feed source filter
- News Feed 일반 검색어
- News Feed ticker 검색어
- News Feed 날짜 `from`/`to`
- News Feed display mode
- News Feed bookmark mode on/off
- News Feed 마지막 선택 bookmark folder
- Data Control active tab

저장하지 않는 대상:
- modal/dialog open 여부
- 일회성 loading/spinner 상태
- News Feed `nextCursor`, 누적 페이지 수, append 중 loading 상태
- hover 상태, 우클릭 메뉴 열림 상태 같은 순간 UI 상태

### 결정 #2 — persistence 저장 payload(상세)
권장 payload 초안:

```json
{
  "version": 1,
  "activeTabId": "1712345678901",
  "isDarkMode": false,
  "fontScale": 1,
  "linkedTicker": { "1": "AAPL" },
  "tabs": [
    {
      "id": "1712345678901",
      "name": "Tab 1",
      "windows": [
        {
          "id": "1712345678901-finhub-news-0",
          "type": "finhub-news",
          "title": "News Feed: Finnhub API",
          "linkId": 1,
          "position": { "top": 20, "left": 20, "width": 800, "height": 600 },
          "uiState": {
                  "searchQuery": "earnings",
                  "tickerQuery": "ASTS",
                  "dateFrom": null,
                  "dateTo": null,
               "bookmarkViewMode": false,
               "selectedBookmarkFolderId": null,
            "sourceTypeFilter": "all",
                  "visibleColumns": ["date", "ticker", "title", "score", "scoreEvidence", "sentiment"],
            "displayMode": "title-only"
          }
        }
      ]
    }
  ]
}
```

운영적 정의:
- `version`: localStorage schema 버전
- `activeTabId`: 마지막으로 보고 있던 탭
- `fontScale`: Settings 탭에서 조절한 전체 글자 크기 배율
- `uiState`: 창별로 복원할 최소 내부 상태

사람 확인 체크 항목:
- 앱을 다시 열었을 때 마지막 탭이 자동으로 열린다.
- News Feed의 컬럼 on/off 상태가 이전과 같다.
- 북마크 폴더 view를 보고 있었다면 같은 폴더가 다시 열린다.
- 글자 크기가 마지막 설정값으로 유지된다.

### 결정 #6 — Finnhub recent confirmed-empty skip 정책(상세)
사용자 요구 기준:
- automatic recent retry는 confirmed-empty 과거 구간에 대해 영구 스킵한다.
- 수동 `custom range` 재조회는 계속 허용한다.

권장 기준:
- confirmed-empty 기록은 `ticker + source_type` 단위로 분리한다.
- 기록 조건은 **정상 응답 200 + 실제 빈 배열 길이 0** 으로 제한한다.
- timeout, 429, 5xx, 파싱 실패, 기타 오류는 empty confirmation으로 기록하지 않는다.
- 자동 스킵 대상은 **당일 제외, 당일 이전 범위** 로 제한한다.

운영적 정의:
- 예시 1: `AAPL + company_news`를 `2026-03-01 ~ 2026-03-06`로 조회했고 200 + 빈 배열이면, automatic recent retry에서는 `2026-03-05`까지 confirmed-empty 범위로 취급한다.
- 예시 2: 같은 날 `AAPL + press_release`에서 1건이라도 반환되면 `company_news` confirmed-empty와 별개로 취급한다.
- 예시 3: `MSFT + company_news` 조회가 timeout/429/5xx이면 confirmed-empty를 기록하지 않고, 다음 recent retry 대상에서 제외하지 않는다.

사람 확인 체크 항목:
- 뉴스가 없던 ticker는 같은 과거 범위를 recent update에서 반복 조회하지 않는다.
- `company_news`와 `press_release`의 스킵 판단이 서로 섞이지 않는다.
- 당일 범위는 여전히 조회될 수 있고, 필요하면 `custom range`로 과거를 강제 재조회할 수 있다.

### 결정 #7 — Full Text plain text canonical 저장 정책(상세)
사용자 요구 기준:
- 기존 HTML 기반 `news_fulltext.full_text`는 지우거나 다시 만들어서 plain text 상태로 맞춘다.
- 이후 canonical 저장값은 HTML fragment가 아니라 본문 plain text만 허용한다.

권장 기준:
- extractor 단계에서 article body HTML을 찾되, 저장 직전에는 plain text 정규화를 거친다.
- `script`, `style`, `noscript`, embed/iframe 계열 노드는 제거한다.
- 문단/리스트/줄바꿈 경계는 유지하되, 최종 저장값에는 HTML tag가 남지 않게 한다.
- 기존 `news_fulltext` row는 정책 도입 시 한 번 정리한다. 권장 순서는 “기존 row 삭제 → fulltext update 재실행 → plain text 샘플 확인”이다.
- keyword와 후속 `ai-news-analysis`는 plain text로 정리된 `full_text`를 기준으로만 돌린다.

운영적 정의:
- 예시 1: Nasdaq 기사 body에서 `<p>Revenue rose 20%</p><p>Guidance was raised</p>`를 얻었다면, 저장값은 태그 없는 두 문단 텍스트여야 한다.
- 예시 2: article body 안에 `<script>...</script>` 또는 embed HTML이 섞여 있어도 저장된 `full_text`에는 포함되지 않아야 한다.
- 예시 3: 기존 DB row가 `<div class="body__content">...</div>` 형태라면, 새 정책 적용 후에는 해당 row를 삭제 후 재추출하거나 재정제 backfill로 plain text만 남겨야 한다.

사람 확인 체크 항목:
- News full text를 열었을 때 웹페이지 코드처럼 보이지 않고 읽을 수 있는 문장만 남아 있다.
- 예전 HTML 기반 row와 새 row가 포맷이 섞여 있지 않다.
- 이후 keywords/AI analysis 품질 점검 시 HTML tag 잔여물이 입력으로 보이지 않는다.

### 결정 #8 — News Bookmark Folder/View 정책(상세)
사용자 요구 기준:
- 크롬 북마크처럼 북마크와 북마크 폴더를 만들 수 있어야 한다.
- 뉴스 data를 우클릭하면 `Add bookmark`가 떠야 하고, 이미 만든 폴더 중 어디에 저장할지 선택할 수 있어야 한다.
- 검색창 근처의 `Bookmark view`에서 폴더를 선택하면 그 폴더에 북마크된 뉴스만 UI에 보여야 한다.

권장 기준:
- saved view와 bookmark는 분리한다. saved view는 검색 조건 저장, bookmark는 뉴스 row 저장이다.
- backend는 `bookmark_folders(id, user_id, name, parent_id, sort_order, created_at)`와 `bookmark_items(folder_id, news_id, created_at)` 같은 별도 구조를 권장한다.
- 같은 news_id를 같은 folder_id에 다시 넣으면 중복 row를 만들지 않고 no-op 또는 upsert로 처리한다.
- `Bookmark view`는 일반 검색과 별도 모드로 취급하되, 같은 리스트 컴포넌트를 재사용한다.
- 북마크 폴더 선택 UI는 검색창 근처에서 바로 접근 가능해야 하고, row 우클릭 메뉴와 충돌하지 않아야 한다.

운영적 정의:
- 예시 1: 사용자가 `Earnings` 폴더를 만들고 뉴스 A를 우클릭해 `Add bookmark` → `Earnings`를 고르면, 이후 `Bookmark view`에서 `Earnings` 선택 시 뉴스 A가 리스트에 보여야 한다.
- 예시 2: `Macro` 폴더와 `Semis` 폴더에 서로 다른 뉴스를 넣어 두면, 각 폴더 선택 시 자기 폴더 뉴스만 보여야 한다.
- 예시 3: 같은 뉴스를 같은 폴더에 두 번 `Add bookmark`해도 중복 행이 두 번 보이면 안 된다.

사람 확인 체크 항목:
- 북마크 폴더를 직접 만들 수 있다.
- 뉴스 row 우클릭 시 `Add bookmark`가 보인다.
- 폴더 선택 후 해당 뉴스가 그 폴더의 `Bookmark view`에서만 보인다.
- saved view와 bookmark가 UI에서 서로 다른 개념으로 보인다.

### 결정 #9 — Finnhub sentiment 저장 단위 / AI 실행 시점 / 저장 위치(상세, 사용자 확정 완료)
사용자 확정 결과:
- AI 분석 실행 시점: `full text` plain text canonical 정리가 끝난 row만 후속 batch 대상으로 본다.
- sentiment 저장 단위: 기사별이 아니라 `(ticker, asof_date)` 기준 snapshot으로 저장한다.
- AI analysis 저장 위치: `news_ai_analysis` 별도 테이블로 둔다.
- 북마크 데이터 모델: `bookmark_folders` + `bookmark_items` 별도 테이블로 둔다.

근거:
- 2026-03-07 실제 probe 결과 `news-sentiment?symbol=AAPL` 응답은 기사 배열이 아니라 object였다.
- 확인된 key는 `buzz`, `companyNewsScore`, `sectorAverageBullishPercent`, `sectorAverageNewsScore`, `sentiment`, `symbol` 이다.
- 같은 시점 `company-news` 응답은 별도 기사 배열이며 각 기사에 `id`, `headline`, `datetime`, `summary`, `url`이 있다.
- 따라서 `news-sentiment`는 기사 `id` 1:1 매핑 데이터가 아니라 symbol-level aggregate snapshot으로 보는 편이 맞다.

운영적 정의:
- 예시 1: `AAPL`의 `companyNewsScore=0.9658`, `sentiment.bullishPercent=1`은 특정 기사 A 하나의 점수가 아니라, 해당 시점 `AAPL` 뉴스 전반 분위기 snapshot이다.
- 예시 2: 같은 날 기사 A와 기사 B가 여러 건 있어도, backend는 둘 모두에 같은 `AAPL` snapshot을 참조 표시할 수는 있지만 기사 고유 sentiment row처럼 저장하지는 않는다.
- 예시 3: AI 분석은 full text가 HTML fragment가 아니라 plain text canonical 상태로 정리된 뒤에만 후속 batch로 실행한다.

사람 확인 체크 항목:
- plan만 읽어도 `Sentiment` 컬럼은 기사 고유 점수가 아니라 종목 snapshot 기반이라는 점이 보인다.
- AI 분석 실행 조건이 “뉴스 pull 직후 무조건”이 아니라 “plain text full text 준비 완료 후”라는 점이 명확하다.
- 북마크와 saved view가 저장 구조부터 분리된다는 점이 문서에 분명히 적혀 있다.

### 결정 #10 — 삭제/유실 테스트 실패 기준(상세, 사용자 확정 완료)
사용자 확정 결과:
- `analysis_status=completed`인 row에서 `score`가 비면 실패로 본다.
- `analysis_status=completed`인 row에서 `scoreEvidence`가 비면 실패로 본다.
- `analysis_status=completed`인 row에서 `keywords=[]`이면 최소 warning 대상으로 기록하고, stricter 삭제 감지 테스트에서는 실패로 승격할 수 있다.
- `analysis_status!=completed` row는 기본 빈 상태를 허용하며 실패 대상으로 보지 않는다.

운영적 정의:
- 예시 1: `analysis_status=completed`, `score=7`, `scoreEvidence="positive demand outlook"`, `keywords=[...]`인 row는 정상이다.
- 예시 2: 같은 row에서 `scoreEvidence=null`로 지워지면 삭제/유실 테스트는 실패해야 한다.
- 예시 3: `analysis_status=not_started` 또는 `pending`인 row에서 `score=null`, `scoreEvidence=null`, `keywords=[]`인 것은 실패가 아니라 정상 empty 상태다.
- 예시 4: `analysis_status=completed`인데 `keywords=[]`이면 최소 warning 로그를 남기고, stricter suite에서는 실패로 승격할 수 있다.

사람 확인 체크 항목:
- 분석 완료 뉴스에서 점수나 근거를 일부러 지우면 테스트가 실패해야 한다.
- 아직 분석하지 않은 뉴스가 비어 있는 것은 테스트 실패가 아니어야 한다.
- `keywords=[]`는 조용히 통과하지 않고 최소 warning 이상으로 남아야 한다.