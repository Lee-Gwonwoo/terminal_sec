import { NewsItem, WatchlistItem, CalendarEvent } from './types';

// Mock watchlist data
export const mockWatchlistData: WatchlistItem[] = [
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 245.67, change: 5.32, changePercent: 2.21 },
  { ticker: 'AAPL', name: 'Apple Inc.', price: 182.45, change: -1.23, changePercent: -0.67 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 142.89, change: 3.15, changePercent: 2.25 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 398.12, change: 2.45, changePercent: 0.62 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 521.34, change: 12.67, changePercent: 2.49 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: -2.34, changePercent: -1.29 },
  { ticker: 'META', name: 'Meta Platforms', price: 456.78, change: 8.90, changePercent: 1.99 },
];

// Mock calendar data
export const mockCalendarData: CalendarEvent[] = [
  {
    id: '1',
    date: '2026-02-25',
    time: '16:00',
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    event: 'Q4 Earnings Call',
    type: 'earnings',
    session: 'after-market',
    period: 'Q4',
    confirmed: true,
    eps: 0.85,
    estimatedEps: 0.78,
    surprisePercent: 8.97,
    revenue: 25400000,
    estimatedRevenue: 24800000
  },
  {
    id: '2',
    date: '2026-02-26',
    time: '13:30',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    event: 'Product Launch Event',
    type: 'conference',
    session: 'market-hours',
    confirmed: true
  },
  {
    id: '3',
    date: '2026-02-27',
    time: '09:00',
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    event: 'Quarterly Earnings Report',
    type: 'earnings',
    session: 'pre-market',
    period: 'Q4',
    confirmed: true,
    eps: 1.65,
    estimatedEps: 1.58,
    surprisePercent: 4.43,
    revenue: 86300000,
    estimatedRevenue: 85100000
  },
  {
    id: '4',
    date: '2026-02-28',
    time: '10:00',
    ticker: 'MSFT',
    name: 'Microsoft Corp.',
    event: 'Dividend Payment',
    type: 'dividend',
    session: 'market-hours',
    confirmed: true
  },
  {
    id: '5',
    date: '2026-03-01',
    time: '14:00',
    ticker: 'NVDA',
    name: 'NVIDIA Corp.',
    event: 'AI Conference Keynote',
    type: 'conference',
    session: 'market-hours',
    confirmed: true
  },
  {
    id: '6',
    date: '2026-02-25',
    time: '08:30',
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    event: 'Quarterly Earnings',
    type: 'earnings',
    session: 'pre-market',
    period: 'Q4',
    confirmed: true,
    eps: 1.15,
    estimatedEps: 1.08,
    surprisePercent: 6.48,
    revenue: 170000000,
    estimatedRevenue: 168500000
  },
  {
    id: '7',
    date: '2026-02-26',
    time: '07:00',
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    event: 'Upgraded to Buy',
    type: 'analyst_rating',
    session: 'pre-market',
    confirmed: true,
    analystFirm: 'Goldman Sachs',
    analystName: 'Sarah Johnson',
    action: 'Buy',
    priorRating: 'Hold',
    rating: 'Buy',
    priorPriceTarget: 480,
    priceTarget: 520
  },
  {
    id: '8',
    date: '2026-02-27',
    time: '10:30',
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    event: 'Maintains Buy Rating',
    type: 'analyst_rating',
    session: 'market-hours',
    confirmed: true,
    analystFirm: 'Morgan Stanley',
    analystName: 'Adam Jonas',
    action: 'Buy',
    priorRating: 'Buy',
    rating: 'Buy',
    priorPriceTarget: 310,
    priceTarget: 350
  },
  {
    id: '9',
    date: '2026-02-28',
    time: '16:30',
    ticker: 'NFLX',
    name: 'Netflix Inc.',
    event: 'Q4 Earnings Report',
    type: 'earnings',
    session: 'after-market',
    period: 'Q4',
    confirmed: true,
    eps: 2.22,
    estimatedEps: 2.15,
    surprisePercent: 3.26,
    revenue: 8900000,
    estimatedRevenue: 8750000
  },
  {
    id: '10',
    date: '2026-03-02',
    time: '11:15',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    event: 'Reiterates Outperform',
    type: 'analyst_rating',
    session: 'market-hours',
    confirmed: true,
    analystFirm: 'JPMorgan',
    analystName: 'Michael Chen',
    action: 'Outperform',
    priorRating: 'Outperform',
    rating: 'Outperform',
    priorPriceTarget: 200,
    priceTarget: 215
  },
  {
    id: '11',
    date: '2026-02-25',
    time: '12:00',
    ticker: 'AMD',
    name: 'Advanced Micro Devices',
    event: 'Downgraded to Hold',
    type: 'analyst_rating',
    session: 'market-hours',
    confirmed: true,
    analystFirm: 'UBS',
    analystName: 'Timothy Arcuri',
    action: 'Hold',
    priorRating: 'Buy',
    rating: 'Hold',
    priorPriceTarget: 180,
    priceTarget: 165
  },
  {
    id: '12',
    date: '2026-03-03',
    time: '08:00',
    ticker: 'COIN',
    name: 'Coinbase Global',
    event: 'Q4 Earnings',
    type: 'earnings',
    session: 'pre-market',
    period: 'Q4',
    confirmed: false,
    eps: 1.82,
    estimatedEps: 1.60,
    surprisePercent: 13.75
  },
];

// Helper function to filter news by search query
export function filterNewsByQuery(news: NewsItem[], query: string): NewsItem[] {
  if (!query.trim()) return news;

  const searchTerms = query.toLowerCase();
  
  // Simple boolean search implementation
  const andTerms = searchTerms.split(' and ').map(term => term.trim());
  
  return news.filter(item => {
    const searchableText = `${item.ticker.join(' ')} ${item.title} ${item.source} ${item.content || ''}`.toLowerCase();
    
    if (andTerms.length > 1) {
      // AND logic
      return andTerms.every(term => {
        const orTerms = term.split(' or ').map(t => t.trim());
        return orTerms.some(orTerm => searchableText.includes(orTerm));
      });
    } else {
      // Check for OR logic
      const orTerms = searchTerms.split(' or ').map(t => t.trim());
      if (orTerms.length > 1) {
        return orTerms.some(orTerm => searchableText.includes(orTerm));
      }
      // Simple search
      return searchableText.includes(searchTerms);
    }
  });
}

// Helper function to group news by date
export function groupNewsByDate(news: NewsItem[]): Map<string, NewsItem[]> {
  const grouped = new Map<string, NewsItem[]>();
  
  news.forEach(item => {
    const existing = grouped.get(item.date) || [];
    grouped.set(item.date, [...existing, item]);
  });
  
  return grouped;
}