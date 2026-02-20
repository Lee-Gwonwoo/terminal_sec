export type TimeRangePreset = "15m" | "1h" | "today" | "custom";

export type NewsQuery = {
  keyword?: string;
  tickers?: string[];
  sources?: string[];
  tags?: string[];
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type NewsItem = {
  id: string;
  published_at: string;
  source: string;
  source_type: string;
  title: string;
  body: string;
  url: string;
  tickers: string[];
  tags: string[];
  created_at: string;
};
