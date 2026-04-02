import React, { useEffect, useState } from 'react';
import type { CompanyDescriptionWindowData, CompanyProfileData } from '../companyDescription';
import { fetchCompanyProfile, formatCompanyMarketCap } from '../companyDescription';

interface CompanyDescriptionWindowProps {
  data?: CompanyDescriptionWindowData;
}

function sourceBadgeClass(source: string | null): string {
  if (source === 'fmp') return 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';
  if (source === 'yahoo') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800 dark:text-slate-200 break-all">{value}</div>
    </div>
  );
}

export function CompanyDescriptionWindow({ data }: CompanyDescriptionWindowProps) {
  const ticker = data?.ticker ?? '';
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchCompanyProfile(ticker, controller.signal)
      .then((nextProfile) => {
        setProfile(nextProfile);
      })
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : 'Failed to load company profile');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [ticker]);

  if (!ticker) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No company selected.</div>;
  }

  return (
    <div className="h-full overflow-auto bg-white px-4 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Ticker</span>
        <h2 className="text-lg font-semibold">{ticker}</h2>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${sourceBadgeClass(profile?.source ?? null)}`}>{profile?.source ? profile.source.toUpperCase() : 'NO SOURCE'}</span>
      </div>

      {loading ? <div className="text-sm text-slate-500 dark:text-slate-400">Loading company description...</div> : null}
      {error ? <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : null}

      {!loading && !error && (
        <div className="space-y-5 text-sm leading-6">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetaRow label="CEO" value={profile?.ceo ?? '-'} />
            <MetaRow label="IPO Date" value={profile?.ipoDate ?? '-'} />
            <MetaRow label="Market Cap" value={formatCompanyMarketCap(profile?.marketCap ?? null)} />
            <MetaRow label="Website" value={profile?.website ?? '-'} />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Company Description</h3>
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              {profile?.description ? profile.description : '회사 설명 데이터가 아직 없습니다.'}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}