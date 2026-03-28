import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
  filename: './backend/data/app.db',
  driver: sqlite3.Database,
});

const sampleSql = `
SELECT published_at, tickers_csv, publisher, title, SUBSTR(body, 1, 260) AS body
FROM news_items
WHERE source = 'FINNHUB'
  AND source_type = 'company_news'
  AND published_at >= '2025-01-01'
  AND (
    LOWER(title) LIKE '%why %'
    OR LOWER(title) LIKE '%tumbles%'
    OR LOWER(title) LIKE '%surges%'
    OR LOWER(title) LIKE '%sell-off%'
    OR LOWER(title) LIKE '%stocks fell%'
    OR LOWER(title) LIKE '%stocks rise%'
    OR LOWER(body) LIKE '%because%'
    OR LOWER(body) LIKE '%driven by%'
  )
ORDER BY published_at DESC
LIMIT 25
`;

const countSql = `
SELECT er.case_type, COUNT(*) AS cnt
FROM model2_evidence_rows er
JOIN news_items ni ON ni.id = er.news_id
WHERE er.analysis_id = '6ec343f2-d7be-43e1-9297-90e5c35643ea'
  AND ni.source = 'FINNHUB'
  AND ni.source_type = 'company_news'
  AND (
    LOWER(ni.title) LIKE '%why %'
    OR LOWER(ni.title) LIKE '%tumbles%'
    OR LOWER(ni.title) LIKE '%surges%'
    OR LOWER(ni.title) LIKE '%sell-off%'
  )
GROUP BY er.case_type
ORDER BY cnt DESC
`;

const samples = await db.all(sampleSql);
const counts = await db.all(countSql);

console.log(JSON.stringify({ counts, samples }, null, 2));
await db.close();
