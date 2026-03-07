/**
 * fmpCompanyProfileProvider.ts
 * Financial Modeling Prep (FMP) API에서 company profile/description을 가져온다.
 * Endpoint: https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey=KEY
 */

import { config } from "../config.js";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 300;

export interface FmpProfile {
  symbol: string;
  companyName: string;
  description: string;
  ceo: string;
  sector: string;
  industry: string;
  website: string;
  ipoDate: string;
  mktCap: number;
  fullTimeEmployees: string;
  exchangeShortName: string;
  // full raw JSON preserved
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single ticker's profile from FMP.
 * Returns null if not found or API key missing.
 */
export async function fetchFmpProfile(ticker: string): Promise<FmpProfile | null> {
  const apiKey = config.fmpApiKey;
  if (!apiKey) {
    console.warn("[FMP] API key not configured, skipping fetchFmpProfile");
    return null;
  }

  const url = `${FMP_BASE}/profile?symbol=${encodeURIComponent(ticker.toUpperCase())}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        // rate limited — back off
        await sleep(BASE_DELAY_MS * attempt * 2);
        continue;
      }
      if (!resp.ok) {
        console.warn(`[FMP] profile ${ticker}: HTTP ${resp.status}`);
        return null;
      }
      const data = await resp.json() as Record<string, unknown>[];
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }
      const item = data[0];
      return {
        symbol: String(item.symbol ?? ticker),
        companyName: String(item.companyName ?? ""),
        description: String(item.description ?? ""),
        ceo: String(item.ceo ?? ""),
        sector: String(item.sector ?? ""),
        industry: String(item.industry ?? ""),
        website: String(item.website ?? ""),
        ipoDate: String(item.ipoDate ?? ""),
        mktCap: Number(item.mktCap ?? 0),
        fullTimeEmployees: String(item.fullTimeEmployees ?? ""),
        exchangeShortName: String(item.exchangeShortName ?? ""),
        raw: item,
      };
    } catch (err) {
      const isTransient = err instanceof TypeError; // network error
      if (!isTransient || attempt === MAX_RETRIES) {
        console.warn(`[FMP] profile ${ticker}: fetch failed after ${attempt} attempts:`, err);
        return null;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  return null;
}

/**
 * Fetch profiles for multiple tickers sequentially with rate-limit respect.
 * Returns a map of ticker → FmpProfile (only successful fetches).
 */
export async function fetchFmpProfilesBatch(
  tickers: string[],
  delayMs = 250,
): Promise<Map<string, FmpProfile>> {
  const results = new Map<string, FmpProfile>();
  for (const ticker of tickers) {
    const profile = await fetchFmpProfile(ticker);
    if (profile) {
      results.set(ticker.toUpperCase(), profile);
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return results;
}
