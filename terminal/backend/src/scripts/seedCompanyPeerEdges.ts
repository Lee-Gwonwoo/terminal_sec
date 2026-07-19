import { initDb, getDb } from "../db.js";
import {
  replaceCompanyPeerEdgesForSource,
  type CompanyPeerEdgeInput,
  type CompanyPeerEvidence,
  type CompanyPeerGrade,
  type CompanyPeerRelationType,
} from "../services/companyPeerRepository.js";

const SOURCE = "default_universe_baseline";
const VERSION = "v1";
const MAX_BY_GRADE: Record<CompanyPeerGrade, number> = {
  A: 12,
  B: 10,
  C: 8,
  EXCLUDE: 20,
};

interface DefaultUniversePeerRow {
  id: number;
  ticker: string;
  exchange: string | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  peers_json: string | null;
  peer_groups_json: string | null;
  tags_json: string | null;
}

interface CandidatePeer {
  source: DefaultUniversePeerRow;
  related: DefaultUniversePeerRow;
  grade: CompanyPeerGrade;
  relationType: CompanyPeerRelationType;
  direction: "directed" | "bidirectional";
  score: number;
  reason: string;
  evidence: CompanyPeerEvidence[];
}

interface ParsedPeerGroup {
  category: string;
  label: string;
  tickers: string[];
  grade: CompanyPeerGrade | null;
  relationType: CompanyPeerRelationType | null;
  direction: "directed" | "bidirectional" | null;
  score: number | null;
  reason: string | null;
}

async function main(): Promise<void> {
  await initDb();
  const limit = getNumericArg("--limit");
  const allRows = await loadDefaultUniverseRows();
  const rows = typeof limit === "number" && limit > 0 ? allRows.slice(0, limit) : allRows;
  const edges = buildPeerEdges(rows);
  await replaceCompanyPeerEdgesForSource({ edges, source: SOURCE, version: VERSION });

  const gradeCounts = countBy(edges, (edge) => edge.grade);
  const visibleTickers = new Set(edges.filter((edge) => edge.grade !== "EXCLUDE").map((edge) => edge.sourceTicker));
  console.log(`[company-peers] source=${SOURCE} version=${VERSION}`);
  console.log(`[company-peers] default tickers loaded=${allRows.length}, processed=${rows.length}`);
  console.log(`[company-peers] edges inserted=${edges.length}, visible ticker coverage=${visibleTickers.size}/${rows.length}`);
  console.log(`[company-peers] grade counts=${JSON.stringify(gradeCounts)}`);
}

async function loadDefaultUniverseRows(): Promise<DefaultUniversePeerRow[]> {
  const db = getDb();
  const universe = await db.get<{ id: number }>("SELECT id FROM ticker_universes WHERE name = ?", ["default"]);
  if (!universe) {
    throw new Error("default ticker universe not found");
  }
  return db.all<DefaultUniversePeerRow[]>(
    `SELECT s.id,
            s.ticker,
            s.exchange,
            s.name,
            s.sector,
            s.industry,
            (
              SELECT cp.market_cap
              FROM company_profiles cp
              WHERE cp.security_id = s.id AND cp.market_cap IS NOT NULL
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS market_cap,
            (
              SELECT cp.peers_json
              FROM company_profiles cp
              WHERE cp.security_id = s.id
                AND cp.peers_json IS NOT NULL
                AND TRIM(cp.peers_json) != ''
                AND TRIM(cp.peers_json) != '[]'
              ORDER BY cp.fetched_at DESC, cp.id DESC
              LIMIT 1
            ) AS peers_json,
            (
              SELECT cpe.peer_groups_json
              FROM company_profile_enrichment cpe
              WHERE cpe.security_id = s.id
              LIMIT 1
            ) AS peer_groups_json,
            (
              SELECT cpe.tags_json
              FROM company_profile_enrichment cpe
              WHERE cpe.security_id = s.id
              LIMIT 1
            ) AS tags_json
       FROM ticker_universe_items ui
       JOIN securities s ON s.id = ui.security_id
       WHERE ui.universe_id = ?
       ORDER BY ui.sort_order, s.ticker`,
    [universe.id],
  );
}

