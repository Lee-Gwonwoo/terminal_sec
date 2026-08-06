import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Landmark, TrendingUp } from 'lucide-react';
import { Bar, Brush, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from './ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const API_BASE = '';

type PeriodMode = 'annual' | 'quarterly';

interface FinancialSeriesPoint {
  date: string;
  fiscalYear: string | null;
  period: string | null;
  label: string;
  revenue: number | null;
  revenueEstimate: number | null;
  netIncome: number | null;
  netIncomeEstimate: number | null;
  eps: number | null;
  epsEstimate: number | null;
  marketCap: number | null;
  peRatio: number | null;
  psRatio: number | null;
  numAnalystsRevenue: number | null;
  numAnalystsEps: number | null;
}

interface FinancialSeriesResponse {
  ticker: string;
  source: 'FMP';
  annual: FinancialSeriesPoint[];
  quarterly: FinancialSeriesPoint[];
}

interface CalendarFinancialDialogProps {
  open: boolean;
  ticker: string | null;
  companyName?: string | null;
  onOpenChange: (open: boolean) => void;
}

function roundMetric(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function formatCompactUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(2)}x`;
}

function formatPlainNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatAxisCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAxisRatio(value: number): string {
  return `${value.toFixed(1)}x`;
}

function hasSeriesValue(series: FinancialSeriesPoint[], key: keyof FinancialSeriesPoint): boolean {
  return series.some((point) => typeof point[key] === 'number' && Number.isFinite(point[key] as number));
}

function hasActualFinancialValue(point: FinancialSeriesPoint): boolean {
  return point.revenue != null || point.netIncome != null || point.eps != null;
}

function SummaryStat({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {subvalue ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subvalue}</div>
      ) : null}
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  icon,
  children,
  note,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {icon}
            {title}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
      </div>
      {children}
      {note ? (
        <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{note}</div>
      ) : null}
    </section>
  );
}

/** 추정치 막대 색 — 실적 막대와 확실히 구분되도록 회색 고정. */
const ESTIMATE_BAR_COLOR = '#94a3b8';

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/**
 * Y축 확대 배율에 맞춘 domain을 만든다.
 * 막대는 0에서 출발하므로 0을 항상 포함시키고, 배율로 범위를 좁혀 작은 값의 차이를 키운다.
 */
function computeZoomDomain(
  series: FinancialSeriesPoint[],
  keys: Array<keyof FinancialSeriesPoint>,
  zoom: number,
): [number, number] | undefined {
  let low = 0;
  let high = 0;
  let found = false;

  for (const point of series) {
    for (const key of keys) {
      const value = point[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        low = Math.min(low, value);
        high = Math.max(high, value);
        found = true;
      }
    }
  }

  if (!found || (low === 0 && high === 0)) {
    return undefined;
  }

  const span = high - low;
  const pad = span > 0 ? span * 0.08 : Math.abs(high || low) * 0.08;
  return [(low - pad) / zoom, (high + pad) / zoom];
}

/** 차트 오른쪽에 붙는 세로 Y축 확대/축소 바. */
function VerticalZoomBar({
  value,
  onChange,
  accentClassName,
}: {
  value: number;
  onChange: (next: number) => void;
  accentClassName: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 pb-8 pt-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Y</span>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Y-axis zoom"
        title="Y-axis zoom — drag up to magnify small differences"
        className={`h-[150px] w-4 cursor-pointer ${accentClassName}`}
        style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
      />
      <button
        type="button"
        onClick={() => onChange(MIN_ZOOM)}
        title="Reset zoom"
        className="rounded px-1 text-[10px] tabular-nums text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {value.toFixed(1)}x
      </button>
    </div>
  );
}

/** 차트 + 세로 확대바를 한 줄로 묶는다. */
function ZoomableChartFrame({
  zoom,
  onZoomChange,
  accentClassName,
  children,
}: {
  zoom: number;
  onZoomChange: (next: number) => void;
  accentClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <VerticalZoomBar value={zoom} onChange={onZoomChange} accentClassName={accentClassName} />
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      {message}
    </div>
  );
}

function ComparisonCell({
  actual,
  estimate,
  format,
}: {
  actual: number | null | undefined;
  estimate: number | null | undefined;
  format: (value: number | null | undefined) => string;
}) {
  const hasActual = typeof actual === 'number' && Number.isFinite(actual);
  const hasEstimate = typeof estimate === 'number' && Number.isFinite(estimate);

  if (!hasActual && !hasEstimate) {
    return <div className="text-xs text-slate-400 dark:text-slate-500">-</div>;
  }

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{hasActual ? format(actual) : '-'}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">Est. {hasEstimate ? format(estimate) : '-'}</div>
    </div>
  );
}

export function CalendarFinancialDialog({
  open,
  ticker,
  companyName,
  onOpenChange,
}: CalendarFinancialDialogProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('annual');
  const [cache, setCache] = useState<Record<string, FinancialSeriesResponse>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revenueZoom, setRevenueZoom] = useState(MIN_ZOOM);
  const [earningsZoom, setEarningsZoom] = useState(MIN_ZOOM);
  const [valuationZoom, setValuationZoom] = useState(MIN_ZOOM);

  const cachedResponse = ticker ? cache[ticker] ?? null : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setPeriodMode('annual');
  }, [open, ticker]);

  useEffect(() => {
    if (!open || !ticker) {
      return;
    }
    if (cachedResponse) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/calendar/financials/${encodeURIComponent(ticker)}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : `Financial fetch failed: HTTP ${response.status}`);
        }
        const payload = await response.json() as FinancialSeriesResponse;
        if (cancelled) {
          return;
        }
        setCache((previous) => ({
          ...previous,
          [ticker]: payload,
        }));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load financial history');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cachedResponse, open, ticker]);

  const activeSeries = useMemo(() => {
    const sourceSeries = periodMode === 'annual'
      ? cachedResponse?.annual ?? []
      : cachedResponse?.quarterly ?? [];

    return sourceSeries.map((point) => ({
      ...point,
      eps: roundMetric(point.eps),
      epsEstimate: roundMetric(point.epsEstimate),
      peRatio: roundMetric(point.peRatio),
      psRatio: roundMetric(point.psRatio),
    }));
  }, [cachedResponse, periodMode]);

  const historicalComparisonRows = useMemo(() => {
    const latestActualPoint = [...activeSeries].reverse().find(hasActualFinancialValue) ?? null;
    const comparisonSeries = latestActualPoint
      ? activeSeries.filter((point) => point.date <= latestActualPoint.date)
      : activeSeries;
    const maxRows = periodMode === 'annual' ? 10 : 12;
    return comparisonSeries.slice(-maxRows).reverse();
  }, [activeSeries, periodMode]);

  const latestPoint = activeSeries.length > 0 ? activeSeries[activeSeries.length - 1] : null;
  const summaryPoint = [...activeSeries].reverse().find(hasActualFinancialValue) ?? latestPoint;
  const revenueHasData = hasSeriesValue(activeSeries, 'revenue') || hasSeriesValue(activeSeries, 'revenueEstimate');
  const earningsHasData =
    hasSeriesValue(activeSeries, 'eps') || hasSeriesValue(activeSeries, 'epsEstimate');
  const valuationHasData = hasSeriesValue(activeSeries, 'peRatio') || hasSeriesValue(activeSeries, 'psRatio');

  // 기간을 바꾸면 확대 배율을 초기화한다 (스케일이 완전히 달라지므로).
  useEffect(() => {
    setRevenueZoom(MIN_ZOOM);
    setEarningsZoom(MIN_ZOOM);
    setValuationZoom(MIN_ZOOM);
  }, [periodMode, ticker]);

  const revenueDomain = computeZoomDomain(activeSeries, ['revenue', 'revenueEstimate'], revenueZoom);
  const epsDomain = computeZoomDomain(activeSeries, ['eps', 'epsEstimate'], earningsZoom);
  const valuationDomain = computeZoomDomain(activeSeries, ['peRatio', 'psRatio'], valuationZoom);

  // 가로 스크롤(Brush) 초기 구간 — 기본은 최근 구간을 보여주고, 끌어서 과거로 이동한다.
  const brushWindow = periodMode === 'annual' ? 10 : 12;
  const brushStartIndex = Math.max(0, activeSeries.length - brushWindow);
  const brushKey = `${ticker ?? ''}-${periodMode}-${activeSeries.length}`;
  const brushProps = {
    dataKey: 'label' as const,
    height: 22,
    travellerWidth: 10,
    startIndex: brushStartIndex,
    endIndex: Math.max(brushStartIndex, activeSeries.length - 1),
    stroke: '#94a3b8',
    fill: 'transparent',
  };
  const chartMargin = { left: 8, right: 8, top: 8, bottom: 4 };
  const estimateBarSize = periodMode === 'annual' ? 18 : 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 p-0 sm:max-w-6xl dark:border-slate-700">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader className="gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <DialogTitle className="text-left text-xl font-semibold text-slate-950 dark:text-slate-50">
                  {ticker ?? '-'} Financial View
                </DialogTitle>
                <DialogDescription className="mt-1 text-left text-sm text-slate-500 dark:text-slate-400">
                  {companyName ? `${companyName} · ` : ''}
                  FMP stable income statement, key metrics, ratios, and analyst estimates.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
                <button
                  onClick={() => setPeriodMode('annual')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${periodMode === 'annual' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  Annual
                </button>
                <button
                  onClick={() => setPeriodMode('quarterly')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${periodMode === 'quarterly' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  Quarterly
                </button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          {loading ? (
            <div className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Loading financial history...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : activeSeries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              No financial history is available for the selected ticker.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryStat
                  label={`${periodMode === 'annual' ? 'Annual' : 'Quarterly'} Revenue`}
                  value={formatCompactUsd(summaryPoint?.revenue ?? summaryPoint?.revenueEstimate)}
                  subvalue={summaryPoint?.revenueEstimate != null ? `Est. ${formatCompactUsd(summaryPoint.revenueEstimate)}` : undefined}
                />
                <SummaryStat
                  label="Net Income"
                  value={formatCompactUsd(summaryPoint?.netIncome ?? summaryPoint?.netIncomeEstimate)}
                  subvalue={summaryPoint?.netIncomeEstimate != null ? `Est. ${formatCompactUsd(summaryPoint.netIncomeEstimate)}` : undefined}
                />
                <SummaryStat
                  label="EPS"
                  value={formatPlainNumber(summaryPoint?.eps ?? summaryPoint?.epsEstimate)}
                  subvalue={summaryPoint?.epsEstimate != null ? `Est. ${formatPlainNumber(summaryPoint.epsEstimate)}` : undefined}
                />
                <SummaryStat label="P/E" value={formatRatio(latestPoint?.peRatio)} />
                <SummaryStat label="P/S" value={formatRatio(latestPoint?.psRatio)} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartPanel
                  title="Revenue"
                  subtitle={`Historical ${periodMode === 'annual' ? 'annual' : 'quarterly'} revenue`}
                  icon={<Landmark className="h-4 w-4 text-teal-500" />}
                  note="Gray bar (left) = analyst estimate, teal bar (right) = reported actual. Use the vertical bar on the right to zoom the Y axis, and the horizontal bar under the chart to scroll back through past periods."
                >
                  {revenueHasData ? (
                    <ZoomableChartFrame zoom={revenueZoom} onZoomChange={setRevenueZoom} accentClassName="accent-teal-500">
                      <ChartContainer
                        className="h-[300px] w-full aspect-auto"
                        config={{
                          revenueEstimate: { label: 'Revenue Estimate', color: ESTIMATE_BAR_COLOR },
                          revenue: { label: 'Revenue', color: '#14b8a6' },
                        }}
                      >
                        <ComposedChart key={brushKey} data={activeSeries} margin={chartMargin}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                          <YAxis
                            tickFormatter={formatAxisCompact}
                            width={78}
                            tickLine={false}
                            axisLine={false}
                            domain={revenueDomain ?? ['auto', 'auto']}
                            allowDataOverflow={revenueDomain != null}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          {/* 추정치를 먼저 선언해야 실적 막대 왼쪽에 놓인다. */}
                          <Bar dataKey="revenueEstimate" fill={ESTIMATE_BAR_COLOR} radius={[6, 6, 0, 0]} barSize={estimateBarSize} />
                          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} barSize={periodMode === 'annual' ? 26 : 18} />
                          <Brush {...brushProps} />
                        </ComposedChart>
                      </ChartContainer>
                    </ZoomableChartFrame>
                  ) : (
                    <EmptyChartState message="Revenue series is unavailable for this ticker." />
                  )}
                </ChartPanel>

                <ChartPanel
                  title="Earnings"
                  subtitle="EPS actual vs analyst estimate"
                  icon={<BarChart3 className="h-4 w-4 text-amber-500" />}
                  note="Gray bar (left) = EPS estimate, amber bar (right) = reported EPS. Net income is intentionally left off this chart — see the stat card above and the table below."
                >
                  {earningsHasData ? (
                    <ZoomableChartFrame zoom={earningsZoom} onZoomChange={setEarningsZoom} accentClassName="accent-amber-500">
                      <ChartContainer
                        className="h-[300px] w-full aspect-auto"
                        config={{
                          epsEstimate: { label: 'EPS Estimate', color: ESTIMATE_BAR_COLOR },
                          eps: { label: 'EPS', color: '#f59e0b' },
                        }}
                      >
                        <ComposedChart key={brushKey} data={activeSeries} margin={chartMargin}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                          <YAxis
                            tickFormatter={(value) => formatPlainNumber(value)}
                            width={64}
                            tickLine={false}
                            axisLine={false}
                            domain={epsDomain ?? ['auto', 'auto']}
                            allowDataOverflow={epsDomain != null}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          {/* 추정치를 먼저 선언해야 실적 막대 왼쪽에 놓인다. */}
                          <Bar dataKey="epsEstimate" fill={ESTIMATE_BAR_COLOR} radius={[6, 6, 0, 0]} barSize={estimateBarSize} />
                          <Bar dataKey="eps" fill="var(--color-eps)" radius={[6, 6, 0, 0]} barSize={periodMode === 'annual' ? 26 : 18} />
                          <Brush {...brushProps} />
                        </ComposedChart>
                      </ChartContainer>
                    </ZoomableChartFrame>
                  ) : (
                    <EmptyChartState message="EPS series is unavailable for this ticker." />
                  )}
                </ChartPanel>

                <div className="xl:col-span-2">
                  <ChartPanel
                    title="Valuation"
                    subtitle="P/E and P/S history"
                    icon={<TrendingUp className="h-4 w-4 text-sky-500" />}
                    note="FMP ratio fields are used first. Missing valuation points fall back to market cap divided by net income or revenue when available."
                  >
                    {valuationHasData ? (
                      <ZoomableChartFrame zoom={valuationZoom} onZoomChange={setValuationZoom} accentClassName="accent-sky-500">
                        <ChartContainer
                          className="h-[300px] w-full aspect-auto"
                          config={{
                            peRatio: { label: 'P/E', color: '#3b82f6' },
                            psRatio: { label: 'P/S', color: '#f97316' },
                          }}
                        >
                          <LineChart key={brushKey} data={activeSeries} margin={chartMargin}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                            <YAxis
                              tickFormatter={formatAxisRatio}
                              width={68}
                              tickLine={false}
                              axisLine={false}
                              domain={valuationDomain ?? ['auto', 'auto']}
                              allowDataOverflow={valuationDomain != null}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Line type="monotone" dataKey="peRatio" stroke="var(--color-peRatio)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="psRatio" stroke="var(--color-psRatio)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            <Brush {...brushProps} />
                          </LineChart>
                        </ChartContainer>
                      </ZoomableChartFrame>
                    ) : (
                      <EmptyChartState message="Valuation history is unavailable for this ticker." />
                    )}
                  </ChartPanel>
                </div>

                <div className="xl:col-span-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historical Actual vs Estimate</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Past periods keep the reported actuals and the then-available analyst estimate together so historical misses and beats stay visible.
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <th className="px-3 py-2 font-medium">Period</th>
                            <th className="px-3 py-2 font-medium">Revenue</th>
                            <th className="px-3 py-2 font-medium">Net Income</th>
                            <th className="px-3 py-2 font-medium">EPS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historicalComparisonRows.map((point) => (
                            <tr key={`${point.label}-${point.date}`} className="border-b border-slate-100 align-top dark:border-slate-800">
                              <td className="px-3 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{point.label}</td>
                              <td className="px-3 py-3">
                                <ComparisonCell actual={point.revenue} estimate={point.revenueEstimate} format={formatCompactUsd} />
                              </td>
                              <td className="px-3 py-3">
                                <ComparisonCell actual={point.netIncome} estimate={point.netIncomeEstimate} format={formatCompactUsd} />
                              </td>
                              <td className="px-3 py-3">
                                <ComparisonCell actual={point.eps} estimate={point.epsEstimate} format={formatPlainNumber} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}