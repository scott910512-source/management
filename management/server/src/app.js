'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const { SESSION_SECRET, NODE_ENV } = require('./config');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const { router: itemsRoutes } = require('./routes/items');
const { router: rawRoutes } = require('./routes/rawMaterials');
const { router: subRoutes } = require('./routes/subMaterials');
const { router: canisterRoutes } = require('./routes/canisters');
const { router: txRoutes } = require('./routes/transactions');
const { router: dashboardRoutes } = require('./routes/dashboard');
const { router: settingsRoutes } = require('./routes/settings');
const { router: metaRoutes } = require('./routes/meta');
const { router: anomaliesRoutes } = require('./routes/anomalies');
const { router: tasksRoutes } = require('./routes/tasks');
const { router: warningsRoutes } = require('./routes/warnings');
const { router: trendsRoutes } = require('./routes/trends');
const { router: searchRoutes } = require('./routes/search');
const { router: hazardousRoutes } = require('./routes/hazardous');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.use(
    session({
      name: 'connect.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // 사내망 HTTP 환경
        maxAge: 1000 * 60 * 60 * 12, // 12시간
      },
    }),
  );

  app.get('/api/health', (req, res) => res.json({ ok: true, env: NODE_ENV }));

  // 팀관리자(viewer)는 전체 조회만 가능 — 모든 쓰기(POST/PATCH/DELETE) 차단(인증/로그아웃 제외)
  app.use((req, res, next) => {
    const u = req.session && req.session.user;
    if (u && u.role === 'viewer' && req.method !== 'GET' && req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
      return res.status(403).json({ error: '팀관리자(조회 전용)는 등록·수정·삭제를 할 수 없습니다.' });
    }
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/raw-materials', rawRoutes);
  app.use('/api/sub-materials', subRoutes);
  app.use('/api/canisters', canisterRoutes);
  app.use('/api/transactions', txRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/anomalies', anomaliesRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/warnings', warningsRoutes);
  app.use('/api/trends', trendsRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/hazardous', hazardousRoutes);

  // 프로덕션: 빌드된 React 정적 파일 서빙 + SPA 폴백
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 404 (API)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: '존재하지 않는 API 경로입니다.' });
  });

  // 공통 에러 핸들러
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[error]', err);
    }
    res.status(status).json({ error: err.message || '서버 오류가 발생했습니다.' });
  });

  return app;
}

module.exports = { createApp };
