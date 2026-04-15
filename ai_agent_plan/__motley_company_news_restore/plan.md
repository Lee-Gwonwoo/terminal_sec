# Motley Company News Restore / Unblock Plan

### 목표

- 삭제 전 DB에 있던 FINNHUB `company_news`의 `MOTLEY FOOL` row를 현재 runtime DB로 안전하게 복구한다.
- 이후 `company_news` pull 경로에서 `MOTLEY FOOL`을 더 이상 차단하지 않고 일반 publisher처럼 수집되게 만든다.
- `Full Text > Company News Only`와 pull 후 자동 fulltext chaining이 `Motley Fool` 기사에도 의미 있게 동작하도록 정렬한다.
- startup 시 blocked row/evidence 정리 로직 때문에 복구 데이터가 다시 삭제되지 않도록 영구 경로를 수정한다.

### PLAN CHANGE (2026-03-28 13:15 local)

- 사용자 결정 반영:
  - D1 확정: `news_items + news_fulltext + news_change_metrics` 전부 복구
  - D2 확정: `model2` related evidence도 같이 복구
- 따라서 Step 2는 최소 복구안이 아니라 확장 복구안을 기준으로 구현한다.
- 남은 주요 설계 결정은 D3(company_news Motley fulltext 연결 방식)와 D4(backlog reset 범위)다.

### 현재 레포 상태(중요, 확인됨)

- 현재 runtime DB는 `terminal/backend/backend/data/app.db`다.
- 삭제 전 스냅샷 DB는 `before_delete/terminal/backend/backend/data/app.db`다.
- 삭제 전 DB에는 `source='FINNHUB'`, `source_type='company_news'`, `publisher like '%MOTLEY%'` 조건의 row가 507건 있다.
- 현재 runtime DB에는 같은 조건의 row가 0건이다.
- 현재 백엔드 수집 경로는 `COMPANY_NEWS_BLOCKED_PUBLISHERS = new Set(["SEEKINGALPHA", "MOTLEY FOOL"])`로 Motley를 pull 단계에서 제외한다.
- 서버 startup 시 `deleteBlockedFinnhubCompanyNews()`와 `cleanupBlockedFinnhubCompanyNewsEvidence()`가 다시 실행되어, 복구하더라도 현재 코드 상태로는 재시작 후 Motley row/evidence가 다시 삭제될 수 있다.
- 현재 `company_news` fulltext 지원 publisher는 사실상 `YAHOO`, `BENZINGA` 두 개만 allowlist로 본다.
- 반면 `fulltextExtractors.ts`에는 FMP stock news용 `THE MOTLEY FOOL` / `FOOL - INVESTING NEWS` scraper가 이미 존재한다.
- 프론트에는 이미 `Recent Company News`, `Custom Company News`, `Full Text > Company News Only` 버튼이 있다. 따라서 새 버튼 추가보다 기존 버튼 동작 의미를 Motley까지 확장하는 쪽이 우선이다.

### 제약 / 비범위

- 이번 plan은 구현 계획 문서 작성이 범위다. 아직 코드 수정, DB insert, reset, build, test는 수행하지 않는다.
- `SEEKINGALPHA` 정책 변경은 이번 범위에 자동 포함하지 않는다. 필요한 경우 별도 결정으로 분리한다.
- `model2` 결과 품질 개선 자체는 범위 밖이다. 다만 blocked evidence cleanup 영향 때문에 복구 시 재생성/정리 범위는 계획에 포함한다.
- `market_news`, `press_release`, `fmp_stock_news`, `fmp_press_release` 정책 변경은 범위 밖이다.

### 읽는 방법(비개발자/일반인 기준)

