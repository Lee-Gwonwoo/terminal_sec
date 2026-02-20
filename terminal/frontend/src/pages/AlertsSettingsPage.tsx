import { useEffect, useState } from "react";
import { fetchAlertRules, saveAlertRule } from "../api";
import type { AlertRule } from "../types";

export function AlertsSettingsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [name, setName] = useState("");
  const [tool, setTool] = useState<"news" | "watchlists" | "calendar">("news");
  const [enabled, setEnabled] = useState(true);
  const [browser, setBrowser] = useState(true);
  const [sound, setSound] = useState(false);
  const [email, setEmail] = useState(false);

  async function load(): Promise<void> {
    setRules(await fetchAlertRules());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function create(): Promise<void> {
    const methods: Array<"browser" | "sound" | "email"> = [];
    if (browser) methods.push("browser");
    if (sound) methods.push("sound");
    if (email) methods.push("email");

    await saveAlertRule({
      tool,
      name,
      enabled,
      methods,
      rule_json: { tool, scope: "saved-view-or-watchlist" }
    });
    setName("");
    await load();
  }

  return (
    <section>
      <h2>Alert Settings</h2>
      <div className="toolbar">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Rule name" />
        <select value={tool} onChange={(event) => setTool(event.target.value as "news" | "watchlists" | "calendar")}>
          <option value="news">News</option>
          <option value="watchlists">Watchlists</option>
          <option value="calendar">Calendar</option>
        </select>
        <label><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
        <label><input type="checkbox" checked={browser} onChange={(event) => setBrowser(event.target.checked)} /> Browser</label>
        <label><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /> Sound</label>
        <label><input type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} /> Email</label>
        <button onClick={create}>Save Rule</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tool</th>
              <th>Status</th>
              <th>Methods</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.tool}</td>
                <td>{rule.enabled ? "Enabled" : "Disabled"}</td>
                <td>{rule.methods.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
