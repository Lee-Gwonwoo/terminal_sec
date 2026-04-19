# News Window Earnings Dates Agent Log

## 2026-04-18
**작성 시각:** 19:02 (local)

### Step 1 시작
- 상태: 진행 중
- 범위: `news_earnings_context` 스키마 추가, backend/frontend 타입 계약 추가
- 예정 파일:
  - `terminal/backend/src/db.ts`
  - `terminal/backend/src/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
- 결정 반영:
  - freshness gate는 ET 날짜 기준
  - 버튼은 `Custom Earning Date Update` + `Check Unconfirmed Earning Date`
  - multi-ticker row는 `ohlc_ticker -> 첫 ticker` 규칙 사용
  - Step 1 완료 후 사용자 확인 전까지 `확인 대기`로 유지

**작성 시각:** 19:05 (local)

### Step 1 결과
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/db.ts`
  - `terminal/backend/src/types.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
  - `terminal/backend/tmp/test_validate_news_earnings_context_step1.mjs`
- 구현 내용:
  - `news_earnings_context` 테이블과 인덱스 추가
  - backend `NewsItem`에 earnings context 응답 필드 추가
  - frontend 공용 `NewsItem` 타입에 대응 필드 추가
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 94/94 pass |
| 런타임 통합 | ✅ | `node tmp/test_validate_news_earnings_context_step1.mjs`로 `app.db`에 `news_earnings_context` 생성 확인 |

- 관찰 사항:
  - runtime 검증 시 기존 `initDb()` 부수 로그로 `legacy FINNHUB sec_filing rows purge` 메시지가 출력됐음
  - 이번 Step 1 변경의 실패는 아니고, 기존 DB 초기화 루틴이 같이 실행되며 남긴 로그임

**작성 시각:** 19:46 (local)

### Step 2~8 결과
- 상태: 확인 대기
- 변경 파일:
  - `terminal/backend/src/services/newsRepository.ts`
  - `terminal/backend/src/services/newsEarningsContextService.ts`
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `ai_agent_plan/news_earnings_dates/plan.md`
- 구현 내용:
  - `newsEarningsContextService.ts`에 calendar-first lookup, 대표 ticker 선택(`ohlc_ticker -> 첫 ticker`), deterministic tie-break, `news_earnings_context` upsert를 구현
  - unresolved ticker만 추려 `-180일 ~ +180일` window를 병합한 global range로 FMP earnings fallback을 수행하고, 결과를 `calendar_events`에 upsert한 뒤 재조회하도록 구현
  - `POST /api/news/earnings/update-custom`, `POST /api/news/earnings/check-unconfirmed`를 추가하고 `fmp_calendar_earnings` ET 당일 freshness gate를 backend에서 강제
  - `/api/news`, `/api/news/:id`, `/api/model1/news`, `/api/model1/news/:id`에 `news_earnings_context` join과 `earnings_context_display` 응답 필드를 추가
  - News Window에 `Earnings Dates` 컬럼, `Custom Earning Date Update`, `Check Unconfirmed Earning Date` 메뉴를 추가하고 기존 calendar shortcut 3개를 제거
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정 대상 4개 코드 파일 `get_errors` 기준 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 94/94 pass |
| 런타임 게이트 | ✅ | stale 상태의 `POST /api/news/earnings/update-custom`가 `412`와 선행 액션 메시지 반환 |
| 런타임 성공 경로 | ✅ | same-day `POST /api/fmp/calendar/earnings/update` 후 custom/unconfirmed endpoint 모두 `jobId` 반환 |
| 런타임 결과 샘플 | ✅ | custom job `processed=707`, `resolved=373`, `partial=171`, `missing=163`, `fallbackTickers=135`, `fallbackMatchedRows=9` |
| API 응답 샘플 | ✅ | `/api/news?from=2026-04-17&to=2026-04-17&pageSize=10`에서 `earnings_context_display`와 raw earnings 필드 확인 |

- 관찰 사항:
  - same-day FMP earnings refresh 검증에서는 요청일 `2026-04-18`에 실제 fetched row가 0이어도 freshness gate 해제와 subsequent custom job 시작은 정상 동작했음
  - `Check Unconfirmed Earning Date` 샘플 호출은 현재 필터 결과에서 unconfirmed 재확인 대상이 없어 `candidateCount=0`으로 종료됐음. endpoint 성공 경로는 확인됐지만, non-zero unconfirmed 샘플은 별도 사용자 확인이 필요함
  - 브라우저에서 Columns 토글과 Update 메뉴를 직접 클릭하는 수동 UI 확인은 아직 남아 있으므로, 사용자 확인 전까지 이 단계도 `확인 대기`로 유지함
