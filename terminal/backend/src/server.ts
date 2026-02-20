import express from "express";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { getNews, getNewsById } from "./services/newsRepository.js";
import { createSavedView, deleteSavedView, listSavedViews } from "./services/savedViewRepository.js";
import { createWatchlist, deleteWatchlist, listWatchlists } from "./services/watchlistRepository.js";
import {
  exportCalendarEventsCsv,
  getCalendarEventById,
  getCalendarTypes,
  listCalendarEvents
} from "./services/calendarRepository.js";
import { listAlertRules, upsertAlertRule } from "./services/alertsRepository.js";
import { StreamHub } from "./realtime/streamHub.js";
import { ensureSeedData } from "./seed.js";
import { startInProcessNewsIngestion } from "./services/newsIngestion.js";
import { startCalendarIngestionWorkers } from "./services/calendarIngestion.js";
import type { NewsQuery } from "./types.js";

const app = express();
const streamHub = new StreamHub();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";

function parseList(input: unknown): string[] | undefined {
  if (typeof input !== "string" || input.trim() === "") {
    return undefined;
  }
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNewsQuery(query: Record<string, unknown>): NewsQuery {
  return {
    keyword: typeof query.keyword === "string" ? query.keyword : undefined,
    tickers: parseList(query.tickers),
    sources: parseList(query.sources),
    tags: parseList(query.tags),
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: typeof query.cursor === "string" ? query.cursor : undefined
  };
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    realtime: "sse",
    pollingFallbackSeconds: 10,
    demoUserId: DEMO_USER_ID
  });
});

app.get("/api/news", async (req, res, next) => {
  try {
    const parsedQuery = parseNewsQuery(req.query as Record<string, unknown>);
    const result = await getNews(parsedQuery);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/:id", async (req, res, next) => {
  try {
    const item = await getNewsById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

const savedViewSchema = z.object({
  name: z.string().min(1),
  queryJson: z.record(z.any()),
  enableAlerts: z.boolean().default(false)
});

app.post("/api/news/saved-views", async (req, res, next) => {
  try {
    const input = savedViewSchema.parse(req.body);
    const row = await createSavedView(DEMO_USER_ID, input.name, input.queryJson, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/saved-views", async (_req, res, next) => {
  try {
    const rows = await listSavedViews(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/news/saved-views/:id", async (req, res, next) => {
  try {
    const deleted = await deleteSavedView(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Saved view not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const watchlistSchema = z.object({
  name: z.string().min(1),
  tickers: z.array(z.string()).default([]),
  enableAlerts: z.boolean().default(false)
});

app.get("/api/watchlists", async (_req, res, next) => {
  try {
    const rows = await listWatchlists(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/watchlists", async (req, res, next) => {
  try {
    const input = watchlistSchema.parse(req.body);
    const row = await createWatchlist(DEMO_USER_ID, input.name, input.tickers, input.enableAlerts);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/watchlists/:id", async (req, res, next) => {
  try {
    const deleted = await deleteWatchlist(DEMO_USER_ID, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Watchlist not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/types", (_req, res) => {
  res.json(getCalendarTypes());
});

app.get("/api/calendar/events", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const result = await listCalendarEvents({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      userId: DEMO_USER_ID
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/export.csv", async (req, res, next) => {
  try {
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "event_time:desc";
    const [sortByRaw, sortDirRaw] = sortRaw.split(":");
    const csv = await exportCalendarEventsCsv({
      type: typeof req.query.type === "string" ? req.query.type : "earnings",
      tickers: parseList(req.query.tickers),
      watchlistId: typeof req.query.watchlist_id === "string" ? req.query.watchlist_id : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      timeOfDay:
        req.query.time_of_day === "BMO" || req.query.time_of_day === "AMC" || req.query.time_of_day === "Unknown"
          ? req.query.time_of_day
          : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      sortBy: sortByRaw,
      sortDir: sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc",
      userId: DEMO_USER_ID
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="calendar_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/events/:id", async (req, res, next) => {
  try {
    const event = await getCalendarEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    res.json(event);
  } catch (error) {
    next(error);
  }
});

const alertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  tool: z.enum(["news", "watchlists", "calendar"]),
  name: z.string().min(1),
  enabled: z.boolean(),
  methods: z.array(z.enum(["browser", "sound", "email"])),
  ruleJson: z.record(z.any())
});

app.get("/api/settings/alerts", async (_req, res, next) => {
  try {
    const rows = await listAlertRules(DEMO_USER_ID);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/alerts", async (req, res, next) => {
  try {
    const input = alertRuleSchema.parse(req.body);
    const row = await upsertAlertRule({
      id: input.id,
      userId: DEMO_USER_ID,
      tool: input.tool,
      name: input.name,
      enabled: input.enabled,
      methods: input.methods,
      ruleJson: input.ruleJson
    });
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/stream", (req, res) => {
  const filters = parseNewsQuery(req.query as Record<string, unknown>);
  const clientId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  streamHub.addClient({
    id: clientId,
    response: res,
    filters
  });

  req.on("close", () => {
    streamHub.removeClient(clientId);
  });
});

setInterval(() => {
  streamHub.heartbeat();
}, 20000);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(400).json({ error: message });
});

async function start(): Promise<void> {
  await initDb();
  await ensureSeedData();
  startInProcessNewsIngestion(streamHub);
  startCalendarIngestionWorkers();

  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
