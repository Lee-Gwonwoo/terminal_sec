import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar as CalendarIcon,
  Settings2,
  X,
  GripVertical
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import { mockCalendarData } from '../mockData';
import { CalendarEvent } from '../types';
import { getCompanyTickerDataAttrs } from '../companyDescription';

interface CalendarWindowProps {
  onTickerClick?: (ticker: string) => void;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField = keyof CalendarEvent | null;
type CalendarType = 'earnings' | 'conference' | 'dividend' | 'analyst_rating';

interface ColumnConfig {
  key: keyof CalendarEvent;
  label: string;
  visible: boolean;
  width: string;
}

// Define columns for each calendar type
// NOTE: 'date' = Date Announcement (회사가 실제로 earnings 발표를 하는 날짜)
// NOTE: 'time' = Time of Announcement (회사가 earnings 발표를 하는 시각)
// NOTE: 'session' = Market Session (pre-market: 장전, market-hours: 정규장, after-market: 장후)
const earningsColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date Announcement', visible: true, width: '130px' },
  { key: 'time', label: 'Time', visible: true, width: '80px' },
  { key: 'ticker', label: 'Symbol', visible: true, width: '80px' },
  { key: 'name', label: 'Name', visible: false, width: '150px' },  // Hidden by default
  { key: 'event', label: 'Event', visible: false, width: '200px' },  // Hidden by default
  { key: 'session', label: 'Session', visible: true, width: '110px' },
  { key: 'period', label: 'Period', visible: true, width: '80px' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: '90px' },
  { key: 'eps', label: 'EPS', visible: true, width: '80px' },
  { key: 'estimatedEps', label: 'Est. EPS', visible: true, width: '90px' },
  { key: 'surprisePercent', label: 'Surprise %', visible: true, width: '100px' },
  { key: 'revenue', label: 'Revenue', visible: true, width: '110px' },
  { key: 'estimatedRevenue', label: 'Est. Revenue', visible: true, width: '120px' },
];

const conferenceColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date Announcement', visible: true, width: '130px' },
  { key: 'time', label: 'Time', visible: true, width: '80px' },
  { key: 'ticker', label: 'Symbol', visible: true, width: '80px' },
  { key: 'name', label: 'Name', visible: false, width: '150px' },  // Hidden by default
  { key: 'event', label: 'Event', visible: false, width: '250px' },  // Hidden by default
  { key: 'session', label: 'Session', visible: true, width: '110px' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: '90px' },
];

const dividendColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date Announcement', visible: true, width: '130px' },
  { key: 'time', label: 'Time', visible: true, width: '80px' },
  { key: 'ticker', label: 'Symbol', visible: true, width: '80px' },
  { key: 'name', label: 'Name', visible: false, width: '150px' },  // Hidden by default
  { key: 'event', label: 'Event', visible: false, width: '250px' },  // Hidden by default
  { key: 'session', label: 'Session', visible: true, width: '110px' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: '90px' },
];

const analystRatingColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date Announcement', visible: true, width: '130px' },
  { key: 'time', label: 'Time', visible: true, width: '80px' },
  { key: 'ticker', label: 'Symbol', visible: true, width: '80px' },
  { key: 'name', label: 'Name', visible: false, width: '150px' },  // Hidden by default
  { key: 'event', label: 'Event', visible: false, width: '180px' },  // Hidden by default
  { key: 'analystFirm', label: 'Analyst Firm', visible: true, width: '130px' },
  { key: 'analystName', label: 'Analyst Name', visible: true, width: '130px' },
  { key: 'action', label: 'Action', visible: true, width: '110px' },
  { key: 'priorRating', label: 'Prior Rating', visible: true, width: '110px' },
  { key: 'rating', label: 'Rating', visible: true, width: '100px' },
  { key: 'priorPriceTarget', label: 'Prior PT', visible: true, width: '100px' },
  { key: 'priceTarget', label: 'Price Target', visible: true, width: '110px' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: '90px' },
];

