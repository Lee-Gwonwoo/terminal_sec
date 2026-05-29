import React, { useEffect, useState } from 'react';
import type { CompanyProfileData } from '../companyDescription';
import { fetchCompanyProfile, formatCompanyMarketCap } from '../companyDescription';

interface CompanyDescriptionHoverPreviewProps {
  ticker: string;
  x: number;
  y: number;
}

export function CompanyDescriptionHoverPreview({ ticker, x, y }: CompanyDescriptionHoverPreviewProps) {
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const left = Math.min(x + 18, Math.max(16, window.innerWidth - 436));
  const top = Math.min(y + 18, Math.max(16, window.innerHeight - 420));
  const primaryDescription = profile?.shortDescription ?? profile?.enhancedDescription ?? profile?.description ?? null;
  const hasEnrichment = Boolean(profile?.enhancedDescription || profile?.shortDescription);
  const firstPeerGroup = profile?.peerGroups[0] ?? null;
  const firstPeerItems = firstPeerGroup ? [...firstPeerGroup.tickers, ...firstPeerGroup.companies].slice(0, 6) : [];

  return (
    <div
      className="pointer-events-none fixed z-[120] w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/96"
      style={{ left, top }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{ticker}</span>
        {hasEnrichment ? <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">ENRICHED</span> : null}
        {profile?.source ? <span className="text-[11px] text-slate-400">{profile.source.toUpperCase()}</span> : null}
      </div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>CEO: {profile?.ceo ?? '-'}</span>
        <span>IPO: {profile?.ipoDate ?? '-'}</span>
        <span>Mkt Cap: {formatCompanyMarketCap(profile?.marketCap ?? null)}</span>
      </div>
      <div className="max-h-[330px] overflow-hidden text-xs leading-5 text-slate-700 dark:text-slate-200">
        {loading ? 'Loading company description...' : error ? error : primaryDescription ?? '회사 설명 데이터가 아직 없습니다.'}
        {!loading && !error && profile?.products.length ? (
          <CompactList label="Products" items={profile.products.slice(0, 5)} />
        ) : null}
        {!loading && !error && profile?.watchPoints.length ? (
          <CompactList label="Watch" items={profile.watchPoints.slice(0, 4)} />
        ) : null}
        {!loading && !error && profile?.risks.length ? (
          <CompactList label="Risks" items={profile.risks.slice(0, 3)} />
        ) : null}
        {!loading && !error && firstPeerGroup && firstPeerItems.length ? (
          <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{firstPeerGroup.label}</div>
            <div className="flex flex-wrap gap-1">
              {firstPeerItems.map((item) => (
                <span key={item} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300">{item}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CompactList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
      <div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{label}</div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="line-clamp-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300">{item}</li>
        ))}
      </ul>
    </div>
  );
}