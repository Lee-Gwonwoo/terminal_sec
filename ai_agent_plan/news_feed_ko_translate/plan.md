### 목표
- News Feed window에 `KO Translate` 드롭다운 버튼을 추가한다.
- 드롭다운 안에 `Company News Translate`, `FMP PR Translate`, `FMP SEC Translate` 버튼을 추가한다.
- 번역 결과는 영어 canonical 원문과 분리된 별도 테이블에 저장한다.
- News Feed의 Columns 선택 메뉴에 `Ko Title` 표시 컬럼을 추가하고, backend 응답에도 `[][][]ko_title[][][]` 계열 필드를 포함시킨다.
- AI research / Model 1 / Model 2의 기본 입력은 계속 영어 원문을 유지하고, 한국어 번역본은 UI 표시용 보조 데이터로만 취급한다.

### 현재 레포 상태(중요, 확인됨)
- frontend News Feed 핵심 구현은 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`에 있다.
- 현재 News Feed에는 이미 아래 구조가 있다.
  - source filter union: `all`, `company_news`, `press_release`, `fmp_press_release`, `fmp_stock_news`, `fmp_sec_filing`, `market_news`
  - Update 드롭다운: Recent/Custom 계열 버튼
  - Full Text 드롭다운: source_type별 full text job 버튼
  - Columns 메뉴: 표시 컬럼 토글 및 `visibleCols` localStorage persistence
- backend list endpoint는 이미 존재한다.
  - `GET /api/news`
  - `GET /api/model1/news`
- backend 저장 구조는 현재 영어 원문 중심이다.
  - `[][][]news_items[][][]`: `title`, `body`
  - `[][][]news_fulltext[][][]`: `full_text`
  - 아직 번역 전용 테이블은 없다.
- backend list join/mapping은 현재 영어 필드만 응답에 포함한다.
  - `terminal/backend/src/services/newsRepository.ts`의 `getNews()`, `getModel1News()`, `mapNewsRow()`, `mapModel1NewsRow()`
- backend 패키지에는 번역 SDK가 아직 없다.
  - 현재 `terminal/backend/package.json`에는 `deepl-node`, `@google-cloud/translate`, OpenAI SDK 같은 번역 전용 dependency가 없다.
- 현재 source_type별 데이터 수집 endpoint는 이미 분리되어 있다.
  - `POST /api/news/pull-fmp-press-release`
  - `POST /api/news/pull-fmp-sec-filing`
  - Finnhub company news pull 경로
- 즉 이번 작업은 “기존 수집/조회 UI 위에 번역 저장 계층 + 번역 실행 버튼 + 번역 표시 컬럼”을 얹는 작업이다.

### 제약 / 비범위
- 영어 원문 컬럼(`[][][]title[][][]`, `[][][]body[][][]`, `[][][]full_text[][][]`)은 canonical source로 유지한다.
- AI research / Model 1 / Model 2가 기본적으로 한국어 번역 컬럼을 prompt 입력으로 사용하도록 바꾸지 않는다.
- mock 번역 데이터는 추가하지 않는다.
- 이번 1차 범위는 News Feed window 기준이다. `Investing News`, `RTPR`, `FMP Stock News` 번역 버튼은 이번 plan 범위에서 제외한다.
- 이번 1차 UI 표시 범위는 `Ko Title` 컬럼이 우선이다. `Ko Body`, `Ko Full Text`를 테이블 컬럼으로 추가하는 것은 후속 확장으로 둔다.
- full text modal 내부 한국어 렌더링 전환은 이번 1차 필수 범위가 아니다. 우선 저장과 `Ko Title` 노출을 완성한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 1`은 번역 저장 구조와 provider, 컬럼 명세를 먼저 고정하는 단계다.
- `Step 2`는 DB와 backend repository/service를 추가하는 단계다.
- `Step 3`은 실제 source_type별 번역 실행 endpoint/job을 만드는 단계다.
- `Step 4`는 News Feed UI에 `KO Translate` 드롭다운과 대상 컬럼 선택 UI를 붙이는 단계다.
- `Step 5`는 `Ko Title` 컬럼을 실제 목록에 보이게 하는 단계다.
- `Step 6`은 prompt/spec 문서 동기화와 검증 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 번역 provider, 테이블 구조, endpoint 계약이 바뀌면 `PLAN CHANGE` 메모를 추가한다.
- 각 Step은 `구현 -> 정적 확인 -> build/test -> 런타임 검증 -> 사용자 확인` 순서로 진행한다.
- 사용자 확인 전에는 해당 Step 상태를 `⏳`로만 올리고, 사용자 확인 후에만 `✅`로 변경한다.
- 이번 문서는 구현 전 plan 문서이므로 아직 시작하지 않은 Step은 `⬜`, 선행 Step이 끝나지 않아 당장 시작할 수 없는 Step은 `🚫`로 표시한다.

### 아키텍처(상위)
- 입력 UI 흐름:
  1. 사용자가 News Feed window toolbar에서 `KO Translate` 버튼을 연다.
  2. 드롭다운 상단에서 번역 대상 컬럼을 선택한다.
     - 제안: `Title`, `Body/Summary`, `Full Text`
  3. 드롭다운 하단에서 번역 source 버튼을 누른다.
     - `Company News Translate`
     - `FMP PR Translate`
     - `FMP SEC Translate`
  4. backend가 선택한 `source_type`과 `targetColumns` 기준으로 미번역 row를 batch translate 한다.
