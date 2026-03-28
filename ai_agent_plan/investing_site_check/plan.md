# Investing 사이트 검색/다운로드 가능성 점검 Plan

### 목표
- Investing 사이트에서 `SpaceX IPO`와 `Clarity Act` 관련 뉴스가 사이트 검색으로 실제 잡히는지 확인한다.
- Investing 뉴스 목록/기사 페이지에서 뉴스 데이터를 기술적으로 읽어올 수 있는지 확인한다.
- 단순 기술 가능 여부와 별개로, 저장/재배포/대량 다운로드에 대한 제약 문구가 있는지 확인해 운영 가능성을 판정한다.

### 현재 레포 상태(중요, 확인됨)
- 레포에는 Investing 전용 provider 구현이 아직 없다.
- `.github/copilot-skills/ai-news-research_model1.md`에는 `model_1_2_investing` 규칙이 이미 정리돼 있으며, Investing는 DB canonical source를 대체하는 source가 아니라 외부 이슈 readthrough 점검용 보강 source로 정의돼 있다.
- 2026-03-27 조사 기준, 아래 URL은 실제 HTML 텍스트 추출이 가능했다.
  - `https://www.investing.com/search/?q=SpaceX%20IPO`
  - `https://www.investing.com/search/?q=Clarity%20Act`
  - `https://www.investing.com/news/stock-market-news`
  - `https://www.investing.com/news/cryptocurrency-news`
  - `https://www.investing.com/news/stock-market-news/2`
  - `https://www.investing.com/news/cryptocurrency-news/2`
  - 기사 샘플: `https://www.investing.com/news/cryptocurrency-news/bitcoin-falls-below-70k-amid-uncertainty-over-iran-war-us-regulation-4581487`
- 확인된 핵심 사실:
  - `SpaceX IPO` 검색 결과에서 관련 뉴스와 분석 기사 목록이 노출된다.
  - `Clarity Act` 검색 결과에서 관련 crypto/news 결과가 노출된다.
  - 기사 본문 페이지에서 제목, 작성자, 발행 시각, 본문 소제목/문단이 함께 읽힌다.
  - 카테고리 페이지와 page 2에서도 기사 링크와 시각이 계속 노출된다.
  - 페이지 하단에 `It is prohibited to use, store, reproduce, display, modify, transmit or distribute the data ... without the explicit prior written permission ...` 문구가 노출된다.

### Investing 뉴스 카테고리(확인됨)
- 페이지 Additional Links 기준으로 확인된 Investing 뉴스 카테고리:
  - `stock-market-news`
  - `earnings`
  - `analyst-ratings`
  - `transcripts`
  - `cryptocurrency-news`
  - `commodities-news`
  - `forex-news`
  - `economy`
  - `economic-indicators`
  - `headlines`
  - `pro`
  - `insider-trading-news`
  - `company-news`
  - `investment-ideas`
  - `swot-analysis`
  - `press-releases`
- Analysis 섹션은 별도 뉴스 카테고리가 아니라 `/analysis/...` 경로로 분리되어 노출된다.

### 이번 검색에서 실제 잡힌 카테고리
- `SpaceX IPO`
  - 주 매치 카테고리: `stock-market-news`
  - 보조 매치 경로: `/analysis/...`
  - 확인된 예시:
    - `elon-musks-x-restructures-ahead-of-spacex-ipo--wsj`
    - `trex-files-for-leveraged-spacex-anthropic-etfs-ahead-of-anticipated-ipos`
    - `musk-eyes-30-retail-allocation-for-spacex-ipo`
- `Clarity Act`
  - 직접 기사 매치 카테고리: `cryptocurrency-news`
  - 추가 관련 매치 카테고리: `analyst-ratings`
  - 보조 매치 경로: `/analysis/...`
  - 확인된 예시:
    - `bitcoin-falls-below-70k-amid-uncertainty-over-iran-war-us-regulation`
    - `rosenblatt-cuts-bitgo-stock-price-target-on-market-conditions`
    - `cantor-fitzgerald-cuts-bitgo-stock-price-target-on-lower-revenue-outlook`

### 공개 URL 패턴(확인됨)
- 검색:
  - `https://www.investing.com/search/?q=<query>`
- 뉴스 카테고리 목록:
  - `https://www.investing.com/news/<category>`
- 뉴스 카테고리 페이지네이션:
  - `https://www.investing.com/news/<category>/2`
- 기사 상세:
  - `https://www.investing.com/news/<category>/<slug>-<id>`
- 분석 상세:
  - `https://www.investing.com/analysis/<slug-or-id>`
