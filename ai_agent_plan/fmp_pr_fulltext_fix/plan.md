### 목표
- FMP press release full text가 provider snippet이 아니라 실제 기사 페이지 본문을 저장하도록 수정한다.
- 신규 FMP PR pull뿐 아니라 기존 `body-fallback (no-scraper: ...)` success 행도 재추출 가능하게 만든다.

### 현재 레포 상태(중요, 확인됨)
- FMP PR ingest는 `terminal/backend/src/services/fmpPressReleaseProvider.ts`에서 `[][][]body[][][]`에 `item.text`를 그대로 넣는다.
- FMP PR pull 직후 `terminal/backend/src/server.ts`에서 새 row를 full text 추출 큐에 넣는다.
- full text 추출은 `terminal/backend/src/services/fulltextUpdateService.ts`가 `extractByDomain(url, publisher, body)`를 호출한다.
- 현재 `terminal/backend/src/services/fulltextExtractors.ts`는 `NASDAQ`, `TMX`, `SEC/EDGAR`, `FINNHUB`만 명시 처리한다.
- 따라서 `GlobeNewswire`, `PRNewswire`, `Business Wire`는 전부 default 분기로 빠져 `bodyFallback`으로 success 저장된다.
- 런타임 DB 확인 결과 `source_type='fmp_press_release'` success 6506건 모두 `news_fulltext.full_text == news_items.body`였다.