function buildPeerEdges(rows: DefaultUniversePeerRow[]): CompanyPeerEdgeInput[] {
  const byTicker = new Map(rows.map((row) => [normalizeTicker(row.ticker), row]));
  const byIndustry = groupRows(rows, (row) => normalizeBucket(row.industry));
  const bySector = groupRows(rows, (row) => normalizeBucket(row.sector));
  const edgeMap = new Map<string, CandidatePeer>();

  for (const source of rows) {
    const candidates = new Map<string, CandidatePeer>();
    addIndustryPeers(source, byIndustry, candidates);
    addSectorFillPeers(source, bySector, candidates);
    addRawProviderPeers(source, byTicker, byIndustry, candidates);
    addEnrichmentPeers(source, byTicker, candidates);
    for (const candidate of candidates.values()) {
      upsertEdge(edgeMap, candidate);
    }
  }

  addReciprocalDirectPeers(edgeMap, byTicker);
  return clampBySourceAndGrade(Array.from(edgeMap.values())).map(toInput);
}

function addIndustryPeers(
  source: DefaultUniversePeerRow,
  byIndustry: Map<string, DefaultUniversePeerRow[]>,
  candidates: Map<string, CandidatePeer>,
): void {
  if (usesCuratedGroupsAsSourceOfTruth(source)) {
    return;
  }
  const industryKey = normalizeBucket(source.industry);
  if (!industryKey) {
    return;
  }
  const industryRows = byIndustry.get(industryKey) ?? [];
  const tightIndustry = industryRows.length <= 8;
  const peers = industryRows
    .filter((row) => row.id !== source.id)
    .sort((first, second) => comparePeerFit(source, first, second))
    .slice(0, 14);
  peers.forEach((related, index) => {
    const grade: CompanyPeerGrade = tightIndustry && index < 4 ? "A" : "B";
    const relationType: CompanyPeerRelationType = grade === "A" ? "direct_competitor" : "adjacent_competitor";
    addCandidate(candidates, {
      source,
      related,
      grade,
      relationType,
      direction: grade === "A" ? "bidirectional" : "directed",
      score: grade === "A"
        ? roundScore(0.74 + marketCapSimilarity(source.market_cap, related.market_cap) * 0.16)
        : roundScore(0.56 + marketCapSimilarity(source.market_cap, related.market_cap) * 0.12),
      reason: tightIndustry
        ? `Tight same-industry baseline: ${source.industry ?? "unknown industry"}. Selected by market-cap proximity.`
        : `Broad same-industry baseline: ${source.industry ?? "unknown industry"}. Treated as adjacent until product-level review confirms direct overlap.`,
      evidence: [{ source: "securities.industry", detail: source.industry ?? undefined }],
    });
  });
}

function addSectorFillPeers(
  source: DefaultUniversePeerRow,
  bySector: Map<string, DefaultUniversePeerRow[]>,
  candidates: Map<string, CandidatePeer>,
): void {
  if (usesCuratedGroupsAsSourceOfTruth(source)) {
    return;
  }
  const visibleCandidateCount = Array.from(candidates.values()).filter((item) => item.grade !== "EXCLUDE").length;
  if (visibleCandidateCount >= 4) {
    return;
  }
  const sectorKey = normalizeBucket(source.sector);
  if (!sectorKey) {
    return;
  }
  const peers = (bySector.get(sectorKey) ?? [])
    .filter((row) => row.id !== source.id && normalizeBucket(row.industry) !== normalizeBucket(source.industry))
    .sort((first, second) => comparePeerFit(source, first, second))
    .slice(0, 4);
  for (const related of peers) {
    addCandidate(candidates, {
      source,
      related,
      grade: "B",
      relationType: "adjacent_competitor",
      direction: "directed",
      score: roundScore(0.5 + marketCapSimilarity(source.market_cap, related.market_cap) * 0.14),
      reason: `Sector fill baseline: ${source.sector ?? "unknown sector"}. Used because exact industry coverage is thin.`,
      evidence: [{ source: "securities.sector", detail: source.sector ?? undefined }],
    });
  }
}

