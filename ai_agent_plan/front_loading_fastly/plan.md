### 목표

프론트에서 데이터 로딩이 느리게 느껴지는 원인을 코드 기준으로 분해하고, 기능 안정성을 크게 해치지 않는 범위에서 체감 속도를 개선하는 실행 계획을 정리한다.

핵심 목표는 아래 3가지다.

1. 느림의 주원인이 frontend 렌더인지 backend 응답인지 분리한다.
2. 기능 리스크가 낮은 최적화부터 적용 순서를 고정한다.
3. 각 단계마다 “속도 개선”과 “기능 유지”를 함께 검증한다.

### 현재 레포 상태(중요, 확인됨)

- 프론트 주력 창은 `FinnhubNewsWindow.tsx`, `DefaultTickerWindow.tsx`, `EvidenceTableWindow.tsx`, `InvestingNewsWindow.tsx`다.
- 체감 로딩 병목의 1순위는 frontend 그리기보다 backend `/api/news`와 `/api/model2/analyses/:analysisId/evidence` 응답 준비 비용이다.
- `GET /api/news`는 `news_change_metrics`를 metric별로 8번 LEFT JOIN하고, 그 뒤 sentiment / peers / market cap / description / ipoDate를 추가 batch query로 더 읽는다.
- `FinnhubNewsWindow.tsx`는 첫 로드 시 북마크 폴더 fetch와 뉴스 fetch를 이어서 수행하고, `limit=500` 기본 페이지를 내려받은 뒤 `mapBackendItem`으로 대형 payload를 다시 가공한다.
- `EvidenceTableWindow.tsx`는 keyword / ticker / from / to를 하나의 useEffect에서 250ms debounce 하긴 하지만, 분석 목록 → case 목록 → evidence rows 순으로 API 호출이 이어져 초기 화면 진입이 느릴 수 있다.
- `DefaultTickerWindow.tsx`는 이미 virtualization과 `useDeferredValue`를 사용해 상대적으로 보수적으로 구현되어 있다.
- 현재 조사 기준으로 “기능상 크게 문제 없이” 먼저 손볼 수 있는 구간은 backend query/index, frontend 초기 fetch waterfall, 불필요한 대형 payload 가공이다.

### 제약 / 비범위

- 이번 계획은 UI 레이아웃 변경이나 기능 제거를 목표로 하지 않는다.
- 검색 의미를 바꾸는 drastic 변경(예: body 검색 완전 제거)은 기본안으로 넣지 않는다.
- provider 수집 로직 자체의 속도 개선은 범위 밖이다. 이번 범위는 “화면이 데이터를 받아서 보여주는 속도”다.
- mock 제거, schema 전면 재설계, 서버 분산/캐시 레이어 신규 도입은 기본안에서 제외한다.

### 읽는 방법(비개발자/일반인 기준)

- Step 0은 “왜 느린지 확인한 근거”다.
- Step 1~2는 가장 안전한 개선안이다. 기능 의미를 거의 건드리지 않는다.
- Step 3은 선택적 추가 최적화다. 앞 단계 효과가 부족할 때만 진행한다.
- 각 Step 끝의 검증 명령/체크를 따라가면, 변경 후 문제가 없는지 직접 확인할 수 있다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

1. Step 하나를 구현한다.
2. 정적 확인 → build/test → 런타임 API/화면 검증을 수행한다.
3. 무엇이 바뀌었는지, 어떻게 확인하는지, 남은 리스크를 채팅에 보고한다.
4. 사용자 확인을 받은 뒤 다음 Step으로 넘어간다.

### 아키텍처(상위)

- 프론트:
  - `FinnhubNewsWindow.tsx`: `/api/news` 기반 메인 뉴스 브라우저
  - `InvestingNewsWindow.tsx`: `/api/news` + `/api/news/pull-investing`
  - `EvidenceTableWindow.tsx`: `/api/model2/analyses*`
  - `DefaultTickerWindow.tsx`: `/api/tickers*`
