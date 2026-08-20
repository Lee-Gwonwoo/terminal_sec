import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Filter, ChevronDown, ArrowUp, ArrowDown, GripVertical, FileText, AlignLeft, RotateCw, Download, Columns3, Eye, X, Calendar, Plus, Square, FolderOpen, Settings2, Bookmark, Check } from 'lucide-react';
import { VariableSizeList as List } from 'react-window';
import { BookmarkManager } from './BookmarkManager';
import { getCompanyTickerDataAttrs } from '../companyDescription';

const API_BASE = "";
const ET_TIME_ZONE = 'America/New_York';
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: ET_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' });
const ET_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: ET_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// ─── Heights ───
const STICKY_DATE_HEADER_HEIGHT = 32;
const ROW_HEIGHT_TITLE_ONLY = 96;
const ROW_HEIGHT_WITH_ABSTRACT = 148;
const NEWS_PAGE_SIZE = 200;

// ─── Display mode ───
type DisplayMode = 'title-only' | 'title-abstract';

// ─── Column definition ───
type ColumnId = 'bookmark' | 'date' | 'time' | 'title' | 'tickers' | 'category' | 'fulltext';

interface ColumnDef {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  minWidth: number;
  flex?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'bookmark', label: 'Bookmark', defaultWidth: 88,  minWidth: 48 },
  { id: 'date',     label: 'Date',     defaultWidth: 72,  minWidth: 50 },
  { id: 'time',     label: 'Time ET',  defaultWidth: 64,  minWidth: 52 },
  { id: 'title',    label: 'Title',    defaultWidth: 400, minWidth: 100, flex: true },
  { id: 'tickers',  label: 'Tickers',  defaultWidth: 100, minWidth: 60 },
  { id: 'category', label: 'Category', defaultWidth: 120, minWidth: 70 },
  { id: 'fulltext', label: 'Full Text', defaultWidth: 60, minWidth: 40 },
];

const DEFAULT_VISIBLE: Set<ColumnId> = new Set(DEFAULT_COLUMNS.map(c => c.id));

// ─── Sort ───
type SortDir = 'asc' | 'desc' | null;
interface SortState { column: ColumnId | null; dir: SortDir; }

// ─── Category filter ───
type CategoryFilter = 'all' | 'investing_stock_market_news' | 'investing_cryptocurrency_news';

function getCategoryLabel(cat: CategoryFilter): string {
  if (cat === 'investing_stock_market_news') return 'Stock Market';
  if (cat === 'investing_cryptocurrency_news') return 'Crypto';
  return 'All';
}

