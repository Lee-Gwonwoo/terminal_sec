### 모델 분류

#### `Model_200_earning_lists analysis`

목적:

- 사용자가 지정한 특정 기간에 `earnings` 일정이 잡힌 ticker들을 뽑아 **어닝 일정 리스트 + 기업 메타데이터 + software AI 대체 가능성 분류표**로 정리한다.
- 이 모델은 개별 뉴스의 주가 영향 점수를 매기는 모델이 아니라, **어닝 이벤트를 앞둔 종목 universe를 구조적으로 분류하는 screening / research-prep 모델**이다.
- 기본 산출물은 ticker별 표이며, 반드시 `market cap`, `institutional ownership %`, `industry`를 함께 보여준다.
- software 관련 ticker는 별도 4단계 framework로 `AI가 그 위에서 돌아가는 회사인지` 또는 `AI가 그 일을 대신할 수 있는 회사인지`를 분류한다.

### 언제 쓰나

- 사용자가 `model200`, `model200_earning_lists`, `earning lists`, `earnings list`, `어닝 리스트`, `어닝 일정 분류`, `특정 기간 어닝 ticker 정리`처럼 말할 때.
- 특정 시작일과 종료일을 주고, 그 기간 안에 earnings calendar에 들어 있는 ticker들을 표로 정리해야 할 때.
- earnings 일정 종목을 `시총`, `Inst%`, `industry` 기준으로 나눠 보고, software ticker만 AI 대체 위험 tier까지 붙여야 할 때.
- 어닝 발표 전 watch 대상 후보를 고르기 위한 사전 분류가 목적일 때.

### 다른 모델과의 관계

- `Model_200`은 `Model_1`처럼 뉴스 1건의 price impact를 분석하지 않는다.
- `Model_200`은 `Model_2`처럼 뉴스 case taxonomy를 만들지 않는다.
- `Model_200`은 `Model_100`처럼 이슈 바스켓의 확산과 tier를 평가하지 않는다.
- `Model_200` 결과에서 특정 ticker나 산업이 중요해 보이면, 후속으로 `Model_1`, `Model_2`, `Model_100`을 붙일 수 있다. 그러나 이 모델 자체의 1차 목적은 **earnings calendar universe 분류**다.

### 입력 확정 규칙

분석 시작 전에 최소한 아래 2개를 닫는다.

1. `기간`: 시작일과 종료일. 사용자가 날짜만 주면 `YYYY-MM-DD 00:00:00.000Z`부터 `YYYY-MM-DD 23:59:59.999Z`까지로 본다.
2. `대상 범위`: 별도 지시가 없으면 app DB의 `earnings` calendar 전체를 대상으로 한다. 사용자가 watchlist, 특정 ticker list, industry filter를 주면 그 범위를 명시하고 적용한다.

기간이 모호하면 본분석에 들어가지 말고 먼저 확인한다. 예를 들어 `이번 주`, `다음 어닝 시즌`, `5월 중순`처럼 경계가 열린 표현이면 시작일/종료일을 물어본다.

### Source of truth / Locality

- 1차 source of truth는 app runtime DB인 `terminal/backend/backend/data/app.db`다.
- earnings 일정의 canonical source는 `calendar_events`에서 `event_type = 'earnings'`인 row다.
- API로 조회할 수 있으면 우선 backend endpoint를 사용한다.
  - 기본 조회: `GET /api/calendar/events?type=earnings&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500&sort=event_time:asc`
  - CSV export: `GET /api/calendar/events/export.csv?type=earnings&from=YYYY-MM-DD&to=YYYY-MM-DD&sort=event_time:asc`
- API 응답은 `calendar_events.meta_json`과 `securities`, `company_profiles` 메타데이터를 합쳐서 `market_cap`, `institutional_pct`, `industry`, `session`, `time_of_day` 등을 내려준다.
- raw SQL을 직접 사용할 때도 `company_profiles` 단독 조회를 회사당 1개 profile로 해석하지 않는다. `securities`와 JOIN하고, `market_cap`, `institutional_pct`, `description`, `ipo_date`는 최신 non-null row를 field별로 선택한다.
- `institutional_pct`는 현재 운영상 Yahoo holder source의 값을 우선한다. 100%를 넘는 값이 있을 수 있으며, 이를 임의로 100%로 clamp하지 않는다.
- 조회 결과가 비어 있거나 오래된 것으로 보이면, 일정을 만들어내지 말고 `calendar_events`의 최신 적재 상태와 Calendar FMP earnings update 필요 여부를 사용자에게 명시한다.

### 운영적 기간 정의

