const DEFAULT_FINNHUB_COMPANY_DATA_INTERVAL_MS = 1500;
const MAX_FINNHUB_COMPANY_DATA_INTERVAL_MS = 10_000;
const DEFAULT_FINNHUB_COMPANY_DATA_CONCURRENCY = 1;
const MAX_FINNHUB_COMPANY_DATA_CONCURRENCY = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clampFinnhubCompanyDataIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FINNHUB_COMPANY_DATA_INTERVAL_MS;
  }
  return Math.max(
    DEFAULT_FINNHUB_COMPANY_DATA_INTERVAL_MS,
    Math.min(MAX_FINNHUB_COMPANY_DATA_INTERVAL_MS, Math.floor(value as number)),
  );
}

export function clampFinnhubCompanyDataConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FINNHUB_COMPANY_DATA_CONCURRENCY;
  }
  return Math.max(
    DEFAULT_FINNHUB_COMPANY_DATA_CONCURRENCY,
    Math.min(MAX_FINNHUB_COMPANY_DATA_CONCURRENCY, Math.floor(value as number)),
  );
}

export function getFinnhubCompanyDataDefaults(): { concurrency: number; requestIntervalMs: number } {
  return {
    concurrency: DEFAULT_FINNHUB_COMPANY_DATA_CONCURRENCY,
    requestIntervalMs: DEFAULT_FINNHUB_COMPANY_DATA_INTERVAL_MS,
  };
}

let nextAvailableAt = 0;
let scheduler: Promise<void> = Promise.resolve();

export async function acquireFinnhubCompanyDataSlot(requestIntervalMs?: number): Promise<void> {
  const effectiveIntervalMs = clampFinnhubCompanyDataIntervalMs(requestIntervalMs);
  const previous = scheduler;
  let release!: () => void;
  scheduler = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, nextAvailableAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextAvailableAt = Date.now() + effectiveIntervalMs;
  } finally {
    release();
  }
}
