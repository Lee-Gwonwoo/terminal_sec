import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export async function listAlertRules(userId: string) {
  const rows = await getDb().all<any[]>(
    `SELECT id, user_id, tool, name, enabled, methods, rule_json, created_at
     FROM (
       SELECT id, user_id, tool, name, enabled, methods_json AS methods, rule_json, created_at
       FROM alert_rules
     )
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    ...row,
    enabled: Boolean(row.enabled),
    methods: JSON.parse(row.methods),
    rule_json: JSON.parse(row.rule_json)
  }));
}

export async function upsertAlertRule(params: {
  id?: string;
  userId: string;
  tool: "news" | "watchlists" | "calendar";
  name: string;
  enabled: boolean;
  methods: string[];
  ruleJson: object;
}) {
  if (params.id) {
    await getDb().run(
      `UPDATE alert_rules
       SET tool = ?, name = ?, enabled = ?, methods_json = ?, rule_json = ?
       WHERE id = ? AND user_id = ?`,
      [
        params.tool,
        params.name,
        params.enabled ? 1 : 0,
        JSON.stringify(params.methods),
        JSON.stringify(params.ruleJson),
        params.id,
        params.userId
      ]
    );
    return {
      id: params.id,
      user_id: params.userId,
      tool: params.tool,
      name: params.name,
      enabled: params.enabled,
      methods: params.methods,
      rule_json: params.ruleJson,
      created_at: new Date().toISOString()
    };
  }

  const id = randomUUID();
  await getDb().run(
    `INSERT INTO alert_rules (id, user_id, tool, name, enabled, methods_json, rule_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.tool,
      params.name,
      params.enabled ? 1 : 0,
      JSON.stringify(params.methods),
      JSON.stringify(params.ruleJson)
    ]
  );

  return {
    id,
    user_id: params.userId,
    tool: params.tool,
    name: params.name,
    enabled: params.enabled,
    methods: params.methods,
    rule_json: params.ruleJson,
    created_at: new Date().toISOString()
  };
}
