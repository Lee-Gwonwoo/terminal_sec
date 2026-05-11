import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, Plus, RefreshCw, Search, Settings2, X } from "lucide-react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { getCompanyTickerDataAttrs } from "../companyDescription";

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
  addedAt: string | null;
  ipoDate: string | null;
  marketCap: number | null;
  floatPct: number | null;
  institutionalPct: number | null;
  marketCapSource: string | null;
  floatSource: string | null;
  institutionalSource: string | null;
  insiderPct: number | null;
  insiderSource: string | null;
}

interface JobStatus {
  status: "running" | "done" | "failed" | "cancelled";
  progress: { completed: number; total: number; pct: number };
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
}

const ROW_HEIGHT = 37;
const HEADER_HEIGHT = 37;
const MIN_LIST_HEIGHT = 200;
const TICKER_COLUMN_TEMPLATE = "minmax(96px,0.9fr)";
const DELETE_COLUMN_TEMPLATE = "48px";
const COLUMN_VISIBILITY_STORAGE_KEY = "default-ticker-visible-columns-v1";

type SortKey = "ticker" | "name" | "exchange" | "industry" | "addedAt" | "ipoDate" | "marketCap" | "floatPct" | "institutionalPct" | "insiderPct";
type SortDirection = "asc" | "desc" | null;
type ConfigurableColumnKey = Exclude<SortKey, "ticker">;

interface ColumnDefinition {
  key: SortKey;
  label: string;
  template: string;
  align?: "left" | "right";
}

const CONFIGURABLE_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "name", label: "Name", template: "minmax(180px,1.7fr)" },
  { key: "exchange", label: "Exchange", template: "minmax(96px,0.8fr)" },
  { key: "industry", label: "Industry", template: "minmax(128px,1.1fr)" },
  { key: "addedAt", label: "Added Date", template: "minmax(96px,0.9fr)" },
  { key: "ipoDate", label: "IPO Date", template: "minmax(96px,0.8fr)" },
  { key: "marketCap", label: "Market Cap", template: "minmax(128px,1fr)", align: "right" },
  { key: "floatPct", label: "Float %", template: "minmax(96px,0.8fr)", align: "right" },
  { key: "institutionalPct", label: "Inst %", template: "minmax(96px,0.8fr)", align: "right" },
  { key: "insiderPct", label: "Insider %", template: "minmax(96px,0.8fr)", align: "right" },
];

const CONFIGURABLE_COLUMN_KEYS = CONFIGURABLE_COLUMN_DEFINITIONS.map((column) => column.key as ConfigurableColumnKey);
const DEFAULT_VISIBLE_COLUMN_KEYS: ConfigurableColumnKey[] = [...CONFIGURABLE_COLUMN_KEYS];

interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

