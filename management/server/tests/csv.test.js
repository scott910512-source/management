'use strict';

const { parseCsv, stringifyCsv, BOM } = require('../src/lib/csv');

describe('CSV 유틸', () => {
  test('콤마/따옴표/줄바꿈/한글을 포함한 왕복 변환', () => {
    const headers = ['id', 'name', 'vendor', 'note'];
    const rows = [
      { id: '1', name: '톨루엔', vendor: '(주)한솔, 케미칼', note: '줄1\n줄2' },
      { id: '2', name: '황"산"', vendor: '대정화학', note: '' },
    ];
    const text = stringifyCsv(headers, rows);
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM 포함
    const parsed = parseCsv(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].vendor).toBe('(주)한솔, 케미칼');
    expect(parsed[0].note).toBe('줄1\n줄2');
    expect(parsed[1].name).toBe('황"산"');
  });

  test('빈 문자열/빈 테이블 처리', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(BOM)).toEqual([]);
    const text = stringifyCsv(['a', 'b'], []);
    expect(parseCsv(text)).toEqual([]);
  });

  test('헤더만 있고 데이터가 없는 경우', () => {
    const text = stringifyCsv(['id', 'name'], []);
    expect(parseCsv(text)).toEqual([]);
  });
});
