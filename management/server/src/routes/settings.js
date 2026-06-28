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
  canisterDefaultSize: '50L',
  canisterDefaultLocation: '2공장현장',
  canisterDefaultStatus: '수령',
  canisterDefaultContent: '',
  canisterSizes: '5gal,50L,100L,200L',
  canisterLocations: '2공장현장,3류창고,4류창고',
  canisterStatuses: '수령,사용중,사용완료,세정의뢰,사용금지',
  canisterContents: '톨루엔,황산,활성탄,실링패드',
};
const STRING_KEYS = [
  'canisterDefaultSize', 'canisterDefaultLocation', 'canisterDefaultStatus', 'canisterDefaultContent',
  'canisterSizes', 'canisterLocations', 'canisterStatuses', 'canisterContents',
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

module.exports = { router, readSettings };
