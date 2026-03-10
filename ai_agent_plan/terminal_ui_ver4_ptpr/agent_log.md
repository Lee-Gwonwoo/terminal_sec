# Agent Log — terminal_ui_ver4_ptpr

## 2026-03-10

### PTPR API 1차 조사 시작 + plan/repo-context 반영 (2026-03-10 17:23)

**작성 시각:** 2026-03-10 17:23 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/ptpr_api_key/ptpr_api_key` 파일이 존재하고 비어 있지 않음을 확인했다.
2. 레포 전체에서 `PTPR|ptpr`를 검색했지만, 기존 provider 구현/문서/테스트는 확인하지 못했다.
3. 공개 검색과 간단한 web probe만으로는 provider 공식 base URL 또는 API 문서를 식별하지 못했다.
4. 따라서 현재 상태를 기준 문서에 고정하기 위해 아래 파일을 갱신했다.
   - `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md` 신규 작성
   - `.github/copilot-skills/repo-context.md`에 PTPR 키 경로와 조사 상태 추가

#### 확인된 사실

- 키는 준비되어 있다.
- provider spec/base URL은 레포 내부 source of truth가 없다.
- 2026-03-10 기준 “오늘 press 데이터를 실제로 주는 endpoint”는 아직 확정되지 않았다.
- 다음 단계는 공식 문서 또는 base URL 확보 후 auth 방식과 endpoint를 probe하는 것이다.

#### 리스크 / 완화

1. **리스크:** provider hostname을 추측해서 구현을 시작하면 401/404/HTML landing page만 반복할 수 있다.
   - 완화 1: vendor 문서 URL 또는 예시 요청을 먼저 확보한다.
   - 완화 2: auth 방식(header/query/bearer)을 문서로 확정한 뒤 probe한다.
2. **리스크:** “문서상 가능”과 “현재 구독 키로 실제 접근 가능”을 혼동할 수 있다.
   - 완화 1: 실제 probe 성공 응답을 기준으로만 데이터 타입을 확정한다.
   - 완화 2: 권한 없음/빈 결과/성공 응답을 분리 기록한다.
3. **리스크:** 3/10 press 데이터가 timezone 규칙 때문에 다른 날짜로 보일 수 있다.
   - 완화 1: provider가 요구하는 날짜 포맷과 timezone 규칙을 먼저 확인한다.
   - 완화 2: 단일 일자 조회와 범위 조회를 교차 검증한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 파일 기준 에러 확인 예정 단계 포함, 구조상 마크다운 문서만 변경 |
| 빌드 | ✅ | 코드 변경 없음(문서 반영만 수행) |
| 자동 테스트 | ✅ | 코드 변경 없음(문서 반영만 수행) |
| 런타임 통합 | ✅ | 키 파일 존재/비어있지 않음 확인, 공개 검색 기반 provider 식별 probe 수행 |

#### 사용자 확인 요청

- 현재 Step 0 상태는 `⏳`이다.
- 다음으로 진행하려면 **PTPR 공식 문서 URL, base URL, 또는 예시 요청 1개** 중 하나가 필요하다.

### RTPR 공식 문서 확보 + REST/WebSocket 실 probe + skill 파일 추가 (2026-03-10 17:35)

**작성 시각:** 2026-03-10 17:35 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자가 제공한 `https://www.rtpr.io/docs`를 기준 문서로 채택했다.
2. 문서 기준 사실을 확인했다.
   - REST base URL: `https://api.rtpr.io`
   - WebSocket URL: `wss://ws.rtpr.io`
   - REST auth: `Authorization: Bearer <API_KEY>`
   - WebSocket auth: query `apiKey=<API_KEY>`
   - REST rate limit: 60 rpm
3. 실제 probe를 수행했다.
   - `GET /articles?limit=5` 성공, 실제 article payload 확인
   - `GET /articles?limit=100` 성공, 최근 100건 모두 `2026-03-10` UTC 기사 확인
   - `GET /articles/AAPL?limit=5` → `count=0`, empty array 확인
   - WebSocket 연결 후 `connected`, `subscribed` 메시지 수신 확인
4. 이후 코드 작성 기준으로 새 skill 파일을 추가했다.
   - `.github/copilot-skills/ptpr_api.md`
5. 연결 문서를 함께 갱신했다.
   - `.github/copilot-instructions.md`
   - `.github/copilot-skills/repo-context.md`
   - `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`

#### 확인된 데이터 타입

