'use strict';

const { readTable, mutate } = require('./store');
const { newId, now } = require('./ids');

// 날짜 문자열에서 연도(YYYY) 추출. 없으면 오늘 기준.
function yearOf(dateStr) {
  return (dateStr || now()).slice(0, 4);
}

// 숫자만 추출(#5 → 5, "5" → 5)
function toNum(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 품목의 해당 연도 최신 Batch 번호 + 1 (출고 기록 기준).
 * 연도가 바뀌면 1부터 다시 시작.
 */
async function nextBatchNo(plant, materialName, year) {
  const txns = await readTable('transactions', plant);
  let max = 0;
  for (const t of txns) {
    if (t.type !== '출고') continue;
    if (t.materialName !== materialName) continue;
    if (!t.batchNo) continue;
    if (yearOf(t.createdAt) !== String(year)) continue;
    const n = toNum(t.batchNo);
    if (n > max) max = n;
  }
  return max + 1;
}

/** (제품, 연도, 번호) 배치 조회 — 없으면 null */
async function lookupBatch(plant, product, no, year) {
  const batches = await readTable('batches', plant);
  return (
    batches.find(
      (b) => b.product === product && String(b.no) === String(toNum(no)) && String(b.year) === String(year),
    ) || null
  );
}

/**
 * 배치 보장(upsert) — (제품, 연도, 번호)가 없으면 생성하며 합성시작일을 기록,
 * 이미 있으면 기존 배치(합성시작일 공유)를 그대로 반환.
 */
async function ensureBatch(plant, { product, no, year, startDate, user }) {
  const noNum = String(toNum(no));
  let result = null;
  await mutate('batches', plant, (rows) => {
    const ex = rows.find((b) => b.product === product && String(b.no) === noNum && String(b.year) === String(year));
    if (ex) {
      // 기존 배치에 합성시작일이 비어있고 새로 들어온 값이 있으면 보완
      if (!ex.startDate && startDate) ex.startDate = startDate;
      result = ex;
      return;
    }
    const row = {
      id: newId('bt'),
      product: product || '',
      year: String(year),
      no: noNum,
      startDate: startDate || '',
      createdBy: user,
      createdAt: now(),
    };
    rows.push(row);
    result = row;
  });
  return result;
}

module.exports = { yearOf, toNum, nextBatchNo, lookupBatch, ensureBatch };
