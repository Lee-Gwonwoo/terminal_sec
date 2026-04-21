import { describe, expect, it } from "vitest";
import { completeJob, createJob, getJob, normalizeJobScope, updateProgress } from "../src/services/jobManager.js";

describe("jobManager progress semantics", () => {
  it("caps running progress at 99 until completion is finalized", () => {
    const jobId = createJob(10);

    updateProgress(jobId, 10, 10);
    expect(getJob(jobId)?.status).toBe("running");
    expect(getJob(jobId)?.progress).toMatchObject({
      completed: 10,
      total: 10,
      pct: 99,
    });

    completeJob(jobId);
    expect(getJob(jobId)?.status).toBe("done");
    expect(getJob(jobId)?.progress).toMatchObject({
      completed: 10,
      total: 10,
      pct: 100,
    });
  });

  it("preserves explicit scope metadata", () => {
    const jobId = createJob(1, { scope: "finnhub-news" });

    expect(getJob(jobId)?.scope).toBe("finnhub-news");
  });

  it("normalizes invalid scopes to the requested fallback", () => {
    expect(normalizeJobScope("investing-news", "other")).toBe("investing-news");
    expect(normalizeJobScope("bad-scope", "finnhub-news")).toBe("finnhub-news");
  });
});