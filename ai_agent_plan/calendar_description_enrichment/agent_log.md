# Agent Log — Calendar 회사 Description 강화

## 2026-05-29
**작성 시각:** 2026-05-29 13:26 (local)

- 작업: `ai_agent_plan/calendar_description_enrichment/` plan 폴더를 생성하고, `plan.md`와 `snow_description_sample.md`를 작성했다.
- 참고 skill: `.github/copilot-skills/planning.md`.
- 확인한 현재 데이터:
  - SNOW Yahoo description은 존재하지만 구체 product/service와 실적 체크 포인트가 부족하다.
  - SNOW Finnhub peers는 `NET`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`로 확인됐고, 직접 peer와 read-through가 섞여 있다.
- 산출물:
  - `plan.md`: description 강화 layer, peer category, backend/frontend 적용 계획.
  - `snow_description_sample.md`: SNOW 상세 description, 짧은 UI 버전, 실적 체크 포인트, peers 재분류.
- 검증 상태: `Test-Path`로 `plan.md`, `snow_description_sample.md` 존재를 확인했고, `Select-String`으로 `Cortex`, `Snowpark`, `Streamlit`, `peer`, `product revenue` 핵심 키워드 포함을 확인했다. VS Code diagnostics 기준 해당 plan 폴더 오류는 0개다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 13:35 (local)

- 작업: default universe 전체 ticker를 industry별로 구분하고, AI/tech 관련 industry를 우선 배치한 뒤 각 industry 내부를 market cap 내림차순으로 정렬했다.
- 기준 데이터:
  - DB `ticker_universes.name = default` 기준 전체 2,278개 ticker.
  - source path: `tradigview_screener/original_data/watch lists2_2026-02-22.csv`.
  - 최신 non-null `company_profiles.market_cap` coverage: 2,276/2,278개.
  - 전체 industry 수: 141개.
- 산출물:
  - `default_ticker_industry_priority.md`: 전체 default ticker industry inventory 및 industry별 전체 ticker 목록.
  - `plan.md`: `Default ticker industry 작성 큐` 섹션과 Step 0-4 추가.
- 우선 작성 대상: AI/tech 관련 16개 industry, 총 624개 ticker. 처리 순서는 `default_ticker_industry_priority.md`의 market cap 내림차순을 따른다.
- 검증 상태: 파일 생성 후 한글 헤더 깨짐과 section heading 구분자 깨짐을 수정했다. `grep_search`로 `?` 잔여 문자가 없음을 확인했고, `Select-String`으로 plan의 `Default ticker industry 작성 큐`, `0-4`, 상세 파일의 `전체 ticker 수: 2,278개`, `Industry별 전체 Ticker 목록`, `### 001. Semiconductors - 80 tickers` 포함을 확인했다. VS Code diagnostics 기준 해당 plan 폴더 오류는 0개다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 13:49 (local)

- 작업: `LWLG`의 현재 default universe 분류를 확인하고, AI/tech 다음 2차 실행 큐로 우주/방산 industry/subset 정리를 추가했다.
- 확인 결과:
  - `LWLG`는 default universe에 포함되어 있다.
  - 현재 공식 분류는 sector `Basic Materials`, industry `Chemicals - Specialty`다.
  - 최신 market cap은 약 `$2.4B`로 확인됐다.
- 산출물:
  - `default_ticker_industry_priority.md`: `Space/Defense 우선 Industry 순서`와 `LWLG 분류 확인` 섹션 추가.
  - `plan.md`: 2차 Space/Defense 작성 큐와 Step 0-5 추가.
- 우주/방산 큐 기준:
  - 2차 core industry는 `Aerospace & Defense` 70개 ticker.
  - `Communication Equipment`, `Hardware, Equipment & Parts`, `Information Technology Services`, `Computer Hardware`, `Scientific & Technical Instruments`, `Industrial - Machinery` 안의 우주/방산 후보는 subset tag로 관리한다.
- 검증 상태: `Select-String`으로 상세 inventory의 `Space/Defense 우선 Industry 순서`, `Aerospace & Defense`, `LWLG`, `Chemicals - Specialty` 포함을 확인했다. plan에서도 `2차 Space/Defense`, `0-5`, `LWLG`, `Aerospace & Defense` 반영을 확인했다. VS Code diagnostics 기준 해당 plan 폴더 오류는 0개다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 14:04 (local)

- 작업: 사용자의 “AI부터 실행” 지시에 따라 Calendar description enrichment pilot을 구현하고 AI/data-center 핵심 12개 ticker를 먼저 저장했다.
- 중복 처리 결정:
  - `company_profile_enrichment.security_id`를 unique 기준으로 사용한다.
  - 이미 `enhanced_description`이 있는 ticker는 기본 실행에서 description을 다시 쓰지 않고 `tags_json`만 병합한다.
  - 같은 ticker가 AI/tech와 우주/방산 subset에 동시에 걸리면 기존 row를 재사용한다.
