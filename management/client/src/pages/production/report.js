// ManagePilot 생산현황 보고서 생성기 (HTML 다운로드)
// 단일 공장 / 통합(1+2공장) 모두 지원. 애플풍 카드 + 월별 추이 차트(SVG) + 표.

function fmt1(v) { return v == null ? '–' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function fmtInt(v) { return v == null ? '–' : Number(v).toLocaleString(); }
function pct1(v) { return v == null ? '–' : `${Number(v).toFixed(1)}%`; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function monthOf(reportDate) {
  const m = String(reportDate || '').match(/(\d{1,2})\s*월/);
  return m ? `${parseInt(m[1], 10)}월` : '당월';
}
function curMonthNum(reportDate) {
  const m = String(reportDate || '').match(/(\d{1,2})\s*월/);
  return m ? parseInt(m[1], 10) : 12;
}

function summarize(data) {
  const { products, byProduct } = data;
  const totalMonthActual = products.reduce((s, p) => s + (byProduct[p]?.monthActual || 0), 0);
  const rates = products.map((p) => byProduct[p]?.monthRate).filter((v) => v != null);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  let yw = null;
  for (const p of products) { const d = byProduct[p]; if (!d || d.yield == null || d.yieldTarget == null) continue; const g = d.yieldTarget - d.yield; if (g > 0 && (!yw || g > yw.gap)) yw = { p, gap: g }; }
  let iw = null;
  for (const p of products) { const inv = byProduct[p]?.inventory; if (!inv || !inv.belowSafety || inv.remainingMonths == null) continue; if (!iw || inv.remainingMonths < iw.rm) iw = { p, rm: inv.remainingMonths }; }
  return { totalMonthActual, avgRate, yw, iw };
}

function warnings(data) {
  const out = [];
  for (const p of data.products) {
    const d = data.byProduct[p]; if (!d) continue;
    if (d.yield != null && d.yieldTarget != null && d.yield < d.yieldTarget) {
      const g = d.yieldTarget - d.yield;
      out.push({ e: g >= 5, t: `${p} 수율 ${d.yield.toFixed(1)}% — 목표 ${d.yieldTarget.toFixed(1)}% 대비 -${g.toFixed(1)}%p` });
    }
    const inv = d.inventory;
    if (inv && inv.belowSafety && inv.remainingMonths != null) out.push({ e: true, t: `${p} 재고 잔여 ${inv.remainingMonths.toFixed(1)}개월 — 안전재고(${inv.safetyMonths}개월) 미만` });
  }
  return out;
}

// 월별 추이 선차트 → SVG 문자열 (mode: 'prod' | 'yield')
function lineChartSvg(byProduct, products, mode, currentMonth) {
  const W = 820, H = 230, PL = 50, PR = 72, PT = 14, PB = 24;
  const iW = W - PL - PR, iH = H - PT - PB, M = 12;
  const cur = currentMonth || 12;
  const val = (p, m) => { const md = byProduct[p]?.monthlyData?.[m - 1]; if (!md) return null; const v = mode === 'yield' ? md.yield : md.actual; return (v == null || v < 10) ? null : v; };
  const totals = Array.from({ length: M }, (_, i) => { let s = 0, h = false; for (const p of products) { const v = val(p, i + 1); if (v != null) { s += v; h = true; } } return h ? s : null; });
  let maxV;
  if (mode === 'yield') { const mx = Math.max(0, ...products.flatMap((p) => Array.from({ length: M }, (_, i) => val(p, i + 1) || 0))); maxV = Math.max(100, Math.ceil(mx * 1.1)); }
  else { maxV = Math.max(1, ...totals.map((t) => t || 0)) * 1.1; }
  const toX = (m) => PL + ((m - 1) / (M - 1)) * iW;
  const toY = (v) => PT + (1 - v / maxV) * iH;
  const segsOf = (g) => { const segs = []; let c = []; for (let m = 1; m <= M; m++) { const v = g(m); if (v != null) c.push([toX(m), toY(v), m, v]); else { if (c.length) segs.push(c); c = []; } } if (c.length) segs.push(c); return segs; };
  const series = products.map((p) => ({ color: byProduct[p]?.color || '#888', segs: segsOf((m) => val(p, m)) }));
  if (mode !== 'yield') series.push({ color: '#3c3c43', total: true, segs: segsOf((m) => totals[m - 1]) });

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">`;
  if (cur < M) { const fx = toX(cur) + (iW / (M - 1)) / 2; svg += `<rect x="${fx}" y="${PT}" width="${W - PR - fx}" height="${iH}" fill="#f5f5f7"/><text x="${(fx + (W - PR)) / 2}" y="${PT + iH / 2}" font-size="9" fill="#b0b0b8" text-anchor="middle">데이터 없음</text>`; }
  [0, 0.25, 0.5, 0.75, 1].forEach((f, i) => { const t = Math.round(maxV * f); const y = toY(t); svg += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="${i === 0 ? '#e5e5ea' : '#f0f0f5'}"/><text x="${PL - 5}" y="${y + 3}" font-size="8" fill="#86868b" text-anchor="end">${t.toLocaleString()}</text>`; });
  for (let i = 1; i <= M; i++) svg += `<text x="${toX(i)}" y="${H - 7}" font-size="8" fill="#86868b" text-anchor="middle">${i}월</text>`;
  series.forEach((s) => { s.segs.forEach((seg) => { if (seg.length >= 2) svg += `<polyline points="${seg.map((p) => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.total ? 2.6 : 1.8}" stroke-linejoin="round"/>`; seg.forEach((p) => { svg += `<circle cx="${p[0]}" cy="${p[1]}" r="${s.total ? 3 : 2.4}" fill="${s.color}"/>`; }); }); });
  const labels = series.map((s) => { const ls = s.segs[s.segs.length - 1]; if (!ls) return null; const last = ls[ls.length - 1]; return { x: last[0], y: last[1], origY: last[1], color: s.color, text: mode === 'yield' ? last[3].toFixed(1) + '%' : Math.round(last[3]).toLocaleString() }; }).filter(Boolean).sort((a, b) => a.origY - b.origY);
  const GAP = 15;
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < GAP) labels[i].y = labels[i - 1].y + GAP;
  labels.forEach((L) => { if (Math.abs(L.y - L.origY) > 1) svg += `<line x1="${L.x}" y1="${L.origY}" x2="${L.x + 5}" y2="${L.y}" stroke="${L.color}" stroke-width="0.8" opacity="0.5"/>`; svg += `<rect x="${L.x + 5}" y="${L.y - 8}" width="58" height="16" rx="3" fill="${L.color}"/><text x="${L.x + 34}" y="${L.y + 3.5}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">${L.text}</text>`; });
  svg += `</svg>`;
  return svg;
}

function monthlyTable(byProduct, products, mode, cur) {
  const head = Array.from({ length: cur }, (_, i) => `<th>${i + 1}월</th>`).join('');
  const rows = products.map((p) => {
    const d = byProduct[p] || {};
    const tds = Array.from({ length: cur }, (_, i) => {
      const md = (d.monthlyData || [])[i];
      const v = md ? (mode === 'yield' ? md.yield : md.actual) : null;
      const show = (v == null || v < 10) ? '–' : (mode === 'yield' ? v.toFixed(1) + '%' : fmt1(v));
      return `<td${i === cur - 1 ? ' class="b"' : ''}>${show}</td>`;
    }).join('');
    return `<tr><td class="l"><span class="dot" style="background:${d.color || '#ccc'}"></span>${esc(p)}</td>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr><th class="l">품목</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function plantSection(plant, data, mtime) {
  const { products, byProduct } = data;
  const mon = monthOf(data.reportDate);
  const cur = curMonthNum(data.reportDate);
  const sm = summarize(data);
  const ws = warnings(data);
  const badge = (r) => (r == null ? '' : r >= 100 ? '<span class="badge" style="background:#34c759">달성</span>' : r >= 85 ? '<span class="badge" style="background:#ff9500">진행</span>' : '<span class="badge" style="background:#ff3b30">미달</span>');
  const ydelta = (a, t) => (a == null ? '–' : `${a.toFixed(1)}% ${t != null ? `<span class="${a >= t ? 'green' : 'red'}">(${a - t >= 0 ? '+' : ''}${(a - t).toFixed(1)}%p)</span>` : ''}`);
  const ERR = '<span class="red" style="font-weight:700">⚠ 오류</span>'; // 음수·150% 초과·#DIV/0! 등
  const isErr = (obj, field) => Array.isArray(obj?._errorFields) && obj._errorFields.includes(field);

  const achRows = products.map((p) => {
    const d = byProduct[p] || {};
    return `<tr><td class="l"><span class="dot" style="background:${d.color || '#ccc'}"></span><b>${esc(p)}</b>${d.monthBatch != null ? ` <span style="font-size:10px;color:#888">${d.monthBatch}</span>` : ''}</td>`
      + `<td>${isErr(d, 'monthPlan') ? ERR : fmt1(d.monthPlan)}</td><td class="b">${isErr(d, 'monthActual') ? ERR : fmt1(d.monthActual)}</td>`
      + `<td>${isErr(d, 'monthRate') ? ERR : `<b>${pct1(d.monthRate)}</b> ${badge(d.monthRate)}`}</td>`
      + `<td>${isErr(d, 'yearRate') ? ERR : pct1(d.yearRate)}</td><td>${(isErr(d, 'yield') || isErr(d, 'yieldTarget')) ? ERR : ydelta(d.yield, d.yieldTarget)}</td></tr>`;
  }).join('');
  const totA = products.reduce((s, p) => s + (byProduct[p]?.monthActual || 0), 0);
  const totP = products.reduce((s, p) => s + (byProduct[p]?.monthPlan || 0), 0);
  const totYA = products.reduce((s, p) => s + (byProduct[p]?.yearActual || 0), 0);
  const totYP = products.reduce((s, p) => s + (byProduct[p]?.yearPlan || 0), 0);

  const invRows = products.map((p) => {
    const inv = byProduct[p]?.inventory || {}; const c = byProduct[p]?.color || '#ccc';
    const rm = inv.remainingMonths, smm = inv.safetyMonths != null ? inv.safetyMonths : 2;
    const cls = rm == null ? '' : rm < smm ? 'red' : rm < smm * 1.5 ? 'amber' : 'green';
    return `<tr><td class="l"><span class="dot" style="background:${c}"></span>${esc(p)}</td><td>${isErr(inv, 'filled') ? ERR : fmtInt(inv.filled)}</td><td>${isErr(inv, 'shipped') ? ERR : fmtInt(inv.shipped)}</td><td class="b">${isErr(inv, 'total') ? ERR : fmtInt(inv.total)}</td><td class="${cls}">${rm == null ? '–' : rm.toFixed(1) + '개월'}</td><td>${smm}개월</td></tr>`;
  }).join('');

  return `
  <div class="hd"><div><span class="plant">${esc(plant)}</span><h1>ManagePilot 생산현황 보고서</h1></div>
    <div class="meta">기준일 <b>${esc(data.reportDate || '–')}</b><br>출처 ${esc(mtime || 'daily-latest.csv')}</div></div>

  <div class="sec"><h2><span class="n">1</span> 요약</h2><div class="kpis">
    <div class="kpi"><div class="l">${mon} 생산 실적</div><div class="v">${fmt1(sm.totalMonthActual)}<span style="font-size:13px;color:#86868b"> kg</span></div><div class="s">${mon} 총 실적</div></div>
    <div class="kpi"><div class="l">평균 생산 달성율</div><div class="v ${sm.avgRate >= 100 ? 'green' : ''}">${pct1(sm.avgRate)}</div><div class="s">품목 계획 대비 평균</div></div>
    <div class="kpi"><div class="l">수율 주의 품목</div><div class="v ${sm.yw ? 'red' : 'green'}" style="font-size:18px">${sm.yw ? esc(sm.yw.p) : '없음'}</div><div class="s">${sm.yw ? `목표대비 -${sm.yw.gap.toFixed(1)}%p` : '모두 목표 달성'}</div></div>
    <div class="kpi"><div class="l">재고관리 필요</div><div class="v ${sm.iw ? 'amber' : 'green'}" style="font-size:18px">${sm.iw ? esc(sm.iw.p) : '없음'}</div><div class="s">${sm.iw ? `안전재고 이탈 · 잔여 ${sm.iw.rm.toFixed(1)}개월` : '모두 정상'}</div></div>
  </div></div>

  <div class="sec"><h2><span class="n">2</span> 품목별 계획 달성 현황</h2>
    <table><thead><tr><th class="l">품목</th><th>${mon}계획</th><th>${mon}실적</th><th>${mon} 달성율</th><th>연 생산 달성율</th><th>수율(월)</th></tr></thead>
    <tbody>${achRows}<tr class="sum"><td class="l">합계</td><td>${fmt1(totP)}</td><td>${fmt1(totA)}</td><td>${pct1(totP ? totA / totP * 100 : null)}</td><td>${pct1(totYP ? totYA / totYP * 100 : null)}</td><td>–</td></tr></tbody></table></div>

  <div class="sec"><h2><span class="n">3</span> 재고 현황 (can)</h2>
    <table><thead><tr><th class="l">품목</th><th>충진</th><th>출하</th><th>잔여</th><th>잔여(개월)</th><th>안전재고</th></tr></thead><tbody>${invRows}</tbody></table></div>

  <div class="sec"><h2><span class="n">4</span> 월별 생산량 추이 (kg)</h2>
    ${lineChartSvg(byProduct, products, 'prod', cur)}
    <div style="margin-top:10px">${monthlyTable(byProduct, products, 'prod', cur)}</div></div>

  <div class="sec"><h2><span class="n">5</span> 월별 수율 추이 (%)</h2>
    ${lineChartSvg(byProduct, products, 'yield', cur)}
    <div style="margin-top:10px">${monthlyTable(byProduct, products, 'yield', cur)}</div></div>

  <div class="sec"><h2><span class="n">6</span> 경고 사항</h2>
    ${ws.length ? ws.map((w) => `<div class="warn ${w.e ? 'e' : 'w'}">${w.e ? '🔴' : '🟡'} ${esc(w.t)}</div>`).join('') : '<div class="warn ok">✅ 경고 사항 없음</div>'}</div>`;
}

const CSS = `:root{--ink:#1d1d1f;--sub:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--blue:#0071e3;--card:#fff;--green:#34a853;--amber:#ff9f0a;--red:#ff3b30;}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",sans-serif;line-height:1.5}
.wrap{max-width:880px;margin:0 auto;padding:36px 22px 80px}
.hd{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:14px;margin:26px 0 6px}
.hd h1{font-size:25px;font-weight:700;margin:0;letter-spacing:-.01em}.hd .meta{font-size:13px;color:var(--sub);text-align:right;line-height:1.7}
.hd .plant{display:inline-block;background:var(--blue);color:#fff;font-size:13px;font-weight:700;padding:3px 12px;border-radius:7px;margin-bottom:6px}
.doc-hd{text-align:center;padding:8px 0 0}.doc-hd .badge2{display:inline-block;font-size:12px;font-weight:600;color:var(--blue);background:rgba(0,113,227,.1);padding:5px 13px;border-radius:980px}
.doc-hd h0{display:block;font-size:30px;font-weight:700;margin:14px 0 4px}.doc-hd p{margin:0;color:var(--sub);font-size:14px}
.sec{background:var(--card);border-radius:14px;padding:18px 22px 22px;margin:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.sec h2{font-size:15px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.sec h2 .n{width:22px;height:22px;border-radius:6px;background:var(--blue);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kpi{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.kpi .l{font-size:11px;color:var(--sub);margin-bottom:5px}.kpi .v{font-size:22px;font-weight:800;letter-spacing:-.01em}.kpi .s{font-size:10.5px;color:var(--sub);margin-top:3px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{background:#fafafd;color:var(--sub);font-weight:600;font-size:11px;padding:8px 9px;border-bottom:1px solid var(--line);text-align:center}
th.l,td.l{text-align:left}td{padding:8px 9px;border-bottom:1px solid #f2f2f5;text-align:center}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}.b{font-weight:700}
.red{color:var(--red)}.green{color:var(--green)}.amber{color:var(--amber)}
.badge{font-size:10px;font-weight:700;color:#fff;border-radius:9px;padding:1px 7px}.sum td{background:#f8f8fb;font-weight:700}
.warn{display:flex;gap:8px;align-items:center;font-size:13px;padding:8px 12px;border-radius:8px;margin:6px 0}
.warn.e{background:#ffecec;color:#c0001a}.warn.w{background:#fff7e6;color:#8a5b00}.warn.ok{background:#e9f9ee;color:#1a7f3c}
.foot{text-align:center;color:var(--sub);font-size:12px;margin-top:30px}
@media print{body{background:#fff}.sec{box-shadow:none;border:1px solid var(--line);break-inside:avoid}}`;

export function buildReportHtml({ title, subtitle, plants }) {
  // 통합이면 상단 합계
  let combined = '';
  if (plants.length > 1) {
    const tA = plants.reduce((s, x) => s + x.data.products.reduce((a, p) => a + (x.data.byProduct[p]?.monthActual || 0), 0), 0);
    const tWarn = plants.reduce((s, x) => s + warnings(x.data).length, 0);
    combined = `<div class="sec"><h2><span class="n">∑</span> 양 공장 통합 요약</h2><div class="kpis">
      <div class="kpi"><div class="l">통합 당월 실적</div><div class="v">${fmt1(tA)}<span style="font-size:13px;color:#86868b"> kg</span></div><div class="s">${plants.map((x) => esc(x.plant)).join(' + ')}</div></div>
      <div class="kpi"><div class="l">대상 공장</div><div class="v" style="font-size:18px">${plants.length}개</div><div class="s">${plants.map((x) => esc(x.plant)).join(', ')}</div></div>
      <div class="kpi"><div class="l">경고 합계</div><div class="v ${tWarn ? 'amber' : 'green'}" style="font-size:18px">${tWarn}건</div><div class="s">수율·재고 경고</div></div>
      <div class="kpi"><div class="l">출력일</div><div class="v" style="font-size:16px">${new Date().toLocaleDateString('ko-KR')}</div><div class="s">${new Date().toLocaleTimeString('ko-KR')}</div></div>
    </div></div>`;
  }
  const body = plants.map((x) => plantSection(x.plant, x.data, x.mtime)).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="wrap">
    <div class="doc-hd"><span class="badge2">ManagePilot 보고서</span><h0>${esc(title)}</h0><p>${esc(subtitle || '')} · 출력 ${new Date().toLocaleString('ko-KR')}</p></div>
    ${combined}${body}
    <div class="foot">ManagePilot · 생산 통합관리 시스템 — 자동 생성 보고서</div></div></body></html>`;
}

export function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
