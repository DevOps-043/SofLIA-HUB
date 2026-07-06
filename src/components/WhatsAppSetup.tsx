import { useMemo, useState } from 'react';
import { AgentPersonalizationCard } from './whatsapp-setup/AgentPersonalizationCard';
import { ConnectedChannelCard } from './whatsapp-setup/ConnectedChannelCard';
import { ErrorAlert } from './whatsapp-setup/ErrorAlert';
import { GroupSupportCard } from './whatsapp-setup/GroupSupportCard';
import { MasterAccessCard } from './whatsapp-setup/MasterAccessCard';
import { OrganizationChannelConsoleCard } from './whatsapp-setup/OrganizationChannelConsoleCard';
import { PersonalWhitelistCard } from './whatsapp-setup/PersonalWhitelistCard';
import { SecurityFooter } from './whatsapp-setup/SecurityFooter';
import { WhatsAppDisconnectedState } from './whatsapp-setup/WhatsAppDisconnectedState';
import { WhatsAppPairingState } from './whatsapp-setup/WhatsAppPairingState';
import { WhatsAppFlowsCard } from './whatsapp-setup/WhatsAppFlowsCard';
import { WhatsAppHistoryCard } from './whatsapp-setup/WhatsAppHistoryCard';
import { WhatsAppSetupHeader } from './whatsapp-setup/WhatsAppSetupHeader';
import { WhatsAppUnavailableState } from './whatsapp-setup/WhatsAppUnavailableState';
import type { WhatsAppSetupProps } from './whatsapp-setup/types';
import { useWhatsAppSetupState } from './whatsapp-setup/useWhatsAppSetupState';
import { useAuth } from '../contexts/AuthContext';