function addRawProviderPeers(
  source: DefaultUniversePeerRow,
  byTicker: Map<string, DefaultUniversePeerRow>,
  byIndustry: Map<string, DefaultUniversePeerRow[]>,
  candidates: Map<string, CandidatePeer>,
): void {
  const useCuratedGroupsAsSourceOfTruth = usesCuratedGroupsAsSourceOfTruth(source);
  const industrySize = byIndustry.get(normalizeBucket(source.industry))?.length ?? 0;
  for (const peerTicker of parseTickerListJson(source.peers_json)) {
    if (peerTicker === normalizeTicker(source.ticker)) {
      addCandidate(candidates, {
        source,
        related: source,
        grade: "EXCLUDE",
        relationType: "excluded_self",
        direction: "directed",
        score: 0,
        reason: "Provider raw peers included the source ticker itself.",
        evidence: [{ source: "company_profiles.peers_json", detail: peerTicker }],
      });
      continue;
    }
    const related = byTicker.get(peerTicker);
    if (!related) {
      continue;
    }
    const sameIndustry = normalizeBucket(source.industry) && normalizeBucket(source.industry) === normalizeBucket(related.industry);
    const sameSector = normalizeBucket(source.sector) && normalizeBucket(source.sector) === normalizeBucket(related.sector);
    const tightSameIndustry = Boolean(sameIndustry && industrySize <= 8);
    const grade: CompanyPeerGrade = useCuratedGroupsAsSourceOfTruth
      ? "C"
      : tightSameIndustry ? "A" : sameIndustry ? "B" : "C";
    const relationType: CompanyPeerRelationType = sameIndustry
      ? useCuratedGroupsAsSourceOfTruth
        ? "weak_provider_candidate"
        : tightSameIndustry ? "direct_competitor" : "adjacent_competitor"
      : "weak_provider_candidate";
    addCandidate(candidates, {
      source,
      related,
      grade,
      relationType,
      direction: grade === "A" ? "bidirectional" : "directed",
      score: grade === "A"
        ? roundScore(0.86 + marketCapSimilarity(source.market_cap, related.market_cap) * 0.08)
        : grade === "B"
          ? roundScore(0.62 + marketCapSimilarity(source.market_cap, related.market_cap) * 0.08)
        : sameSector
          ? 0.46
          : 0.4,
      reason: useCuratedGroupsAsSourceOfTruth
        ? "Provider candidate kept only as weak evidence because this source uses manually curated peer groups as the primary graph."
        : tightSameIndustry
        ? `Provider candidate confirmed by tight same industry: ${source.industry ?? "unknown industry"}.`
        : sameIndustry
          ? `Provider candidate is same broad industry: ${source.industry ?? "unknown industry"}. Treated as adjacent until product-level review confirms direct overlap.`
        : sameSector
          ? "Provider candidate kept as weak evidence because exact industry does not match inside a broad sector."
          : "Provider candidate kept as weak evidence because sector/industry do not match.",
      evidence: [{ source: "company_profiles.peers_json", detail: peerTicker }],
    });
  }
}

function addEnrichmentPeers(
  source: DefaultUniversePeerRow,
  byTicker: Map<string, DefaultUniversePeerRow>,
  candidates: Map<string, CandidatePeer>,
): void {
  for (const group of parsePeerGroups(source.peer_groups_json)) {
    for (const peerTicker of group.tickers) {
      const related = byTicker.get(peerTicker);
      if (!related) {
        continue;
      }
      if (related.id === source.id) {
        addCandidate(candidates, {
          source,
          related,
          grade: "EXCLUDE",
          relationType: "excluded_self",
          direction: "directed",
          score: 0,
          reason: "Curated peer group included the source ticker itself.",
          evidence: [{ source: "company_profile_enrichment.peer_groups_json", detail: group.label }],
        });
        continue;
      }
      const classification = classifyPeerGroup(source, related, group);
      addCandidate(candidates, {
        source,
        related,
        ...classification,
        reason: `Curated enrichment group "${group.label}". ${classification.reason}`,
        evidence: [{ source: "company_profile_enrichment.peer_groups_json", detail: group.category }],
      });
    }
  }
}

