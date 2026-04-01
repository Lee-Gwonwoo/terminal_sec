## Frontend Code Structure

기준 경로: `termina_web/figma_code/terminal_ui_ver2_finhub/src`

### 앱 셸

- `app/App.tsx`
  - 탭/창 레이아웃
  - linked ticker 상태
- `app/components/DraggableWindow.tsx`
  - 창 공통 프레임

### Default Ticker 관련

- `app/components/DefaultTickerWindow.tsx`
  - `GET /api/tickers`
  - `POST /api/tickers/import-default`
  - `POST /api/tickers/add`
  - `DELETE /api/tickers/remove`
  - `POST /api/company-profiles/pull-market-cap`
  - `POST /api/company-profiles/pull-float`
  - `POST /api/company-profiles/pull-holders-yahoo`
  - `GET /api/jobs/:jobId`

현재 UI 구조:

- 상단 path / reload / 3개 pull 버튼
- job progress + log panel
- add ticker 입력
- filter 입력
- `Recent Added` 정렬 토글
- 가상 리스트 grid
- 표시 컬럼:
  - `Ticker`
  - `Name`
  - `Exchange`
  - `Industry`
  - `Added Date`
  - `IPO Date`
  - `Market Cap`
  - `Float %`
  - `Inst %`
  - `Insider %`

### 문서 source of truth

- 상세 UI 스펙: `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`