# Plan — terminal_ui_ver5_sec

> ℹ️ 이 문서는 2026-03-20 기준 `terminal_ui_ver5_sec` 구현 계획이다. 이번 목표는 기존 Finnhub News / Press Release 흐름 옆에 `SEC Filing` 흐름을 추가하되, 버튼 구조, recent/custom update, View Log, full text 처리 전략을 기존 패턴과 맞추는 것이다.

### 목표
- `Update` 드롭다운에서 `Press Release` 옆 계열로 `SEC Filing` 섹션을 추가한다.
- `Recent SEC Update`, `Custom SEC Update` 두 버튼을 추가한다.
- backend는 Finnhub `SEC Filings` endpoint를 사용해 데이터를 수집한다.
- 수집 작업은 기존 news pull과 동일하게 background job으로 실행하고 `View Log`에서 진행률과 로그를 확인할 수 있게 한다.
- `SEC Filing` 항목은 기존 news feed 흐름 안에서 조회 가능해야 하며, dedup / recent anchor / custom range 규칙도 기존 패턴을 따른다.
- full text는 “Finnhub가 직접 본문을 주는지”와 “문서 URL만 주는지”를 구분해서 설계하고, 원문 본문 확보가 불가능한 경우에도 metadata + 원문 링크는 반드시 저장되게 한다.

