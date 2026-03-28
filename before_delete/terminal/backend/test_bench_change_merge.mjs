/**
 * Benchmark: change-merge concurrency=1 vs concurrency=6
 * Usage: npx tsx test_bench_change_merge.mjs
 *
 * Picks the first N news items from the DB, runs mergeChangeForNewItems
 * twice (serial then pool-6), and compares wall-clock time.
 */
import { initDb, getDb } from "./src/db.js";

// Dynamic import after DB init so singletons are ready
async function main() {
  await initDb();

  const { mergeChangeForNewItems } = await import(
    "./src/services/newsChangeMerger.js"
  );

  const SAMPLE = 2000; // items to benchmark

  const rows = await getDb().all(
    `SELECT id, tickers_csv, published_at FROM news_items
     WHERE tickers_csv != ''
     ORDER BY published_at DESC
     LIMIT ?`,
    [SAMPLE],
  );

  if (rows.length === 0) {
    console.log("No news items in DB — nothing to benchmark.");
    process.exit(0);
  }

  const items = rows.map((r) => ({
    id: r.id,
    tickers: r.tickers_csv.split(",").map((t) => t.trim()).filter(Boolean),
    publishedAt: r.published_at,
  }));

  console.log(`Benchmarking ${items.length} items …\n`);

  for (const c of [1, 6, 12, 24, 50, 100]) {
    const start = performance.now();
    const r = await mergeChangeForNewItems(items, c);
    const ms = performance.now() - start;
    console.log(
      `concurrency=${String(c).padStart(3)}  → ${ms.toFixed(0).padStart(5)} ms  (merged=${r.merged} skipped=${r.skipped})`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
