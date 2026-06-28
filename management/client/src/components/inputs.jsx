import { useState, useEffect } from 'react';
import { Select, TextInput } from './ui';
import { api } from '../api';

const UNIT_PRESET = ['kg', 'ea', 'L'];

/**
 * 수불 잔량 표시 박스 — 현재잔량과 처리 후(사용 후/입고 후) 잔여수량을 크게 보여준다.
 * cur: 현재 잔량, qty: 입력 수량, type: '입고'|'출고', unit, over: 초과 여부, hasQty: 수량 입력 여부
 */
export function BalanceBox({ cur, qty, type, unit, over, hasQty }) {
  const after = type === '입고' ? cur + (qty || 0) : cur - (qty || 0);
  const afterLabel = type === '입고' ? '입고 후 잔여수량' : '사용 후 잔여수량';
  return (
    <div style={{ display: 'flex', gap: 12, margin: '4px 0 16px' }}>
      <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 2 }}>현재잔량</div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
          {cur.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-2)' }}>{unit}</span>
        </div>
      </div>
      <div style={{ fontSize: 22, color: 'var(--text-3)', alignSelf: 'center' }}>→</div>
      <div style={{ flex: 1, background: over ? 'var(--red-bg, #fff1f1)' : 'var(--bg2)', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 2 }}>{afterLabel}</div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: !hasQty ? 'var(--text-3)' : over ? 'var(--red)' : 'var(--green)' }}>
          {hasQty ? after.toLocaleString() : '–'} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-2)' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

/** Lot 양식의 날짜 토큰을 오늘 기준으로 치환한다. {YYYY}{YY}{MM}{DD} */
export function expandLot(pattern) {
  if (!pattern) return '';
  const d = new Date();
  return String(pattern)
    .replace(/\{YYYY\}/g, d.getFullYear())
    .replace(/\{YY\}/g, String(d.getFullYear()).slice(2))
    .replace(/\{MM\}/g, String(d.getMonth() + 1).padStart(2, '0'))
    .replace(/\{DD\}/g, String(d.getDate()).padStart(2, '0'));
}

/**
 * 품목 선택: 마스터 목록(관리자 등록)에서 선택하거나 '기타'로 직접 입력.
 * onChange(name, master) — 마스터 선택 시 품목 전체(단위/업체/기본수량/Lot양식 등)를 전달, '기타'는 null.
 */
export function ItemSelect({ category, value, onChange }) {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState(value ? '__preset__' : '');

  useEffect(() => {
    api.get('/items?category=' + category).then((d) => {
      setItems(d.items);
      // 초기값이 마스터에 없으면 '기타'로 간주
      if (value && !d.items.some((i) => i.name === value)) setMode('기타');
      else if (value) setMode(value);
    });
  }, [category]);

  function handleSelect(e) {
    const v = e.target.value;
    setMode(v);
    if (v === '기타') onChange('', null);
    else onChange(v, items.find((i) => i.name === v) || null);
  }

  return (
    <div className="form-row">
      <Select value={mode === '__preset__' ? value : mode} onChange={handleSelect}>
        <option value="" disabled>품목 선택</option>
        {items.map((i) => (
          <option key={i.id} value={i.name}>{i.name} ({i.unit})</option>
        ))}
        <option value="기타">기타(직접입력)</option>
      </Select>
      {mode === '기타' && (
        <TextInput value={value} onChange={(e) => onChange(e.target.value, null)} placeholder="품목명 직접 입력" />
      )}
    </div>
  );
}

/** 단위 입력: kg/ea/L 또는 '기타' 선택 시 직접 입력. 값은 단일 문자열로 관리. */
export function UnitInput({ value, onChange }) {
  const initialEtc = value && !UNIT_PRESET.includes(value);
  const [mode, setMode] = useState(value === '' ? 'kg' : initialEtc ? '기타' : value);

  function handleSelect(e) {
    const v = e.target.value;
    setMode(v);
    onChange(v === '기타' ? '' : v);
  }
  return (
    <div className="form-row">
      <Select value={mode} onChange={handleSelect}>
        {UNIT_PRESET.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
        <option value="기타">기타(직접입력)</option>
      </Select>
      {mode === '기타' && (
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="단위 입력 (예: box)" />
      )}
    </div>
  );
}

/**
 * enum + 기타(직접작성) 선택. value는 enum 값, etc는 기타 텍스트.
 * onChange(value, etc)
 */
export function EtcSelect({ options, value, etc, onChange, placeholder = '직접 입력' }) {
  return (
    <div className="form-row">
      <Select value={value} onChange={(e) => onChange(e.target.value, e.target.value === '기타' ? etc : '')}>
        <option value="" disabled>선택하세요</option>
        {(options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="기타">기타(직접입력)</option>
      </Select>
      {value === '기타' && (
        <TextInput value={etc || ''} onChange={(e) => onChange('기타', e.target.value)} placeholder={placeholder} autoFocus />
      )}
    </div>
  );
}
