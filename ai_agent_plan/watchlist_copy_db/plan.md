# Plan — watchlist_copy_db

## 목표
이번 독립 plan의 범위는 아래 3가지다.
1) `WatchlistWindow`에서 **watch list 이름을 복사**할 수 있게 한다.
2) 현재 watchlist가 **어디에 저장되는지(DB 구조)**를 분리해서 명확히 기록한다.
3) 프론트 `WatchlistWindow`가 **현재는 mock/local state 기반**이며, backend DB와 직접 연결되어 있지 않음을 명시한다.

## 현재 레포 상태(중요, 확인됨)
- 프론트 대상 파일: `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/WatchlistWindow.tsx`
- 현재 `WatchlistWindow`는 backend API를 사용하지 않고 mock/local state 기반이다.
- backend runtime DB는 `terminal/backend/backend/data/app.db` 이다.
- watchlist 관련 영속 테이블은 이미 존재한다.
  - `watchlists`
  - `watchlist_items`
- 2026-03-24 확인 기준 현재 row 수는 다음과 같다.
  - `watchlists = 0`
  - `watchlist_items = 0`
- 의미:
  - **저장 구조 자체는 DB에 이미 존재**한다.
  - 하지만 현재 프론트 `WatchlistWindow`는 그 DB를 직접 읽고 쓰지 않는다.

## 제약 / 비범위
- 이번 plan에서는 watchlist API 연동 전체를 새로 붙이지 않는다.
- watchlist create/delete/persist를 실제 backend DB와 동기화하는 작업은 별도 후속 plan으로 분리한다.
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
  - 현재 source of truth = 컴포넌트 local state
- 백엔드:
  - `watchlistRepository.ts`
  - `db.ts`
  - runtime DB = `app.db`
- 현재 구조상 같은 “watchlist”라는 이름을 쓰지만, 실제 동작은 두 층으로 나뉜다.
  - 프론트 창: mock/local state
  - 백엔드 저장소: SQLite 영속 테이블

## 결정/선행조건(초기에 확정 필요)
- 결정 #1: 이번 작업은 “독립 plan 생성”으로 처리한다. 기존 `terminal_ui_ver2_finhub/plan.md`의 하위 변경으로만 남기지 않는다.
- 결정 #2: watchlist copy UX는 우선 프론트 local state 기준으로 구현한다.
- 결정 #3: DB 저장 여부 답변은 실제 테이블 존재 + row 수 기준으로 검증한다.

## 계획 중간 필수 확인
- 프론트 copy UX가 동작해도, 사용자가 “DB 저장도 되는 줄” 오해하지 않도록 문서에 분리 기재해야 한다.
- DB 테이블 존재와 “현재 UI가 DB에 연결되지 않음”은 동시에 보여줘야 한다.

## 제안하는 구현 순서(이유)
1. 독립 plan 생성
2. copy UX 구현 상태 기록
3. DB 저장 구조와 현재 연결 상태를 검증 결과로 고정

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

#### ⏳ Step 2 — Watchlist DB 저장 구조 확인

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | runtime DB 경로 확인 | `terminal/backend/src/config.ts` | sqlitePath가 `./backend/data/app.db`로 설정 | ⏳ |
| 2-2 | watchlist 테이블 정의 확인 | `terminal/backend/src/db.ts` | `watchlists`, `watchlist_items` CREATE TABLE 존재 | ⏳ |
| 2-3 | repository 저장 경로 확인 | `terminal/backend/src/services/watchlistRepository.ts` | create/list/delete가 DB 테이블 사용 | ⏳ |
| 2-4 | 실제 DB row 수 확인 | `terminal/backend/backend/data/app.db` | 현재 row 수 확인 | ⏳ |

세부 단계 목적/설명
- `2-1` 목적: 실제 어떤 DB 파일이 앱의 source of truth인지 고정한다.
- `2-2` 목적: watchlist 저장 스키마가 이미 있는지 확인한다.
- `2-3` 목적: API/서비스 레벨에서 watchlist가 DB에 저장되는 구조임을 코드로 확인한다.
- `2-4` 목적: “저장 구조는 있음”과 “현재 저장된 데이터는 0건”을 분리해서 보여준다.

검증 훅
```text
1. config.ts에서 sqlitePath 확인
2. db.ts에서 watchlists / watchlist_items CREATE TABLE 확인
3. watchlistRepository.ts에서 INSERT / SELECT / DELETE 확인
4. app.db에서 watchlists / watchlist_items row 수 확인
```
- 사용자 확인 필요: **예**

#### ⏳ Step 3 — 프론트와 DB 연결 상태 분리 문서화

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | 프론트 스펙 문서에 copy UX 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | watchlist copy 동작이 문서에 반영 | ⏳ |
| 3-2 | 이 plan에 프론트 mock/local state 사실 명시 | `ai_agent_plan/watchlist_copy_db/plan.md` | plan에서 현재 연결 상태를 읽을 수 있음 | ⏳ |
| 3-3 | agent log에 DB 구조와 한계 기록 | `ai_agent_plan/watchlist_copy_db/agent_log.md` | 후속 작업자가 오해하지 않음 | ⏳ |

세부 단계 목적/설명
- `3-1` 목적: UI 동작 문서를 코드와 맞춘다.
- `3-2` 목적: 새 독립 plan만 읽어도 현재 상태를 알 수 있게 한다.
- `3-3` 목적: “copy는 됨, persist는 아직 UI 미연동”을 로그에 남긴다.

검증 훅
```text
1. figma_frontend_prompt.md의 Watchlist Window 섹션 확인
2. 이 plan의 현재 레포 상태 섹션 확인
3. agent_log.md에 DB 구조와 현재 한계가 기록됐는지 확인
```
- 사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)
1. 후속으로 `WatchlistWindow`를 backend `/api/watchlists`에 실제 연결할지 여부
2. watchlist 이름 복사 UX를 context menu 방식으로도 확장할지 여부

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
├───────────────► ⏳ Step 3 — 프론트/문서 동기화
│                 ⏳ 3-1 프론트 스펙 문서 반영
│                 ⏳ 3-2 새 plan에 현재 상태 정리
│                 ⏳ 3-3 agent_log 기록
│
└───────────────► ⏳ Step 2 — DB 저장 구조 확인
                  ⏳ 2-1 DB 경로 확인
                  ⏳ 2-2 테이블 정의 확인
                  ⏳ 2-3 repository 확인
                  ⏳ 2-4 실제 row 수 확인
```

### 결정 상세

#### 결정 #1 — 왜 기존 plan이 아니라 새 plan인가
- 사용자가 명시적으로 “새로 만들어”라고 요청했다.
- 따라서 기존 `terminal_ui_ver2_finhub/plan.md`의 하위 변경이 아니라, 독립 작업 문서로 분리한다.
- 이 문서는 watchlist copy UX와 DB 저장 여부 설명에만 집중한다.