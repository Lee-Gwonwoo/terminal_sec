import { upsertCalendarEvent } from "./calendarRepository.js";

const tickers = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD"];
const countries = ["US", "EU", "KR", "JP"];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function runEarningsWorker(): Promise<void> {
  const ticker = pickRandom(tickers);
  const date = new Date(Date.now() + (Math.floor(Math.random() * 5) + 1) * 3600_000);
  const timeOfDay = pickRandom(["BMO", "AMC", "Unknown"]);
  await upsertCalendarEvent({
    type: "earnings",
    eventTime: date.toISOString(),
    ticker,
    title: `${ticker} Earnings Update`,
    fieldsJson: {
      ticker,
      company_name: `${ticker} Corp`,
      report_date: date.toISOString().slice(0, 10),
      time_of_day: timeOfDay,
      eps_est: Number((Math.random() * 5 + 1).toFixed(2)),
      eps_actual: null,
      revenue_est: Math.round((Math.random() * 30 + 10) * 1_000_000_000),
      revenue_actual: null,
      surprise_pct: null
    },
    source: "mock_provider",
    uniqueKey: `earnings:${ticker}:${date.toISOString().slice(0, 13)}`
  });
}

async function runDividendsWorker(): Promise<void> {
  const ticker = pickRandom(tickers);
  const exDate = new Date(Date.now() + (Math.floor(Math.random() * 10) + 1) * 24 * 3600_000);
  const payDate = new Date(exDate.getTime() + 14 * 24 * 3600_000);
  await upsertCalendarEvent({
    type: "dividends",
    eventTime: exDate.toISOString(),
    ticker,
    title: `${ticker} Dividend Event`,
    fieldsJson: {
      ticker,
      ex_date: exDate.toISOString().slice(0, 10),
      pay_date: payDate.toISOString().slice(0, 10),
      amount: Number((Math.random() * 2).toFixed(2)),
      yield: Number((Math.random() * 0.03).toFixed(4))
    },
    source: "mock_provider",
    uniqueKey: `dividends:${ticker}:${exDate.toISOString().slice(0, 10)}`
  });
}

async function runSplitsWorker(): Promise<void> {
  const ticker = pickRandom(tickers);
  const splitDate = new Date(Date.now() + (Math.floor(Math.random() * 30) + 1) * 24 * 3600_000);
  await upsertCalendarEvent({
    type: "splits",
    eventTime: splitDate.toISOString(),
    ticker,
    title: `${ticker} Split Update`,
    fieldsJson: {
      ticker,
      split_date: splitDate.toISOString().slice(0, 10),
      ratio: pickRandom(["2:1", "3:1", "5:4"])
    },
    source: "mock_provider",
    uniqueKey: `splits:${ticker}:${splitDate.toISOString().slice(0, 10)}`
  });
}

async function runAnalystRatingsWorker(): Promise<void> {
  const ticker = pickRandom(tickers);
  const now = new Date();
  await upsertCalendarEvent({
    type: "analyst_ratings",
    eventTime: now.toISOString(),
    ticker,
    title: `${ticker} analyst note`,
    fieldsJson: {
      ticker,
      firm: pickRandom(["Mock Research", "Alpha Desk", "Street Labs"]),
      action: pickRandom(["upgrade", "downgrade", "initiate"]),
      rating: pickRandom(["Buy", "Hold", "Sell"]),
      price_target: Math.round(Math.random() * 400 + 80),
      date: now.toISOString().slice(0, 10)
    },
    source: "mock_provider",
    uniqueKey: `analyst:${ticker}:${now.toISOString().slice(0, 13)}`
  });
}

async function runSecFilingsWorker(): Promise<void> {
  const ticker = pickRandom(tickers);
  const filedAt = new Date();
  const formType = pickRandom(["8-K", "10-Q", "10-K", "S-1"]);
  await upsertCalendarEvent({
    type: "sec_filings",
    eventTime: filedAt.toISOString(),
    ticker,
    title: `${ticker} ${formType} filing`,
    fieldsJson: {
      ticker,
      form_type: formType,
      filed_at: filedAt.toISOString(),
      link: "https://www.sec.gov/edgar/search/"
    },
    source: "mock_provider",
    uniqueKey: `sec:${ticker}:${formType}:${filedAt.toISOString().slice(0, 13)}`
  });
}

async function runEconomicsWorker(): Promise<void> {
  const country = pickRandom(countries);
  const scheduled = new Date(Date.now() + (Math.floor(Math.random() * 8) + 1) * 3600_000);
  const eventName = pickRandom(["CPI m/m", "PPI y/y", "NFP", "Retail Sales"]);
  await upsertCalendarEvent({
    type: "economics",
    eventTime: scheduled.toISOString(),
    title: `${country} ${eventName}`,
    fieldsJson: {
      country,
      event_name: eventName,
      scheduled_time: scheduled.toISOString(),
      actual: null,
      forecast: Number((Math.random() * 1.5).toFixed(2)),
      previous: Number((Math.random() * 1.5).toFixed(2)),
      importance: pickRandom(["low", "medium", "high"])
    },
    source: "mock_provider",
    uniqueKey: `econ:${country}:${eventName}:${scheduled.toISOString().slice(0, 13)}`
  });
}

export function startCalendarIngestionWorkers(): void {
  const workers: Array<{ name: string; run: () => Promise<void>; everyMs: number }> = [
    { name: "earnings", run: runEarningsWorker, everyMs: 15000 },
    { name: "dividends", run: runDividendsWorker, everyMs: 24000 },
    { name: "splits", run: runSplitsWorker, everyMs: 30000 },
    { name: "analyst_ratings", run: runAnalystRatingsWorker, everyMs: 18000 },
    { name: "sec_filings", run: runSecFilingsWorker, everyMs: 12000 },
    { name: "economics", run: runEconomicsWorker, everyMs: 20000 }
  ];

  for (const worker of workers) {
    const runWithLog = async () => {
      try {
        await worker.run();
      } catch (error) {
        console.error(`[calendar-worker:${worker.name}] failed`, error);
      }
    };

    void runWithLog();
    setInterval(() => {
      void runWithLog();
    }, worker.everyMs);
  }
}
