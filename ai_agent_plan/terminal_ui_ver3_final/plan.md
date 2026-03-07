# Plan — terminal_ui_ver3_final

## KO

> ℹ️ 이 문서가 현재 작업 기준 문서이다.

### 목표
`terminal_ui_ver3_final`에서 아래 요구를 구현하기 위한 계획을 정의한다.

1. News Feed Window에 `Score` 컬럼을 추가한다.
2. News Feed Window에 `Keywords` 컬럼을 실제 표시 가능한 컬럼으로 추가한다.
3. News feed 데이터를 runtime DB에 canonical 형태로 저장한다.
4. News feed 다운로드 시 Finnhub `news-sentiment`도 함께 수집하고, sentiment 결과를 컬럼 선택 목록에 추가한다.
5. Terminal UI를 껐다 켜도 마지막 작업 상태(탭, 창, 배치, 선택 상태, 테마, 설정)를 복원한다.
6. 다른 탭으로 갔다가 다시 돌아와도 탭별 상태가 유지되게 한다.
7. Data Control Window 안에 `Settings` 탭을 추가하고, 전체 글자 크기를 조절 가능하게 한다.

### 현재 레포 상태(중요, 확인됨)
- 백엔드 runtime DB는 `terminal/backend/backend/data/app.db` 이다.
- 백엔드에는 이미 `news_items`, `news_change_metrics`, `news_fulltext`, `update_status` 테이블이 존재한다.
- `GET /api/news`는 현재 `news_items`만 읽지 않고, `news_fulltext.keywords_json`과 `news_change_metrics`를 join해서 응답한다.
- `news_fulltext`에는 이미 `[][][]keywords_json[][][]`, `[][][]keywords_status[][][]`, `[][][]keywords_updated_at[][][]` 컬럼이 있다.
- `fulltextRepository.updateKeywords()`가 이미 존재하므로 keywords 저장 파이프라인의 일부는 구현되어 있다.
- `FinnhubNewsWindow.tsx`에는 `keywords` 컬럼 타입/렌더링 코드가 이미 있으나, `DEFAULT_COLUMNS`에 빠져 있어 기본 컬럼 세트/컬럼 선택 메뉴에서 실사용 상태가 아니다.
- `FinnhubNewsWindow.tsx`는 `localStorage`에 `finnhub-last-update-config`만 저장한다. 즉 뉴스 창 일부 설정만 보존되고, 앱 전체 레이아웃/탭/테마는 보존되지 않는다.
- `App.tsx`의 `tabs`, `activeTabId`, `isDarkMode`, `linkedTicker`는 모두 메모리 상태만 사용한다. 앱 재실행 시 초기화된다.
- `DataControlWindow.tsx`는 현재 4개 섹션(`IBKR Price Data`, `IBKR Calendar Data`, `Recent Change% Update`, `Custom Change% Update`)과 job log panel이 있으나, 별도 `Settings` 탭이나 전역 글자 크기 제어는 없다.
- Finnhub comprehensive probe 기록상 `news-sentiment` 엔드포인트는 접근 가능하다. 다만 현재 backend 수집/저장 흐름에는 아직 연결되어 있지 않다.
- 현재 프론트 문서 기준으로 `Finnhub News`, `Default Ticker`, `Data Control`은 실제 API 연동이 있고, `Watchlist`, `Calendar`는 일부 mock/stub 흔적이 남아 있다.

### 제약 / 비범위
- 이번 plan은 구현 계획 문서 작성이 목적이다. 아직 코드 변경/테스트 실행을 전제로 하지 않는다.
- mock sentiment, mock score, 임의 점수 생성 로직은 추가하지 않는다.
- Finnhub가 주지 않는 값을 UI 편의를 위해 추정 숫자로 채우지 않는다.
- `Score`의 정확한 계산식이 확정되기 전에는 DB 스키마와 UI 라벨만 먼저 굳히지 않는다.
- 전체 글자 크기 조절은 우선 `terminal_ui_ver3_final` 앱 범위의 UI scale/font scale을 뜻한다. OS 전체 폰트나 브라우저 줌 제어는 비범위다.
- 서버 재시작 후 background job 상태 복구까지 이번 범위에 포함할지 여부는 미확정 사항으로 둔다.

### 읽는 방법(비개발자/일반인 기준)
이 문서는 “무엇을 어디까지 바꿔야 하는지”를 단계별로 보여주는 작업 계획서다.

