import { prisma } from '../db/prisma';
import type {
  IVisitRepository,
  VisitRecord,
  VisitUpsertInput,
} from '../../domain/repositories';

function mapVisit(v: any): VisitRecord {
  return {
    id: v.id,
    userId: v.userId,
    regionId: v.regionId,
    status: v.status,
    visitDate: v.visitDate,
    memo: v.memo,
    visibility: v.visibility,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    region: v.region,
    photos: v.photos,
    shareUserIds: v.shares?.map((s: any) => s.userId),
  };
}

export class PrismaVisitRepository implements IVisitRepository {
  async upsert(data: VisitUpsertInput): Promise<VisitRecord> {
    const v = await prisma.visit.upsert({
      where: { userId_regionId: { userId: data.userId, regionId: data.regionId } },
      create: {
        userId: data.userId,
        regionId: data.regionId,
        status: data.status,
        visitDate: data.visitDate ?? null,
        memo: data.memo ?? null,
        visibility: data.visibility ?? 'PRIVATE',
      },
      update: {
        status: data.status,
        visitDate: data.visitDate ?? null,
        memo: data.memo ?? undefined,
        ...(data.visibility ? { visibility: data.visibility } : {}),
      },
      include: { region: true, photos: true, shares: true },
    });
    return mapVisit(v);
  }

  async findByUserAndRegion(userId: string, regionId: string): Promise<VisitRecord | null> {
    const v = await prisma.visit.findUnique({
      where: { userId_regionId: { userId, regionId } },
      include: { region: true, photos: true, shares: true },
    });
    return v ? mapVisit(v) : null;
  }

  async findById(id: string): Promise<VisitRecord | null> {
    const v = await prisma.visit.findUnique({
      where: { id },
      include: { region: true, photos: true, shares: true },
    });
    return v ? mapVisit(v) : null;
  }

  async listByUser(userId: string): Promise<VisitRecord[]> {
    const list = await prisma.visit.findMany({
      where: { userId },
      include: { region: true, photos: true, shares: true },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    });
    return list.map(mapVisit);
  }

  async listVisibleTo(viewerId: string): Promise<VisitRecord[]> {
    const list = await prisma.visit.findMany({
      where: {
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'GROUP', shares: { some: { userId: viewerId } } },
        ],
      },
      include: { region: true, photos: true, shares: true },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
    });
    return list.map(mapVisit);
  }

  async delete(id: string): Promise<void> {
    await prisma.visit.delete({ where: { id } });
  }

  async setShares(visitId: string, userIds: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.visitShare.deleteMany({ where: { visitId } }),
      prisma.visitShare.createMany({
        data: userIds.map((userId) => ({ visitId, userId })),
      }),
    ]);
  }
}
