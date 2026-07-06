import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type {
  ChannelAuditEvent,
  ChannelPersonalPreferences,
  ChannelPolicy,
  CommunicationHubState,
} from './types';

const MAX_AUDIT_EVENTS = 500;

export function getCommunicationHubStatePath(): string {
  try {
    return path.join(app.getPath('userData'), 'communication-hub-state.json');
  } catch {
    return path.join(process.cwd(), 'communication-hub-state.json');
  }
}

export function buildDefaultCommunicationHubState(): CommunicationHubState {
  return {
    version: 1,
    policies: {},
    telegramIdentities: {},
    audit: [],
    personalPreferences: {},
    scheduledMessages: [],
  };
}

export function loadCommunicationHubState(saveFallback: (state: CommunicationHubState) => void): CommunicationHubState {
  const statePath = getCommunicationHubStatePath();
  try {
    if (!fs.existsSync(statePath)) {
      const fallback = buildDefaultCommunicationHubState();
      saveFallback(fallback);
      return fallback;
    }
    return normalizeCommunicationHubState(JSON.parse(fs.readFileSync(statePath, 'utf-8')));
  } catch (error) {
    console.error('[CommunicationHub] No se pudo cargar el estado:', error);
    const fallback = buildDefaultCommunicationHubState();
    saveFallback(fallback);
    return fallback;
  }
}

export function saveCommunicationHubState(state: CommunicationHubState): void {
  const statePath = getCommunicationHubStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(normalizeCommunicationHubState(state), null, 2), 'utf-8');
}

export function appendAuditEvent(state: CommunicationHubState, event: ChannelAuditEvent): void {
  state.audit.unshift(event);
  state.audit = state.audit.slice(0, MAX_AUDIT_EVENTS);
}

export function getOrCreateChannelPolicy(
  state: CommunicationHubState,
  organizationId: string,
  actorUserId?: string | null,
): ChannelPolicy {
  const existing = state.policies[organizationId];
  if (existing) return existing;
  const now = new Date().toISOString();
  const next: ChannelPolicy = {
    organizationId,
    whatsapp: {
      groupPolicy: 'disabled',
      groupActivation: 'mention',
      groupPrefix: '/soflia',
      allowedGroups: [],
      globalAgentEnabled: false,
    },
    telegram: {
      allowedChatIds: [],
      globalAgentEnabled: false,
    },
    campaigns: {
      dailyLimit: 250,
      requirePreview: true,
    },
    updatedAt: now,
    updatedBy: actorUserId || null,
  };
  state.policies[organizationId] = next;
  return next;
}

export function getOrCreatePersonalPreferences(
  state: CommunicationHubState,
  userId: string,
): ChannelPersonalPreferences {
  const existing = state.personalPreferences[userId];
  if (existing) return existing;
  const next: ChannelPersonalPreferences = {
    userId,
    whatsappEnabled: true,
    telegramEnabled: true,
    notificationsEnabled: true,
    remindersEnabled: true,
    ownDeviceControlEnabled: true,
    updatedAt: new Date().toISOString(),
  };
  state.personalPreferences[userId] = next;
  return next;
}

function normalizeCommunicationHubState(input: Partial<CommunicationHubState>): CommunicationHubState {
  const fallback = buildDefaultCommunicationHubState();
  return {
    version: 1,
    policies: normalizeObject(input.policies) as Record<string, ChannelPolicy>,
    telegramIdentities: normalizeObject(input.telegramIdentities) as CommunicationHubState['telegramIdentities'],
    audit: Array.isArray(input.audit) ? input.audit.slice(0, MAX_AUDIT_EVENTS) : fallback.audit,
    personalPreferences: normalizeObject(input.personalPreferences) as Record<string, ChannelPersonalPreferences>,
    scheduledMessages: Array.isArray(input.scheduledMessages) ? input.scheduledMessages : fallback.scheduledMessages,
  };
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}
