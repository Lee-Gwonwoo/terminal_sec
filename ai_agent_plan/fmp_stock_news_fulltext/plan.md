# FMP Stock News — Publisher별 원문 링크 스크래핑 가능성 점검

## 목적
FMP stock news 각 publisher의 URL을 따라가서 기사 본문(fulltext)을 다운받는 것이 가능한지 점검한다.
현재 대다수 publisher는 FMP API가 내려주는 snippet(body-fallback, 평균 40~100 단어)만 저장 중이다.
이 plan은 링크 스크래핑으로 전문을 얻을 수 있는 대상과 불가 대상을 확정하고 구현 우선순위를 정하는 것이 목적이다.

## 최종 상태 (2026-03-27 구현 완료)

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
| Nasdaq / TMX | 가변 | 기존 scraper | (기존) |
| SEC/EDGAR | 가변 | `sec-edgar-fetch` | (기존) |
| MCAP MediaWire / Accesswire | 가변 | 기존 scraper | (기존, Accesswire는 403 빈발) |

### 차단됨 — scraper 구현 불가

| Publisher | 사유 | HTTP status | 비고 |
|-----------|------|-------------|------|
| GuruFocus | 403 차단 | 403 | Cloudflare 방어 |
| MarketBeat | 403 차단 | 403 | |
| Reuters | 401 인증 필요 | 401 | |
| Invezz | 403 차단 | 403 | Cloudflare |
| Investopedia | 402 유료 | 402 | |
| Seeking Alpha | 페이월 | — | 로그인 필수 |
| Zacks | 대부분 유료 | 200 | article 1047c뿐, snippet 수준 |
| WSJ / Barrons | 페이월 | — | 강력한 구독 벽 |
| YouTube 계열 (CNBC Television 등) | 동영상 | — | 텍스트 추출 불가 |

---

### 스크래퍼 있으나 실패/미연결

| Publisher | DB 건수 | 실패 사유 | 상태 |
|-----------|---------|-----------|------|
| Accesswire | 232 | `body-fallback (accesswire-http-403)` | ⚠️ HTTP 403 — URL이 accessnewswire.com인데 accesswire.com 패턴으로 호출 중일 가능성 |
| TheNewswire | 61 | `body-fallback (no-scraper: THENEWSWIRE)` | ⚠️ `FMP_STOCK_NEWS_SCRAPE_PUBLISHERS`에 포함됐으나 `extractByDomain` switch case 누락 |
| MCAP MediaWire | 5 | body-fallback | ⚠️ 실제 URL이 prismmediawire.com, 스크래퍼 동작 여부 불확실 |
| Benzinga | 1,873 | `body-fallback (no-scraper: BENZINGA)` | ⚠️ 스크래퍼 코드는 존재하나 `FMP_STOCK_NEWS_SCRAPE_PUBLISHERS` 미등록 |

---

## Publisher별 링크 스크래핑 가능성 분류

### Group A — 오픈 웹, 스크래핑 가능성 높음

이 그룹은 URL을 따라 HTTP GET 또는 Playwright로 본문을 추출할 수 있을 가능성이 높다.

| Publisher | DB 건수 | 도메인 | body-fallback 평균 단어수 | 비고 |
|-----------|---------|--------|--------------------------|------|
| Defense World | 15,433 | defenseworld.net | ~54단어 | 기관 투자 포지션 변동 기사, 전형적 오픈 사이트 |
| 24/7 Wall Street | 1,042 | 247wallst.com | ~68단어 | 열린 사이트 |
| 247 Wallst | 282 | 247wallst.com | ~68단어 | 동일 도메인, publisher명만 다름 |
| MarketBeat | 374 | marketbeat.com | ~41단어 | 오픈 — 회원제이나 기사 본문은 대체로 접근 가능 |
| CNBC | 360 | cnbc.com | ~41단어 (snippet) | 기사 본문 오픈, JS 렌더링 필요할 수 있음 |
| Proactive Investors | 384 | proactiveinvestors.com | ~59단어 | 캐나다/글로벌 소형주 IR 뉴스, 오픈 |
| Proactive Investors - Finance | 380 | proactiveinvestors.com | ~59단어 | 동일 도메인 |
| Schaeffers Research | 216 | schaeffersresearch.com | ~41단어 | 오픈 |
| Invezz | 210 | invezz.com | ~46단어 | 오픈 |
| Investopedia | 220 | investopedia.com | ~41단어 | 오픈 |
| FXEmpire | 167 | fxempire.com | ~40단어 | 오픈 |
| GuruFocus | 1,204 | gurufocus.com | ~41단어 | 대부분 오픈, 일부 premium |
| InvestorPlace | 76 | investorplace.com | — | 오픈 |
| Finbold | 89 | finbold.com | — | 오픈 |
| TechCrunch | 95 | techcrunch.com | ~37단어 | 오픈 |
| PYMNTS | 134 | pymnts.com | ~39단어 | 오픈 |
| Fox Business | 61 | foxbusiness.com | — | 오픈 (일부 광고 heavy) |
| New York Post | 59 | nypost.com | — | 오픈 |
| GeekWire | 20 | geekwire.com | — | 오픈 |
| ETF Trends | 41 | etftrends.com | — | 오픈 |
| Fast Company | 39 | fastcompany.com | — | 오픈 |
| Kitco | 12 | kitco.com | — | 오픈 |
| MarijuanaStocks | 6 | marijuanastocks.com | — | 오픈 |