### 제약 / 비범위
- 이번 작업은 FMP PR full text 추출 개선에 한정한다.
- FMP PR 뉴스 수집 범위, ticker paging 정책, change update 로직은 바꾸지 않는다.
- 다른 provider(`RTPR` 포함)의 기사 body를 FMP PR fulltext에 재사용하지 않는다.
- `Business Wire`는 현재 plain HTTP fetch가 차단되므로 브라우저 기반 fallback을 쓰되, 실패 시에는 명확한 note를 남기고 조용히 우회하지 않는다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`: 무엇이 문제인지와 어디를 고칠지 정리
- `Step 2`: 실제 기사 페이지 본문을 뽑는 extractor 추가
- `Step 3`: 예전에 잘못 저장된 FMP PR full text도 다시 뽑을 수 있게 백필 경로 추가
- `Step 4`: 문서 반영
- `Step 5`: 빌드/테스트/API/DB로 실제 동작 검증

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 구현 중 범위/접근이 바뀌면 `PLAN CHANGE` 메모를 추가한다.
- 각 Step 완료 후 검증 결과를 남기고, `agent_log.md`에는 `확인 대기` 상태로 기록한다.
- 사용자 확인 전에는 Step 상태를 `⏳`로 유지한다.

### PLAN CHANGE — 2026-03-24 21:20
- 변경 내용: `POST /api/news/fulltext/update`에서 `fmp_press_release` special-case 재추출을 제거하고, stale FMP PR fallback success row는 별도 reset endpoint로 삭제 후 regular missing-only update를 다시 실행하는 구조로 바꾼다.
- 변경 이유: `update` semantics를 미래 재사용 기준에서도 일관되게 `missing-only`로 유지해야 한다.
- 영향: FMP PR 회복 절차가 `reset-fmp-pr-fallback -> fulltext/update(fmp_press_release)` 2단계로 바뀐다.

### PLAN CHANGE — 2026-03-24 21:41
- 변경 내용: `RTPR` 기사 body를 이용해 FMP PR fulltext를 보강하는 접근은 폐기하고, `FMP 신규 뉴스`를 대상으로 직접 원문 추출하는 방식만 유지한다.
- 변경 이유: 사용자가 `fmp 는 새로운 뉴스를 대상으로 데이터를 받는 거다`라고 명시했고, 다른 소스 기사 body 재사용은 데이터 소스 경계를 흐린다.
- 영향:
  - `Business Wire`는 외부 페이지 직접 fetch가 차단되므로 브라우저 기반 fallback을 추가한다.
  - `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`는 직접 extractor를 추가한다.
  - reset 대상은 새로 직접 추출 가능한 wire publisher 전체로 확장한다.

### 아키텍처(상위)
- 입력: FMP PR API 응답 (`symbol`, `title`, `text`, `publishedDate`, `url`, `publisher`)
- 저장 1차: `news_items`
- 저장 2차: `news_fulltext`
- 신규 pull 경로:
  - `fmpPressReleaseProvider.ts` → `server.ts` pull route → `extractAndPersistFulltext()` → `news_fulltext`
- 재추출 경로:
  - `POST /api/news/fulltext/reset-fmp-pr-fallback` → stale FMP PR fallback row 삭제
  - `POST /api/news/fulltext/update` → missing-only update → `extractAndPersistFulltext()`

### 결정/선행조건(초기에 확정 필요)
- 결정 1: 신규 extractor 우선순위
  - 선택: `GlobeNewswire`, `PRNewswire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`는 직접 extractor 구현
  - 이유: server-side fetch 응답에서 실제 본문 영역 확인 가능
- 결정 2: `Business Wire`
  - 선택: 다른 소스 재사용 없이 브라우저 기반 fallback을 추가
  - 영향: plain fetch 차단 환경에서도 FMP 신규 기사 기준 직접 원문 추출을 시도할 수 있음
- 결정 3: 기존 success row 재처리 기준
  - 선택: `update`는 missing-only 유지, 기존 잘못된 success row는 reset endpoint로 삭제 후 재추출

### 계획 중간 필수 확인
- live HTML에서 GlobeNewswire / PRNewswire 컨테이너 선택자가 실제 본문만 가져오는지 샘플로 재확인
- fulltext update 경로가 기존 success fallback row를 실제로 다시 집는지 DB 쿼리로 검증

### 제안하는 구현 순서(이유)
1. extractor를 먼저 추가해야 신규 pull 품질이 즉시 개선된다.
2. 그 다음 재추출 쿼리를 추가해야 기존 데이터도 회복된다.
3. 마지막에 문서와 검증을 맞추면 런타임/문서 드리프트를 줄일 수 있다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — 계획 고정 및 대상 추출기 범위 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | root cause와 구현 범위를 plan에 기록 | `ai_agent_plan/fmp_pr_fulltext_fix/plan.md` | plan 파일 생성/내용 확인 | ⏳ |
| 1-2 | 작업 로그 파일 생성 및 초기 상태 기록 | `ai_agent_plan/fmp_pr_fulltext_fix/agent_log.md` | log 파일 생성/내용 확인 | ⏳ |

- 1-1 목적: 구현 전에 문제 정의와 비범위를 고정한다.
  설명: FMP PR fulltext가 body fallback success로 저장되는 구조를 문서화하면 이후 변경 의도가 명확해진다.
  완료 조건(눈으로 확인): plan 문서에 root cause, 범위, Step별 계획이 보인다.
  사람 검증(비개발자): plan 파일을 열어 `GlobeNewswire`, `PRNewswire`, `Business Wire` 처리 방향이 적혀 있는지 본다.
  흔한 문제/주의: 구현 범위를 너무 넓게 잡아 unrelated provider 수정으로 번지지 않게 한다.
- 1-2 목적: 구현 이력을 시간순으로 추적 가능하게 만든다.
  설명: 파일/결정/검증 결과를 append 방식으로 기록한다.
  완료 조건(눈으로 확인): agent_log 파일에 작성 시각과 현재 계획이 기록되어 있다.
  사람 검증(비개발자): `작성 시각`과 작업 목적이 보이면 된다.
  흔한 문제/주의: 기존 로그 재정렬 금지, append만 허용.

검증 훅:
```text
- plan.md / agent_log.md 파일 존재 확인
- 내용에 FMP PR fulltext 문제와 구현 방향이 반영됐는지 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — wire publisher 직접 원문 extractor 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | GlobeNewswire extractor 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | extractor unit test + 샘플 URL runtime 확인 | ⏳ |
| 2-2 | PRNewswire extractor 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | extractor unit test + 샘플 URL runtime 확인 | ⏳ |
| 2-3 | Newsfile/Accesswire/MCAP extractor 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | extractor unit test + 샘플 URL runtime 확인 | ⏳ |
| 2-4 | Business Wire 브라우저 fallback extractor 추가 | `terminal/backend/src/services/fulltextExtractors.ts`, `terminal/backend/package.json` | extractor unit test + 샘플 URL runtime 확인 | ⏳ |
| 2-5 | publisher dispatcher에 새 분기 연결 | `terminal/backend/src/services/fulltextExtractors.ts` | `extractByDomain()` 호출 결과 note/status 확인 | ⏳ |

