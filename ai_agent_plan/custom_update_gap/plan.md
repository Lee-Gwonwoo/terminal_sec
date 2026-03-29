### 목표

`custom` 날짜 범위를 받는 모든 주요 update 버튼이 사용자 지정 날짜 범위 전체를 매번 다시 API 조회하거나 전체 재계산하지 않고, 가능한 범위에서는 기존 coverage를 제외한 `missing gap`만 처리하고, 그 외에는 최소한 실행 전 preflight로 예상 대상 범위를 먼저 보여주도록 바꾸는 계획을 정리한다.

이번 plan의 직접 목표는 아래 3가지다.

1. 현재 custom 버튼들의 실제 동작을 route별로 분류하고, `gap-only 가능 버튼`과 `preflight-only 버튼`을 구분한다.
2. 본 실행 전에 어떤 ticker/category/date 구간이 처리될지 보여주는 `preflight`를 버튼별로 추가한다.
3. ticker-news 계열 custom 버튼은 `gap-only 실행`으로, 나머지 custom 버튼은 최소한 `preflight + 범위 요약`을 갖추도록 설계를 고정한다.

### 현재 레포 상태(중요, 확인됨)

- 현재 `POST /api/news/pull-finhub`는 `mode = custom`일 때 ticker별로 `pullCompanyNewsBackfill(ticker, from, to)` 또는 `pullPressReleasesBackfill(ticker, from, to)`를 그대로 호출한다.
- `POST /api/news/pull-rtpr`, `POST /api/news/pull-fmp-press-release`, `POST /api/news/pull-fmp-stock-news`도 custom mode에서 ticker별 전체 custom 범위를 다시 읽는 구조다.
- 추가 확인 결과, RTPR provider는 현재 `ticker + limit` 호출만 제공하고 `from/to` 범위 fetch를 직접 지원하지 않는다. 따라서 RTPR는 현 구조 기준으로는 `true gap-only`보다 `preflight + fully-covered skip`이 더 현실적인 1차 목표다.
- `POST /api/news/pull-fmp-sec-filing`은 ticker universe 전체를 대상으로 custom `from~to`를 그대로 검색한다.
- `POST /api/news/pull-investing`은 ticker별이 아니라 category 단위 custom range를 그대로 읽는다.
- `POST /api/news/change/update-custom`, `POST /api/ibkr/calendar/update-custom`도 custom date range를 직접 받아 해당 범위 전체를 재계산/재수집한다.
- 즉 현재 구현은 대부분의 custom 버튼에서 기존 coverage를 계산하지 않고, 사용자가 지정한 custom 범위를 다시 처리한다.
- 저장은 `INSERT OR IGNORE` 기반이라 기존 row를 통째로 overwrite 하지는 않는다.
- 다만 이미 있는 뉴스도 API로는 다시 읽을 수 있으므로, custom 범위가 길고 ticker 수가 많으면 불필요한 API 호출이 커질 수 있다.
- default ticker universe는 DB-primary이며, Default Ticker Window에서 기본 경로 기준으로 ticker를 추가하면 이후 ticker-based custom update 대상에 포함된다.

### 제약 / 비범위

- 이번 tranche는 `custom` 버튼 전체를 다루되, 버튼마다 적용 방식은 다를 수 있다.
- `recent` mode 동작은 먼저 바꾸지 않는다. 우선 `custom` mode에만 범위를 제한한다.
- 뉴스 본문 extraction/fulltext chaining 방식은 이번 plan의 주범위가 아니다.
- `gap-only`는 ticker + date 기반 existing coverage를 계산할 수 있는 ticker-news 계열 버튼에 우선 적용한다.
- category 기반/재계산 기반 버튼은 같은 형태의 gap-only가 어려울 수 있으므로, 최소 요구사항을 `preflight + 예상 대상 요약`으로 둔다.

### 읽는 방법(비개발자/일반인 기준)