- backend 저장 흐름:
  1. 영어 원문은 `[][][]news_items[][][]`, `[][][]news_fulltext[][][]`에 그대로 유지한다.
  2. title/body 계열 번역은 `[][][]news_item_translations[][][]`에 저장한다.
  3. full text 번역은 `[][][]news_fulltext_translations[][][]`에 저장한다.
  4. 각 row는 `lang='ko'`, `source_hash`, `translator`, `translated_at`를 가진다.
- backend 조회 흐름:
  1. `GET /api/news`와 `GET /api/model1/news`는 기본 영어 필드에 더해 optional `[][][]ko_title[][][]`를 내려준다.
  2. UI는 기존 `title`은 그대로 유지하고, 별도 selectable column `Ko Title`에서만 한국어 제목을 보여준다.
- AI research guardrail:
  1. Model 1 / Model 2 / AI scoring은 영어 원문(`[][][]title[][][]`, `[][][]body[][][]`, `[][][]full_text[][][]`)만 기본 입력으로 유지한다.
  2. translation table join은 list/detail UI 응답용으로만 제한한다.

### 결정/선행조건(초기에 확정 필요)
- 결정 1: 번역 provider
  - 제안: `deepl-node`
  - 이유: EN -> KO 뉴스/PR 품질이 안정적이고 Node/TypeScript backend에 붙이기 쉽다.
- 결정 2: 번역 저장 테이블 구조
  - 제안: source_type별 테이블 3개를 만들지 말고, shared translation table 2개를 둔다.
  - 제안 테이블:
    - `[][][]news_item_translations[][][]`
    - `[][][]news_fulltext_translations[][][]`
  - 이유: source_type는 원본 `news_items.source_type`로 구분 가능하고, 테이블 폭증을 막을 수 있다.
- 결정 3: API 응답 필드 이름
  - 제안: DB 컬럼/alias는 `[][][]ko_title[][][]`, frontend field는 `koTitle`
  - 이유: 기존 camelCase response 패턴과 snake_case DB 패턴을 동시에 맞출 수 있다.
- 결정 4: 번역 대상 컬럼 선택 UI 의미
  - 제안: `KO Translate` 드롭다운 안에 번역 대상 checkboxes를 둔다.
  - 기본값 제안: `Title=ON`, `Body/Summary=OFF`, `Full Text=OFF`
  - 이유: 비용을 통제하면서도 사용자가 확장 실행을 선택할 수 있다.
- 결정 5: missing-only 기본 동작
  - 제안: 기본은 “원문 hash 기준 missing/stale only translate”로 한다.
  - 이유: 같은 row를 반복 번역해 비용을 낭비하지 않기 위해서다.
- 결정 6: 대량 번역 실행 단위와 축소 규칙
  - 제안: 기본 실행 단위는 `1000건`으로 시작하되, provider/API 오류가 나면 같은 작업 묶음을 `1000 -> 500 -> 250 -> 125 ...` 식으로 절반씩 줄여 재시도한다.
  - 주의: 여기서 `1000건`은 기본 처리 batch 크기이며, literal `1000개 동시 HTTP 요청`을 뜻하지 않는다. 실제 provider 호출은 rate limit/DB write 안정성을 고려한 worker pool 위에서 돈다.
  - 이유: 큰 묶음으로 처리량을 확보하되, 오류 구간은 자동으로 잘게 쪼개 복구 범위를 줄이기 위해서다.
- 결정 7: 재시도 한도
  - 제안: 번역 provider 호출/쓰기 단계의 일시 실패는 최대 `10회`까지 재시도한다.
  - 이유: 레포 기본 재시도 정책과 맞추고, 네트워크/일시적 rate limit 오류를 흡수하기 위해서다.
- 결정 8: 실패 요약 로그
  - 제안: translate job의 View Log 마지막에는 항상 `failedCount`, 실패 sourceType, 대표 실패 row 식별자/원인을 요약한 최종 summary line을 남긴다.
  - 이유: 작업이 끝난 뒤 사용자가 실패 잔여분 존재 여부를 한눈에 볼 수 있어야 하기 때문이다.

### 계획 중간 필수 확인
- `Company News`, `FMP PR`, `FMP SEC` 각각에서 실제로 어떤 영어 원문이 존재하는지 먼저 확인한다.
  - `[][][]title[][][]`만 있는지
  - `[][][]body[][][]`가 summary 역할인지
  - `[][][]full_text[][][]`가 일부 row에서만 존재하는지
- live DB row 규모를 보고 batch translate 범위/limit를 조정해야 한다.
- `1000건 기본 batch`를 literal 동시 요청 수로 쓰지 않고, provider rate limit을 지키는 worker pool + adaptive batch split으로 구현해야 한다.
- `source_hash` 기준을 확정해야 한다.
  - 예: `title`, `body`, `full_text` 각각 독립 hash
- `[][][]ko_title[][][]`를 `/api/news`와 `/api/model1/news`에 노출해도 research 입력이 자동으로 한국어를 쓰지 않는지 확인해야 한다.
- 문서 drift 방지를 위해 구현 시 `terminal/backend_prompt.md`, `figma_frontend_prompt.md`를 같은 변경 세트에서 갱신한다.

