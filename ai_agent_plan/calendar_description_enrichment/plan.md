# Calendar 회사 Description 강화 계획

## PLAN CHANGE (2026-05-29) — 전체 description + peer curation을 batch 방식으로 전환

사용자가 `LWLG` 같은 공식 industry와 실제 투자 테마가 어긋나는 ticker까지 포함해 default universe 전체 peer를 다시 정리하라고 요청했고, 이후 peer만 따로 정리하기보다 description 정리와 peer 정리를 industry 우선순위대로 함께 진행하는 편이 효율적이라고 지적했기 때문에, 작업 방식을 아래처럼 확장한다.

- 목표 범위를 default universe 전체 2,278개 ticker로 둔다.
- 한 번에 완료했다고 선언하지 않고, 테마/제품/value-chain batch 단위로 진행한다.
- 각 batch는 `회사 이해 -> enhanced description 작성 -> products/revenue/watch/risk 정리 -> curated peer group 작성 -> company_peer_edges 재생성 -> DB/API 검증 -> 사용자 확인 대기` 순서로 처리한다.
- 다음 batch부터는 industry 우선순위 파일의 순서를 기본 큐로 사용하고, 한 ticker를 볼 때 description과 peer group을 같은 seed entry 안에서 함께 작성한다.
- 진행순서는 [default_ticker_industry_priority.md](default_ticker_industry_priority.md)를 우선한다. Space/Defense queue는 해당 파일 기준 AI/Tech 16개 industry를 처리한 뒤의 2차 큐다. 사용자가 명시적으로 우선순위를 바꾸지 않는 한 Batch 005는 Software - Infrastructure/Application의 남은 상위 ticker를 먼저 진행한다.
- 이미 peer만 먼저 정리한 Batch 001~003도 seed 구조상 description 필드를 같이 보유하지만, 이후 검증 보고에서는 description 품질과 peer 품질을 둘 다 명시한다.
- 진행 현황은 [peer_curation_progress.md](peer_curation_progress.md)에 누적 기록한다.
- `company_profile_enrichment.peer_groups_json`은 단순 ticker 목록뿐 아니라 `grade`, `relationType`, `direction`, `score`, `reason`을 보존할 수 있게 확장한다.
- `industry_override_needed` tag가 있는 ticker는 자동 same-industry / same-sector peer 생성을 건너뛴다. 이는 `LWLG`처럼 provider industry가 실제 peer 축을 왜곡하는 경우를 처리하기 위한 규칙이다.
- Batch 001은 `Optical / photonics / AI data-center interconnect`로 시작한다. 처리 ticker는 `LWLG`, `POET`, `COHR`, `LITE`, `AAOI`, `CIEN`, `FN`, `MTSI`, `IPGP`, `GLW`, `MRVL`, `CRDO`, `AVGO`, `ANET`이다.
- Batch 002는 `AI semiconductor / accelerator / memory / connectivity`로 처리했다. 처리 ticker는 `NVDA`, `AMD`, `AVGO`, `MRVL`, `MU`, `INTC`, `QCOM`, `TXN`, `ADI`, `MPWR`, `NXPI`, `LRCX`, `AMAT`, `KLAC`, `TER`, `ON`, `MCHP`, `GFS`, `ALAB`, `RMBS`, `CRDO`, `LSCC`, `MTSI`이다.
- `full_peer_curation_batch_002` tag가 있는 ticker는 curated peer group을 source of truth로 보며, 자동 same-industry/same-sector peer 생성은 건너뛰고 provider raw peers는 C `weak_provider_candidate`로 낮춘다. 이는 semiconductor라는 넓은 industry 때문에 accelerator, memory, analog, equipment가 모두 B로 섞이는 문제를 막기 위한 규칙이다.
- Batch 003은 `AI server / power / cooling / EMS`로 처리했다. 처리 ticker는 `DELL`, `SMCI`, `HPE`, `VRT`, `CLS`, `JBL`, `FLEX`, `ETN`, `TT`, `NVT`, `HUBB`이다.
- `full_peer_curation_batch_003` tag가 있는 ticker도 curated peer group을 source of truth로 보며, 자동 same-industry/same-sector peer 생성은 건너뛰고 provider raw peers는 C `weak_provider_candidate`로 낮춘다. 이는 server OEM, EMS/ODM, electrical power, thermal/cooling이 broad hardware/industrial bucket에서 섞이는 문제를 막기 위한 규칙이다.
- Batch 004는 `Software / Data / AI Platform`을 description + peer 동시 curation 방식으로 처리했다. 처리 ticker는 `MSFT`, `ORCL`, `PLTR`, `PANW`, `CRWD`, `ADBE`, `NOW`, `FTNT`, `DDOG`, `NET`, `CRWV`, `SNOW`, `MDB`, `ZS`, `AKAM`, `CRM`이다.
- `full_peer_curation_batch_004` tag가 있는 ticker도 curated peer group을 source of truth로 보며, 자동 same-industry/same-sector peer 생성은 건너뛰고 provider raw peers는 C `weak_provider_candidate`로 낮춘다. 이는 broad `Software - Infrastructure`와 `Software - Application` bucket 때문에 cloud platform, data platform, security, observability, edge/CDN, GPU cloud, enterprise applications가 모두 B로 섞이는 문제를 막기 위한 규칙이다.
- Batch 005는 `Software infrastructure/application remainder`를 description + peer 동시 curation 방식으로 처리했다. 처리 ticker는 `SNPS`, `VRSN`, `FFIV`, `DOCN`, `IOT`, `OKTA`, `RBRK`, `CHKP`, `CFLT`, `APP`, `UBER`, `INTU`, `CDNS`, `MSTR`, `ADSK`, `WDAY`, `ZM`이다.
- `full_peer_curation_batch_005` tag가 있는 ticker도 curated peer group을 source of truth로 보며, 자동 same-industry/same-sector peer 생성은 건너뛰고 provider raw peers는 C `weak_provider_candidate`로 낮춘다. 이는 EDA, adtech, mobility marketplace, identity/security, data streaming, design/CAD, bitcoin proxy 같은 서로 다른 software bucket이 broad provider peers로 섞이는 문제를 막기 위한 규칙이다.
- reciprocal direct peer generator는 수동 curated source에 외부 A edge를 역주입하지 않는다. 예를 들어 `ANET -> AVGO` old direct edge가 `AVGO -> ANET` A edge로 강제 생성되지 않게 한다.

