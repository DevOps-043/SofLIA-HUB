import React, { useEffect, useState } from 'react';
import { SettingsModal as AISettingsContent } from './SettingsModal';
import { ConnectionsPanel } from './ConnectionsPanel';
import { UserManagementModal as TeamContent } from './UserManagementModal';
import { ProductivityDashboard as ProductivityContent } from './ProductivityDashboard';
import { UpdatePanel as UpdateContent } from './UpdatePanel';
import { WorkflowHubPanel } from './ops/WorkflowHubPanel';
import { UserAISettings } from '../services/settings-service';

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

export type SettingsTab = 'ai' | 'connections' | 'team' | 'productivity' | 'meetings' | 'agents' | 'updates';

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaveSettings,
  sofiaContext,
  apiKey,
  initialTab = 'ai',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const tabs = [
    {
      id: 'ai' as const,
      label: 'Personalizacion',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: 'connections' as const,
      label: 'Conexiones',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.757 8.188" />
        </svg>
      ),
    },
    {
      id: 'team' as const,
      label: 'Miembros',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
      hidden: !sofiaContext?.currentOrganization,
    },

    {
      id: 'productivity' as const,
      label: 'Productividad',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'agents' as const,
      label: 'Flujos',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 8.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-4.5 9h5.5v1.5h-5.5zm1-10V5.25h3.5v2.5m0 6.5v2.5h-3.5v-2.5" />
        </svg>
      ),
    },
    {
      id: 'updates' as const,
      label: 'Actualizacion',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'ai':
        return (
          <div className="h-full overflow-hidden">
            <AISettingsContent
              isOpen={true}
              onClose={onClose}
              userId={userId}
              onSave={onSaveSettings}
              embedded={true}
            />
          </div>
        );
      case 'connections':
        return (
          <div className="h-full overflow-hidden">
            <ConnectionsPanel apiKey={apiKey} />
          </div>
        );
      case 'team':
        return (
          <div className="h-full overflow-hidden">
            <TeamContent
              isOpen={true}
              onClose={onClose}
              organization={sofiaContext?.currentOrganization || null}
              currentUserRole={
                (sofiaContext?.memberships.find(
                  (membership: any) => membership.organization_id === sofiaContext?.currentOrganization?.id,
                )?.role as any) || 'member'
              }
              embedded={true}
            />
          </div>
        );

      case 'productivity':
        return (
          <div className="h-full overflow-hidden flex flex-col pt-2">
            <div className="px-6 pb-2">
              <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Dashboard de Productividad</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Analiza tus metricas de trabajo y tiempo</p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar border-t border-white/5">
              <ProductivityContent userId={userId} />
            </div>
          </div>
        );
      case 'meetings':
        return (
          <div className="h-full overflow-hidden">
            <WorkflowHubPanel
              userId={userId}
              organizationId={sofiaContext?.currentOrganization?.id || null}
            />
          </div>
        );
      case 'agents':
        return (
          <div className="h-full overflow-hidden">
            <WorkflowHubPanel
              userId={userId}
              organizationId={sofiaContext?.currentOrganization?.id || null}
            />
          </div>
        );
      case 'updates':
        return (
          <div className="h-full overflow-y-auto no-scrollbar">
            <UpdateContent />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-260 h-[90vh] bg-white dark:bg-[#0c0d10] rounded-[2.5rem] border border-black/[0.03] dark:border-white/[0.05] shadow-2xl flex animate-in zoom-in-95 duration-300 overflow-hidden relative"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-purple-500/5 blur-[80px] rounded-full pointer-events-none" />

        <div className="w-20 bg-gray-50 dark:bg-black/20 backdrop-blur-3xl border-r border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center transition-all z-20 relative overflow-x-hidden">
          <div className="py-4 flex-shrink-0" />

          <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar py-6 space-y-5 flex flex-col items-center">
            {tabs.map((tab) => !tab.hidden && (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 group relative flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent shadow-[0_0_20px_rgba(34,211,238,0.1)] scale-105'
                    : 'text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                }`}
                title={tab.label}
              >
                <div className={`${activeTab === tab.id ? 'text-accent scale-105' : 'text-gray-600 group-hover:text-gray-400 group-hover:scale-105'} transition-transform duration-300`}>
                  {tab.icon}
                </div>
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-xl text-gray-900 dark:text-white text-[9px] font-bold uppercase tracking-wider rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-[100] border border-black/5 dark:border-white/5 shadow-2xl flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-accent" />
                  {tab.label}
                </div>
                {activeTab === tab.id && (
                  <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto w-full px-3 pb-8 flex-shrink-0 border-t border-black/[0.03] dark:border-white/[0.03] pt-6 overflow-x-hidden">
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all flex items-center justify-center group relative mx-auto"
              title="Volver al Chat"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur-xl text-gray-900 dark:text-white text-[9px] font-bold uppercase tracking-wider rounded-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-100 border border-black/5 dark:border-white/5 shadow-2xl flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-red-400" />
                Cerrar
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-transparent">
          <div className="flex-1 overflow-hidden">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
