# Agent Log — terminal_ui_ver3_final

## 2026-03-06

### Plan 문서 초기 생성

**작성 시각:** 2026-03-06 19:24 (local)

**상태:** 확인 대기

#### 수행 내용

1. 사용자 요구를 기준으로 새 plan 프로젝트명 `terminal_ui_ver3_final`을 생성 대상으로 확정했다.
2. 기존 `terminal_ui_ver2_finhub/plan.md`, `terminal/backend_prompt.md`, 프론트 prompt, 관련 코드 파일을 읽어 현재 레포 상태를 확인했다.
3. 아래 요구를 새 `plan.md`에 단계형 계획으로 정리했다.
   - `Score` 컬럼 추가
   - `Keywords` 컬럼 실사용화
   - News feed data DB 저장 구조 정리
   - 뉴스 다운로드 시 sentiment 수집 및 컬럼 노출
   - 앱 재실행 후 마지막 상태 복원
   - 탭 전환 후 탭 상태 유지
   - Data Control Window의 `Settings` 탭 및 전체 글자 크기 조절
4. `Score` 정의가 아직 문장만으로는 고정되지 않아, 미확정 사항과 차단 항목으로 문서에 명시했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `ai_agent_plan/terminal_ui_ver3_final/plan.md`를 열어 아래 항목이 있는지 확인한다.
   - 목표
   - 현재 레포 상태
   - 단계별 계획
   - 미확정 사항
   - 실행 의존성 그래프
2. `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`를 열어 이번 plan 생성 기록이 있는지 확인한다.

#### 문제점 / 리스크

1. `Score`의 의미가 아직 확정되지 않았다.
   - 완화 방안 1: Finnhub raw sentiment score를 1차 기본값으로 채택
   - 완화 방안 2: 사용자 확인 후 composite score 설계로 진행
2. sentiment가 기사 단위가 아닐 수 있다.
   - 완화 방안 1: ticker-date snapshot 테이블로 분리 저장
   - 완화 방안 2: `news_id` 직접 저장 대신 조회 시 매핑 규칙을 명시
3. “마지막 상태” 범위가 넓다.
   - 완화 방안 1: 1차는 layout + active tab + font scale + 주요 filter부터 저장
   - 완화 방안 2: 이후 필요한 창별 UI state를 단계적으로 확대

#### 비고

- 이번 작업은 문서 생성만 수행했다.
- 코드 파일(`.ts`, `.tsx`, `.js`, `.py`)은 수정하지 않았다.
- 사용자 확인 전까지 이 plan의 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — ai-news-analysis 정의 반영

**작성 시각:** 2026-03-06 19:40 (local)

**상태:** 확인 대기

#### 수행 내용

1. AI 뉴스 분석 skills 지침의 정식 명칭을 `ai-news-analysis`로 고정했다.
2. 새 skills 문서 `.github/copilot-skills/ai-news-analysis.md`를 생성했다.
3. skills 문서에 아래 계약을 문서화했다.
   - `Score`: `-10 ~ 10`
   - `Score Evidence`: 점수 근거 텍스트
   - `Keywords`: 중요한 키워드 30개
   - 기본값: 분석 전에는 비워 둠
   - 저장/재조회/삭제 감지 테스트 필요
4. `terminal_ui_ver3_final/plan.md`를 리비전해서 기존의 “Score=sentiment 후보” 해석을 제거하고, AI analysis 결과 중심으로 다시 정의했다.

#### 생성/수정 파일

- `.github/copilot-skills/ai-news-analysis.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `.github/copilot-skills/ai-news-analysis.md`를 열어 `Score`, `Score Evidence`, `Keywords`, 기본 빈 상태, 테스트 요구가 있는지 확인한다.
2. `ai_agent_plan/terminal_ui_ver3_final/plan.md`를 열어 아래 반영 여부를 확인한다.
   - `Score Evidence` 컬럼 추가
   - `Score=-10~10` 정의
   - `Keywords=30개` 정의
   - 분석 전 기본 빈 상태 규칙
   - 값 삭제/유실 감지 테스트 요구

#### 문제점 / 리스크

1. AI 분석 실행 시점은 아직 미확정이다.
   - 완화 방안 1: 별도 수동 batch job으로 시작
   - 완화 방안 2: full text 추출 후 후속 batch로 제한
2. AI analysis 저장 위치는 아직 미확정이다.
   - 완화 방안 1: `news_ai_analysis` 별도 테이블 채택
   - 완화 방안 2: 필요 시 `news_fulltext` 확장과 비교 검토
3. 정상적인 미분석 row와 저장 후 유실 row를 테스트에서 구분해야 한다.
   - 완화 방안 1: `analysis_status` 같은 상태값 도입
   - 완화 방안 2: 테스트 fixture를 미분석/분석완료/유실 3종으로 분리

#### 비고

- 이번 작업도 문서만 수정했다.
- 구현 코드는 아직 시작하지 않았다.
- 사용자 확인 전까지 이 리비전 상태는 `확인 대기`로 유지한다.

### Plan 리비전 — persistence 권장범위 확정

**작성 시각:** 2026-03-06 19:48 (local)

**상태:** 사용자 확인 반영

#### 수행 내용

1. 사용자가 `0-4 persistence 범위`에 대해 “권장범위 까지”라고 명시적으로 확인했다.
2. plan에서 0-4를 더 이상 미확정이 아닌 확정 항목으로 반영했다.
3. 저장 범위를 아래처럼 고정했다.
   - 탭 목록, 마지막 활성 탭
   - 창 위치/크기/제목/linkId
   - 다크모드, 전체 글자 크기
   - News Feed 컬럼 on/off, source filter, 검색어, display mode
   - Data Control active tab
4. modal open 상태, loading 상태 같은 순간 UI 상태는 저장 범위에서 제외한다고 문서화했다.

#### 생성/수정 파일

- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `plan.md`에서 `0-4` 행이 `✅`로 바뀌었는지 확인한다.
2. `결정 #4 — persistence 저장 범위(확정)` 섹션에서 저장 대상/비저장 대상 목록을 확인한다.

