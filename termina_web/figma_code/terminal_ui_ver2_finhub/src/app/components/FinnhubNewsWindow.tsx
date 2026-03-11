import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Save, FolderOpen, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw, Download, Columns3, Eye, X, Calendar, TrendingUp, Plus, Settings2, Square } from 'lucide-react';
import { VariableSizeList as List } from 'react-window';
import { BookmarkManager } from './BookmarkManager';

const API_BASE = "";

// ─── Heights ───
const STICKY_DATE_HEADER_HEIGHT = 32;
const ROW_HEIGHT_TITLE_ONLY = 88;
const ROW_HEIGHT_WITH_ABSTRACT = 140;

// ─── Display mode ───
type DisplayMode = 'title-only' | 'title-abstract';

// ─── Column definition ───
type ColumnId = 'date' | 'ticker' | 'time' | 'title' | 'publisher' | 'industry' | 'source' | 'changes' | 'fulltext' | 'keywords' | 'score' | 'scoreEvidence' | 'sentiment' | 'peers' | 'companyDesc';

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
  { id: 'time',         label: 'Time',       defaultWidth: 52,  minWidth: 40 },
  { id: 'title',        label: 'Title',      defaultWidth: 300, minWidth: 100, flex: true },
  { id: 'publisher',    label: 'Publisher',  defaultWidth: 96,  minWidth: 60 },
  { id: 'industry',     label: 'Industry',   defaultWidth: 110, minWidth: 60 },
  { id: 'source',       label: 'Sources',    defaultWidth: 90,  minWidth: 50 },
  { id: 'fulltext',     label: 'Full Text',  defaultWidth: 60,  minWidth: 40 },
  { id: 'changes',      label: 'Changes %',  defaultWidth: 280, minWidth: 160 },
  { id: 'keywords',     label: 'Keywords',   defaultWidth: 160, minWidth: 80 },
  { id: 'score',        label: 'Score',      defaultWidth: 58,  minWidth: 40 },
  { id: 'scoreEvidence', label: 'Evidence',  defaultWidth: 200, minWidth: 80 },
  { id: 'sentiment',    label: 'Sentiment',  defaultWidth: 80,  minWidth: 50 },
  { id: 'peers',        label: 'Peers',      defaultWidth: 160, minWidth: 80 },
  { id: 'companyDesc',  label: 'Company Desc', defaultWidth: 200, minWidth: 100 },
];

// Columns hidden by default — user can enable via Columns menu
const HIDDEN_BY_DEFAULT: ColumnId[] = ['source', 'keywords', 'score', 'scoreEvidence', 'sentiment', 'peers', 'companyDesc'];
const DEFAULT_VISIBLE: Set<ColumnId> = new Set(DEFAULT_COLUMNS.filter(c => !HIDDEN_BY_DEFAULT.includes(c.id)).map(c => c.id));

// ─── Sort ───
type SortDir = 'asc' | 'desc' | null;
interface SortState { column: ColumnId | null; dir: SortDir; }

// ─── Source type filter ───
type SourceTypeFilter = 'all' | 'company_news' | 'press_release' | 'market_news';

function getSourceTypeLabel(sourceType: SourceTypeFilter | string): string {
  if (sourceType === 'company_news') return 'Company News';
  if (sourceType === 'press_release') return 'Press Release';
  if (sourceType === 'market_news') return 'Market News';
  return 'All';
}

