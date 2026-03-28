import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: "../.env" });
dotenv.config();

const API_BASE = "https://finnhub.io";

function scriptDir() {
  return path.dirname(new URL(import.meta.url).pathname);
}

function repoRoot() {
  // terminal/backend -> terminal -> repo root
  return path.resolve(scriptDir(), "..", "..");
}

function requireApiKey() {
  const envKey =
    process.env.FINNHUB_API_KEY ??
    process.env.FINNHUB_TOKEN ??
    process.env.FINNHUB_KEY;

  if (envKey) return envKey;

  const fallbackPath = path.resolve(repoRoot(), "finhub", "finhub_api_key", "finhub_api_key");
  try {
    const fileKey = fs.readFileSync(fallbackPath, "utf-8").trim();
    if (fileKey) return fileKey;
  } catch {
    // ignore
  }

  const message = [
    "Missing Finnhub API key.",
    "Set FINNHUB_API_KEY in terminal/.env (NOT in chat),",
    "or ensure finhub/finhub_api_key/finhub_api_key exists.",
    "Example (terminal/.env):",
    "  FINNHUB_API_KEY=your_key_here",
    "Then run:",
    "  node terminal/backend/test_finnhub_probe.mjs",
    "Optional:",
    "  node terminal/backend/test_finnhub_probe.mjs --symbols AAPL,MSFT,TSLA"
  ].join("\n");
  throw new Error(message);
}

function parseArgs(argv) {
  const out = {
    symbols: ["AAPL", "MSFT", "TSLA"],
    days: 30
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--symbols" && argv[i + 1]) {
      out.symbols = String(argv[i + 1])
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i++;
      continue;
    }
    if (a === "--days" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) out.days = n;
      i++;
      continue;
    }
  }

  return out;
}

function isoDateOnly(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeJsonPreview(value, maxLen = 2000) {
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "\n... (truncated)";
  } catch {
    return String(value);
  }
}

function describeJson(value) {
  if (Array.isArray(value)) {
    const first = value[0];
    const firstKeys = first && typeof first === "object" ? Object.keys(first) : [];
    return { type: "array", length: value.length, firstItemKeys: firstKeys };
  }

  if (value && typeof value === "object") {
    return { type: "object", keys: Object.keys(value) };
  }

  return { type: typeof value };
}

function redactUrl(u) {
  try {
    const url = new URL(u);
    if (url.searchParams.has("token")) url.searchParams.set("token", "REDACTED");
    return url.toString();
  } catch {
    return "(unprintable url)";
  }
}

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    let parsed;
    try {
      parsed = contentType.includes("application/json") ? JSON.parse(text) : text;
    } catch {
      parsed = text;
    }

    return { ok: res.ok, status: res.status, contentType, body: parsed };
  } finally {
    clearTimeout(t);
  }
}

function ensureOutDir() {
  const outDir = path.resolve(repoRoot(), "tmp", "probes");
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

function writeJsonFile(outDir, filename, data) {
  const full = path.join(outDir, filename);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), "utf-8");
  return full;
}

async function probeJson({ name, url, outFile }) {
  console.log("\n====", name, "====");
  console.log("request:", redactUrl(url));

  const out = await fetchJson(url);
  console.log("status:", out.status);
  console.log("content-type:", out.contentType);
  console.log("shape:", safeJsonPreview(describeJson(out.body), 800));

  const outDir = ensureOutDir();
  const saved = writeJsonFile(outDir, outFile, out.body);
  console.log("saved:", saved);

  if (!out.ok) {
    console.log("error body preview:\n" + safeJsonPreview(out.body, 1200));
    return;
  }

  if (Array.isArray(out.body)) {
    console.log("first item preview:\n" + safeJsonPreview(out.body[0], 1200));
  } else if (out.body && typeof out.body === "object") {
    console.log("object preview:\n" + safeJsonPreview(out.body, 1200));
  } else {
    console.log("body preview:\n" + safeJsonPreview(out.body, 1200));
  }
}

async function main() {
  const apiKey = requireApiKey();
  const { symbols, days } = parseArgs(process.argv);

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const fromStr = isoDateOnly(from);
  const toStr = isoDateOnly(now);

  console.log("Finnhub probe");
  console.log("symbols:", symbols.join(","));
  console.log("range:", fromStr, "→", toStr, `(last ${days} days)`);
  console.log("outputs: repo/tmp/probes/*.json");

  for (const symbol of symbols) {
    // 1) Company profile
    await probeJson({
      name: `Profile2: /api/v1/stock/profile2?symbol=${symbol}`,
      url: `${API_BASE}/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
      outFile: `finnhub_profile2_${symbol}.json`
    });

    // 2) Company news (recent range)
    await probeJson({
      name: `Company news: /api/v1/company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}`,
      url: `${API_BASE}/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&token=${encodeURIComponent(apiKey)}`,
      outFile: `finnhub_company_news_${symbol}.json`
    });

    // 3) Earnings calendar (range). If endpoint/fields differ, this will still save the raw response.
    await probeJson({
      name: `Earnings calendar: /api/v1/calendar/earnings?symbol=${symbol}&from=${fromStr}&to=${toStr}`,
      url: `${API_BASE}/api/v1/calendar/earnings?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&token=${encodeURIComponent(apiKey)}`,
      outFile: `finnhub_calendar_earnings_${symbol}.json`
    });
  }

  console.log("\nDONE");
}

main().catch((err) => {
  console.error("\nFAILED:");
  console.error(err?.stack || String(err));
  process.exitCode = 2;
});
