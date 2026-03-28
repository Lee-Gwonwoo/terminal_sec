import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
  filename: './backend/data/app.db',
  driver: sqlite3.Database,
});

const explanationWhere = `
  ni.source = 'FINNHUB'
  AND ni.source_type = 'company_news'
  AND ni.published_at >= '2025-01-01'
  AND (
    LOWER(ni.title) LIKE '%why %'
    OR LOWER(ni.title) LIKE '%tumbles%'
    OR LOWER(ni.title) LIKE '%surges%'
    OR LOWER(ni.title) LIKE '%sell-off%'
    OR LOWER(ni.title) LIKE '%drops.% why%'
    OR LOWER(ni.title) LIKE '%rises.% why%'
    OR LOWER(ni.title) LIKE '%stock is down%'
    OR LOWER(ni.title) LIKE '%stock was down%'
    OR LOWER(ni.title) LIKE '%stock is up%'
    OR LOWER(ni.title) LIKE '%stock was up%'
    OR LOWER(ni.title) LIKE '%stock dropped%'
    OR LOWER(ni.title) LIKE '%stock crashed%'
    OR LOWER(ni.title) LIKE '%stock tumbled%'
    OR LOWER(ni.title) LIKE '%stock jumped%'
    OR LOWER(ni.title) LIKE '%stock soared%'
    OR LOWER(ni.body) LIKE '%because%'
    OR LOWER(ni.body) LIKE '%driven by%'
    OR LOWER(ni.body) LIKE '%led the sell-off%'
  )
`;

const countsByCase = await db.all(`
  SELECT er.case_type, COUNT(*) AS total_count,
         SUM(CASE WHEN er.is_impacted = 1 THEN 1 ELSE 0 END) AS impacted_count
  FROM model2_evidence_rows er
  JOIN news_items ni ON ni.id = er.news_id
  WHERE er.analysis_id = '6ec343f2-d7be-43e1-9297-90e5c35643ea'
    AND ${explanationWhere}
  GROUP BY er.case_type
  ORDER BY total_count DESC
`);

const countsByPublisher = await db.all(`
  SELECT ni.publisher, COUNT(*) AS total_count
  FROM model2_evidence_rows er
  JOIN news_items ni ON ni.id = er.news_id
  WHERE er.analysis_id = '6ec343f2-d7be-43e1-9297-90e5c35643ea'
    AND ${explanationWhere}
  GROUP BY ni.publisher
  ORDER BY total_count DESC
`);

const samples = await db.all(`
  SELECT ni.published_at,
         ni.tickers_csv,
         ni.publisher,
         ni.title,
         SUBSTR(ni.body, 1, 320) AS body,
         er.case_type,
         er.case_label_ko,
         er.top_level,
         er.is_impacted,
         er.reaction_tag,
         er.overall_impact_score,
         er.change_pct,
         er.change_from_open_pct,
         er.change_1d_pct,
         er.change_7d_pct,
         er.change_30d_pct
  FROM model2_evidence_rows er
  JOIN news_items ni ON ni.id = er.news_id
  WHERE er.analysis_id = '6ec343f2-d7be-43e1-9297-90e5c35643ea'
    AND ${explanationWhere}
  ORDER BY ni.published_at DESC
  LIMIT 180
`);

const impactedSamples = await db.all(`
  SELECT ni.published_at,
         ni.tickers_csv,
         ni.publisher,
         ni.title,
         SUBSTR(ni.body, 1, 320) AS body,
         er.case_type,
         er.case_label_ko,
         er.top_level,
         er.reaction_tag,
         er.overall_impact_score
  FROM model2_evidence_rows er
  JOIN news_items ni ON ni.id = er.news_id
  WHERE er.analysis_id = '6ec343f2-d7be-43e1-9297-90e5c35643ea'
    AND er.is_impacted = 1
    AND ${explanationWhere}
  ORDER BY er.overall_impact_score DESC, ni.published_at DESC
  LIMIT 80
`);

const output = {
  meta: {
    analysisId: '6ec343f2-d7be-43e1-9297-90e5c35643ea',
    explanationFilter: explanationWhere.replace(/\s+/g, ' ').trim(),
    sampleCount: samples.length,
    impactedSampleCount: impactedSamples.length,
  },
  countsByCase,
  countsByPublisher,
  samples,
  impactedSamples,
};

const outPath = path.resolve('./out/model2_company_news_followup_wide_probe.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(outPath);
await db.close();
