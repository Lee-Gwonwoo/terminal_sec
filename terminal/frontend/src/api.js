const API_BASE = "http://localhost:8080";
function asList(value) {
    return value.join(",");
}
export function buildNewsQuery(filters) {
    const params = new URLSearchParams();
    if (filters.keyword)
        params.set("keyword", filters.keyword);
    if (filters.tickers?.length)
        params.set("tickers", asList(filters.tickers));
    if (filters.sources?.length)
        params.set("sources", asList(filters.sources));
    if (filters.tags?.length)
        params.set("tags", asList(filters.tags));
    if (filters.from)
        params.set("from", filters.from);
    if (filters.to)
        params.set("to", filters.to);
    params.set("limit", "50");
    return params.toString();
}
export async function fetchNews(filters) {
    const query = buildNewsQuery(filters);
    const response = await fetch(`${API_BASE}/api/news?${query}`);
    if (!response.ok)
        throw new Error("Failed to load news");
    return (await response.json());
}
export async function fetchNewsItem(id) {
    const response = await fetch(`${API_BASE}/api/news/${id}`);
    if (!response.ok)
        throw new Error("Failed to load news detail");
    return (await response.json());
}
export async function fetchSavedViews() {
    const response = await fetch(`${API_BASE}/api/news/saved-views`);
    if (!response.ok)
        throw new Error("Failed to load saved views");
    return (await response.json());
}
export async function createSavedView(payload) {
    const response = await fetch(`${API_BASE}/api/news/saved-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok)
        throw new Error("Failed to create saved view");
    return (await response.json());
}
export async function deleteSavedView(id) {
    const response = await fetch(`${API_BASE}/api/news/saved-views/${id}`, { method: "DELETE" });
    if (!response.ok)
        throw new Error("Failed to delete saved view");
}
export async function fetchWatchlists() {
    const response = await fetch(`${API_BASE}/api/watchlists`);
    if (!response.ok)
        throw new Error("Failed to load watchlists");
    return (await response.json());
}
export async function createWatchlist(payload) {
    const response = await fetch(`${API_BASE}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok)
        throw new Error("Failed to create watchlist");
    return (await response.json());
}
export async function deleteWatchlist(id) {
    const response = await fetch(`${API_BASE}/api/watchlists/${id}`, { method: "DELETE" });
    if (!response.ok)
        throw new Error("Failed to delete watchlist");
}
export async function fetchCalendarTypes() {
    const response = await fetch(`${API_BASE}/api/calendar/types`);
    if (!response.ok)
        throw new Error("Failed to load calendar types");
    return (await response.json());
}
export async function fetchCalendarEvents(filters) {
    const params = new URLSearchParams();
    params.set("type", filters.type);
    if (filters.tickers?.length)
        params.set("tickers", filters.tickers.join(","));
    if (filters.watchlistId)
        params.set("watchlist_id", filters.watchlistId);
    if (filters.from)
        params.set("from", filters.from);
    if (filters.to)
        params.set("to", filters.to);
    if (filters.timeOfDay)
        params.set("time_of_day", filters.timeOfDay);
    if (filters.region)
        params.set("region", filters.region);
    if (filters.sort)
        params.set("sort", filters.sort);
    if (filters.cursor)
        params.set("cursor", filters.cursor);
    if (filters.limit)
        params.set("limit", String(filters.limit));
    const response = await fetch(`${API_BASE}/api/calendar/events?${params.toString()}`);
    if (!response.ok)
        throw new Error("Failed to load calendar events");
    return (await response.json());
}
export async function fetchCalendarEventDetail(id) {
    const response = await fetch(`${API_BASE}/api/calendar/events/${id}`);
    if (!response.ok)
        throw new Error("Failed to load calendar detail");
    return (await response.json());
}
export function getCalendarExportUrl(filters) {
    const params = new URLSearchParams();
    params.set("type", filters.type);
    if (filters.tickers?.length)
        params.set("tickers", filters.tickers.join(","));
    if (filters.watchlistId)
        params.set("watchlist_id", filters.watchlistId);
    if (filters.from)
        params.set("from", filters.from);
    if (filters.to)
        params.set("to", filters.to);
    if (filters.timeOfDay)
        params.set("time_of_day", filters.timeOfDay);
    if (filters.region)
        params.set("region", filters.region);
    if (filters.sort)
        params.set("sort", filters.sort);
    return `${API_BASE}/api/calendar/events/export.csv?${params.toString()}`;
}
export async function fetchAlertRules() {
    const response = await fetch(`${API_BASE}/api/settings/alerts`);
    if (!response.ok)
        throw new Error("Failed to load alert rules");
    return (await response.json());
}
export async function saveAlertRule(payload) {
    const response = await fetch(`${API_BASE}/api/settings/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok)
        throw new Error("Failed to save alert rule");
    return (await response.json());
}
export function createNewsStream(filters) {
    const query = buildNewsQuery(filters);
    return new EventSource(`${API_BASE}/api/news/stream?${query}`);
}
