import { HubGlyph } from '../../ui/HubGlyph';
import { useState } from 'react';
import { IdentityCard } from '../../settings-modal/IdentityCard';
import { PersonalityCards } from '../../settings-modal/PersonalityCards';
import { useSettingsForm } from '../../settings-modal/useSettingsForm';
import { MemorySkillsCard } from '../../memory/MemorySkillsCard';
import { PrivacySettings } from '../../PrivacySettings';
import { CommandApprovalSettings } from '../../CommandApprovalSettings';

export function IdentityPrivacySection({
  userId,
  form,
}: {
  userId: string;
  form: ReturnType<typeof useSettingsForm>;
}) {
  const [subTab, setSubTab] = useState<'personality' | 'memory' | 'privacy'>('personality');

  return (
    <div className="settings-section flex flex-col h-full overflow-hidden">
      {/* Banner de Encabezado Editorial SOFIA (Newsreader display, IBM Plex Sans metadata) */}
      <div className="settings-section-header shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Personalización Principal</span>

            </div>
            <h2 className="text-2xl font-sans font-semibold text-gray-900 dark:text-white mt-1 tracking-tight">
              Personalidad y privacidad
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Configura quién eres para tu IA, su tono de voz, sus instrucciones maestras, los recuerdos que conserva y cómo resguarda tu privacidad.
            </p>
          </div>

          {/* Sub-Pestañas Fluidas */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-2xl border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setSubTab('personality')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'personality'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HubGlyph name="identity" size={18} />
              <span>Personalidad & Contexto</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('memory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'memory'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HubGlyph name="memory" size={18} />
              <span>Memoria de IA</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('privacy')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'privacy'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HubGlyph name="shield" size={18} />
              <span>Privacidad & Gobernanza</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO SCROLLABLE */}
      <div className="settings-section-body flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        {subTab === 'personality' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <IdentityCard form={form} />
            <PersonalityCards form={form} />
          </div>
        )}

        {subTab === 'memory' && (
          <div className="animate-in fade-in duration-200">
            <MemorySkillsCard userId={userId} />
          </div>
        )}

        {subTab === 'privacy' && (
          <div className="animate-in fade-in duration-200">
            <CommandApprovalSettings />
            <PrivacySettings />
          </div>
        )}
      </div>
    </div>
  );
}
