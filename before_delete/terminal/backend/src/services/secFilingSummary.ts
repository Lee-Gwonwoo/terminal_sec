import { htmlToPlainText } from "./fulltextExtractors.js";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
const SUMMARY_MAX_CHARS = 420;

export interface SecFilingSummaryInput {
  symbol: string;
  cik: string;
  formType: string;
  filingDate: string;
  acceptedDate: string;
  link: string;
  finalLink: string;
}

export interface SecFilingSummaryResult {
  summary: string;
  source: "filing-text" | "metadata-fallback";
  note: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function buildSecFilingMetadataSummary(input: SecFilingSummaryInput): string {
  const filedDate = input.filingDate.slice(0, 10);
  const acceptedAt = input.acceptedDate.replace("T", " ");
  return `Filed ${filedDate}, accepted ${acceptedAt}. CIK: ${input.cik}.`;
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
    || /^(forward-looking statements|signature|signatures|table of contents)$/i.test(line)
    || /^part\s+[ivx]+/i.test(line);
}

function splitIntoParagraphs(rawText: string): string[] {
  const lines = normalizeText(rawText)
    .split("\n")
    .map((line) => line.trim());

  const paragraphs: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const merged = current.join(" ").replace(/\s+/g, " ").trim();
    if (merged) paragraphs.push(merged);
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

function stripLeadingMetadata(text: string): string {
  return text
    .replace(/^item\s+\d+\.\d+[a-z]?\s*/i, "")
    .replace(/^form\s+[a-z0-9\-/]+\s*/i, "")
    .replace(/^\(?exact name of registrant as specified in its charter\)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMostlyUppercase(text: string): boolean {
  const letters = text.match(/[A-Za-z]/g) ?? [];
  if (letters.length < 12) return false;
  const upper = letters.filter((char) => char === char.toUpperCase()).length;
  return upper / letters.length > 0.72;
}

function looksLikeInlineXbrl(text: string): boolean {
  const colonTokenCount = (text.match(/\b[a-z][a-z0-9_-]*:[A-Za-z0-9_\-]+\b/g) ?? []).length;
  const longTokenCount = text
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length >= 30).length;
  const digitCount = (text.match(/\d/g) ?? []).length;
  const letterCount = (text.match(/[A-Za-z]/g) ?? []).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return colonTokenCount >= 2
    || longTokenCount >= 3
    || wordCount <= 4
    || (digitCount > 0 && letterCount > 0 && digitCount / Math.max(letterCount, 1) > 0.45);
}

function isBoilerplateParagraph(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.length < 40
    || /united states securities and exchange commission/.test(normalized)
    || /washington, d\.c\. 20549/.test(normalized)
    || /^commission file number/.test(normalized)
    || /telephone number, including area code/.test(normalized)
    || /securities registered pursuant to section 12\(/.test(normalized)
    || /indicate by check mark/.test(normalized)
    || /well-known seasoned issuer/.test(normalized)
    || /large accelerated filer|accelerated filer|non-accelerated filer/.test(normalized)
    || /^check the appropriate box/.test(normalized)
    || /pursuant to the requirements of the securities exchange act/.test(normalized)
    || /the information in this (preliminary )?prospectus supplement is not complete/.test(normalized)
    || /subject to completion/.test(normalized)
    || /forward-looking statements/.test(normalized)
    || /^signature/.test(normalized)
    || /^signatures$/.test(normalized)
    || looksLikeInlineXbrl(text)
    || isMostlyUppercase(text);
}

function isInformativeParagraph(text: string): boolean {
  const cleaned = stripLeadingMetadata(text);
  if (cleaned.length < 60) return false;
  if (isBoilerplateParagraph(cleaned)) return false;
  return /[a-z]/i.test(cleaned);
}

function sentenceSplit(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function takeLeadingSentences(text: string, maxSentences: number): string {
  const sentences = sentenceSplit(text);
  if (sentences.length === 0) return text.trim();
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function collectItemSections(paragraphs: string[]): string[] {
  const sections: string[] = [];

  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index];
    if (!/^item\s+\d+\.\d+[a-z]?/i.test(paragraph)) continue;

    const heading = stripLeadingMetadata(paragraph);
    let body = "";
    for (let nextIndex = index + 1; nextIndex < Math.min(paragraphs.length, index + 4); nextIndex++) {
      const candidate = paragraphs[nextIndex];
      if (/^item\s+\d+\.\d+[a-z]?/i.test(candidate) || /^signature/i.test(candidate)) break;
      if (isInformativeParagraph(candidate)) {
        body = takeLeadingSentences(candidate, 2);
        break;
      }
    }

    if (body) {
      sections.push(heading ? `${heading}: ${body}` : body);
    } else if (isInformativeParagraph(paragraph)) {
      sections.push(takeLeadingSentences(stripLeadingMetadata(paragraph), 2));
    }
  }

  return sections;
}

function collectOfferingSections(paragraphs: string[]): string[] {
  const keywordPattern = /offering|prospectus|sales agreement|common stock|ordinary shares|gross proceeds|underwriter|at-the-market|warrants?/i;
  return paragraphs
    .filter((paragraph) => keywordPattern.test(paragraph) && isInformativeParagraph(paragraph))
    .map((paragraph) => takeLeadingSentences(stripLeadingMetadata(paragraph), 2));
}

function collectGenericSections(paragraphs: string[]): string[] {
  return paragraphs
    .filter((paragraph) => isInformativeParagraph(paragraph))
    .map((paragraph) => takeLeadingSentences(stripLeadingMetadata(paragraph), 2));
}

function joinSummaryParts(parts: string[]): string | null {
  const uniqueParts = Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean)));
  if (uniqueParts.length === 0) return null;

  const selected: string[] = [];
  let total = 0;
  for (const part of uniqueParts) {
    const nextTotal = total + (selected.length > 0 ? 1 : 0) + part.length;
    if (selected.length > 0 && nextTotal > SUMMARY_MAX_CHARS) break;
    if (selected.length === 0 && part.length > SUMMARY_MAX_CHARS) {
      selected.push(part.slice(0, SUMMARY_MAX_CHARS - 1).trimEnd() + "…");
      return selected.join(" ");
    }
    selected.push(part);
    total = nextTotal;
    if (selected.length >= 3) break;
  }

  return selected.join(" ").trim() || null;
}

export function summarizeSecDocumentText(formType: string, rawText: string): string | null {
  const paragraphs = splitIntoParagraphs(rawText);
  const normalizedForm = formType.toUpperCase();

  if (normalizedForm.startsWith("8-K")) {
    return joinSummaryParts(collectItemSections(paragraphs).concat(collectGenericSections(paragraphs)));
  }

  if (/(424B|S-1|S-3|F-1|FWP)/.test(normalizedForm)) {
    return joinSummaryParts(collectOfferingSections(paragraphs).concat(collectGenericSections(paragraphs)));
  }

  return joinSummaryParts(collectGenericSections(paragraphs));
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
    return htmlToPlainText(raw);
  }

  return normalizeText(raw);
}

export async function generateSecFilingSummary(input: SecFilingSummaryInput): Promise<SecFilingSummaryResult> {
  const metadataFallback = buildSecFilingMetadataSummary(input);
  const urls = Array.from(new Set([input.finalLink, input.link].filter(Boolean)));

  for (const url of urls) {
    try {
      const text = await fetchDocumentText(url);
      const summary = summarizeSecDocumentText(input.formType, text);
      if (summary && summary.length >= 60) {
        return {
          summary,
          source: "filing-text",
          note: `ok:${url === input.finalLink ? "finalLink" : "link"}`,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    summary: metadataFallback,
    source: "metadata-fallback",
    note: "fallback:metadata",
  };
}