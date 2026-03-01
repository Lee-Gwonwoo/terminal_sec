import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Plus, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { mockWatchlistData } from '../mockData';
import { WatchlistItem } from '../types';

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
interface WatchListPreset {
  id: string;
  name: string;
  tickers: string[];
}

const DEFAULT_WATCHLISTS: WatchListPreset[] = [
  { id: 'default', name: 'Default', tickers: ['TSLA', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'AMZN', 'META'] },
  { id: 'tech', name: 'Tech Stocks', tickers: ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA'] },
  { id: 'portfolio', name: 'My Portfolio', tickers: ['TSLA', 'NVDA', 'AMZN'] },
];

interface WatchlistWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function WatchlistWindow({ onTickerClick }: WatchlistWindowProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(mockWatchlistData);
  const [tickerInput, setTickerInput] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [activeWatchlist, setActiveWatchlist] = useState('default');
  const [watchlists, setWatchlists] = useState<WatchListPreset[]>(DEFAULT_WATCHLISTS);

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

  const watchlistMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // ─── Add tickers ───
  const handleAddTickers = () => {
    if (!tickerInput.trim()) return;
    const raw = tickerInput.toUpperCase().replace(/,/g, ' ');
    const tickers = raw.split(/\s+/).filter(t => t.length > 0);
    const existingTickers = new Set(watchlist.map(w => w.ticker));
    const newItems: WatchlistItem[] = [];
    tickers.forEach(ticker => {
      if (existingTickers.has(ticker)) return;
      existingTickers.add(ticker);
      const dbEntry = TICKER_DB[ticker];
      newItems.push({
        ticker,
        name: dbEntry?.name || ticker,
        price: dbEntry?.price || 0,
        change: dbEntry?.change || 0,
        changePercent: dbEntry?.changePercent || 0,
        marketCap: dbEntry?.marketCap || '-',
        industry: dbEntry?.industry || '-',
      });
    });
    if (newItems.length > 0) setWatchlist(prev => [...prev, ...newItems]);
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

  const handleDelete = () => {
    if (selectedTickers.size === 0) return;
    setWatchlist(prev => prev.filter(item => !selectedTickers.has(item.ticker)));
    setSelectedTickers(new Set());
    setIsSelectMode(false);
  };

  const handleSelectToggle = () => {
    if (isSelectMode) { setSelectedTickers(new Set()); setIsSelectMode(false); } else { setIsSelectMode(true); }
  };

  const handleSwitchWatchlist = (listId: string) => {
    setActiveWatchlist(listId);
    const list = watchlists.find(w => w.id === listId);
    if (list) {
      const items: WatchlistItem[] = list.tickers.map(ticker => {
        const existing = mockWatchlistData.find(m => m.ticker === ticker);
        if (existing) return existing;
        const dbEntry = TICKER_DB[ticker];
        return {
          ticker, name: dbEntry?.name || ticker, price: dbEntry?.price || 0,
          change: dbEntry?.change || 0, changePercent: dbEntry?.changePercent || 0,
          marketCap: dbEntry?.marketCap, industry: dbEntry?.industry,
        };
      });
      setWatchlist(items);
    }
    setShowWatchlistMenu(false);
    setSelectedTickers(new Set());
    setIsSelectMode(false);
    setIsCreatingList(false);
    setEditingListId(null);
  };

  // ─── Create new watchlist ───
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const newId = `list-${Date.now()}`;
    const newList: WatchListPreset = { id: newId, name: newListName.trim(), tickers: [] };
    setWatchlists(prev => [...prev, newList]);
    setNewListName('');
    setIsCreatingList(false);
    // Switch to the new list
    setActiveWatchlist(newId);
    setWatchlist([]);
    setShowWatchlistMenu(false);
    setSelectedTickers(new Set());
    setIsSelectMode(false);
  };

  // ─── Rename watchlist ───
  const handleStartRename = (listId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingListId(listId);
    setEditingListName(currentName);
  };

  const handleConfirmRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingListId || !editingListName.trim()) return;
    setWatchlists(prev => prev.map(w => w.id === editingListId ? { ...w, name: editingListName.trim() } : w));
    setEditingListId(null);
    setEditingListName('');
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingListId(null);
    setEditingListName('');
  };

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
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Watchlist</span>
          <div className="flex-1 min-w-0">
            <input ref={inputRef} type="text" value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)} onKeyDown={handleInputKeyDown} onPaste={handlePaste}
              placeholder="Ticker (e.g. tsla ionq)"
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <button onClick={handleAddTickers} className="p-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Add tickers">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleSelectToggle}
            className={`px-2.5 py-1 text-xs border rounded transition-colors ${isSelectMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            Select
          </button>
          <button onClick={handleDelete} disabled={selectedTickers.size === 0}
            className={`px-2.5 py-1 text-xs border rounded transition-colors ${selectedTickers.size > 0 ? 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50' : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}>
            Delete{selectedTickers.size > 0 ? ` (${selectedTickers.size})` : ''}
          </button>
          <div className="relative" ref={watchlistMenuRef}>
            <button onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 whitespace-nowrap">
              <span>Watch Lists</span><ChevronDown className="w-3 h-3" />
            </button>
            {showWatchlistMenu && (
              <div className="absolute top-full mt-1 right-0 w-52 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-30">
                <div className="p-1.5 space-y-0.5">
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
                            onClick={(e) => handleStartRename(list.id, list.name, e)}
                            className="p-1.5 mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
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
                        <button onClick={(e) => { e.stopPropagation(); handleCreateList(); }} className="p-0.5 text-green-600 hover:text-green-700" title="Create">
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
              No tickers. Add tickers above.
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