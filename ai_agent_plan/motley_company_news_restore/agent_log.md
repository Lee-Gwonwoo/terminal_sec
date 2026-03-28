## 2026-03-28

**작성 시각:** 13:15 (local)

### 작업 항목

- 새 계획 폴더 `ai_agent_plan/motley_company_news_restore/`를 생성했다.
- `Motley Fool` company_news 복구 + 수집 차단 해제 + company_news fulltext 지원 + 기존 UI 버튼 semantics 정렬 범위를 대상으로 `plan.md` 초안을 작성했다.
- 현재 확인된 핵심 사실을 plan에 반영했다: 삭제 전 DB 507건 존재, 현재 runtime DB 0건, pull 차단 존재, startup 삭제 로직 존재, company_news fulltext 지원 publisher 제한 존재, FMP stock용 Motley scraper 재사용 가능성 존재.

### 변경 파일

- `ai_agent_plan/motley_company_news_restore/plan.md`
- `ai_agent_plan/motley_company_news_restore/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | Markdown 문서 작성만 수행, 코드 파일 미수정 |
| 빌드 | 보류 | plan 작성 단계이므로 미실행 |
| 자동 테스트 | 보류 | plan 작성 단계이므로 미실행 |
| 런타임 통합 | 보류 | 구현 전 계획 수립 단계 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 사용자가 plan 구조와 범위를 확인하면 다음 단계에서 해당 plan 기준으로 구현을 시작한다.

### 리스크 / 메모

- 현재 코드 상태에서는 `MOTLEY FOOL`을 pull에서 허용해도 startup delete/evidence cleanup이 남아 있으면 복구 데이터가 다시 사라질 수 있다.
- `company_news` fulltext는 지금 `YAHOO`, `BENZINGA` 중심 정책이라, 복구만 하고 extractor 경로를 안 열면 `Full Text > Company News Only` 요구를 충분히 충족하지 못한다.
- 복구 범위(D1)와 evidence 정책(D2)을 먼저 정해야 실제 SQL과 검증 count를 고정할 수 있다.