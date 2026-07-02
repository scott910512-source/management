'use strict';

const fs = require('fs');
const bcrypt = require('bcryptjs');
const { TABLES, PLANTS, filePath, isGlobal, ensureDataDirs, _writeSync } = require('./store');

const T = '2026-06-01T00:00:00.000Z';
const hash = (pw) => bcrypt.hashSync(pw, 10);

// 전역 사용자(공장 공통)
function userRows() {
  return [
    { id: 'admin', passwordHash: hash('admin1234'), name: '통합관리자', role: 'admin', status: 'approved', plant: '2공장', plantScope: 'all', createdAt: T, approvedAt: T, approvedBy: 'system' },
    { id: 'admin1', passwordHash: hash('admin1234'), name: '1공장 관리자', role: 'admin', status: 'approved', plant: '1공장', plantScope: '1공장', createdAt: T, approvedAt: T, approvedBy: 'system' },
    { id: 'admin2', passwordHash: hash('admin1234'), name: '2공장 관리자', role: 'admin', status: 'approved', plant: '2공장', plantScope: '2공장', createdAt: T, approvedAt: T, approvedBy: 'system' },
    { id: 'team1', passwordHash: hash('team1234'), name: '팀관리자(팀장)', role: 'viewer', status: 'approved', plant: '2공장', plantScope: 'all', createdAt: T, approvedAt: T, approvedBy: 'system' },
    { id: 'user1', passwordHash: hash('user1234'), name: '홍길동(2공장)', role: 'user', status: 'approved', plant: '2공장', plantScope: '2공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
    { id: 'user2', passwordHash: hash('user1234'), name: '김영희(1공장)', role: 'user', status: 'approved', plant: '1공장', plantScope: '1공장', createdAt: T, approvedAt: T, approvedBy: 'admin' },
  ];
}

// 공장별 시드(각 공장이 독립적으로 동일한 예시 세트로 시작)
function plantRows() {
  // 다월 트랜잭션 이력 생성 (2026-01 ~ 2026-06)
  const txHistory = [];
  const rmHistory = [];
  const smHistory = [];
  let txId = 10;
  let rmId = 10;
  let smId = 10;

  // 원재료 이력 데이터 (월별 입/출고)
  const rawData = [
    // 톨루엔
    { month: '2026-01', rmNo: 'rm_h001', itemName: '톨루엔', lotNo: 'T-2026-H01', inQty: 1200, outQty: 900 },
    { month: '2026-02', rmNo: 'rm_h002', itemName: '톨루엔', lotNo: 'T-2026-H02', inQty: 800, outQty: 750 },
    { month: '2026-03', rmNo: 'rm_h003', itemName: '톨루엔', lotNo: 'T-2026-H03', inQty: 1000, outQty: 980 },
    { month: '2026-04', rmNo: 'rm_h004', itemName: '톨루엔', lotNo: 'T-2026-H04', inQty: 600, outQty: 580 },
    { month: '2026-05', rmNo: 'rm_h005', itemName: '톨루엔', lotNo: 'T-2026-H05', inQty: 900, outQty: 860 },
    // 촉매펠릿
    { month: '2026-01', rmNo: 'rm_h006', itemName: '촉매펠릿', lotNo: 'C-2026-H01', inQty: 500, outQty: 350 },
    { month: '2026-02', rmNo: 'rm_h007', itemName: '촉매펠릿', lotNo: 'C-2026-H02', inQty: 400, outQty: 380 },
    { month: '2026-03', rmNo: 'rm_h008', itemName: '촉매펠릿', lotNo: 'C-2026-H03', inQty: 300, outQty: 290 },
    { month: '2026-04', rmNo: 'rm_h009', itemName: '촉매펠릿', lotNo: 'C-2026-H04', inQty: 450, outQty: 420 },
    { month: '2026-05', rmNo: 'rm_h010', itemName: '촉매펠릿', lotNo: 'C-2026-H05', inQty: 350, outQty: 340 },
    // 황산
    { month: '2026-01', rmNo: 'rm_h011', itemName: '황산', lotNo: 'S-2026-H01', inQty: 600, outQty: 500 },
    { month: '2026-02', rmNo: 'rm_h012', itemName: '황산', lotNo: 'S-2026-H02', inQty: 500, outQty: 480 },
    { month: '2026-03', rmNo: 'rm_h013', itemName: '황산', lotNo: 'S-2026-H03', inQty: 700, outQty: 650 },
    { month: '2026-04', rmNo: 'rm_h014', itemName: '황산', lotNo: 'S-2026-H04', inQty: 400, outQty: 380 },
    { month: '2026-05', rmNo: 'rm_h015', itemName: '황산', lotNo: 'S-2026-H05', inQty: 550, outQty: 520 },
  ];

  for (const d of rawData) {
    const dateIn = `${d.month}-05`;
    const dateOut = `${d.month}-20`;
    const tsIn = `${dateIn}T00:00:00.000Z`;
    const tsOut = `${dateOut}T00:00:00.000Z`;
    rmHistory.push({ id: d.rmNo, itemName: d.itemName, lotNo: d.lotNo, quantity: String(d.inQty - d.outQty), unit: d.itemName === '황산' ? 'L' : d.itemName === '촉매펠릿' ? 'ea' : 'kg', vendor: '(주)한솔케미칼', receivedDate: dateIn, note: '이력 데이터', createdBy: 'admin', createdAt: tsIn, updatedBy: 'admin', updatedAt: tsIn });
    txHistory.push({ id: `tx_h${String(txId++).padStart(3,'0')}`, materialType: 'raw', materialId: d.rmNo, materialName: d.itemName, lotNo: d.lotNo, content: '', type: '입고', quantity: String(d.inQty), unit: d.itemName === '황산' ? 'L' : d.itemName === '촉매펠릿' ? 'ea' : 'kg', balanceAfter: String(d.inQty), note: '이력 데이터', createdBy: 'admin', createdAt: tsIn });
    txHistory.push({ id: `tx_h${String(txId++).padStart(3,'0')}`, materialType: 'raw', materialId: d.rmNo, materialName: d.itemName, lotNo: d.lotNo, content: '', type: '출고', quantity: String(d.outQty), unit: d.itemName === '황산' ? 'L' : d.itemName === '촉매펠릿' ? 'ea' : 'kg', balanceAfter: String(d.inQty - d.outQty), note: '이력 데이터', createdBy: 'admin', createdAt: tsOut });
  }

  // 부재료 이력 데이터 (월별)
  const subData = [
    { month: '2026-01', name: '실링패드', lotNo: 'L-2026-H01', inQty: 30, outQty: 22 },
    { month: '2026-02', name: '실링패드', lotNo: 'L-2026-H02', inQty: 25, outQty: 20 },
    { month: '2026-03', name: '실링패드', lotNo: 'L-2026-H03', inQty: 35, outQty: 30 },
    { month: '2026-04', name: '실링패드', lotNo: 'L-2026-H04', inQty: 20, outQty: 18 },
    { month: '2026-05', name: '실링패드', lotNo: 'L-2026-H05', inQty: 28, outQty: 25 },
    { month: '2026-01', name: '활성탄', lotNo: 'L-2026-H11', inQty: 80, outQty: 60 },
    { month: '2026-02', name: '활성탄', lotNo: 'L-2026-H12', inQty: 60, outQty: 55 },
    { month: '2026-03', name: '활성탄', lotNo: 'L-2026-H13', inQty: 70, outQty: 65 },
    { month: '2026-04', name: '활성탄', lotNo: 'L-2026-H14', inQty: 50, outQty: 48 },
    { month: '2026-05', name: '활성탄', lotNo: 'L-2026-H15', inQty: 65, outQty: 60 },
  ];

  for (const d of subData) {
    const dateIn = `${d.month}-07`;
    const dateOut = `${d.month}-22`;
    const tsIn = `${dateIn}T00:00:00.000Z`;
    const tsOut = `${dateOut}T00:00:00.000Z`;
    const smNo = `sm_h${String(smId++).padStart(3,'0')}`;
    smHistory.push({ id: smNo, name: d.name, receivedDate: dateIn, lotNo: d.lotNo, vendor: '(주)한솔케미칼', unit: 'kg', initialWeight: String(d.inQty), weight: String(d.inQty - d.outQty), note: '이력 데이터', createdBy: 'admin', createdAt: tsIn, updatedBy: 'admin', updatedAt: tsOut });
    txHistory.push({ id: `tx_h${String(txId++).padStart(3,'0')}`, materialType: 'sub', materialId: smNo, materialName: d.name, lotNo: d.lotNo, content: '', type: '입고', quantity: String(d.inQty), unit: 'kg', balanceAfter: String(d.inQty), note: '이력 데이터', createdBy: 'admin', createdAt: tsIn });
    txHistory.push({ id: `tx_h${String(txId++).padStart(3,'0')}`, materialType: 'sub', materialId: smNo, materialName: d.name, lotNo: d.lotNo, content: '', type: '출고', quantity: String(d.outQty), unit: 'kg', balanceAfter: String(d.inQty - d.outQty), note: '이력 데이터', createdBy: 'admin', createdAt: tsOut });
  }

  return {
    items: [
      { id: 'it_r01', category: 'raw', name: '톨루엔', unit: 'kg', safetyStock: '1000', vendor: '(주)한솔케미칼', product: 'A제품', defaultQty: '800', lotPattern: 'T-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'it_r02', category: 'raw', name: '촉매펠릿', unit: 'ea', safetyStock: '400', vendor: '동성하이켐', product: 'A제품', defaultQty: '300', lotPattern: 'C-{YYYY}-', note: '안전재고 미달 예시', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'it_r03', category: 'raw', name: '황산', unit: 'L', safetyStock: '300', vendor: '대정화학', product: 'B제품', defaultQty: '500', lotPattern: 'S-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'it_s01', category: 'sub', name: '실링패드', unit: 'kg', safetyStock: '40', vendor: '(주)한솔케미칼', product: '공통', defaultQty: '25', lotPattern: 'L-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'it_s02', category: 'sub', name: '활성탄', unit: 'kg', safetyStock: '60', vendor: '대정화학', product: '공통', defaultQty: '50', lotPattern: 'L-{YYYY}-', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ],
    raw_materials: [
      { id: 'rm_0001', itemName: '톨루엔', lotNo: 'T-2026-001', quantity: '800', unit: 'kg', vendor: '(주)한솔케미칼', receivedDate: '2026-06-01', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'rm_0002', itemName: '톨루엔', lotNo: 'T-2026-002', quantity: '400', unit: 'kg', vendor: '대정화학', receivedDate: '2026-06-15', note: '동일 품목 다른 Lot', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'rm_0003', itemName: '촉매펠릿', lotNo: 'C-2026-001', quantity: '300', unit: 'ea', vendor: '동성하이켐', receivedDate: '2026-06-10', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      ...rmHistory,
    ],
    sub_materials: [
      { id: 'sm_0001', name: '실링패드', receivedDate: '2026-06-05', lotNo: 'L-2026-001', vendor: '(주)한솔케미칼', unit: 'kg', initialWeight: '25', weight: '25', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'sm_0002', name: '활성탄', receivedDate: '2026-06-12', lotNo: 'L-2026-014', vendor: '대정화학', unit: 'kg', initialWeight: '50', weight: '50', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'sm_0003', name: '실링패드', receivedDate: '2026-06-18', lotNo: 'L-2026-027', vendor: '동성하이켐', unit: 'kg', initialWeight: '20', weight: '20', note: '동일 품목 다른 Lot', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      ...smHistory,
    ],
    canisters: [
      { id: 'cn_0001', canisterNo: 'CN-001', size: '200L', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '사용중', statusEtc: '', content: '톨루엔', weight: '180', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'cn_0002', canisterNo: 'CN-002', size: '50L', sizeEtc: '', location: '3류창고', locationEtc: '', status: '세정의뢰', statusEtc: '', content: '', weight: '0', note: '비어있음', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'cn_0003', canisterNo: 'CN-003', size: '5gal', sizeEtc: '', location: '4류창고', locationEtc: '', status: '수령', statusEtc: '', content: '황산', weight: '15', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ],
    canister_history: [
      { id: 'ch_0001', canisterId: 'cn_0001', canisterNo: 'CN-001', date: '2026-06-01', type: '반입', content: '톨루엔', weight: '180', location: '2공장현장', status: '사용중', note: '내용물 충전', createdBy: 'admin', createdAt: T },
      { id: 'ch_0002', canisterId: 'cn_0003', canisterNo: 'CN-003', date: '2026-06-01', type: '반입', content: '황산', weight: '15', location: '4류창고', status: '수령', note: '내용물 충전', createdBy: 'admin', createdAt: T },
    ],
    transactions: [
      { id: 'tx_0001', materialType: 'raw', materialId: 'rm_0001', materialName: '톨루엔', lotNo: 'T-2026-001', content: '', type: '입고', quantity: '800', unit: 'kg', balanceAfter: '800', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: 'tx_0002', materialType: 'sub', materialId: 'sm_0001', materialName: '실링패드', lotNo: 'L-2026-001', content: '', type: '입고', quantity: '25', unit: 'kg', balanceAfter: '25', note: '초기 입고', createdBy: 'admin', createdAt: T },
      { id: 'tx_0003', materialType: 'canister', materialId: 'cn_0001', materialName: 'CN-001', lotNo: '', content: '톨루엔', type: '반입', quantity: '180', unit: 'kg', balanceAfter: '180', note: '내용물 충전', createdBy: 'admin', createdAt: T },
      ...txHistory,
    ],
    settings: [
      { key: 'safetyRatioPercent', value: '100' },
      { key: 'canisterDefaultSize', value: '50L' },
      { key: 'canisterDefaultLocation', value: '2공장현장' },
      { key: 'canisterDefaultStatus', value: '수령' },
    ],
    anomalies: [],
    tasks: [
      { id: 'tk_0001', title: '3류창고 Canister 세정 의뢰 확인', category: '현장관리', categoryEtc: '', priority: '중', assignee: 'user1', dueDate: '2026-06-30', status: '진행중', note: '', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
      { id: 'tk_0002', title: '촉매펠릿 안전재고 보충 발주', category: '원부재료', categoryEtc: '', priority: '상', assignee: 'admin', dueDate: '2026-06-27', status: '대기', note: '안전재고 미달', createdBy: 'admin', createdAt: T, updatedBy: 'admin', updatedAt: T },
    ],
    warning_acks: [],
    warning_dismissed: [],
  };
}

/**
 * 데이터 파일을 보장한다(없을 때만 생성). 공장별로 시드한다.
 */
function ensureSeed(opts = {}) {
  ensureDataDirs();
  const created = [];
  // 전역 users
  if (!fs.existsSync(filePath('users')) || opts.force) {
    _writeSync('users', null, userRows());
    created.push('users');
  }
  // 공장별 테이블
  const data = plantRows();
  for (const plant of PLANTS) {
    for (const name of Object.keys(data)) {
      if (isGlobal(name)) continue;
      if (!fs.existsSync(filePath(name, plant)) || opts.force) {
        _writeSync(name, plant, data[name] || []);
        created.push(`${plant}/${name}`);
      }
    }
  }
  return created;
}

module.exports = { ensureSeed, userRows, plantRows };

if (require.main === module) {
  const force = process.argv.includes('--force');
  const created = ensureSeed({ force });
  // eslint-disable-next-line no-console
  console.log(`[seed] ${force ? '강제 재생성' : '초기화'} 완료:`, created.join(', ') || '(변경 없음)');
}
