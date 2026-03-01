import React, { useState, useEffect } from "react";
import { Plus, Edit2, Moon, Sun } from "lucide-react";
import { TabData, WindowInstance, WindowType } from "./types";
import { AddTabModal } from "./components/AddTabModal";
import { DraggableWindow } from "./components/DraggableWindow";

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
        if (type === 'brave-news') {
          title = 'News Feed: Brave API';
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
    if (!activeTab) return;

    setTabs(
      tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              windows: tab.windows.filter(
                (w) => w.id !== windowId,
              ),
            }
          : tab,
      ),
    );
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
            } rounded-t px-3 py-1.5 cursor-pointer transition-colors`}
            onClick={() => setActiveTabId(tab.id)}
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
        {activeTab && activeTab.windows.length === 0 ? (
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
        ) : (
          activeTab?.windows.map((window) => (
            <DraggableWindow
              key={window.id}
              window={window}
              onClose={() => handleCloseWindow(window.id)}
              onTickerClick={(ticker) =>
                handleTickerClick(ticker, window.linkId)
              }
              initialTicker={
                window.linkId
                  ? linkedTicker[window.linkId]
                  : undefined
              }
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