### 현재 레포 상태(중요, 확인됨)
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`에는 이미 다음 패턴이 구현돼 있다.
  - Finnhub recent/custom update 버튼
  - RTPR recent/custom update 버튼
  - `currentJobId` 기반 `View Log` 토글
  - full text split-button 및 background job
- `terminal/backend/src/server.ts`에는 이미 다음 패턴이 구현돼 있다.
  - `POST /api/news/pull-finhub`
  - recent/custom/7d 모드
  - job 생성, progress 업데이트, `appendLog`, duplicate job guard
  - `mergeChangeForNewItems()` 후처리
- `terminal/backend/src/services/finnhubNewsProvider.ts`에는 company_news / press_release / market_news pull과 ticker anchor map helper가 이미 있다.
- `terminal/backend/src/services/fulltextRepository.ts`와 관련 API는 `news_fulltext` 저장 흐름을 이미 갖고 있다.
- `terminal/backend/src/services/calendarRepository.ts`에는 IBKR calendar 쪽 `sec_filings`가 존재하지만, 이것은 이번에 추가하려는 Finnhub SEC filing news/feed 흐름과 다른 레인이다.
- 레포의 Finnhub probe 스크립트에는 다음 endpoint 단서가 이미 있다.
  - `GET /stock/filings?symbol=...` 는 `Free`로 표기됨
  - `GET /stock/filings-sentiment?accessNumber=...` 는 `Premium`으로 표기됨
- 현재 레포에는 Finnhub SEC filing provider, `sec_filing` source_type, SEC filing 전용 update button, SEC filing full text 파이프라인이 없다.

### 제약 / 비범위
- mock 데이터는 사용하지 않는다.
- Finnhub API 키, 기타 시크릿은 로그/문서/코드에 노출하지 않는다.
- `IBKR calendar sec_filings`를 재활용해 UI만 억지로 연결하지 않는다. 이번 범위는 `Finnhub SEC filing ingestion`이다.
- Finnhub 응답 필드가 live probe로 확인되기 전까지, `url`, `accessNumber`, `form`, `filedDate` 필드명을 추측해서 고정 구현하지 않는다.
- 이번 plan 단계에서는 코드 구현이 아니라 구현 순서와 검증 포인트를 확정한다.
- SEC filing full text가 안정적으로 확보되지 않으면, 1차 구현에서는 metadata + 원문 링크 + unavailable status까지를 우선 완료하고 본문 파서는 2차로 분리할 수 있다.

### 읽는 방법(비개발자/일반인 기준)
- 이 문서는 “SEC Filing 버튼을 어디에 추가하고, backend가 어떻게 데이터를 받고, full text는 어디서 가져올지”를 단계별로 적은 문서다.
- 상태 이모지 의미:
  - `✅` 구현 + 사용자 확인 완료
  - `⏳` 구현 완료, 사용자 확인 대기
  - `⬜` 미착수
  - `🚫` 선행조건 미충족으로 차단
- 먼저 봐야 할 섹션은 세 곳이다.
  - `현재 레포 상태`: 지금 이미 있는 기능과 없는 기능
  - `결정/선행조건`: 구현 전에 반드시 확정해야 하는 선택지
  - `단계별 계획`: 실제 작업 순서와 검증 방법

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 구현 중 plan이 바뀌면 기존 항목을 삭제하지 않고 `PLAN CHANGE`로 append한다.
- 각 Step은 `구현 → 검증 → 사용자 확인 요청` 순서로 처리한다.
- 사용자가 확인하기 전까지 상태는 `⏳`를 유지한다.
- 라이브 Finnhub 응답 확인 없이 schema를 고정해야 하는 항목은 `🚫`로 둔다.
- `plan.md`와 실제 코드가 어긋나지 않게, 코드 변경 전 또는 동시에 plan과 `agent_log.md`를 갱신한다.

### 아키텍처(상위)
- UI 진입점:
  - `FinnhubNewsWindow.tsx`의 `Update` 드롭다운
  - `Press Release` 근처에 `SEC Filing` 섹션 추가
- backend ingest 진입점:
  - 신규 `POST /api/news/pull-finhub-sec`
  - mode=`recent | custom`
  - 기존 job manager / `View Log` / duplicate job guard 재사용
- provider 레이어:
  - 신규 `finnhubSecProvider.ts`
  - Finnhub `stock/filings` 호출
  - 필요 시 ticker별 recent anchor / custom range / 소규모 concurrency 적용
- 저장 레이어 권장안:
  - `news_items`: 공통 feed row 저장 (`source='FINNHUB'`, `source_type='sec_filing'`)
  - 신규 `sec_filings`: SEC 전용 metadata 저장 (`news_id`, `access_number`, `form_type`, `filed_at`, `accepted_at`, `primary_doc_url`, `index_url`, `raw_json` 등)
  - `news_fulltext`: filing 본문이 확보된 경우 저장, 미확보 시 `unavailable` 또는 `failed` 상태 기록
- full text 레이어:
  - 1차: Finnhub 응답에 본문이 없더라도 filing metadata + 원문 링크 저장
  - 2차: `primary_doc_url` 또는 SEC 문서 링크가 있으면 별도 backfill/extract job으로 원문 HTML/TXT 파싱
  - 결과는 기존 full text modal에서 조회

### 결정/선행조건(초기에 확정 필요)
1. **Finnhub `stock/filings` 실제 응답 필드 확정**
   - 필요 이유: dedup key, 본문 링크, 표시용 제목/본문 구성이 전부 여기에 의존한다.
2. **저장 전략**
   - 선택지: `news_items` 단독 / `news_items + sec_filings companion table`
   - 권장: `news_items + sec_filings companion table`
   - 이유: SEC filing은 일반 뉴스보다 구조화 필드가 많고, 추후 query/filter 확장 여지가 크다.
3. **full text 소스**
   - 선택지: Finnhub 직접 본문 제공 / Finnhub가 주는 URL로 SEC 원문 재수집 / 1차에서는 본문 미지원
   - 권장: `URL 기반 SEC 원문 재수집`을 기본 설계로 두되, live probe에서 URL 부재 시 1차 범위를 metadata-only로 축소
4. **dedup 기준**
   - 선택지: `access_number` / document URL / `ticker+filed_at+form`
   - 권장: `access_number` 우선, 없으면 `document URL`
5. **UI 노출 위치**
   - 선택지: update 메뉴에만 추가 / source filter와 row badge까지 추가
   - 권장: update 메뉴 + source filter + row badge까지 같이 추가

### 계획 중간 필수 확인
- Step 0에서 아래 5개를 반드시 확보해야 한다.
  - 실제 응답 sample 1건
  - access number 존재 여부
  - 원문 링크 존재 여부
  - date range 파라미터 지원 여부
  - 최근/커스텀 모드에서 필요한 최소 필드 목록
- Step 3(full text)는 Step 0 결과에서 원문 링크 또는 본문 소스가 확인되기 전까지 시작하지 않는다.
- `IBKR sec_filings`와 `Finnhub SEC filing`이 같은 테이블/화면을 공유하는지 여부를 중간 점검에서 다시 확인한다. 기본값은 **공유하지 않음**이다.

### 제안하는 구현 순서(이유)
1. Finnhub SEC filing 응답 구조를 live probe로 먼저 확정한다.
   - 왜: storage / full text / dedup 설계가 응답 필드에 전부 의존한다.
2. backend schema와 provider를 먼저 만든다.
   - 왜: UI는 결국 backend job과 응답 shape가 먼저 있어야 안전하게 연결된다.
3. 기존 Update/View Log 패턴을 그대로 재사용해 UI 버튼을 붙인다.
   - 왜: 사용자가 요구한 “기존 버튼 참고해서”라는 조건을 가장 안전하게 만족한다.
4. full text는 별도 step으로 분리한다.
   - 왜: metadata ingestion과 원문 파싱의 리스크가 다르기 때문이다.
5. 마지막에 source filter / row 표시 / docs / runtime 검증까지 묶는다.
   - 왜: 버튼만 눌리는 수준이 아니라 실제 feed 가시성까지 끝내야 기능이 닫힌다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⬜ Step 0 — Finnhub SEC filing 응답 구조 및 full text 가능성 확정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | Finnhub `stock/filings` live probe로 실제 응답 샘플 1건 확보 | 런타임 probe | PowerShell 또는 테스트 스크립트로 200 응답 + 샘플 JSON 확인 | ⬜ |
| 0-2 | 응답에서 dedup 후보 필드(`accessNumber`, URL, filed date, form type 등) 확인 | 조사 결과를 plan에 반영 | 샘플 JSON 기준 필드 목록 표 작성 | ⬜ |
| 0-3 | 응답에 원문 링크 또는 문서 index URL이 있는지 확인 | 조사 결과를 plan에 반영 | URL 존재/부재 명시 | ⬜ |
| 0-4 | recent/custom 모드에서 필요한 date 파라미터 규칙 확인 | 조사 결과를 plan에 반영 | `from/to` 지원 여부 및 형식 기록 | ⬜ |
| 0-5 | Step 3 full text 진행 가능 여부를 `가능 / 조건부 / 불가`로 판정 | `plan.md` | 판정 결과와 근거 append | ⬜ |

- `0-1` 목적: 추측 구현 금지. 설명: 실 API 응답 1건을 확인하기 전에는 SEC filing 스키마를 고정하지 않는다.
  - 완료 조건(눈으로 확인): 샘플 JSON 요약이 plan 또는 agent_log에 적힌다.
  - 사람 검증(비개발자): 응답 코드가 200이고 JSON 항목이 보인다.
  - 흔한 문제/주의: 키 권한 부족으로 빈 배열이나 에러만 올 수 있다.
- `0-2` 목적: dedup 및 row title 구성을 위한 핵심 키 확정. 설명: access number 또는 대체 키를 확인하면 완료다.
  - 완료 조건(눈으로 확인): dedup 우선순위가 문서로 고정된다.
  - 사람 검증(비개발자): 표에 “무엇으로 중복을 막는지”가 보인다.
  - 흔한 문제/주의: 필드명을 docs 예시로만 보고 실제 응답과 다를 수 있다.
- `0-3` 목적: full text 가능성 판단. 설명: 원문 링크가 있으면 backfill route를 설계할 수 있다.
  - 완료 조건(눈으로 확인): URL 필드 존재 여부가 명시된다.
  - 사람 검증(비개발자): plan에 “링크 있음/없음”이 적힌다.
  - 흔한 문제/주의: 클릭 가능한 링크처럼 보여도 실제 원문 문서가 아닐 수 있다.
- `0-4` 목적: recent/custom 버튼 구현 범위 확정. 설명: date range 규칙을 알아야 custom update를 만들 수 있다.
  - 완료 조건(눈으로 확인): `from/to` 형식과 inclusive/exclusive 여부가 적힌다.
  - 사람 검증(비개발자): 예시 날짜가 적혀 있다.
  - 흔한 문제/주의: 최근 업데이트가 ticker anchor 기준인지, provider 전체 최신일 기준인지 혼동할 수 있다.
- `0-5` 목적: Step 3 차단 여부 판단. 설명: full text path를 계속 진행할지 metadata-only로 남길지 결정한다.
  - 완료 조건(눈으로 확인): Step 3 상태가 `⬜` 또는 `🚫`로 결정된다.
  - 사람 검증(비개발자): “본문 가능/불가”가 한 줄로 정리된다.
  - 흔한 문제/주의: URL만 있다고 바로 본문 파싱 성공을 가정하면 안 된다.

검증 훅:
```powershell
# 실제 키는 출력하지 않음
Invoke-RestMethod -Uri "https://finnhub.io/api/v1/stock/filings?symbol=AAPL&from=2026-01-01&to=2026-03-20&token=<masked>"
```
사용자 확인 필요: **예**

#### ⬜ Step 1 — Backend schema + provider + pull job 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | `sec_filings` companion table schema 추가 | `terminal/backend/src/db.ts` | DB 시작 후 테이블/인덱스 존재 확인 | ⬜ |
| 1-2 | Finnhub SEC provider 생성 (`finnhubSecProvider.ts`) | `terminal/backend/src/services/finnhubSecProvider.ts` | `npx tsc --noEmit` 통과 | ⬜ |
| 1-3 | recent anchor / custom range / dedup helper 추가 | `terminal/backend/src/services/finnhubSecProvider.ts`, `newsRepository.ts` 또는 신규 repository | 단위 테스트 또는 샘플 run으로 중복 방지 확인 | ⬜ |
| 1-4 | `POST /api/news/pull-finhub-sec` job endpoint 추가 | `terminal/backend/src/server.ts` | `{ jobId }` 응답 + duplicate guard 확인 | ⬜ |
| 1-5 | job log에 ticker 진행/삽입/skip/실패 사유 기록 추가 | `terminal/backend/src/server.ts` | `/api/jobs/:jobId`에서 로그 확인 | ⬜ |

- `1-1` 목적: 일반 news row와 SEC 전용 metadata를 분리 저장. 설명: `news_items`를 공통 feed로 유지하고 structured fields는 companion table에 둔다.
  - 완료 조건(눈으로 확인): `sec_filings` 테이블이 존재한다.
  - 사람 검증(비개발자): DB 설명 문서에 새 테이블 이름이 보인다.
  - 흔한 문제/주의: news_items만으로 억지 저장하면 access number, form type 조회가 나중에 불편해진다.
- `1-2` 목적: Finnhub SEC 응답을 내부 canonical row로 변환. 설명: provider가 ticker/date range 입력을 받아 normalized row를 반환하면 완료다.
  - 완료 조건(눈으로 확인): provider export 함수가 생긴다.
  - 사람 검증(비개발자): 빌드가 깨지지 않는다.
  - 흔한 문제/주의: Finnhub free tier rate limit를 무시하면 recent/custom이 쉽게 429에 걸릴 수 있다.
- `1-3` 목적: recent/custom을 기존 Finnhub 패턴과 맞춤. 설명: recent는 anchor 이후만, custom은 사용자가 지정한 날짜 범위를 조회한다.
  - 완료 조건(눈으로 확인): 중복 입력이 skip된다.
  - 사람 검증(비개발자): 같은 버튼 두 번 눌러도 건수가 폭증하지 않는다.
  - 흔한 문제/주의: filing은 뉴스보다 날짜/접수시간 의미가 달라 anchor 기준을 잘못 잡기 쉽다.
- `1-4` 목적: UI에서 호출할 backend 진입점 생성. 설명: 기존 `pull-finhub` 패턴과 동일하게 job 기반 endpoint를 만든다.
  - 완료 조건(눈으로 확인): POST 호출 시 jobId가 반환된다.
  - 사람 검증(비개발자): View Log를 열 수 있다.
  - 흔한 문제/주의: sourceType guard와 job key를 기존 뉴스 job과 혼동하면 충돌난다.
- `1-5` 목적: SEC pull 진행상황을 사람이 읽을 수 있게 만든다. 설명: ticker별 처리, inserted/skipped, 링크 누락, parse 실패를 로그로 남긴다.
  - 완료 조건(눈으로 확인): 로그 라인에 SEC 관련 진행 정보가 보인다.
  - 사람 검증(비개발자): View Log에 단순 퍼센트 외 문장 로그가 보인다.
  - 흔한 문제/주의: 실패 사유를 한 줄도 안 남기면 URL 부재와 API 에러를 구분할 수 없다.

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\terminal
npm run build
Invoke-RestMethod -Uri "http://localhost:8080/api/news/pull-finhub-sec" -Method Post -ContentType "application/json" -Body '{"mode":"recent"}'
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — Frontend `SEC Filing` 버튼 2개 + View Log 통합

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | Update 드롭다운에 `SEC Filing` 섹션 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | webui build 후 메뉴 표시 확인 | ⬜ |
| 2-2 | `Recent SEC Update` 버튼 연결 | `FinnhubNewsWindow.tsx` | 클릭 시 job 시작 + jobId 저장 확인 | ⬜ |
| 2-3 | `Custom SEC Update` 버튼 + 날짜 modal 연결 | `FinnhubNewsWindow.tsx` | 날짜 지정 후 POST body 확인 | ⬜ |
| 2-4 | 기존 `View Log`가 SEC job에도 동일하게 붙는지 확인 | `FinnhubNewsWindow.tsx` | 로그 패널에 SEC 로그 표시 | ⬜ |
| 2-5 | 버튼 배치를 `Press Release` 옆 흐름으로 시각 정렬 | `FinnhubNewsWindow.tsx` | 드롭다운 순서와 설명문 확인 | ⬜ |

- `2-1` 목적: 사용자가 기존 위치에서 바로 SEC pull을 찾게 한다. 설명: Update 메뉴에 별도 섹션이 생기면 완료다.
  - 완료 조건(눈으로 확인): 드롭다운에 `SEC Filing` 헤더가 보인다.
  - 사람 검증(비개발자): Press Release 근처에서 SEC 버튼을 바로 찾을 수 있다.
  - 흔한 문제/주의: 섹션만 추가하고 handler가 없으면 눌러도 반응이 없다.
- `2-2` 목적: 최근 데이터 증분 업데이트. 설명: anchor 이후 filing만 당겨오는 recent 버튼을 만든다.
  - 완료 조건(눈으로 확인): 클릭 후 View Log 활성화.
  - 사람 검증(비개발자): 버튼 누르면 진행률이 움직인다.
  - 흔한 문제/주의: recent가 7일 고정 backfill로 동작하면 기존 recent 의미와 달라진다.
- `2-3` 목적: 사용자 지정 날짜 범위 업데이트. 설명: 기존 Custom Update modal 패턴을 재사용한다.
  - 완료 조건(눈으로 확인): from/to 입력 후 job 시작.
  - 사람 검증(비개발자): 날짜를 고르면 job이 시작된다.
  - 흔한 문제/주의: from/to validation이 없으면 빈 요청으로 backend 400이 쉽게 난다.
- `2-4` 목적: 새 버튼도 기존 로그 UX를 그대로 재사용. 설명: 별도 로그 UI를 만들지 않고 `currentJobId` 흐름에 얹는다.
  - 완료 조건(눈으로 확인): SEC job 로그가 패널에 보인다.
  - 사람 검증(비개발자): View Log 열었을 때 SEC 관련 문장이 보인다.
  - 흔한 문제/주의: jobId set 시점이 늦으면 로그 버튼이 비활성으로 남는다.
- `2-5` 목적: 사용자 요구한 “press release 버튼 옆” 느낌을 드롭다운 정보 구조에 반영. 설명: 섹션 순서와 텍스트를 press release와 나란히 맞춘다.
  - 완료 조건(눈으로 확인): Press Release 다음 또는 인접 구역에 SEC Filing이 배치된다.
  - 사람 검증(비개발자): 메뉴를 열었을 때 두 기능이 같은 종류의 update처럼 보인다.
  - 흔한 문제/주의: 너무 아래쪽 다른 그룹에 넣으면 사용자가 찾기 어렵다.

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub
npm run build
```
사용자 확인 필요: **예**

