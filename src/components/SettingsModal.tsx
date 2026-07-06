import React, { useState } from 'react';
import { saveSettings } from '../services/settings-service';
import { IdentityCard } from './settings-modal/IdentityCard';
import { LoadingState } from './settings-modal/LoadingState';
import { PersonalityCards } from './settings-modal/PersonalityCards';
import { ProactiveBlock } from './settings-modal/ProactiveBlock';
import { SettingsFooter } from './settings-modal/SettingsFooter';
import { SettingsHeader } from './settings-modal/SettingsHeader';
import { useProactiveConfig } from './settings-modal/useProactiveConfig';
import { useSettingsAutosave } from './settings-modal/useSettingsAutosave';
import { useSettingsForm } from './settings-modal/useSettingsForm';
import type { SettingsModalProps } from './settings-modal/types';
import { Card } from './ui/Card';
import { SectionHeader } from './ui/SectionHeader';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onSave, embedded = false }) => {
  const [saving, setSaving] = useState(false);
  const form = useSettingsForm({ isOpen, userId });
  const proactive = useProactiveConfig(isOpen);

  useSettingsAutosave({
    enabled: form.isInitialized && isOpen,
    form,
    proactive,
    userId,
    onSave,
    setSaving,
  });

  const [activeSubTab, setActiveSubTab] = useState<'personality' | 'interface' | 'proactive'>('personality');

  const handleSave = async () => {
    setSaving(true);
    const settings = form.toUserSettings(userId);
    const success = await saveSettings(settings);
    await proactive.saveConfig();
    setSaving(false);
    if (success) {
      onSave?.(settings);
      if (!embedded) onClose();
    }
  };

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-background rounded-3xl border border-border shadow-2xl animate-fade-in relative'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      {!embedded && <SettingsHeader onClose={onClose} />}

      {/* Sub-tab navigation bar */}
      <div className="flex border-b border-border/30 bg-black/[0.01] dark:bg-white/[0.01] px-6 py-2.5 gap-2 flex-shrink-0">
        <button
          onClick={() => setActiveSubTab('personality')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
            activeSubTab === 'personality'
              ? 'bg-accent/10 text-accent shadow-[0_2px_8px_rgba(0,212,179,0.06)] border border-accent/20'
              : 'text-secondary hover:text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border border-transparent'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personalidad y Contexto
        </button>
        
        <button
          onClick={() => setActiveSubTab('interface')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
            activeSubTab === 'interface'
              ? 'bg-accent/10 text-accent shadow-[0_2px_8px_rgba(0,212,179,0.06)] border border-accent/20'
              : 'text-secondary hover:text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border border-transparent'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          </svg>
          Diseño de Interfaz
        </button>

        {proactive.available && (
          <button
            onClick={() => setActiveSubTab('proactive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
              activeSubTab === 'proactive'
                ? 'bg-accent/10 text-accent shadow-[0_2px_8px_rgba(0,212,179,0.06)] border border-accent/20'
                : 'text-secondary hover:text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Agente Proactivo
          </button>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-visible no-scrollbar px-6 py-6 relative z-10">
        {form.loading ? (
          <LoadingState />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4">
            {activeSubTab === 'personality' && (
              <div className="space-y-6">
                <IdentityCard form={form} />
                <PersonalityCards form={form} />
              </div>
            )}
            {activeSubTab === 'interface' && (
              <div className="space-y-6">
                <InterfaceSettingsBlock />
              </div>
            )}
            {activeSubTab === 'proactive' && proactive.available && (
              <div className="space-y-6">
                <ProactiveBlock proactive={proactive} />
              </div>
            )}
          </div>
        )}
      </div>

      <SettingsFooter saving={saving} loading={form.loading} onClose={onClose} onSave={handleSave} />
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      {content}
    </div>
  );
};

function InterfaceSettingsBlock() {
  const [sidebarPosition, setSidebarPositionState] = useState<'left' | 'right' | 'bottom'>(() => {
    return (localStorage.getItem('sofLia_sidebarPosition') as any) || 'left';
  });

  const handlePositionChange = (pos: 'left' | 'right' | 'bottom') => {
    setSidebarPositionState(pos);
    localStorage.setItem('sofLia_sidebarPosition', pos);
    if (window.computerUse?.setSidebarPosition) {
      window.computerUse.setSidebarPosition(pos).catch((err) => {
        console.error('Error saving sidebar position to backend config:', err);
      });
    }
    window.dispatchEvent(new Event('sofLia_sidebarPositionChanged'));
  };

  return (
    <Card>
      <SectionHeader
        title="Diseño de la Interfaz"
        subtitle="Posición de la barra de tareas y conversaciones"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          </svg>
        }
      />
      
      <div className="grid grid-cols-3 gap-3 mt-5">
        {(['left', 'right', 'bottom'] as const).map((pos) => {
          const active = sidebarPosition === pos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handlePositionChange(pos)}
              className={`px-4 py-3 rounded-2xl text-xs font-semibold border transition-all duration-200 flex flex-col items-center gap-2.5 ${
                active
                  ? 'bg-accent/10 border-accent/30 text-accent shadow-[0_4px_16px_rgba(0,212,179,0.06)]'
                  : 'bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-500 hover:text-gray-950 dark:text-white/60 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              {/* Display a small mockup icon matching the position */}
              <div className="relative w-12 h-8 rounded border border-current/25 flex items-center justify-center bg-black/5 dark:bg-white/5">
                {pos === 'left' && <div className="absolute left-0 top-0 bottom-0 w-3.5 bg-accent/60 rounded-l" />}
                {pos === 'right' && <div className="absolute right-0 top-0 bottom-0 w-3.5 bg-accent/60 rounded-r" />}
                {pos === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-2.5 bg-accent/60 rounded-b" />}
              </div>
              <span>{pos === 'left' ? 'Izquierda' : pos === 'right' ? 'Derecha' : 'Abajo (Barra)'}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
