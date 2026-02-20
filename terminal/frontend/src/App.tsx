import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { NewsPage } from "./pages/NewsPage";
import { WatchlistsPage } from "./pages/WatchlistsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AlertsSettingsPage } from "./pages/AlertsSettingsPage";

export function App() {
  const [pinnedTickers, setPinnedTickers] = useState<string[]>([]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Terminal</h1>
        <nav>
          <NavLink to="/news">News</NavLink>
          <NavLink to="/watchlists">Watchlists</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/settings/alerts">Alerts</NavLink>
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route
            path="/news"
            element={<NewsPage pinnedTickers={pinnedTickers} setPinnedTickers={setPinnedTickers} />}
          />
          <Route
            path="/watchlists"
            element={<WatchlistsPage pinnedTickers={pinnedTickers} setPinnedTickers={setPinnedTickers} />}
          />
          <Route path="/calendar" element={<CalendarPage pinnedTickers={pinnedTickers} />} />
          <Route path="/settings/alerts" element={<AlertsSettingsPage />} />
          <Route path="*" element={<Navigate to="/news" replace />} />
        </Routes>
      </main>
    </div>
  );
}
