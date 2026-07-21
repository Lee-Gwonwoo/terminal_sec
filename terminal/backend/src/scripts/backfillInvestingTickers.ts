/**
 * backfillInvestingTickers.ts — one-off backfill of news_items.tickers_csv
 * for existing Investing articles, using title/body plus already-extracted
 * full text. New articles get tickers automatically during pull/fulltext
 * extraction; this fills in items ingested before that hook existed.
 *
 * Usage: npx tsx src/scripts/backfillInvestingTickers.ts
 */
import { initDb, getDb } from "../db.js";
import { extractInvestingTickers } from "../services/investingNewsProvider.js";

async function main(): Promise<void> {
  await initDb();
  const db = getDb();

  const rows = await db.all<{
    id: string;
    title: string;
    body: string | null;
    tickers_csv: string | null;
    full_text: string | null;
  }[]>(
    `SELECT ni.id, ni.title, ni.body, ni.tickers_csv, nf.full_text
     FROM news_items ni
     LEFT JOIN news_fulltext nf
       ON nf.news_id = ni.id AND nf.extraction_status = 'success'
     WHERE ni.source = 'INVESTING'`,
  );

  let updated = 0;
  let unchanged = 0;
  for (const row of rows) {
    const found = extractInvestingTickers(
      [row.title, row.body ?? "", row.full_text ?? ""].join("\n"),
    );
    if (found.length === 0) {
      unchanged++;
      continue;
    }
    const existing = (row.tickers_csv ?? "")
      .split(",")
      .map((ticker) => ticker.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...existing, ...found]));
    if (merged.length === existing.length) {
      unchanged++;
      continue;
    }
    await db.run(
      `UPDATE news_items SET tickers_csv = ? WHERE id = ?`,
      [`,${merged.join(",")},`, row.id],
    );
    updated++;
  }

  console.log(
    `[backfill-investing-tickers] scanned=${rows.length} updated=${updated} unchanged=${unchanged}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