- Step 1은 "왜 복구해도 다시 사라지는지"를 막는 단계다.
- Step 2는 실제 DB 복구 범위를 정하고 row를 옮기는 단계다.
- Step 3은 앞으로 새 Motley 기사가 계속 들어오게 만드는 단계다.
- Step 4는 full text와 UI 버튼이 실제로 Motley에도 적용되는지 확인하는 단계다.
- `미확정 사항`에서 사용자가 먼저 결정해야 하는 항목을 보면 된다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- plan 수정 시: `PLAN CHANGE` 섹션에 무엇이 바뀌었는지 추가한다.
- 각 Step은 구현 → 검증 → 사용자 확인 순서로 진행한다.
- 사용자 확인 전 상태는 `⏳`, 확인 후에만 `✅`로 바꾼다.
- 이번 문서는 초안 작성 단계이므로 아직 모든 Step은 미착수(`⬜`) 또는 결정 대기(`🚫`) 상태다.

### 아키텍처(상위)

- 데이터 source of truth:
  - 현재 운영 DB: `terminal/backend/backend/data/app.db`
  - 복구 원본 DB: `before_delete/terminal/backend/backend/data/app.db`
- backend 수집 흐름:
  - frontend `Recent/Custom Company News` 버튼
  - `POST /api/news/pull-finhub`
  - `finnhubNewsProvider.ts`에서 raw item 정규화 + blocked publisher 필터
  - `newsRepository.ts`로 `news_items` insert/update
  - 새 `company_news` row가 있으면 자동으로 `news-fulltext` background job chaining
- full text 흐름:
  - manual `POST /api/news/fulltext/update` with `sourceType='company_news'`
  - `fulltextUpdateService.ts`
  - `fulltextExtractors.ts`에서 redirect origin 해석 + publisher별 extractor 선택
  - 결과 저장: `news_fulltext`
- startup 정리 흐름:
  - `server.ts` 시작 시 `deleteBlockedFinnhubCompanyNews()`
  - 이어서 `cleanupBlockedFinnhubCompanyNewsEvidence()`
  - 즉 DB 복구만 먼저 하면 다음 서버 재시작에서 재삭제될 수 있다.

### 결정/선행조건(초기에 확정 필요)

| ID | 결정 | 선택지 | 권장 | 영향 |
|----|------|--------|------|------|
| D1 | 복구 범위 | A. `news_items` 507건만, B. `news_items + news_fulltext`, C. `news_items + news_fulltext + news_change_metrics` | **확정: C** | Step 2 범위 고정 |
| D2 | evidence 처리 | A. 기존 `model2` evidence는 복구 안 함, B. related evidence도 같이 복구, C. evidence는 삭제/재계산 전제 | **확정: B** | Step 2, Step 4 |
| D3 | Motley fulltext 정책 | A. insert만 허용, fulltext는 `unavailable`, B. 기존 Motley scraper를 company_news에도 연결, C. body fallback success 허용 | B | Step 3 |
| D4 | reset 정책 | A. restore 직후 company_news fulltext reset 없이 선택 복구, B. company_news reset 후 Motley 포함 재추출, C. source filter reset 추가 구현 | A 또는 C | Step 2, Step 3 |

### 계획 중간 필수 확인

- 삭제 전 DB 기준 `MOTLEY FOOL` row 수가 여전히 507건인지 재확인한다.
- 현재 runtime DB에 Motley row가 0건인지, 그리고 startup 후에도 0건 유지되는 이유가 blocked cleanup 때문인지 로그와 SQL로 재확인한다.
- 기존 FMP stock용 Motley scraper를 company_news redirect origin URL에 그대로 재사용 가능한지 샘플 URL 3건 이상으로 검증한다.
- 복구 후 `GET /api/news`에 Motley row가 실제 노출되는지, `publisher`, `origin_url`, `fulltext`, `change metrics`가 각각 어떤 상태인지 분리 검증한다.

### 제안하는 구현 순서(이유)

1. Step 1을 먼저 해야 한다.
   이유: startup cleanup이 남아 있으면 Step 2에서 복구한 데이터가 재시작 시 바로 사라진다.
2. Step 2는 Step 1 뒤에 해야 한다.
   이유: 데이터 복구는 영속 정책이 확정된 뒤 실행해야 중복/재삭제를 피할 수 있다.
