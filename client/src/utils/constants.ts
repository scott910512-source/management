import type { VisitStatus, Visibility } from '../types';

export const STATUS_META: Record<VisitStatus, { label: string; color: string; ring: string; emoji: string }> = {
  VISITED: { label: '방문함', color: '#34d399', ring: 'ring-emerald-400', emoji: '✅' },
  PLANNED: { label: '계획중', color: '#fbbf24', ring: 'ring-amber-400', emoji: '📌' },
  UNVISITED: { label: '미방문', color: '#cbd5e1', ring: 'ring-slate-300', emoji: '⬜' },
};

export const VISIBILITY_META: Record<Visibility, { label: string; desc: string; emoji: string }> = {
  PUBLIC: { label: '공개', desc: '모든 사용자 열람 가능', emoji: '🌍' },
  PRIVATE: { label: '비공개', desc: '작성자만 열람', emoji: '🔒' },
  GROUP: { label: '그룹공유', desc: '선택 사용자만 열람', emoji: '👥' },
};

/**
 * 시도 타일 카토그램 좌표 (col,row) - 대한민국 지리 배치를 단순화한 SVG 타일맵.
 * 향후 실제 GeoJSON SVG 경로로 교체 가능하도록 컴포넌트와 분리.
 */
export interface ProvinceTile {
  name: string;
  short: string;
  col: number;
  row: number;
}

export const PROVINCE_TILES: ProvinceTile[] = [
  { name: '경기도', short: '경기', col: 2, row: 1 },
  { name: '강원특별자치도', short: '강원', col: 4, row: 1 },
  { name: '인천광역시', short: '인천', col: 1, row: 1 },
  { name: '서울특별시', short: '서울', col: 2, row: 0 },
  { name: '충청남도', short: '충남', col: 1, row: 2 },
  { name: '세종특별자치시', short: '세종', col: 2, row: 2 },
  { name: '충청북도', short: '충북', col: 3, row: 2 },
  { name: '대전광역시', short: '대전', col: 2, row: 3 },
  { name: '경상북도', short: '경북', col: 4, row: 2 },
  { name: '대구광역시', short: '대구', col: 4, row: 3 },
  { name: '전북특별자치도', short: '전북', col: 1, row: 3 },
  { name: '경상남도', short: '경남', col: 3, row: 4 },
  { name: '울산광역시', short: '울산', col: 5, row: 3 },
  { name: '부산광역시', short: '부산', col: 4, row: 4 },
  { name: '광주광역시', short: '광주', col: 0, row: 4 },
  { name: '전라남도', short: '전남', col: 1, row: 4 },
  { name: '제주특별자치도', short: '제주', col: 1, row: 6 },
];
