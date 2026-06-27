'use strict';

const fs = require('fs');
const path = require('path');
const { parseCsv, stringifyCsv } = require('./csv');
const { DATA_DIR } = require('../config');

// 공장 목록(멀티 사이트). 데이터는 공장별 하위 폴더로 분리 저장된다.
const PLANTS = ['1공장', '2공장'];

// 각 테이블(CSV 파일)의 컬럼 정의.
const TABLES = {
  // users는 전역(공장 공통). plant=기본 공장, plantScope=접근 가능 범위(all|특정공장)
  users: ['id', 'passwordHash', 'name', 'role', 'status', 'plant', 'plantScope', 'createdAt', 'approvedAt', 'approvedBy'],
  items: ['id', 'category', 'name', 'unit', 'safetyStock', 'vendor', 'product', 'defaultQty', 'lotPattern', 'pkgType', 'pkgSize', 'pkgUnit', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  raw_materials: ['id', 'itemName', 'lotNo', 'quantity', 'unit', 'pkgCount', 'vendor', 'receivedDate', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  sub_materials: ['id', 'name', 'receivedDate', 'lotNo', 'vendor', 'unit', 'pkgCount', 'initialWeight', 'weight', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  canisters: ['id', 'canisterNo', 'size', 'sizeEtc', 'location', 'locationEtc', 'status', 'statusEtc', 'content', 'weight', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  canister_history: ['id', 'canisterId', 'canisterNo', 'date', 'type', 'content', 'weight', 'location', 'status', 'note', 'createdBy', 'createdAt'],
  transactions: ['id', 'materialType', 'materialId', 'materialName', 'lotNo', 'content', 'type', 'quantity', 'unit', 'balanceAfter', 'note', 'createdBy', 'createdAt'],
  settings: ['key', 'value'],
  anomalies: ['id', 'type', 'itemName', 'lotInfo', 'account', 'note', 'createdAt'],
  tasks: ['id', 'title', 'category', 'categoryEtc', 'priority', 'assignee', 'dueDate', 'status', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  warning_acks: ['id', 'warningKey', 'account', 'content', 'createdAt'],
  warning_dismissed: ['id', 'warningKey', 'account', 'content', 'createdAt'],
};

// 전역(공장 공통) 테이블 — 공장 하위 폴더가 아닌 DATA_DIR 루트에 저장
const GLOBAL = new Set(['users']);

function headersOf(name) {
  const h = TABLES[name];
  if (!h) throw new Error(`Unknown table: ${name}`);
  return h;
}

function isGlobal(name) {
  return GLOBAL.has(name);
}

function filePath(name, plant) {
  if (isGlobal(name)) return path.join(DATA_DIR, `${name}.csv`);
  if (!plant) throw new Error(`Table '${name}' requires a plant`);
  if (!PLANTS.includes(plant)) throw new Error(`Unknown plant: ${plant}`);
  return path.join(DATA_DIR, plant, `${name}.csv`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureDataDirs() {
  ensureDir(DATA_DIR);
  for (const p of PLANTS) ensureDir(path.join(DATA_DIR, p));
}

// 파일별 비동기 뮤텍스
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((res) => {
    release = res;
  });
  locks.set(key, prev.then(() => gate));
  const run = prev.catch(() => {}).then(() => fn());
  run.then(() => release(), () => release());
  return run;
}

function readSync(name, plant) {
  const fp = filePath(name, plant);
  if (!fs.existsSync(fp)) return [];
  return parseCsv(fs.readFileSync(fp, 'utf8'));
}

function writeSync(name, plant, rows) {
  const fp = filePath(name, plant);
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, stringifyCsv(headersOf(name), rows), 'utf8');
}

function readTable(name, plant) {
  return withLock(filePath(name, plant), () => readSync(name, plant));
}
function writeTable(name, plant, rows) {
  return withLock(filePath(name, plant), () => {
    writeSync(name, plant, rows);
    return rows;
  });
}
function mutate(name, plant, fn) {
  return withLock(filePath(name, plant), () => {
    const rows = readSync(name, plant);
    const result = fn(rows);
    writeSync(name, plant, rows);
    return result === undefined ? rows : result;
  });
}

module.exports = {
  PLANTS,
  TABLES,
  headersOf,
  isGlobal,
  filePath,
  ensureDataDirs,
  readTable,
  writeTable,
  mutate,
  _readSync: readSync,
  _writeSync: writeSync,
};
