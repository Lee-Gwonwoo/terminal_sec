## 2026-03-28

**작성 시각:** 2026-03-28 21:29 (local)

### 작업 요약

- Step 1 구현: backend query/index 저위험 최적화 적용
- Step 2 부분 구현: Finnhub 초기 로딩 waterfall 축소 적용
- 상태: 확인 대기 (awaiting user confirmation)

### 변경 파일

- `terminal/backend/src/db.ts`
- `terminal/backend/src/services/newsRepository.ts`
- `terminal/backend/src/services/model2AnalysisRepository.ts`
- `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
- `ai_agent_plan/front_loading_fastly/plan.md`

### 변경 내용

1. `db.ts`
   - `news_sentiment_snapshots` 최신 조회용 index 추가
   - `company_profiles` 최신 조회용 index 추가
2. `newsRepository.ts`
   - `/api/news` enrichment 경로를 helper 기반으로 정리
   - sentiment 최신 row 조회를 window function 기반으로 변경
   - peers / marketCap / description / ipoDate 조회를 최신 non-null profile row 기준으로 재구성
3. `model2AnalysisRepository.ts`
   - evidence 날짜 filter를 `SUBSTR()` 기반 비교에서 range 비교로 변경
4. `FinnhubNewsWindow.tsx`
   - `finhub-news-ui-state`를 mount 시 1회만 읽는 ref 캐시 추가
   - bookmark folder fetch를 eager-load에서 lazy-load로 변경

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 변경 파일 4개 기준 0 errors |
| 빌드 | ✅ | backend `npm.cmd run build`, frontend `npm.cmd run build` 성공 |
| 자동 테스트 | ✅ | backend `npm.cmd run test` -> 84/84 pass |
| 런타임 통합 | ✅ | `/api/news?source_names=FINNHUB,RTPR,FMP&limit=20` 응답에서 `industry`, `ipoDate`, `marketCap`, `peers`, `companyDescription` 유지 확인. `/api/model2/analyses` 및 `/api/model2/analyses/{id}/evidence?limit=10` 응답에서 `total`, `items`, evidence row 필드 유지 확인. 브라우저 시각 확인은 사용자 위임 |

### 사용자가 직접 확인하는 방법

```powershell
cd c:\github_coding\terminal_sec\terminal
npm.cmd run build
npm.cmd run test

cd c:\github_coding\terminal_sec\termina_web\figma_code\terminal_ui_ver2_finhub
npm.cmd run build

curl.exe "http://localhost:8080/api/news?source_names=FINNHUB,RTPR,FMP&limit=20"
curl.exe "http://localhost:8080/api/model2/analyses"
```

브라우저에서는 Finnhub News 창 첫 진입 시 북마크 메뉴를 열지 않아도 뉴스 표가 먼저 채워지는지 확인하면 된다.

### 문제점 / 리스크 + 완화 방안

1. `company_profiles` source별 데이터 편차로 대표 row가 예상과 다를 수 있다.
   - 완화: 특정 ticker에서 `marketCap`, `ipoDate`, `peers`, `companyDescription` 값을 spot check 한다.
2. bookmark lazy-load로 인해 북마크 메뉴 첫 오픈 시 한 번의 지연이 남을 수 있다.
   - 완화: 첫 오픈 지연이 크면 메뉴 open 시 preload 타이밍만 추가 조정한다.
3. evidence 날짜 필터는 index 친화적으로 바뀌었지만 브라우저 체감은 아직 미확인이다.
   - 완화: Evidence Table 실제 화면에서 날짜 filter 적용 시간을 추가 확인한 뒤 Step 2-3 진행 여부를 결정한다.

### 다음 상태

- Step 1: 구현 완료, 사용자 확인 대기
- Step 2: 2-1 / 2-2 구현 완료, 2-3 미착수
- Step 3 이후: 미착수