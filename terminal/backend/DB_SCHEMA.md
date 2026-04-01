## DB Schema Summary

주 저장소는 `terminal/backend/backend/data/app.db` SQLite DB다.

### 핵심 테이블

#### `company_profiles`

- key: `UNIQUE (security_id, source)`
- 목적: 회사 설명, IPO date, market cap, float, ownership, raw payload 저장

주요 컬럼:

- `security_id`
- `source`
- `description`
- `ipo_date`
- `market_cap`
- `market_cap_source`
- `peers_json`
- `float_shares`
- `float_pct`
- `outstanding_shares`
- `float_source`
- `institutional_pct`
- `institutional_source`
- `insider_pct`
- `insider_source`
- `raw_json`
- `fetched_at`

운영 규칙:

- ticker는 이 테이블에 직접 없으므로 `securities`와 JOIN해서 읽는다.
- ticker당 source row는 여러 개일 수 있다.
- ownership(`institutional_pct`, `insider_pct`)은 대표 row 1개에 유지되도록 정리한다.
- `source='yahoo'` row가 이미 있으면 Yahoo holders 결과를 그 row에 merge한다.
- Default Ticker에서 재노출하는 `institutional_pct`는 현재 Yahoo holders 값만 사용한다. legacy Finnhub institutional 값은 UI source에서 제외한다.

#### `securities`

- key: `UNIQUE (ticker, exchange)`
- 목적: ticker 마스터 / exchange / name / sector / industry

#### `ticker_universes`, `ticker_universe_items`

- 목적: canonical default universe 및 CSV merge 결과 저장
- `ticker_universe_items.created_at`은 Default Ticker UI의 `addedAt` source다.

#### `update_status`

- key: `source_key`
- 목적: pull job 최근 성공 시각 및 details 저장
- company profile 관련 주요 key:
  - `company_profiles_market_cap`
  - `company_profiles_ipo_date`
  - `company_profiles_yahoo`
  - `company_profiles_holders_yahoo`

### 읽기 주의

- `GET /api/tickers`는 raw row를 그대로 반환하지 않고 대표값을 뽑아 `addedAt`, `marketCap`, `floatPct`, `institutionalPct`, `insiderPct`로 재구성한다.
- custom CSV path는 DB ownership/market cap 정보가 없을 수 있어 관련 필드가 `null`일 수 있다.