- Step 0은 어떤 custom 버튼들이 있는지, 각각이 지금 어떻게 전체 범위를 다시 처리하는지 정리하는 단계다.
- Step 1은 버튼들을 `gap-only 가능`과 `preflight-only`로 나누는 단계다.
- Step 2는 실행 전 미리보기(preflight)를 버튼별로 정의하는 단계다.
- Step 3은 ticker-news 계열 버튼을 실제 `gap-only 실행`으로 바꾸는 단계다.
- Step 4는 category/재계산 계열 custom 버튼에 `preflight + 요약 실행`을 붙이는 단계다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전 plan을 먼저 고정한다.
- 각 Step은 구현 후 정적 분석, build, runtime API 검증까지 확인한다.
- Step별 결과는 사용자에게 확인받기 전까지 `⏳`로 유지한다.
- plan 변경이 생기면 기존 내용을 지우지 않고 `PLAN CHANGE` 형태로 추가 기록한다.

### 아키텍처(상위)

- API entry:
  - `POST /api/news/pull-finhub`
  - `POST /api/news/pull-rtpr`
  - `POST /api/news/pull-fmp-press-release`
  - `POST /api/news/pull-fmp-stock-news`
  - `POST /api/news/pull-fmp-sec-filing`
  - `POST /api/news/pull-investing`
  - `POST /api/news/change/update-custom`
  - `POST /api/ibkr/calendar/update-custom`
  - 새 후보: 각 route별 `preflight-custom-*`
- backend orchestration:
  - `terminal/backend/src/server.ts`
- provider fetch / worker:
  - `terminal/backend/src/services/finnhubNewsProvider.ts`
  - RTPR/FMP/Investing service helpers
  - change/calendar update helpers
- persisted data:
  - `news_items`
  - 필요 시 coverage 계산용 helper query
- frontend/UX:
  - `DataControlWindow.tsx`의 custom 버튼들에서 preflight 결과를 먼저 표시

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | coverage 단위를 일(day) 기준으로 계산할지 | 예 | 구현 단순성과 설명 가능성이 높음 |
| D2 | preflight를 실행 전 필수 단계로 만들지 | 예 | 실제 API 호출량을 먼저 보여주는 것이 안전함 |
| D3 | gap 개수가 너무 많을 때 잘게 다 보여줄지 요약만 보여줄지 | 요약 + 상위 예시 | 화면 과부하를 막기 위함 |
| D4 | 모든 custom 버튼에 동일한 gap-only를 강제할지 | 아니오 | 버튼 성격이 달라 preflight-only가 더 적절한 경우가 있음 |

### 계획 중간 필수 확인

- 같은 ticker에 대해 기존 데이터가 연속된 날짜 구간으로 정확히 계산되는지 확인해야 한다.
- 사용자 지정 범위가 기존 coverage에 완전히 포함되면 실제 실행에서 해당 ticker를 skip해야 한다.
- coverage가 중간에 끊긴 ticker는 빈 구간만 여러 sub-range로 나뉘어 조회돼야 한다.
- category 기반/재계산 기반 버튼은 최소한 preflight 결과와 실제 실행 요약이 일치해야 한다.
- preflight 결과와 실제 실행 대상 gap/summary가 버튼별로 일치해야 한다.

### 제안하는 구현 순서(이유)

1. custom 버튼 전체 inventory를 만들고 성격을 분류한다.
2. ticker-news 계열의 coverage/gap 계산 helper를 먼저 만든다.
3. 버튼별 preflight endpoint를 만든다.
4. ticker-news 계열은 preflight와 같은 gap 목록만 쓰도록 연결한다.
5. category/재계산 계열은 preflight + 실행 요약으로 일단 통일한다.
6. 마지막에 DataControlWindow 표시 흐름을 붙인다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 현재 custom 버튼 전체 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | `custom` 날짜 범위를 받는 전체 버튼/endpoint inventory 작성 | ⏳ |
| 0-2 | 각 버튼이 현재 전체 범위를 다시 처리하는지 코드 기준으로 확인 | ⏳ |
| 0-3 | overwrite/skip/재계산 성격을 버튼별로 분류 | ⏳ |

