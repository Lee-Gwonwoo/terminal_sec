/**
 * investingBrowser.ts — shared headed Chrome context for investing.com scraping.
 *
 * Since ~2026-06 Cloudflare hard-blocks headless browsers on investing.com with
 * a "Performing security verification" interstitial that never resolves, which
 * silently broke both listing pulls and fulltext extraction. A headed real
 * Chrome with a persistent profile passes the managed challenge automatically
 * (~5s the first time; afterwards the cf_clearance cookie stored in the profile
 * skips it entirely). The window is parked far off-screen so it stays out of
 * the way. Do NOT override the user agent: a UA that disagrees with the real
 * browser build is itself a bot signal.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
// Patchright is a drop-in Playwright replacement that patches the CDP-level
// automation leaks (Runtime.enable, console.context, navigator.webdriver) that
// vanilla Playwright exposes and that Cloudflare fingerprints — the reason
// listing pulls kept getting 403'd regardless of IP. API-compatible with
// playwright, so only the import changes.
import { chromium, type BrowserContext, type Page } from "patchright";
import { config } from "../config.js";

const PROFILE_DIR_NAME = "investing-browser-profile";
const CHALLENGE_TITLE_PATTERN = /just a moment|security verification|attention required/i;
// Give managed challenges plenty of time to auto-solve, and leave room for a
// human to click an interactive Turnstile checkbox when the window is visible.
const CHALLENGE_CLEAR_TIMEOUT_MS = 90_000;

// The old approach was pure headless (no window at all), which Cloudflare began
// hard-blocking around 2026-06 — that is what silently broke Investing pulls.
// A real Chrome parked off-screen behaves like a normal browser (so the managed
// challenge auto-solves on a trusted/residential IP) while staying invisible,
// which is the closest thing to the old no-window experience. Only when an
// interactive challenge is served (typical on flagged/VPN/datacenter IPs) does
// it need to be on-screen so the user can click it once; set
// INVESTING_BROWSER_VISIBLE=1 for that case.
const BROWSER_VISIBLE = process.env.INVESTING_BROWSER_VISIBLE === "1";

const CHALLENGE_TEXT_MARKERS = [
  "Enable JavaScript and cookies to continue",
  "challenge-error-text",
  "cf_chl_opt",
  "cdn-cgi/challenge-platform",
  "Just a moment...",
  "Performing security verification",
  "security service to protect against malicious bots",
];

let sharedContextPromise: Promise<BrowserContext> | null = null;

function profileDir(): string {
  return path.join(path.dirname(path.resolve(config.sqlitePath)), PROFILE_DIR_NAME);
}

/**
 * A crashed/killed Chrome can leave a SingletonLock in the profile that makes
 * every subsequent launch fail with a confusing "bundled chromium not found"
 * error (Playwright falls all the way through the channel fallbacks). Clear the
 * stale lock files before launching so the shared browser can recover on its own.
 */
function clearStaleProfileLocks(): void {
  const dir = profileDir();
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try {
      fs.rmSync(path.join(dir, name), { force: true });
    } catch {
      // best-effort — a lock we cannot remove will surface as a launch error below
    }
  }
}

/**
 * When the server is killed/restarted (e.g. tsx watch reloads on a file change),
 * the previous run's headed Chrome children are orphaned and keep the profile
 * locked, so the next launch can't reuse it. Since this is a single-user Windows
 * desktop app, proactively kill any Chrome/Edge process still bound to OUR
 * profile directory before launching. Best-effort and Windows-only.
 */
function killStrayProfileProcesses(): void {
  if (process.platform !== "win32") return;
  const dir = profileDir();
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | ` +
          `Where-Object { $_.CommandLine -like '*${PROFILE_DIR_NAME}*' } | ` +
          `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore", timeout: 15_000, windowsHide: true },
    );
  } catch {
    // best-effort — a surviving stray will surface as a launch error below
  }
  void dir;
}

async function launchContext(): Promise<BrowserContext> {
  killStrayProfileProcesses();
  clearStaleProfileLocks();
  // Patchright manages the stealth/automation flags itself — the docs warn
  // against tampering with args, custom UA, or a fixed viewport, all of which
  // re-expose automation. Keep only the off-screen/window placement.
  const options = {
    headless: false,
    viewport: null,
    locale: "en-US",
    args: BROWSER_VISIBLE
      ? ["--window-position=60,60", "--window-size=1280,900"]
      : ["--window-position=-32000,-32000"],
  };
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir(), { ...options, channel: "chrome" });
  } catch {
    try {
      context = await chromium.launchPersistentContext(profileDir(), { ...options, channel: "msedge" });
    } catch {
      context = await chromium.launchPersistentContext(profileDir(), options);
    }
  }
  await warmUpSession(context);
  return context;
}