3. Step 3은 Step 2와 부분 병렬 가능하지만, 실무상 Step 2 후가 낫다.
   이유: restore row와 newly pulled row가 같은 fulltext 정책을 공유해야 결과 해석이 단순해진다.
4. Step 4는 마지막이다.
   이유: UI와 문서는 실제 backend 동작이 고정된 뒤 반영해야 드리프트가 없다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — Backend 차단/재삭제 경로 해제

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `finnhubNewsProvider.ts`에서 `MOTLEY FOOL`을 `COMPANY_NEWS_BLOCKED_PUBLISHERS`에서 제거 | `terminal/backend/src/services/finnhubNewsProvider.ts` | `tests/finnhubNewsProvider.test.ts`에 Motley company_news fetch 허용 케이스 추가 후 pass | ⏳ |
| 1-2 | startup 삭제 로직에서 Motley를 blocked 대상으로 삭제하지 않도록 수정 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/server.ts` | 서버 재시작 후 Motley sample row 유지 SQL 확인 | ⏳ |
| 1-3 | blocked evidence cleanup도 Motley를 삭제 대상에서 제거하거나 재정의 | `terminal/backend/src/services/model2AnalysisRepository.ts` | startup 후 related evidence row가 불필요 삭제되지 않는지 확인 | ⏳ |

1-1 목적: 새 company_news pull에서 Motley가 들어오게 만들기.
설명: 지금은 pull 단계에서 필터링되어 DB insert까지 가지 않으므로, 수집 차단을 먼저 없애야 한다.
완료 조건(눈으로 확인): 코드에서 blocked set에 `MOTLEY FOOL`이 없다.
사람 검증(비개발자): 소스 파일 검색 결과에 `COMPANY_NEWS_BLOCKED_PUBLISHERS`가 `SEEKINGALPHA`만 남는지 본다.
흔한 문제/주의: pull 필터는 제거했지만 startup delete가 남아 있으면 결과가 유지되지 않는다.

1-2 목적: 이미 복구된 row가 재시작 시 삭제되는 문제 제거.
설명: `deleteBlockedFinnhubCompanyNews()` SQL에서 Motley 조건을 제거하거나 정책을 더 정밀하게 바꾼다.
완료 조건(눈으로 확인): DELETE SQL에 `MOTLEYFOOL` 문자열이 없다.
사람 검증(비개발자): 서버 로그에 startup 시 Motley delete 건수가 찍히지 않는다.
흔한 문제/주의: URL 공백 삭제 규칙과 publisher 차단 규칙을 섞어서 수정하다가 빈 URL 정리까지 꺼버리면 안 된다.

1-3 목적: `model2_evidence_rows` 정리 로직과 정책 일치.
설명: news row는 살렸는데 evidence cleanup이 여전히 Motley를 지우면 분석 화면이 비일관적이 된다.
완료 조건(눈으로 확인): cleanup SQL에서 `MOTLEYFOOL`이 제거되거나 새 정책으로 대체된다.
사람 검증(비개발자): startup 이후 evidence row count가 불필요하게 줄지 않는지 SQL 숫자로 확인한다.
흔한 문제/주의: orphan evidence 정리는 유지해야 하므로 `NOT EXISTS` 조건까지 제거하면 안 된다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\terminal\backend
npm.cmd run test -- tests/finnhubNewsProvider.test.ts
npm.cmd run build
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://localhost:8080/api/news?source=FINNHUB&sources=company_news&limit=5' | ConvertTo-Json -Depth 5 } catch { $_ | Out-String }"
```

사용자 확인 필요: **예**