#### 문제점 / 리스크

1. 저장 범위가 넓어져 localStorage schema 관리가 중요해졌다.
   - 완화 방안 1: version 필드 유지
   - 완화 방안 2: parse 실패 시 fallback reset
2. 검색어/컬럼 상태 복원이 과도하게 느껴질 수 있다.
   - 완화 방안 1: 추후 reset workspace 기능 제공
   - 완화 방안 2: 창별 초기화 버튼 추가 검토

#### 비고

- 이 변경은 사용자 확인을 plan에 반영한 문서 수정이다.

### Control Window Settings + 탭 drag 재배치 구현

**작성 시각:** 2026-03-06 20:44 (local)

**상태:** 확인 대기

#### 수행 내용

1. News Feed title/summary 글자 크기 제어 위치를 News Feed 창 toolbar가 아니라 `Data Control` 창의 `Settings` 탭으로 옮기도록 구조를 수정했다.
2. `App.tsx`에 `newsTitleFontSize`, `newsSummaryFontSize` 상태를 추가하고 `terminal-workspace-v1` payload에 저장/복원되게 연결했다.
3. `DraggableWindow.tsx`를 통해 `DataControlWindow.tsx`와 `FinnhubNewsWindow.tsx`에 새 typography props를 전달하도록 배선했다.
4. `DataControlWindow.tsx`의 `Settings` 탭에 `Title Text`, `Summary Text` preset/slider UI를 추가했다.
5. `FinnhubNewsWindow.tsx`에서 잘못 들어가 있던 title/summary font control toolbar를 제거하고, App에서 내려주는 값만 렌더에 적용하게 정리했다.
6. `App.tsx`의 탭 바에 drag/drop 재정렬을 추가해 탭 순서를 직접 바꿀 수 있게 했다.
7. `figma_frontend_prompt.md`와 `plan.md`를 이번 구현 기준으로 동기화했다.

#### 생성/수정 파일

- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/App.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DraggableWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`
- `ai_agent_plan/terminal_ui_ver3_final/plan.md`
- `ai_agent_plan/terminal_ui_ver3_final/agent_log.md`

#### 검증 방법

1. `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm run build`를 실행한다.
2. `Data Control` 창의 `Settings` 탭에서 `Title Text`, `Summary Text` 값을 바꾸고 News Feed 본문/title 크기가 즉시 달라지는지 확인한다.
3. 앱을 새로고침한 뒤 마지막 title/summary 값이 유지되는지 확인한다.
4. 탭 2개 이상을 만든 뒤 탭을 드래그해서 순서를 바꾸고, 새로고침 후 순서가 유지되는지 확인한다.

#### 문제점 / 리스크

1. 기존 `terminal-workspace-v1`에 새 필드가 없는 구버전 payload가 남아 있을 수 있다.
   - 완화 방안 1: 기본값 `12/11`로 fallback
   - 완화 방안 2: 필요 시 localStorage reset으로 초기화
2. 탭 drag와 클릭이 같은 영역에 있어 브라우저/포인터 환경에 따라 오동작 가능성이 있다.
   - 완화 방안 1: drag 중 highlight 표시로 drop target을 명확히 함
   - 완화 방안 2: 필요 시 추후 drag handle 분리
3. News Feed 내부 localStorage와 workspace localStorage를 동시에 쓰면 설정 충돌 위험이 있다.
   - 완화 방안 1: title/summary 값은 News Feed localStorage 저장 대상에서 제거
   - 완화 방안 2: Control Window Settings를 단일 source로 유지