# News Window Keyword Exclude Filter Plan

### 목표

- Finnhub News window에 검색창과 별도로 동작하는 `키워드 제외 필터` 기능을 추가한다.
- 사용자는 이름이 있는 필터 프로필을 새로 만들고, 저장하고, 삭제하고, 현재 화면에 적용할 수 있어야 한다.
- 필터 식은 Google 웹검색처럼 공백 AND, `OR`, quoted phrase, 괄호 그룹을 지원하는 방향으로 고정한다.
- 예: `단어1 단어2` 또는 `(단어1) (단어2)`는 두 단어가 모두 들어간 row를 제외한다.
- 기존 서버 검색(`searchQuery`)은 그대로 두고, 별도 exclude 파이프라인을 프론트에 추가한다.
- 이번 plan은 구현 전 범위, UI 배치, 저장 구조, 검증 절차를 고정하는 문서다.

### 현재 레포 상태(중요, 확인됨)

- 직접 제어 지점은 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`다.
- 현재 검색창 값 `searchQuery`는 `fetchNews()`에서 backend `GET /api/news`의 `keyword` param으로만 전달된다.
- backend 응답으로 받은 `newsData`는 마지막 `groupedNews` `useMemo()`에서 정렬/날짜 그룹화만 거쳐 렌더링된다.
  - 즉, 별도 exclude filter는 `groupedNews` 직전의 client-side filter 한 곳에 넣는 것이 가장 작다.
- 현재 `Save` / `Load` UI는 존재하지만, 저장 대상은 `savedSearches` component state뿐이며 localStorage persistence가 없다.
- 현재 localStorage `finhub-news-ui-state`에는 아래 UI 상태만 저장된다.
  - `[][][]visibleCols[][][]`
  - `[][][]displayMode[][][]`
  - `[][][]newsProjection[][][]`
  - `[][][]sourceTypeFilter[][][]`
  - `[][][]searchQuery[][][]`
  - `[][][]tickerQuery[][][]`
  - `[][][]fromDate[][][]`, `[][][]toDate[][][]`
  - ownership filter min/max
  - `[][][]selectedBookmarkFolderId[][][]`
- 현재 뉴스 row 최종 표시 개수 영역은 toolbar 하단의 `items` counter와 리스트 본문으로 구성된다. exclude filter를 붙이면 이 표시도 함께 보정하는 편이 자연스럽다.
- 같은 폴더에 `FinnhubNewsWindow.md`는 없다. 구현 단계에서 same-base 문서 동기화 의무는 없다.
- 구현 이후 동기화 후보 문서는 아래 2개다.
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

### 제약 / 비범위

- 이번 범위는 `FinnhubNewsWindow`만 대상으로 한다. `InvestingNewsWindow`, legacy `NewsWindow`, backend API schema는 이번 1차 범위에서 바꾸지 않는다.
- 검색창(`searchQuery`) 동작은 유지한다. exclude filter는 검색과 별개다.
- 1차 버전은 frontend localStorage 기반 persistence만 사용한다. DB 저장, 사용자별 서버 저장은 하지 않는다.
- exclude 판단 대상은 row 메타 텍스트까지만 본다. full text 본문 전체를 읽어 제외하는 기능은 이번 범위가 아니다.
- query language 1차 범위는 `AND`, `OR`, quoted phrase, 괄호 그룹까지다. unary `NOT`, wildcard, regex, proximity search는 넣지 않는다.
- mock 데이터는 추가하지 않는다.

### 읽는 방법(비개발자/일반인 기준)

- `Step 0`은 사용자가 기대하는 검색식 규칙과 저장 방식을 확정하는 단계다.
- `Step 1`은 검색식을 해석하는 parser/helper를 만드는 단계다.
- `Step 2`는 프로필 저장/적용/삭제 UI와 localStorage state를 추가하는 단계다.
- `Step 3`은 실제 뉴스 row를 화면에서 제외하는 단계다.
- `Step 4`는 문서 동기화와 검증을 마무리하는 단계다.
- 현재 문서는 구현 전이므로 `Step 0`만 `⏳`, 나머지는 `⬜`로 둔다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전에 이 문서에서 문법, 저장 구조, UI 배치를 먼저 고정한다.
- 각 Step은 `구현 -> 검증 -> 사용자 확인` 순서로 진행한다.
- 사용자가 현재 Step 결과를 명시적으로 확인하기 전에는 다음 Step으로 진행하지 않는다.
- 요구사항이 바뀌면 기존 항목을 지우지 않고 `PLAN CHANGE` 메모를 추가한다.
- user confirmation 전에는 어떤 Step도 `✅`로 바꾸지 않는다.

### 아키텍처(상위)

#### 데이터 흐름

1. 검색창 / source filter / date filter / ticker filter가 backend fetch 조건을 만든다.
2. backend `GET /api/news`가 `newsData`를 반환한다.
3. 새 exclude keyword profile이 있으면 client-side에서 row 텍스트를 평가한다.
4. 식이 `true`인 row는 화면에서 제외한다.
5. 제외 후 남은 row만 sort / group / virtual list로 렌더링한다.

#### 저장 구조(제안)

- localStorage key: `[][][]finnhub-news-keyword-filters-v1[][][]`
- payload 예시:

```json
{
  "activeProfileId": "kf_1713760000000",
  "profiles": [
    {
      "id": "kf_1713760000000",
      "name": "offering 제외",
      "query": "(offering OR dilution) biotech",
      "updatedAt": "2026-04-22T05:28:00"
    }
  ]
}
```

- 기존 `finhub-news-ui-state`와 분리해 저장하는 이유:
  - 프로필 목록은 UI state보다 수명이 길다.
  - 기존 key migration 위험을 줄일 수 있다.
  - 기존 saved search와 역할이 다르다.

#### UI 배치(제안)

- toolbar에 기존 `Save` / `Load` 옆 또는 `Filter` 근처에 새 버튼 `Keyword Filter`를 둔다.
- 버튼을 누르면 dropdown 또는 popover 안에서 아래 작업이 가능해야 한다.
  - 현재 active profile 확인
  - `Apply` / `Clear`
  - `New Filter`
  - saved profile list
  - 각 profile의 `Delete`
- 새 필터 생성/수정은 작은 modal로 처리한다.
  - `Filter Name`
  - `Exclude Query`
  - 예시 도움말: `offering biotech`, `offering OR shelf`, `("public offering" OR dilution) biotech`

#### Glossary

- `keyword filter profile`
  - 이름 + query expression + active 여부를 가진 저장 단위.
- `query expression`
  - row를 제외할지 판단하는 검색식 문자열.
- `match text`
  - query evaluation에 쓰는 row의 합성 텍스트.
  - 1차 제안: `title`, `summary`, `source_name`, `source_type`, `publisher`, `ticker`, `url`을 lower-case로 합친 문자열.
- `active profile`
  - 현재 화면에 실제로 적용되는 프로필. 1차 계획은 한 번에 1개만 active 허용.

#### 검색식 운영 규칙(1차 제안)

- 기본 비교는 case-insensitive substring match다.
- quoted phrase는 공백을 포함한 하나의 토큰으로 취급한다.
- 공백으로 나열된 토큰은 implicit `AND`다.
- `OR`는 대문자/소문자 구분 없이 disjunction으로 취급한다.
- 괄호는 grouping에 사용한다.
- bare single-term 괄호는 의미를 바꾸지 않는다.

예시:

```text
offering biotech
=> offering AND biotech
=> 두 단어가 모두 들어간 row 제외

