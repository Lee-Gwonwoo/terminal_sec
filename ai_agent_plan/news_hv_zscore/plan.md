### 목표

- Finnhub News window에 `HV` 버튼과 `Z Score` 버튼을 추가하는 구현 계획을 고정한다.
- 기존 `Changes %` 묶음 컬럼은 유지하고, 별도의 묶음 컬럼 `HV`, `Z Score`를 추가하는 방향을 확정한다.
- 현재 표시 중인 각 change metric(`Chg`, `fr.O→C`, `fr.O→H`, `+1D`, `+3D`, `+7D`, `+14D`, `+30D`)에 대응하는 변동성 값과 z-score를 계산한다.
- 새 컬럼은 `Columns` 메뉴와 quick toggle 버튼 양쪽에서 켜고 끌 수 있게 한다.
- 최근/커스텀 change update 흐름이 기존 change%뿐 아니라 HV/Z-score도 함께 계산하도록 확장한다.
- 이번 단계에서는 구현하지 않고, 설계/범위/검증 계획만 문서화한다.

### 현재 레포 상태(중요, 확인됨)

- 프론트 News window는 `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` 한 파일 안에서 컬럼 정의, toolbar 버튼, column visibility, render cell, sorting을 함께 관리한다.
- 현재 컬럼 정의에는 `changes` 하나만 있고, 이 한 컬럼 셀 안에서 아래 8개 값을 3줄로 묶어 렌더링한다.
  - `Chg`
  - `fr.O→C`
  - `fr.O→H`
  - `+1D`
  - `+3D`
  - `+7D`
  - `+14D`
  - `+30D`
- 현재 `changes` 정렬 기준은 `changeFromOpenPct` 하나로 고정돼 있다. 즉 묶음 컬럼의 모든 하위 값을 각각 정렬하지 않고, 대표값 1개를 사용한다.
- News window의 column visibility는 localStorage key `finhub-news-ui-state`의 `visibleCols` 배열에 저장된다. 새 컬럼 ID를 추가하면 기존 저장값과의 호환 처리가 필요하다.
- backend `GET /api/news`는 `terminal/backend/src/services/newsRepository.ts`에서 `news_change_metrics`를 `metric_key`별로 8번 LEFT JOIN 해서 반환한다.
- 현재 backend response/type에는 HV/Z-score 필드가 없다.
  - `terminal/backend/src/types.ts`의 `NewsItem`
  - `FinnhubNewsWindow.tsx`의 `BackendNewsItem`, `DisplayItem`
- `terminal/backend/src/db.ts` 기준 `news_change_metrics`는 아래 구조다.
  - PK: `(news_id, metric_key)`
  - value column: `[][][]value_pct[][][]`
  - 날짜 정보: `[][][]reference_date[][][]`, `[][][]target_date[][][]`, `[][][]forward_trading_days[][][]`
- `terminal/backend/src/services/newsChangeMerger.ts`는 현재 8개 standard metric만 계산/UPSERT 하도록 고정돼 있다.
  - `change_pct`
  - `change_from_open_pct`
  - `change_open_to_high_pct`
  - `change_1d_pct`
  - `change_3d_pct`
  - `change_7d_pct`
  - `change_14d_pct`
  - `change_30d_pct`
