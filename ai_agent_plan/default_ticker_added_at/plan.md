### 목표

Default Ticker Window에서 앞으로 새 ticker를 추가할 때 `추가 시각`을 안정적으로 저장하고, 그 값을 화면에서 바로 볼 수 있도록 backend와 frontend 변경 계획을 정리한다.

이번 tranche의 직접 목표는 아래 3가지다.

1. default universe ticker item 단위의 `added at`를 API 응답에 포함한다.
2. Default Ticker Window가 `추가 날짜` 컬럼을 표시하도록 UI를 확장한다.
3. 사용자가 `최근 추가된 ticker`를 식별할 수 있게 기본 정렬/표시 기준을 정리한다.

### 현재 레포 상태(중요, 확인됨)

- DB 스키마의 `ticker_universe_items`는 이미 `created_at TEXT NOT NULL DEFAULT (datetime('now'))`를 가진다.
- 즉 default universe에 ticker가 새로 들어갈 때 item row 생성 시각 자체는 이미 저장되고 있다.
- 하지만 현재 `listUniverseItems()`는 `ticker, exchange, name, sector, industry`만 반환하고, item-level `created_at`를 API로 노출하지 않는다.
- `getDefaultUniverseRows()`도 `addedAt` 같은 컬럼을 응답에 포함하지 않는다.
- `DefaultTickerWindow.tsx`는 현재 `ticker / name / exchange / industry / ipoDate / marketCap / float / institutional`만 보여주며, 추가 날짜를 표시하는 컬럼이 없다.
- 기본 경로(Default Ticker Window 기본값)일 때는 DB-primary default universe를 사용하므로 item-level `created_at`를 신뢰할 수 있다.
- custom CSV path만 쓰는 경우는 CSV 자체에 `added_at`가 없으므로 동일한 수준의 added time 추적이 불가능하다.

### 제약 / 비범위

- 이번 plan은 기본 default universe(DB-primary) 기준을 우선 다룬다.
- custom CSV path에 대해 과거 추가 시각을 역추적하는 기능은 범위 밖이다.
- ticker 추가 히스토리 전용 audit log 테이블까지 새로 만드는 것은 기본안에서 제외한다.
- 이번 tranche는 `Added At` 표시와 최근 추가 식별이 목적이며, 별도 알림 기능은 다루지 않는다.

### 읽는 방법(비개발자/일반인 기준)

- Step 0은 현재 왜 화면에서 추가 날짜를 볼 수 없는지 확인하는 단계다.
- Step 1은 backend가 `addedAt`를 응답으로 넘기게 만드는 단계다.
- Step 2는 Default Ticker Window에서 그 컬럼을 실제로 보이게 하는 단계다.
- Step 3은 최근 추가 ticker를 더 잘 찾기 위한 정렬/표시 보조 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전 plan을 먼저 고정한다.
- 각 Step은 정적 분석 → build → runtime API/UI 검증 순서로 확인한다.
- 사용자 확인 전까지 각 Step 상태는 `⏳`로 유지한다.
- 추가 요구가 생기면 기존 내용을 지우지 않고 `PLAN CHANGE`로 누적한다.

### 아키텍처(상위)

- DB schema:
  - `terminal/backend/src/db.ts`
  - 핵심 테이블: `ticker_universe_items`
- backend domain/service:
  - `terminal/backend/src/services/tickerUniverseRepository.ts`
  - `terminal/backend/src/server.ts`
- frontend:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | 표시 단위를 날짜만 둘지, 날짜+시각까지 둘지 | 날짜만 | 화면 밀도를 낮추고 가독성을 유지하기 위함 |
| D2 | 기본 정렬을 기존 sort_order 유지로 둘지, 최근 추가순 토글을 넣을지 | 최근 추가순 토글 추가 (확정) | 기존 UX를 깨지 않으면서 최근 추가 탐색을 쉽게 하기 위함 |
| D3 | custom CSV path에서 `addedAt`를 어떻게 표시할지 | `-` 표시 | 실제 신뢰 가능한 값이 없기 때문 |

