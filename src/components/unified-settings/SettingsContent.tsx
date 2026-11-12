import type { UserAISettings } from '../../services/settings-service';
import type { SofiaContext } from '../../services/sofia-auth';
import type { SettingsTab } from './settings-tabs';
import { resolveMasterTab } from './settings-tabs';
import { useSettingsForm } from '../settings-modal/useSettingsForm';
import { IdentityPrivacySection } from './sections/IdentityPrivacySection';
import { AppearanceVoiceSection } from './sections/AppearanceVoiceSection';
import { IntegrationsSkillsSection } from './sections/IntegrationsSkillsSection';
import { TeamProductivitySection } from './sections/TeamProductivitySection';
import { SystemUpdateSection } from './sections/SystemUpdateSection';
import { OrganizationSettingsSection } from './sections/OrganizationSettingsSection';

export function SettingsContent({
  activeTab,
  onClose,
  userId,
  sofiaContext,
}: {
  activeTab: SettingsTab;
  onClose: () => void;
  userId: string;
  onSaveSettings: (settings: UserAISettings) => void;
  sofiaContext: SofiaContext | null;
}) {
  const form = useSettingsForm({ isOpen: true, userId });

  const masterTab = resolveMasterTab(activeTab);

  switch (masterTab) {
    case 'organization':
      return <OrganizationSettingsSection sofiaContext={sofiaContext} />;
    case 'identity':
      return <IdentityPrivacySection userId={userId} form={form} />;
    case 'appearance':
      return <AppearanceVoiceSection />;
    case 'integrations':
      return (
        <IntegrationsSkillsSection
          onClose={onClose}
        />
      );
    case 'team':
      return (
        <TeamProductivitySection
          sofiaContext={sofiaContext}
          userId={userId}
          onClose={onClose}
        />
      );
    case 'system':
      return <SystemUpdateSection />;
    default:
      return null;
  }
}
