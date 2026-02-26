import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

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

async function ensurePage() {
  if (page) return page;

  browser = await chromium.launch({ headless: false });
  context = await browser.newContext();
  page = await context.newPage();

  return page;
}

async function closeBrowser() {
  try {
    if (page) await page.close();
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
        description: "Click an element by CSS selector",
        inputSchema: {
          type: "object",
          properties: {
            selector: { type: "string" },
          },
          required: ["selector"],
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
      const p = await ensurePage();
      await p.click(String(args.selector));
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_fill") {
      const p = await ensurePage();
      await p.fill(String(args.selector), String(args.text));
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_press") {
      const p = await ensurePage();
      await p.keyboard.press(String(args.key));
      return { content: [{ type: "text", text: "OK" }] };
    }

    if (toolName === "browser_wait_for") {
      const p = await ensurePage();
      const timeout = args.timeoutMs == null ? 30000 : Number(args.timeoutMs);
      if (args.selector) {
        await p.waitForSelector(String(args.selector), { timeout });
      } else {
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
      const p = await ensurePage();
      const selector = String(args.selector);
      const text = await p.locator(selector).innerText();
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
