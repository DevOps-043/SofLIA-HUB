import type { CommunicationHubActor } from '../../src/shared/communication-hub-ipc';
import type { WhatsAppAccessConfigUpdate, WhatsAppPersonalizationUpdate } from '../whatsapp/personalization';
import type { WhatsAppConfig } from '../whatsapp/types';
import type { WhatsAppConversationHistoryFilters } from '../whatsapp/history';
import { communicationActor, communicationObject } from './ipc-contract';
import { isJsonStringChoice, type JsonObject } from '../../src/shared/bounded-json';

const PERMISSIONS = ['files_read', 'files_write', 'screen_view', 'computer_control', 'shell', 'clipboard', 'google_workspace', 'messaging', 'system_control', 'automation', 'remote_nodes'];
function input(raw: unknown, fields: string[], actor: CommunicationHubActor): JsonObject { const value = communicationObject(raw, [...fields, 'actor']); communicationActor(value.actor, actor); delete value.actor; return value; }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max || value.includes(String.fromCharCode(0))) throw new Error('Texto no válido.'); return value; }
function list(raw: unknown, predicate: (value: unknown) => boolean): asserts raw is string[] { if (!Array.isArray(raw) || raw.length > 100 || raw.some(v => !predicate(v))) throw new Error('Lista de comunicación no válida.'); }
function phone(value: unknown): boolean { return typeof value === 'string' && /^\d{6,20}$/.test(value); }
function group(value: unknown): boolean { return typeof value === 'string' && /^\d{6,30}@g\.us$/.test(value); }
export function legacyNumbers(raw: unknown): string[] { list(raw, phone); return [...raw]; }
function permissions(raw: unknown): void { list(raw, value => isJsonStringChoice(value, PERMISSIONS)); }
export function legacyAccess(raw: unknown, actor: CommunicationHubActor): WhatsAppAccessConfigUpdate {
  const value = input(raw, ['masterNumber', 'masterPermissions', 'contactPermissions'], actor);
  if (value.masterNumber !== undefined && value.masterNumber !== null && value.masterNumber !== '' && !phone(value.masterNumber)) throw new Error('Número maestro no válido.');
  if (value.masterPermissions !== undefined) permissions(value.masterPermissions);
  if (value.contactPermissions !== undefined) {
    const map = value.contactPermissions; if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length > 100) throw new Error('Permisos no válidos.');
    for (const [key, item] of Object.entries(map)) { if (!phone(key)) throw new Error('Contacto no válido.'); if (item !== null) permissions(item); }
  }
  return value as unknown as WhatsAppAccessConfigUpdate;
}
export function legacyGroup(raw: unknown, actor: CommunicationHubActor): Partial<Pick<WhatsAppConfig, 'groupPolicy' | 'groupActivation' | 'groupPrefix' | 'allowedGroups' | 'groupAllowFrom'>> {
  const value = input(raw, ['groupPolicy', 'groupActivation', 'groupPrefix', 'allowedGroups', 'groupAllowFrom'], actor);
  if (value.groupPolicy !== undefined && !isJsonStringChoice(value.groupPolicy, ['open', 'allowlist', 'disabled'])) throw new Error('Política no válida.');
  if (value.groupActivation !== undefined && !isJsonStringChoice(value.groupActivation, ['mention', 'always'])) throw new Error('Activación no válida.');
  if (value.groupPrefix !== undefined) text(value.groupPrefix, 40);
  if (value.allowedGroups !== undefined) list(value.allowedGroups, group);
  if (value.groupAllowFrom !== undefined) list(value.groupAllowFrom, phone);
  return value as unknown as ReturnType<typeof legacyGroup>;
}
function profile(raw: unknown): void {
  const limits = { displayName: 60, userAlias: 80, responseStyle: 500, context: 1200, customInstructions: 1600, flowInstructions: 1200 };
  const value = communicationObject(raw, [...Object.keys(limits), 'tone']);
  for (const [key, max] of Object.entries(limits)) if (value[key] !== undefined) text(value[key], max);
  if (value.tone !== undefined && !isJsonStringChoice(value.tone, ['professional', 'warm', 'emotional_support', 'direct', 'custom'])) throw new Error('Tono no válido.');
}
export function legacyPersonalization(raw: unknown, actor: CommunicationHubActor): WhatsAppPersonalizationUpdate {
  const value = input(raw, ['whitelistEnabled', 'globalPersonalization', 'contactPersonalizations', 'groupPersonalizations'], actor);
  if (value.whitelistEnabled !== undefined && typeof value.whitelistEnabled !== 'boolean') throw new Error('Whitelist no válida.');
  if (value.globalPersonalization !== undefined) profile(value.globalPersonalization);
  for (const key of ['contactPersonalizations', 'groupPersonalizations']) if (value[key] !== undefined) {
    const map = value[key]; if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length > 100) throw new Error('Personalización no válida.');
    for (const [target, item] of Object.entries(map)) { if (!(key === 'contactPersonalizations' ? phone(target) : group(target))) throw new Error('Destino no válido.'); if (item !== null) profile(item); }
  }
  return value as unknown as WhatsAppPersonalizationUpdate;
}
export function legacyHistory(raw: unknown, actor: CommunicationHubActor): WhatsAppConversationHistoryFilters {
  const value = input(raw ?? {}, ['jid', 'senderNumber', 'query', 'direction', 'kind', 'since', 'until', 'limit'], actor);
  for (const k of ['jid', 'senderNumber', 'query']) if (value[k] !== undefined) text(value[k], 512);
  if (value.direction !== undefined && !isJsonStringChoice(value.direction, ['incoming', 'outgoing', 'system'])) throw new Error('Dirección no válida.');
  if (value.kind !== undefined && !isJsonStringChoice(value.kind, ['text', 'command', 'media', 'audio', 'file', 'tool', 'transcription'])) throw new Error('Tipo no válido.');
  for (const k of ['since', 'until']) if (value[k] !== undefined && !(typeof value[k] === 'number' && Number.isFinite(value[k]) || typeof value[k] === 'string' && value[k].length <= 64 && Number.isFinite(Date.parse(value[k])))) throw new Error('Fecha no válida.');
  if (value.limit !== undefined && (typeof value.limit !== 'number' || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 100)) throw new Error('Límite no válido.');
  return { ...value, limit: typeof value.limit === 'number' ? value.limit : 25 } as WhatsAppConversationHistoryFilters;
}
