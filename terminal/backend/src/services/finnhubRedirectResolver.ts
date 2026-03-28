const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_BASE_DELAY_MS = 100;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ResolveFinnhubNewsOriginUrlOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

export function isFinnhubNewsRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === "finnhub.io"
      && parsed.pathname === "/api/news"
      && parsed.searchParams.has("id");
  } catch {
    return false;
  }
}

export async function resolveFinnhubNewsOriginUrl(
  url: string,
  options?: ResolveFinnhubNewsOriginUrlOptions,
): Promise<string | null> {
  if (!isFinnhubNewsRedirectUrl(url)) {
    return null;
  }

  const maxRetries = Math.max(1, options?.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxRetries) {
          return null;
        }
        await sleep(baseDelayMs * attempt);
        continue;
      }

      const location = res.headers.get("location");
      return location ? new URL(location, url).toString() : null;
    } catch {
      if (attempt === maxRetries) {
        return null;
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  return null;
}