# Plan — terminal_ui_ver6_fmp

> ℹ️ 이 문서는 2026-03-20 기준 `terminal_ui_ver6_fmp` 작업의 **구현 계획서**다. 현재 목표는 기존 Finnhub 기반 SEC filing 수집을 FMP 기반으로 전환하고, 기존 SEC 데이터를 안전하게 정리한 뒤, UI에 `fmp stock` 전용 필터와 `recent/custom fmp stock update` 동작을 추가하는 것이다.

### 목표
- 기존 `POST /api/news/pull-finhub-sec` 흐름을 FMP 기반 SEC filing 수집 흐름으로 교체하거나, 최소한 동일 역할의 FMP 전용 경로로 대체한다.
- 기존 DB에 저장된 SEC 관련 row를 **안전한 범위 제한 + 사전 검증 + 트랜잭션** 기준으로 정리한다.
- 뉴스 UI에서 `market_news` 오른쪽에 `fmp stock` 전용 필터 버튼을 추가한다.
- 업데이트 메뉴에 `recent fmp stock update`, `custom fmp stock update` 버튼을 추가하고, 기존 `recent/custom` 패턴과 동일한 조작 경험을 유지한다.
- 변경 후 사용자가 직접 확인 가능한 검증 절차를 문서에 남긴다.

### 이번 작업의 확정 범위
- backend
  - SEC filing provider 전환
  - SEC 관련 DB 삭제 로직 또는 안전 삭제 절차 추가
  - FMP stock-latest pull endpoint 재사용 또는 전용 endpoint 연결
- frontend
  - `fmp stock` 필터 버튼 추가
  - `recent/custom fmp stock update` 메뉴 추가
  - 기존 update progress / job polling 흐름과 연결
- 문서
  - 본 `plan.md`
  - 진행 기록 `agent_log.md`
  - 필요 시 backend 동작 설명 문서 동기화

### 비범위
- press release 구독 제한 해제 자체
- 전체 뉴스 시스템 구조 개편
- 기존 company news / press release / market news 동작 변경
- 사용자 요청이 없는 mock 데이터 추가

### 현재 레포 상태(확인됨)
- 기존 SEC filing 수집 backend route는 `terminal/backend/src/server.ts`의 `POST /api/news/pull-finhub-sec`다.
- 이 route는 Finnhub `/stock/filings`를 사용하고, 저장 시 다음 규칙을 따른다.
  - `news_items`: `source='FINNHUB'`, `source_type='sec_filing'`
  - `sec_filings`: companion row 저장
- `sec_filings.news_id`는 `news_items.id`를 참조하며 `ON DELETE CASCADE`다.
  - 즉, 부모 `news_items`를 정확히 지우면 연결된 `sec_filings` row도 함께 제거된다.
- 현재 SEC anchor 계산도 Finnhub 기준이다.
  - `terminal/backend/src/services/finnhubSecProvider.ts`의 `getSecFilingAnchorMap()`은 `source='FINNHUB' AND source_type='sec_filing'`만 본다.