function classifyPeerGroup(
  source: DefaultUniversePeerRow,
  related: DefaultUniversePeerRow,
  group: ParsedPeerGroup,
): Pick<CandidatePeer, "grade" | "relationType" | "direction" | "score" | "reason"> {
  if (group.grade && group.relationType) {
    return {
      grade: group.grade,
      relationType: group.relationType,
      direction: group.direction ?? (group.grade === "A" && group.relationType === "direct_competitor" ? "bidirectional" : "directed"),
      score: group.score ?? defaultExplicitGroupScore(group.grade, group.relationType),
      reason: group.reason ?? "Explicit curated peer metadata supplied by enrichment seed.",
    };
  }

  const text = `${group.category} ${group.label}`.toLowerCase();
  const sameIndustry = normalizeBucket(source.industry) && normalizeBucket(source.industry) === normalizeBucket(related.industry);
  if (text.includes("read_through") || text.includes("upstream") || text.includes("supplier")) {
    return {
      grade: "B",
      relationType: "infrastructure_read_through",
      direction: "directed",
      score: 0.78,
      reason: "Related as a read-through or supply-chain exposure rather than a direct product peer.",
    };
  }
  if (sameIndustry || text.includes("core") || text.includes("peer") || text.includes("systems") || text.includes("memory") || text.includes("accelerator")) {
    return {
      grade: "A",
      relationType: "direct_competitor",
      direction: "bidirectional",
      score: sameIndustry ? 0.94 : 0.88,
      reason: sameIndustry ? "Same industry and curated as a core peer." : "Curated as a core peer group; verify product overlap in deeper review.",
    };
  }
  if (text.includes("adjacent") || text.includes("platform") || text.includes("networking")) {
    return {
      grade: sameIndustry ? "A" : "B",
      relationType: sameIndustry ? "direct_competitor" : "platform_overlap",
      direction: sameIndustry ? "bidirectional" : "directed",
      score: sameIndustry ? 0.9 : 0.76,
      reason: sameIndustry ? "Same industry and curated as adjacent platform peer." : "Curated as platform or workload overlap.",
    };
  }
  return {
    grade: "B",
    relationType: "theme_overlap",
    direction: "directed",
    score: 0.68,
    reason: "Curated as thematic overlap.",
  };
}

function defaultExplicitGroupScore(grade: CompanyPeerGrade, relationType: CompanyPeerRelationType): number {
  if (grade === "A") {
    return relationType === "direct_competitor" ? 0.92 : 0.88;
  }
  if (grade === "B") {
    return relationType === "weak_provider_candidate" ? 0.54 : 0.76;
  }
  if (grade === "C") {
    return 0.42;
  }
  return 0;
}

function addReciprocalDirectPeers(
  edgeMap: Map<string, CandidatePeer>,
  byTicker: Map<string, DefaultUniversePeerRow>,
): void {
  const currentEdges = Array.from(edgeMap.values());
  for (const edge of currentEdges) {
    if (edge.grade !== "A" || edge.relationType !== "direct_competitor") {
      continue;
    }
    const reciprocalSource = byTicker.get(normalizeTicker(edge.related.ticker));
    const reciprocalRelated = byTicker.get(normalizeTicker(edge.source.ticker));
    if (!reciprocalSource || !reciprocalRelated) {
      continue;
    }
    if (usesCuratedGroupsAsSourceOfTruth(reciprocalSource)) {
      continue;
    }
    upsertEdge(edgeMap, {
      source: reciprocalSource,
      related: reciprocalRelated,
      grade: "A",
      relationType: "direct_competitor",
      direction: "bidirectional",
      score: Math.max(0.7, roundScore(edge.score - 0.01)),
      reason: `Reciprocal A-grade direct peer generated from ${edge.source.ticker}.`,
      evidence: [{ source: "reciprocal_direct_peer", detail: edge.source.ticker }],
    });
  }
}

