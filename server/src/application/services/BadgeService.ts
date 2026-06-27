import type {
  IBadgeRepository,
  IRegionRepository,
  IVisitRepository,
} from '../../domain/repositories';

/** 시드되어야 하는 배지 정의 (seed.ts 와 BadgeService 가 공유) */
export const BADGE_DEFINITIONS = [
  { key: 'SEOUL_COMPLETE', name: '서울 완주', description: '서울특별시 전 지역 방문', icon: '🏙️' },
  { key: 'JEJU_COMPLETE', name: '제주 완주', description: '제주특별자치도 전 지역 방문', icon: '🌴' },
  { key: 'GYEONGBUK_COMPLETE', name: '경상북도 완주', description: '경상북도 전 지역 방문', icon: '⛰️' },
  { key: 'NATION_10', name: '전국 10% 달성', description: '전국 시군구 10% 방문', icon: '🥉' },
  { key: 'NATION_50', name: '전국 50% 달성', description: '전국 시군구 50% 방문', icon: '🥈' },
  { key: 'NATION_100', name: '전국 100% 달성', description: '전국 시군구 완전 정복', icon: '🏆' },
  { key: 'FIRST_VISIT', name: '첫 발자국', description: '첫 방문 기록 작성', icon: '👣' },
  { key: 'PROVINCE_COMPLETE', name: '도(道) 정복자', description: '한 개 시도 전 지역 방문', icon: '🎖️' },
] as const;

export interface EarnedBadge {
  key: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

/** 사용자의 방문 현황을 평가하여 자동으로 배지를 부여 */
export class BadgeService {
  constructor(
    private readonly badges: IBadgeRepository,
    private readonly regions: IRegionRepository,
    private readonly visits: IVisitRepository,
  ) {}

  /** 방문 변경 시 호출 → 새로 획득한 배지 key 목록 반환 */
  async evaluate(userId: string): Promise<string[]> {
    const [allRegions, userVisits, allBadges] = await Promise.all([
      this.regions.listAll(),
      this.visits.listByUser(userId),
      this.badges.listAll(),
    ]);

    const badgeByKey = new Map(allBadges.map((b) => [b.key, b]));
    const visitedRegionIds = new Set(
      userVisits.filter((v) => v.status === 'VISITED').map((v) => v.regionId),
    );

    const total = allRegions.length;
    const visitedCount = visitedRegionIds.size;
    const rate = total ? (visitedCount / total) * 100 : 0;

    // 시도별 완주 여부 계산
    const byProvince = new Map<string, { total: number; visited: number }>();
    for (const r of allRegions) {
      const s = byProvince.get(r.provinceName) ?? { total: 0, visited: 0 };
      s.total += 1;
      if (visitedRegionIds.has(r.id)) s.visited += 1;
      byProvince.set(r.provinceName, s);
    }
    const isComplete = (name: string) => {
      const s = byProvince.get(name);
      return !!s && s.total > 0 && s.total === s.visited;
    };
    const anyProvinceComplete = [...byProvince.values()].some((s) => s.total === s.visited && s.total > 0);

    const toAward: string[] = [];
    const want = (key: string, cond: boolean) => {
      if (cond && badgeByKey.has(key)) toAward.push(key);
    };

    want('FIRST_VISIT', visitedCount >= 1);
    want('NATION_10', rate >= 10);
    want('NATION_50', rate >= 50);
    want('NATION_100', rate >= 100);
    want('SEOUL_COMPLETE', isComplete('서울특별시'));
    want('JEJU_COMPLETE', isComplete('제주특별자치도'));
    want('GYEONGBUK_COMPLETE', isComplete('경상북도'));
    want('PROVINCE_COMPLETE', anyProvinceComplete);

    const newlyEarned: string[] = [];
    for (const key of toAward) {
      const badge = badgeByKey.get(key)!;
      const awarded = await this.badges.award(userId, badge.id);
      if (awarded) newlyEarned.push(key);
    }
    return newlyEarned;
  }

  async listForUser(userId: string): Promise<{ all: EarnedBadge[]; earnedKeys: string[] }> {
    const [allBadges, earned] = await Promise.all([
      this.badges.listAll(),
      this.badges.listEarned(userId),
    ]);
    const earnedMap = new Map(earned.map((e) => [e.badge.key, e.earnedAt]));
    const all = allBadges.map((b) => ({
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earnedAt: earnedMap.get(b.key)?.toISOString() ?? '',
    }));
    return { all, earnedKeys: [...earnedMap.keys()] };
  }
}
