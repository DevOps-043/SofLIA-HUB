import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_WHATSAPP_PERSONALIZATION, DEFAULT_WHATSAPP_STATUS } from './defaultStatus';
import type { WhatsAppAgentPersonalization, WhatsAppStatus } from './types';

interface UseWhatsAppSetupStateOptions {
  apiKey?: string;
  isOpen: boolean;
}

type PersonalizationTarget = 'global' | `contact:${string}` | `group:${string}`;

export function useWhatsAppSetupState({ apiKey, isOpen }: UseWhatsAppSetupStateOptions) {
  const [status, setStatus] = useState<WhatsAppStatus>(DEFAULT_WHATSAPP_STATUS);
  const [connecting, setConnecting] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGroupPolicyDropdownOpen, setIsGroupPolicyDropdownOpen] = useState(false);
  const [selectedPersonalizationTarget, setSelectedPersonalizationTarget] = useState<PersonalizationTarget>('global');
  const [personalizationDraft, setPersonalizationDraft] = useState<WhatsAppAgentPersonalization>(DEFAULT_WHATSAPP_PERSONALIZATION);
  const initialized = useRef(false);

  const currentPersonalization = useMemo(
    () => getPersonalizationForSelection(status, selectedPersonalizationTarget),
    [selectedPersonalizationTarget, status],
  );

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

  useEffect(() => {
    setPersonalizationDraft(currentPersonalization);
  }, [currentPersonalization]);

  useEffect(() => {
    if (selectedPersonalizationTarget === 'global') return;
    const parsed = parsePersonalizationTarget(selectedPersonalizationTarget);
    if (parsed.type === 'contact' && (!status.whitelistEnabled || !status.allowedNumbers.includes(parsed.id))) {
      setSelectedPersonalizationTarget('global');
    }
    if (parsed.type === 'group' && !status.allowedGroups.includes(parsed.id)) {
      setSelectedPersonalizationTarget('global');
    }
  }, [selectedPersonalizationTarget, status.allowedGroups, status.allowedNumbers, status.whitelistEnabled]);

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

  const handleUpdateWhitelistEnabled = useCallback(async (whitelistEnabled: boolean) => {
    if (!window.whatsApp) return;
    const result = await window.whatsApp.setPersonalization({ whitelistEnabled });
    if (result.success) {
      setStatus((previous) => ({ ...previous, whitelistEnabled }));
      if (!whitelistEnabled && selectedPersonalizationTarget.startsWith('contact:')) {
        setSelectedPersonalizationTarget('global');
      }
      setError(null);
    } else {
      setError(result.error || 'Error al actualizar whitelist');
    }
  }, [selectedPersonalizationTarget]);

  const patchPersonalizationDraft = useCallback((patch: Partial<WhatsAppAgentPersonalization>) => {
    setPersonalizationDraft((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleSavePersonalization = useCallback(async () => {
    if (!window.whatsApp) return;
    const normalizedDraft = normalizePersonalizationDraft(personalizationDraft);
    const parsed = parsePersonalizationTarget(selectedPersonalizationTarget);
    const update = buildPersonalizationUpdate(parsed, normalizedDraft, status.whitelistEnabled);
    const result = await window.whatsApp.setPersonalization(update);
    if (!result.success) {
      setError(result.error || 'Error al guardar personalizacion');
      return;
    }
    setStatus((previous) => {
      if (parsed.type === 'contact' && status.whitelistEnabled) {
        return {
          ...previous,
          contactPersonalizations: {
            ...previous.contactPersonalizations,
            [parsed.id]: normalizedDraft,
          },
        };
      }
      if (parsed.type === 'group') {
        return {
          ...previous,
          groupPersonalizations: {
            ...previous.groupPersonalizations,
            [parsed.id]: normalizedDraft,
          },
        };
      }
      return {
        ...previous,
        globalPersonalization: normalizedDraft,
      };
    });
    setError(null);
  }, [personalizationDraft, selectedPersonalizationTarget, status.whitelistEnabled]);

  const handleAddNumber = useCallback(async () => {
    if (!window.whatsApp || !numberInput.trim()) return;
    const cleaned = numberInput.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('Ingresa un numero valido (minimo 10 digitos con codigo de pais)');
      return;
    }
    if (status.allowedNumbers.includes(cleaned)) {
      setError('Ese numero ya esta en la whitelist');
      return;
    }
    const updated = [...status.allowedNumbers, cleaned];
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus((previous) => ({
      ...previous,
      allowedNumbers: updated,
      whitelistEnabled: updated.length > 0 && previous.whitelistEnabled,
    }));
    setNumberInput('');
    setError(null);
  }, [numberInput, status.allowedNumbers]);

  const handleRemoveNumber = useCallback(async (number: string) => {
    if (!window.whatsApp) return;
    const updated = status.allowedNumbers.filter((item) => item !== number);
    await window.whatsApp.setAllowedNumbers(updated);
    setStatus((previous) => {
      const nextContacts = { ...previous.contactPersonalizations };
      delete nextContacts[number];
      return {
        ...previous,
        allowedNumbers: updated,
        whitelistEnabled: updated.length > 0 && previous.whitelistEnabled,
        contactPersonalizations: nextContacts,
      };
    });
    if (selectedPersonalizationTarget === `contact:${number}`) setSelectedPersonalizationTarget('global');
  }, [selectedPersonalizationTarget, status.allowedNumbers]);

  const handleAddGroup = useCallback(async () => {
    if (!window.whatsApp || !groupInput.trim()) return;
    const cleaned = groupInput.trim();
    if (status.allowedGroups.includes(cleaned)) {
      setError('Ese grupo ya esta en la lista');
      return;
    }
    await handleUpdateGroupConfig({ allowedGroups: [...status.allowedGroups, cleaned] });
    setGroupInput('');
  }, [groupInput, handleUpdateGroupConfig, status.allowedGroups]);

  const handleRemoveGroup = useCallback(async (jid: string) => {
    if (!window.whatsApp) return;
    const allowedGroups = status.allowedGroups.filter((group) => group !== jid);
    const result = await window.whatsApp.setGroupConfig({ allowedGroups });
    if (!result.success) {
      setError(result.error || 'Error al actualizar grupos');
      return;
    }
    setStatus((previous) => {
      const nextGroups = { ...previous.groupPersonalizations };
      delete nextGroups[jid];
      return { ...previous, allowedGroups, groupPersonalizations: nextGroups };
    });
    if (selectedPersonalizationTarget === `group:${jid}`) setSelectedPersonalizationTarget('global');
  }, [selectedPersonalizationTarget, status.allowedGroups]);

  return {
    connecting, error, groupInput, handleAddGroup, handleAddNumber, handleConnect,
    handleDisconnect, handleRemoveGroup, handleRemoveNumber, handleSavePersonalization,
    handleUpdateGroupConfig, handleUpdateWhitelistEnabled,
    isAvailable: Boolean(window.whatsApp), isGroupPolicyDropdownOpen, numberInput,
    patchPersonalizationDraft, personalizationDraft, selectedPersonalizationTarget,
    setGroupInput, setIsGroupPolicyDropdownOpen, setNumberInput,
    setSelectedPersonalizationTarget, setStatus, status,
  };
}

function getPersonalizationForSelection(
  status: WhatsAppStatus,
  selectedTarget: PersonalizationTarget,
): WhatsAppAgentPersonalization {
  const globalProfile = normalizePersonalizationDraft(status.globalPersonalization);
  const parsed = parsePersonalizationTarget(selectedTarget);
  if (parsed.type === 'group') {
    return normalizePersonalizationDraft({
      ...globalProfile,
      ...(status.groupPersonalizations?.[parsed.id] || {}),
    });
  }
  if (!status.whitelistEnabled || parsed.type !== 'contact') return globalProfile;
  return normalizePersonalizationDraft({
    ...globalProfile,
    ...(status.contactPersonalizations?.[parsed.id] || {}),
  });
}

function parsePersonalizationTarget(target: PersonalizationTarget): { type: 'global' } | { type: 'contact' | 'group'; id: string } {
  if (target.startsWith('contact:')) return { type: 'contact', id: target.slice('contact:'.length) };
  if (target.startsWith('group:')) return { type: 'group', id: target.slice('group:'.length) };
  return { type: 'global' };
}

function buildPersonalizationUpdate(
  target: ReturnType<typeof parsePersonalizationTarget>,
  profile: WhatsAppAgentPersonalization,
  whitelistEnabled: boolean,
) {
  if (target.type === 'contact' && whitelistEnabled) return { contactPersonalizations: { [target.id]: profile } };
  if (target.type === 'group') return { groupPersonalizations: { [target.id]: profile } };
  return { globalPersonalization: profile };
}

function normalizePersonalizationDraft(input: Partial<WhatsAppAgentPersonalization>): WhatsAppAgentPersonalization {
  return {
    ...DEFAULT_WHATSAPP_PERSONALIZATION,
    ...input,
    displayName: String(input.displayName || DEFAULT_WHATSAPP_PERSONALIZATION.displayName).trim(),
    userAlias: String(input.userAlias || '').trim(),
    responseStyle: String(input.responseStyle || DEFAULT_WHATSAPP_PERSONALIZATION.responseStyle).trim(),
    context: String(input.context || '').trim(),
    customInstructions: String(input.customInstructions || '').trim(),
    flowInstructions: String(input.flowInstructions || DEFAULT_WHATSAPP_PERSONALIZATION.flowInstructions).trim(),
  };
}