읽는 순서:
1. `목표`에서 최종적으로 보이게 될 기능을 본다.
2. `현재 레포 상태`에서 이미 있는 것과 없는 것을 구분한다.
3. `결정/선행조건`과 `미확정 사항`에서 먼저 정해야 하는 부분을 본다.
4. `단계별 계획`에서 각 Step의 작업, 파일, 검증 방법을 본다.

완료를 눈으로 확인하는 기준:
- News Feed 컬럼 메뉴에서 `Score`, `Keywords`, `Sentiment`를 직접 on/off 할 수 있다.
- 앱을 닫았다 다시 열면 직전 탭/창 배치와 활성 탭이 복원된다.
- 탭 A에서 창을 이동해 두고 탭 B로 갔다가 다시 오면 탭 A 레이아웃이 그대로 남는다.
- Data Control Window 안에 `Settings` 탭이 생기고, 글자 크기 슬라이더나 preset을 바꾸면 전체 창에 반영된다.
- 뉴스 업데이트 후 DB에 sentiment 관련 row/컬럼이 채워지고, `GET /api/news` 응답에도 들어온다.

용어(Glossary):
- `workspace state`: 앱 전체의 탭/창/활성 탭/테마/폰트 크기 같은 복원 대상 상태
- `tab state`: 특정 탭 안의 창 목록, 창 위치/크기, 탭 이름, 탭별 선택 상태
- `news sentiment`: Finnhub `news-sentiment` 응답에서 얻는 종목 단위 sentiment 데이터
- `score`: 사용자가 News Feed에서 보게 될 단일 숫자/등급 컬럼. 산식은 미확정
- `canonical DB`: 앱이 실제로 조회하는 단일 source of truth 저장소. 현재 기본 후보는 `terminal/backend/backend/data/app.db`

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)
plan 진행 중 요구가 바뀌면 아래 형식으로 리비전 노트를 추가한다.

```text
PLAN CHANGE (YYYY-MM-DD)
- 왜: <사유>
- 무엇이 바뀌었나: <추가/삭제/순서 변경>
- 영향: <범위/리스크/검증 영향>
```

각 Step 완료 시 채팅/로그 기준 템플릿:

```text
Step N — <제목>
- 변경 내용: <변경 파일/영역>
- 검증 방법: <정확한 명령어 또는 눈으로 볼 체크포인트>
- 문제점/리스크: <문제> → 완화 방안: (1) ... (2) ... (3) ...
- 사용자 확인 필요?: Yes
```

### 아키텍처(상위)
이번 작업은 크게 4개 축으로 나뉜다.

1. News data enrichment 축
   - Finnhub 뉴스 pull 시 기존 `news_items` 적재 후, sentiment를 같은 ingestion 흐름 안에서 추가 수집한다.
   - keywords는 이미 `news_fulltext`에 저장하는 경로가 있으므로, ver3에서는 UI 노출과 저장 기준을 정합화한다.
   - score는 sentiment/keywords/change metrics 중 어떤 값을 사용해 계산할지 먼저 확정해야 한다.

2. API contract 축
   - `GET /api/news` 응답에 `score`, `sentiment`, `keywords`를 안정적으로 내려준다.
   - 프론트는 컬럼 토글만 하는 것이 아니라, 숨김/표시 상태도 탭별 또는 workspace별로 저장 가능해야 한다.

3. Workspace persistence 축
   - 앱 셸의 `tabs`, `activeTabId`, `linkedTicker`, `isDarkMode`, 각 window position/size/title/linkId를 저장한다.
   - 창별 로컬 UI 상태(예: Finnhub source filter, columns, display mode, Data Control active tab)는 저장 범위를 정해서 직렬화한다.

4. UI settings 축
   - Data Control Window 내부에 `Updates` / `Settings` 탭 구조를 추가한다.
   - Settings 탭에서 전역 font scale을 CSS variable 또는 app-level class로 제어한다.

권장 저장 구조:
- 뉴스 원본 메타: `[][][]news_items[][][]`
- 뉴스 full text / keywords: `[][][]news_fulltext[][][]`
- 뉴스 sentiment: 별도 `[][][]news_sentiment_snapshots[][][]` 테이블 권장
- score: `score` 산식이 snapshot 성격이면 별도 `[][][]news_scores[][][]` 또는 `news_sentiment_snapshots.score` 컬럼 고려
- 앱 상태: 1차는 프론트 `localStorage`, 2차 확장 시 backend saved view/API로 승격 가능

