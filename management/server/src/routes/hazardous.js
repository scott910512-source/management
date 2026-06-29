'use strict';
const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, num, badRequest } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

const isIn = (t) => t === '입고' || t === '반입';

/**
 * 품목별 일자별 대장 + 월별 요약을 계산한다.
 * - 수불(transactions)에서 일자별 입고/출하 자동 집계
 * - hazardous_ledger(수동 입력/정정)가 있으면 해당 일자를 덮어씀
 * - 잔량 = 이월 + 입고 - 출하 (잔량 수동값이 있으면 그 값으로 고정, 이후 이월에 반영)
 */
async function buildLedger(plant, year) {
  const [items, raws, subs, txns, manual] = await Promise.all([
    readTable('items', plant),
    readTable('raw_materials', plant),
    readTable('sub_materials', plant),
    readTable('transactions', plant),
    readTable('hazardous_ledger', plant),
  ]);
  // 유해물질 품목 → 그룹명(미설정 시 품목명 자체가 그룹). 업체가 달라 품목이 나뉘어도 그룹으로 합산.
  const hazItems = items.filter((i) => i.hazardous === '1');
  const groupOf = {}; // 품목명 → 그룹명
  const unitOf = {};  // 그룹명 → 단위
  const memberNames = {}; // 그룹명 → [품목명...]
  for (const i of hazItems) {
    const g = (i.itemGroup && i.itemGroup.trim()) || i.name;
    groupOf[i.name] = g;
    if (!unitOf[g]) unitOf[g] = i.unit;
    (memberNames[g] = memberNames[g] || []).push(i.name);
  }
  const hazNames = Object.keys(memberNames).sort(); // 그룹명 목록
  if (hazNames.length === 0) return { hazardousItems: [], byItem: {} };

  const lotName = new Map();
  for (const r of raws) lotName.set(r.id, r.itemName);
  for (const s of subs) lotName.set(s.id, s.name);

  const yearStr = String(year);
  // 품목 → 일자 → {in,out}
  const auto = {};
  for (const t of txns) {
    const name = lotName.get(t.materialId);
    const g = name && groupOf[name];
    if (!g) continue;
    const day = (t.createdAt || '').slice(0, 10);
    if (!day.startsWith(yearStr)) continue;
    (auto[g] = auto[g] || {});
    const cell = (auto[g][day] = auto[g][day] || { in: 0, out: 0 });
    const q = num(t.quantity) || 0;
    if (isIn(t.type)) cell.in += q; else cell.out += q;
  }
  // 수동 입력 → 품목 → 일자 → override
  const man = {};
  for (const m of manual) {
    if (!hazNames.includes(m.itemName)) continue;
    if (!(m.date || '').startsWith(yearStr)) continue;
    (man[m.itemName] = man[m.itemName] || {})[m.date] = m;
  }

  const byItem = {};
  for (const name of hazNames) {
    const dates = new Set([...Object.keys(auto[name] || {}), ...Object.keys(man[name] || {})]);
    const sorted = [...dates].sort();
    let running = 0;
    const days = [];
    for (const date of sorted) {
      const a = (auto[name] && auto[name][date]) || { in: 0, out: 0 };
      const o = man[name] && man[name][date];
      const carryOver = running;
      let inQty = a.in;
      let outQty = a.out;
      if (o) {
        if (o.inQty !== '' && o.inQty != null) inQty = num(o.inQty) || 0;
        if (o.outQty !== '' && o.outQty != null) outQty = num(o.outQty) || 0;
      }
      let balance = carryOver + inQty - outQty;
      if (o && o.balance !== '' && o.balance != null) balance = num(o.balance) || 0;
      running = balance;
      days.push({ date, carryOver, inQty, outQty, balance, note: o ? (o.note || '') : '', edited: !!o });
    }
    // 월별 요약 (1~12월, 활동 없는 달도 이월 표시)
    const months = [];
    let monthCarry = 0;
    for (let m = 1; m <= 12; m++) {
      const mm = `${yearStr}-${String(m).padStart(2, '0')}`;
      const md = days.filter((d) => d.date.startsWith(mm));
      const inSum = md.reduce((s, d) => s + d.inQty, 0);
      const outSum = md.reduce((s, d) => s + d.outQty, 0);
      const carryIn = md.length ? md[0].carryOver : monthCarry;
      const balance = md.length ? md[md.length - 1].balance : carryIn;
      monthCarry = balance;
      months.push({ month: mm, carryIn, inQty: inSum, outQty: outSum, balance, dayCount: md.length });
    }
    byItem[name] = { unit: unitOf[name] || '', months, days };
  }
  return { hazardousItems: hazNames, byItem };
}

router.get('/', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await buildLedger(req.plant, year);
  res.json({ year, ...data });
}));

// 일자별 수동 입력/정정 (덮어쓰기 upsert)
router.post('/entry', requireWrite, asyncHandler(async (req, res) => {
  const itemName = str(req.body.itemName);
  const date = str(req.body.date);
  if (!itemName) throw badRequest('품목을 선택하세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('날짜(YYYY-MM-DD)를 입력하세요.');
  const me = req.session.user.id;
  const pick = (k) => (req.body[k] === undefined || req.body[k] === null ? '' : String(req.body[k]));
  const item = await mutate('hazardous_ledger', req.plant, (rows) => {
    let r = rows.find((x) => x.itemName === itemName && x.date === date);
    if (!r) { r = { id: newId('hl'), itemName, date }; rows.push(r); }
    r.inQty = pick('inQty');
    r.outQty = pick('outQty');
    r.balance = pick('balance');
    r.carryOver = pick('carryOver');
    r.note = str(req.body.note);
    r.updatedBy = me;
    r.updatedAt = now();
    return r;
  });
  res.json({ ok: true, item });
}));

// 수동 입력 삭제 (자동집계로 환원)
router.delete('/entry', requireWrite, asyncHandler(async (req, res) => {
  const itemName = str(req.query.itemName);
  const date = str(req.query.date);
  await mutate('hazardous_ledger', req.plant, (rows) => {
    const idx = rows.findIndex((x) => x.itemName === itemName && x.date === date);
    if (idx >= 0) rows.splice(idx, 1);
  });
  res.json({ ok: true });
}));

module.exports = { router };
