## Backend Code Structure

기준 경로: `terminal/backend/src`

### 엔트리포인트

- `server.ts`
  - Express route 등록
  - background job 시작/폴링/cancel
  - Default Ticker / company profile / news / research / inspect API 연결

### company profile / ownership 계열

- `services/companyProfileRepository.ts`
  - `company_profiles` upsert
  - canonical ownership row 정리
- `services/fmpCompanyProfileProvider.ts`
  - FMP profile / market cap batch fetch
- `services/fmpSharesFloatProvider.ts`
  - float / outstanding shares fetch
- `services/yahooCompanyProfileProvider.ts`
  - Yahoo assetProfile fetch / concurrency clamp
- `services/yahooOwnershipProvider.ts`
  - Yahoo `majorHoldersBreakdown` fetch
  - per-ticker result callback
  - partial persist friendly batch 처리

### default ticker / universe 계열

- `services/tickerCsvService.ts`
  - allowlist CSV read / append
- `services/tickerUniverseRepository.ts`
  - default universe / items CRUD

### background jobs

- `services/jobManager.ts`
  - in-memory job state
  - progress / logs / cancel

### 문서 source of truth

- 상세 동작 스펙: `terminal/backend_prompt.md`
- DB 요약: `terminal/backend/DB_SCHEMA.md`