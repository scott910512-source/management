'use strict';

const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler, num } = require('../lib/http');
const { now } = require('../lib/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { readSettings } = require('./settings');
const { safetyStatus, parseSizeMaxKg, CANISTER_WARN_RATIO } = require('../lib/warnings');

const router = express.Router();
router.use(requireAuth, resolvePlant, requireAdmin);

// 월간 관리현황 보고서 — 실제 수치 집계(관리자 전용)
router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const nowStr = now();
    const curY = Number(nowStr.slice(0, 4));
    const curM = Number(nowStr.slice(5, 7));
    const year = Number(req.query.year) || curY;
    const month = Number(req.query.month) || curM;
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const inMonth = (d) => (d || '').slice(0, 7) === ym;
    const today = nowStr.slice(0, 10);

    const [items, raws, subs, txns, canisters, batches, boms, anomalies, tasks, slog, settings] = await Promise.all([
      readTable('items', req.plant), readTable('raw_materials', req.plant), readTable('sub_materials', req.plant),
      readTable('transactions', req.plant), readTable('canisters', req.plant), readTable('batches', req.plant),
      readTable('boms', req.plant), readTable('anomalies', req.plant), readTable('tasks', req.plant),
      readTable('settings_log', req.plant), readSettings(req.plant),
    ]);

    const threshold = num(settings.safetyRatioPercent) || 100;
    const maxMap = parseSizeMaxKg(settings.canisterSizeMaxKg);

    const lotName = new Map();
    for (const r of raws) lotName.set(r.id, r.itemName);
    for (const s of subs) lotName.set(s.id, s.name);
    const curTotal = (cat, name) => (cat === 'raw'
      ? raws.filter((r) => r.itemName === name).reduce((s, r) => s + (num(r.quantity) || 0), 0)
      : subs.filter((r) => r.name === name).reduce((s, r) => s + (num(r.weight) || 0), 0));

    // ===== 수불 흐름 =====
    const monthTx = txns.filter((t) => inMonth(t.createdAt));
    const matTx = monthTx.filter((t) => t.materialType === 'raw' || t.materialType === 'sub');
    const inSum = matTx.filter((t) => t.type === '입고').reduce((s, t) => s + (num(t.quantity) || 0), 0);
    const outSum = matTx.filter((t) => t.type === '출고').reduce((s, t) => s + (num(t.quantity) || 0), 0);
    const flowMap = {};
    for (const t of matTx) {
      const k = t.materialName;
      if (!flowMap[k]) flowMap[k] = { name: k, unit: t.unit, inQ: 0, outQ: 0 };
      if (t.type === '입고') flowMap[k].inQ += num(t.quantity) || 0;
      else if (t.type === '출고') flowMap[k].outQ += num(t.quantity) || 0;
    }
    const flowItems = Object.values(flowMap).map((g) => ({ ...g, net: g.inQ - g.outQ })).sort((a, b) => (b.inQ + b.outQ) - (a.inQ + a.outQ));

    // ===== 재고 건전성(현재 스냅샷) — 부족/임박만 =====
    const stockHealth = [];
    for (const m of items) {
      const safety = num(m.safetyStock) || 0;
      if (safety <= 0) continue;
      const total = curTotal(m.category, m.name);
      const th = (m.warningPct && num(m.warningPct) > 0) ? num(m.warningPct) : threshold;
      const st = safetyStatus(total, safety, th);
      if (st.below || st.state === '임박') {
        stockHealth.push({ name: m.name, category: m.category, product: m.product || '', unit: m.unit, current: total, safety, level: st.level, state: st.state });
      }
    }
    stockHealth.sort((a, b) => (a.level || 0) - (b.level || 0));

    // ===== 재고 현황(제품군/품목별 종합) — 보고서 최상단 =====
    const allNames = new Set([...items.map((i) => i.name), ...raws.map((r) => r.itemName), ...subs.map((s) => s.name)]);
    const inventory = [];
    for (const name of allNames) {
      const master = items.find((i) => i.name === name);
      const category = master ? master.category : (raws.some((r) => r.itemName === name) ? 'raw' : 'sub');
      const unit = master ? master.unit : ((raws.find((r) => r.itemName === name) || {}).unit || (subs.find((s) => s.name === name) || {}).unit || '');
      const product = (master && master.product) ? master.product : '(제품 미지정)';
      const flow = flowMap[name] || { inQ: 0, outQ: 0 };
      const current = curTotal(category, name);
      const safety = master ? (num(master.safetyStock) || 0) : 0;
      const th = (master && master.warningPct && num(master.warningPct) > 0) ? num(master.warningPct) : threshold;
      const st = safety > 0 ? safetyStatus(current, safety, th) : { level: null, state: '-', below: false };
      const isHaz = !!(master && master.hazardous === '1');
      const hazMax = isHaz ? (num(master.hazardousMaxQty) || 0) : 0;
      const hazWarnPct = (isHaz && master.hazardousWarnPct && num(master.hazardousWarnPct) > 0) ? num(master.hazardousWarnPct) : 80;
      const hazPct = hazMax > 0 ? Math.round((current / hazMax) * 100) : null;
      const hazOver = hazMax > 0 && hazPct >= hazWarnPct;
      inventory.push({
        product, name, category, unit,
        monthIn: flow.inQ, monthOut: flow.outQ, net: flow.inQ - flow.outQ,
        current, safety, level: st.level, safetyState: st.state, below: st.below,
        hazardous: isHaz, hazMax, hazPct, hazOver,
      });
    }
    inventory.sort((a, b) => (a.product === b.product ? a.name.localeCompare(b.name) : a.product.localeCompare(b.product)));

    // ===== 유해화학물질 =====
    const hazardous = items.filter((i) => i.hazardous === '1').map((h) => {
      const tx = monthTx.filter((t) => lotName.get(t.materialId) === h.name);
      const mIn = tx.filter((t) => t.type === '입고').reduce((s, t) => s + (num(t.quantity) || 0), 0);
      const mOut = tx.filter((t) => t.type === '출고').reduce((s, t) => s + (num(t.quantity) || 0), 0);
      const cur = curTotal(h.category, h.name);
      const maxQ = num(h.hazardousMaxQty) || 0;
      const pct = maxQ > 0 ? Math.round((cur / maxQ) * 100) : null;
      return { name: h.name, unit: h.unit, monthIn: mIn, monthOut: mOut, current: cur, maxQty: maxQ, pct, over: maxQ > 0 && cur >= maxQ * 0.9 };
    });

    // ===== Canister =====
    const disp = (v, etc) => (v === '기타' ? (etc || '기타') : v);
    const canByStatus = {};
    for (const c of canisters) { const s = disp(c.status, c.statusEtc); canByStatus[s] = (canByStatus[s] || 0) + 1; }
    const canRisk = canisters
      .filter((c) => { const mx = maxMap[c.size]; return mx && (num(c.weight) || 0) >= mx * CANISTER_WARN_RATIO; })
      .map((c) => ({ canisterNo: c.canisterNo, size: c.size, content: c.content, weight: num(c.weight) || 0, maxKg: maxMap[c.size], pct: Math.round(((num(c.weight) || 0) / maxMap[c.size]) * 100) }));

    // ===== 이상발생 / FIFO =====
    const monthAnom = anomalies.filter((a) => inMonth(a.createdAt));
    const fifoForced = monthAnom.filter((a) => a.type === '선입선출 오류').length;
    const anomList = monthAnom.map((a) => ({ date: (a.createdAt || '').slice(0, 10), type: a.type, itemName: a.itemName, account: a.account, note: a.note || '', lotInfo: a.lotInfo || '' }));

    // ===== Task =====
    const taskByStatus = {};
    for (const t of tasks) taskByStatus[t.status] = (taskByStatus[t.status] || 0) + 1;
    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== '완료')
      .map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate, assignee: t.assignee, status: t.status }));
    const highOverdue = overdue.filter((t) => t.priority === '상').length;
    const monthDone = tasks.filter((t) => t.status === '완료' && inMonth(t.updatedAt)).length;

    // ===== 제품별 Batch 투입 — BOM 대비(월간) =====
    const batchById = new Map(batches.map((b) => [b.id, b]));
    const bomMap = {};
    for (const b of boms) bomMap[`${b.product}|${b.category}|${b.materialName}`] = num(b.qtyPerBatch) || 0;
    const monthBatches = batches.filter((b) => inMonth(b.createdAt));
    const batchCountByProduct = {};
    for (const b of monthBatches) batchCountByProduct[b.product] = (batchCountByProduct[b.product] || 0) + 1;
    const vmap = {};
    let batchTxCount = 0;
    for (const t of monthTx) {
      if (t.type !== '출고' || !t.batchId) continue;
      const b = batchById.get(t.batchId);
      if (!b) continue;
      batchTxCount++;
      const key = `${b.product}|${t.materialType}|${t.materialName}`;
      if (!vmap[key]) vmap[key] = { product: b.product, category: t.materialType, materialName: t.materialName, actual: 0, unit: t.unit };
      vmap[key].actual += num(t.quantity) || 0;
    }
    const bomVariance = Object.values(vmap).map((g) => {
      const std = bomMap[`${g.product}|${g.category}|${g.materialName}`];
      const cnt = batchCountByProduct[g.product] || 0;
      const expected = std != null && cnt > 0 ? std * cnt : null;
      const variancePct = expected && expected > 0 ? Math.round((g.actual / expected - 1) * 100) : null;
      return { ...g, bom: std != null ? std : null, batches: cnt, expected, variancePct };
    });

    // ===== 정합성(현재고 vs 수불 합산) =====
    const txMap = {};
    for (const t of txns) {
      const q = num(t.quantity) || 0;
      if (!txMap[t.materialId]) txMap[t.materialId] = 0;
      txMap[t.materialId] += ['입고', '반입'].includes(t.type) ? q : -q;
    }
    const mismatch = [];
    let noTxLots = 0;
    const checkLot = (lot, type, name, curQ) => {
      const txc = txns.filter((t) => t.materialId === lot.id).length;
      if (txc === 0) { noTxLots++; return; }
      const diff = curQ - (txMap[lot.id] || 0);
      if (Math.abs(diff) > 0.001) mismatch.push({ type, name, lotNo: lot.lotNo, current: curQ, calculated: Math.round((txMap[lot.id] || 0) * 1000) / 1000, diff: Math.round(diff * 1000) / 1000, unit: lot.unit });
    };
    for (const lot of raws) checkLot(lot, '원재료', lot.itemName, num(lot.quantity) || 0);
    for (const lot of subs) checkLot(lot, '부재료', lot.name, num(lot.weight) || 0);

    // ===== 변경·감사 이력 =====
    const changes = slog.filter((s) => inMonth(s.createdAt))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((s) => ({ key: s.key, old: s.oldValue, nv: s.newValue, by: s.changedBy, date: (s.createdAt || '').slice(0, 16).replace('T', ' ') }));

    // ===== 경영 요약 KPI =====
    const kpi = {
      safetyShort: stockHealth.filter((s) => s.state === '부족').length,
      safetyNear: stockHealth.filter((s) => s.state === '임박').length,
      fifoForced,
      mismatch: mismatch.length,
      hazOver: hazardous.filter((h) => h.pct != null && h.pct >= 100).length,
      hazNear: hazardous.filter((h) => h.pct != null && h.pct >= 80 && h.pct < 100).length,
      highOverdue,
      overdue: overdue.length,
      monthIn: inSum, monthOut: outSum, net: inSum - outSum,
      canisterRisk: canRisk.length,
      monthDone,
      batchCount: monthBatches.length,
    };

    // ===== 이번 달 핵심 3가지 (자동 선별) =====
    const highlights = [];
    if (fifoForced > 0) highlights.push({ level: 'danger', title: 'FIFO 강제출고 발생', detail: `${fifoForced}건 — 선입선출 위반(품질·규제 직결). 원인 점검 필요.` });
    for (const s of stockHealth.filter((x) => x.state === '부족').slice(0, 2)) highlights.push({ level: 'danger', title: `안전재고 부족: ${s.name}`, detail: `현재 ${s.current.toLocaleString()}${s.unit} (${s.level}%) — 발주 필요.` });
    for (const h of hazardous.filter((x) => x.pct != null && x.pct >= 100).slice(0, 1)) highlights.push({ level: 'danger', title: `유해물질 보관한도 초과: ${h.name}`, detail: `${h.pct}% (보관가능 ${h.maxQty.toLocaleString()}${h.unit}) — 즉시 조치.` });
    if (mismatch.length > 0) highlights.push({ level: 'warn', title: '재고 정합성 불일치', detail: `${mismatch.length}건 — 장부 신뢰도 점검 필요.` });
    if (highOverdue > 0) highlights.push({ level: 'warn', title: '고우선순위 지연 업무', detail: `${highOverdue}건 — 현장 실행력 점검.` });
    const top3 = highlights.slice(0, 3);

    res.json({
      meta: { plant: req.plant, year, month, ym, generatedAt: nowStr, isCurrentMonth: year === curY && month === curM },
      kpi, top3,
      inventory,
      flow: { inSum, outSum, net: inSum - outSum, byItem: flowItems },
      stockHealth,
      hazardous,
      canister: { total: canisters.length, byStatus: canByStatus, risk: canRisk },
      anomaly: { count: monthAnom.length, fifoForced, list: anomList },
      task: { byStatus: taskByStatus, overdue, highOverdue, monthDone },
      bom: { batchCount: monthBatches.length, batchTxCount, variance: bomVariance },
      mismatch,
      changes,
      limits: {
        noTxLots,
        hazardousTracked: hazardous.length,
        singleMonthNote: '월 귀속은 기록 시각(서버 시각) 기준. 추세(전월 대비)는 다월 누적 후 유효.',
      },
    });
  }),
);

module.exports = { router };
