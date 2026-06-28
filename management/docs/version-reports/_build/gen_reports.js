'use strict';
const fs = require('fs');
const path = require('path');

const SHOTS = '/home/user/management/management/client/public/guide/shots';
const OUT = '/home/user/management/management/docs/version-reports';
fs.mkdirSync(OUT, { recursive: true });

const b64 = {};
for (const f of fs.readdirSync(SHOTS)) {
  if (f.endsWith('.png')) b64[f.replace('.png', '')] = 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');
}

const CSS = `
  :root{--ink:#1d1d1f;--sub:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--blue:#0071e3;--card:#fff;--green:#34a853;--amber:#ff9f0a;--red:#ff3b30;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:880px;margin:0 auto;padding:48px 24px 96px;}
  .hero{text-align:center;padding:40px 24px 36px;}
  .badge{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--blue);background:rgba(0,113,227,.1);padding:6px 14px;border-radius:980px;}
  .hero h1{font-size:46px;line-height:1.08;letter-spacing:-.02em;font-weight:700;margin:20px 0 8px;}
  .hero .ver{color:var(--blue);}
  .hero p{font-size:18px;color:var(--sub);margin:0;font-weight:400;}
  .nav{display:flex;justify-content:center;flex-wrap:wrap;gap:6px;margin:22px 0 0;}
  .nav a{font-size:12px;font-weight:600;color:var(--sub);text-decoration:none;padding:5px 11px;border-radius:980px;border:1px solid var(--line);background:#fff;}
  .nav a.cur{background:var(--blue);color:#fff;border-color:var(--blue);}
  .sec{background:var(--card);border-radius:20px;padding:30px 36px 34px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.03);}
  .sec-head{display:flex;align-items:center;gap:13px;margin-bottom:8px;}
  .sec-num{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:var(--blue);color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;}
  .sec h2{font-size:22px;letter-spacing:-.01em;margin:0;font-weight:700;}
  .sec .lead{font-size:15px;color:var(--sub);margin:4px 0 0;}
  .rows{margin-top:16px;}
  .row{display:flex;align-items:baseline;gap:12px;padding:12px 0;border-top:1px solid var(--line);}
  .row:first-child{border-top:none;}
  .row .k{flex:0 0 auto;min-width:128px;font-size:15px;font-weight:600;color:var(--blue);}
  .row.lock .k{color:var(--green);}
  .row.fix .k{color:var(--red);}
  .row .v{font-size:15px;color:var(--ink);}
  .shot{margin:18px 0 0;}
  .shot figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
  .shot img,.shot-row img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);background:#fff;}
  .shot svg,.shot-row svg{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);background:#fbfbfd;}
  .shot-row{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0 0;}
  .shot-row figure{flex:1 1 300px;margin:0;}
  .shot-row figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
  .vd{display:inline-block;font-size:11px;font-weight:600;color:var(--amber);background:rgba(255,159,10,.12);padding:1px 7px;border-radius:6px;margin-left:5px;vertical-align:middle;}
  .m-bar{fill:#f5f5f7;}.m-blue{fill:#0071e3;}.m-blue-soft{fill:rgba(0,113,227,.12);}.m-green{fill:#34a853;}
  .m-txt{fill:#86868b;font-size:9px;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-txt-d{fill:#1d1d1f;font-size:10px;font-weight:600;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-txt-w{fill:#fff;font-size:9px;font-weight:600;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-win{fill:#fff;stroke:#e5e5ea;}
  .foot{text-align:center;color:var(--sub);font-size:13px;margin-top:36px;}
  @media print{body{background:#fff;}.sec{box-shadow:none;border:1px solid var(--line);break-inside:avoid;}.hero{padding-top:0;}.nav{display:none;}}
`;

