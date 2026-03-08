# Backend Prompt

## 목적
이 문서는 `terminal/backend/`의 현재 구현을 기준으로 한 작업용 프롬프트/스펙이다. plan 문서나 별도 설명 없이 이 문서만 읽어도, 백엔드가 지금 무엇을 저장하고 어떤 API를 노출하며 어떤 제약을 가지는지 바로 파악할 수 있어야 한다.

현재 백엔드의 중심 역할은 아래 5가지다.

1. Finnhub, EODHD, IBKR에서 가져온 데이터를 SQLite와 OHLC DB에 저장한다.
2. 저장된 뉴스를 `GET /api/news`로 조회 가능하게 만든다.
3. 장시간 작업은 background job으로 실행하고 `GET /api/jobs/:jobId`로 진행 상황과 로그를 반환한다.
4. 뉴스 full text와 뉴스 이후 가격 변화율(change metrics)을 후처리로 계산해 다시 저장한다.
5. CSV 티커 목록, watchlist, saved view, alerts, calendar 데이터를 API로 관리한다.

## 현재 구현 상태 요약

- 뉴스 주 저장소는 `terminal/backend/backend/data/app.db` 이다.
- Finnhub API 키는 서버 시작 시 필수다. 키가 없으면 서버가 기동되지 않는다.
- EODHD 토큰은 `POST /api/news/pull-eodhd` 호출 시에만 필요하다.
- Finnhub 뉴스 pull, full text 추출, OHLC 업데이트, 뉴스 change 재계산은 모두 background job으로 실행된다.
- `GET /api/news`는 `news_items` 본문만 읽는 것이 아니라 `news_change_metrics`, `news_fulltext`, industry lookup 결과를 join/병합해서 내려준다.
- industry 값은 DB 컬럼이 아니라, 가장 최근 `tradigview_screener/original_data/watch lists2*.csv`에서 읽어온 ticker → industry 매핑을 응답 시점에 붙인다.
- full text 추출기는 현재 `NASDAQ`, `TMX`, `FINNHUB` 3가지 publisher 흐름만 구체 처리한다.
- mock calendar 생성기는 이미 제거되어 startup 시 자동 mock insert는 더 이상 하지 않는다.
- `news_change_metrics` 테이블은 현재 코드상 서버 시작 때마다 `DROP TABLE IF EXISTS` 후 재생성된다. 즉, change metric 데이터는 서버 재시작 시 초기화된다.
- job manager는 메모리 기반이다. 서버 재시작 시 job 상태와 로그는 유지되지 않는다.

## 실행과 환경

`terminal/backend/`에서 실행한다.

```bash
npm install
npm run dev
```

배포/검증용 스크립트:

```bash
npm run build
npm run test
```

기본 환경값:

- 포트: `8080` (`PORT`)
- 앱 DB 경로: `./backend/data/app.db` (`SQLITE_PATH`)
- 허용 프론트 origin: `http://localhost:5174` (`FRONTEND_ORIGIN`)

환경 변수 로딩 순서:

1. `dotenv.config({ path: "../.env" })`
2. `dotenv.config()`

즉 `terminal/.env`가 있으면 먼저 읽고, 그 다음 현재 작업 디렉터리 기준 `.env`를 추가로 읽는다.

### Finnhub API 키

조회 순서:

1. 환경 변수 `FINNHUB_API_KEY`
2. 레포 루트의 `finhub/finhub_api_key/finhub_api_key`

없으면 서버가 아래 형태의 오류로 시작 실패한다.

```text
FINNHUB_API_KEY not found. Set env var FINNHUB_API_KEY or place key in finhub/finhub_api_key/finhub_api_key
```

### EODHD 토큰

`POST /api/news/pull-eodhd`는 레포 루트의 `EODHD/API TOKEN` 파일을 읽는다.

## 저장 구조

### 앱 DB

경로: `terminal/backend/backend/data/app.db`

주요 테이블:

#### `news_items`
컬럼:

