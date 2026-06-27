import type {
  IVisitRepository,
  IRegionRepository,
  IUserRepository,
  VisitRecord,
} from '../../domain/repositories';
import type { VisitStatus, Visibility } from '../../domain/entities/types';
import { VISIT_STATUSES, VISIBILITIES } from '../../domain/entities/types';
import { BadgeService } from './BadgeService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';

export interface UpsertVisitDto {
  regionId: string;
  status: VisitStatus;
  visitDate?: string | null;
  memo?: string | null;
  visibility?: Visibility;
}

export class VisitService {
  constructor(
    private readonly visits: IVisitRepository,
    private readonly regions: IRegionRepository,
    private readonly users: IUserRepository,
    private readonly badgeService: BadgeService,
  ) {}

  async upsert(userId: string, dto: UpsertVisitDto): Promise<{ visit: VisitRecord; newBadges: string[] }> {
    if (!VISIT_STATUSES.includes(dto.status)) throw new BadRequestError('잘못된 방문 상태입니다.');
    if (dto.visibility && !VISIBILITIES.includes(dto.visibility)) {
      throw new BadRequestError('잘못된 공개 범위입니다.');
    }
    const region = await this.regions.findById(dto.regionId);
    if (!region) throw new NotFoundError('존재하지 않는 지역입니다.');

    const visit = await this.visits.upsert({
      userId,
      regionId: dto.regionId,
      status: dto.status,
      visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
      memo: dto.memo ?? null,
      visibility: dto.visibility,
    });
    const newBadges = await this.badgeService.evaluate(userId);
    return { visit, newBadges };
  }

  async listMine(userId: string): Promise<VisitRecord[]> {
    return this.visits.listByUser(userId);
  }

  async getMine(userId: string, regionId: string): Promise<VisitRecord | null> {
    return this.visits.findByUserAndRegion(userId, regionId);
  }

  async delete(userId: string, visitId: string): Promise<void> {
    const visit = await this.visits.findById(visitId);
    if (!visit) throw new NotFoundError('방문 기록을 찾을 수 없습니다.');
    if (visit.userId !== userId) throw new ForbiddenError('본인의 기록만 삭제할 수 있습니다.');
    await this.visits.delete(visitId);
  }

  /** visibility=GROUP 일 때 공유 대상 사용자 설정 */
  async setShares(userId: string, visitId: string, userIds: string[]): Promise<void> {
    const visit = await this.visits.findById(visitId);
    if (!visit) throw new NotFoundError('방문 기록을 찾을 수 없습니다.');
    if (visit.userId !== userId) throw new ForbiddenError('본인의 기록만 공유 설정할 수 있습니다.');
    await this.visits.setShares(visitId, userIds);
  }

  /** 내가 볼 수 있는 타인의 공개/그룹 기록 (피드) */
  async listSharedFeed(viewerId: string): Promise<VisitRecord[]> {
    const list = await this.visits.listVisibleTo(viewerId);
    return list.filter((v) => v.userId !== viewerId);
  }

  /** 타임라인 (방문일 기준 정렬) */
  async timeline(userId: string): Promise<VisitRecord[]> {
    const list = await this.visits.listByUser(userId);
    return list
      .filter((v) => v.status === 'VISITED')
      .sort((a, b) => {
        const da = a.visitDate ? new Date(a.visitDate).getTime() : 0;
        const db = b.visitDate ? new Date(b.visitDate).getTime() : 0;
        return db - da;
      });
  }
}