#### 🚫 Step 3 — SEC filing full text 수집/백필 경로 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | Finnhub 응답 또는 SEC 링크에서 원문 확보 경로를 확정 | `plan.md` 및 구현 대상 파일 | live probe 결과로 경로 확정 | 🚫 |
| 3-2 | 원문 링크가 있을 경우 SEC filing fetcher/backfill service 추가 | `terminal/backend/src/services/fulltextUpdateService.ts` 또는 신규 service | 샘플 filing 1건 본문 저장 확인 | 🚫 |
| 3-3 | filing full text를 `news_fulltext`에 저장하고 extraction 상태 정의 | `fulltextRepository.ts`, `server.ts` | `/api/news/fulltext/:id` 응답 확인 | 🚫 |
| 3-4 | 원문 링크가 없거나 파싱 실패하면 unavailable로 표준화 | `fulltextRepository.ts`, `server.ts` | 실패 상태와 로그 메시지 확인 | 🚫 |
| 3-5 | 필요 시 `SEC FT Backfill` 메뉴 항목을 별도 추가 | `FinnhubNewsWindow.tsx` | 드롭다운/버튼 동작 확인 | 🚫 |

- `3-1` 목적: 본문을 어디서 받을지 먼저 결정. 설명: Finnhub direct body인지, SEC 원문 링크 재수집인지, 아니면 metadata-only인지 확정한다.
  - 완료 조건(눈으로 확인): full text source가 한 줄로 고정된다.
  - 사람 검증(비개발자): “본문은 어디서 온다”가 문서에 적힌다.
  - 흔한 문제/주의: 링크만 있다고 바로 텍스트 추출 가능하다고 가정하면 안 된다.
