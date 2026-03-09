import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Save, FolderOpen, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw } from 'lucide-react';
import { BraveNewsItem, BraveNewsFilter } from '../types';
import { VariableSizeList as List } from 'react-window';

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

interface BraveNewsWindowProps {
  onTickerClick?: (ticker: string) => void;
  initialTicker?: string;
}

interface SavedBraveSearch {
  id: string;
  name: string;
  searchQuery: string;
  filters: BraveNewsFilter;
}

const MARKET_CAP_PRESETS = [
  { label: 'Mega (200B+)',     min: 200,  max: null },
  { label: 'Large (10‑200B)',  min: 10,   max: 200 },
  { label: 'Mid (2‑10B)',      min: 2,    max: 10 },
  { label: 'Small (300M‑2B)',  min: 0.3,  max: 2 },
  { label: 'Micro (<300M)',    min: null,  max: 0.3 },
];

// ─── Mock abstracts ───
const MOCK_ABSTRACTS = [
  'The company reported quarterly earnings that significantly exceeded Wall Street expectations, driven by strong demand across all business segments and improved operational efficiency.',
  'A new flagship product was unveiled at the annual developer conference, featuring breakthrough AI capabilities and enhanced performance metrics that analysts predict will drive significant market share gains.',
  'In an exclusive interview, the CEO outlined a comprehensive five-year strategy focusing on artificial intelligence, cloud computing, and sustainable energy solutions to maintain competitive advantage.',
  'Leading market analysts have upgraded the stock rating from Hold to Buy, citing strong fundamentals, growing market share, and favorable macroeconomic conditions for the technology sector.',
  'Revenue and profit margins showed robust quarter-over-quarter growth, beating consensus estimates by a wide margin. Management raised full-year guidance on the back of strong pipeline visibility.',
  'A strategic partnership agreement has been signed with a major industry player, expected to generate significant synergies and open new market opportunities across multiple geographies.',
  'Continued investment in R&D has yielded multiple patent filings and product innovations that position the company at the forefront of its industry, according to a new industry report.',
];

// ─── Mock data ───
const generateMockData = (): BraveNewsItem[] => {
  const tickers = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA'];
  const sources = ['Bloomberg', 'Reuters', 'WSJ', 'CNBC', 'Financial Times'];
  const titles = [
    'Strong earnings beat expectations',
    'New product launch announcement',
    'CEO discusses future strategy',
    'Market analysts upgrade rating',
    'Quarterly results show growth',
    'Partnership deal announced',
    'Innovation drives market value',
  ];
  const items: BraveNewsItem[] = [];
  const today = new Date();

  for (let i = 0; i < 50; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(i / 5));
    const hour = 9 + Math.floor(Math.random() * 7);
    const minute = Math.floor(Math.random() * 60);
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    items.push({
      id: `brave-${i}`,
      publishedAt: date.toISOString(),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time,
      title: `${tickers[i % tickers.length]} ${titles[i % titles.length]}`,
      abstract: MOCK_ABSTRACTS[i % MOCK_ABSTRACTS.length],
      ticker: tickers[i % tickers.length],
      source: sources[i % sources.length],
      url: `https://example.com/news/${i}`,
      changePercent: Math.random() * 8 - 4,
      openChange: Math.random() * 5 - 2.5,
      sevenDaysChange: Math.random() * 15 - 7.5,
      fourteenDaysChange: Math.random() * 20 - 10,
      thirtyDaysChange: Math.random() * 25 - 12.5,
      nextEarningDate: Math.random() > 0.6 ? '2026-03-15' : undefined,
    });
  }
  return items;
};

