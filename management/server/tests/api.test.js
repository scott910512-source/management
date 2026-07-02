'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chem-test-'));
process.env.DATA_DIR = TMP;
process.env.SESSION_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeed } = require('../src/lib/seed');

let app;
let admin;
let user;

beforeAll(async () => {
  ensureSeed({ force: true });
  app = createApp();
  admin = request.agent(app);
  user = request.agent(app);
  await admin.post('/api/auth/login').send({ id: 'admin', password: 'admin1234' }).expect(200);
  await user.post('/api/auth/login').send({ id: 'user1', password: 'user1234' }).expect(200);
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('인증/품목', () => {
  test('미인증 401', async () => {
    await request(app).get('/api/raw-materials').expect(401);
  });
  test('관리자 품목 등록 / 사용자 불가', async () => {
    await admin.post('/api/items').send({ category: 'raw', name: '아세톤', unit: 'L', safetyStock: 100, vendor: 'A상사' }).expect(201);
    await user.post('/api/items').send({ category: 'raw', name: '메탄올', unit: 'L' }).expect(403);
  });
});

describe('원재료 필수값/완료숨김', () => {
  let acetoneId;
  test('입고일 누락 시 400(필수값)', async () => {
    await admin.post('/api/raw-materials').send({ itemName: '아세톤', lotNo: 'AC-1', quantity: 100, unit: 'L' }).expect(400);
  });
  test('정상 등록', async () => {
    const res = await admin.post('/api/raw-materials').send({ itemName: '아세톤', lotNo: 'AC-1', quantity: 100, unit: 'L', receivedDate: '2026-06-25' }).expect(201);
    acetoneId = res.body.item.id;
  });
  test('단일 Lot 출고는 선입선출 위반 아님', async () => {
    await admin.post(`/api/raw-materials/${acetoneId}/transaction`).send({ type: '출고', quantity: 100 }).expect(201);
  });
  test('잔량 0 Lot은 목록에서 숨김, all=1에는 표시', async () => {
    const def = await admin.get('/api/raw-materials?q=AC-1').expect(200);
    expect(def.body.items.some((r) => r.id === acetoneId)).toBe(false);
    const all = await admin.get('/api/raw-materials?q=AC-1&all=1').expect(200);
    expect(all.body.items.some((r) => r.id === acetoneId)).toBe(true);
  });
});

// 선입선출(FIFO) 검증은 seed 데이터(과거 이력 Lot 등)와 무관하게 동작해야 하므로,
// 매 테스트마다 격리된 전용 품목명으로 Lot을 새로 생성해 검사한다.
describe('선입선출(FIFO) 경고/이상발생 — 원재료', () => {
  let earlyId, lateId;
  beforeAll(async () => {
    const early = await admin.post('/api/raw-materials')
      .send({ itemName: '자일렌', lotNo: 'XY-EARLY', quantity: 100, unit: 'kg', receivedDate: '2026-01-01' }).expect(201);
    earlyId = early.body.item.id;
    const late = await admin.post('/api/raw-materials')
      .send({ itemName: '자일렌', lotNo: 'XY-LATE', quantity: 100, unit: 'kg', receivedDate: '2026-06-01' }).expect(201);
    lateId = late.body.item.id;
  });
  test('더 오래된 Lot(재고 有) 존재 시, 늦은 Lot 출고는 409 경고', async () => {
    const res = await admin.post(`/api/raw-materials/${lateId}/transaction`).send({ type: '출고', quantity: 10 }).expect(409);
    expect(res.body.fifoWarning).toBe(true);
    expect(res.body.earliest.lotNo).toBe('XY-EARLY');
  });
  test('가장 오래된 Lot부터 출고하면 경고 없이 처리된다', async () => {
    await admin.post(`/api/raw-materials/${earlyId}/transaction`).send({ type: '출고', quantity: 10 }).expect(201);
  });
  test('force=true 강제사용 시 처리 + 이상발생 기록', async () => {
    await admin.post(`/api/raw-materials/${lateId}/transaction`).send({ type: '출고', quantity: 10, force: true }).expect(201);
    const an = await admin.get('/api/anomalies').expect(200);
    expect(an.body.items.some((a) => a.type === '선입선출 오류' && a.itemName === '자일렌')).toBe(true);
  });
  test('가장 오래된 Lot 재고가 소진되면(0), 다음으로 오래된 Lot 기준으로 재판정된다', async () => {
    // earlyId 잔량: 100 - 10 = 90. 완전히 소진시켜 0으로 만든다.
    await admin.post(`/api/raw-materials/${earlyId}/transaction`).send({ type: '출고', quantity: 90 }).expect(201);
    // 이제 자일렌 중 재고가 남은 Lot은 lateId 뿐이므로, 정상 출고되어야 한다.
    await admin.post(`/api/raw-materials/${lateId}/transaction`).send({ type: '출고', quantity: 5 }).expect(201);
  });
});

describe('선입선출(FIFO) 경고/이상발생 — 부재료', () => {
  let earlyId, lateId;
  beforeAll(async () => {
    const early = await admin.post('/api/sub-materials')
      .send({ name: '테스트패드', lotNo: 'PD-EARLY', weight: 50, unit: 'kg', receivedDate: '2026-01-01' }).expect(201);
    earlyId = early.body.item.id;
    const late = await admin.post('/api/sub-materials')
      .send({ name: '테스트패드', lotNo: 'PD-LATE', weight: 50, unit: 'kg', receivedDate: '2026-06-01' }).expect(201);
    lateId = late.body.item.id;
  });
  test('더 오래된 Lot(재고 有) 존재 시, 늦은 Lot 출고는 409 경고', async () => {
    const res = await admin.post(`/api/sub-materials/${lateId}/transaction`).send({ type: '출고', quantity: 5 }).expect(409);
    expect(res.body.fifoWarning).toBe(true);
    expect(res.body.earliest.lotNo).toBe('PD-EARLY');
  });
  test('가장 오래된 Lot부터 출고하면 경고 없이 처리된다', async () => {
    await admin.post(`/api/sub-materials/${earlyId}/transaction`).send({ type: '출고', quantity: 5 }).expect(201);
  });
  test('force=true 강제사용 시 처리 + 이상발생 기록', async () => {
    await admin.post(`/api/sub-materials/${lateId}/transaction`).send({ type: '출고', quantity: 5, force: true }).expect(201);
    const an = await admin.get('/api/anomalies').expect(200);
    expect(an.body.items.some((a) => a.type === '선입선출 오류' && a.itemName === '테스트패드')).toBe(true);
  });
});

describe('경고/대시보드', () => {
  test('대시보드 요약(상태 포함)', async () => {
    const res = await admin.get('/api/dashboard').expect(200);
    expect(res.body.rawSummary.find((r) => r.name === '촉매펠릿').state).toBe('부족');
    expect(Array.isArray(res.body.canisterSummary)).toBe(true);
  });
  test('활성 경고 + 확인(ack)', async () => {
    const w = await admin.get('/api/warnings').expect(200);
    expect(w.body.items.length).toBeGreaterThanOrEqual(1);
    const key = w.body.items[0].key;
    await admin.post('/api/warnings/ack').send({ key, content: w.body.items[0].content }).expect(200);
    const w2 = await admin.get('/api/warnings').expect(200);
    expect(w2.body.items.find((x) => x.key === key).ackedByMe).toBe(true);
  });
});

describe('Task 관리', () => {
  let taskId;
  test('등록(담당자 목록 조회 포함)', async () => {
    const opt = await user.get('/api/users/options').expect(200);
    expect(opt.body.items.length).toBeGreaterThanOrEqual(1);
    const res = await user.post('/api/tasks').send({ title: '라인 점검', category: '공정', priority: '상', assignee: 'user1', dueDate: '2026-07-01', status: '대기' }).expect(201);
    taskId = res.body.item.id;
  });
  test('일반 사용자 완료 요청 시 완료대기 → 목록 유지', async () => {
    // 일반 사용자가 완료를 누르면 즉시 완료가 아니라 '완료대기'(관리자 승인 필요)
    const res = await user.patch(`/api/tasks/${taskId}`).send({ status: '완료' }).expect(200);
    expect(res.body.item.status).toBe('완료대기');
    const def = await user.get('/api/tasks').expect(200);
    expect(def.body.items.some((t) => t.id === taskId)).toBe(true); // 완료대기는 기본 목록에 유지
  });
  test('관리자 승인 시 완료 → 기본 목록에서 숨김, all=1에 표시', async () => {
    const res = await admin.patch(`/api/tasks/${taskId}`).send({ status: '완료' }).expect(200);
    expect(res.body.item.status).toBe('완료');
    const def = await user.get('/api/tasks').expect(200);
    expect(def.body.items.some((t) => t.id === taskId)).toBe(false);
    const all = await user.get('/api/tasks?all=1').expect(200);
    expect(all.body.items.some((t) => t.id === taskId)).toBe(true);
  });
  test('내용 수정은 작성자 본인 가능, 비작성자는 403', async () => {
    // 작성자(user1) 본인은 내용 수정 가능
    await user.patch(`/api/tasks/${taskId}`).send({ title: '라인 점검(수정)' }).expect(200);
    // admin이 작성한 다른 Task를 user1(비작성자, 같은 공장 아님이 아닌 권한 검증)
    // → admin이 2공장에 Task를 만들고 user1(2공장, 비작성자)이 수정 시도 시 403
    const admin2 = await admin.post('/api/tasks').set('X-Plant', encodeURIComponent('2공장')).send({ title: '관리자 작성 Task', category: '공정', priority: '중', status: '대기' }).expect(201);
    await user.patch(`/api/tasks/${admin2.body.item.id}`).send({ title: '비작성자 수정 시도' }).expect(403);
  });
});

describe('트렌드', () => {
  test('품목별 입출고 집계', async () => {
    const res = await admin.get('/api/trends?category=raw&period=month').expect(200);
    expect(res.body.period).toBe('month');
    expect(res.body.items.some((i) => i.name === '톨루엔')).toBe(true);
  });
});

describe('멀티 공장(1·2공장) 격리/권한', () => {
  let admin1;
  beforeAll(async () => {
    admin1 = request.agent(app);
    await admin1.post('/api/auth/login').send({ id: 'admin1', password: 'admin1234' }).expect(200);
  });
  test('2공장에 등록한 품목은 1공장에서 보이지 않는다', async () => {
    await admin.post('/api/items').set('X-Plant', encodeURIComponent('2공장')).send({ category: 'raw', name: '격리테스트', unit: 'kg', safetyStock: 1 }).expect(201);
    const p2 = await admin.get('/api/items?category=raw').set('X-Plant', encodeURIComponent('2공장')).expect(200);
    const p1 = await admin.get('/api/items?category=raw').set('X-Plant', encodeURIComponent('1공장')).expect(200);
    expect(p2.body.items.some((i) => i.name === '격리테스트')).toBe(true);
    expect(p1.body.items.some((i) => i.name === '격리테스트')).toBe(false);
  });
  test('1공장 관리자(admin1)는 1공장 접근 가능, 2공장은 403', async () => {
    await admin1.get('/api/items?category=raw').expect(200); // 기본 1공장
    await admin1.get('/api/items?category=raw').set('X-Plant', encodeURIComponent('2공장')).expect(403);
  });
  test('admin1은 사용자 관리 불가(총괄관리자만)', async () => {
    await admin1.get('/api/users').expect(403);
    await admin.get('/api/users').expect(200);
  });
  test('로그인 응답에 접근 가능 공장 목록 포함', async () => {
    const me = await admin1.get('/api/auth/me').expect(200);
    expect(me.body.plants).toEqual(['1공장']);
  });
});

describe('AI 스마트 검색', () => {
  test('자연어 사용량 질의 해석', async () => {
    const r = await admin.get('/api/search?q=' + encodeURIComponent('이번달 톨루엔 사용량')).expect(200);
    expect(r.body.answer).toMatch(/톨루엔/);
    expect(r.body.answer).toMatch(/사용량/);
  });
  test('부족 품목 질의', async () => {
    const r = await admin.get('/api/search?q=' + encodeURIComponent('부족 품목')).expect(200);
    expect(r.body.table.headers).toContain('품목');
    expect(r.body.table.rows.length).toBeGreaterThanOrEqual(1);
  });
  test('상태별 Canister 질의', async () => {
    const r = await admin.get('/api/search?q=' + encodeURIComponent('세정의뢰 Canister')).expect(200);
    expect(r.body.answer).toMatch(/Canister/);
  });
});

describe('팀관리자(viewer) 조회 전용', () => {
  let team;
  beforeAll(async () => {
    team = request.agent(app);
    await team.post('/api/auth/login').send({ id: 'team1', password: 'team1234' }).expect(200);
  });
  test('전체 공장 조회 가능', async () => {
    await team.get('/api/items?category=raw').set('X-Plant', encodeURIComponent('1공장')).expect(200);
    await team.get('/api/items?category=raw').set('X-Plant', encodeURIComponent('2공장')).expect(200);
    await team.get('/api/dashboard').set('X-Plant', encodeURIComponent('1공장')).expect(200);
  });
  test('쓰기(등록/수불)는 403 차단', async () => {
    await team.post('/api/raw-materials').set('X-Plant', encodeURIComponent('2공장')).send({ itemName: '톨루엔', lotNo: 'V-1', quantity: 1, unit: 'kg', receivedDate: '2026-06-26' }).expect(403);
    await team.post('/api/tasks').set('X-Plant', encodeURIComponent('2공장')).send({ title: 'x', category: '공정' }).expect(403);
  });
  test('로그인 시 전체 공장 접근', async () => {
    const me = await team.get('/api/auth/me').expect(200);
    expect(me.body.plants).toEqual(['1공장', '2공장']);
  });
});

describe('권한(삭제=관리자)', () => {
  test('사용자 등록 가능 / 삭제는 관리자', async () => {
    const res = await user.post('/api/raw-materials').send({ itemName: '톨루엔', lotNo: 'U-9', quantity: 3, unit: 'kg', receivedDate: '2026-06-26' }).expect(201);
    await user.delete(`/api/raw-materials/${res.body.item.id}`).expect(403);
    await admin.delete(`/api/raw-materials/${res.body.item.id}`).expect(200);
  });
});
