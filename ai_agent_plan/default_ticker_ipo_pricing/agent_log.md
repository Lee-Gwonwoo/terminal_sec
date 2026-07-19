# Default Ticker IPO Pricing 작업 로그

## 2026-06-19

**작성 시각:** 2026-06-19 13:42 (local)

### 작업 요약
- Default Ticker의 기존 IPO date 흐름을 확장해 FMP IPO pricing 전용 업데이트 경로를 추가했다.
- `company_profiles`에 IPO 확정 공모가와 price range 저장 컬럼을 추가했다.
- FMP `stable/ipos-calendar`의 `priceRange`와 `stable/ipos-prospectus`의 `pricePublicPerShare`를 결합해 `source='fmp_ipo'`로 저장하도록 backend endpoint를 추가했다.
- 기존 데이터가 있는 ticker는 기본적으로 제외하고, FMP가 값을 주지 않는 경우에는 가짜 값을 만들지 않고 빈칸으로 남기도록 했다.
- Default Ticker UI와 Data Control UI에 IPO pricing 업데이트 버튼/상태/로그와 `IPO Price`, `Price Range` 컬럼을 추가했다.
- 관련 backend/frontend 설명 문서를 한국어 중심으로 갱신했다.

### 변경 파일
- `terminal/backend/src/db.ts`
- `terminal/backend/src/services/companyProfileRepository.ts`
- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/dataControlHowToUse.ts`
- `terminal/backend_prompt.md`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

### 실행/검증
| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | backend/frontend 관련 수정 파일 `get_errors` 0 errors |
| 빌드 | ✅ | `terminal` backend `npm run build` 성공, frontend `npm run build` 성공 |
| 자동 테스트 | ✅ | backend `npm run test` 성공, 17 files / 104 tests pass |
| 런타임 통합 | ✅ | `POST /api/company-profiles/pull-ipo-pricing`를 `MOBI` 단일 ticker로 호출해 job 완료 확인. `missingPricing=1`로 FMP 값 없음이 정상 처리됨. `GET /api/tickers`에서 `MOBI`의 `ipoOfferPrice:null`, `ipoPriceRange:null` 응답 확인. 브라우저 시각 확인은 코드 리뷰 + API 검증으로 대체, 시각 확인은 사용자 확인 대기. |

### 발견된 문제와 처리
- `MOBI`는 FMP calendar/prospectus 응답은 조회됐지만 공모가/range 매칭값이 없어서 저장 row를 만들지 않았다. 이는 "다운받을 데이터가 없는 것은 그냥 비워놓기" 요구와 일치한다.
- PowerShell inline `node -e` quoting이 여러 번 깨졌다. 이후 live DB 경로를 확인하고 endpoint/job 결과 및 `/api/tickers` 응답 중심으로 검증했다.
- 실제 live DB 기본 경로는 dev task cwd 기준 `terminal/backend/backend/data/app.db`였다.

### 사용자 확인 상태
- 구현과 자체 검증은 완료.
- Default Ticker/Data Control 화면에서 버튼과 컬럼이 실제로 보이는지에 대한 사용자 시각 확인은 확인 대기(awaiting user confirmation).
