'use strict';

const express = require('express');
const { mutate, readTable } = require('../lib/store');
const { asyncHandler, str, num, badRequest } = require('../lib/http');
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
    await mutate('settings', req.plant, (rows) => {
      if (req.body.safetyRatioPercent !== undefined) {
        const p = num(req.body.safetyRatioPercent);
        if (Number.isNaN(p) || p < 0 || p > 1000) throw badRequest('안전재고 비율(%)은 0~1000 사이여야 합니다.');
        setKey(rows, 'safetyRatioPercent', p);
      }
      for (const k of STRING_KEYS) {
        if (req.body[k] !== undefined) setKey(rows, k, str(req.body[k]));
      }
    });
    res.json({ settings: await readSettings(req.plant) });
  }),
);

module.exports = { router, readSettings };
