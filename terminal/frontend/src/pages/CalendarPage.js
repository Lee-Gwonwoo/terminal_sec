import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCalendarEventDetail, fetchCalendarEvents, fetchCalendarTypes, fetchWatchlists, getCalendarExportUrl } from "../api";
export function CalendarPage({ pinnedTickers }) {
    const navigate = useNavigate();
    const [types, setTypes] = useState([]);
    const [activeType, setActiveType] = useState("earnings");
    const [events, setEvents] = useState([]);
    const [detail, setDetail] = useState(null);
    const [watchlists, setWatchlists] = useState([]);
    const [watchlistId, setWatchlistId] = useState("");
    const [tickerInput, setTickerInput] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [timeOfDay, setTimeOfDay] = useState("");
    const [region, setRegion] = useState("");
    const [sortBy, setSortBy] = useState("event_time");
    const [sortDir, setSortDir] = useState("desc");
    const [cursor, setCursor] = useState(undefined);
    const [nextCursor, setNextCursor] = useState(undefined);
    const activeTypeConfig = useMemo(() => types.find((item) => item.key === activeType), [types, activeType]);
    const selectedWatchlistTickers = useMemo(() => {
        const watchlist = watchlists.find((item) => item.id === watchlistId);
        return watchlist?.tickers ?? [];
    }, [watchlistId, watchlists]);
    const explicitTickers = useMemo(() => tickerInput
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean), [tickerInput]);
    const mergedTickers = useMemo(() => {
        const base = watchlistId ? selectedWatchlistTickers : pinnedTickers;
        return Array.from(new Set([...base, ...explicitTickers]));
    }, [watchlistId, selectedWatchlistTickers, pinnedTickers, explicitTickers]);
    async function load(resetCursor = false) {
        const effectiveCursor = resetCursor ? undefined : cursor;
        const sort = `${sortBy}:${sortDir}`;
        const response = await fetchCalendarEvents({
            type: activeType,
            tickers: mergedTickers,
            watchlistId: watchlistId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            timeOfDay: timeOfDay || undefined,
            region: region || undefined,
            sort,
            cursor: effectiveCursor,
            limit: 100
        });
        setEvents(response.items);
        setNextCursor(response.nextCursor);
        if (resetCursor) {
            setCursor(undefined);
        }
    }
    useEffect(() => {
        fetchCalendarTypes().then(setTypes).catch(console.error);
        fetchWatchlists().then(setWatchlists).catch(console.error);
    }, []);
    useEffect(() => {
        setCursor(undefined);
        load(true).catch(console.error);
    }, [activeType, watchlistId, mergedTickers.join(","), fromDate, toDate, timeOfDay, region, sortBy, sortDir]);
    useEffect(() => {
        if (!cursor) {
            return;
        }
        load(false).catch(console.error);
    }, [cursor]);
    async function openDetail(id) {
        const event = await fetchCalendarEventDetail(id);
        setDetail(event);
    }
    function toggleSort(column) {
        if (sortBy === column) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortBy(column);
        setSortDir("asc");
    }
    function openNews(item) {
        const ticker = String(item.ticker ?? "");
        const eventDate = new Date(String(item.event_time));
        const from = new Date(eventDate.getTime() - 60 * 60 * 1000).toISOString();
        const to = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString();
        const params = new URLSearchParams();
        if (ticker)
            params.set("tickers", ticker);
        params.set("from", from);
        params.set("to", to);
        navigate(`/news?${params.toString()}`);
    }
    const exportUrl = getCalendarExportUrl({
        type: activeType,
        tickers: mergedTickers,
        watchlistId: watchlistId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        timeOfDay: timeOfDay || undefined,
        region: region || undefined,
        sort: `${sortBy}:${sortDir}`
    });
    const columns = useMemo(() => {
        const core = ["event_time", "ticker", "title"];
        const dynamic = activeTypeConfig?.columns ?? [];
        return Array.from(new Set([...core, ...dynamic]));
    }, [activeTypeConfig]);
    return (_jsxs("div", { className: "panel-grid", children: [_jsxs("section", { className: "main-panel", children: [_jsx("h2", { children: "Calendar" }), _jsxs("div", { className: "toolbar", children: [_jsx("select", { value: activeType, onChange: (event) => setActiveType(event.target.value), children: types.map((typeOption) => (_jsx("option", { value: typeOption.key, children: typeOption.label }, typeOption.key))) }), _jsx("input", { type: "date", value: fromDate, onChange: (event) => setFromDate(event.target.value) }), _jsx("input", { type: "date", value: toDate, onChange: (event) => setToDate(event.target.value) }), _jsx("input", { value: tickerInput, placeholder: "Tickers: NVDA,TSLA", onChange: (event) => setTickerInput(event.target.value) }), _jsxs("select", { value: watchlistId, onChange: (event) => setWatchlistId(event.target.value), children: [_jsx("option", { value: "", children: "Watchlist filter (one click)" }), watchlists.map((watchlist) => (_jsx("option", { value: watchlist.id, children: watchlist.name }, watchlist.id)))] }), activeType === "earnings" && (_jsxs("select", { value: timeOfDay, onChange: (event) => setTimeOfDay(event.target.value), children: [_jsx("option", { value: "", children: "Time of day" }), _jsx("option", { value: "BMO", children: "BMO" }), _jsx("option", { value: "AMC", children: "AMC" }), _jsx("option", { value: "Unknown", children: "Unknown" })] })), activeType === "economics" && (_jsx("input", { value: region, placeholder: "Country/Region (e.g. US)", onChange: (event) => setRegion(event.target.value) })), _jsx("button", { onClick: () => {
                                    setCursor(undefined);
                                    load(true).catch(console.error);
                                }, children: "Apply Filters" }), _jsx("a", { href: exportUrl, target: "_blank", rel: "noreferrer", children: _jsx("button", { children: "Export CSV" }) }), _jsxs("select", { value: sortDir, onChange: (event) => setSortDir(event.target.value), children: [_jsx("option", { value: "desc", children: "Desc" }), _jsx("option", { value: "asc", children: "Asc" })] })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "calendar-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [columns.map((column) => (_jsx("th", { onClick: () => toggleSort(column), children: column }, column))), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: events.map((eventItem) => (_jsxs("tr", { onClick: () => openDetail(eventItem.id), children: [columns.map((column) => (_jsx("td", { children: String(eventItem[column] ?? "") }, `${eventItem.id}-${column}`))), _jsx("td", { children: _jsx("button", { onClick: (event) => {
                                                        event.stopPropagation();
                                                        openNews(eventItem);
                                                    }, children: "Open News" }) })] }, eventItem.id))) })] }) }), _jsx("div", { className: "toolbar", children: _jsx("button", { onClick: () => {
                                if (nextCursor) {
                                    setCursor(nextCursor);
                                }
                            }, disabled: !nextCursor, children: "Next Page" }) })] }), _jsx("aside", { className: "detail-panel", children: detail ? (_jsxs(_Fragment, { children: [_jsx("h3", { children: detail.title }), _jsx("p", { children: new Date(String(detail.event_time)).toLocaleString() }), _jsx("p", { children: String(detail.ticker ?? "") }), _jsxs("p", { children: ["Source: ", String(detail.source ?? "")] }), _jsx("h4", { children: "All Fields" }), _jsx("div", { className: "json-grid", children: Object.entries(detail.fields_json ?? {}).map(([key, value]) => (_jsxs("div", { children: [_jsx("strong", { children: key }), ": ", String(value ?? "")] }, key))) }), typeof detail.fields_json?.link === "string" && detail.fields_json.link ? (_jsx("a", { href: String(detail.fields_json.link), target: "_blank", rel: "noreferrer", children: "Open Link" })) : null] })) : (_jsx("p", { children: "Select a row to open detail drawer." })) })] }));
}
