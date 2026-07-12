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
.wrap{max-width:940px;margin:0 auto;padding:48px 24px 96px;}
.hero{text-align:center;padding:44px 24px 30px;}
.badge{display:inline-block;font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--blue);background:rgba(0,113,227,.1);padding:6px 14px;border-radius:980px;}
.hero h1{font-size:48px;line-height:1.1;letter-spacing:-.02em;font-weight:700;margin:20px 0 10px;}
.hero p{font-size:19px;color:var(--sub);margin:0;font-weight:400;}
.hero .links{margin-top:18px;}
.hero .links a{font-size:13px;color:var(--blue);text-decoration:none;font-weight:600;margin:0 8px;}
.sec{background:var(--card);border-radius:20px;padding:32px 38px 36px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.03);}
.sec h2{font-size:24px;letter-spacing:-.01em;margin:0 0 4px;font-weight:700;}
.sec .lead{font-size:15px;color:var(--sub);margin:0 0 18px;}
.sec h3{font-size:16px;margin:24px 0 10px;font-weight:700;color:var(--ink);}
/* timeline */
.tl{position:relative;margin:8px 0 0;padding-left:26px;}
.tl::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(#0071e3,#7d5fff);}
.tl-item{position:relative;padding:0 0 22px 0;}
.tl-item::before{content:"";position:absolute;left:-23px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--blue);border:2px solid #fff;box-shadow:0 0 0 2px var(--blue);}
.tl-item:last-child{padding-bottom:0;}
.tl-v{font-size:17px;font-weight:700;color:var(--ink);}
.tl-v span{font-size:13px;font-weight:600;color:var(--blue);background:rgba(0,113,227,.1);padding:2px 9px;border-radius:7px;margin-right:8px;}
.tl-d{font-size:14px;color:var(--sub);margin:3px 0 0;}
.tl-d code{font-family:"SFMono-Regular","Courier New",monospace;font-size:12.5px;background:#f0f4ff;color:#3a3fff;padding:1px 5px;border-radius:4px;}
/* focus cards */
.fc{border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin:14px 0;}
.fc-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.fc-tag{font-size:14px;font-weight:700;color:#fff;background:var(--blue);padding:3px 11px;border-radius:8px;}
.fc-title{font-size:16px;font-weight:700;}
.line{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:14.5px;}
.line:first-of-type{border-top:none;}
.line .ico{flex:0 0 auto;width:64px;font-size:11.5px;font-weight:700;text-align:center;border-radius:7px;padding:2px 0;height:fit-content;}
.ico.flow{color:var(--purple);background:rgba(125,95,255,.1);}
.ico.lock{color:var(--green);background:rgba(52,168,83,.1);}
.ico.easy{color:var(--amber);background:rgba(255,159,10,.12);}
.ico.fix{color:var(--red);background:rgba(255,59,48,.1);}
.line .tx b{font-weight:600;}
.line .tx .s{color:var(--sub);}
.line .tx code{font-family:"SFMono-Regular","Courier New",monospace;font-size:12.5px;background:#f0f4ff;color:#3a3fff;padding:1px 5px;border-radius:4px;}
/* highlight grid */
.grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;}
.cell{flex:1 1 240px;border:1px solid var(--line);border-radius:14px;padding:16px 18px;}
.cell .t{font-size:15px;font-weight:700;margin-bottom:4px;}
.cell .t.lock{color:var(--green);}
.cell .t.easy{color:var(--amber);}
.cell .t.fix{color:var(--red);}
.cell .d{font-size:14px;color:var(--sub);}
.cell .d code{font-family:"SFMono-Regular","Courier New",monospace;font-size:12.5px;background:#f0f4ff;color:#3a3fff;padding:1px 4px;border-radius:4px;}
.shot{margin:18px 0 0;}
.shot img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);}
.shot figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
.shot-row{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0 0;}
.shot-row figure{flex:1 1 300px;margin:0;}
.shot-row figcaption{font-size:13px;color:var(--sub);text-align:center;margin-top:10px;}
.shot-row img{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);}
.vd{display:inline-block;font-size:11px;font-weight:600;color:var(--amber);background:rgba(255,159,10,.12);padding:1px 7px;border-radius:6px;margin-left:5px;}
pre{background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:18px 20px;font-family:"SFMono-Regular","Courier New",monospace;font-size:13px;line-height:1.6;overflow-x:auto;margin:14px 0;}
pre .c{color:#6c7086;}
pre .k{color:#cba6f7;}
pre .s{color:#a6e3a1;}
pre .n{color:#fab387;}
pre .fn{color:#89dceb;}
.arch-tbl{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;}
.arch-tbl th{background:#f5f5f7;font-weight:700;padding:9px 12px;border-bottom:2px solid var(--line);text-align:left;}
.arch-tbl td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top;}
.arch-tbl td code{font-family:"SFMono-Regular","Courier New",monospace;font-size:12.5px;background:#f0f4ff;color:#3a3fff;padding:1px 5px;border-radius:4px;}
.arch-tbl tr:last-child td{border-bottom:none;}
.close{background:linear-gradient(135deg,#0071e3,#7d5fff);color:#fff;border-radius:20px;padding:34px 38px;margin:24px 0 0;text-align:center;}
.close h2{color:#fff;font-size:24px;margin:0 0 10px;}
.close p{font-size:16px;margin:0 auto;max-width:620px;opacity:.95;line-height:1.6;}
.foot{text-align:center;color:var(--sub);font-size:13px;margin-top:30px;}
@media print{body{background:#fff;}.sec,.fc{box-shadow:none;}.sec{border:1px solid var(--line);break-inside:avoid;}pre{background:#f5f5f7;color:#1d1d1f;}.close{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
`;

const tl = [
  ['v1', '초기 구축', '종이·엑셀 수기관리를 React 18+Express+CSV 한 시스템으로 통합. <code>readTable()/mutate()</code> 저장소 패턴, <code>withLock</code> 파일 뮤텍스, bcryptjs 인증·가입승인 절차 기반 마련.'],
  ['v2', 'Lot 기반 재고', '입고일별 <code>receivedDate+lotNo</code> 키로 Lot 단위 재고 추적. 품목 기준정보 마스터(<code>items</code>) 분리. 이중 안전재고(절대값+%) 시스템. Canister 내용물·무게 관리.'],
  ['v3', '운영 대시보드·FIFO', '<code>findEarlierLot()</code>로 선입선출 위반 감지 → 409 차단 + anomalies 자동기록. 경고(재고부족·Canister·Task지연) 서버 집계. 퀵메뉴·Task 관리 추가.'],
  ['v3.1', 'UI/UX 개선', '<code>useMemo</code> 기반 product 필드 그룹핑. 잔량 기준 row-danger/row-warn CSS 분기. 품목 선택 시 단위·업체 자동채움. 상태 뱃지 시스템 정립.'],
  ['v4', '멀티 공장', '<code>server/data/1공장/</code> 폴더 분리. X-Plant 헤더 <code>encodeURIComponent</code> 인코딩. <code>resolvePlant</code> 미들웨어 주입. 서버 기동 시 자동 스냅샷 백업(최근 20개 보관).'],
  ['v5', '역할 5종·격리', 'admin/admin1/admin2/team/user 역할. <code>requireAuth·requireAdmin·requireWrite</code> 미들웨어 체계. 팀관리자 쓰기 전역 403. 공장별 접근 허용 목록 강제.'],
  ['v6', 'AI 검색·메뉴얼', '정규식 규칙 배열로 기간·동작·품목 파싱. LLM 없이 폐쇄망 동작. 실데이터만 사용해 숫자 환각 방지. 예시 칩·사용자 메뉴얼 추가.'],
  ['v7', '현행 고도화', '<code>fifoPlan()</code> FIFO 배분, 품목그룹 BOM, <code>materializeRecurring()</code> 정기업무, <code>buildLedger()</code> 유해물질, 수불삭제 delta 재고원복, CSS rotateX 롤업 애니메이션.'],
];

const focus = [
  { tag: 'v1', title: '초기 구축 — 저장소 설계', lines: [
    ['flow', '<b>readTable / mutate 패턴</b> <span class="s">— CSV를 배열로 읽고, fn(rows)로 수정 후 다시 저장하는 단일 패턴</span>'],
    ['lock', '<b>withLock 파일 뮤텍스</b> <span class="s">— 테이블별 <code>async-mutex</code>로 동시 쓰기 순차화. 파일 충돌·손상 방지</span>'],
    ['easy', '<b>BOM 내보내기</b> <span class="s">— <code>\\uFEFF</code> 앞에 붙여 엑셀 UTF-8 한글 자동 인식. 수기 → 시스템 전환 마찰 최소화</span>'],
  ]},
  { tag: 'v2', title: 'Lot 재고 — 데이터 모델', lines: [
    ['flow', '<b>입고 → Lot 생성 → 출고 차감</b> <span class="s">— <code>quantity</code> 직접 차감 방식. CSV 환경에서 이벤트 소싱보다 단순</span>'],
    ['lock', '<b>이중 안전재고</b> <span class="s">— <code>safetyStock</code>(절대) + <code>warningPct</code>(%) 두 기준 중 하나라도 미달 시 경고</span>'],
    ['easy', '<b>품목 마스터 자동채움</b> <span class="s">— 품목 선택 → unit·vendor·lotPattern 즉시 반영. 오입력 방지</span>'],
  ]},
  { tag: 'v3', title: 'FIFO 인터락', lines: [
    ['flow', '<b>findEarlierLot()</b> <span class="s">— 현재 Lot보다 <code>receivedDate</code>가 이전이고 quantity > 0인 Lot 탐색 → 존재 시 409</span>'],
    ['lock', '<b>force=true 시 anomalies 자동기록</b> <span class="s">— FIFO 강제 진행 증거를 <code>anomalies</code> 테이블에 남겨 추적 가능</span>'],
    ['easy', '<b>Lot 1개 예외</b> <span class="s">— 선택지가 없으면 FIFO 검사 생략. 불필요한 경고 없이 자연스러운 UX</span>'],
  ]},
  { tag: 'v3.1', title: 'UI 그룹핑 & 시각화', lines: [
    ['flow', '<b>useMemo product 그룹핑</b> <span class="s">— <code>new Map()</code>으로 제품별 분류. 데이터 변경 시에만 재계산</span>'],
    ['lock', '<b>row-danger/row-warn CSS</b> <span class="s">— 잔량 ≤ safetyStock은 빨간색 강제. 시각적 경고를 놓칠 수 없게</span>'],
    ['easy', '<b>다음 사용 Lot 표시</b> <span class="s">— receivedDate 최솟값 Lot을 "다음 사용" 강조. FIFO 대상 Lot 직관적 안내</span>'],
  ]},
  { tag: 'v4', title: '멀티 공장 — 데이터 격리', lines: [
    ['flow', '<b>X-Plant 헤더 흐름</b> <span class="s">— <code>encodeURIComponent</code> → HTTP → <code>decodeURIComponent</code> → req.plant → 파일 경로</span>'],
    ['lock', '<b>서버 기동 시 자동 백업</b> <span class="s">— <code>fs.cp(DATA_DIR, BACKUP_DIR/stamp)</code>. 최근 20개 보관. 업데이트 전 안전망</span>'],
    ['lock', '<b>데이터 보존 정책</b> <span class="s">— 배포 스크립트에서 <code>server/data/</code> 절대 덮어쓰지 않는 규칙. 코드-데이터 분리</span>'],
  ]},
  { tag: 'v5', title: 'RBAC — 역할별 권한', lines: [
    ['flow', '<b>미들웨어 3단계</b> <span class="s">— <code>requireAuth</code>(세션) → <code>requireWrite</code>(team 차단) → <code>requireAdmin</code>(역할) 체인</span>'],
    ['lock', '<b>팀관리자 전역 403</b> <span class="s">— POST·PATCH·DELETE 라우터 전체에 <code>requireWrite</code> 적용. 한 군데도 빠짐없이</span>'],
    ['lock', '<b>공장 경계 강제</b> <span class="s">— <code>ROLE_PLANTS[role].includes(plant)</code>로 서버에서 거부. 클라이언트 우회 불가</span>'],
  ]},
  { tag: 'v6', title: 'AI 검색 — 규칙 엔진', lines: [
    ['flow', '<b>정규식 파싱 3단계</b> <span class="s">— 기간 추출 → 동작 분류 → 품목 교차매칭 → 실데이터 집계 → 자연어 답변</span>'],
    ['lock', '<b>환각 방지</b> <span class="s">— LLM 없이 실 transactions·lots 데이터로만 계산. 없는 데이터는 "없음"으로 명시</span>'],
    ['easy', '<b>폐쇄망 완전 호환</b> <span class="s">— 외부 API 호출 없음. 서버 내 규칙만으로 사내망에서 100% 동작</span>'],
  ]},
  { tag: 'v7', title: '현행 고도화 — 핵심 6가지', lines: [
    ['flow', '<b>fifoPlan()</b> <span class="s">— receivedDate 오름차순 정렬 후 greedy 배분. BOM×배치수 → Lot별 할당 계획 미리 표시</span>'],
    ['flow', '<b>materializeRecurring()</b> <span class="s">— GET /tasks 시 period 키 중복 체크 → 정기 Task 멱등 생성. 스케줄러 서버 불필요</span>'],
    ['lock', '<b>수불삭제 delta 원복</b> <span class="s">— 출고삭제 → <code>+qty</code>, 입고삭제 → <code>-qty</code>. 단건+일괄 모두 동일 로직</span>'],
    ['lock', '<b>품목그룹 필수 강제</b> <span class="s">— 등록 시 <code>itemGroup</code> 빈값 → 서버 400. BOM·유해물질 집계 기준점이므로 필수</span>'],
    ['easy', '<b>CSS rotateX 롤업 애니메이션</b> <span class="s">— <code>key={warnIdx}</code> 재마운트로 경고 메시지 원통 전환. JS setTimeout 없이 처리</span>'],
    ['fix', '<b>toast API 불일치 수정</b> <span class="s">— <code>toast.error()→toast.err()</code>, <code>toast.success()→toast.ok()</code>. 배치처리 런타임 오류 해결</span>'],
  ]},
];

const tlHtml = `<div class="tl">${tl.map(([v, t, d]) => `<div class="tl-item"><div class="tl-v"><span>${v}</span>${t}</div><div class="tl-d">${d}</div></div>`).join('')}</div>`;
const focusHtml = focus.map(f => `<div class="fc"><div class="fc-head"><span class="fc-tag">${f.tag}</span><span class="fc-title">${f.title}</span></div>${f.lines.map(([k, tx]) => `<div class="line"><span class="ico ${k}">${k === 'flow' ? '흐름' : k === 'lock' ? '인터락' : k === 'fix' ? '버그픽스' : '편의'}</span><span class="tx">${tx}</span></div>`).join('')}</div>`).join('');

const locks = [
  ['가입 승인 절차', 'lock', '<code>approved !== "1"</code>이면 requireAuth가 401 반환. 세션 있어도 API 전체 차단.'],
  ['FIFO 선입선출 인터락', 'lock', '<code>findEarlierLot()</code>: 오래된 Lot 잔량 존재 시 409. force=true 시 anomalies 자동기록.'],
  ['조회전용 전역 차단', 'lock', 'team 역할 → requireWrite가 POST/PATCH/DELETE 전 라우터 403. 단 한 군데도 누락 없음.'],
  ['공장 경계 격리', 'lock', 'ROLE_PLANTS 허용 목록 외 공장 요청 → 403. 인코딩된 X-Plant 헤더 필수.'],
  ['데이터 보존 정책', 'lock', '배포 시 <code>server/data/</code> 절대 덮어쓰기 금지. 코드-데이터 폴더 물리적 분리.'],
  ['Task 완료 승인', 'lock', '일반 user의 완료는 pending → 관리자 승인 시 done 확정. 임의 완료 방지.'],
  ['수불삭제 재고원복', 'lock', '삭제 요청 시 delta 계산 후 Lot 잔량 즉시 복원. 이력 삭제가 재고 불일치 유발 방지.'],
  ['정기업무 멱등성', 'lock', 'period 키(주: 2026-W26, 월: 2026-06)로 중복 생성 방지. 다중 호출·재시작 안전.'],
  ['유해물질 보관한도', 'lock', '<code>hazardousMaxQty × hazardousWarnPct%</code> 초과 시 경고. 법적 보관한도 관리 지원.'],
  ['Canister 90% 경고', 'lock', '사이즈별 최대 무게의 90% 이상이면 빨간 테두리. 과충전 사전 경고.'],
];

const easies = [
  ['품목 선택 자동채움', 'easy', 'unit·vendor·product·lotPattern 자동 입력. 품목 마스터 한 번 설정으로 이후 입력 단순화.'],
  ['FIFO 배치 자동분배', 'easy', '<code>fifoPlan()</code>: BOM×배치수 → receivedDate 순 greedy 배분 계획을 처리 전 미리 표시.'],
  ['YY#번호 배치번호', 'easy', '<code>nextProductBatchNo()</code>로 제품별 자동 채번. 연도 수정 가능, 연도 리셋 지원.'],
  ['정기업무 자동생성', 'easy', 'GET /tasks 호출 시 recurring_tasks 템플릿 기반으로 일/주/월 Task 자동 생성.'],
  ['퀵메뉴 대시보드', 'easy', '종합현황에서 입고·출고·Canister 수불 바로 시작. 배치처리 버튼은 +새 배치처리 직접 오픈.'],
  ['AI 자연어 검색', 'easy', '"이번달 헥산 사용량"처럼 말로 묻기. 표+자연어 답변 동시 제공. 예시 칩으로 신규 사용자 안내.'],
  ['경고 롤업 애니메이션', 'easy', 'CSS rotateX(-90→0) 원통 굴림 효과. key prop 재마운트로 애니메이션 반복 트리거.'],
  ['재고 신호등', 'easy', 'SignalLight 컴포넌트: 안전재고 대비 red/amber/green 3색. 수치 없이 직관적 상태 파악.'],
  ['Canister 총계 표시', 'easy', '제품명 옆 총 갯수·총 무게 합계 표시. 그룹 헤더에서 전체 현황 즉시 파악.'],
  ['CSV 내보내기', 'easy', 'BOM(\\uFEFF) 포함 UTF-8 다운로드. 엑셀 직접 열기 가능. 폐쇄망 보고서 제출 지원.'],
];

const bugs = [
  ['배치삭제 후 Lot 재생성 불가', 'fix', 'transactions만 삭제하고 Lot 잔량 미복원 → 같은 번호 재사용 불가. bulk-delete에 delta 원복 추가.'],
  ['X-Plant 한글 헤더 깨짐', 'fix', 'HTTP 헤더 Latin-1 제한 → encodeURIComponent ↔ decodeURIComponent 쌍 처리.'],
  ['toast API 이름 불일치', 'fix', '<code>toast.error/success</code>→<code>toast.err/ok</code> 전면 치환. 배치처리 런타임 오류 해결.'],
  ['batches 레코드 잔류', 'fix', '배치 트랜잭션 삭제 후 batches 레코드 미삭제 → 동일 배치번호 재생성 불가. batches 테이블도 함께 삭제.'],
  ['동시 쓰기 파일 충돌', 'fix', '초기 경쟁 조건 → withLock(async-mutex) 테이블별 독립 잠금 구조. 파일 손상 방지.'],
  ['메뉴얼 보안 정보 노출', 'fix', '메뉴얼 페이지에 테스트 계정 정보 포함 → 전면 삭제. 비인가자 접근 시 보안 정보 노출 차단.'],
  ['그룹 없는 품목 누락', 'fix', 'product 필드 없는 Lot이 그룹핑에서 누락 → <code>product || \'기타\'</code> 폴백. 전체 목록 완전성 보장.'],
  ['FIFO 단일Lot 오탐', 'fix', 'Lot 1개인데도 FIFO 경고 발생 → lots.length === 1이면 findEarlierLot 생략.'],
];

const cell = (cls, arr) => `<div class="grid">${arr.map(([t, c, d]) => `<div class="cell"><div class="t ${c}">${t}</div><div class="d">${d}</div></div>`).join('')}</div>`;

// Architecture table
const archTable = `
<table class="arch-tbl">
<thead><tr><th>계층</th><th>기술/파일</th><th>역할 및 주요 패턴</th></tr></thead>
<tbody>
<tr><td><b>프론트엔드</b></td><td>React 18 + Vite<br><code>client/src/</code></td><td>SPA. CSS 변수 기반 자체 디자인 시스템. <code>useSearchParams</code>로 딥링크 지원 (예: <code>/batch-bulk?new=1</code>). <code>useMemo</code>로 그룹핑 메모이즈.</td></tr>
<tr><td><b>API 서버</b></td><td>Express.js 포트 4000<br><code>server/src/routes/</code></td><td>REST API. <code>asyncHandler</code> 래퍼로 에러 자동 전파. <code>requireAuth→requireWrite→requireAdmin</code> 미들웨어 체인.</td></tr>
<tr><td><b>저장소</b></td><td>CSV 파일<br><code>server/data/{공장}/</code></td><td><code>readTable()</code> CSV→배열 파싱. <code>mutate()</code> 내부 <code>withLock</code> 직렬화. 테이블별 독립 뮤텍스.</td></tr>
<tr><td><b>인증</b></td><td>express-session<br>bcryptjs</td><td>세션 쿠키 기반. 비밀번호 단방향 해시 (<code>bcryptjs.hash(pw,10)</code>). 가입 후 관리자 승인 필수.</td></tr>
<tr><td><b>공장 분리</b></td><td>X-Plant 헤더<br>resolvePlant 미들웨어</td><td><code>encodeURIComponent</code> 한글 인코딩 → 서버 디코딩 → <code>req.plant</code> → 파일 경로 결정.</td></tr>
<tr><td><b>FIFO</b></td><td><code>findEarlierLot()</code><br><code>fifoPlan()</code></td><td>단건: receivedDate 비교 → 409. 일괄: BOM×수량 greedy 배분 → Lot별 할당 계획 미리 표시.</td></tr>
<tr><td><b>정기업무</b></td><td><code>recurring.js</code><br>period 키 중복체크</td><td>GET /tasks 훅으로 트리거. 일(날짜)/주(YYYY-Www)/월(YYYY-MM) period 키로 멱등 보장.</td></tr>
<tr><td><b>유해물질</b></td><td><code>buildLedger()</code><br>hazardous_ledger 오버라이드</td><td>transactions 집계 → 일별 이월 체인. 수동 입력은 hazardous_ledger로 오버라이드 가능.</td></tr>
</tbody>
</table>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>StockPilot 종합 개발 보고서</title><style>${CSS}</style></head><body><div class="wrap">
<div class="hero">
  <span class="badge">StockPilot 종합 개발 보고서</span>
  <h1>전체 개발 플로우와<br>기술 구현 상세</h1>
  <p>버전별 흐름 · 핵심 코드 패턴 · 인터락 · 버그 수정</p>
  <div class="links">화학공장 수불관리 시스템 · v1 → v7 &nbsp;|&nbsp; <a href="StockPilot_v1_보고서.html">v1</a> <a href="StockPilot_v2_보고서.html">v2</a> <a href="StockPilot_v3_보고서.html">v3</a> <a href="StockPilot_v3_1_보고서.html">v3.1</a> <a href="StockPilot_v4_보고서.html">v4</a> <a href="StockPilot_v5_보고서.html">v5</a> <a href="StockPilot_v6_보고서.html">v6</a> <a href="StockPilot_v7_보고서.html">v7</a></div>
</div>

<section class="sec">
  <h2>1. 전체 개발 흐름 · 버전별 기술 요약</h2>
  <p class="lead">수기관리 통합(v1)에서 출발해 재고 추적 → FIFO 자동화 → 멀티공장·권한 → AI 검색 → 현행 고도화로 단계적으로 발전. 각 버전의 핵심 기술 구현 방식을 함께 기재.</p>
  ${tlHtml}
  <figure class="shot"><img src="${b('dashboard')}" alt="종합현황"><figcaption>현재(v7) 종합현황 — 경고 롤업·퀵메뉴·AI 검색·Task·Canister 현황 <span class="vd">가상데이터</span></figcaption></figure>
</section>

<section class="sec">
  <h2>2. 시스템 아키텍처 — 기술 스택 상세</h2>
  <p class="lead">React 18 + Express.js + CSV 파일 저장소로 구성된 3-tier 구조. DB 없이 폐쇄망에서 즉시 운영 가능.</p>
  ${archTable}
  <h3>핵심 저장소 패턴</h3>
<pre><span class="c">// server/src/lib/store.js — 전체 시스템의 핵심 저장소 추상화</span>
<span class="k">const</span> TABLES = {
  items:           [<span class="s">'id'</span>,<span class="s">'category'</span>,<span class="s">'name'</span>,<span class="s">'unit'</span>,<span class="s">'safetyStock'</span>,<span class="s">'warningPct'</span>,<span class="s">'itemGroup'</span>,<span class="s">'groupDefault'</span>,...],
  raw_materials:   [<span class="s">'id'</span>,<span class="s">'itemId'</span>,<span class="s">'lotNo'</span>,<span class="s">'receivedDate'</span>,<span class="s">'quantity'</span>,<span class="s">'weight'</span>,...],
  transactions:    [<span class="s">'id'</span>,<span class="s">'type'</span>,<span class="s">'materialId'</span>,<span class="s">'quantity'</span>,<span class="s">'batchNo'</span>,<span class="s">'date'</span>,...],
  batches:         [<span class="s">'id'</span>,<span class="s">'batchNo'</span>,<span class="s">'product'</span>,<span class="s">'year'</span>,<span class="s">'status'</span>,...],
  recurring_tasks: [<span class="s">'id'</span>,<span class="s">'title'</span>,<span class="s">'cycle'</span>,<span class="s">'weekday'</span>,<span class="s">'monthday'</span>,<span class="s">'active'</span>,...],
  hazardous_ledger:[<span class="s">'id'</span>,<span class="s">'itemName'</span>,<span class="s">'date'</span>,<span class="s">'carryOver'</span>,<span class="s">'inQty'</span>,<span class="s">'outQty'</span>,<span class="s">'balance'</span>,...],
};

<span class="c">// readTable: CSV → 헤더 기반 객체 배열</span>
<span class="k">async function</span> <span class="fn">readTable</span>(table, plant) { <span class="c">/* CSV 파싱 → [{id, name, ...}, ...] */</span> }

<span class="c">// mutate: withLock 내부에서 rows 수정 후 저장 (원자적)</span>
<span class="k">async function</span> <span class="fn">mutate</span>(table, plant, fn) {
  <span class="k">return</span> <span class="fn">withLock</span>(table, plant, <span class="k">async</span> () => {
    <span class="k">const</span> rows = <span class="k">await</span> <span class="fn">readTable</span>(table, plant);
    <span class="k">const</span> result = <span class="fn">fn</span>(rows);  <span class="c">// rows 직접 변경</span>
    <span class="k">await</span> <span class="fn">writeTable</span>(table, plant, rows);
    <span class="k">return</span> result;
  });
}</pre>
</section>

<section class="sec">
  <h2>3. 버전별 포커스 — 기술 흐름 · 인터락 · 편의</h2>
  <p class="lead">각 버전이 어떤 문제를 어떤 방식으로 풀었는지, 핵심 코드 패턴과 안전장치를 함께 정리.</p>
  ${focusHtml}
</section>

<section class="sec">
  <h2>4. 인터락(안전장치) 총정리</h2>
  <p class="lead">실수·사고·무단 접근을 시스템이 서버 레벨에서 차단하는 장치들. 클라이언트 우회 불가.</p>
  ${cell('lock', locks)}
</section>

<section class="sec">
  <h2>5. 편의성 증대 기능 총정리</h2>
  <p class="lead">반복 입력을 줄이고, 자동화하고, 직관적으로 보이게 한 기능들.</p>
  ${cell('easy', easies)}
</section>

<section class="sec">
  <h2>6. 버그 수정 · 원인 분석 총정리</h2>
  <p class="lead">발생한 문제와 그 근본 원인, 해결 방식을 기록. 동일 실수 방지 목적.</p>
  ${cell('fix', bugs)}

  <h3>주요 버그 수정 코드 패턴</h3>
<pre><span class="c">// [배치삭제 재고원복] bulk-delete에 delta 계산 추가</span>
<span class="k">const</span> delta = (t.type === <span class="s">'출고'</span>) ? +<span class="fn">num</span>(t.quantity) : -<span class="fn">num</span>(t.quantity);
lot[qtyKey] = <span class="fn">String</span>(<span class="fn">Math.max</span>(<span class="n">0</span>, <span class="fn">num</span>(lot[qtyKey]) + delta));

<span class="c">// [X-Plant 한글] 인코딩 쌍 처리</span>
headers: { <span class="s">'X-Plant'</span>: <span class="fn">encodeURIComponent</span>(plant) }  <span class="c">// client</span>
<span class="k">const</span> plant = <span class="fn">decodeURIComponent</span>(req.headers[<span class="s">'x-plant'</span>]);  <span class="c">// server</span>

<span class="c">// [toast API] 사내 유틸 명칭으로 교정</span>
toast.<span class="fn">err</span>(<span class="s">'오류 메시지'</span>);   <span class="c">// ← toast.error() 아님</span>
toast.<span class="fn">ok</span>(<span class="s">'성공 메시지'</span>);    <span class="c">// ← toast.success() 아님</span>

<span class="c">// [batches 잔류] 배치 레코드도 함께 삭제</span>
<span class="k">await</span> <span class="fn">mutate</span>(<span class="s">'batches'</span>, plant, rows => {
  batchIds.<span class="fn">forEach</span>(bid => {
    <span class="k">const</span> idx = rows.<span class="fn">findIndex</span>(b => b.id === bid);
    <span class="k">if</span> (idx >= <span class="n">0</span>) rows.<span class="fn">splice</span>(idx, <span class="n">1</span>);
  });
});</pre>
</section>

<section class="sec">
  <h2>7. 주요 알고리즘 상세</h2>
  <p class="lead">시스템의 핵심 로직 — FIFO, 정기업무, 유해물질 대장, 배치번호 자동채번.</p>

  <h3>① FIFO 배치 분배 (fifoPlan)</h3>
<pre><span class="c">// BOM 한 자재의 필요량을 여러 Lot에 배분</span>
<span class="k">function</span> <span class="fn">fifoPlan</span>(lots, neededQty) {
  <span class="k">const</span> sorted = [...lots]
    .<span class="fn">filter</span>(l => <span class="fn">num</span>(l.quantity) > <span class="n">0</span>)
    .<span class="fn">sort</span>((a,b) => a.receivedDate.<span class="fn">localeCompare</span>(b.receivedDate));  <span class="c">// 최고참 먼저</span>
  <span class="k">const</span> plan = [];  <span class="k">let</span> remain = neededQty;
  <span class="k">for</span> (<span class="k">const</span> lot <span class="k">of</span> sorted) {
    <span class="k">if</span> (remain &lt;= <span class="n">0</span>) <span class="k">break</span>;
    <span class="k">const</span> take = <span class="fn">Math.min</span>(<span class="fn">num</span>(lot.quantity), remain);
    plan.<span class="fn">push</span>({ lotId: lot.id, lotNo: lot.lotNo, take, remaining: <span class="fn">num</span>(lot.quantity) - take });
    remain -= take;
  }
  <span class="k">return</span> { plan, shortage: remain };  <span class="c">// shortage > 0 → 재고 부족 경고</span>
}</pre>

  <h3>② 정기업무 멱등 생성 (materializeRecurring)</h3>
<pre><span class="c">// server/src/lib/recurring.js</span>
<span class="k">function</span> <span class="fn">getPeriodKey</span>(tmpl, today) {
  <span class="k">if</span> (tmpl.cycle === <span class="s">'일'</span>) <span class="k">return</span> today;                    <span class="c">// e.g. "2026-06-29"</span>
  <span class="k">if</span> (tmpl.cycle === <span class="s">'주'</span>) <span class="k">return</span> <span class="fn">getWeekKey</span>(today);          <span class="c">// e.g. "2026-W26"</span>
  <span class="k">if</span> (tmpl.cycle === <span class="s">'월'</span>) <span class="k">return</span> today.<span class="fn">slice</span>(<span class="n">0</span>,<span class="n">7</span>);            <span class="c">// e.g. "2026-06"</span>
}
<span class="k">const</span> exists = tasks.<span class="fn">some</span>(t =>
  t.recurringId === tmpl.id && t.period === <span class="fn">getPeriodKey</span>(tmpl, today));
<span class="k">if</span> (!exists) <span class="k">await</span> <span class="fn">createTask</span>({ ...tmpl, period, recurringId: tmpl.id });</pre>

  <h3>③ 유해물질 일별 이월 체인 (buildLedger)</h3>
<pre><span class="c">// 날짜 오름차순으로 정렬 후 carryOver 체인 계산</span>
<span class="k">let</span> carry = initialCarry;
<span class="k">for</span> (<span class="k">const</span> day <span class="k">of</span> sortedDays) {
  <span class="k">const</span> inQty = <span class="fn">aggregateIn</span>(day);     <span class="c">// transactions 입고 합계</span>
  <span class="k">const</span> outQty = <span class="fn">aggregateOut</span>(day);   <span class="c">// transactions 출고 합계</span>
  <span class="k">const</span> override = ledger.<span class="fn">find</span>(l => l.date === day);  <span class="c">// 수동 오버라이드</span>
  <span class="k">const</span> balance = override ? <span class="fn">num</span>(override.balance)
                           : carry + inQty - outQty;
  rows.<span class="fn">push</span>({ date: day, carryOver: carry, inQty, outQty, balance });
  carry = balance;  <span class="c">// 다음 날 이월</span>
}</pre>

  <h3>④ 배치번호 자동채번 (nextProductBatchNo)</h3>
<pre><span class="c">// 제품별·연도별 다음 번호 계산</span>
<span class="k">const</span> <span class="fn">nextProductBatchNo</span> = (batches, product, year) => {
  <span class="k">const</span> existing = batches
    .<span class="fn">filter</span>(b => b.product === product && b.year === String(year))
    .<span class="fn">map</span>(b => <span class="fn">parseInt</span>(b.batchNo.<span class="fn">split</span>(<span class="s">'#'</span>)[<span class="n">1</span>]) || <span class="n">0</span>);
  <span class="k">return</span> (<span class="fn">Math.max</span>(<span class="n">0</span>, ...existing) + <span class="n">1</span>).<span class="fn">toString</span>().<span class="fn">padStart</span>(<span class="n">2</span>, <span class="s">'0'</span>);
  <span class="c">// 결과: "26#01", "26#02", ... (연도 변경 시 리셋)</span>
};</pre>
</section>

<div class="shot-row" style="margin:18px 0;">
  <figure><img src="${b('hazardous')}" alt="유해물질"><figcaption>유해화학물질 관리대장 <span class="vd">가상데이터</span></figcaption></figure>
  <figure><img src="${b('input-history')}" alt="투입이력"><figcaption>배치 투입이력 — 제품군별 탭 <span class="vd">가상데이터</span></figcaption></figure>
</div>

<div class="close">
  <h2>마무리</h2>
  <p>v1~v7까지 수기관리 통합 → Lot 추적 → FIFO 자동화 → 멀티공장·권한 → AI 검색 → 현행 고도화 단계를 거쳐 현장 요구사항을 반영해왔습니다. <b>지속적인 실사용자(현장) 피드백을 통해 보완·발전</b>해 나갈 예정입니다. 불편 사항이나 추가 기능 요청은 시스템 내 <b>건의사항</b> 또는 담당자에게 알려주시면 반영하겠습니다.</p>
</div>

<div class="foot">StockPilot · 화학공장 수불관리 시스템 — 종합 개발 보고서 (v1 → v7)</div>
</div></body></html>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + 'KB');
