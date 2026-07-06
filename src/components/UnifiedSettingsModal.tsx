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
  const [currentVersion, setCurrentVersion] = useState('0.5.3');

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && typeof window.updater !== 'undefined') {
      window.updater.getStatus().then((status) => {
        if (status?.currentVersion) {
          setCurrentVersion(status.currentVersion);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;
  const tabs = getSettingsTabs(sofiaContext);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-320 h-[92vh] bg-background rounded-3xl border border-border shadow-2xl flex animate-in zoom-in-95 duration-300 overflow-hidden relative" onClick={(event) => event.stopPropagation()}>
        
        {/* Floating Premium Close Button (Top-Right of modal) */}
        <button 
          onClick={onClose} 
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-border text-secondary hover:text-danger transition-all duration-200 flex items-center justify-center z-50 group"
          title="Cerrar Ajustes"
        >
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Sidebar rediseñado: ultra-minimalista, limpio y profesional */}
        <div className="w-56 bg-sidebar border-r border-border flex flex-col transition-all z-30 relative shrink-0">
          
          {/* Header del Sidebar (Minimalista) */}
          <div className="p-6 pb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-widest leading-none">Ajustes</span>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex-1 w-full px-3 py-2 space-y-0.5 flex flex-col overflow-y-auto no-scrollbar">
            {tabs.map((tab) => !tab.hidden && (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 w-full text-left relative ${
                  activeTab === tab.id
                    ? 'bg-black/[0.03] dark:bg-white/[0.03] text-accent font-medium'
                    : 'text-secondary hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.015] dark:hover:bg-white/[0.015]'
                }`}
              >
                {/* Indicador de Línea Activa */}
                {activeTab === tab.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-md" />
                )}
                
                <div className={`transition-transform duration-150 shrink-0 ${activeTab === tab.id ? 'text-accent scale-105' : ''}`}>
                  {tab.icon}
                </div>
                <span className="text-[11px] font-medium truncate">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Footer del Sidebar (Solo versión, limpio) */}
          <div className="mt-auto w-full p-6 text-center border-t border-border/50 shrink-0 select-none">
            <span className="text-[9px] text-secondary/50 font-mono tracking-wider uppercase">SofLIA Hub v{currentVersion}</span>
          </div>

        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          <SettingsContent
            activeTab={activeTab}
            onClose={onClose}
            userId={userId}
            onSaveSettings={onSaveSettings}
            sofiaContext={sofiaContext}
            apiKey={apiKey}
          />
        </div>

      </div>
    </div>
  );
};
