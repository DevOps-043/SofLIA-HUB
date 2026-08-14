import { useState } from 'react';
import { WhatsAppSetup } from '../../WhatsAppSetup';
import { ConnectionsPanel } from '../../ConnectionsPanel';
import { SkillsSettingsPanel } from '../../skills-settings/SkillsSettingsPanel';

/**
 * Ya no hay sub-pestaña de Flujos de Trabajo: los flujos y las Skills eran dos
 * modelos para la misma idea y se unificaron en Skills. Las aprobaciones de
 * reuniones que aquella pestaña listaba viven en Meeting Ops, que es donde
 * siempre estuvo su vista canónica.
 */
export function IntegrationsSkillsSection({
  apiKey,
  onClose,
}: {
  apiKey: string;
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<'whatsapp' | 'connections' | 'skills'>('whatsapp');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Ecosistema & Herramientas</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-accent/10 text-accent border border-accent/20">Integraciones v3.0</span>
            </div>
            <h2 className="text-2xl font-serif font-light text-gray-900 dark:text-white mt-1 tracking-tight">
              Integraciones & Skills
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Conecta servicios externos, vincula WhatsApp Agent y decide qué skills están activas en cada canal, tanto las que invocas como las que se ejecutan solas.
            </p>
          </div>

          {/* Sub-Pestañas */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-2xl border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setSubTab('whatsapp')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'whatsapp'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.5h5m-8.5 8 1.4-3.8A8 8 0 1112 20a8.2 8.2 0 01-3.7-.88L4 19.75z" />
              </svg>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('connections')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'connections'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.757 8.188" />
              </svg>
              <span>Conexiones API</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('skills')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'skills'
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.3 2.3 0 0 1-3.2-3.2z" />
              </svg>
              <span>Skills</span>
            </button>

          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        {subTab === 'whatsapp' && (
          <div className="animate-in fade-in duration-200">
            <WhatsAppSetup isOpen onClose={onClose} apiKey={apiKey} embedded />
          </div>
        )}

        {subTab === 'connections' && (
          <div className="animate-in fade-in duration-200">
            <ConnectionsPanel apiKey={apiKey} />
          </div>
        )}

        {subTab === 'skills' && (
          <div className="animate-in fade-in duration-200">
            <SkillsSettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