- `3-2` 목적: 원문 backfill 서비스 구현. 설명: filing URL이 있으면 문서를 가져와 텍스트를 추출한다.
  - 완료 조건(눈으로 확인): 샘플 filing 1건에 실제 본문이 저장된다.
  - 사람 검증(비개발자): Full Text modal에 filing 문서 내용이 보인다.
  - 흔한 문제/주의: SEC 문서는 HTML, TXT, inline XBRL 등 포맷이 달라 단일 파서로 안 끝날 수 있다.
- `3-3` 목적: full text 저장을 기존 UI/DB와 호환. 설명: news_fulltext를 재사용해 modal 조회가 가능하게 한다.
  - 완료 조건(눈으로 확인): `/api/news/fulltext/:id`로 본문 조회 가능.
  - 사람 검증(비개발자): 뉴스 상세와 같은 방식으로 본문이 열린다.
  - 흔한 문제/주의: filing 본문이 너무 길어서 word count나 modal 렌더 부담이 커질 수 있다.
- `3-4` 목적: 실패 케이스 표준화. 설명: 원문 부재/파싱 실패를 성공처럼 보이지 않게 한다.
  - 완료 조건(눈으로 확인): unavailable/failed 상태가 구분 저장된다.
  - 사람 검증(비개발자): 본문이 없으면 이유가 보인다.
  - 흔한 문제/주의: 실패를 빈 문자열로 저장하면 이후 재시도가 어렵다.
