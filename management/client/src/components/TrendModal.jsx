import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal, Loading, Empty } from './ui';

/** 품목별 사용량(출고) 트렌드 — 주/월/년, 막대 시각화 */
export function TrendModal({ category, title = '사용량 분석', onClose }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/trends?category=${category}&period=${period}`).then(setData);
  }, [period, category]);

  const maxOut = data ? Math.max(1, ...data.items.flatMap((it) => data.labels.map((l) => (it.series[l]?.out || 0)))) : 1;

  return (
    <Modal title={`📈 ${title} (트렌드)`} size="lg" onClose={onClose} footer={<button className="btn" onClick={onClose}>닫기</button>}>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        {[['week', '주'], ['month', '월'], ['year', '년']].map(([p, l]) => (
          <button key={p} className={`btn sm ${period === p ? '' : 'secondary'}`} onClick={() => setPeriod(p)}>{l}별</button>
        ))}
        <span className="hint" style={{ marginLeft: 6 }}>막대 = 기간별 사용량(출고)</span>
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? <Empty>수불 데이터가 없습니다.</Empty> : (
        <div className="table-wrap">
          <table className="tbl compact">
            <thead>
              <tr>
                <th>품목</th>
                <th className="num">총 입고</th>
                <th className="num">총 사용</th>
                {data.labels.map((l) => <th key={l} className="num">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.name}>
                  <td><b>{it.name}</b></td>
                  <td className="num" style={{ color: 'var(--green)' }}>{it.totalIn.toLocaleString()}</td>
                  <td className="num" style={{ color: 'var(--orange)' }}>{it.totalOut.toLocaleString()}</td>
                  {data.labels.map((l) => {
                    const out = it.series[l]?.out || 0;
                    return (
                      <td key={l} className="num">
                        <div style={{ fontSize: 12 }}>{out ? out.toLocaleString() : '–'}</div>
                        <div className="bar-track" style={{ marginTop: 3 }}>
                          <span className="bar-fill orange" style={{ width: `${(out / maxOut) * 100}%` }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
