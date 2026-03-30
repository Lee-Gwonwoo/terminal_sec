### 목표

- 새 `Daily Change History Window`를 추가한다.
- 이 창에서 default universe ticker들의 특정 날짜 기준 `daily change%`와 `close from open %`를 한 번에 볼 수 있게 한다.
- 사용자가 날짜를 직접 선택할 수 있게 한다.
- 같은 날짜와 같은 market cap filter 기준으로 `상승 수 / 하락 수 / 보합 수`를 함께 표시한다.
- market cap을 custom min/max로 설정해 그 범위에 해당하는 ticker만 보이게 한다.
- turnover를 일별 계산해 저장하고, 같은 창에서 turnover filter를 적용할 수 있게 한다.
- `Turnover` column을 선택적으로 보이게 하고, 각 column을 정렬 가능하게 한다.
- Data Control Window에 FMP 기반 `recent missing OHLC fill`, `recent missing change fill` 버튼을 추가한다.
- recent FMP 보강은 누락분만 대상으로 하고, ET 장 마감 전 current day는 제외한다.
- 집계(summary)와 row table이 서로 다른 기준을 쓰지 않도록, backend에서 같은 filtered dataset 기준으로 계산한다.

### 현재 레포 상태(중요, 확인됨)

- 프론트는 이미 독립 window 기반 구조를 사용한다.
  - `WindowType`에 `finhub-news`, `investing-news`, `default-ticker`, `data-control`, `evidence-table` 등이 등록돼 있다.
  - `AddTabModal.tsx`, `App.tsx`, `DraggableWindow.tsx`를 통해 새 window를 추가할 수 있다.
- `Default Ticker Window`는 현재 backend `GET /api/tickers`를 사용해 default universe row를 렌더링한다.
  - ticker, name, exchange, industry, ipoDate, marketCap, floatPct, institutionalPct를 이미 내려받는다.
  - 즉 default universe ticker와 최신 market cap source는 이미 `app.db` 기준으로 읽을 수 있다.
- OHLC canonical 데이터는 `OHLC_data/ohlc_1d_watchlist.sqlite`의 `ohlc_1d` 테이블에 있다.
  - `Open`, `Close`와 함께 `Change_1d_Pct`, `Change_From_Open_Pct` 파생 컬럼이 이미 존재한다.
  - `ohlcWatchlistRepository.ts`는 current ET 장중 bar 제외 규칙을 이미 갖고 있다.
- backend에는 `GET /api/default-tickers/daily-change-history` endpoint가 이미 있고, `daily change%`, `close from open %`, market cap filter, missing summary를 반환한다.
- frontend에도 Daily Change History 전용 window type, component, 탭 등록은 이미 있다.
- turnover 저장 컬럼, turnover update 버튼, turnover filter, turnover column visibility, per-column sort까지 이제 구현돼 있다.
- prompt/spec 문서는 `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`가 최신 기준 문서다.

### 제약 / 비범위

- 이번 plan의 기본 범위는 `daily change history` 조회 UI와 그 backend read API다.
- 이번 revision부터는 turnover 계산/저장/update/filter/column/sort 확장도 기본 범위에 포함한다.
- 뉴스 change metric(`news_change_metrics`)를 재활용하는 작업은 이번 범위가 아니다.
- OHLC 수집 job 자체를 새로 만드는 것은 이번 범위가 아니다.
- market cap source 재수집 로직 개선은 이번 범위가 아니다.
- mock 데이터는 추가하지 않는다.
- CSV custom universe를 대상으로 한 별도 history view는 이번 범위가 아니다. 대상은 우선 default universe로 고정한다.

### 읽는 방법(비개발자/일반인 기준)

- `Step 0`은 현재 데이터가 이 기능을 만들기에 충분한지 확인하는 단계다.
- `Step 1`은 날짜 + market cap filter를 받아 실제 숫자를 내려주는 backend API를 만드는 단계다.
- `Step 2`는 새 창을 탭 시스템에 등록하는 단계다.
- `Step 3`은 창 안에서 날짜 선택, market cap 필터, 상승/하락 요약, ticker table을 붙이는 단계다.
- `Step 4`는 기존 Daily Change History 구현의 문서 동기화와 최종 검증 단계다.
- `Step 5`는 turnover 계산 버튼, turnover filter, selectable column, column sort 확장 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전 이 문서의 API contract와 UI 범위를 먼저 고정한다.
- 각 Step 완료 후 변경 파일, 검증 방법, 리스크를 채팅에 보고한다.
- 사용자 확인 전까지 완료된 항목 상태는 `⏳`가 아니라 이번 문서 기준 `⬜ → ⏳ → ✅` 흐름을 쓴다.
- 현재는 구현 전이므로 모든 세부 단계 상태는 `⬜`다.
- 구현 중 범위가 바뀌면 기존 plan을 지우지 않고 `PLAN CHANGE` 섹션을 아래쪽에 추가한다.

