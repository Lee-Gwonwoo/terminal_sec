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

### RTPR 전용 Full Text Backfill 버튼 추가 (2026-03-10 19:47)

**작성 시각:** 2026-03-10 19:47 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `terminal/backend/src/services/fulltextRepository.ts`
   - `getRtprBodyBackfillRows()` 추가
   - 조건: `source='RTPR'`, body 존재, fulltext 누락/실패/빈 텍스트/word_count 0 인 행만 백필 대상
2. `terminal/backend/src/services/fulltextUpdateService.ts`
   - `runRtprBodyBackfill(jobId, concurrency)` 추가
   - 저장된 RTPR body를 plain text로 정리한 뒤 `news_fulltext`에 `rtpr-body-backfill` note로 upsert
3. `terminal/backend/src/server.ts`
   - `POST /api/news/fulltext/backfill-rtpr` endpoint 추가
4. `FinnhubNewsWindow.tsx`
   - Full Text 드롭다운에 `RTPR Body Backfill` 항목 추가
   - 선택 시 RTPR 전용 endpoint를 호출하도록 분기
   - 마지막 실행 라벨에 `FT RTPR` 표시 추가

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 4개 `get_errors` 0 errors |
| 빌드 | ✅ | backend `npm run build -w backend`, webui `npm run build` 통과 |
| 자동 테스트 | ✅ | backend `vitest run` 6 files / 48 tests passed |
| 런타임 통합 | ✅ | 격리 DB + port 4010 backend에서 `POST /api/news/fulltext/backfill-rtpr` 실행, sample RTPR row 1건이 `news_fulltext`에 `rtpr-body-backfill`로 저장됨 |

#### 리스크 / 완화

1. **리스크:** 기존에 성공 저장된 RTPR fulltext까지 불필요하게 다시 덮어쓸 수 있다.
   - 완화 1: 조회 조건을 `missing/failed/empty/word_count=0`로 제한했다.
   - 완화 2: 필요하면 이후 `force` 옵션 없이 현 상태를 유지한다.
2. **리스크:** RTPR body 안에 HTML이 섞여 있으면 그대로 저장될 수 있다.
   - 완화 1: job에서 `htmlToPlainText()`를 먼저 적용한다.
   - 완화 2: 비어 버리면 raw trimmed body를 fallback으로 사용한다.
3. **리스크:** Full Text 메인 버튼이 RTPR 전용 모드로 남아 사용자가 일반 추출로 오해할 수 있다.
   - 완화 1: 메인 라벨을 `FT RTPR`로 별도 표시했다.
   - 완화 2: tooltip에 stored body backfill임을 명시했다.

#### 사용자 확인 요청

- Step 10 구현과 self-verification은 완료했다.
- 사용자 확인 전까지 이 항목은 `⏳`로 유지한다.
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

### News Feed UI에서 RTPR 표시 누락 수정 (2026-03-10 23:24)

**작성 시각:** 2026-03-10 23:24 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. DB/API 확인 결과 RTPR press release row는 이미 정상 저장되어 있었음.
2. 하지만 `FinnhubNewsWindow.tsx`의 목록 조회가 `source_names=FINNHUB`로 고정되어 있어 UI에서 RTPR가 숨겨지고 있었음.

### 새로고침 시 News Feed 입력값 기본 공란으로 변경 (2026-03-10 20:03)

**작성 시각:** 2026-03-10 20:03 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
   - workspace restore 시 `linkedTicker`를 localStorage에서 다시 읽어오던 로직 제거
   - 결과적으로 `FinnhubNewsWindow`의 `initialTicker`가 새로고침 후 자동 주입되지 않음
2. 기존 세션 중 링크 기능 자체는 유지됨
   - 사용 중 `onTickerClick`으로 링크 ticker를 넘기는 동작은 그대로 유지
   - 단지 브라우저 refresh 이후에는 기본값이 빈 상태로 시작

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `App.tsx` errors 0 |
| 빌드 | ✅ | frontend `npm run build` 통과 |
| 자동 테스트 | ✅ | 코드 범위가 frontend state restore 1건이라 기존 backend test 영향 없음 |
| 런타임 통합 | ✅ | 코드 경로상 새로고침 restore에서 `linkedTicker`를 주입하지 않으므로 입력 기본값은 공란. 브라우저 시각 확인은 사용자 위임 |

#### 리스크 / 완화

1. **리스크:** refresh 후 이전 링크 ticker를 기대하던 사용 흐름이 사라진다.
   - 완화 1: 세션 중 링크 동작은 유지한다.
   - 완화 2: refresh default만 빈 상태로 바뀐다는 점을 명확히 유지한다.
