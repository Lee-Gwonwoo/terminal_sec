import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.resolve(process.cwd(), 'backend', 'data', 'app.db');

function runQuery(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, async (err) => {
  if (err) { console.error('DB open error:', err.message); process.exit(1); }
});

const stats = db.prepare(`
  SELECT COUNT(*) as cnt, MIN(published_at) as oldest, MAX(published_at) as newest 
  FROM news_items WHERE source_type='market_news'
`).get();
console.log('=== market_news 전체 ===');
console.log('총 건수:', stats.cnt);
console.log('가장 오래된:', stats.oldest);
console.log('가장 최근:', stats.newest);
console.log('');

const byMonth = db.prepare(`
  SELECT substr(published_at,1,7) as month, COUNT(*) as cnt 
  FROM news_items WHERE source_type='market_news' 
  GROUP BY month ORDER BY month
`).all();
console.log('=== 월별 분포 ===');
byMonth.forEach(r => console.log(r.month, ':', r.cnt, '건'));

// 전체 source_type 분포
const byType = db.prepare(`
  SELECT source_type, COUNT(*) as cnt FROM news_items GROUP BY source_type ORDER BY cnt DESC
`).all();
console.log('\n=== source_type 분포 ===');
byType.forEach(r => console.log(r.source_type, ':', r.cnt, '건'));

db.close();