### 아키텍처(상위)

- backend 입력 source
  - default universe: `terminal/backend/backend/data/app.db`
  - market cap source: `company_profiles.market_cap` latest row per security
  - OHLC price source: `OHLC_data/ohlc_1d_watchlist.sqlite` → `ohlc_1d`
  - turnover source: `Volume × ((Open + Close) / 2)`를 일별 계산해 `ohlc_1d` 파생 컬럼으로 저장
- backend 처리 흐름
  1. 선택 날짜(`selectedDate`)를 입력받는다.
  2. default universe ticker 목록과 company meta를 가져온다.
  3. 같은 ticker set에 대해 해당 날짜의 `Open`, `Close`, `Change_1d_Pct`, `Change_From_Open_Pct`를 OHLC DB에서 조회한다.
  4. turnover 값이 없으면 별도 update 경로에서 일별 turnover를 계산해 저장한다.
  5. market cap min/max와 turnover min/max filter를 적용한다.
  6. 필터가 적용된 동일 row set 기준으로 `상승 수 / 하락 수 / 보합 수 / 전체 수`를 계산한다.
  6. summary와 rows를 하나의 response로 반환한다.
- frontend 처리 흐름
  1. 새 `Daily Change History Window`가 날짜 선택 state, market cap min/max state, turnover min/max state를 가진다.
  2. state 변경 시 backend history API를 호출한다.
  3. 상단 summary card에 상승/하락/보합/전체 수를 보여준다.
  4. 하단 table에 ticker별 `Ticker | Name | Date | Close | Daily Change % | Close From Open % | Turnover | Market Cap | Industry`를 표시한다.
  5. 사용자가 column visibility를 바꾸고, 각 column을 asc/desc 정렬할 수 있게 한다.
  6. 빈 결과일 때는 filter 결과 0건 상태를 명확히 보여준다.

### Glossary

- `selectedDate`
  - 사용자가 창에서 선택한 거래일 기준 날짜 (`YYYY-MM-DD`).
  - 이 날짜의 `ohlc_1d.Datetime` row를 읽는다.
- `daily change%`
  - `ohlc_1d.Change_1d_Pct`를 의미한다.
  - 운영적 정의: 전 거래일 종가 대비 `selectedDate` 종가의 변화율.
- `close from open %`
  - `ohlc_1d.Change_From_Open_Pct`를 의미한다.
  - 운영적 정의: `selectedDate` 시가 대비 `selectedDate` 종가의 변화율.
- `filtered universe`
  - default universe 전체가 아니라, `selectedDate` 기준 row에 대해 market cap / turnover filter 조건을 통과한 ticker 집합.
  - summary와 table은 반드시 이 같은 집합을 사용한다.
- `상승 / 하락 / 보합`
  - 기본값 제안: `daily change% > 0` 상승, `< 0` 하락, `= 0` 보합.
  - `null`은 summary에서 `missingCount`로 별도 집계한다.
- `turnover`
  - 운영적 정의: `[][][]Volume[][][] × (([][][]Open[][][] + [][][]Close[][][])/2)`.
  - 일별 거래대금 근사치이며 단위는 raw USD number로 저장/필터링한다.
  - `Open`, `Close`, `Volume` 중 하나라도 없으면 해당 날짜 turnover는 `null`이다.

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | 새 창 위치 | 별도 `Daily Change History Window` | 사용자 요청이 별도 window 생성 의도에 가깝기 때문 |
| D2 | 집계 기준 컬럼 | `Change_1d_Pct` | `daily change%`의 의미가 가장 명확하기 때문 |
| D3 | market cap filter 단위 | raw USD number | backend/company_profiles가 이미 raw number로 저장하기 때문 |
| D4 | market cap null 처리 | filter 활성 시 제외 | 사용자가 필터링된 universe만 본다고 이해하기 쉽기 때문 |
| D5 | 상승/하락 집계의 null row 처리 | `missingCount` 별도 노출 | OHLC 누락 row를 summary에서 숨기지 않기 위해 |
| D6 | default date | OHLC stable max date | 장중 partial bar를 피하기 위해 |
| D7 | 날짜 선택 UI | 달력에서 날짜 하나만 고르는 단일 date picker | 첫 구현에서 단순성과 명확성이 가장 높기 때문 |
| D8 | turnover 계산식 | `Volume × ((Open + Close) / 2)` | 사용자가 직접 지정한 일별 거래대금 근사식이기 때문 |
| D9 | turnover 저장 위치 | `ohlc_1d` 파생 컬럼 | OHLC 일봉과 같은 row에 두는 것이 조회/skip/filter에 가장 단순하기 때문 |
| D10 | turnover update 버튼 위치 | Data Control Window | 수동 보강/백필 계열 update 버튼의 기존 위치와 맞기 때문 |
| D11 | turnover filter 단위 | raw USD number | market cap filter와 같은 방식으로 backend/API를 단순하게 유지하기 위해 |

