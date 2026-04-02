import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, ExternalLink, RefreshCw, Search, Trash2, TrendingUp } from 'lucide-react';
import { getModel2CaseDescription } from '../model2CaseDescriptions';
import type { CaseDescriptionWindowData } from '../types';
import { getCompanyTickerDataAttrs } from '../companyDescription';

const API_BASE = '';

type SortBy = 'published_at' | 'ticker' | 'title' | 'publisher' | 'case_type' | 'reaction_tag' | 'impact_score';
type SortDir = 'asc' | 'desc';

interface AnalysisRun {
  id: string;
  page_id: string | null;
  title: string;
  note_title: string;
  source_type: string;
  source_name: string | null;
  since: string;
  until: string;
  total_rows: number;
  analyzable_rows: number;
  impacted_rows: number;
  meaningless_rows: number;
  created_at: string;
}

interface CaseSummary {
  caseType: string;
  caseLabelKo: string;
  topLevel: string;
  totalCount: number;
  impactedCount: number;
  latestPublishedAt: string | null;
}

interface EvidenceRow {
  id: number;
  analysisId: string;
  newsId: string;
  caseType: string;
  caseLabelKo: string;
  topLevel: string;
  reactionTag: string;
  isImpacted: boolean;
  ticker: string | null;
  marketCap: number | null;
  marketCapBucket: string | null;
  industry: string | null;
  ipoDate: string | null;
  overallImpactScore: number | null;
  summary: string | null;
  publishedAt: string;
  source: string;
  publisher: string | null;
  sourceType: string;
  title: string;
  body: string;
  url: string;
}

interface EvidenceResponse {
  total: number | null;
  totalMode?: 'cached' | 'deferred';
  items: EvidenceRow[];
}

function formatPublishedAtParts(value: string): { date: string; time: string } {
  if (!value) {
    return { date: '-', time: '-' };
  }
  const normalized = value.replace('T', ' ');
  const [datePart, timePart = ''] = normalized.split(' ');
  return {
    date: datePart || '-',
    time: timePart.slice(0, 5) || '-',
  };
}

function formatImpact(value: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return value.toFixed(2);
}

