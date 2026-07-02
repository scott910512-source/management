'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 제품(사용처) 목록
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await readTable('products', req.plant);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ items: rows });
  }),
);

// 제품 등록 (관리자)
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = str(req.body.name);
    if (!name) throw badRequest('제품(사용처) 이름을 입력하세요.');
    const me = req.session.user.id;
    const item = await mutate('products', req.plant, (rows) => {
      if (rows.some((r) => r.name === name)) throw badRequest('이미 등록된 제품입니다.');
      const row = { id: newId('pd'), name, note: str(req.body.note), createdBy: me, createdAt: now() };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// 제품 삭제 (관리자) — 해당 제품의 BOM도 함께 삭제
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    let removedName = null;
    await mutate('products', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('제품을 찾을 수 없습니다.');
      removedName = rows[idx].name;
      rows.splice(idx, 1);
    });
    if (removedName) {
      await mutate('boms', req.plant, (rows) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].product === removedName) rows.splice(i, 1);
      });
    }
    res.json({ ok: true });
  }),
);

// 제품별 BOM 조회 (?product= 지정 시 해당 제품만)
router.get(
  '/bom',
  asyncHandler(async (req, res) => {
    const product = str(req.query.product);
    const rows = await readTable('boms', req.plant);
    const items = (product ? rows.filter((r) => r.product === product) : rows)
      .sort((a, b) => (a.category === b.category ? a.materialName.localeCompare(b.materialName) : a.category < b.category ? -1 : 1));
    res.json({ items });
  }),
);

// BOM 추가/수정 (관리자) — (제품, 구분, 품목) 기준 upsert
router.post(
  '/bom',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const product = str(req.body.product);
    const category = str(req.body.category);
    const materialName = str(req.body.materialName);
    const qtyPerBatch = num(req.body.qtyPerBatch);
    if (!product) throw badRequest('제품을 선택하세요.');
    if (!['raw', 'sub'].includes(category)) throw badRequest('구분(원/부재료)이 올바르지 않습니다.');
    if (!materialName) throw badRequest('품목을 선택하세요.');
    if (Number.isNaN(qtyPerBatch) || qtyPerBatch < 0) throw badRequest('Batch당 기준량은 0 이상이어야 합니다.');

    const me = req.session.user.id;
    const item = await mutate('boms', req.plant, (rows) => {
      const ex = rows.find((r) => r.product === product && r.category === category && r.materialName === materialName);
      if (ex) {
        ex.qtyPerBatch = String(qtyPerBatch);
        ex.updatedBy = me;
        ex.updatedAt = now();
        return ex;
      }
      const row = {
        id: newId('bm'), product, category, materialName, qtyPerBatch: String(qtyPerBatch),
        createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// BOM 줄 삭제 (관리자)
router.delete(
  '/bom/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('boms', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('BOM 항목을 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

// 사용 처리 자동입력용 — (제품, 구분, 품목)의 Batch 기준량
// 품목그룹 대응: BOM이 품목그룹명으로 등록된 경우, 그 그룹에 속한 어떤 납품업체
// 품목으로 사용 처리하더라도 동일한 기준량이 자동 반영되어야 한다.
router.get(
  '/standard-qty',
  asyncHandler(async (req, res) => {
    const product = str(req.query.product);
    const category = str(req.query.category);
    const materialName = str(req.query.materialName);
    if (!product || !materialName) return res.json({ qtyPerBatch: 0 });
    const [boms, items] = await Promise.all([
      readTable('boms', req.plant),
      readTable('items', req.plant),
    ]);
    const master = items.find((i) => i.category === category && i.name === materialName);
    const group = master && (master.itemGroup || '').trim();
    const candidates = group ? [materialName, group] : [materialName];
    const hit = boms.find((r) => r.product === product && r.category === category && candidates.includes(r.materialName));
    res.json({ qtyPerBatch: hit ? num(hit.qtyPerBatch) || 0 : 0 });
  }),
);

module.exports = { router };
