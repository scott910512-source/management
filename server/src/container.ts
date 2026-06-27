/**
 * Composition Root - 의존성 주입(DI) 컨테이너.
 * 모든 구체 구현(Prisma 레포지토리)을 생성하고 서비스에 주입합니다.
 * 테스트/PostgreSQL 전환 시 레포지토리 구현만 교체하면 됩니다.
 */
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaRegionRepository } from './infrastructure/repositories/PrismaRegionRepository';
import { PrismaVisitRepository } from './infrastructure/repositories/PrismaVisitRepository';
import { PrismaPhotoRepository } from './infrastructure/repositories/PrismaPhotoRepository';
import { PrismaWishlistRepository } from './infrastructure/repositories/PrismaWishlistRepository';
import { PrismaBadgeRepository } from './infrastructure/repositories/PrismaBadgeRepository';

import { AuthService } from './application/services/AuthService';
import { VisitService } from './application/services/VisitService';
import { WishlistService } from './application/services/WishlistService';
import { PhotoService } from './application/services/PhotoService';
import { StatsService } from './application/services/StatsService';
import { BadgeService } from './application/services/BadgeService';
import { AdminService } from './application/services/AdminService';
import { ExportService } from './application/services/ExportService';

// Repositories
const userRepo = new PrismaUserRepository();
const regionRepo = new PrismaRegionRepository();
const visitRepo = new PrismaVisitRepository();
const photoRepo = new PrismaPhotoRepository();
const wishlistRepo = new PrismaWishlistRepository();
const badgeRepo = new PrismaBadgeRepository();

// Services
const badgeService = new BadgeService(badgeRepo, regionRepo, visitRepo);
const authService = new AuthService(userRepo);
const visitService = new VisitService(visitRepo, regionRepo, userRepo, badgeService);
const wishlistService = new WishlistService(wishlistRepo, regionRepo);
const photoService = new PhotoService(photoRepo, visitRepo);
const statsService = new StatsService(regionRepo, visitRepo);
const adminService = new AdminService(userRepo);
const exportService = new ExportService(visitRepo, wishlistRepo, regionRepo);

export const container = {
  repos: { userRepo, regionRepo, visitRepo, photoRepo, wishlistRepo, badgeRepo },
  authService,
  visitService,
  wishlistService,
  photoService,
  statsService,
  badgeService,
  adminService,
  exportService,
};

export type Container = typeof container;
