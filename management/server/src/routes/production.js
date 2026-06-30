'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { asyncHandler, badRequest } = require('../lib/http');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 폴더에서 키워드 매칭 최신 xlsx 파일 탐색
function findLatestFile(folderPath, keywords) {
  const kws = keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (e) {
    throw new Error(`폴더를 열 수 없습니다: ${e.message}`);
  }
  const matched = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.xlsx'))
    .filter((e) => kws.every((k) => e.name.toLowerCase().includes(k)))
    .map((e) => {
      const full = path.join(folderPath, e.name);
      const stat = fs.statSync(full);
      return { name: e.name, full, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (matched.length === 0) throw new Error(`키워드(${keywords})에 맞는 xlsx 파일을 찾을 수 없습니다.`);
  return matched[0];
}

// 관리자 — 경로 테스트
router.post(
  '/test-path',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const folderPath = (req.body.filePath || '').trim();
    const keywords = (req.body.keywords || '2공장,Daily,report').trim();
    if (!folderPath) throw badRequest('경로를 입력하세요.');

    if (!fs.existsSync(folderPath)) {
      throw badRequest(`경로가 존재하지 않습니다: ${folderPath}`);
    }
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      throw badRequest('입력한 경로가 폴더가 아닙니다. 폴더 경로를 입력해 주세요.');
    }

    const found = findLatestFile(folderPath, keywords);
    res.json({
      message: `파일 ${found.name} 을 감지했습니다. (수정일: ${new Date(found.mtime).toLocaleString('ko-KR')})`,
      file: found.full,
    });
  }),
);

module.exports = router;
module.exports.findLatestFile = findLatestFile;
