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

  const left = Math.min(x + 18, Math.max(16, window.innerWidth - 396));
  const top = Math.min(y + 18, Math.max(16, window.innerHeight - 280));

  return (
    <div
      className="pointer-events-none fixed z-[120] w-[380px] rounded-xl border border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/96"
      style={{ left, top }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{ticker}</span>
        {profile?.source ? <span className="text-[11px] text-slate-400">{profile.source.toUpperCase()}</span> : null}
      </div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>CEO: {profile?.ceo ?? '-'}</span>
        <span>IPO: {profile?.ipoDate ?? '-'}</span>
        <span>Mkt Cap: {formatCompanyMarketCap(profile?.marketCap ?? null)}</span>
      </div>
      <div className="max-h-40 overflow-hidden text-xs leading-5 text-slate-700 dark:text-slate-200">
        {loading ? 'Loading company description...' : error ? error : profile?.description ?? '회사 설명 데이터가 아직 없습니다.'}
      </div>
    </div>
  );
}