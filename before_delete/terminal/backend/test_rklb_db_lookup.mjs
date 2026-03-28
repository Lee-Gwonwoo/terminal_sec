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

const queries = [
  {
    label: "uuid_or_exact_titles",
    sql: `
      select id, source, source_type, title, published_at, publisher, url, origin_url
      from news_items
      where id = ?
         or title = ?
         or title = ?
      order by published_at desc
    `,
    params: [
      "c65d1d2e-718c-4795-bcd0-6d5f6b1419b0",
      "Rocket Lab Lands $190 Million Mega Deal For Hypersonic Launches",
      "Rocket Lab Enters Agreement For Up To $1B At-The-Market Stock Offering",
    ],
  },
  {
    label: "pattern_lookup",
    sql: `
      select id, source, source_type, title, published_at, publisher, url, origin_url
      from news_items
      where lower(title) like '%rocket lab%'
        and (
          lower(title) like '%hype%'
          or lower(title) like '%haste%'
          or lower(title) like '%190m%'
          or lower(title) like '%mega deal%'
          or lower(title) like '%at-the-market%'
          or lower(title) like '%$1b%'
          or lower(title) like '%1b%'
        )
      order by published_at desc
      limit 50
    `,
    params: [],
  },
  {
    label: "uuid_prefix_match",
    sql: `
      select id, source, source_type, title, published_at, publisher, url, origin_url
      from news_items
      where id like '%c65d1d2e%'
      order by published_at desc
    `,
    params: [],
  },
];

for (const query of queries) {
  const rows = await db.all(query.sql, query.params);
  console.log(`\n=== ${query.label} ===`);
  console.log(JSON.stringify(rows, null, 2));
}

await db.close();