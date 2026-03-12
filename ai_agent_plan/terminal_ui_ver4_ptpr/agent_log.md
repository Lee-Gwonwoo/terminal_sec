# Agent Log — terminal_ui_ver4_ptpr

## 시간순 전체 요약

아래는 현재 파일에 기록된 작업을 시간순으로 한 번 더 압축 정리한 요약이다. 상세 내용은 각 날짜 섹션에 그대로 유지한다.

| 일시 | 작업 | 핵심 결과 |
|------|------|-----------|
| 2026-03-10 17:23 | PTPR 1차 조사 시작 | 키 존재 확인, base URL / 공식 문서 미확정 상태를 plan/repo-context에 고정 |
| 2026-03-10 17:35 | RTPR 공식 문서 확보 + 실 probe | REST/WebSocket auth, base URL, rate limit 확인. `/articles` 및 WS subscribe 실제 성공 |
| 2026-03-10 17:55 | RTPR ET canonical 규칙 정리 | RTPR를 `press_release` provider로 고정, 내부 표준 시각을 ET로 정리 |
| 2026-03-10 19:47 | RTPR Full Text Backfill 버튼 추가 | 저장된 RTPR body를 `news_fulltext`에 backfill하는 전용 job/button 추가 |
| 2026-03-10 20:03 | News Feed 새로고침 기본 입력 공란화 | refresh 후 ticker/search 기본값 자동 복원 제거 |
| 2026-03-10 20:10 | RTPR raw HTML 저장 전략 plan 추가 | raw HTML 저장/표시 전략을 설계 단계로 분리 |
| 2026-03-10 20:25 | Step 11 plan 개정 | `news_fulltext.full_text`에 HTML 저장, `news_items.body`는 plain text 유지로 방향 확정 |
| 2026-03-10 20:37 | Step 11 구현 완료 | RTPR HTML 저장, plain text 반환, `origin_url` 추출/저장 구현 |
| 2026-03-10 22:10 | RTPR backend/frontend 전체 구현 | RTPR pull job, UI 버튼, source filter까지 end-to-end 동작 확인 |
| 2026-03-10 22:40 | RTPR recent 증분 구조 리팩터 | universe ticker + anchor + confirmed-empty skip + change merge 구조로 전환 |
| 2026-03-10 23:13 | RTPR concurrency 5 + Control Window 설정 | RTPR 병렬도 설정과 UI control 추가, runtime log로 concurrency 반영 확인 |
| 2026-03-10 23:24 | News Feed RTPR 표시 누락 수정 | source filter가 `FINNHUB,RTPR`를 보도록 수정 |
| 2026-03-10 23:35 | RTPR plain text fulltext 즉시 저장 | RTPR update 시 기사 body를 `news_fulltext`에 즉시 저장하도록 보강 |
| 2026-03-11 10:20 | same-day change gating 분석 | 기사 날짜보다 과거 OHLC anchor로 계산된 change 문제 확인, 후속 plan 반영 |
| 2026-03-11 10:29 | 기존 잘못된 RTPR change metric 정리 | invalid RTPR metric rows 삭제 후 API에서 null 확인 |
| 2026-03-11 10:33 | change 정상 업데이트 절차 문서화 | 장중 null 유지, EOD 후 재계산으로 값 채움 절차를 plan에 반영 |
| 2026-03-11 10:40 | 6-5/6-6 gating 구현 | `anchorDate !== newsDate`면 metric 미저장하도록 공통 경로 수정 |
| 2026-03-11 11:06 | change progress 조기 100% 수정 | running 중 100% 오표시를 방지하도록 3단계 progress로 재구성 |
| 2026-03-11 11:15 | 장중 same-day ET 장종료 규칙 반영 | 당일 change는 ET 16:00 이후에만 허용하도록 plan 강화 |
| 2026-03-11 11:20 | ET 장종료 규칙 + job 99% 상한 구현 | 장중 same-day change 차단, running job progress 99% 상한 적용 |
| 2026-03-11 11:26 | 위 규칙 검증 완료 | build/test/runtime으로 same-day null, running<100 확인 |
| 2026-03-11 11:36 | 장중 3/11 OHLC purge + 3/10 forward 정리 | current day OHLC row 제거, 과거 잘못된 forward target 정리 |
| 2026-03-11 11:36 | API change 날짜 필드 의미 분리 | `ohlc_date`, `change_pct_ohlc_date`, `change_1d_target_date` 의미를 분리 |
| 2026-03-11 11:43 | 날짜 필드 분리 검증 완료 | `/api/news` raw JSON으로 날짜 필드 의미 검증 |
| 2026-03-11 11:46 | repo/front/back spec 문서 동기화 | skill/spec 문서를 실제 API 계약과 일치시킴 |
| 2026-03-12 | Company Description / Peers job 로그 연동 | `pull-fmp`, `pull-peers`를 job 기반으로 전환하고 Data Control Log panel과 연결 |
| 2026-03-12 | Company Description / Peers 기본 대상 전체화 | 기본 50개 제한 제거, body 미지정 시 default universe 전체 대상으로 변경 |
| 2026-03-12 | FMP/Finnhub IPO date 확인 | Finnhub 공식 문서에서 `ipo` 확인, FMP stable live 응답에서 `ipoDate` 확인 |

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

## 2026-03-12

### Company Description / Peers Update job 로그 연동 (2026-03-12)

**작성 시각:** 2026-03-12 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. Data Control의 `Company Description Update`, `Peers Data Update`는 UI에 Log panel이 있었지만 backend `pull-fmp`, `pull-peers`가 즉시 완료형 응답이라 실제 진행률/로그가 비어 있었다.
2. `terminal/backend/src/server.ts`를 수정해 두 endpoint를 모두 background job 기반으로 전환했다. 이제 route는 즉시 `{ jobId }`를 반환하고 backend worker가 진행률과 로그를 채운다.
3. `terminal/backend/src/services/fmpCompanyProfileProvider.ts`, `terminal/backend/src/services/finnhubPeersProvider.ts`를 수정해 취소 여부와 진행 callback을 받을 수 있게 했다.
4. `DataControlWindow.tsx` 완료 summary를 보강해 company data job도 `requested/updated/failed/rows` 요약을 표시하게 했다.
5. plan/spec 문서를 새 job 계약 기준으로 갱신했다.