- 백엔드:
  - `newsRepository.ts`: `/api/news` 응답 조립 핵심
  - `model2AnalysisRepository.ts`: evidence 조회 핵심
  - `db.ts`: SQLite schema / index 생성 지점
- DB:
  - `news_items`
  - `news_change_metrics`
  - `news_sentiment_snapshots`
  - `company_profiles`
  - `model2_analysis_runs`
  - `model2_case_summaries`
  - `model2_evidence_rows`

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 | 이유 |
|---------|------|--------|------|
| D1 | 최적화 우선순위를 backend query/index 먼저 둘지 | backend 먼저 | 현재 병목의 대부분이 `/api/news` 조립 비용으로 보임 |
| D2 | 검색 의미를 바꾸는 변경을 허용할지 | 아니오 | 기능 리스크를 최소화해야 함 |
| D3 | 초기 page size 500을 줄일지 | 보류 | 체감 효과는 크지만 UX 의미가 바뀔 수 있어 후순위 |

### 계획 중간 필수 확인

- `/api/news` 단일 호출 시간이 실제로 개선됐는지 확인해야 한다.
- `FinnhubNewsWindow` 첫 진입 시 “첫 paint 전 대기”가 줄었는지 확인해야 한다.
- evidence table의 filter/search 결과가 이전과 같은 의미로 유지되는지 확인해야 한다.
- fulltext, sentiment, peers, company data 컬럼이 누락되지 않았는지 확인해야 한다.

### 제안하는 구현 순서(이유)

1. backend index/query 최적화
이 단계는 기능 의미를 거의 바꾸지 않으면서 가장 큰 병목을 줄일 가능성이 높다.

2. frontend 초기 로딩 waterfall 축소
같은 데이터를 받아도 화면이 늦게 뜨는 원인을 줄인다.

3. frontend 렌더/상태 최적화
앞 단계 이후에도 남는 체감 지연을 줄이는 보조 단계다.

4. 선택적 payload 축소
효과는 클 수 있지만 기능 의미/UX에 영향이 있을 수 있어 마지막에 판단한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 병목 감사

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | `FinnhubNewsWindow.tsx`, `DefaultTickerWindow.tsx`, `EvidenceTableWindow.tsx`의 초기 fetch 흐름 조사 | ⏳ |
| 0-2 | `newsRepository.ts`, `model2AnalysisRepository.ts`의 SQL/query 병목 조사 | ⏳ |
| 0-3 | 저위험 최적화 후보와 고위험 후보 분리 | ⏳ |

0-1 목적: 느림이 API 대기인지 렌더인지 분리한다.
설명: 주력 창들의 첫 로딩 useEffect, fetch 순서, state 갱신량을 확인하면 체감 지연 위치를 알 수 있다.
완료 조건(눈으로 확인): 병목이 backend 중심인지 frontend 중심인지 한 문장으로 요약 가능해야 한다.
사람 검증(비개발자): 계획 문서의 “현재 레포 상태”만 읽고도 느린 원인이 정리되어 보여야 한다.
흔한 문제/주의: 렌더 최적화만 먼저 하려 들면 실제 주병목을 놓칠 수 있다.

0-2 목적: 가장 비싼 query를 특정한다.
설명: `/api/news`의 다중 LEFT JOIN + 후속 batch query, evidence 검색 query의 문자열 검색 비용을 확인한다.
완료 조건(눈으로 확인): 어떤 endpoint가 비싸고 왜 비싼지 파일 기준으로 설명할 수 있어야 한다.
사람 검증(비개발자): 문서에 `/api/news`와 evidence query가 느린 이유가 적혀 있어야 한다.
흔한 문제/주의: DB schema/index 유무를 안 보고 프론트만 수정하면 효과가 작다.

0-3 목적: 안전한 개선안을 먼저 고르기 위함이다.
설명: index 추가, query 정리, fetch waterfall 감소처럼 의미가 안 바뀌는 작업을 1순위로 둔다.
완료 조건(눈으로 확인): “먼저 할 것 / 나중에 할 것”이 분리돼 있어야 한다.
사람 검증(비개발자): 위험한 기능 변경이 기본안에 섞여 있지 않아야 한다.
흔한 문제/주의: 초기 page size 축소처럼 UX 의미가 바뀌는 안은 마지막으로 미룬다.

