## 2026-03-28

**작성 시각:** 2026-03-28 13:03 (local)

### 작업 항목
- `ai_agent_plan/investing_news_window/plan.md` 생성
- Investing News Window 구현 계획 문서 작성
- 범위 정의:
  - 새 `Investing News Window` 추가
  - 대상 카테고리: `stock-market-news`, `cryptocurrency-news`
  - Finnhub 창과 유사한 구조/UI 유지, 단 filter/update 버튼은 Investing 전용으로 재설계

### 변경 파일
- `ai_agent_plan/investing_news_window/plan.md`
- `ai_agent_plan/investing_news_window/agent_log.md`

### 검증
| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| plan 파일 생성 | ✅ | `ai_agent_plan/investing_news_window/plan.md` 생성 확인 |
| agent log 파일 생성 | ✅ | 현재 파일 생성 |
| 구현/빌드/테스트 | 해당 없음 | 이번 단계는 plan/log 문서 작성만 수행 |

### 상태
- 현재 단계 상태: `확인 대기 (awaiting user confirmation)`
- 사용자 확인 전이므로 plan의 세부 단계 상태는 아직 `⬜` 유지

### 메모
- 이전 응답에서 `agent_log.md`를 함께 만들지 않은 것은 누락이었다.
- plan 컨텍스트에서 파일 변경이 있었으므로 같은 폴더에 log를 바로 생성하는 것이 맞다.
- 다음 구현 단계로 넘어가기 전, 사용자의 plan 확인이 필요하다.

---

## 2026-03-28 (2차: 구현)

**작성 시각:** 2026-03-28 (local)