#### 🚫 Step 2 — 삭제 전 DB에서 Motley row 복구

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | 삭제 전 DB와 현재 DB의 대상 row 수, 중복 수, companion row 수를 다시 고정 snapshot으로 기록 | `ai_agent_plan/motley_company_news_restore/plan.md`, `ai_agent_plan/motley_company_news_restore/agent_log.md` | SQL count 결과가 문서와 일치 | ⬜ |
| 2-2 | `news_items` 507건 복구 SQL 작성 및 dry-run count 검증 | `terminal/backend/tmp_restore_motley_company_news.mjs` 또는 동등 스크립트 | insert 대상 count와 conflict count 출력 | 🚫 |
| 2-3 | `news_fulltext` 506개 기사 + `news_change_metrics` 동반 복구 SQL 작성 | `terminal/backend/tmp_restore_motley_company_news.mjs` 또는 동등 스크립트 | restored news_id 기준 companion count 일치 | 🚫 |
| 2-4 | related `model2` evidence도 같이 복구하고 summary 일관성 재검증 | `terminal/backend/tmp_restore_motley_company_news.mjs`, 관련 service/test 파일 | evidence row 정책이 문서와 실제 DB 상태에 일치 | 🚫 |

2-1 목적: 실행 전 복구 범위를 숫자로 잠그기.
설명: 507건, fulltext 506개 기사, metrics 82개 기사라는 baseline을 다시 기록한다.
완료 조건(눈으로 확인): plan/log에 baseline 숫자가 적혀 있다.
사람 검증(비개발자): 문서에 적힌 숫자와 SQL 출력이 같다.
흔한 문제/주의: 루트의 0바이트 `app.db`를 잘못 읽으면 숫자가 0으로 나와 잘못된 결론이 난다.

2-2 목적: `news_items` 복구 실행 전 conflict 없는 insert 설계.
설명: `UNIQUE(source, url)`를 깨지 않도록 `INSERT ... SELECT ... WHERE NOT EXISTS` 또는 attach DB 방식으로 처리한다.
완료 조건(눈으로 확인): dry-run 결과에 insert 예정 507, duplicate 0 또는 기대 duplicate 수가 명시된다.
사람 검증(비개발자): 출력에서 "insert 예정" 숫자를 확인한다.
흔한 문제/주의: `id`만 보고 중복 판단하면 안 되고 `source,url` 기준도 함께 확인해야 한다.

2-3 목적: 복구 데이터의 품질 열화 방지.
설명: 이번 결정은 전부 복구이므로 `news_items`뿐 아니라 `news_fulltext`, `news_change_metrics`까지 같이 옮겨 현재 화면 품질 차이를 최소화한다.
완료 조건(눈으로 확인): restored `news_id` 기준 companion count가 기대치와 맞다.
사람 검증(비개발자): 복구 전후 count 표를 보면 된다.
흔한 문제/주의: `news_change_metrics`는 기사당 여러 row라서 기사 수와 metric row 수를 혼동하면 안 된다.

2-4 목적: 분석/evidence 레이어까지 함께 복구.
설명: 이번 결정은 related `model2` evidence도 같이 복구하는 것이므로, news row와 evidence row 및 summary 집계가 함께 맞물리도록 restore 순서와 후처리를 설계한다.
완료 조건(눈으로 확인): related evidence row와 summary 집계가 복구 후 기대 수치와 일치한다.
사람 검증(비개발자): `model2` 화면 숫자가 DB 정책과 맞는지 확인한다.
흔한 문제/주의: news row만 복구하고 evidence를 그대로 두면 case summary 집계가 어긋날 수 있다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\terminal\backend
node .\tmp_restore_motley_company_news.mjs --dry-run
node .\tmp_restore_motley_company_news.mjs --execute
powershell -NoProfile -Command "@'
attach database 'C:/github_coding/terminal_sec/before_delete/terminal/backend/backend/data/app.db' as olddb;
select count(*) from main.news_items where source='FINNHUB' and source_type='company_news' and upper(coalesce(publisher,'')) like '%MOTLEY%';
'@ | sqlite3 C:/github_coding/terminal_sec/terminal/backend/backend/data/app.db"
```

사용자 확인 필요: **예**

#### ⬜ Step 3 — Motley company_news fulltext 지원 연결

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `COMPANY_NEWS_SCRAPE_PUBLISHERS` 또는 동등 allowlist에 Motley 지원 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | unit test에서 Motley company_news redirect sample이 `success` 반환 | ⬜ |
| 3-2 | 기존 FMP stock용 Motley extractor를 company_news redirect origin URL에도 재사용되도록 정렬 | `terminal/backend/src/services/fulltextExtractors.ts` | Fool origin URL 샘플 3건 이상 성공 | ⬜ |
| 3-3 | manual `Full Text > Company News Only`와 auto chaining이 restored/new Motley rows 모두 처리하는지 확인 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/fulltextUpdateService.ts` | fulltext job log에 Motley sample news id 포함 | ⬜ |
| 3-4 | 필요 시 `reset-company-news` 또는 source-filter reset 정책을 Motley 복구 시나리오에 맞게 보강 | `terminal/backend/src/server.ts`, `terminal/backend_prompt.md` | reset 후 재추출 결과가 문서와 일치 | ⬜ |

