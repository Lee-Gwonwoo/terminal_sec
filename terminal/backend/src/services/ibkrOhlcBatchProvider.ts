// ibkrOhlcBatchProvider.ts — Batch IBKR 1D OHLC via single Python process

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OhlcBar } from "./ohlcWatchlistRepository.js";

const BATCH_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "scripts", "ibkr_fetch_ohlc_batch.py",
);

const MAX_STDOUT_BYTES = 100 * 1024 * 1024; // 100 MB safety limit

export interface BatchFetchResult {
  symbol: string;
  bars: OhlcBar[];
  error: string | null;
}

/**
 * Fetch 1D OHLC bars for multiple symbols in one Python process.
 * Uses a single IBKR connection with concurrent reqHistoricalDataAsync.
 *
 * @param symbols - Array of ticker symbols
 * @param startDate - "YYYY-MM-DD" inclusive
 * @param endDate - "YYYY-MM-DD" inclusive
 * @param concurrency - Max concurrent IBKR requests (default 30, max 100)
 * @param port - TWS/Gateway port (default 4001)
 * @param clientId - IBKR client ID (default 85)
 * @param onProgress - Called with (completed, total) as results stream in
 */
export function fetchOhlcBatch(
  symbols: string[],
  startDate: string,
  endDate: string,
  concurrency = 30,
  port = 4001,
  clientId = 85,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchFetchResult[]> {
  if (symbols.length === 0) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      symbols,
      start: startDate,
      end: endDate,
      port,
      clientId,
      concurrency: Math.max(1, Math.min(100, concurrency)),
    });

    const proc = spawn("python", [BATCH_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        proc.kill("SIGTERM");
        reject(new Error(`stdout exceeded ${MAX_STDOUT_BYTES} bytes`));
        return;
      }
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      // Parse progress from stderr: "[batch] progress: 10/100"
      if (onProgress) {
        const match = text.match(/\[batch\] progress: (\d+)\/(\d+)/);
        if (match) {
          onProgress(parseInt(match[1], 10), parseInt(match[2], 10));
        }
      }
    });

    // Write input and close stdin
    proc.stdin.write(input);
    proc.stdin.end();

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn batch Python: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 1 && !stdout.trim()) {
        reject(new Error(`Batch script failed: ${stderr.trim()}`));
        return;
      }

      // Parse NDJSON results
      const results: BatchFetchResult[] = [];
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as BatchFetchResult;
          if (parsed.symbol) {
            // Sort bars ascending
            if (parsed.bars?.length) {
              parsed.bars.sort((a, b) => a.Datetime.localeCompare(b.Datetime));
            }
            results.push(parsed);
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      resolve(results);
    });
  });
}