- `[][][]id[][][]`
- `[][][]published_at[][][]`
- `[][][]source[][][]`
- `[][][]publisher[][][]`
- `[][][]source_type[][][]`
- `[][][]title[][][]`
- `[][][]body[][][]`
- `[][][]url[][][]`
- `[][][]tickers_csv[][][]`
- `[][][]tags_csv[][][]`
- `[][][]created_at[][][]`
- `[][][]ohlc_ticker[][][]`
- `[][][]ohlc_date[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]change_computed_at[][][]`

제약:

- `UNIQUE (source, url)`
- 인덱스: `(published_at DESC, id DESC)`

주의:

- change 관련 컬럼은 여전히 테이블에 남아 있지만, 현재 `GET /api/news`는 실질적으로 `news_change_metrics`에서 값을 읽어 join한다.

#### `news_change_metrics`
컬럼:

- `[][][]news_id[][][]`
- `[][][]metric_key[][][]`
- `[][][]value_pct[][][]`
- `[][][]ohlc_ticker[][][]`
- `[][][]reference_date[][][]`
- `[][][]target_date[][][]`
- `[][][]forward_trading_days[][][]`
- `[][][]calc_version[][][]`
- `[][][]computed_at[][][]`

기본키:

- `(news_id, metric_key)`

표준 metric key:

- `[][][]change_from_open_pct[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`

운영적 정의:

- `change_from_open_pct`: 뉴스 기준일 시가 → 뉴스 기준일 종가
- `change_1d_pct`: 뉴스 기준일 종가 → 1거래일 후 종가
- `change_7d_pct`: 뉴스 기준일 종가 → 5거래일 후 종가
- `change_14d_pct`: 뉴스 기준일 종가 → 10거래일 후 종가
- `change_30d_pct`: 뉴스 기준일 종가 → 22거래일 후 종가

주의:

- 코드 주석에는 “30d = 22 trading days”라고 되어 있다.
- 테이블은 startup 때 항상 재생성된다.

#### `news_fulltext`
컬럼:

- `[][][]news_id[][][]`
- `[][][]full_text[][][]`
- `[][][]extraction_status[][][]`
- `[][][]extraction_note[][][]`
- `[][][]word_count[][][]`
- `[][][]extracted_at[][][]`
- `[][][]keywords_json[][][]`
- `[][][]keywords_status[][][]`
- `[][][]keywords_updated_at[][][]`

의미:

- `keywords_json`은 후속 AI keyword 분석 결과 저장용이다.
- 현재 backend는 keyword를 직접 생성하지 않는다.
- `getUnextractedNewsIds()`는 `news_fulltext` row 자체가 없는 뉴스만 대상으로 삼는다. 즉 한 번 `failed`/`skipped` row가 생기면, 현재 구현상 같은 row를 자동 재시도하지 않는다.

#### `calendar_events`
컬럼:

- `[][][]id[][][]`
- `[][][]event_type[][][]`
- `[][][]ticker[][][]`
- `[][][]title[][][]`
- `[][][]event_at[][][]`
- `[][][]meta_json[][][]`
- `[][][]source[][][]`
- `[][][]unique_key[][][]`
- `[][][]created_at[][][]`

제약:

- `UNIQUE (event_type, unique_key)` 인덱스 존재

#### `company_profiles`
컬럼:

- `[][][]id[][][]`
- `[][][]security_id[][][]`
- `[][][]source[][][]`
- `[][][]description[][][]`
- `[][][]ceo[][][]`
- `[][][]employees[][][]`
- `[][][]website[][][]`
- `[][][]ipo_date[][][]`
- `[][][]market_cap[][][]`
- `[][][]raw_json[][][]`
- `[][][]fetched_at[][][]`
- `[][][]peers_json[][][]`

의미:

- 종목별 회사 프로필 canonical 저장소. `source` 컬럼으로 데이터 출처를 구분한다.
- `source = 'fmp'`: FMP(Financial Modeling Prep)에서 가져온 description/ceo/employees 등.
- `source = 'finnhub'`: Finnhub `/stock/peers`에서 가져온 peers 데이터. 이 경우 `peers_json`만 채워지고 나머지(description 등)는 비어 있을 수 있다.
- `peers_json`: JSON 배열 문자열. 예: `["DELL","WDC","HPE"]`. Finnhub peers API 결과를 그대로 저장한다.
- `security_id`는 `securities` 테이블과 FK로 연결된다.