const VERSIONS = [
  { id: 'v1', tag: 'v1', label: 'v1' },
  { id: 'v2', tag: 'v2', label: 'v2' },
  { id: 'v3', tag: 'v3', label: 'v3' },
  { id: 'v3_1', tag: 'v3.1', label: 'v3.1' },
  { id: 'v4', tag: 'v4', label: 'v4' },
  { id: 'v5', tag: 'v5', label: 'v5' },
  { id: 'v6', tag: 'v6', label: 'v6' },
  { id: 'v7', tag: 'v7', label: 'v7' },
];

const rows = (cls, arr) => `<div class="rows">${arr.map(([k, v]) => `<div class="row${cls ? ' ' + cls : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
const imgFig = (name, cap) => `<figure><img src="${b64[name]}" alt="${cap}"><figcaption>${cap} <span class="vd">가상데이터</span></figcaption></figure>`;
const shotRow = (figs) => `<div class="shot-row">${figs.join('')}</div>`;
const shotOne = (name, cap) => `<figure class="shot"><img src="${b64[name]}" alt="${cap}"><figcaption>${cap} <span class="vd">가상데이터</span></figcaption></figure>`;

function sec(n, title, lead, body) {
  return `<section class="sec"><div class="sec-head"><div class="sec-num">${n}</div><h2>${title}</h2></div>${lead ? `<p class="lead">${lead}</p>` : ''}${body}</section>`;
}

// ---- per-version content ----
const C = {};

C.v1 = {
  sub: '수기관리 통합을 위한 시스템 구축',
  s1: { lead: '종이·엑셀로 흩어진 수기 기록을 하나로 — DB 없이 폐쇄망에서 바로 운영', body:
    `<figure class="shot"><svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg">
      <text class="m-txt-d" x="95" y="22" text-anchor="middle">기존 (수기)</text>
      <rect class="m-win" x="30" y="34" width="60" height="76" rx="6"/><rect class="m-win" x="48" y="46" width="60" height="76" rx="6"/><rect class="m-win" x="66" y="58" width="60" height="76" rx="6"/>
      <text class="m-txt" x="96" y="100" text-anchor="middle">종이·엑셀</text><text class="m-txt" x="96" y="150" text-anchor="middle">흩어진 기록</text>
      <path d="M170 95 L250 95" stroke="#0071e3" stroke-width="2.5" marker-end="url(#a1)"/><text class="m-txt-d" x="210" y="86" text-anchor="middle" fill="#0071e3">통합</text>
      <rect class="m-win" x="285" y="55" width="92" height="76" rx="9"/><text class="m-txt-d" x="331" y="86" text-anchor="middle">React</text><text class="m-txt" x="331" y="102" text-anchor="middle">화면</text><rect class="m-blue-soft" x="300" y="110" width="62" height="10" rx="3"/>
      <rect class="m-win" x="409" y="55" width="92" height="76" rx="9"/><text class="m-txt-d" x="455" y="86" text-anchor="middle">Express</text><text class="m-txt" x="455" y="102" text-anchor="middle">서버</text><rect class="m-blue-soft" x="424" y="110" width="62" height="10" rx="3"/>
      <rect class="m-win" x="533" y="55" width="92" height="76" rx="9"/><text class="m-txt-d" x="579" y="86" text-anchor="middle">CSV</text><text class="m-txt" x="579" y="102" text-anchor="middle">파일 저장</text><rect class="m-green" x="548" y="110" width="62" height="10" rx="3" opacity="0.85"/>
      <path d="M377 93 L409 93" stroke="#0071e3" stroke-width="2" marker-end="url(#a1)"/><path d="M501 93 L533 93" stroke="#0071e3" stroke-width="2" marker-end="url(#a1)"/>
      <text class="m-txt" x="455" y="158" text-anchor="middle">DB 불필요 · 폐쇄망 운영</text>
      <defs><marker id="a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#0071e3"/></marker></defs>
    </svg><figcaption>수기 기록 → 통합 시스템 (화면 · 서버 · 파일 저장)</figcaption></figure>` },
  main: [['수불 관리', '원재료·부재료·Canister의 입고와 사용을 품목별로 기록합니다.'], ['로그인 인증', '비밀번호를 암호화 저장하고 세션으로 로그인 상태를 유지합니다.'], ['가입 승인', '신규 가입은 관리자가 검토·승인해야 접근할 수 있습니다.'], ['CSV 내보내기', '관리 자료를 엑셀에서 바로 열 수 있는 파일로 내려받습니다.'], ['디자인 시스템', 'Apple 스타일의 깔끔하고 일관된 화면을 기본으로 적용했습니다.']],
  feat: shotOne('login', '로그인 화면 — 세션 인증 기반'),
  lock: [['승인 절차', '승인 전에는 로그인·열람이 불가 — 무단 가입과 외부 접근을 차단합니다.'], ['CSV BOM', '파일 앞에 BOM을 넣어 엑셀에서 한글이 깨지지 않게 합니다.'], ['비밀번호 암호화', '단방향 해시로 저장해 관리자도 원래 비밀번호를 볼 수 없습니다.']],
  bug: [['동시 쓰기 잠금', '여러 명이 동시에 저장해도 파일이 충돌·손상되지 않도록 잠금 처리했습니다.'], ['인코딩 정합성', '저장·내보내기 전 구간에서 한글이 깨지지 않도록 인코딩을 통일했습니다.']],
  learn: [['풀스택 개발', '화면(React)과 서버(Express)를 함께 설계·연동하는 구조를 익혔습니다.'], ['CSV 저장 선택', 'DB 설치·관리 부담 없이 폐쇄망에서 운영하려고 파일 저장을 채택했습니다.'], ['보안 인증', 'bcryptjs 단방향 해시와 세션 기반 로그인 방식을 적용했습니다.'], ['커스텀 디자인', '외부 UI 라이브러리 없이 일관된 자체 디자인 규칙을 정립했습니다.']],
};

