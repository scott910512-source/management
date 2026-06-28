'use strict';

const express = require('express');
const { mutate, readTable, headersOf } = require('../lib/store');
const { asyncHandler, str, num, badRequest, notFound, sendCsv } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { appendTransaction } = require('../lib/tx');
const { requireAuth, requireAdmin, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { readSettings } = require('./settings');
const { parseSizeMaxKg, CANISTER_WARN_RATIO } = require('../lib/warnings');

const router = express.Router();

const SIZES = ['5gal', '50L', '100L', '200L', '기타'];
const LOCATIONS = ['2공장현장', '3류창고', '4류창고', '기타'];
const STATUSES = ['수령', '사용중', '사용완료', '세정의뢰', '사용금지', '기타'];
const MOVE_TYPES = ['반입', '반출', '상태변경'];

router.use(requireAuth, resolvePlant);

function disp(value, etc) {
  return value === '기타' ? (etc || '기타') : value;
}
function decorate(r, maxMap) {
  const max = maxMap ? maxMap[r.size] : null;
  const w = num(r.weight) || 0;
  return {
    ...r,
    sizeLabel: disp(r.size, r.sizeEtc),
    locationLabel: disp(r.location, r.locationEtc),
    statusLabel: disp(r.status, r.statusEtc),
    maxKg: max != null ? max : null,
    capPct: max != null && max > 0 ? Math.round((w / max) * 100) : null,
    capWarn: max != null && max > 0 && w >= max * CANISTER_WARN_RATIO, // 90% 이상
  };
}
function filterRows(rows, query) {
  const q = str(query.q).toLowerCase();
  const size = str(query.size);
  const location = str(query.location);
  const status = str(query.status);
  return rows.filter((r) => {
    if (q && !`${r.canisterNo} ${r.content}`.toLowerCase().includes(q)) return false;
    if (size && r.size !== size) return false;
    if (location && r.location !== location) return false;
    if (status && r.status !== status) return false;
    return true;
  });
}
function validateEnum(label, value, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${label} 값이 올바르지 않습니다.`);
}
function toArr(str) { return (str || '').split(',').map(v => v.trim()).filter(Boolean); }
async function getDynamicEnums(plant) {
  const s = await readSettings(plant);
  return {
    sizes: [...toArr(s.canisterSizes), '기타'],
    locations: [...toArr(s.canisterLocations), '기타'],
    statuses: [...toArr(s.canisterStatuses), '기타'],
  };
}

// 목록
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows, settings] = await Promise.all([readTable('canisters', req.plant), readSettings(req.plant)]);
    const maxMap = parseSizeMaxKg(settings.canisterSizeMaxKg);
    // 기본 정렬: 제품(내용물) 그룹 → Canister No.
    const sorted = filterRows(rows, req.query).sort((a, b) => {
      const ca = a.content || '~';
      const cb = b.content || '~';
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.canisterNo.localeCompare(b.canisterNo);
    });
    res.json({ items: sorted.map((r) => decorate(r, maxMap)) });
  }),
);

// 집계(개수): 위치별/사이즈별/상태별
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const rows = await readTable('canisters', req.plant);
    const count = (keyFn) => {
      const m = {};
      for (const r of rows) {
        const k = keyFn(r);
        m[k] = (m[k] || 0) + 1;
      }
      return m;
    };
    res.json({
      total: rows.length,
      byLocation: count((r) => disp(r.location, r.locationEtc)),
      bySize: count((r) => disp(r.size, r.sizeEtc)),
      byStatus: count((r) => disp(r.status, r.statusEtc)),
    });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await readTable('canisters', req.plant);
    sendCsv(res, headersOf('canisters'), filterRows(rows, req.query), 'Canister목록');
  }),
);

// 단건 조회
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows, settings] = await Promise.all([readTable('canisters', req.plant), readSettings(req.plant)]);
    const r = rows.find((x) => x.id === req.params.id);
    if (!r) throw notFound('Canister를 찾을 수 없습니다.');
    res.json({ item: decorate(r, parseSizeMaxKg(settings.canisterSizeMaxKg)) });
  }),
);

// 용기이력카드(수불 이력)
router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const all = await readTable('canister_history', req.plant);
    const items = all.filter((h) => h.canisterId === req.params.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items });
  }),
);

router.get(
  '/:id/history/export',
  asyncHandler(async (req, res) => {
    const all = await readTable('canister_history', req.plant);
    const items = all.filter((h) => h.canisterId === req.params.id);
    sendCsv(res, headersOf('canister_history'), items, `Canister이력_${req.params.id}`);
  }),
);

// Canister 등록 (+ 등록 이력)
router.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const canisterNo = str(req.body.canisterNo);
    const size = str(req.body.size);
    const location = str(req.body.location);
    const status = str(req.body.status) || '수령';
    const content = str(req.body.content);
    const weight = req.body.weight === '' || req.body.weight === undefined ? 0 : num(req.body.weight);
    if (!canisterNo) throw badRequest('Canister No.를 입력하세요.');
    const enums = await getDynamicEnums(req.plant);
    validateEnum('용기 사이즈', size, enums.sizes);
    validateEnum('위치', location, enums.locations);
    validateEnum('상태', status, enums.statuses);
    if (Number.isNaN(weight) || weight < 0) throw badRequest('무게는 0 이상의 숫자여야 합니다.');

    const unit = str(req.body.unit) || 'kg';
    const me = req.session.user.id;
    const item = await mutate('canisters', req.plant, (rows) => {
      if (rows.some((r) => r.canisterNo === canisterNo)) throw badRequest('이미 등록된 Canister No.입니다.');
      const row = {
        id: newId('cn'), canisterNo, size, sizeEtc: str(req.body.sizeEtc),
        location, locationEtc: str(req.body.locationEtc), status, statusEtc: str(req.body.statusEtc),
        content, weight: String(weight), unit, note: str(req.body.note),
        createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    await mutate('canister_history', req.plant, (rows) => {
      rows.push({
        id: newId('ch'), canisterId: item.id, canisterNo: item.canisterNo, date: now().slice(0, 10),
        type: '반입', content, weight: String(weight),
        location: disp(item.location, item.locationEtc), status: disp(item.status, item.statusEtc),
        note: '신규 등록', createdBy: me, createdAt: now(),
      });
    });
    if (weight > 0) {
      await appendTransaction({
        plant: req.plant, materialType: 'canister', materialId: item.id, materialName: item.canisterNo, content,
        type: '반입', quantity: weight, unit: str(req.body.unit) || 'kg', balanceAfter: weight, note: '신규 등록', user: me,
      });
    }
    res.status(201).json({ item: decorate(item) });
  }),
);

// Canister 이력 등록(반입/반출/상태변경) — 내용물 수불
router.post(
  '/:id/move',
  requireWrite,
  asyncHandler(async (req, res) => {
    const type = str(req.body.type);
    const amount = req.body.weight === '' || req.body.weight === undefined ? 0 : num(req.body.weight);
    const unit = str(req.body.unit) || 'kg';
    const txDate = str(req.body.txDate) || null;
    if (!MOVE_TYPES.includes(type)) throw badRequest('구분은 반입/반출/상태변경 중 하나여야 합니다.');
    if (Number.isNaN(amount) || amount < 0) throw badRequest('무게는 0 이상의 숫자여야 합니다.');

    const moveEnums = (req.body.location || req.body.status) ? await getDynamicEnums(req.plant) : null;
    const me = req.session.user.id;
    let snap;
    const item = await mutate('canisters', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('Canister를 찾을 수 없습니다.');
      const cur = num(r.weight) || 0;
      if (type === '반입') {
        if (req.body.content !== undefined && str(req.body.content) !== '') r.content = str(req.body.content);
        r.weight = String(cur + amount);
      } else if (type === '반출') {
        const next = cur - amount;
        if (next < 0) throw badRequest(`반출 무게가 현재 내용물(${cur}${unit})을 초과합니다.`);
        r.weight = String(next);
        if (next === 0 && str(req.body.content) === '') r.content = '';
      }
      if (req.body.location !== undefined && req.body.location !== '') {
        validateEnum('위치', str(req.body.location), moveEnums.locations);
        r.location = str(req.body.location);
        r.locationEtc = str(req.body.locationEtc);
      }
      if (req.body.status !== undefined && req.body.status !== '') {
        validateEnum('상태', str(req.body.status), moveEnums.statuses);
        r.status = str(req.body.status);
        r.statusEtc = str(req.body.statusEtc);
      }
      r.updatedBy = me;
      r.updatedAt = now();
      snap = r;
      return r;
    });
    const history = await mutate('canister_history', req.plant, (rows) => {
      const row = {
        id: newId('ch'), canisterId: item.id, canisterNo: item.canisterNo,
        date: str(req.body.date) || now().slice(0, 10), type, content: snap.content, weight: snap.weight,
        location: disp(snap.location, snap.locationEtc), status: disp(snap.status, snap.statusEtc),
        note: str(req.body.note), createdBy: me, createdAt: now(),
      };
      rows.push(row);
      return row;
    });
    if (type !== '상태변경' && amount > 0) {
      await appendTransaction({
        plant: req.plant, materialType: 'canister', materialId: item.id, materialName: item.canisterNo, content: snap.content,
        type, quantity: amount, unit, balanceAfter: snap.weight, note: str(req.body.note), user: me, txDate,
      });
    }
    res.status(201).json({ item: decorate(item), history });
  }),
);

// 수정(메타)
// Canister No./사이즈 변경은 관리자만 (위치/상태는 /move 로 사용자도 가능)
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const patchEnums = req.body.size !== undefined ? await getDynamicEnums(req.plant) : null;
    const item = await mutate('canisters', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('Canister를 찾을 수 없습니다.');
      if (req.body.canisterNo !== undefined) {
        const cn = str(req.body.canisterNo);
        if (!cn) throw badRequest('Canister No.를 입력하세요.');
        if (rows.some((x) => x.canisterNo === cn && x.id !== r.id)) throw badRequest('이미 등록된 Canister No.입니다.');
        r.canisterNo = cn;
      }
      if (req.body.size !== undefined) {
        validateEnum('용기 사이즈', str(req.body.size), patchEnums.sizes);
        r.size = str(req.body.size);
        r.sizeEtc = str(req.body.sizeEtc);
      }
      if (req.body.content !== undefined) r.content = str(req.body.content);
      if (req.body.note !== undefined) r.note = str(req.body.note);
      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item: decorate(item) });
  }),
);

// 삭제(관리자) — 이력 함께 삭제
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('canisters', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('Canister를 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    await mutate('canister_history', req.plant, (rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].canisterId === req.params.id) rows.splice(i, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router, SIZES, LOCATIONS, STATUSES, MOVE_TYPES };
