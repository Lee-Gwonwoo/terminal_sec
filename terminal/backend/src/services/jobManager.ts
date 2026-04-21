/**
 * jobManager.ts — 백그라운드 잡 관리 모듈 (메모리 기반)
 *
 * 모든 장시간 업데이트 작업(Finnhub 뉴스, IBKR 가격/캘린더)에서
 * 공통으로 사용하는 잡 큐/상태 관리자.
 *
 * - createJob(): 잡 생성 → jobId 반환
 * - updateProgress(): 진행률 갱신
 * - appendLog(): 로그 라인 추가
 * - completeJob() / failJob(): 완료/실패 처리
 * - getJob(): 폴링 시 상태 조회
 */

import { randomUUID } from "node:crypto";

// ─── Types ───

export interface JobProgress {
  completed: number;
  total: number;
  pct: number;
}

export type JobCategory = "news-update" | "news-fulltext" | "other";
export type JobScope = "finnhub-news" | "investing-news" | "other";

export interface JobMetadata {
  category?: JobCategory;
  label?: string;
  scope?: JobScope;
}

export interface JobState {
  id: string;
  status: "running" | "done" | "failed" | "cancelled";
  progress: JobProgress;
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  category: JobCategory;
  label?: string;
  scope: JobScope;
}

export function normalizeJobScope(value: unknown, fallback: JobScope = "other"): JobScope {
  if (value === "finnhub-news" || value === "investing-news" || value === "other") {
    return value;
  }
  return fallback;
}

// ─── In-memory store ───

const jobs = new Map<string, JobState>();

/** Remove finished jobs older than 30 minutes to avoid memory leak */
const MAX_AGE_MS = 30 * 60 * 1000;

function cleanup(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (
      job.status !== "running" &&
      now - new Date(job.updatedAt).getTime() > MAX_AGE_MS
    ) {
      jobs.delete(id);
    }
  }
}

// ─── Public API ───

export function createJob(total: number, metadata?: JobMetadata): string {
  cleanup();
  const id = randomUUID();
  const now = new Date().toISOString();
  jobs.set(id, {
    id,
    status: "running",
    progress: { completed: 0, total, pct: 0 },
    logs: [],
    createdAt: now,
    updatedAt: now,
    category: metadata?.category ?? "other",
    label: metadata?.label,
    scope: metadata?.scope ?? "other",
  });
  return id;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function updateProgress(id: string, completed: number, total?: number): void {
  const job = jobs.get(id);
  if (!job) return;
  if (total !== undefined) {
    job.progress.total = total;
  }
  job.progress.completed = completed;
  const rawPct =
    job.progress.total > 0
      ? Math.round((completed / job.progress.total) * 100)
      : 0;
  job.progress.pct = job.status === "running" ? Math.min(rawPct, 99) : rawPct;
  job.updatedAt = new Date().toISOString();
}

export function appendLog(id: string, message: string): void {
  const job = jobs.get(id);
  if (!job) return;
  const ts = new Date().toISOString().slice(11, 19); // HH:mm:ss
  job.logs.push(`[${ts}] ${message}`);
  job.updatedAt = new Date().toISOString();
  // Keep max 500 log lines to limit memory
  if (job.logs.length > 500) {
    job.logs = job.logs.slice(-500);
  }
}

export function completeJob(
  id: string,
  result?: Record<string, unknown>,
): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.progress.pct = 100;
  job.progress.completed = job.progress.total;
  if (result) job.result = result;
  job.updatedAt = new Date().toISOString();
  appendLog(id, "✅ Job completed successfully");
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "failed";
  job.error = error;
  job.updatedAt = new Date().toISOString();
  appendLog(id, `❌ Job failed: ${error}`);
}

// ─── Cancellation ───

const cancelledJobs = new Set<string>();

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  cancelledJobs.add(id);
  job.status = "cancelled";
  job.updatedAt = new Date().toISOString();
  appendLog(id, "🛑 Job cancelled by user");
  return true;
}

export function isJobCancelled(id: string): boolean {
  return cancelledJobs.has(id);
}

/** Return all currently running jobs (for auto-reconnect after page refresh) */
export function getActiveJobs(): JobState[] {
  const result: JobState[] = [];
  for (const job of jobs.values()) {
    if (job.status === "running") result.push(job);
  }
  return result;
}
