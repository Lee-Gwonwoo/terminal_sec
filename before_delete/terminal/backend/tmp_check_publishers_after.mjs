import { open } from "sqlite";
import sqlite3 from "sqlite3";
const db = await open({ filename: './backend/data/app.db', driver: sqlite3.Database });
const counts = await db.all("select publisher, count(*) as cnt from news_items where source='FINNHUB' and source_type='company_news' and publisher in ('FINNHUB','SEEKINGALPHA','BENZINGA','REUTERS','TIPRANKS') group by publisher order by cnt desc");
const sample = await db.all("select id,title,publisher from news_items where id in ('4d57f8cf-de14-47ed-b3d3-02e3c0a87a9b','f77c2765-df46-4155-bef9-be32ccb523c8','d4ac22ec-0a36-4652-91a3-1791ee6fd65c') order by id");
console.log(JSON.stringify({ counts, sample }, null, 2));
await db.close();