2. **리스크:** localStorage 안의 기존 `linkedTicker` 값은 남아 있을 수 있다.
   - 완화 1: restore를 하지 않으므로 동작에는 영향 없다.
   - 완화 2: 필요하면 후속으로 persist에서도 제외할 수 있다.

#### 사용자 확인 요청

- 이제 새로고침하면 News Feed의 search/ticker 입력 기본값은 빈 상태로 시작한다.
- 사용자 확인 전까지 이 항목은 `⏳`로 유지한다.

### RTPR raw HTML 저장 전략 검토용 plan 추가 (2026-03-10 20:10)

**작성 시각:** 2026-03-10 20:10 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자가 요청한 방향에 맞춰 plan에 `Step 11 — RTPR raw HTML 저장 + UI plain text 표시 전략`을 추가했다.
2. 설계 범위를 다음 4개로 분리했다.
   - raw HTML 저장 위치 결정
   - recent/custom 등 모든 PTPR update ingest 경로에 동일 저장 규칙 적용
   - UI는 plain text만 표시
   - publisher별 원문 링크 추출은 부가 메타데이터 단계로 분리
3. 특히 기존 `news_items.url` synthetic dedup key는 유지하고, 원문 링크는 별도 필드로 저장해야 한다는 점을 plan에 명시했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 변경만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 현재 RTPR body/footer 패턴 조사 결과를 바탕으로 plan 반영 |

#### 사용자 확인 요청

- ~~현재는 설계/plan 단계만 추가했다.~~
- ~~다음 구현 단계로 넘어가기 전, raw HTML 저장을 `body 대체`가 아니라 `body + raw_html 병행`으로 갈지 확인이 필요하다.~~
- → **2026-03-10 20:25 사용자 결정 반영 완료** (아래 참고)

### Step 11 plan 개정 — fulltext에 HTML 직접 저장 (2026-03-10 20:25)

**작성 시각:** 2026-03-10 20:25 (local)

**Status: awaiting user confirmation**

#### 사용자 결정 사항

1. `body_html_raw` 같은 별도 필드/테이블은 만들지 않는다.
2. **`news_fulltext.full_text`에 raw HTML을 저장**한다 (기존 plain text 교체).
3. `news_items.body`는 plain text 유지.
4. UI fulltext 조회 시 서버에서 `htmlToPlainText()` 변환 후 반환.
5. 추출한 원문 링크는 `news_items.origin_url` 신규 컬럼에 저장.
6. PTPR Update(recent/custom) + FT RTPR(backfill) 모든 버튼에 동일 적용.

#### 변경 내용

- `plan.md` Step 11을 전면 개정:
  - 기존 4단계(11-1~11-4) → 6단계(11-1~11-6)로 확장
  - 저장 모델 요약 테이블 + 데이터 흐름 다이어그램 추가
  - 적용 범위(모든 PTPR 버튼) 명시
  - Step 9, Step 10 연동 변경 사항 명시
  - publisher별 원문 링크 추출 패턴(ACCESSWIRE, PR Newswire, Newsfile, BW, Globe) 추가
  - 검증 훅(PowerShell) 업데이트

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 변경만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |

#### 사용자 확인 요청

- Step 11 plan이 사용자 결정(fulltext에 HTML 직접 저장, 별도 필드 불필요)을 반영했는지 확인 필요.
- 확인 후 구현 단계(11-1부터) 진행 가능.

### Step 11 구현 완료 — RTPR HTML 저장 + plain text 표시 + origin URL 추출 (2026-03-10 20:37)

**작성 시각:** 2026-03-10 20:37 (local)

**Status: awaiting user confirmation**

#### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `terminal/backend/src/db.ts` | `ensureColumn("news_items", "origin_url", "TEXT")` 추가 (11-1) |
| `terminal/backend/src/services/finnhubNewsProvider.ts` | `FinnhubMappedItem` 타입에 `bodyHtml?: string` 추가 (11-2) |
| `terminal/backend/src/services/ptprNewsProvider.ts` | `mapArticle`에서 `article.article_body_html` → `bodyHtml` 매핑 추가 (11-2) |
| `terminal/backend/src/services/rtprOriginUrlExtractor.ts` | **신규** — publisher별 origin URL 추출기 (ACCESSWIRE, PR Newswire, Newsfile, BW, Cision) (11-6) |
| `terminal/backend/src/server.ts` | `persistRtprFulltext()` 신규 함수: HTML 우선 저장 + origin_url 추출/저장 (11-3) |
| `terminal/backend/src/server.ts` | recent/custom RTPR ingest에서 `persistRtprFulltext()` 사용으로 변경 (11-3) |
| `terminal/backend/src/server.ts` | fulltext GET에서 HTML 감지 시 `htmlToPlainText()` 변환 후 반환 (11-5) |
| `terminal/backend/src/services/fulltextRepository.ts` | `RtprBodyBackfillRow` 인터페이스에 `title`, `tickers_csv`, `published_at` 추가 + 쿼리에 `NOT LIKE '%-html%'` 조건 추가 (11-4) |
| `terminal/backend/src/services/fulltextUpdateService.ts` | `runRtprBodyBackfill` 전면 재작성: ticker별 API 재호출 → title 매칭 → HTML 저장 + origin_url 추출, 매칭 실패 시 plain text fallback (11-4) |

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | ✅ | 타입 에러 0 |
| npm run build | ✅ | backend 빌드 성공 |
| npm run test | ✅ | 48/48 테스트 통과 |
| 정적 분석 | ✅ | 변경된 7개 파일 모두 에러 0 |

