# FMP Stock News — Publisher별 원문 링크 스크래핑 가능성 점검

## 목적
FMP stock news 각 publisher의 URL을 따라가서 기사 본문(fulltext)을 다운받는 것이 가능한지 점검한다.
현재 대다수 publisher는 FMP API가 내려주는 snippet(body-fallback, 평균 40~100 단어)만 저장 중이다.
이 plan은 링크 스크래핑으로 전문을 얻을 수 있는 대상과 불가 대상을 확정하고 구현 우선순위를 정하는 것이 목적이다.

## 최종 상태 (2026-03-27 구현 완료)

### PLAN CHANGE (2026-03-27 22:11 local)

- 목적 확장: publisher scraper 구현 자체는 완료됐지만, 실제 운영 속도는 `FMP Stock Pull` 내부에서 ticker fetch와 inline fulltext가 같은 `tickerConcurrency`를 공유하는 구조 때문에 불필요하게 제한되고 있었다.
- 이번 변경 범위:
  - backend `POST /api/news/pull-fmp-stock-news`에 `[][][]fulltextConcurrency[][][]` 필드 추가
  - `Recent/Custom FMP Stock` pull의 inline fulltext worker 수를 ticker pull worker 수와 분리
  - frontend `Control` modal + `Data Control` Settings 탭에서 같은 localStorage 키로 `FMP Stock Full Text Concurrency` 조정 가능하게 연결
  - manual `FMP Stock Only` fulltext도 같은 설정값을 재사용하도록 정렬
