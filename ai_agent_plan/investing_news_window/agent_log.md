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