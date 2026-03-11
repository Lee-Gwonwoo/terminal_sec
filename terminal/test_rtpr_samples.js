// Test the new extractOriginUrl against actual DB samples
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Load the compiled extractor
const { extractOriginUrl } = require("./backend/dist/src/services/rtprOriginUrlExtractor.js");

const db = new sqlite3.Database(
  "./backend/backend/data/app.db",
  sqlite3.OPEN_READONLY
);

const queries = [
  // 1) Publisher counts with fulltext
  {
    label: "=== Publisher counts (with fulltext) ===",
    sql: `SELECT ni.publisher, COUNT(1) AS cnt
      FROM news_items ni
      JOIN news_fulltext nf ON ni.id=nf.news_id
      WHERE ni.source='RTPR'
      GROUP BY ni.publisher ORDER BY cnt DESC`,
  },
  // 2) Publisher counts with origin_url
  {
    label: "=== Publisher counts (with origin_url) ===",
    sql: `SELECT ni.publisher, COUNT(1) AS cnt
      FROM news_items ni
      WHERE ni.source='RTPR' AND ni.origin_url IS NOT NULL
      GROUP BY ni.publisher ORDER BY cnt DESC`,
  },
];

// Per-publisher: get 2 HTML samples showing the URL portion (last 800 chars)
const publishers = [
  "Business Wire",
  "PR Newswire",
  "Newsfile Corp",
  "GlobeNewsWire",
  "Globe Newswire",
  "ACCESSWIRE",
  "Cision",
];

function runQuery(label, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      console.log(label);
      console.log(JSON.stringify(rows, null, 2));
      console.log();
      resolve(rows);
    });
  });
}

function getSamples(publisher) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ni.publisher, ni.id, substr(nf.full_text, -800) AS tail
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id=nf.news_id
       WHERE ni.source='RTPR' AND ni.publisher=?
       LIMIT 3`,
      [publisher],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

// Check: ACCESSWIRE - old domain vs new
function checkAccesswire() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        SUM(CASE WHEN instr(nf.full_text,'accesswire.com') > 0 THEN 1 ELSE 0 END) AS old_domain,
        SUM(CASE WHEN instr(nf.full_text,'accessnewswire.com') > 0 THEN 1 ELSE 0 END) AS new_domain
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id=nf.news_id
       WHERE ni.source='RTPR' AND ni.publisher='ACCESSWIRE'`,
      [],
      (err, rows) => {
        if (err) reject(err);
        console.log("\n=== ACCESSWIRE domain check ===");
        console.log(JSON.stringify(rows, null, 2));
        resolve(rows);
      }
    );
  });
}

// Check GlobeNewswire for any non-tracker URLs
function checkGlobeNewswire() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ni.id, substr(nf.full_text, -500) AS tail
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id=nf.news_id
       WHERE ni.source='RTPR' AND ni.publisher='Globe Newswire'
       AND (instr(nf.full_text, 'globenewswire.com/news-release') > 0
         OR instr(nf.full_text, 'View original') > 0)
       LIMIT 3`,
      [],
      (err, rows) => {
        if (err) reject(err);
        console.log("\n=== Globe Newswire (non-tracker URL check) ===");
        if (rows && rows.length > 0) {
          for (const r of rows) {
            console.log(`--- id: ${r.id} ---`);
            console.log(r.tail);
            console.log();
          }
        } else {
          console.log("No non-tracker URLs found");
        }
        resolve(rows);
      }
    );
  });
}

// Check Cision pattern count
function checkCision() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ni.id, substr(nf.full_text, -500) AS tail
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id=nf.news_id
       WHERE ni.source='RTPR' AND ni.publisher='Cision'
       LIMIT 5`,
      [],
      (err, rows) => {
        if (err) reject(err);
        console.log("\n=== Cision (all samples) ===");
        if (rows && rows.length > 0) {
          for (const r of rows) {
            console.log(`--- id: ${r.id} ---`);
            console.log(r.tail);
            console.log();
          }
        } else {
          console.log("No samples");
        }
        resolve(rows);
      }
    );
  });
}

async function main() {
  for (const q of queries) {
    await runQuery(q.label, q.sql);
  }

  for (const pub of publishers) {
    const rows = await getSamples(pub);
    if (rows && rows.length > 0) {
      console.log(`\n=== ${pub} (${rows.length} samples) ===`);
      for (const r of rows) {
        console.log(`--- id: ${r.id} ---`);
        console.log(r.tail);
        console.log();
      }
    }
  }

  await checkAccesswire();
  await checkGlobeNewswire();
  await checkCision();

  // ===== Extraction test: run extractOriginUrl on all fulltext rows =====
  console.log("\n\n========== EXTRACTION TEST ==========");
  await new Promise((resolve, reject) => {
    db.all(
      `SELECT ni.id, ni.publisher, ni.origin_url AS existing_url, nf.full_text
       FROM news_items ni
       JOIN news_fulltext nf ON ni.id=nf.news_id
       WHERE ni.source='RTPR'`,
      [],
      (err, rows) => {
        if (err) { reject(err); return; }
        const stats = {};
        let extracted = 0;
        let failed = 0;
        for (const r of rows) {
          const url = extractOriginUrl(r.full_text);
          const pub = r.publisher || "unknown";
          if (!stats[pub]) stats[pub] = { total: 0, extracted: 0, failed: 0, samples: [] };
          stats[pub].total++;
          if (url) {
            stats[pub].extracted++;
            extracted++;
            if (stats[pub].samples.length < 2) {
              stats[pub].samples.push(url);
            }
          } else {
            stats[pub].failed++;
            failed++;
          }
        }
        console.log(`Total: ${rows.length}, Extracted: ${extracted}, Failed: ${failed}`);
        console.log("\nPer-publisher breakdown:");
        for (const [pub, s] of Object.entries(stats)) {
          console.log(`  ${pub}: ${s.extracted}/${s.total} extracted`);
          if (s.samples.length > 0) {
            for (const u of s.samples) console.log(`    sample: ${u}`);
          }
        }
        // Show failed PR Newswire samples
        const prFails = rows.filter(r => r.publisher === "PR Newswire" && !extractOriginUrl(r.full_text));
        if (prFails.length > 0) {
          console.log(`\n=== PR Newswire FAILED (${prFails.length}) - tail 300 chars ===`);
          for (const r of prFails.slice(0, 3)) {
            console.log(`--- id: ${r.id} ---`);
            console.log(r.full_text.slice(-300));
            console.log();
          }
        }
        resolve();
      }
    );
  });

  db.close();
}

main().catch(console.error);
