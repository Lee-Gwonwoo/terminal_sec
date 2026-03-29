import React, { useState, useEffect } from "react";
import { Plus, Edit2, Moon, Sun } from "lucide-react";
import { TabData, WindowInstance, WindowType } from "./types";
import { AddTabModal } from "./components/AddTabModal";
import { DraggableWindow } from "./components/DraggableWindow";
import type { CaseDescriptionWindowData, DataControlHowToUseWindowData } from "./types";

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const [tabs, setTabs] = useState<TabData[]>([
    {
      id: "1",
      name: "Tab 1",
      windows: [],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [editingTabId, setEditingTabId] = useState<
    string | null
  >(null);
  const [editingTabName, setEditingTabName] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [linkedTicker, setLinkedTicker] = useState<{
    [linkId: number]: string;
  }>({});
  const [fontScale, setFontScale] = useState(1);
  const [newsTitleFontSize, setNewsTitleFontSize] = useState(12);
  const [newsSummaryFontSize, setNewsSummaryFontSize] = useState(11);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

  useEffect(() => {
    const handleOpenCaseDescription = (event: Event) => {
      const customEvent = event as CustomEvent<CaseDescriptionWindowData>;
      const payload = customEvent.detail;
      if (!payload) {
        return;
      }

      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id !== activeTabId) {
          return tab;
        }

        const existing = tab.windows.find(window => window.type === 'case-description' && window.data?.caseType === payload.caseType);
        if (existing) {
          return {
            ...tab,
            windows: tab.windows.map(window => window.id === existing.id ? {
              ...window,
              title: `Case Description: ${payload.caseLabelKo}`,
              data: payload,
            } : window),
          };
        }

        const nextIndex = tab.windows.length;
        const newWindow: WindowInstance = {
          id: `${Date.now()}-case-description-${payload.caseType}`,
          type: 'case-description',
          title: `Case Description: ${payload.caseLabelKo}`,
          data: payload,
          position: {
            top: 60 + nextIndex * 24,
            left: 80 + nextIndex * 24,
            width: 620,
            height: 560,
          },
        };

        return {
          ...tab,
          windows: [...tab.windows, newWindow],
        };
      }));
    };

    const handleOpenDataControlHowToUse = (event: Event) => {
      const customEvent = event as CustomEvent<DataControlHowToUseWindowData>;
      const payload = customEvent.detail;
      if (!payload) {
        return;
      }

      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id !== activeTabId) {
          return tab;
        }

        const existing = tab.windows.find((window) => {
          if (window.type !== 'data-control-how-to-use' || !window.data) {
            return false;
          }
          return 'key' in window.data && window.data.key === payload.key;
        });

        if (existing) {
          return {
            ...tab,
            windows: tab.windows.map(window => window.id === existing.id ? {
              ...window,
              title: `How To Use: ${payload.title}`,
              data: payload,
            } : window),
          };
        }

        const nextIndex = tab.windows.length;
        const newWindow: WindowInstance = {
          id: `${Date.now()}-data-control-how-to-use-${payload.key}`,
          type: 'data-control-how-to-use',
          title: `How To Use: ${payload.title}`,
          data: payload,
          position: {
            top: 72 + nextIndex * 18,
            left: 96 + nextIndex * 18,
            width: 560,
            height: 520,
          },
        };

        return {
          ...tab,
          windows: [...tab.windows, newWindow],
        };
      }));
    };

    window.addEventListener('open-case-description', handleOpenCaseDescription as EventListener);
    window.addEventListener('open-data-control-how-to-use', handleOpenDataControlHowToUse as EventListener);
    return () => {
      window.removeEventListener('open-case-description', handleOpenCaseDescription as EventListener);
      window.removeEventListener('open-data-control-how-to-use', handleOpenDataControlHowToUse as EventListener);
    };
  }, [activeTabId]);

  // ─── Restore workspace from localStorage ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem('terminal-workspace-v1');
      if (!saved) return;
      const p = JSON.parse(saved);
      if (p?.version !== 1) return;
      if (Array.isArray(p.tabs) && p.tabs.length > 0) setTabs(p.tabs);
      if (p.activeTabId) setActiveTabId(p.activeTabId);
      if (typeof p.isDarkMode === 'boolean') setIsDarkMode(p.isDarkMode);
      if (typeof p.fontScale === 'number') setFontScale(p.fontScale);
      setNewsTitleFontSize(clampNumber(p.newsTitleFontSize, 12, 10, 20));
      setNewsSummaryFontSize(clampNumber(p.newsSummaryFontSize, 11, 9, 18));
    } catch { /* corrupted — use defaults */ }
    finally {
      setWorkspaceHydrated(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Apply font scale ───
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 100}%`;
  }, [fontScale]);

  // ─── Persist workspace on change ───
  useEffect(() => {
    if (!workspaceHydrated) return;
    try {
      localStorage.setItem('terminal-workspace-v1', JSON.stringify({
        version: 1,
        activeTabId,
        isDarkMode,
        fontScale,
        newsTitleFontSize,
        newsSummaryFontSize,
        linkedTicker,
        tabs: tabs.map(t => ({ id: t.id, name: t.name, windows: t.windows })),
      }));
    } catch { /* quota */ }
  }, [workspaceHydrated, tabs, activeTabId, isDarkMode, fontScale, newsTitleFontSize, newsSummaryFontSize, linkedTicker]);

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const handleAddTab = () => {
    setShowAddTabModal(true);
  };

  const handleStartTab = (selectedWindows: WindowType[]) => {
    const newTabId = Date.now().toString();

    // Calculate initial positions for windows based on count
    const windowCount = selectedWindows.length;
    const positions: Array<{
      top: number;
      left: number;
      width: number;
      height: number;
    }> = [];

    if (windowCount === 1) {
      positions.push({
        top: 20,
        left: 20,
        width: 800,
        height: 600,
      });
    } else if (windowCount === 2) {
      // Side by side
      positions.push({
        top: 20,
        left: 20,
        width: 600,
        height: 600,
      });
      positions.push({
        top: 20,
        left: 640,
        width: 600,
        height: 600,
      });
    } else {
      // Staggered layout
      selectedWindows.forEach((_, index) => {
        positions.push({
          top: 20 + index * 40,
          left: 20 + index * 40,
          width: 600,
          height: 500,
        });
      });
    }

    const newWindows: WindowInstance[] = selectedWindows.map(
      (type, index) => {
        let title = '';
        if (type === 'finhub-news') {
          title = 'News Feed: Finnhub API';
        } else if (type === 'default-ticker') {
          title = 'Default Ticker';
        } else if (type === 'data-control') {
          title = 'Data Control';
        } else if (type === 'case-research') {
          title = 'AI Research Window';
        } else if (type === 'evidence-table') {
          title = 'Evidence Table';
        } else if (type === 'case-description') {
          title = 'Case Description';
        } else if (type === 'data-control-how-to-use') {
          title = 'Data Control How To Use';
        } else if (type === 'investing-news') {
          title = 'Investing News';
        } else {
          title = type.charAt(0).toUpperCase() + type.slice(1) + ' Window';
        }
        
        return {
          id: `${newTabId}-${type}-${index}`,
          type,
          title,
          linkId: 1, // Default link ID
          position: positions[index],
        };
      }
    );

    const newTab: TabData = {
      id: newTabId,
      name: `Tab ${tabs.length + 1}`,
      windows: newWindows,
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) return; // Don't close the last tab

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    setTabs(
      tabs.map((tab) =>
        tab.id === tabId ? { ...tab, name: newName } : tab,
      ),
    );
    setEditingTabId(null);
    setEditingTabName("");
  };

  const handleCloseWindow = (windowId: string) => {
    setTabs(tabs.map(tab => ({
      ...tab,
      windows: tab.windows.filter(w => w.id !== windowId),
    })));
  };

  const handleTabDragStart = (tabId: string) => {
    setDragTabId(tabId);
    setDragOverTabId(tabId);
  };

  const handleTabDrop = (targetTabId: string) => {
    if (!dragTabId || dragTabId === targetTabId) {
      setDragTabId(null);
      setDragOverTabId(null);
      return;
    }

    setTabs(prev => {
      const sourceIndex = prev.findIndex(tab => tab.id === dragTabId);
      const targetIndex = prev.findIndex(tab => tab.id === targetTabId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDragTabId(null);
    setDragOverTabId(null);
  };

  const handlePositionChange = (windowId: string, pos: { top: number; left: number; width: number; height: number }) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      windows: tab.windows.map(w => w.id === windowId ? { ...w, position: pos } : w),
    })));
  };

  const handleTickerClick = (
    ticker: string,
    linkId?: number,
  ) => {
    if (linkId) {
      setLinkedTicker({ ...linkedTicker, [linkId]: ticker });
    }
  };

  const handleTabContextMenu = (
    e: React.MouseEvent,
    tabId: string,
  ) => {
    e.preventDefault();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      setEditingTabId(tabId);
      setEditingTabName(tab.name);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium">
            Stock News Platform
          </h1>
        </div>

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="h-10 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-2 gap-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`relative group ${
              activeTabId === tab.id
                ? "bg-white dark:bg-gray-800"
                : "bg-gray-200 dark:bg-gray-800/50 hover:bg-gray-300 dark:hover:bg-gray-800/70"
            } ${dragOverTabId === tab.id && dragTabId !== tab.id ? "ring-2 ring-blue-400 ring-inset" : ""} rounded-t px-3 py-1.5 cursor-grab active:cursor-grabbing transition-colors`}
            draggable={editingTabId !== tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onDragStart={() => handleTabDragStart(tab.id)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragTabId && dragTabId !== tab.id) setDragOverTabId(tab.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleTabDrop(tab.id);
            }}
            onDragEnd={() => {
              setDragTabId(null);
              setDragOverTabId(null);
            }}
            onContextMenu={(e) =>
              handleTabContextMenu(e, tab.id)
            }
          >
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={editingTabName}
                onChange={(e) =>
                  setEditingTabName(e.target.value)
                }
                onBlur={() =>
                  handleRenameTab(tab.id, editingTabName)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameTab(tab.id, editingTabName);
                  } else if (e.key === "Escape") {
                    setEditingTabId(null);
                    setEditingTabName("");
                  }
                }}
                className="w-24 px-1 py-0 text-sm bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm">{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-700 rounded p-0.5 transition-opacity"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={handleAddTab}
          className="px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded flex items-center gap-1 text-sm"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Empty-state message if active tab has no windows */}
        {activeTab?.windows.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No windows open in this tab
              </p>
              <button
                onClick={handleAddTab}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >Add Windows</button>
            </div>
          </div>
        )}
        {tabs.map(tab =>
          tab.windows.map((window) => (
            <DraggableWindow
              key={window.id}
              window={window}
              style={tab.id !== activeTabId ? { display: 'none' } : undefined}
              onClose={() => handleCloseWindow(window.id)}
              onTickerClick={(ticker) =>
                handleTickerClick(ticker, window.linkId)
              }
              initialTicker={
                window.linkId
                  ? linkedTicker[window.linkId]
                  : undefined
              }
              fontScale={fontScale}
              onFontScaleChange={setFontScale}
              newsTitleFontSize={newsTitleFontSize}
              onNewsTitleFontSizeChange={setNewsTitleFontSize}
              newsSummaryFontSize={newsSummaryFontSize}
              onNewsSummaryFontSizeChange={setNewsSummaryFontSize}
              onPositionChange={handlePositionChange}
            />
          ))
        )}
      </div>

      {/* Add Tab Modal */}
      <AddTabModal
        isOpen={showAddTabModal}
        onClose={() => setShowAddTabModal(false)}
        onStart={handleStartTab}
      />
    </div>
  );
}