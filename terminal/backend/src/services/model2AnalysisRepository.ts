import { getDb } from "../db.js";

export interface Model2AnalysisRun {
  id: string;
  page_id: string | null;
  title: string;
  note_title: string;
  source_type: string;
  source_name: string | null;
  since: string;
  until: string;
  scope: string;
  total_rows: number;
  analyzable_rows: number;
  impacted_rows: number;
  meaningless_rows: number;
  created_at: string;
  updated_at: string;
}

export interface Model2CaseSummary {
  caseType: string;
  caseLabelKo: string;
  topLevel: string;
  totalCount: number;
  impactedCount: number;
  latestPublishedAt: string | null;
}

export interface Model2EvidenceRow {
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
  changePct: number | null;
  changeFromOpenPct: number | null;
  changeOpenToHighPct: number | null;
  change1dPct: number | null;
  change3dPct: number | null;
  change7dPct: number | null;
  change14dPct: number | null;
  change30dPct: number | null;
  immediateReactionScore: number | null;
  shortFollowthroughScore: number | null;
  mediumPersistenceScore: number | null;
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

export interface ListModel2EvidenceOptions {
  analysisId: string;
  caseType?: string;
  keyword?: string;
  ticker?: string;
  sortBy?: string;
  sortDir?: string;
  limit?: number;
  offset?: number;
}

export interface Model2BlockedEvidenceCleanupResult {
  deletedEvidenceRows: number;
  affectedAnalysisIds: string[];
}

const SORT_COLUMN_SQL: Record<string, string> = {
  published_at: "er.published_at",
  ticker: "er.ticker",
  title: "er.title",
  publisher: "er.publisher",
  case_type: "er.case_type",
  reaction_tag: "er.reaction_tag",
  impact_score: "er.overall_impact_score",
};

const BLOCKED_FINNHUB_COMPANY_NEWS_EVIDENCE_WHERE = `NOT (
  er.source = 'FINNHUB'
  AND er.source_type = 'company_news'
  AND (
    TRIM(COALESCE(er.url, '')) = ''
    OR UPPER(REPLACE(TRIM(COALESCE(er.publisher, '')), ' ', '')) IN ('SEEKINGALPHA')
    OR NOT EXISTS (SELECT 1 FROM news_items ni WHERE ni.id = er.news_id)
  )
)`;

function clampLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 300;
  }
  return Math.max(1, Math.min(1000, Math.trunc(limit)));
}

function clampOffset(offset?: number): number {
  if (typeof offset !== "number" || !Number.isFinite(offset)) {
    return 0;
  }
  return Math.max(0, Math.trunc(offset));
}

function normalizeSortBy(sortBy?: string): string {
  if (!sortBy) {
    return "published_at";
  }
  return SORT_COLUMN_SQL[sortBy] ? sortBy : "published_at";
}

function normalizeSortDir(sortDir?: string): "ASC" | "DESC" {
  return sortDir?.toLowerCase() === "asc" ? "ASC" : "DESC";
}

