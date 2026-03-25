# Backend Prompt

## 목적
이 문서는 `terminal/backend/` 현재 구현 기준의 백엔드 스펙이다. 어떤 데이터가 어디에 저장되고, 어떤 API가 열려 있으며, 현재 런타임 제약이 무엇인지 이 문서만 읽고 바로 파악할 수 있어야 한다.

현재 백엔드의 핵심 역할은 아래와 같다.

1. Finnhub, EODHD, IBKR, FMP 데이터를 SQLite와 OHLC DB에 적재한다.
2. `GET /api/news`로 뉴스 통합 조회 API를 제공한다.
3. 장시간 작업을 background job으로 실행하고 `GET /api/jobs/:jobId`로 상태/로그를 반환한다.
4. full text, 뉴스 후행 변화율, sentiment, company profile/peers 같은 보강 데이터를 저장한다.
5. ticker CSV, universe, bookmarks, alerts, calendar, research, DB inspect API를 제공한다.

## 현재 구현 상태 요약

- 런타임 뉴스 DB는 `terminal/backend/backend/data/app.db` 이다.
- Finnhub API 키는 서버 시작 시 필수다. 없으면 서버가 시작되지 않는다.
- FMP API 키는 선택 사항이다. 없으면 company profile FMP pull만 제한된다.
- EODHD 토큰은 `POST /api/news/pull-eodhd` 호출 시 파일에서 읽는다.
- `GET /api/news`는 `news_items` 단독 조회가 아니라 `news_change_metrics`, `news_fulltext`, `news_ai_analysis`, sentiment snapshot, peers, company description, IPO date, market cap, industry를 join/병합해서 내려준다.
- `news_change_metrics`는 `CREATE TABLE IF NOT EXISTS`로 유지되는 영구 테이블이며, change update 작업이 metric 단위로 UPSERT 한다.
- background job 상태와 로그는 메모리 기반이라 서버 재시작 시 유지되지 않는다.
- default ticker universe는 서버 시작 시 CSV를 읽어 `securities`, `ticker_universes`, `ticker_universe_items`를 upsert하며, 이후 기본 경로 조회/수정은 DB-primary로 동작하고 CSV는 backup sync 성격이다.
- case research 노트는 같은 `app.db`의 `research_tabs`, `research_pages` 테이블에 저장된다.
- `company_profiles`는 ticker당 단일 row가 아니라 `security_id + source` 기준 다중 row 구조다. ticker 심볼 해석은 `securities` JOIN이 필요하다.
- `update_status`의 현재 핵심 컬럼은 `source_key`, `last_success_at`, `details_json`, `updated_at` 이다.
- research API, bookmarks API, alerts API는 현재 고정 demo user id를 기준으로 동작한다.
- `GET /api/news/stream` SSE endpoint가 존재하며 새 뉴스 insert 시 필터를 만족하는 클라이언트에 push 한다.

## 실행과 환경

`terminal/backend/`에서 실행한다.

```bash
npm install
npm run dev
```

검증/배포용 명령:

```bash
npm run build
npm run test
```

기본 환경값:

- 포트: `8080` (`PORT`)
- 앱 DB 경로: `./backend/data/app.db` (`SQLITE_PATH`)
- 허용 프런트 origin: `http://localhost:5174` (`FRONTEND_ORIGIN`)

환경 변수 로딩 순서:

1. `dotenv.config({ path: "../.env" })`
2. `dotenv.config()`

### Finnhub API 키

조회 순서:

1. 환경 변수 `FINNHUB_API_KEY`
2. `finhub/finhub_api_key/finhub_api_key`

없으면 서버는 아래 오류로 시작 실패한다.

```text
FINNHUB_API_KEY not found. Set env var FINNHUB_API_KEY or place key in finhub/finhub_api_key/finhub_api_key
```

### FMP API 키

조회 순서:

1. 환경 변수 `FMP_API_KEY`
2. `ai_agent_plan/fmp_api_key/fmp_api_key`

없어도 서버는 시작된다.

### EODHD 토큰

`POST /api/news/pull-eodhd`는 레포 루트의 `EODHD/API TOKEN` 파일을 읽는다.

## 저장 구조

### 앱 DB

경로: `terminal/backend/backend/data/app.db`

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
- `[][][]origin_url[][][]`
- `[][][]origin_url[][][]`

제약:

- `UNIQUE (source, url)`
- 인덱스 `(published_at DESC, id DESC)`

주의:

- change 관련 컬럼은 legacy 호환용으로 남아 있지만, 실제 조회는 `news_change_metrics` join 값을 우선 사용한다.
- `[][][]change_pct_ohlc_date[][][]`, `[][][]change_1d_target_date[][][]`는 `news_items` 물리 컬럼이 아니라 `GET /api/news`에서 joined metric target date를 alias로 노출한 응답 필드다.
- 오래된 DB에는 `[][][]change_pct[][][]`, `[][][]change_open_to_high_pct[][][]`, `[][][]change_3d_pct[][][]` 같은 legacy 컬럼이 남아 있을 수 있지만, 현재 `initDb()`가 보장하는 핵심 컬럼은 위 목록 기준이다.

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

기본키: `(news_id, metric_key)`

표준 metric key:

- `[][][]change_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_open_to_high_pct[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_3d_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`

운영적 정의:

- `change_pct`: 전일 종가 → 뉴스 기준일 종가 (Chg)
- `change_from_open_pct`: 뉴스 기준일 시가 → 기준일 종가
- `change_open_to_high_pct`: 뉴스 기준일 시가 → 기준일 고가
- `change_1d_pct`: 전일 종가 → 1거래일 후 종가
- `change_3d_pct`: 전일 종가 → 3거래일 후 종가
- `change_7d_pct`: 전일 종가 → 5거래일 후 종가
- `change_14d_pct`: 전일 종가 → 10거래일 후 종가
- `change_30d_pct`: 전일 종가 → 22거래일 후 종가

조회 필드 의미:

- `[][][]ohlc_date[][][]`: 현재 UI 호환용 기본 날짜 필드이며, `change_pct`가 계산된 기준일(`change_pct.target_date`)을 의미한다.
- `[][][]change_pct_ohlc_date[][][]`: `change_pct`가 계산된 기준일을 명시적으로 노출한 필드다.
- `[][][]change_1d_target_date[][][]`: `change_1d_pct`의 forward target date다. 이전에는 이 값이 `ohlc_date`로 잘못 보이던 구간이 있었다.
- 대응 metric 값이 `null`이면 대응 날짜 필드도 `null`이다. 예: `change_1d_pct = null`이면 `change_1d_target_date = null`.

주의:

- 서버 시작 시 drop/recreate 하지 않는다. change update 작업이 `(news_id, metric_key)` 기준으로 값을 덮어쓴다.

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

주의:

- `getUnextractedNewsIds()`는 `news_fulltext` row가 없는 뉴스만 대상으로 삼는다. 한 번 `failed` 또는 `skipped` row가 생기면 자동 재시도 대상에서 빠질 수 있다.
- 프론트는 일반 full text와 FMP PR fulltext에 서로 다른 UI 기본값을 둘 수 있지만, 백엔드 `POST /api/news/fulltext/update`는 최종적으로 요청 body의 `[][][]concurrency[][][]` 숫자 하나만 받아 동일 worker pool 경로로 처리한다.

#### `news_sentiment_snapshots`

