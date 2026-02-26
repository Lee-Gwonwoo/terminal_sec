import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const server = new Server(
  {
    name: "playwright-mcp-local",
    version: "0.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let browser = null;
let context = null;
let page = null;

/** @type {Map<string, import('playwright').Page>} */
let pages = new Map();
let activePageId = null;

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getActivePage() {
  if (activePageId && pages.has(activePageId)) {
    return pages.get(activePageId);
  }
  return page;
}

function getStorageStatePath() {
  const envPath = process.env.PLAYWRIGHT_STORAGE_STATE_PATH;
  if (envPath && String(envPath).trim()) {
    return path.resolve(String(envPath));
  }

  // Keep path short for Windows path-length hygiene.
  return path.resolve(".auth", "storageState.json");
}

async function ensureAuthDir(storageStatePath) {
  const dir = path.dirname(storageStatePath);
  await fs.mkdir(dir, { recursive: true });
}

async function ensurePage() {
  const active = getActivePage();
  if (active) return active;

  browser = await chromium.launch({ headless: false });
  const storageStatePath = getStorageStatePath();
  const hasState = existsSync(storageStatePath);

  context = await browser.newContext(
    hasState ? { storageState: storageStatePath } : undefined
  );
  page = await context.newPage();
  const firstId = newId("tab");
  pages = new Map([[firstId, page]]);
  activePageId = firstId;

  return page;
}

async function newTab(url) {
  await ensurePage();
  const p = await context.newPage();
  const id = newId("tab");
  pages.set(id, p);
  activePageId = id;

  if (url && String(url).trim()) {
    await p.goto(String(url), { waitUntil: "domcontentloaded" });
  }

  return { id };
}

function listTabs() {
  const ids = Array.from(pages.keys());
  return {
    activeId: activePageId,
    ids,
  };
}

async function switchTab(id) {
  await ensurePage();
  const targetId = String(id);
  if (!pages.has(targetId)) {
    throw new Error(`Unknown tab id: ${targetId}`);
  }
  activePageId = targetId;
  const p = pages.get(targetId);
  await p.bringToFront();
  return { id: targetId };
}

async function saveStorageState(storageStatePath = getStorageStatePath()) {
  if (!context) {
    await ensurePage();
  }
  await ensureAuthDir(storageStatePath);
  await context.storageState({ path: storageStatePath });
  return storageStatePath;
}

async function clearStorageState(storageStatePath = getStorageStatePath()) {
  try {
    await fs.unlink(storageStatePath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return storageStatePath;
    }
    throw err;
  }
  return storageStatePath;
}

async function clickAnyFrame(selector, timeoutMs = 30000) {
  const p = await ensurePage();
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    for (const frame of p.frames()) {
      try {
        await frame.click(selector, { timeout: 1000 });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    await p.waitForTimeout(200);
  }

  throw lastError ?? new Error(`clickAnyFrame timeout: ${selector}`);
}

async function fillAnyFrame(selector, text, timeoutMs = 30000) {
  const p = await ensurePage();
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    for (const frame of p.frames()) {
      try {
        await frame.fill(selector, text, { timeout: 1000 });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    await p.waitForTimeout(200);
  }

  throw lastError ?? new Error(`fillAnyFrame timeout: ${selector}`);
}

async function waitForSelectorAnyFrame(selector, timeoutMs = 30000) {
  const p = await ensurePage();
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    for (const frame of p.frames()) {
      try {
        await frame.waitForSelector(selector, { timeout: 1000 });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    await p.waitForTimeout(200);
  }

  throw lastError ?? new Error(`waitForSelectorAnyFrame timeout: ${selector}`);
}

async function innerTextAnyFrame(selector, timeoutMs = 30000) {
  const p = await ensurePage();
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    for (const frame of p.frames()) {
      try {
        const text = await frame.locator(selector).first().innerText({ timeout: 1000 });
        return text;
      } catch (err) {
        lastError = err;
      }
    }
    await p.waitForTimeout(200);
  }

  throw lastError ?? new Error(`innerTextAnyFrame timeout: ${selector}`);
}

async function boundingBoxAnyFrame(selector, timeoutMs = 30000) {
  const p = await ensurePage();
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    for (const frame of p.frames()) {
      try {
        const locator = frame.locator(selector).first();
        const box = await locator.boundingBox({ timeout: 1000 });
        if (box) {
          // boundingBox() is frame-viewport relative. For coordinate clicking we need
          // page viewport coordinates, so add iframe offset when inside a child frame.
          let offsetX = 0;
          let offsetY = 0;
          if (frame !== p.mainFrame()) {
            const el = await frame.frameElement();
            const frameBox = await el.boundingBox({ timeout: 1000 });
            if (frameBox) {
              offsetX = frameBox.x;
              offsetY = frameBox.y;
            }
          }

          const x = box.x + offsetX;
          const y = box.y + offsetY;
          const width = box.width;
          const height = box.height;

          return {
            frameUrl: frame.url(),
            x,
            y,
            width,
            height,
            cx: x + width / 2,
            cy: y + height / 2,
          };
        }
      } catch (err) {
        lastError = err;
      }
    }
    await p.waitForTimeout(200);
  }

  throw lastError ?? new Error(`boundingBoxAnyFrame timeout: ${selector}`);
}

async function closeBrowser() {
  // Best-effort: persist auth state so sessions survive restarts.
  // Can be disabled via PLAYWRIGHT_AUTO_SAVE_STORAGE_STATE=0
  try {
    const autoSave = process.env.PLAYWRIGHT_AUTO_SAVE_STORAGE_STATE;
    const enabled = autoSave == null ? true : !/^(0|false|no)$/i.test(String(autoSave).trim());
    if (enabled && context) {
      await saveStorageState();
    }
  } catch {
    // Do not block shutdown if state save fails.
  }

  try {
    for (const p of pages.values()) {
      try {
        await p.close();
      } catch {
        // ignore
      }
    }
    pages = new Map();
    activePageId = null;
    page = null;
  } finally {
    page = null;
  }

  try {
    if (context) await context.close();
  } finally {
    context = null;
  }

  try {
    if (browser) await browser.close();
  } finally {
    browser = null;
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "browser_navigate",
        description: "Navigate the browser to a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
      {
        name: "browser_click",
        description: "Click an element by CSS selector. Also supports viewport coordinate clicks via selector syntax 'xy:<x>,<y>' (e.g. 'xy:120,64').",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
          },
          required: ["selector"],
        },
      },
      {
        name: "browser_click_xy",
        description: "Click at viewport coordinates (x,y) using the mouse",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            button: { type: "string", enum: ["left", "middle", "right"] },
            clickCount: { type: "number" },
          },
          required: ["x", "y"],
        },
      },
      {
        name: "browser_fill",
        description: "Fill an input by CSS selector",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
            text: { type: "string" },
          },
          required: ["selector", "text"],
        },
      },
      {
        name: "browser_press",
        description: "Press a key (e.g. Enter, Tab)",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
          },
          required: ["key"],
        },
      },
      {
        name: "browser_wait_for",
        description: "Wait for a selector to appear (or a timeout)",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
            timeoutMs: { type: "number" },
          },
          required: [],
        },
      },
      {
        name: "browser_screenshot",
        description: "Take a PNG screenshot of the current page",
        inputSchema: {
          type: "object",
          properties: {
            fullPage: { type: "boolean" },
          },
          required: [],
        },
      },
      {
        name: "browser_get_text",
        description: "Get innerText of an element",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
          },
          required: ["selector"],
        },
      },
      {
        name: "browser_get_html",
        description: "Get the full page HTML content",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "browser_close",
        description: "Close the browser and clear session state",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "browser_new_tab",
        description: "Open a new browser tab (page). Optionally navigate to a URL.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: [],
        },
      },
      {
        name: "browser_list_tabs",
        description: "List open tabs and the active tab id.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "browser_switch_tab",
        description: "Switch active tab by id.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "browser_save_storage_state",
        description:
          "Save browser storageState (cookies/localStorage) to a JSON file so login can persist across restarts.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional override path. Default: .auth/storageState.json (or PLAYWRIGHT_STORAGE_STATE_PATH env var).",
            },
          },
          required: [],
        },
      },
      {
        name: "browser_clear_storage_state",
        description:
          "Delete the persisted storageState JSON (forces a fresh login next time).",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Optional override path. Default: .auth/storageState.json (or PLAYWRIGHT_STORAGE_STATE_PATH env var).",
            },
          },
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    if (toolName === "browser_navigate") {
      const p = await ensurePage();
      await p.goto(String(args.url), { waitUntil: "domcontentloaded" });
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_click") {
      const selector = String(args.selector);
      const xyMatch = selector.match(/^\s*xy\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if (xyMatch) {
        const p = await ensurePage();
        const x = Number(xyMatch[1]);
        const y = Number(xyMatch[2]);
        await p.mouse.click(x, y);
      } else {
        await clickAnyFrame(selector, args.timeoutMs == null ? 30000 : Number(args.timeoutMs));
      }
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_click_xy") {
      const p = await ensurePage();
      const x = Number(args.x);
      const y = Number(args.y);
      const button = args.button == null ? "left" : String(args.button);
      const clickCount = args.clickCount == null ? 1 : Number(args.clickCount);

      await p.mouse.click(x, y, { button, clickCount });
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_fill") {
      await fillAnyFrame(
        String(args.selector),
        String(args.text),
        args.timeoutMs == null ? 30000 : Number(args.timeoutMs)
      );
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_press") {
      const p = await ensurePage();
      await p.keyboard.press(String(args.key));
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_wait_for") {
      const timeout = args.timeoutMs == null ? 30000 : Number(args.timeoutMs);
      if (args.selector) {
        await waitForSelectorAnyFrame(String(args.selector), timeout);
      } else {
        const p = await ensurePage();
        await p.waitForTimeout(timeout);
      }
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_screenshot") {
      const p = await ensurePage();
      const fullPage = args.fullPage == null ? true : Boolean(args.fullPage);
      const png = await p.screenshot({ type: "png", fullPage });
      return {
        content: [
          {
            type: "image",
            data: Buffer.from(png).toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    }

    if (toolName === "browser_get_text") {
      const selector = String(args.selector);
      const timeoutMs = args.timeoutMs == null ? 30000 : Number(args.timeoutMs);

      if (/^__save_storage_state__$/i.test(selector)) {
        const savedTo = await saveStorageState();
        return { content: [{ type: "text", text: JSON.stringify({ savedTo }) }] };
      }

      if (/^__clear_storage_state__$/i.test(selector)) {
        const cleared = await clearStorageState();
        return { content: [{ type: "text", text: JSON.stringify({ cleared }) }] };
      }

      if (/^__viewport__$/i.test(selector)) {
        const p = await ensurePage();
        const vp = p.viewportSize();
        const text = vp ? JSON.stringify(vp) : "null";
        return { content: [{ type: "text", text }] };
      }

      const bboxMatch = selector.match(/^\s*bbox\s*:\s*(.+)$/i);
      if (bboxMatch) {
        const box = await boundingBoxAnyFrame(String(bboxMatch[1]).trim(), timeoutMs);
        return { content: [{ type: "text", text: JSON.stringify(box) }] };
      }

      const text = await innerTextAnyFrame(selector, timeoutMs);
      return { content: [{ type: "text", text }] };
    }

    if (toolName === "browser_get_html") {
      const p = await ensurePage();
      const html = await p.content();
      return { content: [{ type: "text", text: html }] };
    }

    if (toolName === "browser_close") {
      await closeBrowser();
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_new_tab") {
      const result = await newTab(args.url);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    if (toolName === "browser_list_tabs") {
      return { content: [{ type: "text", text: JSON.stringify(listTabs()) }] };
    }

    if (toolName === "browser_switch_tab") {
      const result = await switchTab(args.id);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    if (toolName === "browser_save_storage_state") {
      const statePath = args.path ? path.resolve(String(args.path)) : getStorageStatePath();
      const savedTo = await saveStorageState(statePath);
      return { content: [{ type: "text", text: JSON.stringify({ savedTo }) }] };
    }

    if (toolName === "browser_clear_storage_state") {
      const statePath = args.path ? path.resolve(String(args.path)) : getStorageStatePath();
      const cleared = await clearStorageState(statePath);
      return { content: [{ type: "text", text: JSON.stringify({ cleared }) }] };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: message }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});
