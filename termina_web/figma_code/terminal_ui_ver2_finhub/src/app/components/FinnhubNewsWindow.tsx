import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Save, FolderOpen, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw, Download } from 'lucide-react';
import { VariableSizeList as List } from 'react-window';

const API_BASE = "http://localhost:8080";

// ─── Heights ───
const STICKY_DATE_HEADER_HEIGHT = 32;
const ROW_HEIGHT_TITLE_ONLY = 88;
const ROW_HEIGHT_WITH_ABSTRACT = 140;

// ─── Display mode ───
type DisplayMode = 'title-only' | 'title-abstract';

// ─── Column definition ───
type ColumnId = 'date' | 'time' | 'title' | 'source' | 'changes';

interface ColumnDef {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  flex?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'date',    label: 'Date',      defaultWidth: 72,  minWidth: 50 },
  { id: 'time',    label: 'Time',      defaultWidth: 52,  minWidth: 40 },
  { id: 'title',   label: 'Title',     defaultWidth: 300, minWidth: 100, flex: true },
  { id: 'source',  label: 'Sources',   defaultWidth: 90,  minWidth: 50 },
  { id: 'changes', label: 'Changes %', defaultWidth: 280, minWidth: 160 },
];

// ─── Sort ───
type SortDir = 'asc' | 'desc' | null;
interface SortState { column: ColumnId | null; dir: SortDir; }

// ─── Source type filter ───
type SourceTypeFilter = 'all' | 'company_news' | 'press_release';

// ─── Backend news item ───
interface BackendNewsItem {
  id: string;
  published_at: string;
  source: string;
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
  source: string;
  sourceType: string;
  url: string;
  change1dPct: number | null;
  changeFromOpenPct: number | null;
  change7dPct: number | null;
  change14dPct: number | null;
  change30dPct: number | null;
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
    source: item.source,
    sourceType: item.source_type,
    url: item.url,
    change1dPct: item.change_1d_pct ?? null,
    changeFromOpenPct: item.change_from_open_pct ?? null,
    change7dPct: item.change_7d_pct ?? null,
    change14dPct: item.change_14d_pct ?? null,
    change30dPct: item.change_30d_pct ?? null,
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

  // Display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('title-only');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMNS.map(c => c.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  // Sort
  const [sort, setSort] = useState<SortState>({ column: null, dir: null });

  // Source type filter
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');

  // Backend data
  const [newsData, setNewsData] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const displayModeMenuRef = useRef<HTMLDivElement>(null);

  // ─── Saved searches (local state) ───
  interface SavedSearch {
    id: string;
    name: string;
    searchQuery: string;
    sourceTypeFilter: SourceTypeFilter;
  }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  // ─── Fetch news from backend ───
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('source_names', 'FINNHUB');
      if (sourceTypeFilter !== 'all') {
        params.set('source_type', sourceTypeFilter);
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
    fetchNews();
  }, [fetchNews]);

  // ─── Update (pull from Finnhub) ───
  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/pull-finhub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTickers: 20 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      // Reload after pull
      await fetchNews();
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

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
    };
    if (showFilterMenu || showWatchlistMenu || showLoadMenu || showDisplayModeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterMenu, showWatchlistMenu, showLoadMenu, showDisplayModeMenu]);

  // ─── Sort helper ───
  const getSortValue = useCallback((item: DisplayItem, col: ColumnId): string | number => {
    switch (col) {
      case 'date': return item.publishedAt;
      case 'time': return item.time;
      case 'title': return item.title.toLowerCase();
      case 'source': return item.source.toLowerCase();
      case 'changes': return item.changeFromOpenPct ?? 0;
    }
  }, []);

  const handleSortClick = (colId: ColumnId) => {
    setSort(prev => {
      if (prev.column !== colId) return { column: colId, dir: 'asc' };
      if (prev.dir === 'asc') return { column: colId, dir: 'desc' };
      return { column: null, dir: null };
    });
  };

  // ─── Filter + Sort + Group ───
  const groupedNews = useMemo(() => {
    let filtered = newsData.filter(item => {
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())
        && !item.ticker.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

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
  }, [newsData, searchQuery, sort, getSortValue]);

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
    switch (colId) {
      case 'date':
        return <span className="text-gray-600 dark:text-gray-400">{newsItem.date.replace(/, \d{4}$/, '')}</span>;
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
                {newsItem.sourceType === 'company_news' ? 'Company News' : 'Press Release'}
              </span>
            )}
          </div>
        );
      case 'source':
        return <span className="truncate text-gray-600 dark:text-gray-400">{newsItem.source}</span>;
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
    }
  }, [displayMode, toggleExpand, onTickerClick]);

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
          {columns.map((col, colIdx) => {
            const isLast = colIdx === columns.length - 1;
            return (
              <div
                key={col.id}
                className={[
                  'shrink-0 px-2 flex overflow-hidden',
                  col.id === 'title' ? 'px-3 items-start pt-2' : 'items-center',
                  !isLast ? 'border-r border-gray-200 dark:border-gray-700' : '',
                  col.id === 'changes' ? 'py-1' : '',
                ].join(' ')}
                style={{ width: colWidths[colIdx], minWidth: col.minWidth }}
              >
                {renderCell(col.id, newsItem, isExpanded)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [groupedNews, columns, colWidths, displayMode, expandedItems, renderCell]);

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
            {(['all', 'company_news', 'press_release'] as SourceTypeFilter[]).map(st => (
              <button
                key={st}
                onClick={() => setSourceTypeFilter(st)}
                className={`px-2 py-1.5 text-[10px] whitespace-nowrap transition-colors ${
                  sourceTypeFilter === st
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {st === 'all' ? 'All' : st === 'company_news' ? 'Company News' : 'Press Release'}
              </button>
            ))}
          </div>

          {/* Update button */}
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Pull latest news from Finnhub"
          >
            <Download className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
            <span className="text-xs">{updating ? 'Pulling...' : 'Update'}</span>
          </button>

          {/* Refresh button */}
          <button onClick={fetchNews} disabled={loading} className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Refresh from DB">
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

          {/* Watch Lists */}
          <div className="relative ml-auto" ref={watchlistMenuRef}>
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
        {columns.map((col, idx) => {
          const isLast = idx === columns.length - 1;
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
              style={{ width: colWidths[idx], minWidth: col.minWidth }}
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
    </div>
  );
}
