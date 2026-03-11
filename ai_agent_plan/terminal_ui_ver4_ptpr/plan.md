# Plan — terminal_ui_ver4_ptpr

> ℹ️ 이 문서는 2026-03-10 기준 PTPR API 조사/연동 계획이다. 현재 1차 목표는 “PTPR API로 실제 받을 수 있는 데이터 타입을 먼저 확정”하는 것이다.

### 목표
- PTPR API 키가 실제로 동작하는지 검증한다.
- 오늘 날짜 기준 `2026-03-10`의 press 관련 데이터를 어떤 endpoint로 받을 수 있는지 확인한다.
- 단순 “응답이 왔다” 수준이 아니라, **실제 확인된 데이터 타입 목록**을 probe 결과 기준으로 정리한다.
- RTPR 뉴스 시각은 레포 내부 표준으로 **무조건 ET(`America/New_York`)로 변환**한다는 규칙을 명시한다.
- RTPR가 press release 전용인지, 아니면 별도 market news를 주는지도 범위를 확정한다.
- 조사 결과를 레포 문서에 반영하여, 이후 backend/provider 구현의 출발점을 만든다.

### 현재 레포 상태(중요, 확인됨)
- `ai_agent_plan/ptpr_api_key/ptpr_api_key` 파일이 존재하며 비어 있지 않음을 확인했다.
- 현재 레포에는 `PTPR`/`ptpr` 명시 provider 코드, 설정, 문서, 테스트가 없다.
- `.github/copilot-skills/repo-context.md`에는 2026-03-10 이전까지 PTPR 관련 경로/조사 상태가 정리되어 있지 않았다.
- 공식 문서는 `https://www.rtpr.io/docs`로 확인됐다.
- 실제 API base URL은 `https://api.rtpr.io`, WebSocket URL은 `wss://ws.rtpr.io`다.
- 인증 방식은 REST `Authorization: Bearer <API_KEY>`, WebSocket query `apiKey=<API_KEY>`다.
- 실제 probe 결과:
  - `GET /articles?limit=100` 성공, 최근 100건 모두 `2026-03-10` UTC 기사였다.
  - `GET /articles/AAPL?limit=5`는 당시 시점 기준 `count=0`이었다.
  - WebSocket 연결 후 `connected`, `subscribed` 메시지를 실제 수신했다.
- 문서 예시는 `created`를 `-0400` ET offset 형태로도 보여주지만, live REST는 `Z` UTC timestamp를 반환했다.
- 따라서 원본 포맷과 무관하게 레포 내부 canonical 시각은 ET로 통일한다.
- 공식 문서와 현재 probe 기준 RTPR 범위는 major wire services의 press release feed이며, 별도 market news endpoint는 확인되지 않았다.
- `.github/copilot-skills/ptpr_api.md`를 새로 만들어 이후 코드 작성 시 참고 기준으로 삼는다.

### 제약 / 비범위
- 시크릿 값 자체는 문서, 로그, 콘솔 요약에 노출하지 않는다.
- provider base URL/spec이 확인되기 전에는 임의 endpoint를 대량 호출하는 식의 추측성 구현은 하지 않는다.
- 이번 plan의 1차 범위는 “데이터 타입 discovery + 최소 probe + 문서 반영”이다.
- backend 정식 provider 구현, DB 적재, 프론트 UI 추가는 이번 1차 plan의 비범위다.
- 이번 조사 기준으로 RTPR를 일반 market news provider로 확장 해석하지 않는다.

### 읽는 방법(비개발자/일반인 기준)
- 이 plan은 “PTPR API를 붙이기 전에, 무엇을 실제로 받을 수 있는지 확인하는 문서”다.
- 각 Step은 눈으로 확인 가능한 결과물을 가진다.
- 상태 이모지 의미:
  - `✅` 구현 + 사용자 확인 완료
  - `⏳` 구현/조사 완료, 사용자 확인 대기
  - `⬜` 미착수
  - `🚫` 선행조건 미충족으로 차단
- 지금 문서에서 가장 중요한 부분은 두 가지다.
  - `현재 레포 상태`: 지금 무엇이 확인됐는지
  - `미확정 사항`: 왜 다음 probe가 막혀 있는지

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- plan이 바뀌면 기존 내용을 지우지 않고 변경 이유를 `agent_log.md`에 append한다.
- 각 Step은 `구현/조사 → 검증 → 사용자 확인 요청` 순서로 진행한다.
- 사용자 확인 전 상태는 `⏳`로 유지한다.
- provider base URL/spec 같은 선행조건이 없으면 해당 Step은 `🚫`로 둔다.

### 아키텍처(상위)
- 시크릿 입력: `ai_agent_plan/ptpr_api_key/ptpr_api_key`
- 조사 문서:
  - `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`
  - `ai_agent_plan/terminal_ui_ver4_ptpr/agent_log.md`
- 레포 컨텍스트 반영:
  - `.github/copilot-skills/repo-context.md`
- 예상 다음 단계(이번 plan 범위 밖):
  - provider spec 확정 후 `terminal/backend/src/services/ptpr...` 계열 provider 추가
  - 응답 정규화 후 runtime DB 또는 별도 canonical 저장 전략 결정

### 결정/선행조건(초기에 확정 필요)
1. **PTPR provider 공식 base URL / 문서 위치**
   - 없으면 실제 endpoint probe가 차단된다.
2. **인증 방식**
   - `x-api-key` header인지, `Authorization: Bearer`인지, query param인지 확인 필요.
3. **오늘(3/10) press 데이터 조회 파라미터 규칙**
   - 날짜 포맷, timezone, symbol 필수 여부, pagination 규칙 필요.
4. **내부 시각 표준화 규칙**
  - RTPR 원본 timestamp 포맷이 UTC/Z 또는 ET offset이어도, 내부 canonical 시각은 ET로 고정한다.

### 계획 중간 필수 확인
- 1차 discovery에서 아래 4가지를 반드시 확보해야 한다.
  - base URL
  - auth 방식
  - 문서 또는 discovery endpoint
  - press 관련 최소 1개 endpoint의 실제 응답 구조
- 위 4개 중 하나라도 빠지면 backend 구현 단계로 넘어가지 않는다.

### 제안하는 구현 순서(이유)
1. 시크릿 존재/레포 부재 상태를 먼저 고정한다.
   - 왜: 추측 구현을 막고 현재 출발점을 문서화해야 한다.
2. provider spec/base URL을 확보한다.
   - 왜: 이 단계가 없으면 모든 probe가 추측이 된다.
3. 실제 API probe로 데이터 타입을 분류한다.
   - 왜: 이후 provider 구현 시 어떤 DTO/DB 구조가 필요한지 결정할 수 있다.
4. repo-context와 agent log에 결과를 반영한다.
   - 왜: 후속 작업자가 같은 discovery를 반복하지 않게 하기 위해서다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 현재 상태 고정 및 1차 조사 기록

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | PTPR 키 파일 존재 및 비어 있지 않음 확인 | `ai_agent_plan/ptpr_api_key/ptpr_api_key` | 키 내용 비노출 상태에서 존재 여부만 확인 | ⏳ |
| 0-2 | 레포 내 PTPR 연동 코드/문서 부재 확인 | workspace 전역 | `PTPR|ptpr` 검색 결과 검토 | ⏳ |
| 0-3 | 공개 검색 기반 provider 식별 1차 시도 | 외부 web probe | provider 공식 base URL 미식별 여부 기록 | ⏳ |
| 0-4 | repo-context와 plan/log에 현재 상태 반영 | `.github/copilot-skills/repo-context.md`, `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`, `ai_agent_plan/terminal_ui_ver4_ptpr/agent_log.md` | 문서 diff 확인 | ⏳ |

- `0-1` 목적: 시크릿이 실제로 준비됐는지 확인. 설명: 키 값은 노출하지 않고 파일 존재/비어 있지 않음만 확인하면 완료다.
  - 완료 조건(눈으로 확인): 로그/보고에 “파일 존재, 비어 있지 않음”이 남는다.
  - 사람 검증(비개발자): 키 파일이 해당 경로에 있는지만 확인한다.
  - 흔한 문제/주의: 줄바꿈만 있는 파일을 정상으로 오인할 수 있다.
- `0-2` 목적: 기존 구현 재사용 가능성 확인. 설명: 이미 provider가 있으면 discovery 범위가 줄어든다.
  - 완료 조건(눈으로 확인): 기존 ptpr provider 파일이 없다는 결론이 기록된다.
  - 사람 검증(비개발자): 검색 결과에 실질적인 ptpr 코드가 없는지 확인한다.
  - 흔한 문제/주의: `ptpr`가 다른 단어 일부로 섞여 false positive가 날 수 있다.
- `0-3` 목적: 공개 정보만으로 바로 probe 가능한지 판단. 설명: 공식 문서나 base URL을 찾지 못하면 차단 요인으로 승격한다.
  - 완료 조건(눈으로 확인): “공개 검색만으로 공식 spec 미식별”이 기록된다.
  - 사람 검증(비개발자): 검색 결과가 provider docs를 직접 가리키지 않는지 확인한다.
  - 흔한 문제/주의: 검색 엔진 노이즈를 실제 evidence로 오판하면 안 된다.
- `0-4` 목적: 현재 상태를 레포 기준 문서에 고정. 설명: 다음 작업자가 같은 출발점에서 이어가게 만든다.
  - 완료 조건(눈으로 확인): `repo-context.md`, `plan.md`, `agent_log.md`에 같은 결론이 반영된다.
  - 사람 검증(비개발자): 세 문서에 “키는 있음, spec/base URL은 아직 미확정”이 보인다.
  - 흔한 문제/주의: 문서 한 곳만 바뀌고 다른 곳이 누락되면 상태가 드리프트한다.

