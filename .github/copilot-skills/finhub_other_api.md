# Finnhub / Other API 속도 최적화 (skill)

### 언제 쓰나
- Finnhub 같은 외부 REST API에서 데이터를 수집하는 스크립트/서비스를 새로 만들거나 수정할 때.
- 같은 형태의 요청을 ticker, symbol, id, page 단위로 여러 번 반복 호출해야 할 때.
- API 수집 로직에서 병렬화 가능 여부, rate limit, retry, batch 전략을 먼저 따져야 할 때.

### 핵심 원칙
- **먼저 병렬 가능 여부를 확인**한다.
  - endpoint가 ticker별 독립 호출인지, cursor/page 기반 순차 호출인지, batch endpoint가 따로 있는지 먼저 확인한다.
  - 서로 독립인 요청이면 병렬화를 우선 검토한다.
  - 이전 응답의 `next`, `cursor`, `minId`, page token이 다음 요청 입력이 되는 구조면 순차 흐름으로 본다.
- **가능하면 가장 빠른 안전한 방식**을 기본값으로 잡는다.
  - 순차 호출을 기본으로 두지 말고, rate limit 안에서 허용되는 동시성(concurrency)을 먼저 계산한다.
  - 한 번에 여러 대상을 받을 수 있는 batch endpoint가 있으면 개별 호출 반복보다 batch를 우선한다.
  - 이미 받은 데이터가 DB/캐시에 있으면 재호출하지 않는다.
- **속도 최적화는 항상 dedup + cache + 최소 범위 조회와 같이** 적용한다.
  - 같은 ticker/symbol/date-range를 한 작업 안에서 중복 호출하지 않는다.
  - 필요한 기간만 요청한다. 넓은 기본 범위를 습관적으로 잡지 않는다.
  - 기존 DB max date, cursor, status table이 있으면 증분(incremental) 수집을 기본으로 한다.

### 병렬 가능 여부 판단 규칙
- **병렬 가능**
  - `symbol=AAPL`, `symbol=MSFT`처럼 각 요청이 서로 독립이다.
  - 요청 간 순서가 결과 정확도에 영향을 주지 않는다.
  - 서버가 batch를 지원하지 않지만, 여러 단건 요청을 동시에 보내도 의미가 같다.
- **부분 병렬 가능**
  - symbol 단위는 독립이지만, 각 symbol 내부의 page/cursor 탐색은 순차다.
  - 이 경우 "symbol 간 병렬 + symbol 내부 순차" 구조를 사용한다.
- **병렬 금지 또는 제한**
  - 다음 요청이 이전 응답의 continuation token에 의존한다.
  - provider가 엄격한 초당 호출 제한을 두고 있어 병렬이 바로 429를 유발한다.
  - 서버/네트워크 비용보다 로컬 후처리/DB write가 더 큰 병목이라 API 병렬화만으로 이득이 작다.

### Finnhub 계열 기본 지침
- Finnhub free tier처럼 rate limit가 작으면, **완전 순차**와 **무제한 병렬** 둘 다 피한다.
- 기본 전략은 아래 순서를 따른다.
  1. DB/캐시 조회
  2. 중복 ticker 제거
  3. 허용 범위의 소규모 병렬 호출
  4. 429 또는 일시 오류 시 backoff 후 재시도
  5. 받은 결과는 즉시 DB에 저장해 다음 작업을 빠르게 만든다
- 동일 작업 안에서 같은 ticker를 여러 번 계산에 쓰더라도 API 호출은 1번만 발생하게 한다.
- 뉴스/가격처럼 날짜 범위가 있는 데이터는 `earliest_needed - buffer`, `latest_needed + buffer`처럼 **계산 목적에 맞는 최소 여유 범위**만 요청한다.

### 권장 최적화 체크리스트
- **1. Batch endpoint 확인**
  - provider 문서에서 여러 symbol을 한 번에 받는 endpoint가 있는지 먼저 본다.
  - 있으면 개별 호출 반복보다 batch를 우선 사용한다.
- **2. 동시성 상수 분리**
  - `API_CONCURRENCY = 3` 같은 상수로 둔다.
  - free / paid plan 차이를 반영할 수 있게 하드코딩 숫자를 한 곳에 모은다.
- **3. 429 전용 처리**
  - 429는 영구 실패가 아니라 일시 실패로 본다.
  - 짧은 sleep + backoff 후 재시도한다.
  - 401/403/404/명백한 validation 오류는 즉시 실패시킨다.
- **4. 재시도 횟수 제한**
  - 무한 재시도 금지.
  - 기본은 3회 내외, 레포 공통 규칙이 더 엄격하면 그 규칙을 따른다.
- **5. 저장 우선**
  - 성공 응답은 바로 DB/cache에 저장한다.
  - 같은 작업 내 후속 계산은 네트워크 대신 저장된 데이터를 다시 읽어 사용한다.
