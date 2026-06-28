'use strict';
const fs = require('fs');
const path = require('path');
const SHOTS = '/home/user/management/management/client/public/guide/shots';
const OUT = '/home/user/management/management/docs/version-reports/StockPilot_종합보고서.html';
const b = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, n + '.png')).toString('base64');

const CSS = `
:root{--ink:#1d1d1f;--sub:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--blue:#0071e3;--card:#fff;--green:#34a853;--amber:#ff9f0a;--red:#ff3b30;--purple:#7d5fff;}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;}
.wrap{max-width:920px;margin:0 auto;padding:48px 24px 96px;}
.hero{text-align:center;padding:44px 24px 30px;}
.badge{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--blue);background:rgba(0,113,227,.1);padding:6px 14px;border-radius:980px;}
.hero h1{font-size:48px;line-height:1.1;letter-spacing:-.02em;font-weight:700;margin:20px 0 10px;}
.hero p{font-size:19px;color:var(--sub);margin:0;font-weight:400;}
.hero .links{margin-top:18px;}
.hero .links a{font-size:13px;color:var(--blue);text-decoration:none;font-weight:600;margin:0 8px;}
.sec{background:var(--card);border-radius:20px;padding:32px 38px 36px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.03);}
.sec h2{font-size:24px;letter-spacing:-.01em;margin:0 0 4px;font-weight:700;}
.sec .lead{font-size:15px;color:var(--sub);margin:0 0 18px;}
.sec h3{font-size:16px;margin:24px 0 10px;font-weight:700;}
/* timeline */
.tl{position:relative;margin:8px 0 0;padding-left:26px;}
.tl::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(#0071e3,#7d5fff);}
.tl-item{position:relative;padding:0 0 22px 0;}
.tl-item::before{content:"";position:absolute;left:-23px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--blue);border:2px solid #fff;box-shadow:0 0 0 2px var(--blue);}
.tl-item:last-child{padding-bottom:0;}
.tl-v{font-size:17px;font-weight:700;color:var(--ink);}
.tl-v span{font-size:13px;font-weight:600;color:var(--blue);background:rgba(0,113,227,.1);padding:2px 9px;border-radius:7px;margin-right:8px;}
.tl-d{font-size:14px;color:var(--sub);margin:3px 0 0;}
/* focus cards */
.fc{border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin:14px 0;}
.fc-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.fc-tag{font-size:14px;font-weight:700;color:#fff;background:var(--blue);padding:3px 11px;border-radius:8px;}
.fc-title{font-size:16px;font-weight:700;}
.line{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:14.5px;}
.line:first-of-type{border-top:none;}
.line .ico{flex:0 0 auto;width:60px;font-size:12px;font-weight:700;text-align:center;border-radius:7px;padding:2px 0;height:fit-content;}
.ico.flow{color:var(--purple);background:rgba(125,95,255,.1);}
.ico.lock{color:var(--green);background:rgba(52,168,83,.1);}
.ico.easy{color:var(--amber);background:rgba(255,159,10,.12);}
.line .tx b{font-weight:600;}
.line .tx .s{color:var(--sub);}
/* highlight grid */
.grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;}
.cell{flex:1 1 240px;border:1px solid var(--line);border-radius:14px;padding:16px 18px;}
.cell .t{font-size:15px;font-weight:700;margin-bottom:4px;}
.cell .t.lock{color:var(--green);}
.cell .t.easy{color:var(--amber);}
.cell .d{font-size:14px;color:var(--sub);}
.shot{margin:18px 0 0;}
.shot img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);}
.shot figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
.vd{display:inline-block;font-size:11px;font-weight:600;color:var(--amber);background:rgba(255,159,10,.12);padding:1px 7px;border-radius:6px;margin-left:5px;}
.close{background:linear-gradient(135deg,#0071e3,#7d5fff);color:#fff;border-radius:20px;padding:34px 38px;margin:24px 0 0;text-align:center;}
.close h2{color:#fff;font-size:24px;margin:0 0 10px;}
.close p{font-size:16px;margin:0 auto;max-width:620px;opacity:.95;line-height:1.6;}
.foot{text-align:center;color:var(--sub);font-size:13px;margin-top:30px;}
@media print{body{background:#fff;}.sec,.fc{box-shadow:none;}.sec{border:1px solid var(--line);break-inside:avoid;}.close{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
`;

