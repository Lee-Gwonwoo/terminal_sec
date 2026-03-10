import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Search, AlertCircle, X } from "lucide-react";

const API_BASE = "";
const DEFAULT_CSV_PATH = "tradigview_screener/original_data/watch lists2_2026-02-22.csv";

interface DefaultTickerWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function DefaultTickerWindow({ onTickerClick }: DefaultTickerWindowProps) {
  const [csvPath, setCsvPath] = useState(DEFAULT_CSV_PATH);
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [dataSource, setDataSource] = useState<"db" | "csv" | null>(null);
  const trimmedCsvPath = csvPath.trim();
  const isDefaultPath = trimmedCsvPath === DEFAULT_CSV_PATH;

  const loadTickers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const effectivePath = trimmedCsvPath || DEFAULT_CSV_PATH;
      const url = `${API_BASE}/api/tickers?csvPath=${encodeURIComponent(effectivePath)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTickers(data.tickers ?? []);
      setDataSource(data.source ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load tickers");
    } finally {
      setLoading(false);
    }
  }, [trimmedCsvPath]);

  useEffect(() => {
    loadTickers();
  }, [loadTickers]);

  const handleAdd = async () => {
    const trimmed = newTicker.trim().toUpperCase();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickers/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPath: trimmedCsvPath || DEFAULT_CSV_PATH, ticker: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTickers(data.tickers ?? []);
      setDataSource(isDefaultPath ? "db" : "csv");
      setNewTicker("");
    } catch (err: any) {
      setError(err.message || "Failed to add ticker");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickers/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPath: trimmedCsvPath || DEFAULT_CSV_PATH, ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setTickers(data.tickers ?? []);
      setDataSource(isDefaultPath ? "db" : "csv");
    } catch (err: any) {
      setError(err.message || "Failed to remove ticker");
    } finally {
      setRemoving(null);
    }
  };

  const handleImportToDefault = async () => {
    if (!trimmedCsvPath || isDefaultPath) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickers/import-default`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPath: trimmedCsvPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setCsvPath(DEFAULT_CSV_PATH);
      setTickers(data.tickers ?? []);
      setDataSource("db");
      setNotice(`Merged ${data.tickersAdded ?? 0} tickers from CSV into default universe. Skipped duplicates: ${data.tickersSkipped ?? 0}.`);
    } catch (err: any) {
      setError(err.message || "Failed to merge CSV into default universe");
    } finally {
      setImporting(false);
    }
  };

  const filteredTickers = filterText
    ? tickers.filter((t) => t.includes(filterText.toUpperCase()))
    : tickers;

  return (
    <div className="h-full flex flex-col p-3 text-sm">
      {/* CSV Path Input */}
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">CSV Path:</label>
        <input
          type="text"
          value={csvPath}
          onChange={(e) => setCsvPath(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-400 dark:text-gray-500"
          placeholder="tradigview_screener/original_data/..."
          title="기본값: 진리는 DB(ticker_universes/default) 우선. CSV는 backup sync 대상"
        />
        <button
          onClick={loadTickers}
          disabled={loading}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
        {!isDefaultPath && (
          <button
            onClick={handleImportToDefault}
            disabled={importing || loading || !trimmedCsvPath}
            className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            title="Add tickers from this CSV into the canonical default universe without removing existing tickers"
          >
            {importing ? "Merging..." : "Merge into Default"}
          </button>
        )}
      </div>

      {/* DB Path badge */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">DB Path:</label>
        <span className="flex-1 px-2 py-0.5 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded truncate">
          app.db › ticker_universes/default › ticker_universe_items
        </span>
        {dataSource && (
          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
            dataSource === "db"
              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
              : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
          }`}>
            {dataSource === "db" ? "DB" : "CSV"}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-xs text-emerald-700 dark:text-emerald-400">
          {notice}
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
              <div key={ticker} className="relative group">
                <button
                  onClick={() => onTickerClick?.(ticker)}
                  className={`w-full px-1.5 py-1 text-xs font-mono text-center rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate pr-3 ${
                    removing === ticker ? "opacity-40" : ""
                  }`}
                  title={ticker}
                  disabled={removing === ticker}
                >
                  {ticker}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}
                  disabled={removing !== null}
                  className="absolute top-0.5 right-0.5 hidden group-hover:flex w-3.5 h-3.5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-500 text-gray-400 text-[9px] leading-none"
                  title={`Remove ${ticker} from default universe`}
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