#### `update_status`
컬럼:

- `[][][]source_key[][][]`
- `[][][]last_success_at[][][]`
- `[][][]details_json[][][]`
- `[][][]updated_at[][][]`

항상 응답에 보장되는 기본 key:

- `[][][]tickers_csv[][][]`
- `[][][]finhub_news[][][]`
- `[][][]ibkr_calendar[][][]`
- `[][][]ibkr_ohlc_1d[][][]`

추가 key:

- `news_change_recent`, `news_change_custom` 같은 값은 DB에 row가 생기면 응답에 함께 포함된다.

#### `news_sentiment_snapshots`
컬럼:

- `[][][]ticker[][][]`
- `[][][]fetched_at[][][]`
- `[][][]bullish_pct[][][]`
- `[][][]bearish_pct[][][]`
- `[][][]company_news_score[][][]`
- `[][][]sector_avg_bullish[][][]`
- `[][][]sector_avg_news_score[][][]`
- `[][][]raw_json[][][]`

기본키: `(ticker, fetched_at)`

의미: Finnhub `/news-sentiment` endpoint 결과를 ticker·시간대별로 캐시한다.

#### `news_ai_analysis`
컬럼:

- `[][][]news_id[][][]`
- `[][][]analysis_status[][][]`
- `[][][]score[][][]`
- `[][][]score_evidence[][][]`
- `[][][]keywords_json[][][]`
- `[][][]model_id[][][]`
- `[][][]created_at[][][]`
- `[][][]updated_at[][][]`

기본키: `news_id`

의미: 외부 AI가 생성한 score/evidence/keywords를 저장한다. `analysis_status`가 `completed`인데 `score`나 `score_evidence`가 NULL이면 유실로 간주한다.

#### `bookmark_folders`
컬럼:

- `[][][]id[][][]`
- `[][][]user_id[][][]`
- `[][][]name[][][]`
- `[][][]parent_id[][][]`
- `[][][]sort_order[][][]`
- `[][][]created_at[][][]`

의미: 크롬 북마크처럼 폴더 트리 구조를 제공한다.

#### `bookmark_items`
컬럼:

- `[][][]folder_id[][][]`
- `[][][]news_id[][][]`
- `[][][]created_at[][][]`

기본키: `(folder_id, news_id)`

의미: 뉴스 row를 폴더에 저장한다.

#### `confirmed_empty_ranges`
컬럼:

- `[][][]ticker[][][]`
- `[][][]source_type[][][]`
- `[][][]range_from[][][]`
- `[][][]range_to[][][]`
- `[][][]confirmed_at[][][]`

기본키: `(ticker, source_type)`

의미: Finnhub recent pull에서 HTTP 200 + 빈 배열이 확인된 과거 범위를 기록하여 자동 재조회 낭비를 줄인다. 당일 범위는 제외한다.

#### 기타 테이블

- `news_saved_views`
- `watchlists`
- `watchlist_items`
- `alert_rules`
- `users`

### OHLC DB

경로: `OHLC_data/ohlc_1d_watchlist.sqlite`

주 테이블:

- `[][][]ohlc_1d[][][]`
  - 기본 컬럼: `Symbol`, `Datetime`, `Open`, `High`, `Low`, `Close`, `Volume`
  - symbol/date 기준 unique upsert

## 뉴스 조회 API

### `GET /api/news`

지원 query:

- `keyword`
- `tickers=TSLA,NVDA`
- `sources=company_news,press_release`
- `source_type=company_news,press_release` (`sources`의 alias)
- `source_names=FINNHUB,EODHD`
- `tags=earnings,macro`
- `from`
- `to`
- `limit`
- `cursor`

필터 동작:

- `keyword`: `LOWER(title || ' ' || body)` substring match
- `tickers`: `tickers_csv LIKE '%,TICKER,%'`
- `sources`: `news_items.source_type IN (...)`
- `source_names`: `news_items.source IN (...)`
- `tags`: `tags_csv LIKE '%,tag,%'`
- `cursor`: 정렬 `(published_at DESC, id DESC)` 기준 base64 커서

