'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

function walkCsv(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'backups') continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walkCsv(fp, base, out);
    else if (e.name.endsWith('.csv')) out.push(path.relative(base, fp));
  }
}

/**
 * 데이터(CSV)를 공장 하위 폴더까지 포함해 타임스탬프 폴더로 복사한다(원본 불변).
 */
function backupData(keep = 20) {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = [];
  walkCsv(DATA_DIR, DATA_DIR, files);
  if (!files.length) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const root = path.join(DATA_DIR, '..', 'backups');
  const dest = path.join(root, `data-${stamp}`);
  for (const rel of files) {
    const d = path.join(dest, rel);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(path.join(DATA_DIR, rel), d);
  }

  try {
    const all = fs.readdirSync(root).filter((d) => d.startsWith('data-')).sort();
    while (all.length > keep) {
      const old = all.shift();
      fs.rmSync(path.join(root, old), { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
  return dest;
}

module.exports = { backupData };
