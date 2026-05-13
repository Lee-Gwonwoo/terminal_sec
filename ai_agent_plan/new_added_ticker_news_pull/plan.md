# 새로 추가된 Default Ticker 대상 News Pull — 계획

### 목표

News Window의 update 메뉴에 `Custom Company News`, `Custom Press Release`, `Custom FMP PR`과 같은 동작을 하되, **Default Ticker Window에 특정 날짜 이후 추가된 ticker만 대상**으로 삼는 새 버튼을 추가한다.

이번 tranche의 직접 목표는 아래 4가지다.

1. `ticker_universe_items.created_at` 기반으로 `새로 추가된 ticker` subset을 안정적으로 계산한다.
2. 기존 custom update의 날짜 범위, gap-only preflight, job 실행, log/result 흐름을 최대한 재사용한다.
3. News Window에서 버튼을 누르면 설정 모달을 열고, 사용자가 `ticker 추가 기준 날짜`와 `뉴스 수집 날짜 범위`를 지정할 수 있게 한다.
4. 실행 전 preflight에서 대상 ticker 수, sample ticker, gap summary를 보여준 뒤 사용자가 Continue를 눌렀을 때만 실제 다운로드를 시작한다.

---

### 현재 레포 상태(중요, 확인됨)

- Default Ticker의 canonical source는 `terminal/backend/backend/data/app.db`의 `ticker_universes/default` + `ticker_universe_items` + `securities`이다.
- `ticker_universe_items`에는 `created_at TEXT NOT NULL DEFAULT (datetime('now'))`가 있고, 현재 `/api/tickers`는 이것을 `[][][]addedAt[][][]`로 내려준다.
- Default Ticker Window에는 `Added Date` 컬럼과 `Recent Added` 정렬 버튼이 이미 있다.
- News Window의 기존 custom 버튼은 [FinnhubNewsWindow.tsx](../../termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx)에서 `handleCustomStart` → 날짜 모달 → `handleCustomPreflightStart` → preflight modal → `handleUpdate('custom', ...)` 흐름을 사용한다.
- 기존 backend custom route는 다음과 같다.
  - Finnhub Company News / Press Release: `POST /api/news/pull-finhub`, preflight: `POST /api/news/pull-finhub/preflight-custom`
  - FMP PR: `POST /api/news/pull-fmp-press-release`, preflight: `POST /api/news/pull-fmp-press-release/preflight-custom`
- 기존 custom 계열은 `from~to` 뉴스 날짜 범위에 대해 `buildTickerGapPlans()` 기반 gap-only preflight/실행을 이미 지원한다.
- 기존 route는 ticker list를 `getDefaultUniverseTickers()`로 전체 default universe에서 만든다. 이번 기능은 이 부분에 `tickerAddedFrom` filter를 추가하는 작업이 핵심이다.
- FMP/Finnhub 실제 다운로드는 provider API key와 rate limit 영향을 받는다. preflight는 DB 기반이라 API key 없이도 검증 가능하다.

---

### 제약 / 비범위

- 이번 기능은 **현재 default universe에 남아 있는 ticker**만 대상으로 한다. 과거에 추가됐다가 삭제된 ticker의 이력 복원은 다루지 않는다.
- custom CSV path에는 신뢰 가능한 `addedAt`가 없으므로 이번 기능 대상에서 제외한다.
- mock ticker나 fake provider를 만들지 않는다. preflight/검증은 실제 DB의 ticker universe와 기존 provider route를 사용한다.
- 새 provider API를 만들지 않고, 기존 Finnhub/FMP pull route에 선택적 ticker subset 조건을 추가한다.
- FMP Stock, FMP SEC Filing, RTPR, Market News는 이번 첫 범위에서 제외한다. 사용자 요청 범위는 `Company News`, `Press Release`, `FMP PR` 3개로 고정한다.
- `tickerAddedFrom`은 날짜 단위만 받는다. 시각 단위 선택 UI는 이번 범위에서 제외한다.

---

### 읽는 방법(비개발자/일반인 기준)

- Step 0은 기존 버튼이 어디서 ticker 목록을 만드는지 확인하는 감사 단계다.
- Step 1은 backend가 “이 날짜 이후 추가된 ticker만” 고르는 공통 함수를 갖게 만드는 단계다.
- Step 2는 기존 Company News / Press Release / FMP PR custom route에 그 ticker subset을 연결하는 단계다.
- Step 3은 News Window에 새 버튼과 설정 모달을 추가하는 단계다.
- Step 4는 문서와 사용자 확인 흐름을 맞추는 단계다.
- Step 5는 build/test/API/browser 검증 단계다.

용어:

