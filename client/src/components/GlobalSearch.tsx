import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import type { Region } from '../types';

export function GlobalSearch() {
  const { regions } = useData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results: Region[] = q.trim()
    ? regions
        .filter(
          (r) =>
            r.district.includes(q.trim()) || r.provinceName.includes(q.trim()),
        )
        .slice(0, 8)
    : [];

  const select = (r: Region) => {
    setOpen(false);
    setQ('');
    navigate(`/map?region=${r.id}`);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="지역 검색 (예: 안동, 부산...)"
          className="glass-input pl-9"
        />
      </div>
      {open && results.length > 0 && (
        <div className="glass absolute z-50 mt-2 max-h-80 w-full overflow-auto p-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => select(r)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/60 dark:hover:bg-white/10"
            >
              <span className="font-medium">{r.district}</span>
              <span className="text-xs text-slate-500">{r.provinceName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
