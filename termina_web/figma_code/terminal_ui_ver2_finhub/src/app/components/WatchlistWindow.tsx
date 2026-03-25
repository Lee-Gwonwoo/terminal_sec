import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Plus, ChevronDown, Pencil, Trash2, RefreshCw, Check, Copy, X } from 'lucide-react';
import { WatchlistItem } from '../types';

const API_BASE = '';

// ─── Ticker lookup for newly added tickers ───
const TICKER_DB: Record<string, Partial<WatchlistItem>> = {
  IONQ: { name: 'IonQ Inc.', price: 12.45, change: 0.67, changePercent: 5.69, marketCap: '$2.8B', industry: 'Quantum Computing' },
  AMD:  { name: 'Advanced Micro Devices', price: 164.23, change: 4.12, changePercent: 2.57, marketCap: '$265B', industry: 'Semiconductors' },
  PLTR: { name: 'Palantir Technologies', price: 22.67, change: -0.34, changePercent: -1.48, marketCap: '$50B', industry: 'Software' },
  SOFI: { name: 'SoFi Technologies', price: 9.45, change: 0.23, changePercent: 2.50, marketCap: '$9.1B', industry: 'Fintech' },
  RIVN: { name: 'Rivian Automotive', price: 17.89, change: -0.56, changePercent: -3.04, marketCap: '$18B', industry: 'Automotive' },
  COIN: { name: 'Coinbase Global', price: 178.34, change: 5.67, changePercent: 3.28, marketCap: '$42B', industry: 'Cryptocurrency' },
  NFLX: { name: 'Netflix Inc.', price: 612.45, change: 8.23, changePercent: 1.36, marketCap: '$270B', industry: 'Entertainment' },
  BABA: { name: 'Alibaba Group', price: 88.12, change: -1.45, changePercent: -1.62, marketCap: '$220B', industry: 'E-Commerce' },
};

// ─── Column definitions ───
interface ColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align?: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { id: 'ticker',   label: 'Ticker',   defaultWidth: 64,  minWidth: 40,  align: 'left' },
  { id: 'name',     label: 'Name',     defaultWidth: 160, minWidth: 60,  align: 'left' },
  { id: 'mktcap',   label: 'Mkt Cap',  defaultWidth: 72,  minWidth: 48,  align: 'left' },
  { id: 'industry', label: 'Industry', defaultWidth: 80,  minWidth: 50,  align: 'left' },
  { id: 'price',    label: 'Price',    defaultWidth: 72,  minWidth: 48,  align: 'right' },
  { id: 'change',   label: 'Change',   defaultWidth: 80,  minWidth: 50,  align: 'right' },
  { id: 'percent',  label: '%',        defaultWidth: 60,  minWidth: 40,  align: 'right' },
];

// ─── Watch list presets ───
interface WatchListRecord {
  id: string;
  name: string;
  tickers: string[];
  enable_alerts?: boolean;
}

