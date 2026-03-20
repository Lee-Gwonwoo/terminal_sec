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
