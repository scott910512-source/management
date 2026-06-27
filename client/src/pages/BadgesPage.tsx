import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useData } from '../context/DataContext';
import type { Badge } from '../types';
import { PageHeader } from '../components/ui';
import { formatDate } from '../utils/format';

export function BadgesPage() {
  const { visits } = useData();
  const [data, setData] = useState<{ all: Badge[]; earnedKeys: string[] } | null>(null);

  useEffect(() => {
    api.get<{ all: Badge[]; earnedKeys: string[] }>('/badges').then(setData).catch(() => {});
  }, [visits]);

  const earned = new Set(data?.earnedKeys ?? []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="여행 배지"
        desc={`${earned.size} / ${data?.all.length ?? 0}개 획득`}
        icon="🏅"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(data?.all ?? []).map((b) => {
          const got = earned.has(b.key);
          return (
            <div
              key={b.key}
              className={`glass relative flex flex-col items-center p-5 text-center transition ${
                got ? '' : 'opacity-50 grayscale'
              }`}
            >
              <span className="text-4xl">{b.icon}</span>
              <div className="mt-2 text-sm font-bold">{b.name}</div>
              <div className="mt-1 text-[11px] text-slate-500">{b.description}</div>
              {got ? (
                <span className="mt-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600">
                  ✓ {b.earnedAt ? formatDate(b.earnedAt) : '획득'}
                </span>
              ) : (
                <span className="mt-2 text-[10px] text-slate-400">미획득</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
