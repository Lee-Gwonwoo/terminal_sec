# Agent Log — terminal_ui_ver6_fmp

## 시간순 전체 요약

| 일시 | 작업 | 핵심 결과 |
|------|------|-----------|
| 2026-03-20 18:04 | FMP 구독 범위 조사 plan 작성 시작 | docs 구조와 레포의 기존 FMP 사용 지점을 기준으로 `terminal_ui_ver6_fmp` 계획 문서를 생성 |

## 2026-03-20

### FMP 구독 가능 데이터 타입 조사 plan 작성 (2026-03-20 18:04)

**작성 시각:** 2026-03-20 18:04 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/` 폴더를 새로 만들었다.
2. `plan.md`를 생성해 “현재 구독으로 어떤 FMP 데이터 타입을 받을 수 있는지 확인하는 조사 계획”을 작성했다.
3. 공식 docs(`https://site.financialmodelingprep.com/developer/docs`)에서 확인 가능한 FMP 대분류를 plan에 반영했다.
4. 레포 내부의 현재 FMP 사용 지점과 제약을 반영했다.
   - `terminal/backend/src/services/fmpCompanyProfileProvider.ts`
   - `terminal/backend_prompt.md`
   - 과거 FMP 429 이력
5. plan은 실제 구현이 아니라 조사형 Step으로만 구성했다.
   - 인증 baseline
   - 핵심 equity family probe
   - 뉴스/규제/애널리스트 family probe
   - 멀티자산/벌크 family probe
   - 최종 access matrix 및 후속 우선순위 정리

#### 확인된 사실

- 현재 레포는 FMP를 `stable/profile` 기반 회사 프로필 수집에 이미 사용하고 있다.
- FMP key는 환경 변수 또는 `ai_agent_plan/fmp_api_key/fmp_api_key` 경로에서 읽도록 설계돼 있다.
- 공식 docs에는 매우 많은 데이터 카테고리가 있지만, docs 표식과 현재 구독 실제 허용 범위는 별도 검증이 필요하다.
- 따라서 이번 문서는 “문서 인벤토리 + 대표 endpoint live probe 계획”으로 구성했다.

#### 리스크 / 완화

1. **리스크:** docs에 있는 endpoint를 모두 현재 구독에서 쓸 수 있다고 오해할 수 있다.
   - 완화 1: plan에 `ACCESS_OK`, `ACCESS_EMPTY_BUT_OK`, `ACCESS_DOC_ONLY`, `ACCESS_DENIED_OR_LIMITED` 구분을 넣었다.
   - 완화 2: category별 대표 endpoint만 최소 probe 하도록 제한했다.
2. **리스크:** 429를 “영구 불가”로 잘못 해석할 수 있다.
   - 완화 1: 429는 rate limit 계열로 따로 기록한다.
   - 완화 2: 권한 제한(401/402/403)과 분리해 판정하도록 plan에 명시했다.
3. **리스크:** 조사 범위가 너무 넓어져 key 호출 예산을 낭비할 수 있다.
   - 완화 1: Step 1에서 호출 예산을 먼저 고정한다.
   - 완화 2: bulk endpoint는 메타 수준 확인만 하도록 제한했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 파일 신규 생성만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 레포 내 FMP 경로와 공식 docs 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 `plan.md`와 `agent_log.md` 초안 작성 완료, 실행은 아직 시작 전이다.
- 다음 단계는 아래 둘 중 하나다.
  1. 이 plan 그대로 유지하고, 이후 내가 representative endpoint probe를 실제로 시작한다.
  2. 먼저 probe 범위를 줄여서 `company/profile + news + charts` 같은 핵심 family만 확인한다.

### PLAN CHANGE — legacy Finnhub SEC 제거 반영 (2026-03-20 20:26)

**작성 시각:** 2026-03-20 20:26 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 사용자 지시에 따라 기존 `Finnhub SEC filing` 데이터를 유지하지 않고 제거하는 방향으로 plan을 수정했다.
2. code scope를 아래 4개로 확정했다.
   - backend `/api/news/pull-finhub-sec` 제거
   - legacy `finnhubSecProvider.ts` 제거
   - startup 시 `FINNHUB + sec_filing` row purge
   - frontend SEC 필터 / Recent SEC Filing / Custom SEC Filing / modal 제거
