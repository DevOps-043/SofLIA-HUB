import { HubGlyph } from '../../ui/HubGlyph';
import { useState } from 'react';
import { InterfaceSettingsBlock } from '../../SettingsModal';
import { VoicePassiveSettings } from '../../VoicePassiveSettings';

export function AppearanceVoiceSection() {
  const [subTab, setSubTab] = useState<'interface' | 'voice'>('interface');

  return (
    <div className="settings-section flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="settings-section-header shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Experiencia de Usuario</span>

            </div>
            <h2 className="text-2xl font-sans font-semibold text-gray-900 dark:text-white mt-1 tracking-tight">
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
              <HubGlyph name="appearance" size={18} />
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
              <HubGlyph name="voice" size={18} />
              <span>Voz & Audio</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="settings-section-body flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
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
