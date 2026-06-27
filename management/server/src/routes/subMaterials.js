'use strict';

const express = require('express');
const { mutate, readTable, headersOf } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound, sendCsv } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { appendTransaction } = require('../lib/tx');
const { appendAnomaly, findEarlierLot } = require('../lib/anomaly');
const { requireAuth, requireAdmin, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();

router.use(requireAuth, resolvePlant);

function filterRows(rows, query) {
  const q = str(query.q).toLowerCase();
  const vendor = str(query.vendor).toLowerCase();
  const includeAll = str(query.all) === '1';
  return rows.filter((r) => {
    if (!includeAll && (num(r.weight) || 0) <= 0) return false; // 소진 완료 Lot 숨김
    if (q && !(`${r.name} ${r.lotNo}`.toLowerCase().includes(q))) return false;
    if (vendor && !`${r.vendor}`.toLowerCase().includes(vendor)) return false;
    return true;
  });
}

// 목록 (품목명 → Lot 입고일순)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await readTable('sub_materials', req.plant);
    const sorted = filterRows(rows, req.query).sort((a, b) =>
      a.name === b.name ? (a.receivedDate < b.receivedDate ? 1 : -1) : a.name.localeCompare(b.name),
    );
    res.json({ items: sorted });
  }),
);

// 품목별 내역현황(품목명 기준 집계, Lot은 입고일 오름차순 정렬)
router.get(
  '/by-item',
  asyncHandler(async (req, res) => {
    const rows = await readTable('sub_materials', req.plant);
    const map = new Map();
    for (const r of rows) {
      const key = r.name;
      if (!map.has(key)) map.set(key, { name: key, lots: 0, totalWeight: 0, unit: r.unit, items: [] });
      const g = map.get(key);
      g.lots += 1;
      g.totalWeight += num(r.weight) || 0;
      g.items.push(r);
    }
    const groups = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const g of groups) g.items.sort((a, b) => (a.receivedDate > b.receivedDate ? 1 : -1));
    res.json({ items: groups });
  }),
);

// CSV Export
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await readTable('sub_materials', req.plant);
    sendCsv(res, headersOf('sub_materials'), filterRows(rows, req.query), '부재료목록');
  }),
);

// 등록
router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const name = str(req.body.name);
    const unit = str(req.body.unit);
    const weight = num(req.body.weight);
    const lotNo = str(req.body.lotNo);
    const receivedDate = str(req.body.receivedDate);
    if (!name) throw badRequest('품목을 선택하거나 입력하세요.');
    if (!lotNo) throw badRequest('Lot No는 필수 입력입니다.');
    if (req.body.weight === '' || req.body.weight === undefined || Number.isNaN(weight) || weight <= 0) throw badRequest('무게(수량)는 필수이며 0보다 큰 숫자여야 합니다.');
    if (!unit) throw badRequest('단위는 필수 입력입니다.');
    if (!receivedDate) throw badRequest('입고일은 필수 입력입니다.');

    const me = req.session.user.id;
    const item = await mutate('sub_materials', req.plant, (rows) => {
      if (rows.some((r) => r.lotNo === lotNo && r.name === name)) {
        throw badRequest('동일 품목/Lot No가 이미 존재합니다.');
      }
      const row = {
        id: newId('sm'),
        name,
        receivedDate: str(req.body.receivedDate),
        lotNo,
        vendor: str(req.body.vendor),
        unit,
        initialWeight: String(weight),
        weight: String(weight),
        note: str(req.body.note),
        createdBy: me,
        createdAt: now(),
        updatedBy: me,
        updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    if (weight > 0) {
      await appendTransaction({
        plant: req.plant, materialType: 'sub', materialId: item.id, materialName: item.name, lotNo,
        type: '입고', quantity: weight, unit, balanceAfter: weight, note: '신규 입고', user: me,
      });
    }
    res.status(201).json({ item });
  }),
);

// 수정
router.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const item = await mutate('sub_materials', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('부재료를 찾을 수 없습니다.');
      for (const f of ['name', 'receivedDate', 'lotNo', 'vendor', 'unit', 'note']) {
        if (req.body[f] !== undefined) r[f] = str(req.body[f]);
      }
      if (req.body.weight !== undefined) {
        const w = num(req.body.weight);
        if (Number.isNaN(w) || w < 0) throw badRequest('무게는 0 이상의 숫자여야 합니다.');
        r.weight = String(w);
      }
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 수불(입고/출고=소진) → 무게 증감 + 내역 기록
router.post(
  '/:id/transaction',
  requireWrite,
  asyncHandler(async (req, res) => {
    const type = str(req.body.type);
    const qty = num(req.body.quantity);
    const note = str(req.body.note);
    const force = req.body.force === true || str(req.body.force) === '1';
    if (!['입고', '출고'].includes(type)) throw badRequest('수불 구분은 입고 또는 출고여야 합니다.');
    if (Number.isNaN(qty) || qty <= 0) throw badRequest('수량(무게)은 0보다 큰 숫자여야 합니다.');

    const me = req.session.user.id;

    let violation = null;
    if (type === '출고') {
      const all = await readTable('sub_materials', req.plant);
      const target = all.find((x) => x.id === req.params.id);
      if (!target) throw notFound('부재료를 찾을 수 없습니다.');
      violation = findEarlierLot(all, target, 'name');
      if (violation && !force) {
        return res.status(409).json({
          fifoWarning: true,
          message: '선입선출 오류가 발생합니다. 입고일이 더 빠른 Lot이 존재합니다.',
          earliest: { lotNo: violation.lotNo, receivedDate: violation.receivedDate },
        });
      }
    }

    const item = await mutate('sub_materials', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('부재료를 찾을 수 없습니다.');
      const cur = num(r.weight) || 0;
      const next = type === '입고' ? cur + qty : cur - qty;
      if (next < 0) throw badRequest(`출고(소진) 무게가 현재 잔량(${cur}${r.unit})을 초과합니다.`);
      r.weight = String(next);
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    const txn = await appendTransaction({
      plant: req.plant, materialType: 'sub', materialId: item.id, materialName: item.name, lotNo: item.lotNo,
      type, quantity: qty, unit: item.unit, balanceAfter: item.weight, note, user: me,
    });
    if (violation && force && type === '출고') {
      await appendAnomaly({
        plant: req.plant, type: '선입선출 오류', itemName: item.name,
        lotInfo: `${item.lotNo}(입고 ${item.receivedDate || '-'}) — 더 빠른 Lot ${violation.lotNo}(${violation.receivedDate}) 존재`,
        account: me, note: '강제 사용',
      });
    }
    res.status(201).json({ item, transaction: txn });
  }),
);

// 삭제(관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('sub_materials', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('부재료를 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router };
