import { useEffect, useState } from "react";
import { createWatchlist, deleteWatchlist, fetchWatchlists } from "../api";
import type { Watchlist } from "../types";

type Props = {
  pinnedTickers: string[];
  setPinnedTickers: (tickers: string[]) => void;
};

export function WatchlistsPage({ pinnedTickers, setPinnedTickers }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [name, setName] = useState("");
  const [tickersCsv, setTickersCsv] = useState("");
  const [enableAlerts, setEnableAlerts] = useState(false);

  async function load(): Promise<void> {
    setWatchlists(await fetchWatchlists());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function create(): Promise<void> {
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

  return (
    <section>
      <h2>Watchlists</h2>
      <div className="toolbar">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="List name" />
        <input
          value={tickersCsv}
          onChange={(event) => setTickersCsv(event.target.value)}
          placeholder="Tickers: NVDA,TSLA"
        />
        <label>
          <input
            type="checkbox"
            checked={enableAlerts}
            onChange={(event) => setEnableAlerts(event.target.checked)}
          />
          Enable alerts
        </label>
        <button onClick={create}>Create</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tickers</th>
              <th>Alerts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {watchlists.map((watchlist) => (
              <tr key={watchlist.id}>
                <td>{watchlist.name}</td>
                <td>{watchlist.tickers.join(", ")}</td>
                <td>{watchlist.enable_alerts ? "On" : "Off"}</td>
                <td>
                  <button onClick={() => setPinnedTickers(watchlist.tickers)}>Use in News/Calendar</button>
                  <button onClick={() => deleteWatchlist(watchlist.id).then(load)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>Current pinned tickers: {pinnedTickers.join(", ") || "none"}</p>
    </section>
  );
}
