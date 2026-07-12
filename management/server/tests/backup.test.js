'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

// backup 모듈이 config를 통해 읽을 DATA_DIR을 require 전에 지정
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chem-bk-'));
process.env.DATA_DIR = TMP;

const { backupData } = require('../src/lib/backup');

afterAll(() => {
  // backupData()는 DATA_DIR(=TMP)의 형제 폴더인 "<TMP>/../backups"에 스냅샷을 쓴다.
  // 주의: 여기서 절대 path.join(TMP, '..') 자체(=os.tmpdir())를 지우면 안 된다 —
  // 시스템 임시폴더 전체가 삭제되는 사고로 이어진다. TMP와 그 backups 형제 폴더만 정리한다.
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.rmSync(path.join(TMP, '..', 'backups'), { recursive: true, force: true });
});

describe('데이터 백업', () => {
  test('원본을 변경하지 않고 스냅샷을 생성한다', () => {
    const file = path.join(TMP, 'raw_materials.csv');
    const content = 'id,name\nrm_1,톨루엔\n';
    fs.writeFileSync(file, content, 'utf8');

    const dest = backupData();
    expect(dest).toBeTruthy();
    // 백업본이 동일 내용으로 존재
    expect(fs.readFileSync(path.join(dest, 'raw_materials.csv'), 'utf8')).toBe(content);
    // 원본은 그대로
    expect(fs.readFileSync(file, 'utf8')).toBe(content);
  });

  test('데이터가 없으면 백업하지 않는다(null)', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'chem-bk-empty-'));
    process.env.DATA_DIR = empty;
    jest.resetModules();
    const { backupData: bk } = require('../src/lib/backup');
    // CSV가 없으므로 null
    expect(bk()).toBeNull();
  });
});