#### 변경 파일

- `terminal/backend/src/server.ts`
- `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
- `terminal/backend/src/services/finnhubPeersProvider.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `terminal/backend_prompt.md`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`

#### 기대 동작

- `POST /api/company-profiles/pull-fmp` → `{ jobId }`
- `POST /api/company-profiles/pull-peers` → `{ jobId }`
- `GET /api/jobs/:jobId`에서 progress, logs, result 확인 가능
- Data Control `View Log` 패널에서 회사 설명/peers update의 ticker별 로그와 완료 summary 확인 가능

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts`, `fmpCompanyProfileProvider.ts`, `finnhubPeersProvider.ts`, `DataControlWindow.tsx` 에러 0개 |
| 빌드(backend) | ✅ | `npm run build` 통과 |
| 자동 테스트(backend) | ✅ | `vitest run` 9 files / 55 tests passed |
| 빌드(frontend) | ✅ | `vite build` 통과 |
| 런타임 통합 | ✅ | `pull-fmp` / `pull-peers` 호출 시 `{jobId}` 반환, `/api/jobs/:jobId`에서 progress/logs/result 확인 |

#### 런타임 검증 샘플

```text
FMP_JOB_ID=373988b5-d4a0-4efd-9ce0-29ee5ea87998
[21:31:33] Starting FMP company description update for 1 tickers
[21:31:34] AAPL: description updated (1665 chars)

PEERS_JOB_ID=c232655d-ec3b-417b-9414-7a267246406a
[21:31:35] Starting Finnhub peers update for 1 tickers
[21:31:35] AAPL: 12 peers saved
```

#### 리스크 / 완화

1. **리스크:** job route로 바뀌면서 기존 즉시 응답을 기대하던 코드가 있으면 깨질 수 있다.
   - 완화 1: Data Control 호출 경로와 prompt 문서를 함께 갱신했다.
   - 완화 2: runtime으로 `{ jobId }` 반환을 다시 확인한다.
2. **리스크:** backend dev 서버 hot reload 타이밍에 따라 이전 코드가 잠시 남아 있을 수 있다.
   - 완화 1: build와 실제 API 재호출로 계약을 검증한다.
   - 완화 2: 필요 시 dev server output을 점검한다.
3. **리스크:** cancellation은 지원하지만 provider 루프가 너무 늦게 취소를 반영하면 UX가 둔할 수 있다.
   - 완화 1: batch loop마다 cancel check를 넣었다.
   - 완화 2: 장시간 universe 기준으로 추가 체감 검증을 한다.

#### 사용자 확인 요청

- 다음으로 build/runtime 검증을 진행한다.
- 검증 후 실제 Data Control 화면에서 보이는 로그 형태까지 함께 확인해달라고 요청할 예정이다.

### Company Description / Peers 기본 maxTickers 제거 (2026-03-12)

**작성 시각:** 2026-03-12 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자 확인 결과, `Company Description Update`와 `Peers Data Update`는 기본적으로 50개가 아니라 default universe 전체를 처리해야 했다.
2. 원인을 확인했다.
   - frontend는 두 버튼에서 `tickers`, `maxTickers`를 보내지 않는다.
   - backend `pull-fmp`, `pull-peers`는 `maxTickers ?? 50`로 기본 제한을 걸고 있었다.
3. 이를 `maxTickers ?? tickers.length`로 변경해, body에서 제한을 주지 않으면 default universe 전체가 대상이 되도록 수정했다.
4. backend prompt와 plan 문서도 같은 계약으로 갱신했다.

#### 기대 동작

- `POST /api/company-profiles/pull-fmp` body 없음 → default universe 전체 대상
- `POST /api/company-profiles/pull-peers` body 없음 → default universe 전체 대상
- `maxTickers`를 명시한 경우에만 앞에서부터 제한

#### 검증 계획

1. backend build 확인
2. body 없이 endpoint 호출
3. 생성된 job의 `requested`가 50이 아니라 default universe 전체 길이와 일치하는지 확인

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `server.ts` 에러 0개 |
| 빌드 | ✅ | backend build 통과 |
| 런타임(FMP) | ✅ | body 없이 `pull-fmp` 호출 시 job `requested=1698`, `status=running` 확인 후 cancel |
| 런타임(Peers) | ✅ | body 없이 `pull-peers` 호출 시 job `requested=1698`, `status=running` 확인 후 cancel |

#### 런타임 검증 샘플

```text
FMP jobId=4167c7b6-023e-4859-9ae5-c0081f27b816 requested=1698 completed=0 status=running
PEERS jobId=2a1f31f1-b1ca-49fa-b9fa-7a2810d55b91 requested=1698 completed=2 status=running
```

#### 리스크 / 완화

1. **리스크:** default universe 전체를 기본으로 돌리면 FMP/Finnhub provider 호출 시간이 길어진다.
   - 완화 1: job 기반 progress/log를 유지해 사용자가 진행 상태를 확인할 수 있게 했다.
   - 완화 2: 필요 시 이후 UI에 `maxTickers` 입력을 추가해 부분 실행을 다시 허용할 수 있다.
2. **리스크:** 실수로 버튼을 눌렀을 때 전체 universe job이 오래 돌 수 있다.
   - 완화 1: `/api/jobs/:jobId/cancel`이 동작하도록 유지한다.
   - 완화 2: 이번 검증도 long run 방지를 위해 즉시 cancel로 수행했다.

### FMP / Finnhub IPO date 공식 문서 확인 (2026-03-12)

**작성 시각:** 2026-03-12 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자의 질문에 따라 FMP와 Finnhub가 IPO date를 제공하는지 공식 문서 기준으로 재확인했다.
2. Finnhub는 공식 문서에서 명시적으로 확인됐다.
   - `Company Profile Premium` 응답 필드에 `ipo`
   - `Company Profile 2` 응답 필드에 `ipo`
