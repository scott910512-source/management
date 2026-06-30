'use strict';

const fs = require('fs');
const path = require('path');
const { parseCsv, stringifyCsv } = require('./csv');
const { DATA_DIR } = require('../config');

// 공장 목록(멀티 사이트). 데이터는 공장별 하위 폴더로 분리 저장된다.
const PLANTS = ['1공장', '2공장', 'demo'];

// 각 테이블(CSV 파일)의 컬럼 정의.
const TABLES = {
  // users는 전역(공장 공통). plant=기본 공장, plantScope=접근 가능 범위(all|특정공장)
  users: ['id', 'passwordHash', 'name', 'role', 'status', 'plant', 'plantScope', 'createdAt', 'approvedAt', 'approvedBy'],
  items: ['id', 'category', 'name', 'unit', 'safetyStock', 'warningPct', 'vendor', 'product', 'defaultQty', 'lotPattern', 'pkgType', 'pkgSize', 'pkgUnit', 'hazardous', 'itemGroup', 'groupDefault', 'hazardousMaxQty', 'hazardousWarnPct', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  raw_materials: ['id', 'itemName', 'lotNo', 'quantity', 'unit', 'pkgCount', 'vendor', 'receivedDate', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  sub_materials: ['id', 'name', 'receivedDate', 'lotNo', 'vendor', 'unit', 'pkgCount', 'initialWeight', 'weight', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  canisters: ['id', 'canisterNo', 'size', 'sizeEtc', 'location', 'locationEtc', 'status', 'statusEtc', 'content', 'weight', 'unit', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  canister_history: ['id', 'canisterId', 'canisterNo', 'date', 'type', 'content', 'weight', 'location', 'status', 'note', 'createdBy', 'createdAt'],
  transactions: ['id', 'materialType', 'materialId', 'materialName', 'lotNo', 'content', 'type', 'quantity', 'unit', 'balanceAfter', 'batchNo', 'batchId', 'note', 'createdBy', 'createdAt'],
  // 합성 Batch — 제품(사용처)+연도+번호로 식별, 합성시작일 공유
  batches: ['id', 'product', 'year', 'no', 'startDate', 'createdBy', 'createdAt'],
  settings: ['key', 'value'],
  anomalies: ['id', 'type', 'itemName', 'lotInfo', 'account', 'note', 'createdAt'],
  tasks: ['id', 'title', 'category', 'categoryEtc', 'priority', 'assignee', 'dueDate', 'status', 'note', 'recurringId', 'period', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  // 정기(반복) 업무 템플릿 — 주기(일/주/월)마다 Task 자동 생성
  recurring_tasks: ['id', 'title', 'category', 'categoryEtc', 'priority', 'assignee', 'note', 'cycle', 'weekday', 'monthday', 'active', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  // 유해화학물질 일자별 관리대장 수동 입력/정정 (수불 자동집계를 덮어쓰는 임시입력)
  hazardous_ledger: ['id', 'itemName', 'date', 'carryOver', 'inQty', 'outQty', 'balance', 'note', 'updatedBy', 'updatedAt'],
  warning_acks: ['id', 'warningKey', 'account', 'content', 'createdAt'],
  warning_dismissed: ['id', 'warningKey', 'account', 'content', 'createdAt'],
  settings_log: ['id', 'key', 'oldValue', 'newValue', 'changedBy', 'createdAt'],
  // 건의사항 게시판 — 작성자 수정/삭제, 관리자 완료처리
  suggestions: ['id', 'title', 'category', 'categoryEtc', 'content', 'status', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'completedBy', 'completedAt'],
  // 제품(사용처) 마스터
  products: ['id', 'name', 'note', 'createdBy', 'createdAt'],
  // 제품별 BOM — Batch당 원·부재료 사용 기준량
  boms: ['id', 'product', 'category', 'materialName', 'qtyPerBatch', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'],
  // Lot 변경이력 — 수정/삭제 시 자동 기록
  raw_materials_changelog: ['id', 'lotId', 'itemName', 'lotNo', 'action', 'summary', 'changedBy', 'changedAt'],
  sub_materials_changelog: ['id', 'lotId', 'itemName', 'lotNo', 'action', 'summary', 'changedBy', 'changedAt'],
  // 로그인 이력 — 전역(공장 공통), 관리자 조회 가능
  login_logs: ['id', 'userId', 'userName', 'ip', 'result', 'note', 'createdAt'],
};

// 전역(공장 공통) 테이블 — 공장 하위 폴더가 아닌 DATA_DIR 루트에 저장
const GLOBAL = new Set(['users', 'login_logs']);

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
