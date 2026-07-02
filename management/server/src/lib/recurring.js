'use strict';

const { readTable, mutate } = require('./store');
const { newId, now } = require('./ids');

// 'YYYY-MM-DD' → {y,m,d}
function parse(s) {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return { y, m, d };
}
function fmt(y, m, d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}
function dow(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일 … 6=토
}
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
// today 기준, 대상 요일의 가장 최근(≤오늘) 날짜
function lastWeekday(y, m, d, weekday) {
  const delta = (dow(y, m, d) - weekday + 7) % 7;
  const base = new Date(Date.UTC(y, m - 1, d - delta));
  return fmt(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

/**
 * 활성 정기 템플릿마다 "이번 주기의 발생일(≤오늘)"을 계산해,
 * 아직 생성되지 않았으면 Task 1건을 만든다. (멱등 — period 키로 중복 방지)
 * @returns 생성된 개수
 */
async function materializeRecurring(plant) {
  const tpls = await readTable('recurring_tasks', plant);
  const active = tpls.filter((t) => String(t.active) !== '0' && String(t.active).toLowerCase() !== 'false');
  if (active.length === 0) return 0;

  const today = now().slice(0, 10);
  const { y, m, d } = parse(today);

  // 각 템플릿의 발생일 + period 키 계산
  const plans = [];
  for (const t of active) {
    let occ = today;
    let period = today;
    if (t.cycle === '주') {
      const wd = Number(t.weekday);
      const weekday = Number.isFinite(wd) ? ((wd % 7) + 7) % 7 : 1; // 기본 월요일
      occ = lastWeekday(y, m, d, weekday);
      period = occ; // 주마다 고유(해당 주의 요일 날짜)
    } else if (t.cycle === '월') {
      const md = Math.min(Math.max(Number(t.monthday) || 1, 1), 31);
      const thisMonthDay = Math.min(md, daysInMonth(y, m));
      if (thisMonthDay <= d) {
        occ = fmt(y, m, thisMonthDay);
        period = `${fmt(y, m, 1).slice(0, 7)}`;
      } else {
        const pm = m === 1 ? 12 : m - 1;
        const py = m === 1 ? y - 1 : y;
        occ = fmt(py, pm, Math.min(md, daysInMonth(py, pm)));
        period = occ.slice(0, 7);
      }
    } else {
      // 일(매일)
      occ = today;
      period = today;
    }
    plans.push({ tpl: t, occ, period });
  }

  // 이미 생성된 (recurringId, period) 조합은 건너뜀
  const existing = await readTable('tasks', plant);
  const seen = new Set(existing.filter((r) => r.recurringId).map((r) => `${r.recurringId}|${r.period}`));

  const toCreate = plans.filter((p) => !seen.has(`${p.tpl.id}|${p.period}`));
  if (toCreate.length === 0) return 0;

  await mutate('tasks', plant, (rows) => {
    for (const p of toCreate) {
      const t = p.tpl;
      rows.push({
        id: newId('tk'),
        title: t.title,
        category: t.category || '기타',
        categoryEtc: t.categoryEtc || '',
        priority: t.priority || '중',
        assignee: t.assignee || '',
        dueDate: p.occ,
        status: '대기',
        note: t.note || '',
        recurringId: t.id,
        period: p.period,
        createdBy: t.createdBy || 'system',
        createdAt: now(),
        updatedBy: t.createdBy || 'system',
        updatedAt: now(),
      });
    }
  });
  return toCreate.length;
}

module.exports = { materializeRecurring };