### 목표
- Calendar Window와 ticker hover에서 기존 provider 원문 description만 보여주는 수준을 넘어, 사용자가 earnings/IPO/SEC 이벤트를 볼 때 바로 이해할 수 있는 **구체적 사업 설명**을 제공한다.
- 추가 description에는 회사가 실제로 판매하는 상품과 서비스, 사용 고객/사용 사례, 매출이 발생하는 방식, 실적에서 봐야 할 핵심 지표를 포함한다.
- `peers`는 현재 provider가 준 단순 ticker 배열을 그대로 쓰지 않고, `진짜 동종 peer`, `인접/부분 경쟁`, `read-through`, `약한 후보/제외`로 분류한다.
- description과 peers는 같은 회사 이해 단계에서 함께 정리한다. 관련주 목록은 A/B/C 등급과 관계 유형을 가진 별도 curated graph로 관리하되, seed 작성은 description과 같은 entry에서 진행한다.
- 원문 데이터(FMP/Yahoo/Finnhub)는 보존하고, 사람이 검토 가능한 강화 layer를 별도로 둔다.

### 현재 레포 상태(중요, 확인됨)
- `company_profiles`는 source별 다중 row 구조다. 같은 ticker에 `fmp`, `yahoo`, `finnhub` row가 따로 저장된다.
- `terminal/backend/src/services/calendarRepository.ts`는 Calendar row를 만들 때 description, market cap, peers 등을 field별로 최신 non-empty 값에서 가져온다.
- `terminal/backend/src/services/companyProfileRepository.ts`의 `/api/company-profiles/:ticker`용 병합은 description을 field-level로 가져오지만, peers는 현재 대표 row에 붙은 값이 아니면 null이 될 수 있다.
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/companyDescription.ts`의 `CompanyProfileData`에는 강화 description, peer category, source evidence 필드가 없다.
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/CompanyDescriptionHoverPreview.tsx`는 원문 description만 긴 문장으로 보여준다.
- SNOW 로컬 샘플 확인 결과:
  - Yahoo description은 존재하지만 구체 product/service와 실적 체크 포인트가 부족하다.
  - Finnhub peers는 `NET`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD` 등으로 넓게 잡혀 있으며, SNOW의 진짜 사업 비교/AI read-through 구분이 없다.
- SNOW/OKTA peers 대칭성 확인 결과:
  - `SNOW` Finnhub raw peers: `NET`, `SNOW`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`.
  - `OKTA` Finnhub raw peers: `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`, `DOCN`, `FSLY`, `NET`.
  - 두 목록은 cloud/software ticker를 넓게 섞고 자기 자신도 포함한다. `SNOW`와 `OKTA`가 서로 가까운 core peer처럼 보일 수 있지만 실제로는 데이터 플랫폼과 identity/security 플랫폼이라 관련 등급을 낮게 잡아야 한다.
  - provider raw peers는 방향성/대칭성/관련 강도를 보장하지 않으므로 source of truth로 사용하지 않는다.
- default ticker universe 확인 결과:
  - DB 기준 `ticker_universes.name = default`가 존재하며, 전체 2,278개 ticker가 들어 있다.
  - source path는 `tradigview_screener/original_data/watch lists2_2026-02-22.csv`다.
  - 최신 non-null `company_profiles.market_cap` 기준 market cap coverage는 2,276/2,278개다.
  - 전체 141개 industry를 [default_ticker_industry_priority.md](default_ticker_industry_priority.md)에 AI/tech 관련 industry 우선순위와 industry 내부 시총순으로 정리했다.
- peer graph 1차 구현 결과:
  - `company_peer_edges` 테이블을 추가하고, `default_universe_baseline/v1` source/version으로 default universe 2,278개 ticker의 curated peer edge를 생성했다.
  - 생성 결과는 edge 27,985개, visible peer coverage 2,276/2,278개, 등급 분포 `A=782`, `B=20,830`, `C=4,846`, `EXCLUDE=1,527`이다.
  - broad industry만 같은 경우는 A로 올리지 않고 기본 B로 둔다. provider raw peers가 broad software/cloud 후보를 섞은 경우에는 C 또는 B 이하로 남긴다.
  - SNOW -> OKTA는 `C / weak_provider_candidate`로 확인했고, SNOW의 curated core data platform peer는 `MDB`, `ORCL`, `TDC`가 A로 표시된다.

### 제약 / 비범위
- provider 원문 description을 덮어쓰지 않는다. 강화 description은 별도 필드/테이블에 저장한다.
- 사용자가 명시적으로 요청하지 않는 한 mock 데이터는 만들지 않는다.
- 초기 plan 작성 단계에서는 코드 수정을 하지 않았지만, 2026-05-29 후속 요청에 따라 backend/frontend pilot 구현과 peer graph 1차 seed를 진행했다.
- AI가 생성한 설명은 원문 source와 구분되어야 하며, `generated_at`, `version`, `confidence`, `sources_json` 같은 감사 정보를 남기는 방향으로 설계한다.
- peers는 투자 판단 확정 목록이 아니라 Calendar에서 빠르게 맥락을 잡기 위한 research aid로 표시한다.
- raw `company_profiles.peers_json`은 삭제하지 않고 provider 후보/evidence로만 보존한다. 사용자 화면과 관련주 정리에는 curated peer graph를 우선 사용한다.

### 읽는 방법(비개발자/일반인 기준)
- `Step 0`은 현재 데이터가 왜 부족한지 확인하는 단계다.
- `Step 1`은 어떤 형식으로 좋은 description을 저장할지 정하는 단계다.
- `Step 2`는 SNOW 같은 예시를 기준으로 실제 문장 품질을 정하는 단계다.
- `Step 3`은 backend/API에 강화 description과 peer 분류를 붙이는 단계다.
- `Step 4`는 Calendar Window/hover UI에서 짧고 읽기 좋은 형태로 보여주는 단계다.
- 상태 표시는 `⬜` 미착수, `⏳` 구현/작성 완료 후 사용자 확인 대기, `✅` 사용자 확인 완료, `🚫` 차단을 뜻한다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- plan 변경이 필요하면 `PLAN CHANGE` 노트를 `agent_log.md` 맨 아래에 추가하고, `plan.md`의 해당 Step을 수정한다.
- 각 Step은 구현 또는 작성 후 검증 결과를 채팅에 보고한다.
- 사용자가 해당 Step 결과를 명시적으로 확인하기 전까지 상태는 `⏳`로 유지한다.
- 사용자가 확인하면 `agent_log.md`에 `사용자 확인 후 완료`로 기록한다.

### 아키텍처(상위)

```text
Raw provider layer
  - company_profiles.source = fmp/yahoo/finnhub
  - 원문 description, raw_json, peers_json 보존
        |
        v
Peer graph layer
  - company_peer_edges 또는 동등 구조
  - ticker -> related_ticker edge 단위 저장
  - grade = A/B/C, relation_type, direction, symmetry_group, reason, evidence
        |
        v
Enrichment layer
  - company_profile_enrichment 또는 동등 구조
  - business_summary_ko
  - products_services_json
  - revenue_model_ko
  - earnings_watch_points_json
  - peer_groups_json
  - sources_json / generated_at / version / confidence
        |
        v
Backend API
  - /api/company-profiles/:ticker 응답에 raw + enrichment 병합
  - Calendar metadata 조회에 enrichment 요약/peer groups 추가
        |
        v
Frontend UI
  - Calendar peers column: 분류 chip 표시
  - hover popup: 짧은 강화 설명 + raw source 접기/펼치기
```