- 기존 recent/custom change update route가 이미 있으므로, HV/Z-score는 별도 계산 버튼보다 기존 change update 확장으로 넣는 편이 자연스럽다.
- 가격 원본은 `OHLC_data/ohlc_1d_watchlist.sqlite`의 `ohlc_1d`다. `Open`, `High`, `Close`, `Volume`이 있으므로 close-to-close와 intraday 계열의 역사적 분포를 계산할 수 있다.
- 구현 시 문서 동기화 대상은 아래 2개다.
  - `terminal/backend_prompt.md`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md`

### 제약 / 비범위

- 이번 작업은 **plan 문서 작성만** 한다. 코드 수정, 빌드, 테스트, dev server 검증은 하지 않는다.
- 옵션 IV 대비 기대변동 비교는 이번 범위가 아니다. 이번 범위는 OHLC 기반 historical volatility와 z-score다.
- annualized HV 컬럼은 이번 범위가 아니다. 이번 UI는 “실제 change와 직접 비교 가능한 비연율화 horizon sigma”를 다룬다.
- 새 별도 window를 만들지 않는다. 대상은 기존 Finnhub News window다.
- mock 데이터는 추가하지 않는다.
- `news_change_metrics.value_pct` 컬럼명 자체를 리네임하는 DB migration은 이번 범위가 아니다.
- 새로운 analytics framework를 전면 도입하지 않는다. 기존 change update 파이프라인을 확장하는 최소 구조를 우선한다.

### 읽는 방법(비개발자/일반인 기준)

- `Step 0`은 “무엇을 HV/Z-score로 볼지”를 수식과 UI 기준으로 확정하는 단계다.
- `Step 1`은 backend에서 HV/Z-score를 어떤 방식으로 계산하고 어디에 저장할지 정하는 단계다.
- `Step 2`는 `GET /api/news` 응답에 새 숫자를 싣는 단계다.
- `Step 3`은 News window에서 버튼과 컬럼을 추가하는 단계다.
- `Step 4`는 기존 change update 작업이 새 metric도 함께 채우도록 연결하는 단계다.
- `Step 5`는 문서 동기화와 최종 검증 계획을 정리하는 단계다.
- 맨 아래 `미확정 사항`에는 아직 사용자가 선택해야 하는 항목만 모아뒀다.

### 프로세스 템플릿(plan 변경 + 단계 완료 확인)

- 구현 전에는 이 문서에서 수식, 저장 위치, 버튼 의미를 먼저 고정한다.
- 각 Step은 `구현 → 검증 → 사용자 확인` 순서로 진행한다.
- 현재는 구현 전이므로 Step 0만 사전 감사 완료 상태(`⏳`), 나머지는 미착수(`⬜`)로 둔다.
- 이후 범위가 바뀌면 기존 내용을 지우지 않고 `PLAN CHANGE` 섹션을 추가한다.
- user confirmation 전에는 어떤 Step도 `✅`로 바꾸지 않는다.

### 아키텍처(상위)

- 데이터 원본
  - 뉴스 row: `terminal/backend/backend/data/app.db` → `news_items`
  - 뉴스 change metric: `terminal/backend/backend/data/app.db` → `news_change_metrics`
  - 가격 history: `OHLC_data/ohlc_1d_watchlist.sqlite` → `ohlc_1d`
- 계산 개요
  1. 기존과 동일하게 news row별 base change metric을 계산한다.
  2. 같은 ticker의 과거 OHLC row를 더 많이 읽어, 각 metric에 대응하는 historical sample series를 만든다.
  3. 각 series의 최근 `60`개 완결 sample 표준편차를 계산해 HV로 저장한다.
  4. `zscore = actual_change / matching_hv` 로 저장한다.
  5. `GET /api/news`가 base change + HV + z-score를 함께 반환한다.
  6. Finnhub News window는 `Changes %`, `HV`, `Z Score` 세 묶음 컬럼을 독립적으로 토글한다.

#### Glossary

- `lookback sample count`
  - HV를 추정할 때 사용하는 과거 완결 sample 개수.
  - 사용자 결정값: `60`.
- `matching historical series`
  - 현재 보여주는 change metric과 **정의가 같은 과거 수익률 시퀀스**.
  - 단순히 `daily sigma × sqrt(h)`로 환산하지 않고, metric 자체 정의를 그대로 과거에 적용한 시리즈를 쓴다.
- `HV`
  - 이번 plan에서의 HV는 annualized volatility가 아니라, **현재 change와 직접 나눌 수 있는 비연율화 sigma(%)** 다.
  - UI 라벨은 사용자 요청대로 `HV`를 쓰되, 문서에는 “비연율화 sigma”라고 명확히 적는다.
- `Z Score`
  - `actual_change_pct / matching_hv_pct`
  - unitless 값이며, 절대값이 클수록 평소 변동성 대비 더 큰 움직임이다.
- `완결 sample`
  - 현재 뉴스 시점보다 미래 데이터를 참조하지 않는 historical sample.
  - 예를 들어 `+30D`용 sample은 sample anchor 이후 22 trading day가 모두 현재 anchor 이전에 끝나야 한다.

#### 핵심 수식(운영적 정의)

아래에서 `A`는 현재 뉴스의 anchor trading day, `N`은 lookback sample count다.

- 현재 표시값 정의

```text
Chg                = (Close[A] / Close[A-1] - 1) * 100
fr.O→C             = (Close[A] / Open[A] - 1) * 100
fr.O→H             = (High[A] / Open[A] - 1) * 100
+1D                = (Close[A+1] / Close[A-1] - 1) * 100
+3D                = (Close[A+3] / Close[A-1] - 1) * 100
+7D                = (Close[A+5] / Close[A-1] - 1) * 100
+14D               = (Close[A+10] / Close[A-1] - 1) * 100
+30D               = (Close[A+22] / Close[A-1] - 1) * 100
```

- 대응 historical series 정의

```text
hist_chg(t)        = (Close[t] / Close[t-1] - 1) * 100
hist_oc(t)         = (Close[t] / Open[t] - 1) * 100
hist_oh(t)         = (High[t] / Open[t] - 1) * 100
hist_1d(t)         = (Close[t+1] / Close[t-1] - 1) * 100
hist_3d(t)         = (Close[t+3] / Close[t-1] - 1) * 100
hist_7d(t)         = (Close[t+5] / Close[t-1] - 1) * 100
hist_14d(t)        = (Close[t+10] / Close[t-1] - 1) * 100
hist_30d(t)        = (Close[t+22] / Close[t-1] - 1) * 100
```

- HV / Z-score 정의

```text
hv_metric_pct      = std(last 60 completed samples of matching historical series)
zscore_metric      = actual_metric_pct / hv_metric_pct
```

#### 중요한 경계 규칙

- `+7D`, `+14D`, `+30D`는 UI label 기준이고, 실제 trading-day forward는 각각 `5`, `10`, `22`다. 현재 코드도 이 기준을 사용한다.
- HV 계산은 **look-ahead bias**가 없어야 하므로, 현재 뉴스 anchor 이후 데이터가 필요한 historical sample은 제외한다.
- history가 부족하면 해당 HV/Z-score는 `null`로 남긴다. 억지로 `0` 또는 fallback 상수를 넣지 않는다.
- `hv_metric_pct = 0` 이거나 `null`이면 `zscore_metric`도 `null`로 둔다.

#### 계획상 신규 API 응답 필드

`GET /api/news`와 `GET /api/news/:id`는 아래 필드를 추가하는 방향으로 계획한다.

- HV fields
  - `[][][]hv_change_pct[][][]`
  - `[][][]hv_change_from_open_pct[][][]`
  - `[][][]hv_change_open_to_high_pct[][][]`
  - `[][][]hv_change_1d_pct[][][]`
  - `[][][]hv_change_3d_pct[][][]`
  - `[][][]hv_change_7d_pct[][][]`
  - `[][][]hv_change_14d_pct[][][]`
  - `[][][]hv_change_30d_pct[][][]`
- Z-score fields
  - `[][][]zscore_change_pct[][][]`
  - `[][][]zscore_change_from_open_pct[][][]`
  - `[][][]zscore_change_open_to_high_pct[][][]`
  - `[][][]zscore_change_1d_pct[][][]`
  - `[][][]zscore_change_3d_pct[][][]`
  - `[][][]zscore_change_7d_pct[][][]`
  - `[][][]zscore_change_14d_pct[][][]`
  - `[][][]zscore_change_30d_pct[][][]`

### 결정/선행조건(초기에 확정 필요)

| 결정 ID | 내용 | 기본값 제안 | 이유 |
|---------|------|-------------|------|
| D1 | HV lookback sample count | 60 completed samples | 사용자 결정 사항으로 고정한다. |
| D2 | 변동성 정의 방식 | metric별 matching historical series | intraday metric과 event-day-inclusive forward metric이 섞여 있어 `σ√h`보다 정의 일치성이 높다. |
| D3 | 저장 위치 | 기존 `news_change_metrics` 재사용 + 새 `metric_key` prefix | 최근/custom update, `/api/news` join 구조를 최소 수정으로 확장할 수 있다. |
| D4 | UI 컬럼 구조 | 묶음 컬럼 `HV`, 묶음 컬럼 `Z Score` | 사용자가 “HV, Z score 컬럼 따로”를 원했고, 기존 `Changes %` 레이아웃과 일관된다. |
| D5 | toolbar 버튼 의미 | quick visibility toggle | `Columns` 메뉴와 중복되지만, 자주 쓰는 컬럼을 빠르게 켜고 끄기 좋다. |
| D6 | 기본 visibility | `HV`, `Z Score` 둘 다 기본 숨김 | 기본 화면 폭 증가를 막고, 원하는 사용자만 켜게 한다. |
| D7 | model1-safe 처리 | `changes`, `hv`, `zscore` 모두 숨김 | 현재 `changes`만 숨기는데, 같은 계열 derived price reaction column은 함께 숨기는 편이 맞다. |
| D8 | intraday metric 포함 여부 | 포함 (`fr.O→C`, `fr.O→H`도 계산) | 사용자 요청이 “각 change 데이터 대응”이므로 제외하면 요구사항이 줄어든다. |
| D9 | grouped column sort 기준 | 첫 표시 항목(`Chg`) 기준 | 사용자 결정 사항으로 고정한다. HV/Z Score 묶음 컬럼 header를 누르면 각 묶음의 `Chg` 줄 값을 대표값으로 써서 정렬한다. |
| D10 | source별 quick button 분리 여부 | 분리하지 않음 | 컬럼 토글과 source filter는 역할이 다르다. source 구분은 기존 source filter / source별 update 버튼에서 처리하고, HV/Z Score 버튼은 전역 column toggle로 두는 편이 UI가 덜 복잡하다. |

### 계획 중간 필수 확인

- longest horizon(`+30D = +22 trading days`)와 `lookback=60` 조합에서, 각 뉴스 row마다 최소 몇 개의 과거 bar가 필요한지 계산량을 먼저 확정해야 한다.
- recent/custom change update가 HV/Z-score까지 같이 계산하면 ticker별 반복 OHLC 조회가 늘어나므로, per-item query 구조로 두면 느려질 가능성이 높다.
- `news_change_metrics.value_pct`에 z-score를 저장할 때 단위명이 legacy라는 점을 문서에 명시해야 한다.
- `Columns` 메뉴와 quick buttons가 같은 state(`visibleCols`)를 바라보도록 해야 UI drift가 없다.
- 기존 localStorage의 `visibleCols` 배열에 새 column ID가 없더라도 crash 없이 기본 숨김으로 동작해야 한다.
- model1-safe mode에서 새 컬럼까지 함께 숨기지 않으면 기존 safety 설명과 불일치가 생긴다.
- history 부족, 휴장일, ticker OHLC 부재, same-day defer rule 때문에 일부 row는 HV/Z-score가 계속 `null`일 수 있다. 이를 정상 상태로 처리할지 error로 처리할지 문구가 필요하다.
- 묶음 컬럼 sort 기준의 뜻: `HV` 또는 `Z Score` 컬럼 안에는 `Chg`, `fr.O→C`, `fr.O→H`, `+1D`, `+3D`, `+7D`, `+14D`, `+30D`가 같이 들어가므로, 사용자가 컬럼 header를 눌러 정렬할 때 어떤 하위 줄을 대표값으로 삼을지 정해야 한다. 이번 plan에서는 `Chg`를 대표값으로 고정한다.
- source별 버튼 분리 관련 판단: 현재 News window에는 이미 source filter와 source별 update 액션이 있다. 따라서 `HV`/`Z Score` 버튼까지 `Company News`, `FMP PR`, `FMP SEC`로 쪼개면 “무엇을 보여줄지”와 “어떤 source만 볼지”가 섞여 버튼 수만 늘어난다. source를 빠르게 바꾸고 싶다면 별도의 source chip/segmented control을 고려할 수 있지만, HV/Z Score quick button 자체는 전역 toggle이 더 적절하다.

### 제안하는 구현 순서(이유)

1. 수식과 metric key naming을 먼저 고정한다.
   - 저장 키와 API 필드명이 흔들리면 backend/frontend/doc가 동시에 드리프트한다.
2. backend 계산 helper와 write 경로를 먼저 만든다.
   - UI는 숫자를 보여주기만 하면 되므로 source of truth를 먼저 안정화하는 편이 낫다.
3. `/api/news` contract를 확장한다.
   - 프론트가 임시 계산이나 secondary fetch를 하지 않게 한다.
4. Finnhub News window에 컬럼/버튼을 붙인다.
   - state와 렌더링은 마지막에 한 번에 맞추는 편이 안전하다.
5. 최근/커스텀 update 흐름을 새 metric까지 포함하도록 연결한다.
   - 기존 row backfill과 신규 row 계산이 같은 경로를 쓰게 한다.
6. 문서를 마지막에 동기화한다.
   - 실제 필드명과 UI 문구가 확정된 뒤 업데이트해야 문서 drift를 줄일 수 있다.

### 단계별 계획(각 단계: 구현 → 검증)

#### ⏳ Step 0 — 정의와 범위 고정

| 세부 단계 | 작업 | 상태 |
|-----------|------|------|
| 0-1 | 현재 `Changes %` 묶음의 실제 하위 metric 정의와 horizon 매핑을 문서화 | ⏳ |
| 0-2 | HV/Z-score 수식과 고정 lookback(`60`) 기준을 문서화 | ⏳ |
| 0-3 | `HV`, `Z Score` 버튼을 quick visibility toggle로 두는 UI 기본안을 고정 | ⏳ |

0-1 목적: 기존 metric 의미를 잘못 읽어서 HV를 엉뚱한 분모로 계산하는 실수를 막기 위함.
설명: `+7D`가 실제로는 `+5 trading days`라는 점, `change_1d_pct`가 event day를 포함한 cumulative move라는 점을 먼저 고정한다.
완료 조건(눈으로 확인): plan 안에 metric별 수식과 trading-day 매핑이 모두 적혀 있다.
사람 검증(비개발자): 어떤 change 옆에 어떤 HV/Z-score가 붙는지 문서만 읽고 이해할 수 있다.
흔한 문제/주의: `1일 변동성`을 lookback 길이와 horizon 길이로 혼동하기 쉽다.

0-2 목적: z-score 분모를 통일하기 위함.
설명: annualized HV가 아니라 현재 change와 바로 나눌 수 있는 non-annualized sigma를 쓰고, lookback은 60 completed samples로 고정한다.
완료 조건(눈으로 확인): `zscore = actual / hv` 정의와 `hv = std(last 60 completed samples)` 정의가 문서에 있다.
사람 검증(비개발자): 2배 강한 움직임이라는 해석이 가능한 구조임을 이해할 수 있다.
흔한 문제/주의: `std` 계산에 미래 bar가 섞이면 수치가 지나치게 좋아 보일 수 있다.

0-3 목적: 버튼과 컬럼의 역할을 분리해 UI 혼란을 줄이기 위함.
설명: toolbar 버튼은 단축 토글이고, 실제 source of truth는 `Columns` 메뉴 + `visibleCols` state라는 방향을 정한다.
완료 조건(눈으로 확인): 버튼 의미와 컬럼 메뉴 의미가 plan에 분리돼 적혀 있다.
사람 검증(비개발자): `HV` 버튼을 누르면 HV 컬럼이 보이고, Columns에서도 같은 상태를 볼 수 있다고 이해할 수 있다.
흔한 문제/주의: 버튼이 “계산 실행”인지 “표시 토글”인지 애매하면 사용자 기대가 어긋난다.

검증 훅:
```text
- FinnhubNewsWindow의 현재 changes 렌더링 구조 확인
- newsChangeMerger의 현재 metric 정의 확인
- plan 내 수식/용어/버튼 의미 재검토
```
사용자 확인 필요: **예**

#### ⬜ Step 1 — backend 계산/저장 설계 반영

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 1-1 | HV/Z-score metric key naming과 공통 상수 정의 추가 | `terminal/backend/src/services/newsChangeMerger.ts` | key 목록 코드 리뷰 | ⬜ |
| 1-2 | metric별 matching historical series와 rolling std helper 추가 | `terminal/backend/src/services/newsVolatilityMetrics.ts`, `terminal/backend/src/services/newsChangeMerger.ts` | 샘플 ticker 계산 검증 | ⬜ |
| 1-3 | base change + HV + z-score를 한 번에 write하는 upsert 경로로 확장 | `terminal/backend/src/services/newsChangeMerger.ts` | DB row count / metric_key 확인 | ⬜ |
| 1-4 | bulk update에서 ticker별 history cache를 재사용하도록 최적화 | `terminal/backend/src/services/newsChangeMerger.ts` | recent/custom update 성능 확인 | ⬜ |

1-1 목적: API와 DB와 UI가 같은 이름 체계를 쓰게 하기 위함.
설명: 예시 `hv_change_pct`, `hv_change_1d_pct`, `zscore_change_pct`, `zscore_change_1d_pct` 같은 prefix naming을 고정한다.
완료 조건(눈으로 확인): metric key 목록이 상수로 정의된다.
사람 검증(비개발자): 나중에 DB를 봐도 어떤 값이 HV인지 Z-score인지 이름만으로 구분된다.
흔한 문제/주의: `z_`처럼 너무 짧은 prefix는 문서/쿼리에서 해석이 모호해질 수 있다.

1-2 목적: 계산식의 일관성과 look-ahead 방지를 코드로 강제하기 위함.
설명: 각 metric에 대해 과거 완결 sample만 모아 `std`를 계산하는 helper를 분리한다.
완료 조건(눈으로 확인): helper가 metric 종류, current anchor, lookback count를 입력받아 HV를 반환한다.
사람 검증(비개발자): 같은 ticker라도 metric마다 다른 기준 변동성이 붙는 이유를 설명할 수 있다.
흔한 문제/주의: `+30D` sample은 더 긴 과거 bar가 필요하므로 단순 recent 20일 조회로는 부족하다.

1-3 목적: 신규 row와 기존 backfill이 같은 저장 구조를 쓰게 하기 위함.
설명: 기존 8 metric write 뒤에 HV 8개와 z-score 8개를 같은 트랜잭션 안에서 저장한다.
완료 조건(눈으로 확인): 한 news_id에 대해 base/HV/Z-score metric_key가 함께 저장된다.
사람 검증(비개발자): 나중에 재계산해도 세 값이 한 세트로 갱신된다.
흔한 문제/주의: `value_pct` 컬럼에 z-score를 넣는 legacy semantics는 문서화가 필요하다.

1-4 목적: recent/custom update가 지나치게 느려지는 것을 막기 위함.
설명: ticker별 OHLC history를 한 번 불러와 여러 news row가 재사용하도록 cache 구조를 둔다.
완료 조건(눈으로 확인): per-item 독립 query 대신 ticker/date cache 또는 batch history read 경로가 생긴다.
사람 검증(비개발자): 같은 종목 뉴스가 많아도 계산 속도가 지나치게 떨어지지 않는다.
흔한 문제/주의: cache key를 ticker만으로 두면 anchor date별 필요한 slice가 뒤섞일 수 있다.

검증 훅:
```text
- 특정 ticker 1개로 Chg/HV/Z-score 수기 계산 대조
- recent/custom update 후 metric_key별 row 존재 확인
- history 부족 row가 null로 남는지 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 2 — `/api/news` contract 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 2-1 | `NewsItem` 타입에 HV/Z-score snake_case 필드 추가 | `terminal/backend/src/types.ts` | 타입 에러 0개 | ⬜ |
| 2-2 | `newsRepository.ts`에 HV/Z-score LEFT JOIN 및 alias 추가 | `terminal/backend/src/services/newsRepository.ts` | API response JSON 확인 | ⬜ |
| 2-3 | model1-safe projection에서 새 derived field를 함께 제외 | `terminal/backend/src/types.ts`, `terminal/backend/src/services/newsRepository.ts` | `/api/model1/news` field 확인 | ⬜ |