- **6. 최소 범위 요청**
  - 전체 과거를 반복해서 다시 받지 않는다.
  - 마지막 성공 시각, max date, known id 범위를 기준으로 필요한 부분만 받는다.
- **7. 중복 제거**
  - ticker list는 호출 전에 `Set`으로 dedup 한다.
  - 같은 cursor/page를 다시 요청하지 않도록 continuation 상태를 기록한다.
- **8. 진행 로그**
  - 총 대상 수, 성공 수, 실패 수, retry 수, rate-limit hit 수를 남긴다.
  - 느린 이유를 나중에 추적할 수 있게 병목이 API인지 DB인지 로그에 드러나야 한다.

### 구현 패턴
- **Pattern A: symbol 간 병렬**
  - 예: OHLC, quote, profile, peers처럼 symbol별 독립 요청.
  - worker pool(concurrency 2~5) 사용.
- **Pattern B: symbol 간 병렬 + symbol 내부 순차 paging**
  - 예: 뉴스 history를 symbol별로 길게 따라가야 하는 경우.
  - 바깥쪽은 병렬, 안쪽은 continuation token 기반 순차.
- **Pattern C: 완전 순차 + 넓은 batch**
  - 예: provider가 단건 병렬보다 큰 범위 batch 1회가 더 효율적인 경우.
  - 호출 수 자체를 줄이는 쪽을 우선.

### 하지 말 것
- API 문서 확인 없이 무조건 순차 호출만 구현하지 않는다.
- rate limit 확인 없이 동시 10~20개 이상의 공격적 병렬화를 기본값으로 두지 않는다.
- 이미 DB에 있는 데이터를 매번 다시 받지 않는다.
- 넓은 날짜 범위를 습관적으로 요청하지 않는다.
- 429를 영구 실패처럼 처리해 바로 포기하지 않는다.
- 반대로 401/403 같은 인증 오류를 무작정 재시도하지 않는다.

### 검증 포인트
- 같은 입력을 두 번 실행했을 때 두 번째 실행이 더 빨라지는지 확인한다.
- 대상 수가 많아져도 rate limit 오류가 폭증하지 않는지 확인한다.
- 중복 ticker 제거가 실제로 호출 수를 줄였는지 로그로 확인한다.
- DB/cache hit가 있는 경우 네트워크 호출 없이 계산이 완료되는지 확인한다.
- 병렬화 후에도 결과 row 수, date range, merge 결과가 순차 버전과 동일한지 확인한다.

### 빠른 결정 규칙
- **독립 요청 + 작은 rate limit**: 소규모 병렬 + 429 backoff
- **독립 요청 + batch endpoint 존재**: batch 우선
- **continuation token 의존**: 내부 순차, 외부 단위만 병렬
- **이미 DB에 있음**: 네트워크 호출 금지

### FINNHUB publisher별 원문 추출 테스트 결과 기록 규칙
- FINNHUB source 뉴스는 `publisher`별로 원문 추출 가능 여부가 다르므로, 문서에는 반드시 “전용 scraper success”, “body-fallback success”, “unavailable”를 구분해서 적는다.
- `news_fulltext.extraction_status='success'`만으로 원문 추출 성공이라고 쓰지 않는다. `extraction_note`가 `body-fallback (...)`면 summary/body 재사용일 수 있다.

### 2026-03-25 실측 결과 — FINNHUB source 대표 publisher 샘플 테스트
- 테스트 방법:
  - `source='FINNHUB'`에서 `source_type + publisher`별 최신 row 1개를 뽑아 현재 `extractByDomain(url, publisher, body)`로 실제 실행
  - 분류 기준:
    - `scrape-success`: 전용 extractor로 원문 확보
    - `body-fallback-success`: summary/body 재사용 성공
    - `unavailable`: 현재 구조상 원문 확보 실패
