/**
 * fulltextUpdateService.ts — Background job orchestrator for full text extraction (Step 10-7)
 *
 * Iterates over all unextracted news_ids, dispatches to domain-specific
 * extractors, and persists results to news_fulltext table.
 */

import { getRtprBodyBackfillRows, getUnextractedNewsIds, insertFulltext, upsertProvidedFulltext } from "./fulltextRepository.js";
import { extractByDomain, htmlToPlainText } from "./fulltextExtractors.js";
import { updateProgress, appendLog, completeJob, failJob, isJobCancelled } from "./jobManager.js";
import { getDb } from "../db.js";

/** Default concurrency for full text extraction */
const DEFAULT_CONCURRENCY = 10;
const MAX_CONCURRENCY = 200;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function runFulltextUpdate(
  jobId: string,
  sourceType?: string,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<void> {
  const effectiveConcurrency = Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
  try {
    const unextracted = await getUnextractedNewsIds(sourceType);
    const total = unextracted.length;

    appendLog(jobId, `Starting full text extraction: ${total} items, concurrency=${effectiveConcurrency}`);
    updateProgress(jobId, 0);

    if (total === 0) {
      appendLog(jobId, "No unextracted news items found — nothing to do");
      completeJob(jobId, { processed: 0, success: 0, skipped: 0, failed: 0 });
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let processed = 0;
    let lastLogAt = 0;

    /** Process a single news item */
    async function processOne(item: typeof unextracted[0]) {
      if (isJobCancelled(jobId)) return;
      const publisher = item.publisher ?? "UNKNOWN";

      try {
        const result = await extractByDomain(item.url, item.publisher, item.body);

        await insertFulltext(item.id, {
          fullText: result.fullText,
          extractionStatus: result.extractionStatus,
          extractionNote: result.extractionNote,
          wordCount: result.wordCount,
        });

        if (result.extractionStatus === "success") successCount++;
        else if (result.extractionStatus === "skipped") skippedCount++;
        else failedCount++;
      } catch (err: any) {
        failedCount++;
        await insertFulltext(item.id, {
          fullText: "",
          extractionStatus: "failed",
          extractionNote: `unexpected: ${err.message?.slice(0, 200)}`,
        });
      }

      processed++;
      updateProgress(jobId, processed);

      // Log every 20 items or on the last item
      if (processed - lastLogAt >= 20 || processed === total) {
        lastLogAt = processed;
        appendLog(
          jobId,
          `[${processed}/${total}] ${successCount} ok, ${skippedCount} skip, ${failedCount} fail`,
        );
      }
    }

    // ── Concurrent worker pool ──
    // Node.js single-threaded event loop: cursor++ is safe (synchronous)
    let cursor = 0;
    async function worker() {
      while (cursor < unextracted.length) {
        if (isJobCancelled(jobId)) break;
        const i = cursor++;
        if (i >= unextracted.length) break;
        await processOne(unextracted[i]);
      }
    }

    const workerCount = Math.min(effectiveConcurrency, total);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (isJobCancelled(jobId)) {
      appendLog(jobId, '🛑 Cancelled by user');
      return;
    }

    appendLog(
      jobId,
      `Extraction complete: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed (total ${total})`,
    );
    completeJob(jobId, {
      processed: total,
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
    });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runFulltextUpdate");
  }
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

    appendLog(jobId, `Starting RTPR full text backfill: ${total} items, concurrency=${effectiveConcurrency}`);
    updateProgress(jobId, 0);

    if (total === 0) {
      appendLog(jobId, "No RTPR rows need body backfill — nothing to do");
      completeJob(jobId, { processed: 0, success: 0, failed: 0, source: "RTPR" });
      return;
    }

    let processed = 0;
    let successCount = 0;
    let failedCount = 0;
    let lastLogAt = 0;

    async function processOne(row: typeof rows[0]) {
      if (isJobCancelled(jobId)) return;
      try {
        const plainText = htmlToPlainText(row.body);
        const fullText = plainText.trim().length > 0 ? plainText.trim() : row.body.trim();
        await upsertProvidedFulltext(row.id, {
          fullText,
          extractionNote: "rtpr-body-backfill",
          wordCount: countWords(fullText),
        });
        successCount++;
      } catch (err: any) {
        failedCount++;
        appendLog(jobId, `⚠ RTPR full text ${row.id}: ${err.message ?? "unknown error"}`);
      }

      processed++;
      updateProgress(jobId, processed);
      if (processed - lastLogAt >= 20 || processed === total) {
        lastLogAt = processed;
        appendLog(jobId, `[${processed}/${total}] ${successCount} ok, ${failedCount} fail`);
      }
    }

    let cursor = 0;
    async function worker() {
      while (cursor < rows.length) {
        if (isJobCancelled(jobId)) break;
        const index = cursor++;
        if (index >= rows.length) break;
        await processOne(rows[index]);
      }
    }

    const workerCount = Math.min(effectiveConcurrency, total);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (isJobCancelled(jobId)) {
      appendLog(jobId, "🛑 Cancelled by user");
      return;
    }

    appendLog(jobId, `RTPR full text backfill complete: ${successCount} success, ${failedCount} failed (total ${total})`);
    completeJob(jobId, {
      processed: total,
      success: successCount,
      failed: failedCount,
      source: "RTPR",
    });
  } catch (err: any) {
    failJob(jobId, err.message ?? "Unknown error in runRtprBodyBackfill");
  }
}