C.v2 = {
  sub: 'Lot 기반 재고 시스템',
  s1: { lead: '입고일별 Lot 단위로 재고를 추적하고, 품목 기준정보(단위·안전재고·업체)를 체계화', body: shotRow([imgFig('items', '품목 기준정보 — 단위·안전재고·업체·제품 설정'), imgFig('raw', '원재료 현황 — Lot별 잔량 추적')]) },
  main: [['품목 기준정보', '단위·안전재고·업체·제품을 품목마다 미리 설정하는 마스터를 만들었습니다.'], ['Lot 단위 입고', '입고일별 Lot로 들여와 어느 Lot이 얼마나 남았는지 추적합니다.'], ['이중 안전재고', '안전재고를 % 기준과 별도 기준수량 두 가지로 설정할 수 있습니다.'], ['Canister 내용물·무게', '용기에 담긴 제품(내용물)과 무게를 함께 관리합니다.'], ['용기이력카드', '용기별 반입·반출 이력을 카드 형태로 상세히 봅니다.'], ['수불 이력 조회', '모든 입·출고를 한 페이지에서 통합 조회합니다.']],
  feat: shotRow([imgFig('canisters', 'Canister 현황 — 내용물·무게 관리'), imgFig('transactions', '수불 이력 — 입·출고 통합 조회')]),
  lock: [['소진 차감 방식', '출고 시 해당 Lot의 잔량이 줄어들어 재고가 실시간으로 맞춰집니다.'], ['이중 안전재고 기준', '% 기준만으로 부족한 경우를 대비해 기준수량을 별도로 둘 수 있습니다.']],
  bug: [['단위 선택 확장', 'kg·ea·L·기타 등 품목에 맞는 단위를 고를 수 있도록 변경했습니다.'], ['동시 쓰기 충돌 방지', 'CSV 저장에 파일 뮤텍스(withLock)를 적용해 충돌을 막았습니다.']],
  learn: [['재고 모델 설계', 'Lot 단위로 재고를 쪼개 추적하는 데이터 구조를 설계했습니다.'], ['마스터-트랜잭션 분리', '기준정보(마스터)와 수불(트랜잭션)을 분리하는 패턴을 익혔습니다.'], ['파일 동시성 제어', '뮤텍스로 동시 쓰기 충돌을 막는 방법을 적용했습니다.']],
};

