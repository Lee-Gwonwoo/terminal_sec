import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const rows = await db.all(`
  select id, title, substr(body,1,300) as body, url, origin_url, publisher
  from news_items
  where source='FINNHUB' and source_type='company_news' and publisher='FINNHUB'
    and (title like '%Yahoo%' or body like '%Yahoo%' or title like '%yahoo%' or body like '%yahoo%')
  order by published_at desc
  limit 20
`);
console.log(JSON.stringify(rows, null, 2));
await db.close();
