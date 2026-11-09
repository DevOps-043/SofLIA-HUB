import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getTelegramStatus, isTelegramAvailable, testTelegramConnection, updateTelegramConfig, type TelegramStatusSnapshot } from '../../services/telegram-service';
import type { CommunicationHubActor } from '../../shared/communication-hub-ipc';
import type { TelegramConnectionState } from './types';

export function useTelegramConnection(actor?: CommunicationHubActor): TelegramConnectionState {
  const view = useMemo(() => ({ userId: actor?.userId, organizationId: actor?.organizationId }), [actor?.userId, actor?.organizationId]);
  const active = useRef<typeof view | null>(null);
  const [previousView, setPreviousView] = useState(view);
  const [status, setStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (previousView !== view) { setPreviousView(view); setStatus(null); setTokenInput(''); setTesting(false); setError(null); }
  useLayoutEffect(() => { active.current = view; return () => { if (active.current === view) active.current = null; }; }, [view]);
  const current = useCallback(() => active.current === view, [view]);
  useEffect(() => {
    if (!isTelegramAvailable()) return;
    void Promise.resolve().then(getTelegramStatus).then(snapshot => { if (!current()) return; if (snapshot.success) setStatus(snapshot); else setError(snapshot.error || 'No se pudo consultar Telegram.'); }).catch(() => { if (current()) setError('No se pudo consultar Telegram.'); });
  }, [current]);
  const saveToken = useCallback(async () => {
    if (!current() || !tokenInput.trim()) return; setTesting(true); setError(null);
    try {
      const updated = await updateTelegramConfig({ bot_token: tokenInput.trim(), enabled: true }); if (!current()) return;
      if (!updated.success) { setError(updated.error || 'No se guardó la configuración.'); return; }
      setStatus(updated); setTokenInput('');
      const result = await testTelegramConnection(); if (!current()) return;
      if (result.success) setStatus(previous => previous ? { ...previous, bot: result.bot || null } : previous); else setError(result.error || 'No se pudo comprobar el bot.');
    } catch { if (current()) setError('No se pudo completar la operación de Telegram.'); }
    finally { if (current()) setTesting(false); }
  }, [current, tokenInput]);
  const disconnect = useCallback(async () => {
    if (!current()) return;
    try { const updated = await updateTelegramConfig({ enabled: false, bot_token: '' }); if (!current()) return; if (updated.success) setStatus(updated); else setError(updated.error || 'No se pudo desconectar Telegram.'); }
    catch { if (current()) setError('No se pudo desconectar Telegram.'); }
  }, [current]);
  const toggle = useCallback(async (enabled: boolean) => {
    if (!current()) return;
    try { const updated = await updateTelegramConfig({ enabled }); if (!current()) return; if (updated.success) setStatus(updated); else setError(updated.error || 'No se pudo cambiar Telegram.'); }
    catch { if (current()) setError('No se pudo cambiar Telegram.'); }
  }, [current]);
  return { status, tokenInput, testing, error, connected: !!(status?.configured && status?.enabled && status?.bot), setTokenInput, saveToken, disconnect, toggle };
}
