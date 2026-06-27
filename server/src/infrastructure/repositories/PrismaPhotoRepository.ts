import { prisma } from '../db/prisma';
import type { IPhotoRepository, PhotoRecord } from '../../domain/repositories';

export class PrismaPhotoRepository implements IPhotoRepository {
  async add(visitId: string, imagePath: string, caption?: string | null): Promise<PhotoRecord> {
    return (await prisma.photo.create({
      data: { visitId, imagePath, caption: caption ?? null },
    })) as PhotoRecord;
  }

  async countByVisit(visitId: string): Promise<number> {
    return prisma.photo.count({ where: { visitId } });
  }

  async listByVisit(visitId: string): Promise<PhotoRecord[]> {
    return (await prisma.photo.findMany({
      where: { visitId },
      orderBy: { createdAt: 'asc' },
    })) as PhotoRecord[];
  }

  async findById(id: string): Promise<PhotoRecord | null> {
    return (await prisma.photo.findUnique({ where: { id } })) as PhotoRecord | null;
  }

  async delete(id: string): Promise<void> {
    await prisma.photo.delete({ where: { id } });
  }
}
