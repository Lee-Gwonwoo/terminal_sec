# RTPR / PTPR press release API (skill)

### 언제 쓰나
- RTPR(문서/대화에서 `PTPR`로도 부를 수 있음) press release API를 새로 연동하거나 수정할 때.
- 실시간 보도자료 feed, ticker별 press release 조회, 서버사이드 WebSocket consumer를 구현할 때.
- 이후 `terminal/backend/src/services/ptpr...` 계열 provider를 작성할 때.

### 공식 문서 / 기준 URL
- 공식 문서: `https://www.rtpr.io/docs`
- REST base URL: `https://api.rtpr.io`
- WebSocket URL: `wss://ws.rtpr.io`

### 피드 범위 결론
- RTPR 문서가 직접 설명하는 범위는 `real-time press releases from major wire services`다.
- 현재까지 확인된 REST endpoint는 `GET /articles`, `GET /articles/{ticker}`뿐이며, 둘 다 press release article feed다.
- 별도 `market news`, `general news`, `macro/newswire commentary`, `analyst/news` endpoint는 공식 문서와 현재 probe 범위에서 확인되지 않았다.
- 따라서 이 provider는 **시황/market news provider가 아니라 press release provider로 취급**한다.
- 시황성 일반 뉴스가 필요하면 Finnhub 같은 별도 news provider를 병행해야 한다.

### 인증 규칙
- **REST**: `Authorization: Bearer <API_KEY>`
- **WebSocket**: `wss://ws.rtpr.io?apiKey=<API_KEY>`
- API 키는 `ai_agent_plan/ptpr_api_key/ptpr_api_key` 같은 시크릿 파일에서 읽고, 로그/문서/예시 출력에 실제 값을 노출하지 않는다.
- 브라우저 클라이언트 코드에 직접 키를 넣지 않는다. production에서는 서버사이드에서만 연결한다.

### 제한 / 운영 규칙
- REST rate limit: **60 requests per minute**
- WebSocket: **API key당 동시 1 connection**
- 문서 기준 권장:
  - WebSocket은 연결 종료 시 즉시 재연결하지 말고 backoff를 둔다.
  - `ping` 수신 시 `pong`으로 응답해야 한다.
  - message handler 안에서 무거운 후처리를 block하지 않는다.
- 레포 공통 규칙:
  - 일시 실패는 재시도 가능하지만, 인증 오류(401), 명백한 validation 오류는 즉시 실패시킨다.
  - 네트워크/파일 write는 최대 10회 재시도 원칙을 따른다.

### 확인된 REST endpoint

#### 1. `GET /articles`
- 목적: 전체 ticker 기준 최신 보도자료 조회
- 쿼리 파라미터:
  - `limit` optional, 기본 20, 최대 100
- 실제 확인 결과(2026-03-10):
  - `GET https://api.rtpr.io/articles?limit=100` 성공
  - 최근 100건 모두 `2026-03-10` UTC 기사였다
  - 공식 문서 예시는 `Mon, 28 Jul 2025 16:30:00 -0400`처럼 ET offset 형태도 보여준다

응답 envelope:
```json
{
  "count": 100,
  "articles": [
    {
      "ticker": "INO",
      "exchange": "NASDAQ",
      "title": "...",
      "author": "ACCESSWIRE",
      "created": "2026-03-10T21:28:00.726Z",
      "article_body": "...",
      "article_body_html": "..."
    }
  ]
}
```

#### 2. `GET /articles/{ticker}`
- 목적: 특정 ticker의 press release 조회
- path parameter:
  - `ticker` required
- 쿼리 파라미터:
  - `limit` optional, 기본 50, 최대 100
- 실제 확인 결과(2026-03-10):
  - `GET https://api.rtpr.io/articles/AAPL?limit=5` → `{ "count": 0, "articles": [] }`
- 해석:
  - endpoint 자체는 정상 동작했다.
  - 특정 ticker에 데이터가 없을 수 있으므로 `count=0`을 정상 케이스로 취급한다.