offering OR shelf
=> offering 또는 shelf 가 들어간 row 제외

("public offering" OR dilution) biotech
=> ("public offering" OR dilution) AND biotech
=> biotech가 있고, 동시에 public offering 또는 dilution이 있는 row 제외

(단어1) (단어2)
=> 단어1 AND 단어2
=> 두 단어가 모두 있는 row 제외
```

경계 규칙:

- 빈 query 또는 공백만 있는 query는 어떤 row도 제외하지 않는다.
- parse 실패 시 조용히 무시하지 않는다. UI에 validation error를 보여주고 `Save` / `Apply`를 막는다.
- `OR` 양쪽 피연산자가 비어 있거나 괄호 짝이 안 맞으면 invalid query로 처리한다.

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 제안 | 이유 |
|---------|------|-------------|------|
| D1 | 대상 window | `FinnhubNewsWindow` only | 요청의 직접 앵커가 여기 있고 변경 범위를 최소화할 수 있다. |
| D2 | 저장 위치 | localStorage 전용 | backend schema/API를 바꾸지 않고 즉시 쓸 수 있다. |
| D3 | active profile 수 | 한 번에 1개 | UI와 상태 관리가 단순해지고, “현재 적용” 의미가 분명하다. |
| D4 | match text 범위 | title + summary + source/publisher + ticker + url | 사용자가 보는 row 정보 범위 안에서 충분하고 full text보다 가볍다. |
| D5 | 검색식 문법 | 공백 AND, `OR`, quoted phrase, 괄호 | 사용자 요구인 “구글 키워드 웹서치처럼”을 최소 구현으로 충족한다. |
| D6 | invalid query 처리 | 저장/적용 차단 + 에러 표시 | 조용한 오동작보다 명시적 실패가 낫다. |
| D7 | 저장 프로필 내용 | 이름 + query만 저장 | source/date/search와 독립된 별도 기능이라는 요구에 맞다. |
| D8 | row counter 표시 | `visible / fetched` 형태 추가 검토 | 제외 필터가 켜졌을 때 현재 화면에 몇 개 남았는지 보여주는 편이 자연스럽다. |

### 계획 중간 필수 확인

- `searchQuery` 서버 검색과 exclude query client filter가 서로 섞이지 않도록 state를 분리해야 한다.
- 기존 `Save` / `Load` saved search와 새 keyword filter profile이 이름상 혼동될 수 있으므로, 라벨을 분명히 나눠야 한다.
- parser를 컴포넌트 안에 직접 넣으면 `FinnhubNewsWindow.tsx`가 더 커진다. helper 분리를 우선 검토해야 한다.
- localStorage 불러오기 실패나 legacy payload shape이 있을 때 crash 없이 기본값으로 복구해야 한다.
- active profile이 삭제될 때는 `activeProfileId`를 즉시 비우고 리스트를 다시 계산해야 한다.
- virtual list 이전 단계에서 제외하지 않으면 counter, sticky date, load-more 동작이 어긋날 수 있다.
- page append(`fetchMore`) 후에도 active profile이 자동 재적용되어야 한다.
- invalid query를 `Apply`까지 허용하면 “아무것도 안 보임” 또는 “전혀 안 걸러짐” 같은 설명 어려운 상태가 생긴다.

### 제안하는 구현 순서(이유)

1. query parser/helper를 먼저 만든다.
   - 문법과 evaluation이 흔들리면 UI보다 먼저 테스트 기준이 무너진다.
2. localStorage shape와 active profile state를 붙인다.
   - 새로고침 후에도 같은 필터가 유지되게 해야 “저장” 요구를 충족한다.
3. profile 생성/적용/삭제 UI를 추가한다.
   - 사용자가 실제로 조작할 진입점이 먼저 보여야 한다.
4. `groupedNews` 직전 exclude filter를 적용한다.
   - 현재 렌더 파이프라인에서 가장 작은 루트 수정이다.
5. counter/help text/doc를 정리하고 빌드/브라우저 검증을 한다.
   - 사용자가 기능을 오해하지 않도록 마지막에 문구를 맞춘다.

### 단계별 계획(각 단계: 구현 -> 검증)

#### ⏳ Step 0 — 요구사항/문법/저장전략 고정

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 0-1 | 직접 제어 지점을 `FinnhubNewsWindow.tsx`로 고정 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 현재 검색/fetch/groupedNews 경로 확인 | ⏳ |
| 0-2 | 검색식 규칙을 공백 AND / `OR` / quoted phrase / 괄호로 정의 | `ai_agent_plan/news_keyword_filter/plan.md` | 예시 식 3개가 사람이 읽어도 해석 가능 | ⏳ |
| 0-3 | 저장 구조를 localStorage profile list + activeProfileId로 고정 | `ai_agent_plan/news_keyword_filter/plan.md` | payload 예시가 요구사항과 일치 | ⏳ |

- `0-1` 목적: 구현 범위를 한 창으로 묶어 불필요한 파급을 막는다.
  설명: 서버 검색과 최종 렌더 사이의 client-side filter insertion point를 확인하면 이후 변경이 작아진다.
  완료 조건(눈으로 확인): 문서에 `FinnhubNewsWindow.tsx`, `fetchNews`, `groupedNews`가 함께 적혀 있다.
  사람 검증(비개발자): plan 문서를 열어 “어느 창을 고치는지”가 한 줄로 이해된다.
  흔한 문제/주의: legacy `NewsWindow`와 혼동하면 구현이 두 군데로 퍼진다.
- `0-2` 목적: 사용자가 입력한 검색식을 어떤 논리로 해석할지 먼저 고정한다.
  설명: `OR`와 공백 AND 규칙을 먼저 정하지 않으면 나중에 저장된 필터가 다른 의미로 바뀔 수 있다.
  완료 조건(눈으로 확인): `offering biotech`, `offering OR shelf`, `(단어1) (단어2)` 예시가 모두 문서에 있다.
  사람 검증(비개발자): 예시를 보고 “어떤 row가 제외되는지”를 말로 설명할 수 있다.
  흔한 문제/주의: 괄호를 literal 문자로 처리하면 사용자 예시가 깨진다.
- `0-3` 목적: 저장과 현재 적용 상태를 분리해 관리한다.
  설명: 프로필 목록과 active selection을 한 payload에 두되 기존 UI state key와는 분리한다.
  완료 조건(눈으로 확인): localStorage key 이름과 payload example이 plan에 있다.
  사람 검증(비개발자): 새로고침 후에도 마지막 active filter가 유지되는 그림을 이해할 수 있다.
  흔한 문제/주의: 기존 `Save/Load` search state와 섞어 저장하면 기능 의미가 흐려진다.

검증 훅:

```text
1. plan.md에서 `searchQuery`, `groupedNews`, `finnhub-news-keyword-filters-v1`가 모두 보이는지 확인
2. 예시 식 `offering biotech` / `offering OR shelf` / `(단어1) (단어2)`가 모두 포함됐는지 확인
3. 사용자 확인 필요: 예
```

#### ⬜ Step 1 — 검색식 parser/helper 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | query tokenizer/parser/evaluator helper를 새 파일로 분리 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/newsKeywordFilter.ts` | invalid/valid 예시 식을 함수 수준에서 점검 | ⬜ |
| 1-2 | row를 평가할 `buildNewsKeywordMatchText()` helper를 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/newsKeywordFilter.ts` | 샘플 row 2개로 예상 match 여부 비교 | ⬜ |
| 1-3 | parse error message shape를 UI에서 재사용 가능하게 고정 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/newsKeywordFilter.ts` | invalid query 입력 시 message 존재 확인 | ⬜ |

