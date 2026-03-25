### 모델 분류

#### `🟩 Model_4_watchlists analysis`

목적:

- `Model_4_watchlists`는 `Model_1`과 같은 방식으로 현재 뉴스의 가격 영향 가능성을 분석하되, **현재 분석 대상 current-news 후보를 사용자가 지정한 watchlist ticker 집합으로 제한**하는 모델이다.
- 즉 `same-ticker`, `other-ticker`, `기업 컨텍스트`, `시가총액`, `수급 구조`, 필요시 `model_1_2_investing` 같은 판단 프레임은 그대로 유지하되, **직접 분석 대상으로 남길 ticker 선정 단계에 watchlist 필터를 먼저 건다.**

핵심 원칙:

- `Model_4_watchlists`는 완전히 새로운 분석 철학이 아니라, **Model_1의 watchlist-scoped variant**다.
- 따라서 별도 예외가 없으면 `Model_1`의 가드레일과 상세 출력 최소 기준을 그대로 따른다.
- 차이는 아래 2개다.
  1. `현재 기간 뉴스 전수 스크리닝`을 전체 시장이 아니라 **선택된 watchlist ticker 집합** 안에서 한다.
  2. 최종 `primary / secondary / watch` 직접 분석 대상으로 승격할 수 있는 ticker도 기본적으로 **해당 watchlist 내부 종목으로 제한**한다.

### 언제 쓰나

- 사용자가 `watchlist 기준으로 Model_1처럼 분석`, `watchlist만 대상으로 news analysis`, `관심종목만 좁혀서 분석`처럼 요청할 때.
- 특정 날짜/시간 구간의 뉴스 중에서, **전체 시장이 아니라 내 관심종목 묶음 안에서만** 중요한 뉴스를 골라야 할 때.
- 연구 page / note를 만들 때, broad market scan이 아니라 **지정한 종목군 전용 research note**를 원할 때.

### watchlist 대상 확정 규칙 (필수)

- `Model_4_watchlists`는 **어떤 watchlist를 대상으로 하는지 먼저 확정한 뒤에만** 분석을 시작한다.
- 사용자가 기간만 주고 watchlist를 지정하지 않았다면, 바로 본분석으로 들어가지 말고 먼저 **분석 가능한 watchlist 종류**를 짧게 안내한 뒤 대상 선택을 받는다.
- 기본적으로 안내할 수 있는 watchlist 종류는 아래 4축이다.
  1. `앱 저장 watchlist`: backend `GET /api/watchlists`에 저장된 사용자 watchlist
  2. `default universe / default watchlist`: 앱의 기본 ticker universe 또는 TradingView screener default watchlist 계열
  3. `CSV 기반 watchlist`: `hts_watch_lists/` 또는 사용자가 지정한 CSV 파일 기반 ticker 집합
  4. `직접 ticker 목록`: 사용자가 채팅에서 직접 주는 ticker 리스트
- 사용자가 `반도체 watchlist`, `양자컴퓨팅 watchlist`, `내 관심종목`처럼 모호하게 말하면, 가능한 경우 실제 watchlist 이름/경로/티커 목록으로 다시 닫는다.
- watchlist가 여러 개면 기본 동작은 **합집합 자동 병합이 아니라, 어떤 방식으로 쓸지 먼저 명시**하는 것이다.
  - `개별 분석`: watchlist마다 별도 섹션으로 분석
  - `합집합 분석`: 여러 watchlist ticker를 하나의 분석 universe로 합침
  - 특별한 지시가 없으면 `개별 분석` 또는 `먼저 하나 선택`을 우선한다.

### 분석 시작 전 안내 문구 규칙 (필수)

- 사용자가 아직 대상을 고르지 않았다면, agent는 아래 취지의 안내를 먼저 해야 한다.
  - `일반적으로는 앱 저장 watchlist, default universe, hts_watch_lists CSV, 직접 ticker 목록 중 하나를 대상으로 잡을 수 있다.`
  - `어느 watchlist를 기준으로 볼지 정해 주면 그 범위 안에서만 Model_1 방식으로 분석한다.`
- 즉 `Model_4_watchlists`에서는 **가능한 watchlist 종류 설명 -> 대상 확정 -> 기간 확정 -> 분석 시작** 순서를 지킨다.
- watchlist가 확정되기 전에는 `primary`, `secondary`, `watch`를 임의로 뽑지 않는다.

### watchlist 정규화 규칙 (필수)

