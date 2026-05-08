import { useCallback, useEffect, useState } from 'react';
import {
  getTelegramStatus,
  isTelegramAvailable,
  testTelegramConnection,
  updateTelegramConfig,
  type TelegramBotInfo,
  type TelegramStatusSnapshot,
} from '../../services/telegram-service';
import type { TelegramConnectionState } from './types';

export function useTelegramConnection(): TelegramConnectionState {
  const [status, setStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegramAvailable()) return;
    getTelegramStatus().then(setStatus).catch(() => {});
  }, []);

  const saveToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setTesting(true);
    setError(null);
    try {
      const updated = await updateTelegramConfig({ bot_token: tokenInput.trim(), enabled: true });
      setStatus(updated);
      const test = await testTelegramConnection();
      if (test.success) {
        setStatus((prev) => prev ? { ...prev, bot: test.bot as TelegramBotInfo, polling: true } : prev);
        setTokenInput('');
      } else {
        setError(test.error || 'No se pudo conectar con el bot');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }, [tokenInput]);

  const disconnect = useCallback(async () => {
    await updateTelegramConfig({ enabled: false, bot_token: '' });
    setStatus((prev) => prev ? { ...prev, configured: false, enabled: false, polling: false, bot: null } : prev);
  }, []);

  const toggle = useCallback(async (enabled: boolean) => {
    setStatus(await updateTelegramConfig({ enabled }));
  }, []);

  return {
    status,
    tokenInput,
    testing,
    error,
    connected: !!(status?.configured && status?.enabled && status?.bot),
    setTokenInput,
    saveToken,
    disconnect,
    toggle,
  };
}
