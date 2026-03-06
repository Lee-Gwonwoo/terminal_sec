import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Save, FolderOpen, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw, Download, Columns3, Eye, X, Calendar } from 'lucide-react';
import { VariableSizeList as List } from 'react-window';

const API_BASE = "";

// ─── Heights ───
const STICKY_DATE_HEADER_HEIGHT = 32;
const ROW_HEIGHT_TITLE_ONLY = 88;
const ROW_HEIGHT_WITH_ABSTRACT = 140;

// ─── Display mode ───
type DisplayMode = 'title-only' | 'title-abstract';

// ─── Column definition ───
type ColumnId = 'date' | 'ticker' | 'time' | 'title' | 'publisher' | 'source' | 'changes' | 'fulltext' | 'keywords';

interface ColumnDef {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  flex?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'date',    label: 'Date',      defaultWidth: 72,  minWidth: 50 },
  { id: 'ticker',  label: 'Ticker',    defaultWidth: 72,  minWidth: 48 },
  { id: 'time',    label: 'Time',      defaultWidth: 52,  minWidth: 40 },
  { id: 'title',   label: 'Title',     defaultWidth: 300, minWidth: 100, flex: true },
  { id: 'publisher', label: 'Publisher', defaultWidth: 96, minWidth: 60 },
  { id: 'source',  label: 'Sources',   defaultWidth: 90,  minWidth: 50 },
  { id: 'fulltext', label: 'Full Text', defaultWidth: 60,  minWidth: 40 },
  { id: 'changes', label: 'Changes %', defaultWidth: 280, minWidth: 160 },
];

const DEFAULT_VISIBLE: Set<ColumnId> = new Set(DEFAULT_COLUMNS.filter(c => c.id !== 'source').map(c => c.id));

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

// ─── Backend news item ───
interface BackendNewsItem {
  id: string;
  published_at: string;
  source: string;
  publisher?: string | null;
  source_type: string;
  title: string;
  body: string;
  url: string;
  tickers: string[];
  tags: string[];
  created_at: string;
  ohlc_ticker?: string | null;
  ohlc_date?: string | null;
  change_1d_pct?: number | null;
  change_from_open_pct?: number | null;
  change_7d_pct?: number | null;
  change_14d_pct?: number | null;
  change_30d_pct?: number | null;
  change_computed_at?: string | null;
  hasFullText?: boolean;
  keywords?: string[];
  keywordsStatus?: string | null;
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
  source: string;
  sourceType: string;
  url: string;
  change1dPct: number | null;
  changeFromOpenPct: number | null;
  change7dPct: number | null;
  change14dPct: number | null;
  change30dPct: number | null;
  hasFullText: boolean;
  keywords: string[];
  keywordsStatus: string | null;
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
    source: item.source,
    sourceType: item.source_type,
    url: item.url,
    change1dPct: item.change_1d_pct ?? null,
    changeFromOpenPct: item.change_from_open_pct ?? null,
    change7dPct: item.change_7d_pct ?? null,
    change14dPct: item.change_14d_pct ?? null,
    change30dPct: item.change_30d_pct ?? null,
    hasFullText: !!item.hasFullText,
    keywords: item.keywords ?? [],
    keywordsStatus: item.keywordsStatus ?? null,
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
}

