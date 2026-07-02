'use strict';

// RFC-4180 기반의 최소 구현. 콤마/따옴표/줄바꿈을 포함한 필드와 한글을 안전하게 처리한다.
const BOM = '﻿';

/**
 * CSV 텍스트를 객체 배열로 변환한다. 첫 줄을 헤더로 사용한다.
 * @param {string} text
 * @returns {Array<Object>}
 */
function parseCsv(text) {
  if (text == null) return [];
  let s = String(text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // BOM 제거
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s.trim() === '') return [];

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  const header = rows.shift();
  const out = [];
  for (const r of rows) {
    if (r.length === 1 && r[0] === '') continue; // 빈 줄 무시
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    out.push(obj);
  }
  return out;
}

/**
 * CSV 텍스트를 2차원 배열(행 x 열)로 변환한다. 헤더 처리를 하지 않는
 * 원시 그리드 형태로, 셀 좌표(행/열 인덱스)로 직접 접근할 때 사용한다.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsvGrid(text) {
  if (text == null) return [];
  let s = String(text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // BOM 제거
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s === '') return [];

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function escapeField(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * 헤더와 행 객체 배열을 CSV 텍스트로 직렬화한다.
 * @param {Array<string>} headers
 * @param {Array<Object>} rows
 * @param {{bom?: boolean}} [opts]
 * @returns {string}
 */
function stringifyCsv(headers, rows, opts = {}) {
  const bom = opts.bom !== false;
  const lines = [];
  lines.push(headers.map(escapeField).join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => escapeField(r[h])).join(','));
  }
  return (bom ? BOM : '') + lines.join('\r\n') + '\r\n';
}

module.exports = { parseCsv, parseCsvGrid, stringifyCsv, escapeField, BOM };
