import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Trash2, Copy, FileText, FolderOpen, Check, RefreshCw, RotateCcw, X } from 'lucide-react';

const API_BASE = '';

// ── Types ──

interface ResearchTab {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface ResearchPage {
  id: string;
  tab_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SearchResult extends ResearchPage {
  tab_name: string;
}

interface ContextMenuState {
  type: 'tab' | 'page';
  id: string;
  x: number;
  y: number;
}

interface TrashedResearchTab extends ResearchTab {
  deleted_at: string;
}

interface TrashedResearchPage extends ResearchPage {
  deleted_at: string;
  tab_name: string | null;
  tab_deleted_at: string | null;
}

interface ResearchTrashResponse {
  tabs: TrashedResearchTab[];
  pages: TrashedResearchPage[];
}

// ── Component ──

export function CaseResearchWindow() {
  // ─── State ───
  const [tabs, setTabs] = useState<ResearchTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pages, setPages] = useState<ResearchPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<ResearchPage | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashedTabs, setTrashedTabs] = useState<TrashedResearchTab[]>([]);
  const [trashedPages, setTrashedPages] = useState<TrashedResearchPage[]>([]);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch tabs ───
  const fetchTabs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs`);
      const data: ResearchTab[] = await res.json();
      setTabs(data);
      if (data.length > 0 && !activeTabId) {
        setActiveTabId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch research tabs', err);
    }
  }, [activeTabId]);

  // ─── Fetch pages for active tab ───
  const fetchPages = useCallback(async (tabId: string, preferredPageId?: string | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/pages`);
      const data: ResearchPage[] = await res.json();
      setPages(data);
      if (data.length > 0) {
        const nextPage = data.find(page => page.id === preferredPageId) ?? data[0];
        setActivePageId(nextPage.id);
        setActivePage(nextPage);
      } else {
        setActivePageId(null);
        setActivePage(null);
      }
    } catch (err) {
      console.error('Failed to fetch pages', err);
    }
  }, []);

  // ─── Search ───
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/research/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed', err);
    }
  }, []);

  // ─── Effects ───
  useEffect(() => { fetchTabs(); }, [fetchTabs]);

  useEffect(() => {
    if (activeTabId) fetchPages(activeTabId, activePageId);
  }, [activeTabId, fetchPages]);

  const fetchPageDetail = useCallback(async (pageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${pageId}`);
      const data: ResearchPage = await res.json();
      setActivePageId(data.id);
      setActivePage(data);
      setPages(prev => prev.map(page => page.id === data.id ? data : page));
    } catch (err) {
      console.error('Failed to fetch research page detail', err);
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    setIsLoadingTrash(true);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/trash`);
      if (!res.ok) {
        throw new Error(`Trash fetch failed with status ${res.status}`);
      }
      const data: ResearchTrashResponse = await res.json();
      setTrashedTabs(data.tabs);
      setTrashedPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch research trash', err);
      setRestoreError('Failed to load deleted items.');
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  // ─── Auto-save with debounce ───
  const scheduleSave = useCallback((pageId: string, title: string, body: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/research/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body }),
        });
        if (!res.ok) {
          throw new Error(`Auto-save failed with status ${res.status}`);
        }
        const updated: ResearchPage = await res.json();
        setActivePage(updated);
        // Update page title in sidebar list
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, title: updated.title, updated_at: updated.updated_at } : p));
      } catch (err) {
        console.error('Auto-save failed', err);
      }
    }, 500);
  }, []);

  // ─── Handlers ───
  const handleCreateTab = async () => {
    try {
      setContextMenu(null);
      const res = await fetch(`${API_BASE}/api/research/tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Section' }),
      });
      const tab: ResearchTab = await res.json();
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (err) {
      console.error('Tab creation failed', err);
    }
  };

  const handleRenameTab = async (id: string) => {
    if (!editingTabName.trim()) { setEditingTabId(null); return; }
    try {
      await fetch(`${API_BASE}/api/research/tabs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTabName }),
      });
      setTabs(prev => prev.map(t => t.id === id ? { ...t, name: editingTabName } : t));
    } catch (err) {
      console.error('Tab rename failed', err);
    }
    setEditingTabId(null);
    setContextMenu(null);
  };

  const handleDeleteTab = async (id: string) => {
    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await fetch(`${API_BASE}/api/research/tabs/${id}`, { method: 'DELETE' });
      const remainingTabs = tabs.filter(t => t.id !== id);
      setTabs(remainingTabs);
      if (activeTabId === id) {
        const nextTabId = remainingTabs[0]?.id ?? null;
        setActiveTabId(nextTabId);
        if (!nextTabId) {
          setPages([]);
          setActivePageId(null);
          setActivePage(null);
        }
      }
    } catch (err) {
      console.error('Tab deletion failed', err);
    }
    setContextMenu(null);
  };

  const handleCreatePage = async () => {
    if (!activeTabId) return;
    try {
      setContextMenu(null);
      const res = await fetch(`${API_BASE}/api/research/tabs/${activeTabId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const page: ResearchPage = await res.json();
      setPages(prev => [...prev, page]);
      setActivePageId(page.id);
      setActivePage(page);
      setTimeout(() => titleRef.current?.focus(), 50);
    } catch (err) {
      console.error('Page creation failed', err);
    }
  };

  const handleRenamePage = async (id: string) => {
    const nextTitle = editingPageTitle.trim();
    if (!nextTitle) {
      setEditingPageId(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) {
        throw new Error(`Page rename failed with status ${res.status}`);
      }
      const updated: ResearchPage = await res.json();
      setPages(prev => prev.map(p => p.id === id ? updated : p));
      if (activePageId === id) {
        setActivePage(prev => prev ? { ...prev, title: updated.title, updated_at: updated.updated_at } : prev);
      }
    } catch (err) {
      console.error('Page rename failed', err);
    }
    setEditingPageId(null);
    setContextMenu(null);
  };

  const handleDeletePage = async (id: string) => {
    try {
      if (activePageId === id && saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await fetch(`${API_BASE}/api/research/pages/${id}`, { method: 'DELETE' });
      const remainingPages = pages.filter(p => p.id !== id);
      setPages(remainingPages);
      if (activePageId === id) {
        setActivePageId(remainingPages[0]?.id ?? null);
        setActivePage(remainingPages[0] ?? null);
      }
    } catch (err) {
      console.error('Page deletion failed', err);
    }
    setContextMenu(null);
  };

  const handleTitleChange = (value: string) => {
    if (!activePage) return;
    setActivePage(prev => prev ? { ...prev, title: value } : null);
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, title: value } : p));
    scheduleSave(activePage.id, value, activePage.body);
  };

  const handleBodyChange = (value: string) => {
    if (!activePage) return;
    setActivePage(prev => prev ? { ...prev, body: value } : null);
    scheduleSave(activePage.id, activePage.title, value);
  };

  const handleCopyId = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(activePage.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setActiveTabId(result.tab_id);
    setActivePageId(result.id);
    setActivePage(result);
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleSelectPage = (page: ResearchPage) => {
    setActivePageId(page.id);
    setActivePage(page);
    setEditingPageId(null);
  };

  const openContextMenu = (event: React.MouseEvent, type: 'tab' | 'page', id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'page') {
      const targetPage = pages.find(page => page.id === id);
      if (targetPage) {
        setActivePageId(targetPage.id);
        setActivePage(targetPage);
      }
    }
    setContextMenu({ type, id, x: event.clientX, y: event.clientY });
  };

  const handleContextRename = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'tab') {
      const targetTab = tabs.find(tab => tab.id === contextMenu.id);
      if (!targetTab) return;
      setEditingTabId(targetTab.id);
      setEditingTabName(targetTab.name);
      setContextMenu(null);
      return;
    }
    const targetPage = pages.find(page => page.id === contextMenu.id);
    if (!targetPage) return;
    setEditingPageId(targetPage.id);
    setEditingPageTitle(targetPage.title || '');
    setContextMenu(null);
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'tab') {
      void handleDeleteTab(contextMenu.id);
      return;
    }
    void handleDeletePage(contextMenu.id);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tabsRes = await fetch(`${API_BASE}/api/research/tabs`);
      const nextTabs: ResearchTab[] = await tabsRes.json();
      setTabs(nextTabs);

      const nextTabId = nextTabs.find(tab => tab.id === activeTabId)?.id ?? nextTabs[0]?.id ?? null;
      setActiveTabId(nextTabId);

      if (!nextTabId) {
        setPages([]);
        setActivePageId(null);
        setActivePage(null);
        return;
      }

      const pagesRes = await fetch(`${API_BASE}/api/research/tabs/${nextTabId}/pages`);
      const nextPages: ResearchPage[] = await pagesRes.json();
      setPages(nextPages);

      const nextPageId = nextPages.find(page => page.id === activePageId)?.id ?? nextPages[0]?.id ?? null;
      setActivePageId(nextPageId);

      if (!nextPageId) {
        setActivePage(null);
        return;
      }

      const pageRes = await fetch(`${API_BASE}/api/research/pages/${nextPageId}`);
      const nextPage: ResearchPage = await pageRes.json();
      setActivePage(nextPage);
      setPages(prev => prev.map(page => page.id === nextPage.id ? nextPage : page));
    } catch (err) {
      console.error('Manual refresh failed', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activePageId, activeTabId]);

  const handleOpenRestorePanel = useCallback(async () => {
    setShowRestorePanel(true);
    await fetchTrash();
  }, [fetchTrash]);

  const handleRestoreTab = async (tabId: string) => {
    setRestoringKey(`tab:${tabId}`);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/restore`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Restore tab failed with status ${res.status}`);
      }
      const restoredTab: ResearchTab = await res.json();
      setShowRestorePanel(false);
      await fetchTabs();
      setActiveTabId(restoredTab.id);
      await fetchPages(restoredTab.id);
    } catch (err) {
      console.error('Tab restore failed', err);
      setRestoreError('Failed to restore the deleted section.');
      await fetchTrash();
    } finally {
      setRestoringKey(null);
    }
  };

  const handleRestorePage = async (pageId: string) => {
    setRestoringKey(`page:${pageId}`);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${pageId}/restore`, { method: 'POST' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Restore page failed with status ${res.status}`);
      }
      const restoredPage: ResearchPage = await res.json();
      setShowRestorePanel(false);
      setActiveTabId(restoredPage.tab_id);
      await fetchTabs();
      await fetchPages(restoredPage.tab_id, restoredPage.id);
      await fetchPageDetail(restoredPage.id);
    } catch (err) {
      console.error('Page restore failed', err);
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore the deleted page.');
      await fetchTrash();
    } finally {
      setRestoringKey(null);
    }
  };

  const persistPageOrder = useCallback(async (tabId: string, nextPages: ResearchPage[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/pages/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIds: nextPages.map(page => page.id) }),
      });
      const savedPages: ResearchPage[] = await res.json();
      setPages(savedPages);
    } catch (err) {
      console.error('Page reorder failed', err);
      fetchPages(tabId);
    }
  }, [fetchPages]);

  const handlePageDrop = useCallback((targetPageId: string) => {
    if (!activeTabId || !draggedPageId || draggedPageId === targetPageId) {
      setDraggedPageId(null);
      return;
    }

    const currentPages = [...pages];
    const draggedIndex = currentPages.findIndex(page => page.id === draggedPageId);
    const targetIndex = currentPages.findIndex(page => page.id === targetPageId);
    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedPageId(null);
      return;
    }

    const [draggedPage] = currentPages.splice(draggedIndex, 1);
    currentPages.splice(targetIndex, 0, draggedPage);
    const reorderedPages = currentPages.map((page, index) => ({ ...page, sort_order: index }));
    setPages(reorderedPages);
    setDraggedPageId(null);
    void persistPageOrder(activeTabId, reorderedPages);
  }, [activeTabId, draggedPageId, pages, persistPageOrder]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
      return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  // ─── Render ───
  return (
    <div className="relative flex flex-col h-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{ minHeight: 0 }}>
      {/* ── Top: Search Bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0 dark:border-slate-800 dark:bg-slate-900">
        <Search size={14} className="text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search all tabs & pages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => { void handleRefresh(); }}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
          title="Refresh tabs, pages, and the current note"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={() => { void handleOpenRestorePanel(); }}
          disabled={isLoadingTrash}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          title="Show deleted tabs and pages that can be restored"
        >
          <RotateCcw size={12} className={isLoadingTrash ? 'animate-spin' : ''} />
          Restore
        </button>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setIsSearching(false); setSearchResults([]); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>

      {/* ── Top: Section Bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 shrink-0 dark:border-slate-800 dark:bg-slate-950">
        {tabs.map(tab => (
          <div key={tab.id} className="group relative shrink-0">
            {editingTabId === tab.id ? (
              <input
                autoFocus
                value={editingTabName}
                onChange={e => setEditingTabName(e.target.value)}
                onBlur={() => handleRenameTab(tab.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameTab(tab.id); if (e.key === 'Escape') setEditingTabId(null); }}
                className="w-44 rounded-t-xl border border-b-0 border-slate-300 bg-white px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            ) : (
              <button
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => { setEditingTabId(tab.id); setEditingTabName(tab.name); }}
                onContextMenu={event => openContextMenu(event, 'tab', tab.id)}
                className={`min-w-44 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm text-left transition-colors ${
                  activeTabId === tab.id
                    ? 'border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                <div className="truncate font-medium">{tab.name}</div>
              </button>
            )}
            <button
              onClick={() => handleDeleteTab(tab.id)}
              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:text-slate-500"
              title="Soft delete section (permanent after 24 hours)"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={handleCreateTab}
          className="shrink-0 rounded-full border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
          title="New section"
        >
          <span className="inline-flex items-center gap-1"><Plus size={12} /> New Section</span>
        </button>
      </div>

      {/* ── Search Results Overlay ── */}
      {isSearching && searchResults.length > 0 && (
        <div className="absolute left-2 right-2 top-10 z-50 max-h-60 overflow-y-auto rounded-b-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searchResults.map(r => (
            <button
              key={r.id}
              onClick={() => handleSearchResultClick(r)}
              className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <div className="truncate text-xs font-medium text-blue-600 dark:text-blue-400">{r.title || '(Untitled)'}</div>
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                <span className="text-amber-600 dark:text-amber-400">[{r.tab_name}]</span> {r.body.slice(0, 80)}…
              </div>
            </button>
          ))}
        </div>
      )}
      {isSearching && searchResults.length === 0 && searchQuery.trim() && (
        <div className="absolute left-2 right-2 top-10 z-50 rounded-b-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No results found.
        </div>
      )}

      {/* ── Main: Sidebar + Content ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* ── Left Sidebar ── */}
        <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 shrink-0 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Section</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{tabs.find(tab => tab.id === activeTabId)?.name ?? 'No Section'}</div>
          </div>

          {/* Page list */}
          <div className="flex-1 overflow-y-auto">
            {pages.map(page => (
              <button
                key={page.id}
                draggable
                onDragStart={() => setDraggedPageId(page.id)}
                onDragEnd={() => setDraggedPageId(null)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handlePageDrop(page.id)}
                onClick={() => handleSelectPage(page)}
                onContextMenu={event => openContextMenu(event, 'page', page.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-200/80 group cursor-grab active:cursor-grabbing dark:border-slate-800/80 ${draggedPageId === page.id ? 'opacity-50' : ''} ${activePageId === page.id ? 'bg-white dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
              >
                <div className="flex items-center justify-between">
                  {editingPageId === page.id ? (
                    <input
                      autoFocus
                      value={editingPageTitle}
                      onChange={e => setEditingPageTitle(e.target.value)}
                      onBlur={() => { void handleRenamePage(page.id); }}
                      onClick={event => event.stopPropagation()}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          void handleRenamePage(page.id);
                        }
                        if (event.key === 'Escape') {
                          setEditingPageId(null);
                        }
                      }}
                      className="mr-2 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  ) : (
                    <span className="text-xs truncate flex-1 text-slate-800 dark:text-slate-100">{page.title || '(Untitled)'}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDeletePage(page.id); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity ml-1"
                    title="Soft delete page (permanent after 24 hours)"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5 dark:text-slate-400">{formatDate(page.updated_at)}</div>
              </button>
            ))}
          </div>

          {/* New page button */}
          <div className="px-3 py-2 border-t border-slate-200 shrink-0 dark:border-slate-800">
            <button
              onClick={handleCreatePage}
              disabled={!activeTabId}
              className="flex w-full items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:text-blue-400 dark:hover:border-blue-500 dark:hover:bg-slate-800"
            >
              <Plus size={12} /> New Page
            </button>
          </div>
        </div>

        {/* ── Right: Page Content ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white dark:bg-slate-950">
          {activePage ? (
            <>
              {/* Page ID + metadata */}
              <div className="px-6 pt-5 pb-3 border-b border-slate-200 shrink-0 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
                {/* Page ID row */}
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={12} className="text-slate-500 shrink-0 dark:text-slate-400" />
                  <code className="text-[10px] text-slate-500 font-mono select-all dark:text-slate-400">{activePage.id}</code>
                  <button
                    onClick={handleCopyId}
                    className="text-slate-500 hover:text-blue-600 shrink-0 dark:hover:text-blue-400"
                    title="Copy page ID"
                  >
                    {copiedId ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>

                {/* Title */}
                <input
                  ref={titleRef}
                  value={activePage.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Page title..."
                  className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder-slate-400 dark:text-slate-100 dark:placeholder-slate-600"
                />

                {/* Dates */}
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Created: {formatDate(activePage.created_at)}</span>
                  <span>Modified: {formatDate(activePage.updated_at)}</span>
                  <button
                    onClick={() => { void handleRefresh(); }}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:text-blue-400"
                    title="Refresh current note from DB"
                  >
                    <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <textarea
                  ref={bodyRef}
                  value={activePage.body}
                  onChange={e => handleBodyChange(e.target.value)}
                  placeholder="Write your notes here..."
                  className="w-full h-full bg-transparent px-6 py-5 text-sm leading-relaxed text-slate-800 resize-none outline-none placeholder-slate-400 dark:text-slate-200 dark:placeholder-slate-600"
                  style={{ minHeight: '100%' }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-500">
              <div className="text-center">
                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{activeTabId ? 'No pages yet. Create one!' : 'Select or create a tab to start.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[70] min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <button
            onClick={handleContextRename}
            className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Rename
          </button>
          <button
            onClick={handleContextDelete}
            className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete (24h hold)
          </button>
        </div>
      )}

      {showRestorePanel && (
        <div className="absolute inset-0 z-[65] flex items-start justify-end bg-slate-950/20 backdrop-blur-[1px] dark:bg-black/40">
          <div className="mt-12 mr-4 flex max-h-[75vh] w-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Restore Deleted Items</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Soft-deleted items stay recoverable for up to 24 hours.</div>
              </div>
              <button
                onClick={() => setShowRestorePanel(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Close restore panel"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {restoreError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {restoreError}
                </div>
              )}

              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Deleted Sections</div>
                {trashedTabs.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">No deleted sections waiting for restore.</div>
                ) : (
                  <div className="space-y-2">
                    {trashedTabs.map(tab => (
                      <div key={tab.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{tab.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Deleted: {formatDate(tab.deleted_at)}</div>
                          </div>
                          <button
                            onClick={() => { void handleRestoreTab(tab.id); }}
                            disabled={restoringKey === `tab:${tab.id}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
                          >
                            <RotateCcw size={11} className={restoringKey === `tab:${tab.id}` ? 'animate-spin' : ''} />
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Deleted Pages</div>
                {trashedPages.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">No deleted pages waiting for restore.</div>
                ) : (
                  <div className="space-y-2">
                    {trashedPages.map(page => {
                      const isBlocked = Boolean(page.tab_deleted_at);
                      return (
                        <div key={page.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{page.title || '(Untitled)'}</div>
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Section: {page.tab_name ?? 'Unknown section'}</div>
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Deleted: {formatDate(page.deleted_at)}</div>
                              {isBlocked && (
                                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Restore the deleted section first.</div>
                              )}
                            </div>
                            <button
                              onClick={() => { void handleRestorePage(page.id); }}
                              disabled={isBlocked || restoringKey === `page:${page.id}`}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
                            >
                              <RotateCcw size={11} className={restoringKey === `page:${page.id}` ? 'animate-spin' : ''} />
                              Restore
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
