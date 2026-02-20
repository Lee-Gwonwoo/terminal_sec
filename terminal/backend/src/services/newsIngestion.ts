import { withRetry } from "../utils/retry.js";
import { pullMockNews } from "../worker/mockProvider.js";
import { insertNewsItem } from "./newsRepository.js";
import { StreamHub } from "../realtime/streamHub.js";

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

export function startInProcessNewsIngestion(streamHub: StreamHub): void {
  const run = async () => {
    const providerItems = await withRetry(async () => pullMockNews(), {
      retries: 10,
      baseDelayMs: 150
    });

    for (const rawItem of providerItems) {
      const mergedText = `${rawItem.title} ${rawItem.body}`;
      const tickers = extractTickers(mergedText, rawItem.providerTickers);
      const tags = classifyTags(mergedText);
      const inserted = await withRetry(
        async () =>
          insertNewsItem({
            publishedAt: rawItem.publishedAt,
            source: rawItem.source,
            sourceType: rawItem.sourceType,
            title: rawItem.title,
            body: rawItem.body,
            url: rawItem.url,
            tickers,
            tags
          }),
        {
          retries: 10,
          baseDelayMs: 150
        }
      );

      if (inserted) {
        streamHub.publishNews(inserted);
      }
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, 5000);
}
