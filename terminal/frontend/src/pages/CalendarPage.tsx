import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchCalendarEventDetail,
  fetchCalendarEvents,
  fetchCalendarTypes,
  fetchWatchlists,
  getCalendarExportUrl
} from "../api";
import type { CalendarEvent, CalendarType, Watchlist } from "../types";

type Props = {
  pinnedTickers: string[];
};

export function CalendarPage({ pinnedTickers }: Props) {
  const navigate = useNavigate();
  const [types, setTypes] = useState<CalendarType[]>([]);
  const [activeType, setActiveType] = useState("earnings");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [watchlistId, setWatchlistId] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [region, setRegion] = useState("");
  const [sortBy, setSortBy] = useState("event_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const activeTypeConfig = useMemo(
    () => types.find((item) => item.key === activeType),
    [types, activeType]
  );

  const selectedWatchlistTickers = useMemo(() => {
    const watchlist = watchlists.find((item) => item.id === watchlistId);
    return watchlist?.tickers ?? [];
  }, [watchlistId, watchlists]);

  const explicitTickers = useMemo(
    () =>
      tickerInput
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    [tickerInput]
  );

  const mergedTickers = useMemo(() => {
    const base = watchlistId ? selectedWatchlistTickers : pinnedTickers;
    return Array.from(new Set([...base, ...explicitTickers]));
  }, [watchlistId, selectedWatchlistTickers, pinnedTickers, explicitTickers]);

  async function load(resetCursor = false): Promise<void> {
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

  async function openDetail(id: string): Promise<void> {
    const event = await fetchCalendarEventDetail(id);
    setDetail(event);
  }

  function toggleSort(column: string): void {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  }

  function openNews(item: CalendarEvent): void {
    const ticker = String(item.ticker ?? "");
    const eventDate = new Date(String(item.event_time));
    const from = new Date(eventDate.getTime() - 60 * 60 * 1000).toISOString();
    const to = new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams();
    if (ticker) params.set("tickers", ticker);
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

  return (
    <div className="panel-grid">
      <section className="main-panel">
        <h2>Calendar</h2>
        <div className="toolbar">
          <select value={activeType} onChange={(event) => setActiveType(event.target.value)}>
            {types.map((typeOption) => (
              <option key={typeOption.key} value={typeOption.key}>
                {typeOption.label}
              </option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <input
            value={tickerInput}
            placeholder="Tickers: NVDA,TSLA"
            onChange={(event) => setTickerInput(event.target.value)}
          />
          <select value={watchlistId} onChange={(event) => setWatchlistId(event.target.value)}>
            <option value="">Watchlist filter (one click)</option>
            {watchlists.map((watchlist) => (
              <option key={watchlist.id} value={watchlist.id}>
                {watchlist.name}
              </option>
            ))}
          </select>

          {activeType === "earnings" && (
            <select value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)}>
              <option value="">Time of day</option>
              <option value="BMO">BMO</option>
              <option value="AMC">AMC</option>
              <option value="Unknown">Unknown</option>
            </select>
          )}

          {activeType === "economics" && (
            <input value={region} placeholder="Country/Region (e.g. US)" onChange={(event) => setRegion(event.target.value)} />
          )}

          <button
            onClick={() => {
              setCursor(undefined);
              load(true).catch(console.error);
            }}
          >
            Apply Filters
          </button>
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button>Export CSV</button>
          </a>
          <select value={sortDir} onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="calendar-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} onClick={() => toggleSort(column)}>
                    {column}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((eventItem) => (
                <tr key={eventItem.id} onClick={() => openDetail(eventItem.id)}>
                  {columns.map((column) => (
                    <td key={`${eventItem.id}-${column}`}>{String(eventItem[column] ?? "")}</td>
                  ))}
                  <td>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openNews(eventItem);
                      }}
                    >
                      Open News
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="toolbar">
          <button
            onClick={() => {
              if (nextCursor) {
                setCursor(nextCursor);
              }
            }}
            disabled={!nextCursor}
          >
            Next Page
          </button>
        </div>
      </section>

      <aside className="detail-panel">
        {detail ? (
          <>
            <h3>{detail.title}</h3>
            <p>{new Date(String(detail.event_time)).toLocaleString()}</p>
            <p>{String(detail.ticker ?? "")}</p>
            <p>Source: {String(detail.source ?? "")}</p>
            <h4>All Fields</h4>
            <div className="json-grid">
              {Object.entries(detail.fields_json ?? {}).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}</strong>: {String(value ?? "")}
                </div>
              ))}
            </div>
            {typeof detail.fields_json?.link === "string" && detail.fields_json.link ? (
              <a href={String(detail.fields_json.link)} target="_blank" rel="noreferrer">
                Open Link
              </a>
            ) : null}
          </>
        ) : (
          <p>Select a row to open detail drawer.</p>
        )}
      </aside>
    </div>
  );
}