### 작업 항목
- 사용자 지시: "계획 구현해봐라"
- Step 1~5 전체 구현 수행

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/investingNewsProvider.ts` | **신규 생성** | Investing 카테고리 HTML 스크래퍼 (cheerio 기반 목록 파서, 날짜 정규화, 페이지 순회, URL dedupe, retry) |
| `terminal/backend/src/server.ts` | **수정** | import 추가, `pullInvestingSchema` (zod), `POST /api/news/pull-investing` route (job 추적, category 반복, insertNewsItem, inline fulltext) |
| `terminal/backend/src/services/fulltextExtractors.ts` | **수정** | `extractByDomain` switch에 `case "INVESTING"` 추가 (Investing 기사 전용 selector + clip marker) |
| `termina_web/.../InvestingNewsWindow.tsx` | **신규 생성** | Investing News Window 프론트 컴포넌트 (~1400줄) — category filter, update split button, fulltext modal, job log panel, bookmark, column ordering/resize |
| `termina_web/.../types.ts` | **수정** | `WindowType` union에 `'investing-news'` 추가 |
| `termina_web/.../AddTabModal.tsx` | **수정** | Investing News 체크박스 추가 |
| `termina_web/.../DraggableWindow.tsx` | **수정** | `InvestingNewsWindow` lazy import + switch case 추가 |
| `termina_web/.../App.tsx` | **수정** | `'investing-news' → 'Investing News'` title 매핑 추가 |

### 검증
| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| Backend `tsc --noEmit` | ✅ | 에러 0 |
| Frontend `vite build` | ✅ | InvestingNewsWindow-DZcE2hLd.js (34.75 kB) 포함, 에러 0 |
| `get_errors` (변경 파일) | ✅ | types/AddTab/App/DraggableWindow 에러 0 |

### 상태
- Step 1~4 구현 완료
- Step 5-1 (탭 시스템 연결) 구현 완료
- Step 5-2 (prompt/spec 문서 동기화): 미착수 — 별도 prompt md 파일 확인 필요
- Step 5-3 (build/test 검증): tsc + vite build 통과
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- Investing HTML selector는 사이트 변경 시 깨질 가능성 있음 (여러 fallback selector 포함)
- runtime 실제 pull 테스트는 사용자 확인 후 수행 가능
- `backend_prompt.md`와 `figma_frontend_prompt.md` 동기화는 사용자가 원할 경우 별도 수행

---

## 2026-03-28 (3차: update 버튼 기능 수정)

**작성 시각:** 2026-03-28 17:06 (local)

### 작업 항목
- 사용자 보고: Investing 창의 update 버튼이 실제로 동작하지 않음
- 요구사항 반영:
  - recent update 2개: Stock Market / Cryptocurrency
  - custom update 2개: Stock Market / Cryptocurrency
  - custom 방식은 기존 창들과 동일하게 date range 입력 사용

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/investingNewsProvider.ts` | 수정 | `fromDate` / `toDate` 옵션 추가, 날짜 범위 필터링, `fromDate` 하한 도달 시 페이지 순회 중단 |
| `terminal/backend/src/server.ts` | 수정 | `pullInvestingSchema`에 `from` / `to` 추가, custom mode에서 `from` 필수화, recent는 7일 fallback, custom은 date range 전달 |
| `termina_web/.../InvestingNewsWindow.tsx` | 수정 | `handleUpdate(mode, category, from, to)` 구조로 변경, `Recent/Custom` 각 2개 메뉴만 유지, custom modal을 date range 방식으로 교체, update/fulltext 응답 JSON 파싱을 안전화 |
| `ai_agent_plan/investing_news_window/plan.md` | 수정 | update 메뉴 설명을 2x2 recent/custom 구조로 동기화 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 에러 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npx vite build` 통과 |
| 자동 테스트 | 미실시 | Investing update 버튼 수정과 직접 연결된 테스트 스위트는 이번 턴에서 추가하지 않음 |
| 런타임 통합 | ❌ | backend dev 서버가 `app.listen()` 전 startup 단계에서 8080 bind 전 상태로 머무름. `localhost:8080` 호출 불가 |

### 상태
- 코드 수정 자체는 완료
- UI 계약은 사용자 요구대로 변경 완료
- 런타임 최종 검증은 backend startup 지연/정지 이슈 때문에 확인 대기

### 리스크/메모
- 현재 관찰상 backend는 `initDb()` 이후 `ensureSeedData()` 또는 `importDefaultTickerUniverse()` 이전/도중 단계에서 오래 머물며 8080을 열지 않는다.
- 따라서 스크린샷의 `Unexpected end of JSON input`는 기존 update 구현 문제와 함께, backend 미기동 상태가 겹쳐 발생했을 가능성이 높다.
- Investing 버튼 경로는 수정됐지만, 실제 클릭 검증을 끝내려면 backend startup 병목을 먼저 풀어야 한다.

---

## 2026-03-28 (4차: runtime 잠금 해소 및 엔드투엔드 검증)

**작성 시각:** 2026-03-28 21:22 (local)

### 작업 항목
- backend startup 실패 원인 재확인
- SQLite lock 보유 프로세스 정리
- Investing recent/custom endpoint 실호출 검증

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | runtime 잠금 원인과 검증 결과 기록 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| backend dev 재기동 | ✅ | `Backend listening on http://localhost:8080` 확인 |
| 8080 listener 확인 | ✅ | PID listen 상태 확인 |
| `POST /api/news/pull-investing` recent | ✅ | job 생성 및 `done` 완료 확인 |
| `POST /api/news/pull-investing` custom | ✅ | job 생성 및 `done` 완료 확인 |

### 상태
- runtime blocker 해소
- Investing recent/custom 경로 모두 backend 기준 정상 동작 확인
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- 실제 잠금 원인은 코드 변경이 아니라 이전 startup probe 잔존 프로세스(`node --import tsx -`)였다.
- 이번 검증 호출은 좁은 date range와 `maxPages=1` 기준이라 결과 row는 0건이었지만, API/job 흐름 자체는 정상 완료됐다.
- UI에서 최종 체감 확인은 사용자가 Investing 창에서 recent/custom 버튼을 직접 눌러 보면 된다.

---

## 2026-03-30 (5차: Cloudflare 대응 + 실수집 검증 완료)

**작성 시각:** 2026-03-30 11:56 (local)