컬럼:

- `[][][]id[][][]`
- `[][][]ticker[][][]`
- `[][][]asof_date[][][]`
- `[][][]buzz_articles_in_last_week[][][]`
- `[][][]buzz_weekly_average[][][]`
- `[][][]buzz[][][]`
- `[][][]company_news_score[][][]`
- `[][][]sector_avg_bullish_pct[][][]`
- `[][][]sector_avg_news_score[][][]`
- `[][][]sentiment_bullish_pct[][][]`
- `[][][]sentiment_bearish_pct[][][]`
- `[][][]fetched_at[][][]`

의미:

- Finnhub `news-sentiment` 결과를 ticker/date 기준으로 저장하는 symbol-level snapshot이다.

#### `news_ai_analysis`

컬럼:

- `[][][]news_id[][][]`
- `[][][]score[][][]`
- `[][][]score_evidence[][][]`
- `[][][]keywords_json[][][]`
- `[][][]analysis_status[][][]`
- `[][][]analyzed_at[][][]`
- `[][][]created_at[][][]`

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

제약: `UNIQUE (event_type, unique_key)`

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
- `[][][]float_shares[][][]`
- `[][][]float_pct[][][]`
- `[][][]outstanding_shares[][][]`
- `[][][]institutional_pct[][][]`
- `[][][]market_cap_source[][][]`
- `[][][]float_source[][][]`
- `[][][]institutional_source[][][]`

주의:

- `company_profiles`는 현재 `fmp`, `finnhub`, `yahoo` source row가 공존할 수 있다.
- ticker 심볼은 이 테이블 컬럼이 아니므로, raw SQL에서는 `securities`와 JOIN해서 읽는다.
- `GET /api/news`, `GET /api/tickers`는 내부에서 대표 row를 골라 `companyDescription`, `peers`, `ipoDate`, `marketCap` 형태로 재노출한다.
- `GET /api/tickers`의 default-universe row는 추가로 `[][][]floatPct[][][]`, `[][][]institutionalPct[][][]`, `[][][]marketCapSource[][][]`, `[][][]floatSource[][][]`, `[][][]institutionalSource[][][]`를 함께 재노출한다.

#### `securities`

컬럼:

- `[][][]id[][][]`
- `[][][]ticker[][][]`
- `[][][]exchange[][][]`
- `[][][]name[][][]`
- `[][][]sector[][][]`
- `[][][]industry[][][]`
- `[][][]created_at[][][]`

#### `ticker_universes`

컬럼:

- `[][][]id[][][]`
- `[][][]name[][][]`
- `[][][]description[][][]`
- `[][][]source_path[][][]`
- `[][][]created_at[][][]`

#### `ticker_universe_items`

컬럼:

- `[][][]universe_id[][][]`
- `[][][]security_id[][][]`
- `[][][]sort_order[][][]`
- `[][][]created_at[][][]`

#### `bookmark_folders`

컬럼:

- `[][][]id[][][]`
- `[][][]user_id[][][]`
- `[][][]name[][][]`
- `[][][]parent_id[][][]`
- `[][][]sort_order[][][]`
- `[][][]created_at[][][]`

#### `bookmark_items`

컬럼:

- `[][][]folder_id[][][]`
- `[][][]news_id[][][]`
- `[][][]created_at[][][]`

#### `confirmed_empty_ranges`

컬럼:

- `[][][]ticker[][][]`
- `[][][]source_type[][][]`
- `[][][]range_from[][][]`
- `[][][]range_to[][][]`
- `[][][]confirmed_at[][][]`

#### `sec_filings`

SEC filing companion table.

- `news_items`에 저장된 SEC filing의 추가 메타데이터를 저장하는 companion table이다.
- 과거 `Finnhub SEC filing` 데이터는 startup purge가 `source='FINNHUB' AND source_type='sec_filing'` parent row를 삭제하며 함께 정리된다.
- 2026-03-21 리비전부터 `FMP SEC filing` (`source='FMP'`, `source_type='fmp_sec_filing'`) ingestion path가 추가됐으며, 같은 테이블에 companion row를 저장한다.
- 2026-03-23 리비전부터는 parent `news_items.body`에 SEC 원문 기반 deterministic summary를 저장하고, 추출 실패 시 metadata fallback을 유지한다.

컬럼:

- `[][][]id[][][]` — INTEGER PRIMARY KEY AUTOINCREMENT
- `[][][]news_id[][][]` — `news_items.id` FK (SEC filing parent row)
- `[][][]accession_number[][][]` — UNIQUE dedup key (SEC EDGAR accession number)
- `[][][]cik[][][]` — SEC Central Index Key
- `[][][]form_type[][][]` — filing 유형 (예: `4`, `8-K`, `10-K`, `10-Q`, `DEF 14A`, `144`)
- `[][][]filed_at[][][]` — filing 기준일 (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss)
- `[][][]accepted_at[][][]` — SEC 접수 시각
- `[][][]report_url[][][]` — SEC 원문 XML/HTML 문서 URL
- `[][][]filing_url[][][]` — SEC filing index 페이지 URL
- `[][][]raw_json[][][]` — Finnhub 원본 응답 JSON
- `[][][]created_at[][][]`

인덱스: `accession_number` UNIQUE, `news_id`, `form_type + filed_at DESC`, `filed_at DESC`

#### 기타 테이블

- `news_saved_views`
- `watchlists`
- `watchlist_items`
- `alert_rules`
- `users`
- `update_status`

### OHLC DB

경로: `OHLC_data/ohlc_1d_watchlist.sqlite`

대표 테이블:

- `[][][]ohlc_1d[][][]`
  - 기본 컬럼: `Symbol`, `Datetime`, `Open`, `High`, `Low`, `Close`, `Volume`

## API 그룹

### 공통/상태

- `GET /healthz`
- `GET /api/config`
- `GET /api/updates/status`
- `GET /api/jobs/active`
- `GET /api/jobs/:jobId`
- `POST /api/jobs/:jobId/cancel`

### ticker / universe / security

- `GET /api/tickers`
- `POST /api/tickers/import-default`
- `POST /api/tickers/add`
- `DELETE /api/tickers/remove`
- `GET /api/securities`
- `GET /api/securities/search`
- `GET /api/universes`
- `GET /api/universes/:id/items`

### 뉴스 조회 / 스트림

- `GET /api/news`
- `GET /api/news/:id`
- `GET /api/news/stream`
- `GET /api/news/fulltext/:newsId`
- `GET /api/news/fulltext/stats`
- `GET /api/news/ai-analysis/validate`

### 뉴스 적재 / 후처리

- `GET /api/news/pull-finhub/preflight`
- `POST /api/news/pull-finhub`
- `POST /api/news/pull-eodhd`
- `POST /api/news/pull-fmp-press-release`
- `POST /api/news/pull-fmp-sec-filing`
- `POST /api/news/fulltext/update`
- `POST /api/news/fulltext/backfill-plaintext`
- `POST /api/news/fulltext/reset-failed`
- `POST /api/news/change/update-recent`
- `POST /api/news/change/update-custom`
- `POST /api/news/sentiment/update`

### 저장 뷰 / watchlist / alerts / bookmarks

