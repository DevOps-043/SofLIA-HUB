import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_WHATSAPP_STATUS } from './defaultStatus';
import type { WhatsAppStatus } from './types';

interface UseWhatsAppSetupStateOptions {
  apiKey?: string;
  isOpen: boolean;
}

export function useWhatsAppSetupState({ apiKey, isOpen }: UseWhatsAppSetupStateOptions) {
  const [status, setStatus] = useState<WhatsAppStatus>(DEFAULT_WHATSAPP_STATUS);
  const [connecting, setConnecting] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGroupPolicyDropdownOpen, setIsGroupPolicyDropdownOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isOpen || !window.whatsApp) return;
    const loadStatus = async () => setStatus(await window.whatsApp!.getStatus());

    loadStatus();
    if (apiKey) window.whatsApp.setApiKey(apiKey);
    window.whatsApp.onQR((qr: string) => {
      setStatus((previous) => ({ ...previous, qr }));
      setConnecting(false);
    });
    window.whatsApp.onStatusChange((nextStatus: WhatsAppStatus) => {
      setStatus(nextStatus);
      if (nextStatus.connected) {
        setConnecting(false);
        setError(null);
      }
    });
    initialized.current = true;
    return () => {
      window.whatsApp?.removeListeners();
      initialized.current = false;
    };
  }, [apiKey, isOpen]);

  const handleConnect = useCallback(async () => {
    if (!window.whatsApp) return;
    setConnecting(true);
    setError(null);
    if (apiKey) await window.whatsApp.setApiKey(apiKey);
    const result = await window.whatsApp.connect();
    if (!result.success) {
      setError(result.error || 'Error al conectar');
      setConnecting(false);
    }
  }, [apiKey]);

  const handleDisconnect = useCallback(async () => {
    if (!window.whatsApp) return;
    await window.whatsApp.disconnect();
    setStatus((previous) => ({ ...previous, connected: false, phoneNumber: null, qr: null }));
  }, []);

  const handleUpdateGroupConfig = useCallback(async (updates: Partial<WhatsAppStatus>) => {
    if (!window.whatsApp) return;
    const result = await window.whatsApp.setGroupConfig(updates);
    if (result.success) setStatus((previous) => ({ ...previous, ...updates }));
    else setError(result.error || 'Error al actualizar configuracion');
  }, []);

  const handleAddNumber = useCallback(async () => {
    if (!window.whatsApp || !numberInput.trim()) return;
    const cleaned = numberInput.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('Ingresa un numero valido (minimo 10 digitos con codigo de pais)');
      return;
    }
    const updated = [...status.allowedNumbers, cleaned];
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus((previous) => ({ ...previous, allowedNumbers: updated }));
    setNumberInput('');
    setError(null);
  }, [numberInput, status.allowedNumbers]);

  const handleRemoveNumber = useCallback(async (number: string) => {
    if (!window.whatsApp) return;
    const updated = status.allowedNumbers.filter((item) => item !== number);
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus((previous) => ({ ...previous, allowedNumbers: updated }));
  }, [status.allowedNumbers]);

  const handleAddGroup = useCallback(async () => {
    if (!window.whatsApp || !groupInput.trim()) return;
    await handleUpdateGroupConfig({ allowedGroups: [...status.allowedGroups, groupInput.trim()] });
    setGroupInput('');
  }, [groupInput, handleUpdateGroupConfig, status.allowedGroups]);

  const handleRemoveGroup = useCallback(async (jid: string) => {
    await handleUpdateGroupConfig({ allowedGroups: status.allowedGroups.filter((group) => group !== jid) });
  }, [handleUpdateGroupConfig, status.allowedGroups]);

  return {
    connecting, error, groupInput, handleAddGroup, handleAddNumber, handleConnect,
    handleDisconnect, handleRemoveGroup, handleRemoveNumber, handleUpdateGroupConfig,
    isAvailable: Boolean(window.whatsApp), isGroupPolicyDropdownOpen, numberInput,
    setGroupInput, setIsGroupPolicyDropdownOpen, setNumberInput, setStatus, status,
  };
}