C.v3 = {
  sub: '운영 대시보드 · 경고 · Task',
  s1: { lead: '한 화면에서 경고·퀵메뉴·Task를 보고, 선입선출(FIFO) 위반을 자동 감지', body: shotOne('dashboard', '종합현황 — 경고·퀵메뉴·진행 Task 한눈에') },
  main: [['FIFO 경고', '더 이른 Lot이 남아있는데 다른 Lot을 쓰면 경고(409)가 뜹니다.'], ['이상발생 자동기록', 'FIFO를 강제로 사용하면 이상발생 목록에 자동으로 남습니다.'], ['경고 영역', '안전재고 부족·Canister 용량 초과를 자동으로 감지해 표시합니다.'], ['퀵메뉴', '원·부재료 입고/사용, Canister 수불을 첫 화면에서 바로 시작합니다.'], ['Task 관리', '담당자·우선순위를 정해 업무를 등록하고 완료 처리합니다.'], ['트렌드 분석', '월별·주별 품목 입출고를 집계해 흐름을 봅니다.']],
  feat: shotRow([imgFig('anomalies', '이상발생 목록 — FIFO 강제 사용 기록'), imgFig('tasks', 'Task 관리 — 담당자·우선순위·완료')]),
  lock: [['FIFO 인터락', '오래된 Lot을 두고 새 Lot을 쓰지 못하게 막아 선입선출을 강제합니다.'], ['경고 확인(ack)', '경고를 확인한 인원 수를 표시해 누락 없이 챙기게 합니다.'], ['단일 Lot 예외', 'Lot이 하나뿐이면 FIFO 경고를 띄우지 않아 불필요한 경고를 줄였습니다.']],
  bug: [['입고일 필수 검증', '입고일을 빠뜨리면 400 오류로 막아 누락 입력을 방지합니다.'], ['빈 Lot 숨김', '잔량 0인 Lot은 기본 목록에서 숨겨 화면을 깔끔히 유지합니다.']],
  learn: [['상태 자동 감지', '재고·용량 조건을 서버가 판단해 경고를 만드는 로직을 익혔습니다.'], ['업무 흐름 모델', 'Task의 등록·진행·완료 상태 흐름을 설계했습니다.'], ['집계 분석', '기간별 입출고를 모아 트렌드로 보여주는 처리를 구현했습니다.']],
};

C.v3_1 = {
  sub: 'UI/UX 개선',
  s1: { lead: '현황을 제품별로 묶고 색상·뱃지로 구분 — 한눈에 읽히는 화면으로 다듬기', body: shotOne('dashboard', '제품별 그룹핑 + 부족 강조 + 상태 뱃지') },
  main: [['퀵메뉴 그룹 박스', '원재료/부재료/Canister를 묶음 박스로 정리했습니다.'], ['자동 채움', '품목을 고르면 단위·업체·Lot 양식이 자동으로 채워집니다.'], ['제품별 그룹핑', '원·부재료 현황을 사용처(제품)별로, Canister는 내용물별로 묶었습니다.'], ['부족 강조', '안전재고가 부족한 행을 빨간색으로 눈에 띄게 했습니다.'], ['상태 뱃지', '정상·임박·부족을 색상 뱃지로 구분합니다.'], ['아이콘 세트', '세련된 SVG 라인 아이콘으로 통일했습니다.']],
  feat: shotRow([imgFig('raw', '원재료 현황 — 제품별 음영 구분·부족 강조'), imgFig('items', '품목 선택 시 단위·양식 자동 채움')]),
  lock: [['자동 채움 인터락', '품목 선택만으로 양식이 채워져 오입력·누락을 줄입니다.'], ['부족 시각 강조', '부족 품목을 빨간색으로 강제 노출해 놓치지 않게 합니다.']],
  bug: [['용어 통일', '"등록"을 "입고"로 통일해 혼동을 없앴습니다.'], ['설정 메뉴 통합', '흩어진 설정을 관리자 설정으로 모아 이동을 단순화했습니다.']],
  learn: [['정보 구조화', '많은 데이터를 그룹·색상으로 묶어 가독성을 높이는 법을 익혔습니다.'], ['일관된 디자인 토큰', '색상·뱃지·아이콘을 규칙으로 통일하는 방식을 적용했습니다.']],
};