### 결정/선행조건(초기에 확정 필요)
- 강화 description 저장 위치:
  - 선택 A: 새 테이블 `company_profile_enrichment` 생성.
  - 선택 B: `company_profiles`에 enrichment 컬럼 추가.
  - 권장: 선택 A. provider 원문과 AI/curated 결과를 분리할 수 있다.
  - 2026-05-29 pilot 선택: 선택 A를 적용했다. `security_id` unique 기준으로 ticker당 enrichment row를 1개만 둔다.
- 생성 범위:
  - 선택 A: Calendar에 현재 로드된 ticker만 즉시 생성.
  - 선택 B: default universe 전체 batch 생성.
  - 선택 C: default universe 전체를 대상으로 하되, AI/tech 관련 industry 16개를 먼저 처리하고 나머지는 후순위 batch로 처리.
  - 권장: 선택 C. 사용자가 요청한 전체 default ticker 정리를 유지하면서도, SNOW/DELL/HPE/SMCI 같은 AI/tech 설명 품질을 먼저 끌어올릴 수 있다.
  - 2026-05-29 pilot 선택: 선택 C의 첫 실행으로 AI/data-center 핵심 12개 ticker를 seed했다.
- peers 표시 방식:
  - 선택 A: 기존 단일 배열 유지.
  - 선택 B: category별 JSON으로 분리.
  - 권장: 선택 B. provider peers 오류를 사람이 이해할 수 있게 보여준다.
- peers source of truth:
  - 선택 A: `company_profiles.peers_json` raw 배열을 그대로 사용.
  - 선택 B: `company_profile_enrichment.peer_groups_json`에 ticker별 curated peers를 저장.
  - 선택 C: 별도 `company_peer_edges` graph를 만들고, API/UI는 graph를 우선 사용한다.
  - 권장: 선택 C. 전면 정리, A/B/C 등급, 대칭성 검증, 관계 유형별 필터링이 가능하다.

#### Peer 등급 기준(초안)

| 등급 | 의미 | 예시 판단 기준 | UI/관련주 사용 |
|------|------|----------------|----------------|
| A | 직접 동종/핵심 peer | 같은 제품 카테고리, 같은 구매자 예산, 실적 driver가 직접 비교됨 | 관련주 핵심 묶음, 비교 table 우선 |
| B | 인접 경쟁/플랫폼 경쟁/read-through | 제품은 다르지만 같은 workload, 고객, capex cycle, 공급망에 묶임 | 보조 관련주, thematic basket |
| C | 약한 후보/감사용 후보 | provider raw에는 있으나 사업 직접성 낮음, broad software/cloud 묶음 | 기본 화면에서는 낮은 우선순위 또는 접힘 |
| EXCLUDE | 제외 | 자기 자신, ETF/중복 class, 사업 관련성 낮음, 데이터 오류 | raw evidence에는 남기되 curated peers에서는 제외 |

관계 유형은 최소 `direct_competitor`, `adjacent_competitor`, `customer_supplier`, `infrastructure_read_through`, `platform_overlap`, `theme_overlap`, `weak_provider_candidate`, `excluded_self`로 둔다.

### 계획 중간 필수 확인
- SNOW, DELL, HPE, SMCI처럼 이미 문제를 확인한 ticker 3~5개로 샘플을 먼저 만든다.
- 각 샘플에서 `구체 상품/서비스`, `매출 발생 방식`, `실적 체크 포인트`, `peer 분류`가 빠짐없이 들어갔는지 확인한다.
- provider peers가 이상한 경우에도 숨기지 말고 `약한 후보/제외`로 남겨 감사 가능하게 한다.
- peers 전면 정리에서는 provider raw peers를 시작 후보로만 사용한다. 최종 관련주는 industry, product/service, customer/workload, revenue driver, supply-chain/read-through 관계를 근거로 A/B/C 등급을 부여한다.
- 대칭성 규칙: A등급 direct peer는 기본적으로 양방향 edge를 만든다. B/C등급 read-through 또는 theme overlap은 방향성이 있을 수 있으므로 `direction`과 `reason`을 명시한다.
- default universe 전체 ticker는 [default_ticker_industry_priority.md](default_ticker_industry_priority.md)를 기준 작업 큐로 사용한다.
- 먼저 추가 작성할 industry는 AI/tech 우선순위 16개이며, 각 industry 내부는 market cap 내림차순으로 처리한다.
- AI/tech 다음 2차 큐는 우주/방산이다. 공식 industry 전체 처리 대상은 `Aerospace & Defense` 70개이고, 위성통신/우주 하드웨어/방산 IT처럼 다른 tech industry 안에 섞인 종목은 subset tag로 별도 선별한다.
- `LWLG`는 현재 default universe 안에 있지만, 공식 분류는 `Basic Materials / Chemicals - Specialty`다. photonics/AI interconnect cross-theme 후보로 별도 tag를 줄 수는 있지만, 현 industry 기준으로 AI/tech 1차나 우주/방산 2차 core에는 자동 포함되지 않는다.
- 중복 ticker 처리 원칙: 같은 ticker가 여러 industry/subset에 걸리더라도 `security_id` 기준 enrichment row는 1개만 둔다. 이미 강화 description이 있으면 description을 다시 작성하지 않고, 새 theme가 필요할 때만 `tags_json` 또는 동등한 category를 보강한다.

#### Default ticker industry 작성 큐(2026-05-29 추가)

상세 전체 목록: [default_ticker_industry_priority.md](default_ticker_industry_priority.md)

