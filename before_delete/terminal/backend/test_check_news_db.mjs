import path from "node:path";
import fs from "node:fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const dbPath = path.resolve("./backend/data/app.db");
console.log("DB", dbPath, "exists=", fs.existsSync(dbPath));

if (!fs.existsSync(dbPath)) {
  process.exit(0);
}

const db = await open({ filename: dbPath, driver: sqlite3.Database });

const sources = await db.all(
  "select source, count(*) as c from news_items group by source order by c desc"
);
console.log("news_items sources:", sources);

const sourceTypes = await db.all(
  "select source_type, count(*) as c from news_items group by source_type order by c desc"
);
console.log("news_items source_type:", sourceTypes);

const mockish = await db.get(
  "select count(*) as c from news_items where lower(source) like '%mock%' or lower(source_type) like '%mock%' or lower(title) like '%mock%' or lower(body) like '%mock%'"
);
console.log("news_items mockish_count:", mockish);

await db.close();