const formatChange = (val: number | undefined) => {
  if (val === undefined) return '-';
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const changeColor = (val: number | undefined) => {
  if (val === undefined) return 'text-gray-400';
  return val > 0 ? 'text-green-600 dark:text-green-400' : val < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
};

// ═══════════════════════════════════════════���═
// Component
// ═════════════════════════════════════════════
export function BraveNewsWindow({ onTickerClick, initialTicker }: BraveNewsWindowProps) {
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
  // Expanded items (for title-only mode click-to-expand)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Column widths (px)
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMNS.map(c => c.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  // Sort
  const [sort, setSort] = useState<SortState>({ column: null, dir: null });

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const displayModeMenuRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<BraveNewsFilter>({
    dateFrom: null, dateTo: null, marketCapMin: null, marketCapMax: null, industry: [],
  });

  const [savedSearches, setSavedSearches] = useState<SavedBraveSearch[]>([
    { id: '1', name: 'Tech Large Cap', searchQuery: 'tech', filters: { dateFrom: null, dateTo: null, marketCapMin: 10, marketCapMax: null, industry: ['Technology'] } },
    { id: '2', name: 'Healthcare', searchQuery: 'health', filters: { dateFrom: null, dateTo: null, marketCapMin: null, marketCapMax: null, industry: ['Healthcare'] } },
  ]);

  const newsData = useMemo(() => generateMockData(), []);

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
  const getSortValue = useCallback((item: BraveNewsItem, col: ColumnId): string | number => {
    switch (col) {
      case 'date': return item.publishedAt;
      case 'time': return item.time;
      case 'title': return item.title.toLowerCase();
      case 'source': return item.source.toLowerCase();
      case 'changes': return item.openChange ?? 0;
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

    const groups = new Map<string, BraveNewsItem[]>();
    filtered.forEach(item => {
      if (!groups.has(item.date)) groups.set(item.date, []);
      groups.get(item.date)!.push(item);
    });

    const result: Array<{ type: 'header'; date: string } | { type: 'item'; item: BraveNewsItem }> = [];
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
    if (displayMode !== 'title-only') return; // no toggle in title+abstract mode
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [displayMode]);

  const toggleIndustry = (value: string) => {
    setFilters(prev => ({
      ...prev,
      industry: prev.industry.includes(value) ? prev.industry.filter(v => v !== value) : [...prev.industry, value],
    }));
  };

  // ─── Save / Load ───
  const handleSaveSearch = () => {
    if (!saveName.trim()) return;
    setSavedSearches(prev => [...prev, { id: Date.now().toString(), name: saveName, searchQuery, filters: { ...filters } }]);
    setSaveName('');
    setShowSaveModal(false);
  };
  const handleLoadSearch = (search: SavedBraveSearch) => {
    setSearchQuery(search.searchQuery);
    setFilters(search.filters);
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
  const renderCell = useCallback((colId: ColumnId, newsItem: BraveNewsItem, isExpanded: boolean) => {
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
            <span
              className={`truncate text-gray-900 dark:text-gray-100 ${displayMode === 'title-only' ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
            >
              {newsItem.title}
            </span>
            {isExpanded && newsItem.abstract && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 whitespace-normal break-words">
                {newsItem.abstract}
              </p>
            )}
          </div>
        );
      case 'source':
        return <span className="truncate text-gray-600 dark:text-gray-400">{newsItem.source}</span>;
      case 'changes':
        return (
          <div className="flex flex-col justify-center gap-0 w-full">
            <div className="flex items-center gap-1">
              <span className="text-gray-500 shrink-0">fr.O→C:</span>
              <span className={changeColor(newsItem.openChange)}>{formatChange(newsItem.openChange)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+1D:</span>
              <span className={changeColor(newsItem.changePercent)}>{formatChange(newsItem.changePercent)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+3D:</span>
              <span className="text-gray-300 dark:text-gray-600">-</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+7D:</span>
              <span className={changeColor(newsItem.sevenDaysChange)}>{formatChange(newsItem.sevenDaysChange)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 shrink-0">+14D:</span>
              <span className={changeColor(newsItem.fourteenDaysChange)}>{formatChange(newsItem.fourteenDaysChange)}</span>
              <span className="text-gray-400 mx-0.5">|</span>
              <span className="text-gray-500 shrink-0">+30D:</span>
              <span className={changeColor(newsItem.thirtyDaysChange)}>{formatChange(newsItem.thirtyDaysChange)}</span>
            </div>
            {newsItem.nextEarningDate && (
              <div className="text-blue-600 dark:text-blue-400 mt-0.5">Earning: {newsItem.nextEarningDate}</div>
            )}
          </div>
        );
    }
  }, [displayMode, toggleExpand]);

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

  // ─── Filter active indicator ───
  const hasActiveFilters = filters.marketCapMin !== null || filters.marketCapMax !== null || filters.industry.length > 0;

  const displayModeLabel = displayMode === 'title-only' ? 'Title Only' : 'Title + Abstract';

  // ─── Refresh handler ───
  const handleRefresh = () => {
    // TODO: Call API to refresh news data
    console.log('Refreshing news data...');
  };

  // ─── Update handler ───
  const handleUpdate = () => {
    // TODO: Call API to update news
    console.log('Updating news...');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-sm">
      {/* Row 1: Search bar | Save | Load | Filter */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search news..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* Refresh button */}
          <button onClick={handleRefresh} className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Refresh">
            <RotateCw className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Update button */}
          <button onClick={handleUpdate} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Update news">
            <span className="text-xs">Update</span>
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

          {/* Filter */}
          <div className="relative" ref={filterMenuRef}>
            <button onClick={() => { setShowFilterMenu(!showFilterMenu); setShowLoadMenu(false); setShowWatchlistMenu(false); setShowDisplayModeMenu(false); }}
              className={`px-3 py-1.5 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 ${hasActiveFilters ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600'}`} title="Filter">
              <Filter className="w-3.5 h-3.5" /><span className="text-xs">Filter</span>
            </button>
            {showFilterMenu && (
              <div className="absolute top-full mt-1 right-0 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                <div className="p-3 space-y-3">
                  {/* Market Cap - Custom Range */}
                  <div>
                    <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">Market Cap (Billions $)</div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Min</label>
                        <input type="number" step="0.1" min="0" placeholder="0" value={filters.marketCapMin ?? ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, marketCapMin: e.target.value ? parseFloat(e.target.value) : null }))}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <span className="text-gray-400 mt-4">~</span>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Max</label>
                        <input type="number" step="0.1" min="0" placeholder="No limit" value={filters.marketCapMax ?? ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, marketCapMax: e.target.value ? parseFloat(e.target.value) : null }))}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {MARKET_CAP_PRESETS.map(p => {
                        const isActive = filters.marketCapMin === p.min && filters.marketCapMax === p.max;
                        return (
                          <button key={p.label} onClick={() => setFilters(prev => ({ ...prev, marketCapMin: p.min, marketCapMax: p.max }))}
                            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${isActive ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Industry Filter */}
                  <div>
                    <div className="text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Industry</div>
                    <div className="space-y-1">
                      {['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Industrial'].map(ind => (
                        <label key={ind} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={filters.industry.includes(ind)} onChange={() => toggleIndustry(ind)} className="rounded border-gray-300 dark:border-gray-600" />
                          <span>{ind}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setFilters({ dateFrom: null, dateTo: null, marketCapMin: null, marketCapMax: null, industry: [] })}
                    className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date range | Display Mode | Watch Lists */}
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Date:</span>
            <input type="date" className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value ? new Date(e.target.value) : null }))} />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value ? new Date(e.target.value) : null }))} />
          </div>

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
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Click title to show abstract</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setDisplayMode('title-abstract'); setExpandedItems(new Set()); setShowDisplayModeMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 ${displayMode === 'title-abstract' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : ''}`}
                  >
                    <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <div className="font-medium">Title + Abstract</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Always show abstract</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

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

      {/* ─── Table Header: Draggable + Sortable + Resizable ─── */}
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
              {/* Resize handle */}
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
        <List ref={listRef} height={listHeight} itemCount={groupedNews.length} itemSize={getItemSize} width="100%" className="scrollbar-thin">
          {Row}
        </List>
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