import { htmlToPlainText } from "./fulltextExtractors.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
const SEC_EDGAR_UA = "terminal_sec admin@localhost";

export interface IpoSecInsights {
  companyDescription: string | null;
  ownershipTotalPct: number | null;
  ownershipMaxPct: number | null;
  ownershipHolderCount: number | null;
  ownershipValues: number[];
  documentUrl: string | null;
  sourceNote: string;
}

export interface SecSicInfo {
  sicCode: string | null;
  sicDescription: string | null;
  secIndustry: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(rawText: string): string {
  return rawText
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isHeadingLine(line: string): boolean {
  return /^item\s+\d+\.\d+[a-z]?/i.test(line)
    || /^part\s+[ivx]+/i.test(line)
    || /^(prospectus summary|summary|our company|business|capitalization|principal stockholders|principal shareholders|beneficial ownership)$/i.test(line);
}

function splitIntoParagraphs(rawText: string): string[] {
  const lines = normalizeText(rawText)
    .split("\n")
    .map((line) => line.trim());

  const paragraphs: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    const merged = current.join(" ").replace(/\s+/g, " ").trim();
    if (merged) {
      paragraphs.push(merged);
    }
    current = [];
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (isHeadingLine(line)) {
      flush();
      paragraphs.push(line);
      continue;
    }
    current.push(line);
  }

  flush();
  return paragraphs;
}

function looksLikeBoilerplate(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.length < 60
    || /united states securities and exchange commission/.test(normalized)
    || /subject to completion/.test(normalized)
    || /the information in this preliminary prospectus/.test(normalized)
    || /approximate date of commencement/.test(normalized)
    || /indicate by check mark/.test(normalized)
    || /^signature/.test(normalized)
    || /^table of contents/.test(normalized);
}

function isDescriptionCandidate(text: string): boolean {
  if (looksLikeBoilerplate(text)) {
    return false;
  }

  const normalized = text.toLowerCase();
  return text.length >= 90 && (
    /\bwe (are|develop|provide|operate|offer|build|manufacture|commercialize|focus|specialize)\b/.test(normalized)
    || /\bour (company|platform|business|products|technology|solution|mission)\b/.test(normalized)
    || /\bis a\b/.test(normalized)
  );
}

function takeMaxLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function extractCompanyDescription(paragraphs: string[]): string | null {
  const headingPatterns = [
    /prospectus summary/i,
    /our company/i,
    /^summary$/i,
    /^business$/i,
  ];

  for (let index = 0; index < paragraphs.length; index++) {
    if (!headingPatterns.some((pattern) => pattern.test(paragraphs[index]))) {
      continue;
    }
    for (let nextIndex = index + 1; nextIndex < Math.min(paragraphs.length, index + 8); nextIndex++) {
      const candidate = paragraphs[nextIndex];
      if (isDescriptionCandidate(candidate)) {
        return takeMaxLength(candidate, 420);
      }
      if (nextIndex > index + 1 && isHeadingLine(candidate)) {
        break;
      }
    }
  }

  for (const paragraph of paragraphs.slice(0, 60)) {
    if (isDescriptionCandidate(paragraph)) {
      return takeMaxLength(paragraph, 420);
    }
  }

  return null;
}

function roundTo(value: number, digits: number): number {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function extractOwnershipSection(paragraphs: string[]): string[] {
  const headingPatterns = [
    /principal stockholders/i,
    /principal shareholders/i,
    /beneficial ownership/i,
    /selling stockholders/i,
  ];

  for (let index = 0; index < paragraphs.length; index++) {
    if (!headingPatterns.some((pattern) => pattern.test(paragraphs[index]))) {
      continue;
    }

    const section: string[] = [];
    for (let nextIndex = index; nextIndex < Math.min(paragraphs.length, index + 24); nextIndex++) {
      const candidate = paragraphs[nextIndex];
      if (nextIndex > index && isHeadingLine(candidate)) {
        break;
      }
      section.push(candidate);
    }

    if (section.length > 0) {
      return section;
    }
  }

  return paragraphs.filter((paragraph) => {
    const normalized = paragraph.toLowerCase();
    return /stockholder|shareholder|beneficial/.test(normalized) && /\d{1,3}(?:\.\d+)?\s*%/.test(paragraph);
  }).slice(0, 12);
}

function extractOwnershipStats(paragraphs: string[]): {
  ownershipTotalPct: number | null;
  ownershipMaxPct: number | null;
  ownershipHolderCount: number | null;
  ownershipValues: number[];
} {
  const section = extractOwnershipSection(paragraphs);
  if (section.length === 0) {
    return {
      ownershipTotalPct: null,
      ownershipMaxPct: null,
      ownershipHolderCount: null,
      ownershipValues: [],
    };
  }

  const joined = section.join(" ");
  const seen = new Set<string>();
  const values: number[] = [];
  for (const match of joined.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)) {
    const pct = Number(match[1]);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      continue;
    }
    const key = pct.toFixed(2);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(roundTo(pct, 2));
  }