검증 훅:

```powershell
rg -n "fetch\(|useEffect\(|setNewsData|nextCursor" termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx
rg -n "LEFT JOIN news_change_metrics|news_sentiment_snapshots|company_profiles cp" terminal/backend/src/services/newsRepository.ts
rg -n "setDebouncedKeyword|setDebouncedTicker|fetch\(`${API_BASE}/api/model2" termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/EvidenceTableWindow.tsx
```

사용자 확인 필요: **예**

#### ⬜ Step 1 — backend query/index 저위험 최적화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `news_change_metrics(news_id, metric_key)` 등 조회형 composite index 추가/점검 | `terminal/backend/src/db.ts` | build + `/api/news` 응답 확인 | ⬜ |
| 1-2 | `/api/news` 후속 enrichment query 수를 줄이거나 batch를 재구성 | `terminal/backend/src/services/newsRepository.ts` | `/api/news` payload 의미 비교 | ⬜ |
| 1-3 | evidence 조회용 filter index 보강 | `terminal/backend/src/db.ts`, `terminal/backend/src/services/model2AnalysisRepository.ts` | evidence 검색/정렬 응답 확인 | ⬜ |

1-1 목적: JOIN lookup 비용을 줄인다.
설명: 같은 `news_id + metric_key` 조회가 반복되므로 composite index가 가장 안전한 첫 단계다.
완료 조건(눈으로 확인): 스키마에 조회형 index가 추가되어 있어야 한다.
사람 검증(비개발자): 화면은 같고 로딩만 빨라져야 한다.
흔한 문제/주의: 기존 index와 중복 이름 충돌을 피해야 한다.

1-2 목적: `/api/news` 한 번 호출당 SQL round trip을 줄인다.
설명: sentiment / peers / market cap / description / ipoDate를 지금보다 덜 비싸게 묶어 읽도록 바꾼다.
완료 조건(눈으로 확인): `/api/news` 호출 코드에서 후속 batch read가 줄거나 단순해져야 한다.
사람 검증(비개발자): 뉴스 표의 peers, market cap, company desc 값이 그대로 보여야 한다.
흔한 문제/주의: null handling이 바뀌면 일부 컬럼이 빈값으로 보일 수 있다.

1-3 목적: evidence table filter/search 정렬 비용을 줄인다.
설명: analysis_id, ticker, case_type, published_at 중심 조회를 index 친화적으로 만든다.
완료 조건(눈으로 확인): evidence 관련 schema/index가 추가되어 있어야 한다.
사람 검증(비개발자): 같은 검색어/정렬에서 결과 의미가 바뀌지 않아야 한다.
흔한 문제/주의: body preview/text 검색 semantics는 그대로 유지해야 한다.

검증 훅:

```powershell
npm.cmd run build
npm.cmd run test
Invoke-RestMethod -Uri "http://localhost:8080/api/news?source_names=FINNHUB,RTPR,FMP&limit=50" | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri "http://localhost:8080/api/model2/analyses" | ConvertTo-Json -Depth 4
```

사용자 확인 필요: **예**

#### ⬜ Step 2 — frontend 초기 로딩 waterfall 축소

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `FinnhubNewsWindow` 초기 로드 시 불필요한 연쇄 fetch/useEffect 정리 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 초기 진입 시 첫 결과 노출 확인 | ⬜ |
| 2-2 | 초기 mount에서 대형 localStorage parse/useEffect 반복을 줄일 수 있는지 정리 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 필터 복원/저장 유지 확인 | ⬜ |
| 2-3 | EvidenceTable 초기 로딩 순서를 점검해 불필요한 재호출을 제거 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/EvidenceTableWindow.tsx` | 분석 목록/케이스/row 로드 확인 | ⬜ |

