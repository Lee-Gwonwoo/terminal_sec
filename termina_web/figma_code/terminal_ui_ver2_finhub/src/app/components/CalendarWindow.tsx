import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  RefreshCw,
  Search,
  Settings2,
  X,
  CircleHelp,
} from 'lucide-react';
import { getCompanyTickerDataAttrs } from '../companyDescription';
import { CalendarFinancialDialog } from './CalendarFinancialDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface CalendarWindowProps {
  onTickerClick?: (ticker: string) => void;
}

const API_BASE = '';

function formatIndustryButtonLabel(industries: string[]): string {
  if (industries.length === 0) return 'All Industries';
  if (industries.length === 1) return industries[0];
  return `${industries[0]} +${industries.length - 1}`;
}

function formatIndustryStatusLabel(industries: string[]): string {
  if (industries.length <= 2) return industries.join(', ');
  return `${industries.slice(0, 2).join(', ')} +${industries.length - 2}`;
}

interface IndustryInstructionTickerRow {
  ticker: string;
  exchange: string | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  marketCapSource: string | null;
  description: string | null;
}

interface IndustryInstructionDetail {
  industry: string;
  description: string;
  totalTickers: number;
  tickersWithMarketCap: number;
  sectors: string[];
  topTickers: string[];
  tickers: IndustryInstructionTickerRow[];
  limit: number;
  truncated: boolean;
  dataSource: string;
}

function getInstructionMenuStyle(x: number, y: number): React.CSSProperties {
  const width = 188;
  const height = 92;
  const maxX = typeof window !== 'undefined' ? window.innerWidth - width - 8 : x;
  const maxY = typeof window !== 'undefined' ? window.innerHeight - height - 8 : y;
  return {
    left: Math.max(8, Math.min(x, maxX)),
    top: Math.max(8, Math.min(y, maxY)),
  };
}

type SortDirection = 'asc' | 'desc' | null;

interface CalendarTypeConfig {
  key: string;
  label: string;
  supports: string[];
  columns: string[];
}

interface CalendarRow {
  id: string;
  type: string;
  event_time: string;
  event_date?: string | null;
  ipo_date?: string | null;
  ipo_security_type?: string | null;
  ticker?: string | null;
  title?: string | null;
  source?: string | null;
  unique_key?: string | null;
  name?: string | null;
  company_name?: string | null;
  company_description?: string | null;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  report_date?: string | null;
  time_of_day?: string | null;
  session?: string | null;
  confirmed?: boolean | null;
  eps_est?: number | null;
  eps_actual?: number | null;
  revenue_est?: number | null;
  revenue_actual?: number | null;
  surprise_pct?: number | null;
  market_cap?: number | null;
  float_pct?: number | null;
  institutional_pct?: number | null;
  insider_pct?: number | null;
  status?: string | null;
  shares?: number | null;
  price_range?: string | null;
  offer_amount?: number | null;
  daa?: string | null;
  sec_form?: string | null;
  sec_filing_date?: string | null;
  sec_accepted_date?: string | null;
  sec_owner_count?: number | null;
  sec_max_owner_pct?: number | null;
  sec_total_owner_pct?: number | null;
  prospectus_url?: string | null;
  disclosure_url?: string | null;
  sec_last_synced_at?: string | null;
  ex_date?: string | null;
  pay_date?: string | null;
  amount?: number | null;
  yield?: number | null;
  split_date?: string | null;
  ratio?: string | number | null;
  numerator?: number | null;
  denominator?: number | null;
  [key: string]: unknown;
}

interface CalendarResponse {
  items: CalendarRow[];
  nextCursor?: string;
}

interface CalendarWatchlist {
  id: string;
  name: string;
  itemCount: number;
}

interface IndustryResponse {
  industries?: string[];
}

interface JobStatus {
  status: 'running' | 'done' | 'failed' | 'cancelled';
  progress: { completed: number; total: number; pct: number };
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
}

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  width: string;
  align?: 'left' | 'center' | 'right';
}

interface NumericFilterConfig {
  key: 'market_cap' | 'float_pct' | 'institutional_pct';
  label: string;
  unitLabel: string;
  multiplier?: number;
}

type DatePresetKey = 'this_week' | 'next_5_days' | 'next_2_weeks' | 'this_month' | 'next_month';

const FALLBACK_TYPES: CalendarTypeConfig[] = [
  { key: 'earnings', label: 'Earnings', supports: [], columns: ['report_date', 'ticker', 'name', 'confirmed', 'eps_est', 'eps_actual', 'surprise_pct', 'revenue_est', 'revenue_actual', 'industry', 'float_pct', 'institutional_pct', 'insider_pct', 'session', 'source'] },
  { key: 'ipos', label: 'IPOs', supports: [], columns: ['ipo_date', 'ticker', 'ipo_security_type', 'company_name', 'industry', 'float_pct', 'institutional_pct', 'insider_pct', 'exchange', 'status', 'price_range', 'shares', 'offer_amount', 'company_description', 'sec_form', 'sec_filing_date', 'sec_accepted_date', 'sec_owner_count', 'sec_max_owner_pct', 'sec_total_owner_pct', 'prospectus_url', 'disclosure_url', 'source'] },
  { key: 'dividends', label: 'Dividends', supports: [], columns: ['ex_date', 'ticker', 'name', 'amount', 'yield', 'pay_date', 'industry', 'market_cap', 'source'] },
  { key: 'splits', label: 'Splits', supports: [], columns: ['split_date', 'ticker', 'name', 'ratio', 'industry', 'market_cap', 'source'] },
  { key: 'analyst_ratings', label: 'Analyst Ratings', supports: [], columns: ['ticker', 'title', 'source'] },
  { key: 'sec_filings', label: 'SEC Filings', supports: [], columns: ['event_date', 'ticker', 'title', 'source'] },
  { key: 'economics', label: 'Economics', supports: [], columns: ['event_date', 'title', 'source'] },
];

const TYPE_COLUMN_ORDER: Record<string, string[]> = {
  earnings: ['report_date', 'ticker', 'name', 'confirmed', 'eps_est', 'eps_actual', 'surprise_pct', 'revenue_est', 'revenue_actual', 'industry', 'float_pct', 'institutional_pct', 'insider_pct', 'session', 'source'],
  ipos: ['ipo_date', 'ticker', 'ipo_security_type', 'company_name', 'industry', 'float_pct', 'institutional_pct', 'insider_pct', 'exchange', 'status', 'price_range', 'shares', 'offer_amount', 'company_description', 'sec_form', 'sec_filing_date', 'sec_accepted_date', 'sec_owner_count', 'sec_max_owner_pct', 'sec_total_owner_pct', 'prospectus_url', 'disclosure_url', 'source'],
  dividends: ['ex_date', 'ticker', 'name', 'amount', 'yield', 'pay_date', 'industry', 'market_cap', 'source'],
  splits: ['split_date', 'ticker', 'name', 'ratio', 'industry', 'market_cap', 'source'],
};