C.v4 = {
  sub: '멀티 공장 (1공장 · 2공장 분리)',
  s1: { lead: '공장별로 데이터를 완전히 분리하고, 서버 시작 시 자동 백업까지', body: shotOne('dashboard', '사이드바 공장 선택기 — 권한 있는 공장만 전환') },
  main: [['공장별 데이터 분리', '1공장·2공장 자료를 폴더 단위로 완전히 나눠 저장합니다.'], ['공장 선택기', '사이드바에서 권한 있는 공장만 골라 전환합니다.'], ['공장 컨텍스트 전달', 'X-Plant 헤더로 어느 공장 작업인지 서버에 전달합니다.'], ['자동 백업', '서버를 켤 때마다 스냅샷을 자동으로 저장합니다.'], ['백업 자동 정리', '최근 20개 백업만 남기고 오래된 것은 자동 삭제합니다.'], ['데이터 보존', '업데이트 시 data 폴더를 절대 덮어쓰지 않습니다.']],
  feat: shotOne('admin', '관리자 설정 — 공장·사용자·백업 관리'),
  lock: [['공장 데이터 보존', '업데이트가 기존 자료를 건드리지 않아 데이터 유실을 막습니다.'], ['자동 백업 안전망', '켤 때마다 백업이 쌓여 사고 시 복구할 수 있습니다.'], ['권한 기반 노출', '접근 권한이 있는 공장만 선택기에 보여 오작업을 막습니다.']],
  bug: [['한글 헤더 오류', 'X-Plant 한글 깨짐을 인코딩/디코딩 처리로 바로잡았습니다.'], ['글로벌 테이블 처리', '사용자 같은 공통 자료는 공장 구분 없이 다루도록 명시했습니다.'], ['권한 빈값 차단', '전체 권한은 명시적으로만 허용하고 빈 값은 막았습니다.']],
  learn: [['멀티테넌시', '하나의 시스템에서 여러 공장 데이터를 격리하는 구조를 익혔습니다.'], ['백업 전략', '스냅샷 자동 생성·보관 한도 관리 방식을 설계했습니다.'], ['안전한 마이그레이션', '기존 자료를 보존하며 폴더 구조를 옮기는 법을 적용했습니다.']],
};

