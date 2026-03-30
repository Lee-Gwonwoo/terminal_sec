import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownAZ, ArrowUpAZ, Calendar, Filter, RefreshCw } from "lucide-react";

const API_BASE = "";
const STORAGE_KEY = "daily-change-history-ui-state";

interface DailyChangeHistoryWindowProps {
  onTickerClick?: (ticker: string) => void;
}

interface DailyChangeHistoryRow {
  ticker: string;
  exchange: string | null;
  name: string | null;
  industry: string | null;
  date: string;
  close: number | null;
  dailyChangePct: number | null;
  closeFromOpenPct: number | null;
  turnover: number | null;
  marketCap: number | null;
  marketCapSource: string | null;
  hasOhlcData: boolean;
}

interface DailyChangeHistoryResponse {
  selectedDate: string | null;
  defaultDate: string | null;
  availableMaxDate: string | null;
  marketCapFilter: {
    min: number | null;
    max: number | null;
  };
  turnoverFilter: {
    min: number | null;
    max: number | null;
  };
  summary: {
    total: number;
    dailyChange: {
      gainers: number;
      losers: number;
      flat: number;
      missing: number;
    };
    closeFromOpen: {
      gainers: number;
      losers: number;
      flat: number;
      missing: number;
    };
  };
  rows: DailyChangeHistoryRow[];
}

interface JobStatusResponse {
  status: "running" | "done" | "failed" | "cancelled";
  progress: { completed: number; total: number; pct: number };
  error?: string;
}

interface CustomChangePreflightResponse {
  requestedRange: { from: string; to: string };
  totalRowsInRange: number;
  rowsWithChangePct: number;
  rowsExpectedToUpdate: number;
}

type ChangeActionKey = "recent" | "recentMissing";

type ChangeActionState = {
  jobId: string;
  label: string;
  status: "running" | "done" | "failed" | "cancelled";
  message: string;
} | null;

type FilterDraft = {
  selectedDate: string;
  marketCapMin: string;
  marketCapMax: string;
  turnoverMin: string;
  turnoverMax: string;
};

type CustomRangeDraft = {
  from: string;
  to: string;
};

type VisibleColumnKey = "name" | "date" | "close" | "closeFromOpenPct" | "turnover" | "marketCap" | "industry";
type SortKey = "ticker" | "name" | "date" | "close" | "dailyChangePct" | "closeFromOpenPct" | "turnover" | "marketCap" | "industry";
type SortDirection = "asc" | "desc";

type StoredState = FilterDraft & {
  visibleColumns: Record<VisibleColumnKey, boolean>;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

const DEFAULT_VISIBLE_COLUMNS: Record<VisibleColumnKey, boolean> = {
  name: true,
  date: true,
  close: true,
  closeFromOpenPct: true,
  turnover: false,
  marketCap: true,
  industry: true,
};

const DEFAULT_STORED_STATE: StoredState = {
  selectedDate: "",
  marketCapMin: "",
  marketCapMax: "",
  turnoverMin: "",
  turnoverMax: "",
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  sortKey: "dailyChangePct",
  sortDirection: "desc",
};

function readStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STORED_STATE;
    }
    const parsed = JSON.parse(raw);
    return {
      selectedDate: typeof parsed.selectedDate === "string" ? parsed.selectedDate : "",
      marketCapMin: typeof parsed.marketCapMin === "string" ? parsed.marketCapMin : "",
      marketCapMax: typeof parsed.marketCapMax === "string" ? parsed.marketCapMax : "",
      turnoverMin: typeof parsed.turnoverMin === "string" ? parsed.turnoverMin : "",
      turnoverMax: typeof parsed.turnoverMax === "string" ? parsed.turnoverMax : "",
      visibleColumns: {
        ...DEFAULT_VISIBLE_COLUMNS,
        ...(parsed.visibleColumns ?? {}),
      },
      sortKey: typeof parsed.sortKey === "string" ? parsed.sortKey : "dailyChangePct",
      sortDirection: parsed.sortDirection === "asc" ? "asc" : "desc",
    };
  } catch {
    return DEFAULT_STORED_STATE;
  }
}