0-1 목적: 범위를 company news 하나로 축소하지 않기 위함.
설명: DataControlWindow와 backend route를 기준으로 custom 버튼 전체 목록을 만든다.
완료 조건(눈으로 확인): 어떤 버튼이 이번 tranche 대상인지 목록이 적혀 있다.
사람 검증(비개발자): “모든 custom 버튼”이 무엇을 뜻하는지 한눈에 볼 수 있어야 한다.
흔한 문제/주의: UI 버튼 이름과 backend endpoint 이름을 따로 적어야 혼동이 줄어든다.

0-2 목적: 현재 비효율이 어디서 생기는지 버튼별로 고정하기 위함.
설명: custom 분기에서 provider fetch / category fetch / 재계산이 어떻게 동작하는지 확인한다.
완료 조건(눈으로 확인): 버튼별로 `전체 범위 재조회`, `전체 범위 재계산`, `category fetch` 같은 성격이 적혀 있다.
사람 검증(비개발자): 어떤 버튼이 왜 느릴 수 있는지 이해할 수 있다.
흔한 문제/주의: recent mode와 custom mode를 섞어 해석하면 안 된다.

0-3 목적: 버튼별 적용 전략을 고르기 위함.
설명: `gap-only 가능`, `preflight-only`, `재계산 preflight`로 분류한다.
완료 조건(눈으로 확인): 각 버튼이 어느 트랙에 속하는지 표가 있다.
사람 검증(비개발자): 왜 어떤 버튼은 gap-only가 되고 어떤 버튼은 요약만 되는지 이해할 수 있어야 한다.
흔한 문제/주의: 모든 버튼에 같은 전략을 강제하면 구현이 불필요하게 복잡해질 수 있다.

검증 훅:
```text
- server.ts custom mode 분기 확인
- newsRepository.ts insertNewsItem 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — ticker-news 계열 existing coverage / gap 계산

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | ticker + source/source_type 기준 existing 날짜 범위를 읽는 helper 추가 | `terminal/backend/src/services/newsRepository.ts` 또는 관련 helper 파일 | 샘플 ticker coverage 조회 | ⏳ |
| 1-2 | Finnhub/RTPR/FMP ticker-news 계열 custom 범위와 existing coverage를 비교해 missing sub-range 목록 계산 | `terminal/backend/src/server.ts` 또는 service helper | 예시 ticker gap 결과 확인 | ⏳ |
| 1-3 | gap이 없는 ticker는 skip 대상으로 분류 | 같은 파일 | skip count 확인 | ⏳ |

1-1 목적: DB에 이미 있는 구간을 ticker별로 계산하기 위함.
설명: `published_at`를 날짜 기준으로 묶어 existing coverage 후보를 만든다.
완료 조건(눈으로 확인): 샘플 ticker에 대해 `coveredRanges`가 계산된다.
사람 검증(비개발자): 어떤 날짜는 이미 있고 어떤 날짜는 비었는지 눈으로 볼 수 있어야 한다.
흔한 문제/주의: 다중 뉴스가 같은 날 여러 건 있어도 하루는 한 번만 covered로 봐야 한다.

1-2 목적: 실제 조회해야 할 gap만 추리기 위함.
설명: custom `from~to`에서 covered 구간을 빼고 남은 sub-range를 계산한다.
완료 조건(눈으로 확인): 예시로 든 `2025-01-01~2025-10-31`에서 `2025-02-01~2025-10-30`이 이미 있으면 `2025-01-01~2025-01-31`만 남는 결과가 나온다.
사람 검증(비개발자): 사용자가 말한 예시가 그대로 재현돼야 한다.
흔한 문제/주의: 끝 경계 포함/제외를 잘못 잡으면 하루가 빠지거나 중복될 수 있다.

1-3 목적: 불필요한 API 호출을 없애기 위함.
설명: custom 범위 전체가 이미 covered인 ticker는 실제 실행 전에 skip 처리한다.
완료 조건(눈으로 확인): `fullyCoveredTickers` 수가 계산된다.
사람 검증(비개발자): 이미 다 있는 ticker는 “조회 안 함”으로 보여야 한다.
흔한 문제/주의: sparse data를 연속 coverage로 과대평가하면 실제 missing 뉴스를 놓칠 수 있다.

검증 훅:
```text
- 샘플 ticker 3~5개에 대해 coveredRanges / missingRanges 수동 확인
- 사용자가 제시한 예시 케이스 재현 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — 모든 custom 버튼 preflight endpoint 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | ticker-news 계열 custom 버튼용 preflight endpoint 추가 | `terminal/backend/src/server.ts` | HTTP 응답 확인 | ⏳ |
| 2-2 | category/재계산 계열 custom 버튼용 preflight summary endpoint 추가 | `terminal/backend/src/server.ts` | JSON shape 확인 | ⏳ |
| 2-3 | 화면 또는 호출 결과에서 사람이 읽기 쉬운 summary 문구를 버튼별로 정의 | `DataControlWindow.tsx`, `FinnhubNewsWindow.tsx` 또는 API spec 문서 | 샘플 출력 검토 | ⏳ |

