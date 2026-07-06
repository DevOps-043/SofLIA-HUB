import type { ShareTab } from './types';

interface ShareTabsProps {
  tab: ShareTab;
  onChange: (tab: ShareTab) => void;
}

export function ShareTabs({ tab, onChange }: ShareTabsProps) {
  return (
    <div className="relative z-10 px-6 pb-4">
      <div className="flex bg-gray-100 dark:bg-white/[0.04] p-1 rounded-xl border border-gray-200/10 dark:border-white/[0.02]">
        <TabButton active={tab === 'members'} onClick={() => onChange('members')}>Miembros</TabButton>
        <TabButton active={tab === 'link'} onClick={() => onChange('link')}>Enlace</TabButton>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 rounded-[9px] text-[11.5px] font-bold transition-all duration-200 ${
        active
          ? 'bg-white dark:bg-white/[0.08] text-accent shadow-sm shadow-black/5 dark:shadow-none'
          : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
      }`}
    >
      {children}
    </button>
  );
}