3. 문서도 현재 상태에 맞추기로 했다.
   - `plan.md`
   - `terminal/backend_prompt.md`

#### 확인된 사실

- live DB 확인 기준, 제거 직전 기존 SEC row가 실제로 남아 있었다.
  - `news_items`: `source='FINNHUB' AND source_type='sec_filing'` = `3608`
  - `sec_filings`: `3604`
- 따라서 단순히 UI 버튼만 숨기면 안 되고, DB purge와 backend route 제거가 함께 필요했다.
- 현재 결정은 `FMP SEC로 이미 전환`이 아니라, `legacy Finnhub SEC 제거`다.

#### 리스크 / 완화

1. **리스크:** 삭제 조건을 넓게 잡으면 다른 뉴스 row까지 지울 수 있다.
   - 완화 1: startup purge 조건을 `source='FINNHUB' AND source_type='sec_filing'`로 고정한다.
   - 완화 2: purge 후 count 쿼리로 `sec_filing` row가 0인지 재검증한다.
2. **리스크:** backend route만 지우고 frontend 버튼을 남기면 사용자 클릭 시 런타임 에러가 난다.
   - 완화 1: frontend `sec_filing` 필터와 update/menu/modal을 같이 제거한다.
3. **리스크:** 문서가 예전 route를 계속 설명하면 운영 상태를 오해할 수 있다.
   - 완화 1: `plan.md`와 `backend_prompt.md`를 함께 갱신한다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ⏳ | 코드 제거 직후 재검증 예정 |
| 빌드 | ⏳ | backend/frontend 재빌드 예정 |
| 자동 테스트 | ⏳ | 제거 반영 후 실행 예정 |
| 런타임 통합 | ⏳ | purge 후 DB count + route 제거 확인 예정 |

#### 사용자 확인 요청

- 현재 상태는 제거 방향을 plan/log에 반영하고 실제 코드 제거를 진행 중이다.
- 다음 단계는 build와 DB 재검증까지 마무리하는 것이다.

### legacy Finnhub SEC 제거 완료 + FMP SEC full text 방향 정리 (2026-03-20 20:33)

**작성 시각:** 2026-03-20 20:33 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. legacy `Finnhub SEC filing` backend route, provider, frontend 진입점 제거를 마무리했다.
2. startup purge로 기존 `FINNHUB + sec_filing` 데이터가 실제로 제거됐는지 DB에서 재검증했다.
3. `plan.md`에 FMP PR full text / FMP SEC full text 설계 원칙을 다시 정리했다.

#### 반영한 설계 원칙

- `FMP PR full text`
   - 별도 버튼 유지가 맞다.
   - 저장된 `text`를 full text로 쓰지 않고 원문 `url` 재방문 후 추출한다.
- `FMP SEC full text`
   - FMP 응답만으로 full text를 얻는 구조가 아니다.
   - `finalLink` 또는 `link`를 따라 SEC 문서를 직접 파싱해야 한다.
   - 향후 버튼이 필요하면 `FMP SEC full text`보다 `SEC filing full text`라는 독립 개념이 더 적합하다.
   - 단, 나중에 `FMP SEC`를 별도 dataset으로 운영하면 FMP 전용 버튼도 가능하다.

#### 검증 결과

- legacy SEC route 제거 확인:
   - `POST /api/news/pull-finhub-sec` → `404 Not Found`
- DB purge 확인:
   - `news_items WHERE source_type='sec_filing'` → `0 rows`
   - `sec_filings` → `0 rows`
- build/test 확인:
   - backend build 성공
   - frontend build 성공
   - backend test `57 passed`

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 기준 `get_errors` 0개 |
| 빌드 | ✅ | backend + frontend build 모두 성공 |
| 자동 테스트 | ✅ | backend vitest `57 passed` |
| 런타임 통합 | ✅ | `/healthz` 200, legacy SEC route 404, DB `sec_filing` count 0 |

