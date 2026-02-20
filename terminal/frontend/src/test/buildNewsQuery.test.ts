import { describe, expect, it } from "vitest";
import { buildNewsQuery } from "../api";

describe("buildNewsQuery", () => {
  it("combines keyword and tickers", () => {
    const query = buildNewsQuery({ keyword: "earnings", tickers: ["NVDA"] });
    expect(query).toContain("keyword=earnings");
    expect(query).toContain("tickers=NVDA");
  });
});