### 제안하는 구현 순서(이유)
1. 먼저 provider/테이블/응답 계약을 고정해야 backend와 frontend가 같은 이름을 쓴다.
2. 그 다음 translation 저장 계층을 만들면 batch translate endpoint가 안정적으로 붙는다.
3. 이후 list API에 `[][][]ko_title[][][]`를 붙여야 frontend가 컬럼 렌더링을 할 수 있다.
4. 마지막에 `KO Translate` 버튼과 `Ko Title` 컬럼을 연결하면 UI 검증이 단순해진다.
5. 끝으로 build/test/API/UI/DB 검증과 문서 동기화를 묶어 drift를 막는다.

### 단계별 계획(각 단계: 구현 -> 검증)

#### ⬜ Step 1 — 번역 계약과 컬럼 명세 고정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 번역 provider, 저장 테이블, 응답 필드 이름을 최종 확정 | `ai_agent_plan/news_feed_ko_translate/plan.md` | plan 문서에 `[][][]news_item_translations[][][]`, `[][][]news_fulltext_translations[][][]`, `[][][]ko_title[][][]` 명시 확인 | ⬜ |
| 1-2 | 번역 대상 source_type 범위를 `company_news`, `fmp_press_release`, `fmp_sec_filing`로 고정 | `ai_agent_plan/news_feed_ko_translate/plan.md` | 범위 문구 확인 | ⬜ |
| 1-3 | `KO Translate` 드롭다운 안의 target column selector 의미를 고정 | `ai_agent_plan/news_feed_ko_translate/plan.md` | `Title`, `Body/Summary`, `Full Text` 선택 규칙 확인 | ⬜ |
| 1-4 | AI research guardrail을 plan에 명시 | `ai_agent_plan/news_feed_ko_translate/plan.md` | 영어 canonical 유지 문구 확인 | ⬜ |

- `1-1` 목적: backend/frontend가 같은 이름으로 구현되게 한다.
  설명: 테이블 이름, 응답 필드 이름, UI column ID를 먼저 고정해야 이후 단계에서 rename churn이 없다.
  완료 조건(눈으로 확인): plan에 `[][][]ko_title[][][]`와 translation table 이름이 모두 등장한다.
  사람 검증(비개발자): 문서를 읽고 “한국어 제목은 어디에 저장되고 어디에 보이는지”를 알 수 있다.
  흔한 문제/주의: `ko_title`, `koTitle`, `translated_title_ko` 같은 이름이 섞이면 프론트/백 연결이 깨진다.
- `1-2` 목적: 이번 1차 범위를 명확히 제한한다.
  설명: 번역 버튼 3개만 1차 대상으로 고정하고 다른 source는 뒤로 미룬다.
  완료 조건(눈으로 확인): source_type 3종이 문서에 반복해서 동일하게 보인다.
  사람 검증(비개발자): 어떤 버튼이 생기고 어떤 버튼은 아직 없는지 구분할 수 있다.
  흔한 문제/주의: `press_release`와 `fmp_press_release`를 혼동하면 잘못된 데이터가 번역될 수 있다.
- `1-3` 목적: “column 선택” 요구를 UI/비용 관점에서 해석 고정한다.
  설명: translation job에서 어떤 텍스트 조각을 번역할지 선택하는 UI를 `KO Translate` 드롭다운 안에 둔다.
  완료 조건(눈으로 확인): target columns 의미가 plan에 적혀 있다.
  사람 검증(비개발자): `Title`만 번역할지 `Full Text`까지 번역할지 사용자가 고를 수 있다는 설명이 보인다.
  흔한 문제/주의: display column 선택과 translate target 선택을 같은 것으로 착각하면 UI가 혼란스러워진다.
- `1-4` 목적: 한국어 번역본이 AI research 토큰 경로로 섞이지 않도록 초기에 못 박는다.
  설명: research/repository/LLM 입력은 영어만 유지하고, 번역 컬럼은 list UI 용도로만 쓰게 한다.
  완료 조건(눈으로 확인): AI research guardrail 문장이 plan에 있다.
  사람 검증(비개발자): 한국어 표시를 켜도 AI 분석은 영어 기준이라는 점을 읽을 수 있다.
  흔한 문제/주의: `SELECT *` 류 확장이 들어가면 의도치 않게 한국어가 research 경로에 섞일 수 있다.

