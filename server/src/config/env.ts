import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/** 환경변수 중앙 관리. 누락 시 안전한 기본값 제공 (내부망/개발 편의) */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET ?? 'travel-korea-tracker-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  /** 업로드 파일 저장 경로 */
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads'),
  /** CORS 허용 오리진 (콤마 구분). '*' 허용 */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  /** 초기 관리자 계정 */
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@travel.kr',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin1234',
  adminName: process.env.ADMIN_NAME ?? '관리자',
  /** 방문당 최대 사진 수 */
  maxPhotosPerVisit: Number(process.env.MAX_PHOTOS_PER_VISIT ?? 20),
  /** 샘플 데이터 생성 여부 */
  seedSample: (process.env.SEED_SAMPLE ?? 'true') === 'true',
} as const;

export const isProd = env.nodeEnv === 'production';
