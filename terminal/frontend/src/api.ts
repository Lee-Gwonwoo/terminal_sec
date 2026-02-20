import type {
  AlertRule,
  CalendarEvent,
  CalendarType,
  NewsFilters,
  NewsItem,
  SavedView,
  Watchlist
} from "./types";

const API_BASE = "http://localhost:8080";

function asList(value: string[]): string {
  return value.join(",");
}

export function buildNewsQuery(filters: Partial<NewsFilters>): string {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.tickers?.length) params.set("tickers", asList(filters.tickers));
  if (filters.sources?.length) params.set("sources", asList(filters.sources));
  if (filters.tags?.length) params.set("tags", asList(filters.tags));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("limit", "50");
  return params.toString();
}

export async function fetchNews(filters: Partial<NewsFilters>) {
  const query = buildNewsQuery(filters);
  const response = await fetch(`${API_BASE}/api/news?${query}`);
  if (!response.ok) throw new Error("Failed to load news");
  return (await response.json()) as { items: NewsItem[]; nextCursor?: string };
}

export async function fetchNewsItem(id: string) {
  const response = await fetch(`${API_BASE}/api/news/${id}`);
  if (!response.ok) throw new Error("Failed to load news detail");
  return (await response.json()) as NewsItem;
}

export async function fetchSavedViews() {
  const response = await fetch(`${API_BASE}/api/news/saved-views`);
  if (!response.ok) throw new Error("Failed to load saved views");
  return (await response.json()) as SavedView[];
}

export async function createSavedView(payload: {
  name: string;
  queryJson: Record<string, unknown>;
  enableAlerts: boolean;
}) {
  const response = await fetch(`${API_BASE}/api/news/saved-views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create saved view");
  return (await response.json()) as SavedView;
}

export async function deleteSavedView(id: string) {
  const response = await fetch(`${API_BASE}/api/news/saved-views/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete saved view");
}

export async function fetchWatchlists() {
  const response = await fetch(`${API_BASE}/api/watchlists`);
  if (!response.ok) throw new Error("Failed to load watchlists");
  return (await response.json()) as Watchlist[];
}

export async function createWatchlist(payload: {
  name: string;
  tickers: string[];
  enableAlerts: boolean;
}) {
  const response = await fetch(`${API_BASE}/api/watchlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create watchlist");
  return (await response.json()) as Watchlist;
}

export async function deleteWatchlist(id: string) {
  const response = await fetch(`${API_BASE}/api/watchlists/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete watchlist");
}

export async function fetchCalendarTypes() {
  const response = await fetch(`${API_BASE}/api/calendar/types`);
  if (!response.ok) throw new Error("Failed to load calendar types");
  return (await response.json()) as CalendarType[];
}

export async function fetchCalendarEvents(filters: {
  type: string;
  tickers?: string[];
  watchlistId?: string;
  from?: string;
  to?: string;
  timeOfDay?: string;
  region?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  params.set("type", filters.type);
  if (filters.tickers?.length) params.set("tickers", filters.tickers.join(","));
  if (filters.watchlistId) params.set("watchlist_id", filters.watchlistId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.timeOfDay) params.set("time_of_day", filters.timeOfDay);
  if (filters.region) params.set("region", filters.region);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetch(`${API_BASE}/api/calendar/events?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load calendar events");
  return (await response.json()) as { items: CalendarEvent[]; nextCursor?: string };
}

export async function fetchCalendarEventDetail(id: string) {
  const response = await fetch(`${API_BASE}/api/calendar/events/${id}`);
  if (!response.ok) throw new Error("Failed to load calendar detail");
  return (await response.json()) as CalendarEvent;
}

export function getCalendarExportUrl(filters: {
  type: string;
  tickers?: string[];
  watchlistId?: string;
  from?: string;
  to?: string;
  timeOfDay?: string;
  region?: string;
  sort?: string;
}) {
  const params = new URLSearchParams();
  params.set("type", filters.type);
  if (filters.tickers?.length) params.set("tickers", filters.tickers.join(","));
  if (filters.watchlistId) params.set("watchlist_id", filters.watchlistId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.timeOfDay) params.set("time_of_day", filters.timeOfDay);
  if (filters.region) params.set("region", filters.region);
  if (filters.sort) params.set("sort", filters.sort);
  return `${API_BASE}/api/calendar/events/export.csv?${params.toString()}`;
}

export async function fetchAlertRules() {
  const response = await fetch(`${API_BASE}/api/settings/alerts`);
  if (!response.ok) throw new Error("Failed to load alert rules");
  return (await response.json()) as AlertRule[];
}

export async function saveAlertRule(payload: Omit<AlertRule, "id"> & { id?: string }) {
  const response = await fetch(`${API_BASE}/api/settings/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to save alert rule");
  return (await response.json()) as AlertRule;
}

export function createNewsStream(filters: Partial<NewsFilters>): EventSource {
  const query = buildNewsQuery(filters);
  return new EventSource(`${API_BASE}/api/news/stream?${query}`);
}
