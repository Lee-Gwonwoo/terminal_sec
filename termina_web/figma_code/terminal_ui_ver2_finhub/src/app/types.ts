// Types for the stock news platform

export type WindowType = 'news' | 'watchlist' | 'calendar' | 'finhub-news' | 'investing-news' | 'default-ticker' | 'daily-change-history' | 'data-control' | 'case-research' | 'evidence-table' | 'case-description' | 'data-control-how-to-use';

export interface CaseDescriptionWindowData {
  caseType: string;
  caseLabelKo: string;
  topLevel: string;
  description: string;
  classificationBasis: string;
  keywordSignals: string[];
  definition: string;
  valuePath: string;
  includeSignals: string[];
  excludeSignals: string[];
  boundaryCase: string;
  quickQuestions: string[];
}

export interface DataControlHowToUseWindowData {
  key: string;
  title: string;
  summary: string;
  purpose: string;
  whenToRun: string[];
  inputs: string[];
  cautions: string[];
  verify: string[];
  route?: string;
}

export type WindowData = CaseDescriptionWindowData | DataControlHowToUseWindowData;

export interface NewsItem {
  id: string;
  publishedAt: string; // ISO timestamp from backend
  time: string;
  ticker: string[];
  title: string;
  source: string;
  url?: string; // Article URL
  date: string;
  content?: string;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  industry?: string;
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

export interface BraveNewsItem {
  id: string;
  publishedAt: string;
  date: string;
  time: string;
  title: string;
  abstract?: string;
  ticker: string;
  source: string;
  url?: string;
  changePercent?: number;
  openChange?: number;
  sevenDaysChange?: number;
  fourteenDaysChange?: number;
  thirtyDaysChange?: number;
  nextEarningDate?: string;
}

export interface BraveNewsFilter {
  dateFrom: Date | null;
  dateTo: Date | null;
  marketCapMin: number | null;
  marketCapMax: number | null;
  industry: string[];
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
  data?: WindowData;
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