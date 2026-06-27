'use strict';

const express = require('express');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
const CATEGORIES = ['raw', 'sub'];

router.use(requireAuth, resolvePlant);

// 품목 마스터 목록 (category=raw|sub 필터)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const category = str(req.query.category);
    const rows = await readTable('items', req.plant);
    const items = category ? rows.filter((r) => r.category === category) : rows;
    items.sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category < b.category ? -1 : 1));
    res.json({ items });
  }),
);

// 품목 등록 (관리자)
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const category = str(req.body.category);
    const name = str(req.body.name);
    const unit = str(req.body.unit) || 'kg';
    const safetyStock = req.body.safetyStock === '' || req.body.safetyStock === undefined ? 0 : num(req.body.safetyStock);
    if (!CATEGORIES.includes(category)) throw badRequest('구분(원재료/부재료)을 선택하세요.');
    if (!name) throw badRequest('품목명을 입력하세요.');
    if (Number.isNaN(safetyStock) || safetyStock < 0) throw badRequest('안전재고 목표값은 0 이상의 숫자여야 합니다.');

    const me = req.session.user.id;
    const item = await mutate('items', req.plant, (rows) => {
      if (rows.some((r) => r.category === category && r.name === name)) throw badRequest('이미 등록된 품목입니다.');
      const row = {
        id: newId('it'), category, name, unit,
        safetyStock: String(safetyStock), warningPct: str(req.body.warningPct),
        vendor: str(req.body.vendor),
        product: str(req.body.product), defaultQty: str(req.body.defaultQty), lotPattern: str(req.body.lotPattern),
        pkgSize: str(req.body.pkgSize), pkgUnit: str(req.body.pkgUnit), pkgType: str(req.body.pkgType),
        note: str(req.body.note),
        createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// 품목 수정 (관리자) — 안전재고 목표값 포함
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const item = await mutate('items', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('품목을 찾을 수 없습니다.');
      if (req.body.name !== undefined) {
        const name = str(req.body.name);
        if (!name) throw badRequest('품목명을 입력하세요.');
        if (rows.some((x) => x.category === r.category && x.name === name && x.id !== r.id)) throw badRequest('이미 등록된 품목입니다.');
        r.name = name;
      }
      if (req.body.unit !== undefined) r.unit = str(req.body.unit) || r.unit;
      if (req.body.vendor !== undefined) r.vendor = str(req.body.vendor);
      if (req.body.product !== undefined) r.product = str(req.body.product);
      if (req.body.defaultQty !== undefined) r.defaultQty = str(req.body.defaultQty);
      if (req.body.lotPattern !== undefined) r.lotPattern = str(req.body.lotPattern);
      if (req.body.safetyStock !== undefined) {
        const s = num(req.body.safetyStock);
        if (Number.isNaN(s) || s < 0) throw badRequest('안전재고 목표값은 0 이상의 숫자여야 합니다.');
        r.safetyStock = String(s);
      }
      if (req.body.warningPct !== undefined) r.warningPct = str(req.body.warningPct);
      if (req.body.pkgSize !== undefined) r.pkgSize = str(req.body.pkgSize);
      if (req.body.pkgUnit !== undefined) r.pkgUnit = str(req.body.pkgUnit);
      if (req.body.pkgType !== undefined) r.pkgType = str(req.body.pkgType);
      if (req.body.note !== undefined) r.note = str(req.body.note);
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 품목 삭제 (관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('items', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('품목을 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router, CATEGORIES };
