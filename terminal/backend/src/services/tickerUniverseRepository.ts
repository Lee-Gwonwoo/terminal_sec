import { getDb } from "../db.js";

// ── securities upsert ──

export interface SecurityRow {
  id: number;
  ticker: string;
  exchange: string | null;
  name: string | null;
  sector: string | null;
  industry: string | null;
}

/**
 * Upsert a security by (ticker, exchange).
 * Returns the row id (existing or newly inserted).
 */
export async function upsertSecurity(
  ticker: string,
  exchange: string | null,
  name: string | null,
  sector: string | null,
  industry: string | null,
): Promise<number> {
  const db = getDb();
  const upperTicker = ticker.toUpperCase();

  // Look up by ticker only (oldest row first) to avoid creating duplicates
  // when the same ticker is inserted with different exchange values.
  const existing = await db.get<{ id: number }>(
    `SELECT id FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1`,
    [upperTicker],
  );

  if (existing) {
    // update metadata if provided
    const sets: string[] = [];
    const params: any[] = [];
    if (exchange) { sets.push("exchange = ?"); params.push(exchange); }
    if (name) { sets.push("name = ?"); params.push(name); }
    if (sector) { sets.push("sector = ?"); params.push(sector); }
    if (industry) { sets.push("industry = ?"); params.push(industry); }
    if (sets.length > 0) {
      params.push(existing.id);
      await db.run(`UPDATE securities SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    return existing.id;
  }

  const result = await db.run(
    `INSERT INTO securities (ticker, exchange, name, sector, industry) VALUES (?, ?, ?, ?, ?)`,
    [upperTicker, exchange, name, sector, industry],
  );

  return result.lastID!;
}

export async function getSecurityByTicker(ticker: string, _exchange?: string): Promise<SecurityRow | undefined> {
  return getDb().get<SecurityRow>(
    `SELECT id, ticker, exchange, name, sector, industry
     FROM securities WHERE ticker = ? ORDER BY id ASC LIMIT 1`,
    [ticker.toUpperCase()],
  );
}

export async function getSecurityById(id: number): Promise<SecurityRow | undefined> {
  return getDb().get<SecurityRow>(
    `SELECT id, ticker, exchange, name, sector, industry FROM securities WHERE id = ?`,
    [id],
  );
}

export async function countSecurities(): Promise<number> {
  const row = await getDb().get<{ cnt: number }>("SELECT COUNT(*) as cnt FROM securities");
  return row?.cnt ?? 0;
}

// ── ticker universes ──

export interface UniverseRow {
  id: number;
  name: string;
  description: string | null;
  source_path: string | null;
  created_at: string;
}

export async function upsertUniverse(
  name: string,
  description: string | null,
  sourcePath: string | null,
): Promise<number> {
  const db = getDb();
  const existing = await db.get<{ id: number }>(
    "SELECT id FROM ticker_universes WHERE name = ?",
    [name],
  );

  if (existing) {
    await db.run(
      "UPDATE ticker_universes SET description = ?, source_path = ? WHERE id = ?",
      [description, sourcePath, existing.id],
    );
    return existing.id;
  }

  const result = await db.run(
    "INSERT INTO ticker_universes (name, description, source_path) VALUES (?, ?, ?)",
    [name, description, sourcePath],
  );
  return result.lastID!;
}

export async function addUniverseItem(universeId: number, securityId: number, sortOrder: number): Promise<boolean> {
  const result = await getDb().run(
    `INSERT OR IGNORE INTO ticker_universe_items (universe_id, security_id, sort_order) VALUES (?, ?, ?)`,
    [universeId, securityId, sortOrder],
  );
  return (result.changes ?? 0) > 0;
}

export async function listUniverseItems(universeId: number): Promise<SecurityRow[]> {
  return getDb().all<SecurityRow[]>(
    `SELECT s.id, s.ticker, s.exchange, s.name, s.sector, s.industry
     FROM ticker_universe_items ui
     JOIN securities s ON s.id = ui.security_id
     WHERE ui.universe_id = ?
     ORDER BY ui.sort_order, s.ticker`,
    [universeId],
  );
}

export async function listUniverses(): Promise<UniverseRow[]> {
  return getDb().all<UniverseRow[]>(
    "SELECT id, name, description, source_path, created_at FROM ticker_universes ORDER BY name",
  );
}

export async function countUniverseItems(universeId: number): Promise<number> {
  const row = await getDb().get<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM ticker_universe_items WHERE universe_id = ?",
    [universeId],
  );
  return row?.cnt ?? 0;
}

export async function removeUniverseItemByTicker(universeId: number, ticker: string): Promise<boolean> {
  const db = getDb();
  const sec = await db.get<{ id: number }>(
    `SELECT id FROM securities WHERE ticker = ?`,
    [ticker.toUpperCase()],
  );
  if (!sec) return false;
  const result = await db.run(
    `DELETE FROM ticker_universe_items WHERE universe_id = ? AND security_id = ?`,
    [universeId, sec.id],
  );
  return (result.changes ?? 0) > 0;
}