3-1 목적: company_news fulltext 경로에서 Motley를 unsupported publisher로 보지 않게 만들기.
설명: 현재는 Yahoo/Benzinga만 allowlist에 있어 Motley row가 들어와도 `unavailable`로 끝난다.
완료 조건(눈으로 확인): company_news scraper allowlist에 Motley가 있다.
사람 검증(비개발자): 검색 시 company_news 관련 allowlist에 Motley 문자열이 보인다.
흔한 문제/주의: FMP stock allowlist만 고치고 company_news allowlist를 안 고치면 manual button 결과가 그대로 `unavailable`이다.

3-2 목적: 중복 scraper 구현 회피.
설명: 이미 존재하는 Motley extractor를 company_news origin URL에도 쓰도록 재사용하면 유지보수 비용이 낮다.
완료 조건(눈으로 확인): company_news path에서도 `motleyfool-scrape` note가 나온다.
사람 검증(비개발자): sample fulltext note가 `motleyfool-scrape`인지 확인한다.
흔한 문제/주의: wrapper URL 자체가 아니라 redirect 후 `origin_url`을 extractor에 넣어야 한다.

3-3 목적: 버튼/자동 fulltext 둘 다 같은 정책으로 정렬.
설명: 사용자는 UI 버튼을 이미 갖고 있으므로 새 버튼보다 existing button semantics를 Motley까지 확장하는 것이 핵심이다.
완료 조건(눈으로 확인): manual과 auto 두 경로 모두 Motley row를 처리한다.
사람 검증(비개발자): 잡 로그에 Motley 제목 또는 news id가 나온다.
흔한 문제/주의: manual은 되는데 auto chaining만 누락되면 신규 pull에서 다시 빈 fulltext가 쌓인다.

