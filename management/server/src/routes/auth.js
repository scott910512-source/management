'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, badRequest } = require('../lib/http');
const { now } = require('../lib/ids');
const { requireAuth } = require('../middleware/auth');
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
        plant: '2공장',
        plantScope: '2공장',
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

// 로그인
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const id = str(req.body.id);
    const password = str(req.body.password);
    if (!id || !password) throw badRequest('아이디와 비밀번호를 입력하세요.');

    const users = await readTable('users');
    const user = users.find((u) => u.id === id);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (user.status === 'pending') return res.status(403).json({ error: '가입 승인 대기 중입니다. 관리자에게 문의하세요.' });
    if (user.status !== 'approved') return res.status(403).json({ error: '사용이 제한된 계정입니다. 관리자에게 문의하세요.' });

    req.session.user = { id: user.id, name: user.name, role: user.role, plant: user.plant, plantScope: user.plantScope };
    res.json({ user: publicUser(user), plants: allowedPlants(user) });
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

// 현재 로그인 사용자
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.session.user, plants: allowedPlants(req.session.user) });
  }),
);

module.exports = router;