function topLevelBadgeClass(value: string): string {
  if (value === 'long') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (value === 'short') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function reactionTagClass(value: string): string {
  if (value === 'multi_window_impact' || value === 'sustained_repricing') return 'text-emerald-600 dark:text-emerald-400';
  if (value === 'intraday_only' || value === 'one_day_spike_then_fade') return 'text-amber-600 dark:text-amber-400';
  if (value === 'low_signal') return 'text-slate-500 dark:text-slate-400';
  return 'text-blue-600 dark:text-blue-400';
}

interface EvidenceTableWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function EvidenceTableWindow({ onTickerClick }: EvidenceTableWindowProps) {
  const [analyses, setAnalyses] = useState<AnalysisRun[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseType, setSelectedCaseType] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [ticker, setTicker] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [debouncedTicker, setDebouncedTicker] = useState('');
  const [debouncedFromDate, setDebouncedFromDate] = useState('');
  const [debouncedToDate, setDebouncedToDate] = useState('');
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalMode, setTotalMode] = useState<'cached' | 'deferred'>('cached');
  const [limit, setLimit] = useState(100);
  const [sortBy, setSortBy] = useState<SortBy>('published_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalysisMenuOpen, setIsAnalysisMenuOpen] = useState(false);
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const [analysisContextMenu, setAnalysisContextMenu] = useState<{ x: number; y: number; item: AnalysisRun } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: CaseSummary } | null>(null);
  const analysisMenuRef = useRef<HTMLDivElement | null>(null);
  const caseMenuRef = useRef<HTMLDivElement | null>(null);
  const analysisContextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const effectiveAnalysisId = selectedAnalysisId || analyses[0]?.id || '';

  const selectedAnalysis = useMemo(
    () => analyses.find(item => item.id === effectiveAnalysisId) ?? null,
    [analyses, effectiveAnalysisId],
  );
  const selectedCase = useMemo(
    () => cases.find(item => item.caseType === selectedCaseType) ?? null,
    [cases, selectedCaseType],
  );
  const selectedAnalysisLabel = useMemo(() => {
    if (!selectedAnalysis) {
      return null;
    }
    return {
      title: selectedAnalysis.title,
      dateRange: `${selectedAnalysis.since} - ${selectedAnalysis.until}`,
    };
  }, [selectedAnalysis]);
  const activeDateRangeLabel = useMemo(() => {
    if (!debouncedFromDate && !debouncedToDate) {
      return null;
    }
    return `${debouncedFromDate || '...'} -> ${debouncedToDate || '...'}`;
  }, [debouncedFromDate, debouncedToDate]);
  const allCasesTotal = useMemo(() => cases.reduce((sum, item) => sum + item.totalCount, 0), [cases]);
  const hasActiveEvidenceFilters = useMemo(
    () => Boolean(selectedCaseType !== 'all' || debouncedKeyword || debouncedTicker || debouncedFromDate || debouncedToDate),
    [selectedCaseType, debouncedFromDate, debouncedKeyword, debouncedTicker, debouncedToDate],
  );

  const fetchAnalyses = useCallback(async (): Promise<AnalysisRun[]> => {
    const res = await fetch(`${API_BASE}/api/model2/analyses`);
    if (!res.ok) {
      throw new Error(`Failed to load analyses (HTTP ${res.status})`);
    }
    const data: AnalysisRun[] = await res.json();
    setAnalyses(data);
    setError(null);
    if (data.length > 0 && (!selectedAnalysisId || !data.some(item => item.id === selectedAnalysisId))) {
      setSelectedAnalysisId(data[0].id);
      return;
    }
    if (data.length === 0) {
      setSelectedAnalysisId('');
    }
    return data;
  }, [selectedAnalysisId]);

  const fetchCases = useCallback(async (analysisId: string, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE}/api/model2/analyses/${analysisId}/cases`, { signal });
    if (!res.ok) {
      throw new Error(`Failed to load cases (HTTP ${res.status})`);
    }
    const data: CaseSummary[] = await res.json();
    setCases(data);
  }, []);

  const fetchEvidence = useCallback(async (
    analysisId: string,
    currentCaseType: string,
    currentKeyword: string,
    currentTicker: string,
    currentFromDate: string,
    currentToDate: string,
    currentSortBy: SortBy,
    currentSortDir: SortDir,
    currentLimit: number,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    if (currentCaseType && currentCaseType !== 'all') params.set('caseType', currentCaseType);
    if (currentKeyword.trim()) params.set('keyword', currentKeyword.trim());
    if (currentTicker.trim()) params.set('ticker', currentTicker.trim().toUpperCase());
    if (currentFromDate) params.set('fromDate', currentFromDate);
    if (currentToDate) params.set('toDate', currentToDate);
    params.set('sortBy', currentSortBy);
    params.set('sortDir', currentSortDir);
    params.set('limit', String(currentLimit));
    const res = await fetch(`${API_BASE}/api/model2/analyses/${analysisId}/evidence?${params.toString()}`, { signal });
    if (!res.ok) {
      throw new Error(`Failed to load evidence rows (HTTP ${res.status})`);
    }
    const data: EvidenceResponse = await res.json();
    setRows(data.items);
    setTotal(typeof data.total === 'number' ? data.total : null);
    setTotalMode(data.totalMode === 'deferred' ? 'deferred' : 'cached');
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await fetchAnalyses();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analyses');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchAnalyses]);

  useEffect(() => {
    if (analyses.length > 0 || !error?.startsWith('Failed to load analyses')) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void fetchAnalyses().catch(err => setError(err instanceof Error ? err.message : 'Failed to load analyses'));
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [analyses.length, error, fetchAnalyses]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedKeyword(keyword);
      setDebouncedTicker(ticker);
      setDebouncedFromDate(fromDate);
      setDebouncedToDate(toDate);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [keyword, ticker, fromDate, toDate]);

  useEffect(() => {
    if (!effectiveAnalysisId) {
      setCases([]);
      return;
    }
    setError(null);
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        await fetchCases(effectiveAnalysisId, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load evidence data');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [effectiveAnalysisId, fetchCases]);

  useEffect(() => {
    if (!effectiveAnalysisId) {
      setRows([]);
      setTotal(null);
      setTotalMode('cached');
      return;
    }
    setError(null);
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        await fetchEvidence(effectiveAnalysisId, selectedCaseType, debouncedKeyword, debouncedTicker, debouncedFromDate, debouncedToDate, sortBy, sortDir, limit, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load evidence data');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [effectiveAnalysisId, selectedCaseType, debouncedKeyword, debouncedTicker, debouncedFromDate, debouncedToDate, sortBy, sortDir, limit, fetchEvidence]);

  useEffect(() => {
    setSelectedCaseType('all');
  }, [effectiveAnalysisId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideAnalysisMenu = analysisMenuRef.current?.contains(target) ?? false;
      const clickedInsideCaseMenu = caseMenuRef.current?.contains(target) ?? false;
      const clickedInsideAnalysisContextMenu = analysisContextMenuRef.current?.contains(target) ?? false;
      const clickedInsideContextMenu = contextMenuRef.current?.contains(target) ?? false;
      if (!clickedInsideAnalysisMenu && !clickedInsideCaseMenu && !clickedInsideAnalysisContextMenu && !clickedInsideContextMenu) {
        setIsAnalysisMenuOpen(false);
        setIsCaseMenuOpen(false);
        setAnalysisContextMenu(null);
        setContextMenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAnalysisMenuOpen(false);
        setIsCaseMenuOpen(false);
        setAnalysisContextMenu(null);
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleDeleteAnalysis = useCallback(async (analysis: AnalysisRun) => {
    const confirmed = window.confirm(`Delete evidence version?\n\n${analysis.title}\n${analysis.since} -> ${analysis.until}`);
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/model2/analyses/${analysis.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Failed to delete analysis (HTTP ${res.status})`);
      }
      if (effectiveAnalysisId === analysis.id) {
        setSelectedAnalysisId('');
        setSelectedCaseType('all');
      }
      setIsAnalysisMenuOpen(false);
      setAnalysisContextMenu(null);
      const refreshedAnalyses = await fetchAnalyses();
      const nextAnalysisId = refreshedAnalyses.find(item => item.id === selectedAnalysisId)?.id
        ?? refreshedAnalyses[0]?.id
        ?? '';

      if (!nextAnalysisId) {
        setCases([]);
        setRows([]);
        setTotal(null);
        setTotalMode('cached');
        return;
      }

      setSelectedAnalysisId(nextAnalysisId);
      setSelectedCaseType('all');
      await Promise.all([
        fetchCases(nextAnalysisId),
        fetchEvidence(nextAnalysisId, 'all', debouncedKeyword, debouncedTicker, debouncedFromDate, debouncedToDate, sortBy, sortDir, limit),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete analysis');
    } finally {
      setLoading(false);
    }
  }, [
    debouncedFromDate,
    debouncedKeyword,
    debouncedTicker,
    debouncedToDate,
    effectiveAnalysisId,
    fetchAnalyses,
    fetchCases,
    fetchEvidence,
    limit,
    selectedAnalysisId,
    sortBy,
    sortDir,
  ]);

  const handleRefresh = useCallback(() => {
    if (!effectiveAnalysisId) {
      setError(null);
      void fetchAnalyses().catch(err => setError(err instanceof Error ? err.message : 'Failed to refresh analyses'));
      return;
    }
    setError(null);
    void (async () => {
      try {
        setLoading(true);
        await fetchAnalyses();
        await Promise.all([
          fetchCases(effectiveAnalysisId),
          fetchEvidence(effectiveAnalysisId, selectedCaseType, debouncedKeyword, debouncedTicker, debouncedFromDate, debouncedToDate, sortBy, sortDir, limit),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh evidence data');
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveAnalysisId, selectedCaseType, debouncedKeyword, debouncedTicker, debouncedFromDate, debouncedToDate, sortBy, sortDir, limit, fetchAnalyses, fetchCases, fetchEvidence]);

  const handleSort = (nextSortBy: SortBy) => {
    if (sortBy === nextSortBy) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir('desc');
  };

  const openDescriptionWindow = useCallback((item: CaseSummary) => {
    const description = getModel2CaseDescription(item.caseType);
    const payload: CaseDescriptionWindowData = {
      ...description,
      caseType: item.caseType,
      caseLabelKo: item.caseLabelKo,
      topLevel: item.topLevel,
    };
    window.dispatchEvent(new CustomEvent('open-case-description', { detail: payload }));
    setContextMenu(null);
    setIsCaseMenuOpen(false);
  }, []);

  const selectedCaseLabel = selectedCase
    ? `${selectedCase.caseLabelKo} (${selectedCase.totalCount.toLocaleString()})`
    : `All cases (${allCasesTotal.toLocaleString()})`;
  const rowsStatusLabel = total === null ? `Rows ${rows.length}` : `Rows ${rows.length}/${total.toLocaleString()}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(300px,1.5fr)_minmax(220px,1.1fr)_minmax(200px,1fr)_minmax(140px,0.8fr)_minmax(170px,0.9fr)_minmax(170px,0.9fr)_minmax(120px,0.7fr)_auto]">
          <div ref={analysisMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsAnalysisMenuOpen(prev => !prev)}
              className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <ChevronDown size={12} className="mt-0.5 shrink-0 text-slate-400" />
              {selectedAnalysisLabel ? (
                <span className="min-w-0 text-left leading-4">
                  <span className="block break-words whitespace-normal text-[12px] text-slate-900 dark:text-slate-100">{selectedAnalysisLabel.title}</span>
                  <span className="mt-1 block text-[10px] text-slate-400">{selectedAnalysisLabel.dateRange}</span>
                </span>
              ) : (
                <span className="text-left text-[12px] text-slate-500 dark:text-slate-400">No analyses</span>
              )}
            </button>

            {isAnalysisMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {analyses.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400">No analyses</div>
                )}
                {analyses.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full items-start justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${effectiveAnalysisId === item.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                    onClick={() => {
                      setSelectedAnalysisId(item.id);
                      setIsAnalysisMenuOpen(false);
                    }}
                    onContextMenu={event => {
                      event.preventDefault();
                      setAnalysisContextMenu({ x: event.clientX, y: event.clientY, item });
                    }}
                    title="Right click for delete"
                  >
                    <span className="min-w-0 pr-3">
                      <span className="block break-words whitespace-normal leading-4">{item.title}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">{item.since} - {item.until}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{item.created_at.slice(0, 16).replace('T', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={caseMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsCaseMenuOpen(prev => !prev)}
              disabled={!selectedAnalysisId}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ChevronDown size={12} className="text-slate-400" />
              <span className="truncate text-left">{selectedCaseLabel}</span>
            </button>

            {isCaseMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedCaseType === 'all' ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                  onClick={() => {
                    setSelectedCaseType('all');
                    setIsCaseMenuOpen(false);
                  }}
                >
                  <span>All cases</span>
                  <span className="text-slate-400">{allCasesTotal.toLocaleString()}</span>
                </button>
                {cases.map(item => (
                  <button
                    key={item.caseType}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedCaseType === item.caseType ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                    onClick={() => {
                      setSelectedCaseType(item.caseType);
                      setIsCaseMenuOpen(false);
                    }}
                    onContextMenu={event => {
                      event.preventDefault();
                      setContextMenu({ x: event.clientX, y: event.clientY, item });
                    }}
                    title="Right click for description"
                  >
                    <span className="truncate">{item.caseLabelKo}</span>
                    <span className="ml-3 shrink-0 text-slate-400">{item.totalCount.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <Search size={12} className="text-slate-400" />
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Keyword search" className="w-full bg-transparent outline-none" />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <TrendingUp size={12} className="text-slate-400" />
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="Ticker" className="w-full bg-transparent outline-none" />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <CalendarRange size={12} className="text-slate-400" />
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
              className="w-full bg-transparent outline-none"
              aria-label="From date"
              title="From date"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <CalendarRange size={12} className="text-slate-400" />
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
              className="w-full bg-transparent outline-none"
              aria-label="To date"
              title="To date"
            />
          </label>

          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <select value={limit} onChange={e => setLimit(parseInt(e.target.value, 10))} className="w-full bg-transparent outline-none">
              <option value={100}>100 rows</option>
              <option value={300}>300 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1000 rows</option>
            </select>
          </label>

          <button onClick={handleRefresh} className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:text-blue-400" title="Refresh evidence data">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{selectedAnalysis ? `${selectedAnalysis.since} → ${selectedAnalysis.until}` : 'No analysis selected'}</span>
          <span>{rowsStatusLabel}</span>
          {total === null && hasActiveEvidenceFilters && <span>Filtered total is deferred for faster loading.</span>}
          {total !== null && totalMode === 'cached' && <span>Count shown from cached summaries.</span>}
          {activeDateRangeLabel && <span>{`Date filter ${activeDateRangeLabel}`}</span>}
          {selectedAnalysis && <span>{`Analyzable ${selectedAnalysis.analyzable_rows.toLocaleString()} / Impacted ${selectedAnalysis.impacted_rows.toLocaleString()} / 잡것들 ${selectedAnalysis.meaningless_rows.toLocaleString()}`}</span>}
          <span>Case menu item 우클릭 후 description 버튼으로 분류 기준 설명 창을 열 수 있습니다.</span>
          {error && <span className="text-red-500">{error}</span>}
          {!error && analyses.length === 0 && !loading && <span>No saved analyses found.</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Time</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('ticker')}>Ticker</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('case_type')}>Case</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('title')}>Title / Summary</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('publisher')}>Publisher</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('reaction_tag')}>Reaction</th>
              <th className="px-3 py-2 text-left font-semibold cursor-pointer" onClick={() => handleSort('impact_score')}>Impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const published = formatPublishedAtParts(item.publishedAt);
              return (
                <tr key={item.id} className="border-b border-slate-200 align-top hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{published.date}</td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{published.time}</td>
                  <td className="px-3 py-3 font-semibold text-blue-600 dark:text-blue-400">
                    {item.ticker ? (
                      <button
                        type="button"
                        onClick={() => onTickerClick?.(item.ticker ?? '')}
                        {...getCompanyTickerDataAttrs(item.ticker)}
                        className="hover:underline"
                      >
                        {item.ticker}
                      </button>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${topLevelBadgeClass(item.topLevel)}`}>{item.topLevel}</span>
                      <span className="text-slate-700 dark:text-slate-200">{item.caseLabelKo}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 min-w-[420px]">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Open article"
                      >
                        <ExternalLink size={12} />
                      </button>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{item.title}</div>
                        <div className="mt-1 line-clamp-3 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{item.summary || item.body || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                    <div>{item.publisher || item.source || '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{item.sourceType}</div>
                  </td>
                  <td className={`px-3 py-3 font-medium ${reactionTagClass(item.reactionTag)}`}>{item.reactionTag}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatImpact(item.overallImpactScore)}</div>
                    <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{item.marketCapBucket || '-'}</div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No evidence rows found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {analysisContextMenu && (
        <div
          ref={analysisContextMenuRef}
          className="fixed z-40 min-w-[220px] rounded-lg border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ top: analysisContextMenu.y, left: analysisContextMenu.x }}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => void handleDeleteAnalysis(analysisContextMenu.item)}
          >
            <span className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 size={12} />
              delete
            </span>
            <span className="ml-3 truncate text-slate-400">{analysisContextMenu.item.title}</span>
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-40 min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => openDescriptionWindow(contextMenu.item)}
          >
            <span>description</span>
            <span className="text-slate-400">{contextMenu.item.caseLabelKo}</span>
          </button>
        </div>
      )}
    </div>
  );
}