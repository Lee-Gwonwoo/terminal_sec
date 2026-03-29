import React from 'react';
import type { DataControlHowToUseWindowData } from '../types';

interface DataControlHowToUseWindowProps {
  data?: DataControlHowToUseWindowData;
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h3>
      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 leading-5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DataControlHowToUseWindow({ data }: DataControlHowToUseWindowProps) {
  if (!data) {
    return (
      <div className="h-full w-full bg-gray-50 dark:bg-gray-950 p-4 text-sm text-gray-500 dark:text-gray-400">
        How To Use 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 space-y-3">
      <section className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Data Control How To Use</div>
        <h2 className="mt-1 text-base font-semibold text-gray-800 dark:text-gray-100">{data.title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{data.summary}</p>
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 leading-5">
          <span className="font-semibold text-gray-700 dark:text-gray-200">목적:</span> {data.purpose}
        </div>
        {data.route && (
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Route: {data.route}</div>
        )}
      </section>

      <SectionList title="언제 실행하나" items={data.whenToRun} />
      <SectionList title="입력 / 전제" items={data.inputs} />
      <SectionList title="주의사항" items={data.cautions} />
      <SectionList title="완료 후 확인" items={data.verify} />
    </div>
  );
}