검증 훅:
```powershell
Get-Date -Format "yyyy-MM-dd HH:mm"
# 키 값은 출력하지 않고 존재/비어 있지 않음만 확인
$keyPath = 'c:\github_coding\terminal_sec\ai_agent_plan\ptpr_api_key\ptpr_api_key'
if (Test-Path $keyPath) { $content = Get-Content -Path $keyPath -TotalCount 1; if ([string]::IsNullOrWhiteSpace($content)) { 'EMPTY' } else { 'PRESENT' } } else { 'MISSING' }
# 레포 검색
rg -n "PTPR|ptpr" c:\github_coding\terminal_sec
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — provider spec/base URL 확보

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 공식 문서 또는 base URL 확보 | (외부 정보) | 공식 문서 URL 또는 base URL 확보 | ⏳ |
| 1-2 | auth 방식 확인 | (외부 정보) | header/query/bearer 방식 명시 | ⏳ |
| 1-3 | discovery 가능 endpoint 확인 | (외부 정보) | swagger/openapi/docs/health 중 1개 이상 확인 | ⏳ |
| 1-4 | endpoint 후보 매트릭스 정리 | `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md` | press 관련 endpoint 후보표 작성 | ⏳ |

- `1-1` 목적: probe 대상 고정. 설명: base URL 없이 실제 API 호출은 의미가 없다.
  - 완료 조건(눈으로 확인): 정확한 hostname/path root가 문서에 적힌다.
  - 사람 검증(비개발자): vendor 문서나 메일에서 URL을 확인할 수 있다.
  - 흔한 문제/주의: 웹사이트 URL과 API URL을 혼동할 수 있다.
- `1-2` 목적: 인증 실패 루프 방지. 설명: 키 형식만 보고 auth 방식을 추측하지 않는다.
  - 완료 조건(눈으로 확인): 요청 예시에서 auth 위치가 명시된다.
  - 사람 검증(비개발자): vendor 문서의 인증 예시와 일치하는지 본다.
  - 흔한 문제/주의: query key와 header key를 바꿔 쓰면 401/403만 반복된다.
- `1-3` 목적: 문서 기반 discovery 시작점 확보. 설명: Swagger나 docs endpoint가 있으면 endpoint 목록 수집이 쉬워진다.
  - 완료 조건(눈으로 확인): 최소 1개의 discovery endpoint가 기록된다.
  - 사람 검증(비개발자): 브라우저에서 문서 페이지가 열리는지 확인한다.
  - 흔한 문제/주의: 사람이 보는 docs와 실제 운영 hostname이 다를 수 있다.
- `1-4` 목적: 무작정 호출 대신 endpoint 후보를 관리. 설명: press, metadata, lookup, attachments 등 타입별 후보를 표로 정리한다.
  - 완료 조건(눈으로 확인): 실제 문서에 존재하는 press release endpoint 범위가 정리된다.
  - 사람 검증(비개발자): 표에 설명과 목적이 붙어 있는지 확인한다.
  - 흔한 문제/주의: 문서에 없는 market/news 타입을 추정해서 후보표를 부풀리면 안 된다.

검증 훅:
```powershell
# vendor 문서 또는 base URL 확보 후 실행
Invoke-WebRequest -UseBasicParsing -Uri '<PTPR_BASE_URL_OR_DOCS>'
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — 실제 API probe 및 데이터 타입 카탈로그 작성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | 최소 인증 성공 요청 1건 수행 | (런타임) | 200 또는 문서상 예상 응답 확인 | ⏳ |
| 2-2 | 오늘(2026-03-10) press 관련 endpoint probe | (런타임) | 3/10 기준 row 또는 빈 결과/권한 결과 확인 | ⏳ |
| 2-3 | 응답 구조별 데이터 타입 분류 | `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md` | type catalog 작성 | ⏳ |
| 2-4 | repo-context.md에 확인된 타입 반영 | `.github/copilot-skills/repo-context.md` | 확인된 타입 섹션 업데이트 | ⏳ |

- `2-1` 목적: 키가 실제 API에서 통하는지 확인. 설명: 인증이 실패하면 이후 타입 분류는 모두 무효다.
  - 완료 조건(눈으로 확인): 401/403이 아닌 최소 1개 성공 응답이 있다.
  - 사람 검증(비개발자): 응답 코드와 간단한 body 요약이 기록된다.
  - 흔한 문제/주의: 성공처럼 보여도 HTML landing page일 수 있다.
- `2-2` 목적: 사용자가 요구한 today press 검증 수행. 설명: `2026-03-10` 기준 press 데이터의 존재 여부와 쿼리 규칙을 확인한다.
  - 완료 조건(눈으로 확인): 실제 응답 예시 또는 빈 배열/권한 제한 결과가 남는다.
  - 사람 검증(비개발자): 날짜를 바꿔도 같은 endpoint 규칙이 유지되는지 확인한다.
  - 흔한 문제/주의: timezone 차이로 3/10 데이터가 3/09 또는 3/11로 보일 수 있으므로 내부 표준은 ET로 통일해야 한다.
- `2-3` 목적: backend 설계 입력값 생성. 설명: 응답 필드를 “실제 확인된 타입” 기준으로 묶어 정리한다.
  - 완료 조건(눈으로 확인): press item과 WebSocket message 타입표가 작성된다.
  - 사람 검증(비개발자): 표에 각 타입의 예시 필드가 적혀 있다.
  - 흔한 문제/주의: 문서에 없는 market news 타입을 이미 지원하는 것처럼 적으면 안 된다.
- `2-4` 목적: 레포 기준 문서 최신화. 설명: 후속 구현자는 repo-context만 보고도 출발할 수 있어야 한다.
  - 완료 조건(눈으로 확인): repo-context에 PTPR 타입/저장전략 초안이 추가된다.
  - 사람 검증(비개발자): PTPR 섹션만 읽어도 무엇을 받을 수 있는지 이해된다.
  - 흔한 문제/주의: “문서상 가능”과 “실제 key로 확인됨”을 구분하지 않으면 안 된다.

검증 훅:
```powershell
# 실제 probe 예시
$headers = @{ Authorization = 'Bearer <masked>' }
Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri 'https://api.rtpr.io/articles?limit=5'
Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri 'https://api.rtpr.io/articles/AAPL?limit=5'
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. `D-1` REST 저장 전략
  - 선택지: 기존 `news_items` 공용 적재 / RTPR 전용 테이블 / 별도 raw+normalized 이중 저장
  - 차단 대상 Step: 후속 구현 단계
2. `D-2` WebSocket 운영 전략
  - 선택지: 서버 1개 연결 fan-out / 배치성 REST만 사용 / hybrid
  - 차단 대상 Step: 후속 구현 단계
3. `D-3` dedup key
  - 선택지: WS `id` 우선 / `ticker+created+title` / 본문 hash 포함
  - 차단 대상 Step: 후속 구현 단계
4. `D-4` ET canonical 컬럼 정책
  - 선택지: `created` overwrite / `created_raw` + `created_et` 병행 저장
  - 차단 대상 Step: 후속 구현 단계

### 실행 의존성 그래프
Legend: `✅` 완료+사용자확인 완료 / `⏳` 완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 차단

트랙 A — 현재 상태 고정
```text
⏳ Step 0 현재 상태 고정
  ⏳ 0-1 키 파일 존재/비어있지 않음 확인
  ⏳ 0-2 레포 내 PTPR 연동 부재 확인
  ⏳ 0-3 공개 검색 기반 provider 식별 1차 시도
  ⏳ 0-4 repo-context + plan + agent_log 반영

⏳ Step 1 provider spec/base URL 확보
  ⏳ 1-1 공식 문서 또는 base URL 확보
  ⏳ 1-2 auth 방식 확인
  ⏳ 1-3 discovery endpoint 확인
  ⏳ 1-4 endpoint 후보 매트릭스 정리

⏳ Step 2 실제 API probe 및 데이터 타입 카탈로그
  ⏳ 2-1 최소 인증 성공 요청 1건 수행
  ⏳ 2-2 오늘(2026-03-10) press endpoint probe
  ⏳ 2-3 응답 구조별 데이터 타입 분류
  ⏳ 2-4 repo-context에 확인된 타입 반영

┌────────────────────────────────────────────────────────────┐
│ 현재 남은 차단: 구현 설계 결정 미확정                     │
│ 이유: 저장 스키마, WS 운영 방식, dedup 기준이 아직 미정   │
└────────────────────────────────────────────────────────────┘
```

병렬 트랙 요약
- 현재 Step 0~2는 조사와 문서화 기준으로 모두 수행 완료 상태이며 사용자 확인만 남아 있다.
- 다음 병렬 가능 영역은 후속 구현 단계에서 `REST provider`와 `WebSocket consumer` 설계 분기다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| `D-1` REST 저장 전략 | 후속 구현 | `news_items` 공용 / RTPR 전용 / raw+normalized |
| `D-2` WebSocket 운영 전략 | 후속 구현 | server singleton / REST only / hybrid |
| `D-3` dedup key | 후속 구현 | ws id / ticker+created+title / hash 포함 |

### 결정 #1 — PTPR discovery 출발점(상세)
- 현재 확인 사실:
  - 키 파일은 있다.
  - 레포에는 provider 연동이 없다.
  - 공식 docs는 `https://www.rtpr.io/docs`로 확인됐다.
  - 실제 API와 WebSocket endpoint도 확인됐다.

### PLAN CHANGE — 2026-03-11 당일 change/진행률 규칙 보강

- 배경: RTPR/PTPR 기사에 대해 `published_at` 날짜와 `ohlc_date`가 같더라도, ET 장 종료 전이면 same-day change가 UI에 노출되면 안 된다는 운영 규칙이 추가됐다.
- 추가 요구사항:
  - `POST /api/news/change/update-recent`
  - `POST /api/news/change/update-custom`
  - RTPR ingest 후 `mergeChangeForNewItems()`
  - 위 세 경로 모두에서 **ET 시장일 기준 same-day change는 ET 16:00 이전 비저장**으로 동작해야 한다.
  - `GET /api/jobs/:jobId`의 running progress는 최종 완료 전 `100%`를 보여주면 안 된다.

