import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "./setupTestDb.js";

let createModel1AnalysisRun: typeof import("../src/services/model1AnalysisRepository.js").createModel1AnalysisRun;
let getLatestModel1AnalysisRun: typeof import("../src/services/model1AnalysisRepository.js").getLatestModel1AnalysisRun;
let getModel1ContinueWindow: typeof import("../src/services/model1AnalysisRepository.js").getModel1ContinueWindow;

beforeAll(async () => {
  await setupTestDb();
  const repo = await import("../src/services/model1AnalysisRepository.js");
  createModel1AnalysisRun = repo.createModel1AnalysisRun;
  getLatestModel1AnalysisRun = repo.getLatestModel1AnalysisRun;
  getModel1ContinueWindow = repo.getModel1ContinueWindow;
});

afterAll(teardownTestDb);

describe("model1AnalysisRepository", () => {
  it("records a completed analysis run and returns it as the latest run", async () => {
    const run = await createModel1AnalysisRun({
      scopeKey: "page:test-model1",
      windowStart: "2026-05-27T13:00:00.000Z",
      windowEnd: "2026-05-27T14:30:00.000Z",
      timezone: "America/New_York",
      filters: { source_type: ["company_news"] },
      analyzedNewsIds: ["news-1", "news-2", "news-1"],
      currentNewsCount: 12,
      selectedNewsCount: 3,
      status: "completed",
      note: "stage 3 done",
    });

    expect(run.scope_key).toBe("page:test-model1");
    expect(run.window_start).toBe("2026-05-27 13:00:00.000");
    expect(run.window_end).toBe("2026-05-27 14:30:00.000");
    expect(JSON.parse(run.analyzed_news_ids_json)).toEqual(["news-1", "news-2"]);

    const latest = await getLatestModel1AnalysisRun({ scopeKey: "page:test-model1" });
    expect(latest?.id).toBe(run.id);
  });

  it("uses the latest completed window_end as a strict continuation boundary", async () => {
    await createModel1AnalysisRun({
      scopeKey: "page:test-model1",
      windowStart: "2026-05-27 14:30:00.001",
      windowEnd: "2026-05-27 15:00:00.000",
      status: "stage1",
    });
    const completed = await createModel1AnalysisRun({
      scopeKey: "page:test-model1",
      windowStart: "2026-05-27 14:30:00.001",
      windowEnd: "2026-05-27 15:10:00.000",
      status: "completed",
    });

    const next = await getModel1ContinueWindow({
      scopeKey: "page:test-model1",
      to: "2026-05-27T16:00:00.000Z",
    });

    expect(next.previousRun?.id).toBe(completed.id);
    expect(next.after).toBe("2026-05-27 15:10:00.000");
    expect(next.to).toBe("2026-05-27 16:00:00.000");
    expect(next.hasNewWindow).toBe(true);
  });

  it("defaults omitted scopeKey to the page-specific ledger scope", async () => {
    const { getDb } = await import("../src/db.js");
    const pageId = "page-id-default-scope";
    await getDb().run("INSERT INTO users (id, email) VALUES (?, ?)", ["model1-user", "model1@example.test"]);
    await getDb().run("INSERT INTO research_tabs (id, user_id, name) VALUES (?, ?, ?)", ["model1-tab", "model1-user", "Model1"]);
    await getDb().run("INSERT INTO research_pages (id, tab_id, title, body) VALUES (?, ?, ?, ?)", [pageId, "model1-tab", "Model1", ""]);
    const run = await createModel1AnalysisRun({
      pageId,
      windowStart: "2026-05-27 12:00:00.000",
      windowEnd: "2026-05-27 12:30:00.000",
      status: "completed",
    });

    expect(run.scope_key).toBe(`page:${pageId}`);

    const latest = await getLatestModel1AnalysisRun({ pageId });
    const next = await getModel1ContinueWindow({ pageId, to: "2026-05-27 12:45:00.000" });

    expect(latest?.id).toBe(run.id);
    expect(next.after).toBe("2026-05-27 12:30:00.000");
  });

  it("returns no boundary when no completed run exists for the scope", async () => {
    const next = await getModel1ContinueWindow({
      scopeKey: "page:empty-model1",
      to: "2026-05-27 16:00:00",
    });

    expect(next.previousRun).toBeNull();
    expect(next.after).toBeNull();
    expect(next.to).toBe("2026-05-27 16:00:00");
    expect(next.hasNewWindow).toBe(true);
  });

  it("marks the continuation window empty when the latest run already reaches the requested end", async () => {
    await createModel1AnalysisRun({
      scopeKey: "page:already-current-model1",
      windowStart: "2026-05-27 13:00:00.000",
      windowEnd: "2026-05-27 14:00:00.000",
      status: "completed",
    });

    const next = await getModel1ContinueWindow({
      scopeKey: "page:already-current-model1",
      to: "2026-05-27 13:59:59.999",
    });

    expect(next.after).toBe("2026-05-27 14:00:00.000");
    expect(next.to).toBe("2026-05-27 13:59:59.999");
    expect(next.hasNewWindow).toBe(false);
  });
});