function addCandidate(candidates: Map<string, CandidatePeer>, candidate: CandidatePeer): void {
  upsertEdge(candidates, candidate);
}

function upsertEdge(edgeMap: Map<string, CandidatePeer>, candidate: CandidatePeer): void {
  const sourceTicker = normalizeTicker(candidate.source.ticker);
  const relatedTicker = normalizeTicker(candidate.related.ticker);
  if (!sourceTicker || !relatedTicker) {
    return;
  }
  const key = `${sourceTicker}|${relatedTicker}`;
  const existing = edgeMap.get(key);
  if (!existing) {
    edgeMap.set(key, normalizeCandidate(candidate));
    return;
  }
  const existingRank = gradeRank(existing.grade);
  const candidateRank = gradeRank(candidate.grade);
  const mergedEvidence = mergeEvidence(existing.evidence, candidate.evidence);
  if (candidate.grade === "EXCLUDE" && existing.grade !== "EXCLUDE") {
    edgeMap.set(key, normalizeCandidate({ ...candidate, evidence: mergedEvidence }));
    return;
  }
  if (candidateRank > existingRank || (candidateRank === existingRank && candidate.score > existing.score)) {
    edgeMap.set(key, normalizeCandidate({ ...candidate, evidence: mergedEvidence }));
    return;
  }
  edgeMap.set(key, { ...existing, evidence: mergedEvidence });
}

function normalizeCandidate(candidate: CandidatePeer): CandidatePeer {
  return {
    ...candidate,
    score: roundScore(candidate.score),
    reason: candidate.reason.trim(),
    evidence: mergeEvidence([], candidate.evidence),
  };
}

function clampBySourceAndGrade(edges: CandidatePeer[]): CandidatePeer[] {
  const bySource = groupRows(edges, (edge) => normalizeTicker(edge.source.ticker));
  const result: CandidatePeer[] = [];
  for (const sourceEdges of bySource.values()) {
    for (const grade of ["A", "B", "C", "EXCLUDE"] as const) {
      const limit = MAX_BY_GRADE[grade];
      result.push(
        ...sourceEdges
          .filter((edge) => edge.grade === grade)
          .sort((first, second) => second.score - first.score || normalizeTicker(first.related.ticker).localeCompare(normalizeTicker(second.related.ticker)))
          .slice(0, limit),
      );
    }
  }
  return result.sort((first, second) =>
    normalizeTicker(first.source.ticker).localeCompare(normalizeTicker(second.source.ticker))
    || gradeRank(second.grade) - gradeRank(first.grade)
    || second.score - first.score
    || normalizeTicker(first.related.ticker).localeCompare(normalizeTicker(second.related.ticker)),
  );
}

function toInput(candidate: CandidatePeer): CompanyPeerEdgeInput {
  return {
    sourceSecurityId: candidate.source.id,
    relatedSecurityId: candidate.related.id,
    sourceTicker: normalizeTicker(candidate.source.ticker),
    relatedTicker: normalizeTicker(candidate.related.ticker),
    relatedName: candidate.related.name,
    grade: candidate.grade,
    relationType: candidate.relationType,
    direction: candidate.direction,
    score: candidate.score,
    reason: candidate.reason,
    evidence: candidate.evidence,
    source: SOURCE,
    version: VERSION,
  };
}

function comparePeerFit(source: DefaultUniversePeerRow, first: DefaultUniversePeerRow, second: DefaultUniversePeerRow): number {
  const firstSimilarity = marketCapSimilarity(source.market_cap, first.market_cap);
  const secondSimilarity = marketCapSimilarity(source.market_cap, second.market_cap);
  if (firstSimilarity !== secondSimilarity) {
    return secondSimilarity - firstSimilarity;
  }
  return (second.market_cap ?? 0) - (first.market_cap ?? 0) || first.ticker.localeCompare(second.ticker);
}

