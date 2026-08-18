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

  const masterTab = resolveMasterTab(activeTab);

  switch (masterTab) {
    case 'identity':
      return <IdentityPrivacySection userId={userId} form={form} />;
    case 'appearance':
      return <AppearanceVoiceSection />;
    case 'integrations':
      return (
        <IntegrationsSkillsSection
          apiKey={apiKey}
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