- 구현/수정 파일:
  - `terminal/backend/src/db.ts`: `company_profile_enrichment` 테이블과 index 추가.
  - `terminal/backend/src/services/companyProfileEnrichmentRepository.ts`: get/upsert, peer group JSON parsing, 중복 skip 로직 추가.
  - `terminal/backend/src/scripts/seedCompanyProfileEnrichment.ts`: AI/tech pilot seed 12개 작성.
  - `terminal/backend/package.json`: `seed:company-enrichment` script 추가.
  - `terminal/backend/src/server.ts`: `/api/company-profiles/:ticker`에 enrichment 필드 병합.
  - `terminal/backend/src/services/calendarRepository.ts`: Calendar metadata에 enhanced/short description, peer groups, tags 병합. raw provider description과 raw peers는 보존.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/companyDescription.ts`: frontend 타입/cache parser 확장.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CompanyDescriptionHoverPreview.tsx`: hover popup에 강화 description, Products/Watch/Risks, 첫 peer group 표시.
  - `ai_agent_plan/calendar_description_enrichment/plan.md`: AI-first pilot 및 중복 skip 원칙 반영.
  - `ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md`: 중복 처리 원칙 추가.
- seed 결과:
  - 1회차: `NVDA, AVGO, AMD, MU, DELL, SMCI, HPE, ANET, CRDO, VRT, PLTR, SNOW` 총 12개 inserted.
  - 2회차 재실행: 12개 모두 `skipped_existing`, description 재작성 없음 확인.
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 backend/frontend/plan 폴더 오류 0개 |
| 빌드 | ✅ | backend `npm.cmd run build` 성공, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `npm.cmd run test`: 17 files / 104 tests passed |
| 런타임 통합 | ✅ | `/api/company-profiles/SNOW`에서 `enhanced_description`, `products`, `watch_points`, `enrichment_tags` 확인. `/api/calendar/events?type=earnings&tickers=SNOW&limit=1`에서 `company_description`, `raw_company_description`, `peer_groups`, 소문자 `enrichment_tags` 확인. 공유 브라우저 page fetch로 SNOW `hasEnhancedDescription=true`, products 6개, peerGroups 2개 확인 |

- 주의/리스크:
  - seed script 실행 중 기존 `initDb()` migration 로그 `[db] purged legacy FINNHUB sec_filing rows: news_items=0, sec_filings=70635`가 반복 출력됐다. 이번 변경 로직은 아니지만, 기존 purge 로그/조건은 후속 점검 후보로 남긴다.
  - 현재 AI seed는 12개 pilot이며, AI/tech 전체 624개 자동 생성은 아직 하지 않았다.
  - Calendar peers column의 category chip UI(4-3)는 아직 후속 단계로 남겨 두었다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 14:13 (local)

- 작업: 사용자가 DB raw peers 정확도 문제와 SNOW/OKTA 대칭성 문제를 지적해, peers 전면 정리 방향을 plan에 반영했다.
- 확인 결과:
  - `SNOW` Finnhub raw peers는 `NET`, `SNOW`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`다.
  - `OKTA` Finnhub raw peers는 `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`, `DOCN`, `FSLY`, `NET`다.
  - 두 raw peers 목록 모두 broad cloud/software 후보를 섞고 자기 자신을 포함하므로 source of truth로 쓰면 안 된다.
- 결정/반영:
  - raw `company_profiles.peers_json`은 삭제하지 않고 provider evidence로만 보존한다.
  - 사용자 화면과 관련주 정리는 curated `company_peer_edges` 또는 동등 graph를 우선 사용하도록 plan을 변경했다.
  - 관련 정도는 A/B/C/EXCLUDE 등급으로 나눈다.
  - A등급 direct peer는 기본 양방향 edge, B/C등급 read-through/theme overlap은 방향성과 reason을 명시한다.
- 수정 파일:
  - `ai_agent_plan/calendar_description_enrichment/plan.md`
- 검증 상태: `Select-String`으로 `SNOW/OKTA peers 대칭성`, `Peer 등급 기준`, `company_peer_edges`, `1-4` 반영을 확인했다. VS Code diagnostics 기준 plan.md 오류는 0개다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 14:42 (local)

- 작업: 사용자의 “현재 default ticker peers 데이터를 전부 다시 정리하고 Calendar Window column에 추가” 요청에 따라 default universe 전체용 curated peer graph 1차 버전을 구현했다.
- 적용한 기준:
  - raw `company_profiles.peers_json`은 삭제하지 않고 evidence로만 보존한다.
  - broad industry만 같은 후보는 A로 승격하지 않고 기본 B로 둔다.
  - exact industry가 아닌 raw provider 후보는 C `weak_provider_candidate`로 낮춰 둔다.
  - curated enrichment의 core peer group만 A 직접 peer로 승격한다.
- 구현/수정 파일:
  - `terminal/backend/src/db.ts`: `company_peer_edges` table/index 추가.
  - `terminal/backend/src/services/companyPeerRepository.ts`: edge replace/get repository 추가.
  - `terminal/backend/src/scripts/seedCompanyPeerEdges.ts`: default universe baseline peer graph generator 추가.
  - `terminal/backend/package.json`: `seed:company-peers` script 추가.
  - `terminal/backend/src/services/calendarRepository.ts`: Calendar API 응답에 `curated_peers` 배열 추가.
  - `terminal/backend/src/server.ts`: `/api/company-profiles/:ticker` 응답에 `curated_peers` 추가.
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`: `Curated Peers` column과 A/B/C chip renderer 추가.
  - `ai_agent_plan/calendar_description_enrichment/plan.md`: Step 5 및 구현 상태 반영.
