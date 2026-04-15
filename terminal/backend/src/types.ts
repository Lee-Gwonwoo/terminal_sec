export type TimeRangePreset = "15m" | "1h" | "today" | "custom";

export type NewsQuery = {
  keyword?: string;
  tickers?: string[];
  sources?: string[];
  sourceNames?: string[];
  tags?: string[];
  from?: string;
  to?: string;
  floatPctMin?: number;
  floatPctMax?: number;
  institutionalPctMin?: number;
  institutionalPctMax?: number;
  insiderPctMin?: number;
  insiderPctMax?: number;
  limit?: number;
  cursor?: string;
  bookmarkFolderId?: string;
};

export type NewsItem = {
  id: string;
  published_at: string;
  source: string;
  publisher?: string | null;
  origin_url?: string | null;
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
  change_pct_ohlc_date?: string | null;
  change_1d_target_date?: string | null;
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
  ipoDate?: string | null;
  marketCap?: number | null;
  floatPct?: number | null;
  institutionalPct?: number | null;
  insiderPct?: number | null;
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

export type Model1NewsItem = Omit<
  NewsItem,
  | "ohlc_ticker"
  | "ohlc_date"
  | "change_pct_ohlc_date"
  | "change_1d_target_date"
  | "change_pct"
  | "change_1d_pct"
  | "change_from_open_pct"
  | "change_open_to_high_pct"
  | "change_3d_pct"
  | "change_7d_pct"
  | "change_14d_pct"
  | "change_30d_pct"
  | "change_computed_at"
>;