  values.sort((left, right) => right - left);
  if (values.length === 0) {
    return {
      ownershipTotalPct: null,
      ownershipMaxPct: null,
      ownershipHolderCount: null,
      ownershipValues: [],
    };
  }

  const total = roundTo(values.reduce((sum, value) => sum + value, 0), 2);
  return {
    ownershipTotalPct: total <= 100.5 ? total : null,
    ownershipMaxPct: values[0],
    ownershipHolderCount: values.length,
    ownershipValues: values,
  };
}

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`HTTP ${response.status}`);
        }
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw new Error("fetchWithRetry: unreachable");
}

async function fetchDocumentText(url: string): Promise<string> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const raw = await response.text();
  if (!raw || raw.trim().length < 40) {
    throw new Error("empty-document");
  }

  if (/<html[\s>]/i.test(raw) || /<!doctype html/i.test(raw)) {
    return normalizeText(htmlToPlainText(raw));
  }

  return normalizeText(raw);
}

export async function downloadIpoSecInsights(urls: Array<string | null | undefined>): Promise<IpoSecInsights> {
  const candidates = Array.from(new Set(urls.filter((url): url is string => Boolean(url && url.trim()))));

  for (const url of candidates) {
    try {
      const text = await fetchDocumentText(url);
      const paragraphs = splitIntoParagraphs(text);
      const companyDescription = extractCompanyDescription(paragraphs);
      const ownership = extractOwnershipStats(paragraphs);

      if (companyDescription || ownership.ownershipHolderCount != null) {
        return {
          companyDescription,
          ownershipTotalPct: ownership.ownershipTotalPct,
          ownershipMaxPct: ownership.ownershipMaxPct,
          ownershipHolderCount: ownership.ownershipHolderCount,
          ownershipValues: ownership.ownershipValues,
          documentUrl: url,
          sourceNote: `parsed:${url}`,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    companyDescription: null,
    ownershipTotalPct: null,
    ownershipMaxPct: null,
    ownershipHolderCount: null,
    ownershipValues: [],
    documentUrl: candidates[0] ?? null,
    sourceNote: candidates.length > 0 ? "no-parseable-sec-insights" : "no-document-url",
  };
}

// ---------------------------------------------------------------------------
// SIC code lookup via SEC EDGAR CIK metadata
// ---------------------------------------------------------------------------

const SIC_DIVISION_MAP: Record<string, string> = {
  "01": "Agriculture", "02": "Agriculture", "07": "Agriculture", "08": "Agriculture", "09": "Agriculture",
  "10": "Mining", "12": "Mining", "13": "Mining", "14": "Mining",
  "15": "Construction", "16": "Construction", "17": "Construction",
  "20": "Manufacturing", "21": "Manufacturing", "22": "Manufacturing", "23": "Manufacturing",
  "24": "Manufacturing", "25": "Manufacturing", "26": "Manufacturing", "27": "Manufacturing",
  "28": "Manufacturing", "29": "Manufacturing", "30": "Manufacturing", "31": "Manufacturing",
  "32": "Manufacturing", "33": "Manufacturing", "34": "Manufacturing", "35": "Manufacturing",
  "36": "Manufacturing", "37": "Manufacturing", "38": "Manufacturing", "39": "Manufacturing",
  "40": "Transportation & Utilities", "41": "Transportation & Utilities", "42": "Transportation & Utilities",
  "43": "Transportation & Utilities", "44": "Transportation & Utilities", "45": "Transportation & Utilities",
  "46": "Transportation & Utilities", "47": "Transportation & Utilities", "48": "Transportation & Utilities",
  "49": "Transportation & Utilities",
  "50": "Wholesale Trade", "51": "Wholesale Trade",
  "52": "Retail Trade", "53": "Retail Trade", "54": "Retail Trade", "55": "Retail Trade",
  "56": "Retail Trade", "57": "Retail Trade", "58": "Retail Trade", "59": "Retail Trade",
  "60": "Finance", "61": "Finance", "62": "Finance", "63": "Finance",
  "64": "Finance", "65": "Real Estate", "67": "Finance",
  "70": "Services", "72": "Services", "73": "Services", "75": "Services",
  "76": "Services", "78": "Services", "79": "Services", "80": "Services",
  "81": "Services", "82": "Services", "83": "Services", "84": "Services",
  "86": "Services", "87": "Services", "88": "Services", "89": "Services",
  "91": "Public Administration", "92": "Public Administration", "93": "Public Administration",
  "94": "Public Administration", "95": "Public Administration", "96": "Public Administration",
  "97": "Public Administration", "99": "Non-Classifiable",
};

function mapSicToIndustry(sicCode: string, sicDescription: string | null): string {
  if (sicDescription && sicDescription.trim()) {
    return sicDescription.trim();
  }
  const prefix = sicCode.slice(0, 2);
  return SIC_DIVISION_MAP[prefix] ?? "Other";
}

export async function fetchSecSicByCik(cik: string | null | undefined): Promise<SecSicInfo> {
  const empty: SecSicInfo = { sicCode: null, sicDescription: null, secIndustry: null };
  if (!cik || !cik.trim()) {
    return empty;
  }

  const paddedCik = cik.replace(/^0+/, "").padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": SEC_EDGAR_UA,
          "Accept": "application/json",
        },
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          return empty;
        }
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        return empty;
      }

      const data = await response.json() as Record<string, unknown>;
      const sicCode = data.sic != null ? String(data.sic) : null;
      const sicDescription = typeof data.sicDescription === "string" ? data.sicDescription : null;

      if (!sicCode) {
        return empty;
      }

      return {
        sicCode,
        sicDescription,
        secIndustry: mapSicToIndustry(sicCode, sicDescription),
      };
    } catch {
      if (attempt === MAX_RETRIES) {
        return empty;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  return empty;
}

// ---------------------------------------------------------------------------
// SEC EDGAR direct lookup (bypass FMP dependency)
// ---------------------------------------------------------------------------

let tickerToCikCache: Map<string, string> | null = null;
let tickerToCikCacheExpiry = 0;
const TICKER_CACHE_TTL_MS = 30 * 60 * 1000;

export async function getTickerToCikMap(): Promise<Map<string, string>> {
  if (tickerToCikCache && Date.now() < tickerToCikCacheExpiry) {
    return tickerToCikCache;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": SEC_EDGAR_UA, "Accept": "application/json" },
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          return tickerToCikCache ?? new Map();
        }
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        return tickerToCikCache ?? new Map();
      }

      const data = await response.json() as Record<string, { cik_str: number; ticker: string; title: string }>;
      const map = new Map<string, string>();
      for (const entry of Object.values(data)) {
        if (entry.ticker) {
          map.set(entry.ticker.toUpperCase(), String(entry.cik_str));
        }
      }

      tickerToCikCache = map;
      tickerToCikCacheExpiry = Date.now() + TICKER_CACHE_TTL_MS;
      return map;
    } catch {
      if (attempt === MAX_RETRIES) {
        return tickerToCikCache ?? new Map();
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  return tickerToCikCache ?? new Map();
}

export interface SecEdgarFiling {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  documentUrl: string;
}

export interface SecEdgarSubmissionResult {
  sic: SecSicInfo;
  filings: SecEdgarFiling[];
  companyName: string | null;
}

const IPO_FORM_TYPES = new Set(["S-1", "S-1/A", "F-1", "F-1/A", "424B1", "424B2", "424B3", "424B4"]);

export async function fetchSecEdgarSubmission(cik: string): Promise<SecEdgarSubmissionResult> {
  const empty: SecEdgarSubmissionResult = {
    sic: { sicCode: null, sicDescription: null, secIndustry: null },
    filings: [],
    companyName: null,
  };

  if (!cik || !cik.trim()) {
    return empty;
  }

  const rawCik = cik.replace(/^0+/, "") || cik;
  const paddedCik = rawCik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": SEC_EDGAR_UA, "Accept": "application/json" },
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          return empty;
        }
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        return empty;
      }

      const data = await response.json() as Record<string, unknown>;

      // SIC info
      const sicCode = data.sic != null ? String(data.sic) : null;
      const sicDescription = typeof data.sicDescription === "string" ? data.sicDescription : null;
      const sic: SecSicInfo = sicCode
        ? { sicCode, sicDescription, secIndustry: mapSicToIndustry(sicCode, sicDescription) }
        : { sicCode: null, sicDescription: null, secIndustry: null };

      const companyName = typeof data.name === "string" ? data.name : null;

      // Search recent filings for IPO forms
      const filings: SecEdgarFiling[] = [];
      const filingsObj = data.filings as Record<string, unknown> | undefined;
      const recent = filingsObj?.recent as Record<string, unknown[]> | undefined;

      if (recent?.form) {
        const forms = recent.form as string[];
        const filingDates = (recent.filingDate ?? []) as string[];
        const accessions = (recent.accessionNumber ?? []) as string[];
        const primaryDocs = (recent.primaryDocument ?? []) as string[];

        for (let i = 0; i < forms.length; i++) {
          if (!IPO_FORM_TYPES.has(forms[i])) {
            continue;
          }
          const accession = accessions[i];
          const primaryDoc = primaryDocs[i];
          if (!accession || !primaryDoc) {
            continue;
          }
          filings.push({
            form: forms[i],
            filingDate: filingDates[i] ?? "",
            accessionNumber: accession,
            primaryDocument: primaryDoc,
            documentUrl: `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accession.replace(/-/g, "")}/${primaryDoc}`,
          });
        }
      }

      return { sic, filings, companyName };
    } catch {
      if (attempt === MAX_RETRIES) {
        return empty;
      }
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  return empty;
}