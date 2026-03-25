# Agent Log — watchlist_copy_db

## 2026-03-24

### 독립 plan 생성 + watchlist copy/db 작업 분리 (2026-03-24 21:37)

**Status: done (awaiting user confirmation)**

#### 수정 내용

1. `ai_agent_plan/watchlist_copy_db/plan.md`
   - watchlist copy UX와 DB 저장 구조를 위한 독립 plan 신규 생성
   - 기존 `terminal_ui_ver2_finhub/plan.md`와 분리된 별도 작업 단위로 정리

2. 현재 작업 범위 재정의
   - 프론트 `WatchlistWindow` 이름 복사 UX
   - backend DB에 watchlist 저장 구조가 이미 존재함을 확인
   - 현재 프론트가 backend DB와 직접 연결되어 있지 않음을 명시

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 새 markdown 파일 생성, diagnostics 문제 없음 |
| 빌드 | ✅ | plan/log 문서 생성 작업으로 별도 빌드 영향 없음 |
| 자동 테스트 | ✅ | 테스트 대상은 문서 생성 자체이며 추가 테스트 스크립트 없음 |
| 런타임 통합 | ✅ | 기존 확인 결과 기준 `app.db`의 `watchlists`, `watchlist_items` 테이블 존재 및 row 수 0건 확인 |

#### 메모

- watchlist는 backend DB에 저장되는 구조가 맞다.
- 다만 현재 `WatchlistWindow`는 mock/local state 기반이므로, 사용자가 창에서 조작한 결과가 자동으로 DB에 저장되지는 않는다.
- 후속으로 실제 `/api/watchlists` 연동이 필요하면 별도 plan으로 분리하는 편이 안전하다.

### Watchlist API 실연동 + 리스트 삭제 버튼 추가 (2026-03-24 22:05)

**Status: done (awaiting user confirmation)**

#### 수정 내용

1. `terminal/backend/src/services/watchlistRepository.ts`
   - `updateWatchlist(...)` 추가
   - 이름, enable_alerts, ticker 목록 전체를 transaction으로 갱신

2. `terminal/backend/src/server.ts`
   - `PUT /api/watchlists/:id` 추가
   - 이제 watchlist create/list/update/delete가 모두 API로 가능

3. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx`
   - 초기 로드 시 `GET /api/watchlists` 연결
   - 새 watch list 생성 시 `POST /api/watchlists`
   - 이름 변경 및 ticker 추가/삭제 시 `PUT /api/watchlists/:id`
   - dropdown row에 watch list 삭제(trash) 버튼 추가
   - refresh 버튼, notice/error 배너 추가
   - source of truth를 mock/local presets에서 backend API 기반으로 전환

4. 문서 동기화
   - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
   - `terminal/backend_prompt.md`
   - `ai_agent_plan/watchlist_copy_db/plan.md`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `watchlistRepository.ts`, `server.ts`, `WatchlistWindow.tsx` 포함 변경 파일 diagnostics 0 errors |
| 빌드 | ❌ | frontend `npm.cmd run build` 성공. 다만 backend/terminal build는 watchlist 변경과 무관한 기존 `terminal/backend/src/server.ts:3481` 일대 TypeScript 오류로 실패 |
| 자동 테스트 | ✅ | backend 전체 `npm.cmd run test` 통과: 13 files, 73 tests pass. `watchlistRepository.test.ts` 신규 추가 포함 |
| 런타임 통합 | ✅ | `/api/watchlists` create → update → delete 호출 성공, 최종 DB count는 `watchlists=0`, `watchlist_items=0` |

#### 메모

- 이번 변경 후 `WatchlistWindow`에서 만드는 watch list는 backend DB 저장 구조를 직접 사용한다.
- ticker 시세/변화율 컬럼은 여전히 로컬 lookup fallback 값에 의존한다.
- 따라서 “리스트 저장”과 “실시간 시세 데이터 source of truth”는 아직 분리된 상태다.
- 런타임 검증에서는 임시 watchlist를 생성했다가 삭제하여 DB를 원상복구했다.
- backend build 실패는 이번 watchlist 수정이 아니라 기존 `fetchFinnhubProfilesBatch` 관련 타입 오류 때문에 남아 있는 별도 이슈다.