export function FinnhubNewsWindow({ onTickerClick, initialTicker }: FinnhubNewsWindowProps) {
  const [searchQuery, setSearchQuery] = useState(initialTicker || '');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [showDisplayModeMenu, setShowDisplayModeMenu] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState('All');
  const [listHeight, setListHeight] = useState(500);
  const [saveName, setSaveName] = useState('');

  // Source cell context menu (Copy URL)
  const [sourceCtxMenu, setSourceCtxMenu] = useState<null | { x: number; y: number; url: string }>(null);
  const sourceCtxMenuRef = useRef<HTMLDivElement>(null);

  // Full text popup
  const [showFulltextModal, setShowFulltextModal] = useState(false);
  const [fulltextData, setFulltextData] = useState<{ title: string; text: string; wordCount: number; status: string } | null>(null);
  const [fulltextLoading, setFulltextLoading] = useState(false);

  // Full text extraction job
  const [ftUpdating, setFtUpdating] = useState(false);

  // Display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('title-only');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering + visibility
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(DEFAULT_VISIBLE);
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
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');

  // Backend data
  const [newsData, setNewsData] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightData, setPreflightData] = useState<{ totalTickers: number; fallbackCount: number; fallbackTickers: string[] } | null>(null);
  const [pendingUpdateSourceType, setPendingUpdateSourceType] = useState<UpdateSourceType>('all');

  // ─── Background job tracking ───
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [jobStatus, setJobStatus] = useState<{
    status: 'running' | 'done' | 'failed';
    progress: { completed: number; total: number; pct: number };
    logs: string[];
    error?: string;
    result?: Record<string, unknown>;
  } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

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

  // ─── Saved searches (local state) ───
  interface SavedSearch {
    id: string;
    name: string;
    searchQuery: string;
    sourceTypeFilter: SourceTypeFilter;
  }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  // ─── Fetch news from backend (server-side search via keyword param) ───
  const fetchNews = useCallback(async (keyword?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('source_names', 'FINNHUB');
      if (sourceTypeFilter !== 'all') {
        params.set('source_type', sourceTypeFilter);
      }
      if (keyword) {
        params.set('keyword', keyword);
      }
      params.set('limit', '200');

      const res = await fetch(`${API_BASE}/api/news?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const items: BackendNewsItem[] = data.items ?? [];
      setNewsData(items.map(mapBackendItem));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, [sourceTypeFilter]);

  // Initial load + refresh on filter change
  useEffect(() => {
    fetchNews(searchQuery || undefined);
  }, [fetchNews]);

  // ─── Debounced server-side search (300ms) ───
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNews(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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
      const body: Record<string, unknown> = { mode, sourceType };
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
  type FtSourceType = 'all' | 'company_news' | 'press_release' | 'market_news';
  const [lastFtSourceType, setLastFtSourceType] = useState<FtSourceType>('all');

  const handleFulltextUpdate = async (sourceType: FtSourceType = 'all') => {
    if (updating || ftUpdating) return;
    setLastFtSourceType(sourceType);
    setFtUpdating(true);
    setError(null);
    setJobStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/fulltext/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType }),
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
      case 'source': return item.source.toLowerCase();
      case 'fulltext': return item.hasFullText ? 1 : 0;
      case 'changes': return item.changeFromOpenPct ?? 0;
      case 'keywords': return item.keywords.length;
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

    const result: Array<{ type: 'header'; date: string } | { type: 'item'; item: DisplayItem }> = [];
    groups.forEach((items, date) => {
      result.push({ type: 'header', date });
      items.forEach(item => result.push({ type: 'item', item }));
    });
    return result;
  }, [newsData, sort, getSortValue]);

  // Reset list on data/mode/expand changes
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [groupedNews, displayMode, expandedItems]);

  const getItemSize = useCallback((index: number) => {
    const item = groupedNews[index];
    if (item.type === 'header') return STICKY_DATE_HEADER_HEIGHT;
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
    const renderLinkCell = (label: string | null | undefined, fallbackClassName: string) => (
      <span
        className={`truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${fallbackClassName}`}
        title={newsItem.url ? 'Click to open link. Right click to copy URL.' : (label ?? '-')}
        onClick={(e) => {
          e.stopPropagation();
          if (newsItem.url) openExternalUrl(newsItem.url);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!newsItem.url) return;
          setSourceCtxMenu({ x: e.clientX, y: e.clientY, url: newsItem.url });
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
            onClick={(e) => { e.stopPropagation(); setSearchQuery(newsItem.ticker); onTickerClick?.(newsItem.ticker); }}
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
              <span className={`truncate text-gray-900 dark:text-gray-100 ${displayMode === 'title-only' ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}>
                {newsItem.title}
              </span>
            </div>
            {isExpanded && newsItem.body && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 whitespace-normal break-words">
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
      case 'publisher':
        return renderLinkCell(newsItem.publisher, 'text-gray-600 dark:text-gray-400');
      case 'source':
        return renderLinkCell(newsItem.source, 'text-gray-600 dark:text-gray-400');
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
              <span className="text-gray-500 w-[30px] shrink-0">Chg:</span>
              <span className={changeColor(newsItem.change1dPct)}>{formatChange(newsItem.change1dPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">fr.Open:</span>
              <span className={changeColor(newsItem.changeFromOpenPct)}>{formatChange(newsItem.changeFromOpenPct)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+7D:</span>
              <span className={changeColor(newsItem.change7dPct)}>{formatChange(newsItem.change7dPct)}</span>
            </div>
            <div className="flex items-center gap-1">
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
          <div className="flex flex-wrap gap-0.5 overflow-hidden">
            {newsItem.keywords.slice(0, 3).map((kw, i) => (
              <span key={i} className="inline-block px-1 py-0 text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded truncate max-w-[80px]" title={kw}>
                {kw}
              </span>
            ))}
            {newsItem.keywords.length > 3 && (
              <span className="text-[9px] text-gray-400">+{newsItem.keywords.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">-</span>
        );
    }
  }, [displayMode, toggleExpand, onTickerClick, openExternalUrl, setSearchQuery, fetchFulltext]);

  // ─── Row renderer ───
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = groupedNews[index];
    if (item.type === 'header') {
      return (
        <div style={style} className="sticky top-0 z-10 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{item.date}</span>
        </div>
      );
    }

    const newsItem = item.item;
    const isExpanded = displayMode === 'title-abstract' || expandedItems.has(newsItem.id);

    return (
      <div style={style} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors">
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
  }, [groupedNews, activeColumns, activeColWidths, displayMode, expandedItems, renderCell]);

  const displayModeLabel = displayMode === 'title-only' ? 'Title Only' : 'Title + Abstract';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-sm">
      {/* Row 1: Search bar | Source type filter | Update | Refresh | Save | Load | Filter */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search news..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
                      <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Update</div>
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
                  title={`Extract full text (${getSourceTypeLabel(lastFtSourceType)})`}
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
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Refresh button */}
          <button onClick={() => fetchNews(searchQuery || undefined)} disabled={loading} className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Refresh from DB">
            <RotateCw className={`w-3.5 h-3.5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
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
            <span>{newsData.length} items</span>
            {loading && <span className="text-blue-500">Loading...</span>}
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
      <div className="flex-1 overflow-hidden" ref={listContainerRef}>
        {newsData.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            No news items. Click "Update" to pull from Finnhub.
          </div>
        ) : (
          <List ref={listRef} height={listHeight} itemCount={groupedNews.length} itemSize={getItemSize} width="100%" className="scrollbar-thin">
            {Row}
          </List>
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
                'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
              }`}>
                {jobStatus.status === 'running' ? 'Running' : jobStatus.status === 'done' ? 'Done' : 'Failed'}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {jobStatus.progress.completed}/{jobStatus.progress.total} ({jobStatus.progress.pct}%)
              </span>
            </div>
            <button onClick={() => setShowLogPanel(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="Close (Esc)">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 shrink-0">
            <div
              className={`h-full transition-all duration-300 ${
                jobStatus.status === 'failed' ? 'bg-red-500' : jobStatus.status === 'done' ? 'bg-green-500' : 'bg-blue-500'
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
