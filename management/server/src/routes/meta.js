'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { UNITS } = require('./rawMaterials');
const { SIZES, LOCATIONS, STATUSES, MOVE_TYPES } = require('./canisters');
const { CATEGORIES, PRIORITIES, STATUSES: TASK_STATUSES } = require('./tasks');

const router = express.Router();

// 프론트엔드 폼에서 사용할 선택지(enum) 제공
router.get('/', requireAuth, (req, res) => {
  res.json({
    units: UNITS,
    canisterSizes: SIZES,
    canisterLocations: LOCATIONS,
    canisterStatuses: STATUSES,
    canisterMoveTypes: MOVE_TYPES,
    taskCategories: CATEGORIES,
    taskPriorities: PRIORITIES,
    taskStatuses: TASK_STATUSES,
  });
});

module.exports = { router };