### PLAN CHANGE

- 2026-03-30 user decision 반영:
  - `D5`는 `null` change row를 summary에서 제외하지 않고 `missingCount`로 별도 표시한다.
  - 날짜 선택 UI는 quick button 없이 단일 date picker로 고정한다.
  - `D2`는 입력 즉시 fetch가 아니라 `Apply` 버튼으로 반영한다.
- 2026-03-30 turnover 확장 반영:
  - turnover는 `Volume × ((Open + Close) / 2)`로 일별 계산해 저장한다.
  - turnover update 버튼은 기존 update 성격상 Data Control Window에 두는 것으로 계획한다.
  - Daily Change History Window는 turnover filter, selectable `Turnover` column, per-column sort를 지원하는 방향으로 확장한다.
- 2026-03-30 FMP recent 보강 버튼 반영:
  - Data Control Window에 `FMP Recent OHLC Fill`과 `FMP Recent Missing Change Fill`을 추가한다.
  - OHLC 보강은 default universe 기준 recent tail의 missing row만 채운다.
  - change 보강은 최근 7일 뉴스 중 `change_pct`가 비어 있는 row만 다시 계산한다.
  - 두 경로 모두 FMP API를 사용하며, ET 장 마감 전 current ET day는 제외한다.
- 2026-03-30 filter/summary 확장 반영:
  - market cap / turnover filter는 `1M`, `2.5B` 같은 shorthand number 입력을 허용한다.
  - Daily Change History는 저장된 derived value가 있으면 우선 사용하고, 없으면 `Apply` 시점 응답에서 즉시 계산한 값을 내려준다.
  - summary는 `daily change %` 기준 1세트와 `close from open %` 기준 1세트, 총 2세트로 제공한다.

### 계획 중간 필수 확인

- OHLC DB에서 `selectedDate` row가 없는 ticker가 어느 정도 있는지 확인해야 한다.
- market cap이 없는 ticker는 filter off일 때는 보이되, filter on일 때는 제외되는 규칙을 일관되게 적용해야 한다.
- turnover가 없는 ticker는 turnover filter off일 때는 보이되, filter on일 때는 제외되는 규칙을 일관되게 적용해야 한다.
- summary의 `gainers + losers + flat + missing` 합과 filtered table row count가 정확히 같은지 확인해야 한다.
- selectedDate가 장중 current ET date일 때 stable bar 제외 규칙과 충돌하지 않는지 확인해야 한다.
- 날짜 선택기에서 휴장일이나 데이터 미존재 날짜를 골랐을 때 빈 상태를 어떻게 보여줄지 확인해야 한다.
- turnover update가 이미 값이 있는 row를 정확히 skip하는지 확인해야 한다.
- column sort가 `null` numeric 값과 visible/hidden column 상태에서 일관되게 동작하는지 확인해야 한다.

### 제안하는 구현 순서(이유)

1. backend read contract를 먼저 만든다.
   - summary와 row가 같은 필터 기준을 쓰는지 backend에서 먼저 고정해야 프론트 drift를 막을 수 있다.
2. window registration을 붙인다.
   - 새 창이 Add Tab Modal과 DraggableWindow에서 열릴 수 있어야 프론트 작업을 연결하기 쉽다.
3. UI state와 rendering을 붙인다.
   - 날짜 선택, market cap 입력, summary card, table을 한 컴포넌트에서 묶는다.
4. turnover 저장/update 경로를 붙인다.
  - turnover filter가 read-only 숫자가 아니라 유지되는 값이 되게 한다.
5. 문서와 검증을 마지막에 동기화한다.
   - prompt/spec drift를 줄인다.
