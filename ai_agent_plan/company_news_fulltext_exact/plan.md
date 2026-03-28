## company_news exact fulltext 복구 / publisher 재감사 plan

### PLAN CHANGE (2026-03-28 14:45 local)

- 사용자 요청에 따라 범위를 샘플 검증에서 멈추지 않고, **기존 저장된 FINNHUB company_news 전체의 missing `origin_url` 복구 실행**까지 확장한다.
- 구현 변경:
  - `fulltextExtractors.ts`의 Finnhub redirect resolver를 재사용 가능하게 export
  - `fulltextUpdateService.ts`에 company_news 전용 batch backfill 추가
  - `server.ts`에 `/api/news/fulltext/backfill-company-origin-url` endpoint 추가
- 실행 목표: `news_items.source='FINNHUB' AND source_type='company_news' AND origin_url IS NULL/empty` 전체를 대상으로 원문 URL backfill 수행

### 목표

- FINNHUB `company_news`에서 지금 저장 중인 `summary` snippet이 아니라 **publisher 원문 기사 본문**만 `news_fulltext.full_text`에 저장되도록 경로를 다시 설계한다.
- publisher별로 “지금 바로 정확 원문 추출 가능”, “origin_url 복구가 먼저 필요”, “구조적으로 원문 확보가 어려움”을 다시 나눈다.
- 구현 전 단계에서 “되는 것처럼 보이는 fallback”을 금지하고, 실제 원문 확보 여부를 검증 가능한 기준으로 고정한다.

### 현재 레포 상태(중요, 확인됨)

- 수집 경로:
  - `terminal/backend/src/services/finnhubNewsProvider.ts`의 `fetchCompanyNewsRaw()`는 FINNHUB `company-news` 응답을 `news_items`로 매핑한다.
  - 현재 `body`에는 provider `summary`가 들어가며, 이는 기사 전문이 아니라 snippet이다.
- publisher 판정:
  - `resolveBestPublisher()`는 `origin_url` 우선, 그 다음 provider source, 그 다음 title/body 힌트, 마지막으로 url host를 쓴다.
  - 그러나 현재 company_news 저장 URL은 대다수가 `https://finnhub.io/api/news?id=...` redirect 형태라서 원문 host가 직접 보이지 않는다.
- 원문 추출 게이트:
  - `terminal/backend/src/services/fulltextExtractors.ts`에서 company_news는 `COMPANY_NEWS_SCRAPE_PUBLISHERS = { YAHOO, BENZINGA }`만 허용한다.
  - `extractByDomain()`은 company_news에서 `origin_url`이 없으면 Finnhub redirect를 한 번 resolve 시도하지만, 성공/재처리 범위가 매우 제한적이다.
- 재처리 범위:
  - `terminal/backend/src/services/fulltextRepository.ts`의 `getUnextractedNewsIds()`는 기본적으로 `news_fulltext` row가 **없는 것만** 다시 잡는다.
  - 즉, 예전에 `unavailable` 또는 `failed`로 한 번 찍힌 company_news는 별도 backfill 루프가 없으면 자동 재시도 대상에서 빠진다.
- origin_url 저장 흐름:
  - `terminal/backend/src/services/fulltextUpdateService.ts`는 extractor가 `resolvedUrl` 또는 `resolvedPublisher`를 반환했을 때만 `news_items.origin_url/publisher`를 갱신한다.
  - 현재 RTPR 전용 origin 추출 로직은 있으나, company_news 대량 복구 전용 origin backfill job은 없다.

### 현재 DB baseline (2026-03-28 직접 집계)

- `FINNHUB + company_news` 총 row: `1,308,960`
- `origin_url` 보유 row: `3,913`
- `news_fulltext` 상태 분포:
  - `(missing)`: `1,305,037`
  - `unavailable`: `2,904`
  - `success`: `1,012`
  - `failed`: `7`
- success note 분포:
  - `benzinga-scrape`: `912`
  - `yahoo-finance-browser`: `100`
