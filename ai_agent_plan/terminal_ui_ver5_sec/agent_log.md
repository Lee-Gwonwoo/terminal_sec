# Agent Log — terminal_ui_ver5_sec

## 2026-03-20

### terminal_ui_ver5_sec 초기 계획 문서 작성 (2026-03-20 08:45)

**작성 시각:** 2026-03-20 08:45 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver5_sec/` 폴더를 새로 만들고 `plan.md`를 작성했다.
2. 기존 구현 기준점으로 아래 내용을 확인해 plan에 반영했다.
   - Finnhub news / press release / RTPR update 버튼 구조
   - `View Log`의 `currentJobId` 기반 동작 방식
   - backend job endpoint 패턴 (`pull-finhub`, `pull-rtpr`)
   - `news_fulltext` 및 full text backfill 구조
3. Finnhub SEC 관련 단서로 레포의 probe 스크립트에서 다음 사실을 확인했다.
   - `GET /stock/filings` endpoint 후보 존재
   - `GET /stock/filings-sentiment` endpoint 후보 존재
4. 새 plan에는 다음 요구사항을 반영했다.
   - `SEC Filing` 버튼 2개 (`Recent SEC Update`, `Custom SEC Update`)
   - `View Log` 재사용
   - full text 경로를 별도 Step으로 분리
   - `Press Release` 인접 배치

#### 현재 결정 상태

- 아직 코드 구현은 시작하지 않았다.
- `full text`는 live probe 없이 확정할 수 없으므로 Step 3을 `🚫`로 두었다.
- 저장 전략은 `news_items + sec_filings companion table`을 권장안으로 제시했다.

#### 리스크 / 완화

1. **리스크:** Finnhub SEC 응답 필드를 추측하면 DB 스키마와 dedup 규칙이 틀릴 수 있다.
   - 완화 1: Step 0에서 live probe로 필드를 먼저 고정한다.
   - 완화 2: access number / URL 존재 여부를 확인한 뒤 구현한다.
2. **리스크:** full text를 같은 turn에 억지로 넣으면 dead button 또는 실패율 높은 파이프라인이 생길 수 있다.
   - 완화 1: metadata ingest와 full text를 Step 분리한다.
   - 완화 2: 링크 부재 시 `unavailable` 표준을 먼저 잡는다.
3. **리스크:** IBKR calendar의 `sec_filings`와 이번 기능을 혼동하면 데이터 의미가 섞일 수 있다.
   - 완화 1: Finnhub SEC filing을 별도 source_type으로 분리한다.
   - 완화 2: companion table로 metadata를 분리 저장한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 현재는 plan/agent log 문서만 생성 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 기존 버튼/로그/backend 구조와 Finnhub SEC probe 스크립트 존재 여부를 확인 |

#### 사용자 확인 요청

- 현재 단계는 “구현 전 계획 확정” 상태다.
- 다음으로 진행하려면 아래 2개 중 최소 1개를 먼저 확인받는 것이 좋다.
  1. 저장 전략: `news_items + sec_filings` companion table로 갈지
  2. full text 1차 범위: metadata-only로 먼저 끝낼지, 원문 링크 fetch까지 이번 범위에 넣을지

### 멀티 update / View Log / duplicate guard 현재 상태 재확인 + plan 반영 (2026-03-20 08:45)

**작성 시각:** 2026-03-20 08:45 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 현재 코드 기준으로 “서로 다른 update 동시 실행 가능 여부”를 다시 확인했다.
2. frontend `FinnhubNewsWindow.tsx`와 backend `server.ts`, `jobManager.ts`를 읽어 실제 동작을 구분했다.
3. 확인 결과를 바탕으로 `plan.md`에 Step 6~8을 추가했다.
   - 멀티 job 동시 실행 정책
   - View Log 멀티 job 선택 UX
   - duplicate guard 표준화

#### 확인된 현재 코드 상태

- backend `jobManager`는 여러 running job을 동시에 보관할 수 있다.
- backend `/api/jobs/active`와 frontend log panel은 여러 running job이 있으면 dropdown으로 선택 가능하다.
- 하지만 frontend는 대부분의 update 버튼에 전역 `updating` disable을 걸고 있어서, 실제 사용자는 다른 종류의 update를 동시에 시작하기 어렵다.
- duplicate guard는 현재 일부 endpoint에만 있다.
  - 있음: `pull-finhub`, `pull-rtpr`
  - 없음: `change update`, `fulltext update`
  - calendar update는 job 기반이 아니라 View Log 대상이 아니다.

#### 결론

- 사용자가 느끼는 현재 UX는 거의 “한 번에 하나의 update만 가능”에 가깝다.
- 반면 내부 job 시스템과 log panel 기반은 멀티 job으로 확장 가능한 상태다.
- 따라서 다음 구현 plan은 frontend 전역 lock 해체 + backend duplicate guard 표준화 + log panel label/선택 UX 보강이 핵심이다.

#### 리스크 / 완화

1. **리스크:** 프론트 lock만 풀고 backend guard를 안 맞추면 다중 탭/직접 API 호출에서 중복 job이 생긴다.
   - 완화 1: backend를 logical job key 기준 source of truth로 만든다.
   - 완화 2: 모든 장시간 endpoint에 `409 + existingJobId` 계약을 통일한다.
2. **리스크:** active job dropdown이 숫자만 보이면 여러 job이 돌아도 실사용자가 구분하기 어렵다.
   - 완화 1: platform/mode/source 기반 label을 추가한다.
   - 완화 2: 자동 포커스와 수동 선택 규칙을 분리한다.
3. **리스크:** calendar update가 job 기반이 아니면 “모든 update를 View Log에서 본다” 요구를 충족하지 못한다.
   - 완화 1: calendar를 현행 유지할지 job 기반으로 승격할지 먼저 결정한다.
   - 완화 2: 승격 전까지는 비범위를 plan에 명시한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 변경만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 코드 리뷰 기반으로 `/api/jobs/active`, job polling, 409 guard 존재 위치를 실제 구현 파일에서 확인 |

#### 사용자 확인 요청

- plan에는 이제 SEC 기능 자체 외에 멀티 update/로그 선택/중복 방지 표준화가 별도 step으로 반영돼 있다.
- 다음 구현 전 확인 포인트는 아래 두 가지다.
  1. 다른 플랫폼 update 동시 실행을 기본 목표로 둘지
  2. calendar update도 View Log 체계로 끌어올릴지

### front md / backend md에 현재 코드 상태 반영 (2026-03-20 08:52)

**작성 시각:** 2026-03-20 08:52 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 현재 확인한 동시 실행, `View Log`, duplicate guard 실제 상태를 아래 문서에 반영했다.
   - `terminal/backend_prompt.md`
   - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
2. backend 문서에는 다음을 명시했다.
   - `GET /api/jobs/active` 존재
   - Finnhub pull은 `sourceType` 단위 duplicate guard + `409 + existingJobId`
   - fulltext/change는 background job이지만 현재 duplicate guard 없음
   - calendar update는 synchronous response라 View Log 대상이 아님
3. frontend 문서에는 다음을 명시했다.
   - `activeJobs` 기반 다중 running job 선택 UI 존재
   - 하지만 전역 `updating` / `ftUpdating` lock 때문에 실제 동시 시작 UX는 막혀 있음
   - Finnhub/RTPR만 duplicate 재클릭 시 기존 job으로 포커스 이동
   - dropdown label은 아직 `Job 1`, `Job 2` 수준이라 식별성이 약함

#### 확인된 문서 동기화 결과

- front 문서와 backend 문서가 이제 같은 사실관계를 공유한다.
- 특히 "멀티 job 선택은 일부 가능하지만, 실제 버튼 동시 실행은 아직 제한적"이라는 현재 상태가 양쪽 문서에 모두 반영됐다.

#### 리스크 / 완화

1. **리스크:** 문서만 최신화되고 실제 코드가 그대로라 사용자가 기능이 이미 완성된 것으로 오해할 수 있다.
   - 완화 1: 문서에 `현재 코드 상태`와 `현재 구현 상태`를 분명히 적었다.
   - 완화 2: 예외(calendar, duplicate guard 부재)를 별도 명시했다.
2. **리스크:** backend 문서와 frontend 문서 중 한쪽만 업데이트되면 다시 드리프트가 생긴다.
   - 완화 1: 같은 turn에 두 문서를 함께 수정했다.
   - 완화 2: 이후 구현 시에도 두 문서를 같이 갱신한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 마크다운 문서 2개 수정, 코드 변경 없음 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 확인한 실제 코드 상태를 기준으로 문서 내용이 일치하도록 반영 |

#### 사용자 확인 요청

- 현재 요청한 "현재 코드 상태를 front md / backend md에 구체적으로 반영"은 완료했다.
- 다음 단계는 이 문서 기준대로 실제 멀티 job 구조를 구현할지 여부다.

### plan 점검 반영: SEC 버튼 의미 / full text 자동 수집 범위 / URL 미확정 상태 명시 (2026-03-20 08:58)

**작성 시각:** 2026-03-20 08:58 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `plan.md`에 `Recent SEC Update`, `Custom SEC Update`의 의미를 기존 recent/custom update와 동일한 UX로 고정했다.
2. `plan.md`에 현재 1차 계획상 SEC full text 자동 다운로드를 기본값으로 보지 않는다는 점을 명시했다.
3. Finnhub가 실제로 filing URL 또는 index URL을 주는지는 아직 live probe 미완료 상태라는 점을 결정 #2와 Step 0/3 설명에 반영했다.
4. URL이 확인되더라도 자동 수집이 불안정하면 `Full Text` 메뉴에 `SEC FT Backfill` 전용 버튼을 두는 방향을 기본 대안으로 명시했다.

#### 핵심 정리

- SEC recent/custom 버튼은 기존 다른 recent/custom과 기능 의미가 같다.
- 달라지는 것은 내려받는 데이터가 `SEC Filing`이라는 점이다.
- 현재 plan상 SEC full text 자동 수집은 확정되지 않았다.
- URL 제공 여부도 아직 실응답으로 확인하지 못했다.

#### 리스크 / 완화

1. **리스크:** 사용자가 SEC update 버튼이 곧바로 full text까지 자동 수집한다고 오해할 수 있다.
   - 완화 1: plan 목표와 Step 3 앞에 "자동 full text 아님"을 명시했다.
   - 완화 2: Step 0 선행 확인 없이는 Step 3을 시작하지 않도록 유지했다.
2. **리스크:** Finnhub가 링크를 안 주거나, 줘도 직접 본문 추출이 불안정할 수 있다.
   - 완화 1: metadata + link 저장을 1차 기본값으로 유지했다.
   - 완화 2: 필요 시 `SEC FT Backfill` 전용 버튼으로 분리하도록 문서화했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | plan/agent log 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 기존 plan 내용과 이번 사용자 질문을 대조해 문서 문구를 명시적으로 보강 |

#### 사용자 확인 요청

- 현재 plan은 아래 해석으로 정리돼 있다.
  1. SEC recent/custom 버튼은 기존 recent/custom과 같은 역할
  2. SEC full text 자동 수집은 아직 확정 아님
  3. URL 제공 여부는 Step 0 live probe로 확인 필요
- 다음으로는 실제 Finnhub `stock/filings` live probe를 해 보고 URL/link/body 필드 존재 여부를 확정하면 된다.

### Finnhub `stock/filings` live probe 실행 및 Step 0 사실관계 확정 (2026-03-20 09:02)

**작성 시각:** 2026-03-20 09:02 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 로컬 Finnhub API key 파일을 사용해 `stock/filings`를 실제 호출했다. 토큰 값은 출력하지 않았다.
2. `AAPL`, `from=2026-01-01`, `to=2026-03-20` 기준으로 array 응답 24건을 확인했다.
3. 샘플 필드에서 아래 항목을 실제 확인했다.
   - `accessNumber`
   - `form`
   - `filedDate`
   - `acceptedDate`
   - `reportUrl`
   - `filingUrl`
4. 본문 유사 필드(`text`, `body`, `content`, `fullText`, `reportText`)는 샘플에 없음을 확인했다.
5. 좁은 범위(`from=2026-03-16`, `to=2026-03-18`) 재조회에서 `2026-03-17` filing 1건만 반환돼 `from/to` custom filtering이 실제로 먹는 것을 확인했다.
6. Finnhub가 준 SEC 링크는 기본 PowerShell HEAD 요청에서는 403이 날 수 있었지만, `curl`에 `User-Agent`를 넣어 확인했을 때 아래가 성립했다.
   - `reportUrl`: `HTTP/1.1 200 OK`, `text/xml`
   - `filingUrl`: `HTTP/1.1 200 OK`, `text/html`

#### 결론

- Finnhub는 SEC filing에 대해 **링크를 준다**.
- direct body/full text 필드는 현재 샘플에서 확인되지 않았다.
- 따라서 현재 plan의 full text 전략은 “자동 body 수집”이 아니라 **링크 기반 backfill**이 맞다.
- recent/custom 버튼은 그대로 ingest 버튼으로 두고, full text는 별도 단계 또는 별도 `SEC FT Backfill` 버튼 후보로 유지하는 것이 타당하다.

#### 리스크 / 완화

1. **리스크:** SEC URL fetch는 클라이언트 헤더 없이 호출하면 403이 날 수 있다.
   - 완화 1: backend fetcher에 `User-Agent`를 명시한다.
   - 완화 2: `reportUrl` 실패 시 `filingUrl` fallback을 둔다.
2. **리스크:** XML/HTML/index 페이지 포맷이 filing마다 달라 단일 파서로 끝나지 않을 수 있다.
   - 완화 1: 1차는 원문 저장보다 링크 저장을 우선한다.
   - 완화 2: backfill은 실패 상태(`unavailable`/`failed`)를 명시적으로 남긴다.
3. **리스크:** `from/to`가 일 단위라 accepted time 기준 recent anchor와 어긋날 수 있다.
   - 완화 1: dedup는 `accessNumber`를 우선 사용한다.
   - 완화 2: recent 증분 기준은 `acceptedDate`와 `filedDate`를 함께 검토하는 설계를 유지한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | plan/agent log 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | Finnhub `stock/filings` 실제 호출, narrow date range 재조회, SEC URL header 확인(`curl` + `User-Agent`) |

#### 사용자 확인 요청

- Step 0 사실관계는 이제 아래처럼 정리할 수 있다.
  1. `accessNumber` dedup 가능
  2. `reportUrl` / `filingUrl` 제공됨
  3. direct body 필드는 없음
  4. full text는 link-based backfill 방향이 맞음
- 이 해석이 맞으면 다음 plan은 Step 1 provider/schema와 Step 2 버튼 구현으로 넘어가고, Step 3은 `SEC FT Backfill` 전제로 설계하면 된다.

### SEC full text 안전성 추가 점검: fetch 가능, 자동 plain-text 추출은 아직 불안정 (2026-03-20 09:09)

**작성 시각:** 2026-03-20 09:09 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. AAPL filing 데이터를 넓은 기간으로 다시 조회해 대표 form 분포를 확인했다.
   - `4`, `144`, `8-K`, `10-K`, `10-Q`, `DEF 14A` 등이 섞여 있었다.
2. 대표 form별 `reportUrl` 문서를 실제로 받아 포맷을 비교했다.
3. 결과는 다음과 같았다.
   - `4`, `144`: XML 계열
   - `8-K`, `10-K`, `10-Q`, `DEF 14A`: HTML 계열이지만 inline XBRL namespace를 포함
4. 모든 대표 샘플은 `curl` + `User-Agent` 기준으로 200 응답이 가능했다.
5. 하지만 문서 포맷이 XML/HTML/inline XBRL로 혼합되어 있어, form 구분 없이 바로 plain text를 안정 추출하는 것은 아직 위험하다고 판단했다.

#### 결론

- SEC full text를 "받아오는 것" 자체는 가능하다.
- 하지만 "항상 같은 방식으로 사람 읽는 텍스트를 안정 추출"하는 것은 아직 안전하다고 보기 어렵다.
- 따라서 1차 구현은 `SEC Update = metadata + link 저장`, `SEC FT Backfill = 별도 job`으로 분리하는 것이 안전하다.
- backfill 단계에서도 최소한 아래가 필요하다.
  - `User-Agent` 강제
  - XML/HTML 분기
  - 파싱 실패 상태 저장
  - `reportUrl` 실패 시 `filingUrl` fallback 검토

#### 리스크 / 완화

1. **리스크:** HTML 문서가 inline XBRL 기반이라 태그 제거만으로는 지저분한 텍스트가 남을 수 있다.
   - 완화 1: form/type별 파서 또는 HTML 정제 규칙을 둔다.
   - 완화 2: 1차는 full text 저장보다 링크 제공을 우선한다.
2. **리스크:** XML ownership forms와 10-K/10-Q/DEF 14A HTML을 같은 추출기에서 다루면 오탐/누락이 생길 수 있다.
   - 완화 1: XML form과 HTML form을 분리 처리한다.
   - 완화 2: 추출 실패 시 `failed` 또는 `unavailable`로 남긴다.
3. **리스크:** SEC가 헤더 없는 요청을 막으면 자동 수집 job이 간헐적으로 실패할 수 있다.
   - 완화 1: backend fetcher에 `User-Agent`를 고정한다.
   - 완화 2: 재시도 + 실패 로그를 남긴다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | plan/agent log 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 대표 form 분포 조회 + 대표 SEC 문서 URL 실 fetch + content-type/포맷 확인 |

#### 사용자 확인 요청

- 현재 판단은 아래 한 줄로 요약된다.
  - **SEC full text는 링크 fetch는 가능하지만, 자동 plain-text ingest를 바로 안전하다고 보긴 어렵다.**
- 이 판단이 맞으면 Step 3은 계속 `SEC FT Backfill` 분리 방향으로 유지하는 것이 적절하다.

### 사용자 결정 반영: SEC full text 분리 확정 / calendar 범위 제외 (2026-03-20 09:10)

**작성 시각:** 2026-03-20 09:10 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자 결정에 따라 SEC full text 1차 범위를 확정했다.
   - `SEC Update`와 SEC full text 수집을 분리한다.
   - full text는 `SEC FT Backfill` 전용 버튼/작업으로 처리한다.
2. `plan.md`의 `미확정 사항`에서 기존 `D-1`을 제거하고, 별도 결정 섹션으로 승격했다.
3. 사용자 지시에 따라 `calendar` update/job 구조 변경은 이번 작업 범위에서 제외한다고 plan에 명시했다.
4. 멀티-job 계획 섹션에도 `calendar`는 이번 change 범위에서 제외한다는 제한을 추가했다.

#### 확정된 사항

- `Recent SEC Update`, `Custom SEC Update`는 metadata + SEC 링크 저장까지만 담당한다.
- SEC 본문 추출은 `Full Text` 메뉴 아래 별도 `SEC FT Backfill` job으로 처리한다.
- `calendar`는 현행 구조를 유지하고, 이번 작업에서는 손대지 않는다.

#### 리스크 / 완화

1. **리스크:** 나중에 사용자가 calendar까지 View Log 일원화를 기대할 수 있다.
   - 완화 1: plan의 비범위에 `calendar 제외`를 명시했다.
   - 완화 2: 멀티-job 섹션에도 같은 제한을 반복 반영했다.
2. **리스크:** full text 버튼이 분리되면 사용자가 왜 두 번 눌러야 하는지 헷갈릴 수 있다.
   - 완화 1: `Update`와 `Full Text`의 역할을 UI 문구로 구분한다.
   - 완화 2: View Log와 메뉴 설명에 metadata vs full text를 명확히 적는다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | plan/agent log 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 사용자의 최신 결정이 plan 구조와 충돌 없이 반영되도록 문서 갱신 확인 |

#### 사용자 확인 요청

- 현재 plan은 아래 두 문장으로 고정됐다.
  1. SEC full text는 `SEC FT Backfill`로 분리
  2. calendar는 지금 하지 않음
- 이 해석이 맞으면 다음 구현 범위는 Step 1, Step 2, 그리고 calendar 제외 상태의 Step 6~8이다.

### 사용자 결정 반영: companion table 채택 / SEC row title 혼합 포맷 확정 (2026-03-20 09:14)

**작성 시각:** 2026-03-20 09:14 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자 요청대로 권장안을 plan의 확정값으로 반영했다.
2. 저장 전략은 `news_items + sec_filings companion table`로 고정했다.
3. SEC row title 포맷은 `혼합 포맷`으로 고정했다.
   - title은 `FORM - TICKER`
   - subtitle/body는 `filedDate`, `acceptedDate`, `accessNumber`
4. `미확정 사항`에서 기존 `D-2`, `D-3`를 제거하고, 결정 섹션으로 승격했다.

#### 확정된 사항

- DB 저장: `news_items + sec_filings`
- row title: `FORM - TICKER` 중심 혼합 포맷
- 여전히 남은 미확정은 `D-4` UI filter 노출 수준뿐이다.

#### 리스크 / 완화

1. **리스크:** row title이 너무 짧으면 filing 세부 식별이 부족할 수 있다.
   - 완화 1: `acceptedDate`와 `accessNumber`를 subtitle/body에 항상 포함한다.
   - 완화 2: row detail 패널에 `reportUrl`/`filingUrl`을 함께 노출한다.
2. **리스크:** `sec_filings` companion table 추가 시 join/query가 늘어난다.
   - 완화 1: `news_items`는 feed용 최소 조회만 유지한다.
   - 완화 2: `news_id`, `access_number` 인덱스를 먼저 설계한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | plan/agent log 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 사용자 최신 결정이 plan의 미확정/결정 구조에 일관되게 반영되도록 문서 갱신 확인 |

#### 사용자 확인 요청

- 현재 plan 기준 확정값은 아래 4개다.
  1. SEC full text는 `SEC FT Backfill`로 분리
  2. calendar는 이번 작업에서 제외
  3. 저장은 `news_items + sec_filings`
  4. row title은 혼합 포맷(`FORM - TICKER` + 보조 정보)
- 이 해석이 맞으면 남은 계획 결정은 `D-4` UI filter 노출 수준 정도만 남는다.