2-1 목적: 같은 데이터를 더 빨리 화면에 올린다.
설명: 북마크 목록과 뉴스 목록 중 어떤 것이 blocking인지 분리하고, 첫 paint를 늦추는 경로를 줄인다.
완료 조건(눈으로 확인): Finnhub 창 진입 후 표가 더 빨리 채워져야 한다.
사람 검증(비개발자): 창을 열었을 때 빈 화면 대기가 줄어야 한다.
흔한 문제/주의: 북마크 기능이 늦게 초기화되더라도 표 조회는 유지돼야 한다.

2-2 목적: mount cost를 줄인다.
설명: 여러 번의 `JSON.parse(localStorage)`와 상태 복원을 필요한 범위로 줄인다.
완료 조건(눈으로 확인): mount 시 복원 로직이 덜 분산돼 보여야 한다.
사람 검증(비개발자): 재실행 후 필터/컬럼 상태는 계속 복원돼야 한다.
흔한 문제/주의: 저장 키 호환성을 깨뜨리면 기존 사용 상태가 날아갈 수 있다.

2-3 목적: evidence table 첫 진입 체감을 개선한다.
설명: analyses → cases → evidence 호출 흐름에서 중복 호출과 불필요한 loading state 전환을 줄인다.
완료 조건(눈으로 확인): evidence table이 분석 선택 후 덜 버벅여야 한다.
사람 검증(비개발자): 분석 목록, case dropdown, row table이 모두 정상이어야 한다.
흔한 문제/주의: abort/signal handling을 깨뜨리면 race condition이 생길 수 있다.

검증 훅:

```powershell
npm.cmd run build
npm.cmd run test
```

사용자 확인 필요: **예**

#### ⬜ Step 3 — frontend 렌더/상태 보조 최적화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | virtualized row renderer memoization 후보 적용 | `FinnhubNewsWindow.tsx`, `DefaultTickerWindow.tsx` | 스크롤/정렬 시 체감 확인 | ⬜ |
| 3-2 | EvidenceTable filter state debounce를 더 단순한 단일 filter object로 정리 | `EvidenceTableWindow.tsx` | 검색/날짜 필터 동작 확인 | ⬜ |
| 3-3 | 무거운 client-side sort/group 계산 재실행 범위를 축소 | `FinnhubNewsWindow.tsx` | 정렬/스크롤/Load more 확인 | ⬜ |

3-1 목적: 보이는 row만 최소 재렌더되게 한다.
설명: parent state 변경 때 visible row 전체가 다시 그려지는 비용을 줄인다.
완료 조건(눈으로 확인): 정렬/필터/스크롤 시 버벅임이 감소해야 한다.
사람 검증(비개발자): 스크롤 중 끊김이 줄어야 한다.
흔한 문제/주의: memo dependency를 잘못 잡으면 화면이 stale해질 수 있다.

3-2 목적: evidence filter 변경당 fetch 횟수를 줄인다.
설명: keyword/ticker/date를 각각 갱신하기보다 하나의 filter snapshot으로 묶는다.
완료 조건(눈으로 확인): 입력 중 불필요한 로딩 깜빡임이 줄어야 한다.
사람 검증(비개발자): 검색이 되지만 더 덜 버벅이는지 보면 된다.
흔한 문제/주의: 너무 긴 debounce는 오히려 느리게 느껴질 수 있다.

3-3 목적: 이미 받은 데이터의 client-side 가공 비용을 줄인다.
설명: groupedNews, sort, row count 계산이 필요 이상 자주 도는지 줄인다.
완료 조건(눈으로 확인): Load more 이후 멈칫거림이 줄어야 한다.
사람 검증(비개발자): 더 많은 row를 불러와도 표가 빨리 반응해야 한다.
흔한 문제/주의: sort/group semantics가 바뀌면 기존 UX가 달라질 수 있다.

검증 훅:

```powershell
npm.cmd run build
npm.cmd run test
```

사용자 확인 필요: **예**

#### 🚫 Step 4 — 선택적 payload/기능 의미 조정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | 초기 page size 500 → 더 작은 값으로 조정 검토 | `FinnhubNewsWindow.tsx`, `newsRepository.ts` | UX 승인 필요 | 🚫 |
| 4-2 | body 전체 검색을 opt-in으로 바꾸는 방안 검토 | `newsRepository.ts`, 관련 프론트 검색 UI | 검색 의미 비교 | 🚫 |

