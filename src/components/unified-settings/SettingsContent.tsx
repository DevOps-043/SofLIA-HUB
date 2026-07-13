import type { UserAISettings } from '../../services/settings-service';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { ProductivityDashboard as ProductivityContent } from '../ProductivityDashboard';
import { MemorySkillsCard } from '../memory/MemorySkillsCard';
import { PrivacySettings } from '../PrivacySettings';
import { SettingsModal as AISettingsContent } from '../SettingsModal';
import { UpdatePanel as UpdateContent } from '../UpdatePanel';
import { UserManagementModal as TeamContent } from '../UserManagementModal';
import { WorkflowHubPanel } from '../ops/WorkflowHubPanel';
import { VoicePassiveSettings } from '../VoicePassiveSettings';
import { WhatsAppSetup } from '../WhatsAppSetup';
import type { SettingsTab } from './settings-tabs';

export function SettingsContent({
  activeTab,
  onClose,
  userId,
  onSaveSettings,
  sofiaContext,
  apiKey,
}: {
  activeTab: SettingsTab;
  onClose: () => void;
  userId: string;
  onSaveSettings: (settings: UserAISettings) => void;
  sofiaContext: any;
  apiKey: string;
}) {
  switch (activeTab) {
    case 'ai':
      return <div className="h-full overflow-hidden"><AISettingsContent isOpen onClose={onClose} userId={userId} onSave={onSaveSettings} embedded /></div>;
    case 'memory':
      return <div className="h-full overflow-y-auto p-6"><MemorySkillsCard userId={userId} /></div>;
    case 'whatsapp':
      return <div className="h-full overflow-hidden"><WhatsAppSetup isOpen onClose={onClose} apiKey={apiKey} embedded /></div>;
    case 'voice':
      return <div className="h-full overflow-y-auto"><VoicePassiveSettings /></div>;
    case 'privacy':
      return <div className="h-full overflow-y-auto"><PrivacySettings /></div>;
    case 'connections':
      return <div className="h-full overflow-hidden"><ConnectionsPanel apiKey={apiKey} /></div>;
    case 'team':
      return (
        <div className="h-full overflow-hidden">
          <TeamContent
            isOpen
            onClose={onClose}
            organization={sofiaContext?.currentOrganization || null}
            currentUserRole={
              (sofiaContext?.memberships.find(
                (membership: any) => membership.organization_id === sofiaContext?.currentOrganization?.id,
              )?.role as any) || 'member'
            }
            embedded
          />
        </div>
      );
    case 'productivity':
      return (
        <div className="h-full overflow-hidden flex flex-col pt-2">
          <div className="px-6 pb-3">
            <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Dashboard de Productividad</h3>
            <p className="text-xs text-secondary">Analiza tus metricas de trabajo y tiempo</p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar border-t border-border">
            <ProductivityContent userId={userId} />
          </div>
        </div>
      );
    case 'meetings':
    case 'agents':
      return (
        <div className="h-full overflow-hidden">
          <WorkflowHubPanel userId={userId} organizationId={sofiaContext?.currentOrganization?.id || null} />
        </div>
      );
    case 'updates':
      return <div className="h-full overflow-y-auto no-scrollbar"><UpdateContent /></div>;
    default:
      return null;
  }
}
