import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { Field, TextInput, useToast } from '../../components/ui';

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
    </>
  );
}