### 작업 항목
- Investing 목록 수집 0건 원인 분석
- Cloudflare JavaScript challenge 대응용 browser fallback 구현
- custom preflight `[][][]source_type[][][]` 집계 버그 수정
- stock market / crypto 양쪽 category 실수집 재검증

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/investingNewsProvider.ts` | 수정 | plain fetch가 challenge page를 받으면 Playwright browser DOM에서 기사 title/summary/time/provider를 직접 추출하도록 변경, 실기사 링크 selector로 제한 |
| `terminal/backend/src/services/fulltextExtractors.ts` | 수정 | challenge HTML 또는 403/503 응답이면 browser fallback으로 본문 추출 재시도 |
| `terminal/backend/src/server.ts` | 수정 | custom preflight / custom summary 집계에서 category slug 대신 실제 Investing `[][][]source_type[][][]` 값 사용 |
| `terminal/backend/tests/investingNewsProvider.test.ts` | 신규 생성 | challenge page → browser fallback 회귀 테스트 추가 |
| `terminal/backend/tests/fulltextExtractors.test.ts` | 수정 | Investing browser fallback 회귀 테스트 추가 |
| `ai_agent_plan/investing_news_window/plan.md` | 수정 | Cloudflare 대응 방식과 구현 상태 동기화 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 `get_errors` 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 통과 |
| 자동 테스트 | ✅ | backend 전체 14 files / 87 tests pass, 신규 Investing 회귀 테스트 포함 |
| 런타임 통합 | ✅ | backend dev + webui dev 상태에서 `pull-investing` / `preflight-custom` / `GET /api/news` 실호출 확인 |

### 런타임 결과 요약
- `stock-market-news` recent pull: inserted 35, skipped 0, fulltextSuccess 35, fulltextFailed 0
- `cryptocurrency-news` recent pull: inserted 23, skipped 0, fulltextSuccess 22, fulltextFailed 1
- custom preflight count:
  - stock market (`2026-03-29~2026-03-30`): `existingItemsInRange=35`
  - crypto (`2026-03-27~2026-03-30`): `existingItemsInRange=5`

### 상태
- plan 기준 핵심 범위(카테고리 2개, update route, fulltext, tab integration, prompt 동기화, runtime 검증) 구현 완료
- 사용자 시각 확인만 남아 있으므로 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- crypto recent pull에서 full text 1건 실패가 있었으므로 특정 기사 detail page 구조가 예외일 가능성이 있다.
- 그러나 목록 수집과 전체 job 흐름은 양쪽 category 모두 정상 동작했고, 저장 row/summary/preflight count도 일관되게 맞는다.
- 브라우저 시각 확인은 사용자가 Investing 창에서 recent/custom 버튼을 눌러 직접 마무리 확인하면 된다.

---

## 2026-03-30 (6차: Investing fulltext dispatch + ET 표시 보정)

**작성 시각:** 2026-03-30 08:29 (local)

### 작업 항목
- Investing row의 `publisher='Investing.com'` 값이 `INVESTING` extractor branch로 가지 못하는 문제 수정
- Investing 창의 naive ET timestamp를 로컬 타임존으로 재해석하던 표시 경로 수정
- Investing date range filtering을 ET naive 저장 규칙과 일치하도록 보정

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/finnhubNewsProvider.ts` | 수정 | `investing.com` host / `Investing.com` label을 `INVESTING`으로 canonicalize 하도록 publisher map 확장 |
| `terminal/backend/src/services/fulltextExtractors.ts` | 수정 | `extractByDomain()` 시작 시 raw publisher를 uppercase만 하지 않고 canonicalize 하도록 변경 |
| `terminal/backend/src/services/investingNewsProvider.ts` | 수정 | 상대시각/타임존 시각을 `toEtNaiveIso()`로 정규화하고, custom/recent date filtering을 date string 기준으로 비교하도록 보정 |
| `termina_web/.../InvestingNewsWindow.tsx` | 수정 | Finnhub와 동일한 ET-safe formatter를 적용해 naive ET string을 로컬 타임존으로 다시 변환하지 않도록 수정 |
| `terminal/backend/tests/fulltextExtractors.test.ts` | 수정 | `publisher='Investing.com'` 이어도 Investing scraper/browser fallback이 동작하는 회귀 테스트 추가 |
| `ai_agent_plan/investing_news_window/plan.md` | 수정 | PLAN CHANGE #2 추가 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 수정 후 `get_errors` 재확인 예정 |
| 빌드 | ⏳ | backend/frontend build 예정 |
| 자동 테스트 | ⏳ | backend test 예정 |
| 런타임 통합 | ⏳ | Investing fulltext/API 재검증 예정 |