- 분석에 들어가기 전, 선택된 watchlist는 반드시 **정규화된 ticker 집합**으로 닫아야 한다.
- 정규화 시 기본 규칙은 아래와 같다.
  - 대문자 ticker 기준으로 통일한다.
  - 중복 ticker는 제거한다.
  - 빈 값, 공백, 비정상 기호는 제거한다.
  - 가능한 경우 `securities` 또는 watchlist 원본과 대조해 오타 여부를 확인한다.
- 최종 note 또는 page 본문에는 최소한 아래를 남긴다.
  - `watchlist 이름 또는 식별자`
  - `watchlist source` (`/api/watchlists`, `CSV`, `chat ticker list` 등)
  - `대상 ticker 수`
  - 필요시 `대표 ticker 예시`

### current-news 포함 / 제외 규칙 (필수)

- 현재 기간 뉴스 전수 스크리닝에서, **직접 분석 후보에 포함할 뉴스는 ticker가 선택된 watchlist와 교집합을 가지는 경우로 제한**한다.
- 기본 포함 규칙:
  - `news_items.tickers_csv` 또는 enrich ticker 집합 중 하나라도 watchlist ticker와 겹치면 포함 후보로 본다.
  - headline/body/company context를 봤을 때 대표 해석 ticker가 watchlist 내부면 포함 후보로 본다.
- 기본 제외 규칙:
  - 시장 전체에서는 중요해 보여도, 대표 ticker가 watchlist 바깥이면 직접 분석 대상에서는 제외한다.
  - 다만 이 경우에도 **왜 watchlist 분석에서 빠졌는지**를 짧게 남길 가치는 있다.
- 따라서 `Model_4_watchlists`에서는 `전체 시장 기준 중요 뉴스`와 `watchlist 기준 직접 분석 뉴스`를 혼동하지 않는다.

### Model_1 구조 상속 규칙 (필수)

- watchlist 필터가 들어가더라도, 직접 분석 대상으로 채택된 ticker에 대해서는 **Model_1과 동일한 상세 구조**를 유지한다.
  1. 현재 뉴스 요약
  2. 기업 컨텍스트
  3. 1단계 초기 판단
  4. same-ticker 조사
  5. other-ticker 조사
  6. 반례 또는 약화 요인
  7. 최종 재판단
  8. 남은 한계
- 여기서 `other-ticker 조사`는 watchlist 내부 ticker로만 제한하지 않는다.
- 즉 **직접 분석 대상은 watchlist 내부 종목으로 제한하지만**, 유사사례 reference case는 watchlist 바깥 종목도 사용할 수 있다. 그렇지 않으면 사례 풀이 지나치게 빈약해질 수 있다.

### watchlist 외부 ticker 해석 규칙 (필수)

- `same-ticker`와 `other-ticker` 유사사례 조사 중 watchlist 외부 ticker가 등장하는 것은 허용한다.
- 그러나 최종 `primary / secondary / watch` 직접 후보 표에는, 특별한 사용자 지시가 없는 한 **watchlist 내부 ticker만 남긴다.**
- watchlist 외부 ticker는 아래 용도로만 남긴다.
  - `reference case`
  - `peer comparison`
  - `industry readthrough`
  - `Investing theme context`
- 사용자가 `watchlist 밖으로 퍼질 수 있는 ticker도 같이 적어라`라고 명시한 경우에만 별도 `외부 파급 후보` 섹션을 둔다.
- 다만 watchlist 바깥에서 시작된 외부 이슈라도, **그 이슈가 watchlist 내부 종목으로 readthrough를 만들 수 있으면 반드시 watchlist 내부 ripple candidate 재점검**을 해야 한다.

### model_1_2_investing 결합 규칙 (필수)

- `Model_4_watchlists`에서도 필요하면 `model_1_2_investing`을 붙일 수 있다.
- 이때도 순서는 아래처럼 유지한다.
  1. watchlist 내부 ticker만 대상으로 DB 기반 `Model_1` 분석
  2. Investing 시황/정책/테마 기사에서 `external issue -> transmission path -> public ticker basket`을 닫는다.
  3. 그 바스켓 기준으로 watchlist 내부 ticker 중 놓친 macro/theme 영향 후보가 있는지 재점검한다.
- Investing 확장에서 watchlist 바깥 ticker가 보여도, 거기서 멈추면 안 된다. **그 외부 이슈가 watchlist 내부 종목에 어떤 readthrough를 만들 수 있는지까지 닫아야** 한다.
- 즉 `stablecoin regulation -> CRCL, COIN, HOOD` 같은 기사를 봤더라도, 현재 선택 watchlist에 `COIN`만 있으면 직접 분석 후속 대상은 우선 `COIN`이고, `COIN`이 왜 readthrough 후보인지 영향 경로까지 같이 적어야 한다.
- 같은 원리로 `SpaceX IPO 기대 -> direct exposure narrative / peer repricing / retail speculation transfer -> TSLA, HOOD, space-linked public names`처럼 **비상장 중심 외부 이슈도 먼저 공개 ticker 바스켓으로 번역한 뒤, 그중 watchlist 내부 교집합을 재점검**해야 한다.

