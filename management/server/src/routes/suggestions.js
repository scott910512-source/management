'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, badRequest, notFound, forbidden } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 목록 (대기 → 완료, 최신순)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows, users] = await Promise.all([readTable('suggestions', req.plant), readTable('users')]);
    const nameOf = (id) => users.find((u) => u.id === id)?.name || id || '';
    const items = rows
      .map((r) => ({ ...r, createdByName: nameOf(r.createdBy), completedByName: nameOf(r.completedBy) }))
      .sort((a, b) => {
        // 대기 먼저, 그 안에서 최신순
        if ((a.status === '완료') !== (b.status === '완료')) return a.status === '완료' ? 1 : -1;
        return (a.createdAt < b.createdAt ? 1 : -1);
      });
    res.json({ items });
  }),
);

// 등록 — 로그인한 모든 사용자(팀관리자 포함) 가능
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = str(req.body.title);
    const category = str(req.body.category);
    const content = str(req.body.content);
    if (!title) throw badRequest('제목을 입력하세요.');
    if (!category) throw badRequest('항목을 선택하세요.');
    if (!content) throw badRequest('내용을 입력하세요.');

    const me = req.session.user.id;
    const item = await mutate('suggestions', req.plant, (rows) => {
      const row = {
        id: newId('sg'), title, category, categoryEtc: str(req.body.categoryEtc), content,
        status: '대기', createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
        completedBy: '', completedAt: '',
      };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// 수정/완료처리
// - 내용 수정(제목/항목/내용): 작성자 또는 관리자만
// - 완료/완료취소: 관리자만
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const isFieldEdit = ['title', 'category', 'categoryEtc', 'content'].some((k) => req.body[k] !== undefined);

    const item = await mutate('suggestions', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('건의사항을 찾을 수 없습니다.');

      if (isFieldEdit) {
        if (r.createdBy !== me && !isAdmin) throw forbidden('작성자 또는 관리자만 수정할 수 있습니다.');
        if (req.body.title !== undefined) { if (!str(req.body.title)) throw badRequest('제목을 입력하세요.'); r.title = str(req.body.title); }
        if (req.body.category !== undefined) r.category = str(req.body.category);
        if (req.body.categoryEtc !== undefined) r.categoryEtc = str(req.body.categoryEtc);
        if (req.body.content !== undefined) r.content = str(req.body.content);
      }

      // 완료 처리/취소 — 관리자만
      if (req.body.status !== undefined) {
        if (!isAdmin) throw forbidden('완료 처리는 관리자만 가능합니다.');
        const next = str(req.body.status);
        if (!['대기', '완료'].includes(next)) throw badRequest('상태 값이 올바르지 않습니다.');
        r.status = next;
        if (next === '완료') { r.completedBy = me; r.completedAt = now(); }
        else { r.completedBy = ''; r.completedAt = ''; }
      }

      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 삭제 — 작성자 또는 관리자
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    await mutate('suggestions', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('건의사항을 찾을 수 없습니다.');
      if (rows[idx].createdBy !== me && !isAdmin) throw forbidden('작성자 또는 관리자만 삭제할 수 있습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router };
