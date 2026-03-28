import { config } from './backend/src/config.js';
const tickers = ['AAPL','MSFT','NVDA','TSLA','FDX','BE','MSTR','SPOT','UPS','AMZN'];
const from = '2026-03-20';
const to = '2026-03-20';
for (const ticker of tickers) {
  const url = `https://finnhub.io/api/v1/stock/filings?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${config.finnhubApiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const count = Array.isArray(data) ? data.length : -1;
  console.log(JSON.stringify({ ticker, status: res.status, count, sample: Array.isArray(data) && data[0] ? { form: data[0].form, filedDate: data[0].filedDate, acceptedDate: data[0].acceptedDate, accessNumber: data[0].accessNumber } : null }));
}
