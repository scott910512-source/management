'use strict';

const express = require('express');
const { readTable } = require('../lib/store');
const { asyncHandler, str, num } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');

const router = express.Router();
router.use(requireAuth, resolvePlant);

function weekLabel(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodLabel(iso, period) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (period === 'year') return String(d.getUTCFullYear());
  if (period === 'week') return weekLabel(d);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // month
}

// 품목별 사용/입고 트렌드 (period: week|month|year)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const category = str(req.query.category) || 'raw'; // raw | sub
    const period = ['week', 'month', 'year'].includes(str(req.query.period)) ? str(req.query.period) : 'month';

    const txns = (await readTable('transactions', req.plant)).filter((t) => t.materialType === category);
    const labelSet = new Set();
    const byItem = {};

    for (const t of txns) {
      const label = periodLabel(t.createdAt, period);
      if (!label) continue;
      labelSet.add(label);
      const name = t.materialName || '(미상)';
      if (!byItem[name]) byItem[name] = { name, totalIn: 0, totalOut: 0, series: {} };
      const g = byItem[name];
      if (!g.series[label]) g.series[label] = { in: 0, out: 0 };
      const qty = num(t.quantity) || 0;
      if (t.type === '입고') {
        g.totalIn += qty;
        g.series[label].in += qty;
      } else if (t.type === '출고') {
        g.totalOut += qty;
        g.series[label].out += qty;
      }
    }

    const labels = Array.from(labelSet).sort();
    const items = Object.values(byItem).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ category, period, labels, items });
  }),
);

module.exports = { router };