limit 정책:

- 기본값: `500`
- hard clamp: `1..500`
- `from/to` 범위 유무와 관계없이 항상 최대 500

응답 형식:

```json
{
  "items": [
    {
      "id": "...",
      "published_at": "2026-03-06T12:34:56.000Z",
      "source": "FINNHUB",
      "publisher": "NASDAQ",
      "source_type": "press_release",
      "title": "...",
      "body": "...",
      "url": "...",
      "tickers": ["AAPL"],
      "tags": [],
      "created_at": "...",
      "ohlc_ticker": "AAPL",
      "ohlc_date": "2026-03-07",
      "change_1d_pct": 1.23,
      "change_from_open_pct": -0.42,
      "change_7d_pct": 3.11,
      "change_14d_pct": null,
      "change_30d_pct": null,
      "change_computed_at": "...",
      "hasFullText": true,
      "keywords": ["earnings", "guidance"],
      "keywordsStatus": "ready",
      "industry": "Technology",
      "score": 8,
      "scoreEvidence": "Strong earnings beat with raised guidance",
      "analysisStatus": "completed",
      "sentimentBullishPct": 0.72,
      "sentimentBearishPct": 0.15,
      "companyNewsScore": 0.85,
      "peers": ["DELL", "WDC", "HPE"],
      "companyDescription": "Apple Inc. designs, manufactures, and markets smartphones..."
    }
  ],
  "nextCursor": "..."
}
```

뉴스 item 출력 컬럼:

- `[][][]id[][][]`
- `[][][]published_at[][][]`
- `[][][]source[][][]`
- `[][][]publisher[][][]`
- `[][][]source_type[][][]`
- `[][][]title[][][]`
- `[][][]body[][][]`
- `[][][]url[][][]`
- `[][][]tickers[][][]`
- `[][][]tags[][][]`
- `[][][]created_at[][][]`
- `[][][]ohlc_ticker[][][]`
- `[][][]ohlc_date[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]change_computed_at[][][]`
- `[][][]hasFullText[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`
- `[][][]industry[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]analysisStatus[][][]`
- `[][][]sentimentBullishPct[][][]`
- `[][][]sentimentBearishPct[][][]`
- `[][][]companyNewsScore[][][]`
- `[][][]peers[][][]`
- `[][][]companyDescription[][][]`

companyDescription 규칙:

- `companyDescription`은 `company_profiles.description`에서 가져온다. 뉴스 row의 대표 ticker(tickers 배열의 첫 번째)를 기준으로 company_profiles를 lookup한다.
- 해당 ticker에 description이 없거나 빈 문자열이면 `null`이다.
- company profile pull을 하지 않은 ticker는 항상 `null`이다.

peers 규칙:

- `peers`는 `company_profiles.peers_json`에서 가져온다. 뉴스 row의 대표 ticker(tickers 배열의 첫 번째)를 기준으로 company_profiles를 lookup한다.
- 해당 ticker에 peers가 없으면 빈 배열 `[]`이다.
- peers pull을 하지 않은 ticker는 항상 빈 배열이다.

- `analysis_status`가 `null` 또는 `not_started`이면 score/scoreEvidence도 `null`이 정상이다 (아직 분석 안 됨).
- `analysis_status=completed`인데 score나 scoreEvidence가 `null`이면 유실(lost)로 간주한다.

sentiment 규칙:

- `sentimentBullishPct`, `sentimentBearishPct`, `companyNewsScore`는 `news_sentiment_snapshots`에서 가장 최근 ticker snapshot을 가져온다.
- 해당 ticker에 snapshot이 없으면 모두 `null`이다.

bookmarkFolderId query:

- `bookmarkFolderId=<uuid>`가 주어지면 `bookmark_items` INNER JOIN으로 해당 폴더에 저장된 뉴스만 반환한다.

### `GET /api/news/:id`

`GET /api/news`의 단일 row 버전이며, 같은 매핑 규칙을 사용한다.

### `GET /api/news/stream`

SSE endpoint.