2-1 목적: backend response contract를 먼저 고정하기 위함.
설명: `[][][]hv_change_pct[][][]`, `[][][]zscore_change_pct[][][]` 계열 field를 `NewsItem`에 추가한다.
완료 조건(눈으로 확인): 타입에 새 필드가 모두 선언된다.
사람 검증(비개발자): API 문서 기준으로 어떤 숫자가 새로 내려오는지 이름이 명확하다.
흔한 문제/주의: field 누락이 있으면 프론트에서 일부 하위 줄만 비어 보인다.

2-2 목적: 프론트가 별도 계산 없이 숫자를 바로 받게 하기 위함.
설명: `news_change_metrics`를 새 metric_key로 추가 JOIN 하고 snake_case field로 매핑한다.
완료 조건(눈으로 확인): `/api/news` JSON에 새 HV/Z-score field가 포함된다.
사람 검증(비개발자): 개발자 도구에서 API 응답만 봐도 새 값이 내려온다.
흔한 문제/주의: JOIN alias가 많아져 누락/오타가 생기기 쉽다.

2-3 목적: 기존 model1-safe 설명과 행동을 유지하기 위함.
설명: 현재 `changes` 계열을 숨기듯 HV/Z-score도 model1-safe에서는 노출하지 않는다.
완료 조건(눈으로 확인): model1-safe response에서 새 필드가 빠진다.
사람 검증(비개발자): safe mode에서 price reaction derived field가 추가로 보이지 않는다.
흔한 문제/주의: 타입만 뺐고 query는 여전히 넣어두면 payload/문서가 어긋날 수 있다.

