import React, { useState, useEffect } from 'react';
import { Search, Save, ChevronDown, Filter, X } from 'lucide-react';
import { NewsItem, NewsFilter, SavedSearch } from '../types';
import { filterNewsByQuery, groupNewsByDate } from '../mockData';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface NewsWindowProps {
  onTickerClick?: (ticker: string) => void;
  initialTicker?: string;
}

export function NewsWindow({ onTickerClick, initialTicker }: NewsWindowProps) {
  const [searchQuery, setSearchQuery] = useState(initialTicker || '');
  const [remoteNews, setRemoteNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string>('');
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<NewsFilter>({
    dateFrom: null,
    dateTo: null,
    marketCap: [],
    source: [],
    sector: []
  });

  useEffect(() => {
    let cancelled = false;

    const mapBackendItem = (item: any): NewsItem | null => {
      const publishedAt = typeof item?.published_at === 'string' ? item.published_at : null;
      if (!publishedAt) {
        return null;
      }
      const dt = new Date(publishedAt);
      const date = publishedAt.slice(0, 10);
      const time = Number.isNaN(dt.getTime())
        ? ''
        : dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      return {
        id: typeof item?.id === 'string' ? item.id : `${publishedAt}-${Math.random()}`,
        time,
        ticker: Array.isArray(item?.tickers) ? item.tickers : [],
        title: typeof item?.title === 'string' ? item.title : '',
        source: typeof item?.source === 'string' ? item.source : 'EODHD',
        url: typeof item?.url === 'string' ? item.url : undefined,
        date,
        content: typeof item?.body === 'string' ? item.body : undefined
      };
    };

    const loadDemoDate = async () => {
      // Demo/backfill: fetch and display 2026-02-15..2026-02-19 items.
      // Backend will read token from repo-root EODHD/API TOKEN.
      try {
        await fetch('/api/news/pull-eodhd', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from: '2026-02-15', to: '2026-02-19', symbol: '', limit: 200, fetch_all: true })
        });
      } catch (e) {
        console.warn('EODHD pull failed (check token/network).', e);
      }

      try {
        const fromIso = '2026-02-15T00:00:00.000Z';
        const toIso = '2026-02-19T23:59:59.999Z';
        const mapped: NewsItem[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 100; page++) {
          const url = new URL('/api/news', window.location.origin);
          url.searchParams.set('from', fromIso);
          url.searchParams.set('to', toIso);
          url.searchParams.set('source_names', 'EODHD');
          url.searchParams.set('limit', '200');
          if (cursor) {
            url.searchParams.set('cursor', cursor);
          }

          const response = await fetch(url.toString());
          if (!response.ok) {
            throw new Error(`GET /api/news failed: ${response.status}`);
          }

          const json = await response.json();
          const items = Array.isArray(json?.items) ? json.items : [];
          mapped.push(...(items.map(mapBackendItem).filter(Boolean) as NewsItem[]));

          cursor = typeof json?.nextCursor === 'string' && json.nextCursor.trim() !== '' ? json.nextCursor : undefined;
          if (!cursor) {
            break;
          }
        }

        if (!cancelled && mapped.length > 0) {
          setRemoteNews(mapped);
          // Default the date filters to the loaded demo range so it shows immediately.
          setFilters((prev) => ({
            ...prev,
            dateFrom: new Date('2026-02-15T00:00:00.000Z'),
            dateTo: new Date('2026-02-19T23:59:59.999Z')
          }));
        }
      } catch (e) {
        console.warn('Failed to load /api/news.', e);
      }
    };

    void loadDemoDate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialTicker) {
      setSearchQuery(initialTicker);
    }
  }, [initialTicker]);

  useEffect(() => {
    let result = filterNewsByQuery(remoteNews, searchQuery);
    
    // Apply date filters
    if (filters.dateFrom) {
      result = result.filter(item => new Date(item.date) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter(item => new Date(item.date) <= filters.dateTo!);
    }
    
    // Apply source filter
    if (filters.source.length > 0) {
      result = result.filter(item => filters.source.includes(item.source));
    }
    
    setFilteredNews(result);
  }, [searchQuery, filters, remoteNews]);

  const groupedNews = groupNewsByDate(filteredNews);
  const sortedDates = Array.from(groupedNews.keys()).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const handleSaveSearch = () => {
    if (saveName.trim()) {
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name: saveName,
        searchQuery,
        filters
      };
      setSavedSearches([...savedSearches, newSearch]);
      setSaveName('');
      setShowSaveDialog(false);
    }
  };

  const handleLoadSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (search) {
      setSearchQuery(search.searchQuery);
      setFilters(search.filters);
      setSelectedSavedSearch(searchId);
    }
  };

  const toggleFilter = (filterType: keyof NewsFilter, value: string) => {
    const currentValues = filters[filterType] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    setFilters({ ...filters, [filterType]: newValues });
  };

  const marketCapOptions = ['Large Cap', 'Mid Cap', 'Small Cap', 'Micro Cap'];
  const sourceOptions = ['EODHD'];
  const sectorOptions = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer'];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g., TSLA AND earnings, AAPL OR MSFT)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>

        {/* Saved Searches Dropdown */}
        {savedSearches.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Saved:</span>
            <select
              value={selectedSavedSearch}
              onChange={(e) => handleLoadSearch(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select saved search...</option>
              {savedSearches.map(search => (
                <option key={search.id} value={search.id}>{search.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div>
              <label className="block text-sm mb-2">Date Range</label>
              <div className="flex gap-2 items-center">
                <DatePicker
                  selected={filters.dateFrom}
                  onChange={(date) => setFilters({ ...filters, dateFrom: date })}
                  placeholderText="From"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  dateFormat="yyyy-MM-dd"
                />
                <span className="text-sm">to</span>
                <DatePicker
                  selected={filters.dateTo}
                  onChange={(date) => setFilters({ ...filters, dateTo: date })}
                  placeholderText="To"
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  dateFormat="yyyy-MM-dd"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Market Cap</label>
              <div className="flex flex-wrap gap-2">
                {marketCapOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleFilter('marketCap', option)}
                    className={`px-3 py-1 text-sm rounded ${
                      filters.marketCap.includes(option)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Source</label>
              <div className="flex flex-wrap gap-2">
                {sourceOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleFilter('source', option)}
                    className={`px-3 py-1 text-sm rounded ${
                      filters.source.includes(option)
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg mb-4">Save Search Settings</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter a name for this search"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
        <div className="col-span-2">Time</div>
        <div className="col-span-2">Ticker</div>
        <div className="col-span-5">News Title</div>
        <div className="col-span-3">Source</div>
      </div>

      {/* News List */}
      <div className="flex-1 overflow-auto">
        {sortedDates.map(date => (
          <div key={date}>
            {/* Date Separator */}
            <div className="sticky top-0 bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium z-10">
              {new Date(date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            
            {/* News Items for this date */}
            {groupedNews.get(date)?.map(item => (
              <React.Fragment key={item.id}>
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">{item.time}</div>
                  <div className="col-span-2 flex gap-1 flex-wrap">
                    {item.ticker.map((ticker) => (
                      <button
                        key={ticker}
                        onClick={() => onTickerClick?.(ticker)}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        {ticker}
                      </button>
                    ))}
                  </div>
                  <div className="col-span-5 text-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedNewsId((prev) => (prev === item.id ? null : item.id))}
                      className="text-left hover:underline"
                      title="Click to expand/collapse body"
                    >
                      {item.title}
                    </button>
                  </div>
                  <div className="col-span-3 text-sm text-gray-600 dark:text-gray-400">
                    <div>{item.source}</div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-1 text-xs underline break-all"
                        title={item.url}
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                </div>

                {expandedNewsId === item.id && item.content && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="text-sm whitespace-pre-wrap break-words">{item.content}</div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        ))}
        
        {filteredNews.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-500">
            No news items found
          </div>
        )}
      </div>
    </div>
  );
}