- 현재까지는 별도 공개 JSON API endpoint는 확인하지 못했고, 확인된 것은 HTML page endpoint들이다.

### 제약 / 비범위
- 이번 plan은 Investing scraping 구현 자체를 포함하지 않는다.
- 로그인 세션 기반 private endpoint, 내부 XHR reverse engineering, anti-bot 우회 코드는 이번 범위에 넣지 않는다.
- 본 작업은 `기술적으로 읽히는가`와 `권한/운영 리스크가 어떤가`를 판정하는 데 한정한다.

### 읽는 방법(비개발자/일반인 기준)
- 먼저 `현재 레포 상태`에서 이미 확인된 사실을 본다.
- 다음으로 `결정/선행조건`에서 실제로 구현해도 되는지 여부를 본다.
- 마지막으로 `단계별 계획`에서 무엇을 추가 확인하거나 보류해야 하는지 본다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 새 사실이 확인되면 `현재 레포 상태`와 해당 Step 상태를 같이 갱신한다.
- 기술 가능 여부와 권한 가능 여부를 분리해 적는다.
- 구현으로 넘어가려면 사용자 확인이 먼저 필요하다.

### 아키텍처(상위)
- 조사 source:
  - Investing 검색 페이지
  - Investing 뉴스 카테고리 목록 페이지
  - Investing 기사 상세 페이지
- 판정 축:
  1. 검색 가능 여부
  2. 목록 페이지 수집 가능 여부
  3. 기사 본문 추출 가능 여부
  4. page navigation 가능 여부
  5. 약관/권한 제약 여부
- 최종 판정:
  - `기술 가능`
  - `운영/법적 제약 있음`
  - `구현 전 사용자 승인 필요`

### 결정/선행조건(초기에 확정 필요)
1. `기술 가능`만 확인하면 되는가, 아니면 실제 자동 수집 구현까지 원하는가?
   - 선택지 A. 이번에는 조사/판정만
   - 선택지 B. 허용 범위 내 prototype 구현 검토
2. Investing 데이터를 local DB에 저장하려는가?
   - 선택지 A. 저장 없이 리서치 참고만
   - 선택지 B. 저장/색인까지 시도
3. 약관상 권한 문구가 있는 경우에도 계속 구현을 시도할지?
   - 선택지 A. 권한 확인 전 구현 보류
   - 선택지 B. 개인 검토용 최소 prototype만 검토

### 계획 중간 필수 확인
- 검색 결과가 query마다 안정적으로 같은 구조를 주는지
- 기사 페이지 본문이 ad/footer를 제외하고 실제 기사 텍스트로 추출되는지
- pagination이 정적 URL 패턴(`/2`, `/3`)로 계속 이어지는지
- 권한 제한 문구가 카테고리/기사 공통으로 보이는지

### 제안하는 구현 순서(이유)
1. 검색 결과 확인
   - 사용자가 궁금해한 `검색이 되는지`를 가장 먼저 닫을 수 있다.
2. 기사/목록 페이지 구조 확인
   - 실제 다운로드 가능성을 기술적으로 빠르게 판정할 수 있다.
3. 권한 문구 확인
   - 기술 가능과 운영 가능을 분리해 결론을 낼 수 있다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — Investing 검색 가능 여부 확인
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `SpaceX IPO` 검색 결과에서 관련 뉴스/분석 결과 노출 확인 | `ai_agent_plan/investing_site_check/plan.md` | 검색 결과 제목/링크 확인 | ⏳ |
| 1-2 | `Clarity Act` 검색 결과에서 관련 뉴스 결과 노출 확인 | `ai_agent_plan/investing_site_check/plan.md` | 검색 결과 제목/링크 확인 | ⏳ |
| 1-3 | 검색 결과 페이지가 query별로 완전히 막히지 않는지 확인 | `ai_agent_plan/investing_site_check/plan.md` | `SpaceX IPO`, `Clarity Act`, `Elon Musk` 비교 | ⏳ |

- `1-1` 목적: 비상장/테마 이슈도 Investing search에서 직접 찾을 수 있는지 확인.
  설명: `SpaceX IPO` 검색 결과에 관련 뉴스/analysis가 보이면 완료.
  완료 조건(눈으로 확인): `SpaceX IPO` 검색 결과에 관련 기사 제목이 보인다.
  사람 검증(비개발자): 검색 URL을 열었을 때 결과 제목이 보이면 된다.
  흔한 문제/주의: 일부 query는 추출기가 실패할 수 있으므로 관련 query(`Elon Musk`)도 같이 본다.