- 포함 조건은 `from <= event_at <= to`다.
- 사용자가 `2026-05-01 ~ 2026-05-07`처럼 날짜만 주면 포함 범위는 아래처럼 해석한다.
  - 포함: `2026-05-01T00:00:00.000Z` 이후 earnings row
  - 포함: `2026-05-07T23:59:59.999Z` 이전 earnings row
  - 제외: `2026-04-30T23:59:59.999Z` 이전 row
  - 제외: `2026-05-08T00:00:00.000Z` 이후 row
- `event_date`는 `event_at`의 앞 10자리 날짜다.
- `time_of_day` 또는 `session`이 있으면 함께 표시한다. `BMO`, `AMC`, `Unknown`은 서로 다른 발표 타이밍으로 보며 임의로 합치지 않는다.

### 필수 출력 컬럼

최소 표에는 아래 컬럼을 포함한다. Markdown 문서/Preview에서 표로 보여야 하므로 반드시 `| ... |` 형식의 markdown table을 사용한다.

| 컬럼 | 의미 | 데이터 위치 |
| --- | --- | --- |
| `[][][]ticker[][][]` | ticker | `calendar_events.ticker` |
| `[][][]earnings_date[][][]` | 어닝 이벤트 날짜 | `event_at`에서 파생한 `event_date` |
| `[][][]time_of_day[][][]` | 발표 시간대 | `meta_json.time_of_day` 또는 API 응답 |
| `[][][]session[][][]` | BMO/AMC/Unknown 등 세션 | API 응답 또는 `time_of_day`에서 파생 |
| `[][][]company_name[][][]` | 회사명 | `securities.name` 또는 `meta_json.company_name` |
| `[][][]market_cap[][][]` | 시가총액 | `company_profiles.market_cap` 최신 non-null |
| `[][][]institutional_pct[][][]` | 기관 보유율 | `company_profiles.institutional_pct`, Yahoo source 우선 |
| `[][][]industry[][][]` | 산업 분류 | `securities.industry` 우선 |
| `[][][]sector[][][]` | 섹터 | `securities.sector` |
| `[][][]software_scope[][][]` | software 관련 여부 | industry/sector/description 기반 판정 |
| `[][][]software_ai_replacement_tier[][][]` | software AI 대체 가능성 tier | software ticker만 1~4, 비software는 `N/A` |
| `[][][]software_ai_replacement_label[][][]` | tier label | 예: `Tier 1 - AI infra beneficiary` |
| `[][][]tier_rationale[][][]` | tier 판단 근거 | 1~3문장 또는 짧은 요약 |
| `[][][]data_status[][][]` | 누락/주의 메모 | market cap/Inst%/industry 누락 등 |

가능하면 보조 컬럼으로 `[][][]source[][][]`, `[][][]confirmed[][][]`, `[][][]eps_est[][][]`, `[][][]revenue_est[][][]`, `[][][]ipo_date[][][]`, `[][][]market_cap_source[][][]`, `[][][]institutional_source[][][]`를 추가할 수 있다.

### 기본 산출물 구조

결과는 아래 순서를 우선한다.

1. `분석 전제`: 기간, timezone/경계, 대상 범위, 조회 source, 조회 시각.
2. `요약`: 총 earnings ticker 수, software 관련 ticker 수, market cap 누락 수, Inst% 누락 수, industry 누락 수.
3. `전체 earnings list`: 필수 컬럼을 포함한 ticker별 markdown table.
4. `Industry / market cap / Inst% 분포`: 산업별 count, 시총 bucket별 count, Inst% bucket별 count.
5. `Software AI replacement tier`: software 관련 ticker만 별도 표로 재정렬.
6. `데이터 누락 / 검증 메모`: 누락 ticker, stale calendar 가능성, 재조회 필요 항목.

### 정렬 / 버킷 규칙

전체 표의 기본 정렬은 `earnings_date ASC -> session order(BMO, Unknown, AMC) -> market_cap DESC -> ticker ASC`다.

시총 bucket 기본값:

| bucket | 기준 |
| --- | --- |
| Mega | `market_cap >= 200B` |
| Large | `10B <= market_cap < 200B` |
| Mid | `2B <= market_cap < 10B` |
| Small | `300M <= market_cap < 2B` |
| Micro | `market_cap < 300M` |
| Unknown | `market_cap` 없음 |

Inst% bucket 기본값:

| bucket | 기준 |
| --- | --- |
| Very high | `institutional_pct >= 90` |
| High | `60 <= institutional_pct < 90` |
| Medium | `30 <= institutional_pct < 60` |
| Low | `0 <= institutional_pct < 30` |
| Unknown | `institutional_pct` 없음 |

`institutional_pct`가 100%를 넘으면 `Very high`에 넣되, `data_status`에 `Inst% > 100, aggregation artifact 가능`이라고 적는다.

### Software 관련 ticker 판정 규칙

