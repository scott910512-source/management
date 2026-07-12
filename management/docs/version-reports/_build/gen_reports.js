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
  :root{--ink:#1d1d1f;--sub:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--blue:#0071e3;--card:#fff;--green:#34a853;--amber:#ff9f0a;--red:#ff3b30;--purple:#7d5fff;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:900px;margin:0 auto;padding:48px 24px 96px;}
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
  .sec .lead{font-size:15px;color:var(--sub);margin:4px 0 14px;}
  .sec h3{font-size:15px;font-weight:700;margin:22px 0 8px;color:var(--ink);}
  .rows{margin-top:16px;}
  .row{display:flex;align-items:baseline;gap:12px;padding:12px 0;border-top:1px solid var(--line);}
  .row:first-child{border-top:none;}
  .row .k{flex:0 0 auto;min-width:140px;font-size:15px;font-weight:600;color:var(--blue);}
  .row.lock .k{color:var(--green);}
  .row.fix .k{color:var(--red);}
  .row .v{font-size:15px;color:var(--ink);}
  .row .v code{font-family:"SFMono-Regular","Courier New",monospace;font-size:13px;background:#f0f4ff;color:#3a3fff;padding:1px 5px;border-radius:4px;}
  .shot{margin:18px 0 0;}
  .shot figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
  .shot img,.shot-row img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);background:#fff;}
  .shot svg,.shot-row svg{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);background:#fbfbfd;}
  .shot-row{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0 0;}
  .shot-row figure{flex:1 1 300px;margin:0;}
  .shot-row figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
  .vd{display:inline-block;font-size:11px;font-weight:600;color:var(--amber);background:rgba(255,159,10,.12);padding:1px 7px;border-radius:6px;margin-left:5px;vertical-align:middle;}
  pre{background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:18px 20px;font-family:"SFMono-Regular","Courier New",monospace;font-size:13px;line-height:1.6;overflow-x:auto;margin:14px 0;}
  pre .c{color:#6c7086;}
  pre .k{color:#cba6f7;}
  pre .s{color:#a6e3a1;}
  pre .n{color:#fab387;}
  pre .fn{color:#89dceb;}
  .arch-box{border:1.5px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0;background:#fbfbfd;}
  .arch-box .ab-title{font-size:13px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;}
  .arch-row{display:flex;align-items:center;gap:8px;font-size:14px;padding:5px 0;border-top:1px solid var(--line);}
  .arch-row:first-of-type{border-top:none;}
  .arch-row .ar-tag{flex:0 0 auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(0,113,227,.1);color:var(--blue);}
  .arch-row .ar-tag.green{background:rgba(52,168,83,.1);color:var(--green);}
  .arch-row .ar-tag.red{background:rgba(255,59,48,.1);color:var(--red);}
  .arch-row .ar-tag.purple{background:rgba(125,95,255,.1);color:var(--purple);}
  .arch-row .ar-tag.amber{background:rgba(255,159,10,.12);color:var(--amber);}
  .arch-row .ar-body{font-size:14px;color:var(--ink);}
  .arch-row .ar-body code{font-family:"SFMono-Regular","Courier New",monospace;font-size:12.5px;background:#f0f4ff;color:#3a3fff;padding:1px 5px;border-radius:4px;}
  .m-bar{fill:#f5f5f7;}.m-blue{fill:#0071e3;}.m-blue-soft{fill:rgba(0,113,227,.12);}.m-green{fill:#34a853;}
  .m-txt{fill:#86868b;font-size:9px;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-txt-d{fill:#1d1d1f;font-size:10px;font-weight:600;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-txt-w{fill:#fff;font-size:9px;font-weight:600;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;}
  .m-win{fill:#fff;stroke:#e5e5ea;}
  .foot{text-align:center;color:var(--sub);font-size:13px;margin-top:36px;}
  @media print{body{background:#fff;}.sec{box-shadow:none;border:1px solid var(--line);break-inside:avoid;}.hero{padding-top:0;}.nav{display:none;}pre{background:#f5f5f7;color:#1d1d1f;}}
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

const archBox = (title, items) => `<div class="arch-box"><div class="ab-title">${title}</div>${items.map(([tag, cls, body]) => `<div class="arch-row"><span class="ar-tag ${cls||''}">${tag}</span><span class="ar-body">${body}</span></div>`).join('')}</div>`;

function sec(n, title, lead, body) {
  return `<section class="sec"><div class="sec-head"><div class="sec-num">${n}</div><h2>${title}</h2></div>${lead ? `<p class="lead">${lead}</p>` : ''}${body}</section>`;
}

// ---- per-version content ----
const C = {};

// ===================== V1 =====================
C.v1 = {
  sub: '수기관리 통합을 위한 시스템 구축',
  s1: {
    lead: '종이·엑셀로 흩어진 수기 기록을 하나로 — DB 없이 폐쇄망에서 바로 운영 가능한 풀스택 구조 선택',
    body: `
<figure class="shot"><svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg">
  <text class="m-txt-d" x="95" y="22" text-anchor="middle">기존 (수기)</text>
  <rect class="m-win" x="30" y="34" width="60" height="76" rx="6"/><rect class="m-win" x="48" y="46" width="60" height="76" rx="6"/><rect class="m-win" x="66" y="58" width="60" height="76" rx="6"/>
  <text class="m-txt" x="96" y="100" text-anchor="middle">종이·엑셀</text><text class="m-txt" x="96" y="150" text-anchor="middle">흩어진 기록</text>
  <path d="M170 95 L250 95" stroke="#0071e3" stroke-width="2.5" marker-end="url(#a1)"/><text class="m-txt-d" x="210" y="86" text-anchor="middle" fill="#0071e3">통합</text>
  <rect class="m-win" x="265" y="45" width="92" height="80" rx="9"/><text class="m-txt-d" x="311" y="78" text-anchor="middle">React 18</text><text class="m-txt" x="311" y="94" text-anchor="middle">Vite 빌드</text><rect class="m-blue-soft" x="280" y="108" width="62" height="8" rx="3"/>
  <path d="M357 85 L389 85" stroke="#0071e3" stroke-width="2" marker-end="url(#a1)"/>
  <rect class="m-win" x="389" y="45" width="92" height="80" rx="9"/><text class="m-txt-d" x="435" y="78" text-anchor="middle">Express</text><text class="m-txt" x="435" y="94" text-anchor="middle">포트 4000</text><rect class="m-blue-soft" x="404" y="108" width="62" height="8" rx="3"/>
  <path d="M481 85 L513 85" stroke="#0071e3" stroke-width="2" marker-end="url(#a1)"/>
  <rect class="m-win" x="513" y="45" width="104" height="80" rx="9"/><text class="m-txt-d" x="565" y="78" text-anchor="middle">CSV 파일</text><text class="m-txt" x="565" y="94" text-anchor="middle">withLock 뮤텍스</text><rect class="m-green" x="528" y="108" width="74" height="8" rx="3" opacity="0.8"/>
  <text class="m-txt" x="400" y="158" text-anchor="middle">DB 설치 불필요 · 폐쇄망 즉시 운영 · 파일 직접 백업</text>
  <defs><marker id="a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#0071e3"/></marker></defs>
</svg><figcaption>수기 기록 → 풀스택 통합 시스템 (React · Express · CSV)</figcaption></figure>

<h3>아키텍처 선택 이유</h3>
${archBox('기술 선택 근거', [
  ['CSV 선택', 'green', 'PostgreSQL·MySQL 등 DB 설치 없이 폐쇄망에서 바로 실행 가능. 파일 복사만으로 백업·이관.'],
  ['withLock', 'blue', '동시 요청 시 CSV 파일 충돌 방지를 위해 <code>async-mutex</code> 기반 파일별 뮤텍스 구현'],
  ['Express', 'blue', '경량 서버로 포트 4000에서 REST API 제공. bcryptjs 세션 인증과 미들웨어 체계 구성'],
  ['React+Vite', 'blue', '빠른 HMR과 트리쉐이킹으로 번들 최소화. 외부 UI 라이브러리 없는 자체 디자인 시스템'],
])}

<h3>핵심 코드 패턴 — CSV 저장소</h3>
<pre><span class="c">// server/src/lib/store.js — readTable / mutate 패턴</span>
<span class="k">const</span> TABLES = {
  items: [<span class="s">'id'</span>, <span class="s">'category'</span>, <span class="s">'name'</span>, <span class="s">'unit'</span>, <span class="s">'safetyStock'</span>, ...],
  raw_materials: [<span class="s">'id'</span>, <span class="s">'itemId'</span>, <span class="s">'lotNo'</span>, <span class="s">'quantity'</span>, <span class="s">'weight'</span>, ...],
  users: [<span class="s">'id'</span>, <span class="s">'username'</span>, <span class="s">'password'</span>, <span class="s">'role'</span>, <span class="s">'approved'</span>, ...],
};

<span class="k">async function</span> <span class="fn">mutate</span>(table, plant, fn) {
  <span class="k">return</span> <span class="fn">withLock</span>(table, plant, <span class="k">async</span> () => {
    <span class="k">const</span> rows = <span class="k">await</span> <span class="fn">readTable</span>(table, plant);
    <span class="k">const</span> result = fn(rows);  <span class="c">// fn이 rows를 직접 수정</span>
    <span class="k">await</span> <span class="fn">writeTable</span>(table, plant, rows);
    <span class="k">return</span> result;
  });
}</pre>

<h3>인증 흐름</h3>
<pre><span class="c">// 가입 → 관리자 승인 → 로그인 순서</span>
POST /auth/register  → approved: <span class="s">'0'</span>  <span class="c">// 미승인 상태로 저장</span>
PATCH /admin/users/:id/approve → approved: <span class="s">'1'</span>
POST /auth/login → bcryptjs.compare(pw, hash) → session.user = { id, role }</pre>
`
  },
  main: [
    ['수불 관리', '원재료·부재료·Canister의 입고와 사용을 품목별로 기록. <code>transactions</code> 테이블에 type(입고/출고), quantity, materialId 저장.'],
    ['로그인 인증', '<code>bcryptjs</code> 단방향 해시로 비밀번호 저장. <code>express-session</code>으로 상태 유지. 미들웨어 <code>requireAuth</code>가 모든 API에서 세션 검증.'],
    ['가입 승인', '신규 가입은 <code>approved: "0"</code>으로 저장 → 관리자 PATCH로 <code>"1"</code>로 변경해야 로그인 가능. 무단 접근 차단.'],
    ['CSV 내보내기', '<code>\\uFEFF</code>(BOM) 앞에 붙여 엑셀에서 UTF-8 한글이 깨지지 않게 내려보냄. 헤더·데이터 행 순서 고정.'],
    ['디자인 시스템', 'CSS 변수(<code>--ink, --sub, --line, --blue, --green, --amber, --red</code>)로 Apple 스타일 색상 토큰 정립. 외부 라이브러리 없음.'],
  ],
  feat: shotOne('login', '로그인 화면 — 세션 인증 기반'),
  lock: [
    ['가입 승인 절차', '가입 후 <code>approved !== "1"</code>이면 <code>requireAuth</code> 미들웨어가 401 반환. 로그인 성공해도 서버 API 전체 차단.'],
    ['CSV BOM 처리', '<code>\\uFEFF</code> 바이트 순서 표시를 파일 맨 앞에 추가. 엑셀이 UTF-8로 자동 인식하여 한글 깨짐 방지.'],
    ['비밀번호 단방향 암호화', '<code>bcryptjs.hash(pw, 10)</code>으로 저장. 관리자도 원문 확인 불가. 로그인 시 <code>bcryptjs.compare</code>로 검증.'],
    ['동시 쓰기 잠금', 'CSV 파일마다 별도 뮤텍스. 동시에 두 요청이 들어와도 순차 처리되어 파일 손상 방지.'],
  ],
  bug: [
    ['동시 쓰기 충돌', '초기엔 파일 I/O가 경쟁 상태에서 빈 파일이 될 수 있었음 → <code>withLock</code> 뮤텍스 적용으로 해결.'],
    ['한글 인코딩 깨짐', 'CSV 저장·내보내기 전 구간에서 <code>utf-8</code>으로 통일하고 BOM 추가 → 엑셀 호환성 확보.'],
    ['세션 만료 미처리', '서버 재시작 시 세션이 초기화되는 현상 → 메모리 스토어 한계 인지, 향후 파일 스토어로 대응 계획.'],
  ],
  learn: [
    ['풀스택 구조 설계', 'React(화면) ↔ Express(API) ↔ CSV(저장) 3-tier 구조를 처음부터 직접 설계. 각 레이어의 책임 경계 정립.'],
    ['CSV 저장 선택 이유', 'PostgreSQL/MySQL 설치·관리 없이 폐쇄망에서 즉시 운영. 파일 복사만으로 백업·이관 가능한 단순성 채택.'],
    ['보안 인증 구현', '<code>bcryptjs</code> 단방향 해시 + <code>express-session</code> 쿠키 기반 인증. 미들웨어 체인으로 API 보호.'],
    ['커스텀 디자인 시스템', 'CSS 변수 기반 Apple 스타일 토큰 정립. 컴포넌트 <code>ui.jsx</code>에 Button·Modal·Toast·Badge 재사용 패턴 구축.'],
  ],
};

// ===================== V2 =====================
C.v2 = {
  sub: 'Lot 기반 재고 추적 시스템',
  s1: {
    lead: '입고일별 Lot 단위로 재고를 분리 추적하고, 품목 기준정보(단위·안전재고·업체·제품)를 마스터 테이블로 체계화',
    body: `
<h3>Lot 기반 데이터 구조</h3>
<pre><span class="c">// raw_materials 테이블 컬럼 (CSV 행 형태)</span>
{ id: <span class="s">'rm-xxxx'</span>, itemId: <span class="s">'it-xxxx'</span>, lotNo: <span class="s">'A2401'</span>,
  receivedDate: <span class="s">'2024-01-15'</span>, quantity: <span class="s">'200'</span>, weight: <span class="s">'200'</span>,
  vendor: <span class="s">'A업체'</span>, product: <span class="s">'제품A'</span>,
  createdBy: <span class="s">'user1'</span>, createdAt: <span class="s">'2024-01-15T09:00:00Z'</span> }

<span class="c">// items (품목 기준정보) 마스터 테이블</span>
{ id: <span class="s">'it-xxxx'</span>, category: <span class="s">'raw'</span>, name: <span class="s">'헥산'</span>,
  unit: <span class="s">'L'</span>, safetyStock: <span class="s">'100'</span>, warningPct: <span class="s">'150'</span>,
  vendor: <span class="s">'A업체'</span>, product: <span class="s">'제품A'</span> }</pre>

<h3>이중 안전재고 계산</h3>
<pre><span class="c">// 총 잔량 집계 후 두 가지 기준으로 판단</span>
<span class="k">const</span> totalQty = lots.<span class="fn">reduce</span>((s, l) => s + <span class="fn">num</span>(l.quantity), <span class="n">0</span>);
<span class="k">const</span> safetyStock = <span class="fn">num</span>(item.safetyStock);      <span class="c">// 절대 수량 기준</span>
<span class="k">const</span> warningPct = <span class="fn">num</span>(item.warningPct) / <span class="n">100</span>;  <span class="c">// % 기준 (예: 150%)</span>
<span class="k">const</span> isLow = totalQty &lt; safetyStock || totalQty &lt; safetyStock * warningPct;
<span class="c">// warningPct=150이면 안전재고의 1.5배 미만 시 경고</span></pre>

${archBox('테이블 구조', [
  ['items', 'blue', '품목 기준정보 마스터 — 단위·안전재고·업체·제품 저장. 트랜잭션이 참조하는 기준점.'],
  ['raw_materials', 'green', '원재료 Lot별 재고 — itemId 참조, receivedDate·quantity·weight 관리.'],
  ['sub_materials', 'green', '부재료 Lot별 재고 — 구조 동일. raw/sub를 라우터·저장소 모두 분리.'],
  ['canisters', 'purple', 'Canister 용기 — content(내용물), weight, size별 최대무게 비교로 90% 경고.'],
  ['transactions', 'amber', '수불 이력 — type(입고/출고), materialId, quantity, batchNo 통합 기록.'],
])}
`
  },
  main: [
    ['품목 기준정보', '<code>items</code> 마스터 테이블에 단위·안전재고·업체·제품 사전 등록. 입고/출고 시 품목 선택만으로 양식 자동 채움.'],
    ['Lot 단위 입고', '입고 시 <code>receivedDate + lotNo</code>를 키로 Lot 생성. 출고 시 해당 Lot의 <code>quantity</code>를 직접 차감하여 실시간 추적.'],
    ['이중 안전재고', '<code>safetyStock</code>(절대 기준수량)과 <code>warningPct</code>(% 기준) 두 가지로 부족 감지. % 기준은 "안전재고의 N% 미만" 조건.'],
    ['Canister 내용물·무게', '<code>canisters</code> 테이블에 content, weight 저장. 사이즈(200L/300L 등)별 최대무게 설정 → 90% 이상 시 경고.'],
    ['용기이력카드', '용기별 반입·반출 <code>transactions</code>를 필터링해 이력 카드로 조회. 이동·세척·파기까지 추적.'],
    ['수불이력 통합 조회', '원재료·부재료·Canister 수불을 <code>transactions</code> 한 테이블에서 <code>materialType</code>으로 구분 조회.'],
  ],
  feat: shotRow([imgFig('items', '품목 기준정보 — 단위·안전재고·업체·제품 설정'), imgFig('raw', '원재료 현황 — Lot별 잔량 추적')]),
  lock: [
    ['잔량 직접 차감', '출고 요청 시 해당 Lot의 <code>quantity -= 출고량</code> 즉시 반영. 음수 방지는 <code>Math.max(0, ...)</code>로 처리.'],
    ['이중 안전재고', '<code>safetyStock</code> 절대값 + <code>warningPct</code> % 기준 두 가지 중 하나라도 미달 시 경고 발생.'],
    ['입고일 필수 검증', '입고일 없으면 서버에서 <code>badRequest(\'입고일을 입력하세요\')</code> 반환. FIFO 계산의 기준값이 되므로 필수.'],
  ],
  bug: [
    ['단위 선택 미제공', '초기엔 단위가 고정(kg)이었음 → items 마스터에 unit 필드 추가, kg·ea·L·기타 선택 가능하도록 변경.'],
    ['동시 쓰기 충돌', '<code>withLock</code> 뮤텍스를 <code>raw_materials</code>·<code>sub_materials</code> 별도 적용. 테이블별 독립 잠금 구조.'],
    ['빈 Lot 목록 노출', '잔량 0인 Lot도 목록에 표시되어 혼란 → quantity <= 0 필터로 기본 숨김, 이력 조회에선 포함.'],
  ],
  learn: [
    ['마스터-트랜잭션 분리', '기준정보(마스터)와 수불(트랜잭션)을 별도 테이블로 분리하는 패턴. 마스터 변경이 이력에 영향 없도록 설계.'],
    ['Lot 재고 모델', 'Lot별 잔량 직접 관리 vs. 이벤트 소싱 중 전자 채택. CSV 환경에서 집계 연산 비용 절감.'],
    ['파일 뮤텍스 설계', '테이블 단위 뮤텍스로 서로 다른 테이블 동시 접근은 허용, 같은 테이블 동시 접근만 직렬화.'],
  ],
};

// ===================== V3 =====================
C.v3 = {
  sub: '운영 대시보드 · 경고 · Task · FIFO',
  s1: {
    lead: '경고·퀵메뉴·Task를 한 화면으로 통합하고, 선입선출(FIFO) 위반을 서버에서 자동 감지하여 409로 차단',
    body: `
<h3>FIFO 위반 감지 알고리즘</h3>
<pre><span class="c">// server/src/routes/transactions.js — 선입선출 검증</span>
<span class="k">function</span> <span class="fn">findEarlierLot</span>(lots, currentLotId, currentReceivedDate) {
  <span class="k">return</span> lots.<span class="fn">find</span>(l =>
    l.id !== currentLotId &&
    <span class="fn">num</span>(l.quantity) > <span class="n">0</span> &&
    l.receivedDate < currentReceivedDate  <span class="c">// 더 오래된 Lot 존재</span>
  );
}

<span class="c">// 출고 처리 시 FIFO 위반 감지</span>
<span class="k">if</span> (!force) {
  <span class="k">const</span> earlier = <span class="fn">findEarlierLot</span>(lots, lotId, lot.receivedDate);
  <span class="k">if</span> (earlier) {
    <span class="fn">recordAnomaly</span>(req.plant, { <span class="c">/* FIFO 위반 자동 기록 */</span> });
    <span class="k">throw</span> { status: <span class="n">409</span>, earlierLot: earlier };  <span class="c">// 프론트에서 경고 표시</span>
  }
}
<span class="c">// force=true 시 → anomalies 테이블에 이상발생 자동 기록</span></pre>

<h3>경고 생성 로직</h3>
<pre><span class="c">// GET /dashboard/warnings — 여러 소스를 집계</span>
<span class="k">const</span> warnings = [];
<span class="c">// 1) 안전재고 부족</span>
items.<span class="fn">forEach</span>(item => {
  <span class="k">if</span> (totalQty &lt; <span class="fn">num</span>(item.safetyStock)) warnings.<span class="fn">push</span>({ type: <span class="s">'stock'</span>, ... });
});
<span class="c">// 2) Canister 90% 초과</span>
canisters.<span class="fn">forEach</span>(c => {
  <span class="k">if</span> (<span class="fn">num</span>(c.weight) > maxWeight * <span class="n">0.9</span>) warnings.<span class="fn">push</span>({ type: <span class="s">'canister'</span>, ... });
});
<span class="c">// 3) Task 마감 지연</span>
tasks.<span class="fn">filter</span>(t => t.dueDate &lt; today && t.status !== <span class="s">'done'</span>)
  .<span class="fn">forEach</span>(t => warnings.<span class="fn">push</span>({ type: <span class="s">'task'</span>, ... }));</pre>
`
  },
  main: [
    ['FIFO 인터락', '출고 시 <code>findEarlierLot()</code>로 더 오래된 Lot 존재 여부 확인 → 있으면 409 반환. 프론트에서 경고 다이얼로그 표시.'],
    ['이상발생 자동기록', 'FIFO 강제 출고(force=true) 시 <code>anomalies</code> 테이블에 자동 기록. 담당자·사유·Lot정보 포함.'],
    ['경고 대시보드', '안전재고 부족·Canister 90% 초과·Task 지연을 서버에서 집계 → 종합현황 상단 배너로 표시.'],
    ['퀵메뉴', '원재료 입고·출고, 부재료 입고·출고, Canister 수불을 Dashboard에서 모달로 바로 시작.'],
    ['Task 관리', '<code>tasks</code> 테이블에 title·assignee·priority·dueDate·status 저장. 상태: pending → in-progress → done → approved.'],
    ['트렌드 분석', '<code>transactions</code>를 월/주 단위로 집계. 품목별 입출고 추이를 Bar 차트로 시각화.'],
  ],
  feat: shotRow([imgFig('anomalies', '이상발생 목록 — FIFO 강제 사용 기록'), imgFig('tasks', 'Task 관리 — 담당자·우선순위·완료')]),
  lock: [
    ['FIFO 인터락', '<code>findEarlierLot()</code>: 현재 Lot보다 <code>receivedDate</code>가 이전이고 잔량 > 0인 Lot 존재 시 409 차단. force=true만 허용.'],
    ['경고 확인(ack)', '경고 항목마다 확인 인원 수 카운트. 미확인 경고는 배너에 숫자로 강조하여 누락 없이 처리 유도.'],
    ['Lot 1개 예외', 'Lot이 1개뿐이면 FIFO 검사를 건너뜀. 선택지가 없는 상황에서 불필요한 경고 방지.'],
    ['입고일 필수', '입고일 누락 시 FIFO receivedDate 비교 불가 → 서버 <code>badRequest</code>로 차단.'],
  ],
  bug: [
    ['빈 Lot 숨김', '잔량 0인 Lot이 목록에 남아 FIFO 검사에서 오탐 → <code>quantity > 0</code> 필터 적용. 이력 조회는 별도 포함.'],
    ['입고일 누락 허용', '초기엔 입고일 없이도 저장 → FIFO 날짜 비교 오류 발생. <code>required</code> 검증 추가.'],
    ['Task 마감 미처리', '마감일 지난 Task가 상태 변화 없이 남아있음 → GET /tasks에서 dueDate 비교 후 자동 지연 표시.'],
  ],
  learn: [
    ['FIFO 알고리즘', '입고일 기준 정렬 후 현재 Lot보다 오래된 잔량 존재 여부 확인. 단순 비교지만 날짜 포맷 통일이 핵심.'],
    ['409 상태 코드 활용', '비즈니스 규칙 위반(FIFO)에 409 Conflict 사용. 프론트에서 이 코드를 명시적으로 처리해 사용자 선택지 제공.'],
    ['서버 집계 vs 클라이언트 집계', '경고·통계를 서버에서 미리 집계해 클라이언트 데이터 처리 부담 제거. 큰 CSV도 한 번만 읽어 다양한 집계 동시 수행.'],
  ],
};

// ===================== V3.1 =====================
C.v3_1 = {
  sub: 'UI/UX 개선 — 그룹핑·자동채움·색상 강조',
  s1: {
    lead: '현황을 제품별로 묶고 색상·뱃지로 구분 — 많은 데이터를 한눈에 읽히는 구조로 개선',
    body: `
<h3>제품별 그룹핑 구현</h3>
<pre><span class="c">// client/src/pages/RawMaterials.jsx</span>
<span class="c">// product 필드로 Lot을 그룹화해 섹션별 렌더링</span>
<span class="k">const</span> grouped = <span class="fn">useMemo</span>(() => {
  <span class="k">const</span> map = <span class="k">new</span> Map();
  lots.<span class="fn">forEach</span>(lot => {
    <span class="k">const</span> key = lot.product || <span class="s">'기타'</span>;
    <span class="k">if</span> (!map.<span class="fn">has</span>(key)) map.<span class="fn">set</span>(key, []);
    map.<span class="fn">get</span>(key).<span class="fn">push</span>(lot);
  });
  <span class="k">return</span> [...map.<span class="fn">entries</span>()].<span class="fn">sort</span>(...);
}, [lots]);</pre>

<h3>안전재고 부족 시각화</h3>
<pre><span class="c">// 행별 CSS 클래스 분기 — 빨간색·노란색·정상</span>
<span class="k">const</span> <span class="fn">statusClass</span> = (totalQty, safetyStock, warningPct) => {
  <span class="k">if</span> (totalQty &lt;= safetyStock) <span class="k">return</span> <span class="s">'row-danger'</span>;   <span class="c">// 빨간색</span>
  <span class="k">if</span> (totalQty &lt; safetyStock * (warningPct/<span class="n">100</span>)) <span class="k">return</span> <span class="s">'row-warn'</span>;  <span class="c">// 노란색</span>
  <span class="k">return</span> <span class="s">''</span>;
};</pre>

<h3>품목 선택 자동 채움</h3>
<pre><span class="c">// 품목 선택 onChange → 단위·업체·Lot 양식 자동 입력</span>
<span class="k">const</span> <span class="fn">handleItemSelect</span> = (itemId) => {
  <span class="k">const</span> item = items.<span class="fn">find</span>(i => i.id === itemId);
  <span class="fn">setForm</span>(f => ({ ...f,
    unit: item.unit, vendor: item.vendor,
    product: item.product, defaultQty: item.defaultQty,
    lotPattern: item.lotPattern,  <span class="c">// Lot 번호 양식</span>
  }));
};</pre>
`
  },
  main: [
    ['제품별 그룹핑', '<code>product</code> 필드 기준으로 원·부재료 현황을 섹션으로 분리. <code>useMemo</code>로 Map 구조화. Canister는 content(내용물)별 그룹.'],
    ['안전재고 색상 강조', '잔량 ≤ <code>safetyStock</code> 시 빨간색 행, <code>safetyStock * warningPct/100</code> 미만 시 노란색 강조.'],
    ['품목 선택 자동 채움', '품목 선택 시 <code>unit·vendor·product·defaultQty·lotPattern</code> 자동 채움. 오입력·누락 방지.'],
    ['상태 뱃지 시스템', '정상(초록)·임박(노란)·부족(빨간) 뱃지를 CSS 변수 기반으로 일관 적용.'],
    ['퀵메뉴 그룹 박스', '원재료/부재료/Canister 퀵메뉴를 묶음 박스로 시각 구분. 아이콘 SVG 라인 세트 통일.'],
    ['다음 사용 Lot 표시', '각 품목 그룹의 가장 오래된(receivedDate 최소) Lot 번호를 "다음 사용 Lot"으로 강조 표시.'],
  ],
  feat: shotRow([imgFig('raw', '원재료 현황 — 제품별 음영 구분·부족 강조'), imgFig('items', '품목 선택 시 단위·양식 자동 채움')]),
  lock: [
    ['자동 채움 인터락', '품목 선택만으로 단위·업체가 채워져 수동 입력 오류 방지. 단위가 다른 품목을 같은 단위로 출고하는 실수 차단.'],
    ['부족 강조 강제', '안전재고 미달 행을 빨간색으로 강제 노출. 눈에 안 띄어 넘어가는 경우를 CSS로 차단.'],
  ],
  bug: [
    ['용어 혼동', '"등록"/"입력" 혼용 → "입고" 단어로 통일. 출고는 "출고/사용"으로 일관 처리.'],
    ['설정 메뉴 분산', '관리자 설정이 여러 페이지에 흩어져 있었음 → <code>Settings</code> 단일 관리자 페이지로 통합.'],
    ['그룹 없는 품목 처리', 'product 필드 없는 Lot이 그룹 로직에서 누락 → <code>product || \'기타\'</code> 폴백 처리.'],
  ],
  learn: [
    ['정보 구조화 원칙', '많은 행을 단순 스크롤 대신 그룹·색상으로 묶어 가독성 향상. 사용자가 찾아야 할 항목을 시각적으로 우선 노출.'],
    ['useMemo 최적화', '그룹핑 연산을 <code>useMemo</code>로 메모이즈. lots 데이터 변경 시에만 재계산하여 렌더링 성능 유지.'],
    ['디자인 토큰 일관성', 'CSS 변수로 색상 토큰 정의. 모든 상태 표시가 동일한 변수를 참조하여 테마 변경 시 일괄 반영 가능.'],
  ],
};

// ===================== V4 =====================
C.v4 = {
  sub: '멀티 공장 분리 운영 · 자동 백업',
  s1: {
    lead: '1공장·2공장 데이터를 폴더 단위로 완전 분리하고, X-Plant HTTP 헤더로 공장 컨텍스트 전달 — 서버 시작 시 자동 백업',
    body: `
<h3>공장별 데이터 분리 구조</h3>
<pre><span class="c">// server/data/ 폴더 구조</span>
server/data/
├── 1공장/
│   ├── items.csv
│   ├── raw_materials.csv
│   ├── transactions.csv
│   └── ...
├── 2공장/
│   └── ...  <span class="c">// 완전 독립 파일셋</span>
└── users.csv  <span class="c">// 공통 — 공장 구분 없음</span></pre>

<h3>X-Plant 헤더 처리</h3>
<pre><span class="c">// client: 한글 공장명 → URL 인코딩</span>
headers: { <span class="s">'X-Plant'</span>: <span class="fn">encodeURIComponent</span>(currentPlant) }

<span class="c">// server/src/middleware/plant.js — 복호화 + 경로 생성</span>
<span class="k">const</span> <span class="fn">resolvePlant</span> = (req, res, next) => {
  <span class="k">const</span> plant = <span class="fn">decodeURIComponent</span>(req.headers[<span class="s">'x-plant'</span>] || <span class="s">''</span>);
  <span class="k">if</span> (!plant) <span class="k">return</span> <span class="fn">next</span>(<span class="fn">badRequest</span>(<span class="s">'공장을 선택하세요.'</span>));
  req.plant = plant;  <span class="c">// 이후 readTable/mutate에서 폴더 경로로 사용</span>
  <span class="fn">next</span>();
};

<span class="c">// store.js: plant 인자 → 파일 경로 결정</span>
<span class="k">const</span> <span class="fn">filePath</span> = (table, plant) =>
  path.<span class="fn">join</span>(DATA_DIR, plant || <span class="s">''</span>, table + <span class="s">'.csv'</span>);</pre>

<h3>서버 시작 시 자동 백업</h3>
<pre><span class="c">// server/src/index.js — 서버 기동 시 스냅샷</span>
<span class="k">async function</span> <span class="fn">createBackup</span>() {
  <span class="k">const</span> stamp = <span class="k">new</span> <span class="fn">Date</span>().<span class="fn">toISOString</span>().<span class="fn">replace</span>(/[:.]/g, <span class="s">'-'</span>);
  <span class="k">const</span> dest = path.<span class="fn">join</span>(BACKUP_DIR, stamp);
  <span class="k">await</span> fs.<span class="fn">cp</span>(DATA_DIR, dest, { recursive: <span class="k">true</span> });
  <span class="c">// 최근 20개만 보관 — 오래된 것 자동 삭제</span>
  <span class="k">const</span> backups = fs.<span class="fn">readdirSync</span>(BACKUP_DIR).<span class="fn">sort</span>();
  <span class="k">if</span> (backups.length > <span class="n">20</span>) {
    backups.<span class="fn">slice</span>(<span class="n">0</span>, backups.length - <span class="n">20</span>).<span class="fn">forEach</span>(b =>
      fs.<span class="fn">rmSync</span>(path.<span class="fn">join</span>(BACKUP_DIR, b), { recursive: <span class="k">true</span> }));
  }
}</pre>
`
  },
  main: [
    ['공장별 데이터 분리', '<code>server/data/1공장/</code>, <code>server/data/2공장/</code> 폴더로 완전 분리. <code>users.csv</code>만 공통(공장 인자 없이 접근).'],
    ['X-Plant 헤더', '모든 API 요청에 <code>X-Plant: encodeURIComponent(공장명)</code> 전송. 서버 미들웨어 <code>resolvePlant</code>에서 디코딩 → <code>req.plant</code>로 주입.'],
    ['공장 선택기', '사이드바 드롭다운 — 로그인 응답의 <code>plants[]</code> 배열에서 권한 있는 공장만 표시. 선택 시 <code>localStorage</code>에 저장.'],
    ['자동 백업', '서버 시작(<code>index.js</code>)마다 <code>createBackup()</code> 실행. 타임스탬프 폴더로 스냅샷. 최신 20개만 보관.'],
    ['데이터 보존 정책', '배포/업데이트 시 <code>server/data/</code> 폴더를 절대 덮어쓰지 않음. 코드와 데이터 폴더 분리로 안전 업데이트.'],
    ['권한 기반 공장 노출', '로그인 응답에 <code>plants: ["1공장"]</code> 같이 허용 공장 목록 포함. UI에서 허용 공장만 선택 가능.'],
  ],
  feat: shotOne('admin', '관리자 설정 — 공장·사용자·백업 관리'),
  lock: [
    ['데이터 보존', '업데이트 스크립트에서 <code>server/data/</code> 폴더는 건드리지 않는 규칙. 배포가 기존 자료를 덮어쓰지 못함.'],
    ['자동 백업 안전망', '서버 켤 때마다 백업 → 잘못 저장 후에도 이전 스냅샷으로 복구 가능. 20개 보관 한도로 디스크 관리.'],
    ['권한 기반 차단', '서버에서 <code>req.user.plants.includes(req.plant)</code> 검사. 허용 안 된 공장 요청은 403 반환.'],
    ['공통 데이터 분리', '<code>users</code> 등 전체 공통 데이터는 plant 인자 없이 루트 data 폴더 사용. 공장 컨텍스트 오염 방지.'],
  ],
  bug: [
    ['한글 헤더 깨짐', 'HTTP 헤더에 한글 직접 포함 시 일부 브라우저·서버에서 깨짐 → <code>encodeURIComponent</code> ↔ <code>decodeURIComponent</code> 쌍으로 해결.'],
    ['공통 데이터 공장 혼용', '초기엔 users 테이블에도 plant 인자 전달 → 공장별 users.csv가 생성되는 문제 → 전역 테이블 목록 <code>GLOBAL_TABLES</code>로 분리.'],
    ['권한 빈값 허용', '역할 체크에서 빈 문자열이 전체 허용으로 통과되는 버그 → 명시적 허용 목록 배열로 교체.'],
  ],
  learn: [
    ['멀티테넌시 설계', '폴더 경로를 런타임 파라미터로 변경하는 방식으로 테넌트(공장)별 데이터 격리. DB 파티션 없이 파일 시스템으로 구현.'],
    ['HTTP 헤더 인코딩', 'RFC 7230: HTTP 헤더 값은 Latin-1 범위여야 함. 한글은 percent-encoding 필수. 클라-서버 쌍으로 처리해야 완성.'],
    ['백업 전략', '스냅샷(전체 복사) vs. 증분 백업 중 단순성으로 스냅샷 채택. 보관 한도(20개)로 무제한 증가 방지.'],
  ],
};

// ===================== V5 =====================
C.v5 = {
  sub: '역할 5종 세분화 · 공장 간 격리',
  s1: {
    lead: '관리자·공장관리자·팀관리자(조회전용)·사용자 역할별 권한을 미들웨어로 강제 — 공장 간 데이터 완전 격리',
    body: `
<h3>역할 정의 및 권한 매핑</h3>
<pre><span class="c">// 역할 5종: admin · admin1 · admin2 · team · user</span>
<span class="k">const</span> ROLE_PLANTS = {
  admin:  <span class="k">null</span>,         <span class="c">// 전체 공장 접근</span>
  admin1: [<span class="s">'1공장'</span>],   <span class="c">// 1공장만</span>
  admin2: [<span class="s">'2공장'</span>],   <span class="c">// 2공장만</span>
  team:   <span class="k">null</span>,         <span class="c">// 전체 조회 가능 (읽기 전용)</span>
  user:   <span class="s">'own-plant'</span>, <span class="c">// 본인 배속 공장만</span>
};</pre>

<h3>미들웨어 3단계 방어</h3>
<pre><span class="c">// server/src/middleware/auth.js</span>
<span class="k">const</span> <span class="fn">requireAuth</span> = (req, res, next) => {
  <span class="k">if</span> (!req.session?.user) <span class="k">return</span> res.<span class="fn">status</span>(<span class="n">401</span>).<span class="fn">json</span>({ error: <span class="s">'로그인 필요'</span> });
  next();
};

<span class="k">const</span> <span class="fn">requireAdmin</span> = (req, res, next) => {
  <span class="k">if</span> (![<span class="s">'admin'</span>,<span class="s">'admin1'</span>,<span class="s">'admin2'</span>].<span class="fn">includes</span>(req.session.user.role))
    <span class="k">return</span> res.<span class="fn">status</span>(<span class="n">403</span>).<span class="fn">json</span>({ error: <span class="s">'관리자 전용'</span> });
  next();
};

<span class="k">const</span> <span class="fn">requireWrite</span> = (req, res, next) => {
  <span class="k">if</span> (req.session.user.role === <span class="s">'team'</span>)  <span class="c">// 조회전용 전역 차단</span>
    <span class="k">return</span> res.<span class="fn">status</span>(<span class="n">403</span>).<span class="fn">json</span>({ error: <span class="s">'조회 전용 계정'</span> });
  next();
};

<span class="c">// 공장 접근 권한 검사 (resolvePlant 내부)</span>
<span class="k">const</span> allowed = ROLE_PLANTS[role];
<span class="k">if</span> (allowed && !allowed.<span class="fn">includes</span>(plant))
  <span class="k">return</span> res.<span class="fn">status</span>(<span class="n">403</span>).<span class="fn">json</span>({ error: <span class="s">'접근 권한 없는 공장'</span> });</pre>

<h3>클라이언트 이중 방어</h3>
<pre><span class="c">// 버튼 숨김 — 서버 차단 + UI 숨김 이중 방어</span>
{ canWrite && &lt;Button onClick={handleSubmit}&gt;저장&lt;/Button&gt; }
<span class="c">// canWrite = user.role !== 'team'</span></pre>
`
  },
  main: [
    ['역할 5종', '<code>admin</code>(전체), <code>admin1</code>(1공장), <code>admin2</code>(2공장), <code>team</code>(전체조회), <code>user</code>(배속공장). 로그인 응답에 <code>role</code>·<code>plants</code> 포함.'],
    ['조회전용 전역 차단', '<code>requireWrite</code> 미들웨어: team 역할이 POST·PATCH·DELETE 요청 시 모두 403. 라우터별 적용이 아닌 공통 미들웨어로 일괄 처리.'],
    ['공장 간 격리', '<code>resolvePlant</code>: 요청한 공장이 역할 허용 목록에 없으면 403. admin1이 2공장 데이터에 접근하면 차단.'],
    ['쓰기 버튼 숨김', '클라이언트에서 <code>canWrite</code> 체크로 수정·삭제 버튼 숨김. 서버 차단과 이중 방어.'],
    ['역할 뱃지·라벨', '사이드바에 현재 역할 표시. 조회전용(team)은 주황색 "조회 전용" 뱃지로 시각 구분.'],
    ['공장 목록 응답', '로그인 POST /auth/login 응답에 <code>plants: ["1공장"]</code> 포함. 프론트가 이 목록으로 선택기 구성.'],
  ],
  feat: shotOne('login', '로그인 — 응답에 접근 가능 공장 목록 포함'),
  lock: [
    ['조회전용 전역 차단', '<code>requireWrite</code>가 모든 수정 라우터에 적용. team 역할은 어떤 API로도 데이터를 변경할 수 없음.'],
    ['공장 경계 강제', '서버에서 역할별 허용 공장 목록과 요청 공장을 비교. 클라이언트 조작으로 우회 불가.'],
    ['이중 방어', '버튼 숨김(UX)과 미들웨어 차단(보안) 두 층으로 운영. 버튼이 보여도 API 차단, API를 직접 호출해도 차단.'],
  ],
  bug: [
    ['테스트 일관성 확보', 'user1=2공장/user2=1공장으로 고정하여 RBAC 교차 테스트 가능하도록 테스트 계정 정리.'],
    ['공장 없는 요청 처리', 'X-Plant 헤더 없는 요청에서 <code>null</code> plant로 파일 경로 오류 → 빈 plant는 <code>badRequest</code>로 명시 차단.'],
  ],
  learn: [
    ['RBAC 패턴', '역할별 허용 액션을 미들웨어 함수로 분리. 라우터에 <code>router.post("/", requireWrite, requireAdmin, handler)</code> 체인 구성.'],
    ['이중 방어 원칙', 'UI 숨김은 UX, API 차단은 보안. 둘 중 하나만으론 부족 — 항상 서버가 최종 권한 결정자.'],
    ['최소 권한 원칙', '역할마다 필요한 최소한의 공장·액션만 허용. 명시적 허용 목록 방식(whitelist) 채택.'],
  ],
};

// ===================== V6 =====================
C.v6 = {
  sub: 'AI 자연어 검색 (폐쇄망 호환) · 사용자 메뉴얼',
  s1: {
    lead: '외부 LLM 없이 폐쇄망에서 동작하는 규칙 기반 자연어 파싱 엔진 — 기간·품목·동작을 정규식으로 추출하여 실데이터로 답변',
    body: `
<h3>자연어 파싱 엔진 구조</h3>
<pre><span class="c">// server/src/routes/search.js — 규칙 기반 파싱</span>

<span class="c">// 1단계: 기간 추출</span>
<span class="k">const</span> PERIOD_RULES = [
  { pattern: /오늘/, <span class="fn">resolve</span>: () => [today, today] },
  { pattern: /이번\s*주/, <span class="fn">resolve</span>: () => [weekStart, weekEnd] },
  { pattern: /지난\s*달/, <span class="fn">resolve</span>: () => [lastMonthStart, lastMonthEnd] },
  { pattern: /올해/, <span class="fn">resolve</span>: () => [yearStart, today] },
  { pattern: /(\d+)\s*월/, <span class="fn">resolve</span>: (m) => [<span class="fn">monthStart</span>(m[1]), <span class="fn">monthEnd</span>(m[1])] },
];

<span class="c">// 2단계: 동작 분류</span>
<span class="k">const</span> ACTION_RULES = [
  { pattern: /사용량|사용/, action: <span class="s">'usage'</span> },
  { pattern: /입고량|입고/, action: <span class="s">'inbound'</span> },
  { pattern: /현재\s*재고|잔량/, action: <span class="s">'stock'</span> },
  { pattern: /부족|안전재고/, action: <span class="s">'shortage'</span> },
  { pattern: /이상발생/, action: <span class="s">'anomaly'</span> },
];

<span class="c">// 3단계: 품목명 추출 — items 마스터와 교차 매칭</span>
<span class="k">const</span> matched = items.<span class="fn">filter</span>(i =>
  query.<span class="fn">includes</span>(i.name) || query.<span class="fn">includes</span>(i.vendor)
);</pre>

<h3>답변 생성 — 실데이터 기반</h3>
<pre><span class="c">// 집계 후 자연어 답변 조립 (LLM 없음)</span>
<span class="k">if</span> (action === <span class="s">'usage'</span>) {
  <span class="k">const</span> total = txs
    .<span class="fn">filter</span>(t => t.type === <span class="s">'출고'</span> && inRange(t.date, period))
    .<span class="fn">reduce</span>((s, t) => s + <span class="fn">num</span>(t.quantity), <span class="n">0</span>);
  answer = <span class="s">\`\${period} 동안 \${itemName} 사용량은 \${total}\${unit} 입니다.\`</span>;
  <span class="c">// 실제 transactions 데이터만 사용 → 환각 없음</span>
}</pre>
`
  },
  main: [
    ['자연어 파싱 엔진', '정규식 규칙 배열로 기간·동작·품목을 추출. LLM 불필요, 폐쇄망에서 완전 동작. <code>server/src/routes/search.js</code>에 구현.'],
    ['기간 표현 해석', '<code>오늘·이번주·지난달·올해·N월·N월~M월</code> 등 패턴을 <code>Date</code> 범위로 변환. 연도 없으면 현재 연도 기본값.'],
    ['동작 분류', '사용량·입고량·현재고·부족품목·이상발생·Canister·수불이력 7가지 동작으로 분류 후 해당 데이터 집계.'],
    ['표+답변 동시 제공', '집계 결과를 <code>rows[]</code>(테이블)와 <code>answer</code>(자연어 문장) 두 가지로 응답. 프론트에서 양쪽 동시 렌더링.'],
    ['예시 칩', '자주 쓰는 검색어를 칩 버튼으로 제공. 클릭 시 입력창에 채워 바로 검색. 신규 사용자 온보딩 역할.'],
    ['사용자 메뉴얼', '이미지+설명 구성의 <code>/manual</code> 페이지 추가. 화면별 기능 설명, 자주 묻는 질문 포함.'],
  ],
  feat: shotRow([imgFig('search', 'AI 검색 — 예시 칩 + 자연어 답변'), imgFig('manual', '사용자 메뉴얼 — 이미지+설명 안내')]),
  lock: [
    ['실데이터 기반 답변', '<code>transactions</code>·<code>raw_materials</code> 등 실제 저장 데이터로만 집계. 숫자를 만들어내지 않아 신뢰도 유지.'],
    ['폐쇄망 호환', '외부 API 호출 없음. 서버 내 규칙 엔진만으로 동작. 인터넷 연결 없는 공장 내부망에서도 완전 기능.'],
    ['메뉴얼 정보 노출 제어', '메뉴얼 페이지에서 로그인 계정·비밀번호 정보 제거. 비인가자가 메뉴얼을 보더라도 보안 정보 노출 방지.'],
  ],
  bug: [
    ['메뉴얼 보안 정보 노출', '초기 메뉴얼에 테스트 계정 포함 → 로그인·계정 관련 내용 전면 삭제. 운영 중에도 접근 가능한 페이지이므로 주의.'],
    ['기간 없는 쿼리', '품목명만 입력 시 기간 기본값 없어 빈 결과 → 기간 없으면 "최근 30일" 기본 적용.'],
    ['품목명 부분 매칭', '짧은 품목명이 긴 품목명 일부에 매칭되는 오탐 → 최장 매칭 우선(greedy match) 방식으로 수정.'],
  ],
  learn: [
    ['규칙 기반 NLP', '정규식 배열 + 우선순위 순회로 자연어 파싱. LLM보다 비용·속도·예측 가능성 면에서 실무 환경에 적합.'],
    ['환각(Hallucination) 방지', 'AI 답변의 핵심 위험. 실데이터로만 계산하고 결과가 없으면 "데이터 없음"으로 명확히 응답.'],
    ['온보딩 UX', '예시 칩·메뉴얼은 기능 발견을 돕는 설계. 새 기능을 사용자가 스스로 찾아야 한다면 도입률이 낮아짐.'],
  ],
};

// ===================== V7 =====================
C.v7 = {
  sub: '현행 고도화 — Batch·품목그룹·유해물질·정기업무·신호등·재고원복',
  s1: {
    lead: '배치 일괄처리 FIFO 분배, 품목그룹 기반 BOM, 유해화학물질 관리대장, 정기 업무 자동생성, 재고 신호등, 수불 삭제 시 재고 원복까지 현장 요구사항 전면 구현',
    body: `
<h3>핵심 기능 아키텍처 요약</h3>
${archBox('V7 주요 기술 컴포넌트', [
  ['FIFO 배치', 'blue', '<code>fifoPlan()</code>: BOM × 배치수량 → Lot별 배분 계획. 최고참 Lot부터 자동 할당.'],
  ['품목그룹', 'green', '<code>itemGroup</code> 필드: 납품업체가 다른 동일 자재를 그룹화. BOM은 그룹명 기준으로 매칭.'],
  ['재고원복', 'red', '수불 삭제 시 delta 계산 → Lot 잔량 복원. 출고 삭제 = +qty, 입고 삭제 = -qty.'],
  ['정기업무', 'purple', '<code>materializeRecurring()</code>: GET /tasks 호출 시 주기별 Task 자동 생성. period 키로 중복 방지.'],
  ['유해물질대장', 'amber', '<code>buildLedger()</code>: transactions 집계 → 일별 이월 체인 계산 → 수동 오버라이드 지원.'],
  ['신호등', 'green', '<code>SignalLight</code> 컴포넌트: 안전재고 기준 red/amber/green 3색 표시.'],
])}

<h3>FIFO 배치 분배 알고리즘</h3>
<pre><span class="c">// client/src/components/BulkUseModal.jsx — fifoPlan()</span>
<span class="k">function</span> <span class="fn">fifoPlan</span>(lots, neededQty) {
  <span class="k">const</span> sorted = [...lots].<span class="fn">sort</span>((a,b) =>
    a.receivedDate.localeCompare(b.receivedDate));  <span class="c">// 오래된 순</span>
  <span class="k">const</span> plan = [];
  <span class="k">let</span> remain = neededQty;
  <span class="k">for</span> (<span class="k">const</span> lot <span class="k">of</span> sorted) {
    <span class="k">if</span> (remain &lt;= <span class="n">0</span>) <span class="k">break</span>;
    <span class="k">const</span> take = <span class="fn">Math.min</span>(<span class="fn">num</span>(lot.quantity), remain);
    plan.<span class="fn">push</span>({ lotId: lot.id, lotNo: lot.lotNo, take });
    remain -= take;
  }
  <span class="k">return</span> { plan, shortage: remain };  <span class="c">// shortage > 0이면 재고 부족</span>
}</pre>

<h3>수불 삭제 시 재고 원복</h3>
<pre><span class="c">// server/src/routes/transactions.js — 삭제 + 재고 원복</span>
<span class="k">const</span> delta = (t.type === <span class="s">'출고'</span> || t.type === <span class="s">'반출'</span>)
  ? +<span class="fn">num</span>(t.quantity)   <span class="c">// 출고 삭제 → 재고 증가</span>
  : -<span class="fn">num</span>(t.quantity);  <span class="c">// 입고 삭제 → 재고 감소</span>
<span class="k">await</span> <span class="fn">mutate</span>(materialTable, req.plant, (rows) => {
  <span class="k">const</span> lot = rows.<span class="fn">find</span>(r => r.id === t.materialId);
  <span class="k">if</span> (lot) lot[qtyKey] = <span class="fn">String</span>(<span class="fn">Math.max</span>(<span class="n">0</span>, <span class="fn">num</span>(lot[qtyKey]) + delta));
});</pre>

<h3>정기 업무 자동생성</h3>
<pre><span class="c">// server/src/lib/recurring.js — 멱등 생성</span>
<span class="k">async function</span> <span class="fn">materializeRecurring</span>(plant) {
  <span class="k">const</span> templates = <span class="k">await</span> <span class="fn">readTable</span>(<span class="s">'recurring_tasks'</span>, plant);
  <span class="k">for</span> (<span class="k">const</span> tmpl <span class="k">of</span> templates.<span class="fn">filter</span>(t => t.active === <span class="s">'1'</span>)) {
    <span class="k">const</span> period = <span class="fn">getPeriodKey</span>(tmpl, today);  <span class="c">// e.g. "2026-W26", "2026-06"</span>
    <span class="k">const</span> exists = tasks.<span class="fn">some</span>(t => t.recurringId === tmpl.id && t.period === period);
    <span class="k">if</span> (!exists) <span class="k">await</span> <span class="fn">createTask</span>({ ...tmpl, period, recurringId: tmpl.id });
  }
}</pre>
`
  },
  main: [
    ['배치 일괄처리 FIFO', '<code>POST /batches/bulk</code>: BOM 기준값 × 배치 수량으로 필요량 계산 → <code>fifoPlan()</code>으로 Lot별 배분 → 일괄 출고 트랜잭션 생성.'],
    ['품목그룹 & BOM', '<code>itemGroup</code> 필드로 납품업체가 다른 동일 자재 그룹화. BOM은 그룹명으로 매칭(<code>itemGroup === materialName || name === materialName</code>). 배치 처리 시 그룹 내 default 업체 우선 선택.'],
    ['YY#번호 배치번호', '배치번호 형식 <code>26#01</code> — 연도(수정 가능) + 시퀀스. <code>nextProductBatchNo()</code>로 제품별 자동 채번. 연도 리셋 지원.'],
    ['유해화학물질 대장', '<code>buildLedger()</code>: 품목그룹별 일별 이월→입고→출하→잔량 체인 계산. 수동 입력은 <code>hazardous_ledger</code> 테이블로 오버라이드. 보관한도 초과 시 경고.'],
    ['정기 업무 자동생성', '<code>recurring_tasks</code> 템플릿 등록(일/주/월 주기). <code>GET /tasks</code> 시 <code>materializeRecurring()</code> 호출 → period 키 기반 중복 없이 Task 자동 생성.'],
    ['재고 신호등', '<code>SignalLight</code> 컴포넌트: 잔량/안전재고 비율로 red(≤100%), amber(≤150%), green(>150%) 3색 표시. 모든 재고 현황 페이지 적용.'],
    ['수불 삭제 재고원복', '출고 삭제 시 +qty, 입고 삭제 시 -qty 방향으로 Lot 잔량 복원. 단건 DELETE와 일괄 bulk-delete 모두 적용.'],
    ['경고 롤업 애니메이션', '상단 경고 메시지를 가로 원통이 굴러오는 듯한 CSS <code>rotateX(-90deg→0)</code> 애니메이션으로 전환. <code>key={warnIdx}</code>로 재마운트 트리거.'],
  ],
  feat: shotRow([imgFig('hazardous', '유해화학물질 관리대장 — 연간 일자별 집계'), imgFig('input-history', '투입이력 — Batch별 투입 내역')]),
  feat2: shotRow([imgFig('dashboard', '종합현황 — 경고 롤업 · 퀵메뉴 · Canister 총계'), imgFig('reports', '월간 보고서 — 재고현황 표·그래프')]),
  lock: [
    ['FIFO 자동 분배', '<code>fifoPlan()</code>: <code>receivedDate</code> 오름차순으로 정렬 후 최고참 Lot부터 할당. 재고 부족 시 <code>shortage</code> 반환으로 화면에 경고.'],
    ['FIFO 위반 409', '수동 Lot 지정 없이 배치 처리 시 자동 FIFO. 위반 Lot 선택 시 서버가 409로 차단. force=true 시 anomalies 자동 기록.'],
    ['품목그룹 필수', '품목 등록 시 <code>itemGroup</code> 미입력 → 서버 400 차단. BOM 매칭과 유해물질 집계의 기준값이므로 필수.'],
    ['수불삭제 재고원복', '삭제와 동시에 Lot 잔량을 즉시 복원. 같은 Lot번호로 재입고 가능. 이력 삭제가 재고 불일치를 유발하지 않음.'],
    ['정기업무 멱등성', 'period 키(주간: <code>2026-W26</code>, 월간: <code>2026-06</code>)로 동일 주기 Task 중복 생성 방지. 서버 재시작·API 다중 호출에도 안전.'],
    ['유해물질 보관한도', '<code>hazardousMaxQty</code> 설정 값 대비 잔량 <code>hazardousWarnPct</code>% 초과 시 경고. 법적 보관한도 관리 지원.'],
  ],
  bug: [
    ['배치삭제 후 Lot 재생성 불가', '배치삭제 시 transactions만 삭제하고 Lot 잔량 미복원 → 같은 Lot번호 재사용 불가 문제 발생. bulk-delete에 재고원복 로직 추가로 해결.'],
    ['toast API 이름 불일치', '<code>toast.error()</code> → <code>toast.err()</code>, <code>toast.success()</code> → <code>toast.ok()</code>로 사내 toast 유틸 API명과 불일치. 런타임 오류 발생 → 전면 치환.'],
    ['배치 삭제 후 batches 잔류', '배치 트랜잭션 삭제 후 <code>batches</code> 레코드가 남아 같은 배치번호 재사용 불가 → batches 테이블에서도 해당 레코드 삭제 추가.'],
    ['투입이력 분리 메뉴', '투입이력이 별도 메뉴였으나 배치 일괄처리와 데이터 중복 → <code>/batch-bulk</code>로 통합. <code>App.jsx</code>에 <code>Navigate</code> 리다이렉트 추가.'],
  ],
  learn: [
    ['FIFO 분배 알고리즘', 'receivedDate 정렬 후 순차 할당. 여러 Lot에 수량을 나누는 greedy 배분. 재고 부족 조기 감지로 처리 전 사용자 확인 유도.'],
    ['멱등 스케줄러 설계', '정기 Task 생성은 DB 스케줄러 없이 GET 요청 훅으로 트리거. period 키 중복 체크로 N번 호출해도 결과 동일.'],
    ['CSS 애니메이션 트릭', '<code>key</code> prop 변경으로 React 컴포넌트 강제 재마운트 → CSS animation 재실행. 애니메이션 리셋을 JS 없이 처리.'],
    ['Delta 기반 재고 복원', '트랜잭션 타입(입고/출고)에 따라 부호를 결정하는 단순 패턴. 복잡한 이벤트 소싱 없이 삭제 시 역산 복원.'],
    ['품목그룹 추상화', '납품업체가 다른 동일 원재료를 논리적으로 하나의 그룹으로 묶는 도메인 모델. BOM·유해물질·재고 표시 모두 그룹 단위로 통일.'],
  ],
};

function navHtml(curId) {
  return `<div class="nav">${VERSIONS.map(v => `<a href="StockPilot_${v.id}_보고서.html" class="${v.id === curId ? 'cur' : ''}">${v.label}</a>`).join('')}<a href="StockPilot_종합보고서.html">종합</a></div>`;
}

function build(v) {
  const c = C[v.id];
  const featBody = (c.feat || '') + (c.feat2 || '');
  const body = `
${sec(1, '버전 컨셉 · 기술 배경', c.s1.lead, c.s1.body)}
${sec(2, '주요 기능 내용', '실제 구현된 기능과 기술적 처리 방식', rows('', c.main))}
${sec(3, '화면 캡처', '실제 화면 캡처입니다. (데이터는 예시용 가상데이터)', featBody)}
${sec(4, '기능 강화 · 인터락 (안전장치)', '실수·사고·무단 접근을 막는 서버 레벨 안전장치', rows('lock', c.lock))}
${sec(5, '버그 수정 · 원인 분석', '발생 원인과 해결 방법', rows('fix', c.bug))}
${sec(6, '학습 · 기술 포인트', '이 버전에서 익힌 핵심 기술 개념', rows('', c.learn))}`;
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