- query filter는 `GET /api/news`와 동일 파서 사용
- `StreamHub`가 client별 filter를 저장
- heartbeat는 20초마다 발생
- 새 뉴스가 insert될 때 filter를 만족하는 client에만 push

## 뉴스 적재 API

### `POST /api/news/pull-finhub`

요청 body:

```json
{
  "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv",
  "maxTickers": 0,
  "mode": "7d",
  "sourceType": "all",
  "from": "2026-03-01",
  "to": "2026-03-06"
}
```

필드 의미:

- `csvPath`: 기본값은 `watch lists2_2026-02-22.csv`
- `maxTickers=0`: CSV 전체 ticker 사용
- `mode`: `7d | recent | custom`
- `sourceType`: `all | company_news | press_release | market_news`
- `custom`일 때만 `from/to` 사용

동작:

1. CSV에서 ticker 목록을 읽는다.
2. `recent`일 경우 ticker별 마지막 뉴스 시각(anchor map)을 읽는다.
3. 즉시 `jobId`를 반환한다.
4. background job에서 source type별 fetch를 수행한다.
5. 새 row는 `INSERT OR IGNORE`로 저장한다.
6. 신규 row만 SSE로 publish 한다.
7. 마지막에 신규 뉴스에 대해 `mergeChangeForNewItems()`를 돌린다.
8. `update_status.finhub_news`를 갱신한다.

응답:

```json
{ "jobId": "..." }
```

background job 완료 시 `result` 예시:

```json
{
  "source": "FINNHUB",
  "mode": "recent",
  "sourceType": "all",
  "tickerCount": 120,
  "inserted": 42,
  "skipped": 10,
  "changeMerged": 37,
  "details": {
    "company_news": { "fetched": 30, "inserted": 22 },
    "press_release": { "fetched": 15, "inserted": 10 },
    "market_news": { "fetched": 20, "inserted": 10 }
  }
}
```

### `GET /api/news/pull-finhub/preflight`

query:

- `sourceType`
- `csvPath`

용도:

- `recent` 실행 전, 기존 뉴스가 전혀 없는 fallback ticker 수를 미리 보여준다.

응답:

```json
{
  "totalTickers": 200,
  "fallbackCount": 15,
  "fallbackTickers": ["AAPL", "TSLA"]
}
```

### `POST /api/news/pull-eodhd`

입력 모드 둘 중 하나만 허용:

1. `{ "date": "YYYY-MM-DD" }`
2. `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`

추가 필드:

- `symbol` 기본값: `QQQ.US`
- `limit` 기본값: `200`
- `offset` 기본값: `0`
- `fetch_all` 기본값: `false`

동작:

- `fetch_all=false`면 offset 기반 한 번 호출
- `fetch_all=true`면 서버 내부에서 반복 fetch
- 저장은 `INSERT OR IGNORE`
- 신규 row는 SSE publish

응답 출력 컬럼:

- `[][][]symbol[][][]`
- `[][][]from[][][]`
- `[][][]to[][][]`
- `[][][]offset[][][]`
- `[][][]nextOffset[][][]`
- `[][][]done[][][]`
- `[][][]fetched[][][]`
- `[][][]inserted[][][]`
- `[][][]truncated[][][]`

## Full Text API

### `POST /api/news/fulltext/update`

요청 body:

```json
{ "sourceType": "all" }
```

현재 구현상 `sourceType`은 엄격 zod 검증이 없고 문자열 그대로 내려간다. 실제 조회 함수는 아래처럼 동작한다.

- 생략 또는 `all`: 전체 미추출 뉴스
- `company_news`, `press_release`, `market_news`: 해당 `news_items.source_type`만 대상

사전 동작:

- `backfillPublisher()`를 먼저 실행해 publisher 없는 기존 row를 보정한다.

응답:

```json
{ "jobId": "...", "total": 123 }
```

### `GET /api/news/fulltext/:newsId`

응답 출력 컬럼:

- `[][][]newsId[][][]`
- `[][][]fullText[][][]`
- `[][][]extractionStatus[][][]`
- `[][][]extractionNote[][][]`
- `[][][]wordCount[][][]`
- `[][][]extractedAt[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`