software 관련 여부는 단순히 sector가 `Technology`인지로 끝내지 않는다. 아래 신호를 함께 본다.

- `industry`에 `Software`, `Application Software`, `Infrastructure Software`, `Systems Software`, `SaaS`, `Cloud`, `Cybersecurity`, `FinTech`, `Data`, `Analytics`, `Observability`, `Database`, `DevOps`, `Collaboration`, `HR`, `CRM`, `ERP`, `ITSM` 등 software business model을 가리키는 표현이 있는지 확인한다.
- `description`이 있으면 회사가 실제로 어떤 software layer에서 돈을 버는지 확인한다.
- hardware, semiconductor, biotech, bank, industrial 회사가 software를 일부 제공하더라도 핵심 revenue/business가 software가 아니면 `software_scope = 비소프트웨어 또는 혼합`으로 둔다.
- 애매한 혼합형은 `software_scope = 혼합/확인필요`로 두고 tier를 과감하게 확정하지 않는다.

### Software AI 대체 가능성 4단계 framework

핵심 축은 아래 한 문장이다.

> `AI가 그 위에서 돌아가는가`, 아니면 `AI가 그 일을 대신하는가`.

| Tier | Label | 대체 위험 | 운영적 정의 | 대표 유형 |
| --- | --- | --- | --- | --- |
| 1 | `AI infra beneficiary` | 가장 낮음 | AI workload가 돌아가거나 AI adoption이 증가할수록 더 필요한 data/infrastructure/control plane이다. AI가 이 회사를 대체하기보다 이 회사 위에서 실행된다. | data platform, data warehouse, database, cloud infra, observability, DevOps infra, storage/security infrastructure |
| 2 | `Critical system of record / trust` | 낮음 | 기업 핵심 기록, 규제, 결제, 보안, identity, ERP처럼 mission-critical workflow를 잡고 있어 trust, compliance, switching cost가 높다. | cybersecurity, payment/fintech infra, ERP/core financial system, identity, governance/risk/compliance |
| 3 | `Seat workflow exposed but sticky` | 중간 | CRM, HR, collaboration, productivity처럼 stickiness는 있으나 seat-based workflow가 AI agent/automation으로 일부 압축될 수 있다. | CRM, HR software, collaboration, office productivity, customer support workflow, vertical SaaS |
| 4 | `AI-replaceable thin app` | 높음 | 단일 기능, 템플릿, wrapper, content generation, simple automation처럼 AI가 직접 수행하거나 low-code agent가 쉽게 흡수할 수 있는 software다. | thin AI wrapper, simple no-code automation, template app, content generation single app, lightweight point solution |

판정 원칙:

- Tier 1과 Tier 2는 `AI adoption의 인프라/신뢰 레이어`인지 먼저 본다.
- Tier 3은 제품이 sticky하더라도 seat 수, per-user pricing, repetitive workflow exposure가 큰지 확인한다.
- Tier 4는 회사가 AI를 쓴다는 사실만으로 낮은 위험을 주지 않는다. AI가 핵심 기능을 쉽게 복제하거나 대체할 수 있으면 높은 위험으로 둔다.
- 같은 회사 안에 여러 segment가 있으면 매출 또는 투자 narrative의 핵심 segment 기준으로 판단한다. 매출 비중이 불명확하면 `혼합/확인필요`로 둔다.
- 이 tier는 투자 판단이나 가격 목표가 아니라 **business model의 AI 대체/수혜 구조 분류**다.

### Tier별 판단 예시

| 예시 상황 | 판정 | 이유 |
| --- | --- | --- |
| 데이터 warehouse / database 회사가 enterprise AI data stack의 중심에 있음 | Tier 1 | AI가 실행되려면 데이터 저장, query, governance, pipeline이 필요함 |
| cloud observability / log analytics 회사가 AI infra 모니터링을 제공함 | Tier 1 | AI workload 증가가 telemetry volume과 운영 복잡도를 늘림 |
| endpoint / identity / cloud security 회사 | Tier 2 | AI 도입이 공격면을 넓혀 보안 지출을 줄이기 어렵게 만듦 |
| ERP / core finance system 회사 | Tier 2 | system of record, compliance, workflow lock-in이 강함 |
| CRM / HR / collaboration SaaS 회사 | Tier 3 | sticky하지만 AI agent가 seat 수와 manual workflow를 압축할 수 있음 |
| 단일 content generation app 또는 template automation app | Tier 4 | foundation model / agent platform이 핵심 기능을 직접 대체할 가능성이 높음 |

### 분석 절차