4-1 목적: payload 크기를 직접 줄인다.
설명: 효과는 크지만 기존 UX의 “처음에 많이 보인다” 의미가 바뀔 수 있다.
완료 조건(눈으로 확인): UX 변경을 사용자가 명시 승인해야 한다.
사람 검증(비개발자): 처음 보이는 row 수가 줄어들 수 있음을 확인해야 한다.
흔한 문제/주의: 기능 문제는 아니어도 사용감 차이가 클 수 있다.

4-2 목적: text search 비용을 크게 줄인다.
설명: 기본 title/keyword 위주 검색으로 두고 body search를 별도 옵션으로 분리하는 안이다.
완료 조건(눈으로 확인): 검색 의미 변경을 사용자가 승인해야 한다.
사람 검증(비개발자): 예전에는 찾히던 body 내부 문장이 기본 검색에서 빠질 수 있음을 이해해야 한다.
흔한 문제/주의: “기능상 크게 문제가 생기면 안 된다” 조건 때문에 기본안으로는 부적합하다.

검증 훅:

```powershell
Write-Output "사용자 UX 승인 전에는 실행하지 않음"
```

사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 내용 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| U1 | 초기 page size를 줄일지 | 유지 / 300 / 200 | Step 4 |
| U2 | body 검색을 기본에서 제외할지 | 유지 / opt-in | Step 4 |

### 실행 의존성 그래프

Legend: `✅ 사용자 확인 후 완료` / `⏳ 구현 또는 조사 완료, 확인 대기` / `⬜ 미착수` / `🚫 차단`

트랙 A — backend 병목 제거

- ⏳ 0-2 `/api/news`, evidence query 병목 조사 완료
- ⬜ 1-1 metrics / evidence index 보강
- ⬜ 1-2 `/api/news` enrichment query 단순화
- ⬜ 1-3 evidence 조회 index/조건 보강

트랙 B — frontend 초기 체감 개선

- ⏳ 0-1 주력 창 fetch 흐름 조사 완료
- ⬜ 2-1 Finnhub 초기 waterfall 축소
- ⬜ 2-2 localStorage/state 복원 비용 정리
- ⬜ 2-3 EvidenceTable 초기 재호출 축소

트랙 C — frontend 렌더 보조 최적화

- ⏳ 0-3 저위험/고위험 후보 분리 완료
- ⬜ 3-1 row renderer memoization
- ⬜ 3-2 filter debounce 단순화
- ⬜ 3-3 sort/group 재계산 범위 축소

차단 구간:

┌────────────────────────────────────────────────────────────┐
│ 🚫 Step 4는 UX/검색 의미 변경 가능성이 있어 사용자 결정이 필요 │
└────────────────────────────────────────────────────────────┘

병렬 트랙 요약

- Track A와 Track B는 병렬 가능하지만, 실제 적용은 backend 먼저가 권장된다.
- Track C는 A/B 이후 남는 체감 지연이 있을 때 들어가는 것이 효율적이다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| U1 초기 page size | 4-1 | 유지 / 300 / 200 |
| U2 body 검색 의미 | 4-2 | 유지 / opt-in |

### 결정 #1 — 추천 시작점(상세)

추천 시작점은 `Step 1 -> Step 2` 순서다.

이유:

1. `/api/news`는 현재 JOIN + 후속 query 구조라, API 자체가 느리면 프론트 최적화만으로 체감 개선이 제한된다.
2. index 추가와 query 단순화는 기능 의미를 거의 바꾸지 않는다.
3. frontend waterfall 축소는 그 다음 체감 개선을 크게 만든다.

### 결정 #2 — 기본적으로 하지 않을 것(상세)

아래는 기본안에서 제외한다.

1. body 검색 기본 제거
2. 첫 페이지 row 수 대폭 축소
3. 컬럼/데이터 제거

이유는 모두 “기능상 크게 문제가 생기면 안 된다” 조건과 충돌할 수 있기 때문이다.