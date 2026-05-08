import { useEffect, useState } from 'react';
import { loadSettings } from '../../services/settings-service';
import { toUserSettings } from './settings-builders';
import type { SettingsFormState } from './types';

export function useSettingsForm({ isOpen, userId }: { isOpen: boolean; userId: string }): SettingsFormState {
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState('');
  const [occupation, setOccupation] = useState('');
  const [aboutUser, setAboutUser] = useState('');
  const [toneStyle, setToneStyle] = useState('Profesional');
  const [charEmojis, setCharEmojis] = useState('Auto');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    setIsInitialized(false);
    loadSettings(userId).then((settings) => {
      setNickname(settings.nickname);
      setOccupation(settings.occupation);
      setAboutUser(settings.about_user);
      setToneStyle(settings.tone_style);
      setCharEmojis(settings.char_emojis);
      setCustomInstructions(settings.custom_instructions);
      setLoading(false);
      timeoutId = setTimeout(() => setIsInitialized(true), 500);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, userId]);

  return {
    loading,
    isInitialized,
    nickname,
    occupation,
    aboutUser,
    toneStyle,
    charEmojis,
    customInstructions,
    setNickname,
    setOccupation,
    setAboutUser,
    setToneStyle,
    setCharEmojis,
    setCustomInstructions,
    toUserSettings: (nextUserId: string) =>
      toUserSettings(nextUserId, { nickname, occupation, aboutUser, toneStyle, charEmojis, customInstructions }),
  };
}
