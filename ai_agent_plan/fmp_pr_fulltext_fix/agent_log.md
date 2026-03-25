## 2026-03-24

**작성 시각:** 2026-03-24 21:02 (local)

### 작업 시작
- 요청: FMP PR full text가 실제 기사 본문을 저장하도록 plan 생성 후 구현.
- 현재 확인된 사실:
  - `fmp_press_release` success fulltext 대부분이 `body-fallback (no-scraper: ...)`
  - DB 샘플 기준 `news_fulltext.full_text == news_items.body`
  - GlobeNewswire / PRNewswire는 live HTML에서 본문 컨테이너 확인 가능
  - Business Wire는 서버 fetch 기준 anti-bot / error shell 응답
- 생성 파일:
  - `ai_agent_plan/fmp_pr_fulltext_fix/plan.md`
  - `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md`
- 상태: 계획 작성 완료, 구현 진행 중 (확인 대기)

**작성 시각:** 2026-03-24 21:11 (local)

### 구현 및 검증
- 변경 파일:
  - `terminal/backend/src/services/fulltextExtractors.ts`
  - `terminal/backend/src/services/fulltextRepository.ts`
  - `terminal/backend/src/services/fulltextUpdateService.ts`
  - `terminal/backend/src/server.ts`
  - `terminal/backend/tests/fulltextExtractors.test.ts`
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- 구현 내용:
  - `GlobeNewswire`, `PRNewswire` page scraper 추가
  - `fmp_press_release` 전용 fulltext backfill 대상 조회 추가
  - `POST /api/news/fulltext/update` 응답 `total`도 전용 backfill 기준으로 맞춤
  - 관련 unit test와 prompt/spec 동기화
- 런타임 확인:
  - `POST /api/news/fulltext/update` with `sourceType='fmp_press_release'` 응답 `total=6412`
  - job 로그에서 수천 건 대상 재추출 시작 확인
  - DB에서 `prnewswire-scrape`, `globenewswire-scrape` note 생성 확인 (`79`, `65`건 샘플 시점)
  - DB 샘플에서 `full_len`이 `body_len`보다 크게 증가하고 `same_text=0` 확인
- 잔여 리스크:
  - `Business Wire`는 anti-bot 때문에 이번 구현에서도 fallback 가능
  - 장시간 fulltext batch는 외부 site rate/차단 영향을 받을 수 있음

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `fulltextExtractors.ts`, `fulltextRepository.ts`, `fulltextUpdateService.ts`, `server.ts`, test 파일 모두 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build` 성공, frontend `vite build` 성공 |
| 자동 테스트 | ✅ | backend `vitest run` 12 files / 66 tests pass |
| 런타임 통합 | ✅ | `POST /api/news/fulltext/update` (`fmp_press_release`) 호출, job 로그/DB note/샘플 row 변화 확인 |

- 상태: 구현 완료, 사용자 확인 대기 (awaiting user confirmation)