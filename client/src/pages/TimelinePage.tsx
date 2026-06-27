import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, EmptyState } from '../components/ui';
import { formatDate } from '../utils/format';

export function TimelinePage() {
  const { visits } = useData();

  const timeline = useMemo(
    () =>
      visits
        .filter((v) => v.status === 'VISITED' && v.visitDate)
        .sort((a, b) => new Date(b.visitDate!).getTime() - new Date(a.visitDate!).getTime()),
    [visits],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="여행 히스토리" desc="방문일 순으로 정리된 타임라인" icon="🕒" />

      {timeline.length === 0 ? (
        <EmptyState icon="🕒" text="방문일이 기록된 여행이 아직 없어요." />
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-2 left-2 top-2 w-0.5 bg-gradient-to-b from-brand-400 to-emerald-400" />
          <div className="flex flex-col gap-4">
            {timeline.map((v) => (
              <div key={v.id} className="relative">
                <span className="absolute -left-[18px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500 shadow" />
                <div className="glass p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">
                      {v.region?.provinceName} {v.region?.district}
                    </h3>
                    <span className="text-xs text-slate-500">{formatDate(v.visitDate)}</span>
                  </div>
                  {v.memo && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                      {v.memo}
                    </p>
                  )}
                  {v.photos && v.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {v.photos.slice(0, 6).map((p) => (
                        <img
                          key={p.id}
                          src={p.imagePath}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