const VISIBLE_COLUMNS_BY_TYPE: Record<string, string[]> = {
  earnings: ['report_date', 'ticker', 'confirmed', 'eps_est', 'eps_actual', 'surprise_pct', 'revenue_est', 'revenue_actual'],
  ipos: ['ipo_date', 'ticker', 'ipo_security_type', 'company_name', 'industry', 'institutional_pct', 'insider_pct', 'exchange', 'status', 'price_range', 'shares', 'offer_amount', 'sec_max_owner_pct', 'company_description'],
  dividends: ['ex_date', 'ticker', 'amount', 'yield', 'pay_date'],
  splits: ['split_date', 'ticker', 'ratio'],
  analyst_ratings: ['event_date', 'ticker', 'title'],
  sec_filings: ['event_date', 'ticker', 'title'],
  economics: ['event_date', 'title', 'source'],
};

const COLUMN_DEFINITIONS: Record<string, Omit<ColumnConfig, 'visible'>> = {
  event_date: { key: 'event_date', label: 'Date', width: '110px' },
  report_date: { key: 'report_date', label: 'Date', width: '110px' },
  ipo_date: { key: 'ipo_date', label: 'IPO Date', width: '110px' },
  ipo_security_type: { key: 'ipo_security_type', label: 'Security Type', width: '130px' },
  ex_date: { key: 'ex_date', label: 'Ex Date', width: '110px' },
  pay_date: { key: 'pay_date', label: 'Pay Date', width: '110px' },
  split_date: { key: 'split_date', label: 'Split Date', width: '110px' },
  ticker: { key: 'ticker', label: 'Symbol', width: '90px' },
  name: { key: 'name', label: 'Name', width: '180px' },
  company_name: { key: 'company_name', label: 'Company', width: '180px' },
  company_description: { key: 'company_description', label: 'Description', width: '320px' },
  title: { key: 'title', label: 'Title', width: '240px' },
  source: { key: 'source', label: 'Source', width: '100px' },
  industry: { key: 'industry', label: 'Industry', width: '180px' },
  exchange: { key: 'exchange', label: 'Exchange', width: '110px' },
  sector: { key: 'sector', label: 'Sector', width: '140px' },
  status: { key: 'status', label: 'Status', width: '100px', align: 'center' },
  shares: { key: 'shares', label: 'Shares', width: '120px', align: 'right' },
  price_range: { key: 'price_range', label: 'Price Range', width: '130px' },
  offer_amount: { key: 'offer_amount', label: 'Offer Amount', width: '130px', align: 'right' },
  daa: { key: 'daa', label: 'DAA', width: '90px' },
  sec_form: { key: 'sec_form', label: 'SEC Form', width: '110px' },
  sec_filing_date: { key: 'sec_filing_date', label: 'Filing Date', width: '110px' },
  sec_accepted_date: { key: 'sec_accepted_date', label: 'Accepted', width: '110px' },
  sec_owner_count: { key: 'sec_owner_count', label: 'SEC Owners', width: '95px', align: 'right' },
  sec_max_owner_pct: { key: 'sec_max_owner_pct', label: 'SEC Max %', width: '95px', align: 'right' },
  sec_total_owner_pct: { key: 'sec_total_owner_pct', label: 'SEC Total %', width: '95px', align: 'right' },
  prospectus_url: { key: 'prospectus_url', label: 'Prospectus', width: '110px' },
  disclosure_url: { key: 'disclosure_url', label: 'Disclosure', width: '110px' },
  session: { key: 'session', label: 'Session', width: '110px' },
  confirmed: { key: 'confirmed', label: 'Confirmed', width: '100px', align: 'center' },
  eps_est: { key: 'eps_est', label: 'Est. EPS', width: '100px', align: 'right' },
  eps_actual: { key: 'eps_actual', label: 'EPS', width: '90px', align: 'right' },
  revenue_est: { key: 'revenue_est', label: 'Est. Revenue', width: '130px', align: 'right' },
  revenue_actual: { key: 'revenue_actual', label: 'Revenue', width: '130px', align: 'right' },
  surprise_pct: { key: 'surprise_pct', label: 'Surprise %', width: '110px', align: 'right' },
  market_cap: { key: 'market_cap', label: 'Market Cap', width: '130px', align: 'right' },
  float_pct: { key: 'float_pct', label: 'Float %', width: '90px', align: 'right' },
  institutional_pct: { key: 'institutional_pct', label: 'Inst %', width: '90px', align: 'right' },
  insider_pct: { key: 'insider_pct', label: 'Insider %', width: '90px', align: 'right' },
  amount: { key: 'amount', label: 'Amount', width: '100px', align: 'right' },
  yield: { key: 'yield', label: 'Yield', width: '90px', align: 'right' },
  ratio: { key: 'ratio', label: 'Ratio', width: '100px' },
};

const NUMERIC_FILTERS_BY_TYPE: Record<string, NumericFilterConfig[]> = {
  earnings: [
    { key: 'institutional_pct', label: 'Inst %', unitLabel: '%' },
    { key: 'float_pct', label: 'Float %', unitLabel: '%' },
    { key: 'market_cap', label: 'Market Cap', unitLabel: 'B$', multiplier: 1_000_000_000 },
  ],
  dividends: [
    { key: 'market_cap', label: 'Market Cap', unitLabel: 'B$', multiplier: 1_000_000_000 },
  ],
  splits: [
    { key: 'market_cap', label: 'Market Cap', unitLabel: 'B$', multiplier: 1_000_000_000 },
  ],
};

const IPO_SECURITY_TYPE_ORDER = ['Common Stock', 'Unit', 'Warrant', 'Rights', 'ADS', 'ETF', 'Fund/Trust', 'Preferred', 'Other'];
const DEFAULT_EARNINGS_UPDATE_CONCURRENCY = 1;
const DEFAULT_FINANCIAL_SYNC_CONCURRENCY = 1;
const DATE_PRESET_OPTIONS: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'this_week', label: 'This Week' },
  { key: 'next_5_days', label: 'Next 5 Days' },
  { key: 'next_2_weeks', label: 'Next 2 Weeks' },
  { key: 'this_month', label: 'This Month' },
  { key: 'next_month', label: 'Next Month' },
];

function readStoredNumberInRange(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    if (value < min || value > max) {
      return fallback;
    }
    return Math.floor(value);
  } catch {
    return fallback;
  }
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildColumns(type: string, backendColumns: string[]): ColumnConfig[] {
  const ordered = Array.from(new Set([
    ...(TYPE_COLUMN_ORDER[type] ?? []),
    ...backendColumns,
    'source',
  ]));

  return ordered.map((key) => {
    const definition = COLUMN_DEFINITIONS[key] ?? { key, label: humanizeKey(key), width: '140px' };
    return {
      ...definition,
      visible: (VISIBLE_COLUMNS_BY_TYPE[type] ?? []).includes(key),
    };
  });
}

function getDefaultSortFieldForType(type: string): string {
  if (type === 'earnings') {
    return 'report_date';
  }
  if (type === 'ipos') {
    return 'ipo_date';
  }
  return 'event_date';
}