- 2-1 목적: GlobeNewswire 기사 페이지 본문을 snippet 대신 실제 문장 단위 텍스트로 저장한다.
  설명: `main-body-container` 계열 컨테이너 우선, 길이 기반 fallback 보조를 둔다.
  완료 조건(눈으로 확인): GlobeNewswire 샘플에서 결과 길이가 기존 144자보다 크게 늘어난다.
  사람 검증(비개발자): 추출 결과에 제목 뒤로 긴 본문 문단이 이어지는지 본다.
  흔한 문제/주의: 추천 기사/푸터까지 붙지 않도록 말단 노이즈를 잘라야 한다.
- 2-2 목적: PRNewswire 기사 페이지의 실제 release body를 저장한다.
  설명: `section.release-body` 중심으로 본문만 선택하고 공유/푸터 문구는 제외한다.
  완료 조건(눈으로 확인): PRNewswire 샘플에서 기존 1003자보다 유의미하게 긴 본문이 나온다.
  사람 검증(비개발자): body 텍스트가 기사 첫 문단 뒤로 계속 이어지는지 확인한다.
  흔한 문제/주의: 상단 navigation/marketing copy가 섞이지 않게 selector 범위를 좁힌다.
- 2-3 목적: FMP PR에서 자주 나오는 추가 wire publisher도 직접 본문 추출로 커버한다.
  설명: `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`는 server-side HTML에서 본문 영역만 추출한다.
  완료 조건(눈으로 확인): 해당 publisher 샘플의 `full_len`이 body snippet보다 유의미하게 길어진다.
  사람 검증(비개발자): 추출 결과에 실제 release 문단이 이어지고 사이트 footer/navigation이 과도하게 섞이지 않는지 본다.
  흔한 문제/주의: cookie banner, footer, newsroom promo 섹션이 같이 들어오기 쉽다.
- 2-4 목적: `Business Wire`도 다른 소스 재사용 없이 직접 원문 추출 대상에 포함한다.
  설명: plain fetch 실패 시 브라우저 기반 fallback으로 페이지를 렌더링하고 본문 영역을 추출한다.
  완료 조건(눈으로 확인): `Business Wire` 샘플에서 `body-fallback`이 아닌 전용 note와 함께 더 긴 본문이 저장된다.
  사람 검증(비개발자): 기존 400~500자 snippet 대신 수천 자 본문이 보이는지 확인한다.
  흔한 문제/주의: 브라우저 실행 비용, 차단 페이지가 계속 나오는 경우 timeout/실패 처리 명확화 필요.
- 2-5 목적: 새 extractor가 실제 런타임 경로에서 호출되게 한다.
  설명: publisher name normalize 결과가 live DB 값과 맞아야 한다.
  완료 조건(눈으로 확인): extraction note가 `globenewswire-*`, `prnewswire-*` 식으로 바뀐다.
  사람 검증(비개발자): 새로 뽑은 full text note가 더 이상 `body-fallback (no-scraper: ...)`가 아니면 된다.
  흔한 문제/주의: publisher casing/spacing 차이로 default 분기로 빠지지 않게 한다.

검증 훅:
```text
- backend tests: fulltext extractor 관련 테스트 통과
- 샘플 GlobeNewswire / PRNewswire URL에 대해 추출 결과 길이 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — 기존 FMP PR fallback success 행 삭제(reset) 경로 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | FMP PR stale fallback row 삭제 함수 추가 | `terminal/backend/src/services/fulltextRepository.ts` | 삭제 대상 조건/건수 확인 | ⏳ |
| 3-2 | reset endpoint 추가 후 missing-only update semantics 복원 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/fulltextUpdateService.ts` | reset 응답 + update total 확인 | ⏳ |
| 3-3 | UI에 reset 후 retry 경로 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 메뉴 문구/동작 확인 | ⏳ |