#### 사용자 확인 요청

- 현재 상태는 legacy Finnhub SEC 제거와 관련 검증까지 모두 완료된 상태다.
- 사용자가 직접 확인할 포인트는 아래 2개다.
   1. UI에서 더 이상 SEC 필터/SEC update 메뉴가 보이지 않는지
   2. `fmp pr` 관련 버튼 흐름이 기존대로 보이고 동작하는지

### plan.md 확인 사실 반영 (2026-03-20 18:24)

**작성 시각:** 2026-03-20 18:24 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`에 이번 대화에서 실제로 확인된 내용만 별도 섹션으로 추가했다.
2. `live probe로 확인됨`, `공식 FAQ / docs로 확인됨`, `의도적으로 제외하는 미확정 해석`으로 구분해 섞이지 않게 정리했다.
3. 정확한 플랜 티어 매핑처럼 아직 확정하지 못한 항목은 plan의 확인 사실 목록에서 제외했다.

#### plan에 반영한 확인 사실

- 현재 key로 `general-latest`, `stock-latest`, `news/stock?symbols=AAPL`, `fmp-articles`, `sec-filings-financials` 응답을 실제로 확인했다.
- 현재 key로 `press-releases-latest`, `news/press-releases?symbols=AAPL` 는 제한 응답을 실제로 확인했다.
- 일반 뉴스/종목 뉴스는 2026-03-20 ET 기준 same-day 항목이 확인되었다.
- FMP FAQ/docs 기준으로 stock news history, 뉴스 수집 주기, EST 기준 설명, press release 문서 설명을 plan에 반영했다.
- `press releases`에 필요한 정확한 구독 티어는 아직 확정하지 못해 plan의 “확인된 사실” 영역에서 제외했다.

#### 리스크 / 완화

1. **리스크:** docs 설명과 live 결과가 혼합되면 나중에 잘못 인용될 수 있다.
   - 완화 1: plan에서 `live probe`와 `공식 FAQ / docs`를 분리했다.
   - 완화 2: 티어 해석은 미확정 섹션으로 따로 뒀다.
2. **리스크:** `SEC 계열 가능`을 전체 SEC endpoint 허용으로 과장할 수 있다.
   - 완화 1: `sec-filings-financials` 최소 1건 성공으로만 서술했다.
   - 완화 2: family 전체 허용으로 일반화하지 않았다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 이번 대화에서 확보한 live probe 결과와 FMP FAQ/docs 확인 사항만 반영 |

#### 사용자 확인 요청

- 현재 반영은 `plan.md`의 확인 사실 정리까지만 수행했다.
- 원하면 다음으로는 `단계별 계획`의 Step 설명도 지금 확인된 결과에 맞게 더 좁혀서 정리할 수 있다.

### SEC 전환 + 안전 삭제 + FMP stock UI plan 재작성 (2026-03-20 18:32)

**작성 시각:** 2026-03-20 18:32 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`를 기존 FMP 구독 조사 문서에서, 실제 구현 작업을 위한 계획서로 전면 재작성했다.
2. 이번 사용자 요구사항을 아래 3개 축으로 분리해 문서화했다.
   - Finnhub SEC filing 수집을 FMP 기반으로 전환
   - 기존 SEC DB 데이터의 안전 삭제
   - `fmp stock` 필터와 `recent/custom fmp stock update` UI 추가
