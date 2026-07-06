import type { TelegramConfigUpdates } from '../telegram/types';

export type ChannelProvider = 'whatsapp' | 'telegram';
export type ChannelScope = 'personal' | 'organization';
export type ChannelRole = 'owner' | 'admin' | 'member';

export type ChannelCapability =
  | 'notifications'
  | 'personal_agent'
  | 'personal_reminders'
  | 'own_device_control'
  | 'groups'
  | 'history'
  | 'broadcasts'
  | 'campaigns'
  | 'org_reminders'
  | 'templates'
  | 'approvals'
  | 'incidents'
  | 'surveys'
  | 'onboarding'
  | 'crm_intake'
  | 'kpi_tracking'
  | 'profile_flows'
  | 'org_policy'
  | 'files_read'
  | 'files_write'
  | 'screen_view'
  | 'computer_control'
  | 'shell'
  | 'clipboard'
  | 'google_workspace'
  | 'messaging'
  | 'system_control'
  | 'automation'
  | 'remote_nodes';

export interface ChannelMembership {
  organizationId: string;
  role: ChannelRole;
  status: string;
  teamId?: string | null;
}

export interface ResolvedChannelPrincipal {
  provider: ChannelProvider;
  scope: ChannelScope;
  source: 'sofia' | 'legacy' | 'telegram_identity' | 'unknown';
  active: boolean;
  userId?: string;
  organizationId?: string | null;
  role: ChannelRole;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  channelIdentity?: string | null;
  memberships: ChannelMembership[];
  capabilities: ChannelCapability[];
}

export interface ChannelActorInput {
  userId?: string | null;
  organizationId?: string | null;
}

export interface ChannelPolicy {
  organizationId: string;
  whatsapp: {
    groupPolicy: 'disabled' | 'allowlist' | 'open';
    groupActivation: 'mention' | 'always';
    groupPrefix: string;
    allowedGroups: string[];
    globalAgentEnabled: boolean;
  };
  telegram: {
    allowedChatIds: string[];
    globalAgentEnabled: boolean;
  };
  campaigns: {
    dailyLimit: number;
    requirePreview: boolean;
  };
  updatedAt: string;
  updatedBy?: string | null;
}

export interface TelegramIdentityBinding {
  chatId: string;
  userId: string;
  organizationId?: string | null;
  createdAt: string;
}

export interface CommunicationHubState {
  version: 1;
  policies: Record<string, ChannelPolicy>;
  telegramIdentities: Record<string, TelegramIdentityBinding>;
  audit: ChannelAuditEvent[];
  personalPreferences: Record<string, ChannelPersonalPreferences>;
  scheduledMessages: ChannelScheduledMessage[];
}

export interface ChannelPersonalPreferences {
  userId: string;
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  notificationsEnabled: boolean;
  remindersEnabled: boolean;
  ownDeviceControlEnabled: boolean;
  updatedAt: string;
}

export interface ChannelAuditEvent {
  id: string;
  timestamp: string;
  provider: ChannelProvider;
  scope: ChannelScope;
  action: string;
  allowed: boolean;
  userId?: string | null;
  organizationId?: string | null;
  role: ChannelRole;
  channelIdentity?: string | null;
  targetId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelScheduledMessage {
  id: string;
  provider: ChannelProvider;
  scope: ChannelScope;
  recipient: string;
  text: string;
  scheduledAt: string;
  createdAt: string;
  createdBy?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChannelMessageRequest {
  provider: ChannelProvider;
  scope: ChannelScope;
  recipient: string;
  text: string;
  actor?: ChannelActorInput;
  metadata?: Record<string, unknown>;
}

export interface ChannelScheduleRequest extends ChannelMessageRequest {
  scheduledAt: string;
}

export interface ChannelToolAuthorizationRequest {
  provider: ChannelProvider;
  senderNumber?: string;
  telegramChatId?: string;
  channelId: string;
  toolName: string;
  isGroup: boolean;
  targetNodeId?: string | null;
}

export interface ChannelAuthorizationResult {
  allowed: boolean;
  principal: ResolvedChannelPrincipal;
  requiredCapability?: ChannelCapability | null;
  reason?: string;
}

export type OrgConnectionUpdate =
  | { provider: 'telegram'; updates: TelegramConfigUpdates }
  | { provider: 'whatsapp'; action: 'connect' | 'disconnect' | 'set-api-key'; apiKey?: string };
