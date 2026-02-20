import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export async function createSavedView(userId: string, name: string, queryJson: object, enableAlerts: boolean) {
  const id = randomUUID();
  await getDb().run(
    `INSERT INTO news_saved_views (id, user_id, name, query_json, enable_alerts)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, name, JSON.stringify(queryJson), enableAlerts ? 1 : 0]
  );

  return {
    id,
    user_id: userId,
    name,
    query_json: queryJson,
    enable_alerts: enableAlerts,
    created_at: new Date().toISOString()
  };
}

export async function listSavedViews(userId: string) {
  const rows = await getDb().all<any[]>(
    `SELECT id, user_id, name, query_json, enable_alerts, created_at
     FROM news_saved_views
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    ...row,
    query_json: JSON.parse(row.query_json),
    enable_alerts: Boolean(row.enable_alerts)
  }));
}

export async function deleteSavedView(userId: string, viewId: string) {
  const result = await getDb().run(
    `DELETE FROM news_saved_views WHERE user_id = ? AND id = ?`,
    [userId, viewId]
  );
  return result.changes ?? 0;
}