- 상위 publisher 분포:
  - `YAHOO`: `686,205`
  - `BENZINGA`: `182,225`
  - `FINNHUB`: `88,239`
  - `THEFLY.COM`: `75,886`
  - `TIPRANKS`: `69,254`
  - `MARKETWATCH`: `62,454`
  - `GURUFOCUS`: `40,522`
  - `INVESTORPLACE`: `17,418`
  - `FINTEL`: `16,035`
  - `STOCK OPTIONS CHANNEL`: `9,117`
  - `CNBC`: `8,760`
- publisher별 origin_url 보유 현황(상위 일부):
  - `YAHOO`: `2,257`
  - `BENZINGA`: `912`
  - `CNBC`: `146`
  - `MARKETWATCH`: `11`
  - 그 외 상위 다수 publisher는 현재 `0`

### 제약 / 비범위

- paywall 우회, 로그인 우회, 구독 우회는 이번 범위에 넣지 않는다.
- snippet(`news_items.body`)를 fulltext처럼 저장하는 방식은 금지한다.
- mock publisher 분류, 가짜 원문 생성, LLM 요약문을 원문처럼 저장하는 방식은 금지한다.
- 130만 건 전체를 바로 재처리하는 일괄 실행은 이번 plan의 즉시 실행 범위가 아니다. 먼저 샘플 감사와 source-path 복구를 끝낸 뒤 범위를 정한다.

### 읽는 방법(비개발자/일반인 기준)

- `현재 레포 상태`와 `현재 DB baseline`을 먼저 보면 왜 지금 exact fulltext가 거의 안 되는지 바로 이해할 수 있다.
- 그 다음 `결정/선행조건`에서 무엇을 먼저 정해야 하는지 확인한다.
- 실제 작업 순서는 `단계별 계획`과 `실행 의존성 그래프`를 보면 된다.
- publisher별 결과를 나중에 넣을 표준 포맷은 Step 2 설명 블록에 정의한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- plan 수정이 생기면 `PLAN CHANGE` 섹션을 추가하고, 무엇이 바뀌었는지와 왜 바뀌었는지를 3줄 이내로 남긴다.
- 각 Step 완료 후에는:
  - 변경 파일 또는 감사 산출물을 확인한다.
  - DB/API/샘플 URL 기준 검증을 실행한다.
  - 사용자에게 확인 방법과 리스크를 보고한다.
  - 사용자 확인 전까지 상태는 `⏳`로 유지한다.

### 아키텍처(상위)

1. FINNHUB `company-news` raw 응답 수집
2. `news_items` 저장
   - `title=headline`
   - `body=summary snippet`
   - `url=finnhub redirect`
   - `publisher=best-effort 추정`
3. fulltext job 실행
   - `origin_url` 있으면 그 URL 기준 scraper 라우팅
   - 없으면 Finnhub redirect resolve 시도
   - company_news는 현재 Yahoo/Benzinga만 scraper 허용
4. 결과 저장
   - success면 `news_fulltext.full_text` 저장
   - 필요 시 `news_items.origin_url/publisher` 보정

### 결정/선행조건(초기에 확정 필요)

| ID | 결정 항목 | 선택지 | 기본 제안 | 영향 |
|----|-----------|--------|-----------|------|
| D1 | 과거 row backfill 범위 | 최근 30일 / 최근 180일 / publisher별 상위 N건 / 전체 | publisher별 상위 N건 샘플 후 단계 확장 | Step 3, Step 4 |
| D2 | exact fulltext 실패 처리 정책 | `unavailable` 유지 / publisher별 세부 사유 코드 추가 | 세부 사유 코드 추가 | Step 2, Step 4 |
| D3 | blocked publisher 유지 기준 | HTTP/브라우저 둘 다 실패 시 즉시 blocked / 2회 이상 재검증 후 blocked | 2회 이상 재검증 후 blocked | Step 2 |
| D4 | live pull에서 origin_url 저장 시점 | fulltext 단계에서만 저장 / insert 시 즉시 resolve 저장 | insert 시 즉시 resolve 저장 우선 검토 | Step 1 |

### 계획 중간 필수 확인

