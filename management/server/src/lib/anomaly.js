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

// Lot 번호 자연 정렬 비교 (예: A01 < A02 < ... < A10 < ... < A20).
// 문자열 사전순 비교로는 "A10"이 "A2"보다 앞서는 오류가 나므로 numeric 옵션을 사용한다.
function compareLotNo(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

// a가 b보다 선입선출상 먼저인지: 입고일이 아니라 Lot 번호 순서가 기준이다.
// (같은 날짜로 대량 등록되는 경우가 흔해 입고일로는 순서를 구분할 수 없고,
//  현장에서는 Lot 번호 자체를 선입선출 순서로 관리하기 때문)
// Lot 번호가 동일할 때만 입고일로 보조 판단한다.
function isEarlier(a, b) {
  const c = compareLotNo(a.lotNo, b.lotNo);
  if (c !== 0) return c < 0;
  return a.receivedDate < b.receivedDate;
}

/**
 * 같은 품목 내에서 대상 Lot보다 선입선출상(Lot 번호 기준) 더 먼저이고 재고가 남은 Lot을 찾는다(선입선출 위반).
 * @returns 가장 빠른 위반 Lot 또는 null
 */
function findEarlierLot(rows, target, nameField) {
  const name = target[nameField];
  const earlier = rows.filter((r) => {
    if (r[nameField] !== name || r.id === target.id) return false;
    if ((num(r.quantity != null ? r.quantity : r.weight) || 0) <= 0) return false;
    return isEarlier(r, target);
  });
  if (!earlier.length) return null;
  earlier.sort((a, b) => (isEarlier(a, b) ? -1 : isEarlier(b, a) ? 1 : 0));
  return earlier[0];
}

/**
 * 입고 등록 시점 검사: 같은 품목의 기존 재고(잔량 有) 중, 지금 입고하려는 Lot보다
 * Lot 번호가 더 늦은(나중 순번) Lot이 이미 존재하는지 찾는다.
 * 예: 1010 Lot이 이미 재고에 있는 상태에서 1009 Lot을 입고하면, 1009가 더 빠른 번호이므로
 * 순서가 뒤바뀐 입고임을 알려준다(확인창 대상).
 * @returns Lot 번호가 더 늦은 기존 Lot 중 가장 빠른 것(=대상과 가장 가까운 것) 또는 null
 */
function findLaterLot(rows, target, nameField) {
  const name = target[nameField];
  const later = rows.filter((r) => {
    if (r[nameField] !== name) return false;
    if (r.id && target.id && r.id === target.id) return false;
    if ((num(r.quantity != null ? r.quantity : r.weight) || 0) <= 0) return false;
    return compareLotNo(r.lotNo, target.lotNo) > 0;
  });
  if (!later.length) return null;
  later.sort((a, b) => compareLotNo(a.lotNo, b.lotNo));
  return later[0];
}

module.exports = { appendAnomaly, findEarlierLot, findLaterLot };
