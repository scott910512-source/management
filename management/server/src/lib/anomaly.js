'use strict';

const { mutate } = require('./store');
const { num } = require('./http');
const { newId, now } = require('./ids');

/** 이상발생 1건 기록 */
function appendAnomaly({ plant, type, itemName, lotInfo, account, note = '' }) {
  return mutate('anomalies', plant, (rows) => {
    const r = { id: newId('an'), type, itemName, lotInfo, account, note, createdAt: now() };
    rows.push(r);
    return r;
  });
}

/**
 * 같은 품목 내에서 대상 Lot보다 입고일이 더 빠르고 재고가 남은 Lot을 찾는다(선입선출 위반).
 * @returns 가장 빠른 위반 Lot 또는 null
 */
function findEarlierLot(rows, target, nameField) {
  const name = target[nameField];
  const tDate = target.receivedDate || '';
  const earlier = rows.filter(
    (r) => r[nameField] === name && r.id !== target.id && (num(r.quantity != null ? r.quantity : r.weight) || 0) > 0 && r.receivedDate && (tDate === '' || r.receivedDate < tDate),
  );
  if (!earlier.length) return null;
  earlier.sort((a, b) => (a.receivedDate < b.receivedDate ? -1 : 1));
  return earlier[0];
}

module.exports = { appendAnomaly, findEarlierLot };