2-1 목적: ticker-news 계열에서 실제 실행 전 예상 API 호출 범위를 먼저 보여주기 위함.
설명: 사용자가 custom `from~to`를 넣으면 서버가 바로 pull하지 않고 ticker별 coverage/gap 계산 결과를 반환한다.
완료 조건(눈으로 확인): 별도 preflight API가 gap 계산 결과를 반환한다.
사람 검증(비개발자): 실행 전에 “얼마나 조회할지” 먼저 볼 수 있다.
흔한 문제/주의: preflight와 실제 실행이 다른 helper를 쓰면 결과가 어긋날 수 있다.

2-2 목적: gap-only가 어려운 버튼도 실행 전 예상 범위를 보게 하기 위함.
설명: category/재계산 계열은 전체 대상 수, 예상 처리 건수, 기존 데이터 존재 범위, 실행 시 변경될 범위를 요약으로 반환한다.
완료 조건(눈으로 확인): JSON에 summary와 examples가 함께 있다.
사람 검증(비개발자): 긴 raw 목록 없이도 대략 얼마나 다운로드할지 판단할 수 있다.
흔한 문제/주의: ticker가 많으면 전체 상세 목록을 한 번에 다 보여주면 너무 길어진다.

2-3 목적: 사용자가 버튼별 preflight 결과를 바로 이해하게 하기 위함.
설명: UI에서는 버튼 유형에 따라 ticker examples 또는 summary cards 형태로 보이게 한다.
완료 조건(눈으로 확인): 표시 형식 예시가 plan에 적혀 있다.
사람 검증(비개발자): 실행 전에 결과를 읽고 “진행/취소”를 판단할 수 있어야 한다.
흔한 문제/주의: covered와 missing 의미가 뒤섞이면 오해가 생긴다.

preflight 표시 예시:
```text
Custom Update Preflight
- requested range: 2025-01-01 ~ 2025-10-31
- total tickers: 420
- fully covered tickers: 287
- tickers with missing gaps: 133
- total missing sub-ranges to fetch: 191

Examples
- AAPL
  covered: 2025-02-01 ~ 2025-10-30
  missing: 2025-01-01 ~ 2025-01-31
- MSFT
  covered: 2025-01-01 ~ 2025-03-01, 2025-04-15 ~ 2025-10-31
  missing: 2025-03-02 ~ 2025-04-14
- NVDA
  fully covered, no fetch needed

Other Custom Button Preflight
- route: /api/news/change/update-custom
- requested range: 2025-01-01 ~ 2025-10-31
- rows in range needing recompute: 18,442
- rows already having change metrics: 17,901
- rows expected to update: 541

Other Custom Button Preflight
- route: /api/ibkr/calendar/update-custom
- requested range: 2025-01-01 ~ 2025-10-31
- total tickers: 420
- existing event days in range: 201
- missing event days to fetch: 34
```