3. FMP는 현재 fetch 가능한 공식 dataset 페이지에서 stable endpoint 자체는 확인되지만, 정적 페이지 응답에는 필드 목록이 충분히 노출되지 않았다.
4. 대신 공식 stable endpoint `https://financialmodelingprep.com/stable/profile?symbol=AAPL`를 live로 호출해 `ipoDate` 필드가 실제 응답에 포함됨을 확인했다.
5. 레포 코드도 이미 그 필드를 저장 경로에 연결하고 있음을 재확인했다.

#### 확인 결과

- Finnhub 공식 문서 필드명: `ipo`
- FMP stable 응답 필드명: `ipoDate`
- 현재 레포 저장 컬럼: `company_profiles.ipo_date`

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 공식 문서(Finnhub) | ✅ | `Company Profile` / `Company Profile 2` 응답 필드에 `ipo` 명시 |
| 공식 문서(FMP) | ⚠️ | dataset 페이지에서 endpoint는 확인되지만 정적 fetch로 필드 목록 직접 확인은 제한적 |
| 라이브 API(FMP) | ✅ | `stable/profile?symbol=AAPL` 응답에서 `ipoDate=1980-12-12` 확인 |
| 레포 코드 | ✅ | provider 매핑, DB schema, repository 저장 경로 모두 `ipo_date` 연결 확인 |

#### 관련 파일

- `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
- `terminal/backend/src/server.ts`
- `terminal/backend/src/db.ts`
- `terminal/backend/src/services/companyProfileRepository.ts`

#### 사용자 확인 요청

- 현재 기준으로 IPO date는 두 provider 모두 사용 가능하다고 봐도 된다.

### IPO Date Update 버튼 + News Feed / Default Ticker 컬럼 추가 (2026-03-12 17:52)

**작성 시각:** 2026-03-12 17:52 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. Finnhub `profile2` provider에 `ipo` 매핑을 추가하고, `companyProfileRepository.upsertCompanyProfile()`를 partial upsert로 보강했다.
   - 이제 `pull-market-cap`와 새 `pull-ipo-date`가 같은 `source='finnhub'` row를 공유해도 서로 `ipo_date`/`market_cap`를 null로 덮어쓰지 않는다.
2. backend에 `POST /api/company-profiles/pull-ipo-date` background job endpoint를 추가했다.
   - default universe 기준으로 Finnhub `ipo`를 수집하고 `GET /api/jobs/:jobId`에서 progress/log/result를 확인할 수 있다.
3. `GET /api/news`와 `GET /api/tickers` 응답에 `ipoDate`를 추가했다.
   - 뉴스는 대표 ticker 기준 최신 non-null `company_profiles.ipo_date`를 lookup한다.
   - default ticker 목록은 `ticker_universes/default` 조회 시 `ipoDate`를 함께 내려준다.
4. 프론트엔드에 아래 UI를 추가했다.
   - Data Control → Company Data 그룹: `IPO Date Update`
   - Finnhub News column: `IPO Date`
   - Default Ticker column: `IPO Date`
5. backend/frontend prompt와 plan 문서를 새 계약에 맞춰 갱신했다.

#### 변경 파일

- `terminal/backend/src/services/companyProfileRepository.ts`
- `terminal/backend/src/services/finnhubProfile2Provider.ts`
- `terminal/backend/src/services/newsRepository.ts`
- `terminal/backend/src/types.ts`
- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DefaultTickerWindow.tsx`
- `terminal/backend_prompt.md`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`

#### 기대 동작

- `POST /api/company-profiles/pull-ipo-date` → `{ jobId }`
- `GET /api/jobs/:jobId` → progress, logs, result 확인 가능
- Data Control `IPO Date Update` 버튼으로 full-universe IPO date 수집 실행 가능
- `GET /api/news` row에 `ipoDate` 포함
- `GET /api/tickers` row에 `ipoDate` 포함
- News Feed와 Default Ticker에서 IPO Date 컬럼 표시

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경한 backend/frontend 파일 `get_errors` 0개 |
| 빌드 | ✅ | backend `npm run build`, frontend `vite build` 통과 |
| 자동 테스트 | ✅ | backend `vitest run` 9 files / 55 tests passed |
| 런타임 통합 | ✅ | `pull-ipo-date` 단일 ticker job 완료, `/api/tickers`와 `/api/news`에서 `ipoDate=1980-12-12` 확인 |

#### 런타임 검증 샘플

```text
JOB_ID=e2b77676-172b-43b0-b1bb-582f07cb30c8
[21:58:50] Starting Finnhub IPO date update for 1 tickers
[21:58:51] AAPL: ipo date updated (1980-12-12)