#### ⏳ Step 3 — same-day change 차단 + job progress 의미 보정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `published_at`를 ET 시장일로 해석하는 helper를 추가하고 same-day gating 기준을 ET로 통일 | `terminal/backend/src/services/newsChangeMerger.ts` | Vitest `newsChangeMerger.test.ts`에서 UTC/ET-naive 입력 모두 ET 날짜로 해석되는지 확인 | ⏳ |
| 3-2 | 현재 ET 시장일 기사에 대해 ET 16:00 이전에는 same-day metric 저장을 막고, 기존 stale metric도 삭제 | `terminal/backend/src/services/newsChangeMerger.ts` | Vitest + runtime에서 3/11 RTPR 행의 change 값이 null인지 확인 | ⏳ |
| 3-3 | running 상태 job progress는 99% 상한, 완료 처리 후에만 100% 전환 | `terminal/backend/src/services/jobManager.ts` | Vitest `jobManager.test.ts`에서 running 99 → done 100 확인 | ⏳ |
| 3-4 | ET 장중에는 canonical OHLC DB에도 당일 일봉을 저장/참조하지 않도록 보강 | `terminal/backend/src/services/ohlcWatchlistRepository.ts`, `terminal/backend/src/services/newsChangeMerger.ts` | Vitest `ohlcWatchlistRepository.test.ts` + runtime에서 `OHLC_data` 3/11 row count가 0인지 확인 | ⏳ |
| 3-5 | backend spec 문서와 작업 로그에 새 규칙 반영 | `terminal/backend_prompt.md`, `ai_agent_plan/terminal_ui_ver4_ptpr/agent_log.md`, `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md` | 문서 diff와 agent_log append 확인 | ⏳ |

- `3-1` 목적: 소스별 timestamp 포맷이 달라도 같은 시장일 규칙으로 비교하게 만들기. 설명: UTC ISO는 ET로 변환하고, RTPR ET-naive는 그대로 ET로 간주하면 완료다.
  - 완료 조건(눈으로 확인): helper가 UTC 입력 `2026-03-11T00:30:00Z`를 ET 날짜 `2026-03-10`으로 바꾼다.
  - 사람 검증(비개발자): 테스트 이름에 UTC→ET 변환 케이스가 보인다.
  - 흔한 문제/주의: naive ISO를 `new Date()`로 파싱하면 시스템 timezone 영향으로 날짜가 틀어질 수 있다.
- `3-2` 목적: 당일 장중 change 노출 차단. 설명: same-day 기사라도 ET 16:00 전이면 metric write를 건너뛰고, 이전 run에서 남은 metric도 지우면 완료다.
  - 완료 조건(눈으로 확인): 장중 테스트는 defer=true, 장마감 후 테스트는 defer=false이며 runtime 조회에서 3/11 change 값이 null이다.
  - 사람 검증(비개발자): 테스트 설명에서 "before ET market close" / "after ET market close"가 구분된다.
  - 흔한 문제/주의: anchorDate 일치만으로 저장을 허용하거나 기존 metric 삭제를 빼먹으면 오늘 장중 값이 계속 남는다.
- `3-3` 목적: View Log의 조기 100% 오해 방지. 설명: 잡이 아직 running이면 진행률 최대치가 99로 제한되면 완료다.
  - 완료 조건(눈으로 확인): 테스트에서 running progress는 99, `completeJob()` 후 100이다.
  - 사람 검증(비개발자): View Log에서 running 중에는 100% 대신 99% 이하만 보인다.
  - 흔한 문제/주의: UI만 고치고 backend는 100을 계속 보내면 다른 화면/폴링 경로가 다시 틀어진다.
- `3-4` 목적: 오늘 일봉 자체를 canonical OHLC DB에서 배제해 forward metric도 장중에는 오늘 bar를 못 보게 만든다. 설명: pre-close 3/11 row를 저장하지 않고, max-date/forward 조회에서도 무시하면 완료다.
  - 완료 조건(눈으로 확인): OHLC DB `Datetime='2026-03-11'` count가 0이고, 3/10 RTPR 기사에 `target_date='2026-03-11'`가 남지 않는다.
  - 사람 검증(비개발자): 3/10 기사에서 `change_1d_pct`가 장중에는 비어 있고 `ohlc_date`가 3/10으로만 보인다.
  - 흔한 문제/주의: 오늘 bar 저장만 막고 기존 bar purge를 안 하면 과거에 들어간 partial row가 계속 참조된다.
- `3-5` 목적: 운영 문서와 로그를 코드 상태에 맞추기. 설명: spec과 plan/log에 같은 규칙이 적히면 완료다.
  - 완료 조건(눈으로 확인): plan, agent_log, backend_prompt에 ET close 규칙과 progress 99 규칙이 모두 있다.
  - 사람 검증(비개발자): 문서 검색으로 `16:00`과 `99`가 함께 나온다.
  - 흔한 문제/주의: plan만 바꾸고 backend_prompt를 안 바꾸면 이후 운영자가 API semantics를 잘못 이해한다.

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\terminal
npm run build
npm run test -- --runInBand
Invoke-RestMethod -UseBasicParsing -Uri http://localhost:8080/api/jobs/<jobId>
```
사용자 확인 필요: **예**

#### ⏳ Step 10 — RTPR 전용 Full Text Backfill 버튼

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 10-1 | RTPR source + body 기반 백필 대상 조회 추가 | `terminal/backend/src/services/fulltextRepository.ts` | RTPR body 존재 + fulltext 누락/실패 row만 조회되는지 코드 확인 | ⏳ |
| 10-2 | RTPR body를 `news_fulltext`로 upsert하는 백그라운드 job 추가 | `terminal/backend/src/services/fulltextUpdateService.ts` | backend build 후 job 시작 로그 확인 | ⏳ |
| 10-3 | RTPR 전용 backfill API endpoint 추가 | `terminal/backend/src/server.ts` | `POST /api/news/fulltext/backfill-rtpr` 응답에 `jobId` 반환 확인 | ⏳ |
| 10-4 | Full Text 메뉴에 RTPR Body Backfill 버튼 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | webui build 후 메뉴 항목/핸들러 코드 확인 | ⏳ |

- `10-1` 목적: 일반 fulltext update와 별도로 RTPR 전용 누락 대상만 정확히 잡는다. 설명: `news_items.source='RTPR'` 이고 body가 있으며 fulltext가 없거나 비정상인 행만 백필 후보가 되면 완료다.
  - 완료 조건(눈으로 확인): 쿼리 조건에 RTPR/source/body/fulltext 상태 기준이 모두 들어간다.
  - 사람 검증(비개발자): 코드에서 `RTPR`와 `body` 조건이 함께 보이는지 확인한다.
  - 흔한 문제/주의: 이미 성공한 fulltext를 덮어쓰는 과도한 재처리는 피해야 한다.
- `10-2` 목적: 외부 링크 재수집 없이 저장된 RTPR 본문으로 즉시 fulltext를 채운다. 설명: job이 `htmlToPlainText` 후 `news_fulltext`를 upsert하면 완료다.
  - 완료 조건(눈으로 확인): job log에 RTPR backfill 시작/완료 메시지가 남는다.
  - 사람 검증(비개발자): job 로그에 성공/실패 카운트가 증가하는지 본다.
  - 흔한 문제/주의: 빈 문자열 body를 성공으로 처리하면 품질이 무너진다.
- `10-3` 목적: UI에서 재사용 가능한 별도 실행 경로를 만든다. 설명: 백엔드가 `jobId`를 반환하고 기존 job polling에 그대로 연결되면 완료다.
  - 완료 조건(눈으로 확인): API route가 존재하고 `jobId`를 반환한다.
  - 사람 검증(비개발자): 호출 후 작업 로그 패널이 열릴 수 있다.
  - 흔한 문제/주의: 기존 `/api/news/fulltext/update`와 payload 형태가 달라 프론트 분기가 필요하다.
- `10-4` 목적: 사용자가 메뉴에서 RTPR 전용 backfill을 직접 실행할 수 있게 한다. 설명: Full Text 드롭다운에 별도 항목이 보이고 클릭 시 RTPR 전용 endpoint로 요청하면 완료다.
  - 완료 조건(눈으로 확인): 메뉴에 `RTPR Body Backfill` 항목이 추가된다.
  - 사람 검증(비개발자): 메뉴 클릭 후 메인 버튼 라벨이 `FT RTPR`로 바뀐다.
  - 흔한 문제/주의: 기존 fulltext 메뉴 동작이나 label 계산을 깨뜨리지 않아야 한다.

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\terminal
npm run build

cd c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub
npm run build

Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' -Body '{"concurrency":2}' http://127.0.0.1:4000/api/news/fulltext/backfill-rtpr
```
사용자 확인 필요: **예**
- 따라서 지금 가장 값비싼 실수는 “문서상 타입과 실제 probe 타입을 구분하지 않고 구현하는 것”이다.
- 올바른 다음 입력값:
  - 저장 전략 결정
  - WebSocket 사용 여부 결정
  - dedup 기준 결정

### 결정 #2 — 완료 판단 기준(상세)
- 이번 1차 목표는 “PTPR provider 구현 완료”가 아니다.
- 이번 1차 목표의 완료 기준은 아래 4개다.
  1. base URL 확정
  2. auth 방식 확정
  3. press 관련 endpoint 최소 1개 성공 probe
  4. 실제 응답 기반 데이터 타입 카탈로그 작성

### 확인된 데이터 타입 카탈로그 (2026-03-10)
- REST envelope
  - `[][][]count[][][]`: 반환 article 개수
  - `[][][]articles[][][]`: article 배열
- REST article item
  - `[][][]ticker[][][]`
  - `[][][]exchange[][][]`
  - `[][][]title[][][]`
  - `[][][]author[][][]`
  - `[][][]created[][][]`
  - `[][][]article_body[][][]`
  - `[][][]article_body_html[][][]`
- 시각 정규화 규칙
  - 원본 `[][][]created[][][]`는 UTC/Z 또는 ET offset 형태로 올 수 있다.
  - 레포 내부 canonical 시각은 항상 `America/New_York` 기준 `[][][]created_et[][][]`로 통일한다.
