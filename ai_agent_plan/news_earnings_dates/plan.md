# News Window Earnings Dates Plan

## PLAN CHANGE (2026-04-18)

이번 리비전에서 아래 요구사항을 추가 반영한다.

- recent / upcoming earnings date 옆에 `confirmed / unconfirmed` 상태도 함께 저장하고 표시한다.
- News Window의 `Update Earnings Dates` 실행 전, `fmp_calendar_earnings`가 **당일 기준 최신**인지 먼저 확인한다.
- 당일 `FMP Earnings Calendar Update`가 아직 실행되지 않았으면 News earnings update는 시작하지 않고, 먼저 Calendar Window의 `Update FMP Earnings Dates`를 실행하라는 오류 메시지를 보여준다.
- 이 gate는 frontend 힌트가 아니라 backend precondition으로 강제한다.
- freshness gate의 “당일” 기준은 **ET 날짜**로 고정한다.
- 컬럼 라벨은 축약형 `C/U`가 아니라 **`Confirmed / Unconfirmed` 풀텍스트**를 사용한다.
- News Window의 기존 IBKR calendar shortcut 3개(`Initial Calendar Backfill`, `Refresh Upcoming Calendar`, `Custom Calendar Update`)는 제거한다.
- 새 earnings update 진입점은 News Window 상단의 **기존 Update 메뉴 하위 항목**으로 넣는다.
- multi-ticker 기사에서는 대표 ticker를 **`ohlc_ticker -> 첫 ticker`** 규칙으로 고정한다.
- earnings update mode는 `Recent`를 두지 않고, **`Custom Earning Date Update` + `Check Unconfirmed Earning Date`** 두 가지로 구성한다.
- `Check Unconfirmed Earning Date`는 News Window에 보이는 unconfirmed earnings context를 다시 확인하고 수정하는 전용 버튼으로 둔다.

## 목표

News Window에서 사용자가 컬럼 선택 메뉴로 **어닝 날짜 컨텍스트**를 켤 수 있게 하고, 각 기사 `published_at` 시점을 기준으로 아래 정보를 한 컬럼 안에 함께 보여준다.

- 최근 어닝 날짜
- 다음 어닝 날짜
- 최근 어닝 `confirmed / unconfirmed`
- 다음 어닝 `confirmed / unconfirmed`

업데이트는 기본적으로 `calendar_events`가 들어 있는 로컬 DB를 우선 사용하고, DB만으로 직전/다음 어닝을 판단할 수 없는 기사만 FMP fallback으로 보완한다. 이미 계산이 끝난 기사는 기본적으로 건너뛴다. 단, 이 업데이트는 **당일 FMP earnings calendar update가 선행된 경우에만** 실행 가능해야 한다.

## 현재 레포 상태

이번 plan 작성 시점에 실제로 확인한 상태는 아래와 같다.

- Frontend News Window 컬럼 선택/렌더링 진입점:
	- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- Backend `/api/news` 조립 진입점:
	- `terminal/backend/src/services/newsRepository.ts`
- Backend 타입 정의:
	- `terminal/backend/src/types.ts`