/api/tickers -> { ticker: "AAPL", ipoDate: "1980-12-12", marketCap: 3815334643520.9995 }
/api/news?source_names=FINNHUB&tickers=AAPL&limit=1 -> { tickers:["AAPL"], ipoDate:"1980-12-12" }
```

#### 리스크 / 완화

1. **리스크:** Finnhub free tier 속도로 full-universe IPO date job이 길게 돌 수 있다.
   - 완화 1: 기존 job progress/log panel을 그대로 붙여 장시간 실행을 추적 가능하게 했다.
   - 완화 2: 검증은 단일 ticker(`AAPL`)로 먼저 수행한다.
2. **리스크:** `company_profiles` 최신 row만 보면 older non-null IPO date가 가려질 수 있다.
   - 완화 1: 뉴스와 ticker 응답은 최신 non-null `ipo_date`를 조회하도록 구현했다.
   - 완화 2: 필요하면 이후 market cap subquery도 같은 패턴으로 정리할 수 있다.
3. **리스크:** Data Control 버튼만 붙이고 backend status key를 분리하지 않으면 Last Success가 다른 회사 데이터 job과 섞일 수 있다.
   - 완화 1: `update_status.company_profiles_ipo_date`를 별도로 사용한다.

#### 사용자 확인 요청

- backend/API 기준 검증은 완료했다.
- 브라우저에서 Data Control의 `IPO Date Update` 버튼, News Feed의 `IPO Date` 컬럼, Default Ticker의 `IPO Date` 컬럼이 보이는지 최종 시각 확인을 부탁한다.

### repo-context DB 구조 감사 + repo skill 동기화 (2026-03-12 22:20)

**작성 시각:** 2026-03-12 22:20 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. live app DB를 `/api/db/inspect`로 다시 점검해 repo skill 문서와 실제 schema/row count 차이를 확인했다.
2. 결과적으로 **새 app DB 테이블 누락은 없었고**, repo-context의 설명 드리프트를 수정했다.
3. 주요 반영 사항:
    - `company_profiles.ipo_date`가 이제 `GET /api/news`, `GET /api/tickers`, `pull-ipo-date` 경로에서 실제로 사용된다는 점 추가
    - `update_status` live row 수와 source_key 예시 갱신 (`company_profiles_ipo_date` 포함)
    - `watchlist_items.security_id`, `research_tabs.deleted_at`, `research_pages.deleted_at`를 명시
    - `news_items` live schema의 `publisher`, `origin_url`, 남아 있는 legacy inline change 컬럼을 더 구체적으로 명시
    - 프론트 localStorage 키 목록을 실제 구현 기준으로 확장 (`terminal-workspace-v1`, `finhub-news-ui-state`, `data-control-active-tab`, `rtpr-ticker-concurrency` 등)
4. OHLC DB는 현재 레포 기준으로 여전히 `ohlc_1d` + `symbols` 구조이며, derived 컬럼은 `ohlcWatchlistRepository.ts`에서 migration으로 관리됨을 재확인했다.

#### 감사 결과 요약

- **누락된 새 app DB 테이블:** 없음
- **repo skill에서 보강이 필요했던 DB 데이터 타입/컬럼 설명:** 있음
   - `company_profiles.ipo_date`
   - `update_status`의 확장된 source_key 집합
   - `watchlist_items.security_id`
   - `research_tabs.deleted_at`, `research_pages.deleted_at`
   - `news_items.publisher`, `news_items.origin_url`
   - 프론트 localStorage 상태 키
- **추가 점검 메모:** row count는 운영 데이터 누적에 따라 계속 변하므로, repo-context의 수치는 “2026-03-12 live inspect 예시”로 읽어야 한다.

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 변경만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | `/api/db/inspect`, `/api/updates/status` live 호출로 schema/source_key 확인 |

#### 사용자 확인 요청

- repo skill 기준 DB 구조 감사와 동기화는 끝났다.
- 원하면 다음으로 `backend_prompt.md`와 `.github/copilot-skills/repo-context.md` 사이의 중복/불일치도 한 번 더 정리하겠다.
- 차이는 필드명만 다르다: Finnhub `ipo`, FMP `ipoDate`.

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

### 당일 change ET 장종료 규칙 + 조기 100% 표시 방지 구현 (2026-03-11 11:20)

**작성 시각:** 2026-03-11 11:20 (local)

**Status: awaiting user confirmation**

#### PLAN CHANGE 사유
- 사용자 요청: 당일 change는 장 종료 시각 이후에만 반영하고, change update View Log가 running 중 100%를 먼저 보여주지 않도록 수정.
- 기존 구현은 `anchorDate === newsDate`만 만족하면 당일 metric 저장이 가능했고, job progress는 running 상태에서도 100%까지 올라갈 수 있었다.

#### 작업 요약

1. `terminal/backend/src/services/newsChangeMerger.ts`
   - source별 `published_at`를 ET 시장일로 해석하는 helper 추가
   - timezone-aware timestamp는 ET 변환, RTPR ET-naive timestamp는 ET 그대로 사용
   - 현재 ET 시장일 뉴스는 ET `16:00:00` 전이면 same-day metric 저장 차단
   - 이번 재계산에서 조건을 만족하지 못한 뉴스의 기존 standard metric 8개도 삭제해 stale 값을 제거
2. `terminal/backend/src/services/jobManager.ts`
   - `status=running` 동안 `progress.pct`를 최대 `99`로 제한
   - `completeJob()` 이후에만 `100` 노출
3. 테스트 추가
   - `terminal/backend/tests/newsChangeMerger.test.ts`
   - `terminal/backend/tests/jobManager.test.ts`
4. 문서 동기화
   - `terminal/backend_prompt.md`
   - `ai_agent_plan/terminal_ui_ver4_ptpr/plan.md`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 코드 수정 후 `get_errors`로 확인 예정 |
| 빌드 | ⏳ | `npm run build` 예정 |
| 자동 테스트 | ⏳ | `npm run test` 예정 |
| 런타임 통합 | ⏳ | change update API + `/api/jobs/:jobId` 재검증 예정 |

#### 리스크 / 완화

1. **리스크:** Finnhub UTC timestamp와 RTPR ET-naive timestamp가 섞여 있어 날짜 판정이 다시 틀어질 수 있다.
   - 완화 1: helper 테스트에 UTC/ET-naive 케이스를 모두 넣는다.
   - 완화 2: 런타임 검증 시 3/11 기사 샘플의 `published_at`/`ohlc_date`를 다시 비교한다.
2. **리스크:** progress 99 상한이 다른 job 화면에 부작용을 줄 수 있다.
   - 완화 1: backend 공통 semantics로 정의하고 테스트로 보장한다.
   - 완화 2: 완료 후 `completeJob()`이 100으로 올리는지 같이 검증한다.
3. **리스크:** 장마감 후에도 same-day OHLC bar가 아직 DB에 없으면 값이 계속 비어 있을 수 있다.
   - 완화 1: 기존 `anchorDate === newsDate` 조건은 유지해 잘못된 전일 anchor 저장을 계속 차단한다.
   - 완화 2: 필요 시 장마감 이후 re-run 절차를 안내한다.

### 당일 change ET 장종료 규칙 + 조기 100% 표시 방지 검증 완료 (2026-03-11 11:26)

**작성 시각:** 2026-03-11 11:26 (local)

**Status: awaiting user confirmation**

#### 검증 요약

1. 정적 분석
   - 수정 파일 4개(`newsChangeMerger.ts`, `jobManager.ts`, `newsChangeMerger.test.ts`, `jobManager.test.ts`) 모두 에러 0개 확인.
2. 빌드
   - `npm run build` 재실행 성공.
3. 자동 테스트
   - `npm run test` 재실행 성공.
   - `8 files / 53 tests passed`.
4. 런타임 통합
   - `POST /api/news/change/update-recent` 실행 후 polling 샘플에서 running 중 `progress.pct=100`이 한 번도 나오지 않음을 확인.
   - `POST /api/news/change/update-custom` (`from=2026-03-11`, `to=2026-03-11`) 실행 후, 3/11 RTPR 기사 5건의 `change_pct`, `change_from_open_pct`, `change_open_to_high_pct`, `ohlc_date`가 모두 `null`로 정리됨을 확인.

#### 핵심 결과

- running 상태 job은 `99%` 상한이 적용되고, 완료 후에만 `100%`가 된다.
- 2026-03-11 장중 RTPR same-day change는 더 이상 남지 않는다.
- 이전 run에서 잘못 남아 있던 stale `news_change_metrics`도 이번 update에서 제거된다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 수정된 TS 파일 + 신규 테스트 파일 에러 0개 |
| 빌드 | ✅ | `npm run build` 성공 |
| 자동 테스트 | ✅ | `8 files / 53 tests passed` |
| 런타임 통합 | ✅ | `update-recent` running 중 100% 미노출, `update-custom(2026-03-11)` 후 RTPR 3/11 change 값 null 확인 |

#### 사용자 확인 요청

- 현재 Step 3 상태는 구현/검증 완료, **사용자 확인 대기**다.
- 사용자는 아래 둘을 직접 확인하면 된다.
  1. Data Control Window에서 change update 실행 중 View Log가 running 상태일 때 100%가 먼저 뜨지 않는지.
  2. 2026-03-11 RTPR 기사 행에서 change 관련 컬럼이 장 종료 전에는 비어 있는지.

### 장중 3/11 OHLC row purge + 3/10 forward metric 정리 (2026-03-11 11:36)

**작성 시각:** 2026-03-11 11:36 (local)

**Status: awaiting user confirmation**

#### PLAN CHANGE 사유
- 사용자 지적: 장 마감 전에는 3/11 데이터가 DB에 아예 없어야 하는데, canonical OHLC DB와 3/10 RTPR의 `change_1d_pct.target_date=2026-03-11`가 남아 있었다.
- 원인:
  1. `upsertBars()`가 장중 오늘 일봉을 그대로 저장하고 있었음.
  2. `bulkUpdateCustomChange()`가 `2026-03-10T00:00:00` 같은 자정 ET-naive 행 3건을 범위 하한 비교에서 누락하고 있었음.

#### 작업 요약

1. `terminal/backend/src/services/ohlcWatchlistRepository.ts`
   - ET `16:00:00` 이전에는 current ET date 일봉을 필터링
   - `getOverallMaxDate()` / `getSymbolMaxDate()`도 장중 current ET date를 무시
2. `terminal/backend/src/services/newsChangeMerger.ts`
   - forward 조회에서도 장중 current ET date를 제외
   - `bulkUpdateCustomChange()`를 `substr(published_at,1,10)` 기준 date-range 비교로 수정
3. 런타임 정리
   - `OHLC_data/ohlc_1d_watchlist.sqlite`에서 `Datetime='2026-03-11'` 834건 삭제
   - `POST /api/news/change/update-custom` (`2026-03-10` 하루) 재실행

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 신규 수정 파일 에러 0개 |
| 빌드 | ✅ | 직전 build/test 사이클 통과 상태 유지 |
| 자동 테스트 | ✅ | `9 files / 55 tests passed` |
| 런타임 통합 | ✅ | OHLC DB 3/11 row count `834 → 0`, 3/10 RTPR `target_date='2026-03-11'` `3 → 0`, API에서 `change_1d_pct=null` 확인 |

#### 사용자 확인 요청

- 현재는 장중 기준으로 다음 상태다.
  1. OHLC canonical DB에 3/11 일봉 row가 없다.
  2. 3/10 RTPR 기사에 3/11 forward metric target도 남아 있지 않다.
  3. 3/11 RTPR 기사 same-day change는 비어 있다.

### API change 날짜 필드 의미 분리 (2026-03-11 11:36)

**작성 시각:** 2026-03-11 11:36 (local)

**Status: awaiting user confirmation**

#### PLAN CHANGE 사유
- 사용자 요청: `ohlc_date`가 헷갈리니 바로 수정.
- 기존 API는 `change_pct` 값과 함께 `change_1d_pct.target_date`를 `ohlc_date`로 내려 날짜 의미를 섞고 있었다.

#### 작업 요약

1. `terminal/backend/src/services/newsRepository.ts`
   - `ohlc_date`를 `change_pct.target_date`로 변경
   - `change_pct_ohlc_date`, `change_1d_target_date`를 별도 응답 필드로 추가
2. `terminal/backend/src/types.ts`
   - 새 필드 타입 추가
3. `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
   - frontend 타입 동기화
