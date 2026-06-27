/** 배지 key → 표시 메타 (서버 BADGE_DEFINITIONS 와 동기화) */
export const BADGE_LABELS: Record<string, { name: string; icon: string }> = {
  SEOUL_COMPLETE: { name: '서울 완주', icon: '🏙️' },
  JEJU_COMPLETE: { name: '제주 완주', icon: '🌴' },
  GYEONGBUK_COMPLETE: { name: '경상북도 완주', icon: '⛰️' },
  NATION_10: { name: '전국 10% 달성', icon: '🥉' },
  NATION_50: { name: '전국 50% 달성', icon: '🥈' },
  NATION_100: { name: '전국 100% 달성', icon: '🏆' },
  FIRST_VISIT: { name: '첫 발자국', icon: '👣' },
  PROVINCE_COMPLETE: { name: '도(道) 정복자', icon: '🎖️' },
};