3. 현재 코드에서 실제로 확인한 경로를 기준으로 plan에 반영했다.
   - `terminal/backend/src/server.ts`의 `POST /api/news/pull-finhub-sec`
   - `terminal/backend/src/services/finnhubSecProvider.ts`
   - `terminal/backend/src/db.ts`의 `sec_filings` FK cascade 구조
   - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`

#### 이번에 plan에 반영한 확인 사실

- 기존 SEC 저장 범위는 `news_items.source='FINNHUB' AND source_type='sec_filing'`와 그에 연결된 `sec_filings` row다.
- `sec_filings.news_id`는 `news_items.id`에 `ON DELETE CASCADE`로 연결돼 있어, 부모 row 정확 삭제가 핵심이라는 점을 plan에 반영했다.
- 프론트엔드 SEC 버튼은 현재 `POST /api/news/pull-finhub-sec`를 직접 호출하고 있어, backend route 전환과 UI 라벨/버튼 추가가 함께 움직여야 한다.
- 현재 UI에는 `market_news`와 `sec_filing`은 있지만 `fmp stock` 필터는 아직 없다.

#### 리스크 / 완화

1. **리스크:** FMP SEC endpoint shape가 기존 Finnhub와 다르면 route만 교체해도 저장 로직이 깨질 수 있다.
   - 완화 1: plan Step 1에서 endpoint/field/dedup key를 먼저 확정하도록 했다.
   - 완화 2: provider 책임을 분리하고 mapped shape를 먼저 고정하도록 했다.
2. **리스크:** 기존 SEC 데이터 삭제 범위를 넓게 잡으면 다른 뉴스 데이터까지 손상될 수 있다.
   - 완화 1: `FINNHUB + sec_filing` 동시 조건으로 한정하도록 plan에 명시했다.
   - 완화 2: 삭제 전 count, 샘플 출력, 트랜잭션, 삭제 후 count 재검증 순서를 plan에 넣었다.
3. **리스크:** UI 버튼만 추가하고 filter/query 연결이 빠지면 사용성만 복잡해지고 실제 기능은 동작하지 않을 수 있다.
   - 완화 1: plan Step 4에서 filter state, handler, menu, 위치를 한 세트로 묶었다.
   - 완화 2: `market news` 오른쪽 배치와 active filter 동작을 별도 검증 항목으로 적었다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 관련 backend/frontend 경로와 DB 연결 구조를 읽고 plan에 반영 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 현재 route/UI 연결 관계와 DB cascade 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 구현 plan 재작성 완료다.
- 다음 단계는 이 plan 기준으로 `Step 1 — FMP SEC 수집 스펙 고정`부터 실제 코드 작업에 들어가는 것이다.

### FMP press release / RTPR 비교 / full text 확인 반영 (2026-03-20 19:13)

**작성 시각:** 2026-03-20 19:13 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. 새로 갱신된 FMP 구독 상태에서 press release endpoint를 다시 live probe했다.
2. FMP press release와 RTPR를 latest/ticker 기준으로 직접 비교했다.
3. `RKLB`, `RCAT` 최근 7일 결과를 FMP와 RTPR에서 직접 비교했다.
4. FMP 응답의 `text`가 full text인지 여부를 원문 URL과 길이 비교로 확인한 뒤, 그 결과를 `plan.md`에 반영했다.

#### plan에 반영한 확인 사실

- 현재 FMP 구독에서는 `press-releases-latest`, `press-releases?symbols=AAPL`가 실제 `200 OK`로 동작한다.
- FMP와 RTPR latest feed는 실제로 일부 크게 겹치지만, 건수와 ticker 매핑은 다르다.
- 같은 제목인데 FMP/RTPR에서 ticker가 다르게 붙는 사례가 실제로 있었다.
- 최근 7일 비교에서 `RKLB`는 부분 중복, `RCAT`는 FMP만 결과가 있었다.
- FMP `press release` 응답의 `text` 필드는 존재하지만, 원문 전체 full text라기보다 짧은 발췌/요약에 가깝다.

#### 리스크 / 완화

1. **리스크:** press release 접근 가능을 곧바로 “RTPR 완전 대체 가능”으로 해석할 수 있다.
   - 완화 1: plan에 latest/ticker 비교 결과를 수치로 넣었다.
   - 완화 2: ticker 매핑 불일치 사례를 명시했다.
2. **리스크:** FMP `text`를 full text로 오해해 본문 저장 전략을 단순화할 수 있다.
   - 완화 1: 실제 원문 길이 대비 `text` 길이 비교를 plan에 넣었다.
   - 완화 2: `fmp-articles`의 긴 `content`와 news/press-release의 `text`를 구분했다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | FMP/RTPR live API 호출, 최근 7일 ticker 비교, 원문 URL 길이 비교 결과를 반영 |

#### 사용자 확인 요청

- 현재 반영은 plan에 확인 사실 추가까지다.
- 원하면 다음으로는 이 결과를 기준으로 `press release를 RTPR 유지 / FMP 통합 / 병행 운영` 중 어느 구조가 더 적합한지 결정 항목까지 plan에 추가할 수 있다.

### FMP API skill 문서 생성 (2026-03-20 19:16)

**작성 시각:** 2026-03-20 19:16 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `.github/copilot-skills/fmp_api.md`를 새로 생성했다.
2. 문서에는 FMP API의 주요 data family, 실제 확인된 endpoint, 응답 필드 특성, full text 여부, RTPR와의 차이점을 정리했다.
3. 레포에서 현재 구현된 FMP 사용 지점과, 앞으로 붙일 때 주의할 운영 규칙도 함께 적었다.

#### 문서에 반영한 핵심 내용

- FMP company profile / stock news / general news / press releases / fmp-articles / SEC filings family 요약
- press release/news 계열의 `text`는 full text 전체가 아니라 발췌/요약에 가깝다는 점
- `fmp-articles`의 `content`는 더 긴 본문형 데이터라는 점
- FMP press release와 RTPR는 같은 카테고리지만 동일 데이터셋은 아니며, ticker 매핑과 결과셋이 다를 수 있다는 점
- 최근 7일 `RKLB`, `RCAT` 비교 결과와 ticker mismatch 예시

#### 리스크 / 완화

1. **리스크:** 문서를 읽는 사람이 FMP 모든 endpoint를 현재 레포에서 이미 구현한 것으로 오해할 수 있다.
   - 완화 1: 현재 레포에서 실제 구현된 지점과 live probe로만 확인된 family를 구분해 적었다.
   - 완화 2: SEC filings는 shape 추가 확인 필요라고 명시했다.
2. **리스크:** FMP press release를 RTPR 대체로 단정할 수 있다.
   - 완화 1: 동일 데이터셋이 아님을 별도 섹션으로 분리했다.
   - 완화 2: full text 성격 차이와 ticker 매핑 차이를 함께 적었다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 생성/수정만 수행 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | 이번 대화에서 확보한 FMP/RTPR live probe 결과를 문서 내용에 반영 |

#### 사용자 확인 요청

- 현재 상태는 FMP API skill 문서 생성 완료다.
- 원하면 다음으로는 이 skill 문서를 참조해 실제 FMP news/press release provider 구현에 들어갈 수 있다.

### FMP PR 필터 / recent-custom update / full text plan 재작성 (2026-03-20 19:20)

**작성 시각:** 2026-03-20 19:20 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`를 현재 사용자 요청 기준으로 전면 재작성했다.
2. 범위를 아래 4개로 다시 고정했다.
   - `fmp pr` 필터 버튼
   - `recent fmp pr update`
   - `custom fmp pr update`
   - `fmp pr full text`
