import { useState } from 'react';
import { InterfaceSettingsBlock } from '../../SettingsModal';
import { VoicePassiveSettings } from '../../VoicePassiveSettings';

export function AppearanceVoiceSection() {
  const [subTab, setSubTab] = useState<'interface' | 'voice'>('interface');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Experiencia de Usuario</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-accent/10 text-accent border border-accent/20">UI & Audio</span>
            </div>
            <h2 className="text-2xl font-serif font-light text-gray-900 dark:text-white mt-1 tracking-tight">
              Apariencia & Voz
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Ajusta la posición de la barra de tareas y la interacción por voz pasiva.
            </p>
          </div>

          {/* Sub-Pestañas */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-2xl border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setSubTab('interface')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'interface'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
              </svg>
              <span>Diseño de Interfaz</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('voice')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'voice'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <span>Voz & Audio</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        {subTab === 'interface' && (
          <div className="animate-in fade-in duration-200">
            <InterfaceSettingsBlock />
          </div>
        )}

        {subTab === 'voice' && (
          <div className="animate-in fade-in duration-200">
            <VoicePassiveSettings />
          </div>
        )}
      </div>
    </div>
  );
}