- 상위 publisher 20~30개에 대해 아래 항목을 반드시 직접 확인한다.
  - Finnhub redirect가 현재 시점에 실제 원문 URL로 열리는지
  - 원문 HTML이 서버사이드로 바로 오는지, 브라우저 렌더가 필요한지
  - 본문이 기사 원문인지, snippet/캡션/비디오 설명인지
  - 비디오 전용 URL인지, 기사 URL인지
  - paywall/403/401/anti-bot인지
- 감사 결과는 최소 아래 컬럼으로 정리한다.
  - `[][][]publisher[][][]`
  - `[][][]sample_count[][][]`
  - `[][][]origin_url_resolved_count[][][]`
  - `[][][]exact_fulltext_success_count[][][]`
  - `[][][]blocked_reason[][][]`
  - `[][][]extractor_mode[][][]`

### 제안하는 구현 순서(이유)

1. origin_url를 안정적으로 보존/복구하지 않으면 publisher scraper를 늘려도 대부분의 과거 row에 적용할 수 없다.
2. publisher 감사 표준을 먼저 고정해야 “되는데 안 되는 척” 또는 “snippet인데 되는 척”을 막을 수 있다.
3. 그 다음에야 publisher별 extractor를 늘려도 정확 원문 성공률이 의미 있게 올라간다.
4. 마지막에 재처리 범위를 정해야 SQLite lock, 대량 실패 row 누적, 사이트 차단을 줄일 수 있다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — baseline 감사 및 plan 확정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | company_news 수집/추출 코드 경로 확인 | `terminal/backend/src/services/finnhubNewsProvider.ts`, `terminal/backend/src/services/fulltextExtractors.ts`, `terminal/backend/src/services/fulltextUpdateService.ts`, `terminal/backend/src/services/fulltextRepository.ts` | 코드 읽기 후 현재 동작을 plan에 반영 | ⏳ |
| 0-2 | runtime DB baseline 수치 집계 | `terminal/backend/backend/data/app.db` | SQLite 집계 결과를 plan에 반영 | ⏳ |
| 0-3 | 새 plan 폴더와 문서 생성 | `ai_agent_plan/company_news_fulltext_exact/plan.md`, `ai_agent_plan/company_news_fulltext_exact/agent_log.md` | 파일 생성 여부 확인 | ⏳ |

0-1 목적: 지금 exact fulltext가 막히는 구조적 원인을 코드 기준으로 고정한다.
설명: company_news gate, origin_url 보정, 재처리 제한을 문서화하면 이후 구현 방향이 흔들리지 않는다.
완료 조건(눈으로 확인): plan의 `현재 레포 상태` 섹션에 관련 파일과 제약이 적혀 있다.
사람 검증(비개발자): plan을 열어 Yahoo/Benzinga만 허용이라는 문장이 있는지 본다.
흔한 문제/주의: FMP stock news plan과 섞어서 쓰면 안 된다. company_news 전용 경로만 적어야 한다.

0-2 목적: 막연한 추정이 아니라 실제 DB 분포를 기준으로 우선순위를 잡는다.
설명: 총 row, origin_url 보유 수, success note 분포가 있어야 구현 ROI를 판단할 수 있다.
완료 조건(눈으로 확인): plan에 `1,308,960`, `3,913`, `1,012` 수치가 들어 있다.
사람 검증(비개발자): plan의 `현재 DB baseline` 섹션 숫자를 보면 된다.
흔한 문제/주의: 오래된 before_delete DB를 보면 안 된다. runtime DB만 본다.

0-3 목적: 이후 구현과 검증을 누적할 공식 문서 위치를 만든다.
설명: plan/log가 없으면 publisher 감사 결과가 흩어진다.
완료 조건(눈으로 확인): 새 폴더에 `plan.md`, `agent_log.md`가 존재한다.
사람 검증(비개발자): 탐색기에서 새 폴더를 열어 두 파일이 보이면 된다.
흔한 문제/주의: 폴더 이름을 길게 잡지 않는다. Windows 경로 길이 제한을 넘기지 않는다.

