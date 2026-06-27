import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Field, TextInput, useToast, Select } from '../components/ui';

export default function Settings() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [ratio, setRatio] = useState('');
  const [busy, setBusy] = useState(false);

  // Canister 관리 상태
  const [cnDefSize, setCnDefSize] = useState('');
  const [cnDefLoc, setCnDefLoc] = useState('');
  const [cnDefStatus, setCnDefStatus] = useState('');
  const [cnSizes, setCnSizes] = useState('');
  const [cnLocs, setCnLocs] = useState('');
  const [cnStats, setCnStats] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newStat, setNewStat] = useState('');
  const [cnBusy, setCnBusy] = useState(false);

  useEffect(() => {
    api.get('/settings').then((d) => {
      const s = d.settings;
      setSettings(s);
      setRatio(s.safetyRatioPercent);
      setCnDefSize(s.canisterDefaultSize || '50L');
      setCnDefLoc(s.canisterDefaultLocation || '2공장현장');
      setCnDefStatus(s.canisterDefaultStatus || '수령');
      setCnSizes(s.canisterSizes || '5gal,50L,100L,200L');
      setCnLocs(s.canisterLocations || '2공장현장,3류창고,4류창고');
      setCnStats(s.canisterStatuses || '수령,사용중,사용완료,세정의뢰,사용금지');
    });
  }, []);

  async function save() {
    setBusy(true);
    try {
      const d = await api.patch('/settings', { safetyRatioPercent: Number(ratio) });
      setSettings(d.settings);
      toast.ok('설정을 저장했습니다.');
    } catch (e) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCn() {
    setCnBusy(true);
    try {
      const d = await api.patch('/settings', {
        canisterDefaultSize: cnDefSize,
        canisterDefaultLocation: cnDefLoc,
        canisterDefaultStatus: cnDefStatus,
        canisterSizes: cnSizes,
        canisterLocations: cnLocs,
        canisterStatuses: cnStats,
      });
      setSettings(d.settings);
      toast.ok('Canister 설정을 저장했습니다.');
    } catch (e) {
      toast.err(e.message);
    } finally {
      setCnBusy(false);
    }
  }

  function addItem(current, newVal, setter, newSetter) {
    const val = newVal.trim();
    if (!val) return;
    const arr = current.split(',').map(s => s.trim()).filter(Boolean);
    if (arr.includes(val)) { toast.err('이미 존재하는 항목입니다.'); return; }
    setter([...arr, val].join(','));
    newSetter('');
  }

  function removeItem(current, item, setter) {
    const arr = current.split(',').map(s => s.trim()).filter(s => s && s !== item);
    setter(arr.join(','));
  }

  function toArr(str) {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (!settings) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div className="desc">안전재고 경고 기준 및 Canister 기준정보를 설정합니다.</div>
      </div>

      {/* 안전재고 경고 비율 */}
      <div className="card card-pad" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6 }}>안전재고 경고 비율</h3>
        <p className="hint" style={{ marginBottom: 18 }}>
          품목별 <b>안전재고 목표값</b>은 <b>[품목·안전재고]</b> 메뉴에서 설정합니다(관리자). 현재 재고가 <b>(목표값 × 비율%)</b> 미만이면 대시보드·현황에서 빨간색으로 경고합니다.
        </p>
        <Field label="경고 비율 (%)" hint="예: 100 → 기준수량 미만 경고 / 120 → 기준수량의 1.2배 미만 경고">
          <div className="form-row" style={{ maxWidth: 220 }}>
            <TextInput type="number" value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={!isAdmin} />
          </div>
        </Field>
        {isAdmin ? (
          <button className="btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        ) : (
          <p className="hint">설정 변경은 관리자만 가능합니다. (현재 값: {settings.safetyRatioPercent}%)</p>
        )}
      </div>

      {/* Canister 기준정보 */}
      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <h3 style={{ marginBottom: 4 }}>Canister 기준정보 관리</h3>
        <p className="hint" style={{ marginBottom: 20 }}>Canister 등록 시 사용할 사이즈·위치·상태 목록과 기본값을 관리합니다.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* 사이즈 */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>사이즈 목록</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {toArr(cnSizes).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ fontSize: 14 }}>{s}</span>
                  {isAdmin && <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnSizes, s, setCnSizes)}>×</button>}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="form-row">
                <TextInput placeholder="새 사이즈 (예: 500L)" value={newSize} onChange={e => setNewSize(e.target.value)} />
                <button className="btn sm secondary" onClick={() => addItem(cnSizes, newSize, setCnSizes, setNewSize)}>추가</button>
              </div>
            )}
            <Field label="기본값" style={{ marginTop: 12 }}>
              <Select value={cnDefSize} onChange={e => setCnDefSize(e.target.value)} disabled={!isAdmin}>
                {toArr(cnSizes).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          {/* 위치 */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>위치 목록</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {toArr(cnLocs).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ fontSize: 14 }}>{s}</span>
                  {isAdmin && <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnLocs, s, setCnLocs)}>×</button>}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="form-row">
                <TextInput placeholder="새 위치 (예: 1공장현장)" value={newLoc} onChange={e => setNewLoc(e.target.value)} />
                <button className="btn sm secondary" onClick={() => addItem(cnLocs, newLoc, setCnLocs, setNewLoc)}>추가</button>
              </div>
            )}
            <Field label="기본값" style={{ marginTop: 12 }}>
              <Select value={cnDefLoc} onChange={e => setCnDefLoc(e.target.value)} disabled={!isAdmin}>
                {toArr(cnLocs).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          {/* 상태 */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>상태 목록</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {toArr(cnStats).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ fontSize: 14 }}>{s}</span>
                  {isAdmin && <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnStats, s, setCnStats)}>×</button>}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="form-row">
                <TextInput placeholder="새 상태 (예: 검사중)" value={newStat} onChange={e => setNewStat(e.target.value)} />
                <button className="btn sm secondary" onClick={() => addItem(cnStats, newStat, setCnStats, setNewStat)}>추가</button>
              </div>
            )}
            <Field label="기본값" style={{ marginTop: 12 }}>
              <Select value={cnDefStatus} onChange={e => setCnDefStatus(e.target.value)} disabled={!isAdmin}>
                {toArr(cnStats).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {isAdmin && (
          <button className="btn" onClick={saveCn} disabled={cnBusy}>{cnBusy ? '저장 중…' : 'Canister 설정 저장'}</button>
        )}
      </div>
    </>
  );
}
