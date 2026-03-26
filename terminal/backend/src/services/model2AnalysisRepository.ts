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

const SORT_COLUMN_SQL: Record<string, string> = {
  published_at: "ni.published_at",
  ticker: "er.ticker",
  title: "ni.title",
  publisher: "ni.publisher",
  case_type: "er.case_type",
  reaction_tag: "er.reaction_tag",
  impact_score: "er.overall_impact_score",
};

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
       er.case_label_ko AS caseLabelKo,
       er.top_level AS topLevel,
       COUNT(*) AS totalCount,
       SUM(CASE WHEN er.is_impacted = 1 THEN 1 ELSE 0 END) AS impactedCount,
       MAX(ni.published_at) AS latestPublishedAt
     FROM model2_evidence_rows er
     JOIN news_items ni ON ni.id = er.news_id
     WHERE er.analysis_id = ?
     GROUP BY er.case_type, er.case_label_ko, er.top_level
     ORDER BY totalCount DESC, impactedCount DESC, er.case_type ASC`,
    analysisId,
  );
}

export async function listModel2EvidenceRows(options: ListModel2EvidenceOptions): Promise<{ total: number; items: Model2EvidenceRow[] }> {
  const db = getDb();
  const where: string[] = ["er.analysis_id = ?"];
  const values: unknown[] = [options.analysisId];

  if (options.caseType && options.caseType !== "all") {
    where.push("er.case_type = ?");
    values.push(options.caseType);
  }

  if (options.ticker && options.ticker.trim()) {
    where.push("er.ticker = ?");
    values.push(options.ticker.trim().toUpperCase());
  }

  if (options.keyword && options.keyword.trim()) {
    where.push("LOWER(COALESCE(ni.title, '') || ' ' || COALESCE(er.summary, '') || ' ' || COALESCE(ni.body, '')) LIKE ?");
    values.push(`%${options.keyword.trim().toLowerCase()}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM model2_evidence_rows er
     JOIN news_items ni ON ni.id = er.news_id
     ${whereSql}`,
    ...values,
  );

  const sortBy = normalizeSortBy(options.sortBy);
  const sortDir = normalizeSortDir(options.sortDir);
  const orderSql = `${SORT_COLUMN_SQL[sortBy]} ${sortDir}, ni.id DESC`;
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
       ni.published_at AS publishedAt,
       ni.source,
       ni.publisher,
       ni.source_type AS sourceType,
       ni.title,
       ni.body,
       ni.url
     FROM model2_evidence_rows er
     JOIN news_items ni ON ni.id = er.news_id
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`,
    ...values,
    limit,
    offset,
  );

  return {
    total: totalRow?.total ?? 0,
    items: items.map(row => ({
      ...row,
      isImpacted: Boolean(row.isImpacted),
    })),
  };
}