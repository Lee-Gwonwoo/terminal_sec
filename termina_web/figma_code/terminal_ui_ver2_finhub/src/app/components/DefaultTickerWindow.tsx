import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Plus, RefreshCw, Search, X } from "lucide-react";

const API_BASE = "";
const DEFAULT_CSV_PATH = "tradigview_screener/original_data/watch lists2_2026-02-22.csv";

interface DefaultTickerWindowProps {
  onTickerClick?: (ticker: string) => void;
}

interface TickerRow {
  ticker: string;
  exchange: string | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
}

interface JobStatus {
  status: "running" | "done" | "failed" | "cancelled";
  progress: { completed: number; total: number; pct: number };
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
}

function fallbackRowsFromTickers(tickers: string[] | undefined): TickerRow[] {
  return (tickers ?? []).map((ticker) => ({
    ticker,
    exchange: null,
    name: null,
    sector: null,
    industry: null,
    marketCap: null,
  }));
}

function normalizeRows(data: any): TickerRow[] {
  if (Array.isArray(data?.rows)) {
    return data.rows.map((row: any) => ({
      ticker: String(row.ticker ?? "").toUpperCase(),
      exchange: row.exchange ?? null,
      name: row.name ?? null,
      sector: row.sector ?? null,
      industry: row.industry ?? null,
      marketCap: typeof row.marketCap === "number" ? row.marketCap : null,
    }));
  }
  return fallbackRowsFromTickers(data?.tickers);
}

function formatMarketCap(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

export function DefaultTickerWindow({ onTickerClick }: DefaultTickerWindowProps) {
  const [csvPath, setCsvPath] = useState(DEFAULT_CSV_PATH);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [marketCapUpdating, setMarketCapUpdating] = useState(false);
  const [marketCapJobId, setMarketCapJobId] = useState<string | null>(null);
  const [marketCapJob, setMarketCapJob] = useState<JobStatus | null>(null);
  const [showLog, setShowLog] = useState(false);
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
      setRows(normalizeRows(data));
      setDataSource(data.source ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load tickers");
    } finally {
      setLoading(false);
    }
  }, [trimmedCsvPath]);

  useEffect(() => {
    void loadTickers();
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
      setRows(normalizeRows(data));
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
      setRows(normalizeRows(data));
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
      setRows(normalizeRows(data));
      setDataSource("db");
      setNotice(`Merged ${data.tickersAdded ?? 0} tickers from CSV into default universe. Skipped duplicates: ${data.tickersSkipped ?? 0}.`);
    } catch (err: any) {
      setError(err.message || "Failed to merge CSV into default universe");
    } finally {
      setImporting(false);
    }
  };

  const handleMarketCapUpdate = async () => {
    if (!isDefaultPath || marketCapUpdating) return;
    setMarketCapUpdating(true);
    setError(null);
    setNotice(null);
    setMarketCapJob(null);
    try {
      const res = await fetch(`${API_BASE}/api/company-profiles/pull-market-cap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setMarketCapUpdating(false);
        return;
      }
      setMarketCapJobId(data.jobId ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to start market cap update");
      setMarketCapUpdating(false);
    }
  };

  useEffect(() => {
    if (!marketCapJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${marketCapJobId}`);
        if (res.status === 404) {
          // Job lost (server restarted or cleaned up)
          setMarketCapUpdating(false);
          setMarketCapJob(null);
          setError("Market cap update job lost (server may have restarted). Please retry.");
          setMarketCapJobId(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMarketCapJob(data);
        if (data.status === "done") {
          setMarketCapUpdating(false);
          setNotice(`Market cap update completed. Updated ${data.result?.updated ?? 0} tickers.`);
          await loadTickers();
        } else if (data.status === "failed") {
          setMarketCapUpdating(false);
          setError(data.error || "Market cap update failed");
        } else if (data.status === "cancelled") {
          setMarketCapUpdating(false);
        }
      } catch {
        // ignore transient polling errors
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [marketCapJobId, loadTickers]);

  const filteredRows = useMemo(() => {
    const needle = filterText.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      row.ticker.includes(needle)
      || (row.name ?? "").toUpperCase().includes(needle)
      || (row.industry ?? "").toUpperCase().includes(needle)
      || (row.exchange ?? "").toUpperCase().includes(needle),
    );
  }, [rows, filterText]);

  return (
    <div className="h-full flex flex-col p-3 text-sm">
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
          onClick={() => void loadTickers()}
          disabled={loading}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
        {isDefaultPath && (
          <button
            onClick={handleMarketCapUpdate}
            disabled={marketCapUpdating || loading}
            className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
            title="Pull market cap from Finnhub profile2 into company_profiles and refresh the default universe table"
          >
            <RefreshCw className={`w-3 h-3 ${marketCapUpdating ? "animate-spin" : ""}`} />
            {marketCapUpdating ? "Updating Market Cap..." : "Market Cap Update"}
          </button>
        )}
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

      {marketCapJob && marketCapJob.status === "running" && (
        <div className="mb-2 p-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded text-xs text-violet-700 dark:text-violet-300">
          <div className="flex items-center justify-between">
            <span>Market cap update running: {marketCapJob.progress.completed}/{marketCapJob.progress.total} ({marketCapJob.progress.pct}%)</span>
            <button
              onClick={() => setShowLog((v) => !v)}
              className="px-1.5 py-0.5 text-[10px] bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 rounded hover:bg-violet-300 dark:hover:bg-violet-700 flex items-center gap-0.5"
            >
              {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showLog ? "Hide Log" : "View Log"}
            </button>
          </div>
          {showLog && marketCapJob.logs.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 text-gray-200 rounded p-2 font-mono text-[10px] leading-tight">
              {marketCapJob.logs.slice(-100).map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

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

      <div className="flex items-center gap-2 mb-2">
        <Search className="w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Filter ticker, name, exchange, industry..."
        />
        <span className="text-xs text-gray-400">
          {filteredRows.length}/{rows.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            Loading...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            {rows.length === 0 ? "No tickers loaded" : "No matches"}
          </div>
        ) : (
          <table className="w-full text-xs table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left font-semibold px-3 py-2 w-24">Ticker</th>
                <th className="text-left font-semibold px-3 py-2">Name</th>
                <th className="text-left font-semibold px-3 py-2 w-28">Exchange</th>
                <th className="text-left font-semibold px-3 py-2 w-36">Industry</th>
                <th className="text-right font-semibold px-3 py-2 w-28">Market Cap</th>
                <th className="text-center font-semibold px-3 py-2 w-14">Del</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.ticker} className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-colors">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onTickerClick?.(row.ticker)}
                      className={`font-mono text-left text-blue-600 dark:text-blue-400 hover:underline ${removing === row.ticker ? "opacity-40" : ""}`}
                      title={row.ticker}
                      disabled={removing === row.ticker}
                    >
                      {row.ticker}
                    </button>
                  </td>
                  <td className="px-3 py-2 truncate text-gray-700 dark:text-gray-200" title={row.name ?? undefined}>{row.name ?? "-"}</td>
                  <td className="px-3 py-2 truncate text-gray-500 dark:text-gray-400" title={row.exchange ?? undefined}>{row.exchange ?? "-"}</td>
                  <td className="px-3 py-2 truncate text-gray-500 dark:text-gray-400" title={row.industry ?? undefined}>{row.industry ?? "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{formatMarketCap(row.marketCap)}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(row.ticker); }}
                      disabled={removing !== null}
                      className="inline-flex w-5 h-5 items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-500 text-gray-400"
                      title={`Remove ${row.ticker} from default universe`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}