export function CalendarWindow({ onTickerClick }: CalendarWindowProps) {
  const [events] = useState<CalendarEvent[]>(mockCalendarData);
  const [activeTab, setActiveTab] = useState<CalendarType>('earnings');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Separate column states for each tab
  const [earningsColumnState, setEarningsColumnState] = useState<ColumnConfig[]>(earningsColumns);
  const [conferenceColumnState, setConferenceColumnState] = useState<ColumnConfig[]>(conferenceColumns);
  const [dividendColumnState, setDividendColumnState] = useState<ColumnConfig[]>(dividendColumns);
  const [analystRatingColumnState, setAnalystRatingColumnState] = useState<ColumnConfig[]>(analystRatingColumns);
  
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  // Filter states per tab
  const [sessionFilter, setSessionFilter] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [confirmedFilter, setConfirmedFilter] = useState<boolean | null>(null);

  // Column drag and resize states
  const [draggedColumn, setDraggedColumn] = useState<keyof CalendarEvent | null>(null);
  const [resizingColumn, setResizingColumn] = useState<keyof CalendarEvent | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'earnings': return earningsColumnState;
      case 'conference': return conferenceColumnState;
      case 'dividend': return dividendColumnState;
      case 'analyst_rating': return analystRatingColumnState;
    }
  };

  const setCurrentColumns = (columns: ColumnConfig[]) => {
    switch (activeTab) {
      case 'earnings': setEarningsColumnState(columns); break;
      case 'conference': setConferenceColumnState(columns); break;
      case 'dividend': setDividendColumnState(columns); break;
      case 'analyst_rating': setAnalystRatingColumnState(columns); break;
    }
  };

  const handleSort = (field: keyof CalendarEvent) => {
    if (sortField === field) {
      setSortDirection(prev => 
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumn = (key: keyof CalendarEvent) => {
    const currentColumns = getCurrentColumns();
    const updatedColumns = currentColumns.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setCurrentColumns(updatedColumns);
  };

  // Column drag handlers
  const handleColumnDragStart = (e: React.DragEvent, columnKey: keyof CalendarEvent) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: keyof CalendarEvent) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      return;
    }

    const currentColumns = getCurrentColumns();
    const draggedIndex = currentColumns.findIndex(col => col.key === draggedColumn);
    const targetIndex = currentColumns.findIndex(col => col.key === targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null);
      return;
    }

    const newColumns = [...currentColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setCurrentColumns(newColumns);
    setDraggedColumn(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: keyof CalendarEvent, currentWidth: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(parseInt(currentWidth));
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;

    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(60, resizeStartWidth + diff);

    const currentColumns = getCurrentColumns();
    const updatedColumns = currentColumns.map(col => 
      col.key === resizingColumn ? { ...col, width: `${newWidth}px` } : col
    );
    setCurrentColumns(updatedColumns);
  };

  const handleResizeEnd = () => {
    setResizingColumn(null);
  };

  // Add resize event listeners
  React.useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  // Filter events by active tab type
  const tabFilteredEvents = useMemo(() => {
    return events.filter(event => event.type === activeTab);
  }, [events, activeTab]);

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...tabFilteredEvents];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.ticker.toLowerCase().includes(query) ||
        event.name.toLowerCase().includes(query) ||
        event.event.toLowerCase().includes(query) ||
        (event.analystFirm?.toLowerCase().includes(query)) ||
        (event.analystName?.toLowerCase().includes(query))
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(event => 
        new Date(event.date) >= dateFrom
      );
    }
    if (dateTo) {
      filtered = filtered.filter(event => 
        new Date(event.date) <= dateTo
      );
    }

    // Session filter
    if (sessionFilter.length > 0) {
      filtered = filtered.filter(event => 
        event.session && sessionFilter.includes(event.session)
      );
    }

    // Period filter (for earnings)
    if (periodFilter.length > 0) {
      filtered = filtered.filter(event => 
        event.period && periodFilter.includes(event.period)
      );
    }

    // Action filter (for analyst ratings)
    if (actionFilter.length > 0) {
      filtered = filtered.filter(event => 
        event.action && actionFilter.includes(event.action)
      );
    }

    // Confirmed filter
    if (confirmedFilter !== null) {
      filtered = filtered.filter(event => event.confirmed === confirmedFilter);
    }

    // Sorting
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [tabFilteredEvents, searchQuery, dateFrom, dateTo, sessionFilter, periodFilter, actionFilter, confirmedFilter, sortField, sortDirection]);

  const formatValue = (value: any, key: keyof CalendarEvent): string => {
    if (value === undefined || value === null) return '-';
    
    switch (key) {
      case 'date':
        return new Date(value).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      case 'confirmed':
        return value ? '✓' : '○';
      case 'priceTarget':
      case 'priorPriceTarget':
        return `$${value.toLocaleString()}`;
      case 'revenue':
      case 'estimatedRevenue':
        return `$${(value / 1000000).toFixed(1)}M`;
      case 'eps':
      case 'estimatedEps':
        return value.toFixed(2);
      case 'surprisePercent':
        return `${value.toFixed(2)}%`;
      case 'session':
        return value.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      default:
        return String(value);
    }
  };

  const currentColumns = getCurrentColumns();
  const visibleColumns = currentColumns.filter(col => col.visible);

  const allSessions = Array.from(new Set(tabFilteredEvents.map(e => e.session).filter(Boolean)));
  const allPeriods = Array.from(new Set(tabFilteredEvents.map(e => e.period).filter(Boolean)));
  const allActions = Array.from(new Set(tabFilteredEvents.map(e => e.action).filter(Boolean)));

  const hasActiveFilters = sessionFilter.length > 0 || periodFilter.length > 0 || 
                          actionFilter.length > 0 || confirmedFilter !== null || 
                          dateFrom !== null || dateTo !== null;

  const clearAllFilters = () => {
    setSessionFilter([]);
    setPeriodFilter([]);
    setActionFilter([]);
    setConfirmedFilter(null);
    setDateFrom(null);
    setDateTo(null);
    setSearchQuery('');
  };

  const getActionColor = (action?: string) => {
    switch (action) {
      case 'Buy':
      case 'Outperform':
      case 'Overweight':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'Sell':
      case 'Underperform':
        return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
      case 'Hold':
      case 'Neutral':
      case 'Market Perform':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const tabLabels: Record<CalendarType, string> = {
    earnings: 'Earnings',
    conference: 'Conference',
    dividend: 'Dividend',
    analyst_rating: 'Analyst Rating'
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium flex items-center gap-2 mb-3">
          <CalendarIcon className="w-4 h-4" />
          Events Calendar
        </h3>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3">
          {(['earnings', 'conference', 'dividend', 'analyst_rating'] as CalendarType[]).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                // Reset filters when switching tabs
                clearAllFilters();
                setSortField('date');
                setSortDirection('asc');
              }}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Search and Controls Row */}
        <div className="flex items-center gap-2 mb-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol, name, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <DatePicker
              selected={dateFrom}
              onChange={setDateFrom}
              placeholderText="From Date"
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
            <span className="text-sm text-gray-500">to</span>
            <DatePicker
              selected={dateTo}
              onChange={setDateTo}
              placeholderText="To Date"
              className="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
          </div>

          {/* Column Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColumnMenu(!showColumnMenu);
                setShowFilterMenu(false);
              }}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Settings2 className="w-4 h-4" />
              Columns
            </button>
            
            {showColumnMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowColumnMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-56 max-h-96 overflow-auto">
                  <div className="p-2 space-y-1">
                    {currentColumns.map(col => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded"
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        {/* Quick Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Session Filter */}
          {allSessions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowFilterMenu(showFilterMenu === 'session' ? false : 'session');
                }}
                className={`flex items-center gap-1 px-3 py-1 text-xs border rounded ${
                  sessionFilter.length > 0 
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                }`}
              >
                Session {sessionFilter.length > 0 && `(${sessionFilter.length})`}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showFilterMenu === 'session' && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-48 p-2">
                    {allSessions.map(session => (
                      <label key={session} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sessionFilter.includes(session)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSessionFilter([...sessionFilter, session]);
                            } else {
                              setSessionFilter(sessionFilter.filter(s => s !== session));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{session.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Period Filter - Only for Earnings */}
          {activeTab === 'earnings' && allPeriods.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowFilterMenu(showFilterMenu === 'period' ? false : 'period');
                }}
                className={`flex items-center gap-1 px-3 py-1 text-xs border rounded ${
                  periodFilter.length > 0 
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                }`}
              >
                Period {periodFilter.length > 0 && `(${periodFilter.length})`}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showFilterMenu === 'period' && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-40 p-2">
                    {allPeriods.map(period => (
                      <label key={period} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={periodFilter.includes(period)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPeriodFilter([...periodFilter, period]);
                            } else {
                              setPeriodFilter(periodFilter.filter(p => p !== period));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{period}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Filter - Only for Analyst Rating */}
          {activeTab === 'analyst_rating' && allActions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowFilterMenu(showFilterMenu === 'action' ? false : 'action');
                }}
                className={`flex items-center gap-1 px-3 py-1 text-xs border rounded ${
                  actionFilter.length > 0 
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                }`}
              >
                Action {actionFilter.length > 0 && `(${actionFilter.length})`}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showFilterMenu === 'action' && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-48 p-2 max-h-64 overflow-auto">
                    {allActions.map(action => (
                      <label key={action} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={actionFilter.includes(action)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setActionFilter([...actionFilter, action]);
                            } else {
                              setActionFilter(actionFilter.filter(a => a !== action));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{action}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Confirmed Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFilterMenu(showFilterMenu === 'confirmed' ? false : 'confirmed');
              }}
              className={`flex items-center gap-1 px-3 py-1 text-xs border rounded ${
                confirmedFilter !== null 
                  ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
              }`}
            >
              Confirmed
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showFilterMenu === 'confirmed' && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 w-40 p-2">
                  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="radio"
                      checked={confirmedFilter === null}
                      onChange={() => setConfirmedFilter(null)}
                    />
                    <span className="text-sm">All</span>
                  </label>
                  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="radio"
                      checked={confirmedFilter === true}
                      onChange={() => setConfirmedFilter(true)}
                    />
                    <span className="text-sm">Confirmed</span>
                  </label>
                  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="radio"
                      checked={confirmedFilter === false}
                      onChange={() => setConfirmedFilter(false)}
                    />
                    <span className="text-sm">Unconfirmed</span>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
            <tr>
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, position: 'relative' }}
                  className={`px-3 py-2 text-left text-xs font-medium border-b border-gray-300 dark:border-gray-700 ${
                    draggedColumn === col.key ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleColumnDragStart(e, col.key)}
                  onDragOver={handleColumnDragOver}
                  onDrop={(e) => handleColumnDrop(e, col.key)}
                  onDragEnd={handleColumnDragEnd}
                >
                  <div className="flex items-center gap-1 justify-between">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                      <button
                        onClick={() => handleSort(col.key)}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {col.label}
                      </button>
                      {sortField === col.key && (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      )}
                    </div>
                    
                    {/* Resize Handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                      onMouseDown={(e) => handleResizeStart(e, col.key, col.width)}
                    >
                      <div className="w-full h-full group-hover:bg-blue-500" />
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEvents.map(event => (
              <tr
                key={event.id}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {visibleColumns.map(col => {
                  const value = event[col.key];
                  
                  // Special rendering for certain columns
                  if (col.key === 'ticker') {
                    return (
                      <td key={col.key} className="px-3 py-2 text-sm">
                        <button
                          onClick={() => onTickerClick?.(value as string)}
                          {...getCompanyTickerDataAttrs(value as string)}
                          className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 font-medium"
                        >
                          {value as string}
                        </button>
                      </td>
                    );
                  }
                  
                  if (col.key === 'action') {
                    return (
                      <td key={col.key} className="px-3 py-2 text-sm">
                        {value && (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${getActionColor(value as string)}`}>
                            {value as string}
                          </span>
                        )}
                        {!value && '-'}
                      </td>
                    );
                  }
                  
                  if (col.key === 'confirmed') {
                    return (
                      <td key={col.key} className="px-3 py-2 text-sm text-center">
                        <span className={value ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-400'}>
                          {formatValue(value, col.key)}
                        </span>
                      </td>
                    );
                  }

                  if (col.key === 'surprisePercent' && value !== undefined && value !== null) {
                    const num = value as number;
                    return (
                      <td key={col.key} className="px-3 py-2 text-sm">
                        <span className={num > 0 ? 'text-green-600 dark:text-green-400 font-medium' : num < 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          {formatValue(value, col.key)}
                        </span>
                      </td>
                    );
                  }
                  
                  return (
                    <td key={col.key} className="px-3 py-2 text-sm">
                      {formatValue(value, col.key)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredAndSortedEvents.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-500">
            No events found
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        Showing {filteredAndSortedEvents.length} of {tabFilteredEvents.length} events
      </div>
    </div>
  );
}