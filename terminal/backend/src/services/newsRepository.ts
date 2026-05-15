import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import type { Model1NewsItem, NewsItem, NewsQuery } from "../types.js";
import { canonicalizePublisherLabel } from "./finnhubNewsProvider.js";
import { getIndustry } from "./industryLookup.js";
import { VOLATILITY_METRIC_KEYS } from "./newsVolatilityMetrics.js";

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function capLimitByRangeDays(rangeDays?: number): number {
  if (typeof rangeDays !== "number" || !Number.isFinite(rangeDays) || rangeDays <= 0) {
    return 500;
  }
  if (rangeDays <= 7) {
    return 500;
  }
  if (rangeDays <= 31) {
    return 500;
  }
  return 500;
}

function computeRangeDays(from?: string, to?: string): number | undefined {
  if (!from || !to) {
    return undefined;
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return undefined;
  }
  const diffMs = Math.abs(toMs - fromMs);
  return Math.floor(diffMs / 86_400_000) + 1;
}

function decodeCursor(cursor?: string): { publishedAt: string; id: string } | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const [publishedAt, id] = decoded.split("|");
  if (!publishedAt || !id) {
    return undefined;
  }

  return { publishedAt, id };
}

function encodeCursor(item: Pick<NewsItem, "published_at" | "id">): string {
  return Buffer.from(`${item.published_at}|${item.id}`).toString("base64");
}

type CompanyProfileNumericField = "float_pct" | "institutional_pct" | "insider_pct";

function buildPrimaryTickerSql(alias: string): string {
  return `CASE
    WHEN ${alias}.tickers_csv IS NULL OR TRIM(${alias}.tickers_csv) = '' THEN NULL
    WHEN instr(substr(${alias}.tickers_csv, 2), ',') <= 0 THEN NULL
    ELSE substr(${alias}.tickers_csv, 2, instr(substr(${alias}.tickers_csv, 2), ',') - 1)
  END`;
}

function buildPrimaryTickerIndustrySql(alias: string): string {
  const primaryTickerSql = buildPrimaryTickerSql(alias);
  return `(
    SELECT s.industry
    FROM securities s
    WHERE s.ticker = ${primaryTickerSql}
      AND s.industry IS NOT NULL
      AND TRIM(s.industry) != ''
    ORDER BY s.id ASC
    LIMIT 1
  )`;
}

function normalizeIndustryFilters(industries: string[] | undefined): string[] {
  return Array.from(new Set(
    (industries ?? [])
      .map((industry) => industry.trim().toLowerCase())
      .filter(Boolean),
  ));
}

async function getTickersForIndustryFilters(industries: string[] | undefined): Promise<string[] | undefined> {
  const industryFilters = normalizeIndustryFilters(industries);
  if (industryFilters.length === 0) {
    return undefined;
  }

  const placeholders = industryFilters.map(() => "?").join(",");
  const rows = await getDb().all<Array<{ ticker: string }>>(
    `SELECT DISTINCT ticker
     FROM securities
     WHERE industry IS NOT NULL
       AND TRIM(industry) != ''
       AND LOWER(TRIM(industry)) IN (${placeholders})`,
    industryFilters,
  );
  return rows.map((row) => row.ticker.toUpperCase()).filter(Boolean);
}

function appendIndustryTickerWhereClause(where: string[], values: unknown[], newsAlias: string, tickers: string[] | undefined): void {
  if (!tickers) {
    return;
  }
  if (tickers.length === 0) {
    where.push("1 = 0");
    return;
  }

  const placeholders = tickers.map(() => "?").join(",");
  where.push(`${buildPrimaryTickerSql(newsAlias)} IN (${placeholders})`);
  values.push(...tickers);
}

function buildLatestCompanyProfileScalarSql(
  alias: string,
  fieldName: CompanyProfileNumericField,
  valueConditionSql: string,
): string {
  const primaryTickerSql = buildPrimaryTickerSql(alias);
  return `(
    SELECT cp.${fieldName}
    FROM company_profiles cp
    JOIN securities s ON s.id = cp.security_id
    WHERE s.ticker = ${primaryTickerSql}
      AND ${valueConditionSql}
    ORDER BY cp.fetched_at DESC, cp.id DESC
    LIMIT 1
  )`;
}

function appendNumericRangeWhereClause(
  where: string[],
  values: unknown[],
  valueSql: string,
  minValue?: number,
  maxValue?: number,
): void {
  if (typeof minValue === "number" && Number.isFinite(minValue)) {
    where.push(`${valueSql} >= ?`);
    values.push(minValue);
  }
  if (typeof maxValue === "number" && Number.isFinite(maxValue)) {
    where.push(`${valueSql} <= ?`);
    values.push(maxValue);
  }
}

function buildMetricJoinAlias(metricKey: string): string {
  return `cm_${metricKey}`;
}

function buildVolatilityMetricSql(newsAlias: string): { selectSql: string; joinSql: string } {
  return {
    selectSql: VOLATILITY_METRIC_KEYS
      .map((metricKey) => `${buildMetricJoinAlias(metricKey)}.value_pct AS ${metricKey}`)
      .join(",\n           "),
    joinSql: VOLATILITY_METRIC_KEYS
      .map(
        (metricKey) => `LEFT JOIN news_change_metrics ${buildMetricJoinAlias(metricKey)} ON ${buildMetricJoinAlias(metricKey)}.news_id = ${newsAlias}.id AND ${buildMetricJoinAlias(metricKey)}.metric_key = '${metricKey}'`,
      )
      .join("\n    "),
  };
}

export interface IsoDateRange {
  from: string;
  to: string;
}

export interface NewsEarningsCandidate {
  id: string;
  publishedAt: string;
  tickers: string[];
  ohlcTicker: string | null;
  existingLookupStatus: string | null;
  existingRecentEarningsDate: string | null;
  existingRecentEarningsConfirmed: boolean | null;
  existingUpcomingEarningsDate: string | null;
  existingUpcomingEarningsConfirmed: boolean | null;
  existingLastCheckedAt: string | null;
}

export interface TickerNewsCoverage {
  /** min/max envelope: single range from earliest to latest existing data date, or empty */
  coveredRanges: IsoDateRange[];
}

