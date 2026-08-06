/**
 * investingEarningsProvider.ts
 * Earning Calendar ver2 — Investing.com 실적 캘린더 수집.
 *
 * 왜 필요한가 (plan §1-6 실측):
 *   - 과거 날짜의 **매출 실적**을 주는 유일한 기간형 소스 (Nasdaq은 매출 필드 자체가 없음)
 *   - 과거 날짜의 **세션(BMO/AMC)** 을 98% 유지 (Nasdaq은 날짜가 지나면 time을 지움)
 *   - 2026-08-04 실측: 322행, EPS실적 97% / EPS예상 91% / 매출실적 98% / 매출예상 88% / 세션 98%
 *     ZETA 세션 = "After market close" → SEC EDGAR 8-K 접수 16:05 ET와 일치
 *
 * 주의 (plan §1-6 리스크):
 *   1. 예상치/실적 셀에 고유 클래스가 없어 **위치 기반 파싱**이다. 레이아웃이 바뀌면
 *      조용히 틀린 값이 들어오므로, 파싱 시 형태 검증을 하고 이상하면 그 행을 버린다.
 *   2. **EPS 기준(GAAP vs adjusted)이 행 안에서 섞일 수 있다.** ZETA 2026-08-04:
 *      실적 0.03(GAAP) / 예상 0.1995(non-GAAP) → 서프라이즈를 계산하면 엉터리가 된다.
 *      따라서 이 provider는 surprise를 **계산하지 않고**, 원본 값만 넘긴다.
 *   3. 넓은 날짜 범위를 한 번에 요청하면 403이 뜬다(실측). **일자별 요청 + 간격**이 필수다.
 *
 * 요청 간격/재시도/차단 대응은 investingNewsProvider.ts와 동일한 방식을 따른다.
 */

import { getInvestingBrowserContext, isCloudflareChallengeText } from "./investingBrowser.js";

const ENDPOINT = "https://www.investing.com/earnings-calendar/Service/getCalendarFilteredData";
const CALENDAR_URL = "https://www.investing.com/earnings-calendar/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";

/** country[]=5 = United States */
const US_COUNTRY_ID = "5";

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 800;
const MAX_BACKOFF_MS = 30_000;

const DEFAULT_REQUEST_INTERVAL_MS = 1200;
const MAX_REQUEST_INTERVAL_MS = 15_000;
/** 403이 뜰 때마다 이후 모든 요청에 더해지는 추가 지연. */
const BLOCK_EXTRA_DELAY_STEP_MS = 2_000;
const BLOCK_EXTRA_DELAY_MAX_MS = 20_000;

export interface InvestingEarningsRow {
  ticker: string;
  reportDate: string;
  companyName: string | null;
  timeOfDay: "BMO" | "AMC" | null;
  epsActual: number | null;
  epsForecast: number | null;
  revenueActual: number | null;
  revenueForecast: number | null;
  marketCap: number | null;
}

export interface InvestingSweepOptions {
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  onLog?: (message: string) => void;
  shouldCancel?: () => boolean;
}

