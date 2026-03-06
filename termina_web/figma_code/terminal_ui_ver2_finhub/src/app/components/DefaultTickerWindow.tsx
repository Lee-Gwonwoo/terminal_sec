import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Search, AlertCircle } from "lucide-react";

const API_BASE = "http://localhost:8080";
const DEFAULT_CSV_PATH = "tradigview_screener/original_data/watch lists2_2026-02-22.csv";

interface DefaultTickerWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function DefaultTickerWindow({ onTickerClick }: DefaultTickerWindowProps) {
  const [csvPath, setCsvPath] = useState(DEFAULT_CSV_PATH);
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [filterText, setFilterText] = useState("");

  const loadTickers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/api/tickers?csvPath=${encodeURIComponent(csvPath)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTickers(data.tickers ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load tickers");
    } finally {
      setLoading(false);
    }
  }, [csvPath]);

  useEffect(() => {
    loadTickers();
  }, [loadTickers]);

  const handleAdd = async () => {
    const trimmed = newTicker.trim().toUpperCase();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickers/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPath, ticker: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTickers(data.tickers ?? []);
      setNewTicker("");
    } catch (err: any) {
      setError(err.message || "Failed to add ticker");
    } finally {
      setAdding(false);
    }
  };

  const filteredTickers = filterText
    ? tickers.filter((t) => t.includes(filterText.toUpperCase()))
    : tickers;

  return (
    <div className="h-full flex flex-col p-3 text-sm">
      {/* CSV Path Input */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">CSV Path:</label>
        <input
          type="text"
          value={csvPath}
          onChange={(e) => setCsvPath(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="tradigview_screener/original_data/..."
        />
        <button
          onClick={loadTickers}
          disabled={loading}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Add Ticker */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Add ticker (e.g. TSLA)"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTicker.trim()}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Filter tickers..."
        />
        <span className="text-xs text-gray-400">
          {filteredTickers.length}/{tickers.length}
        </span>
      </div>

      {/* Ticker List */}
      <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
        {loading && tickers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            Loading...
          </div>
        ) : filteredTickers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            {tickers.length === 0 ? "No tickers loaded" : "No matches"}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-0.5 p-1">
            {filteredTickers.map((ticker) => (
              <button
                key={ticker}
                onClick={() => onTickerClick?.(ticker)}
                className="px-1.5 py-1 text-xs font-mono text-center rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                title={ticker}
              >
                {ticker}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
