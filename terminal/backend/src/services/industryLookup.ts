/**
 * industryLookup.ts
 * CSV 기반 ticker → Industry 매핑.
 * tradigview_screener/original_data/watch lists2_*.csv 에서 Symbol → Industry 를 로드한다.
 */

import fs from "node:fs";
import path from "node:path";

/** backend/ 루트를 기준으로 repo root 찾기 (dev: src/, prod: dist/src/ 모두 대응) */
function findRepoRoot(): string {
  let cur = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(cur, "tradigview_screener"))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(__dirname, "../../../..");
}

let industryMap: Map<string, string> | null = null;

function loadCsv(): Map<string, string> {
  const dir = path.join(findRepoRoot(), "tradigview_screener", "original_data");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.startsWith("watch lists2") && f.endsWith(".csv"))
    : [];
  if (files.length === 0) return new Map();

  // 가장 최근 파일 사용 (파일명 날짜 내림차순)
  files.sort().reverse();
  const csvPath = path.join(dir, files[0]);
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return new Map();

  // 헤더 파싱 (quoted fields 대응)
  const headers = parseCsvRow(lines[0]);
  const symbolIdx = headers.findIndex((h) => h.trim().toLowerCase() === "symbol");
  const industryIdx = headers.findIndex((h) => h.trim().toLowerCase() === "industry");
  if (symbolIdx < 0 || industryIdx < 0) return new Map();

  const map = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const sym = cols[symbolIdx]?.trim();
    const ind = cols[industryIdx]?.trim();
    if (sym && ind) map.set(sym.toUpperCase(), ind);
  }
  return map;
}

/** 간이 CSV row 파서 — quoted fields 지원 */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * ticker의 Industry를 반환한다.
 * CSV에서 찾지 못하면 null.
 * 첫 호출 시 CSV를 lazy-load하고 메모리에 캐시한다.
 */
export function getIndustry(ticker: string): string | null {
  if (!industryMap) industryMap = loadCsv();
  // news ticker 형식: "AAPL" or "AAPL.US" — 점 이전만 사용
  const sym = ticker.split(".")[0].toUpperCase();
  return industryMap.get(sym) ?? null;
}

/** 캐시 초기화 (CSV 변경 후 리로드용) */
export function reloadIndustryCache(): void {
  industryMap = null;
}
