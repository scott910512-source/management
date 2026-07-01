import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { Field, TextInput, useToast } from '../../components/ui';
import { PROD_TABLE_COLS, colLabel } from './ProdDashboard';

function PlantFileSettings({ plant, toast }) {
  const [path, setPath] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const defaultKw = `${plant},Daily,report`;

  useEffect(() => {
    api.get(`/settings?plant=${encodeURIComponent(plant)}`).then((d) => {
      setPath(d.settings.productionFilePath || '');
      setKeywords(d.settings.productionFileKeywords || defaultKw);
      setLoaded(true);
    });
  }, [plant]);

  async function save() {
    setBusy(true);
    setTestResult(null);
    try {
      await api.patch(`/settings?plant=${encodeURIComponent(plant)}`, {
        productionFilePath: path,
        productionFileKeywords: keywords,
      });
      toast.ok(`[${plant}] 파일 경로가 저장되었습니다.`);
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  async function testPath() {
    setTesting(true);
    setTestResult(null);
    try {
      const d = await api.post('/production/test-path', { filePath: path, keywords });
      setTestResult({ ok: true, message: d.message, file: d.file });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally { setTesting(false); }
  }

  return (
    <div style={{ border: '1px solid #e5e5ea', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#1c1c1e' }}>🏭 {plant}</h4>
      <Field label="공유폴더 경로" hint="서버 기준 절대경로. 예: C:\Share\DailyReport  또는  /mnt/share/daily">
        <TextInput value={path} onChange={(e) => setPath(e.target.value)} disabled={!loaded}
          placeholder={`예: C:\\Share\\${plant}_Daily`}
          style={{ fontFamily: 'monospace', fontSize: 13 }} />
      </Field>
      <Field label="파일명 검색 키워드" hint="쉼표로 구분. 파일명에 모두 포함된 경우만 인식. (대소문자 무시)">
        <TextInput value={keywords} onChange={(e) => setKeywords(e.target.value)} disabled={!loaded}
          placeholder={defaultKw} />
      </Field>
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button className="btn" onClick={save} disabled={busy || !loaded}>{busy ? '저장 중…' : '저장'}</button>
        <button className="btn secondary" onClick={testPath} disabled={testing || !path}>{testing ? '확인 중…' : '경로 테스트'}</button>
      </div>
      {testResult && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: testResult.ok ? '#e8f8ed' : '#ffe8e8',
          border: `1px solid ${testResult.ok ? '#a8e6bc' : '#ffb3b3'}`,
        }}>
          <span style={{ fontWeight: 700, color: testResult.ok ? '#1a7f3c' : '#c0001a' }}>
            {testResult.ok ? '✅ 파일 감지 성공' : '❌ 오류'}
          </span>
          <div style={{ marginTop: 4, color: '#3c3c43' }}>{testResult.message}</div>
          {testResult.file && <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12, color: '#6e6e73' }}>→ {testResult.file}</div>}
        </div>
      )}
    </div>
  );
}

const DEFAULT_PRODUCTS = ['CpHf', '3DMAS', 'SP17', 'Ynfinity'];

