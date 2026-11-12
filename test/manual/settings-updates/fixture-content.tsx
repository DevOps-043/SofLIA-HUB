import { useState } from 'react';
import { SystemUpdateSection } from '../../../src/components/unified-settings/sections/SystemUpdateSection';
import { IdentityPrivacySection } from '../../../src/components/unified-settings/sections/IdentityPrivacySection';
import type { SettingsFormState } from '../../../src/components/settings-modal/types';
import type { SettingsTab } from '../../../src/components/unified-settings/settings-tabs';
export function SettingsContent({ activeTab }: { activeTab: SettingsTab }) {
  const [nickname, setNickname] = useState('Alex'); const [occupation, setOccupation] = useState('Diseño de productos');
  const [aboutUser, setAboutUser] = useState(''); const [toneStyle, setToneStyle] = useState('Profesional');
  const [charEmojis, setCharEmojis] = useState('Auto'); const [customInstructions, setCustomInstructions] = useState('');
  const form: SettingsFormState = { loading: false, isInitialized: true, nickname, setNickname, occupation, setOccupation, aboutUser, setAboutUser, toneStyle, setToneStyle, charEmojis, setCharEmojis, customInstructions, setCustomInstructions, toUserSettings: () => { throw new Error('Esta fixture no guarda datos.'); } };
  return activeTab === 'system' ? <SystemUpdateSection /> : <IdentityPrivacySection userId="fixture" form={form} />;
}
