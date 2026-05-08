import { ConnectedChannelCard } from './whatsapp-setup/ConnectedChannelCard';
import { ErrorAlert } from './whatsapp-setup/ErrorAlert';
import { GroupSupportCard } from './whatsapp-setup/GroupSupportCard';
import { PersonalWhitelistCard } from './whatsapp-setup/PersonalWhitelistCard';
import { SecurityFooter } from './whatsapp-setup/SecurityFooter';
import { WhatsAppDisconnectedState } from './whatsapp-setup/WhatsAppDisconnectedState';
import { WhatsAppPairingState } from './whatsapp-setup/WhatsAppPairingState';
import { WhatsAppSetupHeader } from './whatsapp-setup/WhatsAppSetupHeader';
import { WhatsAppUnavailableState } from './whatsapp-setup/WhatsAppUnavailableState';
import type { WhatsAppSetupProps } from './whatsapp-setup/types';
import { useWhatsAppSetupState } from './whatsapp-setup/useWhatsAppSetupState';

export function WhatsAppSetup({ isOpen, onClose, apiKey, embedded = false }: WhatsAppSetupProps) {
  const setup = useWhatsAppSetupState({ apiKey, isOpen });
  if (!isOpen && !embedded) return null;

  const showDisconnected = setup.isAvailable && !setup.status.connected && !setup.status.qr && !setup.connecting;
  const showPairing = setup.isAvailable && !setup.status.connected && (setup.connecting || Boolean(setup.status.qr));
  const content = (
    <div
      className={`flex flex-col overflow-hidden transition-all duration-500 ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-sidebar rounded-3xl border border-white/10 shadow-2xl animate-fade-in relative'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      {!embedded && <WhatsAppSetupHeader onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10">
        {!setup.isAvailable && <WhatsAppUnavailableState />}
        {showDisconnected && <WhatsAppDisconnectedState onConnect={setup.handleConnect} />}
        {showPairing && <WhatsAppPairingState connecting={setup.connecting} qr={setup.status.qr} />}
        {setup.isAvailable && setup.status.connected && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ConnectedChannelCard phoneNumber={setup.status.phoneNumber} onDisconnect={setup.handleDisconnect} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PersonalWhitelistCard
                allowedNumbers={setup.status.allowedNumbers}
                numberInput={setup.numberInput}
                onAddNumber={setup.handleAddNumber}
                onNumberInputChange={setup.setNumberInput}
                onRemoveNumber={setup.handleRemoveNumber}
              />
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
