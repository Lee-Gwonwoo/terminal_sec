import type { NewsItem, NewsQuery } from "../types.js";

export function matchesNewsFilters(item: NewsItem, filters: NewsQuery): boolean {
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    if (
      !item.title.toLowerCase().includes(keyword) &&
      !item.body.toLowerCase().includes(keyword)
    ) {
      return false;
    }
  }

  if (filters.tickers?.length) {
    const itemTickers = new Set(item.tickers.map((ticker) => ticker.toUpperCase()));
    if (!filters.tickers.some((ticker) => itemTickers.has(ticker.toUpperCase()))) {
      return false;
    }
  }

  if (filters.sources?.length) {
    if (!filters.sources.includes(item.source_type)) {
      return false;
    }
  }

  if (filters.tags?.length) {
    const itemTags = new Set(item.tags.map((tag) => tag.toLowerCase()));
    if (!filters.tags.some((tag) => itemTags.has(tag.toLowerCase()))) {
      return false;
    }
  }

  if (filters.from && new Date(item.published_at) < new Date(filters.from)) {
    return false;
  }

  if (filters.to && new Date(item.published_at) > new Date(filters.to)) {
    return false;
  }

  return true;
}