검증 훅:
```text
- plan.md의 결정/선행조건 섹션에 provider, table, field, source_type 범위가 모두 적혀 있는지 확인
- plan.md의 아키텍처 섹션에 영어 canonical / 한국어 translation 분리 규칙이 적혀 있는지 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 2 — DB 스키마와 translation repository 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `initDb()`에 `[][][]news_item_translations[][][]` 테이블 추가 | `terminal/backend/src/db.ts` | app DB에 테이블 생성 확인 | 🚫 |
| 2-2 | `initDb()`에 `[][][]news_fulltext_translations[][][]` 테이블 추가 | `terminal/backend/src/db.ts` | app DB에 테이블 생성 확인 | 🚫 |
| 2-3 | translation read/write repository 추가 | `terminal/backend/src/services/newsTranslationRepository.ts` | TypeScript build + repository 함수 import 확인 | 🚫 |
| 2-4 | `source_hash`, `lang`, `translated_at`, `translator`, selected column별 upsert 규칙 추가 | `terminal/backend/src/db.ts`, `terminal/backend/src/services/newsTranslationRepository.ts` | duplicate 없이 upsert되는지 확인 | 🚫 |

- `2-1` 목적: title/body 번역을 영어 원문과 분리 저장한다.
  설명: `news_id + lang` 기준으로 번역 row를 저장하고, `[][][]ko_title[][][]`, `[][][]ko_body[][][]` 계열을 담는다.
  완료 조건(눈으로 확인): `db.ts`에 새 translation table DDL이 있다.
  사람 검증(비개발자): Data Control DB 구조 창이나 SQLite 조회에서 새 테이블 이름이 보인다.
  흔한 문제/주의: source_type별로 별도 테이블을 만들면 이후 source 추가 때 schema가 급증한다.
- `2-2` 목적: full text 번역을 본문 번역과 분리 저장한다.
  설명: 긴 본문은 별도 테이블에 두어 row 폭과 update 전략을 분리한다.
  완료 조건(눈으로 확인): fulltext translation table DDL이 보인다.
  사람 검증(비개발자): DB table 목록에서 두 번째 translation table이 보인다.
  흔한 문제/주의: `news_fulltext` 자체를 직접 덮어쓰면 영어 canonical이 깨진다.
- `2-3` 목적: server route가 SQL을 직접 품지 않게 하고 batch translate/read join을 재사용 가능하게 한다.
  설명: selection, stale detection, upsert, list join helper를 repository 층으로 분리한다.
  완료 조건(눈으로 확인): 새 repository 파일이 추가된다.
  사람 검증(비개발자): 파일 이름만 봐도 번역 저장 로직이 분리되어 있음을 알 수 있다.
  흔한 문제/주의: route 안에 SQL을 흩뿌리면 source_type 추가/검증이 어려워진다.
- `2-4` 목적: 재번역 비용을 줄인다.
  설명: 원문 hash가 같으면 skip하고, hash가 바뀐 row만 stale 재번역 대상으로 삼는다.
  완료 조건(눈으로 확인): table/repository에 hash 기반 upsert 규칙이 있다.
  사람 검증(비개발자): 같은 버튼을 다시 눌렀을 때 전부 재번역하지 않는 구조임을 문서/로그에서 이해할 수 있다.
  흔한 문제/주의: hash 없이 단순 overwrite하면 비용 통제가 어렵다.

검증 훅:
```text
- backend 시작 후 SQLite에서 `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('news_item_translations','news_fulltext_translations');`
- translation table sample query로 `lang`, `source_hash`, `translated_at` 컬럼 존재 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 3 — source_type별 KO translate backend job / endpoint 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | generic batch translate service 추가 | `terminal/backend/src/services/newsTranslationService.ts` | service 단위 type-check | 🚫 |
| 3-2 | `POST /api/news/translate/ko` endpoint 추가 | `terminal/backend/src/server.ts` | 200 + `jobId` 응답 확인 | 🚫 |
| 3-3 | endpoint payload에 `sourceType`, `targetColumns`, `missingOnly` 계약 추가 | `terminal/backend/src/server.ts` | request validation 확인 | 🚫 |
| 3-4 | 기본 `1000건` batch + 오류 시 절반 축소 + 최대 10회 재시도 규칙 추가 | `terminal/backend/src/services/newsTranslationService.ts` | batch split / retry 로그 확인 | 🚫 |
| 3-5 | sourceType별 selection을 `company_news`, `fmp_press_release`, `fmp_sec_filing`로 연결하고 기존 번역 row skip 처리 | `terminal/backend/src/services/newsTranslationRepository.ts`, `terminal/backend/src/services/newsTranslationService.ts` | source filter별 대상 row count / skipped count 확인 | 🚫 |
| 3-6 | job View Log 마지막에 실패 summary line 추가 | `terminal/backend/src/server.ts`, `terminal/backend/src/services/newsTranslationService.ts` | 실패 케이스에서 최종 로그 확인 | 🚫 |
| 3-7 | `/api/news`, `/api/model1/news` 응답에 optional `[][][]ko_title[][][]` join 추가 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/types.ts` | API 응답에 `koTitle` 필드 표시 확인 | 🚫 |

- `3-1` 목적: 번역 provider 호출, batching, retry, skip/stale 판단을 server route 밖으로 뺀다.
  설명: service는 source_type별 대상 row를 읽고 provider를 호출한 뒤 translation table에 upsert한다.
  완료 조건(눈으로 확인): 새 service 파일과 batch translate 함수가 보인다.
  사람 검증(비개발자): 구현 파일 이름만 봐도 번역 실행 로직이 따로 있다는 것을 알 수 있다.
  흔한 문제/주의: provider call이 route에 박히면 테스트와 재사용이 어렵다.
- `3-2` 목적: 프론트의 3개 translate 버튼이 공통 endpoint 하나로 수렴하게 한다.
  설명: 버튼 이름은 달라도 backend는 sourceType payload 하나로 처리하는 generic route가 단순하다.
  완료 조건(눈으로 확인): `server.ts`에 새 KO translate route가 있다.
  사람 검증(비개발자): translate 버튼 클릭 후 job 로그가 시작된다.
  흔한 문제/주의: source별 endpoint를 3개로 늘리면 중복 orchestration 코드가 생긴다.
- `3-3` 목적: column 선택 요구를 실제 번역 payload로 전달한다.
  설명: `targetColumns=['title','body','full_text']` 같은 배열을 받아 비용/범위를 제어한다.
  완료 조건(눈으로 확인): zod schema나 request parse 코드에 `targetColumns`가 있다.
  사람 검증(비개발자): Title만 선택해 번역하는 동작을 나중에 검증할 수 있다.
  흔한 문제/주의: 빈 배열 허용 시 "버튼 눌렀는데 아무 일도 안 함" 상태가 생길 수 있다.
- `3-4` 목적: 사용자가 원한 대량 처리 기본값과 오류 복구 규칙을 backend에 고정한다.
  설명: selection 결과를 기본 `1000건` 단위로 처리하고, provider/API 오류가 발생한 batch는 절반 크기로 쪼개 재시도한다. 각 실패 단위는 최대 10회까지 재시도한다.
  완료 조건(눈으로 확인): service 코드/로그에 `1000`, `halving`, `retry up to 10` 규칙이 보인다.
  사람 검증(비개발자): 대량 번역 중 오류가 나도 전체가 멈추지 않고 더 작은 묶음으로 다시 시도한다는 설명을 이해할 수 있다.
  흔한 문제/주의: `1000개 동시 요청`으로 오해해 provider rate limit을 초과하면 오히려 전체 실패율이 높아진다.
- `3-5` 목적: 버튼 이름과 실제 번역 대상 source_type이 정확히 일치하고, 기존 번역분은 다시 돌리지 않게 만든다.
  설명: 각각 `company_news`, `fmp_press_release`, `fmp_sec_filing`만 대상으로 row를 뽑고, 동일 hash의 기존 번역 row는 selection 단계에서 제외한다.
  완료 조건(눈으로 확인): repository/service에 source_type 분기와 missing/stale 필터가 보인다.
  사람 검증(비개발자): FMP PR translate를 눌렀을 때 Company News가 같이 번역되지 않고, 이미 번역된 row는 skipped로 집계된다.
  흔한 문제/주의: `press_release`와 `fmp_press_release` 혼동은 가장 흔한 오배치 포인트고, stale 판정 없이 무조건 재번역하면 비용이 급증한다.
- `3-6` 목적: job 완료 후 실패 잔여분 존재 여부를 즉시 알 수 있게 한다.
  설명: View Log 마지막 줄에 `translated`, `skipped`, `failedCount`와 함께 대표 실패 원인/식별자를 summary line으로 남긴다.
  완료 조건(눈으로 확인): 실패가 1건 이상일 때 로그 마지막 줄에 실패 summary가 찍힌다.
  사람 검증(비개발자): View Log 맨 마지막만 봐도 실패한 게 남았는지 알 수 있다.
  흔한 문제/주의: 중간 로그에만 실패가 흩어져 있으면 대량 작업 후 사용자가 결과를 파악하기 어렵다.
- `3-7` 목적: 저장된 번역본을 News Feed 목록에서 읽을 수 있게 한다.
  설명: list query에 translation table LEFT JOIN을 붙이고 `koTitle`을 response field로 map한다.
  완료 조건(눈으로 확인): API 응답에 `koTitle`이 포함된다.
  사람 검증(비개발자): 번역 후 새로고침하면 목록 row에 한국어 제목 필드가 채워질 수 있다.
  흔한 문제/주의: `/api/news`만 바꾸고 `/api/model1/news`를 안 바꾸면 projection mode에 따라 컬럼이 사라질 수 있다.

검증 훅:
```text
- POST /api/news/translate/ko { "sourceType": "company_news", "targetColumns": ["title"], "missingOnly": true }
- POST /api/news/translate/ko { "sourceType": "fmp_press_release", "targetColumns": ["title","body"], "missingOnly": true }
- GET /api/jobs/:jobId 로 translated/skipped/staleUpdated/failedCount 로그 확인
- 실패 유도 케이스에서 View Log 마지막 summary line 확인
- GET /api/news?source_type=company_news 에서 `koTitle` field 존재 확인
- GET /api/model1/news?source_type=fmp_press_release 에서 `koTitle` field 존재 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 4 — News Feed에 KO Translate 드롭다운과 대상 컬럼 선택 UI 추가
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `KO Translate` toolbar button/dropdown 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 버튼 렌더링 확인 | 🚫 |
| 4-2 | 드롭다운 안에 `Title`, `Body/Summary`, `Full Text` 선택 UI 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | checkbox state 변경 확인 | 🚫 |
| 4-3 | `Company News Translate`, `FMP PR Translate`, `FMP SEC Translate` 버튼 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 메뉴 항목 3개 표시 확인 | 🚫 |
| 4-4 | translate 버튼 클릭 시 backend translate endpoint payload 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | network payload 확인 | 🚫 |
| 4-5 | translate job 완료 후 목록 refresh / log panel 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | job 완료 후 `koTitle` 반영 확인 | 🚫 |

