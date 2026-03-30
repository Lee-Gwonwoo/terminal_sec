import { getDb } from "../db.js";
import { ensureDerivedColumns, getOhlcDb, getOverallMaxDate } from "./ohlcWatchlistRepository.js";
import { listUniverses } from "./tickerUniverseRepository.js";

type DefaultUniverseBaseRow = {
  ticker: string;
  exchange: string | null;
  name: string | null;
  industry: string | null;
  marketCap: number | null;
  marketCapSource: string | null;
};

type OhlcSnapshotRow = {
  Symbol: string;
  Datetime: string;
  Open: number | null;
  Close: number | null;
  StoredDailyChangePct: number | null;
  StoredCloseFromOpenPct: number | null;
  DailyChangePct: number | null;
  CloseFromOpenPct: number | null;
  Turnover: number | null;
};

type SummaryCounts = {
  gainers: number;
  losers: number;
  flat: number;
  missing: number;
};

export type DailyChangeHistoryParams = {
  selectedDate?: string;
  marketCapMin?: number;
  marketCapMax?: number;
  turnoverMin?: number;
  turnoverMax?: number;
};

export type DailyChangeHistoryRow = {
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
};

export type DailyChangeHistoryResult = {
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
    dailyChange: SummaryCounts;
    closeFromOpen: SummaryCounts;
  };
  rows: DailyChangeHistoryRow[];
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function passesMarketCapFilter(marketCap: number | null, marketCapMin?: number, marketCapMax?: number): boolean {
  return passesNumericRangeFilter(marketCap, marketCapMin, marketCapMax);
}

function passesNumericRangeFilter(value: number | null, min?: number, max?: number): boolean {
  if (min == null && max == null) {
    return true;
  }
  if (value == null || !Number.isFinite(value)) {
    return false;
  }
  if (min != null && value < min) {
    return false;
  }
  if (max != null && value > max) {
    return false;
  }
  return true;
}

async function getDefaultUniverseBaseRows(): Promise<DefaultUniverseBaseRow[]> {
  const universes = await listUniverses();
  const defaultUniverse = universes.find((universe) => universe.name === "default");
  if (!defaultUniverse) {
    return [];
  }

  const rows = await getDb().all<Array<{
    ticker: string;
    exchange: string | null;
    name: string | null;
    industry: string | null;
    market_cap: number | null;
    market_cap_source: string | null;
  }>>(
    `SELECT s.ticker,
            s.exchange,
            s.name,
            s.industry,
            (
              SELECT cp.market_cap
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS market_cap,
            (
              SELECT cp.market_cap_source
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS market_cap_source
     FROM ticker_universe_items ui
     JOIN securities s ON s.id = ui.security_id
     WHERE ui.universe_id = ?
     ORDER BY ui.sort_order, s.ticker`,
    [defaultUniverse.id],
  );

  return rows.map((row) => ({
    ticker: row.ticker,
    exchange: row.exchange ?? null,
    name: row.name ?? null,
    industry: row.industry ?? null,
    marketCap: row.market_cap ?? null,
    marketCapSource: row.market_cap_source ?? null,
  }));
}

async function getOhlcSnapshotsForDate(selectedDate: string, tickers: string[]): Promise<Map<string, OhlcSnapshotRow>> {
  if (tickers.length === 0) {
    return new Map();
  }

  await ensureDerivedColumns();
  const db = await getOhlcDb();
  const rows: OhlcSnapshotRow[] = [];

  for (const chunk of chunkArray(tickers, 400)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const chunkRows = await db.all<OhlcSnapshotRow[]>(
      `WITH history AS (
         SELECT Symbol,
                Datetime,
                Open,
                Close,
                Volume,
                Change_1d_Pct,
                Change_From_Open_Pct,
                Turnover,
                LAG(Close) OVER (PARTITION BY Symbol ORDER BY Datetime) AS prev_close
         FROM ohlc_1d
         WHERE Symbol IN (${placeholders}) AND Datetime <= ?
       )
       SELECT Symbol,
              Datetime,
              Open,
              Close,
              Change_1d_Pct AS StoredDailyChangePct,
              Change_From_Open_Pct AS StoredCloseFromOpenPct,
              COALESCE(Turnover, ROUND(Volume * ((Open + Close) / 2.0), 4)) AS Turnover,
              CASE
                WHEN Change_1d_Pct IS NOT NULL THEN Change_1d_Pct
                WHEN prev_close IS NULL OR prev_close = 0 OR Close IS NULL THEN NULL
                ELSE ((Close - prev_close) / prev_close) * 100.0
              END AS DailyChangePct,
              CASE
                WHEN Change_From_Open_Pct IS NOT NULL THEN Change_From_Open_Pct
                WHEN Open IS NULL OR Open = 0 OR Close IS NULL THEN NULL
                ELSE ((Close - Open) / Open) * 100.0
              END AS CloseFromOpenPct
       FROM history
       WHERE Datetime = ?`,
      [...chunk, selectedDate, selectedDate],
    );
    rows.push(...chunkRows);
  }

  return new Map(rows.map((row) => [row.Symbol.toUpperCase(), row]));
}

