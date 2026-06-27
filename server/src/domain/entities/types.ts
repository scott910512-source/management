/** 도메인 공용 타입 (DB enum 대신 문자열 유니온 사용 - PostgreSQL 전환 호환) */

export type Role = 'ADMIN' | 'USER';
export const ROLES: Role[] = ['ADMIN', 'USER'];

export type VisitStatus = 'VISITED' | 'PLANNED' | 'UNVISITED';
export const VISIT_STATUSES: VisitStatus[] = ['VISITED', 'PLANNED', 'UNVISITED'];

export type Visibility = 'PUBLIC' | 'PRIVATE' | 'GROUP';
export const VISIBILITIES: Visibility[] = ['PUBLIC', 'PRIVATE', 'GROUP'];

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface RegionEntity {
  id: string;
  provinceId: string;
  provinceName: string;
  district: string;
  order: number;
}

export interface VisitEntity {
  id: string;
  userId: string;
  regionId: string;
  status: VisitStatus;
  visitDate: Date | null;
  memo: string | null;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}