- `3-5` 목적: 대량 filing 본문 백필 UX 제공. 설명: 필요하면 기존 Full Text split-button에 SEC 전용 항목을 추가한다.
  - 완료 조건(눈으로 확인): 별도 메뉴 항목이 보인다.
  - 사람 검증(비개발자): 사용자가 filing 본문만 따로 백필할 수 있다.
  - 흔한 문제/주의: Step 0 결과 없이 먼저 UI를 만들면 결국 dead button이 된다.

검증 훅:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/news/fulltext/<sec_news_id>"
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — feed 조회/필터/표시 계층에 `SEC Filing` 반영

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | `source_type='sec_filing'` 조회 지원 추가 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/types.ts` | `/api/news?source_type=sec_filing` 확인 | ⬜ |
| 4-2 | source filter / badge / 라벨에 `SEC Filing` 추가 | `FinnhubNewsWindow.tsx` 및 관련 타입 | UI에서 필터/배지 표시 확인 | ⬜ |
| 4-3 | row 표시용 subtitle/body/title 구성 확정 | `newsRepository.ts`, `FinnhubNewsWindow.tsx` | form type, filed date, ticker가 읽히게 보이는지 확인 | ⬜ |
| 4-4 | filing 원문 링크 또는 detail 링크 노출 | `FinnhubNewsWindow.tsx` | 링크 클릭 동작 확인 | ⬜ |

- `4-1` 목적: SEC row가 실제 feed에서 검색 가능해야 한다. 설명: source_type filter가 동작하면 완료다.
  - 완료 조건(눈으로 확인): API에서 sec_filing 행이 내려온다.
  - 사람 검증(비개발자): 필터를 누르면 SEC 항목만 보인다.
  - 흔한 문제/주의: ingest만 되고 조회 filter에 안 걸리면 UI에서 없는 데이터처럼 보인다.
- `4-2` 목적: 사용자가 일반 기사와 SEC filing을 구분. 설명: 배지/라벨이 붙으면 완료다.
  - 완료 조건(눈으로 확인): SEC Filing 배지 노출.
  - 사람 검증(비개발자): 목록에서 어떤 row가 filing인지 한눈에 보인다.
  - 흔한 문제/주의: 기존 `Press Release` 색/배지와 너무 비슷하면 혼동된다.
- `4-3` 목적: structured metadata를 읽기 쉬운 row로 변환. 설명: title/body/보조행에 form, ticker, filed date가 보여야 한다.
  - 완료 조건(눈으로 확인): 빈 body 대신 요약 텍스트가 보인다.
  - 사람 검증(비개발자): 목록 한 줄만 봐도 어떤 filing인지 알 수 있다.
  - 흔한 문제/주의: 제목을 synthetic string만 쓰면 가독성이 떨어진다.
- `4-4` 목적: full text가 없더라도 사용자가 원문으로 이동 가능. 설명: origin/doc link를 row detail에서 열 수 있게 한다.
  - 완료 조건(눈으로 확인): 외부 링크 버튼 또는 URL이 있다.
  - 사람 검증(비개발자): 클릭 시 문서가 열린다.
  - 흔한 문제/주의: synthetic dedup URL을 실제 링크로 열면 안 된다.

검증 훅:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/news?source_type=sec_filing&limit=5"
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — 정적 분석 / 빌드 / 테스트 / 런타임 통합 검증 + 문서 동기화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | backend/frontend 정적 오류 0 확인 | 변경 파일 전부 | `get_errors` 결과 0 또는 관련성 검토 | ⬜ |
| 5-2 | terminal build 통과 | `terminal/**` | `npm run build` 성공 | ⬜ |
| 5-3 | 자동 테스트 및 필요한 신규 테스트 추가 | `terminal/backend/tests/**`, 필요 시 frontend tests | `npm run test` 성공 | ⬜ |
| 5-4 | dev 서버에서 recent/custom/view log/runtime 확인 | backend + webui | 실제 버튼 클릭/endpoint/job 확인 | ⬜ |
| 5-5 | `backend_prompt.md` 및 필요 문서 동기화 | `terminal/backend_prompt.md` 및 관련 `.md` | 문서 diff 확인 | ⬜ |

- `5-1` 목적: 변경이 타입/문법 에러 없이 닫혔는지 확인.
- `5-2` 목적: 실제 앱 빌드가 되는지 확인.
- `5-3` 목적: provider/dedup/fulltext 실패 케이스를 테스트로 고정.
- `5-4` 목적: 사용자가 실제로 버튼을 눌러 recent/custom/view log를 확인할 수 있게 끝낸다.
- `5-5` 목적: backend spec과 새 `sec_filing` 컬럼/endpoint/동작을 문서에 반영한다.

검증 훅:
```powershell
cd c:\github_coding\terminal_sec\terminal
npm run build
npm run test
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. `D-1` SEC filing full text 1차 범위
   - 선택지: metadata-only / 링크 있으면 즉시 fetch / 별도 backfill 버튼만 제공
   - 차단 대상 Step: Step 3
2. `D-2` companion table 채택 여부
   - 선택지: `news_items` 단독 / `news_items + sec_filings`
   - 차단 대상 Step: Step 1
3. `D-3` row title 포맷
   - 선택지: provider headline 사용 / `FORM - TICKER - DATE` 합성 / 둘 혼합
   - 차단 대상 Step: Step 4
4. `D-4` SEC filing source filter 노출 수준
   - 선택지: 내부 source_type만 지원 / UI filter badge까지 노출
   - 차단 대상 Step: Step 4

### 실행 의존성 그래프
Legend: `✅` 완료+사용자확인 완료 / `⏳` 완료, 사용자확인 대기 / `⬜` 미착수 / `🚫` 차단

트랙 A — API/저장 구조 확정
```text
⬜ Step 0 Finnhub SEC filing 응답 구조 및 full text 가능성 확정
  ⬜ 0-1 live probe sample 확보
  ⬜ 0-2 dedup 후보 필드 확인
  ⬜ 0-3 원문 링크 존재 여부 확인
  ⬜ 0-4 from/to 규칙 확인
  ⬜ 0-5 full text 가능 여부 판정

⬜ Step 1 Backend schema + provider + pull job 추가
  ⬜ 1-1 sec_filings companion table 추가
  ⬜ 1-2 finnhubSecProvider 생성
  ⬜ 1-3 recent/custom/dedup helper 추가
  ⬜ 1-4 /api/news/pull-finhub-sec endpoint 추가
  ⬜ 1-5 job log 상세화

🚫 Step 3 SEC filing full text 수집/백필 경로 구현
  🚫 3-1 full text source 확정
  🚫 3-2 SEC 원문 fetch/backfill service
  🚫 3-3 news_fulltext 저장
  🚫 3-4 unavailable/failed 표준화
  🚫 3-5 SEC FT 메뉴 항목
```

트랙 B — UI/조회 계층 반영
```text
⬜ Step 2 Frontend SEC Filing 버튼 2개 + View Log 통합
  ⬜ 2-1 SEC Filing 섹션 추가
  ⬜ 2-2 Recent SEC Update 버튼 연결
  ⬜ 2-3 Custom SEC Update 버튼 연결
  ⬜ 2-4 View Log 재사용 확인
  ⬜ 2-5 Press Release 인접 배치

⬜ Step 4 feed 조회/필터/표시 계층 반영
  ⬜ 4-1 source_type=sec_filing 조회 지원
  ⬜ 4-2 source filter / badge 추가
  ⬜ 4-3 row 표시 포맷 확정
  ⬜ 4-4 원문 링크 노출

⬜ Step 5 검증 + 문서 동기화
  ⬜ 5-1 정적 분석
  ⬜ 5-2 build
  ⬜ 5-3 test
  ⬜ 5-4 runtime 통합
  ⬜ 5-5 문서 동기화
```

┌────────────────────────────────────────────────────────────────────┐
│ 차단 구간: Step 3 full text                                       │
│ 이유: Finnhub SEC filings 응답에 본문/원문 링크가 실제로 있는지    │
│ Step 0 live probe 결과가 먼저 필요함                              │
└────────────────────────────────────────────────────────────────────┘

병렬 트랙 요약
- Step 0이 끝나면 Step 1과 Step 2는 순차성이 강하지만, backend provider 골격과 frontend 버튼 배치는 일부 병렬 준비가 가능하다.
- Step 4는 Step 1의 source_type/schema가 정해진 뒤 시작하는 것이 안전하다.
- Step 3은 Step 0 결과 없이는 시작하지 않는다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| `D-1` full text 1차 범위 | Step 3 | metadata-only / 즉시 fetch / backfill only |
| `D-2` companion table 채택 | Step 1 | `news_items` only / `news_items + sec_filings` |
| `D-3` row title 포맷 | Step 4 | provider headline / 합성 제목 / 혼합 |
| `D-4` UI filter 노출 수준 | Step 4 | 내부 필터만 / 배지까지 노출 |

### 결정 #1 — 저장 전략(상세)
- 권장안: `news_items + sec_filings companion table`
- 이유:
  - news feed는 기존 `news_items` 조회/정렬/UI를 재사용할 수 있다.
  - SEC 전용 필드(accession, form, SEC link, raw_json)를 별도 테이블에 두면 억지 문자열 합성을 줄일 수 있다.
  - 이후 `form_type=8-K` 같은 조건 검색이 필요해져도 확장하기 쉽다.

### 결정 #2 — full text 전략(상세)
- 현재 확인 사실:
  - 레포에 있는 probe 스크립트는 `stock/filings` endpoint 존재만 보여 준다.
  - 본문 제공 여부는 아직 live sample로 확인하지 못했다.
- 권장안:
  - 1차 구현: metadata ingest + 링크 저장 + View Log + feed 조회까지 완성
  - 2차 구현: 원문 링크가 있으면 SEC 문서 fetch/backfill 추가
  - 링크조차 없으면 full text는 `unavailable`로 명시하고 UI에서 링크 기반 이동만 제공

---

### PLAN CHANGE (2026-03-20) — 멀티 update 동시 실행 + View Log 선택 + duplicate guard 표준화

사용자 요청: "서로 다른 데이터 플랫폼에서 데이터 받는 update 버튼은 동시에 받을 수 있게 / View Log에서 진행중 update를 선택해서 과정 볼 수 있게 / 같은 버튼 다시 누르면 이미 진행중이라 에러가 나게끔 / 현재 코드 상태도 다시 확인"

**현재 코드 상태(확인 결과):**
- backend `jobManager` 자체는 여러 running job을 동시에 저장할 수 있다.
- backend `GET /api/jobs/active`와 frontend log panel은 **여러 running job이 있으면 dropdown으로 선택**하는 구조가 이미 있다.
- 그러나 frontend `FinnhubNewsWindow.tsx`는 대부분의 update 버튼에 `disabled={updating}`를 걸고, 각 시작 함수에서 전역 `setUpdating(true)`를 사용한다.
- 결과적으로 **UI 기준으로는 한 update가 running이면 다른 update를 거의 시작할 수 없다.**
- 같은 버튼 재클릭 guard는 현재 **일관적이지 않다.**
  - `POST /api/news/pull-finhub`: sourceType 단위로 409 + `existingJobId`
  - `POST /api/news/pull-rtpr`: RTPR 전용 key로 409 + `existingJobId`
  - `POST /api/news/change/update-recent`, `POST /api/news/change/update-custom`: duplicate guard 없음
  - `POST /api/news/fulltext/update`, `POST /api/news/fulltext/backfill-rtpr`: duplicate guard 없음
  - `POST /api/ibkr/calendar/update`, `POST /api/ibkr/calendar/update-custom`: job 기반이 아니라 즉시 실행형이라 View Log 대상이 아님
- 따라서 현재 상태는 “잡 시스템은 멀티 job을 수용 가능하지만, 프론트 전역 lock과 endpoint별 guard 불균일 때문에 실제 UX는 단일 작업 중심”이다.

**이번 change에서 추가되는 목표:**
- 서로 다른 플랫폼/종류의 update는 동시에 실행 가능하게 한다.
- View Log에서 진행 중인 job을 명시적으로 선택해서 볼 수 있게 현재 구조를 유지/보강한다.
- 같은 버튼(같은 logical job key) 재클릭 시에는 backend가 409 + `existingJobId`를 반환하게 통일한다.
- job 기반이 아닌 update는 View Log 대상인지 여부를 먼저 결정하고, 필요 시 job 기반으로 승격한다.

#### ⬜ Step 6 — 멀티 job 동시 실행 정책 확정 및 프론트 전역 lock 해체

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 6-1 | 현재 update 버튼들을 job 그룹별로 분류 (`finnhub`, `rtpr`, `sec`, `change`, `fulltext`, `calendar`) | `plan.md` 및 구현 대상 파일 | 그룹 매트릭스 작성 | ⬜ |
| 6-2 | `updating` 전역 boolean을 job-key 기반 상태 맵으로 전환하는 설계 확정 | `FinnhubNewsWindow.tsx` | 버튼별 disable 조건 표 작성 | ⬜ |
| 6-3 | 서로 다른 job group은 동시에 시작 가능, 같은 group만 중복 차단 정책으로 문서화 | `plan.md` | 정책 문장과 예시 버튼쌍 기록 | ⬜ |
| 6-4 | Full Text와 일반 update의 충돌 규칙 분리 (`ftUpdating`도 group 기반으로 재정의) | `FinnhubNewsWindow.tsx` | 같은 UI에서 동시 실행 가능한 조합 표 작성 | ⬜ |

- `6-1` 목적: 무엇을 “같은 버튼”으로 볼지 먼저 명확히 정의한다. 설명: endpoint 이름이 아니라 logical job key 단위로 그룹을 나누면 완료다.
  - 완료 조건(눈으로 확인): 각 버튼이 어느 job group인지 표로 정리된다.
  - 사람 검증(비개발자): 예를 들어 `Recent PTPR`와 `Recent Finnhub`가 다른 그룹이라는 설명이 보인다.
  - 흔한 문제/주의: sourceType만 보고 grouping하면 change/fulltext/calendar과 충돌 규칙이 빠질 수 있다.
- `6-2` 목적: 현재 단일 `updating` lock을 해체한다. 설명: 버튼 disabled를 전역 boolean 대신 job별 running 상태로 바꾸는 설계를 확정하면 완료다.
  - 완료 조건(눈으로 확인): 어떤 버튼이 어떤 상태값을 볼지 정리된다.
  - 사람 검증(비개발자): 한 작업이 돌아가도 다른 종류 버튼이 회색 비활성으로 다 잠기지 않는다는 설명이 보인다.
  - 흔한 문제/주의: polling 종료 시 모든 상태를 한 번에 false로 내려버리면 다른 job 표시가 꼬일 수 있다.
- `6-3` 목적: 동시 실행과 중복 차단을 동시에 만족. 설명: “다른 group은 병렬 허용, 같은 group은 409” 원칙을 문서화한다.
  - 완료 조건(눈으로 확인): 허용/금지 조합 예시가 있다.
  - 사람 검증(비개발자): `Recent SEC + Full Text`는 가능, `Recent SEC + Recent SEC`는 불가 같은 예시를 읽을 수 있다.
  - 흔한 문제/주의: 프론트만 허용하고 backend guard가 없으면 새로고침/수동 API 호출에서 중복이 생긴다.
- `6-4` 목적: full text와 update가 동시에 돌 수 있는지 별도 정의. 설명: 지금은 `updating || ftUpdating`로 함께 잠겨 있으므로 이를 분리해야 한다.
  - 완료 조건(눈으로 확인): FT와 ingestion 병렬 여부가 정리된다.
  - 사람 검증(비개발자): FT job 중에도 다른 update 버튼 일부가 눌릴지 여부가 명시된다.
  - 흔한 문제/주의: DB write 충돌이나 동일 row 경쟁이 있으면 무조건 병렬 허용하면 안 된다.

검증 훅:
```powershell
# 정책 검증용 예시
# 1) 서로 다른 job group 2개를 연속 호출했을 때 둘 다 jobId를 받는지
# 2) 같은 job group을 재호출했을 때 409 + existingJobId가 오는지
```
사용자 확인 필요: **예**

#### ⬜ Step 7 — View Log 멀티 job 선택 UX를 정식 기능으로 고정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 7-1 | `activeJobs` dropdown이 running jobs 전체를 보여 주는 현재 구조를 유지하되, job label을 버튼/플랫폼 기준으로 읽기 좋게 개선하는 계획 수립 | `FinnhubNewsWindow.tsx`, backend job result/log | dropdown label 설계안 작성 | ⬜ |
| 7-2 | `currentJobId` 자동 선택 규칙(최신 job 자동 포커스)과 수동 선택 규칙을 분리 문서화 | `plan.md` | 자동/수동 전환 규칙 기록 | ⬜ |
| 7-3 | 완료된 job도 잠시 조회할지, running만 선택할지 정책 결정 | `plan.md`, 필요 시 `/api/jobs/active` 외 endpoint | 선택지 및 권장안 기록 | ⬜ |
| 7-4 | View Log 패널에서 선택한 job의 cancel 버튼이 그 job에만 적용되는지 검증 계획 추가 | `FinnhubNewsWindow.tsx`, `server.ts` | cancel 흐름 점검 항목 작성 | ⬜ |

- `7-1` 목적: 현재 dropdown은 `Job 1`, `Job 2` 형태라 어떤 작업인지 알아보기 어렵다. 설명: job label을 platform/mode/source 기준으로 읽기 좋게 바꾸는 계획을 세운다.
  - 완료 조건(눈으로 확인): 예시 label 포맷이 있다.
  - 사람 검증(비개발자): 어떤 job이 SEC인지, RTPR인지 dropdown에서 바로 보인다는 설명이 있다.
  - 흔한 문제/주의: 숫자만 보이면 여러 동시 작업일 때 로그 선택이 사실상 불가능하다.
- `7-2` 목적: 새 job 시작 시 자동 포커스와 사용자 수동 선택이 서로 덮어쓰지 않게 한다. 설명: 자동 선택 조건과 수동 선택 유지 조건을 분리하면 완료다.
  - 완료 조건(눈으로 확인): 자동 포커스 규칙이 문장으로 적힌다.
  - 사람 검증(비개발자): 보고 있던 로그가 새 job 시작 때문에 갑자기 바뀌지 않는다는 설명이 있다.
  - 흔한 문제/주의: `currentJobId`를 폴링마다 최신 job으로 덮어쓰면 수동 선택 UX가 깨진다.
- `7-3` 목적: 완료된 job 조회 범위를 명확히 한다. 설명: running only인지, 최근 done/failed도 dropdown에 남길지 결정한다.
  - 완료 조건(눈으로 확인): 범위가 명시된다.
  - 사람 검증(비개발자): 완료 직후 로그를 다시 볼 수 있는지 여부가 문서에 있다.
  - 흔한 문제/주의: 현재 `activeJobs`는 running만 내려오므로 done job을 다시 고르지는 못한다.
- `7-4` 목적: cancel이 선택한 job에만 적용되는지 보장. 설명: 여러 job 중 하나를 보고 있을 때 stop 버튼이 정확한 jobId를 향하는지 검증한다.
  - 완료 조건(눈으로 확인): cancel 대상 job 기준이 명확하다.
  - 사람 검증(비개발자): 선택한 작업만 중지된다는 설명이 있다.
  - 흔한 문제/주의: currentJobId 전환 직후 stale closure로 다른 job을 취소할 가능성을 점검해야 한다.

검증 훅:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/active"
Invoke-RestMethod -Uri "http://localhost:8080/api/jobs/<jobId>"
```
사용자 확인 필요: **예**

#### ⬜ Step 8 — duplicate guard를 endpoint 전반에 표준화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 8-1 | 현재 409 guard가 있는 endpoint와 없는 endpoint 목록 확정 | `server.ts`, `plan.md` | 표 작성 | ⬜ |
| 8-2 | 모든 장시간 update endpoint에 logical job key 기반 duplicate guard 설계 추가 | `server.ts` | guard 키 표 작성 | ⬜ |
| 8-3 | 같은 logical button 재클릭 시 공통 응답 형식(`409`, `error`, `existingJobId`)으로 통일 계획 수립 | `server.ts`, `FinnhubNewsWindow.tsx` | 응답 계약 명시 | ⬜ |
| 8-4 | frontend에서 409 수신 시 기존 running job으로 포커스 이동 + View Log 열기 공통 처리 계획 수립 | `FinnhubNewsWindow.tsx` | 공통 핸들러 설계안 작성 | ⬜ |
| 8-5 | job 기반이 아닌 calendar update를 job 기반으로 승격할지 여부 결정 | `server.ts`, `plan.md` | 선택지와 권장안 기록 | ⬜ |

- `8-1` 목적: 현재 guard 편차를 문서로 고정. 설명: 어느 endpoint만 409를 주는지 먼저 정리한다.
  - 완료 조건(눈으로 확인): guard 유무 표가 있다.
  - 사람 검증(비개발자): 어떤 버튼은 중복 차단, 어떤 버튼은 아님이 구분돼 적혀 있다.
  - 흔한 문제/주의: 프론트 disabled 때문에 가려진 중복 허용 경로를 놓치기 쉽다.
- `8-2` 목적: backend를 신뢰 가능한 단일 source of truth로 만든다. 설명: 새로고침/다중 탭/직접 API 호출에서도 같은 guard가 동작해야 한다.
  - 완료 조건(눈으로 확인): endpoint별 logical job key가 정리된다.
  - 사람 검증(비개발자): 같은 버튼 두 번 누르면 항상 같은 방식으로 막힌다고 이해할 수 있다.
  - 흔한 문제/주의: sourceType별 finer guard와 platform-level guard를 혼동하면 너무 많이 막거나 너무 적게 막는다.
- `8-3` 목적: 프론트 처리 분기 단순화. 설명: 모든 duplicate 응답이 같은 shape를 갖게 하면 완료다.
  - 완료 조건(눈으로 확인): `409 + existingJobId` 계약이 적혀 있다.
  - 사람 검증(비개발자): “이미 진행 중이니 그 로그를 보여 준다” 흐름이 설명된다.
  - 흔한 문제/주의: 일부 endpoint만 `existingJobId`가 없으면 로그 포커스 이동이 깨진다.
- `8-4` 목적: duplicate 응답 UX를 통일. 설명: 현재 Finnhub/RTPR만 하고 있는 동작을 공통화한다.
  - 완료 조건(눈으로 확인): 공통 duplicate handler 계획이 있다.
  - 사람 검증(비개발자): 재클릭 시 새 에러창 대신 기존 작업 로그로 이동한다는 설명이 있다.
  - 흔한 문제/주의: 단순 에러 메시지만 띄우면 사용자가 이미 진행 중인 job을 찾기 어렵다.
- `8-5` 목적: calendar도 View Log 체계에 넣을지 결정. 설명: 지금은 즉시 실행형이라 멀티 job 선택 대상이 아니므로, 승격 여부를 먼저 정한다.
  - 완료 조건(눈으로 확인): 유지/승격 선택이 문서에 있다.
  - 사람 검증(비개발자): calendar 버튼이 로그 패널 대상인지 아닌지 알 수 있다.
  - 흔한 문제/주의: 즉시 실행형 endpoint를 그대로 두면 “모든 update를 View Log에서 본다” 요구를 만족하지 못한다.

검증 훅:
```powershell
# 같은 logical button 2회 호출 시 409 + existingJobId
# 다른 logical button 호출 시 병렬 jobId 2개 생성 확인
```
사용자 확인 필요: **예**
