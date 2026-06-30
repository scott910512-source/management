'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { asyncHandler, badRequest } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { readTable } = require('../lib/store');
const { parseCsvGrid } = require('../lib/csv');

const router = express.Router();

// ── 데모 더미 데이터 ────────────────────────────────────────────
const DEMO_COLORS = { 'Alpha-X': '#4a90d9', 'Beta-7': '#e67e22', 'GammaS': '#27ae60', 'Delta-P': '#c0a800' };

function makeDemoData() {
  const products = ['Alpha-X', 'Beta-7', 'GammaS', 'Delta-P'];
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
      'Alpha-X': {
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
      'Beta-7': {
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
      'GammaS': {
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
      'Delta-P': {
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
      { no: '#200', product: 'Alpha-X', steps: ['done','done','done','active','wait','wait','wait'] },
      { no: '#199', product: 'Beta-7', steps: ['done','done','done','done','active','wait','wait'] },
      { no: '#RE11', product: 'Delta-P', steps: ['done','done','done','done','done','done','active'] },
    ],
    stepLabels: ['R', 'F', 'D1', 'D2', 'D3', 'FS', 'Fill'],
    alerts: [
      { level: 'error', product: 'Beta-7',  batchNo: '#199', yield: 63.2, target: 70, date: '2026-06-27', step: 'Distillation No.2' },
      { level: 'warn',  product: 'Alpha-X', batchNo: '#196', yield: 68.5, target: 70, date: '2026-06-24', step: 'Final Storage' },
      { level: 'ok',    product: 'GammaS',  batchNo: '#198', yield: 85.1, target: 78, date: '2026-06-28', step: '' },
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
  const best = matched[0];
  best.candidates = matched.map((m) => m.name);
  return best;
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

  // 최신 날짜 시트 찾기 (예: "6월 29일", "6월29일", "6월 29일(목)")
  // 전각/일반 공백 정규화 후, 날짜로 "시작"하는 시트를 인식 (요일·접미사 허용)
  const normSheet = (n) => String(n).replace(/[　 ]/g, ' ').trim();
  const dateSheetRe = /^\s*\d{1,2}\s*월\s*\d{1,2}\s*일/;
  const dateSheets = wb.SheetNames.filter((n) => dateSheetRe.test(normSheet(n)));
  if (!dateSheets.length) {
    throw new Error(`날짜 시트(예: 6월 29일)를 찾을 수 없습니다. 읽은 파일: ${path.basename(filePath)} | 시트 목록: [${wb.SheetNames.join(' | ')}]`);
  }
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

// ── 보안 엑셀 → CSV(평문) 파싱 ────────────────────────────────────
// 회사 IRM 보안으로 xlsx를 직접 못 읽으므로, 사용자 PC의 추출 스크립트가
// 만든 daily-latest.csv(최신 날짜 시트)를 셀 좌표로 읽는다.
//
// 열 매핑(0기반 인덱스) — 현장 양식 기준:
//   B(1)=제품 | E(4)=일생산량 | H(7)/K(10)/N(13)=6월 계획/실적/달성율
//   Q(16)/T(19)/W(22)=연간 계획/실적/달성율
//   재고량(AA(26) 라벨): AB(27)이월재고(can) AD(29)충진kg AF(31)충진can
//   AH(33)출하kg AJ(35)출하can AL(37)현재고kg AN(39)현재고can
const DCOL = { B: 1, E: 4, H: 7, K: 10, N: 13, Q: 16, T: 19, W: 22, AA: 26, AB: 27, AD: 29, AF: 31, AH: 33, AJ: 35, AL: 37, AN: 39 };
const CARD_PRODUCTS = ['CpHf', '3DMAS', 'SP17', 'Ynfinity']; // ACP-3 제외(고정수율)
const CARD_COLORS = { CpHf: '#4a90d9', '3DMAS': '#e67e22', SP17: '#27ae60', Ynfinity: '#c0a800' };

function dNorm(s) { return String(s == null ? '' : s).replace(/[　 ]/g, ' ').trim(); }
function dCell(grid, r, c) { return (r >= 0 && grid[r] && grid[r][c] != null) ? grid[r][c] : ''; }
function dNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function dPct(v) { const n = dNum(v); return n == null ? null : Math.round(n * 1000) / 10; } // 0.88→88.0
function dFindRow(grid, col, label) {
  const want = dNorm(label);
  for (let r = 0; r < grid.length; r++) if (dNorm(dCell(grid, r, col)) === want) return r;
  return -1;
}

function parseDailyCsv(text) {
  const grid = parseCsvGrid(text);

  // 보고일자: 표 어딘가의 "N월 N일" 패턴 셀에서 추출
  let reportDate = '';
  const dateRe = /\d{1,2}\s*월\s*\d{1,2}\s*일/;
  outer:
  for (const row of grid) {
    for (const c of row) {
      const m = dNorm(c).match(dateRe);
      if (m) { reportDate = m[0].replace(/\s/g, ''); break outer; }
    }
  }

  const byProduct = {};
  for (const p of CARD_PRODUCTS) {
    const pr = dFindRow(grid, DCOL.B, p);   // 생산량 행 (재고도 같은 행 우측)
    const yr = pr >= 0 ? pr + 1 : -1;       // 바로 아래 Yield(%) 행
    const g = (r, c) => dCell(grid, r, c);

    byProduct[p] = {
      color: CARD_COLORS[p] || '#888',
      todayQty: dNum(g(pr, DCOL.E)),
      prevDayQty: null,
      monthPlan: dNum(g(pr, DCOL.H)),
      monthActual: dNum(g(pr, DCOL.K)),
      monthRate: dPct(g(pr, DCOL.N)),
      yearPlan: dNum(g(pr, DCOL.Q)),
      yearActual: dNum(g(pr, DCOL.T)),
      yearRate: dPct(g(pr, DCOL.W)),
      // 수율: 월 실적(K) 기준 + 년 실적(T) 병행 (목표=계획 H/Q)
      yield: dPct(g(yr, DCOL.K)),
      yieldTarget: dPct(g(yr, DCOL.H)),
      yieldPrev: null,
      yearYield: dPct(g(yr, DCOL.T)),
      yearYieldTarget: dPct(g(yr, DCOL.Q)),
      monthBatch: null,
      yearBatch: null,
      // 재고(캔): 충전완료 AF · 출하 AJ · 잔여수량 AN (제품 행 우측)
      inventory: {
        carryOver: dNum(g(pr, DCOL.AB)),
        filled: dNum(g(pr, DCOL.AF)),
        shipped: dNum(g(pr, DCOL.AJ)),
        total: dNum(g(pr, DCOL.AN)),
        remainingMonths: null,   // /data 에서 기준정보(연간계획)로 계산
      },
      dailyData: [],
      monthlyData: [],
    };
  }

  return { reportDate, products: CARD_PRODUCTS, byProduct, batches: [], stepLabels: STEP_LABELS, alerts: [] };
}

// ── settings 읽기 ────────────────────────────────────────────────
async function readProductionSettings(plant) {
  const rows = await readTable('settings', plant);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    filePath: map.productionFilePath || '',
    keywords: map.productionFileKeywords || 'Daily,report',
    invConfig: map.prodInvConfig || '',
  };
}

// 기준정보(품목별 연간계획)로 잔여 개월수 계산 후 재고에 병합한다.
// invConfig = JSON: { "<제품>": { annualPlan: 숫자, monthlyUse?: 숫자(수동) } }
function applyInventoryConfig(data, invConfigStr) {
  let cfg = {};
  try { cfg = invConfigStr ? JSON.parse(invConfigStr) : {}; } catch { cfg = {}; }
  for (const p of data.products) {
    const inv = data.byProduct[p] && data.byProduct[p].inventory;
    if (!inv) continue;
    const c = cfg[p] || {};
    const annualPlan = Number(c.annualPlan);
    const monthlyUse = (c.monthlyUse !== undefined && c.monthlyUse !== null && c.monthlyUse !== '')
      ? Number(c.monthlyUse)
      : (Number.isFinite(annualPlan) ? annualPlan / 12 : null);
    inv.annualPlan = Number.isFinite(annualPlan) ? annualPlan : null;
    inv.monthlyUse = Number.isFinite(monthlyUse) ? Math.round(monthlyUse * 10) / 10 : null;
    inv.remainingMonths = (Number.isFinite(monthlyUse) && monthlyUse > 0 && inv.total != null)
      ? Math.round((inv.total / monthlyUse) * 10) / 10
      : null;
  }
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

    // 공장 결정: plantScope=all 이면 쿼리 파라미터 허용, 없으면 소속 공장
    let plant;
    if (user.plantScope === 'all') {
      const requested = (req.query.plant || '').trim();
      plant = ['1공장', '2공장'].includes(requested) ? requested : '1공장';
    } else {
      plant = user.plantScope || user.plant || '2공장';
    }

    const { filePath, invConfig } = await readProductionSettings(plant);

    if (!filePath) {
      return res.status(404).json({ error: `[${plant}] 생산관리 폴더 경로가 설정되지 않았습니다. 관리자 설정에서 경로를 입력해 주세요.` });
    }

    // 추출 스크립트가 생성하는 평문 CSV를 읽는다.
    const csvPath = path.join(filePath, 'daily-latest.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: `[${plant}] daily-latest.csv 를 찾을 수 없습니다. 추출 스크립트(export-daily-report-csv.ps1)가 '${filePath}' 폴더에 CSV를 생성했는지 확인하세요.` });
    }

    let data;
    try {
      data = parseDailyCsv(fs.readFileSync(csvPath, 'utf8'));
    } catch (e) {
      e.message = `종합현황 CSV 파싱 실패: ${e.message}`;
      throw e;
    }
    applyInventoryConfig(data, invConfig);
    const st = fs.statSync(csvPath);
    res.json({ data, source: 'daily-latest.csv', mtime: new Date(st.mtimeMs).toISOString(), plant });
  }),
);

// ── POST /api/production/test-path ──────────────────────────────
router.post(
  '/test-path',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const folderPath = (req.body.filePath || '').trim();
    if (!folderPath) throw badRequest('경로를 입력하세요.');
    if (!fs.existsSync(folderPath)) throw badRequest(`경로가 존재하지 않습니다: ${folderPath}`);
    if (!fs.statSync(folderPath).isDirectory()) throw badRequest('폴더 경로를 입력해 주세요.');

    const csvPath = path.join(folderPath, 'daily-latest.csv');
    if (!fs.existsSync(csvPath)) {
      throw badRequest(`이 폴더에 daily-latest.csv 가 없습니다. 추출 스크립트가 CSV를 생성하는 폴더를 지정하세요: ${folderPath}`);
    }
    const st = fs.statSync(csvPath);
    const data = parseDailyCsv(fs.readFileSync(csvPath, 'utf8'));
    const found = CARD_PRODUCTS.filter((p) => data.byProduct[p] && data.byProduct[p].monthActual != null);
    res.json({
      message: `daily-latest.csv 감지 완료 (보고일: ${data.reportDate || '?'}, 인식 품목: ${found.length ? found.join(', ') : '없음 — 열 매핑 확인 필요'}, 수정일: ${new Date(st.mtimeMs).toLocaleString('ko-KR')})`,
      file: csvPath,
    });
  }),
);

module.exports = router;
module.exports.findLatestFile = findLatestFile;