- `1-1` 목적: 복잡한 boolean 문법을 컴포넌트 밖으로 분리한다.
  설명: `AND/OR/괄호/phrase` 지원은 별도 helper가 아니면 컴포넌트 가독성이 급격히 나빠진다.
  완료 조건(눈으로 확인): helper 파일에 parse/evaluate entry 함수가 분리돼 있다.
  사람 검증(비개발자): 개발자가 제공한 예시 문자열이 “적용 가능/오류”로 나뉘어 설명된다.
  흔한 문제/주의: implicit AND 우선순위와 `OR` 묶음이 뒤집히지 않게 해야 한다.
- `1-2` 목적: 무엇을 대상으로 매치하는지 일관성을 만든다.
  설명: title만 볼지 summary까지 볼지 파일마다 다르면 saved filter 의미가 달라진다.
  완료 조건(눈으로 확인): match text에 포함하는 필드 목록이 코드에 한 군데로 모여 있다.
  사람 검증(비개발자): “제목/요약/티커 등에 단어가 있으면 제외된다”를 설명할 수 있다.
  흔한 문제/주의: `null` 필드 결합 시 `undefined` 문자열이 끼지 않게 해야 한다.
- `1-3` 목적: query validation 실패를 사용자에게 설명 가능하게 한다.
  설명: 괄호 mismatch, 빈 `OR` 같은 오류는 저장/적용 전에 막아야 한다.
  완료 조건(눈으로 확인): invalid query가 human-readable error로 바뀐다.
  사람 검증(비개발자): 잘못된 식을 넣으면 Save 대신 오류 문구를 본다.
  흔한 문제/주의: parse 실패를 silent fallback으로 두면 “필터가 안 먹는다”는 상태가 된다.