### 상태
- 구현 반영 완료, 검증 진행 중
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- 기존 DB에 이미 저장된 fallback fulltext row는 코드 수정만으로 자동 재추출되지 않으므로, 필요 시 대상 row 재처리 또는 재pull이 필요하다.
- Investing 원문 페이지의 provider label이 Reuters 등으로 내려오더라도 host가 `investing.com`이면 Investing extractor를 우선 타게 되는지 런타임으로 다시 확인해야 한다.

---

## 2026-03-30 (7차: Investing 본문 재검증 + 시각 UTC→ET 원인 확정)

**작성 시각:** 2026-03-30 08:29 (local)

### 작업 항목
- 실제 Investing row 1건을 재추출 대상으로 되돌린 뒤 `/api/news/fulltext/update` 런타임 재검증
- `publisher='Investing.com'` row가 `no-scraper`가 아니라 Investing browser extractor로 처리되는지 확인
- Investing 목록 페이지 raw `datetime` 값이 UTC인지 ET인지 live DOM으로 확인
- backend 시간 정규화 로직을 UTC→ET naive 저장 규칙으로 수정

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/fulltextExtractors.ts` | 수정 | Investing fulltext를 live DOM 기반으로 추출하고, article selector가 빗나갈 때 `body.innerText + headline anchor`로 본문 구간을 복구하도록 보강 |
| `terminal/backend/src/services/investingNewsProvider.ts` | 수정 | 목록 페이지 `[][][]datetime[][][]` 값 `YYYY-MM-DD HH:MM:SS`를 UTC로 해석한 뒤 ET naive ISO로 변환 |
| `terminal/backend/tests/investingNewsProvider.test.ts` | 수정 | UTC listing datetime → ET naive timestamp 회귀 테스트 추가 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 변경 파일 에러 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 통과 |
| 자동 테스트 | ✅ | backend 전체 14 files / 89 tests pass |
| 런타임 통합 | ✅ | `GET /api/news/fulltext/:id`, `POST /api/news/fulltext/update`, live DOM 점검으로 본문/시각 원인 확인 |

### 런타임 결과 요약
- 재추출 전 동일 기사 fulltext 상태:
  - `extractionNote = body-fallback (no-scraper: INVESTING.COM)`
- publisher canonicalization 후 동일 기사 재추출 결과:
  - `extractionNote = investing-browser`
  - `wordCount = 396`
  - 실제 기사 문단이 저장됨
- Investing 목록 페이지 raw 값 확인:
  - `datetimeAttr = 2026-03-30 12:49:30`
  - 같은 페이지 상대 표시는 `3 minutes ago`
  - 기사 본문 표시는 `Published 03/30/2026, 07:49 AM`
  - 결론: listing `datetime`은 UTC 계열 값이며, 기존 backend는 이를 ET처럼 저장하고 있었음

### 상태
- Investing fulltext: `Investing.com` label 기사도 실제 본문 추출 가능하도록 보정 완료
- Investing 시각: 새로 수집되는 row는 UTC→ET 변환 후 저장되도록 보정 완료
- 기존 DB의 과거 Investing row 시각은 자동 backfill되지 않으므로, 정확한 ET 표시가 필요하면 해당 source를 재pull하거나 별도 backfill이 필요함
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- Investing 본문 추출은 live page body 기준으로 복구되므로, 기사 하단의 투자 유도 문구 일부가 남을 수 있다. 현재는 `Latest comments`, `Most Popular Articles` 등 주요 후행 구간을 clip 하도록 조정했다.
- 시간 보정은 새 pull부터 적용된다. 기존 row는 저장값 자체가 잘못 들어가 있을 수 있으므로 UI formatter만으로는 완전 복구되지 않는다.

---

## 2026-03-30 (8차: 기존 Investing DB 시각 backfill)

**작성 시각:** 2026-03-30 08:59 (local)

### 작업 항목
- 기존 DB에 남아 있던 Investing `published_at`를 ET 기준으로 1회 보정하는 migration 추가
- migration marker를 `update_status`에 기록해 재시작 시 중복 변환 방지
- 실제 backend dev 재시작으로 현재 DB에 migration 적용 및 결과 확인

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/db.ts` | 수정 | `migrateInvestingPublishedAtToEt()` 추가, startup에서 1회 실행, marker key=`investing_published_at_utc_to_et_v1` 저장 |
| `ai_agent_plan/investing_news_window/plan.md` | 수정 | PLAN CHANGE #3 추가 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 `db.ts` 에러 0 |
| 빌드 | ✅ | backend `npm run build`, frontend `npm run build` 통과 |
| 자동 테스트 | ✅ | backend 전체 14 files / 89 tests pass |
| 런타임 통합 | ✅ | backend dev 재시작 로그 + `GET /api/news` + SQLite marker 조회로 확인 |

