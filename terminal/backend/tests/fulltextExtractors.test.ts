import { afterEach, describe, expect, it, vi } from "vitest";

import { extractByDomain } from "../src/services/fulltextExtractors.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fulltextExtractors", () => {
  it("should extract SEC/EDGAR HTML into plain full text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <div>Item 8.01 Other Events</div>
              <p>Rocket Lab announced a major contract award supporting hypersonic test launches for a U.S. government customer.</p>
              <p>The filing states the program is expected to expand the company's national security backlog meaningfully over multiple years.</p>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://www.sec.gov/Archives/example.htm", "SEC/EDGAR", null);
    expect(result.extractionStatus).toBe("success");
    expect(result.fullText).toContain("Rocket Lab announced a major contract award");
    expect(result.wordCount).toBeGreaterThan(10);
  });

  it("should fall back to body when SEC/EDGAR extraction is too short", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "short",
      }),
    );

    const fallbackBody = "Filed 2026-03-17, accepted 2026-03-17 16:42:11. CIK: 0001819994. This fallback body is intentionally long enough to pass the minimum body fallback threshold for testing.";
    const result = await extractByDomain("https://www.sec.gov/Archives/example.htm", "SEC/EDGAR", fallbackBody);
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toContain("body-fallback");
    expect(result.fullText).toContain("CIK: 0001819994");
  });
});