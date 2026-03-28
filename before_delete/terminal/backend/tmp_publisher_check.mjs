import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const rows = await db.all("select publisher, count(*) as cnt from news_items where source='FINNHUB' and source_type='company_news' group by publisher order by cnt desc limit 12");
console.log(JSON.stringify(rows, null, 2));
const sample = await db.get("select id,title,url,origin_url,publisher from news_items where source='FINNHUB' and source_type='company_news' and publisher='FINNHUB' order by published_at desc limit 1");
console.log(JSON.stringify(sample, null, 2));
await db.close();