- `tickerAddedFrom`: 사용자가 지정하는 “이 날짜부터 default ticker에 추가된 ticker만 대상” 기준 날짜. 예: `2026-05-01`이면 `addedAt` 날짜가 2026-05-01 이상인 ticker만 대상이다.
- `newsFrom` / `newsTo`: 실제 뉴스 다운로드 날짜 범위. 기존 Custom 버튼의 `from` / `to`와 동일하다.
- `gap-only`: 요청한 뉴스 날짜 범위에서 DB에 이미 있는 coverage를 제외하고 missing gap만 provider API로 가져오는 기존 custom 최적화 방식이다.
- `preflight`: 실제 다운로드 전에 대상 ticker 수와 missing gap 요약을 보여주는 확인 단계다.

---

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전 이 plan을 기준으로 범위를 고정한다.
- 구현 중 요구사항이 바뀌면 기존 기록을 지우지 않고 `PLAN CHANGE` 항목을 아래에 추가한다.
- 각 Step은 구현 → 검증 → 사용자 확인 순서로 진행한다.
- 사용자 확인 전에는 해당 Step 상태를 `⏳`로 두고, 사용자가 명시적으로 확인한 뒤에만 `✅`로 바꾼다.
- code 변경이 발생하면 같은 plan 폴더의 `agent_log.md`를 append 방식으로 작성한다.

---

### 아키텍처(상위)

Backend:

- `terminal/backend/src/server.ts`
  - 기존 custom route schema에 `[][][]tickerAddedFrom[][][]` optional field 추가
  - `getDefaultUniverseTickers()` 주변에 added date filter helper 추가 또는 query 분리
  - Finnhub/FMP PR preflight와 실제 실행에서 동일한 ticker subset 사용
- `terminal/backend/src/services/tickerUniverseRepository.ts`
  - 필요 시 `listUniverseItems` 계열에 `created_at` 포함 helper 추가
- `terminal/backend/src/services/newsGapPlanner.ts` 또는 현재 gap planner 사용 위치
  - 기존 `buildTickerGapPlans()` 호출은 유지하되, 입력 ticker list만 새 subset으로 좁힘

Frontend:

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - update source type 또는 별도 action type에 새 버튼 3개 추가
  - 새 모달 상태: `tickerAddedFrom`, `newsFrom`, `newsTo`
  - 기존 custom preflight modal과 job tracking 재사용
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
  - 새 버튼/모달/응답 필드 설명 반영

API contract 초안:

```json
{
  "mode": "custom",
  "from": "2026-05-01",
  "to": "2026-05-11",
  "sourceType": "company_news",
  "tickerAddedFrom": "2026-05-01"
}
```

응답/로그에 추가할 필드:

- `[][][]tickerAddedFrom[][][]`
- `[][][]selectedTickerCount[][][]`
- `[][][]selectedTickersSample[][][]`
- `[][][]excludedOlderTickerCount[][][]`
- 기존 gap summary 필드(`[][][]totalTickers[][][]`, `[][][]fullyCoveredTickers[][][]`, `[][][]tickersWithMissingGaps[][][]`, `[][][]totalMissingRanges[][][]`)는 유지

---

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 제안 기본값 | 이유 |
|---------|------|-------------|------|
| D1 | “새로 추가된 ticker” 포함 기준 | `date(ui.created_at) >= tickerAddedFrom` | 사용자가 “언제부터 추가된 ticker”라고 요청했으므로 시작일 포함이 자연스럽다. |
| D2 | UI에서 받을 날짜 필드 | `tickerAddedFrom`, `newsFrom`, `newsTo` 3개 | ticker 추가 기준일과 뉴스 수집 범위는 서로 다른 개념이다. |
| D3 | 지원 source | `Company News`, `Press Release`, `FMP PR` 3개 | 사용자 요청 범위와 기존 custom 버튼 대응을 그대로 따른다. |
| D4 | custom CSV path 동작 | 미지원, default universe만 사용 | custom CSV에는 `addedAt`가 없으므로 결과를 신뢰할 수 없다. |
| D5 | preflight 필수 여부 | 필수 | 새 ticker subset이 너무 넓거나 비어 있을 수 있으므로 실행 전 확인이 안전하다. |
| D6 | 대상 ticker가 0개일 때 | preflight에서 0개 표시, 실제 실행 버튼 비활성 또는 400 | 불필요한 provider 호출을 막는다. |

---

### 계획 중간 필수 확인

- `tickerAddedFrom`으로 선택한 ticker 수가 `/api/tickers`의 `Added Date` 정렬 결과와 일치하는지 확인한다.
- preflight와 실제 실행이 **동일한 ticker subset**을 쓰는지 확인한다.
- 기존 `Custom Company News`, `Custom Press Release`, `Custom FMP PR` 동작이 바뀌지 않는지 확인한다.
- `tickerAddedFrom`이 없는 기존 요청은 기존 전체 default universe 동작을 유지해야 한다.
- FMP PR은 기존 full text included for new rows 흐름을 유지해야 한다.
- Company News custom auto fulltext chaining과 change merger 동작이 기존과 동일하게 유지되는지 확인한다.