### 런타임 결과 요약
- backend 재시작 시 로그:
  - `[db] migrated 58 INVESTING published_at rows from UTC to ET (cutoff<=2026-03-30 13:00:00)`
- 대표 row 보정 전:
  - `published_at = 2026-03-30T11:49:21`
- 같은 row 보정 후:
  - `published_at = 2026-03-30T07:49:21`
- migration marker:
  - `source_key = investing_published_at_utc_to_et_v1`
  - `last_success_at = 2026-03-30 13:00:03`
  - `details_json = {"migratedRows":58,"cutoffUtc":"2026-03-30 13:00:00"}`

### 상태
- 기존 Investing DB row 시각 backfill 완료
- 새 row 수집 시 UTC→ET 변환 + 기존 row 1회 보정이 모두 갖춰짐
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- 이번 migration은 cutoff 이전 적재분만 대상으로 하므로, 이후 별도 import로 오래된 잘못된 Investing row를 다시 넣으면 자동 보정 대상이 아니다.
- 그런 경우에는 marker를 지운 뒤 재실행하기보다, 별도 수동 backfill route/script를 추가하는 편이 더 안전하다.

---

## 2026-03-30 (9차: Investing 본문 host 우선 분기 + fallback row 재추출)

**작성 시각:** 2026-03-30 09:30 (local)

### 작업 항목
- Investing-hosted 기사에서 raw `publisher`가 `Reuters`/`Chainwire`여도 `investing.com` host를 우선해 Investing extractor로 분기하도록 수정
- 기존 DB에 남아 있던 Investing fallback/unavailable fulltext row 삭제
- `POST /api/news/fulltext/update`로 Investing stock/crypto 본문 재추출 재실행
- 느린 기사 페이지를 위해 Investing browser extractor timeout 허용 폭 확대

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `terminal/backend/src/services/fulltextExtractors.ts` | 수정 | non-company-news에서 `investing.com` host를 raw publisher보다 우선하고, Investing browser extractor가 navigation timeout 후에도 DOM 복구를 시도하도록 보강 |
| `terminal/backend/tests/fulltextExtractors.test.ts` | 수정 | Investing-hosted Reuters label 기사도 `investing-browser`로 가는 회귀 테스트 추가 |
| `ai_agent_plan/investing_news_window/plan.md` | 수정 | PLAN CHANGE #4 추가 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 extractor/test 에러 0 |
| 빌드 | ✅ | backend `npm run build` 통과 |
| 자동 테스트 | ✅ | backend 전체 14 files / 90 tests pass |
| 런타임 통합 | ✅ | DB fallback row 57건 삭제 후 fulltext 재추출, 최근 Investing row 본문 복구 확인 |

