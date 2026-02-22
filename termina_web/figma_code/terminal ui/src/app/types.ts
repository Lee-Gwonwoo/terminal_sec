// Types for the stock news platform

export type WindowType = 'news' | 'watchlist' | 'calendar';

export interface NewsItem {
  id: string;
  publishedAt?: string;
  time: string;
  ticker: string[];
  title: string;
  source: string;
  url?: string;
  date: string;
  content?: string;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  ticker: string;
  name: string;
  event: string;
  type: 'earnings' | 'dividend' | 'conference' | 'ipo' | 'analyst_rating';
  session?: 'pre-market' | 'market-hours' | 'after-market';
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Annual';
  confirmed?: boolean;
  analystFirm?: string;
  analystName?: string;
  action?: 'Buy' | 'Sell' | 'Hold' | 'Outperform' | 'Underperform' | 'Neutral' | 'Market Perform' | 'Overweight';
  priorRating?: string;
  rating?: string;
  priorPriceTarget?: number;
  priceTarget?: number;
  eps?: number;
  estimatedEps?: number;
  surprisePercent?: number;
  revenue?: number;
  estimatedRevenue?: number;
}

export interface NewsFilter {
  dateFrom: Date | null;
  dateTo: Date | null;
  marketCap: string[];
  source: string[];
  sector: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  searchQuery: string;
  filters: NewsFilter;
}

export interface WindowInstance {
  id: string;
  type: WindowType;
  title: string;
  linkId?: number; // For linking windows together
  position?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface TabData {
  id: string;
  name: string;
  windows: WindowInstance[];
}