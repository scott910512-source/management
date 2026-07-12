import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const EXAMPLES = ['이번달 입고', '이번달 헥산 사용량', 'Canister 보유현황', '선입선출 이상'];

export function SmartSearch({ autoFocus, big, inline }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  async function run(text) {
    const query = (text != null ? text : q).trim();
    if (!query) return;
    setQ(query);
    setBusy(true);
    try {
      const d = await api.get('/search?q=' + encodeURIComponent(query));
      setRes(d);
    } catch (e) {
      setRes({ answer: e.message, table: null });
    } finally {
      setBusy(false);
    }
  }

  if (inline) return (
    <div className={`smart ${big ? 'big' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>AI 자연어 검색</div>
      <div className="smart-bar">
        <span className="smart-ico">🔎</span>
        <input ref={ref} placeholder='자연어로 검색: "이번달 톨루엔 사용량", "부족 품목"' value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? '검색중…' : 'AI 검색'}</button>
      </div>
      <div className="smart-ex">
        {EXAMPLES.map((ex) => (<button key={ex} className="chip" onClick={() => run(ex)}>{ex}</button>))}
      </div>
      {res && (
        <div className="smart-res">
          <div className="smart-answer">{res.answer}</div>
          {res.table && res.table.rows.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="tbl compact">
                <thead><tr>{res.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{res.table.rows.map((row, i) => (<tr key={i}>{row.map((c, j) => <td key={j} className={j === 0 ? '' : 'muted'}>{c}</td>)}</tr>))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`card card-pad smart ${big ? 'big' : ''}`}>
      <div className="smart-bar">
        <span className="smart-ico">🔎</span>
        <input
          ref={ref}
          placeholder='자연어로 검색: "이번달 톨루엔 사용량", "부족 품목", "세정의뢰 Canister"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? '검색중…' : 'AI 검색'}</button>
      </div>

      <div className="smart-ex">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => run(ex)}>{ex}</button>
        ))}
      </div>

      {res && (
        <div className="smart-res">
          <div className="smart-answer">{res.answer}</div>
          {res.table && res.table.rows.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="tbl compact">
                <thead><tr>{res.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {res.table.rows.map((row, i) => (
                    <tr key={i}>{row.map((c, j) => <td key={j} className={j === 0 ? '' : 'muted'}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