검증 훅:

```powershell
Set-Location 'C:\github_coding\terminal_sec\terminal\backend'
@'
select count(*) as company_news_total from news_items where source='FINNHUB' and source_type='company_news';
select count(*) as company_news_with_origin from news_items where source='FINNHUB' and source_type='company_news' and origin_url is not null and trim(origin_url)<>'';
select extraction_status, count(*) from news_items ni left join news_fulltext nf on nf.news_id=ni.id where ni.source='FINNHUB' and ni.source_type='company_news' group by extraction_status;
'@
```

사용자 확인 필요: **예**

#### ⏳ Step 1 — origin_url 보존/복구 경로 정비

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | insert 시점에 Finnhub redirect를 즉시 resolve해서 `origin_url` 저장하는 설계 확정 | `terminal/backend/src/services/finnhubNewsProvider.ts` | 새로 삽입된 company_news row의 `origin_url` 채워짐 확인 | ⬜ |
| 1-2 | 기존 row용 origin_url backfill job 추가 | `terminal/backend/src/services/fulltextUpdateService.ts`, `terminal/backend/src/server.ts`, `terminal/backend/src/services/fulltextExtractors.ts` | 전용 endpoint 생성 + 전체 대상 job 시작 확인 | ⏳ |
| 1-3 | 재시도/실패 사유를 publisher 감사에 쓸 수 있게 로그 포맷 정리 | `terminal/backend/src/services/fulltextUpdateService.ts` | job log에 resolve 성공/실패 이유 표시 | ⏳ |

1-1 목적: 새 데이터부터는 원문 URL을 잃지 않게 만든다.
설명: company_news를 insert할 때 redirect resolve를 미루면 대부분 row가 forever missing 상태로 남는다.
완료 조건(눈으로 확인): 새로 수집한 company_news row에 `origin_url`이 비어 있지 않다.
사람 검증(비개발자): 최근 기사 하나를 API/DB에서 열었을 때 `finnhub.io`가 아닌 원문 사이트 URL이 보인다.
흔한 문제/주의: redirect resolve가 느리면 pull 속도가 급락할 수 있어 concurrency 조절이 필요하다.

1-2 목적: 과거 데이터에도 실제 publisher 원문 URL을 복구한다.
설명: scraper를 늘려도 `origin_url`이 없으면 과거 130만 건 중 대부분은 재활용할 수 없다.
완료 조건(눈으로 확인): 샘플 batch에서 `origin_url` 보유 수가 증가한다.
사람 검증(비개발자): 감사 표에서 `origin_url_resolved_count`가 늘어난다.
흔한 문제/주의: 사이트/redirect 변경으로 과거 링크 일부는 영구 실패할 수 있다.

사전 작성됨(검증 필요):
- `runCompanyNewsOriginUrlBackfill(jobId, concurrency, batchSize)` 구현 완료
- `/api/news/fulltext/backfill-company-origin-url` endpoint 추가 완료
- batch + worker pool로 전체 missing row를 순차 페이지네이션 처리하도록 설계

1-3 목적: 나중에 publisher별 가능/불가를 정확히 설명할 근거를 남긴다.
설명: 단순 실패가 아니라 401/403/video/paywall/no-body 등을 분리해야 한다.
완료 조건(눈으로 확인): job log 또는 DB note에 세부 사유가 남는다.
사람 검증(비개발자): 실패 기사 note를 보면 이유가 읽힌다.
흔한 문제/주의: note를 너무 자유 텍스트로 쓰면 집계가 어려워진다.

검증 훅:

```powershell
Set-Location 'C:\github_coding\terminal_sec\terminal\backend'
npm.cmd run build
try {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/pull-finhub' -ContentType 'application/json' -Body '{"tickers":["AAPL"],"sourceType":"company_news","days":1}'
} catch { $_ | Out-String }
```

사용자 확인 필요: **예**

