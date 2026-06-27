import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { KOREA_REGIONS, TOTAL_DISTRICT_COUNT } from './regions';
import { BADGE_DEFINITIONS, BadgeService } from '../../application/services/BadgeService';
import { PrismaBadgeRepository } from '../repositories/PrismaBadgeRepository';
import { PrismaRegionRepository } from '../repositories/PrismaRegionRepository';
import { PrismaVisitRepository } from '../repositories/PrismaVisitRepository';
import { env } from '../../config/env';

/** 시도/시군구 시드 (멱등) */
export async function seedRegions(prisma: PrismaClient): Promise<number> {
  for (let pi = 0; pi < KOREA_REGIONS.length; pi++) {
    const p = KOREA_REGIONS[pi];
    const province = await prisma.province.upsert({
      where: { code: p.code },
      create: { name: p.province, code: p.code, order: pi },
      update: { name: p.province, order: pi },
    });
    for (let di = 0; di < p.districts.length; di++) {
      const district = p.districts[di];
      await prisma.region.upsert({
        where: { provinceId_district: { provinceId: province.id, district } },
        create: { provinceId: province.id, provinceName: p.province, district, order: di },
        update: { provinceName: p.province, order: di },
      });
    }
  }
  return prisma.region.count();
}

/** 배지 시드 (멱등) */
export async function seedBadges(prisma: PrismaClient): Promise<void> {
  for (const b of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { key: b.key },
      create: { key: b.key, name: b.name, description: b.description, icon: b.icon },
      update: { name: b.name, description: b.description, icon: b.icon },
    });
  }
}

/** 초기 관리자 계정 생성 (없으면) */
export async function seedAdmin(prisma: PrismaClient): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({ where: { email: env.adminEmail } });
  if (existing) return existing;
  const hashed = await bcrypt.hash(env.adminPassword, 10);
  return prisma.user.create({
    data: { name: env.adminName, email: env.adminEmail, password: hashed, role: 'ADMIN' },
  });
}

/** 핵심 데이터 시드 (지역/배지/관리자). 서버 부팅 시에도 호출 - 멱등 */
export async function seedCore(prisma: PrismaClient, log = false): Promise<void> {
  const count = await seedRegions(prisma);
  await seedBadges(prisma);
  const admin = await seedAdmin(prisma);
  if (log) {
    console.log(`📍 시군구 ${count}/${TOTAL_DISTRICT_COUNT}개, 🏅 배지, 👤 관리자(${env.adminEmail}) 준비 완료`);
  }
  void admin;
}

/** 샘플 데이터 (관리자/데모 사용자 방문·버킷리스트). 이미 있으면 건너뜀 */
export async function seedSample(prisma: PrismaClient, log = false): Promise<void> {
  const admin = await seedAdmin(prisma);
  const existingVisits = await prisma.visit.count({ where: { userId: admin.id } });
  if (existingVisits > 0) {
    if (log) console.log('🧪 샘플 데이터 - 이미 존재하여 건너뜀');
    return;
  }

  const demoPw = await bcrypt.hash('demo1234', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@travel.kr' },
    create: { name: '여행러', email: 'demo@travel.kr', password: demoPw, role: 'USER' },
    update: {},
  });

  const pick = (province: string, district: string) =>
    prisma.region.findFirst({ where: { provinceName: province, district } });

  const sampleVisits = [
    { province: '경상북도', district: '안동시', status: 'VISITED', date: '2026-03-15', memo: '선어대포차 방문\n하회마을 관광\n찜닭 맛집 방문', visibility: 'PUBLIC' },
    { province: '부산광역시', district: '해운대구', status: 'VISITED', date: '2026-04-01', memo: '해운대 해수욕장, 광안리 야경', visibility: 'PUBLIC' },
    { province: '강원특별자치도', district: '강릉시', status: 'VISITED', date: '2026-05-10', memo: '안목해변 커피거리, 경포대', visibility: 'PRIVATE' },
    { province: '제주특별자치도', district: '제주시', status: 'VISITED', date: '2026-02-20', memo: '제주 동문시장, 한라산 입구', visibility: 'PUBLIC' },
    { province: '서울특별시', district: '종로구', status: 'VISITED', date: '2026-01-05', memo: '경복궁, 북촌한옥마을' },
    { province: '서울특별시', district: '강남구', status: 'VISITED', date: '2026-01-12' },
    { province: '경상북도', district: '경주시', status: 'PLANNED', memo: '불국사, 첨성대 예정' },
    { province: '전라남도', district: '여수시', status: 'PLANNED' },
  ] as const;

  for (const s of sampleVisits) {
    const region = await pick(s.province, s.district);
    if (!region) continue;
    await prisma.visit.create({
      data: {
        userId: admin.id,
        regionId: region.id,
        status: s.status,
        visitDate: 'date' in s && s.date ? new Date(s.date) : null,
        memo: 'memo' in s ? (s.memo ?? null) : null,
        visibility: 'visibility' in s ? (s.visibility ?? 'PRIVATE') : 'PRIVATE',
      },
    });
  }

  for (const w of [
    { province: '경상북도', district: '울릉군' },
    { province: '강원특별자치도', district: '태백시' },
    { province: '경상남도', district: '통영시' },
  ]) {
    const region = await pick(w.province, w.district);
    if (!region) continue;
    await prisma.wishlist.create({ data: { userId: admin.id, regionId: region.id } });
  }

  const demoRegion = await pick('인천광역시', '연수구');
  if (demoRegion) {
    await prisma.visit.create({
      data: {
        userId: demo.id,
        regionId: demoRegion.id,
        status: 'VISITED',
        visitDate: new Date('2026-05-01'),
        memo: '송도 센트럴파크',
        visibility: 'PUBLIC',
      },
    });
  }
  // 시드된 방문에 대해 배지 자동 평가 (singleton prisma 사용 시에만 유효)
  try {
    const badgeService = new BadgeService(
      new PrismaBadgeRepository(),
      new PrismaRegionRepository(),
      new PrismaVisitRepository(),
    );
    await badgeService.evaluate(admin.id);
    await badgeService.evaluate(demo.id);
  } catch (e) {
    if (log) console.warn('배지 평가 건너뜀:', (e as Error).message);
  }

  if (log) console.log('🧪 샘플 데이터 생성 완료');
}
