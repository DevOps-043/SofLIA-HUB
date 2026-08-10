import { useState } from 'react';
import { IdentityCard } from '../../settings-modal/IdentityCard';
import { PersonalityCards } from '../../settings-modal/PersonalityCards';
import { useSettingsForm } from '../../settings-modal/useSettingsForm';
import { MemorySkillsCard } from '../../memory/MemorySkillsCard';
import { PrivacySettings } from '../../PrivacySettings';

export function IdentityPrivacySection({
  userId,
  form,
}: {
  userId: string;
  form: ReturnType<typeof useSettingsForm>;
}) {
  const [subTab, setSubTab] = useState<'personality' | 'memory' | 'privacy'>('personality');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Banner de Encabezado Editorial SOFIA (Newsreader display, IBM Plex Sans metadata) */}
      <div className="shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Personalización Principal</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-accent/10 text-accent border border-accent/20">Identidad v3.0</span>
            </div>
            <h2 className="text-2xl font-serif font-light text-gray-900 dark:text-white mt-1 tracking-tight">
              Personalidad & Privacidad
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Configura quién eres para tu IA, su todo de voz basal, sus instrucciones maestras, los recuerdos que conserva y cómo resguarda tu privacidad.
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
              </svg>
              <span>Privacidad & Gobernanza</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO SCROLLABLE */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
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
            <PrivacySettings />
          </div>
        )}
      </div>
    </div>
  );
}