| 우선순위 | Industry | 전체 ticker 수 | 먼저 볼 top tickers by market cap |
|----------|----------|----------------|-----------------------------------|
| 1 | Semiconductors | 80 | NVDA, AVGO, MU, AMD, INTC, LRCX, AMAT, TXN, KLAC, QCOM, ADI, MRVL, MPWR, NXPI, TER |
| 2 | Hardware, Equipment & Parts | 55 | SNDK, GLW, APH, TEL, KEYS, COHR, FLEX, GRMN, CLS, JBL, TDY, FN, MKSI, FTV, TTMI |
| 3 | Computer Hardware | 29 | STX, ANET, WDC, DELL, P, NTAP, PSTG, IONQ, SMCI, HPQ, LOGI, QBTS, RGTI, INFQ, QUBT |
| 4 | Communication Equipment | 43 | CSCO, CIEN, LITE, MSI, UI, HPE, SATS, CRDO, ASTS, VIAV, ZBRA, VSAT, PI, ONDS, BDC |
| 5 | Software - Infrastructure | 91 | MSFT, ORCL, PLTR, PANW, CRWD, SNPS, ADBE, FTNT, NET, CRWV, VRSN, MDB, ZS, AKAM, FFIV |
| 6 | Software - Application | 146 | APP, CRM, UBER, INTU, CDNS, NOW, DDOG, MSTR, SNOW, ADSK, WDAY, ZM, TEAM, PTC, SSNC |
| 7 | Internet Content & Information | 36 | GOOGL, GOOG, META, SPOT, DASH, NBIS, RDDT, TWLO, PINS, ZG, Z, SNAP, MTCH, IAC, NN |
| 8 | Information Technology Services | 48 | IBM, ACN, CTSH, FIS, BR, LDOS, AUR, GIB, CDW, APLD, CACI, JKHY, IT, INGM, DLB |
| 9 | Consumer Electronics | 6 | AAPL, NXT, SONO, VUZI, TBCH, GPRO |
| 10 | Electronic Components | 2 | KULR, ELTK |
| 11 | Electronic Gaming & Multimedia | 11 | EA, TTWO, RBLX, MGRT, PLTK, GDEV, CTW, MRDN, SKLZ, GMHS, DKI |
| 12 | Scientific & Technical Instruments | 4 | ARBE, GNSS, ODYS, SOTK |
| 13 | Financial - Data & Stock Exchanges | 4 | CME, ICE, COIN, NDAQ |
| 14 | Telecommunications Services | 37 | TMUS, VZ, T, CMCSA, BCE, TU, RCI, CHTR, TIGO, GSAT, LUMN, LBTYB, LBRDK, LBRDA, TDS |
| 15 | Telecom Services | 2 | RDCM, FNGR |
| 16 | Electrical Equipment & Parts | 30 | VRT, BE, NVT, HUBB, AEIS, POWL, FPS, AYI, ENS, PLUG, AMPX, ATKR, EOSE, PLPC, ENVX |

위 16개 AI/tech 우선 industry 합계는 624개 ticker다. 다음 실행에서는 이 624개를 먼저 대상으로 삼고, 각 industry 내부에서는 상세 파일에 적힌 market cap 순서를 그대로 따른다.

#### 2차 Space/Defense industry 작성 큐(2026-05-29 추가)

상세 전체 목록 및 LWLG 위치 확인: [default_ticker_industry_priority.md](default_ticker_industry_priority.md)

| 2차 우선순위 | 구분 | Industry / subset | 범위 | 먼저 볼 top tickers by market cap | 비고 |
|--------------|------|-------------------|------|-----------------------------------|------|
| 17 | Core aerospace/defense | Aerospace & Defense | 70 tickers | GE, RTX, BA, LMT, GD, NOC, RKLB, TDG, LHX, HEI, ESLT, AXON, CW, WWD, BWXT | AI/tech 다음 2차 핵심 industry |
| 18 | Satellite/space communications | Communication Equipment subset | industry 43개 중 선별 | SATS, ASTS, VSAT, YSS, GILT, TSAT, ONDS, VIAV | 전체 industry는 AI/tech #4와 중복. 우주/위성/방산 통신 후보만 tag |
| 19 | Space hardware/electronics | Hardware, Equipment & Parts subset | industry 55개 중 선별 | MDA, BKSY, SATL, OSIS, TDY, KEYS, MKSI | 우주 장비, 광학/계측, 위성 부품 후보 |
| 20 | Defense IT / systems integrators | Information Technology Services subset | industry 48개 중 선별 | LDOS, CACI, SAIC, BBAI, TLS, TSSI | 방산 IT, government contractor, mission system 후보 |
| 21 | Drone/robotics/quantum dual-use | Computer Hardware subset | industry 29개 중 선별 | IONQ, QBTS, RGTI, RCAT, UAVS, INFQ, QUBT | quantum/drone/edge hardware 후보. 직접 방산 여부는 개별 검증 필요 |
| 22 | Sensors/radar/instruments | Scientific & Technical Instruments subset | 4 tickers | ARBE, GNSS, ODYS, SOTK | 센서/계측/상황인식 관련 후보 |
| 23 | Aerospace components outside core industry | Industrial - Machinery subset | industry 68개 중 선별 | HWM | 공식 industry가 Aerospace & Defense가 아니지만 항공/우주 부품 exposure가 큰 후보 |

2차 실행에서는 `Aerospace & Defense` 70개를 먼저 전체 작성하고, 그 다음 subset 후보는 company description/source 확인으로 우주/방산 관련도가 높은 ticker만 선별한다. subset 후보는 기존 AI/tech 1차 큐와 중복될 수 있으므로 중복 생성하지 않고 기존 enrichment에 `space_defense_tag` 또는 동등한 category를 추가하는 방식이 좋다.

### 제안하는 구현 순서(이유)
1. 먼저 데이터 품질과 샘플 포맷을 확정한다. 문장 구조가 확정되지 않으면 DB/API/UI를 먼저 만들어도 다시 바뀔 가능성이 높다.
2. 저장 layer를 원문과 분리한다. provider 데이터와 AI 요약을 섞으면 나중에 출처/품질 검증이 어렵다.
3. API 병합을 만든 뒤 UI를 바꾼다. UI가 먼저 바뀌면 실제 데이터가 없어 빈 화면이 늘어난다.
4. batch 생성은 마지막에 하되, 대상 순서는 먼저 정리한다. 현재 기준은 default universe 2,278개 전체를 작업 큐로 두고, AI/tech 관련 16개 industry 624개를 1차 batch로 처리한 뒤 `Aerospace & Defense` 70개와 우주/방산 관련 subset을 2차 batch로 처리하는 것이다.

### 단계별 계획(각 단계: 구현 → 검증)

> PLAN CHANGE 2026-05-29: 사용자가 AI부터 실행하라고 지시했으므로, 전체 624개 batch 전 단계로 `company_profile_enrichment` 저장 구조와 AI/tech pilot seed batch를 먼저 구현했다. 중복 ticker는 description 재작성 없이 tag만 병합하는 원칙을 적용했다.

> PLAN CHANGE 2026-05-29: 사용자가 raw peers 정확도 문제와 SNOW/OKTA 대칭성 문제를 지적했으므로, description 대량 작성 전에 peers 전면 정리를 선행 작업으로 둔다. 기존 provider peers는 raw evidence로 보존하고, curated `company_peer_edges` graph에 A/B/C 등급과 관계 유형을 저장하는 방향으로 변경한다.

> PLAN CHANGE 2026-05-29: 사용자가 “현재 default ticker peers 데이터를 전부 다시 정리하고 Calendar Window column에 추가”하라고 요청했으므로, 사람이 검수한 최종 목록이 아니라 `default_universe_baseline/v1` 1차 deterministic graph를 먼저 생성했다. Calendar API와 Calendar Window에는 raw `peers`와 별도인 `curated_peers` column을 추가했다.