- `4-1` 목적: 기존 Update / Full Text 패턴과 같은 조작점을 제공한다.
  설명: toolbar에 세 번째 실행 메뉴로 `KO Translate`를 배치한다.
  완료 조건(눈으로 확인): News Feed toolbar에 새 버튼이 보인다.
  사람 검증(비개발자): Update 옆에서 KO Translate 버튼을 바로 찾을 수 있다.
  흔한 문제/주의: 버튼만 추가하고 outside-click close 처리 안 하면 메뉴가 겹쳐 남는다.
- `4-2` 목적: 사용자가 번역 비용과 범위를 직접 조절하게 한다.
  설명: translate job payload로 보낼 `targetColumns`를 드롭다운 안에서 선택한다.
  완료 조건(눈으로 확인): checkbox 3개가 보이고 on/off가 유지된다.
  사람 검증(비개발자): Title만 선택하고 버튼을 누를 수 있다.
  흔한 문제/주의: 아무 선택도 없는 상태를 허용하면 실패 UX가 생긴다.
- `4-3` 목적: 사용자가 source_type별로 명시적으로 실행하게 한다.
  설명: 버튼 3개는 각각 sourceType payload만 다르고 같은 generic endpoint를 호출한다.
  완료 조건(눈으로 확인): 메뉴에 버튼 3개가 보인다.
  사람 검증(비개발자): 각 버튼 이름이 요청사항과 동일하다.
  흔한 문제/주의: 버튼 라벨과 실제 payload sourceType이 어긋나면 잘못된 데이터가 번역된다.
