'use strict';

const express = require('express');
const { readTable, mutate, headersOf } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound, sendCsv } = require('../lib/http');
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

// 수불 내역 일괄 삭제(관리자) — ids(개별) 또는 batchIds(배치 투입 전체)
router.post(
  '/bulk-delete',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const ids = new Set(Array.isArray(req.body.ids) ? req.body.ids.map(String) : []);
    const batchIds = new Set(Array.isArray(req.body.batchIds) ? req.body.batchIds.map(String) : []);
    const restock = req.body.restock === true || req.body.restock === '1';
    if (ids.size === 0 && batchIds.size === 0) throw badRequest('삭제할 항목을 선택하세요.');

    const txns = await readTable('transactions', req.plant);
    const match = (t) => ids.has(t.id) || (t.batchId && batchIds.has(t.batchId));
    const toDel = txns.filter(match);
    if (toDel.length === 0) return res.json({ ok: true, removed: 0, restocked: false });

    // 재고 원복: 삭제되는 출고/반출은 재고를 더하고, 입고/반입은 빼서 되돌린다(raw/sub Lot)
    if (restock) {
      const adj = { raw: new Map(), sub: new Map() };
      for (const t of toDel) {
        if (t.materialType !== 'raw' && t.materialType !== 'sub') continue;
        const q = num(t.quantity) || 0;
        const delta = (t.type === '출고' || t.type === '반출') ? q : -q;
        adj[t.materialType].set(t.materialId, (adj[t.materialType].get(t.materialId) || 0) + delta);
      }
      for (const cat of ['raw', 'sub']) {
        if (adj[cat].size === 0) continue;
        const table = cat === 'raw' ? 'raw_materials' : 'sub_materials';
        const qtyKey = cat === 'raw' ? 'quantity' : 'weight';
        await mutate(table, req.plant, (rows) => {
          for (const [mid, delta] of adj[cat]) {
            const r = rows.find((x) => x.id === mid);
            if (r) r[qtyKey] = String(Math.max(0, (num(r[qtyKey]) || 0) + delta));
          }
        });
      }
    }

    let removed = 0;
    await mutate('transactions', req.plant, (rows) => {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (match(rows[i])) { rows.splice(i, 1); removed++; }
      }
    });
    // 배치 단위 삭제 시 비워진 배치 레코드 정리(번호 재사용 가능)
    if (batchIds.size > 0) {
      await mutate('batches', req.plant, (rows) => {
        for (let i = rows.length - 1; i >= 0; i--) if (batchIds.has(rows[i].id)) rows.splice(i, 1);
      });
    }
    res.json({ ok: true, removed, restocked: restock });
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
