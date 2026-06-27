'use strict';

const express = require('express');
const { readTable, mutate, headersOf } = require('../lib/store');
const { asyncHandler, str, notFound, sendCsv } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 이상발생 목록(최신순)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = str(req.query.q).toLowerCase();
    const rows = (await readTable('anomalies', req.plant))
      .filter((r) => !q || `${r.type} ${r.itemName} ${r.lotInfo} ${r.account}`.toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items: rows });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await readTable('anomalies', req.plant);
    sendCsv(res, headersOf('anomalies'), rows, '이상발생목록');
  }),
);

// 삭제(관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('anomalies', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('이상발생 항목을 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router };
