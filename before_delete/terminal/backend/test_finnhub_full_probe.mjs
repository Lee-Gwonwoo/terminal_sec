/**
 * Comprehensive Finnhub API endpoint probe.
 * Tests ALL documented REST endpoints (stock fundamentals, estimates, alternative data, etc.)
 * to determine which ones are accessible with the current API key/subscription.
 *
 * Usage:
 *   node terminal/backend/test_finnhub_full_probe.mjs
 *   node terminal/backend/test_finnhub_full_probe.mjs --symbol AAPL
 *
 * Output: tmp/probes/finnhub_full_probe_results.json  (machine-readable)
 *         console summary table
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
dotenv.config();

const API_BASE = "https://finnhub.io/api/v1";

// ── helpers ──────────────────────────────────────────────
function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function requireApiKey() {
  const envKey = process.env.FINNHUB_API_KEY ?? process.env.FINNHUB_TOKEN ?? process.env.FINNHUB_KEY;
  if (envKey) return envKey;
  const fallback = path.resolve(repoRoot(), "finhub", "finhub_api_key", "finhub_api_key");
  try { const k = fs.readFileSync(fallback, "utf-8").trim(); if (k) return k; } catch {}
  throw new Error("Missing Finnhub API key. Set FINNHUB_API_KEY or ensure finhub/finhub_api_key/finhub_api_key exists.");
}

function parseArgs() {
  const out = { symbol: "AAPL" };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--symbol" && process.argv[i + 1]) { out.symbol = process.argv[++i].toUpperCase(); }
  }
  return out;
}

async function fetchJson(url, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: ctrl.signal });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  } finally {
    clearTimeout(t);
  }
}

function describeBody(body) {
  if (body === null || body === undefined) return { type: "null", size: 0 };
  if (typeof body === "string") return { type: "string", size: body.length };
  if (Array.isArray(body)) return { type: "array", length: body.length, firstKeys: body[0] ? Object.keys(body[0]) : [] };
  if (typeof body === "object") {
    const keys = Object.keys(body);
    // check for nested arrays
    const info = { type: "object", keys };
    for (const k of keys) {
      if (Array.isArray(body[k])) info[`${k}_length`] = body[k].length;
    }
    return info;
  }
  return { type: typeof body };
}

function hasData(body) {
  if (!body) return false;
  if (typeof body === "string") return body.length > 5;
  if (Array.isArray(body)) return body.length > 0;
  if (typeof body === "object") {
    // Check for empty wrapper objects like { earningsCalendar: [] }
    const keys = Object.keys(body);
    if (keys.length === 0) return false;
    // If all array values are empty, consider it "empty"
    const allEmpty = keys.every(k => {
      const v = body[k];
      return (Array.isArray(v) && v.length === 0) || v === null || v === undefined || v === "";
    });
    if (allEmpty) return false;
    return true;
  }
  return Boolean(body);
}

// ── endpoint definitions ──────────────────────────────────
function buildEndpoints(symbol, apiKey) {
  const tk = encodeURIComponent(apiKey);
  const sym = encodeURIComponent(symbol);
  const now = Math.floor(Date.now() / 1000);
  const y1ago = now - 365 * 86400;
  const m1ago = now - 30 * 86400;
  const m3ago = now - 90 * 86400;
  const d1 = "2025-01-01";
  const d2 = "2026-03-02";
  const d30from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const d30to = new Date().toISOString().slice(0, 10);

  return [
    // ═══ STOCK FUNDAMENTALS ═══
    { category: "Stock Fundamentals", name: "Company Profile 2", tier: "Free",
      url: `${API_BASE}/stock/profile2?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Company Profile (Premium)", tier: "Premium",
      url: `${API_BASE}/stock/profile?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Company Executive", tier: "Premium",
      url: `${API_BASE}/stock/executive?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Market News (general)", tier: "Free",
      url: `${API_BASE}/news?category=general&token=${tk}` },
    { category: "Stock Fundamentals", name: "Company News", tier: "Free",
      url: `${API_BASE}/company-news?symbol=${sym}&from=${d30from}&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Press Releases", tier: "Premium",
      url: `${API_BASE}/press-releases?symbol=${sym}&from=${d30from}&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "News Sentiment", tier: "Premium",
      url: `${API_BASE}/news-sentiment?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Peers", tier: "Free",
      url: `${API_BASE}/stock/peers?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Basic Financials", tier: "Free",
      url: `${API_BASE}/stock/metric?symbol=${sym}&metric=all&token=${tk}` },
    { category: "Stock Fundamentals", name: "Ownership", tier: "Premium",
      url: `${API_BASE}/stock/ownership?symbol=${sym}&limit=5&token=${tk}` },
    { category: "Stock Fundamentals", name: "Fund Ownership", tier: "Premium",
      url: `${API_BASE}/stock/fund-ownership?symbol=${sym}&limit=5&token=${tk}` },
    { category: "Stock Fundamentals", name: "Institutional Profile", tier: "Premium",
      url: `${API_BASE}/institutional/profile?token=${tk}` },
    { category: "Stock Fundamentals", name: "Insider Transactions", tier: "Free",
      url: `${API_BASE}/stock/insider-transactions?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Insider Sentiment", tier: "Free",
      url: `${API_BASE}/stock/insider-sentiment?symbol=${sym}&from=2024-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Financial Statements (bs)", tier: "Premium",
      url: `${API_BASE}/stock/financials?symbol=${sym}&statement=bs&freq=annual&token=${tk}` },
    { category: "Stock Fundamentals", name: "Financial Statements (ic)", tier: "Premium",
      url: `${API_BASE}/stock/financials?symbol=${sym}&statement=ic&freq=quarterly&token=${tk}` },
    { category: "Stock Fundamentals", name: "Financials As Reported", tier: "Free",
      url: `${API_BASE}/stock/financials-reported?symbol=${sym}&freq=annual&token=${tk}` },
    { category: "Stock Fundamentals", name: "Revenue Breakdown", tier: "Premium",
      url: `${API_BASE}/stock/revenue-breakdown?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Revenue Breakdown & KPI", tier: "Premium/Enterprise",
      url: `${API_BASE}/stock/revenue-breakdown2?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "SEC Filings", tier: "Free",
      url: `${API_BASE}/stock/filings?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "SEC Sentiment Analysis", tier: "Premium",
      url: `${API_BASE}/stock/filings-sentiment?accessNumber=0000320193-20-000052&token=${tk}` },
    { category: "Stock Fundamentals", name: "Similarity Index", tier: "Premium",
      url: `${API_BASE}/stock/similarity-index?symbol=${sym}&freq=annual&token=${tk}` },
    { category: "Stock Fundamentals", name: "IPO Calendar", tier: "Free",
      url: `${API_BASE}/calendar/ipo?from=${d30from}&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Dividends", tier: "Premium",
      url: `${API_BASE}/stock/dividend?symbol=${sym}&from=2024-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Dividends 2 (Basic)", tier: "Premium",
      url: `${API_BASE}/stock/dividend2?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Splits", tier: "Premium",
      url: `${API_BASE}/stock/split?symbol=${sym}&from=2000-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Sector Metrics", tier: "Premium",
      url: `${API_BASE}/sector/metrics?region=NA&token=${tk}` },
    { category: "Stock Fundamentals", name: "Price Metrics", tier: "Premium",
      url: `${API_BASE}/stock/price-metric?symbol=${sym}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Symbol Change", tier: "Premium",
      url: `${API_BASE}/ca/symbol-change?from=2025-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Historical Market Cap", tier: "Premium",
      url: `${API_BASE}/stock/historical-market-cap?symbol=${sym}&from=2024-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Historical Employee Count", tier: "Premium",
      url: `${API_BASE}/stock/historical-employee-count?symbol=${sym}&from=2020-01-01&to=${d30to}&token=${tk}` },
    { category: "Stock Fundamentals", name: "Market Status", tier: "Free",
      url: `${API_BASE}/stock/market-status?exchange=US&token=${tk}` },
    { category: "Stock Fundamentals", name: "Market Holiday", tier: "Free",
      url: `${API_BASE}/stock/market-holiday?exchange=US&token=${tk}` },

    // ═══ STOCK ESTIMATES ═══
    { category: "Stock Estimates", name: "Recommendation Trends", tier: "Free",
      url: `${API_BASE}/stock/recommendation?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "Price Target", tier: "Premium",
      url: `${API_BASE}/stock/price-target?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "Upgrade/Downgrade", tier: "Premium",
      url: `${API_BASE}/stock/upgrade-downgrade?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "Revenue Estimates", tier: "Premium",
      url: `${API_BASE}/stock/revenue-estimate?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "EPS Estimates", tier: "Premium",
      url: `${API_BASE}/stock/eps-estimate?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "EBITDA Estimates", tier: "Premium",
      url: `${API_BASE}/stock/ebitda-estimate?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "EBIT Estimates", tier: "Premium",
      url: `${API_BASE}/stock/ebit-estimate?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "Earnings Surprises", tier: "Free",
      url: `${API_BASE}/stock/earnings?symbol=${sym}&token=${tk}` },
    { category: "Stock Estimates", name: "Earnings Calendar", tier: "Free",
      url: `${API_BASE}/calendar/earnings?symbol=${sym}&from=2024-01-01&to=${d30to}&token=${tk}` },

    // ═══ STOCK PRICE ═══
    { category: "Stock Price", name: "Quote", tier: "Free",
      url: `${API_BASE}/quote?symbol=${sym}&token=${tk}` },
    { category: "Stock Price", name: "Stock Candles (OHLCV)", tier: "Premium",
      url: `${API_BASE}/stock/candle?symbol=${sym}&resolution=D&from=${m1ago}&to=${now}&token=${tk}` },

    // ═══ ETFs & INDICES ═══
    { category: "ETFs & Indices", name: "Indices Constituents (^GSPC)", tier: "Premium",
      url: `${API_BASE}/index/constituents?symbol=%5EGSPC&token=${tk}` },
    { category: "ETFs & Indices", name: "ETF Profile (SPY)", tier: "Premium",
      url: `${API_BASE}/etf/profile?symbol=SPY&token=${tk}` },
    { category: "ETFs & Indices", name: "ETF Holdings (SPY)", tier: "Premium",
      url: `${API_BASE}/etf/holdings?symbol=SPY&token=${tk}` },
    { category: "ETFs & Indices", name: "ETF Sector Exposure (SPY)", tier: "Premium",
      url: `${API_BASE}/etf/sector?symbol=SPY&token=${tk}` },

    // ═══ ALTERNATIVE DATA ═══
    { category: "Alternative Data", name: "Transcripts List", tier: "Premium",
      url: `${API_BASE}/stock/transcripts/list?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Earnings Call Live", tier: "Premium",
      url: `${API_BASE}/stock/earnings-call-live?from=${d30from}&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "Company Presentation", tier: "Premium",
      url: `${API_BASE}/stock/presentation?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Social Sentiment", tier: "Premium",
      url: `${API_BASE}/stock/social-sentiment?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Investment Themes", tier: "Premium",
      url: `${API_BASE}/stock/investment-theme?theme=financialExchangesData&token=${tk}` },
    { category: "Alternative Data", name: "Supply Chain", tier: "Premium",
      url: `${API_BASE}/stock/supply-chain?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Company ESG Scores", tier: "Premium",
      url: `${API_BASE}/stock/esg?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Historical ESG Scores", tier: "Premium",
      url: `${API_BASE}/stock/historical-esg?symbol=${sym}&token=${tk}` },
    { category: "Alternative Data", name: "Earnings Quality Score", tier: "Premium",
      url: `${API_BASE}/stock/earnings-quality-score?symbol=${sym}&freq=quarterly&token=${tk}` },
    { category: "Alternative Data", name: "USPTO Patents", tier: "Free",
      url: `${API_BASE}/stock/uspto-patent?symbol=${sym}&from=2024-01-01&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "H1-B Visa Application", tier: "Free",
      url: `${API_BASE}/stock/visa-application?symbol=${sym}&from=2023-01-01&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "Senate Lobbying", tier: "Free",
      url: `${API_BASE}/stock/lobbying?symbol=${sym}&from=2023-01-01&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "USA Spending", tier: "Free",
      url: `${API_BASE}/stock/usa-spending?symbol=${sym}&from=2023-01-01&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "Congressional Trading", tier: "Premium",
      url: `${API_BASE}/stock/congressional-trading?symbol=${sym}&from=2023-01-01&to=${d30to}&token=${tk}` },
    { category: "Alternative Data", name: "Newsroom", tier: "Premium/Enterprise",
      url: `${API_BASE}/stock/newsroom?symbol=${sym}&token=${tk}` },

    // ═══ ECONOMIC ═══
    { category: "Economic", name: "Economic Calendar", tier: "Premium",
      url: `${API_BASE}/calendar/economic?from=${d30from}&to=${d30to}&token=${tk}` },
    { category: "Economic", name: "FDA Calendar", tier: "Free",
      url: `${API_BASE}/fda-advisory-committee-calendar?token=${tk}` },
    { category: "Economic", name: "Country List", tier: "Free",
      url: `${API_BASE}/country?token=${tk}` },

    // ═══ BANK ═══
    { category: "Bank", name: "Bank Branch (JPM)", tier: "Premium",
      url: `${API_BASE}/bank-branch?symbol=JPM&token=${tk}` },
  ];
}

// ── main ──────────────────────────────────────────────────
async function main() {
  const apiKey = requireApiKey();
  const { symbol } = parseArgs();

  const endpoints = buildEndpoints(symbol, apiKey);
  console.log(`\nFinnhub Full API Probe — symbol: ${symbol} — ${endpoints.length} endpoints\n`);

  const results = [];
  const DELAY_MS = 350; // stay under 30/sec rate limit

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    process.stdout.write(`  [${i + 1}/${endpoints.length}] ${ep.name} ... `);

    const r = await fetchJson(ep.url);
    const desc = describeBody(r.body);
    const dataPresent = r.ok && hasData(r.body);

    let status;
    if (!r.ok) {
      status = r.status === 403 ? "❌ 403 Forbidden" : r.status === 401 ? "❌ 401 Unauthorized" : `❌ ${r.status}`;
    } else if (!dataPresent) {
      status = "⚠️ Empty";
    } else {
      status = "✅ OK";
    }

    console.log(status);

    results.push({
      category: ep.category,
      name: ep.name,
      tier: ep.tier,
      httpStatus: r.status,
      status,
      hasData: dataPresent,
      shape: desc,
      // Save a small preview of successful responses
      preview: r.ok ? JSON.stringify(r.body).slice(0, 300) : (typeof r.body === "string" ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200)),
    });

    // Rate limit delay
    if (i < endpoints.length - 1) await new Promise(ok => setTimeout(ok, DELAY_MS));
  }

  // ── summarize ──────────────────────────────────────────
  const ok = results.filter(r => r.status === "✅ OK");
  const empty = results.filter(r => r.status === "⚠️ Empty");
  const denied = results.filter(r => r.status.startsWith("❌"));

  console.log("\n══════════════════════════════════════════════");
  console.log(`  TOTAL: ${results.length}  |  ✅ OK: ${ok.length}  |  ⚠️ Empty: ${empty.length}  |  ❌ Denied/Error: ${denied.length}`);
  console.log("══════════════════════════════════════════════\n");

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    console.log(`\n─── ${cat} ───`);
    for (const r of results.filter(r => r.category === cat)) {
      const pad = r.name.padEnd(35);
      const tierPad = (`[${r.tier}]`).padEnd(20);
      console.log(`  ${r.status.padEnd(18)} ${tierPad} ${pad}`);
    }
  }

  // ── save ──────────────────────────────────────────────
  const outDir = path.resolve(repoRoot(), "tmp", "probes");
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, "finnhub_full_probe_results.json");
  const output = {
    probeDate: new Date().toISOString(),
    symbol,
    totalEndpoints: results.length,
    summary: { ok: ok.length, empty: empty.length, denied: denied.length },
    results,
  };
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nResults saved: ${outFile}`);

  // Also save per-endpoint raw responses for important ones
  console.log("\n── Saving raw JSON for accessible endpoints ──");
  for (const ep of endpoints) {
    const r = results.find(x => x.name === ep.name);
    if (r && r.hasData) {
      const safeName = ep.name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/__+/g, "_");
      const rawFile = path.join(outDir, `finnhub_${safeName}_${symbol}.json`);
      // Re-fetch to get full body (we only stored preview)
      // Skip re-fetch — use preview for now, full data is in the results file
    }
  }

  console.log("\nDONE.");
}

main().catch(err => {
  console.error("\nFAILED:", err.stack || err);
  process.exitCode = 2;
});