- WebSocket inbound types
  - `[][][]connected[][][]`
  - `[][][]subscribed[][][]`
  - `[][][]article[][][]`
  - `[][][]ping[][][]`
  - `[][][]error[][][]`
- WebSocket outbound actions
  - `[][][]subscribe[][][]`
  - `[][][]unsubscribe[][][]`
  - `[][][]pong[][][]`
- 범위 결론
  - 현재 확인 범위는 press release feed다.
  - 별도 market news / general news / macro commentary endpoint는 문서와 probe에서 확인되지 않았다.

---

### PLAN CHANGE (2026-03-10) — 구현 단계 추가

사용자 요청: "recent ptpr press release, custom ptpr press release / 버튼 추가 기능도 작동하도록 하고 / log view 도 이 버튼에 적용되게 하라 / 속도 고려"

**결정 확정:**
- `D-1` 저장 전략: 기존 `news_items` 테이블에 `source='RTPR'`, `source_type='press_release'`로 적재. URL은 합성키 `rtpr://{ticker}/{created_iso}` 사용.
- `D-2` WebSocket 운영: 이번 범위에서는 REST만 사용. WebSocket은 후속 과제.
- `D-3` dedup key: `UNIQUE(source, url)` 제약 활용 → `source='RTPR'` + `url='rtpr://{TICKER}/{created_iso}'`로 중복 방지.
- `D-4` ET canonical: `published_at`에 ET 변환된 ISO string 저장 (기존 Finnhub 패턴과 동일). raw `created`는 body에 자연스럽게 포함.

**추가되는 Steps: 3 ~ 5**

#### ⏳ Step 3 — Backend RTPR provider + pull endpoint

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `config.ts`에 RTPR API key 로딩 추가 | `terminal/backend/src/config.ts` | `config.rtprApiKey` 값 존재 확인 | ⏳ |
| 3-2 | `ptprNewsProvider.ts` 생성 — REST fetch + rate limiter + FinnhubMappedItem 변환 | `terminal/backend/src/services/ptprNewsProvider.ts` | `npx tsc --noEmit` 통과 | ⏳ |
| 3-3 | `server.ts`에 `POST /api/news/pull-rtpr` endpoint 추가 (recent/custom mode, job 기반) | `terminal/backend/src/server.ts` | backend build 성공 + endpoint 응답 확인 | ⏳ |

- `3-1` 목적: RTPR API key를 안전하게 로드. 설명: `ai_agent_plan/ptpr_api_key/ptpr_api_key` 파일에서 읽어 `config.rtprApiKey`로 노출.
  - 완료 조건: config 객체에 rtprApiKey 존재
  - 사람 검증: backend 시작 시 에러 없음
  - 흔한 문제: 파일 경로 오타, 빈 키 파일
- `3-2` 목적: RTPR REST API를 호출하고 결과를 `FinnhubMappedItem` 호환 형식으로 변환하는 provider.
  - `fetchRtprArticles(limit)` — 전체 최신 articles
  - `fetchRtprArticlesByTicker(ticker, limit)` — ticker별 articles
  - ET 시각 변환 포함 (UTC → America/New_York)
  - 60 rpm rate limiter
  - 완료 조건: tsc 통과 + 함수 export 확인
  - 사람 검증: provider import 시 컴파일 에러 없음
  - 흔한 문제: timezone 변환 라이브러리 누락, rate limit 미적용
- `3-3` 목적: 프론트엔드에서 호출할 pull endpoint. mode=recent은 `GET /articles?limit=100`, mode=custom은 ticker별 조회.
  - job 기반 비동기 실행 (createJob → appendLog → completeJob/failJob)
  - `activePullJobs`에 `rtpr_press_release` key 사용하여 중복 방지
  - 완료 조건: `POST /api/news/pull-rtpr` → `{ jobId }` 응답
  - 사람 검증: curl/PowerShell로 endpoint 호출 시 jobId 반환
  - 흔한 문제: import 누락, zod schema 오류

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\terminal\backend
npx tsc --noEmit
npm run build
# dev 서버 시작 후
Invoke-RestMethod -Uri "http://localhost:8080/api/news/pull-rtpr" -Method Post -ContentType "application/json" -Body '{"mode":"recent"}'
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — Frontend PTPR 버튼 + Log View 통합

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | Update 메뉴에 "PTPR Press Release" 섹션 추가 (Recent + Custom 2개 버튼) | `FinnhubNewsWindow.tsx` | frontend build 성공 | ⏳ |
| 4-2 | `handlePtprUpdate` 함수 추가 — `POST /api/news/pull-rtpr` 호출, jobId 설정 | `FinnhubNewsWindow.tsx` | 버튼 클릭 시 job 시작 확인 | ⏳ |
| 4-3 | Log View가 PTPR job에도 동작하는지 확인 (기존 jobId polling 재사용) | `FinnhubNewsWindow.tsx` | View Log 패널에 PTPR 로그 표시 | ⏳ |

- `4-1` 목적: 사용자가 PTPR 데이터를 Pull 할 수 있는 UI 진입점.
  - "PTPR Press Release" 섹션 헤더 + "Recent PTPR Press Release", "Custom PTPR Press Release" 버튼
  - 완료 조건: 메뉴에 2개 버튼 표시됨
  - 사람 검증: 브라우저에서 Update 드롭다운 열면 PTPR 섹션 보임
  - 흔한 문제: JSX 닫힘 태그 누락, key prop 누락
- `4-2` 목적: 버튼 클릭 시 backend RTPR pull job을 시작하고 jobId를 받아 상태 추적.
  - `handlePtprUpdate(mode: 'recent' | 'custom', from?, to?)` 함수
  - 기존 `handleUpdate`와 유사하나 endpoint는 `/api/news/pull-rtpr`
  - 완료 조건: 버튼 클릭 → job 시작 → jobId 설정
  - 사람 검증: 버튼 클릭 후 View Log 활성화됨
  - 흔한 문제: wrong endpoint URL, body 형식 불일치
- `4-3` 목적: Log View는 이미 `currentJobId` 기반으로 동작하므로 별도 수정 없이 PTPR job 로그도 표시됨.
  - 완료 조건: PTPR job 실행 중 View Log 클릭 시 로그 표시
  - 사람 검증: 브라우저에서 PTPR pull 후 View Log 열기
  - 흔한 문제: jobId가 설정되지 않으면 View Log 비활성

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub
npm run build
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 통합 테스트 + sourceType 필터 호환

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | RTPR pull 후 news_items 테이블에 `source='RTPR'` 행 존재 확인 | (런타임) | DB query 검증 | ⏳ |
| 5-2 | sourceType 필터에서 `press_release` 선택 시 RTPR 기사도 표시되는지 확인 | (런타임) | API 응답에 RTPR source 포함 | ⏳ |
| 5-3 | 중복 실행 시 INSERT OR IGNORE로 중복 insert 방지 확인 | (런타임) | 2회 실행 후 row count 동일 | ⏳ |

- `5-1` 완료 조건: `SELECT COUNT(*) FROM news_items WHERE source='RTPR'` > 0
- `5-2` 완료 조건: source_type=press_release 필터 시 RTPR 기사 포함
- `5-3` 완료 조건: 2회 pull 후 totalSkipped > 0

검증 훅:
```powershell
# backend dev 서버 상태에서
Invoke-RestMethod -Uri "http://localhost:8080/api/news?source_type=press_release&limit=5"
```
사용자 확인 필요: **예**

#### ⏳ Step 6 — RTPR Recent 증분 구조 리팩터 (Finnhub 동등)

사용자 요청: "기본 유니버스 ticker 목록 → ticker별 anchor → confirmed-empty skip → change% merge — Finnhub recent과 동일 구조로"

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | `getTickerAnchorMap` source 파라미터 추가 (기본 `'FINNHUB'`) | `finnhubNewsProvider.ts` | tsc 통과 + 기존 Finnhub 호출 영향 없음 | ⏳ |
| 6-2 | `pull-rtpr` recent 모드 → per-ticker 증분 (anchor + confirmed-empty skip) | `server.ts` | tsc 통과 + 런타임 per-ticker 로그 확인 | ⏳ |
| 6-3 | `pull-rtpr` 양쪽 mode에 change% merge 추가 | `server.ts` | job 완료 시 changeMerged > 0 확인 | ⏳ |
| 6-4 | Frontend 버튼 설명 텍스트 업데이트 | `FinnhubNewsWindow.tsx` | vite build 통과 | ⏳ |
| 6-5 | 같은 날 기사에서 장종료 전 당일 bar / 과거 anchor 사용 시 change 비우기 | `newsChangeMerger.ts` | 장중 3/11 기사 API 응답에서 `published_at` 날짜가 3/11이면 change 컬럼이 null인지 확인 | ⏳ |
| 6-6 | 장마감 후/과거 backfill change 재계산 경로 확정 | `newsChangeMerger.ts` (6-5와 동일 gating) | `POST /api/news/change/update-recent` 또는 `POST /api/news/change/update-custom` 실행 후 ET 16:00 이후에만 same-day change가 채워지는지 확인 | ⏳ |

- `6-1` 목적: RTPR anchor map을 조회할 수 있도록 `getTickerAnchorMap(sourceType, source)` 확장.
  - 기존 `getTickerAnchorMap('company_news')` / `getTickerAnchorMap('press_release')` 호출은 기본 source='FINNHUB'로 동작하므로 영향 없음.
- `6-2` 목적: RTPR recent 모드를 "글로벌 100건 스냅샷"에서 "ticker별 증분"으로 변경.
  - universe ticker 목록 로드 → RTPR anchor map 조회 → ticker별 API 호출 + anchor 이후만 필터 → confirmed-empty 기록/skip
  - confirmed-empty key: `'rtpr_press_release'` (Finnhub의 `'press_release'`와 분리)
- `6-3` 목적: 신규 RTPR 뉴스에 대해 OHLC change% 자동 계산.
  - `mergeChangeForNewItems(newItems)` — job 종료 직전 실행
  - `setLastSuccess('rtpr_press_release', ...)` — update status 기록
