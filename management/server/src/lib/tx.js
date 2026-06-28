'use strict';

const { mutate } = require('./store');
const { newId, now } = require('./ids');

/**
 * 수불(입출고) 내역 1건을 transactions 테이블에 추가한다.
 * materialType: 'raw' | 'sub' | 'canister'
 */
function appendTransaction({ plant, materialType, materialId, materialName, lotNo = '', content = '', type, quantity, unit, balanceAfter, batchNo = '', batchId = '', note = '', user, txDate }) {
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
      batchNo: batchNo !== undefined && batchNo !== null ? String(batchNo) : '',
      batchId: batchId || '',
      note,
      createdBy: user,
      createdAt: txDate || now(),
    };
    rows.push(row);
    return row;
  });
}

module.exports = { appendTransaction };
