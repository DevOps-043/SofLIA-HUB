import type { UserAISettings } from '../../services/settings-service';
import { ConnectionsPanel } from '../ConnectionsPanel';
import { ProductivityDashboard as ProductivityContent } from '../ProductivityDashboard';
import { SettingsModal as AISettingsContent } from '../SettingsModal';
import { UpdatePanel as UpdateContent } from '../UpdatePanel';
import { UserManagementModal as TeamContent } from '../UserManagementModal';
import { WorkflowHubPanel } from '../ops/WorkflowHubPanel';
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