- REST envelope: `count`, `articles`
- REST article item: `ticker`, `exchange`, `title`, `author`, `created`, `article_body`, `article_body_html`
- WebSocket inbound: `connected`, `subscribed`, `article`, `ping`, `error`
- WebSocket outbound: `subscribe`, `unsubscribe`, `pong`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경된 마크다운 파일 5개 에러 없음 |
| 빌드 | ✅ | 코드 변경 없음(문서/skill 반영 중심) |
| 자동 테스트 | ✅ | 코드 변경 없음(문서/skill 반영 중심) |
| 런타임 통합 | ✅ | `GET /articles`, `GET /articles/AAPL`, WebSocket `connected/subscribed` 실제 확인 |

#### 리스크 / 완화

1. **리스크:** `article_body_html`이 항상 안전한 완전 HTML이라고 가정하면 렌더/정제 문제가 생길 수 있다.
   - 완화 1: 저장 시 raw 보존 + 렌더 시 sanitize 정책 분리
   - 완화 2: plain text 우선 컬럼도 함께 유지
2. **리스크:** ticker endpoint는 정상이어도 특정 종목은 `count=0`이 자주 나올 수 있다.
   - 완화 1: empty response를 오류가 아닌 정상 케이스로 분리 처리
   - 완화 2: 전체 feed와 ticker feed를 혼용해 fallback 전략을 세운다
3. **리스크:** WebSocket 1-connection 제한을 무시하면 운영 중 충돌이 날 수 있다.
   - 완화 1: 서버 singleton connection 구조를 사용
   - 완화 2: 내부 subscriber fan-out 구조로 분배

#### 사용자 확인 요청

- 현재 Step 0~2는 모두 `⏳` 상태다.
- 다음 단계는 **RTPR 데이터를 기존 `news_items`에 넣을지, RTPR 전용 테이블로 분리할지** 결정한 뒤 구현 plan으로 넘어가면 된다.

### RTPR 시각 ET 강제 변환 규칙 + feed 범위 재확인 (2026-03-10 17:55)

**작성 시각:** 2026-03-10 17:55 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `.github/copilot-skills/ptpr_api.md`에 RTPR 시각 정규화 규칙을 추가했다.
   - 원본 `created`는 문서 예시상 ET offset일 수도 있고, live REST에서는 UTC/Z로도 확인됐기 때문에 내부 canonical 시각은 무조건 ET(`America/New_York`)로 변환한다고 명시했다.
2. `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`에 같은 ET 강제 변환 규칙을 반영했다.
3. RTPR feed 범위를 다시 정리했다.
   - 공식 문서 설명은 `real-time press releases from major wire services`다.
   - 현재 확인된 endpoint는 `GET /articles`, `GET /articles/{ticker}`, WebSocket `article` feed뿐이다.
   - 별도 market news / general news endpoint는 문서와 현재 probe 범위에서 확인되지 않았다고 기록했다.

#### 확인된 사실

- RTPR는 현재 기준 press release provider로 취급하는 것이 맞다.
- 일반 시황/market news는 별도 provider가 필요하다.
- 내부 구현에서 시간 비교/정렬/저장은 ET canonical 값 기준으로 맞추는 것이 안전하다.

#### 리스크 / 완화

1. **리스크:** 원본 timestamp를 ET라고 단정하고 parse하면 UTC/Z 응답에서 날짜 경계가 밀릴 수 있다.
   - 완화 1: timezone-aware parse 후 ET 변환을 강제한다.
   - 완화 2: raw `created`를 별도 보존해 디버깅 가능하게 둔다.
2. **리스크:** RTPR를 market news feed로 오인하면 UI 문구와 저장 모델이 과도하게 넓어진다.
   - 완화 1: source_type을 `press_release`로 고정한다.
   - 완화 2: 일반 뉴스는 Finnhub 등 별도 provider로 분리한다.
3. **리스크:** ET canonical 정책을 정했는데 raw 보존을 안 하면 공급자 포맷 차이를 나중에 추적하기 어렵다.
   - 완화 1: `created_raw`와 `created_et` 병행 저장을 검토한다.
   - 완화 2: 최소한 ingest 로그에 원본 예시를 남긴다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 마크다운 문서 3개 수정 예정, 코드 변경 없음 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | RTPR docs 문구 + 기존 live probe 결과(UTC/Z 응답, wire-service PR 샘플)로 범위 재검증 |

#### 사용자 확인 요청

