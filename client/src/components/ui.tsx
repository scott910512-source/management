import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="stat-value mt-2">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, color = '#34d399' }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function PageHeader({ title, desc, icon }: { title: string; desc?: string; icon?: string }) {
  return (
    <header className="mb-4 px-1">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {title} {icon}
      </h1>
      {desc && <p className="text-sm text-slate-500">{desc}</p>}
    </header>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 p-12 text-center text-slate-500">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
