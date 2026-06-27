/**
 * 도메인 레포지토리 인터페이스 (포트).
 * 애플리케이션 계층은 구체 구현(Prisma)이 아닌 이 인터페이스에 의존합니다.
 */
import type { Role, VisitStatus, Visibility } from '../entities/types';

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: { name: string; email: string; password: string; role?: Role }): Promise<UserRecord>;
  list(): Promise<UserRecord[]>;
  updateRole(id: string, role: Role): Promise<UserRecord>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: Date;
}

export interface IRegionRepository {
  listAll(): Promise<RegionRecord[]>;
  findById(id: string): Promise<RegionRecord | null>;
  search(keyword: string): Promise<RegionRecord[]>;
  count(): Promise<number>;
}

export interface RegionRecord {
  id: string;
  provinceId: string;
  provinceName: string;
  district: string;
  order: number;
}

export interface VisitUpsertInput {
  userId: string;
  regionId: string;
  status: VisitStatus;
  visitDate?: Date | null;
  memo?: string | null;
  visibility?: Visibility;
}

export interface IVisitRepository {
  upsert(data: VisitUpsertInput): Promise<VisitRecord>;
  findByUserAndRegion(userId: string, regionId: string): Promise<VisitRecord | null>;
  findById(id: string): Promise<VisitRecord | null>;
  listByUser(userId: string): Promise<VisitRecord[]>;
  /** 공개(PUBLIC) 또는 특정 사용자에게 그룹공유된 방문 */
  listVisibleTo(viewerId: string): Promise<VisitRecord[]>;
  delete(id: string): Promise<void>;
  setShares(visitId: string, userIds: string[]): Promise<void>;
}

export interface VisitRecord {
  id: string;
  userId: string;
  regionId: string;
  status: VisitStatus;
  visitDate: Date | null;
  memo: string | null;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
  region?: RegionRecord;
  photos?: PhotoRecord[];
  shareUserIds?: string[];
}

export interface PhotoRecord {
  id: string;
  visitId: string;
  imagePath: string;
  caption: string | null;
  createdAt: Date;
}

export interface IPhotoRepository {
  add(visitId: string, imagePath: string, caption?: string | null): Promise<PhotoRecord>;
  countByVisit(visitId: string): Promise<number>;
  listByVisit(visitId: string): Promise<PhotoRecord[]>;
  findById(id: string): Promise<PhotoRecord | null>;
  delete(id: string): Promise<void>;
}

export interface IWishlistRepository {
  add(userId: string, regionId: string): Promise<WishlistRecord>;
  remove(userId: string, regionId: string): Promise<void>;
  listByUser(userId: string): Promise<WishlistRecord[]>;
  exists(userId: string, regionId: string): Promise<boolean>;
}

export interface WishlistRecord {
  id: string;
  userId: string;
  regionId: string;
  createdAt: Date;
  region?: RegionRecord;
}

export interface BadgeRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
}

export interface IBadgeRepository {
  listAll(): Promise<BadgeRecord[]>;
  findByKey(key: string): Promise<BadgeRecord | null>;
  listEarned(userId: string): Promise<{ badge: BadgeRecord; earnedAt: Date }[]>;
  award(userId: string, badgeId: string): Promise<boolean>;
  hasBadge(userId: string, badgeId: string): Promise<boolean>;
}