function getSourceTypeShortLabel(sourceType: SourceTypeFilter | string): string {
  if (sourceType === 'company_news') return 'Co.';
  if (sourceType === 'press_release') return 'PR';
  if (sourceType === 'market_news') return 'Mkt.';
  return 'All';
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

function getRtprTickerConcurrency(): number {
  try {
    const value = parseInt(localStorage.getItem('rtpr-ticker-concurrency') ?? '', 10);
    return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 5;
  } catch {
    return 5;
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
  change_computed_at?: string | null;
  hasFullText?: boolean;
  keywords?: string[];
  keywordsStatus?: string | null;
  industry?: string | null;
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
  hasFullText: boolean;
  keywords: string[];
  keywordsStatus: string | null;
  industry: string | null;
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

function mapBackendItem(item: BackendNewsItem): DisplayItem {
  const d = new Date(item.published_at);
  return {
    id: item.id,
    publishedAt: item.published_at,
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
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
    hasFullText: !!item.hasFullText,
    keywords: item.keywords ?? [],
    keywordsStatus: item.keywordsStatus ?? null,
    industry: item.industry ?? null,
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

const changeColor = (val: number | null) => {
  if (val === null || val === undefined) return 'text-gray-400';
  return val > 0 ? 'text-green-600 dark:text-green-400' : val < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
};

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
  const [searchQuery, setSearchQuery] = useState(initialTicker || '');
  const [tickerQuery, setTickerQuery] = useState(initialTicker || '');
  const [fromDate, setFromDate] = useState(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.fromDate === 'string') return p.fromDate;
      }
    } catch { /* ignore */ }
    return '';
  });
  const [toDate, setToDate] = useState(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.toDate === 'string') return p.toDate;
      }
    } catch { /* ignore */ }
    return '';
  });
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [selectedBookmarkFolderId, setSelectedBookmarkFolderId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.selectedBookmarkFolderId === 'string') return p.selectedBookmarkFolderId;
      }
    } catch { /* ignore */ }
    return '';
  });
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

  // Full text extraction job
  const [ftUpdating, setFtUpdating] = useState(false);

  // Company description popup
  const [descPopup, setDescPopup] = useState<{ ticker: string; text: string } | null>(null);

  // Display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.displayMode === 'title-abstract') return 'title-abstract';
      }
    } catch { /* ignore */ }
    return 'title-only';
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering + visibility
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.visibleCols)) {
          const valid = (p.visibleCols as string[]).filter(c => DEFAULT_COLUMNS.some(d => d.id === c)) as ColumnId[];
          if (valid.length > 0) return new Set(valid);
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMNS.map(c => c.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Visible columns (filtered + preserving order)
  const activeColumns = useMemo(() => columns.filter(c => visibleCols.has(c.id)), [columns, visibleCols]);
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

  // Sort
  const [sort, setSort] = useState<SortState>({ column: null, dir: null });

  // Source type filter
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>(() => {
    try {
      const saved = localStorage.getItem('finhub-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (['all', 'company_news', 'press_release', 'market_news'].includes(p.sourceTypeFilter)) {
          return p.sourceTypeFilter as SourceTypeFilter;
        }
      }
    } catch { /* ignore */ }
    return 'all';
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
  type UpdateSourceType = 'all' | 'company_news' | 'press_release' | 'market_news';
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
  const [rtprTickerConcurrencyInput, setRtprTickerConcurrencyInput] = useState(() => String(getRtprTickerConcurrency()));
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightData, setPreflightData] = useState<{ totalTickers: number; fallbackCount: number; fallbackTickers: string[] } | null>(null);
  const [pendingUpdateSourceType, setPendingUpdateSourceType] = useState<UpdateSourceType>('all');

  // ─── Background job tracking ───
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [jobStatus, setJobStatus] = useState<{
    status: 'running' | 'done' | 'failed' | 'cancelled';
    progress: { completed: number; total: number; pct: number };
    logs: string[];
    error?: string;
    result?: Record<string, unknown>;
  } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const tickerQueryRef = useRef(tickerQuery);
  tickerQueryRef.current = tickerQuery;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const displayModeMenuRef = useRef<HTMLDivElement>(null);
  // columnMenuRef declared above with column state

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
      if (!res.ok) return;
      const folders: BookmarkFolder[] = Array.isArray(data) ? data : Array.isArray(data.folders) ? data.folders : [];
      setBookmarkFolders(folders);
      // fallback: if restored selectedBookmarkFolderId no longer exists, reset
      if (selectedBookmarkFolderId && folders.length > 0 && !folders.some(f => f.id === selectedBookmarkFolderId)) {
        setSelectedBookmarkFolderId('');
      }
    } catch {
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
      params.set('source_names', 'FINNHUB,RTPR');
      if (selectedBookmarkFolderId) {
        params.set('bookmarkFolderId', selectedBookmarkFolderId);
      }
      if (sourceTypeFilter !== 'all') {
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
      params.set('limit', '500');

      const res = await fetch(`${API_BASE}/api/news?${params.toString()}`, { signal: controller.signal });
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
  }, [selectedBookmarkFolderId, sourceTypeFilter, fromDate, toDate]);

  // ─── Fetch more (cursor-based append) ───
  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('source_names', 'FINNHUB,RTPR');
      if (selectedBookmarkFolderId) {
        params.set('bookmarkFolderId', selectedBookmarkFolderId);
      }
      if (sourceTypeFilter !== 'all') {
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
      params.set('limit', '500');
      params.set('cursor', nextCursor);

      const res = await fetch(`${API_BASE}/api/news?${params.toString()}`);
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
  }, [nextCursor, loadingMore, selectedBookmarkFolderId, sourceTypeFilter, fromDate, toDate]);

  useEffect(() => {
    fetchBookmarkFolders();
  }, [fetchBookmarkFolders]);

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
    setJobStatus(null);
    try {
      const body: Record<string, unknown> = {
        mode,
        sourceType,
        tickerConcurrency: getFinnhubTickerConcurrency(),
        requestIntervalMs: getFinnhubRequestIntervalMs(),
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
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      setCurrentJobId(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start update');
      setUpdating(false);
    }
  };

  // ─── Recent Update with preflight check ───
  const handleRecentWithPreflight = async (sourceType: UpdateSourceType) => {
    if (sourceType === 'market_news') {
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

  // ─── PTPR (RTPR) press release pull ───
  const handlePtprUpdate = async (mode: 'recent' | 'custom', from?: string, to?: string) => {
    setUpdating(true);
    setError(null);
    setJobStatus(null);
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
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      setCurrentJobId(data.jobId);
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

  const handleSaveControlWindow = () => {
    const finnhubTickerConcurrency = Math.max(1, Math.min(20, parseInt(finnhubTickerConcurrencyInput, 10) || 5));
    const finnhubRequestIntervalSec = Math.max(0, Math.min(10, parseFloat(finnhubRequestIntervalSecInput) || 1));
    const rtprTickerConcurrency = Math.max(1, Math.min(20, parseInt(rtprTickerConcurrencyInput, 10) || 5));

    try {
      localStorage.setItem('finnhub-ticker-concurrency', String(finnhubTickerConcurrency));
      localStorage.setItem('finnhub-request-interval-sec', String(finnhubRequestIntervalSec));
      localStorage.setItem('rtpr-ticker-concurrency', String(rtprTickerConcurrency));
    } catch {
      // ignore localStorage failures
    }

    setFinnhubTickerConcurrencyInput(String(finnhubTickerConcurrency));
    setFinnhubRequestIntervalSecInput(String(finnhubRequestIntervalSec));
    setRtprTickerConcurrencyInput(String(rtprTickerConcurrency));
    setShowControlWindow(false);
  };

  // ─── Change Update: Recent (last 7 days, all metrics) ───
  const handleRecentChangeUpdate = async () => {
    setUpdating(true);
    setError(null);
    setJobStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/change/update-recent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      setCurrentJobId(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start recent change update');
      setUpdating(false);
    }
  };

  // ─── Change Update: Custom date range (all metrics) ───
  const handleCustomChangeUpdate = async (from: string, to: string) => {
    setUpdating(true);
    setError(null);
    setJobStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/change/update-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setUpdating(false);
        return;
      }
      setCurrentJobId(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start custom change update');
      setUpdating(false);
    }
  };

  // ─── Calendar Update: backfill or refresh ───
  const handleCalendarUpdate = async (mode: 'backfill' | 'refresh') => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ibkr/calendar/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start calendar update');
    } finally {
      setUpdating(false);
    }
  };

  // ─── Calendar Custom Update ───
  const handleCalendarUpdateCustom = async (from: string, to: string) => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ibkr/calendar/update-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start custom calendar update');
    } finally {
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
  type FtSourceType = 'all' | 'company_news' | 'press_release' | 'market_news' | 'rtpr';
  const [lastFtSourceType, setLastFtSourceType] = useState<FtSourceType>('all');

  const handleFulltextUpdate = async (sourceType: FtSourceType = 'all') => {
    if (updating || ftUpdating) return;
    setLastFtSourceType(sourceType);
    setFtUpdating(true);
    setError(null);
    setJobStatus(null);
    try {
      // Read concurrency from Settings (localStorage)
      let concurrency = 10;
      try {
        const v = parseInt(localStorage.getItem('ft-concurrency') ?? '', 10);
        if (v >= 1 && v <= 200) concurrency = v;
      } catch { /* ignore */ }
      const endpoint = sourceType === 'rtpr'
        ? `${API_BASE}/api/news/fulltext/backfill-rtpr`
        : `${API_BASE}/api/news/fulltext/update`;
      const payload = sourceType === 'rtpr'
        ? { concurrency }
        : { sourceType, concurrency };
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
      setCurrentJobId(data.jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start fulltext extraction');
      setFtUpdating(false);
    }
  };

  /** Reset failed/unavailable fulltext rows and start re-extraction */
  const handleResetAndRetry = async () => {
    if (updating || ftUpdating) return;
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
    if (!currentJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${currentJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setJobStatus(data);
        if (data.status === 'done') {
          setUpdating(false);
          setFtUpdating(false);
          fetchNews(searchQuery || undefined);
        } else if (data.status === 'failed') {
          setUpdating(false);
          setFtUpdating(false);
          setError(data.error || 'Job failed');
        } else if (data.status === 'cancelled') {
          setUpdating(false);
          setFtUpdating(false);
        }
      } catch {
        // Ignore transient fetch errors; will retry next interval
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId]);

  // Auto-scroll log panel to bottom
  useEffect(() => {
    if (showLogPanel && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus?.logs?.length, showLogPanel]);

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
      case 'source': return item.source.toLowerCase();
      case 'fulltext': return item.hasFullText ? 1 : 0;
      case 'changes': return item.changeFromOpenPct ?? 0;
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

  // ─── Persist UI state (visibleCols / displayMode / sourceTypeFilter / searchQuery / tickerQuery / fromDate / toDate) ───
  useEffect(() => {
    try {
      localStorage.setItem('finhub-news-ui-state', JSON.stringify({
        visibleCols: Array.from(visibleCols),
        displayMode,
        sourceTypeFilter,
        searchQuery,
        tickerQuery,
        fromDate,
        toDate,
        selectedBookmarkFolderId,
      }));
    } catch { /* quota / SSR */ }
  }, [visibleCols, displayMode, sourceTypeFilter, searchQuery, tickerQuery, fromDate, toDate, selectedBookmarkFolderId]);

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
              <span className="text-[10px] text-gray-400 mt-0.5">
                {getSourceTypeLabel(newsItem.sourceType)}
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
      case 'source':
        return renderLinkCell(newsItem.source, 'text-gray-600 dark:text-gray-400', newsItem.url);
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
          <div className="flex flex-col justify-center gap-0 w-full">
            <div className="flex items-center gap-1">
              <span className="text-gray-500 shrink-0">Chg:</span>
              <span className={changeColor(newsItem.changePct)}>{formatChange(newsItem.changePct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→C:</span>
              <span className={changeColor(newsItem.changeFromOpenPct)}>{formatChange(newsItem.changeFromOpenPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.O→H:</span>
              <span className={changeColor(newsItem.changeOpenToHighPct)}>{formatChange(newsItem.changeOpenToHighPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+1D:</span>
              <span className={changeColor(newsItem.change1dPct)}>{formatChange(newsItem.change1dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+3D:</span>
              <span className={changeColor(newsItem.change3dPct)}>{formatChange(newsItem.change3dPct)}</span>
            </div>
            <div className="flex items-center gap-1">
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
                  col.id === 'changes' ? 'py-1' : '',
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
      {/* Row 1: Search bar | Source type filter | Update | Refresh | Save | Load | Filter */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
                placeholder="Search news... (Enter)"
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="relative">
              <TrendingUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={tickerQuery} onChange={(e) => setTickerQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
                placeholder="Ticker only (e.g. AAPL, TSLA) (Enter)"
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Source type filter toggle */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
            {(['all', 'company_news', 'press_release', 'market_news'] as SourceTypeFilter[]).map(st => (
              <button
                key={st}
                onClick={() => setSourceTypeFilter(st)}
                className={`px-2 py-1.5 text-[10px] whitespace-nowrap transition-colors ${
                  sourceTypeFilter === st
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {getSourceTypeLabel(st)}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowBookmarkMenu(prev => !prev)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
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
                {/* Separator + New folder + Manager */}
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
                  top: Math.min(bookmarkFolderCtxMenu.y, typeof window !== 'undefined' ? window.innerHeight - 80 : bookmarkFolderCtxMenu.y),
                }}
              >
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

          {/* Update split-button with dropdown menu */}
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
                  className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title={`Repeat last update: ${mainBtnLabel}`}
                >
                  <Download className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
                  <span className="text-xs">{updating ? 'Pulling...' : mainBtnLabel}</span>
                </button>
                {/* Dropdown arrow */}
                <button
                  onClick={() => setShowUpdateMenu(!showUpdateMenu)}
                  disabled={updating}
                  className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
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
                      <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('market_news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">Custom Market News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · limited by Finnhub /news history depth</div></div>
                      </button>

                      {/* ── Change Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Change Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); handleRecentChangeUpdate(); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 text-teal-500" />
                        <div><div className="font-medium">Recent Change% Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Recalculate all change % for news from last 7 days</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); setChangeCustomFrom(''); setChangeCustomTo(new Date().toISOString().slice(0, 10)); setShowChangeCustomDateModal(true); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <div><div className="font-medium">Custom Change% Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick date range · recalculate all change % for news in range</div></div>
                      </button>

                      {/* ── Calendar Update ── */}
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Calendar Update</div>
                      <button onClick={() => { setShowUpdateMenu(false); handleCalendarUpdate('backfill'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <div><div className="font-medium">Initial Calendar Backfill</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Past 2 years + future 180 days · run once for initial setup</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); handleCalendarUpdate('refresh'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <RotateCw className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <div><div className="font-medium">Refresh Upcoming Calendar</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 30 days overlap + next 90 days · does not re-fetch full history</div></div>
                      </button>
                      <button onClick={() => { setShowUpdateMenu(false); setCalendarCustomFrom(''); setCalendarCustomTo(new Date().toISOString().slice(0, 10)); setShowCalendarCustomDateModal(true); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-rose-300" />
                        <div><div className="font-medium">Custom Calendar Update</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">사용자 지정 날짜 범위로 캘린더 이벤트를 수집합니다</div></div>
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
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* View Log button — always visible, disabled when no job */}
          <button
            onClick={() => currentJobId && setShowLogPanel(!showLogPanel)}
            disabled={!currentJobId}
            className={`px-3 py-1.5 border rounded transition-colors flex items-center gap-1.5 text-xs ${
              !currentJobId
                ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                : showLogPanel
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title={currentJobId ? "View update job logs and progress" : "No active job — click Update first"}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Log</span>
            {jobStatus?.status === 'running' && (
              <span className="ml-1 text-[10px] text-blue-500 tabular-nums">{jobStatus.progress.pct}%</span>
            )}
            {jobStatus?.status === 'done' && (
              <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
            )}
            {jobStatus?.status === 'failed' && (
              <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
            )}
          </button>

          {/* Full Text Extract split-button */}
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
              : lastFtSourceType === 'company_news' ? 'FT Co.'
              : lastFtSourceType === 'press_release' ? 'FT PR'
              : lastFtSourceType === 'market_news' ? 'FT Mkt.'
              : 'Full Text';

            return (
              <div className="relative flex" ref={ftMenuRef}>
                {/* Main button — repeats last used sourceType */}
                <button
                  onClick={() => handleFulltextUpdate(lastFtSourceType)}
                  disabled={updating || ftUpdating}
                  className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50"
                  title={lastFtSourceType === 'rtpr' ? 'Backfill RTPR full text from stored body' : `Extract full text (${getSourceTypeLabel(lastFtSourceType)})`}
                >
                  <FileText className={`w-3.5 h-3.5 text-orange-500 ${ftUpdating ? 'animate-pulse' : ''}`} />
                  <span>{ftLabel}</span>
                </button>
                {/* Dropdown arrow */}
                <button
                  onClick={() => setShowFtMenu(!showFtMenu)}
                  disabled={updating || ftUpdating}
                  className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  title="Choose source type for full text extraction"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                {/* Dropdown menu */}
                {showFtMenu && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
                    <div className="p-1.5">
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('all'); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                        <div><div className="font-medium">Full Text (All)</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Company + Press + Market News</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('company_news'); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <div><div className="font-medium">Company News Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for company_news items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('press_release'); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-green-500" />
                        <div><div className="font-medium">Press Release Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for press_release items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('market_news'); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <div><div className="font-medium">Market News Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Attempt extraction for market_news items</div></div>
                      </button>
                      <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('rtpr'); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <div><div className="font-medium">RTPR Body Backfill</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">저장된 RTPR body로 누락 full text 채우기</div></div>
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button onClick={async () => { setShowFtMenu(false); await handleResetAndRetry(); }} disabled={updating || ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50 text-red-600 dark:text-red-400">
                        <RotateCw className="w-3.5 h-3.5 shrink-0" />
                        <div><div className="font-medium">Reset Failed & Retry</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">이전 실패 행 삭제 후 body fallback으로 재시도</div></div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Refresh button */}
          <button onClick={() => triggerSearch()} disabled={loading} className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Refresh from DB">
            <RotateCw className={`w-3.5 h-3.5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowControlWindow(true)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            title="Control window"
          >
            <Settings2 className="w-3.5 h-3.5" /><span className="text-xs">Control</span>
          </button>

          {/* Save */}
          <button onClick={() => setShowSaveModal(true)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Save search settings">
            <Save className="w-3.5 h-3.5" /><span className="text-xs">Save</span>
          </button>

          {/* Load */}
          <div className="relative" ref={loadMenuRef}>
            <button onClick={() => { setShowLoadMenu(!showLoadMenu); setShowFilterMenu(false); setShowWatchlistMenu(false); setShowDisplayModeMenu(false); }} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Load search settings">
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

        {/* Row 2: Display Mode | Watch Lists */}
        <div className="flex items-center gap-2">
          {/* Display Mode Toggle */}
          <div className="relative" ref={displayModeMenuRef}>
            <button
              onClick={() => { setShowDisplayModeMenu(!showDisplayModeMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowWatchlistMenu(false); }}
              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
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

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span>{newsData.length} items{nextCursor ? '+' : ''}</span>
            {loading && <span className="text-blue-500">Loading...</span>}
            {loadingMore && <span className="text-blue-500">Loading more...</span>}
          </div>

          {/* Error message */}
          {error && (
            <span className="text-[10px] text-red-500 truncate max-w-[200px]" title={error}>{error}</span>
          )}

          {/* Column visibility toggle */}
          <div className="relative ml-auto" ref={columnMenuRef}>
            <button
              onClick={() => { setShowColumnMenu(!showColumnMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowDisplayModeMenu(false); setShowWatchlistMenu(false); }}
              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
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
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.id)}
                        onChange={() => toggleColumnVisibility(col.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Watch Lists */}
          <div className="relative" ref={watchlistMenuRef}>
            <button onClick={() => { setShowWatchlistMenu(!showWatchlistMenu); setShowFilterMenu(false); setShowLoadMenu(false); setShowDisplayModeMenu(false); }}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5">
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
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onClick={() => handleSortClick(col.id)}
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
      {showLogPanel && jobStatus && (
        <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 z-40 flex flex-col shadow-lg">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Update Log</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                jobStatus.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                jobStatus.status === 'done' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                jobStatus.status === 'cancelled' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
              }`}>
                {jobStatus.status === 'running' ? 'Running' : jobStatus.status === 'done' ? 'Done' : jobStatus.status === 'cancelled' ? 'Cancelled' : 'Failed'}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {jobStatus.progress.completed}/{jobStatus.progress.total} ({jobStatus.progress.pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1">
              {jobStatus.status === 'running' && currentJobId && (
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/api/jobs/${currentJobId}/cancel`, { method: 'POST' });
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
                jobStatus.status === 'failed' ? 'bg-red-500' : jobStatus.status === 'done' ? 'bg-green-500' : jobStatus.status === 'cancelled' ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${jobStatus.progress.pct}%` }}
            />
          </div>
          {/* Log lines */}
          <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900">
            {jobStatus.logs.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap py-0.5 ${line.includes('⚠') ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {line}
              </div>
            ))}
            {jobStatus.error && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
                Error: {jobStatus.error}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
          {/* Result summary when done */}
          {jobStatus.status === 'done' && jobStatus.result && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 shrink-0">
              {(jobStatus.result as Record<string, unknown>).success !== undefined
                ? `✓ Full Text — ${(jobStatus.result as Record<string, unknown>).success ?? 0} extracted, ${(jobStatus.result as Record<string, unknown>).skipped ?? 0} skipped, ${(jobStatus.result as Record<string, unknown>).failed ?? 0} failed`
                : `✓ Completed — ${(jobStatus.result as Record<string, unknown>).inserted ?? 0} inserted, ${(jobStatus.result as Record<string, unknown>).skipped ?? 0} skipped, ${(jobStatus.result as Record<string, unknown>).changeMerged ?? 0} change% merged`
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
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-rose-500" />Custom Calendar Update — Date Range</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={calendarCustomFrom} onChange={(e) => setCalendarCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={calendarCustomTo} onChange={(e) => setCalendarCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <p className="text-[10px] text-gray-400">IBKR WSH bulk filter로 전체 default 유니버스를 한번에 조회합니다.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCalendarCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => { if (!calendarCustomFrom || !calendarCustomTo) return; setShowCalendarCustomDateModal(false); handleCalendarUpdateCustom(calendarCustomFrom, calendarCustomTo); }}
                disabled={!calendarCustomFrom || !calendarCustomTo}
                className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50"
              >Start Update</button>
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
                onClick={() => { if (!customFrom || !customTo) return; setShowCustomDateModal(false); handleUpdate('custom', pendingUpdateSourceType, customFrom, customTo); }}
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
                  handlePtprUpdate('custom', ptprCustomFrom, ptprCustomTo);
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
              <p className="text-[10px] text-gray-400">Recalculate all change % for news published within selected date range.</p>
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
