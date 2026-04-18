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
