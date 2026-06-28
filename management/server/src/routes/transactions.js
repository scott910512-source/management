'use strict';

const express = require('express');
const { readTable, mutate, headersOf } = require('../lib/store');
const { asyncHandler, str, badRequest, notFound, sendCsv } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

const TYPE_ORDER = { raw: 0, sub: 1, canister: 2 };

function filterRows(rows, query) {
  const type = str(query.materialType); // raw | sub | canister
  const kind = str(query.type); // 입고 | 출고 | 반입 | 반출
  const q = str(query.q).toLowerCase();
  const from = str(query.from);
  const to = str(query.to);
  const sort = str(query.sort) || 'category'; // category | date
  const list = rows.filter((r) => {
    if (type && r.materialType !== type) return false;
    if (kind && r.type !== kind) return false;
    if (q && !`${r.materialName} ${r.lotNo} ${r.content}`.toLowerCase().includes(q)) return false;
    const day = (r.createdAt || '').slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  if (sort === 'date') {
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } else {
    // 대분류(원>부>Canister) > 제품/품목명 > 최신순
    list.sort((a, b) => {
      const ta = TYPE_ORDER[a.materialType] ?? 9;
      const tb = TYPE_ORDER[b.materialType] ?? 9;
      if (ta !== tb) return ta - tb;
      if (a.materialName !== b.materialName) return a.materialName.localeCompare(b.materialName);
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }
  return list;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await readTable('transactions', req.plant);
    res.json({ items: filterRows(rows, req.query) });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await readTable('transactions', req.plant);
    sendCsv(res, headersOf('transactions'), filterRows(rows, req.query), '수불내역');
  }),
);

// 수불 내역 수정(비고·구분·수량 등 기록 정정). 재고는 재계산하지 않는 단순 기록 정정.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await mutate('transactions', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('수불 내역을 찾을 수 없습니다.');
      for (const f of ['note', 'materialName', 'lotNo', 'content']) {
        if (req.body[f] !== undefined) r[f] = str(req.body[f]);
      }
      if (req.body.type !== undefined) {
        const t = str(req.body.type);
        if (!['입고', '출고', '반입', '반출'].includes(t)) throw badRequest('구분 값이 올바르지 않습니다.');
        r.type = t;
      }
      if (req.body.quantity !== undefined) {
        const q = parseFloat(req.body.quantity);
        if (Number.isNaN(q)) throw badRequest('수량은 숫자여야 합니다.');
        r.quantity = String(q);
      }
      return r;
    });
    res.json({ item });
  }),
);

// 수불 내역 삭제(관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('transactions', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('수불 내역을 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router };
