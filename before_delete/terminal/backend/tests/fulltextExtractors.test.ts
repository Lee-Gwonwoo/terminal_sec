import { afterEach, describe, expect, it, vi } from "vitest";

import { extractByDomain, setBrowserHtmlLoaderForTests } from "../src/services/fulltextExtractors.js";

afterEach(() => {
  setBrowserHtmlLoaderForTests(null);
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

  it("should extract Newsfile article body instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <main>
                <h1>Newsfile headline</h1>
                <p>Philadelphia, Pennsylvania--(Newsfile Corp. - March 24, 2026) - National plaintiffs' law firm Berger Montague announces a class action lawsuit.</p>
                <p>The complaint alleges that defendants misled investors about the design and progress of the pivotal study.</p>
                <p>Shares plummeted nearly 50% after the company revealed the FDA did not accept the data as sufficient.</p>
                <p>For more information, please contact Berger Montague today.</p>
                <div>Ready to Announce with Confidence?</div>
              </main>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://www.newsfilecorp.com/release/example", "Newsfile Corp", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("newsfile-scrape");
    expect(result.fullText).toContain("defendants misled investors about the design and progress");
    expect(result.fullText).not.toContain("Ready to Announce with Confidence");
  });

  it("should extract Accesswire article body instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <main>
                <article>
                  <h1>Innodata Announces Date of Annual Shareholder Meeting</h1>
                  <p>NEW YORK, NY / ACCESS Newswire / March 24, 2026 / INNODATA INC. today announced that its 2026 annual meeting of shareholders is scheduled for June 4, 2026.</p>
                  <p>Shareholders of record as of April 8, 2026 will be eligible to vote at the annual meeting.</p>
                  <p>Innodata is a global data engineering company focused on trusted AI systems at scale.</p>
                  <p>Visit www.innodata.com to learn more.</p>
                  <div>Investor Relations Products</div>
                </article>
              </main>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://www.accessnewswire.com/newsroom/en/example", "Accesswire", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("accesswire-scrape");
    expect(result.fullText).toContain("annual meeting of shareholders is scheduled");
    expect(result.fullText).not.toContain("Investor Relations Products");
  });

  it("should extract MCAP MediaWire article body instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <body>
              <article>
                <h1>SS Innovations’ SSi Mantra Surgical Robotic System Approved</h1>
                <p>Fort Lauderdale, FL, March 18, 2026 – PRISM MediaWire – SS Innovations International today announced that the company’s SSi Mantra system has been approved for telesurgeries.</p>
                <p>The company also announced that more than 150 cumulative telesurgeries have been successfully performed utilizing the system.</p>
                <p>The approval expands the company’s remote surgery capabilities into Indonesia and the Philippines.</p>
                <p>Additional product details and forward-looking statements follow in the remainder of the release.</p>
                <div>Subscribe to notifications</div>
              </article>
            </body>
          </html>
        `,
      }),
    );

    const result = await extractByDomain("https://prismmediawire.com/example", "MCAP MediaWire", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("mcap-mediawire-scrape");
    expect(result.fullText).toContain("more than 150 cumulative telesurgeries");
    expect(result.fullText).not.toContain("Subscribe to notifications");
  });

  it("should extract Business Wire article body via browser fallback", async () => {
    setBrowserHtmlLoaderForTests(async () => `
      <html>
        <body>
          <main>
            <article class="bw-release-story">
              <p>CHICAGO--(BUSINESS WIRE)--Ameresco today announced the delivery of energy and infrastructure upgrades for Pittsylvania County.</p>
              <p>The project includes microgrid modernization, resilient generation assets, and long-term operational improvements.</p>
              <p>County leaders said the program lowers operating costs while improving energy resiliency across public facilities.</p>
              <p>Additional release details continue in several paragraphs to exceed the minimum extraction threshold for testing purposes.</p>
              <div>Related News</div>
            </article>
          </main>
        </body>
      </html>
    `);

    const result = await extractByDomain("https://www.businesswire.com/news/home/example/en/", "Business Wire", "short fallback body");
    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("businesswire-browser");
    expect(result.fullText).toContain("delivery of energy and infrastructure upgrades");
    expect(result.fullText).not.toContain("Related News");
  });

  it("should resolve Finnhub company_news redirect and extract Yahoo article body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 302,
        headers: {
          get: (name: string) => name.toLowerCase() === "location"
            ? "https://finance.yahoo.com/markets/stocks/articles/example.html"
            : null,
        },
      }),
    );
    setBrowserHtmlLoaderForTests(async () => `
      <html>
        <body>
          <article>
            <div data-testid="articleBody">
              <p>Yahoo Finance original body paragraph one with enough length to satisfy the extractor threshold and verify redirect-based company news extraction.</p>
              <p>Paragraph two continues the article so the result is materially different from the provider summary fallback path previously stored in company_news.</p>
              <p>Paragraph three adds additional detail about analyst sentiment, revenue growth, and market reaction.</p>
              <div>Recommended Stories</div>
            </div>
          </article>
        </body>
      </html>
    `);

    const result = await extractByDomain(
      "https://finnhub.io/api/news?id=wrapper-id",
      "FINNHUB",
      "summary fallback body that should not be used",
      { sourceType: "company_news" },
    );

    expect(result.extractionStatus).toBe("success");
    expect(result.extractionNote).toBe("yahoo-finance-browser");
    expect(result.resolvedUrl).toBe("https://finance.yahoo.com/markets/stocks/articles/example.html");
    expect(result.resolvedPublisher).toBe("YAHOO");
    expect(result.fullText).toContain("Yahoo Finance original body paragraph one");
    expect(result.fullText).not.toContain("Recommended Stories");
  });

  it("should mark unsupported company_news origin as unavailable instead of body fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 302,
        headers: {
          get: (name: string) => name.toLowerCase() === "location"
            ? "https://www.marketwatch.com/story/example"
            : null,
        },
      }),
    );

    const result = await extractByDomain(
      "https://finnhub.io/api/news?id=wrapper-id",
      "FINNHUB",
      "existing summary fallback body that should not be preserved as success",
      { sourceType: "company_news" },
    );

    expect(result.extractionStatus).toBe("unavailable");
    expect(result.extractionNote).toBe("company-news-no-scraper: MARKETWATCH");
    expect(result.fullText).toBe("");
    expect(result.resolvedPublisher).toBe("MARKETWATCH");
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