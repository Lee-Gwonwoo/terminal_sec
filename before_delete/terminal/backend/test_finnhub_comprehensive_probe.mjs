/**
 * test_finnhub_comprehensive_probe.mjs
 *
 * Comprehensive Finnhub API endpoint probe.
 * Tests ALL documented REST endpoints (free + premium) to determine
 * which are accessible with the current API key tier.
 *
 * Usage:
 *   cd terminal/backend
 *   node test_finnhub_comprehensive_probe.mjs [--symbol AAPL]
 *
 * Output:
 *   tmp/probes/finnhub_comprehensive_probe.json  (full results)
 *   Console summary table
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: "../.env" });
dotenv.config();

const API = "https://finnhub.io/api/v1";

function repoRoot() {
  const u = new URL(import.meta.url);
  // On Windows, file:///C:/foo → /C:/foo, strip leading slash
  let dir = decodeURIComponent(u.pathname);
  if (process.platform === "win32" && dir.startsWith("/")) dir = dir.slice(1);
  dir = path.dirname(dir);
  return path.resolve(dir, "..", "..");
}

function getApiKey() {
  const k =
    process.env.FINNHUB_API_KEY ??
    process.env.FINNHUB_TOKEN ??
    process.env.FINNHUB_KEY;
  if (k) return k;
  const fp = path.resolve(repoRoot(), "finhub", "finhub_api_key", "finhub_api_key");
  try { return fs.readFileSync(fp, "utf-8").trim(); } catch { /* */ }
  throw new Error("Missing Finnhub API key");
}

async function probe(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    return { status: 0, ok: false, body: null, error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

function shape(body) {
  if (body === null || body === undefined) return "null";
  if (typeof body === "string") return body.length > 200 ? `string(${body.length})` : body;
  if (Array.isArray(body)) return `array[${body.length}]${body.length > 0 ? " keys:" + Object.keys(body[0] || {}).join(",") : ""}`;
  if (typeof body === "object") {
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0] === "error") return `ERROR: ${body.error}`;
    return `object{${keys.join(",")}}`;
  }
  return typeof body;
}

function hasData(body) {
  if (!body) return false;
  if (typeof body === "string") return false;
  if (Array.isArray(body)) return body.length > 0;
  if (typeof body === "object") {
    if (body.error) return false;
    if (body.s === "no_data") return false;
    // Check common wrapper keys
    for (const k of ["data", "earningsCalendar", "ipoCalendar", "economicCalendar",
      "majorDevelopment", "ownership", "financials", "metric", "result",
      "constituents", "profile", "holdings", "sectorExposure", "executive",
      "similarity", "technicalAnalysis"]) {
      if (k in body) {
        const v = body[k];
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === "object" && Object.keys(v).length > 0) return true;
      }
    }
    // If object has multiple meaningful keys, treat as data
    const keys = Object.keys(body);
    if (keys.length > 1) return true;
  }
  return false;
}

