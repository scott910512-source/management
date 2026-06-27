import type { IRegionRepository, IVisitRepository } from '../../domain/repositories';

export interface ProvinceStat {
  province: string;
  total: number;
  visited: number;
  planned: number;
  rate: number; // 0~100
}

export interface OverallStats {
  totalRegions: number;
  visitedCount: number;
  plannedCount: number;
  rate: number;
  thisYearVisited: number;
  provinceStats: ProvinceStat[];
  /** 방문률 기준 상위 지역 순위 */
  ranking: ProvinceStat[];
}

/** 사용자의 방문 통계 집계 */
export class StatsService {
  constructor(
    private readonly regions: IRegionRepository,
    private readonly visits: IVisitRepository,
  ) {}

  async getOverall(userId: string): Promise<OverallStats> {
    const [allRegions, userVisits] = await Promise.all([
      this.regions.listAll(),
      this.visits.listByUser(userId),
    ]);

    const totalRegions = allRegions.length;
    const visitedRegionIds = new Set(
      userVisits.filter((v) => v.status === 'VISITED').map((v) => v.regionId),
    );
    const plannedRegionIds = new Set(
      userVisits.filter((v) => v.status === 'PLANNED').map((v) => v.regionId),
    );

    const currentYear = new Date().getFullYear();
    const thisYearVisited = userVisits.filter(
      (v) => v.status === 'VISITED' && v.visitDate && new Date(v.visitDate).getFullYear() === currentYear,
    ).length;

    // 시도별 집계
    const byProvince = new Map<string, ProvinceStat>();
    for (const r of allRegions) {
      const stat = byProvince.get(r.provinceName) ?? {
        province: r.provinceName,
        total: 0,
        visited: 0,
        planned: 0,
        rate: 0,
      };
      stat.total += 1;
      if (visitedRegionIds.has(r.id)) stat.visited += 1;
      if (plannedRegionIds.has(r.id)) stat.planned += 1;
      byProvince.set(r.provinceName, stat);
    }

    const provinceStats = [...byProvince.values()].map((s) => ({
      ...s,
      rate: s.total ? Math.round((s.visited / s.total) * 1000) / 10 : 0,
    }));

    const ranking = [...provinceStats].sort((a, b) => b.rate - a.rate || b.visited - a.visited);

    return {
      totalRegions,
      visitedCount: visitedRegionIds.size,
      plannedCount: plannedRegionIds.size,
      rate: totalRegions ? Math.round((visitedRegionIds.size / totalRegions) * 1000) / 10 : 0,
      thisYearVisited,
      provinceStats,
      ranking,
    };
  }
}