### 결정/선행조건(초기에 확정 필요)
1. `Score`의 운영적 정의
   - 선택지 A: Finnhub sentiment 응답의 score를 그대로 표시
   - 선택지 B: sentiment + keyword hit + change metric을 조합한 내부 score
   - 선택지 C: 정수 grade(예: 0~100)로 정규화한 별도 계산값
   - 현재 권장: A 또는 B 중 하나를 먼저 확정. C는 추가 설계 비용이 큼.

2. sentiment 저장 위치
   - 선택지 A: `news_items` 직접 컬럼 추가
   - 선택지 B: `news_id` 또는 `(ticker, asof_date)` 기준 별도 테이블
   - 현재 권장: B. 뉴스 원문과 enrichment를 분리하면 재수집/재계산이 안전하다.

3. workspace persistence 저장소
   - 선택지 A: 프론트 `localStorage`만 사용
   - 선택지 B: backend DB에도 저장해 브라우저/기기 간 동기화까지 고려
   - 현재 권장: A. 이번 범위에서 가장 빠르고 리스크가 낮다.

4. 탭 상태 기억 범위
   - 선택지 A: 창 배치와 활성 탭만 저장
   - 선택지 B: 창 내부 필터/컬럼/검색어까지 저장
   - 현재 권장: B. 사용자가 말한 “마지막 상태”에 더 가깝다.

### 계획 중간 필수 확인
중간 구현 전에 반드시 아래를 확인한다.

1. Finnhub `news-sentiment` 응답 필드가 어떤 단위인지 확인
   - 종목 기준인지, 기사 기준인지
   - 날짜 범위와 timestamp 단위
   - 동일 뉴스 row에 매핑할 때 어떤 key를 사용할지

2. `Score`가 기사 단위인지 ticker/day snapshot 단위인지 확인
   - 기사 단위가 아니면 `news_id`에 직접 고정 저장할 수 없다.

3. workspace state 직렬화 범위 확인
   - 창 내부 상태를 어디까지 저장할지 명시
   - localStorage key versioning 필요 여부 확인

### 제안하는 구현 순서(이유)
1. Step 0에서 `Score`/sentiment 매핑과 저장 모델을 먼저 고정한다.
   - 이유: 이 결정이 DB/API/UI 전체를 바꾼다.
2. Step 1에서 backend DB/API를 먼저 맞춘다.
   - 이유: 프론트 컬럼 추가보다 데이터 contract가 선행되어야 한다.
3. Step 2에서 News Feed 컬럼과 Data Control Settings UI를 붙인다.
   - 이유: backend 응답이 확정된 뒤 UI wiring이 단순해진다.
4. Step 3에서 workspace persistence를 구현한다.
   - 이유: 앱 셸과 각 창 상태 저장을 한 번에 묶어야 중복 수정이 줄어든다.
5. Step 4에서 통합 검증과 문서 동기화를 한다.

### 단계별 계획(각 단계: 구현 → 검증)

#### 🚫 Step 0 — 요구 해석과 데이터 계약 확정

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | Finnhub `news-sentiment` 응답 구조를 다시 확인하고 기사 단위 매핑 가능 여부를 결정 | 🚫 |
| 0-2 | `Score` 컬럼의 정의와 표시 포맷(숫자/등급/소수점)을 확정 | 🚫 |
| 0-3 | sentiment/score 저장 위치를 `app.db` 내 별도 테이블 기준으로 확정 | 🚫 |
| 0-4 | workspace persistence 범위(탭/창/컬럼/필터/테마/폰트 크기)를 freeze | 🚫 |

0-1 목적: sentiment가 뉴스 기사와 1:1인지, ticker snapshot인지 확인한다.
0-1 설명: 어떤 key로 `news_items`와 연결할지 정해져야 DB 설계가 가능하다.
0-1 완료 조건(눈으로 확인): probe/문서에 sentiment 필드명과 key 규칙이 정리된다.
0-1 사람 검증(비개발자): 문서에 “뉴스 한 건에 어떤 sentiment가 붙는지” 예시 2개가 보인다.
0-1 흔한 문제/주의: ticker-day aggregate를 기사 score처럼 오해하면 잘못 저장된다.

