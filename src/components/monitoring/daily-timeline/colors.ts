export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  productive: { bg: 'bg-emerald-500', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  unproductive: { bg: 'bg-rose-500', border: 'border-rose-500/20', text: 'text-rose-400' },
  neutral: { bg: 'bg-indigo-500', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  uncategorized: { bg: 'bg-slate-600', border: 'border-slate-500/20', text: 'text-slate-400' },
  idle: { bg: 'bg-slate-800', border: 'border-slate-700/20', text: 'text-slate-500' },
};

export function getCategoryLabel(key: string) {
  if (key === 'productive') return 'Productivo';
  if (key === 'unproductive') return 'Improductivo';
  return 'Neutral';
}