export async function getTickerNewsCoverage(params: {
  tickers: string[];
  source: string;
  sourceType: string;
  from: string;
  to: string;
}): Promise<Map<string, TickerNewsCoverage>> {
  const normalizedTickers = Array.from(
    new Set(params.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)),
  );
  const tickerSet = new Set(normalizedTickers);

  if (normalizedTickers.length === 0) {
    return new Map();
  }

  const rows = await getDb().all<{ tickers_csv: string; min_date: string; max_date: string }[]>(
    `SELECT tickers_csv,
            MIN(substr(published_at, 1, 10)) AS min_date,
            MAX(substr(published_at, 1, 10)) AS max_date
     FROM news_items
     WHERE source = ?
       AND source_type = ?
       AND published_at >= ?
       AND published_at <= ?
     GROUP BY tickers_csv`,
    [params.source, params.sourceType, params.from, `${params.to}T23:59:59.999Z`],
  );

  // Per-ticker min/max tracking
  const minMaxMap = new Map<string, { min: string; max: string }>();
  for (const row of rows) {
    const rowTickers = splitCsvEnvelope(row.tickers_csv);
    for (const ticker of rowTickers) {
      if (!tickerSet.has(ticker)) continue;
      const existing = minMaxMap.get(ticker);
      if (!existing) {
        minMaxMap.set(ticker, { min: row.min_date, max: row.max_date });
      } else {
        if (row.min_date < existing.min) existing.min = row.min_date;
        if (row.max_date > existing.max) existing.max = row.max_date;
      }
    }
  }

  const result = new Map<string, TickerNewsCoverage>();
  for (const ticker of normalizedTickers) {
    const mm = minMaxMap.get(ticker);
    result.set(ticker, {
      coveredRanges: mm ? [{ from: mm.min, to: mm.max }] : [],
    });
  }

  return result;
}

