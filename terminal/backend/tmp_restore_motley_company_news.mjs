import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const execute = process.argv.includes("--execute");

const currentDbPath = path.resolve("./backend/data/app.db");
const oldDbPath = path.resolve("../../before_delete/terminal/backend/backend/data/app.db");

if (!fs.existsSync(currentDbPath)) {
  throw new Error(`Current DB not found: ${currentDbPath}`);
}

if (!fs.existsSync(oldDbPath)) {
  throw new Error(`Old DB not found: ${oldDbPath}`);
}

const db = await open({ filename: currentDbPath, driver: sqlite3.Database });

const tableColumns = async (schema, table) => {
  const rows = await db.all(`PRAGMA ${schema}.table_info(${table})`);
  return rows.map((row) => row.name);
};

const commonColumns = async (table, options = {}) => {
  const mainCols = await tableColumns("main", table);
  const oldCols = await tableColumns("olddb", table);
  const excluded = new Set(options.exclude ?? []);
  return mainCols.filter((col) => oldCols.includes(col) && !excluded.has(col));
};

const countOne = async (sql) => {
  const row = await db.get(sql);
  return row?.c ?? 0;
};

const getIds = async (sql, key) => {
  const rows = await db.all(sql);
  return rows.map((row) => row[key]).filter(Boolean);
};

const rebuildSummariesAndRunAggregates = async () => {
  await db.run(`
    DELETE FROM model2_case_summaries
    WHERE analysis_id IN (SELECT analysis_id FROM temp_restore_analysis_ids)
  `);

  await db.run(`
    INSERT INTO model2_case_summaries (
      analysis_id,
      case_type,
      case_label_ko,
      top_level,
      total_count,
      impacted_count,
      latest_published_at,
      updated_at
    )
    SELECT
      analysis_id,
      case_type,
      MAX(case_label_ko) AS case_label_ko,
      MAX(top_level) AS top_level,
      COUNT(*) AS total_count,
      SUM(CASE WHEN is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count,
      MAX(published_at) AS latest_published_at,
      datetime('now') AS updated_at
    FROM model2_evidence_rows
    WHERE analysis_id IN (SELECT analysis_id FROM temp_restore_analysis_ids)
    GROUP BY analysis_id, case_type
  `);

  await db.run(`
    UPDATE model2_analysis_runs
    SET total_rows = COALESCE((
          SELECT COUNT(*)
          FROM model2_evidence_rows er
          WHERE er.analysis_id = model2_analysis_runs.id
        ), 0),
        analyzable_rows = COALESCE((
          SELECT SUM(CASE WHEN er.overall_impact_score IS NOT NULL THEN 1 ELSE 0 END)
          FROM model2_evidence_rows er
          WHERE er.analysis_id = model2_analysis_runs.id
        ), 0),
        impacted_rows = COALESCE((
          SELECT SUM(CASE WHEN er.is_impacted = 1 THEN 1 ELSE 0 END)
          FROM model2_evidence_rows er
          WHERE er.analysis_id = model2_analysis_runs.id
        ), 0),
        meaningless_rows = COALESCE((
          SELECT SUM(CASE WHEN er.case_type = 'meaningless_others' THEN 1 ELSE 0 END)
          FROM model2_evidence_rows er
          WHERE er.analysis_id = model2_analysis_runs.id
        ), 0),
        updated_at = datetime('now')
    WHERE id IN (SELECT analysis_id FROM temp_restore_analysis_ids)
  `);
};

