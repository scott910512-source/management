import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { OverallStats } from '../types';
import { StatCard, ProgressBar, PageHeader } from '../components/ui';
import { rateColor, formatDate } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const { visits } = useData();
  const [stats, setStats] = useState<OverallStats | null>(null);

  useEffect(() => {
    api.get<OverallStats>('/stats').then(setStats).catch(() => {});
  }, [visits]);

  const recent = [...visits]
    .filter((v) => v.status === 'VISITED' && v.visitDate)
    .sort((a, b) => new Date(b.visitDate!).getTime() - new Date(a.visitDate!).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`안녕하세요, ${user?.name}님`} desc="오늘의 여행 현황을 확인해보세요." icon="👋" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="총 방문지역" value={stats ? `${stats.visitedCount}` : '–'} sub={`전국 ${stats?.totalRegions ?? 229}곳 중`} icon="📍" />
        <StatCard label="올해 방문" value={stats ? `${stats.thisYearVisited}` : '–'} sub="2026년" icon="🗓️" />
        <StatCard label="계획중" value={stats ? `${stats.plannedCount}` : '–'} sub="가볼 예정" icon="📌" />
        <StatCard label="전국 방문률" value={stats ? `${stats.rate}%` : '–'} sub="전체 진행률" icon="🌏" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* 방문률 그래프 (시도별) */}
        <section className="glass p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">시도별 방문률 📊</h2>
            <Link to="/stats" className="text-xs text-brand-600 hover:underline">
              자세히 →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {(stats?.provinceStats ?? []).slice(0, 8).map((p) => (
              <div key={p.province}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{p.province}</span>
                  <span className="text-slate-500">
                    {p.visited}/{p.total} · {p.rate}%
                  </span>
                </div>
                <ProgressBar value={p.rate} color={rateColor(p.rate)} />
              </div>
            ))}
            {!stats && <p className="text-sm text-slate-500">불러오는 중...</p>}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {/* 최근 여행 */}
          <section className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">최근 여행 🧳</h2>
              <Link to="/timeline" className="text-xs text-brand-600 hover:underline">
                전체 →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">아직 방문 기록이 없어요. 지도에서 첫 여행을 기록해보세요!</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-xl bg-white/30 px-3 py-2 text-sm dark:bg-white/5">
                    <span className="font-medium">
                      {v.region?.provinceName} {v.region?.district}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(v.visitDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 지역별 순위 */}
          <section className="glass p-5">
            <h2 className="mb-3 text-lg font-bold">지역별 순위 🏆</h2>
            <ol className="flex flex-col gap-2">
              {(stats?.ranking ?? []).slice(0, 5).map((p, i) => (
                <li key={p.province} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-bold text-brand-600">{i + 1}</span>
                  <span className="flex-1 font-medium">{p.province}</span>
                  <span className="text-xs text-slate-500">{p.rate}%</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <Link to="/map" className="btn-primary mt-4 w-full sm:hidden">
        🗺️ 지도에서 기록하기
      </Link>
    </div>
  );
}