검증 훅:
```text
- GET /api/news?limit=3 응답에서 HV/Z-score field 확인
- GET /api/news/:id 응답에서 field 확인
- GET /api/model1/news 응답에서 field 미포함 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 3 — Finnhub News window 컬럼/버튼/UI 상태 확장

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 3-1 | `ColumnId`에 `hv`, `zscore` 추가하고 기본 숨김 상태로 등록 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | column menu 표시 확인 | ⬜ |
| 3-2 | `BackendNewsItem`, `DisplayItem`, `mapBackendItem`에 HV/Z-score field 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | row data 매핑 확인 | ⬜ |
| 3-3 | `HV`와 `Z Score` 묶음 셀 렌더링 및 sort 기준 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | UI 정렬/렌더링 확인 | ⬜ |
| 3-4 | toolbar quick toggle 버튼과 `visibleCols` persistence 호환 처리 추가 | `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx` | 버튼/Columns 동기화 확인 | ⬜ |

3-1 목적: 사용자에게 새 컬럼을 선택 가능하게 노출하기 위함.
설명: `DEFAULT_COLUMNS`에 `HV`, `Z Score`를 추가하되 `HIDDEN_BY_DEFAULT`에 넣는다.
완료 조건(눈으로 확인): `Columns` 메뉴에서 두 새 컬럼이 체크박스로 보인다.
사람 검증(비개발자): 기본 화면은 그대로고, 원할 때만 새 컬럼을 켤 수 있다.
흔한 문제/주의: 기존 localStorage `visibleCols`에 없는 새 ID 때문에 오류가 나면 안 된다.

3-2 목적: backend field를 프론트 row model로 연결하기 위함.
설명: `hvChangePct`, `zscoreChangePct` 계열 camelCase field를 추가한다.
완료 조건(눈으로 확인): network 응답값이 row object에 매핑된다.
사람 검증(비개발자): API 값이 화면에 표시될 준비가 된다.
흔한 문제/주의: snake_case ↔ camelCase 맵핑 누락 시 일부 줄만 `-` 로 보인다.

3-3 목적: `Changes %`와 같은 읽기 방식으로 새 수치를 보이게 하기 위함.
설명: 기존 3줄 묶음 레이아웃을 재사용해 `HV`, `Z Score`를 각각 렌더링하고, sort는 첫 줄 대표값 기준으로 맞춘다.
완료 조건(눈으로 확인): `HV` 컬럼과 `Z Score` 컬럼이 같은 row height 규칙 안에서 정상 렌더링된다.
사람 검증(비개발자): 한 기사 row에서 `Changes`, `HV`, `Z Score`를 나란히 비교할 수 있다.
흔한 문제/주의: 컬럼 폭이 너무 좁으면 3줄 묶음이 깨져 가독성이 급격히 떨어진다.

3-4 목적: 사용자 요청의 “버튼” 요구사항을 충족시키기 위함.
설명: toolbar에 `HV`, `Z Score` 버튼을 추가하고, 클릭 시 `visibleCols`의 해당 컬럼만 토글한다.
완료 조건(눈으로 확인): 버튼 on/off 상태와 `Columns` 체크박스 상태가 항상 같다.
사람 검증(비개발자): 버튼을 누르면 바로 컬럼이 보이거나 숨겨진다.
흔한 문제/주의: 버튼 state와 checkbox state를 따로 두면 drift가 생긴다.

검증 훅:
```text
- News window에서 HV/Z Score 버튼 토글 확인
- Columns 메뉴 체크박스와 버튼 상태 동기화 확인
- model1-safe mode에서 changes/hv/zscore 모두 숨김 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 4 — recent/custom change update와 기존 row backfill 연결

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 4-1 | recent change update가 base/HV/Z-score를 함께 계산하도록 연결 | `terminal/backend/src/services/newsChangeMerger.ts`, `terminal/backend/src/server.ts` | recent route 실행 결과 확인 | ⬜ |
| 4-2 | custom change update가 과거 범위 backfill에 그대로 쓰이도록 연결 | `terminal/backend/src/services/newsChangeMerger.ts`, `terminal/backend/src/server.ts` | custom route 실행 결과 확인 | ⬜ |
| 4-3 | history 부족/null rule과 log 메시지 정리 | `terminal/backend/src/services/newsChangeMerger.ts` | job log / null row 확인 | ⬜ |