---

### 제안하는 구현 순서(이유)

1. 먼저 backend에서 ticker subset helper를 만든다. 이 helper가 맞아야 preflight와 실행이 같은 대상을 공유할 수 있다.
2. 다음으로 preflight route에 `tickerAddedFrom`을 연결한다. 실제 다운로드 전에 안전하게 대상/범위를 검증할 수 있다.
3. 그 다음 실제 pull route에 같은 subset을 연결한다. 이때 기존 custom/gap-only 로직은 최대한 건드리지 않는다.
4. 마지막으로 frontend 버튼과 모달을 붙인다. backend contract가 확정된 뒤 UI를 붙여야 중복 상태를 줄일 수 있다.
5. 문서와 검증을 끝에 묶어 실제 사용자 조작 방법과 운영 리스크를 정리한다.

---

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 기존 흐름 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | Default Ticker의 `addedAt` source와 현재 API 응답 확인 | ⏳ |
| 0-2 | News Window custom 버튼/모달/preflight 흐름 확인 | ⏳ |
| 0-3 | Finnhub/FMP PR backend custom route의 ticker list 생성 지점 확인 | ⏳ |
| 0-4 | 기존 custom preflight 응답 shape와 frontend 표시 방식을 확인 | ⏳ |

0-1 목적: 새 ticker 판단 기준을 DB source 기준으로 고정하기 위함.
설명: `ticker_universe_items.created_at` → `/api/tickers.rows[].addedAt` 흐름을 확인한다.
완료 조건(눈으로 확인): `GET /api/tickers` sample row에 `addedAt`가 보인다.
사람 검증(비개발자): Default Ticker Window에서 `Added Date` 정렬로 같은 ticker들이 보인다.
흔한 문제/주의: `securities.created_at`와 `ticker_universe_items.created_at`를 혼동하면 안 된다.

0-2 목적: 새 UI를 기존 custom UX와 맞추기 위함.
설명: `handleCustomStart`, `handleCustomPreflightStart`, `openCustomPreflight`, `handleUpdate` 연결을 확인한다.
완료 조건(눈으로 확인): 새 버튼이 끼어들 위치가 `Custom Update` 섹션으로 확정된다.
사람 검증(비개발자): 메뉴에서 기존 Custom 버튼 아래에 새 버튼이 들어갈 위치를 설명할 수 있다.
흔한 문제/주의: main update button의 last used config와 새 action type을 섞으면 반복 실행 UX가 헷갈릴 수 있다.

0-3 목적: backend 변경 범위를 최소화하기 위함.
설명: `getDefaultUniverseTickers()` 호출 지점을 찾아 optional filter를 넣을 위치를 정한다.
완료 조건(눈으로 확인): Finnhub와 FMP PR route에서 ticker list를 만드는 줄이 식별된다.
사람 검증(비개발자): “전체 ticker 대신 새 ticker subset만 넣는다”는 구조가 설명된다.
흔한 문제/주의: preflight만 subset이고 실제 실행은 전체 ticker가 되는 불일치를 막아야 한다.

0-4 목적: preflight modal 재사용 범위를 정하기 위함.
설명: 기존 `customPreflightData`가 어떤 필드를 보여주는지 확인한다.
완료 조건(눈으로 확인): 새 summary 필드가 기존 modal에 추가 가능한지 정리된다.
사람 검증(비개발자): 실행 전 대상 ticker 수와 sample을 볼 수 있어야 한다.
흔한 문제/주의: 대상 0개일 때 Continue가 떠서 빈 job을 시작하면 안 된다.

검증 훅:
```powershell
Invoke-RestMethod -Uri 'http://localhost:8080/api/tickers' | Select-Object -ExpandProperty rows | Select-Object -First 5 ticker,addedAt
```

사용자 확인 필요: **예**

#### ⏳ Step 1 — backend ticker subset helper

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `tickerAddedFrom` 날짜 validation 규칙 추가 | `terminal/backend/src/server.ts` | invalid date 400 확인 | ⏳ |
| 1-2 | default universe에서 `created_at >= tickerAddedFrom` ticker만 반환하는 helper 추가 | `terminal/backend/src/server.ts` 또는 `tickerUniverseRepository.ts` | DB count와 API count 비교 | ⏳ |
| 1-3 | helper가 sample ticker + addedAt를 함께 반환할 수 있게 summary 함수 추가 | `terminal/backend/src/server.ts` | preflight sample 확인 | ⏳ |
| 1-4 | `tickerAddedFrom`이 없으면 기존 전체 ticker list를 그대로 반환하도록 호환성 유지 | `terminal/backend/src/server.ts` | 기존 preflight 결과 변화 없음 | ⏳ |