- `1-2` 목적: 정책/규제 이슈가 Investing crypto/news 영역에서 검색되는지 확인.
  설명: `Clarity Act` 검색 결과에 crypto regulation 기사 제목이 보이면 완료.
  완료 조건(눈으로 확인): `Clarity Act` 관련 뉴스 결과가 보인다.
  사람 검증(비개발자): 검색 결과에 관련 crypto 기사 제목이 보이면 된다.
  흔한 문제/주의: exact title match보다 관련 본문/summary hit가 더 중요할 수 있다.
- `1-3` 목적: 검색 결과 구조의 안정성 점검.
  설명: query를 바꿔도 News/Analysis 결과 섹션이 계속 보이면 완료.
  완료 조건(눈으로 확인): 검색 화면에 `News`, `Analysis` 섹션이 유지된다.
  사람 검증(비개발자): 다른 검색어로도 비슷한 결과 레이아웃이 보인다.
  흔한 문제/주의: broad query는 결과 수가 너무 많고, exact query는 추출 실패할 수 있다.

검증 훅:
```text
https://www.investing.com/search/?q=SpaceX%20IPO
https://www.investing.com/search/?q=Clarity%20Act
https://www.investing.com/search/?q=Elon%20Musk
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — 뉴스 목록/기사 본문 다운로드 가능성 확인
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | 뉴스 카테고리 목록 페이지에서 기사 링크/시각 추출 가능 여부 확인 | `ai_agent_plan/investing_site_check/plan.md` | page 1, page 2 기사 목록 확인 | ⏳ |
| 2-2 | 기사 상세 페이지에서 제목/시각/본문 추출 가능 여부 확인 | `ai_agent_plan/investing_site_check/plan.md` | 샘플 기사 본문 확인 | ⏳ |
| 2-3 | pagination 패턴이 bulk 수집에 적합한지 확인 | `ai_agent_plan/investing_site_check/plan.md` | `/2` 페이지 링크 확인 | ⏳ |

- `2-1` 목적: 리스트 단위 인덱싱 가능 여부 확인.
  설명: 카테고리 페이지에서 제목, 링크, 작성 시각이 보이면 완료.
  완료 조건(눈으로 확인): 기사 목록이 여러 건 보인다.
  사람 검증(비개발자): page 1, page 2를 열었을 때 기사 제목이 계속 보인다.
  흔한 문제/주의: 일부 페이지는 footer/ad 비중이 커서 본문 파서가 흔들릴 수 있다.
- `2-2` 목적: 실제 기사 원문 저장 가능성 확인.
  설명: 기사 본문에서 headline, author, published time, body paragraph가 보이면 완료.
  완료 조건(눈으로 확인): 기사 본문 문단이 여러 개 보인다.
  사람 검증(비개발자): 기사 링크를 열었을 때 본문 텍스트가 읽힌다.
  흔한 문제/주의: 일부 기사에 promo/ad section이 섞일 수 있어 clipping 규칙이 필요하다.
- `2-3` 목적: 대량 인덱싱 가능성 확인.
  설명: `/news/<category>/2` 같은 URL에서 다음 페이지가 안정적으로 읽히면 완료.
  완료 조건(눈으로 확인): page 2에서도 기사 목록이 이어진다.
  사람 검증(비개발자): page 1과 page 2 둘 다 기사 제목이 보인다.
  흔한 문제/주의: 페이지 수는 많지만 anti-bot 정책은 별도 고려가 필요하다.

검증 훅:
```text
https://www.investing.com/news/stock-market-news
https://www.investing.com/news/stock-market-news/2
https://www.investing.com/news/cryptocurrency-news
https://www.investing.com/news/cryptocurrency-news/2
https://www.investing.com/news/cryptocurrency-news/bitcoin-falls-below-70k-amid-uncertainty-over-iran-war-us-regulation-4581487
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — 권한/운영 리스크 판정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 페이지 하단의 데이터 사용 제한 문구 확인 | `ai_agent_plan/investing_site_check/plan.md` | 금지 문구 존재 여부 확인 | ⏳ |
| 3-2 | 기술 가능과 운영 가능을 분리해 결론 정리 | `ai_agent_plan/investing_site_check/plan.md` | 결론 문단 확인 | ⏳ |
| 3-3 | 구현 전 필요한 사용자 결정 항목 정리 | `ai_agent_plan/investing_site_check/plan.md` | 미확정 사항 섹션 확인 | ⏳ |