### 추출기 규칙

- `NASDAQ`: HTML fetch + cheerio 파싱
- `TMX`: URL의 `newsid`를 추출해 `https://app-money.tmx.com/graphql` 호출
- `FINNHUB`: 외부 기사 페이지가 아니라서 `skipped`
- unknown publisher: `unavailable`

재시도 정책:

- 최대 10회
- 기본 지연 500ms
- 429/5xx/backoff 처리
- fulltext batch는 non-FINNHUB publisher 사이에 400ms delay 추가

## Change Metric API

### `POST /api/news/change/update-recent`

- body 없음
- 최근 7일 뉴스 전체에 대해 표준 metric 재계산
- 즉시 `jobId` 반환
- 완료 시 `update_status.news_change_recent` 갱신

### `POST /api/news/change/update-custom`

요청 body:

```json
{ "from": "2026-03-01", "to": "2026-03-06" }
```

- 지정 기간 뉴스 전체에 대해 표준 metric 재계산
- 즉시 `jobId` 반환
- 완료 시 `update_status.news_change_custom` 갱신

## Job API

### `GET /api/jobs/:jobId`

응답 출력 컬럼:

- `[][][]id[][][]`
- `[][][]status[][][]` (`running | done | failed`)
- `[][][]progress[][][]`
  - `[][][]completed[][][]`
  - `[][][]total[][][]`
  - `[][][]pct[][][]`
- `[][][]logs[][][]`
- `[][][]error[][][]`
- `[][][]result[][][]`
- `[][][]createdAt[][][]`
- `[][][]updatedAt[][][]`

주의:

- 메모리 기반이므로 서버 재시작 시 사라진다.
- 30분 cleanup 정책이 적용된다.

## Ticker CSV API

### `GET /api/tickers`

query:

- `csvPath` 필수

응답:

```json
{ "csvPath": "...", "tickers": ["AAPL", "MSFT"] }
```

### `POST /api/tickers/add`

요청 body:

```json
{ "csvPath": "...", "ticker": "TSLA" }
```

응답:

```json
{ "csvPath": "...", "tickerAdded": "TSLA", "tickers": ["..."] }
```

보안/쓰기 정책:

- `tradigview_screener/original_data/` 하위 `.csv`만 허용
- path traversal 금지
- ticker 정규식: `^[A-Z0-9.\-]{1,20}$`
- atomic temp write + rename
- Windows lock 대응 재시도 최대 10회
- 성공 시 `update_status.tickers_csv` 갱신

## Calendar API

### `GET /api/calendar/types`

캘린더 타입 설정을 반환한다.

### `GET /api/calendar/events`

지원 query:

- `type`
- `tickers`
- `watchlist_id`
- `from`
- `to`
- `time_of_day` (`BMO | AMC | Unknown`)
- `region`
- `sort` (`field:asc|desc`)
- `cursor`
- `limit`

### `GET /api/calendar/events/export.csv`

위와 같은 필터로 CSV export를 만든다.

### `GET /api/calendar/events/:id`

단일 event 조회.

### `POST /api/ibkr/calendar/update`

현재 구현은 synchronous response다. background job이 아니다.

요청 body:

```json
{ "mode": "backfill" }
```

- `mode`: `"backfill"` | `"refresh"` (기본값: `"backfill"`)
  - `backfill`: 과거 2년 + 미래 180일. 초기 적재용.
  - `refresh`: 최근 30일 overlap + 미래 90일. 반복 갱신용. 과거 전체를 다시 받지 않는다.

동작:

1. `req.body.mode` 읽기 → `backfill` 또는 `refresh`
2. `getCalendarDateRange(mode)` → 날짜 범위 계산
3. `getDefaultUniverseTickers()` → 대상 종목 가져오기
4. `pullIbkrCalendar(tickers, mode)` 실행 (현재 stub — TWS 미연결 시 에러)
5. event upsert
6. `mock_provider` row 삭제
7. `update_status.ibkr_calendar` 갱신 (mode, dateRange 포함)

응답 (성공 시):