1-1 목적: `from`/`to` 뉴스 날짜와 ticker 추가 기준 날짜를 구분하기 위함.
설명: `[][][]tickerAddedFrom[][][]`는 `YYYY-MM-DD`만 허용한다.
완료 조건(눈으로 확인): `tickerAddedFrom: "bad"` 요청이 400을 반환한다.
사람 검증(비개발자): 날짜 input에 `YYYY-MM-DD`만 넣으면 된다.
흔한 문제/주의: 기존 `from`을 재사용하면 뉴스 범위와 ticker 추가 기준이 섞인다.

1-2 목적: preflight와 실제 실행이 같은 ticker subset을 쓰게 하기 위함.
설명: default universe item의 `created_at`를 기준으로 ticker를 고른다.
완료 조건(눈으로 확인): SQL count와 helper 반환 count가 같다.
사람 검증(비개발자): Default Ticker Window에서 해당 날짜 이후 `Added Date`인 ticker만 대상이다.
흔한 문제/주의: SQLite `datetime('now')` 문자열은 `YYYY-MM-DD HH:mm:ss` 형태이므로 date prefix 비교/`date()` 처리 기준을 일관되게 써야 한다.

1-3 목적: 사용자에게 실행 전 대상 예시를 보여주기 위함.
설명: preflight summary에 ticker sample과 addedAt sample을 포함한다.
완료 조건(눈으로 확인): preflight JSON에 `selectedTickersSample`이 들어간다.
사람 검증(비개발자): 모달에서 어떤 ticker가 대상으로 잡혔는지 일부 볼 수 있다.
흔한 문제/주의: sample이 너무 길면 UI가 지저분하므로 최대 25~50개로 제한한다.

1-4 목적: 기존 버튼 회귀를 막기 위함.
설명: `tickerAddedFrom`이 없는 기존 custom/recent/7d 요청은 기존과 같은 ticker list를 사용한다.
완료 조건(눈으로 확인): 기존 `Custom Company News` preflight의 total tickers가 변경 전과 같다.
사람 검증(비개발자): 기존 버튼을 쓰는 사용자는 아무 차이를 느끼지 않는다.
흔한 문제/주의: optional field 추가가 schema default를 깨면 기존 요청이 실패할 수 있다.

검증 훅:
```powershell
$body = @{ mode='custom'; sourceType='company_news'; from='2026-05-01'; to='2026-05-11'; tickerAddedFrom='2026-05-01' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/pull-finhub/preflight-custom' -ContentType 'application/json' -Body $body
```

사용자 확인 필요: **예**

#### ⏳ Step 2 — backend route 연결

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `pull-finhub/preflight-custom`에 `tickerAddedFrom` subset 적용 | `terminal/backend/src/server.ts` | Company/Press preflight count 확인 | ⏳ |
| 2-2 | `pull-finhub` 실제 custom 실행에 같은 subset 적용 | `terminal/backend/src/server.ts` | job log의 selected ticker count 확인 | ⏳ |
| 2-3 | `pull-fmp-press-release/preflight-custom`에 `tickerAddedFrom` subset 적용 | `terminal/backend/src/server.ts` | FMP PR preflight count 확인 | ⏳ |
| 2-4 | `pull-fmp-press-release` 실제 custom 실행에 같은 subset 적용 | `terminal/backend/src/server.ts` | job log/result 확인 | ⏳ |
| 2-5 | job result/log에 `tickerAddedFrom`, selected/excluded count를 남김 | `terminal/backend/src/server.ts` | `GET /api/jobs/:jobId` 확인 | ⏳ |

2-1 목적: 실행 전 summary가 새 ticker subset 기준으로 계산되게 하기 위함.
설명: 기존 `buildTickerGapPlans()` 호출의 tickers 입력을 subset으로 좁힌다.
완료 조건(눈으로 확인): preflight `totalTickers`가 전체 default universe가 아니라 selected ticker 수로 나온다.
사람 검증(비개발자): 선택한 추가 기준 날짜를 바꾸면 대상 수가 변한다.
흔한 문제/주의: `sourceType=all`은 이번 UI 범위 밖이지만 schema 호환은 깨지지 않아야 한다.

2-2 목적: preflight와 실제 다운로드 대상 불일치를 막기 위함.
설명: 실제 `pull-finhub` job도 같은 helper로 ticker list를 만든다.
완료 조건(눈으로 확인): job log 첫머리에 selected ticker 수와 기준 날짜가 찍힌다.
사람 검증(비개발자): preflight에 나온 대상 수와 job log 대상 수가 같다.
흔한 문제/주의: Company News는 전용 concurrency setting을 유지해야 한다.

2-3 목적: FMP PR도 같은 UX를 갖게 하기 위함.
설명: FMP PR custom preflight에서 selected ticker list만 gap plan에 넣는다.
완료 조건(눈으로 확인): FMP PR preflight도 `tickerAddedFrom`을 응답한다.
사람 검증(비개발자): FMP PR 새 버튼도 같은 설정 모달과 preflight를 거친다.
흔한 문제/주의: FMP PR route에는 `sourceType`이 없으므로 body shape가 Finnhub와 다르다.