### 런타임 결과 요약
- 재작업 전 Investing fulltext 분포:
  - `body-fallback (no-scraper: INVESTING.COM)` 36건
  - `body-fallback (no-scraper: REUTERS)` 10건
  - `body-fallback (no-scraper: CHAINWIRE)` 10건
- fallback/unavailable row 삭제:
  - 57건 삭제
- 재추출 후 최근 12건 확인:
  - `Claude model leak...` → `investing-browser`, `wordCount=396`
  - `Viridian Therapeutics...` → `investing-browser`, `wordCount=351`
  - `Top US food supplier Sysco...` → `investing-browser`, `wordCount=470`
  - `United Therapeutics...` → `investing-browser`, `wordCount=389`
- 중간 집계 시점 기준 DB 분포:
  - `investing-browser` 성공 33건
  - fallback/no-scraper row는 제거됨
  - 남은 대상은 background fulltext job가 계속 처리 중

### 상태
- Investing 본문이 summary fallback으로만 남던 주 원인은 제거됨
- 최근 기사들은 실제 본문으로 복구 확인 완료
- stock/crypto fulltext retry job 일부는 background에서 계속 진행 중일 수 있음
- 전체 상태: **확인 대기 (awaiting user confirmation)**

### 리스크/메모
- Investing 상세 페이지는 응답이 느린 경우가 있어 모든 과거 row가 즉시 끝나지 않을 수 있다. 현재는 timeout 후에도 DOM 복구를 시도하도록 완화했다.
- background retry job가 남은 과거 기사까지 순차 처리 중일 수 있으므로, 전체 과거 row 최종 숫자는 약간 더 늘어날 수 있다.

---

## 2026-03-30 (10차: Investing Full Text modal 응답 shape 수정)

**작성 시각:** 2026-03-30 09:30 (local)

### 작업 항목
- 사용자 스크린샷에서 Full Text modal이 `(no fulltext)`로 보이는 현상 분석
- backend `/api/news/fulltext/:id` 응답이 camelCase(`fullText`, `wordCount`, `extractionStatus`)인데 프런트가 snake_case만 읽고 있던 문제 수정
- modal header가 비어 보이지 않도록 row title을 fallback title로 전달

### 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/InvestingNewsWindow.tsx` | 수정 | Full Text modal 응답 매핑에서 `fullText`/`wordCount`/`extractionStatus` camelCase 필드 지원, row title fallback 전달 |
| `ai_agent_plan/investing_news_window/agent_log.md` | 수정 | 현재 작업 기록 추가 |

### 검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `InvestingNewsWindow.tsx` 에러 0 |
| 빌드 | ✅ | frontend `npm run build` 통과 |
| 자동 테스트 | 해당 없음 | 프런트 응답 매핑 단건 수정, 기존 backend 테스트는 앞 단계에서 통과 유지 |
| 런타임 통합 | ✅ | `/api/news/fulltext/:id`가 `fullText` camelCase로 응답함을 확인했고, 프런트 매핑이 해당 shape를 읽도록 수정 |

### 런타임 결과 요약
- backend 실제 응답 예시:
  - `fullText`: 본문 문자열
  - `wordCount`: `396`
  - `extractionStatus`: `success`
- 기존 프런트 코드:
  - `data.full_text ?? data.plain_text ?? '(no fulltext)'`
- 수정 후 프런트 코드:
  - `data.fullText ?? data.full_text ?? data.plainText ?? data.plain_text ?? '(no fulltext)'`

### 상태
- 사용자가 올린 스크린샷의 `(no fulltext)` modal 원인 제거
- Investing row에 실제 본문이 있는 경우 modal 본문 표시 가능
- 전체 상태: **확인 대기 (awaiting user confirmation)**