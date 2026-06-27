'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { asyncHandler } = require('../lib/http');
const { UNITS } = require('./rawMaterials');
const { MOVE_TYPES } = require('./canisters');
const { CATEGORIES, PRIORITIES, STATUSES: TASK_STATUSES } = require('./tasks');
const { readSettings } = require('./settings');

const router = express.Router();

// 프론트엔드 폼에서 사용할 선택지(enum) 제공 — Canister 목록은 settings에서 동적으로
router.get('/', requireAuth, resolvePlant, asyncHandler(async (req, res) => {
  const s = await readSettings(req.plant);
  const toArr = (str) => (str || '').split(',').map(v => v.trim()).filter(Boolean);
  res.json({
    units: UNITS,
    canisterSizes: toArr(s.canisterSizes),
    canisterLocations: toArr(s.canisterLocations),
    canisterStatuses: toArr(s.canisterStatuses),
    canisterContents: toArr(s.canisterContents),
    canisterMoveTypes: MOVE_TYPES,
    taskCategories: CATEGORIES,
    taskPriorities: PRIORITIES,
    taskStatuses: TASK_STATUSES,
  });
}));

module.exports = { router };