### 계획 중간 필수 확인

- default path에서 새 ticker 추가 후 실제 `ticker_universe_items.created_at`가 응답에 내려오는지 확인해야 한다.
- 기존 ticker rows도 added time이 정상 표시되는지 확인해야 한다.
- custom CSV path 화면에서는 `addedAt`가 비어 있어도 UI가 깨지지 않아야 한다.
- 컬럼 추가 후 virtualization/grid layout이 무너지지 않아야 한다.

### 제안하는 구현 순서(이유)

1. backend 응답 shape에 `addedAt`를 먼저 연결한다.
2. frontend가 해당 컬럼을 렌더링하도록 확장한다.
3. 그 다음 최근 추가 식별을 위한 정렬/표시를 붙인다.
4. 마지막에 default path와 custom CSV path를 각각 검증한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⬜ Step 0 — 현재 added time 흐름 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | `ticker_universe_items.created_at` 저장 위치 확인 | ⏳ |
| 0-2 | backend API가 item-level created_at를 누락하는 지점 확인 | ⏳ |
| 0-3 | frontend Default Ticker Window에 표시 컬럼이 없는 지점 확인 | ⏳ |

0-1 목적: 저장 자체가 있는지 확인하기 위함.
설명: default universe item row 생성 시 DB에 시간이 저장된다는 점을 스키마 기준으로 고정한다.
완료 조건(눈으로 확인): `ticker_universe_items`에 `created_at` 컬럼이 명시돼 있다.
사람 검증(비개발자): “저장은 되는데 화면에 안 보인다”는 구조를 이해할 수 있어야 한다.
흔한 문제/주의: universe 자체 `created_at`와 item 자체 `created_at`를 혼동하면 안 된다.

0-2 목적: 어디서 값이 끊기는지 정확히 특정하기 위함.
설명: repository/server가 `addedAt`를 응답으로 내리지 않는 부분을 찾는다.
완료 조건(눈으로 확인): 어떤 함수/쿼리가 `created_at`를 select하지 않는지 적혀 있다.
사람 검증(비개발자): “DB엔 있는데 API가 안 준다”가 설명돼야 한다.
흔한 문제/주의: security row와 universe item row를 섞어 보면 안 된다.

0-3 목적: UI 변경 범위를 좁히기 위함.
설명: 현재 grid columns와 row type에 `addedAt`가 없다는 점을 확인한다.
완료 조건(눈으로 확인): DefaultTickerWindow의 타입/헤더/row 렌더링에서 누락 지점이 정리돼 있다.
사람 검증(비개발자): 왜 지금은 최근 추가 ticker를 못 찾는지 이해할 수 있어야 한다.
흔한 문제/주의: virtualization grid 폭 계산을 빼먹으면 컬럼이 깨질 수 있다.

