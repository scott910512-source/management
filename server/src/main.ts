import { createApp } from './presentation/http/app';
import { env } from './config/env';
import { prisma } from './infrastructure/db/prisma';
import { seedCore, seedSample } from './infrastructure/db/seeder';

async function bootstrap() {
  // 부팅 시 핵심 데이터(지역/배지/관리자) 멱등 시드 → 내부망/Docker 자동 구성
  try {
    await seedCore(prisma, true);
    if (env.seedSample) await seedSample(prisma, true);
  } catch (e) {
    console.warn('시드 단계 경고(무시 가능):', (e as Error).message);
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`\n🌏 Travel Korea Tracker API running on http://localhost:${env.port}`);
    console.log(`   환경: ${env.nodeEnv}`);
    console.log(`   DB:   ${env.databaseUrl}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} 수신 - 서버를 종료합니다...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