- `6-4` 목적: UI 설명을 "Latest 100"에서 "Per-ticker incremental" 으로 갱신.
- `6-5` 목적: 장중 기사나 OHLC 지연 상황에서 잘못된 과거 일봉 change가 보이지 않게 한다.
  - 규칙 1: **정규장 종료 시각(기본 `16:00 America/New_York`) 이전에는 같은 날짜 기사에 대해 당일 `ohlc_date`가 있어도 저장하지 않는다.**
  - 규칙 2: 기사 날짜와 같은 거래일의 일봉이 아직 확정되지 않았으면 `[][][]change_pct[][][]`, `[][][]change_from_open_pct[][][]`, `[][][]change_open_to_high_pct[][][]`, forward change 컬럼을 모두 비운다.
  - 규칙 3: 계산에 사용된 `anchorDate`가 기사 날짜보다 과거면 same-day 기사로 간주하지 않고 change를 비운다.
  - 규칙 4: 전일/과거 anchor fallback은 내부 디버깅 정보로는 남길 수 있지만, 사용자 API 응답에는 노출하지 않는다.
  - 규칙 5: IBKR가 장중에도 `barSizeSetting='1 day'` 응답으로 당일 partial daily bar를 줄 수 있으므로, `anchorDate === 기사 날짜`만으로는 저장 조건이 충분하지 않다.
  - rollout 주의: 규칙 적용 전 이미 저장된 RTPR 잘못된 change metric은 1회 정리해야 한다. 기준은 `published_at` 날짜 > `ohlc_date` 인 기존 행이다.
  - 완료 조건(눈으로 확인): 2026-03-11 장중 RTPR 기사에서 `published_at=2026-03-11...` 이고 `ohlc_date=2026-03-11` 이어도 모든 change 컬럼이 null이다. 과거 값이어도 역시 null이어야 한다.
  - 사람 검증(비개발자): News API 결과 또는 UI에서 오늘 기사인데 숫자가 뜨지 않는지 확인한다.
  - 흔한 문제/주의: 장 마감 후 당일 bar가 확정됐는데도 null로 남으면 gating 조건이 과도한 것이다. 반대로 장중인데 `ohlc_date=기사일` 숫자가 보이면 partial daily bar가 그대로 노출되는 버그다.
- `6-6` 목적: change 데이터가 "언제 비고, 언제 다시 채워지는지"를 운영 절차로 고정한다.
  - 정상 업데이트 원칙 1: **RTPR pull 시점**에는 기사 ingest와 초기 change merge를 수행하되, `anchorDate === 기사 날짜`여도 현재 ET 시각이 정규장 종료(`16:00`) 이전이면 값을 저장하지 않는다.
  - 정상 업데이트 원칙 2: **같은 날 기사**는 장중에는 null이 정상이다. 일봉이 확정된 뒤에만 값을 채운다.
  - 정상 업데이트 원칙 3: **장마감 후 재계산 경로**는 기존 endpoint를 사용한다.
    - 최근 7일 재계산: `POST /api/news/change/update-recent`
    - 임의 기간 재계산: `POST /api/news/change/update-custom` with `from`, `to`
  - 정상 업데이트 원칙 4: 재계산 전에 OHLC DB에 해당 거래일 바가 실제로 있어야 한다. 없으면 여전히 null이 정상이다.
  - 정상 업데이트 원칙 5: **당일 기사**는 `오늘 ET >= 16:00` 이고 `anchorDate === 기사 날짜`일 때만 저장 가능하다. 그 전에는 IBKR fallback으로 당일 partial bar가 와도 무조건 null 유지.
  - 운영적 정의:
    - 입력: `news_items.published_at` 날짜, 현재 ET 시각, `news_change_metrics` 계산용 OHLC anchor, `OHLC_data/ohlc_1d_watchlist.sqlite`의 일봉 데이터
    - 허용 저장 A: `substr(published_at,1,10) < 오늘 ET 날짜` 이고 `substr(published_at,1,10) == ohlc_date`
    - 허용 저장 B: `substr(published_at,1,10) == 오늘 ET 날짜` 이고 `오늘 ET 시각 >= 16:00` 이며 `substr(published_at,1,10) == ohlc_date`
    - 저장 금지 A: `substr(published_at,1,10) > ohlc_date`
    - 저장 금지 B: `substr(published_at,1,10) == 오늘 ET 날짜` 이고 `오늘 ET 시각 < 16:00`
    - 장마감 후 값 채우기: 같은 날짜 바가 OHLC DB에 들어온 뒤 `update-recent` 또는 해당 일자 `update-custom` 재실행
  - 예시 1: 2026-03-11 10:01 기사 + OHLC 최신 바가 2026-03-10이면 change는 null 유지
  - 예시 2: 2026-03-11 11:30 기사 + IBKR가 `ohlc_date=2026-03-11` partial daily bar를 반환해도 change는 null 유지
  - 예시 3: 2026-03-11 16:10 ET 이후 2026-03-11 바가 OHLC DB에 있고 `POST /api/news/change/update-custom` body `{"from":"2026-03-11","to":"2026-03-11"}` 실행 시, `ohlc_date=2026-03-11`인 기사만 change가 채워짐
  - 예시 4: 과거 backfill 기사 2026-03-09 + OHLC 바가 이미 2026-03-09로 존재하면 재계산 시 change 저장 가능
  - 완료 조건(눈으로 확인): 오늘 기사들은 장중에는 null이고, 장마감 후 재계산을 돌린 뒤 `ohlc_date == published_at 날짜`인 기사만 숫자가 생긴다.
  - 사람 검증(비개발자): 같은 날짜 기사 하나를 잡아서 장중에는 빈 값, 장마감 후 재계산 뒤에는 숫자가 채워지는지 본다.
  - 흔한 문제/주의: OHLC DB가 늦게 갱신되면 재계산을 돌려도 null이 유지될 수 있다. 이 경우 change 로직 문제가 아니라 price source 타이밍 문제다. 또 반휴장(early close)은 현재 기본 `16:00 ET` 규칙으로는 엄밀히 처리되지 않으므로 향후 거래일 캘린더 연동이 필요할 수 있다.

##### PLAN CHANGE (2026-03-11) — 장중 same-day change 금지 규칙 추가

사용자 요청: "장 종료 시각 이후가 아니라면 당일 장중 change 는 반영 하면 안 되지"

**추가 확인된 문제:**
- `POST /api/news/change/update-recent` 가 IBKR fallback을 통해 당일 `1 day` bar를 받아오면, 장중에도 `ohlc_date=기사 날짜`가 성립할 수 있다.
- 즉 기존 `anchorDate === 기사 날짜` 규칙만으로는 장중 partial daily bar 노출을 막지 못한다.

**결정:**
- same-day change 저장 조건에 **현재 ET 시각 >= 정규장 종료 시각(`16:00 America/New_York`)** 을 추가한다.
- 장중에는 당일 `ohlc_date`가 있어도 null 유지가 정답이다.
- 장마감 후 재계산 endpoint를 다시 돌릴 때만 당일 change를 채운다.
- 기본 구현은 `16:00 ET` cutoff를 사용하고, half-day/holiday early close 정밀 처리는 후속 개선으로 남긴다.

##### PLAN CHANGE (2026-03-11) — same-day change gating 추가

사용자 요청: "같은 날 기사에는 당일 바가 확정되기 전까지 change 를 비우기"

**확인된 문제:**
- 2026-03-11 RTPR recent 기사에서 `published_at`은 3/11인데 `ohlc_date`는 3/06으로 내려오는 케이스가 확인됐다.
- 2026-03-10 RTPR 기사도 일부는 `ohlc_date=3/09`, 다수는 `ohlc_date=3/06`이라 3/10 확정 bar 기준이라고 신뢰할 수 없었다.
- 원인: `newsChangeMerger`가 `getOhlcCloseOnOrBefore()`로 기사일 이하의 가장 최근 일봉을 anchor로 잡기 때문.

**결정:**
- 기사일과 같은 trading day bar가 확정되지 않았거나, anchor가 기사일보다 과거면 사용자에게 보여주는 change는 채우지 않는다.
- 즉 "값이 있으면 최소한 기사일 anchor 기준으로 계산된 값"이라는 의미를 보장한다.
- 기존 DB에 이미 들어간 RTPR 잘못된 change metric은 별도 cleanup으로 삭제한다.
- 장마감 후 또는 과거 일자 backfill 시에는 기존 change update endpoint로 재계산하여 값을 채운다.

검증 훅:
```powershell
# 1차 pull: per-ticker 로그 확인
$resp = Invoke-RestMethod -Uri "http://localhost:8080/api/news/pull-rtpr" -Method Post -ContentType "application/json" -Body '{"mode":"recent"}'
Start-Sleep 20
$job = Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/$($resp.jobId)"
$job.logs | Select-Object -First 5
# confirmed-empty 동작 확인: 2차 run에서 fallback 수 감소

# 6-5: 같은 날 기사 change gating 확인
$items = Invoke-RestMethod -Uri "http://localhost:8080/api/news?limit=20&source_names=RTPR&source_type=press_release"
$items.items | Select-Object -First 10 id,published_at,ohlc_date,change_pct,change_from_open_pct,change_open_to_high_pct
# 기대: published_at 날짜와 ohlc_date가 다르면 change 컬럼은 null

# 6-6: 장마감 후 재계산 경로 확인
Invoke-RestMethod -UseBasicParsing -Method Post -ContentType 'application/json' -Body '{}' http://localhost:8080/api/news/change/update-recent
Invoke-RestMethod -UseBasicParsing -Method Post -ContentType 'application/json' -Body '{"from":"2026-03-11","to":"2026-03-11"}' http://localhost:8080/api/news/change/update-custom
# 기대: 같은 날짜 OHLC 바가 존재하는 기사만 change가 다시 채워짐
```
사용자 확인 필요: **예**

### 실행 의존성 그래프 (갱신)
Legend: `✅` 완료+사용자확인 / `⏳` 완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 차단