0-2 목적: `Score`가 무엇을 의미하는지 UI/DB 모두에서 한 가지로 통일한다.
0-2 설명: 정렬, 색상, null 처리, 컬럼명 tooltip까지 같은 의미를 사용해야 한다.
0-2 완료 조건(눈으로 확인): 문서에 formula 또는 source field가 1문장으로 명확히 적힌다.
0-2 사람 검증(비개발자): “이 숫자가 무엇을 뜻하는지”를 한 문장으로 말할 수 있다.
0-2 흔한 문제/주의: score가 sentiment와 중복이면 불필요한 컬럼이 된다.

0-3 목적: enrichment 데이터의 canonical 저장소를 고정한다.
0-3 설명: runtime 조회 대상이 `app.db` 하나로 수렴되게 한다.
0-3 완료 조건(눈으로 확인): 테이블 이름/주요 컬럼/PK가 plan에 나온다.
0-3 사람 검증(비개발자): 어느 DB 파일을 보면 되는지 하나만 확인하면 된다.
0-3 흔한 문제/주의: `news_items`에 직접 붙이면 migration 부담이 커질 수 있다.

0-4 목적: “마지막 상태 기억” 범위를 애매하지 않게 만든다.
0-4 설명: 저장/복원 대상 state를 목록화한다.
0-4 완료 조건(눈으로 확인): localStorage payload 예시가 문서에 적힌다.
0-4 사람 검증(비개발자): 앱 종료 후 어떤 것이 복원되는지 목록으로 확인 가능하다.
0-4 흔한 문제/주의: 너무 많이 저장하면 schema drift가 자주 난다.

검증 훅:
```text
- Finnhub sentiment sample 응답을 문서에 정리
- Score 정의를 예시 2개와 함께 문서에 기재
- persistence 저장 범위를 체크리스트로 확정

사용자 확인 필요: 예
```

#### ⬜ Step 1 — Backend schema / repository / API 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | sentiment/score 저장용 테이블 또는 컬럼 migration 추가 | `terminal/backend/src/db.ts` | 서버 시작 후 테이블 생성 확인 | ⬜ |
| 1-2 | Finnhub sentiment fetch + retry + mapping 로직 추가 | `terminal/backend/src/services/finnhubNewsProvider.ts` | sentiment fetch probe 통과 | ⬜ |
| 1-3 | sentiment snapshot repository 추가 | `terminal/backend/src/services/` | TypeScript build 통과 | ⬜ |
| 1-4 | `GET /api/news` 응답에 score/sentiment/keywords 계약 반영 | `terminal/backend/src/services/newsRepository.ts`, `terminal/backend/src/server.ts`, `terminal/backend/src/types.ts` | `/api/news` JSON 필드 확인 | ⬜ |
| 1-5 | news pull job 완료 시 sentiment도 함께 저장되도록 orchestration 연결 | `terminal/backend/src/server.ts` 또는 관련 job service | update job 후 DB row 확인 | ⬜ |

1-1 목적: runtime DB가 score/sentiment를 영속 저장할 수 있게 만든다.
1-1 설명: 테이블 생성과 기존 DB migration을 안전하게 처리한다.
1-1 완료 조건(눈으로 확인): `app.db`에 새 테이블/컬럼이 보인다.
1-1 사람 검증(비개발자): DB 점검 스크립트 출력에서 새 이름이 보인다.
1-1 흔한 문제/주의: 기존 `news_items`와 중복 저장 구조를 만들지 않도록 주의한다.

1-2 목적: Finnhub sentiment 데이터를 실제로 가져오게 한다.
1-2 설명: 재시도/백오프 규칙을 지키고, rate limit 실패를 로그에 남긴다.
1-2 완료 조건(눈으로 확인): pull job 로그에 sentiment fetch 단계가 보인다.
1-2 사람 검증(비개발자): 같은 티커 뉴스를 업데이트한 뒤 sentiment 값이 비어 있지 않다.
1-2 흔한 문제/주의: 기사 단위 매핑이 불가능하면 ticker/date snapshot 방식으로 우회해야 한다.

1-3 목적: news metadata와 sentiment enrichment를 분리 저장한다.
1-3 설명: 재수집 시 upsert 기준을 분명히 한다.
1-3 완료 조건(눈으로 확인): repository 함수 이름과 PK 기준이 문서/코드에 있다.
1-3 사람 검증(비개발자): 같은 업데이트를 두 번 돌려도 중복 row가 폭증하지 않는다.
1-3 흔한 문제/주의: PK 정의가 약하면 duplicate snapshot이 쌓인다.