const tl = [
  ['v1', '초기 구축', '종이·엑셀 수기관리를 React+Express+CSV 한 시스템으로 통합. 로그인·가입승인 기반 마련.'],
  ['v2', 'Lot 기반 재고', '입고일별 Lot 단위 추적, 품목 기준정보(단위·안전재고·업체) 체계화.'],
  ['v3', '운영 대시보드', '경고·퀵메뉴·Task를 한 화면에. 선입선출(FIFO) 위반 자동 감지 시작.'],
  ['v3.1', 'UI/UX 개선', '제품별 그룹핑·색상·뱃지로 한눈에 읽히는 현황 화면으로 정리.'],
  ['v4', '멀티 공장', '1·2공장 데이터 완전 분리, 서버 시작 시 자동 백업.'],
  ['v5', '역할 5종', '관리자·공장관리자·팀관리자(조회전용)·사용자로 권한 분리, 공장 간 격리.'],
  ['v6', 'AI 검색·메뉴얼', '폐쇄망 호환 자연어 검색 엔진, 사용자 메뉴얼 추가.'],
  ['v7', '현행 고도화', '다량 입고·FIFO 분배, 합성 Batch 투입이력, 유해물질 관리대장, 월간 보고서.'],
];

const focus = [
  { tag: 'v1', title: '초기 구축', lines: [
    ['flow', '<b>수기 → 시스템</b> <span class="s">— 흩어진 종이·엑셀 기록을 한 곳에서 입력·조회</span>'],
    ['lock', '<b>가입신청 → 관리자 승인</b> <span class="s">— 승인 전 접근 차단(무단 가입 방지)</span>'],
    ['easy', '<b>CSV 내보내기</b> <span class="s">— 엑셀에서 바로 여는 다운로드(BOM으로 한글 안 깨짐)</span>'],
  ]},
  { tag: 'v2', title: 'Lot 기반 재고', lines: [
    ['flow', '<b>입고 → Lot 추적 → 출고 차감</b> <span class="s">— 어느 Lot이 얼마 남았는지 실시간 반영</span>'],
    ['lock', '<b>이중 안전재고</b> <span class="s">— % 기준 + 기준수량 동시 설정으로 부족 누락 방지</span>'],
    ['easy', '<b>품목 기준정보 자동화</b> <span class="s">— 단위·업체·제품을 미리 등록해 입력 단순화</span>'],
  ]},
  { tag: 'v3', title: '운영 대시보드', lines: [
    ['flow', '<b>한 화면 운영</b> <span class="s">— 경고·퀵메뉴·진행 Task를 종합현황에서 동시에</span>'],
    ['lock', '<b>FIFO(선입선출) 인터락</b> <span class="s">— 오래된 Lot 두고 새 Lot 쓰면 경고, 강제 시 이상발생 자동기록</span>'],
    ['easy', '<b>퀵메뉴</b> <span class="s">— 입고/사용/수불을 첫 화면에서 바로 시작</span>'],
  ]},
  { tag: 'v3.1', title: 'UI/UX 개선', lines: [
    ['flow', '<b>읽히는 현황</b> <span class="s">— 제품별 그룹핑 + 상태 뱃지로 흐름이 한눈에</span>'],
    ['lock', '<b>부족 빨간색 강조</b> <span class="s">— 안전재고 미달 행을 강제 노출해 놓치지 않게</span>'],
    ['easy', '<b>품목 선택 자동 채움</b> <span class="s">— 단위·업체·Lot 양식이 자동 입력 → 오입력 감소</span>'],
  ]},
  { tag: 'v4', title: '멀티 공장', lines: [
    ['flow', '<b>공장별 분리 운영</b> <span class="s">— 1·2공장 데이터를 완전히 나눠 혼선 차단</span>'],
    ['lock', '<b>데이터 보존·자동 백업</b> <span class="s">— 업데이트가 자료를 덮어쓰지 않고, 켤 때마다 백업</span>'],
    ['easy', '<b>공장 선택기</b> <span class="s">— 권한 있는 공장만 드롭다운으로 즉시 전환</span>'],
  ]},
  { tag: 'v5', title: '역할 5종', lines: [
    ['flow', '<b>역할별 화면</b> <span class="s">— 권한에 맞는 메뉴·버튼만 노출</span>'],
    ['lock', '<b>조회전용 전역 차단</b> <span class="s">— 팀관리자의 모든 쓰기 요청을 서버에서 403 차단</span>'],
    ['lock', '<b>공장 경계 강제</b> <span class="s">— 타 공장 데이터 접근 시 거부(403)</span>'],
  ]},
  { tag: 'v6', title: 'AI 검색·메뉴얼', lines: [
    ['flow', '<b>자연어로 묻기</b> <span class="s">— "이번달 헥산 사용량" 같은 말로 바로 조회</span>'],
    ['lock', '<b>숫자 비조작</b> <span class="s">— 실데이터로만 계산, 폐쇄망에서 외부 LLM 없이 동작</span>'],
    ['easy', '<b>예시 칩 + 메뉴얼</b> <span class="s">— 자주 쓰는 검색어 바로가기, 이미지 안내 페이지</span>'],
  ]},
  { tag: 'v7', title: '현행 고도화', lines: [
    ['easy', '<b>일괄 Lot 입고</b> <span class="s">— 같은 품목 Lot을 번호 범위(A01~A20)로 한 번에 등록</span>'],
    ['easy', '<b>잔량 자동 계산·[전량] 버튼</b> <span class="s">— 사용/입고 후 잔여 자동 표시</span>'],
    ['lock', '<b>FIFO 자동 분배</b> <span class="s">— 일괄 출고 시 가장 오래된 Lot부터 자동 차감</span>'],
    ['lock', '<b>Task 완료 승인 · 유해물질 보관한도 경고</b> <span class="s">— 임의 완료 방지, 위험 보관 차단</span>'],
    ['flow', '<b>합성 Batch 투입이력 · 월간 보고서</b> <span class="s">— Batch별 투입 추적, 관리자 보고서 자동 생성</span>'],
  ]},
];

