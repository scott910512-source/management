'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, num, badRequest, sendCsv } = require('../lib/http');
const { requireAuth, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { appendTransaction } = require('../lib/tx');
const { appendAnomaly, findEarlierLot } = require('../lib/anomaly');
const { nextBatchNo, nextProductBatchNo, lookupBatch, ensureBatch, yearOf } = require('../lib/batch');

const router = express.Router();
router.use(requireAuth, resolvePlant);

// 원/부재료 테이블의 필드명 차이를 흡수 (raw: itemName·quantity / sub: name·weight)
const MAT = {
  raw: { table: 'raw_materials', nameKey: 'itemName', qtyKey: 'quantity' },
  sub: { table: 'sub_materials', nameKey: 'name', qtyKey: 'weight' },
};

// 특정 품목의 활성 Lot을 FIFO(입고일 오름차순) 정렬로 반환
function fifoLots(rows, cfg, name) {
  return rows
    .filter((r) => r[cfg.nameKey] === name && (num(r[cfg.qtyKey]) || 0) > 0)
    .sort((a, b) => (a.receivedDate === b.receivedDate ? a.lotNo.localeCompare(b.lotNo) : a.receivedDate < b.receivedDate ? -1 : 1));
}

// 출고 폼 컨텍스트 — 품목의 다음 Batch 번호 + 제품(사용처) 기본값
router.get(
  '/context',
  asyncHandler(async (req, res) => {
    const materialName = str(req.query.materialName);
    const category = str(req.query.category); // raw | sub
    const year = yearOf(str(req.query.date) || null);
    const next = materialName ? await nextBatchNo(req.plant, materialName, year) : 1;
    let product = '';
    if (materialName) {
      const items = await readTable('items', req.plant);
      const master = items.find((i) => i.category === category && i.name === materialName);
      product = master ? master.product || '' : '';
    }
    res.json({ nextNo: next, product, year });
  }),
);

// (제품, 번호) 배치 조회 — 존재 시 합성시작일 반환
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const product = str(req.query.product);
    const no = str(req.query.no);
    const year = yearOf(str(req.query.date) || null);
    if (!no) return res.json({ exists: false, startDate: '' });
    const batch = await lookupBatch(req.plant, product, no, year);
    res.json({ exists: !!batch, startDate: batch ? batch.startDate : '', year });
  }),
);

/**
 * 투입이력 — Batch별로 실제 투입된 원·부재료를 동적으로 나열.
 * 각 배치: { batchNo, product, year, startDate, materials: [{category, name, quantity, unit, lotNo}] }
 */
async function buildInputs(plant) {
  const [txns, batches] = await Promise.all([readTable('transactions', plant), readTable('batches', plant)]);
  const batchById = new Map(batches.map((b) => [b.id, b]));

  // batchId 기준 그룹
  const groups = new Map();
  for (const t of txns) {
    if (t.type !== '출고' || !t.batchId) continue;
    const b = batchById.get(t.batchId);
    if (!b) continue;
    if (!groups.has(t.batchId)) {
      groups.set(t.batchId, {
        batchId: t.batchId,
        batchNo: b.no,
        product: b.product || '',
        year: b.year,
        startDate: b.startDate || '',
        materials: new Map(), // key: name|lotNo
      });
    }
    const g = groups.get(t.batchId);
    const key = `${t.materialType}|${t.materialName}|${t.lotNo}`;
    if (!g.materials.has(key)) {
      g.materials.set(key, { category: t.materialType, name: t.materialName, lotNo: t.lotNo, unit: t.unit, quantity: 0 });
    }
    g.materials.get(key).quantity += num(t.quantity) || 0;
  }

  const list = Array.from(groups.values()).map((g) => ({
    batchId: g.batchId,
    batchNo: g.batchNo,
    product: g.product,
    year: g.year,
    startDate: g.startDate,
    materials: Array.from(g.materials.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category < b.category ? -1 : 1,
    ),
  }));
  // 최신 배치 우선(연도 desc, 번호 desc)
  list.sort((a, b) => {
    if (a.year !== b.year) return a.year < b.year ? 1 : -1;
    return Number(b.batchNo) - Number(a.batchNo);
  });
  return list;
}

