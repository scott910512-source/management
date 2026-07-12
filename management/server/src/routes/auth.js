'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, badRequest } = require('../lib/http');
const { now, newId } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { allowedPlants } = require('../middleware/plant');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, role: u.role, status: u.status, plant: u.plant, plantScope: u.plantScope };
}

// 가입(사용신청): 대기(pending) 상태로 생성, 관리자 승인 필요
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const id = str(req.body.id);
    const password = str(req.body.password);
    const name = str(req.body.name) || id;
    const VALID_PLANTS = require('../lib/store').PLANTS;
    const rawPlant = str(req.body.plant);
    const plant = VALID_PLANTS.includes(rawPlant) ? rawPlant : '2공장';
    if (!id || !password) throw badRequest('아이디와 비밀번호를 입력하세요.');
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(id)) throw badRequest('아이디는 영문/숫자 3~20자여야 합니다.');
    if (password.length < 4) throw badRequest('비밀번호는 4자 이상이어야 합니다.');

    const result = await mutate('users', null, (rows) => {
      if (rows.some((r) => r.id === id)) throw badRequest('이미 사용 중인 아이디입니다.');
      const user = {
        id,
        passwordHash: bcrypt.hashSync(password, 10),
        name,
        role: 'user',
        status: 'pending',
        plant,
        plantScope: plant,
        createdAt: now(),
        approvedAt: '',
        approvedBy: '',
      };
      rows.push(user);
      return user;
    });
    res.status(201).json({ user: publicUser(result), message: '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
  }),
);

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

async function writeLoginLog(userId, userName, ip, result, note) {
  try {
    await mutate('login_logs', null, (rows) => {
      rows.push({ id: newId('ll'), userId, userName, ip, result, note, createdAt: now() });
      // 최대 2000건 유지
      if (rows.length > 2000) rows.splice(0, rows.length - 2000);
    });
  } catch (_) { /* 로그 실패가 로그인을 막지 않도록 */ }
}

// 로그인
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const id = str(req.body.id);
    const password = str(req.body.password);
    const ip = getIp(req);
    if (!id || !password) throw badRequest('아이디와 비밀번호를 입력하세요.');

    const users = await readTable('users');
    const user = users.find((u) => u.id === id);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      await writeLoginLog(id, '', ip, 'fail', '아이디 또는 비밀번호 불일치');
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (user.status === 'pending') {
      await writeLoginLog(id, user.name, ip, 'blocked', '승인 대기 계정');
      return res.status(403).json({ error: '가입 승인 대기 중입니다. 관리자에게 문의하세요.' });
    }
    if (user.status !== 'approved') {
      await writeLoginLog(id, user.name, ip, 'blocked', '제한된 계정');
      return res.status(403).json({ error: '사용이 제한된 계정입니다. 관리자에게 문의하세요.' });
    }

    req.session.user = { id: user.id, name: user.name, role: user.role, plant: user.plant, plantScope: user.plantScope };
    await writeLoginLog(id, user.name, ip, 'success', '');
    res.json({ user: publicUser(user), plants: await allowedPlants(user) });
  }),
);

// 로그아웃
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  }),
);

// 로그인 이력 조회 (관리자 전용)
router.get(
  '/login-logs',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const rows = await readTable('login_logs');
    const items = rows.slice(-limit).reverse();
    res.json({ items });
  }),
);

// 현재 로그인 사용자
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.session.user, plants: await allowedPlants(req.session.user) });
  }),
);

module.exports = router;