export function clampInvestingIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_REQUEST_INTERVAL_MS;
  return Math.max(300, Math.min(MAX_REQUEST_INTERVAL_MS, Math.floor(value as number)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** "1.66", "-0.12", "(0.12)", "11.54B", "790.38B", "--" → 숫자 */
function parseNumeric(raw: string): number | null {
  const text = raw.replace(/^\//, "").trim();
  if (!text || text === "--" || text === "-" || text === "N/A") return null;

  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[()$,%\s]/g, "");
  const match = /^(-?\d+(?:\.\d+)?)([KMBT])?$/i.exec(cleaned);
  if (!match) return null;

  let value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const unit = match[2]?.toUpperCase();
  if (unit) {
    const scale = unit === "K" ? 1e3 : unit === "M" ? 1e6 : unit === "B" ? 1e9 : 1e12;
    // 33.51 * 1e9 = 33509999999.999996 같은 부동소수 찌꺼기를 없앤다.
    value = Math.round(value * scale);
  }

  return negative ? -Math.abs(value) : value;
}

function parseSession(rowHtml: string): "BMO" | "AMC" | null {
  if (rowHtml.includes("After market close")) return "AMC";
  if (rowHtml.includes("Before market open")) return "BMO";
  return null;
}

/**
 * 한 행을 파싱한다.
 *
 * 순수 위치 기반은 위험하다 — 컬럼이 하나만 추가돼도 조용히 다른 값이 들어온다.
 * 다행히 실적 셀에는 식별 가능한 클래스가 있다:
 *   <td class=" pid-941850-2026-08-06-062026-eps_actual">--</td>
 *   <td class="leftStrong">/&nbsp;&nbsp;3.07</td>          ← 예상치 (클래스 없음, 실적 셀 바로 다음)
 *   <td class=" pid-...-rev_actual ">--</td>
 *   <td class="leftStrong">/&nbsp;&nbsp;4.6B</td>
 *   <td class="right">163.06B</td>                          ← 시가총액
 *   <td class="right time" ...>                             ← 세션 아이콘
 *
 * 따라서 **실적 셀을 클래스로 찾고, 예상치는 그 바로 다음 셀**로 잡는다.
 * 앵커를 못 찾으면 행을 버린다 → 레이아웃이 바뀌면 값이 틀리는 게 아니라 수집량이 0으로 떨어져
 * 눈에 띈다. 앵커가 밀린 경우에도 예상치는 null이 될 뿐 다른 컬럼 값이 섞이지 않는다.
 */
function parseRow(rowHtml: string, date: string): InvestingEarningsRow | null {
  if (!rowHtml.includes("earnCalCompany")) return null;

  const cells = Array.from(rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)).map((m) => ({
    attrs: m[1] ?? "",
    html: m[2] ?? "",
  }));
  if (cells.length < 5) return null;

  const companyIndex = cells.findIndex((c) => c.attrs.includes("earnCalCompany"));
  if (companyIndex < 0) return null;

  const tickerMatch = /<a[^>]+href="\/equities\/[^"]*"[^>]*>([A-Z0-9.\-]{1,8})<\/a>/.exec(cells[companyIndex].html);
  if (!tickerMatch) return null;
  const ticker = tickerMatch[1].toUpperCase();
  const nameMatch = /class="earnCalCompanyName[^"]*"[^>]*>([^<]+)</.exec(cells[companyIndex].html);

  const epsIndex = cells.findIndex((c) => /-eps_actual\s*"/.test(c.attrs) || /-eps_actual\b/.test(c.attrs));
  const revIndex = cells.findIndex((c) => /-rev_actual\s*"/.test(c.attrs) || /-rev_actual\b/.test(c.attrs));
  // 실적 앵커가 없으면 레이아웃이 바뀐 것이다. 추측하지 않고 버린다.
  if (epsIndex < 0 || revIndex < 0) return null;

  const cellText = (index: number) => (index >= 0 && index < cells.length ? stripTags(cells[index].html) : "");

  // 시가총액 = 매출 예상치 다음의 class="right" 셀 (time 셀은 제외)
  let marketCapIndex = -1;
  for (let i = revIndex + 1; i < cells.length; i++) {
    if (/class="[^"]*\bright\b[^"]*"/.test(cells[i].attrs) && !/\btime\b/.test(cells[i].attrs)) {
      marketCapIndex = i;
      break;
    }
  }

  return {
    ticker,
    reportDate: date,
    companyName: nameMatch ? nameMatch[1].trim() : null,
    timeOfDay: parseSession(rowHtml),
    epsActual: parseNumeric(cellText(epsIndex)),
    epsForecast: parseNumeric(cellText(epsIndex + 1)),
    revenueActual: parseNumeric(cellText(revIndex)),
    revenueForecast: parseNumeric(cellText(revIndex + 1)),
    marketCap: parseNumeric(cellText(marketCapIndex)),
  };
}

/** 응답 HTML 조각에서 행들을 파싱한다. (테스트에서 직접 호출할 수 있도록 export) */
export function parseInvestingEarningsHtml(html: string, date: string): InvestingEarningsRow[] {
  const rows: InvestingEarningsRow[] = [];
  for (const match of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const parsed = parseRow(match[1], date);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

interface BlockState {
  extraDelayMs: number;
  useBrowser: boolean;
}

function buildBody(date: string): string {
  const params = new URLSearchParams();
  params.append("country[]", US_COUNTRY_ID);
  params.append("dateFrom", date);
  params.append("dateTo", date);
  params.append("currentTab", "custom");
  params.append("limit_from", "0");
  return params.toString();
}

/** 브라우저 컨텍스트로 같은 POST를 던진다 (Cloudflare 403 폴백). */
async function fetchDayViaBrowser(date: string): Promise<string> {
  const context = await getInvestingBrowserContext();
  const page = await context.newPage();
  try {
    await page.goto(CALENDAR_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const body = buildBody(date);
    return await page.evaluate(
      async ({ endpoint, payload }) => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: payload,
          credentials: "include",
        });
        return await res.text();
      },
      { endpoint: ENDPOINT, payload: body },
    );
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchDay(
  date: string,
  state: BlockState,
  onLog?: (message: string) => void,
): Promise<InvestingEarningsRow[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let text: string;

      if (state.useBrowser) {
        text = await fetchDayViaBrowser(date);
      } else {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: CALENDAR_URL,
          },
          body: buildBody(date),
        });

        if (res.status === 403 || res.status === 429 || res.status === 503) {
          // 차단됨 — 이후 모든 요청을 늦추고 브라우저 경로로 전환한다.
          state.extraDelayMs = Math.min(BLOCK_EXTRA_DELAY_MAX_MS, state.extraDelayMs + BLOCK_EXTRA_DELAY_STEP_MS);
          if (!state.useBrowser) {
            state.useBrowser = true;
            onLog?.(`[investing-earnings] HTTP ${res.status} — 브라우저 경로로 전환, 지연 +${state.extraDelayMs}ms`);
          }
          await sleep(Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** (attempt - 1)));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      }

      if (isCloudflareChallengeText(text)) {
        state.useBrowser = true;
        state.extraDelayMs = Math.min(BLOCK_EXTRA_DELAY_MAX_MS, state.extraDelayMs + BLOCK_EXTRA_DELAY_STEP_MS);
        await sleep(Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** (attempt - 1)));
        continue;
      }

      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`JSON 파싱 실패 (응답 ${text.length}바이트)`);
      }
      if (typeof payload !== "object" || payload == null) {
        throw new Error(`예상치 못한 응답: ${String(payload).slice(0, 40)}`);
      }

      const html: string = typeof payload.data === "string" ? payload.data : "";
      return parseInvestingEarningsHtml(html, date);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await sleep(Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * 지정 기간을 일자별로 훑는다.
 *
 * 넓은 범위를 한 번에 요청하면 403이 되므로(실측) 반드시 하루씩 나눠 부른다.
 * 요청 사이에는 기본 간격 + 지터를 둔다 (일정한 간격 자체가 봇 신호가 된다).
 */
export async function sweepInvestingEarningsRange(params: {
  from: string;
  to: string;
  universe?: Set<string>;
  options?: InvestingSweepOptions;
}): Promise<{
  rows: InvestingEarningsRow[];
  scannedDays: number;
  failedDays: string[];
  totalRowsSeen: number;
  usedBrowser: boolean;
}> {
  const options = params.options ?? {};
  const intervalMs = clampInvestingIntervalMs(options.requestIntervalMs);
  const state: BlockState = { extraDelayMs: 0, useBrowser: false };

  const dates: string[] = [];
  let cursor = Date.parse(`${params.from}T00:00:00Z`);
  const end = Date.parse(`${params.to}T00:00:00Z`);
  while (Number.isFinite(cursor) && Number.isFinite(end) && cursor <= end) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(new Date(cursor).toISOString().slice(0, 10));
    }
    cursor += 86_400_000;
  }

  const rows: InvestingEarningsRow[] = [];
  const failedDays: string[] = [];
  let totalRowsSeen = 0;

  // 병렬 금지 — 차단을 부른다. 순차 + 간격이 유일하게 안전한 방식이다.
  for (let index = 0; index < dates.length; index++) {
    if (options.shouldCancel?.()) break;
    const date = dates[index];

    if (index > 0) {
      const base = intervalMs + state.extraDelayMs;
      await sleep(base + Math.floor(Math.random() * intervalMs * 0.5));
    }

    try {
      const dayRows = await fetchDay(date, state, options.onLog);
      totalRowsSeen += dayRows.length;
      for (const row of dayRows) {
        if (params.universe && !params.universe.has(row.ticker)) continue;
        rows.push(row);
      }
    } catch (error) {
      failedDays.push(date);
      options.onLog?.(
        `[investing-earnings] ${date} 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    options.onProgress?.(index + 1, dates.length);
  }

  return { rows, scannedDays: dates.length, failedDays, totalRowsSeen, usedBrowser: state.useBrowser };
}