#### ⬜ Step 2 — publisher별 exact fulltext 재감사

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | 상위 publisher 20~30개 샘플링 규칙 정의 | `ai_agent_plan/company_news_fulltext_exact/plan.md` | 샘플 규칙이 문서에 명시됨 | ⬜ |
| 2-2 | publisher별 sample URL 5~20개 직접 probe | 감사 산출물 또는 `agent_log.md` | probe 결과 표 작성 | ⬜ |
| 2-3 | 각 publisher를 `가능/선행복구필요/차단`으로 분류 | `ai_agent_plan/company_news_fulltext_exact/plan.md` | 분류표 작성 | ⬜ |
| 2-4 | 비디오/short-form/snippet-only publisher 별도 분리 | `ai_agent_plan/company_news_fulltext_exact/plan.md` | 비디오 전용 목록 작성 | ⬜ |

2-1 목적: 감사 기준을 먼저 고정해 결과 해석이 흔들리지 않게 한다.
설명: sample 개수, 성공 기준, blocked 기준을 먼저 정한다.
완료 조건(눈으로 확인): plan에 sample 규칙과 성공 기준이 있다.
사람 검증(비개발자): 문서를 보고 한 publisher를 어떻게 판정하는지 이해할 수 있다.
흔한 문제/주의: 1건 성공만으로 publisher 전체를 “가능”으로 분류하면 과대판정이 된다.

2-2 목적: 추측이 아니라 실제 URL 응답을 본다.
설명: publisher별로 본문 selector, paywall, anti-bot, video 페이지 여부를 직접 확인한다.
완료 조건(눈으로 확인): publisher별 sample 결과가 남아 있다.
사람 검증(비개발자): 예시 URL과 성공/실패 사유를 같이 본다.
흔한 문제/주의: 기사 URL과 video URL을 섞으면 감사 결과가 왜곡된다.

2-3 목적: 이후 구현 범위를 명확히 자른다.
설명: 바로 구현 가능한 publisher와 origin_url 복구가 먼저인 publisher를 분리한다.
완료 조건(눈으로 확인): 분류표가 있고 상위 publisher가 빠지지 않았다.
사람 검증(비개발자): 관심 publisher가 어디 그룹에 있는지 찾을 수 있다.
흔한 문제/주의: `publisher` 라벨과 실제 host가 다른 경우를 같이 적어야 한다.

2-4 목적: 기사 원문이 아닌 비디오/캡션/짧은 노트형 소스를 분리한다.
설명: 이 그룹은 exact fulltext 목표와 맞지 않으므로 일반 기사 scraper와 섞지 않는다.
완료 조건(눈으로 확인): 비디오/short-form 목록이 있다.
사람 검증(비개발자): CNBC video 같은 예시가 별도 그룹으로 분리돼 있다.
흔한 문제/주의: 같은 publisher 안에서도 기사/비디오가 혼재할 수 있다.

검증 훅:

```powershell
Set-Location 'C:\github_coding\terminal_sec\terminal\backend'
@'
select publisher, count(*) as total_rows
from news_items
where source='FINNHUB' and source_type='company_news'
group by publisher
order by total_rows desc
limit 30;
'@
```

사용자 확인 필요: **예**

#### 🚫 Step 3 — publisher extractor 확장 및 exact-only 저장 규칙 적용

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | Step 2에서 `가능` 판정된 publisher만 scraper 추가 | `terminal/backend/src/services/fulltextExtractors.ts` | sample URL 재검증 성공 | 🚫 |
| 3-2 | snippet/body fallback 금지 규칙을 company_news에 적용 | `terminal/backend/src/services/fulltextExtractors.ts` | success row가 모두 실제 원문인지 확인 | 🚫 |
| 3-3 | publisher별 note 코드를 표준화 | `terminal/backend/src/services/fulltextExtractors.ts` | DB note 집계 가능 여부 확인 | 🚫 |

3-1 목적: 검증된 publisher만 넣어서 false positive를 막는다.
설명: Step 2 분류 전에는 scraper 추가를 시작하지 않는다.
완료 조건(눈으로 확인): 추가된 publisher scraper가 sample URL에서 원문을 추출한다.
사람 검증(비개발자): sample 기사 body가 snippet보다 훨씬 길고 본문 문단 구조를 가진다.
흔한 문제/주의: selector가 한 기사만 맞고 다른 기사에 깨질 수 있다.

