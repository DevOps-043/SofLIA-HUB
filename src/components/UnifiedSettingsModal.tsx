import { useEffect, useState } from 'react';

import type { UserAISettings } from '../services/settings-service';
import { SettingsContent } from './unified-settings/SettingsContent';
import {
  getSettingsCategoryGroups,
  resolveMasterTab,
  type SettingsTab,
} from './unified-settings/settings-tabs';

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
  initialTab = 'identity',
}: UnifiedSettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(resolveMasterTab(initialTab));
  const [currentVersion, setCurrentVersion] = useState('0.9.6');

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(resolveMasterTab(initialTab));
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
  const categoryGroups = getSettingsCategoryGroups(sofiaContext);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1240px] h-[90vh] max-h-[860px] bg-background rounded-3xl border border-border/80 shadow-[0_2.5rem_7rem_rgba(2,12,22,0.34)] flex animate-in zoom-in-95 duration-250 overflow-hidden relative"
        onClick={(event) => event.stopPropagation()}
        style={{ fontFamily: 'var(--font-system-ui)' }}
      >
        {/* Floating Premium Close Button (Top-Right of modal) */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-2 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-border/80 text-secondary hover:text-danger transition-all duration-200 flex items-center justify-center z-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Cerrar Ajustes (Esc)"
          aria-label="Cerrar Ajustes"
        >
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Sidebar Rediseñado: Grupos por categoría, tipografía SOFIA, ultra-limpio */}
        <div className="w-64 bg-sidebar border-r border-border/70 flex flex-col transition-all z-30 relative shrink-0">
          
          {/* Header del Sidebar */}
          <div className="p-6 pb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 shadow-xs">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-widest leading-none block font-mono">Ajustes</span>
              <span className="text-[10px] text-secondary font-sans block mt-0.5">Configuración SofLIA</span>
            </div>
          </div>

          {/* Menú de Navegación por Grupos Categóricos */}
          <nav className="flex-1 w-full px-3 py-2 space-y-5 flex flex-col overflow-y-auto no-scrollbar">
            {categoryGroups.map((group) => {
              const visibleTabs = group.tabs.filter((t) => !t.hidden);
              if (visibleTabs.length === 0) return null;

              return (
                <div key={group.title} className="space-y-1">
                  {/* Eyebrow de Categoría (IBM Plex Sans, tracking 0.18em) */}
                  <div className="px-3 pb-1 text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-secondary/60 select-none">
                    {group.title}
                  </div>

                  {visibleTabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        title={tab.description}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-150 w-full text-left relative group ${
                          isSelected
                            ? 'bg-black/[0.04] dark:bg-white/[0.05] text-accent font-semibold shadow-xs'
                            : 'text-secondary hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.015] dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Indicador de Línea Activa Vertical (SOFIA Standard) */}
                        {isSelected && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />
                        )}

                        <div className={`transition-transform duration-150 shrink-0 ${isSelected ? 'text-accent scale-105' : 'group-hover:scale-105'}`}>
                          {tab.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11.5px] font-medium block truncate leading-tight">{tab.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Footer del Sidebar */}
          <div className="mt-auto w-full p-4 px-6 text-center border-t border-border/50 shrink-0 select-none flex items-center justify-between">
            <span className="text-[9.5px] text-secondary/70 font-mono tracking-wider uppercase">PULSE HUB</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/5 dark:bg-white/5 text-secondary border border-border/60">
              v{currentVersion}
            </span>
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