```json
{ "mode": "backfill", "dateRange": { "from": "2024-03-08", "to": "2026-09-03" }, "upserted": 10, "deletedMockRows": 5, "source": "IBKR" }
```

응답 (현재 stub 에러):

```json
{ "error": "IBKR 캘린더 미구현 (mode=backfill, range=2024-03-08~2026-09-03): TWS 실행 상태 + Python bridge 스크립트가 필요합니다 (Step 6-3)." }
```

UI 위치:
- Data Control → Updates → Calendar Update 그룹: `Initial Calendar Backfill` / `Refresh Upcoming Calendar` 버튼
- News Feed → update 드롭다운 → Calendar Update 섹션: 동일한 두 버튼

## OHLC API

### `GET /api/ibkr/ohlc1d/status`

응답 출력 컬럼:

- `[][][]dbPath[][][]`
- `[][][]overallMaxDate[][][]`
- `[][][]lastSuccessAt[][][]`

### `POST /api/ibkr/ohlc1d/update`

요청 body:

```json
{ "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv" }
```

동작:

1. CSV에서 ticker 읽기
2. 종목별 마지막 저장 일자 다음 날부터 오늘까지 OHLC fetch
3. `ohlc_1d` upsert
4. 파생 컬럼 계산
5. 영향받은 ticker 관련 뉴스에 대해 change metric backfill
6. `update_status.ibkr_ohlc_1d` 갱신

응답:

```json
{ "jobId": "..." }
```

job 완료 result 예시:

```json
{
  "tickersRequested": 120,
  "tickersUpdated": 118,
  "tickersFailed": 2,
  "totalRowsUpserted": 3400,
  "overallMaxDateBefore": "2026-02-20",
  "overallMaxDateAfter": "2026-03-06"
}
```

## Saved Views / Watchlists / Alerts API

### Saved Views

- `POST /api/news/saved-views`
- `GET /api/news/saved-views`
- `DELETE /api/news/saved-views/:id`

### Watchlists

- `GET /api/watchlists`
- `POST /api/watchlists`
- `DELETE /api/watchlists/:id`

### Alerts

- `GET /api/settings/alerts`
- `POST /api/settings/alerts`

alert tool enum:

- `news`
- `watchlists`
- `calendar`

methods enum:

- `browser`
- `sound`
- `email`

## Bookmark API

### `GET /api/bookmarks/folders`

응답: 폴더 배열 (`[{id, user_id, name, parent_id, sort_order, created_at}]`)

### `POST /api/bookmarks/folders`

요청 body: `{"name": "...", "parentId": "..."}`

응답: 생성된 폴더 object.

### `PUT /api/bookmarks/folders/:id`

요청 body: `{"name": "...", "parentId": "..."}`

### `DELETE /api/bookmarks/folders/:id`

folder와 연관 bookmark_items가 함께 삭제된다.

### `POST /api/bookmarks/items`

요청 body: `{"folderId": "...", "newsId": "..."}`

### `DELETE /api/bookmarks/items`

요청 body: `{"folderId": "...", "newsId": "..."}`

### `GET /api/bookmarks/folders/:folderId/items`

해당 폴더의 북마크 아이템 목록을 조회한다. `news_items`와 LEFT JOIN하여 `title`, `ticker`도 함께 반환한다.

응답: `[{"news_id", "bookmarked_at", "title", "ticker"}]`

### `PATCH /api/bookmarks/items/move`

북마크 아이템을 한 폴더에서 다른 폴더로 이동한다.

요청 body: `{"newsId": "...", "fromFolderId": "...", "toFolderId": "..."}`
동작: fromFolderId에서 삭제 후 toFolderId에 INSERT OR IGNORE.

## Company Profile API

### `GET /api/company-profiles/:ticker`

지정 ticker의 회사 프로필을 반환한다. `securities` 테이블과 `company_profiles`를 join해서 가장 최근 프로필을 내려준다.

### `POST /api/company-profiles/pull-fmp`

FMP(Financial Modeling Prep)에서 회사 설명을 가져와 `company_profiles`에 저장한다.

요청 body:

```json
{ "maxTickers": 50 }
```

### `POST /api/company-profiles/pull-peers`

