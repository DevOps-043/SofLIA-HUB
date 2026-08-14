import { SKILL_CHANNELS } from '../../src/shared/skills/types';
import { parsePassiveSkillIntent } from './passive-skills/intent';
import type { PassiveSkillRequestContext } from './passive-skills/types';

export { detectPassiveSkillId, parsePassiveSkillIntent } from './passive-skills/intent';
export { extractClockTime } from './passive-skills/clock-time';
export { extractPassiveSchedule } from './passive-skills/schedule';
export { normalizeForIntent } from './passive-skills/normalize';
export type {
  PassiveSkillId,
  PassiveSkillIntent,
  PassiveSkillRequestContext,
} from './passive-skills/types';

/**
 * Alta conversacional de una Skill pasiva desde un canal de mensajeria.
 *
 * Nunca desde un grupo: la rutina y su resultado son material del propietario
 * de la cuenta, y programarla desde un grupo dejaria que un tercero decidiera
 * que recibe y cuando.
 */
export async function tryHandlePassiveSkillRequest({
  passiveSkillsService,
  senderNumber,
  text,
  isGroup,
  channel,
}: PassiveSkillRequestContext): Promise<string | null> {
  if (isGroup || !passiveSkillsService) return null;

  const intent = parsePassiveSkillIntent(text);
  if (!intent) return null;

  // Sin canal pedido explicitamente, se entrega por donde escribio: es el
  // unico destino del que consta que el usuario esta pendiente.
  const channels = intent.channels.length > 0 ? intent.channels : [channel];

  try {
    const rule = await passiveSkillsService.saveRule({
      skillId: intent.skillId ?? null,
      name: intent.name,
      description: intent.description,
      prompt: intent.prompt,
      cronExpression: intent.cronExpression,
      scheduleLabel: intent.scheduleLabel,
      channels,
      requestedBy: `${channel}:${senderNumber}`,
      phoneNumber: channels.includes('whatsapp') ? senderNumber : '',
      source: 'chat',
    });

    return [
      `Listo. Lo guarde como skill pasiva: *${rule.name}*`,
      `Cuando: ${rule.scheduleLabel}`,
      `Donde: ${describeChannels(rule.channels)}`,
      'No necesitas volver a pedirlo; lo voy a ejecutar solo.',
    ].join('\n');
  } catch (error) {
    // El fallo se devuelve al usuario en vez de tragarse: acababa de pedir algo
    // y el silencio le haria creer que quedo programado.
    return `No pude programarlo: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function describeChannels(channels: readonly string[]): string {
  const etiquetas = channels
    .map((canal) => SKILL_CHANNELS.find((entrada) => entrada.value === canal)?.label ?? canal);
  if (etiquetas.length <= 1) return etiquetas[0] ?? 'sin canal';
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}
