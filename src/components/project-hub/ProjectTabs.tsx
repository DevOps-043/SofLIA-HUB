import type { ProjectHubTab } from './types';

interface ProjectTabsProps {
  activeTab: ProjectHubTab;
  onSetActiveTab: (tab: ProjectHubTab) => void;
}

const tabs: Array<{ id: ProjectHubTab; label: string }> = [
  { id: 'chats', label: 'Chats' },
  { id: 'sources', label: 'Fuentes' },
];

export function ProjectTabs({ activeTab, onSetActiveTab }: ProjectTabsProps) {
  return (
    <div className="w-full flex items-center gap-6 border-b border-gray-100 dark:border-white/5 mb-6 px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSetActiveTab(tab.id)}
          className={`pb-3.5 text-[11.5px] font-medium tracking-widest uppercase transition-all relative ${activeTab === tab.id ? 'text-primary dark:text-white' : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'}`}
        >
          {tab.label}
          {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-accent rounded-full" />}
        </button>
      ))}
    </div>
  );
}
