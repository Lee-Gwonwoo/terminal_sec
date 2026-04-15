## 2026-03-28

**작성 시각:** 13:15 (local)

### 작업 항목

- 새 계획 폴더 `ai_agent_plan/motley_company_news_restore/`를 생성했다.
- `Motley Fool` company_news 복구 + 수집 차단 해제 + company_news fulltext 지원 + 기존 UI 버튼 semantics 정렬 범위를 대상으로 `plan.md` 초안을 작성했다.
- 현재 확인된 핵심 사실을 plan에 반영했다: 삭제 전 DB 507건 존재, 현재 runtime DB 0건, pull 차단 존재, startup 삭제 로직 존재, company_news fulltext 지원 publisher 제한 존재, FMP stock용 Motley scraper 재사용 가능성 존재.

### 변경 파일

- `ai_agent_plan/motley_company_news_restore/plan.md`
- `ai_agent_plan/motley_company_news_restore/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 작성만 수행, 코드 파일 미수정 |
| 빌드 | 보류 | plan 작성 단계이므로 미실행 |
| 자동 테스트 | 보류 | plan 작성 단계이므로 미실행 |
| 런타임 통합 | 보류 | 구현 전 계획 수립 단계 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 사용자가 plan 구조와 범위를 확인하면 다음 단계에서 해당 plan 기준으로 구현을 시작한다.

### 리스크 / 메모

- 현재 코드 상태에서는 `MOTLEY FOOL`을 pull에서 허용해도 startup delete/evidence cleanup이 남아 있으면 복구 데이터가 다시 사라질 수 있다.
- `company_news` fulltext는 지금 `YAHOO`, `BENZINGA` 중심 정책이라, 복구만 하고 extractor 경로를 안 열면 `Full Text > Company News Only` 요구를 충분히 충족하지 못한다.
- 복구 범위(D1)와 evidence 정책(D2)을 먼저 정해야 실제 SQL과 검증 count를 고정할 수 있다.

**작성 시각:** 13:15 (local)

### PLAN CHANGE

- 사용자 결정 반영:
	- 복구 범위는 `news_items + news_fulltext + news_change_metrics` 전부 복구로 확정
	- related `model2` evidence도 같이 복구로 확정
- 이에 따라 `plan.md`의 Step 2를 최소/선택 복구 문구에서 확장 복구 고정 문구로 수정했다.
- Step 2의 차단 사유도 `D1/D2 미결정`에서 `Step 1 선행 필요`로 변경했다.

### 변경 파일

- `ai_agent_plan/motley_company_news_restore/plan.md`
- `ai_agent_plan/motley_company_news_restore/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 갱신만 수행 |
| 빌드 | 보류 | plan 수정 단계이므로 미실행 |
| 자동 테스트 | 보류 | plan 수정 단계이므로 미실행 |
| 런타임 통합 | 보류 | 구현 전 결정 반영 단계 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 다음 구현은 Step 1부터 시작한다.

**작성 시각:** 13:28 (local)

### Step 1 진행 로그

- `terminal/backend/src/services/finnhubNewsProvider.ts`에서 company news blocked publisher를 `SEEKINGALPHA`만 남기고 `MOTLEY FOOL`을 제거했다.
- `terminal/backend/src/services/newsRepository.ts`의 startup 삭제 SQL에서 `MOTLEYFOOL` 조건을 제거했다.
- `terminal/backend/src/services/model2AnalysisRepository.ts`의 blocked evidence 필터 3곳에서 `MOTLEYFOOL` 조건을 제거했다.
- `terminal/backend/tests/finnhubNewsProvider.test.ts`를 현재 정책에 맞게 갱신했다. `Motley Fool`은 허용되고 `Seeking Alpha`만 차단된다는 기대값으로 정렬했다.

### 변경 파일

- `terminal/backend/src/services/finnhubNewsProvider.ts`
- `terminal/backend/src/services/newsRepository.ts`
- `terminal/backend/src/services/model2AnalysisRepository.ts`
- `terminal/backend/tests/finnhubNewsProvider.test.ts`
- `ai_agent_plan/motley_company_news_restore/plan.md`
- `ai_agent_plan/motley_company_news_restore/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 파일 4개 `get_errors` 기준 0 errors |
| 빌드 | ✅ | `terminal/backend`에서 `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | `npm.cmd run test -- tests/finnhubNewsProvider.test.ts` → 20/20 pass |
| 런타임 통합 | ✅ | 임시 SQLite DB 통합 스니펫에서는 `SEEKINGALPHA`만 삭제되고 `MOTLEY FOOL` news/evidence는 유지됨. 이후 `netstat -ano`로 PID `49208`가 `0.0.0.0:8080` / `[::]:8080` LISTENING 상태임을 확인했고, `GET /api/news?source=FINNHUB&sources=company_news&limit=1` 호출도 성공했다. 기존 실패 원인은 이미 떠 있던 backend 위에 수동 `npm run dev`를 추가 실행해 `EADDRINUSE`가 난 것 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- Step 1 구현/검증은 완료했고, 8080 문제는 별도 backend 인스턴스를 중복 실행해서 생긴 충돌로 정리됐다.

### 리스크 / 메모

- 8080 포트는 기존 backend 프로세스(PID `49208`)가 이미 점유 중이었다. Step 2 전에는 새 dev 서버를 또 띄우지 말고 기존 listener를 재사용하는 쪽이 안전하다.
- 이번 Step은 `MOTLEY FOOL`만 unblock했다. `SEEKINGALPHA` 정책은 그대로 유지된다.
- Step 2는 user confirmation 후 진행한다.

**작성 시각:** 13:28 (local)

### 런타임 확인 보완

- `netstat -ano | findstr 8080` 수준 확인에서 PID `49208`가 `LISTENING` 상태인 것을 확인했다.
- `Get-CimInstance Win32_Process -Filter "ProcessId = 49208"` 결과, 해당 프로세스는 `src/server.ts`를 띄운 backend watcher child process였다.
- `Invoke-RestMethod http://localhost:8080/api/news?source=FINNHUB&sources=company_news&limit=1`와 `http://127.0.0.1:8080/...` 모두 성공했다.
- 따라서 Step 1의 런타임 통합 검증은 통과로 정정한다.