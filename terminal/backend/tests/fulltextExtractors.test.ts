import { afterEach, describe, expect, it, vi } from "vitest";

import { extractByDomain } from "../src/services/fulltextExtractors.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fulltextExtractors", () => {
  it("should extract GlobeNewswire article body instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <div id="main-body-container" class="main-body-container article-body">
                <p>Geneva, Switzerland, March 24, 2026 (GLOBE NEWSWIRE) -- Strategic Acquisition via the SEALSQ Quantum Fund Strengthens its Quantum Vertical Stack</p>
                <p>SEALSQ Corp (NASDAQ: LAES) announced that it has signed a Letter of Intent to acquire Miraex, a developer of photonics-based quantum interconnect solutions.</p>
                <p>The transaction is expected to be finalized by the end of June 2026, subject to customary closing conditions and regulatory approvals.</p>
                <p>About Miraex Miraex is a deep-tech photonics company based at the EPFL Innovation Park in Ecublens, Switzerland.</p>
                <div>Company Profile</div>
                <div>Press Release Actions</div>
              </div>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://www.globenewswire.com/news-release/example", "GlobeNewsWire", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("globenewswire-scrape");
    expect(result.fullText).toContain("signed a Letter of Intent to acquire Miraex");
    expect(result.fullText).not.toContain("Press Release Actions");
    expect(result.wordCount).toBeGreaterThan(20);
  });

  it("should extract PRNewswire release body instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <main id="main">
                <article class="news-release inline-gallery-template">
                  <section class="release-body container ">
                    <p>Combination of high quality, variable-rich, curated EHR data with genomics enhances understanding of the patient journey and aids in therapy development.</p>
                    <p>SAN FRANCISCO, March 24, 2026 /PRNewswire/ -- Verana Health and Guardant Health today announced a partnership to advance precision medicine with real-world data.</p>
                    <p>The companies said the collaboration will help accelerate therapy development and improve longitudinal patient insights across oncology workflows.</p>
                    <p>Additional release details continue in several paragraphs so the extractor has enough body content to pass the minimum article threshold.</p>
                  </section>
                  <div>Contact PR Newswire</div>
                </article>
              </main>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://www.prnewswire.com/news-releases/example.html", "PRNewsWire", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("prnewswire-scrape");
    expect(result.fullText).toContain("advance precision medicine with real-world data");
    expect(result.fullText).not.toContain("Contact PR Newswire");
    expect(result.wordCount).toBeGreaterThan(25);
  });

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