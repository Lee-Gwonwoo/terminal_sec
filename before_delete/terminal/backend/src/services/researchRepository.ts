import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

// ── Types ──

export interface ResearchTab {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface ResearchPage {
  id: string;
  tab_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrashedResearchTab extends ResearchTab {
  deleted_at: string;
}

export interface TrashedResearchPage extends ResearchPage {
  deleted_at: string;
  tab_name: string | null;
  tab_deleted_at: string | null;
}

const RESEARCH_TRASH_RETENTION_SQL = "-24 hours";

// ── Tabs ──

export async function purgeExpiredResearchTrash(): Promise<void> {
  const db = getDb();
  await db.run(
    `DELETE FROM research_pages
     WHERE deleted_at IS NOT NULL
       AND deleted_at <= datetime('now', ?)`,
    RESEARCH_TRASH_RETENTION_SQL,
  );
  await db.run(
    `DELETE FROM research_tabs
     WHERE deleted_at IS NOT NULL
       AND deleted_at <= datetime('now', ?)`,
    RESEARCH_TRASH_RETENTION_SQL,
  );
}

export async function listResearchTabs(userId: string): Promise<ResearchTab[]> {
  const db = getDb();
  return db.all<ResearchTab[]>(
    `SELECT *
     FROM research_tabs
     WHERE user_id = ?
       AND deleted_at IS NULL
     ORDER BY sort_order, created_at`,
    userId,
  );
}

export async function createResearchTab(userId: string, name?: string): Promise<ResearchTab> {
  const db = getDb();
  const id = randomUUID();
  const maxOrder = await db.get<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM research_tabs WHERE user_id = ? AND deleted_at IS NULL",
    userId,
  );
  const sortOrder = (maxOrder?.m ?? -1) + 1;
  await db.run(
    "INSERT INTO research_tabs (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)",
    id,
    userId,
    name ?? "New Section",
    sortOrder,
  );
  return (await db.get<ResearchTab>("SELECT * FROM research_tabs WHERE id = ?", id))!;
}

export async function renameResearchTab(id: string, name: string): Promise<ResearchTab | null> {
  const db = getDb();
  await db.run("UPDATE research_tabs SET name = ? WHERE id = ? AND deleted_at IS NULL", name, id);
  return (await db.get<ResearchTab>("SELECT * FROM research_tabs WHERE id = ? AND deleted_at IS NULL", id)) ?? null;
}

export async function deleteResearchTab(id: string): Promise<void> {
  const db = getDb();
  await db.run("BEGIN TRANSACTION");
  try {
    const deletedAt = new Date().toISOString();
    await db.run(
      "UPDATE research_tabs SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
      deletedAt,
      id,
    );
    await db.run(
      "UPDATE research_pages SET deleted_at = ? WHERE tab_id = ? AND deleted_at IS NULL",
      deletedAt,
      id,
    );
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

export async function listTrashedResearchTabs(userId: string): Promise<TrashedResearchTab[]> {
  const db = getDb();
  return db.all<TrashedResearchTab[]>(
    `SELECT id, user_id, name, sort_order, created_at, deleted_at
     FROM research_tabs
     WHERE user_id = ?
       AND deleted_at IS NOT NULL
     ORDER BY deleted_at DESC, created_at DESC`,
    userId,
  );
}

export async function restoreResearchTab(id: string): Promise<ResearchTab | null> {
  const db = getDb();
  await db.run("BEGIN TRANSACTION");
  try {
    await db.run(
      "UPDATE research_tabs SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
      id,
    );
    await db.run(
      "UPDATE research_pages SET deleted_at = NULL WHERE tab_id = ? AND deleted_at IS NOT NULL",
      id,
    );
    const restored = await db.get<ResearchTab>(
      "SELECT * FROM research_tabs WHERE id = ? AND deleted_at IS NULL",
      id,
    );
    await db.run("COMMIT");
    return restored ?? null;
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

// ── Pages ──

export async function listResearchPages(tabId: string): Promise<ResearchPage[]> {
  const db = getDb();
  return db.all<ResearchPage[]>(
    `SELECT p.*
     FROM research_pages p
     JOIN research_tabs t ON t.id = p.tab_id
     WHERE p.tab_id = ?
       AND p.deleted_at IS NULL
       AND t.deleted_at IS NULL
     ORDER BY p.sort_order, p.created_at`,
    tabId,
  );
}

export async function getResearchPage(id: string): Promise<ResearchPage | null> {
  const db = getDb();
  return (await db.get<ResearchPage>(
    `SELECT p.*
     FROM research_pages p
     JOIN research_tabs t ON t.id = p.tab_id
     WHERE p.id = ?
       AND p.deleted_at IS NULL
       AND t.deleted_at IS NULL`,
    id,
  )) ?? null;
}

export async function createResearchPage(tabId: string, title?: string): Promise<ResearchPage> {
  const db = getDb();
  const id = randomUUID();
  const maxOrder = await db.get<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM research_pages WHERE tab_id = ? AND deleted_at IS NULL",
    tabId,
  );
  const sortOrder = (maxOrder?.m ?? -1) + 1;
  await db.run(
    "INSERT INTO research_pages (id, tab_id, title, sort_order) VALUES (?, ?, ?, ?)",
    id,
    tabId,
    title ?? "",
    sortOrder,
  );
  return (await db.get<ResearchPage>("SELECT * FROM research_pages WHERE id = ?", id))!;
}

export async function updateResearchPage(
  id: string,
  fields: { title?: string; body?: string },
): Promise<ResearchPage | null> {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    params.push(fields.title);
  }
  if (fields.body !== undefined) {
    sets.push("body = ?");
    params.push(fields.body);
  }
  if (sets.length === 0) return getResearchPage(id);
  sets.push("updated_at = datetime('now')");
  params.push(id);
  await db.run(`UPDATE research_pages SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`, ...params);
  return getResearchPage(id);
}

export async function deleteResearchPage(id: string): Promise<void> {
  const db = getDb();
  await db.run(
    "UPDATE research_pages SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
    new Date().toISOString(),
    id,
  );
}

export async function listTrashedResearchPages(userId: string): Promise<TrashedResearchPage[]> {
  const db = getDb();
  return db.all<TrashedResearchPage[]>(
    `SELECT
       p.id,
       p.tab_id,
       p.title,
       p.body,
       p.sort_order,
       p.created_at,
       p.updated_at,
       p.deleted_at,
       t.name AS tab_name,
       t.deleted_at AS tab_deleted_at
     FROM research_pages p
     JOIN research_tabs t ON t.id = p.tab_id
     WHERE t.user_id = ?
       AND p.deleted_at IS NOT NULL
     ORDER BY p.deleted_at DESC, p.updated_at DESC`,
    userId,
  );
}

export async function restoreResearchPage(id: string): Promise<ResearchPage | null> {
  const db = getDb();
  const row = await db.get<{ parent_deleted_at: string | null }>(
    `SELECT t.deleted_at AS parent_deleted_at
     FROM research_pages p
     JOIN research_tabs t ON t.id = p.tab_id
     WHERE p.id = ?
       AND p.deleted_at IS NOT NULL`,
    id,
  );
  if (!row) {
    return null;
  }
  if (row.parent_deleted_at) {
    throw new Error("PARENT_TAB_DELETED");
  }
  await db.run(
    "UPDATE research_pages SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
    id,
  );
  return getResearchPage(id);
}

export async function reorderResearchPages(tabId: string, pageIds: string[]): Promise<ResearchPage[]> {
  const db = getDb();
  await db.run("BEGIN TRANSACTION");
  try {
    for (let index = 0; index < pageIds.length; index++) {
      await db.run(
        "UPDATE research_pages SET sort_order = ? WHERE id = ? AND tab_id = ? AND deleted_at IS NULL",
        index,
        pageIds[index],
        tabId,
      );
    }
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
  return listResearchPages(tabId);
}

// ── Search ──

export async function searchResearch(
  userId: string,
  query: string,
): Promise<Array<ResearchPage & { tab_name: string }>> {
  const db = getDb();
  const pattern = `%${query}%`;
  return db.all<Array<ResearchPage & { tab_name: string }>>(
    `SELECT p.*, t.name AS tab_name
     FROM research_pages p
     JOIN research_tabs t ON t.id = p.tab_id
     WHERE t.user_id = ?
       AND t.deleted_at IS NULL
       AND p.deleted_at IS NULL
       AND (p.title LIKE ? OR p.body LIKE ?)
     ORDER BY p.updated_at DESC
     LIMIT 100`,
    userId,
    pattern,
    pattern,
  );
}
