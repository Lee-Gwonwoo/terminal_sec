import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getPublishedAtEtParts,
  shouldDeferSameDayChangeUntilMarketClose,
} from "../src/services/newsChangeMerger.js";

describe("newsChangeMerger time gating", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts timezone-aware timestamps to ET market date", () => {
    expect(getPublishedAtEtParts("2026-03-11T00:30:00.000Z")).toEqual({
      date: "2026-03-10",
      time: "20:30:00",
    });
  });

  it("preserves ET-naive timestamps as already normalized ET", () => {
    expect(getPublishedAtEtParts("2026-03-11T09:15:30")).toEqual({
      date: "2026-03-11",
      time: "09:15:30",
    });
  });

  it("defers same-day change before ET market close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T18:30:00.000Z"));

    expect(shouldDeferSameDayChangeUntilMarketClose("2026-03-11T14:05:00.000Z")).toBe(true);
  });

  it("allows same-day change after ET market close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T21:15:00.000Z"));

    expect(shouldDeferSameDayChangeUntilMarketClose("2026-03-11T14:05:00.000Z")).toBe(false);
  });
});