- seed 결과:
  - source/version: `default_universe_baseline/v1`.
  - default tickers loaded/processed: 2,278/2,278.
  - inserted edges: 27,985.
  - visible peer coverage: 2,276/2,278.
  - grade counts: `A=782`, `B=20,830`, `C=4,846`, `EXCLUDE=1,527`.
- 샘플 확인:
  - `SNOW` curated A: `MDB`, `ORCL`, `TDC`, `PLTR`; B: cloud platform adjacent 및 broad same-industry adjacent; C: raw provider weak candidates.
  - `SNOW -> OKTA`는 `C / weak_provider_candidate`로 확인했다.
  - `OKTA` raw broad software/infrastructure peers는 A가 아니라 B/C로 내려갔다.
- 검증 결과:

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `get_errors` 기준 수정 backend/frontend 파일 오류 0개 |
| backend build | ✅ | `npm.cmd run build` 성공 |
| backend tests | ✅ | 17 files / 104 tests passed |
| frontend build | ✅ | Vite build 성공 |
| seed/runtime DB | ✅ | `npm.cmd run seed:company-peers` 성공, `company_peer_edges` 27,985개 확인 |
| API | ✅ | `/api/calendar/events?type=earnings&tickers=SNOW&limit=1`와 `/api/company-profiles/SNOW`에서 `curated_peers` 확인 |
| dev server | ✅ | backend task와 webui task를 재시작했고 Web UI는 `http://localhost:5173/`에서 실행 중 |

- 주의/리스크:
  - 이 결과는 사람이 2,278개를 모두 수동 검수한 최종 peer list가 아니라, default universe 전체를 덮는 deterministic baseline v1이다.
  - broad industry 분류가 너무 넓은 ticker는 B/C로 보수 처리했지만, product-level 수동/AI 검수로 A 후보를 추가 승격해야 한다.
  - seed script 실행 중 기존 `initDb()` migration 로그 `[db] purged legacy FINNHUB sec_filing rows: news_items=0, sec_filings=70635`가 다시 출력됐다. 기존 동작으로 기록하며 이번 peer graph 자체의 삭제 로직은 `company_peer_edges` source/version 범위에만 적용된다.
- 사용자 확인 상태: 확인 대기.

## 2026-05-29
**작성 시각:** 2026-05-29 14:50 (local)

- 작업: 사용자가 `Curated Peers` 셀 클릭 시 약한 관련주까지 더 보이게 해달라고 요청해, Calendar Window의 `curated_peers` 셀을 클릭 토글 방식으로 변경했다.
- 구현 내용:
  - 접힌 상태: 기존처럼 상위 12개 chip과 `+N` 요약을 표시한다.
  - 펼친 상태: 같은 row 안에서 A/B/C 전체 peer chip을 표시한다. `EXCLUDE` edge는 계속 숨긴다.
  - 다시 클릭하면 접힌 상태로 돌아간다.
  - keyboard 접근성을 위해 셀 컨테이너를 `button`으로 만들고 `aria-expanded`를 붙였다.
- 수정 파일:
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CalendarWindow.tsx`
  - `ai_agent_plan/calendar_description_enrichment/plan.md`
- 검증 결과:
  - `get_errors` 기준 `CalendarWindow.tsx` 오류 0개.
  - frontend `npm.cmd run build` 성공.
- 사용자 확인 상태: 확인 대기.
