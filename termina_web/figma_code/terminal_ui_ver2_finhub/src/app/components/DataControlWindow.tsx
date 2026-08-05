import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Eye, X, Square, CircleHelp } from 'lucide-react';
import { dataControlHowToUseRegistry, type DataControlHowToUseKey } from '../dataControlHowToUse';

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

type SectionKey = DataControlHowToUseKey;

interface DataControlWindowProps {
  fontScale?: number;
  onFontScaleChange?: (n: number) => void;
  newsTitleFontSize?: number;
  onNewsTitleFontSizeChange?: (n: number) => void;
  newsSummaryFontSize?: number;
  onNewsSummaryFontSizeChange?: (n: number) => void;
  investingTitleFontSize?: number;
  onInvestingTitleFontSizeChange?: (n: number) => void;
  investingSummaryFontSize?: number;
  onInvestingSummaryFontSizeChange?: (n: number) => void;
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
  investingTitleFontSize = 12,
  onInvestingTitleFontSizeChange,
  investingSummaryFontSize = 11,
  onInvestingSummaryFontSizeChange,
}: DataControlWindowProps) {
  // ─── Status state ───
  const [statuses, setStatuses] = useState<Record<string, UpdateStatusItem | null>>({});
  const [ohlcStatus, setOhlcStatus] = useState<OhlcStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Per-section job state ───
  const [jobIds, setJobIds] = useState<Record<SectionKey, string | null>>({
    price: null, fmpRecentOhlc: null, turnover: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, yahooDesc: null, peersPull: null, ipoDate: null, ipoPricing: null, 'recent': null, fmpRecentChange: null, custom: null,
  });
  const [updating, setUpdating] = useState<Record<SectionKey, boolean>>({
    price: false, fmpRecentOhlc: false, turnover: false, calendarBackfill: false, calendarRefresh: false, calendarCustom: false, companyDesc: false, yahooDesc: false, peersPull: false, ipoDate: false, ipoPricing: false, 'recent': false, fmpRecentChange: false, custom: false,
  });
  const [errors, setErrors] = useState<Record<SectionKey, string | null>>({
    price: null, fmpRecentOhlc: null, turnover: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, yahooDesc: null, peersPull: null, ipoDate: null, ipoPricing: null, 'recent': null, fmpRecentChange: null, custom: null,
  });

  // ─── View Log state (only one section's log at a time) ───
  const [logSection, setLogSection] = useState<SectionKey | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<SectionKey, JobStatus | null>>({
    price: null, fmpRecentOhlc: null, turnover: null, calendarBackfill: null, calendarRefresh: null, calendarCustom: null, companyDesc: null, yahooDesc: null, peersPull: null, ipoDate: null, ipoPricing: null, 'recent': null, fmpRecentChange: null, custom: null,
  });
  const [showCustomPreflightModal, setShowCustomPreflightModal] = useState(false);
  const [customPreflightTitle, setCustomPreflightTitle] = useState('Custom Update Preflight');
  const [customPreflightData, setCustomPreflightData] = useState<any | null>(null);
  const [pendingCustomExecute, setPendingCustomExecute] = useState<(() => void) | null>(null);
  const [howToContextMenu, setHowToContextMenu] = useState<{ x: number; y: number; key: SectionKey } | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const howToContextMenuRef = useRef<HTMLDivElement>(null);

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
      return v >= 1 && v <= 200 ? v : 200;
    } catch { return 200; }
  });
  const saveFtConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(200, n));
    setFtConcurrency(v);
    try { localStorage.setItem('ft-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── FMP PR Full Text Concurrency ───
  const [fmpPrFtConcurrency, setFmpPrFtConcurrency] = useState(() => {
    try {
      const raw = localStorage.getItem('fmp-pr-fulltext-concurrency') ?? localStorage.getItem('ft-concurrency') ?? '';
      const v = parseInt(raw, 10);
      return v >= 1 && v <= 50 ? v : 10;
    } catch { return 10; }
  });
  const saveFmpPrFtConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(50, n));
    setFmpPrFtConcurrency(v);
    try { localStorage.setItem('fmp-pr-fulltext-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── FMP Stock Full Text Concurrency ───
  const [fmpStockFtConcurrency, setFmpStockFtConcurrency] = useState(() => {
    try {
      const raw = localStorage.getItem('fmp-stock-fulltext-concurrency') ?? localStorage.getItem('ft-concurrency') ?? '';
      const v = parseInt(raw, 10);
      return v >= 1 && v <= 200 ? v : 25;
    } catch { return 25; }
  });
  const saveFmpStockFtConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(200, n));
    setFmpStockFtConcurrency(v);
    try { localStorage.setItem('fmp-stock-fulltext-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── Change Update FMP Concurrency ───
  const [changeFmpConcurrency, setChangeFmpConcurrency] = useState(() => {
    try {
      const raw = localStorage.getItem('change-fmp-concurrency') ?? localStorage.getItem('ibkr-concurrency') ?? '';
      const v = parseInt(raw, 10);
      return v >= 1 && v <= 20 ? v : 5;
    } catch { return 5; }
  });
  const saveChangeFmpConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    setChangeFmpConcurrency(v);
    try {
      localStorage.setItem('change-fmp-concurrency', String(v));
      localStorage.removeItem('ibkr-concurrency');
    } catch { /* SSR */ }
  };

  // ─── Finnhub Pull Ticker Concurrency ───
  const [finnhubTickerConcurrency, setFinnhubTickerConcurrency] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('finnhub-ticker-concurrency') ?? '', 10);
      return v >= 1 && v <= 20 ? v : 5;
    } catch { return 5; }
  });
  const saveFinnhubTickerConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    setFinnhubTickerConcurrency(v);
    try { localStorage.setItem('finnhub-ticker-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── Finnhub Company News Pull Overrides ───
  const [companyNewsTickerConcurrency, setCompanyNewsTickerConcurrency] = useState(() => {
    try {
      const raw = localStorage.getItem('finnhub-company-news-ticker-concurrency') ?? localStorage.getItem('finnhub-ticker-concurrency') ?? '';
      const v = parseInt(raw, 10);
      return v >= 1 && v <= 20 ? v : 5;
    } catch { return 5; }
  });
  const saveCompanyNewsTickerConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    setCompanyNewsTickerConcurrency(v);
    try { localStorage.setItem('finnhub-company-news-ticker-concurrency', String(v)); } catch { /* SSR */ }
  };

  const [companyNewsRequestIntervalSec, setCompanyNewsRequestIntervalSec] = useState(() => {
    try {
      const raw = localStorage.getItem('finnhub-company-news-request-interval-sec') ?? localStorage.getItem('finnhub-request-interval-sec') ?? '';
      const v = parseFloat(raw);
      return Number.isFinite(v) && v >= 0 && v <= 10 ? v : 1;
    } catch { return 1; }
  });
  const saveCompanyNewsRequestIntervalSec = (n: number) => {
    const safe = Number.isFinite(n) ? n : 1;
    const v = Math.max(0, Math.min(10, Math.round(safe * 10) / 10));
    setCompanyNewsRequestIntervalSec(v);
    try { localStorage.setItem('finnhub-company-news-request-interval-sec', String(v)); } catch { /* SSR */ }
  };

  const DEFAULT_FMP_CONCURRENCY = 10;
  const DEFAULT_FMP_REQUEST_INTERVAL_MS = 25;
  const DEFAULT_FMP_PR_PAGE_LIMIT = 100;
  const DEFAULT_FMP_PR_MAX_PAGES = 12;
  const DEFAULT_FMP_SEC_MAX_PAGES = 40;

  // ─── FMP Concurrency ───
  const [fmpConcurrency, setFmpConcurrency] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('fmp-concurrency') ?? '', 10);
      return v >= 1 && v <= 20 ? v : DEFAULT_FMP_CONCURRENCY;
    } catch { return DEFAULT_FMP_CONCURRENCY; }
  });
  const saveFmpConcurrency = (n: number) => {
    const safe = Number.isFinite(n) ? n : DEFAULT_FMP_CONCURRENCY;
    const v = Math.max(1, Math.min(20, safe));
    setFmpConcurrency(v);
    try { localStorage.setItem('fmp-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── FMP Request Interval ───
  const [fmpRequestIntervalMs, setFmpRequestIntervalMs] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('fmp-request-interval-ms') ?? '', 10);
      return Number.isFinite(v) && v >= 0 && v <= 5000 ? v : DEFAULT_FMP_REQUEST_INTERVAL_MS;
    } catch { return DEFAULT_FMP_REQUEST_INTERVAL_MS; }
  });
  const saveFmpRequestIntervalMs = (n: number) => {
    const safe = Number.isFinite(n) ? n : DEFAULT_FMP_REQUEST_INTERVAL_MS;
    const v = Math.max(0, Math.min(5000, Math.round(safe)));
    setFmpRequestIntervalMs(v);
    try { localStorage.setItem('fmp-request-interval-ms', String(v)); } catch { /* SSR */ }
  };

  const [fmpPrPageLimit, setFmpPrPageLimit] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('fmp-pr-page-limit') ?? '', 10);
      return Number.isFinite(v) && v >= 1 && v <= 100 ? v : DEFAULT_FMP_PR_PAGE_LIMIT;
    } catch { return DEFAULT_FMP_PR_PAGE_LIMIT; }
  });
  const saveFmpPrPageLimit = (n: number) => {
    const safe = Number.isFinite(n) ? n : DEFAULT_FMP_PR_PAGE_LIMIT;
    const v = Math.max(1, Math.min(100, Math.round(safe)));
    setFmpPrPageLimit(v);
    try { localStorage.setItem('fmp-pr-page-limit', String(v)); } catch { /* SSR */ }
  };

  const [fmpPrMaxPages, setFmpPrMaxPages] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('fmp-pr-max-pages') ?? '', 10);
      return Number.isFinite(v) && v >= 1 && v <= 50 ? v : DEFAULT_FMP_PR_MAX_PAGES;
    } catch { return DEFAULT_FMP_PR_MAX_PAGES; }
  });
  const saveFmpPrMaxPages = (n: number) => {
    const safe = Number.isFinite(n) ? n : DEFAULT_FMP_PR_MAX_PAGES;
    const v = Math.max(1, Math.min(50, Math.round(safe)));
    setFmpPrMaxPages(v);
    try { localStorage.setItem('fmp-pr-max-pages', String(v)); } catch { /* SSR */ }
  };

  const [fmpSecMaxPages, setFmpSecMaxPages] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('fmp-sec-max-pages') ?? '', 10);
      return Number.isFinite(v) && v >= 1 && v <= 100 ? v : DEFAULT_FMP_SEC_MAX_PAGES;
    } catch { return DEFAULT_FMP_SEC_MAX_PAGES; }
  });
  const saveFmpSecMaxPages = (n: number) => {
    const safe = Number.isFinite(n) ? n : DEFAULT_FMP_SEC_MAX_PAGES;
    const v = Math.max(1, Math.min(100, Math.round(safe)));
    setFmpSecMaxPages(v);
    try { localStorage.setItem('fmp-sec-max-pages', String(v)); } catch { /* SSR */ }
  };

  // ─── FMP skip-existing toggle ───
  const [fmpSkipExisting, setFmpSkipExisting] = useState(() => {
    try {
      return localStorage.getItem('fmp-skip-existing') !== 'false';
    } catch { return true; }
  });
  const saveFmpSkipExisting = (v: boolean) => {
    setFmpSkipExisting(v);
    try { localStorage.setItem('fmp-skip-existing', String(v)); } catch { /* SSR */ }
  };

  // ─── Peers skip-existing toggle ───
  const [peersSkipExisting, setPeersSkipExisting] = useState(() => {
    try {
      return localStorage.getItem('peers-skip-existing') !== 'false';
    } catch { return true; }
  });
  const savePeersSkipExisting = (v: boolean) => {
    setPeersSkipExisting(v);
    try { localStorage.setItem('peers-skip-existing', String(v)); } catch { /* SSR */ }
  };

  // ─── IPO skip-existing toggle ───
  const [ipoSkipExisting, setIpoSkipExisting] = useState(() => {
    try {
      return localStorage.getItem('ipo-skip-existing') !== 'false';
    } catch { return true; }
  });
  const saveIpoSkipExisting = (v: boolean) => {
    setIpoSkipExisting(v);
    try { localStorage.setItem('ipo-skip-existing', String(v)); } catch { /* SSR */ }
  };

  // ─── Yahoo Concurrency ───
  const [yahooConcurrency, setYahooConcurrency] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('yahoo-concurrency') ?? '', 10);
      return v >= 1 && v <= 20 ? v : 5;
    } catch { return 5; }
  });
  const saveYahooConcurrency = (n: number) => {
    const v = Math.max(1, Math.min(20, n));
    setYahooConcurrency(v);
    try { localStorage.setItem('yahoo-concurrency', String(v)); } catch { /* SSR */ }
  };

  // ─── Yahoo Request Interval ───
  const [yahooRequestIntervalMs, setYahooRequestIntervalMs] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('yahoo-request-interval-ms') ?? '', 10);
      return Number.isFinite(v) && v >= 0 && v <= 5000 ? v : 200;
    } catch { return 200; }
  });
  const saveYahooRequestIntervalMs = (n: number) => {
    const v = Math.max(0, Math.min(5000, Math.round(n)));
    setYahooRequestIntervalMs(v);
    try { localStorage.setItem('yahoo-request-interval-ms', String(v)); } catch { /* SSR */ }
  };

  // ─── Yahoo skip-existing toggle ───
  const [yahooSkipExisting, setYahooSkipExisting] = useState(() => {
    try {
      return localStorage.getItem('yahoo-skip-existing') !== 'false';
    } catch { return true; }
  });
  const saveYahooSkipExisting = (v: boolean) => {
    setYahooSkipExisting(v);
    try { localStorage.setItem('yahoo-skip-existing', String(v)); } catch { /* SSR */ }
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

  // ─── Auto-scroll only the log overlay content ───
  useEffect(() => {
    if (!logSection) return;
    const logElement = logScrollRef.current;
    if (!logElement) return;

    const scrollToBottom = () => {
      logElement.scrollTop = logElement.scrollHeight;
    };

    scrollToBottom();
    const frameId = globalThis.requestAnimationFrame(scrollToBottom);
    return () => globalThis.cancelAnimationFrame(frameId);
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

  useEffect(() => {
    if (!howToContextMenu) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (howToContextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setHowToContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHowToContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [howToContextMenu]);

  // ─── Start update handlers ───
  const startUpdate = async (key: SectionKey) => {
    setUpdating(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: null }));
    setJobStatuses(prev => ({ ...prev, [key]: null }));

    try {
      let url = '';
      let body: string | undefined;
      let preflightUrl = '';
      let preflightTitle = '';
      const headers: Record<string, string> = {};

      switch (key) {
        case 'price':
          url = `${API_BASE}/api/ibkr/ohlc1d/update`;
          break;
        case 'fmpRecentOhlc':
          url = `${API_BASE}/api/fmp/ohlc1d/update-recent-missing`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ concurrency: fmpConcurrency, requestIntervalMs: fmpRequestIntervalMs });
          break;
        case 'turnover':
          url = `${API_BASE}/api/ibkr/ohlc1d/turnover/update`;
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
          preflightUrl = `${API_BASE}/api/ibkr/calendar/update-custom/preflight`;
          preflightTitle = 'Calendar Custom Preflight';
          break;
        case 'companyDesc':
          url = `${API_BASE}/api/company-profiles/pull-fmp`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            concurrency: fmpConcurrency,
            requestIntervalMs: fmpRequestIntervalMs,
            skipExisting: fmpSkipExisting,
          });
          break;
        case 'yahooDesc':
          url = `${API_BASE}/api/company-profiles/pull-yahoo`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            concurrency: yahooConcurrency,
            requestIntervalMs: yahooRequestIntervalMs,
            skipExisting: yahooSkipExisting,
          });
          break;
        case 'peersPull':
          url = `${API_BASE}/api/company-profiles/pull-peers`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            tickerConcurrency: finnhubTickerConcurrency,
            skipExisting: peersSkipExisting,
          });
          break;
        case 'ipoDate':
          url = `${API_BASE}/api/company-profiles/pull-ipo-date`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            tickerConcurrency: finnhubTickerConcurrency,
            skipExisting: ipoSkipExisting,
          });
          break;
        case 'ipoPricing':
          url = `${API_BASE}/api/company-profiles/pull-ipo-pricing`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            requestIntervalMs: fmpRequestIntervalMs,
            skipExisting: ipoSkipExisting,
          });
          break;
        case 'recent':
          url = `${API_BASE}/api/news/change/update-recent`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ fmpConcurrency: changeFmpConcurrency, fmpRequestIntervalMs });
          break;
        case 'fmpRecentChange':
          url = `${API_BASE}/api/news/change/update-recent-fmp-missing`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ fmpConcurrency: changeFmpConcurrency, fmpRequestIntervalMs });
          break;
        case 'custom':
          url = `${API_BASE}/api/news/change/update-custom`;
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ from: customChangeFrom, to: customChangeTo, fmpConcurrency: changeFmpConcurrency, fmpRequestIntervalMs });
          preflightUrl = `${API_BASE}/api/news/change/update-custom/preflight`;
          preflightTitle = 'News Change Custom Preflight';
          break;
      }

      const executeUpdate = async () => {
        const res = await fetch(url, { method: 'POST', headers, body });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setJobIds(prev => ({ ...prev, [key]: data.jobId }));
      };

      if (preflightUrl && body) {
        const preflightRes = await fetch(preflightUrl, { method: 'POST', headers, body });
        const preflightData = await preflightRes.json();
        if (preflightRes.ok) {
          setCustomPreflightTitle(preflightTitle);
          setCustomPreflightData(preflightData);
          setPendingCustomExecute(() => () => {
            setUpdating(prev => ({ ...prev, [key]: true }));
            void executeUpdate().catch((err: unknown) => {
              const message = err instanceof Error ? err.message : 'Failed to start update';
              setErrors(prev => ({ ...prev, [key]: message }));
              setUpdating(prev => ({ ...prev, [key]: false }));
            });
          });
          setShowCustomPreflightModal(true);
          setUpdating(prev => ({ ...prev, [key]: false }));
          return;
        }
      }

      await executeUpdate();
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

  const openHowToUseWindow = (key: SectionKey) => {
    const payload = dataControlHowToUseRegistry[key];
    window.dispatchEvent(new CustomEvent('open-data-control-how-to-use', { detail: payload }));
    setHowToContextMenu(null);
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
      key: 'fmpRecentOhlc',
      label: 'FMP Recent OHLC Fill',
      statusKey: 'fmp_ohlc_recent_missing',
      group: 'IBKR Data',
      description: `최근 7일 누락 일봉만 FMP로 메웁니다. 장 마감 전 ET 당일은 제외합니다. (concurrency=${fmpConcurrency}, interval=${fmpRequestIntervalMs}ms)`,
    },
    {
      key: 'turnover',
      label: 'OHLC Turnover Update',
      statusKey: 'ibkr_ohlc_turnover',
      group: 'IBKR Data',
      description: 'OHLC 일봉의 빈 Turnover 값을 계산해 채웁니다. 이미 값이 있는 row는 skip합니다.',
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
      description: `ticker_universes/default 기준으로 FMP 회사 설명을 일괄 수집합니다. (${fmpSkipExisting ? 'Skip Existing' : 'Overwrite All'}, concurrency=${fmpConcurrency}, interval=${fmpRequestIntervalMs}ms)`,
    },
    {
      key: 'yahooDesc',
      label: 'Yahoo Description Update',
      statusKey: 'company_profiles_yahoo',
      group: 'Company Data',
      description: `ticker_universes/default 기준으로 Yahoo Finance 회사 설명을 일괄 수집합니다. (${yahooSkipExisting ? 'Skip Existing' : 'Overwrite All'}, concurrency=${yahooConcurrency}, interval=${yahooRequestIntervalMs}ms)`,
    },
    {
      key: 'peersPull',
      label: 'Peers Data Update',
      statusKey: 'company_profiles',
      group: 'Company Data',
      description: `ticker_universes/default 기준으로 Finnhub 관련 종목(peers)을 수집합니다. (${peersSkipExisting ? 'Skip Existing' : 'Overwrite All'})`,
    },
    {
      key: 'ipoDate',
      label: 'IPO Date Update',
      statusKey: 'company_profiles_ipo_date',
      group: 'Company Data',
      description: `ticker_universes/default 기준으로 Finnhub profile2의 IPO date를 수집합니다. (${ipoSkipExisting ? 'Skip Existing' : 'Overwrite All'})`,
    },
    {
      key: 'ipoPricing',
      label: 'IPO Pricing Update',
      statusKey: 'company_profiles_ipo_pricing',
      group: 'Company Data',
      description: `ticker_universes/default 기준으로 FMP IPO price range와 확정 공모가를 수집합니다. (${ipoSkipExisting ? 'Skip Existing' : 'Overwrite All'}, interval=${fmpRequestIntervalMs}ms)`,
    },

    {
      key: 'recent',
      label: 'Recent Change% Update',
      statusKey: 'news_change_recent',
      group: 'Change Update',
      description: `최근 7일 뉴스 change % 전체 재계산 + missing HV/Z Score fill. DB에 OHLC가 없으면 FMP fallback을 사용합니다. (concurrency=${changeFmpConcurrency}, interval=${fmpRequestIntervalMs}ms)`,
    },
    {
      key: 'fmpRecentChange',
      label: 'FMP Recent Missing Change Fill',
      statusKey: 'news_change_recent_fmp_missing',
      group: 'Change Update',
      description: `최근 7일 뉴스 중 change_pct 누락 row만 계산합니다. 필요한 OHLC는 FMP로 보강합니다. (concurrency=${changeFmpConcurrency}, interval=${fmpRequestIntervalMs}ms)`,
    },
    {
      key: 'custom',
      label: 'Custom Change% Update',
      statusKey: 'news_change_custom',
      group: 'Change Update',
      description: `선택한 날짜 범위 뉴스 change % 재계산 + missing HV/Z Score fill. DB에 OHLC가 없으면 FMP fallback을 사용합니다. (concurrency=${changeFmpConcurrency}, interval=${fmpRequestIntervalMs}ms)`,
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
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Finnhub Company News Pull</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Finnhub News 창에서 `Company News`만 pull할 때 쓰는 전용 override입니다. 값을 따로 건드리지 않으면 기존 Finnhub 공용 설정을 이어받고, 여기서 올리면 press release / peers / IPO 설정은 건드리지 않고 company news만 더 공격적으로 당길 수 있습니다.
            </p>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-2">Ticker Concurrency</div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[3, 5, 10, 15, 20].map(preset => (
                    <button
                      key={`company-news-finnhub-c-${preset}`}
                      onClick={() => saveCompanyNewsTickerConcurrency(preset)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        companyNewsTickerConcurrency === preset
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
                    max={20}
                    step={1}
                    value={companyNewsTickerConcurrency}
                    onChange={e => saveCompanyNewsTickerConcurrency(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-500 w-8 text-right">20</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{companyNewsTickerConcurrency}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-2">Request Interval (sec)</div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[0, 0.2, 0.5, 1].map(preset => (
                    <button
                      key={`company-news-finnhub-interval-${preset}`}
                      onClick={() => saveCompanyNewsRequestIntervalSec(preset)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        companyNewsRequestIntervalSec === preset
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-500 w-6">0</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.1}
                    value={companyNewsRequestIntervalSec}
                    onChange={e => saveCompanyNewsRequestIntervalSec(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-500 w-8 text-right">10</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-12 text-right">{companyNewsRequestIntervalSec.toFixed(1)}</span>
                </div>
              </div>
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
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Investing News Typography</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
              Investing 창의 기사 제목과 summary 본문 크기입니다. 위의 News Feed Typography와 별개로 따로 움직입니다.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Article Title</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{investingTitleFontSize}px</span>
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[11, 12, 14, 16].map(size => (
                    <button
                      key={`investing-title-${size}`}
                      onClick={() => onInvestingTitleFontSizeChange?.(size)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        investingTitleFontSize === size
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
                    value={investingTitleFontSize}
                    onChange={e => onInvestingTitleFontSizeChange?.(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-500 w-5 text-right">A</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Summary Text</span>
                  <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{investingSummaryFontSize}px</span>
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[10, 11, 12, 14].map(size => (
                    <button
                      key={`investing-summary-${size}`}
                      onClick={() => onInvestingSummaryFontSizeChange?.(size)}
                      className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                        investingSummaryFontSize === size
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
                    value={investingSummaryFontSize}
                    onChange={e => onInvestingSummaryFontSizeChange?.(parseInt(e.target.value, 10))}
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
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP PR Full Text Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              FMP PR Only와 Reset FMP PR Fallback 뒤 재실행에만 적용되는 전용 동시성입니다. Business Wire 브라우저 fallback이 섞이므로 일반 Full Text보다 보수적으로 조정합니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[3, 5, 10, 15, 20].map(preset => (
                <button
                  key={`fmp-pr-ft-c-${preset}`}
                  onClick={() => saveFmpPrFtConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    fmpPrFtConcurrency === preset
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
                max={50}
                step={1}
                value={fmpPrFtConcurrency}
                onChange={e => saveFmpPrFtConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">50</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{fmpPrFtConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP Stock Full Text Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Recent/Custom FMP Stock pull 안에서 새 row에 대해 바로 도는 auto fulltext와, Full Text 메뉴의 `FMP Stock Only`, `Reset FMP Stock Fallback` 뒤 재실행이 함께 쓰는 전용 동시성입니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[10, 25, 50, 100].map(preset => (
                <button
                  key={`fmp-stock-ft-c-${preset}`}
                  onClick={() => saveFmpStockFtConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    fmpStockFtConcurrency === preset
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
                value={fmpStockFtConcurrency}
                onChange={e => saveFmpStockFtConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">200</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{fmpStockFtConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Change Update FMP Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Change% 계산 시 OHLC DB에 데이터가 없는 종목을 FMP 일봉 OHLC로 채우는 동시 요청 수. 값이 클수록 빠르지만 FMP rate limit 위험이 커집니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[1, 3, 5, 10, 20].map(preset => (
                <button
                  key={`change-fmp-c-${preset}`}
                  onClick={() => saveChangeFmpConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    changeFmpConcurrency === preset
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
                max={20}
                step={1}
                value={changeFmpConcurrency}
                onChange={e => saveChangeFmpConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">20</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{changeFmpConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Finnhub Ticker Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Finnhub Company News / Press Release 뿐 아니라 Peers / IPO Date 같은 company data 업데이트에도 적용됩니다. 값이 클수록 대기 중 worker는 늘어나지만 실제 Finnhub 요청은 backend 전역 throttle 안에서만 진행됩니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[1, 3, 5, 10].map(preset => (
                <button
                  key={`finnhub-c-${preset}`}
                  onClick={() => saveFinnhubTickerConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    finnhubTickerConcurrency === preset
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
                max={20}
                step={1}
                value={finnhubTickerConcurrency}
                onChange={e => saveFinnhubTickerConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">20</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{finnhubTickerConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP Request Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              FMP Company Description, FMP Press Release, FMP Stock News, FMP SEC Filing pull이 공통으로 참조하는 병렬 요청 수입니다. 높을수록 빠르지만 API rate limit 위험이 커집니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[3, 5, 10, 15].map(preset => (
                <button
                  key={`fmp-c-${preset}`}
                  onClick={() => saveFmpConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    fmpConcurrency === preset
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
                max={20}
                step={1}
                value={fmpConcurrency}
                onChange={e => saveFmpConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">20</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{fmpConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP Request Interval</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              FMP 요청 사이 최소 간격(ms). 기본 25ms. Company Description, FMP Press Release, FMP Stock News, FMP SEC Filing pull이 공통으로 사용합니다.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[0, 25, 50, 100, 250].map(preset => (
                <button
                  key={`fmp-interval-${preset}`}
                  onClick={() => saveFmpRequestIntervalMs(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    fmpRequestIntervalMs === preset
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {preset}ms
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-6">0</span>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={fmpRequestIntervalMs}
                onChange={e => saveFmpRequestIntervalMs(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-10 text-right">5000</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-14 text-right">{fmpRequestIntervalMs}ms</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP PR / Stock Paging</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              FMP press release와 FMP stock news pull에서 ticker당 얼마나 깊게 page를 탐색할지 정합니다. 기본값은 100 rows x 12 pages입니다.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1">Page Limit</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={fmpPrPageLimit}
                  onChange={e => saveFmpPrPageLimit(parseInt(e.target.value, 10))}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1">Max Pages</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={fmpPrMaxPages}
                  onChange={e => saveFmpPrMaxPages(parseInt(e.target.value, 10))}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 bg-white dark:bg-gray-800"
                />
              </label>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP SEC Paging</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              FMP SEC filing pull에서 symbol별 최대 몇 페이지까지 조회할지 정합니다. 기본값은 40 pages입니다.
            </p>
            <label className="text-xs text-gray-600 dark:text-gray-300">
              <span className="block mb-1">Max Pages</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={fmpSecMaxPages}
                onChange={e => saveFmpSecMaxPages(parseInt(e.target.value, 10))}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 bg-white dark:bg-gray-800"
              />
            </label>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">FMP Skip Existing</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              이미 FMP description이 저장된 ticker는 건너뛸지 선택합니다. Off로 바꾸면 전체 덮어쓰기(overwrite) 모드.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => saveFmpSkipExisting(true)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  fmpSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Skip Existing
              </button>
              <button
                onClick={() => saveFmpSkipExisting(false)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  !fmpSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Overwrite All
              </button>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Peers Skip Existing</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              이미 Finnhub peers가 저장된 ticker는 건너뛸지 선택합니다. Off로 바꾸면 전체 덮어쓰기(overwrite) 모드.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => savePeersSkipExisting(true)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  peersSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Skip Existing
              </button>
              <button
                onClick={() => savePeersSkipExisting(false)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  !peersSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Overwrite All
              </button>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">IPO Date Skip Existing</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              이미 Finnhub IPO date가 저장된 ticker는 건너뛸지 선택합니다. Off로 바꾸면 전체 덮어쓰기(overwrite) 모드.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => saveIpoSkipExisting(true)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  ipoSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Skip Existing
              </button>
              <button
                onClick={() => saveIpoSkipExisting(false)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  !ipoSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Overwrite All
              </button>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Yahoo Concurrency</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Yahoo Finance Description 다운로드 시 병렬 요청 수. 비공식 API이므로 너무 높으면 IP 차단 위험. 기본 5.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[1, 3, 5, 10].map(preset => (
                <button
                  key={`yahoo-c-${preset}`}
                  onClick={() => saveYahooConcurrency(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    yahooConcurrency === preset
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
                max={20}
                step={1}
                value={yahooConcurrency}
                onChange={e => saveYahooConcurrency(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-8 text-right">20</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-right">{yahooConcurrency}</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Yahoo Request Interval</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Yahoo 요청 사이 최소 간격(ms). 기본 200ms. 비공식 API이므로 0ms는 차단 위험.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[0, 100, 200, 500, 1000].map(preset => (
                <button
                  key={`yahoo-interval-${preset}`}
                  onClick={() => saveYahooRequestIntervalMs(preset)}
                  className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                    yahooRequestIntervalMs === preset
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {preset}ms
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-6">0</span>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={yahooRequestIntervalMs}
                onChange={e => saveYahooRequestIntervalMs(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[11px] text-gray-500 w-10 text-right">5000</span>
              <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-14 text-right">{yahooRequestIntervalMs}ms</span>
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-850">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Yahoo Skip Existing</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              이미 Yahoo description이 저장된 ticker는 건너뛸지 선택합니다. Off로 바꾸면 전체 덮어쓰기(overwrite) 모드.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => saveYahooSkipExisting(true)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  yahooSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Skip Existing
              </button>
              <button
                onClick={() => saveYahooSkipExisting(false)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  !yahooSkipExisting
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Overwrite All
              </button>
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
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setHowToContextMenu({ x: event.clientX, y: event.clientY, key });
                    }}
                    disabled={isRunning}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isRunning ? 'Update in progress...' : `Start ${label} update. Right click for how to use.`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
                    <span>{isRunning ? 'Running...' : 'Update'}</span>
                  </button>

                  <button
                    onClick={() => openHowToUseWindow(key)}
                    className="px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
                    title={`${label} how to use`}
                  >
                    <CircleHelp className="w-3 h-3" />
                    <span>How To Use</span>
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
          <div ref={logScrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900">
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
          </div>
          {/* Result summary */}
          {activeLog.status === 'done' && activeLog.result && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 shrink-0">
              ✓ Completed
              {activeLog.result.requested !== undefined && activeLog.result.totalRowsUpserted !== undefined && activeLog.result.tickersUpdated !== undefined && (
                <span> — requested {String(activeLog.result.requested)}, updated {String(activeLog.result.tickersUpdated)}, failed {String(activeLog.result.tickersFailed ?? 0)}, rows {String(activeLog.result.totalRowsUpserted)}</span>
              )}
              {activeLog.result.tickersUpdated !== undefined && activeLog.result.requested === undefined && (
                <span> — {String(activeLog.result.tickersUpdated)} tickers updated, {String(activeLog.result.tickersFailed)} failed, {String(activeLog.result.totalRowsUpserted)} rows</span>
              )}
              {activeLog.result.merged !== undefined && (
                <span> — {String(activeLog.result.merged)} merged, {String(activeLog.result.skipped)} skipped</span>
              )}
              {activeLog.result.route === '/api/news/change/update-custom' && (
                <span>
                  {' '}— range {String((activeLog.result.requestedRange as Record<string, unknown> | undefined)?.from ?? '?')} ~ {String((activeLog.result.requestedRange as Record<string, unknown> | undefined)?.to ?? '?')},
                  rows {String(activeLog.result.totalRowsInRange ?? 0)}, expected {String(activeLog.result.rowsExpectedToUpdate ?? 0)},
                  updated {String(activeLog.result.rowsUpdated ?? 0)}, skipped {String(activeLog.result.rowsSkipped ?? 0)}
                </span>
              )}
              {activeLog.result.route === '/api/ibkr/calendar/update-custom' && (
                <span>
                  {' '}— range {String((activeLog.result.requestedRange as Record<string, unknown> | undefined)?.from ?? '?')} ~ {String((activeLog.result.requestedRange as Record<string, unknown> | undefined)?.to ?? '?')},
                  tickers {String(activeLog.result.totalTickers ?? 0)}, existing events {String(activeLog.result.existingEventsInRange ?? 0)},
                  fetched {String(activeLog.result.fetchedEvents ?? 0)}, upserted {String(activeLog.result.upserted ?? 0)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {howToContextMenu && (
        <div
          ref={howToContextMenuRef}
          className="fixed z-50 min-w-[240px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1.5"
          style={{ top: howToContextMenu.y, left: howToContextMenu.x }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            onClick={() => openHowToUseWindow(howToContextMenu.key)}
            className="w-full rounded px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="font-medium text-gray-800 dark:text-gray-100">How To Use</div>
            <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{dataControlHowToUseRegistry[howToContextMenu.key].title}</div>
          </button>
        </div>
      )}

      {showCustomPreflightModal && customPreflightData && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-[42rem] max-w-[92vw] border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-500" />{customPreflightTitle}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">실행 전에 현재 coverage와 예상 처리 범위를 보여줍니다.</p>
            <pre className="max-h-[24rem] overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-[11px] leading-5 text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-all">{JSON.stringify(customPreflightData, null, 2)}</pre>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowCustomPreflightModal(false);
                  setCustomPreflightData(null);
                  setPendingCustomExecute(null);
                }}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >Cancel</button>
              <button
                onClick={() => {
                  const execute = pendingCustomExecute;
                  setShowCustomPreflightModal(false);
                  setCustomPreflightData(null);
                  setPendingCustomExecute(null);
                  execute?.();
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
