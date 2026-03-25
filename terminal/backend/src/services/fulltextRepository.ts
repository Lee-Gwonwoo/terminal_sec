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
  source_type?: string;
  form_type?: string | null;
  cik?: string | null;
  filed_at?: string | null;
  accepted_at?: string | null;
  existing_full_text?: string | null;
  existing_extraction_status?: string | null;
  existing_extraction_note?: string | null;
}

export interface RtprBodyBackfillRow {
  id: string;
  body: string;
  title: string;
  tickers_csv: string;
  published_at: string;
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
 * @param sourceType  Optional filter: 'company_news' | 'press_release' | 'fmp_press_release'. Omit or 'all' for no filter.
 */
export async function getUnextractedNewsIds(
  sourceType?: string,
  sourceName?: string,
): Promise<UnextractedNewsRow[]> {
  const params: string[] = [];
  let whereExtra = "";
  if (sourceType && sourceType !== "all") {
    whereExtra = " AND ni.source_type = ?";
    params.push(sourceType);
  }
  if (sourceName && sourceName !== "all") {
    whereExtra += " AND ni.source = ?";
    params.push(sourceName);
  }
  return getDb().all<UnextractedNewsRow[]>(
    `SELECT ni.id, ni.url, ni.publisher, ni.body, ni.source_type, sf.form_type, sf.cik, sf.filed_at, sf.accepted_at,
          nf.full_text AS existing_full_text, nf.extraction_status AS existing_extraction_status,
          nf.extraction_note AS existing_extraction_note
     FROM news_items ni
     LEFT JOIN sec_filings sf ON sf.news_id = ni.id
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     WHERE nf.news_id IS NULL${whereExtra}
     ORDER BY ni.published_at DESC`,
    params,
  );
}

export async function getFmpSecFulltextBackfillRows(
  sourceName?: string,
): Promise<UnextractedNewsRow[]> {
  const params: string[] = [];
  let sourceClause = "";
  if (sourceName && sourceName !== "all") {
    sourceClause = " AND ni.source = ?";
    params.push(sourceName);
  }

  return getDb().all<UnextractedNewsRow[]>(
    `SELECT ni.id, ni.url, ni.publisher, ni.body, ni.source_type, sf.form_type, sf.cik, sf.filed_at, sf.accepted_at,
          nf.full_text AS existing_full_text, nf.extraction_status AS existing_extraction_status,
          nf.extraction_note AS existing_extraction_note
     FROM news_items ni
     JOIN sec_filings sf ON sf.news_id = ni.id
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     WHERE ni.source_type = 'fmp_sec_filing'${sourceClause}
       AND (
         nf.news_id IS NULL
         OR nf.extraction_status IN ('failed', 'unavailable')
         OR TRIM(COALESCE(nf.full_text, '')) = ''
         OR COALESCE(nf.word_count, 0) = 0
         OR ni.body LIKE 'Filed % accepted % CIK:%'
         OR ni.body LIKE '%us-gaap:%'
         OR ni.body LIKE '%dei:%'
         OR ni.body LIKE '%telephone number, including area code%'
         OR ni.body LIKE '%Indicate by check mark%'
         OR ni.body LIKE '%well-known seasoned issuer%'
       )
     ORDER BY ni.published_at DESC`,
    params,
  );
}

export async function getRtprBodyBackfillRows(): Promise<RtprBodyBackfillRow[]> {
  return getDb().all<RtprBodyBackfillRow[]>(
    `SELECT ni.id, ni.body, ni.title, ni.tickers_csv, ni.published_at
     FROM news_items ni
     LEFT JOIN news_fulltext nf ON nf.news_id = ni.id
     WHERE ni.source = 'RTPR'
       AND TRIM(COALESCE(ni.body, '')) != ''
       AND (
         nf.news_id IS NULL
         OR nf.extraction_status IN ('failed', 'unavailable')
         OR TRIM(COALESCE(nf.full_text, '')) = ''
         OR COALESCE(nf.word_count, 0) = 0
         OR nf.extraction_note NOT LIKE '%-html%'
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

export async function deleteFmpPressReleaseFallbackRows(): Promise<number> {
  const result = await getDb().run(
    `DELETE FROM news_fulltext
     WHERE news_id IN (
       SELECT nf.news_id
       FROM news_fulltext nf
       JOIN news_items ni ON ni.id = nf.news_id
       WHERE ni.source_type = 'fmp_press_release'
         AND UPPER(TRIM(COALESCE(ni.publisher, ''))) IN (
           'GLOBENEWSWIRE',
           'GLOBE NEWS WIRE',
           'PRNEWSWIRE',
           'BUSINESS WIRE',
           'NEWSFILE CORP',
           'ACCESSWIRE',
           'MCAP MEDIAWIRE'
         )
         AND (
           nf.extraction_note LIKE 'body-fallback (no-scraper:%'
           OR TRIM(COALESCE(nf.full_text, '')) = TRIM(COALESCE(ni.body, ''))
         )
     )`,
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
