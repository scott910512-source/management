'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, badRequest, notFound } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
const CATEGORIES = ['공정', '원부재료', '현장관리', '안전', '공사', '기타'];
const PRIORITIES = ['상', '중', '하'];
const STATUSES = ['완료', '진행중', '대기', '지연'];

router.use(requireAuth, resolvePlant);

const PRIO_ORDER = { 상: 0, 중: 1, 하: 2 };

// Task 목록 (all=1이면 완료 포함)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeAll = str(req.query.all) === '1';
    let rows = await readTable('tasks', req.plant);
    if (!includeAll) rows = rows.filter((r) => r.status !== '완료');
    rows.sort((a, b) => {
      const pa = PRIO_ORDER[a.priority] ?? 9;
      const pb = PRIO_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
    });
    res.json({ items: rows });
  }),
);

// Task 등록
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = str(req.body.title);
    const category = str(req.body.category);
    const priority = str(req.body.priority) || '중';
    const status = str(req.body.status) || '대기';
    if (!title) throw badRequest('Task명을 입력하세요.');
    if (!CATEGORIES.includes(category)) throw badRequest('구분을 선택하세요.');
    if (!PRIORITIES.includes(priority)) throw badRequest('우선순위 값이 올바르지 않습니다.');
    if (!STATUSES.includes(status)) throw badRequest('진행현황 값이 올바르지 않습니다.');

    const me = req.session.user.id;
    const item = await mutate('tasks', req.plant, (rows) => {
      const row = {
        id: newId('tk'), title, category, categoryEtc: str(req.body.categoryEtc),
        priority, assignee: str(req.body.assignee), dueDate: str(req.body.dueDate), status,
        note: str(req.body.note), createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// Task 수정/완료처리
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const item = await mutate('tasks', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('Task를 찾을 수 없습니다.');
      if (req.body.title !== undefined) r.title = str(req.body.title);
      if (req.body.category !== undefined) r.category = str(req.body.category);
      if (req.body.categoryEtc !== undefined) r.categoryEtc = str(req.body.categoryEtc);
      if (req.body.priority !== undefined) r.priority = str(req.body.priority);
      if (req.body.assignee !== undefined) r.assignee = str(req.body.assignee);
      if (req.body.dueDate !== undefined) r.dueDate = str(req.body.dueDate);
      if (req.body.status !== undefined) {
        if (!STATUSES.includes(str(req.body.status))) throw badRequest('진행현황 값이 올바르지 않습니다.');
        r.status = str(req.body.status);
      }
      if (req.body.note !== undefined) r.note = str(req.body.note);
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 삭제(관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('tasks', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('Task를 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router, CATEGORIES, PRIORITIES, STATUSES };
