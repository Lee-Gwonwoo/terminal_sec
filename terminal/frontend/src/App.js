import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { NewsPage } from "./pages/NewsPage";
import { WatchlistsPage } from "./pages/WatchlistsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AlertsSettingsPage } from "./pages/AlertsSettingsPage";
export function App() {
    const [pinnedTickers, setPinnedTickers] = useState([]);
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("aside", { className: "sidebar", children: [_jsx("h1", { children: "Terminal" }), _jsxs("nav", { children: [_jsx(NavLink, { to: "/news", children: "News" }), _jsx(NavLink, { to: "/watchlists", children: "Watchlists" }), _jsx(NavLink, { to: "/calendar", children: "Calendar" }), _jsx(NavLink, { to: "/settings/alerts", children: "Alerts" })] })] }), _jsx("main", { className: "content", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/news", element: _jsx(NewsPage, { pinnedTickers: pinnedTickers, setPinnedTickers: setPinnedTickers }) }), _jsx(Route, { path: "/watchlists", element: _jsx(WatchlistsPage, { pinnedTickers: pinnedTickers, setPinnedTickers: setPinnedTickers }) }), _jsx(Route, { path: "/calendar", element: _jsx(CalendarPage, { pinnedTickers: pinnedTickers }) }), _jsx(Route, { path: "/settings/alerts", element: _jsx(AlertsSettingsPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/news", replace: true }) })] }) })] }));
}
