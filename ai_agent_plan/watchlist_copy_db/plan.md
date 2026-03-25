# Plan — watchlist_copy_db

## 목표
이번 독립 plan의 범위는 아래 3가지다.
1) `WatchlistWindow`에서 **watch list 이름을 복사**할 수 있게 한다.
2) 현재 watchlist가 **어디에 저장되는지(DB 구조)**를 분리해서 명확히 기록한다.
3) 프론트 `WatchlistWindow`를 backend DB와 실제 연결하고, watch list 자체 삭제 버튼을 추가한다.

## 현재 레포 상태(중요, 확인됨)
- 프론트 대상 파일: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx`
- 기존 시작 시점의 `WatchlistWindow`는 backend API를 사용하지 않고 mock/local state 기반이었다.
- backend runtime DB는 `terminal/backend/backend/data/app.db` 이다.
- watchlist 관련 영속 테이블은 이미 존재한다.
  - `watchlists`
  - `watchlist_items`
- 2026-03-24 확인 기준 현재 row 수는 다음과 같다.
  - `watchlists = 0`
  - `watchlist_items = 0`
- 의미:
  - **저장 구조 자체는 DB에 이미 존재**한다.
  - 이번 변경에서 프론트 `WatchlistWindow`를 그 DB와 직접 읽고 쓰도록 연결한다.

## 제약 / 비범위
- 이번 plan에서는 watchlist create/load/update/delete를 실제 backend DB와 동기화한다.
- 단, 별도 alert 설정 UI는 이번 범위에 포함하지 않는다.
- 기존 `terminal_ui_ver2_finhub/plan.md`를 기준 문서로 삼지 않고, 이 문서를 독립 작업 기록으로 사용한다.

## 읽는 방법(비개발자/일반인 기준)
- 이 문서는 “지금 무엇을 바꿨고, 무엇은 아직 안 붙어 있는지”를 분리해서 보는 용도다.
- 핵심만 보면 된다.
  - Step 1: 이름 복사 UX
  - Step 2: DB 저장 구조 확인
  - Step 3: 프론트와 DB 연결 여부 정리

## 프로세스 템플릿(plan 변경 + 단계 완료 확인)
- 이미 구현된 항목이라도 사용자 확인 전에는 `⏳`로 둔다.
- 사용자가 결과를 확인하면 `✅`로 올린다.
- 후속으로 watchlist API 연동을 시작하면 이 plan을 갱신하지 않고 별도 plan으로 분리한다.

## 아키텍처(상위)
- 프론트:
  - `WatchlistWindow.tsx`
  - source of truth = backend API 응답 + local render state
- 백엔드:
  - `watchlistRepository.ts`
  - `db.ts`
  - runtime DB = `app.db`
- 이번 변경 후 구조상 watchlist 동작은 아래처럼 맞춘다.
  - 프론트 창: API 호출로 로드/생성/수정/삭제
  - 백엔드 저장소: SQLite 영속 테이블

## 결정/선행조건(초기에 확정 필요)
- 결정 #1: 이번 작업은 “독립 plan 생성”으로 처리한다. 기존 `terminal_ui_ver2_finhub/plan.md`의 하위 변경으로만 남기지 않는다.
- 결정 #2: watchlist create/load/update/delete는 backend API를 source of truth로 사용한다.
- 결정 #3: watch list 삭제 버튼은 dropdown 각 row에 둔다.

## 계획 중간 필수 확인
- copy UX와 실제 DB 저장 흐름이 같은 창에서 동시에 동작하도록 맞춘다.
- ticker 추가/삭제와 list 이름 변경도 DB에 반영되어야 한다.

## 제안하는 구현 순서(이유)
1. backend update API 추가
2. 프론트 load/create/update/delete 연결
3. 삭제 버튼 및 문서/검증 반영

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 1 — Watchlist 이름 복사 UX

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | 현재 선택된 watch list 이름 copy 버튼 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | 상단 버튼 클릭 시 active list name 복사 | ⏳ |
| 1-2 | dropdown 각 row에 copy 아이콘 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | 각 리스트 이름을 직접 복사 가능 | ⏳ |
| 1-3 | Clipboard API 실패 시 fallback 복사 처리 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | clipboard 미지원 환경에서도 복사 시도 가능 | ⏳ |
| 1-4 | 복사 성공 상태를 짧게 표시 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | copy 직후 check 아이콘 표시 | ⏳ |

세부 단계 목적/설명
- `1-1` 목적: 현재 사용 중인 리스트 이름을 한 번에 복사하게 한다.
  - 완료 조건(눈으로 확인): 상단 copy 버튼 클릭 후 이름이 붙여넣기 된다.
  - 사람 검증(비개발자): 메모장에 붙여넣어 현재 활성 리스트 이름이 들어가는지 확인.
- `1-2` 목적: dropdown 안의 개별 리스트도 바로 복사하게 한다.
  - 완료 조건(눈으로 확인): 특정 row copy 클릭 후 해당 row 이름이 붙여넣기 된다.
  - 사람 검증(비개발자): `Default`, `Tech Stocks` 등 서로 다른 이름이 정확히 복사되는지 확인.
- `1-3` 목적: 브라우저 권한 문제로 clipboard API가 막혀도 fallback을 둔다.
  - 완료 조건(눈으로 확인): fallback 경로가 코드에 존재한다.
  - 사람 검증(비개발자): 일반 브라우저 환경에서 복사가 실패 없이 동작하는지만 확인하면 충분하다.
- `1-4` 목적: 복사 성공 여부를 즉시 알게 한다.
  - 완료 조건(눈으로 확인): 복사 후 1.5초 안팎으로 check 상태가 보인다.
  - 사람 검증(비개발자): copy 직후 아이콘이 바뀌는지 본다.

검증 훅
```text
1. WatchlistWindow 열기
2. 상단 copy 버튼 클릭
3. 메모장 등에 붙여넣어 active watch list 이름 확인
4. Watch Lists dropdown 열기
5. 특정 row의 copy 아이콘 클릭
6. 붙여넣어 해당 row 이름 확인
7. copy 직후 check 아이콘 상태가 잠깐 보이는지 확인
```
- 사용자 확인 필요: **예**

#### ⏳ Step 2 — Watchlist DB 저장 구조 확인 및 update API 연결

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | runtime DB 경로 확인 | `terminal/backend/src/config.ts` | sqlitePath가 `./backend/data/app.db`로 설정 | ⏳ |
| 2-2 | watchlist 테이블 정의 확인 | `terminal/backend/src/db.ts` | `watchlists`, `watchlist_items` CREATE TABLE 존재 | ⏳ |
| 2-3 | repository update 경로 추가 | `terminal/backend/src/services/watchlistRepository.ts` | create/list/update/delete가 DB 테이블 사용 | ⏳ |
| 2-4 | `PUT /api/watchlists/:id` 추가 | `terminal/backend/src/server.ts` | 이름/티커 구성 갱신 가능 | ⏳ |
| 2-5 | 실제 DB row 수 확인 | `terminal/backend/backend/data/app.db` | 현재 row 수와 변경 반영 확인 | ⏳ |

세부 단계 목적/설명
- `2-1` 목적: 실제 어떤 DB 파일이 앱의 source of truth인지 고정한다.
- `2-2` 목적: watchlist 저장 스키마가 이미 있는지 확인한다.
- `2-3` 목적: API/서비스 레벨에서 watchlist가 create/list/update/delete 모두 DB에 저장되는 구조가 되게 한다.
- `2-4` 목적: 프론트에서 ticker 추가/삭제, 이름 변경이 가능하도록 최소 update endpoint를 연결한다.
- `2-5` 목적: “저장 구조 존재”와 “실제 변경 반영”을 DB 조회로 확인한다.

검증 훅
```text
1. config.ts에서 sqlitePath 확인
2. db.ts에서 watchlists / watchlist_items CREATE TABLE 확인
3. watchlistRepository.ts에서 INSERT / SELECT / UPDATE / DELETE 확인
4. `PUT /api/watchlists/:id` 호출로 이름/티커 갱신 확인
5. app.db에서 watchlists / watchlist_items row 수 확인
```
- 사용자 확인 필요: **예**

#### ⏳ Step 3 — 프론트와 DB 실제 연결 + 삭제 버튼

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 초기 로드 시 `GET /api/watchlists` 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | DB watchlist 목록 렌더 | ⏳ |
| 3-2 | 새 watch list 생성 시 `POST /api/watchlists` 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | 생성 즉시 DB 저장 | ⏳ |
| 3-3 | 이름 변경 및 ticker 추가/삭제 시 `PUT /api/watchlists/:id` 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | 변경 즉시 DB 반영 | ⏳ |
| 3-4 | dropdown에 watch list 삭제 버튼 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx` | list 단위 삭제 가능 | ⏳ |
| 3-5 | 프론트/백엔드 스펙 문서 동기화 | `figma_frontend_prompt.md`, `terminal/backend_prompt.md` | API/동작 설명 최신화 | ⏳ |
| 3-6 | agent log 기록 | `ai_agent_plan/watchlist_copy_db/agent_log.md` | 작업/검증 결과 추적 가능 | ⏳ |