### Group B — 소프트 페이월 / JS 렌더링 필요 (조건부 가능)

| Publisher | DB 건수 | 도메인 | 상태 | 이슈 |
|-----------|---------|--------|------|------|
| The Motley Fool | 4,585 | fool.com | ⚠️ 일부 무료 | 프리미엄 기사 paywall, 무료 기사는 JS 렌더링으로 추출 가능 |
| Fool - Investing News | 553 | fool.com | ⚠️ 동일 | 동일 도메인 |
| Reuters | 925 | reuters.com | ⚠️ 일부 무료 | 대부분 무료 기사, JS-heavy, Playwright 필요 |
| Benzinga | 1,873 | benzinga.com | ⚠️ 스크래퍼 있음 | `extractBenzinga()` 구현 있음, FMP_STOCK_NEWS_SCRAPE_PUBLISHERS에만 추가하면 됨 |
| Forbes | 398 | forbes.com | ⚠️ 소프트 페이월 | 메터 페이월 우회 가능성 있음 |
| Market Watch | 271 | marketwatch.com | ⚠️ 제한적 | 일부 기사 오픈, 일부 구독 필요 |
| Business Insider | 71 | businessinsider.com | ⚠️ 소프트 | 일부 오픈 |
| CNET | 21 | cnet.com | ⚠️ 일부 무료 | 오픈 기사 위주 |
| The Guardian | 8 | theguardian.com | ✅ 오픈 | 전체 무료 |
| NYTimes | 23 | nytimes.com | ⚠️ 소프트 페이월 | 쿠키 기반 월 제한 |
| Deadline | 27 | deadline.com | ⚠️ 소프트 | 일부 무료 |
| Investors Business Daily | 226 | investors.com | ⚠️ 대부분 유료 | 일부 짧은 기사 오픈 |

### Group C — 하드 페이월 (스크래핑 불가)

| Publisher | DB 건수 | 도메인 | 이슈 |
|-----------|---------|--------|------|
| Seeking Alpha | 5,743 | seekingalpha.com | 로그인 필수, 페이월 강함 |
| Zacks Investment Research | 12,633 | zacks.com | 프리미엄 기사 대다수, 공개 부분은 snippet 수준 |
| WSJ | 352 | wsj.com | 강력한 페이월 |
| Barrons | 389 | barrons.com | WSJ와 동일 구독 구조 |

> **참고**: Zacks는 일부 무료 콘텐츠(stock rank 설명 등)가 있지만 실제 애널리시스 기사는 거의 유료다.

### Group D — YouTube 동영상 (텍스트 추출 불가)

| Publisher | DB 건수 | 비고 |
|-----------|---------|------|
| Schwab Network | 261 | YouTube |
| CNBC Television | 230 | YouTube Shorts |
| Bloomberg Markets and Finance | 75 | YouTube Shorts |
| Bloomberg Technology | 51 | YouTube Shorts |
| Yahoo Finance | 41 | YouTube Shorts |
| Morningstar | 10 | YouTube |
| Wall Street Journal | 3 | YouTube Shorts |
| After Earnings | 3 | YouTube |
| The Street | 8 | YouTube Shorts |

> 이 그룹은 텍스트 전문 추출이 구조적으로 불가능하다. body-fallback(제목+snippet) 유지.

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
