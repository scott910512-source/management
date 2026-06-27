'use strict';

/** 로그인 필요. 세션에 사용자가 없으면 401. */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: '로그인이 필요합니다.' });
}

/** 관리자 권한 필요. */
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

/** 쓰기 권한 필요 — viewer(읽기전용) 역할은 차단. */
function requireWrite(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (user.role === 'viewer') return res.status(403).json({ error: '읽기 전용 계정은 데이터를 변경할 수 없습니다.' });
  return next();
}

module.exports = { requireAuth, requireAdmin, requireWrite };
