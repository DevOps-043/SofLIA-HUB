import React, { useState } from 'react';
import { saveSettings } from '../services/settings-service';
import { IdentityCard } from './settings-modal/IdentityCard';
import { LoadingState } from './settings-modal/LoadingState';
import { PersonalityCards } from './settings-modal/PersonalityCards';
import { ProactiveBlock } from './settings-modal/ProactiveBlock';
import { SettingsFooter } from './settings-modal/SettingsFooter';
import { SettingsHeader } from './settings-modal/SettingsHeader';
import { useProactiveConfig } from './settings-modal/useProactiveConfig';
import { useSettingsAutosave } from './settings-modal/useSettingsAutosave';
import { useSettingsForm } from './settings-modal/useSettingsForm';
import type { SettingsModalProps } from './settings-modal/types';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onSave, embedded = false }) => {
  const [saving, setSaving] = useState(false);
  const form = useSettingsForm({ isOpen, userId });
  const proactive = useProactiveConfig(isOpen);

  useSettingsAutosave({
    enabled: form.isInitialized && isOpen,
    form,
    proactive,
    userId,
    onSave,
    setSaving,
  });

  const handleSave = async () => {
    setSaving(true);
    const settings = form.toUserSettings(userId);
    const success = await saveSettings(settings);
    await proactive.saveConfig();
    setSaving(false);
    if (success) {
      onSave?.(settings);
      if (!embedded) onClose();
    }
  };

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden transition-all duration-500 ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-white dark:bg-sidebar rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fade-in relative'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none" />
      {!embedded && <SettingsHeader onClose={onClose} />}
      <div className="flex-1 overflow-y-auto overflow-x-visible no-scrollbar px-6 py-6 relative z-10 space-y-6">
        {form.loading ? (
          <LoadingState />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4">
            <IdentityCard form={form} />
            <PersonalityCards form={form} />
            {proactive.available && <ProactiveBlock proactive={proactive} />}
          </div>
        )}
      </div>
      <SettingsFooter saving={saving} loading={form.loading} onClose={onClose} onSave={handleSave} />
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      {content}
    </div>
  );
};
