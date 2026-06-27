export function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 0~100 비율 → 색상 (회색 → 초록) */
export function rateColor(rate: number): string {
  const r = Math.max(0, Math.min(100, rate));
  // unvisited(#cbd5e1) → visited(#34d399)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * (r / 100));
  const from = { r: 203, g: 213, b: 225 };
  const to = { r: 52, g: 211, b: 153 };
  return `rgb(${lerp(from.r, to.r)}, ${lerp(from.g, to.g)}, ${lerp(from.b, to.b)})`;
}