export async function cleanupBlockedFinnhubCompanyNewsEvidence(): Promise<Model2BlockedEvidenceCleanupResult> {
  const db = getDb();
  const blockedWhere = `
    er.source = 'FINNHUB'
    AND er.source_type = 'company_news'
    AND (
      TRIM(COALESCE(er.url, '')) = ''
      OR UPPER(REPLACE(TRIM(COALESCE(er.publisher, '')), ' ', '')) IN ('SEEKINGALPHA')
      OR NOT EXISTS (SELECT 1 FROM news_items ni WHERE ni.id = er.news_id)
    )`;
  const blockedWhereDelete = `
    source = 'FINNHUB'
    AND source_type = 'company_news'
    AND (
      TRIM(COALESCE(url, '')) = ''
      OR UPPER(REPLACE(TRIM(COALESCE(publisher, '')), ' ', '')) IN ('SEEKINGALPHA')
      OR NOT EXISTS (SELECT 1 FROM news_items ni WHERE ni.id = model2_evidence_rows.news_id)
    )`;

  const affected = await db.all<{ analysis_id: string }[]>(
    `SELECT DISTINCT er.analysis_id
     FROM model2_evidence_rows er
     WHERE ${blockedWhere}`,
  );
  const affectedAnalysisIds = affected.map((row) => row.analysis_id);
  if (affectedAnalysisIds.length === 0) {
    return { deletedEvidenceRows: 0, affectedAnalysisIds: [] };
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    const deleted = await db.run(
      `DELETE FROM model2_evidence_rows
       WHERE ${blockedWhereDelete}`,
    );

    for (const analysisId of affectedAnalysisIds) {
      await db.run("DELETE FROM model2_case_summaries WHERE analysis_id = ?", analysisId);
      await db.run(
        `INSERT INTO model2_case_summaries (
           analysis_id,
           case_type,
           case_label_ko,
           top_level,
           total_count,
           impacted_count,
           latest_published_at,
           updated_at
         )
         SELECT
           analysis_id,
           case_type,
           MAX(case_label_ko) AS case_label_ko,
           MAX(top_level) AS top_level,
           COUNT(*) AS total_count,
           SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count,
           MAX(published_at) AS latest_published_at,
           datetime('now') AS updated_at
         FROM model2_evidence_rows
         WHERE analysis_id = ?
         GROUP BY analysis_id, case_type`,
        analysisId,
      );

      const aggregate = await db.get<{
        total_rows: number;
        analyzable_rows: number;
        impacted_rows: number;
        meaningless_rows: number;
      }>(
        `SELECT
           COUNT(*) AS total_rows,
           SUM(CASE WHEN overall_impact_score IS NOT NULL THEN 1 ELSE 0 END) AS analyzable_rows,
           SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_rows,
           SUM(CASE WHEN case_type = 'meaningless_others' THEN 1 ELSE 0 END) AS meaningless_rows
         FROM model2_evidence_rows
         WHERE analysis_id = ?`,
        analysisId,
      );

      await db.run(
        `UPDATE model2_analysis_runs
         SET total_rows = ?,
             analyzable_rows = ?,
             impacted_rows = ?,
             meaningless_rows = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        aggregate?.total_rows ?? 0,
        aggregate?.analyzable_rows ?? 0,
        aggregate?.impacted_rows ?? 0,
        aggregate?.meaningless_rows ?? 0,
        analysisId,
      );
    }

    await db.exec("COMMIT");
    return {
      deletedEvidenceRows: deleted.changes ?? 0,
      affectedAnalysisIds,
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function listModel2Analyses(pageId?: string): Promise<Model2AnalysisRun[]> {
  const db = getDb();
  if (pageId) {
    return db.all<Model2AnalysisRun[]>(
      `SELECT *
       FROM model2_analysis_runs
       WHERE page_id = ?
       ORDER BY created_at DESC, id DESC`,
      pageId,
    );
  }
  return db.all<Model2AnalysisRun[]>(
    `SELECT *
     FROM model2_analysis_runs
     ORDER BY created_at DESC, id DESC`,
  );
}

export async function getModel2AnalysisRun(id: string): Promise<Model2AnalysisRun | null> {
  const db = getDb();
  return (await db.get<Model2AnalysisRun>("SELECT * FROM model2_analysis_runs WHERE id = ?", id)) ?? null;
}

export async function listModel2CaseSummaries(analysisId: string): Promise<Model2CaseSummary[]> {
  const db = getDb();
  return db.all<Model2CaseSummary[]>(
    `SELECT
       er.case_type AS caseType,
       MAX(er.case_label_ko) AS caseLabelKo,
       MAX(er.top_level) AS topLevel,
       COUNT(*) AS totalCount,
       SUM(CASE WHEN er.is_impacted = 1 THEN 1 ELSE 0 END) AS impactedCount,
       MAX(er.published_at) AS latestPublishedAt
     FROM model2_evidence_rows er
     WHERE er.analysis_id = ?
       AND ${BLOCKED_FINNHUB_COMPANY_NEWS_EVIDENCE_WHERE}
     GROUP BY er.case_type
     ORDER BY totalCount DESC, impactedCount DESC, er.case_type ASC`,
    analysisId,
  );
}

export async function listModel2EvidenceRows(options: ListModel2EvidenceOptions): Promise<{ total: number; items: Model2EvidenceRow[] }> {
  const db = getDb();
  const where: string[] = ["er.analysis_id = ?", BLOCKED_FINNHUB_COMPANY_NEWS_EVIDENCE_WHERE];
  const values: unknown[] = [options.analysisId];
  const normalizedCaseType = options.caseType && options.caseType !== "all" ? options.caseType : undefined;
  const normalizedTicker = options.ticker && options.ticker.trim() ? options.ticker.trim().toUpperCase() : undefined;
  const normalizedKeyword = options.keyword && options.keyword.trim() ? options.keyword.trim().toLowerCase() : undefined;

  if (normalizedCaseType) {
    where.push("er.case_type = ?");
    values.push(normalizedCaseType);
  }

  if (normalizedTicker) {
    where.push("er.ticker = ?");
    values.push(normalizedTicker);
  }

  if (normalizedKeyword) {
    where.push("LOWER(COALESCE(er.title, '') || ' ' || COALESCE(er.summary, '') || ' ' || COALESCE(er.body_preview, '')) LIKE ?");
    values.push(`%${normalizedKeyword}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM model2_evidence_rows er
     ${whereSql}`,
    ...values,
  );
  const total = totalRow?.total ?? 0;

  const sortBy = normalizeSortBy(options.sortBy);
  const sortDir = normalizeSortDir(options.sortDir);
  const orderSql = `${SORT_COLUMN_SQL[sortBy]} ${sortDir}, er.id DESC`;
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);

  const items = await db.all<any[]>(
    `SELECT
       er.id,
       er.analysis_id AS analysisId,
       er.news_id AS newsId,
       er.case_type AS caseType,
       er.case_label_ko AS caseLabelKo,
       er.top_level AS topLevel,
       er.reaction_tag AS reactionTag,
       er.is_impacted AS isImpacted,
       er.ticker,
       er.market_cap AS marketCap,
       er.market_cap_bucket AS marketCapBucket,
       er.industry,
       er.ipo_date AS ipoDate,
       er.change_pct AS changePct,
       er.change_from_open_pct AS changeFromOpenPct,
       er.change_open_to_high_pct AS changeOpenToHighPct,
       er.change_1d_pct AS change1dPct,
       er.change_3d_pct AS change3dPct,
       er.change_7d_pct AS change7dPct,
       er.change_14d_pct AS change14dPct,
       er.change_30d_pct AS change30dPct,
       er.immediate_reaction_score AS immediateReactionScore,
       er.short_followthrough_score AS shortFollowthroughScore,
       er.medium_persistence_score AS mediumPersistenceScore,
       er.overall_impact_score AS overallImpactScore,
       er.summary,
       er.published_at AS publishedAt,
       er.source,
       er.publisher,
       er.source_type AS sourceType,
       er.title,
       SUBSTR(COALESCE(er.body_preview, ''), 1, 280) AS body,
       er.url
     FROM model2_evidence_rows er
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`,
    ...values,
    limit,
    offset,
  );

  return {
    total,
    items: items.map(row => ({
      ...row,
      isImpacted: Boolean(row.isImpacted),
    })),
  };
}