interface WatchlistWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function WatchlistWindow({ onTickerClick }: WatchlistWindowProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [tickerInput, setTickerInput] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<WatchListRecord[]>([]);
  const [copiedListId, setCopiedListId] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ─── New watchlist creation ───
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const newListInputRef = useRef<HTMLInputElement>(null);

  // ─── Rename watchlist ───
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const editListInputRef = useRef<HTMLInputElement>(null);

  // ─── Column widths state (px) ───
  const [colWidths, setColWidths] = useState<number[]>(COLUMNS.map(c => c.defaultWidth));

  // ─── Resize state ───
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeWatchlistName = watchlists.find((list) => list.id === activeWatchlist)?.name ?? 'Watch Lists';

  const hydrateWatchlistItems = useCallback((tickers: string[]) => {
    return tickers.map((ticker) => {
      const dbEntry = TICKER_DB[ticker];
      return {
        ticker,
        name: dbEntry?.name || ticker,
        price: dbEntry?.price || 0,
        change: dbEntry?.change || 0,
        changePercent: dbEntry?.changePercent || 0,
        marketCap: dbEntry?.marketCap || '-',
        industry: dbEntry?.industry || '-',
      } satisfies WatchlistItem;
    });
  }, []);

  const applyActiveWatchlist = useCallback((listId: string | null, nextWatchlists: WatchListRecord[]) => {
    if (!listId) {
      setActiveWatchlist(null);
      setWatchlist([]);
      return;
    }
    const nextActive = nextWatchlists.find((list) => list.id === listId) ?? nextWatchlists[0] ?? null;
    if (!nextActive) {
      setActiveWatchlist(null);
      setWatchlist([]);
      return;
    }
    setActiveWatchlist(nextActive.id);
    setWatchlist(hydrateWatchlistItems(nextActive.tickers));
  }, [hydrateWatchlistItems]);

  const loadWatchlists = useCallback(async (preferredListId?: string | null) => {
    setLoadingLists(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const rows = Array.isArray(data) ? data.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? 'Untitled'),
        tickers: Array.isArray(row.tickers) ? row.tickers.map((ticker: unknown) => String(ticker).toUpperCase()) : [],
        enable_alerts: Boolean(row.enable_alerts ?? row.enableAlerts),
      })) : [];
      setWatchlists(rows);
      applyActiveWatchlist(preferredListId ?? activeWatchlist, rows);
    } catch (err: any) {
      setError(err.message || 'Failed to load watchlists');
    } finally {
      setLoadingLists(false);
    }
  }, [activeWatchlist, applyActiveWatchlist]);

  // ─── Resize handlers ───
  const onResizeMouseDown = useCallback((colIdx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(COLUMNS[resizingRef.current.colIdx].minWidth, resizingRef.current.startWidth + delta);
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
  }, [colWidths]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (watchlistMenuRef.current && !watchlistMenuRef.current.contains(event.target as Node)) {
        setShowWatchlistMenu(false);
      }
    };
    if (showWatchlistMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showWatchlistMenu]);

  // Focus new list input when creating
  useEffect(() => {
    if (isCreatingList && newListInputRef.current) {
      newListInputRef.current.focus();
    }
  }, [isCreatingList]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingListId && editListInputRef.current) {
      editListInputRef.current.focus();
    }
  }, [editingListId]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
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
    }
  }, []);

  const handleCopyListName = useCallback(async (listId: string, listName: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    await copyToClipboard(listName);
    setCopiedListId(listId);
    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedListId((current) => (current === listId ? null : current));
      copyResetTimeoutRef.current = null;
    }, 1500);
  }, [copyToClipboard]);

  // ─── Add tickers ───
  const handleAddTickers = async () => {
    if (!tickerInput.trim() || !activeWatchlist) return;
    const raw = tickerInput.toUpperCase().replace(/,/g, ' ');
    const tickers = raw.split(/\s+/).filter(t => t.length > 0);
    const activeList = watchlists.find((list) => list.id === activeWatchlist);
    if (!activeList) return;
    const existingTickers = new Set(activeList.tickers);
    const mergedTickers = [...activeList.tickers];
    tickers.forEach(ticker => {
      if (existingTickers.has(ticker)) return;
      existingTickers.add(ticker);
      mergedTickers.push(ticker);
    });
    if (mergedTickers.length === activeList.tickers.length) {
      setTickerInput('');
      return;
    }
    setSavingList(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists/${activeList.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeList.name, tickers: mergedTickers, enableAlerts: Boolean(activeList.enable_alerts) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setNotice(`Saved ${mergedTickers.length} tickers to ${activeList.name}`);
      await loadWatchlists(activeList.id);
    } catch (err: any) {
      setError(err.message || 'Failed to update watchlist');
    } finally {
      setSavingList(false);
    }
    setTickerInput('');
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleAddTickers(); };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    setTickerInput(prev => (prev ? prev + ' ' : '') + pasted.trim());
  };

  const toggleSelect = (ticker: string) => {
    setSelectedTickers(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selectedTickers.size === 0 || !activeWatchlist) return;
    const activeList = watchlists.find((list) => list.id === activeWatchlist);
    if (!activeList) return;
    const nextTickers = activeList.tickers.filter((ticker) => !selectedTickers.has(ticker));
    setSavingList(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists/${activeList.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeList.name, tickers: nextTickers, enableAlerts: Boolean(activeList.enable_alerts) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setNotice(`Removed ${selectedTickers.size} ticker${selectedTickers.size > 1 ? 's' : ''}`);
      setSelectedTickers(new Set());
      setIsSelectMode(false);
      await loadWatchlists(activeList.id);
    } catch (err: any) {
      setError(err.message || 'Failed to remove tickers');
    } finally {
      setSavingList(false);
    }
  };

  const handleSelectToggle = () => {
    if (isSelectMode) { setSelectedTickers(new Set()); setIsSelectMode(false); } else { setIsSelectMode(true); }
  };

  const handleSwitchWatchlist = (listId: string) => {
    applyActiveWatchlist(listId, watchlists);
    setShowWatchlistMenu(false);
    setSelectedTickers(new Set());
    setIsSelectMode(false);
    setIsCreatingList(false);
    setEditingListId(null);
    setError(null);
    setNotice(null);
  };

  // ─── Create new watchlist ───
  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setSavingList(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim(), tickers: [], enableAlerts: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setNotice(`Created watch list ${data.name}`);
      setNewListName('');
      setIsCreatingList(false);
      setShowWatchlistMenu(false);
      setSelectedTickers(new Set());
      setIsSelectMode(false);
      await loadWatchlists(String(data.id));
    } catch (err: any) {
      setError(err.message || 'Failed to create watchlist');
    } finally {
      setSavingList(false);
    }
  };

  // ─── Rename watchlist ───
  const handleStartRename = (listId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingListId(listId);
    setEditingListName(currentName);
  };

  const handleConfirmRename = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingListId || !editingListName.trim()) return;
    const activeList = watchlists.find((list) => list.id === editingListId);
    if (!activeList) return;
    setSavingList(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists/${editingListId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingListName.trim(), tickers: activeList.tickers, enableAlerts: Boolean(activeList.enable_alerts) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setEditingListId(null);
      setEditingListName('');
      setNotice(`Renamed watch list to ${data.name}`);
      await loadWatchlists(editingListId);
    } catch (err: any) {
      setError(err.message || 'Failed to rename watchlist');
    } finally {
      setSavingList(false);
    }
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingListId(null);
    setEditingListName('');
  };

  const handleDeleteWatchlist = useCallback(async (listId: string, listName: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!window.confirm(`Delete watch list "${listName}"?`)) {
      return;
    }
    setDeletingListId(listId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlists/${listId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const remaining = watchlists.filter((list) => list.id !== listId);
      const nextActiveId = activeWatchlist === listId ? (remaining[0]?.id ?? null) : activeWatchlist;
      setNotice(`Deleted watch list ${listName}`);
      await loadWatchlists(nextActiveId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete watchlist');
    } finally {
      setDeletingListId(null);
    }
  }, [activeWatchlist, loadWatchlists, watchlists]);

  // ─── Render cell content by column id ───
  const renderCell = (colId: string, item: WatchlistItem) => {
    switch (colId) {
      case 'ticker':
        return <span className="font-medium text-blue-600 dark:text-blue-400">{item.ticker}</span>;
      case 'name':
        return <span className="text-gray-600 dark:text-gray-400 truncate block">{item.name}</span>;
      case 'mktcap':
        return <span className="text-gray-600 dark:text-gray-400">{item.marketCap || '-'}</span>;
      case 'industry':
        return <span className="text-gray-600 dark:text-gray-400 truncate block">{item.industry || '-'}</span>;
      case 'price':
        return <span>${item.price.toFixed(2)}</span>;
      case 'change':
        return (
          <span className={`flex items-center justify-end gap-1 ${item.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {item.change >= 0 ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
            <span>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}</span>
          </span>
        );
      case 'percent':
        return (
          <span className={item.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
          </span>
        );
      default:
        return null;
    }
  };

  const CHECKBOX_COL_W = 32;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* ─── Top Controls ─── */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {(error || notice) && (
          <div className={`mb-2 rounded px-2 py-1 text-[11px] ${error ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300'}`}>
            {error ?? notice}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Watchlist</span>
          <div className="flex-1 min-w-0">
            <input ref={inputRef} type="text" value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)} onKeyDown={handleInputKeyDown} onPaste={handlePaste}
              disabled={!activeWatchlist || savingList || loadingLists}
              placeholder="Ticker (e.g. tsla ionq)"
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <button onClick={() => void handleAddTickers()} disabled={!activeWatchlist || savingList || loadingLists} className="p-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:text-gray-400 disabled:hover:bg-transparent" title="Add tickers">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleSelectToggle} disabled={!activeWatchlist || savingList || loadingLists}
            className={`px-2.5 py-1 text-xs border rounded transition-colors disabled:text-gray-400 disabled:hover:bg-transparent ${isSelectMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            Select
          </button>
          <button onClick={() => void handleDelete()} disabled={selectedTickers.size === 0 || savingList || loadingLists}
            className={`px-2.5 py-1 text-xs border rounded transition-colors ${selectedTickers.size > 0 ? 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50' : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}>
            Delete{selectedTickers.size > 0 ? ` (${selectedTickers.size})` : ''}
          </button>
          <button onClick={() => void loadWatchlists()} disabled={loadingLists || savingList}
            className="p-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
            title="Refresh watchlists">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLists ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative" ref={watchlistMenuRef}>
            <div className="flex items-center gap-1">
            <button
              onClick={() => activeWatchlist ? void handleCopyListName(activeWatchlist, activeWatchlistName) : undefined}
              disabled={!activeWatchlist}
              className={`p-1 border rounded transition-colors ${copiedListId === activeWatchlist ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title={copiedListId === activeWatchlist ? 'Copied active watch list name' : 'Copy active watch list name'}
            >
              {copiedListId === activeWatchlist ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 whitespace-nowrap">
              <span>Watch Lists</span><ChevronDown className="w-3 h-3" />
            </button>
            </div>
            {showWatchlistMenu && (
              <div className="absolute top-full mt-1 right-0 w-52 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                <div className="p-1.5 space-y-0.5">
                  {watchlists.length === 0 && !loadingLists && (
                    <div className="px-3 py-2 text-xs text-gray-400">No watch lists yet.</div>
                  )}
                  {watchlists.map(list => (
                    <div key={list.id} className={`flex items-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${activeWatchlist === list.id ? 'bg-blue-50 dark:bg-blue-900/40' : ''}`}>
                      {editingListId === list.id ? (
                        /* ── Inline rename ── */
                        <div className="flex items-center gap-1 w-full px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={editListInputRef}
                            type="text"
                            value={editingListName}
                            onChange={(e) => setEditingListName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') handleCancelRename(); }}
                            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button onClick={handleConfirmRename} className="p-0.5 text-green-600 hover:text-green-700" title="Confirm">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={handleCancelRename} className="p-0.5 text-red-500 hover:text-red-600" title="Cancel">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        /* ── Normal list item ── */
                        <>
                          <button onClick={() => handleSwitchWatchlist(list.id)}
                            className={`flex-1 min-w-0 text-left px-3 py-1.5 text-xs ${activeWatchlist === list.id ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                            <div className="truncate">{list.name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{list.tickers.length} tickers</div>
                          </button>
                          <button
                            onClick={(e) => void handleCopyListName(list.id, list.name, e)}
                            className={`p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 ${copiedListId === list.id ? 'text-green-600 dark:text-green-400' : ''}`}
                            title={copiedListId === list.id ? 'Copied list name' : 'Copy list name'}
                          >
                            {copiedListId === list.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={(e) => handleStartRename(list.id, list.name, e)}
                            className="p-1.5 mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => void handleDeleteWatchlist(list.id, list.name, e)}
                            disabled={deletingListId === list.id}
                            className="p-1.5 mr-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 disabled:text-gray-400"
                            title="Delete watch list"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* ── New list creation ── */}
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                    {isCreatingList ? (
                      <div className="flex items-center gap-1 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={newListInputRef}
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') { setIsCreatingList(false); setNewListName(''); } }}
                          placeholder="List name..."
                          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button onClick={(e) => { e.stopPropagation(); void handleCreateList(); }} className="p-0.5 text-green-600 hover:text-green-700" title="Create">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setIsCreatingList(false); setNewListName(''); }} className="p-0.5 text-red-500 hover:text-red-600" title="Cancel">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsCreatingList(true); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Watch List</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: colWidths.reduce((s, w) => s + w, 0) + (isSelectMode ? CHECKBOX_COL_W : 0) }}>
          {/* ── Header ── */}
          <div className="sticky top-0 z-10 flex items-center border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 select-none">
            {isSelectMode && (
              <div style={{ width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }} className="flex items-center justify-center px-1 py-2 border-r border-gray-300 dark:border-gray-700 shrink-0">
                <input type="checkbox"
                  checked={selectedTickers.size === watchlist.length && watchlist.length > 0}
                  onChange={() => { selectedTickers.size === watchlist.length ? setSelectedTickers(new Set()) : setSelectedTickers(new Set(watchlist.map(w => w.ticker))); }}
                  className="rounded border-gray-300 dark:border-gray-600" />
              </div>
            )}
            {COLUMNS.map((col, idx) => {
              const isLast = idx === COLUMNS.length - 1;
              return (
                <div
                  key={col.id}
                  className="relative shrink-0 flex items-center"
                  style={{ width: colWidths[idx], minWidth: col.minWidth }}
                >
                  <span className={`px-2 py-2 truncate w-full ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.label}
                  </span>
                  {/* Resize handle */}
                  <div
                    onMouseDown={onResizeMouseDown(idx)}
                    className={`absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-20 group hover:bg-blue-400/40 ${!isLast ? 'border-r border-gray-300 dark:border-gray-700' : ''}`}
                    style={{ touchAction: 'none' }}
                  >
                    <div className="absolute right-[1px] top-1/2 -translate-y-1/2 w-[1px] h-3 bg-transparent group-hover:bg-blue-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Rows ── */}
          {watchlist.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-400">
              {activeWatchlist ? 'No tickers. Add tickers above.' : 'Create a watch list to begin.'}
            </div>
          ) : (
            watchlist.map(item => {
              const isSelected = selectedTickers.has(item.ticker);
              return (
                <div
                  key={item.ticker}
                  onClick={() => { isSelectMode ? toggleSelect(item.ticker) : onTickerClick?.(item.ticker); }}
                  className={`flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors text-xs ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {isSelectMode && (
                    <div style={{ width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }} className="flex items-center justify-center px-1 py-2.5 border-r border-gray-200 dark:border-gray-700 shrink-0">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.ticker)}
                        onClick={(e) => e.stopPropagation()} className="rounded border-gray-300 dark:border-gray-600" />
                    </div>
                  )}
                  {COLUMNS.map((col, idx) => {
                    const isLast = idx === COLUMNS.length - 1;
                    return (
                      <div
                        key={col.id}
                        className={`shrink-0 px-2 py-2.5 overflow-hidden ${col.align === 'right' ? 'text-right' : 'text-left'} ${!isLast ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                        style={{ width: colWidths[idx], minWidth: col.minWidth }}
                      >
                        {renderCell(col.id, item)}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}