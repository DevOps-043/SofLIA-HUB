import { HubGlyph } from '../../ui/HubGlyph';
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
  onClose,
}: {
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<'whatsapp' | 'connections' | 'skills'>('whatsapp');

  return (
    <div className="settings-section flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="settings-section-header shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Ecosistema & Herramientas</span>

            </div>
            <h2 className="text-2xl font-sans font-semibold text-gray-900 dark:text-white mt-1 tracking-tight">
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
              <HubGlyph name="chats" size={18} />
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
              <HubGlyph name="connection" size={18} />
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
              <HubGlyph name="summary" size={18} />
              <span>Skills</span>
            </button>

          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="settings-section-body flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        {subTab === 'whatsapp' && (
          <div className="animate-in fade-in duration-200">
            <WhatsAppSetup isOpen onClose={onClose} embedded />
          </div>
        )}

        {subTab === 'connections' && (
          <div className="animate-in fade-in duration-200">
            <ConnectionsPanel />
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