### 확인된 REST 데이터 타입
- **Envelope 타입**
  - `[][][]count[][][]`: 반환 article 개수
  - `[][][]articles[][][]`: article 배열
- **Article 타입**
  - `[][][]ticker[][][]`: 대표 ticker
  - `[][][]exchange[][][]`: 거래소
  - `[][][]title[][][]`: 기사 제목
  - `[][][]author[][][]`: wire/source 작성자 또는 배포 채널
  - `[][][]created[][][]`: 생성 시각 (ISO timestamp 실제 확인)
  - `[][][]article_body[][][]`: plain text 본문
  - `[][][]article_body_html[][][]`: HTML 또는 줄바꿈이 유지된 rich text 본문

### 시각 정규화 규칙
- RTPR 원본 `[][][]created[][][]`는 문서 예시상 ET offset 문자열일 수도 있고, 실제 live REST에서는 `Z`가 붙은 UTC timestamp로도 들어왔다.
- 따라서 원본 포맷을 “항상 ET”라고 가정하지 않는다.
- 하지만 **레포 내부 정규화 규칙은 무조건 ET(`America/New_York`)로 변환**한다.
- 구현 규칙:
  - 수신 시각은 먼저 timezone-aware datetime으로 parse한다.
  - 저장/표시/비교에 사용하는 canonical 시각은 모두 ET로 변환한 값으로 통일한다.
  - 가능하면 raw 원본 문자열도 별도 보존해서 디버깅 가능하게 둔다.
- 운영적 정의:
  - 입력: RTPR `created`
  - 변환: source timezone 유지 parse 후 `America/New_York` 변환
  - 출력: 내부 canonical `created_et`
- 체크 예시:
  - `2026-03-10T21:28:00.726Z` → 2026-03-10 17:28:00.726 ET
  - `Mon, 28 Jul 2025 16:30:00 -0400` → 2025-07-28 16:30:00 ET

### 실제 2026-03-10 샘플 특성
- 기사 source/author 예시:
  - `ACCESSWIRE`
  - `Globe Newswire`
  - `Business Wire`
- 기사 내용 특성:
  - 소송 공지, 배당 공지, earnings call announcement 같은 wire 기반 press release가 실제로 들어왔다.
- 현재까지는 earnings release, 소송/조사 공지, 배당/기업 공지 같은 PR 성격 기사만 확인됐다.
- 별도 장중 시황, macro commentary, 일반 market recap 뉴스는 확인되지 않았다.
- 주의:
  - `article_body_html`은 완전한 HTML 태그 조각일 수도 있고, 줄바꿈 중심의 rich text 문자열일 수도 있다.
  - 일부 텍스트는 인코딩 깨짐(`â`, `Â`)이 보일 수 있으므로 저장/렌더링 시 UTF-8 정규화 또는 후처리가 필요할 수 있다.

### 확인된 WebSocket 프로토콜

#### 연결
```text
wss://ws.rtpr.io?apiKey=<API_KEY>
```

#### 클라이언트 → 서버 메시지
- `subscribe`
```json
{ "action": "subscribe", "tickers": ["AAPL", "TSLA"] }
```
- 전체 feed 구독
```json
{ "action": "subscribe", "tickers": ["*"] }
```
- `unsubscribe`
```json
{ "action": "unsubscribe", "tickers": ["TSLA"] }
```
- 전체 일시중지
```json
{ "action": "unsubscribe", "tickers": ["*"] }
```
- `pong`
```json
{ "type": "pong" }
```

