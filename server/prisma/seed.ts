/**
 * 독립 실행 시드 스크립트 (`npm run seed` / `prisma db seed`).
 * 실제 로직은 src/infrastructure/db/seeder.ts 에 있으며, 서버 부팅 시에도 재사용됩니다.
 */
import { prisma } from '../src/infrastructure/db/prisma';
import { seedCore, seedSample } from '../src/infrastructure/db/seeder';

const runSample = (process.env.SEED_SAMPLE ?? 'true') === 'true';

async function main() {
  console.log('\n=== Travel Korea Tracker DB 시드 시작 ===\n');
  await seedCore(prisma, true);
  if (runSample) await seedSample(prisma, true);
  console.log('\n=== 시드 완료 ===\n');
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
