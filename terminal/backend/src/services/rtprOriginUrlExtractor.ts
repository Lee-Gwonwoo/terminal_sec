/**
 * rtprOriginUrlExtractor.ts — Extract original news site URL from RTPR body text.
 *
 * Publisher-specific patterns (confirmed via 2026-03-10 DB sample analysis, 664 rows):
 *
 *   Business Wire (133)  — "View source version on businesswire.com:\nhttps://www.businesswire.com/news/home/{ID}/en/"
 *   PR Newswire   (133)  — "View original content to download\nmultimedia:https://www.prnewswire.com/news-releases/{slug}-{ID}.html"
 *   ACCESSWIRE    (132)  — "View the original press release\n(https://www.accessnewswire.com/newsroom/en/{category}/{slug}-{ID})"
 *   Newsfile Corp  (40)  — "please visit https://www.newsfilecorp.com/release/{ID}"
 *   Globe Newswire(225)  — tracker links only (globenewswire.com/Tracker?data=...), canonical extraction not possible
 *   Cision          (1)  — "https://news.cision.com/{company}/r/{slug}%2C{ID}"
 */

// ── URL pattern matchers (order matters: most specific first) ──

const PATTERNS: { name: string; regex: RegExp }[] = [
  // Business Wire: "View source version on businesswire.com:" followed by bare URL
  {
    name: "BusinessWire",
    regex: /View source version on businesswire\.com:\s*(https?:\/\/www\.businesswire\.com\/news\/home\/\S+)/i,
  },
  // PR Newswire: "multimedia:" prefix before URL (handles .com, .co.uk, etc.)
  {
    name: "PRNewswire",
    regex: /multimedia:(https?:\/\/www\.prnewswire\.(?:com|co\.uk|co\.[a-z]+)\/news-releases\/[^\s()]+)/i,
  },
  // PR Newswire fallback: bare URL without "multimedia:" prefix
  {
    name: "PRNewswire-bare",
    regex: /(https?:\/\/www\.prnewswire\.(?:com|co\.uk|co\.[a-z]+)\/news-releases\/[^\s()]+\.html)/i,
  },
  // ACCESSWIRE: "View the original press release" followed by parenthesized URL
  // Domain changed from accesswire.com to accessnewswire.com
  {
    name: "ACCESSWIRE",
    regex: /View the original press release[^(]*\(?(https?:\/\/www\.accessnewswire\.com\/newsroom\/[^\s()]+)/i,
  },
  // Newsfile Corp: "please visit https://www.newsfilecorp.com/release/..."
  {
    name: "Newsfile",
    regex: /please visit\s+(https?:\/\/www\.newsfilecorp\.com\/release\/\S+)/i,
  },
  // Cision: bare URL "https://news.cision.com/..."
  {
    name: "Cision",
    regex: /(https?:\/\/news\.cision\.com\/[^\s()]+)/i,
  },
];

// Fallback: scan for bare canonical URLs from known wire service domains
// (no href required — matches plain text URLs)
const FALLBACK_URL_REGEX = /(https?:\/\/(?:www\.)?(?:accessnewswire\.com\/newsroom|prnewswire\.(?:com|co\.[a-z]+)\/news-releases|newsfilecorp\.com\/release|businesswire\.com\/news\/home|news\.cision\.com)\/[^\s()<>"']+)/gi;

/**
 * Extract the original press release URL from RTPR body text (HTML or plain text).
 * Returns `null` if no reliable URL could be found.
 */
export function extractOriginUrl(body: string): string | null {
  if (!body) return null;

  // Try specific patterns first
  for (const pattern of PATTERNS) {
    const match = body.match(pattern.regex);
    if (match?.[1]) {
      return cleanUrl(match[1]);
    }
  }

  // Fallback: scan the last portion for known wire service canonical URLs
  const tail = body.slice(-3000);
  const allMatches: string[] = [];
  let m: RegExpExecArray | null;
  const fallbackRe = new RegExp(FALLBACK_URL_REGEX.source, FALLBACK_URL_REGEX.flags);
  while ((m = fallbackRe.exec(tail)) !== null) {
    allMatches.push(m[1]);
  }
  // Return the last match (closest to footer), if any
  if (allMatches.length > 0) {
    return cleanUrl(allMatches[allMatches.length - 1]);
  }

  return null;
}

/** Strip trailing punctuation/HTML artifacts from extracted URL */
function cleanUrl(url: string): string {
  return url
    .replace(/[<>"'\s)]+$/, "")  // trim trailing HTML artifacts and closing parens
    .replace(/&amp;/g, "&")
    .replace(/%2C/gi, ",");       // decode common URL-encoded chars (Cision uses %2C)
}
