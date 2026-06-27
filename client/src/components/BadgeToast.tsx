import { useEffect } from 'react';
import { useData } from '../context/DataContext';
import { BADGE_LABELS } from '../utils/badges';

export function BadgeToast() {
  const { newBadges, clearNewBadges } = useData();

  useEffect(() => {
    if (newBadges.length === 0) return;
    const t = setTimeout(clearNewBadges, 5000);
    return () => clearTimeout(t);
  }, [newBadges, clearNewBadges]);

  if (newBadges.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {newBadges.map((key, i) => {
        const meta = BADGE_LABELS[key];
        return (
          <div
            key={`${key}-${i}`}
            className="glass animate-pop flex items-center gap-3 px-4 py-3 shadow-glass-lg"
          >
            <span className="text-2xl">{meta?.icon ?? '🏅'}</span>
            <div>
              <div className="text-xs text-slate-500">새 배지 획득!</div>
              <div className="text-sm font-bold">{meta?.name ?? key}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
