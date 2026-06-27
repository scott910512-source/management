import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Field, TextInput, useToast } from '../components/ui';

export default function Settings() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [ratio, setRatio] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/settings').then((d) => {
      setSettings(d.settings);
      setRatio(d.settings.safetyRatioPercent);
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

  if (!settings) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div className="desc">대시보드 안전재고 경고 기준을 설정합니다.</div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <h3 style={{ marginBottom: 6 }}>안전재고 경고 비율</h3>
        <p className="hint" style={{ marginBottom: 18 }}>
          품목별 <b>안전재고 목표값</b>은 <b>[품목·안전재고]</b> 메뉴에서 설정합니다(관리자). 여기서는 전체 공통 <b>경고 비율(%)</b>을 정합니다.
          현재 재고가 <b>(목표값 × 비율%)</b> 미만이면 대시보드·현황에서 빨간색으로 경고합니다.
        </p>
        <Field label="경고 비율 (%)" hint="예: 100 → 기준수량 미만일 때 경고 / 120 → 기준수량의 1.2배 미만일 때 경고">
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
    </>
  );
}
