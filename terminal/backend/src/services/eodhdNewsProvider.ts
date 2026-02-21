import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EodhdNewsFetchParams = {
  symbol?: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  limit?: number;
  offset?: number;
};

export type EodhdMappedNewsItem = {
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  body: string;
  url: string;
  providerTickers: string[];
  tags: string[];
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeSymbol(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") {
    return trimmed;
  }
  if (trimmed.includes(".")) {
    return trimmed;
  }
  return `${trimmed}.US`;
}

function tryParseDateToIso(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function resolveRepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(current, "EODHD", "API TOKEN");
    if (fs.existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return startDir;
}

export function readEodhdApiToken(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolveRepoRoot(here);
  const tokenPath = path.join(repoRoot, "EODHD", "API TOKEN");

  if (!fs.existsSync(tokenPath)) {
    throw new Error(`EODHD token file not found at ${tokenPath}`);
  }

  const token = fs.readFileSync(tokenPath, "utf8").trim();
  if (!token) {
    throw new Error("EODHD token file is empty");
  }
  return token;
}

export async function pullEodhdNews(params: EodhdNewsFetchParams): Promise<EodhdMappedNewsItem[]> {
  const symbol = typeof params.symbol === "string" ? normalizeSymbol(params.symbol) : "";
  if (!isIsoDate(params.from) || !isIsoDate(params.to)) {
    throw new Error("from/to must be YYYY-MM-DD");
  }

  const token = readEodhdApiToken();

  const url = new URL("https://eodhd.com/api/news");
  url.searchParams.set("api_token", token);
  if (symbol) {
    url.searchParams.set("s", symbol);
  }
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  url.searchParams.set("fmt", "json");
  if (params.limit) {
    url.searchParams.set("limit", String(Math.min(Math.max(params.limit, 1), 200)));
  }
  if (typeof params.offset === "number" && Number.isFinite(params.offset) && params.offset >= 0) {
    url.searchParams.set("offset", String(Math.floor(params.offset)));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`EODHD news request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
  }

  const raw = (await response.json()) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("Unexpected EODHD news response shape (expected array)");
  }

  const mapped: EodhdMappedNewsItem[] = [];
  for (const item of raw) {
    const anyItem = item as any;

    const publishedAt =
      tryParseDateToIso(anyItem?.date) ??
      tryParseDateToIso(anyItem?.published_at) ??
      tryParseDateToIso(anyItem?.publishedAt) ??
      tryParseDateToIso(anyItem?.datetime);
    if (!publishedAt) {
      continue;
    }

    const title = typeof anyItem?.title === "string" ? anyItem.title : "";
    const body =
      typeof anyItem?.content === "string"
        ? anyItem.content
        : typeof anyItem?.text === "string"
          ? anyItem.text
          : typeof anyItem?.body === "string"
            ? anyItem.body
            : "";

    const urlStr =
      typeof anyItem?.link === "string"
        ? anyItem.link
        : typeof anyItem?.url === "string"
          ? anyItem.url
          : "";

    const source = typeof anyItem?.source === "string" && anyItem.source.trim() !== "" ? anyItem.source : "EODHD";
    const sourceType =
      typeof anyItem?.source_type === "string" && anyItem.source_type.trim() !== ""
        ? anyItem.source_type
        : typeof anyItem?.type === "string" && anyItem.type.trim() !== ""
          ? anyItem.type
          : "news";

    const symbols: string[] = Array.isArray(anyItem?.symbols)
      ? anyItem.symbols.filter((v: unknown) => typeof v === "string")
      : Array.isArray(anyItem?.tickers)
        ? anyItem.tickers.filter((v: unknown) => typeof v === "string")
        : [];

    const providerTickers = symbols.map((s) => s.replace(/\.\w+$/, "").toUpperCase());
    const tags: string[] = Array.isArray(anyItem?.tags)
      ? anyItem.tags.filter((v: unknown) => typeof v === "string").map((v: string) => v.toLowerCase())
      : [];

    mapped.push({
      publishedAt,
      source,
      sourceType,
      title: title || "(untitled)",
      body,
      url:
        urlStr ||
        (symbol
          ? `https://eodhd.com/api/news?s=${encodeURIComponent(symbol)}&from=${params.from}&to=${params.to}`
          : `https://eodhd.com/api/news?from=${params.from}&to=${params.to}`),
      providerTickers,
      tags
    });
  }

  return mapped;
}

export async function pullEodhdNewsAll(params: {
  symbol?: string;
  from: string;
  to: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<{ items: EodhdMappedNewsItem[]; truncated: boolean }> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 200, 1), 200);
  const maxPages = Math.min(Math.max(params.maxPages ?? 100, 1), 200);

  const items: EodhdMappedNewsItem[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const pageItems = await pullEodhdNews({
      symbol: params.symbol,
      from: params.from,
      to: params.to,
      limit: pageSize,
      offset
    });

    if (pageItems.length === 0) {
      break;
    }

    let newCount = 0;
    for (const item of pageItems) {
      const key = item.url || `${item.publishedAt}|${item.title}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(item);
      newCount += 1;
    }

    // If offset is not supported by the upstream API, we can get the same page repeatedly.
    // Bail out rather than looping and pretend we fetched all.
    if (newCount === 0) {
      truncated = true;
      break;
    }

    if (pageItems.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  if (offset > 0 && items.length >= pageSize && items.length % pageSize === 0) {
    // Heuristic: if we hit exact page boundaries and stopped by maxPages, mark as truncated.
    if (items.length >= pageSize * maxPages) {
      truncated = true;
    }
  }

  return { items, truncated };
}