- `4-4` 목적: 프론트 UI 상태가 실제 backend job으로 이어지게 한다.
  설명: sourceType + targetColumns + missingOnly를 payload에 담아 translate endpoint를 호출한다.
  완료 조건(눈으로 확인): DevTools network payload에 선택값이 보인다.
  사람 검증(비개발자): 원하는 source 버튼을 눌렀을 때 job 로그가 생긴다.
  흔한 문제/주의: `fmp_sec_filing` payload가 `fmp_press_release`로 잘못 들어가는 실수가 날 수 있다.
- `4-5` 목적: 번역 완료가 곧바로 목록 표시로 이어지게 한다.
  설명: translate job done 시 `fetchNews()`를 재호출하고 active job/log panel과 연결한다.
  완료 조건(눈으로 확인): job 완료 후 새로고침 없이 `koTitle` 데이터가 보인다.
  사람 검증(비개발자): 버튼 클릭 후 완료되면 목록 내용이 달라진다.
  흔한 문제/주의: job은 끝났는데 목록 refresh가 안 되면 저장은 됐어도 UI에 안 보인다.

검증 훅:
```text
- News Feed toolbar에 `KO Translate` 버튼 표시 확인
- dropdown에서 target column checkbox 3개 표시 확인
- `Company News Translate`, `FMP PR Translate`, `FMP SEC Translate` 버튼 클릭 시 POST payload 확인
- translate job 완료 후 목록 자동 refresh 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 5 — `Ko Title` selectable column 추가 및 렌더링 연결
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | frontend column union에 `koTitle` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 타입 에러 없음 확인 | 🚫 |
| 5-2 | `DEFAULT_COLUMNS`, `visibleCols` persistence, Columns 메뉴에 `Ko Title` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | Columns 메뉴에서 토글 확인 | 🚫 |
| 5-3 | backend/display item mapping에 `koTitle` 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | row data에 `koTitle` 연결 확인 | 🚫 |
| 5-4 | 테이블 cell 렌더러에 `Ko Title` 컬럼 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 컬럼 표시 확인 | 🚫 |
| 5-5 | `Ko Title` 비어 있을 때 fallback 표시 규칙 고정 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 미번역 row 표시 확인 | 🚫 |

- `5-1` 목적: 타입 시스템이 새 컬럼을 정식 컬럼으로 인식하게 한다.
  설명: `ColumnId`, backend item, display item, sort/render union에 `koTitle`을 추가한다.
  완료 조건(눈으로 확인): `koTitle`이 column/type 선언에 보인다.
  사람 검증(비개발자): 코드상으로 새 컬럼이 공식 컬럼이 된 것을 볼 수 있다.
  흔한 문제/주의: type union 한 곳만 빠져도 build가 깨진다.
- `5-2` 목적: 사용자가 기존 Columns 메뉴에서 새 컬럼을 켜고 끌 수 있게 한다.
  설명: `visibleCols` persistence와 menu label까지 함께 추가한다.
  완료 조건(눈으로 확인): Columns 메뉴에 `Ko Title`이 있다.
  사람 검증(비개발자): 체크박스로 `Ko Title`을 켜고 끌 수 있다.
  흔한 문제/주의: localStorage restore 목록에 새 컬럼이 없으면 새로고침 후 토글이 날아간다.
- `5-3` 목적: backend `koTitle` 응답이 프론트 row model에 전달되게 한다.
  설명: `BackendNewsItem -> DisplayItem` 변환에 `koTitle`을 추가한다.
  완료 조건(눈으로 확인): mapping 함수에 `koTitle` 라인이 있다.
  사람 검증(비개발자): translate 후 목록 row 모델에 한국어 제목 값이 들어간다.
  흔한 문제/주의: snake_case/camelCase 매핑이 틀리면 값이 항상 비어 보인다.
- `5-4` 목적: 실제 테이블에서 한국어 제목을 볼 수 있게 한다.
  설명: cell renderer와 header를 추가하고 기존 title column과 독립적으로 보여준다.
  완료 조건(눈으로 확인): 테이블 헤더에 `Ko Title`이 보인다.
  사람 검증(비개발자): 체크박스를 켜면 새 열이 나타난다.
  흔한 문제/주의: 가로 폭/ellipsis가 없으면 제목이 너무 길어 레이아웃이 무너질 수 있다.
- `5-5` 목적: 번역되지 않은 row와 번역된 row를 구분 가능하게 한다.
  설명: 비어 있는 경우 `-` 또는 muted placeholder를 보여준다. 영어 title fallback은 자동 표시하지 않는다.
  완료 조건(눈으로 확인): 미번역 row에서 placeholder가 보인다.
  사람 검증(비개발자): 번역된 row와 안 된 row가 visually 구분된다.
  흔한 문제/주의: 영어 title을 fallback으로 다시 보여주면 번역 성공 여부를 사용자가 알기 어렵다.

검증 훅:
```text
- Columns 메뉴에 `Ko Title` 체크박스 표시 확인
- `Ko Title` 켠 뒤 table header/cell 렌더링 확인
- 번역된 row / 미번역 row 각각에서 표시 규칙 확인
```
사용자 확인 필요: **예**

#### 🚫 Step 6 — 문서 동기화와 전체 검증
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | backend prompt/spec 문서에 번역 테이블/endpoint/응답 필드 반영 | `terminal/backend_prompt.md` | 문서 검색 확인 | 🚫 |
| 6-2 | frontend prompt/spec 문서에 KO Translate 버튼과 `Ko Title` column 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 검색 확인 | 🚫 |
| 6-3 | 정적 분석 확인 | 변경 파일 전체 | `get_errors` | 🚫 |
| 6-4 | build 검증 | `terminal`, web UI workspace | backend/frontend build | 🚫 |
| 6-5 | 자동 테스트 검증 | `terminal` | `npm.cmd run test` | 🚫 |
| 6-6 | 런타임 통합 검증 | backend API + News Feed UI + DB | translate job + list refresh + DB row 확인 | 🚫 |

- `6-1` 목적: backend 구조가 문서와 코드에서 동일하게 보이게 한다.
  설명: translation table, translate endpoint, `[][][]ko_title[][][]` 응답 필드를 prompt/spec에 반영한다.
  완료 조건(눈으로 확인): backend prompt 문서에 번역 관련 항목이 검색된다.
  사람 검증(비개발자): 문서를 읽고 어느 API와 테이블이 추가됐는지 이해할 수 있다.
  흔한 문제/주의: 코드만 바꾸고 문서를 안 바꾸면 다음 작업자가 translation 경로를 놓친다.
- `6-2` 목적: 프론트 UI 문서도 실제 화면과 동기화한다.
  설명: toolbar에 `KO Translate`, dropdown buttons, `Ko Title` 컬럼이 문서에 반영되어야 한다.
  완료 조건(눈으로 확인): frontend prompt 문서에 새 UI 항목이 적혀 있다.
  사람 검증(비개발자): 화면에 있는 버튼/컬럼이 문서에도 그대로 나온다.
  흔한 문제/주의: 컬럼 메뉴와 translate 메뉴 설명이 빠지기 쉽다.
- `6-3` 목적: 타입/문법 오류를 먼저 제거한다.
  설명: translation 관련 새 union/type/join 추가 후 에러 0개를 확인한다.
  완료 조건(눈으로 확인): errors 0개.
  사람 검증(비개발자): Problems 패널에 새 에러가 없다.
  흔한 문제/주의: column union과 payload type 추가 후 누락 branch가 자주 발생한다.
- `6-4` 목적: 배포 가능한 상태인지 확인한다.
  설명: backend와 frontend 모두 build 성공해야 한다.
  완료 조건(눈으로 확인): build exit code 0.
  사람 검증(비개발자): build 성공 보고를 보면 된다.
  흔한 문제/주의: frontend는 string literal union, backend는 route/schema mismatch로 build가 깨지기 쉽다.
- `6-5` 목적: 기존 기능 회귀를 점검한다.
  설명: workspace test를 돌려 translation 추가가 기존 repository/server 동작을 깨지 않았는지 본다.
  완료 조건(눈으로 확인): test pass.
  사람 검증(비개발자): 실패한 테스트가 없다는 보고를 보면 된다.
  흔한 문제/주의: 기존 flaky test와 새 회귀를 구분해야 한다.
- `6-6` 목적: DB -> API -> UI가 end-to-end로 연결됐는지 확인한다.
  설명: translate job 실행, DB row 생성, `GET /api/news` 응답, `Ko Title` 컬럼 표시를 순서대로 확인한다.
  완료 조건(눈으로 확인): 번역 후 목록에 한국어 제목이 보인다.
  사람 검증(비개발자): 버튼을 눌러 번역 후 `Ko Title` 컬럼에 한국어가 나타나는지 보면 된다.
  흔한 문제/주의: DB에는 저장됐는데 API join이 빠지거나, API는 내려오는데 프론트 컬럼이 숨김 상태일 수 있다.

검증 훅:
```text
- get_errors(변경 파일)
- backend build
- frontend build
- terminal test
- POST /api/news/translate/ko -> GET /api/jobs/:jobId
- GET /api/news?source_type=company_news
- DB query로 translation row 존재 확인
- 브라우저에서 `KO Translate` 실행 후 `Ko Title` 컬럼 표시 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | 번역 provider | `deepl-node` 권장 / `@google-cloud/translate` 대안 / LLM 번역 비권장 | Step 2, 3 |
| D2 | target column 기본값 | `title only` 권장 / `title+body` / `title+body+full_text` | Step 3, 4 |
| D3 | translation table 전략 | shared 2-table 권장 / source_type별 3~6개 table | Step 2 |
| D4 | `Ko Title` fallback 표시 | `-` 권장 / 영어 title fallback / badge로 상태 표시 | Step 5 |
| D5 | translate endpoint 형태 | generic `/api/news/translate/ko` 권장 / source별 별도 endpoint 3개 | Step 3 |