- Frontend 타입 정의:
	- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`
- DB 스키마 진입점:
	- `terminal/backend/src/db.ts`
- Calendar DB 조회 진입점:
	- `terminal/backend/src/services/calendarRepository.ts`
- Job 기반 update endpoint 패턴:
	- `terminal/backend/src/server.ts`

확인된 사실:

- `news_items` 본문 데이터에 change/fulltext/ai 분석은 별도 enrichment 테이블로 붙는 구조다.
- `calendar_events`는 이미 존재하며, Calendar Window 데이터의 canonical source 역할을 한다.
- Calendar Window는 earnings row에 이미 `confirmed` 필드를 노출하고 있다.
- backend `calendarRepository`는 `confirmed`를 `meta_json.confirmed` 또는 actual 값 존재 여부로 계산해 응답한다.
- News Window에는 이미 `Change Update Recent / Custom`, `Fulltext Update` 같은 job 버튼 패턴이 있다.
- News Window Update 메뉴에는 현재 IBKR calendar shortcut 3개가 중복으로 들어 있다.
- 같은 IBKR calendar 기능은 별도 Data Control 경로에도 이미 존재한다.
- `GET /api/updates/status`가 이미 존재하고, extra key로 `fmp_calendar_earnings` 상태를 노출할 수 있다.
- 현재 존재하는 `POST /api/fmp/calendar/earnings/update`는 **default universe 전체 범위 동기화**용이다.
- `fmp_calendar_earnings` update는 range 내 기존 FMP earnings row를 snapshot-replace 하는 구조라서, 당일 refresh 여부가 실제 표시 결과에 영향을 준다.
- 위 endpoint는 기사별 missing row를 per-ticker로 싸게 보강하는 용도로는 바로 재사용하기 어렵다.
- FMP stable earnings source는 reliable time/session은 제공하지 않으므로, News Window 1차 버전은 `date + confirmed/unconfirmed`까지만 표시 대상으로 본다.

## 범위 / 비범위

이번 작업의 범위:

- News Window selectable column 1개 추가
- 기사별 recent/upcoming earnings context 계산 및 저장
- recent/upcoming 각각의 `confirmed / unconfirmed` 상태 계산 및 저장
- DB 우선 조회 + 부족한 경우 FMP fallback
- 기존 데이터가 있으면 skip하되, unconfirmed row는 별도 check mode에서 재확인하는 업데이트 버튼 추가
- News earnings update 실행 전 `fmp_calendar_earnings` 당일 freshness gate 추가
- freshness gate 실패 시 사용자에게 선행 액션을 알려주는 오류 메시지 표시
- News Window Update 메뉴에서 기존 IBKR calendar shortcut 3개 제거
- `/api/news` 응답에 earnings context 노출

이번 작업의 비범위:

- Calendar Window UI 자체 개편
- 기사 1행에 여러 ticker가 있을 때 여러 회사의 어닝 날짜를 동시에 나열하는 다중 셀 UI
- 연구 페이지(Model_100) 본문 자동 수정
- 전 종목 전체 calendar full refresh를 News Window 버튼에 직접 연결하는 방식

## 핵심 결정

### 1. 저장 위치

`news_items`에 컬럼을 직접 추가하지 않고, 별도 enrichment 테이블을 만든다.

권장 테이블명:

- `[][][]news_earnings_context[][][]`

권장 컬럼:

- `[][][]news_id[][][]` : `news_items.id` FK + PK
- `[][][]context_ticker[][][]` : 이 기사에서 어닝 컨텍스트를 계산한 대표 ticker
- `[][][]anchor_published_at[][][]` : 계산 기준 시각
- `[][][]recent_earnings_date[][][]` : `YYYY-MM-DD`, nullable
- `[][][]recent_earnings_confirmed[][][]` : `0 | 1 | null`
- `[][][]upcoming_earnings_date[][][]` : `YYYY-MM-DD`, nullable
- `[][][]upcoming_earnings_confirmed[][][]` : `0 | 1 | null`
- `[][][]recent_calendar_event_id[][][]` : nullable
- `[][][]upcoming_calendar_event_id[][][]` : nullable
- `[][][]recent_source[][][]` : `calendar | fmp | none`
- `[][][]upcoming_source[][][]` : `calendar | fmp | none`
- `[][][]lookup_status[][][]` : `resolved | partial | missing | error`
- `[][][]fmp_fallback_used[][][]` : `0 | 1`
- `[][][]last_checked_at[][][]` : ISO timestamp

이유:

- 현재 레포의 change/fulltext/ai 구조와 일관된다.
- skip 조건을 단순한 null 체크가 아니라 `이미 확인했는지`까지 포함해 관리할 수 있다.
- 나중에 session/time/source까지 확장해도 `news_items`를 오염시키지 않는다.
- Calendar Window와 동일한 source row의 `confirmed` 의미를 News Window까지 끌고 갈 수 있다.

### 2. 기사의 대표 ticker 결정 규칙

설명:

- 일부 뉴스 row는 ticker가 2개 이상 붙어 있다.
- 그런데 이번 기능의 earnings column은 한 셀에 **한 세트의 recent/upcoming earnings context**만 표시한다.
- 그래서 multi-ticker 기사에서는 “이 row를 대표하는 ticker 1개”를 먼저 정해야 한다.
- 예를 들어 기사 ticker가 `[META, GLW]`면, 두 회사의 earnings를 한 셀에 동시에 넣지 않고 대표 ticker 1개 기준으로 계산하자는 뜻이다.
- 여기서 묻고 있는 것은 “대표 ticker를 어떤 규칙으로 고를지”다.

확정 규칙:

- 1순위: `ohlc_ticker`
- 2순위: `tickers_csv`의 첫 ticker
- 둘 다 없으면 계산 대상에서 제외

이유:

- change column과 최대한 같은 대표 ticker를 쓰면 사용자가 셀 간 의미를 맞춰 보기 쉽다.
- 한 컬럼 안에 recent/upcoming 둘 다 보여줘야 하므로 multi-ticker 복합 표시는 1차 버전에서 복잡도가 너무 높다.

### 3. FMP fallback 방식

권장 방식:

- 기사 range를 훑다가 `calendar_events`에서 직전/다음 어닝 중 하나라도 못 찾은 ticker만 대상으로 한다.
- 기존 `POST /api/fmp/calendar/earnings/update`를 직접 호출하지 않고, **news earnings 전용 targeted fallback service**를 별도로 둔다.
- targeted fallback service는 기사 anchor date 기준 좁은 범위(예: `-180일 ~ +180일`)만 FMP에서 조회하고, 결과를 `calendar_events`에 upsert한 뒤 다시 recent/upcoming을 계산한다.

이유:

- 현재 route는 default universe 전체 범위 sync라서 News Window 버튼에 연결하면 과도하게 크다.
- 기사 missing row를 채우려면 ticker 기준의 좁은 보강이 더 적합하다.
- fallback 이후에도 최종 recent/upcoming은 `calendar_events` 재조회 결과를 기준으로 계산해야 Calendar Window와 의미가 맞는다.

### 4. confirmed / unconfirmed 의미

확정 규칙:

- `recent_earnings_confirmed = 1`이면 `Confirmed`
- `recent_earnings_confirmed = 0`이면 `Unconfirmed`
- `upcoming_earnings_confirmed = 1`이면 `Confirmed`
- `upcoming_earnings_confirmed = 0`이면 `Unconfirmed`
- 값이 `null`이면 날짜 자체가 없는 상태로 본다.

운영적 정의:

- canonical source는 `calendar_events -> mapCalendarRow().confirmed` 값이다.
- FMP fallback이 개입해도 UI에는 raw FMP 응답을 직접 쓰지 않고, `calendar_events` upsert 후 재조회된 `confirmed` 값을 사용한다.
- `confirmed = false`는 “실적 발표가 미확정/미확인 상태”를 의미하는 UI 라벨로 사용한다.

이유:

- Calendar Window와 의미를 맞추기 쉽다.
- News Window가 별도 boolean 해석 로직을 가지지 않게 된다.

### 5. freshness gate 규칙

확정 규칙:

- `POST /api/news/earnings/update-custom`
- `POST /api/news/earnings/check-unconfirmed`

위 두 endpoint는 job 생성 전에 `update_status.source_key = 'fmp_calendar_earnings'`를 먼저 확인한다.

pass 조건:

- `last_success_at`가 존재한다.
- `last_success_at`를 ET 기준 날짜로 변환했을 때 현재 ET 날짜와 같다.

권장 fail 동작:

- backend는 `412 Precondition Failed`를 반환한다.
- frontend는 backend message를 그대로 error banner / modal에 노출한다.
- 자동으로 calendar update를 대신 실행하지 않는다.

권장 에러 메시지:

- `오늘 FMP Earnings Calendar Update가 아직 실행되지 않았습니다. Calendar Window에서 Update FMP Earnings Dates를 먼저 실행한 뒤 다시 시도하세요.`

이유:

- News earnings context는 Calendar Window의 earnings dataset과 일치해야 한다.
- freshness gate를 frontend 힌트만으로 두면 직접 API 호출이나 race condition에서 우회될 수 있다.
- 자동 선행 실행은 사용자가 의도하지 않은 대규모 calendar write를 유발할 수 있다.

### 6. skip 기준

기본 skip 규칙:

- `news_earnings_context` row가 없으면 처리
- row가 있고 `lookup_status = resolved`이며 recent/upcoming이 모두 confirmed 또는 빈 값이면 skip
- row가 있고 `lookup_status = missing`이어도 기본은 skip
- row가 있고 `lookup_status = partial`면 missing side만 재시도
- `recent_earnings_confirmed = 0` 또는 `upcoming_earnings_confirmed = 0`인 row는 `Check Unconfirmed Earning Date` mode에서 재확인 대상이 된다.
- 강제 재계산은 별도 옵션이 없으면 제공하지 않음

이유:

- 사용자가 요구한 “데이터가 이미 있으면 넘어가기”를 충족한다.
- `missing`도 하나의 계산 결과로 취급해야 같은 row를 매번 다시 FMP로 때리지 않는다.
- unconfirmed earnings date는 나중에 확정되거나 날짜가 바뀔 수 있으므로, 일반 skip과 분리된 재확인 경로가 필요하다.

## 읽는 방법

이 문서는 아래 순서로 읽으면 된다.

1. `핵심 결정`에서 저장 위치, 대표 ticker, fallback 방향을 먼저 본다.
2. `핵심 결정`의 `confirmed / unconfirmed 의미`, `freshness gate 규칙`을 이어서 본다.
3. `단계별 계획`에서 실제 파일 수정 순서를 본다.
4. `미확정 사항`에서 구현 전 사용자 확인이 필요한 항목을 본다.
5. `검증 체크`에서 완료 기준을 본다.

## 목표 데이터 흐름

```text
News Window button click
-> backend precondition check (`fmp_calendar_earnings` freshness)
-> stale 이면 412 error + 선행 액션 메시지 반환
-> freshness 통과 시 backend job start
-> 기사 후보 조회(news_items)
-> 대표 ticker 결정(ohlc_ticker 우선)
-> news_earnings_context existing row 확인
-> skip 여부 판정
-> calendar_events에서 recent/upcoming 탐색
-> 각 recent/upcoming의 confirmed 값 확보
-> 부족한 기사만 FMP targeted fallback 호출
-> fallback 결과를 calendar_events upsert
-> recent/upcoming 재계산
-> news_earnings_context upsert
-> /api/news join 응답 노출
-> News Window column render
```

## 단계별 계획

## 구현 상태 스냅샷 (2026-04-18)

- Step 1~8 구현을 완료했고, backend/frontend 정적 검사와 빌드, backend 테스트, 런타임 API 검증까지 마쳤다.
- backend는 `newsEarningsContextService.ts`를 중심으로 calendar-first lookup, unresolved ticker 대상 FMP fallback, `news_earnings_context` upsert, freshness gate endpoint를 모두 연결했다.
- frontend는 News Window에 `Earnings Dates` 컬럼과 `Custom Earning Date Update`, `Check Unconfirmed Earning Date` 메뉴를 추가했고, 기존 IBKR calendar shortcut 3개는 제거했다.
- 런타임 검증에서는 stale 상태의 `POST /api/news/earnings/update-custom`가 `412 Precondition Failed`를 반환했고, 같은 날 `POST /api/fmp/calendar/earnings/update`를 1일 범위로 먼저 실행한 뒤에는 custom/unconfirmed endpoint 둘 다 `jobId`를 정상 반환했다.
- `2026-04-17` 기사 범위 custom job 샘플 결과는 `processed=707`, `resolved=373`, `partial=171`, `missing=163`, `fallbackTickers=135`, `fallbackMatchedRows=9`였고, `/api/news` 응답에서 `earnings_context_display`가 `Recent ... | Upcoming ...` 형식으로 채워지는 것을 확인했다.

### ✅ Step 1. 스키마와 타입 계약 추가

목표:

- 저장 테이블과 API 응답 필드를 먼저 고정한다.

예상 변경 파일:

- `terminal/backend/src/db.ts`
- `terminal/backend/src/types.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`

구현 메모:

- `news_earnings_context` 테이블 생성
- backend `NewsItem`에 planned field 추가
- frontend row 타입에도 대응 필드 추가
- recent/upcoming 각각의 confirmed boolean 필드 추가

권장 응답 필드:

- `[][][]earnings_context_ticker[][][]`
- `[][][]recent_earnings_date[][][]`
- `[][][]recent_earnings_confirmed[][][]`
- `[][][]upcoming_earnings_date[][][]`
- `[][][]upcoming_earnings_confirmed[][][]`
- `[][][]earnings_context_display[][][]`
- `[][][]earnings_lookup_status[][][]`

검증:

- 앱 기동 시 migration 에러가 없어야 함
- 새 테이블이 로컬 SQLite에 생성되어야 함
- `/api/news` 타입 오류가 없어야 함

리스크 / 완화:

- 응답 필드명이 backend/frontend에서 어긋날 수 있음
- 완화: Step 1에서 필드명을 먼저 고정하고 이후 단계에서 그 이름만 사용

사용자 확인 필요: 예

확인 포인트:

- separate table 유지가 맞는지

### ✅ Step 2. Calendar-first 조회 서비스 추가

목표:

- 기사 `published_at` 기준으로 직전/다음 earnings를 계산하는 순수 backend 서비스 추가

예상 변경 파일:

- `terminal/backend/src/services/calendarRepository.ts`
- `terminal/backend/src/services/` 하위 신규 service 파일 1개

구현 메모:

- 입력: `ticker`, `anchorPublishedAt`
- 출력: recent/upcoming earnings date + confirmed + event id + source
- 최근 어닝은 `event_date <= anchor date` 중 최대값
- 다음 어닝은 `event_date >= anchor date` 중 최소값
- event type은 earnings만 사용

운영적 정의:

- 기사 anchor는 `published_at`를 ET 날짜로 변환한 값(`getEtDateString`)을 기준으로 recent/upcoming을 판정한다.
- 1차 구현에서는 session(pre-market / after-market)까지 세밀 보정하지 않고 `date + confirmed` 기준 recent/upcoming만 계산한다.
- 같은 날짜 다중 row가 있으면 `confirmed 우선 -> source=FMP 우선 -> event_at 최신 -> id 최신` 순서로 deterministic tie-break를 적용한다.

실제 구현 결과:

- `terminal/backend/src/services/newsEarningsContextService.ts`에 calendar-first resolver를 추가했다.
- 대표 ticker는 `ohlc_ticker -> 첫 ticker` 규칙으로 고정했다.
- `lookup_status`는 `resolved / partial / missing`으로 계산하고 `error`는 재시도 대상으로 남긴다.

검증:

- known ticker/date 샘플 3건에 대해 SQL 결과와 service 결과가 일치해야 함
- `calendar_events`만으로 recent/upcoming이 둘 다 잡히는 기사 예제를 확인해야 함

리스크 / 완화:

- calendar row 중복/불완전 데이터로 최근/다음 판단이 흔들릴 수 있음
- 완화: event type filter와 deterministic tie-break를 고정

사용자 확인 필요: 예

확인 포인트:

- `date + confirmed` 계산으로 1차 구현하는지
- session-aware 보정이 필요한지

### ✅ Step 3. FMP targeted fallback 서비스 추가

목표:

- `calendar_events`만으로 recent/upcoming을 못 찾는 기사만 FMP로 보강한다.

예상 변경 파일:

- `terminal/backend/src/services/` 하위 신규 FMP earnings lookup service
- 필요 시 `terminal/backend/src/services/calendarRepository.ts`
- 필요 시 `terminal/backend/src/db.ts`의 upsert helper 연동부

구현 메모:

- 기존 `POST /api/fmp/calendar/earnings/update`는 default universe 전체 범위 sync 용도로 유지한다.
- News earnings 버튼은 별도 service를 호출한다.
- fallback 대상은 calendar-first 이후 unresolved가 남은 ticker만 추린다.
- 실제 호출 범위는 각 대상 기사의 anchor date를 기준으로 `-180일 ~ +180일` window를 만든 뒤, 그 전체를 덮는 단일 global range로 병합한다.
- fallback 결과는 `calendar_events`에 upsert 후 재조회하고, 최종 저장값은 raw FMP payload가 아니라 재조회된 `date + confirmed` 결과를 사용한다.

실제 구현 결과:

- `newsEarningsContextService.ts`가 unresolved ticker 집합과 merged range를 계산한 뒤 `fetchFmpEarningsCalendarChunk(...)`를 한 번 호출하는 구조로 구현됐다.
- fallback row는 `calendar_events`에 `source='FMP'`, `unique_key='FMP:earnings:TICKER:DATE'`로 upsert된다.
- custom job 샘플 검증에서 `fallbackTickers=135`, `fallbackFetchedRows=4000`, `fallbackMatchedRows=9`, `fallbackUpsertedRows=9`를 확인했다.

검증:

- calendar에 없는 ticker/date 샘플에서 fallback 후 `calendar_events` row가 생겨야 함
- fallback 직후 `news_earnings_context`가 `resolved` 또는 `partial`로 저장되어야 함

리스크 / 완화:

- FMP 호출량이 커질 수 있음
- 완화: per-ticker memoization, request interval, already-missing skip, range batching

사용자 확인 필요: 예

확인 포인트:

- fallback window를 180일로 둘지
- fallback이 실패한 row를 `missing`으로 고정할지

### ✅ Step 4. News earnings update job / endpoint 추가

목표:

- News Window에서 누를 수 있는 update 버튼 backend를 만든다.

예상 변경 파일:

- `terminal/backend/src/server.ts`
- `terminal/backend/src/services/newsRepository.ts`
- 신규 service 파일 1~2개

권장 endpoint 초안:

- `POST /api/news/earnings/update-custom`
- `POST /api/news/earnings/check-unconfirmed`
- 선택사항: `POST /api/news/earnings/update-custom/preflight`

실제 구현 결과:

- 이번 구현에서는 preflight endpoint 없이 바로 job을 생성하는 방식으로 마감했다.
- 두 endpoint 모두 `fmp_calendar_earnings` freshness를 ET 날짜 기준으로 검사하고 stale/missing이면 `412`를 즉시 반환한다.
- custom job은 `label = News Earnings Dates Update (Custom)`, unconfirmed job은 `label = Check Unconfirmed Earning Date`로 분리했다.

선행 gate:

- 위 endpoint는 공통 helper에서 `fmp_calendar_earnings` freshness를 먼저 검사한다.
- stale / missing이면 job을 만들지 않고 즉시 `412`를 반환한다.
- frontend는 이 메시지를 그대로 사용자에게 보여준다.

처리 순서:

`update-custom` 순서:

1. `fmp_calendar_earnings` freshness 검사
2. custom range 안의 `news_items` 조회
3. 대표 ticker 계산
4. existing `news_earnings_context` 조회
5. 일반 skip 규칙 적용
6. calendar-first lookup
7. 부족 row만 FMP targeted fallback
8. `news_earnings_context` upsert
9. job progress/log 반환

`check-unconfirmed` 순서:

1. `fmp_calendar_earnings` freshness 검사
2. 현재 News Window filter 기준으로 earnings context가 있는 기사 후보 조회
3. `recent_earnings_confirmed = 0` 또는 `upcoming_earnings_confirmed = 0` row만 추출
4. 대표 ticker 계산
5. calendar-first 재조회
6. 여전히 불충분한 row만 FMP targeted fallback
7. `news_earnings_context` upsert
8. `resolved / partial / missing` 재판정
9. job progress/log 반환

검증:

- endpoint 호출 시 jobId를 반환해야 함
- 같은 job 중복 실행 방지 패턴이 기존 change update와 같아야 함
- 로그에 `processed / skipped / fallbackUsed / missing` 집계가 남아야 함
- `fmp_calendar_earnings`가 당일 기준 stale이면 `412`와 선행 액션 메시지가 나와야 함
- `check-unconfirmed`는 confirmed row를 다시 훑지 않고 unconfirmed row만 대상으로 해야 함

리스크 / 완화:

- change update와 혼동되는 UX가 생길 수 있음
- 완화: label을 `News Earnings Dates Update`로 분리

사용자 확인 필요: 예

확인 포인트:

- custom에 preflight가 필요한지

### ✅ Step 5. `/api/news` join 및 응답 확장

목표:

- News Window 조회 응답에 earnings context를 자연스럽게 붙인다.

예상 변경 파일:

- `terminal/backend/src/services/newsRepository.ts`
- `terminal/backend/src/types.ts`

구현 메모:

- `news_items ni` 기준 조회에 `LEFT JOIN news_earnings_context nec ON nec.news_id = ni.id`
- display 문자열은 backend 또는 frontend 한쪽에서만 만들고 중복 생성하지 않는다.
- 1차 권장: backend에서 `[][][]earnings_context_display[][][]`까지 만들어 전달

권장 표시 형식:

- 값 둘 다 있으면: `Recent 2026-02-19 (Confirmed) | Upcoming 2026-04-30 (Unconfirmed)`
- recent만 있으면: `Recent 2026-02-19 (Confirmed) | Upcoming -`
- upcoming만 있으면: `Recent - | Upcoming 2026-04-30 (Unconfirmed)`
- 둘 다 없고 `missing`이면: `Recent - | Upcoming -`

표시 규칙:

- 축약형 `C/U`는 사용하지 않는다.
- 컬럼 본문에서 `Confirmed / Unconfirmed`를 풀텍스트로 직접 노출한다.
- 필요 시 tooltip은 같은 문자열의 줄바꿈 버전을 제공한다.

검증:

- `/api/news`에서 새 필드가 JSON에 포함되어야 함
- 기존 change/fulltext/analysis 필드와 충돌하지 않아야 함

리스크 / 완화:

- join 추가로 응답이 느려질 수 있음
- 완화: `news_earnings_context.news_id` PK 인덱스 사용, 필요 시 `context_ticker` 보조 인덱스 추가

실제 구현 결과:

- `/api/news`, `/api/news/:id`, `/api/model1/news`, `/api/model1/news/:id`에 모두 `LEFT JOIN news_earnings_context`를 연결했다.
- backend가 `earnings_context_display`를 직접 조합해서 전달하도록 고정했다.
- 런타임 검증에서 `/api/news?from=2026-04-17&to=2026-04-17&pageSize=10` 응답에 `Recent 2026-01-28 (Confirmed) | Upcoming 2026-04-22 (Unconfirmed)` 형식이 포함되는 것을 확인했다.

사용자 확인 필요: 아니오

### ✅ Step 6. News Window 컬럼 추가

목표:

- 사용자가 Columns 메뉴에서 earnings dates 컬럼을 켜고 끌 수 있게 한다.

예상 변경 파일:

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- 필요 시 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/types.ts`

