'use strict';

const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler, str, num } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { readSettings } = require('./settings');
const { safetyStatus } = require('../lib/warnings');

const router = express.Router();
router.use(requireAuth, resolvePlant);

const ymd = (d) => d.toISOString().slice(0, 10);

// 기간 표현 해석 → {from, to, label} 또는 null
function parsePeriod(q) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = ymd(now);
  const monthLabel = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;

  if (/올해|금년/.test(q)) return { from: `${y}-01-01`, to: today, label: `${y}년` };
  if (/작년|전년/.test(q)) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `${y - 1}년` };
  if (/지난달|전월|저번달/.test(q)) {
    const s = new Date(Date.UTC(y, m - 1, 1));
    const e = new Date(Date.UTC(y, m, 0));
    return { from: ymd(s), to: ymd(e), label: monthLabel(s.getUTCFullYear(), s.getUTCMonth() + 1) };
  }
  if (/이번달|이달|금월|당월/.test(q)) return { from: `${monthLabel(y, m + 1)}-01`, to: today, label: monthLabel(y, m + 1) };
  if (/지난주|저번주/.test(q)) return weekRange(now, 1);
  if (/이번주|금주/.test(q)) {
    const w = weekRange(now, 0);
    return { from: w.from, to: today, label: '이번주' };
  }
  if (/어제|전일/.test(q)) {
    const d = new Date(now.getTime() - 86400000);
    return { from: ymd(d), to: ymd(d), label: '어제' };
  }
  if (/오늘|금일/.test(q)) return { from: today, to: today, label: '오늘' };
  const mo = q.match(/(\d{1,2})\s*월/);
  if (mo) {
    const mm = Number(mo[1]);
    const e = new Date(Date.UTC(y, mm, 0));
    return { from: `${monthLabel(y, mm)}-01`, to: ymd(e), label: monthLabel(y, mm) };
  }
  return null;
}
function weekRange(now, offset) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day - offset * 7);
  const e = new Date(d);
  e.setUTCDate(e.getUTCDate() + 6);
  return { from: ymd(d), to: ymd(e), label: offset === 0 ? '이번주' : '지난주' };
}

function inRange(dateStr, p) {
  if (!p) return true;
  const day = (dateStr || '').slice(0, 10);
  return day >= p.from && day <= p.to;
}

