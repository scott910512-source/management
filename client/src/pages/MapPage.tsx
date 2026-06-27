import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { KoreaMap } from '../components/KoreaMap';
import { VisitModal } from '../components/VisitModal';
import { STATUS_META } from '../utils/constants';
import type { Region } from '../types';

export function MapPage() {
  const { regions, visitByRegion, wishlistRegionIds } = useData();
  const [params, setParams] = useSearchParams();
  const [selectedProvince, setSelectedProvince] = useState<string | null>('서울특별시');
  const [modalRegion, setModalRegion] = useState<Region | null>(null);

  // 검색으로 들어온 ?region=ID 처리 → 해당 지역 모달 + 시도 선택
  useEffect(() => {
    const regionId = params.get('region');
    if (regionId && regions.length) {
      const region = regions.find((r) => r.id === regionId);
      if (region) {
        setSelectedProvince(region.provinceName);
        setModalRegion(region);
        params.delete('region');
        setParams(params, { replace: true });
      }
    }
  }, [params, regions, setParams]);

  const provinceDistricts = useMemo(
    () => regions.filter((r) => r.provinceName === selectedProvince),
    [regions, selectedProvince],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 px-1">
        <h1 className="text-2xl font-extrabold tracking-tight">여행 지도 🗺️</h1>
        <p className="text-sm text-slate-500">시도를 선택하고 시군구를 클릭해 방문을 기록하세요.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* 지도 */}
        <section className="glass flex flex-col items-center p-5">
          <KoreaMap selectedProvince={selectedProvince} onSelectProvince={setSelectedProvince} />
          {/* 범례 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
            {Object.values(STATUS_META).map((m) => (
              <span key={m.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                {m.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">⭐ 버킷리스트</span>
          </div>
        </section>

        {/* 시군구 패널 */}
        <section className="glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{selectedProvince}</h2>
            <span className="text-xs text-slate-500">{provinceDistricts.length}개 시군구</span>
          </div>
          <div className="flex max-h-[60vh] flex-wrap content-start gap-2 overflow-auto">
            {provinceDistricts.map((r) => {
              const v = visitByRegion.get(r.id);
              const wished = wishlistRegionIds.has(r.id);
              const color = v ? STATUS_META[v.status].color : STATUS_META.UNVISITED.color;
              return (
                <button
                  key={r.id}
                  onClick={() => setModalRegion(r)}
                  className="chip border-white/50 bg-white/40 hover:bg-white/70 dark:border-white/10 dark:bg-white/5"
                  style={{ borderColor: v ? color : undefined }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {r.district}
                  {wished && <span>⭐</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {modalRegion && <VisitModal region={modalRegion} onClose={() => setModalRegion(null)} />}
    </div>
  );
}
