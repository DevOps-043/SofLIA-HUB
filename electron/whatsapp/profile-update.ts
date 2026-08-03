import { DEFAULT_CONFIG, type WhatsAppAgentPersonalization, type WhatsAppConfig, type WhatsAppPersonaTone } from './types';
import { resolveWhatsAppAgentPersonalization, type WhatsAppPersonalizationUpdate } from './personalization';
import { numbersMatch } from './phone-utils';

export type WhatsAppProfileField =
  | 'displayName'
  | 'userAlias'
  | 'tone'
  | 'responseStyle'
  | 'context'
  | 'customInstructions'
  | 'flowInstructions';

export interface WhatsAppProfileTarget {
  type: 'global' | 'contact' | 'group';
  key: string | null;
  label: string;
}

export function resolveWhatsAppProfileTarget(
  config: WhatsAppConfig,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): WhatsAppProfileTarget {
  if (isGroup && jid.endsWith('@g.us')) {
    return { type: 'group', key: jid, label: `grupo ${jid}` };
  }
  if (config.whitelistEnabled && config.allowedNumbers.length > 0) {
    const matchedNumber = config.allowedNumbers.find((number) => numbersMatch(number, senderNumber));
    if (matchedNumber) return { type: 'contact', key: matchedNumber, label: `contacto +${matchedNumber}` };
  }
  return { type: 'global', key: null, label: 'perfil global' };
}

export function buildWhatsAppProfileUpdate(
  target: WhatsAppProfileTarget,
  profilePatch: Partial<WhatsAppAgentPersonalization> | null,
): WhatsAppPersonalizationUpdate {
  if (target.type === 'contact' && target.key) return { contactPersonalizations: { [target.key]: profilePatch } };
  if (target.type === 'group' && target.key) return { groupPersonalizations: { [target.key]: profilePatch } };
  return { globalPersonalization: profilePatch || DEFAULT_CONFIG.globalPersonalization };
}

export function getResolvedWhatsAppProfile(
  config: WhatsAppConfig,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): { target: WhatsAppProfileTarget; profile: WhatsAppAgentPersonalization } {
  const target = resolveWhatsAppProfileTarget(config, jid, senderNumber, isGroup);
  const resolved = resolveWhatsAppAgentPersonalization(config, senderNumber, isGroup ? jid : null);
  return { target, profile: resolved.personalization };
}

export function normalizeWhatsAppProfilePatch(input: Record<string, unknown>): Partial<WhatsAppAgentPersonalization> {
  const patch: Partial<WhatsAppAgentPersonalization> = {};
  setTextField(patch, 'displayName', input.displayName ?? input.display_name ?? input.nombre);
  setTextField(patch, 'userAlias', input.userAlias ?? input.user_alias ?? input.trato);
  setTextField(patch, 'responseStyle', input.responseStyle ?? input.response_style ?? input.estilo);
  setTextField(patch, 'context', input.context ?? input.contexto);
  setTextField(patch, 'customInstructions', input.customInstructions ?? input.custom_instructions ?? input.instrucciones);
  setTextField(patch, 'flowInstructions', input.flowInstructions ?? input.flow_instructions ?? input.flujos);
  const tone = normalizeTone(input.tone ?? input.tono);
  if (tone) patch.tone = tone;
  return patch;
}

export function normalizeTone(value: unknown): WhatsAppPersonaTone | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['professional', 'profesional', 'pro'].includes(normalized)) return 'professional';
  if (['warm', 'cercano', 'calido', 'calida', 'amable'].includes(normalized)) return 'warm';
  if (['emotional_support', 'emocional', 'apoyo', 'apoyo_emocional', 'acompanamiento'].includes(normalized)) return 'emotional_support';
  if (['direct', 'directo', 'directa'].includes(normalized)) return 'direct';
  if (['custom', 'personalizado', 'personalizada'].includes(normalized)) return 'custom';
  return null;
}

export function formatWhatsAppProfile(profile: WhatsAppAgentPersonalization, target: WhatsAppProfileTarget): string {
  return [
    `Perfil activo: *${target.label}*`,
    `Nombre: ${profile.displayName || 'Pulse'}`,
    `Trato: ${profile.userAlias || 'natural'}`,
    `Tono: ${formatTone(profile.tone)}`,
    `Estilo: ${profile.responseStyle || 'sin estilo especifico'}`,
    profile.context ? `Contexto: ${profile.context}` : '',
    profile.customInstructions ? `Instrucciones: ${profile.customInstructions}` : '',
    profile.flowInstructions ? `Flujos: ${profile.flowInstructions}` : '',
  ].filter(Boolean).join('\n');
}

export function formatTone(tone: WhatsAppPersonaTone): string {
  const labels: Record<WhatsAppPersonaTone, string> = {
    professional: 'profesional',
    warm: 'cercano',
    emotional_support: 'apoyo emocional',
    direct: 'directo',
    custom: 'personalizado',
  };
  return labels[tone] || 'personalizado';
}

function setTextField(
  patch: Partial<WhatsAppAgentPersonalization>,
  field: WhatsAppProfileField,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  patch[field] = String(value).trim() as never;
}
