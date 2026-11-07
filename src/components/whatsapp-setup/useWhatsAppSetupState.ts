import { getWhatsAppApi } from '../../services/whatsapp-api';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_WHATSAPP_PERSONALIZATION, DEFAULT_WHATSAPP_STATUS } from './defaultStatus';
import type {
  WhatsAppAccessPermission,
  WhatsAppAgentPersonalization,
  WhatsAppConversationHistoryEvent,
  WhatsAppConversationHistoryStats,
  WhatsAppStatus,
} from './types';

interface UseWhatsAppSetupStateOptions {
  apiKey?: string;
  isOpen: boolean;
  actor?: { userId?: string | null; organizationId?: string | null };
  historyEnabled?: boolean;
}

type PersonalizationTarget = 'global' | `contact:${string}` | `group:${string}`;

export function useWhatsAppSetupState({ actor, apiKey, historyEnabled = true, isOpen }: UseWhatsAppSetupStateOptions) {
  const [status, setStatus] = useState<WhatsAppStatus>(DEFAULT_WHATSAPP_STATUS);
  const [connecting, setConnecting] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  const [masterNumberInput, setMasterNumberInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGroupPolicyDropdownOpen, setIsGroupPolicyDropdownOpen] = useState(false);
  const [selectedPersonalizationTarget, setSelectedPersonalizationTarget] = useState<PersonalizationTarget>('global');
  const [personalizationDraft, setPersonalizationDraft] = useState<WhatsAppAgentPersonalization>(DEFAULT_WHATSAPP_PERSONALIZATION);
  const [historyEvents, setHistoryEvents] = useState<WhatsAppConversationHistoryEvent[]>([]);
  const [historyStats, setHistoryStats] = useState<WhatsAppConversationHistoryStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const view = useMemo(() => ({ isOpen, userId: actor?.userId, organizationId: actor?.organizationId }), [isOpen, actor?.userId, actor?.organizationId]);
  const [previousView, setPreviousView] = useState(view);
  const activeView = useRef<typeof view | null>(null);
  if (previousView !== view) {
    setPreviousView(view); setStatus(DEFAULT_WHATSAPP_STATUS); setHistoryEvents([]); setHistoryStats(null); setConnecting(false); setHistoryLoading(false); setError(null);
    setNumberInput(''); setMasterNumberInput(''); setGroupInput(''); setIsGroupPolicyDropdownOpen(false); setSelectedPersonalizationTarget('global'); setPersonalizationDraft(DEFAULT_WHATSAPP_PERSONALIZATION);
  }
  useLayoutEffect(() => {
    activeView.current = view;
    return () => { if (activeView.current === view) activeView.current = null; };
  }, [view]);
  const current = useCallback(() => activeView.current === view && view.isOpen, [view]);
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (!current()) return;
    try { const result = await action(); return current() ? result : undefined; }
    catch { if (current()) setError('No se pudo completar la operación de WhatsApp.'); return undefined; }
  }, [current]);

  const currentPersonalization = useMemo(
    () => getPersonalizationForSelection(status, selectedPersonalizationTarget),
    [selectedPersonalizationTarget, status],
  );

  useEffect(() => {
    if (!isOpen || !window.whatsApp) return;
    const api = getWhatsAppApi();
    void Promise.resolve().then(() => run(() => api.getStatus())).then(result => { if (!result || !current()) return; if (result.success === false) setError(result.error || 'No se pudo consultar WhatsApp.'); else setStatus(result); });
    const offQR = api.onQR(qr => { if (!current()) return; setStatus(previous => ({ ...previous, qr })); setConnecting(false); });
    const offStatus = api.onStatusChange(nextStatus => { if (!current()) return; setStatus(nextStatus); if (nextStatus.connected) { setConnecting(false); setError(null); } });
    return () => { if (activeView.current === view) activeView.current = null; if (typeof offQR === 'function') offQR(); if (typeof offStatus === 'function') offStatus(); if (typeof offQR !== 'function' && typeof offStatus !== 'function') api.removeListeners(); };
  }, [isOpen, view, run, current]);

  const refreshHistory = useCallback(async () => {
    if (!window.whatsApp || !historyEnabled || !current()) return; setHistoryLoading(true);
    try {
      const results = await run(() => Promise.all([getWhatsAppApi().getConversationHistory({ limit: 25, actor }), getWhatsAppApi().getConversationHistoryStats(actor)]));
      if (!results || !current()) return; const [eventsResult, statsResult] = results;
      if (eventsResult.success) setHistoryEvents(eventsResult.data || []); else setError(eventsResult.error || 'No se pudo consultar historial.');
      if (statsResult.success) setHistoryStats(statsResult.data || null);
    } finally { if (current()) setHistoryLoading(false); }
  }, [actor, historyEnabled, current, run]);

  useEffect(() => {
    if (!isOpen || !window.whatsApp || !historyEnabled) return;
    refreshHistory();
  }, [historyEnabled, isOpen, refreshHistory, status.connected]);

  useEffect(() => {
    setPersonalizationDraft(currentPersonalization);
  }, [currentPersonalization]);

  useEffect(() => {
    setMasterNumberInput(status.masterNumber || '');
  }, [status.masterNumber]);

  useEffect(() => {
    if (selectedPersonalizationTarget === 'global') return;
    const parsed = parsePersonalizationTarget(selectedPersonalizationTarget);
    if (parsed.type === 'contact' && (!status.whitelistEnabled || !status.allowedNumbers.includes(parsed.id))) {
      setSelectedPersonalizationTarget('global');
    }
    if (parsed.type === 'group' && !status.allowedGroups.includes(parsed.id) && !status.groupPersonalizations?.[parsed.id]) {
      setSelectedPersonalizationTarget('global');
    }
  }, [selectedPersonalizationTarget, status.allowedGroups, status.allowedNumbers, status.groupPersonalizations, status.whitelistEnabled]);

  const handleConnect = useCallback(async () => {
    if (!window.whatsApp || !current()) return; setConnecting(true); setError(null);
    if (apiKey) { const saved = await run(() => getWhatsAppApi().setApiKey(apiKey)); if (!saved || !saved.success) { if (current()) { setConnecting(false); if (saved) setError(saved.error || 'No se guardó la clave.'); } return; } }
    const result = await run(() => getWhatsAppApi().connect());
    if (!result || !result.success) { if (current()) { setConnecting(false); if (result) setError(result.error || 'No se pudo conectar.'); } }
  }, [apiKey, current, run]);

  const handleDisconnect = useCallback(async () => {
    if (!window.whatsApp || !current()) return;
    const result = await run(() => getWhatsAppApi().disconnect()); if (!result || !current()) return;
    if (!result.success) { setError(result.error || 'No se pudo desconectar.'); return; }
    setStatus(previous => ({ ...previous, connected: false, phoneNumber: null, qr: null }));
  }, [current, run]);

  const handleUpdateGroupConfig = useCallback(async (updates: Partial<WhatsAppStatus>) => {
    if (!window.whatsApp || !current()) return;
    const result = await run(() => getWhatsAppApi().setGroupConfig({ ...updates, actor }));
    if (!result || !current()) return;
    if (result.success) setStatus((previous) => ({ ...previous, ...updates }));
    else setError(result.error || 'Error al actualizar configuracion');
  }, [actor, current, run]);

  const handleUpdateWhitelistEnabled = useCallback(async (whitelistEnabled: boolean) => {
    if (!window.whatsApp || !current()) return;
    const result = await run(() => getWhatsAppApi().setPersonalization({ actor, whitelistEnabled }));
    if (!result || !current()) return;
    if (result.success) {
      setStatus((previous) => ({ ...previous, whitelistEnabled }));
      if (!whitelistEnabled && selectedPersonalizationTarget.startsWith('contact:')) {
        setSelectedPersonalizationTarget('global');
      }
      setError(null);
    } else {
      setError(result.error || 'Error al actualizar whitelist');
    }
  }, [actor, selectedPersonalizationTarget, current, run]);

  const patchPersonalizationDraft = useCallback((patch: Partial<WhatsAppAgentPersonalization>) => {
    setPersonalizationDraft((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleSavePersonalization = useCallback(async () => {
    if (!window.whatsApp || !current()) return;
    const normalizedDraft = normalizePersonalizationDraft(personalizationDraft);
    const parsed = parsePersonalizationTarget(selectedPersonalizationTarget);
    const update = { actor, ...buildPersonalizationUpdate(parsed, normalizedDraft, status.whitelistEnabled) };
    const result = await run(() => getWhatsAppApi().setPersonalization(update));
    if (!result || !current()) return;
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
  }, [actor, personalizationDraft, selectedPersonalizationTarget, status.whitelistEnabled, current, run]);

  const handleAddNumber = useCallback(async () => {
    if (!window.whatsApp || !numberInput.trim() || !current()) return;
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
    const numbersResult = await run(() => getWhatsAppApi().setAllowedNumbers(updated, actor));
    if (!numbersResult || !current()) return; if (!numbersResult.success) { setError(numbersResult.error || 'No se guardaron los números.'); return; }
    setStatus((previous) => ({
      ...previous,
      allowedNumbers: updated,
      whitelistEnabled: updated.length > 0 && previous.whitelistEnabled,
    }));
    setNumberInput('');
    setError(null);
  }, [actor, numberInput, status.allowedNumbers, current, run]);

  const handleRemoveNumber = useCallback(async (number: string) => {
    if (!window.whatsApp || !current()) return;
    const updated = status.allowedNumbers.filter((item) => item !== number);
    const numbersResult = await run(() => getWhatsAppApi().setAllowedNumbers(updated, actor));
    if (!numbersResult || !current()) return; if (!numbersResult.success) { setError(numbersResult.error || 'No se guardaron los números.'); return; }
    setStatus(previous => { const contacts = { ...previous.contactPersonalizations }; delete contacts[number]; return { ...previous, allowedNumbers: updated, whitelistEnabled: updated.length > 0 && previous.whitelistEnabled, contactPersonalizations: contacts }; });
    if (selectedPersonalizationTarget === `contact:${number}`) setSelectedPersonalizationTarget('global');
    const cleared = await run(() => getWhatsAppApi().setAccessConfig({ actor, contactPermissions: { [number]: null } }));
    if (!cleared || !current()) return; if (!cleared.success) { setError(cleared.error || 'Se quitó el número, pero no se actualizaron sus permisos.'); return; }
    setStatus((previous) => {
      const nextContacts = { ...previous.contactPersonalizations };
      const nextPermissions = { ...previous.contactPermissions };
      delete nextContacts[number];
      delete nextPermissions[number];
      return {
        ...previous,
        allowedNumbers: updated,
        whitelistEnabled: updated.length > 0 && previous.whitelistEnabled,
        contactPersonalizations: nextContacts,
        contactPermissions: nextPermissions,
      };
    });
    if (selectedPersonalizationTarget === `contact:${number}`) setSelectedPersonalizationTarget('global');
  }, [actor, selectedPersonalizationTarget, status.allowedNumbers, current, run]);

  const handleSaveMasterNumber = useCallback(async () => {
    if (!window.whatsApp || !current()) return;
    const cleaned = masterNumberInput.replace(/[^0-9]/g, '');
    if (masterNumberInput.trim() && cleaned.length < 10) {
      setError('Ingresa un numero maestro valido con codigo de pais');
      return;
    }
    const result = await run(() => getWhatsAppApi().setAccessConfig({ actor, masterNumber: cleaned || null }));
    if (!result || !current()) return;
    if (!result.success) {
      setError(result.error || 'Error al guardar numero maestro');
      return;
    }
    setStatus((previous) => ({ ...previous, masterNumber: cleaned }));
    setError(null);
  }, [actor, masterNumberInput, current, run]);

  const handleToggleContactPermission = useCallback(async (
    number: string,
    permission: WhatsAppAccessPermission,
    enabled: boolean,
  ) => {
    if (!window.whatsApp || !current()) return;
    const currentPermissions = new Set(status.contactPermissions?.[number] || []);
    if (enabled) currentPermissions.add(permission);
    else currentPermissions.delete(permission);
    const nextPermissions = Array.from(currentPermissions);
    const result = await run(() => getWhatsAppApi().setAccessConfig({
      actor,
      contactPermissions: { [number]: nextPermissions.length > 0 ? nextPermissions : null },
    }));
    if (!result || !current()) return;
    if (!result.success) {
      setError(result.error || 'Error al actualizar permisos');
      return;
    }
    setStatus((previous) => {
      const contactPermissions = { ...previous.contactPermissions };
      if (nextPermissions.length > 0) contactPermissions[number] = nextPermissions;
      else delete contactPermissions[number];
      return { ...previous, contactPermissions };
    });
    setError(null);
  }, [actor, status.contactPermissions, current, run]);

  const handleToggleMasterPermission = useCallback(async (
    permission: WhatsAppAccessPermission,
    enabled: boolean,
  ) => {
    if (!window.whatsApp || !current()) return;
    const currentPermissions = new Set(status.masterPermissions || []);
    if (enabled) currentPermissions.add(permission);
    else currentPermissions.delete(permission);
    const masterPermissions = Array.from(currentPermissions);
    const result = await run(() => getWhatsAppApi().setAccessConfig({ actor, masterPermissions }));
    if (!result || !current()) return;
    if (!result.success) {
      setError(result.error || 'Error al actualizar permisos maestros');
      return;
    }
    setStatus((previous) => ({ ...previous, masterPermissions }));
    setError(null);
  }, [actor, status.masterPermissions, current, run]);

  const handleAddGroup = useCallback(async () => {
    if (!window.whatsApp || !groupInput.trim() || !current()) return;
    const cleaned = groupInput.trim();
    if (status.allowedGroups.includes(cleaned)) {
      setError('Ese grupo ya esta en la lista');
      return;
    }
    const allowedGroups = [...status.allowedGroups, cleaned];
    const groupResult = await run(() => getWhatsAppApi().setGroupConfig({ actor, allowedGroups }));
    if (!groupResult || !current()) return; if (!groupResult.success) { setError(groupResult.error || 'No se guardó el grupo.'); return; }
    setStatus(previous => ({ ...previous, allowedGroups }));
    setGroupInput('');
  }, [actor, groupInput, status.allowedGroups, current, run]);

  const handleRemoveGroup = useCallback(async (jid: string) => {
    if (!window.whatsApp || !current()) return;
    const allowedGroups = status.allowedGroups.filter((group) => group !== jid);
    const result = await run(() => getWhatsAppApi().setGroupConfig({ allowedGroups }));
    if (!result || !current()) return;
    if (!result.success) {
      setError(result.error || 'Error al actualizar grupos');
      return;
    }
    setStatus((previous) => {
      return { ...previous, allowedGroups };
    });
  }, [status.allowedGroups, current, run]);

  return {
    connecting, error, groupInput, handleAddGroup, handleAddNumber, handleConnect,
    handleDisconnect, handleRemoveGroup, handleRemoveNumber, handleSavePersonalization,
    handleSaveMasterNumber, handleToggleContactPermission, handleToggleMasterPermission,
    handleUpdateGroupConfig, handleUpdateWhitelistEnabled,
    historyEvents, historyLoading, historyStats, refreshHistory,
    isAvailable: Boolean(window.whatsApp), isGroupPolicyDropdownOpen, masterNumberInput, numberInput,
    patchPersonalizationDraft, personalizationDraft, selectedPersonalizationTarget,
    setGroupInput, setIsGroupPolicyDropdownOpen, setMasterNumberInput, setNumberInput,
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