router.get(
  '/inputs',
  asyncHandler(async (req, res) => {
    const items = await buildInputs(req.plant);
    res.json({ items });
  }),
);

// CSV — 배치×품목 1행으로 평면화(동적: 품목 수 제한 없음)
router.get(
  '/inputs/export',
  asyncHandler(async (req, res) => {
    const list = await buildInputs(req.plant);
    const headers = ['BatchNo', '제품', '합성시작일', '구분', '품목', '투입량', '단위', '투입Lot'];
    const rows = [];
    for (const g of list) {
      if (g.materials.length === 0) continue;
      for (const m of g.materials) {
        rows.push({
          BatchNo: `#${g.batchNo}`,
          제품: g.product,
          합성시작일: g.startDate,
          구분: m.category === 'raw' ? '원재료' : m.category === 'sub' ? '부재료' : m.category,
          품목: m.name,
          투입량: m.quantity,
          단위: m.unit,
          투입Lot: m.lotNo,
        });
      }
    }
    sendCsv(res, headers, rows, '원부재료투입이력');
  }),
);

// ===== 배치 일괄 처리 =====

// 제품(사용처)의 BOM 자재 + 현재 Lot 재고 + 다음 배치번호
router.get(
  '/bom-stock',
  asyncHandler(async (req, res) => {
    const product = str(req.query.product);
    if (!product) throw badRequest('제품(사용처)을 선택하세요.');
    const year = yearOf(str(req.query.date) || null);
    const [boms, items, raw, sub] = await Promise.all([
      readTable('boms', req.plant),
      readTable('items', req.plant),
      readTable('raw_materials', req.plant),
      readTable('sub_materials', req.plant),
    ]);
    const rowsByCat = { raw, sub };
    const lines = boms
      .filter((b) => b.product === product)
      .sort((a, b) => (a.category === b.category ? a.materialName.localeCompare(b.materialName) : a.category < b.category ? -1 : 1))
      .map((b) => {
        const cfg = MAT[b.category];
        // BOM의 materialName은 '품목그룹명' 또는 단일 '품목명' — 같은 그룹/이름의 모든 멤버(업체별 품목)를 선택지로 제공
        const memberItems = items.filter((i) => i.category === b.category && ((i.itemGroup || '').trim() === b.materialName || i.name === b.materialName));
        const grp = memberItems.length && (memberItems[0].itemGroup || '').trim() === b.materialName ? b.materialName : '';
        const master = memberItems[0];
        const buildMember = (mi) => {
          const lots = cfg ? fifoLots(rowsByCat[b.category], cfg, mi.name) : [];
          return {
            name: mi.name,
            vendor: mi.vendor || '',
            isDefault: mi.groupDefault === '1',
            stock: lots.reduce((s, r) => s + (num(r[cfg.qtyKey]) || 0), 0),
            oldestLot: lots[0] ? lots[0].lotNo : '',
            lots: lots.map((r) => ({ lotNo: r.lotNo, quantity: num(r[cfg.qtyKey]) || 0, receivedDate: r.receivedDate || '', unit: r.unit })),
          };
        };
        const members = (memberItems.length ? memberItems : [{ name: b.materialName, vendor: '', groupDefault: '' }]).map(buildMember);
        // 기본 선택: groupDefault 지정 멤버 → 없으면 BOM의 품목 → 없으면 첫 멤버
        const def = members.find((m) => m.isDefault) || members.find((m) => m.name === b.materialName) || members[0];
        return {
          category: b.category,
          name: b.materialName,        // 컬럼 식별자(BOM 기준 품목)
          group: grp || '',
          unit: master ? master.unit : (def && def.lots[0] && def.lots[0].unit) || '',
          qtyPerBatch: num(b.qtyPerBatch) || 0,
          members,                     // 그룹 내 선택 가능한 품목들
          defaultMember: def ? def.name : b.materialName,
          // 기본 멤버 기준 재고/Lot (UI 호환)
          stock: def ? def.stock : 0,
          oldestLot: def ? def.oldestLot : '',
          lots: def ? def.lots : [],
        };
      });
    res.json({ product, year, nextNo: await nextProductBatchNo(req.plant, product, year), materials: lines });
  }),
);