function formatMarketCap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function formatTurnover(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function buildQueryString(filter: FilterDraft): string {
  const params = new URLSearchParams();
  if (filter.selectedDate) {
    params.set("date", filter.selectedDate);
  }
  if (filter.marketCapMin.trim()) {
    params.set("marketCapMin", filter.marketCapMin.trim());
  }
  if (filter.marketCapMax.trim()) {
    params.set("marketCapMax", filter.marketCapMax.trim());
  }
  if (filter.turnoverMin.trim()) {
    params.set("turnoverMin", filter.turnoverMin.trim());
  }
  if (filter.turnoverMax.trim()) {
    params.set("turnoverMax", filter.turnoverMax.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

function compareNullableStrings(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

function sortRows(rows: DailyChangeHistoryRow[], sortKey: SortKey, sortDirection: SortDirection): DailyChangeHistoryRow[] {
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    let comparison = 0;
    switch (sortKey) {
      case "ticker":
        comparison = left.ticker.localeCompare(right.ticker);
        break;
      case "name":
        comparison = compareNullableStrings(left.name, right.name);
        break;
      case "date":
        comparison = compareNullableStrings(left.date, right.date);
        break;
      case "close":
        comparison = compareNullableNumbers(left.close, right.close);
        break;
      case "dailyChangePct":
        comparison = compareNullableNumbers(left.dailyChangePct, right.dailyChangePct);
        break;
      case "closeFromOpenPct":
        comparison = compareNullableNumbers(left.closeFromOpenPct, right.closeFromOpenPct);
        break;
      case "turnover":
        comparison = compareNullableNumbers(left.turnover, right.turnover);
        break;
      case "marketCap":
        comparison = compareNullableNumbers(left.marketCap, right.marketCap);
        break;
      case "industry":
        comparison = compareNullableStrings(left.industry, right.industry);
        break;
    }

    if (comparison !== 0) {
      return comparison * direction;
    }
    return left.ticker.localeCompare(right.ticker);
  });
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SummaryMetricSection({
  title,
  counts,
  total,
}: {
  title: string;
  counts: { gainers: number; losers: number; flat: number; missing: number };
  total: number;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-4 dark:border-slate-800">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Summary</div>
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Gainers" value={counts.gainers} tone="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300" />
        <SummaryCard label="Losers" value={counts.losers} tone="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300" />
        <SummaryCard label="Flat" value={counts.flat} tone="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300" />
        <SummaryCard label="Missing" value={counts.missing} tone="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300" />
        <SummaryCard label="Total" value={total} tone="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300" />
      </div>
    </div>
  );
}

function readStoredNumberInRange(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    if (value < min || value > max) {
      return fallback;
    }
    return value;
  } catch {
    return fallback;
  }
}

function getStoredChangeUpdateOptions(): { fmpConcurrency: number; fmpRequestIntervalMs: number } {
  return {
    fmpConcurrency: readStoredNumberInRange("change-fmp-concurrency", 5, 1, 20),
    fmpRequestIntervalMs: readStoredNumberInRange("fmp-request-interval-ms", 250, 0, 5000),
  };
}

function extractErrorMessage(payload: any, status: number): string {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (Array.isArray(payload?.error) && payload.error.length > 0) {
    const firstIssue = payload.error[0];
    if (typeof firstIssue?.message === "string" && firstIssue.message.trim()) {
      const path = Array.isArray(firstIssue?.path) && firstIssue.path.length > 0
        ? `${String(firstIssue.path[0])}: `
        : "";
      return `${path}${firstIssue.message}`;
    }
    return JSON.stringify(payload.error);
  }

  return `HTTP ${status}`;
}

export function DailyChangeHistoryWindow({ onTickerClick }: DailyChangeHistoryWindowProps) {
  const [draftFilter, setDraftFilter] = useState<FilterDraft>(() => readStoredState());
  const [appliedFilter, setAppliedFilter] = useState<FilterDraft>(() => readStoredState());
  const [visibleColumns, setVisibleColumns] = useState<Record<VisibleColumnKey, boolean>>(() => readStoredState().visibleColumns);
  const [sortKey, setSortKey] = useState<SortKey>(() => readStoredState().sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => readStoredState().sortDirection);
  const [data, setData] = useState<DailyChangeHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeAction, setChangeAction] = useState<ChangeActionState>(null);
  const [showCustomChangeModal, setShowCustomChangeModal] = useState(false);
  const [customRangeDraft, setCustomRangeDraft] = useState<CustomRangeDraft>({ from: "", to: "" });
  const [customPreflight, setCustomPreflight] = useState<CustomChangePreflightResponse | null>(null);
  const [customModalLoading, setCustomModalLoading] = useState(false);
  const [customModalError, setCustomModalError] = useState<string | null>(null);

  const loadHistory = useCallback(async (nextFilter: FilterDraft) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/default-tickers/daily-change-history${buildQueryString(nextFilter)}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`);
        return;
      }

      const normalizedFilter: FilterDraft = {
        selectedDate: payload.selectedDate ?? nextFilter.selectedDate ?? "",
        marketCapMin: nextFilter.marketCapMin.trim(),
        marketCapMax: nextFilter.marketCapMax.trim(),
        turnoverMin: nextFilter.turnoverMin.trim(),
        turnoverMax: nextFilter.turnoverMax.trim(),
      };
      setData(payload);
      setAppliedFilter(normalizedFilter);
      setDraftFilter((current) => ({
        selectedDate: current.selectedDate || normalizedFilter.selectedDate,
        marketCapMin: current.marketCapMin,
        marketCapMax: current.marketCapMax,
        turnoverMin: current.turnoverMin,
        turnoverMax: current.turnoverMax,
      }));
    } catch (fetchError: any) {
      setError(fetchError?.message || "Failed to load daily change history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(readStoredState());
  }, [loadHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...appliedFilter,
          visibleColumns,
          sortKey,
          sortDirection,
        }),
      );
    } catch {
      // Ignore storage quota errors.
    }
  }, [appliedFilter, sortDirection, sortKey, visibleColumns]);

  useEffect(() => {
    if (!changeAction?.jobId || changeAction.status !== "running") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/jobs/${changeAction.jobId}`);
        const payload = await response.json() as JobStatusResponse;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (payload.status === "running") {
          setChangeAction((current) => current && current.jobId === changeAction.jobId
            ? {
                ...current,
                status: "running",
                message: `${current.label}: ${payload.progress.completed}/${payload.progress.total || 0}`,
              }
            : current);
          return;
        }

        window.clearInterval(timer);
        const nextMessage = payload.status === "done"
          ? `${changeAction.label}: completed`
          : payload.status === "failed"
            ? `${changeAction.label}: failed${payload.error ? ` - ${payload.error}` : ""}`
            : `${changeAction.label}: cancelled`;
        setChangeAction((current) => current && current.jobId === changeAction.jobId
          ? { ...current, status: payload.status, message: nextMessage }
          : current);
        if (payload.status === "done") {
          void loadHistory(appliedFilter);
        }
      } catch (pollError: any) {
        window.clearInterval(timer);
        setChangeAction((current) => current && current.jobId === changeAction.jobId
          ? { ...current, status: "failed", message: `${current.label}: failed - ${pollError?.message || "job poll error"}` }
          : current);
      }
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [appliedFilter, changeAction, loadHistory]);

  const appliedFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (data?.selectedDate) {
      parts.push(`Date ${data.selectedDate}`);
    }
    if (appliedFilter.marketCapMin.trim() || appliedFilter.marketCapMax.trim()) {
      parts.push(
        `Market Cap ${appliedFilter.marketCapMin.trim() || "-"} ~ ${appliedFilter.marketCapMax.trim() || "-"}`,
      );
    }
    if (appliedFilter.turnoverMin.trim() || appliedFilter.turnoverMax.trim()) {
      parts.push(
        `Turnover ${appliedFilter.turnoverMin.trim() || "-"} ~ ${appliedFilter.turnoverMax.trim() || "-"}`,
      );
    }
    return parts.join(" | ");
  }, [appliedFilter.marketCapMax, appliedFilter.marketCapMin, appliedFilter.turnoverMax, appliedFilter.turnoverMin, data?.selectedDate]);

  const sortedRows = useMemo(() => sortRows(data?.rows ?? [], sortKey, sortDirection), [data?.rows, sortDirection, sortKey]);

  const toggleColumn = (column: VisibleColumnKey) => {
    setVisibleColumns((current) => ({ ...current, [column]: !current[column] }));
  };

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "ticker" || nextSortKey === "name" || nextSortKey === "industry" || nextSortKey === "date" ? "asc" : "desc");
  };

  const handleApply = async () => {
    await loadHistory(draftFilter);
  };

  const handleReset = async () => {
    const cleared = { selectedDate: "", marketCapMin: "", marketCapMax: "", turnoverMin: "", turnoverMax: "" };
    setDraftFilter(cleared);
    await loadHistory(cleared);
  };

  const handleChangeUpdate = async (action: ChangeActionKey) => {
    const label = action === "recent"
      ? "Recent Change Update"
      : "FMP Recent Missing Change Fill";
    const url = action === "recent"
      ? `${API_BASE}/api/news/change/update-recent`
      : `${API_BASE}/api/news/change/update-recent-fmp-missing`;
    const body = JSON.stringify(getStoredChangeUpdateOptions());

    setChangeAction({ jobId: "", label, status: "running", message: `${label}: starting...` });
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, response.status));
      }
      setChangeAction({
        jobId: String(payload.jobId),
        label,
        status: "running",
        message: `${label}: queued (${payload.jobId})`,
      });
    } catch (startError: any) {
      setChangeAction({
        jobId: "",
        label,
        status: "failed",
        message: `${label}: failed - ${startError?.message || "unable to start job"}`,
      });
    }
  };

  const openCustomChangeModal = () => {
    const seedDate = draftFilter.selectedDate || data?.selectedDate || data?.defaultDate || "";
    setCustomRangeDraft({ from: seedDate, to: seedDate });
    setCustomPreflight(null);
    setCustomModalError(null);
    setShowCustomChangeModal(true);
  };

  const runCustomPreflight = async () => {
    if (!customRangeDraft.from || !customRangeDraft.to) {
      setCustomModalError("From/To 날짜를 모두 선택해야 한다.");
      return;
    }
    setCustomModalLoading(true);
    setCustomModalError(null);
    setCustomPreflight(null);
    try {
      const options = getStoredChangeUpdateOptions();
      const response = await fetch(`${API_BASE}/api/news/change/update-custom/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: customRangeDraft.from,
          to: customRangeDraft.to,
          ...options,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, response.status));
      }
      setCustomPreflight(payload);
    } catch (preflightError: any) {
      setCustomModalError(preflightError?.message || "Failed to calculate custom range scope");
    } finally {
      setCustomModalLoading(false);
    }
  };

  const startCustomChangeUpdate = async () => {
    if (!customRangeDraft.from || !customRangeDraft.to) {
      setCustomModalError("From/To 날짜를 모두 선택해야 한다.");
      return;
    }
    const label = `Custom Change Update (${customRangeDraft.from} ~ ${customRangeDraft.to})`;
    setCustomModalLoading(true);
    setCustomModalError(null);
    setChangeAction({ jobId: "", label, status: "running", message: `${label}: starting...` });
    try {
      const options = getStoredChangeUpdateOptions();
      const response = await fetch(`${API_BASE}/api/news/change/update-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: customRangeDraft.from,
          to: customRangeDraft.to,
          ...options,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, response.status));
      }
      setChangeAction({
        jobId: String(payload.jobId),
        label,
        status: "running",
        message: `${label}: queued (${payload.jobId})`,
      });
      setShowCustomChangeModal(false);
    } catch (startError: any) {
      setChangeAction({
        jobId: "",
        label,
        status: "failed",
        message: `${label}: failed - ${startError?.message || "unable to start job"}`,
      });
      setCustomModalError(startError?.message || "Failed to start custom change update");
    } finally {
      setCustomModalLoading(false);
    }
  };

  const columnCount = 2
    + Number(visibleColumns.name)
    + Number(visibleColumns.date)
    + Number(visibleColumns.close)
    + Number(visibleColumns.closeFromOpenPct)
    + Number(visibleColumns.turnover)
    + Number(visibleColumns.marketCap)
    + Number(visibleColumns.industry);

  const renderSortLabel = (label: string, key: SortKey) => {
    const active = sortKey === key;
    return (
      <button
        onClick={() => handleSort(key)}
        className={`inline-flex items-center gap-1 ${active ? "text-slate-900 dark:text-slate-100" : "hover:text-slate-900 dark:hover:text-slate-100"}`}
      >
        <span>{label}</span>
        {active ? (
          sortDirection === "asc" ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-gray-900 dark:text-slate-100">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date</span>
            <input
              type="date"
              value={draftFilter.selectedDate}
              max={data?.availableMaxDate ?? undefined}
              onChange={(event) => setDraftFilter((current) => ({ ...current, selectedDate: event.target.value }))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Market Cap Min</span>
            <input
              type="text"
              value={draftFilter.marketCapMin}
              onChange={(event) => setDraftFilter((current) => ({ ...current, marketCapMin: event.target.value }))}
              placeholder="1B"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">예: 500M, 1B, 2.5B</span>
          </label>

          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Market Cap Max</span>
            <input
              type="text"
              value={draftFilter.marketCapMax}
              onChange={(event) => setDraftFilter((current) => ({ ...current, marketCapMax: event.target.value }))}
              placeholder="50B"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">예: 10B, 50B</span>
          </label>

          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Turnover Min</span>
            <input
              type="text"
              value={draftFilter.turnoverMin}
              onChange={(event) => setDraftFilter((current) => ({ ...current, turnoverMin: event.target.value }))}
              placeholder="100M"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">예: 50M, 100M, 1B</span>
          </label>

          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Turnover Max</span>
            <input
              type="text"
              value={draftFilter.turnoverMax}
              onChange={(event) => setDraftFilter((current) => ({ ...current, turnoverMax: event.target.value }))}
              placeholder="5B"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">예: 500M, 5B</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => void handleApply()}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Apply
            </button>
            <button
              onClick={() => void handleReset()}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Reset
            </button>
            <button
              onClick={() => void loadHistory(appliedFilter)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleChangeUpdate("recent")}
            disabled={changeAction?.status === "running"}
            className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            Recent Change Update
          </button>
          <button
            onClick={() => void handleChangeUpdate("recentMissing")}
            disabled={changeAction?.status === "running"}
            className="rounded-md border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-900/60 dark:text-sky-300 dark:hover:bg-sky-950/40"
          >
            FMP Missing Change Fill
          </button>
          <button
            onClick={openCustomChangeModal}
            disabled={changeAction?.status === "running"}
            className="rounded-md border border-violet-300 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-900/60 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            Custom Change Update
          </button>
          {changeAction ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">{changeAction.message}</div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500">Change update buttons reuse the same backend jobs as Data Control. Custom opens a date-range popup with preflight.</div>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {appliedFilterSummary || "Most recent stable OHLC date is applied automatically when date is empty."}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Columns</span>
          {([
            ["name", "Name"],
            ["date", "Date"],
            ["close", "Close"],
            ["closeFromOpenPct", "Close From Open %"],
            ["turnover", "Turnover"],
            ["marketCap", "Market Cap"],
            ["industry", "Industry"],
          ] as Array<[VisibleColumnKey, string]>).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 dark:border-slate-700">
              <input
                type="checkbox"
                checked={visibleColumns[key]}
                onChange={() => toggleColumn(key)}
                className="h-3.5 w-3.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-b border-slate-200 px-4 py-3 xl:grid-cols-2 dark:border-slate-800">
        <SummaryMetricSection
          title="Daily Change %"
          counts={data?.summary.dailyChange ?? { gainers: 0, losers: 0, flat: 0, missing: 0 }}
          total={data?.summary.total ?? 0}
        />
        <SummaryMetricSection
          title="Close From Open %"
          counts={data?.summary.closeFromOpen ?? { gainers: 0, losers: 0, flat: 0, missing: 0 }}
          total={data?.summary.total ?? 0}
        />
      </div>

      {error ? (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="h-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3 text-left">{renderSortLabel("Ticker", "ticker")}</th>
                {visibleColumns.name ? <th className="px-3 py-3 text-left">{renderSortLabel("Name", "name")}</th> : null}
                {visibleColumns.date ? <th className="px-3 py-3 text-left">{renderSortLabel("Date", "date")}</th> : null}
                {visibleColumns.close ? <th className="px-3 py-3 text-right">{renderSortLabel("Close", "close")}</th> : null}
                <th className="px-3 py-3 text-right">{renderSortLabel("Daily Change %", "dailyChangePct")}</th>
                {visibleColumns.closeFromOpenPct ? <th className="px-3 py-3 text-right">{renderSortLabel("Close From Open %", "closeFromOpenPct")}</th> : null}
                {visibleColumns.turnover ? <th className="px-3 py-3 text-right">{renderSortLabel("Turnover", "turnover")}</th> : null}
                {visibleColumns.marketCap ? <th className="px-3 py-3 text-right">{renderSortLabel("Market Cap", "marketCap")}</th> : null}
                {visibleColumns.industry ? <th className="px-3 py-3 text-left">{renderSortLabel("Industry", "industry")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Loading daily change history...</td>
                </tr>
              ) : null}

              {!loading && (data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    해당 조건에 맞는 ticker가 없음
                  </td>
                </tr>
              ) : null}

              {sortedRows.map((row) => {
                const isMissing = row.dailyChangePct == null;
                const pctTone = isMissing
                  ? "text-amber-600 dark:text-amber-300"
                  : row.dailyChangePct > 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : row.dailyChangePct < 0
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-slate-700 dark:text-slate-200";
                const closeFromOpenTone = row.closeFromOpenPct == null
                  ? "text-amber-600 dark:text-amber-300"
                  : row.closeFromOpenPct > 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : row.closeFromOpenPct < 0
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-slate-700 dark:text-slate-200";
                return (
                  <tr key={`${row.ticker}-${row.date}`} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2 font-mono">
                      <button
                        onClick={() => onTickerClick?.(row.ticker)}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.ticker}
                      </button>
                    </td>
                    {visibleColumns.name ? <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.name ?? "-"}</td> : null}
                    {visibleColumns.date ? <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.date}</td> : null}
                    {visibleColumns.close ? <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatPrice(row.close)}</td> : null}
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${pctTone}`}>{formatPct(row.dailyChangePct)}</td>
                    {visibleColumns.closeFromOpenPct ? <td className={`px-3 py-2 text-right tabular-nums font-medium ${closeFromOpenTone}`}>{formatPct(row.closeFromOpenPct)}</td> : null}
                    {visibleColumns.turnover ? <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatTurnover(row.turnover)}</td> : null}
                    {visibleColumns.marketCap ? (
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {formatMarketCap(row.marketCap)}
                      </td>
                    ) : null}
                    {visibleColumns.industry ? (
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {row.industry ?? (isMissing ? "Missing OHLC row" : "-")}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCustomChangeModal ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Custom Change Update</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">기간을 직접 선택한 뒤 preflight로 대상 row 수를 계산하고 실행한다.</div>
              </div>
              <button
                onClick={() => {
                  if (!customModalLoading) {
                    setShowCustomChangeModal(false);
                    setCustomModalError(null);
                  }
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>From</span>
                <input
                  type="date"
                  value={customRangeDraft.from}
                  max={data?.availableMaxDate ?? undefined}
                  onChange={(event) => setCustomRangeDraft((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>To</span>
                <input
                  type="date"
                  value={customRangeDraft.to}
                  max={data?.availableMaxDate ?? undefined}
                  onChange={(event) => setCustomRangeDraft((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void runCustomPreflight()}
                disabled={customModalLoading}
                className="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                {customModalLoading ? "Calculating..." : "Calculate Scope"}
              </button>
              <button
                onClick={() => void startCustomChangeUpdate()}
                disabled={customModalLoading || !customPreflight}
                className="rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Custom Update
              </button>
            </div>

            {customModalError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {customModalError}
              </div>
            ) : null}

            {customPreflight ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Preflight</div>
                <div className="mt-2">Range: {customPreflight.requestedRange.from} ~ {customPreflight.requestedRange.to}</div>
                <div className="mt-1">Total rows in range: {customPreflight.totalRowsInRange}</div>
                <div className="mt-1">Rows with existing change_pct: {customPreflight.rowsWithChangePct}</div>
                <div className="mt-1">Rows expected to update: {customPreflight.rowsExpectedToUpdate}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}