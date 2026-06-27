import { useEffect, useState, useCallback } from 'react';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, useToast, ConfirmDialog } from '../components/ui';

export default function Anomalies() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    const d = await api.get('/anomalies?' + (q ? 'q=' + encodeURIComponent(q) : ''));
    setItems(d.items);
  }, [q]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div className="desc">선입선출 오류 등 작업 중 발생한 이상 내역입니다. 강제 사용 시 자동 기록됩니다.</div>
        <button className="btn secondary sm" onClick={() => downloadCsv('/anomalies/export')}>⬇ CSV</button>
      </div>

      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input placeholder="내용/품목/계정 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>기록된 이상발생이 없습니다.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>발생일시</th>
                <th>발생 내용</th>
                <th>품목명</th>
                <th>Lot 정보</th>
                <th>작업 계정</th>
                <th>비고</th>
                {isAdmin && <th style={{ width: 1 }}></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{(a.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td><Badge color="red">{a.type}</Badge></td>
                  <td><b>{a.itemName}</b></td>
                  <td className="muted">{a.lotInfo}</td>
                  <td className="muted">{a.account}</td>
                  <td className="muted">{a.note || '–'}</td>
                  {isAdmin && (
                    <td><div className="btn-row"><button className="btn danger sm" onClick={() => setDel(a)}>삭제</button></div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {del && (
        <ConfirmDialog
          title="이상발생 삭제"
          message="이 이상발생 기록을 삭제할까요?"
          onClose={() => setDel(null)}
          onConfirm={async () => {
            try { await api.del('/anomalies/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); }
            catch (e) { toast.err(e.message); }
          }}
        />
      )}
    </>
  );
}