#### 서버 → 클라이언트 메시지 타입
- `connected`
```json
{
  "type": "connected",
  "message": "Connected to RTPR real-time feed",
  "timestamp": "2026-03-10T21:28:49.321850+00:00"
}
```
- `subscribed`
```json
{
  "type": "subscribed",
  "tickers": ["AAPL"],
  "message": "Subscribed to 1 ticker",
  "timestamp": "2026-03-10T21:28:49.551997+00:00"
}
```
- `article`
```json
{
  "type": "article",
  "data": {
    "id": "abc123",
    "ticker": "AAPL",
    "exchange": "NASDAQ",
    "tickers": ["AAPL", "MSFT"],
    "title": "...",
    "author": "Business Wire",
    "created": "2025-07-28T16:30:00.000Z",
    "article_body": "...",
    "article_body_html": "..."
  },
  "timestamp": "2025-07-28T16:30:00.123Z"
}
```
- `ping`
- `error`

### 구현 패턴 권장

#### REST research / dashboard 용도
- 전체 최신 feed가 필요하면 `GET /articles?limit=N`을 우선 사용한다.
- 특정 ticker detail이 필요하면 `GET /articles/{ticker}?limit=N`을 추가로 사용한다.
- ticker별로 다수 호출할 때는 `.github/copilot-skills/finhub_other_api.md`의 병렬화 원칙을 같이 적용한다.
- 하지만 REST limit가 60 rpm이므로 기본 동시성은 작게 시작한다.
  - 권장 시작값: `API_CONCURRENCY = 2`

#### 실시간 alert / feed 용도
- 실시간성이 중요하면 WebSocket을 우선한다.
- 한 서버 프로세스당 1 connection만 유지하고, 내부 fan-out으로 여러 consumer에 배포한다.
- watchlist 기반이면 `subscribe`로 ticker 집합만 전달한다.
- 전체 feed가 필요하면 `tickers: ["*"]`를 사용하되, 후처리/저장 병목을 주의한다.

### 저장 / 정규화 권장안
- canonical article row 후보 컬럼:
  - `[][][]ticker[][][]`
  - `[][][]exchange[][][]`
  - `[][][]title[][][]`
  - `[][][]author[][][]`
  - `[][][]created[][][]`
  - `[][][]created_et[][][]`
  - `[][][]article_body[][][]`
  - `[][][]article_body_html[][][]`
  - `[][][]source[][][]` = `RTPR`
  - `[][][]source_type[][][]` = `press_release`
- WebSocket article에는 문서상 `[][][]id[][][]`, `[][][]tickers[][][]`가 있으므로, 실구현 시 REST/WS 공통 superset 스키마를 검토한다.
- dedup key는 문서상 명시가 없으므로 다음 우선순위를 검토한다.
  1. WebSocket `id`가 있으면 `id`
  2. 없으면 `ticker + created + title`

### 재시도 / 오류 처리
- `401 Unauthorized`: 키 누락/오류. 재시도하지 말고 즉시 실패.
- `429 Too Many Requests`: backoff 후 재시도.
- `500 Internal Server Error`: 짧은 backoff 후 재시도.
- WebSocket close:
  - 즉시 재연결 금지
  - 5초 시작 backoff + 증가 전략 권장

### 검증 체크리스트
- REST:
  - `GET /articles?limit=5`가 200 + JSON envelope 반환
  - `count`와 `articles.length`가 일치하는지 확인
  - `created`가 parse 가능한 timestamp인지 확인
  - parse 후 ET로 변환한 `created_et`가 기대 시각과 일치하는지 확인
- 특정 ticker:
  - `GET /articles/{ticker}`에서 `count=0`도 정상으로 처리되는지 확인
- WebSocket:
  - 연결 직후 `connected` 수신
  - `subscribe` 후 `subscribed` 수신
  - `ping` 수신 시 `pong` 응답

### 하지 말 것
- 키를 프론트엔드 번들에 넣지 않는다.
- WebSocket을 ticker마다 여러 개 열지 않는다.
- `article_body_html`을 항상 안전한 완전 HTML이라고 가정하지 않는다.
- 60 rpm 제한을 무시한 고병렬 REST polling을 기본값으로 두지 않는다.
- RTPR를 일반 market news feed로 가정하고 UI/저장소 이름을 넓게 짓지 않는다.