C.v5 = {
  sub: '역할 5종 세분화 · 권한 격리',
  s1: { lead: '통합관리자·공장관리자·팀관리자(조회전용)·사용자로 권한을 나누고 공장 간 격리', body: shotOne('admin', '사용자·역할 관리 — 5종 권한 운영') },
  main: [['통합관리자', '전체 공장과 사용자까지 관리합니다.'], ['공장 관리자', '1공장/2공장 관리자는 본인 공장만 접근합니다.'], ['팀관리자(조회전용)', '전체 공장을 보지만 등록·수정·삭제는 불가합니다.'], ['공장 사용자', '본인 공장의 수불만 처리합니다.'], ['공장 간 격리', '1공장 관리자가 2공장에 접근하면 차단(403)합니다.'], ['역할 라벨·뱃지', '역할명을 화면에 표시하고 조회 전용은 오렌지 뱃지로 알립니다.']],
  feat: shotOne('login', '로그인 — 응답에 접근 가능 공장 목록 포함'),
  lock: [['조회전용 전역 차단', '팀관리자의 모든 쓰기 요청(POST·PATCH·DELETE)을 일괄 403으로 막습니다.'], ['쓰기 버튼 숨김', '권한 없는 사용자에게는 쓰기 버튼 자체를 보이지 않게 합니다.'], ['공장 경계 강제', '다른 공장 데이터 요청을 서버에서 거부해 경계를 강제합니다.']],
  bug: [['테스트 기준 정리', 'user1=2공장·user2=1공장으로 테스트 일관성을 맞췄습니다.']],
  learn: [['역할 기반 접근제어', 'RBAC로 역할마다 가능한 작업을 나누는 설계를 익혔습니다.'], ['이중 방어', '버튼 숨김(화면) + 미들웨어 차단(서버)을 함께 적용했습니다.'], ['테넌트 격리', '공장 경계를 서버에서 강제하는 방법을 구현했습니다.']],
};

C.v6 = {
  sub: 'AI 스마트 검색 + 사용자 메뉴얼',
  s1: { lead: '자연어로 재고·사용량을 묻고, 폐쇄망에서도 동작하는 규칙 기반 검색 엔진', body: shotOne('search', 'AI 검색 — 자연어 질의 + 결과 표·답변') },
  main: [['자연어 검색', '기간·품목·동작을 해석하는 규칙 기반 엔진(LLM 불필요·폐쇄망 호환).'], ['다양한 질의', '사용량·입고량·현재고·부족 품목·이상발생·Canister·수불 이력을 지원합니다.'], ['기간 해석', '오늘·이번주·지난달·올해·N월 등 기간 표현을 알아듣습니다.'], ['표+답변 동시', '결과 표와 자연어 답변을 함께 보여줍니다.'], ['예시 칩', '자주 쓰는 검색어를 칩으로 눌러 바로 검색합니다.'], ['사용자 메뉴얼', '이미지와 설명으로 구성된 안내 페이지를 추가했습니다.']],
  feat: shotRow([imgFig('search', 'AI 검색 — 예시 칩 + 자연어 답변'), imgFig('manual', '사용자 메뉴얼 — 이미지+설명 안내')]),
  lock: [['숫자 비조작', '실제 데이터로만 계산해 답을 만들고 숫자를 지어내지 않습니다.'], ['폐쇄망 호환', '외부 LLM 없이 로컬 규칙으로 동작해 사내망에서 안전합니다.']],
  bug: [['메뉴얼 보안 수정', '전체 공개되는 메뉴얼에서 로그인·계정 정보를 삭제해 노출 위험을 없앴습니다.']],
  learn: [['자연어 파싱', '문장에서 기간·품목·동작을 뽑아내는 규칙 설계를 익혔습니다.'], ['신뢰 가능한 답변', '데이터 기반으로만 답해 환각을 배제하는 원칙을 적용했습니다.'], ['온보딩 문서', '신규 사용자를 위한 시각적 안내 구성을 만들었습니다.']],
};

