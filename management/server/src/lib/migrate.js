'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DATA_DIR } = require('../config');
const { TABLES, isGlobal, filePath, ensureDataDirs, _readSync, _writeSync } = require('./store');

/**
 * v3.x(단일 공장) → v4(멀티 공장) 데이터 마이그레이션.
 * - 루트의 기존 공장 데이터를 '2공장' 폴더로 이동(기존 데이터 보존)
 * - users에 plant/plantScope 컬럼 보강 + 1공장 부관리자(admin1) 보장
 * 모두 비파괴적(이동/컬럼 추가)이며, 신규 설치에서는 아무 동작도 하지 않는다.
 */
function migrate() {
  ensureDataDirs();
  const moved = [];

  // 1) 루트의 구 공장 데이터 → 2공장 폴더로 이동
  for (const name of Object.keys(TABLES)) {
    if (isGlobal(name)) continue;
    const rootFile = path.join(DATA_DIR, `${name}.csv`);
    const dest = filePath(name, '2공장');
    if (fs.existsSync(rootFile) && !fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(rootFile, dest);
      moved.push(name);
    }
  }

  // 2) users 컬럼 보강 + admin1 보장
  if (fs.existsSync(filePath('users'))) {
    const rows = _readSync('users');
    let changed = false;
    for (const u of rows) {
      if (!u.plant) { u.plant = '2공장'; changed = true; }
      if (!u.plantScope) { u.plantScope = u.role === 'admin' ? 'all' : (u.plant || '2공장'); changed = true; }
    }
    const ts = new Date().toISOString();
    const ensure = [
      { id: 'admin1', name: '1공장 관리자', role: 'admin', plant: '1공장', plantScope: '1공장', pw: 'admin1234' },
      { id: 'admin2', name: '2공장 관리자', role: 'admin', plant: '2공장', plantScope: '2공장', pw: 'admin1234' },
      { id: 'team1', name: '팀관리자(팀장)', role: 'viewer', plant: '2공장', plantScope: 'all', pw: 'team1234' },
    ];
    for (const u of ensure) {
      if (!rows.some((r) => r.id === u.id)) {
        rows.push({ id: u.id, passwordHash: bcrypt.hashSync(u.pw, 10), name: u.name, role: u.role, status: 'approved', plant: u.plant, plantScope: u.plantScope, createdAt: ts, approvedAt: ts, approvedBy: 'system' });
        changed = true;
      }
    }
    if (changed) _writeSync('users', null, rows);
  }

  return moved;
}

module.exports = { migrate };
