'use strict';
const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

router.get('/', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();

  const [items, raws, subs, txns] = await Promise.all([
    readTable('items', req.plant),
    readTable('raw_materials', req.plant),
    readTable('sub_materials', req.plant),
    readTable('transactions', req.plant),
  ]);

  // 유해화학물질 품목 이름 set
  const hazNames = new Set(items.filter((i) => i.hazardous === '1').map((i) => i.name));
  if (hazNames.size === 0) return res.json({ items: [], year, hazardousItems: [] });

  // 유해 Lot ID set (원재료 + 부재료)
  const hazLotIds = new Set([
    ...raws.filter((r) => hazNames.has(r.itemName)).map((r) => r.id),
    ...subs.filter((s) => hazNames.has(s.name)).map((s) => s.id),
  ]);

  // 해당 연도 수불 이력 필터
  const yearStr = String(year);
  const hazTxns = txns.filter((t) => hazLotIds.has(t.materialId) && (t.createdAt || '').startsWith(yearStr));

  // 날짜별 그룹
  const byDate = {};
  for (const t of hazTxns) {
    const date = (t.createdAt || '').slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(t);
  }

  // 연도 전체 날짜 생성 (1/1 ~ 12/31)
  const rows = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayTxns = byDate[dateStr] || [];
    if (dayTxns.length === 0) {
      rows.push({ date: dateStr, empty: true });
    } else {
      for (const t of dayTxns) {
        // 품목명 조회
        const lot = raws.find((r) => r.id === t.materialId) || subs.find((s) => s.id === t.materialId);
        rows.push({
          date: dateStr,
          empty: false,
          materialName: lot ? (lot.itemName || lot.name) : t.materialName || '',
          lotNo: lot ? lot.lotNo : '',
          type: t.type,
          quantity: t.quantity,
          unit: t.unit,
          balanceAfter: t.balanceAfter,
          note: t.note || '',
          createdBy: t.createdBy || '',
        });
      }
    }
  }

  res.json({ items: rows, year, hazardousItems: Array.from(hazNames) });
}));

module.exports = { router };
