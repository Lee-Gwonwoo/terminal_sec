import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, FolderOpen, Trash2, Edit2, Check, GripVertical, Plus } from 'lucide-react';

const API_BASE = "";

interface BookmarkFolder {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface BookmarkItem {
  news_id: string;
  bookmarked_at: string;
  title?: string;
  ticker?: string;
}

interface CtxMenu {
  x: number;
  y: number;
  newsId: string | null;
  folderId: string;
}

interface ClipboardItem {
  newsId: string;
  folderId: string;
  mode: 'copy' | 'cut';
}

interface Props {
  open: boolean;
  onClose: () => void;
  folders: BookmarkFolder[];
  onFoldersChanged: () => void;
}

export function BookmarkManager({ open, onClose, folders, onFoldersChanged }: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showCreateFolderInput, setShowCreateFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [dragItem, setDragItem] = useState<{ newsId: string; folderId: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Auto-select first folder
  useEffect(() => {
    if (open && folders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(folders[0].id);
    }
  }, [open, folders, selectedFolderId]);

  // Fetch items for selected folder
  const fetchItems = useCallback(async (folderId: string) => {
    if (!folderId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks/folders/${folderId}/items`);
      if (!res.ok) { setItems([]); return; }
      const rows: BookmarkItem[] = await res.json();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && selectedFolderId) fetchItems(selectedFolderId);
  }, [open, selectedFolderId, fetchItems]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  // ── Folder actions ──
  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) return;
    await fetch(`${API_BASE}/api/bookmarks/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setEditingFolderId(null);
    onFoldersChanged();
  };

  const handleDeleteFolder = async (folderId: string) => {
    await fetch(`${API_BASE}/api/bookmarks/folders/${folderId}`, { method: 'DELETE' });
    if (selectedFolderId === folderId) {
      setSelectedFolderId('');
      setItems([]);
    }
    onFoldersChanged();
  };

  const handleCreateFolder = async () => {
    if (creatingFolder) return;
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setShowCreateFolderInput(false);
      setNewFolderName('');
      return;
    }

    setCreatingFolder(true);
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) {
        return;
      }

      const created: BookmarkFolder = await res.json();
      setSelectedFolderId(created.id);
      setShowCreateFolderInput(false);
      setNewFolderName('');
      onFoldersChanged();
    } finally {
      setCreatingFolder(false);
    }
  };

  // ── Item actions ──
  const handleDeleteItem = async (newsId: string, folderId: string) => {
    await fetch(`${API_BASE}/api/bookmarks/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, newsId }),
    });
    setCtxMenu(null);
    fetchItems(folderId);
  };

  const handleCopy = (newsId: string, folderId: string) => {
    setClipboard({ newsId, folderId, mode: 'copy' });
    setCtxMenu(null);
  };

  const handleCut = (newsId: string, folderId: string) => {
    setClipboard({ newsId, folderId, mode: 'cut' });
    setCtxMenu(null);
  };

  const handlePaste = async (targetFolderId: string) => {
    if (!clipboard) return;
    if (clipboard.mode === 'copy') {
      await fetch(`${API_BASE}/api/bookmarks/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId, newsId: clipboard.newsId }),
      });
    } else {
      // cut = move
      await fetch(`${API_BASE}/api/bookmarks/items/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId: clipboard.newsId, fromFolderId: clipboard.folderId, toFolderId: targetFolderId }),
      });
    }
    setClipboard(null);
    setCtxMenu(null);
    fetchItems(selectedFolderId);
  };

  const openFolderContextMenu = (e: React.MouseEvent, folderId: string) => {
    if (!clipboard) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, newsId: null, folderId });
  };

  // ── Drag & Drop ──
  const handleDragStart = (newsId: string, folderId: string) => {
    setDragItem({ newsId, folderId });
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDrop = async (e: React.DragEvent, toFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!dragItem || dragItem.folderId === toFolderId) { setDragItem(null); return; }
    await fetch(`${API_BASE}/api/bookmarks/items/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsId: dragItem.newsId, fromFolderId: dragItem.folderId, toFolderId }),
    });
    setDragItem(null);
    fetchItems(selectedFolderId);
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col" style={{ width: 720, height: 520, maxWidth: '95%', maxHeight: '90%' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-500" />
            Bookmark Manager
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Folder sidebar */}
          <div className="w-48 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 text-[10px] text-gray-400 uppercase tracking-wide">
              <span>Folders</span>
              <button
                onClick={() => {
                  setShowCreateFolderInput(true);
                  setEditingFolderId(null);
                }}
                className="rounded p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                title="New folder"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {showCreateFolderInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateFolder();
                }}
                className="px-3 pb-2"
              >
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => void handleCreateFolder()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowCreateFolderInput(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="Folder name"
                  className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-xs focus:outline-none dark:bg-gray-800"
                />
              </form>
            )}
            <div className="flex-1 overflow-y-auto">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                    selectedFolderId === folder.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  } ${dragOverFolderId === folder.id ? 'ring-2 ring-blue-400' : ''}`}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setEditingFolderId(null);
                  }}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => handleDrop(e, folder.id)}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {editingFolderId === folder.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id, editingName); }} className="flex-1 flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRenameFolder(folder.id, editingName)}
                        className="flex-1 px-1 py-0.5 text-xs border border-blue-400 rounded bg-white dark:bg-gray-800 focus:outline-none"
                      />
                      <button type="submit" className="p-0.5"><Check className="w-3 h-3 text-green-500" /></button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{folder.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingName(folder.name); }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Delete folder"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {folders.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No folders yet</div>
              )}
            </div>
          </div>

          {/* Items panel */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 py-2 text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <span>Items</span>
              {selectedFolderId && <span className="text-gray-300">({items.length})</span>}
              {clipboard && (
                <button
                  onClick={() => handlePaste(selectedFolderId)}
                  className="ml-auto px-2 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Paste here ({clipboard.mode})
                </button>
              )}
            </div>
            <div
              className="flex-1 overflow-y-auto"
              onContextMenu={(e) => {
                if (!selectedFolderId) return;
                openFolderContextMenu(e, selectedFolderId);
              }}
            >
              {!selectedFolderId ? (
                <div className="px-3 py-8 text-xs text-gray-400 text-center">Select a folder</div>
              ) : loading ? (
                <div className="px-3 py-8 text-xs text-gray-400 text-center">Loading...</div>
              ) : items.length === 0 ? (
                <div
                  className="px-3 py-8 text-xs text-gray-400 text-center"
                  onContextMenu={(e) => openFolderContextMenu(e, selectedFolderId)}
                >
                  No bookmarks in this folder
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.news_id}
                    draggable
                    onDragStart={() => handleDragStart(item.news_id, selectedFolderId)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenu({ x: e.clientX, y: e.clientY, newsId: item.news_id, folderId: selectedFolderId });
                    }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate" title={item.title}>
                        {item.ticker && <span className="font-medium text-blue-600 dark:text-blue-400 mr-1">{item.ticker}</span>}
                        {item.title || item.news_id}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.bookmarked_at ? new Date(item.bookmarked_at).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.news_id, selectedFolderId)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context menu for items */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[70] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg min-w-[160px] overflow-hidden"
          style={{
            left: Math.min(ctxMenu.x, (typeof window !== 'undefined' ? window.innerWidth - 180 : ctxMenu.x)),
            top: Math.min(ctxMenu.y, (typeof window !== 'undefined' ? window.innerHeight - 200 : ctxMenu.y)),
          }}
        >
          {ctxMenu.newsId && (
            <>
              <button
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleCopy(ctxMenu.newsId!, ctxMenu.folderId)}
              >
                Copy
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleCut(ctxMenu.newsId!, ctxMenu.folderId)}
              >
                Cut
              </button>
            </>
          )}
          {clipboard && (
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handlePaste(ctxMenu.folderId)}
            >
              Paste
            </button>
          )}
          {ctxMenu.newsId && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              <button
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                onClick={() => handleDeleteItem(ctxMenu.newsId!, ctxMenu.folderId)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
