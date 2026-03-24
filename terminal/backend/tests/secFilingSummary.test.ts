import { describe, expect, it } from "vitest";

import {
  buildSecFilingMetadataSummary,
  summarizeSecDocumentText,
} from "../src/services/secFilingSummary.js";

describe("secFilingSummary", () => {
  it("should build metadata fallback summary", () => {
    expect(buildSecFilingMetadataSummary({
      symbol: "RKLB",
      cik: "0001819994",
      formType: "8-K",
      filingDate: "2026-03-17T00:00:00",
      acceptedDate: "2026-03-17T16:42:11",
      link: "https://example.com/index",
      finalLink: "https://example.com/doc",
    })).toBe("Filed 2026-03-17, accepted 2026-03-17 16:42:11. CIK: 0001819994.");
  });

  it("should summarize 8-K item sections deterministically", () => {
    const text = `
United States Securities and Exchange Commission

Item 1.01 Entry into a Material Definitive Agreement

Rocket Lab USA, Inc. entered into a launch services agreement with a U.S. government customer to support the HASTE program. The contract has a total value of approximately $190 million and covers multiple hypersonic test launches.

Item 8.01 Other Events

The company expects mission execution to begin in 2027 and stated that the agreement expands its national security launch backlog.

Signatures
`;

    const summary = summarizeSecDocumentText("8-K", text);
    expect(summary).toContain("Entry into a Material Definitive Agreement");
    expect(summary).toContain("$190 million");
    expect(summary).toContain("national security launch backlog");
  });

  it("should summarize offering language for 424B5 forms", () => {
    const text = `
Prospectus Supplement

Rocket Lab USA, Inc. has entered into a sales agreement with several sales agents under which the company may offer and sell up to $1,000,000,000 of its common stock from time to time through an at-the-market offering. Net proceeds are expected to support general corporate purposes and working capital.

The offering will be made pursuant to an effective shelf registration statement on Form S-3.
`;

    const summary = summarizeSecDocumentText("424B5", text);
    expect(summary).toContain("$1,000,000,000");
    expect(summary).toContain("at-the-market offering");
    expect(summary).toContain("general corporate purposes");
  });

  it("should reject inline XBRL-like token noise for generic forms", () => {
    const text = `0001759138falseFYhttp://www.cabalettabio.com/20251231#PropertyPlantAndEquipmentEstimatedUsefulLives1130001759138us-gaap:EmployeeStockOptionMember2024-01-012024-12-310001759138us-gaap:GeneralAndAdministrativeExpenseMemberus-gaap:EmployeeStockOptionMember2025-01-012025-12-310001759138us-gaap:FairValueInputsLevel3Memberus-gaap:MoneyMarketFundsMemberus-gaap:FairValueMeasurementsRecurringMember2024-12-310001759138caba:VotingCommonStockMember`;

    const summary = summarizeSecDocumentText("10-K", text);
    expect(summary).toBeNull();
  });

  it("should reject SEC cover-page boilerplate for generic forms", () => {
    const text = `Registrant’s telephone number, including area code: (267) 759-3100 Securities registered pursuant to Section 12(g) of the Act: None Indicate by check mark if the registrant is a well-known seasoned issuer, as defined in Rule 405 of the Securities Act. Yes ☐ No ☒`;

    const summary = summarizeSecDocumentText("10-K", text);
    expect(summary).toBeNull();
  });
});