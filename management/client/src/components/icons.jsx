// 세련된 라인 SVG 아이콘 세트. <Icon name="..." size={18} />
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SHAPES = {
  // 종합현황 (그리드)
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" {...P} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" {...P} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" {...P} />
      <rect x="14" y="14" width="7" height="7" rx="1.5" {...P} />
    </>
  ),
  // 원재료 = Canister(제리캔) 모양
  canister: (
    <>
      <path d="M7 7h7l3 3v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" {...P} />
      <path d="M9 7V5h4v2" {...P} />
      <path d="M9 12h5" {...P} />
    </>
  ),
  // 부재료 = 드럼 모양
  drum: (
    <>
      <ellipse cx="12" cy="5.5" rx="6" ry="2.2" {...P} />
      <path d="M6 5.5v13c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-13" {...P} />
      <path d="M6 11.5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" {...P} />
    </>
  ),
  // Canister 메뉴 = 별표
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...P} />,
  // 수불 이력 = 양방향 화살표
  swap: (
    <>
      <path d="M4 8h13l-3-3" {...P} />
      <path d="M20 16H7l3 3" {...P} />
    </>
  ),
  // 이상발생 = 경고 삼각형
  alert: (
    <>
      <path d="M12 4l8.5 15H3.5L12 4z" {...P} />
      <path d="M12 10v4" {...P} />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Task = 체크 클립보드
  task: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" {...P} />
      <path d="M9 4V3h6v1" {...P} />
      <path d="M8.5 12l2.2 2.2 4-4.4" {...P} />
    </>
  ),
  // 기준정보 = 데이터베이스
  db: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" {...P} />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" {...P} />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" {...P} />
    </>
  ),
  // 관리자 설정 = 방패+톱니
  shield: (
    <>
      <path d="M12 3l7 2.5v5c0 4.6-3 8.4-7 10.5-4-2.1-7-5.9-7-10.5v-5L12 3z" {...P} />
      <circle cx="12" cy="11" r="2.2" {...P} />
    </>
  ),
  // AI 검색(돋보기+스파클)
  search: (
    <>
      <circle cx="11" cy="11" r="6" {...P} />
      <path d="M20 20l-4-4" {...P} />
      <path d="M18 4l.6 1.4L20 6l-1.4.6L18 8l-.6-1.4L16 6l1.4-.6z" {...P} />
    </>
  ),
  // 사용자 메뉴얼(책)
  book: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z" {...P} />
      <path d="M5 16h13" {...P} />
      <path d="M9 8h5M9 11h5" {...P} />
    </>
  ),
  // 입고(아래로)
  in: (
    <>
      <path d="M12 4v10" {...P} />
      <path d="M7 11l5 5 5-5" {...P} />
      <path d="M5 20h14" {...P} />
    </>
  ),
  // 사용/출고(위로)
  out: (
    <>
      <path d="M12 20V10" {...P} />
      <path d="M7 13l5-5 5 5" {...P} />
      <path d="M5 4h14" {...P} />
    </>
  ),
};

export function Icon({ name, size = 18, style }) {
  const shape = SHAPES[name];
  if (!shape) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {shape}
    </svg>
  );
}