const CAN_STATUS = ['수령', '사용중', '사용완료', '세정의뢰', '사용금지'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    if (!q) return res.json({ query: q, answer: '검색어를 입력하세요.', table: null });

    const [items, raws, subs, canisters, txns, anomalies, settings] = await Promise.all([
      readTable('items', req.plant), readTable('raw_materials', req.plant), readTable('sub_materials', req.plant),
      readTable('canisters', req.plant), readTable('transactions', req.plant), readTable('anomalies', req.plant), readSettings(req.plant),
    ]);
    const threshold = num(settings.safetyRatioPercent) || 100;
    const period = parsePeriod(q);

    // 품목명 탐지(품목 마스터 + Lot에 등장한 이름 중 질의에 포함된 것, 가장 긴 매칭)
    const names = new Set([...items.map((i) => i.name), ...raws.map((r) => r.itemName), ...subs.map((s) => s.name)]);
    let mat = '';
    for (const n of names) if (n && q.includes(n) && n.length > mat.length) mat = n;
    const unitOf = (name) => {
      const it = items.find((i) => i.name === name);
      if (it) return it.unit;
      const rl = raws.find((r) => r.itemName === name);
      if (rl) return rl.unit;
      const sl = subs.find((s) => s.name === name);
      return sl ? sl.unit : '';
    };

    const wantOut = /사용|출고|소진|썼|쓴/.test(q);
    const wantIn = /입고|들어온|받은/.test(q);
    const wantStock = /재고|잔량|남은|남아/.test(q);
    const wantLow = /부족|미달|모자|안전재고/.test(q);
    const wantAnomaly = /이상|선입선출|오류/.test(q);
    const wantTx = /수불|내역|이력/.test(q);
    const canStatus = CAN_STATUS.find((s) => q.includes(s));
    const wantCan = /canister|캐니스터|용기/i.test(q) || !!canStatus;

    const periodTxt = period ? `${period.label} ` : '';

    // 1) 안전재고 부족
    if (wantLow && !mat) {
      const rows = [];
      const build = (cat, masters, lots, getName, getQty) => {
        for (const ms of masters) {
          const total = lots.filter((l) => getName(l) === ms.name).reduce((a, l) => a + (num(getQty(l)) || 0), 0);
          const st = safetyStatus(total, ms.safetyStock, threshold);
          if (st.below) rows.push([cat, ms.name, `${total.toLocaleString()}${ms.unit}`, `${Number(ms.safetyStock).toLocaleString()}${ms.unit}`, `${st.level}%`]);
        }
      };
      build('원재료', items.filter((i) => i.category === 'raw'), raws, (r) => r.itemName, (r) => r.quantity);
      build('부재료', items.filter((i) => i.category === 'sub'), subs, (s) => s.name, (s) => s.weight);
      return res.json({ query: q, answer: `안전재고 부족 품목: ${rows.length}건`, table: { headers: ['구분', '품목', '현재고', '최소재고', '안전%'], rows } });
    }

    // 2) Canister
    if (wantCan) {
      let list = canisters;
      if (canStatus) list = list.filter((c) => c.status === canStatus);
      if (mat) list = list.filter((c) => (c.content || '').includes(mat));
      const rows = list.map((c) => [c.canisterNo, c.size, c.content || '(비어있음)', Number(c.weight || 0).toLocaleString(), c.location, c.status]);
      return res.json({ query: q, answer: `Canister ${canStatus ? `'${canStatus}' ` : ''}${mat ? `'${mat}' ` : ''}: ${rows.length}개`, table: { headers: ['No', '사이즈', '내용물', '무게', '위치', '상태'], rows } });
    }

    // 3) 이상발생
    if (wantAnomaly) {
      const rows = anomalies.filter((a) => inRange(a.createdAt, period)).map((a) => [(a.createdAt || '').slice(0, 10), a.type, a.itemName, a.account]);
      return res.json({ query: q, answer: `${periodTxt}이상발생: ${rows.length}건`, table: { headers: ['일시', '내용', '품목', '계정'], rows } });
    }

    // 4) 사용량/입고량 (품목 + 동작)
    if (mat && (wantOut || wantIn) && !wantTx) {
      const type = wantIn ? '입고' : '출고';
      const list = txns.filter((t) => t.materialName === mat && t.type === type && inRange(t.createdAt, period));
      const sum = list.reduce((a, t) => a + (num(t.quantity) || 0), 0);
      const rows = list.map((t) => [(t.createdAt || '').slice(0, 16).replace('T', ' '), t.lotNo || t.content || '', `${Number(t.quantity).toLocaleString()}${t.unit || ''}`, t.createdBy]);
      return res.json({ query: q, answer: `${mat} · ${periodTxt}${wantIn ? '입고' : '사용'}량: ${sum.toLocaleString()}${unitOf(mat)} (${list.length}건)`, table: { headers: ['일시', 'Lot/내용물', '수량', '작성자'], rows } });
    }

    // 5) 현재고
    if (mat && (wantStock || (!wantTx && !wantOut && !wantIn))) {
      const rl = raws.filter((r) => r.itemName === mat && num(r.quantity) > 0);
      const sl = subs.filter((s) => s.name === mat && num(s.weight) > 0);
      if (rl.length || sl.length) {
        const lots = rl.length ? rl : sl;
        const qtyField = rl.length ? 'quantity' : 'weight';
        const total = lots.reduce((a, l) => a + (num(l[qtyField]) || 0), 0);
        const rows = lots.map((l) => [l.lotNo, `${Number(l[qtyField]).toLocaleString()}${l.unit}`, l.receivedDate || '-', l.vendor || '-']);
        return res.json({ query: q, answer: `${mat} 현재고: ${total.toLocaleString()}${unitOf(mat)} (Lot ${lots.length}개)`, table: { headers: ['Lot', '재고', '입고일', '업체'], rows } });
      }
    }

    // 6) 수불 내역
    if (wantTx || period || mat) {
      const list = txns.filter((t) => (!mat || t.materialName === mat) && inRange(t.createdAt, period))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
      const rows = list.map((t) => [(t.createdAt || '').slice(0, 16).replace('T', ' '), t.materialName, t.type, `${Number(t.quantity || 0).toLocaleString()}${t.unit || ''}`, t.createdBy]);
      return res.json({ query: q, answer: `${mat ? `'${mat}' ` : ''}${periodTxt}수불 내역: ${rows.length}건`, table: { headers: ['일시', '품목', '구분', '수량', '작성자'], rows } });
    }

    // 7) 폴백: 품목/이름 부분검색
    const hit = [...items].filter((i) => i.name.includes(q)).map((i) => [i.category === 'raw' ? '원재료' : '부재료', i.name, i.unit, i.product || '-']);
    return res.json({ query: q, answer: hit.length ? `'${q}' 관련 품목 ${hit.length}건` : `'${q}' 에 대한 결과를 찾지 못했어요. 예: "이번달 톨루엔 사용량", "부족 품목", "세정의뢰 Canister"`, table: hit.length ? { headers: ['구분', '품목', '단위', '제품'], rows: hit } : null });
  }),
);

module.exports = { router };