- 프론트엔드 SEC update 버튼은 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`에서 `POST /api/news/pull-finhub-sec`를 직접 호출한다.
- 같은 컴포넌트의 source type 필터에는 현재 `all`, `company_news`, `press_release`, `sec_filing`, `market_news`가 있다.
- 같은 컴포넌트의 update dropdown에는 이미 아래 구조가 있다.
  - `Recent Update`
  - `Custom Update`
  - `SEC Filing`
  - `PTPR Press Release`
- 이번 대화에서 현재 FMP key로 `stable/news/stock-latest` 접근 가능은 이미 live probe로 확인되었다.

### 최근 live probe로 추가 확인된 사실(2026-03-20 19:13)

#### FMP press release 접근 상태
- 현재 갱신된 FMP 구독 기준으로 아래 endpoint는 실제 `200 OK` 응답을 반환했다.
  - `stable/news/press-releases-latest`
  - `stable/news/press-releases?symbols=AAPL`
- `press-releases-latest` 샘플 응답은 실제 publisher/site/url을 포함했다.
  - 예: `Accesswire`, `accessnewswire.com`
- 따라서 현재 상태는 `FMP press release 사용 가능`으로 본다.
- 반면 `stable/search-press-releases?symbol=AAPL`는 이번 확인에서 `404`가 나왔으므로, 이 endpoint는 별도 파라미터/경로 재확인이 필요하다.

#### RTPR 대비 FMP press release 비교
- latest feed 기준으로 FMP와 RTPR는 상당 부분 겹친다.
  - 비교 결과: FMP latest `20건`, RTPR latest `50건`, 제목 교집합 `13건`
- latest feed 기준 publisher/배포 채널 계열은 실제로 많이 겹친다.
  - FMP URL 도메인: `businesswire.com`, `newsfilecorp.com`, `globenewswire.com`, `accessnewswire.com`, `prnewswire.com`
  - RTPR author: `ACCESSWIRE`, `Newsfile Corp`, `Business Wire`, `Globe Newswire`, `PR Newswire`
- 하지만 두 플랫폼은 **동일 데이터셋**이 아니다.
  - latest feed 건수와 구성 비중이 다르다.
  - ticker 매핑이 다르게 붙는 사례가 실제로 확인되었다.
- 같은 제목인데 ticker가 다르게 매핑된 실제 사례가 있었다.
  - `Carlyle Commodities Announces Resignation of Vice President of Exploration`
    - FMP: `CG`
    - RTPR: `CCC`
  - `Defence Therapeutics Announces Warrant Terms Amendment`
    - FMP: `DTCFF`
    - RTPR: `DTC`
  - `HTGC CLASS ACTION NOTICE ... Hercules Capital ...`
    - FMP: `HCXY`
    - RTPR: `HTGC`
  - `ROSEN ... ODDITY Tech Ltd ...`
    - FMP: `LAW`
    - RTPR: `ODD`
- 따라서 “같은 기간 + 같은 ticker면 같은 press release 결과가 나와야 한다”는 가정은 현재 live probe 결과와 맞지 않는다.

#### 최근 7일 ticker 비교(RKLB, RCAT)
- 최근 7일 컷오프 기준 직접 비교 결과:
  - `RKLB`
    - FMP `2건`
    - RTPR `1건`
    - 제목 교집합 `1건`
    - 공통 제목: `Mission Success: Rocket Lab Launches Latest Satellite for Synspective`
  - `RCAT`
    - FMP `1건`
    - RTPR `0건`
    - 제목 교집합 `0건`
- 이 비교는 같은 최근 구간에서도 결과셋이 완전히 일치하지 않음을 보여준다.

#### FMP text 필드와 full text
- FMP `press-releases-latest`, `press-releases?symbols=...`, `stock-latest` 응답에는 `text` 필드가 있다.
- 하지만 현재 확인 기준 `text`는 full text 전체가 아니라 짧은 본문 발췌/요약에 가깝다.
  - 샘플 press release 1건 비교:
    - FMP `text` 길이: `267자`
    - 같은 원문 페이지 추출 텍스트 길이: `8923자`
- 따라서 press release/news 계열에서 FMP `text`만으로 RTPR의 HTML/fulltext 저장 전략을 완전히 대체한다고 가정하면 안 된다.
- 반면 `stable/fmp-articles`는 `content` 필드를 제공했고, 샘플 길이도 `2686자` 수준으로 더 긴 본문형 데이터에 가깝다.

### 핵심 설계 원칙
1. **안전 삭제 우선**
   - 기존 SEC 삭제는 “SEC 관련 row만 정확히 한정”해야 한다.
   - broad delete 금지. `news_items` 전체 삭제 금지.
2. **기존 UX 패턴 재사용**
   - `recent/custom`의 form, confirm, job polling, progress 표시는 기존 뉴스 update와 동일 패턴을 유지한다.
3. **source 구분 명확화**
   - Finnhub SEC와 FMP stock-latest는 source/source_type 라벨이 섞이지 않게 분리한다.
4. **점진 전환**
   - 가능하면 새 구현을 먼저 추가하고, 검증 뒤에 기존 Finnhub SEC 버튼/route를 정리한다.

### Glossary
- `기존 SEC 데이터`
  - 현재 DB에 저장된 `news_items.source='FINNHUB' AND news_items.source_type='sec_filing'` row와, 그 row에 연결된 `sec_filings` row를 뜻한다.
- `안전 삭제`
  - 삭제 전 count 확인, 삭제 범위 출력, 트랜잭션 실행, 삭제 후 count 재확인, 실패 시 rollback 가능한 절차를 뜻한다.
- `fmp stock`
  - 이번 작업에서 새로 추가할 UI 필터 이름이다. FMP `stock-latest` 또는 그와 동등한 FMP 종목 뉴스 update 결과만 별도로 보이게 하는 용도다.
- `recent fmp stock update`
  - 기존 recent update와 유사하게 최근 구간만 FMP stock 뉴스 갱신을 시작하는 동작이다.
- `custom fmp stock update`
  - 사용자가 날짜 범위를 지정해서 FMP stock 뉴스 갱신을 시작하는 동작이다.

### 작업 전 확인 사항
1. FMP SEC에 사용할 실제 endpoint와 response shape를 먼저 고정해야 한다.
   - 현재 live probe로 최소 접근 확인된 것은 `sec-filings-financials`다.
   - 하지만 기존 Finnhub `/stock/filings`와 같은 필드 수준인지, ticker/date 범위 입력 방식이 같은지는 구현 전 추가 확인이 필요하다.
2. `fmp stock` UI는 단순 label 추가가 아니라 backend query/filter 조건과 함께 맞물려야 한다.
3. 기존 SEC 버튼을 완전 제거할지, 임시로 숨길지, FMP로 이름을 바꿔 재사용할지는 구현 중 선택 포인트다.
4. press release를 FMP로까지 통합할지는 별도 결정이 필요하다.
  - 이유: FMP press release는 접근 가능하지만, RTPR와 결과셋이 완전히 같지 않고, FMP `text`는 full text 전체가 아니다.

### 단계별 계획(각 단계: 구현 → 검증 → 사용자 확인 요청)

#### ⬜ Step 1 — FMP SEC 수집 스펙 고정

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 1-1 | FMP SEC endpoint 후보와 요청 파라미터를 확정 | `terminal/backend/src/services/*`, 본 문서 | endpoint, symbol/date 입력 방식 기록 | ⬜ |
| 1-2 | 기존 Finnhub SEC mapped shape와 FMP 응답 shape를 비교 | `terminal/backend/src/services/finnhubSecProvider.ts` | title/body/url/dedup key 재현 가능 여부 확인 | ⬜ |
| 1-3 | FMP 기준 dedup key, `source`, `source_type`, anchor 기준을 정한다 | `terminal/backend/src/server.ts`, provider 파일 | 중복 삽입/최근 업데이트 기준 정의 | ⬜ |

- `1-1` 목적: 전환 대상을 정확히 고정하기 위함. 설명: “FMP SEC”라고만 적으면 구현 중 endpoint가 흔들린다.
  - 완료 조건: 사용할 endpoint, 필수 query parameter, 응답 핵심 필드가 문서 또는 로그에 확정된다.
  - 사람 검증: ticker/date 기준으로 어떤 요청을 보내는지 설명을 보고 이해할 수 있다.
  - 리스크: endpoint가 기존 Finnhub와 다르면 custom/recent semantics가 바뀔 수 있다.
  - 완화: provider 레벨에서 공통 mapped shape를 유지한다.
- `1-2` 목적: backend 저장 스키마를 보존하기 위함. 설명: `news_items`와 `sec_filings`에 무엇을 넣을지 먼저 맞춰야 한다.
  - 완료 조건: FMP 응답으로 `title`, `body`, `publishedAt`, `url`, accession/form/cik 등 저장 값이 결정된다.
  - 사람 검증: 기존 SEC row와 새 row가 어떤 점에서 같고 다른지 표로 설명 가능하다.
  - 리스크: FMP에 accession 수준 고유 키가 없으면 dedup이 불안정해진다.
  - 완화: 공식 고유 식별자 또는 URL 기반 합성 key를 설계한다.
- `1-3` 목적: recent update가 다시 동작하도록 기준을 세우기 위함. 설명: anchor 기준이 Finnhub 고정이면 전환 후 recent가 깨진다.
  - 완료 조건: `source/source_type`와 최근 anchor 조회 기준이 FMP용으로 정리된다.
  - 사람 검증: “최근 업데이트가 어디부터 다시 시작되는지”를 말로 설명할 수 있다.
  - 리스크: Finnhub row와 FMP row가 섞이면 recent 기준이 왜곡된다.
  - 완화: source를 분리하고, 필요 시 마이그레이션 시점에 기존 SEC row를 비운 뒤 FMP만 anchor 대상으로 삼는다.

검증 훅:
```powershell
rg -n "pull-finhub-sec|sec_filing|sec-filings|accession" c:\github_coding\terminal_sec\terminal\backend\src
```
사용자 확인 필요: 예

#### ⬜ Step 2 — 기존 SEC DB 안전 삭제 설계 및 실행

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 2-1 | 삭제 대상 row 범위를 쿼리로 고정 | `terminal/backend/src/db.ts`, `terminal/backend/src/server.ts` | 삭제 전 count 확인 | ⬜ |
| 2-2 | 백업/사전 출력/트랜잭션 기반 삭제 절차를 구현 | backend route 또는 유지보수 함수 | rollback 가능 여부 확인 | ⬜ |
| 2-3 | 삭제 후 `news_items`/`sec_filings` 잔존 row를 재검증 | DB 조회 스크립트 또는 route 응답 | 삭제 후 count=0 확인 | ⬜ |

- `2-1` 목적: 삭제 범위를 과도하게 넓히지 않기 위함. 설명: 이번 삭제 대상은 `FINNHUB + sec_filing` 조합만이다.
  - 완료 조건: 아래 두 count가 구현 전/후 모두 확인된다.
    - `news_items WHERE source='FINNHUB' AND source_type='sec_filing'`
    - 그 row와 연결된 `sec_filings`
  - 사람 검증: 삭제 전에 몇 건이 지워질지 숫자로 본다.
  - 리스크: source_type만 보고 지우면 다른 provider SEC row까지 지울 수 있다.
  - 완화: `source='FINNHUB' AND source_type='sec_filing'`를 동시 조건으로 고정한다.
- `2-2` 목적: 실패 시 원복 가능성을 확보하기 위함. 설명: 삭제는 한 번에 성공하거나, 실패하면 아무것도 지워지지 않아야 한다.
  - 완료 조건: 트랜잭션 내에서 삭제가 수행되고, 실패 시 rollback 경로가 있다.
  - 사람 검증: 삭제 route 또는 스크립트가 `deleted_news_items`, `deleted_sec_filings`, `before_count`, `after_count`를 반환하거나 로그로 남긴다.
  - 리스크: `sec_filings`만 직접 지우고 부모가 남으면 불일치가 생길 수 있다.
  - 완화: 기본 전략은 부모 `news_items`를 조건 삭제하고, cascade 결과를 검증한다.
- `2-3` 목적: 안전 삭제를 “실제로 확인된 상태”로 만들기 위함. 설명: 삭제 성공 메시지만으로는 충분하지 않다.
  - 완료 조건: 삭제 후 count 쿼리에서 0 또는 기대 잔존 수가 확인된다.
  - 사람 검증: 삭제 전/후 숫자를 직접 비교할 수 있다.
  - 리스크: UI 캐시나 최근 조회 결과가 남아 삭제가 안 된 것처럼 보일 수 있다.
  - 완화: DB count 검증과 UI reload 검증을 분리한다.

권장 삭제 순서:
1. 삭제 대상 count 조회
2. 삭제 대상 샘플 5건 출력
3. 트랜잭션 시작
4. `news_items`에서 `source='FINNHUB' AND source_type='sec_filing'` 조건 삭제
5. cascade 또는 후속 count로 `sec_filings` 정리 여부 확인
6. commit
7. 삭제 후 count 재조회

검증 훅:
```powershell
rg -n "sec_filings|source_type = 'sec_filing'|source = 'FINNHUB'" c:\github_coding\terminal_sec\terminal\backend\src
```
사용자 확인 필요: 예

#### ⬜ Step 3 — Backend FMP SEC provider 및 route 전환

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 3-1 | FMP SEC provider 파일 추가 또는 기존 provider 대체 | `terminal/backend/src/services/*.ts` | 타입 체크 및 샘플 응답 매핑 확인 | ⬜ |
| 3-2 | server route를 FMP 기준으로 전환 | `terminal/backend/src/server.ts` | recent/custom 호출 성공 여부 확인 | ⬜ |
| 3-3 | anchor, inserted count, skipped count, error handling을 FMP 기준으로 조정 | `terminal/backend/src/server.ts` | recent mode 재호출 시 중복 폭주 없음 확인 | ⬜ |

- `3-1` 목적: provider 책임을 분리해 유지보수하기 위함. 설명: Finnhub SEC와 FMP SEC를 한 함수에 섞지 않는다.
  - 완료 조건: FMP SEC fetch/mapping/retry 로직이 별도 함수 또는 별도 파일에 정리된다.
  - 사람 검증: 어느 endpoint를 쓰는지 파일명과 함수명만 봐도 알 수 있다.
  - 리스크: response shape 차이로 런타임 parse error가 날 수 있다.
  - 완화: 샘플 응답 기반 field guard를 넣고, 없는 필드는 명시적으로 fallback 처리한다.
- `3-2` 목적: 프론트엔드 호출을 깨지 않고 backend만 바꿀 수 있게 하기 위함. 설명: route 이름 유지 vs 새 route 추가 중 더 안전한 쪽을 선택한다.
  - 완료 조건: UI에서 recent/custom SEC 액션을 눌렀을 때 실제 FMP 기반 job이 시작된다.
  - 사람 검증: 버튼 클릭 후 job id 생성과 진행 상태가 보인다.
  - 리스크: 기존 route 이름을 바꾸면 프론트가 깨질 수 있다.
  - 완화: 1차는 route 이름을 유지하고 내부 provider만 교체하는 방식을 우선 검토한다.
- `3-3` 목적: 전환 후 recent update 품질을 유지하기 위함. 설명: anchor, dedup, stats가 바뀌면 운영 중 문제를 빨리 못 본다.
  - 완료 조건: job summary에 inserted/skipped/errors가 정상 집계된다.
  - 사람 검증: 같은 recent 요청을 연속 실행했을 때 duplicate insert가 급증하지 않는다.
  - 리스크: 기존 Finnhub anchor 데이터가 남아 recent 기준이 부정확할 수 있다.
  - 완화: Step 2 삭제 완료 후 FMP 기준 anchor만 남기는 흐름으로 연결한다.

검증 훅:
```powershell
npm.cmd run build
```
사용자 확인 필요: 예

#### ⬜ Step 4 — `fmp stock` 필터 및 update 버튼 추가

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 4-1 | source type/filter state에 `fmp stock` 축을 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 필터 버튼 표시와 클릭 상태 확인 | ⬜ |
| 4-2 | `recent fmp stock update` 버튼 추가 | 같은 파일 | 버튼 클릭 시 job 시작 확인 | ⬜ |
| 4-3 | `custom fmp stock update` 버튼 추가 | 같은 파일 | date modal/open state/submit 확인 | ⬜ |
| 4-4 | market news 오른쪽 배치 및 텍스트 라벨 조정 | 같은 파일 | UI 배치 확인 | ⬜ |

- `4-1` 목적: FMP stock 뉴스만 바로 분리해서 보기 위함. 설명: 기존 `market_news`와 다른 source group으로 보여야 한다.
  - 완료 조건: `market news` 오른쪽에 `fmp stock` 버튼이 나타나고, 선택 시 해당 데이터만 필터된다.
  - 사람 검증: 버튼을 눌렀을 때 리스트가 바뀌고 active style이 보인다.
  - 리스크: 필터 label만 추가하고 query 조건이 없으면 아무 변화가 없다.
  - 완화: backend response의 source/sourceType 기준 filter predicate를 함께 수정한다.
- `4-2` 목적: 최근 구간만 빠르게 갱신하기 위함. 설명: 기존 recent update UX와 같은 방식으로 FMP stock만 시작한다.
  - 완료 조건: 메뉴에 `recent fmp stock update`가 보이고 눌렀을 때 올바른 API payload가 전송된다.
  - 사람 검증: 버튼 클릭 후 job 시작 토스트/상태가 보인다.
  - 리스크: 기존 recent handler를 그대로 재사용하면 sourceType 매핑이 잘못될 수 있다.
  - 완화: FMP stock 전용 handler 또는 명시적 source argument를 둔다.
- `4-3` 목적: 범위 지정 update를 지원하기 위함. 설명: 기존 custom modal 흐름을 복제하되 FMP stock 전용 submit으로 연결한다.
  - 완료 조건: 시작일/종료일을 넣고 job 실행이 가능하다.
  - 사람 검증: 잘못된 날짜 범위에서 validation이 유지된다.
  - 리스크: modal state를 기존 SEC/custom과 공유하면 충돌할 수 있다.
  - 완화: state 변수명을 분리하거나 공통 modal이라면 action type을 명확히 분기한다.
- `4-4` 목적: 사용자가 요청한 위치/명칭을 맞추기 위함. 설명: `market news` 오른쪽, 이름은 정확히 `fmp stock`으로 둔다.
  - 완료 조건: UI에서 위치와 이름이 요구사항과 일치한다.
  - 사람 검증: 버튼 순서를 눈으로 확인할 수 있다.
  - 리스크: 기존 레이아웃 폭이 부족해 줄바꿈이나 overflow가 생길 수 있다.
  - 완화: button group wrap 또는 간격 조정으로 모바일/좁은 폭도 확인한다.

검증 훅:
```powershell
rg -n "market_news|sec_filing|Recent Update|Custom Update" c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub\src\app\components\FinnhubNewsWindow.tsx
```
사용자 확인 필요: 예

#### ⬜ Step 5 — 통합 검증 및 문서 동기화

| 세부 단계 | 작업 | 주요 파일 | 검증 | 상태 |
|-----------|------|----------|------|------|
| 5-1 | backend build / 오류 점검 | `terminal/backend` | build 성공 | ⬜ |
| 5-2 | UI 수동 검증 | web UI | 필터/버튼/업데이트 동작 확인 | ⬜ |
| 5-3 | backend 설명 문서 동기화 필요 여부 확인 | `terminal/backend_prompt.md` | route/provider 설명 최신화 | ⬜ |
| 5-4 | plan/log 최종 정리 | 본 문서, `agent_log.md` | 변경 이력 확인 | ⬜ |

- `5-1` 목적: 타입/빌드 붕괴를 먼저 잡기 위함.
- `5-2` 목적: 사용자가 실제로 누르는 경로를 최종 확인하기 위함.
- `5-3` 목적: 코드와 문서가 어긋나지 않게 하기 위함.
- `5-4` 목적: 이후 동일 작업 재개 시 현재 상태를 바로 알 수 있게 하기 위함.

검증 훅:
```powershell
npm.cmd run build
```
사용자 확인 필요: 예

### 구현 순서 제안
1. Step 1에서 FMP SEC endpoint/shape를 확정한다.
2. Step 2에서 기존 Finnhub SEC 데이터를 안전 삭제할 수 있는 절차를 먼저 만든다.
3. Step 3에서 backend provider/route를 FMP 기준으로 바꾼다.
4. Step 4에서 UI 필터와 FMP stock update 버튼을 붙인다.
5. Step 5에서 빌드/수동 검증/문서 동기화를 한다.

### 사용자가 직접 확인할 핵심 포인트
1. 삭제 범위가 `FINNHUB + sec_filing`으로만 한정돼 있는지
2. SEC update가 더 이상 Finnhub가 아니라 FMP 기반으로 동작하는지
3. `market news` 오른쪽에 `fmp stock` 버튼이 생기는지
4. `recent fmp stock update`, `custom fmp stock update`가 기존 recent/custom과 같은 방식으로 동작하는지

### 현재 상태
- 이 문서는 구현 전 plan 정리 단계다.
- 아직 코드 전환, DB 삭제, UI 버튼 추가는 시작하지 않았다.
- 다음 실행 단위는 `Step 1 — FMP SEC 수집 스펙 고정`이다.
  - 사람 검증(비개발자): 어떤 종류의 주식 데이터가 되는지 표만 보고 알 수 있다.
  - 흔한 문제/주의: endpoint 단위 결과가 family 요약으로 누락되면 안 된다.

검증 훅:
```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/income-statement?symbol=AAPL&apikey=<masked>'
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — 뉴스/규제/애널리스트/대체 데이터 family probe

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | News family probe: `news/general-latest`, `news/stock-latest`, `news/press-releases-latest` | 조사 로그 | 일반 뉴스/종목 뉴스/PR 접근성 기록 | ⬜ |
| 3-2 | SEC/13F/Insider family probe: `sec-filings-financials`, `institutional-ownership/latest`, `insider-trading/latest` | 조사 로그 | 규제/소유/insider 접근성 기록 | ⬜ |
| 3-3 | Analyst/Transcript family probe: `analyst-estimates`, `ratings-snapshot`, `earning-call-transcript-latest` | 조사 로그 | 애널리스트/트랜스크립트 접근성 기록 | ⬜ |
| 3-4 | 정치/ESG/fundraising 같은 US-special family는 대표 endpoint 1건만 probe | 조사 로그 | speciality family 상태 기록 | ⬜ |

- `3-1` 목적: 뉴스 계열을 앱 후보군으로 평가하기 위함. 설명: general/stock/press release를 분리 판정한다.
  - 완료 조건(눈으로 확인): 세 뉴스 유형이 각각 표에 있다.
  - 사람 검증(비개발자): headline/url/snippet/ticker 같은 필드가 보이는지 확인한다.
  - 흔한 문제/주의: general news 가능과 press release 가능은 별개일 수 있다.
- `3-2` 목적: 규제/기관/insider data가 현재 key 범위에 들어오는지 보기 위함. 설명: US-only 계열의 대표 예시만 본다.
  - 완료 조건(눈으로 확인): SEC/13F/insider가 각각 분류된다.
  - 사람 검증(비개발자): 문서상 US-only와 실제 접근 결과를 함께 볼 수 있다.
  - 흔한 문제/주의: 파라미터 오류를 구독 불가로 잘못 분류하지 않는다.
- `3-3` 목적: 리서치용 데이터 확장 가능성을 보기 위함. 설명: estimate, rating, transcript를 대표로 본다.
  - 완료 조건(눈으로 확인): analyst/transcript 계열 상태가 기록된다.
  - 사람 검증(비개발자): 실적 콜 transcript가 실제로 내려오는지 확인한다.
  - 흔한 문제/주의: transcript는 symbol/year/quarter 요구 조건 때문에 empty가 나올 수 있다.
- `3-4` 목적: 보조 데이터군을 가볍게 스캔하기 위함. 설명: Senate/ESG/fundraising은 대표 endpoint 1건으로만 접근성 힌트를 얻는다.
  - 완료 조건(눈으로 확인): specialty family 상태 요약이 생긴다.
  - 사람 검증(비개발자): “지금 당장 써볼 수 있는가” 수준 판단이 가능하다.
  - 흔한 문제/주의: family 전체를 대표 endpoint 하나로 완전히 일반화하지 않는다.

검증 훅:
```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/news/general-latest?page=0&limit=5&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/news/press-releases-latest?page=0&limit=5&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/sec-filings-financials?from=2026-03-01&to=2026-03-20&page=0&limit=5&apikey=<masked>'
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — 멀티자산/매크로/벌크 family probe

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | Forex/Crypto/Commodity family probe: `quote`, `historical-price-eod/full`, `historical-chart/1min` with representative symbols | 조사 로그 | 다중 자산군 접근성 기록 | ⬜ |
| 4-2 | Economics/Market Hours/Indexes family probe | 조사 로그 | 거시/운영성 데이터 접근성 기록 | ⬜ |
| 4-3 | Bulk family는 대표 endpoint(`profile-bulk`, `eod-bulk`)만 메타 수준 확인 | 조사 로그 | bulk 접근성/제약 기록 | ⬜ |
| 4-4 | 결과를 `Extended Access Matrix`로 정리 | `ai_agent_plan/terminal_ui_ver6_fmp/plan.md` 또는 후속 로그 표 | family별 상태표 확인 | ⬜ |

- `4-1` 목적: FMP를 주식 외 자산군에도 쓸 수 있는지 보기 위함. 설명: forex/crypto/commodity를 각 1세트씩 본다.
  - 완료 조건(눈으로 확인): `EURUSD`, `BTCUSD`, `GCUSD` 계열 결과가 기록된다.
  - 사람 검증(비개발자): 자산군별 quote/chart 가능 여부를 볼 수 있다.
  - 흔한 문제/주의: symbol 포맷이 틀리면 권한 문제가 아니라 파라미터 문제일 수 있다.
- `4-2` 목적: 달력/거시/인덱스 등 보조 분석 데이터 범위를 보기 위함. 설명: economics, market hours, indexes를 대표로 probe한다.
  - 완료 조건(눈으로 확인): macro/market operations 데이터 상태가 정리된다.
  - 사람 검증(비개발자): 예를 들어 경제지표, 거래시간, 지수 구성 데이터의 가능 여부를 알 수 있다.
  - 흔한 문제/주의: 인덱스 quote는 일반 주식 quote와 제한이 다를 수 있다.
- `4-3` 목적: bulk 플랜 가능성을 빠르게 보기 위함. 설명: 대량 다운로드는 하지 않고 endpoint 접근성만 본다.
  - 완료 조건(눈으로 확인): bulk 계열이 가능/제한/보류로 분류된다.
  - 사람 검증(비개발자): 대량 작업이 현실적인지 대략 감이 온다.
  - 흔한 문제/주의: bulk는 page/part가 필요해도 이를 빼먹으면 오판할 수 있다.
- `4-4` 목적: 확장형 dataset을 한 표로 묶기 위함. 설명: multi-asset, macro, bulk를 한 번에 요약한다.
  - 완료 조건(눈으로 확인): Extended matrix가 생긴다.
  - 사람 검증(비개발자): 주식 외 데이터까지 범위를 이해할 수 있다.
  - 흔한 문제/주의: 일부 family만 성공했는데 전체를 “지원”으로 과장하지 않는다.

검증 훅:
```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/quote?symbol=EURUSD&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/quote?symbol=BTCUSD&apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/treasury-rates?apikey=<masked>'
Invoke-WebRequest -UseBasicParsing -Uri 'https://financialmodelingprep.com/stable/profile-bulk?part=0&apikey=<masked>'
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — 구독 가능 데이터 타입 매트릭스 확정 및 후속 우선순위 제안

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | Step 1~4 결과를 family 중심 access matrix로 통합 | `ai_agent_plan/terminal_ui_ver6_fmp/agent_log.md` 또는 후속 보고 문서 | 통합표 확인 | ⬜ |
| 5-2 | `현재 구독으로 바로 연동 가능한 후보`와 `권한/플랜 재확인 필요 후보`를 분리 | `ai_agent_plan/terminal_ui_ver6_fmp/plan.md` 또는 후속 revision | 후보군 분류 확인 | ⬜ |
| 5-3 | terminal 앱 우선순위 1~3위를 제안 | `ai_agent_plan/terminal_ui_ver6_fmp/plan.md` | 연동 우선순위 섹션 확인 | ⬜ |

- `5-1` 목적: 개별 probe 결과를 의사결정 표로 바꾸기 위함. 설명: endpoint 나열이 아니라 data family 기준으로 정리한다.
  - 완료 조건(눈으로 확인): 한 표에서 category별 현재 상태를 읽을 수 있다.
  - 사람 검증(비개발자): 어떤 데이터가 되는지/안 되는지 표 한 장으로 이해된다.
  - 흔한 문제/주의: docs-only 결과와 live success 결과를 혼동하면 안 된다.
- `5-2` 목적: 바로 구현 가능한 것과 추가 확인이 필요한 것을 나누기 위함. 설명: 다음 개발 단계의 시행착오를 줄인다.
  - 완료 조건(눈으로 확인): “즉시 가능”과 “재확인 필요” 목록이 나뉜다.
  - 사람 검증(비개발자): 지금 바로 붙일 수 있는 후보가 따로 보인다.
  - 흔한 문제/주의: 429는 속도 제한일 수 있으므로 영구 불가처럼 쓰지 않는다.
- `5-3` 목적: 후속 개발 우선순위를 제안하기 위함. 설명: app 가치와 구현 난이도를 같이 반영한다.
  - 완료 조건(눈으로 확인): 우선순위 1~3과 이유가 적혀 있다.
  - 사람 검증(비개발자): 왜 그 순서인지 납득할 수 있다.
  - 흔한 문제/주의: 데이터가 가능해도 앱 적합성이 낮으면 우선순위를 낮출 수 있다.

검증 훅:
```powershell
# 최종 점검 예시
Get-Content c:\github_coding\terminal_sec\ai_agent_plan\terminal_ui_ver6_fmp\agent_log.md
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. `D-1` live probe 허용 범위
   - 선택지: docs 기반 plan만 유지 / 대표 endpoint 소수 probe / category 전수 probe
   - 차단 대상 Step: Step 1 이후 전체
2. `D-2` 429 재시도 정책
   - 선택지: 429 즉시 `LIMITED` 처리 / 짧은 backoff 1회 / provider 기본 throttle로 재시도
   - 차단 대상 Step: Step 2~4 결과 신뢰도
3. `D-3` 결과 보관 형식
   - 선택지: `agent_log.md` 누적 / 별도 matrix markdown 생성 / CSV 병행
   - 차단 대상 Step: Step 5 정리 품질
4. `D-4` 후속 연동 대상 우선순위
   - 선택지: Company/Profile 우선 / News 우선 / SEC/Analyst 우선 / Multi-asset 우선
   - 차단 대상 Step: Step 5-3

### 실행 의존성 그래프
Legend: `✅` 완료+사용자확인 완료 / `⏳` 완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 차단

트랙 A — 기준선/인증
```text
⬜ Step 0 조사 기준선 고정
  ⬜ 0-1 docs 카테고리 목록 고정
  ⬜ 0-2 docs 표식 규칙 고정
  ⬜ 0-3 레포 FMP baseline 고정

⬜ Step 1 인증 baseline과 안전 호출 예산 확인
  ⬜ 1-1 key/auth 방식 확정
  ⬜ 1-2 profile success 확보
  ⬜ 1-3 런타임 기록 포맷 고정
  ⬜ 1-4 호출 예산 확정
```

트랙 B — 핵심 equity family
```text
⬜ Step 2 핵심 시장 데이터 family probe
  ⬜ 2-1 Company Information
  ⬜ 2-2 Quote/Charts
  ⬜ 2-3 Statements
  ⬜ 2-4 Equity Core Access Matrix
```

트랙 C — 뉴스/규제/리서치 family
```text
⬜ Step 3 뉴스/규제/애널리스트/대체 데이터 family probe
  ⬜ 3-1 News family
  ⬜ 3-2 SEC/13F/Insider family
  ⬜ 3-3 Analyst/Transcript family
  ⬜ 3-4 US-special family
```

트랙 D — 멀티자산/벌크 family
```text
⬜ Step 4 멀티자산/매크로/벌크 family probe
  ⬜ 4-1 Forex/Crypto/Commodity family
  ⬜ 4-2 Economics/Market Hours/Indexes family
  ⬜ 4-3 Bulk family
  ⬜ 4-4 Extended Access Matrix
```

트랙 E — 최종 정리
```text
⬜ Step 5 구독 가능 데이터 타입 매트릭스 확정 및 후속 우선순위 제안
  ⬜ 5-1 family 중심 통합 matrix
  ⬜ 5-2 즉시 가능 vs 재확인 필요 분리
  ⬜ 5-3 terminal 앱 우선순위 1~3 제안
```

████ BLOCKER ████
Step 2, Step 3, Step 4는 Step 1의 인증 baseline이 성공해야 시작한다.
대표 endpoint가 401/403/402로 실패하면 현재 key의 상품 범위 또는 인증 방식부터 다시 확인해야 한다.

병렬 트랙 요약
- Step 0 → Step 1은 순차 진행이 필요하다.
- Step 2, Step 3, Step 4는 Step 1 완료 후 병렬 가능하다.
- Step 5는 Step 2~4가 끝난 뒤에만 가능하다.

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| `D-1` live probe 허용 범위 | Step 1~5 | docs-only / 대표 probe / 전수 probe |
| `D-2` 429 재시도 정책 | Step 2~4 | 즉시 limited / 1회 backoff / throttle 재시도 |
| `D-3` 결과 보관 형식 | Step 5 | agent_log / 별도 matrix / CSV 병행 |
| `D-4` 후속 연동 우선순위 | Step 5-3 | profile / news / sec-analyst / multi-asset |

### 결정 #1 — 접근 판정 기준(상세)
- `ACCESS_OK`
  - 정의: 현재 key로 요청했을 때 HTTP 200과 구조 있는 JSON payload를 확보한 경우
  - 예: `profile`, `quote`, `news/general-latest`가 실제 데이터를 반환
- `ACCESS_EMPTY_BUT_OK`
  - 정의: 인증은 통과했지만 해당 시점/심볼/날짜에 데이터가 비어 있는 경우
  - 예: 특정 symbol transcript가 없어서 `[]`가 내려오는 경우
- `ACCESS_DOC_ONLY`
  - 정의: docs에는 있으나 이번 조사 라운드에서 live probe를 아직 수행하지 않은 경우
  - 예: 우선순위가 낮은 specialty dataset
- `ACCESS_DENIED_OR_LIMITED`
  - 정의: 401/402/403, 명시적 plan 제한, 혹은 rate limit 때문에 현재 라운드에서 usable 판단이 불가능한 경우
  - 예: bulk endpoint가 plan 제한 메시지를 반환하거나 429가 반복되는 경우

### 결정 #2 — 대표 심볼 세트(상세)
- `AAPL`
  - 이유: company/profile/news/sec/analyst 대부분에서 문서 예시가 많고 결과 검증이 쉽다.
- `SPY`
  - 이유: ETF/fund 계열 endpoint를 대표하기 좋다.
- `^GSPC`
  - 이유: index quote/index history 계열 확인용이다.
- `EURUSD`
  - 이유: forex quote/chart 계열 확인용이다.
- `BTCUSD`
  - 이유: crypto quote/chart 계열 확인용이다.
- `GCUSD`
  - 이유: commodity quote/chart 계열 확인용이다.
