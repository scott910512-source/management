'use strict';
const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 유해화학물질 관리대장 — 품목별 연간(1/1~12/31) 일자별 수불 이력
router.get('/', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const [items, raws, subs, txns] = await Promise.all([
    readTable('items', req.plant),
    readTable('raw_materials', req.plant),
    readTable('sub_materials', req.plant),
    readTable('transactions', req.plant),
  ]);

  const hazNames = items.filter((i) => i.hazardous === '1').map((i) => i.name);
  if (hazNames.length === 0) return res.json({ year, hazardousItems: [], byItem: {} });

  // lotId → 품목명 / Lot 정보
  const lotName = new Map();
  const lotInfo = new Map();
  for (const r of raws) { lotName.set(r.id, r.itemName); lotInfo.set(r.id, r); }
  for (const s of subs) { lotName.set(s.id, s.name); lotInfo.set(s.id, s); }

  const hazSet = new Set(hazNames);
  const yearStr = String(year);

  // 품목별 해당 연도 수불 모음
  const byItemTx = {};
  for (const t of txns) {
    const name = lotName.get(t.materialId);
    if (!name || !hazSet.has(name)) continue;
    if (!(t.createdAt || '').startsWith(yearStr)) continue;
    (byItemTx[name] = byItemTx[name] || []).push(t);
  }

  // 품목별 전체 연도 일자 행 생성(이력 없는 날도 빈 행)
  const byItem = {};
  for (const name of hazNames) {
    const txs = byItemTx[name] || [];
    const byDate = {};
    for (const t of txs) {
      const d = (t.createdAt || '').slice(0, 10);
      (byDate[d] = byDate[d] || []).push(t);
    }
    const rows = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const day = byDate[dateStr] || [];
      if (day.length === 0) {
        rows.push({ date: dateStr, empty: true });
      } else {
        for (const t of day) {
          const lot = lotInfo.get(t.materialId);
          rows.push({
            date: dateStr, empty: false, materialName: name,
            lotNo: lot ? lot.lotNo : '', type: t.type, quantity: t.quantity, unit: t.unit,
            balanceAfter: t.balanceAfter, note: t.note || '', createdBy: t.createdBy || '',
          });
        }
      }
    }
    byItem[name] = rows;
  }

  res.json({ year, hazardousItems: hazNames, byItem });
}));

module.exports = { router };