2-4 목적: FMP PR 실제 job이 전체 default universe를 돌지 않게 하기 위함.
설명: 기존 FMP PR `custom` / `custom-entire` 중 이번 버튼은 기존 `custom` gap-only 모드만 사용한다.
완료 조건(눈으로 확인): job log에 selected ticker count가 preflight와 같다.
사람 검증(비개발자): 새 버튼은 `Custom FMP PR`과 같은 full text 포함 흐름을 유지한다.
흔한 문제/주의: FMP PR fulltext persistence와 change merger를 끊으면 안 된다.

2-5 목적: 나중에 실행 이력을 추적할 수 있게 하기 위함.
설명: job result/details에 기준 날짜와 selected/excluded ticker 수를 저장한다.
완료 조건(눈으로 확인): `GET /api/jobs/:jobId` result에서 필드가 보인다.
사람 검증(비개발자): log panel에서 “몇 개 새 ticker를 대상으로 돌았는지” 확인 가능하다.
흔한 문제/주의: 결과에 너무 긴 ticker list를 넣으면 log가 비대해지므로 sample만 넣는다.

검증 훅:
```powershell
# preflight only: provider API 호출 없음
$body = @{ mode='custom'; sourceType='press_release'; from='2026-05-01'; to='2026-05-11'; tickerAddedFrom='2026-05-01' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/pull-finhub/preflight-custom' -ContentType 'application/json' -Body $body

$fmpBody = @{ mode='custom'; from='2026-05-01'; to='2026-05-11'; tickerAddedFrom='2026-05-01' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/pull-fmp-press-release/preflight-custom' -ContentType 'application/json' -Body $fmpBody
```

사용자 확인 필요: **예**

#### ⏳ Step 3 — News Window UI 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | Update 메뉴 `Custom Update` 섹션 아래에 새 버튼 3개 추가 | `FinnhubNewsWindow.tsx` | 버튼 렌더링 확인 | ⏳ |
| 3-2 | 새 ticker 전용 custom 설정 모달 추가 | `FinnhubNewsWindow.tsx` | 날짜 3개 입력/validation 확인 | ⏳ |
| 3-3 | modal submit 시 기존 preflight modal을 `tickerAddedFrom` 포함 payload로 호출 | `FinnhubNewsWindow.tsx` | preflight 응답 표시 확인 | ⏳ |
| 3-4 | Continue 시 기존 `handleUpdate('custom', ...)` 계열에 `tickerAddedFrom` 전달 | `FinnhubNewsWindow.tsx` | job 생성 payload 확인 | ⏳ |
| 3-5 | `lastUpdateConfig`와 main button 반복 동작이 기존 버튼을 깨지 않도록 정리 | `FinnhubNewsWindow.tsx` | 기존 main button 동작 확인 | ⏳ |

3-1 목적: 사용자가 기존 custom 버튼 옆에서 새 기능을 찾게 하기 위함.
설명: 버튼 이름은 `Custom New Tickers Company News`, `Custom New Tickers Press Release`, `Custom New Tickers FMP PR`로 제안한다.
완료 조건(눈으로 확인): News Window update menu에 새 버튼 3개가 보인다.
사람 검증(비개발자): “새로 추가된 ticker만”이라는 설명 문구가 버튼 아래에 보인다.
흔한 문제/주의: 메뉴가 너무 길어지므로 기존 scroll menu 높이 안에서 동작해야 한다.

3-2 목적: ticker 추가 기준과 뉴스 날짜 범위를 분리해 입력받기 위함.
설명: 모달에 `Ticker Added From`, `News From`, `News To` input을 둔다.
완료 조건(눈으로 확인): 빈 값/잘못된 날짜에서 Start가 막히거나 error가 보인다.
사람 검증(비개발자): “2026-05-01 이후 추가한 ticker의 2026-05-01~2026-05-11 뉴스”처럼 입력 의미가 명확하다.
흔한 문제/주의: `Ticker Added From`과 `News From`을 같은 값으로 자동 고정하지 않는다. 둘은 독립 필드다.

3-3 목적: 큰 다운로드 전 사용자가 대상 수를 확인하게 하기 위함.
설명: 기존 `openCustomPreflight()`를 확장해 `tickerAddedFrom`을 넘기고, modal title에 `Custom New Tickers`를 표시한다.
완료 조건(눈으로 확인): preflight modal에 selected ticker count와 sample이 보인다.
사람 검증(비개발자): 대상 ticker가 0개면 Continue하지 않는다.
흔한 문제/주의: 기존 preflight modal이 새 필드를 모르면 `[object Object]`처럼 깨질 수 있다.