6. 운영 보강 버튼은 기존 Data Control에 붙인다.
  - 조회 창과 수동 repair 버튼을 한 플로우로 연결해 recent missing 보수를 빠르게 수행할 수 있게 한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 데이터 계약 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | default universe + market cap + OHLC 조합 가능 여부 확인 | ⏳ |
| 0-2 | `selectedDate` 기본값을 stable max date로 둘 수 있는지 확인 | ⏳ |
| 0-3 | 상승/하락/보합 집계 기준과 null 처리 규칙을 고정 | ⏳ |

0-1 목적: 이 기능이 기존 DB만으로 구현 가능한지 확인하기 위함.
설명: `GET /api/tickers`가 이미 제공하는 ticker meta와 OHLC DB의 파생 컬럼만으로 원하는 표를 만들 수 있는지 점검한다.
완료 조건(눈으로 확인): backend plan에서 새 write job 없이 read API만 추가하면 된다는 점이 명확하다.
사람 검증(비개발자): 기존 데이터로 바로 보여주는 화면이라는 점을 이해할 수 있다.
흔한 문제/주의: app.db와 OHLC sqlite를 서로 다른 기준 날짜로 읽으면 숫자가 어긋날 수 있다.

0-2 목적: 첫 화면에서 유효한 날짜가 바로 보이게 하기 위함.
설명: current ET 장중 bar를 제외한 `stable max date`를 backend가 내려줄지, 프론트가 별도 계산할지 방향을 고정한다.
완료 조건(눈으로 확인): 기본 날짜 계산 위치가 정해진다.
사람 검증(비개발자): 창을 열었을 때 빈 날짜가 아니라 가장 최근 유효 거래일이 자동 선택된다.
흔한 문제/주의: 휴장일 또는 장중 날짜가 기본값으로 잡히면 첫 화면이 비어 보일 수 있다.

0-3 목적: summary 숫자 해석을 흔들리지 않게 하기 위함.
설명: `Change_1d_Pct`가 null인 row는 제외하지 않고 `missingCount`로 따로 세는 규칙을 고정한다.
완료 조건(눈으로 확인): 상승/하락/보합/미싱 집계 기준식이 plan에 적혀 있다.
사람 검증(비개발자): 같은 숫자를 보고 집계 기준을 이해할 수 있다.
흔한 문제/주의: table에는 row가 있는데 summary 총합이 안 맞는 상황이 생기면 사용자 신뢰가 떨어진다.

검증 훅:
```text
- backend 쿼리 설계에서 default universe / company_profiles / ohlc_1d join 경로 확인
- stable max date 계산 위치 확정
- 상승/하락/보합/null 처리 규칙 문서 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — backend Daily Change History API 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | history row 조회용 repository/helper 추가 | `terminal/backend/src/services/dailyChangeHistoryRepository.ts` | 타입 검사 + 샘플 query 확인 | ⏳ |
| 1-2 | `selectedDate`, `marketCapMin`, `marketCapMax`를 받는 read endpoint 추가 | `terminal/backend/src/server.ts` | endpoint 200/400 확인 | ⏳ |
| 1-3 | summary와 rows를 같은 filtered dataset 기준으로 반환 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/dailyChangeHistoryRepository.ts` | response shape 확인 | ⏳ |
| 1-4 | 기본 날짜와 available date 정보 반환 규칙 확정 | `terminal/backend/src/services/dailyChangeHistoryRepository.ts` | default date 확인 | ⏳ |

1-1 목적: OHLC DB 조회 로직을 server.ts 인라인 SQL로 흩뜨리지 않기 위함.
설명: 선택 날짜의 price row와 default universe company meta를 합쳐 row dataset을 만드는 helper를 추가한다.
완료 조건(눈으로 확인): selectedDate 기준 dataset 생성 함수가 존재한다.
사람 검증(비개발자): 같은 날짜 기준으로 숫자를 읽는 함수가 생긴다.
흔한 문제/주의: company_profiles는 source별 다중 row라 최신 market cap 대표 row 선택 규칙이 필요하다.

1-2 목적: 프론트가 단일 endpoint만 호출하게 하기 위함.
설명: 예시 `GET /api/default-tickers/daily-change-history?date=2026-03-27&marketCapMin=1000000000&marketCapMax=50000000000` 같은 read endpoint를 추가한다.
완료 조건(눈으로 확인): 새 route와 validation이 생긴다.
사람 검증(비개발자): 날짜와 시총 범위만 바꿔서 표를 새로 읽을 수 있다.
흔한 문제/주의: min/max 역전, 숫자 parse 실패, 빈 날짜 값에 대한 400 처리 규칙이 있어야 한다.

