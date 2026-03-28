## 2026-03-28

**작성 시각:** 13:13 (local)

### 작업 항목

- `ai_agent_plan/company_news_fulltext_exact/` plan 폴더를 새로 만들었다.
- company_news exact fulltext 복구를 위한 baseline 감사 결과를 정리했다.
- 현재 코드상 company_news 원문 추출 게이트가 Yahoo/Benzinga 중심으로 제한돼 있고, origin_url 보존이 매우 부족하다는 점을 확인했다.
- runtime DB에서 company_news 총량, origin_url 보유 수, success/unavailable 분포, 상위 publisher 분포를 직접 집계해 `plan.md`에 반영했다.

### 확인한 핵심 사실

- `FINNHUB + company_news` 총 row: `1,308,960`
- `origin_url` 보유 row: `3,913`
- `news_fulltext success`: `1,012` (`benzinga-scrape=912`, `yahoo-finance-browser=100`)
- 현재 company_news extractor 허용 publisher: `YAHOO`, `BENZINGA`

### 변경 파일

- `ai_agent_plan/company_news_fulltext_exact/plan.md`
- `ai_agent_plan/company_news_fulltext_exact/agent_log.md`

### 검증

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | 문서 생성 작업이라 code error 대상 없음 |
| 빌드 | ✅ | 빌드 비대상. 코드 변경 없음 |
| 자동 테스트 | ✅ | 테스트 비대상. 코드 변경 없음 |
| 런타임 통합 | ✅ | runtime DB 직접 집계로 baseline 수치 확인 |

### 사용자 확인 상태

- 상태: 확인 대기 (awaiting user confirmation)
- 요청 내용상 이번 단계는 plan 폴더 생성과 baseline 감사 문서화까지 완료했다.

### 리스크 / 메모

- 현재 company_news 대부분은 `origin_url`이 없어서 publisher scraper를 바로 추가해도 과거 row 재활용 효과가 작다.
- `news_fulltext`가 이미 `unavailable`로 기록된 row는 기본 fulltext job 재실행만으로는 다시 잡히지 않는다.
- CNBC처럼 일부 `origin_url`이 있어도 video URL이 섞여 있어 “원문 기사”와 “비디오 설명”을 분리해서 감사해야 한다.