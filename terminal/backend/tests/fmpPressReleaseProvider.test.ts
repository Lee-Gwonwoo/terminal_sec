import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/config.js", () => ({
  config: {
    fmpApiKey: "TEST_KEY_DO_NOT_USE",
  },
}));

let fetchFmpPressReleasesByTicker: typeof import("../src/services/fmpPressReleaseProvider.js").fetchFmpPressReleasesByTicker;

beforeAll(async () => {
  const mod = await import("../src/services/fmpPressReleaseProvider.js");
  fetchFmpPressReleasesByTicker = mod.fetchFmpPressReleasesByTicker;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fmpPressReleaseProvider", () => {
  it("retries a timed out page request and recovers on the next attempt", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            reject(signal.reason ?? new Error("aborted"));
            return;
          }
          signal?.addEventListener(
            "abort",
            () => reject(signal.reason ?? new Error("aborted")),
            { once: true },
          );
        });
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => "[]",
      });

    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    const promise = fetchFmpPressReleasesByTicker("AAPL", {
      maxPages: 1,
      requestIntervalMs: 0,
      timeoutMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(1_500);

    await expect(promise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});