검증 훅:
```text
- POST preflight endpoint with custom from/to
- summary 수치와 sample ticker ranges 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — ticker-news 계열 custom 본실행을 gap-only 조회로 전환

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | Finnhub/RTPR/FMP ticker-news 계열 custom mode가 ticker별 missing sub-range 목록만 순회하도록 수정 | `terminal/backend/src/server.ts` | job log 확인 | ⏳ |
| 3-2 | provider backfill 호출이 각 gap range에 대해서만 실행되게 변경 | `terminal/backend/src/server.ts` | 샘플 ticker fetch 로그 확인 | ⏳ |
| 3-3 | inserted/skipped 외에 `fullyCoveredSkipped`와 `gapRangesFetched` summary 추가 | `terminal/backend/src/server.ts` | job result 확인 | ⏳ |

3-1 목적: preflight 결과가 실제 실행으로 이어지게 하기 위함.
설명: 기존 `ticker당 1회 전체 범위` 호출 대신 `ticker당 N개 gap range` 호출로 바꾼다.
완료 조건(눈으로 확인): custom mode loop가 gap ranges를 순회한다.
사람 검증(비개발자): 이미 있는 긴 구간은 다시 안 받는다는 점이 로그에서 보여야 한다.
흔한 문제/주의: gap가 많을 때 API 호출 수가 ticker 수보다 더 많아질 수 있으므로 summary가 필요하다.

3-2 목적: 실제 API 호출량을 줄이기 위함.
설명: 각 ticker는 missing range가 없으면 skip, 있으면 그 range들만 backfill 호출한다.
완료 조건(눈으로 확인): 로그에 `skip fully covered` 또는 `fetch gap` 문구가 남는다.
사람 검증(비개발자): 특정 ticker가 왜 조회됐고 왜 건너뛰었는지 설명 가능해야 한다.
흔한 문제/주의: 많은 작은 gap를 너무 잘게 나누면 오히려 호출 수가 증가할 수 있다.

3-3 목적: 실행 결과를 해석 가능하게 만들기 위함.
설명: 완료 summary에 `requestedTickers`, `fullyCoveredSkipped`, `tickersFetched`, `gapRangesFetched`, `inserted`, `skippedExisting`를 넣는다.
완료 조건(눈으로 확인): job result summary가 richer 해진다.
사람 검증(비개발자): 실제로 얼마나 절약됐는지 숫자로 볼 수 있다.
흔한 문제/주의: inserted가 적어도 그게 실패인지 기존 중복 skip인지 구분돼야 한다.

검증 훅:
```text
- custom update job 실행
- sample ticker logs 확인
- result summary에서 fullyCoveredSkipped / gapRangesFetched 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — non-ticker custom 버튼 preflight + 요약 실행 적용

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `pull-investing` custom에 preflight summary 추가 | `terminal/backend/src/server.ts`, `InvestingNewsWindow.tsx` | HTTP 응답 확인 | ⏳ |
| 4-2 | `news/change/update-custom`, `ibkr/calendar/update-custom`에 preflight summary 추가 | `terminal/backend/src/server.ts`, `DataControlWindow.tsx` | HTTP 응답 확인 | ⏳ |
| 4-3 | 본실행 result summary가 preflight와 비교 가능한 수치를 돌려주도록 정리 | `terminal/backend/src/server.ts`, `DataControlWindow.tsx` | job result 확인 | ⏳ |

4-1 목적: ticker gap 계산이 어려운 category 기반 버튼도 실행 전 범위를 알게 하기 위함.
설명: Investing custom은 category별 예상 article 수, 기존 범위, 요청 범위를 먼저 보여준다.
완료 조건(눈으로 확인): Investing custom preflight가 route별 summary를 반환한다.
사람 검증(비개발자): 실행 전에 대략 얼마나 읽을지 판단할 수 있다.
흔한 문제/주의: category 기반은 ticker-level gap처럼 정밀한 skip를 보장하지 못할 수 있다.

4-2 목적: 재계산/캘린더 계열 custom도 같은 UX를 갖게 하기 위함.
설명: News Change Custom과 Calendar Custom은 실행 전 예상 처리 건수/누락 구간 요약을 반환한다.
완료 조건(눈으로 확인): custom 버튼을 누르기 전 요약을 읽을 수 있다.
사람 검증(비개발자): 단순히 “실행”만 보이는 것이 아니라 처리 범위를 먼저 이해할 수 있어야 한다.
흔한 문제/주의: 재계산 계열은 existing coverage와 update-needed rows를 구분해서 보여줘야 한다.

