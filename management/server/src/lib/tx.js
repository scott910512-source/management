'use strict';

const { mutate } = require('./store');
const { newId, now } = require('./ids');

/**
 * 수불(입출고) 내역 1건을 transactions 테이블에 추가한다.
 * materialType: 'raw' | 'sub' | 'canister'
 */
function appendTransaction({ plant, materialType, materialId, materialName, lotNo = '', content = '', type, quantity, unit, balanceAfter, note = '', user }) {
  return mutate('transactions', plant, (rows) => {
    const row = {
      id: newId('tx'),
      materialType,
      materialId,
      materialName,
      lotNo,
      content,
      type,
      quantity: String(quantity),
      unit,
      balanceAfter: String(balanceAfter),
      note,
      createdBy: user,
      createdAt: now(),
    };
    rows.push(row);
    return row;
  });
}

module.exports = { appendTransaction };