```text
트랙 A — Discovery (완료)
  ⏳ Step 0 현재 상태 고정
  ⏳ Step 1 provider spec/base URL 확보
  ⏳ Step 2 실제 API probe 및 데이터 타입 카탈로그

트랙 B — 구현 (완료, 사용자 확인 대기)
  ⏳ Step 3 Backend RTPR provider + pull endpoint
    ⏳ 3-1 config.ts RTPR key 로딩
    ⏳ 3-2 ptprNewsProvider.ts 생성
    ⏳ 3-3 server.ts pull-rtpr endpoint

  ⏳ Step 4 Frontend PTPR 버튼 + Log View
    ⏳ 4-1 Update 메뉴 PTPR 섹션 추가
    ⏳ 4-2 handlePtprUpdate 함수
    ⏳ 4-3 Log View 통합 확인

  ⏳ Step 5 통합 테스트
    ⏳ 5-1 DB row 존재 확인 (100건 insert 성공)
    ⏳ 5-2 sourceType 필터 호환 (press_release 필터 시 RTPR 포함 확인)
    ⏳ 5-3 중복 방지 확인 (2차 pull: inserted=0, skipped=100)

  ⏳ Step 6 RTPR Recent 증분 구조 리팩터
    ⏳ 6-1 getTickerAnchorMap source 파라미터 추가
    ⏳ 6-2 pull-rtpr recent → per-ticker 증분
    ⏳ 6-3 change% merge 추가
    ⏳ 6-4 Frontend 버튼 설명 업데이트
    ⏳ 6-5 same-day change gating 추가
    ⏳ 6-6 EOD remerge 경로 확정
```

병렬 트랙 요약:
- Step 3 → Step 4 → Step 5 순차 (각 Step 내 세부 단계도 순차)
- Step 4는 Step 3 완료 후 진행 (backend endpoint 필요)
- Step 5는 Step 3+4 완료 후 진행

차단 요약: 없음 (D-1~D-4 모두 확정)

---

#### ⬜ Step 7 — Custom PTPR 백필 완전성 + 불필요 호출 제거

##### 문제 정의

| # | 문제 | 원인 | 영향 |
|---|------|------|------|
| P-1 | **넓은 기간 백필 시 누락 가능** | ticker당 1회 호출 × 최대 100건 → 기간 안 기사가 100건 넘는 ticker는 오래된 기사부터 잘림 | custom PTPR update의 "지정 기간 완전 수집" 목적과 불일치 |
| P-2 | **이미 저장된 ticker에 대해서도 API 호출** | anchor/DB 사전 조회 없이 무조건 `fetchRtprArticlesByTicker` 호출 → DB insert 시점에서만 dedup | 불필요한 네트워크 호출 + RTPR rate limit(60 rpm) 낭비 |

##### 해결 방안

**P-1 해결: RTPR pagination 또는 offset 방식 확인 후 반복 fetch**

현재 RTPR REST API(`GET /articles/{ticker}?limit=N`)는 `limit` 파라미터만 확인되어 있고, `offset`/`page`/`before`/`after` 같은 pagination 파라미터가 공식 문서에 명시되어 있지 않다.

- **방안 A (offset/cursor 존재 시):** RTPR API가 offset 또는 cursor 기반 pagination을 지원하면, 100건 단위로 반복 fetch한다. 기간 필터가 서버측 파라미터로 없으므로 클라이언트에서 `created` 날짜로 필터하되, 기사가 범위 밖으로 나가면 중단한다.
  ```
  1회차: GET /articles/AAPL?limit=100&offset=0  → 100건
  2회차: GET /articles/AAPL?limit=100&offset=100 → 80건 (< 100 → 종료)
  필터: from ~ to 범위 안에 있는 것만 DB insert
  ```
- **방안 B (pagination 미지원 시):** RTPR API가 pagination을 지원하지 않으면, 100건이 ticker의 전체 히스토리이므로 그 이상 수집이 불가능하다. 이 경우:
  - 100건 반환 시 로그에 `⚠ {ticker}: 100건 cap 도달, 누락 가능` 경고를 남긴다.
  - job 완료 시 cap에 도달한 ticker 목록을 summary에 포함한다.
  - 사용자가 해당 ticker만 기간을 좁혀서 재실행할 수 있도록 안내한다.
- **방안 C (하이브리드):** 방안 B를 기본으로 하되, RTPR global feed(`GET /articles?limit=100`)를 보조로 활용한다. global feed는 ticker 무관 최신순이므로, custom 기간이 최근이면 global feed에서 놓친 기사를 보충할 수 있다.

> **우선순위:** 먼저 RTPR API에 offset/page 파라미터가 실제 동작하는지 probe한다(Step 7-1). 결과에 따라 A 또는 B를 선택한다.

**P-2 해결: custom 모드에서 DB 사전 조회로 불필요 호출 skip**

custom 모드에서도 ticker별 기존 데이터를 먼저 확인하여, 지정 범위 안에 이미 충분히 수집된 ticker는 API 호출을 건너뛴다.

- **방안 1 (anchor 기반 skip):** `from ~ to` 범위 안에 해당 ticker의 RTPR 기사가 이미 존재하고, anchor가 `to` 이후이면 → 이미 해당 기간은 수집 완료로 간주하고 skip.
  ```sql
  SELECT MAX(published_at) FROM news_items
  WHERE source = 'RTPR' AND tickers LIKE '%AAPL%'
    AND published_at >= :from AND published_at <= :to
  ```
  결과가 있고 anchor ≥ to이면 skip.
- **방안 2 (confirmed-empty 활용):** recent 모드에서 이미 `confirmed_empty_ranges`에 기록된 ticker+기간은 custom에서도 skip한다. 현재 recent 모드만 confirmed-empty를 기록/조회하는데, custom에서도 `getConfirmedEmptyRange(ticker, 'rtpr_press_release')`를 조회하여 `from ~ to`가 confirmed-empty 범위 안이면 skip.
- **방안 3 (방안 1 + 2 결합, 권장):** confirmed-empty와 anchor를 모두 조회하여, 둘 중 하나라도 "이 기간은 이미 처리됨"을 보장하면 skip. 어느 쪽도 해당 안 되면 API 호출.

> **권장:** 방안 3. confirmed-empty는 "기사가 없다고 확인된 구간"이고, anchor는 "기사가 있어서 여기까지 수집된 구간"이므로 둘 다 봐야 커버리지가 완전하다.

##### 구현 세부 단계

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 7-1 | RTPR API pagination probe: `offset`/`page` 파라미터 동작 여부 확인 | (런타임 probe) | offset=100 호출 시 다른 결과 반환 vs 무시 확인 | ⏳ |
| 7-2 | P-1 해결 구현: probe 결과에 따라 방안 A 또는 B 적용 | `ptprNewsProvider.ts`, `server.ts` | tsc 통과 + 100건 cap ticker 정상 처리 확인 | ⬜ |
| 7-3 | P-2 해결 구현: custom 모드에 anchor + confirmed-empty 사전 skip 추가 | `server.ts` | tsc 통과 + 2차 custom 실행 시 skip count > 0 확인 | ⬜ |
| 7-4 | 통합 테스트: custom 넓은 기간 + 이미 저장된 데이터 혼재 시나리오 | (런타임) | 누락 경고 또는 완전 수집 + skip 동작 확인 | ⬜ |

- `7-1` 목적: 해결 방향 결정의 선행 조건. RTPR `GET /articles/{ticker}?limit=100&offset=100`이 실제로 다른 페이지를 반환하는지 확인.
  - 완료 조건: probe 결과가 "pagination 지원" 또는 "미지원(offset 무시)"으로 확정.
  - 2026-03-10 probe 결과: `offset`, `page`, `cursor`, `before`, `after` 모두 동일 결과 반환 → 현재 공개 REST 기준 pagination/windowing 미지원으로 판단.
  - 흔한 문제: offset을 보내도 같은 결과를 반환하면 미지원으로 판정해야 함.
- `7-2` 목적: 넓은 기간에서도 가능한 한 완전 수집 보장.
  - 방안 A 시: `fetchRtprArticlesByTickerPaginated(ticker, from, to)` 추가 — 100건씩 offset 증가, 범위 밖 기사 나오면 중단.
  - 방안 B 시: 기존 `fetchRtprArticlesByTicker` 유지 + cap 도달 경고 로그 + job summary에 cap ticker 목록 포함.
- `7-3` 목적: 이미 수집 완료된 ticker에 대한 불필요한 API 호출 제거.
  - custom 모드 ticker 루프 진입 시:
    1. `getConfirmedEmptyRange(ticker, 'rtpr_press_release')` 조회 → from~to가 empty 범위 안이면 skip
    2. DB에서 해당 ticker의 from~to 구간 RTPR 기사 존재 + anchor ≥ to이면 skip
    3. 둘 다 해당 안 되면 API 호출
  - skip된 ticker는 로그에 `↩ {ticker}: already covered (skip)` 로 기록.
- `7-4` 목적: 전체 시나리오 결합 검증.
  - 시나리오 1: 이미 recent로 수집한 뒤 같은 기간으로 custom 실행 → 대부분 skip 확인.
  - 시나리오 2: 넓은 기간(30일) + 기사 많은 ticker → 방안 A면 pagination 동작, 방안 B면 cap 경고 확인.

검증 훅:
```powershell
# 7-1: pagination probe
$headers = @{ Authorization = "Bearer $((Get-Content 'c:\github_coding\terminal_sec\ai_agent_plan\ptpr_api_key\ptpr_api_key' -TotalCount 1).Trim())" }
# offset=0 vs offset=100 비교
$p1 = Invoke-RestMethod -Uri "https://api.rtpr.io/articles?limit=5&offset=0" -Headers $headers
$p2 = Invoke-RestMethod -Uri "https://api.rtpr.io/articles?limit=5&offset=5" -Headers $headers
# 같은 결과면 pagination 미지원
if ($p1.articles[0].title -eq $p2.articles[0].title) { "PAGINATION NOT SUPPORTED" } else { "PAGINATION SUPPORTED" }

# 7-3: custom 2차 실행 skip 확인
$resp = Invoke-RestMethod -Uri "http://localhost:8080/api/news/pull-rtpr" -Method Post -ContentType "application/json" -Body '{"mode":"custom","from":"2026-03-09","to":"2026-03-10"}'
Start-Sleep 30
$job = Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/$($resp.jobId)"
$job.logs | Select-String "skip|already covered"
```
사용자 확인 필요: **예**

