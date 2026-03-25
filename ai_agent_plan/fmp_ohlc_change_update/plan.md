# Plan — fmp_ohlc_change_update

> 이 문서는 2026-03-24 기준 `change update`의 OHLC 소스를 FMP로 전환할 수 있는지 검토한 뒤, 구현 전에 필요한 결정과 단계별 작업을 정리한 계획서다.

### PLAN CHANGE — 2026-03-24 20:34 (IBKR change fallback 비활성화 + FMP 전환 구현)
- 사용자 요청에 따라 `change update`의 OHLC 부족분 보강 경로에서 IBKR를 제거하고, FMP 일봉 OHLC를 사용하도록 구현한다.
- 이번 변경 세트의 범위는 아래와 같다.
  - 신규 `terminal/backend/src/services/fmpOhlcProvider.ts` 추가
  - `newsChangeMerger.ts`의 Phase 1.5를 `IBKR fallback`에서 `FMP fallback`으로 교체
  - `POST /api/news/change/update-recent`, `POST /api/news/change/update-custom`가 FMP 설정을 받도록 수정
  - `DataControlWindow`의 change update 설정 라벨/요청 body를 FMP 기준으로 수정
  - 관련 prompt 문서 동기화
- 이번 리비전의 source 정책은 아래처럼 고정한다.
  - change update 1차: 로컬 OHLC DB
  - change update 2차: FMP 일봉 OHLC
  - change update용 IBKR fallback: 사용 안 함

### 목표
- 현재 `news change update`가 사용하는 OHLC 공급 경로를 점검한다.
- FMP가 현재 레포가 필요로 하는 OHLC 데이터(특히 일봉)를 실제로 안정적으로 제공하는지 확인한다.
- `change update`를 FMP 기반으로 전환할 수 있다면, 최소 변경 경로와 전체 전환 경로를 분리해 계획한다.
- 구현 전에 사용자 결정이 필요한 범위를 명확히 분리한다.

### 현재 레포 상태(중요, 확인됨)
- 현재 `change update`의 실제 계산 엔진은 `terminal/backend/src/services/newsChangeMerger.ts`다.
- 이 엔진은 먼저 로컬 canonical OHLC DB `OHLC_data/ohlc_1d_watchlist.sqlite`를 읽는다.
- 기존에는 로컬 OHLC DB에 없는 ticker를 `ibkrOhlcBatchProvider.ts`로 보강한 뒤 다시 계산했다.
- 즉 현재 구조에서 `change update`는 “provider 직접 계산”이 아니라 “OHLC DB를 읽는 계산기 + 부족분 공급자(fallback)” 구조다.
- 현재 레포에는 FMP company profile / float / press release / sec filing provider는 있지만, OHLC provider는 아직 없다.
- live probe 결과 FMP는 아래 endpoint가 실제 응답했다.
  - 일봉: `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&from=2026-03-01&to=2026-03-24`
  - intraday 1시간: `https://financialmodelingprep.com/stable/historical-chart/1hour?symbol=AAPL&from=2026-03-20&to=2026-03-24`
- FMP docs에도 아래가 명시되어 있다.
  - 일봉 full OHLCV: `historical-price-eod/full`
  - intraday: `historical-chart/1min`, `5min`, `15min`, `30min`, `1hour`, `4hour`
- 현재 `change update` 계산식은 일봉 기준이다.
  - `change_pct`: 전일 종가 → 기사일 종가
  - `change_from_open_pct`: 기사일 시가 → 기사일 종가
  - `change_open_to_high_pct`: 기사일 시가 → 기사일 고가
  - `change_1d/3d/7d/14d/30d_pct`: 전일 종가 대비 forward 일봉 종가
- 따라서 **현재 기능을 유지하는 목적이라면 intraday가 아니라 일봉 FMP OHLC가 핵심**이다.

### 제약 / 비범위
- 이번 plan 단계에서는 코드 구현을 바로 시작하지 않는다.
- mock 데이터는 사용하지 않는다.
- `news change update` 계산식을 바꾸는 작업은 이번 기본 범위가 아니다.
- 차트 UI나 실시간 intraday 시각화는 이번 기본 범위가 아니다.
- 먼저 권장 범위는 “일봉 change update 공급자 전환”이며, intraday 확장은 2차 범위다.

