# agent_log — 새로 추가된 Default Ticker 대상 News Pull

## 2026-05-11 구현 로그

### Step 1/2 backend 구현

- 변경 파일: `terminal/backend/src/server.ts`
- 변경 내용:
  - `pullFinnhubSchema`, `pullFmpPressReleaseSchema`에 `[][][]tickerAddedFrom[][][]` optional 날짜 필드를 추가했다.
  - default universe의 `ticker_universe_items.created_at`를 `date(ui.created_at) >= date(tickerAddedFrom)` 기준으로 필터링하는 helper를 추가했다.
  - custom CSV path에는 `tickerAddedFrom`을 적용하지 않고 default DB universe에서만 동작하도록 제한했다.
  - Finnhub custom preflight/실행 route와 FMP PR custom preflight/실행 route가 같은 ticker subset을 쓰도록 연결했다.
  - preflight/job result/log에 `[][][]tickerAddedFrom[][][]`, `[][][]selectedTickerCount[][][]`, `[][][]excludedOlderTickerCount[][][]`, `[][][]selectedTickersSample[][][]`을 포함하도록 했다.
- 검증:
  - VS Code diagnostics: `terminal/backend/src/server.ts` 오류 없음.
- 사용자 확인 상태: 확인 대기(awaiting user confirmation)

### Step 3 frontend 구현

- 변경 파일: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- 변경 내용:
  - Update 드롭다운에 `New Tickers Company News`, `New Tickers Press Release`, `New Tickers FMP PR` 버튼을 추가했다.
  - `Ticker Added From`, `News From`, `News To`를 받는 새 modal을 추가했다.
  - 새 modal은 기존 custom preflight modal을 재사용하며, Continue 시 실제 pull request에 `[][][]tickerAddedFrom[][][]`을 함께 보낸다.
  - preflight 결과의 대상 ticker 수가 0개이면 Continue 버튼을 비활성화하도록 했다.
- 검증:
  - VS Code diagnostics: `FinnhubNewsWindow.tsx` 오류 없음.
- 사용자 확인 상태: 확인 대기(awaiting user confirmation)

### Step 4 문서/메모 동기화

- 변경 파일:
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - `/memories/repo/new_ticker_news_pull_2026_05_11.md`
- 변경 내용:
  - backend prompt에 `[][][]tickerAddedFrom[][][]` request field, preflight/job result field, Finnhub/FMP PR route 동작을 추가했다.
  - frontend prompt에 `New Tickers Only` 버튼 3개, 날짜 3개 modal, preflight/Continue dispatch를 추가했다.
  - repo memory에는 field/route/검증 핵심만 짧게 기록했다.
- 검증:
  - `tickerAddedFrom|selectedTickerCount|New Tickers` 문서 검색으로 반영 확인.
- 사용자 확인 상태: 확인 대기(awaiting user confirmation)

### Step 5 검증 결과

- 정적 오류:
  - `server.ts`, `FinnhubNewsWindow.tsx`, backend/frontend prompt, plan/log 모두 VS Code diagnostics 오류 없음.
- build/test:
  - `terminal/backend`: `npm.cmd run build` 성공.
  - `terminal/backend`: `npm.cmd run test` 성공, 16 files / 96 tests passed.
  - `termina_web/figma_code/terminal_ui_ver2_finhub`: `npm.cmd run build` 성공. 기존 Vite chunk size warning만 표시.
- runtime API preflight:
  - Finnhub company_news: `tickerAddedFrom=2026-05-01`, `from=2026-05-01`, `to=2026-05-11` → `selectedTickerCount=2`, sample `SLP`, `DGXX`.
  - FMP PR: 같은 날짜 조건 → `selectedTickerCount=2`, sample `SLP`, `DGXX`.
- browser UI:
  - News Window Update menu에서 `New Tickers Company News`, `New Tickers Press Release`, `New Tickers FMP PR` 버튼 표시 확인.
  - `New Tickers Company News` modal에서 날짜 3개 입력 후 preflight modal 표시 확인.
  - preflight modal에 `selectedTickerCount=2`, `tickerAddedFrom=2026-05-01`, sample `SLP`, `DGXX` 표시 확인.
  - 실제 provider pull은 Continue를 누르지 않고 Cancel로 종료했다.
- 사용자 확인 상태: 확인 대기(awaiting user confirmation)

## 2026-05-11 18:40 - Custom 접두어 반영 및 위치 조정

- 사용자 요청
  - 새로 추가된 default ticker 대상 다운로드가 기존 custom 기능과 같은 흐름이므로 버튼 이름 앞에 `Custom`을 붙여야 한다.
- 변경 사항
  - `FinnhubNewsWindow.tsx`의 표시명을 `Custom New Tickers Company News`, `Custom New Tickers Press Release`, `Custom New Tickers FMP PR`로 변경했다.
  - modal 제목과 preflight 제목도 `Custom New Tickers ...` 형식으로 맞췄다.
  - 사용자가 올린 메뉴 화면에서 더 찾기 쉽도록 `Custom New Tickers` 묶음을 `Custom Market News`보다 위에 배치했다.
  - frontend prompt, backend prompt, plan 문서, repo memory의 명칭을 같은 기준으로 맞췄다.
- 검증
  - `FinnhubNewsWindow.tsx` 진단 결과 오류 없음.
  - 관련 prompt/plan/log 문서 진단 결과 오류 없음.
  - frontend `npm.cmd run build` 통과.
  - `http://localhost:5173/` 응답 `200 OK` 확인.
  - 소스 검색으로 `Custom New Tickers` 묶음이 `Custom Market News`보다 앞에 배치된 것을 확인했다.
- 리스크 및 완화
  - 메뉴 항목이 많아 일부 화면 높이에서는 여전히 스크롤이 필요할 수 있다. 필요하면 다음 단계에서 search형 메뉴나 고정 섹션 분리로 줄일 수 있다.
  - backend API contract는 변경하지 않았으므로 기존 job 동작 리스크는 낮다.
- 사용자 확인 상태
  - 확인 대기.
