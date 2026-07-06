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
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/70 dark:text-white/40">
        {label}
      </span>
      <span className="h-px flex-1 bg-gray-200/70 dark:bg-white/[0.06]" />
      {action}
    </div>
  );
}