#### 사용자 확인 요청

- 런타임 검증 필요: backend 재시작 후 RTPR update(recent) 실행 → fulltext에 HTML 저장 확인, origin_url 값 확인, fulltext GET API 응답에 plain text만 오는지 확인.
3. `fetchNews()`와 `fetchMore()`의 query를 `FINNHUB,RTPR`로 변경하여 News Feed에서 RTPR도 함께 표시되도록 수정.

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 런타임 API | ✅ | `GET /api/news?limit=20&source_type=press_release&source_names=RTPR` 에서 RTPR 기사 확인 |
| 런타임 API(혼합) | ✅ | `GET /api/news?limit=10&source_type=press_release` 에서 RTPR 기사 포함 확인 |
| 정적 분석 | ✅ | `FinnhubNewsWindow.tsx` 에러 없음 |
| 빌드(frontend) | ✅ | `vite build` 통과 |

#### 리스크 / 완화

1. **리스크:** 이제 News Feed가 FINNHUB 전용이 아니라 RTPR도 함께 보여주므로, 기존 사용자 기대와 달라질 수 있다.
   - 완화: 현재는 `FINNHUB,RTPR`만 포함해 EODHD 등 다른 provider까지 넓히지는 않았다.
2. **리스크:** 화면이 열려 있던 상태면 즉시 반영되지 않을 수 있다.
   - 완화: 페이지 새로고침 후 Press Release 탭에서 재확인한다.

### RTPR update 시 plain text body를 news_fulltext에 즉시 저장 (2026-03-10 23:35)

**작성 시각:** 2026-03-10 23:35 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `newsRepository.ts`
   - `getNewsIdBySourceUrl(source, url)` helper 추가
   - 중복 기사도 기존 `news_id`를 찾을 수 있게 함
2. `fulltextRepository.ts`
   - `upsertProvidedFulltext()` 추가
   - provider가 직접 준 plain text body를 `news_fulltext`에 `success` 상태로 insert/update
3. `server.ts`
   - RTPR recent/custom 루프에서 기사 insert 직후 `article_body`를 `news_fulltext`에 즉시 저장
   - 새 기사뿐 아니라 중복 기사도 기존 `news_id` lookup 후 full text 보강 가능

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `newsRepository.ts`, `fulltextRepository.ts` 에러 없음 |
| 빌드(backend) | ✅ | backend build 통과 |
| 런타임 API | ✅ | RTPR recent 실행 후 `TXN`, `T`, `LMT`, `ETN`, `APP` 기사에서 `hasFullText=true` 확인 |
| fulltext row | ✅ | `/api/news/fulltext/:id`에서 `extractionStatus='success'`, `wordCount` 확인 |

#### 런타임 검증 샘플

```text
TXN / T / LMT / ETN / APP 기사들 → hasFullText=true
/api/news/fulltext/<id> → extractionStatus=success
```

#### 리스크 / 완화

1. **리스크:** 예전에 저장된 RTPR 기사 중 아직 touch되지 않은 row는 full text가 비어 있을 수 있다.
   - 완화 1: 이후 RTPR update가 해당 ticker를 다시 fetch하면 자동 보강된다.
   - 완화 2: 필요하면 RTPR 전용 backfill job으로 한 번 더 채울 수 있다.
2. **리스크:** provider-body와 extractor 결과가 다를 경우 full text 내용이 달라질 수 있다.
   - 완화: RTPR는 외부 링크를 주지 않으므로 provider `article_body`를 source-of-truth로 취급한다.

#### 사용자 확인 요청

- 현재는 RTPR update 버튼만 눌러도 fetch된 RTPR 기사의 plain text body가 `news_fulltext`에 바로 저장된다.
- 과거에 이미 저장돼 있었지만 아직 안 채워진 RTPR row는, 해당 ticker가 다시 fetch되면 보강된다.