### 읽는 방법(비개발자/일반인 기준)
- `현재 레포 상태`를 보면 지금 어디서 가격을 읽는지 알 수 있다.
- `결정/선행조건`을 보면 구현 전에 사용자가 골라야 할 옵션이 보인다.
- `단계별 계획`은 실제 구현 순서다.
- `미확정 사항`은 지금 답을 정하면 바로 구현 속도가 빨라지는 항목들이다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- plan 변경이 생기면 `PLAN CHANGE` 섹션을 추가한다.
- 각 Step은 구현 후 검증 결과를 붙인다.
- 각 Step은 사용자 확인 전까지 `⏳`로 유지한다.
- 사용자 확인 후에만 `✅`로 승격한다.

### 아키텍처(상위)
- 현재 구조
  - News ingest → `news_items`
  - Change update → `newsChangeMerger.ts`
  - 가격 조회 1차 → `OHLC_data/ohlc_1d_watchlist.sqlite`
  - 가격 조회 2차 fallback → `ibkrOhlcBatchProvider.ts`
  - 계산 결과 저장 → `news_change_metrics`
- 목표 구조(현재 구현 결정안)
  - News ingest → `news_items`
  - Change update → `newsChangeMerger.ts`
  - 가격 조회 1차 → `OHLC_data/ohlc_1d_watchlist.sqlite`
  - 가격 조회 2차 fallback → `fmpOhlcProvider.ts`
  - 계산 결과 저장 → `news_change_metrics`
- 확장 구조(선택안)
  - 별도 `POST /api/fmp/ohlc1d/update` 또는 기존 OHLC update route 확장
  - FMP로 canonical OHLC DB 자체를 증분 갱신
  - change update는 계속 DB만 읽고, fallback 의존도를 줄임

### 결정/선행조건(초기에 확정 필요)
1. **결정 #1 — 전환 범위**
   - 선택지 A. `change update`의 missing-OHLC fallback만 FMP로 교체 또는 추가
   - 선택지 B. canonical OHLC DB 업데이트 job도 FMP로 추가
   - 선택지 C. 일봉 + intraday까지 함께 FMP로 붙임
   - **권장:** A부터 시작. 가장 작은 변경으로 효과를 검증할 수 있다.
2. **결정 #2 — 공급 우선순위**
  - 사용자 결정: **FMP only**
  - change update의 부족분 보강 경로에서는 IBKR fallback을 사용하지 않는다.
3. **결정 #3 — 가격 기준**
   - 선택지 A. FMP `historical-price-eod/full` 사용
   - 선택지 B. FMP `historical-price-eod/non-split-adjusted` 사용
   - **권장:** A. 현재 canonical OHLC DB의 split 조정 정책과 가장 자연스럽게 맞을 가능성이 높다. 다만 기존 DB와 특정 split 종목 비교 검증이 필요하다.
4. **결정 #4 — source 추적 방식**
   - 선택지 A. OHLC DB는 source 컬럼 없이 유지, update log/status에만 기록
   - 선택지 B. OHLC DB row level source 컬럼 확장
   - **권장:** A. 현재 스키마 변경 범위를 줄인다.

### 계획 중간 필수 확인
- FMP 일봉과 현재 OHLC DB 기준 결과가 split / 휴장일 / same-day gating에서 동일한지 샘플 검증이 필요하다.
- 특히 아래는 구현 중간에 반드시 확인한다.
  - 기사일이 휴장일일 때 anchor date가 어떻게 잡히는가
  - ET `16:00:00` 이전 same-day gating이 그대로 유지되는가
  - FMP bar의 날짜가 `YYYY-MM-DD`로 안전하게 정규화되는가
  - 장중 현재일 bar 제외 규칙과 충돌하지 않는가

### 제안하는 구현 순서(이유)
1. 먼저 FMP 일봉 provider를 추가한다.
   - 이유: 현재 change 계산기는 이미 안정적이고, 공급자만 끼우는 편이 가장 작은 수정이다.