4. `terminal/backend_prompt.md`, `plan.md`
   - 새 필드 의미 문서화

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `newsRepository.ts`, `types.ts`, `FinnhubNewsWindow.tsx` 에러 0개 |
| 빌드 | ✅ | `npm run build` 성공 |
| 자동 테스트 | ✅ | `9 files / 55 tests passed` |
| 런타임 통합 | ✅ | `/api/news` raw JSON에서 `ohlc_date=change_pct_ohlc_date`, `change_1d_pct=null`일 때 `change_1d_target_date=null` 확인 |

### API change 날짜 필드 의미 분리 검증 완료 (2026-03-11 11:43)

**작성 시각:** 2026-03-11 11:43 (local)

**Status: awaiting user confirmation**

#### 핵심 결과

- `[][][]ohlc_date[][][]`는 이제 `change_pct` 기준 날짜만 의미한다.
- `[][][]change_pct_ohlc_date[][][]`는 같은 값을 명시적으로 다시 제공한다.
- `[][][]change_1d_target_date[][][]`는 `change_1d_pct`가 실제로 있을 때만 채워지고, 값이 없으면 `null`이다.

### 레포 skill + front/backend spec 문서 동기화 (2026-03-11 11:46)

**작성 시각:** 2026-03-11 11:46 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `.github/copilot-skills/repo-context.md`
   - `GET /api/news`의 날짜 필드 의미 분리 반영
   - ET 장중 current day OHLC row 비저장 규칙 반영
