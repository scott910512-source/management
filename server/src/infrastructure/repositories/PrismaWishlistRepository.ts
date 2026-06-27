import { prisma } from '../db/prisma';
import type { IWishlistRepository, WishlistRecord } from '../../domain/repositories';

export class PrismaWishlistRepository implements IWishlistRepository {
  async add(userId: string, regionId: string): Promise<WishlistRecord> {
    return (await prisma.wishlist.upsert({
      where: { userId_regionId: { userId, regionId } },
      create: { userId, regionId },
      update: {},
      include: { region: true },
    })) as WishlistRecord;
  }

  async remove(userId: string, regionId: string): Promise<void> {
    await prisma.wishlist.deleteMany({ where: { userId, regionId } });
  }

  async listByUser(userId: string): Promise<WishlistRecord[]> {
    return (await prisma.wishlist.findMany({
      where: { userId },
      include: { region: true },
      orderBy: { createdAt: 'desc' },
    })) as WishlistRecord[];
  }

  async exists(userId: string, regionId: string): Promise<boolean> {
    const found = await prisma.wishlist.findUnique({
      where: { userId_regionId: { userId, regionId } },
    });
    return !!found;
  }
}
