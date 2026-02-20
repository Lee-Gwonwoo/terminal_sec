import { initDb } from "../db.js";
import { withRetry } from "../utils/retry.js";
import { pullMockNews } from "./mockProvider.js";
import { insertNewsItem } from "../services/newsRepository.js";

function extractTickers(text: string, providerTickers: string[]): string[] {
  const regexMatches = [...text.matchAll(/\$([A-Z]{1,5})/g)].map((match) => match[1]);
  return Array.from(new Set([...providerTickers, ...regexMatches]));
}

function classifyTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tagRules: Array<[string, string]> = [
    ["earnings", "earnings"],
    ["guidance", "guidance"],
    ["merger", "merger"],
    ["split", "split"],
    ["dividend", "dividend"],
    ["macro", "macro"],
    ["options", "options"]
  ];

  return tagRules.filter(([token]) => lower.includes(token)).map(([, tag]) => tag);
}

async function runOnce(): Promise<void> {
  const providerItems = await withRetry(async () => pullMockNews(), {
    retries: 10,
    baseDelayMs: 150
  });

  for (const rawItem of providerItems) {
    const mergedText = `${rawItem.title} ${rawItem.body}`;
    const tickers = extractTickers(mergedText, rawItem.providerTickers);
    const tags = classifyTags(mergedText);

    const inserted = await insertNewsItem({
      publishedAt: rawItem.publishedAt,
      source: rawItem.source,
      sourceType: rawItem.sourceType,
      title: rawItem.title,
      body: rawItem.body,
      url: rawItem.url,
      tickers,
      tags
    });

    if (inserted) {
      console.log(`Inserted news: ${inserted.title}`);
    }
  }
}

async function start(): Promise<void> {
  await initDb();
  await runOnce();
  setInterval(() => {
    void runOnce();
  }, 5000);
  console.log("Local ingestion worker running without Redis");
}

start().catch((error) => {
  console.error("Worker failed", error);
  process.exit(1);
});