구현 메모:

- `ColumnId`에 새 id 추가
- Columns menu label 추가
- render cell 추가
- 기본 visible column에는 넣지 말고 selectable only로 시작하는 안을 우선 권장
- 셀은 recent/upcoming 날짜와 `Confirmed / Unconfirmed` 풀텍스트를 함께 렌더링한다.

실제 구현 결과:

- `earningsDates` 컬럼 id와 `Earnings Dates` label을 추가했다.
- 기본 숨김 컬럼으로 두고, Columns 메뉴에서 선택해서 켜는 방식으로 마감했다.
- 정렬 키와 cell renderer를 함께 추가해 API 문자열과 개별 raw 필드 둘 다 활용할 수 있게 했다.

권장 컬럼 id / label:

- `[][][]earningsDates[][][]`
- label: `Earnings Dates`

검증:

- Columns 메뉴에서 토글 가능해야 함
- 셀에서 combined string이 한 컬럼으로 보여야 함
- confirmed / unconfirmed 상태가 셀 안에서 함께 보여야 함
- narrow width에서도 레이아웃이 무너지지 않아야 함

리스크 / 완화:

- 셀 폭이 너무 좁으면 가독성이 나빠질 수 있음
- 완화: nowrap + tooltip 또는 fixed min width 적용

