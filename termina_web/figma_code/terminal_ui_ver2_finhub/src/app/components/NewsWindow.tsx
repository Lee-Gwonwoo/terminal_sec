import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search, Save, ChevronDown, Filter, X } from 'lucide-react';
import { NewsItem, NewsFilter, SavedSearch } from '../types';
import { filterNewsByQuery, groupNewsByDate } from '../mockData';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { VariableSizeList as List } from 'react-window';

const STICKY_DATE_HEADER_HEIGHT = 36;

// ─── Column definitions for News Feed ───
interface NewsColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align?: 'left' | 'right';
}

const NEWS_COLUMNS: NewsColumnDef[] = [
  { id: 'time',   label: 'Time',       defaultWidth: 80,  minWidth: 50,  align: 'left' },
  { id: 'ticker', label: 'Ticker',     defaultWidth: 100, minWidth: 60,  align: 'left' },
  { id: 'title',  label: 'News Title', defaultWidth: 300, minWidth: 100, align: 'left' },
  { id: 'source', label: 'Source',     defaultWidth: 140, minWidth: 60,  align: 'left' },
];

interface NewsWindowProps {
  onTickerClick?: (ticker: string) => void;
  initialTicker?: string;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function formatYmdLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoRange(fromDate: Date | null, toDate: Date | null): { from?: string; to?: string } {
  const fromYmd = fromDate ? formatYmdLocal(fromDate) : undefined;
  const toYmd = toDate ? formatYmdLocal(toDate) : undefined;
  const from = fromYmd ? `${fromYmd}T00:00:00.000Z` : undefined;
  const to = toYmd ? `${toYmd}T23:59:59.999Z` : undefined;
  return { from, to };
}

export function NewsWindow({ onTickerClick, initialTicker }: NewsWindowProps) {
  const [searchQuery, setSearchQuery] = useState(initialTicker || '');
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [newsPages, setNewsPages] = useState<NewsItem[][]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullOffset, setPullOffset] = useState<number>(0);
  const [pullDone, setPullDone] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string>('');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);

  // ─── Column widths (px) ───
  const [newsColWidths, setNewsColWidths] = useState<number[]>(NEWS_COLUMNS.map(c => c.defaultWidth));
  const newsResizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<List>(null);
  const [listHeight, setListHeight] = useState<number>(300);
  const loadMoreInFlightRef = useRef(false);
  const [stickyDate, setStickyDate] = useState<string>('');
  
  const [filters, setFilters] = useState<NewsFilter>({
    dateFrom: null,
    dateTo: null,
    marketCap: [],
    source: [],
    sector: []
  });

  useEffect(() => {
    let cancelled = false;

    const pullToday = async () => {
      // Lightweight refresh on startup: pull today's EODHD news into SQLite.
      // UI always renders from SQLite via GET /api/news.
      setIsPulling(true);
      try {
        const today = formatYmdLocal(new Date());
        await fetch('/api/news/pull-eodhd', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date: today, symbol: '', limit: 200, offset: 0, fetch_all: false })
        });
      } catch (e) {
        console.warn('EODHD pull failed (check token/network).', e);
      } finally {
        if (!cancelled) {
          setIsPulling(false);
        }
      }
    };

    void pullToday();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listContainerRef.current) {
      return;
    }
    const el = listContainerRef.current;
    const update = () => setListHeight(Math.max(120, el.clientHeight));
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initialTicker) {
      setSearchQuery(initialTicker);
    }
  }, [initialTicker]);

  const remoteNews = useMemo(() => newsPages.flat(), [newsPages]);

  const mapBackendItem = useMemo(() => {
    return (item: any): NewsItem | null => {
      const publishedAt = typeof item?.published_at === 'string' ? item.published_at : null;
      if (!publishedAt) {
        return null;
      }
      const dt = new Date(publishedAt);
      const date = publishedAt.slice(0, 10);
      const time = Number.isNaN(dt.getTime())
        ? ''
        : dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      return {
        id: typeof item?.id === 'string' ? item.id : `${publishedAt}-${Math.random()}`,
        publishedAt,
        time,
        ticker: Array.isArray(item?.tickers) ? item.tickers : [],
        title: typeof item?.title === 'string' ? item.title : '',
        source: typeof item?.source === 'string' ? item.source : 'EODHD',
        url: typeof item?.url === 'string' ? item.url : undefined,
        date,
        content: typeof item?.body === 'string' ? item.body : undefined
      };
    };
  }, []);

  const isRangeSelected = Boolean(filters.dateFrom && filters.dateTo);

  const toYmdRange = useMemo(() => {
    const fromYmd = filters.dateFrom ? formatYmdLocal(filters.dateFrom) : undefined;
    const toYmd = filters.dateTo ? formatYmdLocal(filters.dateTo) : undefined;
    return { fromYmd, toYmd };
  }, [filters.dateFrom, filters.dateTo]);

  const buildCursorFromItem = (item?: NewsItem): string | undefined => {
    if (!item?.publishedAt || !item?.id) {
      return undefined;
    }
    try {
      return window.btoa(`${item.publishedAt}|${item.id}`);
    } catch {
      return undefined;
    }
  };

  const pullNextEodhdChunk = async (): Promise<{ inserted: number; fetched: number; done: boolean }> => {
    if (!isRangeSelected || !toYmdRange.fromYmd || !toYmdRange.toYmd || pullDone) {
      return { inserted: 0, fetched: 0, done: pullDone };
    }
    if (isPulling) {
      return { inserted: 0, fetched: 0, done: pullDone };
    }

    setIsPulling(true);
    try {
      const response = await fetch('/api/news/pull-eodhd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from: toYmdRange.fromYmd, to: toYmdRange.toYmd, symbol: '', limit: 200, offset: pullOffset, fetch_all: false })
      });
      const json = await response.json().catch(() => ({}));

      const fetched = typeof json?.fetched === 'number' ? json.fetched : 0;
      const inserted = typeof json?.inserted === 'number' ? json.inserted : 0;
      const done = typeof json?.done === 'boolean' ? json.done : fetched < 200;
      const nextOffset = typeof json?.nextOffset === 'number' ? json.nextOffset : pullOffset + Math.max(fetched, 0);

      setPullDone(done);
      if (!done && Number.isFinite(nextOffset) && nextOffset > pullOffset) {
        setPullOffset(nextOffset);
      }
      return { inserted, fetched, done };
    } catch (e) {
      console.warn('EODHD range pull chunk failed.', e);
      return { inserted: 0, fetched: 0, done: false };
    } finally {
      setIsPulling(false);
    }
  };

  const rangeKey = useMemo(() => {
    const from = filters.dateFrom ? formatYmdLocal(filters.dateFrom) : '';
    const to = filters.dateTo ? formatYmdLocal(filters.dateTo) : '';
    return `${from}|${to}`;
  }, [filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    // Reset progressive pull state whenever the date range changes.
    setPullOffset(0);
    setPullDone(false);
  }, [rangeKey]);

  useEffect(() => {
    let cancelled = false;

    const loadFirstPage = async () => {
      setIsLoading(true);
      setLoadError(null);
      setExpandedNewsId(null);
      setNewsPages([]);
      setNextCursor(undefined);

      try {
        // If a date range is selected, pull the first upstream chunk in the background
        // so the DB starts filling that range without blocking initial render.
        void pullNextEodhdChunk();

        const { from, to } = toIsoRange(filters.dateFrom, filters.dateTo);
        const url = new URL('/api/news', window.location.origin);
        if (from) url.searchParams.set('from', from);
        if (to) url.searchParams.set('to', to);
        url.searchParams.set('source_names', 'EODHD');
        url.searchParams.set('limit', '200');

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`GET /api/news failed: ${response.status}`);
        }
        const json = await response.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped = items.map(mapBackendItem).filter(Boolean) as NewsItem[];
        const cursor = typeof json?.nextCursor === 'string' && json.nextCursor.trim() !== '' ? json.nextCursor : undefined;

        if (!cancelled) {
          setNewsPages(mapped.length > 0 ? [mapped] : []);
          setNextCursor(cursor);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message ? String(e.message) : 'Failed to load news');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [rangeKey, mapBackendItem]);

  const filteredNews = useMemo(() => {
    let result = filterNewsByQuery(remoteNews, debouncedQuery);

    const fromYmd = filters.dateFrom ? formatYmdLocal(filters.dateFrom) : undefined;
    const toYmd = filters.dateTo ? formatYmdLocal(filters.dateTo) : undefined;
    if (fromYmd) {
      result = result.filter((item) => item.date >= fromYmd);
    }
    if (toYmd) {
      result = result.filter((item) => item.date <= toYmd);
    }

    if (filters.source.length > 0) {
      result = result.filter((item) => filters.source.includes(item.source));
    }

    return result;
  }, [remoteNews, debouncedQuery, filters.dateFrom, filters.dateTo, filters.source]);

  const groupedNews = useMemo(() => groupNewsByDate(filteredNews), [filteredNews]);
  const sortedDates = useMemo(() => {
    return Array.from(groupedNews.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedNews]);

  type NewsRow = { kind: 'date'; date: string } | { kind: 'item'; item: NewsItem };
  const rows: NewsRow[] = useMemo(() => {
    const out: NewsRow[] = [];
    for (const date of sortedDates) {
      out.push({ kind: 'date', date });
      const items = groupedNews.get(date) ?? [];
      for (const item of items) {
        out.push({ kind: 'item', item });
      }
    }
    return out;
  }, [sortedDates, groupedNews]);

  const findStickyDateForIndex = (index: number): string => {
    for (let i = Math.min(index, rows.length - 1); i >= 0; i--) {
      const row = rows[i];
      if (row && row.kind === 'date') {
        return row.date;
      }
    }
    return rows.length > 0 && rows[0].kind === 'date' ? rows[0].date : '';
  };

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [expandedNewsId, rows.length]);

  useEffect(() => {
    // Initialize sticky header date on first render / dataset changes.
    setStickyDate(findStickyDateForIndex(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const loadMore = async () => {
    if (isLoadingMore || loadMoreInFlightRef.current) {
      return;
    }

    const lastItem = remoteNews.length > 0 ? remoteNews[remoteNews.length - 1] : undefined;
    const cursorToUse = nextCursor ?? buildCursorFromItem(lastItem);
    if (!cursorToUse) {
      // If we have a selected range and haven't finished pulling upstream yet, try to pull more.
      if (isRangeSelected && !pullDone) {
        await pullNextEodhdChunk();
      }
      return;
    }

    loadMoreInFlightRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);

    const fetchPage = async (cursor: string) => {
      const { from, to } = toIsoRange(filters.dateFrom, filters.dateTo);
      const url = new URL('/api/news', window.location.origin);
      if (from) url.searchParams.set('from', from);
      if (to) url.searchParams.set('to', to);
      url.searchParams.set('source_names', 'EODHD');
      url.searchParams.set('limit', '200');
      url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`GET /api/news failed: ${response.status}`);
      }
      const json = await response.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      const mapped = items.map(mapBackendItem).filter(Boolean) as NewsItem[];
      const next = typeof json?.nextCursor === 'string' && json.nextCursor.trim() !== '' ? json.nextCursor : undefined;
      return { mapped, next };
    };

    try {
      // Prefetch one upstream chunk when a date range is selected.
      if (isRangeSelected && !pullDone) {
        void pullNextEodhdChunk();
      }

      let { mapped, next } = await fetchPage(cursorToUse);

      // If DB is exhausted but we're still pulling the upstream range, pull one chunk and retry once.
      if (mapped.length === 0 && isRangeSelected && !pullDone) {
        await pullNextEodhdChunk();
        const retry = await fetchPage(cursorToUse);
        mapped = retry.mapped;
        next = retry.next;
      }

      setNewsPages((prev) => (mapped.length > 0 ? [...prev, mapped] : prev));
      setNextCursor(next);
    } catch (e: any) {
      setLoadError(e?.message ? String(e.message) : 'Failed to load more news');
    } finally {
      setIsLoadingMore(false);
      loadMoreInFlightRef.current = false;
    }
  };

  const handleSaveSearch = () => {
    if (saveName.trim()) {
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name: saveName,
        searchQuery,
        filters
      };
      setSavedSearches([...savedSearches, newSearch]);
      setSaveName('');
      setShowSaveDialog(false);
    }
  };

  const handleLoadSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (search) {
      setSearchQuery(search.searchQuery);
      setFilters(search.filters);
      setSelectedSavedSearch(searchId);
    }
  };

  const toggleFilter = (filterType: keyof NewsFilter, value: string) => {
    const currentValues = filters[filterType] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    setFilters({ ...filters, [filterType]: newValues });
  };

  const marketCapOptions = ['Large Cap', 'Mid Cap', 'Small Cap', 'Micro Cap'];
  const sourceOptions = ['EODHD'];
  const sectorOptions = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer'];

  // ─── Column resize handlers ───
  const onNewsColResizeStart = useCallback((colIdx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    newsResizingRef.current = { colIdx, startX: e.clientX, startWidth: newsColWidths[colIdx] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!newsResizingRef.current) return;
      const delta = ev.clientX - newsResizingRef.current.startX;
      const minW = NEWS_COLUMNS[newsResizingRef.current.colIdx]?.minWidth ?? 30;
      const newWidth = Math.max(minW, newsResizingRef.current.startWidth + delta);
      setNewsColWidths(prev => {
        const next = [...prev];
        next[newsResizingRef.current!.colIdx] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      newsResizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [newsColWidths]);

  // ─── Render news cell by column id ───
  const renderNewsCell = useCallback((colId: string, item: NewsItem) => {
    switch (colId) {
      case 'time':
        return <span className="text-sm text-gray-600 dark:text-gray-400">{item.time}</span>;
      case 'ticker':
        return (
          <div className="flex gap-1 flex-nowrap overflow-x-auto whitespace-nowrap">
            {item.ticker.map((ticker) => (
              <button
                key={ticker}
                onClick={() => onTickerClick?.(ticker)}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 shrink-0"
              >
                {ticker}
              </button>
            ))}
          </div>
        );
      case 'title':
        return (
          <button
            type="button"
            onClick={() => setExpandedNewsId((prev) => (prev === item.id ? null : item.id))}
            className="text-left hover:underline block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm"
            title="Click to expand/collapse body"
          >
            {item.title}
          </button>
        );
      case 'source':
        return (
          <div className="text-sm text-gray-600 dark:text-gray-400 min-w-0">
            <div>{item.source}</div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="block mt-1 text-xs underline truncate" title={item.url}>
                {item.url}
              </a>
            )}
          </div>
        );
      default:
        return null;
    }
  }, [onTickerClick]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g., TSLA AND earnings, AAPL OR MSFT)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>

        {/* Saved Searches Dropdown */}
        {savedSearches.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Saved:</span>
            <select
              value={selectedSavedSearch}
              onChange={(e) => handleLoadSearch(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select saved search...</option>
              {savedSearches.map(search => (
                <option key={search.id} value={search.id}>{search.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div>
              <label className="block text-sm mb-2">Date Range</label>
              <div className="flex gap-2 items-center">
                <DatePicker
                  selected={filters.dateFrom}
                  onChange={(date) => setFilters({ ...filters, dateFrom: date })}
                  placeholderText="From"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  dateFormat="yyyy-MM-dd"
                />
                <span className="text-sm">to</span>
                <DatePicker
                  selected={filters.dateTo}
                  onChange={(date) => setFilters({ ...filters, dateTo: date })}
                  placeholderText="To"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  dateFormat="yyyy-MM-dd"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Market Cap</label>
              <div className="flex flex-wrap gap-2">
                {marketCapOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleFilter('marketCap', option)}
                    className={`px-3 py-1 text-sm rounded ${
                      filters.marketCap.includes(option)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Source</label>
              <div className="flex flex-wrap gap-2">
                {sourceOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleFilter('source', option)}
                    className={`px-3 py-1 text-sm rounded ${
                      filters.source.includes(option)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg mb-4">Save Search Settings</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter a name for this search"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - Resizable columns */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm font-medium select-none">
        {NEWS_COLUMNS.map((col, idx) => {
          const isLast = idx === NEWS_COLUMNS.length - 1;
          return (
            <div
              key={col.id}
              className="relative shrink-0 flex items-center"
              style={{ width: newsColWidths[idx], minWidth: col.minWidth }}
            >
              <span className={`px-4 py-3 truncate w-full ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </span>
              <div
                onMouseDown={onNewsColResizeStart(idx)}
                className={`absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-20 hover:bg-blue-400/40 ${!isLast ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                style={{ touchAction: 'none' }}
              />
            </div>
          );
        })}
      </div>

      {/* News List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={listContainerRef} className="flex-1 overflow-hidden">
          {loadError && (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {loadError}
            </div>
          )}

          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              Loading...
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No news items found
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <div className="relative">
              {stickyDate && (
                <div
                  className="absolute top-0 left-0 right-0 z-10 bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium pointer-events-none"
                  style={{ height: STICKY_DATE_HEADER_HEIGHT }}
                >
                  {new Date(stickyDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              )}

              <List
                ref={listRef}
                height={listHeight}
                width="100%"
                itemCount={rows.length}
                itemSize={(index) => {
                  const row = rows[index];
                  if (row.kind === 'date') return 36;
                  return expandedNewsId === row.item.id ? 420 : 64;
                }}
                innerElementType={React.forwardRef<HTMLDivElement, any>(function Inner({ style, ...rest }, ref) {
                  const nextStyle = {
                    ...style,
                    height: (typeof style?.height === 'number' ? style.height : 0) + STICKY_DATE_HEADER_HEIGHT
                  };
                  return <div ref={ref} style={nextStyle} {...rest} />;
                })}
                overscanCount={8}
                onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
                  const nextSticky = findStickyDateForIndex(visibleStartIndex);
                  if (nextSticky && nextSticky !== stickyDate) {
                    setStickyDate(nextSticky);
                  }

                  // Infinite scroll: when user reaches the bottom, automatically load the next page.
                  if (visibleStopIndex >= rows.length - 8) {
                    void loadMore();
                  }
                }}
              >
              {({ index, style }) => {
                const row = rows[index];
                const shiftedStyle = {
                  ...style,
                  top: typeof (style as any)?.top === 'number' ? (style as any).top + STICKY_DATE_HEADER_HEIGHT : (style as any)?.top
                };
                if (row.kind === 'date') {
                  return (
                    <div
                      style={shiftedStyle}
                      className="bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium"
                    >
                      {new Date(row.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  );
                }

                const item = row.item;
                const isExpanded = expandedNewsId === item.id;
                return (
                  <div style={shiftedStyle} className="border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      {NEWS_COLUMNS.map((col, colIdx) => {
                        const isLast = colIdx === NEWS_COLUMNS.length - 1;
                        return (
                          <div
                            key={col.id}
                            className={`shrink-0 px-4 overflow-hidden ${!isLast ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                            style={{ width: newsColWidths[colIdx], minWidth: col.minWidth }}
                          >
                            {renderNewsCell(col.id, item)}
                          </div>
                        );
                      })}
                    </div>

                    {isExpanded && item.content && (
                      <div className="px-4 pb-3 bg-gray-50 dark:bg-gray-800">
                        <div className="text-sm whitespace-pre-wrap break-words max-h-80 overflow-auto">
                          {item.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
              </List>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Loaded: {remoteNews.length} {isPulling ? '(pulling EODHD...)' : ''}
          </div>
          <button
            onClick={loadMore}
            disabled={!nextCursor || isLoadingMore}
            className={`px-3 py-1 text-sm rounded ${
              !nextCursor || isLoadingMore
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            title={!nextCursor ? 'No more results' : 'Load next page'}
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      </div>
    </div>
  );
}