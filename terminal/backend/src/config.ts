import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: "../.env" });
dotenv.config();

function resolveRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let current = here;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(current, "finhub"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function loadFinnhubApiKey(): string {
  // 1. Environment variable (highest priority)
  const envKey = process.env.FINNHUB_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // 2. File fallback
  const repoRoot = resolveRepoRoot();
  const keyPath = path.join(repoRoot, "finhub", "finhub_api_key", "finhub_api_key");
  try {
    const fileKey = fs.readFileSync(keyPath, "utf8").trim();
    if (fileKey) {
      return fileKey;
    }
  } catch {
    // File not found or unreadable — fall through
  }

  throw new Error(
    "FINNHUB_API_KEY not found. Set env var FINNHUB_API_KEY or place key in finhub/finhub_api_key/finhub_api_key"
  );
}

function loadFmpApiKey(): string {
  // 1. Environment variable
  const envKey = process.env.FMP_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // 2. File fallback
  const repoRoot = resolveRepoRoot();
  const keyPath = path.join(repoRoot, "ai_agent_plan", "fmp_api_key", "fmp_api_key");
  try {
    const fileKey = fs.readFileSync(keyPath, "utf8").trim();
    if (fileKey) {
      return fileKey;
    }
  } catch {
    // File not found or unreadable — fall through
  }

  return ""; // FMP is optional
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  sqlitePath: process.env.SQLITE_PATH ?? "./backend/data/app.db",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5174",
  finnhubApiKey: loadFinnhubApiKey(),
  fmpApiKey: loadFmpApiKey(),
};