export async function getNews(query: NewsQuery): Promise<{ items: NewsItem[]; nextCursor?: string }> {
  const where: string[] = [];
  const values: unknown[] = [];
  let extraJoins = "";
  const industryTickers = await getTickersForIndustryFilters(query.industries);

  // Bookmark folder filter: join bookmark_items to restrict to bookmarked news
  if (query.bookmarkFolderId) {
    extraJoins += ` INNER JOIN bookmark_items bi ON bi.news_id = ni.id AND bi.folder_id = ?`;
    values.push(query.bookmarkFolderId);
  }

  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push(`LOWER(ni.title || ' ' || ni.body) LIKE ?`);
  }

  if (query.tickers?.length) {
    const tickerClauses = query.tickers.map(() => "ni.tickers_csv LIKE ?");
    for (const ticker of query.tickers) {
      values.push(`%,${ticker.toUpperCase()},%`);
    }
    where.push(`(${tickerClauses.join(" OR ")})`);
  }

  if (query.sources?.length) {
    const sourcePlaceholders = query.sources.map(() => "?").join(",");
    values.push(...query.sources);
    where.push(`ni.source_type IN (${sourcePlaceholders})`);
  }

  if (query.sourceNames?.length) {
    const sourcePlaceholders = query.sourceNames.map(() => "?").join(",");
    values.push(...query.sourceNames);
    where.push(`ni.source IN (${sourcePlaceholders})`);
  }

  if (query.tags?.length) {
    const tagClauses = query.tags.map(() => "ni.tags_csv LIKE ?");
    for (const tag of query.tags) {
      values.push(`%,${tag.toLowerCase()},%`);
    }
    where.push(`(${tagClauses.join(" OR ")})`);
  }

  appendIndustryTickerWhereClause(where, values, "ni", industryTickers);

  if (query.from) {
    values.push(query.from);
    where.push(`ni.published_at >= ?`);
  }

  if (query.to) {
    values.push(`${query.to}T23:59:59.999Z`);
    where.push(`ni.published_at <= ?`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    values.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    where.push(`(ni.published_at < ? OR (ni.published_at = ? AND ni.id < ?))`);
  }

  const floatPctSql = buildLatestCompanyProfileScalarSql("ni", "float_pct", "cp.float_pct IS NOT NULL");
  const institutionalPctSql = buildLatestCompanyProfileScalarSql(
    "ni",
    "institutional_pct",
    "cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'",
  );
  const insiderPctSql = buildLatestCompanyProfileScalarSql("ni", "insider_pct", "cp.insider_pct IS NOT NULL");
  const securityIndustrySql = buildPrimaryTickerIndustrySql("ni");

  appendNumericRangeWhereClause(where, values, floatPctSql, query.floatPctMin, query.floatPctMax);
  appendNumericRangeWhereClause(
    where,
    values,
    institutionalPctSql,
    query.institutionalPctMin,
    query.institutionalPctMax,
  );
  appendNumericRangeWhereClause(where, values, insiderPctSql, query.insiderPctMin, query.insiderPctMax);

  const requestedLimit = typeof query.limit === "number" && Number.isFinite(query.limit) ? query.limit : 500;
  const rangeDays = computeRangeDays(query.from, query.to);
  const policyMax = capLimitByRangeDays(rangeDays);
  const limit = clampInt(Math.min(requestedLimit, policyMax), 1, 500);
  values.push(limit + 1);

  const volatilityMetricSql = buildVolatilityMetricSql("ni");

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const newsItemsSourceSql = industryTickers
    ? "news_items ni INDEXED BY idx_news_items_primary_ticker_published"
    : "news_items ni";
  const sql = `
    WITH candidate_news AS (
      SELECT ni.id, ni.published_at
      FROM ${newsItemsSourceSql}
      ${extraJoins}
      ${whereSql}
      ORDER BY ni.published_at DESC, ni.id DESC
      LIMIT ?
    )
        SELECT ni.id, ni.published_at, ni.source, ni.publisher, COALESCE(ni.origin_url, sf.filing_url, sf.report_url) AS origin_url, ni.source_type, ni.title, ni.body, ni.url, ni.tickers_csv, ni.tags_csv, ni.created_at,
          nec.context_ticker AS earnings_context_ticker,
          nec.recent_earnings_date,
          nec.recent_earnings_confirmed,
          nec.upcoming_earnings_date,
          nec.upcoming_earnings_confirmed,
          nec.lookup_status AS earnings_lookup_status,
           cm_1d.ohlc_ticker,
           cm_chg.target_date AS ohlc_date,
           cm_chg.target_date AS change_pct_ohlc_date,
           cm_1d.target_date AS change_1d_target_date,
           cm_chg.value_pct AS change_pct,
           cm_1d.value_pct AS change_1d_pct,
           cm_open.value_pct AS change_from_open_pct,
           cm_oth.value_pct AS change_open_to_high_pct,
           cm_3d.value_pct AS change_3d_pct,
           cm_7d.value_pct AS change_7d_pct,
           cm_14d.value_pct AS change_14d_pct,
           cm_30d.value_pct AS change_30d_pct,
           ${volatilityMetricSql.selectSql},
           cm_1d.computed_at AS change_computed_at,
           CASE WHEN nf.extraction_status = 'success' THEN 1 ELSE 0 END AS has_full_text,
           nf.keywords_json, nf.keywords_status,
           naa.score AS ai_score,
           naa.score_evidence AS ai_score_evidence,
           naa.analysis_status AS ai_analysis_status,
              naa.keywords_json AS ai_keywords_json,
              ${securityIndustrySql} AS security_industry,
              ${floatPctSql} AS float_pct,
              ${institutionalPctSql} AS institutional_pct,
              ${insiderPctSql} AS insider_pct
          FROM candidate_news cn
          JOIN news_items ni ON ni.id = cn.id
    LEFT JOIN sec_filings sf ON sf.news_id = ni.id
    LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
    LEFT JOIN news_earnings_context nec ON nec.news_id = ni.id
    LEFT JOIN news_change_metrics cm_chg ON cm_chg.news_id = ni.id AND cm_chg.metric_key = 'change_pct'
    LEFT JOIN news_change_metrics cm_1d ON cm_1d.news_id = ni.id AND cm_1d.metric_key = 'change_1d_pct'
    LEFT JOIN news_change_metrics cm_open ON cm_open.news_id = ni.id AND cm_open.metric_key = 'change_from_open_pct'
    LEFT JOIN news_change_metrics cm_oth ON cm_oth.news_id = ni.id AND cm_oth.metric_key = 'change_open_to_high_pct'
    LEFT JOIN news_change_metrics cm_3d ON cm_3d.news_id = ni.id AND cm_3d.metric_key = 'change_3d_pct'
    LEFT JOIN news_change_metrics cm_7d ON cm_7d.news_id = ni.id AND cm_7d.metric_key = 'change_7d_pct'
    LEFT JOIN news_change_metrics cm_14d ON cm_14d.news_id = ni.id AND cm_14d.metric_key = 'change_14d_pct'
    LEFT JOIN news_change_metrics cm_30d ON cm_30d.news_id = ni.id AND cm_30d.metric_key = 'change_30d_pct'
    ${volatilityMetricSql.joinSql}
    LEFT JOIN news_ai_analysis naa ON naa.news_id = ni.id
    ORDER BY cn.published_at DESC, cn.id DESC
  `;

  const rows = await getDb().all<any[]>(sql, values);
  const { sentimentMap, peersMap, marketCapMap, descMap, ipoMap } = await loadNewsEnrichmentMaps(rows);
  const mapped = rows.map((row) => mapNewsRow(row, sentimentMap, peersMap, descMap, marketCapMap, ipoMap));
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : undefined;

  return { items, nextCursor };
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const floatPctSql = buildLatestCompanyProfileScalarSql("ni", "float_pct", "cp.float_pct IS NOT NULL");
  const institutionalPctSql = buildLatestCompanyProfileScalarSql(
    "ni",
    "institutional_pct",
    "cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'",
  );
  const insiderPctSql = buildLatestCompanyProfileScalarSql("ni", "insider_pct", "cp.insider_pct IS NOT NULL");
  const securityIndustrySql = buildPrimaryTickerIndustrySql("ni");
  const volatilityMetricSql = buildVolatilityMetricSql("ni");
  const row = await getDb().get<any>(
        `SELECT ni.id, ni.published_at, ni.source, ni.publisher, COALESCE(ni.origin_url, sf.filing_url, sf.report_url) AS origin_url, ni.source_type, ni.title, ni.body, ni.url, ni.tickers_csv, ni.tags_csv, ni.created_at,
          nec.context_ticker AS earnings_context_ticker,
          nec.recent_earnings_date,
          nec.recent_earnings_confirmed,
          nec.upcoming_earnings_date,
          nec.upcoming_earnings_confirmed,
          nec.lookup_status AS earnings_lookup_status,
            cm_1d.ohlc_ticker,
            cm_chg.target_date AS ohlc_date,
            cm_chg.target_date AS change_pct_ohlc_date,
            cm_1d.target_date AS change_1d_target_date,
            cm_chg.value_pct AS change_pct,
            cm_1d.value_pct AS change_1d_pct,
            cm_open.value_pct AS change_from_open_pct,
            cm_oth.value_pct AS change_open_to_high_pct,
            cm_3d.value_pct AS change_3d_pct,
            cm_7d.value_pct AS change_7d_pct,
            cm_14d.value_pct AS change_14d_pct,
            cm_30d.value_pct AS change_30d_pct,
            ${volatilityMetricSql.selectSql},
            cm_1d.computed_at AS change_computed_at,
            CASE WHEN nf.extraction_status = 'success' THEN 1 ELSE 0 END AS has_full_text,
            nf.keywords_json, nf.keywords_status,
            naa.score AS ai_score,
            naa.score_evidence AS ai_score_evidence,
            naa.analysis_status AS ai_analysis_status,
                 naa.keywords_json AS ai_keywords_json,
                ${securityIndustrySql} AS security_industry,
                 ${floatPctSql} AS float_pct,
                 ${institutionalPctSql} AS institutional_pct,
                 ${insiderPctSql} AS insider_pct
     FROM news_items ni
    LEFT JOIN sec_filings sf ON sf.news_id = ni.id
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
    LEFT JOIN news_earnings_context nec ON nec.news_id = ni.id
     LEFT JOIN news_change_metrics cm_chg ON cm_chg.news_id = ni.id AND cm_chg.metric_key = 'change_pct'
     LEFT JOIN news_change_metrics cm_1d ON cm_1d.news_id = ni.id AND cm_1d.metric_key = 'change_1d_pct'
     LEFT JOIN news_change_metrics cm_open ON cm_open.news_id = ni.id AND cm_open.metric_key = 'change_from_open_pct'
     LEFT JOIN news_change_metrics cm_oth ON cm_oth.news_id = ni.id AND cm_oth.metric_key = 'change_open_to_high_pct'
     LEFT JOIN news_change_metrics cm_3d ON cm_3d.news_id = ni.id AND cm_3d.metric_key = 'change_3d_pct'
     LEFT JOIN news_change_metrics cm_7d ON cm_7d.news_id = ni.id AND cm_7d.metric_key = 'change_7d_pct'
     LEFT JOIN news_change_metrics cm_14d ON cm_14d.news_id = ni.id AND cm_14d.metric_key = 'change_14d_pct'
     LEFT JOIN news_change_metrics cm_30d ON cm_30d.news_id = ni.id AND cm_30d.metric_key = 'change_30d_pct'
     ${volatilityMetricSql.joinSql}
     LEFT JOIN news_ai_analysis naa ON naa.news_id = ni.id
     WHERE ni.id = ?`,
    [id]
  );
  if (!row) return null;

  // Fetch sentiment for this item's first ticker
  const tickers = splitCsvEnvelope(row.tickers_csv);
  const sentimentMap = new Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>();
  if (tickers.length > 0) {
    const sentRow = await getDb().get<any>(
      `SELECT sentiment_bullish_pct, sentiment_bearish_pct, company_news_score
       FROM news_sentiment_snapshots
       WHERE ticker = ?
       ORDER BY asof_date DESC LIMIT 1`,
      [tickers[0]],
    );
    if (sentRow) {
      sentimentMap.set(tickers[0], {
        bullishPct: sentRow.sentiment_bullish_pct,
        bearishPct: sentRow.sentiment_bearish_pct,
        newsScore: sentRow.company_news_score,
      });
    }
  }

  const marketCapMap = new Map<string, number | null>();
  if (tickers.length > 0) {
    const marketCapRow = await getDb().get<any>(
      `SELECT cp.market_cap
       FROM company_profiles cp
       JOIN securities s ON s.id = cp.security_id
       WHERE s.ticker = ? AND cp.market_cap IS NOT NULL
       ORDER BY cp.fetched_at DESC LIMIT 1`,
      [tickers[0]],
    );
    if (marketCapRow) {
      marketCapMap.set(tickers[0], marketCapRow.market_cap ?? null);
    }
  }

  const ipoMap = new Map<string, string | null>();
  if (tickers.length > 0) {
    const ipoRow = await getDb().get<any>(
      `SELECT cp.ipo_date
       FROM company_profiles cp
       JOIN securities s ON s.id = cp.security_id
       WHERE s.ticker = ? AND cp.ipo_date IS NOT NULL AND cp.ipo_date != ''
       ORDER BY cp.fetched_at DESC LIMIT 1`,
      [tickers[0]],
    );
    if (ipoRow) {
      ipoMap.set(tickers[0], ipoRow.ipo_date ?? null);
    }
  }

  return mapNewsRow(row, sentimentMap, undefined, undefined, marketCapMap, ipoMap);
}