// 재고 기준정보: 품목별 연간계획(kg)/포장단위(kg) → ÷12÷포장 = 월소비(can) → 잔여 개월수
function InventoryBaseline({ plant, toast }) {
  const [cfg, setCfg] = useState({});      // { 제품: { annualPlan, packageUnit, monthlyUse, safetyMonths } }
  const [productList, setProductList] = useState(DEFAULT_PRODUCTS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/settings?plant=${encodeURIComponent(plant)}`).then((d) => {
      let parsed = {};
      try { parsed = d.settings.prodInvConfig ? JSON.parse(d.settings.prodInvConfig) : {}; } catch { parsed = {}; }
      setCfg(parsed);
      // 품목 목록은 셀 매핑(prodCellMap.products)에서 가져온다.
      let prods = DEFAULT_PRODUCTS;
      try {
        const cm = d.settings.prodCellMap ? JSON.parse(d.settings.prodCellMap) : null;
        if (cm && cm.products) prods = String(cm.products).split(',').map((s) => s.trim()).filter(Boolean);
      } catch { /* 기본값 */ }
      setProductList(prods.length ? prods : DEFAULT_PRODUCTS);
      setLoaded(true);
    });
  }, [plant]);

  function setField(p, key, val) {
    setCfg((c) => ({ ...c, [p]: { ...(c[p] || {}), [key]: val } }));
  }
  // 월 소비량(can) = 연간계획(kg) ÷ 12 ÷ 포장단위(kg)
  function autoMonthly(p) {
    const ap = Number(cfg[p]?.annualPlan);
    const pk = Number(cfg[p]?.packageUnit);
    return (Number.isFinite(ap) && Number.isFinite(pk) && pk > 0) ? Math.round((ap / 12 / pk) * 10) / 10 : null;
  }

  async function save() {
    setBusy(true);
    try {
      const clean = {};
      for (const p of productList) {
        const ap = cfg[p]?.annualPlan, pk = cfg[p]?.packageUnit, mu = cfg[p]?.monthlyUse, sm = cfg[p]?.safetyMonths;
        const o = {};
        if (ap !== undefined && ap !== '') o.annualPlan = Number(ap);
        if (pk !== undefined && pk !== '') o.packageUnit = Number(pk);
        if (mu !== undefined && mu !== '') o.monthlyUse = Number(mu);
        if (sm !== undefined && sm !== '') o.safetyMonths = Number(sm);
        if (Object.keys(o).length) clean[p] = o;
      }
      await api.patch(`/settings?plant=${encodeURIComponent(plant)}`, { prodInvConfig: JSON.stringify(clean) });
      toast.ok(`[${plant}] 재고 기준정보가 저장되었습니다.`);
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: '1px solid #e5e5ea', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>🏭 {plant} — 재고 기준정보 (잔여 개월수)</h4>
      <p className="hint" style={{ marginBottom: 10 }}>
        <b>월 소비량(can) = 연간계획(kg) ÷ 12 ÷ 포장단위(kg)</b>. 월 소비량은 직접 수정할 수 있습니다.<br />
        잔여수량(can) ÷ 월소비(can) = <b>잔여 개월수</b>.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: '#86868b', fontSize: 12 }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>품목</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>연간계획 (kg)</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>포장단위 (kg/can)</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>월 소비량 (can, 자동/수정)</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>안전재고 (개월)</th>
          </tr>
        </thead>
        <tbody>
          {productList.map((p) => {
            const auto = autoMonthly(p);
            const cell = { width: 88, textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d1d6', borderRadius: 6 };
            return (
              <tr key={p} style={{ borderTop: '1px solid #f0f0f5' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700 }}>{p}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                  <input type="number" value={cfg[p]?.annualPlan ?? ''} disabled={!loaded}
                    onChange={(e) => setField(p, 'annualPlan', e.target.value)} style={cell} />
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                  <input type="number" value={cfg[p]?.packageUnit ?? ''} disabled={!loaded}
                    onChange={(e) => setField(p, 'packageUnit', e.target.value)} style={cell} />
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                  <input type="number" value={cfg[p]?.monthlyUse ?? ''} disabled={!loaded}
                    onChange={(e) => setField(p, 'monthlyUse', e.target.value)}
                    placeholder={auto != null ? String(auto) : '자동'} style={cell} />
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                  <input type="number" value={cfg[p]?.safetyMonths ?? ''} disabled={!loaded}
                    onChange={(e) => setField(p, 'safetyMonths', e.target.value)}
                    placeholder="2" style={cell} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={save} disabled={busy || !loaded}>{busy ? '저장 중…' : '재고 기준정보 저장'}</button>
      </div>
    </div>
  );
}

// 계획달성 표에 표시할 컬럼 선택
function TableColsConfig({ plant, toast }) {
  const [sel, setSel] = useState(PROD_TABLE_COLS.map((c) => c.key));
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/settings?plant=${encodeURIComponent(plant)}`).then((d) => {
      let arr = null;
      try { arr = d.settings.prodTableCols ? JSON.parse(d.settings.prodTableCols) : null; } catch { arr = null; }
      setSel(Array.isArray(arr) && arr.length ? arr : PROD_TABLE_COLS.map((c) => c.key));
      setLoaded(true);
    });
  }, [plant]);

  function toggle(key) {
    setSel((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }
  async function save() {
    setBusy(true);
    try {
      const ordered = PROD_TABLE_COLS.filter((c) => sel.includes(c.key)).map((c) => c.key);
      await api.patch(`/settings?plant=${encodeURIComponent(plant)}`, { prodTableCols: JSON.stringify(ordered) });
      toast.ok(`[${plant}] 표시 컬럼이 저장되었습니다.`);
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: '1px solid #e5e5ea', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🏭 {plant} — 계획 달성 현황 표시 컬럼</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PROD_TABLE_COLS.map((c) => {
          const on = sel.includes(c.key);
          return (
            <button key={c.key} onClick={() => toggle(c.key)} disabled={!loaded}
              style={{
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: `1.5px solid ${on ? '#0071e3' : '#d1d1d6'}`,
                background: on ? '#0071e3' : '#fff', color: on ? '#fff' : '#6e6e73',
              }}>{on ? '✓ ' : ''}{colLabel(c.label, '당월')}</button>
          );
        })}
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={busy || !loaded}>{busy ? '저장 중…' : '표시 컬럼 저장'}</button>
      </div>
    </div>
  );
}

export default function ProdSettings() {
  const { isAdmin, isSuper } = useAuth();
  const toast = useToast();

  if (!isAdmin) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 40, color: '#86868b' }}>
        관리자만 접근할 수 있습니다.
      </div>
    );
  }

  const plants = isSuper ? ['1공장', '2공장'] : ['2공장'];

  return (
    <>
      <div className="page-head">
        <div className="desc">ManagePilot — Daily Report 파일 경로 및 연동 설정</div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 680 }}>
        <h3 style={{ marginBottom: 4 }}>🏭 Daily Report 파일 경로 설정</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          서버에서 접근 가능한 <b>공유폴더 경로</b>를 공장별로 설정합니다.<br />
          지정된 폴더에서 키워드를 포함한 <b>최신 xlsx 파일</b>을 자동으로 찾아 파싱합니다.
        </p>
        {plants.map((p) => (
          <PlantFileSettings key={p} plant={p} toast={toast} />
        ))}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 680 }}>
        <h3 style={{ marginBottom: 4 }}>📦 재고 기준정보</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          품목별 <b>연간계획</b>을 입력하면 종합현황 재고 카드에 <b>잔여 개월수</b>가 표시됩니다.
        </p>
        {plants.map((p) => (
          <InventoryBaseline key={p} plant={p} toast={toast} />
        ))}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 680 }}>
        <h3 style={{ marginBottom: 4 }}>📋 계획 달성 현황 표시 컬럼</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          종합현황의 <b>품목별 계획 달성 현황</b> 표에 표시할 컬럼을 선택합니다.
        </p>
        {plants.map((p) => (
          <TableColsConfig key={p} plant={p} toast={toast} />
        ))}
      </div>
    </>
  );
}