검증 훅:

```text
1. get_errors termina_web/.../src/app/newsKeywordFilter.ts
2. npm.cmd run build   (cwd: termina_web/figma_code/terminal_ui_ver2_finhub)
3. 예시 식 수동 점검:
   - offering biotech => valid
   - offering OR shelf => valid
   - (offering OR => invalid
4. 사용자 확인 필요: 예
```

#### ⬜ Step 2 — profile 저장/적용/삭제 UI 및 persistence 추가

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | profile type/state/localStorage load/save 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 새로고침 후 active profile 유지 확인 | ⬜ |
| 2-2 | `Keyword Filter` toolbar 버튼과 dropdown/panel 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 버튼/목록/active 표식 렌더링 확인 | ⬜ |
| 2-3 | `New Filter` modal에 name/query 입력과 validation 연결 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | invalid query 저장 차단 확인 | ⬜ |
| 2-4 | saved profile apply/delete/clear 흐름 구현 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | apply 후 active badge, delete 후 목록 갱신 확인 | ⬜ |

- `2-1` 목적: 저장된 필터가 세션을 넘어 살아남게 한다.
  설명: localStorage에서 profile list와 activeProfileId를 읽고 쓸 수 있어야 “저장” 요구를 충족한다.
  완료 조건(눈으로 확인): 페이지 새로고침 후 마지막 active profile이 남아 있다.
  사람 검증(비개발자): 필터를 저장하고 새로고침해도 같은 필터가 선택된 상태다.
  흔한 문제/주의: invalid legacy JSON 때문에 첫 렌더가 깨지지 않게 해야 한다.