async function main() {
  const token = getApiKey();
  const args = process.argv.slice(2);
  let sym = "AAPL";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--symbol" && args[i + 1]) { sym = args[i + 1]; i++; }
  }

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const from1y = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const unixTo = Math.floor(now.getTime() / 1000);
  const unixFrom30 = Math.floor((now.getTime() - 30 * 86400000) / 1000);

  // Define ALL endpoints to probe
  // Category | Name | URL | Free/Premium
  const endpoints = [
    // ===== STOCK FUNDAMENTALS =====
    ["Fundamentals", "Symbol Lookup", `/search?q=${sym}&exchange=US`, "Free"],
    ["Fundamentals", "Stock Symbols (US, first 5)", `/stock/symbol?exchange=US`, "Free"],
    ["Fundamentals", "Market Status (US)", `/stock/market-status?exchange=US`, "Free"],
    ["Fundamentals", "Market Holiday (US)", `/stock/market-holiday?exchange=US`, "Free"],
    ["Fundamentals", "Company Profile 2", `/stock/profile2?symbol=${sym}`, "Free"],
    ["Fundamentals", "Company Profile (v1, Premium)", `/stock/profile?symbol=${sym}`, "Premium"],
    ["Fundamentals", "Company Executive", `/stock/executive?symbol=${sym}`, "Premium"],
    ["Fundamentals", "Company Peers", `/stock/peers?symbol=${sym}`, "Free"],
    ["Fundamentals", "Basic Financials (metric=all)", `/stock/metric?symbol=${sym}&metric=all`, "Free"],
    ["Fundamentals", "Ownership", `/stock/ownership?symbol=${sym}&limit=5`, "Premium"],
    ["Fundamentals", "Fund Ownership", `/stock/fund-ownership?symbol=${sym}&limit=5`, "Premium"],
    ["Fundamentals", "Insider Transactions", `/stock/insider-transactions?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Fundamentals", "Insider Sentiment", `/stock/insider-sentiment?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Fundamentals", "Financial Statements (ic, annual)", `/stock/financials?symbol=${sym}&statement=ic&freq=annual`, "Premium"],
    ["Fundamentals", "Financials As Reported", `/stock/financials-reported?symbol=${sym}&freq=annual`, "Free"],
    ["Fundamentals", "Revenue Breakdown", `/stock/revenue-breakdown?symbol=${sym}`, "Premium"],
    ["Fundamentals", "SEC Filings", `/stock/filings?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Fundamentals", "SEC Sentiment Analysis", `/stock/filings-sentiment?accessNumber=0000320193-20-000052`, "Premium"],
    ["Fundamentals", "Similarity Index", `/stock/similarity-index?symbol=${sym}&freq=annual`, "Premium"],
    ["Fundamentals", "IPO Calendar", `/calendar/ipo?from=${from30}&to=${to}`, "Free"],
    ["Fundamentals", "Dividends", `/stock/dividend?symbol=${sym}&from=${from1y}&to=${to}`, "Premium"],
    ["Fundamentals", "Dividends 2 (Basic)", `/stock/dividend2?symbol=${sym}`, "Premium"],
    ["Fundamentals", "Splits", `/stock/split?symbol=${sym}&from=2000-01-01&to=${to}`, "Premium"],
    ["Fundamentals", "Sector Metrics (NA)", `/sector/metrics?region=NA`, "Premium"],
    ["Fundamentals", "Price Metrics", `/stock/price-metric?symbol=${sym}`, "Premium"],
    ["Fundamentals", "Symbol Change", `/ca/symbol-change?from=${from30}&to=${to}`, "Premium"],
    ["Fundamentals", "Historical Market Cap", `/stock/historical-market-cap?symbol=${sym}&from=${from1y}&to=${to}`, "Premium"],
    ["Fundamentals", "Historical Employee Count", `/stock/historical-employee-count?symbol=${sym}&from=2020-01-01&to=${to}`, "Premium"],

    // ===== NEWS =====
    ["News", "Market News (general)", `/news?category=general`, "Free"],
    ["News", "Company News", `/company-news?symbol=${sym}&from=${from30}&to=${to}`, "Free"],
    ["News", "Press Releases", `/press-releases?symbol=${sym}&from=${from30}&to=${to}`, "Premium"],
    ["News", "News Sentiment", `/news-sentiment?symbol=${sym}`, "Premium"],
    ["News", "Newsroom", `/stock/newsroom?symbol=${sym}`, "Premium"],

    // ===== ESTIMATES =====
    ["Estimates", "Recommendation Trends", `/stock/recommendation?symbol=${sym}`, "Free"],
    ["Estimates", "Price Target", `/stock/price-target?symbol=${sym}`, "Premium"],
    ["Estimates", "Upgrade/Downgrade", `/stock/upgrade-downgrade?symbol=${sym}&from=${from1y}&to=${to}`, "Premium"],
    ["Estimates", "Revenue Estimates", `/stock/revenue-estimate?symbol=${sym}&freq=quarterly`, "Premium"],
    ["Estimates", "EPS Estimates", `/stock/eps-estimate?symbol=${sym}&freq=quarterly`, "Premium"],
    ["Estimates", "EBITDA Estimates", `/stock/ebitda-estimate?symbol=${sym}&freq=quarterly`, "Premium"],
    ["Estimates", "EBIT Estimates", `/stock/ebit-estimate?symbol=${sym}&freq=quarterly`, "Premium"],
    ["Estimates", "Earnings Surprises", `/stock/earnings?symbol=${sym}&limit=5`, "Free"],
    ["Estimates", "Earnings Calendar", `/calendar/earnings?symbol=${sym}&from=${from30}&to=${to}`, "Free"],

    // ===== STOCK PRICE =====
    ["Price", "Quote", `/quote?symbol=${sym}`, "Free"],
    ["Price", "Stock Candles (D)", `/stock/candle?symbol=${sym}&resolution=D&from=${unixFrom30}&to=${unixTo}`, "Premium"],
    ["Price", "Last Bid-Ask", `/stock/bidask?symbol=${sym}`, "Premium"],

    // ===== ALTERNATIVE DATA =====
    ["Alternative", "USPTO Patents", `/stock/uspto-patent?symbol=NVDA&from=${from1y}&to=${to}`, "Free"],
    ["Alternative", "Visa Application (H1B)", `/stock/visa-application?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Alternative", "Senate Lobbying", `/stock/lobbying?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Alternative", "USA Spending", `/stock/usa-spending?symbol=${sym}&from=${from1y}&to=${to}`, "Free"],
    ["Alternative", "Congressional Trading", `/stock/congressional-trading?symbol=${sym}&from=${from1y}&to=${to}`, "Premium"],
    ["Alternative", "Social Sentiment", `/stock/social-sentiment?symbol=${sym}&from=${from30}&to=${to}`, "Premium"],
    ["Alternative", "Supply Chain", `/stock/supply-chain?symbol=${sym}`, "Premium"],
    ["Alternative", "Company ESG Score", `/stock/esg?symbol=${sym}`, "Premium"],
    ["Alternative", "Earnings Quality Score", `/stock/earnings-quality-score?symbol=${sym}&freq=quarterly`, "Premium"],
    ["Alternative", "FDA Calendar", `/fda-advisory-committee-calendar`, "Free"],
    ["Alternative", "Investment Themes (sample)", `/stock/investment-theme?theme=financialExchangesData`, "Premium"],

    // ===== ETF / INDEX =====
    ["ETF/Index", "ETF Profile (SPY)", `/etf/profile?symbol=SPY`, "Premium"],
    ["ETF/Index", "Indices Constituents (^GSPC)", `/index/constituents?symbol=^GSPC`, "Premium"],

    // ===== EARNINGS CALL =====
    ["EarningsCall", "Transcripts List", `/stock/transcripts/list?symbol=${sym}`, "Premium"],

    // ===== ECONOMIC =====
    ["Economic", "Country List", `/country`, "Free"],
    ["Economic", "Economic Calendar", `/calendar/economic?from=${from30}&to=${to}`, "Premium"],

    // ===== FOREX / CRYPTO reference =====
    ["Forex", "Forex Exchanges", `/forex/exchange`, "Free"],
    ["Crypto", "Crypto Exchanges", `/crypto/exchange`, "Free"],
  ];

  console.log(`Finnhub Comprehensive Probe — symbol: ${sym}, date: ${to}`);
  console.log(`Testing ${endpoints.length} endpoints...\n`);

  const results = [];
  let delayMs = 120; // ~8 calls/sec to stay under 30/sec limit

  for (const [cat, name, urlPath, tier] of endpoints) {
    const url = `${API}${urlPath}&token=${encodeURIComponent(token)}`.replace("?&", "?").replace(/&&/g, "&");
    // Fix: if urlPath has no ?, add ?token= instead of &token=
    const finalUrl = urlPath.includes("?")
      ? `${API}${urlPath}&token=${encodeURIComponent(token)}`
      : `${API}${urlPath}?token=${encodeURIComponent(token)}`;

    const res = await probe(finalUrl);
    const dataPresent = res.ok && hasData(res.body);
    const verdict =
      res.status === 403 ? "DENIED (403)"
      : res.status === 401 ? "UNAUTHORIZED"
      : res.status === 429 ? "RATE LIMITED"
      : !res.ok ? `HTTP ${res.status}`
      : dataPresent ? "✅ DATA"
      : "⚠️ EMPTY/NO_DATA";

    const entry = { category: cat, name, tier, status: res.status, verdict, shape: shape(res.body) };
    results.push(entry);

    const tag = verdict.startsWith("✅") ? "✅" : verdict.startsWith("⚠️") ? "⚠️" : "❌";
    console.log(`${tag} [${cat}] ${name} (${tier}) → ${res.status} ${verdict}  |  ${shape(res.body).slice(0, 80)}`);

    // Save individual probe files for key endpoints that returned data
    if (dataPresent && ["Company News", "Press Releases", "Market News (general)",
      "Basic Financials (metric=all)", "Recommendation Trends", "Earnings Surprises",
      "Quote", "Insider Transactions", "Insider Sentiment", "Earnings Calendar",
      "Company Peers", "SEC Filings", "Financials As Reported", "IPO Calendar",
      "Newsroom", "News Sentiment", "Price Target", "Upgrade/Downgrade",
      "Revenue Estimates", "EPS Estimates", "Company Profile 2",
      "Congressional Trading", "Social Sentiment", "Supply Chain",
      "Company ESG Score", "Earnings Quality Score", "Economic Calendar",
      "Stock Candles (D)", "Transcripts List", "ETF Profile (SPY)",
      "USPTO Patents", "Senate Lobbying", "USA Spending", "FDA Calendar",
      "Visa Application (H1B)"
    ].includes(name)) {
      const outDir = path.resolve(repoRoot(), "tmp", "probes");
      fs.mkdirSync(outDir, { recursive: true });
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      const filename = `finnhub_${safeName}_${sym}.json`;
      fs.writeFileSync(path.join(outDir, filename), JSON.stringify(res.body, null, 2), "utf-8");
    }

    await new Promise(r => setTimeout(r, delayMs));
  }

  // Save full results
  const outDir = path.resolve(repoRoot(), "tmp", "probes");
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, "finnhub_comprehensive_probe.json");
  fs.writeFileSync(summaryPath, JSON.stringify({ probeDate: to, symbol: sym, results }, null, 2), "utf-8");

  // Print summary table
  console.log("\n" + "=".repeat(100));
  console.log("SUMMARY");
  console.log("=".repeat(100));

  const groups = { "✅ DATA": [], "⚠️ EMPTY/NO_DATA": [], "DENIED (403)": [], "OTHER": [] };
  for (const r of results) {
    if (r.verdict === "✅ DATA") groups["✅ DATA"].push(r);
    else if (r.verdict === "⚠️ EMPTY/NO_DATA") groups["⚠️ EMPTY/NO_DATA"].push(r);
    else if (r.verdict.includes("403")) groups["DENIED (403)"].push(r);
    else groups["OTHER"].push(r);
  }

  console.log(`\n✅ DATA AVAILABLE (${groups["✅ DATA"].length}):`);
  for (const r of groups["✅ DATA"]) console.log(`  [${r.tier.padEnd(7)}] ${r.name}`);

  console.log(`\n⚠️ EMPTY / NO DATA (${groups["⚠️ EMPTY/NO_DATA"].length}):`);
  for (const r of groups["⚠️ EMPTY/NO_DATA"]) console.log(`  [${r.tier.padEnd(7)}] ${r.name}`);

  console.log(`\n❌ DENIED / 403 (${groups["DENIED (403)"].length}):`);
  for (const r of groups["DENIED (403)"]) console.log(`  [${r.tier.padEnd(7)}] ${r.name}`);

  if (groups["OTHER"].length > 0) {
    console.log(`\n❓ OTHER (${groups["OTHER"].length}):`);
    for (const r of groups["OTHER"]) console.log(`  [${r.tier.padEnd(7)}] ${r.name} → ${r.verdict}`);
  }

  console.log(`\nFull results saved: ${summaryPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err?.stack || String(err));
  process.exitCode = 2;
});