- 테스트 결과 요약:
  - `NASDAQ` (`press_release`): `scrape-success`
  - `TMX` (`press_release`): `scrape-success`
  - `YAHOO` (`company_news`): 기존 대표 샘플은 `body-fallback-success`였지만, wrapper redirect를 따라 Yahoo 원문 page를 브라우저로 열면 `scrape-success` 경로로 승격 가능
  - `BENZINGA` (`company_news`): 현재는 `unavailable`로 보는 것이 맞다. 코드상 `benzinga-scrape`가 성공처럼 기록될 수 있지만, 실측 샘플 `c65d1d2e-718c-4795-bcd0-6d5f6b1419b0`에서는 실제 기사 본문이 아니라 `headline only article` / `Benzinga Pro` 홍보 문구만 저장됐다. 따라서 현 시점의 `benzinga-scrape`는 실질적 본문 추출 성공으로 간주하면 안 된다.
  - `SEEKINGALPHA` (`company_news`): 현재 `unavailable`로 보는 것이 맞다. 원문 page anti-bot 차단이 있고 summary fallback 저장은 금지해야 한다.
  - `CHARTMILL` (`company_news`): 현재 `unavailable`
  - `CNBC` (`company_news`): 현재 `unavailable`
  - `DOWJONES` (`company_news`): 현재 `unavailable`
  - `FINNHUB` (`company_news`): redirect/origin 미복구 시 `unavailable`
  - `REUTERS` (`market_news`): `body-fallback-success`
  - `BLOOMBERG` (`market_news`): `body-fallback-success`
  - `FINTEL` (`company_news`): `unavailable`
  - `MARKETWATCH` (`company_news`, `market_news`): `unavailable`
  - `CNBC` (`market_news`): `unavailable`
  - `GOOGLE NEWS` (`market_news`): `unavailable`
  - `UNKNOWN` (`press_release`): `body-fallback-success`
- 현재 코드 기준 결론:
  - FINNHUB `company_news`는 `finnhub.io/api/news?id=...` wrapper를 직접 읽지 말고, 먼저 `302 Location`으로 원문 `origin_url`을 복구해야 한다.
  - 현재 원문 추출을 성공으로 볼 수 있는 `company_news` publisher는 `YAHOO`만 확정이다.
  - `BENZINGA`는 코드상 시도 대상이지만, 현재 확인된 결과로는 promo / headline-only 페이지가 false positive success로 저장될 수 있으므로 지침상 `unavailable`로 취급한다.
  - 나머지 `company_news` publisher는 summary/body fallback success로 남기지 말고 `unavailable`로 남겨야 한다.

### company_news 재처리 운영 규칙
- 기존 실DB 상태에서는 `source='FINNHUB' AND source_type='company_news'`의 `origin_url`이 0건일 수 있다. 이 경우 fulltext 단계에서 wrapper redirect를 읽어 `origin_url`을 채우는 경로가 필요하다.
- 기존 `company_news` fulltext row는 대부분 summary/body fallback semantics로 저장돼 있으므로, 새 규칙으로 다시 채우려면 먼저 reset endpoint로 비우는 것이 맞다.
- 현재 backend는 `POST /api/news/pull-finhub`에서 `sourceType='company_news'`이면서 `mode='recent' | 'custom'`이고 새 row가 실제 insert되면, pull job 완료 직전에 그 새 row들만 대상으로 `news-fulltext` background job을 자동으로 이어서 시작한다.
- 이 자동 후속 fulltext는 수동 `Full Text > Company News Only`와 같은 `ft-concurrency` 값을 사용한다. 프론트가 `fulltextConcurrency`를 pull payload에 같이 보내고, backend가 그 값을 자동 후속 job에 전달한다.
- 현재 공용 fulltext 기본값은 `200`이다. 즉 localStorage가 비어 있으면 수동 fulltext와 자동 company fulltext 둘 다 기본 concurrency `200`으로 시작한다.
- 따라서 News Feed 창에서 `Recent Update (Company News)` 또는 `Custom Update (Company News)`를 실행하면, 별도 클릭 없이 방금 들어온 company news 데이터까지 fulltext 대상에 포함된다.
- 자동 후속 fulltext는 `news_items`에 새로 insert된 company news id만 대상으로 한다. 예전 backlog 전체를 매번 다시 훑지 않는다.
- 권장 순서:
  1. `POST /api/news/fulltext/reset-company-news`
  2. `POST /api/news/fulltext/update` with `{ "sourceType": "company_news" }`
  3. `news_fulltext.extraction_note`에서 `yahoo-finance-browser`, `benzinga-scrape`, `company-news-no-scraper:*` 분포를 확인하되, `benzinga-scrape`는 실제 저장 본문이 `headline only article`, `Benzinga Pro`, `Join 10,000+ serious traders` 같은 홍보 문구인지 반드시 샘플 검수한다.

### 왜 화면에서 publisher가 `FINNHUB`로 보일 수 있는가
- 현재 수집 코드는 `item.source`가 있으면 그 값을 publisher로 저장하지만, 기존 row는 `INSERT OR IGNORE` 때문에 중복 수집 시 업데이트되지 않는다.
- 따라서 처음 insert될 때 `FINNHUB`로 저장된 row는, 나중에 더 정확한 publisher 정보가 와도 그대로 남을 수 있다.
- 현재 backfill도 `NULL/UNKNOWN` row만 대상으로 하고, `url`만 보면 `finnhub.io/api/news?id=...`라 다시 `FINNHUB`가 나올 수 있다.
- 즉 `YAHOO`가 실제 publisher인 row도 과거 insert 순서와 중복 무시 때문에 `FINNHUB`로 남아 있을 수 있다.