3-4 목적: 복구 이후 backlog 재처리 경로 확보.
설명: 이미 `news_fulltext` row가 있는 restored Motley 기사에 대해 reset 없이 재처리가 안 되면 manual button이 기대대로 동작하지 않을 수 있다.
완료 조건(눈으로 확인): reset 정책이 문서와 endpoint에 맞게 정의된다.
사람 검증(비개발자): reset 후 같은 article이 다시 추출된다.
흔한 문제/주의: company_news 전체 reset은 Yahoo/Benzinga 기존 성공 row까지 비울 수 있으므로 source-filter reset이 더 안전할 수 있다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\terminal\backend
npm.cmd run test -- tests/fulltextExtractors.test.ts
powershell -NoProfile -Command "try { Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/fulltext/update' -ContentType 'application/json' -Body '{\"sourceType\":\"company_news\",\"concurrency\":3}' | ConvertTo-Json -Depth 5 } catch { $_ | Out-String }"
```

사용자 확인 필요: **예**

#### ⬜ Step 4 — Frontend / 문서 / 통합 검증 정렬

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | frontend에서 기존 Company News update / fulltext 버튼 문구와 상태가 새 정책과 모순 없는지 점검 및 필요 시 수정 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | UI 코드 리뷰 + dev 화면 확인 | ⬜ |
| 4-2 | backend spec 문서에 Motley restore/unblock/fulltext 동작을 반영 | `terminal/backend_prompt.md` | 문서 검색 시 Motley/company_news/fulltext 정책 일치 | ⬜ |
| 4-3 | plan/log와 실제 구현 결과를 동기화하고 복구 SQL/검증 명령을 agent_log에 남김 | `ai_agent_plan/motley_company_news_restore/plan.md`, `ai_agent_plan/motley_company_news_restore/agent_log.md` | 문서와 실행 결과 숫자 일치 | ⬜ |
| 4-4 | build/test/runtime/API/DB 확인을 한 세트로 마무리 | backend/frontend 관련 파일 전반 | build, test, API, DB count 모두 기대치 충족 | ⬜ |

4-1 목적: 새 버튼 추가가 아니라 기존 버튼 의미를 맞추는 것.
설명: UI에는 이미 company_news update/fulltext 버튼이 있으므로, 문구와 disabled state가 backend 새 정책과 충돌하지 않는지 본다.
완료 조건(눈으로 확인): 사용자가 보고도 "Motley는 제외인가?" 혼동이 없다.
사람 검증(비개발자): Company News 버튼 눌렀을 때 Motley 기사도 같은 흐름으로 보인다.
흔한 문제/주의: backend는 허용됐는데 preflight/modal 문구가 예전 excluded 정책을 유지할 수 있다.

4-2 목적: 운영 기준 문서 최신화.
설명: company_news fulltext 지원 publisher 목록과 blocked cleanup 정책을 현재 코드 기준으로 맞춘다.
완료 조건(눈으로 확인): spec 문서에 Motley 정책이 적혀 있다.
사람 검증(비개발자): 문서 검색에서 `Motley`와 `company_news`가 함께 나온다.
흔한 문제/주의: 코드만 바꾸고 spec 문서를 안 바꾸면 다음 작업에서 다시 삭제 정책이 복귀할 수 있다.

4-3 목적: 감사 추적 가능성 확보.
설명: restore 작업은 숫자 기반 검증이 핵심이므로 plan/log에 baseline, 실행 결과, 남은 리스크를 남긴다.
완료 조건(눈으로 확인): agent_log에 실행 시각과 row count가 기록돼 있다.
사람 검증(비개발자): 로그 문서만 봐도 무엇을 몇 건 복구했는지 알 수 있다.
흔한 문제/주의: step 완료 전 `✅`로 바꾸면 안 된다.

4-4 목적: 실제 운영 경로 확인.
설명: build/test/API/DB 쿼리/브라우저 확인까지 한 세트로 끝내야 "복구됨"을 선언할 수 있다.
완료 조건(눈으로 확인): DB count, API 응답, UI 노출이 모두 맞다.
사람 검증(비개발자): UI에서 Motley 기사 검색 후 본문 보기까지 확인한다.
흔한 문제/주의: DB에는 있는데 API 필터/정렬/프론트 상태 때문에 안 보일 수 있다.

검증 훅:

```powershell
cd C:\github_coding\terminal_sec\terminal
npm.cmd run build
npm.cmd run test
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://localhost:8080/api/news?sources=company_news&source=FINNHUB&limit=20&search=motley' | ConvertTo-Json -Depth 5 } catch { $_ | Out-String }"
```

사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D3 | company_news Motley fulltext 정책 | unsupported 유지 / 기존 Motley scraper 재사용 / fallback body 허용 | Step 3 |
| D4 | backlog 재처리 reset 범위 | 전체 company_news reset / Motley만 선택 reset / reset 없이 missing-only | Step 3 |

### 실행 의존성 그래프

Legend: `✅` 구현+사용자확인 완료 / `⏳` 구현완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 선행조건 미충족

트랙 A — 영속 정책 / 복구

```text
⏳ Step 1 — Backend 차단/재삭제 경로 해제
  ⏳ 1-1 pull 차단 해제
  ⏳ 1-2 startup delete 정책 수정
  ⏳ 1-3 evidence cleanup 정책 수정
        |
        v
🚫 Step 2 — 삭제 전 DB에서 Motley row 복구
  ⬜ 2-1 baseline 숫자 고정
  🚫 2-2 news_items 복구 SQL
  🚫 2-3 companion table 복구 SQL
  🚫 2-4 evidence 동반 복구
