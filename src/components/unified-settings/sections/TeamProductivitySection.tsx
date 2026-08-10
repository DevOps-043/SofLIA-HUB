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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Gestión & Métricas</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-accent/10 text-accent border border-accent/20">Organización</span>
            </div>
            <h2 className="text-2xl font-serif font-light text-gray-900 dark:text-white mt-1 tracking-tight">
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
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>Productividad</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
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
