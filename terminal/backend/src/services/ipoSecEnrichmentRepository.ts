import { getDb } from "../db.js";

export interface IpoSecEnrichmentRow {
  id: number;
  event_unique_key: string;
  ticker: string | null;
  ipo_date: string | null;
  cik: string | null;
  form_type: string | null;
  filing_date: string | null;
  accepted_date: string | null;
  document_url: string | null;
  prospectus_url: string | null;
  disclosure_url: string | null;
  company_description: string | null;
  ownership_total_pct: number | null;
  ownership_max_pct: number | null;
  ownership_holder_count: number | null;
  ownership_values_json: string | null;
  raw_json: string | null;
  source_note: string | null;
  fetched_at: string;
}

export async function upsertIpoSecEnrichment(params: {
  eventUniqueKey: string;
  ticker: string | null;
  ipoDate: string | null;
  cik: string | null;
  formType: string | null;
  filingDate: string | null;
  acceptedDate: string | null;
  documentUrl: string | null;
  prospectusUrl: string | null;
  disclosureUrl: string | null;
  companyDescription: string | null;
  ownershipTotalPct: number | null;
  ownershipMaxPct: number | null;
  ownershipHolderCount: number | null;
  ownershipValuesJson: string | null;
  rawJson: string | null;
  sourceNote: string | null;
}): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await getDb().run(
    `INSERT INTO ipo_sec_enrichments (
       event_unique_key,
       ticker,
       ipo_date,
       cik,
       form_type,
       filing_date,
       accepted_date,
       document_url,
       prospectus_url,
       disclosure_url,
       company_description,
       ownership_total_pct,
       ownership_max_pct,
       ownership_holder_count,
       ownership_values_json,
       raw_json,
       source_note,
       fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_unique_key) DO UPDATE SET
       ticker = excluded.ticker,
       ipo_date = excluded.ipo_date,
       cik = excluded.cik,
       form_type = excluded.form_type,
       filing_date = excluded.filing_date,
       accepted_date = excluded.accepted_date,
       document_url = excluded.document_url,
       prospectus_url = excluded.prospectus_url,
       disclosure_url = excluded.disclosure_url,
       company_description = excluded.company_description,
       ownership_total_pct = excluded.ownership_total_pct,
       ownership_max_pct = excluded.ownership_max_pct,
       ownership_holder_count = excluded.ownership_holder_count,
       ownership_values_json = excluded.ownership_values_json,
       raw_json = excluded.raw_json,
       source_note = excluded.source_note,
       fetched_at = excluded.fetched_at`,
    [
      params.eventUniqueKey,
      params.ticker,
      params.ipoDate,
      params.cik,
      params.formType,
      params.filingDate,
      params.acceptedDate,
      params.documentUrl,
      params.prospectusUrl,
      params.disclosureUrl,
      params.companyDescription,
      params.ownershipTotalPct,
      params.ownershipMaxPct,
      params.ownershipHolderCount,
      params.ownershipValuesJson,
      params.rawJson,
      params.sourceNote,
      fetchedAt,
    ],
  );
}

export async function getIpoSecEnrichmentMap(uniqueKeys: string[]): Promise<Map<string, IpoSecEnrichmentRow>> {
  if (uniqueKeys.length === 0) {
    return new Map();
  }

  const map = new Map<string, IpoSecEnrichmentRow>();
  const batchSize = 400;
  for (let index = 0; index < uniqueKeys.length; index += batchSize) {
    const batch = uniqueKeys.slice(index, index + batchSize);
    const placeholders = batch.map(() => "?").join(",");
    const rows = await getDb().all<IpoSecEnrichmentRow[]>(
      `SELECT *
       FROM ipo_sec_enrichments
       WHERE event_unique_key IN (${placeholders})`,
      batch,
    );

    for (const row of rows) {
      map.set(row.event_unique_key, row);
    }
  }

  return map;
}