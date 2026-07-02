'use strict';

const { PLANTS } = require('../lib/store');
const { getDisabledPlants } = require('../lib/plantStatus');

/** 총괄관리자(전체 공장) 여부 — 명시적 'all'만 인정(빈 값은 총괄 아님) */
function isSuper(user) {
  return !!user && user.plantScope === 'all';
}

/** 사용자가 접근 가능한 공장 목록 (비활성화된 공장은 제외) */
async function allowedPlants(user) {
  if (user && user.role === 'demo') return ['demo'];
  const disabled = await getDisabledPlants();
  const base = isSuper(user)
    ? PLANTS.filter((p) => p !== 'demo')
    : (() => {
        const scope = (user && (user.plantScope || user.plant)) || '2공장';
        return PLANTS.includes(scope) && scope !== 'demo' ? [scope] : ['2공장'];
      })();
  const filtered = base.filter((p) => !disabled.has(p));
  // 모든 공장이 비활성화된 예외 상황엔 빈 배열 대신 원래 목록을 반환(로그인 자체가 막히지 않도록)
  return filtered.length ? filtered : base;
}

/**
 * 요청의 공장 컨텍스트를 결정한다.
 * - X-Plant 헤더 또는 ?plant= 쿼리, 없으면 사용자의 기본 공장
 * - 사용자의 접근 범위(plantScope)를 벗어나거나 비활성화된 공장이면 403
 * - 데모 계정은 항상 'demo' 더미 데이터 사용
 */
async function resolvePlant(req, res, next) {
  try {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    if (user.role === 'demo') { req.plant = 'demo'; return next(); }
    const allowed = await allowedPlants(user);
    // HTTP 헤더는 ASCII만 허용하므로 한글 공장명은 URL 인코딩되어 들어온다.
    // 명시적 쿼리(?plant=)가 헤더보다 우선 — 특정 공장 설정 저장/조회 시 사용.
    let plant = String(req.query.plant || req.get('x-plant') || '').trim();
    try {
      plant = decodeURIComponent(plant);
    } catch {
      /* 인코딩 안 된 값은 그대로 사용 */
    }
    if (!plant) plant = user.plant && allowed.includes(user.plant) ? user.plant : allowed[0];
    if (!PLANTS.includes(plant)) return res.status(400).json({ error: '잘못된 공장입니다.' });
    if (!allowed.includes(plant)) {
      const disabled = await getDisabledPlants();
      if (disabled.has(plant)) return res.status(403).json({ error: `[${plant}] 비활성화된 공장입니다. 관리자에게 문의하세요.` });
      return res.status(403).json({ error: '접근 권한이 없는 공장입니다.' });
    }
    req.plant = plant;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { resolvePlant, allowedPlants, isSuper };
