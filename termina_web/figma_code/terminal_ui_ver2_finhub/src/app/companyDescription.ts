export const OPEN_COMPANY_DESCRIPTION_EVENT = 'open-company-description';

export interface CompanyDescriptionWindowData {
  ticker: string;
}

export interface CompanyProfileData {
  ticker: string;
  source: string | null;
  description: string | null;
  shortDescription: string | null;
  enhancedDescription: string | null;
  products: string[];
  revenueModel: string[];
  keyMetrics: string[];
  watchPoints: string[];
  risks: string[];
  peerGroups: CompanyPeerGroup[];
  enrichmentTags: string[];
  website: string | null;
  ceo: string | null;
  ipoDate: string | null;
  marketCap: number | null;
}

export interface CompanyPeerGroup {
  category: string;
  label: string;
  tickers: string[];
  companies: string[];
  note?: string;
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
    if (cachedProfile?.description || cachedProfile?.enhancedDescription) {
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
    shortDescription: typeof data?.short_description === 'string' && data.short_description.trim() ? data.short_description.trim() : null,
    enhancedDescription: typeof data?.enhanced_description === 'string' && data.enhanced_description.trim() ? data.enhanced_description.trim() : null,
    products: normalizeStringArray(data?.products),
    revenueModel: normalizeStringArray(data?.revenue_model),
    keyMetrics: normalizeStringArray(data?.key_metrics),
    watchPoints: normalizeStringArray(data?.watch_points),
    risks: normalizeStringArray(data?.risks),
    peerGroups: normalizePeerGroups(data?.peer_groups),
    enrichmentTags: normalizeStringArray(data?.enrichment_tags),
    website: typeof data?.website === 'string' && data.website ? data.website : null,
    ceo: typeof data?.ceo === 'string' && data.ceo ? data.ceo : null,
    ipoDate: typeof data?.ipo_date === 'string' && data.ipo_date ? data.ipo_date : null,
    marketCap: typeof data?.market_cap === 'number' && Number.isFinite(data.market_cap) ? data.market_cap : null,
  };

  profileCache.set(normalizedTicker, profile);
  return profile;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      continue;
    }
    seen.add(trimmed.toLowerCase());
    items.push(trimmed);
  }
  return items;
}

function normalizePeerGroups(value: unknown): CompanyPeerGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'other',
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : 'Other',
      tickers: normalizeStringArray(item.tickers),
      companies: normalizeStringArray(item.companies),
      note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
    }))
    .filter((group) => group.tickers.length > 0 || group.companies.length > 0 || group.note);
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