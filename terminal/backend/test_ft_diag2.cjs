// Diagnostic: check body content in news_items
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/data/app.db');

db.serialize(() => {
  console.log('=== NASDAQ body text stats ===');
  db.all(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN LENGTH(body) > 50 THEN 1 ELSE 0 END) as has_body,
       SUM(CASE WHEN LENGTH(body) <= 50 OR body IS NULL THEN 1 ELSE 0 END) as no_body,
       AVG(LENGTH(body)) as avg_body_len,
       MAX(LENGTH(body)) as max_body_len
     FROM news_items WHERE publisher = 'NASDAQ'`,
    (err, rows) => {
      if (err) console.error(err);
      else console.log(rows[0]);
    }
  );

  console.log('\n=== Sample NASDAQ body (longest 3) ===');
  db.all(
    `SELECT id, LENGTH(body) as body_len, SUBSTR(body, 1, 300) as body_preview
     FROM news_items WHERE publisher = 'NASDAQ'
     ORDER BY LENGTH(body) DESC LIMIT 3`,
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r));
    }
  );

  console.log('\n=== Sample NASDAQ body (shortest non-null 3) ===');
  db.all(
    `SELECT id, LENGTH(body) as body_len, body
     FROM news_items WHERE publisher = 'NASDAQ' AND body IS NOT NULL AND LENGTH(body) > 0
     ORDER BY LENGTH(body) ASC LIMIT 3`,
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r));
    }
  );

  // Check for already-extracted items: are the success ones actually from scraping, or from body?
  console.log('\n=== Success items: fulltext length vs news_items body length ===');
  db.all(
    `SELECT ni.id, LENGTH(ni.body) as item_body_len, LENGTH(nf.full_text) as ft_len
     FROM news_fulltext nf JOIN news_items ni ON ni.id = nf.news_id
     WHERE nf.extraction_status = 'success' AND ni.publisher = 'NASDAQ'
     LIMIT 5`,
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r));
    }
  );

  // Check other publishers body quality
  console.log('\n=== All publishers: avg body length ===');
  db.all(
    `SELECT publisher, COUNT(*) as cnt, ROUND(AVG(LENGTH(body))) as avg_body_len
     FROM news_items GROUP BY publisher ORDER BY cnt DESC`,
    (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(`  ${r.publisher}: ${r.cnt} items, avg_body=${r.avg_body_len}`));
    }
  );
});

db.close();
