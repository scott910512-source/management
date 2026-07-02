'use strict';

// 공장 활성/비활성 상태 — 전역(모든 모듈 공통). 비활성 공장은 일반 사용자의
// 접근 목록(allowedPlants)에서 제외되고, resolvePlant에서도 차단된다.
const { readTable, mutate } = require('./store');
const { now } = require('./ids');

async function getDisabledPlants() {
  const rows = await readTable('plant_status', null);
  return new Set(rows.filter((r) => String(r.enabled) === 'false').map((r) => r.plant));
}

async function setPlantEnabled(plant, enabled, adminId) {
  await mutate('plant_status', null, (rows) => {
    const row = rows.find((r) => r.plant === plant);
    if (row) {
      row.enabled = String(!!enabled);
      row.updatedBy = adminId || '';
      row.updatedAt = now();
    } else {
      rows.push({ plant, enabled: String(!!enabled), updatedBy: adminId || '', updatedAt: now() });
    }
  });
}

module.exports = { getDisabledPlants, setPlantEnabled };
