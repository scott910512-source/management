'use strict';

// 공장 활성/비활성 관리 — StockPilot·ManagePilot 등 전체 모듈에 공통 적용.
// 총괄관리자(plantScope=all)만 상태를 변경할 수 있다.
const express = require('express');
const { PLANTS } = require('../lib/store');
const { getDisabledPlants, setPlantEnabled } = require('../lib/plantStatus');
const { asyncHandler, badRequest } = require('../lib/http');
const { requireAdmin } = require('../middleware/auth');
const { isSuper } = require('../middleware/plant');

const router = express.Router();
const MANAGED = PLANTS.filter((p) => p !== 'demo'); // ['1공장', '2공장']

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const disabled = await getDisabledPlants();
    res.json({ items: MANAGED.map((p) => ({ plant: p, enabled: !disabled.has(p) })) });
  }),
);

router.patch(
  '/:plant',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isSuper(req.session.user)) throw badRequest('총괄관리자만 공장 상태를 변경할 수 있습니다.');
    const plant = decodeURIComponent(req.params.plant);
    if (!MANAGED.includes(plant)) throw badRequest('잘못된 공장입니다.');
    const enabled = !!req.body.enabled;
    await setPlantEnabled(plant, enabled, req.session.user.id);
    const disabled = await getDisabledPlants();
    res.json({ items: MANAGED.map((p) => ({ plant: p, enabled: !disabled.has(p) })) });
  }),
);

module.exports = router;