### 이번 대화에서 추가 확정된 실행 규칙
- 기본 translate batch는 `1000건`으로 시작한다.
- provider/API 오류가 나면 같은 작업 묶음을 `절반씩` 줄여가며 재시도한다.
- 재시도는 최대 `10회`까지 수행한다.
- 기존에 이미 번역된 동일 hash 데이터는 selection 단계에서 제외한다.
- 실패가 남으면 View Log 마지막 줄에 실패 summary line을 반드시 남긴다.

### 실행 의존성 그래프
Legend: `✅` 구현+사용자확인 완료 / `⏳` 구현완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 선행조건 미충족

```text
Track A — 계약/스키마/백엔드
⬜ Step 1 — 번역 계약과 컬럼 명세 고정
  ⬜ 1-1 provider / table / field 이름 고정
  ⬜ 1-2 source_type 범위 고정
  ⬜ 1-3 target column selector 의미 고정
  ⬜ 1-4 AI research guardrail 고정
      |
      v
🚫 Step 2 — DB 스키마와 translation repository 추가
  🚫 2-1 news_item_translations 테이블
  🚫 2-2 news_fulltext_translations 테이블
  🚫 2-3 repository 추가
  🚫 2-4 hash/upsert 규칙 추가
      |
      v
🚫 Step 3 — source_type별 KO translate backend job / endpoint 추가
  🚫 3-1 translation service 추가
  🚫 3-2 /api/news/translate/ko route
  🚫 3-3 payload contract
  🚫 3-4 1000건 batch + halving retry 규칙
  🚫 3-5 source_type selection + existing translation skip
  🚫 3-6 실패 summary 로그
  🚫 3-7 /api/news + /api/model1/news 에 ko_title join

Track B — 프론트 UI
🚫 Step 4 — KO Translate 드롭다운과 대상 컬럼 선택 UI 추가
  🚫 4-1 toolbar button/dropdown
  🚫 4-2 target column checkbox
  🚫 4-3 source translate 버튼 3개
  🚫 4-4 backend payload 연결
  🚫 4-5 job 완료 후 목록 refresh
      |
      v
🚫 Step 5 — Ko Title selectable column 추가 및 렌더링 연결
  🚫 5-1 column/type union
  🚫 5-2 Columns 메뉴 연결
  🚫 5-3 backend/display mapping
  🚫 5-4 table render
  🚫 5-5 fallback 규칙

Track C — 문서/검증
🚫 Step 6 — 문서 동기화와 전체 검증
  🚫 6-1 backend prompt 문서
  🚫 6-2 frontend prompt 문서
  🚫 6-3 정적 분석
  🚫 6-4 build
  🚫 6-5 자동 테스트
  🚫 6-6 런타임 통합 검증

[USER GATE AFTER EACH STEP]
각 Step은 검증 결과를 사용자에게 보여주고 확인을 받은 뒤 다음 Step으로 진행한다.
```