C.v7 = {
  sub: '현행 고도화 — 합성 Batch · 유해물질 · 보고서',
  s1: { lead: '다량 입고·FIFO 분배, 합성 Batch 투입이력, 유해화학물질 관리대장, 월간 보고서까지', body: shotOne('dashboard', '종합현황 — 퀵메뉴+AI 한 줄, Task 신호등, 5색 그룹') },
  main: [['다량 Lot 입고', '같은 품목 Lot을 번호 범위(A01~A20)로 한 번에 등록합니다.'], ['잔량 자동 계산', '현재잔량 → 사용/입고 후 잔여를 자동 표시하고 [전량] 버튼을 제공합니다.'], ['합성 Batch 투입이력', '출고 시 Batch No.를 기록하고 Batch별 투입 원·부재료를 모아 봅니다.'], ['유해화학물질 관리대장', '연간 일자별로 집계하고 보관한도 초과 시 경고합니다.'], ['월간 보고서', '관리자가 월별 재고현황을 표·그래프로 만들어 보고용 HTML로 받습니다.'], ['건의사항·정합성 검사', '건의 게시판, 재고 정합성 검사, 설정 변경 이력을 추가했습니다.']],
  feat: shotRow([imgFig('hazardous', '유해화학물질 관리대장 — 연간 일자별 집계'), imgFig('input-history', '원·부재료 투입이력 — Batch별 투입 내역')]),
  feat2: shotRow([imgFig('reports', '월간 보고서 — 재고현황 표·그래프(HTML)'), imgFig('suggestions', '건의사항 게시판 — 개선 요청 창구')]),
  lock: [['FIFO 자동 분배', '일괄 출고 시 가장 오래된 Lot(A01)부터 자동으로 나눠 차감합니다.'], ['Canister 90% 경고', '사이즈별 최대 무게의 90% 이상이면 빨간 테두리로 경고합니다.'], ['Task 완료 승인', '일반 사용자의 완료는 대기 상태가 되고 관리자 승인 시 완료됩니다.'], ['보관한도 경고', '유해물질이 설정 % 초과 시 경고해 위험 보관을 막습니다.']],
  bug: [['이력 등록 보완', '이력 등록 시 전체 용기를 선택할 수 있고 단위를 함께 저장합니다.'], ['Batch 번호 자동·리셋', '품목별 다음 번호 자동 채움, 연도별 리셋으로 번호 혼선을 없앴습니다.'], ['Task 마감 지연 처리', '마감일이 지난 Task를 자동으로 지연 표시합니다.']],
  learn: [['도메인 심화', '합성 Batch·BOM·유해물질 등 화학공장 실무 흐름을 모델링했습니다.'], ['보고서 자동화', '실데이터를 역산해 기간 보고서를 생성하는 로직을 구현했습니다.'], ['읽기전용 검증', '데이터를 보정하지 않고 점검만 하는 정합성 검사를 설계했습니다.'], ['오프라인 배포', 'node_modules 포함 ZIP·배치 실행 등 폐쇄망 배포 방식을 정립했습니다.']],
};

function navHtml(curId) {
  return `<div class="nav">${VERSIONS.map(v => `<a href="StockPilot_${v.id}_보고서.html" class="${v.id === curId ? 'cur' : ''}">${v.label}</a>`).join('')}</div>`;
}

function build(v) {
  const c = C[v.id];
  const featBody = (c.feat || '') + (c.feat2 || '');
  const body = `
${sec(1, '버전 컨셉', c.s1.lead, c.s1.body)}
${sec(2, '주요 내용', '', rows('', c.main))}
${sec(3, '기능 설명', '실제 화면 캡처입니다. (데이터는 예시용 가상데이터)', featBody)}
${sec(4, '기능 강화 · 인터락', '실수·사고·무단 접근을 막는 안전장치', rows('lock', c.lock))}
${sec(5, '버그 수정', '', rows('fix', c.bug))}
${sec(6, '학습 · 기술 포인트', '', rows('', c.learn))}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>StockPilot 개발 보고서 — ${v.tag}</title><style>${CSS}</style></head><body><div class="wrap">
<div class="hero"><span class="badge">StockPilot 개발 보고서</span><h1><span class="ver">${v.tag}</span></h1><p>${c.sub}</p>${navHtml(v.id)}</div>
${body}
<div class="foot">StockPilot · 화학공장 수불관리 시스템 — ${v.tag} ${c.sub}</div>
</div></body></html>`;
}

for (const v of VERSIONS) {
  const html = build(v);
  fs.writeFileSync(path.join(OUT, `StockPilot_${v.id}_보고서.html`), html);
  console.log('wrote', v.id, (html.length / 1024).toFixed(0) + 'KB');
}
console.log('done ->', OUT);
