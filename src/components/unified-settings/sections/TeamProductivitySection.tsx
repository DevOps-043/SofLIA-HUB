import { HubGlyph } from '../../ui/HubGlyph';
import { useState } from 'react';
import { UserManagementModal as TeamContent } from '../../UserManagementModal';
import { ProductivityDashboard } from '../../ProductivityDashboard';
import type { SofiaContext } from '../../../services/sofia-auth';

export function TeamProductivitySection({
  sofiaContext,
  userId,
  onClose,
}: {
  sofiaContext: SofiaContext | null;
  userId: string;
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<'team' | 'productivity'>('team');

  const currentUserRole =
    sofiaContext?.memberships.find(
      (membership) => membership.organization_id === sofiaContext?.currentOrganization?.id,
    )?.role || 'member';

  return (
    <div className="settings-section flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="settings-section-header shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Gestión & Métricas</span>

            </div>
            <h2 className="text-2xl font-sans font-semibold text-gray-900 dark:text-white mt-1 tracking-tight">
              Equipo & Productividad
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Gestiona a los integrantes de tu organización, invita colaboradores y analiza las métricas de rendimiento y tiempo.
            </p>
          </div>

          {/* Sub-Pestañas */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-2xl border border-border shadow-xs">
            {sofiaContext?.currentOrganization && (
              <button
                type="button"
                onClick={() => setSubTab('team')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  subTab === 'team'
                    ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                    : 'text-secondary hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <HubGlyph name="teams" size={18} />
                <span>Miembros ({sofiaContext.currentOrganization.name})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubTab('productivity')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                subTab === 'productivity' || !sofiaContext?.currentOrganization
                  ? 'bg-white dark:bg-[#1e2329] text-accent shadow-xs'
                  : 'text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HubGlyph name="metrics" size={18} />
              <span>Productividad</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="settings-section-body flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        {subTab === 'team' && sofiaContext?.currentOrganization && (
          <div className="animate-in fade-in duration-200">
            <TeamContent
              isOpen
              onClose={onClose}
              organization={sofiaContext.currentOrganization}
              currentUserRole={currentUserRole}
              embedded
            />
          </div>
        )}

        {(subTab === 'productivity' || !sofiaContext?.currentOrganization) && (
          <div className="animate-in fade-in duration-200">
            <ProductivityDashboard userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
