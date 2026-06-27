'use strict';

const crypto = require('crypto');

/** 충돌 가능성이 매우 낮은 짧은 고유 ID를 생성한다. */
function newId(prefix = '') {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return prefix ? `${prefix}_${id}` : id;
}

/** ISO 8601 타임스탬프(서버 기준). */
function now() {
  return new Date().toISOString();
}

module.exports = { newId, now };
