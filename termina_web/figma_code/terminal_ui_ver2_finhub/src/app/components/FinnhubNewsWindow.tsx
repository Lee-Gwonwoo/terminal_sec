import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Save, FolderOpen, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw, Download, Columns3, Eye, X, Calendar, TrendingUp, Plus, Settings2, Square, CircleHelp } from 'lucide-react';
import type { DataControlHowToUseWindowData } from '../types';
import { VariableSizeList as List } from 'react-window';
import { BookmarkManager } from './BookmarkManager';
import { getCompanyTickerDataAttrs } from '../companyDescription';

const API_BASE = "";
const ET_TIME_ZONE = 'America/New_York';
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const ET_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// ─── Heights ───
const STICKY_DATE_HEADER_HEIGHT = 32;
const ROW_HEIGHT_TITLE_ONLY = 96;
const ROW_HEIGHT_WITH_ABSTRACT = 148;
const NEWS_PAGE_SIZE = 200;

// ─── Display mode ───
type DisplayMode = 'title-only' | 'title-abstract';
type NewsProjectionMode = 'full' | 'model1-safe';

// ─── Column definition ───
type ColumnId = 'date' | 'ticker' | 'time' | 'title' | 'publisher' | 'industry' | 'ipoDate' | 'marketCap' | 'floatPct' | 'institutionalPct' | 'insiderPct' | 'earningsDates' | 'source' | 'changes' | 'hv' | 'zscore' | 'fulltext' | 'keywords' | 'score' | 'scoreEvidence' | 'sentiment' | 'peers' | 'companyDesc';

interface ColumnDef {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  flex?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'date',         label: 'Date',       defaultWidth: 72,  minWidth: 50 },
  { id: 'ticker',       label: 'Ticker',     defaultWidth: 72,  minWidth: 48 },
  { id: 'time',         label: 'Time ET',    defaultWidth: 64,  minWidth: 52 },
  { id: 'title',        label: 'Title',      defaultWidth: 300, minWidth: 100, flex: true },
  { id: 'publisher',    label: 'Publisher',  defaultWidth: 96,  minWidth: 60 },
  { id: 'industry',     label: 'Industry',   defaultWidth: 110, minWidth: 60 },
  { id: 'ipoDate',      label: 'IPO Date',   defaultWidth: 96,  minWidth: 76 },
  { id: 'marketCap',    label: 'Market Cap', defaultWidth: 112, minWidth: 84 },
  { id: 'floatPct',     label: 'Float %',    defaultWidth: 90,  minWidth: 68 },
  { id: 'institutionalPct', label: 'Inst %', defaultWidth: 90,  minWidth: 68 },
  { id: 'insiderPct',   label: 'Insider %',  defaultWidth: 90,  minWidth: 68 },
  { id: 'earningsDates', label: 'Earnings Dates', defaultWidth: 220, minWidth: 160 },
  { id: 'source',       label: 'Sources',    defaultWidth: 90,  minWidth: 50 },
  { id: 'fulltext',     label: 'Full Text',  defaultWidth: 60,  minWidth: 40 },
  { id: 'changes',      label: 'Changes %',  defaultWidth: 280, minWidth: 160 },
  { id: 'hv',           label: 'HV',         defaultWidth: 280, minWidth: 160 },
  { id: 'zscore',       label: 'Z Score',    defaultWidth: 240, minWidth: 160 },
  { id: 'keywords',     label: 'Keywords',   defaultWidth: 160, minWidth: 80 },
  { id: 'score',        label: 'Score',      defaultWidth: 58,  minWidth: 40 },
  { id: 'scoreEvidence', label: 'Evidence',  defaultWidth: 200, minWidth: 80 },
  { id: 'sentiment',    label: 'Sentiment',  defaultWidth: 80,  minWidth: 50 },
  { id: 'peers',        label: 'Peers',      defaultWidth: 160, minWidth: 80 },
  { id: 'companyDesc',  label: 'Company Desc', defaultWidth: 200, minWidth: 100 },
];

// Columns hidden by default — user can enable via Columns menu
const HIDDEN_BY_DEFAULT: ColumnId[] = ['earningsDates', 'source', 'hv', 'zscore', 'keywords', 'score', 'scoreEvidence', 'sentiment', 'peers', 'companyDesc'];
const DEFAULT_VISIBLE: Set<ColumnId> = new Set(DEFAULT_COLUMNS.filter(c => !HIDDEN_BY_DEFAULT.includes(c.id)).map(c => c.id));
const MODEL1_HIDDEN_CHANGE_COLUMNS: ColumnId[] = ['changes', 'hv', 'zscore'];

// ─── Sort ───
type SortDir = 'asc' | 'desc' | null;
interface SortState { column: ColumnId | null; dir: SortDir; }

// ─── Source type filter ───
type SourceTypeFilter = 'all' | 'company_news' | 'press_release' | 'fmp_press_release' | 'fmp_stock_news' | 'fmp_sec_filing' | 'market_news';

function getSourceTypeLabel(sourceType: SourceTypeFilter | string): string {
  if (sourceType === 'company_news') return 'Company News';
  if (sourceType === 'press_release') return 'Press Release';
  if (sourceType === 'fmp_press_release') return 'FMP PR';
  if (sourceType === 'fmp_press_release_entire') return 'FMP PR (Entire)';
  if (sourceType === 'fmp_stock_news') return 'FMP Stock';
  if (sourceType === 'fmp_sec_filing') return 'FMP SEC';
  if (sourceType === 'market_news') return 'Market News';
  return 'All';
}

function getSourceTypeShortLabel(sourceType: SourceTypeFilter | string): string {
  if (sourceType === 'company_news') return 'Co.';
  if (sourceType === 'press_release') return 'PR';
  if (sourceType === 'fmp_press_release') return 'FMP PR';
  if (sourceType === 'fmp_press_release_entire') return 'FMP PR(E)';
  if (sourceType === 'fmp_stock_news') return 'FMP Stk';
  if (sourceType === 'fmp_sec_filing') return 'SEC';
  if (sourceType === 'market_news') return 'Mkt.';
  return 'All';
}

function getSourceTypeBadgeLabel(sourceType: string): string {
  return getSourceTypeLabel(sourceType);
}

