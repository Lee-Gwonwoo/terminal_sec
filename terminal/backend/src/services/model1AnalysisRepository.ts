import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import { toEtNaiveIso } from "./timeUtils.js";

export interface Model1AnalysisRun {
  id: string;
  page_id: string | null;
  scope_key: string;
  window_start: string;
  window_end: string;
  timezone: string;
  filters_json: string;
  analyzed_news_ids_json: string;
  current_news_count: number;
  selected_news_count: number;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateModel1AnalysisRunInput {
  pageId?: string | null;
  scopeKey?: string | null;
  windowStart: string;
  windowEnd: string;
  timezone?: string | null;
  filters?: Record<string, unknown> | null;
  analyzedNewsIds?: string[] | null;
  currentNewsCount?: number | null;
  selectedNewsCount?: number | null;
  status?: string | null;
  note?: string | null;
}

export interface Model1AnalysisRunFilter {
  pageId?: string | null;
  scopeKey?: string | null;
  status?: string | null;
}

export interface Model1ContinueWindow {
  previousRun: Model1AnalysisRun | null;
  after: string | null;
  to: string;
  timezone: string;
  hasNewWindow: boolean;
}

const DEFAULT_SCOPE_KEY = "default";
const DEFAULT_TIMEZONE = "America/New_York";
const VALID_STATUSES = new Set(["stage1", "completed", "failed", "superseded"]);

function normalizeScopeKey(scopeKey?: string | null): string {
  const trimmed = scopeKey?.trim();
  return trimmed || DEFAULT_SCOPE_KEY;
}

function defaultScopeKeyForPage(pageId?: string | null): string | undefined {
  const trimmed = pageId?.trim();
  return trimmed ? `page:${trimmed}` : undefined;
}

function normalizeTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_TIMEZONE;
}

function normalizeStatus(status?: string | null): string {
  const trimmed = status?.trim() || "completed";
  if (!VALID_STATUSES.has(trimmed)) {
    throw new Error("status must be one of: stage1, completed, failed, superseded");
  }
  return trimmed;
}

function normalizePublishedAtText(value: string): string {
  return value.trim().replace("T", " ").replace(/Z$/, "").slice(0, 23);
}

function validateWindowBoundary(value: string, name: string): string {
  const normalized = normalizePublishedAtText(value);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(normalized)) {
    throw new Error(`${name} must be a datetime string like YYYY-MM-DD HH:mm:ss or ISO datetime`);
  }
  return normalized;
}

function toJsonObject(value?: Record<string, unknown> | null): string {
  return JSON.stringify(value && typeof value === "object" ? value : {});
}

function toJsonStringArray(value?: string[] | null): string {
  const ids = Array.from(new Set((value ?? []).map((id) => id.trim()).filter(Boolean)));
  return JSON.stringify(ids);
}

function normalizeCount(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function buildPageWhere(pageId?: string | null): { sql: string; params: unknown[] } {
  if (pageId === undefined) {
    return { sql: "", params: [] };
  }
  if (pageId === null || pageId.trim() === "") {
    return { sql: " AND page_id IS NULL", params: [] };
  }
  return { sql: " AND page_id = ?", params: [pageId.trim()] };
}

function buildStatusWhere(status?: string | null): { sql: string; params: unknown[] } {
  if (!status) {
    return { sql: "", params: [] };
  }
  return { sql: " AND status = ?", params: [normalizeStatus(status)] };
}

export async function createModel1AnalysisRun(input: CreateModel1AnalysisRunInput): Promise<Model1AnalysisRun> {
  const windowStart = validateWindowBoundary(input.windowStart, "windowStart");
  const windowEnd = validateWindowBoundary(input.windowEnd, "windowEnd");
  if (windowEnd < windowStart) {
    throw new Error("windowEnd must be greater than or equal to windowStart");
  }

  const id = randomUUID();
  const pageId = input.pageId?.trim() || null;
  const scopeKey = normalizeScopeKey(input.scopeKey ?? defaultScopeKeyForPage(pageId));
  const timezone = normalizeTimezone(input.timezone);
  const status = normalizeStatus(input.status);

  await getDb().run(
    `INSERT INTO model1_analysis_runs
       (id, page_id, scope_key, window_start, window_end, timezone, filters_json, analyzed_news_ids_json,
        current_news_count, selected_news_count, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      pageId,
      scopeKey,
      windowStart,
      windowEnd,
      timezone,
      toJsonObject(input.filters),
      toJsonStringArray(input.analyzedNewsIds),
      normalizeCount(input.currentNewsCount),
      normalizeCount(input.selectedNewsCount),
      status,
      input.note?.trim() || null,
    ],
  );

  const row = await getDb().get<Model1AnalysisRun>("SELECT * FROM model1_analysis_runs WHERE id = ?", id);
  if (!row) {
    throw new Error("failed to create model1 analysis run");
  }
  return row;
}

export async function getLatestModel1AnalysisRun(filter: Model1AnalysisRunFilter = {}): Promise<Model1AnalysisRun | null> {
  const scopeKey = normalizeScopeKey(filter.scopeKey ?? defaultScopeKeyForPage(filter.pageId));
  const pageWhere = buildPageWhere(filter.pageId);
  const statusWhere = buildStatusWhere(filter.status ?? "completed");
  const row = await getDb().get<Model1AnalysisRun>(
    `SELECT *
     FROM model1_analysis_runs
     WHERE scope_key = ?${pageWhere.sql}${statusWhere.sql}
     ORDER BY window_end DESC, created_at DESC
     LIMIT 1`,
    [scopeKey, ...pageWhere.params, ...statusWhere.params],
  );
  return row ?? null;
}

export async function getModel1ContinueWindow(filter: Model1AnalysisRunFilter & { to?: string | null } = {}): Promise<Model1ContinueWindow> {
  const previousRun = await getLatestModel1AnalysisRun({ ...filter, status: filter.status ?? "completed" });
  const to = filter.to ? validateWindowBoundary(filter.to, "to") : validateWindowBoundary(toEtNaiveIso(new Date()), "to");
  return {
    previousRun,
    after: previousRun?.window_end ?? null,
    to,
    timezone: previousRun?.timezone ?? DEFAULT_TIMEZONE,
    hasNewWindow: !previousRun || to > previousRun.window_end,
  };
}