- `2-2` 목적: 검색창과 분리된 전용 진입점을 만든다.
  설명: 사용자가 search query와 exclude query를 혼동하지 않도록 별도 버튼/패널을 둔다.
  완료 조건(눈으로 확인): toolbar에 `Keyword Filter` 버튼이 있고 active 상태가 보인다.
  사람 검증(비개발자): 검색창을 건드리지 않고 필터 관련 작업만 할 수 있다.
  흔한 문제/주의: 기존 `Filter` 메뉴와 겹쳐 어떤 기능인지 모호해지지 않게 해야 한다.
- `2-3` 목적: 새 필터 생성 UX를 단순화한다.
  설명: 이름과 query를 같이 저장해야 나중에 불러왔을 때 무슨 필터인지 알 수 있다.
  완료 조건(눈으로 확인): modal에 `name`, `query`, 오류 문구, save 버튼이 있다.
  사람 검증(비개발자): 예시 query를 붙여넣고 이름을 붙여 저장할 수 있다.
  흔한 문제/주의: query가 비어 있거나 이름만 중복될 때 처리 규칙이 필요하다.
- `2-4` 목적: 저장 후 즉시 적용과 정리를 가능하게 한다.
  설명: `Apply`, `Clear`, `Delete`가 모두 없으면 사용 흐름이 끊긴다.
  완료 조건(눈으로 확인): 저장한 항목을 눌러 active로 만들고 삭제할 수 있다.
  사람 검증(비개발자): 프로필 하나를 적용한 뒤 지우면 active 상태도 같이 해제된다.
  흔한 문제/주의: active profile 삭제 후 stale filter가 남지 않게 해야 한다.

검증 훅:

```text
1. get_errors termina_web/.../src/app/components/FinnhubNewsWindow.tsx
2. npm.cmd run build   (cwd: termina_web/figma_code/terminal_ui_ver2_finhub)
3. 브라우저 수동 확인:
   - News window 열기
   - Keyword Filter 버튼 보이는지 확인
   - 이름 + query 저장 후 새로고침
   - active profile이 남아 있는지 확인
4. 사용자 확인 필요: 예
```

#### ⬜ Step 3 — client-side exclude filter 적용

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | active profile query를 parse/evaluate해 `newsData`에 적용 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 샘플 query 적용 시 row 감소 확인 | ⬜ |
| 3-2 | `groupedNews` 계산을 exclude 후 데이터 기준으로 재구성 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | sticky header / load-more / sort 정상 확인 | ⬜ |
| 3-3 | item counter와 active filter summary 문구 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | `visible / fetched` 또는 active query 표시 확인 | ⬜ |

- `3-1` 목적: 실제로 row를 제외하는 본체를 붙인다.
  설명: backend fetch는 유지하고 현재 가져온 data에만 exclude를 적용한다.
  완료 조건(눈으로 확인): active query가 있을 때 일부 row가 사라진다.
  사람 검증(비개발자): `offering biotech` 프로필을 적용하면 두 단어가 있는 기사만 빠진다.
  흔한 문제/주의: `OR`가 `AND`처럼 동작하거나 반대로 되는 precedence 버그를 주의해야 한다.
