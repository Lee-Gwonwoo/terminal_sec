export type TimeRangePreset = "15m" | "1h" | "today" | "custom";

export type NewsQuery = {
  keyword?: string;
  tickers?: string[];
  sources?: string[];
  sourceNames?: string[];
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
  publisher?: string | null;
  source_type: string;
  title: string;
  body: string;
  url: string;
  tickers: string[];
  tags: string[];
  created_at: string;
  // change% columns (Step 4)
  ohlc_ticker?: string | null;
  ohlc_date?: string | null;
  change_1d_pct?: number | null;
  change_from_open_pct?: number | null;
  change_7d_pct?: number | null;
  change_14d_pct?: number | null;
  change_30d_pct?: number | null;
  change_computed_at?: string | null;
  // fulltext columns (Step 10)
  hasFullText?: boolean;
  keywords?: string[];
  keywordsStatus?: string | null;
};