interface TickerListRowData {
  rows: TickerRow[];
  visibleColumns: ColumnDefinition[];
  gridTemplateColumns: string;
  removing: string | null;
  onTickerClick?: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

function isConfigurableColumnKey(value: string): value is ConfigurableColumnKey {
  return CONFIGURABLE_COLUMN_KEYS.includes(value as ConfigurableColumnKey);
}

function readInitialVisibleColumnKeys(): ConfigurableColumnKey[] {
  try {
    const stored = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBLE_COLUMN_KEYS;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMN_KEYS;
    return parsed.filter((value): value is ConfigurableColumnKey => typeof value === "string" && isConfigurableColumnKey(value));
  } catch {
    return DEFAULT_VISIBLE_COLUMN_KEYS;
  }
}

function fallbackRowsFromTickers(tickers: string[] | undefined): TickerRow[] {
  return (tickers ?? []).map((ticker) => ({
    ticker,
    exchange: null,
    name: null,
    sector: null,
    industry: null,
    addedAt: null,
    ipoDate: null,
    marketCap: null,
    floatPct: null,
    institutionalPct: null,
    marketCapSource: null,
    floatSource: null,
    institutionalSource: null,
    insiderPct: null,
    insiderSource: null,
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
      addedAt: typeof row.addedAt === "string" && row.addedAt ? row.addedAt : null,
      ipoDate: typeof row.ipoDate === "string" && row.ipoDate ? row.ipoDate : null,
      marketCap: typeof row.marketCap === "number" ? row.marketCap : null,
      floatPct: typeof row.floatPct === "number" ? row.floatPct : null,
      institutionalPct: typeof row.institutionalPct === "number" ? row.institutionalPct : null,
      marketCapSource: typeof row.marketCapSource === "string" ? row.marketCapSource : null,
      floatSource: typeof row.floatSource === "string" ? row.floatSource : null,
      institutionalSource: typeof row.institutionalSource === "string" ? row.institutionalSource : null,
      insiderPct: typeof row.insiderPct === "number" ? row.insiderPct : null,
      insiderSource: typeof row.insiderSource === "string" ? row.insiderSource : null,
    }));
  }
  return fallbackRowsFromTickers(data?.tickers);
}

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${response.status} ${response.statusText || "unknown"})`);
  }
}

function formatMarketCap(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatAddedDate(value: string | null): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
}

function getSortValue(row: TickerRow, key: SortKey): string | number | null {
  switch (key) {
    case "ticker":
      return row.ticker;
    case "name":
      return row.name;
    case "exchange":
      return row.exchange;
    case "industry":
      return row.industry;
    case "addedAt":
      return row.addedAt;
    case "ipoDate":
      return row.ipoDate;
    case "marketCap":
      return row.marketCap;
    case "floatPct":
      return row.floatPct;
    case "institutionalPct":
      return row.institutionalPct;
    case "insiderPct":
      return row.insiderPct;
  }
}

function getSortLabel(sortState: SortState): string {
  if (!sortState.key || !sortState.direction) {
    return "기본 universe 순서";
  }

  const labels: Record<SortKey, string> = {
    ticker: "Ticker",
    ...Object.fromEntries(CONFIGURABLE_COLUMN_DEFINITIONS.map((column) => [column.key, column.label])),
  } as Record<SortKey, string>;

  return `${labels[sortState.key]} ${sortState.direction === "asc" ? "asc" : "desc"}`;
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const label = source.charAt(0).toUpperCase() + source.slice(1);
  const isFmp = source.toLowerCase() === "fmp";
  return (
    <span className={`ml-1 px-1 py-0 text-[9px] font-semibold rounded ${
      isFmp
        ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
        : "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400"
    }`}>
      {label}
    </span>
  );
}

function getJobSummary(kind: string, job: JobStatus): string {
  const updated = Number(job.result?.updated ?? 0);
  const total = Number(job.result?.total ?? job.progress.total ?? 0);
  const skippedRecent = Number(job.result?.skippedRecent ?? 0);
  const errors = Number(job.result?.errors ?? 0);

  if (job.status === "running") {
    return `${kind} update running: ${job.progress.completed}/${job.progress.total} (${job.progress.pct}%)`;
  }
  if (job.status === "done") {
    return `${kind} update done: updated ${updated}, errors ${errors}, skipped recent ${skippedRecent}, fetched ${total}`;
  }
  if (job.status === "failed") {
    return `${kind} update failed${job.error ? `: ${job.error}` : ""}`;
  }
  return `${kind} update cancelled`;
}

function renderColumnCell(row: TickerRow, column: ColumnDefinition): React.ReactNode {
  switch (column.key) {
    case "name":
      return row.name ?? "-";
    case "exchange":
      return row.exchange ?? "-";
    case "industry":
      return row.industry ?? "-";
    case "addedAt":
      return formatAddedDate(row.addedAt);
    case "ipoDate":
      return row.ipoDate ?? "-";
    case "marketCap":
      return <>{formatMarketCap(row.marketCap)}<SourceBadge source={row.marketCapSource} /></>;
    case "floatPct":
      return <>{formatPct(row.floatPct)}<SourceBadge source={row.floatSource} /></>;
    case "institutionalPct":
      return <>{formatPct(row.institutionalPct)}<SourceBadge source={row.institutionalSource} /></>;
    case "insiderPct":
      return <>{formatPct(row.insiderPct)}<SourceBadge source={row.insiderSource} /></>;
    case "ticker":
      return row.ticker;
  }
}

function getColumnTitle(row: TickerRow, column: ColumnDefinition): string | undefined {
  switch (column.key) {
    case "name":
      return row.name ?? undefined;
    case "exchange":
      return row.exchange ?? undefined;
    case "industry":
      return row.industry ?? undefined;
    case "addedAt":
      return row.addedAt ?? undefined;
    case "ipoDate":
      return row.ipoDate ?? undefined;
    default:
      return undefined;
  }
}

const TickerListRow = memo(function TickerListRow({ data, index, style }: ListChildComponentProps<TickerListRowData>) {
  const row = data.rows[index];
  return (
    <div
      style={style}
      className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-colors"
    >
      <div className="grid h-full items-center" style={{ gridTemplateColumns: data.gridTemplateColumns }}>
        <div className="px-3 py-2 min-w-0">
          <button
            onClick={() => data.onTickerClick?.(row.ticker)}
            {...getCompanyTickerDataAttrs(row.ticker)}
            className={`font-mono text-left text-blue-600 dark:text-blue-400 hover:underline ${data.removing === row.ticker ? "opacity-40" : ""}`}
            title={row.ticker}
            disabled={data.removing === row.ticker}
          >
            {row.ticker}
          </button>
        </div>
        {data.visibleColumns.map((column) => (
          <div
            key={column.key}
            className={column.align === "right"
              ? "px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap overflow-hidden"
              : `${column.key === "name" ? "text-gray-700 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"} px-3 py-2 truncate`}
            title={getColumnTitle(row, column)}
          >
            {renderColumnCell(row, column)}
          </div>
        ))}
        <div className="px-3 py-2 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onRemove(row.ticker);
            }}
            disabled={data.removing !== null}
            className="inline-flex w-5 h-5 items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-500 text-gray-400"
            title={`Remove ${row.ticker} from default universe`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

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
  const [floatUpdating, setFloatUpdating] = useState(false);
  const [floatJobId, setFloatJobId] = useState<string | null>(null);
  const [floatJob, setFloatJob] = useState<JobStatus | null>(null);
  const [showFloatLog, setShowFloatLog] = useState(false);
  const [yahooUpdating, setYahooUpdating] = useState(false);
  const [yahooJobId, setYahooJobId] = useState<string | null>(null);
  const [yahooJob, setYahooJob] = useState<JobStatus | null>(null);
  const [showYahooLog, setShowYahooLog] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [tickerFilterText, setTickerFilterText] = useState("");
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: null });
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<ConfigurableColumnKey[]>(readInitialVisibleColumnKeys);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [dataSource, setDataSource] = useState<"db" | "csv" | null>(null);
  const [listHeight, setListHeight] = useState(MIN_LIST_HEIGHT);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const trimmedCsvPath = csvPath.trim();
  const isDefaultPath = trimmedCsvPath === DEFAULT_CSV_PATH;
  const deferredFilterText = useDeferredValue(filterText);
  const deferredTickerFilterText = useDeferredValue(tickerFilterText);
  const visibleColumns = useMemo(() => {
    const visibleKeys = new Set(visibleColumnKeys);
    return CONFIGURABLE_COLUMN_DEFINITIONS.filter((column) => visibleKeys.has(column.key as ConfigurableColumnKey));
  }, [visibleColumnKeys]);
  const gridTemplateColumns = useMemo(
    () => [TICKER_COLUMN_TEMPLATE, ...visibleColumns.map((column) => column.template), DELETE_COLUMN_TEMPLATE].join(" "),
    [visibleColumns],
  );

  const loadTickers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const effectivePath = trimmedCsvPath || DEFAULT_CSV_PATH;
      const url = `${API_BASE}/api/tickers?csvPath=${encodeURIComponent(effectivePath)}`;
      const res = await fetch(url);
      const data = await readJsonResponse(res);
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

  useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  useEffect(() => {
    setSortState((current) => {
      if (!current.key || current.key === "ticker" || visibleColumnKeys.includes(current.key as ConfigurableColumnKey)) {
        return current;
      }
      return { key: null, direction: null };
    });
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (!showColumnPicker) return;
    const handleWindowMouseDown = (event: MouseEvent) => {
      if (!columnPickerRef.current?.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => window.removeEventListener("mousedown", handleWindowMouseDown);
  }, [showColumnPicker]);

  const handleColumnVisibilityToggle = useCallback((key: ConfigurableColumnKey) => {
    setVisibleColumnKeys((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      return CONFIGURABLE_COLUMN_KEYS.filter((columnKey) => nextSet.has(columnKey));
    });
  }, []);

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
      const data = await readJsonResponse(res);
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

  const handleRemove = useCallback(async (ticker: string) => {
    setRemoving(ticker);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickers/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvPath: trimmedCsvPath || DEFAULT_CSV_PATH, ticker }),
      });
      const data = await readJsonResponse(res);
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
  }, [isDefaultPath, trimmedCsvPath]);

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
      const data = await readJsonResponse(res);
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
      const data = await readJsonResponse(res);
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

  const handleFloatUpdate = async () => {
    if (!isDefaultPath || floatUpdating) return;
    setFloatUpdating(true);
    setError(null);
    setNotice(null);
    setFloatJob(null);
    try {
      const res = await fetch(`${API_BASE}/api/company-profiles/pull-float`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await readJsonResponse(res);
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setFloatUpdating(false);
        return;
      }
      setFloatJobId(data.jobId ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to start float update");
      setFloatUpdating(false);
    }
  };

  const handleYahooHoldersUpdate = async () => {
    if (!isDefaultPath || yahooUpdating) return;
    setYahooUpdating(true);
    setError(null);
    setNotice(null);
    setYahooJob(null);
    try {
      const res = await fetch(`${API_BASE}/api/company-profiles/pull-holders-yahoo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await readJsonResponse(res);
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setYahooUpdating(false);
        return;
      }
      setShowYahooLog(true);
      setYahooJobId(data.jobId ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to start Yahoo holders update");
      setYahooUpdating(false);
    }
  };

  const handleLostJob = useCallback(async (
    kind: "Market cap" | "Float" | "Yahoo holders",
    reset: () => void,
  ) => {
    reset();
    setError(null);
    setNotice(`${kind} update job tracking was lost after a backend restart. The update may have partially completed; table reloaded.`);
    await loadTickers();
  }, [loadTickers]);

  useEffect(() => {
    if (!marketCapJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${marketCapJobId}`);
        if (res.status === 404) {
          await handleLostJob("Market cap", () => {
            setMarketCapUpdating(false);
            setMarketCapJob(null);
            setMarketCapJobId(null);
          });
          return;
        }
        if (!res.ok) return;
        const data = await readJsonResponse(res);
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
  }, [handleLostJob, marketCapJobId, loadTickers]);

  useEffect(() => {
    if (!floatJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${floatJobId}`);
        if (res.status === 404) {
          await handleLostJob("Float", () => {
            setFloatUpdating(false);
            setFloatJob(null);
            setFloatJobId(null);
          });
          return;
        }
        if (!res.ok) return;
        const data = await readJsonResponse(res);
        if (cancelled) return;
        setFloatJob(data);
        if (data.status === "done") {
          setFloatUpdating(false);
          setNotice(`Float update completed. Updated ${data.result?.updated ?? 0} tickers.`);
          await loadTickers();
        } else if (data.status === "failed") {
          setFloatUpdating(false);
          setError(data.error || "Float update failed");
        } else if (data.status === "cancelled") {
          setFloatUpdating(false);
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
  }, [floatJobId, loadTickers]);

  useEffect(() => {
    if (!yahooJobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${yahooJobId}`);
        if (res.status === 404) {
          await handleLostJob("Yahoo holders", () => {
            setYahooUpdating(false);
            setYahooJob(null);
            setYahooJobId(null);
          });
          return;
        }
        if (!res.ok) return;
        const data = await readJsonResponse(res);
        if (cancelled) return;
        setYahooJob(data);
        if (data.status === "done") {
          setYahooUpdating(false);
          setNotice(`Yahoo holders update completed. Updated ${data.result?.updated ?? 0} tickers.`);
          await loadTickers();
        } else if (data.status === "failed") {
          setYahooUpdating(false);
          setError(data.error || "Yahoo holders update failed");
        } else if (data.status === "cancelled") {
          setYahooUpdating(false);
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
  }, [handleLostJob, yahooJobId, loadTickers]);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setListHeight(Math.max(container.clientHeight - HEADER_HEIGHT, MIN_LIST_HEIGHT));
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const filteredRows = useMemo(() => {
    const tickerNeedle = deferredTickerFilterText.trim().toUpperCase();
    const needle = deferredFilterText.trim().toUpperCase();
    if (!tickerNeedle && !needle) return rows;
    return rows.filter((row) =>
      (!tickerNeedle || row.ticker.includes(tickerNeedle))
      && (!needle
        || row.ticker.includes(needle)
        || (row.name ?? "").toUpperCase().includes(needle)
        || (row.industry ?? "").toUpperCase().includes(needle)
        || formatAddedDate(row.addedAt).toUpperCase().includes(needle)
        || (row.ipoDate ?? "").toUpperCase().includes(needle)
        || (row.exchange ?? "").toUpperCase().includes(needle)),
    );
  }, [rows, deferredFilterText, deferredTickerFilterText]);

  const displayedRows = useMemo(() => {
    if (!sortState.key || !sortState.direction) {
      return filteredRows;
    }

    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = getSortValue(left.row, sortState.key);
        const rightValue = getSortValue(right.row, sortState.key);

        if (leftValue == null && rightValue == null) {
          return left.index - right.index;
        }
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;

        let comparison = 0;
        if (typeof leftValue === "number" && typeof rightValue === "number") {
          comparison = leftValue - rightValue;
        } else {
          comparison = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" });
        }

        if (comparison !== 0) {
          return sortState.direction === "asc" ? comparison : -comparison;
        }

        return left.index - right.index;
      })
      .map(({ row }) => row);
  }, [filteredRows, sortState]);

  const handleHeaderSort = useCallback((key: SortKey) => {
    setSortState((current) => {
      if (current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key: null, direction: null };
    });
  }, []);

  const activeRecentAdded = sortState.key === "addedAt" && sortState.direction === "desc";

  const renderSortIcon = useCallback((key: SortKey) => {
    if (sortState.key !== key || !sortState.direction) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    }
    return sortState.direction === "asc"
      ? <ArrowUp className="w-3 h-3 text-blue-500" />
      : <ArrowDown className="w-3 h-3 text-blue-500" />;
  }, [sortState]);

  const listData = useMemo<TickerListRowData>(() => ({
    rows: displayedRows,
    visibleColumns,
    gridTemplateColumns,
    removing,
    onTickerClick,
    onRemove: (ticker: string) => {
      void handleRemove(ticker);
    },
  }), [displayedRows, visibleColumns, gridTemplateColumns, removing, onTickerClick, handleRemove]);

  const showMarketCapCard = marketCapJob !== null;
  const showFloatCard = floatJob !== null;
  const showYahooCard = yahooJob !== null;

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
          <>
            <button
              onClick={handleMarketCapUpdate}
              disabled={marketCapUpdating || loading}
              className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
              title="Pull market cap from FMP profile into company_profiles and refresh the default universe table"
            >
              <RefreshCw className={`w-3 h-3 ${marketCapUpdating ? "animate-spin" : ""}`} />
              {marketCapUpdating ? "Mkt Cap..." : "Mkt Cap"}
            </button>
            <button
              onClick={handleFloatUpdate}
              disabled={floatUpdating || loading}
              className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
              title="Pull float % from FMP shares-float endpoint"
            >
              <RefreshCw className={`w-3 h-3 ${floatUpdating ? "animate-spin" : ""}`} />
              {floatUpdating ? "Float..." : "Float"}
            </button>
            <button
              onClick={handleYahooHoldersUpdate}
              disabled={yahooUpdating || loading}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              title="Pull institutional + insider holders from Yahoo and refresh the default universe table"
            >
              <RefreshCw className={`w-3 h-3 ${yahooUpdating ? "animate-spin" : ""}`} />
              {yahooUpdating ? "Yahoo..." : "Yahoo Holders"}
            </button>
          </>
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

      {showMarketCapCard && marketCapJob && (
        <div className="mb-2 p-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded text-xs text-violet-700 dark:text-violet-300">
          <div className="flex items-center justify-between">
            <span>{getJobSummary("Market cap", marketCapJob)}</span>
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

      {showFloatCard && floatJob && (
        <div className="mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-300">
          <div className="flex items-center justify-between">
            <span>{getJobSummary("Float", floatJob)}</span>
            <button
              onClick={() => setShowFloatLog((v) => !v)}
              className="px-1.5 py-0.5 text-[10px] bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-300 dark:hover:bg-orange-700 flex items-center gap-0.5"
            >
              {showFloatLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showFloatLog ? "Hide Log" : "View Log"}
            </button>
          </div>
          {showFloatLog && floatJob.logs.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 text-gray-200 rounded p-2 font-mono text-[10px] leading-tight">
              {floatJob.logs.slice(-100).map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {showYahooCard && yahooJob && (
        <div className="mb-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded text-xs text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center justify-between">
            <span>{getJobSummary("Yahoo holders", yahooJob)}</span>
            <button
              onClick={() => setShowYahooLog((v) => !v)}
              className="px-1.5 py-0.5 text-[10px] bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-300 dark:hover:bg-indigo-700 flex items-center gap-0.5"
            >
              {showYahooLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showYahooLog ? "Hide Log" : "View Log"}
            </button>
          </div>
          {showYahooLog && yahooJob.logs.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 text-gray-200 rounded p-2 font-mono text-[10px] leading-tight">
              {yahooJob.logs.slice(-100).map((line, i) => (
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
        <input
          type="text"
          value={tickerFilterText}
          onChange={(e) => setTickerFilterText(e.target.value.toUpperCase())}
          className="w-40 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          placeholder="Ticker only"
        />
        <Search className="w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Filter ticker, name, exchange, industry, added date..."
        />
        <button
          type="button"
          onClick={() => setSortState(activeRecentAdded ? { key: null, direction: null } : { key: "addedAt", direction: "desc" })}
          className={`px-2 py-1 text-[11px] rounded border ${
            activeRecentAdded
              ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
          }`}
          title="Quick toggle between default universe order and recently added order"
        >
          {activeRecentAdded ? "Default Order" : "Recent Added"}
        </button>
        <div className="relative" ref={columnPickerRef}>
          <button
            type="button"
            onClick={() => setShowColumnPicker((value) => !value)}
            className={`px-2 py-1 text-[11px] rounded border flex items-center gap-1 ${
              showColumnPicker
                ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
            }`}
            title="Choose visible table columns"
          >
            <Settings2 className="w-3 h-3" />
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMN_KEYS)}
                  className="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleColumnKeys(["addedAt"])}
                  className="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60"
                >
                  Added Only
                </button>
              </div>
              <div className="space-y-1">
                {CONFIGURABLE_COLUMN_DEFINITIONS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60">
                    <input
                      type="checkbox"
                      checked={visibleColumnKeys.includes(column.key as ConfigurableColumnKey)}
                      onChange={() => handleColumnVisibilityToggle(column.key as ConfigurableColumnKey)}
                      className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {displayedRows.length}/{rows.length}
        </span>
      </div>

      <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
        정렬 기준: {getSortLabel(sortState)}
        {deferredTickerFilterText ? ` · ticker filter: ${deferredTickerFilterText}` : ""}
        {visibleColumnKeys.length !== DEFAULT_VISIBLE_COLUMN_KEYS.length ? ` · visible columns: ${visibleColumnKeys.length + 2}` : ""}
        {dataSource === "csv" && visibleColumnKeys.includes("addedAt") ? " · CSV-only 경로는 Added Date가 없어 '-'로 표시됩니다." : ""}
      </div>

      <div ref={listContainerRef} className="flex-1 overflow-hidden border border-gray-200 dark:border-gray-700 rounded">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            Loading...
          </div>
        ) : displayedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            {rows.length === 0 ? "No tickers loaded" : "No matches"}
          </div>
        ) : (
          <div className="h-full flex flex-col text-xs">
            <div
              className="grid sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
              style={{ gridTemplateColumns, height: HEADER_HEIGHT }}
            >
              <button type="button" onClick={() => handleHeaderSort("ticker")} className="flex items-center gap-1 px-3 py-2 font-semibold text-left hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors">Ticker {renderSortIcon("ticker")}</button>
              {visibleColumns.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => handleHeaderSort(column.key)}
                  className={`${column.align === "right" ? "justify-end text-right" : "text-left"} flex items-center gap-1 px-3 py-2 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors`}
                >
                  {column.label} {renderSortIcon(column.key)}
                </button>
              ))}
              <div className="text-center font-semibold px-3 py-2">Del</div>
            </div>
            <List
              height={listHeight}
              width="100%"
              itemCount={displayedRows.length}
              itemSize={ROW_HEIGHT}
              itemData={listData}
              overscanCount={12}
            >
              {TickerListRow}
            </List>
          </div>
        )}
      </div>
    </div>
  );
}