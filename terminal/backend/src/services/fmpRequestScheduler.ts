const DEFAULT_MAX_CONCURRENT_REQUESTS = 1;
const MAX_CONCURRENT_REQUESTS = 20;
const DEFAULT_REQUEST_INTERVAL_MS = 250;
const MAX_REQUEST_INTERVAL_MS = 5_000;

function clampMaxConcurrentRequests(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_CONCURRENT_REQUESTS;
  }
  return Math.max(1, Math.min(MAX_CONCURRENT_REQUESTS, Math.floor(value as number)));
}

function clampRequestIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_REQUEST_INTERVAL_MS;
  }
  return Math.max(0, Math.min(MAX_REQUEST_INTERVAL_MS, Math.floor(value as number)));
}

export interface FmpRequestScheduler {
  acquire(requestIntervalMs?: number): Promise<() => void>;
}

export function createFmpRequestScheduler(options: {
  maxConcurrentRequests?: number;
  requestIntervalMs?: number;
} = {}): FmpRequestScheduler {
  const maxConcurrentRequests = clampMaxConcurrentRequests(options.maxConcurrentRequests);
  const defaultRequestIntervalMs = clampRequestIntervalMs(options.requestIntervalMs);

  let activeCount = 0;
  let lastStartedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue: Array<{
    intervalMs: number;
    resolve: (release: () => void) => void;
  }> = [];

  const pump = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (queue.length === 0 || activeCount >= maxConcurrentRequests) {
      return;
    }

    const next = queue[0];
    const now = Date.now();
    const earliestStartAt = lastStartedAt + next.intervalMs;
    if (now < earliestStartAt) {
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, earliestStartAt - now);
      return;
    }

    queue.shift();
    activeCount += 1;
    lastStartedAt = now;

    let released = false;
    next.resolve(() => {
      if (released) {
        return;
      }
      released = true;
      activeCount = Math.max(0, activeCount - 1);
      pump();
    });

    pump();
  };

  return {
    acquire(requestIntervalMs?: number) {
      const intervalMs = clampRequestIntervalMs(requestIntervalMs ?? defaultRequestIntervalMs);
      return new Promise((resolve) => {
        queue.push({ intervalMs, resolve });
        pump();
      });
    },
  };
}