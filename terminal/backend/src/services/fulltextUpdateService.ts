/**
 * fulltextUpdateService.ts — Background job orchestrator for full text extraction (Step 10-7)
 *
 * Iterates over all unextracted news_ids, dispatches to domain-specific
 * extractors, and persists results to news_fulltext table.
 */

import { getFmpSecFulltextBackfillRows, getRtprBodyBackfillRows, getUnextractedNewsIds, getUnextractedNewsRowsByIds, insertFulltext, upsertProvidedFulltext, type UnextractedNewsRow } from "./fulltextRepository.js";
import { extractByDomain, htmlToPlainText } from "./fulltextExtractors.js";
import { resolveFinnhubNewsOriginUrl } from "./finnhubRedirectResolver.js";
import { updateProgress, appendLog, completeJob, failJob, isJobCancelled } from "./jobManager.js";
import { getDb } from "../db.js";
import { fetchRtprArticlesByTicker } from "./ptprNewsProvider.js";
import { extractOriginUrl } from "./rtprOriginUrlExtractor.js";
import { buildSecFilingMetadataSummary, summarizeSecDocumentText } from "./secFilingSummary.js";
import { derivePublisher } from "./finnhubNewsProvider.js";

/** Default concurrency for full text extraction */
const DEFAULT_CONCURRENCY = 200;
const MAX_CONCURRENCY = 200;

const SQLITE_BUSY_RETRY_MAX = 10;
const SQLITE_BUSY_RETRY_BASE_MS = 100;
const COMPANY_ORIGIN_BACKFILL_MAX_CONCURRENCY = 20;
const COMPANY_ORIGIN_BACKFILL_DEFAULT_CONCURRENCY = 20;
const COMPANY_ORIGIN_BACKFILL_MAX_RETRIES = 10;
const COMPANY_ORIGIN_BACKFILL_BASE_DELAY_MS = 100;
const COMPANY_ORIGIN_BACKFILL_TIMEOUT_MS = 8000;
const COMPANY_ORIGIN_BACKFILL_WRITE_CHUNK_SIZE = 100;
const COMPANY_ORIGIN_BACKFILL_PROGRESS_LOG_INTERVAL_MS = 60_000;
const COMPANY_ORIGIN_BACKFILL_FINAL_FAILURE_LOG_LIMIT = 100;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function isSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY/i.test(message);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElapsedMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function runSqliteBusyRetry<T>(action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SQLITE_BUSY_RETRY_MAX; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === SQLITE_BUSY_RETRY_MAX) {
        throw error;
      }
      await sleep(SQLITE_BUSY_RETRY_BASE_MS * attempt);
    }
  }
  throw lastError;
}

export async function extractAndPersistFulltext(
  item: UnextractedNewsRow,
): Promise<{ extractionStatus: "success" | "failed" | "skipped" | "unavailable"; summaryUpdated: boolean }> {
  try {
    const result = await extractByDomain(item.url, item.publisher, item.body, {
      sourceType: item.source_type,
      originUrl: item.origin_url,
    });

    if (item.source_type === "company_news" && (result.resolvedUrl || result.resolvedPublisher)) {
      await getDb().run(
        `UPDATE news_items
         SET origin_url = COALESCE(?, origin_url),
             publisher = COALESCE(?, publisher)
         WHERE id = ?`,
        [result.resolvedUrl ?? null, result.resolvedPublisher ?? null, item.id],
      );
    }

    let summaryText: string | null = null;
    if (item.source_type === "fmp_sec_filing") {
      const sourceFullText = result.extractionStatus === "success"
        ? result.fullText
        : (item.existing_full_text ?? "");
      const plainFullText = /<[a-z][\s\S]*>/i.test(sourceFullText) ? htmlToPlainText(sourceFullText) : sourceFullText;
      const metadataFallback = item.form_type && item.cik && item.filed_at && item.accepted_at
        ? buildSecFilingMetadataSummary({
            symbol: "",
            cik: item.cik,
            formType: item.form_type,
            filingDate: item.filed_at,
            acceptedDate: item.accepted_at,
            link: item.url,
            finalLink: item.url,
          })
        : (item.body ?? "");
      if (plainFullText.trim() && item.form_type) {
        summaryText = summarizeSecDocumentText(item.form_type, plainFullText) ?? metadataFallback;
      } else if (metadataFallback.trim()) {
        summaryText = metadataFallback;
      }
    }

    if (result.extractionStatus === "success") {
      await upsertProvidedFulltext(item.id, {
        fullText: result.fullText,
        extractionNote: result.extractionNote,
        wordCount: result.wordCount ?? countWords(result.fullText),
      });
    } else {
      await insertFulltext(item.id, {
        fullText: result.fullText,
        extractionStatus: result.extractionStatus,
        extractionNote: result.extractionNote,
        wordCount: result.wordCount,
      });
    }

    let summaryUpdated = false;
    if (item.source_type === "fmp_sec_filing" && summaryText) {
      await getDb().run(`UPDATE news_items SET body = ? WHERE id = ?`, [summaryText, item.id]);
      summaryUpdated = true;
    }

    return {
      extractionStatus: result.extractionStatus,
      summaryUpdated,
    };
  } catch (err: any) {
    await insertFulltext(item.id, {
      fullText: "",
      extractionStatus: "failed",
      extractionNote: `unexpected: ${err.message?.slice(0, 200)}`,
    });
    return {
      extractionStatus: "failed",
      summaryUpdated: false,
    };
  }
}