#### ⏳ Step 8 — RTPR 속도 개선: 기본 concurrency 5 + Control Window 설정

사용자 요청: "그래도 한 기본 5개정도로 병렬 가능하게 하고, control window 에도 수치 설정할 수 있도록"

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 8-1 | `pull-rtpr` 입력 스키마에 `tickerConcurrency` 추가, 기본값 5 | `server.ts` | zod parse 통과 + job log에 requested tickerConcurrency 표시 | ⏳ |
| 8-2 | RTPR recent/custom를 worker pool 기반 병렬 처리로 전환 | `server.ts` | 런타임 로그에 `[batch] concurrency=5` 확인 | ⏳ |
| 8-3 | Control Window UI 추가: Finnhub/RTPR concurrency 설정 저장 | `FinnhubNewsWindow.tsx` | vite build 통과 + Control 버튼으로 modal 열림 | ⏳ |
| 8-4 | PTPR custom modal에도 RTPR concurrency 입력 추가 | `FinnhubNewsWindow.tsx` | custom modal에서 값 변경 후 update 시작 확인 | ⏳ |

- `8-1` 목적: RTPR도 Finnhub처럼 호출 동시성을 body로 제어할 수 있게 한다.
  - 기본값은 5, 허용 범위는 1~20.
- `8-2` 목적: 기존 순차 처리(1개씩)를 기본 5개 병렬 처리로 전환해 체감 속도를 개선한다.
  - 단, provider 내부 token bucket(55 req/min)가 남아 있으므로 병렬이어도 rate limit 상한은 유지된다.
- `8-3` 목적: localStorage 기반 숨은 설정이 아니라 사용자가 직접 제어할 수 있는 Control Window를 노출한다.
  - Finnhub ticker concurrency, Finnhub request interval, RTPR ticker concurrency를 저장한다.
- `8-4` 목적: PTPR custom 실행 직전에도 RTPR concurrency를 바로 조정할 수 있게 한다.

검증 훅:
```powershell
# backend 로그/잡 로그에서 concurrency 확인
$body = @{ mode = 'recent'; tickerConcurrency = 5 } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:8080/api/news/pull-rtpr' -Method Post -ContentType 'application/json' -Body $body
Start-Sleep 4
$job = Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/$($resp.jobId)"
$job.logs | Select-Object -First 8
Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/$($resp.jobId)/cancel" -Method Post | Out-Null
```
사용자 확인 필요: **예**

#### ⏳ Step 9 — RTPR update 시 plain text body를 news_fulltext에 즉시 저장

사용자 요청: "plain text 본문 도 update 버튼 누르면 같이 받게 해야지 . db 에 full text 저장하는 컬럼 있잖아. 구현"

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 9-1 | RTPR 기사 insert 시 source+url로 기존 `news_id` 조회 가능 helper 추가 | `newsRepository.ts` | 중복 기사도 기존 row id lookup 가능 | ⏳ |
| 9-2 | provider-body 전용 fulltext upsert 함수 추가 | `fulltextRepository.ts` | `news_fulltext`에 `success` row insert/update 확인 | ⏳ |
| 9-3 | `pull-rtpr` recent/custom에서 `article_body`를 `news_fulltext`에 즉시 적재 | `server.ts` | RTPR fetch 직후 `hasFullText=true` 확인 | ⏳ |

- `9-1` 목적: 중복 기사(`INSERT OR IGNORE`)도 full text 저장 대상을 찾을 수 있게 한다.
- `9-2` 목적: RTPR가 주는 `article_body`는 provider-origin plain text이므로, extractor를 기다리지 않고 `extraction_status='success'`로 직접 저장한다.
- `9-3` 목적: Update 버튼 실행만으로 RTPR 기사 본문이 `news_fulltext`에 들어가도록 연결한다.

검증 훅:
```powershell
$body = @{ mode = 'recent'; tickerConcurrency = 2 } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:8080/api/news/pull-rtpr' -Method Post -ContentType 'application/json' -Body $body
Start-Sleep 5
Invoke-RestMethod -Uri 'http://localhost:8080/api/news?limit=20&source_names=RTPR&source_type=press_release&tickers=TXN,T,LMT,ETN,APP'
Invoke-RestMethod -Uri 'http://localhost:8080/api/news/fulltext/<newsId>'
```
사용자 확인 필요: **예**

#### ⏳ Step 11 — RTPR HTML 저장 + plain text 표시 + 원문 링크 추출 (개정 2026-03-10)

> **설계 원칙 (사용자 결정):**
> - `body_html_raw` 같은 별도 필드/테이블은 만들지 않는다.
> - **`news_fulltext.full_text`** 에 raw HTML을 저장한다 (기존 plain text는 교체).
> - `news_items.body`는 plain text를 유지한다 (UI 리스트/검색용).
> - UI에서 fulltext를 보여줄 때 서버 측에서 `htmlToPlainText()`로 변환 후 반환한다.
> - 추출한 원문 링크는 `news_items.origin_url` 컬럼에 저장한다 (dedup용 `url`은 건드리지 않음).

##### 저장 모델 요약

| 테이블 | 컬럼 | 내용 | 변경 |
|--------|------|------|------|
| `news_items` | `body` | RTPR `article_body` (plain text) | 변경 없음 |
| `news_items` | `url` | synthetic `rtpr://{TICKER}/{created}` (dedup 키) | 변경 없음 |
| `news_items` | **`origin_url`** | 원문 사이트 링크 (publisher footer에서 추출) | **신규 컬럼** |
| `news_fulltext` | `full_text` | RTPR `article_body_html` (raw HTML) | **기존 plain text → HTML 교체** |

##### 데이터 흐름

```
RTPR API 응답
  ├─ article_body       → news_items.body       (plain text, 기존과 동일)
  ├─ article_body_html  → news_fulltext.full_text (raw HTML, 기존 plain text 대체)
  └─ HTML footer 파싱   → news_items.origin_url  (원문 링크)

UI 조회 시:
  news list       → news_items.body (plain text 그대로)
  fulltext detail → news_fulltext.full_text → htmlToPlainText() → 반환
  origin link     → news_items.origin_url (있으면 표시)
```

##### 적용 범위 (모든 PTPR 버튼)

| 버튼 | 경로 | HTML 저장 | 비고 |
|------|------|-----------|------|
| PTPR Update (recent) | `POST /api/news/pull-rtpr` mode=recent | ✅ ingest 시 즉시 | 새 기사 fetch 시 `article_body_html` 함께 저장 |
| PTPR Update (custom) | `POST /api/news/pull-rtpr` mode=custom | ✅ ingest 시 즉시 | recent와 동일 |
| FT RTPR (backfill) | `POST /api/news/fulltext/backfill-rtpr` | ✅ API 재호출로 HTML 확보 | 이미 저장된 RTPR 기사의 HTML 백필 |

##### 세부 단계

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 11-1 | `news_items.origin_url TEXT` 컬럼 추가 (마이그레이션) | `db.ts` | `PRAGMA table_info(news_items)` 에 `origin_url` 확인 | ⏳ |
| 11-2 | `mapArticle`에서 `article_body_html`도 반환하도록 provider 수정 | `ptprNewsProvider.ts` | `bodyHtml` 필드가 mapped item에 포함 확인 | ⏳ |
| 11-3 | RTPR ingest(recent/custom)에서 `news_fulltext.full_text`에 HTML 저장 | `server.ts`, `fulltextRepository.ts` | ingest 후 `news_fulltext.full_text`에 HTML 태그 존재 확인 | ⏳ |
| 11-4 | FT RTPR backfill → RTPR API 재호출로 HTML 확보 + fulltext 교체 | `fulltextUpdateService.ts`, `ptprNewsProvider.ts` | backfill 후 기존 plain text가 HTML로 교체 확인 | ⏳ |
| 11-5 | fulltext 조회 API에서 RTPR HTML → plain text 변환 후 반환 | `server.ts` (fulltext GET 경로) | API 응답에 HTML 태그 없이 plain text만 오는지 확인 | ⏳ |
| 11-6 | HTML footer에서 publisher별 원문 링크 추출 → `news_items.origin_url` 저장 | `rtprOriginUrlExtractor.ts` | origin_url 컬럼에 유효한 URL 확인 | ⏳ |

- `11-1` 목적: 원문 링크를 저장할 컬럼을 만든다.
  - `ensureColumn("news_items", "origin_url", "TEXT")` — 기존 `ensureColumn` 패턴 사용.
  - `url`(synthetic dedup 키)과 `origin_url`(실제 뉴스 사이트 링크)은 역할이 다르므로 분리.
  - 완료 조건: DB에 컬럼 존재, 기존 데이터 영향 없음.
- `11-2` 목적: RTPR API 응답에서 `article_body_html`을 놓치지 않고 파이프라인에 전달한다.
  - `FinnhubMappedItem` 타입에 `bodyHtml?: string` optional 추가 또는 별도 리턴 구조.
  - `mapArticle`에서 `article.article_body_html`을 매핑.
  - `article_body_html`이 API에서 빈 문자열/undefined인 경우 `body`(plain text) fallback.
  - 완료 조건: mapped item에 `bodyHtml` 필드가 존재하고 HTML 태그를 포함.
- `11-3` 목적: PTPR Update(recent/custom) 시 `news_fulltext.full_text`에 raw HTML을 즉시 저장한다.
  - 현재 Step 9에서 `article_body`(plain text)를 fulltext에 넣고 있음 → **HTML 우선 저장으로 변경**.
  - `bodyHtml`이 있으면 HTML 저장, 없으면 plain text fallback.
  - `extraction_note = 'rtpr-html-ingest'`로 마킹.
  - 완료 조건: `SELECT full_text FROM news_fulltext WHERE news_id = ?` → HTML 태그 포함.
  - 흔한 문제: Step 9 기존 로직과 충돌 → Step 9의 plain text 저장을 HTML 저장으로 교체.