function reduceMetricSummary(
  rows: DailyChangeHistoryRow[],
  pickValue: (row: DailyChangeHistoryRow) => number | null,
): SummaryCounts {
  return rows.reduce<SummaryCounts>(
    (accumulator, row) => {
      const value = pickValue(row);
      if (value == null) {
        accumulator.missing += 1;
      } else if (value > 0) {
        accumulator.gainers += 1;
      } else if (value < 0) {
        accumulator.losers += 1;
      } else {
        accumulator.flat += 1;
      }
      return accumulator;
    },
    { gainers: 0, losers: 0, flat: 0, missing: 0 },
  );
}

export async function getDefaultDailyChangeHistory(params: DailyChangeHistoryParams): Promise<DailyChangeHistoryResult> {
  const availableMaxDate = await getOverallMaxDate();
  const selectedDate = params.selectedDate ?? availableMaxDate;
  if (!selectedDate) {
    return {
      selectedDate: null,
      defaultDate: null,
      availableMaxDate: null,
      marketCapFilter: {
        min: params.marketCapMin ?? null,
        max: params.marketCapMax ?? null,
      },
      turnoverFilter: {
        min: params.turnoverMin ?? null,
        max: params.turnoverMax ?? null,
      },
      summary: {
        total: 0,
        dailyChange: { gainers: 0, losers: 0, flat: 0, missing: 0 },
        closeFromOpen: { gainers: 0, losers: 0, flat: 0, missing: 0 },
      },
      rows: [],
    };
  }

  const baseRows = await getDefaultUniverseBaseRows();
  const marketCapFilteredRows = baseRows.filter((row) => passesMarketCapFilter(row.marketCap, params.marketCapMin, params.marketCapMax));
  const ohlcSnapshotMap = await getOhlcSnapshotsForDate(selectedDate, marketCapFilteredRows.map((row) => row.ticker));

  const rows: DailyChangeHistoryRow[] = marketCapFilteredRows.map((row) => {
    const ohlcRow = ohlcSnapshotMap.get(row.ticker.toUpperCase());
    return {
      ticker: row.ticker,
      exchange: row.exchange,
      name: row.name,
      industry: row.industry,
      date: selectedDate,
      close: ohlcRow?.Close ?? null,
      dailyChangePct: ohlcRow?.DailyChangePct ?? null,
      closeFromOpenPct: ohlcRow?.CloseFromOpenPct ?? null,
      turnover: ohlcRow?.Turnover ?? null,
      marketCap: row.marketCap,
      marketCapSource: row.marketCapSource,
      hasOhlcData: Boolean(ohlcRow),
    };
  }).filter((row) => passesNumericRangeFilter(row.turnover, params.turnoverMin, params.turnoverMax));

  rows.sort((left, right) => {
    const leftValue = left.dailyChangePct;
    const rightValue = right.dailyChangePct;
    if (leftValue == null && rightValue == null) {
      return left.ticker.localeCompare(right.ticker);
    }
    if (leftValue == null) {
      return 1;
    }
    if (rightValue == null) {
      return -1;
    }
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.ticker.localeCompare(right.ticker);
  });

  const summary = {
    total: rows.length,
    dailyChange: reduceMetricSummary(rows, (row) => row.dailyChangePct),
    closeFromOpen: reduceMetricSummary(rows, (row) => row.closeFromOpenPct),
  };

  return {
    selectedDate,
    defaultDate: availableMaxDate,
    availableMaxDate,
    marketCapFilter: {
      min: params.marketCapMin ?? null,
      max: params.marketCapMax ?? null,
    },
    turnoverFilter: {
      min: params.turnoverMin ?? null,
      max: params.turnoverMax ?? null,
    },
    summary,
    rows,
  };
}