4-1 목적: 신규 incoming 뉴스와 최근 운영 구간이 같은 계산 경로를 쓰게 하기 위함.
설명: 기존 recent route 실행 시 HV/Z-score metric_key도 함께 적재되게 한다.
완료 조건(눈으로 확인): recent route 후 최근 row에 새 metric이 채워진다.
사람 검증(비개발자): 최근 뉴스 화면에서 버튼만 눌러도 새 컬럼 값이 채워진다.
흔한 문제/주의: 계산량 증가로 job 시간이 길어질 수 있다.

4-2 목적: 이미 DB에 있는 과거 뉴스도 backfill 가능하게 하기 위함.
설명: 새 전용 route를 만들지 않고 기존 custom update를 재사용해 범위별 재계산을 수행한다.
완료 조건(눈으로 확인): custom route 후 지정 범위 row에 새 metric이 채워진다.
사람 검증(비개발자): 원하는 날짜 범위를 다시 계산해 과거 기사도 비교할 수 있다.
흔한 문제/주의: 아주 긴 범위를 한 번에 돌리면 FMP fallback/DB write가 느려질 수 있다.

4-3 목적: null을 오류로 오해하지 않게 하기 위함.
설명: history 부족, OHLC 없음, same-day defer 같은 정상 null 사유를 log와 UI 문서에 남긴다.
완료 조건(눈으로 확인): log에 skip/null 사유가 구분돼 있다.
사람 검증(비개발자): 값이 비어 있어도 “계산 실패”인지 “데이터 부족”인지 구분할 수 있다.
흔한 문제/주의: null 사유를 숨기면 사용자는 계산 버그로 오해한다.