사용자 확인 필요: 예

확인 포인트:

- 기본 숨김 컬럼으로 둘지

### ✅ Step 7. News Window update 버튼 추가

목표:

- 사용자가 News Window에서 earnings-date enrichment job을 직접 시작할 수 있게 한다.

예상 변경 파일:

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`

구현 메모:

- 기존 Change Update / Fulltext Update 패턴을 그대로 따른다.
- 확정 UI:
	- News Window 상단의 기존 `Update` 메뉴 하위 항목
	- `Custom Earning Date Update`
	- `Check Unconfirmed Earning Date`
- job category는 기존 `news-update` 재사용 또는 세분화 검토
- stale 상태에서 backend가 `412`를 반환하면, UI는 `Calendar Window에서 Update FMP Earnings Dates를 먼저 실행`하라는 error banner / modal을 띄운다.
- 기존 `Initial Calendar Backfill`, `Refresh Upcoming Calendar`, `Custom Calendar Update` 3개는 News Window Update 메뉴에서 제거한다.
- IBKR calendar 유지보수 진입점은 Data Control 쪽에 남기고, earnings freshness 관련 사용자 액션은 Calendar Window의 `Update FMP Earnings Dates`로 수렴한다.
- `Custom Earning Date Update`는 사용자가 지정한 날짜 범위의 기사에 대해 earnings context를 계산한다.
- `Check Unconfirmed Earning Date`는 현재 News Window 결과 중 unconfirmed earnings context row만 다시 확인하고 수정한다.

검증:

- 버튼 클릭 시 backend job 시작
- 완료 후 reload 시 새 컬럼 값이 채워져야 함
- 중복 실행 시 existing job 안내가 떠야 함
- 당일 `fmp_calendar_earnings` 미실행 상태에서는 job이 시작되지 않고 오류 메시지가 보여야 함
- News Window Update 메뉴에서 기존 calendar shortcut 3개가 보이지 않아야 함
- `Check Unconfirmed Earning Date` 실행 시 confirmed row는 건드리지 않고 unconfirmed row만 재확인해야 함

리스크 / 완화:

- 버튼이 많아져 상단 툴바가 복잡해질 수 있음
- 완화: 기존 Update 메뉴 안 하위 항목으로 넣기

실제 구현 결과:

- News Window Update 메뉴에 `Custom Earning Date Update`, `Check Unconfirmed Earning Date`를 추가했다.
- 기존 `Initial Calendar Backfill`, `Refresh Upcoming Calendar`, `Custom Calendar Update` 3개는 제거했다.
- 기존 custom calendar 모달은 기사 날짜 범위를 입력받는 earnings-date 모달로 재사용했고, How To Use 문구도 earnings 흐름에 맞게 수정했다.

사용자 확인 필요: 예

확인 포인트:

- `Check Unconfirmed Earning Date`라는 문구를 그대로 쓸지, 더 짧게 줄일지

### ✅ Step 8. 검증, 문서, 회귀 점검

목표:

- 실제 데이터로 end-to-end 검증하고, 이후 반복 실행 시 skip 동작을 보장한다.

예상 변경 파일:

- 필요 시 관련 md 문서
- 필요 시 tmp 검증 스크립트

권장 검증 항목:

- DB row count before/after
- 동일 range 재실행 시 skipped count 증가
- calendar-only로 해결된 row 수 / FMP fallback 사용 row 수 분리 확인
- multi-ticker 기사에서 대표 ticker가 기대와 맞는지 샘플 확인
- recent/upcoming의 confirmed 값이 Calendar Window row와 동일한지 샘플 확인
- stale `fmp_calendar_earnings` 상태에서 News earnings update가 차단되는지 확인
- `Check Unconfirmed Earning Date` 실행 후 unconfirmed row 일부가 confirmed 또는 새 날짜로 갱신되는지 확인

실제 검증 결과:

- 정적 분석: 수정된 backend/frontend 대상 파일 `get_errors` 기준 0 errors
- backend 빌드: `npm run build -w backend` 성공
- backend 테스트: `vitest run` 94/94 pass
- frontend 빌드: `npm run build` 성공
- freshness gate: stale 상태의 `POST /api/news/earnings/update-custom`가 `412`와 선행 액션 메시지를 반환하는 것 확인
- same-day refresh 후 success path: `POST /api/fmp/calendar/earnings/update` 1일 범위 job 성공 후 `POST /api/news/earnings/update-custom`, `POST /api/news/earnings/check-unconfirmed`가 모두 `jobId`를 반환하는 것 확인
- custom runtime sample: `processed=707`, `resolved=373`, `partial=171`, `missing=163`, `fallbackTickers=135`
- `/api/news` payload sample: `earnings_context_ticker`, `recent_earnings_date`, `upcoming_earnings_date`, `earnings_context_display`, `earnings_lookup_status`가 함께 응답되는 것 확인

예시 수동 체크:

- SQL: `news_earnings_context` row가 `news_items`와 1:1로 붙는지 확인
- API: `/api/news?...` 응답에 `[][][]earnings_context_display[][][]` 포함 확인
- API: `/api/updates/status`에서 `fmp_calendar_earnings.lastSuccessAt` 확인
- UI: 컬럼 토글 + update 버튼 + 완료 후 값 표시 확인
- UI: stale 상태에서 error message가 보이는지 확인

리스크 / 완화:

- 동일 기사 반복 실행 시 fallback이 다시 호출될 수 있음
- 완화: `lookup_status`와 `last_checked_at` 기준 skip 강제

사용자 확인 필요: 예

확인 포인트:

- 샘플 ticker 3~5개로 검증 후 전체로 넓힐지

## 검증 체크

완료 기준은 아래와 같다.

- News Window Columns 메뉴에 `Earnings Dates`가 보인다.
- 컬럼 1개 안에서 recent/upcoming과 confirmed/unconfirmed가 같이 보인다.
- `Custom Earning Date Update` 버튼이 기사 range를 대상으로 job을 시작한다.
- `Check Unconfirmed Earning Date` 버튼이 현재 News Window의 unconfirmed row만 대상으로 job을 시작한다.
- `calendar_events`만으로 가능한 row는 FMP를 치지 않는다.
- `calendar_events`로 부족한 row만 FMP fallback을 탄다.
- 이미 계산된 row는 재실행 시 skip된다.
- 당일 `fmp_calendar_earnings`가 없으면 update 버튼은 backend에서 차단되고, 선행 액션 오류 메시지가 보인다.
- News Window Update 메뉴에서 기존 IBKR calendar shortcut 3개는 제거되어야 한다.
- `/api/news` 응답에 earnings context 필드가 안정적으로 포함된다.

## 미확정 사항

구현 전 사용자 확인이 필요한 질문:

1. recent/upcoming 계산을 1차로 `date + confirmed`까지만 출시해도 되는가, 아니면 session(pre/after market) 보정이 필수인가?
2. `Check Unconfirmed Earning Date` 문구를 그대로 쓸지, 더 짧게 줄일지?

## 실행 의존성 그래프

```text
Step 1 schema/type
	-> Step 2 calendar-first lookup
	-> Step 3 FMP targeted fallback
	-> Step 4 update endpoints/job
	-> Step 5 /api/news join
	-> Step 6 frontend column
	-> Step 7 frontend update button
	-> Step 8 verification/documentation
```

## 구현 착수 전 요약

가장 중요한 설계 포인트는 아래 4개다.

- `calendar_events`를 primary source로 유지한다.
- 기사별 earnings 결과는 `news_items`에 직접 넣지 말고 `news_earnings_context`로 분리 저장한다.
- FMP fallback은 기존 default-universe calendar sync를 재사용하지 말고, news enrichment 전용 targeted lookup으로 설계한다.
- News earnings update는 `fmp_calendar_earnings` 당일 freshness gate를 backend에서 통과한 경우에만 실행한다.
