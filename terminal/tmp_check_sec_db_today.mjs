import Database from 'better-sqlite3';
const db = new Database('./backend/data/app.db', { readonly: true });
const rows = db.prepare(`SELECT published_at, title, body, tickers_csv FROM news_items WHERE source='FINNHUB' AND source_type='sec_filing' AND published_at LIKE '2026-03-20%' ORDER BY published_at DESC LIMIT 20`).all();
console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
