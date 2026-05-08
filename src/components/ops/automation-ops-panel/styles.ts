export const RUN_STATUS_STYLES: Record<string, string> = {
  needs_approval: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  rejected: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  cancelled: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

export const ACTION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  executed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  skipped: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

export const inputClass = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/35 focus:ring-1 focus:ring-accent/20 transition';

export const textareaClass = `${inputClass} min-h-[88px] resize-y`;
