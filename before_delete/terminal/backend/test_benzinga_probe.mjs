import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

const API_BASE = "https://api.benzinga.com";

function requireApiKey() {
  const apiKey =
    process.env.BENZINGA_API_KEY ??
    process.env.BENZINGA_KEY ??
    process.env.BENZINGA_TOKEN;

  if (!apiKey) {
    const message = [
      "Missing Benzinga API key.",
      "Set BENZINGA_API_KEY in terminal/.env (NOT in chat).",
      "Example:",
      "  BENZINGA_API_KEY=your_key_here",
      "Then run:",
      "  node terminal/backend/test_benzinga_probe.mjs"
    ].join("\n");
    throw new Error(message);
  }

  return apiKey;
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
    return {
      type: "array",
      length: value.length,
      firstItemKeys: firstKeys
    };
  }

  if (value && typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value)
    };
  }

  return { type: typeof value };
}

async function fetchJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers
      },
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

    return {
      ok: res.ok,
      status: res.status,
      contentType,
      body: parsed
    };
  } finally {
    clearTimeout(t);
  }
}

async function probe(name, url, { headers } = {}) {
  console.log("\n====", name, "====");
  console.log(url);

  const out = await fetchJson(url, { headers });
  console.log("status:", out.status);
  console.log("content-type:", out.contentType);

  const desc = describeJson(out.body);
  console.log("shape:", safeJsonPreview(desc, 800));

  if (!out.ok) {
    console.log("error body preview:\n" + safeJsonPreview(out.body, 1200));
    return;
  }

  // Print a small preview to validate actual field names/types.
  if (Array.isArray(out.body)) {
    console.log("first item preview:\n" + safeJsonPreview(out.body[0], 1200));
  } else if (out.body && typeof out.body === "object") {
    const keys = Object.keys(out.body);
    const firstKey = keys[0];
    if (firstKey && Array.isArray(out.body[firstKey])) {
      console.log(`first '${firstKey}'[0] preview:\n` + safeJsonPreview(out.body[firstKey][0], 1200));
    } else {
      console.log("object preview:\n" + safeJsonPreview(out.body, 1200));
    }
  } else {
    console.log("body preview:\n" + safeJsonPreview(out.body, 1200));
  }
}

async function main() {
  const apiKey = requireApiKey();

  // 1) News (REST): /api/v2/news
  await probe(
    "News: GET /api/v2/news?pageSize=1&displayOutput=headline",
    `${API_BASE}/api/v2/news?pageSize=1&displayOutput=headline&token=${encodeURIComponent(apiKey)}`
  );

  // 2) News Channels (REST): /api/v2.1/news/channels
  // Docs show Key header here.
  await probe(
    "News Channels: GET /api/v2.1/news/channels (Key header)",
    `${API_BASE}/api/v2.1/news/channels`,
    { headers: { Key: apiKey } }
  );

  // 3) Calendar Earnings (REST): /api/v2.1/calendar/earnings
  await probe(
    "Calendar Earnings: GET /api/v2.1/calendar/earnings?parameters[tickers]=AAPL&pagesize=1",
    `${API_BASE}/api/v2.1/calendar/earnings?pagesize=1&parameters[tickers]=AAPL&token=${encodeURIComponent(apiKey)}`
  );

  // 4) Calendar Dividends (REST): /api/v2.2/calendar/dividends
  await probe(
    "Calendar Dividends: GET /api/v2.2/calendar/dividends?parameters[tickers]=AAPL&pagesize=1",
    `${API_BASE}/api/v2.2/calendar/dividends?pagesize=1&parameters[tickers]=AAPL&token=${encodeURIComponent(apiKey)}`
  );

  // 5) Historical Bars (REST): /api/v2/bars
  await probe(
    "Bars: GET /api/v2/bars?symbols=AAPL&from=1WEEK&interval=1d&session=REGULAR",
    `${API_BASE}/api/v2/bars?symbols=AAPL&from=1WEEK&interval=1d&session=REGULAR&token=${encodeURIComponent(apiKey)}`
  );

  console.log("\nDONE");
}

main().catch((err) => {
  console.error("\nFAILED:");
  console.error(err?.stack || String(err));
  process.exitCode = 2;
});
