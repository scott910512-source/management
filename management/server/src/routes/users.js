'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, badRequest, notFound } = require('../lib/http');
const { now } = require('../lib/ids');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { isSuper } = require('../middleware/plant');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, role: u.role, status: u.status, plant: u.plant, plantScope: u.plantScope, createdAt: u.createdAt, approvedAt: u.approvedAt, approvedBy: u.approvedBy };
}

// 사용자 관리는 총괄관리자(plantScope=all)만 가능
function requireSuper(req, res, next) {
  if (isSuper(req.session.user)) return next();
  return res.status(403).json({ error: '사용자 관리는 총괄관리자만 가능합니다.' });
}

// 담당자 선택용 사용자 목록(로그인 사용자 접근 가능) — 관리자 게이트 이전에 둔다
router.get(
  '/options',
  requireAuth,
  asyncHandler(async (req, res) => {
    const users = await readTable('users');
    res.json({ items: users.filter((u) => u.status === 'approved').map((u) => ({ id: u.id, name: u.name })) });
  }),
);

router.use(requireAdmin, requireSuper);

// 전체 사용자 목록(관리자)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await readTable('users');
    res.json({ items: users.map(publicUser) });
  }),
);

// 가입 승인(+선택적으로 역할 지정)
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const role = str(req.body.role) || 'user';
    if (!['user','admin','viewer','demo'].includes(role)) throw badRequest('역할값이 올바르지 않습니다.');
    const updated = await mutate('users', null, (rows) => {
      const u = rows.find((r) => r.id === req.params.id);
      if (!u) throw notFound('사용자를 찾을 수 없습니다.');
      u.status = 'approved';
      u.role = role;
      if (req.body.plant) u.plant = str(req.body.plant);
      if (req.body.plantScope) u.plantScope = str(req.body.plantScope);
      if (!u.plant) u.plant = '2공장';
      if (!u.plantScope) u.plantScope = u.plant;
      u.approvedAt = now();
      u.approvedBy = req.session.user.id;
      return u;
    });
    res.json({ user: publicUser(updated) });
  }),
);

// 가입 거절(사용금지 처리)
router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const updated = await mutate('users', null, (rows) => {
      const u = rows.find((r) => r.id === req.params.id);
      if (!u) throw notFound('사용자를 찾을 수 없습니다.');
      u.status = 'rejected';
      return u;
    });
    res.json({ user: publicUser(updated) });
  }),
);

// 사용자 수정(역할/상태/이름/비밀번호 초기화)
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const updated = await mutate('users', null, (rows) => {
      const u = rows.find((r) => r.id === req.params.id);
      if (!u) throw notFound('사용자를 찾을 수 없습니다.');
      if (req.body.role !== undefined) {
        const role = str(req.body.role);
        if (!['user','admin','viewer'].includes(role)) throw badRequest('역할 값이 올바르지 않습니다.');
        // 마지막 관리자 강등 방지
        if (u.role === 'admin' && role !== 'admin') {
          const admins = rows.filter((r) => r.role === 'admin' && r.status === 'approved');
          if (admins.length <= 1) throw badRequest('마지막 관리자는 강등할 수 없습니다.');
        }
        u.role = role;
      }
      if (req.body.status !== undefined) {
        const status = str(req.body.status);
        if (!['pending', 'approved', 'rejected'].includes(status)) throw badRequest('상태 값이 올바르지 않습니다.');
        u.status = status;
      }
      if (req.body.name !== undefined) u.name = str(req.body.name);
      if (req.body.plant !== undefined) u.plant = str(req.body.plant);
      if (req.body.plantScope !== undefined) u.plantScope = str(req.body.plantScope);
      if (req.body.password) {
        if (str(req.body.password).length < 4) throw badRequest('비밀번호는 4자 이상이어야 합니다.');
        u.passwordHash = bcrypt.hashSync(str(req.body.password), 10);
      }
      return u;
    });
    res.json({ user: publicUser(updated) });
  }),
);

// 사용자 삭제(자기 자신/마지막 관리자 보호)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.session.user.id) throw badRequest('자기 자신은 삭제할 수 없습니다.');
    await mutate('users', null, (rows) => {
      const idx = rows.findIndex((r) => r.id === req.params.id);
      if (idx < 0) throw notFound('사용자를 찾을 수 없습니다.');
      if (rows[idx].role === 'admin') {
        const admins = rows.filter((r) => r.role === 'admin' && r.status === 'approved');
        if (admins.length <= 1) throw badRequest('마지막 관리자는 삭제할 수 없습니다.');
      }
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = router;