1. **기간 확정**: 사용자가 준 시작/종료 날짜를 `from`, `to`로 정규화한다.
2. **calendar 조회**: `type=earnings`로 기간 내 event를 조회한다. 500개를 넘을 수 있으면 cursor pagination 또는 CSV export를 사용한다.
3. **중복/누락 점검**: 같은 ticker/date/session 중복, ticker null row, `market_cap`, `institutional_pct`, `industry` 누락 수를 센다.
4. **메타데이터 보강**: API 응답에 값이 없으면 app DB의 `securities`, `company_profiles`에서 최신 non-null field를 확인한다.
5. **software scope 판정**: `industry`, `sector`, `description`을 기준으로 software 관련 ticker를 분리한다.
6. **software tier 분류**: software 관련 ticker만 4단계 framework로 tier와 rationale을 붙인다.
7. **표 작성**: 전체 리스트, distribution 표, software tier 표를 markdown table로 작성한다.
8. **검증 메모 작성**: 조회 source, count, missing data, stale 가능성, 추가 update 필요 여부를 남긴다.

### 미완료 판정 규칙

아래 중 하나라도 빠지면 `Model_200` 완료로 보지 않는다.

- 사용자가 지정한 기간이 결과물 상단에 명시되지 않음.
- `earnings` calendar source에서 가져온 ticker 수가 명시되지 않음.
- 전체 ticker 표에 `market_cap`, `institutional_pct`, `industry`가 없음.
- software 관련 ticker의 tier가 1~4 중 무엇인지 또는 비software/N/A인지 구분되지 않음.
- tier rationale이 없고 숫자만 붙어 있음.
- 데이터 누락 row를 조용히 숨김.
- earnings 일정이 비어 있는데도 임의 ticker나 mock 일정을 만들어냄.

### 검증 체크리스트

결과 제출 전 최소한 아래를 확인한다.

| 체크 | 방법 | 통과 기준 |
| --- | --- | --- |
| 기간 경계 | `from <= event_at <= to` 조건 확인 | 시작일 00:00:00.000Z, 종료일 23:59:59.999Z 포함 |
| 이벤트 타입 | `type=earnings` 또는 `event_type='earnings'` 확인 | IPO/dividend/split row가 섞이지 않음 |
| row count | API/SQL count와 출력 표 count 비교 | 누락/중복 이유가 설명됨 |
| 필수 메타 | market cap, Inst%, industry 누락 수 계산 | 누락 ticker가 `data_status`에 표시됨 |
| software tier | software 관련 ticker만 tier 1~4 부여 | 비software는 `N/A`로 유지 |
| source note | API/DB source와 조회 시점 기록 | 사용자가 재현 가능한 endpoint 또는 DB 조건이 보임 |

### 권장 출력 템플릿

```md
# Model_200 earnings list: YYYY-MM-DD ~ YYYY-MM-DD

## 분석 전제
| 항목 | 값 |
| --- | --- |
| 기간 | YYYY-MM-DD 00:00:00.000Z ~ YYYY-MM-DD 23:59:59.999Z |
| 대상 | app DB earnings calendar 전체 |
| source | /api/calendar/events?type=earnings... |
| row count | 000 |

## 요약
| 항목 | 값 |
| --- | --- |
| Earnings ticker 수 | 000 |
| Software 관련 ticker 수 | 000 |
| market_cap 누락 | 000 |
| institutional_pct 누락 | 000 |
| industry 누락 | 000 |

## 전체 earnings list
| Ticker | Earnings Date | Session | Company | Market Cap | Inst% | Industry | Software Scope | AI Tier | Rationale | Data Status |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| ABCD | YYYY-MM-DD | AMC | Example Corp | 12.3B | 74.2 | Application Software | software | Tier 3 | seat workflow exposed but sticky |  |

## Software AI replacement tier
| Tier | Ticker | Industry | Market Cap | Inst% | Rationale |
| --- | --- | --- | ---: | ---: | --- |
| Tier 1 | ABCD | Data Infrastructure | 45.0B | 82.1 | AI workload runs on this data layer |
```

### Glossary

- `earnings list`: 지정 기간에 `calendar_events.event_type = 'earnings'`로 저장된 일정 ticker 목록.
- `event_at`: app DB에 저장된 calendar event timestamp. 기간 필터의 기준이다.
- `session`: earnings 발표 타이밍 구분. 보통 `BMO`, `AMC`, `Unknown`을 사용한다.
- `market_cap`: `company_profiles.market_cap` 최신 non-null 값을 우선 사용한 시가총액.
- `institutional_pct`: 기관 보유율. 현재 운영상 Yahoo holder source 우선이며 100% 초과 가능성을 데이터 품질 메모로 처리한다.
- `software_scope`: ticker가 software business model 분석 대상인지 구분하는 플래그.
- `software_ai_replacement_tier`: software 관련 ticker에만 부여하는 AI 대체/수혜 구조 1~4단계 분류.