3-2 목적: exact fulltext 목표를 코드 수준에서 강제한다.
설명: 본문이 짧거나 원문이 아닌 경우 success로 저장하지 않는다.
완료 조건(눈으로 확인): success note가 모두 scraper 기반이다.
사람 검증(비개발자): 성공 기사 텍스트를 열었을 때 summary 문장 1~2개가 아니라 실제 본문이다.
흔한 문제/주의: 일부 publisher는 원문이 짧은 브리프 기사일 수 있어 길이 기준만으로는 부족하다.

3-3 목적: 운영 중 실패 원인을 다시 분류할 수 있게 한다.
설명: `paywall`, `video-only`, `resolve-miss`, `http-403`, `selector-no-body` 같은 표준 코드를 쓴다.
완료 조건(눈으로 확인): note 집계 시 사람이 읽을 수 있는 분포가 나온다.
사람 검증(비개발자): 실패 원인을 하나의 짧은 코드로 이해할 수 있다.
흔한 문제/주의: 자유 텍스트 note는 같은 의미가 여러 형태로 쌓인다.

검증 훅:

```powershell
Set-Location 'C:\github_coding\terminal_sec\terminal'
npm.cmd run build
npm.cmd run test
```

사용자 확인 필요: **예**

#### ⏳ Step 4 — 재처리/backfill 및 운영 검증

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | Step 1/3 결과로 샘플 또는 전체 origin backfill 실행 | `terminal/backend/src/services/fulltextUpdateService.ts` 또는 관련 route | missing `origin_url` 감소 확인 | ⏳ |
| 4-2 | publisher별 성공/실패 리포트 생성 | `ai_agent_plan/company_news_fulltext_exact/agent_log.md` | before/after 비교표 작성 | 🚫 |
| 4-3 | live auto company_news fulltext 동작 확인 | backend API + runtime DB | 신규 row success/blocked 사유 확인 | 🚫 |

4-1 목적: 과거 row에도 실제 origin 복구 효과가 있는지 본다.
설명: 이번 변경에서는 사용자 요청에 따라 전체 missing `origin_url` 복구를 바로 실행한다. fulltext 재추출은 다음 단계다.
완료 조건(눈으로 확인): missing `origin_url` count가 감소한다.
사람 검증(비개발자): 예전 기사 하나를 열었을 때 `origin_url`이 `finnhub.io`가 아니라 원문 사이트 URL로 채워져 있다.
흔한 문제/주의: 대량 동시 실행 시 SQLite lock, 네트워크 지연, 일부 redirect 만료가 날 수 있다.

4-2 목적: publisher별로 무엇이 해결됐고 무엇이 아직 안 되는지 공식 결과를 남긴다.
설명: 사용자가 나중에 바로 볼 수 있는 운영 리포트 형태로 남긴다.
완료 조건(눈으로 확인): 가능/불가/선행복구필요 표가 업데이트된다.
사람 검증(비개발자): 관심 publisher의 상태를 표에서 바로 찾을 수 있다.
흔한 문제/주의: 샘플 결과와 전체 결과를 혼동하지 않도록 범위를 명시해야 한다.

4-3 목적: 새로 들어오는 company_news가 다시 같은 문제를 반복하지 않게 확인한다.
설명: 신규 pull 직후 origin_url과 fulltext가 자동으로 들어오는지 확인한다.
완료 조건(눈으로 확인): 신규 row에서 `origin_url`과 `news_fulltext`가 함께 생긴다.
사람 검증(비개발자): 최근 기사 하나를 열어 원문 링크와 fulltext를 본다.
흔한 문제/주의: 과거 backfill 성공과 live pipeline 성공을 별개로 검증해야 한다.

검증 훅:

```powershell
Set-Location 'C:\github_coding\terminal_sec\terminal\backend'
try {
  Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/news/fulltext/update' -ContentType 'application/json' -Body '{"sourceType":"company_news","concurrency":20}'
} catch { $_ | Out-String }
```

