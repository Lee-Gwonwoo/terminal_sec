import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createWatchlist, deleteWatchlist, fetchWatchlists } from "../api";
export function WatchlistsPage({ pinnedTickers, setPinnedTickers }) {
    const [watchlists, setWatchlists] = useState([]);
    const [name, setName] = useState("");
    const [tickersCsv, setTickersCsv] = useState("");
    const [enableAlerts, setEnableAlerts] = useState(false);
    async function load() {
        setWatchlists(await fetchWatchlists());
    }
    useEffect(() => {
        load().catch(console.error);
    }, []);
    async function create() {
        const tickers = tickersCsv
            .split(",")
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);
        await createWatchlist({ name, tickers, enableAlerts });
        setName("");
        setTickersCsv("");
        setEnableAlerts(false);
        await load();
    }
    return (_jsxs("section", { children: [_jsx("h2", { children: "Watchlists" }), _jsxs("div", { className: "toolbar", children: [_jsx("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "List name" }), _jsx("input", { value: tickersCsv, onChange: (event) => setTickersCsv(event.target.value), placeholder: "Tickers: NVDA,TSLA" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: enableAlerts, onChange: (event) => setEnableAlerts(event.target.checked) }), "Enable alerts"] }), _jsx("button", { onClick: create, children: "Create" })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Tickers" }), _jsx("th", { children: "Alerts" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: watchlists.map((watchlist) => (_jsxs("tr", { children: [_jsx("td", { children: watchlist.name }), _jsx("td", { children: watchlist.tickers.join(", ") }), _jsx("td", { children: watchlist.enable_alerts ? "On" : "Off" }), _jsxs("td", { children: [_jsx("button", { onClick: () => setPinnedTickers(watchlist.tickers), children: "Use in News/Calendar" }), _jsx("button", { onClick: () => deleteWatchlist(watchlist.id).then(load), children: "Delete" })] })] }, watchlist.id))) })] }) }), _jsxs("p", { children: ["Current pinned tickers: ", pinnedTickers.join(", ") || "none"] })] }));
}
