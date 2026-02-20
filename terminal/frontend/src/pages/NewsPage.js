import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { createNewsStream, createSavedView, deleteSavedView, fetchNews, fetchNewsItem, fetchSavedViews, fetchWatchlists } from "../api";
const sourceOptions = ["press_release", "sec_filing", "partner_wire", "analyst_note"];
const tagOptions = ["earnings", "guidance", "merger", "split", "dividend", "macro", "options"];
export function NewsPage({ pinnedTickers, setPinnedTickers }) {
    const location = useLocation();
    const [filters, setFilters] = useState({ keyword: "", tickers: pinnedTickers, sources: [], tags: [] });
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [savedViews, setSavedViews] = useState([]);
    const [watchlists, setWatchlists] = useState([]);
    const [paused, setPaused] = useState(false);
    const [realtimeOn, setRealtimeOn] = useState(true);
    const [queuedItems, setQueuedItems] = useState([]);
    const [newItemsCount, setNewItemsCount] = useState(0);
    const [saveName, setSaveName] = useState("");
    const [saveAlertsEnabled, setSaveAlertsEnabled] = useState(false);
    const seenIdsRef = useRef(new Set());
    const filterPayload = useMemo(() => ({
        keyword: filters.keyword,
        tickers: filters.tickers,
        sources: filters.sources,
        tags: filters.tags,
        from: filters.from,
        to: filters.to
    }), [filters]);
    async function loadAll() {
        const [newsData, viewData, watchData] = await Promise.all([
            fetchNews(filterPayload),
            fetchSavedViews(),
            fetchWatchlists()
        ]);
        setItems(newsData.items);
        seenIdsRef.current = new Set(newsData.items.map((item) => item.id));
        setSavedViews(viewData);
        setWatchlists(watchData);
    }
    useEffect(() => {
        loadAll().catch(console.error);
    }, [filterPayload]);
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tickers = params
            .get("tickers")
            ?.split(",")
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);
        const from = params.get("from") || undefined;
        const to = params.get("to") || undefined;
        const keyword = params.get("keyword") || undefined;
        if (!tickers?.length && !from && !to && !keyword) {
            return;
        }
        setFilters((prev) => ({
            ...prev,
            tickers: tickers?.length ? tickers : prev.tickers,
            from: from ?? prev.from,
            to: to ?? prev.to,
            keyword: keyword ?? prev.keyword
        }));
    }, [location.search]);
    useEffect(() => {
        setFilters((prev) => ({ ...prev, tickers: pinnedTickers }));
    }, [pinnedTickers]);
    useEffect(() => {
        if (!realtimeOn) {
            const interval = setInterval(() => {
                fetchNews(filterPayload)
                    .then((data) => {
                    setItems((prev) => {
                        const all = [...data.items, ...prev];
                        const unique = Array.from(new Map(all.map((item) => [item.id, item])).values());
                        unique.sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));
                        return unique;
                    });
                })
                    .catch(console.error);
            }, 10000);
            return () => clearInterval(interval);
        }
        const stream = createNewsStream(filterPayload);
        stream.onmessage = (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed.type !== "news_item")
                return;
            const item = parsed.payload;
            if (seenIdsRef.current.has(item.id)) {
                return;
            }
            seenIdsRef.current.add(item.id);
            if (paused) {
                setQueuedItems((prev) => [item, ...prev]);
                setNewItemsCount((count) => count + 1);
                return;
            }
            setItems((prev) => [item, ...prev]);
            setNewItemsCount((count) => count + 1);
        };
        stream.onerror = () => {
            stream.close();
        };
        return () => stream.close();
    }, [filterPayload, paused, realtimeOn]);
    function updateCsvField(key, value) {
        setFilters((prev) => ({
            ...prev,
            [key]: value
                .split(",")
                .map((entry) => entry.trim().toUpperCase())
                .filter(Boolean)
        }));
    }
    async function openDetail(id) {
        const detail = await fetchNewsItem(id);
        setSelected(detail);
    }
    async function saveCurrentView() {
        if (!saveName.trim())
            return;
        await createSavedView({
            name: saveName.trim(),
            queryJson: filterPayload,
            enableAlerts: saveAlertsEnabled
        });
        setSaveName("");
        setSaveAlertsEnabled(false);
        setSavedViews(await fetchSavedViews());
    }
    function loadSavedView(view) {
        const query = view.query_json;
        setFilters({
            keyword: query.keyword ?? "",
            tickers: query.tickers ?? [],
            sources: query.sources ?? [],
            tags: query.tags ?? [],
            from: query.from,
            to: query.to
        });
    }
    function applyQueuedAndScrollTop() {
        if (queuedItems.length) {
            setItems((prev) => [...queuedItems, ...prev]);
            setQueuedItems([]);
        }
        setNewItemsCount(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return (_jsxs("div", { className: "panel-grid", children: [_jsxs("section", { className: "main-panel", children: [_jsxs("div", { className: "toolbar", children: [_jsx("input", { placeholder: "Search keyword", value: filters.keyword, onChange: (event) => setFilters((prev) => ({ ...prev, keyword: event.target.value })) }), _jsx("input", { placeholder: "Tickers: NVDA,TSLA", value: filters.tickers.join(","), onChange: (event) => updateCsvField("tickers", event.target.value) }), _jsxs("select", { onChange: (event) => event.target.value && loadSavedView(savedViews.find((v) => v.id === event.target.value)), children: [_jsx("option", { value: "", children: "Saved Views" }), savedViews.map((view) => (_jsx("option", { value: view.id, children: view.name }, view.id)))] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: paused, onChange: (event) => setPaused(event.target.checked) }), " Pause"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: realtimeOn, onChange: (event) => setRealtimeOn(event.target.checked) }), "Realtime"] })] }), _jsxs("div", { className: "toolbar secondary", children: [_jsx("select", { multiple: true, value: filters.sources, onChange: (event) => {
                                    const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                                    setFilters((prev) => ({ ...prev, sources: next }));
                                }, children: sourceOptions.map((source) => (_jsx("option", { value: source, children: source }, source))) }), _jsx("select", { multiple: true, value: filters.tags, onChange: (event) => {
                                    const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                                    setFilters((prev) => ({ ...prev, tags: next }));
                                }, children: tagOptions.map((tag) => (_jsx("option", { value: tag, children: tag }, tag))) }), _jsxs("select", { onChange: (event) => {
                                    const selected = watchlists.find((watchlist) => watchlist.id === event.target.value);
                                    if (selected) {
                                        setPinnedTickers(selected.tickers);
                                    }
                                }, children: [_jsx("option", { value: "", children: "Pin ticker from watchlist" }), watchlists.map((watchlist) => (_jsx("option", { value: watchlist.id, children: watchlist.name }, watchlist.id)))] })] }), _jsxs("div", { className: "toolbar secondary", children: [_jsx("input", { value: saveName, onChange: (event) => setSaveName(event.target.value), placeholder: "Saved View name" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: saveAlertsEnabled, onChange: (event) => setSaveAlertsEnabled(event.target.checked) }), "Enable alerts for this saved view"] }), _jsx("button", { onClick: saveCurrentView, children: "Save View" })] }), newItemsCount > 0 && (_jsxs("button", { className: "new-items-btn", onClick: applyQueuedAndScrollTop, children: ["New items (", newItemsCount, ")"] })), _jsx("div", { className: "feed-list", children: items.map((item) => (_jsxs("button", { className: "feed-row", onClick: () => openDetail(item.id), children: [_jsx("span", { children: new Date(item.published_at).toLocaleTimeString() }), _jsx("strong", { children: item.title }), _jsx("span", { children: item.tickers.join(" · ") }), _jsx("span", { children: item.source_type })] }, item.id))) })] }), _jsxs("aside", { className: "detail-panel", children: [selected ? (_jsxs(_Fragment, { children: [_jsx("h3", { children: selected.title }), _jsx("p", { children: new Date(selected.published_at).toLocaleString() }), _jsx("p", { children: selected.tickers.join(", ") }), _jsx("p", { children: selected.source }), _jsx("p", { children: selected.body }), _jsx("a", { href: selected.url, target: "_blank", children: "Open source link" })] })) : (_jsx("p", { children: "Select a news row to view details." })), _jsx("h4", { children: "Saved Views" }), savedViews.map((view) => (_jsxs("div", { className: "saved-view-row", children: [_jsx("span", { children: view.name }), _jsx("button", { onClick: () => deleteSavedView(view.id).then(() => fetchSavedViews().then(setSavedViews)), children: "Delete" })] }, view.id)))] })] }));
}