// 여러 배치를 한 번에 출고 처리 (BOM 자재별 FIFO 분배)
router.post(
  '/bulk',
  requireWrite,
  asyncHandler(async (req, res) => {
    const product = str(req.body.product);
    const startDate = str(req.body.startDate);
    const txDate = str(req.body.txDate) || startDate || null;
    const force = req.body.force === true || str(req.body.force) === '1';
    const batches = Array.isArray(req.body.batches) ? req.body.batches : [];
    if (!product) throw badRequest('제품(사용처)을 선택하세요.');
    if (batches.length === 0) throw badRequest('처리할 배치가 없습니다.');
    const me = req.session.user.id;
    const year = yearOf(txDate);

    const [raw, sub] = await Promise.all([readTable('raw_materials', req.plant), readTable('sub_materials', req.plant)]);
    const rowsByCat = { raw: raw.map((r) => ({ ...r })), sub: sub.map((r) => ({ ...r })) };
    const origByCat = { raw, sub }; // 선입선출 위반 판정용 원본 스냅샷

    // 1) 분배 계획 수립 — 기본 FIFO, lotNo 지정 시 해당 Lot 우선(혼합)
    const plan = []; // { category, lotId, lotNo, name, unit, qty, batchIdx }
    const need = new Map(); // cat|name → 부족량
    const violations = []; // 선입선출 위반(오래된 Lot 두고 다른 Lot 지정)
    for (let bi = 0; bi < batches.length; bi++) {
      const lines = Array.isArray(batches[bi].lines) ? batches[bi].lines : [];
      for (const ln of lines) {
        const qty = num(ln.quantity);
        if (!qty || qty <= 0) continue;
        const cfg = MAT[ln.category];
        if (!cfg) continue;
        // 지정 Lot 목록(다수 선택) — lotNos 배열 우선, 없으면 단일 lotNo, 둘 다 없으면 자동 FIFO
        const allowed = Array.isArray(ln.lotNos) && ln.lotNos.length ? ln.lotNos.map(String)
          : (str(ln.lotNo) ? [str(ln.lotNo)] : []);
        let remain = qty;

        if (allowed.length) {
          // (a) 선택한 Lot들 안에서만 FIFO 분배
          const lots = fifoLots(rowsByCat[ln.category], cfg, ln.name).filter((l) => allowed.includes(l.lotNo));
          for (const lot of lots) {
            if (remain <= 0) break;
            const avail = num(lot[cfg.qtyKey]) || 0;
            if (avail <= 0) continue;
            const take = Math.min(avail, remain);
            lot[cfg.qtyKey] = String(avail - take);
            plan.push({ category: ln.category, lotId: lot.id, lotNo: lot.lotNo, name: ln.name, unit: lot.unit, qty: take, batchIdx: bi });
            remain -= take;
          }
          // 선택 Lot보다 입고일이 빠른(오래된) 미선택 Lot이 남아있으면 선입선출 위반
          const activeLots = fifoLots(origByCat[ln.category], cfg, ln.name);
          const firstAllowed = activeLots.find((l) => allowed.includes(l.lotNo));
          const earlierNotPicked = activeLots.find((l) => !allowed.includes(l.lotNo) && firstAllowed && (l.receivedDate || '') < (firstAllowed.receivedDate || ''));
          if (firstAllowed && earlierNotPicked) {
            violations.push({ batchNo: str(batches[bi].no), category: ln.category, name: ln.name, chosenLot: firstAllowed.lotNo, chosenDate: firstAllowed.receivedDate || '', earliestLot: earlierNotPicked.lotNo, earliestDate: earlierNotPicked.receivedDate || '' });
          }
        } else {
          // (b) 자동 FIFO(오래된 Lot부터)
          const lots = fifoLots(rowsByCat[ln.category], cfg, ln.name);
          for (const lot of lots) {
            if (remain <= 0) break;
            const avail = num(lot[cfg.qtyKey]) || 0;
            if (avail <= 0) continue;
            const take = Math.min(avail, remain);
            lot[cfg.qtyKey] = String(avail - take);
            plan.push({ category: ln.category, lotId: lot.id, lotNo: lot.lotNo, name: ln.name, unit: lot.unit, qty: take, batchIdx: bi });
            remain -= take;
          }
        }
        if (remain > 0) need.set(`${ln.category}|${ln.name}`, (need.get(`${ln.category}|${ln.name}`) || 0) + remain);
      }
    }
    if (need.size > 0) {
      const msg = Array.from(need.entries()).map(([k, v]) => `${k.split('|')[1]} ${v} 부족`).join(', ');
      throw badRequest(`재고가 부족합니다: ${msg}`);
    }

    // 선입선출 위반이 있는데 강제(force)가 아니면 — 단일 출고와 동일하게 경고(409)
    if (violations.length > 0 && !force) {
      return res.status(409).json({
        fifoWarning: true,
        message: '선입선출 오류가 발생합니다. Lot 번호가 더 빠른 Lot이 존재합니다.',
        violations,
      });
    }

    // 2) 배치 생성(ensureBatch) — 번호별 batchId 확보
    const batchIds = [];
    const batchYears = [];
    for (let bi = 0; bi < batches.length; bi++) {
      const noRaw = str(batches[bi].no);
      const by = /^\d{4}$/.test(String(batches[bi].year)) ? String(batches[bi].year) : year;
      batchYears[bi] = by;
      const b = await ensureBatch(req.plant, { product, no: noRaw, year: by, startDate, user: me });
      batchIds[bi] = b.id;
    }

    // 3) 실제 Lot 차감 (카테고리별 1회 mutate)
    const decByCat = { raw: new Map(), sub: new Map() }; // lotId → 총 차감량
    for (const p of plan) {
      decByCat[p.category].set(p.lotId, (decByCat[p.category].get(p.lotId) || 0) + p.qty);
    }
    for (const cat of ['raw', 'sub']) {
      if (decByCat[cat].size === 0) continue;
      const cfg = MAT[cat];
      await mutate(cfg.table, req.plant, (rows) => {
        for (const [lotId, dec] of decByCat[cat]) {
          const r = rows.find((x) => x.id === lotId);
          if (!r) continue;
          const cur = num(r[cfg.qtyKey]) || 0;
          r[cfg.qtyKey] = String(Math.max(0, cur - dec));
          r.updatedBy = me;
        }
      });
    }

    // 4) 출고 트랜잭션 기록 (Lot별·배치별) — 차감 후 잔량 맵
    const afterByLot = {};
    for (const cat of ['raw', 'sub']) {
      const cfg = MAT[cat];
      const src = cat === 'raw' ? raw : sub;
      for (const r of src) {
        const dec = decByCat[cat].get(r.id) || 0;
        afterByLot[r.id] = Math.max(0, (num(r[cfg.qtyKey]) || 0) - dec);
      }
    }
    let txCount = 0;
    for (const p of plan) {
      const cfg = MAT[p.category];
      await appendTransaction({
        plant: req.plant, materialType: p.category, materialId: p.lotId, materialName: p.name, lotNo: p.lotNo,
        type: '출고', quantity: p.qty, unit: p.unit, balanceAfter: afterByLot[p.lotId],
        batchNo: str(batches[p.batchIdx].no), batchId: batchIds[p.batchIdx], note: '배치 일괄 처리', user: me, txDate,
      });
      txCount++;
    }

    // 5) 선입선출 위반(강제 처리) — 이상발생 기록 (단일 출고와 동일)
    for (const v of violations) {
      await appendAnomaly({
        plant: req.plant, type: '선입선출 오류', itemName: v.name,
        lotInfo: `${v.chosenLot}(입고 ${v.chosenDate || '-'}) — 더 빠른 Lot ${v.earliestLot}(${v.earliestDate}) 존재`,
        account: me, note: `배치 일괄 처리 #${v.batchNo} 강제 사용`,
      });
    }

    res.status(201).json({ ok: true, batches: batchIds.length, transactions: txCount, anomalies: violations.length });
  }),
);

module.exports = { router };