- 기대 효과: FMP API 호출 동시성은 보수적으로 유지하면서, 원문 스크래핑 단계만 별도로 더 높여 전체 완료 시간을 단축할 수 있다.
- 영향 파일:
  - `terminal/backend/src/server.ts`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/FinnhubNewsWindow.tsx`
  - `termina_web/figma_code/terminal_ui_ver2_finhub/src/app/components/DataControlWindow.tsx`
  - 관련 spec 문서 2종
- 상태: 구현 완료, 검증 진행 중

### 구현 완료 — 원문 추출 검증됨

| Publisher | 검증 word count | extraction_note | 방식 |
|-----------|----------------|-----------------|------|
| GlobeNewsWire / Globe News Wire | ~910 | `globenewswire-scrape` | HTTP+cheerio (기존) |
| Business Wire | ~1,222 | `businesswire-browser` | Playwright (기존) |
| PRNewsWire | ~947 | `prnewswire-scrape` | HTTP+cheerio (기존) |
| Newsfile Corp | ~1,016 | `newsfile-scrape` | HTTP+cheerio (기존) |
| Benzinga | 502 | `benzinga-scrape` | HTTP+cheerio (Fix-2: 화이트리스트 등록) |
| TheNewswire | 852 | `thenewswire-scrape` | HTTP+cheerio (Fix-1: switch case 추가) |
| CNBC | 462 | `cnbc-scrape` | HTTP+cheerio (신규) |
| Defense World | 1,255 | `defenseworld-scrape` | HTTP+cheerio (신규, 일부 구 URL 404) |
| 24/7 Wall Street / 247 Wallst | 808 | `247wallst-scrape` | HTTP+cheerio (신규) |
| Proactive Investors (2 variant) | 703 | `proactive-scrape` | HTTP+cheerio (신규) |
| PYMNTS | 535 | `pymnts-scrape` | HTTP+cheerio (신규) |
| TechCrunch | 177 | `techcrunch-scrape` | HTTP+cheerio (신규) |
| Schaeffers Research | 664 | `schaeffers-scrape` | HTTP+cheerio (신규) |
| The Motley Fool / Fool - Investing News | 490~696 | `motleyfool-scrape` | HTTP+cheerio (신규, 페이월 없음 확인) |
| Seeking Alpha | 109 | `seekingalpha-scrape` | HTTP+cheerio (recheck — 실제 추출 가능) |
| InvestorPlace / Investor Place | 1,690~1,693 | `investorplace-scrape` | HTTP+cheerio (recheck — 페이월 아님) |
| Deadline | 394 | `deadline-scrape` | HTTP+cheerio (recheck — 소프트 페이월 아님) |
| CNET | 395 | `cnet-scrape` | HTTP+cheerio (recheck — 추출 가능) |
| The Guardian | 979 | `guardian-scrape` | HTTP+cheerio (recheck — 완전 오픈) |
| Finbold | 342 | `finbold-scrape` | HTTP+cheerio (recheck — 오픈) |
| Fox Business | 439 | `foxbusiness-scrape` | HTTP+cheerio (recheck — 오픈, 일부 YouTube URL 제외) |
| New York Post | 160 | `nypost-scrape` | HTTP+cheerio (recheck — 오픈) |
| ETF Trends | 724 | `etftrends-scrape` | HTTP+cheerio (recheck — 오픈) |
| Kitco | 190 | `kitco-scrape` | HTTP+cheerio (recheck — 오픈) |
| NYTimes | 383~498 (불안정) | `nytimes-scrape` | HTTP+cheerio (recheck — 간헐적 403, 일부만 성공) |
| Nasdaq / TMX | 가변 | 기존 scraper | (기존) |
| SEC/EDGAR | 가변 | `sec-edgar-fetch` | (기존) |
| MCAP MediaWire / Accesswire | 가변 | 기존 scraper | (기존, Accesswire는 403 빈발) |

> **recheck 결과 요약 (2026-03-27):** 이전 plan에서 "차단됨/페이월"로 분류했던 publisher 중 Seeking Alpha, InvestorPlace, Deadline, CNET, The Guardian, NYTimes, Finbold, Fox Business, New York Post, ETF Trends, Kitco, Motley Fool이 실제로는 추출 가능하여 구현 완료함.

### 차단됨 — scraper 구현 불가 (recheck 확인, 2026-03-27)

| Publisher | 사유 | HTTP status | 비고 |
|-----------|------|-------------|------|
| Zacks | 본문 0c/빈 응답 | 200 | selector로 추출 불가 |
| WSJ | 401 인증 필요 | 401 | 강력한 페이월 |
| Barrons | 구독 벽 | 200 | 95~117wc만 추출, "Subscriber Agreement" 표시 |
| GuruFocus | 403 차단 | 403 | Cloudflare 방어 |
| MarketBeat | 403 차단 | 403 | |
| Reuters | 401 인증 필요 | 401 | |
| Invezz | 403 차단 | 403 | Cloudflare |
| Investopedia | 402 유료 | 402 | |
| Forbes | 403 차단 | 403 | |
| Market Watch | 페이월 | 200 | 24c만 추출, 실질적 유료 |
| Business Insider | 페이월 | 200 | 92c만 추출, 실질적 유료 |
| Investors Business Daily | 403 차단 | 403 | |
| FXEmpire | 빈 응답 | 200 | 0c, 페이월 감지 |
| GeekWire | 403 차단 | 403 | |
| Fast Company | 403 차단 | 403 | |

### YouTube (텍스트 추출 불가)

| Publisher | DB 건수 |
|-----------|---------|
| Schwab Network | 261 |
| CNBC Television | 230 |
| Bloomberg Markets and Finance | 75 |
| Bloomberg Technology | 51 |
| Yahoo Finance | 41 |
| Morningstar | 10 |
| Wall Street Journal | 3 |
| After Earnings | 3 |
| The Street | 8 |

---

## Publisher별 링크 스크래핑 가능성 분류 (참고용, 초기 분석)

> 아래 분류는 초기 분석 시점의 가정이며, 2026-03-27 recheck로 대거 수정되었다.  
> 실제 최종 상태는 위 "최종 상태" 섹션을 참고할 것.  
> **주요 recheck 결과:** Seeking Alpha, InvestorPlace, Motley Fool, Deadline, CNET, The Guardian, Finbold, Fox Business, New York Post, ETF Trends, Kitco는 이전에 "차단/페이월"로 잘못 분류되었으나 실제 HTTP 프로브 결과 추출 가능함이 확인되어 scraper 구현 완료.

---

## 즉시 수정 가능 항목 (버그 수준)

### Fix-1: TheNewswire switch case 누락
- **파일**: `terminal/backend/src/services/fulltextExtractors.ts`
- **문제**: `FMP_STOCK_NEWS_SCRAPE_PUBLISHERS`에 `"THENEWSWIRE"`가 등록됐으나 `extractByDomain` switch에 case가 없어 body-fallback으로 빠짐
- **수정**: switch에 `case "THENEWSWIRE":` 추가 + `extractTextViaHttp` 또는 별도 extractor 구현
- **URL 패턴**: `https://www.thenewswire.com/press-releases/...`

### Fix-2: Benzinga가 fmp_stock_news에서 body-fallback
- **파일**: `terminal/backend/src/services/fulltextExtractors.ts`
- **문제**: `extractBenzinga()` 함수 존재, `COMPANY_NEWS_SCRAPE_PUBLISHERS`에만 등록
- **수정**: `FMP_STOCK_NEWS_SCRAPE_PUBLISHERS`에 `"BENZINGA"` 추가 + switch case 연결

### Fix-3: Accesswire 403
- **파일**: `terminal/backend/src/services/fulltextExtractors.ts`
- **문제**: publisher "Accesswire", 실제 URL은 `accessnewswire.com`
- **조사 필요**: `extractAccesswire()` 내 selector가 accessnewswire.com에도 적용되는지 확인

---

## 신규 스크래퍼 구현 우선순위

### Priority 1 — 볼륨 大, 오픈 웹 (즉시 ROI 높음)

