import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const rows = await db.all(`
  select id, title, substr(body,1,240) as body
  from news_items
  where source='FINNHUB' and source_type='company_news' and publisher='FINNHUB'
    and (
      body like '%Seeking Alpha%'
      or body like '%(Reuters)%'
      or body like '%Benzinga%'
      or body like '%MarketWatch%'
      or body like '%TipRanks%'
    )
  limit 20
`);
console.log(JSON.stringify(rows, null, 2));
await db.close();
