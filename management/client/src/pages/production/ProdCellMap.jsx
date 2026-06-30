import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui';

const DEFAULTS = {
  products: 'CpHf,3DMAS,SP17,Ynfinity',
  productCol: 'B', todayCol: 'E',
  monthPlanCol: 'H', monthActCol: 'K', monthRateCol: 'N',
  yearPlanCol: 'Q', yearActCol: 'T', yearRateCol: 'W',
  yieldRowOffset: 1,
  invFilledCol: 'AF', invShippedCol: 'AJ', invTotalCol: 'AN', invCarryCol: 'AB',
};

const FIELDS = [
  { key: 'productCol', label: '제품명 열', hint: '제품명이 적힌 열 (행 자동 탐색)' },
  { key: 'todayCol', label: '오늘 생산량 열' },
  { key: 'monthPlanCol', label: '월 계획 열' },
  { key: 'monthActCol', label: '월 실적 열' },
  { key: 'monthRateCol', label: '월 달성율 열' },
  { key: 'yearPlanCol', label: '연 계획 열' },
  { key: 'yearActCol', label: '연 실적 열' },
  { key: 'yearRateCol', label: '연 달성율 열' },
  { key: 'invFilledCol', label: '충전완료 열 (can)' },
  { key: 'invShippedCol', label: '출하 열 (can)' },
  { key: 'invTotalCol', label: '잔여수량 열 (can)' },
  { key: 'invCarryCol', label: '이월재고 열 (can)' },
];

function PlantCellMap({ plant, toast }) {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [filePath, setFilePath] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get(`/settings?plant=${encodeURIComponent(plant)}`).then((d) => {
      let parsed = {};
      try { parsed = d.settings.prodCellMap ? JSON.parse(d.settings.prodCellMap) : {}; } catch { parsed = {}; }
      setCfg({ ...DEFAULTS, ...parsed });
      setFilePath(d.settings.productionFilePath || '');
      setLoaded(true);
    });
  }, [plant]);

  function set(key, val) { setCfg((c) => ({ ...c, [key]: val })); }

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/settings?plant=${encodeURIComponent(plant)}`, { prodCellMap: JSON.stringify(cfg) });
      toast.ok(`[${plant}] 셀 매핑이 저장되었습니다.`);
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  async function testMap() {
    setTesting(true); setPreview(null);
    try {
      const d = await api.post('/production/test-path', { filePath, cellMap: JSON.stringify(cfg) });
      setPreview({ ok: true, message: d.message });
    } catch (e) {
      setPreview({ ok: false, message: e.message });
    } finally { setTesting(false); }
  }

  const inp = { width: 56, textAlign: 'center', padding: '5px 6px', border: '1px solid #d1d1d6', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, textTransform: 'uppercase' };

  return (
    <div style={{ border: '1px solid #e5e5ea', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>🏭 {plant} 셀 매핑</h4>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#6e6e73', display: 'block', marginBottom: 4 }}>제품 목록 (쉼표 구분, 카드 순서)</label>
        <input value={cfg.products} disabled={!loaded} onChange={(e) => set('products', e.target.value)}
          style={{ width: '100%', maxWidth: 360, padding: '6px 10px', border: '1px solid #d1d1d6', borderRadius: 6, fontSize: 13 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: 11.5, color: '#6e6e73', display: 'block', marginBottom: 3 }} title={f.hint || ''}>{f.label}</label>
            <input value={cfg[f.key] ?? ''} disabled={!loaded} onChange={(e) => set(f.key, e.target.value)}
              placeholder={DEFAULTS[f.key]} style={inp} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11.5, color: '#6e6e73', display: 'block', marginBottom: 3 }} title="수율 행 = 제품 행 + N">수율 행 오프셋</label>
          <input type="number" value={cfg.yieldRowOffset ?? 1} disabled={!loaded} onChange={(e) => set('yieldRowOffset', e.target.value)}
            style={{ ...inp, fontFamily: 'inherit', textTransform: 'none' }} />
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={save} disabled={busy || !loaded}>{busy ? '저장 중…' : '셀 매핑 저장'}</button>
        <button className="btn secondary" onClick={testMap} disabled={testing || !filePath}>{testing ? '확인 중…' : '미리보기 (현재 CSV)'}</button>
      </div>

      {preview && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: preview.ok ? '#e8f8ed' : '#ffe8e8',
          border: `1px solid ${preview.ok ? '#a8e6bc' : '#ffb3b3'}`,
        }}>
          <span style={{ fontWeight: 700, color: preview.ok ? '#1a7f3c' : '#c0001a' }}>{preview.ok ? '✅ 인식 결과' : '❌ 오류'}</span>
          <div style={{ marginTop: 4, color: '#3c3c43' }}>{preview.message}</div>
        </div>
      )}
    </div>
  );
}

export default function ProdCellMap() {
  const { isAdmin, isSuper } = useAuth();
  const toast = useToast();

  if (!isAdmin) {
    return <div className="card card-pad" style={{ textAlign: 'center', padding: 40, color: '#86868b' }}>관리자만 접근할 수 있습니다.</div>;
  }
  const plants = isSuper ? ['1공장', '2공장'] : ['2공장'];

  return (
    <>
      <div className="page-head">
        <div className="desc">ManagePilot — daily-latest.csv 열(컬럼) 위치를 공장별로 지정</div>
      </div>
      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 760 }}>
        <h3 style={{ marginBottom: 4 }}>🧭 종합현황 셀 매핑</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          공장마다 Daily Report 양식의 열 위치가 다를 수 있습니다. 각 항목이 위치한 <b>엑셀 열 문자</b>(예: B, K, AF)를 입력하세요.<br />
          행은 <b>제품명으로 자동 탐색</b>하며, 수율은 제품 행 + 오프셋 행에서 읽습니다. <b>미리보기</b>로 인식 품목을 확인할 수 있습니다.
        </p>
        {plants.map((p) => <PlantCellMap key={p} plant={p} toast={toast} />)}
      </div>
    </>
  );
}