function marketCapSimilarity(first: number | null, second: number | null): number {
  if (!first || !second || first <= 0 || second <= 0) {
    return 0.35;
  }
  const diff = Math.abs(Math.log10(first) - Math.log10(second));
  return Math.max(0, Math.min(1, 1 - diff / 3));
}

function parseTickerListJson(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(new Set(parsed.flatMap((item) => {
      if (typeof item === "string") {
        return [normalizeTicker(item)];
      }
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const ticker = row.ticker ?? row.symbol;
        return typeof ticker === "string" ? [normalizeTicker(ticker)] : [];
      }
      return [];
    }).filter(Boolean)));
  } catch {
    return [];
  }
}

function hasTag(row: DefaultUniversePeerRow, tag: string): boolean {
  const normalizedTag = normalizeBucket(tag);
  return parseTickerListJson(row.tags_json).some((value) => normalizeBucket(value) === normalizedTag);
}

function usesCuratedGroupsAsSourceOfTruth(row: DefaultUniversePeerRow): boolean {
  return hasTag(row, "industry_override_needed")
    || hasTag(row, "full_peer_curation_batch_002")
    || hasTag(row, "full_peer_curation_batch_003")
    || hasTag(row, "full_peer_curation_batch_004")
    || hasTag(row, "full_peer_curation_batch_005");
}

function parsePeerGroups(raw: string | null): ParsedPeerGroup[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }
      const row = item as Record<string, unknown>;
      const tickers = Array.isArray(row.tickers)
        ? row.tickers.filter((ticker): ticker is string => typeof ticker === "string").map(normalizeTicker).filter(Boolean)
        : [];
      if (tickers.length === 0) {
        return [];
      }
      return [{
        category: typeof row.category === "string" && row.category.trim() ? row.category.trim() : "other",
        label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : "Other",
        tickers,
        grade: parsePeerGrade(row.grade),
        relationType: parseRelationType(row.relationType ?? row.relation_type),
        direction: parseDirection(row.direction),
        score: typeof row.score === "number" && Number.isFinite(row.score) ? roundScore(row.score) : null,
        reason: typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : null,
      }];
    });
  } catch {
    return [];
  }
}

function parsePeerGrade(value: unknown): CompanyPeerGrade | null {
  return value === "A" || value === "B" || value === "C" || value === "EXCLUDE" ? value : null;
}

function parseRelationType(value: unknown): CompanyPeerRelationType | null {
  if (
    value === "direct_competitor"
    || value === "adjacent_competitor"
    || value === "customer_supplier"
    || value === "infrastructure_read_through"
    || value === "platform_overlap"
    || value === "theme_overlap"
    || value === "weak_provider_candidate"
    || value === "excluded_self"
  ) {
    return value;
  }
  return null;
}

function parseDirection(value: unknown): "directed" | "bidirectional" | null {
  return value === "directed" || value === "bidirectional" ? value : null;
}

function groupRows<T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) {
      continue;
    }
    const values = grouped.get(key) ?? [];
    values.push(row);
    grouped.set(key, values);
  }
  return grouped;
}

function mergeEvidence(first: CompanyPeerEvidence[], second: CompanyPeerEvidence[]): CompanyPeerEvidence[] {
  const seen = new Set<string>();
  const result: CompanyPeerEvidence[] = [];
  for (const evidence of [...first, ...second]) {
    const source = typeof evidence.source === "string" ? evidence.source.trim() : "";
    if (!source) {
      continue;
    }
    const detail = typeof evidence.detail === "string" && evidence.detail.trim() ? evidence.detail.trim() : undefined;
    const key = `${source.toLowerCase()}|${detail?.toLowerCase() ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ source, ...(detail ? { detail } : {}) });
  }
  return result;
}

function gradeRank(grade: CompanyPeerGrade): number {
  if (grade === "A") return 3;
  if (grade === "B") return 2;
  if (grade === "C") return 1;
  return 0;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function normalizeBucket(value: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTicker(value: string): string {
  return String(value ?? "").trim().toUpperCase();
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function getNumericArg(name: string): number | null {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) {
    return null;
  }
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) ? Math.floor(value) : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});