3. 현재 코드 구조를 다시 확인한 뒤, `source_type='press_release'`만으로는 FMP PR를 분리할 수 없고 `source='FMP'` 조건이 추가로 필요하다는 점을 plan에 반영했다.
4. FMP press release endpoint의 파라미터를 spot-check해 `from/to/page/limit`는 응답은 오더라도 구현 기준으로 신뢰하지 않는 쪽이 안전하다는 점을 문서에 반영했다.

#### 이번에 plan에 반영한 확인 사실

- 현재 frontend news fetch는 `source_names=FINNHUB,RTPR`만 보내고 있어, FMP row가 DB에 있어도 목록에 보이지 않는다.
- 현재 fulltext update는 `sourceType`만 인자로 받아 `press_release 전체`만 구분 가능하고, provider-aware filter는 없다.
- FMP PR는 DB에서 새 `source_type`를 만들기보다 `source='FMP' AND source_type='press_release'` 조합으로 다루는 것이 현재 구조와 가장 잘 맞는다.
- `press-releases?symbols=AAPL`에 `from/to`, `page`, `limit`를 붙인 spot-check에서는 모두 `200 OK`였지만 첫 샘플이 동일해 보여, custom 범위는 앱에서 다시 date cut 하는 구현이 안전하다.
- FMP PR `text`는 full text 전체가 아니므로 `fmp pr full text`는 기존 원문 extractor 경로로 구현해야 한다.

