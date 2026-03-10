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
```

병렬 트랙 요약:
- Step 3 → Step 4 → Step 5 순차 (각 Step 내 세부 단계도 순차)
- Step 4는 Step 3 완료 후 진행 (backend endpoint 필요)
- Step 5는 Step 3+4 완료 후 진행

차단 요약: 없음 (D-1~D-4 모두 확정)