function getSourceTypeBadgeClass(sourceType: string): string {
  if (sourceType === 'company_news') {
    return 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
  }
  if (sourceType === 'press_release') {
    return 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400';
  }
  if (sourceType === 'fmp_press_release') {
    return 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
  }
  if (sourceType === 'fmp_stock_news') {
    return 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
  }
  if (sourceType === 'fmp_sec_filing') {
    return 'bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300';
  }
  if (sourceType === 'market_news') {
    return 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
}

function getFinnhubTickerConcurrency(): number {
  try {
    const value = parseInt(localStorage.getItem('finnhub-ticker-concurrency') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 5;
  } catch {
    return 5;
  }
}

function getFinnhubRequestIntervalMs(): number {
  try {
    const value = parseFloat(localStorage.getItem('finnhub-request-interval-sec') ?? '');
    const safeValue = Number.isFinite(value) && value >= 0 && value <= 10 ? value : 1;
    return Math.round(safeValue * 1000);
  } catch {
    return 1000;
  }
}

function getCompanyNewsTickerConcurrency(): number {
  try {
    const raw = localStorage.getItem('finnhub-company-news-ticker-concurrency') ?? localStorage.getItem('finnhub-ticker-concurrency') ?? '';
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 5;
  } catch {
    return 5;
  }
}

function getCompanyNewsRequestIntervalMs(): number {
  try {
    const raw = localStorage.getItem('finnhub-company-news-request-interval-sec') ?? localStorage.getItem('finnhub-request-interval-sec') ?? '';
    const value = parseFloat(raw);
    const safeValue = Number.isFinite(value) && value >= 0 && value <= 10 ? value : 1;
    return Math.round(safeValue * 1000);
  } catch {
    return 1000;
  }
}

const DEFAULT_FT_CONCURRENCY = 200;
const DEFAULT_FMP_PR_FULLTEXT_CONCURRENCY = 10;
const DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY = 25;

function getFulltextConcurrency(): number {
  try {
    const value = parseInt(localStorage.getItem('ft-concurrency') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 200 ? value : DEFAULT_FT_CONCURRENCY;
  } catch {
    return DEFAULT_FT_CONCURRENCY;
  }
}

function getFmpPrFulltextConcurrency(): number {
  try {
    const raw = localStorage.getItem('fmp-pr-fulltext-concurrency') ?? localStorage.getItem('ft-concurrency') ?? '';
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value >= 1 && value <= 50 ? value : DEFAULT_FMP_PR_FULLTEXT_CONCURRENCY;
  } catch {
    return DEFAULT_FMP_PR_FULLTEXT_CONCURRENCY;
  }
}

function getFmpStockFulltextConcurrency(): number {
  try {
    const raw = localStorage.getItem('fmp-stock-fulltext-concurrency') ?? localStorage.getItem('ft-concurrency') ?? '';
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value >= 1 && value <= 200 ? value : DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY;
  } catch {
    return DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY;
  }
}

const DEFAULT_FMP_TICKER_CONCURRENCY = 10;
const DEFAULT_FMP_REQUEST_INTERVAL_MS = 25;
const DEFAULT_FMP_PR_PAGE_LIMIT = 100;
const DEFAULT_FMP_PR_MAX_PAGES = 12;
const DEFAULT_FMP_SEC_MAX_PAGES = 40;

function getFmpTickerConcurrency(): number {
  try {
    const value = parseInt(localStorage.getItem('fmp-concurrency') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 20 ? value : DEFAULT_FMP_TICKER_CONCURRENCY;
  } catch {
    return DEFAULT_FMP_TICKER_CONCURRENCY;
  }
}

function getFmpRequestIntervalMs(): number {
  try {
    const value = parseInt(localStorage.getItem('fmp-request-interval-ms') ?? '', 10);
    return Number.isFinite(value) && value >= 0 && value <= 5000 ? value : DEFAULT_FMP_REQUEST_INTERVAL_MS;
  } catch {
    return DEFAULT_FMP_REQUEST_INTERVAL_MS;
  }
}

function getFmpPrPageLimit(): number {
  try {
    const value = parseInt(localStorage.getItem('fmp-pr-page-limit') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 100 ? value : DEFAULT_FMP_PR_PAGE_LIMIT;
  } catch {
    return DEFAULT_FMP_PR_PAGE_LIMIT;
  }
}

function getFmpPrMaxPages(): number {
  try {
    const value = parseInt(localStorage.getItem('fmp-pr-max-pages') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 50 ? value : DEFAULT_FMP_PR_MAX_PAGES;
  } catch {
    return DEFAULT_FMP_PR_MAX_PAGES;
  }
}

function getFmpSecMaxPages(): number {
  try {
    const value = parseInt(localStorage.getItem('fmp-sec-max-pages') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 100 ? value : DEFAULT_FMP_SEC_MAX_PAGES;
  } catch {
    return DEFAULT_FMP_SEC_MAX_PAGES;
  }
}

function getRtprTickerConcurrency(): number {
  try {
    const value = parseInt(localStorage.getItem('rtpr-ticker-concurrency') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 5;
  } catch {
    return 5;
  }
}

function readStoredObject(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// ─── Backend news item ───
interface BackendNewsItem {
  id: string;
  published_at: string;
  source: string;
  publisher?: string | null;
  origin_url?: string | null;
  source_type: string;
  title: string;
  body: string;
  url: string;
  tickers: string[];
  tags: string[];
  created_at: string;
  ohlc_ticker?: string | null;
  ohlc_date?: string | null;
  change_pct_ohlc_date?: string | null;
  change_1d_target_date?: string | null;
  change_pct?: number | null;
  change_1d_pct?: number | null;
  change_from_open_pct?: number | null;
  change_open_to_high_pct?: number | null;
  change_3d_pct?: number | null;
  change_7d_pct?: number | null;
  change_14d_pct?: number | null;
  change_30d_pct?: number | null;
  hv_change_pct?: number | null;
  hv_change_from_open_pct?: number | null;
  hv_change_open_to_high_pct?: number | null;
  hv_change_1d_pct?: number | null;
  hv_change_3d_pct?: number | null;
  hv_change_7d_pct?: number | null;
  hv_change_14d_pct?: number | null;
  hv_change_30d_pct?: number | null;
  zscore_change_pct?: number | null;
  zscore_change_from_open_pct?: number | null;
  zscore_change_open_to_high_pct?: number | null;
  zscore_change_1d_pct?: number | null;
  zscore_change_3d_pct?: number | null;
  zscore_change_7d_pct?: number | null;
  zscore_change_14d_pct?: number | null;
  zscore_change_30d_pct?: number | null;
  change_computed_at?: string | null;
  hasFullText?: boolean;
  keywords?: string[];
  keywordsStatus?: string | null;
  industry?: string | null;
  ipoDate?: string | null;
  marketCap?: number | null;
  floatPct?: number | null;
  institutionalPct?: number | null;
  insiderPct?: number | null;
  earnings_context_ticker?: string | null;
  recent_earnings_date?: string | null;
  recent_earnings_confirmed?: boolean | null;
  upcoming_earnings_date?: string | null;
  upcoming_earnings_confirmed?: boolean | null;
  earnings_context_display?: string | null;
  earnings_lookup_status?: string | null;
  score?: number | null;
  scoreEvidence?: string | null;
  analysisStatus?: string | null;
  sentimentBullishPct?: number | null;
  sentimentBearishPct?: number | null;
  companyNewsScore?: number | null;
  peers?: string[];
  companyDescription?: string | null;
}

// ─── Display item ───
interface DisplayItem {
  id: string;
  publishedAt: string;
  date: string;
  time: string;
  title: string;
  body: string;
  ticker: string;
  publisher: string | null;
  originUrl: string | null;
  source: string;
  sourceType: string;
  url: string;
  changePct: number | null;
  change1dPct: number | null;
  changeFromOpenPct: number | null;
  changeOpenToHighPct: number | null;
  change3dPct: number | null;
  change7dPct: number | null;
  change14dPct: number | null;
  change30dPct: number | null;
  hvChangePct: number | null;
  hvChangeFromOpenPct: number | null;
  hvChangeOpenToHighPct: number | null;
  hvChange1dPct: number | null;
  hvChange3dPct: number | null;
  hvChange7dPct: number | null;
  hvChange14dPct: number | null;
  hvChange30dPct: number | null;
  zscoreChangePct: number | null;
  zscoreChangeFromOpenPct: number | null;
  zscoreChangeOpenToHighPct: number | null;
  zscoreChange1dPct: number | null;
  zscoreChange3dPct: number | null;
  zscoreChange7dPct: number | null;
  zscoreChange14dPct: number | null;
  zscoreChange30dPct: number | null;
  hasFullText: boolean;
  keywords: string[];
  keywordsStatus: string | null;
  industry: string | null;
  ipoDate: string | null;
  marketCap: number | null;
  floatPct: number | null;
  institutionalPct: number | null;
  insiderPct: number | null;
  earningsContextTicker: string | null;
  recentEarningsDate: string | null;
  recentEarningsConfirmed: boolean | null;
  upcomingEarningsDate: string | null;
  upcomingEarningsConfirmed: boolean | null;
  earningsContextDisplay: string | null;
  earningsLookupStatus: string | null;
  score: number | null;
  scoreEvidence: string | null;
  sentiment: number | null;
  sentimentLabel: string | null;
  peers: string[];
  companyDesc: string | null;
}

interface BookmarkFolder {
  id: string;
  name: string;
  parent_id?: string | null;
}

function hasExplicitTimeZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function parseNaiveEtParts(value: string): { date: string; time: string } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/);
  if (!match) return null;

  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = match[4] ?? '00';
  const minute = match[5] ?? '00';

  if (monthIndex < 0 || monthIndex >= MONTH_LABELS.length) return null;

  return {
    date: `${MONTH_LABELS[monthIndex]} ${day}, ${year}`,
    time: `${hour}:${minute}`,
  };
}

function formatPublishedAtEt(value: string): { date: string; time: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { date: '-', time: '-' };
  }

  if (hasExplicitTimeZone(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: ET_DATE_FORMATTER.format(parsed),
        time: ET_TIME_FORMATTER.format(parsed),
      };
    }
  }

  const naiveParts = parseNaiveEtParts(trimmed);
  if (naiveParts) {
    return naiveParts;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: ET_DATE_FORMATTER.format(parsed),
      time: ET_TIME_FORMATTER.format(parsed),
    };
  }

  return { date: trimmed, time: '-' };
}

function mapBackendItem(item: BackendNewsItem): DisplayItem {
  const publishedAtEt = formatPublishedAtEt(item.published_at);
  return {
    id: item.id,
    publishedAt: item.published_at,
    date: publishedAtEt.date,
    time: publishedAtEt.time,
    title: item.title,
    body: item.body,
    ticker: item.tickers?.[0] ?? '',
    publisher: item.publisher ?? null,
    originUrl: item.origin_url ?? null,
    source: item.source,
    sourceType: item.source_type,
    url: item.url,
    changePct: item.change_pct ?? null,
    change1dPct: item.change_1d_pct ?? null,
    changeFromOpenPct: item.change_from_open_pct ?? null,
    changeOpenToHighPct: item.change_open_to_high_pct ?? null,
    change3dPct: item.change_3d_pct ?? null,
    change7dPct: item.change_7d_pct ?? null,
    change14dPct: item.change_14d_pct ?? null,
    change30dPct: item.change_30d_pct ?? null,
    hvChangePct: item.hv_change_pct ?? null,
    hvChangeFromOpenPct: item.hv_change_from_open_pct ?? null,
    hvChangeOpenToHighPct: item.hv_change_open_to_high_pct ?? null,
    hvChange1dPct: item.hv_change_1d_pct ?? null,
    hvChange3dPct: item.hv_change_3d_pct ?? null,
    hvChange7dPct: item.hv_change_7d_pct ?? null,
    hvChange14dPct: item.hv_change_14d_pct ?? null,
    hvChange30dPct: item.hv_change_30d_pct ?? null,
    zscoreChangePct: item.zscore_change_pct ?? null,
    zscoreChangeFromOpenPct: item.zscore_change_from_open_pct ?? null,
    zscoreChangeOpenToHighPct: item.zscore_change_open_to_high_pct ?? null,
    zscoreChange1dPct: item.zscore_change_1d_pct ?? null,
    zscoreChange3dPct: item.zscore_change_3d_pct ?? null,
    zscoreChange7dPct: item.zscore_change_7d_pct ?? null,
    zscoreChange14dPct: item.zscore_change_14d_pct ?? null,
    zscoreChange30dPct: item.zscore_change_30d_pct ?? null,
    hasFullText: !!item.hasFullText,
    keywords: item.keywords ?? [],
    keywordsStatus: item.keywordsStatus ?? null,
    industry: item.industry ?? null,
    ipoDate: item.ipoDate ?? null,
    marketCap: item.marketCap ?? null,
    floatPct: item.floatPct ?? null,
    institutionalPct: item.institutionalPct ?? null,
    insiderPct: item.insiderPct ?? null,
    earningsContextTicker: item.earnings_context_ticker ?? null,
    recentEarningsDate: item.recent_earnings_date ?? null,
    recentEarningsConfirmed: item.recent_earnings_confirmed ?? null,
    upcomingEarningsDate: item.upcoming_earnings_date ?? null,
    upcomingEarningsConfirmed: item.upcoming_earnings_confirmed ?? null,
    earningsContextDisplay: item.earnings_context_display ?? null,
    earningsLookupStatus: item.earnings_lookup_status ?? null,
    score: item.score ?? null,
    scoreEvidence: item.scoreEvidence ?? null,
    sentiment: item.sentimentBullishPct ?? null,
    sentimentLabel: item.sentimentBullishPct != null
      ? (item.sentimentBullishPct > 0.6 ? 'Bullish' : item.sentimentBullishPct < 0.4 ? 'Bearish' : 'Neutral')
      : null,
    peers: item.peers ?? [],
    companyDesc: item.companyDescription ?? null,
  };
}

// ─── Formatters ───
const formatChange = (val: number | null) => {
  if (val === null || val === undefined) return '-';
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const formatZScore = (val: number | null) => {
  if (val === null || val === undefined) return '-';
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}`;
};

const formatOwnershipPct = (val: number | null) => {
  if (val === null || val === undefined) return '-';
  return `${val.toFixed(2)}%`;
};

const formatMarketCap = (val: number | null) => {
  if (val === null || val === undefined || !Number.isFinite(val)) return '-';
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000_000) return `$${(val / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  return `$${val.toFixed(0)}`;
};

const changeColor = (val: number | null) => {
  if (val === null || val === undefined) return 'text-gray-400';
  return val > 0 ? 'text-green-600 dark:text-green-400' : val < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
};

const formatEarningsStatus = (confirmed: boolean | null) => confirmed ? 'Confirmed' : 'Unconfirmed';

// ═══════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════
interface FinnhubNewsWindowProps {
  onTickerClick?: (ticker: string) => void;
  initialTicker?: string;
  titleFontSize?: number;
  summaryFontSize?: number;
}

export function FinnhubNewsWindow({
  onTickerClick,
  initialTicker,
  titleFontSize = 12,
  summaryFontSize = 11,
}: FinnhubNewsWindowProps) {
  const persistedUiStateRef = useRef<Record<string, unknown> | null>(null);
  if (persistedUiStateRef.current === null) {
    persistedUiStateRef.current = readStoredObject('finhub-news-ui-state') ?? {};
  }
  const persistedUiState = persistedUiStateRef.current;

  const [searchQuery, setSearchQuery] = useState(initialTicker || '');
  const [tickerQuery, setTickerQuery] = useState(initialTicker || '');
  const [fromDate, setFromDate] = useState(() => typeof persistedUiState?.fromDate === 'string' ? persistedUiState.fromDate : '');
  const [toDate, setToDate] = useState(() => typeof persistedUiState?.toDate === 'string' ? persistedUiState.toDate : '');
  const [floatPctMin, setFloatPctMin] = useState(() => typeof persistedUiState?.floatPctMin === 'string' ? persistedUiState.floatPctMin : '');
  const [floatPctMax, setFloatPctMax] = useState(() => typeof persistedUiState?.floatPctMax === 'string' ? persistedUiState.floatPctMax : '');
  const [institutionalPctMin, setInstitutionalPctMin] = useState(() => typeof persistedUiState?.institutionalPctMin === 'string' ? persistedUiState.institutionalPctMin : '');
  const [institutionalPctMax, setInstitutionalPctMax] = useState(() => typeof persistedUiState?.institutionalPctMax === 'string' ? persistedUiState.institutionalPctMax : '');
  const [insiderPctMin, setInsiderPctMin] = useState(() => typeof persistedUiState?.insiderPctMin === 'string' ? persistedUiState.insiderPctMin : '');
  const [insiderPctMax, setInsiderPctMax] = useState(() => typeof persistedUiState?.insiderPctMax === 'string' ? persistedUiState.insiderPctMax : '');
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [bookmarkFoldersLoaded, setBookmarkFoldersLoaded] = useState(false);
  const [selectedBookmarkFolderId, setSelectedBookmarkFolderId] = useState<string>(() => typeof persistedUiState?.selectedBookmarkFolderId === 'string' ? persistedUiState.selectedBookmarkFolderId : '');
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);
  const [showBookmarkManager, setShowBookmarkManager] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [editingBookmarkFolderId, setEditingBookmarkFolderId] = useState<string | null>(null);
  const [editingBookmarkFolderName, setEditingBookmarkFolderName] = useState('');
  const [bookmarkFolderCtxMenu, setBookmarkFolderCtxMenu] = useState<null | { x: number; y: number; folderId: string }>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [showDisplayModeMenu, setShowDisplayModeMenu] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState('All');
  const [listHeight, setListHeight] = useState(500);
  const [stickyDate, setStickyDate] = useState('');
  const [saveName, setSaveName] = useState('');

  // Source cell context menu (Copy URL)
  const [sourceCtxMenu, setSourceCtxMenu] = useState<null | { x: number; y: number; url: string }>(null);
  const sourceCtxMenuRef = useRef<HTMLDivElement>(null);
  const [rowCtxMenu, setRowCtxMenu] = useState<null | { x: number; y: number; newsId: string }>(null);
  const rowCtxMenuRef = useRef<HTMLDivElement>(null);
  const bookmarkFolderCtxMenuRef = useRef<HTMLDivElement>(null);

  // Full text popup
  const [showFulltextModal, setShowFulltextModal] = useState(false);
  const [fulltextData, setFulltextData] = useState<{ title: string; text: string; wordCount: number; status: string } | null>(null);
  const [fulltextLoading, setFulltextLoading] = useState(false);

  type JobCategory = 'news-update' | 'news-fulltext';
  const NEWS_JOB_SCOPE = 'finnhub-news';
  type TrackedJobStatus = {
    id: string;
    category?: JobCategory | string;
    label?: string;
    scope?: string;
    status: 'running' | 'done' | 'failed' | 'cancelled';
    progress: { completed: number; total: number; pct: number };
    logs: string[];
    error?: string;
    result?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  };
  type ActiveTrackedJob = {
    id: string;
    category?: JobCategory | string;
    label?: string;
    scope?: string;
    status: string;
    progress: { completed: number; total: number; pct: number };
    createdAt: string;
    updatedAt?: string;
  };

  // Full text extraction job
  const [ftUpdating, setFtUpdating] = useState(false);

  // Company description popup
  const [descPopup, setDescPopup] = useState<{ ticker: string; text: string } | null>(null);

  // Display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => persistedUiState?.displayMode === 'title-abstract' ? 'title-abstract' : 'title-only');
  const [newsProjection, setNewsProjection] = useState<NewsProjectionMode>(() => persistedUiState?.newsProjection === 'model1-safe' ? 'model1-safe' : 'full');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering + visibility
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(() => {
    if (Array.isArray(persistedUiState?.visibleCols)) {
      const valid = (persistedUiState.visibleCols as string[]).filter(c => DEFAULT_COLUMNS.some(d => d.id === c)) as ColumnId[];
      if (valid.length > 0) return new Set(valid);
    }
    return DEFAULT_VISIBLE;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMNS.map(c => c.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Visible columns (filtered + preserving order)
  const isModel1SafeMode = newsProjection === 'model1-safe';
  const activeColumns = useMemo(
    () => columns.filter(c => visibleCols.has(c.id) && !(isModel1SafeMode && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(c.id))),
    [columns, visibleCols, isModel1SafeMode],
  );
  const activeColWidths = useMemo(() => {
    const widthMap = new Map(columns.map((c, i) => [c.id, colWidths[i]]));
    return activeColumns.map(c => widthMap.get(c.id) ?? c.defaultWidth);
  }, [columns, activeColumns, colWidths]);

  const toggleColumnVisibility = useCallback((colId: ColumnId) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        // must keep at least 1 column visible
        if (next.size > 1) next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  }, []);

  const newsApiBase = isModel1SafeMode ? `${API_BASE}/api/model1/news` : `${API_BASE}/api/news`;

  // Sort
  const [sort, setSort] = useState<SortState>({ column: null, dir: null });

  // Source type filter
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>(() => {
    const savedValue = persistedUiState?.sourceTypeFilter;
    return ['all', 'company_news', 'press_release', 'fmp_press_release', 'fmp_stock_news', 'fmp_sec_filing', 'market_news'].includes(String(savedValue))
      ? savedValue as SourceTypeFilter
      : 'all';
  });

  // Backend data
  const [newsData, setNewsData] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Update config (last used mode/sourceType) ───
  type UpdateMode = '7d' | 'recent' | 'custom';
  type UpdateSourceType = 'all' | 'company_news' | 'press_release' | 'market_news' | 'fmp_press_release' | 'fmp_press_release_entire' | 'fmp_stock_news' | 'fmp_sec_filing';
  const [lastUpdateConfig, setLastUpdateConfig] = useState<{ mode: UpdateMode; sourceType: UpdateSourceType }>(() => {
    try {
      const saved = localStorage.getItem('finnhub-last-update-config');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { mode: '7d', sourceType: 'all' };
  });
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showChangeCustomDateModal, setShowChangeCustomDateModal] = useState(false);
  const [changeCustomFrom, setChangeCustomFrom] = useState('');
  const [changeCustomTo, setChangeCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCalendarCustomDateModal, setShowCalendarCustomDateModal] = useState(false);
  const [calendarCustomFrom, setCalendarCustomFrom] = useState('');
  const [calendarCustomTo, setCalendarCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showPtprCustomDateModal, setShowPtprCustomDateModal] = useState(false);
  const [ptprCustomFrom, setPtprCustomFrom] = useState('');
  const [ptprCustomTo, setPtprCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showControlWindow, setShowControlWindow] = useState(false);
  const [finnhubTickerConcurrencyInput, setFinnhubTickerConcurrencyInput] = useState(() => String(getFinnhubTickerConcurrency()));
  const [finnhubRequestIntervalSecInput, setFinnhubRequestIntervalSecInput] = useState(() => String(getFinnhubRequestIntervalMs() / 1000));
  const [companyNewsTickerConcurrencyInput, setCompanyNewsTickerConcurrencyInput] = useState(() => String(getCompanyNewsTickerConcurrency()));
  const [companyNewsRequestIntervalSecInput, setCompanyNewsRequestIntervalSecInput] = useState(() => String(getCompanyNewsRequestIntervalMs() / 1000));
  const [fmpTickerConcurrencyInput, setFmpTickerConcurrencyInput] = useState(() => String(getFmpTickerConcurrency()));
  const [fmpStockFulltextConcurrencyInput, setFmpStockFulltextConcurrencyInput] = useState(() => String(getFmpStockFulltextConcurrency()));
  const [fmpRequestIntervalMsInput, setFmpRequestIntervalMsInput] = useState(() => String(getFmpRequestIntervalMs()));
  const [fmpPrPageLimitInput, setFmpPrPageLimitInput] = useState(() => String(getFmpPrPageLimit()));
  const [fmpPrMaxPagesInput, setFmpPrMaxPagesInput] = useState(() => String(getFmpPrMaxPages()));
  const [fmpSecMaxPagesInput, setFmpSecMaxPagesInput] = useState(() => String(getFmpSecMaxPages()));
  const [rtprTickerConcurrencyInput, setRtprTickerConcurrencyInput] = useState(() => String(getRtprTickerConcurrency()));
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightData, setPreflightData] = useState<{ totalTickers: number; fallbackCount: number; fallbackTickers: string[] } | null>(null);
  const [showCustomPreflightModal, setShowCustomPreflightModal] = useState(false);
  const [customPreflightData, setCustomPreflightData] = useState<any | null>(null);
  const [customPreflightTitle, setCustomPreflightTitle] = useState('Custom Update Preflight');
  const [pendingCustomExecute, setPendingCustomExecute] = useState<(() => void) | null>(null);
  const [pendingUpdateSourceType, setPendingUpdateSourceType] = useState<UpdateSourceType>('all');

  // ─── Background job tracking ───
  const [pullJobId, setPullJobId] = useState<string | null>(null);
  const [ftJobId, setFtJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<Record<string, TrackedJobStatus>>({});
  const [activeJobs, setActiveJobs] = useState<ActiveTrackedJob[]>([]);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const tickerQueryRef = useRef(tickerQuery);
  tickerQueryRef.current = tickerQuery;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const selectedJobStatus = selectedJobId ? jobStatuses[selectedJobId] ?? null : null;

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const displayModeMenuRef = useRef<HTMLDivElement>(null);
  // columnMenuRef declared above with column state

  const activeNumericFilterCount = [
    floatPctMin,
    floatPctMax,
    institutionalPctMin,
    institutionalPctMax,
    insiderPctMin,
    insiderPctMax,
  ].filter((value) => value.trim()).length;
  const hasNumericFilters = activeNumericFilterCount > 0;

  const applyOwnershipFilterParams = useCallback((params: URLSearchParams) => {
    if (floatPctMin.trim()) params.set('floatPctMin', floatPctMin.trim());
    if (floatPctMax.trim()) params.set('floatPctMax', floatPctMax.trim());
    if (institutionalPctMin.trim()) params.set('institutionalPctMin', institutionalPctMin.trim());
    if (institutionalPctMax.trim()) params.set('institutionalPctMax', institutionalPctMax.trim());
    if (insiderPctMin.trim()) params.set('insiderPctMin', insiderPctMin.trim());
    if (insiderPctMax.trim()) params.set('insiderPctMax', insiderPctMax.trim());
  }, [floatPctMin, floatPctMax, institutionalPctMin, institutionalPctMax, insiderPctMin, insiderPctMax]);

  const buildCurrentNewsQueryPayload = useCallback((overrides?: { from?: string; to?: string }) => {
    const payload: Record<string, unknown> = {
      source_names: (sourceTypeFilter === 'fmp_press_release' || sourceTypeFilter === 'fmp_stock_news' || sourceTypeFilter === 'fmp_sec_filing')
        ? ['FMP']
        : ['FINNHUB', 'RTPR', 'FMP'],
    };

    if (selectedBookmarkFolderId) {
      payload.bookmarkFolderId = selectedBookmarkFolderId;
    }
    if (sourceTypeFilter === 'fmp_press_release') {
      payload.source_type = 'fmp_press_release';
    } else if (sourceTypeFilter === 'fmp_stock_news') {
      payload.source_type = 'fmp_stock_news';
    } else if (sourceTypeFilter === 'fmp_sec_filing') {
      payload.source_type = 'fmp_sec_filing';
    } else if (sourceTypeFilter !== 'all') {
      payload.source_type = sourceTypeFilter;
    }

    const keyword = searchQueryRef.current.trim();
    if (keyword) {
      payload.keyword = keyword;
    }

    const currentTicker = tickerQueryRef.current.trim();
    if (currentTicker) {
      payload.tickers = [currentTicker.toUpperCase()];
    }

    const effectiveFrom = overrides?.from ?? fromDate;
    const effectiveTo = overrides?.to ?? toDate;
    if (effectiveFrom) {
      payload.from = effectiveFrom;
    }
    if (effectiveTo) {
      payload.to = effectiveTo;
    }

    if (floatPctMin.trim()) payload.floatPctMin = floatPctMin.trim();
    if (floatPctMax.trim()) payload.floatPctMax = floatPctMax.trim();
    if (institutionalPctMin.trim()) payload.institutionalPctMin = institutionalPctMin.trim();
    if (institutionalPctMax.trim()) payload.institutionalPctMax = institutionalPctMax.trim();
    if (insiderPctMin.trim()) payload.insiderPctMin = insiderPctMin.trim();
    if (insiderPctMax.trim()) payload.insiderPctMax = insiderPctMax.trim();

    return payload;
  }, [
    floatPctMax,
    floatPctMin,
    fromDate,
    insiderPctMax,
    insiderPctMin,
    institutionalPctMax,
    institutionalPctMin,
    selectedBookmarkFolderId,
    sourceTypeFilter,
    toDate,
  ]);

  const clearNumericFilters = useCallback(() => {
    setFloatPctMin('');
    setFloatPctMax('');
    setInstitutionalPctMin('');
    setInstitutionalPctMax('');
    setInsiderPctMin('');
    setInsiderPctMax('');
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback for environments where Clipboard API is unavailable
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  useEffect(() => {
    if (!sourceCtxMenu) return;

    const onMouseDown = (e: MouseEvent) => {
      if (sourceCtxMenuRef.current && sourceCtxMenuRef.current.contains(e.target as Node)) return;
      setSourceCtxMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSourceCtxMenu(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sourceCtxMenu]);

  useEffect(() => {
    if (!rowCtxMenu) return;

    const onMouseDown = (e: MouseEvent) => {
      if (rowCtxMenuRef.current && rowCtxMenuRef.current.contains(e.target as Node)) return;
      setRowCtxMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowCtxMenu(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rowCtxMenu]);

  // ─── Saved searches (local state) ───
  interface SavedSearch {
    id: string;
    name: string;
    searchQuery: string;
    sourceTypeFilter: SourceTypeFilter;
  }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const handleAddBookmark = useCallback(async (folderId: string, newsId: string) => {
    try {
      await fetch(`${API_BASE}/api/bookmarks/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, newsId }),
      });
    } finally {
      setRowCtxMenu(null);
    }
  }, []);

  const fetchBookmarkFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks/folders`);
      const data = await res.json();
      if (!res.ok) {
        setBookmarkFoldersLoaded(false);
        return;
      }
      const folders: BookmarkFolder[] = Array.isArray(data) ? data : Array.isArray(data.folders) ? data.folders : [];
      setBookmarkFolders(folders);
      setBookmarkFoldersLoaded(true);
      // fallback: if restored selectedBookmarkFolderId no longer exists, reset
      if (selectedBookmarkFolderId && folders.length > 0 && !folders.some(f => f.id === selectedBookmarkFolderId)) {
        setSelectedBookmarkFolderId('');
      }
    } catch {
      setBookmarkFoldersLoaded(false);
      // keep bookmark UI empty on failure
    }
  }, [selectedBookmarkFolderId]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!name.trim()) return;
    await fetch(`${API_BASE}/api/bookmarks/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setNewFolderName('');
    setShowNewFolderInput(false);
    fetchBookmarkFolders();
  }, [fetchBookmarkFolders]);

  const handleRenameBookmarkFolder = useCallback(async (folderId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setEditingBookmarkFolderId(null);
      setEditingBookmarkFolderName('');
      return;
    }

    await fetch(`${API_BASE}/api/bookmarks/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName }),
    });

    setEditingBookmarkFolderId(null);
    setEditingBookmarkFolderName('');
    setBookmarkFolderCtxMenu(null);
    fetchBookmarkFolders();
  }, [fetchBookmarkFolders]);

  const startRenameBookmarkFolder = useCallback((folder: BookmarkFolder) => {
    setEditingBookmarkFolderId(folder.id);
    setEditingBookmarkFolderName(folder.name);
    setBookmarkFolderCtxMenu(null);
    setShowBookmarkMenu(true);
  }, []);

  const handleCopyBookmarkFolderName = useCallback(async (folderId: string) => {
    const folder = bookmarkFolders.find((item) => item.id === folderId);
    if (!folder) return;
    await copyToClipboard(folder.name);
    setBookmarkFolderCtxMenu(null);
  }, [bookmarkFolders, copyToClipboard]);

  useEffect(() => {
    if (!bookmarkFolderCtxMenu) return;

    const onMouseDown = (e: MouseEvent) => {
      if (bookmarkFolderCtxMenuRef.current && bookmarkFolderCtxMenuRef.current.contains(e.target as Node)) return;
      setBookmarkFolderCtxMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBookmarkFolderCtxMenu(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [bookmarkFolderCtxMenu]);

  // ─── Fetch news from backend (server-side search via keyword param) ───
  const fetchNews = useCallback(async (keyword?: string) => {
    // Cancel any in-flight request to avoid stale responses overwriting fresh data
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setError(null);
    setNextCursor(null);
    try {
      const params = new URLSearchParams();
      params.set('source_names', (sourceTypeFilter === 'fmp_press_release' || sourceTypeFilter === 'fmp_stock_news' || sourceTypeFilter === 'fmp_sec_filing') ? 'FMP' : 'FINNHUB,RTPR,FMP');
      if (selectedBookmarkFolderId) {
        params.set('bookmarkFolderId', selectedBookmarkFolderId);
      }
      if (sourceTypeFilter === 'fmp_press_release') {
        params.set('source_type', 'fmp_press_release');
      } else if (sourceTypeFilter === 'fmp_stock_news') {
        params.set('source_type', 'fmp_stock_news');
      } else if (sourceTypeFilter === 'fmp_sec_filing') {
        params.set('source_type', 'fmp_sec_filing');
      } else if (sourceTypeFilter !== 'all') {
        params.set('source_type', sourceTypeFilter);
      }
      if (keyword) {
        params.set('keyword', keyword);
      }
      const currentTicker = tickerQueryRef.current.trim();
      if (currentTicker) {
        params.set('tickers', currentTicker.toUpperCase());
      }
      if (fromDate) {
        params.set('from', fromDate);
      }
      if (toDate) {
        params.set('to', toDate);
      }
      applyOwnershipFilterParams(params);
      params.set('limit', String(NEWS_PAGE_SIZE));

      const res = await fetch(`${newsApiBase}?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const items: BackendNewsItem[] = data.items ?? [];
      setNewsData(items.map(mapBackendItem));
      setNextCursor(data.nextCursor ?? null);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // stale request — ignore
      setError(err.message || 'Failed to fetch news');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [selectedBookmarkFolderId, sourceTypeFilter, fromDate, toDate, newsApiBase, applyOwnershipFilterParams]);

  // ─── Fetch more (cursor-based append) ───
  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('source_names', (sourceTypeFilter === 'fmp_press_release' || sourceTypeFilter === 'fmp_stock_news' || sourceTypeFilter === 'fmp_sec_filing') ? 'FMP' : 'FINNHUB,RTPR,FMP');
      if (selectedBookmarkFolderId) {
        params.set('bookmarkFolderId', selectedBookmarkFolderId);
      }
      if (sourceTypeFilter === 'fmp_press_release') {
        params.set('source_type', 'fmp_press_release');
      } else if (sourceTypeFilter === 'fmp_stock_news') {
        params.set('source_type', 'fmp_stock_news');
      } else if (sourceTypeFilter === 'fmp_sec_filing') {
        params.set('source_type', 'fmp_sec_filing');
      } else if (sourceTypeFilter !== 'all') {
        params.set('source_type', sourceTypeFilter);
      }
      if (searchQueryRef.current) {
        params.set('keyword', searchQueryRef.current);
      }
      const currentTicker = tickerQueryRef.current.trim();
      if (currentTicker) {
        params.set('tickers', currentTicker.toUpperCase());
      }
      if (fromDate) {
        params.set('from', fromDate);
      }
      if (toDate) {
        params.set('to', toDate);
      }
      applyOwnershipFilterParams(params);
      params.set('limit', String(NEWS_PAGE_SIZE));
      params.set('cursor', nextCursor);

      const res = await fetch(`${newsApiBase}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      const items: BackendNewsItem[] = data.items ?? [];
      if (items.length > 0) {
        setNewsData(prev => [...prev, ...items.map(mapBackendItem)]);
      }
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // silent — user can retry via button
    } finally {
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore, selectedBookmarkFolderId, sourceTypeFilter, fromDate, toDate, newsApiBase, applyOwnershipFilterParams]);

  useEffect(() => {
    if (isModel1SafeMode && sort.column && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(sort.column)) {
      setSort({ column: null, dir: null });
    }
  }, [isModel1SafeMode, sort.column]);

  useEffect(() => {
    const shouldLoadBookmarks = Boolean(selectedBookmarkFolderId || showBookmarkMenu || showBookmarkManager || rowCtxMenu);
    if (!shouldLoadBookmarks || bookmarkFoldersLoaded) {
      return;
    }
    void fetchBookmarkFolders();
  }, [selectedBookmarkFolderId, showBookmarkMenu, showBookmarkManager, rowCtxMenu, bookmarkFoldersLoaded, fetchBookmarkFolders]);

  // ─── Auto-reload when discrete filters change (source type, bookmark, dates) ───
  useEffect(() => {
    fetchNews(searchQueryRef.current || undefined);
  }, [fetchNews]);

  // Trigger search explicitly — called on Enter key or Refresh button
  const triggerSearch = useCallback(() => {
    fetchNews(searchQueryRef.current || undefined);
  }, [fetchNews]);

  // ─── Update (pull from Finnhub — background job) ───
  const handleUpdate = async (
    mode: UpdateMode = '7d',
    sourceType: UpdateSourceType = 'all',
    from?: string,
    to?: string,
  ) => {
    const config = { mode, sourceType };
    setLastUpdateConfig(config);
    try { localStorage.setItem('finnhub-last-update-config', JSON.stringify(config)); } catch { /* ignore */ }

    setUpdating(true);
    setError(null);
    try {
      if (sourceType === 'fmp_press_release' || sourceType === 'fmp_press_release_entire') {
        const body: Record<string, unknown> = {
          mode: sourceType === 'fmp_press_release_entire' ? 'custom-entire' : mode,
          tickerConcurrency: getFmpTickerConcurrency(),
          requestIntervalMs: getFmpRequestIntervalMs(),
          pageLimit: getFmpPrPageLimit(),
          maxPages: getFmpPrMaxPages(),
        };
        if (from) body.from = from;
        if (to) body.to = to;
        const res = await fetch(`${API_BASE}/api/news/pull-fmp-press-release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409 && data.existingJobId) {
            registerJob(data.existingJobId, 'news-update');
            setShowLogPanel(true);
            setError(data.error || 'FMP press release pull job is already running');
            return;
          }
          setError(data.error || `HTTP ${res.status}`);
          setUpdating(false);
          return;
        }
        registerJob(data.jobId, 'news-update');
        return;
      }

      if (sourceType === 'fmp_stock_news') {
        const body: Record<string, unknown> = {
          mode,
          tickerConcurrency: getFmpTickerConcurrency(),
          fulltextConcurrency: getFmpStockFulltextConcurrency(),
          requestIntervalMs: getFmpRequestIntervalMs(),
          pageLimit: getFmpPrPageLimit(),
          maxPages: getFmpPrMaxPages(),
        };
        if (from) body.from = from;
        if (to) body.to = to;
        const res = await fetch(`${API_BASE}/api/news/pull-fmp-stock-news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409 && data.existingJobId) {
            registerJob(data.existingJobId, 'news-update');
            setShowLogPanel(true);
            setError(data.error || 'FMP stock news pull job is already running');
            return;
          }
          setError(data.error || `HTTP ${res.status}`);
          setUpdating(false);
          return;
        }
        registerJob(data.jobId, 'news-update');
        return;
      }

      if (sourceType === 'fmp_sec_filing') {
        const body: Record<string, unknown> = {
          mode,
          tickerConcurrency: getFmpTickerConcurrency(),
          requestIntervalMs: getFmpRequestIntervalMs(),
          maxPages: getFmpSecMaxPages(),
        };
        if (from) body.from = from;
        if (to) body.to = to;
        const res = await fetch(`${API_BASE}/api/news/pull-fmp-sec-filing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409 && data.existingJobId) {
            registerJob(data.existingJobId, 'news-update');
            setShowLogPanel(true);
            setError(data.error || 'FMP SEC filing pull job is already running');
            return;
          }
          setError(data.error || `HTTP ${res.status}`);
          setUpdating(false);
          return;
        }
        registerJob(data.jobId, 'news-update');
        return;
      }

      const body: Record<string, unknown> = {
        mode,
        sourceType,
        tickerConcurrency: sourceType === 'company_news' ? getCompanyNewsTickerConcurrency() : getFinnhubTickerConcurrency(),
        requestIntervalMs: sourceType === 'company_news' ? getCompanyNewsRequestIntervalMs() : getFinnhubRequestIntervalMs(),
        fulltextConcurrency: getFulltextConcurrency(),
      };
      if (from) body.from = from;
      if (to) body.to = to;
      const res = await fetch(`${API_BASE}/api/news/pull-finhub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingJobId) {
          registerJob(data.existingJobId, 'news-update');
          setShowLogPanel(true);
          setError(data.error || 'Finnhub pull job is already running');
          return;
        }
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
    } catch (err: any) {
      setError(err.message || 'Failed to start update');
      setUpdating(false);
    }
  };

  // ─── Recent Update with preflight check ───
  const handleRecentWithPreflight = async (sourceType: UpdateSourceType) => {
    if (sourceType === 'market_news' || sourceType === 'fmp_press_release' || sourceType === 'fmp_stock_news' || sourceType === 'fmp_sec_filing') {
      handleUpdate('recent', sourceType);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/news/pull-finhub/preflight?sourceType=${sourceType}`);
      if (!res.ok) { handleUpdate('recent', sourceType); return; }
      const data = await res.json();
      if (data.fallbackCount > 0) {
        setPreflightData(data);
        setPendingUpdateSourceType(sourceType);
        setShowPreflightModal(true);
      } else {
        handleUpdate('recent', sourceType);
      }
    } catch {
      handleUpdate('recent', sourceType);
    }
  };

  // ─── Custom Update: open date picker ───
  const handleCustomStart = (sourceType: UpdateSourceType) => {
    setPendingUpdateSourceType(sourceType);
    setCustomTo(new Date().toISOString().slice(0, 10));
    setShowCustomDateModal(true);
  };

  const openCustomPreflight = async (endpoint: string, body: Record<string, unknown>, title: string, onContinue: () => void) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        onContinue();
        return;
      }
      setCustomPreflightTitle(title);
      setCustomPreflightData(data);
      setPendingCustomExecute(() => onContinue);
      setShowCustomPreflightModal(true);
    } catch {
      onContinue();
    }
  };

  const handleCustomPreflightStart = async (sourceType: UpdateSourceType, from: string, to: string) => {
    const continueRun = () => { void handleUpdate('custom', sourceType, from, to); };
    if (sourceType === 'market_news') {
      continueRun();
      return;
    }
    if (sourceType === 'fmp_press_release') {
      await openCustomPreflight('/api/news/pull-fmp-press-release/preflight-custom', { mode: 'custom', from, to }, 'FMP Press Release Preflight', continueRun);
      return;
    }
    if (sourceType === 'fmp_press_release_entire') {
      // Entire mode: skip preflight (no gap planning), run directly
      continueRun();
      return;
    }
    if (sourceType === 'fmp_stock_news') {
      await openCustomPreflight('/api/news/pull-fmp-stock-news/preflight-custom', { mode: 'custom', from, to }, 'FMP Stock News Preflight', continueRun);
      return;
    }
    if (sourceType === 'fmp_sec_filing') {
      await openCustomPreflight('/api/news/pull-fmp-sec-filing/preflight-custom', { mode: 'custom', from, to }, 'FMP SEC Filing Preflight', continueRun);
      return;
    }
    await openCustomPreflight('/api/news/pull-finhub/preflight-custom', { mode: 'custom', sourceType, from, to }, `${getSourceTypeLabel(sourceType)} Preflight`, continueRun);
  };

  // ─── PTPR (RTPR) press release pull ───
  const handlePtprUpdate = async (mode: 'recent' | 'custom', from?: string, to?: string) => {
    setUpdating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mode,
        tickerConcurrency: getRtprTickerConcurrency(),
      };
      if (from) body.from = from;
      if (to) body.to = to;
      const res = await fetch(`${API_BASE}/api/news/pull-rtpr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingJobId) {
          registerJob(data.existingJobId, 'news-update');
          setShowLogPanel(true);
          setError(data.error || 'RTPR pull job is already running');
          return;
        }
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
    } catch (err: any) {
      setError(err.message || 'Failed to start PTPR update');
      setUpdating(false);
    }
  };

  // ─── PTPR Custom: open date picker then call handlePtprUpdate ───
  const handlePtprCustomStart = () => {
    setPtprCustomFrom('');
    setPtprCustomTo(new Date().toISOString().slice(0, 10));
    setShowPtprCustomDateModal(true);
  };

  const handlePtprCustomPreflightStart = async (from: string, to: string) => {
    const continueRun = () => { void handlePtprUpdate('custom', from, to); };
    await openCustomPreflight('/api/news/pull-rtpr/preflight-custom', { mode: 'custom', from, to }, 'RTPR Preflight', continueRun);
  };

  const handleSaveControlWindow = () => {
    const finnhubTickerConcurrency = Math.max(1, Math.min(20, parseInt(finnhubTickerConcurrencyInput, 10) || 5));
    const finnhubRequestIntervalSec = Math.max(0, Math.min(10, parseFloat(finnhubRequestIntervalSecInput) || 1));
    const companyNewsTickerConcurrency = Math.max(1, Math.min(20, parseInt(companyNewsTickerConcurrencyInput, 10) || finnhubTickerConcurrency));
    const companyNewsRequestIntervalSec = Math.max(0, Math.min(10, parseFloat(companyNewsRequestIntervalSecInput) || finnhubRequestIntervalSec));
    const fmpTickerConcurrency = Math.max(1, Math.min(20, parseInt(fmpTickerConcurrencyInput, 10) || DEFAULT_FMP_TICKER_CONCURRENCY));
    const fmpStockFulltextConcurrency = Math.max(1, Math.min(200, parseInt(fmpStockFulltextConcurrencyInput, 10) || DEFAULT_FMP_STOCK_FULLTEXT_CONCURRENCY));
    const fmpRequestIntervalMs = Math.max(0, Math.min(5000, parseInt(fmpRequestIntervalMsInput, 10) || DEFAULT_FMP_REQUEST_INTERVAL_MS));
    const fmpPrPageLimit = Math.max(1, Math.min(100, parseInt(fmpPrPageLimitInput, 10) || DEFAULT_FMP_PR_PAGE_LIMIT));
    const fmpPrMaxPages = Math.max(1, Math.min(50, parseInt(fmpPrMaxPagesInput, 10) || DEFAULT_FMP_PR_MAX_PAGES));
    const fmpSecMaxPages = Math.max(1, Math.min(100, parseInt(fmpSecMaxPagesInput, 10) || DEFAULT_FMP_SEC_MAX_PAGES));
    const rtprTickerConcurrency = Math.max(1, Math.min(20, parseInt(rtprTickerConcurrencyInput, 10) || 5));

    try {
      localStorage.setItem('finnhub-ticker-concurrency', String(finnhubTickerConcurrency));
      localStorage.setItem('finnhub-request-interval-sec', String(finnhubRequestIntervalSec));
      localStorage.setItem('finnhub-company-news-ticker-concurrency', String(companyNewsTickerConcurrency));
      localStorage.setItem('finnhub-company-news-request-interval-sec', String(companyNewsRequestIntervalSec));
      localStorage.setItem('fmp-concurrency', String(fmpTickerConcurrency));
      localStorage.setItem('fmp-stock-fulltext-concurrency', String(fmpStockFulltextConcurrency));
      localStorage.setItem('fmp-request-interval-ms', String(fmpRequestIntervalMs));
      localStorage.setItem('fmp-pr-page-limit', String(fmpPrPageLimit));
      localStorage.setItem('fmp-pr-max-pages', String(fmpPrMaxPages));
      localStorage.setItem('fmp-sec-max-pages', String(fmpSecMaxPages));
      localStorage.setItem('rtpr-ticker-concurrency', String(rtprTickerConcurrency));
    } catch {
      // ignore localStorage failures
    }

    setFinnhubTickerConcurrencyInput(String(finnhubTickerConcurrency));
    setFinnhubRequestIntervalSecInput(String(finnhubRequestIntervalSec));
  setCompanyNewsTickerConcurrencyInput(String(companyNewsTickerConcurrency));
  setCompanyNewsRequestIntervalSecInput(String(companyNewsRequestIntervalSec));
    setFmpTickerConcurrencyInput(String(fmpTickerConcurrency));
    setFmpStockFulltextConcurrencyInput(String(fmpStockFulltextConcurrency));
    setFmpRequestIntervalMsInput(String(fmpRequestIntervalMs));
    setFmpPrPageLimitInput(String(fmpPrPageLimit));
    setFmpPrMaxPagesInput(String(fmpPrMaxPages));
    setFmpSecMaxPagesInput(String(fmpSecMaxPages));
    setRtprTickerConcurrencyInput(String(rtprTickerConcurrency));
    setShowControlWindow(false);
  };

  // ─── Change Update: Recent (last 7 days, all metrics) ───
  const handleRecentChangeUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/change/update-recent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.status === 409 && data.existingJobId) {
        // Already running — just show the existing job in View Log
        registerJob(data.existingJobId, 'news-update');
        setShowLogPanel(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
    } catch (err: any) {
      setError(err.message || 'Failed to start recent change update');
      setUpdating(false);
    }
  };

  // ─── Change Update: Custom date range (all metrics) ───
  const handleCustomChangeUpdate = async (from: string, to: string) => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/change/update-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (res.status === 409 && data.existingJobId) {
        registerJob(data.existingJobId, 'news-update');
        setShowLogPanel(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
    } catch (err: any) {
      setError(err.message || 'Failed to start custom change update');
      setUpdating(false);
    }
  };

  // ─── Earnings Date Update: custom date range ───
  const handleCustomEarningDateUpdate = async (from: string, to: string) => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/earnings/update-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCurrentNewsQueryPayload({ from, to })),
      });
      const data = await res.json();
      if (res.status === 409 && data.existingJobId) {
        registerJob(data.existingJobId, 'news-update');
        setShowLogPanel(true);
        setUpdating(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
      setUpdating(false);
    } catch (err: any) {
      setError(err.message || 'Failed to start custom earning date update');
      setUpdating(false);
    }
  };

  // ─── Earnings Date Update: re-check unconfirmed rows ───
  const handleCheckUnconfirmedEarningDate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/earnings/check-unconfirmed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCurrentNewsQueryPayload()),
      });
      const data = await res.json();
      if (res.status === 409 && data.existingJobId) {
        registerJob(data.existingJobId, 'news-update');
        setShowLogPanel(true);
        setUpdating(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-update');
      setUpdating(false);
    } catch (err: any) {
      setError(err.message || 'Failed to start unconfirmed earning date check');
      setUpdating(false);
    }
  };

  // ─── Fetch full text for a single news item ───
  const fetchFulltext = useCallback(async (newsId: string, title: string) => {
    setFulltextLoading(true);
    setFulltextData(null);
    setShowFulltextModal(true);
    try {
      const res = await fetch(`${API_BASE}/api/news/fulltext/${encodeURIComponent(newsId)}`);
      if (!res.ok) {
        setFulltextData({ title, text: `Failed to load (HTTP ${res.status})`, wordCount: 0, status: 'error' });
        return;
      }
      const data = await res.json();
      setFulltextData({
        title,
        text: data.fullText || '(no content)',
        wordCount: data.wordCount ?? 0,
        status: data.extractionStatus ?? 'unknown',
      });
    } catch (err: any) {
      setFulltextData({ title, text: `Error: ${err.message}`, wordCount: 0, status: 'error' });
    } finally {
      setFulltextLoading(false);
    }
  }, []);

  // ─── Full text extraction (background job) ───
  type FtSourceType = 'all' | 'company_news' | 'press_release' | 'market_news' | 'rtpr' | 'fmp_press_release' | 'fmp_stock_news' | 'fmp_sec_filing';
  const [lastFtSourceType, setLastFtSourceType] = useState<FtSourceType>('all');

  const registerJob = useCallback((jobId: string, category: JobCategory) => {
    if (category === 'news-update') {
      setPullJobId(jobId);
      setUpdating(true);
    } else {
      setFtJobId(jobId);
      setFtUpdating(true);
    }
    setSelectedJobId(jobId);
  }, []);

  const syncJobState = useCallback((jobId: string, category: JobCategory, data: TrackedJobStatus) => {
    setJobStatuses(prev => ({ ...prev, [jobId]: data }));

    if (data.status === 'running') {
      if (category === 'news-update') setUpdating(true);
      else setFtUpdating(true);
      return;
    }

    if (category === 'news-update') {
      setUpdating(false);
      setPullJobId(prev => (prev === jobId ? null : prev));
    } else {
      setFtUpdating(false);
      setFtJobId(prev => (prev === jobId ? null : prev));
    }

    if (data.status === 'done') {
      fetchNews(searchQueryRef.current || undefined);
    } else if (data.status === 'failed') {
      setError(data.error || 'Job failed');
    }
  }, [fetchNews]);

  const handleFulltextUpdate = async (sourceType: FtSourceType = 'all') => {
    if (ftUpdating) return;
    setLastFtSourceType(sourceType);
    setFtUpdating(true);
    setError(null);
    try {
      const concurrency = sourceType === 'fmp_press_release'
        ? getFmpPrFulltextConcurrency()
        : sourceType === 'fmp_stock_news'
          ? getFmpStockFulltextConcurrency()
        : getFulltextConcurrency();
      const endpoint = sourceType === 'rtpr'
        ? `${API_BASE}/api/news/fulltext/backfill-rtpr`
        : `${API_BASE}/api/news/fulltext/update`;
      const payload = sourceType === 'rtpr'
        ? { concurrency, scope: NEWS_JOB_SCOPE }
        : sourceType === 'fmp_press_release'
          ? { sourceType: 'fmp_press_release', sourceName: 'FMP', concurrency, scope: NEWS_JOB_SCOPE }
        : sourceType === 'fmp_stock_news'
          ? { sourceType: 'fmp_stock_news', sourceName: 'FMP', concurrency, scope: NEWS_JOB_SCOPE }
        : sourceType === 'fmp_sec_filing'
          ? { sourceType: 'fmp_sec_filing', sourceName: 'FMP', concurrency, scope: NEWS_JOB_SCOPE }
        : { sourceType, concurrency, scope: NEWS_JOB_SCOPE };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setFtUpdating(false);
        return;
      }
      registerJob(data.jobId, 'news-fulltext');
    } catch (err: any) {
      setError(err.message || 'Failed to start fulltext extraction');
      setFtUpdating(false);
    }
  };

  /** Reset failed/unavailable fulltext rows and start re-extraction */
  const handleResetAndRetry = async () => {
    if (ftUpdating) return;
    try {
      const resetRes = await fetch(`${API_BASE}/api/news/fulltext/reset-failed`, { method: 'POST' });
      const resetData = await resetRes.json();
      console.log(`[fulltext] reset-failed: deleted ${resetData.deleted} rows`);
    } catch (err: any) {
      console.error('[fulltext] reset-failed error:', err);
    }
    // Now trigger full extraction for all items
    await handleFulltextUpdate('all');
  };

  const handleResetFmpPrFallbackAndRetry = async () => {
    if (ftUpdating) return;
    try {
      const resetRes = await fetch(`${API_BASE}/api/news/fulltext/reset-fmp-pr-fallback`, { method: 'POST' });
      const resetData = await resetRes.json();
      if (!resetRes.ok) {
        setError(resetData.error || `HTTP ${resetRes.status}`);
        return;
      }
      console.log(`[fulltext] reset-fmp-pr-fallback: deleted ${resetData.deleted} rows`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset stale FMP PR fulltext rows');
      return;
    }
    await handleFulltextUpdate('fmp_press_release');
  };

  const handleResetFmpStockFallbackAndRetry = async () => {
    if (ftUpdating) return;
    try {
      const resetRes = await fetch(`${API_BASE}/api/news/fulltext/reset-fmp-stock-fallback`, { method: 'POST' });
      const resetData = await resetRes.json();
      if (!resetRes.ok) {
        setError(resetData.error || `HTTP ${resetRes.status}`);
        return;
      }
      console.log(`[fulltext] reset-fmp-stock-fallback: deleted ${resetData.deleted} rows`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset stale FMP stock fulltext rows');
      return;
    }
    await handleFulltextUpdate('fmp_stock_news');
  };

  // ─── Main button label (reflects last used config) ───
  const mainBtnLabel = (() => {
    const m = lastUpdateConfig.mode;
    const s = lastUpdateConfig.sourceType;
    const modeStr = m === '7d' ? '7d' : m === 'recent' ? 'Recent' : 'Custom';
    if (s === 'all') return `${modeStr} Update`;
    return `${modeStr} ${getSourceTypeShortLabel(s)}`;
  })();

  // ─── Main button click: repeat last used config ───
  const handleMainButtonClick = () => {
    const { mode, sourceType } = lastUpdateConfig;
    if (mode === 'recent') { handleRecentWithPreflight(sourceType); }
    else if (mode === 'custom') { handleCustomStart(sourceType); }
    else { handleUpdate('7d', sourceType); }
  };

  // ─── Poll background job status ───
  useEffect(() => {
    if (!pullJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${pullJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.scope && data.scope !== NEWS_JOB_SCOPE) return;
        syncJobState(pullJobId, 'news-update', data);
      } catch {
        // Ignore transient fetch errors; will retry next interval
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullJobId, syncJobState]);

  useEffect(() => {
    if (!ftJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${ftJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.scope && data.scope !== NEWS_JOB_SCOPE) return;
        syncJobState(ftJobId, 'news-fulltext', data);
      } catch {
        // Ignore transient fetch errors; will retry next interval
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftJobId, syncJobState]);

  // Auto-reconnect to running job after page refresh + refresh active jobs list
  useEffect(() => {
    let cancelled = false;
    const refreshActiveJobs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/active`);
        if (!res.ok || cancelled) return;
        const jobs: ActiveTrackedJob[] = await res.json();
        if (cancelled) return;
        const trackedJobs = jobs.filter(
          (job) => job.scope === NEWS_JOB_SCOPE && (job.category === 'news-update' || job.category === 'news-fulltext')
        );
        setActiveJobs(trackedJobs);

        const sortedJobs = [...trackedJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latestPullJob = sortedJobs.find((job) => job.category === 'news-update') ?? null;
        const latestFulltextJob = sortedJobs.find((job) => job.category === 'news-fulltext') ?? null;

        setUpdating(Boolean(latestPullJob));
        setFtUpdating(Boolean(latestFulltextJob));
        setPullJobId(latestPullJob?.id ?? null);
        setFtJobId(latestFulltextJob?.id ?? null);

        const hasSelectedActiveJob = selectedJobId ? trackedJobs.some((job) => job.id === selectedJobId) : false;
        if (sortedJobs.length > 0 && (!selectedJobId || !hasSelectedActiveJob)) {
          setSelectedJobId(sortedJobs[0].id);
          if (!selectedJobId) {
            setShowLogPanel(true);
          }
        }
      } catch { /* ignore — server may be down */ }
    };
    refreshActiveJobs();
    const timer = setInterval(refreshActiveJobs, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  // Auto-scroll only the log panel itself so the outer page/window position stays stable
  useEffect(() => {
    if (!showLogPanel) return;
    const logElement = logScrollRef.current;
    if (!logElement) return;

    const scrollToBottom = () => {
      logElement.scrollTop = logElement.scrollHeight;
    };

    scrollToBottom();
    const frameId = globalThis.requestAnimationFrame(scrollToBottom);
    return () => globalThis.cancelAnimationFrame(frameId);
  }, [selectedJobStatus?.logs?.length, showLogPanel]);

  // ESC key closes log panel
  useEffect(() => {
    if (!showLogPanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLogPanel(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showLogPanel]);

  // ─── Dynamic height ───
  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) setListHeight(listContainerRef.current.clientHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (listContainerRef.current) observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Close menus on outside click ───
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) setShowFilterMenu(false);
      if (watchlistMenuRef.current && !watchlistMenuRef.current.contains(event.target as Node)) setShowWatchlistMenu(false);
      if (loadMenuRef.current && !loadMenuRef.current.contains(event.target as Node)) setShowLoadMenu(false);
      if (displayModeMenuRef.current && !displayModeMenuRef.current.contains(event.target as Node)) setShowDisplayModeMenu(false);
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) setShowColumnMenu(false);
    };
    if (showFilterMenu || showWatchlistMenu || showLoadMenu || showDisplayModeMenu || showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterMenu, showWatchlistMenu, showLoadMenu, showDisplayModeMenu, showColumnMenu]);

  // ─── Sort helper ───
  const getSortValue = useCallback((item: DisplayItem, col: ColumnId): string | number => {
    switch (col) {
      case 'date': return item.publishedAt;
      case 'ticker': return item.ticker.toLowerCase();
      case 'time': return item.time;
      case 'title': return item.title.toLowerCase();
      case 'publisher': return (item.publisher ?? '').toLowerCase();
      case 'industry': return (item.industry ?? '').toLowerCase();
      case 'ipoDate': return item.ipoDate ?? '';
      case 'marketCap': return item.marketCap ?? -Infinity;
      case 'floatPct': return item.floatPct ?? -Infinity;
      case 'institutionalPct': return item.institutionalPct ?? -Infinity;
      case 'insiderPct': return item.insiderPct ?? -Infinity;
      case 'earningsDates': return item.earningsContextDisplay?.toLowerCase() ?? '';
      case 'source': return item.source.toLowerCase();
      case 'fulltext': return item.hasFullText ? 1 : 0;
      case 'changes': return item.changeFromOpenPct ?? 0;
      case 'hv': return item.hvChangePct ?? 0;
      case 'zscore': return item.zscoreChangePct ?? 0;
      case 'keywords': return item.keywords.length;
      case 'score': return item.score ?? -Infinity;
      case 'scoreEvidence': return (item.scoreEvidence ?? '').toLowerCase();
      case 'sentiment': return item.sentiment ?? -Infinity;
      case 'peers': return item.peers.length;
      case 'companyDesc': return (item.companyDesc ?? '').toLowerCase();
    }
  }, []);

  const handleSortClick = (colId: ColumnId) => {
    setSort(prev => {
      if (prev.column !== colId) return { column: colId, dir: 'asc' };
      if (prev.dir === 'asc') return { column: colId, dir: 'desc' };
      return { column: null, dir: null };
    });
  };

  // ─── Sort + Group (search is now server-side) ───
  const groupedNews = useMemo(() => {
    let filtered = [...newsData];

    if (sort.column && sort.dir) {
      const col = sort.column;
      const dir = sort.dir === 'asc' ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        const va = getSortValue(a, col);
        const vb = getSortValue(b, col);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }

    const groups = new Map<string, DisplayItem[]>();
    filtered.forEach(item => {
      if (!groups.has(item.date)) groups.set(item.date, []);
      groups.get(item.date)!.push(item);
    });

    const result: Array<{ type: 'header'; date: string } | { type: 'item'; item: DisplayItem } | { type: 'load-more' }> = [];
    groups.forEach((items, date) => {
      result.push({ type: 'header', date });
      items.forEach(item => result.push({ type: 'item', item }));
    });
    // Append load-more sentinel if there's a next page
    if (nextCursor) {
      result.push({ type: 'load-more' });
    }
    return result;
  }, [newsData, sort, getSortValue, nextCursor]);

  const findStickyDateForIndex = useCallback((index: number) => {
    for (let i = Math.min(index, groupedNews.length - 1); i >= 0; i--) {
      const item = groupedNews[i];
      if (item?.type === 'header') {
        return item.date;
      }
    }
    return groupedNews.length > 0 && groupedNews[0]?.type === 'header' ? groupedNews[0].date : '';
  }, [groupedNews]);

  // Reset list on data/mode/expand changes
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [groupedNews, displayMode, expandedItems]);

  useEffect(() => {
    setStickyDate(findStickyDateForIndex(0));
  }, [findStickyDateForIndex]);

  const getItemSize = useCallback((index: number) => {
    const item = groupedNews[index];
    if (item.type === 'header') return STICKY_DATE_HEADER_HEIGHT;
    if (item.type === 'load-more') return 48;
    if (displayMode === 'title-abstract') return ROW_HEIGHT_WITH_ABSTRACT;
    if (expandedItems.has(item.item.id)) return ROW_HEIGHT_WITH_ABSTRACT;
    return ROW_HEIGHT_TITLE_ONLY;
  }, [groupedNews, displayMode, expandedItems]);

  const toggleExpand = useCallback((id: string) => {
    if (displayMode !== 'title-only') return;
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [displayMode]);

  // ─── Persist UI state (visibleCols / displayMode / sourceTypeFilter / projection / searchQuery / tickerQuery / fromDate / toDate) ───
  useEffect(() => {
    try {
      localStorage.setItem('finhub-news-ui-state', JSON.stringify({
        visibleCols: Array.from(visibleCols),
        displayMode,
        newsProjection,
        sourceTypeFilter,
        searchQuery,
        tickerQuery,
        fromDate,
        toDate,
        floatPctMin,
        floatPctMax,
        institutionalPctMin,
        institutionalPctMax,
        insiderPctMin,
        insiderPctMax,
        selectedBookmarkFolderId,
      }));
    } catch { /* quota / SSR */ }
  }, [visibleCols, displayMode, newsProjection, sourceTypeFilter, searchQuery, tickerQuery, fromDate, toDate, floatPctMin, floatPctMax, institutionalPctMin, institutionalPctMax, insiderPctMin, insiderPctMax, selectedBookmarkFolderId]);

  // ─── Save / Load ───
  const handleSaveSearch = () => {
    if (!saveName.trim()) return;
    setSavedSearches(prev => [...prev, { id: Date.now().toString(), name: saveName, searchQuery, sourceTypeFilter }]);
    setSaveName('');
    setShowSaveModal(false);
  };
  const handleLoadSearch = (search: SavedSearch) => {
    setSearchQuery(search.searchQuery);
    setSourceTypeFilter(search.sourceTypeFilter);
    setShowLoadMenu(false);
    fetchNews(search.searchQuery || undefined);
  };
  const handleDeleteSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedSearches(prev => prev.filter(s => s.id !== id));
  };

  // ─── Column drag handlers ───
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragColIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragColIdx === null || dragColIdx === idx) { setDragColIdx(null); setDragOverIdx(null); return; }
    const next = [...columns];
    const [removed] = next.splice(dragColIdx, 1);
    next.splice(idx, 0, removed);
    setColumns(next);
    setDragColIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragColIdx(null); setDragOverIdx(null); };

  // ─── Column resize handlers ───
  const handleResizeStart = useCallback((colIdx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const minW = columns[resizingRef.current.colIdx]?.minWidth ?? 30;
      const newWidth = Math.max(minW, resizingRef.current.startWidth + delta);
      setColWidths(prev => {
        const next = [...prev];
        next[resizingRef.current!.colIdx] = newWidth;
        return next;
      });
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths, columns]);

  // ─── Render cell by column id ───
  const renderCell = useCallback((colId: ColumnId, newsItem: DisplayItem, isExpanded: boolean) => {
    const renderLinkCell = (label: string | null | undefined, fallbackClassName: string, href?: string | null) => (
      <span
        className={`truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${fallbackClassName}`}
        title={href ? 'Click to open link. Right click to copy URL.' : (label ?? '-')}
        onClick={(e) => {
          e.stopPropagation();
          if (href) openExternalUrl(href);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!href) return;
          setSourceCtxMenu({ x: e.clientX, y: e.clientY, url: href });
        }}
      >
        {label ?? '-'}
      </span>
    );

    switch (colId) {
      case 'date':
        return <span className="text-gray-600 dark:text-gray-400">{newsItem.date.replace(/, \d{4}$/, '')}</span>;
      case 'ticker':
        return newsItem.ticker ? (
          <span
            className="inline-block px-1.5 py-0.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60 truncate"
            onClick={(e) => { e.stopPropagation(); setSearchQuery(newsItem.ticker); onTickerClick?.(newsItem.ticker); fetchNews(newsItem.ticker); }}
            {...getCompanyTickerDataAttrs(newsItem.ticker)}
            title={`Click to filter by ${newsItem.ticker}`}
          >
            {newsItem.ticker}
          </span>
        ) : <span className="text-gray-300 dark:text-gray-600">—</span>;
      case 'time':
        return <span className="text-gray-600 dark:text-gray-400">{newsItem.time}</span>;
      case 'title':
        return (
          <div
            className={`flex flex-col w-full min-w-0 overflow-hidden ${displayMode === 'title-only' ? 'cursor-pointer' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleExpand(newsItem.id); }}
            title={displayMode === 'title-only' ? 'Click to toggle abstract' : undefined}
          >
            <div className="flex items-center gap-1.5">
              {newsItem.ticker && (
                <span
                  className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60 shrink-0"
                  onClick={(e) => { e.stopPropagation(); onTickerClick?.(newsItem.ticker); }}
                  {...getCompanyTickerDataAttrs(newsItem.ticker)}
                >
                  {newsItem.ticker}
                </span>
              )}
              <span
                style={{ fontSize: titleFontSize }}
                className={`truncate text-gray-900 dark:text-gray-100 ${displayMode === 'title-only' ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
              >
                {newsItem.title}
              </span>
            </div>
            {isExpanded && newsItem.body && (
              <p style={{ fontSize: summaryFontSize }} className="mt-1 text-gray-500 dark:text-gray-400 line-clamp-3 whitespace-normal break-words">
                {newsItem.body}
              </p>
            )}
            {newsItem.sourceType && (
              <span className={`mt-1 inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${getSourceTypeBadgeClass(newsItem.sourceType)}`}>
                {getSourceTypeBadgeLabel(newsItem.sourceType)}
              </span>
            )}
          </div>
        );
      case 'publisher': {
        const pubHref = newsItem.originUrl || (newsItem.url?.startsWith('http') ? newsItem.url : null);
        return renderLinkCell(newsItem.publisher, 'text-gray-600 dark:text-gray-400', pubHref);
      }
      case 'industry':
        return <span className="truncate text-gray-600 dark:text-gray-400" title={newsItem.industry ?? undefined}>{newsItem.industry ?? '-'}</span>;
      case 'ipoDate':
        return <span className="truncate text-gray-600 dark:text-gray-400" title={newsItem.ipoDate ?? undefined}>{newsItem.ipoDate ?? '-'}</span>;
      case 'marketCap':
        return <span className="truncate text-gray-600 dark:text-gray-400 tabular-nums">{formatMarketCap(newsItem.marketCap)}</span>;
      case 'floatPct':
        return <span className="truncate text-gray-600 dark:text-gray-400 tabular-nums">{formatOwnershipPct(newsItem.floatPct)}</span>;
      case 'institutionalPct':
        return <span className="truncate text-gray-600 dark:text-gray-400 tabular-nums">{formatOwnershipPct(newsItem.institutionalPct)}</span>;
      case 'insiderPct':
        return <span className="truncate text-gray-600 dark:text-gray-400 tabular-nums">{formatOwnershipPct(newsItem.insiderPct)}</span>;
      case 'earningsDates': {
        if (!newsItem.earningsContextDisplay && !newsItem.recentEarningsDate && !newsItem.upcomingEarningsDate) {
          return <span className="text-gray-300 dark:text-gray-600">—</span>;
        }
        const recentLabel = newsItem.recentEarningsDate
          ? `${newsItem.recentEarningsDate} (${formatEarningsStatus(newsItem.recentEarningsConfirmed)})`
          : '-';
        const upcomingLabel = newsItem.upcomingEarningsDate
          ? `${newsItem.upcomingEarningsDate} (${formatEarningsStatus(newsItem.upcomingEarningsConfirmed)})`
          : '-';
        return (
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight" title={newsItem.earningsContextDisplay ?? `Recent ${recentLabel} | Upcoming ${upcomingLabel}`}>
            <span className="truncate text-gray-600 dark:text-gray-400">Recent {recentLabel}</span>
            <span className="truncate text-gray-600 dark:text-gray-400">Upcoming {upcomingLabel}</span>
          </div>
        );
      }
      case 'source': {
        const sourceHref = newsItem.originUrl || (newsItem.url?.startsWith('http') ? newsItem.url : null);
        return renderLinkCell(newsItem.source, 'text-gray-600 dark:text-gray-400', sourceHref);
      }
      case 'fulltext':
        return newsItem.hasFullText ? (
          <span
            className="text-green-600 dark:text-green-400 font-semibold cursor-pointer hover:underline"
            title="Click to view full text"
            onClick={(e) => { e.stopPropagation(); fetchFulltext(newsItem.id, newsItem.title); }}
          >
            O
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">X</span>
        );
      case 'changes':
        return (
          <div className="flex flex-col justify-center gap-0.5 w-full text-[11px] leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">Chg:</span>
              <span className={changeColor(newsItem.changePct)}>{formatChange(newsItem.changePct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→C:</span>
              <span className={changeColor(newsItem.changeFromOpenPct)}>{formatChange(newsItem.changeFromOpenPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→H:</span>
              <span className={changeColor(newsItem.changeOpenToHighPct)}>{formatChange(newsItem.changeOpenToHighPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+1D:</span>
              <span className={changeColor(newsItem.change1dPct)}>{formatChange(newsItem.change1dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+3D:</span>
              <span className={changeColor(newsItem.change3dPct)}>{formatChange(newsItem.change3dPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+7D:</span>
              <span className={changeColor(newsItem.change7dPct)}>{formatChange(newsItem.change7dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+14D:</span>
              <span className={changeColor(newsItem.change14dPct)}>{formatChange(newsItem.change14dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+30D:</span>
              <span className={changeColor(newsItem.change30dPct)}>{formatChange(newsItem.change30dPct)}</span>
            </div>
          </div>
        );
      case 'hv':
        return (
          <div className="flex flex-col justify-center gap-0.5 w-full text-[11px] leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">Chg:</span>
              <span className={changeColor(newsItem.hvChangePct)}>{formatChange(newsItem.hvChangePct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→C:</span>
              <span className={changeColor(newsItem.hvChangeFromOpenPct)}>{formatChange(newsItem.hvChangeFromOpenPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→H:</span>
              <span className={changeColor(newsItem.hvChangeOpenToHighPct)}>{formatChange(newsItem.hvChangeOpenToHighPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+1D:</span>
              <span className={changeColor(newsItem.hvChange1dPct)}>{formatChange(newsItem.hvChange1dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+3D:</span>
              <span className={changeColor(newsItem.hvChange3dPct)}>{formatChange(newsItem.hvChange3dPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+7D:</span>
              <span className={changeColor(newsItem.hvChange7dPct)}>{formatChange(newsItem.hvChange7dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+14D:</span>
              <span className={changeColor(newsItem.hvChange14dPct)}>{formatChange(newsItem.hvChange14dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+30D:</span>
              <span className={changeColor(newsItem.hvChange30dPct)}>{formatChange(newsItem.hvChange30dPct)}</span>
            </div>
          </div>
        );
      case 'zscore':
        return (
          <div className="flex flex-col justify-center gap-0.5 w-full text-[11px] leading-tight">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">Chg:</span>
              <span className={changeColor(newsItem.zscoreChangePct)}>{formatZScore(newsItem.zscoreChangePct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→C:</span>
              <span className={changeColor(newsItem.zscoreChangeFromOpenPct)}>{formatZScore(newsItem.zscoreChangeFromOpenPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→H:</span>
              <span className={changeColor(newsItem.zscoreChangeOpenToHighPct)}>{formatZScore(newsItem.zscoreChangeOpenToHighPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+1D:</span>
              <span className={changeColor(newsItem.zscoreChange1dPct)}>{formatZScore(newsItem.zscoreChange1dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+3D:</span>
              <span className={changeColor(newsItem.zscoreChange3dPct)}>{formatZScore(newsItem.zscoreChange3dPct)}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-500 shrink-0">+7D:</span>
              <span className={changeColor(newsItem.zscoreChange7dPct)}>{formatZScore(newsItem.zscoreChange7dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+14D:</span>
              <span className={changeColor(newsItem.zscoreChange14dPct)}>{formatZScore(newsItem.zscoreChange14dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+30D:</span>
              <span className={changeColor(newsItem.zscoreChange30dPct)}>{formatZScore(newsItem.zscoreChange30dPct)}</span>
            </div>
          </div>
        );
      case 'keywords':
        return newsItem.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 overflow-hidden" title={newsItem.keywords.join(', ')}>
            {newsItem.keywords.slice(0, 4).map((kw, i) => (
              <span key={i} className="inline-block px-1 py-0 text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded truncate max-w-[80px]">
                {kw}
              </span>
            ))}
            {newsItem.keywords.length > 4 && (
              <span className="text-[9px] text-gray-400">+{newsItem.keywords.length - 4}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        );
      case 'score': {
        const s = newsItem.score;
        if (s === null || s === undefined) return <span className="text-gray-300 dark:text-gray-600">—</span>;
        const c = s > 0 ? 'text-green-600 dark:text-green-400' : s < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
        const label = s > 0 ? `+${s}` : String(s);
        return <span className={`font-semibold tabular-nums ${c}`} title={`AI Score: ${s}`}>{label}</span>;
      }
      case 'scoreEvidence':
        if (!newsItem.scoreEvidence) return <span className="text-gray-300 dark:text-gray-600">—</span>;
        return (
          <span className="truncate text-gray-600 dark:text-gray-400" title={newsItem.scoreEvidence}>
            {newsItem.scoreEvidence}
          </span>
        );
      case 'sentiment': {
        const sv = newsItem.sentiment;
        if (sv === null || sv === undefined) return <span className="text-gray-300 dark:text-gray-600">—</span>;
        const sc = sv > 0 ? 'text-green-600 dark:text-green-400' : sv < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
        return <span className={sc} title={newsItem.sentimentLabel ?? undefined}>{sv.toFixed(2)}</span>;
      }
      case 'peers':
        return newsItem.peers.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 overflow-hidden" title={newsItem.peers.join(', ')}>
            {newsItem.peers.slice(0, 4).map((p, i) => (
              <span key={i} className="inline-block px-1 py-0 text-[9px] bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded truncate max-w-[60px]"
                    onClick={(e) => { e.stopPropagation(); setSearchQuery(p); onTickerClick?.(p); fetchNews(p); }}
                    style={{ cursor: 'pointer' }}>
                {p}
              </span>
            ))}
            {newsItem.peers.length > 4 && (
              <span className="text-[9px] text-gray-400">+{newsItem.peers.length - 4}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        );
      case 'companyDesc':
        return newsItem.companyDesc ? (
          <span
            className="text-[10px] text-gray-600 dark:text-gray-400 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            title="Click to view full description"
            onClick={(e) => { e.stopPropagation(); setDescPopup({ ticker: newsItem.ticker, text: newsItem.companyDesc! }); }}
          >
            {newsItem.companyDesc}
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        );
    }
  }, [displayMode, toggleExpand, onTickerClick, openExternalUrl, setSearchQuery, fetchFulltext, titleFontSize, summaryFontSize, setDescPopup]);

  // ─── Row renderer ───
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = groupedNews[index];
    if (item.type === 'header') {
      return (
        <div style={style} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{item.date}</span>
        </div>
      );
    }

    if (item.type === 'load-more') {
      return (
        <div style={style} className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          {loadingMore ? (
            <span className="animate-pulse">Loading more…</span>
          ) : (
            <button
              onClick={fetchMore}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Load more ({newsData.length} loaded)
            </button>
          )}
        </div>
      );
    }

    const newsItem = item.item;
    const isExpanded = displayMode === 'title-abstract' || expandedItems.has(newsItem.id);

    return (
      <div
        style={style}
        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
        onContextMenu={(e) => {
          e.preventDefault();
          setRowCtxMenu({ x: e.clientX, y: e.clientY, newsId: newsItem.id });
        }}
      >
        <div className="h-full flex items-stretch text-xs">
          {activeColumns.map((col, colIdx) => {
            const isLast = colIdx === activeColumns.length - 1;
            return (
              <div
                key={col.id}
                className={[
                  'shrink-0 px-2 flex overflow-hidden',
                  col.id === 'title' ? 'px-3 items-start pt-2' : 'items-center',
                  !isLast ? 'border-r border-gray-200 dark:border-gray-700' : '',
                  ['changes', 'hv', 'zscore'].includes(col.id) ? 'py-1' : '',
                ].join(' ')}
                style={{ width: activeColWidths[colIdx], minWidth: col.minWidth }}
              >
                {renderCell(col.id, newsItem, isExpanded)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [groupedNews, activeColumns, activeColWidths, displayMode, expandedItems, renderCell, loadingMore, fetchMore, newsData.length]);

  const displayModeLabel = displayMode === 'title-only' ? 'Title Only' : 'Title + Abstract';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-sm">
      <div className="px-3 pt-3 pb-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="xl:w-[560px] 2xl:w-[620px] shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-3 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Search</div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Make search and date range readable first, then keep actions grouped on the right.</div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
                placeholder="Search news, title, abstract... (Enter)"
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={tickerQuery}
                onChange={(e) => setTickerQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
                placeholder="Ticker only: AAPL, TSLA, NVDA... (Enter)"
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">From</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full min-w-0 pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">To</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full min-w-0 pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="min-w-0 flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30 p-3 space-y-3">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Source Filter</div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'company_news', 'press_release', 'fmp_press_release', 'fmp_stock_news', 'fmp_sec_filing', 'market_news'] as SourceTypeFilter[]).map(st => (
                  <button
                    key={st}
                    onClick={() => setSourceTypeFilter(st)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                      sourceTypeFilter === st
                        ? 'bg-blue-500 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {getSourceTypeLabel(st)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <button
                  onClick={() => setNewsProjection('full')}
                  className={`px-2.5 py-1.5 text-[11px] whitespace-nowrap transition-colors ${
                    newsProjection === 'full'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                  title="General news view with full payload"
                >
                  Full View
                </button>
                <button
                  onClick={() => setNewsProjection('model1-safe')}
                  className={`px-2.5 py-1.5 text-[11px] whitespace-nowrap transition-colors ${
                    newsProjection === 'model1-safe'
                      ? 'bg-emerald-600 text-white'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                  title="Model_1 safe view: uses /api/model1/news and hides current change columns"
                >
                  Model_1 Safe
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowBookmarkMenu(prev => !prev)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900"
                  title="Bookmark view"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    {selectedBookmarkFolderId
                      ? (bookmarkFolders.find((folder) => folder.id === selectedBookmarkFolderId)?.name ?? 'Bookmark view')
                      : 'Bookmark view'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showBookmarkMenu && (
                  <div className="absolute top-full left-0 mt-1 w-56 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-30 overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedBookmarkFolderId('');
                        setShowBookmarkMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedBookmarkFolderId === '' ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                    >
                      All news
                    </button>
                    {bookmarkFolders.map((folder) => (
                      <div key={folder.id} className="relative">
                        {editingBookmarkFolderId === folder.id ? (
                          <form
                            className="px-2 py-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleRenameBookmarkFolder(folder.id, editingBookmarkFolderName);
                            }}
                          >
                            <input
                              autoFocus
                              value={editingBookmarkFolderName}
                              onChange={(e) => setEditingBookmarkFolderName(e.target.value)}
                              onBlur={() => handleRenameBookmarkFolder(folder.id, editingBookmarkFolderName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingBookmarkFolderId(null);
                                  setEditingBookmarkFolderName('');
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-blue-400 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </form>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedBookmarkFolderId(folder.id);
                              setShowBookmarkMenu(false);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setBookmarkFolderCtxMenu({ x: e.clientX, y: e.clientY, folderId: folder.id });
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedBookmarkFolderId === folder.id ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                          >
                            {folder.name}
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    {showNewFolderInput ? (
                      <form
                        className="flex items-center gap-1 px-2 py-1.5"
                        onSubmit={(e) => { e.preventDefault(); handleCreateFolder(newFolderName); }}
                      >
                        <input
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder name"
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
                        />
                        <button type="submit" className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">OK</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowNewFolderInput(true)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
                      >
                        <Plus className="w-3 h-3" /> New folder
                      </button>
                    )}
                    <button
                      onClick={() => { setShowBookmarkMenu(false); setShowBookmarkManager(true); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5 text-gray-600 dark:text-gray-400"
                    >
                      <Settings2 className="w-3 h-3" /> Bookmark Manager
                    </button>
                  </div>
                )}
                {showBookmarkMenu && bookmarkFolderCtxMenu && (
                  <div
                    ref={bookmarkFolderCtxMenuRef}
                    className="fixed z-[60] min-w-[140px] overflow-hidden rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
                    style={{
                      left: Math.min(bookmarkFolderCtxMenu.x, typeof window !== 'undefined' ? window.innerWidth - 160 : bookmarkFolderCtxMenu.x),
                      top: Math.min(bookmarkFolderCtxMenu.y, typeof window !== 'undefined' ? window.innerHeight - 116 : bookmarkFolderCtxMenu.y),
                    }}
                  >
                    <button
                      onClick={() => {
                        void handleCopyBookmarkFolderName(bookmarkFolderCtxMenu.folderId);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Copy bookmark name
                    </button>
                    <button
                      onClick={() => {
                        const folder = bookmarkFolders.find((item) => item.id === bookmarkFolderCtxMenu.folderId);
                        if (folder) startRenameBookmarkFolder(folder);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Rename
                    </button>
                  </div>
                )}
              </div>

              <div className="relative" ref={displayModeMenuRef}>
                <button
                  onClick={() => { setShowDisplayModeMenu(!showDisplayModeMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowWatchlistMenu(false); }}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900"
                  title="Display mode"
                >
                  {displayMode === 'title-only'
                    ? <FileText className="w-3 h-3 text-gray-500" />
                    : <AlignLeft className="w-3 h-3 text-blue-500" />
                  }
                  <span className="whitespace-nowrap">{displayModeLabel}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showDisplayModeMenu && (
                  <div className="absolute top-full mt-1 left-0 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                    <div className="p-1.5">
                      <button
                        onClick={() => { setDisplayMode('title-only'); setExpandedItems(new Set()); setShowDisplayModeMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 ${displayMode === 'title-only' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : ''}`}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">Title Only</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Click title to show body</div>
                        </div>
                      </button>
                      <button
                        onClick={() => { setDisplayMode('title-abstract'); setExpandedItems(new Set()); setShowDisplayModeMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 ${displayMode === 'title-abstract' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : ''}`}
                      >
                        <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">Title + Body</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Always show body excerpt</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const [showUpdateMenu, setShowUpdateMenu] = React.useState(false);
                const updateMenuRef = React.useRef<HTMLDivElement>(null);

                React.useEffect(() => {
                  if (!showUpdateMenu) return;
                  const handler = (e: MouseEvent) => {
                    if (updateMenuRef.current && !updateMenuRef.current.contains(e.target as Node)) setShowUpdateMenu(false);
                  };
                  document.addEventListener('mousedown', handler);
                  return () => document.removeEventListener('mousedown', handler);
                }, [showUpdateMenu]);

                return (
                  <div className="relative flex" ref={updateMenuRef}>
                {/* Main button — repeats last used update */}
                <button
                  onClick={handleMainButtonClick}
                  disabled={updating}
                  className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 bg-white dark:bg-gray-900"
                  title={`Repeat last update: ${mainBtnLabel}`}
                >
                  <Download className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
                  <span className="text-xs">{updating ? 'Pulling...' : mainBtnLabel}</span>
                </button>
                {/* Dropdown arrow */}
                <button
                  onClick={() => setShowUpdateMenu(!showUpdateMenu)}
                  disabled={updating}
                  className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r-lg hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50 bg-white dark:bg-gray-900"
                  title="More update options"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                {/* Dropdown menu */}
                {showUpdateMenu && (
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 max-h-[480px] overflow-y-auto">
                    <div className="p-1.5">
                      {/* ── 7d Update ── */}
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">7d Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); handleUpdate('7d', 'all'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <div><div className="font-medium">7d Update (All)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days · Company + Press + Market News</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleUpdate('7d', 'company_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <div><div className="font-medium">7d Company News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days · Company News only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleUpdate('7d', 'press_release'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5 shrink-0 text-green-500" />
                        <div><div className="font-medium">7d Press Release</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days · Press Releases only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleUpdate('7d', 'market_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">7d Market News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days within Finnhub market headline history</div></div>
                      </button>

                      {/* ── Recent Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        <span>Recent Update</span>
                      </div>
                      <div className="px-3 pb-2 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                        Auto recent skips previously confirmed-empty past ranges only after HTTP 200 + empty array. `company_news` and `press_release` are tracked separately, today is excluded, and `Custom Update` can still force a manual re-check.
                      </div>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('all'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                        <div><div className="font-medium">Recent Update (All)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">From last collected date · per ticker</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('company_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                        <div><div className="font-medium">Recent Company News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">From last collected · Company News only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('press_release'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                        <div><div className="font-medium">Recent Press Release</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">From last collected · Press Releases only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('fmp_press_release'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <div><div className="font-medium">Recent FMP PR</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Per-ticker incremental · full text included for new rows</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('fmp_stock_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">Recent FMP Stock</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Per-ticker incremental stock news · full text included for new rows</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('fmp_sec_filing'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                        <div><div className="font-medium">Recent FMP SEC Filing</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Per-ticker SEC fetch · filing summary included</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentWithPreflight('market_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">Recent Market News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Continue paging Finnhub /news from last stored timestamp</div></div>
                      </button>

                      {/* ── Custom Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('all'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                        <div><div className="font-medium">Custom Update (All)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · adaptive backfill</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('company_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                        <div><div className="font-medium">Custom Company News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · Company News only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('press_release'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                        <div><div className="font-medium">Custom Press Release</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · Press Releases only</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('fmp_press_release'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <div><div className="font-medium">Custom FMP PR</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · full text included for new rows</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('fmp_press_release_entire'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <div><div className="font-medium">Custom FMP PR (Entire Date)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · no gap skip, fetch full range per ticker</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('fmp_stock_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">Custom FMP Stock</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · per-ticker stock news backfill</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('fmp_sec_filing'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                        <div><div className="font-medium">Custom FMP SEC Filing</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · filing summary included</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('market_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">Custom Market News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · limited by Finnhub /news history depth</div></div>
                      </button>

                      {/* ── Change Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Change Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentChangeUpdate(); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                        <div><div className="font-medium">Recent Change% Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Recalculate change % and fill missing HV / Z Score for news from last 7 days</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); setChangeCustomFrom(''); setChangeCustomTo(new Date().toISOString().slice(0, 10)); setShowChangeCustomDateModal(true); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <div><div className="font-medium">Custom Change% Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · recalculate change % and fill missing HV / Z Score in range</div></div>
                      </button>

                      {/* ── Earnings Date Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Earning Date Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); setCalendarCustomFrom(fromDate || ''); setCalendarCustomTo(toDate || new Date().toISOString().slice(0, 10)); setShowCalendarCustomDateModal(true); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <div><div className="font-medium">Custom Earning Date Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick article date range · calendar DB first, FMP fallback only for missing context</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCheckUnconfirmedEarningDate(); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <div><div className="font-medium">Check Unconfirmed Earning Date</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">현재 결과 중 unconfirmed earnings context만 다시 확인합니다</div></div>
                      </button>
                      {/* ── PTPR Press Release ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">PTPR Press Release</div>
                      <button onClick={() => { setShowUpdateMenu(false); handlePtprUpdate('recent'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Download className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">Recent PTPR Press Release</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Per-ticker incremental · anchor + confirmed-empty skip</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handlePtprCustomStart(); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">Custom PTPR Press Release</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · per-ticker RTPR press release pull</div></div>
                      </button>

                      {/* ── How To Use ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <button onClick={() => {
                        setShowUpdateMenu(false);
                        const payload: DataControlHowToUseWindowData = {
                          key: 'finnhubNewsUpdate',
                          title: 'Finnhub News — Update 드롭다운 사용법',
                          summary: 'Custom Co. 버튼 드롭다운의 6개 카테고리 중 특히 Custom 계열이 어떻게 동작하는지 설명합니다. Custom은 무조건 지정한 전체 날짜를 다시 받는 것이 아니라, 버튼 종류에 따라 gap-only, fully-covered-skip, summary-only, preflight-only 방식으로 다르게 동작합니다.',
                          purpose: '워치리스트 종목에 대한 뉴스·earning date·PR 데이터를 수집하거나, 이미 저장된 뉴스의 change%를 다시 계산할 때 어떤 버튼을 눌러야 하는지와 Custom 실행 시 실제로 무엇이 다시 다운로드되는지를 구체적으로 안내합니다.',
                          whenToRun: [
                            '7d Update — 초기 세팅 직후 최근 7일 구간을 빠르게 채울 때 사용합니다. 최근 구간을 통째로 한번 받아오는 성격입니다.',
                            'Recent Update — 매일 또는 수시로 최신 뉴스만 증분 수집할 때 사용합니다. 운영 중에는 보통 이 버튼이 기본입니다.',
                            'Custom Update — 과거 특정 날짜 범위를 직접 지정할 때 사용합니다. Finnhub company news / press release, FMP PR / FMP stock news는 gap-only로 동작합니다.',
                            'Change Update — 뉴스를 다시 받는 버튼이 아니라, 이미 저장된 뉴스 행의 1D/5D 등 change%를 다시 계산할 때 사용합니다.',
                            'Earning Date Update — News Window 기사에 recent/upcoming earning date context를 붙이거나, 기존 unconfirmed row를 다시 확인할 때 사용합니다.',
                            'PTPR Press Release — RTPR press release를 ticker 기준으로 수집할 때 사용합니다. provider 제약 때문에 일반 custom gap-only와는 다르게 동작합니다.',
                          ],
                          inputs: [
                            '7d Update (All) = Company News + Press Release + Market News를 최근 7일 기준으로 동시에 실행합니다. 개별 버튼은 해당 소스만 따로 실행합니다.',
                            'Recent Update (All) = Company News, Press Release, FMP PR, FMP Stock, FMP SEC Filing, Market News를 최신 구간 기준으로 한 번에 갱신합니다.',
                            'Custom Update 공통 흐름 = 날짜 모달에서 from/to 입력 → 즉시 실행하지 않고 preflight API를 먼저 호출 → summary를 확인한 뒤 Continue를 눌러야 실제 job이 시작됩니다.',
                            'Custom gap-only 대상 = Finnhub Company News / Finnhub Press Release / FMP Press Release / FMP Stock News. 이들은 DB coverage envelope 바깥의 missing gap만 실제로 fetch합니다.',
                            '예: 요청 범위가 2026-01-01~2026-03-29이고 AAPL coverage가 2026-01-15~2026-03-10이면, 01-01~01-14와 03-11~03-29만 다시 호출하고 중간 구간은 재조회하지 않습니다.',
                            'Custom fully-covered-skip = PTPR. provider가 from/to 원격 조회를 직접 지원하지 않아, 요청 범위가 이미 fully covered면 skip하고 아니면 ticker별 custom 조회를 실행합니다.',
                            'Custom summary-only = FMP SEC Filing / Market News 계열. ticker별 gap 계산 대신 preflight에서 existingItemsInRange 같은 요약 수치를 보여주고, 실행은 요청 범위를 기준으로 진행합니다.',
                            'Change Update: Recent는 최근 7일 재계산, Custom은 지정 날짜 범위 재계산입니다. 뉴스 원문을 다시 받지 않습니다.',
                            'Earning Date Update: Custom은 지정한 기사 날짜 범위에 대해 calendar DB 기준 earning date context를 계산하고, Check Unconfirmed는 현재 결과 중 unconfirmed row만 다시 검사합니다.',
                          ],
                          cautions: [
                            'Custom의 핵심은 gap-only가 가능한 버튼과 아닌 버튼을 구분해서 보는 것입니다. 모든 Custom 버튼이 missing gap만 받는 것은 아닙니다.',
                            'gap-only에서 coverage는 개별 날짜 점이 아니라 min/max envelope 기준입니다. envelope 안쪽에 뉴스가 비어 있는 날짜는 다시 받지 않습니다.',
                            '같은 범위를 두 번 연속 실행하면 gap-only 대상 버튼은 두 번째 실행에서 많은 ticker가 fully covered로 판정되어 skip될 수 있습니다.',
                            '넓은 날짜 범위(예: 6개월~1년)를 주면 preflight의 totalMissingDays, totalMissingRanges를 먼저 보고 규모를 확인해야 합니다. 요약 수치가 크면 소스별로 나눠 실행하는 편이 안전합니다.',
                            'Change Update는 뉴스 다운로드가 아니라 재계산입니다. inserted가 늘지 않아도 정상일 수 있습니다.',
                            'Earning Date Update는 당일 FMP Earnings Calendar Update가 먼저 실행되어 있어야 합니다. backend가 stale 상태를 감지하면 412 오류로 차단합니다.',
                          ],
                          verify: [
                            'Custom 실행 전 preflight 모달에서 executionMode가 무엇인지 먼저 확인합니다. gap-only / fully-covered-skip / summary-only / preflight-only 중 어떤 방식인지 여기서 드러납니다.',
                            'gap-only 대상 버튼이면 preflight JSON에서 fullyCoveredTickers, tickersWithMissingGaps, totalMissingRanges, totalMissingDays를 확인합니다. 이 값이 작을수록 실제 API 호출이 줄어든 것입니다.',
                            'Examples에 AAPL 같은 샘플 ticker가 보이면 coveredRanges와 missingRanges가 앞뒤 gap 형태로만 나오는지 확인합니다. 중간 빈 날짜가 잘게 쪼개져 보이면 비정상입니다.',
                            'Continue 후에는 View Log에서 fullyCoveredSkipped, gapRangesFetched, inserted, skippedExisting 같은 summary를 확인합니다. fullyCoveredSkipped가 보이면 gap 절약 로직이 실제 실행에도 반영된 것입니다.',
                            'Change Update 완료 후에는 뉴스 행의 1D/5D 등 변동률 컬럼 값이 채워졌는지 확인하고, Earning Date Update 완료 후에는 Earnings Dates 컬럼 값이 채워졌는지 확인합니다.',
                          ],
                          route: 'POST /api/news/pull-finhub, /api/news/pull-fmp-press-release, /api/news/pull-fmp-stock-news, /api/news/pull-rtpr, /api/news/pull-investing, /api/news/change/update-custom, /api/news/earnings/update-custom, /api/news/earnings/check-unconfirmed',
                        };
                        window.dispatchEvent(new CustomEvent('open-data-control-how-to-use', { detail: payload }));
                      }} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <CircleHelp className="w-3.5 h-3.5 shrink-0" />
                        <div className="font-medium">How To Use</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
                );
              })()}

              <button
                onClick={() => {
                  const hasSelectedActiveJob = selectedJobId ? activeJobs.some((job) => job.id === selectedJobId) : false;
                  if ((!selectedJobId || !hasSelectedActiveJob) && activeJobs.length > 0) {
                    const latest = [...activeJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                    setSelectedJobId(latest.id);
                  }
                  if (selectedJobId || activeJobs.length > 0) {
                    setShowLogPanel(!showLogPanel);
                  }
                }}
                disabled={!selectedJobId && activeJobs.length === 0}
                className={`px-3 py-1.5 border rounded-lg transition-colors flex items-center gap-1.5 text-xs ${
                  !selectedJobId && activeJobs.length === 0
                    ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    : showLogPanel
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 bg-white dark:bg-gray-900'
                }`}
                title={selectedJobId ? 'View selected job logs and progress' : activeJobs.length > 0 ? 'View active jobs' : 'No active job — click Update or Full Text first'}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Log</span>
                {activeJobs.length > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold leading-none">{activeJobs.length}</span>
                )}
                {selectedJobStatus?.status === 'running' && (
                  <span className="ml-1 text-[10px] text-blue-500 tabular-nums">{selectedJobStatus.progress.pct}%</span>
                )}
                {selectedJobStatus?.status === 'done' && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
                )}
                {selectedJobStatus?.status === 'failed' && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
                )}
              </button>

              {(() => {
                const [showFtMenu, setShowFtMenu] = React.useState(false);
                const ftMenuRef = React.useRef<HTMLDivElement>(null);

                React.useEffect(() => {
                  if (!showFtMenu) return;
                  const handler = (e: MouseEvent) => {
                    if (ftMenuRef.current && !ftMenuRef.current.contains(e.target as Node)) setShowFtMenu(false);
                  };
                  document.addEventListener('mousedown', handler);
                  return () => document.removeEventListener('mousedown', handler);
                }, [showFtMenu]);

                const ftLabel = ftUpdating
                  ? 'Extracting...'
                  : lastFtSourceType === 'rtpr' ? 'FT RTPR'
                  : lastFtSourceType === 'fmp_press_release' ? 'FT FMP PR'
                  : lastFtSourceType === 'fmp_stock_news' ? 'FT FMP Stk'
                  : lastFtSourceType === 'fmp_sec_filing' ? 'FT SEC'
                  : lastFtSourceType === 'company_news' ? 'FT Co.'
                  : lastFtSourceType === 'press_release' ? 'FT PR'
                  : lastFtSourceType === 'market_news' ? 'FT Mkt.'
                  : 'Full Text';

                return (
                  <div className="relative flex" ref={ftMenuRef}>
                {/* Main button — repeats last used sourceType */}
                <button
                  onClick={() => handleFulltextUpdate(lastFtSourceType)}
                  disabled={ftUpdating}
                  className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50 bg-white dark:bg-gray-900"
                  title={lastFtSourceType === 'rtpr' ? 'Backfill RTPR full text from stored body' : `Extract full text (${getSourceTypeLabel(lastFtSourceType)})`}
                >
                  <FileText className={`w-3.5 h-3.5 text-orange-500 ${ftUpdating ? 'animate-pulse' : ''}`} />
                  <span>{ftLabel}</span>
                </button>
                {/* Dropdown arrow */}
                <button
                  onClick={() => setShowFtMenu(!showFtMenu)}
                  disabled={ftUpdating}
                  className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r-lg hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50 bg-white dark:bg-gray-900"
                  title="Choose source type for full text extraction"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                {/* Dropdown menu */}
                {showFtMenu && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
                    <div className="p-1.5">
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('all'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                        <div><div className="font-medium">Full Text (All)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Company + Press + Market News</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('company_news'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <div><div className="font-medium">Company News Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for company_news items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('press_release'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-green-500" />
                        <div><div className="font-medium">Press Release Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for press_release items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('fmp_press_release'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <div><div className="font-medium">FMP PR Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract only missing full text rows for FMP press releases</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('fmp_stock_news'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">FMP Stock Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract only missing full text rows for FMP stock news</div></div>
                      </button>
                      <button onClick={async () => { setShowFtMenu(false); await handleResetFmpPrFallbackAndRetry(); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50 text-emerald-700 dark:text-emerald-300">
                        <RotateCw className="w-3.5 h-3.5 shrink-0" />
                        <div><div className="font-medium">Reset FMP PR Fallback</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">기존 잘못된 fallback full text 삭제 후 missing-only update 재실행</div></div>
                      </button>
                      <button onClick={async () => { setShowFtMenu(false); await handleResetFmpStockFallbackAndRetry(); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50 text-cyan-700 dark:text-cyan-300">
                        <RotateCw className="w-3.5 h-3.5 shrink-0" />
                        <div><div className="font-medium">Reset FMP Stock Fallback</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">FMP stock news body-fallback(가짜 성공) 삭제 → PR wire만 재추출</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('fmp_sec_filing'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                        <div><div className="font-medium">FMP SEC Filing Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract full text and refresh summary/body for SEC filing items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('market_news'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">Market News Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Attempt extraction for market_news items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('rtpr'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">RTPR Body Backfill</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">저장된 RTPR body로 누락 full text 채우기</div></div>
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button onClick={async () => { setShowFtMenu(false); await handleResetAndRetry(); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50 text-red-600 dark:text-red-400">
                        <RotateCw className="w-3.5 h-3.5 shrink-0" />
                        <div><div className="font-medium">Reset Failed & Retry</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">이전 실패 행 삭제 후 body fallback으로 재시도</div></div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
                );
              })()}

              <button onClick={() => triggerSearch()} disabled={loading} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900" title="Refresh from DB">
                <RotateCw className={`w-3.5 h-3.5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowControlWindow(true)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900"
                title="Control window"
              >
                <Settings2 className="w-3.5 h-3.5" /><span className="text-xs">Control</span>
              </button>

              <button onClick={() => setShowSaveModal(true)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900" title="Save search settings">
                <Save className="w-3.5 h-3.5" /><span className="text-xs">Save</span>
              </button>

              <div className="relative" ref={loadMenuRef}>
                <button onClick={() => { setShowLoadMenu(!showLoadMenu); setShowFilterMenu(false); setShowWatchlistMenu(false); setShowDisplayModeMenu(false); }} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900" title="Load search settings">
                  <FolderOpen className="w-3.5 h-3.5" /><span className="text-xs">Load</span>
                </button>
                {showLoadMenu && (
                  <div className="absolute top-full mt-1 right-0 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                    <div className="p-1.5">
                      {savedSearches.length === 0
                        ? <div className="px-3 py-2 text-xs text-gray-500">No saved searches</div>
                        : savedSearches.map(s => (
                          <button key={s.id} onClick={() => handleLoadSearch(s)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-between group">
                            <span>{s.name}</span>
                            <span onClick={(e) => handleDeleteSearch(s.id, e)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs">✕</span>
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/30 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>{newsData.length} items{nextCursor ? '+' : ''}</span>
            {loading && <span className="text-blue-500">Loading...</span>}
            {loadingMore && <span className="text-blue-500">Loading more...</span>}
            {selectedWatchlist !== 'All' && (
              <span className="text-gray-500 dark:text-gray-400">Watch list: {selectedWatchlist}</span>
            )}
          </div>

          {error && (
            <span className="text-[11px] text-red-500 truncate max-w-[320px]" title={error}>{error}</span>
          )}

          {isModel1SafeMode && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate" title="Current news is loaded from /api/model1/news without change fields.">
              Model_1 safe payload active
            </span>
          )}

          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-1">
              {([
                { id: 'hv' as ColumnId, label: 'HV' },
                { id: 'zscore' as ColumnId, label: 'Z Score' },
              ]).map((quickCol) => {
                const active = !isModel1SafeMode && visibleCols.has(quickCol.id);
                return (
                  <button
                    key={quickCol.id}
                    onClick={() => toggleColumnVisibility(quickCol.id)}
                    disabled={isModel1SafeMode}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      isModel1SafeMode
                        ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                        : active
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={isModel1SafeMode ? 'Model_1 safe mode hides derived price-reaction columns' : `${quickCol.label} column toggle`}
                  >
                    {quickCol.label}
                  </button>
                );
              })}
            </div>

            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowColumnMenu(false); setShowLoadMenu(false); setShowDisplayModeMenu(false); setShowWatchlistMenu(false); }}
                className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                  hasNumericFilters
                    ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 bg-white dark:bg-gray-900'
                }`}
                title="Filter by Default Ticker ownership data"
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Filters</span>
                {activeNumericFilterCount > 0 && (
                  <span className="inline-flex min-w-[18px] justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {activeNumericFilterCount}
                  </span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showFilterMenu && (
                <div className="absolute top-full mt-1 right-0 w-[320px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Ownership Filters</div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Default Ticker Window과 같은 DB 값으로 Finnhub News 결과를 다시 조회합니다.</div>
                    </div>

                    {[
                      {
                        key: 'floatPct',
                        label: 'Float %',
                        min: floatPctMin,
                        max: floatPctMax,
                        setMin: setFloatPctMin,
                        setMax: setFloatPctMax,
                      },
                      {
                        key: 'institutionalPct',
                        label: 'Inst %',
                        min: institutionalPctMin,
                        max: institutionalPctMax,
                        setMin: setInstitutionalPctMin,
                        setMax: setInstitutionalPctMax,
                      },
                      {
                        key: 'insiderPct',
                        label: 'Insider %',
                        min: insiderPctMin,
                        max: insiderPctMax,
                        setMin: setInsiderPctMin,
                        setMax: setInsiderPctMax,
                      },
                    ].map((filterRow) => (
                      <div key={filterRow.key} className="space-y-1.5">
                        <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{filterRow.label}</div>
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={filterRow.min}
                            onChange={(e) => filterRow.setMin(e.target.value)}
                            placeholder="Min"
                            className="w-full px-2 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">to</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={filterRow.max}
                            onChange={(e) => filterRow.setMax(e.target.value)}
                            placeholder="Max"
                            className="w-full px-2 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">입력 즉시 DB 재조회</div>
                      <button
                        onClick={() => clearNumericFilters()}
                        disabled={!hasNumericFilters}
                        className="px-2.5 py-1.5 text-[11px] border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={columnMenuRef}>
            <button
              onClick={() => { setShowColumnMenu(!showColumnMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowDisplayModeMenu(false); setShowWatchlistMenu(false); }}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900"
              title="Show/hide columns"
            >
              <Columns3 className="w-3.5 h-3.5 text-gray-500" />
              <span className="whitespace-nowrap">Columns</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showColumnMenu && (
              <div className="absolute top-full mt-1 right-0 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Toggle columns</div>
                  {columns.map(col => (
                    <label
                      key={col.id}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded ${isModel1SafeMode && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(col.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isModel1SafeMode && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(col.id) ? false : visibleCols.has(col.id)}
                        onChange={() => {
                          if (isModel1SafeMode && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(col.id)) return;
                          toggleColumnVisibility(col.id);
                        }}
                        disabled={isModel1SafeMode && MODEL1_HIDDEN_CHANGE_COLUMNS.includes(col.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                  {isModel1SafeMode && (
                    <div className="px-3 py-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      Model_1 safe mode hides current-news change, HV, and Z Score columns.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={watchlistMenuRef}>
            <button onClick={() => { setShowWatchlistMenu(!showWatchlistMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowDisplayModeMenu(false); }}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-gray-900">
              <span>Watch Lists</span><ChevronDown className="w-3 h-3" />
            </button>
            {showWatchlistMenu && (
              <div className="absolute top-full mt-1 right-0 w-44 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                <div className="p-1.5">
                  {['All', 'Tech Stocks', 'My Portfolio', 'High Volume'].map(list => (
                    <button key={list} onClick={() => { setSelectedWatchlist(list); setShowWatchlistMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${selectedWatchlist === list ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : ''}`}>
                      {list}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ─── Table Header ─── */}
      <div className="flex items-center border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 select-none">
        {activeColumns.map((col, idx) => {
          const isLast = idx === activeColumns.length - 1;
          const isDragTarget = dragOverIdx === idx && dragColIdx !== idx;
          return (
            <div
              key={col.id}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onClick={() => handleSortClick(col.id)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={[
                'relative shrink-0 px-2 py-2 cursor-pointer flex items-center gap-1 group transition-colors hover:bg-gray-100 dark:hover:bg-gray-700',
                isDragTarget ? 'bg-blue-50 dark:bg-blue-900/30' : '',
                dragColIdx === idx ? 'opacity-50' : '',
              ].join(' ')}
              style={{ width: activeColWidths[idx], minWidth: col.minWidth }}
            >
              <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 shrink-0 cursor-grab" />
              <span className="truncate">{col.label}</span>
              {sort.column === col.id && sort.dir === 'asc' && <ArrowUp className="w-3 h-3 text-blue-500 shrink-0" />}
              {sort.column === col.id && sort.dir === 'desc' && <ArrowDown className="w-3 h-3 text-blue-500 shrink-0" />}
              <div
                onMouseDown={handleResizeStart(idx)}
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-20 hover:bg-blue-400/40 ${!isLast ? 'border-r border-gray-300 dark:border-gray-700' : ''}`}
                style={{ touchAction: 'none' }}
              />
            </div>
          );
        })}
      </div>

      {/* ─── News List ─── */}
      <div className="relative flex-1 overflow-hidden" ref={listContainerRef}>
        {newsData.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            No news items. Click "Update" to pull from Finnhub.
          </div>
        ) : (
          <>
            {stickyDate && (
              <div
                className="absolute top-0 left-0 right-0 z-20 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 pointer-events-none"
                style={{ height: STICKY_DATE_HEADER_HEIGHT }}
              >
                <span className="font-semibold text-gray-700 dark:text-gray-300">{stickyDate}</span>
              </div>
            )}
            <List
              ref={listRef}
              height={listHeight}
              itemCount={groupedNews.length}
              itemSize={getItemSize}
              width="100%"
              className="scrollbar-thin"
              onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
                const nextSticky = findStickyDateForIndex(visibleStartIndex);
                if (nextSticky && nextSticky !== stickyDate) {
                  setStickyDate(nextSticky);
                }

                // Auto-load when the load-more sentinel is visible
                if (nextCursor && !loadingMore && visibleStopIndex >= groupedNews.length - 1) {
                  fetchMore();
                }
              }}
            >
              {Row}
            </List>
          </>
        )}
      </div>

      {/* ─── Job Log Panel (bottom overlay) ─── */}
      {showLogPanel && selectedJobStatus && (
        <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 z-40 flex flex-col shadow-lg">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              {activeJobs.length > 1 ? (
                <select
                  value={selectedJobId || ''}
                  onChange={(e) => { setSelectedJobId(e.target.value); }}
                  className="text-xs font-semibold bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px]"
                >
                  {activeJobs.map((j, i) => (
                    <option key={j.id} value={j.id}>
                      {j.label ?? `Job ${i + 1}`} — {j.progress.completed}/{j.progress.total} ({j.progress.pct}%)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{selectedJobStatus.label ?? 'Job Log'}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                selectedJobStatus.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                selectedJobStatus.status === 'done' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                selectedJobStatus.status === 'cancelled' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
              }`}>
                {selectedJobStatus.status === 'running' ? 'Running' : selectedJobStatus.status === 'done' ? 'Done' : selectedJobStatus.status === 'cancelled' ? 'Cancelled' : 'Failed'}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {selectedJobStatus.progress.completed}/{selectedJobStatus.progress.total} ({selectedJobStatus.progress.pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1">
              {selectedJobStatus.status === 'running' && selectedJobId && (
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/api/jobs/${selectedJobId}/cancel`, { method: 'POST' });
                    } catch { /* ignore */ }
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                  title="Stop job"
                >
                  <Square className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
              <button onClick={() => setShowLogPanel(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="Close (Esc)">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 shrink-0">
            <div
              className={`h-full transition-all duration-300 ${
                selectedJobStatus.status === 'failed' ? 'bg-red-500' : selectedJobStatus.status === 'done' ? 'bg-green-500' : selectedJobStatus.status === 'cancelled' ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${selectedJobStatus.progress.pct}%` }}
            />
          </div>
          {/* Log lines */}
          <div ref={logScrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900">
            {selectedJobStatus.logs.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap py-0.5 ${line.includes('⚠') ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {line}
              </div>
            ))}
            {selectedJobStatus.error && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
                Error: {selectedJobStatus.error}
              </div>
            )}
          </div>
          {/* Result summary when done */}
          {selectedJobStatus.status === 'done' && selectedJobStatus.result && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 shrink-0">
              {(selectedJobStatus.result as Record<string, unknown>).success !== undefined
                ? `✓ Full Text — ${(selectedJobStatus.result as Record<string, unknown>).success ?? 0} extracted, ${(selectedJobStatus.result as Record<string, unknown>).skipped ?? 0} skipped, ${(selectedJobStatus.result as Record<string, unknown>).failed ?? 0} failed`
                : `✓ Completed — ${(selectedJobStatus.result as Record<string, unknown>).inserted ?? 0} inserted, ${(selectedJobStatus.result as Record<string, unknown>).skipped ?? 0} skipped, ${(selectedJobStatus.result as Record<string, unknown>).changeMerged ?? 0} change% merged`
              }
            </div>
          )}
        </div>
      )}

      {/* ─── Save Search Modal ─── */}
      {showSaveModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-72 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3">Save Search Settings</h3>
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Search name..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-3"
              autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSearch(); if (e.key === 'Escape') setShowSaveModal(false); }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSaveSearch} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Custom Date Picker Modal ─── */}
      {showCalendarCustomDateModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-rose-500" />Custom Earning Date Update — Date Range</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Article Date From</label>
                <input type="date" value={calendarCustomFrom} onChange={(e) => setCalendarCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Article Date To</label>
                <input type="date" value={calendarCustomTo} onChange={(e) => setCalendarCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <p className="text-[10px] text-gray-400">calendar DB를 먼저 사용하고, 부족한 earnings context만 FMP로 보강합니다.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCalendarCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => { if (!calendarCustomFrom || !calendarCustomTo) return; setShowCalendarCustomDateModal(false); handleCustomEarningDateUpdate(calendarCustomFrom, calendarCustomTo); }}
                disabled={!calendarCustomFrom || !calendarCustomTo}
                className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50"
              >Run Custom Earning Date Update</button>
            </div>
          </div>
        </div>
      )}

      {showCustomDateModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-500" />Custom Update — Date Range</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <p className="text-[10px] text-gray-400">Adaptive backfill will split large date ranges to avoid API cap.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => {
                  if (!customFrom || !customTo) return;
                  setShowCustomDateModal(false);
                  void handleCustomPreflightStart(pendingUpdateSourceType, customFrom, customTo);
                }}
                disabled={!customFrom || !customTo}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >Start Update</button>
            </div>
          </div>
        </div>
      )}
      {/* ─── PTPR Custom Date Modal ─── */}
      {showPtprCustomDateModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-500" />Custom PTPR Press Release — Date Range</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={ptprCustomFrom} onChange={(e) => setPtprCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={ptprCustomTo} onChange={(e) => setPtprCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">RTPR Ticker Concurrency</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rtprTickerConcurrencyInput}
                  onChange={(e) => setRtprTickerConcurrencyInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="text-[10px] text-gray-400">Per-ticker RTPR press release pull within date range. RTPR rate limit: 60 rpm. Saved value is also available in Control.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowPtprCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => {
                  if (!ptprCustomFrom || !ptprCustomTo) return;
                  const rtprTickerConcurrency = Math.max(1, Math.min(20, parseInt(rtprTickerConcurrencyInput, 10) || 5));
                  try { localStorage.setItem('rtpr-ticker-concurrency', String(rtprTickerConcurrency)); } catch { /* ignore */ }
                  setRtprTickerConcurrencyInput(String(rtprTickerConcurrency));
                  setShowPtprCustomDateModal(false);
                  void handlePtprCustomPreflightStart(ptprCustomFrom, ptprCustomTo);
                }}
                disabled={!ptprCustomFrom || !ptprCustomTo}
                className="px-3 py-1.5 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
              >Start Update</button>
            </div>
          </div>
        </div>
      )}

      {showControlWindow && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Settings2 className="w-4 h-4 text-slate-500" />News Pull Control</h3>
            <div className="space-y-4">
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Finnhub</div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ticker Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={finnhubTickerConcurrencyInput}
                    onChange={(e) => setFinnhubTickerConcurrencyInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Request Interval (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step="0.1"
                    value={finnhubRequestIntervalSecInput}
                    onChange={(e) => setFinnhubRequestIntervalSecInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                  <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Company News Override</div>
                  <p className="text-[10px] text-gray-400">`Company News` pull에서만 쓰는 전용 설정입니다. Press Release, Peers, IPO Date는 기존 Finnhub 공용 설정을 그대로 사용합니다.</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Company News Ticker Concurrency</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={companyNewsTickerConcurrencyInput}
                      onChange={(e) => setCompanyNewsTickerConcurrencyInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Company News Request Interval (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step="0.1"
                      value={companyNewsRequestIntervalSecInput}
                      onChange={(e) => setCompanyNewsRequestIntervalSecInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">RTPR / PTPR</div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ticker Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={rtprTickerConcurrencyInput}
                    onChange={(e) => setRtprTickerConcurrencyInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-gray-400">Default 5. RTPR provider still respects the internal 55 req/min token bucket under the documented 60 rpm limit.</p>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">FMP</div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ticker Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={fmpTickerConcurrencyInput}
                    onChange={(e) => setFmpTickerConcurrencyInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock Full Text Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={fmpStockFulltextConcurrencyInput}
                    onChange={(e) => setFmpStockFulltextConcurrencyInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Request Interval (ms)</label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    step="50"
                    value={fmpRequestIntervalMsInput}
                    onChange={(e) => setFmpRequestIntervalMsInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">PR Page Limit</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step="1"
                      value={fmpPrPageLimitInput}
                      onChange={(e) => setFmpPrPageLimitInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">PR Max Pages</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step="1"
                      value={fmpPrMaxPagesInput}
                      onChange={(e) => setFmpPrMaxPagesInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SEC Max Pages</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step="1"
                    value={fmpSecMaxPagesInput}
                    onChange={(e) => setFmpSecMaxPagesInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-gray-400">Ticker Concurrency/Interval/Pageing apply to FMP company profile, FMP PR, FMP Stock, and FMP SEC pulls. Stock Full Text Concurrency applies to inline fulltext during FMP Stock pull and to manual `FMP Stock Only` fulltext reruns.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowControlWindow(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSaveControlWindow} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-800">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Preflight Confirmation Modal (Recent Update) ─── */}
      {showPreflightModal && preflightData && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><RotateCw className="w-4 h-4 text-purple-500" />Recent Update</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              {preflightData.fallbackCount}개 ticker는 기존 뉴스가 없어 최근 7일만 조회됩니다.
            </p>
            {preflightData.fallbackTickers.length > 0 && (
              <p className="text-[10px] text-gray-400 mb-3">
                예: {preflightData.fallbackTickers.slice(0, 10).join(', ')}
                {preflightData.fallbackCount > 10 && ` ... +${preflightData.fallbackCount - 10}개`}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPreflightModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => { setShowPreflightModal(false); handleUpdate('recent', pendingUpdateSourceType); }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >계속</button>
            </div>
          </div>
        </div>
      )}

      {showCustomPreflightModal && customPreflightData && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-[42rem] max-w-[92vw] border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><RotateCw className="w-4 h-4 text-blue-500" />{customPreflightTitle}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">실행 전에 현재 coverage와 예상 처리 범위를 보여줍니다.</p>
            <pre className="max-h-[24rem] overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-[11px] leading-5 text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-all">{JSON.stringify(customPreflightData, null, 2)}</pre>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowCustomPreflightModal(false);
                  setCustomPreflightData(null);
                  setPendingCustomExecute(null);
                }}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >Cancel</button>
              <button
                onClick={() => {
                  const execute = pendingCustomExecute;
                  setShowCustomPreflightModal(false);
                  setCustomPreflightData(null);
                  setPendingCustomExecute(null);
                  execute?.();
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bookmark Manager Modal ─── */}
      <BookmarkManager
        open={showBookmarkManager}
        onClose={() => setShowBookmarkManager(false)}
        folders={bookmarkFolders}
        onFoldersChanged={fetchBookmarkFolders}
      />

      {/* ─── Custom Change Date Range Modal ─── */}
      {showChangeCustomDateModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" />Custom Change% Update</h3>
            <div className="space-y-2">
              <label className="block text-xs text-gray-500">From</label>
              <input
                type="date"
                value={changeCustomFrom}
                onChange={(e) => setChangeCustomFrom(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <label className="block text-xs text-gray-500">To</label>
              <input
                type="date"
                value={changeCustomTo}
                onChange={(e) => setChangeCustomTo(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400">Recalculate change % for news published within selected date range and fill missing HV / Z Score metrics.</p>
              <p className="text-[10px] text-gray-400">Existing non-null HV / Z Score values are kept as-is and only missing derived metric rows are filled.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowChangeCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => { if (changeCustomFrom && changeCustomTo) { setShowChangeCustomDateModal(false); handleCustomChangeUpdate(changeCustomFrom, changeCustomTo); } }}
                disabled={!changeCustomFrom || !changeCustomTo}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >Start</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Full Text Modal ─── */}
      {showFulltextModal && (
        <div
          className="absolute inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setShowFulltextModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowFulltextModal(false); }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90%] max-w-2xl max-h-[80%] flex flex-col border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="min-w-0 flex-1 mr-3">
                <h3 className="text-sm font-semibold truncate">{fulltextData?.title ?? 'Loading...'}</h3>
                {fulltextData && (
                  <span className="text-[10px] text-gray-400">
                    {fulltextData.wordCount} words · {fulltextData.status}
                  </span>
                )}
              </div>
              <button onClick={() => setShowFulltextModal(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0" title="Close (Esc)">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {fulltextLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">Loading...</div>
              ) : (
                fulltextData?.text ?? ''
              )}
            </div>
          </div>
        </div>
      )}

      {/* Company description popup */}
      {descPopup && (
        <div
          className="absolute inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setDescPopup(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDescPopup(null); }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90%] max-w-2xl max-h-[80%] flex flex-col border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h3 className="text-sm font-semibold truncate">{descPopup.ticker} — Company Description</h3>
              <button onClick={() => setDescPopup(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0" title="Close (Esc)">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {descPopup.text}
            </div>
          </div>
        </div>
      )}

      {/* Row context menu */}
      {rowCtxMenu && (
        <div
          ref={rowCtxMenuRef}
          className="fixed z-[60] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg min-w-[180px] overflow-hidden"
          style={(() => {
            const menuW = 220;
            const menuH = bookmarkFolders.length === 0 ? 112 : 112 + bookmarkFolders.length * 32;
            const maxX = typeof window !== 'undefined' ? window.innerWidth - menuW - 8 : rowCtxMenu.x;
            const maxY = typeof window !== 'undefined' ? window.innerHeight - menuH - 8 : rowCtxMenu.y;
            return {
              left: Math.max(8, Math.min(rowCtxMenu.x, maxX)),
              top: Math.max(8, Math.min(rowCtxMenu.y, maxY)),
            } as React.CSSProperties;
          })()}
        >
          <div className="px-3 py-2 text-[10px] text-gray-400 border-b border-gray-200 dark:border-gray-700">
            Row actions
          </div>
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={async () => {
              await copyToClipboard(rowCtxMenu.newsId);
              setRowCtxMenu(null);
            }}
          >
            Copy ID
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div className="px-3 py-2 text-[10px] text-gray-400 border-b border-gray-200 dark:border-gray-700">
            Add bookmark
          </div>
          {bookmarkFolders.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No bookmark folders</div>
          ) : (
            bookmarkFolders.map((folder) => (
              <button
                key={folder.id}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleAddBookmark(folder.id, rowCtxMenu.newsId)}
              >
                {folder.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Source cell context menu */}
      {sourceCtxMenu && (
        <div
          ref={sourceCtxMenuRef}
          className="fixed z-[60] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg"
          style={(() => {
            const menuW = 160;
            const menuH = 40;
            const maxX = typeof window !== 'undefined' ? window.innerWidth - menuW - 8 : sourceCtxMenu.x;
            const maxY = typeof window !== 'undefined' ? window.innerHeight - menuH - 8 : sourceCtxMenu.y;
            return {
              left: Math.max(8, Math.min(sourceCtxMenu.x, maxX)),
              top: Math.max(8, Math.min(sourceCtxMenu.y, maxY)),
            } as React.CSSProperties;
          })()}
        >
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            onClick={async (e) => {
              e.stopPropagation();
              await copyToClipboard(sourceCtxMenu.url);
              setSourceCtxMenu(null);
            }}
          >
            Copy URL
          </button>
        </div>
      )}
    </div>
  );
}
