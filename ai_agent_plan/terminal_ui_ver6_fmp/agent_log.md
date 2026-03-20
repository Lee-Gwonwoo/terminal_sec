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