- `POST /api/news/saved-views`
- `GET /api/news/saved-views`
- `DELETE /api/news/saved-views/:id`
- `GET /api/watchlists`
- `POST /api/watchlists`
- `DELETE /api/watchlists/:id`
- `GET /api/settings/alerts`
- `POST /api/settings/alerts`
- `GET /api/bookmarks/folders`
- `POST /api/bookmarks/folders`
- `PUT /api/bookmarks/folders/:id`
- `DELETE /api/bookmarks/folders/:id`
- `POST /api/bookmarks/items`
- `DELETE /api/bookmarks/items`
- `GET /api/bookmarks/folders/:folderId/items`
- `PATCH /api/bookmarks/items/move`

### calendar / OHLC / company profile / inspect

- `GET /api/calendar/types`
- `GET /api/calendar/events`
- `GET /api/calendar/events/export.csv`
- `GET /api/calendar/events/:id`
- `POST /api/ibkr/calendar/update`
- `POST /api/ibkr/calendar/update-custom`
- `GET /api/ibkr/ohlc1d/status`
- `POST /api/ibkr/ohlc1d/update`
- `GET /api/company-profiles/:ticker`
- `POST /api/company-profiles/pull-fmp`
- `POST /api/company-profiles/pull-yahoo`
- `POST /api/company-profiles/pull-peers`
- `POST /api/company-profiles/pull-market-cap`
- `POST /api/company-profiles/pull-ipo-date`
- `GET /api/db/inspect`

## 핵심 API 상세

### `GET /api/news`

지원 query:

- `keyword`
- `tickers=TSLA,NVDA`
- `sources=company_news,press_release`
- `source_type=company_news,press_release`
- `source_names=FINNHUB,EODHD`
- `tags=earnings,macro`
- `from`
- `to`
- `limit`
- `cursor`
- `bookmarkFolderId`

응답 item 출력 컬럼:

- `[][][]id[][][]`
- `[][][]published_at[][][]`
- `[][][]source[][][]`
- `[][][]publisher[][][]`
- `[][][]origin_url[][][]`
- `[][][]source_type[][][]`
- `[][][]title[][][]`
- `[][][]body[][][]`
- `[][][]url[][][]`
- `[][][]tickers[][][]`
- `[][][]tags[][][]`
- `[][][]created_at[][][]`
- `[][][]ohlc_ticker[][][]`
- `[][][]ohlc_date[][][]`
- `[][][]change_pct_ohlc_date[][][]`
- `[][][]change_1d_target_date[][][]`
- `[][][]change_pct[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_open_to_high_pct[][][]`
- `[][][]change_3d_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`
- `[][][]change_computed_at[][][]`
- `[][][]hasFullText[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`
- `[][][]industry[][][]`
- `[][][]marketCap[][][]`
- `[][][]score[][][]`
- `[][][]scoreEvidence[][][]`
- `[][][]analysisStatus[][][]`
- `[][][]sentimentBullishPct[][][]`
- `[][][]sentimentBearishPct[][][]`
- `[][][]companyNewsScore[][][]`
- `[][][]peers[][][]`
- `[][][]companyDescription[][][]`
- `[][][]ipoDate[][][]`

추가 규칙:

- `keywords`는 AI analysis가 완료된 경우 `news_ai_analysis.keywords_json`을 우선 사용한다.
- sentiment 3개 필드는 대표 ticker의 최신 snapshot 기준이다.
- peers/companyDescription/ipoDate/marketCap도 대표 ticker 기준 최근 company profile row를 사용한다.
- `industry`는 `company_profiles` 컬럼이 아니라 `securities.industry` 또는 CSV fallback에서 온다.

### `GET /api/news/stream`

- `GET /api/news`와 같은 query parser 사용
- 20초 heartbeat
- 새 뉴스 insert 시 filter를 만족하는 클라이언트에만 push

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

설명:

- `mode`: `7d | recent | custom`
- `sourceType`: `all | company_news | press_release | market_news`
- `custom`일 때만 `from/to` 사용
- 즉시 `jobId`를 반환하고 background에서 적재한다.

응답 컬럼:

- `[][][]jobId[][][]`

### `GET /api/news/pull-finhub/preflight`

응답 컬럼:

- `[][][]totalTickers[][][]`
- `[][][]fallbackCount[][][]`
- `[][][]fallbackTickers[][][]`

### `POST /api/news/pull-eodhd`

날짜 단일 모드 또는 날짜 범위 모드 중 하나만 허용한다.

응답 컬럼:

- `[][][]symbol[][][]`
- `[][][]from[][][]`
- `[][][]to[][][]`
- `[][][]offset[][][]`
- `[][][]nextOffset[][][]`
- `[][][]done[][][]`
- `[][][]fetched[][][]`
- `[][][]inserted[][][]`
- `[][][]truncated[][][]`

### `POST /api/news/pull-fmp-press-release`

FMP press release를 수집한다.

요청 body:

```json
{
  "mode": "recent",
  "from": "2026-03-01",
  "to": "2026-03-20",
  "tickerConcurrency": 10,
  "requestIntervalMs": 25,
  "pageLimit": 100,
  "maxPages": 12
}
```

- `mode`: `recent | custom`
- `recent`: DB의 마지막 `fmp_press_release` anchor 이후부터 수집
- `custom`: `from/to` 범위로 수집
- `tickerConcurrency`: ticker worker 수 (기본 10)
- `requestIntervalMs`: FMP API 호출 간격 (기본 25ms)
- `pageLimit`: page당 최대 row 수 (기본 100)
- `maxPages`: ticker당 최대 page 수 (기본 12)
- job key: `fmp_press_release`
- 동작: 새 `news_items` row를 insert한 뒤, 같은 job 안에서 원문 URL을 다시 추출해 `news_fulltext.full_text`도 함께 채운다.
- 중요한 점: full text 추출은 기존 `extractByDomain` 경로를 재사용하므로, publisher scraper가 없는 경우에는 body fallback 또는 `unavailable/failed` status가 저장될 수 있다.

응답 컬럼:

- `[][][]jobId[][][]`

### `POST /api/news/pull-fmp-sec-filing`

FMP SEC filing을 수집한다. primary endpoint는 `stable/sec-filings-search/symbol`이다.

요청 body:

```json
{
  "mode": "recent",
  "from": "2026-03-01",
  "to": "2026-03-20",
  "tickerConcurrency": 10,
  "requestIntervalMs": 25,
  "maxPages": 40
}
```

- `mode`: `recent | custom`
- `recent`: DB의 마지막 `fmp_sec_filing` published_at 이후(없으면 7일 전)부터 수집
- `custom`: `from/to` 범위로 수집
- `tickerConcurrency`: ticker worker 수 (기본 10)
- `requestIntervalMs`: FMP API 호출 간격 (기본 25ms)
- `maxPages`: 최대 페이지 수 (기본 40)
- job key: `fmp_sec_filing`
- 동작: default universe ticker를 worker pool로 병렬 처리하면서 symbol search를 호출하고, accession number로 dedupe 한 뒤 `sec_filings` companion 테이블에도 저장한다. insert 직후 `finalLink` 우선, `link` 보조로 SEC 문서를 읽어 summary를 만들고 `news_items.body`를 갱신한다.
- 저장 규칙: `source='FMP'`, `source_type='fmp_sec_filing'`, `publisher='SEC/EDGAR'`, `url=finalLink`, `published_at=acceptedDate`, `body=SEC summary 또는 metadata fallback`

Control Window / localStorage 공통 설정:

