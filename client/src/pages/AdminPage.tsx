import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AdminUser, Role } from '../types';
import { PageHeader } from '../components/ui';
import { formatDate } from '../utils/format';

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  const load = () => api.get<AdminUser[]>('/admin/users').then(setUsers).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const changeRole = async (id: string, role: Role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    }
  };

  const removeUser = async (id: string) => {
    if (!confirm('이 사용자를 삭제할까요? 관련 기록도 모두 삭제됩니다.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="관리자" desc="사용자 및 권한 관리 (최대 50명 규모 내부 공유)" icon="🛡️" />

      {error && <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/40 text-left text-xs text-slate-500 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">가입일</th>
              <th className="px-4 py-3">권한</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/30 dark:border-white/5">
                <td className="px-4 py-3 font-medium">
                  {u.name}
                  {u.id === user?.id && <span className="ml-1 text-[10px] text-brand-600">(나)</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    disabled={u.id === user?.id}
                    className="glass-input w-auto py-1.5 text-xs"
                  >
                    <option value="USER">일반사용자</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== user?.id && (
                    <button onClick={() => removeUser(u.id)} className="text-xs text-red-500 hover:underline">
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