세부 단계 목적/설명
- `3-1` 목적: 창이 열릴 때 DB 저장 watchlist를 바로 읽게 한다.
- `3-2` 목적: 새 watch list 생성이 실제 DB 저장으로 이어지게 한다.
- `3-3` 목적: 이름 변경과 ticker 추가/삭제도 즉시 DB에 반영한다.
- `3-4` 목적: 사용자가 watch list 자체를 UI에서 삭제하게 한다.
- `3-5` 목적: 프론트와 백엔드 스펙 문서를 최신 동작에 맞춘다.
- `3-6` 목적: 작업 이력과 검증 결과를 로그에 남긴다.

검증 훅
```text
1. WatchlistWindow 열기 → DB watchlist 로드 확인
2. 새 watch list 생성 → DB 저장 확인
3. 이름 변경 / ticker 추가 / ticker 삭제 → DB 반영 확인
4. watch list 삭제 버튼 클릭 → DB row 삭제 확인
5. figma_frontend_prompt.md와 backend_prompt.md 내용 확인
6. agent_log.md 기록 확인
```
- 사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 향후 `enable_alerts`를 프론트 UI에서도 직접 편집할지 여부
2. watchlist 상세 row를 실제 시세 API와도 연결할지 여부

### 실행 의존성 그래프