```

트랙 B — fulltext / UI / 문서

```text
⬜ Step 3 — Motley company_news fulltext 지원 연결
  ⬜ 3-1 company_news allowlist 추가
  ⬜ 3-2 기존 Motley extractor 재사용
  ⬜ 3-3 auto/manual fulltext 경로 확인
  ⬜ 3-4 reset 정책 정리 (D4 영향)
        |
        v
⬜ Step 4 — Frontend / 문서 / 통합 검증 정렬
  ⬜ 4-1 기존 버튼 semantics 점검
  ⬜ 4-2 backend_prompt 갱신
  ⬜ 4-3 plan/log 동기화
  ⬜ 4-4 build/test/API/DB/UI 검증
```

차단 구간:

```text
┌──────────────────────────────────────────────────────────────┐
│ BLOCKED: Step 2는 Step 1 완료 전 실행하면 startup 재삭제 위험이 있음 │
│ 이유: pull 차단, startup delete, evidence cleanup 정책이 현재 남아 있음 │
│ 즉 restore를 먼저 해도 서버 재시작 또는 maintenance 흐름에서 재삭제 가능 │
└──────────────────────────────────────────────────────────────┘
```

병렬 트랙 요약

- 트랙 A는 데이터 보존과 복구를 다룬다.
- 트랙 B는 fulltext/UX/문서 정렬을 다룬다.
- 실무상 Step 3 일부는 Step 2와 병렬 가능하지만, runtime 재삭제 정책을 제거한 Step 1 완료가 선행돼야 안전하다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D4 | 3-4 | 전체 reset / Motley 선택 reset / no reset |

### 결정 #1 — 복구 범위(상세)

- 최소안: `news_items` 507건만 복구
  - 장점: 빠르고 안전하다.
  - 단점: fulltext/change 품질이 현재 데이터와 달라진다.
- 표준안: `news_items + news_fulltext` 복구
  - 장점: 기사 본문 상태까지 대체로 복원된다.
  - 단점: Motley fulltext가 대부분 `unavailable` 상태라 Step 3 재추출 정책이 필요하다.
- 확장안: `news_items + news_fulltext + news_change_metrics` 복구
  - 장점: 기존 UI 표시 품질을 가장 잘 복원한다.
  - 단점: metric row가 기사당 다수라 검증이 더 까다롭다.

확정: 확장안(C). 이미 schema 호환성이 확인됐고, 중복 URL도 0건이었기 때문에 runtime 품질 일관성 면에서 가장 낫다.

### 결정 #1-1 — Evidence 복구 범위(상세)

- 확정: related `model2` evidence도 같이 복구
- 이유:
  - user decision이 이미 "2. 도 같이 복구"로 확정됨
  - news row만 복구하면 evidence/summaries와 화면 숫자가 어긋날 수 있음
  - startup cleanup 정책을 함께 수정하는 Step 1과 묶어서 가야 일관성이 생김
- 주의:
  - orphan evidence는 복구 대상이 아니므로 `news_id` 매칭 기준이 살아 있는 row만 옮긴다.
  - evidence를 같이 복구하면 `model2_case_summaries` 재집계 또는 invalidate 후 재생성이 필요할 수 있다.

### 결정 #2 — Motley company_news fulltext 정책(상세)

- unsupported 유지
  - 장점: 구현량이 가장 적다.
  - 단점: 사용자가 요청한 "fulltext update 버튼도" 요구를 사실상 충족하지 못한다.
- 기존 Motley scraper 재사용
  - 장점: FMP stock path에 이미 있는 extractor를 재사용하므로 구현량이 낮고 요구 충족도가 높다.
  - 단점: company_news redirect origin 샘플에서 selector 안정성을 다시 검증해야 한다.
- body fallback 허용
  - 장점: 성공률은 높아진다.
  - 단점: 현재 company_news 정책과 충돌하고, 실제 원문 확보와 summary fallback이 다시 섞인다.

권장: 기존 Motley scraper 재사용(B).