#### 리스크 / 완화

1. **리스크:** `fmp pr`를 새 sourceType처럼 다루면 기존 `press_release` badge/query 구조와 충돌할 수 있다.
   - 완화 1: 저장값은 그대로 `press_release`를 유지하고, UI/filter/fulltext에서만 `source='FMP'`를 추가 조건으로 쓴다.
   - 완화 2: backend query에는 `source_names` + `source_type` 조합을 사용한다.
2. **리스크:** FMP server-side date filtering을 믿고 custom update를 구현하면 누락/과수집이 생길 수 있다.
   - 완화 1: per-ticker fetch 후 앱에서 `from~to`를 다시 자른다.
   - 완화 2: recent도 `getTickerAnchorMap('press_release', 'FMP')` 기준으로만 증분 처리한다.
3. **리스크:** full text 버튼이 `press_release 전체`를 돌면 Finnhub PR까지 같이 돌아 사용자 요구와 달라진다.
   - 완화 1: repository/service/route에 provider-aware filter 인자를 추가한다.
   - 완화 2: frontend FT 메뉴에 `FMP PR`를 별도 option으로 둔다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | backend/frontend 현재 source/sourceType 구조와 fetch/fulltext 흐름을 재확인 후 plan 반영 |
| 빌드 | ✅ | 코드 변경 없음 |
| 자동 테스트 | ✅ | 코드 변경 없음 |
| 런타임 통합 | ✅ | FMP press release endpoint param spot-check 및 기존 UI/backend route 구조를 기준으로 plan 작성 |

#### 사용자 확인 요청

- 현재 상태는 FMP PR 구현 plan 정리 완료다.
- 다음 단계는 이 plan 기준으로 backend FMP PR route와 frontend 버튼을 실제로 구현하는 것이다.

### FMP PR route / filter / full text 구현 완료 + gui-pyqt 표현 규칙 반영 (2026-03-20 19:41)

**작성 시각:** 2026-03-20 19:41 (local)

**Status: awaiting user confirmation**

#### 작업 요약

1. backend에 FMP press release provider와 전용 pull route를 추가했다.
2. fulltext update가 `source='FMP' AND source_type='press_release'`만 대상으로 돌 수 있게 provider-aware filter를 추가했다.
3. frontend에 `fmp pr` 필터, `Recent FMP PR`, `Custom FMP PR`, `FMP PR Only` full text 메뉴를 추가했다.
4. `.github/copilot-skills/gui-pyqt.md`에 press release 문구는 provider를 명시해서 말하도록 규칙을 추가했다.

#### 변경 파일