```text
╔══════════════════════════════════════════════════════╗
║ 범례: ✅ 완료+확인  ⏳ 구현완료/확인대기  ⬜ 미착수 ║
╚══════════════════════════════════════════════════════╝

⏳ Step 1 — Watchlist 이름 복사 UX
│  ⏳ 1-1 active list copy 버튼
│  ⏳ 1-2 dropdown row copy 아이콘
│  ⏳ 1-3 clipboard fallback
│  ⏳ 1-4 copy 성공 상태 표시
│
├───────────────► ⏳ Step 3 — 프론트/API/삭제 버튼 연결
│                 ⏳ 3-1 GET /api/watchlists 로드
│                 ⏳ 3-2 POST /api/watchlists 생성
│                 ⏳ 3-3 PUT /api/watchlists/:id 갱신
│                 ⏳ 3-4 DELETE 버튼 추가
│                 ⏳ 3-5 문서 동기화
│                 ⏳ 3-6 agent_log 기록
│
└───────────────► ⏳ Step 2 — DB 저장 구조 + update API 연결
                  ⏳ 2-1 DB 경로 확인
                  ⏳ 2-2 테이블 정의 확인
                  ⏳ 2-3 repository update 확인
                  ⏳ 2-4 PUT API 추가
                  ⏳ 2-5 실제 row 수 확인
```

### 결정 상세

#### 결정 #1 — 왜 기존 plan이 아니라 새 plan인가
- 사용자가 명시적으로 “새로 만들어”라고 요청했다.
- 따라서 기존 `terminal_ui_ver2_finhub/plan.md`의 하위 변경이 아니라, 독립 작업 문서로 분리한다.
- 이 문서는 watchlist copy UX, DB 저장 연결, list 삭제 버튼까지 포함한 독립 작업 문서다.