4-3 목적: preflight가 실제 실행과 연결되게 하기 위함.
설명: 실행 후 result summary에 preflight와 같은 기준 수치를 넣어 비교할 수 있게 한다.
완료 조건(눈으로 확인): preflight와 result summary가 같은 vocabulary를 쓴다.
사람 검증(비개발자): 예상과 실제가 얼마나 차이 났는지 알 수 있어야 한다.
흔한 문제/주의: preflight와 result summary의 기준 용어가 다르면 신뢰도가 떨어진다.

검증 훅:
```text
- POST preflight for investing/change/calendar custom routes
- 각 route 실제 실행 후 result summary 비교
```
사용자 확인 필요: **예**

#### 🚫 Step 5 — 선택적 UI 강제 게이트

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | preflight를 통과해야만 Execute 버튼이 활성화되도록 만들지 결정 | frontend 실행 창 | UX 승인 필요 | 🚫 |
| 5-2 | preflight 상세 목록을 table/modal로 확장할지 결정 | frontend 실행 창 | UX 승인 필요 | 🚫 |

5-1 목적: 실수로 긴 custom update를 바로 실행하는 일을 줄이기 위함.
설명: preflight 결과를 본 뒤에만 실제 실행을 허용할지 여부는 UX 결정 사항이다.
완료 조건(눈으로 확인): 사용자 승인 없이는 강제 적용하지 않는다.
사람 검증(비개발자): 실행 흐름이 너무 번거로워지지 않아야 한다.
흔한 문제/주의: 강제 게이트는 편의성을 낮출 수 있다.

5-2 목적: preflight 가독성을 높이기 위함.
설명: 기본은 summary + sample examples만 두고, 상세 전체 목록은 선택 사항으로 둔다.
완료 조건(눈으로 확인): 기본안은 간결하고, 상세안은 추후 확장으로 분리된다.
사람 검증(비개발자): 화면이 숫자/구간으로 과도하게 복잡해지지 않아야 한다.
흔한 문제/주의: 전체 ticker 상세를 모두 UI에 뿌리면 오히려 더 느려질 수 있다.

검증 훅:
```text
사용자 UX 승인 전에는 실행하지 않음
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

### PLAN CHANGE — 2026-03-29

- RTPR는 현재 provider capability상 `from/to` 기반 remote fetch를 직접 지원하지 않는다.
- 따라서 RTPR custom은 이번 plan에서 `gap-only` 트랙이 아니라 `preflight + fully-covered skip` 우선 트랙으로 조정한다.
- Finnhub company_news / Finnhub press_release / FMP press release / FMP stock news는 여전히 `true gap-only` 우선 대상이다.

| ID | 항목 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| D1 | coverage 단위를 날짜 기준으로 고정할지 | 날짜 기준 / timestamp 기준 | Step 1 |
| D2 | preflight를 실행 전 필수로 강제할지 | 권장만 함 / 강제함 | Step 5 |
| D3 | preflight 상세 결과 표시 수준 | summary+examples / full per-ticker table | Step 2, Step 5 |
| D4 | non-ticker custom 버튼에도 gap-only를 강제할지 | 아니오 / 가능 범위만 | Step 4 |

### 실행 의존성 그래프

Legend: `✅ 사용자 확인 완료` / `⏳ 구현완료, 사용자확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — custom inventory / coverage 계산
- ⏳ 0-1 custom 버튼 전체 inventory 작성
- ⏳ 0-2 버튼별 전체 범위 처리 확인
- ⏳ 0-3 버튼별 전략 분류
- ⏳ 1-1 existing coverage helper 추가
- ⏳ 1-2 missing sub-range 계산
- ⏳ 1-3 fully covered ticker skip 분류

Track B — ticker-news preflight / execution
- ⏳ 2-1 ticker-news preflight endpoint 추가
- ⏳ 2-2 non-ticker preflight summary endpoint 추가
- ⏳ 2-3 표시 문구/예시 고정
- ⏳ 3-1 custom mode gap-only loop 전환
- ⏳ 3-2 gap range fetch 실행
- ⏳ 3-3 richer job summary 추가