병렬 트랙 요약
- Track A의 Step 1이 끝나기 전에는 Step 2~3을 시작하지 않는다.
- Track B는 Step 3의 response/payload 계약이 고정된 뒤에 시작한다.
- Track C는 구현이 끝난 뒤 수행하지만, prompt 문서 갱신은 관련 Step 완료 시점에 함께 반영한다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 번역 provider 확정 | Step 2, Step 3 | DeepL / Google Translate |
| target column 기본값 확정 | Step 3, Step 4 | title only / title+body / all |
| table 전략 확정 | Step 2 | shared 2-table / per-source tables |

### 결정 #1 — 번역 저장 테이블 구조(상세)
- 옵션 A: source_type별 별도 테이블 3개 이상
  - 장점: source별 물리 분리가 명확하다.
  - 단점: source 추가 때마다 schema와 join이 늘어나고 중복 코드가 급증한다.
- 옵션 B: shared translation table 2개
  - `[][][]news_item_translations[][][]`
  - `[][][]news_fulltext_translations[][][]`
  - 장점: source_type는 원본 row에서 이미 구분되므로 스키마가 단순하고 재사용 가능하다.
  - 단점: query에서 source_type filter를 원본 table join으로 처리해야 한다.
- 권장: 옵션 B
  - 이유: 이번 요구사항은 버튼은 source_type별이지만 저장 구조까지 source_type별 physical split일 필요는 없기 때문이다.

### 결정 #2 — 번역 provider(상세)
- 옵션 A: `deepl-node`
  - 장점: EN -> KO 뉴스/PR 품질이 안정적이고 Node backend에 붙이기 쉽다.
  - 단점: 별도 API key와 비용 관리가 필요하다.
- 옵션 B: `@google-cloud/translate`
  - 장점: 대량 처리와 운영 안정성이 강하다.
  - 단점: 금융/PR 문장 뉘앙스는 DeepL보다 평평할 수 있다.
- 옵션 C: LLM 번역
  - 장점: 스타일 제어가 세밀하다.
  - 단점: 비용/토큰/결과 일관성 관리가 더 어렵다.
- 권장: 옵션 A
  - 이유: 이번 기능은 저장형 번역 캐시이고, 품질과 구현 단순성의 균형이 가장 좋다.