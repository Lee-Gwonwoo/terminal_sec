import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({ filename: "./backend/data/app.db", driver: sqlite3.Database });

const sources = await db.all(
  "SELECT source, COUNT(*) as count FROM news_items GROUP BY source ORDER BY count DESC LIMIT 50"
);
console.log("Sources:", sources);

const eodRows = await db.all(
  "SELECT published_at, source, source_type, title, url FROM news_items WHERE source = ? OR url LIKE ? ORDER BY published_at DESC LIMIT 25",
  ["EODHD", "%eodhd%"]
);
console.log("EODHD-ish rows (latest):", eodRows);

const byDay = await db.all(
  "SELECT substr(published_at, 1, 10) as day, COUNT(*) as count FROM news_items WHERE source = ? OR url LIKE ? GROUP BY day ORDER BY day DESC LIMIT 20",
  ["EODHD", "%eodhd%"]
);
console.log("EODHD-ish by day:", byDay);

await db.close();
