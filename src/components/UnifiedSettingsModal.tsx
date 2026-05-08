import { useEffect, useState } from 'react';

import type { UserAISettings } from '../services/settings-service';
import { SettingsContent } from './unified-settings/SettingsContent';
import { getSettingsTabs, type SettingsTab } from './unified-settings/settings-tabs';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userSettings: UserAISettings | null;
  onSaveSettings: (settings: UserAISettings) => void;
  sofiaContext: any;
  apiKey: string;
  initialTab?: SettingsTab;
}

export type { SettingsTab } from './unified-settings/settings-tabs';

export const UnifiedSettingsModal = ({
  isOpen,
  onClose,
  userId,
  onSaveSettings,
  sofiaContext,
  apiKey,
  initialTab = 'ai',
}: UnifiedSettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;
  const tabs = getSettingsTabs(sofiaContext);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-260 h-[90vh] bg-white dark:bg-[#0c0d10] rounded-[2.5rem] border border-black/[0.03] dark:border-white/[0.05] shadow-2xl flex animate-in zoom-in-95 duration-300 overflow-hidden relative" onClick={(event) => event.stopPropagation()}>
        <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-purple-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="w-20 bg-gray-50 dark:bg-black/20 backdrop-blur-3xl border-r border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center transition-all z-20 relative overflow-x-hidden">
          <div className="py-4 flex-shrink-0" />
          <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar py-6 space-y-5 flex flex-col items-center">
            {tabs.map((tab) => !tab.hidden && (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 group relative flex-shrink-0 ${activeTab === tab.id ? 'bg-accent/10 text-accent shadow-[0_0_20px_rgba(34,211,238,0.1)] scale-105' : 'text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'}`} title={tab.label}>
                <div className={`${activeTab === tab.id ? 'text-accent scale-105' : 'text-gray-600 group-hover:text-gray-400 group-hover:scale-105'} transition-transform duration-300`}>
                  {tab.icon}
                </div>
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-xl text-gray-900 dark:text-white text-[9px] font-bold uppercase tracking-wider rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-[100] border border-black/5 dark:border-white/5 shadow-2xl flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-accent" />
                  {tab.label}
                </div>
                {activeTab === tab.id && <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)]" />}
              </button>
            ))}
          </nav>
          <div className="mt-auto w-full px-3 pb-8 flex-shrink-0 border-t border-black/[0.03] dark:border-white/[0.03] pt-6 overflow-x-hidden">
            <button onClick={onClose} className="w-11 h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all flex items-center justify-center group relative mx-auto" title="Volver al Chat">
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-transparent">
          <div className="flex-1 overflow-hidden">
            <SettingsContent activeTab={activeTab} onClose={onClose} userId={userId} onSaveSettings={onSaveSettings} sofiaContext={sofiaContext} apiKey={apiKey} />
          </div>
        </div>
      </div>
    </div>
  );
};