1-4 목적: 프론트가 필요한 필드를 한 번에 받을 수 있게 한다.
1-4 설명: null 허용 규칙과 컬럼명을 고정한다.
1-4 완료 조건(눈으로 확인): API 응답 예시에 `score`, `sentiment`, `keywords`가 보인다.
1-4 사람 검증(비개발자): 브라우저 network 응답에서 새 필드가 보인다.
1-4 흔한 문제/주의: 이름을 바꾸면 프론트 매핑이 바로 깨진다.

1-5 목적: 업데이트 버튼 한 번으로 뉴스 + sentiment가 함께 최신화되게 한다.
1-5 설명: 별도 수동 step 없이 ingestion pipeline에 묶는다.
1-5 완료 조건(눈으로 확인): job 완료 후 score/sentiment가 바로 조회된다.
1-5 사람 검증(비개발자): 업데이트 후 새 뉴스에 sentiment 컬럼 값이 표시된다.
1-5 흔한 문제/주의: 실패 시 뉴스는 들어오고 sentiment만 비는 partial success를 로그로 구분해야 한다.

검증 훅:
```bash
cd terminal/backend
npm run build
node test_check_news_db.mjs
```

```text
추가 확인:
- GET /api/news?source_names=FINNHUB&limit=5 응답에 score/sentiment/keywords 포함 여부 확인
- sentiment 저장 테이블 row count 확인

사용자 확인 필요: 예
```

#### ⬜ Step 2 — News Feed / Data Control UI 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | News Feed 컬럼 정의에 `Score`, `Keywords`, `Sentiment`를 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | UI 컬럼 메뉴 확인 | ⬜ |
| 2-2 | `Keywords`를 default/선택 컬럼 동작으로 정상 연결 | 같은 파일 | 컬럼 토글 및 렌더 확인 | ⬜ |
| 2-3 | score/sentiment 셀 렌더, 정렬, null 표시 규칙 추가 | 같은 파일 | 정렬/표시 확인 | ⬜ |
| 2-4 | Data Control Window에 `Updates` / `Settings` 탭 구조 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx` | 탭 전환 확인 | ⬜ |
| 2-5 | Settings 탭에 전체 글자 크기 조절 UI 추가 | 같은 파일 및 app shell styling | 슬라이더/프리셋 반영 확인 | ⬜ |

2-1 목적: 사용자가 필요한 3개 컬럼을 실제로 보이게 만든다.
2-1 설명: 단순 타입 선언이 아니라 메뉴/헤더/행 렌더까지 연결한다.
2-1 완료 조건(눈으로 확인): Columns 메뉴에 3개 항목이 모두 나온다.
2-1 사람 검증(비개발자): 체크박스로 끄고 켤 수 있다.
2-1 흔한 문제/주의: 타입만 있고 `DEFAULT_COLUMNS`에 빠지면 다시 반쪽 구현이 된다.

2-2 목적: 기존 keywords 파이프라인을 UI에 완성한다.
2-2 설명: 이미 응답이 내려오는 값을 실제 컬럼으로 사용한다.
2-2 완료 조건(눈으로 확인): keyword chip 또는 placeholder가 행마다 보인다.
2-2 사람 검증(비개발자): keywords가 있는 뉴스와 없는 뉴스의 차이가 보인다.
2-2 흔한 문제/주의: `keywordsStatus`가 pending인데 빈 배열처럼 보이면 혼동된다.

2-3 목적: score/sentiment를 읽기 쉬운 형태로 표시한다.
2-3 설명: 숫자 포맷, 색상, tooltip, 정렬키를 정한다.
2-3 완료 조건(눈으로 확인): score 열 정렬이 기대대로 동작한다.
2-3 사람 검증(비개발자): 높은 score가 위로, null은 아래로 정렬된다.
2-3 흔한 문제/주의: 문자열 정렬로 처리하면 숫자 순서가 깨진다.

2-4 목적: Data Control을 운영용 탭과 환경설정 탭으로 분리한다.
2-4 설명: 기존 update 섹션은 `Updates` 탭으로 유지하고 새 `Settings` 탭을 추가한다.
2-4 완료 조건(눈으로 확인): Data Control 상단에 탭이 보인다.
2-4 사람 검증(비개발자): Updates와 Settings를 번갈아 눌러도 내용이 유지된다.
2-4 흔한 문제/주의: active tab 상태를 저장하지 않으면 다시 열 때 기본 탭으로만 돌아간다.

2-5 목적: 전역 글자 크기 조절을 UI에서 제어한다.
2-5 설명: CSS variable 기반 font scale을 앱 전체에 적용한다.
2-5 완료 조건(눈으로 확인): 슬라이더를 움직이면 여러 창의 글자가 함께 커지거나 작아진다.
2-5 사람 검증(비개발자): News/Data Control/Tab bar 텍스트가 같이 바뀐다.
2-5 흔한 문제/주의: 일부 컴포넌트가 px 고정이면 전체 일관성이 깨진다.

검증 훅:
```bash
cd termina_web/figma_code/terminal_ui_ver2_finhub
npm run build
```

```text
추가 확인:
- News Feed 컬럼 메뉴에서 Score/Keywords/Sentiment 토글 가능
- Data Control에서 Settings 탭 표시
- 글자 크기 변경 시 앱 전반 반영

