import { prisma } from '../db/prisma';
import type { IRegionRepository, RegionRecord } from '../../domain/repositories';

export class PrismaRegionRepository implements IRegionRepository {
  async listAll(): Promise<RegionRecord[]> {
    return (await prisma.region.findMany({
      orderBy: [{ provinceName: 'asc' }, { order: 'asc' }],
    })) as RegionRecord[];
  }

  async findById(id: string): Promise<RegionRecord | null> {
    return (await prisma.region.findUnique({ where: { id } })) as RegionRecord | null;
  }

  async search(keyword: string): Promise<RegionRecord[]> {
    return (await prisma.region.findMany({
      where: {
        OR: [
          { district: { contains: keyword } },
          { provinceName: { contains: keyword } },
        ],
      },
      orderBy: [{ provinceName: 'asc' }, { order: 'asc' }],
      take: 50,
    })) as RegionRecord[];
  }

  async count(): Promise<number> {
    return prisma.region.count();
  }
}
