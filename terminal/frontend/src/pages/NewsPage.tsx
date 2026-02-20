import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  createNewsStream,
  createSavedView,
  deleteSavedView,
  fetchNews,
  fetchNewsItem,
  fetchSavedViews,
  fetchWatchlists
} from "../api";
import type { NewsFilters, NewsItem, SavedView, Watchlist } from "../types";

const sourceOptions = ["press_release", "sec_filing", "partner_wire", "analyst_note"];
const tagOptions = ["earnings", "guidance", "merger", "split", "dividend", "macro", "options"];

type Props = {
  pinnedTickers: string[];
  setPinnedTickers: (tickers: string[]) => void;
};

export function NewsPage({ pinnedTickers, setPinnedTickers }: Props) {
  const location = useLocation();
  const [filters, setFilters] = useState<NewsFilters>({ keyword: "", tickers: pinnedTickers, sources: [], tags: [] });
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [paused, setPaused] = useState(false);
  const [realtimeOn, setRealtimeOn] = useState(true);
  const [queuedItems, setQueuedItems] = useState<NewsItem[]>([]);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [saveName, setSaveName] = useState("");
  const [saveAlertsEnabled, setSaveAlertsEnabled] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());

  const filterPayload = useMemo(
    () => ({
      keyword: filters.keyword,
      tickers: filters.tickers,
      sources: filters.sources,
      tags: filters.tags,
      from: filters.from,
      to: filters.to
    }),
    [filters]
  );

  async function loadAll(): Promise<void> {
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
      const parsed = JSON.parse(event.data) as { type: string; payload: NewsItem };
      if (parsed.type !== "news_item") return;

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

  function updateCsvField<K extends keyof NewsFilters>(key: K, value: string) {
    setFilters((prev) => ({
      ...prev,
      [key]: value
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean)
    }));
  }

  async function openDetail(id: string): Promise<void> {
    const detail = await fetchNewsItem(id);
    setSelected(detail);
  }

  async function saveCurrentView(): Promise<void> {
    if (!saveName.trim()) return;
    await createSavedView({
      name: saveName.trim(),
      queryJson: filterPayload,
      enableAlerts: saveAlertsEnabled
    });
    setSaveName("");
    setSaveAlertsEnabled(false);
    setSavedViews(await fetchSavedViews());
  }

  function loadSavedView(view: SavedView): void {
    const query = view.query_json as Partial<NewsFilters>;
    setFilters({
      keyword: query.keyword ?? "",
      tickers: query.tickers ?? [],
      sources: query.sources ?? [],
      tags: query.tags ?? [],
      from: query.from,
      to: query.to
    });
  }

  function applyQueuedAndScrollTop(): void {
    if (queuedItems.length) {
      setItems((prev) => [...queuedItems, ...prev]);
      setQueuedItems([]);
    }
    setNewItemsCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="panel-grid">
      <section className="main-panel">
        <div className="toolbar">
          <input
            placeholder="Search keyword"
            value={filters.keyword}
            onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
          />
          <input
            placeholder="Tickers: NVDA,TSLA"
            value={filters.tickers.join(",")}
            onChange={(event) => updateCsvField("tickers", event.target.value)}
          />
          <select onChange={(event) => event.target.value && loadSavedView(savedViews.find((v) => v.id === event.target.value)!)}>
            <option value="">Saved Views</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} /> Pause
          </label>
          <label>
            <input
              type="checkbox"
              checked={realtimeOn}
              onChange={(event) => setRealtimeOn(event.target.checked)}
            />
            Realtime
          </label>
        </div>

        <div className="toolbar secondary">
          <select multiple value={filters.sources} onChange={(event) => {
            const next = Array.from(event.target.selectedOptions).map((option) => option.value);
            setFilters((prev) => ({ ...prev, sources: next }));
          }}>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>

          <select multiple value={filters.tags} onChange={(event) => {
            const next = Array.from(event.target.selectedOptions).map((option) => option.value);
            setFilters((prev) => ({ ...prev, tags: next }));
          }}>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <select
            onChange={(event) => {
              const selected = watchlists.find((watchlist) => watchlist.id === event.target.value);
              if (selected) {
                setPinnedTickers(selected.tickers);
              }
            }}
          >
            <option value="">Pin ticker from watchlist</option>
            {watchlists.map((watchlist) => (
              <option key={watchlist.id} value={watchlist.id}>{watchlist.name}</option>
            ))}
          </select>
        </div>

        <div className="toolbar secondary">
          <input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Saved View name" />
          <label>
            <input
              type="checkbox"
              checked={saveAlertsEnabled}
              onChange={(event) => setSaveAlertsEnabled(event.target.checked)}
            />
            Enable alerts for this saved view
          </label>
          <button onClick={saveCurrentView}>Save View</button>
        </div>

        {newItemsCount > 0 && (
          <button className="new-items-btn" onClick={applyQueuedAndScrollTop}>
            New items ({newItemsCount})
          </button>
        )}

        <div className="feed-list">
          {items.map((item) => (
            <button key={item.id} className="feed-row" onClick={() => openDetail(item.id)}>
              <span>{new Date(item.published_at).toLocaleTimeString()}</span>
              <strong>{item.title}</strong>
              <span>{item.tickers.join(" · ")}</span>
              <span>{item.source_type}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="detail-panel">
        {selected ? (
          <>
            <h3>{selected.title}</h3>
            <p>{new Date(selected.published_at).toLocaleString()}</p>
            <p>{selected.tickers.join(", ")}</p>
            <p>{selected.source}</p>
            <p>{selected.body}</p>
            <a href={selected.url} target="_blank">Open source link</a>
          </>
        ) : (
          <p>Select a news row to view details.</p>
        )}

        <h4>Saved Views</h4>
        {savedViews.map((view) => (
          <div key={view.id} className="saved-view-row">
            <span>{view.name}</span>
            <button onClick={() => deleteSavedView(view.id).then(() => fetchSavedViews().then(setSavedViews))}>Delete</button>
          </div>
        ))}
      </aside>
    </div>
  );
}
