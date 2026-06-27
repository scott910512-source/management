import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { PROVINCE_TILES } from '../utils/constants';
import { rateColor } from '../utils/format';

interface Props {
  selectedProvince: string | null;
  onSelectProvince: (province: string) => void;
}

const TILE = 100;
const GAP = 10;

/**
 * 대한민국 시도 SVG 타일맵(카토그램).
 * 각 타일은 해당 시도의 방문률에 따라 회색→초록으로 색칠됩니다(스크래치맵 컨셉).
 * 향후 실제 GeoJSON 경로로 교체 가능하도록 타일 좌표를 utils/constants 로 분리했습니다.
 */
export function KoreaMap({ selectedProvince, onSelectProvince }: Props) {
  const { regions, visitByRegion, wishlistRegionIds } = useData();

  const stats = useMemo(() => {
    const map = new Map<string, { total: number; visited: number; planned: number; wish: number }>();
    for (const r of regions) {
      const s = map.get(r.provinceName) ?? { total: 0, visited: 0, planned: 0, wish: 0 };
      s.total += 1;
      const v = visitByRegion.get(r.id);
      if (v?.status === 'VISITED') s.visited += 1;
      else if (v?.status === 'PLANNED') s.planned += 1;
      if (wishlistRegionIds.has(r.id)) s.wish += 1;
      map.set(r.provinceName, s);
    }
    return map;
  }, [regions, visitByRegion, wishlistRegionIds]);

  const maxCol = Math.max(...PROVINCE_TILES.map((t) => t.col));
  const maxRow = Math.max(...PROVINCE_TILES.map((t) => t.row));
  const width = (maxCol + 1) * (TILE + GAP);
  const height = (maxRow + 1) * (TILE + GAP);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-2xl select-none"
      role="img"
      aria-label="대한민국 시도 지도"
    >
      {PROVINCE_TILES.map((tile) => {
        const s = stats.get(tile.name) ?? { total: 0, visited: 0, planned: 0, wish: 0 };
        const rate = s.total ? (s.visited / s.total) * 100 : 0;
        const isSelected = selectedProvince === tile.name;
        const x = tile.col * (TILE + GAP);
        const y = tile.row * (TILE + GAP);
        const hasPlanned = s.planned > 0 && s.visited === 0;
        const fill = s.visited > 0 ? rateColor(rate) : hasPlanned ? '#fde68a' : '#e2e8f0';

        return (
          <g
            key={tile.name}
            transform={`translate(${x}, ${y})`}
            className="cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => onSelectProvince(tile.name)}
          >
            <rect
              width={TILE}
              height={TILE}
              rx={18}
              fill={fill}
              stroke={isSelected ? '#f4663a' : 'rgba(255,255,255,0.7)'}
              strokeWidth={isSelected ? 5 : 2}
              className="drop-shadow"
            />
            <text
              x={TILE / 2}
              y={TILE / 2 - 6}
              textAnchor="middle"
              className="fill-slate-800 font-bold"
              style={{ fontSize: 20 }}
            >
              {tile.short}
            </text>
            <text
              x={TILE / 2}
              y={TILE / 2 + 18}
              textAnchor="middle"
              className="fill-slate-700"
              style={{ fontSize: 14 }}
            >
              {s.visited}/{s.total}
            </text>
            {s.wish > 0 && (
              <text x={TILE - 14} y={20} textAnchor="middle" style={{ fontSize: 16 }}>
                ⭐
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