사용자 확인 필요: 예
```

#### ⬜ Step 3 — Workspace state persistence 구현

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 앱 셸의 tabs/activeTab/theme/linkedTicker 저장 구조 설계 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx` | 새 localStorage payload 확인 | ⬜ |
| 3-2 | 창 배치(position/size/title/type/linkId) 저장/복원 구현 | `App.tsx`, `DraggableWindow.tsx` 관련 파일 | 재실행 후 복원 확인 | ⬜ |
| 3-3 | 탭 전환 후 탭별 window state 유지 확인 및 보강 | `App.tsx` 및 창 컴포넌트 state wiring | 탭 왕복 테스트 | ⬜ |
| 3-4 | 창별 중요 UI state(컬럼/필터/검색/active Settings tab) 저장 범위 반영 | `FinnhubNewsWindow.tsx`, `DataControlWindow.tsx` 등 | 창 재오픈 후 상태 복원 확인 | ⬜ |
| 3-5 | storage versioning / fallback reset 로직 추가 | app shell 공용 유틸 | 깨진 payload 복구 확인 | ⬜ |

3-1 목적: 앱 전체 복원의 기준 payload를 만든다.
3-1 설명: localStorage key, version, schema를 정한다.
3-1 완료 조건(눈으로 확인): 브라우저 localStorage에 workspace state가 저장된다.
3-1 사람 검증(비개발자): 개발자도구 Application 탭에서 key를 볼 수 있다.
3-1 흔한 문제/주의: key 이름을 임시로 만들면 추후 migration이 어렵다.

3-2 목적: 창 레이아웃을 재실행 후에도 그대로 복원한다.
3-2 설명: 탭별 windows 배열과 geometry를 직렬화한다.
3-2 완료 조건(눈으로 확인): 앱 종료 후 다시 켜도 같은 위치에 창이 보인다.
3-2 사람 검증(비개발자): 창을 옮기고 닫았다 다시 열면 그대로다.
3-2 흔한 문제/주의: 화면 크기가 달라지면 off-screen 복원이 생길 수 있다.

3-3 목적: 탭을 이동해도 상태가 휘발되지 않게 한다.
3-3 설명: active tab만 바뀌고, 비활성 탭 상태는 유지한다.
3-3 완료 조건(눈으로 확인): 탭 A의 창 배치를 유지한 채 탭 B에서 작업 가능하다.
3-3 사람 검증(비개발자): 탭 A → 탭 B → 탭 A 왕복 시 이전 모습 유지.
3-3 흔한 문제/주의: 렌더 재생성 시 key가 바뀌면 내부 state가 리셋된다.

3-4 목적: 사용자가 말한 “마지막 상태”를 창 내부까지 확장한다.
3-4 설명: 최소한 컬럼 가시성, source filter, display mode, Settings active tab, font size는 저장한다.
3-4 완료 조건(눈으로 확인): News Feed 검색/컬럼 상태가 재실행 후 남아 있다.
3-4 사람 검증(비개발자): 컬럼을 끄고 앱 재시작 후 그대로 꺼져 있다.
3-4 흔한 문제/주의: 모든 transient state를 저장하면 오히려 버그가 늘 수 있다.

3-5 목적: 손상된 저장값이 있어도 앱이 죽지 않게 한다.
3-5 설명: parse 실패 시 안전한 초기 상태로 fallback 한다.
3-5 완료 조건(눈으로 확인): 잘못된 JSON을 넣어도 앱이 기본 상태로 뜬다.
3-5 사람 검증(비개발자): localStorage를 지워도 앱이 정상 시작한다.
3-5 흔한 문제/주의: versioning이 없으면 나중 schema 변경 때 복원이 깨진다.

