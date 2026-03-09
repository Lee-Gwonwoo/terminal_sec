// calendarIngestion.ts — IBKR 캘린더 인제션
// Step 6-1 (2026-03-06): mock_provider 생성기 코드 전면 제거.
// Step 6-3 (구현 완료): Python child_process bridge를 통한 WSH calendar pull.
// Step 9-1/9-2: mode 기반 날짜 범위 계약 추가 (backfill / refresh).

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WSH_SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "scripts", "ibkr_wsh_calendar.py",
);

const MAX_STDOUT_BYTES = 50 * 1024 * 1024; // 50 MB safety limit

/** IBKR WSH API에서 가져온 캘린더 이벤트 (정규화 후) */
export interface IbkrCalendarEvent {
  type: string;        // earnings | dividends | splits | analyst_ratings | sec_filings | economics
  eventTime: string;   // ISO 8601
  ticker?: string;
  title: string;
  fieldsJson: Record<string, unknown>;
  uniqueKey: string;   // 중복 방지용 결정적 키
}

export interface IbkrCalendarResult {
  events: IbkrCalendarEvent[];
  source: "IBKR";
  mode: CalendarUpdateMode;
  dateRange: { from: string; to: string };
}

/** Calendar update 모드 */
export type CalendarUpdateMode = "backfill" | "refresh";

/** 모드별 기본 날짜 범위 계산 (ISO date string, YYYY-MM-DD) */
export function getCalendarDateRange(mode: CalendarUpdateMode): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (mode === "backfill") {
    // 과거 2년 + 미래 180일
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - 2);
    const to = new Date(now);
    to.setDate(to.getDate() + 180);
    return { from: fmt(from), to: fmt(to) };
  }
  // refresh: 최근 30일 overlap + 앞으로 90일
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const to = new Date(now);
  to.setDate(to.getDate() + 90);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * IBKR WSH API에서 캘린더 이벤트를 수집한다.
 * Python child_process 브리지를 통해 IBKR TWS 소켓 API에 접속한다.
 */
export async function pullIbkrCalendar(
  tickers: string[],
  mode: CalendarUpdateMode = "backfill",
): Promise<IbkrCalendarResult> {
  const dateRange = getCalendarDateRange(mode);

  if (tickers.length === 0) {
    return { events: [], source: "IBKR", mode, dateRange };
  }

  return runWshScript(tickers, dateRange, mode);
}

/**
 * Custom date range calendar pull.
 */
export async function pullIbkrCalendarCustom(
  tickers: string[],
  from: string,
  to: string,
): Promise<IbkrCalendarResult> {
  const dateRange = { from, to };
  const mode: CalendarUpdateMode = "backfill"; // custom is treated as backfill for result typing

  if (tickers.length === 0) {
    return { events: [], source: "IBKR", mode, dateRange };
  }

  return runWshScript(tickers, dateRange, mode);
}

function runWshScript(
  tickers: string[],
  dateRange: { from: string; to: string },
  mode: CalendarUpdateMode,
): Promise<IbkrCalendarResult> {
  const args = [
    WSH_SCRIPT_PATH,
    "--tickers", tickers.join(","),
    "--start-date", dateRange.from,
    "--end-date", dateRange.to,
  ];

  return new Promise<IbkrCalendarResult>((resolve, reject) => {
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
        reject(new Error(`stdout exceeded ${MAX_STDOUT_BYTES} bytes`));
        return;
      }
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python WSH script: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 2) {
        reject(new Error(`Permanent error (WSH calendar): ${stderr.trim()}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Python WSH exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      // Parse NDJSON stdout
      const events: IbkrCalendarEvent[] = [];
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const evt = JSON.parse(line) as IbkrCalendarEvent;
          if (evt.type && evt.uniqueKey) {
            events.push(evt);
          }
        } catch {
          // skip non-JSON lines
        }
      }

      if (stderr.trim()) {
        console.log(`[calendarIngestion] stderr:\n${stderr.trim()}`);
      }

      resolve({ events, source: "IBKR", mode, dateRange });
    });
  });
}