- `3-1` 목적: 법적/운영 리스크를 기술 검증과 분리한다.
  설명: 저장/재배포 금지 문구가 보이면 완료.
  완료 조건(눈으로 확인): `use/store/reproduce/transmit/distribute` 금지 문구가 보인다.
  사람 검증(비개발자): 페이지 footer의 금지 조항을 확인한다.
  흔한 문제/주의: 기술적으로 긁힌다고 바로 저장/배포 가능한 것은 아니다.
- `3-2` 목적: 최종 판정 명확화.
  설명: `기술 가능, 운영 제약 있음`처럼 두 축으로 결론을 적으면 완료.
  완료 조건(눈으로 확인): 결론이 1문장으로 닫혀 있다.
  사람 검증(비개발자): 구현 가능 여부와 사용 가능 여부가 따로 적혀 있다.
  흔한 문제/주의: 기술 가능과 약관 허용을 혼동하면 안 된다.
- `3-3` 목적: 다음 액션 전에 사용자 선택 필요 항목을 정리.
  설명: 권한 확인 전 보류, 개인 리서치용 최소 사용, 구현 중단 중 선택지를 정리하면 완료.
  완료 조건(눈으로 확인): 다음 단계 선택지가 번호로 정리돼 있다.
  사람 검증(비개발자): 어떤 선택을 해야 할지 한눈에 보인다.
  흔한 문제/주의: 대량 수집 구현은 권한 확인 없이 바로 진행하면 리스크가 크다.

검증 훅:
```text
Investing footer usage restriction 문구 확인
결론: 기술 가능 / 운영 제약 있음
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. `결정 #1` 구현 여부
   - 선택지: `조사만 유지` / `허용 범위 prototype` / `구현 보류`
   - 차단 대상 Step: 후속 provider 구현 전부
2. `결정 #2` 데이터 저장 여부
   - 선택지: `채팅/리서치 참고만` / `로컬 임시 캐시` / `정식 DB 저장`
   - 차단 대상 Step: 저장소 설계
3. `결정 #3` 권한 해석
   - 선택지: `명시 권한 전 bulk 금지` / `개인 검토용 최소 fetch만` / `법무/정책 확인 후 진행`
   - 차단 대상 Step: 자동 수집 구현

### 실행 의존성 그래프
Legend: `✅ 사용자 확인 완료` / `⏳ 수행됨, 사용자 확인 대기` / `⬜ 미착수` / `🚫 차단`

Track A — 검색 가능 여부
- ⏳ 1-1 `SpaceX IPO` 검색 결과 확인
- ⏳ 1-2 `Clarity Act` 검색 결과 확인
- ⏳ 1-3 query별 검색 구조 안정성 확인

Track B — 다운로드 가능 여부
- ⏳ 2-1 목록 페이지 링크/시각 추출 확인
- ⏳ 2-2 기사 본문 추출 확인
- ⏳ 2-3 page 2 pagination 확인

Track C — 운영 리스크
- ⏳ 3-1 금지 문구 확인
- ⏳ 3-2 기술 가능 vs 운영 가능 분리 결론
- ⏳ 3-3 후속 구현 전 사용자 결정 항목 정리

┌─ 차단 구간 ─┐
권한/운영 해석이 끝나기 전에는 Investing bulk downloader/provider 구현으로 넘어가지 않는다.
└──────────────┘

병렬 트랙 요약
- Track A와 Track B는 병렬 검증 가능하다.
- Track C는 A/B 결과를 바탕으로 최종 결론을 정리하는 단계다.

차단 요약 테이블
| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 구현 범위 확정 | 후속 provider 구현 | 조사만 / prototype / 보류 |
| 저장 정책 확정 | DB/캐시 설계 | 저장 안 함 / 임시 캐시 / 정식 저장 |
| 권한 해석 확정 | bulk 수집 | 권한 전 보류 / 최소 fetch / 정책 확인 |

### 결정 #1 — 현재 결론(상세)
- 검색 가능 여부: **예**
  - `SpaceX IPO`와 `Clarity Act` 모두 검색 결과가 실제로 노출됐다.
- 기술적 다운로드 가능 여부: **예, 제한적이지만 실질적으로 가능**
  - 뉴스 목록 page 1/page 2에서 기사 링크와 시각이 읽힌다.
  - 기사 상세 페이지에서 제목, 작성자, 시각, 본문 문단이 읽힌다.
- 운영/권한 측면: **제약 큼**
  - 페이지 하단에 데이터의 저장/재생산/전송/배포 금지 문구가 명시돼 있다.
- 따라서 최종 판정은 아래와 같다.
  - `기술적으로는 다운로드 가능`
  - `정식 bulk 수집/저장 구현은 권한 확인 전 보류가 안전`
