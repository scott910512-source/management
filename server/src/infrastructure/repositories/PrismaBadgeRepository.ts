import { prisma } from '../db/prisma';
import type { IBadgeRepository, BadgeRecord } from '../../domain/repositories';

export class PrismaBadgeRepository implements IBadgeRepository {
  async listAll(): Promise<BadgeRecord[]> {
    return (await prisma.badge.findMany()) as BadgeRecord[];
  }

  async findByKey(key: string): Promise<BadgeRecord | null> {
    return (await prisma.badge.findUnique({ where: { key } })) as BadgeRecord | null;
  }

  async listEarned(userId: string): Promise<{ badge: BadgeRecord; earnedAt: Date }[]> {
    const rows = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
    return rows.map((r) => ({ badge: r.badge as BadgeRecord, earnedAt: r.earnedAt }));
  }

  async award(userId: string, badgeId: string): Promise<boolean> {
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    if (existing) return false;
    await prisma.userBadge.create({ data: { userId, badgeId } });
    return true;
  }

  async hasBadge(userId: string, badgeId: string): Promise<boolean> {
    const f = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    return !!f;
  }
}
