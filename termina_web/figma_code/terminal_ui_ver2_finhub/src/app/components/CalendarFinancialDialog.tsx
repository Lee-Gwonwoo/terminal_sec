import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Landmark, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts';
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
    const maxRows = periodMode === 'annual' ? 10 : 12;
    return activeSeries.slice(-maxRows).reverse();
  }, [activeSeries, periodMode]);

  const latestPoint = activeSeries.length > 0 ? activeSeries[activeSeries.length - 1] : null;
  const revenueHasData = hasSeriesValue(activeSeries, 'revenue') || hasSeriesValue(activeSeries, 'revenueEstimate');
  const earningsHasData =
    hasSeriesValue(activeSeries, 'netIncome') ||
    hasSeriesValue(activeSeries, 'netIncomeEstimate') ||
    hasSeriesValue(activeSeries, 'eps') ||
    hasSeriesValue(activeSeries, 'epsEstimate');
  const valuationHasData = hasSeriesValue(activeSeries, 'peRatio') || hasSeriesValue(activeSeries, 'psRatio');

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
                  value={formatCompactUsd(latestPoint?.revenue ?? latestPoint?.revenueEstimate)}
                  subvalue={latestPoint?.revenueEstimate != null ? `Est. ${formatCompactUsd(latestPoint.revenueEstimate)}` : undefined}
                />
                <SummaryStat
                  label="Net Income"
                  value={formatCompactUsd(latestPoint?.netIncome ?? latestPoint?.netIncomeEstimate)}
                  subvalue={latestPoint?.netIncomeEstimate != null ? `Est. ${formatCompactUsd(latestPoint.netIncomeEstimate)}` : undefined}
                />
                <SummaryStat
                  label="EPS"
                  value={formatPlainNumber(latestPoint?.eps ?? latestPoint?.epsEstimate)}
                  subvalue={latestPoint?.epsEstimate != null ? `Est. ${formatPlainNumber(latestPoint.epsEstimate)}` : undefined}
                />
                <SummaryStat label="P/E" value={formatRatio(latestPoint?.peRatio)} />
                <SummaryStat label="P/S" value={formatRatio(latestPoint?.psRatio)} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartPanel
                  title="Revenue"
                  subtitle={`Historical ${periodMode === 'annual' ? 'annual' : 'quarterly'} revenue`}
                  icon={<Landmark className="h-4 w-4 text-teal-500" />}
                  note="Solid bar = actual revenue, dashed line = analyst revenue estimate when available."
                >
                  {revenueHasData ? (
                    <ChartContainer
                      className="h-[260px] w-full aspect-auto"
                      config={{
                        revenue: { label: 'Revenue', color: '#14b8a6' },
                        revenueEstimate: { label: 'Revenue Estimate', color: '#0f766e' },
                      }}
                    >
                      <ComposedChart data={activeSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                        <YAxis tickFormatter={formatAxisCompact} width={78} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} barSize={periodMode === 'annual' ? 42 : 28} />
                        <Line type="monotone" dataKey="revenueEstimate" stroke="var(--color-revenueEstimate)" strokeWidth={2.25} strokeDasharray="6 4" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <EmptyChartState message="Revenue series is unavailable for this ticker." />
                  )}
                </ChartPanel>

                <ChartPanel
                  title="Earnings"
                  subtitle="Net income and EPS trend"
                  icon={<BarChart3 className="h-4 w-4 text-amber-500" />}
                  note="Actual values are solid. Estimate lines come from FMP analyst-estimates when available."
                >
                  {earningsHasData ? (
                    <ChartContainer
                      className="h-[260px] w-full aspect-auto"
                      config={{
                        netIncome: { label: 'Net Income', color: '#fb7185' },
                        netIncomeEstimate: { label: 'Net Income Estimate', color: '#be185d' },
                        eps: { label: 'EPS', color: '#f59e0b' },
                        epsEstimate: { label: 'EPS Estimate', color: '#b45309' },
                      }}
                    >
                      <ComposedChart data={activeSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                        <YAxis yAxisId="income" tickFormatter={formatAxisCompact} width={78} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="eps" orientation="right" tickFormatter={(value) => formatPlainNumber(value)} width={52} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar yAxisId="income" dataKey="netIncome" fill="var(--color-netIncome)" radius={[8, 8, 0, 0]} barSize={periodMode === 'annual' ? 34 : 22} />
                        <Line yAxisId="income" type="monotone" dataKey="netIncomeEstimate" stroke="var(--color-netIncomeEstimate)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                        <Line yAxisId="eps" type="monotone" dataKey="eps" stroke="var(--color-eps)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line yAxisId="eps" type="monotone" dataKey="epsEstimate" stroke="var(--color-epsEstimate)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <EmptyChartState message="Net income or EPS series is unavailable for this ticker." />
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
                      <ChartContainer
                        className="h-[280px] w-full aspect-auto"
                        config={{
                          peRatio: { label: 'P/E', color: '#3b82f6' },
                          psRatio: { label: 'P/S', color: '#f97316' },
                        }}
                      >
                        <LineChart data={activeSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                          <YAxis tickFormatter={formatAxisRatio} width={68} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line type="monotone" dataKey="peRatio" stroke="var(--color-peRatio)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="psRatio" stroke="var(--color-psRatio)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ChartContainer>
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