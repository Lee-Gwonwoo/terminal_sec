import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Eye, X, Square } from 'lucide-react';

const API_BASE = "";

interface UpdateStatusItem {
  lastSuccessAt: string | null;
  details?: Record<string, unknown>;
}

interface OhlcStatus {
  dbPath: string;
  overallMaxDate: string | null;
  lastSuccessAt: string | null;
}

interface JobStatus {
  status: 'running' | 'done' | 'failed' | 'cancelled';
  progress: { completed: number; total: number; pct: number };
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
}

type SectionKey = 'price' | 'calendarBackfill' | 'calendarRefresh' | 'calendarCustom' | 'companyDesc' | 'peersPull' | 'recent' | 'custom';

interface DataControlWindowProps {
  fontScale?: number;
  onFontScaleChange?: (n: number) => void;
  newsTitleFontSize?: number;
  onNewsTitleFontSizeChange?: (n: number) => void;
  newsSummaryFontSize?: number;
  onNewsSummaryFontSizeChange?: (n: number) => void;
}

interface DbColumn { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number; }
interface DbForeignKey { id: number; seq: number; table: string; from: string; to: string; }
interface DbResource { identifier: string; label: string; sourcePath: string | null; itemCount: number; sampleTickers: string[]; uiUsage: string[]; }
interface DbTableInfo { name: string; columns: DbColumn[]; foreignKeys: DbForeignKey[]; rowCount: number; sampleRows: Record<string, unknown>[]; uiUsage: string[]; resources?: DbResource[]; }

