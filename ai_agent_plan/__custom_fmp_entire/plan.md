# Custom FMP PR Entire Date — Plan

## 배경

기존 `Custom FMP PR` 버튼은 envelope/gap-only 방식으로 동작한다 — `buildTickerGapPlans()`로 ticker별 envelope을 계산해 이미 커버된 구간은 건너뛰고 missing gap만 fetch한다. 사용자가 **gap 계산 없이 전체 날짜 범위를 그대로 fetch**하는 원래(과거) 방식의 버튼을 별도로 원함.

참조 커밋: `977b20d6869646485343d8eda9a0c73278e9d2fe` (branch `fmp_stock`) — envelope/gap-only 추가 이전의 코드.

## 현재 상태 (2026-04-10)

### 구현 완료 사항

**Backend (`terminal/backend/src/server.ts`):**
- `pullFmpPressReleaseSchema.mode`에 `"custom-entire"` 추가: `z.enum(["recent", "custom", "custom-entire"])`
- `isCustomEntire` 플래그 추가, `isCustom`은 `custom` + `custom-entire` 모두 포함
- gap planning 스킵: `(isCustom && !isCustomEntire) ? await buildTickerGapPlans(...) : undefined`
- `else if (isCustomEntire)` 분기 추가 — 전체 날짜 범위를 모든 ticker에 대해 fetch (과거 코드와 동일한 동작)

**Frontend (`FinnhubNewsWindow.tsx`):**
- `UpdateSourceType`에 `'fmp_press_release_entire'` 추가
- `handleUpdate`: `fmp_press_release_entire`일 때 `mode: 'custom-entire'`로 전송
- `handleCustomPreflightStart`: `fmp_press_release_entire`은 preflight 스킵, 직접 실행
- 메뉴에 **"Custom FMP PR (Entire Date)"** 버튼 추가 (기존 Custom FMP PR 바로 아래, emerald-600 색상)
- `getSourceTypeLabel` / `getSourceTypeShortLabel`에 라벨 추가

**Docs:**
- `backend_prompt.md`: `custom-entire` mode 설명 추가
- `figma_frontend_prompt.md`: `fmp_press_release_entire` dispatch 라우팅 추가

### 빌드/검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | server.ts + FinnhubNewsWindow.tsx 0 errors |
| 빌드 | ✅ | backend `npm run build` 성공 (Exit Code 0) |
| 런타임 통합 | ✅ | `mode: 'custom-entire'` API 호출 성공, job 생성 확인, `Custom-entire mode:` 로그 확인, 1699 tickers 대상 정상 fetch |

### 발견된 문제: 4/7~8 데이터 누락

#### 증상
`custom-entire`로 4/5~4/10 범위를 실행하면 4/7, 4/8 날짜의 `fmp_press_release` 데이터가 0건.

```
fmp_press_release per day (Apr 1-10):
2026-04-01: 358건
2026-04-02: 346건
2026-04-03: 144건
2026-04-04: 38건
2026-04-05: 43건
2026-04-06: 110건
2026-04-07: 0건  ← !!
2026-04-08: 0건  ← !!
2026-04-09: 295건
2026-04-10: 37건
```

#### 원인 분석 완료

**FMP 측 문제가 아님.** FMP API를 직접 호출하면 4/7~8 데이터가 정상적으로 반환됨:
- MSFT: 4/8에 3건, 4/7에 1건
- NVDA: 4/8에 2건, 4/7에 2건
- AMZN: 4/8에 1건

**근본 원인: `UNIQUE (source, url)` 제약 + source_type 충돌**

`news_items` 테이블의 UNIQUE 제약이 `(source, url)` 기준이다. FMP의 press release API(`/stable/news/press-releases`)와 stock news API(`/stable/news/stock`)가 **같은 URL의 뉴스를 반환**한다.

`fmp_stock_news` pull이 먼저 실행되면 해당 URL이 `source='FMP', source_type='fmp_stock_news'`로 저장됨 → 이후 `fmp_press_release` pull에서 같은 URL을 insert하려 하면 `INSERT OR IGNORE`에 의해 skip됨.

**증거 (DB 직접 확인):**
```
FMP API가 MSFT 4/8 press release로 반환한 URL 3건:
→ DB에서 조회하면 모두 source_type='fmp_stock_news'로 이미 저장됨
→ fmp_press_release로는 insert 안 됨 (UNIQUE 위반 → IGNORE)
```

```
custom-entire job으로 4/7~8만 실행 결과:
inserted=0, skipped=731
→ 731건의 press release가 이미 fmp_stock_news로 존재
```

#### 해결 방안 (미결정)

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. UNIQUE 변경** | `UNIQUE (source, url)` → `UNIQUE (source, source_type, url)` | 각 API 소스별로 독립 row 유지, 필터링 정확 | 중복 row 증가 (같은 뉴스가 2~3개 row), DB 용량/인덱스 비용 |
| **B. INSERT 시 source_type 병합** | 기존 row에 source_type을 CSV로 확장 (예: `fmp_press_release,fmp_stock_news`) | row 중복 없음 | 스키마 변경 + 필터 쿼리 변경 필요, 복잡도 증가 |
| **C. 현 상태 유지** | `source_type` 필터 대신 `source_names=FMP`으로 전체 FMP 데이터 조회 | 코드 변경 없음 | 사용자가 의도한 source_type별 필터링이 불완전 |
| **D. insert 순서 보장** | press_release pull을 항상 stock_news보다 먼저 실행하도록 강제 | 간단 | 순서 강제가 깨지면 재발, 근본 해결 아님 |

**사용자 결정 대기 중.**

### 추가 이슈 (2026-04-10): FMP SEC Pull 진행률 표시 버그

- 증상: `FMP SEC Pull` job이 실제로는 filings를 계속 처리하고 있어도 UI 진행률이 `0/1699 (0%)`로 고정되어 멈춘 것처럼 보임.
- 원인: [server.ts](terminal/backend/src/server.ts) 의 SEC filing job에서 `fetchFmpSecFilings()` 완료 직후 `updateProgress(jobId, 0)`을 호출해 `completed`를 0으로 되돌리고, 이후 filing 처리 루프에서는 진행률을 다시 갱신하지 않음.
- 수정 방향: ticker fetch phase가 끝나면 progress total을 `filings.length`로 전환하고, filing 1건 처리 완료마다 `updateProgress()`를 호출하도록 변경.
- 검증 계획: backend 타입체크/빌드 후, 별도 테스트 DB + 별도 포트 백엔드를 띄워 SEC pull job을 실행하고 progress가 0에서 증가하는지 확인.
- 적용 결과: `terminal/backend/src/server.ts`에서 SEC pull이 `Fetched N filings` 이후 `Processing N fetched filings...` 로그를 남기고, progress total을 `filings.length`로 전환한 뒤 filing 처리마다 progress를 증가시키도록 수정 완료. 별도 8081 테스트 인스턴스에서 `Universe: 3 tickers` job이 `3/3 (100%)`로 완료되는 것을 확인함.
