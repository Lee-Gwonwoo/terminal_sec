import { getDb } from "./db.js";
import { upsertCalendarEvent } from "./services/calendarRepository.js";

export async function ensureSeedData(): Promise<void> {
  const db = getDb();
  await db.run(
    `INSERT OR IGNORE INTO users (id, email)
     VALUES (?, ?)`,
    ["11111111-1111-1111-1111-111111111111", "demo@local"]
  );

  await upsertCalendarEvent({
    type: "earnings",
    eventTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ticker: "NVDA",
    title: "NVIDIA Earnings Release",
    fieldsJson: {
      ticker: "NVDA",
      company_name: "NVIDIA Corp",
      report_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      time_of_day: "AMC",
      eps_est: 5.11,
      eps_actual: null,
      revenue_est: 38500000000,
      revenue_actual: null,
      surprise_pct: null
    },
    source: "mock_provider",
    uniqueKey: "earnings:NVDA:next"
  });

  await upsertCalendarEvent({
    type: "dividends",
    eventTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    ticker: "MSFT",
    title: "Microsoft Dividend",
    fieldsJson: {
      ticker: "MSFT",
      ex_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10),
      pay_date: new Date(Date.now() + 78 * 60 * 60 * 1000).toISOString().slice(0, 10),
      amount: 0.75,
      yield: 0.008
    },
    source: "mock_provider",
    uniqueKey: "dividend:MSFT:next"
  });

  await upsertCalendarEvent({
    type: "splits",
    eventTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ticker: "TSLA",
    title: "Tesla Split Proposal",
    fieldsJson: {
      ticker: "TSLA",
      split_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      ratio: "3:1"
    },
    source: "mock_provider",
    uniqueKey: "split:TSLA:next"
  });

  await upsertCalendarEvent({
    type: "analyst_ratings",
    eventTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    ticker: "AAPL",
    title: "Analyst upgrade for AAPL",
    fieldsJson: {
      ticker: "AAPL",
      firm: "Mock Street Research",
      action: "upgrade",
      rating: "Buy",
      price_target: 240,
      date: new Date().toISOString().slice(0, 10)
    },
    source: "mock_provider",
    uniqueKey: "rating:AAPL:today"
  });

  await upsertCalendarEvent({
    type: "sec_filings",
    eventTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    ticker: "TSLA",
    title: "TSLA 8-K filing",
    fieldsJson: {
      ticker: "TSLA",
      form_type: "8-K",
      filed_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      link: "https://www.sec.gov/"
    },
    source: "mock_provider",
    uniqueKey: "sec:TSLA:8k:next"
  });

  await upsertCalendarEvent({
    type: "economics",
    eventTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    title: "US CPI Release",
    fieldsJson: {
      country: "US",
      event_name: "CPI m/m",
      scheduled_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      actual: null,
      forecast: 0.3,
      previous: 0.2,
      importance: "high"
    },
    source: "mock_provider",
    uniqueKey: "econ:US:CPI:next"
  });
}
