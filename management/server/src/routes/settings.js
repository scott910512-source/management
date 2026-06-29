'use strict';

const express = require('express');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, num, badRequest } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();

const DEFAULTS = {
  safetyRatioPercent: '100',
  warningRollSeconds: '4', // 상단 경고 자동 롤 간격(초)
  canisterDefaultSize: '50L',
  canisterDefaultLocation: '2공장현장',
  canisterDefaultStatus: '수령',
  canisterDefaultContent: '',
  canisterSizes: '5gal,50L,100L,200L',
  canisterLocations: '2공장현장,3류창고,4류창고',
  canisterStatuses: '수령,사용중,사용완료,세정의뢰,사용금지',
  canisterContents: '톨루엔,황산,활성탄,실링패드',
  // 사이즈별 최대 사용가능 무게(kg). "size:kg" 쉼표 구분. 90% 이상이면 경고.
  canisterSizeMaxKg: '5gal:20,50L:50,100L:100,200L:200',
};
const STRING_KEYS = [
  'canisterDefaultSize', 'canisterDefaultLocation', 'canisterDefaultStatus', 'canisterDefaultContent',
  'canisterSizes', 'canisterLocations', 'canisterStatuses', 'canisterContents', 'canisterSizeMaxKg',
];

async function readSettings(plant) {
  const rows = await readTable('settings', plant);
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function setKey(rows, key, value) {
  const row = rows.find((r) => r.key === key);
  if (row) row.value = String(value);
  else rows.push({ key, value: String(value) });
}

router.get(
  '/',
  requireAuth,
  resolvePlant,
  asyncHandler(async (req, res) => {
    res.json({ settings: await readSettings(req.plant) });
  }),
);

router.patch(
  '/',
  requireAdmin,
  resolvePlant,
  asyncHandler(async (req, res) => {
    const before = await readSettings(req.plant);
    const changed = [];
    await mutate('settings', req.plant, (rows) => {
      if (req.body.safetyRatioPercent !== undefined) {
        const p = num(req.body.safetyRatioPercent);
        if (Number.isNaN(p) || p < 0 || p > 1000) throw badRequest('안전재고 비율(%)은 0~1000 사이여야 합니다.');
        if (String(p) !== String(before.safetyRatioPercent)) changed.push({ key: 'safetyRatioPercent', old: before.safetyRatioPercent, nv: String(p) });
        setKey(rows, 'safetyRatioPercent', p);
      }
      if (req.body.warningRollSeconds !== undefined) {
        const s = num(req.body.warningRollSeconds);
        if (Number.isNaN(s) || s < 1 || s > 60) throw badRequest('경고 롤 간격(초)은 1~60 사이여야 합니다.');
        if (String(s) !== String(before.warningRollSeconds)) changed.push({ key: 'warningRollSeconds', old: before.warningRollSeconds, nv: String(s) });
        setKey(rows, 'warningRollSeconds', s);
      }
      for (const k of STRING_KEYS) {
        if (req.body[k] !== undefined) {
          const nv = str(req.body[k]);
          if (nv !== String(before[k] || '')) changed.push({ key: k, old: before[k] || '', nv });
          setKey(rows, k, nv);
        }
      }
    });
    if (changed.length > 0) {
      const me = req.session.user.id;
      await mutate('settings_log', req.plant, (rows) => {
        for (const c of changed) rows.push({ id: newId('sl'), key: c.key, oldValue: c.old, newValue: c.nv, changedBy: me, createdAt: now() });
      });
    }
    res.json({ settings: await readSettings(req.plant) });
  }),
);

router.get(
  '/log',
  requireAdmin,
  resolvePlant,
  asyncHandler(async (req, res) => {
    const rows = await readTable('settings_log', req.plant);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items: rows });
  }),
);

// 재고 정합성 검증: 현재고 vs 수불 이력 합산 비교
router.get(
  '/stock-check',
  requireAdmin,
  resolvePlant,
  asyncHandler(async (req, res) => {
    const [raws, subs, txns] = await Promise.all([
      readTable('raw_materials', req.plant),
      readTable('sub_materials', req.plant),
      readTable('transactions', req.plant),
    ]);

    // materialId별 수불 합산
    const txMap = {};
    for (const t of txns) {
      if (!txMap[t.materialId]) txMap[t.materialId] = 0;
      const q = Number(t.quantity) || 0;
      if (['입고', '반입'].includes(t.type)) txMap[t.materialId] += q;
      else txMap[t.materialId] -= q;
    }

    const items = [];
    for (const lot of raws) {
      const current = Number(lot.quantity) || 0;
      const txCount = txns.filter((t) => t.materialId === lot.id).length;
      if (txCount === 0) continue; // 이력 없으면 비교 불가 — 초기등록 정상
      const calculated = txMap[lot.id] || 0;
      const diff = current - calculated;
      if (Math.abs(diff) > 0.001) {
        items.push({ type: '원재료', name: lot.itemName, lotNo: lot.lotNo, current, calculated: Math.round(calculated * 1000) / 1000, diff: Math.round(diff * 1000) / 1000, unit: lot.unit, txCount });
      }
    }
    for (const lot of subs) {
      const current = Number(lot.weight) || 0;
      const txCount = txns.filter((t) => t.materialId === lot.id).length;
      if (txCount === 0) continue;
      const calculated = txMap[lot.id] || 0;
      const diff = current - calculated;
      if (Math.abs(diff) > 0.001) {
        items.push({ type: '부재료', name: lot.name, lotNo: lot.lotNo, current, calculated: Math.round(calculated * 1000) / 1000, diff: Math.round(diff * 1000) / 1000, unit: lot.unit, txCount });
      }
    }

    res.json({ items, checkedAt: now() });
  }),
);

module.exports = { router, readSettings };