export async function listNewsEarningsCandidates(
  query: NewsQuery,
  options?: { onlyUnconfirmed?: boolean },
): Promise<NewsEarningsCandidate[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  let extraJoins = "";
  const industryTickers = await getTickersForIndustryFilters(query.industries);

  if (query.bookmarkFolderId) {
    extraJoins += ` INNER JOIN bookmark_items bi ON bi.news_id = ni.id AND bi.folder_id = ?`;
    values.push(query.bookmarkFolderId);
  }

  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push(`LOWER(ni.title || ' ' || ni.body) LIKE ?`);
  }

  if (query.tickers?.length) {
    const tickerClauses = query.tickers.map(() => "ni.tickers_csv LIKE ?");
    for (const ticker of query.tickers) {
      values.push(`%,${ticker.toUpperCase()},%`);
    }
    where.push(`(${tickerClauses.join(" OR ")})`);
  }

  if (query.sources?.length) {
    const sourcePlaceholders = query.sources.map(() => "?").join(",");
    values.push(...query.sources);
    where.push(`ni.source_type IN (${sourcePlaceholders})`);
  }

  if (query.sourceNames?.length) {
    const sourcePlaceholders = query.sourceNames.map(() => "?").join(",");
    values.push(...query.sourceNames);
    where.push(`ni.source IN (${sourcePlaceholders})`);
  }

  if (query.tags?.length) {
    const tagClauses = query.tags.map(() => "ni.tags_csv LIKE ?");
    for (const tag of query.tags) {
      values.push(`%,${tag.toLowerCase()},%`);
    }
    where.push(`(${tagClauses.join(" OR ")})`);
  }

  appendIndustryTickerWhereClause(where, values, "ni", industryTickers);

  if (query.from) {
    values.push(query.from);
    where.push(`ni.published_at >= ?`);
  }

  if (query.to) {
    values.push(`${query.to}T23:59:59.999Z`);
    where.push(`ni.published_at <= ?`);
  }

  const floatPctSql = buildLatestCompanyProfileScalarSql("ni", "float_pct", "cp.float_pct IS NOT NULL");
  const institutionalPctSql = buildLatestCompanyProfileScalarSql(
    "ni",
    "institutional_pct",
    "cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'",
  );
  const insiderPctSql = buildLatestCompanyProfileScalarSql("ni", "insider_pct", "cp.insider_pct IS NOT NULL");

  appendNumericRangeWhereClause(where, values, floatPctSql, query.floatPctMin, query.floatPctMax);
  appendNumericRangeWhereClause(
    where,
    values,
    institutionalPctSql,
    query.institutionalPctMin,
    query.institutionalPctMax,
  );
  appendNumericRangeWhereClause(where, values, insiderPctSql, query.insiderPctMin, query.insiderPctMax);

  if (options?.onlyUnconfirmed) {
    where.push(`nec.news_id IS NOT NULL`);
    where.push(`(nec.recent_earnings_confirmed = 0 OR nec.upcoming_earnings_confirmed = 0)`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const newsItemsSourceSql = industryTickers
    ? "news_items ni INDEXED BY idx_news_items_primary_ticker_published"
    : "news_items ni";
  const rows = await getDb().all<any[]>(
    `SELECT ni.id,
            ni.published_at,
            ni.tickers_csv,
            cm_1d.ohlc_ticker,
            nec.lookup_status AS existing_lookup_status,
            nec.recent_earnings_date AS existing_recent_earnings_date,
            nec.recent_earnings_confirmed AS existing_recent_earnings_confirmed,
            nec.upcoming_earnings_date AS existing_upcoming_earnings_date,
            nec.upcoming_earnings_confirmed AS existing_upcoming_earnings_confirmed,
            nec.last_checked_at AS existing_last_checked_at
    FROM ${newsItemsSourceSql}
     LEFT JOIN news_change_metrics cm_1d ON cm_1d.news_id = ni.id AND cm_1d.metric_key = 'change_1d_pct'
     LEFT JOIN news_earnings_context nec ON nec.news_id = ni.id
     ${extraJoins}
     ${whereSql}
     ORDER BY ni.published_at DESC, ni.id DESC`,
    values,
  );

  return rows.map((row) => ({
    id: row.id,
    publishedAt: row.published_at,
    tickers: splitCsvEnvelope(row.tickers_csv ?? ""),
    ohlcTicker: row.ohlc_ticker ?? null,
    existingLookupStatus: row.existing_lookup_status ?? null,
    existingRecentEarningsDate: row.existing_recent_earnings_date ?? null,
    existingRecentEarningsConfirmed: toNullableBoolean(row.existing_recent_earnings_confirmed),
    existingUpcomingEarningsDate: row.existing_upcoming_earnings_date ?? null,
    existingUpcomingEarningsConfirmed: toNullableBoolean(row.existing_upcoming_earnings_confirmed),
    existingLastCheckedAt: row.existing_last_checked_at ?? null,
  }));
}

export async function getModel1News(query: NewsQuery): Promise<{ items: Model1NewsItem[]; nextCursor?: string }> {
  const where: string[] = [];
  const values: unknown[] = [];
  let extraJoins = "";
  const industryTickers = await getTickersForIndustryFilters(query.industries);

  if (query.bookmarkFolderId) {
    extraJoins += ` INNER JOIN bookmark_items bi ON bi.news_id = mn.id AND bi.folder_id = ?`;
    values.push(query.bookmarkFolderId);
  }

  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push(`LOWER(mn.title || ' ' || mn.body) LIKE ?`);
  }

  if (query.tickers?.length) {
    const tickerClauses = query.tickers.map(() => "mn.tickers_csv LIKE ?");
    for (const ticker of query.tickers) {
      values.push(`%,${ticker.toUpperCase()},%`);
    }
    where.push(`(${tickerClauses.join(" OR ")})`);
  }

  if (query.sources?.length) {
    const sourcePlaceholders = query.sources.map(() => "?").join(",");
    values.push(...query.sources);
    where.push(`mn.source_type IN (${sourcePlaceholders})`);
  }

  if (query.sourceNames?.length) {
    const sourcePlaceholders = query.sourceNames.map(() => "?").join(",");
    values.push(...query.sourceNames);
    where.push(`mn.source IN (${sourcePlaceholders})`);
  }

  if (query.tags?.length) {
    const tagClauses = query.tags.map(() => "mn.tags_csv LIKE ?");
    for (const tag of query.tags) {
      values.push(`%,${tag.toLowerCase()},%`);
    }
    where.push(`(${tagClauses.join(" OR ")})`);
  }

  appendIndustryTickerWhereClause(where, values, "mn", industryTickers);

  if (query.from) {
    values.push(query.from);
    where.push(`mn.published_at >= ?`);
  }

  if (query.to) {
    values.push(`${query.to}T23:59:59.999Z`);
    where.push(`mn.published_at <= ?`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    values.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    where.push(`(mn.published_at < ? OR (mn.published_at = ? AND mn.id < ?))`);
  }

  const floatPctSql = buildLatestCompanyProfileScalarSql("mn", "float_pct", "cp.float_pct IS NOT NULL");
  const institutionalPctSql = buildLatestCompanyProfileScalarSql(
    "mn",
    "institutional_pct",
    "cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'",
  );
  const insiderPctSql = buildLatestCompanyProfileScalarSql("mn", "insider_pct", "cp.insider_pct IS NOT NULL");
  const securityIndustrySql = buildPrimaryTickerIndustrySql("mn");

  appendNumericRangeWhereClause(where, values, floatPctSql, query.floatPctMin, query.floatPctMax);
  appendNumericRangeWhereClause(
    where,
    values,
    institutionalPctSql,
    query.institutionalPctMin,
    query.institutionalPctMax,
  );
  appendNumericRangeWhereClause(where, values, insiderPctSql, query.insiderPctMin, query.insiderPctMax);

  const requestedLimit = typeof query.limit === "number" && Number.isFinite(query.limit) ? query.limit : 500;
  const rangeDays = computeRangeDays(query.from, query.to);
  const policyMax = capLimitByRangeDays(rangeDays);
  const limit = clampInt(Math.min(requestedLimit, policyMax), 1, 500);
  values.push(limit + 1);

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
        SELECT mn.id, mn.published_at, mn.source, mn.publisher, COALESCE(mn.origin_url, sf.filing_url, sf.report_url) AS origin_url, mn.source_type, mn.title, mn.body, mn.url, mn.tickers_csv, mn.tags_csv, mn.created_at,
          nec.context_ticker AS earnings_context_ticker,
          nec.recent_earnings_date,
          nec.recent_earnings_confirmed,
          nec.upcoming_earnings_date,
          nec.upcoming_earnings_confirmed,
          nec.lookup_status AS earnings_lookup_status,
          mn.has_full_text, mn.keywords_json, mn.keywords_status,
          mn.ai_score, mn.ai_score_evidence, mn.ai_analysis_status, mn.ai_keywords_json,
          ${securityIndustrySql} AS security_industry,
          ${floatPctSql} AS float_pct,
          ${institutionalPctSql} AS institutional_pct,
          ${insiderPctSql} AS insider_pct
    FROM model1_current_news_view mn
    LEFT JOIN sec_filings sf ON sf.news_id = mn.id
        LEFT JOIN news_earnings_context nec ON nec.news_id = mn.id
    ${extraJoins}
    ${whereSql}
    ORDER BY mn.published_at DESC, mn.id DESC
    LIMIT ?
  `;

  const rows = await getDb().all<any[]>(sql, values);
  const { sentimentMap, peersMap, marketCapMap, descMap, ipoMap } = await loadNewsEnrichmentMaps(rows);
  const mapped = rows.map((row) => mapModel1NewsRow(row, sentimentMap, peersMap, descMap, marketCapMap, ipoMap));
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : undefined;

  return { items, nextCursor }; 
}

export async function getModel1NewsById(id: string): Promise<Model1NewsItem | null> {
  const floatPctSql = buildLatestCompanyProfileScalarSql("mn", "float_pct", "cp.float_pct IS NOT NULL");
  const institutionalPctSql = buildLatestCompanyProfileScalarSql(
    "mn",
    "institutional_pct",
    "cp.institutional_pct IS NOT NULL AND cp.institutional_source = 'yahoo'",
  );
  const insiderPctSql = buildLatestCompanyProfileScalarSql("mn", "insider_pct", "cp.insider_pct IS NOT NULL");
  const securityIndustrySql = buildPrimaryTickerIndustrySql("mn");
  const row = await getDb().get<any>(
        `SELECT mn.id, mn.published_at, mn.source, mn.publisher, COALESCE(mn.origin_url, sf.filing_url, sf.report_url) AS origin_url, mn.source_type, mn.title, mn.body, mn.url, mn.tickers_csv, mn.tags_csv, mn.created_at,
          nec.context_ticker AS earnings_context_ticker,
          nec.recent_earnings_date,
          nec.recent_earnings_confirmed,
          nec.upcoming_earnings_date,
          nec.upcoming_earnings_confirmed,
          nec.lookup_status AS earnings_lookup_status,
            mn.has_full_text, mn.keywords_json, mn.keywords_status,
            mn.ai_score, mn.ai_score_evidence, mn.ai_analysis_status, mn.ai_keywords_json,
            ${securityIndustrySql} AS security_industry,
            ${floatPctSql} AS float_pct,
            ${institutionalPctSql} AS institutional_pct,
            ${insiderPctSql} AS insider_pct
     FROM model1_current_news_view mn
     LEFT JOIN sec_filings sf ON sf.news_id = mn.id
         LEFT JOIN news_earnings_context nec ON nec.news_id = mn.id
     WHERE mn.id = ?`,
    [id],
  );
  if (!row) return null;

  const { sentimentMap, marketCapMap, ipoMap } = await loadSingleNewsEnrichmentMaps(row);
  return mapModel1NewsRow(row, sentimentMap, undefined, undefined, marketCapMap, ipoMap);
}

export async function insertNewsItem(params: {
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  originUrl?: string;
  tickers: string[];
  tags: string[];
  publisher?: string;
}): Promise<NewsItem | null> {
  const id = randomUUID();
  const tickers = Array.from(new Set(params.tickers.map((ticker) => ticker.toUpperCase())));
  const tags = Array.from(new Set(params.tags.map((tag) => tag.toLowerCase())));
  const tickersCsv = `,${tickers.join(",")},`;
  const tagsCsv = `,${tags.join(",")},`;

  const result = await getDb().run(
    `INSERT OR IGNORE INTO news_items
      (id, published_at, source, source_type, title, body, url, origin_url, tickers_csv, tags_csv, publisher)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.publishedAt,
      params.source,
      params.sourceType,
      params.title,
      params.body,
      params.url,
      params.originUrl?.trim() || null,
      tickersCsv,
      tagsCsv,
      params.publisher ?? null
    ]
  );

  if (!result.changes) {
    const existing = await getDb().get<{ publisher: string | null; origin_url: string | null }>(
      `SELECT publisher, origin_url FROM news_items WHERE source = ? AND source_type = ? AND url = ?`,
      [params.source, params.sourceType, params.url],
    );
    const nextPublisher = canonicalizePublisherLabel(params.publisher ?? null);
    const currentPublisher = canonicalizePublisherLabel(existing?.publisher ?? null);
    const nextOriginUrl = params.originUrl?.trim() || "";
    const shouldUpgradePublisher = nextPublisher !== "UNKNOWN"
      && (currentPublisher === "UNKNOWN" || (currentPublisher === "FINNHUB" && nextPublisher !== "FINNHUB"));
    const shouldFillOriginUrl = Boolean(nextOriginUrl) && !String(existing?.origin_url ?? "").trim();

    if (shouldUpgradePublisher) {
      await getDb().run(
        `UPDATE news_items SET publisher = ? WHERE source = ? AND source_type = ? AND url = ?`,
        [nextPublisher, params.source, params.sourceType, params.url],
      );
    }
    if (shouldFillOriginUrl) {
      await getDb().run(
        `UPDATE news_items SET origin_url = ? WHERE source = ? AND source_type = ? AND url = ?`,
        [nextOriginUrl, params.source, params.sourceType, params.url],
      );
    }
    return null;
  }

  return {
    id,
    published_at: params.publishedAt,
    source: params.source,
    publisher: params.publisher ? canonicalizePublisherLabel(params.publisher) : null,
    origin_url: params.originUrl?.trim() || null,
    source_type: params.sourceType,
    title: params.title,
    body: params.body,
    url: params.url,
    tickers,
    tags,
    created_at: new Date().toISOString()
  };
}