검증 훅:
```text
- db.ts에서 ticker_universe_items created_at 확인
- tickerUniverseRepository.ts / server.ts의 select 응답 확인
- DefaultTickerWindow.tsx의 컬럼 정의 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 1 — backend addedAt 응답 연결

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | universe item row 타입에 `addedAt` 추가 | `terminal/backend/src/services/tickerUniverseRepository.ts` | 타입 에러 0건 | ⬜ |
| 1-2 | default universe 조회 SQL이 `ticker_universe_items.created_at`를 select하도록 변경 | `terminal/backend/src/server.ts` 또는 repository | `/api/tickers` 응답 확인 | ⬜ |
| 1-3 | custom CSV path 응답은 `addedAt = null` 또는 `-` 처리 기준 확정 | `terminal/backend/src/server.ts` | default/custom 응답 비교 | ⬜ |

1-1 목적: item-level added time을 도메인 모델에 포함하기 위함.
설명: universe item 조회 타입과 반환 shape에 `addedAt` 필드를 추가한다.
완료 조건(눈으로 확인): backend 타입에 `addedAt`가 포함된다.
사람 검증(비개발자): API가 이제 추가 시각을 보낼 준비가 됐다는 의미다.
흔한 문제/주의: security row 타입과 universe item 타입을 분리하지 않으면 타입이 애매해질 수 있다.

1-2 목적: 실제 API 응답에 값을 싣기 위함.
설명: default universe 조회 쿼리에서 `ui.created_at AS added_at`를 함께 가져와 응답 JSON에 싣는다.
완료 조건(눈으로 확인): `/api/tickers` 응답 row에 `addedAt`가 보인다.
사람 검증(비개발자): API만 봐도 언제 추가됐는지 확인 가능해야 한다.
흔한 문제/주의: universe created_at를 잘못 보내면 전 ticker가 같은 날짜로 보일 수 있다.

1-3 목적: custom CSV path 예외를 안전하게 처리하기 위함.
설명: CSV-only 목록에는 reliable added time이 없으므로 `null`로 내려서 UI에서 `-`로 표시한다.
완료 조건(눈으로 확인): custom CSV path에서도 API shape는 같고 값만 비어 있다.
사람 검증(비개발자): default path만 added time이 있고 CSV-only는 없다는 점이 일관되게 보인다.
흔한 문제/주의: 경로에 따라 응답 shape가 달라지면 frontend 분기가 복잡해진다.

검증 훅:
```text
GET /api/tickers?csvPath=<default path>
GET /api/tickers?csvPath=<custom csv path>
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — Default Ticker Window에 Added At 컬럼 표시

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | frontend row 타입과 normalizer에 `addedAt` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx` | 정적 분석 0건 | ⬜ |
| 2-2 | grid column에 `Added At` 컬럼 추가 | 같은 파일 | build + 렌더링 확인 | ⬜ |
| 2-3 | default/custom path에서 표시값 포맷 분기 | 같은 파일 | UI/API 값 비교 | ⬜ |

2-1 목적: backend가 보내는 값을 UI state에 실어오기 위함.
설명: `TickerRow`와 `normalizeRows()`에 `addedAt`를 포함한다.
완료 조건(눈으로 확인): row 타입에 `addedAt`가 생긴다.
사람 검증(비개발자): 값이 오면 화면에 찍힐 준비가 된 상태다.
흔한 문제/주의: fallback row에도 필드를 넣지 않으면 undefined handling이 흔들릴 수 있다.

2-2 목적: 사용자가 실제로 날짜를 보게 하기 위함.
설명: 헤더와 row grid에 `Added Date` 컬럼을 추가하고 날짜까지만 보이도록 virtualization layout 폭을 조정한다.
완료 조건(눈으로 확인): Default Ticker Window에 새 컬럼이 보인다.
사람 검증(비개발자): ticker 옆에서 언제 추가했는지 바로 읽을 수 있어야 한다.
흔한 문제/주의: grid template 폭이 안 맞으면 마지막 remove 버튼이나 다른 컬럼이 밀릴 수 있다.

2-3 목적: path별 데이터 유무 차이를 안전하게 표시하기 위함.
설명: default path는 `YYYY-MM-DD` 날짜만 보여주고, custom CSV path는 `-`로 둔다.
완료 조건(눈으로 확인): 값이 없을 때도 UI가 깨지지 않는다.
사람 검증(비개발자): 어떤 경우에 날짜가 안 보이는지 이해할 수 있어야 한다.
흔한 문제/주의: locale/timezone formatting이 지나치게 길면 컬럼 가독성이 떨어진다.

검증 훅:
```text
frontend build
Default Ticker Window 열기
기본 경로/커스텀 경로 각각 Added At 표시 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — 최근 추가 ticker 식별 보조 기능

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `최근 추가순` 정렬 또는 토글 방식 결정 반영 | `DefaultTickerWindow.tsx` | UI 확인 | ⬜ |
| 3-2 | 상단 notice 또는 정렬 기준 문구 추가 | 같은 파일 | 렌더링 확인 | ⬜ |
| 3-3 | 신규 추가 직후 가장 최근 ticker가 눈에 띄는지 확인 | frontend + API | 수동 확인 | ⬜ |

