import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const rows = await db.all(`
  select id, title, publisher
  from news_items
  where id in (
    'd99d7c2f-d9b7-4926-a771-721c3c059875',
    'c2d868d3-e03d-454e-ac87-b856c8b538b6',
    '19c77389-4926-4e43-b540-1d9b6608bf78',
    '42a006b1-99a8-49c4-a9a8-c8ebfe8ab5ba'
  )
  order by id
`);
const counts = await db.all("select publisher, count(*) as cnt from news_items where source='FINNHUB' and source_type='company_news' and publisher in ('FINNHUB','YAHOO') group by publisher order by cnt desc");
console.log(JSON.stringify({ rows, counts }, null, 2));
await db.close();