function mergeColumns(existing: ColumnConfig[] | undefined, next: ColumnConfig[]): ColumnConfig[] {
  if (!existing || existing.length === 0) {
    return next;
  }
  const nextByKey = new Map(next.map((column) => [column.key, column]));
  const preserved = existing
    .filter((column) => nextByKey.has(column.key))
    .map((column) => ({
      ...nextByKey.get(column.key)!,
      visible: column.visible,
      width: column.width,
    }));
  const preservedKeys = new Set(preserved.map((column) => column.key));
  const appended = next.filter((column) => !preservedKeys.has(column.key));
  return [...preserved, ...appended];
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDateValue(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '-';
  }
  return value.slice(0, 10);
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStartOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function getEndOfWeek(date: Date): Date {
  return addDays(getStartOfWeek(date), 6);
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function buildDatePresetRange(preset: DatePresetKey, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'this_week') {
    return {
      from: formatDateInputValue(getStartOfWeek(today)),
      to: formatDateInputValue(getEndOfWeek(today)),
    };
  }

  if (preset === 'next_5_days') {
    return {
      from: formatDateInputValue(today),
      to: formatDateInputValue(addDays(today, 4)),
    };
  }

  if (preset === 'next_2_weeks') {
    return {
      from: formatDateInputValue(today),
      to: formatDateInputValue(addDays(today, 13)),
    };
  }

  if (preset === 'this_month') {
    return {
      from: formatDateInputValue(getStartOfMonth(today)),
      to: formatDateInputValue(getEndOfMonth(today)),
    };
  }

  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return {
    from: formatDateInputValue(nextMonthStart),
    to: formatDateInputValue(getEndOfMonth(nextMonthStart)),
  };
}

function getRatioValue(row: CalendarRow): string {
  if (typeof row.ratio === 'string' && row.ratio.trim()) {
    return row.ratio;
  }
  if (typeof row.ratio === 'number' && Number.isFinite(row.ratio)) {
    return String(row.ratio);
  }
  if (typeof row.numerator === 'number' && typeof row.denominator === 'number') {
    return `${row.numerator}:${row.denominator}`;
  }
  return '-';
}

function parseNumericFilterInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesNumericRange(
  value: unknown,
  minInput: string,
  maxInput: string,
  multiplier = 1,
): boolean {
  const minValue = parseNumericFilterInput(minInput);
  const maxValue = parseNumericFilterInput(maxInput);
  if (minValue == null && maxValue == null) {
    return true;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  const scaledMin = minValue == null ? null : minValue * multiplier;
  const scaledMax = maxValue == null ? null : maxValue * multiplier;
  if (scaledMin != null && value < scaledMin) {
    return false;
  }
  if (scaledMax != null && value > scaledMax) {
    return false;
  }
  return true;
}

async function fetchCalendarEvents(type: string, from: string, to: string, watchlistId?: string, industries?: string[]): Promise<CalendarRow[]> {
  const allItems: CalendarRow[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      type,
      sort: 'event_time:desc',
      limit: '500',
    });
    if (from) {
      params.set('from', from);
    }
    if (to) {
      params.set('to', to);
    }
    if (watchlistId) {
      params.set('watchlist_id', watchlistId);
    }
    for (const industry of industries ?? []) {
      params.append('industries', industry);
    }
    if (cursor) {
      params.set('cursor', cursor);
    }

    const response = await fetch(`${API_BASE}/api/calendar/events?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Calendar fetch failed: HTTP ${response.status}`);
    }

    const data = await response.json() as CalendarResponse;
    allItems.push(...data.items);
    if (!data.nextCursor) {
      break;
    }
    cursor = data.nextCursor;
  }

  return allItems;
}

