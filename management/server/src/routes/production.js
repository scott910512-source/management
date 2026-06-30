'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { asyncHandler, badRequest } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { readTable } = require('../lib/store');

const router = express.Router();

// ── 데모 더미 데이터 ────────────────────────────────────────────
const DEMO_COLORS = { CpHf: '#4a90d9', '3DMAS': '#e67e22', STYA1: '#27ae60', SP17: '#c0a800' };

function makeDemoData() {
  const products = ['CpHf', '3DMAS', 'STYA1', 'SP17'];
  const daily = (base, noise) =>
    Array.from({ length: 29 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      qty: Math.round(base + (Math.sin(i * 0.7) * noise) + (Math.random() * noise * 0.3)),
    }));
  const monthly = (plan, actuals) =>
    actuals.map((a, i) => ({ month: i + 1, plan, actual: a, rate: Math.round((a / plan) * 1000) / 10 }));

  return {
    reportDate: '2026-06-29',
    products,
    byProduct: {
      CpHf: {
        color: '#4a90d9',
        todayQty: 42, prevDayQty: 39,
        monthPlan: 150, monthActual: 140, monthRate: 92.8,
        yearPlan: 1800, yearActual: 1338, yearRate: 74.3,
        yield: 74.3, yieldTarget: 70, yieldPrev: 72.0,
        monthBatch: 5, yearBatch: 18,
        inventory: { carryOver: 7, filled: 0, shipped: 0, total: 7 },
        dailyData: daily(5, 3),
        monthlyData: monthly(150, [120, 135, 148, 130, 142, 140, 0, 0, 0, 0, 0, 0]),
      },
      '3DMAS': {
        color: '#e67e22',
        todayQty: 28, prevDayQty: 30,
        monthPlan: 181, monthActual: 129, monthRate: 71.4,
        yearPlan: 2172, yearActual: 1564, yearRate: 72.0,
        yield: 71.4, yieldTarget: 75, yieldPrev: 73.2,
        monthBatch: 4, yearBatch: 15,
        inventory: { carryOver: 0, filled: 0, shipped: 0, total: 0 },
        dailyData: daily(4.5, 2.5),
        monthlyData: monthly(181, [155, 162, 178, 165, 172, 129, 0, 0, 0, 0, 0, 0]),
      },
      STYA1: {
        color: '#27ae60',
        todayQty: 320, prevDayQty: 271,
        monthPlan: 1260, monthActual: 1260, monthRate: 100,
        yearPlan: 15120, yearActual: 12157, yearRate: 80.4,
        yield: 80.4, yieldTarget: 78, yieldPrev: 79.9,
        monthBatch: 7, yearBatch: 28,
        inventory: { carryOver: 0, filled: 64, shipped: 0, total: 64 },
        dailyData: daily(43, 18),
        monthlyData: monthly(1260, [820, 880, 960, 940, 1000, 1260, 0, 0, 0, 0, 0, 0]),
      },
      SP17: {
        color: '#c0a800',
        todayQty: 188, prevDayQty: 184,
        monthPlan: 1080, monthActual: 1115, monthRate: 103.2,
        yearPlan: 12960, yearActual: 9331, yearRate: 72.0,
        yield: 72.0, yieldTarget: 72, yieldPrev: 71.9,
        monthBatch: 6, yearBatch: 24,
        inventory: { carryOver: 0, filled: 0, shipped: 0, total: 0 },
        dailyData: daily(38, 14),
        monthlyData: monthly(1080, [205, 207, 210, 212, 208, 1115, 0, 0, 0, 0, 0, 0]),
      },
    },
    batches: [
      { no: '#200', product: 'CpHf', steps: ['done','done','done','active','wait','wait','wait'] },
      { no: '#199', product: '3DMAS', steps: ['done','done','done','done','active','wait','wait'] },
      { no: '#RE11', product: 'SP17', steps: ['done','done','done','done','done','done','active'] },
    ],
    stepLabels: ['R', 'F', 'D1', 'D2', 'D3', 'FS', 'Fill'],
    alerts: [
      { level: 'error', product: '3DMAS', batchNo: '#199', yield: 63.2, target: 70, date: '2026-06-27', step: 'Distillation No.2' },
      { level: 'warn',  product: 'CpHf',  batchNo: '#196', yield: 68.5, target: 70, date: '2026-06-24', step: 'Final Storage' },
      { level: 'ok',    product: 'STYA1', batchNo: '#198', yield: 85.1, target: 78, date: '2026-06-28', step: '' },
    ],
  };
}

