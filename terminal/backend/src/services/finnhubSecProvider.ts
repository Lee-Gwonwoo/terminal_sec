import { config } from "../config.js";
import { getDb } from "../db.js";
import { getEtDateString } from "./timeUtils.js";
import type { FinnhubMappedItem } from "./finnhubNewsProvider.js";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

// ---------- Types ----------

/** Raw shape returned by Finnhub GET /stock/filings */
export interface FinnhubSecFilingRaw {
  accessNumber: string;
  symbol: string;
  cik: string;
  form: string;
  filedDate: string;      // YYYY-MM-DD
  acceptedDate: string;    // YYYY-MM-DD HH:mm:ss
  reportUrl: string;
  filingUrl: string;
}

/** Internal mapped item for SEC filings (extends FinnhubMappedItem + SEC extras) */
export interface SecFilingMappedItem extends FinnhubMappedItem {
  accessionNumber: string;
  cik: string;
  formType: string;
  filedAt: string;
  acceptedAt: string;
  reportUrl: string;
  filingUrl: string;
  rawJson: string;
}

// ---------- Rate limiter (shared with finnhubNewsProvider via same token pool) ----------
// NOTE: We reuse the same global Finnhub rate limit. Since both providers
// share the same API key, the rate-limit token bucket in finnhubNewsProvider
// applies. For SEC-specific calls (low volume), a simpler per-request delay suffices.

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);

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

// ---------- Fetch + Map ----------

/**
 * Fetch SEC filings for a single symbol from Finnhub.
 * Maps to internal SecFilingMappedItem[].
 */
export async function fetchSecFilingsRaw(
  symbol: string,
  from: string,
  to: string,
): Promise<SecFilingMappedItem[]> {
  const url = `${FINNHUB_BASE}/stock/filings?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const raw = await fetchWithRetry(url);
  if (!Array.isArray(raw)) return [];

  return raw.map((item: FinnhubSecFilingRaw) => {
    const formType = item.form ?? "UNKNOWN";
    const ticker = (item.symbol || symbol).toUpperCase();
    // Synthetic title: "FORM - TICKER"
    const title = `${formType} - ${ticker}`;
    // Subtitle info as body (show date-only for filedDate, keep acceptedDate as-is)
    const filedDisplay = (item.filedDate ?? "N/A").slice(0, 10);
    const body = `Filed ${filedDisplay} · Accepted ${item.acceptedDate ?? "N/A"} · Accession ${item.accessNumber ?? "N/A"}`;
    // Use accession number as dedup key in the URL field (UNIQUE(source, url))
    const dedupUrl = `sec-filing://${item.accessNumber}`;

    return {
      publishedAt: item.filedDate
        ? (item.filedDate.includes("T") || item.filedDate.includes(" ")
            ? item.filedDate
            : `${item.filedDate}T00:00:00`)
        : new Date().toISOString(),
      source: "FINNHUB",
      sourceType: "sec_filing",
      title,
      body,
      url: dedupUrl,
      providerTickers: [ticker],
      tags: [formType.toLowerCase()],
      publisher: "SEC",
      // SEC-specific extras
      accessionNumber: item.accessNumber ?? "",
      cik: item.cik ?? "",
      formType,
      filedAt: item.filedDate ?? "",
      acceptedAt: item.acceptedDate ?? "",
      reportUrl: item.reportUrl ?? "",
      filingUrl: item.filingUrl ?? "",
      rawJson: JSON.stringify(item),
    };
  });
}

// ---------- Dedup / Companion table helpers ----------

/**
 * Insert a SEC filing companion row. Called after the parent news_item is inserted.
 * Returns true if inserted, false if accession_number already exists.
 */
export async function insertSecFiling(newsId: string, item: SecFilingMappedItem): Promise<boolean> {
  const result = await getDb().run(
    `INSERT OR IGNORE INTO sec_filings
      (news_id, accession_number, cik, form_type, filed_at, accepted_at, report_url, filing_url, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newsId,
      item.accessionNumber,
      item.cik,
      item.formType,
      item.filedAt,
      item.acceptedAt,
      item.reportUrl,
      item.filingUrl,
      item.rawJson,
    ],
  );
  return (result.changes ?? 0) > 0;
}

// ---------- Anchor map (recent mode) ----------

/**
 * Returns Map of ticker → latest filed_at for SEC filings.
 * Used to compute the "from" date for recent (incremental) pulls.
 */
export async function getSecFilingAnchorMap(): Promise<Map<string, string>> {
  const rows = await getDb().all<{ tickers_csv: string; max_pub: string }[]>(
    `SELECT tickers_csv, MAX(published_at) as max_pub
     FROM news_items
     WHERE source = 'FINNHUB' AND source_type = 'sec_filing'
     GROUP BY tickers_csv`,
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    const tickers = row.tickers_csv
      .split(",")
      .map((s: string) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const t of tickers) {
      const existing = map.get(t);
      if (!existing || row.max_pub > existing) {
        map.set(t, row.max_pub);
      }
    }
  }
  return map;
}