- `fmp-concurrency`: FMP 공통 ticker concurrency
- `fmp-request-interval-ms`: FMP 공통 request interval
- `fmp-pr-page-limit`: FMP PR page limit
- `fmp-pr-max-pages`: FMP PR max pages
- `fmp-sec-max-pages`: FMP SEC max pages

응답 컬럼:

- `[][][]jobId[][][]`

### `POST /api/news/fulltext/update`

응답 컬럼:

- `[][][]jobId[][][]`
- `[][][]total[][][]`

### `GET /api/news/fulltext/:newsId`

응답 컬럼:

- `[][][]newsId[][][]`
- `[][][]fullText[][][]`
- `[][][]extractionStatus[][][]`
- `[][][]extractionNote[][][]`
- `[][][]wordCount[][][]`
- `[][][]extractedAt[][][]`
- `[][][]keywords[][][]`
- `[][][]keywordsStatus[][][]`

### `POST /api/news/change/update-recent`

- 요청 body: `{ "fmpConcurrency": 5, "fmpRequestIntervalMs": 250 }` (둘 다 선택)
- 하위 호환용으로 `{ "ibkrConcurrency": 30 }`도 잠시 허용하지만, 현재 의미는 IBKR가 아니라 FMP fallback 동시성 alias다.
- 최근 7일 뉴스 change % 재계산.
- Phase 1: OHLC DB에서 데이터 읽기 → 있으면 바로 계산
- Phase 1.5 (FMP fallback): OHLC DB에 없는 티커는 FMP 일봉 OHLC를 가져와 DB에 upsert → 재계산
- Phase 2: 계산 결과 일괄 저장
- 당일 뉴스는 **ET 시장일** 기준으로 판정하며, ET `16:00:00` 이전에는 `[][][]change_pct[][][]`, `[][][]change_from_open_pct[][][]`, `[][][]change_open_to_high_pct[][][]`를 비워 둔다.
- 재계산 결과 조건을 만족하지 못한 뉴스는 기존 `news_change_metrics` 표준 8개 metric도 삭제하여 stale 값을 남기지 않는다.
- 응답 컬럼: `[][][]jobId[][][]`

### `POST /api/news/change/update-custom`