2. `terminal/backend_prompt.md`
   - `change_pct_ohlc_date`, `change_1d_target_date` 문서화
   - metric이 `null`이면 대응 날짜 필드도 `null`이라는 규칙 반영
3. `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
   - 프론트가 받아야 하는 새 날짜 필드와 Changes % 영역 해석 규칙 반영

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 3개 에러 0개 |
| 빌드 | ✅ | 직전 build/test 사이클 통과 상태 유지 |
| 자동 테스트 | ✅ | 코드 변경 검증은 직전 `9 files / 55 tests passed` 상태 유지 |
| 런타임 통합 | ✅ | 직전 `/api/news` raw JSON 검증 결과와 문서 내용 일치 확인 |

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

### same-day change gating 분석 + plan 반영 (2026-03-11 10:20)

**작성 시각:** 2026-03-11 10:20 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. RTPR recent update 직후 붙는 change 값의 계산 경로를 코드 기준으로 재확인했다.
   - `server.ts`에서 `mergeChangeForNewItems(newItems)`를 즉시 호출함.
   - `newsChangeMerger.ts`는 `getOhlcCloseOnOrBefore()`로 기사일 이하의 가장 최근 일봉을 anchor로 사용함.
2. 실제 API 응답으로 2026-03-11 기사와 2026-03-10 기사의 `ohlc_date`를 점검했다.
   - 3/11 기사: `published_at=2026-03-11...`, `ohlc_date=2026-03-06` 케이스 다수 확인
   - 3/10 기사: 일부 `ohlc_date=2026-03-09`, 다수 `ohlc_date=2026-03-06` 확인
3. 결론적으로 현재 change 값은 "기사일 확정 일봉 기준"이 아니라 "OHLC DB에 있는 가장 최근 과거 일봉 기준"일 수 있음을 확인했다.
4. 사용자 요청에 따라 plan에 후속 단계 `6-5 same-day change gating`을 추가했다.

#### 판단 결론

- 2026-03-11 장중 기사 change는 현재 의미가 맞지 않는다.
- 2026-03-10 기사 change도 전부 맞다고 볼 수 없다. 기사일과 같은 `ohlc_date`가 보장되지 않았기 때문이다.
- 후속 수정에서는 "기사일과 같은 trading day bar가 확정되기 전", 또는 "anchor가 기사일보다 과거일 때" change를 API/UI에서 null 처리해야 한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 코드 읽기 + 문서(plan/log) 반영만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | `GET /api/news?...source_names=RTPR...`로 3/11, 3/10 기사들의 `published_at`, `ohlc_date`, `change_*`를 직접 확인 |

#### 리스크 / 완화

1. **리스크:** same-day gating을 넣어도 장 마감 뒤 재계산 트리거가 없으면 null이 오래 남을 수 있다.
   - 완화 1: existing recent/custom change update job 또는 RTPR pull 후 재merge 시 same-day 조건이 해제되도록 구현한다.
   - 완화 2: 필요하면 EOD 이후 별도 change backfill job을 둔다.
2. **리스크:** API에서 `ohlc_date`를 계속 노출하면 사용자가 과거 anchor fallback을 내부 구현 detail로 보게 된다.
   - 완화 1: 디버그용 유지 여부를 별도 결정한다.
   - 완화 2: 사용자 UI는 null gating 기준만 신뢰하게 만든다.

#### 사용자 확인 요청

- plan에 `6-5 same-day change gating`을 추가했다.
- 다음 실제 코드 수정은 이 규칙대로 `newsChangeMerger` 또는 API 노출 로직에서 same-day gating을 구현하는 것이다.

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

### RTPR 기존 잘못된 change metric 정리 (2026-03-11 10:29)

**작성 시각:** 2026-03-11 10:29 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 2026-03-09 기사도 추가 확인했다.
   - API 표본에서 `published_at=2026-03-09...`, `ohlc_date=2026-03-06` 인 RTPR 기사가 실제로 존재했다.
   - 즉 문제는 3/11 장중만이 아니라 기존 데이터에도 이미 누적돼 있었다.
2. 잘못된 RTPR change metric의 삭제 기준을 확정했다.
   - 대상: `source='RTPR'`, `source_type='press_release'`
   - 조건: `substr(published_at, 1, 10) > ohlc_date`
   - 의미: 기사 날짜보다 과거 trading day anchor로 계산된 기존 change row
3. 삭제 전에 app DB 백업을 생성했다.
   - 백업 파일: `tmp/app_before_rtpr_change_cleanup_20260311_1020.db`
4. 기존 잘못된 RTPR change metric을 DB에서 삭제했다.

#### 정리 결과

- 삭제 전: invalid news 341건, invalid metric rows 2728건
- 삭제 후: invalid news 0건, invalid metric rows 0건
- API 표본 재확인 결과: 3/11 RTPR 기사들의 `ohlc_date`, `change_pct`, `change_from_open_pct`, `change_open_to_high_pct` 가 모두 null로 내려옴

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 임시 cleanup 스크립트로 집계/삭제 후 제거 예정 |
| 빌드 | ✅ | 애플리케이션 코드 변경 없음 |
| 자동 테스트 | ✅ | 애플리케이션 코드 변경 없음 |
| 런타임 통합 | ✅ | 3/9 API 표본 확인 + cleanup 전후 집계 + `/api/news?source_names=RTPR` 재확인 |

#### 리스크 / 완화

1. **리스크:** 기존 잘못된 row를 삭제했기 때문에, 코드 수정 전 다시 RTPR pull/change merge를 돌리면 같은 문제가 재주입될 수 있다.
   - 완화 1: 다음 단계로 `6-5 same-day change gating` 구현을 바로 진행한다.
   - 완화 2: 그 전까지는 RTPR change 값은 비어 있는 상태를 정상으로 본다.
2. **리스크:** 삭제 기준이 RTPR에만 적용됐기 때문에 다른 source에도 같은 패턴이 있는지는 아직 미확인이다.
   - 완화 1: 현재 사용자 요청 범위는 RTPR만 처리한다.
   - 완화 2: 필요하면 후속으로 FINNHUB도 같은 audit 기준으로 점검한다.

#### 사용자 확인 요청

- 3/9까지 포함한 기존 RTPR 잘못된 change metric 정리는 완료했다.
- 다음 작업은 code path 자체에서 같은 오류가 다시 들어오지 않게 same-day gating을 구현하는 것이다.

### change 데이터 정상 업데이트 절차 plan 반영 (2026-03-11 10:33)

**작성 시각:** 2026-03-11 10:33 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자의 질문 "change 데이터가 제대로 업데이트 되려면 어떻게"에 맞춰 plan Step 6을 보강했다.
2. 기존 `6-5 same-day change gating`에 더해 `6-6 장마감 후/과거 backfill 재계산 경로`를 추가했다.
3. 정상 업데이트 규칙을 운영 절차로 명시했다.
    - RTPR pull 직후: `anchorDate === 기사 날짜` 일 때만 change 저장
    - 장중 same-day 기사: null 유지 정상
    - 장마감 후 또는 과거 일자 backfill: `POST /api/news/change/update-recent` 또는 `POST /api/news/change/update-custom` 으로 재계산
    - 재계산 전제: OHLC DB에 해당 거래일 바가 실제로 존재해야 함

#### 판단 결론

- change 데이터가 제대로 업데이트되려면, 단순히 RTPR pull을 다시 누르는 것만으로는 부족하다.
- 핵심 조건은 **기사 날짜와 같은 OHLC 일봉이 존재하는지** 이고, 값 채우기는 그 뒤에 change update endpoint 재실행으로 일어나야 한다.
- 따라서 운영상 의미는 다음과 같다.
   - 장중: null 정상
   - EOD 이후 OHLC 확보 + 재계산: 숫자 채움 정상

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서(plan/log) 업데이트만 수행 |
| 빌드 | ✅ | 애플리케이션 코드 변경 없음 |
| 자동 테스트 | ✅ | 애플리케이션 코드 변경 없음 |
| 런타임 통합 | ✅ | 기존 백엔드 endpoint `/api/news/change/update-recent`, `/api/news/change/update-custom` 존재 확인 |

#### 사용자 확인 요청

- plan에 "언제 비우고, 언제 다시 채우는지"까지 반영했다.
- 다음 실제 구현은 `6-5/6-6`대로 same-day gating을 코드에 넣고, EOD 재계산 후 값이 채워지는지 검증하는 것이다.

---

### 6-5/6-6 same-day change gating 코드 구현 (2026-03-11 10:40)

**작성 시각:** 2026-03-11 10:40 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `newsChangeMerger.ts`의 `computeMetricsForItem()` 함수에 same-day gating 1줄 추가.
2. 핵심 로직: `anchorDate !== newsDate`이면 `null` 반환 → change metric 미저장.
3. 이 함수는 아래 3개 공개 함수에서 공통 호출되므로, 한 곳 수정으로 모든 경로에 적용됨:
   - `mergeChangeForNewItems()` — RTPR/Finnhub pull 시 초기 change merge
   - `bulkUpdateRecentChange()` — 최근 7일 재계산 endpoint
   - `bulkUpdateCustomChange()` — 임의 기간 재계산 endpoint

#### 변경 파일

| 파일 | 변경 내용 |
|------|---------|
| `terminal/backend/src/services/newsChangeMerger.ts` | `computeMetricsForItem()` 내 `anchorDate !== newsDate` 체크 추가 (약 line 205) |

#### 6-6은 별도 코드 변경 불필요한 이유

- `computeMetricsForItem()`의 gating이 재계산 경로에도 동일하게 적용됨.
- 장마감 후 당일 바가 OHLC DB에 추가되면, `anchorDate === newsDate`가 성립하여 change가 자연스럽게 채워짐.
- 기존 `update-recent`/`update-custom` endpoint는 코드 변경 없이 그대로 동작.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `npx tsc --noEmit` 통과, 에러 0 |
| 빌드 | ✅ | TypeScript 컴파일 성공 |
| 런타임 | ⏳ | 백엔드 재시작 후 RTPR pull → change null 확인 필요 |

#### 사용자 검증 방법

```powershell
# 1. 백엔드 재시작 (dev task 재실행)
# 2. RTPR pull 실행 (또는 이미 데이터가 있으면 change 재계산)
$resp = Invoke-RestMethod -Uri "http://localhost:8080/api/news?limit=10&source_names=RTPR&source_type=press_release" -Method Get
$resp.items | Select-Object id, published_at, ohlc_date, change_pct | Format-Table
# 기대: published_at 날짜와 ohlc_date 다른 기사는 change_pct = null
```

---

### change update 진행률 조기 100% 표시 수정 (2026-03-11 11:06)

**작성 시각:** 2026-03-11 11:06 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `newsChangeMerger.ts`의 recent/custom change update 진행률 계산을 3단계로 재구성했다.
   - 1단계: DB 스캔 + 기존 OHLC 계산
   - 2단계: IBKR fallback fetch/re-compute
   - 3단계: `news_change_metrics` batch write
2. 기존에는 1단계 완료 시 `completed=rows.length, total=rows.length`로 보내서, fallback이 남아 있어도 UI에 100%로 보였다.
3. 수정 후에는 총 진행률을 `rows.length * 3` 기준으로 나눠 보내므로, fallback 진행 중에는 100%가 되지 않는다.

#### 변경 파일

| 파일 | 변경 내용 |
|------|---------|
| `terminal/backend/src/services/newsChangeMerger.ts` | `bulkUpdateRecentChange()` / `bulkUpdateCustomChange()` 진행률을 scan/fallback/write 3단계로 분리 |
| `terminal/backend/src/services/newsChangeMerger.ts` | `ibkrFallbackFetch()`에 re-compute progress callback 추가 |
| `terminal/backend/src/services/newsChangeMerger.ts` | batch write 진행률 반영용 `batchWriteMetricsWithProgress()` 추가 |

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `npx tsc --noEmit` 통과 |
| 런타임 재현 | ✅ | `POST /api/news/change/update-recent` 실행 5초 후 `status=running`, `pct=33` 확인 |
| 회귀 확인 | ✅ | 동일 시점 job log에 IBKR fallback 메시지 존재, 조기 100% 미발생 |

#### 사용자 확인 포인트

- 이제 `View Log`에서 퍼센트가 100%가 되면 실제로 거의 종료 직전이거나 종료 상태여야 한다.
- 적어도 `status=running`인데 `pct=100`으로 보이는 기존 오해성 표시는 이번 수정으로 재현되지 않았다.

---

### 장중 same-day change 금지 규칙 plan 반영 (2026-03-11 11:15)

**작성 시각:** 2026-03-11 11:15 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자의 요청대로 "장 종료 시각 이후가 아니면 당일 change는 반영하지 않는다" 규칙을 plan Step 6에 추가했다.
2. 기존 규칙의 부족한 점도 문서에 명시했다.
   - 기존: `anchorDate === 기사 날짜`면 저장 가능
   - 문제: IBKR fallback이 장중 partial daily bar를 주면 이 조건을 만족해버림
3. 새 규칙은 저장 조건을 아래처럼 강화한다.
   - 과거 기사: `published_date == ohlc_date`면 저장 가능
   - 당일 기사: `published_date == ohlc_date` 이고 `현재 ET >= 16:00` 일 때만 저장 가능

#### 판단 결론

- 현재 확인된 2026-03-11 change 값은 날짜 mismatch 버그는 아니지만, 장중 partial daily bar 기반일 수 있다.
- 따라서 same-day gating은 "같은 날짜인지"만 보면 안 되고, **현재 ET 시각이 장 종료 이후인지**도 함께 봐야 한다.
- 이 규칙을 적용하면 장중 RTPR/PTPR 기사 change는 null 유지, 장마감 후 재계산 시에만 숫자가 채워진다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서(plan/log) 업데이트만 수행 |
| 빌드 | ✅ | 애플리케이션 코드 변경 없음 |
| 런타임 근거 | ✅ | 3/11 기사 `ohlc_date=2026-03-11` 확인 + IBKR `1 day` bar 요청 방식 확인 |

#### 사용자 확인 포인트

- 다음 실제 구현에서는 `today + before 16:00 ET` 조건이면 `anchorDate===newsDate`여도 null이 유지되어야 한다.
- half-day 장마감은 현재 plan에서 후속 개선 항목으로 남겼다.

### FMP 병렬 + skip-existing + UI 설정 추가 (2026-03-12 18:43)

**작성 시각:** 2026-03-12 18:43 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `fmpCompanyProfileProvider.ts`를 순차 처리에서 **병렬 worker pool** 구조로 리팩터링했다.
   - 프로세스 전역 FMP throttle(`acquireFmpSlot`)로 모든 worker의 실제 요청 간격을 직렬화해 429를 방지.
   - 429 발생 시 exponential backoff (최대 30초 캡).
   - retry 횟수를 5회 → 10회로 증가.
2. `companyProfileRepository.ts`에 `getTickersWithFmpProfile()` 추가 — 이미 FMP source로 description이 저장된 ticker set 반환.
3. `server.ts`의 `POST /api/company-profiles/pull-fmp`에 새 파라미터 추가:
   - `concurrency` (기본=5, 범위 1~20)
   - `requestIntervalMs` (기본=250ms, 범위 0~5000ms)
   - `skipExisting` (기본=true): true면 기존 FMP 프로필 있는 ticker 건너뛰기, false면 전체 덮어쓰기.
4. `DataControlWindow.tsx`:
   - FMP concurrency / interval / skip-existing 상태 추가 (localStorage 연동).
   - companyDesc 버튼이 JSON body로 설정값 전달.
   - Settings 탭에 FMP Concurrency, FMP Request Interval, FMP Skip Existing 설정 섹션 추가.
   - `Company Description Update` 버튼의 description에 현재 설정 표시.
5. `backend_prompt.md` 문서 동기화.

#### 변경 파일

- `terminal/backend/src/services/fmpCompanyProfileProvider.ts` — 병렬 worker pool + 전역 throttle
- `terminal/backend/src/services/companyProfileRepository.ts` — `getTickersWithFmpProfile()` 추가
- `terminal/backend/src/server.ts` — pull-fmp endpoint 파라미터 확장
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` — FMP 설정 UI + body 전달
- `terminal/backend_prompt.md` — pull-fmp 문서 갱신

#### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 4개 소스파일 에러 0개 |
| 빌드(backend) | ✅ | `npm run build` 통과 |
| 자동 테스트 | ✅ | 55/55 passed |
| 빌드(frontend) | ✅ | vite build 통과 (596.99 kB) |
| 런타임(overwrite) | ✅ | `skipExisting=false, concurrency=2, interval=300ms` → job 시작, 3 tickers 대상, `skipped=0` |
| 런타임(skip) | ✅ | `skipExisting=true` → 3 tickers 중 1개 skip, 2개만 fetch 대상 |

#### 런타임 검증 로그

```text
# Overwrite mode
Starting FMP company description update for 3 tickers (concurrency=2, interval=300ms, skipExisting=false, skipped=0)

# Skip-existing mode
Starting FMP company description update for 2 tickers (concurrency=2, interval=300ms, skipExisting=true, skipped=1)
```

⚠️ FMP API가 현재 429를 반환하고 있어 실제 fetch 완료는 불가했으나, 병렬 구조/skip 로직/파라미터 전달 모두 정상 동작 확인. 429는 FMP API key plan의 rate limit (free tier ~5 req/min)에 의한 것.

#### 리스크 / 완화

1. **리스크:** FMP free tier는 매우 제한적 (5 req/min, 250 req/day). 1698 tickers 전체 처리가 비현실적일 수 있음.
   - 완화 1: skip-existing 기본 활성화로 이미 받은 ticker는 재요청하지 않음.
   - 완화 2: interval을 12초 이상으로 설정하면 free tier에서도 429 회피 가능 (단, 소요 시간 증가).
   - 완화 3: 유료 플랜 업그레이드 시 기본 250ms 간격으로 빠르게 처리 가능.
2. **리스크:** 병렬 worker들이 429 backoff 중 모두 대기하면서 job 진행이 느려질 수 있음.
   - 완화 1: backoff 최대 30초로 cap, 10회 재시도 후 해당 ticker skip.
   - 완화 2: interval을 충분히 길게 설정하면 429 자체가 발생하지 않음.