2. 그 다음 `newsChangeMerger`의 fallback 순서를 FMP로 고정한다.
   - 이유: 기능 목표를 가장 빨리 충족한다.
3. 그 다음에 필요하면 canonical OHLC update job까지 확장한다.
   - 이유: 이 단계는 운영 성격이 크고, route/status/UI까지 번질 수 있다.
4. intraday는 마지막으로 분리한다.
   - 이유: 현재 change metric은 일봉 계산이므로 선행 가치가 낮다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 가능 여부 및 현재 경로 감사
| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | 현재 `newsChangeMerger`가 로컬 OHLC DB + IBKR fallback 구조인지 확인 | ⏳ |
| 0-2 | FMP docs와 live probe로 일봉/intraday OHLC endpoint 가용성 확인 | ⏳ |
| 0-3 | 현재 기능 유지에 intraday가 필수인지 여부를 계산식 기준으로 분리 | ⏳ |

- 0-1 목적: 어디를 바꿔야 최소 변경인지 파악한다.
  설명: 직접 바꿀 대상이 `change 계산식`이 아니라 `OHLC 공급 경로`라는 점을 확정하면 된다.
  완료 조건(눈으로 확인): `newsChangeMerger.ts`에 로컬 DB 조회와 IBKR fallback이 둘 다 존재한다.
  사람 검증(비개발자): 설명을 읽고 “현재는 DB 먼저, 없으면 IBKR”라고 말할 수 있으면 된다.
  흔한 문제/주의: route 이름만 보고 공급자 위치를 잘못 판단할 수 있다.
- 0-2 목적: FMP가 실제로 필요한 데이터를 주는지 먼저 막는다.
  설명: docs 문구만이 아니라 live HTTP 200 + 샘플 payload까지 확인하면 된다.
  완료 조건(눈으로 확인): 일봉과 1시간 endpoint 모두 샘플 JSON이 나온다.
  사람 검증(비개발자): “FMP에서 AAPL 일봉/1시간 데이터가 실제 내려왔다”는 결과를 확인한다.
  흔한 문제/주의: docs에 있어도 현재 플랜에서 막히는 endpoint가 있을 수 있으므로 실응답이 더 중요하다.
- 0-3 목적: scope를 불필요하게 키우지 않는다.
  설명: 현재 change metric이 forward 일봉 계산임을 명시하면 intraday를 기본 범위에서 뺄 수 있다.
  완료 조건(눈으로 확인): plan에 “일봉이 핵심, intraday는 2차 범위”가 명시된다.
  사람 검증(비개발자): 왜 intraday가 당장 없어도 되는지 설명을 이해할 수 있다.
  흔한 문제/주의: “OHLC”라는 말 때문에 intraday까지 당장 구현해야 한다고 오해하기 쉽다.

검증 훅:
```text
- 코드 확인: terminal/backend/src/services/newsChangeMerger.ts
- 코드 확인: terminal/backend/src/services/ohlcWatchlistRepository.ts
- live probe: FMP historical-price-eod/full 응답 샘플 확인
- live probe: FMP historical-chart/1hour 응답 샘플 확인
사용자 확인 필요: 예
```

#### ⏳ Step 1 — FMP 일봉 provider 설계 확정
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `fmpOhlcProvider.ts` 인터페이스와 응답 매핑 규칙 정의 | `terminal/backend/src/services/fmpOhlcProvider.ts` | provider 함수 시그니처 리뷰 | ⏳ |
| 1-2 | retry/backoff/throttle 정책을 기존 FMP provider 패턴과 맞춤 | `terminal/backend/src/services/fmpOhlcProvider.ts` | 429/HTTP 오류 처리 규칙 리뷰 | ⏳ |
| 1-3 | 일봉 날짜/숫자 필드 정규화 규칙 확정 | `terminal/backend/src/services/fmpOhlcProvider.ts` | 샘플 payload → `OhlcBar` 매핑 확인 | ⏳ |