- 3-1 목적: 미래에도 재사용 가능한 방식으로 잘못된 기존 row만 선택 삭제한다.
  설명: 직접 추출 가능해진 wire publisher의 stale fallback success row만 지워서 missing-only update의 의미를 보존한다.
  완료 조건(눈으로 확인): reset endpoint가 삭제 건수를 반환한다.
  사람 검증(비개발자): reset 실행 후 deleted count가 보이면 된다.
  흔한 문제/주의: 직접 extractor가 아직 불안정한 publisher까지 섣불리 포함하면 삭제 후 다시 빈 값이 남을 수 있다.
- 3-2 목적: `update` semantics를 원래 의미로 되돌린다.
  설명: `fmp_press_release`도 다시 row 없는 id만 대상으로 동작하게 한다.
  완료 조건(눈으로 확인): reset 없이 `FMP PR Only`를 실행하면 기존 row는 건드리지 않는다.
  사람 검증(비개발자): update total이 missing row 기준으로만 잡히면 된다.
  흔한 문제/주의: route 응답 total과 job 내부 대상이 다시 어긋나지 않게 한다.
- 3-3 목적: 사용자가 reset 후 retry 흐름을 UI에서 바로 쓸 수 있게 한다.
  설명: `Reset FMP PR Fallback` 메뉴를 추가하고, 삭제 후 `FMP PR Only`를 이어서 실행한다.
  완료 조건(눈으로 확인): Full Text 메뉴에 새 항목이 보이고 설명이 semantics와 맞다.
  사람 검증(비개발자): 메뉴 문구만 봐도 reset과 update 역할이 구분된다.
  흔한 문제/주의: 기존 `Reset Failed & Retry`와 의미가 섞이지 않게 분리한다.

검증 훅:
```text
- POST /api/news/fulltext/update { sourceType: 'fmp_press_release', sourceName: 'FMP', concurrency: N }
- job result / job log 확인
- app.db에서 FMP PR sample row 비교: full_text, extraction_note, word_count
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — 문서 동기화
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend prompt에 새 동작 반영 | `terminal/backend_prompt.md` | 문서 diff 확인 | ⏳ |
| 4-2 | frontend prompt에 FMP PR fulltext 재추출 특성 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⏳ |

- 4-1 목적: backend 동작 설명과 코드가 일치하게 유지한다.
  설명: FMP PR fulltext가 일부 publisher에 대해 page scrape를 시도한다는 점을 적는다.
  완료 조건(눈으로 확인): 관련 endpoint/fulltext 섹션 설명이 바뀐다.
  사람 검증(비개발자): 문서에 FMP PR fulltext 재추출 규칙이 보이면 된다.
  흔한 문제/주의: 과거 설명인 `row already exists면 자동 재시도 안 함`이 FMP PR special case와 충돌하지 않게 갱신한다.
- 4-2 목적: 프론트 문서에서도 FMP PR Only full text update 의미를 맞춘다.
  설명: 기존 success fallback row를 다시 잡는다는 점을 기록한다.
  완료 조건(눈으로 확인): 프론트 prompt에 FMP PR update 설명이 추가된다.
  사람 검증(비개발자): 버튼 설명이 실제 동작과 안 어긋나면 된다.
  흔한 문제/주의: UI 코드는 그대로여도 문서는 드리프트할 수 있다.

검증 훅:
```text
- 변경된 .md 문서에서 관련 섹션 수동 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | 정적 분석 확인 | 관련 변경 파일 전부 | `get_errors` | ⏳ |
| 5-2 | backend build | `terminal/backend` | `npm.cmd run build` | ⏳ |
| 5-3 | 자동 테스트 | `terminal/backend` | `npm.cmd run test` | ⏳ |
| 5-4 | 런타임 통합 검증 | backend API + app DB | 샘플 URL 추출, fulltext update API, DB 쿼리 | ⏳ |