1-3 목적: 프론트가 별도 재집계를 하지 않게 하기 위함.
설명: backend response에 `summary`와 `rows`를 함께 넣고, 같은 filter 결과 기준으로 count를 계산한다.
완료 조건(눈으로 확인): response에 `summary.total`, `summary.gainers`, `summary.losers`, `summary.flat`, `summary.missing`이 포함된다.
사람 검증(비개발자): 표를 보고 있는 대상과 summary 숫자가 정확히 일치한다.
흔한 문제/주의: frontend에서 table만 추가 filter하면 summary와 어긋난다.

1-4 목적: 첫 로딩 UX와 날짜 선택 범위를 안정화하기 위함.
설명: response 또는 별도 meta에 `defaultDate`, `availableMaxDate`를 내려줄지 정한다.
완료 조건(눈으로 확인): 프론트가 어떤 날짜를 첫 값으로 써야 하는지 명확하다.
사람 검증(비개발자): 창을 열자마자 가장 최근 유효 날짜가 자동 선택된다.
흔한 문제/주의: unavailable date를 그냥 허용하면 빈 테이블이 자주 나온다.

검증 훅:
```text
- GET /api/default-tickers/daily-change-history?date=YYYY-MM-DD
- GET /api/default-tickers/daily-change-history?date=YYYY-MM-DD&marketCapMin=1000000000&marketCapMax=10000000000
- invalid min/max, invalid date format 400 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — 새 Window 등록

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `WindowType`에 `daily-change-history` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts` | 타입 에러 0건 | ⏳ |
| 2-2 | Add Tab Modal에 `Daily Change History` 선택 항목 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/AddTabModal.tsx` | UI 코드 리뷰 | ⏳ |
| 2-3 | App title 매핑과 DraggableWindow rendering 분기 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`, `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx` | 창 오픈 확인 | ⏳ |

2-1 목적: 새 창을 정식 window system에 넣기 위함.
설명: 새 type 이름은 `daily-change-history`로 고정한다.
완료 조건(눈으로 확인): type union에 새 이름이 있다.
사람 검증(비개발자): 새 창이 기존 창들과 같은 체계로 관리된다.
흔한 문제/주의: type 추가 없이 component만 만들면 App/Modal 연결에서 누락된다.

2-2 목적: 사용자가 새 창을 직접 생성할 수 있게 하기 위함.
설명: Add Tab Modal checkbox 목록에 `Daily Change History`를 추가한다.
완료 조건(눈으로 확인): modal 목록에 새 항목이 보인다.
사람 검증(비개발자): 새 탭 만들기에서 이 창을 선택할 수 있다.
흔한 문제/주의: title label과 internal type 이름이 섞이면 유지보수가 어려워진다.

2-3 목적: 선택한 창이 실제로 열리게 하기 위함.
설명: App title 매핑과 DraggableWindow switch-case에 새 component를 연결한다.
완료 조건(눈으로 확인): 새 창이 draggable shell 안에서 열린다.
사람 검증(비개발자): 창 제목이 `Daily Change History`로 보인다.
흔한 문제/주의: App title만 추가하고 DraggableWindow 분기를 빼먹기 쉽다.

검증 훅:
```text
- frontend build
- Add Tab Modal에서 Daily Change History 선택
- 창 생성 후 title과 빈 shell 렌더링 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — Daily Change History Window UI 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 날짜 선택 state와 market cap min/max state 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx` | 정적 분석 0건 | ⏳ |
| 3-2 | summary card 영역 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx` | 렌더링 확인 | ⏳ |
| 3-3 | ticker table 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx` | 렌더링 확인 | ⏳ |
| 3-4 | empty/loading/error 상태 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx` | 상태 전환 확인 | ⏳ |
| 3-5 | localStorage persistence 범위 결정 및 적용 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DailyChangeHistoryWindow.tsx` | 상태 복원 확인 | ⏳ |

3-1 목적: 사용자가 조회 기준을 직접 바꾸게 하기 위함.
설명: 단일 date picker 하나와 `marketCapMin`, `marketCapMax` 입력을 두고, 사용자가 `Apply`를 눌렀을 때 backend API를 다시 호출한다.
완료 조건(눈으로 확인): 날짜 하나를 고르는 달력 입력과 custom market cap 필드가 있다.
사람 검증(비개발자): 날짜와 시총 범위를 직접 바꿀 수 있다.
흔한 문제/주의: draft 입력값과 현재 적용된 filter를 시각적으로 구분하지 않으면 사용자가 혼동할 수 있다.