3-1 목적: addedAt를 단순 표시만 하지 않고 탐색에도 쓰기 위함.
설명: 기존 sort_order 중심은 유지하되, `최근 추가순` 보기 토글을 추가하는 방향을 기본안으로 둔다.
완료 조건(눈으로 확인): 최근 추가 ticker를 빠르게 찾는 방법이 생긴다.
사람 검증(비개발자): 방금 추가한 ticker가 어디 있는지 바로 찾을 수 있어야 한다.
흔한 문제/주의: 기본 정렬을 강제로 바꾸면 기존 사용 습관이 깨질 수 있다.

3-2 목적: 화면 의미를 명확히 하기 위함.
설명: 현재 정렬 기준이 default order인지 recent-added인지 화면에서 알 수 있게 한다.
완료 조건(눈으로 확인): 현재 보기 기준을 설명하는 짧은 문구가 있다.
사람 검증(비개발자): 왜 어떤 ticker가 위에 보이는지 이해할 수 있어야 한다.
흔한 문제/주의: 문구가 장황하면 오히려 UI가 지저분해질 수 있다.

3-3 목적: 기능이 실제 탐색에 도움이 되는지 확인하기 위함.
설명: 새 ticker 추가 후 최근 추가 기준에서 바로 상단에 보이는지 확인한다.
완료 조건(눈으로 확인): 방금 추가한 ticker를 쉽게 찾을 수 있다.
사람 검증(비개발자): “지금 막 추가한 게 뭔지 알 수 있다”가 충족돼야 한다.
흔한 문제/주의: sort_order와 addedAt가 어긋나는 기존 데이터가 있을 수 있다.

검증 훅:
```text
기본 경로에서 ticker 추가
Added At 값 확인
최근 추가순 보기에서 상단 노출 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 4 — 선택적 과거 데이터 보정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | 과거 legacy row의 addedAt 신뢰도 보정 필요 여부 판단 | DB/plan 문서 | 사용자 결정 필요 | 🚫 |
| 4-2 | custom CSV-only 흐름에 별도 audit 저장 추가 여부 판단 | backend schema | 사용자 결정 필요 | 🚫 |

4-1 목적: 오래된 기존 ticker의 addedAt 품질을 따로 손볼지 결정하기 위함.
설명: 기존 row는 DB migration 시점 또는 최초 import 시점 기준일 수 있어, 사용자가 원하면 보정 정책을 따로 세울 수 있다.
완료 조건(눈으로 확인): 기본안에 포함할지 별도 tranche로 뺄지 결정된다.
사람 검증(비개발자): 과거 값이 “실제 상장/등록 최초일”과 다를 수 있음을 이해해야 한다.
흔한 문제/주의: 의미가 다른 날짜를 섞어 쓰면 오해가 생긴다.

4-2 목적: CSV-only 경로에도 added time을 강제할지 결정하기 위함.
설명: CSV만으로는 addedAt를 복원할 수 없으므로 별도 audit 저장이 필요하지만, 기본안 범위를 넘는다.
완료 조건(눈으로 확인): 이번 tranche에서 제외할지 여부가 정리된다.
사람 검증(비개발자): default path와 custom CSV path의 보장 수준 차이를 이해할 수 있어야 한다.
흔한 문제/주의: audit 기능을 섣불리 넣으면 범위가 커진다.

검증 훅:
```text
사용자 결정 전에는 실행하지 않음
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | Added At 표시 포맷 | 날짜만 (확정) / 날짜+시각 | Step 2 |
| D2 | 최근 추가 식별 방식 | 최근 추가순 토글 추가 (확정) / 컬럼만 표시 | Step 3 |
| D3 | custom CSV path 처리 | `-` 표시 / 별도 audit 도입 | Step 1, Step 4 |

### PLAN CHANGE — 2026-03-30