검증 훅:
```text
- POST /api/news/change/update-recent 후 최근 row 확인
- POST /api/news/change/update-custom 후 지정 범위 row 확인
- job log에서 insufficient-history / same-day-defer 구분 확인
```
사용자 확인 필요: **예**

#### ⬜ Step 5 — 문서 동기화와 최종 검증

| 세부 단계 | 작업 | 파일 | 검증 | 상태 |
|-----------|------|------|------|------|
| 5-1 | backend prompt 문서에 새 metric 정의/응답 field/route 동작 반영 | `terminal/backend_prompt.md` | 문서 리뷰 | ⬜ |
| 5-2 | frontend prompt 문서에 새 버튼/컬럼/localStorage 동작 반영 | `termina_web/figma_code/terminal_ui_ver2_finhub/figma_frontend_prompt.md` | 문서 리뷰 | ⬜ |
| 5-3 | 정적 분석, build, test, 런타임 검증 시나리오를 완료 보고 형식으로 정리 | `ai_agent_plan/news_hv_zscore/agent_log.md` | 검증 표 완성 | ⬜ |

5-1 목적: backend field와 route 의미가 문서와 어긋나지 않게 하기 위함.
설명: `HV`가 annualized가 아니라 matching sigma라는 점, 새 snake_case field 목록, change update 확장 범위를 문서화한다.
완료 조건(눈으로 확인): backend prompt에 새 응답 컬럼과 수식이 적혀 있다.
사람 검증(비개발자): API 문서만 봐도 어떤 숫자인지 알 수 있다.
흔한 문제/주의: `HV`라는 용어만 적고 annualized 여부를 안 적으면 해석이 달라진다.