3-2 목적: 사용자가 시장 breadth를 먼저 보게 하기 위함.
설명: `상승 수`, `하락 수`, `보합 수`, `미싱 수`, `전체 수`를 상단 card로 노출한다.
완료 조건(눈으로 확인): summary card 5개가 보인다.
사람 검증(비개발자): 필터를 바꾸면 카드 숫자도 같이 변한다.
흔한 문제/주의: table row count와 summary total이 안 맞으면 안 된다.

3-3 목적: ticker별 상세 숫자를 비교하게 하기 위함.
설명: 최소 컬럼은 `Ticker`, `Name`, `Date`, `Close`, `Daily Change %`, `Close From Open %`, `Market Cap`, `Industry`로 시작한다.
완료 조건(눈으로 확인): 필터 결과가 테이블 row로 나온다.
사람 검증(비개발자): 어떤 ticker가 올랐고 내렸는지 한 줄씩 볼 수 있다.
흔한 문제/주의: % 컬럼 포맷과 market cap 포맷이 기존 Default Ticker와 다르면 어색하다.

3-4 목적: 데이터가 없거나 실패했을 때도 의미 있는 화면을 유지하기 위함.
설명: loading spinner, error banner, `해당 조건에 맞는 ticker가 없음` empty state를 넣는다.
완료 조건(눈으로 확인): 빈 날짜/엄격한 filter에도 화면이 깨지지 않는다.
사람 검증(비개발자): 아무 결과가 없을 때도 이유를 읽을 수 있다.
흔한 문제/주의: loading과 stale data를 동시에 보여줄지 정책이 필요하다.

3-5 목적: 사용자가 마지막 조회 조건을 유지하게 하기 위함.
설명: 필요하면 `daily-change-history-ui-state` 같은 localStorage key에 날짜/시총 필터를 저장한다.
완료 조건(눈으로 확인): 창을 다시 열어도 마지막 조건이 복원된다.
사람 검증(비개발자): 앱을 껐다 켜도 마지막 조회값이 유지된다.
흔한 문제/주의: 오래된 날짜가 저장돼도 OHLC 최신 상태와 안 맞을 수 있으니 fallback 규칙이 필요하다.

검증 훅:
```text
- frontend build
- 날짜 변경 시 summary/table 동시 갱신 확인
- market cap min/max 입력 시 table과 상승/하락 수가 같은 기준으로 줄어드는지 확인
- 빈 결과/에러/로딩 상태 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — 문서 동기화와 최종 검증

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend prompt에 새 API와 데이터 계약 반영 | `terminal/backend_prompt.md` | 문서 확인 | ⏳ |
| 4-2 | frontend prompt에 새 window 동작과 localStorage key 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 확인 | ⏳ |
| 4-3 | 정적 분석, build, test, runtime 검증 수행 | 관련 코드 전반 | 전체 검증 표 작성 | ⏳ |

4-1 목적: backend source of truth 문서를 최신화하기 위함.
설명: 새 endpoint, query parameter, response field, default date 규칙을 문서에 적는다.
완료 조건(눈으로 확인): backend prompt에 Daily Change History API 설명이 있다.
사람 검증(비개발자): backend가 어떤 숫자를 내려주는지 문서로 읽을 수 있다.
흔한 문제/주의: rows 컬럼명과 summary 필드명을 문서에 정확히 적어야 한다.

4-2 목적: frontend 동작 설명과 실제 구현의 drift를 막기 위함.
설명: 새 window, date picker, market cap custom filter, summary card, localStorage key를 문서에 적는다.
완료 조건(눈으로 확인): frontend prompt에 새 창 설명이 있다.
사람 검증(비개발자): 어떤 필터와 숫자가 보이는지 문서로 이해할 수 있다.
흔한 문제/주의: summary가 filtered dataset 기준이라는 점을 반드시 명시해야 한다.

4-3 목적: 구현을 문서만이 아니라 실제 동작으로 닫기 위함.
설명: 정적 분석, build, test, runtime API 호출, UI 코드 리뷰를 모두 수행한다.
완료 조건(눈으로 확인): 검증 표가 채워진다.
사람 검증(비개발자): 무엇을 직접 확인하면 되는지 명령과 확인 포인트가 있다.
흔한 문제/주의: 브라우저 시각 확인이 어렵다면 API 검증 + 코드 리뷰 + 사용자 위임을 분리해 적어야 한다.

검증 훅:
```text
- get_errors
- backend build
- frontend build
- workspace test
- history endpoint 실호출
- 새 window 시각 확인 또는 코드 리뷰 + API 검증
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

