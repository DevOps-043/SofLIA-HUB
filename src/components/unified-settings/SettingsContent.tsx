import type { UserAISettings } from '../../services/settings-service';
import type { SofiaContext } from '../../services/sofia-auth';
import type { SettingsTab } from './settings-tabs';
import { resolveMasterTab } from './settings-tabs';
import { useSettingsForm } from '../settings-modal/useSettingsForm';
import { useProactiveConfig } from '../settings-modal/useProactiveConfig';
import { IdentityPrivacySection } from './sections/IdentityPrivacySection';
import { AppearanceVoiceSection } from './sections/AppearanceVoiceSection';
import { IntegrationsSkillsSection } from './sections/IntegrationsSkillsSection';
import { TeamProductivitySection } from './sections/TeamProductivitySection';
import { SystemUpdateSection } from './sections/SystemUpdateSection';

export function SettingsContent({
  activeTab,
  onClose,
  userId,
  onSaveSettings: _onSaveSettings,
  sofiaContext,
  apiKey,
}: {
  activeTab: SettingsTab;
  onClose: () => void;
  userId: string;
  onSaveSettings: (settings: UserAISettings) => void;
  sofiaContext: SofiaContext | null;
  apiKey: string;
}) {
  const form = useSettingsForm({ isOpen: true, userId });
  const proactive = useProactiveConfig(true);

  const masterTab = resolveMasterTab(activeTab);

  switch (masterTab) {
    case 'identity':
      return <IdentityPrivacySection userId={userId} form={form} />;
    case 'appearance':
      return <AppearanceVoiceSection proactive={proactive} />;
    case 'integrations':
      return (
        <IntegrationsSkillsSection
          apiKey={apiKey}
          userId={userId}
          organizationId={sofiaContext?.currentOrganization?.id || null}
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
