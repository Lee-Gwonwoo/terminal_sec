import { describe, expect, it } from "vitest";
import { matchesNewsFilters } from "../src/services/newsFilterMatcher.js";

const sampleItem = {
  id: "n1",
  published_at: new Date().toISOString(),
  source: "Mock",
  source_type: "press_release",
  title: "NVDA earnings update",
  body: "NVDA posts strong earnings and guidance",
  url: "https://example.com/a",
  tickers: ["NVDA"],
  tags: ["earnings", "guidance"],
  created_at: new Date().toISOString()
};

describe("matchesNewsFilters", () => {
  it("matches ticker + keyword together", () => {
    expect(
      matchesNewsFilters(sampleItem, {
        keyword: "earnings",
        tickers: ["NVDA"]
      })
    ).toBe(true);
  });

  it("fails when ticker does not match", () => {
    expect(matchesNewsFilters(sampleItem, { tickers: ["TSLA"] })).toBe(false);
  });
});
