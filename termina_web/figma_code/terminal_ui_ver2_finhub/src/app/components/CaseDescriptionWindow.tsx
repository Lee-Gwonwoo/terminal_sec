import React from 'react';
import type { CaseDescriptionWindowData } from '../types';

interface CaseDescriptionWindowProps {
  data?: CaseDescriptionWindowData;
}

function badgeClass(topLevel: string): string {
  if (topLevel === 'long') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (topLevel === 'short') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function CaseDescriptionWindow({ data }: CaseDescriptionWindowProps) {
  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No case description selected.</div>;
  }

  return (
    <div className="h-full overflow-auto bg-white px-4 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mb-4 flex items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(data.topLevel)}`}>{data.topLevel}</span>
        <h2 className="text-lg font-semibold">{data.caseLabelKo}</h2>
        <span className="text-xs text-slate-400">{data.caseType}</span>
      </div>

      <div className="space-y-5 text-sm leading-6">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Description</h3>
          <p>{data.description}</p>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">한 줄 정의</h3>
          <p>{data.definition}</p>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">핵심 가치 경로</h3>
          <p>{data.valuePath}</p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">포함 신호</h3>
          <div className="flex flex-wrap gap-2">
            {data.includeSignals.map(item => (
              <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{item}</span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">제외 신호</h3>
          <div className="flex flex-wrap gap-2">
            {data.excludeSignals.map(item => (
              <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{item}</span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">경계 사례</h3>
          <p>{data.boundaryCase}</p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">빠른 판별 질문</h3>
          <ul className="list-disc pl-5">
            {data.quickQuestions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}