3-4 목적: preflight에서 확인한 조건 그대로 실행하기 위함.
설명: Continue callback이 `from`, `to`, `tickerAddedFrom`을 모두 들고 실제 route를 호출한다.
완료 조건(눈으로 확인): Network payload에 `tickerAddedFrom`이 포함된다.
사람 검증(비개발자): 실행 log에 같은 기준 날짜가 보인다.
흔한 문제/주의: `handleUpdate` 함수 signature 변경 시 기존 호출부를 모두 확인해야 한다.

3-5 목적: 기존 “마지막 update 반복” 버튼 UX를 깨지 않기 위함.
설명: 새 action을 last config에 넣을지, 별도 반복 불가 action으로 둘지 결정한다. 기본안은 별도 action으로 두고 main button 반복 대상에는 넣지 않는다.
완료 조건(눈으로 확인): 기존 Custom/Recent 버튼을 사용한 뒤 main button label이 이전처럼 동작한다.
사람 검증(비개발자): 새 기능은 드롭다운에서 명시적으로 실행한다.
흔한 문제/주의: main button이 새 action을 반복하려면 `tickerAddedFrom` 저장까지 필요하므로 실수 재실행 위험이 있다.

검증 훅:
```text
- Vite dev 화면에서 News Window > Update menu 열기
- 새 버튼 3개 표시 확인
- Custom New Tickers Company News 클릭
- Ticker Added From / News From / News To 입력
- Preflight modal에 selected ticker count + sample 표시 확인
```

사용자 확인 필요: **예**

#### ⏳ Step 4 — 문서/스펙 동기화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | frontend prompt에 새 버튼/모달/local behavior 설명 추가 | `figma_frontend_prompt.md` | 관련 섹션 검색 | ⏳ |
| 4-2 | backend prompt에 request/response field와 route 동작 추가 | `terminal/backend_prompt.md` | API section 검색 | ⏳ |
| 4-3 | 필요 시 repo memory에 구현 후 운영 메모 저장 | `/memories/repo/` | memory 내용 확인 | ⏳ |

4-1 목적: UI 동작 설명과 실제 구현을 맞추기 위함.
설명: News Window update menu 문서에 새 버튼과 입력 필드를 추가한다.
완료 조건(눈으로 확인): `Custom New Tickers` 키워드로 문서 검색이 된다.
사람 검증(비개발자): 어떤 날짜를 어디에 넣는지 문서로 확인 가능하다.
흔한 문제/주의: 화면에 없는 사용법 안내를 과하게 넣지 않는다.

4-2 목적: backend API contract drift를 막기 위함.
설명: `tickerAddedFrom`, selected ticker summary, preflight/result 필드를 문서화한다.
완료 조건(눈으로 확인): backend prompt의 `/api/news/pull-*` 설명에 새 optional field가 있다.
사람 검증(비개발자): API payload 예시만 봐도 기능 범위가 이해된다.
흔한 문제/주의: `from` 뉴스 날짜와 `tickerAddedFrom` 기준 날짜를 섞어 쓰지 않는다.

4-3 목적: 나중에 같은 기능을 다시 만질 때 기준을 빠르게 복구하기 위함.
설명: 구현 완료 후 핵심 사실만 짧게 repository memory에 저장한다.
완료 조건(눈으로 확인): memory 파일에 route/field/검증 명령이 간략히 남는다.
사람 검증(비개발자): 다음 작업 때 “새 ticker pull은 tickerAddedFrom”이라는 사실을 찾을 수 있다.
흔한 문제/주의: memory에는 긴 plan 전체를 복사하지 않고 핵심만 저장한다.

검증 훅:
```powershell
Select-String -Path 'termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md' -Pattern 'Custom New Tickers|tickerAddedFrom'
Select-String -Path 'terminal/backend_prompt.md' -Pattern 'tickerAddedFrom|selectedTickerCount'
```

사용자 확인 필요: **예**

#### ⏳ Step 5 — 검증과 회귀 확인

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 정적 오류 확인 | 변경 파일 전체 | `get_errors` 0개 | ⏳ |
| 5-2 | backend build/test 실행 | `terminal/backend` | `npm run build`, `npm run test` | ⏳ |
| 5-3 | frontend build 실행 | webui package | `npm run build` | ⏳ |
| 5-4 | preflight API runtime 검증 | backend dev | 실제 `Invoke-RestMethod` | ⏳ |
| 5-5 | browser UI runtime 검증 | frontend dev | Playwright/브라우저 확인 | ⏳ |
| 5-6 | 실제 pull job 최소 범위 검증 또는 실행 제한 사유 기록 | backend dev | job 생성/로그 또는 API key/rate limit 사유 | ⏳ |

5-1 목적: 타입/문법 회귀를 먼저 잡기 위함.
설명: 변경한 TS/MD 파일의 VS Code diagnostics를 확인한다.
완료 조건(눈으로 확인): 관련 파일 `No errors found`.
사람 검증(비개발자): 에러 배지가 없어야 한다.
흔한 문제/주의: frontend type은 build 때만 잡히는 경우가 있으므로 build도 필수다.