#### ⏳ Step 0 — 요구사항/샘플 포맷 확정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | 현재 SNOW description/peers 데이터 부족 지점을 확인한다 | 없음 | DB에서 SNOW source별 row 확인 | ⏳ |
| 0-2 | 강화 description에 들어갈 필수 항목을 정의한다 | `ai_agent_plan/calendar_description_enrichment/plan.md` | plan 문서에 필수 항목 목록 존재 | ⏳ |
| 0-3 | SNOW 예시를 구체 상품/서비스와 peer 분류 기준으로 작성한다 | `ai_agent_plan/calendar_description_enrichment/snow_description_sample.md` | 샘플 문서에 상품/서비스 예시와 peer category 존재 | ⏳ |
| 0-4 | default universe 전체를 industry별/AI-tech 우선순위/시총순으로 정리한다 | `ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md` | 전체 2,278개, 141개 industry, market cap coverage 2,276개 확인 | ⏳ |
| 0-5 | AI/tech 다음 2차 우주/방산 industry/subset 큐와 LWLG 위치를 정리한다 | `ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md`, `ai_agent_plan/calendar_description_enrichment/plan.md` | LWLG industry 확인, Space/Defense 우선 큐 존재 확인 | ⏳ |

- 0-1 목적: 현재 provider description과 peers의 한계를 눈으로 확인한다.
  - 설명: SNOW의 Yahoo description, Finnhub peers를 확인해 왜 강화 layer가 필요한지 기록한다.
  - 완료 조건(눈으로 확인): plan에 SNOW 현재 데이터 요약이 적혀 있다.
  - 사람 검증(비개발자): plan의 `현재 레포 상태` 섹션에서 SNOW 문제 요약을 읽는다.
  - 흔한 문제/주의: provider peers가 모두 틀린 것은 아니며, 일부는 read-through나 adjacent로 남길 수 있다.
- 0-2 목적: 앞으로 생성될 description의 품질 기준을 고정한다.
  - 설명: `무엇을 파는지`, `누가 쓰는지`, `돈을 어떻게 버는지`, `실적에서 뭘 봐야 하는지`를 필수 항목으로 둔다.
  - 완료 조건(눈으로 확인): 목표/아키텍처/샘플 문서에 동일한 필드명이 반복해서 나타난다.
  - 사람 검증(비개발자): SNOW 예시를 보고 다른 회사에도 같은 형식으로 쓸 수 있는지 판단한다.
  - 흔한 문제/주의: 문장이 길기만 하고 상품/서비스 예시가 없으면 실패다.
- 0-3 목적: 실제 UI에 들어갈 수준의 예시를 만든다.
  - 설명: SNOW를 기준으로 상세 버전과 짧은 UI 버전을 함께 작성한다.
  - 완료 조건(눈으로 확인): `snow_description_sample.md`에 `상세 description`, `짧은 UI 버전`, `peer 재분류`가 있다.
  - 사람 검증(비개발자): SNOW가 무엇을 팔고 어떤 숫자로 움직이는지 문서만 보고 설명할 수 있다.
  - 흔한 문제/주의: `AI 수혜`라는 말만 있고 Cortex/Snowpark/Streamlit 같은 구체 제품이 빠지면 부족하다.
- 0-4 목적: 다음 실행에서 어떤 industry/ticker부터 description을 추가 작성할지 결정한다.
  - 설명: DB default universe 전체 ticker를 industry별로 묶고, AI/tech 관련 industry를 먼저 배치한 뒤 각 industry 내부를 market cap 내림차순으로 정렬한다.
  - 완료 조건(눈으로 확인): `default_ticker_industry_priority.md`에 141개 industry 요약과 industry별 전체 ticker 목록이 있다.
  - 사람 검증(비개발자): plan의 `Default ticker industry 작성 큐`와 상세 파일을 보고 먼저 처리할 industry와 ticker 순서를 알 수 있다.
  - 흔한 문제/주의: 전체 default universe는 2,278개로 크기 때문에 plan 본문에는 요약을 두고, 전체 ticker는 상세 파일에서 관리한다.
- 0-5 목적: AI/tech 다음에 실행할 우주/방산 설명 작성 큐를 분리한다.
  - 설명: `Aerospace & Defense`를 2차 core industry로 두고, 위성통신/우주 하드웨어/방산 IT/드론/센서 후보는 기존 industry 안의 subset으로 tag한다.
  - 완료 조건(눈으로 확인): plan과 상세 inventory에 `Space/Defense 우선 Industry 순서`가 있고, `LWLG`가 `Chemicals - Specialty`로 확인되어 있다.
  - 사람 검증(비개발자): AI/tech 다음에 어떤 우주/방산 industry와 ticker를 볼지 표로 확인할 수 있다.
  - 흔한 문제/주의: `Communication Equipment`, `Hardware, Equipment & Parts` 등은 AI/tech와 중복되므로, 중복 생성 대신 추가 tag만 붙이는 방식이 필요하다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec"
