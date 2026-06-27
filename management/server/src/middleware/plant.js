'use strict';

const { PLANTS } = require('../lib/store');

/** 총괄관리자(전체 공장) 여부 — 명시적 'all'만 인정(빈 값은 총괄 아님) */
function isSuper(user) {
  return !!user && user.plantScope === 'all';
}

/** 사용자가 접근 가능한 공장 목록 */
function allowedPlants(user) {
  if (isSuper(user)) return PLANTS.slice();
  const scope = (user && (user.plantScope || user.plant)) || '2공장';
  return PLANTS.includes(scope) ? [scope] : ['2공장'];
}

/**
 * 요청의 공장 컨텍스트를 결정한다.
 * - X-Plant 헤더 또는 ?plant= 쿼리, 없으면 사용자의 기본 공장
 * - 사용자의 접근 범위(plantScope)를 벗어나면 403
 */
function resolvePlant(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const allowed = allowedPlants(user);
  // HTTP 헤더는 ASCII만 허용하므로 한글 공장명은 URL 인코딩되어 들어온다.
  let plant = String(req.get('x-plant') || req.query.plant || '').trim();
  try {
    plant = decodeURIComponent(plant);
  } catch {
    /* 인코딩 안 된 값은 그대로 사용 */
  }
  if (!plant) plant = user.plant && allowed.includes(user.plant) ? user.plant : allowed[0];
  if (!PLANTS.includes(plant)) return res.status(400).json({ error: '잘못된 공장입니다.' });
  if (!allowed.includes(plant)) return res.status(403).json({ error: '접근 권한이 없는 공장입니다.' });
  req.plant = plant;
  next();
}

module.exports = { resolvePlant, allowedPlants, isSuper };
