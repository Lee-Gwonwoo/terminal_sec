/**
 * finnhubIpoCalendarProvider.ts
 * IPO 공모가 수집 — FMP `ipos-calendar`가 402(Restricted Endpoint)로 막힌 것의 대체.
 *
 * 소스 선택 근거 (2026-08-05 실측):
 *   FMP  /stable/ipos-calendar     → HTTP 402 Restricted Endpoint (구독 불가)
 *   Finnhub /calendar/ipo          → 무료 티어에서 **과거까지 열림** (2022 Q1 163건, 2024 Q1 84건, 2025 Q1 111건)
 *                                     price가 확정가("18.00") / 범위("15.00-17.00")로 구분돼 옴
 *   Nasdaq /api/ipo/calendar?date= → 무키, 월 단위. priced/filed/withdrawn 분리 제공 (교차검증용)
 *
 * Finnhub을 주 소스로 쓴다. 날짜 범위 한 번에 조회되고 status가 명시돼 있어
 * 확정 공모가와 예상 범위를 안전하게 나눌 수 있기 때문이다.
 */

import { config } from "../config.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1/calendar/ipo";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_BACKOFF_MS = 20_000;

/** 한 요청이 커버할 일수. 실측상 3개월 152건이라 응답 상한에 여유가 있다. */
const CHUNK_DAYS = 90;
const DEFAULT_REQUEST_INTERVAL_MS = 300;

export type IpoDealStatus = "priced" | "expected" | "filed" | "withdrawn" | "unknown";

export interface FinnhubIpoRow {
  ticker: string;
  /** 공모일/상장일 */
  date: string;
  companyName: string | null;
  exchange: string | null;
  status: IpoDealStatus;
  /** status='priced'인 단일가만 확정 공모가로 인정한다. */
  offerPrice: number | null;
  /** "15.00-17.00" 또는 확정 전 단일 예상가 */
  priceRange: string | null;
  numberOfShares: number | null;
  totalSharesValue: number | null;
  raw: Record<string, unknown>;
}

export interface IpoSweepOptions {
  requestIntervalMs?: number;
  onProgress?: (done: number, total: number) => void;
  onLog?: (message: string) => void;
  shouldCancel?: () => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStatus(value: unknown): IpoDealStatus {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "priced" || text === "expected" || text === "filed" || text === "withdrawn") return text;
  return "unknown";
}

/**
 * Finnhub `price` 필드를 확정 공모가 / 예상 범위로 나눈다.
 *
 * - "18.00" + status=priced  → 확정 공모가
 * - "15.00-17.00"            → 범위 (확정 아님)
 * - "18.00" + status!=priced → 아직 확정 전이므로 범위 칸에 넣는다
 */
function splitPrice(rawPrice: unknown, status: IpoDealStatus): { offerPrice: number | null; priceRange: string | null } {
  const text = toNullableString(rawPrice);
  if (!text) return { offerPrice: null, priceRange: null };

  if (text.includes("-")) {
    return { offerPrice: null, priceRange: text };
  }

  const value = toNullableNumber(text);
  if (value == null) return { offerPrice: null, priceRange: text };

  if (status === "priced") {
    return { offerPrice: value, priceRange: null };
  }
  return { offerPrice: null, priceRange: text };
}

function buildChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(cursor) || !Number.isFinite(end) || cursor > end) return chunks;

  while (cursor <= end) {
    const chunkEnd = Math.min(end, cursor + (CHUNK_DAYS - 1) * 86_400_000);
    chunks.push({
      from: new Date(cursor).toISOString().slice(0, 10),
      to: new Date(chunkEnd).toISOString().slice(0, 10),
    });
    cursor = chunkEnd + 86_400_000;
  }
  return chunks;
}

async function fetchChunk(from: string, to: string, onLog?: (m: string) => void): Promise<FinnhubIpoRow[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${FINNHUB_BASE}?from=${from}&to=${to}&token=${encodeURIComponent(config.finnhubApiKey)}`;
      const res = await fetch(url);
      if (res.status === 429) {
        await sleep(Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = (await res.json()) as { ipoCalendar?: unknown };
      const items = Array.isArray(payload?.ipoCalendar) ? payload.ipoCalendar : [];
      const rows: FinnhubIpoRow[] = [];

      for (const item of items as Array<Record<string, unknown>>) {
        const ticker = toNullableString(item.symbol)?.toUpperCase();
        // 티커가 아직 배정되지 않은 filed 건은 매칭할 수 없으므로 버린다.
        if (!ticker) continue;

        const status = normalizeStatus(item.status);
        const { offerPrice, priceRange } = splitPrice(item.price, status);

        rows.push({
          ticker,
          date: toNullableString(item.date) ?? from,
          companyName: toNullableString(item.name),
          exchange: toNullableString(item.exchange),
          status,
          offerPrice,
          priceRange,
          numberOfShares: toNullableNumber(item.numberOfShares),
          totalSharesValue: toNullableNumber(item.totalSharesValue),
          raw: item,
        });
      }
      return rows;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await sleep(Math.min(MAX_BACKOFF_MS, BASE_DELAY_MS * 2 ** attempt));
    }
  }

  onLog?.(`[finnhub-ipo] ${from}~${to} 실패: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * 지정 기간의 IPO 딜을 훑어 티커별로 모은다.
 * 같은 티커가 filed → priced로 여러 번 등장하므로 **status='priced'인 건을 우선**한다.
 */
export async function sweepFinnhubIpoCalendar(params: {
  from: string;
  to: string;
  options?: IpoSweepOptions;
}): Promise<{
  byTicker: Map<string, FinnhubIpoRow>;
  totalRows: number;
  chunks: number;
  failedChunks: Array<{ from: string; to: string }>;
}> {
  const options = params.options ?? {};
  const intervalMs = Number.isFinite(options.requestIntervalMs)
    ? Math.max(0, options.requestIntervalMs as number)
    : DEFAULT_REQUEST_INTERVAL_MS;

  const chunks = buildChunks(params.from, params.to);
  const byTicker = new Map<string, FinnhubIpoRow>();
  const failedChunks: Array<{ from: string; to: string }> = [];
  let totalRows = 0;

  for (let index = 0; index < chunks.length; index++) {
    if (options.shouldCancel?.()) break;
    const chunk = chunks[index];
    if (index > 0 && intervalMs > 0) await sleep(intervalMs);

    try {
      const rows = await fetchChunk(chunk.from, chunk.to, options.onLog);
      totalRows += rows.length;
      for (const row of rows) {
        const existing = byTicker.get(row.ticker);
        if (!existing) {
          byTicker.set(row.ticker, row);
          continue;
        }
        // priced가 filed/expected를 이긴다. 같은 등급이면 나중 날짜가 이긴다.
        const existingPriced = existing.status === "priced";
        const incomingPriced = row.status === "priced";
        if ((incomingPriced && !existingPriced) || (incomingPriced === existingPriced && row.date > existing.date)) {
          byTicker.set(row.ticker, row);
        }
      }
    } catch {
      failedChunks.push(chunk);
    }

    options.onProgress?.(index + 1, chunks.length);
  }

  return { byTicker, totalRows, chunks: chunks.length, failedChunks };
}