- 현재 문서 기준으로 RTPR는 `press_release` 전용 provider, 내부 시각 표준은 ET로 정리했다.
- 다음 구현 단계에서 `created_raw + created_et` 병행 저장으로 갈지 여부를 확인하면 된다.

### RTPR Backend + Frontend 전체 구현 완료 (2026-03-10 22:10)

**작성 시각:** 2026-03-10 22:10 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. **config.ts** — `loadRtprApiKey()` 추가. 파일 첫 줄만 읽도록 구현 (Customer ID가 2번째 줄에 있어 수정).
2. **ptprNewsProvider.ts** 신규 생성 — REST fetch + 60 rpm rate limiter + ET 변환 + 합성 URL dedup.
3. **server.ts** — `POST /api/news/pull-rtpr` endpoint 추가 (recent/custom mode, job 기반).
4. **FinnhubNewsWindow.tsx** — Update 메뉴에 PTPR 섹션 + 2개 버튼 + Custom date modal + handler 추가.

#### 런타임 검증 결과

- RTPR recent pull: 100건 fetch → 100건 insert → status=done
- 2차 pull: 0건 insert, 100건 skipped (중복 방지 정상)
- press_release 필터 시 RTPR 기사 정상 조회 확인

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | backend + frontend 0 errors |
| 빌드 | ✅ | backend tsc + frontend vite build 통과 |
| 자동 테스트 | ✅ | 관련 test suite 없음 |
| 런타임 통합 | ✅ | POST /api/news/pull-rtpr 100건 insert, 2차 pull 중복 skip, press_release 필터 정상. 브라우저 시각 확인은 사용자 위임 |

### RTPR Recent 증분 구조 리팩터 — Finnhub 동등 (2026-03-10 22:40)

**작성 시각:** 2026-03-10 22:40 (local)

**Status: awaiting user confirmation**

#### PLAN CHANGE 사유
- 사용자 요청: "기본 유니버스 ticker 목록 → ticker별 anchor → confirmed-empty skip → change% merge → 증분 업데이트. Finnhub recent와 동일하게."
- 기존 RTPR recent 모드는 `GET /articles?limit=100` 글로벌 최신 100건 스냅샷이었음.
- Finnhub recent와 동일한 per-ticker 증분 구조로 전면 재작성.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `terminal/backend/src/services/finnhubNewsProvider.ts` | `getTickerAnchorMap(sourceType, source='FINNHUB')` — source 파라미터 추가. 기존 Finnhub 호출은 기본값으로 영향 없음. |
| `terminal/backend/src/server.ts` | `POST /api/news/pull-rtpr` 전면 재작성: recent 모드 → universe tickers 로드 → RTPR anchor map → per-ticker fetch + anchor 필터 + confirmed-empty skip/record → change% merge + setLastSuccess |
| `termina_web/.../FinnhubNewsWindow.tsx` | "Recent PTPR Press Release" 버튼 설명 업데이트: "Latest 100" → "Per-ticker incremental · anchor + confirmed-empty skip" |

#### 새 동작 구조 (recent 모드)

1. universe ticker 목록 로드 (1698개)
2. `getTickerAnchorMap('press_release', 'RTPR')` — RTPR 전용 anchor map 조회
3. ticker별 반복:
   - anchor 없으면 7일 fallback
   - `getConfirmedEmptyRange(ticker, 'rtpr_press_release')` — confirmed-empty skip
   - `fetchRtprArticlesByTicker(ticker, 100)` — RTPR API 호출
   - articles 0건이면 confirmed-empty 기록
   - anchor 이후 articles만 필터 → DB insert
4. `mergeChangeForNewItems(newItems)` — OHLC change% 자동 계산
5. `setLastSuccess('rtpr_press_release', ...)` — 상태 기록

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | backend tsc --noEmit 0 errors |
| 빌드 | ✅ | backend tsc + frontend vite build 모두 통과 |
| 런타임 1차 pull | ✅ | "Starting RTPR recent pull — 1698 tickers", "1673 tickers have no prior RTPR data → 7d fallback", per-ticker 로그 정상 (예: "RTPR BSX: 14 new (14 fetched)") |
| 런타임 2차 pull | ✅ | fallback count 1673 → 1645 감소 (28개 ticker에 anchor 생성), confirmed-empty skip 동작 확인 |
| DB 상태 | ✅ | RTPR total: 190건, unique tickers: 113 (증분 수집 정상) |
| change% merge | ⚠️ | 두 테스트 모두 cancel로 종료해서 merge 미실행. 완전 run 시 정상 실행 예상 |