- `11-4` 목적: 이미 DB에 있는 RTPR 기사의 fulltext를 HTML로 교체(백필)한다.
  - 현재 `runRtprBodyBackfill`은 `news_items.body`(plain text)를 fulltext에 복사 → **API 재호출로 HTML 확보로 변경**.
  - 재호출 흐름: RTPR 기사의 ticker로 `GET /articles/{ticker}?limit=100` → title+created 매칭 → `article_body_html` 확보 → `news_fulltext.full_text` upsert.
  - API 매칭 실패 시(기사가 너무 오래됨 등): plain text body fallback, `extraction_note = 'rtpr-html-backfill-fallback'`.
  - `extraction_note = 'rtpr-html-backfill'`로 마킹.
  - 완료 조건: backfill 후 `full_text`에 HTML 태그 존재.
  - 흔한 문제: RTPR API는 최근 100건만 반환 → 오래된 기사는 HTML 확보 불가 → fallback 처리.
- `11-5` 목적: UI에서 fulltext를 볼 때 HTML 태그가 그대로 보이지 않게 한다.
  - `GET /api/news/fulltext/:newsId` 응답에서 `full_text`가 HTML이면 `htmlToPlainText()` 적용.
  - 또는 응답에 `full_text_plain`과 `full_text_raw` 둘 다 반환 (향후 HTML 뷰어 확장 가능).
  - `dangerouslySetInnerHTML` 사용 금지 — XSS 방지.
  - 완료 조건: API 응답의 텍스트에 `<div>`, `<p>` 같은 태그 없음.
- `11-6` 목적: HTML에서 publisher별 원문 링크를 추출해 `news_items.origin_url`에 저장한다.
  - 이전 분석(2026-03-10)에서 확인된 publisher별 패턴:
    - ACCESSWIRE: `View the original press release on accesswire.com: <URL>` (14/120)
    - PR Newswire: `SOURCE <Company>` 이후 `https://www.prnewswire.com/...` (15-19/120)
    - Newsfile Corp: `To view the source version of this press release, please visit https://www.newsfilecorp.com/...` (6/120)
    - Business Wire: `https://www.businesswire.com/news/home/...` (2/120)
    - Globe Newswire: tracker 링크만 있음 — canonical URL 추출 어려움 (34/120)
  - 추출 시점: ingest 시(11-3과 함께) + backfill 시(11-4와 함께).
  - `origin_url`이 추출 안 되면 NULL 유지 (강제로 넣지 않음).
  - 완료 조건: ACCESSWIRE/PR Newswire/Newsfile/BW publisher의 기사에 `origin_url` 값 존재.

##### Step 9 연동 변경

> Step 9(RTPR update 시 fulltext 즉시 저장)는 현재 plain text를 `news_fulltext`에 넣고 있다.
> Step 11 적용 후: **HTML 우선 저장**으로 변경되며, Step 9의 upsert 로직이 11-3으로 대체/통합된다.
> Step 9 자체를 삭제하지는 않으나, 저장 내용이 plain text → HTML로 바뀐다.

##### Step 10 연동 변경

> Step 10(FT RTPR backfill 버튼)은 현재 `news_items.body`(plain text)를 fulltext에 복사한다.
> Step 11 적용 후: **API 재호출로 HTML 확보**로 변경되며, Step 10의 backfill 로직이 11-4로 대체/통합된다.
> FT RTPR 메뉴 버튼은 그대로 유지하되, 실행 시 API를 호출해 HTML을 가져오는 방식으로 변경.

검증 훅:
```powershell
# 11-1: origin_url 컬럼 확인
sqlite3 terminal/backend/backend/data/app.db "PRAGMA table_info(news_items);" | Select-String "origin_url"

# 11-3: ingest 후 HTML 저장 확인
$body = @{ mode = 'recent'; tickerConcurrency = 2 } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:8080/api/news/pull-rtpr' -Method Post -ContentType 'application/json' -Body $body
Start-Sleep 10
# 최근 RTPR 기사 ID 조회 후 fulltext 확인
sqlite3 terminal/backend/backend/data/app.db "SELECT nf.full_text FROM news_fulltext nf JOIN news_items ni ON ni.id = nf.news_id WHERE ni.source = 'RTPR' LIMIT 1;" | Select-String "<"

# 11-5: API 응답에서 plain text 확인
$items = Invoke-RestMethod -Uri 'http://localhost:8080/api/news?limit=5&source_names=RTPR'
$ft = Invoke-RestMethod -Uri "http://localhost:8080/api/news/fulltext/$($items.items[0].id)"
# full_text 에 HTML 태그가 없어야 함
if ($ft.fullText -match '<(div|p|span|br|table|a )') { "FAIL: HTML in response" } else { "OK: plain text" }

# 11-6: origin_url 확인
sqlite3 terminal/backend/backend/data/app.db "SELECT id, origin_url FROM news_items WHERE source = 'RTPR' AND origin_url IS NOT NULL LIMIT 5;"
```
사용자 확인 필요: **예**

##### 11-6 origin_url 추출 패턴 조사 결과 (2026-03-10)

**현황**: DB에 fulltext가 있는 RTPR 기사 664건 중 `origin_url`이 채워진 건은 29건(모두 Newsfile Corp). 나머지 publisher는 extractor가 `href="..."` 패턴만 탐색하기 때문에, 실제 HTML/plain text에 있는 URL을 잡지 못하고 있었음.

**Publisher별 fulltext 건수 / 실제 URL 패턴**:

| Publisher | fulltext 건수 | origin_url 추출 | 실제 URL 존재 형태 | 패턴 설명 |
|---|---|---|---|---|
| **Business Wire** | 133 | 0 ❌ | plain text URL | `View source version on businesswire.com:\nhttps://www.businesswire.com/news/home/{ID}/en/` 또는 같은 줄에 이어서 표기. 뒤에 `(https://www.businesswire.com/news/home/{ID}/en/)` 괄호 중복도 있음 |
| **PR Newswire** | 133 | 0 ❌ | plain text URL | `View original content to download\nmultimedia:https://www.prnewswire.com/news-releases/{slug}-{ID}.html` 뒤에 `(https://...같은URL)` 괄호 중복 |
| **ACCESSWIRE** | 132 | 0 ❌ | 괄호 안 plain text URL | 기존 regex는 `accesswire.com` 도메인 기대 → **실제 도메인이 `accessnewswire.com`으로 변경됨(132건 전부)**. 패턴: `View the original press release\n(https://www.accessnewswire.com/newsroom/en/{category}/{slug}-{ID})\non ACCESS Newswire` |
| **Newsfile Corp** | 40 | 29 ✅ | plain text URL | `please visit https://www.newsfilecorp.com/release/{ID}` — 기존 regex 작동 중 |
| **Globe Newswire** | 225 | 0 ❌ | tracker link만 | `globenewswire.com/Tracker?data=...` 형태의 암호화된 redirect만 존재. `globenewswire.com/news-release/` 같은 canonical URL 없음. **추출 불가** |
| **Cision** | 1 | 0 ❌ | plain text URL | `https://news.cision.com/{company}/r/{slug}%2C{ID}` — 1건뿐이라 우선순위 낮음 |

**핵심 문제**: 기존 extractor(`rtprOriginUrlExtractor.ts`)의 BusinessWire/PRNewswire/Cision 패턴 + fallback이 모두 `href="..."` 안의 URL만 매칭. 실제 RTPR 데이터에는 href 속성 없이 plain text로 URL 표기 → 전부 miss.

**수정 방향**:
1. **Business Wire**: `View source version on businesswire.com` 뒤의 bare URL 매칭 (`https://www.businesswire.com/news/home/...`)
2. **PR Newswire**: `multimedia:` 접두어 뒤의 URL 매칭 (`https://www.prnewswire.com/news-releases/...`)
3. **ACCESSWIRE**: 도메인을 `accessnewswire.com`으로 변경, 괄호 안 URL 매칭 (`(https://www.accessnewswire.com/newsroom/en/...)`)
4. **Newsfile Corp**: 기존 유지 (작동 중)
5. **Globe Newswire**: 추출 불가 — `origin_url = NULL` 유지
6. **Cision**: `https://news.cision.com/` bare URL 매칭 추가
7. **Fallback**: `href="..."` 전용 → bare URL 탐색으로 변경 (known wire service 도메인의 canonical path 패턴)

##### 11-6 구현 결과 (2026-03-10)

**변경 파일:**
- `terminal/backend/src/services/rtprOriginUrlExtractor.ts` — publisher별 plain text URL 패턴으로 전면 교체
- `terminal/backend/src/server.ts` — `persistRtprFulltext`에서 HTML뿐 아니라 plain text에서도 origin_url 추출, `POST /api/news/fulltext/backfill-origin-url` endpoint 추가
- `terminal/backend/src/services/fulltextUpdateService.ts` — backfill fallback 경로에서도 origin_url 추출, `runOriginUrlBackfill()` 함수 추가

**백필 실행 결과:**
- 총 664건 중 **431건 origin_url 확보** (updated=402, skipped=29)
- noMatch=233건 (Globe Newswire 225 + PRNewswire 8 = 본문에 canonical URL 없음)

**DB 최종 현황:**

| Publisher | 총 건수 | origin_url 확보 | 비율 |
|---|---|---|---|
| Business Wire | 133 | 133 | 100% |
| ACCESSWIRE | 132 | 132 | 100% |
| PR Newswire | 133 | 125 | 94% |
| Newsfile Corp | 40 | 40 | 100% |
| Cision | 1 | 1 | 100% |
| Globe Newswire | 225 | 0 | 0% (tracker link만 존재, 추출 불가) |

**추출 불가 사유:**
- Globe Newswire: `globenewswire.com/Tracker?data=...` 형태의 opaque redirect만 존재, canonical URL 없음
- PR Newswire 8건: 본문에 `prnewswire.com/news-releases/` 경로 URL 자체가 없음 (이미지 CDN + SOURCE만)

**상태: ✅ 구현 완료**