'use strict';

/**
 * 통합 테스트: 관리자/1공장관리자/2공장관리자/사용자 기준
 * - 공장당 품목 10개 (원재료/부재료/Canister)
 * - 일 10회 수불 시뮬레이션
 * - 동시 사용자 10명
 */

const http = require('http');
const assert = require('assert');
const { createApp } = require('../src/app');
const { ensureSeed } = require('../src/lib/seed');
const { mutate, writeTable, readTable } = require('../src/lib/store');
const { newId } = require('../src/lib/ids');
const bcrypt = require('bcryptjs');

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

let baseUrl;
let server;

async function startServer() {
  ensureSeed({ force: true });
  await seedFullData();
  const app = createApp();
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

function stopServer() {
  return new Promise((res) => server.close(res));
}

function req(method, path, body, cookieStr) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function login(id, pw) {
  const res = await req('POST', '/api/auth/login', { id, password: pw });
  if (res.status !== 200) throw new Error(`로그인 실패 [${id}]: ${res.status} ${JSON.stringify(res.body)}`);
  const setCookie = res.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
  return { cookie, user: res.body.user };
}

function plantHeader(plant) {
  return plant ? `X-Plant: ${plant}` : '';
}

function reqWithPlant(method, path, body, cookieStr, plant) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
        ...(plant ? { 'X-Plant': encodeURIComponent(plant) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

// ─── 풍부한 샘플 데이터 시드 ────────────────────────────────────────────────

const T = '2026-06-01T00:00:00.000Z';
const hash = (pw) => bcrypt.hashSync(pw, 10);

async function seedFullData() {
  // 추가 사용자 (동시 10명 시뮬레이션용)
  await mutate('users', null, (rows) => {
    const extra = [
      { id: 'user3', passwordHash: hash('user1234'), name: '박민수(1공장)', role: 'user', status: 'approved', plant: '1공장', plantScope: '1공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'user4', passwordHash: hash('user1234'), name: '이지영(1공장)', role: 'user', status: 'approved', plant: '1공장', plantScope: '1공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'user5', passwordHash: hash('user1234'), name: '최강민(2공장)', role: 'user', status: 'approved', plant: '2공장', plantScope: '2공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'user6', passwordHash: hash('user1234'), name: '정수빈(2공장)', role: 'user', status: 'approved', plant: '2공장', plantScope: '2공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'user7', passwordHash: hash('user1234'), name: '한도현(1공장)', role: 'user', status: 'approved', plant: '1공장', plantScope: '1공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'user8', passwordHash: hash('user1234'), name: '오예린(2공장)', role: 'user', status: 'approved', plant: '2공장', plantScope: '2공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
      { id: 'viewer2', passwordHash: hash('team1234'), name: '부팀장(전체)', role: 'viewer', status: 'approved', plant: '1공장', plantScope: 'all', createdAt: T, approvedAt: T, approvedBy: 'admin' },
    ];
    for (const u of extra) {
      if (!rows.find((r) => r.id === u.id)) rows.push(u);
    }
  });

  // 공장별 풍부한 데이터 시드
  for (const plant of ['1공장', '2공장']) {
    const prefix = plant === '1공장' ? 'P1' : 'P2';

    // ── items: 원재료 5개 + 부재료 3개 = 8개 (canister는 별도 마스터 없음)
    await writeTable('items', plant, [
      { id: `${prefix}_r01`, category: 'raw', name: '톨루엔', unit: 'kg', safetyStock: '1000', vendor: '(주)한솔케미칼', product: 'A제품', defaultQty: '800', lotPattern: 'TOL-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_r02`, category: 'raw', name: '촉매펠릿', unit: 'ea', safetyStock: '400', vendor: '동성하이켐', product: 'A제품', defaultQty: '300', lotPattern: 'CAT-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_r03`, category: 'raw', name: '황산', unit: 'L', safetyStock: '300', vendor: '대정화학', product: 'B제품', defaultQty: '500', lotPattern: 'SUL-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_r04`, category: 'raw', name: '아세톤', unit: 'kg', safetyStock: '500', vendor: '(주)한솔케미칼', product: 'B제품', defaultQty: '400', lotPattern: 'ACE-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_r05`, category: 'raw', name: '에탄올', unit: 'L', safetyStock: '600', vendor: '대정화학', product: 'C제품', defaultQty: '550', lotPattern: 'ETH-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_s01`, category: 'sub', name: '실링패드', unit: 'kg', safetyStock: '40', vendor: '(주)한솔케미칼', product: '공통', defaultQty: '25', lotPattern: 'SEA-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_s02`, category: 'sub', name: '활성탄', unit: 'kg', safetyStock: '60', vendor: '대정화학', product: '공통', defaultQty: '50', lotPattern: 'ACT-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_s03`, category: 'sub', name: '필터백', unit: 'ea', safetyStock: '200', vendor: '동성하이켐', product: '공통', defaultQty: '100', lotPattern: 'FLT-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ]);

    // ── raw_materials: 원재료 Lot 5품목 × 2 Lot = 10 Lot
    await writeTable('raw_materials', plant, [
      { id: `${prefix}_rm01`, itemName: '톨루엔', lotNo: 'TOL-2026-001', quantity: '1200', unit: 'kg', vendor: '(주)한솔케미칼', receivedDate: '2026-06-01', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm02`, itemName: '톨루엔', lotNo: 'TOL-2026-002', quantity: '800', unit: 'kg', vendor: '(주)한솔케미칼', receivedDate: '2026-06-15', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm03`, itemName: '촉매펠릿', lotNo: 'CAT-2026-001', quantity: '400', unit: 'ea', vendor: '동성하이켐', receivedDate: '2026-06-01', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm04`, itemName: '촉매펠릿', lotNo: 'CAT-2026-002', quantity: '300', unit: 'ea', vendor: '동성하이켐', receivedDate: '2026-06-20', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm05`, itemName: '황산', lotNo: 'SUL-2026-001', quantity: '500', unit: 'L', vendor: '대정화학', receivedDate: '2026-06-03', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm06`, itemName: '황산', lotNo: 'SUL-2026-002', quantity: '350', unit: 'L', vendor: '대정화학', receivedDate: '2026-06-18', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm07`, itemName: '아세톤', lotNo: 'ACE-2026-001', quantity: '600', unit: 'kg', vendor: '(주)한솔케미칼', receivedDate: '2026-06-05', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm08`, itemName: '아세톤', lotNo: 'ACE-2026-002', quantity: '400', unit: 'kg', vendor: '(주)한솔케미칼', receivedDate: '2026-06-22', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm09`, itemName: '에탄올', lotNo: 'ETH-2026-001', quantity: '700', unit: 'L', vendor: '대정화학', receivedDate: '2026-06-07', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_rm10`, itemName: '에탄올', lotNo: 'ETH-2026-002', quantity: '500', unit: 'L', vendor: '대정화학', receivedDate: '2026-06-25', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ]);

    // ── sub_materials: 부재료 Lot 3품목 × 2~3 Lot
    await writeTable('sub_materials', plant, [
      { id: `${prefix}_sm01`, name: '실링패드', receivedDate: '2026-06-01', lotNo: 'SEA-2026-001', vendor: '(주)한솔케미칼', unit: 'kg', initialWeight: '30', weight: '30', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_sm02`, name: '실링패드', receivedDate: '2026-06-20', lotNo: 'SEA-2026-002', vendor: '(주)한솔케미칼', unit: 'kg', initialWeight: '25', weight: '25', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_sm03`, name: '활성탄', receivedDate: '2026-06-05', lotNo: 'ACT-2026-001', vendor: '대정화학', unit: 'kg', initialWeight: '60', weight: '60', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_sm04`, name: '활성탄', receivedDate: '2026-06-18', lotNo: 'ACT-2026-002', vendor: '대정화학', unit: 'kg', initialWeight: '50', weight: '50', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_sm05`, name: '필터백', receivedDate: '2026-06-10', lotNo: 'FLT-2026-001', vendor: '동성하이켐', unit: 'ea', initialWeight: '200', weight: '200', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ]);

    // ── canisters: 10개
    await writeTable('canisters', plant, [
      { id: `${prefix}_cn01`, canisterNo: `${prefix}-CN-001`, size: '200L', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '사용중', statusEtc: '', content: '톨루엔', weight: '180', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn02`, canisterNo: `${prefix}-CN-002`, size: '200L', sizeEtc: '', location: '3류창고', locationEtc: '', status: '수령', statusEtc: '', content: '톨루엔', weight: '200', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn03`, canisterNo: `${prefix}-CN-003`, size: '100L', sizeEtc: '', location: '4류창고', locationEtc: '', status: '사용중', statusEtc: '', content: '황산', weight: '90', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn04`, canisterNo: `${prefix}-CN-004`, size: '100L', sizeEtc: '', location: '3류창고', locationEtc: '', status: '수령', statusEtc: '', content: '황산', weight: '100', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn05`, canisterNo: `${prefix}-CN-005`, size: '50L', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '사용중', statusEtc: '', content: '아세톤', weight: '45', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn06`, canisterNo: `${prefix}-CN-006`, size: '50L', sizeEtc: '', location: '4류창고', locationEtc: '', status: '세정의뢰', statusEtc: '', content: '', weight: '0', note: '비어있음', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn07`, canisterNo: `${prefix}-CN-007`, size: '5gal', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '사용중', statusEtc: '', content: '에탄올', weight: '15', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn08`, canisterNo: `${prefix}-CN-008`, size: '5gal', sizeEtc: '', location: '3류창고', locationEtc: '', status: '수령', statusEtc: '', content: '에탄올', weight: '18', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn09`, canisterNo: `${prefix}-CN-009`, size: '200L', sizeEtc: '', location: '4류창고', locationEtc: '', status: '사용완료', statusEtc: '', content: '', weight: '0', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_cn10`, canisterNo: `${prefix}-CN-010`, size: '100L', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '사용금지', statusEtc: '', content: '', weight: '0', note: '밸브 불량', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ]);

    // ── canister_history: CN-001, CN-003, CN-005 초기 내역
    await writeTable('canister_history', plant, [
      { id: `${prefix}_ch01`, canisterId: `${prefix}_cn01`, canisterNo: `${prefix}-CN-001`, date: '2026-06-01', type: '반입', content: '톨루엔', weight: '180', location: '2공장현장', status: '사용중', note: '최초 충전', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_ch02`, canisterId: `${prefix}_cn03`, canisterNo: `${prefix}-CN-003`, date: '2026-06-01', type: '반입', content: '황산', weight: '90', location: '4류창고', status: '사용중', note: '최초 충전', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_ch03`, canisterId: `${prefix}_cn05`, canisterNo: `${prefix}-CN-005`, date: '2026-06-01', type: '반입', content: '아세톤', weight: '45', location: '2공장현장', status: '사용중', note: '최초 충전', createdBy: 'admin', createdAt: T },
    ]);

    // ── transactions: 초기 입고 내역
    await writeTable('transactions', plant, [
      { id: `${prefix}_tx01`, materialType: 'raw', materialId: `${prefix}_rm01`, materialName: '톨루엔', lotNo: 'TOL-2026-001', content: '', type: '입고', quantity: '1200', unit: 'kg', balanceAfter: '1200', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_tx02`, materialType: 'raw', materialId: `${prefix}_rm02`, materialName: '톨루엔', lotNo: 'TOL-2026-002', content: '', type: '입고', quantity: '800', unit: 'kg', balanceAfter: '800', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_tx03`, materialType: 'raw', materialId: `${prefix}_rm03`, materialName: '촉매펠릿', lotNo: 'CAT-2026-001', content: '', type: '입고', quantity: '400', unit: 'ea', balanceAfter: '400', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_tx04`, materialType: 'sub', materialId: `${prefix}_sm01`, materialName: '실링패드', lotNo: 'SEA-2026-001', content: '', type: '입고', quantity: '30', unit: 'kg', balanceAfter: '30', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: `${prefix}_tx05`, materialType: 'canister', materialId: `${prefix}_cn01`, materialName: `${prefix}-CN-001`, lotNo: '', content: '톨루엔', type: '반입', quantity: '180', unit: 'kg', balanceAfter: '180', note: '최초 충전', createdBy: 'admin', createdAt: T },
    ]);

    // ── tasks: 2개
    await writeTable('tasks', plant, [
      { id: `${prefix}_tk01`, title: `[${plant}] Canister 세정 의뢰 확인`, category: '현장관리', categoryEtc: '', priority: '중', assignee: plant === '1공장' ? 'user2' : 'user1', dueDate: '2026-06-30', status: '진행중', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: `${prefix}_tk02`, title: `[${plant}] 촉매펠릿 안전재고 보충`, category: '원부재료', categoryEtc: '', priority: '상', assignee: plant === '1공장' ? 'admin1' : 'admin2', dueDate: '2026-06-27', status: '대기', note: '안전재고 미달', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ]);

    await writeTable('settings', plant, [
      { key: 'safetyRatioPercent', value: '100' },
      { key: 'canisterDefaultSize', value: '50L' },
      { key: 'canisterDefaultLocation', value: '2공장현장' },
      { key: 'canisterDefaultStatus', value: '수령' },
    ]);

    await writeTable('anomalies', plant, []);
    await writeTable('warning_acks', plant, []);
    await writeTable('warning_dismissed', plant, []);
  }
}

// ─── 결과 집계 ────────────────────────────────────────────────────────────────

const results = { pass: 0, fail: 0, errors: [] };

function pass(name) {
  results.pass++;
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  results.fail++;
  const msg = err instanceof Error ? err.message : String(err);
  results.errors.push(`${name}: ${msg}`);
  console.error(`  ✗ ${name}\n    → ${msg}`);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ─── 테스트 그룹 ──────────────────────────────────────────────────────────────

async function testAuth() {
  console.log('\n[1] 인증 & 역할 테스트');

  // 비인증 접근 차단
  await test('미인증 → 401', async () => {
    const r = await req('GET', '/api/raw-materials', null, null);
    ok(r.status === 401, `expected 401, got ${r.status}`);
  });

  // 관리자(전체) 로그인
  await test('통합관리자 로그인 성공', async () => {
    const { user } = await login('admin', 'admin1234');
    ok(user.id === 'admin', '유저 ID 불일치');
    ok(user.plantScope === 'all', 'plantScope 불일치');
  });

  // 잘못된 패스워드
  await test('잘못된 패스워드 → 401', async () => {
    const r = await req('POST', '/api/auth/login', { id: 'admin', password: 'wrong' });
    ok(r.status === 401, `expected 401, got ${r.status}`);
  });

  // viewer 쓰기 차단
  await test('viewer 수불 → 403', async () => {
    const { cookie } = await login('team1', 'team1234');
    const rows = await readTable('raw_materials', '1공장');
    const id = rows[0]?.id;
    if (!id) return;
    const r = await reqWithPlant('POST', `/api/raw-materials/${id}/transaction`, { type: '출고', quantity: 10 }, cookie, '1공장');
    ok(r.status === 403, `viewer는 쓰기 불가여야 하는데 ${r.status}`);
  });

  // 1공장 관리자가 2공장 접근 차단
  await test('1공장 관리자 → 2공장 접근 차단', async () => {
    const { cookie } = await login('admin1', 'admin1234');
    const r = await reqWithPlant('GET', '/api/raw-materials', null, cookie, '2공장');
    ok(r.status === 403, `다른 공장 접근이 차단되어야 하는데 ${r.status}`);
  });
}

async function testItems(plant, adminCookie) {
  console.log(`\n[2] 품목 마스터 조회 (${plant})`);

  await test(`${plant} 품목 목록 (8개 이상)`, async () => {
    const r = await reqWithPlant('GET', '/api/items', null, adminCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length >= 8, `품목 수 부족: ${r.body.items.length}`);
  });

  await test(`${plant} 원재료 품목 5개 이상`, async () => {
    const r = await reqWithPlant('GET', '/api/items?category=raw', null, adminCookie, plant);
    const rawCount = r.body.items.filter(i => i.category === 'raw').length;
    ok(rawCount >= 5, `원재료 품목 수 부족: ${rawCount}`);
  });
}

async function testRawMaterials(plant, adminCookie, userCookie) {
  console.log(`\n[3] 원재료 수불 테스트 (${plant})`);

  // Lot 목록 조회
  let lotId;
  await test(`${plant} 원재료 Lot 목록 (10개 이상)`, async () => {
    const r = await reqWithPlant('GET', '/api/raw-materials', null, adminCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length >= 10, `Lot 수 부족: ${r.body.items.length}`);
    lotId = r.body.items[0]?.id;
  });

  // 요약 조회
  await test(`${plant} 원재료 요약`, async () => {
    const r = await reqWithPlant('GET', '/api/raw-materials/summary', null, adminCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(Array.isArray(r.body.items), '요약 items 없음');
  });

  // 입고
  let newLotId;
  await test(`${plant} 원재료 신규 Lot 입고`, async () => {
    const r = await reqWithPlant('POST', '/api/raw-materials', {
      itemName: '톨루엔', lotNo: `TOL-TEST-${plant}-001`, unit: 'kg',
      quantity: 500, vendor: '테스트업체', receivedDate: '2026-06-27',
    }, userCookie, plant);
    ok(r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
    newLotId = r.body.item?.id;
    ok(newLotId, 'ID 없음');
  });

  // 중복 Lot 방지
  await test(`${plant} 동일 Lot No 중복 등록 → 400`, async () => {
    const r = await reqWithPlant('POST', '/api/raw-materials', {
      itemName: '톨루엔', lotNo: `TOL-TEST-${plant}-001`, unit: 'kg',
      quantity: 100, receivedDate: '2026-06-27',
    }, userCookie, plant);
    ok(r.status === 400, `중복 허용됨: ${r.status}`);
  });

  // FIFO 경고 (TOL-2026-001 남겨두고 TOL-2026-002 출고 시도)
  let lot002Id;
  await test(`${plant} FIFO 경고 발생 (선입선출 위반)`, async () => {
    const prefix = plant === '1공장' ? 'P1' : 'P2';
    lot002Id = `${prefix}_rm02`;
    const r = await reqWithPlant('POST', `/api/raw-materials/${lot002Id}/transaction`, {
      type: '출고', quantity: 50,
    }, userCookie, plant);
    ok(r.status === 409 && r.body.fifoWarning === true, `FIFO 경고 미발생: status=${r.status}`);
  });

  // FIFO 강제 출고
  await test(`${plant} FIFO 강제 출고 (force=1)`, async () => {
    if (!lot002Id) return;
    const r = await reqWithPlant('POST', `/api/raw-materials/${lot002Id}/transaction`, {
      type: '출고', quantity: 50, force: '1', note: '강제 출고 테스트',
    }, userCookie, plant);
    ok(r.status === 201, `강제 출고 실패: status=${r.status} body=${JSON.stringify(r.body)}`);
  });

  // 재고 초과 출고 → 400
  await test(`${plant} 재고 초과 출고 → 400`, async () => {
    const prefix = plant === '1공장' ? 'P1' : 'P2';
    const rmId = `${prefix}_rm01`;
    const r = await reqWithPlant('POST', `/api/raw-materials/${rmId}/transaction`, {
      type: '출고', quantity: 9999999, force: '1',
    }, userCookie, plant);
    ok(r.status === 400, `초과 출고 허용됨: ${r.status}`);
  });

  // 일 10회 수불 시뮬레이션
  await test(`${plant} 일 10회 수불 처리`, async () => {
    const prefix = plant === '1공장' ? 'P1' : 'P2';
    const targetId = `${prefix}_rm01`;
    const ops = [];
    // 입고 5회, 출고 5회
    for (let i = 0; i < 5; i++) {
      ops.push(reqWithPlant('POST', `/api/raw-materials/${targetId}/transaction`, {
        type: '입고', quantity: 10, note: `일일입고 ${i+1}`,
      }, userCookie, plant));
    }
    for (let i = 0; i < 5; i++) {
      ops.push(reqWithPlant('POST', `/api/raw-materials/${targetId}/transaction`, {
        type: '출고', quantity: 5, force: '1', note: `일일출고 ${i+1}`,
      }, userCookie, plant));
    }
    const results = await Promise.all(ops);
    const ok201 = results.filter(r => r.status === 201).length;
    ok(ok201 === 10, `10회 중 ${ok201}회 성공`);
  });
}

async function testSubMaterials(plant, userCookie) {
  console.log(`\n[4] 부재료 수불 테스트 (${plant})`);

  const prefix = plant === '1공장' ? 'P1' : 'P2';

  await test(`${plant} 부재료 Lot 목록`, async () => {
    const r = await reqWithPlant('GET', '/api/sub-materials', null, userCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length >= 5, `부재료 Lot 수 부족: ${r.body.items.length}`);
  });

  // 부재료 입고
  await test(`${plant} 부재료 신규 입고`, async () => {
    const r = await reqWithPlant('POST', '/api/sub-materials', {
      name: '실링패드', lotNo: `SEA-TEST-${plant}`, unit: 'kg',
      weight: 20, receivedDate: '2026-06-27',
    }, userCookie, plant);
    ok(r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  });

  // 부재료 출고 (FIFO: sm01보다 sm02 먼저 출고 시 경고)
  await test(`${plant} 부재료 FIFO 경고`, async () => {
    const r = await reqWithPlant('POST', `/api/sub-materials/${prefix}_sm02/transaction`, {
      type: '출고', quantity: 5,
    }, userCookie, plant);
    ok(r.status === 409 && r.body.fifoWarning === true, `FIFO 경고 미발생: ${r.status}`);
  });

  // 부재료 일 10회 수불
  await test(`${plant} 부재료 일 10회 수불`, async () => {
    const id = `${prefix}_sm01`;
    const ops = [];
    for (let i = 0; i < 5; i++) {
      ops.push(reqWithPlant('POST', `/api/sub-materials/${id}/transaction`, { type: '입고', quantity: 2 }, userCookie, plant));
    }
    for (let i = 0; i < 5; i++) {
      ops.push(reqWithPlant('POST', `/api/sub-materials/${id}/transaction`, { type: '출고', quantity: 1 }, userCookie, plant));
    }
    const rs = await Promise.all(ops);
    const ok201 = rs.filter(r => r.status === 201).length;
    ok(ok201 === 10, `10회 중 ${ok201}회 성공`);
  });
}

async function testCanisters(plant, userCookie) {
  console.log(`\n[5] Canister 테스트 (${plant})`);

  const prefix = plant === '1공장' ? 'P1' : 'P2';

  await test(`${plant} Canister 목록 (10개)`, async () => {
    const r = await reqWithPlant('GET', '/api/canisters', null, userCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length >= 10, `Canister 수 부족: ${r.body.items.length}`);
  });

  await test(`${plant} Canister 요약`, async () => {
    const r = await reqWithPlant('GET', '/api/canisters/summary', null, userCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.total >= 10, `Canister 총수 부족: ${r.body.total}`);
  });

  // Canister 이력 조회
  await test(`${plant} Canister 상세 이력`, async () => {
    const r = await reqWithPlant('GET', `/api/canisters/${prefix}_cn01/history`, null, userCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(Array.isArray(r.body.items), '이력 없음');
  });

  // Canister 상태 변경 (이동)
  await test(`${plant} Canister 이동 기록`, async () => {
    const r = await reqWithPlant('POST', `/api/canisters/${prefix}_cn01/move`, {
      type: '상태변경', date: '2026-06-27', location: '3류창고',
      status: '사용중', content: '톨루엔', weight: '170', note: '테스트 이동',
    }, userCookie, plant);
    ok(r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  });

  // 신규 Canister 등록
  await test(`${plant} 신규 Canister 등록`, async () => {
    const r = await reqWithPlant('POST', '/api/canisters', {
      canisterNo: `${prefix}-CN-TEST-001`, size: '50L',
      location: '3류창고', status: '수령', content: '', weight: '0',
    }, userCookie, plant);
    ok(r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
  });

  // 중복 Canister No 방지
  await test(`${plant} 중복 Canister No → 400`, async () => {
    const r = await reqWithPlant('POST', '/api/canisters', {
      canisterNo: `${prefix}-CN-TEST-001`, size: '50L',
      location: '3류창고', status: '수령',
    }, userCookie, plant);
    ok(r.status === 400, `중복 Canister 허용됨: ${r.status}`);
  });
}

async function testConcurrent(plant, cookies) {
  console.log(`\n[6] 동시 사용자 10명 테스트 (${plant})`);

  const prefix = plant === '1공장' ? 'P1' : 'P2';
  const targetId = `${prefix}_rm09`; // 에탄올 Lot1

  // 10명이 동시에 출고 시도 (각 5단위, 총 50 → 재고 700 충분)
  await test(`${plant} 10명 동시 출고 (재고 충분)`, async () => {
    const ops = cookies.map((cookie) =>
      reqWithPlant('POST', `/api/raw-materials/${targetId}/transaction`, {
        type: '출고', quantity: 5, force: '1', note: '동시 출고 테스트',
      }, cookie, plant)
    );
    const rs = await Promise.all(ops);
    const ok201 = rs.filter(r => r.status === 201).length;
    ok(ok201 === cookies.length, `${cookies.length}명 중 ${ok201}명 성공`);

    // 재고 정합성 확인
    const rows = await readTable('raw_materials', plant);
    const lot = rows.find(r => r.id === targetId);
    const expected = 700 - (5 * cookies.length);
    ok(Number(lot.quantity) === expected, `재고 불일치: ${lot.quantity} (예상 ${expected})`);
  });

  // 10명이 동시에 입고
  await test(`${plant} 10명 동시 입고`, async () => {
    const ops = cookies.map((_, i) =>
      reqWithPlant('POST', '/api/raw-materials', {
        itemName: '아세톤', lotNo: `CONC-${plant}-${i}`, unit: 'kg',
        quantity: 10, receivedDate: '2026-06-27',
      }, cookies[i], plant)
    );
    const rs = await Promise.all(ops);
    const ok201 = rs.filter(r => r.status === 201).length;
    ok(ok201 === cookies.length, `동시 입고 ${ok201}/${cookies.length} 성공`);
    // 중복 없음 확인
    const rows = await readTable('raw_materials', plant);
    const concLots = rows.filter(r => r.lotNo.startsWith(`CONC-${plant}-`));
    ok(concLots.length === cookies.length, `중복 Lot 발생: ${concLots.length}/${cookies.length}`);
  });

  // Canister 동시 이동
  await test(`${plant} 10명 Canister 동시 상태변경`, async () => {
    const ops = cookies.map((cookie) =>
      reqWithPlant('POST', `/api/canisters/${prefix}_cn02/move`, {
        type: '상태변경', date: '2026-06-27',
        location: '3류창고', status: '수령',
        content: '톨루엔', weight: '200', note: '동시 상태변경',
      }, cookie, plant)
    );
    const rs = await Promise.all(ops);
    const ok201 = rs.filter(r => r.status === 201).length;
    ok(ok201 === cookies.length, `Canister 동시 이동 ${ok201}/${cookies.length}`);
  });
}

async function testDashboard(plant, cookies) {
  console.log(`\n[7] 대시보드 & 경고 테스트 (${plant})`);

  await test(`${plant} 대시보드 조회`, async () => {
    const r = await reqWithPlant('GET', '/api/dashboard', null, cookies[0], plant);
    ok(r.status === 200, `status=${r.status}`);
  });

  await test(`${plant} 수불 내역 조회`, async () => {
    const r = await reqWithPlant('GET', '/api/transactions', null, cookies[0], plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length > 0, '수불 내역 없음');
  });

  await test(`${plant} 이상 내역 조회`, async () => {
    const r = await reqWithPlant('GET', '/api/anomalies', null, cookies[0], plant);
    ok(r.status === 200, `status=${r.status}`);
  });
}

async function testAdminFunctions(plant, adminCookie, userCookie) {
  console.log(`\n[8] 관리자 전용 기능 (${plant})`);

  const prefix = plant === '1공장' ? 'P1' : 'P2';

  // 일반 사용자가 삭제 → 403
  await test(`${plant} 일반 사용자 삭제 → 403`, async () => {
    const r = await reqWithPlant('DELETE', `/api/raw-materials/${prefix}_rm10`, null, userCookie, plant);
    ok(r.status === 403, `사용자 삭제 허용됨: ${r.status}`);
  });

  // 관리자는 삭제 가능
  await test(`${plant} 관리자 삭제 성공`, async () => {
    const r = await reqWithPlant('DELETE', `/api/raw-materials/${prefix}_rm10`, null, adminCookie, plant);
    ok(r.status === 200, `관리자 삭제 실패: ${r.status} ${JSON.stringify(r.body)}`);
  });

  // 사용자 목록 (총괄관리자 전용)
  await test(`${plant} 사용자 목록 조회 (총괄관리자)`, async () => {
    const { cookie: superCookie } = await login('admin', 'admin1234');
    const r = await reqWithPlant('GET', '/api/users', null, superCookie, plant);
    ok(r.status === 200, `status=${r.status}`);
    ok(r.body.items.length >= 6, `사용자 수 부족: ${r.body.items.length}`);
  });
  // 공장 관리자는 사용자 목록 조회 불가 (설계상 총괄만 가능)
  await test(`${plant} 공장관리자 사용자목록 → 403`, async () => {
    const r = await reqWithPlant('GET', '/api/users', null, adminCookie, plant);
    ok(r.status === 403, `공장관리자가 사용자목록 접근됨: ${r.status}`);
  });

  // Task 생성
  await test(`${plant} Task 생성`, async () => {
    const r = await reqWithPlant('POST', '/api/tasks', {
      title: `[테스트] ${plant} 일일 점검`, category: '현장관리',
      priority: '중', dueDate: '2026-06-30',
    }, userCookie, plant);
    ok(r.status === 201, `Task 생성 실패: ${r.status}`);
  });
}

async function testCrossPlantIsolation(admin1Cookie, admin2Cookie) {
  console.log('\n[9] 공장 간 데이터 격리 확인');

  await test('1공장 데이터가 2공장에 안 보임', async () => {
    const r1 = await reqWithPlant('GET', '/api/raw-materials', null, admin1Cookie, '1공장');
    const r2 = await reqWithPlant('GET', '/api/raw-materials', null, admin2Cookie, '2공장');
    ok(r1.status === 200 && r2.status === 200, 'API 실패');
    const ids1 = r1.body.items.map(i => i.id);
    const ids2 = r2.body.items.map(i => i.id);
    const overlap = ids1.filter(id => ids2.includes(id));
    ok(overlap.length === 0, `공장 간 데이터 혼재: ${overlap.join(', ')}`);
  });

  await test('통합관리자는 양 공장 모두 접근 가능', async () => {
    const { cookie } = await login('admin', 'admin1234');
    const r1 = await reqWithPlant('GET', '/api/raw-materials', null, cookie, '1공장');
    const r2 = await reqWithPlant('GET', '/api/raw-materials', null, cookie, '2공장');
    ok(r1.status === 200, `1공장 접근 실패: ${r1.status}`);
    ok(r2.status === 200, `2공장 접근 실패: ${r2.status}`);
  });
}

// ─── 메인 실행 ────────────────────────────────────────────────────────────────

(async () => {
  console.log('===== 공장 관리 시스템 통합 테스트 시작 =====');
  console.log('목표: 공장당 품목 10개 / 일 10회 수불 / 동시 10명');

  try {
    await startServer();
    console.log(`서버 시작: ${baseUrl}`);

    // 세션 쿠키 획득
    const { cookie: adminCookie }  = await login('admin', 'admin1234');   // 통합관리자
    const { cookie: admin1Cookie } = await login('admin1', 'admin1234');  // 1공장관리자
    const { cookie: admin2Cookie } = await login('admin2', 'admin1234');  // 2공장관리자
    const { cookie: user1Cookie }  = await login('user1', 'user1234');    // 2공장 사용자
    const { cookie: user2Cookie }  = await login('user2', 'user1234');    // 1공장 사용자
    const { cookie: user3Cookie }  = await login('user3', 'user1234');
    const { cookie: user4Cookie }  = await login('user4', 'user1234');
    const { cookie: user5Cookie }  = await login('user5', 'user1234');
    const { cookie: user6Cookie }  = await login('user6', 'user1234');
    const { cookie: user7Cookie }  = await login('user7', 'user1234');

    const p1Cookies = [admin1Cookie, user2Cookie, user3Cookie, user4Cookie, user7Cookie,
                       adminCookie, adminCookie, user2Cookie, user3Cookie, admin1Cookie];
    const p2Cookies = [admin2Cookie, user1Cookie, user5Cookie, user6Cookie, adminCookie,
                       user1Cookie, user5Cookie, admin2Cookie, user6Cookie, adminCookie];

    // 테스트 실행
    await testAuth();
    await testItems('1공장', admin1Cookie);
    await testItems('2공장', admin2Cookie);
    await testRawMaterials('1공장', admin1Cookie, user2Cookie);
    await testRawMaterials('2공장', admin2Cookie, user1Cookie);
    await testSubMaterials('1공장', user2Cookie);
    await testSubMaterials('2공장', user1Cookie);
    await testCanisters('1공장', user2Cookie);
    await testCanisters('2공장', user1Cookie);
    await testConcurrent('1공장', p1Cookies);
    await testConcurrent('2공장', p2Cookies);
    await testDashboard('1공장', p1Cookies);
    await testDashboard('2공장', p2Cookies);
    await testAdminFunctions('1공장', admin1Cookie, user2Cookie);
    await testAdminFunctions('2공장', admin2Cookie, user1Cookie);
    await testCrossPlantIsolation(admin1Cookie, admin2Cookie);

  } catch (e) {
    console.error('\n[FATAL]', e.message);
    results.fail++;
  } finally {
    await stopServer().catch(() => {});
  }

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log(`결과: ${results.pass}개 통과 / ${results.fail}개 실패`);
  if (results.errors.length) {
    console.log('\n실패 목록:');
    results.errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }
  console.log('='.repeat(50));
  process.exit(results.fail > 0 ? 1 : 0);
})();
