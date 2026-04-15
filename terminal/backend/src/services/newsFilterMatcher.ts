import type { NewsItem, NewsQuery } from "../types.js";

function matchesNumericRange(value: number | null | undefined, min?: number, max?: number): boolean {
  if (min == null && max == null) {
    return true;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  if (min != null && value < min) {
    return false;
  }
  if (max != null && value > max) {
    return false;
  }
  return true;
}

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

  if (filters.to) {
    const toEnd = new Date(filters.to);
    toEnd.setUTCHours(23, 59, 59, 999);
    if (new Date(item.published_at) > toEnd) {
      return false;
    }
  }

  if (!matchesNumericRange(item.floatPct, filters.floatPctMin, filters.floatPctMax)) {
    return false;
  }

  if (!matchesNumericRange(item.institutionalPct, filters.institutionalPctMin, filters.institutionalPctMax)) {
    return false;
  }

  if (!matchesNumericRange(item.insiderPct, filters.insiderPctMin, filters.insiderPctMax)) {
    return false;
  }

  return true;
}
