import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, useToast } from '../components/ui';

const now = new Date();
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Number(v || 0).toLocaleString();
const sig = (lvl) => (lvl === 'danger' ? '🔴' : lvl === 'warn' ? '🟠' : '🟢');

// 보고서 본문 HTML 생성(화면/다운로드 공용)
function reportHtml(d) {
  const m = d.meta;
  const k = d.kpi;
  const tbl = (headers, rows) => {
    if (!rows.length) return '<p class="muted">해당 없음</p>';
    return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c == null ? '' : c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const parts = [];

  // 헤더
  parts.push(`<div class="rpt-head">
    <div class="rpt-title">월간 관리현황 보고서</div>
    <div class="rpt-sub">${esc(m.plant)} · ${m.year}년 ${m.month}월 · 생성 ${esc((m.generatedAt || '').slice(0, 16).replace('T', ' '))}</div>
  </div>`);

  // 제품군별 그룹화
  const invGroups = [];
  const gidx = {};
  for (const it of (d.inventory || [])) {
    if (!(it.product in gidx)) { gidx[it.product] = invGroups.length; invGroups.push({ product: it.product, items: [] }); }
    invGroups[gidx[it.product]].items.push(it);
  }

  // 1) 재고 현황 (제품군·품목별) — 입고/사용/순증감/안전재고/유해 초과
  const invRows = [];
  for (const g of invGroups) {
    invRows.push(`<tr class="grp"><td colspan="9">제품군: ${esc(g.product)}</td></tr>`);
    for (const it of g.items) {
      const curTag = (active, ever) => (active ? ' <span class="st-danger">· 현재 지속</span>' : (ever ? ' <span class="muted">· 현재 해소</span>' : ''));
      const safeCell = it.safety > 0
        ? (it.everShort
          ? `<span class="st-danger">월중 부족 ${it.shortCount}회 (최저 ${it.monthMinPct}%)</span>${curTag(it.currentShort, true)}`
          : `<span class="ok">정상 (월최저 ${it.monthMinPct}%)</span>`)
        : '<span class="muted">미설정</span>';
      const hazMaxCell = it.hazardous && it.hazMax > 0 ? `${n(it.hazMax)}${esc(it.unit)}` : '<span class="muted">–</span>';
      const hazCell = it.hazardous && it.hazMax > 0
        ? (it.everHazOver
          ? `<span class="st-danger">월중 초과 ${it.hazOverCount}회 (최고 ${it.monthMaxHazPct}%)</span>${curTag(it.currentHazOver, true)}`
          : `<span class="ok">정상 (월최고 ${it.monthMaxHazPct}%)</span>`)
        : '<span class="muted">–</span>';
      invRows.push(`<tr><td>${esc(it.name)}</td><td>${n(it.monthIn)}</td><td>${n(it.monthOut)}</td><td>${n(it.net)}</td><td><b>${n(it.current)}</b>${esc(it.unit)}</td><td>${it.safety > 0 ? n(it.safety) : '–'}</td><td>${safeCell}</td><td>${hazMaxCell}</td><td>${hazCell}</td></tr>`);
    }
  }
  parts.push(`<section><h2>1. 재고 현황 (제품군·품목별)</h2>
    <p>월 입고 <b>${n(d.flow.inSum)}</b> · 월 사용(출고) <b>${n(d.flow.outSum)}</b> · 순증감 <b>${n(d.flow.net)}</b></p>
    <table><thead><tr><th>품목</th><th>입고</th><th>사용</th><th>순증감</th><th>현재고</th><th>안전재고</th><th>안전재고(월중)</th><th>유해 보관한도</th><th>유해초과(월중)</th></tr></thead><tbody>${invRows.join('')}</tbody></table>
    <p class="muted" style="font-size:11.5px;margin-top:4px">※ 안전재고·유해초과는 <b>선택한 달 동안 발생한 횟수</b>(수불 이력 역산)와 <b>현재 지속/해소</b> 여부를 함께 표시합니다. 현재고는 생성 시점 값입니다.</p>
  </section>`);

  // 2) 품목별 재고 그래프 (현재고 vs 안전재고 vs 최대보관)
  const bars = [];
  for (const g of invGroups) {
    bars.push(`<div class="grp-label">제품군: ${esc(g.product)}</div>`);
    for (const it of g.items) {
      const scale = Math.max(it.current, it.safety, it.hazMax, 1) * 1.15;
      const fillPct = Math.min(100, Math.round((it.current / scale) * 100));
      const safetyPct = it.safety > 0 ? Math.round((it.safety / scale) * 100) : null;
      const hazPos = it.hazMax > 0 ? Math.round((it.hazMax / scale) * 100) : null;
      const cls = it.hazOver ? 'over' : (it.below ? 'low' : 'okbar');
      bars.push(`<div class="ivbar"><div class="ivbar-label" title="${esc(it.name)}">${esc(it.name)}</div><div class="ivbar-track"><div class="ivbar-fill ${cls}" style="width:${fillPct}%"></div>${safetyPct != null ? `<div class="ivbar-mark safety" style="left:${safetyPct}%" title="안전재고 ${n(it.safety)}${esc(it.unit)}"></div>` : ''}${hazPos != null ? `<div class="ivbar-mark hazmax" style="left:${hazPos}%" title="최대보관 ${n(it.hazMax)}${esc(it.unit)}"></div>` : ''}</div><div class="ivbar-val">${n(it.current)}${esc(it.unit)}</div></div>`);
    }
  }
  parts.push(`<section><h2>2. 품목별 재고 그래프</h2>
    <div class="ivlegend"><span class="lg okbar">■</span> 현재고 · <span class="lg-line safety">▏</span> 안전재고 · <span class="lg-line hazmax">▏</span> 최대보관(유해) <span class="muted">— 막대색: 정상(녹)/안전미달(주황)/유해초과(빨강)</span></div>
    ${bars.join('')}
  </section>`);

  // 1) 경영 요약
  const kpiRows = [
    ['월 입고 합계', `${n(k.monthIn)}`, ''],
    ['월 출고(사용) 합계', `${n(k.monthOut)}`, ''],
    ['순증감(입고-출고)', `${n(k.net)}`, k.net < 0 ? '소진 우위' : '적체 우위'],
    ['안전재고 부족 발생(월중)', `${k.safetyShort}건`, sig(k.safetyShort > 0 ? 'danger' : 'ok')],
    ['안전재고 임박 품목(현재)', `${k.safetyNear}건`, sig(k.safetyNear > 0 ? 'warn' : 'ok')],
    ['FIFO 강제출고(이상)', `${k.fifoForced}건`, sig(k.fifoForced > 0 ? 'danger' : 'ok')],
    ['유해 보관한도 초과(월중)', `${k.hazOver}건`, sig(k.hazOver > 0 ? 'danger' : k.hazNear > 0 ? 'warn' : 'ok')],
    ['재고 정합성 불일치', `${k.mismatch}건`, sig(k.mismatch > 0 ? 'warn' : 'ok')],
    ['Canister 사용량 임박', `${k.canisterRisk}건`, sig(k.canisterRisk > 0 ? 'warn' : 'ok')],
    ['고우선순위 지연 업무', `${k.highOverdue}건`, sig(k.highOverdue > 0 ? 'danger' : 'ok')],
    ['이번 달 생성 Batch', `${k.batchCount}건`, ''],
  ];
  parts.push(`<section><h2>3. 경영 요약</h2>
    ${tbl(['지표', '수치', '신호'], kpiRows.map((r) => [esc(r[0]), `<b>${esc(r[1])}</b>`, esc(r[2])]))}
    <h3>이번 달 핵심</h3>
    ${d.top3.length ? `<ul class="hl">${d.top3.map((h) => `<li class="${h.level}"><b>${esc(h.title)}</b> — ${esc(h.detail)}</li>`).join('')}</ul>` : '<p class="ok">특이사항 없음 — 정상 운영</p>'}
  </section>`);

  // 데이터 한계 고지
  parts.push(`<section class="note-box"><b>데이터 산출 고지</b>
    <ul>
      <li>월 귀속은 기록 시각 기준이며, 전월 대비 추세는 다월 누적 후 유효합니다.</li>
      ${d.limits.noTxLots > 0 ? `<li>수불 이력이 없는 Lot ${d.limits.noTxLots}건은 정합성 검증 대상에서 제외했습니다(초기재고 직접등록 등).</li>` : ''}
      ${d.limits.hazardousTracked === 0 ? '<li>유해화학물질로 지정된 품목이 없어 유해 지표는 0건입니다(미지정 ≠ 이상 없음).</li>' : ''}
      ${d.bom.batchTxCount === 0 ? '<li>Batch 번호가 기재된 출고가 없어 BOM 대비 분석은 신규 출고만 대상입니다.</li>' : ''}
    </ul></section>`);

  // 4) 제품별 Batch 투입 — BOM 대비
  parts.push(`<section><h2>4. 제품별 Batch 투입 (BOM 대비)</h2>
    <p>이번 달 생성 Batch <b>${d.bom.batchCount}</b>건 · Batch 출고 <b>${d.bom.batchTxCount}</b>건</p>
    ${tbl(['제품명', '구분', '품목', '실제투입', 'BOM기준×Batch', '편차'],
      d.bom.variance.map((v) => [esc(v.product), v.category === 'raw' ? '원' : '부', esc(v.materialName), `${n(v.actual)}${esc(v.unit)}`, v.expected != null ? n(v.expected) : '–', v.variancePct != null ? `<span class="${Math.abs(v.variancePct) >= 10 ? 'st-warn' : ''}">${v.variancePct > 0 ? '+' : ''}${v.variancePct}%</span>` : '<span class="muted">BOM 미설정</span>']))}
  </section>`);

  // 5) 유해화학물질
  parts.push(`<section><h2>5. 유해화학물질 · 안전</h2>
    ${tbl(['품목', '월 입고', '월 출고', '현재 보관량', '보관가능', '보관율%'],
      d.hazardous.map((h) => [esc(h.name), `${n(h.monthIn)}${esc(h.unit)}`, `${n(h.monthOut)}${esc(h.unit)}`, `${n(h.current)}${esc(h.unit)}`, h.maxQty ? `${n(h.maxQty)}${esc(h.unit)}` : '–', h.pct != null ? `<span class="${h.pct >= 100 ? 'st-danger' : h.pct >= 80 ? 'st-warn' : ''}">${h.pct}%</span>` : '–']))}
  </section>`);

  // 6) Canister
  const canStatusRows = Object.entries(d.canister.byStatus).map(([s, c]) => [esc(s), `${c}개`]);
  parts.push(`<section><h2>6. Canister 현황</h2>
    <p>총 보유 <b>${d.canister.total}</b>개</p>
    ${tbl(['상태', '개수'], canStatusRows)}
    <h3>사용량 임박(90%↑)</h3>
    ${tbl(['No.', '사이즈', '내용물', '무게', '최대', '보관율%'], d.canister.risk.map((c) => [esc(c.canisterNo), esc(c.size), esc(c.content || '–'), `${n(c.weight)}kg`, `${n(c.maxKg)}kg`, `<span class="st-${c.pct >= 100 ? 'danger' : 'warn'}">${c.pct}%</span>`]))}
  </section>`);

  // 7) 이상발생 / FIFO
  parts.push(`<section><h2>7. 이상발생 · 선입선출(FIFO)</h2>
    <p>이번 달 이상발생 <b>${d.anomaly.count}</b>건 (FIFO 강제출고 ${d.anomaly.fifoForced}건)</p>
    ${tbl(['일자', '유형', '품목', '계정', '비고'], d.anomaly.list.map((a) => [esc(a.date), esc(a.type), esc(a.itemName), esc(a.account), esc(a.note || a.lotInfo || '')]))}
  </section>`);

  // 8) Task
  const taskStatusRows = Object.entries(d.task.byStatus).map(([s, c]) => [esc(s), `${c}건`]);
  parts.push(`<section><h2>8. 업무(Task)</h2>
    <p>이번 달 완료 <b>${d.task.monthDone}</b>건 · 지연 <b>${d.task.overdue.length}</b>건(고우선 ${d.task.highOverdue}건)</p>
    ${tbl(['상태', '건수'], taskStatusRows)}
    <h3>지연 업무</h3>
    ${tbl(['Task', '우선', '완료예정', '담당', '상태'], d.task.overdue.map((t) => [esc(t.title), esc(t.priority), esc(t.dueDate), esc(t.assignee || '–'), esc(t.status)]))}
  </section>`);

  // 9) 재고 정합성
  parts.push(`<section><h2>9. 재고 정합성</h2>
    ${d.mismatch.length === 0 ? '<p class="ok">불일치 없음 — 현재고와 수불 이력 합산이 일치합니다.</p>'
      : tbl(['구분', '품목', 'Lot', '현재고', '이력합산', '차이', '단위'], d.mismatch.map((mm) => [esc(mm.type), esc(mm.name), esc(mm.lotNo), n(mm.current), n(mm.calculated), `<span class="st-warn">${mm.diff > 0 ? '+' : ''}${n(mm.diff)}</span>`, esc(mm.unit)]))}
  </section>`);

  // 10) 변경·감사 이력
  parts.push(`<section><h2>10. 변경 · 감사 이력 (기준정보/설정)</h2>
    ${tbl(['일시', '항목', '이전', '변경', '변경자'], d.changes.map((c) => [esc(c.date), esc(c.key), esc(c.old || '–'), esc(c.nv || '–'), esc(c.by)]))}
  </section>`);

  return parts.join('\n');
}

const REPORT_CSS = `
.report { color: #1c1c1e; font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; line-height: 1.5; }
.report .rpt-head { border-bottom: 3px solid #0071e3; padding-bottom: 12px; margin-bottom: 20px; }
.report .rpt-title { font-size: 24px; font-weight: 800; }
.report .rpt-sub { font-size: 13px; color: #666; margin-top: 4px; }
.report section { margin: 20px 0; page-break-inside: avoid; }
.report h2 { font-size: 17px; border-left: 4px solid #0071e3; padding-left: 8px; margin: 18px 0 10px; }
.report h3 { font-size: 14px; color: #444; margin: 12px 0 6px; }
.report table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 6px 0; }
.report th, .report td { border: 1px solid #d8d8de; padding: 5px 8px; text-align: left; }
.report th { background: #f2f4f8; font-weight: 700; }
.report .muted { color: #999; }
.report .ok { color: #1f9d4d; font-weight: 600; }
.report .st-danger { color: #e5453a; font-weight: 700; }
.report .st-warn { color: #d98318; font-weight: 700; }
.report ul.hl { list-style: none; padding: 0; }
.report ul.hl li { padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; background: #f6f7f9; border-left: 4px solid #999; }
.report ul.hl li.danger { background: #fff4f3; border-color: #e5453a; }
.report ul.hl li.warn { background: #fff8ec; border-color: #d98318; }
.report .note-box { background: #f6f7f9; border: 1px solid #e3e5ea; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; }
.report .note-box ul { margin: 6px 0 0; padding-left: 18px; }
.report tr.grp td { background: #eef2f8; font-weight: 700; }
.report .grp-label { font-weight: 700; font-size: 13px; margin: 12px 0 4px; color: #333; }
.report .ivlegend { font-size: 12px; color: #555; margin: 6px 0 10px; }
.report .lg.okbar { color: #1f9d4d; font-weight: 700; }
.report .lg-line.safety { color: #d98318; font-weight: 700; }
.report .lg-line.hazmax { color: #e5453a; font-weight: 700; }
.report .ivbar { display: flex; align-items: center; gap: 8px; margin: 3px 0; page-break-inside: avoid; }
.report .ivbar-label { width: 130px; flex-shrink: 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report .ivbar-track { position: relative; flex: 1; height: 16px; background: #eef0f4; border-radius: 4px; overflow: visible; }
.report .ivbar-fill { height: 100%; border-radius: 4px; }
.report .ivbar-fill.okbar { background: #34c759; }
.report .ivbar-fill.low { background: #ff9f0a; }
.report .ivbar-fill.over { background: #e5453a; }
.report .ivbar-mark { position: absolute; top: -2px; width: 2px; height: 20px; }
.report .ivbar-mark.safety { background: #d98318; }
.report .ivbar-mark.hazmax { background: #e5453a; }
.report .ivbar-val { width: 110px; flex-shrink: 0; font-size: 12px; text-align: right; font-weight: 600; }
`;

export default function Reports() {
  const { plant } = useAuth();
  const toast = useToast();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const d = await api.get(`/reports/monthly?year=${year}&month=${month}`);
      setData(d);
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  function downloadHtml() {
    if (!data) return;
    const body = reportHtml(data);
    const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월간보고서_${data.meta.plant}_${data.meta.ym}</title><style>body{margin:24px;background:#fff;}${REPORT_CSS}</style></head><body><div class="report">${body}</div></body></html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `월간보고서_${data.meta.plant}_${data.meta.ym}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <>
      <style>{REPORT_CSS + '\n@media print { .no-print { display: none !important; } .sidebar, .topbar { display: none !important; } .content { padding: 0 !important; } }'}</style>
      <div className="page-head no-print">
        <div className="desc">월간 관리현황 보고서를 <b>실제 수치</b>로 생성합니다. (관리자 전용 · 현재 공장: {plant})</div>
        <div className="btn-row">
          <select className="plant-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select className="plant-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => <option key={mm} value={mm}>{mm}월</option>)}
          </select>
          <button className="btn sm" onClick={generate} disabled={busy}>{busy ? '집계 중…' : '보고서 생성'}</button>
          {data && <button className="btn secondary sm" onClick={downloadHtml}>⬇ HTML 다운로드</button>}
          {data && <button className="btn secondary sm" onClick={() => window.print()}>🖨 인쇄 / PDF</button>}
        </div>
      </div>

      {busy ? <Loading /> : !data ? (
        <div className="card card-pad no-print"><Empty>연·월을 선택하고 [보고서 생성]을 누르면 실제 수치 기반 보고서가 표시됩니다.</Empty></div>
      ) : (
        <div className="card card-pad">
          <div className="report" dangerouslySetInnerHTML={{ __html: reportHtml(data) }} />
        </div>
      )}
    </>
  );
}