export function DataControlWindow({
  fontScale = 1,
  onFontScaleChange,
  newsTitleFontSize = 12,
  onNewsTitleFontSizeChange,
  newsSummaryFontSize = 11,
  onNewsSummaryFontSizeChange,
}: DataControlWindowProps) {
  // ─── Status state ───
  const [statuses, setStatuses] = useState<Record<string, UpdateStatusItem | null>>({});
  const [ohlcStatus, setOhlcStatus] = useState<OhlcStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Per-section job state ───
  const [jobIds, setJobIds] = useState<Record<SectionKey, string | null>>({
    price: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, peersPull: null, 'recent': null, custom: null,
  });
  const [updating, setUpdating] = useState<Record<SectionKey, boolean>>({
    price: false, calendarBackfill: false, calendarRefresh: false, calendarCustom: false, companyDesc: false, peersPull: false, 'recent': false, custom: false,
  });
  const [errors, setErrors] = useState<Record<SectionKey, string | null>>({
    price: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, peersPull: null, 'recent': null, custom: null,
  });

  // ─── View Log state (only one section's log at a time) ───
  const [logSection, setLogSection] = useState<SectionKey | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<SectionKey, JobStatus | null>>({
    price: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, peersPull: null, 'recent': null, custom: null,
  });
  const logEndRef = useRef<HTMLDivElement>(null);

  // ─── App DB inspection state ───
  const [dbTables, setDbTables] = useState<DbTableInfo[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // ─── Active tab (Updates / Settings / App DB) ───
  const [activeDataTab, setActiveDataTab] = useState<'updates' | 'settings' | 'appdb'>(() => {
    try {
      const s = localStorage.getItem('data-control-active-tab');
      if (s === 'settings') return 'settings';
      if (s === 'appdb') return 'appdb';
    } catch { /* SSR */ }
    return 'updates';
  });

  // ─── Full Text Concurrency ───
  const [ftConcurrency, setFtConcurrency] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('ft-concurrency') ?? '', 10);
      return v >= 1 && v <= 200 ? v : 10;
    } catch { return 10; }
  });
  const saveFtConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(200, n));
    setFtConcurrency(v);
    try { localStorage.setItem('ft-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── Custom Change date range input ───
  const [customChangeFrom, setCustomChangeFrom] = useState('');
  const [customChangeTo, setCustomChangeTo] = useState(() => new Date().toISOString().slice(0, 10));

  // ─── Calendar custom date range ───
  const [calendarCustomFrom, setCalendarCustomFrom] = useState('');
  const [calendarCustomTo, setCalendarCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  // ─── Fetch statuses on mount ───
  const fetchStatuses = async () => {
    try {
      const [statusRes, ohlcRes] = await Promise.all([
        fetch(`${API_BASE}/api/updates/status`),
        fetch(`${API_BASE}/api/ibkr/ohlc1d/status`),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatuses(data.sources ?? data);
      }
      if (ohlcRes.ok) {
        const data = await ohlcRes.json();
        setOhlcStatus(data);
      }
    } catch {
      // Ignore — will show stale data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchDbInspect = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      const res = await fetch(`${API_BASE}/api/db/inspect`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tables: DbTableInfo[] } = await res.json();
      setDbTables(data.tables);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Failed to load DB info');
    } finally {
      setDbLoading(false);
    }
  };

  // ─── Poll job statuses ───
  useEffect(() => {
    const activeKeys = (Object.keys(jobIds) as SectionKey[]).filter(k => jobIds[k]);
    if (activeKeys.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      for (const key of activeKeys) {
        const jid = jobIds[key];
        if (!jid) continue;
        try {
          const res = await fetch(`${API_BASE}/api/jobs/${jid}`);
          if (!res.ok) continue;
          const data: JobStatus = await res.json();
          if (cancelled) return;
          setJobStatuses(prev => ({ ...prev, [key]: data }));
          if (data.status === 'done') {
            setUpdating(prev => ({ ...prev, [key]: false }));
            fetchStatuses();
          } else if (data.status === 'failed') {
            setUpdating(prev => ({ ...prev, [key]: false }));
            setErrors(prev => ({ ...prev, [key]: data.error || 'Job failed' }));
          } else if (data.status === 'cancelled') {
            setUpdating(prev => ({ ...prev, [key]: false }));
          }
        } catch {
          // Transient — retry next interval
        }
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [jobIds]);

  // ─── Auto-scroll log ───
  useEffect(() => {
    if (logSection && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logSection, jobStatuses]);

  // ─── ESC closes log ───
  useEffect(() => {
    if (!logSection) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogSection(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [logSection]);

  // ─── Persist active tab ───
  useEffect(() => {
    try { localStorage.setItem('data-control-active-tab', activeDataTab); } catch { /* quota */ }
  }, [activeDataTab]);

  // ─── Start update handlers ───
  const startUpdate = async (key: SectionKey) => {
    setUpdating(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: null }));
    setJobStatuses(prev => ({ ...prev, [key]: null }));

    try {
      let url = '';
      let body: string | undefined;
      const headers: Record<string, string> = {};

      switch (key) {
        case 'price':
          url = `${API_BASE}/api/ibkr/ohlc1d/update`;
          break;
        case 'calendarBackfill':
          url = `${API_BASE}/api/ibkr/calendar/update`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ mode: 'backfill' });
          break;
        case 'calendarRefresh':
          url = `${API_BASE}/api/ibkr/calendar/update`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ mode: 'refresh' });
          break;
        case 'calendarCustom':
          url = `${API_BASE}/api/ibkr/calendar/update-custom`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ from: calendarCustomFrom, to: calendarCustomTo });
          break;
        case 'companyDesc':
          url = `${API_BASE}/api/company-profiles/pull-fmp`;
          break;
        case 'peersPull':
          url = `${API_BASE}/api/company-profiles/pull-peers`;
          break;
        case 'recent':
          url = `${API_BASE}/api/news/change/update-recent`;
          break;
        case 'custom':
          url = `${API_BASE}/api/news/change/update-custom`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ from: customChangeFrom, to: customChangeTo });
          break;
      }

      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setJobIds(prev => ({ ...prev, [key]: data.jobId }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start update';
      setErrors(prev => ({ ...prev, [key]: message }));
      setUpdating(prev => ({ ...prev, [key]: false }));
    }
  };

  // ─── Format timestamp ───
  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // ─── Get last success for a status key ───
  const getLastSuccess = (statusKey: string): string | null => {
    const item = statuses[statusKey];
    return item?.lastSuccessAt ?? null;
  };

  // ─── Active log panel data ───
  const activeLog = logSection ? jobStatuses[logSection] : null;

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        Loading status...
      </div>
    );
  }

  const sections: {
    key: SectionKey;
    label: string;
    statusKey: string;
    group?: string;
    description?: string;
    extra?: React.ReactNode;
  }[] = [
    {
      key: 'price',
      label: 'IBKR Price Data',
      statusKey: 'ibkr_ohlc_1d',
      group: 'IBKR Data',
      description: 'IBKR에서 일봉 OHLC 데이터를 수집합니다.',
      extra: (
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          DB Max Date: <strong className="text-gray-700 dark:text-gray-200">{ohlcStatus?.overallMaxDate ?? '—'}</strong>
        </span>
      ),
    },
    {
      key: 'calendarBackfill',
      label: 'Initial Calendar Backfill',
      statusKey: 'ibkr_calendar',
      group: 'Calendar Update',
      description: '과거 2년 + 미래 180일 이벤트를 한번에 적재합니다. 초기 세팅 시 실행합니다.',
    },
    {
      key: 'calendarRefresh',
      label: 'Refresh Upcoming Calendar',
      statusKey: 'ibkr_calendar',
      group: 'Calendar Update',
      description: '최근 30일 overlap + 앞으로 90일만 갱신합니다. 과거 전체를 다시 받지 않습니다.',
    },
    {
      key: 'calendarCustom',
      label: 'Custom Calendar Update',
      statusKey: 'ibkr_calendar',
      group: 'Calendar Update',
      description: '사용자 지정 날짜 범위로 캘린더 이벤트를 수집합니다.',
      extra: (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] text-gray-500 dark:text-gray-400">From:</label>
          <input
            type="date"
            value={calendarCustomFrom}
            onChange={e => setCalendarCustomFrom(e.target.value)}
            className="w-28 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
          <label className="text-[11px] text-gray-500 dark:text-gray-400">To:</label>
          <input
            type="date"
            value={calendarCustomTo}
            onChange={e => setCalendarCustomTo(e.target.value)}
            className="w-28 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
        </div>
      ),
    },
    {
      key: 'companyDesc',
      label: 'Company Description Update',
      statusKey: 'company_profiles',
      group: 'Company Data',
      description: 'ticker_universes/default 기준으로 FMP 회사 설명을 일괄 수집합니다.',
    },
    {
      key: 'peersPull',
      label: 'Peers Data Update',
      statusKey: 'company_profiles',
      group: 'Company Data',
      description: 'ticker_universes/default 기준으로 Finnhub 관련 종목(peers)을 수집합니다.',
    },

    {
      key: 'recent',
      label: 'Recent Change% Update',
      statusKey: 'news_change_recent',
      group: 'Change Update',
      description: '최근 7일 뉴스 change % 재계산. DB에 OHLC가 없으면 Finnhub에서 가져옵니다.',
    },
    {
      key: 'custom',
      label: 'Custom Change% Update',
      statusKey: 'news_change_custom',
      group: 'Change Update',
      description: '선택한 날짜 범위 뉴스 change % 재계산. DB에 OHLC가 없으면 Finnhub에서 가져옵니다.',
      extra: (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] text-gray-500 dark:text-gray-400">From:</label>
          <input
            type="date"
            value={customChangeFrom}
            onChange={e => setCustomChangeFrom(e.target.value)}
            className="w-28 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
          <label className="text-[11px] text-gray-500 dark:text-gray-400">To:</label>
          <input
            type="date"
            value={customChangeTo}
            onChange={e => setCustomChangeTo(e.target.value)}
            className="w-28 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Data Control</h2>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
        {(['updates', 'settings', 'appdb'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveDataTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeDataTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'updates' ? 'Updates' : tab === 'settings' ? 'Settings' : 'App DB'}
          </button>
        ))}
      </div>

      {/* Settings tab */}
      {activeDataTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">Font Size</h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              {([0.8, 1.0, 1.2, 1.5] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => onFontScaleChange?.(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    Math.abs(fontScale - preset) < 0.01
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {preset === 1.0 ? 'Default' : `${preset}×`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-5">A</span>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={fontScale}
                onChange={e => onFontScaleChange?.(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-5 text-right">A</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{(fontScale * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">News Feed Typography</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
              Adjust News Feed title text and summary text separately from here.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Title Text</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{newsTitleFontSize}px</span>
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[11, 12, 14, 16].map(size => (
                    <button
                      key={`title-${size}`}
                      onClick={() => onNewsTitleFontSizeChange?.(size)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        newsTitleFontSize === size
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500 w-5">A</span>
                  <input
                    type="range"
                    min={10}
                    max={20}
                    step={1}
                    value={newsTitleFontSize}
                    onChange={e => onNewsTitleFontSizeChange?.(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-500 w-5 text-right">A</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Summary Text</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{newsSummaryFontSize}px</span>
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[10, 11, 12, 14].map(size => (
                    <button
                      key={`summary-${size}`}
                      onClick={() => onNewsSummaryFontSizeChange?.(size)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        newsSummaryFontSize === size
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500 w-5">A</span>
                  <input
                    type="range"
                    min={9}
                    max={18}
                    step={1}
                    value={newsSummaryFontSize}
                    onChange={e => onNewsSummaryFontSizeChange?.(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-500 w-5 text-right">A</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Full Text Extraction</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Concurrency: 동시에 full text를 추출하는 병렬 요청 수. 높을수록 빠르지만, 200 이상은 사이트 차단 위험.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[10, 50, 100, 200].map(preset => (
                <button
                  key={`ft-c-${preset}`}
                  onClick={() => saveFtConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    ftConcurrency === preset
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-6">1</span>
              <input
                type="range"
                min={1}
                max={200}
                step={1}
                value={ftConcurrency}
                onChange={e => saveFtConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">200</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{ftConcurrency}</span>
            </div>
          </div>
        </div>
      )}

      {/* App DB tab */}
      {activeDataTab === 'appdb' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Header + Refresh */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">앱 데이터베이스 구조</span>
            <button
              onClick={fetchDbInspect}
              disabled={dbLoading}
              className="flex items-center gap-1.5 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${dbLoading ? 'animate-spin' : ''}`} />
              {dbLoading ? '조회 중...' : 'Refresh'}
            </button>
          </div>

          {dbError && (
            <div className="text-red-500 text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">{dbError}</div>
          )}

          {dbTables.length === 0 && !dbLoading && !dbError && (
            <div className="text-sm text-gray-400 text-center py-12">Refresh를 클릭하여 DB 구조를 조회하세요</div>
          )}

          {[...dbTables].sort((a, b) => b.rowCount - a.rowCount).map(table => (
            <div key={table.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-850">
              {/* Table header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-100">{table.name}</span>
                <span className="text-xs text-gray-500 tabular-nums">{table.rowCount.toLocaleString()} rows</span>
              </div>

              {/* Columns */}
              <div className="flex flex-wrap gap-1 mb-2">
                {table.columns.map(col => (
                  <span key={col.name} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                    {col.pk > 0 && <span className="text-amber-500 mr-0.5" title="Primary Key">PK</span>}
                    <span className="text-gray-800 dark:text-gray-200">{col.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-0.5">{col.type || 'TEXT'}</span>
                  </span>
                ))}
              </div>

              {/* Foreign keys */}
              {table.foreignKeys.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-mono">
                  FK: {table.foreignKeys.map(fk => `${fk.from} → ${fk.table}.${fk.to}`).join(' · ')}
                </div>
              )}

              {/* UI usage badges */}
              {table.uiUsage.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {table.uiUsage.map((u, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">{u}</span>
                  ))}
                </div>
              )}

              {/* Resource cards (e.g. ticker_universes/default) */}
              {table.resources && table.resources.map(resource => (
                <div key={resource.identifier} className="mt-2 border border-blue-200 dark:border-blue-800 rounded p-2.5 bg-blue-50/40 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono font-semibold text-blue-800 dark:text-blue-300">{resource.identifier}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{resource.itemCount.toLocaleString()} items</span>
                  </div>
                  {resource.sourcePath && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">source: {resource.sourcePath}</div>
                  )}
                  {resource.sampleTickers.length > 0 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-mono">
                      {resource.sampleTickers.slice(0, 8).join(', ')}{resource.itemCount > 8 ? ` …(+${resource.itemCount - 8})` : ''}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {resource.uiUsage.map((u, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">{u}</span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Sample Rows (collapsed by default) */}
              {table.sampleRows.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    Sample rows ({table.sampleRows.length})
                  </summary>
                  <div className="mt-1.5 overflow-x-auto">
                    <table className="text-[10px] font-mono border-collapse w-full">
                      <thead>
                        <tr>
                          {table.columns.map(col => (
                            <th key={col.name} className="px-1.5 py-0.5 text-left border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.sampleRows.map((row, ri) => (
                          <tr key={ri}>
                            {table.columns.map(col => {
                              const val = row[col.name];
                              const text = val === null || val === undefined ? '—' : String(val);
                              return (
                                <td key={col.name} className="px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={text}>
                                  {text.length > 80 ? text.slice(0, 80) + '…' : text}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sections (Updates tab) */}
      {activeDataTab === 'updates' && (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sections.map(({ key, label, statusKey, group, description, extra }, idx) => {
          const isRunning = updating[key];
          const error = errors[key];
          const jobId = jobIds[key];
          const prevGroup = idx > 0 ? sections[idx - 1].group : undefined;
          const js = jobStatuses[key];

          return (
            <React.Fragment key={key}>
              {/* Group header */}
              {group && group !== prevGroup && (
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-2 pb-0.5">
                  {group}
                </div>
              )}
            <div
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-850"
            >
              {/* Row 1: Label + buttons */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{label}</span>
                  {description && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Update button */}
                  <button
                    onClick={() => startUpdate(key)}
                    disabled={isRunning}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isRunning ? 'Update in progress...' : `Start ${label} update`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
                    <span>{isRunning ? 'Running...' : 'Update'}</span>
                  </button>

                  {/* View Log button */}
                  <button
                    onClick={() => jobId && setLogSection(logSection === key ? null : key)}
                    disabled={!jobId}
                    className={`px-2.5 py-1 border rounded text-xs transition-colors flex items-center gap-1 ${
                      !jobId
                        ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                        : logSection === key
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    title={jobId ? 'View update logs' : 'No active job'}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Log</span>
                    {js?.status === 'running' && (
                      <span className="ml-0.5 text-[10px] text-blue-500 tabular-nums">{js.progress.pct}%</span>
                    )}
                    {js?.status === 'done' && (
                      <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    )}
                    {js?.status === 'failed' && (
                      <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    )}
                  </button>
                </div>
              </div>

              {/* Row 2: Status info + error */}
              <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px]">
                <span className="text-gray-400 dark:text-gray-500">
                  Last Success: <span className="text-gray-600 dark:text-gray-300">{fmtTime(getLastSuccess(statusKey))}</span>
                </span>
                {extra}
                {error && (
                  <span className="text-red-500 truncate max-w-[250px]" title={error}>{error}</span>
                )}
              </div>
            </div>
            </React.Fragment>
          );
        })}
      </div>
      )}

      {/* ─── Job Log Panel (bottom overlay) ─── */}
      {logSection && activeLog && (
        <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 z-40 flex flex-col shadow-lg">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                {sections.find(s => s.key === logSection)?.label} — Log
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                activeLog.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                activeLog.status === 'done' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                activeLog.status === 'cancelled' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
              }`}>
                {activeLog.status === 'running' ? 'Running' : activeLog.status === 'done' ? 'Done' : activeLog.status === 'cancelled' ? 'Cancelled' : 'Failed'}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums">
                {activeLog.progress.completed}/{activeLog.progress.total} ({activeLog.progress.pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1">
              {activeLog.status === 'running' && logSection && jobIds[logSection] && (
                <button
                  onClick={async () => {
                    const jid = jobIds[logSection!];
                    if (!jid) return;
                    try {
                      await fetch(`${API_BASE}/api/jobs/${jid}/cancel`, { method: 'POST' });
                    } catch { /* ignore */ }
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                  title="Stop job"
                >
                  <Square className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
              <button onClick={() => setLogSection(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="Close (Esc)">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 shrink-0">
            <div
              className={`h-full transition-all duration-300 ${
                activeLog.status === 'failed' ? 'bg-red-500' : activeLog.status === 'done' ? 'bg-green-500' : activeLog.status === 'cancelled' ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${activeLog.progress.pct}%` }}
            />
          </div>
          {/* Log lines */}
          <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900">
            {activeLog.logs.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap py-0.5 ${line.includes('FAILED') ? 'text-red-500' : line.includes('⚠') ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {line}
              </div>
            ))}
            {activeLog.error && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
                Error: {activeLog.error}
              </div>
            )}
            <div ref={logEndRef} />
          </div>
          {/* Result summary */}
          {activeLog.status === 'done' && activeLog.result && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 shrink-0">
              ✓ Completed
              {activeLog.result.tickersUpdated !== undefined && (
                <span> — {String(activeLog.result.tickersUpdated)} tickers updated, {String(activeLog.result.tickersFailed)} failed, {String(activeLog.result.totalRowsUpserted)} rows</span>
              )}
              {activeLog.result.merged !== undefined && (
                <span> — {String(activeLog.result.merged)} merged, {String(activeLog.result.skipped)} skipped</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