- 요청 body: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "fmpConcurrency": 5, "fmpRequestIntervalMs": 250 }`
- 선택한 날짜 범위 뉴스 change % 재계산.
- Phase 1: OHLC DB → Phase 1.5: FMP fallback → Phase 2: 저장 (위와 동일)
- 응답 컬럼: `[][][]jobId[][][]`

### `GET /api/calendar/events`

지원 query:

- `type`
- `tickers`
- `watchlist_id`
- `from`
- `to`
- `time_of_day`
- `region`
- `sort`
- `cursor`
- `limit`

### `POST /api/ibkr/calendar/update`

- 요청 body의 `mode`는 `backfill | refresh`

응답 컬럼:

- `[][][]mode[][][]`
- `[][][]dateRange[][][]`
- `[][][]upserted[][][]`
- `[][][]deletedMockRows[][][]`
- `[][][]source[][][]`

### `GET /api/ibkr/ohlc1d/status`

응답 컬럼:

- `[][][]dbPath[][][]`
- `[][][]overallMaxDate[][][]`
- `[][][]lastSuccessAt[][][]`

### `POST /api/ibkr/ohlc1d/update`

- 기본 CSV 또는 body의 `csvPath`에서 ticker를 읽는다.
- 응답 컬럼: `[][][]jobId[][][]`

### `POST /api/company-profiles/pull-fmp`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `concurrency` (기본=5), `requestIntervalMs` (기본=250ms), `skipExisting` (기본=true)

### `POST /api/company-profiles/pull-yahoo`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `concurrency` (기본=5), `requestIntervalMs` (기본=200ms), `skipExisting` (기본=true)

### `POST /api/company-profiles/pull-peers`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `tickerConcurrency` (기본=1), `skipExisting` (기본=true)

### `POST /api/company-profiles/pull-market-cap`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `[][][]tickers[][][]`, `[][][]maxTickers[][][]`, `[][][]tickerConcurrency[][][]` (기본=1)

### `POST /api/company-profiles/pull-float`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `[][][]tickers[][][]`, `[][][]maxTickers[][][]`

### `POST /api/company-profiles/pull-institutional`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `[][][]tickers[][][]`, `[][][]maxTickers[][][]`, `[][][]tickerConcurrency[][][]` (기본=1)

### `POST /api/company-profiles/pull-ipo-date`

응답 컬럼:

- `[][][]jobId[][][]`

요청 body 옵션: `tickerConcurrency` (기본=1), `skipExisting` (기본=true)

### `GET /api/db/inspect`

테이블 객체 출력 컬럼:

- `[][][]name[][][]`
- `[][][]columns[][][]`
- `[][][]foreignKeys[][][]`
- `[][][]rowCount[][][]`
- `[][][]sampleRows[][][]`
- `[][][]uiUsage[][][]`
- `[][][]resources[][][]`

## 현재 프런트와의 연결 포인트

- `NewsWindow`는 `GET /api/news`와 `POST /api/news/pull-eodhd`를 사용한다.
- `FinnhubNewsWindow`는 뉴스 조회, Finnhub 적재, fulltext, change update, bookmarks, job polling을 사용한다.
- `DefaultTickerWindow`는 `GET /api/tickers`, `POST /api/tickers/import-default`, `POST /api/tickers/add`, `DELETE /api/tickers/remove`, `POST /api/company-profiles/pull-market-cap`, `POST /api/company-profiles/pull-float`, `POST /api/company-profiles/pull-institutional`, `GET /api/jobs/:jobId`를 사용한다.
- `DataControlWindow`는 updates status, jobs, OHLC status/update, IBKR calendar update/update-custom, company profile pull, change update, DB inspect를 사용한다.
- `CaseResearchWindow`는 `/api/research/*` 전체를 사용해 섹션/페이지 CRUD, reorder, 검색, 자동 저장을 수행한다.
- 현재 `WatchlistWindow`, `CalendarWindow`는 백엔드 API를 직접 사용하지 않는다.

## Case Research API

연구 노트 데이터는 `app.db`의 `research_tabs`, `research_pages` 두 테이블에 저장된다.

현재 endpoint:

- `GET /api/research/tabs`
- `POST /api/research/tabs`
- `PATCH /api/research/tabs/:id`
- `DELETE /api/research/tabs/:id`
- `POST /api/research/tabs/:id/restore`
- `GET /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages`
- `POST /api/research/tabs/:tabId/pages/reorder`
- `GET /api/research/pages/:id`
- `PATCH /api/research/pages/:id`
- `DELETE /api/research/pages/:id`
- `POST /api/research/pages/:id/restore`
- `GET /api/research/search?q=...`
- `GET /api/research/trash`

동작 규칙:

- 모든 endpoint는 현재 고정 `DEMO_USER_ID` 범위에서 동작한다.
- 페이지 제목/본문 수정은 일반 form submit이 아니라 프론트의 debounce autosave 호출을 전제로 한다.
- `POST /api/research/tabs/:tabId/pages/reorder`는 정렬된 `pageIds` 배열을 받아 `sort_order`를 재기록한다.
- `GET /api/research/search`는 제목과 본문을 함께 검색하고 `tab_name`을 포함한 결과를 반환한다.
- `DELETE /api/research/tabs/:id`, `DELETE /api/research/pages/:id`는 즉시 hard delete 하지 않고 `deleted_at`을 기록하는 soft delete다.
- soft delete된 tab/page는 일반 조회와 검색에서 즉시 숨겨지며, 다음 research API 접근 시 `deleted_at <= now - 24h` 인 row만 완전 삭제된다.
- tab soft delete 시 그 아래 page도 같은 시각으로 함께 soft delete된다.
- `GET /api/research/trash`는 아직 24시간이 지나지 않은 deleted tab/page 목록을 반환한다.
- `POST /api/research/tabs/:id/restore`는 deleted tab과 그 하위 deleted page를 함께 복구한다.
- `POST /api/research/pages/:id/restore`는 부모 tab이 살아 있을 때만 page를 복구한다. 부모 tab도 deleted 상태면 409를 반환한다.

## 제약과 주의사항

- Finnhub key가 없으면 서버 전체가 시작되지 않는다.
- FMP key가 없으면 FMP 회사 설명 pull만 제한된다.
- `news_change_metrics`는 영구 보존 테이블이며, 업데이트 시 UPSERT 된다.
- background job 상태는 메모리 기반이라 재시작 시 유실된다.
- fulltext 자동 재시도 기준은 `news_fulltext` row 존재 여부다.
- default ticker source는 startup import 이후 DB-primary + CSV backup sync 구조다. 기본 경로를 바꾸면 front/backend 기본값과 startup import 기준을 함께 맞춰야 한다.

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
- `[][][]change_pct_ohlc_date[][][]`, `[][][]change_1d_target_date[][][]`는 `news_items` 물리 컬럼이 아니라 joined metric alias 응답 필드다.
- 오래된 DB에는 `[][][]change_pct[][][]`, `[][][]change_open_to_high_pct[][][]`, `[][][]change_3d_pct[][][]`가 남아 있을 수 있지만, 현재 초기화 코드가 직접 보장하는 핵심 컬럼은 위 목록 기준이다.

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

- `[][][]change_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_open_to_high_pct[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_3d_pct[][][]`
- `[][][]change_7d_pct[][][]`
- `[][][]change_14d_pct[][][]`
- `[][][]change_30d_pct[][][]`

운영적 정의:

- `change_pct`: 전일 종가 → 뉴스 기준일 종가 (Chg)
- `change_from_open_pct`: 뉴스 기준일 시가 → 뉴스 기준일 종가
- `change_open_to_high_pct`: 뉴스 기준일 시가 → 뉴스 기준일 고가
- `change_1d_pct`: 전일 종가 → 1거래일 후 종가
- `change_3d_pct`: 전일 종가 → 3거래일 후 종가
- `change_7d_pct`: 전일 종가 → 5거래일 후 종가
- `change_14d_pct`: 전일 종가 → 10거래일 후 종가
- `change_30d_pct`: 전일 종가 → 22거래일 후 종가

주의:

- 코드 주석에는 “30d = 22 trading days”라고 되어 있다.
- 테이블은 startup 때 drop/recreate 하지 않는다. 동일 `(news_id, metric_key)` row를 UPSERT 하며 누적 유지한다.

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
      "change_pct_ohlc_date": "2026-03-07",
      "change_1d_target_date": "2026-03-10",
      "change_pct": -0.85,
      "change_1d_pct": 1.23,
      "change_from_open_pct": -0.42,
      "change_open_to_high_pct": 0.55,
      "change_3d_pct": 2.01,
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
- `[][][]change_pct[][][]`
- `[][][]change_1d_pct[][][]`
- `[][][]change_from_open_pct[][][]`
- `[][][]change_open_to_high_pct[][][]`
- `[][][]change_3d_pct[][][]`
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

ipoDate 규칙:

- `ipoDate`는 `company_profiles.ipo_date`에서 가져온다. 뉴스 row의 대표 ticker(tickers 배열의 첫 번째)를 기준으로 최신 non-null 값을 lookup한다.
- 해당 ticker에 IPO date가 없으면 `null`이다.
- Finnhub `pull-ipo-date` 또는 FMP company profile pull을 하지 않은 ticker는 `null`일 수 있다.

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
7. 마지막에 신규 뉴스에 대해 `mergeChangeForNewItems()`를 돌린다 (기존 OHLC DB에서만 계산, OHLC 없는 티커는 skip).
8. `update_status.finhub_news`를 갱신한다.

현재 job/중복 규칙:

- backend는 `activePullJobs`를 사용해 `sourceType` 단위 중복 실행을 막는다.
- 같은 logical pull을 다시 호출하면 `409`와 함께 `[][][]existingJobId[][][]`를 반환한다.
- 예: `sourceType='press_release'` Finnhub pull이 running일 때 같은 sourceType으로 다시 호출하면 새 job을 만들지 않는다.
- 반면 다른 sourceType Finnhub pull, RTPR pull, fulltext job, change job 자체는 job manager 차원에서 동시에 존재할 수 있다.
- 즉 backend 기준으로는 "같은 pull key는 차단, 다른 job은 병렬 가능"이 현재 규칙이다.

응답:

```json
{ "jobId": "..." }
```

duplicate 응답 예시:

```json
{
  "error": "A pull job for sourceType='press_release' is already running (jobId=...). Wait for it to finish or cancel it first.",
  "existingJobId": "..."
}
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
- `fmp_press_release`: `news_fulltext` row가 없는 FMP PR 뉴스만 대상이다. 기존 잘못된 fallback success row는 reset endpoint로 먼저 삭제한 뒤 다시 update 해야 한다.
- `fmp_sec_filing`: 기본 미추출 row + metadata fallback body를 가진 SEC filing row를 포함할 수 있으며, 성공 시 `news_fulltext.full_text`와 `news_items.body` summary를 함께 갱신한다.

사전 동작:

- `backfillPublisher()`를 먼저 실행해 publisher 없는 기존 row를 보정한다.

응답:

```json
{ "jobId": "...", "total": 123 }
```

### `POST /api/news/fulltext/reset-fmp-pr-fallback`

- 목적: 예전에 잘못 저장된 FMP PR fallback success row를 삭제해서 regular missing-only update로 다시 채울 수 있게 만든다.
- 현재 삭제 대상:
  - `source_type='fmp_press_release'`
  - publisher가 `GlobeNewswire`, `Globe News Wire`, `PRNewsWire`, `Business Wire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`
  - 그리고 `extraction_note LIKE 'body-fallback (no-scraper:%'` 또는 `full_text == body`
- `RTPR` 같은 다른 source의 기사 body를 FMP PR fulltext에 재사용하지 않는다.
- 현재 extractor는 `GlobeNewswire`, `PRNewswire`, `Newsfile Corp`, `Accesswire`, `MCAP MediaWire`를 server-side scrape로 처리하고, `Business Wire`는 브라우저 기반 fallback으로 직접 본문 추출을 시도한다.
- 응답 컬럼:
  - `[][][]deleted[][][]`

현재 job/중복 규칙:

- fulltext update는 background job으로 실행되고 `jobId`를 반환한다.
- 하지만 현재 backend에는 `pull-finhub`/`pull-rtpr`처럼 endpoint 전용 duplicate guard가 없다.
- 따라서 API만 보면 같은 fulltext 계열 job을 연속 호출해 여러 job을 만들 수 있다.
- 다만 현재 프론트 `FinnhubNewsWindow`는 fulltext 메뉴에만 `updating || ftUpdating` lock을 적용한다.
- 일반 update 메뉴는 `updating`만 보므로, backend contract 기준으로는 fulltext job과 일반 pull/change job이 동시에 존재할 수 있다.
- 즉 fulltext와 다른 update 간 병렬 가능 여부는 backend보다 프론트 버튼 disable/handler guard 조합의 영향을 더 크게 받는다.
- 이 제약은 frontend UX 제약이지 backend contract 보장은 아니다.

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

요청 body:

```json
{ "fmpConcurrency": 5, "fmpRequestIntervalMs": 250 }
```

- 최근 7일 뉴스 전체에 대해 표준 metric 재계산
- OHLC DB에 데이터 없는 티커는 FMP 일봉 OHLC를 fetch 후 계산 (Phase 1.5)
- 뉴스 시각은 source별 원본 포맷과 무관하게 ET 시장일로 해석한다. timezone-aware timestamp는 ET로 변환하고, RTPR처럼 ET-naive timestamp는 이미 ET로 간주한다.
- 현재 ET 시장일과 같은 뉴스는 ET `16:00:00` 이전이면 same-day change metric을 저장하지 않는다.
- 이번 재계산에서 metric을 다시 계산하지 못한 뉴스는 기존 표준 metric도 함께 삭제한다.
- ET `16:00:00` 이전에는 canonical OHLC DB(`OHLC_data/ohlc_1d_watchlist.sqlite`)에도 당일 일봉을 upsert하지 않는다. 따라서 전일 기사의 `[][][]change_1d_pct[][][]`도 장중에는 오늘 bar를 참조하지 않는다.
- 즉시 `jobId` 반환
- 완료 시 `update_status.news_change_recent` 갱신

현재 job/중복 규칙:

- change update는 background job으로 실행되지만, 현재 endpoint 레벨 duplicate guard는 없다.
- 즉 backend contract만 보면 recent/custom change job을 연속 호출해 복수 running job을 만들 수 있다.
- 현재 프론트는 전역 `updating` lock 때문에 사용자가 보통 동시에 두 change job을 시작하지 못한다.

### `POST /api/news/change/update-custom`

요청 body:

```json
{ "from": "2026-03-01", "to": "2026-03-06", "fmpConcurrency": 5, "fmpRequestIntervalMs": 250 }
```

- 지정 기간 뉴스 전체에 대해 표준 metric 재계산
- OHLC DB에 데이터 없는 티커는 FMP 일봉 OHLC를 fetch 후 계산 (Phase 1.5)
- 즉시 `jobId` 반환
- 완료 시 `update_status.news_change_custom` 갱신

현재 job/중복 규칙:

- `update-recent`와 동일하게 background job이지만 duplicate guard는 없다.
- 향후 프론트 전역 lock을 해체할 경우 backend 측 logical job key 표준화가 필요하다.

## Job API

### `GET /api/jobs/active`

현재 running 상태인 job 목록만 반환한다.

응답 출력 컬럼:

- `[][][]id[][][]`
- `[][][]status[][][]`
- `[][][]progress[][][]`
  - `[][][]completed[][][]`
  - `[][][]total[][][]`
  - `[][][]pct[][][]`
- `[][][]createdAt[][][]`
- `[][][]updatedAt[][][]`

현재 동작 규칙:

- `status='running'`인 job만 포함한다.
- 완료(`done`), 실패(`failed`), 취소(`cancelled`)된 job은 이 목록에서 빠진다.
- 따라서 프론트가 `activeJobs` dropdown으로 선택할 수 있는 것은 현재 시점 running job뿐이다.
- job manager 자체는 여러 running job을 동시에 저장할 수 있다.

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
- `status=running` 동안 `[][][]progress.pct[][][]`는 최대 99까지만 올라간다. `100`은 `completeJob()`으로 최종 완료 처리된 뒤에만 노출된다.
- 현재 프론트 `FinnhubNewsWindow`는 `GET /api/jobs/active` 결과가 2개 이상일 때 선택 dropdown을 띄워 여러 running job 중 하나를 수동으로 볼 수 있다.
- 단, 프론트 update 버튼 대부분은 전역 `updating` lock으로 묶여 있어 실제 사용자가 여러 job을 쉽게 동시에 만들지는 못한다.

## Ticker CSV API

### `GET /api/tickers`

query:

- `csvPath` 필수

응답:

```json
{
  "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv",
  "source": "db",
  "tickers": ["AAPL", "MSFT"],
  "rows": [
    {
      "ticker": "AAPL",
      "exchange": "NASDAQ",
      "name": "Apple Inc.",
      "sector": "Technology",
      "industry": "Consumer Electronics",
      "ipoDate": "1980-12-12",
      "marketCap": 3560000000000,
      "floatPct": 99.77,
      "institutionalPct": 50.78,
      "marketCapSource": "fmp",
      "floatSource": "fmp",
      "institutionalSource": "finnhub"
    }
  ]
}
```

운영적 정의:

1. 기본 CSV path일 때는 `ticker_universes/default` + `ticker_universe_items` + `securities` + 최신 `company_profiles`를 조회해 canonical default universe를 반환한다.
2. `rows`의 각 원소는 `[][][]ticker[][][]`, `[][][]exchange[][][]`, `[][][]name[][][]`, `[][][]sector[][][]`, `[][][]industry[][][]`, `[][][]ipoDate[][][]`, `[][][]marketCap[][][]`, `[][][]floatPct[][][]`, `[][][]institutionalPct[][][]`, `[][][]marketCapSource[][][]`, `[][][]floatSource[][][]`, `[][][]institutionalSource[][][]`를 포함한다.
3. source 필드는 값의 출처를 나타낸다.
  - `[][][]marketCapSource[][][]`: 현재 구현 기준 `fmp`
  - `[][][]floatSource[][][]`: 현재 구현 기준 `fmp`
  - `[][][]institutionalSource[][][]`: 현재 구현 기준 `finnhub`
4. 다른 CSV path일 때는 CSV를 직접 읽어 `rows`를 만든다. 이 경우 `marketCap`, `ipoDate`, `floatPct`, `institutionalPct`, 각 `*Source`는 CSV 자체에는 없으므로 보통 `null`이다.
5. market cap / float / institutional update route는 최근 24시간 이내 값이 있으면 해당 ticker를 자동 skip한다. skip되지 않은 경우에는 같은 `security_id + source` row를 update해 기존 값을 덮어쓴다.
6. `tickers`는 legacy 호환용 단순 배열이고, 신규 UI는 `rows`를 우선 사용한다.

### `POST /api/tickers/import-default`

요청 body:

```json
{ "csvPath": "tradigview_screener/original_data/watch lists2_2026-03-10_1a43e.csv" }
```

동작:

1. 지정 CSV를 읽는다.
2. 각 ticker를 `securities`에 upsert한다.
3. `ticker_universes/default`에 없는 ticker만 추가한다.
4. 기존 default ticker는 유지하고, 중복 ticker는 skip한다.
5. best-effort로 legacy default CSV backup에도 ticker를 append sync한다.
6. 응답은 merge 후 canonical default universe 전체 ticker 목록과 `rows`를 돌려준다.

응답:

```json
{
  "csvPath": "tradigview_screener/original_data/watch lists2_2026-02-22.csv",
  "importedFrom": "C:/github_coding/terminal_sec/tradigview_screener/original_data/watch lists2_2026-03-10_1a43e.csv",
  "rowsRead": 1200,
  "tickersAdded": 57,
  "tickersSkipped": 1143,
  "tickers": ["AAPL", "MSFT"]
}
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

현재 구현 상태:

- 이 endpoint는 background job이 아니라 즉시 처리형이다.
- 따라서 `jobId`를 반환하지 않고 `GET /api/jobs/:jobId` / `GET /api/jobs/active` 기반 View Log 대상이 아니다.
- 현재 프론트 문서의 update/log 체계와 완전히 맞물리지 않는 남은 예외가 calendar update다.

응답 (현재 stub 에러):

```json
{ "error": "IBKR 캘린더 미구현 (mode=backfill, range=2024-03-08~2026-09-03): TWS 실행 상태 + Python bridge 스크립트가 필요합니다 (Step 6-3)." }
```

UI 위치:
- Data Control → Updates → Calendar Update 그룹: `Initial Calendar Backfill` / `Refresh Upcoming Calendar` 버튼
- News Feed → update 드롭다운 → Calendar Update 섹션: 동일한 두 버튼

### `POST /api/ibkr/calendar/update-custom`

현재 구현은 synchronous response다. background job이 아니다.

요청 body:

```json
{ "from": "2026-03-01", "to": "2026-03-31" }
```

동작:

1. `from`, `to`가 `YYYY-MM-DD`인지 검증한다.
2. `getDefaultUniverseTickers()`로 default universe 종목을 읽는다.
3. `pullIbkrCalendarCustom(tickers, from, to)`를 실행한다.
4. event upsert 후 `mock_provider` row를 삭제한다.
5. `update_status.ibkr_calendar`에 `mode=custom` 결과를 기록한다.

응답 (성공 시):

```json
{ "mode": "custom", "dateRange": { "from": "2026-03-01", "to": "2026-03-31" }, "upserted": 10, "deletedMockRows": 5, "source": "IBKR" }
```

현재 구현 상태:

- `POST /api/ibkr/calendar/update`와 동일하게 synchronous response다.
- 따라서 다른 background job처럼 View Log dropdown에서 선택하는 대상이 아니다.

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
- `PUT /api/watchlists/:id`
- `DELETE /api/watchlists/:id`
- `GET /api/watchlists`는 각 watchlist에 `[][][]items[][][]` 배열을 추가로 포함할 수 있다.
  - `[][][]items[][][]` row 필드:
    - `[][][]ticker[][][]`
    - `[][][]security_id[][][]`
    - `[][][]name[][][]`
    - `[][][]industry[][][]`
    - `[][][]marketCap[][][]`
- `[][][]industry[][][]`는 `securities.industry`를 우선 사용하고, 비어 있으면 backend의 CSV 기반 `industryLookup` fallback으로 보강한다.
- `[][][]marketCap[][][]`는 해당 `security_id`의 최신 `company_profiles.market_cap` 값을 사용한다.

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

FMP(Financial Modeling Prep)에서 회사 설명을 가져와 `company_profiles`에 저장한다. 이 API는 즉시 집계 숫자를 반환하지 않고 background job을 생성한 뒤 `{ jobId }`를 반환한다.

요청 body:

```json
{
  "tickers": ["AAPL", "MSFT"],
  "maxTickers": 50,
  "concurrency": 5,
  "requestIntervalMs": 250,
  "skipExisting": true
}
```

- `tickers`를 직접 넘기면 그 목록만 사용한다.
- `tickers`를 생략하면 `ticker_universes/default` 기준으로 대상을 결정한다.
- `maxTickers`를 생략하면 `ticker_universes/default` 전체를 사용한다.
- `maxTickers`를 명시하면 그 수만큼 앞에서부터 제한한다.
- `concurrency` (기본=5, 범위 1~20): 병렬 worker 수. 모든 worker는 프로세스 전역 FMP throttle을 공유해 실제 요청 간격을 제어한다.
- `requestIntervalMs` (기본=250, 범위 0~5000): FMP 요청 사이 최소 간격(ms).
- `skipExisting` (기본=true): `true`이면 이미 FMP source로 description이 저장된 ticker를 건너뛴다. `false`이면 전체 덮어쓰기(overwrite).

응답:

```json
{ "jobId": "..." }
```

job 로그 동작:

1. route는 즉시 job을 생성한다.
2. skipExisting=true이면 `company_profiles` 테이블에서 기존 FMP 프로필이 있는 ticker를 조회해 대상에서 제외한다.
3. background worker pool이 ticker별로 FMP profile을 조회한다.
4. 각 ticker마다 `description updated`, `description missing`, `error` 로그를 job log에 append한다.
5. 진행률은 처리 ticker 수 기준으로 갱신한다.
6. 완료 후 result summary에는 `[][][]requested[][][]`, `[][][]tickersUpdated[][][]`, `[][][]tickersFailed[][][]`, `[][][]totalRowsUpserted[][][]`, `[][][]skippedExisting[][][]`, `[][][]errors[][][]`, `[][][]cancelled[][][]`가 들어간다.

### `POST /api/company-profiles/pull-yahoo`

Yahoo Finance (`yahoo-finance2` wrapper)에서 회사 설명을 가져와 `company_profiles`에 `source='yahoo'`로 저장한다. background job 기반이며 `{ jobId }`를 반환한다.

요청 body:

```json
{
  "tickers": ["AAPL", "MSFT"],
  "maxTickers": 50,
  "concurrency": 5,
  "requestIntervalMs": 200,
  "skipExisting": true
}
```

- `tickers` 생략 시 `ticker_universes/default` 기준으로 대상을 결정한다.
- `concurrency` (기본=5, 범위 1~20): 병렬 worker 수. 프로세스 전역 Yahoo throttle 공유.
- `requestIntervalMs` (기본=200, 범위 0~5000): Yahoo 요청 사이 최소 간격(ms). 비공식 API이므로 0ms는 차단 위험.
- `skipExisting` (기본=true): `true`이면 이미 Yahoo source로 description이 저장된 ticker를 건너뛴다.
- Yahoo `assetProfile` 모듈에서 `[][][]longBusinessSummary[][][]`, `[][][]sector[][][]`, `[][][]industry[][][]`, `[][][]website[][][]`를 가져온다.

응답:

```json
{ "jobId": "..." }
```

### `POST /api/company-profiles/pull-peers`

Finnhub `/stock/peers` API로 관련 종목 데이터를 수집해 `company_profiles.peers_json`에 저장한다. 이 API도 background job 기반이며 `{ jobId }`를 반환한다.

요청 body:

```json
{ "tickers": ["AAPL", "MSFT"], "maxTickers": 50 }
```

- `tickers` 생략 시 `ticker_universes/default` 기준으로 대상을 결정한다.
- `maxTickers`를 생략하면 `ticker_universes/default` 전체를 사용한다.
- `maxTickers`를 명시하면 그 수만큼 앞에서부터 제한한다.

응답:

```json
{ "jobId": "..." }
```

동작:

1. 대상 ticker 목록을 결정한다 (body에서 지정 또는 default universe).
2. job을 생성하고 즉시 `{ jobId }`를 반환한다.
3. background worker가 Finnhub `/stock/peers?symbol=X`를 호출한다. 이 경로는 IPO/market-cap 경로와 **같은 전역 company-data throttle**을 공유하며, 기본값은 `[][][]tickerConcurrency[][][]=1`이다. 별도 interval delay 없이 직렬화만 유지한다.
4. 결과를 `company_profiles`에 `source = 'finnhub'`로 upsert한다.
5. ticker별 `N peers saved` 또는 error 로그를 job log에 append한다.
6. 완료 후 result summary에는 `[][][]requested[][][]`, `[][][]tickersUpdated[][][]`, `[][][]tickersFailed[][][]`, `[][][]totalRowsUpserted[][][]`, `[][][]errors[][][]`, `[][][]cancelled[][][]`가 들어간다.

### `POST /api/company-profiles/pull-market-cap`

FMP `stable/profile` API에서 시가총액과 기본 회사 메타데이터를 가져와 `company_profiles`와 `securities`를 보강한다.

요청 body:

```json
{ "tickers": ["AAPL", "MSFT"], "maxTickers": 100, "tickerConcurrency": 1 }
```

- `tickers` 생략 시 `ticker_universes/default` 전체를 대상으로 한다.
- `[][][]tickerConcurrency[][][]`는 1~20 범위다. 기본값은 5다.
- 별도 `[][][]requestIntervalMs[][][]` body 값은 현재 사용하지 않는다.
- **Skip 로직**: 최근 24시간 내 market_cap이 이미 저장된 ticker는 자동 건너뛴다.
- **취소 지원**: `POST /api/jobs/:jobId/cancel`로 중단 가능.

응답:

```json
{ "jobId": "..." }
```

job 완료 result 예시:

```json
{ "updated": 120, "total": 125, "skippedRecent": 50, "errors": 5 }
```

동작:

1. 대상 ticker 목록을 결정한다.
2. 24시간 이내에 market_cap이 이미 있는 ticker를 DB에서 조회해 skip 목록을 만든다.
3. 남은 ticker에 대해 FMP `stable/profile?symbol=X`를 호출한다.
4. 매 반복마다 job 취소 여부를 확인하고, 취소 시 즉시 중단한다.
5. `securities`의 `name`, `exchange`, `sector`, `industry`를 best-effort로 upsert한다.
6. `company_profiles`에 `source='fmp'` row를 upsert하면서 `[][][]market_cap[][][]`와 `[][][]market_cap_source[][][]='fmp'`를 저장한다. 같은 응답의 `ipoDate`도 함께 보강할 수 있다.
7. `update_status.company_profiles_market_cap`에 최근 실행 정보와 요약을 기록하며 `details.source='fmp-profile'`를 남긴다.

### `POST /api/company-profiles/pull-float`

FMP `stable/shares-float` API에서 float 관련 데이터를 가져와 `company_profiles`에 저장한다.

요청 body:

```json
{ "tickers": ["AAPL", "RKLB"], "maxTickers": 100 }
```

- `tickers` 생략 시 `ticker_universes/default` 전체를 대상으로 한다.
- **Skip 로직**: 최근 24시간 내 `float_pct`가 이미 저장된 ticker는 자동 건너뛴다.
- 저장 필드: `[][][]float_shares[][][]`, `[][][]float_pct[][][]`, `[][][]outstanding_shares[][][]`, `[][][]float_source[][][]`, `[][][]fetched_at[][][]`
- 현재 구현 기준 `[][][]float_source[][][] = 'fmp'`다.

응답:

```json
{ "jobId": "..." }
```

job 완료 result 예시:

```json
{ "updated": 120, "total": 125, "skippedRecent": 50, "errors": 5 }
```

### `POST /api/company-profiles/pull-institutional`

Finnhub `stock/ownership` API에서 institutional ownership 퍼센트를 계산해 `company_profiles`에 저장한다.

요청 body:

```json
{ "tickers": ["AAPL", "RKLB"], "maxTickers": 100, "tickerConcurrency": 1 }
```

- `tickers` 생략 시 `ticker_universes/default` 전체를 대상으로 한다.
- `[][][]tickerConcurrency[][][]`는 1~5 범위다. 기본값은 1이다.
- **Skip 로직**: 최근 24시간 내 `institutional_pct`가 이미 저장된 ticker는 자동 건너뛴다.
- 계산에는 같은 ticker의 최신 `[][][]outstanding_shares[][][]` 값이 필요하다. 현재 route는 이 값이 비어 있으면 FMP `shares-float`로 먼저 bootstrap 한 뒤 ownership 계산을 시도한다.
- 저장 필드: `[][][]institutional_pct[][][]`, `[][][]institutional_source[][][]`, `[][][]fetched_at[][][]`
- 현재 구현 기준 `[][][]institutional_source[][][] = 'finnhub'`다.

응답:

```json
{ "jobId": "..." }
```
8. background job 로그에는 ticker별 성공/실패와 진행률이 남는다.

### `POST /api/company-profiles/pull-ipo-date`

Finnhub `/stock/profile2` API에서 IPO date와 기본 회사 메타데이터를 가져와 `company_profiles.ipo_date`를 갱신한다. 이 API도 background job 기반이며 `{ jobId }`를 반환한다.

요청 body:

```json
{ "tickers": ["AAPL", "MSFT"], "maxTickers": 100, "tickerConcurrency": 1 }
```

- `tickers` 생략 시 `ticker_universes/default` 전체를 대상으로 한다.
- `maxTickers`를 생략하면 전체 대상을 처리한다.
- `[][][]tickerConcurrency[][][]`는 1~5 범위다. 기본값은 1이다.
- 별도 `[][][]requestIntervalMs[][][]` body 값은 더 이상 사용하지 않는다.
- IPO / peers / market-cap은 같은 전역 company-data throttle을 공유하며 추가 delay 없이 직렬화된다.

동작:

1. 대상 ticker 목록을 결정한다.
2. Finnhub `/stock/profile2?symbol=X`를 호출한다. 요청은 전역 throttle을 통과하므로 동시 다른 company-data job이 있어도 최소 간격을 공유한다.
3. `securities`의 `name`, `exchange`, `industry`를 best-effort로 upsert한다.
4. `company_profiles`에 `source='finnhub'` row를 upsert하면서 `[][][]ipo_date[][][]`를 저장한다.
5. 진행률/로그/결과는 `GET /api/jobs/:jobId`로 확인한다.
6. `update_status.company_profiles_ipo_date`에 최근 실행 정보와 요약을 기록한다.

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
- full text는 기본적으로 row가 이미 생성된 뉴스에 대해 자동 재시도하지 않는다.
- FMP PR에서 과거 잘못 저장된 fallback success row를 다시 처리하려면 `POST /api/news/fulltext/reset-fmp-pr-fallback`으로 먼저 삭제한 뒤, 일반 missing-only `POST /api/news/fulltext/update`를 실행한다.
- `POST /api/ibkr/calendar/update`는 background job이 아니라 즉시 처리형이다.
- `GET /api/updates/status`의 기본 key 목록에는 `news_change_recent`, `news_change_custom`가 하드코딩되어 있지 않다. 다만 DB row가 생기면 extra key로 응답에 포함된다.
- industry는 DB source of truth가 아니라 최신 `watch lists2*.csv` 파일 기반 lazy cache다.
- job 상태는 영속 저장이 아니므로 운영 audit 용 로그 저장소로 간주하면 안 된다.
