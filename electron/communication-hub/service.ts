import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { getSofiaClient } from '../iris/clients';
import { normalizePhone } from '../iris/phone';
import { normalizePhoneNumber, numbersMatch } from '../whatsapp/phone-utils';
import { authorizeChannelTool, authorizeHubAdminAction, getCapabilitiesForRole, isOrgAdminRole } from './authorization';
import {
  appendAuditEvent,
  getOrCreateChannelPolicy,
  getOrCreatePersonalPreferences,
  loadCommunicationHubState,
  saveCommunicationHubState,
} from './state';
import type {
  ChannelActorInput,
  ChannelAuditEvent,
  ChannelAuthorizationResult,
  ChannelCapability,
  ChannelMessageRequest,
  ChannelPolicy,
  ChannelProvider,
  ChannelRole,
  ChannelScheduleRequest,
  ChannelScheduledMessage,
  ChannelToolAuthorizationRequest,
  CommunicationHubState,
  OrgConnectionUpdate,
  ResolvedChannelPrincipal,
} from './types';

type CommunicationHubDeps = {
  waService: any;
  telegramService: any;
  remoteNodeService?: any;
};

type SofiaUserRow = {
  id: string;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
};

type SofiaMembershipRow = {
  organization_id: string;
  role: ChannelRole;
  status: string;
  team_id?: string | null;
};

export class CommunicationHubService extends EventEmitter {
  private state: CommunicationHubState | null = null;

  constructor(private readonly deps: CommunicationHubDeps) {
    super();
  }

  init(): void {
    this.state = loadCommunicationHubState((state) => saveCommunicationHubState(state));
  }

  getStateSnapshot(): CommunicationHubState {
    return structuredClone(this.ensureState());
  }

