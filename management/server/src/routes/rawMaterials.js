'use strict';

const express = require('express');
const { mutate, readTable, headersOf } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound, sendCsv } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { appendTransaction } = require('../lib/tx');
const { appendAnomaly, findEarlierLot } = require('../lib/anomaly');
const { requireAuth, requireAdmin, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { readSettings } = require('./settings');

const router = express.Router();
const UNITS = ['kg', 'ea', 'L', '기타'];

router.use(requireAuth, resolvePlant);

function filterRows(rows, query) {
  const q = str(query.q).toLowerCase();
  const item = str(query.item);
  const includeAll = str(query.all) === '1'; // 완료(잔량 0) Lot 포함 여부
  return rows.filter((r) => {
    if (!includeAll && (num(r.quantity) || 0) <= 0) return false; // 수불 완료 Lot 숨김
    if (q && !`${r.itemName} ${r.lotNo}`.toLowerCase().includes(q)) return false;
    if (item && r.itemName !== item) return false;
    return true;
  });
}

// Lot별 수불 이력
router.get(
  '/:id/transactions',
  asyncHandler(async (req, res) => {
    const [lots, txns] = await Promise.all([readTable('raw_materials', req.plant), readTable('transactions', req.plant)]);
    const lot = lots.find((x) => x.id === req.params.id);
    if (!lot) throw notFound('원재료 Lot을 찾을 수 없습니다.');
    const items = txns.filter((t) => t.materialId === req.params.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items, lot });
  }),
);

// Lot 목록
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await readTable('raw_materials', req.plant);
    const sorted = filterRows(rows, req.query).sort((a, b) =>
      a.itemName === b.itemName ? (a.receivedDate < b.receivedDate ? 1 : -1) : a.itemName.localeCompare(b.itemName),
    );
    res.json({ items: sorted });
  }),
);

// 품목별 현황 요약(상단): 총수량/재고수준%/최근입고/최근사용
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const [rows, items, txns, settings] = await Promise.all([
      readTable('raw_materials', req.plant),
      readTable('items', req.plant),
      readTable('transactions', req.plant),
      readSettings(req.plant),
    ]);
    const globalThreshold = num(settings.safetyRatioPercent) || 100;
    const masters = items.filter((i) => i.category === 'raw');

    // 품목명 기준 집계 (마스터에 없는 '기타' 품목도 포함)
    const names = new Set([...masters.map((m) => m.name), ...rows.map((r) => r.itemName)]);
    const summary = Array.from(names).map((name) => {
      const lots = rows.filter((r) => r.itemName === name);
      const master = masters.find((m) => m.name === name);
      const unit = master ? master.unit : (lots[0] && lots[0].unit) || '';
      const total = lots.reduce((s, r) => s + (num(r.quantity) || 0), 0);
      const safety = master ? num(master.safetyStock) || 0 : 0;
      const level = safety > 0 ? Math.round((total / safety) * 100) : null;
      const threshold = (master && master.warningPct) ? num(master.warningPct) : globalThreshold;
      const below = safety > 0 && total < safety * (threshold / 100);
      const warningPct = master ? (master.warningPct || '') : '';
      const lastReceived = lots.reduce((d, r) => (r.receivedDate > d ? r.receivedDate : d), '');
      const activeLots = lots.filter((r) => (num(r.quantity) || 0) > 0);
      const oldestLot = activeLots.reduce((pick, r) => (!pick || r.receivedDate < pick.receivedDate ? r : pick), null);
      const totalPkgCount = lots.reduce((s, r) => s + (num(r.pkgCount) || 0), 0);
      const used = txns.filter((t) => t.materialType === 'raw' && t.materialName === name && t.type === '출고');
      const lastUsed = used.reduce((d, t) => (t.createdAt > d ? t.createdAt : d), '');
      return { name, product: master ? master.product || '' : '', unit, totalQuantity: total, safetyStock: safety, level, below, warningPct, lots: lots.length, lastReceived, lastUsed: lastUsed ? lastUsed.slice(0, 10) : '', isMaster: !!master, oldestLotNo: oldestLot ? oldestLot.lotNo : '', oldestDate: oldestLot ? oldestLot.receivedDate : '', totalPkgCount };
    });
    summary.sort((a, b) => {
      const pa = a.product || '~';
      const pb = b.product || '~';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ items: summary });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await readTable('raw_materials', req.plant);
    sendCsv(res, headersOf('raw_materials'), filterRows(rows, req.query), '원재료Lot목록');
  }),
);

