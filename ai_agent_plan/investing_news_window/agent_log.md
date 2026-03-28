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