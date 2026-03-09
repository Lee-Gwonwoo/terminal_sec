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
  bookmarkFolderId?: string;
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
  change_pct?: number | null;
  change_1d_pct?: number | null;
  change_from_open_pct?: number | null;
  change_open_to_high_pct?: number | null;
  change_3d_pct?: number | null;
  change_7d_pct?: number | null;
  change_14d_pct?: number | null;
  change_30d_pct?: number | null;
  change_computed_at?: string | null;
  // fulltext columns (Step 10)
  hasFullText?: boolean;
  keywords?: string[];
  keywordsStatus?: string | null;
  // industry (Step 5-22)
  industry?: string | null;
  // ver3: AI analysis
  score?: number | null;
  scoreEvidence?: string | null;
  analysisStatus?: string | null;
  // ver3: sentiment snapshot (symbol-level)
  sentimentBullishPct?: number | null;
  sentimentBearishPct?: number | null;
  companyNewsScore?: number | null;
  // ver3: peers (Step 7)
  peers?: string[];
  // ver3: company description (Step 8)
  companyDescription?: string | null;
};