// Lot 등록
router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const itemName = str(req.body.itemName);
    const unit = str(req.body.unit);
    const lotNo = str(req.body.lotNo);
    const receivedDate = str(req.body.receivedDate);
    const pkgCount = req.body.pkgCount !== undefined && req.body.pkgCount !== '' ? num(req.body.pkgCount) : null;
    const pkgSize = req.body.pkgSize !== undefined && req.body.pkgSize !== '' ? num(req.body.pkgSize) : null;
    // Package 수량이 있으면 자동 계산, 없으면 직접 입력값 사용
    const rawQty = (pkgCount !== null && pkgSize !== null) ? pkgCount * pkgSize : num(req.body.quantity);
    const quantity = rawQty;
    // 필수값 검증
    if (!itemName) throw badRequest('품목을 선택하거나 입력하세요.');
    if (!lotNo) throw badRequest('Lot No는 필수 입력입니다.');
    if (Number.isNaN(quantity) || quantity <= 0) throw badRequest('수량은 필수이며 0보다 큰 숫자여야 합니다.');
    if (!unit) throw badRequest('단위는 필수 입력입니다.');
    if (!receivedDate) throw badRequest('입고일은 필수 입력입니다.');

    const me = req.session.user.id;
    const item = await mutate('raw_materials', req.plant, (rows) => {
      if (rows.some((r) => r.itemName === itemName && r.lotNo === lotNo)) throw badRequest('동일 품목/Lot No가 이미 존재합니다.');
      const row = {
        id: newId('rm'), itemName, lotNo, quantity: String(quantity), unit,
        pkgCount: pkgCount !== null ? String(pkgCount) : '',
        vendor: str(req.body.vendor), receivedDate: str(req.body.receivedDate), note: str(req.body.note),
        createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    if (quantity > 0) {
      await appendTransaction({
        plant: req.plant, materialType: 'raw', materialId: item.id, materialName: item.itemName, lotNo,
        type: '입고', quantity, unit, balanceAfter: quantity, note: '신규 입고', user: me,
      });
    }
    res.status(201).json({ item });
  }),
);

// Lot 수정
router.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const item = await mutate('raw_materials', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('원재료 Lot을 찾을 수 없습니다.');
      for (const f of ['itemName', 'lotNo', 'unit', 'vendor', 'receivedDate', 'note']) {
        if (req.body[f] !== undefined) r[f] = str(req.body[f]);
      }
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 수불(입고/출고) — Lot 단위 개별 처리
router.post(
  '/:id/transaction',
  requireWrite,
  asyncHandler(async (req, res) => {
    const type = str(req.body.type);
    const qty = num(req.body.quantity);
    const note = str(req.body.note);
    const force = req.body.force === true || str(req.body.force) === '1';
    const txDate = str(req.body.txDate) || null;
    if (!['입고', '출고'].includes(type)) throw badRequest('수불 구분은 입고 또는 출고여야 합니다.');
    if (Number.isNaN(qty) || qty <= 0) throw badRequest('수량은 0보다 큰 숫자여야 합니다.');

    const me = req.session.user.id;

    // 선입선출 검사(출고 시): 더 빠른 입고 Lot이 있으면 경고
    let violation = null;
    if (type === '출고') {
      const all = await readTable('raw_materials', req.plant);
      const target = all.find((x) => x.id === req.params.id);
      if (!target) throw notFound('원재료 Lot을 찾을 수 없습니다.');
      violation = findEarlierLot(all, target, 'itemName');
      if (violation && !force) {
        return res.status(409).json({
          fifoWarning: true,
          message: '선입선출 오류가 발생합니다. 입고일이 더 빠른 Lot이 존재합니다.',
          earliest: { lotNo: violation.lotNo, receivedDate: violation.receivedDate },
        });
      }
    }

    const item = await mutate('raw_materials', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('원재료 Lot을 찾을 수 없습니다.');
      const cur = num(r.quantity) || 0;
      const next = type === '입고' ? cur + qty : cur - qty;
      if (next < 0) throw badRequest(`출고 수량이 현재 재고(${cur}${r.unit})를 초과합니다.`);
      r.quantity = String(next);
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    const txn = await appendTransaction({
      plant: req.plant, materialType: 'raw', materialId: item.id, materialName: item.itemName, lotNo: item.lotNo,
      type, quantity: qty, unit: item.unit, balanceAfter: item.quantity, note, user: me, txDate,
    });
    if (violation && force && type === '출고') {
      await appendAnomaly({
        plant: req.plant, type: '선입선출 오류', itemName: item.itemName,
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
    await mutate('raw_materials', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('원재료 Lot을 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router, UNITS };
