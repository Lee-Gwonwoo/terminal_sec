import { getDb } from "../db.js";

// ─── Types ───

export interface AiAnalysisRow {
  news_id: string;
  score: number | null;
  score_evidence: string | null;
  keywords_json: string;
  analysis_status: string;
  analyzed_at: string | null;
  created_at: string;
}

// ─── Queries ───

/**
 * Get AI analysis for a single news item.
 */
export async function getAiAnalysis(newsId: string): Promise<AiAnalysisRow | null> {
  const row = await getDb().get<AiAnalysisRow>(
    `SELECT news_id, score, score_evidence, keywords_json,
            analysis_status, analyzed_at, created_at
     FROM news_ai_analysis WHERE news_id = ?`,
    [newsId],
  );
  return row ?? null;
}

/**
 * Upsert AI analysis result for a news item.
 * - analysis_status: 'not_started' | 'pending' | 'completed' | 'failed'
 * - On completed, score and score_evidence must be non-null.
 */
export async function upsertAiAnalysis(
  newsId: string,
  data: {
    score: number | null;
    scoreEvidence: string | null;
    keywords: string[];
    analysisStatus: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const analyzedAt = data.analysisStatus === "completed" ? now : null;
  await getDb().run(
    `INSERT INTO news_ai_analysis
       (news_id, score, score_evidence, keywords_json, analysis_status, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(news_id) DO UPDATE SET
       score = excluded.score,
       score_evidence = excluded.score_evidence,
       keywords_json = excluded.keywords_json,
       analysis_status = excluded.analysis_status,
       analyzed_at = excluded.analyzed_at`,
    [
      newsId,
      data.score,
      data.scoreEvidence,
      JSON.stringify(data.keywords),
      data.analysisStatus,
      analyzedAt,
    ],
  );
}

/**
 * Batch fetch AI analysis rows for a list of news_ids.
 * Returns a Map keyed by news_id.
 */
export async function getAiAnalysisBatch(
  newsIds: string[],
): Promise<Map<string, AiAnalysisRow>> {
  if (newsIds.length === 0) return new Map();
  const placeholders = newsIds.map(() => "?").join(",");
  const rows = await getDb().all<AiAnalysisRow[]>(
    `SELECT news_id, score, score_evidence, keywords_json,
            analysis_status, analyzed_at, created_at
     FROM news_ai_analysis
     WHERE news_id IN (${placeholders})`,
    newsIds,
  );
  const map = new Map<string, AiAnalysisRow>();
  for (const row of rows) {
    map.set(row.news_id, row);
  }
  return map;
}

/**
 * Get news_ids that are ready for AI analysis:
 * - have fulltext with extraction_status='success'
 * - do NOT yet have an AI analysis row with analysis_status='completed'
 */
export async function getNewsIdsReadyForAnalysis(
  limit: number = 100,
): Promise<string[]> {
  const rows = await getDb().all<{ news_id: string }[]>(
    `SELECT nf.news_id
     FROM news_fulltext nf
     LEFT JOIN news_ai_analysis naa ON naa.news_id = nf.news_id
     WHERE nf.extraction_status = 'success'
       AND (naa.news_id IS NULL OR naa.analysis_status NOT IN ('completed', 'pending'))
     ORDER BY nf.extracted_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.news_id);
}

/**
 * Validate completeness of AI analysis results.
 * Returns arrays of failing and warning news_ids.
 */
export async function validateAnalysisCompleteness(): Promise<{
  failures: { newsId: string; reason: string }[];
  warnings: { newsId: string; reason: string }[];
}> {
  const rows = await getDb().all<AiAnalysisRow[]>(
    `SELECT news_id, score, score_evidence, keywords_json, analysis_status, analyzed_at, created_at
     FROM news_ai_analysis
     WHERE analysis_status = 'completed'`,
  );

  const failures: { newsId: string; reason: string }[] = [];
  const warnings: { newsId: string; reason: string }[] = [];

  for (const row of rows) {
    if (row.score === null || row.score === undefined) {
      failures.push({ newsId: row.news_id, reason: "completed but score is empty" });
    }
    if (!row.score_evidence) {
      failures.push({ newsId: row.news_id, reason: "completed but score_evidence is empty" });
    }
    const keywords: string[] = JSON.parse(row.keywords_json || "[]");
    if (keywords.length === 0) {
      warnings.push({ newsId: row.news_id, reason: "completed but keywords is empty array" });
    }
  }

  return { failures, warnings };
}
