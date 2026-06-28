'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, num, badRequest } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { computeWarnings } = require('../lib/warnings');
const { readSettings } = require('./settings');

const router = express.Router();
router.use(requireAuth, resolvePlant);

async function activeWarnings(plant) {
  const [items, raws, subs, canisters, settings] = await Promise.all([
    readTable('items', plant), readTable('raw_materials', plant), readTable('sub_materials', plant), readTable('canisters', plant), readSettings(plant),
  ]);
  const threshold = num(settings.safetyRatioPercent) || 100;
  return computeWarnings({ items, raws, subs, canisters, threshold });
}

// 활성 경고 + 확인/삭제 상태
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const [warnings, acks, dismissed, users] = await Promise.all([
      activeWarnings(req.plant), readTable('warning_acks', req.plant), readTable('warning_dismissed', req.plant), readTable('users'),
    ]);
    const dismissedMap = new Map();
    for (const d of dismissed) {
      const existing = dismissedMap.get(d.warningKey);
      if (!existing || d.createdAt > existing.createdAt) dismissedMap.set(d.warningKey, d);
    }
    const plant = req.plant;
    const approved = users.filter((u) => u.status === 'approved' && (u.plantScope === 'all' || u.plant === plant || u.plantScope === plant));
    const totalUsers = approved.length;

    const items = warnings
      .filter((w) => {
        const d = dismissedMap.get(w.key);
        if (!d) return true;
        return d.content !== w.content;
      })
      .map((w) => {
        const ackedBy = acks.filter((a) => a.warningKey === w.key).map((a) => a.account);
        const uniqueAcked = new Set(ackedBy);
        return {
          ...w,
          ackedBy: Array.from(uniqueAcked),
          ackCount: uniqueAcked.size,
          totalUsers,
          ackedByMe: uniqueAcked.has(me),
          fullyAcked: totalUsers > 0 && approved.every((u) => uniqueAcked.has(u.id)),
          pending: approved.filter((u) => !uniqueAcked.has(u.id)).map((u) => u.name || u.id),
        };
      });
    res.json({ items, count: items.length });
  }),
);

// 경고 확인
router.post(
  '/ack',
  asyncHandler(async (req, res) => {
    const key = str(req.body.key);
    if (!key) throw badRequest('경고 키가 필요합니다.');
    const me = req.session.user.id;
    await mutate('warning_acks', req.plant, (rows) => {
      if (!rows.some((r) => r.warningKey === key && r.account === me)) {
        rows.push({ id: newId('wa'), warningKey: key, account: me, content: str(req.body.content), createdAt: now() });
      }
    });
    res.json({ ok: true });
  }),
);

// 경고 삭제(숨김) + 로그
router.post(
  '/dismiss',
  asyncHandler(async (req, res) => {
    const key = str(req.body.key);
    if (!key) throw badRequest('경고 키가 필요합니다.');
    const me = req.session.user.id;
    await mutate('warning_dismissed', req.plant, (rows) => {
      rows.push({ id: newId('wd'), warningKey: key, account: me, content: str(req.body.content), createdAt: now() });
    });
    res.json({ ok: true });
  }),
);

// 확인/삭제 로그
router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const [acks, dismissed] = await Promise.all([readTable('warning_acks', req.plant), readTable('warning_dismissed', req.plant)]);
    const logs = [
      ...acks.map((a) => ({ ...a, action: '확인' })),
      ...dismissed.map((d) => ({ ...d, action: '삭제' })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items: logs });
  }),
);

module.exports = { router };