Test-Path ai_agent_plan/calendar_description_enrichment/plan.md
Test-Path ai_agent_plan/calendar_description_enrichment/snow_description_sample.md
Test-Path ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md
Select-String -Path ai_agent_plan/calendar_description_enrichment/snow_description_sample.md -Pattern "Cortex|Snowpark|Streamlit|peer|product revenue"
Select-String -Path ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md -Pattern "전체 ticker 수: 2,278개|Semiconductors|Software - Application|Industry별 전체 Ticker 목록"
Select-String -Path ai_agent_plan/calendar_description_enrichment/default_ticker_industry_priority.md -Pattern "Space/Defense 우선 Industry 순서|Aerospace & Defense|LWLG|Chemicals - Specialty"
```
사용자 확인 필요: **예**

#### ⏳ Step 1 — Enrichment 저장 구조 설계

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `company_profile_enrichment` 스키마 초안을 확정한다 | `terminal/backend/src/db.ts` | DB migration 후 PRAGMA table_info 확인 | ⏳ |
| 1-2 | enrichment repository 인터페이스를 설계한다 | `terminal/backend/src/services/companyProfileEnrichmentRepository.ts` | TypeScript 정적 분석 | ⏳ |
| 1-3 | peer category JSON schema를 정의한다 | `terminal/backend/src/services/companyProfileEnrichmentRepository.ts` | 샘플 JSON parse 테스트 | ⏳ |
| 1-4 | A/B/C 등급형 peer edge graph 스키마를 설계한다 | `terminal/backend/src/db.ts`, `terminal/backend/src/services/companyPeerRepository.ts` | SNOW/OKTA edge 예시로 대칭성/등급 확인 | ⏳ |

- 1-1 목적: 원문 provider 데이터와 AI/curated 결과를 분리한다.
  - 설명: ticker별로 강화 description, peer groups, source evidence, version을 저장한다.
  - 완료 조건(눈으로 확인): DB에 enrichment 전용 테이블이 존재한다.
  - 사람 검증(비개발자): 원문 description을 덮어쓰지 않는 구조라는 설명을 확인한다.
  - 흔한 문제/주의: `company_profiles.description`을 직접 덮어쓰면 출처가 섞인다.
- 1-2 목적: backend에서 enrichment를 안전하게 읽고 쓴다.
  - 설명: upsert/get 함수를 만들고 ticker join 기준을 명확히 한다.
  - 완료 조건(눈으로 확인): repository 파일에 get/upsert 함수가 있다.
  - 사람 검증(비개발자): API 조회 시 같은 ticker의 강화 설명이 반환되는지 확인한다.
  - 흔한 문제/주의: source별 다중 row 구조를 무시하면 잘못된 ticker에 붙을 수 있다.
- 1-3 목적: peers를 단순 배열이 아니라 의미 있는 그룹으로 만든다.
  - 설명: `core_same_business`, `adjacent_competitor`, `platform_partner_competitor`, `read_through`, `weak_or_excluded`를 기본 category로 둔다.
  - 완료 조건(눈으로 확인): SNOW 같은 샘플 peer JSON이 category별로 나뉜다.
  - 사람 검증(비개발자): AAPL 같은 약한 후보가 핵심 peer로 보이지 않는지 확인한다.
  - 흔한 문제/주의: Databricks처럼 비상장 peer를 UI에서 어떻게 표시할지 결정이 필요하다.
- 1-4 목적: 전체 default universe의 관련주를 전면 정리할 수 있는 graph 구조를 만든다.
  - 설명: `ticker`, `related_ticker`, `grade`, `relation_type`, `direction`, `reason`, `evidence_json`, `source`, `version`을 edge 단위로 저장한다.
  - 완료 조건(눈으로 확인): SNOW -> MDB는 A/B 후보로, SNOW -> OKTA는 C 또는 weak/provider 후보로 구분된다.
  - 사람 검증(비개발자): 같은 raw peers라도 관련 강도가 다르게 표시되는지 확인한다.
  - 흔한 문제/주의: A등급은 대칭이 자연스럽지만, supplier/read-through 관계는 방향성이 있을 수 있다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run build
Set-Location "c:\github_coding\terminal_sec"
python -c "import sqlite3; con=sqlite3.connect('terminal/backend/backend/data/app.db'); print([r for r in con.execute('pragma table_info(company_profile_enrichment)')])"
```
사용자 확인 필요: **예**

#### ⏳ Step 2 — SNOW/DELL/HPE/SMCI 샘플 생성 로직

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | raw profile + local research context를 담을 curated seed 입력 객체를 만든다 | `terminal/backend/src/scripts/seedCompanyProfileEnrichment.ts` | 샘플 입력 JSON 확인 | ⏳ |
| 2-2 | SNOW 강화 description을 DB에 저장하는 수동 seed 경로를 만든다 | `terminal/backend/src/scripts/seedCompanyProfileEnrichment.ts` | SNOW row 조회 | ⏳ |
| 2-3 | DELL/HPE/SMCI에도 같은 schema로 샘플을 만든다 | DB data | Calendar API 응답 비교 | ⏳ |
| 2-4 | AI/tech 1차 pilot seed batch를 중복 skip 원칙으로 저장한다 | `terminal/backend/src/scripts/seedCompanyProfileEnrichment.ts` | seed 실행 후 DB/API에서 AI ticker 확인 | ⏳ |

- 2-1 목적: 생성 입력을 일관되게 만든다.
  - 설명: provider description, sector/industry, raw peers, Model_100 context를 한 입력으로 합친다.
  - 완료 조건(눈으로 확인): 한 ticker의 입력 JSON에 source별 근거가 들어 있다.
  - 사람 검증(비개발자): 입력에 원문/peer 후보/산업 정보가 모두 있는지 확인한다.
  - 흔한 문제/주의: 뉴스 기반 read-through와 동종 peer를 섞으면 peer 품질이 떨어진다.
- 2-2 목적: SNOW 예시를 실제 데이터 경로에 태운다.
  - 설명: 수동 curated text라도 enrichment table에 저장하고 API로 읽는다.
  - 완료 조건(눈으로 확인): SNOW API 응답에 강화 description이 들어 있다.
  - 사람 검증(비개발자): SNOW hover에서 짧은 UI 버전이 보이는지 확인한다.
  - 흔한 문제/주의: raw description과 강화 description을 같은 label로 보여주면 혼동된다.
- 2-3 목적: 한 종목 전용 포맷이 아닌지 검증한다.
  - 설명: 하드웨어/서버 계열 DELL/HPE/SMCI에도 같은 schema가 맞는지 확인한다.
  - 완료 조건(눈으로 확인): 세 종목 모두 peer category가 생성된다.
  - 사람 검증(비개발자): DELL과 SMCI의 관계가 `core`인지 `read-through`인지 구분되어 보인다.
  - 흔한 문제/주의: 한 섹터 안에서도 customer/supplier/competitor를 분리해야 한다.
- 2-4 목적: 전체 624개를 한 번에 쓰기 전에 AI 핵심 ticker로 실제 경로를 검증한다.
  - 설명: NVDA, AVGO, AMD, MU, DELL, SMCI, HPE, ANET, CRDO, VRT, PLTR, SNOW 등 AI/data-center 관련 ticker를 먼저 저장한다.
  - 완료 조건(눈으로 확인): seed 결과에 inserted/updated/skipped count가 나오고, 이미 저장된 ticker는 description을 재작성하지 않는다.
  - 사람 검증(비개발자): SNOW 또는 NVDA hover에서 강화 description이 보인다.
  - 흔한 문제/주의: industry가 겹치는 ticker를 다시 실행할 때 description이 덮어써지면 안 된다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec"