export async function runFulltextUpdate(
  jobId: string,
  sourceType?: string,
  sourceName?: string,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<void> {
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
  try {
    const unextracted = sourceType === "fmp_sec_filing"
      ? await getFmpSecFulltextBackfillRows(sourceName)
      : await getUnextractedNewsIds(sourceType, sourceName);
    await runFulltextUpdateForRows(jobId, unextracted, {
      sourceType,
      sourceName,
      concurrency: effectiveConcurrency,
    });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runFulltextUpdate");
  }
}

export async function runFulltextUpdateForNewsIds(
  jobId: string,
  newsIds: string[],
  sourceType?: string,
  sourceName?: string,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<void> {
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
  try {
    const unextracted = await getUnextractedNewsRowsByIds(newsIds);
    await runFulltextUpdateForRows(jobId, unextracted, {
      sourceType,
      sourceName,
      concurrency: effectiveConcurrency,
      scopeLabel: `selected news ids=${newsIds.length}`,
    });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runFulltextUpdateForNewsIds");
  }
}

async function runFulltextUpdateForRows(
  jobId: string,
  unextracted: UnextractedNewsRow[],
  options: {
    sourceType?: string;
    sourceName?: string;
    concurrency: number;
    scopeLabel?: string;
  },
): Promise<void> {
  const total = unextracted.length;
  appendLog(
    jobId,
    `Starting full text extraction: ${total} items, sourceType=${options.sourceType ?? "all"}, source=${options.sourceName ?? "all"}, concurrency=${options.concurrency}${options.scopeLabel ? `, ${options.scopeLabel}` : ""}`,
  );
  updateProgress(jobId, 0);

  if (total === 0) {
    appendLog(jobId, "No unextracted news items found — nothing to do");
    completeJob(jobId, { processed: 0, success: 0, skipped: 0, failed: 0 });
    return;
  }

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let summaryUpdatedCount = 0;
  let processed = 0;
  let lastLogAt = 0;

  async function processOne(item: UnextractedNewsRow) {
    if (isJobCancelled(jobId)) return;
    const result = await extractAndPersistFulltext(item);
    if (result.summaryUpdated) summaryUpdatedCount++;

    if (result.extractionStatus === "success") successCount++;
    else if (result.extractionStatus === "skipped") skippedCount++;
    else failedCount++;

    processed++;
    updateProgress(jobId, processed);

    if (processed - lastLogAt >= 20 || processed === total) {
      lastLogAt = processed;
      appendLog(
        jobId,
        `[${processed}/${total}] ${successCount} ok, ${skippedCount} skip, ${failedCount} fail, ${summaryUpdatedCount} summary`,
      );
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < unextracted.length) {
      if (isJobCancelled(jobId)) break;
      const i = cursor++;
      if (i >= unextracted.length) break;
      await processOne(unextracted[i]);
    }
  }

  const workerCount = Math.min(options.concurrency, total);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (isJobCancelled(jobId)) {
    appendLog(jobId, "🛑 Cancelled by user");
    return;
  }

  appendLog(
    jobId,
    `Extraction complete: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed, ${summaryUpdatedCount} summary updated (total ${total})`,
  );
  completeJob(jobId, {
    processed: total,
    success: successCount,
    skipped: skippedCount,
    failed: failedCount,
    summaryUpdated: summaryUpdatedCount,
  });
}

/**
 * Backfill: convert existing HTML-based fulltext rows to plain text.
 * Finds rows where extraction_status = 'success' and full_text contains HTML tags,
 * then converts them in-place.
 */
export async function runFulltextPlainTextBackfill(jobId: string): Promise<void> {
  try {
    const db = getDb();

    // Find rows that still contain HTML (look for common tag patterns)
    const htmlRows = await db.all<{ news_id: string; full_text: string }[]>(
      `SELECT news_id, full_text FROM news_fulltext
       WHERE extraction_status = 'success'
         AND (full_text LIKE '%<div%' OR full_text LIKE '%<p>%' OR full_text LIKE '%<span%'
              OR full_text LIKE '%<br%' OR full_text LIKE '%<table%' OR full_text LIKE '%<a %')`,
    );

    const total = htmlRows.length;
    appendLog(jobId, `Plain-text backfill: ${total} rows with HTML detected`);
    updateProgress(jobId, 0);

    if (total === 0) {
      completeJob(jobId, { processed: 0, converted: 0 });
      return;
    }

    let converted = 0;
    for (let i = 0; i < htmlRows.length; i++) {
      if (isJobCancelled(jobId)) { appendLog(jobId, '🛑 Cancelled by user'); break; }
      const row = htmlRows[i];
      const plain = htmlToPlainText(row.full_text);
      const wc = plain.split(/\s+/).filter(Boolean).length;

      await db.run(
        `UPDATE news_fulltext SET full_text = ?, word_count = ?, extraction_note = 'backfill-html-to-plain'
         WHERE news_id = ?`,
        [plain, wc, row.news_id],
      );
      converted++;

      if ((i + 1) % 50 === 0) {
        appendLog(jobId, `[${i + 1}/${total}] converted`);
      }
      updateProgress(jobId, i + 1);
    }

    appendLog(jobId, `Backfill complete: ${converted}/${total} rows converted to plain text`);
    if (isJobCancelled(jobId)) return;
    completeJob(jobId, { processed: total, converted });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runFulltextPlainTextBackfill");
  }
}

export async function runRtprBodyBackfill(
  jobId: string,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<void> {
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
  try {
    const rows = await getRtprBodyBackfillRows();
    const total = rows.length;

    appendLog(jobId, `Starting RTPR HTML backfill: ${total} items, concurrency=${effectiveConcurrency}`);
    updateProgress(jobId, 0);

    if (total === 0) {
      appendLog(jobId, "No RTPR rows need HTML backfill — nothing to do");
      completeJob(jobId, { processed: 0, success: 0, failed: 0, fallback: 0, source: "RTPR" });
      return;
    }

    // Group rows by ticker for batch API fetch
    const tickerRowsMap = new Map<string, typeof rows>();
    for (const row of rows) {
      // tickers_csv is like ",AAPL," — extract first ticker
      const match = row.tickers_csv?.match(/,([^,]+),/);
      const ticker = match?.[1] || "UNKNOWN";
      if (!tickerRowsMap.has(ticker)) tickerRowsMap.set(ticker, []);
      tickerRowsMap.get(ticker)!.push(row);
    }

    let processed = 0;
    let successCount = 0;
    let fallbackCount = 0;
    let failedCount = 0;
    let lastLogAt = 0;

    const db = getDb();

    // Process one ticker: fetch API articles, match by title, store HTML
    async function processTicker(ticker: string, tickerRows: typeof rows) {
      if (isJobCancelled(jobId)) return;

      // Fetch articles from RTPR API for this ticker
      let apiArticles: Awaited<ReturnType<typeof fetchRtprArticlesByTicker>> = [];
      try {
        apiArticles = await fetchRtprArticlesByTicker(ticker, 100);
      } catch (err: any) {
        appendLog(jobId, `  ⚠ RTPR API fetch failed for ${ticker}: ${err.message}`);
      }

      // Build a lookup: normalize title → bodyHtml
      const htmlLookup = new Map<string, string>();
      for (const article of apiArticles) {
        if (article.bodyHtml) {
          const key = article.title.trim().toLowerCase();
          htmlLookup.set(key, article.bodyHtml);
        }
      }

      for (const row of tickerRows) {
        if (isJobCancelled(jobId)) break;

        try {
          const titleKey = row.title.trim().toLowerCase();
          const html = htmlLookup.get(titleKey);

          if (html) {
            // HTML found from API — store raw HTML
            await upsertProvidedFulltext(row.id, {
              fullText: html,
              extractionNote: "rtpr-html-backfill",
              wordCount: countWords(htmlToPlainText(html)),
            });
            // Extract and store origin_url
            const originUrl = extractOriginUrl(html);
            if (originUrl) {
              await db.run(`UPDATE news_items SET origin_url = ? WHERE id = ?`, [originUrl, row.id]);
            }
            successCount++;
          } else {
            // Fallback: use existing plain text body
            const plainText = htmlToPlainText(row.body);
            const fullText = plainText.trim().length > 0 ? plainText.trim() : row.body.trim();
            await upsertProvidedFulltext(row.id, {
              fullText,
              extractionNote: "rtpr-html-backfill-fallback",
              wordCount: countWords(fullText),
            });
            // Also try origin_url extraction from plain text
            const fallbackOriginUrl = extractOriginUrl(row.body);
            if (fallbackOriginUrl) {
              await db.run(`UPDATE news_items SET origin_url = ? WHERE id = ?`, [fallbackOriginUrl, row.id]);
            }
            fallbackCount++;
          }
        } catch (err: any) {
          failedCount++;
          appendLog(jobId, `⚠ RTPR backfill ${row.id}: ${err.message ?? "unknown error"}`);
        }

        processed++;
        updateProgress(jobId, processed);
        if (processed - lastLogAt >= 20 || processed === total) {
          lastLogAt = processed;
          appendLog(jobId, `[${processed}/${total}] ${successCount} html, ${fallbackCount} fallback, ${failedCount} fail`);
        }
      }
    }

    // ── Concurrent worker pool over tickers ──
    const tickerList = Array.from(tickerRowsMap.entries());
    let cursor = 0;
    async function worker() {
      while (cursor < tickerList.length) {
        if (isJobCancelled(jobId)) break;
        const index = cursor++;
        if (index >= tickerList.length) break;
        const [ticker, tickerRows] = tickerList[index];
        await processTicker(ticker, tickerRows);
      }
    }

    const workerCount = Math.min(effectiveConcurrency, tickerList.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (isJobCancelled(jobId)) {
      appendLog(jobId, "🛑 Cancelled by user");
      return;
    }

    appendLog(jobId, `RTPR HTML backfill complete: ${successCount} html, ${fallbackCount} fallback, ${failedCount} failed (total ${total})`);
    completeJob(jobId, {
      processed: total,
      success: successCount,
      fallback: fallbackCount,
      failed: failedCount,
      source: "RTPR",
    });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runRtprBodyBackfill");
  }
}

/**
 * Re-extract origin_url for ALL RTPR articles that have fulltext stored.
 * Runs the updated extractOriginUrl on the stored full_text (HTML or plain text).
 */
export async function runOriginUrlBackfill(jobId: string): Promise<void> {
  try {
    const db = getDb();
    const rows: { id: string; full_text: string; body: string; existing_url: string | null }[] = await db.all(
      `SELECT ni.id, nf.full_text, ni.body, ni.origin_url AS existing_url
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id = nf.news_id
       WHERE ni.source = 'RTPR'`
    );

    const total = rows.length;
    appendLog(jobId, `origin_url re-extraction: ${total} RTPR articles with fulltext`);
    updateProgress(jobId, 0, total);

    let updated = 0;
    let skipped = 0;
    let noMatch = 0;

    for (let i = 0; i < rows.length; i++) {
      if (isJobCancelled(jobId)) {
        appendLog(jobId, "🛑 Cancelled");
        return;
      }
      const row = rows[i];
      // Try fulltext first, then plain text body
      const url = extractOriginUrl(row.full_text) || extractOriginUrl(row.body);
      if (url) {
        if (row.existing_url !== url) {
          await db.run(`UPDATE news_items SET origin_url = ? WHERE id = ?`, [url, row.id]);
          updated++;
        } else {
          skipped++;
        }
      } else {
        noMatch++;
      }
      updateProgress(jobId, i + 1);
      if ((i + 1) % 100 === 0 || i + 1 === total) {
        appendLog(jobId, `[${i + 1}/${total}] updated=${updated} skipped=${skipped} noMatch=${noMatch}`);
      }
    }

    appendLog(jobId, `origin_url backfill complete: updated=${updated}, skipped=${skipped}, noMatch=${noMatch}`);
    completeJob(jobId, { total, updated, skipped, noMatch });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runOriginUrlBackfill");
  }
}

export async function runCompanyNewsOriginUrlBackfill(
  jobId: string,
  concurrency: number = COMPANY_ORIGIN_BACKFILL_DEFAULT_CONCURRENCY,
  batchSize: number = 250,
): Promise<void> {
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, COMPANY_ORIGIN_BACKFILL_MAX_CONCURRENCY));
  const effectiveBatchSize = Math.max(effectiveConcurrency, Math.min(batchSize, 1_000));
  const startedAt = Date.now();
  let progressTimer: NodeJS.Timeout | null = null;
  let processed = 0;
  let updated = 0;
  let unresolved = 0;
  let failed = 0;
  let finalFailureLogs = 0;
  let suppressedFinalFailureLogs = 0;
  let lastRowId = Number.MAX_SAFE_INTEGER;
  let batchNumber = 0;

  const logBackfillMessage = (message: string, mirrorToConsole: boolean = false) => {
    appendLog(jobId, message);
    if (mirrorToConsole) {
      console.log(`[company-origin-backfill] ${message}`);
    }
  };

  const emitProgressLog = (total: number, reason: "heartbeat" | "final" = "heartbeat") => {
    const elapsedMs = Date.now() - startedAt;
    const elapsedMinutes = elapsedMs / 60_000;
    const rowsPerMinute = elapsedMinutes > 0 ? (processed / elapsedMinutes).toFixed(1) : "0.0";
    const prefix = reason === "final" ? "final" : "heartbeat";
    logBackfillMessage(
      `[${prefix}] [${processed}/${total}] updated=${updated} unresolved=${unresolved} failed=${failed} batches=${batchNumber} elapsed=${formatElapsedMs(elapsedMs)} rate=${rowsPerMinute}/min`,
      true,
    );
  };

  try {
    const db = getDb();
    await runSqliteBusyRetry(() => db.exec("PRAGMA busy_timeout = 60000"));

    const countRow = await runSqliteBusyRetry(() => db.get<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM news_items
       WHERE source = 'FINNHUB'
         AND source_type = 'company_news'
         AND (origin_url IS NULL OR TRIM(origin_url) = '')`,
    ));

    const total = countRow?.count ?? 0;
    logBackfillMessage(`company_news origin_url backfill: ${total} missing rows, concurrency=${effectiveConcurrency}, batchSize=${effectiveBatchSize}`, true);
    updateProgress(jobId, 0, total);

    if (total === 0) {
      logBackfillMessage("No FINNHUB company_news rows are missing origin_url — nothing to do", true);
      completeJob(jobId, { processed: 0, updated: 0, unresolved: 0, failed: 0, sourceType: "company_news" });
      return;
    }

    progressTimer = setInterval(() => {
      if (!isJobCancelled(jobId)) {
        emitProgressLog(total, "heartbeat");
      }
    }, COMPANY_ORIGIN_BACKFILL_PROGRESS_LOG_INTERVAL_MS);
    progressTimer.unref?.();

    while (!isJobCancelled(jobId)) {
      const rows = await runSqliteBusyRetry(() => db.all<{ sqlite_rowid: number; id: string; url: string; origin_url: string | null }[]>(
        `SELECT rowid AS sqlite_rowid, id, url, origin_url
         FROM news_items
         WHERE source = 'FINNHUB'
           AND source_type = 'company_news'
           AND (origin_url IS NULL OR TRIM(origin_url) = '')
           AND rowid < ?
         ORDER BY rowid DESC
         LIMIT ?`,
        [lastRowId, effectiveBatchSize],
      ));

      if (rows.length === 0) {
        break;
      }

      batchNumber++;
  lastRowId = rows[rows.length - 1].sqlite_rowid;
  appendLog(jobId, `[batch ${batchNumber}] fetched ${rows.length} recent-first rows (next rowid<${lastRowId})`);

      let cursor = 0;
      const resolvedUpdates: Array<{ id: string; originUrl: string; publisher: string }> = [];
      async function worker(): Promise<void> {
        while (cursor < rows.length) {
          if (isJobCancelled(jobId)) return;
          const index = cursor++;
          if (index >= rows.length) return;

          const row = rows[index];

          try {
            const originUrl = await resolveFinnhubNewsOriginUrl(row.url, {
              maxRetries: COMPANY_ORIGIN_BACKFILL_MAX_RETRIES,
              baseDelayMs: COMPANY_ORIGIN_BACKFILL_BASE_DELAY_MS,
              timeoutMs: COMPANY_ORIGIN_BACKFILL_TIMEOUT_MS,
            });
            if (originUrl) {
              resolvedUpdates.push({
                id: row.id,
                originUrl,
                publisher: derivePublisher(originUrl),
              });
              updated++;
            } else {
              unresolved++;
              if (finalFailureLogs < COMPANY_ORIGIN_BACKFILL_FINAL_FAILURE_LOG_LIMIT) {
                appendLog(jobId, `⚠ final origin_url unresolved after ${COMPANY_ORIGIN_BACKFILL_MAX_RETRIES} retries: ${row.id} :: ${row.url}`);
                finalFailureLogs++;
              } else {
                suppressedFinalFailureLogs++;
              }
            }
          } catch (error: any) {
            failed++;
            if (finalFailureLogs < COMPANY_ORIGIN_BACKFILL_FINAL_FAILURE_LOG_LIMIT) {
              appendLog(jobId, `⚠ final origin_url error after ${COMPANY_ORIGIN_BACKFILL_MAX_RETRIES} retries: ${row.id} :: ${row.url} :: ${error?.message ?? String(error)}`);
              finalFailureLogs++;
            } else {
              suppressedFinalFailureLogs++;
            }
          }

          processed++;
          updateProgress(jobId, processed, total);
        }
      }

      const workerCount = Math.min(effectiveConcurrency, rows.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (resolvedUpdates.length > 0) {
        for (let index = 0; index < resolvedUpdates.length; index += COMPANY_ORIGIN_BACKFILL_WRITE_CHUNK_SIZE) {
          const chunk = resolvedUpdates.slice(index, index + COMPANY_ORIGIN_BACKFILL_WRITE_CHUNK_SIZE);
          await runSqliteBusyRetry(async () => {
            await db.exec("BEGIN TRANSACTION");
            try {
              for (const item of chunk) {
                await db.run(
                  `UPDATE news_items
                   SET origin_url = ?,
                       publisher = COALESCE(NULLIF(?, 'UNKNOWN'), publisher)
                   WHERE id = ?`,
                  [item.originUrl, item.publisher, item.id],
                );
              }
              await db.exec("COMMIT");
            } catch (error) {
              await db.exec("ROLLBACK");
              throw error;
            }
          });
          await sleep(25);
        }
      }
    }

    if (isJobCancelled(jobId)) {
      logBackfillMessage(`🛑 Cancelled — processed=${processed}, updated=${updated}, unresolved=${unresolved}, failed=${failed}`, true);
      return;
    }

    logBackfillMessage(`company_news origin_url backfill complete: processed=${processed}, updated=${updated}, unresolved=${unresolved}, failed=${failed}`, true);
    emitProgressLog(total, "final");
    if (suppressedFinalFailureLogs > 0) {
      logBackfillMessage(`company_news origin_url backfill final-failure logs suppressed=${suppressedFinalFailureLogs}`, true);
    }
    completeJob(jobId, { processed, updated, unresolved, failed, sourceType: "company_news" });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runCompanyNewsOriginUrlBackfill");
  } finally {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
  }
}
