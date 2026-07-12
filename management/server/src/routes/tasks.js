'use strict';

const express = require('express');
const { readTable, mutate } = require('../lib/store');
const { asyncHandler, str, badRequest, notFound, forbidden } = require('../lib/http');
const { newId, now } = require('../lib/ids');
const { requireAuth, requireAdmin, requireWrite } = require('../middleware/auth');
const { resolvePlant } = require('../middleware/plant');
const { materializeRecurring } = require('../lib/recurring');

const router = express.Router();
const CATEGORIES = ['공정', '원부재료', '현장관리', '안전', '공사', '기타'];
const PRIORITIES = ['상', '중', '하'];
const STATUSES = ['완료', '완료대기', '진행중', '대기', '지연'];
const CYCLES = ['일', '주', '월'];

router.use(requireAuth, resolvePlant);

const PRIO_ORDER = { 상: 0, 중: 1, 하: 2 };

// ===== 정기(반복) 업무 템플릿 =====
// 목록
router.get(
  '/recurring',
  asyncHandler(async (req, res) => {
    const rows = await readTable('recurring_tasks', req.plant);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items: rows });
  }),
);

function validateRecurring(body) {
  const title = str(body.title);
  const category = str(body.category);
  const cycle = str(body.cycle);
  if (!title) throw badRequest('정기 업무명을 입력하세요.');
  if (!CATEGORIES.includes(category)) throw badRequest('구분을 선택하세요.');
  if (!CYCLES.includes(cycle)) throw badRequest('주기(일/주/월)를 선택하세요.');
  const priority = str(body.priority) || '중';
  if (!PRIORITIES.includes(priority)) throw badRequest('우선순위 값이 올바르지 않습니다.');
  return { title, category, cycle, priority };
}

// 등록
router.post(
  '/recurring',
  requireWrite,
  asyncHandler(async (req, res) => {
    const v = validateRecurring(req.body);
    const me = req.session.user.id;
    const item = await mutate('recurring_tasks', req.plant, (rows) => {
      const row = {
        id: newId('rt'), title: v.title, category: v.category, categoryEtc: str(req.body.categoryEtc),
        priority: v.priority, assignee: str(req.body.assignee), note: str(req.body.note),
        cycle: v.cycle, weekday: req.body.weekday !== undefined ? String(req.body.weekday) : '',
        monthday: req.body.monthday !== undefined ? String(req.body.monthday) : '',
        active: '1', createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    await materializeRecurring(req.plant); // 즉시 이번 주기분 생성
    res.status(201).json({ item });
  }),
);

// 수정 (작성자 또는 관리자) — active 토글 포함
router.patch(
  '/recurring/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const item = await mutate('recurring_tasks', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('정기 업무를 찾을 수 없습니다.');
      if (r.createdBy !== me && !isAdmin) throw forbidden('작성자 또는 관리자만 수정할 수 있습니다.');
      for (const f of ['title', 'category', 'categoryEtc', 'priority', 'assignee', 'note', 'cycle', 'weekday', 'monthday']) {
        if (req.body[f] !== undefined) r[f] = String(req.body[f]);
      }
      if (req.body.active !== undefined) r.active = req.body.active ? '1' : '0';
      r.updatedBy = me; r.updatedAt = now();
      return r;
    });
    await materializeRecurring(req.plant);
    res.json({ item });
  }),
);

// 삭제 (작성자 또는 관리자) — 생성된 Task는 유지
router.delete(
  '/recurring/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    await mutate('recurring_tasks', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('정기 업무를 찾을 수 없습니다.');
      if (rows[idx].createdBy !== me && !isAdmin) throw forbidden('작성자 또는 관리자만 삭제할 수 있습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

// Task 목록 (all=1이면 완료 포함)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeAll = str(req.query.all) === '1';
    const today = now().slice(0, 10);
    // 정기 업무 — 이번 주기 발생분 자동 생성
    await materializeRecurring(req.plant);
    // 마감 초과 Task 자동 지연 처리
    const all = await readTable('tasks', req.plant);
    const overdueIds = all.filter((r) => r.dueDate && r.dueDate < today && r.status !== '완료' && r.status !== '지연').map((r) => r.id);
    if (overdueIds.length > 0) {
      await mutate('tasks', req.plant, (rows) => {
        for (const r of rows) {
          if (overdueIds.includes(r.id)) { r.status = '지연'; r.updatedAt = now(); }
        }
      });
    }
    let rows = await readTable('tasks', req.plant);
    if (!includeAll) rows = rows.filter((r) => r.status !== '완료');
    rows.sort((a, b) => {
      const pa = PRIO_ORDER[a.priority] ?? 9;
      const pb = PRIO_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
    });
    res.json({ items: rows });
  }),
);

