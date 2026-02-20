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

export type SavedView = {
  id: string;
  name: string;
  query_json: Record<string, unknown>;
  enable_alerts: boolean;
};

export type Watchlist = {
  id: string;
  name: string;
  enable_alerts: boolean;
  tickers: string[];
};

export type CalendarEvent = {
  id: string;
  type: string;
  event_time: string;
  ticker: string | null;
  title: string;
  source: string;
  fields_json: Record<string, unknown>;
  [key: string]: unknown;
};

export type CalendarType = {
  key: string;
  label: string;
  supports: string[];
  columns: string[];
};

export type AlertRule = {
  id: string;
  tool: "news" | "watchlists" | "calendar";
  name: string;
  enabled: boolean;
  methods: Array<"browser" | "sound" | "email">;
  rule_json: Record<string, unknown>;
};

export type NewsFilters = {
  keyword: string;
  tickers: string[];
  sources: string[];
  tags: string[];
  from?: string;
  to?: string;
};
