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

const before = await db.get(
  "select count(*) as c from news_items where source = ?",
  "Mock Wire"
);
console.log("Mock Wire rows BEFORE:", before);

const result = await db.run(
  "delete from news_items where source = ?",
  "Mock Wire"
);
console.log("Deleted rows:", result.changes ?? null);

const after = await db.get(
  "select count(*) as c from news_items where source = ?",
  "Mock Wire"
);
console.log("Mock Wire rows AFTER:", after);

await db.close();
