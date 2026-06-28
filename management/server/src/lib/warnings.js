'use strict';

const { num } = require('./http');

// Canister 사이즈별 용량 기준(이 무게 이상이면 잔여공간 없음/초과 경고)
const CANISTER_CAP = { '5gal': 20, '50L': 50, '100L': 100, '200L': 200 };

/** 현재고/최소재고/경고기준(%)으로 재고수준%와 상태(정상/임박/부족)를 계산. */
function safetyStatus(current, min, threshold) {
  const m = num(min) || 0;
  if (m <= 0) return { level: null, state: '정상', below: false };
  const level = Math.round((current / m) * 100);
  if (level < threshold) return { level, state: '부족', below: true };
  if (level < threshold + 20) return { level, state: '임박', below: false };
  return { level, state: '정상', below: false };
}

/** Canister 용량 기준(사이즈 → 한도). 기타는 한도 없음(null). */
function canisterCap(size) {
  return CANISTER_CAP[size] != null ? CANISTER_CAP[size] : null;
}

/**
 * 활성 경고 목록을 계산한다.
 * - 안전재고 부족(원/부재료)
 * - Canister 용량 초과(무게 >= 사이즈 기준)
 * 각 경고는 안정적인 key를 가진다.
 */
function computeWarnings({ items, raws, subs, canisters, threshold }) {
  const out = [];

  const buildSafety = (cat, masters, rows, getName, getQty, label) => {
    for (const m of masters) {
      const total = rows.filter((r) => getName(r) === m.name).reduce((s, r) => s + (num(getQty(r)) || 0), 0);
      const itemThreshold = (m.warningPct && num(m.warningPct) > 0) ? num(m.warningPct) : threshold;
      const st = safetyStatus(total, m.safetyStock, itemThreshold);
      if (st.below) {
        out.push({
          key: `safety:${cat}:${m.name}`,
          kind: 'safety',
          level: 'danger',
          content: `${label} '${m.name}' 안전재고 부족 (현재 ${total.toLocaleString()}${m.unit} / 최소 ${Number(m.safetyStock).toLocaleString()}${m.unit}, ${st.level}%)`,
        });
      }
    }
  };
  buildSafety('raw', items.filter((i) => i.category === 'raw'), raws, (r) => r.itemName, (r) => r.quantity, '원재료');
  buildSafety('sub', items.filter((i) => i.category === 'sub'), subs, (r) => r.name, (r) => r.weight, '부재료');

  // 유해화학물질 보관가능수량 초과 경고
  const hazItems = items.filter((i) => i.hazardous === '1' && i.hazardousMaxQty && Number(i.hazardousMaxQty) > 0);
  for (const m of hazItems) {
    const maxQty = num(m.hazardousMaxQty);
    const warnPct = (m.hazardousWarnPct && num(m.hazardousWarnPct) > 0) ? num(m.hazardousWarnPct) : 80;
    const total = [
      ...raws.filter((r) => r.itemName === m.name).map((r) => num(r.quantity) || 0),
      ...subs.filter((s) => s.name === m.name).map((s) => num(s.weight) || 0),
    ].reduce((a, b) => a + b, 0);
    const pct = Math.round((total / maxQty) * 100);
    if (pct >= warnPct) {
      out.push({
        key: `hazardous:${m.name}`,
        kind: 'hazardous',
        level: pct >= 100 ? 'danger' : 'warn',
        content: `유해화학물질 '${m.name}' 보관량 초과 위험 — 현재 ${total.toLocaleString()}${m.unit} / 보관가능 ${maxQty.toLocaleString()}${m.unit} (${pct}%)`,
      });
    }
  }

  for (const c of canisters) {
    const cap = canisterCap(c.size);
    const w = num(c.weight) || 0;
    if (cap != null && w >= cap) {
      out.push({
        key: `canister:${c.id}`,
        kind: 'canister',
        level: 'warn',
        content: `Canister ${c.canisterNo}(${c.size}) 용량 초과 — 무게 ${w.toLocaleString()} (기준 ${cap} 이상). 수불 필요`,
      });
    }
  }
  return out;
}

module.exports = { computeWarnings, safetyStatus, canisterCap, CANISTER_CAP };
