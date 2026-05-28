import type { ChatCommandContext } from '../chat-commands';
import {
  buildWhatsAppProfileUpdate,
  formatWhatsAppProfile,
  getResolvedWhatsAppProfile,
  normalizeTone,
  type WhatsAppProfileField,
} from '../../whatsapp/profile-update';
import { DEFAULT_CONFIG, type WhatsAppAgentPersonalization } from '../../whatsapp/types';

const FIELD_ALIASES: Record<string, WhatsAppProfileField | 'tone'> = {
  nombre: 'displayName',
  name: 'displayName',
  trato: 'userAlias',
  alias: 'userAlias',
  tono: 'tone',
  tone: 'tone',
  estilo: 'responseStyle',
  style: 'responseStyle',
  contexto: 'context',
  context: 'context',
  instrucciones: 'customInstructions',
  reglas: 'customInstructions',
  prompt: 'customInstructions',
  flujos: 'flowInstructions',
  acciones: 'flowInstructions',
};

export async function handleProfileCommand(context: ChatCommandContext, args: string[]): Promise<string> {
  const { target, profile } = getResolvedWhatsAppProfile(
    context.waService.config,
    context.jid,
    context.senderNumber,
    context.isGroup,
  );

  if (args.length === 0 || ['ver', 'status', 'estado'].includes(args[0]?.toLowerCase())) {
    return [
      formatWhatsAppProfile(profile, target),
      '',
      'Editar: /perfil nombre LIA',
      'Campos: nombre, trato, tono, estilo, contexto, instrucciones, flujos',
      'Tonos: profesional, cercano, emocional, directo, personalizado',
      'Reset: /perfil reset',
    ].join('\n');
  }

  const action = args[0].toLowerCase();
  if (action === 'reset' || action === 'reiniciar') {
    await context.waService.setPersonalization(buildWhatsAppProfileUpdate(target, target.type === 'global'
      ? DEFAULT_CONFIG.globalPersonalization
      : null));
    return `Listo. Reinicie la personalizacion de *${target.label}*.`;
  }

  const field = FIELD_ALIASES[action];
  if (!field) {
    return 'Uso: /perfil campo valor\nCampos: nombre, trato, tono, estilo, contexto, instrucciones, flujos';
  }

  const rawValue = args.slice(1).join(' ').trim();
  if (!rawValue) return `Necesito el valor para ${action}. Ejemplo: /perfil ${action} LIA`;

  const patch: Partial<WhatsAppAgentPersonalization> = {};
  if (field === 'tone') {
    const tone = normalizeTone(rawValue);
    if (!tone) return 'Tono no reconocido. Usa: profesional, cercano, emocional, directo o personalizado.';
    patch.tone = tone;
  } else {
    patch[field] = rawValue as never;
  }

  await context.waService.setPersonalization(buildWhatsAppProfileUpdate(target, patch));
  return [
    `Listo. Guarde ${action} para *${target.label}*.`,
    field === 'displayName' ? `Desde ahora me presentare como *${rawValue}* en este perfil.` : '',
    target.type === 'global'
      ? 'Nota: como la whitelist no esta activa para este contacto, este cambio aplica al perfil global.'
      : '',
  ].filter(Boolean).join('\n');
}