- 현재 없음.

#### ⏳ Step 5 — Turnover 계산/필터/컬럼 정렬 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | `ohlc_1d` turnover 저장 컬럼 추가와 계산 helper 설계 | `terminal/backend/src/services/ohlcWatchlistRepository.ts`, `terminal/backend/src/services/ohlcDerivedMetrics.ts` | 타입 검사 + DB 쿼리 확인 | ⏳ |
| 5-2 | 이미 turnover 값이 있는 row는 skip하는 turnover update 로직 추가 | backend service | 샘플 before/after 확인 | ⏳ |
| 5-3 | default universe 기준 turnover 계산 버튼과 진행 상태 UI 추가 | `termina_web/.../DataControlWindow.tsx`, backend route/job | job 생성/skip 확인 | ⏳ |
| 5-4 | history endpoint에 turnover 반환 + turnover min/max filter 추가 | `terminal/backend/src/server.ts`, `dailyChangeHistoryRepository.ts` | endpoint 응답 확인 | ⏳ |
| 5-5 | Daily Change History Window에 turnover filter 입력과 `Apply` 반영 추가 | `DailyChangeHistoryWindow.tsx` | UI 코드 리뷰 | ⏳ |
| 5-6 | `Turnover` column visibility toggle와 column 정렬 기능 추가 | `DailyChangeHistoryWindow.tsx` | 정렬/표시 확인 | ⏳ |
| 5-7 | 모든 visible column을 개별 asc/desc 정렬 가능하게 정리 | `DailyChangeHistoryWindow.tsx` | 여러 column sort 확인 | ⏳ |
| 5-8 | 문서/plan/log에 turnover 정의와 검증 절차 동기화 | prompt 문서 + plan/log | 문서 확인 | ⏳ |

5-1 목적: turnover를 조회 시 임시 계산이 아니라 저장 가능한 일별 값으로 고정하기 위함.
설명: `ohlc_1d` row마다 turnover 값을 둘 파생 컬럼과 계산 helper를 정의한다.
완료 조건(눈으로 확인): turnover 저장 위치와 계산 함수 위치가 plan에 고정된다.
사람 검증(비개발자): 거래대금 값이 매번 즉석 계산이 아니라 저장되는 구조라는 점을 이해할 수 있다.
흔한 문제/주의: 컬럼 위치가 분산되면 skip/update/filter가 복잡해진다.

5-2 목적: 이미 계산된 row를 매번 다시 계산하지 않게 하기 위함.
설명: `turnover IS NOT NULL` row는 skip하고, 값이 없는 row만 계산하는 update 로직을 만든다.
완료 조건(눈으로 확인): skip existing 규칙이 명시돼 있다.
사람 검증(비개발자): 이미 계산된 데이터는 다시 돌리지 않는다는 점이 보인다.
흔한 문제/주의: `0`과 `null`을 혼동하면 잘못 skip할 수 있다.

5-3 목적: 사용자가 turnover 계산을 수동으로 시작할 수 있게 하기 위함.
설명: Data Control Window에 turnover 계산 버튼을 추가하고 progress/job 상태를 연결한다.
완료 조건(눈으로 확인): turnover update 버튼이 보인다.
사람 검증(비개발자): 버튼을 누르면 계산이 시작되고 진행 상태가 보인다.
흔한 문제/주의: 범위가 default universe 전체인지 선택 날짜 한정인지 혼동하지 않게 라벨을 명확히 해야 한다.

5-4 목적: Daily Change History가 turnover를 읽고 필터링할 수 있게 하기 위함.
설명: history API response에 `turnover`를 추가하고 `turnoverMin`, `turnoverMax` query를 받게 한다.
완료 조건(눈으로 확인): response row에 turnover 필드가 있다.
사람 검증(비개발자): turnover 숫자를 기준으로 표가 줄어든다.
흔한 문제/주의: market cap filter와 turnover filter가 다른 dataset 기준을 쓰면 안 된다.

5-5 목적: 사용자가 turnover 기준으로 row를 줄여 보게 하기 위함.
설명: Daily Change History Window에 turnover min/max 입력을 추가하고 `Apply` 시 반영한다.
완료 조건(눈으로 확인): turnover filter 입력창이 있다.
사람 검증(비개발자): 숫자를 넣고 Apply를 누르면 결과가 줄어든다.
흔한 문제/주의: raw USD number를 그대로 받으므로 placeholder/help text가 필요하다.