- 1-1 목적: FMP 응답을 현재 OHLC DB 구조에 맞춰 넣는다.
  설명: 반환 타입을 기존 `OhlcBar`와 최대한 맞추면 이후 통합이 단순해진다.
  완료 조건(눈으로 확인): provider가 `Datetime, Open, High, Low, Close, Volume` 형태를 반환한다.
  사람 검증(비개발자): AAPL 예시가 기존 OHLC row처럼 보이면 된다.
  흔한 문제/주의: FMP 원본 필드명이 소문자라 직접 DB upsert 형식으로 바꿔야 한다.
- 1-2 목적: 새 provider가 운영 중 rate-limit에 무너지지 않게 한다.
  설명: 기존 FMP profile/float provider의 공통 패턴을 재사용하면 된다.
  완료 조건(눈으로 확인): 최대 10회 재시도 + backoff + 429 구분이 들어간다.
  사람 검증(비개발자): 일시 오류 시 바로 끝나지 않고 다시 시도한다는 설명이 있다.
  흔한 문제/주의: 인증 오류를 재시도하면 시간만 낭비한다.
- 1-3 목적: 날짜/숫자 변환 오류를 초기에 막는다.
  설명: `date`를 `YYYY-MM-DD`로, 숫자형 필드를 `number`로 강제 정규화하면 된다.
  완료 조건(눈으로 확인): 샘플 응답 1건이 `OhlcBar`로 변환된다.
  사람 검증(비개발자): 샘플 1개가 open/high/low/close/volume를 다 가진다.
  흔한 문제/주의: intraday endpoint와 일봉 endpoint의 날짜 포맷이 다르다.

검증 훅:
```text
npm.cmd run build
npm.cmd run test
샘플 호출: AAPL 10영업일 일봉 응답을 OhlcBar[]로 변환 확인
사용자 확인 필요: 예
```

#### ⏳ Step 2 — change update FMP fallback 통합
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `newsChangeMerger.ts`에 FMP fallback 옵션 추가 | `terminal/backend/src/services/newsChangeMerger.ts` | missing ticker 시 FMP fetch 경로 도달 확인 | ⏳ |
| 2-2 | FMP로 받은 bar를 기존 OHLC DB에 upsert 후 재계산 | `terminal/backend/src/services/newsChangeMerger.ts`, `terminal/backend/src/services/ohlcWatchlistRepository.ts` | 재실행 시 DB hit로 계산되는지 확인 | ⏳ |
| 2-3 | change update용 IBKR fallback 제거 | `terminal/backend/src/services/newsChangeMerger.ts`, `terminal/backend/src/server.ts` | route/body/log가 FMP 기준으로 바뀌었는지 확인 | ⏳ |

- 2-1 목적: 현재 계산기 구조를 보존하면서 공급자만 추가한다.
  설명: missing ticker 집합을 FMP에 먼저 보내고, 필요 시 다음 단계로 넘기면 된다.
  완료 조건(눈으로 확인): OHLC 없는 ticker에서 FMP fallback 로그가 남는다.
  사람 검증(비개발자): “가격이 없으면 FMP를 먼저 시도한다”는 로그를 볼 수 있다.
  흔한 문제/주의: fallback fetch 범위를 너무 넓게 잡으면 호출 수가 급증할 수 있다.
- 2-2 목적: 같은 ticker를 다음번에 다시 API로 받지 않게 한다.
  설명: FMP 결과를 OHLC DB에 저장한 뒤 재계산 루프를 그대로 재사용하면 된다.
  완료 조건(눈으로 확인): 첫 실행 후 둘째 실행은 API 없이 DB로 계산된다.
  사람 검증(비개발자): 같은 기사 change update를 다시 눌렀을 때 더 빨라진다.
  흔한 문제/주의: upsert 후 derived metric 재계산이나 stable-bar 필터를 빼먹을 수 있다.
- 2-3 목적: 사용자가 원하는 source 정책을 코드에 그대로 반영한다.
  설명: change update의 Phase 1.5는 FMP만 사용하고, IBKR 보강 경로는 호출하지 않으면 된다.
  완료 조건(눈으로 확인): route body와 로그에 더 이상 change update용 IBKR fallback 설명이 없다.
  사람 검증(비개발자): change update 설정 문구가 FMP 기준으로 보인다.
  흔한 문제/주의: backend만 바꾸고 UI 라벨을 안 바꾸면 계속 IBKR가 쓰이는 것처럼 보일 수 있다.

