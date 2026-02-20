import { randomUUID } from "node:crypto";

const tickers = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD", "SPY", "QQQ"];
const sourceTypes = ["press_release", "sec_filing", "partner_wire", "analyst_note"];
const headlineTemplates = [
  "{ticker} reports strong earnings guidance",
  "{ticker} announces strategic merger talks",
  "{ticker} files new SEC form",
  "Macro update impacts options activity in {ticker}",
  "Dividend and split chatter rises for {ticker}"
];

export type ProviderNewsItem = {
  externalId: string;
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  providerTickers: string[];
};

function pickRandom<T>(items: T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

export async function pullMockNews(): Promise<ProviderNewsItem[]> {
  const ticker = pickRandom(tickers);
  const template = pickRandom(headlineTemplates);
  const title = template.replace("{ticker}", ticker);
  const body = `${title}. $${ticker} sees elevated options flow and market participants discuss earnings and guidance.`;

  return [
    {
      externalId: randomUUID(),
      publishedAt: new Date().toISOString(),
      source: "Mock Wire",
      sourceType: pickRandom(sourceTypes),
      title,
      body,
      url: `https://example.com/news/${randomUUID()}`,
      providerTickers: [ticker]
    }
  ];
}