#### 리스크 / 완화

1. **리스크:** 1698 tickers × 60 rpm = ~31분 소요.
   - 완화 1: confirmed-empty가 모이면 2차부터 대부분 skip → 속도 대폭 개선.
   - 완화 2: 필요 시 RTPR 전용 concurrency(현재 1)를 rate limiter 범위 내에서 조절 가능.
2. **리스크:** `getTickerAnchorMap` source 파라미터 추가가 기존 Finnhub 호출에 영향.
   - 완화: 기본값 `'FINNHUB'`로 설정 → 기존 코드 무변경.
3. **리스크:** confirmed-empty key `'rtpr_press_release'`가 `confirmed_empty_ranges` 테이블 source_type 컬럼에 새 값으로 들어감.
   - 완화: `UNIQUE(ticker, source_type)` 제약으로 Finnhub `'press_release'`와 충돌 없음.

### RTPR concurrency 5 기본 병렬 처리 + Control Window 설정 추가 (2026-03-10 23:13)

**작성 시각:** 2026-03-10 23:13 (local)

**Status: awaiting user confirmation**

#### PLAN CHANGE 사유
- 사용자 요청: "그래도 한 기본 5개정도로 병렬 가능하게 하고, control window 에도 수치 설정할 수 있도록"
- 기존 RTPR recent/custom는 ticker 루프를 `await` 순차 처리하고 있었음.
- Finnhub는 이미 설정 가능한 concurrency 개념이 있었지만 RTPR는 body 입력/UI 설정이 없었음.

#### 작업 요약

1. `server.ts`
   - `pull-rtpr` schema에 `tickerConcurrency` 추가 (기본 5, 범위 1~20)
   - RTPR recent/custom를 worker pool 기반으로 전환
   - job log에 `[batch] requested tickerConcurrency=...` / `[batch] concurrency=...` 기록 추가
   - update status / job result에 `tickerConcurrency` 포함
2. `FinnhubNewsWindow.tsx`
   - `Control` 버튼과 `News Pull Control` modal 추가
   - Finnhub ticker concurrency, Finnhub request interval, RTPR ticker concurrency를 localStorage로 저장
   - PTPR custom modal에도 RTPR concurrency 입력 추가
   - `handlePtprUpdate()`가 `tickerConcurrency`를 backend로 전달하도록 수정
3. RTPR pagination/windowing probe 결과를 유지
   - `offset`, `page`, `cursor`, `before`, `after`는 동일 결과 반환 → 현재 공개 REST 기준 pagination/windowing 미지원으로 판단 유지

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `FinnhubNewsWindow.tsx` 에러 없음 |
| 빌드(backend) | ✅ | `npm run build -w backend` 통과 |
| 빌드(frontend) | ✅ | `vite build` 통과 |
| 런타임 통합 | ✅ | RTPR recent job 시작 후 로그에서 `requested tickerConcurrency=5`, `[batch] concurrency=5` 확인 |

#### 런타임 로그 샘플

```text
[23:13:52] Starting RTPR recent pull — 1698 tickers
[23:13:52] [batch] requested tickerConcurrency=5
[23:13:52] 1523 tickers have no prior RTPR data → 7d fallback
[23:13:52] [batch] concurrency=5
[23:13:52]   RTPR ETN: 1 new (1 fetched)
```

#### 리스크 / 완화

1. **리스크:** concurrency를 올려도 RTPR 문서상 60 rpm 제한을 넘기면 429가 날 수 있다.
   - 완화 1: provider 내부 token bucket은 55 req/min으로 유지한다.
   - 완화 2: Control Window 입력 범위를 1~20으로 제한한다.
2. **리스크:** concurrency를 너무 높이면 체감 속도 개선보다 대기 시간이 길어질 수 있다.
   - 완화 1: 기본값은 5로 둔다.
   - 완화 2: 사용자가 job log를 보고 낮추거나 높일 수 있게 한다.
3. **리스크:** custom modal과 Control Window 값이 다르면 혼란이 생길 수 있다.
   - 완화 1: custom modal 시작 시 저장값(localStorage)을 그대로 사용/갱신한다.
   - 완화 2: modal 설명에 Control과 연동된다는 문구를 넣는다.

#### 사용자 확인 요청

- 현재 RTPR는 기본 5개 병렬 처리이며, Control Window에서 값을 바꿀 수 있다.
- 다음 단계로는 `custom PTPR`의 confirmed-empty/anchor skip 최적화(Plan Step 7-3)로 이어가면 된다.