검증 훅:
```text
npm.cmd run build
npm.cmd run test
dev server 실행 후 change update endpoint 실호출
OHLC DB에 없는 ticker 기사로 1회 실행 → FMP fetch → DB upsert → news_change_metrics 저장 확인
동일 기사 2회 실행 → DB hit 확인
사용자 확인 필요: 예
```

#### ⬜ Step 3 — canonical OHLC update job 확장(선택)
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 별도 FMP OHLC update route 또는 기존 route 확장 설계 | `terminal/backend/src/server.ts` | API 계약 리뷰 | ⬜ |
| 3-2 | update_status에 FMP OHLC 상태 기록 추가 | `terminal/backend/src/services/updateStatusRepository.ts`, `terminal/backend/src/server.ts` | status endpoint 확인 | ⬜ |
| 3-3 | Data Control UI 노출 여부 결정 및 문서 동기화 | `termina_web/...`, `terminal/backend_prompt.md` | 버튼/문서 확인 | ⬜ |

- 3-1 목적: 운영자가 미리 OHLC를 채워 fallback 의존도를 줄인다.
  설명: change update와 별도의 prefill/update job을 둘지 결정하면 된다.
  완료 조건(눈으로 확인): route 이름과 body 계약이 정해진다.
  사람 검증(비개발자): “가격 미리 받기” 버튼 또는 API가 생긴다.
  흔한 문제/주의: 이 단계는 Step 2보다 범위가 크다.
- 3-2 목적: 업데이트 성공 시각과 대상 수를 추적한다.
  설명: 기존 `update_status` 패턴에 맞춰 source key를 하나 추가하면 된다.
  완료 조건(눈으로 확인): status 응답에 FMP OHLC 항목이 보인다.
  사람 검증(비개발자): 마지막 성공 시각을 화면/API에서 볼 수 있다.
  흔한 문제/주의: key 이름이 docs와 코드에서 불일치할 수 있다.
- 3-3 목적: 운영 진입점을 명확히 한다.
  설명: 버튼을 추가할지, backend-only로 둘지 결정하고 문서를 맞추면 된다.
  완료 조건(눈으로 확인): UI 또는 문서 중 하나로 진입 방법이 분명해진다.
  사람 검증(비개발자): 어디서 눌러야 하는지 바로 알 수 있다.
  흔한 문제/주의: backend만 바꾸고 UI/문서를 안 맞추면 사용자 혼란이 커진다.

검증 훅:
```text
npm.cmd run build
npm.cmd run test
FMP OHLC update route 1회 실행
OHLC status 또는 update_status 확인
사용자 확인 필요: 예
```

#### ⬜ Step 4 — intraday 지원 여부 검토(선택)
| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | intraday를 실제로 어떤 기능에서 쓸지 정의 | 계획 문서 | 요구사항 확인 | ⬜ |
| 4-2 | 필요한 interval(1min/5min/1hour 등)과 저장 위치 결정 | 계획 문서, 필요 시 신규 파일 | 설계 리뷰 | ⬜ |
| 4-3 | 일봉 change update와 분리된 별도 기능으로 구현 여부 결정 | 계획 문서 | 사용자 결정 확인 | ⬜ |

- 4-1 목적: intraday를 “있으면 좋음”이 아니라 실제 기능과 연결한다.
  설명: 차트, same-day event reaction, 별도 metric 중 어디에 쓸지 먼저 정하면 된다.
  완료 조건(눈으로 확인): intraday 소비 기능이 1개 이상 정의된다.
  사람 검증(비개발자): 왜 intraday가 필요한지 한 문장으로 설명된다.
  흔한 문제/주의: 용도 없이 저장만 시작하면 유지비만 커진다.
- 4-2 목적: 데이터 폭발을 막는다.
  설명: interval과 저장소를 먼저 정하지 않으면 용량과 API 호출량이 불어난다.
  완료 조건(눈으로 확인): interval과 보존 정책이 적힌다.
  사람 검증(비개발자): “1시간만 저장” 같은 룰을 이해할 수 있다.
  흔한 문제/주의: 1분봉 전체 저장은 범위가 급격히 커진다.
