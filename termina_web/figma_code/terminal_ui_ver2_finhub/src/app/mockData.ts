import { NewsItem, WatchlistItem, CalendarEvent } from './types';

// Mock news data
export const mockNewsData: NewsItem[] = [
  {
    id: '1',
    publishedAt: '2026-02-20T09:15:00.000Z',
    time: '09:15',
    ticker: ['TSLA'],
    title: 'Tesla Reports Record Q4 Earnings, Beats Analyst Expectations',
    source: 'Bloomberg',
    date: '2026-02-20',
    content: 'Tesla announced record quarterly earnings...'
  },
  {
    id: '2',
    publishedAt: '2026-02-20T10:30:00.000Z',
    time: '10:30',
    ticker: ['AAPL'],
    title: 'Apple Announces New AI Features for iOS 19',
    source: 'Reuters',
    date: '2026-02-20',
    content: 'Apple unveiled groundbreaking AI capabilities...'
  },
  {
    id: '3',
    publishedAt: '2026-02-20T11:45:00.000Z',
    time: '11:45',
    ticker: ['TSLA', 'F'],
    title: 'EV Market Competition Heats Up as Ford Challenges Tesla',
    source: 'CNBC',
    date: '2026-02-20',
    content: 'The electric vehicle market sees intensified competition...'
  },
  {
    id: '4',
    publishedAt: '2026-02-20T14:20:00.000Z',
    time: '14:20',
    ticker: ['GOOGL'],
    title: 'Google Cloud Revenue Surges 40% Year-Over-Year',
    source: 'MarketWatch',
    date: '2026-02-20',
    content: 'Google parent Alphabet reported strong cloud growth...'
  },
  {
    id: '5',
    publishedAt: '2026-02-20T15:30:00.000Z',
    time: '15:30',
    ticker: ['MSFT'],
    title: 'Microsoft Expands AI Partnership with OpenAI',
    source: 'WSJ',
    date: '2026-02-20',
    content: 'Microsoft deepens its commitment to AI development...'
  },
  {
    id: '6',
    publishedAt: '2026-02-19T08:00:00.000Z',
    time: '08:00',
    ticker: ['NVDA'],
    title: 'NVIDIA Unveils Next-Gen AI Chips for Data Centers',
    source: 'Bloomberg',
    date: '2026-02-19',
    content: 'NVIDIA announced its latest GPU architecture...'
  },
  {
    id: '7',
    publishedAt: '2026-02-19T09:30:00.000Z',
    time: '09:30',
    ticker: ['AMZN'],
    title: 'Amazon Prime Membership Reaches 250 Million Globally',
    source: 'Reuters',
    date: '2026-02-19',
    content: 'Amazon announced a major milestone in subscriber growth...'
  },
  {
    id: '8',
    publishedAt: '2026-02-19T12:15:00.000Z',
    time: '12:15',
    ticker: ['TSLA'],
    title: 'Tesla Stock Rises on Strong Delivery Numbers',
    source: 'CNBC',
    date: '2026-02-19',
    content: 'Tesla shares climbed after reporting better-than-expected deliveries...'
  },
  {
    id: '9',
    publishedAt: '2026-02-19T13:45:00.000Z',
    time: '13:45',
    ticker: ['META'],
    title: 'Meta Platforms Shows Strong User Growth in Q4',
    source: 'MarketWatch',
    date: '2026-02-19',
    content: 'Meta reported increased daily active users across platforms...'
  },
  {
    id: '10',
    publishedAt: '2026-02-19T16:00:00.000Z',
    time: '16:00',
    ticker: ['AAPL', 'MSFT'],
    title: 'Tech Giants Lead Market Rally as Sentiment Improves',
    source: 'WSJ',
    date: '2026-02-19',
    content: 'Major technology stocks pushed indices higher...'
  },
  {
    id: '11',
    publishedAt: '2026-02-18T10:00:00.000Z',
    time: '10:00',
    ticker: ['TSLA'],
    title: 'Tesla Gigafactory Expansion Plans Announced',
    source: 'Bloomberg',
    date: '2026-02-18',
    content: 'Tesla revealed plans to expand production capacity...'
  },
  {
    id: '12',
    publishedAt: '2026-02-18T14:30:00.000Z',
    time: '14:30',
    ticker: ['GOOGL', 'MSFT'],
    title: 'Cloud Computing Battle Intensifies Between Tech Giants',
    source: 'Reuters',
    date: '2026-02-18',
    content: 'Competition in cloud services reaches new heights...'
  }
];

// Mock watchlist data
export const mockWatchlistData: WatchlistItem[] = [
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 245.67, change: 5.32, changePercent: 2.21, marketCap: '$780B', industry: 'Automotive' },
  { ticker: 'AAPL', name: 'Apple Inc.', price: 182.45, change: -1.23, changePercent: -0.67, marketCap: '$2.87T', industry: 'Technology' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 142.89, change: 3.15, changePercent: 2.25, marketCap: '$1.78T', industry: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 398.12, change: 2.45, changePercent: 0.62, marketCap: '$2.96T', industry: 'Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 521.34, change: 12.67, changePercent: 2.49, marketCap: '$1.28T', industry: 'Semiconductors' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: -2.34, changePercent: -1.29, marketCap: '$1.86T', industry: 'E-Commerce' },
  { ticker: 'META', name: 'Meta Platforms', price: 456.78, change: 8.90, changePercent: 1.99, marketCap: '$1.17T', industry: 'Social Media' },
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