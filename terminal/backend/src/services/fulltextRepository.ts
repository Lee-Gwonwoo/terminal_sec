import { getDb } from "../db.js";

// ─── Types ───

export interface FulltextRow {
  news_id: string;
  full_text: string;
  extraction_status: string;
  extraction_note: string | null;
  word_count: number | null;
  extracted_at: string;
  keywords_json: string;
  keywords_status: string;
  keywords_updated_at: string | null;
}

export interface UnextractedNewsRow {
  id: string;
  url: string;
  publisher: string | null;
  body: string | null;
}

export interface RtprBodyBackfillRow {
  id: string;
  body: string;
}

// ─── Queries ───

export async function getFulltext(newsId: string): Promise<FulltextRow | null> {
  const row = await getDb().get<FulltextRow>(
    `SELECT news_id, full_text, extraction_status, extraction_note,
            word_count, extracted_at, keywords_json, keywords_status, keywords_updated_at
     FROM news_fulltext WHERE news_id = ?`,
    [newsId],
  );
  return row ?? null;
}

export async function insertFulltext(
  newsId: string,
  data: {
    fullText: string;
    extractionStatus: string;
    extractionNote?: string;
    wordCount?: number;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT OR IGNORE INTO news_fulltext
       (news_id, full_text, extraction_status, extraction_note, word_count, extracted_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      newsId,
      data.fullText,
      data.extractionStatus,
      data.extractionNote ?? null,
      data.wordCount ?? null,
      now,
    ],
  );
}

export async function upsertProvidedFulltext(
  newsId: string,
  data: {
    fullText: string;
    extractionNote?: string;
    wordCount?: number;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO news_fulltext
       (news_id, full_text, extraction_status, extraction_note, word_count, extracted_at)
     VALUES (?, ?, 'success', ?, ?, ?)
     ON CONFLICT(news_id) DO UPDATE SET
       full_text = excluded.full_text,
       extraction_status = 'success',
       extraction_note = excluded.extraction_note,
       word_count = excluded.word_count,
       extracted_at = excluded.extracted_at`,
    [
      newsId,
      data.fullText,
      data.extractionNote ?? null,
      data.wordCount ?? null,
      now,
    ],
  );
}

/**
 * Returns news_items that do NOT have a corresponding news_fulltext row.
 * @param sourceType  Optional filter: 'company_news' | 'press_release'. Omit or 'all' for no filter.
 */
export async function getUnextractedNewsIds(
  sourceType?: string,
): Promise<UnextractedNewsRow[]> {
  const params: string[] = [];
  let whereExtra = "";
  if (sourceType && sourceType !== "all") {
    whereExtra = " AND ni.source_type = ?";
    params.push(sourceType);
  }
  return getDb().all<UnextractedNewsRow[]>(
    `SELECT ni.id, ni.url, ni.publisher, ni.body
     FROM news_items ni
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     WHERE nf.news_id IS NULL${whereExtra}
     ORDER BY ni.published_at DESC`,
    params,
  );
}

export async function getRtprBodyBackfillRows(): Promise<RtprBodyBackfillRow[]> {
  return getDb().all<RtprBodyBackfillRow[]>(
    `SELECT ni.id, ni.body
     FROM news_items ni
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     WHERE ni.source = 'RTPR'
       AND TRIM(COALESCE(ni.body, '')) != ''
       AND (
         nf.news_id IS NULL
         OR nf.extraction_status IN ('failed', 'unavailable')
         OR TRIM(COALESCE(nf.full_text, '')) = ''
         OR COALESCE(nf.word_count, 0) = 0
       )
     ORDER BY ni.published_at DESC`,
  );
}

/**
 * Batch check hasFullText for a list of news_ids.
 * Returns a Set of news_ids that have a fulltext row with extraction_status='success'.
 */
export async function getFulltextStatusSet(newsIds: string[]): Promise<Set<string>> {
  if (newsIds.length === 0) return new Set();
  const placeholders = newsIds.map(() => "?").join(",");
  const rows = await getDb().all<{ news_id: string }[]>(
    `SELECT news_id FROM news_fulltext
     WHERE news_id IN (${placeholders}) AND extraction_status = 'success'`,
    newsIds,
  );
  return new Set(rows.map((r) => r.news_id));
}

/**
 * Update keywords for a news item (used by subsequent AI keyword analysis).
 */
export async function updateKeywords(
  newsId: string,
  keywords: string[],
): Promise<void> {
  const now = new Date().toISOString();
  await getDb().run(
    `UPDATE news_fulltext
     SET keywords_json = ?, keywords_status = 'ready', keywords_updated_at = ?
     WHERE news_id = ?`,
    [JSON.stringify(keywords), now, newsId],
  );
}

/**
 * Delete failed/unavailable fulltext rows so they can be re-extracted.
 * Returns the number of rows deleted.
 */
export async function deleteFailedFulltextRows(): Promise<number> {
  const result = await getDb().run(
    `DELETE FROM news_fulltext WHERE extraction_status IN ('failed', 'unavailable')`,
  );
  return result.changes ?? 0;
}

/**
 * Get extraction status summary for UI display.
 */
export async function getFulltextStats(): Promise<
  { extraction_status: string; extraction_note: string | null; cnt: number }[]
> {
  return getDb().all(
    `SELECT nf.extraction_status, nf.extraction_note, COUNT(*) as cnt
     FROM news_fulltext nf
     GROUP BY nf.extraction_status, nf.extraction_note
     ORDER BY cnt DESC`,
  );
}