function getCategoryBadgeClass(sourceType: string): string {
  if (sourceType === 'investing_stock_market_news') {
    return 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
  }
  if (sourceType === 'investing_cryptocurrency_news') {
    return 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function getCategoryDisplayLabel(sourceType: string): string {
  if (sourceType === 'investing_stock_market_news') return 'Stock Market';
  if (sourceType === 'investing_cryptocurrency_news') return 'Crypto';
  return 'Investing';
}

// ─── Backend item mapping ───
interface BackendNewsItem {
  id: string;
  published_at: string;
  source: string;
  source_type: string;
  title: string;
  body?: string;
  url?: string;
  tickers: string[];
  tags?: string[];
  publisher?: string;
  has_fulltext?: boolean;
  bookmarkFolderIds?: string[];
}

interface DisplayItem {
  id: string;
  publishedAt: string;
  dateLabel: string;
  timeLabel: string;
  title: string;
  body: string;
  url: string;
  sourceType: string;
  publisher: string;
  hasFulltext: boolean;
  tickers: string[];
  bookmarkFolderIds: string[];
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
    return { date: '', time: '' };
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

  return { date: trimmed, time: '' };
}

function mapBackendItem(item: BackendNewsItem): DisplayItem {
  const publishedAtEt = formatPublishedAtEt(item.published_at);
  return {
    id: item.id,
    publishedAt: item.published_at,
    dateLabel: publishedAtEt.date,
    timeLabel: publishedAtEt.time,
    title: item.title,
    body: item.body ?? '',
    url: item.url ?? '',
    sourceType: item.source_type ?? '',
    publisher: item.publisher ?? 'INVESTING',
    hasFulltext: !!item.has_fulltext,
    tickers: Array.isArray(item.tickers) ? item.tickers : [],
    bookmarkFolderIds: Array.isArray(item.bookmarkFolderIds) ? item.bookmarkFolderIds : [],
  };
}

// ─── Bookmark folder type ───
interface BookmarkFolder {
  id: string;
  name: string;
  item_count?: number;
}

// ─── Last-view cache (survives tab switches, which unmount the window) ───
const VIEW_CACHE_KEY = 'investing-news-view-cache';
// Cap what we persist so localStorage (~5MB) can't be blown out by a long walk.
const VIEW_CACHE_MAX_ITEMS = 300;

interface InvestingCache {
  items: DisplayItem[];
  nextCursor: string | null;
  searchQuery: string;
  sort: SortState;
}

const EMPTY_CACHE: InvestingCache = { items: [], nextCursor: null, searchQuery: '', sort: { column: null, dir: null } };

// A list cached before the bookmark column existed has no bookmarkFolderIds, and
// the bookmark cell reads `.length` off it — which would throw on the first row
// and blank the whole window. Backfill the field on the way in.
function normalizeCachedItem(item: DisplayItem): DisplayItem {
  return Array.isArray(item?.bookmarkFolderIds) ? item : { ...item, bookmarkFolderIds: [] };
}

function readCachedView(): InvestingCache {
  try {
    const raw = localStorage.getItem(VIEW_CACHE_KEY);
    if (!raw) return EMPTY_CACHE;
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? (parsed.items as DisplayItem[]).map(normalizeCachedItem) : [],
      nextCursor: typeof parsed.nextCursor === 'string' ? parsed.nextCursor : null,
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
      sort: parsed.sort && typeof parsed.sort === 'object' ? (parsed.sort as SortState) : { column: null, dir: null },
    };
  } catch {
    return EMPTY_CACHE;
  }
}

function writeCachedView(cache: InvestingCache): void {
  try {
    localStorage.setItem(
      VIEW_CACHE_KEY,
      JSON.stringify({ ...cache, items: cache.items.slice(0, VIEW_CACHE_MAX_ITEMS) }),
    );
  } catch {
    // quota exceeded or storage unavailable — the view just won't be restored
  }
}

// ═══════════════════════════════════════════════
interface InvestingNewsWindowProps {
  onTickerClick?: (ticker: string) => void;
  titleFontSize?: number;
  summaryFontSize?: number;
}

export function InvestingNewsWindow({
  onTickerClick,
  titleFontSize = 12,
  summaryFontSize = 11,
}: InvestingNewsWindowProps) {
  // The window unmounts when you switch to another tab, so the loaded article
  // list would be lost and refetched from page 1 (dropping any "Load More"
  // pages). Restore the last view from localStorage so coming back shows
  // exactly what you left. Read once, on first render only.
  const cacheRef = useRef<InvestingCache | null>(null);
  if (cacheRef.current === null) cacheRef.current = readCachedView();
  const cached = cacheRef.current;

  const [searchQuery, setSearchQuery] = useState(cached.searchQuery);
  const [fromDate, setFromDate] = useState(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) { const p = JSON.parse(saved); if (typeof p.fromDate === 'string') return p.fromDate; }
    } catch { /* ignore */ }
    return '';
  });
  const [toDate, setToDate] = useState(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) { const p = JSON.parse(saved); if (typeof p.toDate === 'string') return p.toDate; }
    } catch { /* ignore */ }
    return '';
  });
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [selectedBookmarkFolderId, setSelectedBookmarkFolderId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) { const p = JSON.parse(saved); if (typeof p.selectedBookmarkFolderId === 'string') return p.selectedBookmarkFolderId; }
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
  const bookmarkMenuRef = useRef<HTMLDivElement>(null);
  const bookmarkFolderCtxMenuRef = useRef<HTMLDivElement>(null);
  // Bookmark column: optimistic per-item folder membership overrides (so a
  // toggle reflects instantly without refetching), plus the folder-picker popup
  // that opens from a row's bookmark cell.
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Map<string, string[]>>(new Map());
  const [bookmarkCellMenu, setBookmarkCellMenu] = useState<null | { x: number; y: number; newsId: string }>(null);
  const bookmarkCellMenuRef = useRef<HTMLDivElement>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [listHeight, setListHeight] = useState(500);
  const [stickyDate, setStickyDate] = useState('');

  // Full text popup
  const [showFulltextModal, setShowFulltextModal] = useState(false);
  const [fulltextData, setFulltextData] = useState<{ title: string; text: string; wordCount: number; status: string } | null>(null);
  const [fulltextLoading, setFulltextLoading] = useState(false);

  type JobCategory = 'news-update' | 'news-fulltext';
  const NEWS_JOB_SCOPE = 'investing-news';
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

  const [ftUpdating, setFtUpdating] = useState(false);

  // Display mode
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) { const p = JSON.parse(saved); if (p.displayMode === 'title-abstract') return 'title-abstract'; }
    } catch { /* ignore */ }
    return 'title-only';
  });
  const [showDisplayModeMenu, setShowDisplayModeMenu] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Column ordering + visibility
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  // Persist column visibility as the *hidden* set so a newly-added column
  // (e.g. bookmark) defaults to visible for existing users, and deselecting a
  // column survives the unmount/remount that happens on every tab switch.
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.hiddenCols)) {
          const hidden = new Set(p.hiddenCols as ColumnId[]);
          const visible = new Set(DEFAULT_COLUMNS.map(c => c.id).filter(id => !hidden.has(id)));
          if (visible.size > 0) return visible;
        }
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_VISIBLE);
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMNS.map(c => c.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const activeColumns = useMemo(
    () => columns.filter(c => visibleCols.has(c.id)),
    [columns, visibleCols],
  );
  const activeColWidths = useMemo(() => {
    const widthMap = new Map(columns.map((c, i) => [c.id, colWidths[i]]));
    return activeColumns.map(c => widthMap.get(c.id) ?? c.defaultWidth);
  }, [columns, activeColumns, colWidths]);

  const toggleColumnVisibility = useCallback((colId: ColumnId) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) { if (next.size > 1) next.delete(colId); }
      else { next.add(colId); }
      return next;
    });
  }, []);

  // Effective bookmark folder membership for an item: optimistic override wins
  // over the server-provided value so toggles show up immediately.
  const getItemFolderIds = useCallback((item: DisplayItem): string[] => {
    return bookmarkOverrides.get(item.id) ?? item.bookmarkFolderIds ?? [];
  }, [bookmarkOverrides]);

  // Sort
  const [sort, setSort] = useState<SortState>(cached.sort);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => {
    try {
      const saved = localStorage.getItem('investing-news-ui-state');
      if (saved) {
        const p = JSON.parse(saved);
        if (['all', 'investing_stock_market_news', 'investing_cryptocurrency_news'].includes(p.categoryFilter)) {
          return p.categoryFilter as CategoryFilter;
        }
      }
    } catch { /* ignore */ }
    return 'all';
  });

  // Backend data
  const [newsData, setNewsData] = useState<DisplayItem[]>(cached.items);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(cached.nextCursor);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update config
  type UpdateCategory = 'stock-market-news' | 'cryptocurrency-news';
  const [lastUpdateCategory, setLastUpdateCategory] = useState<UpdateCategory>('stock-market-news');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [pendingUpdateCategory, setPendingUpdateCategory] = useState<UpdateCategory>('stock-market-news');
  const [showCustomPreflightModal, setShowCustomPreflightModal] = useState(false);
  const [customPreflightData, setCustomPreflightData] = useState<any | null>(null);
  const [customPreflightTitle, setCustomPreflightTitle] = useState('Investing Custom Preflight');
  const [pendingCustomExecute, setPendingCustomExecute] = useState<(() => void) | null>(null);

  // Background job tracking
  const [pullJobId, setPullJobId] = useState<string | null>(null);
  const [ftJobId, setFtJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<Record<string, TrackedJobStatus>>({});
  const [activeJobs, setActiveJobs] = useState<ActiveTrackedJob[]>([]);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const toTrackedJobStatus = useCallback((job: ActiveTrackedJob): TrackedJobStatus => ({
    id: job.id,
    category: job.category,
    label: job.label,
    scope: job.scope,
    status: job.status === 'done' || job.status === 'failed' || job.status === 'cancelled' ? job.status : 'running',
    progress: job.progress,
    logs: [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }), []);
  const selectedJobStatus = useMemo(() => {
    if (!selectedJobId) return null;
    const cached = jobStatuses[selectedJobId];
    if (cached) return cached;
    const activeJob = activeJobs.find((job) => job.id === selectedJobId);
    return activeJob ? toTrackedJobStatus(activeJob) : null;
  }, [activeJobs, jobStatuses, selectedJobId, toTrackedJobStatus]);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const displayModeMenuRef = useRef<HTMLDivElement>(null);

  // Row context menu
  const [rowCtxMenu, setRowCtxMenu] = useState<null | { x: number; y: number; newsId: string; title: string }>(null);
  const rowCtxMenuRef = useRef<HTMLDivElement>(null);

  const readJsonResponse = useCallback(async (res: Response) => {
    const text = await res.text();
    if (!text) {
      return {} as Record<string, any>;
    }
    try {
      return JSON.parse(text) as Record<string, any>;
    } catch {
      throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); return; } catch { /* fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // ─── Persist UI state to localStorage ───
  useEffect(() => {
    try {
      const state = {
        fromDate, toDate, displayMode, categoryFilter,
        hiddenCols: DEFAULT_COLUMNS.map(c => c.id).filter(id => !visibleCols.has(id)),
        selectedBookmarkFolderId,
      };
      localStorage.setItem('investing-news-ui-state', JSON.stringify(state));
    } catch { /* ignore */ }
  }, [fromDate, toDate, displayMode, categoryFilter, visibleCols, selectedBookmarkFolderId]);

  // ─── Persist the loaded list so a tab switch doesn't lose it ───
  useEffect(() => {
    // Fold pending bookmark toggles into what we store — the override map lives
    // in component state and dies with the unmount, so without this the restored
    // rows would show the pre-toggle (empty) bookmark icon.
    const items = bookmarkOverrides.size === 0
      ? newsData
      : newsData.map(item => {
          const override = bookmarkOverrides.get(item.id);
          return override ? { ...item, bookmarkFolderIds: override } : item;
        });
    writeCachedView({ items, nextCursor, searchQuery, sort });
  }, [newsData, bookmarkOverrides, nextCursor, searchQuery, sort]);

  // ─── Container height tracking ───
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Bookmark folders ───
  const fetchBookmarkFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks/folders`);
      const data = await res.json();
      if (!res.ok) return;
      const folders: BookmarkFolder[] = Array.isArray(data) ? data : Array.isArray(data.folders) ? data.folders : [];
      setBookmarkFolders(folders);
      // fallback: if restored selectedBookmarkFolderId no longer exists, reset
      setSelectedBookmarkFolderId(prev => (prev && folders.length > 0 && !folders.some(f => f.id === prev) ? '' : prev));
    } catch { /* ignore */ }
  }, []);

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

  // ─── Fetch news from backend ───
  const fetchNews = useCallback(async (keyword?: string) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setError(null);
    // Don't clear the cursor up front: if this request fails or gets aborted we
    // keep showing the old rows, so the old cursor still matches them. Clearing
    // it here hid "Load More" for good — the null was then persisted to the view
    // cache, and the restore path skips the initial refetch that would refill it.
    // The success path below replaces it along with the rows.
    try {
      const params = new URLSearchParams();
      params.set('source_names', 'INVESTING');
      if (selectedBookmarkFolderId) {
        params.set('bookmarkFolderId', selectedBookmarkFolderId);
      }
      if (categoryFilter !== 'all') {
        params.set('source_type', categoryFilter);
      }
      if (keyword) {
        params.set('keyword', keyword);
      }
      if (fromDate) {
        params.set('from', fromDate);
      }
      if (toDate) {
        params.set('to', toDate);
      }
      params.set('limit', String(NEWS_PAGE_SIZE));

      const res = await fetch(`${API_BASE}/api/news?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const items: BackendNewsItem[] = data.items ?? [];
      setNewsData(items.map(mapBackendItem));
      setBookmarkOverrides(new Map());
      setNextCursor(data.nextCursor ?? null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to fetch news');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [selectedBookmarkFolderId, categoryFilter, fromDate, toDate]);

  // ─── Fetch more (cursor-based append) ───
  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('source_names', 'INVESTING');
      if (selectedBookmarkFolderId) params.set('bookmarkFolderId', selectedBookmarkFolderId);
      if (categoryFilter !== 'all') params.set('source_type', categoryFilter);
      if (searchQueryRef.current) params.set('keyword', searchQueryRef.current);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      params.set('limit', String(NEWS_PAGE_SIZE));
      params.set('cursor', nextCursor);

      const res = await fetch(`${API_BASE}/api/news?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) return;
      const items: BackendNewsItem[] = data.items ?? [];
      if (items.length > 0) {
        setNewsData(prev => [...prev, ...items.map(mapBackendItem)]);
      }
      setNextCursor(data.nextCursor ?? null);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [nextCursor, loadingMore, selectedBookmarkFolderId, categoryFilter, fromDate, toDate]);

  // ─── Toggle a news item in/out of a bookmark folder ───
  const toggleBookmarkFolder = useCallback(async (folderId: string, newsId: string, currentFolderIds: string[]) => {
    const isMember = currentFolderIds.includes(folderId);
    const nextIds = isMember
      ? currentFolderIds.filter(id => id !== folderId)
      : [...currentFolderIds, folderId];
    // Optimistic: reflect the change in the bookmark column immediately.
    setBookmarkOverrides(prev => { const next = new Map(prev); next.set(newsId, nextIds); return next; });
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks/items`, {
        method: isMember ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, newsId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchBookmarkFolders(); // refresh folder item counts
      // When the current view is filtered to this folder, re-run the query so a
      // removed item drops out (or an added one appears) in the list.
      if (selectedBookmarkFolderId && folderId === selectedBookmarkFolderId) {
        fetchNews(searchQueryRef.current || undefined);
      }
    } catch {
      // Revert the optimistic change if the request failed.
      setBookmarkOverrides(prev => { const next = new Map(prev); next.set(newsId, currentFolderIds); return next; });
    }
  }, [fetchBookmarkFolders, fetchNews, selectedBookmarkFolderId]);

  useEffect(() => { fetchBookmarkFolders(); }, [fetchBookmarkFolders]);

  // Auto-reload when filters change — but on the very first render after a tab
  // switch, keep the restored list instead of refetching it away (a refetch
  // would reset to page 1 and drop any "Load More" pages).
  // A restored list with no cursor is only trustworthy when it is short enough
  // to be a fully walked result set. A full page or more with the cursor missing
  // is a cache poisoned by an older failed refresh — refetch it rather than
  // restore a list that can never load another page.
  const skipInitialFetchRef = useRef(
    cached.items.length > 0 && (cached.nextCursor !== null || cached.items.length < NEWS_PAGE_SIZE),
  );
  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    fetchNews(searchQueryRef.current || undefined);
  }, [fetchNews]);

  const triggerSearch = useCallback(() => {
    fetchNews(searchQueryRef.current || undefined);
  }, [fetchNews]);

  // ─── Job tracking ───
  type FtSourceType = 'all' | 'investing_stock_market_news' | 'investing_cryptocurrency_news';
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

  // ─── Poll active jobs for reconnect ───
  useEffect(() => {
    let cancelled = false;
    const pollActiveJobs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/active`);
        if (!res.ok) return;
        const jobs: ActiveTrackedJob[] = await res.json();
        if (cancelled) return;
        const scopedJobs = jobs.filter(
          (job) => job.scope === NEWS_JOB_SCOPE && (job.category === 'news-update' || job.category === 'news-fulltext')
        );
        setActiveJobs(scopedJobs);
        setJobStatuses((prev) => {
          const next = { ...prev };
          for (const job of scopedJobs) {
            const fallback = toTrackedJobStatus(job);
            const existing = next[job.id];
            next[job.id] = existing
              ? {
                  ...fallback,
                  ...existing,
                  status: fallback.status,
                  progress: fallback.progress,
                  createdAt: existing.createdAt ?? fallback.createdAt,
                  updatedAt: fallback.updatedAt ?? existing.updatedAt,
                }
              : fallback;
          }
          return next;
        });

        const sortedJobs = [...scopedJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latestPullJob = sortedJobs.find((job) => job.category === 'news-update') ?? null;
        const latestFulltextJob = sortedJobs.find((job) => job.category === 'news-fulltext') ?? null;

        setUpdating(Boolean(latestPullJob));
        setFtUpdating(Boolean(latestFulltextJob));
        setPullJobId(latestPullJob?.id ?? null);
        setFtJobId(latestFulltextJob?.id ?? null);

        const hasSelectedActiveJob = selectedJobId ? scopedJobs.some((job) => job.id === selectedJobId) : false;
        if (!hasSelectedActiveJob && sortedJobs.length > 0) {
          setSelectedJobId(sortedJobs[0].id);
        }
      } catch { /* ignore */ }
    };
    pollActiveJobs();
    const interval = setInterval(pollActiveJobs, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedJobId, toTrackedJobStatus]);

  // ─── Poll selected job ───
  useEffect(() => {
    if (!selectedJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${selectedJobId}`);
        if (!res.ok || cancelled) return;
        const data: TrackedJobStatus = await res.json();
        if (cancelled) return;
        if (data.scope && data.scope !== NEWS_JOB_SCOPE) return;
        const category = (data.category ?? 'news-update') as JobCategory;
        syncJobState(selectedJobId, category, data);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedJobId, syncJobState]);

  // ─── Update (pull from Investing) ───
  const startUpdateRequest = useCallback(async (
    mode: 'recent' | 'custom' = 'recent',
    category: UpdateCategory = 'stock-market-news',
    from?: string,
    to?: string,
  ) => {
    const body: Record<string, unknown> = {
      mode,
      // Recent pulls are incremental: the backend stops once it reaches the
      // newest article already stored, so this is just a safety ceiling for a
      // cold start (empty DB) — normal daily runs fetch only a page or two.
      maxPages: mode === 'custom' ? 600 : 60,
      category,
      // Custom pulls walk many pages, so go slow to stay under Cloudflare's rate
      // limit; the backend also slows down further automatically if blocks appear.
      requestIntervalMs: mode === 'custom' ? 5000 : 1000,
      fulltextConcurrency: 10,
    };
    if (from) body.from = from;
    if (to) body.to = to;
    const res = await fetch(`${API_BASE}/api/news/pull-investing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) {
      if (res.status === 409 && data.existingJobId) {
        registerJob(data.existingJobId, 'news-update');
        setShowLogPanel(true);
      }
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    registerJob(data.jobId, 'news-update');
  }, [registerJob]);

  const handleUpdate = async (
    mode: 'recent' | 'custom' = 'recent',
    category: UpdateCategory = 'stock-market-news',
    from?: string,
    to?: string,
  ) => {
    setLastUpdateCategory(category);
    setUpdating(true);
    setError(null);
    try {
      if (mode === 'custom' && from && to) {
        const preflightBody: Record<string, unknown> = {
          mode,
          category,
          maxPages: 600,
          requestIntervalMs: 2000,
          fulltextConcurrency: 10,
          from,
          to,
        };
        const preflightRes = await fetch(`${API_BASE}/api/news/pull-investing/preflight-custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preflightBody),
        });
        const preflightData = await readJsonResponse(preflightRes);
        if (!preflightRes.ok) {
          throw new Error(preflightData.error || `HTTP ${preflightRes.status}`);
        }
        setCustomPreflightTitle(`Investing Custom Preflight: ${category === 'stock-market-news' ? 'Stock Market' : 'Crypto'}`);
        setCustomPreflightData(preflightData);
        setPendingCustomExecute(() => () => {
          setLastUpdateCategory(category);
          setUpdating(true);
          setError(null);
          void startUpdateRequest('custom', category, from, to).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Failed to start update');
            setUpdating(false);
          });
        });
        setShowCustomPreflightModal(true);
        setUpdating(false);
        return;
      }

      await startUpdateRequest(mode, category, from, to);
    } catch (err: any) {
      setError(err.message || 'Failed to start update');
      setUpdating(false);
    }
  };

  const handleCustomStart = (category: UpdateCategory) => {
    setPendingUpdateCategory(category);
    setCustomFrom('');
    setCustomTo(new Date().toISOString().slice(0, 10));
    setShowCustomDateModal(true);
  };

  // ─── Fulltext extraction ───
  const handleFulltextUpdate = async (sourceType: FtSourceType = 'all') => {
    if (ftUpdating) return;
    setLastFtSourceType(sourceType);
    setFtUpdating(true);
    setError(null);
    try {
      const payload = sourceType === 'all'
        ? { sourceName: 'INVESTING', concurrency: 10, scope: NEWS_JOB_SCOPE }
        : { sourceType, sourceName: 'INVESTING', concurrency: 10, scope: NEWS_JOB_SCOPE };
      const res = await fetch(`${API_BASE}/api/news/fulltext/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse(res);
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

  // ─── Fulltext modal ───
  const handleOpenFulltext = async (newsId: string, fallbackTitle: string = '') => {
    setFulltextLoading(true);
    setShowFulltextModal(true);
    setFulltextData(null);
    try {
      const res = await fetch(`${API_BASE}/api/news/fulltext/${newsId}`);
      const data = await readJsonResponse(res);
      if (!res.ok) {
        setFulltextData({ title: 'Error', text: data.error || `HTTP ${res.status}`, wordCount: 0, status: 'error' });
        return;
      }
      setFulltextData({
        title: data.title ?? data.newsTitle ?? fallbackTitle,
        text: data.fullText ?? data.full_text ?? data.plainText ?? data.plain_text ?? '(no fulltext)',
        wordCount: data.wordCount ?? data.word_count ?? 0,
        status: data.extractionStatus ?? data.extraction_status ?? 'unknown',
      });
    } catch (err: any) {
      setFulltextData({ title: 'Error', text: err.message, wordCount: 0, status: 'error' });
    } finally {
      setFulltextLoading(false);
    }
  };

  // ─── Main button label ───
  const mainBtnLabel = (() => {
    if (lastUpdateCategory === 'stock-market-news') return 'Stock Market';
    return 'Crypto';
  })();

  const handleMainButtonClick = () => {
    handleUpdate('recent', lastUpdateCategory);
  };

  // ─── Sort & group data ───
  type RowItem = { type: 'date-header'; dateLabel: string } | { type: 'news'; item: DisplayItem };

  const sortedAndGrouped: RowItem[] = useMemo(() => {
    let sorted = [...newsData];

    if (sort.column && sort.dir) {
      sorted.sort((a, b) => {
        let cmp = 0;
        const col = sort.column!;
        if (col === 'date' || col === 'time') {
          cmp = a.publishedAt.localeCompare(b.publishedAt);
        } else if (col === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (col === 'tickers') {
          cmp = (a.tickers[0] ?? '').localeCompare(b.tickers[0] ?? '');
        } else if (col === 'category') {
          cmp = a.sourceType.localeCompare(b.sourceType);
        } else if (col === 'bookmark') {
          // Rank on the last fetched membership, not on the optimistic override:
          // if a toggle fed back into the sort key, bookmarking a row would
          // instantly move it to the far end of the list and out of view.
          // The new position is picked up on the next fetch.
          cmp = ((a.bookmarkFolderIds?.length ?? 0) > 0 ? 1 : 0) - ((b.bookmarkFolderIds?.length ?? 0) > 0 ? 1 : 0);
        }
        return sort.dir === 'desc' ? -cmp : cmp;
      });
    }

    const rows: RowItem[] = [];
    let lastDate = '';
    for (const item of sorted) {
      if (item.dateLabel !== lastDate) {
        lastDate = item.dateLabel;
        rows.push({ type: 'date-header', dateLabel: item.dateLabel });
      }
      rows.push({ type: 'news', item });
    }
    return rows;
  }, [newsData, sort]);

  // ─── Row height ───
  const getItemSize = useCallback((index: number): number => {
    const row = sortedAndGrouped[index];
    if (!row) return ROW_HEIGHT_TITLE_ONLY;
    if (row.type === 'date-header') return STICKY_DATE_HEADER_HEIGHT;
    if (displayMode === 'title-abstract' || expandedItems.has(row.item.id)) {
      return ROW_HEIGHT_WITH_ABSTRACT;
    }
    return ROW_HEIGHT_TITLE_ONLY;
  }, [sortedAndGrouped, displayMode, expandedItems]);

  // Reset list cache when data changes
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [sortedAndGrouped, displayMode, expandedItems]);

  // ─── Sticky date header ───
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    let accHeight = 0;
    let currentDate = '';
    for (const row of sortedAndGrouped) {
      if (row.type === 'date-header') {
        currentDate = row.dateLabel;
        accHeight += STICKY_DATE_HEADER_HEIGHT;
      } else {
        const h = displayMode === 'title-abstract' || expandedItems.has(row.item.id) ? ROW_HEIGHT_WITH_ABSTRACT : ROW_HEIGHT_TITLE_ONLY;
        accHeight += h;
      }
      if (accHeight > scrollOffset + STICKY_DATE_HEADER_HEIGHT) break;
    }
    setStickyDate(currentDate);
  }, [sortedAndGrouped, displayMode, expandedItems]);

  // ─── Column resize ───
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colIdx, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(columns[colIdx]?.minWidth ?? 40, startWidth + (e.clientX - startX));
      setColWidths(prev => { const next = [...prev]; next[colIdx] = newWidth; return next; });
    };
    const handleMouseUp = () => { resizingRef.current = null; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [columns]);

  // ─── Click-outside handlers ───
  useEffect(() => {
    if (!rowCtxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rowCtxMenuRef.current?.contains(e.target as Node)) return;
      setRowCtxMenu(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [rowCtxMenu]);

  useEffect(() => {
    if (!bookmarkCellMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (bookmarkCellMenuRef.current?.contains(e.target as Node)) return;
      setBookmarkCellMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setBookmarkCellMenu(null); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [bookmarkCellMenu]);

  useEffect(() => {
    if (!showFilterMenu) return;
    const handler = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setShowFilterMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterMenu]);

  useEffect(() => {
    if (!showBookmarkMenu) return;
    const handler = (e: MouseEvent) => {
      if (bookmarkMenuRef.current && !bookmarkMenuRef.current.contains(e.target as Node)) {
        setShowBookmarkMenu(false);
        setShowNewFolderInput(false);
        setNewFolderName('');
        setEditingBookmarkFolderId(null);
        setEditingBookmarkFolderName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBookmarkMenu]);

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

  useEffect(() => {
    if (!showColumnMenu) return;
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) setShowColumnMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnMenu]);

  useEffect(() => {
    if (!showDisplayModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (displayModeMenuRef.current && !displayModeMenuRef.current.contains(e.target as Node)) setShowDisplayModeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDisplayModeMenu]);

  // ─── Keep log panel pinned to the newest line without moving the outer page ───
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
  }, [selectedJobStatus?.logs.length, showLogPanel]);

  // ─── Total width for horizontal scroll ───
  const totalWidth = useMemo(() => activeColWidths.reduce((sum, w) => sum + w, 0), [activeColWidths]);

  // ─── Row renderer ───
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = sortedAndGrouped[index];
    if (!row) return null;

    if (row.type === 'date-header') {
      return (
        <div style={style} className="flex items-center px-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{row.dateLabel}</span>
        </div>
      );
    }

    const item = row.item;
    const isExpanded = expandedItems.has(item.id);
    const showBody = displayMode === 'title-abstract' || isExpanded;

    return (
      <div
        style={style}
        className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 cursor-pointer"
        onClick={() => {
          if (item.url) openExternalUrl(item.url);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setRowCtxMenu({ x: e.clientX, y: e.clientY, newsId: item.id, title: item.title });
        }}
      >
        {activeColumns.map((col, colIdx) => {
          const w = activeColWidths[colIdx];
          const cellStyle: React.CSSProperties = { width: w, minWidth: w, maxWidth: col.flex ? undefined : w };

          if (col.id === 'bookmark') {
            const isBookmarked = getItemFolderIds(item).length > 0;
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2 flex items-start">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBookmarkCellMenu({ x: e.clientX, y: e.clientY, newsId: item.id });
                  }}
                  className={`p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isBookmarked ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'}`}
                  title={isBookmarked ? 'Bookmarked — click to edit folders' : 'Add bookmark'}
                >
                  <Bookmark className="w-3.5 h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          }
          if (col.id === 'date') {
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                {item.dateLabel}
              </div>
            );
          }
          if (col.id === 'time') {
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                {item.timeLabel}
              </div>
            );
          }
          if (col.id === 'title') {
            return (
              <div key={col.id} style={{ ...cellStyle, flex: 1 }} className="px-2 py-2 overflow-hidden">
                <div
                  className="font-medium text-gray-900 dark:text-gray-100 truncate"
                  style={{ fontSize: titleFontSize }}
                  title={item.title}
                >
                  {item.title}
                </div>
                {showBody && item.body && (
                  <div
                    className="mt-1 text-gray-500 dark:text-gray-400 line-clamp-2"
                    style={{ fontSize: summaryFontSize }}
                  >
                    {item.body}
                  </div>
                )}
              </div>
            );
          }
          if (col.id === 'tickers') {
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2 flex flex-wrap gap-1 content-start overflow-hidden">
                {item.tickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60"
                    onClick={(e) => { e.stopPropagation(); onTickerClick?.(ticker); }}
                    {...getCompanyTickerDataAttrs(ticker)}
                  >
                    {ticker}
                  </span>
                ))}
              </div>
            );
          }
          if (col.id === 'category') {
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryBadgeClass(item.sourceType)}`}>
                  {getCategoryDisplayLabel(item.sourceType)}
                </span>
              </div>
            );
          }
          if (col.id === 'fulltext') {
            return (
              <div key={col.id} style={cellStyle} className="px-2 py-2 flex items-start">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenFulltext(item.id, item.title); }}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${item.hasFulltext ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200'}`}
                  title={item.hasFulltext ? 'View full text' : 'Full text not yet extracted'}
                >
                  <FileText className="w-3 h-3" />
                </button>
              </div>
            );
          }
          return <div key={col.id} style={cellStyle} />;
        })}
      </div>
    );
  }, [sortedAndGrouped, activeColumns, activeColWidths, displayMode, expandedItems, titleFontSize, summaryFontSize, openExternalUrl, onTickerClick, getItemFolderIds]);

  // ═══════════════════════════════════════════════
  // ─── JSX ───
  // ═══════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm">
      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[120px] max-w-[300px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={triggerSearch}
          disabled={loading}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
          title="Refresh"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Category filter */}
        <div className="relative" ref={filterMenuRef}>
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs bg-white dark:bg-gray-900"
            title="Category filter"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{getCategoryLabel(categoryFilter)}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
              <div className="p-1.5">
                {(['all', 'investing_stock_market_news', 'investing_cryptocurrency_news'] as CategoryFilter[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs rounded flex items-center gap-2 ${categoryFilter === cat ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cat === 'investing_stock_market_news' ? 'bg-blue-500' : cat === 'investing_cryptocurrency_news' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bookmark view */}
        <div className="relative" ref={bookmarkMenuRef}>
          <button
            onClick={() => setShowBookmarkMenu(prev => !prev)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs bg-white dark:bg-gray-900"
            title="Bookmark view"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>
              {selectedBookmarkFolderId
                ? (bookmarkFolders.find((folder) => folder.id === selectedBookmarkFolderId)?.name ?? 'Bookmark view')
                : 'Bookmark view'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showBookmarkMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden">
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

        {/* Date filters */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600"
              title="Clear dates"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Display mode */}
        <div className="relative" ref={displayModeMenuRef}>
          <button
            onClick={() => setShowDisplayModeMenu(!showDisplayModeMenu)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
            title="Display mode"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          {showDisplayModeMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
              <div className="p-1.5">
                <button onClick={() => { setDisplayMode('title-only'); setShowDisplayModeMenu(false); }} className={`w-full text-left px-3 py-2 text-xs rounded ${displayMode === 'title-only' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  Title Only
                </button>
                <button onClick={() => { setDisplayMode('title-abstract'); setShowDisplayModeMenu(false); }} className={`w-full text-left px-3 py-2 text-xs rounded ${displayMode === 'title-abstract' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  Title + Abstract
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Column menu */}
        <div className="relative" ref={columnMenuRef}>
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
            title="Columns"
          >
            <Columns3 className="w-3.5 h-3.5" />
          </button>
          {showColumnMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
              <div className="p-1.5">
                {DEFAULT_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.id)}
                      onChange={() => toggleColumnVisibility(col.id)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Update button (split) */}
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
              <button
                onClick={handleMainButtonClick}
                disabled={updating}
                className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 bg-white dark:bg-gray-900"
                title={`Pull Investing: ${mainBtnLabel}`}
              >
                <Download className={`w-3.5 h-3.5 ${updating ? 'animate-bounce' : ''}`} />
                <span className="text-xs">{updating ? 'Pulling...' : mainBtnLabel}</span>
              </button>
              <button
                onClick={() => setShowUpdateMenu(!showUpdateMenu)}
                disabled={updating}
                className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r-lg hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50 bg-white dark:bg-gray-900"
                title="More update options"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              {showUpdateMenu && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto">
                  <div className="p-1.5">
                    {/* Recent */}
                    <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Update</div>
                    <button onClick={() => { setShowUpdateMenu(false); handleUpdate('recent', 'stock-market-news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <Download className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                      <div><div className="font-medium">Stock Market News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Stock market articles only</div></div>
                    </button>
                    <button onClick={() => { setShowUpdateMenu(false); handleUpdate('recent', 'cryptocurrency-news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <Download className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <div><div className="font-medium">Cryptocurrency News</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Crypto articles only</div></div>
                    </button>

                    {/* Custom */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <div className="px-2 py-1 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Update</div>
                    <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('stock-market-news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                      <div><div className="font-medium">Custom Stock Market</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Date range · stock market only</div></div>
                    </button>
                    <button onClick={() => { setShowUpdateMenu(false); handleCustomStart('cryptocurrency-news'); }} disabled={updating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <div><div className="font-medium">Custom Cryptocurrency</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Date range · crypto only</div></div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* View Log */}
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
          title="View job logs"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Log</span>
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

        {/* Full Text button (split) */}
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

          const ftLabel = ftUpdating ? 'Extracting...' : 'Full Text';

          return (
            <div className="relative flex" ref={ftMenuRef}>
              <button
                onClick={() => handleFulltextUpdate(lastFtSourceType)}
                disabled={ftUpdating}
                className="px-3 py-1.5 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50 bg-white dark:bg-gray-900"
                title="Extract full text"
              >
                <FileText className={`w-3.5 h-3.5 text-orange-500 ${ftUpdating ? 'animate-pulse' : ''}`} />
                <span>{ftLabel}</span>
              </button>
              <button
                onClick={() => setShowFtMenu(!showFtMenu)}
                disabled={ftUpdating}
                className="px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-r-lg hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50 bg-white dark:bg-gray-900"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              {showFtMenu && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50">
                  <div className="p-1.5">
                    <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('all'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                      <div><div className="font-medium">All Investing</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for all Investing articles</div></div>
                    </button>
                    <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('investing_stock_market_news'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                      <div><div className="font-medium">Stock Market Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for stock market articles</div></div>
                    </button>
                    <button onClick={() => { setShowFtMenu(false); handleFulltextUpdate('investing_cryptocurrency_news'); }} disabled={ftUpdating} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 disabled:opacity-50">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <div><div className="font-medium">Cryptocurrency Only</div><div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Extract for crypto articles</div></div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Item count */}
        <span className="text-[10px] text-gray-400 tabular-nums ml-auto">{newsData.length} items</span>
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ── Log panel ── */}
      {showLogPanel && selectedJobStatus && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 max-h-[200px] overflow-y-auto px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{selectedJobStatus.label ?? selectedJobId}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                selectedJobStatus.status === 'running' ? 'bg-blue-100 text-blue-600' :
                selectedJobStatus.status === 'done' ? 'bg-green-100 text-green-600' :
                selectedJobStatus.status === 'failed' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {selectedJobStatus.status} {selectedJobStatus.status === 'running' ? `${selectedJobStatus.progress.pct}%` : ''}
              </span>
              {selectedJobStatus.status === 'running' && selectedJobId && (
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/api/jobs/${selectedJobId}/cancel`, { method: 'POST' });
                    } catch { /* ignore */ }
                  }}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  title="Stop job"
                >
                  <Square className="w-3 h-3 text-red-500" />
                </button>
              )}
              <button onClick={() => setShowLogPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
            </div>
          </div>
          {selectedJobStatus.status === 'running' && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${selectedJobStatus.progress.pct}%` }} />
            </div>
          )}
          <div ref={logScrollRef} className="text-[10px] font-mono text-gray-600 dark:text-gray-400 space-y-0.5 max-h-[140px] overflow-y-auto">
            {selectedJobStatus.logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Column header ── */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 select-none" style={{ minWidth: totalWidth }}>
        {activeColumns.map((col, colIdx) => {
          const w = activeColWidths[colIdx];
          const isSorted = sort.column === col.id;
          return (
            <div
              key={col.id}
              style={{ width: w, minWidth: w, maxWidth: col.flex ? undefined : w, flex: col.flex ? 1 : undefined }}
              className="relative px-2 py-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
              draggable
              onDragStart={() => setDragColIdx(colIdx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(colIdx); }}
              onDrop={() => {
                if (dragColIdx !== null && dragColIdx !== colIdx) {
                  const newCols = [...columns];
                  const newWidths = [...colWidths];
                  const [removed] = newCols.splice(dragColIdx, 1);
                  const [removedWidth] = newWidths.splice(dragColIdx, 1);
                  newCols.splice(colIdx, 0, removed);
                  newWidths.splice(colIdx, 0, removedWidth);
                  setColumns(newCols);
                  setColWidths(newWidths);
                }
                setDragColIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => { setDragColIdx(null); setDragOverIdx(null); }}
              onClick={() => {
                setSort(prev => {
                  if (prev.column === col.id) {
                    if (prev.dir === 'asc') return { column: col.id, dir: 'desc' };
                    if (prev.dir === 'desc') return { column: null, dir: null };
                    return { column: col.id, dir: 'asc' };
                  }
                  return { column: col.id, dir: 'asc' };
                });
              }}
            >
              <GripVertical className="w-2.5 h-2.5 opacity-30" />
              <span>{col.label}</span>
              {isSorted && sort.dir === 'asc' && <ArrowUp className="w-3 h-3" />}
              {isSorted && sort.dir === 'desc' && <ArrowDown className="w-3 h-3" />}
              {dragOverIdx === colIdx && dragColIdx !== colIdx && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
              )}
              {/* Resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  resizingRef.current = { colIdx, startX: e.clientX, startWidth: w };
                }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Sticky date ── */}
      {stickyDate && (
        <div className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 text-xs font-semibold text-yellow-700 dark:text-yellow-400 sticky top-0 z-20">
          {stickyDate}
        </div>
      )}

      {/* ── News list ── */}
      <div ref={listContainerRef} className="flex-1 overflow-hidden" style={{ minWidth: totalWidth }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
        ) : sortedAndGrouped.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No Investing news found</div>
        ) : (
          <List
            ref={listRef}
            height={listHeight}
            width="100%"
            itemCount={sortedAndGrouped.length}
            itemSize={getItemSize}
            onScroll={handleScroll}
            overscanCount={5}
          >
            {renderRow}
          </List>
        )}
      </div>

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-center">
          <button
            onClick={fetchMore}
            disabled={loadingMore}
            className="px-4 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* ── Fulltext modal ── */}
      {showFulltextModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFulltextModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium truncate flex-1">{fulltextData?.title ?? 'Full Text'}</h3>
              <div className="flex items-center gap-2">
                {fulltextData && (
                  <span className="text-[10px] text-gray-400">{fulltextData.wordCount} words · {fulltextData.status}</span>
                )}
                <button onClick={() => setShowFulltextModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {fulltextLoading ? (
                <div className="text-center text-gray-400 py-8">Loading full text...</div>
              ) : fulltextData ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                  {fulltextData.text}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Custom date modal ── */}
      {showCustomDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomDateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[400px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium mb-4">Custom Investing Update</h3>
            <div className="text-xs text-gray-500 mb-3">
              Category: <span className="font-medium text-gray-700 dark:text-gray-300">
                {pendingUpdateCategory === 'stock-market-news' ? 'Stock Market' : 'Crypto'}
              </span>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">From</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustomDateModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button
                onClick={() => {
                  if (!customFrom || !customTo) return;
                  setShowCustomDateModal(false);
                  handleUpdate('custom', pendingUpdateCategory, customFrom, customTo);
                }}
                disabled={!customFrom || !customTo}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row context menu ── */}
      {rowCtxMenu && (
        <div
          ref={rowCtxMenuRef}
          style={{ position: 'fixed', left: rowCtxMenu.x, top: rowCtxMenu.y }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 min-w-[160px]"
        >
          <div className="p-1">
            <button
              onClick={() => { handleOpenFulltext(rowCtxMenu.newsId, rowCtxMenu.title); setRowCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
            >
              <FileText className="w-3 h-3" /> View Full Text
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-0.5" />
            <div className="px-3 py-1 text-[9px] text-gray-400 uppercase">Bookmark folders</div>
            {bookmarkFolders.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-gray-500">No bookmark folders</div>
            ) : (() => {
              const ctxItem = newsData.find(i => i.id === rowCtxMenu.newsId);
              const ctxFolderIds = ctxItem ? getItemFolderIds(ctxItem) : [];
              return bookmarkFolders.map(f => {
                const member = ctxFolderIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleBookmarkFolder(f.id, rowCtxMenu.newsId, ctxFolderIds)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                      {member && <Check className="w-3 h-3 text-blue-500" />}
                    </span>
                    <span className="flex-1 truncate">{f.name}</span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Bookmark folder picker (from a row's bookmark cell) ── */}
      {bookmarkCellMenu && (() => {
        const cellItem = newsData.find(i => i.id === bookmarkCellMenu.newsId);
        const cellFolderIds = cellItem ? getItemFolderIds(cellItem) : [];
        return (
          <div
            ref={bookmarkCellMenuRef}
            className="fixed z-[60] min-w-[180px] max-w-[260px] overflow-hidden rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
            style={{
              left: Math.min(bookmarkCellMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : bookmarkCellMenu.x),
              top: Math.min(bookmarkCellMenu.y, typeof window !== 'undefined' ? window.innerHeight - 220 : bookmarkCellMenu.y),
            }}
          >
            <div className="px-3 py-1.5 text-[9px] text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">Bookmark folders</div>
            <div className="p-1 max-h-[240px] overflow-y-auto">
              {bookmarkFolders.length === 0 ? (
                <div className="px-3 py-1.5 text-xs text-gray-500">No folders — create one in Bookmark view</div>
              ) : (
                bookmarkFolders.map(f => {
                  const member = cellFolderIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleBookmarkFolder(f.id, bookmarkCellMenu.newsId, cellFolderIds)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                    >
                      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                        {member && <Check className="w-3 h-3 text-blue-500" />}
                      </span>
                      <span className="flex-1 truncate">{f.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Bookmark manager ── */}
      {showBookmarkManager && (
        <BookmarkManager
          open={showBookmarkManager}
          onClose={() => { setShowBookmarkManager(false); fetchBookmarkFolders(); }}
          folders={bookmarkFolders}
          onFoldersChanged={fetchBookmarkFolders}
        />
      )}

      {showCustomPreflightModal && customPreflightData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomPreflightModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-[42rem] max-w-[92vw] border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><RotateCw className="w-4 h-4 text-blue-500" />{customPreflightTitle}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">실행 전에 category별 기존 coverage와 예상 처리 범위를 보여줍니다.</p>
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
    </div>
  );
}
