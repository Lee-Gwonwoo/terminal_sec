import { getDb } from "../db.js";

export type CompanyPeerGrade = "A" | "B" | "C" | "EXCLUDE";

export type CompanyPeerRelationType =
  | "direct_competitor"
  | "adjacent_competitor"
  | "customer_supplier"
  | "infrastructure_read_through"
  | "platform_overlap"
  | "theme_overlap"
  | "weak_provider_candidate"
  | "excluded_self";

export interface CompanyPeerEvidence {
  source: string;
  detail?: string;
}

export interface CompanyPeerEdgeInput {
  sourceSecurityId: number;
  relatedSecurityId: number | null;
  sourceTicker: string;
  relatedTicker: string;
  relatedName?: string | null;
  grade: CompanyPeerGrade;
  relationType: CompanyPeerRelationType;
  direction?: "directed" | "bidirectional";
  score?: number | null;
  reason?: string | null;
  evidence?: CompanyPeerEvidence[];
  source?: string;
  version?: string;
}

export interface CompanyPeerEdgeRow {
  id: number;
  source_security_id: number;
  related_security_id: number | null;
  source_ticker: string;
  related_ticker: string;
  related_name: string | null;
  related_security_name: string | null;
  grade: CompanyPeerGrade;
  relation_type: CompanyPeerRelationType;
  direction: "directed" | "bidirectional";
  score: number | null;
  reason: string | null;
  evidence_json: string;
  source: string;
  version: string;
  updated_at: string;
}

export interface CompanyPeerEdgeView {
  ticker: string;
  name: string | null;
  grade: CompanyPeerGrade;
  relation_type: CompanyPeerRelationType;
  direction: "directed" | "bidirectional";
  score: number | null;
  reason: string | null;
  evidence: CompanyPeerEvidence[];
  source: string;
  version: string;
  updated_at: string;
}

export async function replaceCompanyPeerEdgesForSource(params: {
  edges: CompanyPeerEdgeInput[];
  source: string;
  version: string;
}): Promise<number> {
  const db = getDb();
  const source = normalizeText(params.source) ?? "default_universe_baseline";
  const version = normalizeText(params.version) ?? "v1";
  const now = new Date().toISOString();

  await db.exec("BEGIN");
  try {
    await db.run("DELETE FROM company_peer_edges WHERE source = ? AND version = ?", [source, version]);
    const statement = await db.prepare(
      `INSERT INTO company_peer_edges (
         source_security_id, related_security_id, source_ticker, related_ticker, related_name,
         grade, relation_type, direction, score, reason, evidence_json, source, version, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const edge of params.edges) {
        await statement.run(
          edge.sourceSecurityId,
          edge.relatedSecurityId,
          normalizeTicker(edge.sourceTicker),
          normalizeTicker(edge.relatedTicker),
          normalizeText(edge.relatedName),
          edge.grade,
          edge.relationType,
          edge.direction ?? "directed",
          typeof edge.score === "number" && Number.isFinite(edge.score) ? edge.score : null,
          normalizeText(edge.reason),
          JSON.stringify(normalizeEvidence(edge.evidence)),
          source,
          version,
          now,
        );
      }
    } finally {
      await statement.finalize();
    }
    await db.exec("COMMIT");
    return params.edges.length;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function getCompanyPeerEdgesByTicker(ticker: string): Promise<CompanyPeerEdgeView[]> {
  const map = await getCompanyPeerEdgesByTickers([ticker]);
  return map.get(normalizeTicker(ticker)) ?? [];
}

export async function getCompanyPeerEdgesByTickers(
  tickers: string[],
): Promise<Map<string, CompanyPeerEdgeView[]>> {
  const normalizedTickers = Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean)));
  if (normalizedTickers.length === 0) {
    return new Map();
  }
  const placeholders = normalizedTickers.map(() => "?").join(",");
  const rows = await getDb().all<CompanyPeerEdgeRow[]>(
    `SELECT cpe.id,
            cpe.source_security_id,
            cpe.related_security_id,
            cpe.source_ticker,
            cpe.related_ticker,
            cpe.related_name,
            rs.name AS related_security_name,
            cpe.grade,
            cpe.relation_type,
            cpe.direction,
            cpe.score,
            cpe.reason,
            cpe.evidence_json,
            cpe.source,
            cpe.version,
            cpe.updated_at
       FROM company_peer_edges cpe
       LEFT JOIN securities rs ON rs.id = cpe.related_security_id
       WHERE cpe.source_ticker IN (${placeholders})
         AND cpe.grade != 'EXCLUDE'
       ORDER BY cpe.source_ticker,
                CASE cpe.grade WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
                cpe.score DESC,
                cpe.related_ticker`,
    normalizedTickers,
  );
  const grouped = new Map<string, CompanyPeerEdgeView[]>();
  for (const row of rows) {
    const key = row.source_ticker.toUpperCase();
    const current = grouped.get(key) ?? [];
    current.push(toView(row));
    grouped.set(key, current);
  }
  return grouped;
}

function toView(row: CompanyPeerEdgeRow): CompanyPeerEdgeView {
  return {
    ticker: row.related_ticker,
    name: row.related_name ?? row.related_security_name ?? null,
    grade: row.grade,
    relation_type: row.relation_type,
    direction: row.direction,
    score: row.score,
    reason: row.reason,
    evidence: parseEvidence(row.evidence_json),
    source: row.source,
    version: row.version,
    updated_at: row.updated_at,
  };
}

function parseEvidence(raw: string | null | undefined): CompanyPeerEvidence[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeEvidence(parsed as CompanyPeerEvidence[]);
  } catch {
    return [];
  }
}

function normalizeEvidence(values: CompanyPeerEvidence[] | undefined): CompanyPeerEvidence[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const source = normalizeText((item as CompanyPeerEvidence).source);
    if (!source) {
      return [];
    }
    const detail = normalizeText((item as CompanyPeerEvidence).detail);
    return [{ source, ...(detail ? { detail } : {}) }];
  });
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