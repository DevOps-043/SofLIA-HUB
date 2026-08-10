import type { ReactNode } from 'react';

export function SidebarSectionLabel({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-2.5 pt-3 pb-1.5 flex items-center gap-2">
      <span
        className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/40"
        style={{ fontFamily: 'var(--font-system-label)' }}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-gray-200/60 dark:bg-white/[0.06]" aria-hidden="true" />
      {action}
    </div>
  );
}

