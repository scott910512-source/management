'use strict';

const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler, str, num, sendCsv } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { nextBatchNo, lookupBatch, yearOf } = require('../lib/batch');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 출고 폼 컨텍스트 — 품목의 다음 Batch 번호 + 제품(사용처) 기본값
router.get(
  '/context',
  asyncHandler(async (req, res) => {
    const materialName = str(req.query.materialName);
    const category = str(req.query.category); // raw | sub
    const year = yearOf(str(req.query.date) || null);
    const next = materialName ? await nextBatchNo(req.plant, materialName, year) : 1;
    let product = '';
    if (materialName) {
      const items = await readTable('items', req.plant);
      const master = items.find((i) => i.category === category && i.name === materialName);
      product = master ? master.product || '' : '';
    }
    res.json({ nextNo: next, product, year });
  }),
);

// (제품, 번호) 배치 조회 — 존재 시 합성시작일 반환
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const product = str(req.query.product);
    const no = str(req.query.no);
    const year = yearOf(str(req.query.date) || null);
    if (!no) return res.json({ exists: false, startDate: '' });
    const batch = await lookupBatch(req.plant, product, no, year);
    res.json({ exists: !!batch, startDate: batch ? batch.startDate : '', year });
  }),
);

/**
 * 투입이력 — Batch별로 실제 투입된 원·부재료를 동적으로 나열.
 * 각 배치: { batchNo, product, year, startDate, materials: [{category, name, quantity, unit, lotNo}] }
 */
async function buildInputs(plant) {
  const [txns, batches] = await Promise.all([readTable('transactions', plant), readTable('batches', plant)]);
  const batchById = new Map(batches.map((b) => [b.id, b]));

  // batchId 기준 그룹
  const groups = new Map();
  for (const t of txns) {
    if (t.type !== '출고' || !t.batchId) continue;
    const b = batchById.get(t.batchId);
    if (!b) continue;
    if (!groups.has(t.batchId)) {
      groups.set(t.batchId, {
        batchId: t.batchId,
        batchNo: b.no,
        product: b.product || '',
        year: b.year,
        startDate: b.startDate || '',
        materials: new Map(), // key: name|lotNo
      });
    }
    const g = groups.get(t.batchId);
    const key = `${t.materialType}|${t.materialName}|${t.lotNo}`;
    if (!g.materials.has(key)) {
      g.materials.set(key, { category: t.materialType, name: t.materialName, lotNo: t.lotNo, unit: t.unit, quantity: 0 });
    }
    g.materials.get(key).quantity += num(t.quantity) || 0;
  }

  const list = Array.from(groups.values()).map((g) => ({
    batchId: g.batchId,
    batchNo: g.batchNo,
    product: g.product,
    year: g.year,
    startDate: g.startDate,
    materials: Array.from(g.materials.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category < b.category ? -1 : 1,
    ),
  }));
  // 최신 배치 우선(연도 desc, 번호 desc)
  list.sort((a, b) => {
    if (a.year !== b.year) return a.year < b.year ? 1 : -1;
    return Number(b.batchNo) - Number(a.batchNo);
  });
  return list;
}

router.get(
  '/inputs',
  asyncHandler(async (req, res) => {
    const items = await buildInputs(req.plant);
    res.json({ items });
  }),
);

// CSV — 배치×품목 1행으로 평면화(동적: 품목 수 제한 없음)
router.get(
  '/inputs/export',
  asyncHandler(async (req, res) => {
    const list = await buildInputs(req.plant);
    const headers = ['BatchNo', '제품', '합성시작일', '구분', '품목', '투입량', '단위', '투입Lot'];
    const rows = [];
    for (const g of list) {
      if (g.materials.length === 0) continue;
      for (const m of g.materials) {
        rows.push({
          BatchNo: `#${g.batchNo}`,
          제품: g.product,
          합성시작일: g.startDate,
          구분: m.category === 'raw' ? '원재료' : m.category === 'sub' ? '부재료' : m.category,
          품목: m.name,
          투입량: m.quantity,
          단위: m.unit,
          투입Lot: m.lotNo,
        });
      }
    }
    sendCsv(res, headers, rows, '원부재료투입이력');
  }),
);

module.exports = { router };