Invoke-RestMethod -Uri "http://localhost:8080/api/company-profiles/SNOW" | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "http://localhost:8080/api/calendar/events?type=earnings&tickers=SNOW&limit=1" | ConvertTo-Json -Depth 8
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run seed:company-enrichment -- --limit=12
```
사용자 확인 필요: **예**

#### ⏳ Step 3 — Backend API 병합

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `/api/company-profiles/:ticker` 응답에 enrichment 필드를 추가한다 | `terminal/backend/src/server.ts`, repository | SNOW API 응답 확인 | ⏳ |
| 3-2 | Calendar metadata 조회에 짧은 강화 설명과 peer groups를 추가한다 | `terminal/backend/src/services/calendarRepository.ts` | Calendar events API 확인 | ⏳ |
| 3-3 | 기존 raw peers 배열은 fallback/source evidence로 보존한다 | repository/API type | raw와 curated 동시 존재 확인 | ⏳ |
| 3-4 | Calendar/Profile API에 `curated_peers` edge 배열을 추가한다 | `calendarRepository.ts`, `server.ts`, `companyPeerRepository.ts` | SNOW Calendar/Profile API에서 A/B/C edge 확인 | ⏳ |

- 3-1 목적: hover popup이 강화 description을 받을 수 있게 한다.
  - 설명: raw provider field와 enrichment field를 함께 내려준다.
  - 완료 조건(눈으로 확인): API JSON에 `enhanced_description` 또는 동등 필드가 있다.
  - 사람 검증(비개발자): 브라우저 개발자 도구 없이도 curl 결과에서 새 필드를 볼 수 있다.
  - 흔한 문제/주의: 기존 frontend가 모르는 필드를 받아도 깨지지 않아야 한다.
- 3-2 목적: Calendar row 자체에서도 강화 설명/peer groups를 쓸 수 있게 한다.
  - 설명: 이벤트 목록 조회 시 ticker metadata에 enrichment를 조인한다.
  - 완료 조건(눈으로 확인): Calendar API item에 짧은 description과 peer groups가 있다.
  - 사람 검증(비개발자): Calendar Window에서 SNOW row를 열었을 때 새 내용이 노출된다.
  - 흔한 문제/주의: 목록 API가 느려지면 hover에서만 lazy fetch하는 대안이 필요하다.
- 3-3 목적: provider 원문과 curated 결과의 감사 가능성을 유지한다.
  - 설명: Finnhub/FMP peers는 raw candidate로 남기고, curated group을 별도로 보여준다.
  - 완료 조건(눈으로 확인): API에 raw peers와 curated peers가 구분되어 있다.
  - 사람 검증(비개발자): provider가 준 이상한 peer가 왜 제외됐는지 볼 수 있다.
  - 흔한 문제/주의: raw peers를 숨기면 데이터 품질 문제를 추적하기 어렵다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run build
Set-Location "c:\github_coding\terminal_sec"
Invoke-RestMethod -Uri "http://localhost:8080/api/company-profiles/SNOW" | ConvertTo-Json -Depth 8
```
사용자 확인 필요: **예**

#### ⏳ Step 4 — Frontend 표시 개선

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `CompanyProfileData` 타입에 enrichment/peer groups를 추가한다 | `companyDescription.ts` | frontend build | ⏳ |
| 4-2 | hover popup에 짧은 강화 설명과 핵심 체크 포인트를 표시한다 | `CompanyDescriptionHoverPreview.tsx` | 브라우저 hover 확인 | ⏳ |
| 4-3 | Calendar peers column을 A/B/C grade chip으로 개선한다 | `CalendarWindow.tsx` | frontend build 및 Calendar API 응답 shape 확인 | ⏳ |

- 4-1 목적: frontend가 새 API 필드를 안전하게 읽게 한다.
  - 설명: null-safe parsing과 cache 정책을 업데이트한다.
  - 완료 조건(눈으로 확인): 타입에 강화 description/peer groups 필드가 있다.
  - 사람 검증(비개발자): 화면에서 기존 원문 설명도 계속 볼 수 있다.
  - 흔한 문제/주의: cache가 description만 있을 때 반환하면 새 enrichment가 늦게 반영될 수 있다.
- 4-2 목적: hover에서 길지 않지만 정보량 높은 설명을 보여준다.
  - 설명: SNOW 기준 짧은 UI 버전을 상단에 보여주고 raw description은 접거나 하단에 둔다.
  - 완료 조건(눈으로 확인): hover에 `무엇을 파는지`, `실적 체크 포인트`, `주요 리스크`가 보인다.
  - 사람 검증(비개발자): SNOW hover를 보고 어떤 숫자를 봐야 하는지 알 수 있다.
  - 흔한 문제/주의: hover가 너무 커져 Calendar table을 가리면 별도 detail view가 필요하다.
- 4-3 목적: peers를 정확한 맥락으로 읽게 한다.
  - 설명: `Core`, `Adjacent`, `Read-through`, `Weak` 같은 label을 붙인다.
  - 완료 조건(눈으로 확인): SNOW row에서 MDB와 AMZN/MSFT가 같은 그룹으로 보이지 않는다.
  - 사람 검증(비개발자): provider raw peers와 curated peers 차이를 이해할 수 있다.
  - 흔한 문제/주의: 너무 많은 chip을 한 줄에 표시하면 가독성이 떨어진다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub"
npm.cmd run build
# dev 서버에서 http://localhost:5173/ 접속 후 Calendar Window의 SNOW ticker hover 확인
```
사용자 확인 필요: **예**

#### ⏳ Step 5 — Default universe peer graph 1차 재생성

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | default universe 전체 ticker를 읽어 A/B/C/EXCLUDE edge 후보를 만든다 | `terminal/backend/src/scripts/seedCompanyPeerEdges.ts` | seed 실행 결과 count 확인 | ⏳ |
| 5-2 | raw provider peers는 evidence로만 사용하고 broad match는 보수적으로 낮춘다 | `seedCompanyPeerEdges.ts` | SNOW -> OKTA가 C인지 확인 | ⏳ |
| 5-3 | curated peer graph를 DB에 replace 방식으로 저장한다 | `companyPeerRepository.ts` | `company_peer_edges` row count 확인 | ⏳ |
| 5-4 | Calendar Window에 `curated_peers` column을 추가하고 셀 클릭 시 전체 peer를 펼친다 | `CalendarWindow.tsx` | frontend build, dev server 확인 | ⏳ |

- 5-1 목적: 현재 default ticker 전체에 대해 빈 peers가 아니라 최소한의 비교 후보를 만든다.
  - 설명: exact/broad industry, sector fill, raw provider peers, 기존 enrichment peer group을 합쳐 edge를 만든다.
  - 완료 조건(눈으로 확인): `npm.cmd run seed:company-peers` 실행 결과에 processed 2,278과 edge count가 출력된다.
- 5-2 목적: raw peers 오류를 UI에서 core peer처럼 보이지 않게 한다.
  - 설명: broad industry만 같은 후보는 기본 B, exact industry가 아닌 raw provider 후보는 C로 둔다. curated core group만 A로 승격한다.
  - 완료 조건(눈으로 확인): `SNOW -> OKTA`가 `C / weak_provider_candidate`다.
- 5-3 목적: 반복 실행 가능한 1차 graph를 만든다.
  - 설명: `source='default_universe_baseline'`, `version='v1'` 기준으로 기존 edge를 삭제 후 재삽입한다.
  - 완료 조건(눈으로 확인): DB count가 edge 27,985개로 확인된다.
- 5-4 목적: Calendar Window에서 raw peers와 curated peers를 구분하고, 필요할 때 약한 관련주까지 확인한다.
  - 설명: 기존 raw `peers` column은 남기고, 새 `curated_peers` column은 A/B/C chip과 tooltip reason으로 표시한다. 접힌 상태에서는 상위 12개와 `+N`을 보여주고, 셀을 클릭하면 같은 row 안에서 C 등급 weak 후보까지 전체 표시한다.
  - 완료 조건(눈으로 확인): Calendar API item에 `curated_peers` 배열이 있고, frontend build가 통과하며, Calendar Window에서 `Curated Peers` 셀 클릭 시 전체 chip이 펼쳐진다.

검증 훅:
```powershell
Set-Location "c:\github_coding\terminal_sec\terminal\backend"
npm.cmd run seed:company-peers
python -c "import sqlite3; con=sqlite3.connect(r'backend/data/app.db'); print(con.execute('select count(*) from company_peer_edges').fetchone()[0])"
python -c "import sqlite3; con=sqlite3.connect(r'backend/data/app.db'); print(con.execute('select related_ticker, grade, relation_type from company_peer_edges where source_ticker=? and related_ticker=?', ('SNOW','OKTA')).fetchone())"
Invoke-RestMethod -Uri "http://localhost:8080/api/calendar/events?type=earnings&tickers=SNOW&limit=1" | ConvertTo-Json -Depth 8
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 저장 구조 결정
   - 선택지: 새 테이블 / 기존 `company_profiles` 컬럼 추가
   - 차단 대상 Step: 1, 2, 3
  - 현재 pilot 선택: 새 테이블 `company_profile_enrichment`