| 순서 | Publisher | 건수 합산 | 예상 난이도 |
|------|-----------|-----------|------------|
| 1 | Defense World | 15,433 | 낮음 — 전형적 HTML 사이트 |
| 2 | Zacks | 12,633 | 중간 — 무료 부분만 추출 |
| 3 | GuruFocus | 1,204 | 낮음 |
| 4 | 24/7 Wall Street + 247 Wallst | 1,324 | 낮음 — 동일 도메인 |
| 5 | Reuters | 925 | 중간 — JS 렌더링 |
| 6 | Proactive Investors (두 variant) | 764 | 낮음 |
| 7 | MarketBeat | 374 | 낮음 |
| 8 | CNBC | 360 | 중간 — JS 렌더링 |

### Priority 2 — 중간 볼륨, 소프트 페이월 (선택적)

| 순서 | Publisher | 건수 | 이슈 |
|------|-----------|------|------|
| 9 | The Motley Fool | 5,138 | 무료 기사만 추출 |
| 10 | Forbes | 398 | 메터 페이월 우회 |
| 11 | MarketWatch | 271 | 일부 오픈 |
| 12 | Investors Business Daily | 226 | 일부 오픈 |
| 13 | Investopedia | 220 | 오픈 |
| 14 | Schaeffersresearch | 216 | 오픈 |
| 15 | Invezz | 210 | 오픈 |

### Priority 3 — 소볼륨, 오픈 (장기)

TechCrunch, PYMNTS, Fox Business, InvestorPlace, Finbold, FXEmpire, New York Post, ETF Trends, Fast Company, Kitco, Deadline, GeekWire, CNET, The Guardian, Business Insider 등

---

## 스크래핑 방식 결정 기준

| 방식 | 사용 조건 | 예시 |
|------|-----------|------|
| `extractTextViaHttp` (cheerio) | 서버사이드 렌더링, 정적 HTML | GlobeNewsWire, PRNewsWire, Newsfile |
| `extractTextViaBrowser` (Playwright) | JS 렌더링 필요, SPA | Business Wire, Benzinga, Reuters |
| Custom API/GraphQL | 공개 API 존재 | TMX (GraphQL) |
| body-fallback 유지 | 페이월 강함 또는 YouTube | Seeking Alpha, WSJ, YouTube |

---

## 검증 방법 (publisher별 수동 확인)

각 신규 publisher 스크래퍼 추가 전 아래를 확인한다:

1. **URL 접근 가능 여부**: `curl -s -o /dev/null -w "%{http_code}" <sample_url>` → 200 이어야 함
2. **JS 렌더링 필요 여부**: `curl`로 받은 HTML에 기사 본문이 있는지 확인
3. **선택자 안정성**: 여러 기사 URL에서 동일 selector로 본문 추출 성공 여부 확인
4. **본문 최소 길이**: 200자 이상 텍스트가 안정적으로 추출되는지 확인
5. **페이월 감지**: 응답 HTML에 paywall/subscription/login 키워드 포함 여부

---

## 미확정 사항

| ID | 항목 | 선택지 | 차단 대상 |
|----|------|--------|-----------|
| D1 | Defense World selector | 직접 프로브 필요 | Priority 1-1 |
| D2 | Zacks 무료/유료 구분 | URL 패턴 or 응답 내 paywall 감지 | Priority 1-2 |
| D3 | CNBC JS 렌더링 수준 | HTTP 먼저 시도, 실패 시 Playwright | Priority 1-8 |
| D4 | Accesswire 403 원인 | accessnewswire.com selector 확인 필요 | Fix-3 |
| D5 | TheNewswire selector | 직접 프로브 필요 | Fix-1 |

---

## 구현 순서 제안

```
즉시 수정 (버그 수준):
  Fix-2: Benzinga FMP_STOCK_NEWS_SCRAPE_PUBLISHERS 등록 → switch 연결
  Fix-1: TheNewswire switch case 추가 + 간단 scraper
  Fix-3: Accesswire 403 원인 조사 + URL 패턴 수정

신규 스크래퍼 (Priority 1):
  1. Defense World (defenseworld.net)
  2. GuruFocus (gurufocus.com)
  3. 24/7 Wall Street / 247 Wallst (247wallst.com)
  4. Proactive Investors (proactiveinvestors.com)
  5. MarketBeat (marketbeat.com)
  6. Reuters (reuters.com) — Playwright
  7. CNBC (cnbc.com) — HTTP 먼저 시도
  8. Zacks 부분 추출 — paywall 미감지 기사만

패스 (body-fallback 유지):
  Seeking Alpha, WSJ, Barrons
  YouTube 계열 전체
```

---

## 범위 외

- Seeking Alpha, WSJ, Barrons: 페이월 우회 구현하지 않음
- YouTube URL: 동영상 자막 추출은 이 plan 범위 아님
- 기존 GlobeNewsWire / Business Wire / PRNewsWire / Newsfile 스크래퍼 품질 개선은 별도 plan
