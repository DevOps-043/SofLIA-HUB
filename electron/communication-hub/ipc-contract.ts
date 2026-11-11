import { COMMUNICATION_IPC_LIMITS as limits } from '../../src/shared/communication-hub-ipc';
import { boundedJsonSnapshot, isJsonStringChoice as choice, type JsonObject } from '../../src/shared/bounded-json';
import type { ChannelActorInput, ChannelMessageRequest, ChannelScheduleRequest, OrgConnectionUpdate } from './types';

export function communicationObject(raw: unknown, fields: string[]): JsonObject {
  const value = boundedJsonSnapshot(raw, limits.inputBytes);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !fields.includes(k))) throw new Error('Campos de comunicación no válidos.');
  return value;
}
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes(String.fromCharCode(0))) throw new Error('Texto de comunicación no válido.'); return value;
}
function booleans(value: JsonObject, keys: string[]): void { for (const k of keys) if (value[k] !== undefined && typeof value[k] !== 'boolean') throw new Error('Preferencia no válida.'); }
function strings(value: unknown): void { if (!Array.isArray(value) || value.length > limits.listItems) throw new Error('Lista no válida.'); for (const item of value) text(item); }
export function communicationActor(raw: unknown, actor: ChannelActorInput): ChannelActorInput {
  if (raw !== undefined && raw !== null) {
    const value = communicationObject(raw, ['userId', 'organizationId']);
    for (const k of ['userId', 'organizationId'] as const) if (value[k] !== undefined && value[k] !== null && value[k] !== actor[k]) throw new Error('Actor no autorizado.');
  }
  return { ...actor };
}
export function communicationPreferences(raw: unknown): JsonObject {
  const fields = ['whatsappEnabled', 'telegramEnabled', 'notificationsEnabled', 'remindersEnabled', 'ownDeviceControlEnabled'];
  const value = communicationObject(raw, [...fields, 'telegramChatId']); booleans(value, fields); if (value.telegramChatId !== undefined) text(value.telegramChatId); return value;
}
export function communicationPolicy(raw: unknown): JsonObject {
  const value = communicationObject(raw, ['whatsapp', 'telegram', 'campaigns']);
  if (value.whatsapp !== undefined) {
    const wa = communicationObject(value.whatsapp, ['groupPolicy', 'groupActivation', 'groupPrefix', 'allowedGroups', 'globalAgentEnabled']); booleans(wa, ['globalAgentEnabled']);
    if (wa.groupPolicy !== undefined && !choice(wa.groupPolicy, ['disabled', 'allowlist', 'open'])) throw new Error('Política no válida.');
    if (wa.groupActivation !== undefined && !choice(wa.groupActivation, ['mention', 'always'])) throw new Error('Activación no válida.');
    if (wa.groupPrefix !== undefined && (typeof wa.groupPrefix !== 'string' || wa.groupPrefix.length > 64)) throw new Error('Prefijo no válido.');
    if (wa.allowedGroups !== undefined) strings(wa.allowedGroups);
  }
  if (value.telegram !== undefined) { const tg = communicationObject(value.telegram, ['allowedChatIds', 'globalAgentEnabled']); booleans(tg, ['globalAgentEnabled']); if (tg.allowedChatIds !== undefined) strings(tg.allowedChatIds); }
  if (value.campaigns !== undefined) { const campaign = communicationObject(value.campaigns, ['dailyLimit', 'requirePreview']); booleans(campaign, ['requirePreview']); if (campaign.dailyLimit !== undefined && (typeof campaign.dailyLimit !== 'number' || !Number.isInteger(campaign.dailyLimit) || campaign.dailyLimit < 1 || campaign.dailyLimit > limits.dailyLimit)) throw new Error('Límite diario no válido.'); }
  return value;
}
export function communicationConnection(raw: unknown): OrgConnectionUpdate {
  const value = communicationObject(raw, ['provider', 'action', 'apiKey', 'updates']);
  if (value.provider === 'whatsapp') {
    if (value.updates !== undefined || !choice(value.action, ['connect', 'disconnect', 'set-api-key'])) throw new Error('Conexión no válida.');
    if (value.action === 'set-api-key') text(value.apiKey, 512); else if (value.apiKey !== undefined) throw new Error('Clave inesperada.');
  } else if (value.provider === 'telegram') {
    if (value.action !== undefined || value.apiKey !== undefined) throw new Error('Conexión no válida.');
    const update = communicationObject(value.updates, ['enabled', 'bot_token', 'poll_interval_ms', 'allowed_chat_ids', 'reset_offset']); booleans(update, ['enabled', 'reset_offset']);
    if (update.bot_token !== undefined && !(update.bot_token === '' && update.enabled === false)) text(update.bot_token, 512);
    if (update.allowed_chat_ids !== undefined) strings(update.allowed_chat_ids);
    if (update.poll_interval_ms !== undefined && (typeof update.poll_interval_ms !== 'number' || !Number.isInteger(update.poll_interval_ms) || update.poll_interval_ms < limits.pollMinMs || update.poll_interval_ms > limits.pollMaxMs)) throw new Error('Intervalo no válido.');
  } else throw new Error('Proveedor no válido.');
  return value as unknown as OrgConnectionUpdate;
}
/** Describe la intención sobre la clave sin exponer su valor. */
export function communicationConnectionPreview(update: OrgConnectionUpdate): string {
  if (update.provider === 'whatsapp') return update.action;
  const token = update.updates.bot_token;
  return JSON.stringify({ ...update.updates, bot_token: token === undefined ? undefined : token === '' ? '[eliminar clave]' : '[clave oculta]' });
}
export function communicationMessage(raw: unknown, actor: ChannelActorInput, scheduled: boolean): ChannelMessageRequest | ChannelScheduleRequest {
  const value = communicationObject(raw, ['provider', 'scope', 'recipient', 'text', 'actor', 'metadata', ...(scheduled ? ['scheduledAt'] : [])]);
  if (!choice(value.provider, ['whatsapp', 'telegram']) || !choice(value.scope, ['personal', 'organization'])) throw new Error('Destino no válido.');
  const recipient = text(value.recipient).trim();
  const phone = /^\+?[\d\s().-]+$/.test(recipient) && /^\d{6,20}$/.test(recipient.replace(/\D/g, ''));
  if (value.provider === 'whatsapp' && !phone && !/^\d{6,20}@(s\.whatsapp\.net|g\.us)$/.test(recipient) || value.provider === 'telegram' && !/^(?:-?\d{1,24}|@[a-zA-Z0-9_]{5,64})$/.test(recipient)) throw new Error('Destinatario no válido.');
  text(value.text, limits.messageChars); const selected = communicationActor(value.actor, actor);
  if (value.metadata !== undefined) { const metadata = communicationObject(value.metadata, ['segment']); if (metadata.segment !== undefined) text(metadata.segment, 256); }
  if (scheduled && (typeof value.scheduledAt !== 'string' || value.scheduledAt.length > 64 || !Number.isFinite(Date.parse(value.scheduledAt)) || Date.parse(value.scheduledAt) <= Date.now())) throw new Error('Horario no válido.');
  return { ...value, recipient, actor: selected } as unknown as ChannelMessageRequest | ChannelScheduleRequest;
}