### 산출물 규칙 (필수)

- `Model_4_watchlists` 결과물 상단에는 최소한 아래를 명시한다.
  1. `분석 기간: YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm (timezone)`
  2. `대상 watchlist`
  3. `watchlist source`
  4. `watchlist ticker 수`
  5. `현재 기간 내 watchlist 교집합 뉴스 수` 또는 `screened rows`
- 상단 요약 표 또는 스크리닝 표에는 가능하면 아래를 포함한다.
  - `Ticker`
  - `Headline (요약)`
  - `watchlist 포함 여부`
  - `분류` (`primary`, `secondary`, `watch`, `noise`)
  - `제외/유지 이유`
- page/note 본문에는 가능하면 아래 세 층을 분리한다.
  1. `watchlist 기준 current-news 스크리닝 요약`
  2. `external theme / indirect issue 점검`
  3. `watchlist 내부 직접 분석 ticker + ripple candidate 본문`
- `external theme / indirect issue 점검`에는 최소한 아래를 적는다.
  - `external issue`
  - `transmission path`
  - `watchlist 내부 ripple candidate`
  - `왜 직접 기사 없이도 재점검 대상인지`

### 미완료 판정 규칙 (필수)

- 아래 중 하나라도 빠지면 `Model_4_watchlists` 완료로 간주하지 않는다.
  - 어떤 watchlist를 대상으로 했는지 명시 없음
  - watchlist source / ticker 범위 명시 없음
  - watchlist 내부 뉴스만 본 것인지 전체 시장 뉴스를 섞어 본 것인지 불명확
  - 직접 분석 후보가 왜 watchlist 안에서 채택되었는지 설명 없음
  - watchlist 바깥 중요 뉴스가 왜 제외되었는지 최소한의 경계 설명 없음
- 추가로 아래 상황도 `미완료`로 본다.
  - 외부 이슈 또는 비상장 중심 테마를 확인했는데, 그것이 watchlist 내부 종목에 미칠 readthrough 가능성을 점검하지 않음
  - `model_1_2_investing`을 했다고 쓰고도 `external issue -> transmission path -> watchlist ripple candidate` 구조가 본문에 보이지 않음
- 사용자가 watchlist를 아직 지정하지 않았는데도 agent가 임의로 broad market 분석을 시작하면, 그것은 `Model_4_watchlists` 수행이 아니라 다른 모델 오적용으로 본다.

### 권장 안내 예시

- 분석 시작 전:
  - `watchlist 기준으로 보려면 먼저 대상 watchlist를 정해야 합니다. 보통은 1) 앱 저장 watchlist, 2) default universe, 3) hts_watch_lists CSV, 4) 직접 ticker 목록 중 하나를 사용합니다. 어떤 watchlist를 기준으로 볼지 정해 주시면 그 범위 안에서만 Model_1 방식으로 분석합니다.`
- 범위 확정 후:
  - `이번 분석은 <watchlist 이름> 기준이며, 직접 분석 후보는 이 watchlist와 교집합이 있는 뉴스로 제한합니다. 다만 same-ticker / other-ticker reference case는 watchlist 밖 종목도 사용할 수 있습니다.`

### Locality / source of truth

- watchlist 메타데이터를 앱에서 읽을 때 1차 경로는 backend `GET /api/watchlists`다.
- 앱 저장 watchlist가 비어 있거나 사용자가 별도 경로를 지정하면, `hts_watch_lists/` 같은 CSV 기반 watchlist 또는 사용자가 직접 준 ticker 목록을 사용한다.
- 뉴스 / 기업 컨텍스트 / change / research page 저장의 canonical source는 여전히 `terminal/backend/backend/data/app.db`다.
- 가격 검산이 필요하면 `OHLC_data/ohlc_1d_watchlist.sqlite`를 사용한다.

### Glossary

- `watchlist`: 분석 대상을 제한하는 명시적 ticker 집합
- `watchlist source`: 그 ticker 집합이 온 위치 (`/api/watchlists`, CSV, chat ticker list 등)
- `직접 분석 대상`: 최종 `primary / secondary / watch` 후보 표와 본문에 남길 ticker
- `reference case`: 직접 분석 대상은 아니지만 유사사례 비교에 사용하는 과거 사례 ticker