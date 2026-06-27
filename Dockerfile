# =========================================================
# Travel Korea Tracker - 단일 이미지 (프론트엔드 + 백엔드)
# 내부망 배포용: 클라이언트를 빌드해 Express 가 정적 서빙합니다.
# =========================================================

# ---- 1) 클라이언트 빌드 ----
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- 2) 서버 빌드 ----
FROM node:22-alpine AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/tsconfig.json ./
COPY server/prisma ./prisma
COPY server/src ./src
RUN npx prisma generate && npm run build

# ---- 3) 런타임 ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/prisma ./prisma
RUN npx prisma generate
COPY --from=server-build /app/dist ./dist
# 빌드된 프론트엔드를 public/ 으로 배치 (app.ts 가 정적 서빙)
COPY --from=client /client/dist ./public
RUN mkdir -p uploads
EXPOSE 4000
# DB 스키마 적용 후 서버 기동 (서버 부팅 시 자동 시드)
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
