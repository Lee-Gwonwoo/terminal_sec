import { getDb } from "../db.js";
import type { FmpFinancialSeriesPoint, FmpFinancialSeriesResponse } from "./fmpFinancialSeriesProvider.js";

type StoredFinancialRow = {
  ticker: string;
  period_type: "annual" | "quarterly";
  report_date: string;
  fiscal_year: string | null;
  fiscal_period: string | null;
  label: string;
  revenue: number | null;
  revenue_estimate: number | null;
  net_income: number | null;
  net_income_estimate: number | null;
  eps: number | null;
  eps_estimate: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  ps_ratio: number | null;
  num_analysts_revenue: number | null;
  num_analysts_eps: number | null;
};

function mapStoredPoint(row: StoredFinancialRow): FmpFinancialSeriesPoint {
  return {
    date: row.report_date,
    fiscalYear: row.fiscal_year,
    period: row.fiscal_period,
    label: row.label,
    revenue: row.revenue,
    revenueEstimate: row.revenue_estimate,
    netIncome: row.net_income,
    netIncomeEstimate: row.net_income_estimate,
    eps: row.eps,
    epsEstimate: row.eps_estimate,
    marketCap: row.market_cap,
    peRatio: row.pe_ratio,
    psRatio: row.ps_ratio,
    numAnalystsRevenue: row.num_analysts_revenue,
    numAnalystsEps: row.num_analysts_eps,
  };
}

function mergeAnnualStoredPoints(points: FmpFinancialSeriesPoint[]): FmpFinancialSeriesPoint[] {
  const merged = new Map<string, FmpFinancialSeriesPoint>();

  for (const point of points) {
    const key = (point.fiscalYear ?? point.label ?? point.date.slice(0, 4)).trim();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...point,
        fiscalYear: point.fiscalYear ?? key,
      });
      continue;
    }

    existing.revenue ??= point.revenue;
    existing.revenueEstimate ??= point.revenueEstimate;
    existing.netIncome ??= point.netIncome;
    existing.netIncomeEstimate ??= point.netIncomeEstimate;
    existing.eps ??= point.eps;
    existing.epsEstimate ??= point.epsEstimate;
    existing.marketCap ??= point.marketCap;
    existing.peRatio ??= point.peRatio;
    existing.psRatio ??= point.psRatio;
    existing.numAnalystsRevenue ??= point.numAnalystsRevenue;
    existing.numAnalystsEps ??= point.numAnalystsEps;

    if (existing.fiscalYear == null && point.fiscalYear != null) {
      existing.fiscalYear = point.fiscalYear;
    }
    if (existing.period == null && point.period != null) {
      existing.period = point.period;
    }
    if (point.date < existing.date) {
      existing.date = point.date;
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function resolveStorageReportDate(
  periodType: "annual" | "quarterly",
  point: FmpFinancialSeriesPoint,
): string {
  if (periodType === "annual" && point.fiscalYear && /^\d{4}$/.test(point.fiscalYear)) {
    return `${point.fiscalYear}-12-31`;
  }
  return point.date;
}

function mergeSnapshotPoints(
  periodType: "annual" | "quarterly",
  points: FmpFinancialSeriesPoint[],
): FmpFinancialSeriesPoint[] {
  const merged = new Map<string, FmpFinancialSeriesPoint>();

  for (const point of points) {
    const reportDate = resolveStorageReportDate(periodType, point);
    const existing = merged.get(reportDate);
    if (!existing) {
      merged.set(reportDate, {
        ...point,
        date: reportDate,
      });
      continue;
    }

    existing.revenue ??= point.revenue;
    existing.revenueEstimate ??= point.revenueEstimate;
    existing.netIncome ??= point.netIncome;
    existing.netIncomeEstimate ??= point.netIncomeEstimate;
    existing.eps ??= point.eps;
    existing.epsEstimate ??= point.epsEstimate;
    existing.marketCap ??= point.marketCap;
    existing.peRatio ??= point.peRatio;
    existing.psRatio ??= point.psRatio;
    existing.numAnalystsRevenue ??= point.numAnalystsRevenue;
    existing.numAnalystsEps ??= point.numAnalystsEps;

    if (existing.fiscalYear == null && point.fiscalYear != null) {
      existing.fiscalYear = point.fiscalYear;
    }
    if (existing.period == null && point.period != null) {
      existing.period = point.period;
    }
    if ((!existing.label || existing.label === existing.date) && point.label) {
      existing.label = point.label;
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export async function replaceCalendarFinancialSeriesSnapshot(
  payload: FmpFinancialSeriesResponse,
): Promise<void> {
  const db = getDb();
  const ticker = payload.ticker.trim().toUpperCase();
  const annualPoints = mergeSnapshotPoints("annual", payload.annual);
  const quarterlyPoints = mergeSnapshotPoints("quarterly", payload.quarterly);
  const insertSql = `
    INSERT INTO calendar_financial_series (
      ticker,
      period_type,
      report_date,
      fiscal_year,
      fiscal_period,
      label,
      revenue,
      revenue_estimate,
      net_income,
      net_income_estimate,
      eps,
      eps_estimate,
      market_cap,
      pe_ratio,
      ps_ratio,
      num_analysts_revenue,
      num_analysts_eps,
      source,
      fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FMP', datetime('now'))
  `;

  await db.run("BEGIN IMMEDIATE");
  try {
    await db.run("DELETE FROM calendar_financial_series WHERE ticker = ?", ticker);
    const statement = await db.prepare(insertSql);
    try {
      const insertSeries = async (periodType: "annual" | "quarterly", points: FmpFinancialSeriesPoint[]) => {
        for (const point of points) {
          await statement.run(
            ticker,
            periodType,
            point.date,
            point.fiscalYear,
            point.period,
            point.label,
            point.revenue,
            point.revenueEstimate,
            point.netIncome,
            point.netIncomeEstimate,
            point.eps,
            point.epsEstimate,
            point.marketCap,
            point.peRatio,
            point.psRatio,
            point.numAnalystsRevenue,
            point.numAnalystsEps,
          );
        }
      };

      await insertSeries("annual", annualPoints);
      await insertSeries("quarterly", quarterlyPoints);
    } finally {
      await statement.finalize();
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

export async function getStoredCalendarFinancialSeries(
  ticker: string,
): Promise<FmpFinancialSeriesResponse | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    return null;
  }

  const rows = await getDb().all<StoredFinancialRow[]>(
    `SELECT ticker,
            period_type,
            report_date,
            fiscal_year,
            fiscal_period,
            label,
            revenue,
            revenue_estimate,
            net_income,
            net_income_estimate,
            eps,
            eps_estimate,
            market_cap,
            pe_ratio,
            ps_ratio,
            num_analysts_revenue,
            num_analysts_eps
     FROM calendar_financial_series
     WHERE ticker = ?
     ORDER BY period_type ASC, report_date ASC, COALESCE(fiscal_year, '') ASC, COALESCE(fiscal_period, '') ASC`,
    normalizedTicker,
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    ticker: normalizedTicker,
    source: "FMP",
    annual: mergeAnnualStoredPoints(rows.filter((row) => row.period_type === "annual").map(mapStoredPoint)),
    quarterly: rows.filter((row) => row.period_type === "quarterly").map(mapStoredPoint),
  };
}