Track C — non-ticker custom preflight
- ⏳ 4-1 investing custom preflight summary
- ⏳ 4-2 change/calendar custom preflight summary
- ⏳ 4-3 result summary vocabulary 정리

┌──────────────────────────────────────────────┐
│ 사용자 결정 필요                              │
│ preflight 강제 여부와 상세 표시 수준은        │
│ Step 5를 차단한다.                            │
│ non-ticker 버튼은 preflight-only 전략을 쓴다. │
└──────────────────────────────────────────────┘

병렬 트랙 요약
- Track A가 완료되어야 Track B/C가 안정적으로 구현된다.
- ticker-news preflight와 본실행은 같은 gap 계산 helper를 공유해야 한다.
- non-ticker 버튼은 preflight와 result summary vocabulary를 공유해야 한다.
- UI 강제 게이트는 backend preflight가 완성된 뒤 별도 결정한다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D2 | Step 5 | 권장만 함 / 강제함 |
| D3 | Step 2, 5 | summary+examples / full table |
| D4 | Step 4 | 아니오 / 가능 범위만 |

### PLAN CHANGE — 2026-03-29 (coverage 로직 핵심 수정)

- **문제:** 기존 구현은 ticker별로 데이터가 존재하는 **개별 날짜**(coveredDates)를 기준으로 gap을 계산했다. 이 방식은 데이터가 있는 날짜 사이사이에 데이터가 없는 날짜가 있으면 그것을 "missing gap"으로 잡아서 불필요한 API 재호출을 유발한다.
- **수정:** coverage를 **min(published_date) ~ max(published_date) envelope** 기준으로 계산하도록 변경했다. 즉 TSLA에 4/1, 4/17, 5/2, 8/2 데이터가 있으면 `4/1 ~ 8/2` 전체가 covered이고, 그 앞(요청 시작 ~ 3/31)과 뒤(8/3 ~ 요청 끝)만 gap이다.
- **근거:** 이미 한 번 조회한 날짜 범위 안에서 뉴스가 없는 날은 "뉴스가 없었기 때문"이지 "조회하지 않았기 때문"이 아니다. 따라서 envelope 안쪽의 빈 날짜를 다시 조회할 필요가 없다.
- **영향:**
  - `newsRepository.ts`: `getTickerNewsCoverage`가 `coveredDates` 배열 대신 ticker별 `MIN/MAX` envelope만 반환.
  - `server.ts`: `buildMissingRanges` → `buildMissingRangesFromEnvelope`로 교체. ticker당 gap이 최대 2개(envelope 앞 + envelope 뒤).
  - `collapseIsoDateRanges` helper는 server.ts에서 더 이상 사용되지 않아 제거됨.
  - preflight/실행 로직은 동일한 helper를 공유하므로 자동으로 반영됨.
- **검증:** backend/frontend build 성공, test 84/84, runtime preflight 호출에서 envelope 기반 결과 확인 완료.

### PLAN CHANGE — 2026-03-29 (non-ticker custom 마감 반영)

- `InvestingNewsWindow.tsx` custom 실행도 이제 preflight 모달을 먼저 거친 뒤 Continue에서 실제 pull을 시작하도록 연결했다.
- `pull-investing` custom job result는 이제 preflight와 같은 `requestedRange`, `executionMode`, `categories[].existingItemsInRange` vocabulary를 유지하면서 `fetchedItems / inserted / skipped`를 함께 반환한다.
- `news/change/update-custom` job result는 preflight와 같은 `totalRowsInRange / rowsWithChangePct / rowsExpectedToUpdate` 기준을 유지하면서 `rowsUpdated / rowsSkipped`를 함께 반환한다.
- `ibkr/calendar/update-custom`은 sync 응답이 아니라 job 기반으로 바꿔 `DataControlWindow` custom flow와 맞췄고, result에 `totalTickers / existingEventsInRange / existingEventDays / fetchedEvents / upserted`를 남기도록 정리했다.
- `DataControlWindow.tsx`의 done summary 영역도 custom change / custom calendar result vocabulary를 바로 읽을 수 있도록 보강했다.