5-2 목적: backend route/schema 변경이 전체 빌드와 테스트를 통과하는지 확인하기 위함.
설명: backend workspace에서 build/test를 실행한다.
완료 조건(눈으로 확인): exit code 0.
사람 검증(비개발자): terminal에 failed test가 없어야 한다.
흔한 문제/주의: 기존 unrelated test failure가 있으면 이번 변경과 관련 여부를 분리해 보고한다.

5-3 목적: News Window UI 변경이 production bundle에서도 깨지지 않는지 확인하기 위함.
설명: webui `npm run build`를 실행한다.
완료 조건(눈으로 확인): Vite build 성공.
사람 검증(비개발자): chunk size warning은 기존 경고면 실패로 보지 않는다.
흔한 문제/주의: 버튼 추가로 import 누락이 생기기 쉽다.

5-4 목적: provider API 호출 없이 핵심 대상 산정을 검증하기 위함.
설명: preflight endpoint에 `tickerAddedFrom`을 넣어 selected count/sample을 확인한다.
완료 조건(눈으로 확인): 응답이 200이고 selected ticker count가 DB query와 일치한다.
사람 검증(비개발자): 날짜를 바꾸면 대상 수가 달라진다.
흔한 문제/주의: 날짜가 너무 최근이면 0개가 나올 수 있다. 이 경우 더 과거 날짜로 재검증한다.

5-5 목적: 실제 사용자 흐름을 확인하기 위함.
설명: 브라우저에서 Update menu → 새 버튼 → 모달 → preflight modal까지 확인한다.
완료 조건(눈으로 확인): 화면에서 대상 ticker 수와 Continue/Cancel이 보인다.
사람 검증(비개발자): 사용자가 같은 클릭 흐름을 재현 가능하다.
흔한 문제/주의: 기존 modal과 새 modal이 동시에 열려 focus/overlay가 꼬일 수 있다.

5-6 목적: 실제 다운로드 job까지 이어지는지 확인하기 위함.
설명: API key와 rate limit이 허용되면 `maxTickers=1` 또는 대상 1개 기준으로 job 생성 후 log를 확인한다. 어려우면 preflight 검증까지 완료하고, 실제 provider 호출 제한 사유를 기록한다.
완료 조건(눈으로 확인): job log에 `tickerAddedFrom`과 selected ticker count가 찍힌다.
사람 검증(비개발자): log panel에서 새 ticker subset 실행임을 확인 가능하다.
흔한 문제/주의: 실제 provider 호출은 비용/limit이 있으므로 범위를 좁혀야 한다.

검증 훅:
```powershell
cd terminal/backend
npm.cmd run build
npm.cmd run test

cd ..\..\termina_web\figma_code\terminal_ui_ver2_finhub
npm.cmd run build

$body = @{ mode='custom'; sourceType='company_news'; from='2026-05-01'; to='2026-05-11'; tickerAddedFrom='2026-05-01' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/pull-finhub/preflight-custom' -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 6
```

사용자 확인 필요: **예**

---

### 미확정 사항(명시 결정 필요)

PLAN CHANGE — 2026-05-11: 사용자가 기존 Custom 버튼과 같은 동작임을 바로 알 수 있도록 새 버튼/섹션/모달/preflight title의 표시명을 `New Tickers ...`에서 `Custom New Tickers ...`로 변경한다. Update menu에서는 `Custom Market News`보다 앞에 배치해 더 쉽게 찾을 수 있게 한다. API contract와 backend 동작은 그대로 유지한다.

| 결정 ID | 미확정 내용 | 선택지 | 차단 대상 Step |
|---------|-------------|--------|----------------|
| U1 | 새 버튼 이름 | A. `Custom New Tickers Company News` 계열, B. `Added Tickers Company News` 계열 | Step 3 |
| U2 | main update button 반복 대상 포함 여부 | A. 제외(제안), B. 포함 + 마지막 `tickerAddedFrom/newsFrom/newsTo` 저장 | Step 3-5 |
| U3 | `tickerAddedFrom` 기본값 | A. 빈 값(사용자 필수 입력), B. 최근 7일, C. 가장 최근 addedAt 날짜 | Step 3-2 |
| U4 | 대상 0개 preflight에서 Continue 표시 | A. 숨김/disabled(제안), B. 표시하되 실행 시 400 | Step 3-3 |

---

### 실행 의존성 그래프

범례:

- `✅` 사용자 확인 후 완료
- `⏳` 구현 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족