- 4-3 목적: 현재 change update와 분리된 별도 트랙으로 관리한다.
  설명: 일봉 기능 안정화 후에만 intraday 구현으로 넘긴다.
  완료 조건(눈으로 확인): Step 4가 선택 범위로 남는다.
  사람 검증(비개발자): 지금 당장 안 해도 핵심 기능에는 영향이 없음을 이해한다.
  흔한 문제/주의: Step 2 전에 Step 4로 가면 일정이 불필요하게 길어진다.

검증 훅:
```text
요구사항 문서/채팅에서 intraday 소비 기능 확정
필요 시 샘플 endpoint 호출로 payload/비용 재검토
사용자 확인 필요: 예
```

### 미확정 사항(명시 결정 필요)
1. `D1` 전환 범위
   - 선택지: A fallback만 / B canonical update까지 / C intraday 포함
   - 차단 대상 Step: Step 1 이후 구현 상세
3. `D3` 가격 기준
   - 선택지: A adjusted full / B non-split-adjusted
   - 차단 대상 Step: Step 1, Step 2
4. `D4` source 추적 범위
   - 선택지: A status/log만 / B OHLC row schema 확장
   - 차단 대상 Step: Step 3

### 실행 의존성 그래프

Legend
- `⏳` 구현/조사 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족
- `✅` 사용자 확인 후 완료

```text
트랙 A — 감사 / 설계 확정
  ⏳ 0-1 현재 change update 공급 경로 확인
  ⏳ 0-2 FMP 일봉/intraday endpoint 실응답 확인
  ⏳ 0-3 intraday 필요성 분리
        |
        v
  [차단 구간]
  결정 필요: D1 전환 범위, D2 공급 우선순위, D3 adjusted 여부
        |
        v
    ⏳ 1-1 FMP 일봉 provider 인터페이스 정의
    ⏳ 1-2 retry/backoff/throttle 확정
    ⏳ 1-3 날짜/숫자 정규화 확정
        |
        v
    ⏳ 2-1 newsChangeMerger FMP fallback 통합
    ⏳ 2-2 OHLC DB upsert + 재계산 연결
    ⏳ 2-3 change update용 IBKR fallback 제거

트랙 B — 운영 확장(선택)
  ⬜ 3-1 canonical OHLC update route 설계
  ⬜ 3-2 update_status 연결
  ⬜ 3-3 UI/문서 노출

트랙 C — 장기 확장(선택)
  ⬜ 4-1 intraday 소비 기능 정의
  ⬜ 4-2 interval/저장 위치 결정
  ⬜ 4-3 일봉과 분리된 구현 여부 결정
```

병렬 트랙 요약
- 트랙 A가 핵심 구현 트랙이다.
- 트랙 B는 Step 2가 안정화된 뒤에만 진행하는 것이 안전하다.
- 트랙 C는 현재 기능 요구와 직접 연결되지 않으므로 마지막으로 미룬다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| D1 전환 범위 | Step 1, Step 2, Step 3 | fallback만 / canonical update 포함 / intraday 포함 |
| D3 가격 기준 | Step 1, Step 2 | adjusted full / non-split-adjusted |
| D4 source 추적 방식 | Step 3 | status/log만 / OHLC row schema 확장 |

### 결정 #1 — 권장 시작안(상세)
- 권장 시작안은 아래 조합이다.
  - `D1 = A` fallback만 전환
  - `D3 = A` adjusted full endpoint 사용
  - `D4 = A` status/log만 source 추적
- 이유
  - 현재 change update의 핵심은 계산기가 아니라 공급 경로다.
  - FMP 일봉은 이미 실응답이 확인됐다.
  - 가장 작은 수정으로 효과를 보려면 `newsChangeMerger`의 missing-OHLC 단계만 건드리는 편이 낫다.
  - 사용자 요청이 명확하므로 change update 경로에서는 IBKR를 남기지 않는다.

### 결정 #2 — 구현 시작 전 사용자에게 확인받을 질문
1. 1차 범위를 `change update fallback만 FMP로 전환`으로 유지할지
2. canonical OHLC update job까지 이번에 같이 넣을지