// Task 등록
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = str(req.body.title);
    const category = str(req.body.category);
    const priority = str(req.body.priority) || '중';
    const status = str(req.body.status) || '대기';
    if (!title) throw badRequest('Task명을 입력하세요.');
    if (!CATEGORIES.includes(category)) throw badRequest('구분을 선택하세요.');
    if (!PRIORITIES.includes(priority)) throw badRequest('우선순위 값이 올바르지 않습니다.');
    if (!STATUSES.includes(status)) throw badRequest('진행현황 값이 올바르지 않습니다.');

    const me = req.session.user.id;
    const item = await mutate('tasks', req.plant, (rows) => {
      const row = {
        id: newId('tk'), title, category, categoryEtc: str(req.body.categoryEtc),
        priority, assignee: str(req.body.assignee), dueDate: str(req.body.dueDate), status,
        note: str(req.body.note), createdBy: me, createdAt: now(), updatedBy: me, updatedAt: now(),
      };
      rows.push(row);
      return row;
    });
    res.status(201).json({ item });
  }),
);

// Task 수정/완료처리
// - 내용 수정(제목/구분/우선순위 등): 작성자 또는 관리자만 가능
// - 완료 처리: 관리자는 즉시 '완료', 그 외 사용자는 '완료대기'(관리자 승인 필요)
// - 관리자 승인: '완료대기' → '완료'
const EDIT_FIELDS = ['title', 'category', 'categoryEtc', 'priority', 'assignee', 'dueDate', 'note'];
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const isFieldEdit = EDIT_FIELDS.some((k) => req.body[k] !== undefined);

    const item = await mutate('tasks', req.plant, (rows) => {
      const r = rows.find((x) => x.id === req.params.id);
      if (!r) throw notFound('Task를 찾을 수 없습니다.');

      // 내용 수정은 작성자 또는 관리자만
      if (isFieldEdit && r.createdBy !== me && !isAdmin) {
        throw forbidden('Task 내용은 작성자 또는 관리자만 수정할 수 있습니다.');
      }
      if (isFieldEdit) {
        if (req.body.title !== undefined) r.title = str(req.body.title);
        if (req.body.category !== undefined) r.category = str(req.body.category);
        if (req.body.categoryEtc !== undefined) r.categoryEtc = str(req.body.categoryEtc);
        if (req.body.priority !== undefined) r.priority = str(req.body.priority);
        if (req.body.assignee !== undefined) r.assignee = str(req.body.assignee);
        if (req.body.dueDate !== undefined) r.dueDate = str(req.body.dueDate);
        if (req.body.note !== undefined) r.note = str(req.body.note);
      }

      // 진행현황 변경
      if (req.body.status !== undefined) {
        let next = str(req.body.status);
        if (!STATUSES.includes(next)) throw badRequest('진행현황 값이 올바르지 않습니다.');
        // 완료 요청 시: 관리자만 즉시 완료, 일반 사용자는 완료대기(승인 필요)
        if (next === '완료' && !isAdmin) next = '완료대기';
        r.status = next;
      }

      r.updatedBy = me;
      r.updatedAt = now();
      return r;
    });
    res.json({ item });
  }),
);

// 삭제(관리자)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await mutate('tasks', req.plant, (rows) => {
      const idx = rows.findIndex((x) => x.id === req.params.id);
      if (idx < 0) throw notFound('Task를 찾을 수 없습니다.');
      rows.splice(idx, 1);
    });
    res.json({ ok: true });
  }),
);

module.exports = { router, CATEGORIES, PRIORITIES, STATUSES };
