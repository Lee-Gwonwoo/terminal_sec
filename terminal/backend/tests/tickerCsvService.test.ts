import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Test CSV will be placed inside the allowed directory
const ALLOWED_DIR = path.resolve(
  "C:/github_coding/terminal_sec/tradigview_screener/original_data",
);
const TEST_CSV = path.join(ALLOWED_DIR, "test_ticker_service.csv");
const RELATIVE_CSV = "tradigview_screener/original_data/test_ticker_service.csv";

let readTickersFromCsv: typeof import("../src/services/tickerCsvService.js").readTickersFromCsv;
let appendTickerToCsv: typeof import("../src/services/tickerCsvService.js").appendTickerToCsv;
let CsvServiceError: typeof import("../src/services/tickerCsvService.js").CsvServiceError;

beforeAll(async () => {
  const mod = await import("../src/services/tickerCsvService.js");
  readTickersFromCsv = mod.readTickersFromCsv;
  appendTickerToCsv = mod.appendTickerToCsv;
  CsvServiceError = mod.CsvServiceError;

  // Create a test CSV with known content
  const content = "Name,Ticker,Exchange\nApple,AAPL,NASDAQ\nMicrosoft,MSFT,NASDAQ\nTesla,TSLA,NASDAQ\n";
  fs.writeFileSync(TEST_CSV, content, "utf8");
});

afterAll(() => {
  try {
    fs.unlinkSync(TEST_CSV);
  } catch {
    // ignore
  }
});

describe("tickerCsvService", () => {
  // ---- Path validation ----
  describe("path validation (allowlist)", () => {
    it("should reject paths outside allowed directory", () => {
      expect(() => readTickersFromCsv("../../../etc/passwd.csv")).toThrow(
        CsvServiceError,
      );
    });

    it("should reject path traversal with ..", () => {
      expect(() =>
        readTickersFromCsv(
          "tradigview_screener/original_data/../../../secret.csv",
        ),
      ).toThrow(CsvServiceError);
    });

    it("should reject non-.csv extension", () => {
      expect(() =>
        readTickersFromCsv("tradigview_screener/original_data/data.txt"),
      ).toThrow(CsvServiceError);
    });

    it("should reject absolute paths outside allowlist", () => {
      expect(() => readTickersFromCsv("C:/Windows/System32/test.csv")).toThrow(
        CsvServiceError,
      );
    });
  });

  // ---- Read ----
  describe("readTickersFromCsv", () => {
    it("should read tickers from a valid CSV with Ticker column", () => {
      const result = readTickersFromCsv(RELATIVE_CSV);
      expect(result.tickers).toEqual(["AAPL", "MSFT", "TSLA"]);
      expect(result.resolvedPath).toBe(TEST_CSV);
    });

    it("should throw on file not found", () => {
      expect(() =>
        readTickersFromCsv(
          "tradigview_screener/original_data/nonexistent.csv",
        ),
      ).toThrow(CsvServiceError);
    });

    it("should throw on empty file", () => {
      const emptyPath = path.join(ALLOWED_DIR, "test_empty.csv");
      fs.writeFileSync(emptyPath, "", "utf8");
      try {
        expect(() =>
          readTickersFromCsv(
            "tradigview_screener/original_data/test_empty.csv",
          ),
        ).toThrow(CsvServiceError);
      } finally {
        fs.unlinkSync(emptyPath);
      }
    });

    it("should throw when no ticker/symbol header is found", () => {
      const badPath = path.join(ALLOWED_DIR, "test_noheader.csv");
      fs.writeFileSync(badPath, "Name,Value\ntest,123\n", "utf8");
      try {
        expect(() =>
          readTickersFromCsv(
            "tradigview_screener/original_data/test_noheader.csv",
          ),
        ).toThrow(CsvServiceError);
      } finally {
        fs.unlinkSync(badPath);
      }
    });

    it("should handle Symbol column header", () => {
      const symPath = path.join(ALLOWED_DIR, "test_symbol_col.csv");
      fs.writeFileSync(symPath, "Name,Symbol\nApple,AAPL\n", "utf8");
      try {
        const result = readTickersFromCsv(
          "tradigview_screener/original_data/test_symbol_col.csv",
        );
        expect(result.tickers).toEqual(["AAPL"]);
      } finally {
        fs.unlinkSync(symPath);
      }
    });
  });

  // ---- Append ----
  describe("appendTickerToCsv", () => {
    it("should append a new ticker successfully", async () => {
      const result = await appendTickerToCsv(RELATIVE_CSV, "GOOG");
      expect(result.tickerAdded).toBe("GOOG");
      expect(result.tickers).toContain("GOOG");
      expect(result.tickers).toContain("AAPL"); // original still present
    });

    it("should reject duplicate ticker", async () => {
      // GOOG was just added in the previous test
      await expect(appendTickerToCsv(RELATIVE_CSV, "GOOG")).rejects.toThrow(
        CsvServiceError,
      );
    });

    it("should normalize ticker to uppercase", async () => {
      const result = await appendTickerToCsv(RELATIVE_CSV, "amzn");
      expect(result.tickerAdded).toBe("AMZN");
      expect(result.tickers).toContain("AMZN");
    });

    it("should reject invalid ticker format", async () => {
      await expect(
        appendTickerToCsv(RELATIVE_CSV, "inv@lid!"),
      ).rejects.toThrow(CsvServiceError);
    });

    it("should reject ticker that is too long", async () => {
      await expect(
        appendTickerToCsv(RELATIVE_CSV, "A".repeat(21)),
      ).rejects.toThrow(CsvServiceError);
    });
  });
});
