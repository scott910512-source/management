'use strict';

const { stringifyCsv } = require('./csv');

/** async 라우트 핸들러의 에러를 next로 전달한다. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** 요청 본문에서 문자열 필드를 안전하게 추출(trim). */
function str(v, def = '') {
  if (v === undefined || v === null) return def;
  return String(v).trim();
}

/** 숫자 파싱. 유효하지 않으면 NaN. */
function num(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  return Number(v);
}

/** 잘못된 요청 에러를 던진다(상태코드 400). */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function badRequest(message) {
  return new HttpError(400, message);
}
function notFound(message = '대상을 찾을 수 없습니다.') {
  return new HttpError(404, message);
}

/**
 * CSV 파일을 응답으로 내려준다. UTF-8 BOM 포함, 한글 파일명 지원.
 */
function sendCsv(res, headers, rows, baseName) {
  const body = stringifyCsv(headers, rows, { bom: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${baseName}_${stamp}.csv`;
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="export.csv"; filename*=UTF-8''${encoded}`);
  res.send(body);
}

module.exports = { asyncHandler, str, num, HttpError, badRequest, notFound, sendCsv };