export function WhatsAppSetup({ isOpen, onClose, apiKey, embedded = false }: WhatsAppSetupProps) {
  const auth = useAuth();
  const actor = useMemo(() => ({
    userId: auth.user?.id || null,
    organizationId: auth.sofiaContext?.currentOrganization?.id || null,
  }), [auth.sofiaContext?.currentOrganization?.id, auth.user?.id]);
  const activeMembership = auth.sofiaContext?.memberships.find((membership) =>
    membership.organization_id === auth.sofiaContext?.currentOrganization?.id
  );
  const isOrgAdmin = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';
  const setup = useWhatsAppSetupState({ actor, apiKey, historyEnabled: isOrgAdmin, isOpen });
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'profile' | 'organization'>('security');

  if (!isOpen && !embedded) return null;

  const showDisconnected = setup.isAvailable && !setup.status.connected && !setup.status.qr && !setup.connecting;
  const showPairing = setup.isAvailable && !setup.status.connected && (setup.connecting || Boolean(setup.status.qr));

  const content = (
    <div
      className={`flex flex-col overflow-hidden ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-background rounded-3xl border border-border shadow-2xl animate-fade-in relative'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      {!embedded && <WhatsAppSetupHeader onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10">
        {!setup.isAvailable && <WhatsAppUnavailableState />}
        {showDisconnected && <WhatsAppDisconnectedState onConnect={setup.handleConnect} />}
        {showPairing && <WhatsAppPairingState connecting={setup.connecting} qr={setup.status.qr} />}
        
        {setup.isAvailable && setup.status.connected && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Cabecera y Selector de Pestañas Balanceadas (Estilo Vercel/Linear) */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-6 select-none">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveSubTab('security')}
                  className={`text-xs font-semibold pb-1.5 border-b-2 transition-all relative leading-none ${
                    activeSubTab === 'security'
                      ? 'border-accent text-accent font-bold'
                      : 'border-transparent text-secondary hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Canal y Seguridad
                </button>
                <button
                  onClick={() => setActiveSubTab('profile')}
                  className={`text-xs font-semibold pb-1.5 border-b-2 transition-all relative leading-none ${
                    activeSubTab === 'profile'
                      ? 'border-accent text-accent font-bold'
                      : 'border-transparent text-secondary hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Personalización y Flujos
                </button>
                {isOrgAdmin && (
                  <button
                    onClick={() => setActiveSubTab('organization')}
                    className={`text-xs font-semibold pb-1.5 border-b-2 transition-all relative leading-none ${
                      activeSubTab === 'organization'
                        ? 'border-accent text-accent font-bold'
                        : 'border-transparent text-secondary hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Consola Organizacional
                  </button>
                )}
              </div>
              <div className="text-[10px] text-secondary font-medium tracking-wide uppercase">
                {isOrgAdmin
                  ? activeSubTab === 'security' ? 'Filtros y Seguridad' : activeSubTab === 'organization' ? 'Operacion y Campanas' : 'Personalidad e IA'
                  : 'Canal personal'}
              </div>
            </div>

            {/* Renderizado de contenidos en una única columna espaciosa */}
            <div className="space-y-6 max-w-full">
              
              {activeSubTab === 'security' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Estado del Canal */}
                  <ConnectedChannelCard phoneNumber={setup.status.phoneNumber} onDisconnect={setup.handleDisconnect} />
                  
                  {isOrgAdmin && (
                    <PersonalWhitelistCard
                      allowedNumbers={setup.status.allowedNumbers}
                      numberInput={setup.numberInput}
                      whitelistEnabled={setup.status.whitelistEnabled}
                      onAddNumber={setup.handleAddNumber}
                      onNumberInputChange={setup.setNumberInput}
                      onRemoveNumber={setup.handleRemoveNumber}
                      onWhitelistEnabledChange={setup.handleUpdateWhitelistEnabled}
                    />
                  )}
                  
                  {isOrgAdmin && (
                    <GroupSupportCard
                      groupInput={setup.groupInput}
                      isPolicyDropdownOpen={setup.isGroupPolicyDropdownOpen}
                      status={setup.status}
                      onAddGroup={setup.handleAddGroup}
                      onGroupInputChange={setup.setGroupInput}
                      onRemoveGroup={setup.handleRemoveGroup}
                      onPreviewGroupPrefix={(groupPrefix) => setup.setStatus((previous) => ({ ...previous, groupPrefix }))}
                      onSetPolicyDropdownOpen={setup.setIsGroupPolicyDropdownOpen}
                      onUpdateGroupConfig={setup.handleUpdateGroupConfig}
                    />
                  )}

                  {isOrgAdmin && (
                    <MasterAccessCard
                      allowedNumbers={setup.status.allowedNumbers}
                      contactPermissions={setup.status.contactPermissions}
                      masterNumber={setup.status.masterNumber}
                      masterNumberInput={setup.masterNumberInput}
                      masterPermissions={setup.status.masterPermissions}
                      onMasterNumberInputChange={setup.setMasterNumberInput}
                      onSaveMasterNumber={setup.handleSaveMasterNumber}
                      onToggleMasterPermission={setup.handleToggleMasterPermission}
                      onTogglePermission={setup.handleToggleContactPermission}
                    />
                  )}
                </div>
              )}

              {activeSubTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Personalización del Agente */}
                  <AgentPersonalizationCard
                    allowedNumbers={setup.status.allowedNumbers}
                    groupProfileJids={isOrgAdmin ? Array.from(new Set([
                      ...setup.status.allowedGroups,
                      ...Object.keys(setup.status.groupPersonalizations || {}),
                    ])) : []}
                    whitelistEnabled={isOrgAdmin && setup.status.whitelistEnabled}
                    selectedTarget={setup.selectedPersonalizationTarget}
                    draft={setup.personalizationDraft}
                    onDraftChange={setup.patchPersonalizationDraft}
                    onSave={setup.handleSavePersonalization}
                    onSelectTarget={(target) => setup.setSelectedPersonalizationTarget(target as Parameters<typeof setup.setSelectedPersonalizationTarget>[0])}
                  />

                  {isOrgAdmin && <WhatsAppFlowsCard selectedTarget={setup.selectedPersonalizationTarget} />}

                  {isOrgAdmin && (
                    <WhatsAppHistoryCard
                      events={setup.historyEvents}
                      loading={setup.historyLoading}
                      stats={setup.historyStats}
                      onRefresh={setup.refreshHistory}
                    />
                  )}
                </div>
              )}

              {activeSubTab === 'organization' && isOrgAdmin && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <OrganizationChannelConsoleCard
                    actor={actor}
                    defaultRecipient={setup.status.masterNumber || setup.status.allowedNumbers[0] || ''}
                  />
                </div>
              )}

            </div>

          </div>
        )}
        <ErrorAlert message={setup.error} />
      </div>
      {!embedded && <SecurityFooter />}
    </div>
  );

  if (embedded) return content;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">{content}</div>;
}
