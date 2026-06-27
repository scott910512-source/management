import { PrismaClient } from '@prisma/client';
import { isProd } from '../../config/env';

/** 싱글톤 PrismaClient */
export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['warn', 'error'],
});
