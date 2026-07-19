# Agent Log - Calendar Peers FMP

## 2026-05-29

**작성 시각:** 2026-05-29 12:44 (local)

### 작업 요약
- Calendar 이벤트 응답에 `peers` 배열을 추가했다. 데이터 원천은 `company_profiles.peers_json`의 최신 non-empty JSON 배열이다.
- FMP `stable/stock-peers?symbol=...` 기반 `POST /api/company-profiles/pull-fmp-peers` job route와 provider를 추가했다.
- Calendar UI에 `Peers` 선택 컬럼과 `Update FMP Peers` 버튼을 추가했다.
- Calendar 컬럼 visibility/order/width 복원 시 초기 fallback 단계에서 backend-only 컬럼이 유실되지 않도록 보존 로직을 보강했다.
- Calendar 컬럼 resize 최소 폭을 44px로 낮췄다.
- 관련 backend/frontend prompt 문서를 갱신했다.

### 수정 파일
- `terminal/backend/src/services/calendarRepository.ts`
- `terminal/backend/src/services/companyProfileRepository.ts`
- `terminal/backend/src/services/fmpPeersProvider.ts`
- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
- `terminal/backend_prompt.md`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

### 실행/검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | 통과 | `get_errors` 기준 변경 TS 파일 0 errors |
| 빌드 | 통과 | backend `npm.cmd run build`, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | 통과 | backend `npm.cmd run test` 17 files / 104 tests passed |
| 런타임 통합 | 통과 | 현재 Calendar earnings 범위 82 ticker 대상 FMP peers job 실행: 58 skipped existing, 24 fetched/updated, 0 errors. `ANIX` Calendar API 응답에서 peers 배열 확인. 브라우저에서 `Peers` 컬럼을 `Symbol` 뒤 + 44px로 임시 배치 후 새로고침 유지 확인, 원래 localStorage 상태로 복구 |

### 사용자 확인 상태
- 확인 대기: 사용자가 Calendar 화면에서 `Peers` 컬럼 선택, `Update FMP Peers`, 컬럼 배치/폭 새로고침 유지 동작을 직접 확인해야 한다.

## 2026-05-29

**작성 시각:** 2026-05-29 12:48 (local)

### 추가 작업 요약
- Calendar `peers` cell에서 `+N` 축약 badge를 제거하고, 저장된 peer ticker 전체를 chip DOM으로 렌더링하도록 수정했다.
- 컬럼 폭/높이가 부족하면 CSS overflow로 가려질 수 있지만, 뒤쪽 peer ticker를 렌더링 단계에서 생략하지 않는다.
- `figma_frontend_prompt.md`에 peers cell 렌더링 규칙을 갱신했다.

### 사용자 확인 상태
- 확인 대기: 사용자가 Calendar `Peers` 컬럼에서 `+N` 대신 전체 peer ticker chip이 렌더링되는지 확인해야 한다.
