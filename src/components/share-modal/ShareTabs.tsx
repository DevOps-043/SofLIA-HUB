import type { ShareTab } from './types';

interface ShareTabsProps {
  tab: ShareTab;
  onChange: (tab: ShareTab) => void;
}

export function ShareTabs({ tab, onChange }: ShareTabsProps) {
  return (
    <div className="relative z-10 px-8 pb-3 flex gap-2">
      <TabButton active={tab === 'members'} onClick={() => onChange('members')}>Miembros</TabButton>
      <TabButton active={tab === 'link'} onClick={() => onChange('link')}>Enlace</TabButton>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-accent/10 text-accent border border-accent/20' : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}
