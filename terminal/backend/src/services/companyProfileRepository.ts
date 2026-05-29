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
  float_shares: number | null;
  float_pct: number | null;
  outstanding_shares: number | null;
  institutional_pct: number | null;
  market_cap_source: string | null;
  float_source: string | null;
  institutional_source: string | null;
  insider_pct: number | null;
  insider_source: string | null;
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

  const existing = await db.get<CompanyProfileRow>(
    "SELECT * FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );

  if (existing) {
    const nextDescription = description ?? existing.description;
    const nextCeo = ceo ?? existing.ceo;
    const nextEmployees = employees ?? existing.employees;
    const nextWebsite = website ?? existing.website;
    const nextIpoDate = ipoDate ?? existing.ipo_date;
    const nextMarketCap = marketCap ?? existing.market_cap;
    const nextRawJson = rawJson ?? existing.raw_json;
    const nextMarketCapSource = marketCap != null ? source : existing.market_cap_source;

    await db.run(
      `UPDATE company_profiles SET
        description = ?, ceo = ?, employees = ?, website = ?,
        ipo_date = ?, market_cap = ?, raw_json = ?, fetched_at = ?,
        market_cap_source = ?
       WHERE id = ?`,
      [nextDescription, nextCeo, nextEmployees, nextWebsite, nextIpoDate, nextMarketCap, nextRawJson, now, nextMarketCapSource, existing.id],
    );
    return existing.id;
  }

  const result = await db.run(
    `INSERT INTO company_profiles
      (security_id, source, description, ceo, employees, website, ipo_date, market_cap, raw_json, fetched_at, market_cap_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [securityId, source, description, ceo, employees, website, ipoDate, marketCap, rawJson, now, marketCap != null ? source : null],
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
  const rows = await getDb().all<Array<CompanyProfileRow & { ticker: string }>>(
    `SELECT cp.*, s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE s.ticker = ?
     ORDER BY cp.fetched_at DESC, cp.id DESC`,
    [ticker.toUpperCase()],
  );

  if (rows.length === 0) {
    return undefined;
  }

  const latest = rows[0];
  const descriptionRow = rows.find((row) => row.description?.trim());
  const ceoRow = rows.find((row) => row.ceo?.trim());
  const websiteRow = rows.find((row) => row.website?.trim());
  const ipoDateRow = rows.find((row) => row.ipo_date?.trim());
  const marketCapRow = rows.find((row) => row.market_cap != null);
  const rawJsonRow = descriptionRow ?? latest;

  return {
    ...latest,
    source: descriptionRow?.source ?? latest.source,
    description: descriptionRow?.description ?? null,
    ceo: ceoRow?.ceo ?? null,
    website: websiteRow?.website ?? null,
    ipo_date: ipoDateRow?.ipo_date ?? null,
    market_cap: marketCapRow?.market_cap ?? null,
    raw_json: rawJsonRow.raw_json,
    fetched_at: descriptionRow?.fetched_at ?? latest.fetched_at,
  };
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
/**
 * Return ticker symbols that already have a non-null market_cap
 * fetched within the last `maxAgeHours` hours.
 */
export async function getTickersWithRecentMarketCap(maxAgeHours = 24): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.market_cap IS NOT NULL AND cp.fetched_at >= ?`,
    [cutoff],
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

/**
 * Return ticker symbols that already have a non-null description from FMP source.
 */
export async function getTickersWithFmpProfile(): Promise<Set<string>> {
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.source = 'fmp' AND cp.description IS NOT NULL AND cp.description != ''`,
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

/**
 * Return ticker symbols that already have non-null peers_json from Finnhub source.
 */
export async function getTickersWithExistingPeers(): Promise<Set<string>> {
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.source = 'finnhub' AND cp.peers_json IS NOT NULL AND cp.peers_json != '[]'`,
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

/**
 * Return ticker symbols that already have a non-null ipo_date from Finnhub source.
 */
export async function getTickersWithExistingIpoDate(): Promise<Set<string>> {
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.source = 'finnhub' AND cp.ipo_date IS NOT NULL AND cp.ipo_date != ''`,
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

/**
 * Return ticker symbols that already have a non-empty description from Yahoo source.
 */
export async function getTickersWithYahooProfile(): Promise<Set<string>> {
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.source = 'yahoo' AND cp.description IS NOT NULL AND cp.description != ''`,
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

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

/**
 * Upsert float data (float_shares, float_pct, outstanding_shares) for a security.
 */
export async function upsertFloat(
  securityId: number,
  source: string,
  floatShares: number | null,
  floatPct: number | null,
  outstandingShares: number | null,
  floatSource: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.get<{ id: number }>(
    "SELECT id FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );
  if (existing) {
    await db.run(
      `UPDATE company_profiles SET float_shares = ?, float_pct = ?, outstanding_shares = ?, float_source = ?, fetched_at = ? WHERE id = ?`,
      [floatShares, floatPct, outstandingShares, floatSource, now, existing.id],
    );
  } else {
    await db.run(
      `INSERT INTO company_profiles (security_id, source, float_shares, float_pct, outstanding_shares, float_source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [securityId, source, floatShares, floatPct, outstandingShares, floatSource, now],
    );
  }
}

async function clearInstitutionalOnOtherRows(
  securityId: number,
  keepRowId: number,
): Promise<void> {
  await getDb().run(
    `UPDATE company_profiles
     SET institutional_pct = NULL,
         institutional_source = NULL
     WHERE security_id = ? AND id != ? AND institutional_pct IS NOT NULL`,
    [securityId, keepRowId],
  );
}

async function clearInsiderOnOtherRows(
  securityId: number,
  keepRowId: number,
): Promise<void> {
  await getDb().run(
    `UPDATE company_profiles
     SET insider_pct = NULL,
         insider_source = NULL
     WHERE security_id = ? AND id != ? AND insider_pct IS NOT NULL`,
    [securityId, keepRowId],
  );
}

/**
 * Upsert institutional ownership percentage for a security.
 */
export async function upsertInstitutional(
  securityId: number,
  source: string,
  institutionalPct: number | null,
  institutionalSource: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  // If the target source row already exists (e.g. source='yahoo' description row),
  // write ownership into that row to avoid UNIQUE(security_id, source) collisions.
  const sourceRow = await db.get<{ id: number }>(
    "SELECT id FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );
  if (sourceRow) {
    await db.run(
      `UPDATE company_profiles SET institutional_pct = ?, institutional_source = ?, fetched_at = ? WHERE id = ?`,
      [institutionalPct, institutionalSource, now, sourceRow.id],
    );
    await clearInstitutionalOnOtherRows(securityId, sourceRow.id);
    return;
  }

  // Otherwise maintain a single canonical ownership row and switch its source.
  const canonical = await db.get<{ id: number }>(
    `SELECT id FROM company_profiles WHERE security_id = ? AND institutional_pct IS NOT NULL ORDER BY fetched_at DESC LIMIT 1`,
    [securityId],
  );
  if (canonical) {
    await db.run(
      `UPDATE company_profiles SET institutional_pct = ?, institutional_source = ?, fetched_at = ?, source = ? WHERE id = ?`,
      [institutionalPct, institutionalSource, now, source, canonical.id],
    );
    await clearInstitutionalOnOtherRows(securityId, canonical.id);
  } else {
    const result = await db.run(
      `INSERT INTO company_profiles (security_id, source, institutional_pct, institutional_source, fetched_at)
       VALUES (?, ?, ?, ?, ?)`,
      [securityId, source, institutionalPct, institutionalSource, now],
    );
    await clearInstitutionalOnOtherRows(securityId, result.lastID!);
  }
}

/**
 * Upsert insider ownership percentage for a security.
 */
export async function upsertInsider(
  securityId: number,
  source: string,
  insiderPct: number | null,
  insiderSource: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const sourceRow = await db.get<{ id: number }>(
    "SELECT id FROM company_profiles WHERE security_id = ? AND source = ?",
    [securityId, source],
  );
  if (sourceRow) {
    await db.run(
      `UPDATE company_profiles SET insider_pct = ?, insider_source = ?, fetched_at = ? WHERE id = ?`,
      [insiderPct, insiderSource, now, sourceRow.id],
    );
    await clearInsiderOnOtherRows(securityId, sourceRow.id);
    return;
  }

  const canonical = await db.get<{ id: number }>(
    `SELECT id FROM company_profiles
     WHERE security_id = ? AND (institutional_pct IS NOT NULL OR insider_pct IS NOT NULL)
     ORDER BY fetched_at DESC LIMIT 1`,
    [securityId],
  );
  if (canonical) {
    await db.run(
      `UPDATE company_profiles SET insider_pct = ?, insider_source = ?, fetched_at = ?, source = ? WHERE id = ?`,
      [insiderPct, insiderSource, now, source, canonical.id],
    );
    await clearInsiderOnOtherRows(securityId, canonical.id);
  } else {
    const result = await db.run(
      `INSERT INTO company_profiles (security_id, source, insider_pct, insider_source, fetched_at)
       VALUES (?, ?, ?, ?, ?)`,
      [securityId, source, insiderPct, insiderSource, now],
    );
    await clearInsiderOnOtherRows(securityId, result.lastID!);
  }
}

/**
 * Return ticker symbols that already have a non-null float_pct fetched within the last `maxAgeHours` hours.
 */
export async function getTickersWithRecentFloat(maxAgeHours = 24): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  const rows = await getDb().all<{ ticker: string }[]>(
    `SELECT s.ticker FROM company_profiles cp
     JOIN securities s ON s.id = cp.security_id
     WHERE cp.float_pct IS NOT NULL AND cp.fetched_at >= ?`,
    [cutoff],
  );
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}

/**
 * Return ticker symbols that already have a non-null institutional_pct fetched within the last `maxAgeHours` hours.
 * When `source` is provided, only rows with matching institutional_source are considered.
 */
export async function getTickersWithRecentInstitutional(maxAgeHours = 24, source?: string): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  const sql = source
    ? `SELECT s.ticker FROM company_profiles cp
       JOIN securities s ON s.id = cp.security_id
       WHERE cp.institutional_pct IS NOT NULL AND cp.institutional_source = ? AND cp.fetched_at >= ?`
    : `SELECT s.ticker FROM company_profiles cp
       JOIN securities s ON s.id = cp.security_id
       WHERE cp.institutional_pct IS NOT NULL AND cp.fetched_at >= ?`;
  const rows = await getDb().all<{ ticker: string }[]>(sql, source ? [source, cutoff] : [cutoff]);
  return new Set((rows as { ticker: string }[]).map((r) => r.ticker.toUpperCase()));
}