const tlHtml = `<div class="tl">${tl.map(([v, t, d]) => `<div class="tl-item"><div class="tl-v"><span>${v}</span>${t}</div><div class="tl-d">${d}</div></div>`).join('')}</div>`;

const focusHtml = focus.map(f => `<div class="fc"><div class="fc-head"><span class="fc-tag">${f.tag}</span><span class="fc-title">${f.title}</span></div>${f.lines.map(([k, tx]) => `<div class="line"><span class="ico ${k}">${k === 'flow' ? '흐름' : k === 'lock' ? '인터락' : '편의'}</span><span class="tx">${tx}</span></div>`).join('')}</div>`).join('');

const locks = [
  ['가입 승인 절차', '승인 전 접근 차단으로 무단 가입·외부 노출 방지'],
  ['FIFO 선입선출 인터락', '오래된 Lot 우선 사용 강제, 위반 시 경고+이상발생 자동기록'],
  ['조회전용 전역 차단', '팀관리자 쓰기 요청을 서버에서 일괄 403'],
  ['공장 경계 격리', '타 공장 데이터 접근 거부, 업데이트 시 자료 보존'],
  ['Task 완료 승인', '일반 사용자 완료는 대기 → 관리자 승인 시 확정'],
  ['유해물질 보관한도 경고', '설정 % 초과 시 경고로 위험 보관 차단'],
  ['Canister 90% 경고', '사이즈별 최대 무게 임박 시 빨간 테두리 경고'],
  ['CSV BOM·동시쓰기 잠금', '한글 깨짐·파일 충돌 방지'],
];
const easies = [
  ['일괄 Lot 입고', '같은 품목 Lot을 번호 범위(A01~A20)로 한 번에 등록'],
  ['일괄 출고 FIFO 자동 분배', '입력 수량을 오래된 Lot부터 자동으로 나눠 차감'],
  ['잔량 자동 계산·[전량]', '사용/입고 후 잔여수량 자동 표시, 전량 버튼'],
  ['품목 선택 자동 채움', '단위·업체·Lot 양식 자동 입력'],
  ['퀵메뉴', '입고/사용/수불을 첫 화면에서 바로 시작'],
  ['AI 자연어 검색', '말로 묻고 표·답변으로 즉시 조회'],
  ['Batch 번호 자동·연도 리셋', '품목별 다음 번호 자동 채움'],
  ['월간 보고서 자동 생성', '실데이터 역산으로 보고용 HTML 즉시 생성'],
];
const cell = (cls, arr) => `<div class="grid">${arr.map(([t, d]) => `<div class="cell"><div class="t ${cls}">${t}</div><div class="d">${d}</div></div>`).join('')}</div>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>StockPilot 종합 개발 보고서</title><style>${CSS}</style></head><body><div class="wrap">
<div class="hero">
  <span class="badge">StockPilot 종합 개발 보고서</span>
  <h1>전체 개발 플로우와<br>조치 내용</h1>
  <p>버전별 흐름 · 인터락(안전장치) · 편의성 증대 중심</p>
  <div class="links">화학공장 수불관리 시스템 · v1 → v7</div>
</div>

<section class="sec">
  <h2>1. 전체 개발 흐름</h2>
  <p class="lead">수기관리 통합(v1)에서 출발해 재고 추적 → 운영 자동화 → 멀티공장·권한 → AI·고도화로 단계적으로 발전했습니다.</p>
  ${tlHtml}
  <figure class="shot"><img src="${b('dashboard')}" alt="종합현황"><figcaption>현재(v7) 종합현황 — 경고·퀵메뉴·AI 검색·Task·제품별 현황 <span class="vd">가상데이터</span></figcaption></figure>
</section>

<section class="sec">
  <h2>2. 버전별 포커스 — 흐름 · 인터락 · 편의</h2>
  <p class="lead">각 버전이 무엇을 풀었는지, 어떤 안전장치(인터락)와 편의기능을 더했는지 정리했습니다.</p>
  ${focusHtml}
</section>

<section class="sec">
  <h2>3. 인터락(안전장치) 총정리</h2>
  <p class="lead">실수·사고·무단 접근을 시스템이 막아주는 장치들입니다.</p>
  ${cell('lock', locks)}
</section>

<section class="sec">
  <h2>4. 편의성 증대 기능 총정리</h2>
  <p class="lead">반복 작업을 줄이고 입력을 단순화한 기능들입니다. (일괄 Lot 등록 등)</p>
  ${cell('easy', easies)}
</section>

<div class="close">
  <h2>마무리</h2>
  <p>현재까지의 개발과 조치 내용을 종합 정리했습니다. 앞으로는 <b>실사용자(현장) 피드백을 받아 보완·수정해 나갈 예정</b>입니다. 불편한 점이나 추가가 필요한 기능은 시스템 내 <b>건의사항</b> 또는 담당자에게 알려 주시면 반영하겠습니다.</p>
</div>

<div class="foot">StockPilot · 화학공장 수불관리 시스템 — 종합 개발 보고서 (v1 → v7)</div>
</div></body></html>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + 'KB');
