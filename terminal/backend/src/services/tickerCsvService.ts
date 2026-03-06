import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// ---------- Security / Policy ----------

const ALLOWED_EXTENSIONS = [".csv"];
const TICKER_PATTERN = /^[A-Z0-9.\-]{1,20}$/;

function resolveRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(current, "tradigview_screener");
    if (fs.existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

const REPO_ROOT = resolveRepoRoot();
const ALLOWLIST_ROOT = path.resolve(REPO_ROOT, "tradigview_screener", "original_data");

function validateCsvPath(csvPath: string): string {
  const resolved = path.resolve(REPO_ROOT, csvPath);
  const normalised = path.normalize(resolved);

  if (!normalised.startsWith(ALLOWLIST_ROOT)) {
    throw new CsvServiceError(`Path not allowed. Must be under ${ALLOWLIST_ROOT}`);
  }

  const ext = path.extname(normalised).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new CsvServiceError(`Only .csv files allowed (got ${ext})`);
  }

  if (normalised.includes("..")) {
    throw new CsvServiceError("Path traversal (..) not allowed");
  }

  return normalised;
}

function normalizeTicker(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!TICKER_PATTERN.test(trimmed)) {
    throw new CsvServiceError(`Invalid ticker format: "${raw}"`);
  }
  return trimmed;
}

// ---------- Error ----------

export class CsvServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvServiceError";
  }
}

// ---------- Read ----------

function detectTickerColumn(headerRow: string): string {
  const headers = headerRow.split(",").map((h) => h.trim());
  for (const candidate of ["Ticker", "Symbol", "ticker", "symbol", "TICKER", "SYMBOL"]) {
    if (headers.includes(candidate)) {
      return candidate;
    }
  }
  throw new CsvServiceError(`No ticker/symbol column found in header: ${headers.join(", ")}`);
}

export function readTickersFromCsv(csvPath: string): { tickers: string[]; resolvedPath: string } {
  const resolved = validateCsvPath(csvPath);

  if (!fs.existsSync(resolved)) {
    throw new CsvServiceError(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(resolved, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    throw new CsvServiceError("CSV file is empty");
  }

  const headerRow = lines[0];
  const tickerCol = detectTickerColumn(headerRow);
  const headers = headerRow.split(",").map((h) => h.trim());
  const colIndex = headers.indexOf(tickerCol);

  const tickers: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const raw = cols[colIndex]?.trim() ?? "";
    if (raw !== "" && TICKER_PATTERN.test(raw.toUpperCase())) {
      tickers.push(raw.toUpperCase());
    }
  }

  return { tickers, resolvedPath: resolved };
}

// ---------- Append ----------

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function appendTickerToCsv(
  csvPath: string,
  ticker: string,
): Promise<{ tickers: string[]; tickerAdded: string; resolvedPath: string }> {
  const resolved = validateCsvPath(csvPath);
  const normalizedTicker = normalizeTicker(ticker);

  if (!fs.existsSync(resolved)) {
    throw new CsvServiceError(`CSV file not found: ${csvPath}`);
  }

  // Read current content
  const content = fs.readFileSync(resolved, "utf8");
  const lines = content.split(/\r?\n/);

  if (lines.length === 0 || lines[0].trim() === "") {
    throw new CsvServiceError("CSV file is empty or has no header");
  }

  const headerRow = lines[0];
  const tickerCol = detectTickerColumn(headerRow);
  const headers = headerRow.split(",").map((h) => h.trim());
  const colIndex = headers.indexOf(tickerCol);
  const numColumns = headers.length;

  // Check duplicate
  const existingTickers = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const raw = cols[colIndex]?.trim() ?? "";
    if (raw !== "") {
      existingTickers.add(raw.toUpperCase());
    }
  }

  if (existingTickers.has(normalizedTicker)) {
    throw new CsvServiceError(`Ticker "${normalizedTicker}" already exists in ${csvPath}`);
  }

  // Build new row — ticker in the correct column, rest empty
  const newCols = new Array(numColumns).fill("");
  newCols[colIndex] = normalizedTicker;
  const newRow = newCols.join(",");

  // Ensure file ends with newline, then append
  const trimmedContent = content.endsWith("\n") ? content : content + "\n";
  const newContent = trimmedContent + newRow + "\n";

  // Atomic write with retries (Windows lock resilience)
  const tmpPath = resolved + `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      fs.writeFileSync(tmpPath, newContent, "utf8");
      fs.renameSync(tmpPath, resolved);
      break;
    } catch (err: any) {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch { /* ignore */ }

      const isTransient = err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES";
      if (!isTransient || attempt === MAX_RETRIES) {
        throw new CsvServiceError(`Failed to write CSV after ${attempt} attempts: ${err.message}`);
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  // Re-read for updated list
  const result = readTickersFromCsv(csvPath);
  return { tickers: result.tickers, tickerAdded: normalizedTicker, resolvedPath: result.resolvedPath };
}