5-6 목적: turnover 숫자를 표에서 선택적으로 보게 하기 위함.
설명: column visibility UI에 `Turnover`를 추가하고 visible 상태에 따라 table에 렌더링한다.
완료 조건(눈으로 확인): Turnover column을 켜고 끌 수 있다.
사람 검증(비개발자): 필요할 때만 거래대금을 표에 보이게 할 수 있다.
흔한 문제/주의: hidden column 상태에서 sort state가 남아 있으면 혼란스러울 수 있다.

5-7 목적: 비교 작업을 빠르게 하기 위함.
설명: turnover 포함 모든 visible column을 asc/desc 정렬할 수 있게 정리한다.
완료 조건(눈으로 확인): 각 column header를 눌러 정렬 방향이 바뀐다.
사람 검증(비개발자): 예를 들어 turnover 큰 순, daily change 작은 순처럼 바로 볼 수 있다.
흔한 문제/주의: 숫자/문자/null 정렬 기준을 일관되게 정하지 않으면 결과가 불안정해 보인다.

5-8 목적: turnover 확장 범위를 문서와 기록에 남기기 위함.
설명: backend/frontend prompt와 plan/log에 turnover 정의, 버튼, filter, sort 검증 절차를 동기화한다.
완료 조건(눈으로 확인): 문서에 turnover 관련 설명이 있다.
사람 검증(비개발자): 나중에 봐도 turnover 기능이 어떻게 동작하는지 이해할 수 있다.
흔한 문제/주의: 계산식, skip 규칙, filter 단위를 문서마다 다르게 적으면 안 된다.

검증 훅:
```text
- turnover update route/job 설계 확인
- history endpoint turnover response/turnover filter 설계 확인
- Daily Change History column visibility/sort UX 설계 확인
```
사용자 확인 필요: **예**


### 실행 의존성 그래프

Legend: `✅ 사용자 확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — backend 데이터 계약
- ⏳ 0-1 default universe + market cap + OHLC 조합 가능 여부 확인
- ⏳ 0-2 stable max date 기본값 규칙 확정
- ⏳ 0-3 상승/하락/보합/null 처리 규칙 고정
- ⏳ 1-1 history row 조회 helper 추가
- ⏳ 1-2 history read endpoint 추가
- ⏳ 1-3 summary + rows 동일 기준 반환
- ⏳ 1-4 default date / available date meta 규칙 확정

Track B — window shell 등록
- ⏳ 2-1 WindowType 추가
- ⏳ 2-2 Add Tab Modal 항목 추가
- ⏳ 2-3 App / DraggableWindow 연결

Track C — UI 구현
- ⏳ 3-1 날짜/market cap state 추가
- ⏳ 3-2 summary card 구현
- ⏳ 3-3 ticker table 구현
- ⏳ 3-4 empty/loading/error 상태 구현
- ⏳ 3-5 localStorage persistence 적용

Track D — 문서/검증
- ⏳ 4-1 backend prompt 동기화
- ⏳ 4-2 frontend prompt 동기화
- ⏳ 4-3 전체 검증 수행

Track E — turnover 확장
- ⏳ 5-1 turnover 저장 컬럼 + 계산 helper 설계
- ⏳ 5-2 turnover update skip-existing 로직 추가
- ⏳ 5-3 turnover 계산 버튼 + progress UI 추가
- ⏳ 5-4 history endpoint turnover 반환 + turnover filter 추가
- ⏳ 5-5 Daily Change History turnover filter 입력 추가
- ⏳ 5-6 Turnover column visibility toggle 추가
- ⏳ 5-7 모든 visible column sort 추가
- ⏳ 5-8 turnover 문서/기록 동기화

차단 구간:

```text
┌─ NO OPEN BLOCKER ────────────────────────────────────────┐
│ 현재 plan 기준 미확정 UX 결정은 남아 있지 않다.          │
│ 구현과 검증을 바로 진행할 수 있다.                       │
└──────────────────────────────────────────────────────────┘
```

### 병렬 트랙 요약

- Track A의 `0-*` 감사가 끝나면 `1-*` backend API 구현을 진행할 수 있다.
- Track B는 backend route 명세가 고정되면 병렬로 진행 가능하다.
- Track C는 `summary.missing` 포함 response shape가 고정된 뒤 붙이는 것이 안전하다.
- filter 반영 방식은 `Apply` 버튼으로 확정됐다.
- Track E는 기존 Step 1/3 구현 위에 얹는 확장이다. `5-1`, `5-2`, `5-4`가 backend 선행이고, `5-5` 이후 UI를 붙이는 순서가 안전하다.

### 차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