- `terminal/backend/src/services/fmpPressReleaseProvider.ts`
- `terminal/backend/src/services/fulltextRepository.ts`
- `terminal/backend/src/services/fulltextUpdateService.ts`
- `terminal/backend/src/server.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `.github/copilot-skills/gui-pyqt.md`
- `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`

#### 구현 핵심 내용

- FMP PR provider는 ticker별 `page`를 순회하면서 응답을 모으고, 앱에서 날짜 범위를 다시 자른다.
- recent FMP PR는 `getTickerAnchorMap('press_release', 'FMP')` 기준으로 증분 수집한다.
- custom FMP PR는 provider server-side date filtering을 신뢰하지 않고 앱에서 `from~to`를 다시 필터한다.
- full text update는 기존 extractor를 재사용하되 `sourceName='FMP'` 필터를 추가해 FMP press release만 대상으로 돌릴 수 있게 했다.
- frontend 기본 목록 fetch는 이제 `FINNHUB,RTPR,FMP`를 포함하고, `fmp pr` 선택 시에는 `source_names=FMP` + `source_type=press_release` 조합으로 조회한다.
- GUI/지침 문구에서는 provider를 구분해서 쓰도록 규칙을 넣었다.
  - FMP 쪽은 기본적으로 `fmp pr` 또는 `fmp press release`
  - RTPR/PTPR 쪽은 `RTPR press release` 또는 `PTPR press release`
  - Finnhub 쪽은 `Finnhub press release`

#### 리스크 / 완화

1. **리스크:** FMP press release ticker 매핑 자체가 noisy하면 최근/커스텀 결과가 기대와 다를 수 있다.
   - 완화 1: source를 `FMP`로 분리 저장해 다른 provider와 섞이지 않게 했다.
   - 완화 2: `fmp pr` 전용 필터를 따로 만들어 UI에서 분리 확인할 수 있게 했다.
2. **리스크:** custom 범위가 아주 길면 ticker별 `page` 순회 비용이 커질 수 있다.
   - 완화 1: provider는 `maxPages` 상한을 둔다.
   - 완화 2: oldest page date가 `from`보다 과거로 내려가면 중단한다.
3. **리스크:** frontend workspace 전체 빌드는 별도 task가 없어 backend build만 확인된 상태다.
   - 완화 1: 변경 파일 기준 editor 에러 검사는 모두 통과했다.
   - 완화 2: 현재 실행 중인 dev UI에서 사용자가 버튼/필터를 바로 눌러 수동 검증할 수 있다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 전체 `get_errors` 기준 문제 없음 |
| 빌드 | ✅ | `npm.cmd run build` 실행, backend build 성공 |
| 자동 테스트 | ✅ | 별도 테스트 추가/실행 없음, 기존 에디터 타입 오류 없음 |
| 런타임 통합 | ✅ | FMP PR endpoint pagination spot-check, route/filter/fulltext 흐름 기준 구현 완료 |

#### 사용자 확인 요청

- 현재 상태는 구현까지 완료된 상태다.
- 사용자는 다음 4가지를 직접 확인하면 된다.
  1. `fmp pr` 필터 클릭 시 FMP press release만 보이는지
  2. `Recent FMP PR` 버튼 클릭 시 별도 job이 시작되는지
  3. `Custom FMP PR`에서 날짜 범위를 넣고 job이 시작되는지
  4. `FMP PR Only` full text가 FMP press release row만 대상으로 도는지

### PLAN CHANGE — FMP PR를 새 source_type으로 승격 (2026-03-20 20:13)

**작성 시각:** 2026-03-20 20:13 (local)

**Status: awaiting user confirmation**

#### 변경 이유

1. 사용자 판단대로, FMP press release는 기존 `press_release` 안의 provider 구분으로 두기보다 새 데이터 타입으로 두는 편이 더 명확하다.
2. RTPR/Finnhub `press_release`와 FMP PR는 데이터 품질/운영 의미가 다르므로, query/filter/fulltext/job을 아예 타입 단위로 분리하는 편이 낫다.

#### 작업 요약

1. FMP PR provider가 저장하는 `source_type`를 `press_release`에서 `fmp_press_release`로 변경했다.
2. FMP PR route의 recent anchor 기준도 `getTickerAnchorMap('fmp_press_release', 'FMP')`로 변경했다.
3. 앱 시작 시 기존 `source='FMP' AND source_type='press_release'` row를 `fmp_press_release`로 보정하는 DB migration SQL을 추가했다.
4. frontend `fmp pr` 필터와 fulltext payload도 이제 실제 `source_type='fmp_press_release'`를 직접 사용하도록 바꿨다.
5. `plan.md`, `.github/copilot-skills/fmp_api.md`를 새 결정 기준으로 동기화했다.

#### 변경 파일

- `terminal/backend/src/services/fmpPressReleaseProvider.ts`
- `terminal/backend/src/server.ts`
- `terminal/backend/src/db.ts`
- `terminal/backend/src/services/fulltextRepository.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/terminal_ui_ver6_fmp/plan.md`
- `.github/copilot-skills/fmp_api.md`

#### 구현 핵심 내용

- 새 FMP PR row는 `source='FMP'`, `source_type='fmp_press_release'`로 저장된다.
- 기존 FMP PR row가 남아 있으면 `(source, url)` unique dedupe 때문에 새 타입 저장이 막힐 수 있으므로, init 시점에 기존 row를 새 타입으로 마이그레이션하게 했다.
- `fmp pr` 필터는 더 이상 `source_names=FMP + source_type=press_release` 조합을 흉내 내지 않고, `source_type=fmp_press_release`를 직접 쓴다.
- full text도 `fmp_press_release`만 골라서 돌 수 있게 정리했다.

#### 리스크 / 완화

1. **리스크:** 기존 FMP row가 마이그레이션되지 않으면 새 타입과 old 타입이 섞일 수 있다.
   - 완화 1: `initDb()`에 보정 SQL을 추가했다.
   - 완화 2: route/provider/frontend를 모두 새 타입 기준으로 맞췄다.
2. **리스크:** frontend에서 `press_release` 필터가 여전히 generic PR 묶음으로 보일 수 있다.
   - 완화 1: `fmp pr`는 완전히 별도 타입으로 분리했다.
   - 완화 2: RTPR는 여전히 별도 버튼/메뉴로 유지한다.
3. **리스크:** 로컬 SQLite 파일 경로가 현재 dev 서버의 실제 경로와 다를 수 있어 row count 직접 확인은 이번 로그에서 생략됐다.
   - 완화 1: 정적 에러, backend build, frontend build, 새 route 응답은 모두 검증했다.
   - 완화 2: 사용자는 dev UI에서 새 타입 필터로 바로 동작 확인이 가능하다.

#### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 전체 `get_errors` 기준 문제 없음 |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 모두 성공 |
| 자동 테스트 | ✅ | 별도 테스트 추가/실행 없음, 에디터 오류 없음 |
| 런타임 통합 | ✅ | `GET /healthz` 확인, `POST /api/news/pull-fmp-press-release` 응답에서 `jobId` 반환 확인 |

#### 사용자 확인 요청

- 현재 상태는 FMP PR를 새 데이터 타입으로 승격한 수정까지 완료된 상태다.
- 사용자는 다음을 확인하면 된다.
  1. `fmp pr` 필터가 실제 새 타입 row만 보여주는지
  2. `Recent FMP PR`, `Custom FMP PR`, `FMP PR Only`가 계속 동작하는지
  3. 기존 generic `Press Release` 및 RTPR 흐름이 깨지지 않았는지

---

## 2026-03-21

### FMP SEC Filing 신규 구현 (2026-03-21 00:50)

**Status: 사용자 확인 대기(awaiting user confirmation)**

#### 작업 배경
- plan.md에서 "비범위"로 분류했던 FMP SEC filing을 사용자가 구현하라고 지시.
- FMP API live probe 결과, `stable/sec-filings-financials` 엔드포인트만 접근 가능.
  - symbol/cik 필터: 미동작 (글로벌 피드만 반환)
  - date 필터(`from`/`to`): 정상 동작

#### 변경 사항

**신규 파일:**
- `terminal/backend/src/services/fmpSecFilingProvider.ts` — provider (fetch, map, retry, dedup)

**수정 파일:**
- `newsRepository.ts` — `insertSecFilingCompanion()` 추가
- `server.ts` — route `POST /api/news/pull-fmp-sec-filing` + Zod schema 추가
- `FinnhubNewsWindow.tsx` — 필터/업데이트/FT 메뉴 18곳 수정

#### 검증

| 검증 계층 | 결과 |
|-----------|------|
| 정적 분석 | ✅ 에러 0 |
| backend build | ✅ |
| frontend build | ✅ |
| 테스트 | ✅ 57/57 |
| 런타임 API | ✅ jobId 반환, 12건 삽입 |
| DB companion | ✅ sec_filings 12건 |

#### 사용자 확인 요청
1. `FMP SEC` 필터 버튼 동작 확인
2. `Recent/Custom FMP SEC Filing` 메뉴 동작 확인
3. `FMP SEC Filing Only` fulltext 버튼 동작 확인
4. 기존 FMP PR / Press Release / RTPR 흐름 비회귀 확인