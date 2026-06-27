import { useRef, useState } from 'react';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { PageHeader } from '../components/ui';

export function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { refresh } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const exportExcel = () => api.download('/export/excel', 'travel-korea-visits.xlsx');
  const exportBackup = () => api.download('/export/backup', 'travel-korea-backup.json');

  const importBackup = async (file: File) => {
    setBusy(true);
    setMsg('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.post<{ visits: number; wishlist: number }>('/export/restore', data);
      await refresh();
      setMsg(`복원 완료: 방문 ${result.visits}건, 버킷리스트 ${result.wishlist}건`);
    } catch (e) {
      setMsg(e instanceof Error ? `복원 실패: ${e.message}` : '복원 실패');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="설정 · 백업" desc="테마, 내보내기, 데이터 백업/복원" icon="⚙️" />

      <div className="flex flex-col gap-4">
        {/* 테마 */}
        <section className="glass flex items-center justify-between p-5">
          <div>
            <h2 className="font-bold">다크 모드</h2>
            <p className="text-xs text-slate-500">화면 테마를 전환합니다.</p>
          </div>
          <button onClick={toggle} className="btn-ghost">
            {theme === 'dark' ? '☀️ 라이트로' : '🌙 다크로'}
          </button>
        </section>

        {/* 엑셀 내보내기 */}
        <section className="glass p-5">
          <h2 className="font-bold">엑셀 내보내기</h2>
          <p className="mb-3 text-xs text-slate-500">방문 기록을 xlsx 파일로 다운로드합니다.</p>
          <button onClick={exportExcel} className="btn-primary">
            📊 엑셀(.xlsx) 다운로드
          </button>
        </section>

        {/* 백업/복원 */}
        <section className="glass p-5">
          <h2 className="font-bold">데이터 백업 · 복원</h2>
          <p className="mb-3 text-xs text-slate-500">
            방문 기록과 버킷리스트를 JSON으로 백업하거나 복원합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportBackup} className="btn-ghost">
              ⬇️ JSON 백업
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost" disabled={busy}>
              ⬆️ JSON 복원
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
            />
          </div>
          {msg && <p className="mt-3 text-sm text-brand-700 dark:text-brand-500">{msg}</p>}
        </section>
      </div>
    </div>
  );
}
