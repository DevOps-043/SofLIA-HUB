import React, { useState, useEffect } from 'react';
import { SettingsModal as AISettingsContent } from './SettingsModal';
import { WhatsAppSetup as WhatsAppContent } from './WhatsAppSetup';
import { UserManagementModal as TeamContent } from './UserManagementModal';
import AutoDevPanel from './AutoDevPanel';
import { ScreenViewer as ScreenContent } from './ScreenViewer';
import { ProductivityDashboard as ProductivityContent } from './ProductivityDashboard';
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

export type SettingsTab = 'ai' | 'whatsapp' | 'team' | 'autodev' | 'screen' | 'productivity';

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaveSettings,
  sofiaContext,
  apiKey,
  initialTab = 'ai'
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const TABS = [
    { id: 'ai' as const, label: 'Personalización', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )},
    { id: 'whatsapp' as const, label: 'WhatsApp', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    )},
    { id: 'team' as const, label: 'Miembros', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ), hidden: !sofiaContext?.currentOrganization },
    { id: 'autodev' as const, label: 'AutoDev', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    )},
    { id: 'screen' as const, label: 'Ver Pantalla', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'productivity' as const, label: 'Productividad', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
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
      case 'whatsapp':
        return (
          <div className="h-full overflow-hidden">
            <WhatsAppContent 
              isOpen={true} 
              onClose={onClose} 
              apiKey={apiKey}
              embedded={true}
            />
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
                  (m: any) => m.organization_id === sofiaContext?.currentOrganization?.id,
                )?.role as any) || "member"
              }
              embedded={true}
            />
          </div>
        );
      case 'autodev':
        return (
          <div className="h-full overflow-hidden">
            <AutoDevPanel 
              isOpen={true} 
              onClose={onClose}
              embedded={true}
            />
          </div>
        );
      case 'screen':
        return (
          <div className="h-full overflow-hidden flex flex-col pt-2">
            <div className="px-6 pb-2">
              <h3 className="text-white text-lg font-semibold">Visualización de Pantalla</h3>
              <p className="text-xs text-gray-400">Monitorea y captura la actividad de tu escritorio</p>
            </div>
            <div className="flex-1 overflow-hidden border-t border-white/5">
              <ScreenContent />
            </div>
          </div>
        );
      case 'productivity':
        return (
          <div className="h-full overflow-hidden flex flex-col pt-2">
            <div className="px-6 pb-2">
              <h3 className="text-white text-lg font-semibold">Dashboard de Productividad</h3>
              <p className="text-xs text-gray-400">Analiza tus métricas de trabajo y tiempo</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar border-t border-white/5">
              <ProductivityContent userId={userId} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-100 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-250 h-[85vh] bg-[#1a1b1e] rounded-3xl border border-white/10 shadow-2xl flex animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-22 bg-black/40 border-r border-white/5 flex flex-col items-center py-8 z-20">
          <div className="mb-14">
            <img src="/assets/Icono.png" alt="SofLIA" className="w-10 h-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
          </div>
          
          <nav className="flex-1 space-y-7 px-2">
            {TABS.map(tab => !tab.hidden && (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group relative ${
                  activeTab === tab.id 
                    ? 'bg-accent text-[#1a1b1e] shadow-[0_0_20px_rgba(34,211,238,0.4)] scale-110' 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
                title={tab.label}
              >
                <div className={`${activeTab === tab.id ? 'text-[#1a1b1e]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  {tab.icon}
                </div>
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-sidebar/95 backdrop-blur-xl text-white text-[10px] font-bold uppercase tracking-wider rounded-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-[100] border border-white/10 shadow-2xl shadow-black/50 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-accent"></div>
                  {tab.label}
                </div>
                {activeTab === tab.id && (
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-full shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                )}
              </button>
            ))}
          </nav>
          
          <div className="mt-auto px-2 pb-2">
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-red-500/10 hover:border-red-500/30 transition-all flex items-center justify-center group relative"
              title="Volver al Chat"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-sidebar/95 backdrop-blur-xl text-white text-[10px] font-bold uppercase tracking-wider rounded-xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-[100] border border-white/10 shadow-2xl shadow-black/50 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-red-400"></div>
                Volver al Chat
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-transparent">
          {/* Internal Header (Title) - Optional, since content has own headers */}
          <div className="flex-1 overflow-hidden">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