검증 훅:
```text
수동 검증:
1. 탭 2개 생성
2. 각 탭의 창 위치/크기/필터를 다르게 설정
3. 앱 새로고침 또는 재실행
4. 마지막 활성 탭과 탭별 상태가 복원되는지 확인

사용자 확인 필요: 예
```

#### ⬜ Step 4 — 통합 검증 / 문서 동기화 / 운영 가드레일

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | backend/frontend prompt 문서를 실제 구현과 동기화 | `terminal/backend_prompt.md`, `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 diff 확인 | ⬜ |
| 4-2 | score/sentiment null 처리와 실패 로그 정책 정리 | 관련 prompt 및 plan 리비전 | 실패 케이스 확인 | ⬜ |
| 4-3 | end-to-end 수동 검증 체크리스트 정리 | plan 또는 test 문서 | 체크리스트 실행 | ⬜ |

4-1 목적: 코드와 문서가 다시 벌어지지 않게 한다.
4-1 설명: 구현 후 prompt/spec 문서를 최신화한다.
4-1 완료 조건(눈으로 확인): 새 컬럼과 persistence 동작이 문서에 반영된다.
4-1 사람 검증(비개발자): 문서를 읽고 UI 동작을 그대로 재현할 수 있다.
4-1 흔한 문제/주의: plan만 바뀌고 prompt가 안 바뀌면 다음 작업에서 혼선이 생긴다.

4-2 목적: 부분 실패를 운영자가 이해할 수 있게 만든다.
4-2 설명: 뉴스는 들어왔지만 sentiment가 실패한 경우를 명시한다.
4-2 완료 조건(눈으로 확인): 로그/문서에 partial success 기준이 적힌다.
4-2 사람 검증(비개발자): 에러 메시지가 “무엇이 비었는지” 설명한다.
4-2 흔한 문제/주의: null과 0을 혼동하면 잘못된 score로 보인다.

4-3 목적: 실제 사용 시나리오 기준 최종 확인을 준비한다.
4-3 설명: update → 조회 → 탭 전환 → 재실행 흐름을 한 번에 검증한다.
4-3 완료 조건(눈으로 확인): 체크리스트가 1회 실행 가능한 순서로 정리된다.
4-3 사람 검증(비개발자): 체크리스트 순서대로 따라 하면 핵심 기능을 다 볼 수 있다.
4-3 흔한 문제/주의: backend/frontend를 따로만 확인하면 persistence 버그를 놓칠 수 있다.

검증 훅:
```bash
cd terminal
npm run build
npm run test
```

```text
수동 확인:
- News 업데이트 후 Score/Keywords/Sentiment 컬럼 확인
- 앱 종료/재실행 후 상태 복원 확인
- Data Control Settings에서 글자 크기 반영 확인

사용자 확인 필요: 예
```

### 미확정 사항(명시 결정 필요)
1. 결정 #1 — `Score` 정의
   - 선택지: Finnhub raw score 사용 / 내부 composite score / 정규화 등급
   - 차단 대상 Step: 0, 1, 2

2. 결정 #2 — sentiment 저장 단위
   - 선택지: 기사별 snapshot / ticker-date snapshot / 직접 컬럼
   - 차단 대상 Step: 1

3. 결정 #3 — 앱 상태 저장 범위
   - 선택지: layout만 / layout+window filters / 거의 모든 UI state
   - 차단 대상 Step: 3

4. 결정 #4 — font size 저장 위치
   - 선택지: global localStorage / tab별 저장 / backend saved settings
   - 차단 대상 Step: 2, 3

### 실행 의존성 그래프

Legend
- ✅ 구현 + 사용자확인 완료
- ⏳ 구현완료, 사용자확인 대기
- ⬜ 미착수
- 🚫 선행조건 미충족(차단)

```text
[Track A: 데이터 계약 / 백엔드]
🚫 0-1 sentiment 응답 구조 확정
🚫 0-2 Score 정의 확정
🚫 0-3 저장 위치 확정
   |
   v
⬜ 1-1 DB migration
⬜ 1-2 Finnhub sentiment fetch
⬜ 1-3 sentiment repository
⬜ 1-4 GET /api/news contract 확장
⬜ 1-5 pull job orchestration 연결

