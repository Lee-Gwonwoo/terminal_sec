import { htmlToPlainText } from "./fulltextExtractors.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";

export interface IpoSecInsights {
  companyDescription: string | null;
  ownershipTotalPct: number | null;
  ownershipMaxPct: number | null;
  ownershipHolderCount: number | null;
  ownershipValues: number[];
  documentUrl: string | null;
  sourceNote: string;
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