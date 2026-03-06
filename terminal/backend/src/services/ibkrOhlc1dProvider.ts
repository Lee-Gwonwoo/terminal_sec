// ibkrOhlc1dProvider.ts — IBKR 1D OHLCV bars via Python child_process bridge (Step 7-3)

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OhlcBar } from "./ohlcWatchlistRepository.js";

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "scripts", "ibkr_fetch_ohlc.py",
);

const MAX_STDOUT_BYTES = 50 * 1024 * 1024; // 50 MB safety limit

export interface FetchOhlcResult {
  symbol: string;
  bars: OhlcBar[];
  stderrLog: string;
}

/**
 * Fetch 1D OHLCV bars for a single symbol from IBKR via Python script.
 * @param symbol - e.g. "AAPL"
 * @param startDate - "YYYY-MM-DD" inclusive
 * @param endDate - "YYYY-MM-DD" inclusive
 * @param port - TWS/Gateway port (default 4001)
 */
export function fetchOhlcBars(
  symbol: string,
  startDate: string,
  endDate: string,
  port = 4001,
): Promise<FetchOhlcResult> {
  return new Promise((resolve, reject) => {
    const args = [
      SCRIPT_PATH,
      "--symbol", symbol,
      "--start", startDate,
      "--end", endDate,
      "--port", String(port),
    ];

    const proc = spawn("python", args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        proc.kill("SIGTERM");
        reject(new Error(`stdout exceeded ${MAX_STDOUT_BYTES} bytes for ${symbol}`));
        return;
      }
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python for ${symbol}: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 2) {
        reject(new Error(`Permanent error for ${symbol}: ${stderr.trim()}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code} for ${symbol}: ${stderr.trim()}`));
        return;
      }

      // Parse ndjson stdout
      const bars: OhlcBar[] = [];
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const bar = JSON.parse(line) as OhlcBar;
          if (bar.Datetime && typeof bar.Open === "number") {
            bars.push(bar);
          }
        } catch {
          // skip non-JSON lines (e.g. progress messages)
        }
      }

      // Sort ascending by date
      bars.sort((a, b) => a.Datetime.localeCompare(b.Datetime));

      resolve({ symbol, bars, stderrLog: stderr.trim() });
    });
  });
}
