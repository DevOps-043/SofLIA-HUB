import { normalizeForIntent } from './normalize';
import { extractPassiveSchedule } from './schedule';
import type { PassiveSkillId, PassiveSkillIntent } from './types';
import type { SkillChannel } from '../../../src/shared/skills/types';

const ACTION_INTENT_REGEX = /\b(recuerdame|avisa|avisame|dame|enviame|mandame|prende|apaga|resume|resumeme|revisa|haz|ejecuta|prepara|busca|traeme|trae|cuentame|dime)\b/;

export function parsePassiveSkillIntent(text: string): PassiveSkillIntent | null {
  const schedule = extractPassiveSchedule(text);
  if (!schedule) return null;

  const normalized = normalizeForIntent(text);
  if (!ACTION_INTENT_REGEX.test(normalized)) return null;

  const skillId = detectPassiveSkillId(text);
  const compact = text.trim().replace(/\s+/g, ' ');
  const name = skillId === 'sistema:correo'
    ? 'Resumen de correos'
    : skillId === 'sistema:agenda'
      ? 'Briefing de agenda'
      : compact.slice(0, 72) || 'Rutina pasiva';

  return {
    skillId,
    name,
    description: skillId
      ? `Skill pasiva de ${name.toLowerCase()} creada desde un chat.`
      : 'Rutina pasiva libre creada desde un chat.',
    prompt: compact,
    cronExpression: schedule.cronExpression,
    scheduleLabel: schedule.scheduleLabel,
    channels: detectChannels(normalized),
  };
}

export function detectPassiveSkillId(text: string): PassiveSkillId | undefined {
  const normalized = normalizeForIntent(text);
  if (/\b(correo|correos|gmail|bandeja|inbox)\b/.test(normalized)) return 'sistema:correo';
  if (/\b(agenda|calendario|calendar|briefing)\b/.test(normalized)) return 'sistema:agenda';
  return undefined;
}

/**
 * Canales pedidos explicitamente en la frase.
 *
 * Se detectan porque el usuario los nombra ("dimelo en la computadora", "por
 * telegram"). Si no nombra ninguno, se devuelve vacio y el destino lo decide
 * quien llama: el canal desde el que escribio. Adivinar aqui un destino que el
 * usuario no pidio lo llevaria a recibir el aviso donde no lo espera.
 */
function detectChannels(normalized: string): SkillChannel[] {
  const canales = new Set<SkillChannel>();
  if (/\b(computadora|compu|escritorio|pc|orbe|en voz alta|hablando)\b/.test(normalized)) {
    canales.add('escritorio');
  }
  if (/\b(whatsapp|wasap|wsp)\b/.test(normalized)) canales.add('whatsapp');
  if (/\b(telegram)\b/.test(normalized)) canales.add('telegram');
  return [...canales];
}
