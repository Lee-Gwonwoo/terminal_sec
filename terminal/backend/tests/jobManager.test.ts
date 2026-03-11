import { describe, expect, it } from "vitest";
import { completeJob, createJob, getJob, updateProgress } from "../src/services/jobManager.js";

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
});