```text
트랙 A — Backend 대상 산정 / API
⏳ Step 0 기존 흐름 감사
  ⏳ 0-1 addedAt source/API 확인
  ⏳ 0-2 custom UI 흐름 확인
  ⏳ 0-3 backend ticker list 생성 지점 확인
  ⏳ 0-4 preflight 표시 방식 확인
      |
      v
⏳ Step 1 backend ticker subset helper
  ⏳ 1-1 tickerAddedFrom validation
  ⏳ 1-2 added date filter helper
  ⏳ 1-3 summary/sample 함수
  ⏳ 1-4 기존 요청 호환성 유지
      |
      v
⏳ Step 2 backend route 연결
  ⏳ 2-1 Finnhub preflight subset
  ⏳ 2-2 Finnhub 실제 실행 subset
  ⏳ 2-3 FMP PR preflight subset
  ⏳ 2-4 FMP PR 실제 실행 subset
  ⏳ 2-5 job result/log 필드

트랙 B — Frontend UX
⏳ Step 0 기존 흐름 감사
      |
      v
⏳ Step 3 News Window UI 추가
  ⏳ 3-1 새 버튼 3개
  ⏳ 3-2 새 설정 모달
  ⏳ 3-3 preflight payload 연결
  ⏳ 3-4 Continue 실행 payload 연결
  ⏳ 3-5 main button 반복 동작 정리

트랙 C — 문서 / 검증
⏳ Step 4 문서/스펙 동기화
  ⏳ 4-1 frontend prompt
  ⏳ 4-2 backend prompt
  ⏳ 4-3 repo memory
      |
      v
⏳ Step 5 검증과 회귀 확인
  ⏳ 5-1 정적 오류
  ⏳ 5-2 backend build/test
  ⏳ 5-3 frontend build
  ⏳ 5-4 preflight API runtime
  ⏳ 5-5 browser UI runtime
  ⏳ 5-6 최소 실제 pull 또는 제한 사유
```

병렬 트랙 요약:

- Step 1과 Step 3은 Step 0 이후 병렬 설계가 가능하지만, 실제 구현은 Step 1의 API contract를 먼저 고정한 뒤 Step 3을 진행하는 편이 안전하다.
- Step 4 문서는 Step 2/3 구현과 동시에 업데이트한다.
- Step 5는 모든 코드/문서 변경 후 마지막에 실행한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| U1 버튼 이름 | Step 3-1 | 기본안: `Custom New Tickers ...` |
| U2 main button 반복 포함 여부 | Step 3-5 | 기본안: 반복 대상 제외 |
| U3 tickerAddedFrom 기본값 | Step 3-2 | 기본안: 사용자 필수 입력 |
| U4 대상 0개 처리 | Step 3-3 | 기본안: Continue disabled |

---

### 결정 #1 — 날짜 기준과 경계(상세)

`tickerAddedFrom`은 date-only 값이다. backend에서는 default universe item의 `created_at`를 날짜 단위로 비교한다.

운영적 정의:

- 입력: `tickerAddedFrom = YYYY-MM-DD`
- 대상: `ticker_universe_items.created_at`가 존재하는 현재 default universe item
- 포함 규칙: `date(created_at) >= tickerAddedFrom`
- 제외 규칙: `date(created_at) < tickerAddedFrom`
- 출력: 조건을 만족하는 ticker list + sample `{ ticker, addedAt }`

예시 1:

- `SLP addedAt = 2026-05-06 12:47:16`
- 사용자가 `tickerAddedFrom = 2026-05-06` 입력
- 결과: 포함

예시 2:

- `DGXX addedAt = 2026-05-05 12:36:48`
- 사용자가 `tickerAddedFrom = 2026-05-06` 입력
- 결과: 제외

체크 항목:

- Default Ticker Window에서 `Recent Added`로 정렬했을 때 `tickerAddedFrom` 이상 날짜 row만 API preflight sample에 나와야 한다.
- `tickerAddedFrom`을 하루 앞당기면 selected ticker count가 같거나 늘어야 한다.

---

### 결정 #2 — 새 버튼 UX(상세)

제안 버튼:

- `Custom New Tickers Company News`
- `Custom New Tickers Press Release`
- `Custom New Tickers FMP PR`

모달 입력:

| 입력 | 의미 | 필수 | 예시 |
|------|------|------|------|
| `Ticker Added From` | 이 날짜 이후 default universe에 추가된 ticker만 대상 | 예 | `2026-05-01` |
| `News From` | 다운로드할 뉴스 시작 날짜 | 예 | `2026-05-01` |
| `News To` | 다운로드할 뉴스 종료 날짜 | 예 | `2026-05-11` |

흐름:

1. 사용자가 새 버튼 클릭.
2. 설정 모달에서 3개 날짜 입력.
3. Start 클릭.
4. preflight API 호출.
5. preflight modal에서 대상 ticker 수/sample/gap summary 확인.
6. Continue 클릭.
7. 기존 custom job 흐름으로 다운로드 시작.

기본안:

- 새 버튼은 main repeat button의 last used config에 넣지 않는다.
- 사용자가 명시적으로 드롭다운에서 새 버튼을 눌러야 실행된다.
- 대상 ticker 0개면 Continue를 비활성화한다.