Finnhub `/stock/peers` API로 관련 종목 데이터를 수집해 `company_profiles.peers_json`에 저장한다.

요청 body:

```json
{ "tickers": ["AAPL", "MSFT"], "maxTickers": 50 }
```

- `tickers` 생략 시 `ticker_universes/default` 기준으로 대상을 결정한다.
- `maxTickers` 기본값: 50

응답 출력 컬럼:

- `[][][]requested[][][]`
- `[][][]fetched[][][]`
- `[][][]upserted[][][]`
- `[][][]errors[][][]`
- `[][][]errorDetails[][][]`

동작:

1. 대상 ticker 목록을 결정한다 (body에서 지정 또는 default universe).
2. Finnhub `/stock/peers?symbol=X`를 ticker당 120ms 간격으로 호출한다.
3. 결과를 `company_profiles`에 `source = 'finnhub'`로 upsert한다.
4. 동일 security_id + source 조합이 이미 있으면 UPDATE, 없으면 INSERT.

## AI Analysis API

### `GET /api/news/ai-analysis/validate`

전체 `news_ai_analysis` row에 대해 무결성 검증을 수행한다.

규칙:

- `analysis_status=completed`인데 `score IS NULL` → FAIL
- `analysis_status=completed`인데 `score_evidence IS NULL` → FAIL
- `analysis_status=completed`인데 `keywords_json='[]'` → WARN

응답: `{"total", "failCount", "warnCount", "failures": [{newsId, reason}]}`

### `POST /api/news/fulltext/backfill-plaintext`

기존 HTML fragment 기반 full_text row를 plain text로 변환하는 일괄 처리를 실행한다.

## 기타 API

- `GET /healthz`
- `GET /api/config`
  - 출력: `[][][]realtime[][][]`, `[][][]pollingFallbackSeconds[][][]`, `[][][]demoUserId[][][]`

## 파일 맵

- `src/server.ts`: Express 엔트리, route 등록, background job 시작점
- `src/db.ts`: app DB schema 생성과 migration
- `src/config.ts`: env 로딩, Finnhub 키 확인
- `src/services/newsRepository.ts`: 뉴스 조회, filter, cursor, insert, industry 병합
- `src/services/finnhubNewsProvider.ts`: Finnhub fetch, recent/backfill 로직, publisher 보정
- `src/services/eodhdNewsProvider.ts`: EODHD fetch
- `src/services/newsChangeMerger.ts`: forward-looking change 계산
- `src/services/fulltextRepository.ts`: fulltext persistence
- `src/services/fulltextUpdateService.ts`: fulltext background orchestration
- `src/services/fulltextExtractors.ts`: Nasdaq/TMX/Finnhub domain extractor
- `src/services/tickerCsvService.ts`: allowlist CSV read/append
- `src/services/calendarRepository.ts`: calendar query/export/upsert
- `src/services/calendarIngestion.ts`: IBKR calendar fetch
- `src/services/ohlcWatchlistRepository.ts`: OHLC DB read/write
- `src/services/ibkrOhlc1dProvider.ts`: IBKR OHLC provider
- `src/services/updateStatusRepository.ts`: update_status read/write
- `src/services/aiAnalysisRepository.ts`: AI analysis CRUD, batch, 무결성 검증
- `src/services/jobManager.ts`: in-memory jobs
- `src/realtime/streamHub.ts`: SSE client registry

## 현재 한계와 주의점

- `news_change_metrics`는 startup 시 매번 초기화된다.
- full text는 row가 이미 생성된 뉴스에 대해 자동 재시도하지 않는다.
- `POST /api/ibkr/calendar/update`는 background job이 아니라 즉시 처리형이다.
- `GET /api/updates/status`의 기본 key 목록에는 `news_change_recent`, `news_change_custom`가 하드코딩되어 있지 않다. 다만 DB row가 생기면 extra key로 응답에 포함된다.
- industry는 DB source of truth가 아니라 최신 `watch lists2*.csv` 파일 기반 lazy cache다.
- job 상태는 영속 저장이 아니므로 운영 audit 용 로그 저장소로 간주하면 안 된다.