- `default_ticker_added_at`는 plan만 있고 실제 구현이 누락된 상태가 확인됐다.
- 현재 기준 누락 지점은 아래 3개였다.
  - backend `getDefaultUniverseRows()`가 `ticker_universe_items.created_at`를 select하지 않음
  - `/api/tickers` 실응답에 `addedAt` 필드가 없음
  - `DefaultTickerWindow.tsx`에 `Added Date` 컬럼과 `최근 추가순` 토글이 없음
- 이번 변경에서는 Step 1~3의 핵심 범위를 한 번에 구현한다.
  - default universe API row에 `addedAt` 연결
  - custom CSV path는 `addedAt = null` 유지
  - Default Ticker Window에 `Added Date` 컬럼 표시
  - `최근 추가순` 토글과 현재 정렬 기준 문구 추가
- legacy row 보정이나 CSV-only audit 저장은 이번 변경 범위에 포함하지 않는다.

### PLAN CHANGE — 2026-03-31

- Default Ticker 화면에서 `Failed to execute 'json' on 'Response': Unexpected end of JSON input` 회귀가 확인됐다.
- 원인은 2개였다.
  - backend `getDefaultUniverseRows()`의 row 타입 선언에 `insider_pct`, `insider_source`가 빠져 TS 컴파일이 깨질 수 있었다.
  - frontend `DefaultTickerWindow.tsx`가 빈 body 응답에도 `response.json()`을 바로 호출해 런타임 예외를 그대로 노출했다.
- 이번 수정에서는 기능 범위를 넓히지 않고 회귀 안정화만 수행한다.
  - backend row 타입에 insider 필드 추가
  - frontend 공통 JSON 파서 추가(빈 응답 안전 처리)
  - Yahoo 로그 자동 열기 코드를 원래 위치로 복구

### PLAN CHANGE — 2026-03-31 (Yahoo holders partial persist)

- Yahoo holders batch가 attempt 종료 시점에만 DB 저장을 수행해, 중간 cancel이나 worker 중단 시 이미 받은 ticker 결과가 유실될 수 있는 구조가 확인됐다.
- 추가로 `source='yahoo'` description row가 이미 있는 종목에서 ownership canonical row의 `source`를 `yahoo`로 바꾸는 과정이 `UNIQUE(security_id, source)` 충돌을 만들 수 있었다.
- 이번 수정에서는 아래를 반영한다.
  - Yahoo ownership worker가 ticker 1건을 받는 즉시 callback으로 DB upsert 수행
  - cancel check는 저장 이후로 이동해 "받은 건 저장 후 중단" 보장
  - ownership upsert는 기존 `source` row가 있으면 그 row에 merge하고, 다른 row의 ownership 필드는 비워 중복 ownership row를 방지
  - live backend(8080)를 최신 코드로 재기동하고 cancel 런타임 시나리오로 partial persist를 검증

### 실행 의존성 그래프

