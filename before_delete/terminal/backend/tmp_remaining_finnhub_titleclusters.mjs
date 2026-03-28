import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const rows = await db.all(`
  select title, count(*) as cnt
  from news_items
  where source='FINNHUB' and source_type='company_news' and publisher='FINNHUB'
  group by substr(title,1,60)
  order by cnt desc
  limit 20
`);
console.log(JSON.stringify(rows, null, 2));
await db.close();
