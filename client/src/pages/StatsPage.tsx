import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useData } from '../context/DataContext';
import type { OverallStats } from '../types';
import { PageHeader, ProgressBar, StatCard } from '../components/ui';
import { rateColor } from '../utils/format';

export function StatsPage() {
  const { visits } = useData();
  const [stats, setStats] = useState<OverallStats | null>(null);

  useEffect(() => {
    api.get<OverallStats>('/stats').then(setStats).catch(() => {});
  }, [visits]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="통계" desc="전국 및 시도별 방문 현황" icon="📊" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="전국 시군구" value={`${stats?.visitedCount ?? 0} / ${stats?.totalRegions ?? 229}`} sub="방문 / 전체" icon="🗺️" />
        <StatCard label="전국 방문률" value={`${stats?.rate ?? 0}%`} icon="🌏" />
        <StatCard label="계획중" value={stats?.plannedCount ?? 0} icon="📌" />
        <StatCard label="올해 방문" value={stats?.thisYearVisited ?? 0} icon="🗓️" />
      </div>

      <section className="glass p-5">
        <h2 className="mb-4 text-lg font-bold">시도별 상세</h2>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {(stats?.provinceStats ?? []).map((p) => (
            <div key={p.province}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{p.province}</span>
                <span className="text-slate-500">
                  {p.visited}/{p.total} ({p.rate}%)
                </span>
              </div>
              <ProgressBar value={p.rate} color={rateColor(p.rate)} />
              {p.planned > 0 && (
                <div className="mt-1 text-[11px] text-amber-500">📌 계획중 {p.planned}곳</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