Legend: `✅ 사용자 확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — backend data path
- ⏳ 0-1 ticker_universe_items created_at 저장 확인
- ⏳ 0-2 API 누락 지점 확인
- ⏳ 0-3 frontend 누락 지점 확인
- ⏳ 1-1 backend 타입에 addedAt 추가
- ⏳ 1-2 default universe API 응답에 addedAt 연결
- ⏳ 1-3 custom CSV path null 처리 고정

Track B — frontend display
- ⏳ 2-1 row 타입/normalizer에 addedAt 추가
- ⏳ 2-2 Added At 컬럼 추가
- ⏳ 2-3 default/custom 표시 분기
- ⏳ 3-1 최근 추가 식별 보조 정렬/토글
- ⏳ 3-2 정렬 기준 문구 추가
- ⏳ 3-3 신규 추가 후 탐색 확인

┌──────────────────────────────────────────────┐
│ 사용자 결정 필요                              │
│ Added At는 날짜만 표시한다.                   │
│ 최근 추가순 토글도 이번 tranche에 포함한다.   │
│ Step 2~3은 구현 순서만 남아 있다.             │
└──────────────────────────────────────────────┘

병렬 트랙 요약
- Track A가 먼저 끝나야 Track B가 실제 값을 렌더링할 수 있다.
- 기본안은 backend addedAt 연결 + 컬럼 표시까지다.
- 최근 추가순 토글은 같은 tranche에 가능하지만, UX 판단에 따라 Step 3으로 분리한다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D3 | Step 4 | `-` 표시 / 별도 audit |

### PLAN CHANGE — 2026-03-31 (DB / backend / frontend 문서 동기화)

- 사용자가 현재 DB 구조와 backend/frontend 코드 구조를 레포 문서에 반영해 달라고 요청했다.
- 현재 구현과 문서 사이의 핵심 불일치는 아래였다.
  - `company_profiles`의 ownership/insider 필드와 representative row 규칙이 backend/frontend/repo 문서에 완전히 반영되지 않음
  - Default Ticker의 `Added Date`, `Insider %`, `Yahoo Holders`, `GET /api/jobs/:jobId` polling 구조가 프롬프트 문서 기준으로 일부 누락됨
  - 레포 차원의 빠른 참조용 DB/code structure 요약 문서가 없음
- 이번 변경에서는 동작을 바꾸지 않고 문서만 현재 코드 기준으로 동기화한다.
  - `terminal/backend_prompt.md`에 현재 `company_profiles`, `/api/tickers`, `pull-holders-yahoo`, `update_status` 구조 반영
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`에 Default Ticker 현재 UI/API/job polling 구조 반영
  - `.github/copilot-skills/repo-context.md`에 현재 DB/key/ownership semantics 반영
  - 빠른 참조용 구조 문서 `terminal/backend/DB_SCHEMA.md`, `terminal/backend/CODE_STRUCTURE.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/FRONTEND_CODE_STRUCTURE.md` 추가
- 검증은 문서 파일 존재/키워드 교차 확인 + `8080` listener/API 응답 확인으로 마무리한다.

### PLAN CHANGE — 2026-04-01 (Yahoo-only institutional + Finnhub 제거)

- Default Ticker의 `institutionalPct`가 Yahoo/Finnhub 의미가 섞인 상태였고, Yahoo held-percent raw 정규화도 100% 초과 케이스에서 잘못 축소 저장되는 문제가 확인됐다.
- 사용자는 Finnhub institutional data를 제거하고 Yahoo 값만 그대로 반영하길 요청했다.
- 이번 변경에서는 아래를 동시에 반영한다.
  - Yahoo `majorHoldersBreakdown` held-percent 정규화를 수정해 100% 초과 ratio도 올바른 퍼센트로 저장
  - Default Ticker의 `institutionalPct` / `institutionalSource`는 Yahoo row만 재노출
  - `POST /api/company-profiles/pull-institutional` route는 제거하고 `410 Gone` 반환
  - frontend Default Ticker에서 Finnhub `Inst` 버튼과 job polling/log panel 제거
  - 현재 `app.db`의 Yahoo raw payload를 기준으로 ownership 값을 백필하고, legacy Finnhub institutional 값은 null 처리
- 검증은 backend build + backend test + webui build + `GET /api/tickers` / removed route runtime 호출로 마무리한다.

### PLAN CHANGE — 2026-04-01 (요약 문서 제거 + canonical 문서 일원화)

- 사용자는 추가로 생성한 `CODE_STRUCTURE.md`, `DB_SCHEMA.md`, `FRONTEND_CODE_STRUCTURE.md` 3개를 제거하고, 현재 구조 설명은 기존 canonical 문서에만 남기길 요청했다.
- 현재 상태를 재점검한 결과 아래 문서가 이미 source of truth 역할을 수행하고 있었다.
  - backend 구조/동작: `terminal/backend_prompt.md`
  - frontend 구조/동작: `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - repo DB/저장 구조: `.github/copilot-skills/repo-context.md`
- 이번 변경에서는 중복 요약 문서 3개를 제거하고, canonical 문서만 유지한다.
- 검증은 파일 삭제 확인 + stale reference 탐색 + 문서 diagnostics 확인으로 마무리한다.