- `3-2` 목적: 리스트 부가 기능을 exclude 결과와 맞춘다.
  설명: sort/group/sticky date/load-more가 모두 filtered set을 기준으로 움직여야 한다.
  완료 조건(눈으로 확인): 날짜 헤더가 비어 있지 않고 스크롤이 정상이다.
  사람 검증(비개발자): 필터 적용 후에도 리스트가 깨지지 않고 스크롤된다.
  흔한 문제/주의: header만 남거나 load-more sentinel 위치가 어긋날 수 있다.
- `3-3` 목적: 현재 무엇이 적용됐는지 화면에서 바로 알 수 있게 한다.
  설명: “왜 row가 줄었는지”를 모르면 오동작처럼 보인다.
  완료 조건(눈으로 확인): active profile 이름과 남은 item 수가 보인다.
  사람 검증(비개발자): 필터 해제 시 row 수가 원래대로 돌아온다.
  흔한 문제/주의: counter가 fetched total과 visible total 중 무엇인지 불명확하면 혼동된다.

검증 훅:

```text
1. get_errors termina_web/.../src/app/components/FinnhubNewsWindow.tsx
2. npm.cmd run build   (cwd: termina_web/figma_code/terminal_ui_ver2_finhub)
3. 브라우저 수동 확인:
   - query: offering biotech
   - query: offering OR shelf
   - query: ("public offering" OR dilution) biotech
   - 각 경우 row count와 제외 대상이 기대와 맞는지 확인
4. 사용자 확인 필요: 예
```

#### ⬜ Step 4 — 문서 동기화 및 최종 검증

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | 기능 설명과 사용 예시를 프론트 문서에 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서에 `Keyword Filter` 검색 가능 | ⬜ |
| 4-2 | 필요 시 backend prompt에도 “서버 검색과 별도 client exclude filter”를 반영 | `terminal/backend_prompt.md` | 문서에 역할 분리가 명시됨 | ⬜ |
| 4-3 | 정적 분석/빌드/런타임 통합 검증을 완료하고 log 기록 | `ai_agent_plan/news_keyword_filter/agent_log.md` | 검증 표 4계층 채움 | ⬜ |

- `4-1` 목적: 사용자가 query 문법을 UI 밖에서도 참고할 수 있게 한다.
  설명: 특히 공백 AND와 `OR` 규칙은 문서에 남겨야 재현 가능하다.
  완료 조건(눈으로 확인): 문서에 예시 query와 저장/적용/삭제 흐름이 있다.
  사람 검증(비개발자): 문서만 보고도 버튼 위치와 입력 예시를 따라갈 수 있다.
  흔한 문제/주의: UI 문구와 문서 문구가 어긋나면 사용자가 혼란스럽다.
- `4-2` 목적: backend 검색과 client exclude 역할을 구분해 오해를 줄인다.
  설명: search query는 서버, keyword exclude는 프론트라는 점을 명시한다.
  완료 조건(눈으로 확인): 문서에서 두 기능이 별도라고 읽힌다.
  사람 검증(비개발자): “검색”과 “제외 필터”를 다른 기능으로 이해할 수 있다.
  흔한 문제/주의: 둘을 같은 저장 기능처럼 설명하면 안 된다.
- `4-3` 목적: 구현 완료를 재현 가능하게 검증한다.
  설명: 정적 분석, 빌드, 브라우저 수동 확인 결과를 agent log에 남긴다.
  완료 조건(눈으로 확인): agent_log에 4계층 검증 표가 있다.
  사람 검증(비개발자): 제시된 클릭 절차대로 직접 다시 확인할 수 있다.
  흔한 문제/주의: 브라우저 확인 없이 build만 통과했다고 끝내면 UI 회귀를 놓칠 수 있다.

검증 훅:

```text
1. get_errors modified files
2. npm.cmd run build   (cwd: termina_web/figma_code/terminal_ui_ver2_finhub)
3. 브라우저 수동 확인:
   - profile 저장/적용/삭제
   - 새로고침 후 active profile 유지
   - `AND` / `OR` / phrase / 괄호 query 동작
4. 사용자 확인 필요: 예
```

### 미확정 사항(명시 결정 필요)

| ID | 내용 | 선택지 | 차단 대상 Step |
|----|------|--------|----------------|
| U1 | match text에 `url`까지 포함할지 | A. 포함 / B. 제외 | Step 1, Step 3 |
| U2 | counter 표시 형식 | A. `visible / fetched` / B. `visible items`만 / C. active profile 이름만 표시 | Step 3 |
| U3 | profile 수정 기능 포함 여부 | A. 1차는 생성+삭제만 / B. 수정까지 포함 | Step 2 |