  async getCapabilities(actor?: ChannelActorInput): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    return {
      success: true,
      principal,
      capabilities: principal.capabilities,
      isOrgAdmin: isOrgAdminRole(principal.role),
    };
  }

  async getPersonalStatus(actor?: ChannelActorInput): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    const preferences = principal.userId
      ? getOrCreatePersonalPreferences(this.ensureState(), principal.userId)
      : null;
    this.saveState();
    return {
      success: true,
      principal,
      preferences,
      whatsapp: this.deps.waService.getStatus(),
      telegram: await this.deps.telegramService.getStatus(),
    };
  }

  async updatePersonalPreferences(actor: ChannelActorInput | undefined, updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    if (!principal.active || !principal.userId) return { success: false, error: 'No hay usuario activo para preferencias personales.' };
    const preferences = getOrCreatePersonalPreferences(this.ensureState(), principal.userId);
    for (const key of ['whatsappEnabled', 'telegramEnabled', 'notificationsEnabled', 'remindersEnabled', 'ownDeviceControlEnabled'] as const) {
      if (typeof updates[key] === 'boolean') preferences[key] = updates[key] as boolean;
    }
    if (typeof updates.telegramChatId === 'string' && updates.telegramChatId.trim()) {
      this.ensureState().telegramIdentities[updates.telegramChatId.trim()] = {
        chatId: updates.telegramChatId.trim(),
        userId: principal.userId,
        organizationId: principal.organizationId || null,
        createdAt: new Date().toISOString(),
      };
    }
    preferences.updatedAt = new Date().toISOString();
    this.recordAudit(principal, 'personal_preferences.update', true, { metadata: { updates } });
    this.saveState();
    return { success: true, preferences };
  }

  async getOrgStatus(actor?: ChannelActorInput): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    const admin = authorizeHubAdminAction(principal, 'channels:get-org-status');
    this.recordAudit(principal, 'channels:get-org-status', admin.allowed, { reason: admin.reason });
    if (!admin.allowed) return { success: false, error: admin.reason };
    const organizationId = this.requireOrganizationId(principal);
    return {
      success: true,
      principal,
      policy: getOrCreateChannelPolicy(this.ensureState(), organizationId, principal.userId),
      whatsapp: this.deps.waService.getStatus(),
      telegram: await this.deps.telegramService.getStatus(),
    };
  }

  async updateOrgConnection(actor: ChannelActorInput | undefined, update: OrgConnectionUpdate): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, update.provider);
    const admin = authorizeHubAdminAction(principal, 'channels:update-org-connection');
    this.recordAudit(principal, 'channels:update-org-connection', admin.allowed, { reason: admin.reason, metadata: { provider: update.provider } });
    if (!admin.allowed) return { success: false, error: admin.reason };

    if (update.provider === 'telegram') {
      return this.deps.telegramService.updateConfig(update.updates || {});
    }

    if (update.action === 'connect') {
      await this.deps.waService.connect();
      return { success: true };
    }
    if (update.action === 'disconnect') {
      await this.deps.waService.disconnect();
      return { success: true };
    }
    if (update.action === 'set-api-key') {
      await this.deps.waService.saveApiKey(update.apiKey || '');
      return { success: true };
    }
    return { success: false, error: 'Actualizacion de conexion no reconocida.' };
  }

  async updatePolicy(actor: ChannelActorInput | undefined, updates: Partial<ChannelPolicy>): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    const admin = authorizeHubAdminAction(principal, 'channels:update-policy');
    this.recordAudit(principal, 'channels:update-policy', admin.allowed, { reason: admin.reason, metadata: { updates } });
    if (!admin.allowed) return { success: false, error: admin.reason };
    const organizationId = this.requireOrganizationId(principal);
    const current = getOrCreateChannelPolicy(this.ensureState(), organizationId, principal.userId);
    const next: ChannelPolicy = {
      ...current,
      ...updates,
      organizationId,
      whatsapp: { ...current.whatsapp, ...(updates.whatsapp || {}) },
      telegram: { ...current.telegram, ...(updates.telegram || {}) },
      campaigns: { ...current.campaigns, ...(updates.campaigns || {}) },
      updatedAt: new Date().toISOString(),
      updatedBy: principal.userId || null,
    };
    this.ensureState().policies[organizationId] = next;
    this.saveState();
    return { success: true, policy: next };
  }

  async listIdentities(actor?: ChannelActorInput): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'telegram');
    const admin = authorizeHubAdminAction(principal, 'channels:list-identities');
    this.recordAudit(principal, 'channels:list-identities', admin.allowed, { reason: admin.reason });
    if (!admin.allowed) return { success: false, error: admin.reason };
    return { success: true, telegram: Object.values(this.ensureState().telegramIdentities) };
  }

  async listHistory(actor?: ChannelActorInput): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(actor, 'whatsapp');
    const admin = authorizeHubAdminAction(principal, 'channels:list-history');
    this.recordAudit(principal, 'channels:list-history', admin.allowed, { reason: admin.reason });
    if (!admin.allowed) return { success: false, error: admin.reason };
    return {
      success: true,
      audit: this.ensureState().audit,
      scheduledMessages: this.ensureState().scheduledMessages,
      whatsapp: await this.deps.waService.getConversationHistory({ limit: 50 }),
    };
  }

  async sendMessage(request: ChannelMessageRequest): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(request.actor, request.provider);
    const requiredCapability: ChannelCapability = request.scope === 'organization' ? 'broadcasts' : 'messaging';
    const allowed = principal.active && principal.capabilities.includes(requiredCapability);
    const reason = allowed ? undefined : `Permiso requerido: ${requiredCapability}.`;
    this.recordAudit(principal, 'channels:send-message', allowed, {
      reason,
      targetId: request.recipient,
      metadata: { provider: request.provider, scope: request.scope },
    });
    if (!allowed) return { success: false, error: reason };
    if (request.provider === 'telegram') return this.deps.telegramService.sendMessage(request.recipient, request.text);
    await this.deps.waService.sendText(toWhatsAppJid(request.recipient), request.text);
    return { success: true };
  }

  async scheduleMessage(request: ChannelScheduleRequest): Promise<Record<string, unknown>> {
    const principal = await this.resolvePrincipalForActor(request.actor, request.provider);
    const admin = request.scope === 'organization'
      ? authorizeHubAdminAction(principal, 'channels:schedule-message')
      : { allowed: principal.active && principal.capabilities.includes('personal_reminders'), reason: undefined };
    this.recordAudit(principal, 'channels:schedule-message', admin.allowed, {
      reason: admin.reason,
      targetId: request.recipient,
      metadata: { scheduledAt: request.scheduledAt, provider: request.provider, scope: request.scope },
    });
    if (!admin.allowed) return { success: false, error: admin.reason || 'No tienes permisos para programar este mensaje.' };
    const scheduled: ChannelScheduledMessage = {
      id: randomUUID(),
      provider: request.provider,
      scope: request.scope,
      recipient: request.recipient,
      text: request.text,
      scheduledAt: request.scheduledAt,
      createdAt: new Date().toISOString(),
      createdBy: principal.userId || null,
      organizationId: principal.organizationId || null,
      metadata: request.metadata,
    };
    this.ensureState().scheduledMessages.unshift(scheduled);
    this.saveState();
    return {
      success: true,
      scheduled,
    };
  }

  async authorizeTool(request: ChannelToolAuthorizationRequest): Promise<ChannelAuthorizationResult> {
    const principal = request.provider === 'telegram'
      ? await this.resolvePrincipalFromTelegram(request.telegramChatId || request.channelId)
      : await this.resolvePrincipalFromWhatsApp(request.senderNumber || '');
    const result = authorizeChannelTool(principal, request);
    if (!result.allowed && await this.canUseOwnRemoteNode(principal, request)) {
      const allowedResult = { ...result, allowed: true, reason: undefined };
      this.recordAudit(principal, `tool:${request.toolName}`, true, {
        targetId: request.targetNodeId || request.channelId,
        metadata: { provider: request.provider, isGroup: request.isGroup, requiredCapability: result.requiredCapability || null, ownDevice: true },
      });
      return allowedResult;
    }
    this.recordAudit(principal, `tool:${request.toolName}`, result.allowed, {
      reason: result.reason,
      targetId: request.targetNodeId || request.channelId,
      metadata: { provider: request.provider, isGroup: request.isGroup, requiredCapability: result.requiredCapability || null },
    });
    return result;
  }

  async isTelegramChatAuthorized(chatId: string, action = 'telegram:incoming'): Promise<boolean> {
    const principal = await this.resolvePrincipalFromTelegram(chatId);
    const allowed = principal.active && principal.capabilities.includes('personal_agent');
    this.recordAudit(principal, action, allowed, { targetId: chatId, reason: allowed ? undefined : 'Chat de Telegram sin identidad activa.' });
    return allowed;
  }

  async resolvePrincipalForActor(actor: ChannelActorInput | undefined, provider: ChannelProvider): Promise<ResolvedChannelPrincipal> {
    if (actor?.userId) {
      const profile = await this.fetchSofiaProfileByUserId(actor.userId, actor.organizationId || undefined);
      if (profile) return this.buildPrincipalFromProfile(provider, profile.user, profile.memberships, actor.organizationId || undefined);
    }
    return this.buildLegacyPrincipal(provider);
  }

  async resolvePrincipalFromWhatsApp(senderNumber: string): Promise<ResolvedChannelPrincipal> {
    const normalizedSender = normalizePhone(senderNumber);
    const profile = await this.fetchSofiaProfileByPhone(normalizedSender);
    if (profile) return this.buildPrincipalFromProfile('whatsapp', profile.user, profile.memberships);
    return this.buildLegacyPrincipal('whatsapp', senderNumber);
  }

  private async resolvePrincipalFromTelegram(chatId: string): Promise<ResolvedChannelPrincipal> {
    const binding = this.ensureState().telegramIdentities[String(chatId || '').trim()];
    if (binding?.userId) {
      const profile = await this.fetchSofiaProfileByUserId(binding.userId, binding.organizationId || undefined);
      if (profile) {
        return {
          ...this.buildPrincipalFromProfile('telegram', profile.user, profile.memberships, binding.organizationId || undefined),
          channelIdentity: binding.chatId,
          source: 'telegram_identity',
        };
      }
    }
    return {
      provider: 'telegram',
      scope: 'personal',
      source: 'unknown',
      active: false,
      role: 'member',
      channelIdentity: chatId,
      memberships: [],
      capabilities: [],
    };
  }

  private async fetchSofiaProfileByPhone(normalizedPhone: string): Promise<{ user: SofiaUserRow; memberships: SofiaMembershipRow[] } | null> {
    const sofia = getSofiaClient();
    if (!sofia || !normalizedPhone) return null;
    const { data: users, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone')
      .not('phone', 'is', null);
    if (error || !users) return null;
    const matched = (users as SofiaUserRow[]).find((user) => {
      const userPhone = normalizePhone(user.phone || '');
      return userPhone === normalizedPhone || userPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(userPhone);
    });
    if (!matched) return null;
    const memberships = await this.fetchActiveMemberships(matched.id);
    return { user: matched, memberships };
  }

  private async fetchSofiaProfileByUserId(userId: string, organizationId?: string): Promise<{ user: SofiaUserRow; memberships: SofiaMembershipRow[] } | null> {
    const sofia = getSofiaClient();
    if (!sofia || !userId) return null;
    const { data: user, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone')
      .eq('id', userId)
      .maybeSingle();
    if (error || !user) return null;
    const memberships = await this.fetchActiveMemberships(userId, organizationId);
    return { user: user as SofiaUserRow, memberships };
  }

  private async fetchActiveMemberships(userId: string, organizationId?: string): Promise<SofiaMembershipRow[]> {
    const sofia = getSofiaClient();
    if (!sofia) return [];
    let query = sofia
      .from('organization_users')
      .select('organization_id, role, status, team_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as SofiaMembershipRow[];
  }

  private buildPrincipalFromProfile(
    provider: ChannelProvider,
    user: SofiaUserRow,
    memberships: SofiaMembershipRow[],
    preferredOrganizationId?: string,
  ): ResolvedChannelPrincipal {
    const activeMemberships = memberships.filter((membership) => membership.status === 'active');
    const selected = activeMemberships.find((membership) => membership.organization_id === preferredOrganizationId) || activeMemberships[0] || null;
    const role: ChannelRole = selected?.role || 'member';
    const scope = isOrgAdminRole(role) ? 'organization' : 'personal';
    return {
      provider,
      scope,
      source: 'sofia',
      active: Boolean(selected),
      userId: user.id,
      organizationId: selected?.organization_id || preferredOrganizationId || null,
      role,
      fullName: buildFullName(user),
      email: user.email || null,
      phone: user.phone || null,
      channelIdentity: provider === 'whatsapp' ? user.phone || null : null,
      memberships: activeMemberships.map((membership) => ({
        organizationId: membership.organization_id,
        role: membership.role,
        status: membership.status,
        teamId: membership.team_id || null,
      })),
      capabilities: getCapabilitiesForRole(role, scope),
    };
  }

  private buildLegacyPrincipal(provider: ChannelProvider, senderNumber?: string): ResolvedChannelPrincipal {
    const status = provider === 'whatsapp' ? this.deps.waService.getStatus?.() || {} : {};
    const normalizedSender = normalizePhoneNumber(senderNumber || '');
    const masterNumber = normalizePhoneNumber(status.masterNumber || '');
    const isMaster = Boolean(masterNumber && numbersMatch(masterNumber, normalizedSender));
    const allowedNumbers: unknown[] = Array.isArray(status.allowedNumbers) ? status.allowedNumbers : [];
    const isAllowedLegacyContact = Boolean(
      normalizedSender &&
      allowedNumbers.some((allowed: unknown) => numbersMatch(String(allowed), normalizedSender)),
    );
    const active = provider === 'whatsapp' && (isMaster || isAllowedLegacyContact);
    const role: ChannelRole = isMaster ? 'owner' : 'member';
    const scope = isMaster ? 'organization' : 'personal';
    return {
      provider,
      scope,
      source: 'legacy',
      active,
      role,
      phone: senderNumber || null,
      channelIdentity: senderNumber || null,
      memberships: [],
      capabilities: active ? getCapabilitiesForRole(role, scope) : [],
    };
  }

  private async canUseOwnRemoteNode(
    principal: ResolvedChannelPrincipal,
    request: ChannelToolAuthorizationRequest,
  ): Promise<boolean> {
    if (request.isGroup || !request.targetNodeId || !principal.userId) return false;
    if (!principal.capabilities.includes('own_device_control')) return false;
    if (!request.toolName.includes('_node') && !request.toolName.includes('remote_node')) return false;
    const nodes = await this.deps.remoteNodeService?.listNodes?.();
    const node = Array.isArray(nodes)
      ? nodes.find((candidate) => candidate.id === request.targetNodeId)
      : null;
    return Boolean(
      node &&
      node.visibility === 'personal' &&
      node.owner_user_id === principal.userId,
    );
  }

  private recordAudit(
    principal: ResolvedChannelPrincipal,
    action: string,
    allowed: boolean,
    options: { reason?: string; targetId?: string | null; metadata?: Record<string, unknown> } = {},
  ): void {
    const event: ChannelAuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      provider: principal.provider,
      scope: principal.scope,
      action,
      allowed,
      userId: principal.userId || null,
      organizationId: principal.organizationId || null,
      role: principal.role,
      channelIdentity: principal.channelIdentity || null,
      targetId: options.targetId || null,
      reason: options.reason,
      metadata: options.metadata,
    };
    appendAuditEvent(this.ensureState(), event);
    this.saveState();
  }

  private requireOrganizationId(principal: ResolvedChannelPrincipal): string {
    if (principal.organizationId) return principal.organizationId;
    throw new Error('No se pudo resolver la organizacion activa.');
  }

  private ensureState(): CommunicationHubState {
    if (!this.state) this.init();
    return this.state!;
  }

  private saveState(): void {
    saveCommunicationHubState(this.ensureState());
  }
}

function toWhatsAppJid(recipient: string): string {
  const trimmed = String(recipient || '').trim();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed.replace(/\D/g, '')}@s.whatsapp.net`;
}

function buildFullName(user: SofiaUserRow): string {
  return (
    user.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.username ||
    user.email ||
    user.id
  );
}
