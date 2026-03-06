import { config } from "../config.js";
import { getDb } from "../db.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Types ----------

export type FinnhubMappedItem = {
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  providerTickers: string[];
  tags: string[];
};

// ---------- Helpers ----------

function toIsoDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);

      // Rate limited — back off and retry
      if (res.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Finnhub rate limit (429) after ${MAX_RETRIES} retries`);
        }
        const retryAfter = Number(res.headers.get("retry-after") || "1");
        await sleep(Math.max(retryAfter * 1000, BASE_DELAY_MS * attempt));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Finnhub ${res.status}: ${text}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
}

// ---------- Incremental anchor ----------

async function getLastPublishedAt(sourceType: string): Promise<string | null> {
  const row = await getDb().get<{ max_pub: string | null }>(
    `SELECT MAX(published_at) AS max_pub FROM news_items WHERE source = 'FINNHUB' AND source_type = ?`,
    [sourceType],
  );
  return row?.max_pub ?? null;
}

function computeFromDate(lastPublished: string | null, lookbackDays: number): string {
  if (lastPublished) {
    // Start from the day of last published item (may re-fetch same day — deduped by INSERT OR IGNORE)
    const d = new Date(lastPublished);
    return formatDate(d);
  }
  // First time: lookback N days
  const d = new Date();
  d.setDate(d.getDate() - lookbackDays);
  return formatDate(d);
}

// ---------- Company News (/company-news) ----------

export async function pullCompanyNews(
  symbol: string,
  fromOverride?: string,
  toOverride?: string,
): Promise<FinnhubMappedItem[]> {
  const lastPub = await getLastPublishedAt("company_news");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? formatDate(new Date());

  const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);

  if (!Array.isArray(raw)) return [];

  return raw.map((item: any) => ({
    publishedAt: item.datetime ? toIsoDate(item.datetime) : new Date().toISOString(),
    source: "FINNHUB",
    sourceType: "company_news",
    title: item.headline ?? "(untitled)",
    body: item.summary ?? "",
    url: item.url ?? "",
    providerTickers: item.related
      ? item.related
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .filter(Boolean)
      : [symbol.toUpperCase()],
    tags: item.category ? [item.category.toLowerCase()] : [],
  }));
}

// ---------- Press Releases (/press-releases) ----------

export async function pullPressReleases(
  symbol: string,
  fromOverride?: string,
  toOverride?: string,
): Promise<FinnhubMappedItem[]> {
  const lastPub = await getLastPublishedAt("press_release");
  const from = fromOverride ?? computeFromDate(lastPub, 7);
  const to = toOverride ?? formatDate(new Date());

  const url = `${FINNHUB_BASE}/press-releases?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);

  // press-releases returns { symbol, majorDevelopment: [...] }
  const items: any[] = raw?.majorDevelopment ?? raw?.pressReleases ?? [];
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    publishedAt: item.datetime ?? new Date().toISOString(),
    source: "FINNHUB",
    sourceType: "press_release",
    title: item.headline ?? item.description ?? "(untitled)",
    body: item.description ?? item.headline ?? "",
    url: item.url ?? "",
    providerTickers: [symbol.toUpperCase()],
    tags: item.category ? [item.category.toLowerCase()] : ["press_release"],
  }));
}
