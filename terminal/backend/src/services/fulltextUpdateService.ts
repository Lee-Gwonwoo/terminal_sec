/**
 * fulltextUpdateService.ts — Background job orchestrator for full text extraction (Step 10-7)
 *
 * Iterates over all unextracted news_ids, dispatches to domain-specific
 * extractors, and persists results to news_fulltext table.
 */

import { getUnextractedNewsIds, insertFulltext } from "./fulltextRepository.js";
import { extractByDomain } from "./fulltextExtractors.js";
import { updateProgress, appendLog, completeJob, failJob } from "./jobManager.js";

/** Delay between requests to the same domain (ms) */
const DOMAIN_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFulltextUpdate(
  jobId: string,
  sourceType?: string,
): Promise<void> {
  try {
    const unextracted = await getUnextractedNewsIds(sourceType);
    const total = unextracted.length;

    appendLog(jobId, `Starting full text extraction: ${total} unextracted news items`);
    updateProgress(jobId, 0);

    if (total === 0) {
      appendLog(jobId, "No unextracted news items found — nothing to do");
      completeJob(jobId, { processed: 0, success: 0, skipped: 0, failed: 0 });
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < unextracted.length; i++) {
      const item = unextracted[i];
      const publisher = item.publisher ?? "UNKNOWN";

      try {
        const result = await extractByDomain(item.url, item.publisher);

        await insertFulltext(item.id, {
          fullText: result.fullText,
          extractionStatus: result.extractionStatus,
          extractionNote: result.extractionNote,
          wordCount: result.wordCount,
        });

        if (result.extractionStatus === "success") {
          successCount++;
        } else if (result.extractionStatus === "skipped") {
          skippedCount++;
        } else {
          failedCount++;
        }

        // Log every 10 items or on failure
        if ((i + 1) % 10 === 0 || result.extractionStatus === "failed") {
          appendLog(
            jobId,
            `[${i + 1}/${total}] ${publisher} → ${result.extractionStatus}${
              result.extractionNote ? ` (${result.extractionNote})` : ""
            }`,
          );
        }
      } catch (err: any) {
        failedCount++;
        // Record failure but continue
        await insertFulltext(item.id, {
          fullText: "",
          extractionStatus: "failed",
          extractionNote: `unexpected: ${err.message?.slice(0, 200)}`,
        });
        appendLog(jobId, `[${i + 1}/${total}] ${publisher} UNEXPECTED ERROR: ${err.message?.slice(0, 100)}`);
      }

      updateProgress(jobId, i + 1);

      // Rate limit: delay between requests (skip delay for skipped/finnhub items)
      if (publisher !== "FINNHUB" && i < unextracted.length - 1) {
        await sleep(DOMAIN_DELAY_MS);
      }
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
