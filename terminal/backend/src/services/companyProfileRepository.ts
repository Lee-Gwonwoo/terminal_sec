import { getDb } from "../db.js";

export interface CompanyProfileRow {
  id: number;
  security_id: number;
  source: string;
  description: string | null;
  ceo: string | null;
  employees: number | null;
  website: string | null;
  ipo_date: string | null;
  market_cap: number | null;
  raw_json: string | null;
  peers_json: string | null;
  fetched_at: string;
}

/**
 * Upsert a company profile for a given security_id + source.
 * If already exists, updates description and metadata.
 */
export async function upsertCompanyProfile(
  securityId: number,
  source: string,
  description: string | null,
  ceo: string | null,
  employees: number | null,
  website: string | null,
  ipoDate: string | null,
  marketCap: number | null,
  rawJson: string | null,
): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await db.get<{ id: number }>(
    "SELECT id FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );

  if (existing) {
    await db.run(
      `UPDATE company_profiles SET
        description = ?, ceo = ?, employees = ?, website = ?,
        ipo_date = ?, market_cap = ?, raw_json = ?, fetched_at = ?
       WHERE id = ?`,
      [description, ceo, employees, website, ipoDate, marketCap, rawJson, now, existing.id],
    );
    return existing.id;
  }

  const result = await db.run(
    `INSERT INTO company_profiles
      (security_id, source, description, ceo, employees, website, ipo_date, market_cap, raw_json, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [securityId, source, description, ceo, employees, website, ipoDate, marketCap, rawJson, now],
  );
  return result.lastID!;
}

export async function getCompanyProfile(securityId: number, source?: string): Promise<CompanyProfileRow | undefined> {
  if (source) {
    return getDb().get<CompanyProfileRow>(
      "SELECT * FROM company_profiles WHERE security_id = ? AND source = ?",
      [securityId, source],
    );
  }
  // return most recent profile regardless of source
  return getDb().get<CompanyProfileRow>(
    "SELECT * FROM company_profiles WHERE security_id = ? ORDER BY fetched_at DESC LIMIT 1",
    [securityId],
  );
}

export async function getCompanyProfileByTicker(ticker: string): Promise<(CompanyProfileRow & { ticker: string }) | undefined> {
  return getDb().get(
    `SELECT cp.*, s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE s.ticker = ?
     ORDER BY cp.fetched_at DESC LIMIT 1`,
    [ticker.toUpperCase()],
  );
}

export async function countCompanyProfiles(): Promise<number> {
  const row = await getDb().get<{ cnt: number }>("SELECT COUNT(*) as cnt FROM company_profiles");
  return row?.cnt ?? 0;
}

/**
 * Update only the peers_json field for a given security_id + source.
 * Creates the row if it doesn't exist.
 */
export async function upsertPeers(
  securityId: number,
  source: string,
  peersJson: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.get<{ id: number }>(
    "SELECT id FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );
  if (existing) {
    await db.run(
      "UPDATE company_profiles SET peers_json = ?, fetched_at = ? WHERE id = ?",
      [peersJson, now, existing.id],
    );
  } else {
    await db.run(
      `INSERT INTO company_profiles (security_id, source, peers_json, fetched_at)
       VALUES (?, ?, ?, ?)`,
      [securityId, source, peersJson, now],
    );
  }
}

/**
 * Get peers array for a ticker (returns parsed string[] or null).
 */
export async function getPeersByTicker(ticker: string): Promise<string[] | null> {
  const row = await getDb().get<{ peers_json: string | null }>(
    `SELECT cp.peers_json FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE s.ticker = ? AND cp.peers_json IS NOT NULL
     ORDER BY cp.fetched_at DESC LIMIT 1`,
    [ticker.toUpperCase()],
  );
  if (!row?.peers_json) return null;
  try { return JSON.parse(row.peers_json); } catch { return null; }
}