사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 내용 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| U1 | 과거 company_news backfill 범위 | 최근 30일 / 최근 180일 / publisher별 샘플 / 전체 | Step 4 |
| U2 | company_news failure note 표준 | 짧은 코드형 / 자유 텍스트 | Step 3, Step 4 |
| U3 | paywall publisher 취급 | 영구 blocked / 주기적 재검증 | Step 2, Step 4 |

### 실행 의존성 그래프

범례:
- `✅` 구현 + 사용자 확인 완료
- `⏳` 구현/문서화 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족

트랙 A — baseline / origin 경로
- `⏳ 0-1` 코드 경로 확인
- `⏳ 0-2` DB baseline 집계
- `⏳ 0-3` plan/log 생성
- `⬜ 1-1` insert 시 origin_url 저장
- `⏳ 1-2` 기존 row origin backfill job
- `⏳ 1-3` resolve/failure 로그 정비

트랙 B — publisher 감사 / extractor
- `⬜ 2-1` 샘플링 규칙 정의
- `⬜ 2-2` sample URL probe
- `⬜ 2-3` 가능/선행복구필요/차단 분류
- `⬜ 2-4` 비디오/short-form 분리
- `🚫 3-1` 검증된 publisher만 scraper 추가
- `🚫 3-2` exact-only 저장 규칙 적용
- `🚫 3-3` note 코드 표준화

트랙 C — 재처리 / 운영 검증
- `⏳ 4-1` 전체 origin backfill 실행
- `🚫 4-2` publisher별 before/after 리포트
- `🚫 4-3` live auto fulltext 검증

차단 구간:

```text
┌──────────────────────────────────────────────────────────────┐
│ Step 3는 Step 2 분류표가 먼저 확정돼야 시작 가능            │
│ Step 4는 D1(backfill 범위) 결정과 Step 1/3 결과가 필요      │
└──────────────────────────────────────────────────────────────┘
```

병렬 트랙 요약

- Track A의 Step 1과 Track B의 Step 2는 일부 병렬 가능하다.
- 다만 Step 3은 Step 2 결과에 의존하므로 병렬로 시작하지 않는다.
- Step 4는 origin_url 복구 결과와 publisher 감사 결과가 모두 필요하다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 | Step 4 | 최근 30일 / 최근 180일 / publisher별 샘플 / 전체 |
| D2 | Step 3, Step 4 | 세부 note 코드 유지 여부 |
| D4 | Step 1 | insert 시 resolve 저장 여부 |

### 결정 #1 — exact fulltext의 운영적 정의(상세)

- exact fulltext는 아래 조건을 모두 만족해야 한다.
  - publisher 원문 기사 URL 또는 그에 준하는 원문 문서 URL에서 직접 가져온다.
  - `news_items.body` summary snippet을 그대로 재사용하지 않는다.
  - 본문이 실제 기사 문단 구조를 가지며, caption/video description/짧은 ticker brief와 구분된다.
  - 저장 note가 publisher scraper 또는 검증된 fetch path를 나타낸다.
- 예시:
  - 포함 예시: CNBC 기사 URL에서 본문 문단 10개를 추출해 `cnbc-scrape`로 저장
  - 제외 예시: Finnhub `summary` 2문장을 `full_text`로 저장
  - 제외 예시: CNBC video 페이지의 설명문 3줄을 기사 본문으로 저장

### 결정 #2 — publisher 상태 분류 기준(상세)

- `가능`
  - origin_url 또는 direct article URL이 확보됨
  - 최소 2개 이상 샘플에서 원문 본문 추출 성공
  - success note가 snippet fallback이 아님
- `선행복구필요`
  - 사이트 자체는 오픈 기사로 보이나 현재 DB에 origin_url이 거의 없음
  - 먼저 redirect/origin 복구가 되어야 과거 row 재처리가 가능
- `차단`
  - paywall, login wall, 401/403 anti-bot, video-only, selector 무효가 재검증에서 반복됨
