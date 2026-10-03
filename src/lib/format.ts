/** Human-friendly time: 4200 → "4.2 billion years ago", 0.012 → "12,000 years ago". */
export function formatAgo(ma: number, short = false): string {
  if (ma <= 0) return short ? 'today' : 'Today';
  if (ma >= 1000) return `${trim(ma / 1000)} ${short ? 'bya' : 'billion years ago'}`;
  if (ma >= 1) return `${trim(ma)} ${short ? 'mya' : 'million years ago'}`;
  const years = ma * 1e6;
  const unit = short ? 'ya' : 'years ago';
  if (years >= 10000) return `${(Math.round(years / 1000) * 1000).toLocaleString()} ${unit}`;
  if (years >= 1000) return `${(Math.round(years / 100) * 100).toLocaleString()} ${unit}`;
  const year = Math.round(new Date().getFullYear() - years);
  if (short) return `${Math.round(years)} ya`;
  return `${Math.round(years)} years ago (~${year > 0 ? `${year} AD` : `${-year} BC`})`;
}

/** Compact axis label: 4200 → "4.2 Ga", 66 → "66 Ma", 0.01 → "10 ka". */
export function formatTick(ma: number): string {
  if (ma <= 0) return 'Now';
  if (ma >= 1000) return `${trim(ma / 1000)} Ga`;
  if (ma >= 1) return `${trim(ma)} Ma`;
  if (ma >= 0.001) return `${trim(ma * 1000)} ka`;
  return `${Math.round(ma * 1e6)} y`;
}

function trim(x: number): string {
  if (x >= 100) return Math.round(x).toLocaleString();
  if (x >= 10) return (Math.round(x * 10) / 10).toString();
  return (Math.round(x * 100) / 100).toString();
}