[Track B: 프론트 컬럼 / 운영 UI]
🚫 0-2 Score 정의 확정
🚫 0-4 persistence 범위 확정
   |
   +--> ⬜ 2-1 Score/Keywords/Sentiment 컬럼 반영
   +--> ⬜ 2-2 Keywords 컬럼 활성화
   +--> ⬜ 2-3 score/sentiment 정렬/렌더
   +--> ⬜ 2-4 Data Control Settings 탭 추가
   +--> ⬜ 2-5 전체 글자 크기 조절 UI

[Track C: workspace persistence]
🚫 0-4 persistence 범위 확정
   |
   v
⬜ 3-1 workspace state schema
⬜ 3-2 창 배치 저장/복원
⬜ 3-3 탭 왕복 상태 유지
⬜ 3-4 창 내부 UI state 저장
⬜ 3-5 storage version/fallback

[Track D: 마감]
⬜ 4-1 prompt 문서 동기화
⬜ 4-2 partial success/null 정책 정리
⬜ 4-3 E2E 체크리스트 정리

================ BLOCKER ================
결정 #1 Score 정의가 확정되지 않으면
Step 1 backend schema와 Step 2 UI 컬럼 의미가 고정되지 않는다.
=========================================
```

병렬 트랙 요약:
- Track A와 Track B/C는 Step 0 결정이 끝난 뒤 병렬 진행 가능하다.
- Track B와 Track C는 서로 독립 작업이 많지만, font size 저장 위치와 app state schema는 공유한다.
- Track D는 A/B/C가 끝난 뒤 마감 단계로 수행한다.

차단 요약 테이블:

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| Score 정의 | Step 1, Step 2 | Finnhub raw / composite / normalized grade |
| sentiment 저장 단위 | Step 1 | 기사별 / ticker-date / direct column |
| persistence 범위 | Step 3 | layout only / layout+filters / broad workspace |
| font size 저장 위치 | Step 2, Step 3 | global localStorage / tab scoped / backend |

### 결정 #1 — Score 정의(상세)
권장 기준:
- `Score`는 사용자가 한눈에 비교하는 컬럼이므로 null/정렬/범례가 단순해야 한다.
- 이미 `Sentiment` 컬럼을 별도로 노출할 예정이면, `Score`는 `Sentiment` raw 값과 완전히 같은 의미가 되지 않도록 주의해야 한다.

권장안:
- 1차 구현은 Finnhub에서 제공하는 sentiment score 또는 bull/bear 비율 기반의 단일 숫자를 그대로 쓰고, 컬럼 라벨 tooltip으로 의미를 설명한다.
- 후속 단계에서 필요하면 composite score로 확장한다.

예시:
- 예시 1: `AAPL` 뉴스 row가 해당 시점 sentiment snapshot `0.72`를 가지면 `Score=0.72`, `Sentiment=Positive`처럼 분리 표시 가능.
- 예시 2: sentiment 응답이 없으면 `Score=null`, `Sentiment=Unavailable`로 표시하고 0으로 대체하지 않는다.

### 결정 #2 — persistence 저장 payload(상세)
권장 payload 초안:

```json
{
  "version": 1,
  "activeTabId": "1712345678901",
  "isDarkMode": false,
  "fontScale": 1,
  "linkedTicker": { "1": "AAPL" },
  "tabs": [
    {
      "id": "1712345678901",
      "name": "Tab 1",
      "windows": [
        {
          "id": "1712345678901-finhub-news-0",
          "type": "finhub-news",
          "title": "News Feed: Finnhub API",
          "linkId": 1,
          "position": { "top": 20, "left": 20, "width": 800, "height": 600 },
          "uiState": {
            "sourceTypeFilter": "all",
            "visibleColumns": ["date", "ticker", "title", "score", "sentiment"],
            "displayMode": "title-only"
          }
        }
      ]
    }
  ]
}
```

운영적 정의:
- `version`: localStorage schema 버전
- `activeTabId`: 마지막으로 보고 있던 탭
- `fontScale`: Settings 탭에서 조절한 전체 글자 크기 배율
- `uiState`: 창별로 복원할 최소 내부 상태

사람 확인 체크 항목:
- 앱을 다시 열었을 때 마지막 탭이 자동으로 열린다.
- News Feed의 컬럼 on/off 상태가 이전과 같다.
- 글자 크기가 마지막 설정값으로 유지된다.