// ── 공유폴더 파일 탐색 ────────────────────────────────────────────
function findLatestFile(folderPath, keywords) {
  const kws = keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    throw new Error(`폴더를 열 수 없습니다: ${e.message}`);
  }
  const matched = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.xlsx'))
    .filter((e) => kws.every((k) => e.name.toLowerCase().includes(k)))
    .map((e) => {
      const full = path.join(folderPath, e.name);
      return { name: e.name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (!matched.length) throw new Error(`키워드(${keywords})에 맞는 xlsx 파일을 찾을 수 없습니다.`);
  return matched[0];
}

// ── Excel 파싱 ────────────────────────────────────────────────────
const PRODUCTS = ['CpHf', '3DMAS', 'STYA1', 'SP17'];
const PROD_COLORS = { CpHf: '#4a90d9', '3DMAS': '#e67e22', STYA1: '#27ae60', SP17: '#c0a800' };
const STEP_LABELS = ['R', 'F', 'D1', 'D2', 'D3', 'FS', 'Fill'];

function cellVal(sheet, addr) {
  const c = sheet[addr];
  return c ? c.v : null;
}

function parseProductionFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true });

  // 최신 날짜 시트 찾기 (예: "6월 29일", "6월29일")
  const dateSheetRe = /^\d{1,2}월\s*\d{1,2}일$/;
  const dateSheets = wb.SheetNames.filter((n) => dateSheetRe.test(n.trim()));
  if (!dateSheets.length) throw new Error('날짜 시트(예: 6월 29일)를 찾을 수 없습니다.');
  const sheetName = dateSheets[dateSheets.length - 1];
  const sheet = wb.Sheets[sheetName];

  // 배치 시트 찾기
  const batchSheetRe = /배치별.*수율.*\d{2}년/;
  const batchSheetName = wb.SheetNames.find((n) => batchSheetRe.test(n));
  const batchSheet = batchSheetName ? wb.Sheets[batchSheetName] : null;

  // 시트에서 날짜 추출
  const reportDate = sheetName.trim().replace(/\s/g, '');

  // 품목 데이터 파싱 (행 위치는 실제 파일 확인 후 조정 필요)
  // 현재는 구조 샘플 — 실제 셀 주소는 파일 수령 후 매핑
  const byProduct = {};
  PRODUCTS.forEach((p) => {
    byProduct[p] = {
      color: PROD_COLORS[p],
      todayQty: null, prevDayQty: null,
      monthPlan: null, monthActual: null, monthRate: null,
      yearPlan: null, yearActual: null, yearRate: null,
      yield: null, yieldTarget: null, yieldPrev: null,
      monthBatch: null, yearBatch: null,
      inventory: { carryOver: null, filled: null, shipped: null, total: null },
      dailyData: [],
      monthlyData: [],
      _parseNote: '셀 매핑 대기 중 — 파일 수령 후 자동 파싱 활성화',
    };
  });

  return {
    reportDate,
    products: PRODUCTS,
    byProduct,
    batches: [],
    stepLabels: STEP_LABELS,
    alerts: [],
    _source: path.basename(filePath),
    _sheet: sheetName,
    _parseNote: '실제 셀 매핑이 필요합니다. 관리자에게 문의하세요.',
  };
}

// ── settings 읽기 ────────────────────────────────────────────────
async function readProductionSettings(plant) {
  const rows = await readTable('settings', plant);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    filePath: map.productionFilePath || '',
    keywords: map.productionFileKeywords || '2공장,Daily,report',
  };
}

// ── GET /api/production/data ────────────────────────────────────
router.get(
  '/data',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.session.user;

    // 데모 계정: 하드코딩 더미 데이터 반환
    if (user.role === 'demo') {
      return res.json({ data: makeDemoData(), source: 'demo' });
    }

    // 일반 계정: 공유폴더 파싱
    const plant = user.plantScope === 'all' ? '1공장' : (user.plantScope || user.plant || '2공장');
    const { filePath, keywords } = await readProductionSettings(plant);

    if (!filePath) {
      return res.status(404).json({ error: '생산관리 파일 경로가 설정되지 않았습니다. 관리자 설정에서 경로를 입력해 주세요.' });
    }

    const found = findLatestFile(filePath, keywords);
    const data = parseProductionFile(found.full);
    res.json({ data, source: found.name, mtime: new Date(found.mtime).toISOString() });
  }),
);

// ── POST /api/production/test-path ──────────────────────────────
router.post(
  '/test-path',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const folderPath = (req.body.filePath || '').trim();
    const keywords = (req.body.keywords || '2공장,Daily,report').trim();
    if (!folderPath) throw badRequest('경로를 입력하세요.');
    if (!fs.existsSync(folderPath)) throw badRequest(`경로가 존재하지 않습니다: ${folderPath}`);
    if (!fs.statSync(folderPath).isDirectory()) throw badRequest('폴더 경로를 입력해 주세요.');
    const found = findLatestFile(folderPath, keywords);
    res.json({
      message: `${found.name} 감지 완료 (수정일: ${new Date(found.mtime).toLocaleString('ko-KR')})`,
      file: found.full,
    });
  }),
);

module.exports = router;
module.exports.findLatestFile = findLatestFile;
