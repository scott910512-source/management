'use strict';

const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler, num } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { readSettings } = require('./settings');
const { safetyStatus } = require('../lib/warnings');

const router = express.Router();
router.use(requireAuth, resolvePlant);

function disp(value, etc) {
  return value === '기타' ? (etc || '기타') : value;
}

/** 품목별 현황(잔여 Lot 수/현재고/최소재고/안전%/상태) */
function buildSummary(masters, rows, getName, getQty, threshold) {
  const names = new Set([...masters.map((m) => m.name), ...rows.map(getName)]);
  return Array.from(names).map((name) => {
    const master = masters.find((m) => m.name === name);
    const lots = rows.filter((r) => getName(r) === name && (num(getQty(r)) || 0) > 0);
    const current = lots.reduce((s, r) => s + (num(getQty(r)) || 0), 0);
    const minStock = master ? num(master.safetyStock) || 0 : 0;
    const unit = master ? master.unit : (lots[0] && lots[0].unit) || '';
    const st = safetyStatus(current, minStock, threshold);
    const product = master ? master.product || '' : '';
    return { name, product, lots: lots.length, current, unit, minStock, level: st.level, state: st.state, below: st.below, isMaster: !!master };
  }).sort((a, b) => {
    // 제품(사용처)별 묶음 → '공통'/미지정은 뒤로, 같은 제품 내 품목명순
    const pa = a.product || '~';
    const pb = b.product || '~';
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, raws, subs, canisters, settings] = await Promise.all([
      readTable('items', req.plant), readTable('raw_materials', req.plant), readTable('sub_materials', req.plant), readTable('canisters', req.plant), readSettings(req.plant),
    ]);
    const threshold = num(settings.safetyRatioPercent) || 100;

    const rawSummary = buildSummary(items.filter((i) => i.category === 'raw'), raws, (r) => r.itemName, (r) => r.quantity, threshold);
    const subSummary = buildSummary(items.filter((i) => i.category === 'sub'), subs, (r) => r.name, (r) => r.weight, threshold);

    // Canister 현황: (사용제품, 종류) 그룹
    const cmap = new Map();
    for (const c of canisters) {
      const content = c.content || '(비어있음)';
      const size = disp(c.size, c.sizeEtc);
      const key = `${content}||${size}`;
      if (!cmap.has(key)) cmap.set(key, { content, size, count: 0, totalWeight: 0, heaviest: -1, heaviestNote: '' });
      const g = cmap.get(key);
      g.count += 1;
      const w = num(c.weight) || 0;
      g.totalWeight += w;
      if (w > g.heaviest) {
        g.heaviest = w;
        g.heaviestNote = c.note || '';
      }
    }
    const canisterSummary = Array.from(cmap.values()).sort((a, b) =>
      a.content === b.content ? a.size.localeCompare(b.size) : a.content.localeCompare(b.content),
    );

    res.json({
      settings: { safetyRatioPercent: threshold },
      rawSummary,
      subSummary,
      canisterSummary,
      counts: {
        rawBelow: rawSummary.filter((r) => r.below).length,
        subBelow: subSummary.filter((r) => r.below).length,
        canisterTotal: canisters.length,
      },
    });
  }),
);

module.exports = { router };
