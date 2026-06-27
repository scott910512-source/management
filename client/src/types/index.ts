export type Role = 'ADMIN' | 'USER';
export type VisitStatus = 'VISITED' | 'PLANNED' | 'UNVISITED';
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'GROUP';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Region {
  id: string;
  provinceId: string;
  provinceName: string;
  district: string;
  order: number;
}

export interface Photo {
  id: string;
  visitId: string;
  imagePath: string;
  caption: string | null;
  createdAt: string;
}

export interface Visit {
  id: string;
  userId: string;
  regionId: string;
  status: VisitStatus;
  visitDate: string | null;
  memo: string | null;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  region?: Region;
  photos?: Photo[];
  shareUserIds?: string[];
}

export interface ProvinceStat {
  province: string;
  total: number;
  visited: number;
  planned: number;
  rate: number;
}

export interface OverallStats {
  totalRegions: number;
  visitedCount: number;
  plannedCount: number;
  rate: number;
  thisYearVisited: number;
  provinceStats: ProvinceStat[];
  ranking: ProvinceStat[];
}

export interface WishlistItem {
  id: string;
  userId: string;
  regionId: string;
  createdAt: string;
  region?: Region;
}

export interface Badge {
  key: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface AdminUser extends User {
  createdAt: string;
}
