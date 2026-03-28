import { describe, expect, it, vi, afterEach } from "vitest";
import { filterStableDailyBars, shouldExcludeCurrentEtDailyBar } from "../src/services/ohlcWatchlistRepository.js";

describe("ohlcWatchlistRepository ET day stability", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes the current ET daily bar before market close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T18:30:00.000Z"));

    expect(shouldExcludeCurrentEtDailyBar("2026-03-11")).toBe(true);
    expect(
      filterStableDailyBars([
        { Datetime: "2026-03-10", Open: 1, High: 1, Low: 1, Close: 1, Volume: 1 },
        { Datetime: "2026-03-11", Open: 2, High: 2, Low: 2, Close: 2, Volume: 2 },
      ]),
    ).toEqual([
      { Datetime: "2026-03-10", Open: 1, High: 1, Low: 1, Close: 1, Volume: 1 },
    ]);
  });

  it("keeps the current ET daily bar after market close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T21:15:00.000Z"));

    expect(shouldExcludeCurrentEtDailyBar("2026-03-11")).toBe(false);
  });
});