/**
 * Session warm-up: before hitting listing pages, load the homepage first so the
 * browser behaves like a human arriving at the site — it solves the managed
 * challenge once and banks the cf_clearance cookie, so the subsequent listing
 * requests reuse it instead of each tripping a fresh challenge. Best-effort: a
 * blocked warm-up doesn't fail the launch (the caller's own checks handle it).
 */
async function warmUpSession(context: BrowserContext): Promise<void> {
  const page = await context.newPage().catch(() => null);
  if (!page) return;
  try {
    await page.goto("https://www.investing.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitForChallengeClear(page);
    await page.waitForTimeout(1500).catch(() => undefined);
  } catch {
    // best-effort — proceed even if the homepage was blocked
  } finally {
    await page.close().catch(() => undefined);
  }
}

let shutdownHooksRegistered = false;

/**
 * Close the shared browser when the server exits so its Chrome children don't
 * orphan and lock the profile against the next start. tsx watch sends SIGTERM
 * on reload; Ctrl-C sends SIGINT.
 */
function registerShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;
  const closeSync = () => {
    const pending = sharedContextPromise;
    sharedContextPromise = null;
    if (!pending) return;
    // Fire-and-forget: signal handlers can't await, but Playwright's close
    // still sends the browser a graceful-shutdown request before we exit.
    pending.then((context) => context.close()).catch(() => undefined);
  };
  process.once("SIGINT", () => { closeSync(); process.exit(130); });
  process.once("SIGTERM", () => { closeSync(); process.exit(143); });
  process.once("beforeExit", closeSync);
}

/**
 * Cloudflare can revoke the cf_clearance token stored in the profile (typically
 * after a burst of automated requests trips a WAF rule), after which every
 * request carrying that poisoned cookie is hard-403'd regardless of IP. A fresh
 * profile with no cookies re-solves the managed challenge cleanly. So on a hard
 * block we discard the whole profile and relaunch from scratch. Best-effort.
 */
export async function resetInvestingBrowserProfile(): Promise<void> {
  const pending = sharedContextPromise;
  sharedContextPromise = null;
  if (pending) {
    try {
      const context = await pending;
      await context.close();
    } catch {
      // context may already be closed/broken
    }
  }
  // Force-kill any surviving Chrome so it releases the profile's file handles,
  // then delete the profile completely. A PARTIAL deletion (cookies gone but
  // other state left behind while Chrome still held handles) yields a corrupted
  // profile that can't solve the challenge, so retry until the directory is gone.
  killStrayProfileProcesses();
  const dir = profileDir();
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) return;
    } catch {
      // Chrome may still be releasing handles — wait and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
}

export async function getInvestingBrowserContext(): Promise<BrowserContext> {
  if (!sharedContextPromise) {
    registerShutdownHooks();
    const launched = launchContext();
    sharedContextPromise = launched;
    launched
      .then((context) => {
        // If the browser dies (crash, user closes the window), allow relaunch.
        context.on("close", () => {
          if (sharedContextPromise === launched) sharedContextPromise = null;
        });
      })
      .catch(() => {
        if (sharedContextPromise === launched) sharedContextPromise = null;
      });
  }
  return sharedContextPromise;
}

/**
 * Wait until the Cloudflare interstitial (if any) clears on the page.
 * Returns without throwing on timeout — callers' content checks surface
 * the block explicitly.
 */
export async function waitForChallengeClear(page: Page): Promise<void> {
  const deadline = Date.now() + CHALLENGE_CLEAR_TIMEOUT_MS;
  for (;;) {
    const title = await page.title().catch(() => "");
    const blocked = CHALLENGE_TITLE_PATTERN.test(title) || page.url().includes("__cf_chl");
    if (!blocked) return;
    if (Date.now() >= deadline) return;
    await page.waitForTimeout(1000);
  }
}

/** Detect a Cloudflare challenge page from HTML or visible body text. */
export function isCloudflareChallengeText(text: string): boolean {
  return CHALLENGE_TEXT_MARKERS.some((marker) => text.includes(marker));
}
