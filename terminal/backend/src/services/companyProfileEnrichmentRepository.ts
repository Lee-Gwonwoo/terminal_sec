import { getDb } from "../db.js";

export interface CompanyProfilePeerGroup {
  category: string;
  label: string;
  tickers?: string[];
  companies?: string[];
  note?: string;
  grade?: "A" | "B" | "C" | "EXCLUDE";
  relationType?:
    | "direct_competitor"
    | "adjacent_competitor"
    | "customer_supplier"
    | "infrastructure_read_through"
    | "platform_overlap"
    | "theme_overlap"
    | "weak_provider_candidate"
    | "excluded_self";
  direction?: "directed" | "bidirectional";
  score?: number;
  reason?: string;
}

export interface CompanyProfileEnrichmentInput {
  ticker: string;
  source?: string;
  version?: string;
  shortDescription?: string | null;
  enhancedDescription: string;
  products?: string[];
  revenueModel?: string[];
  keyMetrics?: string[];
  watchPoints?: string[];
  risks?: string[];
  peerGroups?: CompanyProfilePeerGroup[];
  tags?: string[];
  sourceUrls?: string[];
  sourceNote?: string | null;
  skipExistingDescription?: boolean;
}

export interface CompanyProfileEnrichmentRow {
  id: number;
  security_id: number;
  ticker: string;
  source: string;
  version: string;
  short_description: string | null;
  enhanced_description: string;
  products_json: string;
  revenue_model_json: string;
  key_metrics_json: string;
  watch_points_json: string;
  risks_json: string;
  peer_groups_json: string;
  tags_json: string;
  source_urls_json: string;
  source_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyProfileEnrichmentView {
  id: number;
  ticker: string;
  source: string;
  version: string;
  short_description: string | null;
  enhanced_description: string;
  products: string[];
  revenue_model: string[];
  key_metrics: string[];
  watch_points: string[];
  risks: string[];
  peer_groups: CompanyProfilePeerGroup[];
  tags: string[];
  source_urls: string[];
  source_note: string | null;
  updated_at: string;
}

export type CompanyProfileEnrichmentUpsertStatus = "inserted" | "updated" | "skipped_existing";

export async function getCompanyProfileEnrichmentByTicker(
  ticker: string,
): Promise<CompanyProfileEnrichmentView | undefined> {
  const row = await getDb().get<CompanyProfileEnrichmentRow>(
    `SELECT cpe.*
     FROM company_profile_enrichment cpe
     JOIN securities s ON s.id = cpe.security_id
     WHERE s.ticker = ?
     LIMIT 1`,
    [normalizeTicker(ticker)],
  );
  return row ? toView(row) : undefined;
}

export async function upsertCompanyProfileEnrichment(
  params: CompanyProfileEnrichmentInput,
): Promise<{ status: CompanyProfileEnrichmentUpsertStatus; row: CompanyProfileEnrichmentView }> {
  const db = getDb();
  const ticker = normalizeTicker(params.ticker);
  if (!ticker) {
    throw new Error("ticker is required");
  }

  const enhancedDescription = normalizeText(params.enhancedDescription);
  if (!enhancedDescription) {
    throw new Error(`enhancedDescription is required for ${ticker}`);
  }

  const security = await db.get<{ id: number }>(
    "SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1",
    [ticker],
  );
  if (!security) {
    throw new Error(`security not found for ticker ${ticker}`);
  }

  const existing = await db.get<CompanyProfileEnrichmentRow>(
    "SELECT * FROM company_profile_enrichment WHERE security_id = ?",
    [security.id],
  );
  const now = new Date().toISOString();
  const source = normalizeText(params.source) ?? "curated";
  const version = normalizeText(params.version) ?? "v1";
  const nextTags = normalizeStringArray(params.tags);
  const nextPeerGroups = normalizePeerGroups(params.peerGroups);

  if (existing && params.skipExistingDescription !== false && existing.enhanced_description.trim()) {
    const mergedTags = mergeStringArrays(parseStringJsonArray(existing.tags_json), nextTags);
    const mergedPeerGroups = mergePeerGroups(parsePeerGroupJsonArray(existing.peer_groups_json), nextPeerGroups);
    await db.run(
      `UPDATE company_profile_enrichment
       SET peer_groups_json = ?, tags_json = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(mergedPeerGroups), JSON.stringify(mergedTags), now, existing.id],
    );
    const row = await getCompanyProfileEnrichmentByTicker(ticker);
    if (!row) {
      throw new Error(`failed to reload enrichment for ${ticker}`);
    }
    return { status: "skipped_existing", row };
  }

  const rowParams = [
    security.id,
    ticker,
    source,
    version,
    normalizeText(params.shortDescription),
    enhancedDescription,
    JSON.stringify(normalizeStringArray(params.products)),
    JSON.stringify(normalizeStringArray(params.revenueModel)),
    JSON.stringify(normalizeStringArray(params.keyMetrics)),
    JSON.stringify(normalizeStringArray(params.watchPoints)),
    JSON.stringify(normalizeStringArray(params.risks)),
    JSON.stringify(nextPeerGroups),
    JSON.stringify(existing ? mergeStringArrays(parseStringJsonArray(existing.tags_json), nextTags) : nextTags),
    JSON.stringify(normalizeStringArray(params.sourceUrls)),
    normalizeText(params.sourceNote),
    now,
  ];

  if (existing) {
    await db.run(
      `UPDATE company_profile_enrichment SET
        ticker = ?, source = ?, version = ?, short_description = ?, enhanced_description = ?,
        products_json = ?, revenue_model_json = ?, key_metrics_json = ?, watch_points_json = ?,
        risks_json = ?, peer_groups_json = ?, tags_json = ?, source_urls_json = ?, source_note = ?,
        updated_at = ?
       WHERE id = ?`,
      rowParams.slice(1).concat(existing.id),
    );
    const row = await getCompanyProfileEnrichmentByTicker(ticker);
    if (!row) {
      throw new Error(`failed to reload enrichment for ${ticker}`);
    }
    return { status: "updated", row };
  }

  await db.run(
    `INSERT INTO company_profile_enrichment (
       security_id, ticker, source, version, short_description, enhanced_description,
       products_json, revenue_model_json, key_metrics_json, watch_points_json,
       risks_json, peer_groups_json, tags_json, source_urls_json, source_note, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rowParams,
  );
  const row = await getCompanyProfileEnrichmentByTicker(ticker);
  if (!row) {
    throw new Error(`failed to reload enrichment for ${ticker}`);
  }
  return { status: "inserted", row };
}

function normalizeTicker(ticker: string): string {
  return String(ticker ?? "").trim().toUpperCase();
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return mergeStringArrays([], values);
}

function mergeStringArrays(first: string[], second: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of [...first, ...second]) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}

function mergePeerGroups(first: CompanyProfilePeerGroup[], second: CompanyProfilePeerGroup[]): CompanyProfilePeerGroup[] {
  const byKey = new Map<string, CompanyProfilePeerGroup>();
  for (const group of [...first, ...second]) {
    const normalized = normalizePeerGroups([group])[0];
    if (!normalized) {
      continue;
    }
    const key = `${normalized.category.toLowerCase()}|${normalized.label.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, normalized);
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...normalized,
      tickers: mergeStringArrays(existing.tickers ?? [], normalized.tickers ?? []).map((ticker) => ticker.toUpperCase()),
      companies: mergeStringArrays(existing.companies ?? [], normalized.companies ?? []),
      note: normalized.note ?? existing.note,
      reason: normalized.reason ?? existing.reason,
      grade: normalized.grade ?? existing.grade,
      relationType: normalized.relationType ?? existing.relationType,
      direction: normalized.direction ?? existing.direction,
      score: normalized.score ?? existing.score,
    });
  }
  return Array.from(byKey.values());
}

function normalizePeerGroups(groups: CompanyProfilePeerGroup[] | undefined): CompanyProfilePeerGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups
    .map((group) => {
      const grade = normalizePeerGrade(group.grade);
      const relationType = normalizePeerRelationType(group.relationType);
      const direction = normalizePeerDirection(group.direction);
      const score = typeof group.score === "number" && Number.isFinite(group.score)
        ? Math.max(0, Math.min(1, Math.round(group.score * 1000) / 1000))
        : undefined;
      return {
        category: normalizeText(group.category) ?? "other",
        label: normalizeText(group.label) ?? normalizeText(group.category) ?? "Other",
        tickers: normalizeStringArray(group.tickers).map((ticker) => ticker.toUpperCase()),
        companies: normalizeStringArray(group.companies),
        note: normalizeText(group.note) ?? undefined,
        grade: grade ?? undefined,
        relationType: relationType ?? undefined,
        direction: direction ?? undefined,
        score,
        reason: normalizeText(group.reason) ?? undefined,
      };
    })
    .filter((group) => group.category && (group.tickers.length > 0 || group.companies.length > 0 || group.note));
}

function parseStringJsonArray(raw: string | null | undefined): string[] {
  const parsed = parseJsonArray(raw);
  return parsed.filter((item): item is string => typeof item === "string");
}

function parsePeerGroupJsonArray(raw: string | null | undefined): CompanyProfilePeerGroup[] {
  const parsed = parseJsonArray(raw);
  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const score = typeof item.score === "number" && Number.isFinite(item.score)
        ? item.score
        : undefined;
      return {
        category: normalizeText(item.category) ?? "other",
        label: normalizeText(item.label) ?? normalizeText(item.category) ?? "Other",
        tickers: Array.isArray(item.tickers)
          ? item.tickers.filter((ticker): ticker is string => typeof ticker === "string")
          : [],
        companies: Array.isArray(item.companies)
          ? item.companies.filter((company): company is string => typeof company === "string")
          : [],
        note: normalizeText(item.note) ?? undefined,
        grade: normalizePeerGrade(item.grade) ?? undefined,
        relationType: normalizePeerRelationType(item.relationType ?? item.relation_type) ?? undefined,
        direction: normalizePeerDirection(item.direction) ?? undefined,
        score,
        reason: normalizeText(item.reason) ?? undefined,
      };
    });
}

function normalizePeerGrade(value: unknown): CompanyProfilePeerGroup["grade"] | null {
  return value === "A" || value === "B" || value === "C" || value === "EXCLUDE" ? value : null;
}

function normalizePeerRelationType(value: unknown): CompanyProfilePeerGroup["relationType"] | null {
  const normalized = normalizeText(value);
  if (
    normalized === "direct_competitor"
    || normalized === "adjacent_competitor"
    || normalized === "customer_supplier"
    || normalized === "infrastructure_read_through"
    || normalized === "platform_overlap"
    || normalized === "theme_overlap"
    || normalized === "weak_provider_candidate"
    || normalized === "excluded_self"
  ) {
    return normalized;
  }
  return null;
}

function normalizePeerDirection(value: unknown): CompanyProfilePeerGroup["direction"] | null {
  return value === "directed" || value === "bidirectional" ? value : null;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toView(row: CompanyProfileEnrichmentRow): CompanyProfileEnrichmentView {
  return {
    id: row.id,
    ticker: row.ticker,
    source: row.source,
    version: row.version,
    short_description: row.short_description,
    enhanced_description: row.enhanced_description,
    products: parseStringJsonArray(row.products_json),
    revenue_model: parseStringJsonArray(row.revenue_model_json),
    key_metrics: parseStringJsonArray(row.key_metrics_json),
    watch_points: parseStringJsonArray(row.watch_points_json),
    risks: parseStringJsonArray(row.risks_json),
    peer_groups: parsePeerGroupJsonArray(row.peer_groups_json),
    tags: parseStringJsonArray(row.tags_json),
    source_urls: parseStringJsonArray(row.source_urls_json),
    source_note: row.source_note,
    updated_at: row.updated_at,
  };
}