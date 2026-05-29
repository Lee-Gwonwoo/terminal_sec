export const OPEN_COMPANY_DESCRIPTION_EVENT = 'open-company-description';

export interface CompanyDescriptionWindowData {
  ticker: string;
}

export interface CompanyProfileData {
  ticker: string;
  source: string | null;
  description: string | null;
  website: string | null;
  ceo: string | null;
  ipoDate: string | null;
  marketCap: number | null;
}

const profileCache = new Map<string, CompanyProfileData | null>();

export function normalizeTickerSymbol(ticker: string): string {
  return String(ticker ?? '').trim().toUpperCase();
}

export function getCompanyTickerDataAttrs(ticker: string): { 'data-company-ticker'?: string } {
  const normalizedTicker = normalizeTickerSymbol(ticker);
  if (!normalizedTicker) {
    return {};
  }
  return { 'data-company-ticker': normalizedTicker };
}

export function dispatchOpenCompanyDescription(ticker: string): void {
  const normalizedTicker = normalizeTickerSymbol(ticker);
  if (!normalizedTicker) {
    return;
  }
  window.dispatchEvent(new CustomEvent<CompanyDescriptionWindowData>(OPEN_COMPANY_DESCRIPTION_EVENT, {
    detail: { ticker: normalizedTicker },
  }));
}

export async function fetchCompanyProfile(
  ticker: string,
  signal?: AbortSignal,
): Promise<CompanyProfileData | null> {
  const normalizedTicker = normalizeTickerSymbol(ticker);
  if (!normalizedTicker) {
    return null;
  }

  if (profileCache.has(normalizedTicker)) {
    const cachedProfile = profileCache.get(normalizedTicker) ?? null;
    if (cachedProfile?.description) {
      return cachedProfile;
    }
  }

  const response = await fetch(`/api/company-profiles/${encodeURIComponent(normalizedTicker)}`, { signal });
  if (response.status === 404) {
    profileCache.set(normalizedTicker, null);
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const profile: CompanyProfileData = {
    ticker: normalizedTicker,
    source: typeof data?.source === 'string' && data.source ? data.source : null,
    description: typeof data?.description === 'string' && data.description.trim() ? data.description.trim() : null,
    website: typeof data?.website === 'string' && data.website ? data.website : null,
    ceo: typeof data?.ceo === 'string' && data.ceo ? data.ceo : null,
    ipoDate: typeof data?.ipo_date === 'string' && data.ipo_date ? data.ipo_date : null,
    marketCap: typeof data?.market_cap === 'number' && Number.isFinite(data.market_cap) ? data.market_cap : null,
  };

  profileCache.set(normalizedTicker, profile);
  return profile;
}

export function formatCompanyMarketCap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}