export async function insertSecFilingCompanion(params: {
  newsId: string;
  accessionNumber: string;
  cik: string;
  formType: string;
  filedAt: string;
  acceptedAt: string;
  reportUrl: string;
  filingUrl: string;
  rawJson?: string;
}): Promise<boolean> {
  const result = await getDb().run(
    `INSERT OR IGNORE INTO sec_filings
      (news_id, accession_number, cik, form_type, filed_at, accepted_at, report_url, filing_url, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.newsId,
      params.accessionNumber,
      params.cik,
      params.formType,
      params.filedAt,
      params.acceptedAt,
      params.reportUrl,
      params.filingUrl,
      params.rawJson ?? null,
    ],
  );
  return (result.changes ?? 0) > 0;
}

export async function updateNewsBodyById(newsId: string, body: string): Promise<void> {
  await getDb().run(
    `UPDATE news_items SET body = ? WHERE id = ?`,
    [body, newsId],
  );
}

export async function getNewsIdBySourceUrl(source: string, sourceType: string, url: string): Promise<string | null> {
  const row = await getDb().get<{ id: string }>(
    `SELECT id FROM news_items WHERE source = ? AND source_type = ? AND url = ? LIMIT 1`,
    [source, sourceType, url],
  );
  return row?.id ?? null;
}

export async function deleteBlockedFinnhubCompanyNews(): Promise<number> {
  const result = await getDb().run(
    `DELETE FROM news_items
     WHERE source = 'FINNHUB'
       AND source_type = 'company_news'
       AND (
         TRIM(COALESCE(url, '')) = ''
         OR UPPER(REPLACE(TRIM(COALESCE(publisher, '')), ' ', '')) IN ('SEEKINGALPHA')
       )`,
  );
  return result.changes ?? 0;
}

function mapNewsRow(
  row: any,
  sentimentMap?: Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>,
  peersMap?: Map<string, string[]>,
  descMap?: Map<string, string>,
  marketCapMap?: Map<string, number | null>,
  ipoMap?: Map<string, string | null>,
): NewsItem {
  const tickers = splitCsvEnvelope(row.tickers_csv);

  // AI analysis fields: use ai_keywords_json if analysis is completed, otherwise fall back to fulltext keywords
  const aiKeywords: string[] = row.ai_analysis_status === "completed" && row.ai_keywords_json
    ? JSON.parse(row.ai_keywords_json)
    : (row.keywords_json ? JSON.parse(row.keywords_json) : []);

  // Sentiment from pre-fetched map
  const primaryTicker = tickers.length > 0 ? tickers[0] : null;
  const sent = primaryTicker && sentimentMap ? sentimentMap.get(primaryTicker) : undefined;

  return {
    id: row.id,
    published_at: row.published_at,
    source: row.source,
    publisher: row.publisher ?? null,
    origin_url: row.origin_url ?? null,
    source_type: row.source_type,
    title: row.title,
    body: row.body,
    url: row.url,
    tickers,
    tags: splitCsvEnvelope(row.tags_csv),
    created_at: row.created_at,
    ohlc_ticker: row.ohlc_ticker ?? null,
    ohlc_date: row.change_pct != null ? (row.ohlc_date ?? null) : null,
    change_pct_ohlc_date: row.change_pct != null ? (row.change_pct_ohlc_date ?? null) : null,
    change_1d_target_date: row.change_1d_pct != null ? (row.change_1d_target_date ?? null) : null,
    change_pct: row.change_pct ?? null,
    change_1d_pct: row.change_1d_pct ?? null,
    change_from_open_pct: row.change_from_open_pct ?? null,
    change_open_to_high_pct: row.change_open_to_high_pct ?? null,
    change_3d_pct: row.change_3d_pct ?? null,
    change_7d_pct: row.change_7d_pct ?? null,
    change_14d_pct: row.change_14d_pct ?? null,
    change_30d_pct: row.change_30d_pct ?? null,
    hv_change_pct: row.hv_change_pct ?? null,
    hv_change_from_open_pct: row.hv_change_from_open_pct ?? null,
    hv_change_open_to_high_pct: row.hv_change_open_to_high_pct ?? null,
    hv_change_1d_pct: row.hv_change_1d_pct ?? null,
    hv_change_3d_pct: row.hv_change_3d_pct ?? null,
    hv_change_7d_pct: row.hv_change_7d_pct ?? null,
    hv_change_14d_pct: row.hv_change_14d_pct ?? null,
    hv_change_30d_pct: row.hv_change_30d_pct ?? null,
    zscore_change_pct: row.zscore_change_pct ?? null,
    zscore_change_from_open_pct: row.zscore_change_from_open_pct ?? null,
    zscore_change_open_to_high_pct: row.zscore_change_open_to_high_pct ?? null,
    zscore_change_1d_pct: row.zscore_change_1d_pct ?? null,
    zscore_change_3d_pct: row.zscore_change_3d_pct ?? null,
    zscore_change_7d_pct: row.zscore_change_7d_pct ?? null,
    zscore_change_14d_pct: row.zscore_change_14d_pct ?? null,
    zscore_change_30d_pct: row.zscore_change_30d_pct ?? null,
    change_computed_at: row.change_computed_at ?? null,
    hasFullText: row.has_full_text === 1,
    keywords: aiKeywords,
    keywordsStatus: row.keywords_status ?? null,
    industry: resolveNewsIndustry(row.security_industry, tickers),
    ipoDate: (primaryTicker && ipoMap ? ipoMap.get(primaryTicker) : undefined) ?? null,
    marketCap: (primaryTicker && marketCapMap ? marketCapMap.get(primaryTicker) : undefined) ?? null,
    floatPct: row.float_pct ?? null,
    institutionalPct: row.institutional_pct ?? null,
    insiderPct: row.insider_pct ?? null,
    earnings_context_ticker: row.earnings_context_ticker ?? null,
    recent_earnings_date: row.recent_earnings_date ?? null,
    recent_earnings_confirmed: toNullableBoolean(row.recent_earnings_confirmed),
    upcoming_earnings_date: row.upcoming_earnings_date ?? null,
    upcoming_earnings_confirmed: toNullableBoolean(row.upcoming_earnings_confirmed),
    earnings_context_display: formatEarningsContextDisplay(row),
    earnings_lookup_status: row.earnings_lookup_status ?? null,
    // AI analysis
    score: row.ai_score ?? null,
    scoreEvidence: row.ai_score_evidence ?? null,
    analysisStatus: row.ai_analysis_status ?? null,
    // Sentiment
    sentimentBullishPct: sent?.bullishPct ?? null,
    sentimentBearishPct: sent?.bearishPct ?? null,
    companyNewsScore: sent?.newsScore ?? null,
    // Peers
    peers: (primaryTicker && peersMap ? peersMap.get(primaryTicker) : undefined) ?? [],
    // Company description
    companyDescription: (primaryTicker && descMap ? descMap.get(primaryTicker) : undefined) ?? null,
  };
}

function mapModel1NewsRow(
  row: any,
  sentimentMap?: Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>,
  peersMap?: Map<string, string[]>,
  descMap?: Map<string, string>,
  marketCapMap?: Map<string, number | null>,
  ipoMap?: Map<string, string | null>,
): Model1NewsItem {
  const tickers = splitCsvEnvelope(row.tickers_csv);
  const primaryTicker = tickers.length > 0 ? tickers[0] : null;
  const sent = primaryTicker && sentimentMap ? sentimentMap.get(primaryTicker) : undefined;

  return {
    id: row.id,
    published_at: row.published_at,
    source: row.source,
    publisher: row.publisher ?? null,
    origin_url: row.origin_url ?? null,
    source_type: row.source_type,
    title: row.title,
    body: row.body,
    url: row.url,
    tickers,
    tags: splitCsvEnvelope(row.tags_csv),
    created_at: row.created_at,
    hasFullText: row.has_full_text === 1,
    keywords: parseKeywords(row),
    keywordsStatus: row.keywords_status ?? null,
    industry: resolveNewsIndustry(row.security_industry, tickers),
    ipoDate: (primaryTicker && ipoMap ? ipoMap.get(primaryTicker) : undefined) ?? null,
    marketCap: (primaryTicker && marketCapMap ? marketCapMap.get(primaryTicker) : undefined) ?? null,
    floatPct: row.float_pct ?? null,
    institutionalPct: row.institutional_pct ?? null,
    insiderPct: row.insider_pct ?? null,
    earnings_context_ticker: row.earnings_context_ticker ?? null,
    recent_earnings_date: row.recent_earnings_date ?? null,
    recent_earnings_confirmed: toNullableBoolean(row.recent_earnings_confirmed),
    upcoming_earnings_date: row.upcoming_earnings_date ?? null,
    upcoming_earnings_confirmed: toNullableBoolean(row.upcoming_earnings_confirmed),
    earnings_context_display: formatEarningsContextDisplay(row),
    earnings_lookup_status: row.earnings_lookup_status ?? null,
    score: row.ai_score ?? null,
    scoreEvidence: row.ai_score_evidence ?? null,
    analysisStatus: row.ai_analysis_status ?? null,
    sentimentBullishPct: sent?.bullishPct ?? null,
    sentimentBearishPct: sent?.bearishPct ?? null,
    companyNewsScore: sent?.newsScore ?? null,
    peers: (primaryTicker && peersMap ? peersMap.get(primaryTicker) : undefined) ?? [],
    companyDescription: (primaryTicker && descMap ? descMap.get(primaryTicker) : undefined) ?? null,
  };
}

function resolveNewsIndustry(securityIndustry: unknown, tickers: string[]): string | null {
  if (typeof securityIndustry === "string" && securityIndustry.trim()) {
    return securityIndustry.trim();
  }
  for (const ticker of tickers) {
    const industry = getIndustry(ticker);
    if (industry) return industry;
  }
  return null;
}

function parseKeywords(row: { ai_analysis_status?: string | null; ai_keywords_json?: string | null; keywords_json?: string | null }): string[] {
  if (row.ai_analysis_status === "completed" && row.ai_keywords_json) {
    return JSON.parse(row.ai_keywords_json);
  }
  return row.keywords_json ? JSON.parse(row.keywords_json) : [];
}

function toNullableBoolean(value: unknown): boolean | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return normalized === "1" || normalized === "true";
  }
  return null;
}

function formatEarningsContextDisplay(row: {
  recent_earnings_date?: string | null;
  recent_earnings_confirmed?: unknown;
  upcoming_earnings_date?: string | null;
  upcoming_earnings_confirmed?: unknown;
  earnings_lookup_status?: string | null;
}): string | null {
  const recentDate = row.recent_earnings_date ?? null;
  const upcomingDate = row.upcoming_earnings_date ?? null;
  const lookupStatus = row.earnings_lookup_status ?? null;
  if (!lookupStatus && !recentDate && !upcomingDate) {
    return null;
  }

  const recentConfirmed = toNullableBoolean(row.recent_earnings_confirmed);
  const upcomingConfirmed = toNullableBoolean(row.upcoming_earnings_confirmed);
  const recentLabel = recentDate
    ? `${recentDate} (${recentConfirmed ? "Confirmed" : "Unconfirmed"})`
    : "-";
  const upcomingLabel = upcomingDate
    ? `${upcomingDate} (${upcomingConfirmed ? "Confirmed" : "Unconfirmed"})`
    : "-";
  return `Recent ${recentLabel} | Upcoming ${upcomingLabel}`;
}

async function loadNewsEnrichmentMaps(rows: any[]): Promise<{
  sentimentMap: Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>;
  peersMap: Map<string, string[]>;
  marketCapMap: Map<string, number | null>;
  descMap: Map<string, string>;
  ipoMap: Map<string, string | null>;
}> {
  const tickerSet = collectPrimaryTickers(rows);
  const sentimentMap = await loadSentimentMap(tickerSet);
  const peersMap = await loadPeersMap(tickerSet);
  const marketCapMap = await loadMarketCapMap(tickerSet);
  const descMap = await loadDescriptionMap(tickerSet);
  const ipoMap = await loadIpoMap(tickerSet);
  return { sentimentMap, peersMap, marketCapMap, descMap, ipoMap };
}

async function loadSingleNewsEnrichmentMaps(row: any): Promise<{
  sentimentMap: Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>;
  marketCapMap: Map<string, number | null>;
  ipoMap: Map<string, string | null>;
}> {
  const tickerSet = collectPrimaryTickers([row]);
  return {
    sentimentMap: await loadSentimentMap(tickerSet),
    marketCapMap: await loadMarketCapMap(tickerSet),
    ipoMap: await loadIpoMap(tickerSet),
  };
}

function collectPrimaryTickers(rows: any[]): Set<string> {
  const tickerSet = new Set<string>();
  for (const row of rows) {
    const tickers = splitCsvEnvelope(row.tickers_csv ?? "");
    if (tickers.length > 0) tickerSet.add(tickers[0]);
  }
  return tickerSet;
}

async function loadSentimentMap(
  tickerSet: Set<string>,
): Promise<Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>> {
  const sentimentMap = new Map<string, { bullishPct: number | null; bearishPct: number | null; newsScore: number | null }>();
  if (tickerSet.size === 0) {
    return sentimentMap;
  }

  const tickerArr = Array.from(tickerSet);
  const placeholders = tickerArr.map(() => "?").join(",");
  const sentRows = await getDb().all<any[]>(
    `WITH ranked_sentiment AS (
       SELECT
         ticker,
         sentiment_bullish_pct,
         sentiment_bearish_pct,
         company_news_score,
         ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY asof_date DESC, id DESC) AS row_num
       FROM news_sentiment_snapshots
       WHERE ticker IN (${placeholders})
     )
     SELECT ticker, sentiment_bullish_pct, sentiment_bearish_pct, company_news_score
     FROM ranked_sentiment
     WHERE row_num = 1`,
    tickerArr,
  );
  for (const row of sentRows) {
    sentimentMap.set(row.ticker, {
      bullishPct: row.sentiment_bullish_pct,
      bearishPct: row.sentiment_bearish_pct,
      newsScore: row.company_news_score,
    });
  }
  return sentimentMap;
}

async function loadPeersMap(tickerSet: Set<string>): Promise<Map<string, string[]>> {
  const peersMap = new Map<string, string[]>();
  if (tickerSet.size === 0) {
    return peersMap;
  }

  const tickerArr = Array.from(tickerSet);
  const peersRows = await selectLatestCompanyProfileFieldRows(tickerArr, "peers_json", "cp.peers_json IS NOT NULL");
  for (const row of peersRows) {
    if (!peersMap.has(row.ticker) && row.peers_json) {
      try {
        peersMap.set(row.ticker, JSON.parse(row.peers_json));
      } catch {
        // Skip malformed peers_json rows.
      }
    }
  }
  return peersMap;
}

async function loadMarketCapMap(tickerSet: Set<string>): Promise<Map<string, number | null>> {
  const marketCapMap = new Map<string, number | null>();
  if (tickerSet.size === 0) {
    return marketCapMap;
  }

  const tickerArr = Array.from(tickerSet);
  const marketCapRows = await selectLatestCompanyProfileFieldRows(tickerArr, "market_cap", "cp.market_cap IS NOT NULL");
  for (const row of marketCapRows) {
    if (!marketCapMap.has(row.ticker)) {
      marketCapMap.set(row.ticker, row.market_cap ?? null);
    }
  }
  return marketCapMap;
}

async function loadDescriptionMap(tickerSet: Set<string>): Promise<Map<string, string>> {
  const descMap = new Map<string, string>();
  if (tickerSet.size === 0) {
    return descMap;
  }

  const tickerArr = Array.from(tickerSet);
  const descRows = await selectLatestCompanyProfileFieldRows(tickerArr, "description", "cp.description IS NOT NULL AND cp.description != ''");
  for (const row of descRows) {
    if (!descMap.has(row.ticker)) {
      descMap.set(row.ticker, row.description);
    }
  }
  return descMap;
}

async function loadIpoMap(tickerSet: Set<string>): Promise<Map<string, string | null>> {
  const ipoMap = new Map<string, string | null>();
  if (tickerSet.size === 0) {
    return ipoMap;
  }

  const tickerArr = Array.from(tickerSet);
  const ipoRows = await selectLatestCompanyProfileFieldRows(tickerArr, "ipo_date", "cp.ipo_date IS NOT NULL AND cp.ipo_date != ''");
  for (const row of ipoRows) {
    if (!ipoMap.has(row.ticker)) {
      ipoMap.set(row.ticker, row.ipo_date ?? null);
    }
  }
  return ipoMap;
}

async function selectLatestCompanyProfileFieldRows(
  tickers: string[],
  fieldName: "peers_json" | "market_cap" | "description" | "ipo_date",
  whereClause: string,
): Promise<any[]> {
  if (tickers.length === 0) {
    return [];
  }

  const placeholders = tickers.map(() => "?").join(",");
  return getDb().all<any[]>(
    `WITH ranked_company_profiles AS (
       SELECT
         s.ticker,
         cp.${fieldName} AS ${fieldName},
         ROW_NUMBER() OVER (PARTITION BY s.ticker ORDER BY cp.fetched_at DESC, cp.id DESC) AS row_num
       FROM company_profiles cp
       JOIN securities s ON s.id = cp.security_id
       WHERE s.ticker IN (${placeholders}) AND ${whereClause}
     )
     SELECT ticker, ${fieldName}
     FROM ranked_company_profiles
     WHERE row_num = 1`,
    tickers,
  );
}

function splitCsvEnvelope(csv: string): string[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
