'use strict';

const { createApp } = require('./app');
const { ensureSeed } = require('./lib/seed');
const { migrate } = require('./lib/migrate');
const { backupData } = require('./lib/backup');
const { PORT, DATA_DIR } = require('./config');

// 시작 시 기존 데이터를 백업(읽기만 하므로 원본은 변경되지 않음)
try {
  const dest = backupData();
  if (dest) console.log(`[backup] 기존 데이터 백업 완료: ${dest}`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[backup] 백업 실패(무시하고 계속):', e.message);
}

// 멀티 공장 마이그레이션(기존 데이터를 2공장으로 이관, 비파괴적)
try {
  const moved = migrate();
  if (moved.length) console.log(`[migrate] 기존 데이터를 2공장으로 이관: ${moved.join(', ')}`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[migrate] 마이그레이션 경고(계속):', e.message);
}

// 데이터 파일이 "없을 때만" 초기 시드 생성 (기존 데이터는 절대 덮어쓰지 않음)
const created = ensureSeed();
if (created.length) {
  // eslint-disable-next-line no-console
  console.log(`[seed] 초기 데이터 생성: ${created.join(', ')}`);
}

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  화학공장 수불관리 시스템 서버 실행 중`);
  console.log(`  - 주소: http://localhost:${PORT}`);
  console.log(`  - 데이터 폴더: ${DATA_DIR}`);
  console.log(`  - 기본 관리자 계정: admin / admin1234 (최초 로그인 후 비밀번호 변경 권장)\n`);
});