- 5-1 목적: 타입/구문 오류 없이 변경을 마무리한다.
  설명: 수정 파일 diagnostics 0개를 확인한다.
  완료 조건(눈으로 확인): errors 0개.
  사람 검증(비개발자): 에러 패널에 새 오류가 없으면 된다.
  흔한 문제/주의: 테스트만 통과하고 TS 에러가 남는 상태를 허용하지 않는다.
- 5-2 목적: 배포 가능한 backend 산출물이 만들어지는지 확인한다.
  설명: extractor와 repository/service 변경이 build를 깨지 않는지 본다.
  완료 조건(눈으로 확인): build exit code 0.
  사람 검증(비개발자): build 성공 로그 확인.
  흔한 문제/주의: ESM import/export mismatch.
- 5-3 목적: 회귀를 잡는다.
  설명: 기존 fulltext extractor 테스트와 전체 테스트를 통과시킨다.
  완료 조건(눈으로 확인): 전체 test pass.
  사람 검증(비개발자): test pass count 확인.
  흔한 문제/주의: global fetch mock 복원 누락.
- 5-4 목적: 실제 데이터가 회복되는지 증명한다.
  설명: API를 호출하고 DB에서 `full_text != body` 샘플이 생기는지 확인한다.
  완료 조건(눈으로 확인): extraction note 분포와 샘플 row가 바뀐다.
  사람 검증(비개발자): Full Text popup에서 본문이 더 길어졌는지 볼 수 있다.
  흔한 문제/주의: Business Wire는 여전히 fallback일 수 있다.

검증 훅:
```text
- get_errors
- terminal/backend: npm.cmd run build
- terminal: npm.cmd run test
- POST /api/news/fulltext/update (fmp_press_release)
- app.db SQL 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
- 결정 #1: Business Wire direct extraction을 어떤 방식으로 구현할 것인가?
  - 선택지 A: 브라우저 fallback 추가
  - 선택지 B: plain fetch만 유지하고 실패를 note로 남김
  - 차단 대상 Step: 없음 (현재 plan은 A 기준으로 진행)

### 실행 의존성 그래프
Legend: `✅ 구현+사용자확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

```text
Track A — 계획/문서
⏳ Step 1 계획 고정
  ⏳ 1-1 root cause/범위 plan 기록
  ⏳ 1-2 agent log 초기화

Track B — 코드 구현
⏳ Step 2 extractor 구현
  ⏳ 2-1 GlobeNewswire extractor
  ⏳ 2-2 PRNewswire extractor
  ⏳ 2-3 dispatcher 연결

⏳ Step 3 FMP PR reset 경로
  ⏳ 3-1 stale fallback row 삭제 함수
  ⏳ 3-2 reset endpoint + missing-only semantics 복원
  ⏳ 3-3 UI reset 후 retry 경로

Track C — 문서/검증
⏳ Step 4 문서 동기화
  ⏳ 4-1 backend prompt 갱신
  ⏳ 4-2 frontend prompt 갱신

⏳ Step 5 전체 검증
  ⏳ 5-1 정적 분석
  ⏳ 5-2 backend build
  ⏳ 5-3 자동 테스트
  ⏳ 5-4 런타임 통합 검증

의존 관계
Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5

[차단 배너]
Business Wire plain fetch 차단은 이번 plan의 차단 요소로 기록하지만, 브라우저 fallback 도입으로 Step 2/3 진행 자체는 막지 않는다.
```

병렬 트랙 요약
- Track A는 시작 즉시 수행 가능
- Track B는 Step 1 이후 순차 진행
- Track C는 코드 변경이 나온 뒤 진행

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| Business Wire anti-bot 우회 여부 | 후속 확장 작업 | 이번 작업은 fallback 유지, 후속 task로 분리 |

### 결정 #1 — Business Wire 처리(상세)
- 현재 Node fetch 기준 응답은 기사 본문이 아니라 challenge / error shell이다.
- 따라서 이번 작업에서 억지 우회 코드를 넣으면 안정성보다 실패/차단 리스크가 더 크다.
- 이번 구현은 GlobeNewswire / PRNewswire를 확실히 회복하고, Business Wire는 기존 fallback 유지로 둔다.