- 권장안:
  - `U1`: A. 포함. source/publisher 도메인 기반 제외에 도움이 된다.
  - `U2`: A. `visible / fetched`. 필터 효과가 가장 잘 드러난다.
  - `U3`: A. 1차는 생성+삭제만. 요청 필수 범위를 먼저 닫고, 수정은 follow-up으로 둔다.

### 실행 의존성 그래프

Legend

- `✅` 구현 + 사용자 확인 완료
- `⏳` 구현/정의 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족

```text
Track A — 프론트 설계/구현

⏳ Step 0 요구사항/문법/저장전략 고정
  ⏳ 0-1 FinnhubNewsWindow 앵커 고정
  ⏳ 0-2 query 문법 정의
  ⏳ 0-3 localStorage 구조 정의

⬜ Step 1 parser/helper 추가
  ⬜ 1-1 tokenizer/parser/evaluator helper
  ⬜ 1-2 match text builder
  ⬜ 1-3 parse error shape

⬜ Step 2 profile UI/persistence
  ⬜ 2-1 localStorage load/save
  ⬜ 2-2 Keyword Filter 버튼/패널
  ⬜ 2-3 New Filter modal
  ⬜ 2-4 apply/delete/clear

⬜ Step 3 exclude 적용
  ⬜ 3-1 active profile evaluation
  ⬜ 3-2 groupedNews 재구성
  ⬜ 3-3 counter/summary 문구

Track B — 문서/검증

🚫 Step 4 문서 동기화 및 최종 검증
  🚫 4-1 figma_frontend_prompt.md 동기화
  🚫 4-2 backend_prompt.md 역할 분리 반영
  🚫 4-3 agent_log 검증 표 작성

[BLOCKED: Track B는 Track A의 실제 UI 문구와 localStorage key가 확정된 뒤 시작]
```

### 병렬 트랙 요약

- Track A는 실제 기능 구현 경로다. `Step 1 -> Step 2 -> Step 3` 순차 진행이 가장 안전하다.
- Track B는 문서/검증 경로다. UI 라벨과 동작이 확정된 뒤에만 시작할 수 있다.
- 현재는 `Step 0` 사용자 확인이 선행돼야 Track A 구현으로 넘어갈 수 있다.

### 차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| Step 0 사용자 확인 | Step 1 전체 | 진행 / 수정 후 재계획 |
| U1 match text 범위 | Step 1, Step 3 | url 포함 / 제외 |
| U2 counter 표시 | Step 3 | `visible / fetched` / 단순 visible |
| U3 profile 수정 범위 | Step 2 | 생성+삭제만 / 수정 포함 |

### 결정 #1 — 검색식 파서 범위(상세)

- 권장안: `공백 AND`, `OR`, quoted phrase, 괄호 그룹만 지원한다.
- 이유:
  - 사용자 요구인 “구글 키워드 웹서치처럼”을 충족한다.
  - `NOT`, wildcard, regex까지 넣으면 parser/UI validation 복잡도가 과도하게 올라간다.
  - exclude filter 자체가 이미 부정 의미를 가지므로 unary `NOT`은 1차 가치가 낮다.

### 결정 #2 — 저장 단위(상세)

- 권장안: profile은 `name + query + updatedAt`만 저장한다.
- 저장하지 않는 것:
  - searchQuery
  - sourceTypeFilter
  - from/to date
  - watchlist
- 이유:
  - 사용자가 “검색창과는 별도”라고 명시했다.
  - saved search와 keyword filter profile의 역할을 분리할 수 있다.

### 결정 #3 — exclude 대상 텍스트 범위(상세)

- 권장안: 아래 필드를 공백으로 이어 붙여 lower-case match text를 만든다.
  - title
  - summary
  - source name
  - source type
  - publisher
  - ticker / ohlc ticker
  - url
- 제외하는 것:
  - full text 본문 전체
  - change/hv/zscore 등 계산 숫자 컬럼
- 이유:
  - 현재 row 메타 정보 수준에서 사용자가 기대하는 키워드 제외 대부분을 처리할 수 있다.
  - full text까지 포함하면 fetch하지 않은 row와의 의미 차이가 커진다.