5-2 목적: UI 동작을 문서와 동기화하기 위함.
설명: `HV`/`Z Score` 버튼, `Columns` 메뉴, model1-safe hide rule, `visibleCols` persistence를 문서에 적는다.
완료 조건(눈으로 확인): frontend prompt에 새 버튼과 컬럼 정책이 적혀 있다.
사람 검증(비개발자): 어떤 버튼을 누르면 무엇이 보이는지 문서에서 바로 알 수 있다.
흔한 문제/주의: button toggle과 column selector를 둘 다 설명하지 않으면 사용법이 모호해진다.

5-3 목적: 구현 이후 검증 누락을 막기 위함.
설명: 정적 분석, build, test, API check, 브라우저 확인을 agent log에 표 형태로 남길 준비를 한다.
완료 조건(눈으로 확인): 완료 보고용 검증 표 형식이 잡혀 있다.
사람 검증(비개발자): 나중에 실제 구현이 끝나면 어떤 순서로 확인하면 되는지 알 수 있다.
흔한 문제/주의: 브라우저 확인 없이 build만 통과해도 UI 줄바꿈/column width 문제는 놓치기 쉽다.

검증 훅:
```text
- get_errors 0 확인
- frontend/backend build 성공 확인
- test 성공 확인
- /api/news 응답과 실제 News window 렌더링 확인
```
사용자 확인 필요: **예**

### 미확정 사항(명시 결정 필요)

| ID | 결정 필요 사항 | 선택지 | 차단 대상 Step |
|----|----------------|--------|----------------|
| U3 | UI 라벨 표현 | `HV`, `Z Score` / `HV(σ)`, `Z Score` | Step 3, Step 5 |

- U3 기본 제안: 버튼/컬럼 제목은 `HV`, `Z Score`, 문서 설명에서만 `비연율화 sigma`를 명시
  - 이유: UI는 짧게, 문서는 정확하게 가져가는 방식이 가장 실용적이다.

### 실행 의존성 그래프

Legend

- `✅` 구현 + 사용자 확인 완료
- `⏳` 사전 감사/계획 작성 완료, 사용자 확인 대기
- `⬜` 미착수
- `🚫` 선행조건 미충족으로 차단

트랙 A — 정의/Backend

```text
⏳ 0-1 현재 changes metric 정의 고정
⏳ 0-2 HV/Z-score 수식 및 60-sample lookback 고정

⬜ 1-1 metric key naming 정의
⬜ 1-2 matching historical series helper 추가
⬜ 1-3 base/HV/Z-score upsert 확장
⬜ 1-4 ticker별 history cache 최적화

⬜ 2-1 NewsItem 타입 확장
⬜ 2-2 /api/news JOIN/alias 확장
⬜ 2-3 model1-safe projection 정리

⬜ 4-1 recent update 확장
⬜ 4-2 custom update 확장
⬜ 4-3 null/log rule 정리
```

