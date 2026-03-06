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

export interface JobState {
  id: string;
  status: "running" | "done" | "failed";
  progress: JobProgress;
  logs: string[];
  error?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export function createJob(total: number): string {
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
  job.progress.pct =
    job.progress.total > 0
      ? Math.round((completed / job.progress.total) * 100)
      : 0;
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
