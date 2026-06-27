import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, EmptyState } from '../components/ui';
import type { Photo } from '../types';

interface RegionGroup {
  regionId: string;
  label: string;
  photos: Photo[];
}

export function GalleryPage() {
  const { visits } = useData();
  const [lightbox, setLightbox] = useState<string | null>(null);

  const groups = useMemo<RegionGroup[]>(() => {
    return visits
      .filter((v) => v.photos && v.photos.length > 0)
      .map((v) => ({
        regionId: v.regionId,
        label: `${v.region?.provinceName ?? ''} ${v.region?.district ?? ''}`,
        photos: v.photos ?? [],
      }))
      .sort((a, b) => b.photos.length - a.photos.length);
  }, [visits]);

  const totalPhotos = groups.reduce((s, g) => s + g.photos.length, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="사진 갤러리" desc={`총 ${totalPhotos}장의 여행 사진`} icon="📸" />

      {groups.length === 0 ? (
        <EmptyState icon="📸" text="아직 등록된 사진이 없어요. 방문 기록에 사진을 추가해보세요!" />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.regionId} className="glass p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">{g.label}</h2>
                <span className="text-xs text-slate-500">사진 {g.photos.length}장</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {g.photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setLightbox(p.imagePath)}
                    className="aspect-square overflow-hidden rounded-xl transition hover:opacity-90"
                  >
                    <img src={p.imagePath} alt={p.caption ?? ''} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