트랙 B — Frontend/Docs

```text
⏳ 0-3 HV/Z Score 버튼 의미 고정

🚫 3-1 hv/zscore column ID 추가            (Step 2 선행)
🚫 3-2 row model field 매핑 추가           (Step 2 선행)
🚫 3-3 HV/Z Score 묶음 렌더 + sort 추가    (Step 2 선행)
🚫 3-4 quick toggle + persistence 추가     (Step 3-1 선행)

🚫 5-1 backend prompt 문서 갱신            (Step 2, Step 4 선행)
🚫 5-2 frontend prompt 문서 갱신           (Step 3 선행)
🚫 5-3 최종 검증/로그 정리                 (Step 4 선행)
```

병렬 트랙 요약

- Step 1과 Step 2는 사실상 같은 backend 트랙이므로 순차 진행이 맞다.
- Step 3의 UI 작업은 최소한 Step 2의 field naming이 고정된 뒤 시작하는 편이 안전하다.
- Step 5 문서화는 backend/frontend 구현이 끝난 뒤 마지막에 묶는 것이 drift를 줄인다.

차단 요약 테이블

| 결정 | 차단 대상 | 선택지 |
|------|-----------|--------|
| U3 UI 라벨 표현 | Step 3, Step 5 | `HV`, `Z Score` / `HV(σ)`, `Z Score` |

### PLAN CHANGE

- 2026-04-18 user decision 반영:
  - HV lookback은 `60 completed samples`로 고정한다.
  - 따라서 `U1`은 미확정 사항에서 제거한다.
  - `grouped column sort 기준`은 `Chg 기준`으로 고정한다.
  - source별 quick button은 만들지 않고, `HV`/`Z Score`는 전역 column toggle로 유지한다.

### 결정 #1 — HV 정의 방식(상세)

옵션 A: `daily sigma × sqrt(h)` 방식

- 장점
  - 구현이 단순하다.
  - finance 관례와 설명이 쉽다.
- 단점
  - `fr.O→C`, `fr.O→H` 같은 intraday metric에는 바로 대응되지 않는다.
  - 현재 `change_1d_pct`, `change_3d_pct`가 “event day 포함 cumulative move”라는 점을 정확히 반영하지 못한다.

옵션 B: metric별 matching historical series 방식

- 장점
  - 현재 UI에 보이는 각 change metric 정의와 1:1로 맞는다.
  - intraday metric과 forward metric을 한 구조 안에서 처리할 수 있다.
  - z-score 분모가 “실제로 비교하려는 움직임의 과거 분포”가 된다.
- 단점
  - 더 긴 history와 더 많은 계산이 필요하다.
  - look-ahead bias 방지 규칙을 코드로 엄격히 넣어야 한다.

권장안: **옵션 B**

- 이유: 사용자 요구사항이 “각 change 데이터에 대응”이기 때문에, 단순 환산값보다 metric 정의 일치성이 우선이다.

### 결정 #2 — 저장 위치(상세)

옵션 A: 기존 `news_change_metrics` 재사용

- 장점
  - existing recent/custom update 흐름을 그대로 확장할 수 있다.
  - `/api/news`의 join 패턴을 유지할 수 있다.
  - PK `(news_id, metric_key)`가 이미 generic해서 새 key를 넣기 쉽다.
- 단점
  - `value_pct` 컬럼명은 z-score에 정확한 이름이 아니다.
  - current batch write SQL이 8 metric 고정이라 리팩터링이 필요하다.

옵션 B: 새 테이블 `news_volatility_metrics` 추가

- 장점
  - 단위/의미를 더 정확히 분리할 수 있다.
  - 향후 IV, BB%B, percentile rank 확장 여지가 있다.
- 단점
  - schema, route, query, docs가 더 커진다.
  - 기존 update flow와 source of truth가 둘로 갈라질 수 있다.

권장안: **옵션 A**

- 이유: 이번 범위는 HV/Z-score 2개 계열 추가이며, 새 저장소를 만드는 비용이 이득보다 크다.
- 완화책: 문서에 `news_change_metrics.value_pct`가 legacy generic numeric container로 사용된다고 명시한다.

### 결정 #3 — UI 컬럼 구조(상세)

옵션 A: `HV`, `Z Score`를 각각 묶음 컬럼 1개로 추가

- 장점
  - 현재 `Changes %` UI와 패턴이 같다.
  - 사용자가 기사 row 하나를 옆으로만 비교하면 된다.
  - toolbar quick toggle 버튼 2개와도 잘 맞는다.
- 단점
  - 한 컬럼 안에 값이 많아 sort 기준이 하나만 가능하다.

옵션 B: metric별 개별 컬럼 16개 추가

- 장점
  - 정렬 의미가 명확하다.
  - 특정 horizon만 보고 싶을 때 유리하다.
- 단점
  - 컬럼 수가 과도하게 많아지고 News window 폭이 무너진다.
  - 사용자 요청의 “HV / Z score 컬럼 따로”보다 더 복잡해진다.

권장안: **옵션 A**

- 이유: 기존 `Changes %`가 이미 multi-line 묶음 구조이고, 사용자가 먼저 요구한 것은 “HV 컬럼”과 “Z score 컬럼”이다.