export function CalendarWindow({ onTickerClick }: CalendarWindowProps) {
  const [typeConfigs, setTypeConfigs] = useState<CalendarTypeConfig[]>(FALLBACK_TYPES);
  const [events, setEvents] = useState<CalendarRow[]>([]);
  const [watchlists, setWatchlists] = useState<CalendarWatchlist[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);
  const [activeType, setActiveType] = useState('earnings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DatePresetKey | null>(null);
  const [sortField, setSortField] = useState<string | null>(() => getDefaultSortFieldForType('earnings'));
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columnStates, setColumnStates] = useState<Record<string, ColumnConfig[]>>(() =>
    Object.fromEntries(FALLBACK_TYPES.map((typeConfig) => [typeConfig.key, buildColumns(typeConfig.key, typeConfig.columns)]))
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [showIndustryMenu, setShowIndustryMenu] = useState(false);
  const [industryInstructionMenu, setIndustryInstructionMenu] = useState<null | { x: number; y: number; industry: string }>(null);
  const [industryInstructionTarget, setIndustryInstructionTarget] = useState<string | null>(null);
  const [industryInstructionDetail, setIndustryInstructionDetail] = useState<IndustryInstructionDetail | null>(null);
  const [industryInstructionLoading, setIndustryInstructionLoading] = useState(false);
  const [industryInstructionError, setIndustryInstructionError] = useState<string | null>(null);
  const [showFmpSettingsMenu, setShowFmpSettingsMenu] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobLabel, setJobLabel] = useState('Calendar update');
  const [showJobLogs, setShowJobLogs] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [marketCapMin, setMarketCapMin] = useState('');
  const [marketCapMax, setMarketCapMax] = useState('');
  const [floatPctMin, setFloatPctMin] = useState('');
  const [floatPctMax, setFloatPctMax] = useState('');
  const [institutionalPctMin, setInstitutionalPctMin] = useState('');
  const [institutionalPctMax, setInstitutionalPctMax] = useState('');
  const [confirmedFilter, setConfirmedFilter] = useState<boolean | null>(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('all');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [ipoSecurityTypeFilter, setIpoSecurityTypeFilter] = useState('all');
  const [tickerContextMenu, setTickerContextMenu] = useState<{
    x: number;
    y: number;
    ticker: string;
    companyName: string | null;
  } | null>(null);
  const [financialTarget, setFinancialTarget] = useState<{
    ticker: string;
    companyName: string | null;
  } | null>(null);
  const [earningsUpdateConcurrency, setEarningsUpdateConcurrency] = useState(() =>
    readStoredNumberInRange('calendar-fmp-earnings-concurrency', DEFAULT_EARNINGS_UPDATE_CONCURRENCY, 1, 20)
  );
  const [financialSyncConcurrency, setFinancialSyncConcurrency] = useState(() =>
    readStoredNumberInRange('calendar-fmp-financial-concurrency', DEFAULT_FINANCIAL_SYNC_CONCURRENCY, 1, 20)
  );

  const currentTypeConfig = typeConfigs.find((item) => item.key === activeType) ?? FALLBACK_TYPES[0];
  const currentColumns = columnStates[activeType] ?? buildColumns(activeType, currentTypeConfig?.columns ?? []);
  const visibleColumns = currentColumns.filter((column) => column.visible);
  const numericFilters = NUMERIC_FILTERS_BY_TYPE[activeType] ?? [];
  const hasRequiredDateRange = Boolean(dateFrom && dateTo);
  const supportsWatchlistFilter = activeType !== 'economics';
  const supportsIndustryFilter = activeType !== 'economics';
  const selectedWatchlistLabel = selectedWatchlistId === 'all'
    ? 'All Watchlists'
    : watchlists.find((watchlist) => watchlist.id === selectedWatchlistId)?.name ?? 'Watch Lists';
  const selectedIndustrySet = useMemo(() => new Set(selectedIndustries), [selectedIndustries]);
  const selectedIndustryLabel = formatIndustryButtonLabel(selectedIndustries);
  const selectedIndustryStatusLabel = formatIndustryStatusLabel(selectedIndustries);
  const hasIndustryFilter = selectedIndustries.length > 0;

  const toggleSelectedIndustry = (industry: string) => {
    const trimmed = industry.trim();
    if (!trimmed) return;
    setSelectedIndustries((previous) => {
      if (previous.includes(trimmed)) {
        return previous.filter((item) => item !== trimmed);
      }
      return [...previous, trimmed].sort((left, right) => left.localeCompare(right));
    });
  };

  const openIndustryInstructionMenu = (event: React.MouseEvent, industry: string) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null;
    const x = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : (rect?.right ?? 16);
    const y = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : (rect?.top ?? 16);
    setIndustryInstructionMenu({ industry, x, y });
  };

  const openIndustryInstructionDialog = async (industry: string) => {
    const trimmed = industry.trim();
    if (!trimmed) return;
    setIndustryInstructionMenu(null);
    setShowIndustryMenu(false);
    setIndustryInstructionTarget(trimmed);
    setIndustryInstructionDetail(null);
    setIndustryInstructionError(null);
    setIndustryInstructionLoading(true);
    try {
      const params = new URLSearchParams({ industry: trimmed, limit: '250' });
      const response = await fetch(`${API_BASE}/api/industries/detail?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Industry detail fetch failed: HTTP ${response.status}`);
      }
      const data = await response.json() as IndustryInstructionDetail;
      setIndustryInstructionDetail(data);
    } catch (fetchError) {
      setIndustryInstructionError(fetchError instanceof Error ? fetchError.message : 'Failed to load industry details');
    } finally {
      setIndustryInstructionLoading(false);
    }
  };

  const closeIndustryInstructionDialog = () => {
    setIndustryInstructionTarget(null);
    setIndustryInstructionDetail(null);
    setIndustryInstructionError(null);
    setIndustryInstructionLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const loadTypes = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/calendar/types`);
        if (!response.ok) {
          throw new Error(`Calendar type fetch failed: HTTP ${response.status}`);
        }
        const data = await response.json() as CalendarTypeConfig[];
        if (cancelled || data.length === 0) {
          return;
        }
        setTypeConfigs(data);
        setColumnStates((previous) => {
          const next = { ...previous };
          for (const typeConfig of data) {
            next[typeConfig.key] = mergeColumns(previous[typeConfig.key], buildColumns(typeConfig.key, typeConfig.columns));
          }
          return next;
        });
        if (!data.some((item) => item.key === activeType)) {
          const earningsType = data.find((item) => item.key === 'earnings');
          setActiveType(earningsType?.key ?? data[0].key);
        }
      } catch {
        // Fallback types are already loaded.
      }
    };

    void loadTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWatchlists = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/watchlists`);
        if (!response.ok) {
          throw new Error(`Watchlist fetch failed: HTTP ${response.status}`);
        }
        const data = await response.json() as Array<Record<string, unknown>>;
        if (cancelled || !Array.isArray(data)) {
          return;
        }
        const nextWatchlists = data.map((row) => {
          const itemCount = Array.isArray(row.items)
            ? row.items.length
            : Array.isArray(row.tickers)
              ? row.tickers.length
              : 0;
          return {
            id: String(row.id ?? ''),
            name: String(row.name ?? 'Untitled'),
            itemCount,
          } satisfies CalendarWatchlist;
        }).filter((row) => row.id);
        setWatchlists(nextWatchlists);
        setSelectedWatchlistId((current) => current !== 'all' && !nextWatchlists.some((watchlist) => watchlist.id === current) ? 'all' : current);
      } catch {
        if (!cancelled) {
          setWatchlists([]);
          setSelectedWatchlistId('all');
        }
      }
    };

    void loadWatchlists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadIndustries = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/industries`);
        if (!response.ok) {
          throw new Error(`Industry fetch failed: HTTP ${response.status}`);
        }
        const data = await response.json() as IndustryResponse;
        if (cancelled || !Array.isArray(data.industries)) {
          return;
        }
        setIndustryOptions(data.industries.filter((industry) => typeof industry === 'string' && industry.trim()).sort((left, right) => left.localeCompare(right)));
      } catch {
        if (!cancelled) {
          setIndustryOptions([]);
        }
      }
    };

    void loadIndustries();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supportsIndustryFilter) {
      setSelectedIndustries([]);
      setShowIndustryMenu(false);
    }
  }, [supportsIndustryFilter]);

  useEffect(() => {
    let cancelled = false;

    if (!hasRequiredDateRange) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchCalendarEvents(
          activeType,
          dateFrom,
          dateTo,
          supportsWatchlistFilter && selectedWatchlistId !== 'all' ? selectedWatchlistId : undefined,
          supportsIndustryFilter && selectedIndustries.length > 0 ? selectedIndustries : undefined,
        );
        if (cancelled) {
          return;
        }
        setEvents(items);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setEvents([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load calendar events');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, [activeType, dateFrom, dateTo, hasRequiredDateRange, reloadToken, selectedIndustries, selectedWatchlistId, supportsIndustryFilter, supportsWatchlistFilter]);

  useEffect(() => {
    if (!jobId || (jobStatus && jobStatus.status !== 'running')) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        if (!response.ok) {
          return;
        }
        const data = await response.json() as JobStatus;
        if (cancelled) {
          return;
        }
        setJobStatus(data);
        if (data.status === 'done') {
          setUpdatePending(false);
          setReloadToken((value) => value + 1);
        }
        if (data.status === 'failed' || data.status === 'cancelled') {
          setUpdatePending(false);
        }
      } catch {
        // Transient polling failure.
      }
    };

    void poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, jobStatus]);

  useEffect(() => {
    if (!tickerContextMenu) {
      return;
    }

    const closeMenu = () => {
      setTickerContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [tickerContextMenu]);

  useEffect(() => {
    if (!industryInstructionMenu) {
      return;
    }

    const closeMenu = () => {
      setIndustryInstructionMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
    };
  }, [industryInstructionMenu]);

  const saveEarningsUpdateConcurrency = (value: number) => {
    const nextValue = Number.isFinite(value) ? Math.max(1, Math.min(20, Math.floor(value))) : DEFAULT_EARNINGS_UPDATE_CONCURRENCY;
    setEarningsUpdateConcurrency(nextValue);
    try {
      localStorage.setItem('calendar-fmp-earnings-concurrency', String(nextValue));
    } catch {
      // Ignore storage errors.
    }
  };

  const saveFinancialSyncConcurrency = (value: number) => {
    const nextValue = Number.isFinite(value) ? Math.max(1, Math.min(20, Math.floor(value))) : DEFAULT_FINANCIAL_SYNC_CONCURRENCY;
    setFinancialSyncConcurrency(nextValue);
    try {
      localStorage.setItem('calendar-fmp-financial-concurrency', String(nextValue));
    } catch {
      // Ignore storage errors.
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((previous) =>
        previous === 'asc' ? 'desc' : previous === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumn = (key: string) => {
    setColumnStates((previous) => ({
      ...previous,
      [activeType]: currentColumns.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column,
      ),
    }));
  };

  const handleColumnDragStart = (event: React.DragEvent<HTMLTableCellElement>, columnKey: string) => {
    setDraggedColumnKey(columnKey);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', columnKey);
  };

  const handleColumnDragOver = (event: React.DragEvent<HTMLTableCellElement>) => {
    if (!draggedColumnKey) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (event: React.DragEvent<HTMLTableCellElement>, targetColumnKey: string) => {
    event.preventDefault();

    if (!draggedColumnKey || draggedColumnKey === targetColumnKey) {
      setDraggedColumnKey(null);
      return;
    }

    setColumnStates((previous) => {
      const sourceColumns = previous[activeType] ?? [];
      const draggedIndex = sourceColumns.findIndex((column) => column.key === draggedColumnKey);
      const targetIndex = sourceColumns.findIndex((column) => column.key === targetColumnKey);

      if (draggedIndex === -1 || targetIndex === -1) {
        return previous;
      }

      const reordered = [...sourceColumns];
      const [movedColumn] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, movedColumn);

      return {
        ...previous,
        [activeType]: reordered,
      };
    });

    setDraggedColumnKey(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnKey(null);
  };

  const tabFilteredEvents = useMemo(() => {
    return events.filter((event) => event.type === activeType);
  }, [events, activeType]);

  const ipoSecurityTypeOptions = useMemo(() => {
    const values = Array.from(new Set(
      tabFilteredEvents
        .map((event) => typeof event.ipo_security_type === 'string' ? event.ipo_security_type : '')
        .filter(Boolean),
    ));

    return values.sort((left, right) => {
      const leftIndex = IPO_SECURITY_TYPE_ORDER.indexOf(left);
      const rightIndex = IPO_SECURITY_TYPE_ORDER.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) {
        return left.localeCompare(right);
      }
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    });
  }, [tabFilteredEvents]);

  const baseFilteredEvents = useMemo(() => {
    let filtered = [...tabFilteredEvents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) =>
        String(event.ticker ?? '').toLowerCase().includes(query) ||
        String(event.name ?? event.company_name ?? '').toLowerCase().includes(query) ||
        String(event.title ?? '').toLowerCase().includes(query) ||
        String(event.company_description ?? '').toLowerCase().includes(query) ||
        String(event.ipo_security_type ?? '').toLowerCase().includes(query) ||
        String(event.status ?? '').toLowerCase().includes(query) ||
        String(event.industry ?? '').toLowerCase().includes(query) ||
        String(event.source ?? '').toLowerCase().includes(query),
      );
    }

    if (activeType === 'ipos' && ipoSecurityTypeFilter !== 'all') {
      filtered = filtered.filter((event) => event.ipo_security_type === ipoSecurityTypeFilter);
    }

    if (supportsIndustryFilter && hasIndustryFilter) {
      filtered = filtered.filter((event) => selectedIndustrySet.has(String(event.industry ?? '')));
    }

    filtered = filtered.filter((event) =>
      matchesNumericRange(event.market_cap, marketCapMin, marketCapMax, 1_000_000_000) &&
      matchesNumericRange(event.float_pct, floatPctMin, floatPctMax) &&
      matchesNumericRange(event.institutional_pct, institutionalPctMin, institutionalPctMax),
    );

    return filtered;
  }, [
    tabFilteredEvents,
    searchQuery,
    activeType,
    ipoSecurityTypeFilter,
    hasIndustryFilter,
    selectedIndustrySet,
    supportsIndustryFilter,
    marketCapMin,
    marketCapMax,
    floatPctMin,
    floatPctMax,
    institutionalPctMin,
    institutionalPctMax,
  ]);

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...baseFilteredEvents];

    if (activeType === 'earnings' && confirmedFilter !== null) {
      filtered = filtered.filter((event) => Boolean(event.confirmed) === confirmedFilter);
    }

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [
    baseFilteredEvents,
    confirmedFilter,
    activeType,
    sortField,
    sortDirection,
  ]);

  const earningsStatusSummary = useMemo(() => {
    if (activeType !== 'earnings') {
      return null;
    }
    const confirmedCount = baseFilteredEvents.filter((event) => Boolean(event.confirmed)).length;
    const pendingCount = baseFilteredEvents.length - confirmedCount;
    return {
      confirmedCount,
      pendingCount,
      totalCount: baseFilteredEvents.length,
    };
  }, [activeType, baseFilteredEvents]);

  const hasActiveFilters = Boolean(
    searchQuery ||
    dateFrom ||
    dateTo ||
    confirmedFilter !== null ||
    (supportsWatchlistFilter && selectedWatchlistId !== 'all') ||
    (supportsIndustryFilter && hasIndustryFilter) ||
    ipoSecurityTypeFilter !== 'all' ||
    marketCapMin ||
    marketCapMax ||
    floatPctMin ||
    floatPctMax ||
    institutionalPctMin ||
    institutionalPctMax,
  );

  const clearAllFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedDatePreset(null);
    setSearchQuery('');
    setConfirmedFilter(null);
    setSelectedWatchlistId('all');
    setSelectedIndustries([]);
    setIpoSecurityTypeFilter('all');
    setMarketCapMin('');
    setMarketCapMax('');
    setFloatPctMin('');
    setFloatPctMax('');
    setInstitutionalPctMin('');
    setInstitutionalPctMax('');
    setSortField(getDefaultSortFieldForType(activeType));
    setSortDirection('desc');
  };

  const applyDatePreset = (preset: DatePresetKey) => {
    const range = buildDatePresetRange(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setSelectedDatePreset(preset);
  };

  const startCalendarJob = async (params: {
    url: string;
    label: string;
    failureMessage: string;
    requestBody?: Record<string, unknown> | null;
  }) => {
    setActionError(null);
    setUpdatePending(true);
    setShowJobLogs(false);
    setJobLabel(params.label);
    try {
      const requestBody = params.requestBody === undefined
        ? {
            from: dateFrom || undefined,
            to: dateTo || undefined,
          }
        : params.requestBody;
      const response = await fetch(`${API_BASE}${params.url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody == null ? undefined : JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
      }
      const data = await response.json() as { jobId: string };
      setJobId(data.jobId);
      setJobStatus(null);
    } catch (updateError) {
      setUpdatePending(false);
      setActionError(updateError instanceof Error ? updateError.message : params.failureMessage);
    }
  };

  const handleEarningsUpdate = async () => {
    await startCalendarJob({
      url: '/api/fmp/calendar/earnings/update',
      label: 'FMP earnings update',
      failureMessage: 'FMP earnings update failed',
      requestBody: {
        from: dateFrom || undefined,
        to: dateTo || undefined,
        concurrency: earningsUpdateConcurrency,
      },
    });
  };

  const handleIpoUpdate = async () => {
    await startCalendarJob({
      url: '/api/fmp/calendar/ipos/update',
      label: 'FMP IPO update',
      failureMessage: 'FMP IPO update failed',
    });
  };

  const handleIpoSecDownload = async () => {
    await startCalendarJob({
      url: '/api/fmp/calendar/ipos/sec-download',
      label: 'IPO SEC download',
      failureMessage: 'IPO SEC download failed',
    });
  };

  const handleFinancialHistorySync = async () => {
    await startCalendarJob({
      url: '/api/fmp/calendar/financials/update',
      label: 'FMP financial + past estimate sync',
      failureMessage: 'FMP financial + past estimate sync failed',
      requestBody: {
        concurrency: financialSyncConcurrency,
      },
    });
  };

  const cancelJob = async () => {
    if (!jobId || !jobStatus || jobStatus.status !== 'running') {
      return;
    }
    await fetch(`${API_BASE}/api/jobs/${jobId}/cancel`, { method: 'POST' });
  };

  const formatValue = (row: CalendarRow, key: string): string => {
    const value = row[key];
    if (value === undefined || value === null || value === '') {
      return '-';
    }

    if (key === 'ratio') {
      return getRatioValue(row);
    }
    if (key.endsWith('_date') || key === 'event_date') {
      return formatDateValue(value);
    }
    if (key === 'market_cap' || key === 'revenue_est' || key === 'revenue_actual' || key === 'amount' || key === 'offer_amount') {
      return typeof value === 'number' ? formatCompactCurrency(value) : String(value);
    }
    if (key === 'eps_est' || key === 'eps_actual') {
      return typeof value === 'number' ? value.toFixed(2) : String(value);
    }
    if (key === 'surprise_pct' || key === 'yield' || key === 'float_pct' || key === 'institutional_pct' || key === 'insider_pct' || key === 'sec_max_owner_pct' || key === 'sec_total_owner_pct') {
      return typeof value === 'number' ? formatPercent(value) : String(value);
    }
    if (typeof value === 'number') {
      return formatNumber(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  const renderCell = (row: CalendarRow, column: ColumnConfig) => {
    const value = row[column.key];

    if (column.key === 'ticker') {
      const ticker = typeof value === 'string' ? value : '';
      if (!ticker) {
        return <span>-</span>;
      }
      const companyName = typeof row.name === 'string' && row.name.trim()
        ? row.name.trim()
        : typeof row.company_name === 'string' && row.company_name.trim()
          ? row.company_name.trim()
          : null;
      return (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setTickerContextMenu(null);
            onTickerClick?.(ticker);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setTickerContextMenu({
              x: event.clientX,
              y: event.clientY,
              ticker,
              companyName,
            });
          }}
          {...getCompanyTickerDataAttrs(ticker)}
          title="Left click to link ticker. Right click for Financial."
          className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 font-medium"
        >
          {ticker}
        </button>
      );
    }

    if (column.key === 'confirmed') {
      const confirmed = Boolean(value);
      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${confirmed ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
          {confirmed ? 'Confirmed' : 'Pending'}
        </span>
      );
    }

    if (column.key === 'source') {
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          {formatValue(row, column.key)}
        </span>
      );
    }

    if (column.key === 'status') {
      const normalized = String(value ?? '').toLowerCase();
      const colorClass = normalized === 'priced'
        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
        : normalized === 'filed'
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          : normalized === 'expected'
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';

      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
          {formatValue(row, column.key)}
        </span>
      );
    }

    if (column.key === 'ipo_security_type') {
      const normalized = String(value ?? '').toLowerCase();
      const colorClass = normalized === 'common stock'
        ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
        : normalized === 'unit'
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
          : normalized === 'warrant'
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            : normalized === 'rights'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : normalized === 'etf'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';

      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
          {formatValue(row, column.key)}
        </span>
      );
    }

    if (column.key === 'prospectus_url' || column.key === 'disclosure_url') {
      const url = typeof value === 'string' ? value : '';
      if (!url) {
        return <span>-</span>;
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open
        </a>
      );
    }

    if (column.key === 'company_description') {
      const text = formatValue(row, column.key);
      return <span className="block max-w-[320px] truncate" title={text}>{text}</span>;
    }

    if (column.key === 'surprise_pct' && typeof value === 'number') {
      return (
        <span className={value > 0 ? 'text-green-600 dark:text-green-400 font-medium' : value < 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
          {formatValue(row, column.key)}
        </span>
      );
    }

    return <span>{formatValue(row, column.key)}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium flex items-center gap-2 mb-3">
          <CalendarIcon className="w-4 h-4" />
          Events Calendar
        </h3>

        <div className="flex items-center gap-1 mb-3">
          {typeConfigs.map((typeConfig) => (
            <button
              key={typeConfig.key}
              onClick={() => {
                setActiveType(typeConfig.key);
                setSortField(getDefaultSortFieldForType(typeConfig.key));
                setSortDirection('desc');
                if (typeConfig.key === 'economics') {
                  setSelectedIndustries([]);
                }
                setShowIndustryMenu(false);
                setTickerContextMenu(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeType === typeConfig.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
              }`}
            >
              {typeConfig.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol, company, title, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setSelectedDatePreset(null);
              }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setSelectedDatePreset(null);
              }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
          </div>

          {supportsWatchlistFilter && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowWatchlistMenu((value) => !value);
                  setShowColumnMenu(false);
                  setShowIndustryMenu(false);
                  setShowFmpSettingsMenu(false);
                }}
                className="flex max-w-[180px] items-center gap-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <span className="truncate">{selectedWatchlistLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>

              {showWatchlistMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowWatchlistMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 max-h-80 w-64 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20 p-2">
                    <button
                      onClick={() => {
                        setSelectedWatchlistId('all');
                        setShowWatchlistMenu(false);
                      }}
                      className={`w-full rounded px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedWatchlistId === 'all' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}`}
                    >
                      All Watchlists
                    </button>
                    {watchlists.map((watchlist) => (
                      <button
                        key={watchlist.id}
                        onClick={() => {
                          setSelectedWatchlistId(watchlist.id);
                          setShowWatchlistMenu(false);
                        }}
                        className={`w-full rounded px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedWatchlistId === watchlist.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}`}
                      >
                        <div className="truncate font-medium">{watchlist.name}</div>
                        <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{watchlist.itemCount} tickers</div>
                      </button>
                    ))}
                    {watchlists.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No watchlists found</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {supportsIndustryFilter && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowIndustryMenu((value) => !value);
                  setIndustryInstructionMenu(null);
                  setShowWatchlistMenu(false);
                  setShowColumnMenu(false);
                  setShowFmpSettingsMenu(false);
                }}
                className={`flex max-w-[190px] items-center gap-1 px-3 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-600 ${hasIndustryFilter ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                title={hasIndustryFilter ? selectedIndustries.join(', ') : 'Industry filter'}
              >
                <span className="truncate">{selectedIndustryLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>

              {showIndustryMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => { setShowIndustryMenu(false); setIndustryInstructionMenu(null); }}
                  />
                  <div className="absolute right-0 top-full mt-1 max-h-80 w-72 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20 p-2">
                    <label className={`flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${!hasIndustryFilter ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!hasIndustryFilter}
                        onChange={() => setSelectedIndustries([])}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">All Industries</span>
                    </label>
                    {industryOptions.map((industry) => {
                      const checked = selectedIndustrySet.has(industry);
                      return (
                        <label
                          key={industry}
                          onContextMenu={(event) => openIndustryInstructionMenu(event, industry)}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${checked ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}`}
                          title="Right-click for Instruction"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectedIndustry(industry)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="block truncate">{industry}</span>
                        </label>
                      );
                    })}
                    {industryOptions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No industries found</div>
                    )}
                  </div>
                  {industryInstructionMenu && (
                    <div
                      className="fixed z-30 w-[188px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
                      style={getInstructionMenuStyle(industryInstructionMenu.x, industryInstructionMenu.y)}
                    >
                      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                        <div className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{industryInstructionMenu.industry}</div>
                        <div className="text-[10px] uppercase text-gray-400">Industry</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openIndustryInstructionDialog(industryInstructionMenu.industry)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <CircleHelp className="h-3.5 w-3.5 text-blue-500" />
                        <span>Instruction</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => {
                setShowColumnMenu(!showColumnMenu);
                setShowWatchlistMenu(false);
                setShowIndustryMenu(false);
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Settings2 className="w-4 h-4" />
              Columns
            </button>
            
            {showColumnMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowColumnMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-56 max-h-96 overflow-auto">
                  <div className="p-2 space-y-1">
                    {currentColumns.map((column) => (
                      <label
                        key={column.key}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.visible}
                          onChange={() => toggleColumn(column.key)}
                          className="rounded"
                        />
                        <span className="text-sm">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {activeType === 'earnings' && (
            <>
              <button
                onClick={handleEarningsUpdate}
                disabled={updatePending}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded text-white ${updatePending ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <RefreshCw className={`w-4 h-4 ${updatePending ? 'animate-spin' : ''}`} />
                Update FMP Earnings Dates
              </button>
              <button
                onClick={handleFinancialHistorySync}
                disabled={updatePending}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded text-white ${updatePending ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                <RefreshCw className={`w-4 h-4 ${updatePending ? 'animate-spin' : ''}`} />
                Sync Financial + Past Estimates
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    setShowFmpSettingsMenu((value) => !value);
                    setShowWatchlistMenu(false);
                    setShowIndustryMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Settings2 className="w-4 h-4" />
                  FMP Sync Settings
                </button>

                {showFmpSettingsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowFmpSettingsMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg z-20">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                        FMP Sync Concurrency
                      </div>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                            Earnings Update
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={earningsUpdateConcurrency}
                            onChange={(event) => saveEarningsUpdateConcurrency(Number(event.target.value))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                            Financial Sync
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={financialSyncConcurrency}
                            onChange={(event) => saveFinancialSyncConcurrency(Number(event.target.value))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-5">
                          Higher values speed up the next run but can hit FMP rate limits. These values apply only to the next button click and stay saved in this window.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeType === 'ipos' && (
            <>
              <button
                onClick={handleIpoUpdate}
                disabled={updatePending || !hasRequiredDateRange}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded text-white ${(updatePending || !hasRequiredDateRange) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <RefreshCw className={`w-4 h-4 ${updatePending ? 'animate-spin' : ''}`} />
                Update FMP IPO
              </button>
              <button
                onClick={handleIpoSecDownload}
                disabled={updatePending || !hasRequiredDateRange}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded text-white ${(updatePending || !hasRequiredDateRange) ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                <RefreshCw className={`w-4 h-4 ${updatePending ? 'animate-spin' : ''}`} />
                Download SEC Data
              </button>
            </>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Quick Range</span>
          {DATE_PRESET_OPTIONS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => applyDatePreset(preset.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedDatePreset === preset.key ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {numericFilters.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 mb-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
            {numericFilters.map((filterConfig) => {
              const minValue = filterConfig.key === 'market_cap'
                ? marketCapMin
                : filterConfig.key === 'float_pct'
                  ? floatPctMin
                  : institutionalPctMin;
              const maxValue = filterConfig.key === 'market_cap'
                ? marketCapMax
                : filterConfig.key === 'float_pct'
                  ? floatPctMax
                  : institutionalPctMax;
              const setMinValue = filterConfig.key === 'market_cap'
                ? setMarketCapMin
                : filterConfig.key === 'float_pct'
                  ? setFloatPctMin
                  : setInstitutionalPctMin;
              const setMaxValue = filterConfig.key === 'market_cap'
                ? setMarketCapMax
                : filterConfig.key === 'float_pct'
                  ? setFloatPctMax
                  : setInstitutionalPctMax;

              return (
                <div key={filterConfig.key} className="flex items-end gap-2">
                  <div className="min-w-[74px] text-xs font-medium text-gray-600 dark:text-gray-300 pb-2">
                    {filterConfig.label}
                    <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">{filterConfig.unitLabel}</span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    placeholder="Min"
                    className="w-24 px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="pb-2 text-xs text-gray-400">to</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    placeholder="Max"
                    className="w-24 px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              );
            })}
          </div>
        )}

        {activeType === 'ipos' && (
          <div className="flex flex-wrap items-end gap-3 mb-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
            <div className="min-w-[92px] text-xs font-medium text-gray-600 dark:text-gray-300 pb-2">
              Security Type
            </div>
            <select
              value={ipoSecurityTypeFilter}
              onChange={(e) => setIpoSecurityTypeFilter(e.target.value)}
              className="min-w-[180px] px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {ipoSecurityTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}

        {activeType === 'earnings' && (
          <div className="space-y-2">
            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
              FMP stable earnings source does not provide reliable time or session. Date, estimate/actual, and DB-based ownership columns are supported.
            </div>
            {hasRequiredDateRange && earningsStatusSummary && earningsStatusSummary.totalCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                <span className="font-medium">Status</span>
                <button
                  onClick={() => setConfirmedFilter(null)}
                  className={`inline-flex items-center rounded border px-2 py-0.5 font-medium ${confirmedFilter === null ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500' : 'border-blue-200 bg-white text-blue-700 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300'}`}
                >
                  All {earningsStatusSummary.totalCount}
                </button>
                <button
                  onClick={() => setConfirmedFilter(true)}
                  className={`inline-flex items-center rounded border px-2 py-0.5 font-medium ${confirmedFilter === true ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500' : 'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-700 dark:bg-gray-900 dark:text-emerald-300'}`}
                >
                  Confirmed {earningsStatusSummary.confirmedCount}
                </button>
                <button
                  onClick={() => setConfirmedFilter(false)}
                  className={`inline-flex items-center rounded border px-2 py-0.5 font-medium ${confirmedFilter === false ? 'border-slate-600 bg-slate-600 text-white dark:border-slate-400 dark:bg-slate-500' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-gray-900 dark:text-slate-300'}`}
                >
                  Pending {earningsStatusSummary.pendingCount}
                </button>
                {earningsStatusSummary.pendingCount === 0 ? (
                  <span>현재 선택 범위에는 이미 발표된 실적만 있습니다. pending estimate를 보려면 종료일을 더 미래로 늘리세요.</span>
                ) : null}
              </div>
            )}
          </div>
        )}

        {activeType === 'ipos' && (
          <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded px-3 py-2">
            IPO rows come from FMP IPO calendar. Security Type is inferred from FMP ticker and company name text because FMP does not expose a dedicated warrant/unit/right field. The SEC download action fills company description and named-owner percentages parsed from prospectus or disclosure documents.
          </div>
        )}

        {actionError && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{actionError}</div>
        )}

        {jobStatus && (
          <div className="mt-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-sm font-medium">
                {jobLabel}: <span className="capitalize">{jobStatus.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowJobLogs((value) => !value)}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Eye className="w-3 h-3" />
                  {showJobLogs ? 'Hide Log' : 'View Log'}
                </button>
                {jobStatus.status === 'running' && (
                  <button
                    onClick={cancelJob}
                    className="px-2 py-1 text-xs border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${jobStatus.progress.pct}%` }} />
            </div>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {jobStatus.progress.completed} / {jobStatus.progress.total || 0} steps, {jobStatus.progress.pct}%
            </div>
            {jobStatus.error && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">{jobStatus.error}</div>
            )}
            {showJobLogs && (
              <div className="mt-3 max-h-40 overflow-auto rounded bg-gray-50 dark:bg-gray-950 p-2 text-xs font-mono whitespace-pre-wrap">
                {jobStatus.logs.length > 0 ? jobStatus.logs.join('\n') : 'No logs yet'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!hasRequiredDateRange ? (
          <div className="flex items-center justify-center h-40 px-6 text-sm text-gray-500 text-center">
            Select both start and end dates to load calendar events.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">Loading calendar events...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    draggable
                    onDragStart={(event) => handleColumnDragStart(event, column.key)}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, column.key)}
                    onDragEnd={handleColumnDragEnd}
                    className={`px-3 py-2 text-xs font-medium border-b border-gray-300 dark:border-gray-700 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} ${draggedColumnKey === column.key ? 'opacity-50' : ''}`}
                  >
                    <div className={`inline-flex w-full items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      <GripVertical className="h-3 w-3 shrink-0 text-gray-400" />
                      <button
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {column.label}
                        {sortField === column.key && sortDirection === 'asc' && <ChevronUp className="w-3 h-3" />}
                        {sortField === column.key && sortDirection === 'desc' && <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedEvents.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 text-sm ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {hasRequiredDateRange && !loading && !error && filteredAndSortedEvents.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-500">
            No events found for the current filters
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        {hasRequiredDateRange
          ? `Showing ${filteredAndSortedEvents.length} of ${tabFilteredEvents.length} events${supportsWatchlistFilter && selectedWatchlistId !== 'all' ? ` · Watchlist: ${selectedWatchlistLabel}` : ''}${supportsIndustryFilter && hasIndustryFilter ? ` · Industry: ${selectedIndustryStatusLabel}` : ''}`
          : 'Select a start and end date to load events'}
      </div>

      {tickerContextMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setTickerContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setTickerContextMenu(null);
            }}
          />
          <div
            className="fixed z-40 min-w-[210px] overflow-hidden rounded-xl border border-gray-300 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800"
            style={(() => {
              const menuW = 220;
              const menuH = tickerContextMenu.companyName ? 108 : 84;
              const maxX = typeof window !== 'undefined' ? window.innerWidth - menuW - 8 : tickerContextMenu.x;
              const maxY = typeof window !== 'undefined' ? window.innerHeight - menuH - 8 : tickerContextMenu.y;
              return {
                left: Math.max(8, Math.min(tickerContextMenu.x, maxX)),
                top: Math.max(8, Math.min(tickerContextMenu.y, maxY)),
              } as React.CSSProperties;
            })()}
          >
            <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Ticker</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{tickerContextMenu.ticker}</div>
              {tickerContextMenu.companyName ? (
                <div className="mt-1 truncate text-[11px] text-gray-500 dark:text-gray-400">{tickerContextMenu.companyName}</div>
              ) : null}
            </div>
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => {
                setFinancialTarget({
                  ticker: tickerContextMenu.ticker,
                  companyName: tickerContextMenu.companyName,
                });
                setTickerContextMenu(null);
              }}
            >
              <span>Financial</span>
              <span className="text-xs text-gray-400">Charts</span>
            </button>
          </div>
        </>
      )}

      <Dialog open={Boolean(industryInstructionTarget)} onOpenChange={(open) => { if (!open) closeIndustryInstructionDialog(); }}>
        <DialogContent className="max-h-[86vh] overflow-hidden border-gray-200 bg-white p-0 sm:max-w-4xl dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <DialogTitle className="text-left text-base font-semibold text-gray-950 dark:text-gray-50">
              Industry Instruction: {industryInstructionDetail?.industry ?? industryInstructionTarget}
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-gray-500 dark:text-gray-400">
              App DB 기준 industry 요약과 market cap 순 ticker 목록입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(86vh-96px)] overflow-y-auto px-5 py-4">
            {industryInstructionLoading ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading industry details...</div>
            ) : industryInstructionError ? (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {industryInstructionError}
              </div>
            ) : industryInstructionDetail ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">{industryInstructionDetail.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Tickers</div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{industryInstructionDetail.totalTickers}</div>
                  </div>
                  <div className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">With Market Cap</div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{industryInstructionDetail.tickersWithMarketCap}</div>
                  </div>
                  <div className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700 sm:col-span-2">
                    <div className="text-gray-500 dark:text-gray-400">Sectors</div>
                    <div className="mt-1 truncate font-semibold text-gray-900 dark:text-gray-100" title={industryInstructionDetail.sectors.join(', ')}>
                      {industryInstructionDetail.sectors.length > 0 ? industryInstructionDetail.sectors.join(', ') : '-'}
                    </div>
                  </div>
                </div>
                <div className="overflow-auto rounded border border-gray-200 dark:border-gray-700">
                  <table className="min-w-[760px] w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ticker</th>
                        <th className="px-3 py-2 font-medium">Company</th>
                        <th className="px-3 py-2 font-medium">Sector</th>
                        <th className="px-3 py-2 text-right font-medium">Market Cap</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Company Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {industryInstructionDetail.tickers.map((row) => (
                        <tr key={row.ticker} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                          <td className="px-3 py-2 font-semibold text-blue-600 dark:text-blue-300">
                            <button type="button" className="hover:underline" onClick={() => onTickerClick?.(row.ticker)}>{row.ticker}</button>
                          </td>
                          <td className="max-w-[180px] px-3 py-2 text-gray-700 dark:text-gray-200">
                            <div className="truncate" title={row.name ?? ''}>{row.name ?? '-'}</div>
                            {row.exchange ? <div className="text-[10px] text-gray-400">{row.exchange}</div> : null}
                          </td>
                          <td className="max-w-[160px] px-3 py-2 text-gray-600 dark:text-gray-300"><div className="truncate" title={row.sector ?? ''}>{row.sector ?? '-'}</div></td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{row.marketCap === null || row.marketCap === undefined ? '-' : formatCompactCurrency(row.marketCap)}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.marketCapSource ?? '-'}</td>
                          <td className="max-w-[260px] px-3 py-2 text-gray-600 dark:text-gray-300">
                            <div className="truncate" title={row.description ?? ''}>{row.description ?? '-'}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {industryInstructionDetail.truncated ? (
                  <div className="text-xs text-amber-600 dark:text-amber-300">
                    Showing first {industryInstructionDetail.tickers.length} of {industryInstructionDetail.totalTickers} tickers by market cap.
                  </div>
                ) : null}
                <div className="text-[11px] text-gray-400">Source: {industryInstructionDetail.dataSource}</div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <CalendarFinancialDialog
        open={Boolean(financialTarget)}
        ticker={financialTarget?.ticker ?? null}
        companyName={financialTarget?.companyName ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setFinancialTarget(null);
          }
        }}
      />
    </div>
  );
}