2. 생성 범위 결정
  - 선택지: Calendar 로드 ticker만 / default universe 전체 / watchlist별 / default universe 전체 중 AI-tech 1차 batch 우선
   - 차단 대상 Step: 2 이후 batch 운영
  - 현재 pilot 선택: default universe 전체 중 AI-tech 1차 batch 우선, 첫 실행은 AI/data-center 12개 ticker
3. UI 표시 밀도 결정
   - 선택지: hover에 짧은 버전만 / hover+detail modal / Calendar row inline 확장
   - 차단 대상 Step: 4
  - 현재 pilot 선택: hover 짧은 버전 + 핵심 항목 표시, raw는 API에 보존
4. 비상장 peer 표시 결정
   - 선택지: Databricks 같은 비상장 peer 표시 / 상장 ticker만 표시
   - 차단 대상 Step: peer UI
   - 권장: 비상장도 text chip으로 표시하되 ticker와 구분

### 실행 의존성 그래프

범례: `✅` 사용자 확인 완료 / `⏳` 작성 또는 구현 완료 후 사용자 확인 대기 / `⬜` 미착수 / `🚫` 차단

```text
트랙 A — 요구사항/샘플 품질
  ⏳ Step 0 요구사항/샘플 포맷 확정
    ⏳ 0-1 SNOW 현재 데이터 확인
    ⏳ 0-2 강화 description 필수 항목 정의
    ⏳ 0-3 SNOW 예시 작성
    ⏳ 0-4 default universe industry 큐 작성
    ⏳ 0-5 우주/방산 2차 큐와 LWLG 위치 확인

트랙 B — 저장/API 기반
  ⏳ Step 1 Enrichment 저장 구조 설계
    ⏳ 1-1 enrichment 스키마 초안 확정
    ⏳ 1-2 repository 인터페이스 설계
    ⏳ 1-3 peer category JSON schema 정의
    ⏳ 1-4 A/B/C peer edge graph 설계

  ⏳ Step 2 샘플 생성 로직
    ⏳ 2-1 curated seed 입력 객체 생성
    ⏳ 2-2 SNOW 강화 description 저장 경로 생성
    ⏳ 2-3 DELL/HPE/SMCI 샘플 생성
    ⏳ 2-4 AI/tech pilot seed batch

  ⏳ Step 3 Backend API 병합
    ⏳ 3-1 company profile API 응답 확장
    ⏳ 3-2 Calendar metadata 응답 확장
    ⏳ 3-3 raw peers fallback/source evidence 보존
    ⏳ 3-4 curated_peers edge 배열 추가

트랙 C — Frontend 표시
  ⏳ Step 4 Frontend 표시 개선
    ⏳ 4-1 frontend type 확장
    ⏳ 4-2 hover popup 개선
    ⏳ 4-3 Calendar peers column A/B/C chip 개선

트랙 D — Default peers 재정리
  ⏳ Step 5 Default universe peer graph 1차 재생성
    ⏳ 5-1 default universe 전체 edge 후보 생성
    ⏳ 5-2 raw provider broad match 보수적 하향
    ⏳ 5-3 DB replace 저장
    ⏳ 5-4 Calendar Window curated_peers column + 클릭 펼침 추가

차단 구간
  ┌──────────────────────────────────────────────┐
  │ 저장 구조/API shape 차단은 pilot 기준 해소됨       │
  │ 4-3 category chip은 구현 완료, 사용자 확인 대기       │
  └──────────────────────────────────────────────┘
```

병렬 트랙 요약:
- Step 0은 지금 작성/검토 가능한 샘플 품질 확정 트랙이다.
- Step 1~3은 backend 저장/API 트랙이며, 저장 구조 결정이 선행 조건이다.
- Step 4는 frontend 표시 트랙이며, API 응답 shape 확정 뒤 시작한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| 저장 구조 | Step 1~3 | pilot 기준 새 테이블 선택 완료, 사용자 확인 대기 |
| 생성 범위 | Step 2 batch 운영 | AI-tech 1차 batch 중 12개 pilot 완료, 사용자 확인 대기 |
| UI 표시 밀도 | Step 4 | hover pilot 완료, 4-3 category chip 구현 완료 후 사용자 확인 대기 |
| 비상장 peer 표시 | Step 4 peer UI | 표시 / 숨김 |

### 결정 #1 — Description 강화 필드(상세)
권장 필드:
- `short_summary_ko`: hover 상단 2~4문장.
- `detailed_description_ko`: detail view 또는 확장 영역용 긴 설명.
- `products_services_json`: 실제 상품/서비스와 예시.
- `revenue_model_ko`: 돈을 어떻게 버는지.
- `earnings_watch_points_json`: 실적에서 볼 지표.
- `move_drivers_json`: 주가가 반응하는 요인.
- `risks_json`: 주요 반대 변수.
- `peer_groups_json`: category별 peer 목록과 이유.
- `source_notes_json`: 원문/AI/수동 검토 source 기록.

### 결정 #2 — SNOW 샘플 기준(상세)
SNOW 샘플은 다음 품질 기준을 충족해야 한다.
- `Cloud Data Warehouse` 같은 일반명만 쓰지 않고, Snowflake Data Cloud, virtual warehouse, Snowpark, Cortex AI, Streamlit, Snowpipe, data sharing/marketplace, clean room, Iceberg table 같은 구체 서비스를 언급한다.
- `AI boom 수혜`를 추상적으로 쓰지 않고, 기업 데이터 정리 → AI application/analytics workload 증가 → compute credit 사용량 증가 → product revenue 반영이라는 경로를 설명한다.
- peers는 Databricks, BigQuery/Redshift/Fabric 같은 직접 경쟁/플랫폼 경쟁과 MDB/CFLT/ESTC/PLTR 같은 상장 인접 비교를 분리한다.
