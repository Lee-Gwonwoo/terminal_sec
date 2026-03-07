import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let getDb: typeof import("../src/db.js").getDb;
let upsertAiAnalysis: typeof import("../src/services/aiAnalysisRepository.js").upsertAiAnalysis;
let getAiAnalysis: typeof import("../src/services/aiAnalysisRepository.js").getAiAnalysis;
let getAiAnalysisBatch: typeof import("../src/services/aiAnalysisRepository.js").getAiAnalysisBatch;
let validateAnalysisCompleteness: typeof import("../src/services/aiAnalysisRepository.js").validateAnalysisCompleteness;

beforeAll(async () => {
  await setupTestDb();
  const dbMod = await import("../src/db.js");
  getDb = dbMod.getDb;
  const repo = await import("../src/services/aiAnalysisRepository.js");
  upsertAiAnalysis = repo.upsertAiAnalysis;
  getAiAnalysis = repo.getAiAnalysis;
  getAiAnalysisBatch = repo.getAiAnalysisBatch;
  validateAnalysisCompleteness = repo.validateAnalysisCompleteness;

  // Insert parent news_items rows to satisfy FK constraint
  const db = getDb();
  const now = new Date().toISOString();
  for (const id of ["news_001", "news_002", "news_003_empty_kw", "news_004_not_started"]) {
    await db.run(
      `INSERT OR IGNORE INTO news_items
         (id, published_at, source, source_type, title, body, url, tickers_csv, tags_csv)
       VALUES (?, ?, 'test', 'company_news', 'Test headline', '', 'https://example.com/' || ?, '', '')`,
      [id, now, id],
    );
  }
});

afterAll(teardownTestDb);

describe("aiAnalysisRepository", () => {
  describe("upsert + get", () => {
    it("should insert and retrieve a completed analysis", async () => {
      await upsertAiAnalysis("news_001", {
        score: 0.85,
        scoreEvidence: "Strong positive sentiment",
        keywords: ["earnings", "growth"],
        analysisStatus: "completed",
      });
      const row = await getAiAnalysis("news_001");
      expect(row).not.toBeNull();
      expect(row!.score).toBe(0.85);
      expect(row!.score_evidence).toBe("Strong positive sentiment");
      expect(row!.analysis_status).toBe("completed");
      expect(row!.analyzed_at).toBeTruthy();
      expect(JSON.parse(row!.keywords_json)).toEqual(["earnings", "growth"]);
    });

    it("should upsert (overwrite) on second call", async () => {
      await upsertAiAnalysis("news_002", {
        score: 0.5,
        scoreEvidence: "Neutral",
        keywords: ["merger"],
        analysisStatus: "completed",
      });
      await upsertAiAnalysis("news_002", {
        score: 0.9,
        scoreEvidence: "Very positive after revision",
        keywords: ["merger", "acquisition"],
        analysisStatus: "completed",
      });
      const row = await getAiAnalysis("news_002");
      expect(row!.score).toBe(0.9);
      expect(row!.score_evidence).toBe("Very positive after revision");
    });
  });

  describe("batch fetch", () => {
    it("should return a Map of analysis rows", async () => {
      const map = await getAiAnalysisBatch(["news_001", "news_002", "does_not_exist"]);
      expect(map.size).toBe(2);
      expect(map.has("news_001")).toBe(true);
      expect(map.has("does_not_exist")).toBe(false);
    });
  });

  describe("validateAnalysisCompleteness — deletion/loss detection (Step 0-5)", () => {
    it("should pass when completed rows have score and scoreEvidence", async () => {
      // news_001 and news_002 are already properly completed from above tests
      const { failures } = await validateAnalysisCompleteness();
      // Filter to only our test news IDs to avoid collision with other tests
      const relevant = failures.filter((f) => f.newsId === "news_001" || f.newsId === "news_002");
      expect(relevant).toHaveLength(0);
    });

    it("should FAIL when completed row has null score", async () => {
      // Directly set score to null to simulate deletion/loss
      await getDb().run(
        `UPDATE news_ai_analysis SET score = NULL WHERE news_id = ?`,
        ["news_001"],
      );

      const { failures } = await validateAnalysisCompleteness();
      const scoreFailure = failures.find(
        (f) => f.newsId === "news_001" && f.reason.includes("score is empty"),
      );
      expect(scoreFailure).toBeDefined();

      // Restore for subsequent tests
      await getDb().run(
        `UPDATE news_ai_analysis SET score = 0.85 WHERE news_id = ?`,
        ["news_001"],
      );
    });

    it("should FAIL when completed row has null score_evidence", async () => {
      await getDb().run(
        `UPDATE news_ai_analysis SET score_evidence = NULL WHERE news_id = ?`,
        ["news_001"],
      );

      const { failures } = await validateAnalysisCompleteness();
      const evidenceFailure = failures.find(
        (f) => f.newsId === "news_001" && f.reason.includes("score_evidence is empty"),
      );
      expect(evidenceFailure).toBeDefined();

      // Restore
      await getDb().run(
        `UPDATE news_ai_analysis SET score_evidence = 'Strong positive sentiment' WHERE news_id = ?`,
        ["news_001"],
      );
    });

    it("should WARN when completed row has empty keywords array", async () => {
      await upsertAiAnalysis("news_003_empty_kw", {
        score: 0.7,
        scoreEvidence: "Some evidence",
        keywords: [], // empty
        analysisStatus: "completed",
      });

      const { warnings, failures } = await validateAnalysisCompleteness();
      const kwWarning = warnings.find(
        (w) => w.newsId === "news_003_empty_kw" && w.reason.includes("keywords is empty"),
      );
      expect(kwWarning).toBeDefined();

      // Should NOT be a failure — just a warning
      const kwFailure = failures.find((f) => f.newsId === "news_003_empty_kw");
      expect(kwFailure).toBeUndefined();
    });

    it("should NOT flag not_started rows as failures", async () => {
      await upsertAiAnalysis("news_004_not_started", {
        score: null,
        scoreEvidence: null,
        keywords: [],
        analysisStatus: "not_started",
      });

      const { failures, warnings } = await validateAnalysisCompleteness();
      const notStartedFailure = failures.find((f) => f.newsId === "news_004_not_started");
      const notStartedWarning = warnings.find((w) => w.newsId === "news_004_not_started");
      expect(notStartedFailure).toBeUndefined();
      expect(notStartedWarning).toBeUndefined();
    });
  });
});