try {
  await db.exec("PRAGMA foreign_keys = ON");
  await db.exec(`ATTACH DATABASE '${oldDbPath.replace(/'/g, "''")}' AS olddb`);

  await db.exec(`
    DROP TABLE IF EXISTS temp_restore_news_ids;
    CREATE TEMP TABLE temp_restore_news_ids AS
    SELECT id, source, url
    FROM olddb.news_items
    WHERE source = 'FINNHUB'
      AND source_type = 'company_news'
      AND UPPER(COALESCE(publisher, '')) LIKE '%MOTLEY%';

    DROP TABLE IF EXISTS temp_restore_fulltext_ids;
    CREATE TEMP TABLE temp_restore_fulltext_ids AS
    SELECT nf.news_id
    FROM olddb.news_fulltext nf
    JOIN temp_restore_news_ids rn ON rn.id = nf.news_id;

    DROP TABLE IF EXISTS temp_restore_metric_ids;
    CREATE TEMP TABLE temp_restore_metric_ids AS
    SELECT m.news_id, m.metric_key
    FROM olddb.news_change_metrics m
    JOIN temp_restore_news_ids rn ON rn.id = m.news_id;

    DROP TABLE IF EXISTS temp_restore_old_evidence;
    CREATE TEMP TABLE temp_restore_old_evidence AS
    SELECT er.*
    FROM olddb.model2_evidence_rows er
    WHERE er.news_id IN (SELECT id FROM temp_restore_news_ids);

    DROP TABLE IF EXISTS temp_restore_analysis_ids;
    CREATE TEMP TABLE temp_restore_analysis_ids AS
    SELECT DISTINCT analysis_id
    FROM temp_restore_old_evidence;

    DROP TABLE IF EXISTS temp_restore_page_ids;
    CREATE TEMP TABLE temp_restore_page_ids AS
    SELECT DISTINCT ar.page_id AS page_id
    FROM olddb.model2_analysis_runs ar
    JOIN temp_restore_analysis_ids rai ON rai.analysis_id = ar.id
    WHERE ar.page_id IS NOT NULL;

    DROP TABLE IF EXISTS temp_restore_tab_ids;
    CREATE TEMP TABLE temp_restore_tab_ids AS
    SELECT DISTINCT rp.tab_id AS tab_id
    FROM olddb.research_pages rp
    JOIN temp_restore_page_ids rpi ON rpi.page_id = rp.id
    WHERE rp.tab_id IS NOT NULL;
  `);

  const summary = {
    currentMotleyNews: await countOne(`SELECT COUNT(*) AS c FROM news_items WHERE source = 'FINNHUB' AND source_type = 'company_news' AND UPPER(COALESCE(publisher, '')) LIKE '%MOTLEY%'`),
    oldMotleyNews: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_news_ids`),
    existingOverlapByUrl: await countOne(`SELECT COUNT(*) AS c FROM news_items n JOIN temp_restore_news_ids r ON r.source = n.source AND r.url = n.url`),
    oldFulltextRows: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_fulltext_ids`),
    oldMetricRows: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_metric_ids`),
    oldEvidenceRows: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_old_evidence`),
    affectedAnalysisRuns: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_analysis_ids`),
    affectedResearchPages: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_page_ids`),
    affectedResearchTabs: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_tab_ids`),
    missingResearchPagesInCurrent: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_page_ids t WHERE NOT EXISTS (SELECT 1 FROM research_pages rp WHERE rp.id = t.page_id)`),
    missingAnalysisRunsInCurrent: await countOne(`SELECT COUNT(*) AS c FROM temp_restore_analysis_ids t WHERE NOT EXISTS (SELECT 1 FROM model2_analysis_runs ar WHERE ar.id = t.analysis_id)`),
  };

  if (!execute) {
    console.log(JSON.stringify({ mode: "dry-run", currentDbPath, oldDbPath, summary }, null, 2));
    process.exit(0);
  }

  const newsCols = await commonColumns("news_items");
  const fulltextCols = await commonColumns("news_fulltext");
  const metricCols = await commonColumns("news_change_metrics");
  const tabCols = await commonColumns("research_tabs");
  const pageCols = await commonColumns("research_pages");
  const runCols = await commonColumns("model2_analysis_runs");
  const evidenceCols = await commonColumns("model2_evidence_rows", { exclude: ["id"] });

  const inserts = {};

  await db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    inserts.researchTabs = await db.run(`
      INSERT OR IGNORE INTO research_tabs (${tabCols.join(", ")})
      SELECT ${tabCols.join(", ")}
      FROM olddb.research_tabs
      WHERE id IN (SELECT tab_id FROM temp_restore_tab_ids)
    `);

    inserts.researchPages = await db.run(`
      INSERT OR IGNORE INTO research_pages (${pageCols.join(", ")})
      SELECT ${pageCols.join(", ")}
      FROM olddb.research_pages
      WHERE id IN (SELECT page_id FROM temp_restore_page_ids)
    `);

    inserts.analysisRuns = await db.run(`
      INSERT OR IGNORE INTO model2_analysis_runs (${runCols.join(", ")})
      SELECT ${runCols.join(", ")}
      FROM olddb.model2_analysis_runs
      WHERE id IN (SELECT analysis_id FROM temp_restore_analysis_ids)
    `);

    inserts.newsItems = await db.run(`
      INSERT OR IGNORE INTO news_items (${newsCols.join(", ")})
      SELECT ${newsCols.join(", ")}
      FROM olddb.news_items
      WHERE id IN (SELECT id FROM temp_restore_news_ids)
    `);

    inserts.fulltext = await db.run(`
      INSERT OR IGNORE INTO news_fulltext (${fulltextCols.join(", ")})
      SELECT ${fulltextCols.join(", ")}
      FROM olddb.news_fulltext
      WHERE news_id IN (SELECT id FROM temp_restore_news_ids)
    `);

    inserts.metrics = await db.run(`
      INSERT OR IGNORE INTO news_change_metrics (${metricCols.join(", ")})
      SELECT ${metricCols.join(", ")}
      FROM olddb.news_change_metrics
      WHERE news_id IN (SELECT id FROM temp_restore_news_ids)
    `);

    inserts.evidence = await db.run(`
      INSERT OR IGNORE INTO model2_evidence_rows (${evidenceCols.join(", ")})
      SELECT ${evidenceCols.join(", ")}
      FROM temp_restore_old_evidence
    `);

    await rebuildSummariesAndRunAggregates();

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  const after = {
    currentMotleyNews: await countOne(`SELECT COUNT(*) AS c FROM news_items WHERE source = 'FINNHUB' AND source_type = 'company_news' AND UPPER(COALESCE(publisher, '')) LIKE '%MOTLEY%'`),
    currentMotleyFulltextRows: await countOne(`SELECT COUNT(*) AS c FROM news_fulltext WHERE news_id IN (SELECT id FROM temp_restore_news_ids)`),
    currentMotleyMetricRows: await countOne(`SELECT COUNT(*) AS c FROM news_change_metrics WHERE news_id IN (SELECT id FROM temp_restore_news_ids)`),
    currentMotleyEvidenceRows: await countOne(`SELECT COUNT(*) AS c FROM model2_evidence_rows WHERE news_id IN (SELECT id FROM temp_restore_news_ids)`),
    currentCaseSummaryRows: await countOne(`SELECT COUNT(*) AS c FROM model2_case_summaries WHERE analysis_id IN (SELECT analysis_id FROM temp_restore_analysis_ids)`),
  };

  console.log(JSON.stringify({
    mode: "execute",
    currentDbPath,
    oldDbPath,
    summary,
    inserted: Object.fromEntries(Object.entries(inserts).map(([key, value]) => [key, value.changes ?? 0])),
    after,
    sampleMotleyNewsIds: await getIds(`SELECT id FROM temp_restore_news_ids ORDER BY id LIMIT 10`, "id"),
    affectedAnalysisIds: await getIds(`SELECT analysis_id FROM temp_restore_analysis_ids ORDER BY analysis_id LIMIT 50`, "analysis_id"),
  }, null, 2));
} finally {
  await db.close();
}